import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getTopicPage, topicId, TopicNotFoundError, type TopicPage } from "@/core";
import { requireLearnerContext } from "@/server/learner";
import { TopicTimeline } from "./topic-timeline";

async function loadTopicPage(id: string): Promise<TopicPage> {
  try {
    return await getTopicPage(await requireLearnerContext(), topicId(id));
  } catch (error) {
    if (error instanceof TopicNotFoundError) notFound();
    throw error;
  }
}

async function TopicDetails({ params }: { params: PageProps<"/topics/[id]">["params"] }) {
  const { id } = await params;
  const { topic, timeline } = await loadTopicPage(id);
  return (
    <>
      <header data-testid="topic-header" className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight break-words">{topic.name}</h1>
        {topic.description && (
          <p className="whitespace-pre-line text-zinc-700 dark:text-zinc-300">{topic.description}</p>
        )}
      </header>
      <TopicTimeline entries={timeline} />
    </>
  );
}

export default function TopicPageRoute(props: PageProps<"/topics/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <Link href="/topics" className="text-sm text-zinc-600 dark:text-zinc-400">
        ← Topics
      </Link>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <TopicDetails params={props.params} />
      </Suspense>
    </main>
  );
}
