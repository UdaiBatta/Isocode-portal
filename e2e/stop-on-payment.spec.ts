import { expect, test, type Page } from "@playwright/test";

// Real Django session against the shared demo database. One run per suite: it records a real payment, then the
// shared reset (approved for this scenario) restores the twelve named students. The reset runs even if a check fails.
test.use({ trace: "off" });

async function staffSignIn(page: Page) {
  const password = process.env.SEED_DEMO_PASSWORD;
  if (!password) throw new Error("SEED_DEMO_PASSWORD is required for real-session acceptance.");
  await page.goto("/staff/login");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("accounts@demo.test");
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/staff\/dashboard$/);
}

async function sharedReset(page: Page) {
  await page.goto("/staff/automation");
  await page.getByRole("button", { name: "Reset demo", exact: true }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("shared database");
  await dialog.getByRole("button", { name: "Reset for everyone", exact: true }).click();
  await expect(page.getByText("Demo restored")).toBeVisible();
}

test("a real counter payment stops the next reminder, and the shared reset restores it", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "One shared-database payment per suite.");
  await staffSignIn(page);
  const timeline = page.locator("section", { has: page.getByRole("heading", { name: "Reminder timeline" }) });
  const stopped = timeline.getByText(/^Stopped: paid/);
  const next = timeline.getByText(/^Next /);
  try {
    await page.goto("/staff/students/STU-0587");
    await expect(next.first()).toBeVisible();
    const [stoppedBefore, nextBefore] = [await stopped.count(), await next.count()];
    await expect(timeline.getByRole("heading", { name: /^Instalment \d$/ }).first()).toBeVisible();

    await page.getByRole("button", { name: "Record payment", exact: true }).click();
    const form = page.getByRole("dialog", { name: "Record counter payment" });
    await form.getByRole("textbox", { name: "Amount in ₹" }).fill("15000");
    await form.getByRole("button", { name: "Save payment", exact: true }).click();
    await expect(form).toBeHidden();
    await expect(page.getByText(/^Receipt .+ created$/)).toBeVisible();

    await expect(stopped).toHaveCount(stoppedBefore + 1);
    await expect(next).toHaveCount(nextBefore - 1);
  } finally {
    await sharedReset(page);
  }
  await page.goto("/staff/students/STU-0587");
  await expect(next.first()).toBeVisible();
});
