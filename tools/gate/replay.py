"""Selection replay (docs/v2/build/TEST-STRATEGY.md 10.6, the TS-1 acceptance check).

    python3 tools/gate/replay.py [--merges 80] [--ref main] [--wide]

For each of the last N first-parent merges into <ref>, apply tools/gate/map.json to the merge's diff (first parent to merge)
and print one row: what kind of change it was, whether it took the full fallback and why, how many suites and e2e specs it
selected. It fails (exit 1) when
  * a test file the merge changed would not run (no selected suite owns it), or
  * a merge touched a path on the spec's own full list (TEST-STRATEGY 4.2, copied below so the map cannot narrow it
    silently) and the map did not select the full set.
Paths that match no rule are listed: the gate treats them as full, and a live one is a map gap to fix.
"""
from __future__ import annotations

# merges whose test-only change had no source path to select it; each needs a reason (the replay's author signal is a guard, not a law)
WAIVERS = {
    "b7f16785": "STACK-FIX: only pins and a scanner test changed (test_user_agents.py built its sample address at run time); no source path exists to select py.tools",
}

import argparse
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gatemap as gm  # noqa: E402

# TEST-STRATEGY 4.2 "full" at TS-1. The map may add to it, never drop from it. Two globs are written so the folder contract
# (tools/tree_check.py rule 10) does not read them as paths: the Next config glob ends in "*" and the gate wrapper (TS-2) uses a class.
SPEC_FULL = ["pnpm-lock.yaml", "package.json", "*/package.json", "pnpm-workspace.yaml", "**/tsconfig.json",
             "web/vitest.config.ts", "web/playwright.config.ts", "web/next.config*", "web/eslint.config.mjs",
             "core/vitest.config.ts", "tools/gate/**", "tools/gate.s[h]",
             "core/src/schema/**", "core/src/catalogue/store.ts", "core/src/privacy/**", "data/vocab/**",
             "web/tests/helpers/**", "core/test/setup/**", "web/tests/global-setup*.ts", "web/tests/e2e/global-setup.ts",
             "web/tests/e2e/fixtures.ts", "web/tests/budget.test.ts", "web/tests/data/place-html-baseline.json",
             "web/tests/data/place-size.test.ts", "web/app/layout.tsx", "web/app/themes.css", "tools/theme_tokens.py"]


def git(*args: str) -> str:
    return subprocess.run(["git", "-C", str(gm.ROOT), *args], check=True, capture_output=True).stdout.decode("utf-8", "replace")


def show(rev: str, path: str) -> str | None:
    r = subprocess.run(["git", "-C", str(gm.ROOT), "show", f"{rev}:{path}"], capture_output=True)
    return r.stdout.decode("utf-8", "replace") if r.returncode == 0 else None


def kind(m: dict, paths: list[str]) -> str:
    loud = [p for p in paths if not gm.match_any(m["quiet"], p)]
    if not loud:
        return "docs"
    tops = {p.split("/")[0] if "/" in p else "root" for p in loud}
    if tops <= {"data"}:
        return "data"
    if tops <= {"web"}:
        return "web"
    if "core" in tops:
        return "core+" if tops - {"core"} else "core"
    if "web" in tops:
        return "web+"
    return "+".join(sorted(tops))


def replay(m: dict, merges: int, ref: str) -> tuple[list[dict], list[str]]:
    shas = git("log", "--first-parent", "--merges", f"-{merges}", "--format=%H %ad %s", "--date=short", ref).splitlines()
    specs = sorted(p[len(gm.E2E_DIR):] for p in gm.repo_files() if gm.is_spec(p))
    rows, fails = [], []
    for line in shas:
        sha, date, subject = line.split(" ", 2)
        paths = [p for p in git("diff", "--name-only", "-z", f"{sha}^1", sha).split("\0") if p]
        old = new = None
        if "tools/check-all.sh" in paths:
            old, new = show(f"{sha}^1", "tools/check-all.sh") or "", show(sha, "tools/check-all.sh") or ""
        sel = gm.select(m, paths, check_all_old=old, check_all_new=new, specs=specs)
        branch = subject.replace("Merge ", "").split(" ")[0].replace("branch ", "").strip("'")
        spec_full = sorted({p for p in paths if gm.match_any(SPEC_FULL, p)})
        if spec_full and not sel.full:
            fails.append(f"{sha[:8]} {branch}: touched spec-full {spec_full[0]} but the map did not select full")
        if sel.full and not set(gm.full_suites(m)) <= set(sel.suites):
            fails.append(f"{sha[:8]} {branch}: full but suites missing")
        for p in paths:
            if gm.is_test_file(m, p) and (gm.ROOT / p).is_file():  # a test the merge deleted or renamed has no suite to own it
                own = [s for s in gm.owners(m, p) if s in sel.suites]
                if gm.is_spec(p) and p[len(gm.E2E_DIR):] not in sel.specs:
                    own = []
                if not own:
                    fails.append(f"{sha[:8]} {branch}: changed test {p} is owned by no selected suite")
        # the author's signal: would the rules alone, from the merge's other paths, have run each test it changed?
        changed_tests = [p for p in paths if gm.is_test_file(m, p) and (gm.ROOT / p).is_file()]
        rest = [p for p in paths if not gm.is_test_file(m, p)]
        implied = 0
        if changed_tests and rest:
            alone = gm.select(m, rest, check_all_old=old, check_all_new=new, specs=specs)
            for t in changed_tests:
                hit = (t[len(gm.E2E_DIR):] in alone.specs) if gm.is_spec(t) else any(o in alone.suites for o in gm.owners(m, t))
                implied += hit
                if not hit and sha[:8] not in WAIVERS:
                    fails.append(f"{sha[:8]} {branch}: the rules alone would not run {t}, which the merge changed with its code")
        reason = ""
        if sel.full:
            r = sel.full_reasons[0]
            reason = r.split(" (full: ")[0] if "(full:" in r else r
        rows.append({"sha": sha[:8], "date": date, "branch": branch[:26], "files": len(paths), "kind": kind(m, paths),
                     "full": sel.full, "reason": reason, "suites": len(sel.suites), "specs": len(sel.specs),
                     "tests": sum(1 for p in paths if gm.is_test_file(m, p)), "unmatched": sel.unmatched,
                     "spec_full": bool(spec_full), "map_only_full": sel.full and not spec_full,
                     "with_code": len(changed_tests) if rest else 0, "implied": implied})
    return rows, fails


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Replay the map over past merges (TS-1 acceptance).")
    ap.add_argument("--merges", type=int, default=80)
    ap.add_argument("--ref", default="main")
    a = ap.parse_args(argv)
    m = gm.load_map()
    rows, fails = replay(m, a.merges, a.ref)
    print(f"{'merge':8} {'date':10} {'branch':26} {'files':>5} {'kind':9} {'sel':>4} {'e2e':>3} {'tests':>5}  full because")
    for r in rows:
        why = r["reason"][:60] if r["full"] else "-"
        print(f"{r['sha']:8} {r['date']:10} {r['branch']:26} {r['files']:>5} {r['kind']:9} "
              f"{'FULL' if r['full'] else r['suites']:>4} {r['specs']:>3} {r['tests']:>5}  {why}")
    n = len(rows)
    by: dict[str, int] = {}
    for r in rows:
        by[r["kind"]] = by.get(r["kind"], 0) + 1
    full = sum(r["full"] for r in rows)
    code = [r for r in rows if r["kind"] != "docs"]
    print()
    print(f"{n} merges: " + ", ".join(f"{k} {v}" for k, v in sorted(by.items(), key=lambda kv: -kv[1])))
    print(f"full fallback: {full} of {n} ({full * 100 // max(n, 1)}%); of {len(code)} non-docs merges {sum(r['full'] for r in code)}; "
          f"on the spec's full list {sum(r['spec_full'] for r in rows)}, map-only full {sum(r['map_only_full'] for r in rows)}")
    print(f"changed test files: {sum(r['tests'] for r in rows)}, all owned by a selected suite: {'yes' if not any('changed test' in f for f in fails) else 'NO'}")
    print(f"tests changed with code (still on disk): {sum(r['with_code'] for r in rows)}, run by the rules alone: {sum(r['implied'] for r in rows)}")
    unmatched = sorted({p for r in rows for p in r["unmatched"]})
    live = [p for p in unmatched if (gm.ROOT / p).exists()]
    print(f"paths that matched no rule: {len(unmatched)} ({len(live)} still exist{': ' + ', '.join(live[:8]) if live else ''})")
    if fails:
        print("\nREPLAY FAILED:")
        for f in fails[:30]:
            print("  " + f)
        return 1
    print("REPLAY OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
