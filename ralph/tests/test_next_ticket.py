"""Run: python3 -m unittest discover -s ralph/tests

Runs ralph/next-ticket.sh against a fake `gh` that answers from fixtures (applying `--jq`/`-q`
with the real jq, as gh does), so the picker's decisions are tested without touching GitHub.
"""
import json
import os
import subprocess
import tempfile
import textwrap
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "next-ticket.sh"

FAKE_GH = textwrap.dedent(
    """\
    #!/usr/bin/env python3
    import json, os, re, subprocess, sys

    state = json.load(open(os.environ["FAKE_GH_STATE"]))
    args = sys.argv[1:]
    jq = None
    for flag in ("--jq", "-q"):
        if flag in args:
            i = args.index(flag)
            jq = args[i + 1]
            del args[i : i + 2]

    def answer(data):
        if jq is None:
            print(json.dumps(data))
        else:
            sys.stdout.write(subprocess.run(["jq", "-r", jq], input=json.dumps(data), text=True,
                                            capture_output=True, check=True).stdout)
        sys.exit(0)

    joined = " ".join(args)
    if joined.startswith("repo view"):
        answer({"nameWithOwner": "owner/repo"})
    if joined == "api user":
        answer({"login": "agent"})
    if "sub_issues" in joined:
        answer(state["tickets"])
    if joined.startswith("pr list"):
        answer(state["prs"])
    m = re.fullmatch(r"api repos/owner/repo/issues/(\\d+)", joined)
    if m:
        answer({"issue_dependencies_summary": {"blocked_by": 0}})
    sys.stderr.write("fake gh: unexpected call: " + joined + "\\n")
    sys.exit(1)
    """
)


def ticket(number, assignees=(), labels=("ready-for-agent",)):
    return {
        "number": number,
        "state": "open",
        "labels": [{"name": label} for label in labels],
        "assignees": [{"login": login} for login in assignees],
    }


def ready_pr(branch):
    return {"headRefName": branch, "isDraft": False}


def ready_agent_prs(count):
    return [ready_pr(f"claude/{100 + i}-done") for i in range(count)]


class NextTicketTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        bin_dir = Path(self.tmp.name) / "bin"
        bin_dir.mkdir()
        gh = bin_dir / "gh"
        gh.write_text(FAKE_GH)
        gh.chmod(0o755)
        self.bin_dir = bin_dir

    def next_ticket(self, tickets, prs, **env):
        state = Path(self.tmp.name) / "state.json"
        state.write_text(json.dumps({"tickets": tickets, "prs": prs}))
        result = self.run_script(state, env)
        self.assertEqual(result.returncode, 0, result.stderr)
        return result.stdout.strip()

    def run_script(self, state, env):
        inherited = {key: value for key, value in os.environ.items() if key != "AFK_WIP_LIMIT"}
        full_env = {
            **inherited,
            "PATH": f"{self.bin_dir}{os.pathsep}{os.environ['PATH']}",
            "FAKE_GH_STATE": str(state),
            **env,
        }
        return subprocess.run(["bash", str(SCRIPT)], env=full_env, text=True, capture_output=True)

    def test_starts_the_next_ticket_below_the_wip_limit(self):
        self.assertEqual(self.next_ticket([ticket(7)], ready_agent_prs(4)), "START 7")

    def test_waits_at_the_default_limit_of_five_ready_agent_prs(self):
        self.assertEqual(self.next_ticket([ticket(7)], ready_agent_prs(5)), "WAIT")

    def test_waits_above_the_limit(self):
        self.assertEqual(self.next_ticket([ticket(7)], ready_agent_prs(6)), "WAIT")

    def test_the_limit_is_configurable(self):
        self.assertEqual(self.next_ticket([ticket(7)], ready_agent_prs(2), AFK_WIP_LIMIT="2"), "WAIT")
        self.assertEqual(self.next_ticket([ticket(7)], ready_agent_prs(5), AFK_WIP_LIMIT="6"), "START 7")

    def test_draft_and_non_agent_prs_do_not_count(self):
        prs = ready_agent_prs(4) + [
            {"headRefName": "claude/200-wip", "isDraft": True},
            ready_pr("owner-tooling"),
            ready_pr("feature/claude-ish"),
        ]
        self.assertEqual(self.next_ticket([ticket(7)], prs), "START 7")

    def test_resuming_an_unfinished_ticket_is_unaffected_by_the_limit(self):
        tickets = [ticket(7), ticket(9, assignees=["agent"])]
        self.assertEqual(self.next_ticket(tickets, ready_agent_prs(5)), "RESUME 9")

    def test_no_work_is_still_none_at_the_limit(self):
        self.assertEqual(self.next_ticket([], ready_agent_prs(5)), "NONE")

    def test_rejects_an_invalid_limit(self):
        state = Path(self.tmp.name) / "state.json"
        state.write_text(json.dumps({"tickets": [ticket(7)], "prs": []}))
        result = self.run_script(state, {"AFK_WIP_LIMIT": "lots"})
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("AFK_WIP_LIMIT", result.stderr)


if __name__ == "__main__":
    unittest.main()
