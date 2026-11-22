# ralph: the AFK loop

An agent picks the next unblocked `ready-for-agent` ticket (a sub-issue of spec #1), implements it test-first, reviews its own work, and opens a PR. **You merge.** One fresh Claude session per ticket.

| File | What it does |
|---|---|
| `prompt.md` | The instructions every run follows (pick → claim → draft PR → TDD → screenshots → code review → PR → CI green). |
| `next-ticket.sh` | Deterministically picks the work: `RESUME <n>` (ours, assigned, PR still draft), `START <n>` (unblocked, unassigned; `priority`-labelled first, then lowest number), or `NONE`. Never the spec or `ready-for-human`. |
| `screenshots.ts` | Agent QA: phone-sized screenshots of changed pages into `docs/screenshots/<n>/`, embedded in the PR. |
| `sync-main.sh` | Puts the checkout on the latest `origin/main` (detached) before every run, so a stale branch can't mean a stale prompt or picker. Refuses if tracked files have uncommitted changes. |
| `setup.sh` | Prepares a checkout: Node 24, `npm ci`, a placeholder `.env` if none exists (with this checkout's own `wt_<folder>_dev` / `wt_<folder>_e2e` databases), the shared Postgres server, Playwright. All checkouts share one Postgres server: `npm run db:down` anywhere stops it for all, and `down -v` wipes everyone's data. |
| `once.sh` | One ticket, **interactive** — watch it and step in. |
| `afk.sh [n]` | Up to `n` tickets (default 3), **headless**, live progress in the terminal, transcripts in `ralph/logs/`. Stops on `NO_WORK`, `BLOCKED`, `SETUP_FAILED`, or an unfinished run. |
| `format-stream.jq` | Renders the headless stream as a readable log. |

## Safety rails

- Runs use `--permission-mode auto`: every action is checked by the auto-mode classifier; there is no blanket allowlist.
- `.claude/hooks/block_dangerous_git.py` parses every Bash command (quotes, `&&`, `bash -c`, `git -C`) and blocks pushes to `main` or `HEAD`, force-pushes and `+`/`:` refspecs, merging PRs, deleting branches/repos/issues, `reset --hard`, `clean -f`; it fails closed. Its cases are tested in CI (`npm run test:hooks`).
- Recommended on GitHub as a server-side backstop: a ruleset on `main` that blocks direct pushes, force-pushes and deletion.
- Don't assign yourself `ready-for-agent` tickets: assigned tickets are what the loop resumes. Relabel to `ready-for-human` instead.
- Ticket branches are `claude/<n>-<slug>`; work is pushed after every green step and a draft PR is opened at the start, so a run cut off by usage limits loses little and the next run resumes it.
- A ticket the agent can't finish gets a comment and `needs-info` instead of a guess.

## Run it locally

```sh
./ralph/once.sh        # first runs: watch one ticket
./ralph/afk.sh 3       # then: up to three tickets back to back
```

Both switch this checkout to the latest `origin/main` first (detached HEAD). A run that builds a ticket leaves it on that ticket's branch; a `NO_WORK` or `BLOCKED` run leaves it detached on main. Run `git switch main` when you want your own branch back. Keep the dev server (`npm run dev`) in a separate terminal; it follows whatever is checked out.

Watch progress in the terminal, or on GitHub (the claimed issue, the draft PR, the Actions tab). Stop any time with `Ctrl+C`. A ticket counts as handed over once its PR is out of draft; the next run moves on.

## Run it overnight in the cloud (Claude Code routine)

Cloud runs can't see `~/.claude/skills`, so the skills they need are committed in `.claude/skills/`.

1. In Claude Code, run `/schedule` (or open claude.ai/code → Routines) and create a routine on this repository:
   - **Prompt:** `Read ralph/prompt.md and follow it exactly.`
   - **Schedule:** daily, after your own usage for the day (cron is UTC).
2. Make sure the Claude GitHub App has access to the repo, so the run can push `claude/…` branches and open PRs.
3. Use **Run now** once while watching the session at claude.ai/code, then leave it scheduled.

A run that hits a usage limit simply stops; its pushed commits and draft PR remain, and the next run resumes the ticket (`RESUME <n>`).
