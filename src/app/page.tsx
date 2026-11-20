import { connection } from "next/server";
import { Suspense } from "react";
import { getHealth, getLearner } from "@/core";
import { coreContext } from "@/server/core";
import { requireLearnerContext } from "@/server/learner";
import { SignOutButton } from "./sign-out-button";
import { TimezoneSync } from "./timezone-sync";

async function LearnerBar() {
  const learner = await getLearner(await requireLearnerContext());
  return (
    <div className="flex items-center justify-between gap-4">
      <p data-testid="signed-in-as" className="text-sm text-zinc-700 dark:text-zinc-300">
        Signed in as {learner.name}
      </p>
      <SignOutButton />
      <TimezoneSync current={learner.timezone} />
    </div>
  );
}

async function HealthStatus() {
  await connection();
  const health = await getHealth(coreContext());
  return (
    <p data-testid="health" className="text-sm text-zinc-600 dark:text-zinc-400">
      Database: {health.database} · {health.migrationsApplied} migration
      {health.migrationsApplied === 1 ? "" : "s"} applied
    </p>
  );
}

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-12">
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <LearnerBar />
      </Suspense>
      <h1 className="text-3xl font-semibold tracking-tight">studyloop</h1>
      <p className="text-zinc-700 dark:text-zinc-300">
        Track what you learn, connect topics, and close the gaps your interviews expose.
      </p>
      <Suspense fallback={<p className="text-sm text-zinc-500">Checking database…</p>}>
        <HealthStatus />
      </Suspense>
    </main>
  );
}
