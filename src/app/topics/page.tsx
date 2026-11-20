import Link from "next/link";
import { Suspense } from "react";
import { findTopics } from "@/core";
import { requireLearnerContext } from "@/server/learner";
import { createSearchedTopic } from "./actions";

async function TopicList({ searchParams }: { searchParams: PageProps<"/topics">["searchParams"] }) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q : "";
  const topics = await findTopics(await requireLearnerContext(), { query });

  return (
    <>
      <form role="search" action="/topics" className="flex gap-2">
        <label htmlFor="topic-search" className="sr-only">
          Search Topics
        </label>
        <input
          id="topic-search"
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search Topics"
          className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-2.5 text-base dark:border-zinc-700"
        />
        <button
          type="submit"
          className="rounded-lg border border-zinc-300 px-4 py-2.5 text-base font-medium dark:border-zinc-700"
        >
          Search
        </button>
      </form>

      {topics.length > 0 ? (
        <ul data-testid="topic-list" className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {topics.map((topic) => (
            <li key={topic.id}>
              <Link href={`/topics/${topic.id}`} className="block py-3">
                <span className="block font-medium">{topic.name}</span>
                {topic.description && (
                  <span className="block truncate text-sm text-zinc-600 dark:text-zinc-400">{topic.description}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      ) : query.trim() ? (
        <div className="flex flex-col items-start gap-2 text-zinc-700 dark:text-zinc-300">
          <p>No Topics match “{query.trim()}”.</p>
          <form action={createSearchedTopic}>
            <input type="hidden" name="name" value={query.trim()} />
            <button type="submit" className="font-medium text-blue-700 underline dark:text-blue-400">
              Create “{query.trim()}”
            </button>
          </form>
        </div>
      ) : (
        <p className="text-zinc-700 dark:text-zinc-300">No Topics yet. Create one for something you’re learning.</p>
      )}
    </>
  );
}

export default function TopicsPage(props: PageProps<"/topics">) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-8">
      <Link href="/" className="text-sm text-zinc-600 dark:text-zinc-400">
        ← Home
      </Link>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Topics</h1>
        <Link
          href="/topics/new"
          className="rounded-lg bg-zinc-900 px-4 py-2.5 text-base font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          New Topic
        </Link>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <TopicList searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
