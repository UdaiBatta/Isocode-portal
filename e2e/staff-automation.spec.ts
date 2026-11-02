import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { t } from "../lib/i18n";

test("automation shows stop-on-payment and resolves a matched payment", async ({ page, context }) => {
  await context.addCookies([{ name: "proto", value: encodeURIComponent(JSON.stringify({ role: "accounts" })), url: "http://127.0.0.1:3001" }]);
  await page.goto("/mock-gateway/STU-0587-3");
  await page.getByRole("button", { name: t("hi", "pay.button", { amount: "₹15,000" }), exact: true }).click();
  await expect(page).toHaveURL(/\/result\?e=/);
  await page.goto("/staff/automation");
  await page.getByRole("radio", { name: "Stopped", exact: true }).click();
  await expect(page.getByText("Stopped: Paid 2026-11-02", { exact: true }).filter({ visible: true })).toBeVisible();
  await page.getByRole("tab", { name: /Unmatched payments/ }).click();
  const panel = page.getByRole("tabpanel", { name: /Unmatched payments/ });
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: /Kavya/ }).click();
  const drawer = page.getByRole("dialog", { name: "Match payment", exact: true });
  await drawer.getByRole("button", { name: "Reject payment", exact: true }).click();
  await expect(drawer.getByRole("alert")).toHaveText("Enter a reason before rejecting this payment.");
  await drawer.getByRole("button", { name: "Match payment", exact: true }).click();
  await expect(drawer).not.toBeVisible();
  await expect(page.getByText("Payment matched. Receipt created.", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => ({ id: item.id, targets: item.nodes.map((node) => node.target) }))).toEqual([]);
});
