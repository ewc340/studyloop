"use server";

import { redirect } from "next/navigation";
import {
  companyId,
  CompanyNotFoundError,
  createCompany,
  InvalidCompanyError,
  updateCompany,
  type Company,
} from "@/core";
import { requireLearnerContext } from "@/server/learner";

export interface CompanyFormState {
  error?: string;
  /** Echoed back so a rejected form keeps what the Learner typed. */
  name?: string;
  notes?: string;
}

/**
 * The Company form: records a new Company, or edits the one with `id`, then opens its page.
 * Bound to the Company's id (or null) by the page rendering the form.
 */
export async function submitCompany(
  id: string | null,
  _previous: CompanyFormState,
  formData: FormData,
): Promise<CompanyFormState> {
  const name = String(formData.get("name") ?? "");
  const notes = String(formData.get("notes") ?? "");
  const ctx = await requireLearnerContext();
  let company: Company;
  try {
    company = id ? await updateCompany(ctx, companyId(id), { name, notes }) : await createCompany(ctx, { name, notes });
  } catch (error) {
    if (error instanceof InvalidCompanyError || error instanceof CompanyNotFoundError) {
      return { error: error.message, name, notes };
    }
    throw error;
  }
  redirect(`/companies/${company.id}`);
}
