import Link from "next/link";
import { Suspense } from "react";
import { backLinkClass } from "../../../ui";
import { ApplicationForm } from "../../application-form";
import { loadApplicationPage } from "../load";

async function EditApplication({ params }: { params: PageProps<"/applications/[id]/edit">["params"] }) {
  const { id } = await params;
  const { application, today } = await loadApplicationPage(id);
  return (
    <>
      <Link href={`/applications/${application.id}`} className={backLinkClass}>
        ← <span data-private>{application.role}</span>
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Edit Application</h1>
      <p className="text-zinc-700 dark:text-zinc-300">
        at <span data-private>{application.company.name}</span>
      </p>
      <ApplicationForm target={{ applicationId: application.id }} application={application} today={today} />
    </>
  );
}

export default function EditApplicationPage(props: PageProps<"/applications/[id]/edit">) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-8">
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <EditApplication params={props.params} />
      </Suspense>
    </main>
  );
}
