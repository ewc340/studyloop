#!/usr/bin/env bash
# One AFK iteration, interactively: you watch every step and can interrupt or redirect.
# Usage: ./ralph/once.sh
set -euo pipefail
cd "$(dirname "$0")/.."

bash ralph/sync-main.sh

exec claude --permission-mode auto "$(cat ralph/prompt.md)"
