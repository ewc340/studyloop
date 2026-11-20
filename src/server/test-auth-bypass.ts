/**
 * Test-only auth bypass for Playwright: with E2E_AUTH_BYPASS=1, a request carrying the
 * `x-e2e-learner` header acts as that Learner without signing in with GitHub.
 * The server refuses to start if it is enabled in production (see src/instrumentation.ts).
 */
export const E2E_LEARNER_HEADER = "x-e2e-learner";

/** Bypass Learners live under this reserved id prefix, so the bypass can never act as a real (GitHub) Learner. */
export const E2E_LEARNER_PREFIX = "e2e-";

type Env = Record<string, string | undefined>;

export class TestAuthBypassInProductionError extends Error {
  constructor() {
    super("E2E_AUTH_BYPASS is enabled in production. Refusing to start.");
    this.name = "TestAuthBypassInProductionError";
  }
}

/** Throws if the bypass is enabled in production. Called once at server startup. */
export function assertTestAuthBypassSafe(env: Env = process.env): void {
  if (env.E2E_AUTH_BYPASS === "1" && env.NODE_ENV === "production") {
    throw new TestAuthBypassInProductionError();
  }
}

export function isTestAuthBypassEnabled(env: Env = process.env): boolean {
  assertTestAuthBypassSafe(env);
  return env.E2E_AUTH_BYPASS === "1";
}

/** The id the bypass asserts for this request, or null when the bypass is off or the header absent. */
export function bypassLearnerIdFrom(headers: Headers, env: Env = process.env): string | null {
  if (!isTestAuthBypassEnabled(env)) return null;
  const id = headers.get(E2E_LEARNER_HEADER);
  return id && /^e2e-[a-z0-9-]+$/.test(id) ? id : null;
}
