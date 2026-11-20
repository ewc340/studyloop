import Link from "next/link";
import { NewTopicForm } from "./new-topic-form";

export default function NewTopicPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-8">
      <Link href="/topics" className="text-sm text-zinc-600 dark:text-zinc-400">
        ← Topics
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">New Topic</h1>
      {/* Kept out of any Suspense boundary so a rejected submit shows its error even before hydration. */}
      <NewTopicForm />
    </main>
  );
}
