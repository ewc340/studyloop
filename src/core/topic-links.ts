import { and, eq, inArray, or } from "drizzle-orm";
import type { LearnerContext } from "./context";
import { topic, topicLink, topicLinkTypes } from "./db/schema";
import { toTopic, topicColumns, type Topic, type TopicId } from "./topics";

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

/** Links two of the acting Learner's Topics: `from` becomes a prerequisite of / part of / related to `to`. */
export async function linkTopics(ctx: LearnerContext, input: NewTopicLink): Promise<TopicLink> {
  const [fromTopicId, toTopicId] = storedOrder(input);
  const [row] = await ctx.db
    .insert(topicLink)
    .values({ userId: ctx.learnerId, fromTopicId, toTopicId, type: input.type })
    .returning();
  return toTopicLink(row);
}

/**
 * A related-to link has no direction, so it's stored smaller id first (lowercase UUID strings sort
 * the way Postgres orders uuids). Other links are stored as given.
 */
function storedOrder({ from, type, to }: NewTopicLink): [TopicId, TopicId] {
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
