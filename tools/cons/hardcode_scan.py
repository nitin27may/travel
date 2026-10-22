#!/usr/bin/env python3
"""Hard-coding ratchet (CONS-1; EXECUTION-PLAN 5.3, PHASE-B-START section 7).

Mechanical and offline: reads tracked and untracked-but-not-ignored SOURCE files under core/, web/ and tools/ (never data values: a
ref such as `legacy/canadian-rockies-sept-2029/adventures/banff-gondola` is an id, and data/ is not scanned at all), strips comment-only
lines, and counts findings per (rule, file). `baseline.json` holds the allowed count per (rule, file) plus a reason for the entries that are
intentional exceptions. The check fails when a (rule, file) count rises above its baseline or appears new. A count that falls is reported
so the baseline can be tightened with --write (the ratchet only turns one way).

    python3 tools/cons/hardcode_scan.py --check     # exit 1 on a new finding, prints file:line rule
    python3 tools/cons/hardcode_scan.py --write     # rewrite the counts (keeps reasons), after you removed violations
    python3 tools/cons/hardcode_scan.py --list      # every finding as file:line rule
    python3 tools/cons/hardcode_scan.py --summary   # counts per rule

The env-table rule has no baseline: every environment variable name read in code must be a row of the "Environment variables" section of
docs/v2/build/public-site/README.md.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASELINE = Path(__file__).with_name("baseline.json")
README = ROOT / "docs/v2/build/public-site/README.md"
SCAN_DIRS = ("core", "web", "tools")
CODE_EXT = {".ts", ".tsx", ".mjs", ".js", ".py", ".css"}
SKIP_PARTS = {"node_modules", "out", "test-results", "playwright-report", "data-snapshots", "prototype"}
# The generated colour file and this guard's own files are not product source.
SKIP_FILES = {"web/app/themes.css", "tools/cons/hardcode_scan.py", "tools/tests/test_hardcode_scan.py"}

TEST_RE = re.compile(r"(^|/)(tests?|__tests__|fixtures?|e2e)/|\.(test|spec)\.[a-z]+$|(^|/)test_[^/]+\.py$|(^|/)conftest\.py$")

# ----- rules ---------------------------------------------------------------------------------------------------------------------------
NAMED_COLOURS = (
    "red|green|blue|black|white|gray|grey|orange|yellow|purple|pink|brown|teal|navy|olive|maroon|cyan|magenta|lime|gold|silver|"
    "tomato|coral|salmon|crimson|indigo|violet|ivory|beige|khaki|tan|azure|aqua|lavender|plum|orchid|turquoise|chocolate|firebrick"
)
RULES: dict[str, re.Pattern[str]] = {
    # A colour written as rgb(), hsl() or similar. Hex is held by web/tests/no-hex.test.ts; themes.css is the only home of colour.
    "colour-fn": re.compile(r"\b(rgba?|hsla?|hwb|oklch|oklab)\("),
    "colour-hex": re.compile(r"(^|[^&\w/])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b"),
    # A named colour used as a style value: a CSS declaration or a JSX/object style property.
    "colour-named": re.compile(
        r"(?:\b(?:color|background(?:-color)?|fill|stroke|border(?:-[a-z]+)*|outline(?:-color)?|caret-color|accent-color)\s*[:=]\s*[\"']?(?:%s)\b(?![-\w]))"
        % NAMED_COLOURS
    ),
    "site-host": re.compile(r"nks-travel\.pages\.dev"),
    "user-agent": re.compile(r"[\"'`][a-z][a-z0-9-]*/\d+\.\d+ \((?:\+https?://|[a-z])"),
    "api-host": re.compile(
        r"overpass[-\w.]*\.(?:de|org|fr|kumi\.systems)|nominatim\.openstreetmap\.org|(?:query\.)?wikidata\.org|"
        r"commons\.wikimedia\.org|[a-z]{2}\.wikipedia\.org|api\.openrouteservice\.org|api\.open-meteo\.com"
    ),
    "earth-radius": re.compile(r"(?<![\w.])(6371(?:\.\d+)?|6378(?:\.\d+)?|6_371_000|6371e3|6371000)(?![\w.])"),
    "km-constant": re.compile(r"\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*_KM\b\s*(?::\s*[\w\[\]<>| ]+)?=(?!=)"),
    "ms-constant": re.compile(r"\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*_MS\b\s*(?::\s*[\w\[\]<>| ]+)?=(?!=)"),
    # A number written into visible copy ("12 places" in JSX text); counts come from data.
    "count-in-copy": re.compile(r">\s*\d[\d,]*\s+(?:places|trips|trails|sights|stays|photos|days|nights)\b"),
}
SLUG_SCOPES = ("web/lib", "web/components", "web/app", "web/scripts", "core/src", "core/bin")
KIND_KEYS = (
    "trail|trailhead|parking|viewpoint|lake|waterfall|sight|town|adventure|activity|lift|hut|stay|eatery|swim_spot|event|area|scenic_drive|"
    "beach|museum|park|peak"
)
KIND_PAIR = re.compile(r"(?:^|[\s,{])[\"']?(%s)[\"']?\s*:\s*[\"'][A-Z][A-Za-z ]+[\"']" % KIND_KEYS)

ENV_PATTERNS = [
    re.compile(r"process\.env\.([A-Z][A-Z0-9_]*[A-Z0-9])\b"),
    re.compile(r"process\.env\[\s*[\"']([A-Z][A-Z0-9_]*[A-Z0-9])[\"']\s*\]"),
    re.compile(r"import\.meta\.env\.([A-Z][A-Z0-9_]*[A-Z0-9])\b"),
    re.compile(r"\benv\.([A-Z][A-Z0-9_]{3,}[A-Z0-9])\b"),
    re.compile(r"os\.environ(?:\.get)?[\(\[]\s*[\"']([A-Z][A-Z0-9_]*[A-Z0-9])[\"']"),
    re.compile(r"os\.getenv\(\s*[\"']([A-Z][A-Z0-9_]*[A-Z0-9])[\"']"),
]
ENV_DESTRUCTURE = re.compile(r"\{([^}]*)\}\s*=\s*process\.env")
# Names that are not ours and need no row: the shell and the platform.
ENV_IGNORE = {"PATH"}


def listed_files() -> list[str]:
    out = subprocess.run(
        ["git", "-C", str(ROOT), "ls-files", "--cached", "--others", "--exclude-standard", "-z", "--", *SCAN_DIRS],
        check=True, capture_output=True,
    ).stdout.decode()
    files = []
    for rel in filter(None, out.split("\0")):
        p = Path(rel)
        if p.suffix not in CODE_EXT or rel in SKIP_FILES:
            continue
        if rel.startswith("web/public/") or SKIP_PARTS & set(p.parts) or any(part.startswith((".next", ".fixture", ".generated")) for part in p.parts):
            continue
        if not (ROOT / rel).is_file():
            continue
        files.append(rel)
    return sorted(set(files))


def trip_slugs() -> list[str]:
    m = json.loads((ROOT / "legacy/MANIFEST.json").read_text())
    folders = m["folders"] if isinstance(m, dict) else m
    return sorted(f["slug"] for f in folders if f.get("kind") != "site-page" and re.search(r"-(\d{4}|20\d\d)$|-summer$|ring-road$", f["slug"]))


def code_lines(rel: str, text: str) -> list[tuple[int, str]]:
    """(line number, line) with comment-only lines blanked. Block comments are tracked; trailing comments stay (a literal before one counts)."""
    py = rel.endswith(".py")
    out: list[tuple[int, str]] = []
    in_block = False
    in_doc = False
    for i, line in enumerate(text.split("\n"), 1):
        s = line.strip()
        if py:
            if s.count('"""') % 2 == 1:
                in_doc = not in_doc
                out.append((i, ""))
                continue
            if in_doc or s.startswith("#"):
                out.append((i, ""))
                continue
        else:
            if in_block:
                if "*/" in s:
                    in_block = False
                out.append((i, ""))
                continue
            if s.startswith("/*"):
                in_block = "*/" not in s
                out.append((i, ""))
                continue
            if s.startswith(("//", "*")):
                out.append((i, ""))
                continue
        out.append((i, line))
    return out


def scan() -> tuple[dict[tuple[str, str], list[int]], dict[str, list[tuple[str, int]]]]:
    findings: dict[tuple[str, str], list[int]] = defaultdict(list)
    env_reads: dict[str, list[tuple[str, int]]] = defaultdict(list)
    slugs = trip_slugs()
    slug_re = re.compile("|".join(re.escape(s) for s in slugs)) if slugs else None
    for rel in listed_files():
        text = (ROOT / rel).read_text(encoding="utf-8", errors="replace")
        is_test = bool(TEST_RE.search(rel))
        lines = code_lines(rel, text)
        for n, line in lines:
            if not line:
                continue
            for pat in ENV_PATTERNS:
                for m in pat.finditer(line):
                    env_reads[m.group(1)].append((rel, n))
            for m in ENV_DESTRUCTURE.finditer(line):
                for name in re.findall(r"[A-Z][A-Z0-9_]*[A-Z0-9]", m.group(1)):
                    env_reads[name].append((rel, n))
        if is_test:
            continue  # tests and fixtures keep their literals (a magic-id sweep of tests is a later row)
        for n, line in lines:
            if not line:
                continue
            for rule, pat in RULES.items():
                if rule == "colour-hex" and not rel.startswith(("core/", "web/")):
                    continue  # tools/ holds the theme sources (theme_tokens.py) by design
                probe = re.sub(r"url\([^)]*\)", "url()", line) if rule.startswith("colour") else line
                if pat.search(probe):
                    findings[(rule, rel)].append(n)
            if slug_re and rel.startswith(SLUG_SCOPES) and slug_re.search(line):
                findings[("trip-slug", rel)].append(n)
        # A kind-to-label map: three or more kind keys mapped to capitalised labels in one file.
        pairs = {m.group(1) for _, line in lines for m in KIND_PAIR.finditer(line)}
        if len(pairs) >= 3 and rel.startswith(("web/", "core/src")):
            first = next(n for n, line in lines if KIND_PAIR.search(line))
            findings[("kind-label-map", rel)].append(first)
    return findings, env_reads


def env_table() -> set[str]:
    if not README.exists():
        return set()
    text = README.read_text()
    m = re.search(r"^## Environment variables\b.*?(?=^## |\Z)", text, re.S | re.M)
    if not m:
        return set()
    names = set()
    for row in m.group(0).split("\n"):
        if row.startswith("|"):
            first = row.split("|")[1] if row.count("|") >= 2 else ""
            names.update(re.findall(r"`([A-Z][A-Z0-9_]*)`", first))
    return names


def counts(findings: dict[tuple[str, str], list[int]]) -> dict[str, dict[str, int]]:
    out: dict[str, dict[str, int]] = defaultdict(dict)
    for (rule, rel), ns in sorted(findings.items()):
        out[rule][rel] = len(ns)
    return dict(out)


def load_baseline() -> dict:
    if BASELINE.exists():
        return json.loads(BASELINE.read_text())
    return {"schema": "hardcode-baseline/1", "rules": {}}


def write_baseline(findings: dict[tuple[str, str], list[int]]) -> None:
    prev = load_baseline()
    old = prev.get("rules", {})
    rules: dict[str, dict[str, dict]] = {}
    for rule, files in counts(findings).items():
        rules[rule] = {}
        for rel, n in files.items():
            entry = {"count": n}
            reason = old.get(rule, {}).get(rel, {}).get("reason")
            if reason:
                entry["reason"] = reason
            rules[rule][rel] = entry
    out = {"schema": "hardcode-baseline/1", "rules": rules}
    if prev.get("notes"):
        out["notes"] = prev["notes"]
    BASELINE.write_text(json.dumps(out, indent=1, sort_keys=True) + "\n")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--check", action="store_true", help="fail on a finding that is not in the baseline (default)")
    g.add_argument("--write", action="store_true", help="rewrite baseline counts (reasons are kept)")
    g.add_argument("--list", action="store_true", help="print every finding")
    g.add_argument("--summary", action="store_true", help="print counts per rule")
    args = ap.parse_args(argv)

    findings, env_reads = scan()
    if args.write:
        write_baseline(findings)
        print(f"wrote {BASELINE.relative_to(ROOT)}: {sum(len(v) for v in findings.values())} findings in {len(findings)} (rule, file) entries")
        return 0
    if args.list:
        for (rule, rel), ns in sorted(findings.items()):
            for n in ns:
                print(f"{rel}:{n} {rule}")
        return 0
    if args.summary:
        per: Counter[str] = Counter()
        for (rule, _), ns in findings.items():
            per[rule] += len(ns)
        for rule in sorted(per):
            print(f"{rule}: {per[rule]}")
        return 0

    base = load_baseline().get("rules", {})
    bad: list[str] = []
    fell: list[str] = []
    for (rule, rel), ns in sorted(findings.items()):
        allowed = base.get(rule, {}).get(rel, {}).get("count", 0)
        if len(ns) > allowed:
            for n in ns[allowed:] if allowed else ns:
                bad.append(f"{rel}:{n} {rule} (baseline allows {allowed}, found {len(ns)})")
    for rule, files in base.items():
        for rel, entry in files.items():
            have = len(findings.get((rule, rel), []))
            if have < entry["count"]:
                fell.append(f"{rel} {rule}: {entry['count']} -> {have}")
    table = env_table()
    for name, where in sorted(env_reads.items()):
        if name in table or name in ENV_IGNORE:
            continue
        rel, n = where[0]
        bad.append(f"{rel}:{n} env-undocumented {name} (add a row to the 'Environment variables' table in docs/v2/build/public-site/README.md)")
    if fell:
        print("baseline can be tightened (run --write):\n  " + "\n  ".join(fell))
    if bad:
        print("hard-coded values not in tools/cons/baseline.json (use the single source of truth, or ask for an exception with a reason):", file=sys.stderr)
        for b in bad:
            print("  " + b, file=sys.stderr)
        return 1
    total = sum(len(v) for v in findings.values())
    print(f"hardcode scan OK: {total} baselined findings, {len(env_reads)} env names all documented")
    return 0


if __name__ == "__main__":
    sys.exit(main())
