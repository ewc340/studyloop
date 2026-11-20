# studyloop

A self-hosted study loop: track what you learn day to day, connect topics, and plan study toward deadlines. First use case: interview prep — the Gaps your interviews expose feed your Study Queue.

Spec: [#1](https://github.com/ewc340/studyloop/issues/1) · Vocabulary: [GLOSSARY.md](./GLOSSARY.md)

## Requirements

- Node 24 (`nvm use`)
- Docker (for Postgres)

## Run it

```sh
npm install
cp .env.example .env   # optional; defaults match docker-compose.yml
npm run dev            # starts Postgres and Next.js on :3000; the server applies pending migrations on start
```

## Test it

```sh
npm test               # core tests against a throwaway Postgres database
npm run e2e            # Playwright, phone viewport, against a dedicated e2e database
npm run check          # lint + typecheck + tests + hook tests + e2e + build (what CI runs)
```

## Report issues from the app

The owner can report a bug or idea from any page (the round button, bottom right): it captures the page with private content masked, takes optional attached images, previews the exact issue, and posts it here labelled `needs-triage`. Images are committed to the `feedback-assets` branch and embedded by URL. To turn it on, set `ISSUE_REPORTING_GITHUB_TOKEN` (a fine-grained token for this repository with Issues and Contents read/write) and `ISSUE_REPORTING_OWNER_EMAIL` (see `.env.example`). Without both, nobody sees the control.

## AFK loop

Tickets labelled `ready-for-agent` can be implemented unattended: `./ralph/once.sh` (watch one), `./ralph/afk.sh 3` (headless), or a nightly cloud routine. See [ralph/README.md](./ralph/README.md).

## Architecture

- **`src/core`** — all domain logic, framework-free. Every operation takes a `CoreContext` (database, Clock, and later the acting Learner and other ports). Its public interface is `src/core/index.ts`; ESLint blocks imports of core internals from outside, and Next.js/React imports inside core.
- **`src/app`** — Next.js UI; thin adapters that build a `CoreContext` (`src/server/core.ts`) and call core.
- **`drizzle/`** — SQL migrations (`npm run db:generate` after schema changes, `npm run db:migrate` to apply).
- **Tests** call the core's public interface against real Postgres with a fake Clock (`src/test/core-harness.ts`); one Playwright suite covers the UI end to end.
