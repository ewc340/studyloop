// Creates (if missing) and migrates the dedicated end-to-end database, so Playwright never touches dev data.
import postgres from "postgres";
import { runMigrations } from "@/core/db/migrate";

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "postgres://studyloop:studyloop@localhost:5432/studyloop_e2e");
  const name = url.pathname.slice(1);
  const adminUrl = new URL(url);
  adminUrl.pathname = "/postgres";

  const admin = postgres(adminUrl.toString(), { max: 1, onnotice: () => {} });
  const exists = await admin`select 1 from pg_database where datname = ${name}`;
  if (exists.length === 0) await admin.unsafe(`create database ${name}`);
  await admin.end();

  await runMigrations(url.toString());
  console.log(`E2E database ${name} ready`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
