"use client";

import { useActionState, useState } from "react";
import type { Confidence, DailyEntry, Topic } from "@/core";
import { TopicPicker } from "../../topics/topic-picker";
import type { DailyEntryFormState } from "../actions";
import { confidenceField, TOPIC_FIELD } from "../fields";

const CONFIDENCES: Confidence[] = [1, 2, 3, 4, 5];

export interface DailyEntryFormProps {
  /** The Learner's Topics, to tag. */
  topics: Topic[];
  /** The entry already written for this date, if any: the form edits it. */
  entry: DailyEntry | null;
  /** Saves the entry for this form's date. */
  action(previous: DailyEntryFormState, formData: FormData): Promise<DailyEntryFormState>;
}

export function DailyEntryForm({ topics, entry, action }: DailyEntryFormProps) {
  const [state, formAction, pending] = useActionState<DailyEntryFormState, FormData>(action, {});
  // Controlled, so a rejected submit keeps everything the Learner entered.
  const [body, setBody] = useState(entry?.body ?? "");
  const [tagged, setTagged] = useState<Topic[]>(entry?.topics.map((t) => t.topic) ?? []);
  const [confidences, setConfidences] = useState<Record<string, Confidence>>(
    Object.fromEntries(entry?.topics.map((t) => [t.topic.id, t.confidence]) ?? []),
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <label htmlFor="entry-body" className="font-medium">
          What did you work on and learn?
        </label>
        <textarea
          id="entry-body"
          name="body"
          rows={6}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          data-private
          className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2.5 text-base dark:border-zinc-700"
        />
      </div>

      <TopicPicker topics={topics} value={tagged} onChange={setTagged} name={TOPIC_FIELD} />

      {tagged.length > 0 && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Rate your Confidence in each Topic: 1 is lost, 5 is solid.
          </p>
          {tagged.map((topic) => (
            <fieldset key={topic.id} className="flex flex-col">
              <legend className="mb-2 font-medium">
                <span className="sr-only">Confidence in </span>
                <span data-private>{topic.name}</span>
              </legend>
              <div data-private className="grid grid-cols-5 gap-2">
                {CONFIDENCES.map((value) => (
                  <label
                    key={value}
                    className="flex h-11 cursor-pointer items-center justify-center rounded-lg border border-zinc-300 text-base font-medium has-checked:border-zinc-900 has-checked:bg-zinc-900 has-checked:text-white has-focus-visible:outline-2 has-focus-visible:outline-blue-600 dark:border-zinc-700 dark:has-checked:border-zinc-100 dark:has-checked:bg-zinc-100 dark:has-checked:text-zinc-900"
                  >
                    <input
                      type="radio"
                      name={confidenceField(topic.id)}
                      value={value}
                      required
                      checked={confidences[topic.id] === value}
                      onChange={() => setConfidences((previous) => ({ ...previous, [topic.id]: value }))}
                      className="sr-only"
                    />
                    {value}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      )}

      {state.error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-4 py-2.5 text-base font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "Saving…" : "Save Daily Entry"}
      </button>
    </form>
  );
}
