#!/usr/bin/env python3
"""
Phase 2 migration: the Quebec / Dolomites / Switzerland family.

These three pages use a different component vocabulary from Vermont/Niagara —
`.card .chead .cbody`, a sticky `.day/.dhead` sign, `.btns/.btn`, `s-` day-status and
`g-` legend swatches, and `.stats` as a <dl> of <dt>/<dd> rather than a flex row of spans.
Same class NAMES, incompatible markup. Restructuring the markup would be a large, risky
change to ~250 KB of hand-authored content for no reader-visible gain.

So this migration does something narrower and safer, and the layout makes it work:
layout.html emits  theme_css -> base_css -> extra_css , so each page's own component CSS
rides in `extra_css` and wins on equal specificity wherever it collides with base.css.

What the page actually gains:
  - the shared theme token system (colour AND typography), so it can be re-skinned
  - shared base.js — countdown, checklist, scrollspy, plan toggle — instead of its own copy
  - shared reset, print styles, reduced-motion, and every future base.css fix

What it does not gain yet: one class vocabulary. That convergence is deliberately left as a
later step, and is tracked in _system/README.md.

Usage:
    python3 _system/migrate_legacy.py switzerland-2027 --theme alpine-snow --out /tmp/x.html
    python3 _system/migrate_legacy.py switzerland-2027 --theme alpine-snow --in-place
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build import assemble, check_output_is_self_contained  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent

# Each page named its tokens after the destination (--swiss, --rosa, --fleur), which is
# exactly why they could not be re-skinned. Map them onto the shared semantic roles.
TOKEN_MAP: dict[str, dict[str, str]] = {
    "switzerland-2027": {
        "slate": "bg-deep", "snow": "bg", "paper": "surface", "ink": "ink",
        "muted": "muted", "line": "line", "swiss": "warn", "pine": "header",
        "glacier": "accent", "brass": "highlight",
    },
    "quebec-sept-2026": {
        "stone": "bg-deep", "paper": "bg", "card": "surface", "ink": "ink",
        "muted": "muted", "line": "line", "maple": "warn", "copper": "header",
        "fleur": "accent", "gold": "highlight",
    },
    "dolomites-july-2027": {
        "stone": "bg-deep", "snow": "bg", "paper": "surface", "ink": "ink",
        "muted": "muted", "line": "line", "alert": "warn", "indigo": "header",
        "glacier": "accent", "larch": "highlight", "rosa": "class-1",
        "slate": "muted-on-deep",
    },
}


def strip_root(css: str) -> str:
    """Remove the page's own :root block — the theme supplies tokens now."""
    return re.sub(r":root\s*\{[^}]*\}", "", css, count=1)


def remap_tokens(css: str, mapping: dict[str, str]) -> tuple[str, int]:
    n = 0
    for old, new in sorted(mapping.items(), key=lambda kv: -len(kv[0])):
        css, k = re.subn(rf"var\(\s*--{re.escape(old)}\s*\)", f"var(--{new})", css)
        n += k
    return css, n


def leftover_tokens(css: str, mapping: dict[str, str]) -> list[str]:
    """Any var(--x) the page still references that the contract will not define."""
    from build import REQUIRED_TOKENS
    used = set(re.findall(r"var\(\s*--([\w-]+)", css))
    return sorted(t for t in used if t not in REQUIRED_TOKENS)


def migrate(slug: str, theme: str) -> tuple[str, dict]:
    """Surgical transform. These pages keep their own markup and their own component CSS —
    only the token layer, the font link and the behaviour script are replaced.

    An earlier attempt re-slotted them into layout.html and produced a blank page: their hero
    is .grad/.hwrap/.hstats, their nav is .nwrap and their sections are .pane, none of which
    the shared layout knows about. Re-slotting is a markup restructure, not a migration.

    base.css is deliberately NOT injected here. These pages already carry a complete component
    set; adding a second one underneath would apply rules they never opted into, for no
    reader-visible gain. What they gain is the theme system (so they can finally be re-skinned)
    and shared base.js.
    """
    src = (ROOT / slug / "index.html").read_text(encoding="utf-8")
    system = Path(__file__).resolve().parent

    css = re.search(r"<style>(.*?)</style>", src, re.S).group(1)
    css = strip_root(css)
    mapping = TOKEN_MAP[slug]
    css, remapped = remap_tokens(css, mapping)
    css = re.sub(r"var\(\s*--maxw\s*\)", "1080px", css)
    orphans = leftover_tokens(css, mapping)

    theme_src = (system / "themes" / f"{theme}.css").read_text(encoding="utf-8")
    m = re.search(r"/\*\s*@fonts:\s*([^*]+?)\s*\*/", theme_src)
    families = [f.strip() for f in m.group(1).split("|") if f.strip()]
    fonts_href = ("https://fonts.googleapis.com/css2?"
                  + "&".join("family=" + f for f in families) + "&display=swap")

    # 1. theme tokens in front of the page's own rules
    out = src.replace("<style>", f"<style>\n/* theme: {theme} */\n{theme_src}\n", 1)
    out = re.sub(r"<style>(.*?)</style>",
                 lambda mm: "<style>" + mm.group(1)[: mm.group(1).index(theme_src) + len(theme_src)]
                            + "\n" + css + "</style>",
                 out, count=1, flags=re.S)

    # 2. the theme owns typography now
    out = re.sub(r'<link href="https://fonts\.googleapis\.com/css2\?[^"]*" rel="stylesheet">',
                 f'<link href="{fonts_href}" rel="stylesheet">', out)

    # 3. shared behaviour replaces the page's own copy
    base_js = (system / "base.js").read_text(encoding="utf-8")
    out, n_js = re.subn(r"<script>.*?</script>", "<script>\n" + base_js + "\n</script>",
                        out, count=1, flags=re.S)

    # 4. base.js namespaces localStorage by slug
    legacy_ck = {"switzerland-2027": "ch27-", "quebec-sept-2026": "qc26-",
                 "dolomites-july-2027": "dolo27-"}[slug]
    out = re.sub(r"<body([^>]*)>",
                 lambda mm: f'<body{mm.group(1)} data-slug="{slug}" data-ck-legacy="{legacy_ck}">',
                 out, count=1)

    return out, {"remapped": remapped, "orphan_tokens": orphans,
                 "extra_css_bytes": len(css), "script_replaced": n_js}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("slug", choices=sorted(TOKEN_MAP))
    ap.add_argument("--theme", required=True)
    ap.add_argument("--out")
    ap.add_argument("--in-place", action="store_true")
    args = ap.parse_args()

    out, info = migrate(args.slug, args.theme)
    print(f"  token references remapped : {info['remapped']}")
    print(f"  trip-local css carried    : {info['extra_css_bytes']} bytes")
    if info["orphan_tokens"]:
        print(f"  ⚠ tokens not in contract  : {', '.join(info['orphan_tokens'])}")
    problems = check_output_is_self_contained(out)
    if problems or "{{" in out:
        for p in problems:
            print("  FAILED:", p)
        if "{{" in out:
            print("  FAILED: unresolved slots")
        return 1
    print(f"  output bytes              : {len(out)}")

    dest = Path(args.out) if args.out else (ROOT / args.slug / "index.html")
    if not args.out and not args.in_place:
        print("\nRefusing to overwrite without --in-place.")
        return 1
    dest.write_text(out, encoding="utf-8")
    print(f"  wrote {dest}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
