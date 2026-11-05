import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ context }) => {
  await context.addCookies([{ name: "proto", value: encodeURIComponent(JSON.stringify({ role: "admin" })), url: "http://127.0.0.1:3001" }]);
});

const press = (page: Page, name: string) => page.getByRole("button", { name, exact: true }).filter({ visible: true }).first().click();
async function healthy(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations.filter((item) => item.impact === "serious" || item.impact === "critical")).toEqual([]);
}
async function pickDay(page: Page, field: string, day: string) {
  await page.getByRole("dialog", { name: /Add batch/ }).getByRole("group", { name: field }).getByRole("button").click();
  const calendar = page.getByRole("dialog", { name: field });
  await calendar.getByRole("gridcell").filter({ hasText: new RegExp(`^${day}$`) }).first().click();
  await calendar.getByRole("button", { name: "Apply" }).click();
}

test("an admin edits a student, changes the fee with a reason, and finds it in the history", async ({ page }) => {
  await page.goto("/staff/manage/students?q=STU-0412");
  await expect(page.getByRole("heading", { name: "Students", exact: true })).toBeVisible();
  await healthy(page);
  await press(page, "Edit Aarav Meena");
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Guardian name").fill("Suresh Meena");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Suresh Meena").filter({ visible: true }).first()).toBeVisible();

  await press(page, "Edit Aarav Meena");
  await expect(dialog.getByText("Still studying with a balance. Withdraw through the refund flow first.")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Archive" })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Change fee or discount" }).click();
  await dialog.getByLabel("Discount (₹)").fill("40000");
  await dialog.getByLabel("Reason for the change").fill("Scholarship test result");
  await dialog.getByRole("button", { name: "Save fee" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("The new fee cannot be less than what is already paid.");
  await dialog.getByLabel("Discount (₹)").fill("20000");
  await dialog.getByRole("button", { name: "Save fee" }).click();
  await expect(dialog).toBeHidden();

  await page.goto("/staff/manage/history?entity=student&id=STU-0412");
  await expect(page.getByText("Reason: Scholarship test result")).toBeVisible();
  await expect(page.getByText("₹0 → ₹20,000")).toBeVisible();
  await expect(page.getByText("Guardian of Aarav → Suresh Meena")).toBeVisible();
  await healthy(page);
});

test("a batch with students cannot be archived, and an empty one can be archived then deleted", async ({ page }) => {
  await page.goto("/staff/manage/batches?centre=MLV");
  await press(page, "Edit JEE 2027 Morning");
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/^Move its \d+ students to another batch first\.$/)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Archive" })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Cancel" }).click();

  await page.getByRole("main").getByRole("button", { name: "Add batch" }).click();
  const form = page.getByRole("dialog", { name: /Add batch/ });
  await form.getByRole("button", { name: /Centre/ }).click();
  await page.getByRole("option", { name: "Malviya Nagar" }).click();
  await form.getByRole("button", { name: /Exam/ }).click();
  await page.getByRole("option", { name: "JEE" }).click();
  await form.getByLabel("Exam year").fill("2028");
  await form.getByRole("button", { name: /Timing/ }).click();
  await page.getByRole("option", { name: "Morning" }).click();
  await form.getByRole("button", { name: "Add batch" }).click();
  await expect(form.getByRole("alert")).toHaveText("Session starts: choose a date.");
  await pickDay(page, "Session starts", "10");
  await pickDay(page, "Session ends", "20");
  await form.getByRole("button", { name: "Add batch" }).click();
  await expect(form).toBeHidden();

  await press(page, "Edit JEE 2028 Morning");
  await dialog.getByRole("button", { name: "Archive" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Archive" }).click();
  await expect(page.getByRole("tab", { name: /^Archived 1/ })).toBeVisible();
  await page.getByRole("tab", { name: /^Archived/ }).click();
  await press(page, "View JEE 2028 Morning");
  await dialog.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("No archived batches")).toBeVisible();

  await page.goto("/staff/manage/history?entity=batch");
  for (const verb of ["Deleted", "Archived", "Added"]) await expect(page.getByText(`${verb} batch JEE 2028 Morning`)).toBeVisible();
});

test("an admin cannot archive their own account, and the screens have loading, empty and error states", async ({ page }) => {
  await page.goto("/staff/manage/staff");
  await press(page, "Edit Pooja Agarwal");
  await expect(page.getByRole("dialog").getByText("You cannot archive or delete your own account.")).toBeVisible();
  await page.goto("/staff/manage/centres?state=empty");
  await expect(page.getByText("No matching centres")).toBeVisible();
  await page.goto("/staff/manage/history?state=loading");
  await expect(page.getByRole("status").first()).toBeVisible();
  await page.goto("/staff/manage/staff?state=error");
  await expect(page.getByRole("button", { name: /Try again|फिर से/ })).toBeVisible();
  await page.goto("/staff/dashboard");
  await expect(page).toHaveURL(/\/staff\/login/);
});
