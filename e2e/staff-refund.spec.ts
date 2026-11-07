import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { sharedReset, signIn } from "./session";

test("refund amount is read-only and approval withdraws the student", async ({ page, context }) => {
  await signIn(context, "accounts");
  await page.goto("/staff/students/STU-0587/refund");
  try {
  await expect(page.getByText("₹3,986.31", { exact: true })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => ({ id: item.id, targets: item.nodes.map((node) => node.target) }))).toEqual([]);
  await expect(page.getByRole("spinbutton")).toHaveCount(0);
  await expect(page.locator('input[name*="amount"]')).toHaveCount(0);
  await page.getByRole("button", { name: /Reason/ }).click();
  await page.getByRole("option", { name: "Personal", exact: true }).click();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page.getByRole("button", { name: "Approve refund", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Approve refund", exact: true }).click();
  await expect(page.getByRole("button", { name: "Mark as paid (mock)", exact: true })).toBeVisible();
  await expect(page.getByText("The approved calculation is frozen.")).toBeVisible();
  await page.goto("/staff/students/STU-0587");
  await expect(page.getByText(/STU-0587.*Withdrawn/)).toBeVisible();
  } finally { await sharedReset(); }
});
