import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { localDatabaseUrls } from "./local";
import * as schema from "./schema";

export type Db = ReturnType<typeof drizzle<typeof schema>>;

export interface DbHandle {
  db: Db;
  close(): Promise<void>;
}

export function connect(url: string, options: { max?: number } = {}): DbHandle {
  const sql = postgres(url, { max: options.max ?? 10, onnotice: () => {} });
  return { db: drizzle(sql, { schema }), close: () => sql.end() };
}

export function databaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  if (env.DATABASE_URL) return env.DATABASE_URL;
  if (env.NODE_ENV === "production") throw new Error("DATABASE_URL must be set in production");
  return localDatabaseUrls.dev;
}
