import Link from "next/link";
import type { Topic, TopicNeighbour, TopicNeighbours } from "@/core";
import { removeTopicLink } from "../actions";
import { AddTopicLinkForm } from "./add-topic-link-form";

const groups: { key: keyof TopicNeighbours; heading: string }[] = [
  { key: "prerequisites", heading: "Prerequisites" },
  { key: "dependents", heading: "Prerequisite of" },
  { key: "parents", heading: "Part of" },
  { key: "parts", heading: "Parts" },
  { key: "related", heading: "Related" },
];

/** A Topic's linked Topics, grouped by link type and direction, with a form to add more. */
export function TopicLinks({ topic, links, topics }: { topic: Topic; links: TopicNeighbours; topics: Topic[] }) {
  const shown = groups.filter((group) => links[group.key].length > 0);
  return (
    <section aria-labelledby="links-heading" className="flex flex-col gap-3">
      <h2 id="links-heading" className="text-lg font-semibold">
        Linked Topics
      </h2>
      {shown.length === 0 ? (
        <p className="text-zinc-700 dark:text-zinc-300">
          No linked Topics yet. Link prerequisites, parts and related Topics to build your Topic graph.
        </p>
      ) : (
        shown.map(({ key, heading }) => (
          <section key={key} aria-label={heading} className="flex flex-col gap-1">
            <h3 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{heading}</h3>
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {links[key].map((neighbour) => (
                <NeighbourItem key={neighbour.linkId} neighbour={neighbour} />
              ))}
            </ul>
          </section>
        ))
      )}
      <AddTopicLinkForm topic={topic} topics={topics.filter((t) => t.id !== topic.id)} />
    </section>
  );
}

function NeighbourItem({ neighbour: { linkId, topic } }: { neighbour: TopicNeighbour }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <Link href={`/topics/${topic.id}`} className="min-w-0 flex-1 py-2.5 font-medium break-words">
        <span data-private>{topic.name}</span>
      </Link>
      <form action={removeTopicLink}>
        <input type="hidden" name="link" value={linkId} />
        <button
          type="submit"
          aria-label={`Remove link to ${topic.name}`}
          className="rounded-lg px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          Remove
        </button>
      </form>
    </li>
  );
}
