import Link from "next/link";
import { Suspense } from "react";
import { getToday, listDailyEntries } from "@/core";
import { requireLearnerContext } from "@/server/learner";
import { openDailyEntry } from "./actions";
import { formatCalendarDate } from "./format";

async function DailyEntryList() {
  const ctx = await requireLearnerContext();
  const [today, entries] = await Promise.all([getToday(ctx), listDailyEntries(ctx)]);
  const wroteToday = entries[0]?.date === today;

  return (
    <>
      <Link
        href={`/entries/${today}`}
        className="rounded-lg bg-zinc-900 px-4 py-2.5 text-center text-base font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        {wroteToday ? "Add to today’s entry" : "Write today’s entry"}
      </Link>

      <form action={openDailyEntry} className="flex items-end gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label htmlFor="entry-date" className="text-sm font-medium">
            Another date
          </label>
          <input
            id="entry-date"
            type="date"
            name="date"
            required
            max={today}
            defaultValue={today}
            className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2.5 text-base dark:border-zinc-700"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg border border-zinc-300 px-4 py-2.5 text-base font-medium dark:border-zinc-700"
        >
          Open
        </button>
      </form>

      {entries.length === 0 ? (
        <p className="text-zinc-700 dark:text-zinc-300">
          No Daily Entries yet. Write down what you worked on today, tag its Topics and rate your Confidence.
        </p>
      ) : (
        <ol data-testid="entry-list" className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {entries.map((entry) => (
            <li key={entry.date} id={`entry-${entry.date}`} className="flex flex-col gap-2 py-4">
              <Link href={`/entries/${entry.date}`} className="font-medium text-blue-700 underline dark:text-blue-400">
                {entry.date === today ? `Today · ${formatCalendarDate(entry.date)}` : formatCalendarDate(entry.date)}
              </Link>
              {entry.body && (
                <p data-private className="line-clamp-4 whitespace-pre-line text-zinc-700 dark:text-zinc-300">
                  {entry.body}
                </p>
              )}
              {entry.topics.length > 0 && (
                <ul aria-label="Topics" className="flex flex-wrap gap-2">
                  {entry.topics.map(({ topic, confidence }) => (
                    <li key={topic.id}>
                      <Link
                        href={`/topics/${topic.id}`}
                        className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-sm dark:bg-zinc-800"
                      >
                        <span data-private>{topic.name}</span>
                        <span data-private className="text-zinc-600 dark:text-zinc-400">
                          <span className="sr-only">Confidence </span>
                          {confidence}/5
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

export default function DailyEntriesPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-8">
      <Link href="/" className="text-sm text-zinc-600 dark:text-zinc-400">
        ← Home
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Daily Entries</h1>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <DailyEntryList />
      </Suspense>
    </main>
  );
}
