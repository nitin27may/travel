#!/usr/bin/env python3
"""Rewrite path references after a scripted move, and check relative Markdown links.

A move map is a TSV: old path, new path, one move per line. A path that ends in "/" is a
folder (it matches the folder and everything under it). A path that does not end in "/" is
a file, or a plain prefix such as "docs/v2/research/lanes/CS7" (it matches any path that
starts with that text). The longest matching old path wins, so "lanes/CS7" is tried before
"lanes/".

Two kinds of edit, both applied to the files named by --scope:
  * plain path strings: every occurrence of an old path becomes the new one (also inside
    code fences and inline code, because commands and notes quote paths there);
  * relative Markdown links: the target is resolved against the file's OLD location (the
    file may already have been moved with git mv), mapped through the move map, and
    written again relative to the file's NEW location. http(s) links, "#anchor" only
    links, absolute links, links in code fences and links in inline code are left alone.

`rewrite` is NOT idempotent: it must run once, right after the `git mv`, because it resolves each
link against the file's old location. A second run would resolve the already-fixed links wrongly.
To redo it, restore the files from the index first.

Usage:
  python3 tools/relink.py rewrite --map MAP.tsv --scope SCOPE.txt [--write] [--root DIR]
  python3 tools/relink.py check [--map MAP.tsv] [--baseline FILE] [--write-baseline] [--root DIR]

`rewrite` without --write prints what it would change. The SCOPE file lists repo-relative
paths or folder prefixes (ending in "/") or shell-style globs; lines starting with "!"
exclude, and "@links PATH" selects PATH for link edits only (history records keep their
plain-text paths). `check` lists every broken relative Markdown link in the tracked .md files
(file:target lines). --allow FILE names known breaks to tolerate. With --baseline it exits 1 when a link is broken that the baseline does
not list; the baseline's file and target paths are passed through --map first, so a
baseline taken before a move still compares after it.
"""
from __future__ import annotations

import argparse
import fnmatch
import os
import posixpath
import re
import subprocess
import sys
from pathlib import Path

LINK_RE = re.compile(r"(!?\[[^\]\n]*\]\()(<?)([^)\s>]+)(>?)((?:\s+\"[^\"]*\")?\))")
REFDEF_RE = re.compile(r"^(\s{0,3}\[[^\]\n]+\]:\s*)(<?)(\S+?)(>?)(\s*(?:\"[^\"]*\")?\s*)$")
FENCE_RE = re.compile(r"^\s{0,3}(```+|~~~+)")
INLINE_CODE_RE = re.compile(r"(`+)(?:(?!\1).)+?\1")
SCHEME_RE = re.compile(r"^[A-Za-z][A-Za-z0-9+.-]*:")
# A path found inside longer text must not continue a word or a name: "xdocs/briefs" is not ours.
BOUNDARY_BEFORE = r"(?<![A-Za-z0-9_-])"


def load_map(path: str | Path) -> list[tuple[str, str]]:
    rows: list[tuple[str, str]] = []
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        if not line.strip() or line.startswith("#"):
            continue
        old, new = line.split("\t")
        rows.append((old.strip(), new.strip()))
    return sorted(rows, key=lambda r: len(r[0]), reverse=True)


def map_path(p: str, rows: list[tuple[str, str]]) -> str:
    """Map one repo-relative path through the longest matching old path."""
    for old, new in rows:
        if old.endswith("/"):
            if p == old[:-1]:
                return new[:-1]
            if p.startswith(old):
                return new + p[len(old):]
        elif p.startswith(old):
            return new + p[len(old):]
    return p


def unmap_path(p: str, rows: list[tuple[str, str]]) -> str:
    """Where a file stood before the move, when it now sits under a move target."""
    for old, new in sorted(rows, key=lambda r: len(r[1]), reverse=True):
        if new.endswith("/"):
            if p.startswith(new):
                return old + p[len(new):]
        elif p.startswith(new):
            return old + p[len(new):]
    return p


def rewrite_plain(text: str, rows: list[tuple[str, str]]) -> str:
    """Longest-old-path-first replacement, one scan, so a rewritten path is never rescanned."""
    if not rows:
        return text
    alt = "|".join(re.escape(old) for old, _ in rows)
    pat = re.compile(BOUNDARY_BEFORE + "(" + alt + ")")
    lookup = dict(rows)
    return pat.sub(lambda m: lookup[m.group(1)], text)


def _split_target(target: str) -> tuple[str, str]:
    for i, ch in enumerate(target):
        if ch in "#?":
            return target[:i], target[i:]
    return target, ""


def is_relative_link(target: str) -> bool:
    return bool(target) and not target.startswith(("#", "/", "<")) and not SCHEME_RE.match(target)


def retarget(target: str, old_file: str, new_file: str, rows: list[tuple[str, str]]) -> str:
    """New text for one relative link target; unchanged text when nothing moved."""
    if not is_relative_link(target):
        return target
    path, tail = _split_target(target)
    if not path:
        return target
    resolved = posixpath.normpath(posixpath.join(posixpath.dirname(old_file), path))
    if resolved.startswith(".."):
        return target
    new_resolved = map_path(resolved + ("/" if path.endswith("/") else ""), rows).rstrip("/") if rows else resolved
    new_rel = posixpath.relpath(new_resolved, posixpath.dirname(new_file) or ".")
    if new_rel == posixpath.normpath(path):
        return target  # same link, keep the author's spelling
    if path.endswith("/"):
        new_rel += "/"
    return new_rel + tail


def _mask_inline_code(line: str) -> tuple[str, list[str]]:
    spans: list[str] = []

    def keep(m: re.Match[str]) -> str:
        spans.append(m.group(0))
        return f"\x00{len(spans) - 1}\x00"

    return INLINE_CODE_RE.sub(keep, line), spans


def _unmask(line: str, spans: list[str]) -> str:
    return re.sub(r"\x00(\d+)\x00", lambda m: spans[int(m.group(1))], line)


def rewrite_text(text: str, current: str, rows: list[tuple[str, str]], plain: bool = True) -> str:
    """Rewrite one Markdown file. plain=False edits relative links only (history records)."""
    old_file = unmap_path(current, rows)
    plain_rows = rows if plain else []

    def rp(t: str) -> str:
        return rewrite_plain(t, plain_rows)

    out: list[str] = []
    in_fence: str | None = None
    for line in text.split("\n"):
        fm = FENCE_RE.match(line)
        if fm:
            marker = fm.group(1)[0]
            if in_fence is None:
                in_fence = marker
            elif in_fence == marker:
                in_fence = None
            out.append(rp(line))
            continue
        if in_fence is not None:
            out.append(rp(line))
            continue
        masked, spans = _mask_inline_code(line)
        pieces: list[str] = []
        pos = 0
        matches = list(LINK_RE.finditer(masked))
        if not matches:
            rm = REFDEF_RE.match(masked)
            if rm:
                matches = [rm]
        for m in matches:
            pieces.append(rp(masked[pos:m.start(3)]))
            pieces.append(retarget(m.group(3), old_file, current, rows))
            pos = m.end(3)
        pieces.append(rp(masked[pos:]))
        # Inline code keeps paths too ("`docs/briefs/x`"), so the saved spans are rewritten as plain text.
        out.append(_unmask("".join(pieces), [rp(s) for s in spans]))
    return "\n".join(out)


# ---------------------------------------------------------------- repo helpers


def git_files(root: Path, untracked: bool = True) -> list[str]:
    args = ["git", "-C", str(root), "ls-files", "-z"]
    if untracked:
        args += ["-co", "--exclude-standard"]
    raw = subprocess.run(args, check=True, capture_output=True).stdout.decode("utf-8")
    return sorted(f for f in raw.split("\0") if f and (root / f).is_file())


def scoped(files: list[str], scope_lines: list[str]) -> list[tuple[str, bool]]:
    """(file, plain) pairs. A scope line "@links PATH" selects PATH for link edits only."""
    full: list[str] = []
    links: list[str] = []
    exc: list[str] = []
    for s in scope_lines:
        s = s.strip()
        if not s or s.startswith("#"):
            continue
        if s.startswith("!"):
            exc.append(s[1:])
        elif s.startswith("@links "):
            links.append(s[7:].strip())
        else:
            full.append(s)

    def hit(f: str, pats: list[str]) -> bool:
        for p in pats:
            if (p.endswith("/") and f.startswith(p)) or f == p or fnmatch.fnmatch(f, p):
                return True
        return False

    out: list[tuple[str, bool]] = []
    for f in files:
        if hit(f, exc):
            continue
        if hit(f, links):
            out.append((f, False))
        elif hit(f, full):
            out.append((f, True))
    return out


def is_text(path: Path) -> bool:
    return path.suffix.lower() in {".md", ".json", ".ts", ".tsx", ".mjs", ".py", ".txt", ".tsv", ".sh"}


def cmd_rewrite(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    rows = load_map(args.map)
    scope = Path(args.scope).read_text(encoding="utf-8").splitlines()
    changed = 0
    for f, plain in scoped(git_files(root), scope):
        p = root / f
        if not is_text(p):
            continue
        text = p.read_text(encoding="utf-8")
        if f.endswith(".md"):
            new = rewrite_text(text, f, rows, plain)
        else:
            new = rewrite_plain(text, rows) if plain else text
        if new != text:
            changed += 1
            print(("rewrote " if args.write else "would rewrite ") + f)
            if args.write:
                p.write_text(new, encoding="utf-8")
    print(f"{changed} file(s) {'changed' if args.write else 'would change'}")
    return 0


def broken_links(root: Path) -> list[str]:
    found: list[str] = []
    for f in git_files(root, untracked=False):
        if not f.endswith(".md"):
            continue
        in_fence: str | None = None
        for line in (root / f).read_text(encoding="utf-8", errors="replace").split("\n"):
            fm = FENCE_RE.match(line)
            if fm:
                marker = fm.group(1)[0]
                in_fence = marker if in_fence is None else (None if in_fence == marker else in_fence)
                continue
            if in_fence:
                continue
            masked, _ = _mask_inline_code(line)
            targets = [m.group(3) for m in LINK_RE.finditer(masked)]
            rm = REFDEF_RE.match(masked)
            if rm:
                targets.append(rm.group(3))
            for t in targets:
                if not is_relative_link(t):
                    continue
                path, _ = _split_target(t)
                if not path:
                    continue
                resolved = posixpath.normpath(posixpath.join(posixpath.dirname(f), path))
                if resolved.startswith("..") or not (root / resolved).exists():
                    found.append(f"{f}:{t}")
    return sorted(set(found))


def cmd_check(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    broken = broken_links(root)
    for b in broken:
        print(b)
    print(f"{len(broken)} broken relative link(s)", file=sys.stderr)
    if args.write_baseline:
        Path(args.baseline).write_text("\n".join(broken) + "\n", encoding="utf-8")
        return 0
    if not args.baseline:
        return 0
    rows = load_map(args.map) if args.map else []
    base: set[str] = set()
    for line in Path(args.baseline).read_text(encoding="utf-8").splitlines():
        if not line:
            continue
        f, t = line.split(":", 1)
        nf = map_path(f, rows)
        base.add(f"{nf}:{retarget(t, f, nf, rows)}")
    allowed = set(Path(args.allow).read_text(encoding="utf-8").split()) if args.allow else set()
    new = [b for b in broken if b not in base and b not in allowed]
    for b in new:
        print(f"NEW BROKEN {b}", file=sys.stderr)
    print(f"{len(new)} new broken link(s) against the baseline of {len(base)}", file=sys.stderr)
    return 1 if new else 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    rw = sub.add_parser("rewrite")
    rw.add_argument("--map", required=True)
    rw.add_argument("--scope", required=True)
    rw.add_argument("--write", action="store_true")
    rw.add_argument("--root", default=".")
    rw.set_defaults(fn=cmd_rewrite)
    ck = sub.add_parser("check")
    ck.add_argument("--map")
    ck.add_argument("--baseline")
    ck.add_argument("--allow", help="file:target lines accepted as known, deferred breaks")
    ck.add_argument("--write-baseline", action="store_true")
    ck.add_argument("--root", default=".")
    ck.set_defaults(fn=cmd_check)
    args = ap.parse_args(argv)
    return args.fn(args)


if __name__ == "__main__":
    sys.exit(main())
