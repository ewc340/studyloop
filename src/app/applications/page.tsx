import Link from "next/link";
import { Suspense } from "react";
import { findApplications, type Application, type ApplicationStatus } from "@/core";
import { requireLearnerContext } from "@/server/learner";
import { backLinkClass } from "../ui";
import { ApplicationList } from "./application-list";
import { isStatus, STATUS_LABELS, STATUSES } from "./status";

const chipClass = "inline-block rounded-full border px-3 py-1.5 text-sm font-medium whitespace-nowrap";
const chipSelected = "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900";
const chipIdle = "border-zinc-300 dark:border-zinc-700";

function StatusFilter({ selected, counts }: { selected?: ApplicationStatus; counts: Map<ApplicationStatus, number> }) {
  const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
  const chips: { status?: ApplicationStatus; label: string; count: number }[] = [
    { label: "All", count: total },
    ...STATUSES.map((status) => ({ status, label: STATUS_LABELS[status], count: counts.get(status) ?? 0 })),
  ];
  return (
    <nav aria-label="Filter by status">
      <ul className="flex flex-wrap gap-2">
        {chips.map(({ status, label, count }) => {
          const isSelected = status === selected;
          return (
            <li key={label}>
              <Link
                href={status ? `/applications?status=${status}` : "/applications"}
                aria-current={isSelected ? "page" : undefined}
                className={`${chipClass} ${isSelected ? chipSelected : chipIdle}`}
              >
                {label} <span className="tabular-nums opacity-70">{count}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

async function Applications({ searchParams }: { searchParams: PageProps<"/applications">["searchParams"] }) {
  const { status } = await searchParams;
  const selected = isStatus(status) ? status : undefined;
  const all = await findApplications(await requireLearnerContext());

  const byStatus = new Map<ApplicationStatus, Application[]>();
  for (const application of all) {
    byStatus.set(application.status, [...(byStatus.get(application.status) ?? []), application]);
  }
  const counts = new Map([...byStatus].map(([s, applications]) => [s, applications.length]));
  const filtered = selected && (byStatus.get(selected) ?? []);

  if (all.length === 0) {
    return (
      <p className="text-zinc-700 dark:text-zinc-300">
        No Applications yet. Open a{" "}
        <Link href="/companies" className="font-medium text-blue-700 underline dark:text-blue-400">
          Company
        </Link>{" "}
        to record one.
      </p>
    );
  }

  return (
    <>
      <StatusFilter selected={selected} counts={counts} />
      {filtered ? (
        filtered.length === 0 ? (
          <p className="text-zinc-700 dark:text-zinc-300">No Applications with status {STATUS_LABELS[selected!]}.</p>
        ) : (
          <ApplicationList applications={filtered} testId="application-list" />
        )
      ) : (
        STATUSES.filter((s) => byStatus.has(s)).map((s) => (
          <section key={s} aria-labelledby={`status-${s}`} className="flex flex-col">
            <h2 id={`status-${s}`} className="text-lg font-semibold">
              {STATUS_LABELS[s]}
            </h2>
            <ApplicationList applications={byStatus.get(s)!} showStatus={false} testId={`applications-${s}`} />
          </section>
        ))
      )}
    </>
  );
}

export default function ApplicationsPage(props: PageProps<"/applications">) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-8">
      <Link href="/" className={backLinkClass}>
        ← Home
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Applications</h1>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <Applications searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
