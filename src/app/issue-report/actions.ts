"use server";

import {
  InvalidIssueReportError,
  IssueTrackerError,
  NotIssueReporterError,
  previewIssueReport,
  reportIssue,
  type IssueDraft,
  type IssueReportImage,
  type IssueReportPreview,
  type ReportedIssue,
} from "@/core";
import { issueReportingFrom } from "@/server/issue-reporting";
import { requireLearnerContext } from "@/server/learner";

export type IssuePreviewResult = { draft: IssueDraft } | { error: string };
export type IssueSubmitResult = { issue: ReportedIssue } | { error: string };

/** The issue exactly as it will be posted, for the owner to check before sending. */
export async function previewIssue(report: IssueReportPreview): Promise<IssuePreviewResult> {
  // Outside the error handling, so a signed-out request still redirects to sign-in.
  const ctx = await requireLearnerContext();
  return withReportingErrors(async () => {
    return { draft: await previewIssueReport(ctx, requireIssueReporting(), toPreview(report)) };
  });
}

/**
 * Posts the report. `formData` holds `report` (the IssueReportPreview as JSON) and one `image-<i>`
 * file per entry in its `images`.
 */
export async function submitIssue(formData: FormData): Promise<IssueSubmitResult> {
  const ctx = await requireLearnerContext();
  return withReportingErrors(async () => {
    const reporting = requireIssueReporting();
    const preview = toPreview(parseJson(formData.get("report")));
    const images: IssueReportImage[] = await Promise.all(
      preview.images.map(async (image, index) => {
        const file = formData.get(`image-${index}`);
        if (!(file instanceof File)) throw new InvalidIssueReportError(`${image.name} is missing`);
        return { ...image, contentType: file.type, bytes: new Uint8Array(await file.arrayBuffer()) };
      }),
    );
    return { issue: await reportIssue(ctx, reporting, { ...preview, images }) };
  });
}

/** Issue reporting as configured, or NotIssueReporterError when it isn't. */
function requireIssueReporting() {
  const reporting = issueReportingFrom();
  if (!reporting) throw new NotIssueReporterError();
  return reporting;
}

/** Errors the owner can act on come back as a message, so the sheet keeps their draft. */
async function withReportingErrors<T>(run: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await run();
  } catch (error) {
    if (
      error instanceof IssueTrackerError ||
      error instanceof InvalidIssueReportError ||
      error instanceof NotIssueReporterError
    ) {
      return { error: error.message };
    }
    console.error("Issue report failed", error);
    return { error: "Something went wrong sending the report. Try again." };
  }
}

function parseJson(value: FormDataEntryValue | null): unknown {
  try {
    return JSON.parse(String(value));
  } catch {
    throw new InvalidIssueReportError("The report couldn't be read");
  }
}

/** Untrusted input from the browser, reduced to the shape the core expects. */
function toPreview(input: unknown): IssueReportPreview {
  const report = (input ?? {}) as Partial<Record<keyof IssueReportPreview, unknown>>;
  const page = (report.page ?? {}) as Record<string, unknown>;
  const viewport = (page.viewport ?? {}) as Record<string, unknown>;
  const images = Array.isArray(report.images) ? (report.images as Record<string, unknown>[]) : [];
  return {
    type: report.type as IssueReportPreview["type"],
    description: String(report.description ?? ""),
    page: {
      url: String(page.url ?? ""),
      route: String(page.route ?? ""),
      viewport: { width: Number(viewport.width) || 0, height: Number(viewport.height) || 0 },
      userAgent: String(page.userAgent ?? ""),
    },
    images: images.map((image) => ({
      kind: image?.kind === "page-capture" ? "page-capture" : "attachment",
      name: String(image?.name ?? "image"),
      contentType: String(image?.contentType ?? ""),
    })),
  };
}
