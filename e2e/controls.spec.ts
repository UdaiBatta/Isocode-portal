import { expect, test, type BrowserContext } from "@playwright/test";
import { renderReminder } from "../lib/reminder-text";
import { dateLabel } from "../lib/format";
import { openUnmatched, payPath, sharedReset, signIn } from "./session";

async function accounts(context: BrowserContext, centreId?: string) {
  await context.addCookies([{ name: "lang", value: "en", url: "http://127.0.0.1:3001" }]);
  await signIn(context, centreId === "MLV" ? "accounts.mlv" : "accounts");
}

test("centre filter waits for its handlers before accepting the first tap", async ({ page, context }) => {
  await accounts(context);
  let releaseScripts!: () => void;
  const scriptsReady = new Promise<void>((resolve) => { releaseScripts = resolve; });
  await page.route(/\/_next\/static\/.*\.js(?:\?|$)/, async (route) => { await scriptsReady; await route.continue(); });
  try {
    await page.goto("/staff/dashboard", { waitUntil: "commit" });
    const centre = page.getByRole("button", { name: /Centre$/ });
    await expect(centre).toBeVisible();
    await expect(centre).toBeDisabled();
    releaseScripts();
    await expect(centre).toBeEnabled();
    await centre.click();
    await expect(page.getByRole("option", { name: "Malviya Nagar", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("listbox")).not.toBeVisible();
  } finally { releaseScripts(); }
});

test("calendar Cancel, Escape and outside dismissal preserve the committed date", async ({ page, context }) => {
  await accounts(context);
  await page.goto("/staff/automation");
  const calendar = page.getByRole("dialog", { name: "Demo date", exact: true });
  for (const dismissal of ["cancel", "escape", "outside"]) {
    await page.getByRole("button", { name: "2 Nov 2026", exact: true }).click();
    await calendar.getByRole("button", { name: "Monday, 9 November 2026", exact: true }).click();
    if (dismissal === "cancel") await calendar.getByRole("button", { name: "Cancel", exact: true }).click();
    else if (dismissal === "escape") await page.keyboard.press("Escape");
    else await page.mouse.click(2, 2);
    await expect(calendar).not.toBeVisible();
    await expect(page.getByRole("button", { name: "2 Nov 2026", exact: true })).toBeVisible();
  }
});

test("dashboard centre, expansion, student navigation, exports and pay-link copy work", async ({ page, context }) => {
  await accounts(context);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/staff/dashboard");
  await page.getByRole("button", { name: /Centre$/ }).click();
  await page.getByRole("option", { name: "Malviya Nagar", exact: true }).click();
  await expect(page).toHaveURL(/centre=MLV/);
  await page.getByRole("button", { name: "Malviya Nagar", exact: true }).click();
  await page.getByRole("button", { name: "JEE 2027 Evening", exact: true }).click();
  await expect(page).toHaveURL(/batch=[0-9a-f-]{36}/);
  for (const kind of ["dues", "receipts"]) {
    const download = page.waitForEvent("download");
    await page.getByRole("link", { name: `Export ${kind} CSV`, exact: true }).click();
    expect((await download).suggestedFilename()).toMatch(new RegExp(`^${kind}-.*\\.csv$`));
  }
  await expect(page.locator('a[href^="/staff/students/STU-"]').filter({ visible: true }).first()).toBeVisible();
  await page.goto("/staff/students/STU-0587");
  await page.getByRole("button", { name: "Copy pay link", exact: true }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toMatch(/^http:\/\/127\.0\.0\.1:3001\/pay\/[^/]+$/);
  await page.getByRole("button", { name: "Start refund", exact: true }).click();
  await expect(page).toHaveURL(/\/refund$/);
  await page.getByRole("link", { name: "Ishita Sharma", exact: true }).click();
  await expect(page).toHaveURL(/\/STU-0587$/);
});

test("counter date validation, bank method, excess queue and receipt link work", async ({ page, context }) => {
  await accounts(context);
  await page.goto("/staff/students/STU-0587");
  try {
  await page.getByRole("button", { name: "Record payment", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "Record counter payment", exact: true });
  await modal.getByRole("textbox", { name: "Amount in ₹", exact: true }).fill("50000");
  await modal.getByRole("button", { name: /Method$/ }).click();
  await page.getByRole("option", { name: "Bank transfer", exact: true }).click();
  await modal.getByRole("button", { name: "2 Nov 2026", exact: true }).click();
  const calendar = page.getByRole("dialog", { name: "Received on", exact: true });
  await calendar.getByRole("button", { name: /Tuesday, 3 November 2026/ }).click();
  await calendar.getByRole("button", { name: "Apply", exact: true }).click();
  await modal.getByRole("button", { name: "Save payment", exact: true }).click();
  await expect(modal.getByRole("alert")).toHaveText("Payment date cannot be after today.");
  await modal.getByRole("button", { name: "3 Nov 2026", exact: true }).click();
  await calendar.getByRole("button", { name: /Monday, 2 November 2026/ }).click();
  await calendar.getByRole("button", { name: "Apply", exact: true }).click();
  await modal.getByRole("textbox", { name: "Note", exact: true }).fill("Verified fictional bank payment.");
  await modal.getByRole("button", { name: "Save payment", exact: true }).click();
  await expect(modal).not.toBeVisible();
  await expect(page.getByText("₹5,000 sent to the unmatched queue.", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Funds", exact: true }).click();
  await page.getByRole("link", { name: "View receipt", exact: true }).filter({ visible: true }).first().click();
  await expect(page.getByRole("heading", { name: "Fee receipt", exact: true })).toBeVisible();
  } finally { await sharedReset(); }
});

test("MLV-only accounts cannot choose another centre", async ({ page, context }) => {
  await accounts(context, "MLV");
  await page.goto("/staff/dashboard");
  await expect(page.getByRole("button", { name: /Centre$/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Malviya Nagar", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Vaishali Nagar", exact: true })).toHaveCount(0);
});

test("paid reminders stop, demo replay sends Mohit's Hindi message, and reset restores the date", async ({ page, context }) => {
  test.setTimeout(60000);
  await accounts(context);
  try {
  await page.goto((await payPath()).replace("/pay/", "/mock-gateway/"));
  await page.getByRole("button", { name: "Pay ₹15,000", exact: true }).click();
  await expect(page).toHaveURL(/\/result\?e=/);
  await page.goto("/staff/automation");
  await page.getByRole("radio", { name: "Stopped", exact: true }).click();
  await expect(page.getByText("Stopped: paid", { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "2 Nov 2026", exact: true }).click();
  const calendar = page.getByRole("dialog", { name: "Demo date", exact: true });
  await calendar.getByRole("button", { name: "Monday, 9 November 2026", exact: true }).click();
  await calendar.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.getByRole("button", { name: "9 Nov 2026", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Run today's reminders", exact: true }).click();
  await expect(page.getByRole("radio", { name: "Sent", exact: true })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: /Mohit Gurjar/ }).click();
  const drawer = page.getByRole("dialog", { name: "Reminder details", exact: true });
  const body = renderReminder("hi", -1, { student: "Mohit Gurjar", amount: "₹40,000", date: dateLabel("2026-11-15", "hi", "2026-11-09"), link: "LINK" }).split("LINK")[0].trim();
  await expect(drawer).toContainText(body);
  await drawer.getByRole("link", { name: "Open student ledger", exact: true }).click();
  await expect(page).toHaveURL(/\/STU-0219$/);
  await page.goto("/staff/automation");
  await page.getByRole("radio", { name: "Sent", exact: true }).click();
  const ishitaRows = page.getByRole("tabpanel", { name: "Reminders", exact: true }).locator('[role="row"], li').filter({ hasText: "Ishita Sharma" }).filter({ visible: true });
  await expect(ishitaRows.filter({ has: page.getByRole("gridcell", { name: "30", exact: true }) }).or(ishitaRows.filter({ hasText: /\bStep 30\b/ }))).toHaveCount(0);
  await page.getByRole("radio", { name: "Needs a call", exact: true }).click();
  await page.getByRole("radio", { name: "Upcoming", exact: true }).click();
  await page.getByRole("button", { name: "Reset demo", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Reset for everyone", exact: true }).click();
  await expect(page.getByRole("button", { name: "2 Nov 2026", exact: true })).toBeVisible();
  } finally { await sharedReset(); }
});

test("queue student search, partial matching and rejection work", async ({ page, context }) => {
  await accounts(context);
  const unknown = (await openUnmatched()).filter((item) => item.reason === "unknown_reference").sort((a, b) => a.amount - b.amount);
  expect(unknown.length).toBeGreaterThanOrEqual(2);
  try {
  await page.goto(`/staff/automation?tab=unmatched&item=${unknown[0].id}`);
  const drawer = page.getByRole("dialog", { name: "Match payment", exact: true });
  await drawer.getByRole("combobox", { name: "Find student", exact: true }).fill("Ishita");
  await page.getByRole("option", { name: /Ishita Sharma/ }).click();
  await drawer.getByRole("button", { name: /Instalment$/ }).click();
  await page.getByRole("option", { name: "Instalment 3 · ₹15,000", exact: true }).click();
  await drawer.getByRole("button", { name: "Match payment", exact: true }).click();
  await expect(drawer).not.toBeVisible();
  await page.goto("/staff/students/STU-0587");
  const left = `₹${((1500000 - unknown[0].amount) / 100).toLocaleString("en-IN")}`;
  await expect(page.getByText(left, { exact: true }).or(page.getByText(`Balance ${left}`, { exact: true })).filter({ visible: true }).first()).toBeVisible();
  await page.goto(`/staff/automation?tab=unmatched&item=${unknown[1].id}`);
  await drawer.getByRole("textbox", { name: "Resolution note", exact: true }).fill("Bank confirmed this reference belongs to another account.");
  await drawer.getByRole("button", { name: "Reject payment", exact: true }).click();
  await expect(drawer).not.toBeVisible();
  await expect(page.getByText("Payment rejected", { exact: true })).toBeVisible();
  } finally { await sharedReset(); }
});

test("refunds can be marked paid and blocked approvals point to the queue", async ({ page, context }) => {
  await accounts(context);
  try {
  await page.goto("/staff/students/STU-0802/refund");
  await page.getByRole("button", { name: "Mark as paid (mock)", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Mark as paid", exact: true }).click();
  await expect(page.getByText("Paid", { exact: true }).filter({ visible: true })).toBeVisible();
  await page.goto("/staff/students/STU-0771/refund");
  await page.getByRole("button", { name: /Reason$/ }).click();
  await page.getByRole("option", { name: "Personal", exact: true }).click();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("button", { name: "Approve refund", exact: true })).toBeDisabled();
  await page.getByRole("link", { name: "Open queue item", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Match payment", exact: true })).toBeVisible();
  } finally { await sharedReset(); }
});

test("counsellor tabs, phone link, called outcome and logout work", async ({ page, context }) => {
  await context.addCookies([{ name: "lang", value: "en", url: "http://127.0.0.1:3001" }]);
  await signIn(context, "counsellor");
  await page.goto("/counsellor/tasks");
  try {
  await page.getByRole("tab", { name: "Watch", exact: true }).click();
  await expect(page.getByRole("tabpanel", { name: "Watch", exact: true })).toContainText("Watch");
  await page.getByRole("tab", { name: "Not enough data", exact: true }).click();
  await expect(page.getByRole("tabpanel", { name: "Not enough data", exact: true }).getByText("No students in this view")).toHaveCount(0);
  await page.getByRole("tab", { name: "Call tasks", exact: true }).click();
  await page.getByRole("tabpanel", { name: "Call tasks", exact: true }).getByRole("button", { name: /Riya/ }).click();
  const drawer = page.getByRole("dialog", { name: "Counsellor call", exact: true });
  await expect(drawer.getByRole("link", { name: /Call parent/ })).toHaveAttribute("href", /^tel:\+91/);
  await drawer.getByText("Called, genuine concern", { exact: true }).click();
  await drawer.getByRole("button", { name: "Save outcome", exact: true }).click();
  await expect(drawer).not.toBeVisible();
  await page.getByRole("radio", { name: "Closed", exact: true }).click();
  await expect(page.getByRole("button", { name: /Riya/ })).toBeVisible();
  if (await page.getByRole("button", { name: "Menu", exact: true }).isVisible()) await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  } finally { await sharedReset(); }
});
