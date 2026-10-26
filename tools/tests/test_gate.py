"""Tests for the gate (tools/gate/gate.py, locks.py, extract.py; TEST-STRATEGY section 5): selection from sample change lists,
ordering, fail-fast, deferred never passing, the 40-line cap, locks, refused states and dry-run. No suite is really run: the
command builder is replaced by tiny python commands."""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools" / "gate"))
import extract  # noqa: E402
import gate  # noqa: E402
import gatemap  # noqa: E402
from locks import Slot, SlotTimeout  # noqa: E402

M = gatemap.load_map()


def plan(tier: int, changed: list[str], **kw) -> gate.Plan:
    return gate.make_plan(M, tier, changed, **kw)


def ids(p: gate.Plan) -> list[str]:
    return [j.suite for j in p.jobs]


# ----- selection -------------------------------------------------------------------------------------------------------------------
def test_docs_only_runs_links_and_map_only():
    assert ids(plan(1, ["docs/v2/PLAN.md"])) == ["links", "gate.map"]


def test_web_component_change_builds_and_runs_budgets():
    p = plan(1, ["web/components/home/HomeSearch.tsx"])
    got = ids(p)
    assert {"web.types", "web.unit", "web.build", "web.built", "web.serve"} <= set(got)
    assert "web.timing" not in got and "web.fixture" not in got and not p.full
    assert got.index("web.build") < got.index("web.built") < len(got)


def test_core_privacy_change_is_full():
    p = plan(1, ["core/src/privacy/redact.ts"])
    assert p.full and "core/src/privacy" in p.full_reasons[0]
    assert set(gatemap.full_suites(M)) <= set(ids(p))
    assert "e2e.full" not in ids(p) and "db.local" not in ids(p)


def test_unmatched_path_falls_back_to_full():
    assert plan(1, ["zzz/new-folder/file.bin"]).full


def test_force_full_flag():
    assert plan(1, ["docs/v2/PLAN.md"], force_full=True).full


def test_order_is_cost_first_and_dependants_after_dependencies():
    got = ids(plan(2, ["docs/x.md"]))
    rank = {s: gate.COST_RANK[M["suites"][s]["cost"]] for s in got}
    assert got.index("web.build") < got.index("web.built") < got.index("web.fixture")
    assert got.index("web.build") < got.index("e2e.smoke")
    assert [rank[s] for s in got[:got.index("web.build")]] == sorted(rank[s] for s in got[:got.index("web.build")])


def test_t2_runs_every_unit_and_data_suite_once_and_not_t3_suites():
    got = ids(plan(2, []))
    assert len(got) == len(set(got))
    assert set(gatemap.full_suites(M)) == set(got)
    assert "e2e.full" not in got


def test_t3_is_check_all_then_full_e2e_and_db():
    got = ids(plan(3, []))
    assert got.index("check-all") < got.index("e2e.full") and set(got) == {"check-all", "e2e.full", "db.local"}
    assert "visual" in ids(plan(3, [], visual=True))
    p = plan(3, [])
    assert p.needs_override["e2e.full"] == ["check-all"]


def test_t0_picks_typecheck_related_and_lint_for_changed_code():
    p = plan(0, ["web/lib/format/age.ts", "docs/x.md"])
    assert ids(p) == ["web.types", "web.lint", "web.unit"] or set(ids(p)) == {"web.types", "web.lint", "web.unit"}
    assert all(j.files for j in p.jobs if j.suite in ("web.unit", "web.lint"))
    assert plan(0, ["docs/x.md"]).jobs == []


def test_related_narrowing_only_when_every_selecting_path_is_code():
    code = plan(1, ["web/lib/format/age.ts"])
    unit = next(j for j in code.jobs if j.suite == "web.unit")
    assert unit.narrowed and unit.files == ["web/lib/format/age.ts"]
    data = plan(1, ["web/lib/format/age.ts", "data/vocab/tags.json"])
    assert data.full  # vocab is a full path
    mixed = plan(1, ["web/lib/format/age.ts", "web/app/themes.css"])
    assert not next(j for j in mixed.jobs if j.suite == "web.unit").narrowed


def test_only_forces_named_suites_and_rejects_unknown():
    assert ids(plan(1, [], only=["web.types"])) == ["web.types"]
    with pytest.raises(gate.Refused):
        plan(1, [], only=["nope"])


def test_reuse_build_drops_the_build():
    got = ids(plan(1, [], only=["e2e.smoke"], reuse_build=True))
    assert got == ["e2e.smoke"]
    assert "web.build" in ids(plan(1, [], only=["e2e.smoke"]))


def test_e2e_mapped_carries_the_specs():
    p = plan(1, ["web/components/places/PlaceHeader.tsx"])
    j = next(j for j in p.jobs if j.suite == "e2e.mapped")
    assert j.files and all(f.endswith(".spec.ts") for f in j.files)


# ----- extractors ------------------------------------------------------------------------------------------------------------------
def test_excerpt_tsc_lines_and_cap():
    text = "noise\n" + "\n".join(f"src/a.ts({i},1): error TS2322: bad {i}" for i in range(30)) + "\nmore"
    ex = extract.excerpt(text, 10)
    assert len(ex) == 10 and "error TS2322" in ex[0] and ex[-1].startswith("... ")


def test_excerpt_falls_back_to_tail_without_warn():
    ex = extract.excerpt("one\nWARN x\ntwo\nthree", 2)
    assert ex == ["two", "three"]


def test_excerpt_strips_ansi():
    assert extract.excerpt("\x1b[31mFAIL\x1b[0m tests/a.test.ts")[0] == "FAIL tests/a.test.ts"


def test_parse_cmd():
    env, argv = gate.parse_cmd("SKIP_WEB_BUILD=1 pnpm --dir web test:built")
    assert env == {"SKIP_WEB_BUILD": "1"} and argv[:2] == ["pnpm", "--dir"]
    assert gate.parse_cmd("the MCP initialize line of tools/check-all.sh") is None
    assert gate.parse_cmd("pnpm --dir web exec playwright test <specs>") is None


# ----- running: fail-fast, keep-going, deferred, output cap -------------------------------------------------------------------------
def py(code: str) -> gate.Action:
    return gate.Action([sys.executable, "-c", code])


@pytest.fixture
def fake(monkeypatch, tmp_path):
    table: dict[str, list[gate.Action]] = {}

    def actions(m, job, root=gate.ROOT):
        return table.get(job.suite, [py("pass")])
    monkeypatch.setattr(gate, "actions_for", actions)
    monkeypatch.setenv("GATE_LOCK_TIMEOUT", "0.3")
    monkeypatch.setenv("GATE_LOCK_POLL", "0.05")
    monkeypatch.setenv("GATE_LOAD_PER_CORE", "0.1")
    return table


def run(plan_: gate.Plan, tmp_path: Path, keep: bool, notes: list[str] | None = None):
    return gate.run_plan(M, plan_, keep_going=keep, root=gate.ROOT, lock_root=tmp_path / "locks", label="t", log=lambda _t: None,
                         note=(notes.append if notes is not None else (lambda _m: None)))


def three(*suites: str) -> gate.Plan:
    return gate.Plan(1, [], jobs=[gate.Job(s, ["x"]) for s in suites])


def test_fail_fast_stops_later_suites(fake, tmp_path):
    fake["hardcode"] = [py("import sys; print('error TS1: boom'); sys.exit(1)")]
    res = run(three("links", "hardcode", "py.tools"), tmp_path, keep=False)
    assert [r.status for r in res] == ["PASS", "FAIL", "SKIPPED"]
    assert "error TS1: boom" in res[1].excerpt[0]
    assert gate.verdict(res) == ("FAIL", 1)


def test_keep_going_runs_the_rest(fake, tmp_path):
    fake["hardcode"] = [py("import sys; sys.exit(1)")]
    res = run(three("links", "hardcode", "py.tools"), tmp_path, keep=True)
    assert [r.status for r in res] == ["PASS", "FAIL", "PASS"]


def test_dependant_of_a_failed_suite_is_skipped_even_when_keeping_going(fake, tmp_path):
    fake["web.build"] = [py("import sys; sys.exit(1)")]
    p = three("web.build", "web.built", "links")
    p.needs_override = {"web.built": ["web.build"]}
    res = run(p, tmp_path, keep=True)
    assert [r.status for r in res] == ["FAIL", "SKIPPED", "PASS"]
    assert res[1].note == "needs web.build"


def test_second_action_runs_only_after_first_passes(fake, tmp_path):
    fake["locations"] = [py("import sys; sys.exit(1)"), py("open('SHOULD_NOT_EXIST','w')")]
    assert run(three("locations"), tmp_path, keep=False)[0].status == "FAIL"
    assert not Path("SHOULD_NOT_EXIST").exists()


def test_timing_suite_is_deferred_under_load_and_never_passes(fake, tmp_path, monkeypatch):
    monkeypatch.setenv("GATE_LOAD_PER_CORE", "2.4")
    notes: list[str] = []
    res = run(three("web.timing", "links"), tmp_path, keep=False, notes=notes)
    assert res[0].status == "DEFERRED" and "2.4" in res[0].note and "T2 must run it" in res[0].note
    assert res[1].status == "PASS"  # a deferral is not a failure, the rest still runs
    assert gate.verdict(res) == ("DEFERRED (not a pass)", 2)
    assert any("DEFERRED web.timing" in n for n in notes)


def test_failure_beats_deferred_in_the_exit_code():
    rs = [gate.Result("a", "DEFERRED"), gate.Result("b", "FAIL")]
    assert gate.verdict(rs)[1] == 1


def test_unrunnable_suite_is_deferred(monkeypatch, tmp_path):
    def boom(m, job, root=gate.ROOT):
        raise gate.Refused("Docker is not running")
    monkeypatch.setattr(gate, "actions_for", boom)
    res = run(three("db.local"), tmp_path, keep=False)
    assert res[0].status == "DEFERRED" and "Docker" in res[0].note


def test_nothing_mapped_is_none_not_a_failure(fake, tmp_path):
    fake["e2e.mapped"] = []
    res = run(three("e2e.mapped"), tmp_path, keep=False)
    assert res[0].status == "NONE" and gate.verdict(res)[1] == 0


def test_output_is_capped_at_40_lines_with_many_failures():
    p = gate.Plan(2, ["a"] * 3, jobs=[])
    res = [gate.Result(f"suite.{i}", "FAIL", 1.0, "why", excerpt=[f"error line {j}" for j in range(10)]) for i in range(8)]
    out = gate.render(p, res, base="main", head="abc", dry=False, log_path="/tmp/x.log", seconds=9)
    assert len(out) <= gate.MAX_LINES and out[-1] == "log: /tmp/x.log" and out[-2].startswith("FAIL:")


def test_output_cap_with_30_suites_keeps_totals_and_log():
    res = [gate.Result(f"suite.{i}", "PASS", 1.0, "r" * 80) for i in range(45)]
    out = gate.render(gate.Plan(2, []), res, base="main", head="abc", dry=False, log_path="/tmp/x.log", seconds=9)
    assert len(out) <= gate.MAX_LINES and out[-1] == "log: /tmp/x.log" and "more lines in the log" in "\n".join(out)


# ----- locks -----------------------------------------------------------------------------------------------------------------------
def test_slot_is_exclusive_and_released(tmp_path):
    with Slot(tmp_path, "build", "a", timeout=0.2, poll=0.05):
        with pytest.raises(SlotTimeout) as e:
            Slot(tmp_path, "build", "b", timeout=0.2, poll=0.05).acquire()
        assert "a (pid" in e.value.holder
    with Slot(tmp_path, "build", "c", timeout=0.2, poll=0.05):
        pass
    assert not (tmp_path / "build").exists()


def test_slot_released_on_exception(tmp_path):
    with pytest.raises(RuntimeError):
        with Slot(tmp_path, "e2e", "a", timeout=0.2):
            raise RuntimeError("x")
    assert not (tmp_path / "e2e").exists()


def test_stale_lock_of_a_dead_pid_is_reclaimed(tmp_path):
    p = subprocess.Popen([sys.executable, "-c", "pass"])
    p.wait()
    d = tmp_path / "build"
    d.mkdir()
    (d / "owner").write_text(json.dumps({"pid": p.pid, "label": "dead"}))
    s = Slot(tmp_path, "build", "me", timeout=0.5, poll=0.05)
    s.acquire()
    assert json.loads((d / "owner").read_text())["pid"] == os.getpid()
    s.release()


def test_waiter_gets_the_slot_when_the_holder_lets_go(tmp_path):
    holder = subprocess.Popen([sys.executable, "-c",
                               "import sys,time;sys.path.insert(0,sys.argv[1]);from locks import Slot;from pathlib import Path;"
                               "s=Slot(Path(sys.argv[2]),'e2e','other');s.acquire();print('held',flush=True);time.sleep(0.6);s.release()",
                               str(ROOT / "tools/gate"), str(tmp_path)], stdout=subprocess.PIPE, text=True)
    assert holder.stdout.readline().strip() == "held"
    notes: list[str] = []
    s = Slot(tmp_path, "e2e", "me", timeout=5, poll=0.05, note=notes.append)
    s.acquire()
    assert s.waited > 0.2 and "other" in notes[0]
    s.release()
    holder.wait()


def test_suite_with_a_busy_slot_is_deferred_not_passed(fake, tmp_path):
    held = Slot(tmp_path / "locks", "build", "someone else")
    held.acquire()
    try:
        res = run(three("web.build"), tmp_path, keep=False)
    finally:
        held.release()
    assert res[0].status == "DEFERRED" and "someone else" in res[0].note


# ----- main: refused states, dry-run, logs -----------------------------------------------------------------------------------------
@pytest.fixture
def repo(tmp_path):
    r = tmp_path / "repo"
    r.mkdir()
    def g(*a):
        subprocess.run(["git", "-C", str(r), *a], check=True, capture_output=True)
    g("init", "-q", "-b", "main")
    g("config", "user.email", "t@t")
    g("config", "user.name", "t")
    (r / "README.md").write_text("x")
    g("add", "README.md")
    g("commit", "-qm", "init")
    return r


def test_t2_refuses_a_dirty_tree(repo, capsys):
    (repo / "dirty.md").write_text("x")
    assert gate.main(["--tier", "2", "--dry-run"], root=repo) == 2
    assert "REFUSED: T2 needs a clean tree" in capsys.readouterr().out
    assert gate.main(["--tier", "2", "--dry-run", "--allow-dirty"], root=repo) == 0


def test_unknown_base_is_refused(repo, capsys):
    assert gate.main(["--tier", "1", "--base", "nope", "--dry-run"], root=repo) == 2
    assert "REFUSED" in capsys.readouterr().out


def test_t3_refuses_a_loaded_machine(repo, monkeypatch, capsys):
    monkeypatch.setenv("GATE_LOAD_PER_CORE", "3.0")
    assert gate.main(["--tier", "3"], root=repo) == 2
    assert "quiet machine" in capsys.readouterr().out


def test_dry_run_prints_the_selection_and_runs_nothing(repo, monkeypatch, capsys):
    called = []
    monkeypatch.setattr(gate, "run_plan", lambda *a, **k: called.append(1))
    (repo / "docs").mkdir()
    (repo / "docs" / "a.md").write_text("x")
    assert gate.main(["--tier", "1", "--dry-run"], root=repo) == 0
    out = capsys.readouterr().out
    assert "WOULD" in out and "links" in out and "DRY RUN" in out and not called
    assert not (repo / ".git" / "gate-logs").exists()


def test_working_tree_and_untracked_files_are_part_of_the_change_set(repo):
    (repo / "README.md").write_text("changed")
    (repo / "new.txt").write_text("n")
    ch, untracked = gate.changed_files("main", repo)
    assert ch == ["README.md", "new.txt"] and untracked == 1


def test_committed_branch_changes_are_diffed_against_the_base(repo):
    subprocess.run(["git", "-C", str(repo), "checkout", "-qb", "feat"], check=True)
    (repo / "a.txt").write_text("a")
    subprocess.run(["git", "-C", str(repo), "add", "a.txt"], check=True)
    subprocess.run(["git", "-C", str(repo), "commit", "-qm", "a"], check=True)
    assert gate.changed_files("main", repo)[0] == ["a.txt"]


def test_gate_full_trailer(repo):
    subprocess.run(["git", "-C", str(repo), "commit", "-q", "--allow-empty", "-m", "x\n\nGate: full"], check=True)
    assert gate.gate_full_trailer(repo)


def test_real_run_writes_log_and_summary_and_exit_code(repo, fake, capsys):
    fake["hardcode"] = [py("print('FAIL something broke'); raise SystemExit(1)")]
    code = gate.main(["--tier", "1", "--changed", "core/src/ops/x.ts", "--only", "links,hardcode"], root=repo)
    out = capsys.readouterr().out.splitlines()
    assert code == 1 and len(out) <= gate.MAX_LINES
    assert any(ln.startswith("FAIL") and "hardcode" in ln for ln in out) and any("something broke" in ln for ln in out)
    logs = list((repo / ".git" / "gate-logs").glob("*-tier1.log"))
    assert len(logs) == 1 and "something broke" in logs[0].read_text()
    last = json.loads((repo / ".git" / "gate-logs" / "last.json").read_text())
    assert last["exit"] == 1 and {s["suite"]: s["status"] for s in last["suites"]} == {"links": "PASS", "hardcode": "FAIL"}


def test_json_output(repo, fake, capsys):
    assert gate.main(["--tier", "1", "--changed", "docs/a.md", "--dry-run", "--json"], root=repo) == 0
    d = json.loads(capsys.readouterr().out)
    assert d["tier"] == 1 and [s["suite"] for s in d["suites"]] == ["links", "gate.map"] and d["dry_run"]


def test_wrapper_dry_run_from_the_shell():
    p = subprocess.run([str(ROOT / "tools/gate.sh"), "--tier", "1", "--dry-run", "--changed", "docs/v2/PLAN.md"], capture_output=True, text=True)
    assert p.returncode == 0 and "WOULD" in p.stdout
