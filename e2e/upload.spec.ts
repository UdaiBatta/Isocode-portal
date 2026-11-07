import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./session";

// Needs Django's upload_progress (DEPTH contract on docs/progress.md). Saving rewrites the same rows Ishita already
// has (week of 26 Oct, Monthly Test 7) with the same values, so the shared data is unchanged afterwards.
async function choose(page: Page, kind: "Attendance" | "Test scores", csv: string) {
  await page.getByRole("radio", { name: kind, exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: `${kind}.csv`, mimeType: "text/csv", buffer: Buffer.from(csv) });
}

test("accounts uploads a batch's scores: errors block the save, a clean file saves all rows", async ({ page, context }) => {
  await signIn(context, "accounts");
  await page.goto("/staff/upload");
  await expect(page.getByRole("heading", { name: "Upload results", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Batch/ }).click();
  await page.getByRole("option", { name: "Malviya Nagar · JEE 2027 Evening", exact: true }).click();

  await choose(page, "Attendance", "student_code,week_start,attended,held\nSTU-0587,2026-10-26,7,6\nSTU-9999,2026-10-26,5,6\n");
  await expect(page.getByText(/^2 of 2 rows need fixing\. Nothing was saved\.$/)).toBeVisible();
  await expect(page.getByText(/^Line 2: /)).toBeVisible();
  await expect(page.getByRole("button", { name: /^Save/ })).toHaveCount(0);

  await choose(page, "Test scores", "student_code,test_date,test_name,score,max_score\nSTU-0587,2026-10-28,Monthly Test 7,88,100\n");
  await expect(page.getByText(/^1 row in .+ is ready\./)).toBeVisible();
  await page.getByRole("button", { name: "Save 1 row", exact: true }).click();
  await expect(page.getByText("Saved 1 row", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("a valid file just under 1 MB reaches Django and checks clean", async ({ page, context }) => {
  // 5,000 rows of 209 bytes plus the header = 1,045,049 bytes: under 1 MB, but over it once encoded as an action body.
  const header = "student_code,test_date,test_name,score,max_score\n";
  const csv = header + Array.from({ length: 5000 }, (_, i) => `STU-0587,2026-10-28,${`Near limit ${i} `.padEnd(182, "x")},1,100\n`).join("");
  expect(Buffer.byteLength(csv)).toBe(1_045_049);
  await signIn(context, "accounts");
  await page.goto("/staff/upload");
  await page.getByRole("button", { name: /Batch/ }).click();
  await page.getByRole("option", { name: "Malviya Nagar · JEE 2027 Evening", exact: true }).click();
  await choose(page, "Test scores", csv); // Checked only; never saved.
  await expect(page.getByText(/^5000 rows in .+ are ready\./)).toBeVisible({ timeout: 60_000 });
});

for (const who of ["counsellor", "parent:9000000587"] as const) {
  test(`${who.split(":")[0]} cannot open the upload screen`, async ({ page, context }) => {
    await signIn(context, who);
    await page.goto("/staff/upload");
    await expect(page).toHaveURL(/\/staff\/login$/);
  });
}
