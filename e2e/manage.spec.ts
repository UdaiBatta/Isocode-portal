import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./session";

// Real Admin session: every change here is a real, audited write, so each test puts back what it changed.
test.beforeEach(async ({ context }) => {
  await signIn(context, "admin");
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

const AARAV = "/staff/manage/students?q=STU-0412";
async function saveGuardian(page: Page, name: string) {
  await press(page, "Edit Aarav Meena");
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Guardian name").fill(name);
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).toBeHidden();
}
async function setDiscount(page: Page, rupees: string, reason: string) {
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Change fee or discount" }).click();
  await dialog.getByLabel("Discount (₹)").fill(rupees);
  await dialog.getByLabel("Reason for the change").fill(reason);
  await dialog.getByRole("button", { name: "Save fee" }).click();
}

test("an admin edits a student, changes the fee with a reason, and finds it in the history", async ({ page }) => {
  test.setTimeout(90000); // Real audited writes, then putting them back.
  await page.goto(AARAV);
  await expect(page.getByRole("heading", { name: "Students", exact: true })).toBeVisible();
  await healthy(page);
  const dialog = page.getByRole("dialog");
  try {
    await saveGuardian(page, "Suresh Meena");
    await expect(page.getByText("Suresh Meena").filter({ visible: true }).first()).toBeVisible();

    await press(page, "Edit Aarav Meena");
    await expect(dialog.getByText("Still studying with a balance. Withdraw through the refund flow first.")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Archive" })).toHaveCount(0);
    await setDiscount(page, "40000", "Scholarship test result");
    await expect(dialog.getByRole("alert")).toHaveText("The new fee cannot be less than what is already paid.");
    await dialog.getByLabel("Discount (₹)").fill("20000");
    await dialog.getByRole("button", { name: "Save fee" }).click();
    await expect(dialog).toBeHidden();

    await press(page, "Edit Aarav Meena");
    await dialog.getByRole("link", { name: "Change history" }).click();
    await expect(page).toHaveURL(/\/staff\/manage\/history\?entity=student&id=/);
    await expect(page.getByText("Reason: Scholarship test result").first()).toBeVisible();
    await expect(page.getByText("₹0 → ₹20,000").first()).toBeVisible();
    await expect(page.getByText("Demo guardian → Suresh Meena").first()).toBeVisible();
    await healthy(page);
  } finally {
    await page.goto(AARAV);
    await saveGuardian(page, "Demo guardian");
    await press(page, "Edit Aarav Meena");
    const discount = await dialog.locator("dt", { hasText: /^Discount$/ }).locator("xpath=following-sibling::dd[1]").textContent();
    if (discount !== "₹0") {
      await setDiscount(page, "0", "Undo the browser test change");
      await expect(dialog).toBeHidden();
    }
  }
});

async function removeTestBatch(page: Page) {
  await page.goto("/staff/manage/batches?q=JEE%202028"); await page.waitForLoadState("networkidle");
  await expect(page.getByRole("tab", { name: /^Active/ })).toBeVisible(); // count() does not wait, so let the list render first
  const dialog = page.getByRole("dialog");
  if (await page.getByRole("button", { name: "Edit JEE 2028 Morning", exact: true }).filter({ visible: true }).count()) {
    await press(page, "Edit JEE 2028 Morning");
    await dialog.getByRole("button", { name: "Archive" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Archive" }).click();
    await expect(page.getByRole("alertdialog")).toBeHidden();
  }
  await page.goto("/staff/manage/batches?q=JEE%202028&state=archived"); await page.waitForLoadState("networkidle");
  await expect(page.getByRole("tab", { name: /^Archived/ })).toBeVisible();
  if (await page.getByRole("button", { name: "View JEE 2028 Morning", exact: true }).filter({ visible: true }).count()) {
    await press(page, "View JEE 2028 Morning");
    await dialog.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("alertdialog")).toBeHidden();
  }
}

test("a batch with students cannot be archived, and an empty one can be archived then deleted", async ({ page }) => {
  test.setTimeout(90000);
  await removeTestBatch(page); // In case an earlier interrupted run left it behind.
  await page.goto("/staff/manage/batches?q=JEE%202027%20Morning");
  await press(page, "Edit JEE 2027 Morning");
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/including archived ones/)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Archive" })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Cancel" }).click();

  try {
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

    await page.goto("/staff/manage/batches?q=JEE%202028"); // The list was filtered to the 2027 batches.
    await press(page, "Edit JEE 2028 Morning");
    await dialog.getByRole("button", { name: "Archive" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Archive" }).click();
    await page.getByRole("tab", { name: /^Archived/ }).click();
    await press(page, "View JEE 2028 Morning");
    await dialog.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("button", { name: "View JEE 2028 Morning", exact: true })).toHaveCount(0);

    await page.goto("/staff/manage/history?entity=batch");
    for (const verb of ["Deleted", "Archived", "Added"]) await expect(page.getByText(`${verb} batch JEE 2028 Morning`).first()).toBeVisible();
  } finally {
    await removeTestBatch(page);
  }
});

test("an admin cannot archive their own account, and the screens have loading, empty and error states", async ({ page }) => {
  await page.goto("/staff/manage/staff");
  await press(page, "Edit Demo Admin");
  await expect(page.getByRole("dialog").getByText("You cannot archive or delete your own account.")).toBeVisible();
  await page.goto("/staff/manage/centres?state=empty");
  await expect(page.getByText("No matching centres")).toBeVisible();
  await page.goto("/staff/manage/history?state=loading");
  await expect(page.getByRole("status").first()).toBeVisible();
  await page.goto("/staff/manage/staff?state=error");
  await expect(page.getByRole("button", { name: /Try again|फिर से/ })).toBeVisible();
  await page.goto("/staff/manage/constructor");
  await expect(page.getByText(/could not be found|404/i).first()).toBeVisible();
  await page.goto("/staff/dashboard");
  await expect(page).toHaveURL(/\/staff\/login/);
});
