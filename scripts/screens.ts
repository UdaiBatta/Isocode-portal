import assert from "node:assert/strict";
import { readdirSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

function routes(directory = "app", segments: string[] = []): string[] {
  const found = existsSync(join(directory, "page.tsx")) ? ["/" + segments.join("/")] : [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && !entry.name.startsWith("_")) {
      found.push(...routes(join(directory, entry.name), entry.name.startsWith("(") ? segments : [...segments, entry.name]));
    }
  }
  return found;
}

async function main() {
  const only = process.argv.find((argument) => argument.startsWith("--only="))?.slice(7);
  const examples: Record<string, { name: string; path: string }> = {
    "/staff/students/[code]": { name: "ledger", path: "/staff/students/STU-0587" },
    "/staff/students/[code]/refund": { name: "refund", path: "/staff/students/STU-0587/refund" },
    "/pay/[token]": { name: "pay", path: "/pay/STU-0587-3" },
    "/mock-gateway/[token]": { name: "mock-gateway", path: "/mock-gateway/STU-0587-3" },
    "/pay/[token]/result": { name: "payment-result", path: "/pay/STU-0587-3/result?e=demo-event-1" },
    "/receipts/[id]": { name: "receipt", path: "/receipts/STU-0587-receipt-3" },
  };
  const selected = routes().flatMap((route) => examples[route] ? [examples[route]] : route.includes("[") ? [] : [{ name: route === "/" ? "home" : route.slice(1), path: route }]).filter((route) => !only || route.name === only);
  assert(selected.length, `No existing route matches --only=${only}`);
  const origin = process.env.APP_URL || "http://127.0.0.1:3000";
  try { await fetch(origin); } catch { throw new Error(`Start the app before taking screenshots: npm run start (expected ${origin})`); }
  mkdirSync("docs/screens", { recursive: true });
  const browser = await chromium.launch();
  let count = 0;
  try {
    for (const width of [360, 1280]) {
      for (const language of ["hi", "en"]) {
        const context = await browser.newContext({ viewport: { width, height: width === 360 ? 640 : 800 }, reducedMotion: "reduce" });
        try {
          await context.addCookies([{ name: "lang", value: language, url: origin }]);
          const page = await context.newPage();
          for (const route of selected) {
            await context.clearCookies({ name: "proto" });
            if (route.path.startsWith("/counsellor/")) await context.addCookies([{ name: "proto", value: encodeURIComponent(JSON.stringify({ role: "counsellor" })), url: origin }]);
            if (route.path.startsWith("/staff/") && route.path !== "/staff/login") await context.addCookies([{ name: "proto", value: encodeURIComponent(JSON.stringify({ role: "accounts" })), url: origin }]);
            if (["/consent", "/receipts", "/progress"].includes(route.path) || route.name === "receipt" || route.name === "payment-result") {
              const state = {
                role: "parent", phone: "+919000000587", consent: route.path !== "/consent", otp: { attempts: 0, sends: 1, verified: true },
                ...(route.name === "payment-result" ? {
                  payments: [{ studentCode: "STU-0587", amount: 1500000, on: "2026-11-02", method: "gateway", instalmentId: "STU-0587-3" }],
                  paymentResults: { "demo-event-1": { token: "STU-0587-3", result: "paid", amount: 1500000, receiptId: "demo-receipt-1" } },
                } : {}),
              };
              await context.addCookies([{ name: "proto", value: encodeURIComponent(JSON.stringify(state)), url: origin }]);
            }
            for (const state of ["normal", "loading", "empty", "error"]) {
              const url = new URL(route.path, origin);
              if (state !== "normal") url.searchParams.set("state", state);
              await page.goto(url.toString());
              await page.waitForLoadState("networkidle");
              await page.evaluate(() => document.fonts.ready);
              await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
              assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Horizontal overflow: ${url} at ${width}px`);
              const name = route.name.replaceAll("/", "-");
              await page.screenshot({ path: `docs/screens/${name}-${language}-${state}-${width}.png`, fullPage: true });
              count++;
            }
          }
        } finally { await context.close(); }
      }
    }
  } finally { await browser.close(); }
  console.log(`Saved ${count} screenshots for ${selected.length} existing route(s) to docs/screens/.`);
}

main().catch((error: Error) => { console.error(error.message); process.exitCode = 1; });
