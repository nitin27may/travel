"""Write the D1b point rows into data/capture/points.json (run from the worktree root).

Usage: python3 research/runs/DATA-D1b-points/build_points_d1b.py <step> [<step> ...]
Steps: 1 (searched_none retries), 2 (approx points), 4 (Fanes), 6 (conflict rulings), 7 (person-check corrections).
Every value below was read on 2026-10-25 from the source named in its point_source (Overpass, Wikidata,
the land manager's or operator's page); the run note research/runs/DATA-D1b-points.md lists them.
"""
import json
import sys

PATH = "data/capture/points.json"
D = "read 2026-10-25 (lane DATA-D1b); agent checked, needs a person's check"
doc = json.load(open(PATH))
pts = doc["points"]
R = "legacy/canadian-rockies-sept-2029/"


def put(ref, lat, lon, src, role, text, approx=None):
    row = {"lat": round(lat, 6), "lon": round(lon, 6), "coord_src": src, "point_source": f"{text}; {D}", "point_role": role}
    if approx:
        row["approx"] = True
        row["approx_note"] = approx
    pts[ref] = row


def must_exist(ref):
    if ref not in pts:
        sys.exit(f"expected an existing row for {ref!r}")


def step1():
    """The searched_none records of D1: five found, Lac du Chatelard stays without a point."""
    for ref in [R + "trails/berg-lake-trail", R + "trails/fryatt-valley", "trip/patagonia-2027/trail:laguna de los tres",
                "trip/patagonia-2027/trail:laguna esmeralda", "trip/utah-five-parks/trail:windows section"]:
        if ref in pts:
            sys.exit(f"{ref} already has a point")
    put(R + "trails/berg-lake-trail", 53.049836, -119.215447, "osm", "parking",
        "OSM way 1185166549 (amenity=parking) at the end of Kinney Lake Road (way 157610641 ends 120 m south-west), where the "
        "Berg Lake Trail ways (157610634, relation 6035635 operator BCParks) start; BC Parks https://bcparks.ca/mount-robson-park/berg-lake-trail/ "
        "says the trail begins at the end of Kinney Lake Road")
    put(R + "trails/fryatt-valley", 52.648889, -117.89998, "osm", "trailhead",
        "OSM node 2520427794, where Fryatt Trail (way 244769982, operator Parks Canada, ref 122) leaves Geraldine Fire Road; the road is "
        "2.1 km long from 93A to this node and runs on 3.3 km beyond it, as Parks Canada's Geraldine page says ('continue for 6 km, 3.3 km "
        "beyond the Fryatt trailhead'); the Fryatt page says 'continue for 2 km'")
    put("trip/patagonia-2027/trail:laguna de los tres", -49.320282, -72.894965, "osm", "trailhead",
        "OSM node 7069713837 (highway=trailhead) at the north end of El Chalten, beside the board 'Senda al Fitz Roy' (node 11638941575) "
        "and 'Sendero Monte Fitz Roy' (node 11240129505); the park leaflet (folleto senderos zona norte PNLG 2024) puts Laguna de los Tres "
        "on the Fitz Roy path, 2 km from the APN visitor centre to the start of the path")
    put("trip/patagonia-2027/trail:laguna esmeralda", -54.721852, -68.121949, "osm", "parking",
        "OSM way 567999991 (amenity=parking) beside Ruta Nacional 3 at the start of the Sendero Laguna Esmeralda ways and relation 8861474; "
        "the Ushuaia tourism office page https://turismoushuaia.com/actividad/laguna-esmeralda/ says the path starts 18 km from Ushuaia on "
        "RN 3, at a large car park beside the road")
    put("trip/utah-five-parks/trail:windows section", 38.687113, -109.536636, "osm", "trailhead",
        "OSM node 4835435421 The Windows Trailhead (highway=trailhead), 20 m from the board 'Windows Trails' (node 7921541650); NPS "
        "https://www.nps.gov/places/the-windows-section-trailhead.htm lists parking and a trailhead at the Windows Section")


def step2():
    """The approximate points of D1: replace where a single sourced point exists."""
    for ref in [R + "adventures/sulphur-mountain-trail", R + "trails/bears-hump", R + "trails/cavell-meadows", R + "trails/crypt-lake",
                R + "trails/elk-lakes-lower-upper", R + "trails/elk-lakes-viewpoint", R + "trails/johnson-lake-loop", R + "trails/lillian-lake",
                R + "trails/opal-hills", R + "trails/red-rock-canyon-loop", R + "trails/skyline-trail", R + "trails/tent-ridge-horseshoe",
                R + "adventures/red-rock-parkway", R + "sights/whiteswan-lussier-hot-springs", R + "adventures/bow-valley-parkway-cycling",
                "part/place/lago-di-braies#walk", "part/place/rafting-on-the-rienza#place", "part/trip/iceland-ring-road-2027/sight:dettifoss#walk",
                "trip/chamonix-mont-blanc-2028/town:chamonix market", "trip/chamonix-mont-blanc-2028/trail:plan de l aiguille",
                "trip/iceland-ring-road-2027/trail:arnarstapi to hellnar", "trip/iceland-ring-road-2027/trail:fjadrargljufur canyon",
                "trip/iceland-ring-road-2027/trail:skaftafell svartifoss", "trip/patagonia-2027/trail:coastal path",
                "trip/patagonia-2027/trail:laguna capri", "trip/utah-five-parks/trail:pa rus trail", "trip/vermont-fall-2026/trail:stowe recreation path"]:
        must_exist(ref)
    # Rockies trailheads and meeting points
    put(R + "adventures/sulphur-mountain-trail", 51.14857, -115.55824, "osm", "parking",
        "OSM way 24306334 Banff Upper Hot Springs (amenity=parking); Banff & Lake Louise Tourism https://www.banfflakelouise.com/experiences/sulphur-mountain-trail "
        "gives 'Trailhead: Banff Upper Hot Springs parking area'")
    put(R + "trails/bears-hump", 49.060782, -113.908353, "osm", "trailhead",
        "OSM node 1814165734, the first vertex of Bear's Hump Trail (way 170265434), 60 m from Highway 5 (the Entrance Road) at the crest of the hill; "
        "Parks Canada https://parks.canada.ca/pn-np/ab/waterton/activ/experiences/randonee-hiking/promenades-walks: 'Trailhead: Across the Entrance Road "
        "from the Prince of Wales Hotel access road'. The D1 point (the townsite visitor centre, 1.1 km south) was wrong")
    put(R + "trails/cavell-meadows", 52.68736, -118.055639, "osm", "parking",
        "OSM relation 20689592 Mount Edith Cavell (upper lot) at the end of Mount Edith Cavell Road; Parks Canada https://parks.canada.ca/pn-np/ab/jasper/activ/experience/sentiers-trails/cavell "
        "gives 'Trailhead: The end of the Cavell Road' for trails 41 and 42")
    put(R + "trails/crypt-lake", 49.031121, -113.894211, "osm", "trailhead",
        "OSM way 185604526 Crypt Lake Trail, its vertex at the Upper Waterton Lake shore (the landing; the dock itself is not mapped); Parks Canada "
        "https://parks.canada.ca/pn-np/ab/waterton/activ/experiences/randonee-hiking/journee-day: a 15-minute boat ride 'brings you to the trailhead at Crypt Landing'")
    for ref in (R + "trails/elk-lakes-lower-upper", R + "trails/elk-lakes-viewpoint"):
        put(ref, 50.551024, -115.07094, "osm", "parking",
            "OSM way 102439897 (amenity=parking) at the end of the Elk River Forest Service Road, beside the Elk Lakes Cabin (way 173689739, Alpine Club of "
            "Canada) where Lower Elk Lake Trail (way 573768002) starts; BC Parks https://bcparks.ca/elk-lakes-park/ names the Elk Lakes trailhead parking lot "
            "and says the nearest lake is a 1 km walk. The D1 point (a park label node 4.6 km south-west) was wrong")
    put(R + "trails/johnson-lake-loop", 51.199584, -115.490354, "osm", "parking",
        "OSM way 1180102518 (amenity=parking) at the end of Johnson Lake Road, beside the Johnson Lake bus stop (node 13461323849); the Parks Canada "
        "Banff day-hikes table did not load for a script, so the official trailhead wording was not read")
    put(R + "trails/lillian-lake", 50.861178, -115.176195, "official", "trailhead",
        "Alberta Parks trail report Galatea Creek https://www.albertaparks.ca/parks/kananaskis/kananaskis-country/advisories-public-safety/trail-reports/kananaskis-valley/galatea-creek/ "
        "(its map's trailhead point 'Galatea', Day Use); OSM way 262156419 (amenity=parking) is 40 m away, beside Galatea Lakes Tr way 24851694")
    put(R + "trails/opal-hills", 52.731616, -117.631954, "osm", "trailhead",
        "OSM way 1532999492 Opal Hills Loop (operator Parks Canada, ref 22), its vertex at the north-east corner of the upper Maligne Lake lots (relations "
        "21018591 to 21018593); Parks Canada https://parks.canada.ca/pn-np/ab/jasper/activ/experience/sentiers-trails/maligne: the farthest of the three "
        "lots, 'The trail begins at the northeast corner'")
    put(R + "trails/red-rock-canyon-loop", 49.130849, -114.025955, "osm", "parking",
        "OSM way 1059104807 (amenity=parking) at the end of Red Rock Parkway, beside the start of Red Rock Canyon Trail (way 24818808); the other lot "
        "(way 1059104806) is 270 m south. Parks Canada promenades-walks page: 'Trailhead: Red Rock Canyon upper parking lot'")
    put(R + "trails/skyline-trail", 52.725769, -117.645369, "osm", "trailhead",
        "OSM way 1241750492 Skyline Trail (operator Parks Canada, ref 100), its first vertex where it leaves the Bald Hills Trail beside the Maligne Lake "
        "Parking lot (relation 21018594, 100 m); Parks Canada maligne page: park as for the Bald Hills Trail and take the trail 50 m to the right, 'This is "
        "the Skyline Trail'")
    put(R + "trails/tent-ridge-horseshoe", 50.846824, -115.357044, "osm", "trailhead",
        "OSM way 24836693 Tent Ridge Track, its vertex on Mount Shark Road (way 32219782); no official page (Alberta Parks has no Tent Ridge trail report), "
        "so the start rests on OSM alone")
    put(R + "adventures/red-rock-parkway", 49.077444, -113.8793, "osm", "route_start",
        "OSM way 32162365 Red Rock Parkway, its first vertex where it leaves Highway 5 (way 170281670); 14.05 km of mapped parkway to Red Rock Canyon; "
        "Parks Canada https://parks.canada.ca/pn-np/ab/waterton/activ/experiences/conduite-driving: the parkway 'travels 15 km up the Blakiston Valley "
        "and ends at Red Rock Canyon'")
    put(R + "sights/whiteswan-lussier-hot-springs", 50.135184, -115.57688, "osm", "centre",
        "OSM node 2368067925 Lussier Hot Springs (natural=spring); Wikidata Q6705238 P625 50.1352,-115.577 agrees within 10 m. The record's type is a hot "
        "spring, so the point is the spring; the D1 point was the Whiteswan Lake park point 2.9 km away")
    put(R + "adventures/bow-valley-parkway-cycling", 51.170138, -115.65467, "osm", "route_start",
        "OSM way 1431795407 Bow Valley Parkway (ref 1A), its eastern end; Parks Canada https://parks.canada.ca/pn-np/ab/banff/visit/les10-top10/promenade-de-la-vallee-de-la-bow-bow-valley-parkway "
        "names the 17 km section 'between Fireside Day-use Area and Johnston Canyon' and tells riders to park at the Banff train station",
        "the parkway's east end; the closure gate is not mapped and the page names Fireside Day-use Area, about 400 m north, as the section's end")
    # Dolomites
    put("part/place/lago-di-braies#walk", 46.699504, 12.085094, "osm", "trailhead",
        "OSM node 12978036296 (tourism=information, map) on the north shore beside the Hotel Pragser Wildsee board (node 6554128438), 8 m from the first "
        "vertex of the stored track; the walk is a loop, so this is where it is joined, not a surveyed start")
    put("part/place/rafting-on-the-rienza#place", 46.809965, 11.792573, "osm", "meeting",
        "OSM way 42881996 Fussballplatz St. Sigmund (leisure=pitch), the sports ground of San Sigismondo with the pitches 1134655979 and 1134655980; Rafting "
        "Club Activ https://www.rafting-club-activ.com/en/contact/ gives 'Meeting point Rienz / Eisack: Sports zone St. Sigmund'")
    # Iceland
    put("part/trip/iceland-ring-road-2027/sight:dettifoss#walk", 65.811437, -16.400243, "osm", "parking",
        "OSM way 1531241656 (amenity=parking) west of the falls, toilets node 6646954959 90 m north; Vatnajokull National Park D1 page "
        "https://www.vatnajokulsthjodgardur.is/en/areas/jokulsargljufur/dettifoss-d1: 'Starting point: Car park west of Dettifoss', and the Dettifoss page "
        "says 1 km from the parking lot to the viewpoint")
    put("trip/iceland-ring-road-2027/trail:arnarstapi to hellnar", 64.764553, -23.625787, "official", "trailhead",
        "Snaefellsjokull National Park trail 28 GPX https://snaefellsjokull.is/storage/585/Arnarstapi-Hellnar.gpx (linked from the trail page "
        "https://snaefellsjokull.is/en/gonguleid/arnarstapi-hellnar-2), its Arnarstapi end; the Hellnar end is 64.751782,-23.645262")
    put("trip/iceland-ring-road-2027/trail:fjadrargljufur canyon", 63.770332, -18.171777, "osm", "parking",
        "OSM relation 20613921 (amenity=parking, operator Parka, https://parka.is/pay/fjadrargljufur/) beside the toilets (way 368777102) at the canyon")
    put("trip/iceland-ring-road-2027/trail:skaftafell svartifoss", 64.016471, -16.966816, "official", "trailhead",
        "Vatnajokull National Park S2 GPX (linked from https://www.vatnajokulsthjodgardur.is/en/areas/skaftafell/svartifoss-sjonarsker-sel-s2), its first "
        "point; the page gives 'Starting point Skaftafellsstofa', and the D1 visitor-centre point (OSM way 200175906) is 32 m away")
    # Chamonix
    put("trip/chamonix-mont-blanc-2028/town:chamonix market", 45.924773, 6.871946, "osm", "centre",
        "OSM relation 2569238 Place du Mont Blanc (highway=pedestrian); Haute-Savoie tourism https://www.tourisme-haute-savoie.com/en/markets-in-haute-savoie/ "
        "lists the Chamonix market at Place du Mont Blanc, 8am to 1pm")
    put("trip/chamonix-mont-blanc-2028/trail:plan de l aiguille", 45.90165, 6.884819, "osm", "trailhead",
        "OSM node 31000524 Aiguille du Midi 1 (aerialway=station), the Plan de l'Aiguille station, 50 m from the guidepost 'Plan de l'Aiguille' (node "
        "3626512712); Chamonix tourism https://en.chamonix.com/spring-hikes/grand-balcon-nord-plan-de-l-aiguille-du-midi-montenvers: 'From the cable car "
        "station, head down towards the Refuge du Plan de l'Aiguille'")
    # Patagonia
    put("trip/patagonia-2027/trail:coastal path", -54.846367, -68.480848, "osm", "parking",
        "OSM way 68895189 (amenity=parking) at Ensenada Zaratiegui, beside the board node 6039887716 where the Senda Costera ways start; Parques "
        "Nacionales https://www.argentina.gob.ar/parquesnacionales/patagonia-austral/senderos-del-parque-nacional-tierra-del-fuego: the Costera path "
        "'nace en el estacionamiento de Ensenada Zaratiegui'")
    put("trip/patagonia-2027/trail:laguna capri", -49.320282, -72.894965, "osm", "trailhead",
        "OSM node 7069713837 (highway=trailhead) at the north end of El Chalten, beside the 'Senda al Fitz Roy' map board; the PNLG leaflet puts Laguna "
        "Capri on the Fitz Roy path (4 km, 1:45 one way)")
    # Utah and Vermont
    put("trip/utah-five-parks/trail:pa rus trail", 37.201783, -112.986777, "osm", "trailhead",
        "OSM way 14326805 Pa'rus Trail (operator National Park Service), its south end by the Zion Canyon Visitor Center; NPS "
        "https://www.nps.gov/thingstodo/hike-pa-rus-trail.htm: 'Start from either the Zion Canyon Visitor Center (shuttle stop #1) or from Canyon Junction'")
    put("trip/vermont-fall-2026/trail:stowe recreation path", 44.466091, -72.685036, "osm", "trailhead",
        "OSM way 204763538 Stowe Recreational Path, its village end (the southernmost vertex of the 30 mapped ways); Town of Stowe "
        "https://www.stowevt.gov/Departments/Parks-Recreation/Parks-Facilities/Stowe-Recreation-Path: the path runs 'from Stowe Village to Topnotch Resort'")


def step4():
    """Fanes: the official route starts at the park information point; the payoff is the falls."""
    must_exist("part/place/cascate-di-fanes#payoff")
    put("part/place/cascate-di-fanes#payoff", 46.593995, 12.083459, "osm", "centre",
        "OSM node 9861910524 Cascate di Fanes (waterway=waterfall); Wikidata Q67370898 P625 46.594517,12.084188 is 70 m away and the belvedere the "
        "official route ends at (node 1398755045 'Punto panoramico Cascate di Fanes') 130 m; Cortina tourism "
        "https://cortina.dolomiti.org/it/escursioni/botanical-path-to-the-cascate-di-fanes-en")
    put("place/cascate-di-fanes", 46.593809, 12.112955, "osm", "trailhead",
        "OSM node 470623991 Centro visitatori del parco (tourism=information, office), the Ampezzo Dolomites park information point by Ponte Felizon; "
        "Cortina tourism (the route page above): 'Start: Ufficio informazioni del Parco', path 10, 7 km return, +249 m. This beats the snapshot "
        "trailhead (OSM node 7920730765 at Pian de Loa), which is where the stored OSM track starts, 2 km along the route")


def step6():
    """Conflict rulings: Grand View Point (the place), Cameron Lake."""
    must_exist(R + "sights/cameron-lake")
    put(R + "sights/cameron-lake", 49.0094, -114.051, "wikidata", "centre",
        "Wikidata Q3214786 P625 (Cameron Lake); OSM relation 8299848 Cameron Lake (natural=water, the Canadian lake) has its centre at 49.0092,-114.05106, "
        "25 m away, so the two agree. The D1 conflict compared Wikidata with OSM way 588314114, an NHD polygon of the small part south of the border")
    put("trip/utah-five-parks/viewpoint:grand view point", 38.310154, -109.856773, "osm", "centre",
        "OSM node 6806471756 Grand View Point Overlook (tourism=viewpoint) at the road end; NPS https://www.nps.gov/places/grand-view-point.htm: 'Grand View "
        "Point lies at the southernmost end of the Island in the Sky scenic drive'. Wikidata Q62073199 P625 38.32221,-109.84901 (from GNIS 1435608) lies "
        "1.4 km north-east on another pull-out (parking ways 1190800607 and 1239515667) and is kept as the conflicting value")
    must_exist("part/trip/utah-five-parks/viewpoint:grand view point#walk")
    put("part/trip/utah-five-parks/viewpoint:grand view point#walk", 38.3108, -109.85661, "osm", "trailhead",
        "OSM node 6806471755 Grand View Trail Trailhead (highway=trailhead) at the road end, beside the Grand View Point Parking (relation 15336057); NPS "
        "https://www.nps.gov/places/grand-view-point.htm puts the overlook and trailhead at the southernmost end of the scenic drive, so OSM wins; "
        "Wikidata Q62073199 P625 38.32221,-109.84901 (from GNIS) is 1.4 km north-east and is the conflicting value")
    must_exist(R + "trails/cory-pass-loop")
    put(R + "trails/cory-pass-loop", 51.17381, -115.65467, "osm", "parking",
        "OSM node 508583984 Cory Pass Trail Parking, at the end of an unpaved access road (ways 32092152, 32093536) off Highway 1A by its east end; the "
        "Cory Pass Trail way 24831440 starts 23 m from it. The legacy name 'Fireside picnic area' is the same place: Parks Canada's Bow Valley Parkway page "
        "names Fireside Day-use Area at the parkway's east end, and hiking guides describe the Cory Pass start as the Fireside lot about 1 km up an access "
        "road from Highway 1A, with the trail across the creek (no official page with the trailhead wording was read)")


def step7():
    """Corrections from the person-check sample (run note, step 7)."""
    must_exist(R + "trails/upper-kananaskis-lake-loop")
    put(R + "trails/upper-kananaskis-lake-loop", 50.631545, -115.139913, "official", "trailhead",
        "Alberta Parks trail report Upper Lake https://www.albertaparks.ca/parks/kananaskis/kananaskis-country/advisories-public-safety/trail-reports/peter-lougheed/upper-lake/ "
        "(its map's trailhead point 'North Interlakes', Day Use; the other is 'Upper Lake' at 50.612362,-115.117752); OSM node 269821248 North Interlakes "
        "(amenity=parking) is 5 m away. The D1 point, OSM node 269822623 Upper Lake Circuit Junction, is a trail junction 770 m west")


STEPS = {"1": step1, "2": step2, "4": step4, "6": step6, "7": step7}
for s in sys.argv[1:]:
    STEPS[s]()
doc["points"] = dict(sorted(pts.items()))
with open(PATH, "w") as f:
    json.dump(doc, f, indent=2, ensure_ascii=False)
    f.write("\n")
print("rows", len(pts), "approx", sum(1 for v in pts.values() if v.get("approx")))
