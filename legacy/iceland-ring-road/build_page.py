#!/usr/bin/env python3
"""Build iceland-ring-road/index.html from _system components. Run:  python3 build_page.py"""
import sys, urllib.parse
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "_system"))
sys.path.insert(0, str(HERE.parents[1] / "tools" / "gallery"))
import build as S   # noqa: E402

THEME = "alpine-snow"


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
    return "https://maps.google.com/?q=" + urllib.parse.quote_plus(", ".join(parts) + ", Iceland")


def embed(place, z=8):
    return f"https://maps.google.com/maps?q={urllib.parse.quote_plus(place + ', Iceland')}&z={z}&output=embed"


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


# Slots are chosen against the `alpine-snow` palette, not alphabetically. --class-2 is
# near-white, so it carries "road": an unfilled marker reads correctly as "nothing happens
# here, you are just driving". The amber slot carries "book ahead", red carries the wind and
# wave hazard, and slate carries the nights that only work in the dark.
CLASSES = [
    ("pool",  "Geothermal water &mdash; and the day&rsquo;s shower"),
    ("road",  "Driving leg"),
    ("walk",  "On foot &mdash; real footing"),
    ("book",  "Book ahead &mdash; fixed group size or sailing"),
    ("wind",  "Wind, wave or surf hazard &mdash; check before you go"),
    ("dark",  "Needs the night &mdash; aurora-dependent"),
]
LEGEND = '<div class="legend">' + "".join(
    f'<span><i class="b" style="background:var(--class-{i+1})"></i>{n}</span>'
    for i, (_, n) in enumerate(CLASSES)) + "</div>"

# ---------- orientation ---------------------------------------------------------------
AREAS = [
    ("Almannagjá rift at Þingvellir National Park.jpg", "Reykjanes &amp; the Golden Circle",
     "Days 1&ndash;2",
     "Where you land, and the only place on the trip you can walk down inside the plate boundary itself."),
    ("Reynisfjara and Reynisdrangar, Iceland.jpg", "The South Coast",
     "Days 3&ndash;4",
     "Waterfalls you walk behind, black sand, and the one beach on this island that kills people."),
    ("Icebergs in the Jökulsárlón Glacier Lagoon, Iceland.jpg", "Vatnaj&ouml;kull &amp; the lagoons",
     "Days 4&ndash;5",
     "Europe&rsquo;s largest ice cap, its glacier tongues reaching down to the road, and icebergs on a black beach."),
    ("Seyðisfjörður Panorama 01.jpg", "The East Fjords &amp; M&yacute;vatn",
     "Days 6&ndash;9",
     "The empty half. Hairpin fjord roads, then boiling mud and lava labyrinths &mdash; and the first real darkness."),
    ("Kirkjufell, Iceland, 20240714 1631 0713.jpg", "Sn&aelig;fellsnes &amp; the west",
     "Days 10&ndash;12",
     "&ldquo;Iceland in miniature&rdquo; &mdash; glacier volcano, black pebble beach, shipwreck, one famous mountain."),
]

areas_html = "".join(
    f'<div class="area">{fig(fn, name)}<div class="ab"><h3>{name}</h3>'
    f'<p class="days">{days}</p><p>{txt}</p></div></div>'
    for fn, name, days, txt in AREAS)

NUMS = [("11", "nights"), ("10", "campsites"), ("~2,190", "km driven"),
        ("1,332", "km &mdash; Route 1 itself"), ("390", "km &mdash; longest day"),
        ("0", "hotels")]
nums_html = "".join(f'<div class="num"><b>{a}</b><span>{b}</span></div>' for a, b in NUMS)

ORIENT = f"""
<section class="intro" id="orient">
  <p class="kick">Before the days start</p>
  <h2>What Iceland physically is</h2>
  <div class="lead">
    <p>Iceland is the only place on earth where a <b>mid-ocean ridge sits above sea level</b>. The
    Mid-Atlantic Ridge runs the length of the island and a mantle plume sits underneath it &mdash;
    that combination is the only reason there is land here at all instead of two and a half
    kilometres of water. The North American and Eurasian plates are pulling apart at roughly
    <b>2 cm a year</b>, and at &THORN;ingvellir you walk down into the rift they leave behind.</p>
    <p>Everything else follows from that one fact. The fissure eruptions. The geothermal fields you
    can smell before you see. The black sand, which is basalt ground down by ice and sea. And the
    glaciers sitting directly <i>on top of</i> active volcanoes &mdash; which is why Icelandic has a
    word, <span class="mono">j&ouml;kulhlaup</span>, for the flood that happens when one erupts
    underneath the other.</p>
    <p><b>Why it is famous, specifically.</b> Not &ldquo;waterfalls&rdquo;. The compression. You can
    stand between two continental plates in the morning, walk on a glacier tongue after lunch, and
    sleep beside a lava field that was liquid within living memory &mdash; without driving more than
    three hours.</p>
    <p><b>What you cannot get anywhere else.</b> &THORN;ingvellir is both the rift valley and the site
    of the <b>Al&thorn;ingi, founded in 930 AD</b> &mdash; the oldest surviving parliament in the
    world, held in a crack between two continents. And the pool culture: every town has a heated
    outdoor pool with hot pots, open late, at roughly a tenth of the price of the tourist lagoons.
    In a van, that is your daily shower <i>and</i> your evening out.</p>
  </div>

  <div class="areas">{areas_html}</div>

  <div class="numstrip">{nums_html}</div>

  <h3 class="knowh">Six things that change how you read every day below</h3>
  <ul class="know">
    <li><b>1</b><span><b>You cannot sleep outside a campsite.</b> Since 2015 it has been illegal for
      vans and motorhomes, full stop, and it is enforced. That removes the evening scramble &mdash;
      but it also means <b>every day here is ordered around where the campsite is</b>, not where the
      last waterfall is. That is the reverse of every other plan in this folder.</span></li>
    <li><b>2</b><span><b>Wind is the hazard, not cold.</b> Gusts over 50&nbsp;km/h are routine and
      can pass 80. <b>Never open a van door into the wind</b> &mdash; doors bent backwards on their
      hinges are the classic Icelandic rental claim. Park nose into it.</span></li>
    <li><b>3</b><span><b>No F-roads.</b> A 2WD camper is not permitted on them, driving one there
      voids the whole insurance policy, and <b>no Icelandic insurer sells river-crossing cover at any
      price</b>. Landmannalaugar, &THORN;&oacute;rsm&ouml;rk and Askja are out. That is a vehicle
      limit, not a scheduling one.</span></li>
    <li><b>4</b><span><b>Get the heater.</b> Nights run 4&ndash;7&nbsp;&deg;C. It is the cheapest
      upgrade on the rental sheet and the one that decides whether the trip is fun.</span></li>
    <li><b>5</b><span><b>The Camping Card expires 15 September</b>, every year. The window is built
      to end inside it, with one day to spare.</span></li>
    <li><b>6</b><span><b>Shop properly on day one.</b> B&oacute;nus or Kr&oacute;nan in Selfoss.
      Prices climb steeply the moment you leave the southwest, and several days below have no useful
      supermarket at all.</span></li>
  </ul>
</section>"""

# ---------- the window decision -------------------------------------------------------
WINDOW = """
<section class="intro" id="window">
  <p class="kick">The one decision that set everything else</p>
  <h2>Why early September, and not summer</h2>
  <div class="lead">
    <p>I computed the sun angles for eight points on this route with the NOAA algorithm
    (<span class="mono">sun-times.py</span> and <span class="mono">dark-times.py</span> in the trip
    folder &mdash; reproducible, nothing quoted). Iceland is <b>UTC+0 all year</b>, so there is no
    daylight-saving correction to argue about.</p>
    <p>The result is blunter than expected: <b>Iceland gets no astronomical darkness at all before
    about 3 September.</b> In mid-July it does not even reach the <i>end of civil twilight</i>. An
    aurora on a summer van trip is not unlikely &mdash; it is physically impossible.</p>
    <p>That pushes the trip later. Three things push it earlier: campsites shut through September
    (<b>50 close during the month</b>, 22 more in October, and only ~23 publish an all-year season);
    <b>the Camping Card expires 15 September</b>; and the weather degrades. <b>The two curves cross
    in a narrow band, and this window sits in it.</b></p>
    <table>
      <tr><th>Date</th><th>Reykjav&iacute;k &mdash; true dark (sun &lt; &minus;18&deg;)</th><th>M&yacute;vatn</th></tr>
      <tr><td>15 Jul</td><td>none &mdash; light all night, no civil twilight end</td><td>none</td></tr>
      <tr><td>28 Aug</td><td>none</td><td>none</td></tr>
      <tr><td>1 Sep</td><td>none</td><td>none</td></tr>
      <tr><td>4 Sep</td><td>21:53 &ndash; 23:10 &nbsp;(1.3&nbsp;h)</td><td>none</td></tr>
      <tr><td>8 Sep</td><td>21:04 &ndash; 23:57 &nbsp;(2.9&nbsp;h)</td><td>22:11 &ndash; 23:30 (1.3&nbsp;h)</td></tr>
      <tr><td>12 Sep</td><td>20:32 &ndash; 00:26 &nbsp;(3.9&nbsp;h)</td><td>21:19 &ndash; 00:18 (3.0&nbsp;h)</td></tr>
      <tr><td>15 Sep</td><td>20:12 &ndash; 00:43 &nbsp;(4.5&nbsp;h)</td><td>20:54 &ndash; 00:41 (3.8&nbsp;h)</td></tr>
    </table>
  </div>

  <div class="toggle">
    <button data-plan-btn="a">Window A &middot; recommended</button>
    <button data-plan-btn="b">Window B</button>
  </div>

  <div class="planwrap">
    <div class="plan" data-plan="a">
      <div class="panel">
        <h3>4 &ndash; 15 September 2027 &middot; 11 nights</h3>
        <p><b>The route is deliberately counter-clockwise, and the reason is the darkness table
        above.</b> The south coast comes first, when there is barely any dark and it does not matter.
        By the time the trip reaches M&yacute;vatn and the north on nights 7&ndash;9
        (10&ndash;12 September), true darkness has arrived: 1.3&nbsp;h, then 3.0&nbsp;h.
        The aurora chances land in the half of the trip that is furthest from city light.</p>
        <p>It also puts the most weather-exposed stretch &mdash; the south coast, where the gusts are
        worst &mdash; on the earliest and statistically driest days of the window.</p>
        <p><b>Last camping night is 14 September</b>, one day inside the Camping Card&rsquo;s
        validity. That is not a coincidence; it is the constraint that fixed the end date.</p>
        <table>
          <tr><th></th><th>Window A</th><th>Window B</th></tr>
          <tr><td>True dark by the north nights</td><td>1.3 &rarr; 3.0 h</td><td>3.8 &rarr; 4.5 h</td></tr>
          <tr><td>Camping Card valid</td><td><b>Yes, throughout</b></td><td>No &mdash; expires mid-trip</td></tr>
          <tr><td>Campsite closure risk</td><td>Low</td><td><b>Real</b></td></tr>
          <tr><td>Rain and wind odds</td><td>Lower</td><td>Higher</td></tr>
          <tr><td>Crowds</td><td>Falling</td><td>Gone</td></tr>
        </table>
      </div>
    </div>
    <div class="plan" data-plan="b">
      <div class="panel">
        <h3>11 &ndash; 22 September 2027 &middot; one week later</h3>
        <p>Same route, same direction, shifted seven days. It buys <b>4.5 hours of true darkness
        instead of 1.3</b> and roads that are genuinely empty.</p>
        <p>It costs the <b>Camping Card entirely</b> &mdash; the card stops working on 15 September,
        which is day five &mdash; and it exposes the back half of the trip to the September campsite
        closures. It also raises the odds of a wet, windy week, and mountain snow starts appearing
        late in the month.</p>
        <p><b>Take this one only if the aurora is the point of the trip</b> and you are willing to
        phone every campsite from Day 6 onward to confirm it is still open. Egilssta&eth;ir,
        Borgarnes and Reykjav&iacute;k Laugardalur are the year-round fallbacks.</p>
      </div>
    </div>
  </div>
</section>"""

# ---------- the van section: rules and hard limits -------------------------------------
VAN = """
<section class="intro" id="van">
  <p class="kick">First van trip &mdash; read this before booking anything</p>
  <h2>The van rules, and the limits that decide who can do what</h2>
  <div class="lead">
    <p>Three constraints do more to shape this trip than any scenery does. Two are legal and one is
    physical, and none of them are negotiable.</p>
  </div>

  <div class="grid2">
    <div class="panel">
      <h3>You sleep at a campsite or you break the law</h3>
      <p>Since the 2015 tightening of the Nature Conservation Act, <b>overnighting in a campervan or
      motorhome is legal only at a marked campsite</b>. The Icelandic right to roam does not extend
      to vehicles. Pulling over somewhere remote for the night is not a grey area; enforcement is
      active, fines are real, and illegal parking can compromise the rental&rsquo;s insurance.</p>
      <p><b>Read it as a feature.</b> There are 170+ registered campsites and one is almost always
      within reach, so the worst part of first-time van travel &mdash; the 18:00 scramble for
      somewhere legal &mdash; simply does not happen here.</p>
      <p><b>But it cancels the usual van superpower.</b> You cannot wake up at a trailhead. Days get
      planned around campsite locations, and campsites are in towns.</p>
    </div>
    <div class="panel">
      <h3>F-roads are off the table in this vehicle</h3>
      <p><b>2WD vehicles are not permitted on F-roads.</b> Taking one up there voids the entire
      insurance policy and risks a fine under Icelandic traffic law.</p>
      <p>Behind that sits a harder limit: <b>no Icelandic insurer offers river-crossing cover at any
      price.</b> Not as an add-on, not at all. F-roads have unbridged rivers. Flood the van and you
      have bought it &mdash; they are worth <b>8&ndash;12 million ISK</b>.</p>
      <p>So Landmannalaugar, &THORN;&oacute;rsm&ouml;rk, Askja and Kerlingarfj&ouml;ll are out of this
      trip. <b>Accepted deliberately:</b> remote unsignposted country with no phone signal is not
      where you learn what a van does. If the interior matters later, it needs an F-road-legal 4x4
      camper, or a highland bus with the van left in town.</p>
    </div>
  </div>

  <div class="grid2">
    <div class="panel">
      <h3>Silfra snorkel &mdash; the hard limits <span class="tag tag--optional">optional</span></h3>
      <p>Drifting between the North American and Eurasian plates in 2&nbsp;&deg;C glacial meltwater,
      in a dry suit. The limits are dry-suit fit limits, not policy, so there is no arguing them.</p>
      <table>
        <tr><th>Minimum age</th><td><b>12</b> &mdash; under-18s need a parent on the same tour</td></tr>
        <tr><th>Height</th><td><b>150 &ndash; 200 cm</b></td></tr>
        <tr><th>Weight</th><td><b>45 &ndash; 120 kg</b></td></tr>
        <tr><th>Swimming</th><td>Competent swimmer, comfortable in water</td></tr>
      </table>
      <p class="fine"><b>The medical form is the part that catches people, and it is mandatory
      before booking.</b> A &ldquo;yes&rdquo; to anything in Section&nbsp;1 &mdash; heart or
      blood-vessel disease, heart attack, cardiac or vascular surgery, angina, <b>pregnancy</b>, lung
      disease, collapsed lung, chest surgery, epilepsy or seizures &mdash; <b>disqualifies you
      outright</b>. A &ldquo;yes&rdquo; in Section&nbsp;2 &mdash; including <b>being 60 or older</b>,
      high blood pressure, fainting spells, cancer or cancer treatment within two years, high
      cholesterol, or a family history of heart disease &mdash; requires <b>written doctor&rsquo;s
      clearance in advance</b>. Check the form against everyone in the group before paying.</p>
    </div>
    <div class="panel">
      <h3>Glacier walks &mdash; pick one, not both <span class="tag tag--optional">optional</span></h3>
      <p>S&oacute;lheimaj&ouml;kull sits on Day&nbsp;3, Fallj&ouml;kull at Skaftafell on Day&nbsp;4.
      Doing both is repetition; the plan books one.</p>
      <table>
        <tr><th>Tour</th><th>Min age</th><th>On ice</th><th>Price</th></tr>
        <tr><td>Easy hike, 3 h</td><td><b>8</b></td><td>~90 min</td><td>~US$105</td></tr>
        <tr><td>Advanced hike, 5 h</td><td><b>12</b></td><td>~3 h</td><td>~US$162</td></tr>
        <tr><td>Ice climb</td><td>12</td><td>&mdash;</td><td>~US$251</td></tr>
      </table>
      <p class="fine">Fallj&ouml;kull tours run from the Tr&ouml;ll base at Skaftafell with
      <b>groups capped at ten</b> and a <b>minimum age of 12</b>, so it is the one that sells out.
      Prices are 2026 figures &mdash; <span class="mono">GAP</span>, no 2027 rates published.</p>
    </div>
  </div>

  <div class="grid2">
    <div class="panel">
      <h3>Reynisfjara &mdash; the one that is actually dangerous</h3>
      <p>Sneaker waves here run far higher up the beach than the previous ten waves suggest, and
      people have died. <b>It also changed this year:</b> a landslide and severe coastal erosion in
      <b>February 2026</b> narrowed the shoreline and largely destroyed one of the viewing platforms.
      Access is now managed by safety zone and can be restricted depending on surf, tide and wind.</p>
      <p class="fine">Since <b>August 2025, entering H&aacute;lsanefshellir cave is prohibited
      whenever the red warning light is flashing.</b> Stay high on the beach. Never turn your back
      on the water. This is the single stop on the trip where the rule matters more than the photo.</p>
    </div>
    <div class="panel">
      <h3>What September costs you, honestly</h3>
      <p><b>The puffins are gone.</b> They leave Iceland from about mid-August, and from 15 August
      operators stop selling combined whale-and-puffin trips altogether. Dyrh&oacute;laey will have
      empty cliffs.</p>
      <p>There is no window that has both puffins and aurora &mdash; one needs summer, the other
      needs darkness, and in Iceland those never overlap. This plan chooses the aurora.</p>
      <p><b>Whale watching still works:</b> humpback and minke are the September species at
      H&uacute;sav&iacute;k. Blue whales are early-season only.</p>
    </div>
  </div>
</section>"""

# ---------- days ----------------------------------------------------------------------
D1 = day("d1", "Sat&ndash;Sun", "4&ndash;5", "Reykjanes and the Golden Circle",
  "KEF &rarr; Reykjanes tip &rarr; Selfoss &rarr; &THORN;ingvellir &rarr; Geysir &rarr; Gullfoss &rarr; Laugarvatn",
  [("Driving", "~290 km"), ("Nights", "Selfoss, Laugarvatn"), ("Daylight", "14.4 h"), ("True dark", "1.3 h &mdash; barely")],
  [
   stop(2, "06:00", "Land at Keflav&iacute;k, collect the van", None,
     "<p>You arrive on a night of aeroplane sleep. <b>Day 1 is deliberately the lightest of the trip</b> "
     "&mdash; the mistake first-timers make is booking a full day on top of a red-eye.</p>"
     "<p>Before driving anywhere, sit in the car park and find everything: gas hob, water tank and "
     "filler, waste tap, heater switch and its fuel source, the 12V and 230V circuits, and where the "
     "electric hook-up cable lives. Ten minutes here saves an evening later.</p>",
     [("YYZ&rarr;KEF", "5 h 35 m"), ("Arrival", "06:00&ndash;09:00"), ("Flights", "~19/week")],
     [("Keflav&iacute;k Airport", mapq("Keflavik International Airport"), True)],
     ("Gunnuhver Geothermal Area, Iceland, 20230430 1340 3616.jpg", "Gunnuhver geothermal field, Reykjanes"),
     ("Fuel and the first shop",
      "<p>Fill the tank before leaving the peninsula and do the big shop at <b>B&oacute;nus or "
      "Kr&oacute;nan in Selfoss</b>. Prices climb sharply once you leave the southwest, and several "
      "days on this route have no useful supermarket at all. Buy for at least five days.</p>")),

   stop(5, "08:00", "Reykjanes tip &mdash; Gunnuhver and Brimketill", ("added", "added"),
     "<p>Boiling mud at <b>Gunnuhver</b>, and <b>Brimketill</b>, a lava rock pool the Atlantic breaks "
     "straight into. The <b>Bridge Between Continents</b> is two minutes and mildly silly, but it is "
     "the literal version of what &THORN;ingvellir shows you properly tomorrow.</p>"
     "<p>Wind is at its most exposed here and the Brimketill platform sits right above the surf.</p>",
     None,
     [("Gunnuhver", mapq("Gunnuhver", "Reykjanes"), True),
      ("Brimketill", mapq("Brimketill", "Grindavik"), False),
      ("safetravel.is", "https://safetravel.is/", False)],
     None,
     ("The volcano question, answered honestly",
      "<p>No eruption is under way. The Sundhn&uacute;kur sequence that began in December 2023 has "
      "slowed &mdash; the ninth eruption ran <b>16 July &ndash; 5 August 2025</b>. But <b>uplift "
      "continues at Svartsengi and the magma volume is the highest since the sequence started</b>, so "
      "another eruption or dike intrusion is possible.</p>"
      "<p>Grind&aacute;v&iacute;k and the Blue Lagoon are open; the town has crevasses, so stay on "
      "paths. <b>Treat this whole peninsula as a bonus, never a dependency</b> &mdash; check "
      "safetravel.is the morning of, and if it is shut, drive straight to Selfoss and lose nothing "
      "that matters.</p>")),

   stop(3, "09:30", "&THORN;ingvellir &mdash; walk down into the rift", ("unmissable", "the point"),
     "<p>Almannagj&aacute; is the eastern edge of the North American plate, and the path runs along "
     "the bottom of it. The valley floor between here and the Eurasian wall has dropped as the two "
     "pulled apart.</p>"
     "<p>At the foot of it sits the <b>Al&thorn;ingi site, founded 930 AD</b> &mdash; the oldest "
     "surviving parliament in the world, held annually in a crack between two continents. That "
     "combination does not exist anywhere else, and it is why this is the first real stop.</p>",
     [("Plate drift", "~2 cm/yr"), ("Parking", "P1&ndash;P5, paid"), ("Walk", "~2 km, easy")],
     [("&THORN;ingvellir", mapq("Thingvellir National Park"), True),
      ("Official park site", "https://www.thingvellir.is/en/", False)],
     ("Roca de la Ley, Parque Nacional de Þingvellir, Suðurland, Islandia, 2014-08-16, DD 022.JPG", "The path down through the Almannagj&aacute; rift, &THORN;ingvellir")),

   stop(4, "11:00 (optional)", "Silfra &mdash; snorkel the plate boundary", ("optional", "book ahead"),
     "<p>Glacial meltwater filtered through lava for decades, at 2&nbsp;&deg;C, with visibility over "
     "100&nbsp;m. You drift between the two plates in a dry suit.</p>"
     "<p><b>The limits are strict and the medical form disqualifies people outright</b> &mdash; see "
     "the van section above and check it against everyone before paying.</p>",
     [("Min age", "12"), ("Height", "150&ndash;200 cm"), ("Weight", "45&ndash;120 kg"), ("Water", "2 &deg;C")],
     [("Requirements &amp; medical form", "https://www.dive.is/faq", True)]),

   stop(3, "13:30", "Geysir, Gullfoss and Keri&eth;", None,
     "<p><b>Strokkur</b> goes every 5&ndash;10 minutes; Geysir itself is dormant, which surprises "
     "people who came for it by name. <b>Gullfoss</b> drops in two tiers into a canyon &mdash; the "
     "upper and lower viewpoints are genuinely different photographs, so do both.</p>"
     "<p><b>Keri&eth;</b> is a small red crater lake, a small fee, and ten minutes. Worth it on the "
     "way to Laugarvatn.</p>",
     [("Strokkur", "every 5&ndash;10 min"), ("Gullfoss", "two tiers"), ("Keri&eth;", "~10 min")],
     [("Geysir", mapq("Geysir", "Haukadalur"), True),
      ("Gullfoss", mapq("Gullfoss"), False), ("Keri&eth;", mapq("Kerid crater", "Selfoss"), False)],
     ("Strokkur geyser eruption, close-up view.jpg", "Strokkur erupting, Haukadalur")),

   stop(1, "18:00", "Laugarvatn &mdash; and the pool habit starts here", None,
     "<p>Lakeside campsite with <b>Fontana</b> geothermal baths on the shore. This is where the trip "
     "establishes its rhythm: <b>the pool is the shower</b>.</p>"
     "<p>Every Icelandic town has a heated outdoor pool with hot pots, open late, at roughly a tenth "
     "of the price of the tourist lagoons. In a van that solves washing, warming up and the evening "
     "in one stop. Shower naked and thoroughly before entering &mdash; it is enforced and it is not "
     "a suggestion.</p>",
     [("Night", "1&ndash;2"), ("Altitude", "sea level"), ("Fontana", "on site")],
     [("Laugarvatn campsite", mapq("Laugarvatn"), True)],
     ("Aerial panorama of Laugarvatn (crop2).jpg", "Laugarvatn, Golden Circle")),
  ], "Thingvellir National Park", 8)

D3 = day("d3", "Mon&ndash;Tue", "6&ndash;7", "The south coast, and the one that is dangerous",
  "Laugarvatn &rarr; Seljalandsfoss &rarr; Sk&oacute;gafoss &rarr; Reynisfjara &rarr; V&iacute;k &rarr; Skaftafell",
  [("Driving", "~290 km"), ("Nights", "V&iacute;k, Skaftafell"), ("Longest walk", "Svartifoss"), ("Hazard", "wind &amp; surf")],
  [
   stop(3, "09:00", "Seljalandsfoss &mdash; and the one beside it nobody finds", None,
     "<p>You walk behind Seljalandsfoss. <b>You will get soaked</b> &mdash; this needs waterproof "
     "trousers and a proper shell, not a jacket, and the path is slick.</p>"
     "<p>Then walk <b>500 m north along the same path to Glj&uacute;frab&uacute;i</b>, which is "
     "hidden inside a cleft in the cliff. You wade a shallow stream into a chamber with the fall "
     "coming down through a hole in the roof. Most visitors never see it because it is invisible "
     "from the car park.</p>",
     [("Behind the fall", "yes, get wet"), ("Glj&uacute;frab&uacute;i", "500 m north"), ("Parking", "paid")],
     [("Seljalandsfoss", mapq("Seljalandsfoss"), True),
      ("Glj&uacute;frab&uacute;i", mapq("Gljufrabui"), False)],
     ("Gljúfrabúi, July 2019.jpg", "Glj&uacute;frab&uacute;i inside its cleft")),

   stop(3, "11:00", "Sk&oacute;gafoss and Kvernufoss", None,
     "<p>Sk&oacute;gafoss is 60 m and thunderous, with stairs up the side to a top-down view and the "
     "start of the Fimmv&ouml;r&eth;uh&aacute;ls trail. It is also crowded by mid-morning.</p>"
     "<p><b>Kvernufoss is the fix.</b> Behind the Sk&oacute;gar museum, twenty minutes on foot, "
     "another waterfall you can walk behind &mdash; and usually almost empty.</p>",
     [("Sk&oacute;gafoss", "60 m"), ("Stairs", "~370 steps"), ("Kvernufoss", "~20 min walk")],
     [("Sk&oacute;gafoss", mapq("Skogafoss"), True), ("Kvernufoss", mapq("Kvernufoss", "Skogar"), False)],
     ("Skógafoss July 2014.JPG", "Sk&oacute;gafoss")),

   stop(4, "13:00 (optional)", "S&oacute;lheimaj&ouml;kull glacier walk", ("optional", "book ahead"),
     "<p>A glacier tongue you can walk onto with crampons and a guide, twenty minutes off Route 1. "
     "<b>Never walk onto a glacier unguided</b> &mdash; the crevasses are covered and the terminus "
     "is unstable.</p>"
     "<p>Book <b>either</b> this <b>or</b> Fallj&ouml;kull at Skaftafell tomorrow. Doing both is "
     "repetition at US$105 a head.</p>",
     [("Easy, 3 h", "age 8+, ~US$105"), ("Advanced, 5 h", "age 12+, ~US$162"), ("On ice", "90 min / 3 h")],
     [("S&oacute;lheimaj&ouml;kull", mapq("Solheimajokull"), True),
      ("Tours and ages", "https://adventures.is/iceland/day-tours/glacier-tours/", False)],
     ("Sólheimajökull glacier 19.jpg", "S&oacute;lheimaj&ouml;kull glacier tongue")),

   stop(5, "15:30", "Dyrh&oacute;laey and Reynisfjara", ("unmissable", "care needed"),
     "<p><b>Dyrh&oacute;laey</b> is a sea arch you can drive up to; the cliffs will be empty because "
     "the puffins left in mid-August.</p>"
     "<p><b>Reynisfjara is the one stop on this trip where the rule matters more than the "
     "photograph.</b> Sneaker waves run far higher up the beach than the previous ten suggest, and "
     "people have died here. A landslide and severe erosion in <b>February 2026</b> narrowed the "
     "shoreline and largely destroyed one viewing platform, so access is now managed by safety "
     "zone.</p>",
     [("Reynisdrangar", "sea stacks"), ("Cave", "shut on red light"), ("Rule", "stay high, watch the sea")],
     [("Reynisfjara", mapq("Reynisfjara Beach", "Vik"), True),
      ("SafeTravel alerts", "https://safetravel.is/", False)],
     ("Reynisfjara and Reynisdrangar, Iceland.jpg", "Reynisfjara and the Reynisdrangar stacks"),
     ("The specific rules, as of now",
      "<p>Since <b>August 2025 it is prohibited to enter H&aacute;lsanefshellir cave whenever the red "
      "warning light is flashing.</b> Depending on surf, tide and wind, other areas near the basalt "
      "columns can be restricted or closed outright.</p>"
      "<p>Practical version: stay on the dry sand well above the highest wet line, keep the sea in "
      "front of you at all times, and do not walk out onto the black sand to take a picture facing "
      "inland. That is the posture people are in when they get taken.</p>"),
     "Check the wind forecast for V&iacute;k on vedur.is before you commit to this stop. In a "
     "strong onshore southerly, look from Dyrh&oacute;laey instead and skip the beach."),

   stop(2, "18:00", "V&iacute;k &mdash; night 3", None,
     "<p>Big campsite, and <b>Kr&oacute;nan is across the road</b>, which makes this the best "
     "restock point between Selfoss and H&ouml;fn. The black church on the hill above town is the "
     "photograph everyone takes of V&iacute;k itself.</p>",
     [("Night", "3"), ("Supermarket", "across the road"), ("Pool", "in town")],
     [("V&iacute;k campsite", mapq("Vik i Myrdal"), True)],
     ("Víkurkirkja in Iceland.jpg", "V&iacute;kurkirkja above V&iacute;k")),

   stop(3, "Day 7 &middot; 09:00", "Fja&eth;r&aacute;rglj&uacute;fur and the Laki lava", None,
     "<p><b>Fja&eth;r&aacute;rglj&uacute;fur</b> is a 100 m serpentine canyon lined with moss, with a "
     "rim path along the top. No entrance fee; <b>lower car park 1,000 ISK, upper car park free</b>.</p>"
     "<p>Then Route 1 crosses <b>Eldhraun</b> &mdash; the moss-covered lava from the 1783 Laki "
     "eruption, which killed roughly a fifth of Iceland&rsquo;s population and cooled European "
     "harvests badly enough to show up in French bread prices. <b>Do not walk on the moss</b>; it "
     "takes decades to regrow.</p>",
     [("Canyon", "~100 m deep"), ("Parking", "1,000 ISK lower / free upper"), ("Entry", "free")],
     [("Fja&eth;r&aacute;rglj&uacute;fur", mapq("Fjadrargljufur"), True),
      ("Closure status &mdash; ust.is", "https://ust.is/", False)],
     ("Fjaðrárgljúfur 01.jpg", "Fja&eth;r&aacute;rglj&uacute;fur canyon")),

   stop(3, "13:00", "Svartifoss &mdash; the biggest walk of the trip", None,
     "<p>Basalt columns fan out behind the fall like organ pipes; the same geometry inspired the "
     "ceiling of Hallgr&iacute;mskirkja, which you see on the last day.</p>"
     "<p>Sources disagree on the route, so take the range: <b>5.4 km return with ~120 m of gain</b> "
     "on the direct path, or <b>7.1 km with 310 m</b> for the full Sj&oacute;narn&iacute;pa circuit "
     "with the glacier viewpoint. Decide at the visitor centre based on the weather.</p>",
     [("Direct", "5.4 km / ~120 m"), ("Full circuit", "7.1 km / 310 m"), ("Time", "2&ndash;3 h"), ("Start", "Skaftafellsstofa")],
     [("Skaftafell", mapq("Skaftafell Visitor Centre"), True),
      ("Vatnaj&ouml;kull NP &mdash; official", "https://www.vatnajokulsthjodgardur.is/en/areas/skaftafell/svartifoss-sjonarnipa-s6", False),
      ("AllTrails", "https://www.alltrails.com/trail/iceland/eastern/svartifoss-and-manusafoss", False)],
     ("Svartifoss July 2014.JPG", "Svartifoss and its basalt columns")),

   stop(2, "18:00", "Skaftafell campsite &mdash; night 4", None,
     "<p>Inside Vatnaj&ouml;kull National Park, <b>at the trailhead</b> &mdash; which is as close to "
     "the usual van advantage as Iceland&rsquo;s campsite rule allows you to get. Fallj&ouml;kull "
     "glacier tours leave from the Tr&ouml;ll base here: groups of ten, minimum age 12.</p>",
     [("Night", "4"), ("Glacier tours", "from site"), ("Group cap", "10")],
     [("Skaftafell campsite", mapq("Skaftafell campsite"), True),
      ("Fallj&ouml;kull tours", "https://falljokullglacier.com/", False)],
     ("Svínafellsjökull (26915561094).jpg",
      "Sv&iacute;nafellsj&ouml;kull glacier from Route 1")),
  ], "Vik i Myrdal", 8)

D5 = day("d5", "Wed", "8", "The glacier lagoons",
  "Skaftafell &rarr; Fjalls&aacute;rl&oacute;n &rarr; J&ouml;kuls&aacute;rl&oacute;n &rarr; Stokksnes &rarr; H&ouml;fn",
  [("Driving", "~130 km"), ("Night", "H&ouml;fn"), ("Pace", "the easiest day"), ("True dark", "2.9 h")],
  [
   stop(2, "09:00", "Fjalls&aacute;rl&oacute;n first &mdash; deliberately", ("added", "added"),
     "<p>Six kilometres before the famous one, and almost nobody stops. Smaller lagoon, glacier wall "
     "much closer, and you will often have it to yourself.</p>"
     "<p><b>Order matters here.</b> Going to Fjalls&aacute;rl&oacute;n after "
     "J&ouml;kuls&aacute;rl&oacute;n makes it feel like a lesser version. Going before makes "
     "J&ouml;kuls&aacute;rl&oacute;n feel enormous.</p>",
     [("Detour", "~6 km"), ("Crowds", "few"), ("Zodiac", "seasonal")],
     [("Fjalls&aacute;rl&oacute;n", mapq("Fjallsarlon"), True)],
     ("Fjallsarlon - Iceberg Lagoon.jpg", "Fjalls&aacute;rl&oacute;n glacier lagoon")),

   stop(4, "10:30", "J&ouml;kuls&aacute;rl&oacute;n", ("unmissable", "the big one"),
     "<p>Icebergs calve off Brei&eth;amerkurj&ouml;kull and drift across a lagoon that did not exist "
     "a century ago &mdash; it is meltwater, and it is still growing. The channel out to the sea runs "
     "under the road bridge; watch a berg go through it.</p>"
     "<p>Amphibious and Zodiac boat trips run in September. Weather-dependent, so <b>book same-day "
     "if the morning looks settled</b> rather than committing in advance.</p>",
     [("Depth", "&gt;240 m"), ("Boats", "same-day if calm"), ("Seals", "common")],
     [("J&ouml;kuls&aacute;rl&oacute;n", mapq("Jokulsarlon Glacier Lagoon"), True)],
     ("Icebergs in the Jökulsárlón Glacier Lagoon, Iceland.jpg", "Icebergs on J&ouml;kuls&aacute;rl&oacute;n")),

   stop(5, "12:30", "Diamond Beach &mdash; manage the expectation", None,
     "<p>Icebergs washed back ashore onto black sand, across the road from the lagoon. It is the "
     "picture everyone has seen.</p>"
     "<p><b>It is also entirely dependent on what happened to wash up that morning.</b> Some days it "
     "is covered in car-sized blocks lit like glass; other days it is bare sand. If it is bare, it is "
     "bare &mdash; do not spend an hour waiting for ice to arrive. The surf here is the same Atlantic "
     "that makes Reynisfjara dangerous.</p>",
     [("Ice", "luck, not season"), ("Best light", "low sun"), ("Surf", "treat as Reynisfjara")],
     [("Diamond Beach", mapq("Diamond Beach", "Jokulsarlon"), True)],
     ("Glacier in Diamond Beach (Jökulsárlón) Iceland.jpg", "Ice on the black sand at Diamond Beach")),

   stop(3, "15:00", "Stokksnes and Vestrahorn", ("added", "added"),
     "<p>A 454 m black gabbro massif rising straight off a black dune beach, with a tidal lagoon in "
     "front of it that mirrors the peaks when the wind drops. It is the best mountain photograph in "
     "Iceland and it is a ten-minute detour off Route 1.</p>"
     "<p>Private land &mdash; there is a gate fee, paid at the Viking Caf&eacute;. Flat walking on "
     "sand and boardwalk, no climb.</p>",
     [("Vestrahorn", "454 m"), ("Access", "private, gate fee"), ("Walking", "flat sand")],
     [("Stokksnes", mapq("Stokksnes", "Hofn"), True)],
     ("Klifatindur Vestrahorn Island Böhringer.jpg", "Vestrahorn from Stokksnes")),

   stop(1, "18:00", "H&ouml;fn &mdash; night 5", None,
     "<p>Harbour town under the ice cap, and the langoustine capital of Iceland &mdash; this is the "
     "one night worth eating out rather than cooking in the van. Pool in town for the shower.</p>",
     [("Night", "5"), ("Eat", "langoustine"), ("Pool", "yes")],
     [("H&ouml;fn", mapq("Hofn", "Hornafjordur"), True)],
     ("2400 Menschen leben in Höfn. 16.jpg", "H&ouml;fn harbour under the ice cap")),
  ], "Jokulsarlon Glacier Lagoon", 8)

D6 = day("d6", "Thu&ndash;Fri", "9&ndash;10", "The East Fjords, and north across the high desert",
  "H&ouml;fn &rarr; Dj&uacute;pivogur &rarr; Sey&eth;isfj&ouml;r&eth;ur &rarr; Dettifoss &rarr; M&yacute;vatn",
  [("Driving", "~530 km over two days"), ("Nights", "Sey&eth;isfj&ouml;r&eth;ur, M&yacute;vatn"),
   ("Longest legs", "270 km, then 260"), ("First aurora night", "10 Sep")],
  [
   stop(2, "Day 9 &middot; 09:00", "The fjord road &mdash; do not sprint it", ("added", "added"),
     "<p>Most itineraries treat the east as the boring bit between the glaciers and M&yacute;vatn and "
     "drive Route 1 inland. <b>Take the coast instead.</b> Hairpin after hairpin around each fjord, "
     "fishing villages of forty people, and almost no traffic.</p>"
     "<p>The direct inland run H&ouml;fn&rarr;Egilssta&eth;ir is 187 km in 2 h 46 m. The fjord route "
     "is around 400 km and 5&ndash;6 hours with stops. <b>The extra three hours is the point of the "
     "day</b>, not a cost.</p>",
     [("Direct", "187 km / 2 h 46 m"), ("Via fjords", "~400 km / 5&ndash;6 h"), ("Traffic", "almost none")],
     [("Dj&uacute;pivogur", mapq("Djupivogur"), True),
      ("St&ouml;&eth;varfj&ouml;r&eth;ur", mapq("Stodvarfjordur"), False)],
     None,
     ("Three stops worth making",
      "<p><b>Dj&uacute;pivogur</b> &mdash; a Citta Slow town with the Eggin &iacute; Gle&eth;ivik "
      "sculpture, 34 oversized stone eggs, one per local bird species.</p>"
      "<p><b>F&aacute;skr&uacute;&eth;sfj&ouml;r&eth;ur</b> &mdash; a French fishing station; the "
      "street signs are still in French.</p>"
      "<p><b>St&ouml;&eth;varfj&ouml;r&eth;ur</b> &mdash; Petra&rsquo;s stone collection, a lifetime "
      "of rocks gathered by one woman and left in her garden. Genuinely strange and worth the stop.</p>")),

   stop(2, "16:00", "Over the pass to Sey&eth;isfj&ouml;r&eth;ur &mdash; night 6", None,
     "<p>From Egilssta&eth;ir, Route 93 climbs over a 620 m pass and drops in switchbacks to a fjord "
     "town with a rainbow-painted street leading to a blue wooden church. It is the prettiest small "
     "town in Iceland and the ferry from Denmark still docks here.</p>",
     [("Night", "6"), ("Pass", "Route 93, ~620 m"), ("Fallback", "Egilssta&eth;ir")],
     [("Sey&eth;isfj&ouml;r&eth;ur", mapq("Seydisfjordur"), True),
      ("Road status &mdash; road.is", "https://www.road.is/", False)],
     ("Seyðisfjörður church 1.jpg", "The blue church at the top of the rainbow street"),
     None,
     "<b>Decision rule:</b> the Route 93 pass is exposed and closes in bad weather. If the forecast "
     "is wild, stop at Egilssta&eth;ir instead and drive over first thing on Day 10 &mdash; you lose "
     "an evening, not the town."),

   stop(2, "Day 10 &middot; 09:00", "M&ouml;&eth;rudals&ouml;r&aelig;fi &mdash; the emptiest road", None,
     "<p>Route 1 climbs onto a high interior desert of black gravel and almost nothing else. This is "
     "the closest the trip gets to the highlands, and it is the one stretch where the fuel gauge "
     "matters. <b>Fill up in Egilssta&eth;ir.</b></p>",
     [("Terrain", "high gravel desert"), ("Services", "almost none"), ("Rule", "fill up first")],
     [("M&ouml;&eth;rudalur", mapq("Modrudalur"), True)]),

   stop(3, "12:00", "Dettifoss &mdash; take the west road", ("unmissable", "the loudest"),
     "<p>The most powerful waterfall in Europe by volume &mdash; roughly 193 m wide and 44 m high, "
     "carrying grey glacial meltwater off Vatnaj&ouml;kull. You feel it through the ground before "
     "you see it.</p>"
     "<p><b>The road choice matters in a camper.</b> Route <b>862 on the west bank is paved</b> and "
     "is the one to take. Route <b>864 on the east bank is gravel</b> &mdash; legal in a 2WD but "
     "rough, slow, and the kind of surface that generates windscreen and underbody claims. The west "
     "side also has the better viewing platforms.</p>",
     [("Width", "~193 m"), ("Drop", "~44 m"), ("Take", "Rd 862, paved"), ("Avoid", "Rd 864, gravel")],
     [("Dettifoss west side", mapq("Dettifoss west", "Route 862"), True),
      ("Road status", "https://www.road.is/", False)],
     ("Dettifoss Waterfall, Iceland, 20240716 1514 1598.jpg", "Dettifoss")),

   stop(3, "15:00", "&Aacute;sbyrgi", ("added", "added"),
     "<p>A horseshoe canyon 3.5 km long with 100 m walls and a wooded floor. Geologically it was cut "
     "by catastrophic glacial floods; Norse myth says it is a hoofprint left by Sleipnir, "
     "Odin&rsquo;s eight-legged horse. Short flat walks from the car park.</p>",
     [("Length", "~3.5 km"), ("Walls", "~100 m"), ("Walking", "flat, easy")],
     [("&Aacute;sbyrgi", mapq("Asbyrgi"), True)],
     ("Asbyrgi-Eyjan-June2022.jpg", "The Eyjan rock island inside &Aacute;sbyrgi")),

   stop(6, "22:11", "M&yacute;vatn &mdash; night 7, and the first night it is actually dark", None,
     "<p><b>Astronomical darkness at M&yacute;vatn on 10 September runs 22:11&ndash;23:30</b> "
     "&mdash; 1 h 19 m. It is the first genuinely dark night of the trip, and there is no town light "
     "for tens of kilometres.</p>"
     "<p>Set an alarm. Check <b>vedur.is</b>&rsquo;s aurora page before bed: it maps cloud cover "
     "against activity, which is the combination that decides it. Clear sky beats high activity "
     "every time.</p>",
     [("Dark from", "22:11"), ("Duration", "1 h 19 m"), ("Sites", "Vogar or Hl&iacute;&eth;")],
     [("M&yacute;vatn", mapq("Reykjahlid", "Myvatn"), True),
      ("Aurora forecast &mdash; vedur.is", "https://en.vedur.is/weather/forecasts/aurora/", False)],
     ("039 Northern lights over Mývatn (Iceland) Photo by Giles Laurent.jpg", "Aurora over M&yacute;vatn")),
  ], "Seydisfjordur", 7)

D8 = day("d8", "Sat&ndash;Sun", "11&ndash;12", "M&yacute;vatn, whales, and the northern capital",
  "M&yacute;vatn loop &rarr; H&uacute;sav&iacute;k &rarr; Go&eth;afoss &rarr; Akureyri",
  [("Driving", "~240 km over two days"), ("Nights", "M&yacute;vatn, Akureyri"),
   ("Day 11", "~60 km &mdash; rest day"), ("True dark", "3.0 h on 12 Sep")],
  [
   stop(3, "Day 11 &middot; 09:00", "Hverir &mdash; the one that smells", ("unmissable", "unlike anywhere"),
     "<p>A geothermal field at the foot of N&aacute;mafj&ouml;ll: ochre and grey mud pots boiling at "
     "the surface, steam vents roaring out of the ground under pressure, and no vegetation at all "
     "because the soil is too acidic to support any.</p>"
     "<p>It smells strongly of hydrogen sulphide and that is the honest experience of it. <b>Stay on "
     "the marked paths</b> &mdash; the crust between the pots is thin and the mud underneath is at "
     "boiling point. Day 11 is deliberately a ~60 km rest day after two 260 km-plus ones.</p>",
     [("Walking", "flat, marked"), ("Ground", "boiling &mdash; stay on path"), ("Day total", "~60 km")],
     [("Hverir", mapq("Hverir", "Namafjall"), True)],
     ("Hverir Geothermal Area 2.jpg", "Mud pots and steam vents at Hverir")),

   stop(3, "11:00", "Dimmuborgir, Hverfjall and Grj&oacute;tagj&aacute;", None,
     "<p><b>Dimmuborgir</b> is a labyrinth of lava pillars formed when a lava lake drained away and "
     "left the hollow columns standing. Marked loops from 10 minutes to an hour.</p>"
     "<p><b>Hverfjall</b> is a 2,500-year-old tephra crater you can walk the rim of &mdash; the rim "
     "is about <b>3 km around</b>, 30&ndash;45 minutes up from the car park, roughly an hour to "
     "circle, <b>1.5&ndash;2 hours total</b>. It is exposed; skip it in strong wind.</p>"
     "<p><b>Grj&oacute;tagj&aacute;</b> is a hot spring in a lava cave. <b>Look, do not swim</b> "
     "&mdash; it has run too hot since the Kr&ouml;flu fires and it is private land.</p>",
     [("Hverfjall rim", "~3 km around"), ("Up", "30&ndash;45 min"), ("Total", "1.5&ndash;2 h"), ("Grj&oacute;tagj&aacute;", "no swimming")],
     [("Dimmuborgir", mapq("Dimmuborgir"), True), ("Hverfjall", mapq("Hverfjall"), False),
      ("Grj&oacute;tagj&aacute;", mapq("Grjotagja"), False)],
     ("Dimmuborgir lava field, Iceland, 20240716 1314 1462.jpg", "Lava pillars at Dimmuborgir")),

   stop(1, "17:00", "M&yacute;vatn Nature Baths", ("added", "added"),
     "<p>The northern answer to the Blue Lagoon: same milky alkaline water, a fraction of the price, "
     "a fraction of the queue, and a view over the lake and the lava field instead of a car park.</p>"
     "<p>Go at dusk. You are in warm water when the sky goes dark, which sets you up for the second "
     "aurora night without having to get cold first.</p>",
     [("Night", "8"), ("vs Blue Lagoon", "cheaper, emptier"), ("Best", "at dusk")],
     [("M&yacute;vatn Nature Baths", mapq("Myvatn Nature Baths"), True)],
     ("Myvatn Nature Baths by Bruce McAdam.jpg", "M&yacute;vatn Nature Baths")),

   stop(4, "Day 12 &middot; 08:30", "H&uacute;sav&iacute;k &mdash; whales", ("optional", "book ahead"),
     "<p>Sk&aacute;lfandi bay is the most reliable whale water in Iceland. <b>September species are "
     "humpback and minke</b>; blue whales are early-season only, and <b>the puffins have gone</b> "
     "&mdash; operators stop selling combined whale-and-puffin trips from 15 August.</p>"
     "<p>Take the morning sailing: the bay is calmest early, and it leaves the afternoon for "
     "Go&eth;afoss and Akureyri.</p>"
     "<p><b>GeoSea</b> afterwards &mdash; clifftop geothermal seawater baths looking out over the "
     "same bay you have just been on.</p>",
     [("Species", "humpback, minke"), ("Puffins", "gone by Sep"), ("Sailing", "morning")],
     [("H&uacute;sav&iacute;k harbour", mapq("Husavik harbour"), True),
      ("North Sailing", "https://www.northsailing.is/", False),
      ("GeoSea", mapq("GeoSea", "Husavik"), False)],
     ("Húsavík - Anlegestelle für Whale watching Boote.jpg", "Whale-watching boats at H&uacute;sav&iacute;k")),

   stop(3, "14:00", "Go&eth;afoss", None,
     "<p>Right on Route 1, thirty seconds from the car park, and still one of the best waterfalls on "
     "the island &mdash; a 12 m horseshoe in the Skj&aacute;lfandaflj&oacute;t.</p>"
     "<p>The name means &ldquo;waterfall of the gods&rdquo;: when Iceland converted to Christianity "
     "around the year 1000, the lawspeaker &THORN;orgeir is said to have thrown his pagan idols in.</p>",
     [("Drop", "~12 m"), ("Walk", "minutes"), ("Both banks", "worth it")],
     [("Go&eth;afoss", mapq("Godafoss"), True)],
     ("Goðafoss July 2014.JPG", "Go&eth;afoss")),

   stop(1, "16:00", "Akureyri &mdash; night 9, and laundry", None,
     "<p>The north&rsquo;s real town: proper restaurants, a botanical garden that grows things it "
     "should not at this latitude, and the traffic lights with red hearts instead of circles.</p>"
     "<p><b>Hamrar campsite is the best facilities on the route</b> &mdash; forested, hot showers, "
     "clean toilets, laundry, wi-fi, cooking shelter, around US$18 an adult. <b>Do the laundry "
     "here.</b> It is day 9 and there is not a better chance before the flight home.</p>",
     [("Night", "9"), ("Campsite", "Hamrar"), ("~US$18", "per adult"), ("Laundry", "yes &mdash; use it")],
     [("Hamrar campsite", mapq("Hamrar campsite", "Akureyri"), True),
      ("Akureyri pool", mapq("Sundlaug Akureyrar"), False)],
     ("Akureyri-08-Panorama-2018-gje.jpg", "Akureyri on Eyjafj&ouml;r&eth;ur")),
  ], "Myvatn", 8)

D10 = day("d10", "Mon&ndash;Wed", "13&ndash;15", "The long run west, Sn&aelig;fellsnes, and home",
  "Akureyri &rarr; Hv&iacute;tserkur &rarr; Grundarfj&ouml;r&eth;ur &rarr; Sn&aelig;fellsnes &rarr; Reykjav&iacute;k &rarr; KEF",
  [("Driving", "~710 km over three days"), ("Nights", "Grundarfj&ouml;r&eth;ur, Reykjav&iacute;k"),
   ("Day 13", "~390 km &mdash; the longest"), ("True dark", "4.5 h by 15 Sep")],
  [
   stop(2, "Day 13 &middot; 08:00", "The longest drive of the trip &mdash; break it on purpose", None,
     "<p><b>~390 km, about five hours of driving.</b> This is the day the trip could go wrong: it is "
     "long, it is mostly transit, and it comes after eight days of early starts.</p>"
     "<p>Leave early, and stop three times whether or not you feel like it. <b>Hv&iacute;tserkur</b>, "
     "a 15 m basalt sea stack that looks like an animal drinking; the <b>Hvammstangi</b> seal colony "
     "on the way past; then <b>Hraunfossar</b>, where a waterfall seeps out of the face of a lava "
     "field along nearly a kilometre of cliff, with <b>Deildartunguhver</b> &mdash; Europe&rsquo;s "
     "highest-flow hot spring &mdash; a few minutes further on.</p>",
     [("Distance", "~390 km"), ("Driving", "~5 h"), ("Stops", "3, non-negotiable")],
     [("Hv&iacute;tserkur", mapq("Hvitserkur"), True), ("Hraunfossar", mapq("Hraunfossar"), False),
      ("Deildartunguhver", mapq("Deildartunguhver"), False)],
     ("Hraunfossar, Iceland, 20240715 0846 0765.jpg", "Hraunfossar seeping from the lava field"),
     ("If the day is too much",
      "<p>Split it. Stop at <b>Borgarnes</b> instead of pushing to Grundarfj&ouml;r&eth;ur, then do "
      "Sn&aelig;fellsnes as a loop out and back on Day 14 and drive to Reykjav&iacute;k that evening. "
      "It costs you the Kirkjufell sunrise and nothing else. Borgarnes campsite is also one of the "
      "year-round sites, so it is the safest fallback on the whole route.</p>")),

   stop(3, "Day 14 &middot; 08:00", "Kirkjufell, and Sn&aelig;fellsnes properly", ("unmissable", "best value"),
     "<p>Sn&aelig;fellsnes is called &ldquo;Iceland in miniature&rdquo; and it earns it &mdash; "
     "glacier, volcano, lava field, black beach, bird cliffs and fishing villages inside 90 km.</p>"
     "<p><b>Kirkjufell</b> with Kirkjufellsfoss in front of it is the most photographed mountain in "
     "the country; it is a two-minute walk from a car park across the road from the campsite. Go at "
     "first light, before the Reykjav&iacute;k day-tour buses arrive around 11:00.</p>",
     [("Kirkjufell", "463 m"), ("Walk", "2 min from the car park"), ("Buses arrive", "~11:00")],
     [("Kirkjufell", mapq("Kirkjufell", "Grundarfjordur"), True)],
     ("Kirkjufell, Iceland, 20240714 1631 0713.jpg", "Kirkjufell above Grundarfj&ouml;r&eth;ur")),

   stop(3, "10:30", "Dj&uacute;pal&oacute;nssandur and Sn&aelig;fellsj&ouml;kull", None,
     "<p>A black pebble beach with the rusted remains of the trawler <b>Epine GY7</b>, wrecked in "
     "1948, still lying scattered across it &mdash; left deliberately as a memorial, so do not move "
     "anything. Four <b>lifting stones</b> sit at the top of the path; fishermen were graded by which "
     "one they could get onto a ledge, and the lightest is 23 kg.</p>"
     "<p>Above it, <b>Sn&aelig;fellsj&ouml;kull</b> &mdash; the glacier-capped volcano Jules Verne "
     "used as the way in to the centre of the earth.</p>",
     [("Wreck", "Epine GY7, 1948"), ("Stones", "23 &ndash; 154 kg"), ("Path", "steep, loose")],
     [("Dj&uacute;pal&oacute;nssandur", mapq("Djupalonssandur"), True)],
     ("Djupalonssandur Beach Iceland Travel Photography (212306465).jpeg", "Dj&uacute;pal&oacute;nssandur black pebble beach"),
     None,
     "Same Atlantic, same rule as Reynisfjara. The waves come a long way up this beach and there is "
     "no lifeguard on the peninsula."),

   stop(3, "13:00", "Arnarstapi to Hellnar, and the black church", None,
     "<p>A <b>2.5 km coastal path</b> between two villages along columnar basalt cliffs, sea arches "
     "and a fulmar colony &mdash; flat, easy, and the best short walk on the trip. Walk it one way "
     "and back, or leave the van at one end.</p>"
     "<p>Then <b>B&uacute;&eth;akirkja</b>, a small black timber church standing alone on a lava "
     "field, which is the other photograph everyone takes on this peninsula.</p>",
     [("Path", "~2.5 km each way"), ("Terrain", "flat clifftop"), ("B&uacute;&eth;ir", "black church")],
     [("Arnarstapi", mapq("Arnarstapi"), True), ("B&uacute;&eth;akirkja", mapq("Budakirkja", "Budir"), False)],
     ("Arnarstapi (port).jpg", "The coast at Arnarstapi")),

   stop(6, "22:00", "Reykjav&iacute;k, Laugardalur &mdash; night 11", None,
     "<p>Year-round campsite next to the city&rsquo;s biggest pool, a short hop from the van depot in "
     "the morning. <b>Sleeping here rather than out on the peninsula is deliberate</b> &mdash; it "
     "removes a two-and-a-half-hour drive from the departure day.</p>"
     "<p>By 15 September Reykjav&iacute;k has <b>4.5 hours of astronomical dark</b>. City light "
     "spoils it, but if the vedur.is map is green, drive fifteen minutes out to Grótta on the "
     "Seltjarnarnes point.</p>",
     [("Night", "11"), ("Dark", "4.5 h by 15 Sep"), ("Depot", "short hop")],
     [("Laugardalur campsite", mapq("Reykjavik Campsite", "Laugardalur"), True),
      ("Gr&oacute;tta", mapq("Grotta lighthouse", "Seltjarnarnes"), False)],
     ("Hallgrímskirkja, Reykjavík, Iceland, 20230506 1701 5380.jpg", "Hallgr&iacute;mskirkja, Reykjav&iacute;k")),

   stop(1, "Day 15 &middot; 09:00", "Reykjav&iacute;k, Sky Lagoon, and the drive to KEF", None,
     "<p><b>Hallgr&iacute;mskirkja</b>&rsquo;s tower for the coloured-roof view &mdash; and note the "
     "facade, which is basalt columns, the same geometry you walked up to at Svartifoss on day 7. "
     "Then Harpa and the old harbour.</p>"
     "<p><b>Sky Lagoon</b> if the flight is late enough: better designed than the Blue Lagoon, an "
     "infinity edge onto the Atlantic, and it is on the road to Keflav&iacute;k rather than a "
     "detour.</p>"
     "<p><b>Refuel before the depot, not at it.</b> Rental fuel charges are punitive, and the station "
     "at the airport knows exactly who its customers are.</p>",
     [("Tower", "coloured roofs"), ("Sky Lagoon", "on the way to KEF"), ("Van", "return full")],
     [("Hallgr&iacute;mskirkja", mapq("Hallgrimskirkja", "Reykjavik"), True),
      ("Sky Lagoon", mapq("Sky Lagoon", "Kopavogur"), False)],
     ("Sky Lagoon Cold Plunge.jpg", "Sky Lagoon, Reykjav&iacute;k")),
  ], "Snaefellsnes", 8)

# ---------- day-of links --------------------------------------------------------------
QUICK = """
<section class="quick" id="quick">
  <h2>Day-of links</h2>
  <p class="qsub">The handful actually tapped from the van</p>
  <div class="qgrid">
    <div class="qcard">
      <h4><span class="dot" style="background:var(--class-5)"></span>Before you drive</h4>
      <a class="warn" href="https://www.road.is/"><b>road.is</b>Road status and closures, segment by segment</a>
      <a class="warn" href="https://safetravel.is/"><b>SafeTravel</b>Alerts, volcano status, beach warnings</a>
      <a href="https://en.vedur.is/"><b>vedur.is</b>The Met Office &mdash; wind speed is the number that matters</a>
      <a class="tel" href="tel:112"><b>112</b>Emergency &mdash; and the 112 Iceland app sends your position</a>
    </div>
    <div class="qcard">
      <h4><span class="dot" style="background:var(--class-6)"></span>Aurora</h4>
      <a href="https://en.vedur.is/weather/forecasts/aurora/"><b>vedur.is aurora</b>Activity mapped against cloud &mdash; clear sky beats high KP</a>
      <a href="https://www.timeanddate.com/astronomy/iceland/reykjavik"><b>Dark hours</b>Cross-check against the table in this plan</a>
    </div>
    <div class="qcard">
      <h4><span class="dot" style="background:var(--class-2)"></span>Campsites &amp; the van</h4>
      <a href="https://www.tjalda.is/en/"><b>tjalda.is</b>Campsite directory &mdash; and the closing dates</a>
      <a href="https://www.campingcard.is/"><b>Camping Card</b>Participating sites. Expires 15 September</a>
      <a href="https://www.n1.is/"><b>N1 stations</b>Fuel, and the dump/fill points</a>
    </div>
    <div class="qcard">
      <h4><span class="dot" style="background:var(--class-1)"></span>Pools &amp; food</h4>
      <a href="https://www.swimminginiceland.com/"><b>Swimming in Iceland</b>Every municipal pool, with hours</a>
      <a href="https://bonus.is/"><b>B&oacute;nus</b>Cheapest supermarket. Note the short opening hours</a>
      <a href="https://www.vinbudin.is/"><b>V&iacute;nb&uacute;&eth;in</b>The only place to buy alcohol. Closed Sundays</a>
    </div>
  </div>
</section>"""

CHECK_ITEMS = [
    ("flights", "Flights booked &mdash; YYZ&rarr;KEF overnight, evening of <b>3 Sep</b>"),
    ("van", "Camper booked <b>with the heater</b> &mdash; nights run 4&ndash;7&nbsp;&deg;C"),
    ("insure", "Rental insurance read: what does <b>wind damage</b> cover, and is sand/ash included?"),
    ("card", "Camping Card bought &mdash; check it against the actual sites on this route"),
    ("sites", "<b>Every campsite phoned</b> to confirm it is open to 14 September 2027"),
    ("silfra", "Silfra medical form checked against everyone &mdash; age 12+, 150&ndash;200 cm, 45&ndash;120 kg"),
    ("glacier", "<b>One</b> glacier walk booked &mdash; S&oacute;lheimaj&ouml;kull or Fallj&ouml;kull, not both"),
    ("whale", "H&uacute;sav&iacute;k whale watching, morning sailing on day 12"),
    ("offline", "Offline maps downloaded &mdash; the east fjords and M&ouml;&eth;rudals&ouml;r&aelig;fi have thin signal"),
    ("app", "112 Iceland app installed on every phone"),
    ("waterproof", "Waterproof <b>trousers</b>, not just a jacket &mdash; you walk behind two waterfalls"),
    ("layers", "Proper wind shell. Wind, not cold, is what makes Iceland unpleasant"),
    ("adapter", "Type F plug adapter and a 12V USB hub for the van"),
    ("torch", "Head torch with a <b>red</b> mode &mdash; white light kills your night vision on the aurora nights"),
    ("shop", "Plan the day-1 B&oacute;nus/Kr&oacute;nan shop for at least five days of food"),
    ("fuel", "Fuel rule agreed: never pass Egilssta&eth;ir or M&ouml;&eth;rudalur below half a tank"),
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
        <tr><td>1</td><td>Flights, YYZ&rarr;KEF</td><td>Overnight, 5 h 35 m, ~19/week between Icelandair and Air Canada</td></tr>
        <tr><td>2</td><td><b>The van, with a heater</b></td><td>Shoulder pricing US$75&ndash;125/day; the heater is +US$50&ndash;100 and worth all of it</td></tr>
        <tr><td>3</td><td>Camping Card</td><td>~26,000 ISK, 28 nights, 40+ sites &mdash; <b>expires 15 September</b></td></tr>
        <tr><td>4</td><td>Silfra <i>(if doing it)</i></td><td>Check the medical form against the group <b>before</b> paying</td></tr>
        <tr><td>5</td><td>One glacier walk</td><td>Fallj&ouml;kull caps groups at ten, so it sells out first</td></tr>
        <tr><td>6</td><td>H&uacute;sav&iacute;k whales</td><td>Morning sailing, day 12</td></tr>
      </table>
      <p class="mono" style="font-size:.74rem;margin-top:10px">
      Everything else on this route is same-day. Campsites are not bookable and do not need to be
      &mdash; but they do need to be <b>confirmed open</b>.</p>
    </div>
    <div class="panel">
      <h3>What it costs</h3>
      <table>
        <tr><th>Item</th><th>2026 rate</th></tr>
        <tr><td>Camper, 2-berth, September</td><td>US$75&ndash;125 / day</td></tr>
        <tr><td>Heater or shower upgrade</td><td>+US$50&ndash;100 / day</td></tr>
        <tr><td>Campsite, unserviced</td><td>US$10&ndash;20 / night per van</td></tr>
        <tr><td>Campsite, electric hook-up</td><td>US$20&ndash;40 / night per person</td></tr>
        <tr><td>Camping Card</td><td>~26,000 ISK (~US$187&ndash;206)</td></tr>
        <tr><td>Municipal pool</td><td>~1,200 ISK &mdash; the daily shower</td></tr>
        <tr><td>Glacier walk</td><td>US$105 easy / US$162 advanced</td></tr>
        <tr><td>Paid stops</td><td>Fja&eth;r&aacute;rglj&uacute;fur parking 1,000 ISK; Stokksnes gate fee; Keri&eth;</td></tr>
      </table>
      <p class="mono" style="font-size:.74rem;margin-top:10px">
      <b>All figures are 2026.</b> Marked <span class="mono">GAP</span> &mdash; no 2027 rates
      published for the van, the card or the tours. Re-quote before booking.</p>
    </div>
  </div>

  <div class="grid2">
    <div class="panel check">
      <h3>Before you go</h3>
      <div id="checklist">{checklist}</div>
      <p class="mono" style="font-size:.72rem;margin-top:10px">Ticks are saved in this browser.</p>
    </div>
    <div class="panel">
      <h3>Still open &mdash; the honest state</h3>
      <ul>
        <li><b>1</b><span><b>Campsite closing dates for September 2027 are unverified for every site
          on this route.</b> Fifty Icelandic campsites shut during September. This is the highest-risk
          item in the plan and the only one that could break a night&rsquo;s sleep. Phone each one.
          Egilssta&eth;ir, Borgarnes and Reykjav&iacute;k Laugardalur are the year-round fallbacks.</span></li>
        <li><b>2</b><span><b>Leg distances are estimated off the map, not routed</b>, except
          V&iacute;k&rarr;H&ouml;fn (273 km / 3 h 24 m), H&ouml;fn&rarr;Egilssta&eth;ir (187 km /
          2 h 46 m) and Akureyri&rarr;M&yacute;vatn (73 km). <b>Verify day 13 in particular</b> &mdash;
          it is the one that is genuinely long.</span></li>
        <li><b>3</b><span><b>Group size is undecided</b>, and it sets van size, the Silfra headcount
          and whether the Fallj&ouml;kull ten-person cap is a problem.</span></li>
        <li><b>4</b><span><b>Every price is a 2026 figure.</b> Nothing for 2027 has published.</span></li>
        <li><b>5</b><span><b>Reykjanes is volatile.</b> Magma volume at Svartsengi is the highest
          since December 2023. Day 1 is built so that losing the peninsula entirely costs nothing.</span></li>
      </ul>
    </div>
  </div>
</section>"""

# ---------- assemble ------------------------------------------------------------------
NAV = '<a class="home" href="/">&#8592; All plans<span class="d">dashboard</span></a>' + "".join(
    f'<a href="#{i}"><span class="d">{d}</span>{n}</a>' for i, d, n in [
    ("orient", "Read first", "Orientation"),
    ("window", "Decide", "Why September"),
    ("van", "Rules &amp; limits", "The van"),
    ("d1", "Days 1&ndash;2", "Golden Circle"),
    ("d3", "Days 3&ndash;4", "South coast"),
    ("d5", "Day 5", "Glacier lagoons"),
    ("d6", "Days 6&ndash;7", "East &amp; north"),
    ("d8", "Days 8&ndash;9", "M&yacute;vatn &amp; Akureyri"),
    ("d10", "Days 10&ndash;12", "Sn&aelig;fellsnes &amp; home"),
    ("quick", "In the field", "Day-of links"),
    ("essentials", "Money &amp; kit", "Essentials"),
])

CHIPS = "".join(f'<span class="chip"><strong>{a}</strong> {b}</span>' for a, b in [
    ("11", "nights"), ("10", "campsites"), ("~2,190", "km"),
    ("0", "hotels"), ("1.3&ndash;3 h", "of true dark"),
])

HERO_IMG = "Aurora Borealis activity on top of the Kirkjufell mountain in September 2018.jpg"

CTX = {
    "slug": "iceland-ring-road",
    "trip_date": "2027-09-04",
    "trip_dates": "4&ndash;15 September 2027",
    "trip_duration": "11 nights",
    "trip_region": "Ring Road &amp; Sn&aelig;fellsnes",
    "title": "Iceland — the Ring Road by camper van, 4–15 September 2027",
    "description": ("The full Ring Road plus Snæfellsnes in a camper van, timed to the first week "
                    "Iceland is actually dark. Eleven nights, ten campsites, no hotels."),
    "hero_image": img(HERO_IMG, 2000),
    "hero_credit": f'<a href="{filepage(HERO_IMG)}">Aurora over Kirkjufell, September &middot; Wikimedia Commons</a>',
    "eyebrow": "4&ndash;15 September 2027 &middot; first van trip",
    "headline": "Iceland",
    "sub": ("The Ring Road by camper van, timed to the first week of the year the sky is actually dark."),
    "chips": CHIPS,
    "nav": NAV,
    "body": ORIENT + WINDOW + VAN + D1 + D3 + D5 + D6 + D8 + D10 + QUICK + ESSENTIALS,
    "footer": ('Planned from three research files in <span class="mono">~/workspace/travel/'
               'iceland-ring-road/</span>. Every daylight and darkness figure was computed with '
               '<span class="mono">sun-times.py</span> and <span class="mono">dark-times.py</span> '
               'in that folder, not quoted from anywhere. Photographs from '
               '<a href="https://commons.wikimedia.org/">Wikimedia Commons</a>, each linked at its '
               'caption. Rules and prices verified September 2026 &mdash; <b>every price here is a '
               '2026 figure, and no campsite has been confirmed open for September 2027.</b>'),
    "extra_css":
        # home link back to the hub dashboard; excluded from scrollspy because base.js
        # only observes nav a[href^="#"].
        "nav a.home{color:var(--highlight-on-deep);font-weight:600;"
        "border-right:1px solid color-mix(in srgb, var(--highlight-on-deep) 32%, transparent);"
        "margin-right:6px}"
        "nav a.home:hover{color:var(--header-ink)}"
        # base.css gives .panel p no bottom margin, so consecutive paragraphs run together.
        ".panel p + p{margin-top:11px}"
        ".panel ul{margin:6px 0 0 18px}.panel li{margin-bottom:7px;font-size:.94rem}"
        ".panel table{margin-top:8px}"
        ".panel li > b:first-child{margin-right:7px;color:var(--accent)}"
        # `.fine` is the warn-toned small print used for the hard limits in the van section.
        ".panel .fine{margin-top:10px;font-size:.86rem;color:var(--warn)}"
        # the aurora hero is very dark already, so this page needs a LIGHTER scrim than the
        # shared default or the headline sits on near-black. Tokens only, no literals.
        ".hero::before{background:linear-gradient(180deg,"
        "color-mix(in srgb, var(--bg-deep) 26%, transparent) 0%,"
        "color-mix(in srgb, var(--bg-deep) 14%, transparent) 40%,"
        "color-mix(in srgb, var(--bg-deep) 88%, transparent) 100%)}"
        ".area .days{font-family:var(--font-mono);font-size:.68rem;letter-spacing:.06em}"
        ".knowh{margin:34px 0 0;font-family:var(--font-display);font-size:1.15rem;letter-spacing:.01em}"
        ".know li span b{font-family:inherit;font-size:inherit;font-weight:700;color:var(--ink)}"
        ".know li span b:first-child{color:var(--warn)}",
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
