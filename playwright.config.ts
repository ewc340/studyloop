import { defineConfig, devices } from "@playwright/test";
import { e2eServerEnv, loadCheckoutEnv } from "./e2e/server-env";
import { E2E_LEARNER_HEADER } from "./src/server/test-auth-bypass";

loadCheckoutEnv();

const PORT = 3100;

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
    env: e2eServerEnv(PORT),
  },
});
