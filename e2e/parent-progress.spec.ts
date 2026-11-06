import { expect, test, type BrowserContext } from "@playwright/test";
import { signIn as signInAs } from "./session";

async function signIn(context: BrowserContext, phone: string, language = "en") {
  await context.addCookies([{ name: "lang", value: language, url: "http://127.0.0.1:3001" }]);
  await signInAs(context, `parent:${phone}`);
}

for (const [language, summary, week, classes] of [
  ["en", "Attended 23 of 24 classes in the last 4 weeks", "Week of 26 Oct", "5 of 6"],
  ["hi", "पिछले 4 हफ़्तों में 24 में से 23 कक्षाओं में उपस्थित", "26 अक्टूबर का हफ़्ता", "6 में से 5"],
] as const) test(`the academic tab shows attendance and scores in ${language}`, async ({ page, context }) => {
  await signIn(context, "+919000000587", language);
  await page.goto("/progress");
  await expect(page.getByText("Ishita Sharma", { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText(summary, { exact: true })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: week }).getByText(classes, { exact: true })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Monthly Test 7" }).getByText("88/100", { exact: true })).toBeVisible();
});

test("a family only sees its own child, and no risk or comparison wording appears", async ({ page, context }) => {
  await signIn(context, "+919000000733");
  await page.goto("/progress");
  await expect(page.getByText("Riya Verma", { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await expect(page.locator("main")).not.toContainText(/risk|flag|counsellor|average|rank|topper/i);
  await page.goto("/progress?student=STU-0587");
  await expect(page.locator("main").getByRole("alert")).toBeVisible();
  await expect(page.getByText("Ishita Sharma", { exact: true })).toHaveCount(0);
});

test("a new student shows what little there is", async ({ page, context }) => {
  await signIn(context, "+919000000735");
  await page.goto("/progress");
  // One week and one test so far: no summary line yet, just the week and the score.
  await expect(page.getByText(/^Attended \d+ of \d+ classes/)).toHaveCount(0);
  await expect(page.getByRole("listitem").filter({ hasText: "Week of" })).toHaveCount(1);
  await expect(page.getByText("77/100", { exact: true })).toBeVisible();
});

test("the marks graph runs oldest to newest, opens on tap, and needs at least two tests", async ({ page, context }) => {
  await signIn(context, "+919000000587");
  await page.goto("/progress");
  const points = page.getByRole("group", { name: "Marks over recent tests" }).getByRole("img");
  await expect(points).toHaveCount(5);
  await expect(points.first()).toHaveAccessibleName("Monthly Test 3, 28 Jun, 87/100");
  await expect(points.last()).toHaveAccessibleName("Monthly Test 7, 28 Oct, 88/100");
  await points.last().focus();
  await expect(points.last().locator(".marks-tip")).toBeVisible();
  await context.clearCookies();
  await signIn(context, "+919000000735");
  await page.goto("/progress");
  await expect(page.getByRole("group", { name: "Marks over recent tests" })).toHaveCount(0);
});

test("signed-out visitors are sent to sign-in", async ({ page }) => {
  await page.goto("/progress");
  await expect(page).toHaveURL(/\/login$/);
});
