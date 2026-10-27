"""Check that named vitest files RAN in a gate log, none skipped or failed (WF-3: a skipped database test is not a pass).

    python3 tools/ci/vitest_ran.py LOG [LOG ...] -- FILE [FILE ...]      # these files must have run
    python3 tools/ci/vitest_ran.py --no-skips [--map tools/gate/map.json] LOG [LOG ...]
                                                                          # no file may be skipped unless the map's `ci_skips` names it

Logs come before `--`, test files after it; both are required in the first form and nothing is guessed (WF-3b: a test path that
exists on disk used to be taken for a log and never checked). The second form fails on any skipped or todo test file that the map
does not allow-list, so a conditional skip cannot hide in a green job (WF-3 review S3); the allow-listed skips are printed.

Reads vitest's default reporter lines (` ✓ test/db/x.test.ts (12 tests) 80ms`, ` ↓ ... (3 tests | 3 skipped)`, ` ❯ ... | 1 failed`).
A FILE passes when some line names it with a check mark and neither "skipped" nor "failed" nor "todo" in its counts. A file that is not
named at all did not run. Exit 0 all ran, 1 a file did not run cleanly, 2 usage. Output names files, never test text.
Python 3 standard library only.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ANSI = re.compile(r"\x1b\[[0-9;]*m")
OK = ("✓", "✔")


def verdicts(text: str, files: list[str]) -> dict[str, str]:
    """file -> 'ran' | 'skipped' | 'failed' | 'missing'."""
    out = {f: "missing" for f in files}
    for raw in text.splitlines():
        line = ANSI.sub("", raw).strip()
        if not line or "(" not in line:
            continue
        for f in files:
            if not re.match(rf"[✓✔↓❯×✗]\s+(?:(?:\|[^|]+\||[\w.-]+)\s+)?(?:\S*/)?{re.escape(f)}\s+\(", line):
                continue
            counts = line[line.index("(", line.index(f)):]
            if line.startswith("↓") or "skipped" in counts or "todo" in counts:
                out[f] = out[f] if out[f] in ("ran", "failed") else "skipped"
            elif line.startswith(("❯", "×", "✗")) or "failed" in counts or not line.startswith(OK):
                out[f] = "failed"
            elif out[f] != "failed":
                out[f] = "ran"
    return out


FILE_LINE = re.compile(r"^([✓✔↓❯×✗])\s+(?:(?:\|[^|]+\||[\w.-]+)\s+)?(\S+\.(?:test|spec)\.\w+)\s+\((.*?)\)")


def skipped_files(text: str) -> list[str]:
    """Every test file the log shows with a skipped or todo test (or skipped whole), as printed by vitest, once each."""
    out: list[str] = []
    for raw in text.splitlines():
        m = FILE_LINE.match(ANSI.sub("", raw).strip())
        if m and (m.group(1) == "↓" or "skipped" in m.group(3) or "todo" in m.group(3)) and m.group(2) not in out:
            out.append(m.group(2))
    return out


def allowed(printed: str, allow: list[str]) -> str | None:
    """The allow-list entry for a printed path (vitest prints a path from the project root, the map from the repository root)."""
    return next((a for a in allow if a == printed or a.endswith("/" + printed)), None)


def no_skips(logs: list[Path], map_path: Path | None) -> int:
    allow: list[str] = []
    if map_path is not None:
        try:
            allow = sorted(json.loads(map_path.read_text(encoding="utf-8")).get("ci_skips", {}))
        except (OSError, ValueError, AttributeError) as e:
            print(f"vitest_ran: cannot read the map {map_path}: {e.__class__.__name__}", file=sys.stderr)
            return 2
    text = "\n".join(p.read_text(encoding="utf-8", errors="replace") for p in logs)
    skipped = skipped_files(text)
    bad = [f for f in skipped if allowed(f, allow) is None]
    ok = sorted({a for f in skipped if (a := allowed(f, allow))})
    for f in bad:
        print(f"vitest_ran: {f}: skipped, and tools/gate/map.json `ci_skips` does not allow it (owed on the Mac only when listed there)")
    if ok:
        print("vitest_ran: skips allowed by the map, owed on the Mac: " + ", ".join(ok))
    if bad:
        return 1
    print(f"vitest_ran: no unexpected skip in {len(logs)} log(s)")
    return 0


def main(argv: list[str]) -> int:
    usage = "usage: vitest_ran.py LOG... -- FILE...   |   vitest_ran.py --no-skips [--map MAP] LOG..."
    args = list(argv)
    mode_skips = "--no-skips" in args
    if mode_skips:
        args.remove("--no-skips")
    map_path: Path | None = None
    if "--map" in args:
        i = args.index("--map")
        if i + 1 >= len(args):
            print(usage, file=sys.stderr)
            return 2
        map_path = Path(args[i + 1])
        del args[i:i + 2]
    if mode_skips:
        logs = [Path(a) for a in args]
        if not logs or "--" in args or not all(p.is_file() for p in logs):
            print(usage + "  (every argument an existing log)", file=sys.stderr)
            return 2
        return no_skips(logs, map_path)
    if "--" not in args or map_path is not None:
        print(usage, file=sys.stderr)
        return 2
    cut = args.index("--")
    logs, files = [Path(a) for a in args[:cut]], args[cut + 1:]
    if not logs or not files or not all(p.is_file() for p in logs):
        print(usage + "  (at least one existing log before `--`, and one test file after it)", file=sys.stderr)
        return 2
    text = "\n".join(p.read_text(encoding="utf-8", errors="replace") for p in logs)
    bad = {f: v for f, v in verdicts(text, files).items() if v != "ran"}
    for f, v in bad.items():
        print(f"vitest_ran: {f}: {v}" + (" (not in the log: it did not run)" if v == "missing" else ""))
    if bad:
        return 1
    print(f"vitest_ran: {len(files)} file(s) ran, none skipped")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
