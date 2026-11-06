import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { setDemoDate, signIn } from "./session";

for (const language of ["hi", "en"]) test(`dues amount, date and pay are visible without scrolling in ${language}`, async ({ page, context }) => {
  await context.addCookies([{ name: "lang", value: language, url: "http://127.0.0.1:3001" }]);
  await signIn(context, "parent:+919000000587");
  await page.goto("/dues");
  await expect(page.getByText("₹15,000", { exact: true })).toHaveCSS("font-size", "56px");
  const pay = page.getByRole("link", { name: language === "en" ? "Pay ₹15,000" : "₹15,000 का भुगतान करें", exact: true });
  await expect(pay).toHaveAttribute("href", /^\/mock-gateway\/[^/]+$/);
  expect((await pay.boundingBox())!.y + (await pay.boundingBox())!.height).toBeLessThanOrEqual(640);
  await expect(page.locator("main section").first().getByText(language === "en" ? "23 days overdue" : "23 दिन की देरी", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations.filter((item) => item.impact === "serious" || item.impact === "critical")).toEqual([]);
  await page.getByText(language === "en" ? "See all instalments" : "सभी किस्तें देखें", { exact: true }).click();
  await expect(page.getByText(language === "en" ? "Instalment 4" : "किस्त 4", { exact: true })).toBeVisible();
});

test("siblings switch between a held payment and an upcoming instalment", async ({ page, context }) => {
  await context.addCookies([{ name: "lang", value: "en", url: "http://127.0.0.1:3001" }]);
  await signIn(context, "parent:+919000000777");
  await page.goto("/dues");
  await expect(page.getByText("We received a payment and are checking it.")).toBeVisible();
  await page.getByRole("link", { name: "Dev Joshi", exact: true }).click();
  await expect(page).toHaveURL(/student=STU-0772/);
  // Kavya's payment is being checked; Dev's next instalment is simply due.
  await expect(page.getByText("We received a payment and are checking it.")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Pay ₹40,000", exact: true })).toBeVisible();
});

test("clear, withdrawn, due-today and preview states render", async ({ page, context }) => {
  const origin = "http://127.0.0.1:3001";
  await context.addCookies([{ name: "lang", value: "en", url: origin }]);
  await signIn(context, "parent:+919000000412");
  await page.goto("/dues"); await expect(page.getByText("No dues", { exact: true })).toBeVisible();
  await signIn(context, "parent:+919000000802");
  await page.goto("/dues"); await expect(page.getByText("Refund", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Pay/ })).toHaveCount(0);
  // The demo date is shared now, so move it for this check and always put it back.
  await signIn(context, "parent:+919000000587"); // Ishita's third instalment falls due on 10 Oct.
  await setDemoDate("2026-10-10");
  try {
  await page.goto("/dues"); await expect(page.getByText("Due today", { exact: true })).toBeVisible();
  await page.goto("/dues?state=empty"); await expect(page.getByText("No dues", { exact: true })).toBeVisible();
  await page.goto("/dues?state=loading"); await expect(page.getByRole("status", { name: "Loading" })).toBeVisible();
  await page.goto("/dues?state=error"); await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page).toHaveURL(/\/dues$/);
  await expect(page.getByText("Due today", { exact: true })).toBeVisible();
  } finally { await setDemoDate("2026-11-02"); }
});
