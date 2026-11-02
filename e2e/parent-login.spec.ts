import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("parent sign-in, wrong code, consent choices and language controls work", async ({ page, context }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/login");
  await page.getByRole("radio", { name: "English", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sign in with your mobile number" })).toBeVisible();
  await page.getByRole("textbox", { name: "Mobile number" }).fill("123");
  await page.getByRole("button", { name: "Send code", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Enter a 10-digit mobile number");
  await page.getByRole("textbox", { name: "Mobile number" }).fill("9000000587");
  await page.getByRole("button", { name: "Send code", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Enter the 6-digit code" })).toBeVisible();
  await expect(page.getByRole("button", { name: /New code in/ })).toBeDisabled();
  await page.getByRole("textbox", { name: "Digit 1 of 6", exact: true }).fill("000000");
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("That code is wrong. Try again.");
  await page.getByRole("textbox", { name: "Digit 1 of 6", exact: true }).fill("123456");
  await expect(page).toHaveURL(/\/consent/);
  await expect(page.getByRole("button", { name: "Agree and continue" })).toBeDisabled();
  await page.getByRole("button", { name: "Not now", exact: true }).click();
  await expect(page.getByText(/We can't show details without your permission/)).toBeVisible();
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole("link", { name: "Staff sign-in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Staff sign-in" })).toBeVisible();
  expect(errors).toEqual([]);
  await context.clearCookies();
});

for (const language of ["hi", "en"]) test(`sign-in fits and is accessible in ${language}`, async ({ page, context }) => {
  await context.addCookies([{ name: "lang", value: language, url: "http://127.0.0.1:3001" }]);
  await page.goto("/login");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations.filter((item) => item.impact === "serious" || item.impact === "critical")).toEqual([]);
});
