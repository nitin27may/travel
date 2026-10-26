"""Tests for the gate cache (tools/gate/cache.py and its use in gate.py; TEST-STRATEGY section 6). Real throwaway git repos, tiny
python commands instead of real suites; the toolchain and env parts of the key are injected so no node or pnpm is spawned."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools" / "gate"))
import cache as gcache  # noqa: E402
import gate  # noqa: E402
import gatemap  # noqa: E402

RUNS = "runs.txt"  # each real run of a fake suite appends a line here


def sh(cwd: Path, *a: str) -> str:
    return subprocess.run(["git", "-C", str(cwd), *a], check=True, capture_output=True, text=True).stdout


def make_repo(path: Path) -> Path:
    path.mkdir(parents=True)
    sh(path, "init", "-q", "-b", "main")
    sh(path, "config", "user.email", "t@t")
    sh(path, "config", "user.name", "t")
    (path / "data").mkdir()
    (path / "data/a.json").write_text("{}")
    (path / "web").mkdir()
    (path / "web/x.ts").write_text("x")
    (path / "pnpm-lock.yaml").write_text("lock")
    sh(path, "add", "data", "web", "pnpm-lock.yaml")
    sh(path, "commit", "-qm", "init")
    return path


@pytest.fixture
def repo(tmp_path: Path) -> Path:
    return make_repo(tmp_path / "main")


MAP = {
    "suites": {
        "narrow": {"run": ["python3 -c 1"], "cost": "s", "inputs": ["data/**"]},
        "wide": {"run": ["python3 -c 2"], "cost": "s"},  # no inputs: the whole tree
        "e2e.full": {"run": ["pnpm --dir web e2e"], "cost": "s", "inputs": ["data/**"]},
        "web.build": {"run": ["pnpm --dir web build"], "cost": "s", "inputs": ["web/**"]},
        "web.built": {"run": ["pnpm --dir web test:built"], "cost": "s", "inputs": ["web/**"], "needs": ["web.build"]},
    },
    "uncacheable": ["e2e.full", "web.build"],
}


def mk_cache(root: Path, now=lambda: 1_000_000.0, **kw) -> gcache.Cache:
    kw = {"tools": "node1|pnpm1", "env": "", **kw}
    return gcache.Cache(root, store=gcache.common_dir(root) / "gate-cache", now=now, **kw)


@pytest.fixture
def fake_run(monkeypatch):
    """Every action is a tiny command that appends to runs.txt in the repo; `fail` in the repo's FAIL file makes it exit 1."""
    def actions_for(m, job, root=gate.ROOT):
        code = (f"import pathlib,sys;pathlib.Path('{RUNS}').open('a').write('{job.suite}\\n');"
                "sys.exit(1 if pathlib.Path('FAIL').exists() else 0)")
        return [gate.Action([sys.executable, "-c", code], label=job.suite)]
    monkeypatch.setattr(gate, "actions_for", actions_for)


def runs(root: Path) -> list[str]:
    f = root / RUNS
    return f.read_text().split() if f.exists() else []


def run(root: Path, names: list[str], cache: gcache.Cache | None, m: dict = MAP) -> list[gate.Result]:
    plan = gate.Plan(2, [], jobs=[gate.Job(n, ["needed by web.built"] if n == "web.build" and len(names) > 1 else ["t"]) for n in names])
    plan.needs_override = {n: m["suites"][n].get("needs", []) for n in names}
    return gate.run_plan(m, plan, keep_going=True, root=root, lock_root=root / ".locks", label="t", log=lambda _t: None, note=lambda _t: None,
                         cache=cache, head="abc1234")


def status(res: list[gate.Result]) -> dict[str, str]:
    return {r.suite: r.status for r in res}


# ----- hit and miss ----------------------------------------------------------------------------------------------------------------
def test_second_run_is_cached_and_does_not_run(repo, fake_run):
    assert status(run(repo, ["narrow"], mk_cache(repo))) == {"narrow": "PASS"}
    again = run(repo, ["narrow"], mk_cache(repo))
    assert status(again) == {"narrow": "CACHED"} and runs(repo) == ["narrow"]
    assert "was" in again[0].note
    assert gate.verdict(again) == ("PASS", 0)


def test_input_change_invalidates_only_suites_whose_inputs_hold_it(repo, fake_run):
    run(repo, ["narrow", "wide"], mk_cache(repo))
    (repo / "web/x.ts").write_text("changed")  # outside narrow's inputs, inside wide's (whole tree)
    got = status(run(repo, ["narrow", "wide"], mk_cache(repo)))
    assert got == {"narrow": "CACHED", "wide": "PASS"}
    (repo / "data/a.json").write_text('{"a": 1}')
    assert status(run(repo, ["narrow"], mk_cache(repo))) == {"narrow": "PASS"}


def test_uncommitted_and_untracked_changes_invalidate(repo, fake_run):
    c0 = mk_cache(repo).key("narrow", ["c"], ["data/**"])
    (repo / "data/a.json").write_text("dirty")  # modified, not staged
    c1 = mk_cache(repo).key("narrow", ["c"], ["data/**"])
    sh(repo, "add", "data/a.json")  # staged: same content, same key
    assert mk_cache(repo).key("narrow", ["c"], ["data/**"]) == c1 != c0
    (repo / "data/new.json").write_text("n")  # untracked
    c2 = mk_cache(repo).key("narrow", ["c"], ["data/**"])
    assert c2 != c1
    (repo / "data/new.json").unlink()
    assert mk_cache(repo).key("narrow", ["c"], ["data/**"]) == c1
    sh(repo, "rm", "-q", "-f", "data/a.json")  # deleted
    assert mk_cache(repo).key("narrow", ["c"], ["data/**"]) not in (c0, c1)


def test_committing_the_same_content_keeps_the_key(repo):
    (repo / "data/a.json").write_text("v2")
    dirty = mk_cache(repo).key("narrow", ["c"], ["data/**"])
    sh(repo, "commit", "-qam", "v2")
    assert mk_cache(repo).key("narrow", ["c"], ["data/**"]) == dirty


def test_ignored_files_do_not_count(repo):
    (repo / ".gitignore").write_text("junk/\n")
    sh(repo, "add", ".gitignore")
    k = mk_cache(repo).key("wide", ["c"], None)
    (repo / "junk").mkdir()
    (repo / "junk/a").write_text("1")
    assert mk_cache(repo).key("wide", ["c"], None) == k


# ----- what is never stored --------------------------------------------------------------------------------------------------------
def test_failure_is_not_cached(repo, fake_run):
    (repo / "FAIL").write_text("")
    assert status(run(repo, ["narrow"], mk_cache(repo))) == {"narrow": "FAIL"}
    (repo / "FAIL").unlink()  # untracked FAIL is an input only of the whole-tree suites; narrow does not see it
    assert status(run(repo, ["narrow"], mk_cache(repo))) == {"narrow": "PASS"}
    assert runs(repo) == ["narrow", "narrow"]
    assert not list((gcache.common_dir(repo) / "gate-cache").glob("*.json")) or all(
        json.loads(p.read_text()).get("status") == "PASS" for p in (gcache.common_dir(repo) / "gate-cache").glob("*.json") if p.name != "stats.json")


def test_deferred_and_skipped_are_not_cached(repo, monkeypatch):
    def refuse(m, job, root=gate.ROOT):
        raise gate.Refused("no docker")
    monkeypatch.setattr(gate, "actions_for", refuse)
    c = mk_cache(repo)
    assert status(run(repo, ["narrow"], c)) == {"narrow": "DEFERRED"}
    assert not list(c.store.glob("*.json"))


def test_uncacheable_suites_always_run(repo, fake_run):
    for _ in range(2):
        assert status(run(repo, ["e2e.full"], mk_cache(repo))) == {"e2e.full": "PASS"}
    assert runs(repo) == ["e2e.full", "e2e.full"]
    assert gate.cache_key(MAP, gate.Job("e2e.full", ["t"]), mk_cache(repo)) is None
    assert gate.cache_key(MAP, gate.Job("check-all", ["t"]), mk_cache(repo)) is None  # pseudo suite


def test_the_real_map_lists_the_four_release_suites_as_uncacheable():
    m = gatemap.load_map()
    assert {"e2e.full", "visual", "db.local", "web.timing"} <= set(m["uncacheable"])
    assert all(s in m["suites"] for s in m["uncacheable"])


# ----- bypass ----------------------------------------------------------------------------------------------------------------------
def test_disabled_cache_neither_reads_nor_writes(repo, fake_run):
    run(repo, ["narrow"], mk_cache(repo))
    assert status(run(repo, ["narrow"], mk_cache(repo, enabled=False))) == {"narrow": "PASS"}
    assert status(run(repo, ["narrow"], None)) == {"narrow": "PASS"}


def test_bypass_reasons():
    assert gcache.bypass_reason(no_cache=True, verifier=False, tier=1) == "--no-cache"
    assert "verifier" in gcache.bypass_reason(no_cache=False, verifier=True, tier=1)
    assert "T3" in gcache.bypass_reason(no_cache=False, verifier=False, tier=3)
    assert gcache.bypass_reason(no_cache=False, verifier=False, tier=2) is None
    assert gcache.is_verifier(True, {}) and gcache.is_verifier(False, {"GATE_VERIFIER": "1"}) and not gcache.is_verifier(False, {"GATE_VERIFIER": "0"})


def test_main_flags_no_cache_and_verifier_never_touch_the_store(repo, monkeypatch, capsys):
    monkeypatch.setattr(gate, "actions_for", lambda m, job, root=gate.ROOT: [gate.Action([sys.executable, "-c", "pass"], label="x")])
    store = gcache.common_dir(repo) / "gate-cache"
    base = ["--tier", "1", "--only", "core.types", "--changed", "core/x.ts"]
    for extra in (["--no-cache"], ["--verifier"]):
        assert gate.main(base + extra, root=repo) == 0
        assert not store.exists() or not list(store.glob("*.json"))
    monkeypatch.setenv("GATE_VERIFIER", "1")
    assert gate.main(base, root=repo) == 0
    assert not store.exists() or not list(store.glob("*.json"))
    monkeypatch.delenv("GATE_VERIFIER")
    capsys.readouterr()
    assert gate.main(base, root=repo) == 0 and "PASS" in capsys.readouterr().out
    assert gate.main(base, root=repo) == 0 and "CACHED" in capsys.readouterr().out
    assert gate.main(base + ["--no-cache"], root=repo) == 0 and "CACHED" not in capsys.readouterr().out



# ----- expiry, sharing, key stability ----------------------------------------------------------------------------------------------
def test_entry_expires_after_seven_days(repo, fake_run):
    t = [1_000_000.0]
    run(repo, ["narrow"], mk_cache(repo, now=lambda: t[0]))
    t[0] += 7 * 86400 - 60
    assert status(run(repo, ["narrow"], mk_cache(repo, now=lambda: t[0]))) == {"narrow": "CACHED"}
    t[0] += 120
    assert status(run(repo, ["narrow"], mk_cache(repo, now=lambda: t[0]))) == {"narrow": "PASS"}  # expired: ran, and stored afresh
    assert runs(repo) == ["narrow", "narrow"]


def test_prune_removes_expired_only(repo):
    t = [1_000_000.0]
    c = mk_cache(repo, now=lambda: t[0])
    c.store_pass("old", "a", 1.0)
    t[0] += 8 * 86400
    c.store_pass("new", "b", 1.0)
    assert c.prune() == 1
    assert [p.stem for p in c.store.glob("*.json")] == ["new"]


def test_worktrees_share_the_store_and_hit_on_identical_content(repo, tmp_path, fake_run):
    wt = tmp_path / "wt"
    sh(repo, "worktree", "add", "-q", str(wt), "-b", "other")
    assert gcache.common_dir(wt) == gcache.common_dir(repo)
    run(repo, ["narrow"], mk_cache(repo))
    got = run(wt, ["narrow"], mk_cache(wt))
    assert status(got) == {"narrow": "CACHED"} and runs(wt) == []
    (wt / "data/a.json").write_text("worktree edit")  # a different tree there: a miss, and the main checkout is unaffected
    assert status(run(wt, ["narrow"], mk_cache(wt))) == {"narrow": "PASS"}
    assert status(run(repo, ["narrow"], mk_cache(repo))) == {"narrow": "CACHED"}


def test_key_is_stable_and_depends_on_every_part(repo, tmp_path):
    k = lambda: mk_cache(repo).key("narrow", ["cmd"], ["data/**"])  # noqa: E731
    assert k() == k() == mk_cache(make_repo(tmp_path / "clone")).key("narrow", ["cmd"], ["data/**"])  # same content in another clone
    base = mk_cache(repo).key("narrow", ["cmd"], ["data/**"])
    assert mk_cache(repo).key("other", ["cmd"], ["data/**"]) != base
    assert mk_cache(repo).key("narrow", ["cmd2"], ["data/**"]) != base
    assert mk_cache(repo, tools="node2|pnpm1").key("narrow", ["cmd"], ["data/**"]) != base
    assert mk_cache(repo, env="NEXT_PUBLIC_SIGN_IN=1").key("narrow", ["cmd"], ["data/**"]) != base
    assert mk_cache(repo).key("narrow", ["cmd"], ["data/**", "web/**"]) != base


def test_missing_inputs_default_to_the_whole_tree(repo):
    c = mk_cache(repo)
    k_none, k_empty, k_all = (c.key("s", ["c"], v) for v in (None, [], ["**"]))
    assert k_none == k_empty == k_all
    (repo / "web/x.ts").write_text("y")
    assert mk_cache(repo).key("s", ["c"], None) != k_none


def test_env_flags_hash_the_home_point_and_pick_next_public():
    f = gcache.env_flags({"NEXT_PUBLIC_SIGN_IN": "1", "HOME_POINT_LAT": "12.345", "PATH": "/x", "FOO": "1"})
    assert "NEXT_PUBLIC_SIGN_IN=1" in f and "12.345" not in f and "PATH" not in f and "FOO" not in f
    assert gcache.env_flags({"HOME_POINT_LAT": "1"}) != gcache.env_flags({"HOME_POINT_LAT": "2"})


# ----- the build is skipped when nothing needs it ----------------------------------------------------------------------------------
def test_build_runs_only_when_a_dependant_misses(repo, fake_run):
    assert status(run(repo, ["web.build", "web.built"], mk_cache(repo))) == {"web.build": "PASS", "web.built": "PASS"}
    got = status(run(repo, ["web.build", "web.built"], mk_cache(repo)))
    assert got == {"web.build": "UNNEEDED", "web.built": "CACHED"}
    assert runs(repo) == ["web.build", "web.built"]
    (repo / "web/x.ts").write_text("edit")
    assert status(run(repo, ["web.build", "web.built"], mk_cache(repo))) == {"web.build": "PASS", "web.built": "PASS"}


def test_a_build_that_was_asked_for_by_name_still_runs(repo, fake_run):
    plan = gate.Plan(2, [], jobs=[gate.Job("web.build", ["--only"])])
    plan.needs_override = {}
    gate.run_plan(MAP, plan, keep_going=True, root=repo, lock_root=repo / ".l", label="t", log=lambda _t: None, note=lambda _t: None, cache=mk_cache(repo))
    assert runs(repo) == ["web.build"]


# ----- stats and render ------------------------------------------------------------------------------------------------------------
def test_stats_lists_entries_hits_and_saved_seconds(repo, fake_run):
    run(repo, ["narrow"], mk_cache(repo))
    run(repo, ["narrow"], mk_cache(repo))
    out = "\n".join(mk_cache(repo).stats())
    assert "entries 1" in out and "hits so far 1" in out and "narrow 1" in out


def test_render_prints_cached_rows_and_counts():
    plan = gate.Plan(1, [], jobs=[])
    rs = [gate.Result("core.types", "CACHED", 0.0, why="x", note="was 11.0s on abc1234"), gate.Result("links", "PASS", 1.0, why="x")]
    text = "\n".join(gate.render(plan, rs, base="main", head="h", dry=False, log_path=None, seconds=1))
    assert "CACHED" in text and "was 11.0s" in text and "1 pass, 1 cached, 0 fail" in text and text.startswith("gate T1") and "PASS:" in text
