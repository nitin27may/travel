#!/usr/bin/env python3
"""Build costa-rica-feb-2027/index.html from _system components. Run:  python3 build_page.py"""
import sys, urllib.parse
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "_system"))
sys.path.insert(0, str(HERE.parents[1] / "tools" / "gallery"))
import build as S   # noqa: E402

THEME = "forest"
COUNTRY = "Costa Rica"


def img(fn, w=900):
    q = urllib.parse.quote(fn.replace(" ", "_"))
    return f"https://commons.wikimedia.org/wiki/Special:FilePath/{q}?width={w}"


def filepage(fn):
    return "https://commons.wikimedia.org/wiki/File:" + urllib.parse.quote(fn.replace(" ", "_"))


def fig(fn, alt):
    return (f'<figure><img loading="lazy" src="{img(fn)}" alt="{alt}">'
            f'<figcaption><a href="{filepage(fn)}">Wikimedia Commons</a></figcaption></figure>')


def mapq(*parts):
    return "https://maps.google.com/?q=" + urllib.parse.quote_plus(", ".join(parts) + ", " + COUNTRY)


def embed(place, z=9):
    return f"https://maps.google.com/maps?q={urllib.parse.quote_plus(place + ', ' + COUNTRY)}&z={z}&output=embed"


def stop(cls, time, title, tag, body, stats=None, links=None, photo=None, more=None, note=None):
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


CLASSES = [
    ("trail", "On foot or on a rope"),
    ("road",  "Driving leg"),
    ("soak",  "Hot springs"),
    ("book",  "Book ahead — fixed slot or group size"),
    ("tide",  "Tide- or boat-dependent"),
    ("risk",  "Closure- or weather-dependent"),
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
    <div class="bar"><span>{place}</span><a href="{mapq(place)}">Open in Maps</a></div></div>
  {LEGEND}
</section>"""


# ---------- orientation ---------------------------------------------------------------
AREAS = [
    ("Fumerolles.JPG", "Rincón de la Vieja", "Nights 1–2",
     "Active volcano, steaming ground at Las Pailas and rivers warm enough to bathe in. The easy start, 45 minutes from the airport."),
    ("La Fortuna Waterfall in Alajuela province, Costa Rica.jpg", "La Fortuna &amp; Arenal", "Nights 3–5",
     "The adventure base: canyoning, a balsa float, ziplines and a night in the springs. Arenal has not glowed since 2010."),
    ("Main Beach Manuel Antonio National Park Costa Rica.JPG", "Manuel Antonio", "Nights 6–7",
     "Rainforest that runs down onto a beach, with sloths and capuchins on the path. Shut on Tuesdays."),
    ("Costa Rica Nationalpark Marino Ballena.JPG", "Uvita &amp; Ballena", "Nights 8–10",
     "The Whale&rsquo;s Tail sandbar, humpbacks offshore and scarlet macaws in the almond trees."),
]
areas_html = "".join(
    f'<div class="area">{fig(fn, name)}<div class="ab"><h3>{name}</h3>'
    f'<p class="days">{days}</p><p>{txt}</p></div></div>'
    for fn, name, days, txt in AREAS)

ORIENT = f"""
<section class="intro" id="orient">
  <p class="kick">Before the days start</p>
  <h2>What this trip physically is</h2>
  <div class="lead">
    <p>Costa Rica is a narrow country with a spine of volcanoes. <b>Rincón de la Vieja and Arenal are
    both active-arc volcanoes</b>, which is why there are hot rivers and steaming ground in the
    north and why the springs here are fed by the mountain, not heated in a tank.</p>

    <p>The route is a line down the country, not a loop: <b>fly into Liberia (LIR), fly out of
    San José (SJO)</b>, and drive about 600 km between. February is the dry season on the
    Guanacaste side and around La Fortuna. <b>The Pacific south is not especially dry</b> — Uvita
    sees roughly 60 to 150 mm over a week in February, so pack a rain layer for the last leg.</p>

    <p><b>What is specific here</b> is the humpback season. Whales come up from the Northern
    Hemisphere between December and April, and Ballena Marine National Park is where the
    Whale&rsquo;s Tail sandbar shows at low tide. That, not the beaches, is the reason the plan ends
    in Uvita.</p>

    <p>Costa Rica sells itself on adventure and nature, and both are here. The skill is choosing:
    with a ten-year-old, <b>one big activity a day, and two long drives that carry nothing</b>.</p>
  </div>

  <figure class="introwide"><img loading="lazy" src="{img('Arenal Lake (60159p).jpg', 1400)}"
    alt="Lake Arenal">
    <figcaption><a href="{filepage('Arenal Lake (60159p).jpg')}">Wikimedia Commons</a></figcaption></figure>

  <div class="areas">{areas_html}</div>

  <div class="numstrip">
    <div><b>10</b><span>nights (8 on plan B)</span></div>
    <div><b>4</b><span>bases</span></div>
    <div><b>~600</b><span>km driven</span></div>
    <div><b>17:45</b><span>sunset, be in by 17:00</span></div>
    <div><b>2</b><span>days with no tide to use</span></div>
    <div><b>0</b><span>Feb 2027 prices in hand</span></div>
  </div>

  <ul class="know">
    <li><b>1</b><span><b>Manuel Antonio is shut on Tuesday</b>, and Las Pailas on Monday. The
      order of the days is built around that, not around preference.</span></li>
    <li><b>2</b><span><b>Whale&rsquo;s Tail is a low-tide walk.</b> The best mornings are
      Sun 21 and Mon 22 Feb (lows 08:33 and 09:20). Mid-February has only afternoon or pre-dawn
      lows.</span></li>
    <li><b>3</b><span><b>Arenal does not glow.</b> The last lava was in 2010; the night soak is
      stars, not fire. Rio Celeste&rsquo;s waterfall trail has been closed or partly closed since mid-2025,
      so it is a bonus, not a plan.</span></li>
    <li><b>4</b><span><b>He is on the line for two things.</b> Tubing at Guachipelin needs 140 cm and age 8; Sky
      Trek&rsquo;s child harness covers 10 to 40 kg. Measure and weigh him before booking.</span></li>
    <li><b>5</b><span><b>Rental insurance is the surprise cost.</b> Third-party liability is mandatory and
      cannot be covered by a credit card.</span></li>
    <li><b>6</b><span><b>Every price here is a 2026 figure.</b> No February 2027 quote exists for any hotel or
      operator. Treat totals as shape, not budget, until you have quotes.</span></li>
  </ul>
</section>"""


# ---------- plan decision, as an A/B toggle -------------------------------------------
PLANS = """
<section class="intro" id="plan">
  <p class="kick">The one decision that changes the shape</p>
  <h2>10 nights or 8</h2>
  <div class="lead"><p>The first eight nights are identical. The last two nights are Uvita, and
  they carry the whales, the Whale&rsquo;s Tail and the macaws. Pick the version you want to read;
  the day-by-day below is the 10-night plan, and plan B is the same days with the south shortened.</p></div>

  <div class="toggle">
    <button data-plan-btn="a">10 nights &middot; recommended</button>
    <button data-plan-btn="b">8 nights</button>
  </div>

  <div class="planwrap">
    <div class="plan" data-plan="a">
      <div class="panel">
        <h3>Sat 13 &ndash; Tue 23 Feb 2027</h3>
        <p><b>Rincón 2, Arenal 3, Manuel Antonio 2, Uvita 3.</b> Whale&rsquo;s Tail on the lowest
        daytime tides, a whale tour on the Monday, and a three-and-a-half-hour drive to SJO on the
        last day.</p>
        <table>
          <tr><th>Night</th><th>Date</th><th>Base</th></tr>
          <tr><td>1&ndash;2</td><td>Sat 13, Sun 14</td><td>Rincón de la Vieja</td></tr>
          <tr><td>3&ndash;5</td><td>Mon 15, Tue 16, Wed 17</td><td>La Fortuna</td></tr>
          <tr><td>6&ndash;7</td><td>Thu 18, Fri 19</td><td>Manuel Antonio</td></tr>
          <tr><td>8&ndash;10</td><td>Sat 20, Sun 21, Mon 22</td><td>Uvita</td></tr>
        </table>
        <p>Lodging at 2026 from-rates: about <b>$2,336</b> before tax.</p>
      </div>
    </div>
    <div class="plan" data-plan="b">
      <div class="panel">
        <h3>Sat 13 &ndash; Sun 21 Feb 2027</h3>
        <p><b>Rincón 2, Arenal 3, Manuel Antonio 3</b>, flying home from SJO on Sunday. This costs
        you Uvita: no Whale&rsquo;s Tail, no whale tour, no macaws. What you gain is two fewer days
        and one drive less. Manuel Antonio to SJO is shorter than Uvita to SJO, but the figure is not sourced.</p>
        <table>
          <tr><th>Night</th><th>Date</th><th>Base</th></tr>
          <tr><td>1&ndash;2</td><td>Sat 13, Sun 14</td><td>Rincón de la Vieja</td></tr>
          <tr><td>3&ndash;5</td><td>Mon 15, Tue 16, Wed 17</td><td>La Fortuna</td></tr>
          <tr><td>6&ndash;8</td><td>Thu 18, Fri 19, Sat 20</td><td>Manuel Antonio</td></tr>
        </table>
        <p>Spare Manuel Antonio day (Sat 20): Damas Island mangrove kayak, or the Quepos canopy.
        Lodging at 2026 from-rates: about <b>$1,947</b> before tax.</p>
      </div>
    </div>
  </div>
</section>"""


# ---------- days ----------------------------------------------------------------------
D1 = day("d1", "Nights", "1–2", "Liberia to Rincón de la Vieja",
         "LIR &#8594; Hacienda Guachipelin &#8594; Las Pailas &#8594; Rio Negro springs",
         [("Drive", "45–60 min"), ("Nights", "Rincón 2"), ("Open", "Las Pailas Tue–Sun")],
         [
 stop(2, "Sat 13 &middot; arrive", "Collect the car, drive to Guachipelin", None,
      "<p>The base is 34 km from the airport. The last stretch is unpaved and its length is not "
      "confirmed, so ask the hotel when you book. Sunset is about 17:45; do this in daylight.</p>",
      [("34", "km"), ("45–60", "min"), ("~17:45", "sunset")],
      [("Map — LIR to Guachipelin", "https://www.google.com/maps/dir/Liberia+Airport+Costa+Rica/Hacienda+Guachipelin/", True)],
      None,
      None,
      "Hacienda Guachipelin family room from <b>$153</b> a night (king, double, twin; breakfast, A/C, pool). "
      "Borinquen from $199 is the alternative."),

 stop(1, "Sun 14 &middot; 08:00", "Las Pailas loop", ("risk", "volcano status"),
      "<p>A short loop through steaming ground and mud pots. <b>The crater trail has been closed since 2011</b>, "
      "so this is the walk, not a summit. The volcano is on OVSICORI level 3 and the CNE issued a yellow alert on "
      "1 October 2026, so <b>check status the week before</b>.</p>"
      "<p>Open Tuesday to Sunday only, so Sunday works and Monday does not.</p>",
      [("$16.95 / $5.65", "adult / child"), ("08:00–15:00", "Tue–Sun"), ("online", "tickets only")],
      [("Map — Las Pailas", mapq("Las Pailas", "Rincón de la Vieja National Park"), True)],
      ("Fumerolles.JPG", "Fumaroles at Las Pailas"),
      None,
      "February 2027 trail and alert status is a <span class='mono'>GAP</span>."),

 stop(4, "Sun 14 &middot; afternoon", "Guachipelin: canopy, tubing or canyoning", ("added", "book ahead"),
      "<p>Pick two. <b>Canopy $65 / $45</b> (ages 4 to 12). <b>Canyoning $50, minimum age 10</b>, so he just qualifies. "
      "<b>Rio Negro tubing needs 140 cm and age 8</b>: he is on the line, so measure him. Horseback is from age 4 "
      "with a 240 lb limit, and a booking inside 48 hours is a full cancellation charge.</p>",
      [("$65 / $45", "canopy"), ("$50", "canyoning, 10+"), ("140 cm", "tubing min")],
      [("Hacienda Guachipelin", "https://www.guachipelin.com/", True),
       ("Map — Guachipelin", mapq("Hacienda Guachipelin"), False)],
      None),

 stop(3, "Sun 14 &middot; evening", "Rio Negro hot springs", None,
      "<p>Ten pools at 37 to 40 C. <b>Free for Guachipelin guests</b>; otherwise $30 for a child (4 to 12). "
      "The guest-access claim is not on the hotel&rsquo;s own page, so confirm when you book.</p>",
      [("10", "pools"), ("37–40", "C"), ("$30", "child, non-guest")],
      [("Map — Rio Negro springs", mapq("Rio Negro hot springs", "Guachipelin"), True)],
      None),
         ], "Hacienda Guachipelin", 10)

D3 = day("d3", "Nights", "3–5", "La Fortuna and Arenal",
         "Rincón &#8594; La Fortuna &#8594; canyoning &#8594; Arenal NP &#8594; Tabacón at night",
         [("Drive", "3–3.5 h on Mon"), ("Nights", "Fortuna 3"), ("Volcano", "no glow since 2010")],
         [
 stop(2, "Mon 15", "Drive Rincón to La Fortuna", None,
      "<p>About 155 km. Leave after breakfast, arrive early afternoon. Canadian Family Day falls on this "
      "Monday, which affects flights, not Costa Rican roads.</p>",
      [("~155", "km"), ("3–3.5", "h")],
      [("Map — Rincón to La Fortuna", "https://www.google.com/maps/dir/Rincon+de+la+Vieja/La+Fortuna+Costa+Rica/", True)],
      ("Arenal Lake (60159p).jpg", "Lake Arenal"),
      None,
      "Arenal Kioro suite for four from <b>$351</b> (A/C, breakfast, 7 pools). Fallback: Arenal Springs "
      "$355 to $396. Stay on the volcano road, about 10 minutes from town."),

 stop(4, "Tue 16 &middot; morning", "Canyoning with Pure Trek", ("added", "book ahead"),
      "<p>Four rappels, minimum age 5, <b>$117 including tax</b>. Free cancellation within 24 hours through resellers. "
      "This is the one thing on the trip that gets a ten-year-old properly wet and scared in a good way.</p>",
      [("$117", "incl. tax"), ("4", "rappels"), ("5+", "min age")],
      [("Map — La Fortuna", mapq("Pure Trek Canyoning", "La Fortuna"), True)],
      ("La Fortuna Waterfall Pool.jpg", "Waterfall pool near La Fortuna")),

 stop(1, "Wed 17 &middot; 08:00", "Arenal National Park", None,
      "<p>Open daily 08:00 to 16:00. <b>Tickets are bought at the booth, by card only</b>, even though some "
      "blogs say online. Go early; the lava-flow trails are the point.</p>",
      [("$15 / $5", "adult / child"), ("08:00–16:00", "daily"), ("card", "only")],
      [("Map — Arenal NP", mapq("Arenal Volcano National Park"), True)],
      ("Arenal volcano (70785p).jpg", "Arenal volcano")),

 stop(4, "Wed 17 &middot; pick one", "Balsa float <i>or</i> Sky Trek", ("added", "book ahead"),
      "<p><b>Balsa float, class II–III:</b> Arenal Rafting Co (6+) $65 + IVA; Desafio (8+) $82 / $74; "
      "Rios Adventure La Virgen is exactly 10+ at $85. <b>Sky Trek:</b> about $93 adult / $60–65 child, min age 5, "
      "child gear covers 10 to 40 kg and he is near the top. Tickets are hard to get December to April.</p>"
      "<p>Out for him: Pacuare (12+), Class III–IV sections, Selvatura Superman (55 kg).</p>",
      [("$65–85", "float"), ("$60–65", "Sky Trek child"), ("40 kg", "harness top")],
      [("Map — La Fortuna", mapq("Sky Adventures Arenal"), True)],
      None),

 stop(3, "Wed 17 &middot; night", "Tabacón night soak", ("added", "book ahead"),
      "<p>Open to 22:00, so this is the one to do after dark. <b>$115 adult / $55 child</b> (6 to 11), or $184 / $90 with a meal. "
      "From 9 Jan 2027 the adult price is $129; the child price after 8 Jan is not stated, and whether tax is included is unresolved. "
      "Shangri-La Gardens is 18+. It is stars, not lava.</p>",
      [("$115 / $55", "day pass"), ("22:00", "closes"), ("$129", "adult from 9 Jan")],
      [("Map — Tabacón", mapq("Tabacon Hot Springs"), True)],
      ("Tabacón Hot Springs, Costa Rica.jpg", "Tabacón hot springs"),
      None,
      "Free alternative: Titoku with a Kioro stay, ends 18:00; its page currently says no availability this season."),
         ], "Arenal Volcano National Park", 10)

D6 = day("d6", "Nights", "6–7", "South to Manuel Antonio",
         "La Fortuna &#8594; Quepos &#8594; Manuel Antonio NP",
         [("Drive", "4–6 h on Thu"), ("Nights", "Manuel Antonio 2"), ("Shut", "Tuesdays")],
         [
 stop(2, "Thu 18", "The long drive", ("risk", "daylight"),
      "<p>About 215 to 245 km via Ruta 702 and 142, then 1, 23 and 27, 34 and 235. Going via Bajos del Toro is no faster. "
      "Leave early; sunset is about 17:45 and this is not a road for the dark.</p>",
      [("215–245", "km"), ("4–6", "h"), ("17:00", "be in by")],
      [("Map — La Fortuna to Manuel Antonio", "https://www.google.com/maps/dir/La+Fortuna+Costa+Rica/Manuel+Antonio+Costa+Rica/", True)],
      None,
      None,
      "Costa Verde family area, Studio A8 (sleeps 5) from <b>$196</b>. Avoid its adults-only units."),

 stop(1, "Fri 19 &middot; 07:00", "Manuel Antonio National Park", ("risk", "shut Tuesdays"),
      "<p>Open Wednesday to Monday, 07:00 to 15:00, <b>shut Tuesday</b> (16 and 23 Feb). "
      "<b>$16 adult / $5 child + 13% IVA</b>, online timed tickets only. A guided walk is $65 / $45 under 10; "
      "ask whether a ten-year-old gets the child rate. Sloths, capuchins and raccoons are on the path.</p>",
      [("$16 / $5", "+13% IVA"), ("07:00–15:00", "Wed–Mon"), ("online", "tickets")],
      [("Map — Manuel Antonio NP", mapq("Manuel Antonio National Park"), True)],
      ("Parque Nacional Manuel Antonio 02.jpg", "Manuel Antonio National Park"),
      None,
      "An old tariff PDF conflicts on the fee. Check the SINAC page when you book."),

 stop(4, "Fri 19 &middot; evening", "Night walk at Papa&rsquo;s Place", ("added", "optional"),
      "<p>Child tier 5 to 11, from about $40 through resellers. Optional; skip if the morning in the park wore him out.</p>",
      [("~$40", "from"), ("5–11", "child tier")],
      [("Map — Manuel Antonio", mapq("Papa's Place", "Manuel Antonio"), True)],
      ("Raccoon in Manuel Antonio National Park.jpg", "Raccoon in Manuel Antonio National Park")),
         ], "Manuel Antonio National Park", 10)

D8 = day("d8", "Nights", "8–10", "Uvita, the whales and home",
         "Quepos &#8594; Uvita &#8594; Whale&rsquo;s Tail &#8594; whale tour &#8594; SJO",
         [("Drive", "~1 h 15 on Sat"), ("Nights", "Uvita 3"), ("Last drive", "3.5–4 h")],
         [
 stop(5, "Sat 20", "Mangrove kayak, then drive to Uvita", ("added", "book ahead"),
      "<p>Damas Island mangrove kayak at Quepos is about $90 + tax. Then 64 km, 1 h 10 to 1 h 25, to Uvita. "
      "Playa Uvita at sunset, with scarlet macaws in the almond trees.</p>",
      [("~$90", "kayak"), ("64", "km"), ("1 h 10–25", "drive")],
      [("Map — Damas Island", mapq("Damas Island", "Quepos"), True)],
      ("Scarlet Macaws at Uvita Beach, Costa Rica 01.jpg", "Scarlet macaws at Uvita Beach"),
      None,
      "Cristal Ballena family suite, 75 m2, from <b>$195</b> (A/C). Avoid adults-only El Castillo Ojochal."),

 stop(5, "Sun 21 &middot; ~07:30", "Whale&rsquo;s Tail at low tide", ("risk", "tide"),
      "<p>Walkable around low tide only. <b>Daytime low on Sun 21 is 08:33&ndash;08:54</b>, so arrive about an hour before. "
      "Sources agree on the pattern and differ by about 20 minutes. <b>$6 adult, under 11 free</b>, not sold online; "
      "open 07:00 to 16:00.</p>",
      [("08:33–08:54", "low, Sun 21"), ("$6", "adult"), ("free", "under 11")],
      [("Map — Ballena Marine NP", mapq("Ballena Marine National Park", "Uvita"), True)],
      ("Costa Rica Nationalpark Marino Ballena.JPG", "Whale's Tail at Ballena Marine National Park"),
      ("Tide table for the week",
       "<table><tr><th>Date</th><th>Daytime low</th></tr>"
       "<tr><td>Fri 19</td><td>06:49&ndash;07:10</td></tr>"
       "<tr><td>Sat 20</td><td>07:44&ndash;08:05</td></tr>"
       "<tr><td>Sun 21</td><td>08:33&ndash;08:54</td></tr>"
       "<tr><td>Mon 22</td><td>09:20&ndash;09:40</td></tr>"
       "<tr><td>Tue 23</td><td>10:04&ndash;10:24</td></tr></table>"
       "<p>NOAA TWC0341 and seatemperatu.re. 13&ndash;17 Feb have only afternoon or pre-dawn lows.</p>")),

 stop(5, "Mon 22 &middot; morning", "Humpback whale tour", ("added", "book ahead"),
      "<p>About $79.50 to $85 adult / $45 child (4 to 10), 3 to 4 hours, park fee included. "
      "<b>&ldquo;95% success&rdquo; is marketing.</b> Northern humpback season runs December to April, so February is in it. "
      "Boat operators were not safety-checked.</p>",
      [("$80–85 / $45", "adult / child"), ("3–4", "h"), ("Dec–Apr", "season")],
      [("Map — Uvita", mapq("Uvita whale watching"), True)],
      ("073 Humpback whale tail in Ballena Marine National Park Photo by Giles Laurent.jpg", "Humpback whale tail")),

 stop(2, "Tue 23", "Drive to SJO", ("risk", "flight day"),
      "<p>3.5 to 4 hours via Ruta 34 and 27. <b>Do not use Ruta 2 on a flight day.</b> "
      "Allow for the $29 exit tax if the fare does not include it, and leave a large margin; the flight time is not fixed yet.</p>",
      [("3.5–4", "h"), ("$29", "exit tax")],
      [("Map — Uvita to SJO", "https://www.google.com/maps/dir/Uvita+Costa+Rica/Juan+Santamaria+Airport/", True)],
      ("Sunset over Playa Uvita, Costa Rica.jpg", "Sunset over Playa Uvita")),
         ], "Uvita, Puntarenas", 10)


# ---------- adventure table -----------------------------------------------------------
ADVENTURE = """
<section class="intro" id="adventure">
  <p class="kick">What to book, and what he can do</p>
  <h2>Adventure</h2>
  <div class="lead">
    <p>The limits are age, height and harness weight, not fitness. Two of them sit exactly on his
    numbers, so <b>measure and weigh him before anything is booked</b>. Prices are 2026 and per person.</p>
  </div>
  <table>
    <tr><th>Activity</th><th>Price</th><th>Limit</th><th>Where</th></tr>
    <tr><td><b>Pure Trek canyoning</b></td><td>$117 incl. tax</td><td>5+, four rappels</td><td>La Fortuna</td></tr>
    <tr><td><b>Balsa float II&ndash;III</b></td><td>$65&ndash;85</td><td>6+ / 8+ / 10+ by operator</td><td>La Fortuna, La Virgen</td></tr>
    <tr><td><b>Sky Trek</b></td><td>~$60&ndash;65 child</td><td>5+, <b>child gear 10&ndash;40 kg</b></td><td>La Fortuna</td></tr>
    <tr><td><b>Guachipelin canyoning</b></td><td>$50</td><td><b>10+</b></td><td>Rincón</td></tr>
    <tr><td><b>Rio Negro tubing</b></td><td>GAP</td><td><b>140 cm, 8+</b></td><td>Rincón</td></tr>
    <tr><td><b>Guachipelin canopy</b></td><td>$65 / $45</td><td>4&ndash;12</td><td>Rincón</td></tr>
    <tr><td><b>Humpback tour</b></td><td>$80&ndash;85 / $45</td><td>child 4&ndash;10</td><td>Uvita</td></tr>
    <tr><td><b>Damas mangrove kayak</b></td><td>~$90 + tax</td><td>GAP</td><td>Quepos</td></tr>
    <tr><td><b>Papa&rsquo;s Place night walk</b></td><td>from ~$40</td><td>child 5&ndash;11</td><td>Manuel Antonio</td></tr>
  </table>
  <div class="grid2">
    <div class="panel">
      <h3>Ruled out for him</h3>
      <ul><li>Pacuare rafting: 12+.</li><li>Class III&ndash;IV Sarapiqui sections.</li>
      <li>Selvatura Superman add-on: 55 kg.</li><li>Costa Canyoning Dominical: 11+.</li>
      <li>Isla del Cano: 7&ndash;9 h boat day, no toilets.</li></ul>
    </div>
    <div class="panel">
      <h3>Ranked</h3>
      <p>1) Guachipelin day. 2) Pure Trek canyoning. 3) Balsa float. 4) Sky Trek with the tram.
      5) Uvita whales. 6) Night walk, or the mangrove kayak.</p>
      <p>No incident was found for the shortlisted operators from 2023 to 2026. Boat operators were not searched
      and no independent certification was verified.</p>
    </div>
  </div>
</section>"""


# ---------- hot springs ---------------------------------------------------------------
SPRINGS = """
<section class="intro" id="springs">
  <p class="kick">The soak plan</p>
  <h2>Hot springs</h2>
  <div class="lead">
    <p>Two of the four hotels include springs, so <b>you only need to pay for one</b>, and that one is a
    night at Tabacón. Everything else is free with the room.</p>
  </div>
  <table>
    <tr><th>Place</th><th>Child</th><th>Adult</th><th>Know</th></tr>
    <tr><td><b>Rio Negro</b> (Guachipelin)</td><td>$30 (4&ndash;12)</td><td>&mdash;</td><td>Free for guests; 10 pools, 37&ndash;40 C</td></tr>
    <tr><td><b>Titoku</b> (Kioro)</td><td>$24</td><td>&mdash;</td><td>Free for guests, ends 18:00; page says no availability</td></tr>
    <tr><td><b>Tabacón</b></td><td>$55 (6&ndash;11)</td><td>$115 ($129 from 9 Jan)</td><td>Open to 22:00; the night soak</td></tr>
    <tr><td><b>Baldi</b></td><td>$29 + 13%</td><td>~$58 with meal</td><td>Kids&rsquo; area closes 18:00</td></tr>
    <tr><td><b>Ecotermales</b></td><td>$25</td><td>~$59</td><td>Evening 17:00&ndash;22:00; a review says poor for kids</td></tr>
  </table>
  <div class="panel" style="margin-top:20px">
    <h3>Adults-only, avoid</h3>
    <p>Royal Corin (16+), Tabacón Shangri-La Gardens (18+), Baldi upper level, Paradise Premium,
    Costa Verde II and Cockpit Cabana, Oxygen Jungle Villas, El Castillo Ojochal, Gaia Manuel Antonio (13+).</p>
  </div>
</section>"""


# ---------- day-of links --------------------------------------------------------------
QUICK = """
<section class="quick" id="quick">
  <h2>Day-of links</h2>
  <p class="qsub">The handful actually tapped in the field</p>
  <div class="qgrid">
    <div class="qcard">
      <h4><span class="dot" style="background:var(--class-6)"></span>Is it open</h4>
      <a href="https://www.sinac.go.cr/"><b>SINAC</b>National park status and fees</a>
      <a href="https://www.ovsicori.una.ac.cr/"><b>OVSICORI</b>Volcano status, Rincón de la Vieja</a>
    </div>
    <div class="qcard">
      <h4><span class="dot" style="background:var(--class-5)"></span>Tides</h4>
      <a href="https://tides.mobilegeographics.com/"><b>Tide table</b>Check Uvita the evening before</a>
    </div>
    <div class="qcard">
      <h4><span class="dot" style="background:var(--class-2)"></span>Roads</h4>
      <a href="https://www.waze.com/"><b>Waze</b>Used for live closures in Costa Rica</a>
      <a href="tel:911"><b>911</b>Emergency</a>
    </div>
    <div class="qcard">
      <h4><span class="dot" style="background:var(--class-1)"></span>Weather</h4>
      <a href="https://www.imn.ac.cr/"><b>IMN</b>National weather institute</a>
    </div>
  </div>
</section>"""


CHECK_ITEMS = [
    ("flights", "Open-jaw flights booked, YYZ&#8594;LIR out and SJO&#8594;YYZ home"),
    ("rooms", "Four rooms booked (3&ndash;6 months out is normal for these dates)"),
    ("car", "Rental booked with third-party liability; credit-card CDW letter ordered"),
    ("measure", "He is measured (140 cm) and weighed (10&ndash;40 kg harness) before booking tubing and Sky Trek"),
    ("ma", "Manuel Antonio timed ticket for Fri 19"),
    ("pailas", "Las Pailas online ticket for Sun 14, after checking volcano status"),
    ("canyon", "Pure Trek canyoning, Tue 16"),
    ("sky", "Sky Trek <b>or</b> balsa float, Wed 17"),
    ("tabacon", "Tabacón night soak, Wed 17"),
    ("whale", "Whale tour, Mon 22"),
    ("insure", "Travel insurance sorted (no longer required, still sensible)"),
    ("offline", "Offline maps downloaded"),
    ("rain", "Rain layers packed for Uvita"),
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
        <tr><td>1</td><td>Open-jaw flights</td><td>Nonstop on Air Canada, Air Transat, WestJet (LIR), Porter</td></tr>
        <tr><td>2</td><td>Four hotels</td><td>Popular dates go 3&ndash;6 months out</td></tr>
        <tr><td>3</td><td>Rental car</td><td>Open-jaw drop fee ~$50, waived by Adobe on 3+ days</td></tr>
        <tr><td>4</td><td>Manuel Antonio ticket</td><td>Timed and online only</td></tr>
        <tr><td>5</td><td>Sky Trek, whale tour</td><td>Fixed slots; Sky Trek is scarce Dec&ndash;Apr</td></tr>
      </table>
    </div>

    <div class="panel">
      <h3>What it costs</h3>
      <p>Lodging at 2026 from-rates is about <b>$2,336</b> for 10 nights and <b>$1,947</b> for 8, before tax.
      Flights, car and activities are on top. No February 2027 quote exists, so treat these as a floor.</p>
      <table>
        <tr><th>Item</th><th>Figure</th></tr>
        <tr><td>Flights, YYZ&ndash;LIR return</td><td>C$522&ndash;848 pp typical</td></tr>
        <tr><td>Flights, YYZ&ndash;SJO return</td><td>C$622&ndash;1,004 pp typical</td></tr>
        <tr><td>Rental, 10 days</td><td>~$880 (Alec)</td></tr>
        <tr><td>Third-party liability</td><td>$15.95 / day at Vamos</td></tr>
        <tr><td>Exit tax</td><td>$29 pp</td></tr>
        <tr><td>Park fees, family</td><td>~$37 + IVA at Manuel Antonio</td></tr>
      </table>
    </div>

    <div class="panel">
      <h3>Driving</h3>
      <ul>
        <li><b>Third-party liability is mandatory</b> and a credit card cannot cover it.</li>
        <li>Card CDW covers the deductible only, needs a letter naming the renter and last 4 digits,
        and <b>any agency CDW voids it</b>. Scotiabank caps at 48 days and excludes trucks and vans.</li>
        <li>Compact SUV is the common choice; nothing on the route needs a 4x4.</li>
        <li>Never Ruta 2, Ruta 606 or the Monteverde road at night.</li>
      </ul>
    </div>

    <div class="panel check">
      <h3>Before you go</h3>
      <div id="checklist">{checklist}</div>
      <p class="mono" style="font-size:.72rem;margin-top:10px">Ticks are saved in this browser.</p>
    </div>
  </div>

  <div class="panel" style="margin-top:20px">
    <h3>Entry</h3>
    <p>Canadians need no visa for up to 180 days and an onward ticket may be asked for. The e-health form was
    repealed on 1 April 2022 and travel insurance is no longer required (travel.gc.ca, 31 Aug 2026).
    <span class="mono">GAP: migracion.go.cr not read.</span></p>
  </div>

  <div class="panel" style="margin-top:20px">
    <h3>Still open</h3>
    <p><b>Not yet known.</b> February 2027 rates for every property; operator prices and cancellation
    terms; Guachipelin zip and canyon ages; Poás and Rincón trail status; the unpaved Guachipelin
    access length; the open-jaw fare; the Tabacón child price after 8 Jan 2027; the Manuel
    Antonio to SJO drive time for plan B.</p>
    <p><b>Left out deliberately.</b> Monteverde (3&ndash;3.5 h from La Fortuna, windy and misty in February),
    Corcovado (guide and permits, needs a Drake Bay night), Isla del Cano, Tortuguero, Chirripó,
    quetzals (breeding starts mid-February).</p>
  </div>
</section>"""


NAV = '<a class="home" href="/">&#8592; All plans<span class="d">dashboard</span></a>' + "".join(
    f'<a href="#{i}"><span class="d">{d}</span>{n}</a>' for i, d, n in [
    ("orient", "Read first", "Orientation"),
    ("plan", "Decide", "10 or 8"),
    ("adventure", "Book &amp; limits", "Adventure"),
    ("springs", "Soak", "Hot springs"),
    ("d1", "Nights 1&ndash;2", "Rincón"),
    ("d3", "Nights 3&ndash;5", "La Fortuna"),
    ("d6", "Nights 6&ndash;7", "Manuel Antonio"),
    ("d8", "Nights 8&ndash;10", "Uvita"),
    ("quick", "In the field", "Day-of links"),
    ("essentials", "Money &amp; kit", "Essentials"),
])

CHIPS = "".join(f'<span class="chip"><strong>{a}</strong> {b}</span>' for a, b in [
    ("10", "nights (or 8)"), ("4", "bases"), ("3", "travellers"),
    ("1", "big activity a day"),
])

HERO_IMG = "Arenal volcano (70785p).jpg"

CTX = {
    "slug": "costa-rica-feb-2027",
    "trip_date": "2027-02-13",
    "trip_dates": "13 &ndash; 23 Feb 2027",
    "trip_duration": "10 nights",
    "trip_region": "Rincón, Arenal, Manuel Antonio &amp; Uvita",
    "title": "Costa Rica — 10 nights, February 2027",
    "description": ("Volcanoes, hot springs, canyoning and humpback whales across four bases, flying "
                    "into Liberia and out of San José. Ten nights with an eight-night alternative, "
                    "built for two adults and a ten-year-old."),
    "hero_image": img(HERO_IMG, 2000),
    "hero_credit": f'<a href="{filepage(HERO_IMG)}">Arenal volcano &middot; Wikimedia Commons</a>',
    "eyebrow": "13 &ndash; 23 Feb 2027 &middot; two adults and a ten-year-old",
    "headline": "Costa Rica",
    "sub": ("Volcanoes, hot springs and whales, one big adventure a day."),
    "chips": CHIPS,
    "nav": NAV,
    "body": ORIENT + PLANS + ADVENTURE + SPRINGS + D1 + D3 + D6 + D8 + QUICK + ESSENTIALS,
    "footer": ('Planned from nine research files in <span class="mono">~/workspace/travel/'
               'costa-rica-feb-2027/</span>. Photographs from '
               '<a href="https://commons.wikimedia.org/">Wikimedia Commons</a>, each linked at '
               'its caption. <b>Every price is a 2026 figure; no February 2027 quote exists. '
               'Re-check rates, park status and volcano alerts before booking.</b>'),
    "extra_css":
        "nav a.home{color:var(--highlight-on-deep);font-weight:600;"
        "border-right:1px solid color-mix(in srgb, var(--highlight-on-deep) 32%, transparent);"
        "margin-right:6px}"
        "nav a.home:hover{color:var(--header-ink)}"
        ".panel p + p{margin-top:11px}"
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
