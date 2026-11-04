import { expect, test } from "@playwright/test";
import { prototypeRoutes } from "../lib/prototype-routes";

test("prototype links prepare the correct sample role and open real routes", async ({ page }) => {
  for (const route of prototypeRoutes) {
    await page.goto("/proto");
    await page.getByRole("link", { name: `${route.title} · normal`, exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === route.path);
    await expect(page.locator("main h1").first()).toBeVisible();
  }
});
