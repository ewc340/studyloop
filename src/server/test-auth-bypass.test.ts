import { describe, expect, it } from "vitest";
import {
  assertTestAuthBypassSafe,
  bypassLearnerIdFrom,
  E2E_LEARNER_HEADER,
  TestAuthBypassInProductionError,
} from "./test-auth-bypass";

const headers = (id: string) => new Headers({ [E2E_LEARNER_HEADER]: id });

describe("test auth bypass", () => {
  it("is off unless explicitly enabled", () => {
    expect(bypassLearnerIdFrom(headers("e2e-learner"), { NODE_ENV: "development" })).toBeNull();
  });

  it("acts as the header's Learner when enabled outside production", () => {
    expect(bypassLearnerIdFrom(headers("e2e-learner"), { NODE_ENV: "development", E2E_AUTH_BYPASS: "1" })).toBe(
      "e2e-learner",
    );
  });

  it("ignores malformed Learner ids", () => {
    expect(bypassLearnerIdFrom(headers("Robert'); drop"), { E2E_AUTH_BYPASS: "1" })).toBeNull();
  });

  it("refuses to start in production", () => {
    expect(() => assertTestAuthBypassSafe({ NODE_ENV: "production", E2E_AUTH_BYPASS: "1" })).toThrow(
      TestAuthBypassInProductionError,
    );
    expect(() => assertTestAuthBypassSafe({ NODE_ENV: "production" })).not.toThrow();
  });
});
