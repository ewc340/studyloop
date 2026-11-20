"""Run: python3 -m unittest discover -s .claude/hooks"""
import json
import subprocess
import sys
import unittest
from pathlib import Path

HOOK = Path(__file__).with_name("block_dangerous_git.py")


def run(command) -> int:
    payload = command if isinstance(command, str) and command.startswith("RAW:") else None
    stdin = payload[4:] if payload else json.dumps({"tool_input": {"command": command}})
    return subprocess.run([sys.executable, str(HOOK)], input=stdin, text=True, capture_output=True).returncode


BLOCKED = [
    "git push origin main",
    "git push origin master",
    "git push",
    "git push origin",
    "git push origin HEAD",
    "git push -u origin HEAD",
    "git push origin HEAD:main",
    "git push origin HEAD:refs/heads/main",
    "git push origin 'main'",
    'git push origin "main"',
    "git push origin \\\nmain",
    "git -C . push origin main",
    "git -C /x push --force origin claude/4-topics",
    "git push --force origin claude/4-topics",
    "git push --force-with-lease origin claude/4-topics",
    "git push -f origin claude/4-topics",
    "git push -fu origin claude/4-topics",
    "git push origin +claude/4-topics",
    "git push origin :claude/4-topics",
    "git push origin --delete claude/4-topics",
    "git push --mirror origin",
    "FOO=1 git push origin main",
    "sudo git push origin main",
    'bash -c "git push origin main"',
    "echo hi && git push origin main",
    "git reset --hard HEAD~1",
    "git reset  --hard",
    "git clean -fd",
    "git clean --force",
    "git checkout .",
    "git checkout -- .",
    "git restore .",
    "git branch -D claude/4-topics",
    "git branch --delete --force claude/4-topics",
    "gh pr merge 23",
    "gh pr merge 23 --squash",
    "gh repo delete ewc340/studyloop --yes",
    "gh issue delete 4",
    "gh api -X DELETE repos/x/y/git/refs/heads/z",
    "gh api --method=DELETE repos/x/y",
    "gh api -X PUT repos/x/y/pulls/5/merge",
    "RAW:not json",
    "RAW:{}",
    "git push origin 'unterminated",
]

ALLOWED = [
    "git push -u origin claude/4-topics",
    "git push origin claude/4-topics",
    "git push origin HEAD:claude/4-topics",
    "git push -u origin claude/4-topics && gh pr create --draft --base main --title T --body 'Closes #4'",
    "git push origin claude/4-topics && rm -f tmp.txt",
    'git commit -m "avoid git reset --hard and git push origin main"',
    "gh pr create --base main --head claude/4-topics --body 'never run gh pr merge'",
    "gh pr ready 23",
    "gh pr edit 23 --body-file body.md",
    "gh issue edit 4 --add-assignee @me",
    "gh api repos/ewc340/studyloop/issues/4 --jq .issue_dependencies_summary",
    "git checkout -b claude/4-topics origin/main",
    "git checkout src/app/page.tsx",
    "git pull origin main",
    "git fetch origin",
    "git reset HEAD~1",
    "git branch -d claude/old",
    "git status && npm run check",
    "npm run check",
    "ls -la",
]


class GuardrailTest(unittest.TestCase):
    def test_blocks_dangerous_commands(self):
        for command in BLOCKED:
            with self.subTest(command=command):
                self.assertEqual(run(command), 2)

    def test_allows_normal_work(self):
        for command in ALLOWED:
            with self.subTest(command=command):
                self.assertEqual(run(command), 0)


if __name__ == "__main__":
    unittest.main()
