import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, inject } from "vitest";
import { connect, type CoreContext, type DbHandle } from "@/core";
import { fakeClock, type FakeClock } from "./fake-clock";

export interface CoreTestContext {
  ctx: CoreContext;
  clock: FakeClock;
}

/**
 * Gives each test a CoreContext on the run's real Postgres, with a fake Clock.
 * Every table in the public schema is emptied before each test.
 */
export function useTestContext(): CoreTestContext {
  let handle: DbHandle;
  const clock = fakeClock();
  const core = { clock } as CoreTestContext;

  beforeAll(() => {
    handle = connect(inject("databaseUrl"), { max: 2 });
    core.ctx = { db: handle.db, clock };
  });

  beforeEach(async () => {
    clock.set("2026-01-01T12:00:00Z");
    const tables = await handle.db.execute<{ name: string }>(
      sql`select quote_ident(tablename) as name from pg_tables where schemaname = 'public'`,
    );
    if (tables.length > 0) {
      await handle.db.execute(
        sql.raw(`truncate ${tables.map((r) => r.name).join(", ")} restart identity cascade`),
      );
    }
  });

  afterAll(async () => {
    await handle.close();
  });

  return core;
}
