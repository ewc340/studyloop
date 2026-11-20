import type { ReactNode } from "react";
import type { TopicTimelineEntry } from "@/core";

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
  const unhandled: never = entry;
  return unhandled;
}
