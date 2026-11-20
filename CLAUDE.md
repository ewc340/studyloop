# studyloop

@AGENTS.md

## Working in this repo

- Node 24 (`nvm use`); Postgres via `npm run db:up`.
- Domain logic goes in `src/core` behind its public interface (`src/core/index.ts`); never import Next.js there. UI code in `src/app` stays a thin adapter.
- Tests exercise the core's public interface against real Postgres using `useTestContext()` (fake Clock from `src/test/fake-clock.ts`, tables truncated per test). Don't mock the database or internal modules.
- `npm run check` (lint, typecheck, core tests, hook tests, e2e, build) must pass before a PR is opened for review or marked ready. Work-in-progress pushes to your own ticket branch behind a draft PR are fine before that.
- After adding, removing or upgrading dependencies, run `npm run deps:relock` and commit `package-lock.json`. Incremental `npm install` on macOS drops Linux-only optional packages and breaks `npm ci` in CI.
- After changing `src/core/db/schema.ts`, run `npm run db:generate` and commit the migration.
- Git guardrails: `.claude/hooks/block_dangerous_git.py` (the single source of truth for what's blocked). Push your ticket branch by name (`git push -u origin <branch>`); merging is the owner's job.
- The AFK loop (unattended ticket runs) is described in `ralph/README.md`; its instructions are `ralph/prompt.md`.

## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues on ewc340/studyloop (via `gh`), using native blocking links and sub-issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` at the repo root plus `docs/adr/`. See `docs/agents/domain.md`.
