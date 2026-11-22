import Link from "next/link";
import { Suspense } from "react";
import { backLinkClass, formatLocalDate, secondaryButtonClass } from "../../ui";
import { StatusBadge, STATUS_LABELS } from "../status";
import { StatusChangeForm } from "../status-change-form";
import { loadApplicationPage } from "./load";

async function ApplicationDetails({ params }: { params: PageProps<"/applications/[id]">["params"] }) {
  const { id } = await params;
  const { application, timeline, today } = await loadApplicationPage(id);
  return (
    <>
      <header data-testid="application-header" className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight break-words">
              <span data-private>{application.role}</span>
            </h1>
            <Link
              href={`/companies/${application.company.id}`}
              className="font-medium break-words text-blue-700 underline dark:text-blue-400"
            >
              <span data-private>{application.company.name}</span>
            </Link>
          </div>
          <Link
            href={`/applications/${application.id}/edit`}
            className={`${secondaryButtonClass} shrink-0 py-1.5 text-sm`}
          >
            Edit
          </Link>
        </div>
        <div>
          <StatusBadge status={application.status} />
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-zinc-600 dark:text-zinc-400">Applied</dt>
          <dd>{formatLocalDate(application.appliedOn)}</dd>
          {application.source && (
            <>
              <dt className="text-zinc-600 dark:text-zinc-400">Source</dt>
              <dd data-private className="break-words">
                {application.source}
              </dd>
            </>
          )}
          {application.link && (
            <>
              <dt className="text-zinc-600 dark:text-zinc-400">Link</dt>
              <dd className="min-w-0">
                <a
                  href={application.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-private
                  className="block truncate text-blue-700 underline dark:text-blue-400"
                >
                  {application.link}
                </a>
              </dd>
            </>
          )}
        </dl>
      </header>

      <section aria-labelledby="timeline-heading" className="flex flex-col gap-3">
        <h2 id="timeline-heading" className="text-lg font-semibold">
          Timeline
        </h2>
        <ol data-testid="application-timeline" className="flex flex-col gap-3 border-l border-zinc-200 pl-4 dark:border-zinc-800">
          {timeline.map((change, index) => (
            <li key={index} className="flex items-baseline justify-between gap-3">
              <span className="font-medium">{STATUS_LABELS[change.status]}</span>
              <time dateTime={change.changedOn} className="text-sm text-zinc-600 dark:text-zinc-400">
                {formatLocalDate(change.changedOn)}
              </time>
            </li>
          ))}
        </ol>
      </section>

      {/* Keyed so the form resets to fresh defaults once a change is recorded. */}
      <StatusChangeForm
        key={timeline.length}
        applicationId={application.id}
        current={application.status}
        today={today}
      />
    </>
  );
}

export default function ApplicationPageRoute(props: PageProps<"/applications/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <Link href="/applications" className={backLinkClass}>
        ← Applications
      </Link>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <ApplicationDetails params={props.params} />
      </Suspense>
    </main>
  );
}
