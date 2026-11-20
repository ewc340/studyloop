#!/bin/bash
# PreToolUse guard (from mattpocock/skills git-guardrails, customized for the AFK loop):
# agents may push their own ticket branches, but never rewrite history, touch main, merge, or delete.

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

DANGEROUS_PATTERNS=(
  "git push.*(--force|-f( |$)|--force-with-lease|--mirror|--delete|-d( |$)|--all)"
  "git push.*[ :+](main|master)( |$)"
  "git push *$"
  "git push +[^ -][^ ]* *$"
  "git reset --hard"
  "git clean -[a-zA-Z]*f"
  "git branch -D"
  "git checkout \.( |$)"
  "git restore \.( |$)"
  "gh pr merge"
  "gh repo (delete|edit|rename)"
  "gh api .*(-X|--method) *DELETE"
  "gh issue (delete|transfer)"
)

for pattern in "${DANGEROUS_PATTERNS[@]}"; do
  if echo "$COMMAND" | grep -qE "$pattern"; then
    echo "BLOCKED: '$COMMAND' matches dangerous pattern '$pattern'. The user has prevented you from doing this. Push only your ticket branch explicitly (git push -u origin <branch>); merging is the user's job." >&2
    exit 2
  fi
done

exit 0
