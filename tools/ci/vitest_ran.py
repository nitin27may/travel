"""Check that named vitest files RAN in a gate log, none skipped or failed (WF-3: a skipped database test is not a pass).

    python3 tools/ci/vitest_ran.py LOG [LOG ...] -- FILE [FILE ...]      # or: LOG... FILE... (a LOG is an existing file)

Reads vitest's default reporter lines (` ✓ test/db/x.test.ts (12 tests) 80ms`, ` ↓ ... (3 tests | 3 skipped)`, ` ❯ ... | 1 failed`).
A FILE passes when some line names it with a check mark and neither "skipped" nor "failed" nor "todo" in its counts. A file that is not
named at all did not run. Exit 0 all ran, 1 a file did not run cleanly, 2 usage. Output names files, never test text.
Python 3 standard library only.
"""
from __future__ import annotations

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
            if not re.match(rf"[✓✔↓❯×✗]\s+(?:\|[^|]+\|\s+)?(?:\S*/)?{re.escape(f)}\s+\(", line):
                continue
            counts = line[line.index("(", line.index(f)):]
            if line.startswith("↓") or "skipped" in counts or "todo" in counts:
                out[f] = out[f] if out[f] in ("ran", "failed") else "skipped"
            elif line.startswith(("❯", "×", "✗")) or "failed" in counts or not line.startswith(OK):
                out[f] = "failed"
            elif out[f] != "failed":
                out[f] = "ran"
    return out


def main(argv: list[str]) -> int:
    args = [a for a in argv if a != "--"]
    logs = [Path(a) for a in args if Path(a).is_file()]
    files = [a for a in args if not Path(a).is_file()]
    if not logs or not files:
        print("usage: vitest_ran.py LOG... -- FILE...  (at least one existing log and one test file)", file=sys.stderr)
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
