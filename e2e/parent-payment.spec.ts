import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { t } from "../lib/i18n";
import type { Language } from "../lib/types";

for (const language of ["hi", "en"] as Language[]) test(`fixture parent pays and prints a GST receipt in ${language}`, async ({ page, context }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await context.addCookies([
    { name: "lang", value: language, url: "http://127.0.0.1:3001" },
    { name: "proto", value: encodeURIComponent(JSON.stringify({ role: "parent", phone: "+919000000587", consent: true })), url: "http://127.0.0.1:3001" },
  ]);
  await page.goto("/dashboard");
  await page.getByRole("link", { name: t(language, "dues.pay", { amount: "₹15,000" }), exact: true }).click();
  await expect(page.getByRole("note")).toHaveText(t(language, "pay.testMode"));
  await page.getByRole("button", { name: t(language, "pay.button", { amount: "₹15,000" }), exact: true }).click();
  await expect(page).toHaveURL(/\/pay\/STU-0587-3\/result\?e=demo-event-/);
  await expect(page.getByRole("heading", { name: t(language, "pay.success"), exact: true })).toBeVisible();
  await expect(page.getByText("₹15,000", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: t(language, "pay.viewReceipt"), exact: true }).click();
  await expect(page).toHaveURL(/\/receipts\/demo-receipt-1$/);
  const table = page.locator(".bui-table");
  await expect(table.getByText("₹12,711.86", { exact: true })).toBeVisible();
  await expect(table.getByText("₹1,144.07", { exact: true })).toHaveCount(2);
  await expect(table.getByText("₹15,000", { exact: true })).toBeVisible();
  await expect(page.getByText("08AAAAA0000A1Z5", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations.filter((item) => item.impact === "serious" || item.impact === "critical")).toEqual([]);
  await page.evaluate(() => { window.print = () => { document.body.dataset.printed = "yes"; }; });
  await page.getByRole("button", { name: t(language, "receipt.print"), exact: true }).click();
  await expect(page.locator("body")).toHaveAttribute("data-printed", "yes");
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("button", { name: t(language, "receipt.print"), exact: true })).toBeHidden();
  await page.emulateMedia({ media: "screen" });
  await page.getByRole("link", { name: t(language, "pay.backToDues"), exact: true }).click();
  await expect(page.getByText(t(language, "dues.clear"), { exact: true })).toBeVisible();
  await page.locator("main").getByRole("link", { name: t(language, "dues.receipts"), exact: true }).click();
  await expect(page.getByRole("link", { name: /100001/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test("failed and wrong-amount attempts do not create a paid result or receipt", async ({ page, context }) => {
  await context.addCookies([{ name: "lang", value: "en", url: "http://127.0.0.1:3001" }]);
  await page.goto("/mock-gateway/STU-0587-3");
  await page.getByRole("button", { name: "Payment fails", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Payment failed. Please try again.", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Try again", exact: true }).click();
  await page.getByRole("button", { name: "Wrong amount", exact: true }).click();
  await expect(page.getByRole("heading", { name: "We received a payment and are checking it.", exact: true })).toBeVisible();
  await expect(page.getByText("₹14,000", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "View receipt", exact: true })).toHaveCount(0);
  await page.goto("/dues");
  await expect(page.getByRole("heading", { name: "We received a payment and are checking it.", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Pay/ })).toHaveCount(0);
});

test("public payment survives stale sid, result URLs cannot fake success, receipts require sign-in", async ({ page, context }) => {
  await context.addCookies([
    { name: "lang", value: "en", url: "http://127.0.0.1:3001" },
    { name: "sid", value: "expired-session", url: "http://127.0.0.1:3001" },
  ]);
  await page.goto("/pay/STU-0587-3");
  await expect(page.getByRole("heading", { name: "Fee payment for Ishita", exact: true })).toBeVisible();
  await expect(page.getByText("Ishita Sharma", { exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Pay ₹15,000", exact: true }).click();
  await page.getByRole("button", { name: "Pay ₹15,000", exact: true }).click();
  await expect(page.getByRole("link", { name: "View receipt", exact: true })).toHaveAttribute("href", /\/login\?next=/);
  await page.getByRole("link", { name: "View receipt", exact: true }).click();
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.goto("/receipts/demo-receipt-1");
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  await page.goto("/pay/STU-0587-3/result?e=paid");
  await expect(page.getByText("Your payment is being processed. Please check again shortly.", { exact: true })).toBeVisible();
  await page.goto("/pay/not-a-token");
  await expect(page.getByText("This link is not valid.", { exact: true })).toBeVisible();
  await page.goto("/pay/STU-0412-3");
  await expect(page.getByText("This instalment is already paid.", { exact: true })).toBeVisible();
});
