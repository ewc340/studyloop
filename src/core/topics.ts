import { and, eq } from "drizzle-orm";
import type { LearnerContext } from "./context";
import { topic } from "./db/schema";

/** Identifies a Topic. Branded so other ids can't be passed where a Topic is meant. */
export type TopicId = string & { readonly __brand: "TopicId" };

export interface Topic {
  id: TopicId;
  name: string;
  description: string | null;
}

export interface NewTopic {
  name: string;
  description?: string | null;
}

export interface TopicPage {
  topic: Topic;
}

export class InvalidTopicError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidTopicError";
  }
}

const topicColumns = { id: topic.id, name: topic.name, description: topic.description };

function toTopic(row: { id: string; name: string; description: string | null }): Topic {
  return { ...row, id: row.id as TopicId };
}

/** Creates a Topic for the acting Learner. */
export async function createTopic(ctx: LearnerContext, input: NewTopic): Promise<Topic> {
  const name = input.name.trim();
  if (!name) throw new InvalidTopicError("A Topic needs a name");
  const description = input.description?.trim() || null;
  const [row] = await ctx.db
    .insert(topic)
    .values({ userId: ctx.learnerId, name, description })
    .returning(topicColumns);
  return toTopic(row);
}

/** The acting Learner's Topic page. */
export async function getTopicPage(ctx: LearnerContext, id: TopicId): Promise<TopicPage> {
  const [row] = await ctx.db
    .select(topicColumns)
    .from(topic)
    .where(and(eq(topic.id, id), eq(topic.userId, ctx.learnerId)));
  return { topic: toTopic(row) };
}
