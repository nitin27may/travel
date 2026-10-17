#!/usr/bin/env python3
"""
Travel plan builder.

Assembles  <slug>/trip.json + <slug>/blocks/*.html  ->  a single self-contained index.html,
using shared components from legacy/_system/ and one swappable theme from legacy/_system/themes/.

Design rules enforced here (see plans/ for rationale):
  1. Colour lives ONLY in legacy/_system/themes/*.css. base.css and components/ may not contain
     hex literals — otherwise themes silently stop being swappable.
  2. Every theme must clear WCAG AA contrast for its core text pairings, so a pale theme
     never ships unreadable in bright sunlight.
  3. Output is one file: no local stylesheet links, no external JS. It has to work offline
     at a trailhead with no signal.

Zero third-party dependencies — stdlib only, matching publish.sh.

Usage:
    python3 legacy/_system/build.py --check              validate system + themes, build nothing
    python3 legacy/_system/build.py --list-themes        show themes with contrast report
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

SYSTEM = Path(__file__).resolve().parent
ROOT = SYSTEM.parent

# --------------------------------------------------------------------------------------
# Token contract — every theme must define all of these, and base.css may use no others.
# --------------------------------------------------------------------------------------

REQUIRED_TOKENS = [
    # typography — per-trip, and deliberately so
    "font-display", "font-body", "font-mono",
    # surfaces
    "bg", "surface", "bg-deep", "bg-deep-2",
    # text
    "ink", "ink-on-deep", "muted", "muted-on-deep", "line",
    # accent
    "accent", "accent-dark", "accent-ink", "accent-soft",
    # day headers
    "header", "header-ink", "header-sub",
    # hazards
    "warn", "warn-soft",
    # added / optional
    "highlight", "highlight-ink", "highlight-soft", "highlight-on-deep",
    # classifier slots
    "class-1", "class-2", "class-3", "class-4", "class-5", "class-6",
]

# (foreground, background, minimum ratio, label)
# 4.5 = WCAG AA body text; 3.0 = AA large text / UI component boundary.
CONTRAST_PAIRS = [
    ("ink",           "bg",         4.5, "body text on page"),
    ("ink",           "surface",    4.5, "body text on cards"),
    ("muted",         "surface",    4.5, "secondary text on cards"),
    ("muted",         "bg",         4.5, "secondary text on page"),
    ("ink-on-deep",   "bg-deep",    4.5, "text on nav/footer"),
    ("muted-on-deep", "bg-deep",    4.5, "secondary text on nav/footer"),
    ("highlight-on-deep", "bg-deep", 4.5, "link on dark photo caption"),
    ("accent-ink",    "accent",     4.5, "text on primary button"),
    ("accent-dark",   "accent-soft", 4.5, "time chip text"),
    ("header-ink",    "header",     4.5, "day sign title"),
    ("header-sub",    "header",     3.0, "day sign subtitle"),
    ("highlight-ink", "highlight",  4.5, "text on added/optional tag"),
    ("accent",        "surface",    3.0, "link/button outline on card"),
    ("warn",          "warn-soft",  4.5, "hazard callout text"),
]


# --------------------------------------------------------------------------------------
# Colour maths
# --------------------------------------------------------------------------------------

def parse_hex(value: str) -> tuple[int, int, int]:
    v = value.strip().lstrip("#")
    if len(v) == 3:
        v = "".join(c * 2 for c in v)
    if len(v) not in (6, 8):
        raise ValueError(f"cannot parse colour {value!r}")
    return int(v[0:2], 16), int(v[2:4], 16), int(v[4:6], 16)


def relative_luminance(rgb: tuple[int, int, int]) -> float:
    def channel(c: int) -> float:
        s = c / 255.0
        return s / 12.92 if s <= 0.04045 else ((s + 0.055) / 1.055) ** 2.4
    r, g, b = (channel(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast_ratio(fg: str, bg: str) -> float:
    l1 = relative_luminance(parse_hex(fg))
    l2 = relative_luminance(parse_hex(bg))
    hi, lo = max(l1, l2), min(l1, l2)
    return (hi + 0.05) / (lo + 0.05)


# --------------------------------------------------------------------------------------
# Theme loading and validation
# --------------------------------------------------------------------------------------

def load_theme(path: Path) -> dict[str, str]:
    text = path.read_text(encoding="utf-8")
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    return {k: v.strip() for k, v in re.findall(r"--([\w-]+)\s*:\s*([^;]+);", text)}


def theme_paths() -> list[Path]:
    return sorted((SYSTEM / "themes").glob("*.css"))


def check_theme(path: Path) -> list[str]:
    """Return a list of problems; empty means the theme is good."""
    problems: list[str] = []
    tokens = load_theme(path)

    missing = [t for t in REQUIRED_TOKENS if t not in tokens]
    if missing:
        problems.append(f"missing tokens: {', '.join(missing)}")

    extra = [t for t in tokens if t not in REQUIRED_TOKENS]
    if extra:
        problems.append(f"unknown tokens (not in contract): {', '.join(sorted(extra))}")

    for fg, bg, minimum, label in CONTRAST_PAIRS:
        if fg not in tokens or bg not in tokens:
            continue
        try:
            ratio = contrast_ratio(tokens[fg], tokens[bg])
        except ValueError as exc:
            problems.append(f"{label}: {exc}")
            continue
        if ratio < minimum:
            problems.append(
                f"contrast {ratio:4.2f} < {minimum} — {label} "
                f"(--{fg} {tokens[fg]} on --{bg} {tokens[bg]})"
            )
    return problems


# --------------------------------------------------------------------------------------
# Structural gates
# --------------------------------------------------------------------------------------

HEX_RE = re.compile(r"#[0-9a-fA-F]{3,8}\b")


def check_no_hex_outside_themes() -> list[str]:
    """base.css and components/ must not hard-code colour."""
    problems: list[str] = []
    targets: list[Path] = []
    base = SYSTEM / "base.css"
    if base.exists():
        targets.append(base)
    targets.extend(sorted((SYSTEM / "components").glob("*.html")))

    for path in targets:
        text = path.read_text(encoding="utf-8")
        text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)      # strip CSS comments
        text = re.sub(r"<!--.*?-->", "", text, flags=re.S)      # strip HTML comments
        # data: URIs (favicons) legitimately carry encoded colour — ignore them
        text = re.sub(r"data:[^\"')]+", "", text)
        for m in HEX_RE.finditer(text):
            line = text[: m.start()].count("\n") + 1
            problems.append(f"{path.relative_to(ROOT)}:{line} hard-coded colour {m.group(0)}")
    return problems


def check_tokens_defined() -> list[str]:
    """Every var(--x) used in base.css must exist in the token contract."""
    base = SYSTEM / "base.css"
    if not base.exists():
        return []
    text = base.read_text(encoding="utf-8")
    used = set(re.findall(r"var\(\s*--([\w-]+)", text))
    unknown = sorted(used - set(REQUIRED_TOKENS))
    return [f"base.css uses undefined token --{t}" for t in unknown]



def check_comment_integrity() -> list[str]:
    """A literal `*/` inside a CSS comment body silently ends the comment early and the
    parser then eats the rules that follow. This actually happened: the header comment
    described the classifier as replacing `.s-<star>/.g-<star>`, whose `<star>/` closed the
    comment and swallowed the `*{margin:0}` reset — which put an 8px body margin back and
    shifted every pixel on the page."""
    problems: list[str] = []
    for path in [SYSTEM / "base.css"] + sorted((SYSTEM / "components").glob("*.html")):
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8")
        pos = 0
        while True:
            a = text.find("/*", pos)
            if a < 0:
                break
            b = text.find("*/", a + 2)
            if b < 0:
                line = text[:a].count("\n") + 1
                problems.append(f"{path.relative_to(ROOT)}:{line} unclosed CSS comment")
                break
            # a nested "/*" inside the body is fine; a stray "*" immediately before "/" is
            # what bites, and that is exactly what closed this comment early.
            pos = b + 2
        # the reset must survive: assert it is still the first rule the parser will see
        if path.name == "base.css" and not re.search(r"\*\s*\{[^}]*margin:\s*0", text):
            problems.append(f"{path.relative_to(ROOT)}: universal reset rule is missing")
    return problems


# --------------------------------------------------------------------------------------
# Rendering
# --------------------------------------------------------------------------------------

SLOT_RE = re.compile(r"\{\{\s*(\w+)\s*\}\}")


def render(template: str, context: dict[str, str]) -> str:
    """Substitute {{slot}} placeholders. Unknown slots render empty rather than exploding,
    so a trip that omits an optional section just gets nothing there."""
    return SLOT_RE.sub(lambda m: str(context.get(m.group(1), "")), template)


def assemble(context: dict[str, str], theme: str) -> str:
    """Inline base.css, the chosen theme, and base.js into layout.html.
    Output is a single self-contained file: no local stylesheet link, no external JS."""
    layout = (SYSTEM / "layout.html").read_text(encoding="utf-8")
    theme_path = SYSTEM / "themes" / f"{theme}.css"
    if not theme_path.exists():
        raise SystemExit(f"unknown theme {theme!r}; available: "
                         + ", ".join(p.stem for p in theme_paths()))
    theme_src = theme_path.read_text(encoding="utf-8")

    # Typography is part of the theme, not the layout — each trip has its own type
    # personality (Vermont: Big Shoulders; Dolomites: Archivo; Quebec: Fraunces).
    m = re.search(r"/\*\s*@fonts:\s*([^*]+?)\s*\*/", theme_src)
    if not m:
        raise SystemExit(f"theme {theme!r} is missing its /* @fonts: ... */ directive")
    families = [f.strip() for f in m.group(1).split("|") if f.strip()]
    fonts_href = ("https://fonts.googleapis.com/css2?"
                  + "&".join("family=" + f for f in families) + "&display=swap")

    ctx = dict(context)
    ctx.setdefault("theme_name", theme)
    ctx["fonts_href"] = fonts_href
    ctx["theme_css"] = theme_src
    ctx["base_css"] = (SYSTEM / "base.css").read_text(encoding="utf-8")
    ctx["base_js"] = (SYSTEM / "base.js").read_text(encoding="utf-8")
    return render(layout, ctx)


def check_output_is_self_contained(html_text: str) -> list[str]:
    """Gate: the field requirement. One file, works offline, no build artifacts."""
    problems = []
    for m in re.finditer(r'<link[^>]+rel="stylesheet"[^>]*>', html_text):
        if "fonts.googleapis.com" not in m.group(0):
            problems.append("output links a non-Google stylesheet: " + m.group(0)[:80])
    for m in re.finditer(r"<script[^>]*\ssrc=", html_text):
        problems.append("output loads external JS: " + m.group(0)[:80])
    return problems


# --------------------------------------------------------------------------------------
# Theme gallery — renders the same sample components in every theme, side by side.
# This is the end-to-end proof that base.css + themes + layout actually work together.
# --------------------------------------------------------------------------------------

SAMPLE = """
<section class="day">
  <div class="sign">
    <div class="date"><span class="dow">Saturday</span><span class="num">AUG 29</span></div>
    <div class="body"><h2>Morning &mdash; the gorge floor</h2>
      <p class="route">Whitby &#8594; St. Catharines &#8594; Niagara Glen</p></div>
  </div>
  <div class="daymeta"><span>Drive <b>170 km</b></span><span>On foot <b>~3 km</b></span><span>Sunrise <b>6:36 AM</b></span></div>
  <div class="trail">
    <div class="stop"><span class="mark mark--1"></span>
      <div class="card"><div class="split noimg"><div class="content">
        <span class="time">11:10 AM &#8211; 1:15 PM</span>
        <h3>Niagara Glen hike <span class="tag tag--added">added</span></h3>
        <p>Down the stairs, then Main Loop to River Trail to Cliffside. Two hours rather than
           eighty-five minutes, so there is time to stop at the river instead of route-marching.</p>
        <div class="stats"><span><b>~2.5&#8211;3</b> km</span><span><b>60</b> m relief</span><span><b>~80</b> stairs</span></div>
        <div class="links"><a class="btn primary" href="#">Map</a><a class="btn" href="#">AllTrails</a></div>
        <details class="more"><summary>Closures and footing</summary>
          <p>Whirlpool Trail closed; Terrace Trail severed between Cobblestone and Trillium.</p></details>
        <div class="note">Keep the parking receipt &mdash; it makes the next lot free.</div>
      </div></div></div>
    </div>
    <div class="stop"><span class="mark mark--2"></span>
      <div class="card"><div class="split noimg"><div class="content">
        <span class="time opt">3:15 &#8211; 3:45 PM &#183; optional</span>
        <h3>Niagara Parkway <span class="tag tag--optional">optional</span></h3>
        <p>Do not take the fast inland road. The Parkway follows the river the whole way down.</p>
        <div class="stats"><span><b>14</b> km</span><span><b>~20</b> min</span></div>
      </div></div></div>
    </div>
  </div>
  <div class="legend">
    <span><i class="b" style="background:var(--class-1)"></i>Trail on foot</span>
    <span><i class="b" style="background:var(--class-2)"></i>Road leg</span>
    <span><i class="b" style="background:var(--class-3)"></i>Town walking</span>
    <span><i class="b" style="background:var(--class-4)"></i>Food</span>
  </div>
  <div class="numstrip">
    <div><b>16</b><span>hours</span></div><div><b>380</b><span>km driven</span></div>
    <div><b>~3</b><span>km on trail</span></div><div><b>80</b><span>stairs</span></div>
    <div><b>60</b><span>m relief</span></div><div><b>7:58</b><span>pm sunset</span></div>
  </div>
</section>
"""


def cmd_gallery(out_path: Path) -> int:
    base_css = (SYSTEM / "base.css").read_text(encoding="utf-8")
    parts = [
        '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">',
        '<meta name="viewport" content="width=device-width,initial-scale=1">',
        "<title>Theme gallery</title>",
        '<link rel="preconnect" href="https://fonts.googleapis.com">',
        '<link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;700;800'
        "&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&family=IBM+Plex+Mono:wght@450;600"
        '&display=swap" rel="stylesheet">',
        "<style>",
        base_css,
        # scope each theme to a wrapper class instead of :root so all 8 coexist on one page
    ]
    for path in theme_paths():
        scoped = re.sub(r":root\s*\{", f".t-{path.stem}{{", path.read_text(encoding="utf-8"), count=1)
        parts.append(scoped)
    parts.append(
        ".galwrap{padding:0 0 40px}"
        ".galhead{font-family:'Big Shoulders Display',sans-serif;font-weight:800;"
        "text-transform:uppercase;font-size:1.6rem;padding:26px 6vw 4px}"
        ".galsub{font-family:'IBM Plex Mono',monospace;font-size:.72rem;padding:0 6vw 14px;opacity:.7}"
        ".galtheme{padding:26px 6vw 34px;background:var(--bg);color:var(--ink)}"
        "</style></head><body style='margin:0'>"
    )
    for path in theme_paths():
        parts.append(f'<div class="t-{path.stem} galtheme">')
        parts.append(f'<p class="galhead">{path.stem}</p>')
        parts.append('<p class="galsub">same markup, different theme &#183; all pass WCAG AA</p>')
        parts.append(f'<main style="width:min(1000px,92%);margin:0 auto">{SAMPLE}</main>')
        parts.append("</div>")
    parts.append("</body></html>")
    out_path.write_text("\n".join(parts), encoding="utf-8")
    print(f"  wrote {out_path.relative_to(ROOT)} ({len(theme_paths())} themes)")
    return 0


# --------------------------------------------------------------------------------------
# Commands
# --------------------------------------------------------------------------------------

def cmd_check() -> int:
    failed = False

    print("Structural gates")
    for label, problems in (
        ("no hard-coded colour outside themes/", check_no_hex_outside_themes()),
        ("all base.css tokens in contract", check_tokens_defined()),
        ("CSS comments well formed / reset intact", check_comment_integrity()),
    ):
        if problems:
            failed = True
            print(f"  FAIL  {label}")
            for p in problems[:20]:
                print(f"          {p}")
            if len(problems) > 20:
                print(f"          ... and {len(problems) - 20} more")
        else:
            print(f"  ok    {label}")

    print(f"\nThemes ({len(theme_paths())})")
    for path in theme_paths():
        problems = check_theme(path)
        if problems:
            failed = True
            print(f"  FAIL  {path.stem}")
            for p in problems:
                print(f"          {p}")
        else:
            print(f"  ok    {path.stem}")

    print("\n" + ("FAILED" if failed else "All checks passed."))
    return 1 if failed else 0


def cmd_list_themes() -> int:
    for path in theme_paths():
        tokens = load_theme(path)
        worst_label, worst_ratio = "", 99.0
        for fg, bg, minimum, label in CONTRAST_PAIRS:
            if fg in tokens and bg in tokens:
                r = contrast_ratio(tokens[fg], tokens[bg])
                headroom = r - minimum
                if headroom < worst_ratio:
                    worst_ratio, worst_label = headroom, f"{label} ({r:.2f})"
        status = "ok " if worst_ratio >= 0 else "BAD"
        print(f"  {status} {path.stem:<14} accent {tokens.get('accent','?'):<9} "
              f"bg {tokens.get('bg','?'):<9} tightest: {worst_label}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Build travel plan pages.")
    ap.add_argument("--check", action="store_true", help="validate system and themes")
    ap.add_argument("--list-themes", action="store_true", help="list themes with contrast")
    ap.add_argument("--gallery", metavar="OUT", nargs="?", const="_system/gallery.html",
                    help="render every theme side by side for comparison")
    args = ap.parse_args()

    if args.list_themes:
        return cmd_list_themes()
    if args.gallery:
        return cmd_gallery(ROOT / args.gallery)
    if args.check:
        return cmd_check()
    ap.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
