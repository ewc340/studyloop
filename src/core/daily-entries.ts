import { and, asc, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import type { LearnerContext } from "./context";
import { dailyEntry, dailyEntryTopic, topic } from "./db/schema";
import { topicId, type Topic, type TopicId } from "./topics";

/** A calendar date in the Learner's own timezone, as `YYYY-MM-DD`. */
export type CalendarDate = string;

/** The Learner's 1–5 self-rating of a Topic. */
export type Confidence = 1 | 2 | 3 | 4 | 5;

export interface DailyEntryTopic {
  topic: Topic;
  confidence: Confidence;
}

export interface DailyEntry {
  date: CalendarDate;
  /** What the Learner worked on and learned. */
  body: string;
  /** The tagged Topics, alphabetically, each with the Learner's Confidence in it on this date. */
  topics: DailyEntryTopic[];
}

export interface DailyEntryInput {
  date: CalendarDate;
  body: string;
  topics: { topicId: TopicId; confidence: number }[];
}

/** Writes the acting Learner's Daily Entry for a date, replacing what the entry for that date said before. */
export async function saveDailyEntry(ctx: LearnerContext, input: DailyEntryInput): Promise<DailyEntry> {
  await ctx.db.transaction(async (tx) => {
    const [row] = await tx
      .insert(dailyEntry)
      .values({ userId: ctx.learnerId, date: input.date, body: input.body })
      .onConflictDoUpdate({ target: [dailyEntry.userId, dailyEntry.date], set: { body: input.body } })
      .returning({ id: dailyEntry.id });
    await tx.delete(dailyEntryTopic).where(eq(dailyEntryTopic.dailyEntryId, row.id));
    if (input.topics.length > 0) {
      await tx
        .insert(dailyEntryTopic)
        .values(input.topics.map((t) => ({ dailyEntryId: row.id, topicId: t.topicId, confidence: t.confidence })));
    }
  });
  const saved = await getDailyEntry(ctx, input.date);
  if (!saved) throw new Error(`Could not save the Daily Entry for ${input.date}`);
  return saved;
}

/** The acting Learner's Daily Entry for a date, or null if they wrote none. */
export async function getDailyEntry(ctx: LearnerContext, date: CalendarDate): Promise<DailyEntry | null> {
  const [entry] = await loadDailyEntries(ctx, eq(dailyEntry.date, date));
  return entry ?? null;
}

/** The acting Learner's Daily Entries, newest date first. */
export function listDailyEntries(ctx: LearnerContext): Promise<DailyEntry[]> {
  return loadDailyEntries(ctx);
}

async function loadDailyEntries(ctx: LearnerContext, where?: SQL): Promise<DailyEntry[]> {
  const entries = await ctx.db
    .select({ id: dailyEntry.id, date: dailyEntry.date, body: dailyEntry.body })
    .from(dailyEntry)
    .where(and(eq(dailyEntry.userId, ctx.learnerId), where))
    .orderBy(desc(dailyEntry.date));
  if (entries.length === 0) return [];

  const tags = await ctx.db
    .select({
      dailyEntryId: dailyEntryTopic.dailyEntryId,
      id: topic.id,
      name: topic.name,
      description: topic.description,
      confidence: dailyEntryTopic.confidence,
    })
    .from(dailyEntryTopic)
    .innerJoin(topic, eq(topic.id, dailyEntryTopic.topicId))
    .where(
      inArray(
        dailyEntryTopic.dailyEntryId,
        entries.map((e) => e.id),
      ),
    )
    .orderBy(asc(sql`lower(${topic.name})`), asc(topic.name));

  return entries.map((entry) => ({
    date: entry.date,
    body: entry.body,
    topics: tags
      .filter((t) => t.dailyEntryId === entry.id)
      .map((t) => ({
        topic: { id: topicId(t.id), name: t.name, description: t.description },
        confidence: t.confidence as Confidence,
      })),
  }));
}
