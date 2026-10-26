"""Failure excerpts for the gate summary (TEST-STRATEGY 5): the lines of a tool's output that say why it failed.

Pure functions over text. The first extractor that finds lines wins; when none does, the last non-empty lines (without WARN
lines) are the excerpt. Python 3 standard library only.
"""
from __future__ import annotations

import re

ANSI = re.compile(r"\x1b\[[0-9;?]*[ -/]*[@-~]")

EXTRACTORS: list[tuple[str, re.Pattern[str]]] = [
    ("tsc", re.compile(r"error TS\d+")),
    ("pytest", re.compile(r"^(FAILED |ERROR |E\s{3}|=+ .*(failed|error).* =+$)")),
    ("vitest", re.compile(r"^\s*(FAIL |× |AssertionError|Error:|❯ .*\.test\.|TypeError|ReferenceError)")),
    ("eslint", re.compile(r"^\s*\d+:\d+\s+error\b|^/.+\.(ts|tsx|mjs|js)$")),
    ("playwright", re.compile(r"^\s*(\d+\) \[|✘|Error:|\d+ failed)")),
    ("check", re.compile(r"(^E_[A-Z_]+|\bERROR\b|\bFAIL(ED)?\b|^error:|Error:)")),
]


def clean(text: str) -> list[str]:
    return [ANSI.sub("", ln).rstrip() for ln in text.splitlines()]


def excerpt(text: str, limit: int = 10) -> list[str]:
    """At most `limit` lines explaining a failure; a trailing "... N more" line counts inside the limit."""
    lines = clean(text)
    hits: list[str] = []
    for _name, pat in EXTRACTORS:
        hits = [ln for ln in lines if pat.search(ln)]
        if hits:
            break
    if not hits:
        hits = [ln for ln in lines if ln.strip() and "WARN" not in ln][-limit:]
    if len(hits) > limit:
        more = len(hits) - (limit - 1)
        hits = hits[:limit - 1] + [f"... {more} more lines in the log"]
    return [ln[:200] for ln in hits]
