import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext } from "@playwright/test";

async function signIn(context: BrowserContext, phone: string, language = "en") {
  await context.addCookies([
    { name: "lang", value: language, url: "http://127.0.0.1:3001" },
    { name: "proto", value: encodeURIComponent(JSON.stringify({ role: "parent", phone, consent: true })), url: "http://127.0.0.1:3001" },
  ]);
}

for (const [language, link, summary, week, classes] of [
  ["en", "Attendance and scores", "Attended 19 of 20 classes in the last 4 weeks", "Week of 26 Oct", "5 of 5"],
  ["hi", "उपस्थिति और अंक", "पिछले 4 हफ़्तों में 20 में से 19 कक्षाओं में उपस्थित", "26 अक्टूबर का हफ़्ता", "5 में से 5"],
] as const) test(`dues links to attendance and scores in ${language}`, async ({ page, context }) => {
  await signIn(context, "+919000000587", language);
  await page.goto("/dues");
  await page.getByRole("link", { name: link, exact: true }).click();
  await expect(page).toHaveURL(/\/progress\?student=STU-0587$/);
  await expect(page.getByText("Ishita Sharma", { exact: true })).toBeVisible();
  await expect(page.getByText(summary, { exact: true })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: week }).getByText(classes, { exact: true })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Monthly Test 7" }).getByText("86/100", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations.filter((item) => item.impact === "serious" || item.impact === "critical")).toEqual([]);
});

test("a family only sees its own child, and no risk or comparison wording appears", async ({ page, context }) => {
  await signIn(context, "+919000000733");
  await page.goto("/progress");
  await expect(page.getByText("Riya Verma", { exact: true })).toBeVisible();
  await expect(page.locator("main")).not.toContainText(/risk|flag|counsellor|average|rank|topper/i);
  await page.goto("/progress?student=STU-0587");
  await expect(page.locator("main").getByRole("alert")).toBeVisible();
  await expect(page.getByText("Ishita Sharma", { exact: true })).toHaveCount(0);
});

test("a new student shows what little there is", async ({ page, context }) => {
  await signIn(context, "+919000000735");
  await page.goto("/progress");
  await expect(page.getByText("Attended 9 of 10 classes in the last 2 weeks", { exact: true })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Week of" })).toHaveCount(2);
  await expect(page.getByText("64/100", { exact: true })).toBeVisible();
});

test("signed-out visitors are sent to sign-in", async ({ page }) => {
  await page.goto("/progress");
  await expect(page).toHaveURL(/\/login$/);
});
