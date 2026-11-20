#!/usr/bin/env bash
# Prints the AFK loop's next move as one line:
#   RESUME <n>   our unfinished ticket: assigned to us, still open, and no PR of ours is out of draft
#                (same ordering as START if there are several)
#   START <n>    the next open, unassigned, unblocked ready-for-agent ticket: those labelled
#                `priority` first, then lowest number
#   NONE         nothing to do
# Tickets are the sub-issues of the spec issue (SPEC_ISSUE, default 1). The spec itself and anything
# labelled ready-for-human are never picked. A ticket whose PR is ready for review is finished from
# the loop's point of view (it closes when the owner merges).
set -euo pipefail

SPEC_ISSUE="${SPEC_ISSUE:-1}"
REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
ME="$(gh api user -q .login)"

candidates="$(gh api --paginate "repos/$REPO/issues/$SPEC_ISSUE/sub_issues?per_page=100" \
  --jq '.[] | select(.state == "open")
        | select(any(.labels[]; .name == "ready-for-agent"))
        | select(all(.labels[]; .name != "ready-for-human"))
        | "\(if any(.labels[]; .name == "priority") then 0 else 1 end) \(.number) \([.assignees[].login] | join(","))"' \
  | sort -k1,1n -k2,2n | cut -d' ' -f2-)"

# Ticket numbers that already have a ready-for-review PR from a claude/<n>-* branch.
handed_over="$(gh pr list --state open --limit 100 --json headRefName,isDraft \
  --jq '.[] | select(.isDraft | not) | .headRefName | capture("^claude/(?<n>[0-9]+)-").n' || true)"

is_handed_over() { grep -qx "$1" <<< "$handed_over"; }

open_blockers() {
  local n="$1" count body refs
  count="$(gh api "repos/$REPO/issues/$n" --jq '.issue_dependencies_summary.blocked_by // "none"')"
  if [ "$count" != "none" ]; then
    echo "$count"
    return
  fi
  # Fallback (see docs/agents/issue-tracker.md): a "Blocked by: #a, #b" line in the body.
  body="$(gh issue view "$n" --json body -q .body)"
  refs="$(grep -i '^blocked by:' <<< "$body" | grep -o '#[0-9]*' | tr -d '#' || true)"
  count=0
  for ref in $refs; do
    [ "$(gh issue view "$ref" --json state -q .state)" = "OPEN" ] && count=$((count + 1))
  done
  echo "$count"
}

# Resume our own unfinished ticket first.
while read -r number assignees; do
  [ -z "${number:-}" ] && continue
  if [[ ",$assignees," == *",$ME,"* ]] && ! is_handed_over "$number"; then
    echo "RESUME $number"
    exit 0
  fi
done <<< "$candidates"

# Otherwise the first unassigned ticket with no open blockers.
while read -r number assignees; do
  [ -z "${number:-}" ] && continue
  [ -n "$assignees" ] && continue
  if [ "$(open_blockers "$number")" = "0" ]; then
    echo "START $number"
    exit 0
  fi
done <<< "$candidates"

echo "NONE"
