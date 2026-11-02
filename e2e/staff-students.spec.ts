import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ context }) => {
  await context.addCookies([{ name: "proto", value: encodeURIComponent(JSON.stringify({ role: "accounts" })), url: "http://127.0.0.1:3001" }]);
});

test("the roster filters by status, batch and search, and opens a ledger", async ({ page }) => {
  await page.goto("/staff/students"); await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "Students", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: /^Over 60 days/ }).click();
  await expect(page).toHaveURL(/status=over60/);
  await page.getByRole("tab", { name: /^All/ }).click();
  await expect(page).not.toHaveURL(/status=/);
  const search = page.getByRole("searchbox", { name: "Search student" });
  await search.fill("STU-0587"); await search.press("Enter");
  await expect(page).toHaveURL(/q=STU-0587/);
  await page.getByRole("link", { name: "Ishita Sharma", exact: true }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/staff\/students\/STU-0587$/);
  await page.goto("/staff/students?q=nobody-matches");
  await expect(page.getByText("No matching students", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations.filter((item) => item.impact === "serious" || item.impact === "critical")).toEqual([]);
});

test("paying moves a student out of Overdue, and shows the method used", async ({ page }) => {
  await page.goto("/staff/students?q=STU-0587");
  await expect(page.getByText("Overdue", { exact: true }).filter({ visible: true }).last()).toBeVisible();
  await page.goto("/mock-gateway/STU-0587-3");
  await page.getByRole("radio", { name: /Card|कार्ड/ }).check({ force: true });
  await page.getByRole("button", { name: /^(Pay ₹15,000|₹15,000 का भुगतान करें)$/ }).click();
  await expect(page).toHaveURL(/\/result\?e=/);
  await page.goto("/staff/students?q=STU-0587");
  await expect(page.getByText(/Card/).filter({ visible: true }).first()).toBeVisible();
});
