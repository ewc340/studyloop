import { describe, expect, it } from "vitest";
import { MissingConfigError, runStartupChecks } from "./startup-checks";
import { TestAuthBypassInProductionError } from "./test-auth-bypass";

const configured = { BETTER_AUTH_SECRET: "s", GITHUB_CLIENT_ID: "id", GITHUB_CLIENT_SECRET: "secret" };

describe("startup checks", () => {
  it("pass with auth configured and no bypass", () => {
    expect(() => runStartupChecks({ ...configured, NODE_ENV: "production" })).not.toThrow();
  });

  it("refuse to start production with the test auth bypass enabled", () => {
    expect(() => runStartupChecks({ ...configured, NODE_ENV: "production", E2E_AUTH_BYPASS: "1" })).toThrow(
      TestAuthBypassInProductionError,
    );
  });

  it("refuse to start without auth configuration, naming what's missing", () => {
    expect(() => runStartupChecks({ GITHUB_CLIENT_ID: "id" })).toThrow(MissingConfigError);
    expect(() => runStartupChecks({ GITHUB_CLIENT_ID: "id" })).toThrow(/BETTER_AUTH_SECRET, GITHUB_CLIENT_SECRET/);
  });
});
