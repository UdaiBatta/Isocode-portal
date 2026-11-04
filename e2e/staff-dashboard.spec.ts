import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("staff dashboard groups, searches, exports and provides phone navigation", async ({ page }, info) => {
  await page.goto("/staff/login");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("accounts@demo.test");
  await page.getByRole("textbox", { name: "Password", exact: true }).fill("prototype");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/staff\/dashboard$/);
  await page.getByRole("radio", { name: "By batch", exact: true }).click();
  await expect(page).toHaveURL(/group=batch/);
  await expect(page.getByRole("heading", { name: "Dues dashboard" })).toBeVisible();
  const search = page.getByRole("searchbox", { name: "Search student" });
  await search.fill("nobody-matches"); await search.press("Enter");
  await expect(page.getByText("No matching students", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export dues CSV", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("dues-2026-11-02.csv");
  expect((await new AxeBuilder({ page }).analyze()).violations.filter((item) => item.impact === "serious" || item.impact === "critical")).toEqual([]);
  if (info.project.name === "mobile") {
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Workspace navigation" })).toBeVisible();
    await page.getByRole("button", { name: "Close", exact: true }).click();
  }
});
