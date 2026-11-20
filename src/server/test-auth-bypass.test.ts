import { describe, expect, it } from "vitest";
import { E2E_LEARNER_HEADER, testBypassLearnerId } from "./test-auth-bypass";

const headers = new Headers({ [E2E_LEARNER_HEADER]: "learner-1" });
const env = (vars: Record<string, string>) => vars as unknown as NodeJS.ProcessEnv;

describe("test auth bypass", () => {
  it("is off unless explicitly enabled", () => {
    expect(testBypassLearnerId(headers, env({ NODE_ENV: "development" }))).toBeNull();
  });

  it("returns the header's Learner when enabled outside production", () => {
    expect(testBypassLearnerId(headers, env({ NODE_ENV: "test", E2E_AUTH_BYPASS: "1" }))).toBe("learner-1");
  });

  it("refuses to run in production", () => {
    expect(() => testBypassLearnerId(headers, env({ NODE_ENV: "production", E2E_AUTH_BYPASS: "1" }))).toThrow();
  });
});
