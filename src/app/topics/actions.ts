"use server";

import { redirect } from "next/navigation";
import { createTopic, DuplicateTopicNameError, findOrCreateTopic, InvalidTopicError, type Topic } from "@/core";
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
