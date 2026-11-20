import { learnerId, tables, type CoreContext, type LearnerContext } from "@/core";

let counter = 0;

/** Inserts a Learner (as Better Auth would on first sign-in) and returns a context acting as them. */
export async function actingAsNewLearner(
  ctx: CoreContext,
  overrides: Partial<typeof tables.user.$inferInsert> = {},
): Promise<LearnerContext> {
  counter += 1;
  const id = overrides.id ?? `learner-${counter}`;
  await ctx.db.insert(tables.user).values({
    id,
    name: `Learner ${counter}`,
    email: `${id}@example.test`,
    ...overrides,
  });
  return { ...ctx, learnerId: learnerId(id) };
}
