"""Write the D1b run record data/capture/runs/api-2026-10-25-data-d1b-points.json (run from the worktree root).

Usage: python3 research/runs/DATA-D1b-points/build_run_d1b.py <requests.log> <step> [<step> ...]
The request log is the JSON-lines log of the cached fetcher used for this run (one line per request, with host and status);
host counts are read from it, so they are exact. Steps add their results cumulatively.
"""
import json
import sys
from collections import Counter

LOG, STEPS = sys.argv[1], set(sys.argv[2:])
R = "legacy/canadian-rockies-sept-2029/"
OUT = "data/capture/runs/api-2026-10-25-data-d1b-points.json"

res = []


def filled(ref, src, host, reason=None, outcome="filled"):
    r = {"ref": ref, "field": "point", "outcome": outcome, "host": host, "src": src}
    if reason:
        r["reason"] = reason
    res.append(r)


OV, WD = "overpass-api.de", "www.wikidata.org"
if "1" in STEPS:
    filled(R + "trails/berg-lake-trail", "osm:way/1185166549", OV, "trailhead wording from https://bcparks.ca/mount-robson-park/berg-lake-trail/")
    filled(R + "trails/fryatt-valley", "osm:node/2520427794", OV, "road distances from the Parks Canada Fryatt and Geraldine pages")
    filled("trip/patagonia-2027/trail:laguna de los tres", "osm:node/7069713837", OV, "the PNLG zona norte leaflet puts the lake on the Fitz Roy path")
    filled("trip/patagonia-2027/trail:laguna esmeralda", "osm:way/567999991", OV, "start wording from https://turismoushuaia.com/actividad/laguna-esmeralda/")
    filled("trip/utah-five-parks/trail:windows section", "osm:node/4835435421", OV)
    res.append({"ref": "trip/chamonix-mont-blanc-2028/lake:lac du chatelard", "field": "point", "outcome": "searched_none", "tried": [
        "Overpass 2026-10-25: every feature named like 'telard' in 45.80,6.70,46.20,7.10 (52 hits, no water body)",
        "Wikidata wbsearchentities fr 2026-10-25: 'Lac du Châtelard', 'Lac de Châtelard', 'lac Châtelard' (no result)",
        "Wikidata full-text search 2026-10-25: 'Châtelard lac' (a mountain, a railway company)",
        "D1 2026-10-25: Nominatim, Wikidata within 20 km; the stop came from the 18 Oct prototype seed list, not the legacy plan"],
        "reason": "the place is not known to exist; the run note proposes dropping the stop or marking it same_place_as"})
if "2" in STEPS:
    for ref, src, why in [
        (R + "adventures/sulphur-mountain-trail", "osm:way/24306334", "approx lifted: the tourism board names the Upper Hot Springs parking area"),
        (R + "trails/bears-hump", "osm:node/1814165734", "the D1 point was 1.2 km off; Parks Canada: across the Entrance Road from the Prince of Wales access road"),
        (R + "trails/cavell-meadows", "osm:relation/20689592", "Parks Canada: the end of the Cavell Road"),
        (R + "trails/crypt-lake", "osm:way/185604526", "Parks Canada: the trailhead at Crypt Landing"),
        (R + "trails/elk-lakes-lower-upper", "osm:way/102439897", "the D1 point was 3 km off; BC Parks names the trailhead parking lot"),
        (R + "trails/elk-lakes-viewpoint", "osm:way/102439897", "same trailhead"),
        (R + "trails/johnson-lake-loop", "osm:way/1180102518", "official trailhead wording not read (the Parks Canada table is built in the browser)"),
        (R + "trails/lillian-lake", "albertaparks:galatea-creek", "official point from the Alberta Parks trail report map"),
        (R + "trails/opal-hills", "osm:way/1532999492", "Parks Canada: the north-east corner of the farthest lot"),
        (R + "trails/red-rock-canyon-loop", "osm:way/1059104807", "Parks Canada: the upper parking lot"),
        (R + "trails/skyline-trail", "osm:way/1241750492", "Parks Canada: 50 m right of the Bald Hills Trail"),
        (R + "trails/tent-ridge-horseshoe", "osm:way/24836693", "OSM only; no official page exists"),
        (R + "adventures/red-rock-parkway", "osm:way/32162365", "the start on Highway 5, not the canyon at the end"),
        (R + "sights/whiteswan-lussier-hot-springs", "osm:node/2368067925", "the record is a hot spring: the spring, not the park"),
        ("part/place/lago-di-braies#walk", "osm:node/12978036296", "a loop: where it is joined at the north shore"),
        ("part/place/rafting-on-the-rienza#place", "osm:way/42881996", "the operator names the St. Sigmund sports zone"),
        ("part/trip/iceland-ring-road-2027/sight:dettifoss#walk", "osm:way/1531241656", "park page: car park west of Dettifoss"),
        ("trip/chamonix-mont-blanc-2028/town:chamonix market", "osm:relation/2569238", "tourism board: Place du Mont Blanc"),
        ("trip/chamonix-mont-blanc-2028/trail:plan de l aiguille", "osm:node/31000524", "tourism board: from the cable car station"),
        ("trip/iceland-ring-road-2027/trail:arnarstapi to hellnar", "snaefellsjokull:trail-28-gpx", "the park's own GPX"),
        ("trip/iceland-ring-road-2027/trail:fjadrargljufur canyon", "osm:relation/20613921", "the canyon car park"),
        ("trip/iceland-ring-road-2027/trail:skaftafell svartifoss", "vatnajokull:s2-gpx", "the park's own GPX; 32 m from the D1 point"),
        ("trip/patagonia-2027/trail:coastal path", "osm:way/68895189", "park page: starts at the Ensenada Zaratiegui car park"),
        ("trip/patagonia-2027/trail:laguna capri", "osm:node/7069713837", "the Fitz Roy path trailhead"),
        ("trip/utah-five-parks/trail:pa rus trail", "osm:way/14326805", "NPS: starts at the Zion Canyon Visitor Center"),
        ("trip/vermont-fall-2026/trail:stowe recreation path", "osm:way/204763538", "town page: from Stowe Village"),
    ]:
        filled(ref, src, OV if src.startswith("osm:") else "", why)
    filled(R + "adventures/bow-valley-parkway-cycling", "osm:way/1431795407", OV, "still approx: the closure gate is not mapped")
if "4" in STEPS:
    filled("part/place/cascate-di-fanes#payoff", "osm:node/9861910524", OV, "the falls; the official route ends at the belvedere 130 m away")
    filled("place/cascate-di-fanes", "osm:node/470623991", OV, "official start: the park information point; beats the snapshot trailhead at Pian de Loa")
if "6" in STEPS:
    filled(R + "sights/cameron-lake", "wikidata:Q3214786", WD, "no conflict: OSM relation 8299848 agrees within 25 m; D1 compared an NHD fragment")
    filled("trip/utah-five-parks/viewpoint:grand view point", "osm:node/6806471756", OV,
           "conflict kept: Wikidata Q62073199 P625 is 1.4 km north-east; NPS puts the point at the road end", outcome="conflict")
if "7" in STEPS:
    filled(R + "trails/upper-kananaskis-lake-loop", "albertaparks:upper-lake", "", "person-check sample: the D1 point was a trail junction 780 m from the official trailhead")

for r in res:
    if not r.get("host"):
        r.pop("host", None)

hosts = Counter()
for line in open(LOG):
    e = json.loads(line)
    hosts[e["host"]] += 1
H = []
for h, n in sorted(hosts.items()):
    api = h in ("overpass-api.de", "www.wikidata.org")
    # the two APIs publish usage policies that allow this use; robots.txt of the web hosts was not read in this run
    H.append({"host": h, "requests": n, "robots": "allowed" if api else "unknown", "terms": "allowed" if api else "unknown", "status": "ok"})

doc = {
    "schema": "capture-run/1",
    "run": "api-2026-10-25-data-d1b-points",
    "started": "2026-10-25",
    "agent": "travel-researcher",
    "model": "claude-opus-5.5",
    "scope": {"refs": sorted({r["ref"] for r in res})},
    "hosts": H,
    "results": res,
}
with open(OUT, "w") as f:
    json.dump(doc, f, indent=2, ensure_ascii=False)
    f.write("\n")
print("results", len(res), "hosts", dict(hosts))
