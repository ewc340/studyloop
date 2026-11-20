import { ensureLearner, type CoreContext, type LearnerContext, type NewLearner } from "@/core";

let counter = 0;

/** Creates a fresh Learner and returns a context acting as them. */
export function actingAsNewLearner(ctx: CoreContext, overrides: Partial<NewLearner> = {}): Promise<LearnerContext> {
  counter += 1;
  const id = overrides.id ?? `learner-${counter}`;
  return ensureLearner(ctx, { id, name: `Learner ${counter}`, email: `${id}@example.test`, ...overrides });
}
