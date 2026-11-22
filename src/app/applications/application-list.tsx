import Link from "next/link";
import type { Application } from "@/core";
import { formatLocalDate } from "../ui";
import { StatusBadge } from "./status";

/** Applications as tappable rows: role, Company, current status and since when. */
export function ApplicationList({
  applications,
  showCompany = true,
  showStatus = true,
  testId,
}: {
  applications: Application[];
  showCompany?: boolean;
  /** Off where the list sits under its status's heading. */
  showStatus?: boolean;
  testId?: string;
}) {
  return (
    <ul data-testid={testId} className="divide-y divide-zinc-200 dark:divide-zinc-800">
      {applications.map((application) => (
        <li key={application.id}>
          <Link href={`/applications/${application.id}`} className="flex items-start justify-between gap-3 py-3">
            <span className="flex min-w-0 flex-col">
              <span data-private className="font-medium break-words">
                {application.role}
              </span>
              {showCompany && (
                <span data-private className="text-sm break-words text-zinc-600 dark:text-zinc-400">
                  {application.company.name}
                </span>
              )}
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                since {formatLocalDate(application.statusChangedOn)}
              </span>
            </span>
            {showStatus && <StatusBadge status={application.status} />}
          </Link>
        </li>
      ))}
    </ul>
  );
}
