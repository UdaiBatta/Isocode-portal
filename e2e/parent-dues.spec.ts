import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const language of ["hi", "en"]) test(`dues amount, date and pay are visible without scrolling in ${language}`, async ({ page, context }) => {
  await context.addCookies([{ name: "lang", value: language, url: "http://127.0.0.1:3001" }]);
  await page.goto("/dues");
  await expect(page.getByText("₹15,000", { exact: true })).toHaveCSS("font-size", "40px");
  const pay = page.getByRole("link", { name: language === "en" ? "Pay ₹15,000" : "₹15,000 का भुगतान करें", exact: true });
  await expect(pay).toHaveAttribute("href", "/mock-gateway/STU-0587-3");
  expect((await pay.boundingBox())!.y + (await pay.boundingBox())!.height).toBeLessThanOrEqual(640);
  await expect(page.locator("main section").first().getByText(language === "en" ? "23 days overdue" : "23 दिन की देरी", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations.filter((item) => item.impact === "serious" || item.impact === "critical")).toEqual([]);
  await page.getByRole("button", { name: language === "en" ? "See all instalments" : "सभी किस्तें देखें" }).click();
  await expect(page.getByText(language === "en" ? "Instalment 4" : "किस्त 4", { exact: true })).toBeVisible();
});

test("siblings switch between a held payment and an upcoming instalment", async ({ page, context }) => {
  await context.addCookies([
    { name: "lang", value: "en", url: "http://127.0.0.1:3001" },
    { name: "proto", value: encodeURIComponent(JSON.stringify({ role: "parent", phone: "+919000000777", consent: true })), url: "http://127.0.0.1:3001" },
  ]);
  await page.goto("/dues");
  await expect(page.getByText("We received a payment and are checking it.")).toBeVisible();
  await page.getByRole("link", { name: "Dev Joshi", exact: true }).click();
  await expect(page).toHaveURL(/student=STU-0772/);
  // Dev's seeded excess is held too; neither child should be prompted to pay twice.
  await expect(page.getByText("We received a payment and are checking it.")).toBeVisible();
  await expect(page.getByRole("link", { name: /^Pay/ })).toHaveCount(0);
});

test("clear, withdrawn, due-today and preview states render", async ({ page, context }) => {
  const origin = "http://127.0.0.1:3001";
  await context.addCookies([{ name: "lang", value: "en", url: origin }, { name: "proto", value: encodeURIComponent(JSON.stringify({ role: "parent", phone: "+919000000412", consent: true })), url: origin }]);
  await page.goto("/dues"); await expect(page.getByText("No dues", { exact: true })).toBeVisible();
  await context.addCookies([{ name: "proto", value: encodeURIComponent(JSON.stringify({ role: "parent", phone: "+919000000802", consent: true })), url: origin }]);
  await page.goto("/dues"); await expect(page.getByText("Refund", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Pay/ })).toHaveCount(0);
  await context.addCookies([{ name: "proto", value: encodeURIComponent(JSON.stringify({ date: "2026-10-10" })), url: origin }]);
  await page.goto("/dues"); await expect(page.getByText("Due today", { exact: true })).toBeVisible();
  await page.goto("/dues?state=empty"); await expect(page.getByText("No dues", { exact: true })).toBeVisible();
  await page.goto("/dues?state=loading"); await expect(page.getByRole("status", { name: "Loading" })).toBeVisible();
  await page.goto("/dues?state=error"); await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page).toHaveURL(/\/dues$/);
  await expect(page.getByText("Due today", { exact: true })).toBeVisible();
});
