import { databaseUrl, runMigrations } from "@/core";
import { runStartupChecks } from "@/server/startup-checks";

/**
 * Startup checks, plus (in development only) applying pending migrations, so testing a branch
 * that adds a migration just works. Production migrates as an explicit deploy step.
 * Any failure stops the process instead of leaving a server up that only serves errors.
 */
export async function onServerStart(): Promise<void> {
  try {
    runStartupChecks();
    if (process.env.NODE_ENV === "development") {
      await runMigrations(databaseUrl());
    }
  } catch (error) {
    console.error(`studyloop refused to start: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}
