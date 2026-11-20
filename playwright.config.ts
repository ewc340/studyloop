import { defineConfig, devices } from "@playwright/test";
import { localDatabaseUrls } from "./src/core";
import { E2E_LEARNER_HEADER } from "./src/server/test-auth-bypass";

// Per-checkout settings such as E2E_DATABASE_URL live in .env; existing environment variables win.
try {
  process.loadEnvFile(".env");
} catch {
  // No .env: defaults apply.
}

const PORT = 3100;
const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? localDatabaseUrls.e2e;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  // CI retries once so a flaky test's trace is recorded, but a test that only passes on retry still
  // fails the run: flakiness must be fixed, not hidden.
  retries: process.env.CI ? 1 : 0,
  failOnFlakyTests: !!process.env.CI,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
    // Acts as this Learner via the test-only auth bypass (src/server/test-auth-bypass.ts).
    extraHTTPHeaders: { [E2E_LEARNER_HEADER]: "e2e-learner" },
  },
  // Phone-sized viewport first: the app is used right after interviews, on a phone.
  projects: [{ name: "mobile-chrome", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: `npx tsx scripts/prepare-e2e-db.ts && npx next dev --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      DATABASE_URL: E2E_DATABASE_URL,
      E2E_AUTH_BYPASS: "1",
      BETTER_AUTH_URL: `http://localhost:${PORT}`,
      NEXT_DIST_DIR: ".next-e2e",
      // Issue reporting for the e2e owner, against an in-memory tracker instead of GitHub.
      ISSUE_REPORTING_GITHUB_TOKEN: "e2e-not-a-token",
      ISSUE_REPORTING_OWNER_EMAIL: "e2e-owner@e2e.test",
      ISSUE_REPORTING_FAKE_TRACKER: "1",
    },
  },
});
