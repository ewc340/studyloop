// Issue reporting (owner tooling) as configured by server env. The token never leaves the server.
import { execFileSync } from "node:child_process";
import { githubIssueTracker, inMemoryIssueTracker, type IssueReporting, type IssueTracker } from "@/core";
import { isTestAuthBypassEnabled } from "./test-auth-bypass";

type Env = Record<string, string | undefined>;

const DEFAULT_REPOSITORY = "ewc340/studyloop";

export interface ServerIssueReporting extends IssueReporting {
  /** `owner/name` of the repository issues are posted to. */
  repository: string;
  /** Whether reports go to the in-memory tracker (e2e) instead of GitHub. */
  fake: boolean;
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
  const tracker = fake ? sharedFakeTracker() : githubIssueTracker({ token, repository });
  return { tracker, ownerEmail, appVersion: appVersion(env), repository, fake };
}

const globalForFake = globalThis as unknown as { studyloopFakeIssueTracker?: IssueTracker };

function sharedFakeTracker(): IssueTracker {
  globalForFake.studyloopFakeIssueTracker ??= inMemoryIssueTracker();
  return globalForFake.studyloopFakeIssueTracker;
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
