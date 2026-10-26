"""tools/gate: the path-to-suite map, its check (M1 to M6) and the selection (docs/v2/build/TEST-STRATEGY.md 4.2 to 4.4)."""
from __future__ import annotations

import copy
import datetime as dt
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "gate"))
import check_map as cm  # noqa: E402
import gatemap as gm  # noqa: E402

TODAY = dt.date(2026, 10, 26)


# ----- globs -----------------------------------------------------------------------------------------------------------------------------
@pytest.mark.parametrize("glob,path,hit", [
    ("*.md", "README.md", True),
    ("*.md", "docs/a.md", False),           # anchored at the root
    ("**/*.md", "README.md", True),         # ** may be zero segments
    ("**/*.md", "docs/v2/a.md", True),
    ("data/**", "data/capture/x/y.json", True),
    ("data/**", "database/x", False),
    ("web/*.ts", "web/next.config.ts", True),
    ("web/*.ts", "web/app/page.ts", False),  # * stays in one segment
    ("core/src/{capture,validate}/**", "core/src/validate/a.ts", True),
    ("core/src/{capture,validate}/**", "core/src/derive/a.ts", False),
    ("web/tests/**/*.test.{ts,tsx}", "web/tests/a/b.test.tsx", True),
    ("web/tests/**/*.test.{ts,tsx}", "web/tests/a.test.ts", True),
    ("a/{b,c/{d,e}}.x", "a/c/e.x", True),   # nested braces
    ("file[0-9].txt", "file7.txt", True),
    ("file[!0-9].txt", "file7.txt", False),
])
def test_glob(glob: str, path: str, hit: bool) -> None:
    assert gm.match(glob, path) is hit


def test_glob_list_excludes() -> None:
    globs = ["web/**", "!web/tests/**"]
    assert gm.match_any(globs, "web/app/page.tsx")
    assert not gm.match_any(globs, "web/tests/a.test.ts")
    assert not gm.match_any(["!web/**"], "web/app/page.tsx")  # an exclude alone selects nothing


# ----- check-all steps -------------------------------------------------------------------------------------------------------------------
CHECK_ALL = '''step "python tests"
python3 -m pytest
if true; then
  for script in typecheck lint; do
    step "web $script"
    pnpm "$script"
  done
  step "web server answers (smoke)"
fi
step "capture contract: generated files match"
'''


def test_check_all_steps_expand_the_loop() -> None:
    assert gm.check_all_steps(CHECK_ALL) == ["python tests", "web typecheck", "web lint", "web server answers (smoke)",
                                             "capture contract: generated files match"]


def test_step_entries_match_by_prefix_at_a_boundary() -> None:
    assert gm.step_matches("capture contract", "capture contract: generated files match")
    assert gm.step_matches("web server answers", "web server answers (smoke)")
    assert gm.step_matches("web typecheck", "web typecheck")
    assert not gm.step_matches("web type", "web typecheck")  # a prefix must end at a space, colon or parenthesis
    assert not gm.step_matches("capture con", "capture contract: x")


def test_changed_steps_finds_an_appended_step() -> None:
    new = CHECK_ALL + 'step "towns layer (META-2)"\npython3 tools/towns.py --check\n'
    assert gm.changed_steps(CHECK_ALL, new) == ["towns layer (META-2)"]
    edited = CHECK_ALL.replace('pnpm "$script"', 'pnpm "$script" --quiet')
    assert gm.changed_steps(CHECK_ALL, edited) == ["web lint", "web typecheck"]


# ----- the real map -----------------------------------------------------------------------------------------------------------------------
@pytest.fixture(scope="module")
def real() -> tuple[dict, list[str]]:
    return gm.load_map(), gm.repo_files()


def test_the_real_map_passes_m1_to_m6(real: tuple[dict, list[str]]) -> None:
    m, files = real
    assert cm.check(m, files, gm.CHECK_ALL.read_text(encoding="utf-8")) == []


def test_every_check_all_step_belongs_to_a_suite(real: tuple[dict, list[str]]) -> None:
    m, _ = real
    labels = gm.check_all_steps(gm.CHECK_ALL.read_text(encoding="utf-8"))
    assert len(labels) >= 30
    assert all(gm.suites_for_step(m, x) for x in labels)
    assert any(x.startswith("gate map") for x in labels)  # this check is itself a check-all step


def test_docs_only_selects_links_and_the_map_check(real: tuple[dict, list[str]]) -> None:
    m, _ = real
    sel = gm.select(m, ["docs/v2/PLAN.md", "README.md", ".claude/agents/travel-builder.md"])
    assert not sel.full
    assert set(sel.suites) == {"links", "gate.map"}


@pytest.mark.parametrize("path", ["pnpm-lock.yaml", "web/package.json", "core/src/schema/api/place.ts", "core/src/privacy/home.ts",
                                  "core/src/catalogue/store.ts", "data/vocab/types.json", "web/tests/helpers/built.ts",
                                  "web/app/layout.tsx", "tools/gate/map.json", "web/playwright.config.ts", "web/tsconfig.json"])
def test_shared_contracts_take_the_full_set(real: tuple[dict, list[str]], path: str) -> None:
    m, _ = real
    sel = gm.select(m, [path])
    assert sel.full
    assert set(gm.full_suites(m)) <= set(sel.suites)
    assert "e2e.full" not in sel.suites and "db.local" not in sel.suites  # T3 content still waits


def test_unmatched_path_and_too_many_files_fall_back_to_full(real: tuple[dict, list[str]]) -> None:
    m, _ = real
    assert gm.select(m, ["nowhere/new-folder/file.txt"]).full
    many = [f"web/components/trips/F{i}.tsx" for i in range(gm.FULL_FILE_LIMIT + 1)]
    assert gm.select(m, many).full
    assert not gm.select(m, many[:gm.FULL_FILE_LIMIT]).full


def test_data_change_runs_data_checks_build_and_budgets(real: tuple[dict, list[str]]) -> None:
    m, _ = real
    sel = gm.select(m, ["data/capture/canadian-rockies-2029/trails.json"])
    assert not sel.full
    assert {"data.capture", "data.suit", "data.relevance", "data.slugs", "core.unit", "web.build", "web.built", "e2e.smoke"} <= set(sel.suites)
    assert "places.spec.ts" in sel.specs


def test_a_test_file_always_runs_itself(real: tuple[dict, list[str]]) -> None:
    m, _ = real
    sel = gm.select(m, ["web/tests/format.test.ts"])
    assert "web.unit" in sel.suites and "web/tests/format.test.ts" in sel.tests
    sel = gm.select(m, ["web/tests/e2e/units-places.spec.ts"])
    assert "units-places.spec.ts" in sel.specs and "web.build" in sel.suites  # e2e needs the build


def test_needs_pull_in_the_build(real: tuple[dict, list[str]]) -> None:
    m, _ = real
    sel = gm.select(m, ["web/tests/budget-free/nothing.ts"])  # web-tests rule: no build
    assert "web.build" not in sel.suites
    sel = gm.select(m, ["web/tests/og.test.ts"])  # fixture project needs the real build
    assert {"web.fixture", "web.build"} <= set(sel.suites)


def test_an_e2e_helper_runs_the_specs_that_import_it(real: tuple[dict, list[str]]) -> None:
    m, _ = real
    sel = gm.select(m, ["web/tests/e2e/auth-mock.ts"])
    assert sel.specs == {"auth-email.spec.ts", "auth-email.shots.spec.ts"}


def test_appending_a_check_all_step_runs_its_suite(real: tuple[dict, list[str]]) -> None:
    m, _ = real
    text = gm.CHECK_ALL.read_text(encoding="utf-8")
    old = text.replace('step "towns layer', 'step "XXtowns layer')  # pretend the step was new in this change
    sel = gm.select(m, ["tools/check-all.sh"], check_all_old=old, check_all_new=text)
    assert "data.towns" in sel.suites and "gate.map" in sel.suites and not sel.full


def test_timing_detector() -> None:
    assert cm.timing_assertion("const t0 = performance.now();\nf();\nconst ms = performance.now() - t0;\nexpect(ms).toBeLessThan(300);")
    assert cm.timing_assertion("times.push(performance.now() - t);\nconst p95 = times[9];\nexpect(p95).toBeLessThanOrEqual(0.5);")
    assert not cm.timing_assertion("const ms = performance.now() - t0;\nconsole.log(ms);\nexpect(rows.length).toBe(3);")
    assert not cm.timing_assertion("expect(x).toBe(1);")


@pytest.mark.parametrize("path", ["web/tests/api/revision-timing.test.ts", "web/tests/search/budget.test.ts",
                                  "web/tests/home/search.test.ts", "web/tests/search/split.test.ts"])
def test_the_four_wall_clock_files_are_detected(path: str) -> None:
    assert cm.timing_assertion((gm.ROOT / path).read_text(encoding="utf-8"))


def test_shards_times_but_asserts_no_time() -> None:
    assert not cm.timing_assertion((gm.ROOT / "web/tests/entities/shards.test.ts").read_text(encoding="utf-8"))


# ----- failing fixtures, one per check ----------------------------------------------------------------------------------------------------
FILES = {
    "web/tests/a.test.ts": "import { it } from 'vitest';\n",
    "web/tests/b.test.ts": "import { built } from './helpers/built';\n",
    "web/tests/c.test.tsx": "",
    "web/tests/e2e/x.spec.ts": "",
    "core/test/c.test.ts": "",
    "docs/readme.md": "",
    "web/app/page.tsx": "",
}
MAP = {
    "suites": {
        "links": {"always_at": 1, "steps": ["folder contract"]},
        "core.unit": {"tests": ["core/test/**/*.test.ts"]},
        "web.unit": {"tests": ["web/tests/**/*.test.{ts,tsx}", "!web/tests/b.test.ts"], "vitest": {"project": "unit"}},
        "web.built": {"tests": ["web/tests/b.test.ts"], "vitest": {"project": "built"}},
        "e2e.mapped": {"tests": ["web/tests/e2e/*.spec.ts"]},
    },
    "rules": [
        {"id": "app", "paths": ["web/app/**", "web/tests/**"], "suites": ["web.unit"], "e2e": ["x.spec.ts"]},
        {"id": "core", "paths": ["core/**"], "suites": ["core.unit"]},
    ],
    "full": [], "quiet": ["docs/**"], "review": [], "quarantine": [], "release_only": {}, "not_tests": {},
    "allow_unmatched_globs": {}, "area_required": ["web/app/**"],
    "test_files": ["**/*.test.ts", "**/*.spec.ts"],
}
STEPS = 'step "folder contract (CLN-5)"\n'


def run(tmp_path: Path, m: dict | None = None, extra: dict[str, str] | None = None, steps: str = STEPS,
        vitest_config: str = "", backlog: str = "", project_files: dict | None = None) -> list[str]:
    files = {**FILES, **(extra or {})}
    for p, text in files.items():
        (tmp_path / p).parent.mkdir(parents=True, exist_ok=True)
        (tmp_path / p).write_text(text, encoding="utf-8")
    return cm.check(m or MAP, sorted(files), steps, root=tmp_path, today=TODAY, backlog_text=backlog, vitest_config=vitest_config,
                    project_files=project_files)


def mutate() -> dict:
    return copy.deepcopy(MAP)


def codes(errs: list[str]) -> list[str]:
    return sorted({e.split()[0] for e in errs})


def test_fixture_passes(tmp_path: Path) -> None:
    assert run(tmp_path) == []


def test_m1_unowned_test_file(tmp_path: Path) -> None:
    errs = run(tmp_path, extra={"tools/x/y.test.ts": ""}, m={**mutate(), "rules": MAP["rules"] + [{"id": "t", "paths": ["tools/**"]}]})
    assert codes(errs) == ["M1"] and "tools/x/y.test.ts" in errs[0]


def test_m1_built_test_in_the_unit_project(tmp_path: Path) -> None:
    m = mutate()
    m["suites"]["web.unit"]["tests"] = ["web/tests/**/*.test.{ts,tsx}"]
    m["suites"]["web.built"]["tests"] = ["web/tests/a.test.ts", "!web/tests/a.test.ts", "web/tests/b.test.ts", "!web/tests/b.test.ts"]
    errs = run(tmp_path, m=m)
    assert "M1" in codes(errs) and any("imports helpers/built" in e for e in errs)


def test_m2_file_without_a_rule(tmp_path: Path) -> None:
    errs = run(tmp_path, extra={"tools/new.py": ""})
    assert codes(errs) == ["M2"] and "tools/new.py" in errs[0]


def test_m2_page_code_without_e2e(tmp_path: Path) -> None:
    m = mutate()
    m["area_required"] = ["web/app/**", "web/lib/**"]
    m["rules"].append({"id": "lib", "paths": ["web/lib/**"], "suites": ["web.unit"]})
    errs = run(tmp_path, m=m, extra={"web/lib/x.ts": ""})
    assert codes(errs) == ["M2"] and "no rule attaches e2e" in errs[0]


def test_m3_unmapped_and_stale_steps(tmp_path: Path) -> None:
    errs = run(tmp_path, steps=STEPS + 'step "a new check (LANE-9)"\n')
    assert codes(errs) == ["M3"] and "a new check" in errs[0]
    errs = run(tmp_path, steps='step "something else"\n')
    assert any("names no check-all step" in e for e in errs)


def test_m4_unattached_spec(tmp_path: Path) -> None:
    errs = run(tmp_path, extra={"web/tests/e2e/y.spec.ts": ""})
    assert codes(errs) == ["M4"] and "y.spec.ts" in errs[0]
    m = mutate()
    m["release_only"] = {"y.spec.ts": "runs only at release: needs live keys"}
    assert run(tmp_path, m=m, extra={"web/tests/e2e/y.spec.ts": ""}) == []


def test_m5_unknown_suite_dead_glob_and_quarantine(tmp_path: Path) -> None:
    m = mutate()
    m["rules"].append({"id": "bad", "paths": ["nothing/**"], "suites": ["no.such"], "e2e": ["zzz*.spec.ts"]})
    m["quarantine"] = [{"test": "web/tests/a.test.ts > flaky", "backlog": "15.999", "owner": "builder",
                        "added": "2026-10-01", "expires": "2026-10-20"}]
    errs = run(tmp_path, m=m)
    assert codes(errs) == ["M2", "M5"] or codes(errs) == ["M5"]
    text = "\n".join(errs)
    for want in ("unknown suite no.such", "\"nothing/**\" matches no file", "\"zzz*.spec.ts\" matches no spec", "expired on 2026-10-20",
                 "19 days; at most 14", "no BACKLOG row"):
        assert want in text


def test_m5_current_quarantine_passes_and_allowance_goes_stale(tmp_path: Path) -> None:
    m = mutate()
    m["quarantine"] = [{"test": "x", "backlog": "15.300", "owner": "builder", "added": "2026-10-20", "expires": "2026-11-02"}]
    m["full"] = ["tools/gate.sh"]
    m["allow_unmatched_globs"] = {"tools/gate.sh": "TS-2"}
    assert run(tmp_path, m=m, backlog="| 15.300 | flaky x |") == []
    errs = run(tmp_path, m=m, backlog="| 15.300 | flaky x |", extra={"tools/gate.sh": ""})
    assert any("now matches a file" in e for e in errs)


def test_m6_web_test_in_two_projects(tmp_path: Path) -> None:
    m = mutate()
    m["suites"]["web.built"]["tests"] = ["web/tests/b.test.ts", "web/tests/a.test.ts"]
    errs = run(tmp_path, m=m)
    assert "M6" in codes(errs) and any("web/tests/a.test.ts: owned by 2" in e for e in errs)


def test_m6_config_projects_must_carry_the_map_names(tmp_path: Path) -> None:
    good = "export default defineConfig({ test: { projects: [{ test: { name: 'unit' } }, { test: { name: 'built' } }] } });"
    assert run(tmp_path, vitest_config=good) == []
    errs = run(tmp_path, vitest_config="export default { test: { projects: [{ test: { name: 'unit' } }] } };")
    assert codes(errs) == ["M6"] and "\"built\"" in errs[0]


def test_m6_real_project_files_must_match_the_map(tmp_path: Path) -> None:
    good = {"unit": ["web/tests/a.test.ts"], "built": ["web/tests/b.test.ts"]}
    assert run(tmp_path, project_files=good) == []
    swapped = {"unit": ["web/tests/a.test.ts", "web/tests/b.test.ts"], "built": []}
    errs = run(tmp_path, project_files=swapped)
    assert codes(errs) == ["M6"] and len(errs) == 2
    assert any("web/tests/b.test.ts: the map puts it in built" in e for e in errs)
    assert any("web/tests/b.test.ts: vitest project unit runs it" in e for e in errs)


# ----- the replay (TS-1 acceptance; the full 80-merge run is `python3 tools/gate/replay.py`) ------------------------------------------------
def test_replay_of_recent_merges_misses_no_changed_test(real: tuple[dict, list[str]]) -> None:
    import replay
    m, _ = real
    try:
        rows, fails = replay.replay(m, 12, "HEAD")
    except Exception as exc:  # a shallow clone has no merge history to replay
        pytest.skip(f"no merge history: {exc}")
    if not rows:
        pytest.skip("no merges to replay")
    assert fails == []
