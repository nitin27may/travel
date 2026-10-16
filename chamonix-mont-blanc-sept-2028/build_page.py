#!/usr/bin/env python3
"""Build chamonix-mont-blanc-sept-2028/index.html from _system components. Run:  python3 build_page.py

Content source is PLAN.md. Photos come from gallery.json (verified on Commons); the gallery
section itself is injected after the build, at the bottom of this file."""
import sys, urllib.parse
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "_system"))
import build as S   # noqa: E402

THEME = "alpine-snow"
REGION = "France"


def img(fn, w=900):
    q = urllib.parse.quote(fn.replace(" ", "_"))
    return f"https://commons.wikimedia.org/wiki/Special:FilePath/{q}?width={w}"


def filepage(fn):
    return "https://commons.wikimedia.org/wiki/File:" + urllib.parse.quote(fn.replace(" ", "_"))


def fig(fn, alt, author):
    return (f'<figure><img loading="lazy" src="{img(fn)}" alt="{alt}">'
            f'<figcaption>{author} &middot; <a href="{filepage(fn)}">Wikimedia Commons</a></figcaption></figure>')


def mapq(*parts):
    return "https://maps.google.com/?q=" + urllib.parse.quote_plus(", ".join(parts) + ", " + REGION)


def dirq(*places):
    return "https://www.google.com/maps/dir/" + "/".join(urllib.parse.quote_plus(p) for p in places) + "/"


def embed(place, z=12):
    return f"https://maps.google.com/maps?q={urllib.parse.quote_plus(place + ', ' + REGION)}&z={z}&output=embed"


def inf(text="inference"):
    return f'<span class="inf">{text}</span>'


GAP = '<span class="inf gap">GAP</span>'

# Photos (all from gallery.json, author as recorded there)
P = {
    "valley":   ("Chamonix valley from la Flégère,2010 07.JPG", "Mont Blanc above the Chamonix valley", "Ximonic, Simo Räsänen"),
    "range":    ("Massif du Mont-Blanc @ Frêtes de la Vogealle.jpg", "The Mont Blanc range from a grassy ridge", "Rémih"),
    "brevent":  ("Chamonix-Mont-Blanc Brévent Vue sur Chamonix 2.jpg", "Chamonix from Le Brevent", "Zairon"),
    "praz":     ("Arveyron, railway line Chemin de fer du Montenvers, Signal Forbes, Grand Balcon Nord and Montagne de Blaitière, Les Praz-de-Chamonix (cropped).jpg", "Les Praz with the Arveyron and the Grand Balcon Nord behind", "Tangopaso"),
    "gbsud":    ("Grand Balcon Sud 2.jpg", "A trail in the Aiguilles Rouges with the Mont Blanc range beyond", "Tiia Monto"),
    "aiguillette": ("Aiguillette des Houches antécime @ Aiguillette des Houches.jpg", "Aiguillette des Houches", "Rémih"),
    "lacblanc": ("Lac Blanc.JPG", "Lac Blanc", "Mrvoyage"),
    "lacblanc2": ("Chamonix - Lac Blanc 4.jpg", "Lac Blanc and the massif", "Tiia Monto"),
    "midi":     ("Aiguille du Midi, Top of Piton Central, Chamonix, Haute-Savoie.jpg", "Aiguille du Midi summit", "Christian David"),
    "mer":      ("Panorama of Mer de Glace from Montenvers, Chamonix, Haute-Savoie.jpg", "Mer de Glace from Montenvers", "Christian David"),
    "bossons":  ("Glacier des Bossons depuis Les Bossons (juin 2022).JPG", "Glacier des Bossons", "Florian Pépellin"),
    "balme":    ("Col de Balme & Le Tour @ Chamonix (51484422105).jpg", "Col de Balme and Le Tour", "Guilhem Vellut"),
    "balme2":   ("Col de Balme @ Plan de la Grange.jpg", "Col de Balme", "Rémih"),
    "gare":     ("Gare des Praz-de-Chamonix.jpg", "Les Praz de Chamonix station", "Tiia Monto"),
}


def ph(key):
    return fig(*P[key])


# ---------- classifier: what the day depends on ---------------------------------------
# (key, meaning, theme slot). Slot 2 is near-white in alpine-snow, so lift-free takes the grey slot 6.
CLASSES = [
    ("lift",  "Lift-dependent: no lift, no walk", 1),
    ("free",  "Lift-free: your own legs and a train or car", 6),
    ("book",  "Booked slot: a timed ticket or a hut bed", 3),
    ("wx",    "Weather-gated: the forecast decides it", 4),
]
LEGEND = '<div class="legend">' + "".join(
    f'<span><i class="b" style="background:var(--class-{sl})"></i>{n}</span>'
    for _, n, sl in CLASSES) + "</div>"
SLOT = {i + 1: c[2] for i, c in enumerate(CLASSES)}


def stop(cls, time, title, tag, body, stats, links, photo, why, more, opt=False):
    t = f'<span class="time{" opt" if opt else ""}">{time}</span>'
    tg = f' <span class="tag tag--{tag[0]}">{tag[1]}</span>' if tag else ""
    st = '<div class="stats">' + "".join(f"<span><b>{a}</b> {b}</span>" for a, b in stats) + "</div>"
    lk = '<div class="links">' + "".join(
        f'<a class="btn{" primary" if p else ""}" href="{u}">{n}</a>' for n, u, p in links) + "</div>"
    md = f'<details class="more"><summary>{more[0]}</summary>{more[1]}</details>'
    content = f'<div class="content">{t}<h3>{title}{tg}</h3>{body}<p class="why"><b>Why this hour.</b> {why}</p>{st}{lk}{md}</div>'
    inner = f'<div class="split">{ph(photo)}{content}</div>' if photo else f'<div class="split noimg">{content}</div>'
    return (f'<div class="stop"><span class="mark mark--{SLOT[cls]}"></span><div class="card">{inner}</div></div>')


def day(sid, dow, num, h2, route, meta, stops, place, z=12):
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


def table(head, rows, cls=""):
    h = "".join(f"<th>{c}</th>" for c in head)
    r = "".join("<tr>" + "".join(f"<td>{c}</td>" for c in row) + "</tr>" for row in rows)
    return f'<div class="tw"><table{" class=%s" % cls if cls else ""}><tr>{h}</tr>{r}</table></div>'


# ---------- warning + orientation -----------------------------------------------------
WARN = """
<section class="intro" id="warn">
  <div class="warnbar">
    <b>2026 figures used as a pattern.</b> Every price, timetable and closing date on this page is a
    2026 (or older) figure. Nothing for 2028 has been published. <span class="inf gap">GAP</span> means
    not verified; <span class="inf">inference</span> means my reasoning, not a source.
  </div>
</section>"""

AREAS = [
    ("brevent", "Aiguilles Rouges balcony", "Days 2, 4, 5",
     "Brevent, Planpraz, Flegere, Cheserys and Lac Blanc. The face-on Mont Blanc views, and the afternoon light."),
    ("midi", "Mont Blanc massif side", "Day 6",
     "Aiguille du Midi, Plan de l&rsquo;Aiguille, Montenvers and the Mer de Glace. High altitude, glacier, Grand Balcon Nord."),
    ("aiguillette", "Lower valley", "Day 3",
     "Les Houches and Servoz. The lift-free Aiguillette des Houches, and the Gorges de la Diosaz as the wet option."),
    ("balme", "Upper valley", "Days 5, 7, 8",
     "Argentiere, Le Tour, Balme, Vallorcine. Quieter base, the Col de Balme on the Swiss border, Peclerey."),
]
areas_html = "".join(
    f'<div class="area">{ph(k)}<div class="ab"><h3>{n}</h3><p class="days">{d}</p><p>{t}</p></div></div>'
    for k, n, d, t in AREAS)

ORIENT = f"""
<section class="intro" id="orient">
  <p class="kick">Before the days start</p>
  <h2>What this place physically is</h2>
  <div class="lead">
    <p>Chamonix sits at about 1,000 m in a valley running roughly north-east to south-west. On the
    south-east side is the <b>Mont Blanc massif</b>: Mont Blanc at 4,805&ndash;4,808 m, the Aiguille du Midi at
    3,842 m, the Aiguilles de Chamonix and the Mer de Glace. On the north-west side are the
    <b>Aiguilles Rouges</b>: Brevent at 2,525 m, Flegere, Lac Blanc and the Index. The two sides face each other
    across about 1,000 m of valley floor. The exact bearing of the valley is a {GAP}.</p>

    <p><b>Why it matters to a hiker.</b> The famous Chamonix views are taken from the Aiguilles Rouges,
    looking across at the massif. The Mont Blanc faces point north-west toward the valley, so they are
    back-lit in the morning and front-lit from about 14:00 to sunset (sun azimuth 190&ndash;283 degrees).
    That one fact sets the hour of most days below. The Aiguilles Rouges are named for their colour in
    early-morning light.</p>

    <p><b>What you cannot get anywhere else.</b> A cable car from 1,033 m to 3,842 m in one continuous
    rise, and a lake, Lac Blanc at 2,352 m, that mirrors the whole massif on calm evenings. You can also see
    glacier retreat measured in stairs: the Mer de Glace surface has dropped about 4&ndash;6 m a year, and the
    stair count down to the ice cave grows every season.</p>
  </div>

  <figure class="introwide">
    <img loading="lazy" src="{img(P['range'][0], 1400)}" alt="{P['range'][1]}">
    <figcaption>{P['range'][2]} &middot; <a href="{filepage(P['range'][0])}">Wikimedia Commons</a></figcaption></figure>

  <div class="areas">{areas_html}</div>
  <p class="mono smallnote">Optional reserve-day trips to Switzerland (Emosson) and Italy (Courmayeur, tunnel
  permitting) are on Day 8.</p>

  <div class="numstrip">
    <div><b>8</b><span>nights, 2 bases + 1 hut</span></div>
    <div><b>3,842 m</b><span>highest point</span></div>
    <div><b>9.8 km</b><span>longest hike (6.1 mi)</span></div>
    <div><b>2,500 m+</b><span>ascent on foot, to 2,700 summed</span></div>
    <div><b>5</b><span>lift days, EUR 173 Multipass</span></div>
    <div><b>20:09</b><span>sunset 1 Sep, 19:58 on 8 Sep</span></div>
  </div>

  <ul class="know">
    <li><b>1</b><span><b>Lifts set the calendar.</b> In 2026 the early-September timetable ran 31 Aug&ndash;13 Sep, first
      ascents about 08:30, last descents 16:45&ndash;17:00. Nobody watches sunset from a lift top station unless
      they walk down.</span></li>
    <li><b>2</b><span><b>Aiguille du Midi tickets are timed.</b> Tickets are released regularly, notably the day before
      (D-1). Multipass holders still need a slot.</span></li>
    <li><b>3</b><span><b>Afternoon storms.</b> A late-August UTMB bulletin gave &ldquo;very localized thunderstorms after
      3 PM, widespread from 5 PM to 10 PM&rdquo;. Be off exposed ground by 15:00 on unstable days. September
      frequency is a {GAP}.</span></li>
    <li><b>4</b><span><b>The guest card (carte d&rsquo;hote)</b> gives free trains between Servoz and Vallorcine only.
      Buses are discounted, not free.</span></li>
    <li><b>5</b><span><b>The valley floor loses direct sun early</b>, roughly 17:30&ndash;18:15 in September
      ({inf()}, no sourced figure). Summits keep their colour until well after the flat-horizon sunset.</span></li>
    <li><b>6</b><span><b>Correction to the brief: &ldquo;Lac de Peclerey&rdquo; does not exist.</b> No source shows a lake of
      that name. The nearest match is the Montagne de Peclerey loop above Le Tour, a mountain-pasture walk
      with no lake (Day 7).</span></li>
  </ul>
</section>"""

# ---------- answer first: how many days -----------------------------------------------
ANSWER = f"""
<section class="intro" id="answer">
  <p class="kick">The answer first</p>
  <h2>How many days</h2>
  <div class="lead">
    <p><b>Book 9 days: arrive Fri 1 Sep and leave Sat 9 Sep.</b> Seven of the nine days are usable. Every
    lift-dependent hike falls on or before Fri 8 Sep, which is ahead of the earliest likely 2028 closing Sunday
    (10 Sep). The trip also has 3 swap days for the 4 weather-critical outings.</p>
  </div>
  <ul class="plainlist">
    <li>Each length counts arrival day and departure day.</li>
    <li>From Toronto, arrival day is half usable at best. Departure day is lost to the transfer.</li>
    <li>September has about 10 rain days in 30 (climatestotravel 1991&ndash;2020 normals; seechamonix says the
    same). Over 7 usable days that is about 2&ndash;3 wet days ({inf("inference, proxy arithmetic")}).</li>
  </ul>
  {table(["Length", "Nights", "Usable days", "What it buys", "What it loses", "Value of the extra days"], [
    ["5 days<br>Fri 1 to Tue 5", "4", "3",
     "Aiguille du Midi with Grand Balcon Nord and Mer de Glace, Lac Blanc, and Brevent with Grand Balcon Sud, but only if all three days are clear",
     "No weather slack. At about 1 wet day in 3, expect to lose one headliner. Aiguille du Midi comes before any acclimatisation. 40% of the trip is travel.",
     "Baseline. The worst ratio of transatlantic cost to useful days."],
    ["7 days<br>Fri 1 to Thu 7", "6", "5",
     "The three headliners plus a Lac Blanc hut night or the lift-free Aiguillette des Houches. 1&ndash;2 swap days.",
     "No upper valley (Balme, Le Tour, Vallorcine). Thin margin if two bad days arrive back to back.",
     "<b>High.</b> Both extra days are weather insurance for three weather-dependent outings."],
    ["<b>9 days<br>Fri 1 to Sat 9</b>", "<b>8</b>", "<b>7</b>",
     "All of the above, plus the upper valley from an Argentiere base (Col de Balme, Montagne de Peclerey, Vallorcine and Emosson) and a third swap day. Every lift day falls in 2&ndash;8 Sep.",
     "Italy and Switzerland only as optional reserve-day trips. No Tour du Mont Blanc.",
     "<b>Medium.</b> Each day adds one secondary hike plus slack, all inside the safe lift window."],
    ["11 days<br>Fri 1 to Mon 11", "10", "9",
     "Adds Courmayeur and Skyway (tunnel permitting) or Emosson, and a rest day",
     "If 2028 closes on Sun 10 Sep, Mon 11 has no Brevent, Planpraz, Bellevue, Index or Vallorcine gondola. The Courmayeur day depends on the tunnel.",
     "<b>Low.</b> The extra days land on the closing weekend or on lifts that may already be shut."],
    ["14 days<br>Fri 1 to Thu 14", "13", "12",
     "A full 10&ndash;11 stage Tour du Mont Blanc with 1 buffer, or about 4 more weather days",
     "11&ndash;14 Sep may have no Brevent, Planpraz, Bellevue or Index, and the Balme and Flegere gondolas are borderline. Thu 14 may already be on autumn hours. Outdoor pool, luge and the summer bus timetable end.",
     "<b>Lowest</b> for a valley-based trip. Worth it only for the TMB, which this plan does not recommend."],
  ])}
  <div class="grid2">
    <div class="panel">
      <h3>Why 9, not 7 or 11</h3>
      <p><b>Why 9 and not 7.</b> Day 7 to day 9 is where the upper valley and a third swap day come in. Neither
      crosses the lift risk line.</p>
      <p><b>Why 9 and not 11.</b> Day 10 is the first day that could hit the 2028 closing Sunday, and day 11 the
      first that could have no Brevent or Flegere at all.</p>
      <p><b>Why arrive Fri 1 rather than Sat 2.</b> Both keep lift days before 10 Sep. Arriving on the 1st makes
      the last full day Fri 8, so even a 9 Sep surprise closure costs nothing. The departure day also catches the
      Saturday market. A UTMB on 28 Aug&ndash;3 Sep would overlap either arrival date equally (UTMB 2028 dates are a {GAP}).</p>
      <p><b>Decision rule.</b> If CMB publishes 2028 dates with the Brevent, Planpraz and Index group closing on
      17 Sep, nothing in this plan changes. You could add a day, but flights will already be bought by then.</p>
    </div>
    <div class="panel">
      <h3>The full Tour du Mont Blanc: no</h3>
      <ul>
        <li><b>Length.</b> Official site: 5&ndash;12 days, most commonly 7&ndash;10, about 170 km and close to 10,000 m of
        ascent. A 10&ndash;11 day TMB fills the whole 1&ndash;14 Sep window with no buffer.</li>
        <li><b>Lift timing works against it.</b> Starting anticlockwise from Les Houches on 2 Sep puts the Chamonix-side
        stages on about 11&ndash;13 Sep, exactly when their lift shortcuts close.</li>
        <li><b>Huts</b> close around 20 Sep. Refuge de la Croix du Bonhomme (stage 2) is closed for renovation until
        about June 2029.</li>
        <li><b>Booking.</b> 2027 bookings opened 15 Oct 2026; by the same pattern 2028 would open about 15 Oct 2027
        ({inf("inference, unpublished")}). Peak huts book 6&ndash;9 months ahead.</li>
        <li><b>Rockfall.</b> The Swiss section between Prayon and Branche (Orsieres) has been rerouted since July 2026.</li>
      </ul>
      <p><b>Hut-free alternative (recommended).</b> Walk the Chamonix side of the TMB as day hikes from valley beds:
      Grand Balcon Sud (Day 2), Flegere to Lac Blanc (Day 4), Col de Balme (Day 7). The optional Lac Blanc night matches
      the official site&rsquo;s &ldquo;2-day/1-night taster&rdquo;. A full TMB is better as its own trip in July or August.</p>
    </div>
  </div>
  <div class="panel" style="margin-top:20px">
    <h3>If you only get N days</h3>
    {table(["Days", "Keep", "Drop"], [
      ["7 (Fri 1 to Thu 7)", "Les Praz for all nights except the hut. Days 2, 4&ndash;5 and 6 as written; Day 3 becomes the swap day.", "Argentiere, Balme, Peclerey, the Day 8 reserve"],
      ["5 (Fri 1 to Tue 5)", "One base (Les Praz). Day 2 Brevent and Balcon Sud; Day 3 Aiguille du Midi with Grand Balcon Nord and Mer de Glace (acclimatisation compromised); Day 4 Lac Blanc and Cheserys as a day hike", "The hut, the Aiguillette, everything in the upper valley. On a wet day, drop the Balcon Sud first."],
      ["11 (Fri 1 to Mon 11)", "All of the 9-day plan, plus Courmayeur (tunnel permitting) and Emosson, with a rest day", "Do not put any lift-dependent day on Sun 10 or Mon 11 until the 2028 dates are out"],
    ])}
  </div>
</section>"""

# ---------- bases, light ---------------------------------------------------------------
BASES = f"""
<section class="intro" id="bases">
  <p class="kick">Where you sleep</p>
  <h2>Bases and light</h2>
  {table(["Base", "Nights", "Dates", "Why"], [
    ["<b>Les Praz</b>", "3", "Fri 1, Sat 2, Sun 3",
     "Quiet hamlet at the foot of the Flegere gondola. You walk to the lift, so the small free Flegere car park (capacity GAP; a low-quality tip says arrive by 08:30) stops mattering. On the Mont-Blanc Express line."],
    ["<b>Refuge du Lac Blanc</b> (optional)", "1", "Mon 4",
     "Evening and dawn at the lake after the day crowd has left. Half board EUR 80 pp (undated), cash only, no children under 8. If declined, take a 4th night in Les Praz."],
    ["<b>Argentiere</b>", "4", "Tue 5 &ndash; Fri 8",
     "Upper valley, quieter than Chamonix, on the train line. Col de Balme and Le Tour are close. Only small grocery shops."],
  ])}
  <p><b>Not Chamonix centre.</b> Parking is EUR 19.90 per 24 h (chamonix.net says EUR 22.50, a conflict),
  evenings are busy and the noise is unsourced but likely ({inf()}). The stay research recommends a quiet hamlet as the main base.</p>
  <p>Prices are proxies (2026, aggregators): holiday rentals average EUR 159 a weeknight and EUR 218 a weekend night
  (Kayak), with September the cheapest rental month. The average 3-star hotel is about EUR 132 (Skyscanner,
  inconsistent). Tourist tax rates are being reset for 1 Jan 2027, so no current figure exists ({GAP}).</p>
  <h3 class="subh">Light, 45.92 N 6.87 E, CEST</h3>
  {table(["Date", "Civil dawn", "Sunrise (flat)", "Sunset (flat)", "Civil dusk", "Summit colour, evening"], [
    ["Fri 1 Sep", "06:23", "06:53&ndash;06:54", "20:09&ndash;20:12", "20:40", "20:31&ndash;20:43"],
    ["Thu 7 / Fri 8 Sep", "06:30", "07:01", "19:58", "20:28", f"about 20:17&ndash;20:30 ({inf('interpolated')})"],
    ["Thu 14 Sep", "06:40", "07:09&ndash;07:10", "19:44&ndash;19:47", "20:14", "20:05&ndash;20:17"],
  ])}
  <p class="smallnote">The three research files agree within about 3 minutes. Times assume a flat horizon. Direct sun on the
  valley floor arrives later and leaves earlier (no sourced valley-floor figure). Daylight drops from about 13 h 18 m
  to 12 h 38 m across the window.</p>
</section>"""

# ---------- days ----------------------------------------------------------------------
LIFTNOTE = "2026 prices"

D1 = day("d1", "Fri", "1", "Arrive, settle in Les Praz",
         "GVA or ZRH &#8594; Les Praz &#8594; flat walk to Chamonix",
         [("Base", "Les Praz"), ("Lifts", "none"), ("Altitude", "~1,000 m")],
         [stop(2, "Fri 1 &middot; arrival", "Check in, guest cards, groceries, a flat evening walk", None,
               "<p>From GVA it is 80&ndash;90 min by road. From ZRH, the nonstop lands 06:30 (2024 SWISS times), then 2h45 by train to "
               "Geneva (unsourced), then the shuttle. A valley arrival around midday is plausible but unverified. Check in and collect a "
               "guest card per person. Super U Les Pelerins is open daily; Carrefour Chamonix is open Sunday until 12:30.</p>"
               "<p>Evening: a flat walk into Chamonix, then watch the summit colour on Mont Blanc from the valley, about 20:12&ndash;20:43. "
               "The Musee du Mont-Blanc runs 10:00&ndash;13:00 and 14:00&ndash;18:00 and is closed Tuesdays (one source gives afternoons only in "
               "September, a conflict).</p>",
               [("0 km", "walk, flat"), ("0 m", "ascent"), ("EUR 0", "lifts"), ("none", "booking")],
               [("Map &mdash; Les Praz", mapq("Les Praz de Chamonix"), True),
                ("Map &mdash; GVA to Les Praz", dirq("Geneva Airport", "Les Praz de Chamonix, France"), False)],
               "praz",
               "No lifts and no altitude on a jet-lagged day.",
               ("Transfer options (2026 prices)",
                "<ul><li>Shared shuttle EUR 28&ndash;55 pp, 80&ndash;90 min.</li><li>Private transfer EUR 150&ndash;250 per vehicle.</li>"
                "<li>Scheduled coach EUR 11&ndash;20, first 04:00, last 20:00.</li><li>Train: price GAP, 2&ndash;2.5 h via St-Gervais-Le Fayet.</li></ul>"
                "<p><b>Wet-weather swap.</b> None needed; nothing is committed today.</p>"))],
         "Les Praz de Chamonix", 13)

D2 = day("d2", "Sat", "2", "Brevent, then the Grand Balcon Sud home",
         "Chamonix &#8594; Planpraz &#8594; Brevent &#8594; Balcon Sud &#8594; Flegere &#8594; Les Praz",
         [("Walk", "5.5 km / 3.4 mi"), ("Top", "2,525 m"), ("Booking", "none")],
         [stop(1, "10:00 &middot; Planpraz gondola", "Brevent summit, lunch, Grand Balcon Sud", ("easy", "no booking"),
               "<p>Planpraz gondola from Chamonix at 10:00, the Brevent cable car to 2,525 m, lunch at Planpraz, then walk "
               "12:30&ndash;15:00 and take the Flegere gondola down by 17:00 at the latest. The Brevent summit in late morning is side-lit, "
               "not ideal light, but it is the widest panorama in the valley. <b>&ldquo;Sunset from Brevent&rdquo; does not work in "
               "September:</b> the last descent is 16:45.</p>",
               [("5.5 km / 3.4 mi", "Planpraz to Flegere"), ("+300&ndash;350 m", "loopi 299, AllTrails 346"), ("2&ndash;2.5 h", "walking"),
                ("EUR 25 + 43 + 19", "Planpraz return, Brevent return, Flegere one way")],
               [("Map &mdash; Brevent", mapq("Le Brevent cable car", "Chamonix"), True),
                ("Map &mdash; day route", dirq("Planpraz, Chamonix, France", "Le Brevent, Chamonix, France", "La Flegere, Chamonix, France", "Les Praz de Chamonix, France"), False),
                ("Lift dates", "https://www.chamonix.net/english/lift-systems/dates-times", False)],
               "gbsud",
               "Walking toward Flegere ends the day at your own door, so there is no dash for the last Planpraz descent. It puts the walk in the "
               "early afternoon, when the massif turns from side-lit to front-lit. Moderate effort for jet legs, and 2,525 m starts the altitude "
               f"ladder toward Day 6 ({inf('no sourced acclimatisation schedule')}).",
               ("Decision rule, hazards, wet-weather swap",
                "<p><b>Last descents (2026):</b> Brevent 16:45, Planpraz 17:00, Flegere 17:00. All lifts are covered by the Multipass.</p>"
                "<p><b>Weather rule.</b> If cloud sits on Brevent at 09:00 but the forecast clears after midday, skip the summit and walk only the Balcon. "
                "If it is raining, swap with Day 3&rsquo;s wet option or the Montenvers part of Day 6.</p>"
                "<p><b>Hazards.</b> Steep pegged steps with a handrail about 1 km in; no exit points once you are walking.</p>"
                "<p><b>Wet-weather swap.</b> Montenvers train and the ice cave (works in cloud), plus the Musee du Mont-Blanc.</p>"))],
         "Le Brevent, Chamonix", 12)

D3 = day("d3", "Sun", "3", "Aiguillette des Houches, no lift",
         "Merlet car park &#8594; Aiguillette des Houches and back",
         [("Walk", "9.8 km / 6.1 mi"), ("Ascent", "+765 m"), ("Lift", "none")],
         [stop(2, "10:00 stable &middot; 08:00 unstable", "Aiguillette des Houches", ("added", "lift-free insurance"),
               "<p>Official figure 9.8 km (6.1 mi), +765 m, 4 h return, 1,520 m to 2,285 m. Other figures: 12 km (7.5 mi) and +1,000 m "
               "(a second official listing); 9.1 km and +910 m (randos-montblanc). On a stable forecast start at 10:00 from the Merlet "
               "car park and be on top 12:30&ndash;14:00 for better light. Unstable: start 08:00 and be down by 13:00.</p>",
               [("9.8 km / 6.1 mi", "official"), ("+765 m", "ascent"), ("4 h", "return"), ("EUR 0", "lifts"), ("none", "booking")],
               [("Map &mdash; Aiguillette", mapq("Aiguillette des Houches", "Les Houches"), True),
                ("Map &mdash; Merlet car park", mapq("Parc de Merlet", "Les Houches"), False)],
               "aiguillette",
               "Sunday has no lift queues on the weekend&rsquo;s busiest lift day, and it saves the lift days for weekdays. It is the lift-free "
               "insurance day: if Day 2 failed, it can swap with Day 2.",
               ("Car-free, extension, wet-weather swap",
                "<p><b>Booking and parking.</b> Parc de Merlet was closed all of 2027; its 2028 status and the car park&rsquo;s capacity are GAPs.</p>"
                "<p><b>Car-free.</b> The nearest station is Les Houches, which adds a climb to the start (amount GAP). Without a car, take Day 8&rsquo;s "
                "Chapeau hike instead.</p>"
                "<p><b>Extension.</b> Bellachat refuge and Brevent for strong walkers.</p>"
                "<p><b>Wet-weather swap.</b> <a href=\"https://en.chamonix.com/activities/hiking/hiking-trails/gorges-de-la-diosaz\">Gorges de la Diosaz</a> "
                "at Servoz: 09:30&ndash;18:15 in September 2026, EUR 7.50, 1&ndash;1.5 h. It closes when there is rockfall risk. Pair it with the indoor pool "
                "(Richard Bozon, EUR 7.90 or EUR 6.30 with the guest card) or the QC Terme spa (day pass EUR 52, no under-14s).</p>"))],
         "Aiguillette des Houches", 12)

D4 = day("d4", "Mon", "4", "Flegere, Cheserys, Lac Blanc, hut night",
         "Les Praz &#8594; Argentiere (bags) &#8594; Flegere &#8594; Lacs de Cheserys &#8594; Lac Blanc",
         [("Walk", "~7.8 km loop / 4.8 mi"), ("Ascent", "+570 m"), ("Hut", "optional")],
         [stop(3, "12:00 &middot; at the lake by 15:00", "Lac Blanc by the ladders, then the hut", ("unmissable", "book the hut"),
               "<p>09:00 check out; drop bags at the Argentiere lodging (by car or free train) and ask them to store them; be back at the Flegere "
               "gondola by 11:30. Flegere (1,877 m) via the Lacs de Cheserys, then up the ladders to Lac Blanc (2,352 m). The full "
               "Flegere-Cheserys-Lac Blanc loop is 7.8 km (4.8 mi), +570 m round trip (randos-montblanc). This day walks the climbing half and "
               f"Day 5 walks the direct descent; the split distance is {inf()}.</p>",
               [("7.8 km / 4.8 mi", "full loop"), ("+570 m", "round trip"), ("EUR 19", "Flegere one way up"), ("EUR 80 pp", "hut half board, cash"),
                ("~40 places", "booking by phone after 31 May")],
               [("Map &mdash; Lac Blanc", mapq("Lac Blanc", "Chamonix"), True),
                ("Map &mdash; route", dirq("La Flegere, Chamonix, France", "Lacs de Cheserys, Chamonix, France", "Lac Blanc, Chamonix, France"), False),
                ("Hut", "https://www.refugedulacblanc.fr", False),
                ("AllTrails &mdash; Cheserys", "https://www.alltrails.com/poi/france/haute-savoie/chamonix-mont-blanc/lacs-des-cheserys", False)],
               "lacblanc",
               "You reach the lake at 15:00, ahead of the storm window, and more than 2 hours before sunset (about 20:05), which is the "
               "photographers&rsquo; rule for calm water. Golden light on the massif runs about 17:30&ndash;19:30. Monday is a weekday, and the day crowd leaves on the last gondola anyway.",
               ("Booking, decision rules, hazards, wet-weather swap",
                "<p><b>Booking.</b> Refuge du Lac Blanc: online via refugedulacblanc.fr until 31 May, then by phone only "
                "(<a href=\"tel:+33767567414\">07 67 56 74 14</a>). About 40 places, half board only, cash only, no children under 8. "
                "The 2028 booking opening date is a GAP; book the day it opens. Cancellation terms are a GAP.</p>"
                "<p><b>Weather rule.</b> If storms are forecast from early afternoon, skip Cheserys and take the direct route: Flegere to Lac Blanc, "
                "about half of the official 7 km / +500 m return route, 1h45 up. Decide the hut night itself 48 h out.</p>"
                "<p><b>Hut-free version.</b> Walk the 7.8 km loop as a day hike from Les Praz, back on the Flegere gondola by 17:00 "
                "(last ascent 16:30), and keep the 4th night in Les Praz.</p>"
                "<p><b>Hazards.</b> Ladders on the Cheserys-Lac Blanc stretch are exposed. Climb them on this day rather than descending them. "
                "Swimming is banned by prefectural order, and dogs are banned in the reserve.</p>"
                "<p><b>Wet-weather swap.</b> Cascade de Berard from Le Buet (Vallorcine): 3.8 km (2.4 mi), +203 m, 1h40, by train or bus.</p>"))],
         "Lac Blanc, Chamonix", 13)

D5 = day("d5", "Tue", "5", "Dawn at Lac Blanc, down, move to Argentiere",
         "Lac Blanc &#8594; Flegere &#8594; Les Praz &#8594; Argentiere",
         [("Descent", "~3.5 km / 2.2 mi"), ("Drop", "-500 m"), ("Museum", "shut Tuesday")],
         [stop(1, "~06:30 &middot; dawn", "Dawn on the lake, direct path down, move base", ("easy", "short day"),
               f"<p>First colour on the high summits is about 06:28&ndash;06:40 ({inf('interpolated between 1 and 14 Sep')}). From here Mont Blanc itself "
               "is back-lit at dawn; the colour is on the Aiguille Verte and Drus side. Then Lac Blanc to Flegere by the direct path, about "
               f"3.5 km (2.2 mi), -500 m, 1&ndash;1.5 h ({inf('from the official route')}), the Flegere gondola down, collect anything left in Les Praz, and continue to "
               "Argentiere. Shop on the way: Argentiere has only small grocers.</p>",
               [("3.5 km / 2.2 mi", "descent"), ("-500 m", "drop"), ("EUR 19", "Flegere one way down"), ("none", "booking")],
               [("Map &mdash; Lac Blanc", mapq("Lac Blanc", "Chamonix"), True),
                ("Map &mdash; Argentiere", mapq("Argentiere"), False)],
               "lacblanc2",
               "Dawn is the one hour the hut night buys that a day hike cannot. The afternoon is short on purpose, to rest before Day 6.",
               ("Optional, wet-weather swap",
                "<p><b>Optional (only if fresh and clear).</b> Col de Balme from Le Tour, which gets Day 7&rsquo;s main sight in early.</p>"
                "<p><b>Wet-weather swap.</b> Descend early and spend the afternoon at the cinema (Cinema Vox adds afternoon showings on bad-weather days) or at the spa.</p>"
                "<p>The Musee du Mont-Blanc is closed Tuesdays.</p>"))],
         "Argentiere", 13)

D6 = day("d6", "Wed", "6", "Aiguille du Midi, Grand Balcon Nord, Mer de Glace",
         "Chamonix &#8594; Aiguille du Midi &#8594; Plan de l&rsquo;Aiguille &#8594; Montenvers &#8594; train down",
         [("Summit", "3,842 m"), ("Walk", "5.7 km / 3.5 mi"), ("Slot", "timed")],
         [stop(3, "08:10 &middot; first cabin", "Aiguille du Midi, then the Grand Balcon Nord to Montenvers", ("unmissable", "timed slot"),
               "<p>First cabin 08:10 (2026, 31 Aug&ndash;13 Sep band; last ascent 16:00). Summit until about 10:00, back down to Plan de l&rsquo;Aiguille "
               "(2,310 m), walk about 10:30&ndash;13:30, Montenvers 13:30&ndash;16:00, train down by 16:30. Grand Balcon Nord, Plan de l&rsquo;Aiguille to "
               "Montenvers: 5.7 km (3.5 mi), +140 m / -523 m, 2h30 (official).</p>",
               [("5.7 km / 3.5 mi", "Balcon Nord"), ("+140 / -523 m", "ascent / descent"), ("EUR 83 + 42", "Midi return, Montenvers package"),
                ("D-1", "Midi slot release")],
               [("Map &mdash; Aiguille du Midi", mapq("Aiguille du Midi", "Chamonix"), True),
                ("Map &mdash; day route", dirq("Aiguille du Midi, Chamonix, France", "Plan de l'Aiguille, Chamonix, France", "Montenvers, Chamonix, France"), False),
                ("Aiguille du Midi", "https://en.chamonix.com/activities/practical-information-about-the-lifts/aiguille-du-midi-cable-car", False),
                ("Montenvers", "https://en.chamonix.com/activities/practical-information-about-the-lifts/the-montenvers-mer-de-glace-train", False)],
               "midi",
               "The air is clearest in the morning and convection builds in the afternoon. The Vallee Blanche is lit from the east. You have climbed "
               f"through 2,525 m and slept at 2,352 m, so this is not the first altitude day ({inf('no sourced acclimatisation guidance')}). "
               "Midweek is quieter than the weekend (anecdotal).",
               ("Booking, cut-off, hazards, decision rule",
                "<p><b>Booking.</b> Timed slot online, with new tickets released D-1; same-day box office subject to availability. Pass holders must reserve too. "
                "GAP: whether a summit return lets you get off at the mid-station. Ask; the official &ldquo;North Balcony package&rdquo; is EUR 68.40. "
                "Both lifts are covered by the Multipass.</p>"
                "<p><b>Weather rule.</b> At 07:00, check the Meteo-France Chamonix bulletin and the summit. If it is clouded in, move this day to Day 7 or Day 8 and do Day 7 now.</p>"
                "<p><b>Cut-off.</b> If you are not past Signal Forbes by 13:00, skip the cave and catch the train. The last train from the summit was 16:30 in 2026.</p>"
                f"<p><b>Cold.</b> Summit estimated -9 to +1 C before wind chill, from a standard lapse rate ({inf()}). Bring gloves and a hat.</p>"
                "<p><b>Hazards.</b> The ride gains about 2,800 m in one go. Altitude symptoms can appear from about 2,500 m on a fast ascent (third-party source). "
                "Children under 3 are not allowed and under 5 is not recommended. On the walk take the <b>right</b> fork at 2,071 m via Signal Forbes (2,198 m); "
                "the left shortcut goes through couloirs the tourist office calls dangerous in snow. At Montenvers the stairs down to the ice cave are given as "
                "100, 200, about 430&ndash;440 and about 580 steps in different sources, metal openwork, and the climb back up is the hard part. "
                "Do not walk out onto the ice beyond the cave: in September the bare ice and crevasses are most exposed.</p>"
                "<p><b>Wet-weather swap.</b> Montenvers and the ice cave alone, which works in cloud.</p>"))],
         "Aiguille du Midi", 12)

D7 = day("d7", "Thu", "7", "Col de Balme, then Montagne de Peclerey",
         "Le Tour &#8594; Charamillon gondola &#8594; Col de Balme &#8594; Peclerey loop",
         [("Col", "2,191 m"), ("Peclerey", "6.7 km / 4.2 mi"), ("Border", "Swiss, carry ID")],
         [stop(1, "09:00 &middot; first lift", "Col de Balme, then Peclerey if stable", ("added", "added"),
               "<p>09:00 Charamillon gondola and Autannes chairlift from Le Tour; at the col by about 09:45. Col de Balme (2,191 m) is about 20 min on a wide track "
               "from the top of the lift (10Adventures route 4.8 km / 3.0 mi, +81 m). Peclerey 13:00&ndash;16:30 only if the forecast is stable: Montagne de Peclerey loop from Le Tour or "
               "Le Planet, 6.7 km (4.2 mi), +630 m, 3h20, high point Tete du Grand Chantet 1,967 m, no lift.</p>",
               [("4.8 km / 3.0 mi", "Balme route"), ("+81 m", "Balme"), ("6.7 km / 4.2 mi, +630 m", "Peclerey"), ("price GAP", "Balme lift, Multipass covers it")],
               [("Map &mdash; Col de Balme", mapq("Col de Balme", "Le Tour"), True),
                ("Map &mdash; Peclerey", mapq("Montagne de Peclerey", "Le Tour"), False)],
               "balme",
               "The col looks down the valley toward Mont Blanc, which means looking into the sun in the afternoon, so go in the morning. "
               "In 2025 the Balme lifts closed 14 Sep and in 2026 on 20 Sep, so Thursday is safe under either pattern.",
               ("Harder option, weather rule, wet-weather swap",
                "<p><b>Lifts (2026).</b> First 09:00, last return ascent 16:30, last descent 17:00. The Swiss border is at the col (Schengen; carry ID).</p>"
                "<p><b>Harder option.</b> Refuge Albert 1er from the col: 8 km (5.0 mi) on the official page, +511 m, difficult, 3h15 one way, at the edge of the Glacier du Tour. "
                "Whether 8 km is one way or return is a GAP.</p>"
                "<p><b>Weather rule.</b> Unsettled: do only Balme and be off by 13:00. Rain: swap with Day 8.</p>"
                "<p><b>Wet-weather swap.</b> Lac d&rsquo;Emosson by train (Day 8), or Cascade de Berard.</p>"))],
         "Col de Balme", 12)

D8 = day("d8", "Fri", "8", "Reserve day",
         "Use it in this order: a skipped headliner first, then one option below",
         [("Priority", "Midi, Lac Blanc, Brevent"), ("Last lift day", "likely"), ("Tomorrow", "travel")],
         [stop(4, "Fri 8 &middot; flexible", "Skipped headliner, or one of four options", ("added", "reserve"),
               "<p>First any skipped headliner (Aiguille du Midi, Lac Blanc, Brevent). Then one of: <b>Lac d&rsquo;Emosson</b> (Switzerland); <b>the Chapeau from "
               "Les Tines</b> (5.3 km / 3.3 mi, +503 m, 2h40, no lift, close to Argentiere, a viewpoint over the Mer de Glace side); a <b>tandem paraglide from Planpraz</b>; "
               "or <b>Courmayeur</b>, only if the tunnel is open. Keep this day light; tomorrow is travel.</p>",
               [("5.3 km / 3.3 mi", "Chapeau"), ("+503 m", "Chapeau"), ("EUR 100&ndash;148", "paraglide, 15&ndash;20 min"), ("EUR 59 return", "Skyway, low season")],
               [("Map &mdash; Chapeau", mapq("Le Chapeau", "Les Tines", "Chamonix"), True),
                ("Map &mdash; Emosson route", dirq("Vallorcine", "Le Chatelard, Switzerland", "Lac d'Emosson, Switzerland"), False)],
               "bossons",
               "It is the last full day and the last day before the likely lift closing weekend, so a miss on Day 2, 4 or 6 can still be repaired here. "
               "Nothing is booked on it, because the forecast decides.",
               ("Details for each option",
                "<ul><li><b>Lac d&rsquo;Emosson.</b> Mont-Blanc Express to Le Chatelard, changing at Vallorcine (about 1 h from Chamonix). Then VerticAlp Emosson: funicular every 30 min "
                "08:35&ndash;16:05 (2026), then a panoramic train to the dam (1,930 m). Price GAP; pay in CHF; the guest card does not cover anything beyond Vallorcine. "
                "The dam was open until 31 Oct in 2026.</li>"
                "<li><b>Tandem paraglide.</b> Minimum age 4&ndash;12 depending on the operator; weight cap about 100&ndash;120 kg. Wind-dependent; book ahead with flexibility. "
                "One operator flew daily until 13 Sep in 2026.</li>"
                "<li><b>Courmayeur.</b> Last return departures were 14:30 from 8 Sep in 2025 and 13:45 from 7 Sep in 2026, so this is a morning-only option.</li></ul>"))],
         "Vallorcine", 12)

D9 = day("d9", "Sat", "9", "Home",
         "Argentiere &#8594; Saturday market &#8594; GVA",
         [("Transfer", "80&ndash;90 min"), ("Market", "to ~13:00"), ("Buffer", "Saturday traffic")],
         [stop(2, "Sat 9 &middot; transfer", "Market if the flight is late, then the airport", None,
               "<p>If the flight leaves late afternoon, the Chamonix Saturday market runs about 07:00/08:00&ndash;13:00 on Place du Mont-Blanc. The transfer to GVA takes "
               "80&ndash;90 min from Chamonix (Argentiere adds time; GAP). Allow a margin for Saturday traffic.</p>",
               [("80&ndash;90 min", "to GVA"), ("EUR 28&ndash;55", "shared shuttle pp"), ("EUR 0", "lifts"), ("none", "booking")],
               [("Map &mdash; Argentiere to GVA", dirq("Argentiere, France", "Geneva Airport"), True),
                ("Map &mdash; market", mapq("Place du Mont-Blanc", "Chamonix"), False)],
               "gare",
               "Departure day is lost to the transfer, so nothing else is scheduled. The only fixed point is the flight.",
               ("Homebound routing",
                "<p>Recommendation: nonstop to ZRH outbound, one-stop from GVA on the way home, if fares are close. A 09:55 ZRH departure cannot be reached from Chamonix "
                "the same morning, and would cost Day 8 as a transfer to Zurich.</p>"))],
         "Argentiere", 12)

DAYS = D1 + D2 + D3 + D4 + D5 + D6 + D7 + D8 + D9

# ---------- weather rule + getting there ------------------------------------------------
WEATHER = f"""
<section class="intro" id="rules">
  <p class="kick">Each evening at 18:00</p>
  <h2>Daily weather decision rule</h2>
  <div class="lead"><p>Read the Meteo-France Chamonix bulletin (<a href="https://en.chamonix.com/meteo">en.chamonix.com/meteo</a>)
  and MeteoBlue, then sort tomorrow. The hut night is the one fixed piece; decide it 48 h out.</p></div>
  {table(["Forecast", "Do"], [
    ["Clear and stable", "Aiguille du Midi, if not done yet"],
    ["Clear morning, storms after 15:00", "Morning lift hikes (Brevent, Lac Blanc), off exposed ground by 15:00"],
    ["Cloud above about 2,500 m but dry", "The Balcon Sud, the Aiguillette or Peclerey (below the cloud)"],
    ["Rain", "The wet list: Montenvers and ice cave, Musee du Mont-Blanc, Gorges de la Diosaz, Cascade de Berard, pool or spa"],
  ])}
</section>"""

GETTING = f"""
<section class="intro" id="getting">
  <p class="kick">Logistics and money</p>
  <h2>Getting there and around</h2>
  <div class="grid2">
    <div class="panel">
      <h3>Flights from YYZ</h3>
      <ul>
        <li><b>No Toronto-Geneva nonstop.</b> None found for 2026: Air Canada flies Montreal-Geneva, not Toronto.</li>
        <li><b>Toronto-Zurich is nonstop.</b> Air Canada daily (787-9, 2026). SWISS is seasonal, 5 weekly in summer 2026; 2024 times were YYZ 16:35 to ZRH 06:30 and ZRH 09:55 to YYZ 13:00. Flight time 8h50&ndash;9h15.</li>
        <li><b>2028 on sale</b> about 11 months out, roughly Sep&ndash;Oct 2027.</li>
        <li><b>Fare snapshot.</b> Air Canada showed &ldquo;from CAD 968&rdquo; to Geneva. A snapshot only (2026).</li>
        <li><b>Recommendation:</b> nonstop to ZRH outbound, one-stop from GVA home, if fares are close. GAP: one-stop routings, ZRH-Chamonix door-to-door time, fares.</li>
        <li><b>Avoid Milan Malpensa.</b> No Toronto nonstop and it depends on the tunnel.</li>
      </ul>
    </div>
    <div class="panel">
      <h3>Rental car and entry</h3>
      <ul>
        <li>Leaving from the Swiss side of GVA needs the Swiss motorway vignette (CHF 40, 2026). On-the-spot fine CHF 200 plus the vignette price. Swiss-side rentals usually include it; French-sector rentals do not.</li>
        <li>Crit&rsquo;Air sticker rules for Chamonix: GAP. Check <a href="https://certificat-air.gouv.fr">certificat-air.gouv.fr</a> before travel.</li>
        <li>ETIAS has slipped to 2027 with no firm date; fee EUR 20. Verify about 6 months out.</li>
        <li>Roaming passes cost CAD 50&ndash;75 for 14 days (Telus, Bell, Rogers, 2026).</li>
        <li>Offline maps: AllTrails offline needs Plus (about USD 36 or EUR 30 a year). The tourist office route pages give a free GPX per hike.</li>
      </ul>
    </div>
    <div class="panel">
      <h3>Mont Blanc tunnel (Courmayeur only)</h3>
      <ul>
        <li>In Jan 2026 ATMB said 2027 and 2028 repeat the autumn closure model: one cycle of about 3.5 months (15 weeks) each autumn.</li>
        <li>The 2025 closure ran <b>1 Sep to 12 Dec</b>. The 2028 start date is unpublished.</li>
        <li><b>Assume the tunnel may be shut for the whole trip.</b> Then there is no bus to Courmayeur and no practical day trip. Alternatives: the Great St Bernard tunnel or the Little St Bernard pass (drive times GAP), or the lift chain Aiguille du Midi, Panoramic Mont-Blanc (EUR 125.50, morning only, not on the Multipass), then Skyway down.</li>
        <li>When open: toll about EUR 56.40 one way or EUR 70.40 return (valid 7 days); bus 35&ndash;50 min (EUR 9&ndash;35).</li>
        <li>Check atmb.com in early 2027 and again about 12 months out.</li>
      </ul>
    </div>
    <div class="panel">
      <h3>In the valley</h3>
      <ul>
        <li><b>Guest card</b> (<a href="https://en.chamonix.com/la-carte-d-hote">official page</a>): free from your host, one per person. Free Mont-Blanc Express between Servoz and Vallorcine only; St-Gervais and the Swiss section are not covered. <b>Buses are not free.</b> Discount on passes of 2+ days (2-day EUR 5 instead of EUR 9; weekly EUR 10 instead of EUR 18); none on single rides or night buses after 21:00. Validate on every boarding.</li>
        <li><b>Timetables.</b> The summer bus timetable ended 6 Sep in 2026 and the Mont-Blanc Express summer timetable 13 Sep (2028: GAP). The Chamo&rsquo;nuit night bus ran Les Houches-Argentiere every 45 min, 20:50&ndash;midnight.</li>
      </ul>
    </div>
  </div>

  <div class="panel" style="margin-top:20px">
    <h3>Multipass or single tickets (2026, adult)</h3>
    <p>The plan uses lifts on 5 separate days: Days 2, 4, 5, 6 and 7. Single tickets come to EUR 250+ before the Balme lift.</p>
    {table(["Day", "Lifts", "Single tickets (EUR)"], [
      ["2", "Planpraz return + Brevent cable car return + Flegere one way", "25 + 43 + 19"],
      ["4", "Flegere one way up", "19"],
      ["5", "Flegere one way down", "19"],
      ["6", "Aiguille du Midi return + Montenvers hiking package", "83 + 42"],
      ["7", "Balme", "price GAP"],
    ])}
    <p>Multipass, consecutive days: EUR 98 for 1 day, 113 for 2, 128 for 3, 173 for 6. Non-consecutive: 2 days for EUR 128, 5 days within 15 days for EUR 173.
    Child and senior 6-day pass EUR 147.10. Hands-free card EUR 3.</p>
    <p><b>Buy the 5-day non-consecutive pass (EUR 173).</b> It still fits if Aiguille du Midi moves to Day 8. It also covers the Skyway and the Tramway, works as a bus ticket, and excludes Panoramic Mont-Blanc.</p>
  </div>

  <div class="panel" style="margin-top:20px">
    <h3>Budget (2026 figures, sourced only)</h3>
    {table(["Item", "2026 figure"], [
      ["Multipass, 5 non-consecutive days", "EUR 173 adult; EUR 3 hands-free card"],
      ["Refuge du Lac Blanc half board", "EUR 80 pp (undated), cash"],
      ["GVA transfer", "Shared EUR 28&ndash;55 pp; private EUR 150&ndash;250 per vehicle; coach EUR 11&ndash;20"],
      ["Lodging (aggregator averages)", "Rentals EUR 159 a weeknight / EUR 218 a weekend night; 3-star about EUR 132"],
      ["Chamonix parking", "EUR 19.90 per 24 h (or EUR 22.50 per chamonix.net)"],
      ["Tunnel toll (if used)", "EUR 56.40 one way / EUR 70.40 return"],
      ["Skyway (optional)", "EUR 59 return"],
      ["Paragliding (optional)", "About EUR 100&ndash;148"],
      ["Roaming", "CAD 50&ndash;75 for 14 days"],
      ["ETIAS", "EUR 20"],
      ["Flights", "Snapshot &ldquo;from CAD 968&rdquo; to GVA (Air Canada page; not a 2028 fare)"],
    ])}
  </div>
</section>"""

# ---------- deadlines, closures, hazards, gotchas --------------------------------------
DEADLINES = f"""
<section class="intro" id="deadlines">
  <p class="kick">What to do, and when</p>
  <h2>Deadlines</h2>
  {table(["When", "What"], [
    ["Early 2027, again about Sep 2027", "ATMB 2028 tunnel calendar (decides whether Courmayeur is possible at all)"],
    ["When announced", "UTMB 2028 dates (montblanc.utmb.world). If 28 Aug&ndash;3 Sep, book lodging immediately."],
    ["About Sep&ndash;Oct 2027", "Summer 2028 flights on sale; decide ZRH vs GVA; book a rental car if wanted"],
    [f"At flight purchase ({inf()})", "Lodging in Les Praz and Argentiere on free-cancellation rates. Agency short breaks often have a 4-night minimum."],
    [f"About 15 Oct 2027 ({inf('from the 2026 and 2027 openings')})", "TMB booking platform opens for 2028. Only relevant if you change your mind on the TMB."],
    ["As soon as it opens (date GAP)", "Refuge du Lac Blanc, online until 31 May 2028 and by phone after"],
    ["Spring 2028", "CMB publishes 2028 lift dates; confirm nothing falls before 9 Sep"],
    ["About Mar 2028", "ETIAS status and passport validity"],
    ["At booking", "Travel medical cover including mountain rescue, helicopter evacuation and repatriation. French state helicopter rescue is generally free, but doctor and hospital bills are charged; Italian and Swiss rescue charges are a GAP."],
    ["About 30 Aug 2028", "Conditions re-check routine (trip-planner Phase 2; not yet scheduled)"],
    ["D-1 and the evening before Day 6", "Aiguille du Midi timed slot (D-1 release; same-day box office as fallback)"],
  ])}
</section>"""

CLOSED = f"""
<section class="intro" id="closed">
  <p class="kick">2026 patterns, not 2028 dates</p>
  <h2>Closed or changing in the window</h2>
  {table(["Item", "2026 pattern", "Effect on 2028"], [
    ["Prarion gondola (Les Houches)", "Closed after 6 Sep (7 Sep in 2025)", "Not used"],
    ["Brevent, Planpraz, Bellevue, Index, Vallorcine gondola, Bossons chairlift", "Closed after 13 Sep (14 Sep in 2025, 15 Sep in 2024)", f"Likely 10 or 17 Sep ({inf()}). All plan days fall before."],
    ["Flegere gondola", "To 20 Sep (21 Sep in 2025)", "Safe"],
    ["Balme (Le Tour side)", "To 20 Sep (14 Sep in 2025)", "Day 7 safe under both patterns"],
    ["Aiguille du Midi", "31 Aug&ndash;13 Sep first 08:10, last ascent 16:00; autumn hours from 14 Sep", "No 06:10 starts in September"],
    ["Montenvers / Mer de Glace gondola", "Gondola 10:00&ndash;16:30 to 13 Sep; cave closed 17 Oct&ndash;1 Nov", "Safe"],
    ["Panoramic Mont-Blanc", "09:00&ndash;13:45 from 7 Sep", "Morning only"],
    ["Skyway", "2025: 08:30&ndash;14:30 from 8 Sep", "Morning only"],
    ["Mont Blanc tunnel", "2025 closure from 1 Sep; 2028 start GAP", "Courmayeur may be impossible"],
    ["Grands Montets", "Closed summers 2025 and 2026", "2028 GAP; not in the plan"],
    ["Parc de Merlet", "Closed all of 2027", "2028 GAP; Aiguillette car park status unclear"],
    ["Refuge de la Croix du Bonhomme", "Closed until about June 2029", "TMB only"],
    ["TMB Prayon-Branche (Orsieres)", "Rerouted for rockfall since Jul 2026", "TMB only"],
    ["Valley buses, Mont-Blanc Express summer timetables", "Ended 6 Sep and 13 Sep", "Thinner service late in the trip"],
    ["Outdoor pool, luge", "Outdoor pool to 13 Sep; luge weekends only from 15 Sep", "Fine"],
    ["Musee du Mont-Blanc", "Closed Tuesdays", "Day 5 is a Tuesday"],
    ["French school rentree", "About 1&ndash;4 Sep (2028&ndash;29 calendar GAP)", "Families leave; quieter"],
    ["Jeune genevois", "Thu 7 Sep 2028 (derived, verify)", "May affect Geneva shops"],
    ["Mont-Blanc Express fleet", "New trains phased in to autumn 2027", "Possible disruption"],
  ])}
  <p class="smallnote"><a href="https://www.chamonix.net/english/lift-systems/dates-times">chamonix.net lift dates and times</a> is the source for most lift rows.</p>
</section>"""

HAZARDS = """
<section class="intro" id="hazards">
  <p class="kick">Physical risk</p>
  <h2>Hazards and gotchas</h2>
  <div class="grid2">
    <div class="panel">
      <h3>Hazards</h3>
      <ul>
        <li><b>Altitude, Aiguille du Midi.</b> A rise of about 2,800 m in one ride. Symptoms (nausea, dizziness, fatigue, rapid pulse) can start from about 2,500 m, and fitness is no protection (third-party source). Keep the visit short if you feel unwell. GAP: official medical guidance; see a doctor if anyone has a heart condition or is pregnant.</li>
        <li><b>Cold.</b> The summit is near or below 0 C in a normal September (estimated -9 to +1 C before wind chill).</li>
        <li><b>Mer de Glace stairs.</b> Sources give 100 to about 580 steps. Metal openwork, steep, not wheelchair-accessible. The count grows each year. Stay off the open ice without a guide.</li>
        <li><b>Ladders, Cheserys to Lac Blanc.</b> Exposed; climb them, do not descend them; avoid when wet. The Index route to Lac Blanc has narrow, exposed ledges and loose scree; this plan does not use it.</li>
        <li><b>Grand Balcon Nord couloirs.</b> The left shortcut at 2,071 m is dangerous in snow. Take the right branch via Signal Forbes.</li>
        <li><b>Grand Balcon Sud.</b> Steep pegged steps with a handrail.</li>
        <li><b>Rockfall.</b> 2026 was a record rockfall year in heat. Gorges de la Diosaz closes for rockfall and the TMB has been rerouted at Orsieres. Hot spells raise the risk.</li>
        <li><b>Thunderstorms.</b> Localized after 15:00, widespread from 17:00, with a sharp temperature drop. Lifts stop in lightning and high wind.</li>
        <li><b>Early snow.</b> Possible above about 2,500&ndash;3,000 m (a single 2007 report; no climatology).</li>
        <li><b>Emergency.</b> <a href="tel:112">112</a> everywhere; PGHM is the French high-mountain rescue.</li>
      </ul>
    </div>
    <div class="panel">
      <h3>Gotchas and known issues</h3>
      <ol>
        <li>The guest card makes trains free between Servoz and Vallorcine only. Buses are discounted, not free, and older flyers that say otherwise are out of date.</li>
        <li>The Multipass excludes Panoramic Mont-Blanc, and holders still need an Aiguille du Midi slot.</li>
        <li>Last lift descents are 16:45&ndash;17:00. Miss the Flegere one and Les Praz is about 800 m below on foot.</li>
        <li>&ldquo;Sunset from Brevent&rdquo; is impossible by lift in September.</li>
        <li>The Lac Blanc hut is cash only, takes no children under 8, and books by phone only after 31 May.</li>
        <li>The Tramway du Mont-Blanc&rsquo;s Nid d&rsquo;Aigle top station is reserved for mountaineers with a hut booking, so day visitors get Col de Voza or Mont Lachat. Left out for that reason.</li>
        <li>On Sundays most shops close. Carrefour Chamonix shuts at 12:30; Super U Les Pelerins opens daily. Argentiere has only small grocers.</li>
        <li>A Swiss vignette is needed if the rental car leaves from the Swiss side of GVA.</li>
        <li>&ldquo;Les Bains de Chamonix&rdquo; does not exist under that name. The options are QC Terme (no under-14s) or the Richard Bozon pool.</li>
        <li>&ldquo;Lac de Peclerey&rdquo; does not exist; the walk is the Montagne de Peclerey.</li>
        <li>AllTrails figures here come from search snippets (the site returned 403 to page fetches). Official and AllTrails figures differ; ranges are given where they disagree.</li>
        <li>Tourist tax rates change on 1 Jan 2027; the only grid found is from 2019.</li>
      </ol>
    </div>
  </div>
</section>"""

# ---------- state of knowledge, open questions ------------------------------------------
STATE = """
<section class="intro" id="state">
  <p class="kick">The honest state</p>
  <h2>State of knowledge</h2>
  <div class="grid2">
    <div class="panel">
      <h3>Verified (2026 sources, used as a pattern)</h3>
      <ul>
        <li>2026 lift dates and hours for the early-September band (chamonix.net, en.chamonix.com)</li>
        <li>Aiguille du Midi prices and D-1 ticket release; Montenvers prices</li>
        <li>Official trail figures: Lac Blanc, Grand Balcon Nord, Aiguillette, Cheserys, Chapeau</li>
        <li>Guest card coverage; 2026 Multipass prices</li>
        <li>Les Praz and Argentiere on the rail line; Super U Les Pelerins open daily</li>
        <li>Lac Blanc hut terms (two conflicting season ranges, both covering early September)</li>
        <li>ATMB statement on the 2027&ndash;28 closure model; 2025 closure from 1 Sep</li>
        <li>No Toronto-Geneva nonstop in 2026; Toronto-Zurich nonstop exists</li>
        <li>TMB 2027 booking opened 15 Oct 2026; Croix du Bonhomme closed until about 2029</li>
        <li>Computed sun times</li>
      </ul>
    </div>
    <div class="panel">
      <h3>GAP or inference</h3>
      <ul>
        <li>Every 2028 date and price, including the lift closing Sunday (inference: 10 or 17 Sep)</li>
        <li>UTMB 2028 dates; tunnel 2028 start date; TMB 2028 booking opening (inferred about 15 Oct 2027); Lac Blanc hut booking opening and cancellation terms</li>
        <li>Flegere and Merlet car park capacity; Parc de Merlet and Grands Montets in 2028; Balme lift price</li>
        <li>Whether an Aiguille du Midi return allows a mid-station exit; Mer de Glace step count</li>
        <li>Valley-floor sun loss times; September thunderstorm frequency; freezing level; fraction of days with a clear summit</li>
        <li>ZRH-Chamonix door-to-door time; one-stop YYZ-GVA routings; Argentiere-GVA transfer time</li>
        <li>Emosson prices; Courmayeur drive times by the alternative routes; Crit&rsquo;Air status</li>
        <li>Acclimatisation ordering (inference); the Day 4/5 split distances (inference); the base split (inference from the stay research)</li>
      </ul>
    </div>
  </div>
  <div class="panel" style="margin-top:20px">
    <h3>Open questions for you</h3>
    <ol>
      <li><b>Group size and ages.</b> These limits decide who can do what: Aiguille du Midi (no children under 3; under 5 not recommended); Lac Blanc hut (no children under 8); paragliding (minimum age 4&ndash;12 by operator; weight cap about 100&ndash;120 kg); guided glacier walks (12&ndash;15+); QC Terme spa (14+).</li>
      <li><b>Car or no car?</b> The plan works without one, except that Day 3 then becomes the Chapeau hike or Peclerey.</li>
      <li><b>Fitness ceiling</b> in km and ascent per day. The plan peaks at 9.8 km and +765 m (official figures; up to 12 km and +1,000 m on another official listing).</li>
      <li><b>Do hut nights appeal?</b> That decides whether Day 4 is a hut night or a day hike, and whether a TMB is worth a separate July or August trip.</li>
    </ol>
  </div>
</section>"""

QUICK = """
<section class="quick" id="quick">
  <h2>Day-of links</h2>
  <p class="qsub">The handful actually tapped in the field</p>
  <div class="qgrid">
    <div class="qcard">
      <h4><span class="dot" style="background:var(--class-4)"></span>Weather</h4>
      <a href="https://en.chamonix.com/meteo"><b>Meteo-France Chamonix</b>Read at 18:00 for tomorrow, 07:00 on Day 6</a>
    </div>
    <div class="qcard">
      <h4><span class="dot" style="background:var(--class-1)"></span>Lifts</h4>
      <a href="https://www.chamonix.net/english/lift-systems/dates-times"><b>Lift dates and times</b>Confirm 2028 closing dates in spring</a>
      <a href="https://aiguilledumidi.montblancnaturalresort.com/en"><b>Aiguille du Midi</b>Timed slot, released D-1</a>
    </div>
    <div class="qcard">
      <h4><span class="dot" style="background:var(--class-3)"></span>Huts and tickets</h4>
      <a href="https://www.refugedulacblanc.fr"><b>Refuge du Lac Blanc</b>Online until 31 May, then phone</a>
      <a href="tel:+33767567414"><b>07 67 56 74 14</b>Refuge du Lac Blanc, by phone</a>
    </div>
    <div class="qcard">
      <h4><span class="dot" style="background:var(--class-2)"></span>Rescue</h4>
      <a class="tel" href="tel:112"><b>112</b>Emergency, PGHM for the high mountain</a>
    </div>
  </div>
</section>"""

CHECK_ITEMS = [
    ("flights", "Flights booked (2028 schedules open about Sep&ndash;Oct 2027); ZRH out, GVA home if fares are close"),
    ("lodging", "Les Praz (Fri 1&ndash;Mon 4 or Tue 5) and Argentiere (Tue 5&ndash;Sat 9) booked on free-cancellation rates"),
    ("hut", "Refuge du Lac Blanc decided and booked the day it opens (cash only, no children under 8)"),
    ("tunnel", "ATMB 2028 tunnel calendar checked"),
    ("lifts", "CMB 2028 lift dates checked; nothing closes before Sat 9 Sep"),
    ("pass", "Multipass, 5 non-consecutive days, bought"),
    ("midi", "Aiguille du Midi timed slot for Day 6 booked at D-1"),
    ("insure", "Travel medical cover with mountain rescue and repatriation"),
    ("etias", "ETIAS status and passport validity checked"),
    ("guest", "Guest card collected per person at check-in"),
    ("offline", "Offline maps and free tourist-office GPX files downloaded"),
    ("rain", "Rain layers, gloves and a hat packed for the summit"),
    ("recheck", "Conditions re-check run about 30 Aug 2028"),
]
checklist = "".join(
    f'<label><input type="checkbox" data-k="{k}"><span>{t}</span></label>' for k, t in CHECK_ITEMS)

CHECK = f"""
<section id="essentials">
  <h2>Before you go</h2>
  <div class="grid2">
    <div class="panel check">
      <h3>Checklist</h3>
      <div id="checklist">{checklist}</div>
      <p class="mono" style="font-size:.72rem;margin-top:10px">Ticks are saved in this browser.</p>
    </div>
    <div class="panel">
      <h3>Countdown</h3>
      <p>Departure from Toronto is Thu 31 Aug 2028; the first day in the valley is Fri 1 Sep.</p>
      <p class="bigcd"><strong id="cd">&mdash;</strong> until 1 Sep 2028</p>
    </div>
  </div>
</section>"""

NAV = '<a class="home" href="/">&#8592; All plans<span class="d">dashboard</span></a>' + "".join(
    f'<a href="#{i}"><span class="d">{d}</span>{n}</a>' for i, d, n in [
    ("orient", "Read first", "Orientation"),
    ("answer", "Decide", "How many days"),
    ("bases", "Sleep", "Bases"),
    ("d1", "Fri 1 Sep", "Day 1"),
    ("d2", "Sat 2 Sep", "Day 2"),
    ("d3", "Sun 3 Sep", "Day 3"),
    ("d4", "Mon 4 Sep", "Day 4"),
    ("d5", "Tue 5 Sep", "Day 5"),
    ("d6", "Wed 6 Sep", "Day 6"),
    ("d7", "Thu 7 Sep", "Day 7"),
    ("d8", "Fri 8 Sep", "Day 8"),
    ("d9", "Sat 9 Sep", "Day 9"),
    ("getting", "Money", "Logistics"),
    ("deadlines", "When", "Deadlines"),
    ("closed", "Changing", "Closures"),
    ("hazards", "Risk", "Hazards"),
    ("state", "Honest", "Knowledge"),
    ("quick", "In the field", "Links"),
    ("essentials", "Tick off", "Checklist"),
])

HERO_IMG = P["valley"][0]
CHIPS = ('<span class="chip"><strong id="countdown">&mdash;</strong></span>' + "".join(
    f'<span class="chip"><strong>{a}</strong> {b}</span>' for a, b in [
        ("8", "nights"), ("2", "bases + 1 hut"), ("3,842 m", "highest point"), ("2026", "prices as a pattern")]))

CTX = {
    "slug": "chamonix-mont-blanc-sept-2028",
    "trip_date": "2028-09-01",
    "trip_dates": "1 &ndash; 9 Sep 2028",
    "trip_duration": "8 nights",
    "trip_region": "Chamonix &amp; Mont Blanc, France",
    "title": "Chamonix and Mont Blanc &mdash; 8 nights, September 2028",
    "description": ("Nine days in the Chamonix valley with day hikes from two quiet bases: Brevent, Lac Blanc, "
                    "the Aiguille du Midi and the Col de Balme, timed to the last weeks the lifts run. "
                    "Built from 2026 figures; nothing for 2028 is published yet."),
    "hero_image": img(HERO_IMG, 2000),
    "hero_credit": f'<a href="{filepage(HERO_IMG)}">Mont Blanc above the Chamonix valley &middot; {P["valley"][2]} &middot; CC BY-SA 3.0 &middot; Wikimedia Commons</a>',
    "eyebrow": "Fri 1 &ndash; Sat 9 Sep 2028 &middot; Chamonix, France",
    "headline": "Chamonix and Mont Blanc",
    "sub": "Nine days of lift-and-walk hiking facing the massif, from Les Praz and Argentiere.",
    "chips": CHIPS,
    "nav": NAV,
    "body": WARN + ORIENT + ANSWER + BASES + DAYS + WEATHER + GETTING + DEADLINES + CLOSED + HAZARDS + STATE + QUICK + CHECK,
    "footer": ('Planned from six research files in <span class="mono">~/workspace/travel/'
               'chamonix-mont-blanc-sept-2028/</span>. Photographs from '
               '<a href="https://commons.wikimedia.org/">Wikimedia Commons</a>, each linked at its caption. '
               '<b>Every price, timetable and closing date is a 2026 figure used as a pattern; nothing for 2028 '
               'is published. Re-check lift dates, the tunnel calendar and hut terms before booking.</b>'),
    "extra_css":
        "nav a.home{color:var(--highlight-on-deep);font-weight:600;"
        "border-right:1px solid color-mix(in srgb, var(--highlight-on-deep) 32%, transparent);"
        "margin-right:6px}"
        "nav a.home:hover{color:var(--header-ink)}"
        ".panel p + p{margin-top:11px}"
        ".area .days{font-family:var(--font-mono);font-size:.68rem;letter-spacing:.06em}"
        ".panel ul,.panel ol{margin:6px 0 0 18px}.panel li{margin-bottom:7px;font-size:.94rem}"
        ".panel table{margin-top:8px}"
        ".intro table,.panel table{width:100%}"
        ".tw{overflow-x:auto;margin:14px 0}"
        ".tw table{min-width:560px}"
        ".inf{font-family:var(--font-mono);font-size:.68rem;letter-spacing:.04em;text-transform:uppercase;"
        "border:1px solid var(--line);border-radius:3px;padding:0 5px;color:var(--muted);white-space:nowrap}"
        ".inf.gap{border-color:var(--warn);color:var(--warn)}"
        ".warnbar{background:var(--warn-soft);border-left:6px solid var(--warn);color:var(--ink);"
        "padding:16px 20px;border-radius:4px;font-size:1rem;line-height:1.5}"
        "#warn{padding-bottom:0}#warn + #orient{padding-top:28px}.intro p + p{margin-top:11px}"
        ".plainlist{margin:8px 0 8px 20px}.plainlist li{margin-bottom:6px}"
        ".smallnote{font-size:.82rem;color:var(--muted);margin-top:10px}"
        ".subh{margin:26px 0 4px}"
        ".card .why{margin-top:10px}"
        ".bigcd{font-size:1.1rem}.bigcd strong{font-family:var(--font-mono);font-size:1.6rem}"
        ".intro ol,.intro .plainlist{max-width:80ch}",
}

html_out = S.assemble(CTX, THEME)
problems = S.check_output_is_self_contained(html_out)
if problems:
    raise SystemExit("SELF-CONTAINMENT FAILED:\n  " + "\n  ".join(problems))
out = HERE / "index.html"
out.write_text(html_out, encoding="utf-8")
print(f"wrote {out}  ({len(html_out):,} bytes, theme={THEME})")

# Photo gallery is data (gallery.json) injected after the build; a rebuild would otherwise erase it.
if (HERE / "gallery.json").exists():
    import gallery as G   # noqa: E402  (_system/gallery.py)
    G.inject(G.load(str(HERE / "gallery.json")), out)
