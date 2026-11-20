#!/usr/bin/env bash
# Prints the AFK loop's next move as one line:
#   RESUME <n>   an open ready-for-agent ticket already assigned to us (a previous run stopped mid-way)
#   START <n>    the lowest-numbered open, unassigned, unblocked ready-for-agent ticket
#   NONE         nothing to do
# Tickets are the sub-issues of the spec issue (SPEC_ISSUE, default 1). The spec itself and
# ready-for-human tickets are never picked.
set -euo pipefail

SPEC_ISSUE="${SPEC_ISSUE:-1}"
REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
ME="$(gh api user -q .login)"

candidates="$(gh api --paginate "repos/$REPO/issues/$SPEC_ISSUE/sub_issues?per_page=100" \
  --jq '.[] | select(.state == "open") | select(any(.labels[]; .name == "ready-for-agent"))
        | "\(.number) \([.assignees[].login] | join(","))"' | sort -n)"

# Resume our own unfinished ticket first.
while read -r number assignees; do
  [ -z "${number:-}" ] && continue
  if [[ ",$assignees," == *",$ME,"* ]]; then
    echo "RESUME $number"
    exit 0
  fi
done <<< "$candidates"

# Otherwise the first unassigned ticket with no open blockers.
while read -r number assignees; do
  [ -z "${number:-}" ] && continue
  [ -n "$assignees" ] && continue
  open_blockers="$(gh api "repos/$REPO/issues/$number" --jq '.issue_dependencies_summary.blocked_by // 0')"
  if [ "$open_blockers" = "0" ]; then
    echo "START $number"
    exit 0
  fi
done <<< "$candidates"

echo "NONE"
