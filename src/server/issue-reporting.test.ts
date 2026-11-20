import { describe, expect, it } from "vitest";
import { issueReportingFrom } from "./issue-reporting";

const configured = {
  ISSUE_REPORTING_GITHUB_TOKEN: "github_pat_x",
  ISSUE_REPORTING_OWNER_EMAIL: "owner@example.test",
  APP_VERSION: "abc1234",
};

describe("issue reporting configuration", () => {
  it("is on with a token and the owner's email", () => {
    const reporting = issueReportingFrom(configured);
    expect(reporting).toMatchObject({ ownerEmail: "owner@example.test", appVersion: "abc1234" });
    expect(reporting?.repository).toBe("ewc340/studyloop");
  });

  it("is off when the token or the owner's email is missing", () => {
    expect(issueReportingFrom({ ...configured, ISSUE_REPORTING_GITHUB_TOKEN: "" })).toBeNull();
    expect(issueReportingFrom({ ...configured, ISSUE_REPORTING_OWNER_EMAIL: undefined })).toBeNull();
  });

  it("can post to another repository", () => {
    expect(issueReportingFrom({ ...configured, ISSUE_REPORTING_REPOSITORY: "me/fork" })?.repository).toBe("me/fork");
  });

  it("uses the in-memory tracker only under the e2e auth bypass", () => {
    const fake = { ...configured, ISSUE_REPORTING_FAKE_TRACKER: "1" };
    expect(issueReportingFrom({ ...fake, E2E_AUTH_BYPASS: "1" })?.fake).toBe(true);
    expect(issueReportingFrom(fake)?.fake).toBe(false);
  });
});
