// Agent QA: phone-sized screenshots of the screens a ticket changed, signed in via the e2e bypass.
// Usage: npx tsx ralph/screenshots.ts <ticket-number> <path> [<path> ...]
//   e.g. npx tsx ralph/screenshots.ts 4 / /topics
// Writes docs/screenshots/<ticket>/<slug>.png. Starts its own dev server on :3100 (against the e2e
// database) unless one is already running there.
import { spawn, type ChildProcess } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium, devices } from "@playwright/test";
import { localDatabaseUrls } from "../src/core";
import { E2E_LEARNER_HEADER } from "../src/server/test-auth-bypass";

const PORT = 3100;
const BASE = `http://localhost:${PORT}`;

async function isUp(): Promise<boolean> {
  try {
    return (await fetch(`${BASE}/sign-in`)).ok;
  } catch {
    return false;
  }
}

async function startServer(): Promise<ChildProcess> {
  const env = {
    ...process.env,
    DATABASE_URL: process.env.E2E_DATABASE_URL ?? localDatabaseUrls.e2e,
    E2E_AUTH_BYPASS: "1",
    BETTER_AUTH_URL: BASE,
    NEXT_DIST_DIR: ".next-e2e",
    // Issue reporting for the e2e owner, against an in-memory tracker instead of GitHub.
    ISSUE_REPORTING_GITHUB_TOKEN: "e2e-not-a-token",
    ISSUE_REPORTING_OWNER_EMAIL: "e2e-owner@e2e.test",
    ISSUE_REPORTING_FAKE_TRACKER: "1",
  };
  const server = spawn("sh", ["-c", `npx tsx scripts/prepare-e2e-db.ts && npx next dev --port ${PORT}`], {
    env,
    stdio: "ignore",
    detached: true,
  });
  for (let i = 0; i < 120; i++) {
    if (await isUp()) return server;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Dev server on :3100 did not start within 2 minutes");
}

function slug(route: string): string {
  return route.replace(/^\/+|\/+$/g, "").replace(/[^a-z0-9]+/gi, "-") || "home";
}

async function main() {
  const [ticket, ...routes] = process.argv.slice(2);
  if (!ticket || !/^\d+$/.test(ticket) || routes.length === 0) {
    throw new Error("Usage: npx tsx ralph/screenshots.ts <ticket-number> <path> [<path> ...]");
  }

  const server = (await isUp()) ? null : await startServer();
  const outDir = path.join("docs", "screenshots", ticket);
  await mkdir(outDir, { recursive: true });

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      ...devices["Pixel 7"],
      extraHTTPHeaders: { [E2E_LEARNER_HEADER]: "e2e-learner" },
    });
    const page = await context.newPage();
    for (const route of routes) {
      await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
      const file = path.join(outDir, `${slug(route)}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(file);
    }
  } finally {
    await browser.close();
    if (server?.pid) process.kill(-server.pid);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
