import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

test.use({ trace: "off" });

async function staffSignIn(page: Page, email: string) {
  const password = process.env.SEED_DEMO_PASSWORD;
  if (!password) throw new Error("SEED_DEMO_PASSWORD is required for staff acceptance.");
  await page.goto("/staff/login");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(password).catch(() => {
    throw new Error("Could not enter the staff credential.");
  });
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("staff dashboard groups, searches, exports and provides phone navigation", async ({ page }, info) => {
  await staffSignIn(page, "accounts@demo.test");
  await expect(page).toHaveURL(/\/staff\/dashboard$/);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Dues dashboard" })).toBeVisible();
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

test("counsellor signs in to the call workspace and keeps the session on refresh", async ({ page }) => {
  await staffSignIn(page, "counsellor@demo.test");
  await expect(page).toHaveURL(/\/counsellor\/tasks$/);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Counsellor calls", exact: true })).toBeVisible();
});
