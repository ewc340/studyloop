import { describe, expect, it } from "vitest";
import {
  canReportIssues,
  inMemoryIssueTracker,
  NotIssueReporterError,
  reportIssue,
  setLearnerTimezone,
  type IssueReport,
  type IssueReporting,
} from "@/core";
import { useTestContext } from "@/test/core-harness";
import { actingAsNewLearner } from "@/test/learners";

const core = useTestContext();

const OWNER_EMAIL = "owner@example.test";

function reportingWith(tracker = inMemoryIssueTracker()): IssueReporting {
  return { tracker, ownerEmail: OWNER_EMAIL, appVersion: "abc1234" };
}

function actingAsOwner() {
  return actingAsNewLearner(core.ctx, { id: "owner", email: OWNER_EMAIL });
}

const phonePage = {
  url: "/topics/0b9f6c2e-1d6a-4c1e-9a53-0d4d3f1f2a10",
  route: "/topics/[id]",
  viewport: { width: 412, height: 839 },
  userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7) Mobile Safari/537.36",
};

function bugReport(overrides: Partial<IssueReport> = {}): IssueReport {
  return {
    type: "bug",
    description: "The Topic header overflows on a phone\n\nLong names don't wrap.",
    page: phonePage,
    images: [],
    ...overrides,
  };
}

describe("reporting an issue", () => {
  it("the owner's bug report becomes a GitHub issue labelled for triage", async () => {
    const tracker = inMemoryIssueTracker();
    const owner = await actingAsOwner();

    const reported = await reportIssue(owner, reportingWith(tracker), bugReport());

    expect(tracker.issues).toHaveLength(1);
    const [issue] = tracker.issues;
    expect(issue.title).toBe("The Topic header overflows on a phone");
    expect(issue.labels).toEqual(["needs-triage", "bug"]);
    expect(issue.body).toContain("The Topic header overflows on a phone\n\nLong names don't wrap.");
    expect(reported).toEqual({ number: issue.number, url: issue.url });
  });

  it("an idea is labelled as an enhancement", async () => {
    const tracker = inMemoryIssueTracker();
    await reportIssue(await actingAsOwner(), reportingWith(tracker), bugReport({ type: "idea" }));
    expect(tracker.issues[0].labels).toEqual(["needs-triage", "enhancement"]);
  });

  it("the issue carries the context an agent needs to reproduce it, in the owner's timezone", async () => {
    const tracker = inMemoryIssueTracker();
    const owner = await actingAsOwner();
    await setLearnerTimezone(owner, "America/New_York");
    core.clock.set("2026-11-20T15:04:00Z");

    await reportIssue(owner, reportingWith(tracker), bugReport());

    const { body } = tracker.issues[0];
    expect(body).toContain("| Type | Bug |");
    expect(body).toContain("| Page | `/topics/0b9f6c2e-1d6a-4c1e-9a53-0d4d3f1f2a10` |");
    expect(body).toContain("| Route | `/topics/[id]` |");
    expect(body).toContain("| Viewport | 412×839 (phone) |");
    expect(body).toContain("| App version | `abc1234` |");
    expect(body).toContain("| Browser | `Mozilla/5.0 (Linux; Android 14; Pixel 7) Mobile Safari/537.36` |");
    expect(body).toContain("| Reported | 2026-11-20 10:04 (America/New_York) |");
  });

  it("a wide viewport is reported as desktop", async () => {
    const tracker = inMemoryIssueTracker();
    const page = { ...phonePage, viewport: { width: 1440, height: 900 } };
    await reportIssue(await actingAsOwner(), reportingWith(tracker), bugReport({ page }));
    expect(tracker.issues[0].body).toContain("| Viewport | 1440×900 (desktop) |");
  });

  it("query values in the page URL are redacted, since they can hold Learner data", async () => {
    const tracker = inMemoryIssueTracker();
    const page = { ...phonePage, url: "/topics?q=Kafka%20internals&page=2#top", route: "/topics" };
    await reportIssue(await actingAsOwner(), reportingWith(tracker), bugReport({ page }));
    expect(tracker.issues[0].body).toContain("| Page | `/topics?q=…&page=…` |");
    expect(tracker.issues[0].body).not.toContain("Kafka");
  });

  it("only the owner may report issues", async () => {
    const tracker = inMemoryIssueTracker();
    const reporting = reportingWith(tracker);
    const owner = await actingAsNewLearner(core.ctx, { id: "owner", email: "Owner@Example.test" });
    const someoneElse = await actingAsNewLearner(core.ctx);

    expect(await canReportIssues(owner, reporting)).toBe(true);
    expect(await canReportIssues(someoneElse, reporting)).toBe(false);
    expect(await canReportIssues(owner, null)).toBe(false);
    await expect(reportIssue(someoneElse, reporting, bugReport())).rejects.toThrow(NotIssueReporterError);
    expect(tracker.issues).toHaveLength(0);
  });
});
