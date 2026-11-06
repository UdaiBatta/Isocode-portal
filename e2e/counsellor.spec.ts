import { expect, test } from "@playwright/test";
import { sharedReset, signIn } from "./session";

test("counsellor records a false flag without fee data", async ({ page, context }) => {
  await signIn(context, "counsellor");
  await page.goto("/counsellor/tasks");
  try {
  await expect(page.getByText("73%", { exact: true })).toBeVisible();
  await expect(page.locator("main")).not.toContainText("₹");
  await page.getByRole("button", { name: /Riya/ }).click();
  const drawer = page.getByRole("dialog", { name: "Counsellor call", exact: true });
  await drawer.getByText("False flag", { exact: true }).click();
  await drawer.getByRole("button", { name: "Save outcome", exact: true }).click();
  await expect(drawer.getByRole("alert")).toHaveText("Explain why this was a false flag.");
  await drawer.getByRole("textbox", { name: "Call note", exact: true }).fill("Parent confirmed a planned absence; the student is continuing.");
  await drawer.getByRole("button", { name: "Save outcome", exact: true }).click();
  await expect(drawer).not.toBeVisible();
  await expect(page.getByText("8 of 12 genuine", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Riya/ })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally { await sharedReset(); }
});

test("accounts cannot open counsellor flags", async ({ page, context }) => {
  await signIn(context, "accounts");
  await page.goto("/counsellor/tasks");
  await expect(page).toHaveURL(/\/staff\/login$/);
  await expect(page.getByText("Riya Verma", { exact: true })).toHaveCount(0);
});
