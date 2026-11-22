"use client";

import { useActionState, useId } from "react";
import type { ApplicationStatus, LocalDate } from "@/core";
import { inputClass, primaryButtonClass } from "../ui";
import { submitStatusChange, type StatusChangeFormState } from "./actions";
import { STATUS_LABELS, STATUSES } from "./status";

/** Records a dated status change on an Application. */
export function StatusChangeForm({
  applicationId,
  current,
  today,
}: {
  applicationId: string;
  current: ApplicationStatus;
  /** Today in the Learner's timezone: the default date, and the latest allowed. */
  today: LocalDate;
}) {
  const id = useId();
  const [state, formAction, pending] = useActionState<StatusChangeFormState, FormData>(
    submitStatusChange.bind(null, applicationId),
    { status: nextStatus(current), changedOn: today },
  );

  return (
    <form action={formAction} aria-labelledby={`${id}-status-change-heading`} className="flex flex-col gap-3">
      <h2 id={`${id}-status-change-heading`} className="text-lg font-semibold">
        Change status
      </h2>
      <div className="flex gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label htmlFor={`${id}-status-change-status`} className="font-medium">
            New status
          </label>
          <select
            id={`${id}-status-change-status`}
            name="status"
            defaultValue={state.status}
            className={`${inputClass} h-11.5`}
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label htmlFor={`${id}-status-change-date`} className="font-medium">
            On
          </label>
          <input
            id={`${id}-status-change-date`}
            name="changedOn"
            type="date"
            required
            max={today}
            defaultValue={state.changedOn}
            aria-invalid={state.error ? true : undefined}
            aria-describedby={state.error ? `${id}-status-change-error` : undefined}
            className={`${inputClass} h-11.5`}
          />
        </div>
      </div>
      {state.error && (
        <p id={`${id}-status-change-error`} role="alert" className="text-sm text-red-700 dark:text-red-400">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Recording…" : "Record status change"}
      </button>
    </form>
  );
}

/** The status an Application most likely moves to next, as the form's default. */
function nextStatus(current: ApplicationStatus): ApplicationStatus {
  const next: Partial<Record<ApplicationStatus, ApplicationStatus>> = {
    applied: "screening",
    screening: "interviewing",
    interviewing: "offer",
  };
  return next[current] ?? current;
}
