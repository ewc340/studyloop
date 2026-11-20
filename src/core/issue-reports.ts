import type { LearnerContext } from "./context";
import { getLearner } from "./learner";

/**
 * Owner tooling: the owner reports a problem or idea from any page and it lands as a GitHub issue.
 * This is not part of the learning domain; it exists so the owner can feed the AFK loop quickly.
 */

export type IssueReportType = "bug" | "idea";

/** Where the report was made, as the browser saw it. */
export interface IssueReportPage {
  /** Path and query of the page, e.g. `/topics?q=cach`. Query values are redacted before posting. */
  url: string;
  /** The route pattern, e.g. `/topics/[id]`. */
  route: string;
  viewport: { width: number; height: number };
  userAgent: string;
}

export interface IssueReport {
  type: IssueReportType;
  description: string;
  page: IssueReportPage;
  images: IssueReportImage[];
}

export interface IssueReportImage {
  /** `page-capture`: the app's automatic capture, private elements masked. `attachment`: added by the owner, not masked. */
  kind: "page-capture" | "attachment";
  name: string;
  contentType: string;
  bytes: Uint8Array;
}

/** The issue as it will be posted. */
export interface IssueDraft {
  title: string;
  body: string;
  labels: string[];
}

export interface ReportedIssue {
  number: number;
  url: string;
}

/** Port to the issue tracker (GitHub). Injected so tests never touch the network. */
export interface IssueTracker {
  /** Stores an image where issues can embed it, and returns its public URL. */
  uploadImage(image: { path: string; contentType: string; bytes: Uint8Array }): Promise<{ url: string }>;
  createIssue(draft: IssueDraft): Promise<ReportedIssue>;
}

/** Issue reporting as configured on the server: who may report, and where reports go. */
export interface IssueReporting {
  tracker: IssueTracker;
  /** The email of the owner's Learner; only they may report issues. */
  ownerEmail: string;
  /** The running app's version (git commit). */
  appVersion: string;
}

/** Only the owner may report issues. */
export class NotIssueReporterError extends Error {
  constructor() {
    super("Only the owner can report issues");
    this.name = "NotIssueReporterError";
  }
}

/** Whether the acting Learner may report issues: issue reporting is configured and they are the owner. */
export async function canReportIssues(ctx: LearnerContext, reporting: IssueReporting | null): Promise<boolean> {
  if (!reporting?.ownerEmail.trim()) return false;
  const learner = await getLearner(ctx);
  return learner.email.toLowerCase() === reporting.ownerEmail.trim().toLowerCase();
}

async function assertCanReportIssues(ctx: LearnerContext, reporting: IssueReporting): Promise<void> {
  if (!(await canReportIssues(ctx, reporting))) throw new NotIssueReporterError();
}

/** Reports an issue as the acting Learner, who must be the owner. */
export async function reportIssue(
  ctx: LearnerContext,
  reporting: IssueReporting,
  report: IssueReport,
): Promise<ReportedIssue> {
  await assertCanReportIssues(ctx, reporting);
  return reporting.tracker.createIssue(draftIssue(report));
}

function draftIssue(report: IssueReport): IssueDraft {
  const description = report.description.trim();
  return {
    title: description.split("\n")[0].trim(),
    body: description,
    labels: ["needs-triage", report.type === "bug" ? "bug" : "enhancement"],
  };
}

export interface InMemoryIssueTracker extends IssueTracker {
  readonly issues: (IssueDraft & ReportedIssue)[];
  readonly images: { path: string; contentType: string; bytes: Uint8Array; url: string }[];
}

/** An IssueTracker that keeps everything in memory: for tests and the e2e server. */
export function inMemoryIssueTracker(): InMemoryIssueTracker {
  const issues: (IssueDraft & ReportedIssue)[] = [];
  const images: InMemoryIssueTracker["images"] = [];
  return {
    issues,
    images,
    async uploadImage(image) {
      const url = `https://issue-tracker.test/images/${image.path}`;
      images.push({ ...image, url });
      return { url };
    },
    async createIssue(draft) {
      const number = issues.length + 1;
      const issue = { ...draft, number, url: `https://issue-tracker.test/issues/${number}` };
      issues.push(issue);
      return { number, url: issue.url };
    },
  };
}
