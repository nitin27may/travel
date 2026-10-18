"""Content shared by every direction's previews.

Source of truth: prototype/src/data/trip.ts, places.ts, trips.ts, trails.ts and
docs/v2/design/trip-scope-scenarios.md (the household on 18 Oct 2026). Elora and Patagonia
details that the prototype does not hold are marked as examples in the previews.
"""
from __future__ import annotations

import hashlib
import urllib.parse

# ---------------------------------------------------------------- photos (Wikimedia Commons)
LICENSE_URL = {
    "CC BY-SA 4.0": "https://creativecommons.org/licenses/by-sa/4.0/",
    "CC BY-SA 3.0": "https://creativecommons.org/licenses/by-sa/3.0/",
    "CC BY-SA 2.0": "https://creativecommons.org/licenses/by-sa/2.0/",
    "CC BY 4.0": "https://creativecommons.org/licenses/by/4.0/",
    "CC BY 3.0": "https://creativecommons.org/licenses/by/3.0/",
    "CC BY 2.0": "https://creativecommons.org/licenses/by/2.0/",
}

# key: (file on Commons, author, licence, what it shows)
PHOTOS: dict[str, tuple[str, str, str, str]] = {
    "misurina": ("Lago di Misurina Tre Cime di Lavaredo 1.jpg", "kallerna", "CC BY-SA 4.0", "Lago di Misurina with the Tre Cime behind"),
    "trecime-specie": ("Tre Cime di Lavaredo from Monte Specie, Val Pusteria, Trentino-Alto Adige, Italy, 2025 October.jpg", "Ximonic (Simo Räsänen)", "CC BY-SA 4.0", "The Tre Cime from Monte Specie"),
    "trecime-pano": ("Tri Cime panorama 2.jpg", "kallerna", "CC BY-SA 4.0", "The Tre Cime di Lavaredo"),
    "locatelli": ("Tre cime - rifugio Locatelli.jpg", "Elio Pallard", "CC BY-SA 4.0", "Rifugio Locatelli and the north faces of the Tre Cime"),
    "locatelli2": ("Rifugio Antion Locatelli 2.jpg", "Tiia Monto", "CC BY-SA 3.0", "Rifugio Locatelli under the Paterno"),
    "auronzo-hut": ("Rifugio Auronzo, 2320 m.jpg", "2015 Michael 2015", "CC BY-SA 4.0", "Rifugio Auronzo, 2,320 m, the trailhead"),
    "auronzo-park": ("Parcheggio Rifugio Auronzo 02.jpg", "Davide Mauro", "CC BY-SA 4.0", "The car park at the end of the toll road"),
    "braies-boats": ("Lago di Braies South Tyrol 6.jpg", "kallerna", "CC BY-SA 4.0", "Rowing boats on Lago di Braies"),
    "braies": ("Lago di Braies South Tyrol 7.jpg", "kallerna", "CC BY-SA 4.0", "Lago di Braies with the Croda del Becco ridge"),
    "seceda": ("Odle, Puez, Sella and Langkofel groups from Seceda, South Tyrol.jpg", "NorbertNagel", "CC BY-SA 4.0", "Odle, Puez, Sella and Sassolungo from the Seceda ridge"),
    "odle": ("Odles as seen from Seceda.JPG", "Wolfgang Moroder", "CC BY-SA 3.0", "The Odle from the ridge at Seceda"),
    "siusi": ("Seiser Alm 04.jpg", "H. Zell", "CC BY-SA 3.0", "Alpe di Siusi with the Sassolungo group"),
    "siusi-cows": ("Seiser Alm 11.jpg", "H. Zell", "CC BY-SA 3.0", "Cows on the Alpe di Siusi"),
    "sorapis": ("Lago di Sorapis 3.jpg", "kallerna", "CC BY-SA 4.0", "Lago di Sorapis"),
    "cortina": ("Faloria Cortina d'Ampezzo 29.jpg", "kallerna", "CC BY-SA 4.0", "Cortina d'Ampezzo from Faloria"),
    "sancandido": ("Caserma Druso a San Candido 5.jpg", "Llorenzi", "CC BY-SA 4.0", "San Candido from the hillside"),
    "pordoi": ("Passo Pordoi-bops 01.jpg", "Bops92", "CC BY-SA 4.0", "Passo Pordoi in the Sella group"),
    "sella": ("Sella group - View from West.jpg", "H. Zell", "CC BY-SA 3.0", "The Sella group from the west"),
    "cinque-torri": ("Cinque Torri 1.jpg", "kallerna", "CC BY-SA 4.0", "Cinque Torri"),
    "lagazuoi": ("Lagazuoi 01.jpg", "Clemens Stockner", "CC BY-SA 4.0", "Lagazuoi above Passo Falzarego"),
    "fitzroy": ("Fitz Roy El Chalten sunrise-5.jpg", "Almonroth", "CC BY-SA 3.0", "Fitz Roy at sunrise from El Chaltén"),
    "jokulsarlon": ("Jökulsárlón glacier lagoon, Iceland, 20240719 0935 2448.jpg", "Jakub Hałun", "CC BY 4.0", "Icebergs in Jökulsárlón"),
    "moraine": ("Moraine Lake-Banff NP.JPG", "Tobias Alt", "CC BY-SA 4.0", "Moraine Lake, Banff"),
    "chamonix": ("Chamonix valley from la Flégère,2010 07.JPG", "Ximonic, Simo Räsänen", "CC BY-SA 3.0", "Mont Blanc above the Chamonix valley"),
    "arenal": ("Arenal volcano (70785p) (cropped).jpg", "Rhododendrites", "CC BY-SA 4.0", "Arenal volcano"),
    "reine": ("Reine in Lofoten, Norway, 2012 October.jpg", "Ximonic (Simo Räsänen)", "CC BY-SA 3.0", "Reine, Lofoten"),
    "elora": ("Elora Gorge, Elora, Ontario (21651814860).jpg", "Ken Lund", "CC BY-SA 2.0", "The Grand River in the Elora Gorge"),
    "algonquin": ("Lookout Trail - Algonquin Park - IMG 9563.jpg", "Sikander Iqbal", "CC BY-SA 4.0", "From the Lookout Trail, Algonquin"),
    "vermont": ("Smuggler's Notch Vermont Fall Foliage October 2020 - Flickr - Anthony Quintano.jpg", "Anthony Quintano", "CC BY 2.0", "Smugglers' Notch in October"),
    "lauterbrunnen": ("043 Lauterbrunnen Photo by Giles Laurent.jpg", "Giles Laurent", "CC BY-SA 4.0", "Lauterbrunnen and the Staubbach Falls"),
    "bryce": ("Bryce Amphitheater from Sunrise Point, Bryce Canyon National Park, Utah.jpg", "Christian David", "CC BY-SA 4.0", "Bryce Amphitheater"),
}


def photo_url(key: str, width: int = 960) -> str:
    assert width in (330, 960, 1920), "standard Commons thumbnail widths only"
    name = PHOTOS[key][0].replace(" ", "_")
    h = hashlib.md5(name.encode()).hexdigest()
    q = urllib.parse.quote(name)
    return f"https://upload.wikimedia.org/wikipedia/commons/thumb/{h[0]}/{h[:2]}/{q}/{width}px-{q}"


def photo_page(key: str) -> str:
    return "https://commons.wikimedia.org/wiki/File:" + urllib.parse.quote(PHOTOS[key][0].replace(" ", "_"))


# ---------------------------------------------------------------- trip identity
# Okabe-Ito set: distinguishable with the common colour-vision deficiencies. Colour never travels
# alone: it always sits beside the trip's photo and name. Yellow and sky need a dark keyline on white.
IDENTITY = {
    "blue": "#0072B2", "orange": "#E69F00", "rose": "#CC79A7", "teal": "#009E73",
    "sky": "#56B4E9", "vermillion": "#D55E00", "yellow": "#F0E442", "none": "#8A9099",
}

TRIPS = [
    # id, title, dates, nights, region, phase, colour, photo, next deadline, due label, days-away
    dict(id="elora", title="Elora Gorge", sub="Day trip from Whitby", dates="Sat 24 Oct 2026", nights=0, phase="Preparing",
         colour="rose", photo="elora", next="Tubing slot opens online", due="Mon 19 Oct", away="in 6 days", ready=(1, 1, .5, 0)),
    dict(id="patagonia", title="Patagonia", sub="Argentina · 4 bases", dates="26 Feb – 11 Mar 2027", nights=13, phase="Booking",
         colour="orange", photo="fitzroy", next="Book the flight and El Chaltén lodging", due="Sat 31 Oct", away="in 13 days", ready=(1, .35, .1, 0)),
    dict(id="dolomites", title="Dolomites", sub="Italy · 4 bases", dates="13 – 26 Jul 2027", nights=13, phase="Booking",
         colour="blue", photo="misurina", next="Book the Ortisei stay (Guest Pass)", due="Mon 15 Mar", away="in 5 months", ready=(1, .44, .08, 0)),
    dict(id="costa-rica", title="Costa Rica", sub="Family · 2 bases", dates="13 – 23 Feb 2027", nights=10, phase="Planning",
         colour="teal", photo="arenal", next="Pick the second base: Monteverde or La Fortuna", due="", away="", ready=(.8, .1, 0, 0)),
    dict(id="iceland", title="Iceland by camper van", sub="Ring Road · 11 nights", dates="4 – 15 Sep 2027", nights=11, phase="Planning",
         colour="sky", photo="jokulsarlon", next="No campsite confirmed open for Sep 2027", due="", away="", ready=(.9, 0, 0, 0)),
    dict(id="chamonix", title="Chamonix and Mont Blanc", sub="France · 2 bases", dates="1 – 9 Sep 2028", nights=8, phase="Planning",
         colour="yellow", photo="chamonix", next="Lac Blanc refuge bookings open ~15 Oct 2027", due="", away="", ready=(.85, 0, 0, 0)),
    dict(id="rockies", title="Canadian Rockies", sub="Alberta and BC · 3 tracks", dates="8 – 22 Sep 2029", nights=14, phase="Planning",
         colour="vermillion", photo="moraine", next="Template published for family", due="", away="", ready=(1, 0, 0, 0)),
]
IDEAS = [
    dict(id="norway", title="Norway, Arctic first", sub="Lofoten to Bergen · 14 nights", note="Window A 24 Jun or B 29 Jul 2028", photo="reine"),
    dict(id="peru", title="Peru: Huayhuash and Cusco", sub="17 or 24-26 days", note="Choose a shape first", photo=None),
]
DONE = [
    dict(id="algonquin", title="Algonquin and Muskoka", dates="10 – 12 Oct 2026", photo="algonquin", note="3 corrections to send", uses=0),
    dict(id="vermont", title="Vermont fall colours", dates="1 – 4 Oct 2026", photo="vermont", note="Used as a template once", uses=1),
    dict(id="quebec", title="Île d'Orléans", dates="29 Sep – 1 Oct 2026", photo=None, note="Prologue to Vermont", uses=0),
]
TRIP = {t["id"]: t for t in TRIPS}

# "Needs you this week" across trips (S1), sorted by due date
NEEDS = [
    dict(trip="elora", what="Book the tubing slot", detail="Opens online 09:00, 2 slots of 30 left last year", due="Mon 19 Oct", when="tomorrow", tab="Bookings", urgent=True),
    dict(trip="elora", what="Leave by 08:10 on Saturday", detail="2 h 05 drive, 25 min buffer for the 10:30 slot", due="Sat 24 Oct", when="in 6 days", tab="Today", urgent=False),
    dict(trip="patagonia", what="Book the international flight", detail="Toronto to Buenos Aires, 3 passengers", due="Sat 31 Oct", when="in 13 days", tab="Bookings", urgent=False),
    dict(trip="patagonia", what="Book El Chaltén lodging, 4 nights", detail="5 – 9 Mar; family rooms go first", due="Sat 31 Oct", when="in 13 days", tab="Bookings", urgent=False),
    dict(trip="person", what="Renew Kai's passport", detail="Expires Sep 2027; Dolomites needs 3 months past 26 Jul", due="Fri 15 Jan", when="person", tab="Tasks", urgent=False, links=["dolomites", "patagonia"]),
]

# ---------------------------------------------------------------- Dolomites
TRAVELLERS = [("N", "Nitin"), ("P", "Partner"), ("A", "Kai, 8")]

BASES = [
    dict(name="San Candido", nights="4 nights", days=(1, 4), photo="sancandido"),
    dict(name="Cortina", nights="4 nights", days=(5, 8), photo="cortina"),
    dict(name="Ortisei", nights="4 nights", days=(9, 12), photo="seceda"),
    dict(name="Bolzano", nights="1 night", days=(13, 13), photo=None),
    dict(name="Home", nights="", days=(14, 14), photo=None),
]

# n, date, title, drive, items (time, place id, name, kind, meta, note, ticket, photo)
DAYS = [
    (1, "Tue 13 Jul", "Venice to the Alta Pusteria", "2 h 58", [
        ("11:30", "vce", "Venice Marco Polo Airport", "airport", "Car desk 3 · 1 h", "Land 10:55; automatic booked", "booked", None),
        ("15:20", "landro", "Lago di Landro", "lake", "Roadside stop · 20 min", "The Cristallo head-on", None, None)]),
    (2, "Wed 14 Jul", "Lago di Braies, early", "1 h 38", [
        ("05:10", "braies", "Lago di Braies", "lake", "3.7 km · 30 m · 1-1.5 h", "Sunrise 05:32; alpenglow on the Seekofel first", "to_book", "braies-boats"),
        ("14:00", "fiscalina", "Val Fiscalina", "trail", "3 km · 60 m · 1 h", "Flat walk to the Talschlusshütte", None, None)]),
    (3, "Thu 15 Jul", "Tre Cime di Lavaredo", "1 h 10", [
        ("11:30", "tre-cime", "Tre Cime di Lavaredo loop", "trail", "10 km · 450 m · 3.5-4.5 h", "Midday slot, walk clockwise", "to_book", "locatelli"),
        ("16:30", "cadini", "Cadini di Misurina viewpoint", "viewpoint", "2 km · 150 m · 40 min", "Exposed spur; stop at the drop-off", None, "trecime-pano")]),
    (4, "Fri 16 Jul", "Croda del Becco or the Drava ride", "1 h 21", [
        ("06:30", "seekofel", "Croda del Becco", "trail", "14.6 km · 1,350 m · 7-8.5 h", "Track A: Nitin and Partner · 12+", None, "braies"),
        ("09:30", "drava", "Drava cycle path to Lienz", "activity", "43 km · downhill · 2 h 50", "Track B: Kai and Partner", None, None),
        ("15:30", "funbob", "Funbob, Monte Baranci", "activity", "Toboggan · 1.5 h · 8+", None, None, None)]),
    (5, "Sat 17 Jul", "To Cortina via Monte Piana", "1 h 10", []),
    (6, "Sun 18 Jul", "Lago di Sorapis", "33 min", []),
    (7, "Mon 19 Jul", "Lagazuoi and Scotoni", "57 min", []),
    (8, "Tue 20 Jul", "Nuvolau, Averau, Limides at sunset", "47 min", []),
    (9, "Wed 21 Jul", "Cortina to Val Gardena, the scenic way", "1 h 41", []),
    (10, "Thu 22 Jul", "Sass Pordoi and Piz Boè", "1 h", []),
    (11, "Fri 23 Jul", "Alpe di Siusi", "38 min", []),
    (12, "Sat 24 Jul", "Seceda, then Val di Funes at sunset", "47 min", []),
    (13, "Sun 25 Jul", "Adolf Munkel Weg, then Bolzano", "1 h 28", []),
    (14, "Mon 26 Jul", "Bolzano to Venice", "2 h 42", []),
]
DAY_PHOTO = {1: "misurina", 2: "braies-boats", 3: "locatelli", 4: "braies", 5: "trecime-specie", 6: "sorapis", 7: "lagazuoi",
             8: "cinque-torri", 9: "sella", 10: "pordoi", 11: "siusi", 12: "seceda", 13: "odle", 14: None}
DAY_FLAG = {4: "Split day", 9: "Verify Passo Gardena slots"}

# coordinates (lon, lat) for pins and road waypoints
P = {
    "san-candido": (12.2803, 46.7327), "dobbiaco": (12.2219, 46.7353), "monguelfo": (12.106, 46.758), "landro": (12.231, 46.6347),
    "misurina": (12.2533, 46.5808), "braies": (12.0853, 46.6946), "fiscalina": (12.355, 46.6745), "sesto": (12.348, 46.703),
    "tre-cime": (12.2955, 46.6125), "cadini": (12.27, 46.605), "seekofel": (12.064, 46.667), "funbob": (12.27, 46.725),
    "antorno": (12.2591, 46.5947), "monte-piana": (12.238, 46.6136), "cortina": (12.1357, 46.5405), "tre-croci": (12.205, 46.556),
    "sorapis": (12.22, 46.5197), "pocol": (12.105, 46.528), "falzarego": (12.009, 46.519), "lagazuoi": (12.006, 46.5275),
    "scotoni": (11.9928, 46.5361), "giau": (12.057, 46.483), "nuvolau": (12.0476, 46.4968), "cinque-torri": (12.05, 46.505),
    "limides": (12.0346, 46.511), "lavilla": (11.90, 46.585), "la-val": (11.929, 46.658), "corvara": (11.873, 46.55),
    "gardena": (11.807, 46.549), "selva": (11.7612, 46.5556), "ortisei": (11.6714, 46.5747), "sella-pass": (11.766, 46.508),
    "pordoi": (11.815, 46.503), "viel-dal-pan": (11.84, 46.49), "siusi-v": (11.565, 46.543), "siusi": (11.625, 46.541),
    "puflatsch": (11.611, 46.555), "seceda": (11.7231, 46.5996), "ponte-gardena": (11.53, 46.598), "chiusa": (11.567, 46.64),
    "funes": (11.723, 46.639), "munkel": (11.76, 46.62), "bolzano": (11.3548, 46.4983), "otzi": (11.3485, 46.499),
    "pieve": (12.37, 46.43), "san-vito": (12.2055, 46.4573), "edge-s": (12.33, 46.40), "edge-sw": (11.36, 46.40),
    "edge-e": (12.55, 46.79), "valparola": (11.99, 46.535),
}
# road-shaped route per day: lists of waypoints; stops are the numbered pins
ROUTES = {
    1: ["edge-s", "pieve", "san-vito", "cortina", "misurina", "landro", "dobbiaco", "san-candido"],
    2: ["san-candido", "dobbiaco", "monguelfo", "braies", "monguelfo", "dobbiaco", "san-candido", "sesto", "fiscalina"],
    3: ["san-candido", "dobbiaco", "landro", "misurina", "tre-cime", "cadini"],
    4: ["san-candido", "dobbiaco", "monguelfo", "braies", "seekofel"],
    5: ["san-candido", "dobbiaco", "landro", "monte-piana", "antorno", "misurina", "tre-croci", "cortina"],
    6: ["cortina", "tre-croci", "sorapis"],
    7: ["cortina", "pocol", "falzarego", "lagazuoi", "valparola", "scotoni"],
    8: ["cortina", "pocol", "giau", "nuvolau", "cinque-torri", "limides"],
    9: ["cortina", "pocol", "falzarego", "valparola", "lavilla", "la-val", "lavilla", "corvara", "gardena", "selva", "ortisei"],
    10: ["ortisei", "selva", "sella-pass", "pordoi", "viel-dal-pan"],
    11: ["ortisei", "siusi-v", "siusi", "puflatsch"],
    12: ["ortisei", "seceda", "ortisei", "ponte-gardena", "chiusa", "funes"],
    13: ["ortisei", "ponte-gardena", "chiusa", "funes", "munkel", "chiusa", "bolzano", "otzi"],
    14: ["bolzano", "edge-sw"],
}
STOPS = {1: ["landro"], 2: ["braies", "fiscalina"], 3: ["tre-cime", "cadini"], 4: ["seekofel", "funbob"], 5: ["monte-piana", "antorno"],
         6: ["sorapis"], 7: ["lagazuoi", "scotoni"], 8: ["nuvolau", "cinque-torri", "limides"], 9: ["la-val", "gardena"],
         10: ["pordoi", "viel-dal-pan"], 11: ["siusi", "puflatsch"], 12: ["seceda", "funes"], 13: ["munkel", "otzi"], 14: []}
BASE_PINS = [("san-candido", "San Candido"), ("cortina", "Cortina"), ("ortisei", "Ortisei"), ("bolzano", "Bolzano")]
DAY_BASE = {1: 0, 2: 0, 3: 0, 4: 0, 5: 1, 6: 1, 7: 1, 8: 1, 9: 2, 10: 2, 11: 2, 12: 2, 13: 3, 14: 3}

# ---------------------------------------------------------------- bookings (S2)
DOLO_BOOKINGS = [
    dict(kind="flight", title="AC 892 Toronto → Venice", when="Mon 12 Jul 18:30 → Tue 13 Jul 09:05", status="booked", code="K7Q2PZ", money="CAD 4,212 paid", day="Day 1"),
    dict(kind="car", title="Automatic compact, Marco Polo", when="13 Jul 11:30 → 26 Jul 12:00", status="booked", code="EU-449812", money="CAD 462 due 13 Jul", day="Day 1"),
    dict(kind="stay", title="Hotel, San Candido · nights 1-4", when="In 13 Jul 15:00 · out 17 Jul 10:00", status="booked", code="HP-20931", money="€1,340 paid", day="Day 1"),
    dict(kind="parking", title="Lago di Braies P4 parking", when="Wed 14 Jul, entry 05:00 – 09:00", status="to_book", code="", money="€44", day="Day 2", window="Online, before the day"),
    dict(kind="toll", title="Tre Cime toll road slot", when="Thu 15 Jul 11:00", status="to_book", code="", money="€40", day="Day 3", window="Opens Tue 15 Jun 2027"),
    dict(kind="stay", title="Hotel, Cortina · nights 5-8", when="17 – 21 Jul", status="held", code="", money="€1,880 at the hotel", day="Day 5", window="Hold ends 1 May"),
    dict(kind="stay", title="Ortisei, 4 nights", when="21 – 25 Jul", status="to_book", code="", money="≈ €1,600", day="Day 9", window="Book by Mon 15 Mar"),
    dict(kind="lift", title="Seceda lift, 08:30 slot", when="Sat 24 Jul 08:30", status="to_book", code="", money="€74 × 3", day="Day 12", window="Book by 1 Jun"),
    dict(kind="ticket", title="Ötzi museum entry", when="Sun 25 Jul 15:30", status="to_book", code="", money="€39", day="Day 13"),
]
PATA_BOOKINGS = [
    dict(kind="flight", title="Toronto → Buenos Aires (EZE)", when="Fri 26 Feb 2027 · 3 passengers", status="to_book", code="", money="≈ CAD 5,400", day="Day 1", window="Book by Sat 31 Oct"),
    dict(kind="stay", title="El Chaltén, 4 nights", when="5 – 9 Mar · family room", status="to_book", code="", money="≈ USD 900", day="Day 8", window="Book by Sat 31 Oct"),
    dict(kind="flight", title="Buenos Aires → Ushuaia", when="Sat 27 Feb", status="to_book", code="", money="≈ USD 420", day="Day 2", window="By Sun 15 Nov"),
    dict(kind="flight", title="El Calafate → Buenos Aires", when="Mon 8 Mar", status="to_book", code="", money="≈ USD 390", day="Day 11", window="By Sun 15 Nov"),
    dict(kind="car", title="Car, El Calafate to El Chaltén", when="5 – 10 Mar", status="to_book", code="", money="≈ USD 520", day="Day 8", window="By Sun 15 Nov"),
    dict(kind="ticket", title="Piratour: walk with the penguins", when="Tue 2 Mar", status="to_book", code="", money="≈ USD 540", day="Day 5", window="By Mon 30 Nov"),
    dict(kind="ticket", title="Perito Moreno minitrekking", when="Tue 9 Mar · ages 8-65", status="to_book", code="", money="≈ USD 1,050", day="Day 12", window="By Mon 30 Nov"),
    dict(kind="stay", title="Ushuaia, 4 nights", when="27 Feb – 3 Mar", status="held", code="", money="USD 760 at the hotel", day="Day 2"),
]

# ---------------------------------------------------------------- Elora, Sat 24 Oct (S5, example day)
ELORA_DAY = [
    ("08:10", "Leave home, Whitby", "drive", "2 h 05 · 182 km via 407 and 401", "leave"),
    ("10:15", "Elora Gorge Conservation Area", "parking", "Day-use parking, pay at the gate", None),
    ("10:30", "Tubing slot, Grand River", "ticket", "Check in 15 min before · booked HB-5521", "booked"),
    ("12:45", "Lunch in Elora village", "food", "Mill Street; 10 min drive", None),
    ("14:00", "Gorge trail to the Tooth of Time", "trail", "2.5 km · 40 m · 1 h", None),
    ("16:30", "Drive home", "drive", "2 h 10 · arrive about 18:40", None),
]

# ---------------------------------------------------------------- Tre Cime trail record (from trails.ts)
TRAIL = dict(
    name="Tre Cime di Lavaredo loop", aka="Drei Zinnen · Rifugio Auronzo", area="Auronzo · Sesto Dolomites",
    summary="Wide gravel loop around the three north faces, no exposure. Walked clockwise from a midday slot, the north faces are lit when you reach Rifugio Locatelli.",
    facts=[("Distance", "10", "km", "Auronzo toll road site", "official"), ("Climb", "450", "m", "PLAN.md", "plan"),
           ("High point", "2,454", "m", "Forcella Lavaredo, OSM", "official"), ("Time", "3.5–4.5", "h", "PLAN.md", "plan"),
           ("Difficulty", "Moderate", "", "AllTrails listing", "community"), ("Shape", "Loop", "", "PLAN.md", "plan")],
    who=[("Minimum age", "6", "PLAN.md"), ("Kids", "Fine for a fit 10-year-old; the climb to Forcella Lavaredo is the only steep bit", "PLAN.md"),
         ("Dogs", "On a lead; huts allow dogs on the terrace", "operator")],
    when=[("Season", "Jun – Oct; Rifugio Locatelli open in July", "AllTrails and PLAN.md"),
          ("Best time", "Clockwise from a midday slot keeps the north faces lit", "PLAN.md"),
          ("Weather", "Afternoon thunderstorms in July; be off the loop by 14:00 if unsettled", "operator")],
    trailhead=dict(name="Rifugio Auronzo", elev="2,320 m", lat="46.6125", lon="12.2955",
                   parking="Toll road car park at Rifugio Auronzo", fee="€40 per car, valid 12 h from the slot",
                   fills="Midday slots sell out first", booking="pass.auronzo.info", opens="30 days before (Tue 15 Jun 2027 for 15 Jul)",
                   shuttle="Bus 444 from Dobbiaco to Rifugio Auronzo"),
    huts=[("Rifugio Auronzo", "0 km", "2,320 m"), ("Rifugio Lavaredo", "1.7 km", "2,344 m"), ("Forcella Lavaredo", "2.6 km", "2,454 m"),
          ("Rifugio Locatelli", "4.2 km", "2,405 m"), ("Malga Langalm", "6.9 km", "2,283 m")],
    hazards=["Afternoon thunderstorms in July; be off the loop by 14:00 if unsettled", "Crowded 09:00–12:00 at Forcella Lavaredo"],
    links=[
        ("Official", "Tre Cime and Hochpustertal tourism", "tre-cime.info/en", "Regional tourism office", "18 Oct 2026"),
        ("Official", "Dreizinnen Dolomites (Sesto, Tre Cime)", "dreizinnen.com/en", "Route and webcam pages", "18 Oct 2026"),
        ("Booking", "Toll road slot booking", "pass.auronzo.info", "Slots open 30 days ahead", "18 Oct 2026"),
        ("Official", "Auronzo municipality and toll road", "auronzo.info", "Home of the toll road", "18 Oct 2026"),
        ("Route", "OpenStreetMap relation 1116663 (path 101)", "openstreetmap.org/relation/1116663", "One section of the loop", "18 Oct 2026"),
        ("Route", "Komoot highlight: Tre Cime di Lavaredo", "komoot.com/highlight/7763769", "Community tour", "18 Oct 2026"),
        ("Route", "AllTrails: Three Peaks of Lavaredo", "alltrails.com", "Link only; their terms bar embedding", "18 Oct 2026"),
        ("Route", "AllTrails: Auronzo Refuge loop", "alltrails.com", "Link only", "18 Oct 2026"),
        ("Conditions", "Dreizinnen webcams", "dreizinnen.com/en/webcams", "Live view at the huts", "18 Oct 2026"),
        ("Conditions", "South Tyrol mountain weather", "wetter.provinz.bz.it", "Daily mountain forecast", "18 Oct 2026"),
        ("Conditions", "MeteoMont avalanche and snow", "meteomont.carabinieri.it", "Early-season snow", "18 Oct 2026"),
        ("Report", "Circular hike Tre Cime (hiwio)", "hiwio.com", "Route write-up with photos", "18 Oct 2026"),
    ],
)
# a plausible clockwise profile: (km, metres)
PROFILE = [(0, 2320), (0.8, 2330), (1.7, 2344), (2.2, 2400), (2.6, 2454), (3.2, 2430), (4.2, 2405), (4.9, 2350), (5.6, 2300),
           (6.3, 2270), (6.9, 2283), (7.6, 2330), (8.3, 2380), (9.0, 2350), (10, 2320)]

# ---------------------------------------------------------------- public trip (Discover)
SEASON = dict(label="Mid-July to the end of August", why="All lifts and high trails are open and the snow has gone from the passes.",
              months=[7, 8], shoulder=[6, 9],
              weather=[("Temperature", "8–24 °C in the valleys", "near 0 °C on 2,900 m summits"),
                       ("Rain", "Afternoon thunderstorms", "most days; be off ridges by 14:00"),
                       ("Daylight", "Sunrise ~05:30", "sunset ~20:55 mid-July")],
              notes=["Tre Cime and Braies need booked parking or a toll slot", "Early June and September close several lifts", "Lagazuoi tunnels need a headlamp"])
PUBLIC_DAYS = [
    (1, "Venice to the Alta Pusteria", "Alta Pusteria", "2 h 30", ["Venice Marco Polo Airport", "Lago di Landro"], "misurina"),
    (2, "Lago di Braies, early", "Alta Pusteria", "55 min", ["Lago di Braies at first light", "Val Fiscalina"], "braies-boats"),
    (3, "Tre Cime di Lavaredo", "Alta Pusteria", "1 h 10", ["Tre Cime loop, clockwise", "Cadini di Misurina viewpoint"], "locatelli"),
    (4, "Croda del Becco or the Drava ride", "Alta Pusteria", "40 min", ["Croda del Becco (12+)", "Drava cycle path", "Funbob toboggan"], "braies"),
    (5, "To Cortina via Monte Piana", "Cortina", "45 min", ["Monte Piana WWI plateau", "Lago d'Antorno"], "trecime-specie"),
    (6, "Lago di Sorapis", "Cortina", "35 min", ["Passo Tre Croci at 05:45", "Lago di Sorapis"], "sorapis"),
    (7, "Lagazuoi and Scotoni", "Cortina", "1 h", ["Lagazuoi cable car and tunnels", "Rifugio Scotoni"], "lagazuoi"),
    (8, "Nuvolau, Averau, Limides at sunset", "Cortina", "50 min", ["Rifugio Nuvolau", "Cinque Torri", "Lago di Limides"], "cinque-torri"),
    (9, "Cortina to Val Gardena, the scenic way", "Val Gardena", "1 h 50", ["La Val", "Passo Gardena"], "sella"),
    (10, "Sass Pordoi and Piz Boè", "Val Gardena", "45 min", ["Sass Pordoi (12+)", "Viel dal Pan"], "pordoi"),
    (11, "Alpe di Siusi", "Val Gardena", "40 min", ["Alpe di Siusi", "Witches' Benches"], "siusi"),
    (12, "Seceda, then Val di Funes at sunset", "Val Gardena", "1 h 10", ["Seceda ridge", "Santa Maddalena"], "seceda"),
    (13, "Adolf Munkel Weg, then Bolzano", "Bolzano", "1 h 30", ["Adolf Munkel Weg", "Ötzi museum"], "odle"),
    (14, "Bolzano to Venice", "", "2 h 40", ["Venice Marco Polo Airport"], None),
]

# where the subject sits in each photo, for object-position on wide crops
FOCUS = {"misurina": "50% 18%", "seceda": "50% 55%", "locatelli": "50% 40%", "fitzroy": "50% 60%", "elora": "50% 55%",
         "trecime-specie": "50% 35%", "braies": "50% 45%", "auronzo-park": "50% 60%"}


def focus(key: str) -> str:
    return f'style="object-position:{FOCUS.get(key, "50% 50%")}"'

SUMMARY = {
    "elora": "A day on the Grand River: tubing through the gorge, lunch in the village, home before dark.",
    "patagonia": "Thirteen nights: Ushuaia and the penguins first, then El Chaltén and Fitz Roy, then Perito Moreno, with Buenos Aires at both ends.",
    "dolomites": "Fourteen days built backwards from what governs them: a lot that holds twenty cars, a lift that runs on slots, a lake at first light.",
    "costa-rica": "Volcanoes, hot springs and whales, one big adventure a day.",
    "iceland": "The Ring Road in a camper van, timed to the week the campsites close and the dark comes back.",
    "chamonix": "Valley day hikes under Mont Blanc, with every lift day before the lifts close.",
    "rockies": "Fourteen nights with three tracks every day: a big hike, a family walk and a slow day.",
}
COUNTDOWN = {"elora": "In 6 days", "patagonia": "In 131 days", "dolomites": "In 268 days", "costa-rica": "In 118 days",
             "iceland": "In 321 days", "chamonix": "In 684 days", "rockies": "In 1,056 days"}

# Explore / places table rows: name, kind, status, area, season, kids, elevation, sources, marker
PLACE_ROWS = [
    ("Lago di Braies", "lake", "Planned", "Braies, South Tyrol", "Jun to Oct", "Kid friendly", "1,496 m", "3 sources", ""),
    ("Tre Cime di Lavaredo loop", "trail", "Planned", "Auronzo, Belluno", "Jun to Oct", "Kid friendly", "2,454 m", "4 sources", ""),
    ("Lago di Sorapis", "trail", "Planned", "Ampezzo, Belluno", "Late Jun to Oct", "Strong kids only", "1,925 m", "2 sources", ""),
    ("Seceda ridge", "viewpoint", "Planned", "Val Gardena, South Tyrol", "Jun to Oct", "Kid friendly", "2,519 m", "2 sources", ""),
    ("Croda del Becco", "trail", "Planned", "Braies, South Tyrol", "Mid-Jul to Sep", "12 and up", "2,810 m", "1 source", ""),
    ("Lagazuoi tunnels", "lift", "Planned", "Falzarego, Belluno", "Jun to Sep", "10 and up", "2,752 m", "1 source", "Unverified"),
    ("Cinque Torri", "viewpoint", "Planned", "Ampezzo, Belluno", "Jun to Sep", "10 and up", "2,361 m", "1 source", ""),
    ("Lago di Carezza", "lake", "Idea", "Val d'Ega, South Tyrol", "May to Oct", "Kid friendly", "1,520 m", "None yet", "No source yet"),
    ("Vallunga", "trail", "Idea", "Val Gardena, South Tyrol", "Jun to Oct", "Kid friendly", "", "Instagram post", "Location unconfirmed"),
    ("Cascate di Fanes", "trail", "Idea", "Ampezzo, Belluno", "Jun to Sep", "Kid friendly", "1,400 m", "Instagram post +1", "Unverified"),
]
