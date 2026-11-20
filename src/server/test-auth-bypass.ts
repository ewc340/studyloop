/**
 * Test-only auth bypass for Playwright. When enabled, requests carrying the
 * `x-e2e-learner` header act as that Learner without signing in.
 * It can never be enabled in a production build.
 */
export const E2E_LEARNER_HEADER = "x-e2e-learner";

export function isTestAuthBypassEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.E2E_AUTH_BYPASS !== "1") return false;
  if (env.NODE_ENV === "production") {
    throw new Error("E2E_AUTH_BYPASS must never be set in production");
  }
  return true;
}

/** Returns the bypass Learner id from request headers, or null when the bypass is off or absent. */
export function testBypassLearnerId(headers: Headers, env: NodeJS.ProcessEnv = process.env): string | null {
  if (!isTestAuthBypassEnabled(env)) return null;
  return headers.get(E2E_LEARNER_HEADER);
}
