"""tools/ci/vitest_ran.py (WF-3): a database test file that skipped or did not run must fail the job."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools" / "ci"))
import vitest_ran as vr  # noqa: E402

LOG = """$ vitest run test/db
 ✓ test/db/integration.test.ts (9 tests) 812ms
 ↓ test/db/localReset.test.ts (1 test | 1 skipped)
 ✓ test/db/seed.integration.test.ts (12 tests | 1 skipped) 5000ms
 ❯ test/db/stub.test.ts (4 tests | 1 failed) 90ms
   ✓ nested test of test/db/quota.test.ts (3)
"""


def test_verdicts():
    v = vr.verdicts(LOG, ["test/db/integration.test.ts", "test/db/localReset.test.ts", "test/db/seed.integration.test.ts",
                          "test/db/stub.test.ts", "test/db/quota.test.ts"])
    assert v == {"test/db/integration.test.ts": "ran", "test/db/localReset.test.ts": "skipped", "test/db/seed.integration.test.ts": "skipped",
                 "test/db/stub.test.ts": "failed", "test/db/quota.test.ts": "missing"}


def test_ansi_colour_and_a_path_prefix_do_not_hide_a_file():
    line = "\x1b[32m ✓\x1b[39m |unit| test/db/integration.test.ts \x1b[2m(9 tests)\x1b[22m 5ms"
    assert vr.verdicts(line, ["test/db/integration.test.ts"]) == {"test/db/integration.test.ts": "ran"}


def test_a_similar_name_is_not_the_file():
    assert vr.verdicts(" ✓ test/db/integration.test.tsx (1 test)", ["test/db/integration.test.ts"]) == {"test/db/integration.test.ts": "missing"}


def run(tmp_path: Path, log: str, *files: str) -> subprocess.CompletedProcess:
    f = tmp_path / "gate.log"
    f.write_text(log, encoding="utf-8")
    return subprocess.run([sys.executable, str(ROOT / "tools/ci/vitest_ran.py"), str(f), "--", *files], capture_output=True, text=True)


def test_cli_exit_codes(tmp_path):
    assert run(tmp_path, LOG, "test/db/integration.test.ts").returncode == 0
    bad = run(tmp_path, LOG, "test/db/integration.test.ts", "test/db/seed.integration.test.ts", "test/db/quota.test.ts")
    assert bad.returncode == 1 and "seed.integration.test.ts: skipped" in bad.stdout and "quota.test.ts: missing" in bad.stdout
    assert subprocess.run([sys.executable, str(ROOT / "tools/ci/vitest_ran.py")], capture_output=True).returncode == 2


# ----- WF-3b: `--` is honoured (S7) and --no-skips (S3) ----------------------------------------------------------------------------
def cli(*args: str, cwd: Path | None = None) -> subprocess.CompletedProcess:
    return subprocess.run([sys.executable, str(ROOT / "tools/ci/vitest_ran.py"), *args], capture_output=True, text=True, cwd=cwd)


def test_an_existing_test_path_after_the_separator_is_a_file_to_check_not_a_log(tmp_path):
    (tmp_path / "test" / "db").mkdir(parents=True)
    (tmp_path / "test/db/stub.test.ts").write_text("// the test file itself exists, as it does when run from core/")
    (tmp_path / "gate.log").write_text(" ✓ test/db/integration.test.ts (9 tests)\n")
    r = cli("gate.log", "--", "test/db/integration.test.ts", "test/db/stub.test.ts", cwd=tmp_path)
    assert r.returncode == 1 and "stub.test.ts: missing" in r.stdout  # the old guess dropped it from the check and passed


def test_without_the_separator_nothing_is_guessed(tmp_path):
    (tmp_path / "gate.log").write_text(" ✓ test/db/integration.test.ts (9 tests)\n")
    assert cli("gate.log", "test/db/integration.test.ts", cwd=tmp_path).returncode == 2
    assert cli("--", "test/db/integration.test.ts", cwd=tmp_path).returncode == 2  # no log before it
    assert cli("nolog.log", "--", "test/db/integration.test.ts", cwd=tmp_path).returncode == 2  # a log that does not exist


SKIP_LOG = """ ✓ |unit| tests/a.test.ts (3 tests) 5ms
 ✓ |fixture| tests/data/public-privacy.test.ts (12 tests | 3 skipped) 40ms
 ↓ test/db/localReset.test.ts (1 test | 1 skipped)
 ✓ test/other.test.ts (2 tests | 1 todo)
"""


def test_skipped_files_are_found_whole_or_partial_with_todo(tmp_path):
    assert vr.skipped_files(SKIP_LOG) == ["tests/data/public-privacy.test.ts", "test/db/localReset.test.ts", "test/other.test.ts"]


def test_no_skips_fails_on_a_skip_the_map_does_not_allow_and_lists_the_allowed_ones(tmp_path):
    (tmp_path / "gate.log").write_text(SKIP_LOG)
    (tmp_path / "map.json").write_text('{"ci_skips": {"web/tests/data/public-privacy.test.ts": {}, "core/test/db/localReset.test.ts": {}}}')
    r = cli("--no-skips", "--map", "map.json", "gate.log", cwd=tmp_path)
    assert r.returncode == 1
    assert "test/other.test.ts: skipped" in r.stdout and "public-privacy" not in r.stdout.split("owed on the Mac")[0]
    assert "web/tests/data/public-privacy.test.ts" in r.stdout and "core/test/db/localReset.test.ts" in r.stdout


def test_no_skips_passes_when_every_skip_is_allowed_or_there_is_none(tmp_path):
    (tmp_path / "gate.log").write_text(" ✓ tests/a.test.ts (3 tests)\n ✓ tests/b.test.ts (1 test | 1 skipped)\n")
    assert cli("--no-skips", "--map", "map.json", "gate.log", cwd=tmp_path).returncode == 2  # an unreadable map is a usage error
    (tmp_path / "map.json").write_text('{"ci_skips": {"web/tests/b.test.ts": {}}}')
    assert cli("--no-skips", "--map", "map.json", "gate.log", cwd=tmp_path).returncode == 0
    (tmp_path / "map.json").write_text("{}")
    assert cli("--no-skips", "--map", "map.json", "gate.log", cwd=tmp_path).returncode == 1


def test_an_allow_entry_matches_a_whole_path_segment_only(tmp_path):
    assert vr.allowed("tests/b.test.ts", ["web/tests/b.test.ts"]) == "web/tests/b.test.ts"
    assert vr.allowed("ests/b.test.ts", ["web/tests/b.test.ts"]) is None


def test_the_project_label_vitest_prints_without_pipes_is_read_too():
    """A real web log (non-TTY, CI=true) prints ` ✓  fixture  tests/data/x.test.ts (12 tests | 3 skipped)`; the db log has no label at all."""
    line = "\x1b[32m ✓\x1b[39m \x1b[30m\x1b[43m fixture \x1b[49m\x1b[39m tests/data/public-privacy.test.ts \x1b[2m(\x1b[22m\x1b[2m12 tests\x1b[22m\x1b[2m | \x1b[22m\x1b[33m3 skipped\x1b[39m\x1b[2m)\x1b[22m 8369ms"
    assert vr.skipped_files(line) == ["tests/data/public-privacy.test.ts"]
    assert vr.verdicts(line, ["tests/data/public-privacy.test.ts"]) == {"tests/data/public-privacy.test.ts": "skipped"}
    assert vr.verdicts(" ✓ unit tests/a.test.ts (3 tests) 5ms", ["tests/a.test.ts"]) == {"tests/a.test.ts": "ran"}
    assert vr.skipped_files(" ✓ test/db/x.test.ts (3 tests)") == []
