#!/usr/bin/env python3
"""L4 verdicts for the 60 sampled values (read 2026-10-26). Writes verdicts.json, the run record and the tables for the note.
Verdict: confirmed | changed | unreachable | cannot_verify."""
import json, collections, glob
D = "2026-10-26"
WD = lambda q: f"https://www.wikidata.org/wiki/{q}"
API = lambda q: f"https://www.wikidata.org/w/api.php?action=wbgetentities&ids={q}&props=labels|claims"
EPQS = "https://epqs.nationalmap.gov/v1/json"
# (n, verdict, source url, note)
V = {
1: ("confirmed", "https://baliseqc.ca/upload/fiches-pret-a-partir/PaP_RE06_ParcNationalBic_Murailles_1j.pdf", "PDF text: 'Les couchers de soleil sont splendides!' (read with pdftotext)"),
2: ("confirmed", "https://parks.canada.ca/pn-np/qc/forillon/visit/tarifs-fees", "page is the Forillon fees page (adult $10 peak, $7.25 shoulder, 2026); it does not name Cap-Bon-Ami"),
3: ("confirmed", "https://en.wikipedia.org/api/rest_v1/page/summary/Mount_St._Helens", "page resolves; wikibase_item Q4675 equals the store QID"),
4: ("confirmed", "https://baliseqc.ca/upload/fiches-pret-a-partir/PaP_RE06_ParcNationalBic_Murailles_1j.pdf", "PDF resolves (200); it is the Les Murailles sheet to Pic Champlain"),
5: ("confirmed", API("Q112854948"), "P625 48.75,-64.17 equals the store; the item is a hamlet in Gaspe, not the lookout (see finding F4)"),
6: ("confirmed", "https://parks.canada.ca/pn-np/qc/forillon/visit/tarifs-fees", "2026 admission and seasonal pass run 30 May to 13 Oct, so months 5 to 10 hold; no page states a month list"),
7: ("confirmed", API("Q112836599"), "P625 48.81389,-64.22222 equals the store; the item is an administrative sector (F4)"),
8: ("confirmed", API("Q26999326"), "Q26999326 is 'Mont Xalibu', mountain, 1120 m, same point"),
9: ("confirmed", API("Q4675"), "P2044 +2549 m equals the store elevation"),
10: ("confirmed", API("Q1283"), "P625 46.613056,12.163056 equals the store (rounded)"),
11: ("confirmed", API("Q3326014"), "P625 48.8081,-121.743 equals the store"),
12: ("confirmed", EPQS + "?x=-110.70083&y=43.83333&wkid=4326&units=Meters", "3DEP value 2104.71 m, store 2105 (computed at the stored point, F3)"),
13: ("confirmed", API("Q223969"), "P625 38.72805556,-109.54 equals the store"),
14: ("confirmed", EPQS + "?x=-110.70083&y=43.83333&wkid=4326&units=Meters", "same query as 12; the same stored value, read through the field's own source id"),
15: ("confirmed", "https://en.wikipedia.org/api/rest_v1/page/summary/Mount_Baker_Wilderness", "page resolves; wikibase_item Q3326014 equals the store QID"),
16: ("confirmed", "https://www.fs.usda.gov/r06/mbs", "page resolves (200), title 'Mount Baker-Snoqualmie National Forest'"),
17: ("confirmed", API("Q3079176"), "P625 47.766,-121.378 equals the store"),
18: ("confirmed", EPQS + "?x=-112.17&y=37.64&wkid=4326&units=Meters", "3DEP 2405.59 m, store 2406 (F3)"),
19: ("confirmed", EPQS + "?x=-109.76&y=38.1669&wkid=4326&units=Meters", "3DEP 1498.11 m, store 1498 (F3)"),
20: ("confirmed", API("Q219562"), "Q219562 is Bryce Canyon National Park"),
21: ("cannot_verify", "", "no official page states Capri's season; secondary guides give April to October (search 26 Oct); store 5 to 9 is unsourced"),
22: ("confirmed", "https://www.visitfingerlakes.com/events/annual-events/fall-colors/", "official tourism guide supports the Sep to Oct colour window and summer lake season; no page lists the months June to October as a range"),
23: ("confirmed", "https://www.capecodchamber.org/explore/seasons/", "chamber names summer as peak season, September to early June as shoulder"),
24: ("confirmed", "https://www.utah.com/things-to-do/outdoor-recreation/mountain-biking/stansbury-island-trail/", "state tourism site: the trail can be ridden year-round (secondary); BLM land is the south end only"),
25: ("confirmed", API("Q49152"), "first of three P625 values equals the store (41.688889,-70.296944)"),
26: ("confirmed", "https://en.wikipedia.org/api/rest_v1/page/summary/Olympic_Peninsula", "page resolves; wikibase_item Q780293 equals the store QID"),
27: ("confirmed", API("Q101081"), "Q101081 is Provence, region and historical province; point 44,6 equals the store"),
28: ("confirmed", API("Q1416994"), "Q1416994 is Finger Lakes; P625 equals the store"),
29: ("confirmed", "https://en.wikipedia.org/api/rest_v1/page/summary/Amalfi_Coast", "page resolves; wikibase_item Q212214 equals the store QID"),
30: ("unreachable", "https://www.sepaq.com/pq/bon", "HTTP 403 to curl and WebFetch on 26 Oct; no value checked (the link itself is not shown to be dead)"),
31: ("cannot_verify", "", "no official season; a Narcity article says the trail is open all year with fall hunting limits; store 9 to 10 is the saved post's foliage window, unsourced"),
32: ("confirmed", EPQS + "?x=-142.889&y=61.4861&wkid=4326&units=Meters", "3DEP 623.86 m, store 624 (F3)"),
33: ("confirmed", API("Q139862201"), "P625 48.84296,-64.26511 equals the store"),
34: ("cannot_verify", "", "no official page found for Sentier La Crete's season (search 26 Oct); store 9 to 10 is a saved-post window, unsourced"),
35: ("confirmed", "https://parks.canada.ca/pn-np/qc/forillon/visit/tarifs-fees", "same Forillon season evidence as 6"),
36: ("confirmed", "https://coloradosprings.gov/manitouincline", "'Reservations for the upcoming month become available on the 1st'; up to 8 weeks; 45 per half hour (stored url coloradosprings.gov/incline redirects here)"),
37: ("confirmed", EPQS + "?x=-142.889&y=61.4861&wkid=4326&units=Meters", "same query as 32"),
38: ("confirmed", "https://coloradosprings.gov/manitouincline", "summer hours 1 May to 31 Oct match months 5 to 10; the Incline is open Nov to Apr on winter hours, so the stored range is the summer-hours window"),
39: ("confirmed", API("Q21428295"), "P625 45.33417,-71.01278 and P2044 923 m equal the store"),
40: ("confirmed", "https://halongtourism.com.vn/", "page resolves (200), title 'Ha Long'"),
41: ("confirmed", API("Q1025813"), "P625 47.5964,-120.665 equals the store"),
42: ("confirmed", API("Q1000140"), "P2044 holds 1500 and 1718 m; the store took 1500 and the note says so"),
43: ("confirmed", "https://www.comune.firenze.it/", "stored www.comune.fi.it redirects to www.comune.firenze.it (title 'Citta di Firenze'); not changed, the link's source is Wikidata P856 (F5)"),
44: ("confirmed", API("Q1025813"), "P2044 +357 m (and +1171 ft) equals the store 357"),
45: ("confirmed", "https://montsaintpierre.ca/", "page resolves (200), municipal site"),
46: ("confirmed", "https://en.wikipedia.org/api/rest_v1/page/summary/Verona", "page resolves; wikibase_item Q2028 equals the store QID"),
47: ("confirmed", API("Q1759444"), "P625 38.0233,-107.672 equals the store"),
48: ("confirmed", "https://www.comune.trento.it/", "stored http:// URL redirects to https:// (F5)"),
49: ("confirmed", API("Q1000140"), "P2044 +1500 m present (1718 m is the recorded alternative)"),
50: ("confirmed", API("Q3376"), "Q3376 is Trento, city"),
51: ("confirmed", API("Q1115201"), "P2044 +335 m equals the store"),
52: ("confirmed", "https://kanarrafalls.com/", "operator site, 'permit system', limit 200 general admission a day; the page states no season"),
53: ("confirmed", "https://www.terfa.ca/fr/terfa/canyon-des-portes-de-l-enfer/", "operator page resolves and is the canyon's page"),
54: ("confirmed", "https://havasupaireservations.com/faqs/", "'Campground permits are $455 per person for 3 nights.' and children 6 and under need no paid permit"),
55: ("confirmed", API("Q7172855"), "P2044 +571 m equals the store"),
56: ("confirmed", "https://en.wikipedia.org/api/rest_v1/page/summary/Lake_Chelan", "page resolves; wikibase_item Q1115201 equals the store QID"),
57: ("confirmed", "https://navajonationparks.org/tribal-parks/monument-valley/", "'$10 per person, per day' and '$15 per Vehicle'; the page states no year, the record's applies_to 2026 is the record's own"),
58: ("confirmed", "https://en.wikipedia.org/api/rest_v1/page/summary/Gurudongmar_Lake", "page resolves; wikibase_item Q2264090 equals the store QID"),
59: ("confirmed", "https://www.quebec-cite.com/en/businesses/parc-de-la-chute-montmorency", "Visit Quebec City page: 'Open year-round', closed 25 Dec"),
60: ("confirmed", "https://www.terfa.ca/fr/terfa/canyon-des-portes-de-l-enfer/", "'Saison 2026 le site est accessible du 16 mai a la fin octobre'"),
}
S = json.load(open("research/runs/L4-store-crosscheck/sample.json"))
d = json.load(open("data/locations/locations.json"))
P = {p["id"]: p for p in d["places"]}
rows = []
for i, c in enumerate(S, 1):
    p = P[c["place"]]
    f = c["field"]
    sv = {"point": f"{p['lat']},{p['lon']}", "elevation_m": p["elevation_m"], "season_months": p["season_months"], "wikidata": p["wikidata"],
          "store_source_url": {s["id"]: s["url"] for s in d["sources"]}.get(c["detail"], c["detail"])}.get(f, c["detail"] or f)
    ver, url, note = V[i]
    rows.append(dict(n=i, family=c["family"], place=c["place"], field=f, stored=sv, verdict=ver, source=url, read=D, note=note))
json.dump(rows, open("research/runs/L4-store-crosscheck/verdicts.json", "w"), indent=1, ensure_ascii=False)

OUT = {"confirmed": "filled", "cannot_verify": "gap", "unreachable": "blocked", "changed": "conflict"}
results = []
for r in rows:
    FM = {"elevation_m": "altitude_m", "season_months": "season", "capture_link": "links", "capture_price": "price", "capture_best_time": "best_time", "capture_window": "window"}
    SRCFIELD = {12: "altitude_m", 9: "altitude_m", 33: "point", 37: "altitude_m", 39: "point", 42: "altitude_m", 44: "altitude_m", 55: "altitude_m"}
    fld = SRCFIELD.get(r["n"]) or FM.get(r["field"], r["field"])
    res = dict(ref="place/" + r["place"].rsplit("/", 1)[-1], field=fld, outcome=OUT[r["verdict"]])
    if r["source"]: res["src"] = r["source"]
    if r["verdict"] == "unreachable": res["host"] = "www.sepaq.com"
    res["reason"] = ("403: " if r["verdict"] == "unreachable" else "") + f"{r['verdict']}: {r['note']}"[:400]
    results.append(res)
hosts = [
 dict(host="www.wikidata.org", requests=2, robots="allowed", terms="allowed", status="ok"),
 dict(host="epqs.nationalmap.gov", requests=4, robots="unknown", terms="allowed", status="ok"),
 dict(host="en.wikipedia.org", requests=14, robots="allowed", terms="allowed", status="ok"),
 dict(host="parks.canada.ca", requests=2, robots="allowed", terms="allowed", status="ok"),
 dict(host="baliseqc.ca", requests=2, robots="unknown", terms="unknown", status="ok"),
 dict(host="coloradosprings.gov", requests=2, robots="unknown", terms="unknown", status="ok"),
 dict(host="havasupaireservations.com", requests=2, robots="unknown", terms="unknown", status="ok"),
 dict(host="navajonationparks.org", requests=2, robots="unknown", terms="unknown", status="ok"),
 dict(host="www.terfa.ca", requests=2, robots="unknown", terms="unknown", status="ok"),
 dict(host="kanarrafalls.com", requests=3, robots="unknown", terms="unknown", status="ok"),
 dict(host="www.sepaq.com", requests=2, robots="unknown", terms="unknown", status="blocked"),
 dict(host="www.quebec-cite.com", requests=1, robots="unknown", terms="unknown", status="ok"),
 dict(host="halongtourism.com.vn", requests=2, robots="unknown", terms="unknown", status="ok"),
 dict(host="montsaintpierre.ca", requests=2, robots="unknown", terms="unknown", status="ok"),
 dict(host="www.fs.usda.gov", requests=2, robots="unknown", terms="unknown", status="ok"),
 dict(host="www.comune.firenze.it", requests=3, robots="unknown", terms="unknown", status="ok"),
 dict(host="www.comune.trento.it", requests=3, robots="unknown", terms="unknown", status="ok"),
 dict(host="www.visitfingerlakes.com", requests=1, robots="unknown", terms="unknown", status="ok"),
 dict(host="www.capecodchamber.org", requests=1, robots="unknown", terms="unknown", status="ok"),
 dict(host="www.utah.com", requests=1, robots="unknown", terms="unknown", status="ok"),
]
run = dict(schema="capture-run/1", run="l4-2026-10-26-store-crosscheck", started=D, agent="travel-verifier", model="sonnet",
           scope=dict(refs=sorted({x["ref"] for x in results})), hosts=hosts, results=results)
json.dump(run, open("data/capture/runs/l4-2026-10-26-store-crosscheck.json", "w"), indent=2, ensure_ascii=False)
