import { assertTestAuthBypassSafe } from "@/server/test-auth-bypass";

/** Runs once when the server starts. */
export function register() {
  assertTestAuthBypassSafe();
}
