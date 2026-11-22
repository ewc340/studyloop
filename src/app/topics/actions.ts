"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import {
  createTopic,
  DuplicateTopicLinkError,
  DuplicateTopicNameError,
  findOrCreateTopic,
  InvalidTopicError,
  InvalidTopicLinkError,
  linkTopics,
  topicId,
  TopicLinkCycleError,
  topicLinkId,
  TopicLinkNotFoundError,
  TopicNotFoundError,
  unlinkTopics,
  type Topic,
  type TopicLinkType,
} from "@/core";
import { requireLearnerContext } from "@/server/learner";

export interface NewTopicFormState {
  error?: string;
  /** Echoed back so a rejected form keeps what the Learner typed. */
  name?: string;
  description?: string;
}

/** The New Topic form: creates the Topic and opens its Topic page. */
export async function submitNewTopic(_previous: NewTopicFormState, formData: FormData): Promise<NewTopicFormState> {
  const name = String(formData.get("name") ?? "");
  const description = String(formData.get("description") ?? "");
  let topic: Topic;
  try {
    topic = await createTopic(await requireLearnerContext(), { name, description });
  } catch (error) {
    if (error instanceof DuplicateTopicNameError || error instanceof InvalidTopicError) {
      return { error: error.message, name, description };
    }
    throw error;
  }
  redirect(`/topics/${topic.id}`);
}

/** "Create “…”" from a Topic search with no matches: creates the Topic (or finds the one with that name) and opens it. */
export async function createSearchedTopic(formData: FormData): Promise<void> {
  const result = await createTopicInline(String(formData.get("name") ?? ""));
  redirect("topic" in result ? `/topics/${result.topic.id}` : "/topics/new");
}

export type InlineTopicResult = { topic: Topic } | { error: string };

/** Creates a Topic from a Topic picker, or returns the Learner's Topic that already has that name. */
export async function createTopicInline(name: string): Promise<InlineTopicResult> {
  try {
    return { topic: await findOrCreateTopic(await requireLearnerContext(), name) };
  } catch (error) {
    if (error instanceof InvalidTopicError) return { error: error.message };
    throw error;
  }
}

/**
 * How the Topic whose page is shown relates to the Topic picked in the Add link form. "out" links
 * run from the shown Topic to the picked one, "in" links the other way. A related-to link has no
 * direction, so it has one choice.
 */
const linkChoices = {
  "prerequisite_of:out": { type: "prerequisite_of", direction: "out" },
  "prerequisite_of:in": { type: "prerequisite_of", direction: "in" },
  "part_of:out": { type: "part_of", direction: "out" },
  "part_of:in": { type: "part_of", direction: "in" },
  "related_to": { type: "related_to", direction: "out" },
} as const satisfies Record<string, { type: TopicLinkType; direction: "out" | "in" }>;

export type TopicLinkChoice = keyof typeof linkChoices;

function isLinkChoice(value: string): value is TopicLinkChoice {
  return Object.hasOwn(linkChoices, value);
}

export interface AddTopicLinkState {
  error?: string;
}

/** The Add link form on a Topic page: links the shown Topic and the picked one, then refreshes the page. */
export async function addTopicLink(
  shownTopicId: string,
  _previous: AddTopicLinkState,
  formData: FormData,
): Promise<AddTopicLinkState> {
  const choice = String(formData.get("link") ?? "");
  const other = String(formData.get("topic") ?? "");
  if (!isLinkChoice(choice)) return { error: "Choose how the Topics are linked" };
  if (!other) return { error: "Choose a Topic to link" };

  const { type, direction } = linkChoices[choice];
  const [from, to] = direction === "out" ? [shownTopicId, other] : [other, shownTopicId];
  try {
    await linkTopics(await requireLearnerContext(), {
      from: topicId(from),
      type,
      to: topicId(to),
    });
  } catch (error) {
    if (
      error instanceof TopicLinkCycleError ||
      error instanceof DuplicateTopicLinkError ||
      error instanceof InvalidTopicLinkError
    ) {
      return { error: error.message };
    }
    if (error instanceof TopicNotFoundError) return { error: "That Topic no longer exists" };
    throw error;
  }
  refresh();
  return {};
}

/** A link's Remove button on a Topic page. A link that's already gone needs no removing. */
export async function removeTopicLink(formData: FormData): Promise<void> {
  try {
    await unlinkTopics(await requireLearnerContext(), topicLinkId(String(formData.get("link") ?? "")));
  } catch (error) {
    if (!(error instanceof TopicLinkNotFoundError)) throw error;
  }
  refresh();
}
