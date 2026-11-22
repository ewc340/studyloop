"use server";

import { redirect } from "next/navigation";
import {
  applicationId,
  ApplicationNotFoundError,
  changeApplicationStatus,
  companyId,
  CompanyNotFoundError,
  createApplication,
  InvalidApplicationError,
  updateApplication,
  type Application,
  type ApplicationDetails,
  type ApplicationStatus,
} from "@/core";
import { requireLearnerContext } from "@/server/learner";

export interface ApplicationFormState {
  error?: string;
  /** Echoed back so a rejected form keeps what the Learner typed. */
  values?: Required<{ [K in keyof ApplicationDetails]: string }>;
}

/** Which Application the form is for: a new one under a Company, or an existing one. */
export type ApplicationFormTarget = { companyId: string } | { applicationId: string };

/** The Application form: records a new Application or edits one, then opens its page. */
export async function submitApplication(
  target: ApplicationFormTarget,
  _previous: ApplicationFormState,
  formData: FormData,
): Promise<ApplicationFormState> {
  const values = {
    role: String(formData.get("role") ?? ""),
    appliedOn: String(formData.get("appliedOn") ?? ""),
    source: String(formData.get("source") ?? ""),
    link: String(formData.get("link") ?? ""),
  };
  const ctx = await requireLearnerContext();
  let application: Application;
  try {
    application =
      "companyId" in target
        ? await createApplication(ctx, companyId(target.companyId), values)
        : await updateApplication(ctx, applicationId(target.applicationId), values);
  } catch (error) {
    if (
      error instanceof InvalidApplicationError ||
      error instanceof CompanyNotFoundError ||
      error instanceof ApplicationNotFoundError
    ) {
      return { error: error.message, values };
    }
    throw error;
  }
  redirect(`/applications/${application.id}`);
}

export interface StatusChangeFormState {
  error?: string;
  status?: string;
  changedOn?: string;
}

/** The status change form on an Application's page: records the change and shows the updated timeline. */
export async function submitStatusChange(
  id: string,
  _previous: StatusChangeFormState,
  formData: FormData,
): Promise<StatusChangeFormState> {
  const status = String(formData.get("status") ?? "");
  const changedOn = String(formData.get("changedOn") ?? "");
  try {
    // The core rejects anything that isn't an Application status.
    await changeApplicationStatus(await requireLearnerContext(), applicationId(id), {
      status: status as ApplicationStatus,
      changedOn,
    });
  } catch (error) {
    if (error instanceof InvalidApplicationError || error instanceof ApplicationNotFoundError) {
      return { error: error.message, status, changedOn };
    }
    throw error;
  }
  redirect(`/applications/${id}`);
}
