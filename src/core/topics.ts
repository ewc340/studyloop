import { and, asc, eq, ilike, sql } from "drizzle-orm";
import type { LearnerContext } from "./context";
import { topic } from "./db/schema";
import { topicNeighbours, type TopicNeighbours } from "./topic-links";

/** Identifies a Topic. Branded so other ids can't be passed where a Topic is meant. */
export type TopicId = string & { readonly __brand: "TopicId" };

export function topicId(id: string): TopicId {
  return id as TopicId;
}

export interface Topic {
  id: TopicId;
  name: string;
  description: string | null;
}

export interface NewTopic {
  name: string;
  description?: string | null;
}

/**
 * One record on a Topic's timeline: a union with one variant per record type tagged with the Topic
 * (Daily Entries, Resources, Gaps, Struggle Reflections, Study Items), each shaped
 * `{ kind: "<record type>"; occurredAt: Date; ... }`. No record type can be tagged yet, so it has no variants.
 */
export type TopicTimelineEntry = never;

export interface TopicPage {
  topic: Topic;
  /** Everything tagged with the Topic, oldest first. */
  timeline: TopicTimelineEntry[];
  /** The Topics linked to this one, grouped by link type and direction. */
  links: TopicNeighbours;
}

/** No Topic with this id belongs to the acting Learner. */
export class TopicNotFoundError extends Error {
  constructor(id: string) {
    super(`Topic ${id} not found`);
    this.name = "TopicNotFoundError";
  }
}

export class InvalidTopicError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidTopicError";
  }
}

/** The Learner already has a Topic with this name (ignoring case). */
export class DuplicateTopicNameError extends Error {
  constructor(readonly existing: Topic) {
    super(`A Topic named "${existing.name}" already exists`);
    this.name = "DuplicateTopicNameError";
  }
}

export const topicColumns = { id: topic.id, name: topic.name, description: topic.description };

export function toTopic(row: { id: string; name: string; description: string | null }): Topic {
  return { ...row, id: topicId(row.id) };
}

/** Creates a Topic for the acting Learner. Throws DuplicateTopicNameError if the name is taken, ignoring case. */
export async function createTopic(ctx: LearnerContext, input: NewTopic): Promise<Topic> {
  const name = input.name.trim();
  if (!name) throw new InvalidTopicError("A Topic needs a name");
  const description = input.description?.trim() || null;
  // The name index is the only unique constraint a new row can hit (ids are random UUIDs).
  // Retry once in case the clashing Topic disappears between the insert and the lookup.
  for (let attempt = 0; attempt < 2; attempt++) {
    const [row] = await ctx.db
      .insert(topic)
      .values({ userId: ctx.learnerId, name, description })
      .onConflictDoNothing()
      .returning(topicColumns);
    if (row) return toTopic(row);

    const existing = await topicNamed(ctx, name);
    if (existing) throw new DuplicateTopicNameError(existing);
  }
  throw new Error(`Could not create Topic "${name}"`);
}

/**
 * The Learner's Topic with this name (ignoring case), created if they have none. For pickers that
 * create Topics inline while tagging, so tagging never blocks logging.
 */
export async function findOrCreateTopic(ctx: LearnerContext, name: string): Promise<Topic> {
  try {
    return await createTopic(ctx, { name });
  } catch (error) {
    if (error instanceof DuplicateTopicNameError) return error.existing;
    throw error;
  }
}

async function topicNamed(ctx: LearnerContext, name: string): Promise<Topic | undefined> {
  const [row] = await ctx.db
    .select(topicColumns)
    .from(topic)
    .where(and(eq(topic.userId, ctx.learnerId), eq(sql`lower(${topic.name})`, sql`lower(${name})`)));
  return row && toTopic(row);
}

export interface TopicSearch {
  /** Matches any part of a Topic's name, ignoring case. Blank matches every Topic. */
  query?: string;
}

/** The acting Learner's Topics whose names match the query, alphabetically (ignoring case). */
export async function findTopics(ctx: LearnerContext, search: TopicSearch = {}): Promise<Topic[]> {
  const query = search.query?.trim();
  const rows = await ctx.db
    .select(topicColumns)
    .from(topic)
    .where(
      and(
        eq(topic.userId, ctx.learnerId),
        query ? ilike(topic.name, `%${escapeLikePattern(query)}%`) : undefined,
      ),
    )
    .orderBy(asc(sql`lower(${topic.name})`), asc(topic.name));
  return rows.map(toTopic);
}

/** Makes LIKE's wildcards, and its default escape character, match themselves. */
function escapeLikePattern(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Gathers one record type's timeline entries for a Topic, already scoped to the acting Learner.
 * Each record type that can be tagged with a Topic adds its variant to TopicTimelineEntry and its
 * source to `timelineSources`.
 */
type TimelineSource = (ctx: LearnerContext, id: TopicId) => Promise<TopicTimelineEntry[]>;

const timelineSources: TimelineSource[] = [];

/** What every TopicTimelineEntry variant has in common. */
interface TimelineEntryShape {
  kind: string;
  occurredAt: Date;
}

function byOccurredAt(a: TimelineEntryShape, b: TimelineEntryShape): number {
  return a.occurredAt.getTime() - b.occurredAt.getTime();
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The acting Learner's Topic page: the Topic, its timeline (oldest first) and its linked Topics. */
export async function getTopicPage(ctx: LearnerContext, id: TopicId): Promise<TopicPage> {
  if (!UUID.test(id)) throw new TopicNotFoundError(id);
  const [row] = await ctx.db
    .select(topicColumns)
    .from(topic)
    .where(and(eq(topic.id, id), eq(topic.userId, ctx.learnerId)));
  if (!row) throw new TopicNotFoundError(id);

  const [entries, links] = await Promise.all([
    Promise.all(timelineSources.map((source) => source(ctx, id))),
    topicNeighbours(ctx, id),
  ]);
  const timeline = entries.flat().sort(byOccurredAt);
  return { topic: toTopic(row), timeline, links };
}
