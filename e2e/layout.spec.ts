import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { prototypeRoutes } from "../lib/prototype-routes";
import { t } from "../lib/i18n";
import { isStreamingRace, latestReceiptId, payPath, signIn, type Who } from "./session";

// Every screen, in every preview state, signed in as the real demo user for its role.
// The payment result needs a real payment event, so parent-payment.spec.ts covers it instead.
const who: Record<string, Who | null> = { parent: "parent:+919000000587", accounts: "accounts", counsellor: "counsellor", admin: "admin", public: null };
async function realPath(key: string, path: string) {
  if (key === "pay") return payPath();
  if (key === "gateway") return (await payPath()).replace("/pay/", "/mock-gateway/");
  if (key === "receipt") return `/receipts/${await latestReceiptId()}`;
  return path;
}

for (const route of prototypeRoutes.filter((item) => item.key !== "result" && item.key !== "proto")) for (const language of route.role === "parent" || ["pay", "gateway", "policy"].includes(route.key) ? ["hi", "en"] as const : ["en"] as const) {
  test(`${route.title} fits and is accessible in ${language}, including all preview states`, async ({ page, context }) => {
    test.setTimeout(120000); // Four states, each a real page load plus an accessibility scan.
    let intentionalError = false;
    const errors: string[] = [];
    page.on("pageerror", (error) => { if (!intentionalError && !isStreamingRace(error)) errors.push(error.message); });
    page.on("console", (entry) => { if (!intentionalError && entry.type() === "error") errors.push(entry.text()); });
    await context.addCookies([{ name: "lang", value: language, url: "http://127.0.0.1:3001" }]);
    const role = who[route.role];
    if (role && route.key !== "login" && route.key !== "staff-login") await signIn(context, role);
    const path = await realPath(route.key, route.path);
    for (const state of ["normal", "loading", "empty", "error"] as const) await test.step(state, async () => {
      intentionalError = state === "error";
      const url = new URL(path, "http://127.0.0.1:3001");
      if (state !== "normal") url.searchParams.set("state", state);
      await page.goto(url.toString()); await page.waitForLoadState("networkidle"); await page.evaluate(() => document.fonts.ready);
      if (state === "loading") await expect(page.locator('[aria-busy="true"]').first()).toBeVisible();
      else if (state === "empty") await expect(page.locator("main").getByRole("status").first()).toBeVisible();
      else if (state === "error") await expect(page.locator("main").getByRole("alert")).toBeVisible();
      else await expect(page.locator("main h1").first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${path} ${state}`).toBe(true);
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
