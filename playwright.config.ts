import { defineConfig, devices } from "@playwright/test";
import { localDatabaseUrls } from "./src/core";

const PORT = 3100;
const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? localDatabaseUrls.e2e;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
    // Acts as this Learner via the test-only auth bypass (src/server/test-auth-bypass.ts).
    extraHTTPHeaders: { "x-e2e-learner": "e2e-learner" },
  },
  // Phone-sized viewport first: the app is used right after interviews, on a phone.
  projects: [{ name: "mobile-chrome", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: `npx tsx scripts/prepare-e2e-db.ts && npx next dev --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { DATABASE_URL: E2E_DATABASE_URL, E2E_AUTH_BYPASS: "1", BETTER_AUTH_URL: `http://localhost:${PORT}` },
  },
});
