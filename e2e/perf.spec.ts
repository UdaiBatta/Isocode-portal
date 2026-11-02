import { expect, test } from "@playwright/test";

for (const [route, budget] of [["/dues", 200000], ["/login", 200000], ["/pay/STU-0587-3", 200000], ["/demo", 350000]] as const) test(`${route} stays within its compressed JavaScript budget`, async ({ page }) => {
  await page.goto(route); await page.waitForLoadState("networkidle");
  const scripts = await page.evaluate(() => performance.getEntriesByType("resource").filter((entry) => new URL(entry.name).pathname.endsWith(".js")).map((entry) => ({ name: entry.name, bytes: (entry as PerformanceResourceTiming).encodedBodySize })));
  expect(scripts.length).toBeGreaterThan(0);
  expect(scripts.every((script) => script.bytes > 0)).toBe(true);
  const bytes = scripts.reduce((sum, script) => sum + script.bytes, 0);
  console.log(`${route}: ${bytes} compressed script bytes (budget ${budget})`);
  expect(bytes).toBeLessThanOrEqual(budget);
});
