// Creates (if missing) and migrates the dedicated end-to-end database, so Playwright never touches dev data.
import { createDatabaseIfMissing, localDatabaseUrls, runMigrations, withDatabaseName } from "@/core";

async function main() {
  const url = process.env.DATABASE_URL ?? localDatabaseUrls.e2e;
  const name = new URL(url).pathname.slice(1);
  await createDatabaseIfMissing(withDatabaseName(url, "postgres"), name);
  await runMigrations(url);
  console.log(`E2E database ${name} ready`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
