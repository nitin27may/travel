#!/usr/bin/env python3
"""
One-off migration: lift a hand-written trip page onto the shared system in legacy/_system/.

Phase 1 scope — the Vermont/Niagara family, which uses:
    .card .split .content   .sign   .trail/.stop/.blaze   .links/.btn
The older Quebec/Dolomites/Switzerland family (.card .chead .cbody, s-/g- day status)
needs a second mapping table and is Phase 2.

This does NOT restructure content. It extracts the hero/nav/main/footer, renames the
class vocabulary onto the shared components, and re-assembles through layout.html so the
page picks up base.css, base.js and a theme instead of its own inline copy.

Usage:
    python3 legacy/_system/migrate.py vermont-fall-2026 --theme forest --out /tmp/preview.html
    python3 legacy/_system/migrate.py vermont-fall-2026 --theme forest --in-place
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build import assemble, check_output_is_self_contained  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent

# Class vocabulary: hand-written  ->  shared components.
# The classifier slots follow each trip's own declared vocabulary; for this family the
# original blaze colours mapped hike/drive/town/food onto slots 1/2/3/4.
CLASS_MAP: list[tuple[str, str]] = [
    (r'class="blaze hike"',  'class="mark mark--1"'),
    (r'class="blaze drive"', 'class="mark mark--2"'),
    (r'class="blaze town"',  'class="mark mark--3"'),
    (r'class="blaze food"',  'class="mark mark--4"'),
    (r'class="tag new"',     'class="tag tag--added"'),
    (r'var\(--blaze-hike\)',  'var(--class-1)'),
    (r'var\(--blaze-drive\)', 'var(--class-2)'),
    (r'var\(--blaze-town\)',  'var(--class-3)'),
    (r'var\(--gold\)',        'var(--class-4)'),
    # inline onclick handlers -> data attributes driven by base.js
    (r'<button id="btnA" class="on" onclick="setPlan\(\'A\'\)">', '<button data-plan-btn="A" class="on">'),
    (r'<button id="btnC" onclick="setPlan\(\'C\'\)">',            '<button data-plan-btn="C">'),
    (r'<div class="plan show" id="planA">', '<div class="plan show" data-plan="A">'),
    (r'<div class="plan" id="planC">',      '<div class="plan" data-plan="C">'),
]


def extract(src: str) -> dict:
    """Pull the authored content out of a hand-written page."""
    # Accept both quote styles: hand-written pages use url("..."), and layout.html emits
    # url('...'). Without the single-quote case, re-running this on an already-migrated page
    # silently produces an empty hero — so it must stay idempotent.
    m = re.search(r"""url\(\s*['"]?(https?://[^'")]+)['"]?\s*\)""", src)
    hero_img = m.group(1) if m else ""
    if not hero_img:
        raise SystemExit("could not find a hero image URL — refusing to build a page with an "
                         "empty hero. Check the <header class=\"hero\"> background.")
    hero = src[src.index('<header class="hero"'):src.index("</header>") + len("</header>")]
    nav = re.search(r'<nav[^>]*>\s*<div class="wrap">(.*?)</div>\s*</nav>', src, re.S).group(1)
    body = src[src.index("<main>") + len("<main>"):src.rindex("</main>")]
    footer = re.search(r"<footer>\s*<div class=\"wrap\">(.*?)</div>\s*</footer>", src, re.S).group(1)

    def g(pat: str) -> str:
        mm = re.search(pat, hero, re.S)
        return mm.group(1).strip() if mm else ""

    chips = g(r'<div class="chips">(.*?)</div>\s*</div>')
    # base.js writes the countdown's entire phrase; a literal trailing label double-prints
    # and, because the hero is bottom-aligned, shifts every pixel below it.
    chips = re.sub(r'(<strong id="countdown">[^<]*</strong>)\s*days to departure', r"\1", chips)

    return dict(
        hero_image=hero_img,
        eyebrow=g(r'<p class="eyebrow">(.*?)</p>'),
        headline=g(r"<h1>(.*?)</h1>"),
        sub=g(r'<p class="sub">(.*?)</p>'),
        hero_credit=g(r'<p class="credit">(.*?)</p>'),
        chips=chips, nav=nav, body=body, footer=footer,
    )


def meta_of(src: str) -> dict:
    out = {}
    for key in ("trip-date", "trip-dates", "trip-duration", "trip-region"):
        m = re.search(rf'<meta name="{key}" content="([^"]*)"', src)
        out[key.replace("-", "_")] = m.group(1) if m else ""
    m = re.search(r"<title>([^<]*)", src)
    out["title"] = m.group(1).strip() if m else ""
    m = re.search(r'<meta name="description" content="([^"]*)"', src)
    out["description"] = m.group(1) if m else out["title"]
    return out


def migrate(slug: str, theme: str) -> tuple[str, dict[str, int]]:
    src = (ROOT / slug / "index.html").read_text(encoding="utf-8")
    parts = extract(src)
    counts: dict[str, int] = {}
    for pat, rep in CLASS_MAP:
        parts["body"], n = re.subn(pat, rep, parts["body"])
        if n:
            counts[pat] = n
    ctx = dict(slug=slug, **meta_of(src), **parts)
    return assemble(ctx, theme), counts


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("slug")
    ap.add_argument("--theme", default="forest")
    ap.add_argument("--out", default=None, help="write preview here instead of in place")
    ap.add_argument("--in-place", action="store_true", help="overwrite <slug>/index.html")
    args = ap.parse_args()

    out, counts = migrate(args.slug, args.theme)

    problems = check_output_is_self_contained(out)
    if problems:
        print("FAILED self-containment:")
        for p in problems:
            print("   ", p)
        return 1
    if "{{" in out:
        print("FAILED: unresolved template slots remain")
        return 1

    for pat, n in counts.items():
        print(f"  {n:3d}  {pat[:60]}")
    print(f"  total {sum(counts.values())} transforms, {len(out)} bytes")

    dest = Path(args.out) if args.out else (ROOT / args.slug / "index.html")
    if not args.out and not args.in_place:
        print("\nRefusing to overwrite without --in-place. Use --out to preview.")
        return 1
    dest.write_text(out, encoding="utf-8")
    print(f"  wrote {dest}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
