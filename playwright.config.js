// playwright.config.js
// Playwright E2E test configuration for Planar Atlas.
// Tests serve index.html via a local static file server and run against Chromium.

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:8090",
    headless: true,
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
  webServer: {
    command: "npx serve . -l 8090 --no-clipboard",
    port: 8090,
    reuseExistingServer: !process.env.CI,
    timeout: 10_000,
  },
});
