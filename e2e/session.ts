import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BrowserContext } from "@playwright/test";

// Real Django sessions for screen specs (fixtures were removed in T5.6). Sessions are cached between runs and
// re-checked with /api/me, so parents rarely need a new OTP (Django allows 3 codes per phone per 10 minutes).
export type Who = "accounts" | "accounts.mlv" | "counsellor" | "admin" | `parent:${string}`;
const APP = "http://127.0.0.1:3001";
const CACHE = join(tmpdir(), "coaching-fees-e2e-sessions.json");

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for real-session browser specs.`);
  return value;
}

async function api(name: string, body?: unknown, sid?: string) {
  const response = await fetch(`${env("BACKEND_URL")}/api/${name}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "X-Internal-Key": env("INTERNAL_API_SECRET"), ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(sid ? { Cookie: `sid=${sid}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const cookie = response.headers.getSetCookie().map((line) => /^sid=([^;]+)/.exec(line)?.[1]).find(Boolean);
  return { status: response.status, json: await response.json() as Record<string, unknown>, sid: cookie ?? sid };
}

async function freshSession(who: Who): Promise<string> {
  if (!who.startsWith("parent:")) {
    const login = await api("staff_login", { email: `${who}@demo.test`, password: env("SEED_DEMO_PASSWORD") });
    if (!login.json.ok || !login.sid) throw new Error(`Staff sign-in failed for ${who}: ${String(login.json.message)}`);
    return login.sid;
  }
  const phone = who.slice("parent:".length);
  const sent = await api("request_otp", { phone });
  if (!sent.json.ok || typeof sent.json.demoCode !== "string") throw new Error(`OTP request failed for ${phone}: ${String(sent.json.message)} (DEMO_MODE must be true).`);
  const verified = await api("verify_otp", { phone, code: sent.json.demoCode });
  if (!verified.json.ok || !verified.sid) throw new Error(`OTP verification failed for ${phone}: ${String(verified.json.message)}`);
  return verified.sid;
}

async function sessionFor(who: Who) {
  const cache: Record<string, string> = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};
  if (!cache[who] || (await api("me", undefined, cache[who])).status !== 200) {
    cache[who] = await freshSession(who);
    writeFileSync(CACHE, JSON.stringify(cache));
  }
  // The shared demo reset clears the named families' consent, so a still-valid parent session may need it again.
  if (who.startsWith("parent:")) {
    const me = await api("me", undefined, cache[who]);
    if (!me.json.consent) {
      const children = (me.json.children as { id: string }[] | undefined) ?? [];
      const granted = await api("grant_consent", { studentIds: children.map((child) => child.id), wordingVersion: "v1", language: "en" }, cache[who]);
      if (!granted.json.ok) throw new Error(`Consent failed for ${who}: ${String(granted.json.message)}`);
    }
  }
  return cache[who];
}

/** Signs the browser context in as a real demo user before it opens any page. */
export async function signIn(context: BrowserContext, who: Who) {
  await context.addCookies([{ name: "sid", value: await sessionFor(who), url: APP, httpOnly: true, sameSite: "Lax" }]);
}

/** Restores the twelve named demo students through the app's own shared reset (accounts, no centre). */
export async function sharedReset() {
  const result = await api("reset_demo", {}, await sessionFor("accounts"));
  if (!result.json.ok) throw new Error(`Shared reset failed: ${String(result.json.message)}`);
}

/** The public pay page for a parent's oldest unpaid instalment, "/pay/<token>". Dues links straight to the mock gateway, which takes the same token. */
export async function payPath(who: Who = "parent:+919000000587") {
  const dues = await api("dues", undefined, await sessionFor(who));
  const current = dues.json.current as { payUrl: string | null } | null;
  if (!current?.payUrl) throw new Error(`No unpaid instalment with a pay link for ${who}.`);
  return current.payUrl.replace(/^\/mock-gateway\//, "/pay/");
}

/** The newest receipt ID for a parent, for receipt detail pages. */
export async function latestReceiptId(who: Who = "parent:+919000000587") {
  const receipts = await api("receipts", undefined, await sessionFor(who));
  const first = (receipts.json.receipts as { id: string }[] | undefined)?.[0];
  if (!first) throw new Error(`No receipts for ${who}.`);
  return first.id;
}

/** Moves the shared demo date (accounts, no centre). Restore it with setDemoDate("2026-11-02") or sharedReset(). */
export async function setDemoDate(date: string) {
  const result = await api("set_demo_date", { date }, await sessionFor("accounts"));
  if (!result.json.ok) throw new Error(`Demo date failed: ${String(result.json.message)}`);
}

/** Open unmatched payments as Django lists them (accounts, first page), for opening real queue items by ID. */
export async function openUnmatched() {
  const result = await api("automation?list=unmatched&page=1", undefined, await sessionFor("accounts"));
  return ((result.json.unmatched as { id: string; amount: number; reason: string; status: string; suggested: { studentName: string } | null }[] | undefined) ?? [])
    .filter((item) => item.status === "open");
}

/**
 * React's streaming runtime ($RS) can throw "reading 'parentNode'" when a test navigates again before a streamed
 * segment lands. Seen only in rapid automated navigation on real (streaming) pages, never reproduced alone; it is
 * flagged on docs/progress.md for T7.1. Only this exact error is ignored; every other page error still fails.
 */
export const isStreamingRace = (error: Error) => error.message.includes("reading 'parentNode'") && (error.stack ?? "").includes("$RS");
