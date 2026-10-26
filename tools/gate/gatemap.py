"""The path-to-suite map (docs/v2/build/TEST-STRATEGY.md 4.2): load, glob matching and selection.

Python 3 standard library only. Used by tools/gate/check_map.py (the M1 to M6 checks), tools/gate/replay.py (the selection
replay over past merges) and, from TS-2, by the gate itself. The map is DATA (tools/gate/map.json); this module only reads it.

Glob dialect (every glob in the map):
  * anchored at the repository root: "*.md" is a root file only, "**/*.md" is any depth;
  * "*" and "?" stay inside one path segment, "**" crosses segments ("data/**" is everything under data/);
  * "[abc]" is a character class, "{a,b}" expands to alternatives (nesting allowed);
  * a leading "!" in a glob list excludes: a path matches a list when it matches an include and no exclude.
E2E globs (a rule's "e2e") match the spec's file name inside web/tests/e2e/, never a path.
"""
from __future__ import annotations

import json
import re
import subprocess
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MAP_PATH = ROOT / "tools" / "gate" / "map.json"
CHECK_ALL = ROOT / "tools" / "check-all.sh"
E2E_DIR = "web/tests/e2e/"
IMPORTERS = "@importers"  # e2e token: the specs that import the changed helper file (by its "./name" import)
FULL_FILE_LIMIT = 60  # more changed files than this outside "quiet" is a full run (TEST-STRATEGY 4.4)


# ----- globs -----------------------------------------------------------------------------------------------------------------------------
def expand_braces(glob: str) -> list[str]:
    """'a/{b,c/{d,e}}' -> ['a/b', 'a/c/d', 'a/c/e']. A glob without braces is returned as is."""
    depth, start = 0, -1
    for i, ch in enumerate(glob):
        if ch == "{":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}" and depth:
            depth -= 1
            if depth == 0:
                inner, parts, d, last = glob[start + 1:i], [], 0, 0
                for j, c in enumerate(inner):
                    if c == "{":
                        d += 1
                    elif c == "}":
                        d -= 1
                    elif c == "," and d == 0:
                        parts.append(inner[last:j])
                        last = j + 1
                parts.append(inner[last:])
                head, tail = glob[:start], glob[i + 1:]
                return [x for p in parts for x in expand_braces(head + p + tail)]
    return [glob]


def _translate(glob: str) -> str:
    out, i, n = [], 0, len(glob)
    while i < n:
        if glob.startswith("**/", i):
            out.append("(?:[^/]*/)*")
            i += 3
        elif glob.startswith("**", i):
            out.append(".*")
            i += 2
        elif glob[i] == "*":
            out.append("[^/]*")
            i += 1
        elif glob[i] == "?":
            out.append("[^/]")
            i += 1
        elif glob[i] == "[":
            j = glob.find("]", i + 1)
            if j < 0:
                out.append(re.escape("["))
                i += 1
            else:
                body = glob[i + 1:j]
                if body.startswith("!"):
                    body = "^" + body[1:]
                out.append("[" + body.replace("\\", "\\\\") + "]")
                i = j + 1
        else:
            out.append(re.escape(glob[i]))
            i += 1
    return "".join(out)


@lru_cache(maxsize=None)
def compile_glob(glob: str) -> re.Pattern[str]:
    alts = [_translate(g) for g in expand_braces(glob)]
    return re.compile("(?:" + "|".join(alts) + r")\Z")


def match(glob: str, path: str) -> bool:
    return compile_glob(glob).match(path) is not None


def match_any(globs: list[str], path: str) -> bool:
    """Include and "!" exclude semantics of a glob list."""
    inc = [g for g in globs if not g.startswith("!")]
    exc = [g[1:] for g in globs if g.startswith("!")]
    return any(match(g, path) for g in inc) and not any(match(g, path) for g in exc)


def first_match(globs: list[str], path: str) -> str | None:
    if not match_any(globs, path):
        return None
    return next(g for g in globs if not g.startswith("!") and match(g, path))


# ----- the map ---------------------------------------------------------------------------------------------------------------------------
def load_map(path: Path = MAP_PATH) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def repo_files(root: Path = ROOT) -> list[str]:
    """Tracked files plus untracked files that are not ignored (a new folder is seen before its first commit), present on disk."""
    raw = subprocess.run(["git", "-C", str(root), "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
                         check=True, capture_output=True).stdout.decode("utf-8", "replace")
    return sorted({f for f in raw.split("\0") if f and ((root / f).is_file() or (root / f).is_symlink())})


def is_test_file(m: dict, path: str) -> bool:
    return match_any(m["test_files"], path) and path not in m.get("not_tests", {})


def owners(m: dict, path: str) -> list[str]:
    """The suites whose "tests" globs own a test file."""
    return [sid for sid, s in m["suites"].items() if s.get("tests") and match_any(s["tests"], path)]


def is_spec(path: str) -> bool:
    return path.startswith(E2E_DIR) and path.count("/") == 3 and path.endswith(".spec.ts")


def specs_for(globs: list[str], specs: list[str], changed: str | None = None, root: Path = ROOT) -> set[str]:
    """Spec file names an e2e glob list attaches. "@importers" resolves to the specs that import the changed helper."""
    out: set[str] = set()
    for g in globs:
        if g == IMPORTERS:
            if changed and changed.startswith(E2E_DIR):
                stem = Path(changed).stem
                pat = re.compile(r"""from\s+['"]\./""" + re.escape(stem) + r"""(?:\.[a-z]+)?['"]""")
                for s in specs:
                    p = root / E2E_DIR / s
                    if p.is_file() and pat.search(p.read_text(encoding="utf-8", errors="replace")):
                        out.add(s)
            continue
        out.update(s for s in specs if match(g, s))
    return out


# ----- check-all steps -------------------------------------------------------------------------------------------------------------------
STEP_RE = re.compile(r'''^\s*step\s+"([^"]*)"''')
FOR_RE = re.compile(r"^(\s*)for\s+(\w+)\s+in\s+([^;]+);\s*do\b")


def check_all_steps(text: str) -> list[str]:
    """Every `step "..."` label of tools/check-all.sh in order, with a `for x in a b; do ... step "web $x"` loop expanded."""
    labels: list[str] = []
    loop: tuple[str, str, list[str]] | None = None  # indent, variable, words
    for line in text.splitlines():
        f = FOR_RE.match(line)
        if f:
            loop = (f.group(1), f.group(2), f.group(3).split())
            continue
        if loop and line.strip() == "done" and line[:len(line) - len(line.lstrip())] == loop[0]:
            loop = None
            continue
        s = STEP_RE.match(line)
        if not s:
            continue
        label = s.group(1)
        if loop and ("$" + loop[1] in label or "${" + loop[1] + "}" in label):
            labels.extend(label.replace("${" + loop[1] + "}", w).replace("$" + loop[1], w) for w in loop[2])
        else:
            labels.append(label)
    return labels


def step_matches(entry: str, label: str) -> bool:
    """A map step entry names a check-all label exactly, or as a prefix ending at a space, colon or parenthesis."""
    return label == entry or (label.startswith(entry) and label[len(entry)] in " :(")


def suites_for_step(m: dict, label: str) -> list[str]:
    return [sid for sid, s in m["suites"].items() if any(step_matches(e, label) for e in s.get("steps", []))]


def changed_steps(old: str, new: str) -> list[str]:
    """Labels whose step block is new or edited between two versions of check-all.sh (a lane appending a step)."""
    def blocks(text: str) -> dict[str, str]:
        out: dict[str, list[str]] = {}
        cur: str | None = None
        for line in text.splitlines():
            s = STEP_RE.match(line)
            if s:
                cur = s.group(1)
                out.setdefault(cur, [])
            elif cur is not None:
                out[cur].append(line.strip())
        return {k: "\n".join(v) for k, v in out.items()}
    ob, nb = blocks(old), blocks(new)
    raw = [k for k, v in nb.items() if ob.get(k) != v]
    exp: list[str] = []
    for k in raw:
        # "web $script" stands for the loop's labels: one word in place of the variable
        pat = re.compile(re.sub(r"\\\$\\\{?\w+\\\}?|\\\$\w+", r"[^ ]+", re.escape(k)) + r"\Z")
        exp.extend(x for x in check_all_steps(new) if x == k or ("$" in k and pat.match(x)))
    return sorted(set(exp))


# ----- selection -------------------------------------------------------------------------------------------------------------------------
@dataclass
class Selection:
    full: bool = False
    full_reasons: list[str] = field(default_factory=list)
    suites: dict[str, list[str]] = field(default_factory=dict)  # suite -> reasons (rule ids, "test file", "always", ...)
    tests: set[str] = field(default_factory=set)  # unit test files a related run must include whatever the import graph says
    specs: set[str] = field(default_factory=set)  # e2e spec file names
    unmatched: list[str] = field(default_factory=list)
    rules: list[str] = field(default_factory=list)

    def add(self, suite: str, why: str) -> None:
        reasons = self.suites.setdefault(suite, [])
        if why not in reasons:
            reasons.append(why)


def full_suites(m: dict) -> list[str]:
    """What a full T1 runs: every suite that T2 runs (always_at 1 or 2); T3-only suites still wait for T3."""
    return [sid for sid, s in m["suites"].items() if s.get("always_at", 2) <= 2]


def select(m: dict, changed: list[str], *, check_all_old: str | None = None, check_all_new: str | None = None,
           specs: list[str] | None = None, root: Path = ROOT) -> Selection:
    """Apply the map to a change set. Selection only ever adds (TEST-STRATEGY 4): every matching rule contributes."""
    sel = Selection()
    if specs is None:
        specs = sorted(p[len(E2E_DIR):] for p in repo_files(root) if is_spec(p))
    for sid, s in m["suites"].items():
        if s.get("always_at", 2) <= 1:
            sel.add(sid, "always")
    loud = [p for p in changed if not match_any(m["quiet"], p)]
    if len(loud) > FULL_FILE_LIMIT:
        sel.full = True
        sel.full_reasons.append(f"{len(loud)} files changed outside quiet (limit {FULL_FILE_LIMIT})")
    for p in changed:
        hit = False
        g = first_match(m["full"], p)
        if g:
            sel.full = True
            sel.full_reasons.append(f"{p} (full: {g})")
            hit = True
        for r in m["rules"]:
            if not match_any(r["paths"], p):
                continue
            hit = True
            if r["id"] not in sel.rules:
                sel.rules.append(r["id"])
            for sid in r.get("suites", []):
                sel.add(sid, r["id"])
            sel.tests.update(r.get("tests", []))
            got = specs_for(r.get("e2e", []), specs, p, root)
            if got:
                sel.specs.update(got)
                sel.add("e2e.mapped", r["id"])
        if is_test_file(m, p):
            hit = True
            for sid in owners(m, p):
                if sid == "e2e.full":
                    continue
                sel.add(sid, "test file")
            if is_spec(p):
                sel.specs.add(p[len(E2E_DIR):])
                sel.add("e2e.mapped", "spec file")
            else:
                sel.tests.add(p)
        if p == "tools/check-all.sh" and check_all_old is not None and check_all_new is not None:
            for label in changed_steps(check_all_old, check_all_new):
                for sid in suites_for_step(m, label):
                    sel.add(sid, f"check-all step: {label[:40]}")
        if not hit and not match_any(m["quiet"], p):
            sel.unmatched.append(p)
    if sel.unmatched:
        sel.full = True
        sel.full_reasons.append(f"{len(sel.unmatched)} path(s) match no rule: {', '.join(sel.unmatched[:3])}")
    if sel.full:
        for sid in full_suites(m):
            sel.add(sid, "full")
    # a suite that needs another (web.built needs web.build) pulls it in
    changed_any = True
    while changed_any:
        changed_any = False
        for sid in list(sel.suites):
            for dep in m["suites"][sid].get("needs", []):
                if dep in m["suites"] and dep not in sel.suites:
                    sel.add(dep, f"needed by {sid}")
                    changed_any = True
    return sel
