import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.use({ trace: "off" });

test("real parent OTP and consent permit dues access", async ({ page, context }, info) => {
  test.skip(info.project.name !== "mobile", "One real UI OTP per suite; layout coverage still runs at both widths.");
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
  const demo = page.getByText(/^Demo code: [0-9]{6}$/);
  await expect(demo).toBeVisible();
  const code = (await demo.innerText()).match(/[0-9]{6}/)?.[0];
  if (!code) throw new Error("The demo OTP was not displayed.");
  await expect(page.getByRole("button", { name: /New code in/ })).toBeDisabled();
  await page.getByRole("textbox", { name: "Digit 1 of 6", exact: true }).fill(code === "000000" ? "000001" : "000000");
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("That code is wrong. Try again.");
  await page.getByRole("textbox", { name: "Digit 1 of 6", exact: true }).fill(code).catch(() => {
    throw new Error("Could not enter the displayed demo code.");
  });
  await expect(page).toHaveURL(/\/(consent|dashboard)(?:\?|$)/);
  const sid = (await context.cookies()).find((cookie) => cookie.name === "sid");
  expect(Boolean(sid)).toBe(true);
  expect(sid?.httpOnly).toBe(true);
  expect(sid?.sameSite).toBe("Lax");
  expect(sid?.secure).toBe(false);
  if (new URL(page.url()).pathname === "/consent") {
    await page.goto("/dues");
    await expect(page).toHaveURL(/\/consent(?:\?|$)/);
    await expect(page.getByRole("button", { name: "Agree and continue" })).toBeDisabled();
    const consent = page.getByRole("checkbox");
    await page.getByText("I am the parent or guardian of Ishita Sharma and I agree", { exact: true }).click();
    await expect(consent).toBeChecked();
    await page.getByRole("button", { name: "Agree and continue", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  }
  await page.goto("/dues");
  await expect(page.getByRole("link", { name: "Pay ₹15,000", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("link", { name: "Pay ₹15,000", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

for (const language of ["hi", "en"]) test(`sign-in fits and is accessible in ${language}`, async ({ page, context }) => {
  await context.addCookies([{ name: "lang", value: language, url: "http://127.0.0.1:3001" }]);
  await page.goto("/login");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations.filter((item) => item.impact === "serious" || item.impact === "critical")).toEqual([]);
});
