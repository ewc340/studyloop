// Which build is running: the commit, the branch, and the pull request when this is a PR's QA
// instance (`npm run qa <pr>` sets QA_PR). Owner tooling, used by the build badge and issue reports.
import { execFileSync } from "node:child_process";

type Env = Record<string, string | undefined>;

export interface Checkout {
  commit: string;
  /** Null when HEAD is detached. */
  branch: string | null;
}

export interface BuildInfo extends Checkout {
  pullRequest?: number;
}

let productionCheckout: Checkout | undefined;

/**
 * Outside production, reads the checkout on every call rather than once per process: a dev server
 * follows whatever is checked out, and the badge must never name a commit that's no longer running.
 */
export function readCheckout(): Checkout {
  if (process.env.NODE_ENV === "production") return (productionCheckout ??= gitCheckout());
  return gitCheckout();
}

function gitCheckout(): Checkout {
  try {
    const commit = git("rev-parse", "--short", "HEAD");
    const branch = git("rev-parse", "--abbrev-ref", "HEAD");
    return { commit, branch: branch === "HEAD" ? null : branch };
  } catch {
    return { commit: "unknown", branch: null };
  }
}

function git(...args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8", stdio: "pipe" }).trim();
}

export function buildInfo(env: Env = process.env, checkout: () => Checkout = readCheckout): BuildInfo {
  const { commit, branch } = env.APP_VERSION?.trim()
    ? { commit: env.APP_VERSION.trim(), branch: null }
    : checkout();
  const pr = env.QA_PR?.trim();
  const pullRequest = pr && /^[1-9]\d*$/.test(pr) ? Number(pr) : undefined;
  return { commit, branch, ...(pullRequest ? { pullRequest } : {}) };
}

/**
 * The badge naming the build: `PR #<n> · <sha>` in a QA instance, `<branch> · <sha>` in plain dev.
 * Null in production and in agent screenshot/e2e runs (E2E_AUTH_BYPASS), where it would only be noise.
 */
export function buildBadgeLabel(env: Env = process.env, checkout: () => Checkout = readCheckout): string | null {
  if (env.NODE_ENV === "production" || env.E2E_AUTH_BYPASS === "1") return null;
  const build = buildInfo(env, checkout);
  const name = build.pullRequest ? `PR #${build.pullRequest}` : (build.branch ?? "detached");
  return `${name} · ${build.commit}`;
}
