import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["list"],
    ["html", { open: "never" }],
    ["json", { outputFile: "results/e2e-results.json" }],
    ["junit", { outputFile: "results/e2e-results.xml" }],
  ],

  use: {
    baseURL: process.env.BASE_URL || "http://localhost:8080",
    trace: "on-first-retry",
    video: "on-first-retry",
    screenshot: "only-on-failure",
  },

  // Global timeout
  timeout: 30000,
  expect: {
    timeout: 5000,
  },

  projects: [
    {
      name: "api-tests",
      testDir: "./e2e/api",
      use: {},
    },
    {
      name: "health-checks",
      testDir: "./e2e/health",
      use: {},
    },
    {
      name: "integration",
      testDir: "./e2e/integration",
      use: {},
    },
  ],

  // Web server configuration (if needed)
  // webServer: {
  //   command: 'docker-compose up',
  //   url: 'http://localhost:8080/health',
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120 * 1000,
  // },
});
