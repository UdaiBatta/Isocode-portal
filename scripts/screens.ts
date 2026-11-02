import assert from "node:assert/strict";
import { readdirSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

function routes(directory = "app", segments: string[] = []): string[] {
  const found = existsSync(join(directory, "page.tsx")) ? ["/" + segments.join("/")] : [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    // shortcut: dynamic route examples are added with their screens, before the T0.14 full sweep.
    if (entry.isDirectory() && !entry.name.startsWith("[") && !entry.name.startsWith("_")) {
      found.push(...routes(join(directory, entry.name), entry.name.startsWith("(") ? segments : [...segments, entry.name]));
    }
  }
  return found;
}

async function main() {
  const only = process.argv.find((argument) => argument.startsWith("--only="))?.slice(7);
  const selected = routes().filter((route) => !only || (route === "/" ? "home" : route.slice(1)) === only);
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
            if (route === "/consent") await context.addCookies([{ name: "proto", value: encodeURIComponent(JSON.stringify({ role: "parent", phone: "+919000000587", otp: { attempts: 0, sends: 1, verified: true } })), url: origin }]);
            for (const state of ["normal", "loading", "empty", "error"]) {
              const url = new URL(route, origin);
              if (state !== "normal") url.searchParams.set("state", state);
              await page.goto(url.toString());
              await page.evaluate(() => document.fonts.ready);
              assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Horizontal overflow: ${url} at ${width}px`);
              const name = route === "/" ? "home" : route.slice(1).replaceAll("/", "-");
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
