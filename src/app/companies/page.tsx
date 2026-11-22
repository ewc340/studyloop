import Link from "next/link";
import { Suspense } from "react";
import { findCompanies } from "@/core";
import { requireLearnerContext } from "@/server/learner";
import { backLinkClass, primaryButtonClass } from "../ui";

async function CompanyList() {
  const companies = await findCompanies(await requireLearnerContext());
  if (companies.length === 0) {
    return (
      <p className="text-zinc-700 dark:text-zinc-300">
        No Companies yet. Record one you’ve applied to or talked with.
      </p>
    );
  }
  return (
    <ul data-testid="company-list" className="divide-y divide-zinc-200 dark:divide-zinc-800">
      {companies.map((company) => (
        <li key={company.id}>
          <Link href={`/companies/${company.id}`} className="block py-3">
            <span data-private className="block font-medium break-words">
              {company.name}
            </span>
            {company.notes && (
              <span data-private className="block truncate text-sm text-zinc-600 dark:text-zinc-400">
                {company.notes}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function CompaniesPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-8">
      <Link href="/" className={backLinkClass}>
        ← Home
      </Link>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Companies</h1>
        <Link href="/companies/new" className={primaryButtonClass}>
          New Company
        </Link>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <CompanyList />
      </Suspense>
    </main>
  );
}
