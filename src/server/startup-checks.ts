import { assertTestAuthBypassSafe } from "./test-auth-bypass";

type Env = Record<string, string | undefined>;

const REQUIRED_AUTH_ENV = ["BETTER_AUTH_SECRET", "GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"] as const;

export class MissingConfigError extends Error {
  constructor(names: string[]) {
    super(`Missing required environment variables: ${names.join(", ")} (see .env.example)`);
    this.name = "MissingConfigError";
  }
}

/** Everything that must hold before the server handles a request. Throws on the first problem. */
export function runStartupChecks(env: Env = process.env): void {
  assertTestAuthBypassSafe(env);
  const missing = REQUIRED_AUTH_ENV.filter((name) => !env[name]);
  if (missing.length > 0) throw new MissingConfigError(missing);
}
