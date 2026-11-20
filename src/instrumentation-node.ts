import { createDatabaseIfMissing, databaseUrl, runMigrations, withDatabaseName } from "@/core";
import { runStartupChecks } from "@/server/startup-checks";

/**
 * Startup checks, plus (when explicitly opted in for local development: `npm run dev` sets
 * DEV_AUTO_MIGRATE=1) creating this checkout's dev database if it doesn't exist yet and applying
 * pending migrations, so a fresh checkout or a branch that adds a migration just works.
 * Production never auto-migrates: it migrates as an explicit deploy step.
 * Any failure stops the process instead of leaving a server up that only serves errors.
 */
export async function onServerStart(): Promise<void> {
  try {
    runStartupChecks();
    if (process.env.DEV_AUTO_MIGRATE === "1" && process.env.NODE_ENV === "development") {
      const url = databaseUrl();
      await createDatabaseIfMissing(withDatabaseName(url, "postgres"), new URL(url).pathname.slice(1));
      await runMigrations(url);
    }
  } catch (error) {
    console.error(`studyloop refused to start: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}
