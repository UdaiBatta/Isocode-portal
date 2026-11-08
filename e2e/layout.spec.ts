import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { routes } from "./routes";
import { t } from "../lib/i18n";
import { isStreamingRace, latestReceiptId, payPath, signIn, type Who } from "./session";

// Every screen, signed in as the real demo user for its role.
const who: Record<string, Who | null> = { parent: "parent:+919000000587", accounts: "accounts", counsellor: "counsellor", admin: "admin", public: null };
async function realPath(key: string, path: string) {
  if (key === "pay") return payPath();
  if (key === "gateway") return (await payPath()).replace("/pay/", "/mock-gateway/");
  if (key === "receipt") return `/receipts/${await latestReceiptId()}`;
  return path;
}

for (const route of routes) for (const language of route.role === "parent" || ["pay", "gateway", "policy"].includes(route.key) ? ["hi", "en"] as const : ["en"] as const) {
  test(`${route.title} fits and is accessible in ${language}`, async ({ page, context }) => {
    test.setTimeout(120000);
    const errors: string[] = [];
    page.on("pageerror", (error) => { if (!isStreamingRace(error)) errors.push(error.message); });
    page.on("console", (entry) => { if (entry.type() === "error") errors.push(entry.text()); });
    await context.addCookies([{ name: "lang", value: language, url: "http://127.0.0.1:3001" }]);
    const role = who[route.role];
    if (role && route.key !== "login" && route.key !== "staff-login") await signIn(context, role);
    const path = await realPath(route.key, route.path);
    await page.goto(new URL(path, "http://127.0.0.1:3001").toString()); await page.waitForLoadState("networkidle"); await page.evaluate(() => document.fonts.ready);
    await expect(page.locator("main h1").first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), path).toBe(true);
    const violations = (await new AxeBuilder({ page }).analyze()).violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => ({ id: item.id, targets: item.nodes.map((node) => node.target) }));
    expect(violations).toEqual([]);
    if (route.key === "dues") {
      const box = await page.getByRole("link", { name: t(language, "dues.pay", { amount: "₹15,000" }), exact: true }).boundingBox();
      expect(box).not.toBeNull(); expect(box!.y + box!.height).toBeLessThanOrEqual(640);
    }
    expect(errors).toEqual([]);
  });
}
