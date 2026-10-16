#!/usr/bin/env python3
"""Build algonquin-muskoka-oct-2026/index.html from _system components. Run:  python3 build_page.py"""
import sys, urllib.parse
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "_system"))
import build as S   # noqa: E402

THEME = "autumn"


# ---------- helpers -------------------------------------------------------------------
def img(fn, w=900):
    q = urllib.parse.quote(fn.replace(" ", "_"))
    return f"https://commons.wikimedia.org/wiki/Special:FilePath/{q}?width={w}"


def filepage(fn):
    return "https://commons.wikimedia.org/wiki/File:" + urllib.parse.quote(fn.replace(" ", "_"))


def fig(fn, alt, cap=""):
    c = f"{cap} &middot; " if cap else ""
    return (f'<figure><img loading="lazy" src="{img(fn)}" alt="{alt}">'
            f'<figcaption>{c}<a href="{filepage(fn)}">Wikimedia Commons</a></figcaption></figure>')


def mapq(place):
    return "https://maps.google.com/?q=" + urllib.parse.quote_plus(place)


def embed(place, z=10):
    return f"https://maps.google.com/maps?q={urllib.parse.quote_plus(place)}&z={z}&output=embed"


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
    if photo:
        inner = f'<div class="split">{fig(*photo)}{content}</div>'
    else:
        inner = f'<div class="split noimg">{content}</div>'
    return (f'<div class="stop"><span class="mark mark--{cls}"></span>'
            f'<div class="card">{inner}</div></div>')


def day(sid, dow, num, h2, route, meta, stops, place, route_url, z=10):
    m = "".join(f"<span>{a} <b>{b}</b></span>" for a, b in meta)
    body = "".join(stops)
    return f"""
<section class="day" id="{sid}">
  <div class="sign">
    <div class="date"><span class="dow">{dow}</span><span class="num">{num}</span></div>
    <div class="body"><h2>{h2}</h2><p class="route">{route}</p></div>
  </div>
  <div class="daymeta">{m}</div>
  <div class="trail">{body}</div>
  <div class="mapframe"><iframe loading="lazy" title="{place}" src="{embed(place, z)}"></iframe>
    <div class="bar"><span>{place}</span><a href="{route_url}">Open the day&rsquo;s route in Maps</a></div></div>
  {LEGEND}
</section>"""


# The classifier encodes what a stop asks of you, not a sequence.
CLASSES = [
    ("walk", "On foot &mdash; real footing"),
    ("road", "Driving leg"),
    ("view", "Viewpoint &mdash; short and low effort"),
    ("book", "Book ahead &mdash; permit, slot or reservation"),
    ("food", "Food &mdash; check the holiday hours"),
    ("chk",  "Unverified &mdash; call or check before relying on it"),
]
LEGEND = '<div class="legend">' + "".join(
    f'<span><i class="b" style="background:var(--class-{i+1})"></i>{n}</span>'
    for i, (_, n) in enumerate(CLASSES)) + "</div>"
WALK, ROAD, VIEW, BOOK, FOOD, CHK = 1, 2, 3, 4, 5, 6

# ---------- photos --------------------------------------------------------------------
HERO = "Algonquin Provincial Park, ON, Canada 2019.jpg"
ECHO = "Solitaire lake from Echo Rock Lookout.jpg"
CACHE = "Algonquin Cache Lake Lookout.JPG"
VCDECK = "Algonquin Provincial Park- Fall Colour-View from Visitor Centre –Ontario.jpg"
RAGGED = "Algonquin waterfall.jpg"
LIONS = "Lions Lookout and Town (30392468223).jpg"
FAIRY = "Fall 2013 (31199516235).jpg"
BUCK = "Early Morning and a Canoe on Buck Lake (2920869292).jpg"
LOB = "Lake of Bays Ontario.JPG"
HWY60 = "Highway 60 Smoke Lake.png"
CENT = "Scenery from the lookout of Centennial Ridges Trail.jpg"

# ---------- orientation ---------------------------------------------------------------
AREAS = [
    (BUCK, "Limberlost", "Saturday",
     "A private forest reserve with a lake loop, a boardwalk and one steep lookout. Free, waiver, 9 to 5.",
     "Buck Lake, 5 Oct 2008"),
    (LOB, "Lake of Bays &amp; Dorset", "Base, Sat evening, Mon",
     "The lodge, Dwight Beach at sunset, and a 30 m tower standing 142 m above the lake.", ""),
    (CACHE, "Algonquin, Hwy 60", "Sunday",
     "Track and Tower at km 25: railway ruins, a stream, then one rock ledge over Cache Lake.", ""),
    (RAGGED, "Oxtongue &amp; Ragged Falls", "Sunday afternoon",
     "An 80 ft falls on the way home from Algonquin. June photo: expect much less water in October.",
     "June 2018"),
    (LIONS, "Huntsville", "Sat lunch, Monday",
     "The only town on the route with food and shops open on Thanksgiving Monday.", "Sept 2013"),
]
areas_html = "".join(
    f'<div class="area">{fig(fn, name, cap)}<div class="ab"><h3>{name}</h3>'
    f'<p class="days">{days}</p><p>{txt}</p></div></div>'
    for fn, name, days, txt, cap in AREAS)

NUMS = [("2", "nights"), ("1", "base"), ("~610", "km driven"),
        ("14&ndash;15", "km on foot"), ("$21", "Algonquin permit"), ("18:39", "Saturday sunset")]
nums_html = "".join(f'<div><b>{a}</b><span>{b}</span></div>' for a, b in NUMS)

ORIENT = f"""
<section class="intro" id="orient">
  <p class="kick">Before the days start</p>
  <h2>What this weekend is</h2>
  <div class="lead">
    <p>Muskoka and the Algonquin highlands sit on the Canadian Shield: billion-year-old granite and
    gneiss scraped thin by ice sheets. That is why the lakes are countless, the soil is thin and the
    rock ledges at Echo Rock and Cache Lake are bare enough to stand on and see for kilometres.
    <i>(General background, not taken from the research files.)</i></p>
    <p><b>Why it is famous, specifically.</b> The colour sequence. Sugar and red maple go first
    &mdash; on the west side of Hwy 60 the average peak is 27 September. Then poplar and birch gold,
    beech bronze and last <b>tamarack</b>, the larch that turns gold before it drops its needles,
    expected to peak in mid-October. The 10th to the 12th sits in that second act, which is worth
    planning for rather than being disappointed by.</p>
    <p><b>What is different about 2026.</b> This is an early colour year. On 26 September Friends of
    Algonquin had the maples at canopy best, while Lake of Bays was still at 10&ndash;20%. So the
    <i>lakeside</i> bookends of this trip (Limberlost, Dwight, Dorset) are likelier to be at their best
    than the Algonquin maples on Sunday. The Sunday plan is built around the ledge and the lake,
    not around the red.</p>
  </div>
  <div class="areas">{areas_html}</div>
  <div class="numstrip">{nums_html}</div>

  <h3 class="knowh">Six things that change how you read every day below</h3>
  <ul class="know">
    <li><b>1</b><span><b>Sunday hangs on one booking.</b> The Algonquin day permit is $21 per vehicle
      and is sold online only, up to 5 days ahead. That puts Sunday 11 October on sale
      <b>Tuesday 6 October, 07:00 ET</b> (inferred from the 5-day rule; verify). The Hwy 60 corridor sold
      out for 11&ndash;12 Oct in 2025 and 12&ndash;13 Oct in 2024, both by 8 October. Ontario Parks says
      there is no walk-up once it sells out. Plan B is below.</span></li>
    <li><b>2</b><span><b>Light sets the order.</b> Echo Rock faces east-southeast and is back-lit until
      about 13:30; the Track and Tower ledge faces west-southwest and is front-lit until about 10:30.
      So Solitaire is Saturday afternoon and Track and Tower is Sunday morning. This is why Limberlost is
      not first thing on Saturday.</span></li>
    <li><b>3</b><span><b>Monday is thin.</b> Closed on Mondays by regular hours: Boiler Room, Cast Iron,
      Lake of Bays Brewing, Henrietta&rsquo;s, Family Place. LCBO and Beer Store are closed Thanksgiving
      Monday. Dwight Market is closed Sunday. Shop in Huntsville on Saturday. The lodge itself
      lists &ldquo;Closed for the Season&rdquo; on 12 October.</span></li>
    <li><b>4</b><span><b>Hunting season is open.</b> Grouse, bear and archery deer are open around Dwight,
      Huntsville and Oxtongue; moose (19 Oct) and gun deer (2 Nov) are after the trip. Hunting is banned
      inside Limberlost and, apart from three townships, inside Algonquin. Hunter orange is required
      only for bear hunters not in a tree stand, so for you it is advice: wear something bright at dusk.</span></li>
    <li><b>5</b><span><b>Cold and dark, early.</b> Mean high 12.4&nbsp;&deg;C, mean low 1.9&nbsp;&deg;C for these
      dates; about 40% of nights are at or below 0&nbsp;&deg;C and 54% of days see measurable rain.
      Sunset is 18:35&ndash;18:39 and it is dark by 19:05&ndash;19:09. New moon is Saturday. Deer and moose
      are on the road at dusk.</span></li>
    <li><b>6</b><span><b>Offline on Hwy 60.</b> Cell service is worst between km 20 and 30, which includes
      Track and Tower. Screenshot the permit. AllTrails offline maps are a paid tier; the Limberlost 2026
      map is a free PDF.</span></li>
  </ul>
</section>"""

# ---------- the permit decision -------------------------------------------------------
LIGHT = """
<section class="intro" id="light">
  <p class="kick">Why the days are in this order</p>
  <h2>Sun angle and the permit, not the map</h2>
  <div class="lead">
    <p>Sun times for Dwight (astral, PyEphem and the US Naval Observatory agree within a minute):</p>
    <table>
      <tr><th>Date</th><th>Sunrise</th><th>Sunset</th><th>Civil dusk</th></tr>
      <tr><td>Sat 10 Oct</td><td>07:25</td><td>18:39</td><td>19:09</td></tr>
      <tr><td>Sun 11 Oct</td><td>07:27</td><td>18:37</td><td>19:07</td></tr>
      <tr><td>Mon 12 Oct</td><td>07:28</td><td>18:35</td><td>19:05</td></tr>
    </table>
    <table>
      <tr><th>Place</th><th>Faces</th><th>Best light</th></tr>
      <tr><td>Echo Rock, Solitaire Lake</td><td>east-southeast</td><td>13:30&ndash;16:30 (back-lit before)</td></tr>
      <tr><td>Cache Lake ledge, Track and Tower</td><td>west-southwest <span class="mono">(inferred from OSM, not a source)</span></td><td>sunrise to about 10:30</td></tr>
      <tr><td>Dwight Beach</td><td>southwest</td><td>sunset, azimuth 260 over Dwight Bay</td></tr>
    </table>
    <p>The Sunday permit is the one thing that can break the weekend, so the page carries a full
    replacement day. Tap the toggle in Sunday&rsquo;s section, and decide on the morning permits go
    on sale.</p>
  </div>
</section>"""

# ---------- Saturday ------------------------------------------------------------------
D1 = day("d1", "Sat", "10", "Huntsville, Limberlost and the lake at dusk",
         "Whitby &rarr; Huntsville &rarr; Limberlost &rarr; Port Cunnington Lodge",
         [("Sunrise", "07:25"), ("Sunset", "18:39"), ("Driving", "~260 km"), ("On foot", "6.3 km")],
         [
    stop(ROAD, "08:00", "Leave Whitby", None,
         "<p>177 km to Huntsville, 165 minutes free-flow. Thanksgiving Saturday northbound congestion is "
         "unmeasured &mdash; add 30&ndash;45 minutes. Fill the tank in Huntsville: it is the last real gas "
         "before the lodge. Sign the Limberlost waiver and download the 2026 map PDF at home.</p>",
         stats=[("165 min", "free-flow"), ("177 km", "")],
         links=[("Whitby &rarr; Huntsville", "https://www.google.com/maps/dir/Whitby,+ON/Huntsville,+ON/", True)]),
    stop(FOOD, "11:15", "Lunch and shopping in Huntsville", None,
         "<p>The Mill on Main, 50 Main St E, is open 11&ndash;9 on Saturday. This is also where you buy "
         "Sunday&rsquo;s trail lunch and any alcohol: Dwight Market is closed Sunday and LCBO and the "
         "Beer Store are shut Monday.</p>",
         links=[("The Mill on Main", mapq("The Mill on Main, 50 Main St E, Huntsville, ON"), True)],
         photo=(FAIRY, "Fairy Lake from Lions Lookout, Huntsville", "Fairy Lake from Lions Lookout, Sept 2013"),
         note="Supermarket hours for Thanksgiving 2026 are unconfirmed &mdash; only a 2025 listing exists."),
    stop(BOOK, "12:30", "Limberlost Forest and Wildlife Reserve", ("hidden", "gate 9&ndash;5"),
         "<p>Free, but the online safety waiver is mandatory and the gate closes at 5. <b>Navigate to the "
         "reserve by name, not to 1212 S Limberlost Rd</b> &mdash; that address matches no source. The "
         "official address is 1002 Buck Lake Landing. Start from the Clear Lake Creek lot or Solitaire Beach. "
         "No hunting or firearms inside; no camper vans.</p>",
         stats=[("Hours", "9&ndash;5"), ("Fee", "free"), ("Lot capacity", "unknown")],
         links=[("Map", mapq("Limberlost Forest and Wildlife Reserve, Huntsville, ON"), True),
                ("Official trails", "https://limberlostforest.com/activities/hiking-trails/", False),
                ("Call 705-635-1584", "tel:7056351584", False)],
         photo=(BUCK, "Buck Lake canoe at dawn", "Buck Lake, 5 Oct 2008")),
    stop(WALK, "12:45", "Solitaire Lake Trail", None,
         "<p>The loop around Solitaire Lake: sandy beach, a boardwalk under cliffs, hemlock and old pine, "
         "a heron rookery. Expect mud, roots and some sections beside private cottages. It is a half-day, "
         "not an all-day hike.</p>",
         stats=[("6.3 km", "loop"), ("2&ndash;2.5 h", ""), ("Gain", "about 50 m (GAP)")],
         links=[("AllTrails", "https://www.alltrails.com/trail/canada/ontario/solitaire-lake-loop", False)],
         more=("The length dispute, resolved",
               "<p>The current official page says 6.3 km, easy to moderate. A 2015 brochure PDF says 13 km. "
               "The brochure is stale. AllTrails shows 284 m of gain, which does not survive a comparison with "
               "Gaia&rsquo;s 48 m, so treat gain as small.</p>")),
    stop(VIEW, "~13:45", "Echo Rock lookout", ("unmissable", "afternoon light"),
         "<p>The one long view on the loop, steep climb, over Solitaire Lake to the east-southeast. It is "
         "back-lit until about 13:30 and best from 13:30 to 16:30, which is why the walk starts after lunch. "
         "The photo is from 12 October 2024, 15:48.</p>",
         stats=[("~1.5 km", "from Clear Lake Creek"), ("Best", "13:30&ndash;16:30")],
         photo=(ECHO, "Solitaire Lake from Echo Rock Lookout", "12 Oct 2024 &middot; CC0")),
    stop(ROAD, "15:15", "To the lodge", None,
         "<p>41 minutes. Be out of the gate by 17:00. Check in about 16:00. The lodge is Port Cunnington Lodge; "
         "Dwight&rsquo;s postal code in the sources is P0A 1H0, not the P0C 1J0 in the brief.</p>",
         links=[("Port Cunnington Lodge", mapq("Port Cunnington Lodge, 1679 Port Cunnington Rd, Dwight, ON"), True)]),
    stop(VIEW, "18:15", "Dwight Beach at sunset", ("added", "added"),
         "<p>Public and unsupervised, facing southwest. Sunset is 18:39, azimuth 260, over Dwight Bay. "
         "The lodge shore itself may also work, but its aspect is unverified.</p>",
         photo=(LOB, "Lake of Bays, misty morning", "Lake of Bays &middot; exact spot not stated on the file page"),
         links=[("Dwight Beach", mapq("Dwight Beach, Dwight, ON"), True)]),
    stop(BOOK, "19:15", "Thanksgiving buffet at the lodge", None,
         "<p>Seating #2 runs 19:00&ndash;22:00. $85 per adult, $35 per child 5&ndash;12, free under 5. "
         "Reserve by phone on (705) 635-2505. Whether non-guests can book is not stated, and the lodge's "
         "own pages conflict on Monday, so check.</p>",
         stats=[("Adult", "$85"), ("Child 5&ndash;12", "$35")],
         links=[("Call the lodge", "tel:7056352505", True),
                ("Lodge dining", "https://portcunningtonlodge.com/dining/", False)]),
    stop(VIEW, "20:30", "Dark sky on the dock", ("optional", "optional"),
         "<p>New moon on Saturday, so the sky is effectively moonless from about 20:15. Aurora is unlikely "
         "(NOAA&rsquo;s outlook is Kp 3; about Kp 6 is needed at this latitude). The Bortle class is unverified.</p>"),
], "Limberlost Forest and Wildlife Reserve, Huntsville, Ontario",
         "https://www.google.com/maps/dir/Whitby,+ON/Huntsville,+ON/Limberlost+Forest+and+Wildlife+Reserve/"
         "Port+Cunnington+Lodge,+Dwight,+ON/", 9)

# ---------- Sunday --------------------------------------------------------------------
PLAN_A = """<div class="plan" data-plan="a">""" + "".join([
    stop(ROAD, "06:45", "Leave the lodge", None,
         "<p>57 minutes to the trailhead. The lodge serves a complimentary continental breakfast; the start "
         "time is unknown, so pack something. Sunrise is 07:27.</p>",
         stats=[("57 min", ""), ("57 km", "")]),
    stop(BOOK, "07:45", "Track and Tower trailhead, Hwy 60 km 25", ("hidden", "permit"),
         "<p>The lot is large; the permit quota is the constraint. Show the permit from a <b>screenshot</b> &mdash; "
         "there is no signal from km 20 to 30. Toilets at the trailhead. If the lot is full on a Thanksgiving "
         "Sunday, third-party guides say arrive before 08:00.</p>",
         stats=[("Permit", "$21 / vehicle"), ("Coordinates", "45.5599, -78.5776")],
         links=[("Map", "https://maps.google.com/?q=45.559924,-78.577561", True),
                ("Algonquin alerts", "https://www.ontarioparks.ca/park/algonquin/alerts", False),
                ("Park info 705-633-5572", "tel:7056335572", False)],
         photo=(HWY60, "Highway 60 near Smoke Lake in fall colour", "Hwy 60, 3 Oct 2009")),
    stop(WALK, "08:00", "Track and Tower Trail", None,
         "<p><b>There is no tower.</b> The Skymount fire tower stood until the 1970s. What you walk is an old "
         "railway grade with the ruins of a trestle, a dam at Cache Lake, small falls, a wooden bridge near "
         "5.4 km and about 130 steps up to a ledge. Flat for the first 3 km, then steadily up. Wet leaves "
         "on rock.</p>",
         stats=[("7.5 km", "official"), ("7.5&ndash;8.6 km", "GPS"), ("240&ndash;280 m", "gain"), ("2.5&ndash;4 h", "")],
         links=[("Friends of Algonquin", "https://www.algonquinpark.on.ca/visit/recreational_activites/track-and-tower-trail.php", False),
                ("AllTrails", "https://www.alltrails.com/trail/canada/ontario/algonquin-track-and-tower-trail", False)],
         more=("Conditions and closures",
               "<p>No closure appears on the official alerts page dated 27 September 2026, but there is no dated "
               "2026 trail-condition report. Hardwood Lookout Trail, a different trail, is closed 9&ndash;12 October. "
               "Dogs are allowed on a leash.</p>")),
    stop(VIEW, "~09:15", "The Cache Lake ledge", ("unmissable", "front-lit"),
         "<p>About 4.1 km in. A rock ledge over Cache Lake, unfenced, facing west-southwest and front-lit "
         "until about 10:30. Have lunch here. Cache Lake is the only lake you look at from this trail &mdash; "
         "Lake of Two Rivers is a separate lake 8 km east.</p>",
         stats=[("Front-lit", "to ~10:30"), ("Hazard", "unfenced ledge")],
         photo=(CACHE, "Cache Lake from the lookout", "1 Oct 2005")),
    stop(VIEW, "12:00", "Algonquin Visitor Centre deck, km 43", ("optional", "optional &middot; added"),
         "<p>About 18 km further along Hwy 60, open 9&ndash;5, and the permit already covers it. The "
         "observation deck looks out over the colour. It adds about an hour and about 35 minutes of extra "
         "driving, so take it only if the hike went fast and the light is good.</p>",
         stats=[("Open", "9&ndash;5"), ("Extra", "~1 h")],
         photo=(VCDECK, "View from the Algonquin Visitor Centre", "3 Oct 2010")),
    stop(VIEW, "12:30", "Oxtongue River&ndash;Ragged Falls", None,
         "<p>32 minutes from the trailhead, on the way back. An 80 ft falls, about 1 km out and back, "
         "about an hour, uphill from the lot. The provincial park is open until 18 October. The day-use fee "
         "is unknown; call 705-789-5105. The photo is June flood flow &mdash; October will be lower.</p>",
         stats=[("~1 km", "out and back"), ("~1 h", ""), ("Open to", "18 Oct")],
         links=[("Map", mapq("Oxtongue River-Ragged Falls Provincial Park, Ontario"), True),
                ("Ontario Parks", "https://www.ontarioparks.ca/park/oxtongueriverraggedfalls", False)],
         photo=(RAGGED, "Ragged Falls on the Oxtongue River", "June 2018")),
    stop(FOOD, "14:00", "Back at the lodge, free afternoon", None,
         "<p>Dinner options: the lodge&rsquo;s Seating #1 (16:00&ndash;19:00), Boiler Room in Dwight (12&ndash;8 "
         "Sunday), or Cast Iron in Baysville (12&ndash;8, Thanksgiving dinner after 5, 48 minutes away). "
         "Erika&rsquo;s Bakery and Henrietta&rsquo;s are closed Sunday.</p>",
         links=[("Boiler Room", mapq("Boiler Room Tap and Grill, Dwight, ON"), False)]),
]) + "</div>"

PLAN_B = """<div class="plan" data-plan="b">
  <div class="note" style="margin:0 0 18px"><b>Use this if the Algonquin permit is sold out.</b> Nothing on it needs
  an Algonquin permit. Also try the Monday permit (on sale Wed 7 Oct) and swap Sunday and Monday.</div>""" + "".join([
    stop(BOOK, "09:30", "Dorset Scenic Lookout Tower", None,
         "<p>Moved forward from Monday. A time slot must be booked in advance (it runs 19 September to 25 October). "
         "Open 9&ndash;6, last entry 17:00. 25 minutes from the lodge.</p>",
         stats=[("Vehicle", "$16.74"), ("On foot", "$5.58"), ("Trail", "2.3 km")],
         links=[("Tower page", "https://www.algonquinhighlands.ca/explore-play/parks-and-outdoor-spaces/dorset-scenic-lookout-tower/", True)]),
    stop(VIEW, "11:30", "Ragged Falls", None,
         "<p>27 minutes from the lodge. The park&rsquo;s own permit applies and its fee is unknown.</p>",
         links=[("Map", mapq("Oxtongue River-Ragged Falls Provincial Park, Ontario"), False)]),
    stop(WALK, "13:30", "Limberlost: Buck Lake Trail and the lookout", None,
         "<p>Buck Lake Trail is 4.3 km, easy to moderate; Buck Lake Lookout Trail is 0.7 km and steep. Free, "
         "9&ndash;5, waiver signed on Saturday still applies. Afternoon light again.</p>",
         stats=[("4.3 + 0.7 km", ""), ("Fee", "free")],
         photo=(BUCK, "Buck Lake", "Buck Lake, 5 Oct 2008")),
]) + "</div>"

D2 = day("d2", "Sun", "11", "Track and Tower, then the falls",
         "Port Cunnington Lodge &rarr; Algonquin km 25 &rarr; Ragged Falls &rarr; lodge",
         [("Sunrise", "07:27"), ("Sunset", "18:37"), ("Driving", "~115 km"), ("On foot", "8&ndash;10 km")],
         [
    f"""<div class="toggle">
      <button data-plan-btn="a">Plan A &middot; Algonquin</button>
      <button data-plan-btn="b">Plan B &middot; permit sold out</button>
    </div>
    <div class="planwrap" style="margin-top:22px">{PLAN_A}{PLAN_B}</div>"""],
         "Track and Tower Trail, Algonquin Provincial Park, Ontario",
         "https://www.google.com/maps/dir/Port+Cunnington+Lodge,+Dwight,+ON/45.559924,-78.577561/"
         "Oxtongue+River-Ragged+Falls+Provincial+Park/Port+Cunnington+Lodge,+Dwight,+ON/", 10)

# ---------- Monday --------------------------------------------------------------------
D3 = day("d3", "Mon", "12", "The tower, Huntsville and the drive home",
         "Lodge &rarr; Dorset &rarr; Huntsville &rarr; Whitby &middot; Canadian Thanksgiving",
         [("Sunrise", "07:28"), ("Sunset", "18:35"), ("Driving", "~240 km"), ("On foot", "~2.3 km")],
         [
    stop(VIEW, "07:28", "Sunrise over the water", None,
         "<p>From the lodge shore. The lodge&rsquo;s own calendar shows &ldquo;Closed for the Season&rdquo; on "
         "12 October and the dining page says Saturday to Monday dinners, so ask about the check-out time "
         "and where you can leave bags.</p>",
         links=[("Call the lodge", "tel:7056352505", False)]),
    stop(BOOK, "09:30", "Dorset Scenic Lookout Tower", ("added", "added &middot; slot required"),
         "<p>25 minutes from the lodge. A 30 m tower with a 360 degree view, 142 m above Lake of Bays. "
         "Open 9&ndash;6 on Thanksgiving Monday, last entry 17:00. Book a slot in advance. "
         "Whether the climb itself is open is unconfirmed; the fee applies either way.</p>",
         stats=[("Vehicle", "$16.74"), ("On foot", "$5.58"), ("Trail", "2.3 km"), ("From lodge", "25 min")],
         links=[("Tower page", "https://www.algonquinhighlands.ca/explore-play/parks-and-outdoor-spaces/dorset-scenic-lookout-tower/", True),
                ("Map", "https://maps.google.com/?q=45.2521793,-78.8932465", False)],
         note="Slot availability is unverified: the booking site blocked the research tool."),
    stop(VIEW, "11:30", "Huntsville: Lions Lookout and downtown", ("added", "added"),
         "<p>38 minutes from Dorset. Lions Lookout is a free gazebo over Fairy Lake and the Muskoka River, "
         "reached by a steep drive up, with two small lots that will be busy. Downtown has 90+ murals and "
         "the Hunter&rsquo;s Bay boardwalk. Both are outdoors and work in light rain.</p>",
         stats=[("Fee", "free"), ("Parking", "limited")],
         links=[("Lions Lookout", mapq("Lions Lookout, Huntsville, ON"), True)],
         photo=(LIONS, "Huntsville from Lions Lookout", "Sept 2013")),
    stop(FOOD, "12:15", "Lunch, Huntsville", None,
         "<p>The Mill on Main lists 11&ndash;8 on public holidays and On the Docks lists 11 to midnight daily, "
         "both from secondary sources. Call before you drive.</p>",
         links=[("The Mill on Main", "tel:7057885150", False), ("On the Docks", mapq("On The Docks Pub, 90 Main St E, Huntsville, ON"), False)],
         note="Family Place, Boiler Room, Cast Iron and Lake of Bays Brewing are all closed Mondays."),
    stop(ROAD, "13:15", "Drive home &mdash; leave by 13:30 or after 19:30", ("hidden", "decision rule"),
         "<p>178 km, 167 minutes free-flow, so about 16:00 in Whitby if the road is clear. Thanksgiving Monday "
         "southbound traffic on Hwy 11 and 400 is unmeasured, and the only warnings found were low-quality. "
         "The rule is to leave early, or to stay for dinner in Huntsville and leave after 19:30; the "
         "in-between hours are the ones to avoid. Leaving at 19:30 means driving in the dark (sunset is 18:35), "
         "so it is also the option with the deer and moose risk.</p>",
         stats=[("167 min", "free-flow"), ("178 km", ""), ("Tolls", "none")],
         links=[("Huntsville &rarr; Whitby", "https://www.google.com/maps/dir/Huntsville,+ON/Whitby,+ON/", True),
                ("511 Ontario", "https://511on.ca", False)]),
], "Dorset Scenic Lookout Tower, Ontario",
         "https://www.google.com/maps/dir/Port+Cunnington+Lodge,+Dwight,+ON/45.2521793,-78.8932465/"
         "Huntsville,+ON/Whitby,+ON/", 9)

# ---------- quick links / essentials ---------------------------------------------------
QUICK = """
<section class="quick" id="quick">
  <h2>Day-of links</h2>
  <p class="qsub">The handful actually tapped in the field</p>
  <div class="qgrid">
    <div class="qcard">
      <h4><span class="dot" style="background:var(--class-4)"></span>Algonquin</h4>
      <a class="warn" href="https://www.ontarioparks.ca/park/algonquin/alerts"><b>Alerts</b>Closures, permit status, Hwy 60 notices</a>
      <a href="https://www.algonquinpark.on.ca/visit/general_park_info/fall-colour-report.php"><b>Fall colour report</b>Friends of Algonquin, updated weekly</a>
      <a class="tel" href="tel:7056335572"><b>705-633-5572</b>Algonquin Park Information</a>
      <a class="tel" href="tel:18886687275"><b>1-888-668-7275</b>Day-use permits by phone</a>
    </div>
    <div class="qcard">
      <h4><span class="dot" style="background:var(--class-2)"></span>Weather and roads</h4>
      <a href="https://weather.gc.ca/en/location/index.html?coords=45.325,-79.218"><b>Huntsville forecast</b>Environment Canada. Appears about 3&ndash;5 Oct</a>
      <a href="https://weather.gc.ca/en/location/index.html?coords=45.58,-78.48"><b>Algonquin forecast</b>Environment Canada, Hwy 60 side</a>
      <a class="warn" href="https://511on.ca"><b>511 Ontario</b>Road conditions and closures</a>
    </div>
    <div class="qcard">
      <h4><span class="dot" style="background:var(--class-3)"></span>Colour and places</h4>
      <a href="https://www.discovermuskoka.ca/ontario-fall-colour-report/"><b>Discover Muskoka colour report</b>Lake of Bays, Huntsville, Algonquin percentages</a>
      <a href="https://limberlostforest.com/activities/hiking-trails/"><b>Limberlost</b>Hours, trails, the waiver</a>
      <a href="https://www.algonquinhighlands.ca/explore-play/parks-and-outdoor-spaces/dorset-scenic-lookout-tower/"><b>Dorset tower</b>Slot booking and fees</a>
    </div>
    <div class="qcard">
      <h4><span class="dot" style="background:var(--class-5)"></span>The lodge</h4>
      <a class="tel" href="tel:7056352505"><b>(705) 635-2505</b>Port Cunnington Lodge &mdash; buffet, check-out, breakfast time</a>
      <a href="https://portcunningtonlodge.com/calendar-of-events/"><b>Calendar of events</b>Thanksgiving seatings</a>
    </div>
  </div>
</section>"""

CHECK_ITEMS = [
    ("permit", "<b>Tue 6 Oct, 07:00 ET</b> &mdash; buy the Sunday Algonquin day permit ($21). Verify the release time first"),
    ("waiver", "Limberlost safety waiver signed online; 2026 map PDF downloaded"),
    ("dorset", "Dorset tower time slot booked (Monday, or Sunday if Plan B)"),
    ("lodge", "Call the lodge: Saturday Seating #2 booked, Monday check-out time, breakfast start time, non-guest booking"),
    ("fee", "Ragged Falls day-use fee checked (705-789-5105)"),
    ("forecast", "Environment Canada forecast read on 5 Oct; decide Plan A or B"),
    ("colour", "Colour reports read on 8 Oct"),
    ("shop", "Sunday trail lunch and any alcohol bought Saturday in Huntsville"),
    ("screenshot", "Permit and map screenshots on the phone &mdash; no signal on Hwy 60 at km 20&ndash;30"),
    ("layers", "Layers, gloves and a hat &mdash; 40% of nights are at or below freezing"),
    ("boots", "Waterproof, grippy boots &mdash; mud, streams and wet leaves on rock"),
    ("light", "Headlamp &mdash; dark by 19:05 and the moon is new"),
    ("bright", "Something bright to wear at dusk (hunting season)"),
    ("fuel", "Full tank in Huntsville on Saturday &mdash; the last real gas before the lodge"),
]
checklist = "".join(
    f'<label><input type="checkbox" data-k="{k}"><span>{t}</span></label>' for k, t in CHECK_ITEMS)

ESSENTIALS = f"""
<section class="intro" id="essentials">
  <p class="kick">Money, kit and the honest state</p>
  <h2>Essentials</h2>
  <div class="grid2">
    <div class="panel">
      <h3>Cost, per vehicle</h3>
      <table>
        <tr><td>Algonquin day permit, Sunday</td><td>$21.00</td></tr>
        <tr><td>Dorset tower</td><td>$16.74, or $5.58 per person on foot</td></tr>
        <tr><td>Ragged Falls</td><td class="mono">GAP</td></tr>
        <tr><td>Limberlost</td><td>free, waiver required</td></tr>
        <tr><td>Lodge Thanksgiving buffet</td><td>$85 adult, $35 child 5&ndash;12</td></tr>
        <tr><td>Tolls on the recommended routes</td><td>none (the 407 would add roughly $26&ndash;45)</td></tr>
      </table>
    </div>
    <div class="panel check">
      <h3>Before you go</h3>
      <div id="checklist">{checklist}</div>
      <p class="mono" style="font-size:.72rem;margin-top:10px">Ticks are saved in this browser.</p>
    </div>
  </div>
  <div class="panel" style="margin-top:20px">
    <h3>Still open &mdash; the honest state</h3>
    <ul>
      <li><b>1</b><span><b>The permit release time and refund terms.</b> The 5-day rule is official; the 07:00 ET release and the dates in this plan are inferred.</span></li>
      <li><b>2</b><span><b>Dorset tower slots and whether the climb is open.</b> ahtrails.ca refused the research tool.</span></li>
      <li><b>3</b><span><b>Limberlost lot capacity</b> and whether it fills on Thanksgiving Saturday. Nothing is published.</span></li>
      <li><b>4</b><span><b>Every Thanksgiving traffic estimate.</b> No measured data was found for Hwy 400, 11 or 12.</span></li>
      <li><b>5</b><span><b>Holiday hours</b> for Huntsville supermarkets and restaurants in 2026.</span></li>
      <li><b>6</b><span><b>The Cache Lake ledge orientation</b> is derived from an unofficial map point, not a source.</span></li>
      <li><b>7</b><span><b>Photos.</b> Wikimedia Commons has no usable image of the Dorset tower, Dwight Beach or Track and Tower itself, so a few stops on this page have no picture, and the Ragged Falls photo is June flood flow.</span></li>
    </ul>
  </div>
</section>"""

# ---------- assemble ------------------------------------------------------------------
NAV = '<a class="home" href="/">&#8592; All plans<span class="d">dashboard</span></a>' + "".join(
    f'<a href="#{i}"><span class="d">{d}</span>{n}</a>' for i, d, n in [
    ("orient", "Read first", "Orientation"),
    ("light", "Decide", "Order of days"),
    ("d1", "Saturday", "Limberlost"),
    ("d2", "Sunday", "Algonquin"),
    ("d3", "Monday", "Dorset &amp; home"),
    ("quick", "In the field", "Day-of links"),
    ("essentials", "Money &amp; kit", "Essentials"),
])

CHIPS = "".join(f'<span class="chip"><strong>{a}</strong> {b}</span>' for a, b in [
    ("2", "nights"), ("~610", "km"), ("Thanksgiving", "weekend")]) + \
    '<span class="chip"><strong id="countdown">&mdash;</strong></span>'

CTX = {
    "slug": "algonquin-muskoka-oct-2026",
    "trip_date": "2026-10-10",
    "trip_dates": "10&ndash;12 October 2026",
    "trip_duration": "2 nights",
    "trip_region": "Muskoka &amp; Algonquin",
    "title": "Muskoka and Algonquin, 10–12 October 2026",
    "description": ("Thanksgiving weekend on Lake of Bays: Limberlost, Track and Tower, Ragged Falls "
                    "and the Dorset tower, ordered by sun angle and the Algonquin permit."),
    "hero_image": img(HERO, 2000),
    "hero_credit": f'<a href="{filepage(HERO)}">Algonquin, 12 Oct 2019 (Thanksgiving Saturday that year) &middot; Wikimedia Commons</a>',
    "eyebrow": "10&ndash;12 October 2026 &middot; Canadian Thanksgiving",
    "headline": "Muskoka &amp; Algonquin",
    "sub": ("Two nights on Lake of Bays. Limberlost in the afternoon light, Track and Tower in the morning, "
            "and one permit that decides Sunday."),
    "chips": CHIPS,
    "nav": NAV,
    "body": ORIENT + LIGHT + D1 + D2 + D3 + QUICK + ESSENTIALS,
    "footer": ('Planned from four research files in <span class="mono">~/workspace/travel/'
               'algonquin-muskoka-oct-2026/</span>. Drive times are OSRM free-flow, routed from the lodge, '
               'not measured holiday traffic. Sun times computed with astral and cross-checked against '
               'PyEphem and the US Naval Observatory. Photographs from '
               '<a href="https://commons.wikimedia.org/">Wikimedia Commons</a>, each linked at its caption. '
               'Verified 27 September 2026. <b>The Algonquin permit release date, the Dorset tower slots and '
               'all Thanksgiving traffic timing are unconfirmed.</b>'),
    "extra_css":
        "nav a.home{color:var(--highlight-on-deep);font-weight:600;"
        "border-right:1px solid color-mix(in srgb, var(--highlight-on-deep) 32%, transparent);"
        "margin-right:6px}"
        "nav a.home:hover{color:var(--header-ink)}"
        ".panel p + p{margin-top:11px}"
        ".panel ul{margin:6px 0 0 0;list-style:none;padding:0}.panel li{margin-bottom:7px;font-size:.94rem}"
        ".panel table{margin-top:8px}"
        ".panel li > b:first-child{margin-right:7px;color:var(--accent)}"
        ".area .days{font-family:var(--font-mono);font-size:.68rem;letter-spacing:.06em}"
        ".knowh{margin:34px 0 0;font-family:var(--font-display);font-size:1.15rem;letter-spacing:.01em}"
        ".know li span b{font-family:inherit;font-size:inherit;font-weight:700;color:var(--ink)}"
        ".know li span b:first-child{color:var(--warn)}"
        ".intro .lead table{margin:6px 0 16px}",
}

html_out = S.assemble(CTX, THEME)
problems = S.check_output_is_self_contained(html_out)
if problems:
    raise SystemExit("SELF-CONTAINMENT FAILED:\n  " + "\n  ".join(problems))
out = HERE / "index.html"
out.write_text(html_out, encoding="utf-8")
print(f"wrote {out}  ({len(html_out):,} bytes, theme={THEME})")
