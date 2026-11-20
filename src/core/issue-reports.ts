import type { LearnerContext } from "./context";
import { getLearner, type Learner } from "./learner";

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
  return (await ownerActing(ctx, reporting)) !== null;
}

/** The acting Learner if they are the owner, else null. */
async function ownerActing(ctx: LearnerContext, reporting: IssueReporting | null): Promise<Learner | null> {
  const ownerEmail = reporting?.ownerEmail.trim().toLowerCase();
  if (!ownerEmail) return null;
  const learner = await getLearner(ctx);
  return learner.email.toLowerCase() === ownerEmail ? learner : null;
}

async function requireOwner(ctx: LearnerContext, reporting: IssueReporting): Promise<Learner> {
  const owner = await ownerActing(ctx, reporting);
  if (!owner) throw new NotIssueReporterError();
  return owner;
}

/** Reports an issue as the acting Learner, who must be the owner. */
export async function reportIssue(
  ctx: LearnerContext,
  reporting: IssueReporting,
  report: IssueReport,
): Promise<ReportedIssue> {
  const owner = await requireOwner(ctx, reporting);
  const facts = { appVersion: reporting.appVersion, reportedAt: ctx.clock.now(), timezone: owner.timezone };
  const imageUrls: string[] = [];
  for (const image of report.images) {
    const path = `${facts.reportedAt.toISOString().slice(0, 10)}/${crypto.randomUUID()}-${fileName(image)}`;
    const { url } = await reporting.tracker.uploadImage({ path, contentType: image.contentType, bytes: image.bytes });
    imageUrls.push(url);
  }
  return reporting.tracker.createIssue(draftIssue(report, facts, imageUrls));
}

const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** A URL-safe file name that keeps the readable part of the original. */
function fileName(image: IssueReportImage): string {
  const base = image.name
    .replace(/\.[a-z0-9]+$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "image"}.${IMAGE_EXTENSIONS[image.contentType] ?? "bin"}`;
}

/** What the server knows about a report that the browser doesn't. */
interface ServerFacts {
  appVersion: string;
  reportedAt: Date;
  timezone: string;
}

/** Viewports up to this width are phones (below Tailwind's `md` breakpoint). */
const PHONE_MAX_WIDTH = 767;

/**
 * The issue for a report. `imageUrls` holds each image's URL in `report.images` order, or null
 * while it isn't uploaded yet (a preview), shown as a placeholder.
 */
function draftIssue(report: IssueReport, facts: ServerFacts, imageUrls: (string | null)[]): IssueDraft {
  const description = report.description.trim();
  const { page } = report;
  const { width, height } = page.viewport;
  const context: [string, string][] = [
    ["Type", report.type === "bug" ? "Bug" : "Idea"],
    ["Page", code(redactQueryValues(page.url))],
    ["Route", code(page.route)],
    ["Viewport", `${width}×${height} (${width <= PHONE_MAX_WIDTH ? "phone" : "desktop"})`],
    ["App version", code(facts.appVersion)],
    ["Browser", code(page.userAgent)],
    ["Reported", `${formatLocal(facts.reportedAt, facts.timezone)} (${facts.timezone})`],
  ];
  let attachmentNumber = 0;
  const screenshots = report.images.map((image, index) => {
    const url = imageUrls[index] ?? "(uploaded when you submit)";
    if (image.kind === "page-capture") {
      return `**Page capture** (private content masked)\n\n![Page capture](${url})`;
    }
    attachmentNumber += 1;
    return `**Attachment ${attachmentNumber}**\n\n![Attachment ${attachmentNumber}](${url})`;
  });
  const body = [
    description,
    ...(screenshots.length > 0 ? ["## Screenshots", ...screenshots] : []),
    "## Context",
    ["| | |", "| --- | --- |", ...context.map(([key, value]) => `| ${key} | ${value} |`)].join("\n"),
    "_Reported from the studyloop app._",
  ].join("\n\n");
  return {
    title: description.split("\n")[0].trim(),
    body,
    labels: ["needs-triage", report.type === "bug" ? "bug" : "enhancement"],
  };
}

/** Inline code for a table cell: no backtick, pipe or line break can escape it. */
function code(text: string): string {
  return "`" + text.replace(/[`|\r\n]/g, " ").trim() + "`";
}

/** Keeps a URL's path and query keys but drops query values and the fragment, which can hold Learner data. */
function redactQueryValues(url: string): string {
  const [withoutHash] = url.split("#");
  const [path, query] = withoutHash.split("?");
  if (!query) return path;
  const keys = query
    .split("&")
    .filter(Boolean)
    .map((pair) => `${pair.split("=")[0]}=…`);
  return `${path}?${keys.join("&")}`;
}

/** `YYYY-MM-DD HH:mm` in the timezone. */
function formatLocal(date: Date, timezone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
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
