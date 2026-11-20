"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  FutureDailyEntryError,
  InvalidConfidenceError,
  InvalidDailyEntryError,
  isCalendarDate,
  saveDailyEntry,
  topicId,
  TopicNotFoundError,
} from "@/core";
import { requireLearnerContext } from "@/server/learner";
import { confidenceField, TOPIC_FIELD } from "./fields";

export interface DailyEntryFormState {
  error?: string;
}

/** The Daily Entry form: writes (or updates) the entry for `date` and returns to the list of entries. */
export async function submitDailyEntry(
  date: string,
  _previous: DailyEntryFormState,
  formData: FormData,
): Promise<DailyEntryFormState> {
  const body = String(formData.get("body") ?? "");
  const ids = formData.getAll(TOPIC_FIELD).map(String);
  const topics = [];
  for (const id of ids) {
    const confidence = formData.get(confidenceField(id));
    if (confidence === null || confidence === "") return { error: "Rate your Confidence in each tagged Topic" };
    topics.push({ topicId: topicId(id), confidence: Number(confidence) });
  }

  try {
    await saveDailyEntry(await requireLearnerContext(), { date, body, topics });
  } catch (error) {
    if (
      error instanceof InvalidDailyEntryError ||
      error instanceof InvalidConfidenceError ||
      error instanceof FutureDailyEntryError
    ) {
      return { error: error.message };
    }
    if (error instanceof TopicNotFoundError) return { error: "One of the tagged Topics no longer exists" };
    throw error;
  }
  // Pages kept alive across navigations (Activity) must not show the entry as it was before saving.
  revalidatePath("/entries", "layout");
  revalidatePath("/topics", "layout");
  redirect(`/entries#entry-${date}`);
}

/** "Open date" on the list of entries: goes to the Daily Entry for the chosen date, to write or backfill it. */
export async function openDailyEntry(formData: FormData): Promise<void> {
  const date = String(formData.get("date") ?? "");
  redirect(isCalendarDate(date) ? `/entries/${date}` : "/entries");
}
