import Link from "next/link";
import { Suspense } from "react";
import { learnerToday } from "@/core";
import { requireLearnerContext } from "@/server/learner";
import { ApplicationForm } from "../../../../applications/application-form";
import { backLinkClass } from "../../../../ui";
import { loadCompanyPage } from "../../load";

async function NewApplication({ params }: { params: PageProps<"/companies/[id]/applications/new">["params"] }) {
  const { id } = await params;
  const [{ company }, today] = await Promise.all([
    loadCompanyPage(id),
    requireLearnerContext().then(learnerToday),
  ]);
  return (
    <>
      <Link href={`/companies/${company.id}`} className={backLinkClass}>
        ← <span data-private>{company.name}</span>
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">New Application</h1>
      <p className="text-zinc-700 dark:text-zinc-300">
        at <span data-private>{company.name}</span>
      </p>
      <ApplicationForm target={{ companyId: company.id }} today={today} />
    </>
  );
}

export default function NewApplicationPage(props: PageProps<"/companies/[id]/applications/new">) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-8">
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <NewApplication params={props.params} />
      </Suspense>
    </main>
  );
}
