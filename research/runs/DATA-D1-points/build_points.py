"""Write the D1 point rows into data/capture/points.json (run from the worktree root)."""
import json, sys

TARGETS = json.load(open("/tmp/d1/targets.json"))
PATH = "data/capture/points.json"
D = "read 2026-10-25 (lane DATA-D1); agent checked, needs a person's check"
doc = json.load(open(PATH))
pts = doc["points"]


def find(sub):
    m = [t["ref"] for t in TARGETS if sub in t["ref"]]
    if len(m) > 1:
        m = [r for r in m if r.endswith("/" + sub) or r.endswith(":" + sub)]
    if len(m) != 1:
        sys.exit(f"ambiguous or missing target {sub!r}: {m}")
    return m[0]


def put(ref, lat, lon, src, role, text, approx=None):
    row = {"lat": lat, "lon": lon, "coord_src": src, "point_source": f"{text}; {D}", "point_role": role}
    if approx:
        row["approx"] = True
        row["approx_note"] = approx
    pts[ref] = row


def wd(qid, label):
    return f"Wikidata {qid} P625 ({label})"


T = put
# ---- Iceland
T(find("sight:dettifoss#walk"), 65.82192, -16.38817, "wikidata", "centre", wd("Q210280", "Dettifoss"),
  "the falls, not the west car park the park page names (research/trips/iceland-ring-road/suitability.md); fix = car park node or a person's check")
T(find("sight:namaskard"), 65.64722, -16.82667, "wikidata", "centre", wd("Q2006297", "Namaskard"))
T(find("arnarstapi to hellnar"), 64.76988, -23.62232, "wikidata", "trailhead", wd("Q774048", "Arnarstapi village"),
  "village centre at the Arnarstapi end, not the path start; Hellnar Q1366915 is 64.75,-23.65")
T(find("fjadrargljufur"), 63.7712, -18.17144, "osm", "trailhead",
  "OSM node 3726212118 Fjaðrárgljúfur (tourism=information, the board at the canyon); Wikidata Q956845 P625 63.77125,-18.17194 is 40 m away",
  "information board at the canyon; no highway=trailhead node is mapped")
T(find("skaftafell svartifoss"), 64.01667, -16.96633, "osm", "trailhead",
  "OSM way 200175906 Skaftafellsstofa (the visitor centre); Svartifoss Q1145786 P625 is 64.0277,-16.97525, 1.2 km away",
  "visitor centre; the start named on the park's S2 trail page was not re-read for this point")
# ---- Dolomites
T(find("rafting-on-the-rienza#place"), 46.81113, 11.80289, "osm", "meeting",
  "OSM node 537070690 Sankt Sigmund - San Sigismondo (place node); Rafting Club Activ FAQ https://www.rafting-club-activ.com/en/faq/ names the Rienz meeting point as its rafting station in the St. Sigmund sports zone, Kiens",
  "the village node; the sports zone is not mapped in OSM")
# ---- Algonquin
T(find("track and tower"), 45.56001, -78.57754, "osm", "parking",
  "OSM way 338153829 Track and Tower Trail (amenity=parking, access=permit), 90 m from the first mapped footway; the trail's own page was not re-read")
T(find("dorset lookout"), 45.25218, -78.89325, "osm", "centre", "OSM node 2944856296 (tourism=viewpoint, Dorset lookout)")
T(find("dwight beach"), 45.32895, -79.01159, "osm", "centre", "OSM way 659376476 Dwight Beach (natural=beach)")
# ---- Chamonix
T(find("lift:aiguille du midi"), 45.91814, 6.87014, "osm", "entrance",
  "OSM node 31000525 Aiguille du Midi 1 (aerialway=station), the valley station; Wikidata Q3088020 P625 45.9182,6.87016 agrees within 15 m")
T(find("montenvers train#top"), 45.93173, 6.91742, "osm", "entrance",
  "OSM node 283313364 Montenvers–Mer de Glace railway station; Wikidata Q1946088 P625 45.93306,6.91722 (Montenvers) is 150 m away")
T(find("town:chamonix market"), 45.92222, 6.86889, "wikidata", "centre", wd("Q83236", "Chamonix-Mont-Blanc"),
  "town centre; the market site is not named in the research")
T(find("lac blanc via flegere"), 45.96034, 6.88704, "osm", "trailhead",
  "OSM node 275376985 Flégère (aerialway=station), the lift station where the Lac Blanc route via La Flégère starts; Wikidata Q3209029 P625 45.9611,6.88559 agrees within 120 m")
T(find("plan de l aiguille"), 45.90344, 6.88758, "wikidata", "centre", wd("Q19947633", "Plan de l'Aiguille"),
  "the mid-station area; the walk's own start is not stated")
# ---- Utah
T(find("narrows from the temple"), 37.28533, -112.9478, "osm", "trailhead",
  "OSM node 5724346323 (highway=trailhead at the Temple of Sinawava); Wikidata Q49340993 P625 37.2847,-112.948 agrees within 70 m")
T(find("pa rus"), 37.20308, -112.98322, "osm", "trailhead",
  "OSM way 14326805 Pa'rus Trail (highway=cycleway), a vertex 400 m from Zion Canyon Visitor Center node 6465537815",
  "a mapped vertex of the path, not a trailhead node; the path starts near the visitor centre")
T(find("navajo loop and queens"), 37.6227, -112.16613, "osm", "trailhead",
  "OSM node 5247557309 Navajo Loop Trailhead (highway=trailhead); Wikidata Q104976865 P625 37.61776,-112.16242 is the loop, 560 m away")
T(find("lower calf creek"), 37.79569, -111.41365, "osm", "trailhead",
  "OSM node 490738940 Lower Calf Creek Falls Trailhead (highway=trailhead); Wikidata Q105099730 P625 37.79603,-111.41367 agrees within 40 m")
T(find("grand view point#walk"), 38.3108, -109.85661, "osm", "trailhead",
  "OSM node 6806471755 Grand View Trail Trailhead (highway=trailhead), at the road end; Wikidata Q62073199 P625 38.32221,-109.84901 sits 1.4 km north-east and does not agree, so OSM wins")
# ---- Vermont
bridges = [(44.90724, -72.65565), (44.90325, -72.63971), (44.86768, -72.64798), (44.89966, -72.64464), (44.85859, -72.61257)]
T(find("covered bridge loop"), round(sum(b[0] for b in bridges) / 5, 5), round(sum(b[1] for b in bridges) / 5, 5), "osm", "centre",
  "mean of five Montgomery covered bridges in OSM (Longley way 1038791200, Fuller way 967879573, West Hill way 1028147668, Comstock way 1038791204, Hutchins way 1028142995); the plan's loop is Montgomery per research/trips/vermont-fall-2026/suitability.md",
  "mean of the bridge points, an area-level centre for the loop; the drive's own start is not stated")
T(find("stowe recreation path"), 44.46631, -72.68512, "osm", "trailhead",
  "OSM way 204763538 Stowe Recreational Path (highway=cycleway) at Stowe village",
  "a mapped way of the path in the village; the gostowe.com page lists four parking areas and no single start")
# ---- Patagonia
T(find("beagle channel boat#place"), -54.87556, -68.13639, "wikidata", "centre", wd("Q202671", "Beagle Channel, centroid"),
  "centroid of the channel; the boat's departure point is not stated")
T(find("town:cafe and bookshops"), -34.59972, -58.38194, "wikidata", "centre", wd("Q1486", "Buenos Aires"),
  "city level; the suitability notes name Palermo, Recoleta and San Telmo, not one street")
T(find("town:harbour walk"), -54.80659, -68.29963, "osm", "centre", "OSM way 745788839 Costanera de Ushuaia (highway=footway) along the harbour",
  "a point on the waterfront footway; the walk has no stated start")
T(find("evening fitz roy glow"), -49.33141, -72.88613, "wikidata", "centre", wd("Q1323978", "El Chaltén"),
  "village level; the plan names no viewpoint for the glow")
T(find("trail:laguna capri"), -49.30485, -72.93608, "osm", "centre",
  "OSM node 12697849001 Laguna Capri (tourism=attraction); Wikidata Q124360343 P625 -49.3049,-72.936 agrees within 10 m",
  "the lake, which is the trail's destination; no trailhead node is mapped")
T(find("trail:coastal path"), -54.84655, -68.48073, "osm", "trailhead",
  "OSM node 11237179525 Bahia Ensenada Zaratiegui (tourism=attraction); the Senda Costera ways (641314494 and others) run from here",
  "the bay at the mapped end of the Senda Costera; which end the park page counts as the start was not re-read")
# ---- Rockies
L = "legacy/canadian-rockies-sept-2029/"
T(find("sights/johnston-canyon#walk"), 51.24556, -115.83979, "osm", "parking",
  "OSM way 764291434 Johnston Canyon (amenity=parking), 100 m from the information boards at the canyon start")
T(find("johnston-canyon#ink-pots-trai"), 51.24556, -115.83979, "osm", "parking",
  "OSM way 764291434 Johnston Canyon (amenity=parking); the Ink Pots trail leaves the Johnston Canyon path")
T(find("sights/paint-pots"), 51.16992, -116.14761, "osm", "entrance",
  "OSM way 234163234 Paint Pots Parking (the point already held for trails/paint-pots-walk; trailhead node 3611622970 is 10 m away)")
T(find("kicking-horse-family-floa") if False else "part/legacy/canadian-rockies-sept-2029/adventures/kicking-horse-family-float#river-base", 51.24283, -116.66093, "osm", "meeting",
  "OSM way 1545703289 Wild Water Adventures Riverbase (2750 Beaverfoot Road, the address on https://wildwater.com/contact/, geocoded by Nominatim)")
for suffix, label in [("#place", "Kicking Horse River"), ("#place-upper-section", "Kicking Horse River, upper section"), ("#place-lower-canyon", "Kicking Horse River, lower canyon")]:
    ref = "part/legacy/canadian-rockies-sept-2029/adventures/kicking-horse-family-float" + suffix
    T(ref, 51.3, -116.983, "wikidata", "centre", wd("Q1337358", "Kicking Horse River"),
      "the river's point at Golden; the rafted section lies upstream, between the river base and the Park Bridge, and no section point was found")
T("part/legacy/canadian-rockies-sept-2029/adventures/kananaskis-river-raft#place", 51.09465, -115.0619, "wikidata", "centre", wd("Q3433709", "Kananaskis River"),
  "a point on the river; no raft put-in was found in OSM or named on a read operator page")
T(find("canmore-nordic-centre#cen"), 51.0925, -115.39, "wikidata", "centre", wd("Q1003855", "Canmore Nordic Centre Provincial Park"))
T(find("bow-valley-parkway-cycling"), 51.19265, -115.73569, "osm", "route_start",
  "OSM way 160691667 Bow Valley Parkway (highway=secondary); Wikidata Q111270263 has no P625",
  "a point on the parkway, not the closure gate; the gate positions were not read")
T(find("jasper-bike-rental"), 52.87541, -118.08094, "osm", "meeting",
  "OSM node 13225697445 Vicious - Cycle and Snow, Jasper (the shop at https://viciouscycleandsnow.ca/)")
T(find("lake-louise-sightseeing"), 51.44214, -116.16119, "osm", "meeting",
  "OSM way 1263557754 Grizzly Express Gondola base station; the same point as the Lake Louise gondola adventure record, the record names the product the same")
T(find("nakiska-summer"), 50.94254, -115.15173, "osm", "meeting",
  "OSM way 1327131488 Nakiska Day Lodge; Wikidata Q1588256 P625 50.944,-115.147 is 350 m away")
T(find("adventures/red-rock-parkway"), 49.13166, -114.0263, "wikidata", "route_start", wd("Q22589340", "Red Rock Canyon, the parkway's end"),
  "the canyon at the end of the parkway, not the start on Hwy 5")
T(find("sights/red-rock-parkway"), 49.13166, -114.0263, "wikidata", "centre", wd("Q22589340", "Red Rock Canyon, the parkway's end"),
  "the canyon at the end of the parkway; the drive has no single point")
T(find("sulphur-mountain-trail"), 51.14857, -115.55824, "osm", "parking",
  "OSM way 24306334 Banff Upper Hot Springs (amenity=parking), 250 m from the first mapped Sulphur Mountain path way",
  "the car park nearest the mapped path; no trailhead node is mapped")
T(find("beauvais-lake-pp"), 49.4142, -114.115, "wikidata", "centre", wd("Q3364703", "Beauvais Lake Provincial Park"))
T(find("cameron-lake"), 49.0094, -114.051, "wikidata", "centre", wd("Q3214786", "Cameron Lake") + "; OSM way 588314114 Cameron Lake centroid is 48.99837,-114.0539, 1.2 km away, so the two disagree and Wikidata is kept for the lake point",
  "the two sources differ by 1.2 km")
T(find("sights/elbow-falls"), 50.86769, -114.77899, "osm", "centre", "OSM node 2960428931 Elbow Falls; Wikidata Q3893876 P625 50.8678,-114.779 agrees within 20 m")
T(find("lake-magog"), 50.90222, -115.6325, "wikidata", "centre", wd("Q1557774", "Lake Magog") + "; OSM way 355375756 Lake Magog centroid 50.90089,-115.63242 agrees")
T(find("maligne-canyon"), 52.9203, -118.011, "wikidata", "centre", wd("Q6743519", "Maligne Canyon") + "; OSM node 1677700364 agrees within 60 m")
T(find("miette-hot-springs"), 53.1299, -117.771, "wikidata", "centre", wd("Q14874867", "Miette Hot Springs") + "; OSM node 3705593955 agrees within 150 m")
T(find("mount-edith-cavell"), 52.68257, -118.04998, "osm", "centre",
  "OSM node 349118023 Edith Cavell Pond (tourism=viewpoint); the peak itself (node 2698521553) is 1.8 km away")
T(find("prince-of-wales"), 49.0589, -113.904, "wikidata", "entrance", wd("Q3145638", "Prince of Wales Hotel"))
T(find("smith-dorrien-trail"), 50.89389, -115.285, "wikidata", "centre", wd("Q3364735", "Spray Valley Provincial Park") + "; Q104987926 (Smith-Dorrien Trail) has no P625",
  "the park the road runs through; the road is a line and has no single point")
T(find("top-of-the-world-pp"), 49.847, -115.442, "wikidata", "centre", wd("Q7824710", "Top of the World Provincial Park"))
T(find("sights/wapta-falls"), 51.187, -116.576, "wikidata", "centre", wd("Q37367", "Wapta Falls") + "; OSM way 587632433 agrees within 100 m")
T(find("waterton-townsite"), 49.05092, -113.90702, "osm", "centre", "OSM node 9174974666 Waterton Park (place=hamlet); Wikidata Q7974475 P625 49.0517,-113.914 is 600 m west")
T(find("whiteswan-lussier"), 50.1192, -115.545, "wikidata", "centre", wd("Q14874788", "Whiteswan Lake Provincial Park") + "; Lussier Hot Springs Q6705238 P625 50.1352,-115.577 (OSM node 2368067925 agrees) is 2.5 km north-west",
  "the park point; the hot springs are 2.5 km away and are a separate stop")
T(find("assiniboine-mount-shark-to-magog"), 50.859, -115.37868, "osm", "parking", "OSM way 171641445 Mount Shark Parking (legacy trailhead: Mount Shark)")
T(find("trails/bears-hump"), 49.05052, -113.9094, "osm", "trailhead",
  "OSM way 1125051515 Waterton Lakes National Park (tourism=information) by the townsite; the legacy trail data names the Waterton Visitor Centre as the trailhead; Bear's Hump Trail way 170265434 starts about 1 km north",
  "the information point near the visitor centre, not a trailhead node")
T(find("beauvais-lake-trail"), 49.41671, -114.11183, "osm", "parking", "OSM way 459887166 Beauvais Lake Provincial Park - Day Use Parking (legacy trailhead: Beauvais Lake day use)")
T(find("burstall-pass"), 50.79077, -115.30362, "osm", "parking",
  "OSM way 262485800 Burstall Pass Parking (legacy trailhead: Burstall Pass trailhead, Smith-Dorrien); the pass is 5 km south-west (Burstall Pass Trail way 297121313)")
T(find("trails/cavell-meadows"), 52.68316, -118.04783, "osm", "trailhead",
  "OSM way 1514037767 Cavell Meadows Trail, the first mapped way by the pond (legacy trailhead: Cavell Road)",
  "midpoint of the first mapped trail way; no trailhead node is mapped")
T(find("trails/chester-lake"), 50.79054, -115.3006, "osm", "parking", "OSM way 375083514 Chester Lake Trailhead Parking")
T(find("cory-pass-loop"), 51.17381, -115.65467, "osm", "parking",
  "OSM node 508583984 Cory Pass Trail Parking on Hwy 1A (legacy trailhead: Fireside picnic area; the lot's name and the legacy name were not shown to be the same place)")
T(find("trails/crypt-lake"), 49.00139, -113.84111, "wikidata", "centre", wd("Q22546207", "Crypt Lake") + "; OSM way 82676125 agrees within 40 m",
  "the lake, the trail's destination; the Crypt Landing dock (the legacy trailhead) is not mapped")
T(find("elbow-falls-loop"), 50.86756, -114.78357, "osm", "parking", "OSM node 270030306 Elbow Falls (amenity=parking)")
T(find("elk-lakes-lower-upper"), 50.52424, -115.1207, "osm", "trailhead", "OSM node 3067784923 Elk Lakes Park (leisure=nature_reserve), the node at the park's southern end",
  "a park label node; the Elk Lakes trailhead is not mapped, and the first mapped trail way (362802175) is 1.8 km north")
T(find("elk-lakes-viewpoint"), 50.52424, -115.1207, "osm", "trailhead", "OSM node 3067784923 Elk Lakes Park (leisure=nature_reserve), the node at the park's southern end",
  "a park label node; the Elk Lakes trailhead is not mapped, and the first mapped trail way (362802175) is 1.8 km north")
T(find("johnson-lake-loop"), 51.19705, -115.48385, "osm", "centre", "OSM way 40021099 Johnson Lake (natural=water), Wikidata Q1702469 P625 51.1969,-115.484 agrees",
  "the lake; the loop's trailhead is not mapped (the nearest stop is the Johnson Lake bus stop, node 13461323849, 500 m away)")
T(find("trails/lillian-lake"), 50.86461, -115.24883, "osm", "centre", "OSM way 604096200 Lillian Lake Trail at the lake; Wikidata Q22431073 P625 50.86361,-115.25056 agrees",
  "the lake; the legacy trailhead (Galatea Day Use, Hwy 40) is not mapped and the Galatea Lakes Tr ways near Hwy 40 are 5 km east")
T(find("mount-indefatigable-viewpoint"), 50.63157, -115.13998, "osm", "parking",
  "OSM node 269821248 North Interlakes (amenity=parking); OSM node 3762652045 is tagged 'Indefatigable Trail Decomissioned 2005' 400 m away (an operator question: is the route still open?)")
T(find("trails/opal-hills"), 52.73582, -117.62623, "osm", "trailhead", "OSM way 1532999492 Opal Hills Loop (legacy trailhead: Maligne Lake Road)",
  "midpoint of a mapped loop way; no trailhead node is mapped")
T(find("red-rock-canyon-loop"), 49.13089, -114.0271, "osm", "trailhead", "OSM way 24818808 Red Rock Canyon Trail",
  "a mapped way of the loop at the canyon; no trailhead node is mapped")
T(find("trails/ribbon-creek"), 50.93274, -115.14858, "osm", "trailhead", "OSM node 3686938459 Ribbon Creek Tr Entry (legacy trailhead: Ribbon Creek day use)")
T(find("skyline-trail"), 52.72565, -117.6429, "osm", "trailhead", "OSM node 5156308323 Skyline trail (3days) (tourism=viewpoint) at the Maligne Lake outlet",
  "a viewpoint label at the lake end; no trailhead node is mapped")
T(find("sunburst-lake-magog"), 50.90443, -115.63918, "osm", "trailhead", "OSM node 815130880 Lake Magog Campground (the legacy trailhead is the Lake Magog campground)")
T(find("tent-ridge-horseshoe"), 50.83283, -115.36819, "osm", "trailhead", "OSM way 24836693 Tent Ridge Track (the peak is node 2687421271 at 50.82,-115.3736)",
  "a mapped way of the route; no Tent Ridge trailhead is mapped (legacy trailhead: Tent Ridge trailhead, Smith-Dorrien)")
T(find("upper-kananaskis-lake-loop"), 50.63245, -115.15074, "osm", "trailhead", "OSM node 269822623 Upper Lake Circuit Junction (highway=trailhead); the North Interlakes lot (node 269821248) is 700 m east")
T(find("wapta-falls-trail"), 51.20409, -116.58525, "osm", "parking", "OSM way 658732269 Wapta Falls Parking; the trail ways (1303953044 and others) start 300 m south")

# ---- Waterton marina (3.61c): the earlier row used the cruise company's building; the marina is a mapped harbour node 105 m east.
pts["legacy/canadian-rockies-sept-2029/adventures/waterton-cruise"] = {
    "lat": 49.05398, "lon": -113.90574, "coord_src": "osm", "point_role": "meeting",
    "point_source": "OSM node 270866424 Waterton Harbour (leisure=marina), where the OSM ferry route ways 24919450/24919462 (Canada-USA Border Cruise, website watertoncruise.com) start 130 m to the north-east; the earlier point, way 678717446 Waterton Shoreline Cruises (a commercial building on Waterton Avenue), is 105 m west; " + D,
}
# ---- Elk rut (3.61d): area level
elk = pts["legacy/canadian-rockies-sept-2029/adventures/elk-rut"]
elk["point_role"] = "centre"
elk["approx"] = True
elk["approx_note"] = "area level: the Banff townsite, where the park says elk are seen; the rut has no single viewing point"

# ---- Dolomites destination points: last vertex of the stored OSM track (cut at the destination)
def end_vertex(name):
    g = json.load(open(f"data/tracks/{name}.json"))["geometry"]
    lon, lat = g[-1]
    return lat, lon


for ref, trk, role, what in [
    ("part/place/cascate-di-fanes#payoff", "fanes-falls", "centre", "the falls"),
    ("part/place/sass-pordoi-and-piz-boe#payoff", "pordoi", "summit", "Sass Pordoi and Piz Boè"),
]:
    lat, lon = end_vertex(trk)
    pts[ref] = {
        "lat": lat, "lon": lon, "coord_src": "osm", "point_role": role,
        "point_source": f"last vertex of the stored track data/tracks/{trk}.json (OSM, ODbL, read 2026-10-19; the track is cut at the destination, {what}); {D}",
    }

doc["points"] = dict(sorted(pts.items()))
json.dump(doc, open(PATH, "w"), indent=2, ensure_ascii=False)
open(PATH, "a").write("\n")
print("rows", len(pts))
