#!/usr/bin/env python3
"""Destination store: the laundry list of places we might go, kept as data.

    python3 _system/tools/destinations.py add "Lake Louise" --country CA --tags lake,family
    python3 _system/tools/destinations.py import destinations/inbox/batch.json
    python3 _system/tools/destinations.py collection add --slug gaspesie-loop --name "..." --places ID,ID
    python3 _system/tools/destinations.py validate
    python3 _system/tools/destinations.py render            # writes destinations/WISHLIST.md
    python3 _system/tools/destinations.py list [--country CA] [--q charlevoix]

Store: destinations/destinations.json. Hierarchy is country > region > area > place, with ids like
CA/AB/banff-national-park/lake-louise. Resolution uses Wikidata first (coordinates, parent chain,
country), then OpenStreetMap Nominatim. Stdlib only. One network request at a time, a second apart.

Exit codes: 0 ok, 1 error or validation failure, 2 ambiguous (candidates printed, re-run with --pick N).
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import math
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STORE = ROOT / "destinations" / "destinations.json"
WISHLIST = ROOT / "destinations" / "WISHLIST.md"
UA = "nks-travel-destinations/0.1 (personal trip planner; nitin27may@gmail.com)"
WD = "https://www.wikidata.org/w/api.php"
NOMINATIM = "https://nominatim.openstreetmap.org/search"

KINDS = ("trail", "viewpoint", "waterfall", "lake", "mountain", "park", "town", "city", "island",
         "beach", "canyon", "valley", "activity", "lodge", "drive", "museum", "lighthouse",
         "region", "place")
STATUSES = ("idea", "shortlisted", "planned", "visited", "dropped")
KID_FIT = ("yes", "strong-kid", "no", "unknown")

# Wikidata instance-of (P31) to our kind. Checked in order; first hit wins.
P31_KIND = [
    ({"Q2143825", "Q1233637", "Q5004679"}, "trail"),            # hiking trail, trail, path
    ({"Q34038", "Q7707728"}, "waterfall"),
    ({"Q23397", "Q211302", "Q187223", "Q3215290"}, "lake"),      # lake, glacial lake, tarn, lake group
    ({"Q8502", "Q54050", "Q207326", "Q1437459", "Q2633353"}, "mountain"),  # mountain, hill, summit, peak
    ({"Q46169", "Q473972", "Q179049", "Q22698", "Q1377575", "Q3918" , "Q2028015"}, "park"),  # national park, protected area, nature reserve, park, state park
    ({"Q150784", "Q39816", "Q1322134"}, "canyon"),               # canyon, valley, gorge
    ({"Q23442", "Q1322134"}, "island"),
    ({"Q39715"}, "lighthouse"),
    ({"Q33506", "Q207694"}, "museum"),
    ({"Q40080", "Q2287072"}, "beach"),
    ({"Q130003", "Q1783585", "Q5107"}, "activity"),              # ski resort, cable car, (generic)
    ({"Q515", "Q1549591", "Q1093829"}, "city"),
    ({"Q3957", "Q5084", "Q532", "Q17366755", "Q486972", "Q15284"}, "town"),  # town, hamlet, village, human settlement, municipality
    ({"Q27096213", "Q82794", "Q3455524"}, "region"),              # geographic entity, region
]
COUNTRY_QID = {"Q16": "CA", "Q30": "US", "Q38": "IT", "Q142": "FR", "Q881": "VN", "Q668": "IN", "Q414": "AR",
               "Q298": "CL", "Q39": "CH", "Q20": "NO", "Q189": "IS", "Q419": "PE", "Q800": "CR", "Q145": "GB",
               "Q29": "ES", "Q45": "PT", "Q17": "JP", "Q664": "NZ", "Q408": "AU", "Q96": "MX", "Q183": "DE", "Q40": "AT"}
NON_PLACE_P31 = {"Q5", "Q3305213", "Q11424", "Q7725634", "Q482994", "Q13442814", "Q4830453"}  # human, painting, film, literary work, album, article, business


# ----------------------------------------------------------------------------- helpers
def slugify(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s or "x"


def haversine_km(a_lat, a_lon, b_lat, b_lon) -> float:
    r = 6371.0
    p1, p2 = math.radians(a_lat), math.radians(b_lat)
    dp, dl = math.radians(b_lat - a_lat), math.radians(b_lon - a_lon)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def make_id(country: str, region: str, area: str, name: str) -> str:
    return "/".join([country.upper(), slugify(region).upper() if len(region) <= 3 else slugify(region),
                     slugify(area), slugify(name)])


def kind_from_p31(ids: list[str]) -> str:
    s = set(ids)
    for group, kind in P31_KIND:
        if s & group:
            return kind
    return "place"


def today() -> str:
    return dt.date.today().isoformat()


# ----------------------------------------------------------------------------- store
def load() -> dict:
    if STORE.exists():
        return json.loads(STORE.read_text(encoding="utf-8"))
    return {"version": 1, "updated": today(), "countries": {}, "places": [], "collections": []}


def save(data: dict) -> None:
    data["updated"] = today()
    data["places"].sort(key=lambda p: p["id"])
    STORE.parent.mkdir(parents=True, exist_ok=True)
    STORE.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")


def find_duplicate(data: dict, pid: str, name: str, lat, lon, region: str) -> dict | None:
    """Same id, same name in the same region, or another place within 1.5 km."""
    for p in data["places"]:
        if p["id"] == pid:
            return p
        if p.get("region") == region and slugify(p["name"]) == slugify(name):
            return p
        if lat is not None and p.get("lat") is not None and p.get("kind") != "region":
            km = haversine_km(lat, lon, p["lat"], p["lon"])
            # inside 300 m it is the same thing; a trail, a lake and a summit can all sit within 1.5 km
            if km < 0.3:
                return p
            if km < 1.5:
                print(f"  note: {name} is {km:.1f} km from {p['id']}; kept as a separate place", file=sys.stderr)
    return None


# ----------------------------------------------------------------------------- network
_last_call = 0.0


def _get(url: str, params: dict, min_gap: float = 1.0) -> dict:
    global _last_call
    wait = min_gap - (time.time() - _last_call)
    if wait > 0:
        time.sleep(wait)
    req = urllib.request.Request(url + "?" + urllib.parse.urlencode(params), headers={"User-Agent": UA})
    last_err = None
    for attempt, backoff in enumerate((0, 3, 10, 30)):
        if backoff:
            print(f"  retry {attempt} in {backoff}s: {last_err}", file=sys.stderr)
            time.sleep(backoff)
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                _last_call = time.time()
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as ex:
            last_err = ex
            if ex.code not in (429, 500, 502, 503, 504):
                raise
        except (urllib.error.URLError, TimeoutError, OSError) as ex:   # DNS blips, resets
            last_err = ex
    raise RuntimeError(f"gave up after retries: {last_err}")


def wd_search(name: str, limit: int = 7) -> list[dict]:
    j = _get(WD, {"action": "wbsearchentities", "search": name, "language": "en", "type": "item",
                  "limit": limit, "format": "json"})
    return j.get("search", [])


def wd_entities(ids: list[str]) -> dict:
    out = {}
    for i in range(0, len(ids), 50):
        j = _get(WD, {"action": "wbgetentities", "ids": "|".join(ids[i:i + 50]),
                      "props": "claims|labels|descriptions", "languages": "en", "format": "json"})
        out.update(j.get("entities", {}))
    return out


def claim_vals(entity: dict, prop: str) -> list:
    out = []
    for s in entity.get("claims", {}).get(prop, []):
        dv = s.get("mainsnak", {}).get("datavalue")
        if dv:
            out.append(dv["value"])
    return out


def claim_ids(entity: dict, prop: str) -> list[str]:
    return [v["id"] for v in claim_vals(entity, prop) if isinstance(v, dict) and "id" in v]


def label(entity: dict) -> str:
    return entity.get("labels", {}).get("en", {}).get("value", entity.get("id", "?"))


def walk_admin_chain(start_ids: list[str], max_hops: int = 6) -> tuple[list[dict], dict | None, dict | None]:
    """Follow P131 (located in) upward. Returns (chain entities, region entity, country entity).
    Region = first ancestor with an ISO 3166-2 code (P300). Country = first with ISO 3166-1 (P297)."""
    chain, region, country = [], None, None
    frontier = list(start_ids)
    seen = set()
    for _ in range(max_hops):
        frontier = [i for i in frontier if i not in seen]
        if not frontier:
            break
        ents = wd_entities(frontier)
        nxt = []
        for i in frontier:
            e = ents.get(i)
            if not e:
                continue
            seen.add(i)
            chain.append(e)
            if region is None and claim_vals(e, "P300"):
                region = e
            if country is None and claim_vals(e, "P297"):
                country = e
            nxt += claim_ids(e, "P131")
            if country is None:
                nxt += claim_ids(e, "P17")
        if region is not None and country is not None:
            break
        frontier = nxt
    return chain, region, country


def reverse_area(lat: float, lon: float) -> str | None:
    """Nominatim reverse lookup for the county / municipality a point sits in. One request."""
    try:
        j = _get("https://nominatim.openstreetmap.org/reverse",
                 {"lat": lat, "lon": lon, "format": "jsonv2", "zoom": 10, "addressdetails": 1}, min_gap=1.1)
    except Exception:
        return None
    a = j.get("address", {})
    for k in ("county", "municipality", "city_district", "town", "city", "village", "state_district"):
        if a.get(k):
            return a[k]
    return None


def resolve_wikidata(name: str, country_hint: str | None, region_hint: str | None, pick: int | None,
                     kind_hint: str | None = None) -> dict | None:
    cands = wd_search(name)
    if not cands:
        return None
    ents = wd_entities([c["id"] for c in cands])
    scored = []
    for c in cands:
        e = ents.get(c["id"], {})
        p31 = claim_ids(e, "P31")
        if set(p31) & NON_PLACE_P31:
            continue
        coords = claim_vals(e, "P625")
        if not coords:
            continue
        score = 1
        desc = (c.get("description") or "").lower()
        if country_hint:
            cands_cc = {COUNTRY_QID.get(q) for q in claim_ids(e, "P17")} - {None}
            if cands_cc:
                score += 3 if country_hint.upper() in cands_cc else -5   # wrong country is disqualifying
            elif _country_name(country_hint).lower() in desc:
                score += 2
        if region_hint and region_hint.lower() in desc:
            score += 2
        if slugify(c.get("label", "")) == slugify(name):
            score += 1
        if kind_hint and kind_from_p31(p31) == kind_hint:
            score += 2
        scored.append((score, c, e, coords[0], p31))
    scored = [t for t in scored if t[0] > 0]
    if not scored:
        return None
    scored.sort(key=lambda t: -t[0])
    if pick is not None:
        chosen = scored[pick]
    else:
        if len(scored) > 1 and scored[0][0] - scored[1][0] < 2 and not (country_hint and scored[0][0] >= 4):
            print("AMBIGUOUS: re-run with --pick N", file=sys.stderr)
            for n, (s, c, e, co, p31) in enumerate(scored):
                print(f"  --pick {n}: {c['id']} {c.get('label')} | {c.get('description')} | score {s} | {co['latitude']:.3f},{co['longitude']:.3f}", file=sys.stderr)
            sys.exit(2)
        chosen = scored[0]
    _, c, e, co, p31 = chosen
    chain, region_e, country_e = walk_admin_chain(claim_ids(e, "P131") + claim_ids(e, "P17"))
    protected = claim_ids(e, "P3018")  # located in protected area
    area_e = None
    if protected:
        area_e = wd_entities(protected[:1]).get(protected[0])
    elif chain and region_e is not None and chain[0] is not region_e and chain[0] is not country_e:
        area_e = chain[0]
    area_name = label(area_e) if area_e else reverse_area(co["latitude"], co["longitude"])
    country_code = (claim_vals(country_e, "P297")[0] if country_e else (country_hint or "XX")).upper()
    iso2 = claim_vals(region_e, "P300")[0] if region_e else None   # e.g. CA-AB
    region_code = iso2.split("-", 1)[1] if iso2 and "-" in iso2 else (region_hint or "unknown")
    elev = claim_vals(e, "P2044")
    img = claim_vals(e, "P18")
    return {
        "name": c.get("label") or name,
        "wikidata": c["id"],
        "description": c.get("description"),
        "lat": round(co["latitude"], 5), "lon": round(co["longitude"], 5),
        "kind": kind_from_p31(p31),
        "country": country_code, "country_name": label(country_e) if country_e else _country_name(country_code),
        "region": region_code, "region_name": label(region_e) if region_e else (region_hint or "Unknown"),
        "area_name": area_name,
        "elevation_m": int(float(elev[0]["amount"])) if elev else None,
        "image": f"https://commons.wikimedia.org/wiki/Special:FilePath/{urllib.parse.quote(img[0])}" if img else None,
        "resolver": "wikidata",
    }


def resolve_nominatim(name: str, country_hint: str | None, region_hint: str | None) -> dict | None:
    region_q = region_hint if region_hint and len(region_hint) > 3 else None   # a code like "QC" hurts the query
    q = " ".join(x for x in [name, region_q, _country_name(country_hint) if country_hint else None] if x)
    params = {"q": q, "format": "jsonv2", "addressdetails": 1, "limit": 3}
    if country_hint:
        params["countrycodes"] = country_hint.lower()
    rows = _get(NOMINATIM, params, min_gap=1.1)
    if not rows:
        return None
    r = rows[0]
    a = r.get("address", {})
    cc = (a.get("country_code") or country_hint or "xx").upper()
    region_name = a.get("state") or a.get("province") or a.get("region") or region_hint or "Unknown"
    return {
        "name": name, "wikidata": None, "description": r.get("display_name"),
        "lat": round(float(r["lat"]), 5), "lon": round(float(r["lon"]), 5),
        "kind": _nominatim_kind(r.get("class"), r.get("type")),
        "country": cc, "country_name": a.get("country") or _country_name(cc),
        "region": _region_code_guess(cc, region_name), "region_name": region_name,
        "area_name": a.get("county") or a.get("municipality") or a.get("town") or a.get("village"),
        "elevation_m": None, "image": None, "resolver": "nominatim",
    }


def _nominatim_kind(cls, typ) -> str:
    t = (typ or "").lower()
    for k in ("waterfall", "lake", "island", "beach", "lighthouse", "museum", "canyon", "valley", "peak"):
        if k in t:
            return "mountain" if k == "peak" else k
    if cls in ("highway", "route") or t in ("footway", "path", "track"):
        return "trail"
    if t in ("national_park", "nature_reserve", "protected_area", "park"):
        return "park"
    if t in ("city",):
        return "city"
    if t in ("town", "village", "hamlet", "municipality"):
        return "town"
    if t in ("viewpoint",):
        return "viewpoint"
    return "place"


COUNTRY_NAMES = {"CA": "Canada", "US": "United States", "IT": "Italy", "FR": "France", "VN": "Vietnam",
                 "IN": "India", "AR": "Argentina", "CL": "Chile", "CH": "Switzerland", "NO": "Norway",
                 "IS": "Iceland", "PE": "Peru", "CR": "Costa Rica", "GB": "United Kingdom", "ES": "Spain",
                 "PT": "Portugal", "JP": "Japan", "NZ": "New Zealand", "AU": "Australia", "MX": "Mexico"}
REGION_CODES = {("CA", "quebec"): "QC", ("CA", "alberta"): "AB", ("CA", "british columbia"): "BC",
                ("CA", "ontario"): "ON", ("CA", "nova scotia"): "NS", ("US", "new york"): "NY",
                ("US", "vermont"): "VT", ("US", "new hampshire"): "NH", ("US", "colorado"): "CO",
                ("US", "arizona"): "AZ", ("US", "utah"): "UT", ("US", "wyoming"): "WY",
                ("US", "massachusetts"): "MA", ("US", "alaska"): "AK"}


def _country_name(code: str | None) -> str:
    return COUNTRY_NAMES.get((code or "").upper(), code or "Unknown")


def _region_code_guess(cc: str, region_name: str) -> str:
    return REGION_CODES.get((cc, region_name.lower()), slugify(region_name))


# ----------------------------------------------------------------------------- commands
def build_place(spec: dict, pick: int | None = None, offline: bool = False) -> dict:
    """spec keys: name, country, region, area, kind, tags, season, kid_fit, stats, notes, source(s), status, alias."""
    name = spec["name"].strip()
    res = None
    if not offline:
        try:
            res = resolve_wikidata(name, spec.get("country"), spec.get("region_name") or spec.get("region"), pick,
                                   kind_hint=spec.get("kind"))
        except SystemExit:
            raise
        except Exception as ex:  # network or parse trouble: fall through to Nominatim
            print(f"  wikidata failed for {name}: {ex}", file=sys.stderr)
        if res is None:
            try:
                res = resolve_nominatim(name, spec.get("country"), spec.get("region_name") or spec.get("region"))
            except Exception as ex:
                print(f"  nominatim failed for {name}: {ex}", file=sys.stderr)
    if res is None:
        res = {"name": name, "wikidata": None, "description": None, "lat": None, "lon": None,
               "kind": spec.get("kind", "place"), "country": (spec.get("country") or "XX").upper(),
               "country_name": _country_name(spec.get("country")), "region": spec.get("region") or "unknown",
               "region_name": spec.get("region_name") or spec.get("region") or "Unknown",
               "area_name": spec.get("area"), "elevation_m": None, "image": None, "resolver": "none"}
    # explicit hints win over the resolver for the hierarchy; the resolver wins for coordinates
    country = (spec.get("country") or res["country"]).upper()
    region = spec.get("region") or res["region"]
    area_name = spec.get("area") or res.get("area_name") or res["region_name"]
    sources = spec.get("sources") or ([{"type": spec.get("source_type", "note"), "url": spec["source"]}] if spec.get("source") else [])
    for s in sources:
        s.setdefault("saved", today())
    place = {
        "id": make_id(country, region, area_name, spec.get("alias") or name),
        "name": spec.get("display_name") or name,
        "resolved_name": res["name"],
        "kind": spec.get("kind") or res["kind"],
        "country": country, "country_name": spec.get("country_name") or res["country_name"],
        "region": region, "region_name": spec.get("region_name") or res["region_name"],
        "area": slugify(area_name), "area_name": area_name,
        "lat": res["lat"], "lon": res["lon"], "elevation_m": res.get("elevation_m"),
        "wikidata": res.get("wikidata"), "image": res.get("image"),
        "tags": sorted(set(spec.get("tags", []))),
        "season": spec.get("season"), "kid_fit": spec.get("kid_fit", "unknown"),
        "stats": spec.get("stats") or {},
        "status": spec.get("status", "idea"), "trip": spec.get("trip"),
        "verified": False, "resolver": res["resolver"],
        "notes": spec.get("notes", ""), "sources": sources,
        "added": today(),
    }
    return place


def cmd_add(args) -> int:
    data = load()
    spec = {
        "name": args.name, "country": args.country, "region": args.region, "area": args.area,
        "kind": args.kind, "tags": [t for t in (args.tags or "").split(",") if t],
        "season": [m for m in (args.season or "").split(",") if m] or None, "kid_fit": args.kid or "unknown",
        "stats": json.loads(args.stats) if args.stats else {}, "notes": args.note or "",
        "source": args.source, "source_type": args.source_type, "status": args.status,
    }
    place = build_place(spec, pick=args.pick, offline=args.offline)
    dup = find_duplicate(data, place["id"], place["name"], place["lat"], place["lon"], place["region"])
    if dup and not args.force:
        print(f"DUPLICATE of {dup['id']} ({dup['name']}); use --force to add anyway, or edit that entry", file=sys.stderr)
        return 1
    data["places"].append(place)
    data["countries"][place["country"]] = place["country_name"]
    save(data)
    render(data)
    print(f"added {place['id']} | {place['kind']} | {place['lat']},{place['lon']} | {place['country_name']} > {place['region_name']} > {place['area_name']} | via {place['resolver']}")
    return 0


def cmd_import(args) -> int:
    """Batch file: {"places": [spec, ...], "collections": [...]}; spec as in build_place, plus optional "pick"."""
    data = load()
    batch = json.loads(Path(args.file).read_text(encoding="utf-8"))
    added, skipped = [], []
    for spec in batch.get("places", []):
        try:
            place = build_place(spec, pick=spec.get("pick"), offline=args.offline)
        except SystemExit as ex:
            skipped.append((spec["name"], f"ambiguous (exit {ex.code})"))
            continue
        dup = find_duplicate(data, place["id"], place["name"], place["lat"], place["lon"], place["region"])
        if dup and not spec.get("force"):
            skipped.append((spec["name"], f"duplicate of {dup['id']}"))
            continue
        data["places"].append(place)
        data["countries"][place["country"]] = place["country_name"]
        added.append(place)
        print(f"  + {place['id']} ({place['resolver']})")
    # collections may list stops by name instead of id; map through everything now in the store
    by_name = {}
    for p in data["places"]:
        for key in (p["name"], p.get("resolved_name"), p["id"].rsplit("/", 1)[1]):
            if key:
                by_name.setdefault(slugify(key), p["id"])
    for col in batch.get("collections", []):
        col = dict(col)
        col["places"] = [i if "/" in i else by_name.get(slugify(i), i) for i in col.get("places", [])]
        _upsert_collection(data, col)
    save(data)
    render(data)
    print(f"imported {len(added)}, skipped {len(skipped)}")
    for n, why in skipped:
        print(f"  skipped {n}: {why}")
    return 0


def _upsert_collection(data: dict, col: dict) -> None:
    col = dict(col)
    col.setdefault("added", today())
    col["places"] = list(col.get("places", []))
    known = {p["id"] for p in data["places"]}
    missing = [i for i in col["places"] if i not in known]
    if missing:
        print(f"  collection {col['slug']}: unknown place ids {missing}", file=sys.stderr)
    data["collections"] = [c for c in data["collections"] if c["slug"] != col["slug"]] + [col]


def cmd_collection(args) -> int:
    data = load()
    _upsert_collection(data, {"slug": args.slug, "name": args.name, "country": args.country,
                              "places": [p for p in args.places.split(",") if p], "notes": args.note or "",
                              "sources": [{"type": args.source_type, "url": args.source, "saved": today()}] if args.source else []})
    save(data)
    render(data)
    print(f"collection {args.slug} saved")
    return 0


def validate(data: dict) -> list[str]:
    errs = []
    ids = [p["id"] for p in data["places"]]
    if len(ids) != len(set(ids)):
        errs.append("duplicate ids: " + ", ".join(sorted({i for i in ids if ids.count(i) > 1})))
    for p in data["places"]:
        where = p.get("id", "?")
        for k in ("id", "name", "kind", "country", "region", "area", "status", "added"):
            if not p.get(k):
                errs.append(f"{where}: missing {k}")
        if p.get("kind") not in KINDS:
            errs.append(f"{where}: kind {p.get('kind')!r} not in {KINDS}")
        if p.get("status") not in STATUSES:
            errs.append(f"{where}: status {p.get('status')!r} not in {STATUSES}")
        if p.get("kid_fit") not in KID_FIT:
            errs.append(f"{where}: kid_fit {p.get('kid_fit')!r} not in {KID_FIT}")
        if p.get("id") and p["id"].count("/") != 3:
            errs.append(f"{where}: id must have four levels country/region/area/place")
        if (p.get("lat") is None) != (p.get("lon") is None):
            errs.append(f"{where}: lat and lon must both be set or both empty")
        if p.get("lat") is None and p.get("kind") != "region" and not p.get("location_unconfirmed"):
            errs.append(f"{where}: no coordinates (resolver failed); add --lat/--lon, re-resolve, or set location_unconfirmed")
    known = set(ids)
    for c in data["collections"]:
        for k in ("slug", "name", "places"):
            if not c.get(k):
                errs.append(f"collection {c.get('slug','?')}: missing {k}")
        for i in c.get("places", []):
            if i not in known:
                errs.append(f"collection {c['slug']}: unknown place {i}")
    return errs


def cmd_validate(args) -> int:
    errs = validate(load())
    for e in errs:
        print("ERROR " + e)
    print("ok" if not errs else f"{len(errs)} problem(s)")
    return 1 if errs else 0


# ----------------------------------------------------------------------------- render
def gmap(p: dict) -> str:
    if p.get("lat") is not None:
        return f"https://maps.google.com/?q={p['lat']},{p['lon']}"
    return "https://maps.google.com/?q=" + urllib.parse.quote_plus(f"{p['name']} {p.get('region_name','')} {p.get('country_name','')}")


def render(data: dict) -> str:
    places = sorted(data["places"], key=lambda p: (p["country_name"], p["region_name"], p["area_name"], p["name"]))
    by_status = {}
    for p in places:
        by_status[p["status"]] = by_status.get(p["status"], 0) + 1
    out = ["# Wishlist", "",
           f"Generated from `destinations/destinations.json` on {data.get('updated', today())}. Do not edit by hand; "
           "add with `python3 _system/tools/destinations.py add ...` or the `destination` skill.", "",
           f"{len(places)} places in {len({p['country'] for p in places})} countries, "
           f"{len(data['collections'])} collections. By status: " + ", ".join(f"{k} {v}" for k, v in sorted(by_status.items())) + ".", "",
           "Legend: kind · season · status · stats from the source post are unverified until a research lane confirms them.", ""]
    cur = (None, None, None)
    for p in places:
        key = (p["country_name"], p["region_name"], p["area_name"])
        if key[0] != cur[0]:
            out += [f"## {key[0]}", ""]
        if key[:2] != cur[:2]:
            out += [f"### {key[1]}", ""]
        if key != cur:
            out += [f"#### {key[2]}", ""]
        cur = key
        season = ",".join(p["season"]) if p.get("season") else "season ?"
        stats = p.get("stats") or {}
        stat_s = " · ".join(f"{k} {v}" for k, v in stats.items())
        bits = [f"**{p['name']}**", p["kind"], season, p["status"]]
        if p.get("kid_fit") not in (None, "unknown"):
            bits.append(f"kids: {p['kid_fit']}")
        if stat_s:
            bits.append(stat_s + " (unverified)" if not p.get("verified") else stat_s)
        links = [f"[map]({gmap(p)})"]
        if p.get("wikidata"):
            links.append(f"[wd](https://www.wikidata.org/wiki/{p['wikidata']})")
        for s in p.get("sources", []):
            if s.get("url"):
                links.append(f"[{s.get('type','source')}]({s['url']})")
        if p.get("trip"):
            links.append(f"[trip](../{p['trip']}/)")
        line = f"- {' · '.join(bits)} · {' '.join(links)}"
        if p.get("tags"):
            line += " · " + " ".join("#" + t for t in p["tags"])
        out.append(line)
        if p.get("notes"):
            first = p["notes"].strip().splitlines()[0]
            out.append(f"  - {first}")
        out.append(f"  - <sub>{p['id']}</sub>")
    if data["collections"]:
        out += ["", "## Collections (road trips and multi-stop ideas)", ""]
        idx = {p["id"]: p for p in places}
        for c in sorted(data["collections"], key=lambda c: c["name"]):
            out += [f"### {c['name']}", ""]
            if c.get("notes"):
                out += [c["notes"].strip(), ""]
            for n, i in enumerate(c["places"], 1):
                p = idx.get(i)
                out.append(f"{n}. {p['name']} ({p['region_name']}) [map]({gmap(p)})" if p else f"{n}. {i} (unknown id)")
            for s in c.get("sources", []):
                if s.get("url"):
                    out.append(f"\nSource: [{s.get('type','link')}]({s['url']})")
            out.append("")
    text = "\n".join(out).rstrip() + "\n"
    WISHLIST.parent.mkdir(parents=True, exist_ok=True)
    WISHLIST.write_text(text, encoding="utf-8")
    return text


def cmd_render(args) -> int:
    render(load())
    print(f"wrote {WISHLIST.relative_to(ROOT)}")
    return 0


def cmd_list(args) -> int:
    data = load()
    q = (args.q or "").lower()
    for p in sorted(data["places"], key=lambda p: p["id"]):
        if args.country and p["country"] != args.country.upper():
            continue
        hay = " ".join(str(p.get(k, "")) for k in ("id", "name", "area_name", "region_name", "notes", "tags")).lower()
        if q and q not in hay:
            continue
        print(f"{p['id']:<60} {p['kind']:<10} {p['status']:<11} {p['lat']},{p['lon']}")
    return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    a = sub.add_parser("add"); a.add_argument("name")
    a.add_argument("--country"); a.add_argument("--region"); a.add_argument("--area"); a.add_argument("--kind", choices=KINDS)
    a.add_argument("--tags"); a.add_argument("--season", help="comma months, e.g. Sep,Oct"); a.add_argument("--kid", choices=KID_FIT)
    a.add_argument("--stats", help='json, e.g. {"km": 9.5, "gain_m": 543}'); a.add_argument("--note")
    a.add_argument("--source"); a.add_argument("--source-type", default="instagram"); a.add_argument("--status", default="idea", choices=STATUSES)
    a.add_argument("--pick", type=int); a.add_argument("--force", action="store_true"); a.add_argument("--offline", action="store_true")
    a.set_defaults(fn=cmd_add)

    i = sub.add_parser("import"); i.add_argument("file"); i.add_argument("--offline", action="store_true"); i.set_defaults(fn=cmd_import)

    c = sub.add_parser("collection"); c.add_argument("verb", choices=["add"]); c.add_argument("--slug", required=True)
    c.add_argument("--name", required=True); c.add_argument("--country"); c.add_argument("--places", required=True)
    c.add_argument("--note"); c.add_argument("--source"); c.add_argument("--source-type", default="instagram"); c.set_defaults(fn=cmd_collection)

    sub.add_parser("validate").set_defaults(fn=cmd_validate)
    sub.add_parser("render").set_defaults(fn=cmd_render)
    l = sub.add_parser("list"); l.add_argument("--country"); l.add_argument("--q"); l.set_defaults(fn=cmd_list)

    args = ap.parse_args(argv)
    return args.fn(args)


if __name__ == "__main__":
    sys.exit(main())
