import { databaseUrl, runMigrations } from "@/core";
import { runStartupChecks } from "@/server/startup-checks";

/**
 * Startup checks, plus applying pending migrations when explicitly opted in for local development
 * (`npm run dev` sets DEV_AUTO_MIGRATE=1), so testing a branch that adds a migration just works.
 * Production never auto-migrates: it migrates as an explicit deploy step.
 * Any failure stops the process instead of leaving a server up that only serves errors.
 */
export async function onServerStart(): Promise<void> {
  try {
    runStartupChecks();
    if (process.env.DEV_AUTO_MIGRATE === "1" && process.env.NODE_ENV === "development") {
      await runMigrations(databaseUrl());
    }
  } catch (error) {
    console.error(`studyloop refused to start: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}
