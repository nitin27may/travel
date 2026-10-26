"""Check that the path-to-suite map cannot rot (docs/v2/build/TEST-STRATEGY.md 4.3). Runs in check-all; about a second.

    python3 tools/gate/check_map.py            # exit 0 with one summary line, or exit 1 with at most 40 problem lines
    python3 tools/gate/check_map.py --explain web/app/page.tsx   # what one path selects, and why

M1  every test file is owned by a suite; a web unit test sits in the right vitest project (helpers/built -> built or fixture,
    a fixture build -> fixture, a wall-clock assertion -> timing, and each of those projects holds only such files)
M2  every file matches a rule, a "full" glob or a "quiet" glob; every file under "area_required" (code that renders a page)
    matches a rule that attaches e2e specs, unless it is a "full" path
M3  every `step` label of tools/check-all.sh is listed in some suite's "steps", and every listed step still exists
M4  every e2e spec is attached to a rule, or is "release_only" with a reason
M5  rules name known suites; every glob (each brace alternative) matches a file; quarantine entries are current, at most
    14 days long and name a BACKLOG row; "not_tests", "release_only" and "allow_unmatched_globs" entries are live
M6  the web vitest suites (unit, built, fixture, timing) own every web unit test file exactly once; once web/vitest.config.ts
    declares projects (TS-2a), it names those four
"""
from __future__ import annotations

import argparse
import datetime as dt
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gatemap as gm  # noqa: E402

WEB_PROJECTS = ("web.unit", "web.built", "web.fixture", "web.timing")
WEB_UNIT_GLOB = "web/tests/**/*.test.{ts,tsx}"
BUILT_RE = re.compile(r"""from\s+['"][./]*(?:\.\./)*helpers/built['"]|helpers/built['"]""")
FIXTURE_RE = re.compile(r"\.fixture-(?:out|beacon)\b")
BACKLOG = "docs/v2/build/public-site/BACKLOG.md"
MAX_LINES = 40


def timing_assertion(text: str) -> bool:
    """A wall-clock assertion: a value computed from performance.now() (directly, or one step removed) reaches expect()."""
    if "performance.now" not in text:
        return False
    names: set[str] = set()
    for line in text.splitlines():
        if "performance.now()" in line and "-" in line:
            m = re.search(r"(?:const|let|var)\s+(\w+)\s*=", line) or re.search(r"(\w+)\.push\(", line)
            if m:
                names.add(m.group(1))
    if not names:
        return False
    for _ in range(2):  # p95 = times[...], per = ms / n
        for line in text.splitlines():
            m = re.search(r"(?:const|let|var)\s+(\w+)\s*=(.*)", line)
            if m and any(re.search(rf"\b{re.escape(n)}\b", m.group(2)) for n in names):
                names.add(m.group(1))
    for m in re.finditer(r"expect\(([^,)]*)", text):
        arg = m.group(1)
        if "performance.now" in arg or any(re.search(rf"\b{re.escape(n)}\b", arg) for n in names):
            return True
    return False


def globs_of(m: dict) -> list[tuple[str, str]]:
    """(where, glob) for every path glob in the map, excludes stripped of their "!"."""
    out: list[tuple[str, str]] = []
    for sid, s in m["suites"].items():
        for key in ("inputs", "tests"):
            out += [(f"suites.{sid}.{key}", g.lstrip("!")) for g in s.get(key, [])]
    for r in m["rules"]:
        out += [(f"rules.{r['id']}.paths", g.lstrip("!")) for g in r["paths"]]
        out += [(f"rules.{r['id']}.tests", g) for g in r.get("tests", [])]
    for key in ("full", "quiet", "review", "area_required"):  # test_files is a detector: broad on purpose
        out += [(key, g.lstrip("!")) for g in m.get(key, [])]
    return out


def check(m: dict, files: list[str], check_all_text: str, root: Path = gm.ROOT, today: dt.date | None = None,
          backlog_text: str | None = None, vitest_config: str | None = None) -> list[str]:
    today = today or dt.date.today()
    errs: list[str] = []
    suites = m["suites"]
    fs = set(files)
    specs = sorted(p[len(gm.E2E_DIR):] for p in files if gm.is_spec(p))

    def read(p: str) -> str:
        f = root / p
        return f.read_text(encoding="utf-8", errors="replace") if f.is_file() else ""

    # M1 ----------------------------------------------------------------------------------------------------------------
    tests = [p for p in files if gm.is_test_file(m, p)]
    for p in tests:
        if not gm.owners(m, p):
            errs.append(f"M1 {p}: a test file no suite owns; add it to a suite's \"tests\" in tools/gate/map.json")
    for p in (p for p in tests if gm.match(WEB_UNIT_GLOB, p)):
        own = [s for s in gm.owners(m, p) if s in WEB_PROJECTS]
        text = read(p)
        fixture, built, timing = bool(FIXTURE_RE.search(text)), bool(BUILT_RE.search(text)), timing_assertion(text)
        want = "web.fixture" if fixture else "web.built" if built else "web.timing" if timing else "web.unit"
        if own and own != [want]:
            why = {"web.fixture": "reads a fixture build", "web.built": "imports helpers/built",
                   "web.timing": "asserts on a performance.now() time", "web.unit": "needs no build and asserts no time"}[want]
            errs.append(f"M1 {p}: {why}, so it belongs to {want}, not {', '.join(own)}")

    # M2 ----------------------------------------------------------------------------------------------------------------
    area_rules = [r for r in m["rules"] if r.get("e2e")]
    for p in files:
        in_full = gm.match_any(m["full"], p)
        ruled = any(gm.match_any(r["paths"], p) for r in m["rules"])
        if not (in_full or ruled or gm.match_any(m["quiet"], p) or gm.is_test_file(m, p) or p in m.get("not_tests", {})):
            errs.append(f"M2 {p}: matches no rule, no full glob and no quiet glob; add a rule to tools/gate/map.json")
        elif gm.match_any(m.get("area_required", []), p) and not in_full and not any(gm.match_any(r["paths"], p) for r in area_rules):
            errs.append(f"M2 {p}: renders a page but no rule attaches e2e specs to it; add it to an area rule")

    # M3 ----------------------------------------------------------------------------------------------------------------
    labels = gm.check_all_steps(check_all_text)
    for label in labels:
        if not gm.suites_for_step(m, label):
            errs.append(f"M3 check-all step \"{label[:70]}\" belongs to no suite; list it in a suite's \"steps\"")
    for sid, s in suites.items():
        for e in s.get("steps", []):
            hits = [x for x in labels if gm.step_matches(e, x)]
            if not hits:
                errs.append(f"M3 suites.{sid}.steps \"{e}\" names no check-all step")
            elif len(hits) > 1:
                errs.append(f"M3 suites.{sid}.steps \"{e}\" names {len(hits)} steps; make it longer")

    # M4 ----------------------------------------------------------------------------------------------------------------
    release_only = m.get("release_only", {})
    for s in specs:
        attached = any(g != gm.IMPORTERS and gm.match(g, s) for r in m["rules"] for g in r.get("e2e", []))
        if not attached and s not in release_only:
            errs.append(f"M4 {gm.E2E_DIR}{s}: attached to no rule; add it to a rule's \"e2e\" or to \"release_only\" with a reason")

    # M5 ----------------------------------------------------------------------------------------------------------------
    for r in m["rules"]:
        for sid in r.get("suites", []):
            if sid not in suites:
                errs.append(f"M5 rules.{r['id']} names unknown suite {sid}")
        for g in r.get("e2e", []):
            if g != gm.IMPORTERS and not any(gm.match(g, s) for s in specs):
                errs.append(f"M5 rules.{r['id']}.e2e \"{g}\" matches no spec")
        for t in r.get("tests", []):
            if t not in fs or not gm.is_test_file(m, t):
                errs.append(f"M5 rules.{r['id']}.tests \"{t}\" is not a test file")
    for sid, s in suites.items():
        for dep in s.get("needs", []):
            if dep not in suites:
                errs.append(f"M5 suites.{sid}.needs names unknown suite {dep}")
    ids = [r["id"] for r in m["rules"]]
    for dup in sorted({i for i in ids if ids.count(i) > 1}):
        errs.append(f"M5 rule id {dup} is used twice")
    allow = m.get("allow_unmatched_globs", {})
    for where, g in globs_of(m):
        for alt in gm.expand_braces(g):
            hit = any(gm.match(alt, p) for p in files)
            if not hit and alt not in allow:
                errs.append(f"M5 {where} \"{alt}\" matches no file")
    for g in allow:
        if any(gm.match(g, p) for p in files):
            errs.append(f"M5 allow_unmatched_globs \"{g}\" now matches a file; remove the allowance")
    for p in m.get("not_tests", {}):
        if p not in fs:
            errs.append(f"M5 not_tests \"{p}\" does not exist")
    for s in release_only:
        if s not in specs:
            errs.append(f"M5 release_only \"{s}\" is not a spec")
        elif not str(release_only[s]).strip():
            errs.append(f"M5 release_only \"{s}\" has no reason")
    backlog_text = read(BACKLOG) if backlog_text is None else backlog_text
    for q in m.get("quarantine", []):
        tid = q.get("test", "?")
        try:
            added, expires = dt.date.fromisoformat(q["added"]), dt.date.fromisoformat(q["expires"])
        except (KeyError, ValueError):
            errs.append(f"M5 quarantine {tid}: needs ISO dates \"added\" and \"expires\"")
            continue
        if expires < today:
            errs.append(f"M5 quarantine {tid}: expired on {expires}; fix the test or renew with a reason")
        if (expires - added).days > 14:
            errs.append(f"M5 quarantine {tid}: {(expires - added).days} days; at most 14")
        row = str(q.get("backlog", "")).strip()
        if not row or row not in backlog_text:
            errs.append(f"M5 quarantine {tid}: names no BACKLOG row found in {BACKLOG}")
        if not str(q.get("owner", "")).strip():
            errs.append(f"M5 quarantine {tid}: has no owner")

    # M6 ----------------------------------------------------------------------------------------------------------------
    for p in (p for p in tests if gm.match(WEB_UNIT_GLOB, p)):
        own = [s for s in WEB_PROJECTS if s in suites and gm.match_any(suites[s].get("tests", []), p)]
        if len(own) != 1:
            errs.append(f"M6 {p}: owned by {len(own)} web vitest suites ({', '.join(own) or 'none'}); exactly one")
    vitest_config = read("web/vitest.config.ts") if vitest_config is None else vitest_config
    if re.search(r"\bprojects\s*:", vitest_config):
        for sid in WEB_PROJECTS:
            name = suites.get(sid, {}).get("vitest", {}).get("project")
            if name and not re.search(rf"""name\s*:\s*['"]{re.escape(name)}['"]""", vitest_config):
                errs.append(f"M6 web/vitest.config.ts declares projects but none named \"{name}\" ({sid})")
    return errs


def summary(m: dict, files: list[str]) -> str:
    tests = [p for p in files if gm.is_test_file(m, p)]
    web_unit = [p for p in tests if gm.match(WEB_UNIT_GLOB, p)]
    specs = [p for p in files if gm.is_spec(p)]
    return (f"gate map OK: {len(files)} files, {len(m['rules'])} rules, {len(m['suites'])} suites, {len(m['full'])} full globs; "
            f"{len(tests)} test files owned ({len(web_unit)} web unit in 4 suites), {len(specs)} e2e specs attached")


def explain(m: dict, path: str) -> list[str]:
    sel = gm.select(m, [path])
    out = [f"{path}: {'FULL (' + '; '.join(sel.full_reasons) + ')' if sel.full else 'selected'}"]
    out += [f"  {sid:15} {', '.join(why)}" for sid, why in sel.suites.items()]
    if sel.tests:
        out.append("  tests: " + ", ".join(sorted(sel.tests)))
    if sel.specs:
        out.append("  e2e: " + ", ".join(sorted(sel.specs)))
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Check tools/gate/map.json (TEST-STRATEGY 4.3, M1 to M6).")
    ap.add_argument("--explain", metavar="PATH", help="print what one path selects, and why")
    a = ap.parse_args(argv)
    m = gm.load_map()
    if a.explain:
        print("\n".join(explain(m, a.explain)))
        return 0
    files = gm.repo_files()
    errs = check(m, files, gm.CHECK_ALL.read_text(encoding="utf-8"))
    if not errs:
        print(summary(m, files))
        return 0
    print(f"gate map broken: {len(errs)} problem(s) (tools/gate/map.json; tools/gate/README.md)", file=sys.stderr)
    for e in errs[:MAX_LINES - 2]:
        print("  " + e, file=sys.stderr)
    if len(errs) > MAX_LINES - 2:
        print(f"  ... and {len(errs) - MAX_LINES + 2} more", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
