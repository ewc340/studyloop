"use client";

import { useActionState, useId } from "react";
import type { Company } from "@/core";
import { inputClass, primaryButtonClass } from "../ui";
import { submitCompany, type CompanyFormState } from "./actions";

/** Records a new Company, or edits `company` when given. */
export function CompanyForm({ company }: { company?: Company }) {
  const id = useId();
  const [state, formAction, pending] = useActionState<CompanyFormState, FormData>(
    submitCompany.bind(null, company?.id ?? null),
    { name: company?.name, notes: company?.notes ?? "" },
  );

  return (
    // After a rejected submit React resets the fields to their defaults: what was sent.
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-company-name`} className="font-medium">
          Name
        </label>
        <input
          id={`${id}-company-name`}
          name="name"
          required
          autoComplete="off"
          defaultValue={state.name}
          data-private
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? `${id}-company-error` : undefined}
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-company-notes`} className="font-medium">
          Notes <span className="font-normal text-zinc-500">(optional)</span>
        </label>
        <textarea
          id={`${id}-company-notes`}
          name="notes"
          rows={4}
          defaultValue={state.notes}
          data-private
          className={inputClass}
        />
      </div>
      {state.error && (
        <p id={`${id}-company-error`} role="alert" className="text-sm text-red-700 dark:text-red-400">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {company ? (pending ? "Saving…" : "Save Company") : pending ? "Creating…" : "Create Company"}
      </button>
    </form>
  );
}
