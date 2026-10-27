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
