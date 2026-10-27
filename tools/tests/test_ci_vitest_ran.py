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
