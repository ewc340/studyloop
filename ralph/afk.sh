#!/usr/bin/env bash
# The AFK loop: one fresh, headless Claude session per ticket until there's no work, a ticket
# is blocked, or the iteration cap is hit. Progress streams to this terminal; full transcripts
# go to ralph/logs/.
# Usage: ./ralph/afk.sh [max-tickets]   (default 3)
# Stops early once AFK_WIP_LIMIT (default 5) agent PRs are waiting for review (see next-ticket.sh).
set -uo pipefail
cd "$(dirname "$0")/.."

MAX="${1:-3}"
if ! [[ "$MAX" =~ ^[1-9][0-9]*$ ]]; then echo "Usage: ./ralph/afk.sh [max-tickets]" >&2; exit 2; fi
mkdir -p ralph/logs

for i in $(seq 1 "$MAX"); do
  stamp="$(date +%Y%m%d-%H%M%S)"
  log="ralph/logs/$stamp.jsonl"
  printf '\n━━━ AFK iteration %s/%s · %s · transcript: %s ━━━\n' "$i" "$MAX" "$stamp" "$log"

  # Each run starts from the latest main (the previous run ended on its ticket branch).
  bash ralph/sync-main.sh || { echo "Stopped: couldn't sync to origin/main (see above)."; exit 1; }

  claude -p "$(cat ralph/prompt.md)" \
    --permission-mode auto \
    --output-format stream-json --verbose \
    | tee "$log" \
    | jq -j --unbuffered -f ralph/format-stream.jq

  status="${PIPESTATUS[0]}"
  final="$(jq -r 'select(.type == "result") | .result // ""' "$log" | awk 'NF { line = $0 } END { print line }')"
  printf '\n━━━ iteration %s ended (exit %s): %s ━━━\n' "$i" "$status" "${final:-<no final line>}"

  if [ "$status" != "0" ]; then
    echo "Stopped: claude exited with status $status. Check $log."
    exit 1
  fi

  case "$final" in
    DONE*) continue ;;
    NO_WORK*) echo "No unblocked ready-for-agent tickets left."; exit 0 ;;
    WAITING*) echo "Stopped: ${AFK_WIP_LIMIT:-5} or more agent PRs are waiting for your review (AFK_WIP_LIMIT). Review or merge some, then run again."; exit 0 ;;
    BLOCKED*) echo "Stopped: a ticket needs a human (see the issue comment)."; exit 0 ;;
    *) echo "Stopped: run ended without a final status line (limit reached or error). Check $log." ; exit 1 ;;
  esac
done

echo "Reached the iteration cap ($MAX)."
