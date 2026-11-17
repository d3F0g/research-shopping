import { defineConfig, devices } from "@playwright/test";

const apiPort = process.env.PLAYWRIGHT_API_PORT ?? "3163";
const webPort = process.env.PLAYWRIGHT_WEB_PORT ?? "5273";
const baseURL = `http://127.0.0.1:${webPort}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  workers: 1,
  reporter: "list",
  timeout: 30_000,
  expect: { timeout: 6_000 },
  outputDir: "artifacts/playwright-results",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      API_PORT: apiPort,
      VITE_API_PORT: apiPort,
      WEB_PORT: webPort,
      EXA_RESEARCH_ENABLED: "false",
    },
  },
});
