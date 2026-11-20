import { describe, expect, it } from "vitest";
import {
  canReportIssues,
  inMemoryIssueTracker,
  NotIssueReporterError,
  previewIssueReport,
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

/** Stand-in image bytes: the core never decodes images, so any distinct bytes will do. */
function png(label: string): Uint8Array {
  return new TextEncoder().encode(`\x89PNG ${label}`);
}

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

  it("the page capture and attached images are uploaded and embedded in the issue", async () => {
    const tracker = inMemoryIssueTracker();
    core.clock.set("2026-11-20T15:04:00Z");
    const capture = png("capture");
    const attachment = png("phone screenshot");

    await reportIssue(
      await actingAsOwner(),
      reportingWith(tracker),
      bugReport({
        images: [
          { kind: "page-capture", name: "page.png", contentType: "image/png", bytes: capture },
          { kind: "attachment", name: "Screenshot 2026-11-20 at 10.03.png", contentType: "image/png", bytes: attachment },
        ],
      }),
    );

    expect(tracker.images.map((image) => image.bytes)).toEqual([capture, attachment]);
    const [captureUrl, attachmentUrl] = tracker.images.map((image) => image.url);
    const { body } = tracker.issues[0];
    expect(body).toContain(`![Page capture](${captureUrl})`);
    expect(body).toContain(`![Attachment 1](${attachmentUrl})`);
    // Each upload gets its own path, dated, keeping a readable name.
    expect(tracker.images[0].path).toMatch(/^2026-11-20\/[0-9a-f-]{36}-page\.png$/);
    expect(tracker.images[1].path).toMatch(/^2026-11-20\/[0-9a-f-]{36}-screenshot-2026-11-20-at-10-03\.png$/);
  });

  it("the preview is exactly what gets posted, with images marked as uploaded on submit", async () => {
    const tracker = inMemoryIssueTracker();
    const owner = await actingAsOwner();
    const report = bugReport({
      images: [{ kind: "page-capture", name: "page.png", contentType: "image/png", bytes: png("capture") }],
    });

    const preview = await previewIssueReport(owner, reportingWith(tracker), report);
    await reportIssue(owner, reportingWith(tracker), report);

    expect(tracker.images).toHaveLength(1);
    const posted = tracker.issues[0];
    expect(preview.title).toBe(posted.title);
    expect(preview.labels).toEqual(posted.labels);
    expect(preview.body).toContain("![Page capture](uploaded when you submit)");
    expect(preview.body.replace("uploaded when you submit", tracker.images[0].url)).toBe(posted.body);
  });

  it("a preview never uploads anything and needs no image bytes", async () => {
    const tracker = inMemoryIssueTracker();
    const report = bugReport({ images: [{ kind: "attachment", name: "a.png", contentType: "image/png" }] });

    const preview = await previewIssueReport(await actingAsOwner(), reportingWith(tracker), report);

    expect(preview.body).toContain("![Attachment 1](uploaded when you submit)");
    expect(tracker.images).toHaveLength(0);
    expect(tracker.issues).toHaveLength(0);
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
    await expect(previewIssueReport(someoneElse, reporting, bugReport())).rejects.toThrow(NotIssueReporterError);
    expect(tracker.issues).toHaveLength(0);
  });
});
