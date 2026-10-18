"""Helpers shared by the three directions: icons, the trip map, photo credits, page shell."""
from __future__ import annotations

import html
import json
import math
import os

import data as D

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
esc = html.escape

# ---------------------------------------------------------------- icons (24 x 24, drawn for this domain)
ICON = {
    "plane": "M3 13.5l7-2.2V5.5a2 2 0 014 0v5.8l7 2.2v2l-7-1.6v4.3l2.4 1.8V21L12 20l-4.4 1v-1l2.4-1.8v-4.3L3 15.5z",
    "bed": "M3 7v12M3 15h18v4M21 15v-3a3 3 0 00-3-3h-7v6M7 12.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z",
    "car": "M5 16v2.5M19 16v2.5M4 16h16v-4l-2-5H6l-2 5zM4 12h16M7.5 14h.01M16.5 14h.01",
    "lift": "M3 5l18-2M12 4v5M7 9h10l1 9H6zM6 13h12",
    "parking": "M5 3h14v18H5zM9.5 16V8h3.2a2.5 2.5 0 010 5H9.5",
    "toll": "M4 20V9l8-5 8 5v11M9 20v-6h6v6M2 20h20",
    "ticket": "M4 7h16v3a2 2 0 000 4v3H4v-3a2 2 0 000-4zM14 7v10",
    "trail": "M5 20l4-9 3 4 3-7 4 12M8 5.5a1.5 1.5 0 103 0 1.5 1.5 0 00-3 0",
    "peak": "M2 20L9 7l4 7 2.5-4L22 20zM9 7l1.8 3.3L13 9",
    "lake": "M2 15c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0M2 19c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0M6 11l4-6 3 4 2-2 3 4",
    "viewpoint": "M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z",
    "hut": "M3 11l9-7 9 7M5 9.5V20h14V9.5M10 20v-5h4v5",
    "activity": "M13 4a1.5 1.5 0 103 0 1.5 1.5 0 00-3 0M7 21l3-6 3 2v5M10 15l1-5 4 2 3-1M11 10L8 9l-2 3",
    "airport": "M3 13.5l7-2.2V5.5a2 2 0 014 0v5.8l7 2.2v2l-7-1.6v4.3l2.4 1.8V21L12 20l-4.4 1v-1l2.4-1.8v-4.3L3 15.5z",
    "drive": "M5 16v2.5M19 16v2.5M4 16h16v-4l-2-5H6l-2 5zM4 12h16",
    "food": "M7 3v7a2 2 0 004 0V3M9 10v11M16 3c-1.7 0-3 2-3 5s1.3 4 3 4v9",
    "flag": "M5 21V4M5 4h12l-2 4 2 4H5",
    "clock": "M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2",
    "check": "M5 12.5l4.5 4.5L19 7.5",
    "alert": "M12 3l10 18H2zM12 10v5M12 18h.01",
    "grip": "M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01",
    "search": "M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4",
    "plus": "M12 5v14M5 12h14",
    "chev": "M7 10l5 5 5-5",
    "chevr": "M10 7l5 5-5 5",
    "map": "M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15",
    "sun": "M12 16a4 4 0 100-8 4 4 0 000 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
    "calendar": "M4 6h16v15H4zM4 10h16M8 3v4M16 3v4",
    "list": "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
    "wallet": "M3 7h16a2 2 0 012 2v9a2 2 0 01-2 2H3zM3 7l12-3v3M16 13.5h.01",
    "users": "M9 11a4 4 0 100-8 4 4 0 000 8zM2 21v-1a6 6 0 0112 0v1M16 3.5a4 4 0 010 7.5M22 21v-1a6 6 0 00-4-5.6",
    "link": "M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1",
    "phone": "M5 3h4l2 5-2.5 1.5a11 11 0 006 6L16 13l5 2v4a2 2 0 01-2 2A16 16 0 013 5a2 2 0 012-2z",
    "nav": "M3 11l18-8-8 18-2-8z",
    "offline": "M2 8.5a16 16 0 0120 0M5 12a11 11 0 0114 0M8.5 15.5a6 6 0 017 0M12 19h.01M3 3l18 18",
    "download": "M12 3v12M7 10l5 5 5-5M4 21h16",
    "share": "M12 3v13M7 8l5-5 5 5M5 13v8h14v-8",
    "copy": "M9 9h11v11H9zM5 15H4V4h11v1",
    "camera": "M3 8h4l2-3h6l2 3h4v12H3zM12 17a4 4 0 100-8 4 4 0 000 8z",
    "bus": "M5 4h14v13H5zM5 11h14M8 20v-3M16 20v-3M8 14h.01M16 14h.01",
    "sunrise": "M12 3v6M8 7l4-4 4 4M3 17h18M5 21h14M7 17a5 5 0 0110 0",
    "cloud": "M7 18a5 5 0 01-.6-10A6 6 0 0118 9a4.5 4.5 0 01-.5 9z",
    "temp": "M10 14V4a2 2 0 014 0v10a4 4 0 11-4 0z",
    "rain": "M7 14a5 5 0 01-.6-10A6 6 0 0118 5a4.5 4.5 0 01-.5 9zM8 18l-1 3M12 18l-1 3M16 18l-1 3",
    "home": "M3 11l9-7 9 7v10H3zM9 21v-6h6v6",
    "compass": "M12 21a9 9 0 100-18 9 9 0 000 18zM15.5 8.5l-2 5-5 2 2-5z",
    "layers": "M12 3l9 5-9 5-9-5zM3 13l9 5 9-5",
    "settings": "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z",
    "bell": "M6 16V11a6 6 0 0112 0v5l2 2H4zM10 21h4",
    "undo": "M9 14L4 9l5-5M4 9h11a5 5 0 010 10h-3",
    "more": "M5 12h.01M12 12h.01M19 12h.01",
    "x": "M6 6l12 12M18 6L6 18",
    "eye": "M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z",
    "mail": "M3 5h18v14H3zM3 6l9 7 9-7",
    "doc": "M6 3h8l4 4v14H6zM14 3v4h4M9 13h6M9 17h6",
    "person": "M12 11a4 4 0 100-8 4 4 0 000 8zM4 21v-1a8 8 0 0116 0v1",
    "swap": "M7 4L3 8l4 4M3 8h14M17 12l4 4-4 4M21 16H7",
    "pin": "M12 21s-7-6.5-7-12a7 7 0 0114 0c0 5.5-7 12-7 12zM12 11.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z",
}


def icon(name: str, size: int = 18, cls: str = "ic") -> str:
    return (f'<svg class="{cls}" width="{size}" height="{size}" viewBox="0 0 24 24" aria-hidden="true">'
            f'<path d="{ICON[name]}"/></svg>')


KIND_ICON = {"flight": "plane", "stay": "bed", "car": "car", "lift": "lift", "parking": "parking", "toll": "toll",
             "ticket": "ticket", "trail": "trail", "lake": "lake", "viewpoint": "viewpoint", "hut": "hut",
             "activity": "activity", "airport": "plane", "drive": "drive", "food": "food", "town": "pin"}

# ---------------------------------------------------------------- the trip map
MAP_W, MAP_H = 2400, 3373
W, E, S, N = 11.10, 12.60, 45.85, 47.30


def _my(lat: float) -> float:
    return math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))


def xy(lon: float, lat: float) -> tuple[float, float]:
    return ((lon - W) / (E - W) * MAP_W, (_my(N) - _my(lat)) / (_my(N) - _my(S)) * MAP_H)


def smooth(points: list[tuple[float, float]]) -> str:
    """Catmull-Rom through the waypoints, so a route reads as a road rather than a chord."""
    if len(points) < 2:
        return ""
    d = f"M{points[0][0]:.1f},{points[0][1]:.1f}"
    pts = [points[0]] + points + [points[-1]]
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[i + 1], pts[i + 2]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d += f" C{c1[0]:.1f},{c1[1]:.1f} {c2[0]:.1f},{c2[1]:.1f} {p2[0]:.1f},{p2[1]:.1f}"
    return d


LINES = json.load(open(os.path.join(HERE, "lines.json")))


def rivers_svg(cls: str = "river") -> str:
    out = []
    for ln in LINES:
        pts = [xy(x, y) for x, y in ln["c"]]
        d = "M" + " L".join(f"{a:.0f},{b:.0f}" for a, b in pts)
        out.append(f'<path class="{cls if ln["k"] == "river" else "border"}" d="{d}"/>')
    return "".join(out)


TRIP_BOX = (11.28, 46.44, 12.50, 46.78)   # every stop and base, lon0 lat0 lon1 lat1


def fit(pane: tuple[int, int], box=TRIP_BOX, pad: float = 0.08) -> tuple[float, float, float, float, float]:
    """viewBox (x, y, w, h) that shows `box` inside a pane of `pane` px, plus the px-per-unit scale."""
    x0, y0 = xy(box[0], box[3]); x1, y1 = xy(box[2], box[1])
    bw, bh = (x1 - x0) * (1 + 2 * pad), (y1 - y0) * (1 + 2 * pad)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    pw, ph = pane
    if bw / bh > pw / ph:
        w, h = bw, bw * ph / pw
    else:
        w, h = bh * pw / ph, bh
    k = min(1.0, MAP_W / w, MAP_H / h)   # never show past the edge of the relief
    w, h = w * k, h * k
    x, y = cx - w / 2, cy - h / 2
    if w <= MAP_W:
        x = min(max(x, 0), MAP_W - w)   # keep the view inside the rendered relief
    if h <= MAP_H:
        y = min(max(y, 0), MAP_H - h)
    return x, y, w, h, pw / w


def trip_map(image, *, pane: tuple[int, int] = (600, 800), selected: int | None = None, box=TRIP_BOX, pin_px: float = 11,
             label_bases: bool = True, numbered: bool = True, extra: str = "", cls: str = "tmap", pad: float = 0.08,
             only_days: list[int] | None = None, edges=(), label_px: float = 14) -> str:
    """An SVG of the Dolomites trip on a pre-rendered relief; sizes are given in screen px for the pane it fills."""
    vx, vy, vw, vh, s = fit(pane, box, pad)
    u = 1 / s   # one screen px in map units
    parts = [f'<svg class="{cls}" viewBox="{vx:.0f} {vy:.0f} {vw:.0f} {vh:.0f}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Map of the trip" style="--u:{u:.3f}px">',
             (f'<image class="img-light" href="{image["light"]}" x="0" y="0" width="{MAP_W}" height="{MAP_H}"/>'
              f'<image class="img-dark" href="{image["dark"]}" x="0" y="0" width="{MAP_W}" height="{MAP_H}"/>' if isinstance(image, dict)
              else f'<image href="{image}" x="0" y="0" width="{MAP_W}" height="{MAP_H}"/>'), f'<g class="rivers">{rivers_svg()}</g>']
    days = only_days or sorted(D.ROUTES)
    order = [d for d in days if d != selected] + ([selected] if selected in days else [])
    for n in order:
        pts = [xy(*D.P[k]) for k in D.ROUTES[n]]
        state = "sel" if n == selected else ("dim" if selected else "all")
        parts.append(f'<path class="route-halo {state}" d="{smooth(pts)}"/>')
        parts.append(f'<path class="route b{D.DAY_BASE[n]} {state}" d="{smooth(pts)}"/>')
    r = pin_px * u
    for n in order:
        state = "sel" if n == selected else ("dim" if selected else "all")
        for k in D.STOPS[n]:
            x, y = xy(*D.P[k])
            lab = str(n) if numbered else ""
            parts.append(f'<g class="stop {state} b{D.DAY_BASE[n]}" transform="translate({x:.0f},{y:.0f})">'
                         f'<circle r="{r:.1f}" stroke-width="{2 * u:.1f}"/><text dy="{r * .36:.1f}" font-size="{r * 1.05:.1f}">{lab}</text></g>')
    if label_bases:
        for k, name in D.BASE_PINS:
            x, y = xy(*D.P[k])
            b = r * 1.35
            parts.append(f'<g class="base" transform="translate({x:.0f},{y:.0f})"><rect x="{-b:.1f}" y="{-b:.1f}" width="{2 * b:.1f}" height="{2 * b:.1f}" '
                         f'rx="{b * .35:.1f}" stroke-width="{2 * u:.1f}"/>'
                         f'<path transform="translate({-b * .55:.1f},{-b * .6:.1f}) scale({b / 18:.3f})" d="M2 10l8-7 8 7v8H2z"/>'
                         f'<text class="base-label" x="{b * 1.35:.1f}" y="{b * .38:.1f}" font-size="{label_px * u:.1f}" stroke-width="{4 * u:.1f}">{name}</text></g>')
    for text, lon, lat, dx, dy in edges:
        x, y = xy(lon, lat)
        parts.append(f'<text class="edge-label" x="{x + dx * u:.0f}" y="{y + dy * u:.0f}" font-size="{13 * u:.1f}" stroke-width="{4 * u:.1f}">{text}</text>')
    parts.append(extra)
    parts.append("</svg>")
    return "".join(parts)


# ---------------------------------------------------------------- photos and credits
class Credits:
    """Collects every photo used on a page, so the page credits exactly what it shows."""

    def __init__(self) -> None:
        self.used: list[str] = []

    def url(self, key: str, width: int = 960) -> str:
        if key not in self.used:
            self.used.append(key)
        return D.photo_url(key, width)

    def html(self, cls: str = "credits") -> str:
        rows = []
        for k in self.used:
            f, author, lic, what = D.PHOTOS[k]
            rows.append(f'<li><a href="{D.photo_page(k)}">{esc(what)}</a>, {esc(author)}, '
                        f'<a href="{D.LICENSE_URL.get(lic, "#")}">{esc(lic)}</a></li>')
        return (f'<footer class="{cls}"><h2>Photo credits</h2><p>Photos from Wikimedia Commons, hotlinked at standard thumbnail sizes. '
                f'Map relief from Mapterhorn elevation data; rivers and borders from OpenStreetMap contributors.</p>'
                f'<ol>{"".join(rows)}</ol></footer>')


def fonts_css(*families: str) -> str:
    src = {
        "Instrument Serif": [("instrument-serif-latin-400-normal.woff2", "400", "normal"), ("instrument-serif-latin-400-italic.woff2", "400", "italic")],
        "Instrument Sans": [(f"instrument-sans-latin-{w}-normal.woff2", w, "normal") for w in ("400", "500", "600", "700")],
        "Archivo": [("archivo-latin-wdth-normal.woff2", "100 900", "normal")],
        "JetBrains Mono": [("jetbrains-mono-latin-wght-normal.woff2", "100 800", "normal")],
        "IBM Plex Mono": [(f"ibm-plex-mono-latin-{w}-normal.woff2", w, "normal") for w in ("400", "500", "600")],
        "Big Shoulders Display": [("big-shoulders-display-latin-wght-normal.woff2", "100 900", "normal")],
        "Schibsted Grotesk": [("schibsted-grotesk-latin-wght-normal.woff2", "400 900", "normal")],
        "Source Serif 4": [("source-serif-4-latin-wght-normal.woff2", "200 900", "normal"), ("source-serif-4-latin-wght-italic.woff2", "200 900", "italic")],
    }
    out = []
    for fam in families:
        for file, weight, style in src[fam]:
            stretch = " font-stretch: 62% 125%;" if fam == "Archivo" else ""
            out.append(f"@font-face {{ font-family: '{fam}'; src: url('../fonts/{file}') format('woff2'); font-weight: {weight}; "
                       f"font-style: {style};{stretch} font-display: block; }}")
    return "\n".join(out)


THEME_JS = """<script>
(function(){var t=new URLSearchParams(location.search).get('theme');if(t)document.documentElement.dataset.theme=t;
document.addEventListener('click',function(e){var b=e.target.closest('[data-toggle-theme]');if(!b)return;
var r=document.documentElement;r.dataset.theme=r.dataset.theme==='dark'?'light':'dark';});
document.addEventListener('click',function(e){var b=e.target.closest('[data-tab]');if(!b)return;var g=b.parentElement;
g.querySelectorAll('[data-tab]').forEach(function(x){x.setAttribute('aria-selected',x===b?'true':'false')});});})();
</script>"""


def page(title: str, css: str, body: str, *, theme: str = "light", lang_note: str = "") -> str:
    return (f'<!doctype html><html lang="en" data-theme="{theme}"><head><meta charset="utf-8">'
            f'<meta name="viewport" content="width=device-width, initial-scale=1"><title>{esc(title)}</title>'
            f'<style>{css}</style></head><body>{body}{THEME_JS}</body></html>')


def write(path: str, text: str) -> None:
    full = os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8") as f:
        f.write(text)
    print("wrote", path, len(text) // 1024, "KB")


def swatch(trip_id: str) -> str:
    return D.IDENTITY[D.TRIP[trip_id]["colour"]] if trip_id in D.TRIP else D.IDENTITY["none"]


def elevation_svg(w: int = 640, h: int = 160, cls: str = "elev") -> str:
    xs = [k for k, _ in D.PROFILE]; ys = [m for _, m in D.PROFILE]
    lo, hi = 2240, 2480
    pts = [(k / 10 * w, h - (m - lo) / (hi - lo) * h) for k, m in D.PROFILE]
    line = smooth(pts)
    area = line + f" L{w},{h} L0,{h} Z"
    grid = "".join(f'<line class="g" x1="0" x2="{w}" y1="{h - (v - lo) / (hi - lo) * h:.0f}" y2="{h - (v - lo) / (hi - lo) * h:.0f}"/>'
                   f'<text class="gl" x="{w + 6}" y="{h - (v - lo) / (hi - lo) * h + 4:.0f}">{v:,}</text>' for v in (2300, 2400))
    marks = ""
    for name, km, elev in D.TRAIL["huts"]:
        k = float(km.split()[0]); m = int(elev.replace(",", "").split()[0])
        x = k / 10 * w; y = h - (m - lo) / (hi - lo) * h
        marks += f'<g class="mk" transform="translate({x:.0f},{y:.0f})"><circle r="4"/></g>'
    return (f'<svg class="{cls}" viewBox="-2 -14 {w + 48} {h + 34}" role="img" aria-label="Elevation profile, 2,320 to 2,454 m">{grid}'
            f'<path class="a" d="{area}"/><path class="l" d="{line}"/>{marks}'
            + "".join(f'<text class="xl" x="{k / 10 * w:.0f}" y="{h + 16}">{k} km</text>' for k in (0, 2, 4, 6, 8, 10)) + "</svg>")
