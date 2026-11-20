import { eq } from "drizzle-orm";
import { learnerId, type CoreContext, type LearnerContext, type LearnerId } from "./context";
import { user } from "./db/schema";

export interface Learner {
  id: LearnerId;
  name: string;
  email: string;
  image: string | null;
  timezone: string;
}

export class LearnerNotFoundError extends Error {
  constructor(id: LearnerId) {
    super(`Learner ${id} not found`);
    this.name = "LearnerNotFoundError";
  }
}

export class InvalidTimezoneError extends Error {
  constructor(timezone: string) {
    super(`Not a valid IANA timezone: ${timezone}`);
    this.name = "InvalidTimezoneError";
  }
}

const learnerColumns = {
  id: user.id,
  name: user.name,
  email: user.email,
  image: user.image,
  timezone: user.timezone,
};

/** The acting Learner. */
export async function getLearner(ctx: LearnerContext): Promise<Learner> {
  const [row] = await ctx.db.select(learnerColumns).from(user).where(eq(user.id, ctx.learnerId));
  if (!row) throw new LearnerNotFoundError(ctx.learnerId);
  return toLearner(row);
}

function toLearner(row: Omit<Learner, "id"> & { id: string }): Learner {
  return { ...row, id: learnerId(row.id) };
}

export interface NewLearner {
  id: string;
  name: string;
  email: string;
}

/**
 * Creates the Learner if they don't exist yet and returns a context acting as them.
 * In production Better Auth creates Learners on first sign-in; this is for the e2e bypass, tests and seed data.
 */
export async function ensureLearner(ctx: CoreContext, learner: NewLearner): Promise<LearnerContext> {
  await ctx.db.insert(user).values(learner).onConflictDoNothing();
  return { ...ctx, learnerId: learnerId(learner.id) };
}

function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/** Sets the acting Learner's timezone, which decides where their days begin and end. */
export async function setLearnerTimezone(ctx: LearnerContext, timezone: string): Promise<Learner> {
  if (!isValidTimezone(timezone)) throw new InvalidTimezoneError(timezone);
  const [row] = await ctx.db
    .update(user)
    .set({ timezone })
    .where(eq(user.id, ctx.learnerId))
    .returning(learnerColumns);
  if (!row) throw new LearnerNotFoundError(ctx.learnerId);
  return toLearner(row);
}
