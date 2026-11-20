import { sql } from "drizzle-orm";
import type { CoreContext } from "./context";

export interface Health {
  database: "ok";
  migrationsApplied: number;
  checkedAt: Date;
}

/** Proves the core can reach Postgres and that migrations ran. */
export async function getHealth(ctx: CoreContext): Promise<Health> {
  const rows = await ctx.db.execute<{ count: number }>(
    sql`select count(*)::int as count from drizzle.__drizzle_migrations`,
  );
  return { database: "ok", migrationsApplied: rows[0].count, checkedAt: ctx.clock.now() };
}
