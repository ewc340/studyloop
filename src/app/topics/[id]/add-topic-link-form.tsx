"use client";

import { useActionState, useId, useState } from "react";
import type { Topic } from "@/core";
import { addTopicLink, type AddTopicLinkState, type TopicLinkChoice } from "../actions";
import { TopicPicker } from "../topic-picker";

/** Each way the shown Topic can relate to the picked one, phrased from the shown Topic's side. */
const choices: { value: TopicLinkChoice; label: string }[] = [
  { value: "prerequisite_of:in", label: "Has prerequisite" },
  { value: "prerequisite_of:out", label: "Is a prerequisite of" },
  { value: "part_of:out", label: "Is part of" },
  { value: "part_of:in", label: "Has part" },
  { value: "related_to", label: "Is related to" },
];

/** Links the shown Topic to another of the Learner's Topics (or one created inline). */
export function AddTopicLinkForm({ topic, topics }: { topic: Topic; topics: Topic[] }) {
  const id = useId();
  const [choice, setChoice] = useState<TopicLinkChoice>(choices[0].value);
  const [target, setTarget] = useState<Topic[]>([]);
  const [state, formAction, pending] = useActionState<AddTopicLinkState, FormData>(async (previous, formData) => {
    const result = await addTopicLink(topic.id, previous, formData);
    if (!result.error) setTarget([]);
    return result;
  }, {});

  return (
    <form
      action={formAction}
      aria-labelledby={`${id}-heading`}
      className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
    >
      <h3 id={`${id}-heading`} className="font-medium">
        Add a link
      </h3>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-link`} className="text-sm text-zinc-700 dark:text-zinc-300">
          <span data-private>{topic.name}</span>…
        </label>
        <select
          id={`${id}-link`}
          name="link"
          aria-label="Link type"
          // Controlled, so a rejected link keeps the choice (React resets uncontrolled fields after a submit).
          value={choice}
          onChange={(event) => setChoice(event.target.value as TopicLinkChoice)}
          className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2.5 text-base dark:border-zinc-700"
        >
          {choices.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </select>
      </div>
      <TopicPicker single topics={topics} value={target} onChange={setTarget} label="Linked Topic" name="topic" />
      {state.error && (
        // Messages name the Learner's Topics.
        <p role="alert" data-private className="text-sm text-red-700 dark:text-red-400">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending || target.length === 0}
        className="rounded-lg bg-zinc-900 px-4 py-2.5 text-base font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "Linking…" : "Add link"}
      </button>
    </form>
  );
}
