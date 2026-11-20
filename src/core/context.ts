import type { Clock } from "./clock";
import type { Db } from "./db/client";

/**
 * Everything a core operation needs from the outside world.
 * Adapters (Next.js, tests, scripts) build one and pass it in; core never reaches for globals.
 */
export interface CoreContext {
  db: Db;
  clock: Clock;
}
