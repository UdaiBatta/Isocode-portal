import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { loadEnvConfig } from "@next/env";
import { chromium } from "@playwright/test";
import { latestReceiptId, payPath, signIn, type Who } from "../e2e/session";
import { routes } from "../e2e/routes";

// Screenshots every screen at both widths and in both languages, signed in with real demo sessions.
// Start the production server on :3001 first; sessions are issued for that origin.
loadEnvConfig(process.cwd());
const origin = "http://127.0.0.1:3001";
const who: Record<string, Who | null> = { parent: "parent:+919000000587", accounts: "accounts", counsellor: "counsellor", admin: "admin", public: null };

async function realPath(key: string, path: string) {
  if (key === "pay") return payPath();
  if (key === "gateway") return (await payPath()).replace("/pay/", "/mock-gateway/");
  if (key === "result") return `${await payPath()}/result`; // ponytail: no paid event, so this captures the real "being processed" state.
  if (key === "receipt") return `/receipts/${await latestReceiptId()}`;
  return path;
}

async function main() {
  const only = process.argv.find((argument) => argument.startsWith("--only="))?.slice(7);
  const selected = routes.filter((route) => !only || route.key === only || route.path === only || route.path === `/${only}`);
  assert(selected.length, `No screen matches --only=${only}`);
  try { await fetch(origin); } catch { throw new Error(`Start the app before taking screenshots: npm run start -- --port 3001 (expected ${origin})`); }
  mkdirSync("docs/screens", { recursive: true });
  const browser = await chromium.launch();
  let count = 0;
  try {
    for (const width of [360, 1280]) {
      for (const language of ["hi", "en"]) {
        const context = await browser.newContext({ viewport: { width, height: width === 360 ? 640 : 800 }, reducedMotion: "reduce" });
        try {
          const page = await context.newPage();
          for (const route of selected) {
            await context.clearCookies();
            await context.addCookies([{ name: "lang", value: language, url: origin }]);
            const role = who[route.role];
            if (role && route.key !== "login" && route.key !== "staff-login") await signIn(context, role);
            const url = new URL(await realPath(route.key, route.path), origin);
            await page.goto(url.toString());
            await page.waitForLoadState("networkidle");
            await page.evaluate(() => document.fonts.ready);
            await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Horizontal overflow: ${url} at ${width}px`);
            await page.screenshot({ path: `docs/screens/${route.key}-${language}-normal-${width}.png`, fullPage: true });
            count++;
          }
        } finally { await context.close(); }
      }
    }
  } finally { await browser.close(); }
  console.log(`Saved ${count} screenshots for ${selected.length} screen(s) to docs/screens/.`);
}

main().catch((error: Error) => { console.error(error.message); process.exitCode = 1; });
