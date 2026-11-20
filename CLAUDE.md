# studyloop

@AGENTS.md

## Working in this repo

- Node 24 (`nvm use`); Postgres via `npm run db:up`.
- Domain logic goes in `src/core` behind its public interface (`src/core/index.ts`); never import Next.js there. UI code in `src/app` stays a thin adapter.
- Tests exercise the core's public interface against real Postgres using `useTestContext()` (fake Clock from `src/test/fake-clock.ts`, tables truncated per test). Don't mock the database or internal modules.
- Before pushing, `npm run check` must pass (lint, typecheck, core tests, e2e).
- After changing `src/core/db/schema.ts`, run `npm run db:generate` and commit the migration.

## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues on ewc340/studyloop (via `gh`), using native blocking links and sub-issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` at the repo root plus `docs/adr/`. See `docs/agents/domain.md`.
