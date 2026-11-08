import { expect, test, type Page } from "@playwright/test";
import { t } from "../lib/i18n";
import { isStreamingRace, sharedReset, signIn } from "./session";

// B13 golden journey at 360 px, parent side in Hindi: real OTP, consent, dues, pay, receipt. Then accounts sees the
// reminder stopped and the dashboard changed. The shared reset restores the named students before and after.
test.use({ trace: "off", reducedMotion: "reduce" });
const hi = "hi" as const;
const APP = "http://127.0.0.1:3001";

const outstanding = async (page: Page) => {
  await page.goto("/staff/dashboard");
  const text = await page.locator(".stat-tape > *").filter({ hasText: "Total outstanding" }).innerText();
  return Number(text.match(/₹([\d,]+)/)?.[1].replaceAll(",", ""));
};
const stoppedOnPaid = async (page: Page) => {
  await page.goto("/staff/students/STU-0587");
  const timeline = page.locator("section", { has: page.getByRole("heading", { name: "Reminder timeline" }) });
  await expect(timeline.getByRole("heading", { name: /^Instalment \d$/ }).first()).toBeVisible();
  return timeline.getByText(/^Stopped: paid/).count();
};

test("golden journey: a Hindi parent pays on a phone, and accounts sees the reminder stop and the dashboard change", async ({ page, context }, info) => {
  test.skip(info.project.name !== "mobile", "The golden journey runs once, at 360 px.");
  const errors: string[] = [];
  page.on("pageerror", (error) => { if (!isStreamingRace(error)) errors.push(error.message); });
  await sharedReset(); // Ishita owes ₹15,000 and her family has not yet consented.
  try {
    await signIn(context, "accounts");
    const [before, stoppedBefore] = [await outstanding(page), await stoppedOnPaid(page)];
    expect(before).toBeGreaterThan(15000);
    await context.clearCookies();

    await context.addCookies([{ name: "lang", value: hi, url: APP }]);
    await page.goto("/login");
    await page.getByRole("textbox", { name: t(hi, "login.phone") }).fill("9000000587");
    await page.getByRole("button", { name: t(hi, "login.sendCode"), exact: true }).click();
    const demo = page.getByText(/^डेमो कोड: [0-9]{6}$/);
    const code = (await demo.innerText()).match(/[0-9]{6}/)![0];
    await page.getByRole("textbox", { name: t(hi, "login.digit", { n: 1, total: 6 }), exact: true }).fill(code);
    await expect(page).toHaveURL(/\/consent(?:\?|$)/);
    await page.getByText(t(hi, "consent.check", { student: "Ishita Sharma" }), { exact: true }).click();
    await page.getByRole("button", { name: t(hi, "consent.agree"), exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByRole("link", { name: t(hi, "dues.pay", { amount: "₹15,000" }), exact: true }).click();
    await page.getByRole("button", { name: t(hi, "pay.button", { amount: "₹15,000" }), exact: true }).click();
    await expect(page.getByRole("heading", { name: t(hi, "pay.success"), exact: true })).toBeVisible();
    await page.getByRole("link", { name: t(hi, "pay.viewReceipt"), exact: true }).click();
    await expect(page).toHaveURL(/\/receipts\/[0-9a-f-]{36}$/);
    await expect(page.locator(".bui-table").getByText("₹15,000", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await context.clearCookies();

    await signIn(context, "accounts");
    expect(await stoppedOnPaid(page)).toBe(stoppedBefore + 1);
    expect(await outstanding(page)).toBe(before - 15000);
    expect(errors).toEqual([]);
  } finally { await sharedReset(); }
});
