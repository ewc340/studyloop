import Link from "next/link";
import { Suspense } from "react";
import { ApplicationList } from "../../applications/application-list";
import { backLinkClass, primaryButtonClass, secondaryButtonClass } from "../../ui";
import { loadCompanyPage } from "./load";

async function CompanyDetails({ params }: { params: PageProps<"/companies/[id]">["params"] }) {
  const { id } = await params;
  const { company, applications } = await loadCompanyPage(id);
  return (
    <>
      <header data-testid="company-header" className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-4">
          <h1 className="min-w-0 text-2xl font-semibold tracking-tight break-words">
            <span data-private>{company.name}</span>
          </h1>
          <Link href={`/companies/${company.id}/edit`} className={`${secondaryButtonClass} shrink-0 py-1.5 text-sm`}>
            Edit
          </Link>
        </div>
        {company.notes && (
          <p data-private className="whitespace-pre-line break-words text-zinc-700 dark:text-zinc-300">
            {company.notes}
          </p>
        )}
      </header>
      <section aria-labelledby="applications-heading" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <h2 id="applications-heading" className="text-lg font-semibold">
            Applications
          </h2>
          <Link href={`/companies/${company.id}/applications/new`} className={primaryButtonClass}>
            New Application
          </Link>
        </div>
        {applications.length === 0 ? (
          <p className="text-zinc-700 dark:text-zinc-300">No Applications at this Company yet.</p>
        ) : (
          <ApplicationList applications={applications} showCompany={false} testId="company-applications" />
        )}
      </section>
    </>
  );
}

export default function CompanyPageRoute(props: PageProps<"/companies/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <Link href="/companies" className={backLinkClass}>
        ← Companies
      </Link>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <CompanyDetails params={props.params} />
      </Suspense>
    </main>
  );
}
