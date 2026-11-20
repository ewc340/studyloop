// The e2e dev server's environment, shared by playwright.config.ts and ralph/screenshots.ts.
import { localDatabaseUrls } from "../src/core";

/** Loads this checkout's .env (e.g. E2E_DATABASE_URL). Variables already set in the environment win. */
export function loadCheckoutEnv(): void {
  try {
    process.loadEnvFile(".env");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

/** Environment for the e2e dev server on `port`: this checkout's e2e database, the test auth bypass,
 * its own build folder, and issue reporting against an in-memory tracker instead of GitHub. */
export function e2eServerEnv(port: number): Record<string, string> {
  return {
    DATABASE_URL: process.env.E2E_DATABASE_URL ?? localDatabaseUrls.e2e,
    E2E_AUTH_BYPASS: "1",
    BETTER_AUTH_URL: `http://localhost:${port}`,
    NEXT_DIST_DIR: ".next-e2e",
    ISSUE_REPORTING_GITHUB_TOKEN: "e2e-not-a-token",
    ISSUE_REPORTING_OWNER_EMAIL: "e2e-owner@e2e.test",
    ISSUE_REPORTING_FAKE_TRACKER: "1",
  };
}
