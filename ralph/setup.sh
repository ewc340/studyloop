#!/usr/bin/env bash
# Prepares a machine (a laptop or a fresh cloud VM) for an AFK run: Node 24, dependencies,
# a local .env with test-only placeholders (never overwrites an existing one), Postgres, Playwright.
set -euo pipefail
cd "$(dirname "$0")/.."

log() { printf '\n[setup] %s\n' "$*"; }

# --- Node 24
if [ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]; then
  # shellcheck disable=SC1091
  source "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
  nvm install >/dev/null 2>&1 || true
  nvm use >/dev/null
fi
if ! command -v node >/dev/null 2>&1; then
  echo "[setup] Node is not installed. Install Node 24 (e.g. via nvm) and retry." >&2
  exit 1
fi
major="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$major" -lt 24 ]; then
  echo "[setup] Node $major found; Node 24+ is required (see .nvmrc)." >&2
  exit 1
fi
log "Node $(node --version)"

# --- Dependencies
if [ ! -d node_modules ] || [ package-lock.json -nt node_modules ]; then
  log "Installing dependencies"
  npm ci
fi

# --- .env (test-only placeholders; real secrets only ever live in a developer's own .env)
# Each checkout gets its own dev and e2e databases on the shared Postgres server, so an AFK run
# never touches the owner's dev data or another checkout's e2e data.
if [ ! -f .env ]; then
  log "Creating .env with test-only placeholders"
  # wt_ prefix: always a valid, unquoted Postgres name (never starts with a digit, never "studyloop");
  # capped so "<name>_dev"/"<name>_e2e" stay under Postgres's 63-character limit.
  checkout="wt_$(basename "$PWD" | tr 'A-Z' 'a-z' | tr -c 'a-z0-9\n' '_' | cut -c1-40)"
  cp .env.example .env
  sed -i.bak \
    -e "s|^DATABASE_URL=.*|DATABASE_URL=postgres://studyloop:studyloop@localhost:5432/${checkout}_dev|" \
    -e 's|^GITHUB_CLIENT_ID=$|GITHUB_CLIENT_ID=afk-placeholder|' \
    -e 's|^GITHUB_CLIENT_SECRET=$|GITHUB_CLIENT_SECRET=afk-placeholder|' \
    -e "s|^BETTER_AUTH_SECRET=\$|BETTER_AUTH_SECRET=afk-only-$(od -An -N16 -tx1 /dev/urandom | tr -d ' \n')|" \
    .env && rm -f .env.bak
  printf '\n# This checkout'"'"'s own e2e database (read by playwright.config.ts and ralph/screenshots.ts).\nE2E_DATABASE_URL=postgres://studyloop:studyloop@localhost:5432/%s_e2e\n' "$checkout" >> .env
fi

# --- Docker + Postgres
if ! docker info >/dev/null 2>&1; then
  log "Starting Docker"
  if [ "$(uname)" = "Darwin" ]; then
    open -a Docker
  else
    (sudo service docker start || sudo systemctl start docker || (sudo dockerd >/tmp/dockerd.log 2>&1 &)) >/dev/null 2>&1 || true
  fi
  for _ in $(seq 1 60); do docker info >/dev/null 2>&1 && break; sleep 2; done
  docker info >/dev/null 2>&1 || { echo "[setup] Docker did not start." >&2; exit 1; }
fi
log "Starting Postgres (shared by all checkouts)"
npm run db:up
# No migrate here: core tests create their own databases, e2e prepares its own, and `npm run dev`
# creates and migrates this checkout's dev database on start.

# --- Playwright browser
log "Installing Playwright Chromium"
if [ "$(uname)" = "Linux" ]; then
  npx playwright install --with-deps chromium
else
  npx playwright install chromium
fi

log "Ready"
