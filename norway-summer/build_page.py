#!/usr/bin/env python3
"""Build norway-summer/index.html from _system components. Run:  python3 build_page.py"""
import sys, urllib.parse
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "_system"))
import build as S   # noqa: E402

THEME = "coastal"


# ---------- helpers -------------------------------------------------------------------
def img(fn, w=900):
    q = urllib.parse.quote(fn.replace(" ", "_"))
    return f"https://commons.wikimedia.org/wiki/Special:FilePath/{q}?width={w}"


def filepage(fn):
    return "https://commons.wikimedia.org/wiki/File:" + urllib.parse.quote(fn.replace(" ", "_"))


def fig(fn, alt):
    return (f'<figure><img loading="lazy" src="{img(fn)}" alt="{alt}">'
            f'<figcaption><a href="{filepage(fn)}">Wikimedia Commons</a></figcaption></figure>')


def mapq(*parts):
    return "https://maps.google.com/?q=" + urllib.parse.quote_plus(", ".join(parts) + ", Norway")


def embed(place, z=8):
    return f"https://maps.google.com/maps?q={urllib.parse.quote_plus(place + ', Norway')}&z={z}&output=embed"


def stop(cls, time, title, tag, body, stats=None, links=None, photo=None, more=None, note=None):
    """One card. cls = classifier slot 1..6."""
    t = f'<span class="time{" opt" if "optional" in time else ""}">{time}</span>' if time else ""
    tg = f' <span class="tag tag--{tag[0]}">{tag[1]}</span>' if tag else ""
    st = ""
    if stats:
        st = '<div class="stats">' + "".join(f"<span><b>{a}</b> {b}</span>" for a, b in stats) + "</div>"
    lk = ""
    if links:
        lk = '<div class="links">' + "".join(
            f'<a class="btn{" primary" if p else ""}" href="{u}">{n}</a>' for n, u, p in links) + "</div>"
    md = f'<details class="more"><summary>{more[0]}</summary>{more[1]}</details>' if more else ""
    nt = f'<div class="note">{note}</div>' if note else ""
    content = f'<div class="content">{t}<h3>{title}{tg}</h3>{body}{st}{lk}{md}{nt}</div>'
    inner = (fig(*photo) + content) if photo else f'<div class="split noimg">{content}</div>'
    if photo:
        inner = f'<div class="split">{inner}</div>'
    return (f'<div class="stop"><span class="mark mark--{cls}"></span>'
            f'<div class="card">{inner}</div></div>')


def day(sid, dow, num, h2, route, meta, stops, place, z=8, legend=True):
    m = "".join(f"<span>{a} <b>{b}</b></span>" for a, b in meta)
    body = "".join(stops)
    lg = LEGEND if legend else ""
    return f"""
<section class="day" id="{sid}">
  <div class="sign">
    <div class="date"><span class="dow">{dow}</span><span class="num">{num}</span></div>
    <div class="body"><h2>{h2}</h2><p class="route">{route}</p></div>
  </div>
  <div class="daymeta">{m}</div>
  <div class="trail">{body}</div>
  <div class="mapframe"><iframe loading="lazy" title="{place}" src="{embed(place, z)}"></iframe>
    <div class="bar"><span>{place}</span><a href="{mapq(place)}">Open in Maps</a></div></div>
  {lg}
</section>"""


# Slot order is chosen against the theme palette, not alphabetically: --class-2 is
# near-white in `coastal`, so it carries "road" — an unfilled marker reads correctly as
# "nothing happens here, you are just driving". The loud amber slot carries "book ahead".
CLASSES = [
    ("light", "Timed to the light — dawn, dusk or midnight sun"),
    ("road",  "Driving leg"),
    ("boat",  "Fixed sailing timetable"),
    ("book",  "Book ahead — sells out or fixed group size"),
    ("trail", "On foot — real footing"),
    ("risk",  "Weather- or closure-dependent"),
]
LEGEND = '<div class="legend">' + "".join(
    f'<span><i class="b" style="background:var(--class-{i+1})"></i>{n}</span>'
    for i, (_, n) in enumerate(CLASSES)) + "</div>"


# ---------- orientation ---------------------------------------------------------------
AREAS = [
    ("Houses of Reine by Gravdalsbukta, Moskenes, Nordland, Norway, 2022 June.jpg", "Lofoten",
     "Days 1–4", "Granite straight out of the sea, red rorbuer, no foothills. The postcard, and the crowds that come with it."),
    ("View towards Segla from ridge at Hesten in Senja, Troms og Finnmark, Norway, 2022 August.jpg", "Vesterålen &amp; Senja",
     "Days 4–7", "The same landscape with a fraction of the traffic, plus sperm whales off Andenes."),
    ("Trolltindane and Romsdalen from Litlefjellet, 2013 June.jpg", "Romsdal",
     "Days 7–10", "Trollveggen, Europe&rsquo;s tallest vertical face, and the best ridge walk in fjord Norway."),
    ("Geirangerfjord from Ørnesvingen, 2013 June.jpg", "Geiranger &amp; Nordfjord",
     "Days 10–12", "UNESCO fjord, hanging waterfalls, cliff farms — and a glacier arm an hour inland."),
    ("Aurlandsfjord in August 2019 77.jpg", "Sogn &amp; Bergen",
     "Days 13–15", "Nærøyfjord at 250 m wide, and the wettest city in Europe as the flexible last stop."),
]

areas_html = "".join(
    f'<div class="area">{fig(fn, name)}<div class="ab"><h3>{name}</h3>'
    f'<p class="days">{days}</p><p>{txt}</p></div></div>'
    for fn, name, days, txt in AREAS)

ORIENT = f"""
<section class="intro" id="orient">
  <p class="kick">Before the days start</p>
  <h2>What Norway physically is</h2>
  <div class="lead">
    <p>The fjords are <b>glacial, not tectonic</b>. Ice a kilometre thick ground down river
    valleys and cut <b>below sea level</b>; when it left, the sea flooded in. That is why the
    walls are vertical rather than V-shaped, why the water is over a kilometre deep in places
    while the mouth is shallow — and why waterfalls hang in mid-air off truncated side valleys.
    The tributary glaciers simply could not cut as deep as the trunk glacier did.</p>

    <p>The Arctic islands are a different thing entirely. <b>Lofoten and Senja are gneiss and
    granite billions of years old, rising straight out of the sea with no foothills.</b> That is
    why the peaks read as impossibly steep for their modest height: Segla is 639 m and looks
    Himalayan because it starts at zero.</p>

    <p><b>The specific famous thing is not &ldquo;the fjords&rdquo;.</b> Two of them carry the
    UNESCO listing — <b>Nærøyfjord</b> and <b>Geirangerfjord</b> — and everything else markets
    itself in their language. And the thing Norway has that the Alps do not is the light: in the
    last week of June, north of the Arctic Circle, <b>the sun does not set at all</b>. Not
    &ldquo;stays light late&rdquo;. Does not set.</p>

    <p><b>What you cannot get anywhere else</b> is that combination — Alpine relief standing in
    open ocean, under a sun that circles the horizon instead of crossing it. The cultural half
    is the fishing coast: stockfish racks, rorbuer built for cod season, villages on skerries
    with no land to speak of.</p>
  </div>

  <figure class="introwide"><img loading="lazy" src="{img('Nærøyfjorden mot Gudvangen.jpg', 1400)}"
    alt="Nærøyfjord toward Gudvangen">
    <figcaption><a href="{filepage('Nærøyfjorden mot Gudvangen.jpg')}">Wikimedia Commons</a></figcaption></figure>

  <div class="areas">{areas_html}</div>

  <div class="numstrip">
    <div><b>14</b><span>nights</span></div>
    <div><b>10</b><span>bases</span></div>
    <div><b>~1,740</b><span>km driven</span></div>
    <div><b>1,500</b><span>m highest road</span></div>
    <div><b>12</b><span>km hike ceiling</span></div>
    <div><b>0</b><span>nights of darkness</span></div>
  </div>

  <ul class="know">
    <li><b>1</b><span><b>Trollstigen is a bonus, never a plan.</b> Shut for all of 2024, opened
      only on 11 July in 2025, shut again by a landslide in August 2026 &mdash; and an approved
      three-season securing programme closes it <b>from 15 August every year of the works</b>.
      It also closes preemptively in heavy rain by design. Geiranger is reached by
      <b>Ørnevegen, the only year-round road in</b>.</span></li>
    <li><b>2</b><span><b>Do not enter Lofoten by the Bodø–Moskenes ferry.</b> Only part of its
      capacity is reservable; the rest is a queue that packs out. Fly to <b>Evenes</b> —
      road-connected on the E10, no ferry.</span></li>
    <li><b>3</b><span><b>The best light is 22:00–02:00 and almost nobody uses it.</b> There is no
      true night north of Ålesund in this window. Loen Skylift runs to 22:00; Reinebringen at
      23:00 is empty. The plan runs a deliberate second shift.</span></li>
    <li><b>4</b><span><b>Sleep in Aurland, not Flåm.</b> Flåm is a cruise port with a railway
      attached. Aurland is ten minutes away and quiet after six.</span></li>
    <li><b>5</b><span><b>Speed cameras have a ~3 km/h tolerance</b> and section control is
      standard in tunnels. NOK 3,350 for 6–10 km/h over. This is not a place to drive
      motorway-style.</span></li>
    <li><b>6</b><span><b>There is no summer aurora.</b> Anywhere in Norway, in any summer
      window. If someone sells you one, walk away.</span></li>
    <li><b>7</b><span><b>Every hike here is inside a 12 km round-trip ceiling</b>, and two
      things were cut to hold it: the descent from Ryten down to Kvalvika beach (12&ndash;13 km)
      and the Vidden traverse in Bergen (13&ndash;15 km). Romsdalseggen at 10&ndash;11 km is the
      biggest day and it sits inside the line.</span></li>
  </ul>
</section>"""
print("orientation ok")


# ---------- the days ------------------------------------------------------------------
D1 = day("d1", "Days", "1–3", "Into Lofoten while the sun does not set",
         "Evenes &#8594; Svolvær &#8594; Henningsvær &#8594; Nusfjord &#8594; Reine",
         [("Drive", "~5 h total"), ("Nights", "Svolvær 1 · Reine 2"),
          ("Sun sets", "not at all"), ("Ferries", "none — that is the point")],
         [
 stop(2, "Day 1 &middot; arrive", "Fly to Evenes, drive the E10", None,
      "<p>Evenes is road-connected to Lofoten. That single fact removes the queue at "
      "Bodø–Moskenes, where only part of the ferry&rsquo;s capacity is reservable and the rest "
      "packs out. It will be broad daylight whatever the clock says — do not treat the arrival "
      "hour as a constraint.</p>",
      [("~180", "km"), ("2 h 45", "drive"), ("0", "ferries"), ("24 h", "daylight")],
      [("Map — Evenes to Svolvær", "https://www.google.com/maps/dir/Evenes+Airport/Svolvær/", True)],
      ("Svolvær, Lofoten, Noruega, 2019-09-05, DD 43.jpg", "Svolvær harbour")),

 stop(4, "Day 2 &middot; morning", "Trollfjord sea-eagle RIB", ("added", "book ahead"),
      "<p>A fjord 100 m wide with walls to 1,000 m, and one of Europe&rsquo;s densest "
      "white-tailed eagle populations. It is a rigid inflatable in open water — cold and "
      "exposed even in July, suits provided.</p>",
      [("~USD 122", "from"), ("~2 h", "duration"), ("Svolvær", "departs")],
      [("Map — Svolvær harbour", mapq("Svolvær", "Lofoten"), True)],
      ("White tailed eagle raftsund square crop.jpg", "White-tailed eagle over Raftsundet")),

 stop(2, "Day 2 &middot; afternoon", "West through Henningsvær and Nusfjord", None,
      "<p>Henningsvær sits on skerries with barely any land — the football pitch ringed by "
      "drying racks is there, and so are the only decent coffee places for an hour in either "
      "direction. Nusfjord is one of Norway&rsquo;s oldest preserved fishing villages and takes "
      "forty minutes, not a morning.</p>",
      [("~130", "km"), ("2 h 15", "driving"), ("+2 h", "with stops")],
      [("Map — the day&rsquo;s run", "https://www.google.com/maps/dir/Svolvær/Henningsvær/Nusfjord/Reine/", True)],
      ("Henningsvær på Austvågøy.jpg", "Henningsvær")),

 stop(5, "Day 3 &middot; daytime", "Ryten — the viewpoint, not the beach", None,
      "<p>The overhead view down onto Kvalvika, on the Fredvang side, half an hour from Reine.</p>"
      "<p><b>Stop at the viewpoint.</b> Ryten on its own is 8.7 km return. Carrying on down to the "
      "beach and back turns it into a <b>12–13 km loop with about 930 m of gain and 5–7 hours</b> "
      "— over the 12 km ceiling, and the view you came for is from the top anyway.</p>",
      [("8.7", "km return"), ("680", "m gain"), ("3–5", "hours"), ("~16", "spaces at Torsfjord")],
      [("Map — Torsfjord trailhead", mapq("Torsfjord", "Fredvang", "Lofoten"), True),
       ("AllTrails — Ryten", "https://www.alltrails.com/norway/nordland/ryten", False)],
      ("Kvalvika - view.jpg", "Kvalvika beach from above"),
      ("Parking, and the numbers behind the cut",
       "<ul><li><b>Torsfjorden trailhead</b> — about <b>sixteen marked spaces</b>. Treat it as "
       "full from mid-morning.</li>"
       "<li><b>End of Fv806</b>, the Peat Museum lot — the main alternative.</li>"
       "<li><b>Innersand</b> — paid, NOK 100, plus NOK 100 to leave a vehicle overnight.</li></ul>"
       "<p>Some sources give the viewpoint as 7 km and 543 m rather than 8.7 km and 680 m, "
       "depending on which lot you start from. Either fits; the beach loop does not.</p>")),

 stop(1, "Day 3 &middot; 22:00", "Reinebringen — walk it at night", ("added", "timed"),
      "<p><b>1,978 Sherpa-built stone steps</b> — 2 km round trip on the trail itself, about 5 km "
      "if you count the walk from the nearest paid lot. 448 m of gain, 1.5–3.5 hours. Not "
      "technical, just relentless. And <b>the parking is harder than the hike</b>. "
      "All of Reine is now a no-parking zone outside the paid lots. Going at 22:00 solves both "
      "problems at once: the stairs are empty, the lots have turned over, and the sun is sitting "
      "on the horizon behind the peaks rather than straight overhead.</p>",
      [("2", "km return"), ("1,978", "steps"), ("448", "m gain"), ("1.5–3.5", "hours")],
      [("Map — Reine", mapq("Reinebringen", "Reine", "Lofoten"), True),
       ("Guide to Lofoten", "https://guidetolofoten.com/reinebringen-hike/", False)],
      ("Reine i Lofoten LC0148.jpg", "Reine from Reinebringen"),
      ("Where to actually park",
       "<ul><li><b>Steffenakken</b> — free, tiny, gone by breakfast. A lottery.</li>"
       "<li><b>Reine Kulturhus</b> — NOK 150 for 3–5 hours. The reliable option.</li>"
       "<li><b>Reine harbour / Ytre Havn</b> — EasyPark, NOK 25–40 per hour.</li></ul>"
       "<p>Do not improvise a roadside spot. The village-wide ban exists precisely because "
       "visitors kept doing that.</p>"),
      "Rorbuer here run <b>NOK 2,000–4,000 a night</b> in summer, plus the 3% visitor levy "
      "Lofoten has now adopted. This is the scarcest accommodation on the trip — book it first."),
         ], "Reine, Lofoten", 8)

D4 = day("d4", "Days", "4–6", "North to the whales, then across to Senja",
         "Å &#8594; Andenes &#8594; <span class='mono'>ferry</span> &#8594; Senja",
         [("Drive", "~5 h on day 4"), ("Ferry", "Andenes–Gryllefjord, 100 min"),
          ("Nights", "Andenes 1 · Senja 2"), ("Season", "ferry 13 May – 27 Sep only")],
         [
 stop(2, "Day 4 &middot; morning", "Å i Lofoten, then the long leg north", None,
      "<p>Å is literally the end of the E10 — one letter, a stockfish museum, and no road "
      "onward. Then the drive that this itinerary pays for: Reine to Andenes, four to five "
      "hours up the E10 and Rv85/82 through Vesterålen.</p>"
      "<p><b>Confirmed in</b> — the whales and the Gryllefjord crossing are worth the day.</p>",
      [("~250", "km"), ("4–5 h", "driving"), ("free", "Fiskebøl–Melbu ferry"),
       ("every 2 h", "sailings")],
      [("Map — Reine to Andenes", "https://www.google.com/maps/dir/Reine/Andenes/", True)],
      ("Codfish Drying Flake, Å i Lofoten 20150608 1.jpg", "Stockfish racks at Å"),
      ("The Fiskebøl–Melbu ferry — worth it only if you time it",
       "<p>It is <b>free</b> — cars, vans, motorcycles and passengers alike, no AutoPASS "
       "registration — takes <b>25 minutes</b>, runs <b>every two hours from 06:20</b> (last from "
       "Melbu 21:30), and takes no reservations. It cuts the corner across Hadselfjorden.</p>"
       "<p><b>But the popular claim that it saves &ldquo;at least two hours&rdquo; does not apply "
       "to this leg.</b> That figure compares against a 200 km detour via Sortland <i>and "
       "Lødingen</i>; the all-road route from Lofoten to Andenes already runs via Sortland and "
       "never touches Lødingen. The real saving here is plausibly 45&ndash;60 minutes.</p>"
       "<p><b>And on a two-hourly service, arriving five minutes after a sailing costs more than "
       "the shortcut saves.</b> Check the departure before committing; otherwise just drive.</p>")),

 stop(4, "Day 5 &middot; morning", "Whale safari, Andenes", ("added", "book ahead"),
      "<p>Andenes sits beside the continental shelf edge, which is why sperm whales are here "
      "reliably rather than seasonally. Puffins run to late August on the combined trips.</p>"
      "<p>It is genuinely rough water. If anyone in the group is prone to seasickness, this is "
      "the day it will matter.</p>",
      [("~USD 199", "catamaran"), ("~USD 194", "speedboat + puffins"),
       ("late May", "season opens"), ("mid-Sep", "season ends")],
      [("Map — Andenes", mapq("Andenes", "Andøya"), True),
       ("Whalesafari Andenes", "https://whalesafari.no/trips-andenes", False)],
      ("Buiobuione-Norway -Vesteralen -Andenes - Physeter macrocephalus - Capodoglio.jpg",
       "Sperm whale off Andenes")),

 stop(3, "Day 5 &middot; 17:00", "Andenes → Gryllefjord ferry", ("added", "timetable"),
      "<p>Summer only. Take the last sailing after the whales and arrive on Senja in bright "
      "evening light — this crossing is the reason the Arctic half has no backtracking in it.</p>",
      [("NOK ~925", "car + driver"), ("100", "minutes"), ("2–3", "weekday sailings"),
       ("08:45–17:00", "first/last")],
      [("Timetable — Havspor", "https://havspor.no/en/rute/andenes-gryllefjord", True),
       ("Map — Gryllefjord", mapq("Gryllefjord", "Senja"), False)],
      ("Bergsbotn seen from lookout point at Moltebærhagen by Norwegian County Road 862.jpg",
       "Bergsbotn, Senja"),
      None,
      "Runs <b>13 May – 27 September</b> only. Pay on board with card or AutoPASS; booking is "
      "not normally needed."),

 stop(5, "Day 6", "Hesten — and Segla too, if you want it", None,
      "<p><b>Climb Hesten, not Segla.</b> The famous photograph <i>of</i> Segla is taken from "
      "Hesten; from Segla&rsquo;s own summit you cannot see the thing that makes it famous. "
      "Hesten is graded hard despite the modest numbers and <b>is not for anyone uneasy with "
      "exposure</b>.</p>"
      "<p><b>Both fit in one day.</b> Segla&rsquo;s summit is 5 km return and 610 m — about 10.3 "
      "km for the pair, inside the ceiling. The catch: the trailheads sit 600 m apart in "
      "Fjordgård and <b>the two routes cannot be linked</b>; each is its own out-and-back.</p>"
      "<p>Then <b>Tungeneset</b> and <b>Bergsbotn</b> on the National Tourist Route. Senja is the "
      "deliberate anti-Lofoten: the same landscape with a fraction of the traffic. The trade is "
      "thin accommodation, thin restaurants, and narrow roads full of campervans — so drive the "
      "route early or late, which the light makes trivial.</p>",
      [("5.3", "km Hesten"), ("510–550", "m gain"), ("5", "km Segla"), ("610", "m gain")],
      [("Map — Fjordgård", mapq("Fjordgård", "Senja"), True),
       ("Map — Tungeneset", mapq("Tungeneset", "Senja"), False),
       ("Map — Bergsbotn", mapq("Bergsbotn", "Senja"), False)],
      ("View from a ridge between Segla and Hesten, Senja, Norway, 2014 August.jpg",
       "Segla from the Hesten ridge"),
      ("Which one, and what is still unverified",
       "<table><tr><th></th><th>Distance</th><th>Gain</th><th>Time</th></tr>"
       "<tr><td>Hesten &mdash; the view <i>of</i> Segla</td><td>5.3 km return</td><td>510&ndash;550 m</td><td>2&ndash;3 h</td></tr>"
       "<tr><td>Segla &mdash; the summit</td><td>5 km return</td><td>610 m</td><td>3&ndash;4 h, strenuous</td></tr></table>"
       "<p>Large paid lot at Fjordgård via EasyPark. Segla&rsquo;s upper section is rocky and "
       "steep but needs no technical climbing.</p>"
       "<p><span class='mono'>GAP:</span> Husfjellet and Barden still have no verified numbers. "
       "Only worth closing if either gets added.</p>")),
         ], "Senja", 7)
print("d1 d4 ok")


D7 = day("d7", "Day", "7", "The pivot — Arctic to fjords in an afternoon",
         "Senja &#8594; Tromsø &#8594; <span class='mono'>fly</span> &#8594; Ålesund",
         [("Drive", "~3 h"), ("Flight", "TOS &#8594; AES"),
          ("Cars", "drop A, collect B"), ("Night", "Ålesund")],
         [
 stop(2, "Morning", "Senja to Tromsø, drop Car A", None,
      "<p>Three hours, and the last of the Arctic. If the flight is late enough, "
      "<b>Fjellheisen</b> lifts you 50 m to 421 m in four minutes; the walking version is "
      "<b>Sherpatrappa</b>, 1,200 stone steps up Storsteinen.</p>",
      [("~200", "km"), ("3 h", "drive"), ("421", "m Storsteinen")],
      [("Map — Senja to Tromsø", "https://www.google.com/maps/dir/Fjordgård/Tromsø/", True)],
      ("Tromsø, Storsteinen Mountain from Tromsøbrua Bridge, July 2025.jpg", "Storsteinen above Tromsø")),

 stop(1, "Evening", "Ålesund — 418 steps up Aksla", ("added", "timed"),
      "<p>Ålesund burned down in 1904 and was rebuilt entirely in Art Nouveau, which is why it "
      "looks like nowhere else in Norway. The 418 stone steps from Byparken are the best cheap "
      "view in the country and the right way to meet the fjords: the whole Sunnmøre Alps range "
      "stands up behind the archipelago.</p>",
      [("418", "steps"), ("~30", "min up"), ("free", "cost"), ("23:2x", "sunset")],
      [("Map — Byparken, Ålesund", mapq("Byparken", "Ålesund"), True)],
      ("Vista de Ålesund desde Aksla, Noruega, 2019-09-01, DD 16.jpg", "Ålesund from Aksla")),
         ], "Ålesund", 8)

D8 = day("d8", "Days", "8–9", "Romsdal — the best ridge in fjord Norway",
         "Ålesund &#8594; Åndalsnes &#8594; Romsdalseggen",
         [("Drive", "~2 h"), ("Hike", "10 km / 970 m"),
          ("Nights", "Åndalsnes 2"), ("Bus", "daily from 12 June")],
         [
 stop(6, "Day 8 &middot; optional", "The Atlantic Road", ("optional", "adds ~2 h"),
      "<p>8.3 km, eight bridges, and Storseisundet — the one in every photograph. Eldhusøya has "
      "a suspended walkway loop around the islet.</p>"
      "<p><b>It is better in weather than in sun.</b> It is built across Hustadvika, a shipwreck "
      "coast, and it should look like one. If day 8 dawns grey, this is where to spend it.</p>",
      [("8.3", "km"), ("8", "bridges"), ("+2 h", "detour"), ("free", "cost")],
      [("Map — Storseisundet", mapq("Storseisundbrua", "Averøy"), True)],
      ("Storseisundbrua, Southwest view 20150604 2.jpg", "Storseisundet Bridge")),

 stop(5, "Day 8 &middot; afternoon", "Rampestreken, or the gondola", None,
      "<p>The first look down Romsdalen at <b>Trollveggen</b>, Europe&rsquo;s tallest vertical "
      "rock face. Walk up to Rampestreken, or ride the Romsdalen gondola to the same summit "
      "area — no shame in it on a transfer day, and it is the weather backup for tomorrow.</p>",
      [("NOK 300", "gondola one way"), ("NOK 450", "return"), ("~1,000", "m face")],
      [("Map — Åndalsnes", mapq("Rampestreken", "Åndalsnes"), True)],
      ("View to Romsdalen from Litlefjellet, 2013 June.jpg", "Romsdalen and Trollveggen")),

 stop(5, "Day 9 &middot; all day", "Romsdalseggen", ("added", "the big one"),
      "<p>Ten kilometres along a ridge with Trollveggen on one side and Romsdalsfjord on the "
      "other. <b>The logistics are already solved</b>, which is why this beats Trolltunga on a "
      "trip like this: a dedicated bus leaves <b>platform 5 at Norsk Tindesenter</b>, twenty "
      "minutes to the Vengedalen start, and you walk back down into town. No car shuttle, no "
      "second driver, no 11:00 cut-off to miss.</p>",
      [("10–11", "km"), ("970", "m up"), ("1,277", "m down"), ("7–8", "hours")],
      [("Map — Norsk Tindesenter", mapq("Norsk Tindesenter", "Åndalsnes"), True),
       ("The Romsdalseggen bus", "https://www.fjordnorway.com/en/transport/romsdalseggen-bus", False),
       ("VisitNorway — route &amp; safety", "https://www.visitnorway.com/places-to-go/fjord-norway/northwest/hiking-the-romsdalseggen-ridge/", False)],
      ("Trolltindan and Trollveggen above sideroad in Romsdalen, Rauma, Møre og Romsdal, Norway, 2025 May.jpg", "Trollveggen"),
      ("The descent is the longer half",
       "<p>It climbs 970 m and <b>drops 1,277 m</b> into Åndalsnes. The descent is bigger than "
       "the ascent and it is what will be felt the next day &mdash; poles are worth carrying. "
       "Distance is quoted between 10 and 11 km depending on the source; all of them sit inside "
       "the 12 km ceiling.</p>"
       "<p>Exposed ridge, no shelter. The same base gives three fallbacks that need no weather: "
       "the gondola, Rampestreken, and <b>Via Ferrata Romsdalsstigen</b> &mdash; reputedly the "
       "hardest via ferrata in Norway.</p>"),
      "Bus runs <b>daily from 12 June</b> to mid-October and tickets go on sale in advance. "
      "<span class='mono'>GAP: 2028 fare and sale-opening date.</span>"),
         ], "Åndalsnes", 9)
print("d7 d8 ok")


D10 = day("d10", "Days", "10–11", "Geiranger, taken at the hours nobody is there",
          "Åndalsnes &#8594; Ørnevegen &#8594; Geiranger &#8594; Dalsnibba &#8594; Loen",
          [("Drive", "~4 h over two days"), ("Ferry", "Eidsdal–Linge"),
           ("Nights", "Geiranger 1 · Loen 1"), ("Highest", "Dalsnibba 1,500 m")],
          [
 stop(6, "Day 10 &middot; morning", "Over to Geiranger — and the Trollstigen question",
      ("added", "check first"),
      "<p>The route is Valldal, the <b>Eidsdal–Linge ferry</b>, then <b>Ørnevegen</b> — eleven "
      "hairpins and 620 m of climb, and <b>the only road into Geiranger open year-round</b>.</p>"
      "<p><b>Drive Trollstigen only if it is open that morning.</b> It was shut for all of 2024, "
      "opened only on 11 July in 2025, and a landslide closed it again in August 2026. An "
      "approved three-season securing programme shuts it from 15 August every year of the works, "
      "and it closes preemptively in heavy rain by design. Nothing here depends on it.</p>",
      [("~105", "km"), ("2 h 15", "drive"), ("620", "m Ørnevegen climb"), ("11", "hairpins")],
      [("Road status — vegvesen", "https://www.vegvesen.no/trafikk/", True),
       ("Nasjonale turistveger — Trollstigen", "https://www.nasjonaleturistveger.no/en/routes/geiranger--trollstigen/", False),
       ("Map — Ørnesvingen", mapq("Ørnesvingen", "Geiranger"), False)],
      ("Trollstigen HochPanno.jpg", "Trollstigen"),
      ("If Trollstigen is shut — unverified detour",
       "<p>The likely line is E136 west to Sjøholt, Rv650 to Liabygda, the Liabygda–Stranda "
       "ferry, then Stranda–Hellesylt. <b>This has not been verified.</b> Check vegvesen.no and "
       "Entur before committing a day to it — and note that Ørnevegen means Geiranger is "
       "reachable regardless.</p>")),

 stop(1, "Day 10 &middot; 21:00", "Ørnesvingen, after the ships have gone", ("added", "timed"),
      "<p>Geiranger is a cruise and day-trip town. Ships berth mid-morning, the tour-bus system "
      "runs until late afternoon, and the lot at Flydalsjuvet is small and fills instantly. So "
      "the plan takes exactly one night here and uses the two hours at each end of it.</p>"
      "<p>At 21:00 the Seven Sisters are lit and the viewpoint is yours.</p>",
      [("620", "m up"), ("21:00", "go at"), ("free", "cost")],
      [("Map — Ørnesvingen", mapq("Ørnesvingen viewpoint", "Geiranger"), True)],
      ("Panoramic view of Geirangerfjorden from Ørnesvingen 20150604 1.jpg", "Geirangerfjord from Ørnesvingen"),
      None,
      "<b>Before booking this night, pull Geiranger&rsquo;s cruise-call list for the date.</b> "
      "Shifting to a zero-ship or one-ship day is worth more than every other crowd tactic on "
      "this trip combined."),

 stop(1, "Day 11 &middot; 06:30", "Flydalsjuvet at dawn", ("added", "timed"),
      "<p>The classic Geirangerfjord photograph, from a lot that holds very few cars and fills "
      "the moment the buses start. Early morning or after seven in the evening — not in "
      "between. You are already here; use it.</p>",
      [("06:30", "be there"), ("small", "car park"), ("free", "cost")],
      [("Map — Flydalsjuvet", mapq("Flydalsjuvet", "Geiranger"), True)],
      ("Seven Sisters LC0187.jpg", "The Seven Sisters, Geirangerfjord")),

 stop(2, "Day 11 &middot; late morning", "Dalsnibba, then over to Loen", None,
      "<p>Up the Nibbevegen toll road to <b>1,500 m and the Geiranger Skywalk</b> — the highest "
      "fjord view in Europe reachable by car. Then Grotli and Videseter down into Nordfjord.</p>",
      [("1,500", "m"), ("~85", "km to Loen"), ("1 h 45", "drive"), ("mid-May", "road opens")],
      [("Map — Dalsnibba", mapq("Dalsnibba", "Geiranger"), True),
       ("Map — the run to Loen", "https://www.google.com/maps/dir/Geiranger/Dalsnibba/Grotli/Loen/", False)],
      ("Stranda Dalsnibba lub 2025-07-29 img09.jpg", "Dalsnibba")),

 stop(1, "Day 11 &middot; evening", "Loen Skylift, after everyone has left", ("added", "timed"),
      "<p>1,011 m out of the fjord in five minutes, and it runs to <b>22:00 with the last car "
      "down at 22:30</b>. Which means the mountain is available two hours after the tour "
      "coaches have gone and the light is at its best.</p>",
      [("NOK 650", "adult return"), ("NOK 345", "child 6–15"), ("NOK 1,665", "family 2+2"),
       ("22:00", "last up")],
      [("Map — Loen Skylift", mapq("Loen Skylift", "Loen"), True),
       ("Hours &amp; prices", "https://en.loenskylift.no/opening-hours-and-prices", False)],
      ("Loen Skylift.jpg", "Loen Skylift"),
      None,
      "Summer season <b>1 May – 11 October</b>. Under-6s free. A day pass is NOK 865 if you "
      "want to go up twice."),
          ], "Geiranger", 9)

D12 = day("d12", "Days", "12–13", "One big Nordfjord day, then down to Sogn",
          "Loen &#8594; <span class='mono'>ferrata or glacier</span> &#8594; Aurland",
          [("Drive", "~3 h on day 13"), ("Choose", "one, not both"),
           ("Nights", "Loen 1 · Aurland 1"), ("Book", "both sell out")],
          [
 stop(4, "Day 12 &middot; option A", "Via Ferrata Loen", ("added", "book ahead"),
      "<p>Up the mountain on cable and rung with an instructor, descending by the Skylift. "
      "Departures leave the Loen Active shop in the village at <b>09:00, 10:00 and 11:00</b>, "
      "daily in season.</p>",
      [("NOK 2,380", "with instructor"), ("age 12+", "recommended"), ("40–120", "kg limits"),
       ("09/10/11", "departures")],
      [("Map — Loen Active", mapq("Loen Active", "Loen"), True),
       ("Via Ferrata Loen", "https://en.loenskylift.no/viaferrataloen", False)],
      ("LoenSky117BG23.jpg", "Above Loen from the Skylift"),
      ("The limits — checked, and not negotiable",
       "<p><b>Recommended from age 12. Minimum weight 40 kg, maximum 120 kg.</b> Both weights are "
       "set by the harness and lanyard system rather than by policy, so there is no arguing them "
       "on the day. No height limit is published.</p>"
       "<p>Bring a pack with <b>at least 1.5 L of water per person</b>, food, gloves, long "
       "trousers, a windproof and a buff. Low hiking shoes with Vibram soles are recommended; "
       "Loen Active rents La Sportiva shoes and sells gloves on site.</p>")),

 stop(4, "Day 12 &middot; option B", "Nigardsbreen blue ice", ("added", "book ahead"),
      "<p>An arm of <b>Jostedalsbreen, mainland Europe&rsquo;s largest glacier</b>, about an hour "
      "and twenty from Loen. Four grades, and the difference between them is time actually on "
      "the ice, not difficulty of approach.</p>",
      [("4.5 h", "x-tra short · 1.5 h on ice"), ("5.5 h", "short · 2.5 h"),
       ("6 h", "long · 4 h"), ("age 8+", "minimum")],
      [("Map — Nigardsbreen", mapq("Nigardsbreen", "Jostedal"), True),
       ("Jostedalen Breførarlag", "https://www.bfl.no/en/nigardsbreen-glacier-hikes/", False)],
      ("Nigardsbreen 2021.jpg", "Nigardsbreen"),
      None,
      "Book by email; start times <b>09:45–12:30</b>; the booking system adds 6%. "
      "<span class='mono'>GAP: prices.</span>"),

 stop(6, "Day 12 &middot; weather fallback", "Gamle Strynefjellsvegen", ("optional", "if grey"),
      "<p>The old summer-only gravel road over Strynefjellet, protected as a heritage route. "
      "<b>Not suitable for motorhomes or caravans</b> — and in a rental car it is the right thing "
      "to do with an afternoon that is too wet for rock or ice.</p>",
      [("summer", "only"), ("gravel", "surface"), ("free", "cost")],
      [("Map — Gamle Strynefjellsvegen", mapq("Gamle Strynefjellsvegen", "Stryn"), True)],
      ("Oppland Gamle Strynefjellsvegen 10.JPG", "Gamle Strynefjellsvegen")),

 stop(2, "Day 13 &middot; afternoon", "Down to Sogn, and Stegastein", None,
      "<p>Three hours to Aurland. Then <b>Stegastein</b> — a platform cantilevered 650 m above "
      "Aurlandsfjord. <b>Take the shuttle from Flåm</b>, ninety minutes round trip: the road up "
      "is narrow with vehicle-size limits, and this is a case where the bus is the right call "
      "rather than a cop-out.</p>"
      "<p>Sleep in <b>Aurland, not Flåm</b>. Flåm is a cruise port with a railway attached; "
      "Aurland is ten minutes away and quiet after six.</p>",
      [("~200", "km"), ("3 h", "drive"), ("650", "m platform"), ("90", "min shuttle")],
      [("Map — Stegastein", mapq("Stegastein", "Aurland"), True),
       ("Shuttle from Flåm", "https://www.norwaysbest.com/en/flam/things-to-do/stegastein-viewpoint", False)],
      ("Stegastein viewpoint showing Aurlandsfjord.jpg", "Stegastein over Aurlandsfjord"),
      None,
      "Shuttle runs <b>1 June – 31 August</b>."),
          ], "Loen", 9)
print("d10 d12 ok")


D14 = day("d14", "Days", "14–15", "Nærøyfjord in silence, then out through Bergen",
          "Flåm &#8594; Gudvangen &#8594; Bergen &#8594; <span class='mono'>fly</span>",
          [("Sail", "08:30, back on the 11:00"), ("Drive", "~2 h 45"),
           ("Night", "Bergen"), ("Rain", "15–20 days a month")],
          [
 stop(3, "Day 14 &middot; 08:30", "Nærøyfjord on the electric ferry", ("added", "timetable"),
      "<p>UNESCO, 250 m wide at the narrowest, walls to 1,400 m. <b>The vessels are electric, "
      "and that is the entire difference from every diesel fjord cruise</b> — with the engine "
      "gone you hear the waterfalls and the birds instead of a diesel.</p>"
      "<p>Summer sailings are 08:30, 11:00, 13:30 and 16:00 each way. <b>Take the 08:30 out and "
      "the 11:00 back</b>; the later boats carry the coach tours.</p>",
      [("NOK 550", "adult one way"), ("NOK 815", "return"), ("250", "m at narrowest"),
       ("1,400", "m walls")],
      [("Map — Flåm quay", mapq("Flåm ferry terminal", "Flåm"), True),
       ("Timetable — Havspor", "https://havspor.no/en/stopp/gudvangen-ferjekai", False)],
      ("Nærøyfjord-cruise-view.jpg", "Nærøyfjord"),
      None,
      "Flåm sells out weeks ahead in summer on the popular departures. Book this one."),

 stop(5, "Day 14 &middot; swap", "Rallarvegen instead, if you would rather ride",
      ("optional", "added — veto freely"),
      "<p>The Flåm Railway up to Myrdal — 20 km and among the steepest standard-gauge lines "
      "anywhere — then <b>57 km of downhill from Finse at 1,222 m back to the fjord</b>, "
      "dropping the bike in Flåm. One-way is built into the rental system; you do not have to "
      "ride back up anything.</p>",
      [("57", "km"), ("1,222", "m start"), ("~0", "m finish"), ("one-way", "bike drop")],
      [("Map — Finse", mapq("Finse", "Norway"), True),
       ("Finse bike rental", "https://www.norwaysbest.com/en/flam/things-to-do/finse-bike-rental", False)],
      ("Two Flåmsbana Trains meet and pass as the Brekkefossen Waterfall cascades above.jpg",
       "Flåm Railway")),

 stop(2, "Day 14 &middot; afternoon", "Aurland to Bergen", None,
      "<p>Two and three-quarter hours on the E16. Bergen is deliberately last: it sees rain on "
      "<b>15–20 days a month</b> in summer, and it is the one base where a wet day costs you "
      "nothing at all.</p>",
      [("~165", "km"), ("2 h 45", "drive")],
      [("Map — Aurland to Bergen", "https://www.google.com/maps/dir/Aurland/Bergen/", True)],
      ("Aurlandsfjord - Norway.jpg", "Aurlandsfjord")),

 stop(3, "Day 15 &middot; morning", "Bryggen, Fløibanen, and out", None,
      "<p><b>Bryggen</b> is UNESCO — the surviving timber wharf of a Hanseatic trading capital. "
      "<b>Fløibanen</b> is six minutes to the ridge above the city. Then drop Car B at Bergen "
      "airport and fly <b>BGO → Keflavík → Toronto</b>, the one single-stop leg of the trip, "
      "deliberately placed on the way home.</p>",
      [("6", "min funicular"), ("320", "m Fløyen"), ("1", "stop home")],
      [("Map — Bryggen", mapq("Bryggen", "Bergen"), True),
       ("Map — Fløibanen", mapq("Fløibanen", "Bergen"), False)],
      ("Fassaden in Bryggen, Bergen N.jpg", "Bryggen, Bergen")),

 stop(6, "Day 15 &middot; only if clear", "Ulriken by cable car — Vidden is cut",
      ("optional", "weather lottery"),
      "<p><b>The Vidden traverse is out.</b> Ulriken across the plateau to Fløyen is "
      "<b>13–15 km</b> — one source says 18 — and the quoted 4–6 hours becomes 7–8 for most "
      "people. That is over the ceiling, on the last morning, with a flight to catch.</p>"
      "<p><b>Take the cable car to Ulriken, 643 m, and come back down the same way.</b> Same "
      "view over city, fjord and islands, no distance, and nothing at risk.</p>",
      [("643", "m Ulriken"), ("0", "km on foot"), ("13–15", "km if you traversed"),
       ("53–66%", "days with rain")],
      [("Map — Ulriken", mapq("Ulriken643", "Bergen"), True)],
      ("Vista de Bergen desde la montaña Fløyen, Noruega, 2019-09-08, DD 27-31 PAN.jpg",
       "Bergen from Fløyen")),
          ], "Bergen", 9)
print("d14 ok")


# ---------- window decision, as an A/B toggle -----------------------------------------
WINDOW = """
<section class="intro" id="window">
  <p class="kick">The one decision that changes everything</p>
  <h2>Which fortnight of summer 2028</h2>
  <div class="lead"><p><i>Fellesferie</i> — Norway&rsquo;s three-week national shutdown — is ISO
  weeks 28–30 every year. In 2028 that computes to <b>10–30 July</b>, a full week later than
  2026&rsquo;s 6–24 July. That one week of drift creates a window 2026 did not have.</p></div>

  <div class="toggle">
    <button data-plan-btn="a">Window A &middot; recommended</button>
    <button data-plan-btn="b">Window B</button>
  </div>

  <div class="planwrap">
    <div class="plan" data-plan="a">
      <div class="panel">
        <h3>~24 June – 8 July 2028 · Arctic first</h3>
        <p><b>Entirely ahead of the Norwegian domestic surge, and entirely inside the midnight
        sun.</b> Svolvær runs 25 May – 18 July, Reine 27 May – 16 July, Senja to 24 July,
        Tromsø to 25 July. A window ending 8 July clears all five with margin.</p>
        <p>The usual objection to late June is snow on the high ridges — and it does not apply
        here, because <b>no high inland ridge is in this plan</b>. What is in it opens earlier:
        the Romsdalseggen bus runs from <b>12 June</b>, the Nibbevegen up Dalsnibba opens
        <b>mid-to-late May</b>, and Loen and Nigardsbreen run from spring.</p>
        <p><b>This is why the trip is built Arctic-first</b> — reach Lofoten and Senja while the
        sun does not set, then come south to the fjords.</p>
        <table>
          <tr><th>Place</th><th>Sun never sets</th><th>Days</th></tr>
          <tr><td>Tromsø</td><td>18 May – 25 July</td><td>69</td></tr>
          <tr><td>Senja (Fjordgård)</td><td>19 May – 24 July</td><td>67</td></tr>
          <tr><td>Svolvær</td><td>25 May – 18 July</td><td>55</td></tr>
          <tr><td>Reine</td><td>27 May – 16 July</td><td>51</td></tr>
          <tr><td>Bodø</td><td>31 May – 12 July</td><td>43</td></tr>
        </table>
      </div>
    </div>
    <div class="plan" data-plan="b">
      <div class="panel">
        <h3>~29 July – 12 August 2028 · fjords first</h3>
        <p>Arrives as <i>fellesferie</i> ends on 30 July. Every ridge snow-free, every lift and
        mountain road running, and Lofoten still has <b>no astronomical darkness</b> — civil dusk
        01:41, civil dawn 04:14 on 12 August. What you lose is the midnight sun itself, which is
        gone from Lofoten by 18 July.</p>
        <p><b>Take this only if</b> someone in the group genuinely cannot sleep in continuous
        daylight, or if a high inland ridge — Besseggen, Trolltunga, Galdhøpiggen — gets added
        to the plan later. Either would flip the answer.</p>
        <p>If you take it, <b>reverse the whole itinerary</b>: fly in to Bergen, drive the fjords
        north, fly Ålesund → Evenes, and come home from Tromsø. The single-stop Icelandair leg
        then lands on the way out instead of the way home.</p>
        <table>
          <tr><th></th><th>Window A</th><th>Window B</th></tr>
          <tr><td>Midnight sun, Lofoten</td><td>Yes</td><td>No</td></tr>
          <tr><td>Fellesferie 10–30 Jul</td><td>Before it</td><td>After it</td></tr>
          <tr><td>High-route snow</td><td>Lingering &gt;1,400 m</td><td>Gone</td></tr>
          <tr><td>Rain odds</td><td>Lower</td><td>Slightly higher</td></tr>
          <tr><td>Direction</td><td>Arctic &#8594; fjords</td><td>Fjords &#8594; Arctic</td></tr>
        </table>
      </div>
    </div>
  </div>
</section>"""


# ---------- day-of links --------------------------------------------------------------
QUICK = """
<section class="quick" id="quick">
  <h2>Day-of links</h2>
  <p class="qsub">The handful actually tapped in the field</p>
  <div class="qgrid">
    <div class="qcard">
      <h4><span class="dot" style="background:var(--class-6)"></span>Is the road open</h4>
      <a class="warn" href="https://www.vegvesen.no/trafikk/"><b>Vegvesen live traffic</b>Road closures, Trollstigen, mountain passes</a>
      <a class="tel" href="tel:+4722175175"><b>+47 22 175 175</b>Road conditions, spoken</a>
      <a href="https://www.nasjonaleturistveger.no/en/routes/geiranger--trollstigen/"><b>Trollstigen status</b>Nasjonale turistveger</a>
    </div>
    <div class="qcard">
      <h4><span class="dot" style="background:var(--class-3)"></span>Boats</h4>
      <a href="https://havspor.no/en/rute/andenes-gryllefjord"><b>Andenes &#8594; Gryllefjord</b>Summer only, 13 May – 27 Sep</a>
      <a href="https://havspor.no/en/stopp/gudvangen-ferjekai"><b>Flåm &#8211; Gudvangen</b>Nærøyfjord electric ferry</a>
      <a href="https://www.fergeruter.info/"><b>fergeruter.info</b>Every other crossing</a>
      <a href="https://entur.no/"><b>Entur</b>Trains, buses, no operator surcharge</a>
    </div>
    <div class="qcard">
      <h4><span class="dot" style="background:var(--class-1)"></span>Weather &amp; light</h4>
      <a href="https://www.yr.no/en"><b>yr.no</b>The Norwegian forecast everyone actually uses</a>
      <a href="https://www.yr.no/en/forecast/daily-table/2-3143242/Norway/M%C3%B8re%20og%20Romsdal/Rauma/%C3%85ndalsnes"><b>yr — Åndalsnes</b>Check the night before Romsdalseggen</a>
    </div>
    <div class="qcard">
      <h4><span class="dot" style="background:var(--class-4)"></span>Crowds</h4>
      <a href="https://www.cruisetimetables.com/geiranger-norway-cruise-ship-schedule-2026.html"><b>Geiranger cruise calls</b>Pick a zero-ship day before booking</a>
      <a href="https://www.vinmonopolet.no/"><b>Vinmonopolet</b>Closed Sundays. Saturday to 16:00.</a>
    </div>
  </div>
</section>"""
print("window quick ok")


CHECK_ITEMS = [
    ("flights", "Open-jaw flights booked — YYZ&#8594;EVE out, BGO&#8594;YYZ home"),
    ("rorbu", "Reine / Hamnøy rorbu — the scarcest thing on the trip"),
    ("bus", "Romsdalseggen bus tickets (daily from 12 June)"),
    ("whale", "Whale safari, Andenes"),
    ("rib", "Trollfjord sea-eagle RIB, Svolvær"),
    ("ferrata", "Via Ferrata Loen <b>or</b> Nigardsbreen — everyone between <b>40 and 120 kg</b>, age 12+"),
    ("naeroy", "Nærøyfjord 08:30 ferry, Flåm"),
    ("cars", "Both cars: Evenes&#8594;Tromsø, Ålesund&#8594;Bergen"),
    ("internal", "Internal flight TOS&#8594;AES"),
    ("cruise", "Geiranger cruise-call list checked for the chosen date"),
    ("eyemask", "Blackout eye masks — there is no darkness for six nights"),
    ("headnet", "Head net for inland stops; coast is fine"),
    ("vinmono", "Vinmonopolet run done on a Saturday morning"),
    ("offline", "Offline maps downloaded — Senja and inner Lofoten have thin signal"),
    ("poles", "Poles packed — Romsdalseggen drops 1,277 m into Åndalsnes"),
    ("melbu", "Fiskebøl&#8211;Melbu sailing time checked for day 4 (every 2 h)"),
]
checklist = "".join(
    f'<label><input type="checkbox" data-k="{k}"><span>{t}</span></label>' for k, t in CHECK_ITEMS)

ESSENTIALS = f"""
<section id="essentials">
  <h2>Essentials</h2>
  <div class="grid2">
    <div class="panel">
      <h3>Book ahead, in this order</h3>
      <table>
        <tr><th>#</th><th>What</th><th>Why it is here</th></tr>
        <tr><td>1</td><td>Open-jaw flights</td><td>No nonstop from Toronto either way; routing beats price</td></tr>
        <tr><td>2</td><td>Reine / Hamnøy rorbu</td><td>NOK 2,000–4,000/night + 3% levy, and it sells out</td></tr>
        <tr><td>3</td><td>Romsdalseggen bus</td><td>Sale opens in advance; daily from 12 June</td></tr>
        <tr><td>4</td><td>Whale safari &amp; Trollfjord RIB</td><td>Small boats, fixed departures</td></tr>
        <tr><td>5</td><td>Ferrata or glacier</td><td>Fixed group sizes and start times</td></tr>
        <tr><td>6</td><td>Cars and the internal flight</td><td>Two rentals beat one long one-way</td></tr>
      </table>
      <p class="mono" style="font-size:.74rem;margin-top:10px">
      Flåm sells out weeks ahead on popular departures. The Andenes–Gryllefjord ferry does not
      normally need booking.</p>
    </div>

    <div class="panel">
      <h3>What it costs</h3>
      <p>Mid-range, two people, 14 nights on the ground: <b>NOK 52,000–69,000</b>
      (~CAD 6,900–9,100) before flights and cars.</p>
      <table>
        <tr><th>Item</th><th>NOK</th></tr>
        <tr><td>Hotel, double with breakfast</td><td>~1,725 / night</td></tr>
        <tr><td>Lofoten rorbu, summer</td><td>2,000–4,000 / night</td></tr>
        <tr><td>Groceries, self-catering</td><td>112–195 pp / day</td></tr>
        <tr><td>Restaurant main, budget</td><td>190–350</td></tr>
        <tr><td>Beer in a bar <i>vs</i> Vinmonopolet</td><td>90–130 <i>vs</i> 35–60</td></tr>
        <tr><td>Petrol</td><td>~22 / litre</td></tr>
        <tr><td>Ferries across the trip</td><td>4,000–6,000</td></tr>
      </table>
      <p style="margin-top:10px"><b>Three levers that actually move it:</b> self-cater breakfast
      and lunch (book kitchens — this beats any pass or card); buy alcohol at Vinmonopolet, which
      is <b>closed Sundays</b> and Saturdays only to 16:00; and remember the best hours are free —
      Ørnesvingen, Flydalsjuvet, Aksla, every hike here, and the whole tourist-route viewpoint
      network.</p>
    </div>

    <div class="panel">
      <h3>Driving in Norway</h3>
      <ul>
        <li><b>~3 km/h camera tolerance</b>, and section control is standard in tunnels.
        NOK 3,350 for 6–10 km/h over; about NOK 10,100 at 20 over.</li>
        <li>Limits: 50 urban, 30 residential, 80 rural, 90–100 motorway.</li>
        <li><b>Tolls are automatic</b> via AutoPASS and billed back through the rental with a
        <b>NOK 30–80/day handling fee</b> on days you incur any.</li>
        <li>Ferries bill the same way. The full 50% ferry discount needs a prepaid agreement a
        visitor in a rental generally cannot get — <b>assume full fare</b>.</li>
        <li><b>EVs are the default rental.</b> 10,000+ fast chargers at NOK 4–8/kWh, and EVs pay
        materially less on ferries. <span class="mono">GAP: charger density on Sognefjellet and
        the Senja route.</span></li>
      </ul>
    </div>

    <div class="panel check">
      <h3>Before you go</h3>
      <div id="checklist">{checklist}</div>
      <p class="mono" style="font-size:.72rem;margin-top:10px">Ticks are saved in this browser.</p>
    </div>
  </div>

  <div class="panel" style="margin-top:20px">
    <h3>Still open</h3>
    <p><b>Settled.</b> Year 2028 · Window A · <b>12 km round-trip hiking ceiling</b> ·
    the day-4 drive to Andenes stays, whales included.</p>
    <p><b>Still to decide.</b> Exact dates inside Window A, and <b>group size</b> — the one
    remaining unknown, and it drives the ferrata headcount, the rorbu booking and the ferry
    fares.</p>
    <p><b>Closed on 31 August 2026.</b> Via Ferrata Loen&rsquo;s age and weight limits ·
    Reinebringen&rsquo;s and Ryten&rsquo;s numbers · Hesten and Segla distances · the
    Fiskebøl–Melbu ferry · Romsdalseggen&rsquo;s true ascent/descent split.</p>
    <p><b>Facts still marked <span class="mono">GAP</span> in the research files.</b> Nigardsbreen
    prices · the Trollstigen detour route · Husfjellet and Barden on Senja · door-to-door timing
    for Reine &rarr; Andenes with and without the ferry · when each fjord valley floor loses the
    sun · per-branch Vinmonopolet hours · official 2028 <i>fellesferie</i> dates · and every live
    fare, which cannot be checked until the dates are set.</p>
    <p><b>Left out deliberately.</b> Trolltunga, Preikestolen and Kjeragbolten sit 3–6 hours south
    of Bergen and are not on this route; Trolltunga alone costs about two days with positioning.
    Besseggen and Galdhøpiggen are inland east — and adding either would flip the recommended
    window back to late July.</p>
  </div>
</section>"""
print("essentials ok")



# ---------- adventure ------------------------------------------------------------------
ADVENTURE = """
<section class="intro" id="adventure">
  <p class="kick">What to book, and who can actually do it</p>
  <h2>Adventure</h2>
  <div class="lead">
    <p><b>Norway prices adventure per person, not per group.</b> That is the opposite of the
    Dolomites, where a mountain guide charges a group fee that a party of four splits four ways.
    Here a second person doubles the bill and a fourth quadruples it &mdash; so group size drives
    the total and never the unit cost. Budget accordingly.</p>

    <p><b>The thing that disqualifies people is weight and age, not fitness.</b> Via Ferrata Loen
    turns on a <b>40&ndash;120 kg</b> window set by the harness and lanyard system, not by policy,
    so there is nothing to negotiate on the day. Check that first, before anyone books a flight
    around it.</p>

    <p>Two of these compete for the same slot. <b>Day 12 is the ferrata <i>or</i> the glacier, not
    both</b> &mdash; Nigardsbreen is an hour and twenty from Loen and its walks start between 09:45
    and 12:30, which collides with the 09:00&ndash;11:00 ferrata departures.</p>
  </div>

  <table>
    <tr><th>Activity</th><th>Price</th><th>Age / weight</th><th>Booking</th><th>Season</th></tr>
    <tr><td><b>Via Ferrata Loen</b><br><span class="mono">day 12, option A</span></td>
        <td>NOK <b>2,380</b> pp<br><span class="mono">incl. guide, kit, Skylift down</span></td>
        <td><b>12+ · 40&ndash;120 kg</b></td>
        <td>Ahead. Departs Loen Active <b>09:00 / 10:00 / 11:00</b></td>
        <td>Daily in season</td></tr>
    <tr><td><b>Nigardsbreen blue ice</b><br><span class="mono">day 12, option B</span></td>
        <td><span class="mono">GAP &mdash; unpublished</span><br>+6% booking fee</td>
        <td><b>8+</b> on the short walk</td>
        <td>By <b>email</b>. Starts 09:45&ndash;12:30</td>
        <td>Summer</td></tr>
    <tr><td><b>Whale safari</b>, Andenes<br><span class="mono">day 5</span></td>
        <td>from <b>USD 199</b> catamaran<br>USD 194 speedboat + puffins</td>
        <td><span class="mono">GAP</span></td>
        <td>Ahead</td>
        <td>late May &ndash; mid Sep<br><b>puffins to late Aug</b></td></tr>
    <tr><td><b>Trollfjord sea-eagle RIB</b><br><span class="mono">day 2</span></td>
        <td>from <b>USD 122</b></td>
        <td><span class="mono">GAP</span></td>
        <td>Ahead</td><td>Summer</td></tr>
    <tr><td><b>Rallarvegen</b> by bike<br><span class="mono">day 14, optional swap</span></td>
        <td><span class="mono">GAP &mdash; rental</span></td>
        <td>&mdash;</td>
        <td>Rent at Finse or Haugastøl, <b>drop in Flåm</b></td>
        <td>Summer</td></tr>
    <tr><td><b>Loen Skylift</b><br><span class="mono">day 11</span></td>
        <td>NOK <b>650</b> adult return<br>345 child 6&ndash;15 · 1,665 family 2+2</td>
        <td>Under 6 free</td>
        <td>Walk-up</td>
        <td>1 May &ndash; 11 Oct<br><b>runs to 22:00</b></td></tr>
    <tr><td><b>Romsdalen gondola</b><br><span class="mono">day 8 / weather backup</span></td>
        <td>NOK <b>300</b> one way · <b>450</b> return</td>
        <td>&mdash;</td><td>Walk-up</td><td>Summer</td></tr>
    <tr><td><b>Via Ferrata Romsdalsstigen</b><br><span class="mono">day 9 alternative</span></td>
        <td><span class="mono">GAP</span></td>
        <td><span class="mono">GAP</span></td>
        <td>Ahead</td>
        <td>Reputedly Norway&rsquo;s hardest</td></tr>
  </table>

  <div class="grid2">
    <div class="panel">
      <h3>The day-12 choice</h3>
      <p><b>Ferrata</b> if the group clears 40 kg and wants exposure with a rope on it. Loen&rsquo;s
      route ends at Hoven and you ride the Skylift down, so there is no descent on tired arms.</p>
      <p><b>Glacier</b> if anyone is under 12, or over 120 kg, or would rather walk on ice than
      climb rock. Nigardsbreen takes children from <b>8</b> on the short walk, and the grades
      differ by <i>time on the ice</i> &mdash; 1.5 h, 2.5 h or 4 h &mdash; not by how hard the
      approach is.</p>
      <p>Either way, book before you go: both run small groups with fixed start times, and the
      ice-climbing variant caps at six people.</p>
    </div>
    <div class="panel">
      <h3>The two sea days</h3>
      <p>The <b>Trollfjord RIB</b> on day 2 is a rigid inflatable in open water &mdash; cold and
      exposed even in July, suits provided. It runs into a fjord 100 m wide with walls to 1,000 m,
      through one of Europe&rsquo;s densest white-tailed eagle populations.</p>
      <p>The <b>Andenes whale safari</b> on day 5 goes out to the continental shelf edge, which is
      why sperm whales are there reliably rather than seasonally. <b>It is genuinely rough
      water.</b> If anyone is prone to seasickness this is the day it will show, and it lands
      immediately before a two-hour ferry crossing.</p>
    </div>
  </div>

  <ul class="know">
    <li><b>1</b><span><b>Check the 40&ndash;120 kg window before anything else.</b> It is the only
      hard gate in the trip and it is set by equipment, not by policy.</span></li>
    <li><b>2</b><span><b>Per-person pricing means the adventure budget scales with the group.</b>
      Two people doing the ferrata and one whale safari is roughly NOK 6,800 before anything
      else.</span></li>
    <li><b>3</b><span><b>Four prices here are still unverified</b> &mdash; Nigardsbreen, the
      Rallarvegen rental, Romsdalsstigen, and the Nærøyfjord day kayak. All are marked
      <span class="mono">GAP</span> and none can be pinned down until 2028 rates publish.</span></li>
  </ul>
</section>"""

# ---------- assemble ------------------------------------------------------------------
NAV = '<a class="home" href="/">&#8592; All plans<span class="d">dashboard</span></a>' + "".join(
    f'<a href="#{i}"><span class="d">{d}</span>{n}</a>' for i, d, n in [
    ("orient", "Read first", "Orientation"),
    ("window", "Decide", "Which fortnight"),
    ("adventure", "Book &amp; limits", "Adventure"),
    ("d1", "Days 1–3", "Lofoten"),
    ("d4", "Days 4–6", "Andøya &amp; Senja"),
    ("d7", "Day 7", "The pivot"),
    ("d8", "Days 8–9", "Romsdal"),
    ("d10", "Days 10–11", "Geiranger"),
    ("d12", "Days 12–13", "Nordfjord &amp; Sogn"),
    ("d14", "Days 14–15", "Nærøyfjord &amp; Bergen"),
    ("quick", "In the field", "Day-of links"),
    ("essentials", "Money &amp; kit", "Essentials"),
])

CHIPS = "".join(f'<span class="chip"><strong>{a}</strong> {b}</span>' for a, b in [
    ("14", "nights"), ("10", "bases"), ("2", "cars"),
    ("6", "nights with no sunset"), ("12", "km hike ceiling"),
])

HERO_IMG = "Hamnøya of Reine in Moskenes, Nordland, Norway, 2022 June.jpg"

CTX = {
    "slug": "norway-summer",
    "trip_date": "",
    "trip_dates": "Summer 2028 &middot; dates open",
    "trip_duration": "14 nights",
    "trip_region": "Lofoten, Senja &amp; Fjord Norway",
    "title": "Norway — 14 nights, summer 2028",
    "description": ("Arctic first under the midnight sun — Lofoten, Andøya and Senja — then "
                    "Fjord Norway north to south. Fourteen nights, eight bases, dates open."),
    "hero_image": img(HERO_IMG, 2000),
    "hero_credit": f'<a href="{filepage(HERO_IMG)}">Reine, Lofoten &middot; Wikimedia Commons</a>',
    "eyebrow": "Summer 2028 &middot; dates open",
    "headline": "Norway",
    "sub": ("Arctic first, while the sun does not set — then the fjords, north to south."),
    "chips": CHIPS,
    "nav": NAV,
    "body": ORIENT + WINDOW + ADVENTURE + D1 + D4 + D7 + D8 + D10 + D12 + D14 + QUICK + ESSENTIALS,
    "footer": ('Planned from five research files in <span class="mono">~/workspace/travel/'
               'norway-summer/</span>. Light figures computed with '
               '<span class="mono">sun-times.py</span>, not quoted. Photographs from '
               '<a href="https://commons.wikimedia.org/">Wikimedia Commons</a>, each linked at '
               'its caption. Prices and timetables verified August 2026 — <b>re-check every fare '
               'and sailing once the dates are fixed.</b>'),
    "extra_css":
        # home link back to the hub dashboard; excluded from scrollspy because base.js
        # only observes nav a[href^="#"].
        "nav a.home{color:var(--highlight-on-deep);font-weight:600;"
        "border-right:1px solid color-mix(in srgb, var(--highlight-on-deep) 32%, transparent);"
        "margin-right:6px}"
        "nav a.home:hover{color:var(--header-ink)}"
        # base.css gives .panel p no bottom margin, so consecutive paragraphs ran
        # together in the adventure panels. Space them without touching base.css.
        ".panel p + p{margin-top:11px}"
        # the Reine hero is a busy midtone at the height the eyebrow sits, so this page
        # carries a heavier scrim than the shared default. Tokens only, no literals.
        ".hero::before{background:linear-gradient(180deg,"
        "color-mix(in srgb, var(--bg-deep) 52%, transparent) 0%,"
        "color-mix(in srgb, var(--bg-deep) 30%, transparent) 34%,"
        "color-mix(in srgb, var(--bg-deep) 93%, transparent) 100%)}"
        ".area .days{font-family:var(--font-mono);font-size:.68rem;letter-spacing:.06em}"
                 ".panel ul{margin:6px 0 0 18px}.panel li{margin-bottom:7px;font-size:.94rem}"
                 ".panel table{margin-top:8px}",
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
    G.inject(G.load(str(HERE / "gallery" / "gallery.json")), out)
