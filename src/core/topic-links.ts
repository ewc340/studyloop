import { and, eq, inArray, or, sql } from "drizzle-orm";
import type { LearnerContext } from "./context";
import type { Db } from "./db/client";
import { topic, topicLink, topicLinkTypes } from "./db/schema";
import { isUuid, toTopic, topicColumns, TopicNotFoundError, type Topic, type TopicId } from "./topics";

/** Identifies a Topic Link. */
export type TopicLinkId = string & { readonly __brand: "TopicLinkId" };

/** `from` is a prerequisite of / part of / related to `to`. */
export type TopicLinkType = (typeof topicLinkTypes)[number];

export interface NewTopicLink {
  from: TopicId;
  type: TopicLinkType;
  to: TopicId;
}

export interface TopicLink {
  id: TopicLinkId;
  from: TopicId;
  type: TopicLinkType;
  to: TopicId;
}

/** A Topic linked to the one whose page is shown, with the link that connects them (e.g. to remove it). */
export interface TopicNeighbour {
  linkId: TopicLinkId;
  topic: Topic;
}

/** A Topic's neighbours in the Topic graph, grouped by link type and direction, each group by name. */
export interface TopicNeighbours {
  /** Topics that are a prerequisite of this one. */
  prerequisites: TopicNeighbour[];
  /** Topics this one is a prerequisite of. */
  dependents: TopicNeighbour[];
  /** Topics that are part of this one. */
  parts: TopicNeighbour[];
  /** Topics this one is part of. */
  parents: TopicNeighbour[];
  /** Topics related to this one, in either direction. */
  related: TopicNeighbour[];
}

/** The link can never be made, e.g. it links a Topic to itself. */
export class InvalidTopicLinkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidTopicLinkError";
  }
}

/** The two Topics are already linked this way (related-to links count either way round). */
export class DuplicateTopicLinkError extends Error {
  constructor(from: Topic, type: TopicLinkType, to: Topic) {
    super(`"${from.name}" is already ${describe(type)} "${to.name}"`);
    this.name = "DuplicateTopicLinkError";
  }
}

function describe(type: TopicLinkType): string {
  return { prerequisite_of: "a prerequisite of", part_of: "part of", related_to: "related to" }[type];
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Links two of the acting Learner's Topics: `from` becomes a prerequisite of / part of / related to `to`.
 * Throws TopicNotFoundError if either isn't the Learner's Topic, InvalidTopicLinkError for a self-link,
 * and DuplicateTopicLinkError if they're already linked this way.
 */
export async function linkTopics(ctx: LearnerContext, input: NewTopicLink): Promise<TopicLink> {
  if (!topicLinkTypes.includes(input.type)) throw new InvalidTopicLinkError(`Unknown Topic Link type "${input.type}"`);
  if (input.from === input.to) throw new InvalidTopicLinkError("A Topic can't be linked to itself");

  return ctx.db.transaction(async (tx) => {
    // One Learner's link changes run one at a time, so concurrent links can't together form a cycle.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`topic_link:${ctx.learnerId}`}, 0))`);
    const from = await learnerTopic(tx, ctx, input.from);
    const to = await learnerTopic(tx, ctx, input.to);
    if (from.id === to.id) throw new InvalidTopicLinkError("A Topic can't be linked to itself");

    const [fromTopicId, toTopicId] = storedOrder(from.id, input.type, to.id);
    const [row] = await tx
      .insert(topicLink)
      .values({ userId: ctx.learnerId, fromTopicId, toTopicId, type: input.type })
      .onConflictDoNothing()
      .returning();
    if (!row) throw new DuplicateTopicLinkError(from, input.type, to);
    return toTopicLink(row);
  });
}

async function learnerTopic(tx: Tx, ctx: LearnerContext, id: TopicId): Promise<Topic> {
  if (!isUuid(id)) throw new TopicNotFoundError(id);
  const [row] = await tx
    .select(topicColumns)
    .from(topic)
    .where(and(eq(topic.id, id), eq(topic.userId, ctx.learnerId)));
  if (!row) throw new TopicNotFoundError(id);
  return toTopic(row);
}

/**
 * A related-to link has no direction, so it's stored smaller id first (Postgres returns lowercase
 * UUID strings, which sort the way it orders uuids). Other links are stored as given.
 */
function storedOrder(from: TopicId, type: TopicLinkType, to: TopicId): [TopicId, TopicId] {
  return type === "related_to" && to < from ? [to, from] : [from, to];
}

function toTopicLink(row: typeof topicLink.$inferSelect): TopicLink {
  return {
    id: row.id as TopicLinkId,
    from: row.fromTopicId as TopicId,
    type: row.type,
    to: row.toTopicId as TopicId,
  };
}

/** The Topic's neighbours. The caller has already checked the Topic belongs to the acting Learner. */
export async function topicNeighbours(ctx: LearnerContext, id: TopicId): Promise<TopicNeighbours> {
  const links = await ctx.db
    .select()
    .from(topicLink)
    .where(
      and(eq(topicLink.userId, ctx.learnerId), or(eq(topicLink.fromTopicId, id), eq(topicLink.toTopicId, id))),
    );
  const otherIds = links.map((l) => (l.fromTopicId === id ? l.toTopicId : l.fromTopicId));
  const others =
    otherIds.length === 0
      ? []
      : await ctx.db
          .select(topicColumns)
          .from(topic)
          .where(and(eq(topic.userId, ctx.learnerId), inArray(topic.id, otherIds)));
  const byId = new Map(others.map((row) => [row.id, toTopic(row)]));

  const neighbours: TopicNeighbours = { prerequisites: [], dependents: [], parts: [], parents: [], related: [] };
  for (const link of links) {
    const outgoing = link.fromTopicId === id;
    const other = byId.get(outgoing ? link.toTopicId : link.fromTopicId);
    if (!other) continue;
    const group =
      link.type === "related_to"
        ? neighbours.related
        : link.type === "prerequisite_of"
          ? outgoing
            ? neighbours.dependents
            : neighbours.prerequisites
          : outgoing
            ? neighbours.parents
            : neighbours.parts;
    group.push({ linkId: link.id as TopicLinkId, topic: other });
  }
  for (const group of Object.values(neighbours)) group.sort(byTopicName);
  return neighbours;
}

function byTopicName(a: TopicNeighbour, b: TopicNeighbour): number {
  return a.topic.name.localeCompare(b.topic.name, undefined, { sensitivity: "base" });
}
