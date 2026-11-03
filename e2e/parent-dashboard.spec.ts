import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext } from "@playwright/test";

async function signIn(context: BrowserContext, phone: string, language: "en" | "hi" = "en") {
  await context.addCookies([
    { name: "lang", value: language, url: "http://127.0.0.1:3001" },
    { name: "proto", value: encodeURIComponent(JSON.stringify({ role: "parent", phone, consent: true })), url: "http://127.0.0.1:3001" },
  ]);
}

for (const language of ["en", "hi"] as const) test(`every tab opens from the navigation without sideways scroll in ${language}`, async ({ page, context }) => {
  await signIn(context, "+919000000587", language);
  await page.goto("/dues");
  for (const path of ["/progress", "/course", "/student", "/settings", "/dues"]) {
    await page.locator(`nav a[href="${path}"]:visible`).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.locator(`nav a[href="${path}"][aria-current="page"]:visible`)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations.filter((item) => item.impact === "serious" || item.impact === "critical")).toEqual([]);
  }
});

test("Pay stays clear of the mobile tab bar, and fee details add up", async ({ page, context }) => {
  await signIn(context, "+919000000587");
  await page.goto("/dues");
  const pay = await page.getByRole("link", { name: "Pay ₹15,000", exact: true }).boundingBox();
  const bar = await page.locator("nav.fixed").boundingBox();
  if (bar) expect(pay!.y + pay!.height).toBeLessThanOrEqual(bar.y);
  await expect(page.getByText("₹1,20,000", { exact: true })).toBeVisible();
  await expect(page.getByText("₹75,000", { exact: true })).toBeVisible();
  await expect(page.getByText("₹45,000", { exact: true })).toBeVisible();
});

test("student and course tabs show this student's details", async ({ page, context }) => {
  await signIn(context, "+919000000587");
  await page.goto("/student");
  await expect(page.getByText("STU-0587", { exact: true })).toBeVisible();
  await expect(page.getByText("+91 90000 00587", { exact: true })).toBeVisible();
  await page.goto("/course");
  await expect(page.getByText("Engineering entrance (JEE)", { exact: true })).toBeVisible();
  await expect(page.getByText("JEE 2027 Evening", { exact: true })).toBeVisible();
  await expect(page.getByText("Malviya Nagar", { exact: true })).toBeVisible();
});

test("a parent with two children stays on the same tab when switching, and cannot open another family", async ({ page, context }) => {
  await signIn(context, "+919000000777");
  await page.goto("/course");
  await expect(page.getByText("JEE 2027 Morning", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Dev Joshi", exact: true }).click();
  await expect(page).toHaveURL(/\/course\?student=STU-0772$/);
  await expect(page.getByText("NEET 2027 Morning", { exact: true })).toBeVisible();
  await page.locator('nav a[href="/student?student=STU-0772"]:visible').click();
  await expect(page.getByText("STU-0772", { exact: true })).toBeVisible();
  await page.goto("/student?student=STU-0587");
  await expect(page.locator("main").getByRole("alert")).toBeVisible();
  await expect(page.getByText("Ishita Sharma", { exact: true })).toHaveCount(0);
});

test("settings changes the language and logs out", async ({ page, context }) => {
  await signIn(context, "+919000000587");
  await page.goto("/settings");
  await expect(page.getByText("+91 90000 00587", { exact: true })).toBeVisible();
  await expect(page.getByText("Showing attendance and test scores", { exact: true })).toBeVisible();
  await page.getByRole("radio", { name: "हिंदी", exact: true }).click();
  await expect(page.getByRole("heading", { name: "सेटिंग्स", exact: true })).toBeVisible();
  await page.getByRole("radio", { name: "English", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("switching child on receipts stays on receipts", async ({ page, context }) => {
  await signIn(context, "+919000000777");
  await page.goto("/receipts");
  await page.getByRole("link", { name: "Dev Joshi", exact: true }).click();
  await expect(page).toHaveURL(/\/receipts\?student=STU-0772$/);
});

test("student info shows the reminder language chosen in settings", async ({ page, context }) => {
  await signIn(context, "+919000000587");
  await page.goto("/student");
  await expect(page.getByRole("definition").filter({ hasText: "English" })).toBeVisible();
  await page.goto("/settings");
  await page.getByRole("radio", { name: "हिंदी", exact: true }).click();
  await expect(page.getByRole("heading", { name: "सेटिंग्स", exact: true })).toBeVisible();
  await page.goto("/student");
  await expect(page.getByRole("definition").filter({ hasText: "हिंदी" })).toBeVisible();
});

for (const path of ["/course", "/student", "/settings"]) test(`signed-out visitors to ${path} are sent to sign-in`, async ({ page }) => {
  await page.goto(path);
  await expect(page).toHaveURL(/\/login$/);
});
