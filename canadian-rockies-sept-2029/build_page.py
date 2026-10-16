#!/usr/bin/env python3
"""Build canadian-rockies-sept-2029/index.html from _system components. Run:  python3 build_page.py

Facts come from data/*.json (never edited here) and PLAN.md (narrative sections are parsed and
rendered with their wording unchanged). The gallery section is injected after the build, after
the trails section, from gallery.json."""
import html
import json
import re
import sys
import urllib.parse
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "_system"))
import build as S   # noqa: E402

THEME = "alpine-snow"
REGION = "Alberta and British Columbia, Canada"
def esc(s, quote=True):
    return html.escape(str(s), quote)


def J(name):
    return json.loads((HERE / "data" / name).read_text(encoding="utf-8"))


SIGHTS = J("sights.json")
TRAILS = J("trails.json")
ADVS = J("adventures.merged.json")["adventures"]
BOOKS = J("bookings.json")
BASES = {b["id"]: b for b in J("bases.json")}
ITIN = J("itinerary.json")
GAL = json.loads((HERE / "gallery" / "gallery.json").read_text(encoding="utf-8"))
PLAN = (HERE / "PLAN.md").read_text(encoding="utf-8")

T_BY = {t["id"]: t for t in TRAILS}
S_BY = {s["id"]: s for s in SIGHTS}
A_BY = {a["id"]: a for a in ADVS}
B_BY = {b["id"]: b for b in BOOKS}

# ---------------------------------------------------------------- helpers
def commons(fn, w=900):
    return "https://commons.wikimedia.org/wiki/Special:FilePath/" + urllib.parse.quote(fn.replace(" ", "_")) + f"?width={w}"


def filepage(fn):
    return "https://commons.wikimedia.org/wiki/File:" + urllib.parse.quote(fn.replace(" ", "_"))


def mapq(*parts):
    return "https://maps.google.com/?q=" + urllib.parse.quote_plus(", ".join(parts))


def dirq(*places):
    return "https://www.google.com/maps/dir/" + "/".join(urllib.parse.quote_plus(p) for p in places) + "/"


def inf(text="inference"):
    return f'<span class="inf">{text}</span>'


GAP = '<span class="inf gap">GAP</span>'


def badge(status):
    s = (status or "").upper()
    if s == "GAP":
        return '<span class="inf gap">GAP</span>'
    if s == "INFERENCE":
        return '<span class="inf">inference</span>'
    return '<span class="inf ok">verified</span>'


def btn(label, url, primary=False, title=None):
    t = f' title="{esc(title)}"' if title else ""
    return f'<a class="btn{" primary" if primary else ""}" href="{esc(url)}"{t}>{label}</a>'


def gapbtn(label):
    return f'<span class="inf gap" title="No link found in the research data">{label} GAP</span>'


def tbl(head, rows, cls=""):
    h = "".join(f"<th>{c}</th>" for c in head)
    r = "".join("<tr" + (f' id="{i}"' if i else "") + ">" + "".join(f"<td>{c}</td>" for c in cells) + "</tr>"
                for i, cells in rows)
    return f'<div class="tw"><table{(" class=" + cls) if cls else ""}><tr>{h}</tr>{r}</table></div>'


def tbl_plain(head, rows, cls=""):
    return tbl(head, [("", r) for r in rows], cls)


def photo_for(prefix):
    for sec in GAL["sections"]:
        if sec["place"].startswith(prefix):
            return sec["photos"][0]
    raise SystemExit("no gallery section " + prefix)


def fig(p, w=700):
    return (f'<figure><img loading="lazy" src="{commons(p["file"], w)}" alt="{esc(p["caption"])}">'
            f'<figcaption>{esc(p["author"])} &middot; {esc(p["license"])} &middot; '
            f'<a href="{filepage(p["file"])}">Wikimedia Commons</a></figcaption></figure>')


# ---------------------------------------------------------------- PLAN.md parsing
def plan_section(title, level=2):
    lines = PLAN.splitlines()
    pre = "#" * level + " "
    start = next(i for i, l in enumerate(lines) if l.strip() == pre + title)
    out = []
    for l in lines[start + 1:]:
        if re.match(r"^#{1,%d} " % level, l) or l.strip() == "---":
            break
        out.append(l)
    return "\n".join(out).strip("\n")


def inline(t):
    t = esc(t, quote=False)
    t = re.sub(r"`([^`]+)`", r"<code>\1</code>", t)
    t = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", t)
    t = re.sub(r"\[([^\]]+)\]\((https?://[^)]+)\)", r'<a href="\2">\1</a>', t)
    t = re.sub(r"\bGAP\b", GAP, t)
    t = re.sub(r"\bINFERENCE\b", inf("inference"), t)
    return t.replace("&lt;br&gt;", "<br>")


def md(text, drop_tables=False):
    out, lines, i = [], text.split("\n"), 0
    while i < len(lines):
        l = lines[i]
        if not l.strip():
            i += 1
            continue
        if l.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].startswith("|"):
                rows.append([c.strip() for c in lines[i].strip().strip("|").split("|")])
                i += 1
            if drop_tables:
                continue
            body = [r for r in rows[1:] if not all(re.fullmatch(r"-+", c) for c in r)]
            out.append(tbl_plain([inline(c) for c in rows[0]], [[inline(c) for c in r] for r in body]))
            continue
        if re.match(r"^- ", l):
            items = []
            while i < len(lines) and re.match(r"^- ", lines[i]):
                items.append("<li>" + inline(lines[i][2:]) + "</li>")
                i += 1
            out.append('<ul class="plainlist">' + "".join(items) + "</ul>")
            continue
        if re.match(r"^\d+\. ", l):
            items = []
            while i < len(lines) and re.match(r"^\d+\. ", lines[i]):
                items.append("<li>" + inline(re.sub(r"^\d+\. ", "", lines[i])) + "</li>")
                i += 1
            out.append('<ol class="plainlist">' + "".join(items) + "</ol>")
            continue
        if l.startswith("### "):
            out.append(f'<h3 class="subh">{inline(l[4:])}</h3>')
            i += 1
            continue
        para = [l]
        i += 1
        while i < len(lines) and lines[i].strip() and not re.match(r"^(\||- |\d+\. |### )", lines[i]):
            para.append(lines[i])
            i += 1
        out.append("<p>" + inline(" ".join(para)) + "</p>")
    return "\n".join(out)


DAY_TITLES = {}
for m in re.finditer(r"^### Day (\d+), ([A-Za-z]+ \d+ Sep): (.+)$", PLAN, flags=re.M):
    DAY_TITLES[int(m.group(1))] = m.group(3)

# ---------------------------------------------------------------- classifier
CLASSES = [
    ("family", "Family: the whole family can do it", 1),
    ("adult-only", "Adult-only: too long or steep for a 6 year old", 3),
    ("less-walking", "Less-walking: the low-effort fallback", 6),
    ("booked", "Booked: needs a reservation or timed slot", 4),
]
SLOT = {k: s for k, _, s in CLASSES}
LEGEND = '<div class="legend">' + "".join(
    f'<span><i class="b" style="background:var(--class-{sl})"></i>{n}</span>' for _, n, sl in CLASSES) + "</div>"


def mark(kind):
    return f'<span class="mark mark--{SLOT[kind]}" title="{kind}"></span>'


# ---------------------------------------------------------------- reverse index: which days use what
USED = {"t": {}, "s": {}, "a": {}}
for d in ITIN["days"]:
    for tk in ("track_a", "track_b", "track_c"):
        x = d[tk]
        if not x:
            continue
        for key, ids in (("t", x.get("trail_ids", [])), ("s", x.get("sight_ids", [])), ("a", x.get("adventure_ids", []))):
            for i in ids:
                USED[key].setdefault(i, [])
                if d["n"] not in USED[key][i]:
                    USED[key][i].append(d["n"])


def daychips(key, i):
    ds = USED[key].get(i)
    if not ds:
        return ""
    return '<p class="usedon">On day ' + ", ".join(f'<a href="#day-{n}">{n}</a>' for n in sorted(ds)) + "</p>"


# ---------------------------------------------------------------- answer strip + warn
BASE_NAMES = "Banff, Lake Louise, Jasper, Kananaskis Village"
ANSWER = f"""
<section class="intro" id="answer">
  <div class="warnbar">
    <b>2026 figures used as a pattern.</b> Every price, timetable, season and closure on this page is a
    2026 (or older) figure. Nothing for 2029 has been published. {GAP} means not verified;
    {inf()} means reasoning, not a source.
  </div>
  <div class="numstrip answerstrip">
    <div><b>14</b><span>nights, 15 days</span></div>
    <div><b>Sat 8 &ndash; Sat 22</b><span>September 2029</span></div>
    <div><b>4</b><span>bases: {BASE_NAMES} (5 check-ins)</span></div>
    <div><b>7</b><span>split days, each with a family track</span></div>
  </div>
</section>"""

# ---------------------------------------------------------------- orientation
ori = plan_section("Orientation")
parts = re.split(r"\*\*Sub-regions\*\*|\*\*The trip in numbers\*\*|\*\*Know before reading the days\*\*", ori)
ori_intro, ori_sub, ori_nums, ori_know = parts[0], parts[1], parts[2], parts[3]

AREA_PHOTO = ["Banff townsite", "Kootenay", "Icefields Parkway", "Mount Robson", "Moraine Lake", "Kananaskis Country"]
area_rows = [[c.strip() for c in l.strip().strip("|").split("|")] for l in ori_sub.strip().splitlines()
             if l.startswith("|") and not re.match(r"^\|[-| ]+\|$", l)][1:]
areas_html = "".join(
    f'<div class="area">{fig(photo_for(AREA_PHOTO[i]), 600)}<div class="ab"><h3>{inline(r[0])}</h3>'
    f'<p class="days">Days {esc(r[2])}</p><p>{inline(r[1])}</p></div></div>' for i, r in enumerate(area_rows))

NUMS = [("14", "nights; 4 bases, 5 check-ins"), ("about 26 h", "driving, about 1h45 a day (INFERENCE)"),
        ("about 47 km", "family walking, about 3.2 km a day (INFERENCE)"),
        ("2,385 m", "highest family point, Sunshine chair top (GAP)"),
        ("20.3 km", "Iceline, the longest adult hike, +1,090 m (two official figures)"),
        ("7", "split days: 2, 5, 7, 9, 10, 11, 13")]
numstrip = '<div class="numstrip">' + "".join(
    f"<div><b>{a}</b><span>{inline(b)}</span></div>" for a, b in NUMS) + "</div>"

OPT_ROWS = []
for o in sorted(ITIN["options"] + [{"nights": ITIN["recommended"]["nights"], "rec": True}], key=lambda o: o["nights"]):
    if o.get("rec"):
        continue
    OPT_ROWS.append(("", [f'<b>{o["nights"]} nights</b>', inline(o["parks"]), inline(o["cuts"]),
                          inline(o["longest_drive"]), inline(o["verdict"])]))
# recommended row, from itinerary.json recommended + PLAN verdict
rec = ITIN["recommended"]
if not any(o["nights"] == rec["nights"] for o in ITIN["options"]):
    OPT_ROWS.append(("", [f'<b>{rec["nights"]} nights<br>Sat 8 &ndash; Sat 22 Sep</b>',
                          "Banff, Lake Louise and Moraine, Yoho, Kootenay north, the full Icefields Parkway, Jasper, Mount Robson, Kananaskis and Peter Lougheed",
                          "Waterton", "Two Parkway days at 175 min non-stop each (matrix); about 1h45 a day on average",
                          "<b>Recommended.</b>"]))
OPT_ROWS.sort(key=lambda r: int(re.search(r"\d+", r[1][0]).group()))
OPT_ROWS = [(("opt-rec" if "Recommended" in r[1][4] or "recommended" in r[1][4].lower() else ""), r[1]) for r in OPT_ROWS]
options_table = tbl(["Length", "Parks covered", "What it cuts", "Longest drive", "Verdict"], OPT_ROWS, "opts")

answer_md = plan_section("The answer first")
answer_lead, answer_other = answer_md.split("### The other window: Sat 1 to Sat 15 Sep")
other_win = "### The other window: Sat 1 to Sat 15 Sep" + answer_other

ORIENT = f"""
<section class="intro" id="orient">
  <p class="kick">Before the days start</p>
  <h2>The answer first</h2>
  <div class="lead">{md(answer_lead, drop_tables=True)}</div>
  <h3 class="subh">How many days: the options</h3>
  {options_table}
  <h3 class="subh">Why Sat 8 &ndash; Sat 22 Sep</h3>
  <div class="panel"><p>{inline(rec["rationale"])}</p></div>
  <details class="more bigmore"><summary>The other window, Sat 1 &ndash; Sat 15 Sep</summary>{md(other_win)}</details>
  <details class="more bigmore"><summary>If you only get N nights</summary>{md(plan_section("If you only get N nights", 3))}</details>

  <h2 style="margin-top:34px">What this place physically is</h2>
  <div class="lead">{md(ori_intro.split("**What the place is.**")[0] + "**What the place is.**" + ori_intro.split("**What the place is.**")[1])}</div>
  <div class="areas">{areas_html}</div>
  <h3 class="subh">The trip in numbers</h3>
  {numstrip}
  <details class="more bigmore"><summary>Numbers as written in the plan</summary>{md(ori_nums)}</details>
  <h3 class="subh">Know before reading the days</h3>
  {md(ori_know)}
  <h3 class="subh">Light</h3>
  {md(plan_section("Light"))}
</section>"""

# ---------------------------------------------------------------- sights
PARK_ORDER = ["Banff", "Kootenay", "Yoho", "Jasper", "Mount Robson Provincial Park", "Peter Lougheed Provincial Park",
              "Spray Valley Provincial Park"]
parks = PARK_ORDER + sorted({s["park"] for s in SIGHTS} - set(PARK_ORDER))


def sight_card(s):
    official = btn("Official", s["official_url"]) if s.get("official_url") else gapbtn("Official")
    booking = ""
    bk = s.get("booking_needed")
    if bk:
        booking = f'<details class="more"><summary>Booking and best time</summary><p><b>Best time.</b> {esc(s["best_time"])}</p><p><b>Booking.</b> {esc(bk)}</p></details>'
    return f"""<article class="sg" id="sight-{esc(s['id'])}">
  <h4>{esc(s['name'])} {badge(s['status'])}</h4>
  <p class="meta">{esc(str(s['time_needed_hours']) if s.get('time_needed_hours') is not None else 'GAP')} h needed</p>
  <p>{esc(s['why_must_do'])}</p>
  <p class="child"><b>6 year old.</b> {esc(s['child_note'])}</p>
  <div class="links">{btn('Map', s['map_url'], True)}{official}</div>
  {daychips('s', s['id'])}{booking}
</article>"""


sight_groups = ""
for p in parks:
    items = [s for s in SIGHTS if s["park"] == p]
    if items:
        sight_groups += f'<h3 class="subh parkh">{esc(p)} <span class="inf">{len(items)}</span></h3><div class="sgrid">{"".join(sight_card(s) for s in items)}</div>'

SIGHTS_HTML = f"""
<section class="intro" id="sights">
  <p class="kick">What to see</p>
  <h2>Must-do sights</h2>
  <p class="lead">{len(SIGHTS)} sights, grouped by park. Time needed is the researcher&rsquo;s estimate. Each card links to a Google Map and,
  where one exists, the official page; a missing official page shows as a {GAP} badge.</p>
  {sight_groups}
</section>"""


# ---------------------------------------------------------------- trails
def fmt_num(x):
    return ("%g" % x) if x else None


def trail_card(t, kind):
    km = fmt_num(t.get("km"))
    dist = f"<b>{km} km</b> / {fmt_num(t.get('mi'))} mi" if km else f"<b>distance</b> {GAP}"
    gain = f"<b>+{t['gain_m']} m</b> gain" if t.get("gain_m") else f"<b>gain</b> {GAP}"
    at = (btn("AllTrails", t["alltrails_url"], title="search-result link, not fetched")
          if t.get("alltrails_url") else gapbtn("AllTrails"))
    off = btn("Official", t["official_url"]) if t.get("official_url") else gapbtn("Official")
    alt = ""
    if kind == "adult-only":
        fid = t.get("family_alternative_id")
        if fid in T_BY:
            alt = f'<p class="alt"><b>Family alternative.</b> <a href="#trail-{esc(fid)}">{esc(T_BY[fid]["name"])}</a></p>'
        elif fid in S_BY:
            alt = f'<p class="alt"><b>Family alternative.</b> <a href="#sight-{esc(fid)}">{esc(S_BY[fid]["name"])}</a> (a sight)</p>'
        else:
            alt = f'<p class="alt"><b>Family alternative.</b> {GAP}</p>'
        alt += f'<p class="alt"><b>Less walking.</b> {esc(t["less_walking_alternative"])}</p>'
    extra = ""
    if t.get("stats_note"):
        extra += f'<p><b>Stats note.</b> {esc(t["stats_note"])}</p>'
    det = (f'<details class="more"><summary>Closures, September, hazards</summary>'
           f'<p><b>Closure and September.</b> {esc(t["sept_notes"])}</p>'
           f'<p><b>Hazards.</b> {esc(t["hazards"])}</p>'
           f'<p><b>Parking or shuttle.</b> {esc(t["parking_or_shuttle"])}</p>{extra}</details>')
    audience = {"family": "family", "both": "family and adult", "adult_only": "adult only"}[t["audience"]]
    return f"""<article class="tc" id="trail-{esc(t['id'])}">
  <h4><span class="tn">{mark(kind)}<span>{esc(t['name'])}</span></span> {badge(t['status'])}</h4>
  <p class="meta">{esc(t['park'])} &middot; {esc(t['difficulty'])} &middot; {audience} &middot; {esc(t['trailhead'])}</p>
  <div class="stats"><span>{dist}</span><span>{gain}</span><span><b>{esc(t['hours'])}</b></span></div>
  <div class="links">{btn('Map', t['map_url'], True)}{at}{off}</div>
  <p class="child"><b>6 year old.</b> {esc(t['child_note'])}</p>{alt}
  {daychips('t', t['id'])}{det}
</article>"""


fam = [t for t in TRAILS if t["audience"] in ("family", "both")]
adu = [t for t in TRAILS if t["audience"] == "adult_only"]

# less-walking alternatives: one card per distinct text, with the trails it stands in for
lw = {}
for t in TRAILS:
    lw.setdefault(t["less_walking_alternative"].strip(), []).append(t)
sight_by_name = {s["name"].lower(): s for s in SIGHTS}


def lw_card(text, ts):
    key = text.rstrip(".").lower()
    s = sight_by_name.get(key)
    link = (f'<div class="links">{btn("Map", s["map_url"], True)}<a class="btn" href="#sight-{esc(s["id"])}">Sight card</a></div>'
            if s else "")
    chips = "".join(f'<a class="chipl" href="#trail-{esc(t["id"])}">{esc(t["name"])}</a>' for t in ts)
    return (f'<article class="tc lw">'
            f'<h4><span class="tn">{mark("less-walking")}<span>{esc(text)}</span></span></h4>'
            f'<p class="meta">Stands in for {len(ts)} trail{"s" if len(ts) != 1 else ""}</p>{link}'
            f'<div class="chiprow">{chips}</div></article>')


TRAILS_HTML = f"""
<section class="intro" id="trails">
  <p class="kick">On foot</p>
  <h2>Trails</h2>
  <p class="lead">{len(TRAILS)} trails in three groups. Distance is shown in km and miles. Every card has a Google Map; AllTrails and official
  links are shown where the research found one, otherwise a {GAP} badge. AllTrails links are search results, not fetched pages.
  Longer notes (closures, September conditions, hazards) are folded into each card.</p>
  {LEGEND}
  <h3 class="subh parkh" id="trails-family">Family trails {mark("family")} <span class="inf">{len(fam)}</span></h3>
  <div class="tgrid">{"".join(trail_card(t, "family") for t in fam)}</div>
  <h3 class="subh parkh" id="trails-adult">Adult-only trails, each with its family alternative {mark("adult-only")} <span class="inf">{len(adu)}</span></h3>
  <div class="tgrid">{"".join(trail_card(t, "adult-only") for t in adu)}</div>
  <h3 class="subh parkh" id="trails-less">Less-walking alternatives {mark("less-walking")} <span class="inf">{len(lw)}</span></h3>
  <p class="smallnote">The fallback text from the trail data, grouped. Entries such as &ldquo;Short&rdquo; or &ldquo;Same.&rdquo; are
  quoted as the researcher wrote them.</p>
  <div class="tgrid">{"".join(lw_card(k, v) for k, v in sorted(lw.items(), key=lambda kv: (-len(kv[1]), kv[0])))}</div>
</section>"""


# ---------------------------------------------------------------- bookings
def booking_row(b):
    prov = esc(b["provider"])
    link = btn("Book", b["book_url"]) if b.get("book_url") else gapbtn("Link")
    must = "yes" if b["must_do"] else "no"
    return (f'bk-{b["id"]}', [f'<b>{esc(b["item"])}</b><br><span class="smallnote">{prov}</span><br>{link}',
                              esc(b["opens_2026_pattern"]), esc(b["sells_out_note"]), esc(b["cost_cad_2026"]),
                              f'<details class="more"><summary>Deadline, refund</summary><p>{esc(b["deadline_note"])}</p><p><b>Refund.</b> {esc(b["refund_note"])}</p></details>',
                              badge(b["status"])])


BK_HEAD = ["Booking", "Opening pattern (2026)", "Sells out", "Cost (CAD, 2026)", "Notes", "Status"]
must = [b for b in BOOKS if b["must_do"]]
wait = [b for b in BOOKS if not b["must_do"]]
dl_rows = []
for d in ITIN["deadlines"]:
    ref = f'<a href="#bk-{esc(d["booking_id"])}">{esc(B_BY[d["booking_id"]]["item"])}</a>' if d.get("booking_id") in B_BY else ""
    dl_rows.append([inline(d["when"]), inline(d["what"]), ref])

BOOKINGS_HTML = f"""
<section class="intro" id="bookings">
  <p class="kick">When to book</p>
  <h2>Bookings and deadlines</h2>
  <p class="lead">Opening patterns are 2026 ones; nothing for 2029 is published. The deadline dates below are inferred from them.</p>
  <h3 class="subh">Must do ({len(must)})</h3>
  {tbl(BK_HEAD, [booking_row(b) for b in must], "bk")}
  <h3 class="subh">Can wait ({len(wait)})</h3>
  {tbl(BK_HEAD, [booking_row(b) for b in wait], "bk")}
  <h3 class="subh">Deadlines</h3>
  {tbl_plain(["When", "What", "Booking"], dl_rows)}
  <details class="more bigmore"><summary>Deadlines as written in the plan</summary>{md(plan_section("Deadlines"))}</details>
</section>"""

# ---------------------------------------------------------------- adventures
CHILD = {"yes": ("yes", "yes"), "no": ("no", "no"), "with_adult": ("with_adult", "with an adult"), "unknown": ("unknown", "unknown")}


def adv_row(a):
    c, label = CHILD.get(a["child_6yo_ok"], ("unknown", a["child_6yo_ok"]))
    ops = []
    if a.get("book_url"):
        ops.append(btn("Book", a["book_url"]))
    if a.get("operator_url"):
        ops.append(btn("Operator", a["operator_url"]))
    if not ops:
        ops.append(gapbtn("Link"))
    vn = f'<p><b>Verification.</b> {esc(a["verify_note"])}</p>' if a.get("verify_note") else ""
    minw = f' (min {a["min_weight_kg"]} kg)' if a.get("min_weight_kg") else ""
    det = (f'<details class="more"><summary>Price, season, booking, refund</summary>'
           f'<p><b>Price.</b> {esc(a["price_cad_2026"])}</p><p><b>Season.</b> {esc(a["season_window"])}</p>'
           f'<p><b>Booking.</b> {esc(a["booking"])}</p><p><b>Weather and refund.</b> {esc(a["weather_refund"])}</p>{vn}</details>')
    na = lambda v, u="": (f"{v}{u}" if v is not None else '<span class="muted">not found</span>')
    return (f'adv-{a["id"]}', [
        f'<b>{esc(a["name"])}</b><br><span class="smallnote">{esc(a["park"])} &middot; {esc(a["type"])} &middot; {esc(a["operator"])}</span>{daychips("a", a["id"])}',
        na(a.get("min_age"), " yrs"), na(a.get("min_height_cm"), " cm"),
        (na(a.get("max_weight_kg"), " kg max") + minw),
        f'<span class="child6 child6--{c}">{label}</span>',
        det, f'<div class="links">{btn("Map", a["map_url"], True)}{"".join(ops)}</div>', badge(a["status"])])


no_h = sum(1 for a in ADVS if a.get("min_height_cm") is None)
ADV_HTML = f"""
<section class="intro" id="adventures">
  <p class="kick">Beyond walking</p>
  <h2>Adventures and attractions</h2>
  <p class="lead">{len(ADVS)} activities with the limits that decide who in the group can do them. The Child 6 yrs column is for a child of about 6.
  <b>No minimum height was found for {no_h} of the {len(ADVS)}</b> (shown as &ldquo;not found&rdquo;, not as &ldquo;none&rdquo;); check with the operator before booking.</p>
  <div class="legend">
    <span><i class="b child6--yes"></i>yes</span><span><i class="b child6--with_adult"></i>with an adult</span>
    <span><i class="b child6--no"></i>no</span><span><i class="b child6--unknown"></i>unknown</span>
  </div>
  {tbl(["Activity", "Min age", "Min height", "Weight", "Child 6 yrs", "Details", "Links", "Status"], [adv_row(a) for a in ADVS], "adv")}
</section>"""

# ---------------------------------------------------------------- days
def chips_for(x, kind):
    out = []
    for i in x.get("trail_ids", []):
        t = T_BY[i]
        out.append(f'<a class="chipl" href="#trail-{esc(i)}">{mark(kind if kind != "adult-only" else ("adult-only" if t["audience"] == "adult_only" else "family"))}{esc(t["name"])} <small>trail</small></a>')
    for i in x.get("sight_ids", []):
        out.append(f'<a class="chipl" href="#sight-{esc(i)}">{mark("less-walking" if kind == "less-walking" else kind)}{esc(S_BY[i]["name"])} <small>sight</small></a>')
    for i in x.get("adventure_ids", []):
        out.append(f'<a class="chipl" href="#adv-{esc(i)}">{mark("less-walking" if kind == "less-walking" else kind)}{esc(A_BY[i]["name"])} <small>activity</small></a>')
    return '<div class="chiprow">' + "".join(out) + "</div>" if out else ""


def track_col(label, kind, x, sub):
    if not x:
        return f'<div class="dcol dcol--none"><h4>{mark(kind)}{label}</h4><p class="muted">{sub}: none this day.</p></div>'
    notes = f'<details class="more"><summary>Notes</summary><p>{inline(x["notes"])}</p></details>'
    return (f'<div class="dcol dcol--{SLOT[kind]}"><h4>{mark(kind)}{label}</h4><p class="sub2">{sub}</p>'
            f'<p class="dtitle">{inline(x["title"])}</p>{chips_for(x, kind)}{notes}</div>')


def day_html(d):
    n = d["n"]
    dow, num, mon = d["date"].split()
    base = BASES[d["base_id"]]
    split = '<span class="tag tag--unmissable split">split day</span>' if d["needs_split"] else ""
    b_places = [S_BY[i]["name"] for i in (d["track_b"] or {}).get("sight_ids", [])]
    b_maps = (btn("Route map, Track B sights", dirq(*[p + ", Alberta" for p in b_places]))
              if len(b_places) >= 2 else "")
    bk = "".join(
        f'<a class="chipl bookchip" href="#bk-{esc(i)}">{mark("booked")}{esc(B_BY[i]["item"])}</a>' for i in d["booking_ids"])
    flags = "".join(f"<li>{inline(f)}</li>" for f in d["status_flags"])
    det = (f'<details class="more"><summary>Decision rule, wet-weather swap, open flags</summary>'
           f'<p><b>Decision rule.</b> {inline(d["decision_rule"])}</p>'
           f'<p><b>Wet-weather swap.</b> {inline(d["wet_weather"])}</p>'
           f'<p><b>Status flags.</b></p><ul>{flags}</ul></details>')
    return f"""
<section class="day" id="day-{n}">
  <div class="sign">
    <div class="date"><span class="dow">{dow}</span><span class="num">{num}</span></div>
    <div class="body"><h2>Day {n}: {esc(DAY_TITLES.get(n, ''))} {split}</h2><p class="route">{esc(d['date'])} &middot; base {esc(base['name'])}</p></div>
  </div>
  <div class="daymeta"><span>Base <b>{esc(base['name'])}</b></span><span>Light <b>{inline(d['light'])}</b></span></div>
  <p class="daydrive"><b>Drive.</b> {inline(d['drive'])}</p>
  <p class="daysum">{inline(d['summary'])}</p>
  <div class="dcols">
    {track_col('Track A', 'adult-only', d['track_a'], 'Adult-only')}
    {track_col('Track B', 'family', d['track_b'], 'Family')}
    {track_col('Track C', 'less-walking', d['track_c'], 'Less walking')}
  </div>
  <p class="rejoin"><b>Rejoin.</b> {inline(d['rejoin'])}</p>
  <div class="chiprow"><span class="smallnote">Bookings</span> {bk}</div>
  <div class="links">{btn('Map: ' + esc(base['name']), mapq(base['name'], base['park_or_area']), True)}{b_maps}</div>
  {det}
</section>"""


DAYS_HTML = f"""
<section class="intro" id="days">
  <p class="kick">Fifteen days</p>
  <h2>Day by day</h2>
  {md(plan_section("How the three tracks work"))}
  {LEGEND}
  <p class="smallnote">Chips link to the sight, trail or activity cards above. Notes, decision rules and wet-weather swaps are folded in each day.</p>
</section>
{"".join(day_html(d) for d in ITIN["days"])}"""

# ---------------------------------------------------------------- hazards, gotchas, state, questions, changelog
def counts(items):
    c = {"VERIFIED": 0, "INFERENCE": 0, "GAP": 0}
    for i in items:
        c[i["status"]] = c.get(i["status"], 0) + 1
    return c


rows = []
for name, items in [("Sights", SIGHTS), ("Trails", TRAILS), ("Adventures", ADVS), ("Bookings", BOOKS), ("Bases", list(BASES.values()))]:
    c = counts(items)
    rows.append([name, str(len(items)), str(c["VERIFIED"]), str(c["INFERENCE"]), str(c["GAP"])])
tot = [sum(int(r[i]) for r in rows) for i in range(1, 5)]
rows.append(["<b>Total</b>"] + [f"<b>{v}</b>" for v in tot])
miss_at = sum(1 for t in TRAILS if not t.get("alltrails_url"))
miss_off = sum(1 for t in TRAILS if not t.get("official_url"))
miss_sight = sum(1 for s in SIGHTS if not s.get("official_url"))
gap_adv_h = sum(1 for a in ADVS if a.get("min_height_cm") is None)
counts_html = tbl_plain(["Dataset", "Records", "Verified", "Inference", "GAP"], rows) + (
    f'<p class="smallnote">Computed from the data files. Missing links: {miss_at} trails without an AllTrails link, {miss_off} without an official link, '
    f'{miss_sight} sights without an official link. AllTrails links are search results and none was fetched. '
    f'{gap_adv_h} of {len(ADVS)} adventures have no minimum height found.</p>')

HAZ_HTML = f"""
<section class="intro" id="hazards">
  <p class="kick">Risk</p>
  <h2>Hazards</h2>
  {md(plan_section("Hazards"))}
</section>
<section class="intro" id="gotchas">
  <p class="kick">Read before booking</p>
  <h2>Gotchas / Known issues</h2>
  {md(plan_section("Gotchas / Known issues"))}
</section>
<section class="intro" id="state">
  <p class="kick">Honest</p>
  <h2>State of knowledge</h2>
  {counts_html}
  {md(plan_section("State of knowledge"))}
</section>
<section class="intro" id="questions">
  <p class="kick">For you</p>
  <h2>Open questions</h2>
  {md(plan_section("Open questions for you"))}
</section>
<section class="intro" id="changelog">
  <h2>Change log</h2>
  {md(plan_section("Change log"))}
</section>"""

# ---------------------------------------------------------------- quick links + checklist
def bk_url(i):
    return B_BY[i].get("book_url") or ""


QUICK = f"""
<section class="quick" id="quick">
  <h2>Day-of links</h2>
  <p class="qsub">The handful actually tapped in the field</p>
  <div class="qgrid">
    <div class="qcard"><h4><span class="dot" style="background:var(--class-4)"></span>Shuttles and roads</h4>
      {('<a href="' + esc(bk_url("shuttle-moraine-lakelouise")) + '"><b>Moraine Lake shuttle</b>Parks Canada, reserve ahead</a>') if bk_url("shuttle-moraine-lakelouise") else ""}
      {('<a href="' + esc(bk_url("icefields-parkway")) + '"><b>Icefields Parkway</b>Road information</a>') if bk_url("icefields-parkway") else ""}
    </div>
    <div class="qcard"><h4><span class="dot" style="background:var(--class-1)"></span>Weather and fire</h4>
      <p class="smallnote">Check the Alberta wildfire app and fire bans before each Parkway day (see Hazards). No cell signal on the Icefields Parkway.</p>
    </div>
    <div class="qcard"><h4><span class="dot" style="background:var(--class-2)"></span>Emergency</h4>
      <a class="tel" href="tel:911"><b>911</b>Everywhere</a>
      <a class="tel" href="tel:+14037621470"><b>403-762-1470</b>Banff dispatch</a>
      <a class="tel" href="tel:+17808526155"><b>780-852-6155</b>Jasper dispatch</a>
      <a class="tel" href="tel:+14037621460"><b>403-762-1460</b>Banff warden</a>
    </div>
  </div>
</section>"""

CHECK_ITEMS = [
    ("lodging", "Lodging booked on refundable rates: Banff 2, Lake Louise 1 + 4, Jasper 4, Kananaskis Village 3"),
    ("shuttle", "Moraine Lake shuttle seats booked (40% of seats open in April, the rest 48 hours ahead in the 2026 pattern)"),
    ("pass", "Parks Canada pass sorted; Kananaskis Conservation Pass for Kananaskis (the Parks Canada pass does not cover it)"),
    ("spray", "Bear spray bought or rented on Day 1 (it cannot fly, even checked)"),
    ("booster", "Booster seat packed (BC: until age 9 or 145 cm)"),
    ("closures", "Closures re-checked before leaving (Maligne Canyon, Johnston Canyon, Cavell, Opal Hills, Upper Kananaskis Lake)"),
    ("rota", "Split-day rota agreed, with a turnaround time and a hard collect time for each solo hike"),
    ("layers", "Warm layers packed for every day above 2,000 m"),
]
checklist = "".join(f'<label><input type="checkbox" data-k="{k}"><span>{t}</span></label>' for k, t in CHECK_ITEMS)
CHECK = f"""
<section id="essentials">
  <h2>Before you go</h2>
  <div class="grid2">
    <div class="panel check"><h3>Checklist</h3><div id="checklist">{checklist}</div>
      <p class="mono" style="font-size:.72rem;margin-top:10px">Ticks are saved in this browser.</p></div>
    <div class="panel"><h3>Countdown</h3>
      <p>Fly Toronto to Calgary on Sat 8 Sep 2029; fly home from Calgary on Sat 22 Sep.</p>
      <p class="bigcd"><strong id="cd">&mdash;</strong> until 8 Sep 2029</p></div>
  </div>
</section>"""

# ---------------------------------------------------------------- nav + context
NAV = '<a class="home" href="/">&#8592; All plans<span class="d">dashboard</span></a>' + "".join(
    f'<a href="#{i}"><span class="d">{d}</span>{n}</a>' for i, d, n in [
        ("answer", "14 nights", "Answer"),
        ("orient", "Read first", "Orientation"),
        ("sights", "See", "Sights"),
        ("trails", "Walk", "Trails"),
        ("gallery", "Look", "Photos"),
        ("bookings", "When", "Bookings"),
        ("adventures", "Limits", "Adventures"),
        ("days", "15 days", "Day by day"),
        ("hazards", "Risk", "Hazards"),
        ("gotchas", "Known", "Gotchas"),
        ("state", "Honest", "Knowledge"),
        ("questions", "For you", "Questions"),
        ("changelog", "History", "Change log"),
        ("quick", "In the field", "Links"),
        ("essentials", "Tick off", "Checklist"),
    ])

HERO = GAL["sections"][0]["photos"][0]
CHIPS = ('<span class="chip"><strong id="countdown">&mdash;</strong></span>' + "".join(
    f'<span class="chip"><strong>{a}</strong> {b}</span>' for a, b in [
        ("14", "nights"), ("Sat 8 &ndash; Sat 22 Sep 2029", ""), ("4", "bases"), ("2026", "data, a pattern for 2029")]))

CTX = {
    "slug": "canadian-rockies-sept-2029",
    "trip_date": "2029-09-08",
    "trip_dates": "8 &ndash; 22 Sep 2029",
    "trip_duration": "14 nights",
    "trip_region": "Canadian Rockies, Alberta &amp; British Columbia",
    "title": "Canadian Rockies &mdash; 14 nights, September 2029",
    "description": ("Fourteen nights in Banff, Lake Louise, Jasper and Kananaskis with a child of about six: every day has an "
                    "adult-only hike, a family option in the same area and a low-walking fallback. "
                    "Built from 2026 figures; nothing for 2029 is published yet."),
    "hero_image": commons(HERO["file"], 2000),
    "hero_credit": (f'<a href="{filepage(HERO["file"])}">{esc(HERO["caption"])} &middot; {esc(HERO["author"])} &middot; '
                    f'{esc(HERO["license"])} &middot; Wikimedia Commons</a>'),
    "eyebrow": "Sat 8 &ndash; Sat 22 Sep 2029 &middot; Alberta and British Columbia",
    "headline": "Canadian Rockies",
    "sub": "Fourteen nights between Banff, Jasper and Kananaskis, with a hike for the adults and a walk for the six year old every day.",
    "chips": CHIPS,
    "nav": NAV,
    "body": ANSWER + ORIENT + SIGHTS_HTML + TRAILS_HTML + BOOKINGS_HTML + ADV_HTML + DAYS_HTML + HAZ_HTML + QUICK + CHECK,
    "footer": ('Planned from seven research files in <span class="mono">~/workspace/travel/canadian-rockies-sept-2029/</span>. '
               'Photographs from <a href="https://commons.wikimedia.org/">Wikimedia Commons</a>, each credited. '
               '<b>Every price, timetable, season and closure is a 2026 figure used as a pattern; nothing for 2029 is published. '
               'Re-check closures, shuttle dates and lodging before booking.</b>'),
    "extra_css":
        "nav a.home{color:var(--highlight-on-deep);font-weight:600;"
        "border-right:1px solid color-mix(in srgb, var(--highlight-on-deep) 32%, transparent);margin-right:6px}"
        "nav a.home:hover{color:var(--header-ink)}"
        ".panel p + p{margin-top:11px}.intro p + p{margin-top:11px}"
        ".area .days{font-family:var(--font-mono);font-size:.68rem;letter-spacing:.06em}"
        ".area figure{overflow:hidden}.area figcaption{position:static;display:block;padding:5px 10px;"
        "background:var(--bg-deep);color:var(--ink-on-deep);font-size:.64rem}"
        ".area figcaption a{color:var(--highlight-on-deep)}"
        ".intro table,.panel table{width:100%}"
        ".tw{overflow-x:auto;margin:14px 0}.tw table{min-width:640px}"
        ".tw table.adv{min-width:1000px}.tw table.bk{min-width:900px}.tw table.opts{min-width:760px}"
        ".inf{font-family:var(--font-mono);font-size:.68rem;letter-spacing:.04em;text-transform:uppercase;"
        "border:1px solid var(--line);border-radius:3px;padding:0 5px;color:var(--muted);white-space:nowrap}"
        ".inf.gap{border-color:var(--warn);color:var(--warn)}.inf.ok{color:var(--accent-dark);border-color:var(--accent)}"
        ".warnbar{background:var(--warn-soft);border-left:6px solid var(--warn);color:var(--ink);"
        "padding:16px 20px;border-radius:4px;font-size:1rem;line-height:1.5}"
        "#answer{padding-top:28px}.answerstrip{margin-top:18px;grid-template-columns:repeat(4,minmax(0,1fr))}"
        ".plainlist{margin:8px 0 8px 20px;max-width:90ch}.plainlist li{margin-bottom:6px}"
        ".smallnote{font-size:.82rem;color:var(--muted);margin-top:6px}.muted{color:var(--muted)}"
        ".subh{margin:26px 0 8px}.parkh{border-bottom:2px solid var(--line);padding-bottom:6px;display:flex;gap:10px;align-items:center}"
        ".bigcd{font-size:1.1rem}.bigcd strong{font-family:var(--font-mono);font-size:1.6rem}"
        "#opt-rec td{background:var(--highlight-soft)}"
        "details.bigmore{margin:14px 0;padding:10px 14px;background:var(--surface);border:1px solid var(--line);border-radius:10px}"
        "details.bigmore summary{font-size:.8rem}"
        "details.bigmore table{margin-top:8px}"
        # card grids
        ".sgrid,.tgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:14px;margin:12px 0 8px}"
        ".sg,.tc{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:14px 16px;min-width:0;"
        "overflow:hidden;display:flex;flex-direction:column;gap:6px}"
        ".sg h4,.tc h4{font-family:var(--font-display);font-size:1.05rem;line-height:1.25;display:flex;gap:8px;"
        "align-items:flex-start;flex-wrap:wrap}"
        ".tn{display:flex;gap:8px;align-items:flex-start;min-width:0}"
        ".tc h4 .mark{width:12px;height:20px;flex:0 0 auto;margin-top:2px}"
        ".sg .meta,.tc .meta{font-family:var(--font-mono);font-size:.68rem;color:var(--muted);letter-spacing:.03em}"
        ".sg p,.tc p{font-size:.9rem;margin:0}.sg .child,.tc .child{color:var(--ink)}"
        ".tc .stats{margin:2px 0 0}.tc .links,.sg .links{margin-top:6px}"
        ".tc .alt{background:var(--accent-soft);border-radius:6px;padding:5px 9px;font-size:.86rem}"
        ".usedon{font-family:var(--font-mono);font-size:.68rem;color:var(--muted)}"
        ".tc.lw .chiprow{margin-top:4px}"
        ".tc details.more,.sg details.more{margin-top:6px}.tc details.more p,.sg details.more p{margin-top:6px}"
        # chips
        ".chiprow{display:flex;flex-wrap:wrap;gap:6px;align-items:center}"
        ".chipl{display:inline-flex;gap:6px;align-items:center;font-size:.78rem;line-height:1.25;text-decoration:none;"
        "border:1px solid var(--line);border-radius:999px;padding:3px 10px 3px 6px;background:var(--surface);color:var(--ink)}"
        ".chipl:hover{background:var(--accent-soft);border-color:var(--accent)}"
        ".chipl .mark{width:8px;height:14px;border-width:1px;box-shadow:none;flex:0 0 auto}"
        ".chipl small{font-family:var(--font-mono);color:var(--muted);font-size:.62rem;text-transform:uppercase}"
        # adventures
        ".child6{display:inline-block;font-family:var(--font-mono);font-size:.74rem;font-weight:700;padding:3px 9px;border-radius:5px;"
        "border:1.5px solid var(--line);white-space:nowrap}"
        ".child6--yes{background:var(--accent-soft);color:var(--accent-dark);border-color:var(--accent)}"
        ".child6--no{background:var(--warn-soft);color:var(--warn);border-color:var(--warn)}"
        ".child6--with_adult{background:var(--highlight-soft);color:var(--highlight-ink);border-color:var(--highlight)}"
        ".child6--unknown{background:var(--bg);color:var(--muted);border:1.5px dashed var(--muted)}"
        ".legend .b.child6--yes{background:var(--accent-soft);border-color:var(--accent)}"
        ".legend .b.child6--no{background:var(--warn-soft);border-color:var(--warn)}"
        ".legend .b.child6--with_adult{background:var(--highlight-soft);border-color:var(--highlight)}"
        ".legend .b.child6--unknown{background:var(--bg);border:1.5px dashed var(--muted)}"
        "table.adv td{font-size:.84rem}table.adv details.more{margin-top:0;border-top:0;padding-top:0}"
        "table.adv .links{margin-top:0;gap:4px;max-width:150px}table.adv .btn{padding:4px 8px}table.adv td:nth-child(6) summary{white-space:nowrap}"
        "table.bk td{font-size:.84rem}table.bk details summary{white-space:nowrap}"
        "table.bk td{font-size:.84rem}table.bk details.more{margin-top:0;border-top:0;padding-top:0}"
        "table.bk .links,table td .btn{display:inline-block}"
        "table td .btn{margin:2px 0}"
        # days
        ".sign h2 .split{vertical-align:middle;margin-left:8px;font-size:.62rem}"
        ".daydrive,.daysum,.rejoin{margin-top:12px;font-size:.94rem;max-width:100ch}"
        ".dcols{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:16px}"
        ".dcol{background:var(--surface);border:1px solid var(--line);border-top:5px solid var(--line);border-radius:10px;"
        "padding:12px 14px;min-width:0;overflow:hidden}"
        ".dcol--1{border-top-color:var(--class-1)}.dcol--3{border-top-color:var(--class-3)}.dcol--6{border-top-color:var(--class-6)}"
        ".dcol h4{font-family:var(--font-display);text-transform:uppercase;letter-spacing:.04em;font-size:1rem;"
        "display:flex;gap:8px;align-items:center}"
        ".dcol h4 .mark{width:10px;height:18px}"
        ".dcol .sub2{font-family:var(--font-mono);font-size:.68rem;color:var(--muted);margin-top:2px}"
        ".dcol .dtitle{font-weight:600;font-size:.92rem;margin:8px 0}"
        ".dcol--none{background:var(--bg);border-style:dashed}"
        ".dcol .chiprow{margin-bottom:6px}.dcol details.more p{font-size:.84rem}"
        ".bookchip{border-style:dashed}"
        ".day .chiprow{margin-top:10px}.day > .links{margin-top:12px}"
        "section.day{border-top:1px solid var(--line);margin-top:30px}"
        "@media(max-width:860px){.dcols{grid-template-columns:1fr}}"
        "@media(max-width:760px){.answerstrip{grid-template-columns:repeat(2,minmax(0,1fr))}}",
}

html_out = S.assemble(CTX, THEME)
problems = S.check_output_is_self_contained(html_out)
if problems:
    raise SystemExit("SELF-CONTAINMENT FAILED:\n  " + "\n  ".join(problems))
out = HERE / "index.html"
out.write_text(html_out, encoding="utf-8")
print(f"wrote {out}  ({len(html_out):,} bytes, theme={THEME})")

# Photo gallery is data (gallery.json) injected after the trails section; a rebuild would otherwise erase it.
import gallery as G   # noqa: E402  (_system/gallery.py)
G.inject(G.load(str(HERE / "gallery" / "gallery.json")), out, after="trails")
