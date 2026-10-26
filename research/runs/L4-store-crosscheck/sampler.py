#!/usr/bin/env python3
"""L4 sampler: deterministic 10-value sample per place family (seed 20261026).

Population: the 74 store places added before 2026-10-26 (data/locations/locations.json).
Candidate values per place, with weight:
  point (lat+lon) 3, elevation_m 2, season_months 2, wikidata 1,
  each store source with a url 2, each capture-record link (catalogue lane) 2,
  each filled capture price/hours/window/season/best_time 2.
Families: settlement (city, town), region (region, island), park, high (mountain, viewpoint,
lighthouse), water (lake, waterfall, canyon, valley), route (trail, activity, drive, place).
Weighted draw without replacement, at most 2 values per place, ordered by sha256(seed|family|pair)
so the draw does not depend on iteration order.
"""
import glob, hashlib, json, math, sys
SEED = "20261026"
FAM = {"city": "settlement", "town": "settlement", "region": "region", "island": "region", "park": "park",
       "mountain": "high", "viewpoint": "high", "lighthouse": "high", "lake": "water", "waterfall": "water",
       "canyon": "water", "valley": "water", "trail": "route", "activity": "route", "drive": "route", "place": "route"}
d = json.load(open("data/locations/locations.json"))
places = [p for p in d["places"] if p["added"] < "2026-10-26"]
srcs = {}
for s in d["sources"]:
    srcs.setdefault(s["place_id"], []).append(s)
recs = []
for f in sorted(glob.glob("data/capture/catalogue/*.json")):
    recs += json.load(open(f))["records"]
def wd(r):
    for l in r.get("links", []):
        if l["kind"] == "wikidata":
            return l["url"].rsplit("/", 1)[-1]
byslug = {r["ref"].split("/", 1)[1]: r for r in recs if r["ref"].startswith("place/")}
bywd = {wd(r): r for r in recs if wd(r)}
def rec_for(p):
    slug = p["id"].rsplit("/", 1)[-1]
    return byslug.get(slug) or bywd.get(p["wikidata"]) if p["wikidata"] else byslug.get(slug)
cands = []
for p in places:
    fam = FAM[p["kind"]]
    def add(field, w, detail=None):
        cands.append(dict(place=p["id"], family=fam, field=field, weight=w, detail=detail))
    if p["lat"] is not None: add("point", 3)
    if p["elevation_m"] is not None: add("elevation_m", 2)
    if p["season_months"]: add("season_months", 2)
    if p["wikidata"]: add("wikidata", 1)
    for s in srcs.get(p["id"], []):
        if s["url"]: add("store_source_url", 2, s["id"])
    r = rec_for(p)
    if r:
        for i, l in enumerate(r.get("links", [])):
            if l.get("url") and l["kind"] not in ("wikidata", "osm"): add("capture_link", 2, l["url"])
        for k in ("price", "hours", "window", "season", "best_time", "best_window"):
            v = r.get(k)
            if isinstance(v, dict) and v.get("v") not in (None, "", []): add("capture_" + k, 2)
def key(c):
    h = hashlib.sha256(f"{SEED}|{c['family']}|{c['place']}|{c['field']}|{c['detail']}".encode()).hexdigest()
    u = (int(h[:12], 16) + 1) / (16 ** 12 + 1)
    return -math.log(u) / c["weight"]          # Efraimidis-Spirakis weighted draw
out = []
for fam in sorted(set(FAM.values())):
    pool = sorted([c for c in cands if c["family"] == fam], key=key)
    taken, per = [], {}
    for c in pool:
        if per.get(c["place"], 0) >= 2: continue
        per[c["place"]] = per.get(c["place"], 0) + 1
        taken.append(c)
        if len(taken) == 10: break
    out += taken
json.dump(out, sys.stdout, indent=1)
