import { databaseUrl, runMigrations } from "@/core";

async function main() {
  const url = databaseUrl();
  await runMigrations(url);
  console.log(`Migrations applied to ${new URL(url).pathname.slice(1)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
