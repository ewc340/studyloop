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

/** Identifies a Learner. Branded so a random string can't be passed where a Learner is meant. */
export type LearnerId = string & { readonly __brand: "LearnerId" };

export function learnerId(id: string): LearnerId {
  return id as LearnerId;
}

/**
 * Context for operations acting on behalf of a Learner. Such operations only ever read and write
 * the acting Learner's records, and never take another Learner's id as a parameter.
 */
export interface LearnerContext extends CoreContext {
  learnerId: LearnerId;
}
