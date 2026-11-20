// Per-PR QA instances: each PR runs in its own worktree, database and dev server, side by side, so
// the owner can QA several PRs before merging without touching their own checkout or dev data.
//
//   npm run qa <pr>                create the instance, or update it to the PR's latest commit
//   npm run qa -- <pr> --fresh     the same, re-copying the database from the dev database
//   npm run qa:list                instances, their URLs and commits
//   npm run qa:done <pr>           stop the server, drop the database, remove the worktree
//
// The worktree is ../studyloop-pr-<n>; the database studyloop_pr_<n> starts as a copy of the dev
// database (DATABASE_URL in .env), taken with pg_dump so it works while `npm run dev` is running.
// State and server logs live in .qa/ in this checkout.
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, openSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { databaseUrl, dropDatabase, createDatabaseIfMissing, withDatabaseName } from "@/core";
import { instancePort, isPortFree } from "./qa/ports";

interface Instance {
  pr: number;
  title: string;
  commit: string;
  port: number;
  pid: number | null;
  worktree: string;
  database: string;
  /** Hash of the package-lock.json node_modules was installed from. */
  lockfile: string;
  updatedAt: string;
}

const ROOT = mainCheckout();
const STATE_DIR = path.join(ROOT, ".qa");

function mainCheckout(): string {
  const commonDir = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
    encoding: "utf8",
  }).trim();
  return path.dirname(commonDir);
}

function run(command: string, args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}): string {
  const result = spawnSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed:\n${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

/** Like run, but shows the command's output as it goes (installs, migrations). */
function runVisibly(command: string, args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed (exit ${result.status})`);
}

function step(message: string) {
  console.log(`\n[qa] ${message}`);
}

// --- State

function statePath(pr: number) {
  return path.join(STATE_DIR, `${pr}.json`);
}

function logPath(pr: number) {
  return path.join(STATE_DIR, `${pr}.log`);
}

function readInstance(pr: number): Instance | null {
  return existsSync(statePath(pr)) ? (JSON.parse(readFileSync(statePath(pr), "utf8")) as Instance) : null;
}

function allInstances(): Instance[] {
  if (!existsSync(STATE_DIR)) return [];
  return readdirSync(STATE_DIR)
    .filter((file) => /^\d+\.json$/.test(file))
    .map((file) => readInstance(Number(file.replace(".json", "")))!)
    .sort((a, b) => a.pr - b.pr);
}

function saveInstance(instance: Instance) {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(statePath(instance.pr), `${JSON.stringify(instance, null, 2)}\n`);
}

// --- Server process

function isAlive(pid: number | null): pid is number {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function stopServer(instance: Instance) {
  if (!isAlive(instance.pid)) return;
  const group = -instance.pid;
  try {
    process.kill(group, "SIGTERM");
  } catch {
    return;
  }
  for (let i = 0; i < 50 && isAlive(instance.pid); i++) await sleep(200);
  if (isAlive(instance.pid)) process.kill(group, "SIGKILL");
  for (let i = 0; i < 25 && !(await isPortFree(instance.port)); i++) await sleep(200);
}

async function waitUntilServing(url: string, pid: number, pr: number) {
  for (let i = 0; i < 180; i++) {
    if (!isAlive(pid)) throw new Error(`The server for PR #${pr} exited. See ${logPath(pr)}`);
    try {
      const response = await fetch(`${url}/sign-in`, { redirect: "manual" });
      if (response.status < 500) return;
    } catch {
      // Not listening yet.
    }
    await sleep(1000);
  }
  throw new Error(`The server for PR #${pr} didn't answer within 3 minutes. See ${logPath(pr)}`);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Database

/** Postgres's own tools, from the Compose database container, so their version always matches. */
function copyDatabase(sourceUrl: string, targetUrl: string) {
  const host = new URL(sourceUrl).hostname;
  if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
    throw new Error(`QA instances copy the local Docker database; DATABASE_URL points at ${host}`);
  }
  run(
    "docker",
    [
      "compose",
      "exec",
      "-T",
      "db",
      "bash",
      "-c",
      'set -euo pipefail; pg_dump --no-owner --no-acl "$1" | psql --quiet -v ON_ERROR_STOP=1 "$2" >/dev/null',
      "copy",
      sourceUrl,
      targetUrl,
    ],
    { cwd: ROOT },
  );
}

async function databaseExists(adminUrl: string, name: string): Promise<boolean> {
  const { default: postgres } = await import("postgres");
  const sql = postgres(adminUrl, { max: 1, onnotice: () => {} });
  try {
    return (await sql`select 1 from pg_database where datname = ${name}`).length > 0;
  } finally {
    await sql.end();
  }
}

// --- Commands

function parsePr(value: string | undefined): number {
  if (!value || !/^[1-9]\d*$/.test(value)) throw new Error("Give a PR number, e.g. npm run qa 31");
  return Number(value);
}

function lockfileHash(worktree: string): string {
  return createHash("sha256")
    .update(readFileSync(path.join(worktree, "package-lock.json")))
    .digest("hex")
    .slice(0, 16);
}

async function up(pr: number, fresh: boolean) {
  const previous = readInstance(pr);
  const devUrl = databaseUrl();
  const adminUrl = withDatabaseName(devUrl, "postgres");
  const database = `studyloop_pr_${pr}`;
  const databaseUrlForPr = withDatabaseName(devUrl, database);
  const worktree = path.resolve(ROOT, "..", `studyloop-pr-${pr}`);

  step(`PR #${pr}: fetching its latest commit`);
  const { title } = JSON.parse(run("gh", ["pr", "view", String(pr), "--json", "title"], { cwd: ROOT })) as {
    title: string;
  };
  run("git", ["fetch", "--quiet", "origin", `pull/${pr}/head`], { cwd: ROOT });
  const commit = run("git", ["rev-parse", "FETCH_HEAD"], { cwd: ROOT });
  const short = commit.slice(0, 7);

  if (previous) {
    step(`Stopping the running server (${previous.commit.slice(0, 7)})`);
    await stopServer(previous);
  }

  if (existsSync(worktree)) {
    step(`Updating ${worktree} to ${short}`);
    run("git", ["checkout", "--quiet", "--detach", commit], { cwd: worktree });
  } else {
    step(`Creating ${worktree} at ${short}`);
    run("git", ["worktree", "add", "--quiet", "--detach", worktree, commit], { cwd: ROOT });
  }
  // The owner's .env, so the instance signs in and reports issues like their dev server does.
  const ownEnv = path.join(ROOT, ".env");
  if (existsSync(ownEnv) && !existsSync(path.join(worktree, ".env"))) {
    symlinkSync(ownEnv, path.join(worktree, ".env"));
  }

  const lockfile = lockfileHash(worktree);
  if (!existsSync(path.join(worktree, "node_modules")) || previous?.lockfile !== lockfile) {
    step("Installing dependencies (npm ci)");
    runVisibly("npm", ["ci", "--no-audit", "--no-fund"], { cwd: worktree });
  }

  run("docker", ["compose", "up", "-d", "--wait", "db"], { cwd: ROOT });
  if (fresh || !(await databaseExists(adminUrl, database))) {
    step(`Copying the dev database ${new URL(devUrl).pathname.slice(1)} into ${database}`);
    await dropDatabase(adminUrl, database);
    await createDatabaseIfMissing(adminUrl, database);
    copyDatabase(devUrl, databaseUrlForPr);
  } else {
    step(`Keeping ${database} (pass --fresh to re-copy the dev database)`);
  }

  step("Applying the PR's migrations");
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: databaseUrlForPr,
    QA_PR: String(pr),
  };
  runVisibly(path.join(worktree, "node_modules/.bin/tsx"), ["scripts/migrate.ts"], { cwd: worktree, env });

  const port = await instancePort(pr, {
    isFree: isPortFree,
    reserved: allInstances()
      .filter((other) => other.pr !== pr)
      .map((other) => other.port),
    previous: previous?.port,
  });
  const url = `http://localhost:${port}`;

  step(`Starting the dev server on ${url} (log: ${logPath(pr)})`);
  mkdirSync(STATE_DIR, { recursive: true });
  const log = openSync(logPath(pr), "a");
  const server = spawn(path.join(worktree, "node_modules/.bin/next"), ["dev", "--port", String(port)], {
    cwd: worktree,
    env: { ...env, BETTER_AUTH_URL: url, DEV_AUTO_MIGRATE: "1", NODE_ENV: "development" },
    stdio: ["ignore", log, log],
    detached: true,
  });
  server.unref();
  const instance: Instance = {
    pr,
    title,
    commit,
    port,
    pid: server.pid ?? null,
    worktree,
    database,
    lockfile,
    updatedAt: new Date().toISOString(),
  };
  saveInstance(instance);
  await waitUntilServing(url, server.pid!, pr);

  console.log(`\nPR #${pr} · ${short} · ${title}\n${url}`);
}

async function list() {
  const instances = allInstances();
  if (instances.length === 0) {
    console.log("No QA instances. Start one with: npm run qa <pr>");
    return;
  }
  const rows = await Promise.all(
    instances.map(async (instance) => {
      const running = isAlive(instance.pid) && !(await isPortFree(instance.port));
      return [
        `#${instance.pr}`,
        running ? `http://localhost:${instance.port}` : "stopped (npm run qa to restart)",
        instance.commit.slice(0, 7),
        instance.title,
      ];
    }),
  );
  const header = ["PR", "URL", "COMMIT", "TITLE"];
  const widths = header.map((_, column) => Math.max(...[header, ...rows].map((row) => row[column].length)));
  for (const row of [header, ...rows]) {
    console.log(row.map((cell, column) => (column === row.length - 1 ? cell : cell.padEnd(widths[column]))).join("  "));
  }
}

async function done(pr: number) {
  const instance = readInstance(pr);
  const devUrl = databaseUrl();
  const database = `studyloop_pr_${pr}`;
  const worktree = path.resolve(ROOT, "..", `studyloop-pr-${pr}`);

  if (instance) {
    step(`Stopping the server for PR #${pr}`);
    await stopServer(instance);
  }
  step(`Dropping ${database}`);
  await dropDatabase(withDatabaseName(devUrl, "postgres"), database);

  const registered = run("git", ["worktree", "list", "--porcelain"], { cwd: ROOT })
    .split("\n")
    .some((line) => line === `worktree ${worktree}`);
  if (registered) {
    step(`Removing ${worktree}`);
    // --force: the worktree is disposable (installed dependencies, build output, the .env link).
    run("git", ["worktree", "remove", "--force", worktree], { cwd: ROOT });
  }
  run("git", ["worktree", "prune"], { cwd: ROOT });
  rmSync(statePath(pr), { force: true });
  rmSync(logPath(pr), { force: true });
  console.log(`\nPR #${pr}'s QA instance is gone.`);
}

async function main() {
  const envFile = path.join(ROOT, ".env");
  if (existsSync(envFile)) process.loadEnvFile(envFile);

  const [command, ...args] = process.argv.slice(2);
  if (command === "up") return up(parsePr(args.find((arg) => !arg.startsWith("-"))), args.includes("--fresh"));
  if (command === "list") return list();
  if (command === "done") return done(parsePr(args[0]));
  throw new Error("Usage: npm run qa <pr> | npm run qa -- <pr> --fresh | npm run qa:list | npm run qa:done <pr>");
}

main().catch((error) => {
  console.error(`\n[qa] ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
