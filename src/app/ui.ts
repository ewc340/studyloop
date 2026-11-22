// Class names and formatting shared by the app's pages and forms.
import type { LocalDate } from "@/core";

export const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2.5 text-base dark:border-zinc-700";

export const primaryButtonClass =
  "rounded-lg bg-zinc-900 px-4 py-2.5 text-center text-base font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900";

export const secondaryButtonClass =
  "rounded-lg border border-zinc-300 px-4 py-2.5 text-center text-base font-medium dark:border-zinc-700";

export const backLinkClass = "text-sm text-zinc-600 dark:text-zinc-400";

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** A Learner's calendar date for reading, e.g. "5 Dec 2025". */
export function formatLocalDate(date: LocalDate): string {
  return dateFormat.format(new Date(`${date}T00:00:00Z`));
}
