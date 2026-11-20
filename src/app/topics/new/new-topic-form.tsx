"use client";

import { useActionState } from "react";
import { submitNewTopic, type NewTopicFormState } from "../actions";

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2.5 text-base dark:border-zinc-700";

export function NewTopicForm() {
  const [state, formAction, pending] = useActionState<NewTopicFormState, FormData>(submitNewTopic, {});

  return (
    // After a rejected submit React resets the fields to their defaults: what was sent.
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="topic-name" className="font-medium">
          Name
        </label>
        <input
          id="topic-name"
          name="name"
          required
          autoComplete="off"
          defaultValue={state.name}
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "topic-error" : undefined}
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="topic-description" className="font-medium">
          Description <span className="font-normal text-zinc-500">(optional)</span>
        </label>
        <textarea
          id="topic-description"
          name="description"
          rows={3}
          defaultValue={state.description}
          className={inputClass}
        />
      </div>
      {state.error && (
        <p id="topic-error" role="alert" className="text-sm text-red-700 dark:text-red-400">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-4 py-2.5 text-base font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "Creating…" : "Create Topic"}
      </button>
    </form>
  );
}
