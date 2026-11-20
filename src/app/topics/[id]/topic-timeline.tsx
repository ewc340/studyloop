import Link from "next/link";
import type { ReactNode } from "react";
import type { TopicTimelineEntry } from "@/core";
import { formatCalendarDate } from "../../entries/format";

/** A Topic's timeline, oldest first. Each record type tagged with the Topic renders through TimelineItem. */
export function TopicTimeline({ entries }: { entries: TopicTimelineEntry[] }) {
  return (
    <section aria-labelledby="timeline-heading" className="flex flex-col gap-3">
      <h2 id="timeline-heading" className="text-lg font-semibold">
        Timeline
      </h2>
      {entries.length === 0 ? (
        <p data-testid="timeline-empty" className="text-zinc-700 dark:text-zinc-300">
          Nothing here yet. Daily Entries, Resources, Gaps, Struggle Reflections and Study Items tagged with this
          Topic will show up here.
        </p>
      ) : (
        <ol className="flex flex-col gap-3 border-l border-zinc-200 pl-4 dark:border-zinc-800">
          {entries.map((entry, index) => (
            <li key={index}>
              <TimelineItem entry={entry} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** Renders one timeline entry. Add a case per TopicTimelineEntry variant; the compiler flags any left out. */
function TimelineItem({ entry }: { entry: TopicTimelineEntry }): ReactNode {
  switch (entry.kind) {
    case "dailyEntry":
      return (
        <article className="flex flex-col gap-1">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Daily Entry ·{" "}
            <Link href={`/entries/${entry.date}`} className="font-medium text-blue-700 underline dark:text-blue-400">
              {formatCalendarDate(entry.date)}
            </Link>{" "}
            · Confidence <span data-private>{entry.confidence}/5</span>
          </p>
          {entry.body && (
            <p data-private className="line-clamp-4 whitespace-pre-line text-zinc-800 dark:text-zinc-200">
              {entry.body}
            </p>
          )}
        </article>
      );
    default: {
      const unhandled: never = entry.kind;
      return unhandled;
    }
  }
}
