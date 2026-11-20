#!/usr/bin/env python3
"""PreToolUse guard for Bash: agents may push their own ticket branches, but never touch main,
rewrite or delete history, merge PRs, or delete repos/issues. Merging is the owner's job.

Parses the command like a shell would (quotes, &&/;/|, `bash -c "..."`, `git -C dir`, env prefixes)
instead of pattern-matching raw text. Anything it can't parse is blocked (fails closed).
Exit 2 + stderr message = blocked (Claude Code shows the message to the agent); exit 0 = allowed.
"""
import json
import shlex
import sys

PROTECTED = {"main", "master"}
SEPARATORS = {"&&", "||", ";", "|", "&", "(", ")", "\n"}
SHELLS = {"bash", "sh", "zsh"}
WRAPPERS = {"sudo", "env", "command", "exec", "time", "nohup"}


class Blocked(Exception):
    pass


def segments(command: str) -> list[list[str]]:
    lexer = shlex.shlex(command.replace("\\\n", " "), posix=True, punctuation_chars=";&|()\n")
    lexer.whitespace_split = True
    lexer.commenters = ""
    parts: list[list[str]] = [[]]
    for token in lexer:
        if token in SEPARATORS or set(token) <= set(";&|()\n"):
            parts.append([])
        else:
            parts[-1].append(token)
    return [p for p in parts if p]


def strip_prefixes(words: list[str]) -> list[str]:
    i = 0
    while i < len(words):
        w = words[i]
        if "=" in w and not w.startswith("-") and w.split("=", 1)[0].isidentifier():
            i += 1  # FOO=bar
        elif w in WRAPPERS:
            i += 1
        else:
            break
    return words[i:]


def git_subcommand(words: list[str]) -> tuple[str, list[str]] | None:
    """For `git [-C dir] [-c k=v] ... <sub> args`, return (sub, args)."""
    i = 1
    while i < len(words):
        w = words[i]
        if w in ("-C", "-c", "--git-dir", "--work-tree", "--namespace"):
            i += 2
        elif w.startswith("--git-dir=") or w.startswith("--work-tree=") or w.startswith("-c"):
            i += 1
        elif w.startswith("-"):
            i += 1
        else:
            return w, words[i + 1 :]
    return None


def short_flags(args: list[str]) -> set[str]:
    flags: set[str] = set()
    for a in args:
        if a.startswith("-") and not a.startswith("--") and len(a) > 1:
            flags.update(a[1:])
    return flags


def ref_name(ref: str) -> str:
    ref = ref.lstrip("+")
    if ":" in ref:
        ref = ref.split(":", 1)[1]
    return ref.removeprefix("refs/heads/")


def check_git_push(args: list[str]) -> None:
    long_flags = {a.split("=", 1)[0] for a in args if a.startswith("--")}
    forbidden = {"--force", "--force-with-lease", "--mirror", "--delete", "--all", "--prune", "--tags"}
    if long_flags & forbidden:
        raise Blocked("force/mirror/delete/all pushes are not allowed")
    if short_flags(args) & {"f", "d"}:
        raise Blocked("force (-f) and delete (-d) pushes are not allowed")
    positional = [a for a in args if not a.startswith("-")]
    if len(positional) < 2:
        raise Blocked("push an explicit branch: git push -u origin <branch>")
    for ref in positional[1:]:
        if ref.startswith("+"):
            raise Blocked("'+' refspecs force-push")
        if ref.startswith(":"):
            raise Blocked("':branch' refspecs delete remote branches")
        target = ref_name(ref)
        if target in PROTECTED:
            raise Blocked(f"pushing to {target} is not allowed")
        if target in ("HEAD", "@"):
            raise Blocked("push your branch by name, not HEAD")


def check_git(words: list[str]) -> None:
    sub = git_subcommand(words)
    if not sub:
        return
    name, args = sub
    flags = {a.split("=", 1)[0] for a in args}
    if name == "push":
        check_git_push(args)
    elif name == "reset" and "--hard" in flags:
        raise Blocked("git reset --hard discards work")
    elif name == "clean" and ("--force" in flags or "f" in short_flags(args)):
        raise Blocked("git clean -f deletes files")
    elif name in ("checkout", "restore") and "." in args:
        raise Blocked(f"git {name} . discards all changes")
    elif name == "branch" and ("D" in short_flags(args) or {"--delete", "--force"} <= flags):
        raise Blocked("force-deleting branches is not allowed")


def check_gh(words: list[str]) -> None:
    args = words[1:]
    if args[:2] == ["pr", "merge"]:
        raise Blocked("merging PRs is the owner's job")
    if args[:1] == ["repo"] and args[1:2] and args[1] in ("delete", "edit", "rename", "archive"):
        raise Blocked(f"gh repo {args[1]} is not allowed")
    if args[:1] == ["issue"] and args[1:2] and args[1] in ("delete", "transfer"):
        raise Blocked(f"gh issue {args[1]} is not allowed")
    if args[:1] == ["api"]:
        method = "GET"
        for i, a in enumerate(args):
            if a in ("-X", "--method") and i + 1 < len(args):
                method = args[i + 1]
            elif a.startswith("--method=") or (a.startswith("-X") and len(a) > 2):
                method = a.split("=", 1)[1] if "=" in a else a[2:]
        endpoint = next((a for a in args[1:] if not a.startswith("-") and "/" in a), "")
        if method.upper() == "DELETE":
            raise Blocked("DELETE via gh api is not allowed")
        if endpoint.rstrip("/").endswith("/merge") or "/git/refs" in endpoint:
            raise Blocked("merging or editing refs via gh api is not allowed")


def check(command: str, depth: int = 0) -> None:
    if depth > 3:
        raise Blocked("command nesting too deep to check")
    for words in segments(command):
        words = strip_prefixes(words)
        if not words:
            continue
        program = words[0].rsplit("/", 1)[-1]
        if program in SHELLS and "-c" in words:
            i = words.index("-c")
            if i + 1 < len(words):
                check(words[i + 1], depth + 1)
        elif program == "git":
            check_git(words)
        elif program == "gh":
            check_gh(words)


def main() -> int:
    try:
        payload = json.load(sys.stdin)
        command = payload["tool_input"]["command"]
        if not isinstance(command, str):
            raise ValueError("command is not a string")
        check(command)
    except Blocked as reason:
        print(
            f"BLOCKED by .claude/hooks/block_dangerous_git.py: {reason}. The owner has prevented this. "
            "Push only your ticket branch by name (git push -u origin <branch>); merging is the owner's job.",
            file=sys.stderr,
        )
        return 2
    except Exception as error:  # fail closed
        print(f"BLOCKED: could not safely check this command ({error}). Simplify it and retry.", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
