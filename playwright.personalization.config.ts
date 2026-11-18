import { defineConfig, devices } from "@playwright/test";
const apiPort = process.env.API_PORT!;
const webPort = process.env.WEB_PORT!;
const baseURL = `http://127.0.0.1:${webPort}`;
export default defineConfig({
  testDir: "./tests/personalization-e2e",
  testMatch: "*.spec.ts",
  workers: 1,
  fullyParallel: false,
  timeout: 90_000,
  expect: { timeout: 8000 },
  reporter: "list",
  outputDir: "artifacts/personalization/playwright",
  use: { baseURL, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command:
      'npx concurrently -k "node --import tsx tests/personalization-e2e/server.ts" "npm run dev:web"',
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      API_PORT: apiPort,
      VITE_API_PORT: apiPort,
      WEB_PORT: webPort,
      EXA_RESEARCH_ENABLED: "false",
      NODE_ENV: "test",
    },
  },
});
