import path from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { connect } from "./client";

export const MIGRATIONS_FOLDER = path.resolve(process.cwd(), "drizzle");

export async function runMigrations(url: string): Promise<void> {
  const handle = connect(url, { max: 1 });
  try {
    await migrate(handle.db, { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await handle.close();
  }
}
