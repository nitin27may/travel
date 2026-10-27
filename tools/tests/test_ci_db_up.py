"""tools/ci/db_up.sh and the db-local / summary jobs of check.yml (WF-3). Docker is faked: nothing here needs a daemon."""
from __future__ import annotations

import os
import re
import stat
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "tools/ci/db_up.sh"
DIGEST = "sha256:" + "cd" * 32
BASE = f"postgres:18-trixie@{DIGEST}"
FAKE = """#!/usr/bin/env bash
echo "$@" >> "$FAKE_LOG"
case "$1" in
  build) cp "${@: -1}/Dockerfile" "$FAKE_DOCKERFILE" ;;
  exec)  case "$*" in *psql*) echo "${FAKE_TEMPLATE-1}" ;; *) exit "${FAKE_READY:-0}" ;; esac ;;
esac
exit 0
"""


def run(tmp_path: Path, **env: str) -> subprocess.CompletedProcess:
    bindir = tmp_path / "bin"
    bindir.mkdir(exist_ok=True)
    docker = bindir / "docker"
    docker.write_text(FAKE)
    docker.chmod(docker.stat().st_mode | stat.S_IEXEC)
    base = {"PATH": f"{bindir}:{os.environ['PATH']}", "FAKE_LOG": str(tmp_path / "docker.log"), "FAKE_DOCKERFILE": str(tmp_path / "Dockerfile.seen"),
            "PG_BASE_IMAGE": BASE, "CI_DB_SUPERUSER_PASSWORD": "ci-throwaway-superuser", "CI_DB_OWNER_PASSWORD": "ci-throwaway-owner"}
    return subprocess.run(["bash", str(SCRIPT)], capture_output=True, text=True, env={**base, **env}, timeout=60)


def test_builds_on_the_pinned_base_and_publishes_on_loopback_only(tmp_path):
    r = run(tmp_path)
    assert r.returncode == 0, r.stdout + r.stderr
    seen = (tmp_path / "Dockerfile.seen").read_text()
    assert [ln for ln in seen.splitlines() if ln.startswith("FROM")] == [f"FROM {BASE}"]
    assert "FROM postgres:18-trixie\n" not in seen
    log = (tmp_path / "docker.log").read_text()
    assert "127.0.0.1:54329:5432" in log
    assert not re.search(r"--publish\s+(?!127\.0\.0\.1:)\S", log)
    assert "ready on 127.0.0.1:54329" in r.stdout


def test_the_repository_dockerfile_is_untouched_and_still_starts_from_the_floating_tag(tmp_path):
    run(tmp_path)
    assert (ROOT / "tools/db/Dockerfile").read_text().startswith("# Local Postgres")
    assert re.search(r"^FROM postgres:18-trixie$", (ROOT / "tools/db/Dockerfile").read_text(), re.M)


def test_output_never_holds_a_password(tmp_path):
    r = run(tmp_path)
    assert "throwaway" not in r.stdout + r.stderr


def test_refuses_a_base_that_is_not_pinned_by_digest(tmp_path):
    for bad in ("postgres:18-trixie", "postgres:18@" + DIGEST, "postgis/postgis:18-3.6@" + DIGEST, "postgres:18-trixie@sha256:abc"):
        r = run(tmp_path, PG_BASE_IMAGE=bad)
        assert r.returncode == 1 and "pinned by a sha256 digest" in r.stdout, bad
        assert not (tmp_path / "docker.log").exists()


def test_refuses_passwords_that_are_not_throwaway_values(tmp_path):
    for var in ("CI_DB_SUPERUSER_PASSWORD", "CI_DB_OWNER_PASSWORD"):
        for bad in ("hunter2", "ci-has space", ""):
            r = run(tmp_path, **{var: bad})
            assert r.returncode == 1 and var in r.stdout
    assert not (tmp_path / "docker.log").exists()


def test_fails_when_the_template_database_never_appears(tmp_path):
    r = subprocess.run(["bash", "-c", f"sed 's/seq 1 60/seq 1 1/; s/sleep 2/true/' {SCRIPT} > {tmp_path}/fast.sh"], capture_output=True)
    assert r.returncode == 0
    bindir = tmp_path / "bin"
    bindir.mkdir(exist_ok=True)
    (bindir / "docker").write_text(FAKE)
    (bindir / "docker").chmod(0o755)
    env = {"PATH": f"{bindir}:{os.environ['PATH']}", "FAKE_LOG": str(tmp_path / "l"), "FAKE_DOCKERFILE": str(tmp_path / "d"), "FAKE_TEMPLATE": "",
           "PG_BASE_IMAGE": BASE, "CI_DB_SUPERUSER_PASSWORD": "ci-a", "CI_DB_OWNER_PASSWORD": "ci-b"}
    # the copy lives outside the repo, so point it back at tools/db
    text = (tmp_path / "fast.sh").read_text().replace('here="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"', f'here="{ROOT}"')
    (tmp_path / "fast.sh").write_text(text)
    out = subprocess.run(["bash", str(tmp_path / "fast.sh")], capture_output=True, text=True, env=env, timeout=60)
    assert out.returncode == 1 and "did not become ready" in out.stdout 


# ----- the workflow's db-local and summary jobs ------------------------------------------------------------------------------------
WORKFLOW = (ROOT / ".github/workflows/check.yml").read_text()


def job(name: str) -> str:
    m = re.search(rf"^  {re.escape(name)}:\n(.*?)(?=^  [\w-]+:\n|\Z)", WORKFLOW, re.S | re.M)
    assert m, name
    return m.group(1)


def test_db_local_pins_the_base_image_and_uses_only_ci_values():
    j = job("db-local")
    assert re.search(r"PG_BASE_IMAGE: postgres:18-trixie@sha256:[0-9a-f]{64}\b", j)
    for var in ("CI_DB_SUPERUSER_PASSWORD", "CI_DB_OWNER_PASSWORD"):
        assert re.search(rf"{var}: ci-[A-Za-z0-9-]+\s*$", j, re.M)
    assert "secrets." not in j and "TEST_DATABASE_URL" not in j and "DATABASE_URL:" not in j.replace("LOCAL_DATABASE_URL:", "")
    assert j.index("- run: bash tools/ci/guard_env.sh") < j.index("- run: bash tools/ci/db_up.sh") < j.index("- run: tools/gate.sh")
    assert "--group db" in j and "vitest_ran.py" in j


def test_the_web_job_keeps_the_build_offline_and_saves_caches_on_main_only():
    j = job("web")
    assert "--group web" in j and "budget-report.mjs --markdown" in j
    assert re.search(r"^  COMMONS_FETCH_GUARD: '1'", WORKFLOW, re.M)
    saves = re.findall(r"actions/cache/save@\S+[^\n]*\n(?:\s+(?:if|with|path|key)[^\n]*\n)+", j)
    assert saves and all("refs/heads/main" in s for s in saves)


def summary_run() -> str:
    m = re.search(r"- name: Summarise and decide\n.*?        run: \|\n(.*)\Z", job("summary"), re.S)
    assert m
    return "\n".join(ln[10:] for ln in m.group(1).splitlines())


def summarise(tmp_path: Path, **env: str) -> tuple[int, str]:
    out = tmp_path / "step-summary.md"
    base = {"PLAN": "success", "LINKS": "skipped", "CORE_DATA": "skipped", "WEB": "skipped", "DB_LOCAL": "skipped", "GROUPS_PLANNED": "",
            "MAC_ONLY": "", "CI_EXCLUDED": "", "SHA": "a" * 40, "GITHUB_STEP_SUMMARY": str(out), "PATH": os.environ["PATH"]}
    r = subprocess.run(["bash", "-c", summary_run()], capture_output=True, text=True, env={**base, **env})
    return r.returncode, r.stdout


def test_summary_green_only_when_nothing_is_pending(tmp_path):
    code, out = summarise(tmp_path, LINKS="success", GROUPS_PLANNED="links")
    assert code == 0 and "Overall: green" in out and "partial" not in out


def test_summary_stays_partial_for_groups_with_no_job(tmp_path):
    code, out = summarise(tmp_path, LINKS="success", WEB="success", GROUPS_PLANNED="links,web,e2e")
    assert code == 0 and "Overall: partial (not run in CI: e2e)" in out and "Overall: green" not in out
    code, out = summarise(tmp_path, LINKS="success", GROUPS_PLANNED="links,visual")
    assert "not run in CI: visual" in out


def test_summary_no_longer_calls_web_or_db_pending(tmp_path):
    code, out = summarise(tmp_path, LINKS="success", WEB="success", DB_LOCAL="success", GROUPS_PLANNED="links,web,db")
    assert code == 0 and "Overall: green" in out and "not run in CI" not in out


def test_summary_lists_the_mac_only_work_and_does_not_call_it_plain_green(tmp_path):
    code, out = summarise(tmp_path, WEB="success", GROUPS_PLANNED="web", MAC_ONLY="web.timing", CI_EXCLUDED="web/tests/data/place-size.test.ts")
    assert code == 0 and "web.timing" in out and "place-size.test.ts" in out
    assert "Overall: green for everything CI runs; the Mac-only checks above are still owed" in out


def test_summary_is_red_when_a_planned_job_failed_was_skipped_or_cancelled(tmp_path):
    for result in ("failure", "cancelled", "skipped"):
        code, out = summarise(tmp_path, WEB=result, GROUPS_PLANNED="web")
        assert code == 1 and "Overall: RED" in out, result
        code, out = summarise(tmp_path, DB_LOCAL=result, GROUPS_PLANNED="db")
        assert code == 1 and "Overall: RED" in out, result
    code, out = summarise(tmp_path, PLAN="failure")
    assert code == 1


def test_summary_is_red_when_an_unplanned_job_failed_anyway(tmp_path):
    code, out = summarise(tmp_path, WEB="failure", GROUPS_PLANNED="links", LINKS="success")
    assert code == 1


# ----- WF-3b: pull retry with a backoff (S8), the summary lists allowed skips, plan output ---------------------------------------------
FAKE_PULL = FAKE.replace('case "$1" in', '''case "$1" in
  pull) n=$(cat "$FAKE_PULLS" 2>/dev/null || echo 0); echo $((n+1)) > "$FAKE_PULLS"; [ "$n" -lt "${FAKE_PULL_FAILS:-0}" ] && exit 1 ;;''', 1)


def run_pull(tmp_path: Path, fails: int) -> subprocess.CompletedProcess:
    bindir = tmp_path / "bin"
    bindir.mkdir(exist_ok=True)
    (bindir / "docker").write_text(FAKE_PULL)
    (bindir / "docker").chmod(0o755)
    env = {"PATH": f"{bindir}:{os.environ['PATH']}", "FAKE_LOG": str(tmp_path / "docker.log"), "FAKE_DOCKERFILE": str(tmp_path / "Dockerfile.seen"),
           "FAKE_PULLS": str(tmp_path / "pulls"), "FAKE_PULL_FAILS": str(fails), "CI_DB_PULL_BACKOFF": "0", "PG_BASE_IMAGE": BASE,
           "CI_DB_SUPERUSER_PASSWORD": "ci-a", "CI_DB_OWNER_PASSWORD": "ci-b"}
    return subprocess.run(["bash", str(SCRIPT)], capture_output=True, text=True, env=env, timeout=60)


def test_a_rate_limited_pull_is_retried_and_the_job_goes_on(tmp_path):
    r = run_pull(tmp_path, fails=2)
    assert r.returncode == 0, r.stdout
    assert (tmp_path / "pulls").read_text().strip() == "3" and r.stdout.count("pulling the base image failed") == 2


def test_a_pull_that_never_works_fails_after_four_attempts_before_any_build(tmp_path):
    r = run_pull(tmp_path, fails=99)
    assert r.returncode == 1 and "could not pull the pinned base image in 4 attempts" in r.stdout
    assert (tmp_path / "pulls").read_text().strip() == "4"
    assert "build" not in (tmp_path / "docker.log").read_text()


def test_summary_lists_the_allowed_skips_as_owed_on_the_mac(tmp_path):
    code, out = summarise(tmp_path, WEB="success", GROUPS_PLANNED="web", CI_SKIPS="web/tests/data/public-privacy.test.ts")
    assert code == 0 and "Owed on the Mac, tests that skip in CI" in out and "public-privacy.test.ts" in out
    assert "Overall: green for everything CI runs; the Mac-only checks above are still owed" in out
    code, out = summarise(tmp_path, WEB="success", GROUPS_PLANNED="web")
    assert "Overall: green" in out and "still owed" not in out


def test_the_web_and_db_jobs_fail_on_an_unexpected_skip_and_pass_the_separator():
    for name in ("web", "db-local"):
        assert "vitest_ran.py --no-skips --map tools/gate/map.json" in job(name), name
    db = job("db-local")
    assert re.search(r"gate-logs/\*\.log -- \\\n\s+test/db/integration", db), "the files after the log glob need `--` (S7)"
    assert "LOCAL_DB_RESET_TEST" not in re.sub(r"#[^\n]*", "", db)  # it drives docker compose on the same port; allow-listed instead
