import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("scaffold renders BoardUI, Hindi and safe headers at both widths", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response?.headers()["x-frame-options"]).toBe("DENY");
  expect(response?.headers()["referrer-policy"]).toBe("same-origin");
  await expect(page).toHaveTitle("Company A | Coaching fees");
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  await expect(page.getByRole("heading", { name: "Coaching fees" })).toBeVisible();
  await expect(page.getByText("फीस और भुगतान की जानकारी")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => Array.from(document.fonts).some(
    (font) => font.family.includes("Noto") && font.status === "loaded",
  ))).toBe(true);

  const projectLink = page.getByRole("link", { name: "View project" });
  await expect(projectLink).toHaveCSS("background-image", /rgb\(37, 80, 46\)/);
  await expect(projectLink).toHaveCSS("color", "rgb(255, 255, 255)");
  expect((await projectLink.boundingBox())?.height).toBeGreaterThanOrEqual(48);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  )).toEqual([]);
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("scaffold.png"), fullPage: true });

  await page.route("https://github.com/UdaiBatta/isocode-coaching_tracker", (route) =>
    route.fulfill({ contentType: "text/html", body: "<h1>Project source</h1>" }),
  );
  await projectLink.click();
  await expect(page).toHaveURL("https://github.com/UdaiBatta/isocode-coaching_tracker");
});
