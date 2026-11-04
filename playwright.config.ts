import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  expect: { timeout: 10000 },
  use: { baseURL: "http://127.0.0.1:3001", trace: "retain-on-failure" },
  projects: [
    { name: "mobile", use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 640 } } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: [{
    command: "npm run start -- --hostname 127.0.0.1 --port 3001",
    url: "http://127.0.0.1:3001",
    reuseExistingServer: false,
  }, {
    command: "npm run py -- backend/manage.py runserver 8000 --noreload",
    port: 8000,
    reuseExistingServer: false,
  }],
});
