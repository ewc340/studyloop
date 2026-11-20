import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, inject } from "vitest";
import { fakeClock, type CoreContext, type FakeClock } from "@/core";
import { connect, type DbHandle } from "@/core/db/client";

export interface TestContext {
  ctx: CoreContext;
  clock: FakeClock;
}

/**
 * Gives each test a CoreContext on the run's real Postgres, with a fake Clock.
 * Every table in the public schema is emptied before each test.
 */
export function useTestContext(): TestContext {
  let handle: DbHandle;
  const clock = fakeClock();
  const t = { clock } as TestContext;

  beforeAll(() => {
    handle = connect(inject("databaseUrl"), { max: 2 });
    t.ctx = { db: handle.db, clock };
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

  return t;
}
