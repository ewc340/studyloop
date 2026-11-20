import { describe, expect, it } from "vitest";
import { buildBadge, buildInfo } from "./build-info";

const checkout = () => ({ commit: "1a2b3c4", branch: "claude/29-qa-instances" });

describe("build badge", () => {
  it("names the PR and commit in a PR's QA instance", () => {
    expect(buildBadge({ NODE_ENV: "development", QA_PR: "31" }, checkout)).toEqual({ name: "PR #31", commit: "1a2b3c4" });
  });

  it("names the branch and commit in plain dev", () => {
    expect(buildBadge({ NODE_ENV: "development" }, checkout)).toEqual({ name: "claude/29-qa-instances", commit: "1a2b3c4" });
  });

  it("says detached when no branch is checked out", () => {
    const detached = () => ({ commit: "1a2b3c4", branch: null });
    expect(buildBadge({ NODE_ENV: "development" }, detached)).toEqual({ name: "detached", commit: "1a2b3c4" });
  });

  it("is hidden in production builds", () => {
    expect(buildBadge({ NODE_ENV: "production", QA_PR: "31" }, checkout)).toBeNull();
  });

  it("is hidden in agent screenshot and e2e runs", () => {
    expect(buildBadge({ NODE_ENV: "development", E2E_AUTH_BYPASS: "1" }, checkout)).toBeNull();
  });
});

describe("build info", () => {
  it("knows the PR only from a valid QA_PR", () => {
    expect(buildInfo({ QA_PR: "31" }, checkout).pullRequest).toBe(31);
    expect(buildInfo({ QA_PR: "" }, checkout).pullRequest).toBeUndefined();
    expect(buildInfo({ QA_PR: "abc" }, checkout).pullRequest).toBeUndefined();
  });

  it("prefers APP_VERSION (set by a Docker build) over the checkout's commit", () => {
    expect(buildInfo({ APP_VERSION: "v9" }, checkout).commit).toBe("v9");
    expect(buildInfo({}, checkout).commit).toBe("1a2b3c4");
  });

  it("reads the real checkout by default", () => {
    expect(buildInfo({}).commit).toMatch(/^[0-9a-f]{7,}$/);
  });
});
