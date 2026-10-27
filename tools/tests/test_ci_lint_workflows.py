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


# ----- the 12 bypass probes of docs/v2/build/review-wf-2-2026-10-26.md S1 (each failed to be caught by the first version) ---------------
def with_step(step: str) -> str:
    return GOOD + step


def test_probe01_quoted_uses_key():
    assert "pin" in rules(with_step('      - "uses": evil/act@v1\n'))


def test_probe02_quoted_permission_key():
    assert "write" in rules(GOOD.replace("contents: read", '"contents": write'))


def test_probe03_quoted_write_all_value():
    assert "write" in rules(GOOD.replace("permissions: {}", 'permissions: "write-all"'))


def test_probe04_escaped_trigger_key():
    assert "escape" in rules(GOOD.replace("  pull_request:\n", '  "pull_request\\x5ftarget":\n'))


def test_probe05_escaped_secrets_value():
    assert "escape" in rules(with_step('      - run: echo\n        env: { K: "\\x24{{ secr\\x65ts.T }}" }\n'))


def test_probe06_secrets_index_split_from_the_expression_open():
    assert "secrets" in rules(with_step("      - run: echo\n        env:\n          K: ${{\n            secrets['T'] }}\n"))


def test_probe07_event_title_inside_run():
    assert "injection" in rules(with_step("      - run: echo ${{ github.event.pull_request.title }}\n"))


def test_probe08_head_ref_inside_a_run_block():
    assert "injection" in rules(with_step("      - run: |\n          git checkout ${{ github.head_ref }}\n"))


def test_probe09_constant_false_cancel_expression():
    assert "concurrency" in rules(GOOD.replace("${{ github.ref != 'refs/heads/main' }}", "${{ false }}"))


def test_probe10_runs_on_group():
    assert "runner" in rules(GOOD.replace("runs-on: ubuntu-24.04", "runs-on: { group: my-pool }"))


def test_probe11_local_composite_action():
    assert "pin" in rules(with_step("      - uses: ./.github/actions/x\n"))


def test_probe12_write_scope_not_in_any_list():
    assert "write" in rules(GOOD.replace("contents: read", "artifact-metadata: write"))


def test_safe_expressions_in_run_are_allowed():
    ok = "      - run: echo ${{ needs.plan.outputs.base }} ${{ steps.a.outputs.b }} ${{ matrix.shard }} ${{ env.X }}\n"
    assert rules(with_step(ok)) == []


def test_flow_style_concurrency_is_read():
    flow = GOOD[: GOOD.index("concurrency:")] + "concurrency: { group: x, cancel-in-progress: true }\n" + GOOD[GOOD.index("jobs:"):]
    assert rules(flow) == []


def test_block_scalar_content_is_not_mistaken_for_keys():
    assert rules(with_step("      - run: |\n          echo 'uses: nothing'\n          echo done\n")) == []


def test_the_docstring_says_it_is_a_drift_guard():
    assert "NOT A SECURITY BOUNDARY" in (lw.__doc__ or "")


# ----- WF-3 rules: image, ports, cache ------------------------------------------------------------------------------------------------------
DIGEST = "sha256:" + "ab" * 32
CACHE_SHA = "55cc8345863c7cc4c66a329aec7e433d2d1c52a9"


def job_with(extra_job_lines: str = "", step: str = "") -> str:
    base = GOOD.replace("    permissions: { contents: read }\n", "    permissions: { contents: read }\n" + extra_job_lines, 1)
    return base + step


def test_service_image_must_be_pinned_by_digest():
    ok = job_with(f"    services:\n      db:\n        image: postgres:18@{DIGEST}\n")
    assert rules(ok) == []
    assert "image" in rules(job_with("    services:\n      db:\n        image: postgres:18\n"))
    assert "image" in rules(job_with("    services:\n      db:\n        image: postgres:18@sha256:abc\n"))


def test_an_image_env_value_must_be_pinned_by_digest():
    assert "image" in rules(job_with("    env:\n      PG_BASE_IMAGE: postgres:18-trixie\n"))
    assert rules(job_with(f"    env:\n      PG_BASE_IMAGE: postgres:18-trixie@{DIGEST}\n")) == []


def test_a_service_port_must_bind_loopback():
    assert rules(job_with("    services:\n      db:\n        ports: ['127.0.0.1:54329:5432']\n")) == []
    assert "ports" in rules(job_with("    services:\n      db:\n        ports: ['54329:5432']\n"))
    assert "ports" in rules(job_with("    services:\n      db:\n        ports:\n          - 5432:5432\n"))
    assert "ports" in rules(job_with("    services:\n      db:\n        ports: ['0.0.0.0:5432:5432']\n"))


def test_plain_actions_cache_is_refused_restore_is_fine():
    assert "cache" in rules(with_step(f"      - uses: actions/cache@{CACHE_SHA}\n        with: {{ path: x, key: k }}\n"))
    assert rules(with_step(f"      - uses: actions/cache/restore@{CACHE_SHA}\n        with: {{ path: x, key: k }}\n")) == []


def test_cache_save_must_be_behind_a_main_only_condition():
    save = f"      - uses: actions/cache/save@{CACHE_SHA}\n"
    assert "cache" in rules(with_step(save + "        with: { path: x, key: k }\n"))
    assert "cache" in rules(with_step(save + "        if: success()\n        with: { path: x, key: k }\n"))
    assert rules(with_step(save + "        if: github.ref == 'refs/heads/main' && success()\n        with: { path: x, key: k }\n")) == []


@pytest.mark.parametrize("action", ["setup-node", "setup-python"])
def test_setup_action_cache_input_is_refused(action):
    step = f"      - uses: actions/{action}@{SHA}\n        with: {{ node-version: 22, cache: pnpm }}\n"
    assert "cache" in rules(with_step(step))
    block = f"      - uses: actions/{action}@{SHA}\n        with:\n          cache: pnpm\n"
    assert "cache" in rules(with_step(block))
    assert rules(with_step(f"      - uses: actions/{action}@{SHA}\n        with: {{ node-version: 22 }}\n")) == []
