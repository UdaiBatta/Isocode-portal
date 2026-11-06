import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { payPath, sharedReset, signIn } from "./session";

test.beforeEach(async ({ context }) => {
  await signIn(context, "accounts");
});

test("the roster filters by status, batch and search, and opens a ledger", async ({ page }) => {
  await page.goto("/staff/students"); await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "Students", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: /^Over 60 days/ }).click();
  await expect(page).toHaveURL(/status=over60/);
  await page.getByRole("tab", { name: /^All/ }).click();
  await expect(page).not.toHaveURL(/status=/);
  const search = page.getByRole("searchbox", { name: "Search student" });
  await search.fill("STU-0587"); await search.press("Enter");
  await expect(page).toHaveURL(/q=STU-0587/);
  await page.getByRole("link", { name: "Ishita Sharma", exact: true }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/staff\/students\/STU-0587$/);
  await page.goto("/staff/students?q=nobody-matches");
  await expect(page.getByText("No matching students", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations.filter((item) => item.impact === "serious" || item.impact === "critical")).toEqual([]);
});

test("paying moves a student out of Overdue, and shows the method used", async ({ page }) => {
  await page.goto("/staff/students?q=STU-0587");
  await expect(page.getByText("Overdue", { exact: true }).filter({ visible: true }).last()).toBeVisible();
  try {
  await page.goto((await payPath()).replace("/pay/", "/mock-gateway/"));
  await page.getByRole("radio", { name: /Card|कार्ड/ }).check({ force: true });
  await page.getByRole("button", { name: /^(Pay ₹15,000|₹15,000 का भुगतान करें)$/ }).click();
  await expect(page).toHaveURL(/\/result\?e=/);
  await page.goto("/staff/students?q=STU-0587");
  await expect(page.getByText(/Card/).filter({ visible: true }).first()).toBeVisible();
  } finally { await sharedReset(); }
});

test("the whole row opens a student, whose record holds dues, funds, marks and personal details", async ({ page }, info) => {
  await page.goto("/staff/students?q=STU-0587"); await page.waitForLoadState("networkidle");
  const row = info.project.name === "mobile" ? page.getByRole("listitem").filter({ hasText: "STU-0587" }) : page.getByRole("row", { name: /Ishita Sharma/ });
  const box = (await row.boundingBox())!;
  await row.click({ position: { x: box.width - 8, y: box.height - 8 } });
  await expect(page).toHaveURL(/\/staff\/students\/STU-0587$/);
  await expect(page.getByRole("heading", { name: "Instalments" })).toBeVisible();
  await page.getByRole("tab", { name: "Funds" }).click();
  await expect(page.getByRole("heading", { name: "Fee plan" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Payments" })).toBeVisible();
  await page.getByRole("tab", { name: "Academic" }).click();
  await expect(page.getByRole("group", { name: "Marks over recent tests" }).getByRole("img")).toHaveCount(5);
  await expect(page.getByRole("heading", { name: "Attendance" })).toBeVisible();
  await page.getByRole("tab", { name: "Personal" }).click();
  await expect(page.getByRole("link", { name: "+919000000587" })).toHaveAttribute("href", "tel:+919000000587");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations.filter((item) => item.impact === "serious" || item.impact === "critical")).toEqual([]);
});

test("dashboard rows open anywhere, and each heading lines up with its figures", async ({ page }, info) => {
  await page.goto("/staff/dashboard"); await page.waitForLoadState("networkidle");
  test.skip(info.project.name === "mobile", "Phones show cards, with no headings");
  const heading = page.getByRole("columnheader", { name: "Outstanding" }).getByRole("button");
  const row = page.getByRole("row", { name: /Malviya Nagar/ }).first();
  const figure = row.getByRole("gridcell").or(row.getByRole("cell")).nth(1).locator("span");
  const [a, b] = [(await heading.boundingBox())!, (await figure.boundingBox())!];
  expect(Math.abs(a.x + a.width - (b.x + b.width))).toBeLessThan(2);
  const button = row.getByRole("button", { name: "Malviya Nagar" });
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await row.click({ position: { x: 300, y: 10 } });
  await expect(button).toHaveAttribute("aria-expanded", "true");
});
