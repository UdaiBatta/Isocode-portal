import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { signIn } from "./session";

const signInAs = (context: BrowserContext, role: "accounts" | "counsellor") => signIn(context, role);
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

// Django refuses these requests, so each one shows the page's real error screen.
for (const [path, failing] of [["/staff/dashboard", "/staff/dashboard?batch=not-a-uuid"], ["/staff/students", "/staff/students?batch=not-a-uuid"], ["/staff/students/STU-0587", "/staff/students/STU-99999"], ["/staff/students/STU-0587/refund", "/staff/students/STU-99999/refund"]]) {
  test(`${path} keeps the staff frame when it fails`, async ({ page, context }, info) => {
    await signInAs(context, "accounts");
    await page.goto(path);
    const normalGround = await ground(page);
    await page.goto(failing);
    const retry = await expectRetryControl(page);
    await expectSoundStaffPage(page, normalGround);
    await expect(page.locator("main")).not.toContainText("₹");
    await expect(page.locator("main")).not.toContainText("Ishita");
    await retry.click(); // The same request fails again: the screen stays usable.
    await expectRetryControl(page);
    await expect((await workspaceNav(page, info.project.name === "mobile")).getByRole("link", { name: "Students", exact: true })).toBeVisible();
  });
}

test("a staff tab switches in place, showing its loading frame until the page arrives", async ({ page, context }, info) => {
  const isPhone = info.project.name === "mobile";
  await signInAs(context, "accounts");
  await page.goto("/staff/dashboard");
  const normalGround = await ground(page);
  let release = () => {};
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route((url) => url.pathname === "/staff/students", async (route) => {
    if (!route.request().headers()["next-router-prefetch"]) await held;
    await route.continue();
  });
  await page.evaluate(() => { (window as unknown as { kept: boolean }).kept = true; });
  const nav = await workspaceNav(page, isPhone);
  await page.waitForLoadState("networkidle"); // The link has prefetched its loading frame.
  await nav.getByRole("link", { name: "Students", exact: true }).click();
  await expect(page.getByRole("status", { name: "Loading" })).toHaveAttribute("aria-busy", "true");
  await expect(page.getByRole("dialog", { name: "Workspace navigation" })).toHaveCount(0);
  await expectSoundStaffPage(page, normalGround);
  release();
  await expect(page.getByRole("heading", { name: "Students", exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { kept?: boolean }).kept)).toBe(true);
});

test("a search with no match shows the real empty state in the staff frame", async ({ page, context }) => {
  await signInAs(context, "accounts");
  await page.goto("/staff/dashboard");
  const normalGround = await ground(page);
  await page.goto("/staff/students?q=no-such-student");
  await expect(page.getByText("No matching students", { exact: true })).toBeVisible();
  await expectSoundStaffPage(page, normalGround);
});

test("the counsellor frame offers only counsellor links", async ({ page, context }, info) => {
  await signInAs(context, "counsellor");
  await page.goto("/counsellor/tasks");
  await expect(page.getByText("73%", { exact: true })).toBeVisible();
  const nav = await workspaceNav(page, info.project.name === "mobile");
  await expect(nav.getByRole("link", { name: "Call tasks", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Dashboard", exact: true })).toHaveCount(0);
});

test("staff sign-in stays in its dark frame, without workspace navigation", async ({ page }) => {
  await page.goto("/staff/login");
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  await expectSoundStaffPage(page, await ground(page));
  await expect(page.getByRole("navigation", { name: "Workspace" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Menu", exact: true })).toHaveCount(0);
});

test("the prototype tools are gone", async ({ page, context }) => {
  expect((await page.goto("/proto"))!.status()).toBe(404);
  await signInAs(context, "accounts");
  await page.goto("/staff/dashboard?state=error");
  await expect(page.getByRole("heading", { name: "Dues dashboard" })).toBeVisible();
});

// The binding must run the full height of the window however far the page scrolls, for parents and staff alike.
test("the staff and parent spines stay in place while the page scrolls", async ({ page, context }, info) => {
  test.skip(info.project.name === "mobile", "Phones have no spine");
  await signInAs(context, "accounts");
  await page.goto("/staff/students");
  await page.evaluate(() => scrollTo(0, 600));
  await expect.poll(() => page.locator(".staff-spine").boundingBox().then((box) => [box!.y, box!.height])).toEqual([0, 800]);
  await context.clearCookies();
  await context.addCookies([{ name: "lang", value: "en", url: "http://127.0.0.1:3001" }]);
  await signIn(context, "parent:+919000000587");
  await page.goto("/dashboard");
  // The loading screen has its own spine; wait until streaming has swapped it for the page's.
  await expect(page.locator(".ledger-spine")).toHaveCount(1);
  await page.evaluate(() => scrollTo(0, 200));
  await expect.poll(() => page.locator(".ledger-spine").boundingBox().then((box) => [box!.y, box!.height])).toEqual([0, 800]);
});
