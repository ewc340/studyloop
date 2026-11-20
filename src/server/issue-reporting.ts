// Issue reporting (owner tooling) as configured by server env. The token never leaves the server.
import { execFileSync } from "node:child_process";
import { githubIssueTracker, inMemoryIssueTracker, type IssueReporting, type IssueTracker } from "@/core";
import { isTestAuthBypassEnabled } from "./test-auth-bypass";

type Env = Record<string, string | undefined>;

const DEFAULT_REPOSITORY = "ewc340/studyloop";

export interface ServerIssueReporting extends IssueReporting {
  /** `owner/name` of the repository issues are posted to. */
  repository: string;
}

/**
 * Issue reporting, or null when it isn't configured: it needs ISSUE_REPORTING_GITHUB_TOKEN and
 * ISSUE_REPORTING_OWNER_EMAIL. Under the e2e auth bypass, ISSUE_REPORTING_FAKE_TRACKER=1 swaps
 * GitHub for an in-memory tracker.
 */
export function issueReportingFrom(env: Env = process.env): ServerIssueReporting | null {
  const token = env.ISSUE_REPORTING_GITHUB_TOKEN?.trim();
  const ownerEmail = env.ISSUE_REPORTING_OWNER_EMAIL?.trim();
  if (!token || !ownerEmail) return null;

  const repository = env.ISSUE_REPORTING_REPOSITORY?.trim() || DEFAULT_REPOSITORY;
  const fake = env.ISSUE_REPORTING_FAKE_TRACKER === "1" && isTestAuthBypassEnabled(env);
  const tracker = sharedTracker(fake ? "in-memory" : `github:${repository}:${token}`, () =>
    fake ? inMemoryIssueTracker() : githubIssueTracker({ token, repository }),
  );
  return { tracker, ownerEmail, appVersion: appVersion(env), repository };
}

const globalForTrackers = globalThis as unknown as { studyloopIssueTrackers?: Map<string, IssueTracker> };

/** One tracker per configuration per process (across dev hot reloads), so it keeps what it learned. */
function sharedTracker(key: string, create: () => IssueTracker): IssueTracker {
  const trackers = (globalForTrackers.studyloopIssueTrackers ??= new Map());
  if (!trackers.has(key)) trackers.set(key, create());
  return trackers.get(key)!;
}

let gitCommit: string | undefined;

/** APP_VERSION if set (e.g. by a Docker build), else the checked-out git commit. */
function appVersion(env: Env): string {
  if (env.APP_VERSION?.trim()) return env.APP_VERSION.trim();
  if (gitCommit === undefined) {
    try {
      gitCommit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8", stdio: "pipe" }).trim();
    } catch {
      gitCommit = "unknown";
    }
  }
  return gitCommit;
}
