#!/usr/bin/env python3
"""Build usa-southwest-rockies/index.html from _system components.
Run: python3 build_page.py
Photos come from photos.json, produced by fetch_photos.py — every URL there was returned
by the Commons imageinfo API, so it resolves. Nothing is hand-typed into the page."""
import sys, json, urllib.parse
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "_system"))
import build as S   # noqa: E402

THEME = "desert"
PH = json.loads((HERE / "photos.json").read_text())


# ---------- helpers -------------------------------------------------------------------
def filepage(fn):
    return "https://commons.wikimedia.org/wiki/File:" + urllib.parse.quote(fn.replace(" ", "_"))


def _pretty(fn):
    t = fn.rsplit(".", 1)[0].replace("_", " ")
    return (t[:70] + "…") if len(t) > 70 else t


def gal(key, n=4, alt=""):
    """Scroll-snap gallery. CSS only — base.js owns behaviour, pages do not add script."""
    items = PH.get(key, [])[:n]
    if not items:
        return ""
    figs = "".join(
        f'<figure><a href="{filepage(i["file"])}" target="_blank" rel="noopener">'
        f'<img loading="lazy" src="{i["thumb"]}" alt="{alt or _pretty(i["file"])}"></a>'
        f'<figcaption>{_pretty(i["file"])}</figcaption></figure>'
        for i in items)
    return f'<div class="gal" role="group" aria-label="Photos: {alt or key}">{figs}</div>'


def lead(key, alt=""):
    """Single establishing image for the orientation area cards."""
    items = PH.get(key, [])
    if not items:
        return ""
    i = items[0]
    return (f'<figure><img loading="lazy" src="{i["thumb"]}" alt="{alt}">'
            f'<figcaption><a href="{filepage(i["file"])}">Wikimedia Commons</a></figcaption></figure>')


def mapq(*parts):
    return "https://maps.google.com/?q=" + urllib.parse.quote_plus(", ".join(parts))


def embed(place, z=9):
    return f"https://maps.google.com/maps?q={urllib.parse.quote_plus(place)}&z={z}&output=embed"


def stop(cls, time, title, body, tag=None, stats=None, links=None, photos=None,
         more=None, note=None):
    t = f'<span class="time">{time}</span>' if time else ""
    tg = f' <span class="tag tag--{tag[0]}">{tag[1]}</span>' if tag else ""
    st = ('<div class="stats">' + "".join(f"<span><b>{a}</b> {b}</span>" for a, b in stats)
          + "</div>") if stats else ""
    lk = ('<div class="links">' + "".join(
        f'<a class="btn{" primary" if p else ""}" href="{u}" target="_blank" rel="noopener">{n}</a>'
        for n, u, p in links) + "</div>") if links else ""
    md = f'<details class="more"><summary>{more[0]}</summary>{more[1]}</details>' if more else ""
    nt = f'<div class="note">{note}</div>' if note else ""
    g = gal(*photos) if photos else ""
    return (f'<div class="stop"><span class="mark mark--{cls}"></span>'
            f'<div class="card"><div class="content">{t}<h3>{title}{tg}</h3>{body}'
            f'{st}{lk}{g}{md}{nt}</div></div></div>')


CLASSES = [
    ("light", "Timed to the light — dawn or dusk, not negotiable"),
    ("road",  "Driving leg"),
    ("book",  "Book ahead — lottery, cap or sell-out"),
    ("trail", "On foot — real footing"),
]
LEGEND = '<div class="legend">' + "".join(
    f'<span><i class="b" style="background:var(--class-{i+1})"></i>{n}</span>'
    for i, (_, n) in enumerate(CLASSES)) + "</div>"


def day(sid, dow, num, h2, route, meta, stops, place, z=9):
    m = "".join(f"<span>{a} <b>{b}</b></span>" for a, b in meta)
    return f"""
<section class="day" id="{sid}">
  <div class="sign">
    <div class="date"><span class="dow">{dow}</span><span class="num">{num}</span></div>
    <div class="body"><h2>{h2}</h2><p class="route">{route}</p></div>
  </div>
  <div class="daymeta">{m}</div>
  <div class="trail">{"".join(stops)}</div>
  <div class="mapframe"><iframe loading="lazy" title="{place}" src="{embed(place, z)}"></iframe>
    <div class="bar"><span>{place}</span>
    <a href="{mapq(place)}" target="_blank" rel="noopener">Open in Maps</a></div></div>
  {LEGEND}
</section>"""


# ---------- orientation ---------------------------------------------------------------
AREAS = [
    ("bryce", "Zion &amp; Bryce", "Days 1–5",
     "Canyon from the inside, then hoodoo amphitheatre from the rim. The two most vertical "
     "experiences of the trip, 90 minutes apart."),
    ("hwy12", "Scenic Byway 12", "Day 5",
     "A 123-mile drive over the Hogback and Boulder Mountain, with a waterfall walk in the "
     "middle. It replaces the old Hanksville detour and is a destination in its own right."),
    ("capitolreef", "Capitol Reef", "Days 5–7",
     "A hundred-mile buckle in the earth's crust, with a Mormon orchard settlement in the "
     "middle of it. The quietest of Utah's five parks by a wide margin."),
    ("delicate", "Moab", "Days 7–10",
     "Arch density found nowhere else on earth, plus the Island in the Sky mesa and the best "
     "sunrise on the Colorado Plateau. The trip ends on its strongest ground."),
]
areas_html = "".join(
    f'<div class="area">{lead(k, name)}<div class="ab"><h3>{name}</h3>'
    f'<p class="days">{days}</p><p>{txt}</p></div></div>'
    for k, name, days, txt in AREAS)

ORIENT = f"""
<section id="orient">
  <h2>What this place actually is</h2>
  <div class="intro">
    <p>Five national parks in eleven days, with one base per park and no day spent only in the
    car.</p>
    <p>The <b>Colorado Plateau</b> is a slab of sedimentary rock roughly the size of Poland,
    lifted almost intact and almost level about 1,500&nbsp;m into the sky. Because it rose
    without crumpling, the layers stayed flat — so rivers cut <i>down</i> through them instead
    of being deflected sideways. Everything you look at follows from that: canyons with
    squared-off walls, mesas with flat tops, arches and spires left standing where soft rock
    eroded from beneath a hard cap. The colours are iron and manganese staining the
    sandstone.</p>
    <p>One place breaks the pattern, and it is on this route. The <b>Waterpocket Fold</b> at
    Capitol Reef is a hundred-mile wrinkle where the crust did buckle, tilting the layers on
    edge so you drive past a cross-section of 200 million years in an afternoon.</p>
  </div>

  <h2>Why it is famous — the specific things</h2>
  <div class="intro">
    <p><b>Reflected light.</b> In a deep canyon the sun never reaches the floor directly; it
    hits one wall and bounces, and the bounced light is orange. That is the whole reason
    Mesa Arch is photographed at sunrise — the underside of the arch is lit from below, by
    light reflected off a cliff 500&nbsp;m beneath it.</p>
    <p><b>Density.</b> The Windows section of Arches has the highest arch density per step anywhere. Bryce is a huge field of hoodoos
    seen from above; Zion is the opposite view, from the floor
    of the canyon looking up.</p>
    <p><b>What was left out, and why it is not a loss.</b> The earlier version of this plan also
    ran through Page and Monument Valley. Antelope Canyon, Horseshoe Bend and Monument Valley
    are among the most photographed places in the Southwest, and cutting them is a real
    trade. What they cost was <b>four nights, an hour of clock confusion twice, the trip's
    hardest sell-out and a Navajo-time booking</b>. They make a good trip of their own later.</p>
  </div>

  <h2>The four regions</h2>
  <div class="areas">{areas_html}</div>

  <h2>The trip in numbers</h2>
  <div class="numstrip">
    <span><b>10</b> nights</span><span><b>5</b> bases</span>
    <span><b>~800</b> mi road driving</span><span><b>~1,300</b> km</span>
    <span><b>5</b> Utah parks — all of them</span><span><b>0</b> dirt roads</span>
  </div>
</section>"""

KNOW = """
<section id="know">
  <h2>Six things to know before reading the days</h2>
  <div class="know">
    <div class="qcard"><h3>1 &middot; Nights per park, and the evidence</h3><p>No official
    source publishes a recommended number of days for any of these parks — the split here comes
    from NPS hour and distance figures plus about a dozen trip reports. <b>Bryce: one night</b>,
    near-universal. <b>Capitol Reef: two</b>, the park people most often wish they had given
    more. <b>Moab: three</b>, the common split for Arches plus Island in the Sky. <b>Zion:
    three</b>, because the Narrows is a firm goal — two is the mainstream answer without it.</p></div>

    <div class="qcard"><h3>2 &middot; Highway 12 is the longest day</h3><p>Bryce to Torrey is
    123&nbsp;mi and about 3&nbsp;h without stopping; add Lower Calf Creek Falls and it is a
    full day. The route is fully paved and peaks near 9,600&nbsp;ft. The <b>Hogback section has
    no guardrail</b> — drive it, do not photograph it from the driver's seat.</p></div>

    <div class="qcard"><h3>3 &middot; Fuel gaps are short but real</h3>
    <p>One source describes a <b>40-mile stretch between Torrey and Escalante with no
    services</b>; whether Boulder has a working pump is unverified. Fill up in Escalante or
    Torrey. Between Torrey and I-70 the only fuel is <b>Hanksville</b> (about 81&nbsp;mi), which
    has two public stations, Hollow Mountain and Stan's.</p></div>

    <div class="qcard"><h3>4 &middot; Everything is paved now</h3>
    <p>Dropping the Hanksville badlands and Moki Dugway takes out every dirt road on the plan,
    and with them the rental-insurance problem on unpaved roads. <b>Burr Trail is paved only
    to the Capitol Reef boundary and Hell's Backbone is gravel</b>, so both stay off the list.
    Mapping apps will still offer the <b>Shafer Trail</b> — see day 9.</p></div>

    <div class="qcard"><h3>5 &middot; &ldquo;Later is quieter&rdquo; is false here</h3>
    <p>NPS visitation data shows <b>October is busier than September at Zion and Arches</b>.
    Shifting the trip later in autumn buys you nothing crowd-wise in Utah — it only costs you
    warmth and daylight.</p></div>

    <div class="qcard"><h3>6 &middot; Almost nothing pins the dates</h3>
    <p>With the Navajo parks gone, <b>the only date-sensitive item found in the research is the
    Narrows</b>, which turns dry-suit cold around 1&nbsp;October. Utah's parks are open
    year-round, and no 2026–27 closure was found on UT-12 or UT-24. The other real constraints
    are heat in summer and the Kanarra Falls permit cap.</p></div>
  </div>
</section>"""

DATES = """
<section id="dates">
  <h2>When to go — the window is wide</h2>
  <div class="panel">
    <p><b>Best: the second half of September.</b> Utah has cooled from its 100–110&nbsp;°F
    summer to roughly 75–85&nbsp;°F, the Narrows is still in the wetsuit-and-boots window, and
    Bryce is near freezing only at dawn.</p>
    <p><b>The one date that bites is 1 October:</b> Narrows outfitters switch to dry suits as
    the water hits 3–7&nbsp;°C. If the Narrows is the point of the Zion days, book before it.
    If it is not, the plan barely cares.</p>
    <p><b>Also workable: mid-May to early June</b> — before the heat and with long days,
    though spring runoff can close the Narrows entirely and Kanarra Falls runs cold and high.</p>
    <p><b>Avoid July and August.</b> Moab at 105&nbsp;°F is not a holiday, and Zion and Arches
    are at their busiest.</p>
  </div>
</section>"""

ASSUME = """
<section id="assume">
  <h2>Assumptions taken</h2>
  <p class="introwide">Dates are not booked and a few decisions were left open, so the plan takes
  a position rather than stalling. <b>Every one is a real choice that can be reversed</b> —
  none is a silent default.</p>
  <div class="panel">
  <table>
  <tr><th>Assumption</th><th>Why, and how to reverse it</th></tr>
  <tr><td><b>Utah only: Page, Antelope Canyon, Horseshoe Bend and Monument Valley are
      out</b></td>
      <td>Four nights, two clock changes and the trip's worst sell-out saved. To put one back,
      the cheapest is Page for one night between Bryce and Torrey — but that gives up
      Highway 12, so it is a swap, not an addition.</td></tr>
  <tr><td><b>Angels Landing → plan Scout Lookout</b>, but enter the permit lottery anyway</td>
      <td>The chains have sustained exposure above a ~1,000&nbsp;ft drop. Scout Lookout gives
      the same canyon view and stops before them. The permit is $6&nbsp;+&nbsp;$3/person —
      apply in the <b>1–20 July</b> lottery regardless and decide at the junction on the day.
      Reversing costs nothing.</td></tr>
  <tr><td><b>Bryce to Torrey by Highway 12</b></td>
      <td>It is the direct road, about 3&nbsp;h without stops, and the best drive on the trip. Lower Calf Creek
      Falls is optional — if you are not at its trailhead by 12:30, skip it and go straight
      to Torrey.</td></tr>
  <tr><td><b>Three nights at Zion, two at Capitol Reef, three at Moab</b></td>
      <td>Zion gets two full days (Narrows; Scout Lookout and Emerald Pools) plus an arrival
      night. Capitol Reef gets one full day, which the official trail list fills, and the second
      night is the arrival evening. Moab could be two nights on the official figures — Arches
      is about a day and Island in the Sky half a day — but Mesa Arch at dawn and Dead Horse
      at sunset cannot share a day comfortably. <b>Cutting Moab to two nights makes this a
      10-day trip.</b></td></tr>
  <tr><td><b>A regular SUV, not AWD</b></td>
      <td>The AWD requirement existed for the Moki Dugway and the Hanksville dirt. Every leg
      here is paved, so a standard SUV is enough.</td></tr>
  <tr><td><b>Bryce: Queen's Garden out-and-back</b>, not the classic combination</td>
      <td>The <b>Navajo Loop has been closed since Feb 2026</b> with no reopening date.
      Re-check at the visitor centre; if it has reopened, do the loop instead.</td></tr>
  <tr><td><b>One $250 non-resident America the Beautiful pass</b></td>
      <td>Covers the holder plus all passengers at all five parks. The +$100 non-resident
      surcharge applies only to those 16+, so the child is exempt either way. It does not cover
      Dead Horse Point, which is a state park.</td></tr>
  </table></div>
</section>"""

D1 = day("d1", "Days", "1–3", "Zion", "Las Vegas → Springdale · 165 mi / 2h40",
  [("Nights", "3 · Springdale"), ("Drive", "165 mi"), ("Note", "Shuttle-only canyon")],
  [
   stop(2, "Day 1", "Fly in, collect the car, drive to Springdale",
     "<p><b>A standard SUV is enough</b> now that every leg is paved, so AWD is optional. "
     "Confirm the contract permits US-wide use: the Nevada waiver block excludes operation "
     "outside NV/AZ/CA/ID/OR/UT — this route stays in NV and UT, so it is a check, not a risk.</p>",
     stats=[("165 mi", "LAS → Springdale"), ("2h40", "drive"), ("$250", "buy the pass")],
     links=[("Map", mapq("Springdale, Utah"), True)], photos=("vegas", 3, "Las Vegas")),
   stop(4, "Day 2", "Zion — the high day",
     "<p><b>Zion Canyon is shuttle-only in this season.</b> Private cars cannot drive the "
     "Scenic Drive, so the day is planned around shuttle timing, not parking. Start at the "
     "first shuttle: the West Rim switchbacks face east and cook by mid-morning.</p>"
     "<p>Scout Lookout is the baseline; the chains beyond it are a decision for the day.</p>",
     tag=("added", "Scout Lookout baseline"),
     stats=[("8.7 km", "Angels Landing RT"), ("~1,000 ft", "exposure beyond Scout"),
            ("$6 + $3pp", "permit lottery")],
     links=[("Angels Landing permit", "https://www.nps.gov/zion/planyourvisit/angels-landing-hiking-permits.htm", True),
            ("Zion alerts", "https://www.nps.gov/zion/planyourvisit/conditions.htm", False)],
     photos=("angels", 4, "Angels Landing"),
     more=("Why Canyon Overlook is the evening, not the morning",
       "<p>Canyon Overlook is on SR-9 and is <b>not</b> shuttle-restricted, so you drive to "
       "it. That makes it the one piece of the day you control entirely — which is why it "
       "holds the sunset slot rather than competing with shuttle queues at dawn.</p>")),
   stop(4, "Day 3", "Zion — the water day",
     "<p><b>The Narrows, bottom-up</b> from Temple of Sinawava. This is an out-and-back, so "
     "the 12&nbsp;km ceiling manages itself — turn round when you have had enough.</p>"
     "<p><b>Water is 3–7&nbsp;°C.</b> Outfitters switch to dry suits on 1 October; in "
     "mid-September you are in the wetsuit-and-boots window. Rent boots and a stick — "
     "trainers do not work on that riverbed.</p>",
     stats=[("9.7 km", "to Wall Street"), ("16.1 km", "Big Spring — over ceiling"),
            ("3–7 °C", "water")],
     links=[("Narrows conditions", "https://www.nps.gov/zion/planyourvisit/thenarrows.htm", True)],
     photos=("narrows", 4, "The Narrows"),
     note="<b>Decision rule — flash flood.</b> The Narrows closes on flow rate and forecast, "
          "not on whether it is raining where you stand. Check the flash-flood potential "
          "rating that morning. If it reads &ldquo;Expected&rdquo; or above, the Narrows is "
          "off — substitute the Watchman Trail and move Canyon Overlook into this day."),
  ], "Zion National Park, Utah", 10)


D4 = day("d4", "Days", "4–5", "Kanarra Falls &amp; Bryce", "Zion → Kanarraville → Bryce · ~135 mi",
  [("Nights", "1 · Bryce area"), ("Drive", "~135 mi"), ("Note", "Book Kanarra in January")],
  [
   stop(3, "Day 4 · early", "Kanarra Falls",
     "<p>A creek walk with ladders, 40 minutes north of Zion. Wet feet are guaranteed and "
     "that is the point — it is the trip's best &lsquo;we did something unusual&rsquo; day "
     "and it suits an 11-year-old better than anything else in Utah.</p>",
     tag=("unmissable", "150 permits/day"),
     stats=[("$15", "per person"), ("150/day", "hard cap"), ("1 Jan", "whole year releases")],
     links=[("Permits", "https://kanarrafalls.com/", True)], photos=("kanarra", 4, "Kanarra Creek"),
     note="<b>Book this in January.</b> The entire year releases on 1 January and most peak "
          "days sell out roughly a month ahead. Miss it and there is no substitute."),
   stop(1, "Day 4 · sunset", "Bryce — Sunset Point",
     "<p>Drive Kanarraville → Bryce, 90&nbsp;mi / 1h45. Sunset Point is named for a reason, "
     "though Inspiration Point is the better light if there is cloud.</p>",
     stats=[("90 mi", "drive"), ("~8,000 ft", "elevation")],
     links=[("Map", mapq("Bryce Canyon National Park, Utah"), True)],
     photos=("bryce", 4, "Bryce Canyon")),
   stop(1, "Day 5 · dawn", "Bryce sunrise, then down into the amphitheatre, then Highway 12",
     "<p>The amphitheatre faces east — this is the best sunrise of the Utah block and worth "
     "the cold start. At ~8,000&nbsp;ft it will be near freezing at dawn in mid-September.</p>"
     "<p>Then <b>Queen's Garden down and back up the same way</b>, plus a Rim Trail segment.</p>",
     stats=[("2.9 km", "Queen's Garden RT"), ("600 ft", "climb back out")],
     photos=("queensgarden", 4, "Queen's Garden"),
     note="<b>GPX trap.</b> The Queen's Garden/Navajo combination is the most-downloaded route "
          "in Bryce, and <b>the Navajo arm has been closed since February 2026</b>. Every "
          "saved track leads you down and into a barrier with a 600&nbsp;ft climb back out and "
          "no signal. Verify at the visitor centre that morning."),
  ], "Bryce Canyon National Park, Utah", 10)


D5 = day("d5", "Day", "5", "Scenic Byway 12", "Bryce → Escalante → Boulder → Torrey · 123 mi / ~3h without stops",
  [("Nights", "1 of 2 · Torrey"), ("Drive", "123 mi"), ("Note", "Longest day of the trip")],
  [
   stop(2, "Day 5 · morning", "Bryce sunrise, then leave",
     "<p>Sunrise and the Queen's Garden descent are on the day 4–5 card above. Whatever you do "
     "at the rim, <b>be on the road by about 10:00</b> — the rest of the day is a schedule.</p>",
     stats=[("123 mi", "Bryce → Torrey"), ("~3 h", "no stops"), ("9,600 ft", "highest point")]),
   stop(3, "Day 5 · midday", "Lower Calf Creek Falls",
     "<p>A 126&nbsp;ft waterfall at the end of a sandy canyon walk. <b>6.0&nbsp;mi (9.7&nbsp;km) "
     "round trip</b>, about 500&nbsp;ft of gain, and BLM calls it a good introductory Escalante "
     "hike suitable for families. It is under the 12&nbsp;km ceiling but it is soft sand and "
     "usually unshaded, so start with all the water you own.</p>"
     "<p>Budget <b>3–3.5 hours</b> including the walk to the trailhead. The day-use fee is "
     "$5 per vehicle, and the pass does not cover it.</p>",
     tag=("added", "replaces the Hanksville detour"),
     stats=[("9.7 km", "round trip"), ("126 ft", "falls"), ("$5", "per vehicle")],
     links=[("BLM Lower Calf Creek", "https://www.blm.gov/visit/lower-calf-creek-falls-trail", True)],
     photos=("calfcreek", 4, "Calf Creek"),
     note="<b>Decision rule — optional.</b> If you are not at the trailhead by 12:30, skip it: "
          "Bryce to Torrey is about 3&nbsp;h without stops, and a 3.5&nbsp;h hike on top pushes "
          "arrival past 17:00. <i>Unverified: the elevation gain and the 2.5–3 h hike time came "
          "from search-result summaries of BLM's brochure, and the site reopened in September "
          "2024 after a closure — check the BLM page before going.</i>"),
   stop(1, "Day 5 · afternoon", "The Hogback, Boulder Mountain and into Torrey",
     "<p>The road tops out near 9,600&nbsp;ft on Boulder Mountain and crosses the "
     "<b>Hogback</b>, a narrow ridge with <b>no guardrail</b>. It is fully paved, and the "
     "one UDOT culvert job on it (mile 6–7) finished in June 2026; no other 2026–27 closure "
     "was found on UT-12.</p>"
     "<p><b>Fuel:</b> one guide describes a 40-mile stretch between Torrey and Escalante with "
     "no services, and Boulder's pump is unverified. Fill in Escalante or Torrey.</p>",
     stats=[("40 mi", "possibly no services"), ("no rail", "the Hogback")],
     photos=("hwy12", 4, "Scenic Byway 12"),
     more=("Other stops on the way, if a child needs a break",
       "<p>Anasazi State Park museum in Boulder takes 1–2&nbsp;h, and Kiva Koffee is a "
       "30–45 minute stop. <b>Skip Burr Trail and Hell's Backbone:</b> Burr Trail is paved only "
       "to the Capitol Reef boundary and NPS lists it as high-clearance today, and Hell's "
       "Backbone is gravel.</p>")),
  ], "Boulder, Utah", 9)

DCR = day("dcr", "Day", "6", "Capitol Reef", "Torrey · the quietest of Utah's five parks",
  [("Nights", "2 · Torrey"), ("Drive", "park only"), ("Note", "No timed entry, no queue")],
  [
   stop(4, "Day 6 · morning", "Hickman Bridge and the Hwy 24 corridor",
     "<p><b>Hickman Bridge — ~3&nbsp;km round trip, 400&nbsp;ft up</b> to a 133&nbsp;ft natural "
     "bridge. Short, and the best value walk in the park.</p>"
     "<p>Along Hwy&nbsp;24 itself: the <b>Fremont petroglyph panel</b> on a boardwalk right by "
     "the road, and the Behunin cabin. This is the one park on the trip where the roadside "
     "stops are genuinely worth stopping for.</p>",
     stats=[("3 km", "Hickman RT"), ("400 ft", "gain"), ("133 ft", "bridge span")],
     links=[("Capitol Reef", "https://www.nps.gov/care/index.htm", True)],
     photos=("capitolreef", 4, "Capitol Reef")),
   stop(4, "Day 6 · midday", "The Scenic Drive, Grand Wash and Fruita",
     "<p>The <b>Scenic Drive</b> runs 8&nbsp;mi south along the fold, with <b>Grand Wash</b> — a "
     "flat walk into a narrow canyon, easy and shaded — off it. <b>Cassidy Arch</b> is the "
     "bigger objective at ~5.5&nbsp;km with 670&nbsp;ft of climb, ending on top of the arch "
     "rather than under it.</p>"
     "<p><b>Fruita</b> is a Mormon orchard settlement inside the park. In season you can pick "
     "fruit in the historic orchards, and the Gifford House sells pie that is not a gimmick.</p>",
     tag=("easy", "no permits, no lottery"),
     stats=[("8 mi", "Scenic Drive"), ("5.5 km", "Cassidy Arch RT"), ("670 ft", "gain")],
     note="<b>Cathedral Valley is out.</b> The loop fords the Fremont River and NPS lists it "
          "<b>Impassable</b>. Do not let a blog route you into the ford. "
          "<i>Unverified: the Scenic Drive fee and the Gifford House seasonal closing date.</i>",
     more=("Why this park is empty and the others are not",
       "<p>Capitol Reef takes roughly a fifth of Zion's visitors. It has no timed entry, no "
       "shuttle and no permit lottery, because it has never needed them. After five days of "
       "queues and reservation windows, that is the actual attraction.</p>")),
  ], "Capitol Reef National Park, Utah", 10)


D9 = day("d9", "Days", "7–9", "Moab — Arches &amp; Canyonlands",
  "Torrey → Moab · 145 mi, then two full park days",
  [("Nights", "3 · north of town"), ("Drive", "145 mi + park"), ("Note", "Mesa Arch is dawn")],
  [
   stop(4, "Day 7 · optional", "Optional: Goblin Valley State Park",
     "<p><b>Not part of the core plan — take it only if the morning is going well.</b> It sits on "
     "the Torrey → Moab drive: a <b>12-mile paved dead-end spur</b> off UT-24 (Temple Mountain "
     "Road, then Goblin Valley Road), about 20&nbsp;mi north of Hanksville. The valley is a "
     "free-roaming field of small mushroom-shaped hoodoos, and the best place on the route for "
     "an 11-year-old to run around. If the GPS sends you onto dirt, it is the wrong road.</p>"
     "<p><b>Time added: about 2–2.5 h</b> — 24 extra miles (30–35 min, my estimate) plus about "
     "1.5 h on foot. Three Sisters is 250&nbsp;yd; a family covered ~1.3&nbsp;mi in the valleys in "
     "90 minutes; add Carmel Canyon (2.4&nbsp;km loop, scrambling) for a 2-hour visit. Leave "
     "Torrey by about 08:30 and you reach Moab around 14:30, which still leaves Delicate Arch "
     "at sunset (about 19:18).</p>",
     tag=("added", "optional"),
     stats=[("$20", "per vehicle"), ("+24 mi", "extra driving"), ("no shade", "90–100 °F possible")],
     links=[("Goblin Valley", "https://stateparks.utah.gov/parks/goblin-valley/", True)],
     photos=("goblin", 4, "Goblin Valley"),
     note="<b>Pass and rules.</b> It is a Utah state park: the America the Beautiful pass is "
          "<b>probably not valid</b> (sources conflict — call 435-259-3710). Climbing sturdy "
          "hoodoos is allowed per community sources; the official pages state no rule, so ask at "
          "the visitor centre. Goblin's Lair (3&nbsp;mi RT, slot canyon, scrambling) is rated "
          "strenuous — skip it. <b>Skip the whole stop if it is hot or rain is forecast.</b>"),
   stop(1, "Day 7 · sunset", "Delicate Arch",
     "<p>Torrey → Moab is 145–156&nbsp;mi, 2h20–2h40, east through Hanksville. <b>Fuel at Hanksville</b> — it is "
     "the only stop between Torrey and I-70.</p>"
     "<p>Optional pause: <b>Factory Butte</b> is visible from UT-24 for miles, and BLM's kiosk and "
     "restroom stop is 12&nbsp;mi west of Hanksville, no fee. The close-up viewing is dirt road and is dropped.</p>"
     "<p>Then straight out to Delicate Arch: 4.8&nbsp;km round trip over open slickrock with "
     "no shade. The arch faces west, so it is a sunset subject and everyone knows it — expect "
     "company at the bowl.</p>",
     stats=[("4.8 km", "round trip"), ("480 ft", "gain"), ("no shade", "carry water")],
     links=[("Arches", "https://www.nps.gov/arch/index.htm", True)],
     photos=("delicate", 4, "Delicate Arch")),
   stop(4, "Day 8", "Devils Garden and The Windows",
     "<p><b>Double O out-and-back, 6.4&nbsp;km</b>, which keeps every named arch. The primitive "
     "loop is 12.7&nbsp;km and over the ceiling for no extra payoff.</p>"
     "<p>The Windows section has the highest arch density per step anywhere on earth.</p>",
     stats=[("6.4 km", "Double O RT"), ("12.7 km", "primitive loop — skipped")],
     photos=("devilsgarden", 4, "Devils Garden"),
     more=("Fiery Furnace, if you want it",
       "<p>Ranger-led $16 / self-guided $10, <b>released only 7 days out</b>, self-guided must "
       "be booked by day&nbsp;−2. Age 5+, max group 6. <b>NPS states GPS does not work "
       "inside it</b> — it is a genuine maze, and with a child the ranger-led option is the "
       "right one.</p><p><i>Unresolved: whether Arches timed entry returns for 2028. It was "
       "dropped entirely for 2026. Re-check about six months out.</i></p>")),
   stop(1, "Day 9 · dawn", "Mesa Arch — the signature photograph",
     "<p>Arrive in the dark. The underside of the arch glows because it is lit by light "
     "bounced off the cliff 500&nbsp;m below — that is the whole trick, and it lasts minutes. "
     "It is a 1&nbsp;km walk and it will be crowded; that is the price.</p>",
     tag=("unmissable", "dawn only"),
     stats=[("1 km", "walk in"), ("minutes", "the light window")],
     photos=("mesaarch", 4, "Mesa Arch")),
   stop(4, "Day 9", "Island in the Sky, then Dead Horse Point",
     "<p>Grand View Point, Green River Overlook, Upheaval Dome — then Dead Horse Point for "
     "sunset over the Colorado gooseneck.</p>",
     stats=[("$55", "Arches+Canyonlands pass"), ("state park", "Dead Horse — pass not valid")],
     photos=("canyonlands", 4, "Canyonlands"),
     note="<b>GPX trap.</b> Mapping apps route &ldquo;Island in the Sky&rdquo; drives down the "
          "<b>Shafer Trail switchbacks</b> — a 4WD high-clearance road with severe exposure. "
          "It is not a shortcut to Moab. Do not let an app put you on it; if you want it, "
          "that is what a hired Jeep day in Moab is for."),
  ], "Moab, Utah", 9)


BOOKING = """
<section id="booking">
  <h2>The booking calendar</h2>
  <p class="introwide">Ordered by when the window <i>opens</i>, not by when the trip happens.
  Only two things on this trip genuinely sell out — and both are unrecoverable if missed.</p>
  <div class="panel"><table>
  <tr><th>When</th><th>What</th></tr>
  <tr><td><b>1 January</b></td><td><b>Kanarra Falls</b> — the entire year releases at once,
      capped at 150 people a day, and peak days sell out about a month ahead.</td></tr>
  <tr><td><b>1–20 July</b></td><td><b>Angels Landing</b> seasonal lottery, $6 + $3/person.
      The day-before lottery closes 15:00 MT.</td></tr>
  <tr><td><b>7 days out</b></td><td><b>Fiery Furnace</b>, Arches — self-guided must be booked
      by day −2. Ranger-led is the right option with a child.</td></tr>
  <tr><td><b>~12 months out</b></td><td>Car hire. Re-quote the <b>LAS→SLC one-way drop fee</b>;
      budget $0–600. Every leg is paved, so a standard SUV is enough.</td></tr>
  <tr><td><b>Not researched</b></td><td>Lodging in Springdale, Torrey and Moab. Moab is only tight
      around a handful of autumn events — the Moab 240 ultra in mid-October is the one to avoid
      outright — but no availability data was gathered for the other two.</td></tr>
  <tr><td><b>Nothing else</b></td><td>Capitol Reef needs no reservation of any kind, and Arches
      timed entry was dropped for 2026.</td></tr>
  </table></div>
</section>"""

DAYOF = """
<section id="dayof">
  <h2>Day-of links</h2>
  <p class="introwide">The handful of things actually tapped in the field. Everything else on
  this page is for reading beforehand.</p>
  <div class="linklist">
    <a href="https://www.nps.gov/zion/planyourvisit/conditions.htm">Zion conditions &amp; flash-flood rating</a>
    <a href="https://www.nps.gov/brca/planyourvisit/conditions.htm">Bryce trail status <b>— check Navajo Loop</b></a>
    <a href="https://www.blm.gov/visit/lower-calf-creek-falls-trail">BLM Lower Calf Creek Falls</a>
    <a href="https://www.nps.gov/care/planyourvisit/conditions.htm">Capitol Reef conditions</a>
    <a href="https://www.nps.gov/cany/planyourvisit/road-conditions.htm">Canyonlands road conditions</a>
    <a href="tel:+14354253791">Capitol Reef road line, 24/7 &middot; (435) 425-3791 press 4</a>
  </div>
</section>"""

CHECK = """
<section id="check">
  <h2>Before you go</h2>
  <div class="check">
    <label><input type="checkbox" data-k="pass"> $250 non-resident America the Beautiful pass</label>
    <label><input type="checkbox" data-k="car"> Rental booked LAS→SLC, drop fee re-quoted</label>
    <label><input type="checkbox" data-k="kanarra"> Kanarra Falls permits (1 Jan)</label>
    <label><input type="checkbox" data-k="angels"> Angels Landing lottery entered (1–20 July)</label>
    <label><input type="checkbox" data-k="narrows"> Narrows rental (boots, stick, wetsuit) reserved in Springdale</label>
    <label><input type="checkbox" data-k="offline"> Offline maps downloaded — UT-12 and UT-24 have patchy coverage</label>
    <label><input type="checkbox" data-k="reverify"> Whole closure table re-verified ~6 months out</label>
  </div>
</section>"""

HONEST = """
<section id="honest">
  <h2>What is verified, and what is not</h2>
  <div class="grid2">
    <div class="panel"><h3>Sourced</h3>
      <p>Every seasonal closure and cutoff date on this route. The rental contract clauses and
      the Nevada statute that narrows them. Child-seat law in every state crossed. Park fees and
      the non-resident pass arithmetic. Zion, Bryce, Arches and Canyonlands trail distances
      against the 12&nbsp;km ceiling. Highway 12's length, surface and the June 2026 culvert
      completion.</p></div>
    <div class="panel"><h3>Not verified — do not treat as fact</h3>
      <p><b>The night split itself.</b> No official source gives a recommended number of days
      for any of these parks; it is drawn from NPS hour figures and about a dozen trip reports,
      almost none of which name a child's age. <b>Lower Calf Creek's elevation gain and hike
      time.</b> <b>Whether Boulder has fuel.</b> Most drive times between legs are aggregator
      figures, not official ones. <b>Dead Horse Point's fees and hours.</b> For the two optional stops: <b>whether the pass works at Goblin Valley</b> (probably not), <b>Corona Arch's elevation gain</b> (250 to 482 ft by source) and the drive times to both. <b>Capitol Reef's
      Scenic Drive fee and the Gifford House closing date.</b> Whether <b>Arches timed
      entry</b> returns after 2026.</p></div>
  </div>
  <div class="panel" style="margin-top:18px">
    <h3>The standing caveat</h3>
    <p>NPS and concessioner dates shift year to year with weather and staffing, and everything
    here is drawn from published 2026 and 2027 schedules. <b>Re-verify before booking.</b></p>
    <p>The plan is <b>day-numbered rather than date-locked</b>, and the only date it cares about
    is <b>1 October</b>, when the Narrows turns dry-suit cold. The earlier 15-day Utah and
    Arizona version is kept in <span class="mono">PLAN-15day-superseded.md</span>.</p>
  </div>
</section>"""

DEND = day("dend", "Days", "10–11", "Great Salt Lake, then home",
  "Moab → Salt Lake City · 235 mi / 4h",
  [("Nights", "1 · Salt Lake City"), ("Drive", "235 mi"), ("Note", "One night, not two")],
  [
   stop(4, "Day 10 · optional", "Optional: Corona Arch before you leave",
     "<p><b>Not part of the core plan — skip it if anyone is tired after day 9.</b> The trailhead is "
     "on <b>UT-279 (Potash Road)</b>, about 14&nbsp;mi from Moab and 25–30 minutes by car. "
     "<b>3&nbsp;mi (4.8&nbsp;km) round trip, about 2 hours</b>, free. The trail crosses a railroad "
     "track, then climbs slickrock with <b>two safety cables, steps cut into the rock and one "
     "short ladder</b>, past Pinto Arch and Bowtie Arch to Corona, whose opening is 140&nbsp;ft "
     "wide and 105&nbsp;ft high.</p>"
     "<p><b>Time added: about 3–3.5 h</b> including both drives. Start by 07:00 — it is sun all "
     "day with no shade — and you are back in Moab about 10:00, leaving for Salt Lake City around "
     "10:15 and arriving mid-afternoon.</p>",
     tag=("added", "optional"),
     stats=[("4.8 km", "round trip"), ("250–480 ft", "gain — sources differ"), ("free", "BLM")],
     links=[("BLM Corona Arch", "https://www.blm.gov/visit/corona-arch-trail", True)],
     photos=("corona", 4, "Corona Arch"),
     note="<b>Child safety.</b> Visit Utah warns of drop-offs on this trail, especially with "
          "children; BLM calls it moderately strenuous with mild exposure. Cables and ladder are "
          "short, but hold hands on the ledges."),
   stop(2, "Day 10", "Moab → Salt Lake City",
     "<p>4 hours north on US-191 and I-70. Leave after breakfast and you are in the city by "
     "mid-afternoon — the first pavement-and-restaurants day in ten, and deliberately soft "
     "after a run of dawn starts.</p>",
     stats=[("235 mi", "distance"), ("4h", "drive")]),
   stop(1, "Day 10 · sunset", "Stansbury Island &amp; the Great Salt Lake",
     "<p>45 minutes west of the city. Honest framing: this is the last stop because it is on "
     "the way to the airport, not because it competes with what came before. The lake is "
     "hypersaline and its north arm runs pink from the algae and bacteria that tolerate it — "
     "worth an evening, not worth a day.</p>",
     stats=[("45 min", "from SLC"), ("sunset", "the reason to go")],
     photos=("saltlake", 3, "Great Salt Lake")),
   stop(2, "Day 11", "SLC → YYZ",
     "<p>Drop the car at the airport. <b>Check the one-way drop fee when you book</b> — "
     "National, Enterprise and Alamo are the only group publicly stating there is typically "
     "no drop charge between airport locations.</p>"),
  ], "Great Salt Lake, Utah", 9)

# ---------- shell ---------------------------------------------------------------------
HERO = PH["delicate"][0]
NAV_ITEMS = [("#orient", "Orientation"), ("#know", "Know first"), ("#dates", "When to go"),
             ("#assume", "Assumptions"), ("#d1", "1–3 Zion"), ("#d4", "4–5 Bryce"),
             ("#d5", "5 Highway 12"), ("#dcr", "6 Capitol Reef"),
             ("#d9", "7–9 Moab"), ("#dend", "10–11 Salt Lake"),
             ("#booking", "Booking"), ("#dayof", "Day-of"), ("#honest", "Honest state")]
NAV = ('<a class="home" href="../">All trips</a>'
       + "".join(f'<a href="{h}">{n}</a>' for h, n in NAV_ITEMS))
CHIPS = "".join(f'<span class="chip">{c}</span>' for c in [
    "11 days &middot; 10 nights", "~800 mi / 1,300 km", "5 bases",
    "All 5 Utah parks", "2 adults + 1 child (11)", "Dates open"])

CTX = {
    "slug": "usa-southwest-rockies",
    "trip_date": "",
    "trip_dates": "11 days &middot; dates open",
    "trip_duration": "10 nights",
    "trip_region": "Utah — the five national parks",
    "title": "Utah's five national parks — 11 days",
    "description": ("Zion, Bryce, Capitol Reef, Arches and Canyonlands. Eleven days, ~800 "
                    "miles, all paved, Las Vegas in and Salt Lake out."),
    "hero_image": HERO["thumb"].replace("/1400px-", "/2000px-"),
    "hero_credit": f'<a href="{filepage(HERO["file"])}">Delicate Arch &middot; Wikimedia Commons</a>',
    "eyebrow": "11 days &middot; 10 nights &middot; dates open",
    "headline": "Utah's Five Parks",
    "sub": ("Zion, Bryce, Capitol Reef, Arches and Canyonlands — one base per park, "
            "Highway 12 in the middle, no dirt roads."),
    "chips": CHIPS,
    "nav": NAV,
    "body": (ORIENT + KNOW + DATES + ASSUME + D1 + D4 + D5 + DCR + D9 + DEND
             + BOOKING + DAYOF + CHECK + HONEST),
    "footer": ('Planned from fifteen research files in <span class="mono">~/workspace/travel/'
               'usa-southwest-rockies/</span>. Closure dates, trail distances, BLM road access '
               'and rental-contract clauses are sourced, not recalled. Photographs from '
               '<a href="https://commons.wikimedia.org/">Wikimedia Commons</a>, each linked at '
               'its caption. <b>Re-verify seasonal hours before booking — NPS and concessioner '
               'dates move year to year.</b>'),
    "extra_css":
        "nav a.home{color:var(--highlight-on-deep);font-weight:600;"
        "border-right:1px solid color-mix(in srgb, var(--highlight-on-deep) 32%, transparent);"
        "margin-right:6px}"
        "nav a.home:hover{color:var(--header-ink)}"
        # .card figure is position:relative with min-height:220px and absolutely-positioned
        # images + overlay captions. The gallery lives inside .card, so every one of those has
        # to be unwound — and at a specificity that beats `.card figure img` (0,1,2), which is
        # why every rule below is prefixed .card rather than bare .gal.
        ".card .gal{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(200px,1fr);"
        "gap:10px;margin-top:14px;overflow-x:auto;scroll-snap-type:x mandatory;"
        "padding-bottom:6px;scrollbar-width:thin}"
        ".card .gal figure{position:static;min-height:0;overflow:visible;margin:0;"
        "scroll-snap-align:start;min-width:0}"
        ".card .gal a{display:block;overflow:hidden;border-radius:8px;border:1px solid var(--line)}"
        ".card .gal img{position:static;inset:auto;width:100%;height:148px;object-fit:cover;"
        "display:block;transition:transform .35s ease}"
        ".card .gal a:hover img{transform:scale(1.04)}"
        ".card .gal figcaption{position:static;background:none;padding:4px 1px 0;"
        "font-size:.66rem;line-height:1.35;color:var(--muted);"
        "overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}"
        "@media(max-width:700px){.card .gal{grid-auto-columns:minmax(170px,78%)}"
        ".card .gal img{height:128px}}"
        ".panel p + p{margin-top:11px}"
        ".intro p + p{margin-top:12px}"
        ".hero::before{background:linear-gradient(180deg,"
        "color-mix(in srgb, var(--bg-deep) 34%, transparent) 0%,"
        "color-mix(in srgb, var(--bg-deep) 78%, transparent) 100%)}"
        ".more table{margin-top:10px}"
        ".more td,.more th{padding:4px 8px;border-bottom:1px solid var(--line)}",
}

html_out = S.assemble(CTX, THEME)
problems = S.check_output_is_self_contained(html_out)
if problems:
    raise SystemExit("SELF-CONTAINMENT FAILED:\n  " + "\n  ".join(problems))
out = HERE / "index.html"
out.write_text(html_out, encoding="utf-8")
print(f"wrote {out}  ({len(html_out):,} bytes, theme={THEME})")

# Photo gallery is data (gallery.json) injected after the build; a rebuild would otherwise erase it.
if (HERE / "gallery" / "gallery.json").exists():
    import gallery as G   # noqa: E402  (_system/gallery.py)
    G.inject(G.load(str(HERE / "gallery" / "gallery.json")), out, dedupe=True)
