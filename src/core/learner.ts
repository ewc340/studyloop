import { eq } from "drizzle-orm";
import type { LearnerContext, LearnerId } from "./context";
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
  return { ...row, id: row.id as LearnerId };
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
  const updated = await ctx.db
    .update(user)
    .set({ timezone })
    .where(eq(user.id, ctx.learnerId))
    .returning({ id: user.id });
  if (updated.length === 0) throw new LearnerNotFoundError(ctx.learnerId);
  return getLearner(ctx);
}
