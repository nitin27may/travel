"""Tests for tools/ci/lint_workflows.py (WF-2): the real workflow passes, and each planted violation is named."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools" / "ci"))
import lint_workflows as lw  # noqa: E402

SHA = "3d3c42e5aac5ba805825da76410c181273ba90b1"

GOOD = f"""name: t
on:
  push:
    branches: [main]
  pull_request:
permissions: {{}}
concurrency:
  group: t-${{{{ github.ref }}}}
  cancel-in-progress: ${{{{ github.ref != 'refs/heads/main' }}}}
jobs:
  a:
    runs-on: ubuntu-24.04
    timeout-minutes: 5
    permissions: {{ contents: read }}
    steps:
      - uses: actions/checkout@{SHA} # v7.0.1
        with: {{ persist-credentials: false }}
      - run: echo ok
"""


def rules(text: str) -> list[str]:
    return [p.split(": ")[1] for p in lw.lint_text("t.yml", text)]


def test_good_workflow_is_clean():
    assert lw.lint_text("t.yml", GOOD) == []


def test_the_repository_workflows_are_clean():
    problems, n = lw.lint_paths([ROOT / ".github" / "workflows"])
    assert n >= 1 and problems == []


def test_unpinned_action_fails():
    assert "pin" in rules(GOOD.replace(f"@{SHA} # v7.0.1", "@v5"))


def test_short_sha_fails():
    assert "pin" in rules(GOOD.replace(SHA, SHA[:12]))


def test_third_party_action_fails_even_when_pinned():
    r = lw.lint_text("t.yml", GOOD.replace("actions/checkout", "someone/checkout"))
    assert any(": pin:" in p and "GitHub-authored" in p for p in r)


def test_docker_action_fails():
    assert "pin" in rules(GOOD + "      - uses: docker://alpine:3\n")


def test_pull_request_target_fails():
    assert "trigger" in rules(GOOD.replace("  pull_request:\n", "  pull_request_target:\n"))


def test_workflow_run_fails():
    assert "trigger" in rules(GOOD.replace("  pull_request:\n", "  workflow_run:\n    workflows: [x]\n"))


def test_trigger_word_in_a_comment_is_fine():
    assert rules(GOOD.replace("name: t", "name: t  # never pull_request_target")) == []


def test_secrets_reference_fails():
    assert "secrets" in rules(GOOD + "      - run: echo\n        env: { K: ${{ secrets.TOKEN }} }\n")


def test_secrets_inherit_fails():
    assert "secrets" in rules(GOOD + "  b:\n    uses: ./.github/workflows/x.yml\n    secrets: inherit\n")


def test_github_token_context_is_not_a_secret_reference():
    assert "secrets" not in rules(GOOD.replace("echo ok", "echo ${{ github.token }}"))


@pytest.mark.parametrize("perm", ["contents: write", "pull-requests: write", "id-token: write"])
def test_write_permission_fails(perm):
    assert "write" in rules(GOOD.replace("contents: read", perm))


def test_write_all_fails():
    assert "write" in rules(GOOD.replace("permissions: {}", "permissions: write-all"))


def test_missing_top_level_permissions_fails():
    assert "permissions" in rules(GOOD.replace("permissions: {}\n", ""))


def test_missing_timeout_fails():
    assert "timeout" in rules(GOOD.replace("    timeout-minutes: 5\n", ""))


def test_missing_concurrency_fails():
    text = GOOD[: GOOD.index("concurrency:")] + GOOD[GOOD.index("jobs:"):]
    assert "concurrency" in rules(text)


def test_concurrency_without_cancel_fails():
    assert "concurrency" in rules(GOOD.replace("  cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}\n", ""))


def test_concurrency_cancel_false_fails():
    assert "concurrency" in rules(GOOD.replace("${{ github.ref != 'refs/heads/main' }}", "false"))


def test_checkout_must_not_persist_credentials():
    assert "checkout" in rules(GOOD.replace("        with: { persist-credentials: false }\n", ""))


def test_checkout_credentials_true_fails():
    assert "checkout" in rules(GOOD.replace("persist-credentials: false", "persist-credentials: true"))


def test_self_hosted_runner_fails():
    assert "runner" in rules(GOOD.replace("ubuntu-24.04", "self-hosted"))


def test_each_job_needs_its_own_timeout():
    two = GOOD + "  b:\n    runs-on: ubuntu-24.04\n    steps:\n      - run: echo\n"
    r = lw.lint_text("t.yml", two)
    assert sum(": timeout:" in p for p in r) == 1 and "`b`" in r[0]


def test_cli_exit_codes(tmp_path):
    d = tmp_path / "wf"
    d.mkdir()
    (d / "ok.yml").write_text(GOOD)
    run = lambda *a: subprocess.run([sys.executable, str(ROOT / "tools/ci/lint_workflows.py"), *a], capture_output=True, text=True)  # noqa: E731
    assert run(str(d)).returncode == 0
    (d / "bad.yml").write_text(GOOD.replace("  pull_request:\n", "  pull_request_target:\n"))
    r = run(str(d))
    assert r.returncode == 1 and "bad.yml" in r.stdout and "pull_request_target" in r.stdout
    assert run(str(tmp_path / "missing")).returncode == 2
