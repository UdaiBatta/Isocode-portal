import { expect, test } from "@playwright/test";
import { inr } from "../lib/format";
import { t } from "../lib/i18n";

for (const reducedMotion of ["reduce", "no-preference"] as const) test(`staff totals finish exactly after payment with ${reducedMotion}`, async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion });
  try {
    await context.addCookies([{ name: "proto", value: encodeURIComponent(JSON.stringify({ role: "accounts" })), url: "http://127.0.0.1:3001" }]);
    const page = await context.newPage();
    await page.goto("/staff/dashboard"); await page.waitForLoadState("networkidle");
    const before = await page.evaluate(() => Number(sessionStorage.getItem("dues:all:all:outstanding")));
    expect(before).toBeGreaterThan(1500000);
    await page.goto("/mock-gateway/STU-0587-3");
    await page.getByRole("button", { name: t("hi", "pay.button", { amount: "₹15,000" }), exact: true }).click();
    await expect(page).toHaveURL(/\/result\?e=/);
    await page.goto("/staff/dashboard"); await page.waitForLoadState("networkidle");
    await page.waitForTimeout(650);
    await expect(page.locator('[data-counter$=":outstanding"]')).toHaveText(inr(before - 1500000));
    await page.goto("/demo"); await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Clear dues. Timely follow-up.", exact: true })).toBeVisible();
    if (reducedMotion === "reduce") expect(await page.locator(".blur-word").evaluateAll((words) => words.every((word) => getComputedStyle(word).opacity === "1" && ["none", "blur(0px)"].includes(getComputedStyle(word).filter)))).toBe(true);
  } finally { await context.close(); }
});
