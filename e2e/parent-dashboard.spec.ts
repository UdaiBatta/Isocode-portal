import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

async function signIn(context: BrowserContext, phone: string, language: "en" | "hi" = "en") {
  await context.addCookies([
    { name: "lang", value: language, url: "http://127.0.0.1:3001" },
    { name: "proto", value: encodeURIComponent(JSON.stringify({ role: "parent", phone, consent: true })), url: "http://127.0.0.1:3001" },
  ]);
}

// On phones the less-used pages sit behind More; on desktop every page is in the left sidebar.
async function openFromNav(page: Page, href: string) {
  const link = page.locator(`nav a[href="${href}"]:visible`);
  if (!await link.count()) await page.locator("nav.fixed summary").click();
  await link.click();
}

for (const language of ["en", "hi"] as const) test(`every page opens from the navigation without sideways scroll in ${language}`, async ({ page, context }) => {
  await signIn(context, "+919000000587", language);
  await page.goto("/dashboard");
  for (const path of ["/dues", "/receipts", "/progress", "/course", "/student", "/settings", "/dashboard"]) {
    await openFromNav(page, path);
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.locator(`a[href="${path}"][aria-current="page"]`).first()).toBeAttached();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations.filter((item) => item.impact === "serious" || item.impact === "critical")).toEqual([]);
  }
});

for (const [language, amountDate, pay] of [["en", "Was due 10 Oct", "Pay ₹15,000"], ["hi", "अंतिम तिथि 10 अक्टूबर थी", "₹15,000 का भुगतान करें"]] as const) for (const path of ["/dashboard", "/dues"]) test(`${path} shows amount, date and Pay in the first view in ${language}`, async ({ page, context }) => {
  await signIn(context, "+919000000587", language);
  await page.goto(path);
  const viewport = page.viewportSize()!;
  const bar = await page.locator("nav.fixed").boundingBox();
  const fold = bar ? bar.y : viewport.height;
  await expect(page.getByText("₹15,000", { exact: true })).toHaveCSS("font-size", "40px");
  for (const locator of [page.getByText("₹15,000", { exact: true }), page.getByText(amountDate, { exact: true }), page.getByRole("link", { name: pay, exact: true })]) {
    const box = await locator.boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(fold);
  }
  await expect(page.getByRole("link", { name: pay, exact: true })).toHaveCount(1);
});

test("home summarises the family's facts and each row opens its detail page", async ({ page, context }) => {
  await signIn(context, "+919000000587");
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1, name: "Ishita Sharma" })).toBeVisible();
  await expect(page.getByText("JEE 2027 Evening · Malviya Nagar").first()).toBeVisible();
  await expect(page.getByText("₹75,000 of ₹1,20,000 paid · ₹45,000 remaining", { exact: true })).toBeVisible();
  await expect(page.getByText("19 of 20 classes in the last 4 weeks", { exact: true })).toBeVisible();
  await expect(page.getByText("₹15,000 · 10 Oct", { exact: true })).toBeVisible();
  await expect(page.getByText("86/100", { exact: false })).toBeVisible();
  await expect(page.locator("main")).not.toContainText(/risk|flag|counsellor|average|rank|topper/i);
  await page.locator('main a[href="/receipts"]').click();
  await expect(page).toHaveURL(/\/receipts$/);
  await expect(page.getByText("Paid", { exact: true }).locator("visible=true").first()).toBeVisible();
});

test("home never asks a family to pay while a payment is being checked, and child switching stays scoped", async ({ page, context }) => {
  await signIn(context, "+919000000777");
  await page.goto("/dashboard");
  await expect(page.getByText("We received a payment and are checking it.")).toBeVisible();
  await expect(page.getByRole("link", { name: /^Pay/ })).toHaveCount(0);
  await page.getByRole("link", { name: "Dev Joshi", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\?student=STU-0772$/);
  await expect(page.getByRole("heading", { level: 1, name: "Dev Joshi" })).toBeVisible();
  await expect(page.locator('main a[href="/course?student=STU-0772"]')).toBeVisible();
  await page.goto("/dashboard?student=STU-0587");
  await expect(page.locator("main").getByRole("alert")).toBeVisible();
  await expect(page.getByText("Ishita Sharma", { exact: true })).toHaveCount(0);
});

test("home shows no Pay for clear and withdrawn students, and no risk data for a flagged student", async ({ page, context }) => {
  await signIn(context, "+919000000412");
  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: /^Pay/ })).toHaveCount(0);
  await signIn(context, "+919000000802");
  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: /^Pay/ })).toHaveCount(0);
  await expect(page.getByText("₹45,000 remaining", { exact: false })).toHaveCount(0);
  await signIn(context, "+919000000733");
  await page.goto("/dashboard");
  await expect(page.locator("main")).not.toContainText(/risk|flag|counsellor|high/i);
});

test("fee details add up", async ({ page, context }) => {
  await signIn(context, "+919000000587");
  await page.goto("/dues");
  await expect(page.getByText("₹1,20,000", { exact: true })).toBeVisible();
  await expect(page.getByText("₹75,000", { exact: true })).toBeVisible();
  await expect(page.getByText("₹45,000", { exact: true })).toBeVisible();
});

test("student and course pages show this student's details", async ({ page, context }) => {
  await signIn(context, "+919000000587");
  await page.goto("/student");
  await expect(page.getByText("STU-0587", { exact: true })).toBeVisible();
  await expect(page.getByText("+91 90000 00587", { exact: true })).toBeVisible();
  await page.goto("/course");
  await expect(page.getByText("Engineering entrance (JEE)", { exact: true })).toBeVisible();
  await expect(page.getByText("JEE 2027 Evening", { exact: true })).toBeVisible();
  await expect(page.getByText("Malviya Nagar", { exact: true })).toBeVisible();
});

test("a parent with two children stays on the same page when switching, and cannot open another family", async ({ page, context }) => {
  await signIn(context, "+919000000777");
  await page.goto("/course");
  await expect(page.getByText("JEE 2027 Morning", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Dev Joshi", exact: true }).click();
  await expect(page).toHaveURL(/\/course\?student=STU-0772$/);
  await expect(page.getByText("NEET 2027 Morning", { exact: true })).toBeVisible();
  await openFromNav(page, "/student?student=STU-0772");
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
  if (await page.locator("nav.fixed summary").isVisible()) await page.locator("nav.fixed summary").click();
  await page.locator("button:visible", { hasText: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("switching child on receipts stays on receipts", async ({ page, context }) => {
  await signIn(context, "+919000000777");
  await page.goto("/receipts");
  await page.getByRole("link", { name: "Dev Joshi", exact: true }).click();
  await expect(page).toHaveURL(/\/receipts\?student=STU-0772$/);
});

test("receipts list payments being checked without offering a receipt for them", async ({ page, context }) => {
  await signIn(context, "+919000000777");
  await page.goto("/receipts");
  await expect(page.getByText("Being checked", { exact: true }).locator("visible=true").first()).toBeVisible();
  await expect(page.getByText("Payment being checked by accounts", { exact: true }).locator("visible=true").first()).toBeVisible();
});

test("a receipt keeps the portal navigation on screen but prints clean", async ({ page, context }) => {
  await signIn(context, "+919000000587");
  await page.goto("/receipts/STU-0587-receipt-1");
  await expect(page.locator('a[href="/dashboard"]:visible')).toHaveCount(1);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator('a[href="/dashboard"]:visible')).toHaveCount(0);
  await expect(page.getByText("Fee receipt", { exact: true })).toBeVisible();
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

for (const path of ["/dashboard", "/course", "/student", "/settings"]) test(`signed-out visitors to ${path} are sent to sign-in`, async ({ page }) => {
  await page.goto(path);
  await expect(page).toHaveURL(/\/login$/);
});
