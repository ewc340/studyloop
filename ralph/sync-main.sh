#!/usr/bin/env bash
# Puts this checkout on the latest origin/main (detached), so every AFK run starts from current
# code, prompt and picker no matter which branch was checked out before.
# Refuses to touch a checkout with uncommitted changes to tracked files.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "[sync] This checkout has uncommitted changes. Commit or stash them, then rerun." >&2
  git status --short --untracked-files=no >&2
  exit 1
fi

git fetch --quiet origin
git switch --quiet --detach origin/main
echo "[sync] On origin/main @ $(git rev-parse --short HEAD)"
