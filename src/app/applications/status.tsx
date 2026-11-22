import type { ApplicationStatus } from "@/core";

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  applied: "Applied",
  screening: "Screening",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  ghosted: "Ghosted",
};

/** Every status in pipeline order (the labels' order). Usable in client components, unlike the core's list. */
export const STATUSES = Object.keys(STATUS_LABELS) as ApplicationStatus[];

export function isStatus(text: unknown): text is ApplicationStatus {
  return typeof text === "string" && (STATUSES as string[]).includes(text);
}

const badgeColors: Record<ApplicationStatus, string> = {
  applied: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
  screening: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  interviewing: "bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200",
  offer: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  rejected: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
  withdrawn: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  ghosted: "bg-stone-200 text-stone-800 dark:bg-stone-800 dark:text-stone-200",
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span className={`inline-block shrink-0 rounded-full px-2.5 py-0.5 text-sm font-medium ${badgeColors[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
