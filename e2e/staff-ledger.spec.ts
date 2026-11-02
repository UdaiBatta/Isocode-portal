import { expect, test } from "@playwright/test";

test("counter payment changes the ledger and creates a receipt", async ({ page, context }) => {
  await context.addCookies([{ name: "proto", value: encodeURIComponent(JSON.stringify({ role: "accounts" })), url: "http://127.0.0.1:3001" }]);
  await page.goto("/staff/students/STU-0587");
  await expect(page.getByRole("heading", { name: "Ishita Sharma", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Record payment", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "Record counter payment" });
  await modal.getByRole("textbox", { name: "Amount in ₹", exact: true }).fill("15000");
  await modal.getByRole("button", { name: "Save payment", exact: true }).click();
  await expect(modal).not.toBeVisible();
  await expect(page.getByText(/Receipt MLV\/2026-27\/.* created/)).toBeVisible();
  await expect(page.getByText("Stopped: Paid 2026-11-02", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
