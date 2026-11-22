"use client";

import { useActionState, useId } from "react";
import type { Application, LocalDate } from "@/core";
import { inputClass, primaryButtonClass } from "../ui";
import { submitApplication, type ApplicationFormState, type ApplicationFormTarget } from "./actions";

/** Records a new Application under a Company, or edits `application` when given. */
export function ApplicationForm({
  target,
  application,
  today,
}: {
  target: ApplicationFormTarget;
  application?: Application;
  /** Today in the Learner's timezone: the latest applied date, and the default for a new Application. */
  today: LocalDate;
}) {
  const id = useId();
  const [state, formAction, pending] = useActionState<ApplicationFormState, FormData>(
    submitApplication.bind(null, target),
    {
      values: {
        role: application?.role ?? "",
        appliedOn: application?.appliedOn ?? today,
        source: application?.source ?? "",
        link: application?.link ?? "",
      },
    },
  );
  const errorProps = state.error
    ? ({ "aria-invalid": true, "aria-describedby": `${id}-application-error` } as const)
    : {};

  return (
    // After a rejected submit React resets the fields to their defaults: what was sent.
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-application-role`} className="font-medium">
          Role
        </label>
        <input
          id={`${id}-application-role`}
          name="role"
          required
          autoComplete="off"
          defaultValue={state.values?.role}
          data-private
          {...errorProps}
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-application-applied-on`} className="font-medium">
          Applied on
        </label>
        <input
          id={`${id}-application-applied-on`}
          name="appliedOn"
          type="date"
          required
          max={today}
          defaultValue={state.values?.appliedOn}
          {...errorProps}
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-application-source`} className="font-medium">
          Source <span className="font-normal text-zinc-500">(optional)</span>
        </label>
        <input
          id={`${id}-application-source`}
          name="source"
          autoComplete="off"
          placeholder="Job board, referral…"
          defaultValue={state.values?.source}
          data-private
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-application-link`} className="font-medium">
          Link <span className="font-normal text-zinc-500">(optional)</span>
        </label>
        <input
          id={`${id}-application-link`}
          name="link"
          type="url"
          inputMode="url"
          autoComplete="off"
          placeholder="https://"
          defaultValue={state.values?.link}
          data-private
          {...errorProps}
          className={inputClass}
        />
      </div>
      {state.error && (
        <p id={`${id}-application-error`} role="alert" className="text-sm text-red-700 dark:text-red-400">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {application ? (pending ? "Saving…" : "Save Application") : pending ? "Creating…" : "Create Application"}
      </button>
    </form>
  );
}
