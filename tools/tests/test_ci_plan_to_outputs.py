"""Tests for tools/ci/plan_to_outputs.py, GATE_RUNNER=ci and --group of the gate, and tools/ci/guard_env.sh (WF-2)."""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools" / "ci"))
sys.path.insert(0, str(ROOT / "tools" / "gate"))
import gate  # noqa: E402
import gatemap  # noqa: E402
import plan_to_outputs as po  # noqa: E402

M = gatemap.load_map()


def ci_plan(changed: list[str], tier: int = 1, monkeypatch=None) -> dict:
    """The plan document the workflow makes: gate.py --dry-run --out, in CI mode."""
    if monkeypatch:
        monkeypatch.setenv("GATE_RUNNER", "ci")
    p = gate.make_plan(M, tier, changed)
    res = [gate.Result(j.suite, "WOULD") for j in p.jobs]
    return gate.to_json(p, res, base="b", head="h", log_path=None, code=0, dry=True, m=M)


def test_every_suite_has_a_known_group():
    assert {s.get("group") for s in M["suites"].values()} <= set(po.GROUPS)
    assert all("group" in s for s in M["suites"].values())


def test_docs_only_plan_selects_links_only(monkeypatch):
    out = po.outputs(ci_plan(["docs/v2/PLAN.md"], monkeypatch=monkeypatch))
    assert out["groups"] == "links" and out["docs_only"] == "true" and out["full"] == "false"


def test_workflow_change_selects_the_ci_suite_not_the_web(monkeypatch):
    out = po.outputs(ci_plan([".github/workflows/check.yml"], monkeypatch=monkeypatch))
    assert out["groups"].split(",")[0] == "links" and "ci" in out["suites"].split(",")
    assert "web" not in out["groups"].split(",")


def test_web_change_selects_web_and_e2e_specs(monkeypatch, tmp_path):
    out = po.outputs(ci_plan(["web/components/home/HomeSearch.tsx"], monkeypatch=monkeypatch))
    groups = out["groups"].split(",")
    assert "web" in groups and out["docs_only"] == "false"
    assert groups == [g for g in po.GROUPS if g in groups]  # the map's order


def test_full_plan_lists_the_timing_suite_as_mac_only(monkeypatch):
    out = po.outputs(ci_plan(["tools/gate/gate.py"], monkeypatch=monkeypatch))
    assert out["full"] == "true" and out["mac_only"] == "web.timing"
    assert "web.timing" in out["suites"].split(",")


def test_a_plan_without_groups_is_refused():
    with pytest.raises(ValueError, match="GATE_RUNNER=ci"):
        po.outputs({"suites": [{"suite": "links", "status": "WOULD"}]})


def test_values_cannot_inject_another_output():
    plan = {"full": False, "suites": [{"suite": "links\nevil=1", "group": "links"}, {"suite": "ok.x", "group": "links"}]}
    out = po.outputs(plan)
    assert "\n" not in "".join(out.values()) and out["suites"] == "ok.x"


def test_cli_prints_key_value_lines(tmp_path, monkeypatch):
    f = tmp_path / "plan.json"
    f.write_text(json.dumps(ci_plan(["docs/v2/PLAN.md"], monkeypatch=monkeypatch)))
    r = subprocess.run([sys.executable, str(ROOT / "tools/ci/plan_to_outputs.py"), str(f)], capture_output=True, text=True)
    assert r.returncode == 0
    assert dict(ln.split("=", 1) for ln in r.stdout.splitlines())["groups"] == "links"
    assert subprocess.run([sys.executable, str(ROOT / "tools/ci/plan_to_outputs.py"), str(tmp_path / "nope")], capture_output=True).returncode == 2


# ----- the gate's CI mode --------------------------------------------------------------------------------------------------------
def test_local_json_has_no_ci_fields(monkeypatch):
    monkeypatch.delenv("GATE_RUNNER", raising=False)
    p = gate.make_plan(M, 1, ["docs/v2/PLAN.md"])
    doc = gate.to_json(p, [gate.Result(j.suite, "WOULD") for j in p.jobs], base="b", head="h", log_path=None, code=0, dry=True, m=M)
    assert all("group" not in r for r in doc["suites"])


def test_unknown_runner_is_refused(monkeypatch):
    monkeypatch.setenv("GATE_RUNNER", "cloud")
    with pytest.raises(gate.Refused):
        gate.is_ci()


def test_ci_mode_marks_timing_suites_mac_only_without_load_or_slot(monkeypatch, tmp_path):
    monkeypatch.setenv("GATE_RUNNER", "ci")
    monkeypatch.setenv("GATE_LOAD_PER_CORE", "99")  # would DEFER locally
    job = gate.Job("web.timing", ["T2"])
    r = gate.run_job(M, job, root=ROOT, lock_root=tmp_path, label="t", log=lambda s: None, note=lambda s: None)
    assert r.status == "MAC_ONLY"
    assert gate.verdict([r]) == ("PASS", 0)
    monkeypatch.delenv("GATE_RUNNER")
    r = gate.run_job(M, job, root=ROOT, lock_root=tmp_path, label="t", log=lambda s: None, note=lambda s: None)
    assert r.status == "DEFERRED"


def run_gate(*args: str, env: dict | None = None) -> subprocess.CompletedProcess:
    e = {**os.environ, **(env or {})}
    return subprocess.run([sys.executable, str(ROOT / "tools/gate/gate.py"), *args], capture_output=True, text=True, env=e, cwd=ROOT)


def test_group_filters_the_plan_and_out_writes_json(tmp_path):
    out = tmp_path / "sub" / "p.json"
    r = run_gate("--tier", "1", "--dry-run", "--changed", "docs/v2/PLAN.md", "--group", "links", "--out", str(out), env={"GATE_RUNNER": "ci"})
    assert r.returncode == 0, r.stdout
    doc = json.loads(out.read_text())
    assert [s["suite"] for s in doc["suites"]] == ["links", "gate.map"] and {s["group"] for s in doc["suites"]} == {"links"}


def test_group_other_than_links_drops_the_links(tmp_path):
    r = run_gate("--tier", "1", "--dry-run", "--changed", "core/src/schema/x.ts", "--group", "web")
    assert r.returncode == 0 and "links" not in r.stdout.split("DRY RUN")[0].replace("gate T1", "") and "web.types" in r.stdout


def test_unknown_group_is_refused():
    r = run_gate("--tier", "1", "--dry-run", "--changed", "docs/v2/PLAN.md", "--group", "nope")
    assert r.returncode == 2 and "unknown group" in r.stdout


# ----- guard_env.sh --------------------------------------------------------------------------------------------------------------
def guard(**env: str) -> subprocess.CompletedProcess:
    base = {"PATH": os.environ["PATH"], "HOME_POINT_LAT": "10.5", "HOME_POINT_LON": "-140.5"}
    return subprocess.run(["bash", str(ROOT / "tools/ci/guard_env.sh")], capture_output=True, text=True, env={**base, **env})


def test_guard_accepts_the_decoy():
    assert guard().returncode == 0


def test_guard_rejects_another_home_point_without_printing_it():
    r = guard(HOME_POINT_LAT="12.5")
    assert r.returncode == 1 and "12.5" not in r.stdout + r.stderr


def test_guard_rejects_a_database_url_without_printing_it():
    r = guard(DATABASE_URL="postgres://u:secretvalue@h/db")
    assert r.returncode == 1 and "DATABASE_URL" in r.stdout and "secretvalue" not in r.stdout + r.stderr


def test_guard_rejects_a_missing_home_point():
    r = subprocess.run(["bash", str(ROOT / "tools/ci/guard_env.sh")], capture_output=True, text=True, env={"PATH": os.environ["PATH"]})
    assert r.returncode == 1


# ----- review S2, S7, S8 and the nits ---------------------------------------------------------------------------------------------
def test_trailing_newline_cannot_pass_the_output_filter():
    plan = {"suites": [{"suite": "e2e.mapped", "group": "e2e", "files": ["a.spec.ts\n", "b.spec.ts"]}]}
    out = po.outputs(plan)
    assert out["specs"] == "b.spec.ts" and not po.SAFE.fullmatch("x\n")


def test_suites_are_listed_per_group_and_mac_only_comes_from_the_plan_rows(monkeypatch):
    out = po.outputs(ci_plan(["tools/gate/gate.py"], monkeypatch=monkeypatch))
    assert "web.timing" in out["suites_web"].split(",") and out["mac_only"] == "web.timing"
    assert out["suites_links"].split(",")[0] == "links" and "py.tools" in out["suites_core_data"].split(",")
    assert "web.timing" not in po.__dict__.get("MAC_ONLY", ())  # one source of truth: the gate


def test_expect_refuses_a_different_selection(tmp_path):
    ok = run_gate("--tier", "1", "--dry-run", "--changed", "docs/v2/PLAN.md", "--group", "links", "--expect", "links,gate.map")
    assert ok.returncode == 0, ok.stdout
    bad = run_gate("--tier", "1", "--dry-run", "--changed", "docs/v2/PLAN.md", "--group", "links", "--expect", "links,gate.map,hardcode")
    assert bad.returncode == 2 and "differs" in bad.stdout


def test_a_planned_group_that_selects_nothing_is_refused():
    r = run_gate("--tier", "1", "--dry-run", "--changed", "docs/v2/PLAN.md", "--group", "core-data", "--expect", "py.tools")
    assert r.returncode == 2 and "no suites" in r.stdout


def test_group_keeps_needs_from_other_groups(monkeypatch):
    # e2e.mapped (group e2e) needs web.build (group web): selecting the e2e group must still build first
    r = run_gate("--tier", "1", "--dry-run", "--changed", "web/components/home/HomeSearch.tsx", "--group", "e2e")
    rows = [ln.split()[1] for ln in r.stdout.splitlines() if ln.startswith("WOULD")]
    assert "web.build" in rows and rows.index("web.build") < rows.index("e2e.mapped")


def test_full_trailer_is_read_from_the_pr_head_not_the_merge_commit(tmp_path, monkeypatch):
    def g(*a):
        subprocess.run(["git", "-C", str(tmp_path), *a], check=True, capture_output=True, env={**os.environ, "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@example.com",
                       "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@example.com"})
    g("init", "-q", "-b", "main")
    g("commit", "-q", "--allow-empty", "-m", "base")
    g("checkout", "-q", "-b", "pr")
    g("commit", "-q", "--allow-empty", "-m", "change\n\nGate: full")
    g("checkout", "-q", "main")
    g("commit", "-q", "--allow-empty", "-m", "other")
    g("merge", "-q", "--no-ff", "pr", "-m", "Merge pr")
    monkeypatch.setenv("GATE_RUNNER", "ci")
    monkeypatch.setenv("GITHUB_EVENT_NAME", "pull_request")
    assert gate.gate_full_trailer(tmp_path) is True
    monkeypatch.setenv("GITHUB_EVENT_NAME", "push")
    assert gate.gate_full_trailer(tmp_path) is False
    monkeypatch.delenv("GATE_RUNNER")
    assert gate.gate_full_trailer(tmp_path) is False


def test_guard_reads_the_decoy_from_the_typescript_file():
    ts = (ROOT / "core/test/setup/home-point.ts").read_text()
    assert "lat: 10.5, lon: -140.5" in ts and "10.5" in (ROOT / ".github/workflows/check.yml").read_text()
    assert guard().returncode == 0


# ----- scrub_check.py (S3, S4) -----------------------------------------------------------------------------------------------------
import scrub_check as sc  # noqa: E402


@pytest.mark.parametrize("text", [
    "ghp_" + "a" * 36, "github_pat_" + "A1b2" * 8, "npm_" + "a1" * 18, "AKIA" + "A" * 16, "AIza" + "x" * 35, "GOCSPX-" + "ab12" * 4,
    "sk-" + "a1" * 12, "xoxb-" + "1234567890-ab", "eyJ" + "a" * 20 + ".eyJ" + "b" * 12 + ".sig123", "napi_" + "a" * 30, "re_" + "A1_" * 8,
    "-----BEGIN RSA PRIVATE KEY-----", "postgres://user:pa/ss@host/db", "someone@corp-mail.org",
])
def test_scrub_flags_each_token_shape(text):
    assert sc.scan_text("log line " + text + " end")


@pytest.mark.parametrize("text", ["git@github.com:owner/repo.git", "icon@2x.png", "user@example.com", "noreply@anthropic.com", "the word restore_cache is fine", "https://github.com/a/b"])
def test_scrub_allows_harmless_matches(text):
    assert sc.scan_text(text) == []


def test_scrub_cli_clean_hit_and_names(tmp_path):
    run = lambda p: subprocess.run([sys.executable, str(ROOT / "tools/ci/scrub_check.py"), str(p)], capture_output=True, text=True)  # noqa: E731
    (tmp_path / "ok.json").write_text('{"suite": "links"}')
    assert run(tmp_path).returncode == 0
    (tmp_path / "bad.json").write_text("token ghp_" + "a" * 36)
    r = run(tmp_path)
    assert r.returncode == 1 and "bad.json" in r.stdout and "ghp_" not in r.stdout
    (tmp_path / "bad.json").unlink()
    (tmp_path / ".env.local").write_text("X=1")
    assert run(tmp_path).returncode == 1
    assert run(tmp_path / "nothing").returncode == 0


def test_scrub_fails_closed_on_an_unreadable_file(tmp_path):
    f = tmp_path / "a.json"
    f.write_text("{}")
    f.chmod(0)
    try:
        r = subprocess.run([sys.executable, str(ROOT / "tools/ci/scrub_check.py"), str(tmp_path)], capture_output=True, text=True)
        assert r.returncode == 2 or os.geteuid() == 0
    finally:
        f.chmod(0o600)
