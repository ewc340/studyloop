// Thin adapter: the only place the Next.js app builds core contexts.
import { connect, databaseUrl, systemClock, type CoreContext, type Db, type DbHandle } from "@/core";

const globalForDb = globalThis as unknown as { studyloopDb?: DbHandle };

/** One connection pool per server process, reused across dev hot reloads. */
export function sharedDb(): Db {
  globalForDb.studyloopDb ??= connect(databaseUrl());
  return globalForDb.studyloopDb.db;
}

export function coreContext(): CoreContext {
  return { db: sharedDb(), clock: systemClock };
}
