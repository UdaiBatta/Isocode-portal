import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { prototypeRoutes } from "../lib/prototype-routes";
import { t } from "../lib/i18n";

for (const route of prototypeRoutes) for (const language of route.role === "parent" || ["pay", "gateway", "result", "policy"].includes(route.key) ? ["hi", "en"] as const : ["en"] as const) {
  test(`${route.title} fits and is accessible in ${language}, including all preview states`, async ({ page, context }) => {
    test.setTimeout(60000);
    let intentionalError = false;
    const errors: string[] = [];
    page.on("pageerror", (error) => { if (!intentionalError) errors.push(error.message); });
    page.on("console", (entry) => { if (!intentionalError && entry.type() === "error") errors.push(entry.text()); });
    await context.addCookies([{ name: "lang", value: language, url: "http://127.0.0.1:3001" }]);
    for (const state of ["normal", "loading", "empty", "error"] as const) await test.step(state, async () => {
      intentionalError = state === "error";
      const auth = { role: route.role === "public" ? undefined : route.role, phone: "+919000000587", consent: route.key !== "consent", otp: { attempts: 0, sends: 1, verified: true }, ...(route.key === "result" ? { payments: [{ studentCode: "STU-0587", amount: 1500000, on: "2026-11-02", method: "gateway", instalmentId: "STU-0587-3" }], paymentResults: { "demo-event-1": { token: "STU-0587-3", result: "paid", amount: 1500000, receiptId: "demo-receipt-1" } } } : {}) };
      await context.addCookies([{ name: "proto", value: encodeURIComponent(JSON.stringify(auth)), url: "http://127.0.0.1:3001" }]);
      const url = new URL(route.path, "http://127.0.0.1:3001");
      if (route.key === "result") url.searchParams.set("e", "demo-event-1");
      if (state !== "normal") url.searchParams.set("state", state);
      await page.goto(url.toString()); await page.waitForLoadState("networkidle"); await page.evaluate(() => document.fonts.ready);
      if (state === "loading") await expect(page.locator('[aria-busy="true"]').first()).toBeVisible();
      else if (state === "empty") await expect(page.locator("main").getByRole("status").first()).toBeVisible();
      else if (state === "error") await expect(page.locator("main").getByRole("alert")).toBeVisible();
      else await expect(page.locator("main h1").first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${route.path} ${state}`).toBe(true);
      const violations = (await new AxeBuilder({ page }).analyze()).violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => ({ id: item.id, targets: item.nodes.map((node) => node.target) }));
      expect(violations).toEqual([]);
      if (route.key === "dues" && state === "normal") {
        const box = await page.getByRole("link", { name: t(language, "dues.pay", { amount: "₹15,000" }), exact: true }).boundingBox();
        expect(box).not.toBeNull(); expect(box!.y + box!.height).toBeLessThanOrEqual(640);
      }
    });
    expect(errors).toEqual([]);
  });
}
