// Thin adapter: the only place the Next.js app builds a CoreContext.
import { systemClock, type CoreContext } from "@/core";
import { connect, databaseUrl, type DbHandle } from "@/core/db/client";

const globalForDb = globalThis as unknown as { studyloopDb?: DbHandle };

function db() {
  // Reuse one pool across hot reloads in dev.
  globalForDb.studyloopDb ??= connect(databaseUrl());
  return globalForDb.studyloopDb.db;
}

export function coreContext(): CoreContext {
  return { db: db(), clock: systemClock };
}
