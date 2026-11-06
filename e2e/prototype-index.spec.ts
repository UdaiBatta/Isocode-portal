import { expect, test } from "@playwright/test";

// T5.6: the index can no longer forge a role or a payment; it is removed in T7.2.
test("the prototype index sends people to real sign-in instead of preparing a role", async ({ page }) => {
  await page.goto("/proto");
  await page.getByRole("link", { name: "Students · normal", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Sign in with a real demo account from the demo page." })).toBeVisible();
  await expect(page).toHaveURL(/\/proto$/);
});
