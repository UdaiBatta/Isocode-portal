import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const signInAs = (context: BrowserContext, role: "accounts" | "counsellor") =>
  context.addCookies([{ name: "proto", value: encodeURIComponent(JSON.stringify({ role })), url: "http://127.0.0.1:3001" }]);
const ground = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

// The theme is set on <html> from the surface inside it, so a parent frame anywhere would repaint the whole page.
async function expectSoundStaffPage(page: Page, normalGround: string) {
  await expect(page.locator(".staff-surface").first()).toBeVisible();
  await expect(page.locator(".parent-surface, .paper-surface")).toHaveCount(0);
  await expect(page.locator("main")).toHaveCount(1);
  expect(await ground(page)).toBe(normalGround);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations.filter((item) => item.impact === "serious" || item.impact === "critical")).toEqual([]);
}

async function expectRetryControl(page: Page) {
  const retry = page.getByRole("button", { name: "Try again", exact: true });
  await expect(retry).toBeVisible();
  expect((await retry.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  return retry;
}

// Phone navigation lives behind the drawer, which must open with the same links.
async function workspaceNav(page: Page, isPhone: boolean) {
  if (isPhone) {
    const menu = page.getByRole("button", { name: "Menu", exact: true });
    expect((await menu.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await menu.click();
    return page.getByRole("dialog", { name: "Workspace navigation" }).getByRole("navigation", { name: "Workspace" });
  }
  return page.getByRole("navigation", { name: "Workspace" });
}

for (const path of ["/staff/dashboard", "/staff/students", "/staff/students/STU-0587", "/staff/students/STU-0587/refund", "/staff/automation"]) {
  test(`${path} keeps the staff frame when it fails`, async ({ page, context }, info) => {
    await signInAs(context, "accounts");
    await page.goto(path);
    const normalGround = await ground(page);
    await page.goto(`${path}?state=error`);
    await expectRetryControl(page);
    await expectSoundStaffPage(page, normalGround);
    await expect(page.locator("main")).not.toContainText("₹");
    await expect(page.locator("main")).not.toContainText("Ishita");
    await expect((await workspaceNav(page, info.project.name === "mobile")).getByRole("link", { name: "Students", exact: true })).toBeVisible();
  });
}

for (const [role, path] of [["accounts", "/staff/dashboard"], ["accounts", "/staff/students"], ["accounts", "/staff/students/STU-0587"], ["accounts", "/staff/students/STU-0587/refund"], ["accounts", "/staff/automation"], ["counsellor", "/counsellor/tasks"]] as const) {
  test(`${path} loading preview stays in the staff frame`, async ({ page, context }) => {
    await signInAs(context, role);
    await page.goto(path);
    const normalGround = await ground(page);
    await page.goto(`${path}?state=loading`);
    await expect(page.getByRole("status", { name: "Loading" })).toHaveAttribute("aria-busy", "true");
    await expectSoundStaffPage(page, normalGround);
  });
}

test("staff retry drops only the forced error and reloads the page", async ({ page, context }) => {
  await signInAs(context, "accounts");
  await page.goto("/staff/dashboard?group=batch&state=error");
  await (await expectRetryControl(page)).click();
  await expect(page).toHaveURL(/\/staff\/dashboard\?group=batch$/);
  await expect(page.getByRole("heading", { name: "Dues dashboard" })).toBeVisible();
});

test("counsellor failure keeps the counsellor frame and offers only counsellor links", async ({ page, context }, info) => {
  await signInAs(context, "counsellor");
  await page.goto("/counsellor/tasks");
  const normalGround = await ground(page);
  await page.goto("/counsellor/tasks?state=error");
  await expectRetryControl(page);
  await expectSoundStaffPage(page, normalGround);
  await expect(page.locator("main")).not.toContainText("₹");
  await expect(page.locator("main")).not.toContainText("Riya");
  const nav = await workspaceNav(page, info.project.name === "mobile");
  await expect(nav.getByRole("link", { name: "Call tasks", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Dashboard", exact: true })).toHaveCount(0);
  if (info.project.name === "mobile") await page.getByRole("button", { name: "Close", exact: true }).click();
  await (await expectRetryControl(page)).click();
  await expect(page).toHaveURL(/\/counsellor\/tasks$/);
  await expect(page.getByText("73%", { exact: true })).toBeVisible();
});

test("staff sign-in stays in its dark frame, without workspace navigation, in every state", async ({ page }) => {
  await page.goto("/staff/login");
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  const normalGround = await ground(page);

  await page.goto("/staff/login?state=loading");
  await expect(page.getByRole("status", { name: "Loading" })).toBeVisible();
  await expectSoundStaffPage(page, normalGround);

  await page.goto("/staff/login?state=empty");
  await expect(page.getByRole("heading", { name: "Contact your centre for staff access" })).toBeVisible();
  await expectSoundStaffPage(page, normalGround);

  await page.goto("/staff/login?state=error");
  const retry = await expectRetryControl(page);
  await expectSoundStaffPage(page, normalGround);
  await expect(page.getByRole("navigation", { name: "Workspace" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Menu", exact: true })).toHaveCount(0);
  await retry.click();
  await expect(page).toHaveURL(/\/staff\/login$/);
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
});
