# ralph: the AFK loop

An agent picks the next unblocked `ready-for-agent` ticket (a sub-issue of spec #1), implements it test-first, reviews its own work, and opens a PR. **You merge.** One fresh Claude session per ticket.

| File | What it does |
|---|---|
| `prompt.md` | The instructions every run follows (pick → claim → draft PR → TDD → screenshots → code review → PR → CI green). |
| `next-ticket.sh` | Deterministically picks the work: `RESUME <n>` (ours, assigned, PR still draft), `START <n>` (unblocked, unassigned; `priority`-labelled first, then lowest number), `WAIT` (see **WIP limit**) or `NONE`. Never the spec or `ready-for-human`. Tested in `ralph/tests/` (`npm run test:ralph`). |
| `screenshots.ts` | Agent QA: phone-sized screenshots of changed pages into `docs/screenshots/<n>/`, embedded in the PR. |
| `sync-main.sh` | Puts the checkout on the latest `origin/main` (detached) before every run, so a stale branch can't mean a stale prompt or picker. Refuses if tracked files have uncommitted changes. |
| `setup.sh` | Prepares a machine: Node 24, `npm ci`, a placeholder `.env` if none exists, Docker + Postgres, Playwright. |
| `once.sh` | One ticket, **interactive** — watch it and step in. |
| `afk.sh [n]` | Up to `n` tickets (default 3), **headless**, live progress in the terminal, transcripts in `ralph/logs/`. Stops on `NO_WORK`, `WAITING`, `BLOCKED`, or an unfinished run. |
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

## WIP limit

The loop never produces more PRs than you can review. When `AFK_WIP_LIMIT` (default **5**) or more agent PRs (`claude/*` branches) are open and ready for review, `next-ticket.sh` prints `WAIT` instead of starting a ticket; the run ends with `WAITING` and `afk.sh` stops, telling you so. Finishing an unfinished ticket (`RESUME`) is still allowed. Change the limit per run: `AFK_WIP_LIMIT=3 ./ralph/afk.sh`.

## QA PRs before merging

Each PR gets its own running instance, so you can QA several side by side without touching your own checkout or dev data:

```sh
npm run qa 31          # create PR #31's instance, or update it to the PR's latest commit; prints its URL
npm run qa -- 31 --fresh   # the same, re-copying the database from your dev database
npm run qa:list        # instances: PR, URL, commit, title
npm run qa:done 31     # stop its server, drop its database, remove its worktree (safe to repeat)
```

An instance is:
- a git worktree at `../studyloop-pr-<n>` on the PR's latest commit, with its own `npm ci` and a link to your `.env`;
- a database `studyloop_pr_<n>`, first a **copy of your dev database** (taken with `pg_dump`, so `npm run dev` can keep running), then migrated with the PR's migrations. Re-running keeps it, so data you entered while testing survives an update; `--fresh` starts over from dev;
- a dev server on port 3000 + PR number, or the next free port. Never 3100: e2e and agent screenshots reuse whatever server listens there. Its log is `.qa/<n>.log`.

Your dev server's session cookie is shared across `localhost` ports, and the copy carries your session, so being signed in on `npm run dev` should sign you in on an instance too. If an instance shows the sign-in page, sign in on your dev server and run `npm run qa -- <n> --fresh`.

**Build badge.** Outside production, every page shows which build it is, bottom centre: `PR #<n> · <sha>` in a QA instance, `<branch> · <sha>` in plain dev. Issues you file with the in-app reporter carry the same commit, plus the PR number when filed from a QA instance.

## Tracing an issue back to its PR

1. **Before merging**, QA each PR in its own instance. File what you find from there: the report names the PR.
2. **After merging a batch**, do a quick check on `main` (`git switch main && git pull`, then `npm run dev`).
3. **An issue found on `main`** carries the commit (from the badge, or the reporter's App version row). `/triage` finds the PR that introduced it and links it from the new ticket:
   - `gh pr list --state merged --search <sha>` names the PR a commit came from;
   - when the commit is a merge of several PRs, or the issue just appeared somewhere in a batch, `git bisect start <bad-sha> <last-good-sha>` and `git bisect run` with a reproducing test finds the first bad commit, then search for its PR as above.

## Run it overnight in the cloud (Claude Code routine)

Cloud runs can't see `~/.claude/skills`, so the skills they need are committed in `.claude/skills/`.

1. In Claude Code, run `/schedule` (or open claude.ai/code → Routines) and create a routine on this repository:
   - **Prompt:** `Read ralph/prompt.md and follow it exactly.`
   - **Schedule:** daily, after your own usage for the day (cron is UTC).
2. Make sure the Claude GitHub App has access to the repo, so the run can push `claude/…` branches and open PRs.
3. Use **Run now** once while watching the session at claude.ai/code, then leave it scheduled.

A run that hits a usage limit simply stops; its pushed commits and draft PR remain, and the next run resumes the ticket (`RESUME <n>`).
