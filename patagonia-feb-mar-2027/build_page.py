#!/usr/bin/env python3
"""Build patagonia-feb-mar-2027/index.html from _system components. Run:  python3 build_page.py

Content source is PLAN.md; sections are parsed and rendered with their wording unchanged.
Hero and sub-region photos come from photos.py (empty until filled; the page then uses plain
themed blocks). The gallery section is injected after the build, after the trails section."""
import html
import re
import sys
import urllib.parse
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "_system"))
sys.path.insert(0, str(HERE))
import build as S   # noqa: E402
from photos import PHOTOS   # noqa: E402

THEME = "alpine-snow"
PLAN = (HERE / "PLAN.md").read_text(encoding="utf-8")


def esc(s, quote=True):
    return html.escape(str(s), quote)


# ---------------------------------------------------------------- links and photos
def commons(fn, w=1200):
    return "https://commons.wikimedia.org/wiki/Special:FilePath/" + urllib.parse.quote(fn.replace(" ", "_")) + f"?width={w}"


def filepage(fn):
    return "https://commons.wikimedia.org/wiki/File:" + urllib.parse.quote(fn.replace(" ", "_"))


def mapq(place):
    return "https://maps.google.com/?q=" + urllib.parse.quote_plus(place)


def dirq(*places):
    return "https://www.google.com/maps/dir/" + "/".join(urllib.parse.quote_plus(p) for p in places) + "/"


def embed(place, z=11):
    return f"https://maps.google.com/maps?q={urllib.parse.quote_plus(place)}&z={z}&output=embed"


def photo_block(key, label):
    fn = PHOTOS.get(key)
    if not fn:
        return f'<div class="phblock"><span>{esc(label)}</span></div>'
    return (f'<figure><img loading="lazy" src="{commons(fn)}" alt="{esc(label)}">'
            f'<figcaption><a href="{filepage(fn)}">Wikimedia Commons</a></figcaption></figure>')


# ---------------------------------------------------------------- inline and block markdown
GAP = '<span class="inf gap">GAP</span>'


def inf(text="inference"):
    return f'<span class="inf">{text}</span>'


def added_tag(m):
    rest = m.group(1).strip(" ,;")
    tag = '<span class="tag tag--added">added</span>'
    return tag + (f' <span class="smallnote">{rest}</span>' if rest else "")


def inline(t):
    t = esc(t, quote=False)
    t = re.sub(r"`([^`]+)`", r"<code>\1</code>", t)
    t = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", t)
    t = re.sub(r"(?<![\*\w])\*([^*\n]+)\*(?![\*\w])", r"<i>\1</i>", t)
    t = re.sub(r"\[([^\]]+)\]\((https?://[^)]+)\)", r'<a href="\2">\1</a>', t)
    t = re.sub(r"\(added\b([^)]*)\)", added_tag, t)
    t = re.sub(r"\bGAP(s?)\b", lambda m: GAP + m.group(1), t)
    t = re.sub(r"\bINFERENCE\b", inf("inference"), t)
    t = re.sub(r"\bVERIFIED\b", '<span class="inf ok">verified</span>', t)
    return t


def dayrefs(t):
    """Turn 'Day 8' and 'Day 1 or 13' in already-inlined text into anchors."""
    def one(m):
        out = f'<a href="#d{m.group(1)}">Day {m.group(1)}</a>'
        if m.group(2):
            out += f'{m.group(2)}<a href="#d{m.group(3)}">{m.group(3)}</a>'
        return out
    return re.sub(r"\bDay (\d+)\b(?:( or )(\d+))?", one, t)


def split_row(l):
    return [c.strip() for c in l.strip().strip("|").split("|")]


def table_html(rows, badgecol=None, cls=""):
    head, body = rows[0], [r for r in rows[1:] if not all(re.fullmatch(r":?-+:?", c) for c in r)]
    n = len(head)
    kv = all(not c for c in head)
    if kv:
        trs = "".join("<tr><th scope=row>" + inline(r[0]) + "</th><td>" + inline(r[1]) + "</td></tr>" for r in body if r[0] or r[1])
        return f'<table class="kv">{trs}</table>'
    h = "".join(f"<th>{inline(c)}</th>" for c in head)
    out = []
    for r in body:
        cells = []
        for i, c in enumerate(r):
            x = inline(c)
            if badgecol is not None and i == badgecol:
                plain = re.sub(r"[*]", "", c).strip()
                k = "yes" if plain.startswith("Yes") else "no" if plain.startswith("No") else "unk" if plain.startswith("GAP") or plain.startswith("n/a") else "cond"
                x = f'<span class="ok11 ok11--{k}">{x}</span>'
            cells.append(f"<td>{x}</td>")
        out.append("<tr>" + "".join(cells) + "</tr>")
    return f'<div class="tw"><table class="c{n} {cls}"><tr>{h}</tr>{"".join(out)}</table></div>'


BULLET = re.compile(r"^(\s*)- (.*)$")
NUMBERED = re.compile(r"^(\s*)(\d+)\. (.*)$")


def gather_item(lines, i, indent_w):
    """First line is lines[i]; return (children_lines_dedented, next_i)."""
    kids, j = [], i + 1
    while j < len(lines):
        l = lines[j]
        if l.startswith(" " * 2) and l.strip():
            kids.append(l[indent_w:] if l[:indent_w].strip() == "" else l.lstrip())
            j += 1
        elif not l.strip():
            k = j
            while k < len(lines) and not lines[k].strip():
                k += 1
            if k < len(lines) and lines[k].startswith("  "):
                kids.extend([""] * (k - j))
                j = k
            else:
                break
        else:
            break
    return kids, j


def md(text, badgecol=None, itemhook=None):
    lines = text.split("\n")
    out, i = [], 0
    while i < len(lines):
        l = lines[i]
        if not l.strip() or l.strip() == "---":
            i += 1
            continue
        if l.startswith("```"):
            buf, i = [], i + 1
            while i < len(lines) and not lines[i].startswith("```"):
                buf.append(lines[i])
                i += 1
            i += 1
            out.append("<pre>" + esc("\n".join(buf)) + "</pre>")
            continue
        if l.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].startswith("|"):
                rows.append(split_row(lines[i]))
                i += 1
            out.append(table_html(rows, badgecol))
            continue
        m = re.match(r"^(#{3,4}) (.*)$", l)
        if m:
            out.append(f'<h3 class="subh">{inline(m.group(2))}</h3>')
            i += 1
            continue
        if BULLET.match(l) and not l.startswith(" "):
            items = []
            while i < len(lines) and BULLET.match(lines[i]) and not lines[i].startswith(" "):
                first = lines[i][2:]
                kids, i = gather_item(lines, i, 2)
                body = inline(first)
                if itemhook:
                    body = itemhook(body, first)
                items.append("<li>" + body + (md("\n".join(kids)) if kids else "") + "</li>")
            out.append('<ul class="plainlist">' + "".join(items) + "</ul>")
            continue
        if NUMBERED.match(l) and not l.startswith(" "):
            items = []
            while i < len(lines) and NUMBERED.match(lines[i]) and not lines[i].startswith(" "):
                nm = NUMBERED.match(lines[i])
                kids, i = gather_item(lines, i, 3)
                items.append("<li>" + inline(nm.group(3)) + (md("\n".join(kids)) if kids else "") + "</li>")
            out.append('<ol class="plainlist">' + "".join(items) + "</ol>")
            continue
        para = [l.strip()]
        i += 1
        while i < len(lines) and lines[i].strip() and not re.match(r"^(\||- |\d+\. |#{3,4} |```|---)", lines[i]):
            para.append(lines[i].strip())
            i += 1
        out.append("<p>" + inline(" ".join(para)) + "</p>")
    return "\n".join(out)


# ---------------------------------------------------------------- PLAN.md section access
def sec(title, level=2):
    lines = PLAN.split("\n")
    pre = "#" * level + " "
    start = next(i for i, l in enumerate(lines) if l.strip() == pre + title)
    out = []
    for l in lines[start + 1:]:
        if re.match(r"^#{1,%d} " % level, l):
            break
        out.append(l)
    return "\n".join(out).strip("\n")


def subs(text):
    """Split a level-2 body into (intro, {title: body}) on ### headings."""
    parts = re.split(r"^### (.+)$", text, flags=re.M)
    intro = parts[0].strip("\n")
    d = {parts[i]: parts[i + 1].strip("\n") for i in range(1, len(parts), 2)}
    return intro, d


def tag_items(text, tag_html):
    """Prefix each top-level bullet with a visible tag."""
    return re.sub(r"^- ", "- " + tag_html + " ", text, flags=re.M)


def tbl_rows(text):
    return [split_row(l) for l in text.split("\n") if l.startswith("|")]


# ---------------------------------------------------------------- classifier: what the stop is
CLASSES = [
    ("walk", "Walk: on foot, trail or town", 3),
    ("fly", "Fly: a domestic or international flight", 1),
    ("drive", "Drive: car, bus or transfer", 4),
    ("book", "Book: a timed or paid slot you must hold", 5),
    ("rest", "Rest: check-in, meals, sleep", 6),
]
SLOT = {k: s for k, _, s in CLASSES}
LEGEND = '<div class="legend">' + "".join(
    f'<span><i class="b" style="background:var(--class-{sl})"></i>{n}</span>' for _, n, sl in CLASSES) + "</div>"


def mark(kind):
    return f'<span class="mark mark--{SLOT[kind]}" title="{kind}"></span>'


def classify(chip, title, body):
    t = title
    if chip.startswith("Evening"):
        return "rest"
    if re.search(r"^(Fly|Flight)\b", t):
        return "fly"
    if re.search(r"Catamaran|Piratour departs|Teatro Colon|Tango dinner|Shuttle|Tren del Fin", t):
        return "book"
    if re.search(r"\bDrive\b|Bus or remis", t):
        return "drive"
    if re.search(r"Check in|Check out|Lunch|dinner|Evening|Sleep|Pack|Back in|Early dinner|Leave the lodging|Pick one", t + chip) or chip.startswith("Evening"):
        return "rest"
    return "walk"


# ---------------------------------------------------------------- day configuration (map queries are place names only)
AR = ", Argentina"
DAYCFG = {
    1: dict(base="Buenos Aires", route="Toronto (YYZ) to Buenos Aires (EZE), then Recoleta", place="Cementerio de la Recoleta, Buenos Aires" + AR, z=13,
            stats=[("Thu 25 Feb", "YYZ departure, evening"), ("14:30-16:30", "Recoleta"), ("27 C / 20 C", "Feb high / low"), ("9", "wet days in Feb")],
            maps=[("Ateneo", "El Ateneo Grand Splendid, Santa Fe 1860, Buenos Aires" + AR), ("Recoleta", "Cementerio de la Recoleta, Buenos Aires" + AR)]),
    2: dict(base="Ushuaia", route="Buenos Aires (AEP) to Ushuaia, then the Beagle Channel", place="Ushuaia, Tierra del Fuego" + AR, z=12,
            stats=[("3h30-3h50", "flight"), ("15 kg", "checked bag"), ("2.5-3.5 h", "catamaran"), ("ARS 136,000", "+ ARS 10,400 port charge, cash")],
            maps=[("Catamaran", "Faro Les Eclaireurs, Ushuaia, Tierra del Fuego" + AR), ("Airport", "Aeropuerto Internacional Malvinas Argentinas, Ushuaia" + AR)]),
    3: dict(base="Ushuaia", route="Ushuaia, Estancia Harberton, Isla Martillo", place="Isla Martillo, Tierra del Fuego" + AR, z=10,
            stats=[("14:00", "Piratour departs"), ("about 6 h", "trip"), ("about 90 km", "bus to Harberton"), ("about 1 h", "walking on the island")],
            maps=[("Harberton", "Estancia Harberton, Tierra del Fuego" + AR), ("Martillo", "Isla Martillo, Tierra del Fuego" + AR)],
            dirs=["Ushuaia, Tierra del Fuego" + AR, "Estancia Harberton, Tierra del Fuego" + AR]),
    4: dict(base="Ushuaia", route="Ensenada Zaratiegui to Alakush, then Lapataia", place="Senda Costera, Parque Nacional Tierra del Fuego" + AR, z=11,
            stats=[("8 km / 5 mi", "Senda Costera, one way"), ("70 m", "gain"), ("4 h", "Senda Costera"), ("ARS 40,000", "foreigner daily pass")],
            maps=[("Zaratiegui", "Ensenada Zaratiegui, Parque Nacional Tierra del Fuego" + AR), ("Alakush", "Centro de Visitantes Alakush, Parque Nacional Tierra del Fuego" + AR),
                  ("Lapataia", "Bahia Lapataia, Parque Nacional Tierra del Fuego" + AR), ("Tren", "Tren del Fin del Mundo, Ushuaia, Tierra del Fuego" + AR),
                  ("Guanaco", "Cerro Guanaco, Parque Nacional Tierra del Fuego" + AR)],
            dirs=["Ensenada Zaratiegui, Parque Nacional Tierra del Fuego" + AR, "Centro de Visitantes Alakush, Parque Nacional Tierra del Fuego" + AR, "Bahia Lapataia, Parque Nacional Tierra del Fuego" + AR]),
    5: dict(base="Ushuaia", route="Ruta 3 northeast to Laguna Esmeralda and back", place="Laguna Esmeralda, Ushuaia, Tierra del Fuego" + AR, z=11,
            stats=[("9 km / 5.6 mi", "round trip"), ("100-214 m", "gain"), ("4-5 h", "walking"), ("09:00", "shuttle")],
            maps=[("Esmeralda", "Laguna Esmeralda, Ushuaia, Tierra del Fuego" + AR)]),
    6: dict(base="El Chalten", route="Ushuaia to El Calafate by air, then RN40 and RP23 to El Chalten", place="El Chalten, Santa Cruz" + AR, z=10,
            stats=[("215 km", "Calafate to Chalten"), ("2h45-3h30", "drive"), ("2.5-3 km", "Condores, round trip"), ("20:42", "sunset")],
            maps=[("Calafate", "El Calafate, Santa Cruz" + AR), ("Visitor centre", "Centro de Visitantes Los Glaciares, El Chalten, Santa Cruz" + AR),
                  ("Condores", "Mirador de los Condores, El Chalten, Santa Cruz" + AR)],
            dirs=["El Calafate Airport", "El Calafate", "El Chalten"]),
    7: dict(base="El Chalten", route="Calle Riquelme to Laguna Torre and back", place="Laguna Torre, El Chalten, Santa Cruz" + AR, z=12,
            stats=[("17.8-20.1 km", "round trip"), ("240-520 m", "gain"), ("5-8 h", "walking"), ("660 m", "maximum altitude")],
            maps=[("Trailhead", "Calle Riquelme, El Chalten, Santa Cruz" + AR), ("Mirador Torre", "Mirador Torre, El Chalten, Santa Cruz" + AR),
                  ("Laguna Torre", "Laguna Torre, El Chalten, Santa Cruz" + AR)]),
    8: dict(base="El Chalten", route="Av. San Martin north end to Laguna de los Tres, back via Laguna Capri", place="Laguna de los Tres, El Chalten, Santa Cruz" + AR, z=12,
            stats=[("20.9-22 km", "round trip"), ("800-1,100 m", "gain"), ("7-10 h", "walking"), ("11:00", "Poincenot turnaround")],
            maps=[("Poincenot", "Campamento Poincenot, El Chalten, Santa Cruz" + AR), ("Laguna de los Tres", "Laguna de los Tres, El Chalten, Santa Cruz" + AR),
                  ("Laguna Capri", "Laguna Capri, El Chalten, Santa Cruz" + AR)]),
    9: dict(base="El Chalten", route="Spare day: pick from the ranked options", place="El Chalten, Santa Cruz" + AR, z=11,
            stats=[("5-6 km", "Condores + Aguilas"), ("18.8-20.9 km", "Pliegue Tumbado"), ("7.5 h", "Lago del Desierto trip"), ("about 4 h", "Viedma boat")],
            maps=[("Condores", "Mirador de los Condores, El Chalten, Santa Cruz" + AR), ("Aguilas", "Mirador de las Aguilas, El Chalten, Santa Cruz" + AR),
                  ("Lago del Desierto", "Lago del Desierto, Santa Cruz" + AR), ("Pliegue Tumbado", "Loma del Pliegue Tumbado, El Chalten, Santa Cruz" + AR)]),
    10: dict(base="El Calafate", route="Chorrillo del Salto, RN40 to El Calafate, Laguna Nimez", place="Reserva Laguna Nimez, El Calafate, Santa Cruz" + AR, z=11,
             stats=[("6.4-7 km", "Chorrillo, round trip"), ("20-30 m", "gain"), ("215 km", "drive"), ("about 3 km", "Laguna Nimez loop")],
             maps=[("Chorrillo", "Chorrillo del Salto, El Chalten, Santa Cruz" + AR), ("Nimez", "Reserva Laguna Nimez, El Calafate, Santa Cruz" + AR),
                   ("Glaciarium", "Glaciarium, El Calafate, Santa Cruz" + AR)],
             dirs=["El Chalten", "El Calafate"]),
    11: dict(base="El Calafate", route="El Calafate to Perito Moreno and back", place="Glaciar Perito Moreno pasarelas, El Calafate, Santa Cruz" + AR, z=10,
             stats=[("about 80 km", "to the glacier"), ("1h15-1h30", "drive"), ("ages 8-65", "minitrekking"), ("9-9.5 h", "minitrekking day")],
             maps=[("Walkways", "Glaciar Perito Moreno pasarelas, El Calafate, Santa Cruz" + AR), ("Puerto Bajo las Sombras", "Puerto Bajo las Sombras, Parque Nacional Los Glaciares" + AR)],
             dirs=["El Calafate", "Glaciar Perito Moreno pasarelas"]),
    12: dict(base="Buenos Aires", route="El Calafate (FTE) to Buenos Aires (AEP)", place="Aeropuerto Internacional El Calafate" + AR, z=11,
             stats=[("3h15-3h20", "flight"), ("morning or midday", "flight to choose"), ("Wed 10 Mar", "buffer day")],
             maps=[("Airport", "Aeropuerto Internacional El Calafate" + AR), ("Palermo", "Palermo, Buenos Aires" + AR), ("Recoleta", "Recoleta, Buenos Aires" + AR)]),
    13: dict(base="Buenos Aires", route="La Boca, Teatro Colon, tango dinner", place="Teatro Colon, Buenos Aires" + AR, z=13,
             stats=[("50 min", "Teatro Colon tour"), ("ARS 34,000", "tour, under 7 free"), ("12:00", "English tour"), ("20:00", "tango dinner")],
             maps=[("La Boca", "Caminito, La Boca, Buenos Aires" + AR), ("Teatro Colon", "Teatro Colon, Buenos Aires" + AR),
                   ("Jardin Japones", "Jardin Japones, Buenos Aires" + AR), ("Museo Evita", "Museo Evita, Buenos Aires" + AR),
                   ("Planetario", "Planetario Galileo Galilei, Buenos Aires" + AR)]),
    14: dict(base="home", route="Buenos Aires (EZE) to Toronto (YYZ)", place="Aeropuerto Internacional Ministro Pistarini, Ezeiza" + AR, z=10,
             stats=[("about 08:55", "EZE departure, 2018 pattern"), ("about 19:00", "YYZ arrival"), ("about 05:00-05:30", "leave the hotel")],
             maps=[("Ezeiza", "Aeropuerto Internacional Ministro Pistarini, Ezeiza" + AR)]),
}

# per-stop map: (regex on chip+title+body-start, label key into DAYCFG maps or a raw place)
STOPMAP = {
    1: [(r"Recoleta", 1), (r"Ateneo", 0)],
    2: [(r"Catamaran", 0), (r"Fly", 1)],
    3: [(r"Back in", None), (r"Piratour", 1)],
    4: [(r"Bus or remis", 0), (r"Senda Costera|Zaratiegui to Alakush", 0), (r"Lunch|Alakush", 1), (r"Lapataia", 2), (r"Tren", 3), (r"Guanaco", 4)],
    5: [(r"Shuttle", 0)],
    6: [(r"Calafate town", 0), (r"Drive", 0), (r"visitor centre", 1), (r"Condores", 2)],
    7: [(r"Leave the lodging|On the trail|Back the same way", 0), (r"Mirador Torre", 1), (r"lagoon|Lunch", 2)],
    8: [(r"Start", 0), (r"Poincenot", 0), (r"final 2.4", 1), (r"At the lake", 1), (r"Laguna Capri", 2)],
    10: [(r"Chorrillo", 0), (r"Nimez", 1), (r"Glaciarium", 2)],
    11: [],
    13: [(r"La Boca", 0), (r"Teatro", 1), (r"Pick one", 2), (r"Tango", None)],
}
STOPPLACE_OVERRIDE = {
    (3, "Back in"): "Ushuaia, Tierra del Fuego" + AR,
    (6, "Drive"): None,
    (13, "Tango"): "Tango Porteno, Buenos Aires" + AR,
    (3, "Morning"): "Ushuaia, Tierra del Fuego" + AR,
    (5, "Evening"): "Ushuaia, Tierra del Fuego" + AR,
    (10, "Drive"): "El Calafate, Santa Cruz" + AR,
    (10, "Check out"): "El Chalten, Santa Cruz" + AR,
    (10, "Check in"): "El Calafate, Santa Cruz" + AR,
    (12, "Evening"): "Palermo, Buenos Aires" + AR,
}
TITLE_OVERRIDE = {
    (11, "Morning"): ("Getting to the glacier", None),
    (12, "Morning"): ("Morning in El Calafate", None),
}
# marks that the heuristic gets wrong
MARK_OVERRIDE = {
    (2, "Morning"): "fly",
    (3, "Morning"): "rest",
    (3, "Piratour"): "book",
    (4, "Bus or remis"): "drive",
    (5, "Shuttle"): "book",
    (6, "Drive"): "drive",
    (6, "Calafate town"): "drive",
    (7, "Leave"): "walk",
    (7, "On the trail"): "walk",
    (12, "Morning"): "walk",
    (1, "Evening"): "rest",
    (13, "Pick one"): "walk",
}


# ---------------------------------------------------------------- day parser
CHIP = re.compile(r"^\*\*((?:About |By )?\d\d:\d\d[^*]*|Morning[^*]*|Evening[^*]*|Afternoon[^*]*)\*\*\s*(.*)$")
CHIP_SPLIT = re.compile(r"(?=\*\*(?:About |By )?\d\d:\d\d[^*]*\*\*)")


def first_sentence(text):
    text = text.strip().replace("Av. ", "Av.\u00a0")
    m = re.match(r"^(.*?)(?:(?<=[A-Za-z0-9\)])\. |: |:$|\.$)", text)
    title = m.group(1) if m else text
    rest = text[len(title):].lstrip(" .:")
    title, rest = title.replace("\u00a0", " "), rest.replace("\u00a0", " ")
    if len(title) > 110:
        depth, cutat = 0, None
        for ci, ch in enumerate(title[:110]):
            depth += ch == "("
            depth -= ch == ")"
            if depth == 0 and ch in ";,":
                cutat = ci
                break
        if cutat is None:
            pi = title.find(" (")
            cutat = pi if 0 < pi < 110 else None
        if cutat is not None:
            title, rest = title[:cutat], text[cutat + 1:].strip()
    return title.strip(), rest.strip()


def stat_tokens(*texts):
    seen, out = [], []
    for t in texts:
        for m in re.finditer(r"(?<![\w:.-])(\d[\d.,]*(?:-\d[\d.,]*)?) ?(km)\b(?![\w])", re.sub(r"\*\*", "", t)):
            v = f"{m.group(1)} {m.group(2)}"
            if v not in seen:
                seen.append(v)
    return seen[:4]


def parse_day(n, text):
    lines = text.split("\n")
    meta_rows, pre, bullets, post = [], [], [], []
    i = 0
    # leading blocks until the first top-level bullet
    state = "pre"
    pre_lines, bullet_lines = [], []
    while i < len(lines):
        l = lines[i]
        if BULLET.match(l) and not l.startswith(" "):
            state = "bul"
        (pre_lines if state == "pre" else bullet_lines).append(l)
        i += 1
    # kv table
    pre_txt = "\n".join(pre_lines)
    m = re.search(r"((?:^\|.*\n?)+)", pre_txt, flags=re.M)
    kv_html = ""
    if m and tbl_rows(m.group(1)) and all(not c for c in tbl_rows(m.group(1))[0]):
        kv_html = table_html(tbl_rows(m.group(1)))
        pre_txt = pre_txt.replace(m.group(1), "")
    # bullet groups with nested content
    items, k = [], 0
    bl = bullet_lines
    while k < len(bl):
        if BULLET.match(bl[k]) and not bl[k].startswith(" "):
            kids, k2 = gather_item(bl, k, 2)
            items.append((bl[k][2:], kids))
            k = k2
        else:
            k += 1
    stops, rest = [], []
    for first, kids in items:
        segs = [s for s in CHIP_SPLIT.split(first) if s.strip()] if CHIP.match(first) else [first]
        if CHIP.match(first):
            for si, seg in enumerate(segs):
                cm = CHIP.match(seg.strip())
                if not cm:
                    continue
                stops.append(dict(chip=cm.group(1).strip(" ."), text=cm.group(2).strip(), kids=kids if si == len(segs) - 1 else [], opt="optional" in cm.group(1).lower()))
        elif re.match(r"^\*\*(Optional|[^*]*\(added)", first) or re.match(r"^\*\*[^*]*\*\*\s*\(added", first):
            cm = re.match(r"^\*\*([^*]+)\*\*\s*(.*)$", first)
            bold, tail = cm.group(1).strip(" ."), cm.group(2).strip()
            if ": " in bold:
                left, right = bold.split(": ", 1)
                txt = right + (" (added)" if "(added)" in left else "")
                if left.startswith("Optional for "):
                    txt = right + ". " + left[len("Optional "):].capitalize() + "."
            else:
                txt = bold + (" " + tail if tail else "")
            if ": " in bold and tail:
                txt = txt + " " + tail
            stops.append(dict(chip="Optional", text=txt, kids=kids, opt=True))
        else:
            rest.append((first, kids))
    return kv_html, pre_txt.strip(), stops, rest


def day_stop_html(n, idx, s, cfg):
    chip, txt = s["chip"], s["text"]
    title, body = first_sentence(txt)
    for (dn, key), (tt, whole) in TITLE_OVERRIDE.items():
        if dn == n and chip.startswith(key):
            title, body = tt, txt
    kind = None
    for (dn, key), v in MARK_OVERRIDE.items():
        if dn == n and (title.startswith(key) or chip.startswith(key) or key in title[:40]):
            kind = v
            break
    if kind is None:
        kind = classify(chip, title, body)
    if s["opt"] and kind in ("walk", "rest"):
        kind = "book" if re.search(r"Tren", title) else kind
    # map
    place, route = cfg["place"], None
    ml = cfg.get("maps", [])
    for rx, ix in STOPMAP.get(n, []):
        if re.search(rx, chip + " " + title + " " + body[:80]):
            if ix is None:
                for (dn, key), v in STOPPLACE_OVERRIDE.items():
                    if dn == n and (key in title or key in chip):
                        place = v or place
            else:
                place = ml[ix][1]
            break
    for (dn, key), v in STOPPLACE_OVERRIDE.items():
        if dn == n and (title.startswith(key) or chip.startswith(key)) and v:
            place = v
    btns = [f'<a class="btn primary" href="{esc(mapq(place))}">Map</a>']
    if re.match(r"Drive", title) and n == 6:
        btns.append(f'<a class="btn" href="{esc(dirq("El Calafate Airport", "El Calafate", "El Chalten"))}">Route</a>')
    if re.match(r"Drive", title) and n == 10:
        btns.append(f'<a class="btn" href="{esc(dirq("El Chalten", "El Calafate"))}">Route</a>')
    tagh = ""
    ttl = inline(title)
    time = f'<span class="time{" opt" if s["opt"] else ""}">{esc(chip)}</span>'
    toks = stat_tokens(title, body, "\n".join(s["kids"]))
    stats = '<div class="stats">' + "".join(f"<span><b>{esc(t)}</b></span>" for t in toks) + "</div>" if toks else ""
    bodyh = f"<p>{inline(body)}</p>" if body else ""
    kidsh = md("\n".join(s["kids"])) if s["kids"] else ""
    return (f'<div class="stop"><span class="mark mark--{SLOT[kind]}" title="{kind}"></span><div class="card"><div class="split noimg">'
            f'<div class="content">{time}<h3>{ttl}{tagh}</h3>{bodyh}{kidsh}{stats}<div class="links">{"".join(btns)}</div></div></div></div></div>')


DAYHEAD = {int(m.group(1)): (m.group(2), m.group(3)) for m in re.finditer(r"^### Day (\d+), ([A-Za-z]+ \d+ [A-Za-z]+): (.+)$", PLAN, flags=re.M)}


def day_text(n):
    lines = PLAN.split("\n")
    start = next(i for i, l in enumerate(lines) if re.match(rf"^### Day {n}, ", l))
    out = []
    for l in lines[start + 1:]:
        if re.match(r"^(#{1,3}) ", l) or l.strip() == "---":
            break
        out.append(l)
    return "\n".join(out).strip("\n")


def day_html(n):
    date, title = DAYHEAD[n]
    cfg = DAYCFG[n]
    dow, num, mon = date.split()
    kv, pre, stops, rest = parse_day(n, day_text(n))
    stats = '<div class="daystats">' + "".join(f"<div><b>{esc(a)}</b><span>{esc(b)}</span></div>" for a, b in cfg["stats"]) + "</div>"
    light = re.search(r"\|\s*Light\s*\|\s*([^|]+)\|", day_text(n))
    lm = light or re.search(r"\*\*Light:\*\*\s*(.*)", day_text(n)) or re.search(r"(Sunrise [0-9:]+)", day_text(n))
    lightt = lm.group(1).strip()
    meta = f'<div class="daymeta"><span>Base <b>{esc(cfg["base"])}</b></span>' + ("" if "Light" in kv else f'<span>Light <b>{inline(lightt)}</b></span>') + "</div>"
    prehtml = md(pre) if pre else ""
    stops_html = "".join(day_stop_html(n, i, s, cfg) for i, s in enumerate(stops))
    trail = f'<div class="trail">{stops_html}</div>' if stops_html else ""
    items = []
    for first, kids in rest:
        items.append("<li>" + inline(first) + (md("\n".join(kids)) if kids else "") + "</li>")
    more_title = "Plan B, decision rule and notes" if stops else "Notes"
    if rest and not stops:
        resthtml = f'<ul class="plainlist">{"".join(items)}</ul>'
    elif rest:
        resthtml = f'<details class="more"><summary>{more_title}</summary><ul class="plainlist">{"".join(items)}</ul></details>'
    else:
        resthtml = ""
    mapbtns = "".join(f'<a class="btn" href="{esc(mapq(p))}">Map: {esc(l)}</a>' for l, p in cfg["maps"])
    if cfg.get("dirs"):
        mapbtns += f'<a class="btn primary" href="{esc(dirq(*cfg["dirs"]))}">Route for the day</a>'
    legend = ""
    return f"""
<section class="day" id="d{n}">
  <div class="sign">
    <div class="date"><span class="dow">{dow}</span><span class="num">{num}</span></div>
    <div class="body"><h2>Day {n}: {inline(title)}</h2><p class="route">{esc(date)} &middot; {esc(cfg['route'])}</p></div>
  </div>
  {meta}
  {stats}
  {kv}
  {prehtml}
  {trail}
  {resthtml}
  <div class="links daylinks">{mapbtns}</div>
  <div class="mapframe"><iframe loading="lazy" title="{esc(cfg['place'])}" src="{esc(embed(cfg['place'], cfg['z']))}"></iframe>
    <div class="bar"><span>{esc(cfg['place'])}</span><a href="{esc(mapq(cfg['place']))}">Open in Maps</a></div></div>
  {legend}
</section>"""


# ---------------------------------------------------------------- page sections
top_paras = [p for p in PLAN.split("\n\n")[1:3]]
WARN = f"""
<section class="intro" id="warn">
  <p class="lead lead-top">{inline(top_paras[0].strip())}</p>
  <div class="warnbar">{inline(top_paras[1].strip())}</div>
</section>"""

# ---- orientation
ori = sec("Orientation")
ori_intro, ori_subs = subs(ori)
sub_rows = tbl_rows(ori_subs["Sub-regions"])[2:]
AREA_KEYS = ["buenos-aires", "ushuaia", "el-chalten", "el-calafate"]
areas_html = "".join(
    f'<div class="area">{photo_block(AREA_KEYS[i], r[0])}<div class="ab"><h3>{inline(r[0].split(" (")[0])}</h3>'
    f'<p class="days">Days {esc(r[2])}</p><p>{inline(r[1])}</p><p class="areanote">{inline(r[0]) if "(" in r[0] else ""}</p></div></div>'
    for i, r in enumerate(sub_rows))
NUMS = [("13", "nights, 4 bases (BA twice)"), ("2 + 3", "international + domestic flights"), ("~630 km", "driven (inference)"),
        ("20.9-22 km", "longest hike, Laguna de los Tres, 800-1,100 m"), ("80-86 km", "on foot, base plan, 1,700-2,600 m ascent"),
        ("~54.8 S", "southernmost point, Bahia Lapataia"), ("13.9 to 12.8 h", "daylight, Ushuaia 26 Feb to Chalten 11 Mar")]
numstrip = '<div class="numstrip numstrip7">' + "".join(f"<div><b>{a}</b><span>{esc(b)}</span></div>" for a, b in NUMS) + "</div>"
know = [re.sub(r"^\d+\. ", "", l) for l in ori_subs["What to know before reading the days"].split("\n") if re.match(r"^\d+\. ", l)]
know_html = '<ul class="know">' + "".join(f"<li><b>{i + 1}</b><span>{inline(t)}</span></li>" for i, t in enumerate(know)) + "</ul>"
nums_raw = ori_subs["The trip in numbers"]

ORIENT = f"""
<section class="intro" id="orient">
  <p class="kick">Before the days start</p>
  <h2>What this place physically is</h2>
  <div class="lead lead-wide">{md(ori_intro)}</div>
  <h3 class="subh">Sub-regions</h3>
  <div class="areas">{areas_html}</div>
  <h3 class="subh">The trip in numbers</h3>
  {numstrip}
  <details class="more bigmore"><summary>Numbers as written in the plan</summary>{md(nums_raw)}</details>
  <h3 class="subh">What to know before reading the days</h3>
  {know_html}
</section>"""

# ---- answer first
ans_intro, ans = subs(sec("The answer first: what changed from the video"))
rd_intro, rd = subs(sec("Recommended dates"))
torres_title = "Torres del Paine: NO"
torres_body = sec("Torres del Paine: NO", 3) if False else rd[torres_title]

ANSWER = f"""
<section class="intro" id="answer">
  <p class="kick">The answer first</p>
  <h2>What changed from the video</h2>
  <div class="lead lead-wide">{md(ans_intro)}</div>
  <h3 class="subh">Video claims against the research</h3>
  {md(ans["Video claims against the research"])}
  <h3 class="subh">Corrections to the research files</h3>
  {md(ans["Corrections to the research files"])}
  <div class="grid2 addcut">
    <div class="panel"><h3><span class="tag tag--added">added</span> Added (veto any of these)</h3>{md(re.sub(r"^- ", "- (added) ", ans["Added (veto any of these)"], flags=re.M))}</div>
    <div class="panel"><h3><span class="tag tag--cut">cut</span> Cut, or not in the base plan</h3>{md(ans["Cut, or not in the base plan"])}</div>
  </div>
  <div class="panel norbox" id="torres">
    <h3><span class="tag tag--unmissable">no</span> {esc(torres_title)}</h3>
    {md(torres_body)}
  </div>
</section>"""

# ---- dates
rd_body = {k: v for k, v in rd.items() if k != torres_title}
DATES = f"""
<section class="intro" id="dates">
  <p class="kick">When</p>
  <h2>Recommended dates</h2>
  <div class="lead lead-wide">{md(rd_intro)}</div>
  <h3 class="subh">Why this window and not the others</h3>
  {md(rd_body["Why this window and not the others"])}
  <h3 class="subh">Daylight</h3>
  <p class="smallnote">research-sun.md, computed, UTC-3.</p>
  {md(rd_body["Daylight (research-sun.md, computed, INFERENCE, UTC-3)"])}
</section>"""

# ---- night split and route
ns = sec("Night split")
rt_intro, rt = subs(sec("Route order: why Ushuaia first"))
SPLIT = f"""
<section class="intro" id="split">
  <p class="kick">Where you sleep</p>
  <h2>Night split and route order</h2>
  {md(ns)}
  <h3 class="subh">Route order: why Ushuaia first</h3>
  {md(rt_intro)}
</section>"""

# ---- flights
fl_intro, fl = subs(sec("Domestic flights"))
FLIGHTS = f"""
<section class="intro" id="flights">
  <p class="kick">In the air</p>
  <h2>Domestic flights, baggage and the wind buffer</h2>
  {md(fl_intro)}
  <h3 class="subh">The baggage trap</h3>
  {md(fl["The baggage trap"])}
  <h3 class="subh">Wind-delay buffer rule</h3>
  {md(fl["Wind-delay buffer rule"])}
</section>"""

GROUND = f"""
<section class="intro" id="ground">
  <p class="kick">On the ground</p>
  <h2>Ground transport: rental car or buses</h2>
  {md(sec("Ground transport: rental car or buses"))}
</section>"""

# ---- sights
sights_text = sec("Must-do sights (ranked)")
cards = []
tail = []
for l in sights_text.split("\n"):
    m = re.match(r"^(\d+)\. \*\*(.+?)\*\*(.*?)\[Map\]\((.+?)\)\s*$", l)
    if m:
        rank, title, mid, url = m.groups()
        mid = mid.strip()
        midh = dayrefs(inline(mid)) if mid else ""
        midh = re.sub(r"(</span>)\.\s", r"\1 ", midh, count=1)
        cards.append(f'<article class="sg"><h4><span class="rank">{rank}</span><span>{inline(title.rstrip("."))}</span></h4>'
                     f'<p>{midh}</p><div class="links"><a class="btn primary" href="{esc(url)}">Map</a></div></article>')
    elif l.strip() and not re.match(r"^\d+\. ", l):
        tail.append(l)
assert len(cards) == 22, len(cards)
SIGHTS = f"""
<section class="intro" id="sights">
  <p class="kick">What to see</p>
  <h2>Must-do sights, ranked</h2>
  <div class="sgrid">{"".join(cards)}</div>
  {md(chr(10).join(tail))}
</section>"""

# ---- trails
tr = sec("Trails")
tr_pre, tr_rest = tr.split("| Trail | Base", 1)
tr_tab = "| Trail | Base" + tr_rest.split("\n### ", 1)[0]
tr_post = "### " + tr_rest.split("\n### ", 1)[1]
rows = tbl_rows(tr_tab)
head, body = rows[0], rows[2:]
assert len(body) == 22 and len(head) == 11, (len(body), len(head))


def linkcell(c, label=None):
    m = re.search(r"\[([^\]]+)\]\((https?://[^)]+)\)", c)
    if m:
        return m.group(2), m.group(1)
    return None, c


def trail_table():
    h = "".join(f"<th>{inline(c)}</th>" for c in head[:8]) + "<th>Map</th>"
    trs = []
    for r in body:
        cells = []
        for i, c in enumerate(r[:8]):
            x = inline(c)
            if i == 6:
                plain = c.strip()
                k = "yes" if plain.startswith("Yes") else "unk" if plain.startswith("GAP") else "cond"
                x = f'<span class="ok11 ok11--{k}">{x}</span>'
            cells.append(f"<td>{x}</td>")
        mu, _ = linkcell(r[8])
        au, _ = linkcell(r[9])
        ou, ol = linkcell(r[10])
        b = f'<a class="btn primary" href="{esc(mu)}">Map</a>' if mu else ""
        cells.append(f'<td class="lk">{b}</td>')
        trs.append("<tr>" + "".join(cells) + "</tr>")
    return f'<div class="tw"><table class="c9 trailtab"><tr>{h}</tr>{"".join(trs)}</table></div>'


def trail_card(r):
    name, base, km, gain, time_, diff, ok, alt, mp, at, off = r
    plain = ok.strip()
    k = "yes" if plain.startswith("Yes") else "unk" if plain.startswith("GAP") else "cond"
    mu, _ = linkcell(mp)
    au, _ = linkcell(at)
    ou, ol = linkcell(off)
    btns = f'<a class="btn primary" href="{esc(mu)}">Map</a>'
    btns += f'<a class="btn" href="{esc(au)}">AllTrails search</a>' if au else '<span class="inf gap">no AllTrails link</span>'
    btns += f'<a class="btn" href="{esc(ou)}">Official: {esc(ol)}</a>' if ou else f'<span class="inf gap">no official link</span>'
    notplan = '<span class="tag tag--hidden">not in plan</span>' if "not in plan" in name else ""
    return f"""<article class="tc">
  <h4><span>{inline(name)}</span> {notplan}</h4>
  <p class="meta">{inline(base)} &middot; {inline(diff)}</p>
  <div class="stats"><span><b>{inline(km)}</b></span><span><b>{inline(gain)}</b> gain</span><span><b>{inline(time_)}</b></span></div>
  <p class="child"><span class="ok11 ok11--{k}">11-year-old: {inline(ok)}</span></p>
  <p class="alt"><b>Alternative.</b> {inline(alt)}</p>
  <div class="links">{btns}</div>
</article>"""


groups = [("El Chalten", "El Chalten"), ("El Calafate", "El Calafate"), ("Ushuaia", "Ushuaia"), ("Chile", "Chile (Torres del Paine, not in plan)")]
cards_html = ""
for key, label in groups:
    rs = [r for r in body if r[1].startswith(key)]
    cards_html += f'<h3 class="subh parkh">{esc(label)} <span class="inf">{len(rs)}</span></h3><div class="tgrid">{"".join(trail_card(r) for r in rs)}</div>'
assert sum(1 for k, _ in groups for r in body if r[1].startswith(k)) == 22

TRAILS = f"""
<section class="intro" id="trails">
  <p class="kick">On foot</p>
  <h2>Trail list</h2>
  {md(tr_pre)}
  <h3 class="subh">The table</h3>
  {trail_table()}
  <h3 class="subh">The cards</h3>
  {cards_html}
  {md(tr_post)}
</section>"""

# ---- bookings
bk_intro_tbl = sec("Bookings and deadlines")
bk_pre, bk_rest = bk_intro_tbl.split("| # | Item", 1)
bk_tab = "| # | Item" + bk_rest.split("\n\n**Why the 7-day Flexipass.**", 1)[0]
bk_post = "**Why the 7-day Flexipass.**" + bk_rest.split("\n\n**Why the 7-day Flexipass.**", 1)[1]
bk_post = bk_post.replace("### If you do ONE thing this week", "### If you do ONE thing this week")
BOOKINGS = f"""
<section class="intro" id="bookings">
  <p class="kick">When to book</p>
  <h2>Bookings and deadlines</h2>
  {md(bk_pre)}
  {md(bk_tab)}
  {md(bk_post)}
</section>"""

ADV = f"""
<section class="intro" id="adventures">
  <p class="kick">Beyond walking</p>
  <h2>Adventures and their limits</h2>
  {md(sec("Adventures"), badgecol=5)}
</section>"""

# ---- days
rule_intro = sec("Days 7-9: El Chalten, the three weather-sorted days", 3) if False else None
lines_all = PLAN.split("\n")
si = next(i for i, l in enumerate(lines_all) if l.startswith("### Days 7-9"))
ei = next(i for i in range(si + 1, len(lines_all)) if lines_all[i].startswith("### Day "))
RULE_TEXT = "\n".join(lines_all[si + 1:ei])
how_intro = sec("Day by day").split("\n### ", 1)[0]

DAYNAV = '<nav class="daynav" aria-label="Days"><div class="wrap">' + "".join(
    f'<a href="#d{n}"><span class="d">{DAYHEAD[n][0].split()[0]} {DAYHEAD[n][0].split()[1]}</span>Day {n}</a>' for n in range(1, 15)) + "</div></nav>"

DAYS = f"""
<section class="intro" id="days">
  <p class="kick">Fourteen days</p>
  <h2>Day by day</h2>
  {md(how_intro)}
  {LEGEND}
  <p class="smallnote">Marks run down the left of each day. Plan B, decision rules and notes are folded under each day.</p>
</section>
<div id="daywrap">
{DAYNAV}
{day_html(1)}{day_html(2)}{day_html(3)}{day_html(4)}{day_html(5)}{day_html(6)}
<section class="intro rulebox" id="chalten-rule">
  <p class="kick">Days 7-9</p>
  <h2>El Chalten: the three weather-sorted days</h2>
  {md(RULE_TEXT)}
</section>
{day_html(7)}{day_html(8)}{day_html(9)}{day_html(10)}{day_html(11)}{day_html(12)}{day_html(13)}{day_html(14)}
</div>"""

# ---- stay, budget, hazards ...
STAY = f"""
<section class="intro" id="stay">
  <p class="kick">Where to stay</p>
  <h2>Where to stay</h2>
  {md(sec("Where to stay"))}
</section>
<section class="intro" id="budget">
  <p class="kick">Money</p>
  <h2>Budget</h2>
  {md(sec("Budget"))}
</section>"""

state_txt = sec("State of knowledge").replace("**Verified (2026 sources, used as a pattern)**", "**VERIFIED (2026 sources, used as a pattern)**")
REST = f"""
<section class="intro" id="hazards">
  <p class="kick">Risk</p>
  <h2>Hazards</h2>
  {md(sec("Hazards"))}
</section>
<section class="intro" id="gotchas">
  <p class="kick">Read before booking</p>
  <h2>Gotchas</h2>
  {md(sec("Gotchas"))}
</section>
<section class="intro" id="entry">
  <p class="kick">Paperwork</p>
  <h2>Entry and documents (Canadian citizens)</h2>
  {md(sec("Entry and documents (Canadian citizens)"))}
</section>
<section class="intro" id="issues">
  <p class="kick">Known issues</p>
  <h2>Known issues</h2>
  {md(sec("Known issues"))}
</section>
<section class="intro" id="state">
  <p class="kick">Honest</p>
  <h2>State of knowledge</h2>
  {md(state_txt)}
</section>
<section class="intro" id="questions">
  <p class="kick">For you</p>
  <h2>Open questions</h2>
  {md(sec("Open questions for you"))}
</section>
<section class="intro" id="photoplaces">
  <p class="kick">Photos</p>
  <h2>Photo places</h2>
  <p class="smallnote">The list the gallery is built from (gallery.json, injected after the trail list).</p>
  {md(sec("Photo places (for gallery.json)"))}
</section>
<section class="intro" id="changelog">
  <h2>Change log</h2>
  {md(sec("Change log"))}
</section>"""

# ---- day-of links and checklist
QUICK = """
<section class="quick" id="quick">
  <h2>Day-of links</h2>
  <p class="qsub">The handful actually tapped in the field</p>
  <div class="qgrid">
    <div class="qcard"><h4><span class="dot" style="background:var(--class-5)"></span>Tickets</h4>
      <a href="https://ventaweb.apn.gob.ar"><b>Park tickets (APN)</b>Los Glaciares, Tierra del Fuego, Flexipass. QR must be saved offline</a>
      <a href="https://www.argentina.gob.ar/parquesnacionales/losglaciares"><b>Los Glaciares, APN</b>Park page for the Chalten and glacier sectors</a>
      <a href="https://www.argentina.gob.ar/senderos-del-parque-nacional-tierra-del-fuego"><b>Tierra del Fuego trails, APN</b>Official trail table</a>
    </div>
    <div class="qcard"><h4><span class="dot" style="background:var(--class-3)"></span>Maps and conditions</h4>
      <a href="https://argentina.gob.ar/sites/default/files/2019/06/mapa_pasarelas_-_el_calafate_2024.pdf"><b>Perito Moreno walkway map</b>APN PDF</a>
      <a href="https://www.elchalten.com/v4/en/laguna-torre-trek-el-chalten.php"><b>elchalten.com</b>Local trail pages. Ask the visitor centre for posted conditions</a>
      <p class="smallnote">Which Fitz Roy forecast service to trust was not researched (GAP).</p>
    </div>
    <div class="qcard"><h4><span class="dot" style="background:var(--class-1)"></span>Operators</h4>
      <a href="mailto:info@piratour.net"><b>Piratour</b>info@piratour.net, for the Martillo landing</a>
      <a class="tel" href="tel:+542901435557"><b>+54 2901 435557</b>Piratour</a>
      <a class="tel" href="tel:+5492901604646"><b>+54 9 2901 604646</b>Piratour WhatsApp</a>
      <a href="https://www.trendelfindelmundo.com.ar"><b>Tren del Fin del Mundo</b>Optional, Day 4</a>
      <a href="https://www.teatrocolon.org.ar"><b>Teatro Colon</b>Tour, Day 13</a>
    </div>
    <div class="qcard"><h4><span class="dot" style="background:var(--class-6)"></span>Emergency</h4>
      <p class="smallnote">Emergency numbers are a GAP in the plan (not in the research). Look them up before travel and save them offline.</p>
      <a class="warn" href="#hazards"><b>Hazards</b>Evacuation cost and the medical-care note</a>
    </div>
  </div>
</section>"""

CHECK_ITEMS = [
    ("intl", "International YYZ-EZE return priced and booked by 31 Oct 2026 (Thu 25 Feb out, Thu 11 Mar back)"),
    ("chalten", "Refundable El Chalten lodging held for 3-7 Mar (smallest stock of any base)"),
    ("piratour", "Email sent to info@piratour.net: 2027 price, minimum age, season end, which product lands, Tuesday run"),
    ("passports", "Every passport valid to at least 11 Sep 2027"),
    ("car", "Rental car at FTE held for 3-9 Mar on a free-cancellation rate, gravel cover asked in writing"),
    ("dom", "Domestic AEP-USH, USH-FTE, FTE-AEP booked by 15 Nov 2026, checked bag included"),
    ("mini", "Perito Moreno minitrekking booked by 30 Nov 2026"),
    ("lodging", "Ushuaia, El Calafate and Buenos Aires lodging booked on refundable rates"),
    ("passes", "Los Glaciares 7-day Flexipass and Tierra del Fuego pass bought on Wi-Fi by 20 Feb 2027, QR saved offline"),
    ("insure", "Travel medical insurance with evacuation and trekking cover"),
    ("bags", "Every bag weighed at home against the 15 kg limit; boots and the heaviest layer worn on flights"),
    ("cash", "Pesos withdrawn in El Calafate or Ushuaia before El Chalten; cash kept for the catamaran port charge and the Desierto boat"),
    ("recheck", "Conditions re-check routine scheduled for about 22 Feb 2027"),
]
checklist = "".join(f'<label><input type="checkbox" data-k="{k}"><span>{esc(t)}</span></label>' for k, t in CHECK_ITEMS)
CHECK = f"""
<section id="essentials">
  <h2>Before you go</h2>
  <div class="grid2">
    <div class="panel check"><h3>Checklist</h3><div id="checklist">{checklist}</div>
      <p class="mono" style="font-size:.72rem;margin-top:10px">Ticks are saved in this browser.</p></div>
    <div class="panel"><h3>Countdown</h3>
      <p>Fly Toronto on the evening of Thu 25 Feb 2027; the first day on the ground is Fri 26 Feb.</p>
      <p class="bigcd"><strong id="cd">&mdash;</strong> until 26 Feb 2027</p></div>
  </div>
</section>"""

NAV = '<a class="home" href="/">&#8592; All plans<span class="d">dashboard</span></a>' + "".join(
    f'<a href="#{i}"><span class="d">{d}</span>{n}</a>' for i, d, n in [
        ("orient", "Read first", "Orientation"),
        ("answer", "Changed", "Answer"),
        ("dates", "When", "Dates"),
        ("split", "Sleep", "Nights"),
        ("flights", "Fly", "Flights"),
        ("ground", "Drive", "Ground"),
        ("sights", "See", "Sights"),
        ("trails", "Walk", "Trails"),
        ("bookings", "Book", "Bookings"),
        ("adventures", "Limits", "Adventures"),
        ("days", "14 days", "Days"),
        ("stay", "Sleep", "Stay"),
        ("budget", "Cost", "Budget"),
        ("hazards", "Risk", "Hazards"),
        ("gotchas", "Know", "Gotchas"),
        ("entry", "Papers", "Entry"),
        ("issues", "Open", "Issues"),
        ("state", "Honest", "Knowledge"),
        ("questions", "For you", "Questions"),
        ("changelog", "History", "Change log"),
        ("quick", "In the field", "Links"),
        ("essentials", "Tick off", "Checklist"),
    ])

CHIPS = ('<span class="chip"><strong id="countdown">&mdash;</strong></span>' + "".join(
    f'<span class="chip"><strong>{a}</strong> {b}</span>' for a, b in [
        ("13", "nights"), ("26 Feb &ndash; 11 Mar 2027", ""), ("4", "bases"), ("2026", "prices as a pattern")]))

hero_fn = PHOTOS.get("hero")
HERO_IMG = commons(hero_fn) if hero_fn else "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4'%3E%3C/svg%3E"
HERO_CREDIT = f'<a href="{filepage(hero_fn)}">Wikimedia Commons</a>' if hero_fn else ""

EXTRA_CSS = (
    "nav a.home{color:var(--highlight-on-deep);font-weight:600;"
    "border-right:1px solid color-mix(in srgb, var(--highlight-on-deep) 32%, transparent);margin-right:6px}"
    "nav a.home:hover{color:var(--header-ink)}"
    ".hero:not([style*='Special']) {background-image:linear-gradient(135deg,var(--bg-deep),var(--header))!important}"
    ".panel p + p,.intro p + p{margin-top:11px}"
    ".lead-top{max-width:80ch;font-size:1.06rem;margin-bottom:14px}.intro .lead-wide{max-width:88ch}"
    ".lead-wide ul{margin:6px 0 12px 20px}.lead-wide li{margin-bottom:6px}"
    ".phblock{height:150px;display:flex;align-items:flex-end;padding:10px 14px;"
    "background:linear-gradient(135deg,var(--bg-deep),var(--header));color:var(--header-ink);"
    "font-family:var(--font-mono);font-size:.66rem;letter-spacing:.08em;text-transform:uppercase}"
    ".areanote{font-size:.8rem!important}.areanote:empty,.phblock ~ .ab .areanote{display:none}"
    ".area figcaption{position:static;display:block;padding:4px 10px;background:var(--bg-deep);color:var(--header-ink);font-size:.62rem}"
    ".numstrip7{grid-template-columns:repeat(7,minmax(0,1fr))}.numstrip7 b{font-size:1.2rem;overflow-wrap:anywhere}"
    ".know li span b{font-family:inherit;font-size:inherit;color:var(--ink);line-height:inherit}"
    "main > section.intro,main > section#days{margin-top:36px}main > section#warn{margin-top:0}"
    ".intro table,.panel table{width:100%}"
    ".tw{overflow-x:auto;margin:14px 0;border-radius:6px}.tw table{min-width:640px}"
    ".tw table.c3{min-width:560px}.tw table.c4{min-width:620px}.tw table.c5{min-width:760px}.tw table.c6,.tw table.c7{min-width:860px}"
    ".tw table.c8{min-width:960px}.tw table.c9{min-width:1000px}.tw table.c11{min-width:1100px}"
    ".tw td,.tw th{padding:7px 9px}.tw th{white-space:nowrap}"
    ".tw td:first-child{font-weight:600}"
    "table.trailtab td{font-size:.82rem}table.trailtab td.lk{white-space:nowrap}table.trailtab .btn{padding:3px 8px;margin:2px 3px 2px 0}"
    "table.kv{margin:14px 0 4px;background:var(--surface);border:1px solid var(--line);border-radius:8px;overflow:hidden}"
    "table.kv th{width:132px;text-align:left;font-family:var(--font-mono);font-size:.7rem;letter-spacing:.06em;text-transform:uppercase;"
    "color:var(--muted);background:var(--bg);vertical-align:top;padding:8px 12px;border-bottom:1px solid var(--line);white-space:normal}"
    "table.kv td{padding:8px 12px;font-size:.9rem}"
    ".inf{font-family:var(--font-mono);font-size:.68rem;letter-spacing:.04em;text-transform:uppercase;"
    "border:1px solid var(--line);border-radius:3px;padding:0 5px;color:var(--muted);white-space:nowrap}"
    ".inf.gap{border-color:var(--warn);color:var(--warn)}.inf.ok{color:var(--accent-dark);border-color:var(--accent)}"
    ".warnbar{background:var(--warn-soft);border-left:6px solid var(--warn);color:var(--ink);"
    "padding:16px 20px;border-radius:4px;font-size:1rem;line-height:1.5;max-width:90ch}"
    "#warn{padding-top:28px}"
    ".plainlist{margin:8px 0 8px 20px;max-width:92ch}.plainlist li{margin-bottom:6px}.plainlist .plainlist{margin-top:6px}"
    ".smallnote{font-size:.82rem;color:var(--muted);margin-top:6px}"
    ".subh{margin:28px 0 8px;font-family:var(--font-display);font-size:1.25rem}"
    ".parkh{border-bottom:2px solid var(--line);padding-bottom:6px;display:flex;gap:10px;align-items:center}"
    ".bigcd{font-size:1.1rem}.bigcd strong{font-family:var(--font-mono);font-size:1.6rem}"
    "details.bigmore{margin:14px 0;padding:10px 14px;background:var(--surface);border:1px solid var(--line);border-radius:10px}"
    "details.bigmore summary{font-size:.8rem}"
    "pre{font-family:var(--font-mono);font-size:.8rem;white-space:pre-wrap;background:var(--bg);padding:10px 12px;border-radius:6px;margin-top:8px}"
    ".tag--cut{background:var(--bg-deep-2);color:var(--ink-on-deep)}"
    ".addcut .panel h3{display:flex;gap:8px;align-items:center;flex-wrap:wrap}"
    ".norbox{margin-top:20px;border-left:6px solid var(--warn)}.norbox h3{display:flex;gap:8px;align-items:center}"
    ".panel h3 .tag{margin:0}"
    ".ok11{display:inline-block;font-size:.8rem;padding:2px 8px;border-radius:5px;border:1.5px solid var(--line);line-height:1.35}"
    ".ok11--yes{background:var(--accent-soft);border-color:var(--accent);color:var(--ink)}"
    ".ok11--no{background:var(--warn-soft);border-color:var(--warn);color:var(--ink)}"
    ".ok11--cond{background:var(--highlight-soft);border-color:var(--highlight);color:var(--ink)}"
    ".ok11--unk{background:var(--bg);border:1.5px dashed var(--muted);color:var(--ink)}"
    ".sgrid,.tgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:14px;margin:12px 0 8px}"
    ".sg,.tc{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:14px 16px;min-width:0;overflow:hidden;"
    "display:flex;flex-direction:column;gap:6px}"
    ".sg h4,.tc h4{font-family:var(--font-display);font-size:1.05rem;line-height:1.25;display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap}.sg h4{flex-wrap:nowrap}"
    ".sg .rank{font-family:var(--font-mono);font-size:.78rem;background:var(--header);color:var(--header-ink);border-radius:4px;padding:1px 7px;flex:0 0 auto}"
    ".sg p,.tc p{font-size:.9rem;margin:0}.tc .meta{font-family:var(--font-mono);font-size:.68rem;color:var(--muted)}"
    ".tc .alt{background:var(--accent-soft);border-radius:6px;padding:5px 9px;font-size:.86rem}"
    ".tc .stats,.sg .links,.tc .links{margin-top:4px}"
    ".chiprow{display:flex;flex-wrap:wrap;gap:6px}"
    # days
    ".daynav{position:sticky;top:96px;z-index:40;background:var(--surface);border-bottom:2px solid var(--line);margin:18px 0 0}"
    ".daynav .wrap{width:100%;padding:6px 0;gap:3px}"
    ".daynav a{font-size:.9rem;padding:5px 11px;color:var(--ink);text-transform:none;letter-spacing:.02em}"
    ".daynav a:hover{background:var(--accent-soft);color:var(--ink)}"
    ".daynav a .d{display:inline;margin-right:6px;color:var(--muted)}.daynav a.active{background:var(--header);color:var(--header-ink)}.daynav a.active .d{color:var(--header-sub)}"
    "section.day{border-top:1px solid var(--line);margin-top:26px;padding-top:34px;scroll-margin-top:150px}"
    ".rulebox{scroll-margin-top:150px;margin-top:26px;background:var(--surface);border:1px solid var(--line);border-left:6px solid var(--highlight);border-radius:10px;padding:18px 22px}"
    ".daystats{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin:14px 0 0;padding:12px 0;"
    "border-top:2px solid var(--bg-deep);border-bottom:2px solid var(--bg-deep)}"
    ".daystats b{display:block;font-family:var(--font-display);font-size:1.15rem;line-height:1.1;color:var(--header);overflow-wrap:anywhere}"
    ".daystats span{font-family:var(--font-mono);font-size:.62rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}"
    ".daylinks{margin-top:18px}"
    ".card .content p,.card .content ul,.card .content ol{max-width:90ch}"
    ".card .content .plainlist{font-size:.92rem}"
    ".card .stats span{margin-right:12px}"
    ".time{max-width:100%}"
    "@media(max-width:760px){.numstrip7{grid-template-columns:repeat(2,minmax(0,1fr))}"
    "table.kv th{width:96px}.daynav a{font-size:.82rem;padding:4px 8px}"
    ".sgrid,.tgrid{grid-template-columns:1fr}.rulebox{padding:14px}}"
)

CTX = {
    "slug": "patagonia-feb-mar-2027",
    "trip_date": "2027-02-26",
    "trip_dates": "26 Feb &ndash; 11 Mar 2027",
    "trip_duration": "13 nights",
    "trip_region": "Argentine Patagonia: Ushuaia, El Chalten, El Calafate",
    "title": "Argentine Patagonia: 13 nights, Feb-Mar 2027",
    "description": ("Thirteen nights from Buenos Aires to Ushuaia, El Chalten and El Calafate for adults and children aged 11 and up: "
                    "penguins, the Fitz Roy hikes and Perito Moreno, ordered around wind. Built from 2026 figures; nothing for 2027 is published yet."),
    "hero_image": HERO_IMG,
    "hero_credit": HERO_CREDIT,
    "eyebrow": "Fri 26 Feb &ndash; Thu 11 Mar 2027 &middot; Argentine Patagonia",
    "headline": "Argentine Patagonia",
    "sub": ("Thirteen nights: Ushuaia and the penguins first, then El Chalten and Fitz Roy, then Perito Moreno, "
            "with Buenos Aires at both ends and a spare day built in for wind."),
    "chips": CHIPS,
    "nav": NAV,
    "body": WARN + ORIENT + ANSWER + DATES + SPLIT + FLIGHTS + GROUND + SIGHTS + TRAILS + BOOKINGS + ADV + DAYS + STAY + REST + QUICK + CHECK,
    "footer": ('Planned from seven research files in <span class="mono">~/workspace/travel/patagonia-feb-mar-2027/</span>. '
               'Photographs from <a href="https://commons.wikimedia.org/">Wikimedia Commons</a>, each linked at its caption. '
               '<b>Every price, timetable, season and fare is a 2026 figure or older, used as a pattern; nothing for 2027 is published. '
               'Re-check flights, park fees and operator terms before booking.</b>'),
    "extra_css": EXTRA_CSS,
}

html_out = S.assemble(CTX, THEME)
problems = S.check_output_is_self_contained(html_out)
if problems:
    raise SystemExit("SELF-CONTAINMENT FAILED:\n  " + "\n  ".join(problems))
out = HERE / "index.html"
out.write_text(html_out, encoding="utf-8")
print(f"wrote {out}  ({len(html_out):,} bytes, theme={THEME})")

# Photo gallery is data (gallery.json) injected after the trails section; a rebuild would otherwise erase it.
if (HERE / "gallery.json").exists():
    import gallery as G   # noqa: E402  (_system/gallery.py)
    G.inject(G.load(str(HERE / "gallery.json")), out, after="trails")
