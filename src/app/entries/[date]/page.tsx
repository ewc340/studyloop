import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { findTopics, getDailyEntry, getToday, isCalendarDate, isFutureDate } from "@/core";
import { requireLearnerContext } from "@/server/learner";
import { submitDailyEntry } from "../actions";
import { formatCalendarDate } from "../format";
import { DailyEntryForm } from "./daily-entry-form";

async function DailyEntryEditor({ params }: { params: PageProps<"/entries/[date]">["params"] }) {
  const { date } = await params;
  if (!isCalendarDate(date)) notFound();
  const ctx = await requireLearnerContext();
  const [today, entry, topics] = await Promise.all([getToday(ctx), getDailyEntry(ctx, date), findTopics(ctx)]);

  const heading = (
    <h1 className="text-2xl font-semibold tracking-tight">
      {date === today ? "Today" : formatCalendarDate(date)}
      {date === today && (
        <span className="block text-base font-normal text-zinc-600 dark:text-zinc-400">
          {formatCalendarDate(date)}
        </span>
      )}
    </h1>
  );

  if (isFutureDate(date, today)) {
    return (
      <>
        {heading}
        <p className="text-zinc-700 dark:text-zinc-300">
          This date hasn’t happened yet. A Daily Entry records what you worked on, so write it on the day or after.
        </p>
        <Link href={`/entries/${today}`} className="font-medium text-blue-700 underline dark:text-blue-400">
          Write today’s entry
        </Link>
      </>
    );
  }

  return (
    <>
      {heading}
      {/* Keyed by what was saved, so the form starts afresh from the saved entry rather than a stale draft. */}
      <DailyEntryForm
        key={JSON.stringify(entry)}
        topics={topics}
        entry={entry}
        action={submitDailyEntry.bind(null, date)}
      />
    </>
  );
}

export default function DailyEntryPage(props: PageProps<"/entries/[date]">) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-8">
      <Link href="/entries" className="text-sm text-zinc-600 dark:text-zinc-400">
        ← Daily Entries
      </Link>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <DailyEntryEditor params={props.params} />
      </Suspense>
    </main>
  );
}
