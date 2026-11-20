import { runStartupChecks } from "@/server/startup-checks";

// A failed check stops the process instead of leaving a server up that only serves errors.
try {
  runStartupChecks();
} catch (error) {
  console.error(`studyloop refused to start: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
