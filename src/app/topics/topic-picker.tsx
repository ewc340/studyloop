"use client";

import { useId, useState, useTransition, type KeyboardEvent } from "react";
import type { Topic } from "@/core";
import { createTopicInline } from "./actions";

const MAX_SUGGESTIONS = 8;

export interface TopicPickerProps {
  /** The Learner's Topics to choose from (e.g. `findTopics(ctx)` on the server). */
  topics: Topic[];
  /** The selected Topics. */
  value: Topic[];
  onChange(value: Topic[]): void;
  label?: string;
  /** When set, each selected Topic's id is submitted with the enclosing form under this field name. */
  name?: string;
  /** Picks one Topic instead of several: picking another replaces it, and the suggestions close. */
  single?: boolean;
}

type Option = { type: "topic"; topic: Topic } | { type: "create"; name: string };

/**
 * Picks Topics for tagging: type to find existing Topics, or create a new one inline so tagging never
 * blocks logging. Picking a name the Learner already uses selects that Topic instead of failing.
 */
export function TopicPicker({ topics, value, onChange, label = "Topics", name, single = false }: TopicPickerProps) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [created, setCreated] = useState<Topic[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, startCreating] = useTransition();

  const known = [...topics, ...created.filter((c) => !topics.some((t) => t.id === c.id))];
  const selectedIds = new Set(value.map((t) => t.id));
  const trimmed = query.trim();
  const needle = trimmed.toLowerCase();
  const matches = known
    .filter((t) => !selectedIds.has(t.id) && t.name.toLowerCase().includes(needle))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
    .slice(0, MAX_SUGGESTIONS);
  const exists = known.some((t) => t.name.toLowerCase() === needle);
  const options: Option[] = [
    ...matches.map((topic): Option => ({ type: "topic", topic })),
    ...(trimmed && !exists ? [{ type: "create", name: trimmed } as Option] : []),
  ];
  const expanded = open && options.length > 0;
  const active = Math.min(activeIndex, options.length - 1);

  function select(topic: Topic) {
    if (single) {
      onChange([topic]);
      // Uncover whatever follows the picker (e.g. the form's submit button).
      setOpen(false);
    } else if (!selectedIds.has(topic.id)) {
      onChange([...value, topic]);
    }
    setQuery("");
    setActiveIndex(0);
    setError(null);
  }

  function choose(option: Option) {
    if (option.type === "topic") return select(option.topic);
    startCreating(async () => {
      const result = await createTopicInline(option.name);
      if ("error" in result) return setError(result.error);
      setCreated((previous) => [...previous, result.topic]);
      select(result.topic);
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, options.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      // Never submit the enclosing form from the picker's text box.
      event.preventDefault();
      if (expanded && !creating) choose(options[active]);
    } else if (event.key === "Escape") {
      setOpen(false);
    } else if (event.key === "Backspace" && query === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={`${id}-input`} className="font-medium">
        {label}
      </label>
      {value.length > 0 && (
        <ul aria-label={`Selected ${label}`} className="flex flex-wrap gap-2">
          {value.map((topic) => (
            <li
              key={topic.id}
              className="flex items-center gap-1 rounded-full bg-zinc-100 py-1 pr-1 pl-3 text-sm dark:bg-zinc-800"
            >
              <span data-private>{topic.name}</span>
              <button
                type="button"
                aria-label={`Remove ${topic.name}`}
                onClick={() => onChange(value.filter((t) => t.id !== topic.id))}
                className="flex size-7 items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                ×
              </button>
              {name && <input type="hidden" name={name} value={topic.id} />}
            </li>
          ))}
        </ul>
      )}
      <div className="relative">
        <input
          id={`${id}-input`}
          role="combobox"
          aria-expanded={expanded}
          aria-controls={`${id}-listbox`}
          aria-autocomplete="list"
          aria-activedescendant={expanded ? `${id}-option-${active}` : undefined}
          autoComplete="off"
          value={query}
          data-private
          placeholder="Find or create a Topic"
          disabled={creating}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
            setOpen(true);
            setError(null);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2.5 text-base disabled:opacity-60 dark:border-zinc-700"
        />
        {expanded && (
          <ul
            id={`${id}-listbox`}
            role="listbox"
            aria-label={label}
            className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
          >
            {options.map((option, index) => (
              <li
                key={option.type === "topic" ? option.topic.id : "create"}
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={index === active}
                // Keep focus in the text box so the list doesn't close before the click lands.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option)}
                onMouseEnter={() => setActiveIndex(index)}
                className={`cursor-pointer px-3 py-2.5 ${index === active ? "bg-zinc-100 dark:bg-zinc-800" : ""}`}
              >
                {option.type === "topic" ? (
                  <span data-private>{option.topic.name}</span>
                ) : (
                  <>
                    Create “<span data-private>{option.name}</span>”
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {creating && <p className="text-sm text-zinc-600 dark:text-zinc-400">Creating…</p>}
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
