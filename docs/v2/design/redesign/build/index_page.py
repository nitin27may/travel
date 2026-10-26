"""Writes ../index.html: one page linking every preview with a thumbnail and the one-line idea."""
from __future__ import annotations

import common as C
from common import esc

DIRS = [
    ("trailhead", "C · Trailhead", "Recommended",
     "The live site's structure, cards, filters, tables and type, re-coloured: stone paper, slate ink, a navy header with the amber rule. Light first.",
     "light"),
    ("atlas", "A · Atlas", "",
     "The trip as a magazine feature: white paper, full-bleed photography, an editorial serif for names, a quiet grotesk for controls.",
     "light"),
    ("altimeter", "B · Altimeter", "",
     "A precise instrument, dark first: mono numbers, a day-by-day gauge strip, one amber signal colour, ⌘K to switch trips.",
     "dark"),
]
PAGES = [
    ("home", "Trips home", "S1: needs you this week across Elora, Patagonia and Dolomites; upcoming trips with photos; done trips as templates"),
    ("public-trip", "Public trip (Discover)", "No login: season band, day by day, route map, copy"),
    ("trail", "Trail page", "Facts with sources, trailhead and parking, elevation, all 12 links"),
    ("places", "Places (kept from the live site)", "Filter pills, four views, saved views, columns, density, CSV, honesty markers, globe"),
    ("plan", "Plan, desktop", "Trip header with tabs, outline, day timeline with a drag in progress, map of all days"),
    ("bookings-switch", "Switching trips in Bookings", "S2: Dolomites to Patagonia and back, same tab, form names the trip"),
    ("today-phone", "Today, phone", "S5: Today opens Elora on the travel day; running late; offline at Auronzo"),
    ("plan-phone", "Plan, phone", "One day with drag handles; the map of all days"),
]

CSS = C.fonts_css("Big Shoulders Display", "Source Serif 4", "IBM Plex Mono") + """
*{box-sizing:border-box;margin:0;padding:0}
body{background:#F5F6F8;color:#172230;font:400 16px/1.5 'Source Serif 4',Georgia,serif}
a{color:inherit}
header{background:#172230;color:#F4F6F8;border-bottom:2px solid #D9962B;padding:40px 48px 36px}
header h1{font:800 72px/.9 'Big Shoulders Display',sans-serif}
header p{max-width:900px;margin-top:14px;font-size:18px;color:#D5DCE4}
header nav{display:flex;gap:10px;margin-top:20px;flex-wrap:wrap}
header nav a{font:500 13px 'IBM Plex Mono',monospace;color:#F4F6F8;border:1px solid #3A4A5D;border-radius:999px;padding:7px 14px;text-decoration:none}
section{padding:36px 48px 8px}
.dh{display:flex;align-items:baseline;gap:16px;flex-wrap:wrap}
.dh h2{font:800 46px/1 'Big Shoulders Display',sans-serif}
.dh .rec{font:600 12px 'IBM Plex Mono',monospace;background:#D9962B;color:#241703;border-radius:999px;padding:4px 10px}
.dh p{font-size:17px;color:#2B3746;flex-basis:100%;max-width:980px}
.dh .theme{font:500 12.5px 'IBM Plex Mono',monospace;color:#4D5B6B}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-top:18px}
.tile{display:block;text-decoration:none;background:#fff;border:1px solid #D8DEE5;border-radius:12px;overflow:hidden}
.tile:hover{border-color:#8A5300}
.tile img{width:100%;aspect-ratio:16/10;object-fit:cover;object-position:top;display:block;border-bottom:1px solid #D8DEE5}
.tile div{padding:10px 12px 12px}
.tile b{display:block;font-weight:600}
.tile span{font:500 12px/1.45 'IBM Plex Mono',monospace;color:#4D5B6B}
.tile .alt{display:inline-block;margin-top:6px;font:500 12px 'IBM Plex Mono',monospace;color:#8A5300}
.docs{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-top:18px}
.docs a{display:block;background:#fff;border:1px solid #D8DEE5;border-radius:12px;padding:16px;text-decoration:none}
.docs b{font:800 26px/1 'Big Shoulders Display',sans-serif;display:block;margin-bottom:6px}
.docs span{font-size:15px;color:#2B3746}
footer{padding:36px 48px 56px;font:400 12.5px/1.6 'IBM Plex Mono',monospace;color:#4D5B6B}
"""


def build() -> None:
    nav = "".join(f'<a href="#{d}">{esc(name)}</a>' for d, name, *_ in DIRS)
    docs = "".join(f'<a href="{href}"><b>{t}</b><span>{esc(s)}</span></a>' for href, t, s in [
        ("recommendation.md", "Recommendation", "Which direction, the information architecture, tasks, bookings and budget scoping, S1-S10 walked, and the migration plan"),
        ("directions.md", "Three directions", "Tokens for light and dark, type, shape, motion, imagery, maps and icons, plus strengths and weaknesses"),
        ("critique.md", "Critique", "Why the current prototype feels basic, screen by screen, with screenshots"),
        ("contrast-report.txt", "Contrast", "62 text pairs across the three directions, all at WCAG AA or better"),
    ])
    secs = ""
    for d, name, rec, idea, theme in DIRS:
        alt = "dark" if theme == "light" else "light"
        tiles = ""
        for page, title, sub in PAGES:
            if page == "places" and d != "trailhead":
                continue
            tiles += (f'<a class="tile" href="{d}/{page}.html">'
                      f'<div><b>{esc(title)}</b><span>{esc(sub)}</span><br><span class="alt" onclick="event.preventDefault();location.href=\'{d}/{page}.html?theme={alt}\'">open in {alt}</span></div></a>')
        secs += (f'<section id="{d}"><div class="dh"><h2>{esc(name)}</h2>{f"<span class=rec>{rec}</span>" if rec else ""}'
                 f'<span class="theme">default {theme} · every page has a theme toggle</span><p>{esc(idea)}</p></div><div class="grid">{tiles}</div></section>')
    body = (f'<header><h1>REDESIGN DIRECTIONS</h1><p>Three complete visual systems for the trip planner, shown on the same screens with the same household data '
            f'(18 Oct 2026: Elora on Saturday, Patagonia and the Dolomites in booking). The public read-only pages come first, then the signed-in planner. '
            f'Open any tile; static previews, no build step.</p><nav>{nav}<a href="#docs">Documents</a></nav></header>'
            f'<section id="docs"><div class="dh"><h2>READ FIRST</h2></div><div class="docs">{docs}</div></section>{secs}'
            f'<footer>Photos: Wikimedia Commons, credited on each page. Relief: Mapterhorn. Rivers and border: OpenStreetMap contributors. '
            f'Fonts: OFL, in fonts/ with their licences.</footer>')
    C.write("index.html", C.page("Redesign directions", CSS, body).replace("../fonts/", "fonts/"))


if __name__ == "__main__":
    build()
