#!/usr/bin/env python3
"""Build the data and vendored libraries behind globe/index.html.

    python3 tools/globe_data.py base            # G1: country facts, 50m country polygons, vendored MapLibre
    python3 tools/globe_data.py admin1          # G2: states/provinces for every country (Natural Earth 10m)
    python3 tools/globe_data.py admin2 [ISO3..] # G2: districts for the priority list (geoBoundaries), mapshaper-simplified
    python3 tools/globe_data.py gazetteer       # G3: search index (countries, admin-1, cities, physical names)
    python3 tools/globe_data.py world           # L2b: 110m world, 1,000 largest lakes, mainland_bbox (writes web/public/globe/data)
    python3 tools/globe_data.py places          # G5: saved-place pins (legacy/globe/assets/data/places.json), plus the list page and WISHLIST.md
    python3 tools/globe_data.py all

Outputs go under legacy/globe/assets/ (published). Raw downloads are cached in tools/.cache/ (gitignored).
Every output must stay under 20 MB (Cloudflare Pages limit is 25 MB per file). Stdlib only; mapshaper via npx.
See docs/GLOBE-RESEARCH.md for sources and licences.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "legacy" / "globe" / "assets"
CACHE = ROOT / "tools" / ".cache"
UA = {"User-Agent": "nks-travel-globe/0.1 (personal trip planner; nitin27may@gmail.com)"}
MAPLIBRE = "6.14.0"
LIMIT = 20 * 1024 * 1024

PRIORITY_ADM2 = ["CAN", "USA", "IND", "ITA", "FRA", "VNM", "ARG", "CHL", "CHE", "NOR", "ISL", "PER", "CRI",
                 "MEX", "ESP", "PRT", "GBR", "JPN", "NZL", "AUS"]


def fetch(url: str, dest: Path, force: bool = False) -> Path:
    if dest.exists() and dest.stat().st_size > 0 and not force:
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    print(f"  fetch {url}", file=sys.stderr)
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=300) as r, open(dest, "wb") as f:
        while chunk := r.read(1 << 20):
            f.write(chunk)
    return dest


def write_json(path: Path, data, compact: bool = True) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":") if compact else None), encoding="utf-8")
    size = path.stat().st_size
    assert size < LIMIT, f"{path} is {size} bytes, over the 20 MB ceiling"
    print(f"  wrote {path.relative_to(ROOT)} ({size // 1024} KB)", file=sys.stderr)


# ----------------------------------------------------------------------------- G1
def cmd_base(args) -> int:
    # 1. country facts, keyed by ISO numeric (what world-atlas uses as feature id)
    raw = json.loads(fetch("https://cdn.jsdelivr.net/npm/world-countries@5/countries.json", CACHE / "world-countries.json").read_text(encoding="utf-8"))
    # world-countries v5 no longer carries population; take the latest Wikidata P1082 per ISO3 (REST Countries v3 is deprecated)
    pop = {}
    try:
        q = "SELECT ?iso3 ?pop ?t WHERE { ?c wdt:P298 ?iso3 . ?c p:P1082 ?s . ?s ps:P1082 ?pop . OPTIONAL { ?s pq:P585 ?t } }"
        url = "https://query.wikidata.org/sparql?format=json&query=" + urllib.parse.quote(q)
        rows = json.loads(fetch(url, CACHE / "wikidata-population.json").read_text(encoding="utf-8"))["results"]["bindings"]
        best = {}
        for b in rows:
            k, t = b["iso3"]["value"], b.get("t", {}).get("value", "")
            if k not in best or t > best[k][1]:
                best[k] = (int(float(b["pop"]["value"])), t)
        pop = {k: v[0] for k, v in best.items()}
    except Exception as ex:
        print(f"  wikidata population unavailable, left empty: {str(ex)[:80]}", file=sys.stderr)
    facts = {}
    for c in raw:
        if c.get("cca3") in pop:
            c["population"] = pop[c["cca3"]]
        if not c.get("ccn3"):
            continue
        facts[c["ccn3"]] = {
            "a2": c["cca2"], "a3": c["cca3"], "name": c["name"]["common"], "official": c["name"].get("official"),
            "capital": (c.get("capital") or [None])[0], "region": c.get("region"), "subregion": c.get("subregion"),
            "population": c.get("population"), "area": c.get("area"), "flag": c.get("flag"),
            "latlng": c.get("latlng"), "languages": list((c.get("languages") or {}).values())[:3],
            "currencies": [v.get("name") for v in (c.get("currencies") or {}).values()][:2],
            "tld": (c.get("tld") or [None])[0], "wiki": c.get("name", {}).get("common"),
        }
    write_json(ASSETS / "data" / "countries.json", facts)
    # keep the small code map used elsewhere in sync
    write_json(ROOT / "data" / "reference" / "countries.json", {k: {"a2": v["a2"], "a3": v["a3"], "name": v["name"]} for k, v in facts.items()})

    # 2. country polygons for hover and click (TopoJSON, 50m)
    src = fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json", CACHE / "countries-50m.json")
    (ASSETS / "data").mkdir(parents=True, exist_ok=True)
    (ASSETS / "data" / "countries-50m.json").write_bytes(src.read_bytes())
    print(f"  wrote legacy/globe/assets/data/countries-50m.json ({src.stat().st_size // 1024} KB)", file=sys.stderr)

    # 3. vendored MapLibre (ESM build, its worker chunks and CSS), pinned. v6 loads the worker
    #    from maplibre-gl-worker.mjs next to the main module, so all three must sit together.
    for name in ("maplibre-gl.mjs", "maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs", "maplibre-gl.css"):
        f = fetch(f"https://unpkg.com/maplibre-gl@{MAPLIBRE}/dist/{name}", CACHE / f"maplibre-{MAPLIBRE}-{name}")
        (ASSETS / "vendor").mkdir(parents=True, exist_ok=True)
        (ASSETS / "vendor" / name).write_bytes(f.read_bytes())
        print(f"  wrote legacy/globe/assets/vendor/{name} ({f.stat().st_size // 1024} KB)", file=sys.stderr)
    (ASSETS / "vendor" / "VERSIONS.txt").write_text(f"maplibre-gl {MAPLIBRE} (BSD-3, https://maplibre.org)\nworld-atlas 2 countries-50m (Natural Earth, public domain)\nworld-countries 5 (CC BY-SA 4.0)\n", encoding="utf-8")
    return 0


# ----------------------------------------------------------------------------- G2
def mapshaper(src: Path, out: Path, pct: str, extra: list[str] | None = None) -> None:
    cmd = ["npx", "-y", "mapshaper", str(src), "-simplify", "visvalingam", pct, "keep-shapes"] + (extra or []) + \
          ["-o", "format=topojson", "precision=0.0001", str(out)]
    subprocess.run(cmd, check=True, capture_output=True, text=True)


def cmd_admin1(args) -> int:
    """Natural Earth 10m admin-1 for every country, split per ISO3 and simplified."""
    raw = fetch("https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson",
                CACHE / "ne_10m_admin_1.geojson")
    gj = json.loads(raw.read_text(encoding="utf-8"))
    by = {}
    for f in gj["features"]:
        p = f["properties"]
        iso3 = p.get("adm0_a3") or "XXX"
        f["properties"] = {"name": p.get("name_en") or p.get("name"), "local": p.get("name"), "iso": p.get("iso_3166_2"),
                           "type": p.get("type_en"), "region": p.get("region"), "wd": p.get("wikidataid"), "gn": p.get("gn_id"),
                           "lat": p.get("latitude"), "lon": p.get("longitude")}
        by.setdefault(iso3, []).append(f)
    out_dir = ASSETS / "admin"; out_dir.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((out_dir / "index.json").read_text()) if (out_dir / "index.json").exists() else {}
    for iso3, feats in sorted(by.items()):
        tmp = CACHE / "adm1" / f"{iso3}.geojson"; tmp.parent.mkdir(parents=True, exist_ok=True)
        tmp.write_text(json.dumps({"type": "FeatureCollection", "features": feats}), encoding="utf-8")
        out = out_dir / f"{iso3}-ADM1.json"
        mapshaper(tmp, out, "12%")
        manifest.setdefault(iso3, {})["adm1"] = {"file": out.name, "n": len(feats), "source": "Natural Earth 10m admin-1"}
    write_json(out_dir / "index.json", manifest)
    total = sum(f.stat().st_size for f in out_dir.glob("*-ADM1.json"))
    print(f"  admin-1: {len(by)} countries, {total // 1024} KB total", file=sys.stderr)
    return 0


def cmd_admin2(args) -> int:
    """geoBoundaries ADM2 per country, simplified. Priority list by default."""
    iso3s = args.iso3 or PRIORITY_ADM2
    if iso3s == ["ALL"]:   # every country geoBoundaries has at ADM2
        with urllib.request.urlopen(urllib.request.Request("https://www.geoboundaries.org/api/current/gbOpen/ALL/ADM2/", headers=UA), timeout=120) as r:
            listing = json.loads(r.read().decode("utf-8"))
        iso3s = sorted({row["boundaryISO"] for row in listing if row.get("boundaryISO")})
        print(f"  {len(iso3s)} countries with ADM2 on geoBoundaries", file=sys.stderr)
    out_dir = ASSETS / "admin"; out_dir.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((out_dir / "index.json").read_text()) if (out_dir / "index.json").exists() else {}
    for iso3 in iso3s:
        out = out_dir / f"{iso3}-ADM2.json"
        if out.exists() and not args.force:
            print(f"  {iso3} ADM2 exists", file=sys.stderr)
        else:
            try:
                with urllib.request.urlopen(urllib.request.Request(f"https://www.geoboundaries.org/api/current/gbOpen/{iso3}/ADM2/", headers=UA), timeout=60) as r:
                    meta = json.loads(r.read().decode("utf-8"))
                raw = fetch(meta["simplifiedGeometryGeoJSON"], CACHE / "adm2" / f"{iso3}.geojson")
                pct = "4%" if raw.stat().st_size > 20_000_000 else "8%"
                mapshaper(raw, out, pct, ["-each", "name=shapeName,id=shapeID,delete shapeGroup,delete shapeType,delete shapeISO"])
                if out.stat().st_size > LIMIT:
                    mapshaper(raw, out, "2%", ["-each", "name=shapeName,id=shapeID,delete shapeGroup,delete shapeType,delete shapeISO"])
                print(f"  {iso3} ADM2: {raw.stat().st_size // 1024} KB raw -> {out.stat().st_size // 1024} KB", file=sys.stderr)
            except Exception as ex:
                print(f"  {iso3} ADM2 failed: {str(ex)[:100]}", file=sys.stderr)
                continue
        t = json.loads(out.read_text(encoding="utf-8")); obj = next(iter(t["objects"].values()))
        manifest.setdefault(iso3, {})["adm2"] = {"file": out.name, "n": len(obj["geometries"]), "source": "geoBoundaries gbOpen ADM2 (CC BY 4.0)"}
    write_json(out_dir / "index.json", manifest)
    return 0


# ----------------------------------------------------------------------------- G3
def cmd_gazetteer(args) -> int:
    """Search index: countries, admin-1, populated places, physical features. Compact rows: [kind, name, lon, lat, iso3, extra]."""
    rows = []
    facts = json.loads((ASSETS / "data" / "countries.json").read_text(encoding="utf-8"))
    for ccn3, c in facts.items():
        if c.get("latlng"):
            rows.append(["country", c["name"], round(c["latlng"][1], 3), round(c["latlng"][0], 3), c["a3"], c.get("capital")])
    raw = fetch("https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson", CACHE / "ne_10m_admin_1.geojson")
    for f in json.loads(raw.read_text(encoding="utf-8"))["features"]:
        p = f["properties"]
        if p.get("longitude") is not None:
            rows.append(["admin1", p.get("name_en") or p.get("name"), round(p["longitude"], 3), round(p["latitude"], 3), p.get("adm0_a3"), p.get("admin")])
    raw = fetch("https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places_simple.geojson", CACHE / "ne_10m_populated_places_simple.geojson")
    for f in json.loads(raw.read_text(encoding="utf-8"))["features"]:
        p = f["properties"]; lon, lat = f["geometry"]["coordinates"]
        rows.append(["city", p.get("name"), round(lon, 3), round(lat, 3), p.get("adm0_a3"), p.get("adm1name"), p.get("scalerank"), p.get("pop_max")])
    seen = set()
    for name, kind in (("ne_10m_geography_regions_points", "physical"), ("ne_10m_geography_regions_polys", "physical"), ("ne_10m_geography_marine_polys", "marine")):
        try:
            raw = fetch(f"https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/{name}.geojson", CACHE / f"{name}.geojson")
            for f in json.loads(raw.read_text(encoding="utf-8"))["features"]:
                p = {k.lower(): v for k, v in f["properties"].items()}   # the polys file is upper-case
                if f["geometry"]["type"] == "Point":
                    lon, lat = f["geometry"]["coordinates"]
                else:   # polygon: use a cheap centroid of the first ring
                    ring = f["geometry"]["coordinates"][0] if f["geometry"]["type"] == "Polygon" else f["geometry"]["coordinates"][0][0]
                    lon = sum(x for x, _ in ring) / len(ring); lat = sum(y for _, y in ring) / len(ring)
                nm = p.get("name") or p.get("name_en")
                if not nm or (kind, nm.lower()) in seen:   # the same range appears as a point and a polygon
                    continue
                if nm.isupper() and len(nm) > 3:          # Natural Earth capitalises the major features (SAHARA, ALPS)
                    nm = nm.title()
                seen.add((kind, nm.lower()))
                rows.append([kind, nm, round(lon, 3), round(lat, 3), None, p.get("featurecla"), p.get("scalerank")])
        except Exception as ex:
            print(f"  {name} skipped: {str(ex)[:80]}", file=sys.stderr)
    rows = [r for r in rows if r[1]]
    write_json(ASSETS / "data" / "gazetteer.json", rows)
    print(f"  gazetteer: {len(rows)} rows", file=sys.stderr)
    return 0

# ----------------------------------------------------------------------------- L2b: web/public/globe
WEB = ROOT / "web" / "public" / "globe"

# Countries whose largest polygon is the wrong frame for "the country" (spec 11): lon/lat boxes written by hand.
MAINLAND_OVERRIDES = {
    "USA": [-125.0, 24.5, -66.9, 49.4],   # the 48 states; Alaska and Hawaii are reached through their states
    "FRA": [-5.2, 41.3, 9.7, 51.2],       # metropolitan France, not Guiana or Reunion
    "NLD": [3.3, 50.7, 7.3, 53.6],        # the Netherlands in Europe, not Caribbean Netherlands
    "NOR": [4.5, 57.9, 31.2, 71.3],       # without Svalbard
    "RUS": [27.0, 41.2, 180.0, 77.7],     # west of the 180th meridian cut: Chukotka crosses it
    "DNK": [8.0, 54.5, 15.3, 57.8],       # without Greenland and the Faroes
    "ESP": [-9.5, 35.9, 4.4, 43.9],       # without the Canaries
    "PRT": [-9.6, 36.9, -6.1, 42.2],      # without the islands
    "NZL": [166.3, -47.4, 178.7, -34.3],  # without the Chathams and the Kermadecs
    "CHL": [-75.8, -56.0, -66.4, -17.5],  # without Easter Island
    "ECU": [-81.1, -5.1, -75.1, 1.5],     # without the Galapagos
    "GBR": [-8.7, 49.8, 1.8, 60.9],
}


def _ring_area(ring) -> float:
    """Shoelace area of a lon/lat ring in square degrees, scaled by cos(latitude) so a lake in Finland is not overrated."""
    import math
    lat0 = sum(p[1] for p in ring) / len(ring)
    k = math.cos(math.radians(lat0))
    s = 0.0
    for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
        s += x1 * y2 - x2 * y1
    return abs(s) / 2 * k


def _geom_area(g) -> float:
    polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
    return sum(_ring_area(p[0]) - sum(_ring_area(h) for h in p[1:]) for p in polys)


def _geom_bbox(g):
    polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
    pts = [pt for p in polys for pt in p[0]]
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    return [min(xs), min(ys), max(xs), max(ys)]


def cmd_world(args) -> int:
    """L2b: the 110m world for first paint, the 1,000 largest lakes, and `mainland_bbox` for wide countries."""
    out = WEB / "data"; out.mkdir(parents=True, exist_ok=True)
    # 1. 110m countries: same ccn3 ids as the 50m file, about 40 KB gz
    src = fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json", CACHE / "countries-110m.json")
    (out / "countries-110m.json").write_bytes(src.read_bytes())
    print(f"  wrote web/public/globe/data/countries-110m.json ({src.stat().st_size // 1024} KB)", file=sys.stderr)

    # 2. lakes: NE 10m, the 1,000 largest by area, simplified
    raw = fetch("https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_lakes.geojson", CACHE / "ne_10m_lakes.geojson")
    feats = [f for f in json.loads(raw.read_text(encoding="utf-8"))["features"] if f.get("geometry")]
    feats.sort(key=lambda f: -_geom_area(f["geometry"]))
    keep = []
    for f in feats[:1000]:
        p = f["properties"]
        keep.append({"type": "Feature", "geometry": f["geometry"], "properties": {"name": p.get("name_en") or p.get("name"), "wd": p.get("wikidataid") or p.get("wikidata")}})
    tmp = CACHE / "lakes-1000.geojson"
    tmp.write_text(json.dumps({"type": "FeatureCollection", "features": keep}), encoding="utf-8")
    mapshaper(tmp, out / "lakes-10m.json", "20%")
    print(f"  wrote web/public/globe/data/lakes-10m.json ({(out / 'lakes-10m.json').stat().st_size // 1024} KB, {len(keep)} lakes)", file=sys.stderr)

    # 3. mainland_bbox in countries.json: the largest polygon's box for any country that spans more than 60 degrees of longitude
    facts_path = out / "countries.json"
    facts = json.loads(facts_path.read_text(encoding="utf-8"))
    atlas = json.loads(fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json", CACHE / "countries-50m.json").read_text(encoding="utf-8"))
    geoms = {str(g["id"]).zfill(3): g for g in atlas["objects"]["countries"]["geometries"] if "id" in g}
    arcs = atlas["arcs"]
    sc, tr = atlas["transform"]["scale"], atlas["transform"]["translate"]

    def arc_points(i: int):
        pts, x, y = [], 0, 0
        for dx, dy in arcs[i if i >= 0 else ~i]:
            x += dx; y += dy
            pts.append((x * sc[0] + tr[0], y * sc[1] + tr[1]))
        return pts if i >= 0 else pts[::-1]

    def ring_points(ring):
        out_pts = []
        for i in ring:
            out_pts += arc_points(i)
        return out_pts

    n = 0
    for ccn3, c in facts.items():
        g = geoms.get(ccn3)
        c.pop("mainland_bbox", None)
        if not g:
            continue
        polys = g["arcs"] if g["type"] == "MultiPolygon" else [g["arcs"]] if g["type"] == "Polygon" else []
        boxes = []
        for p in polys:
            pts = ring_points(p[0])
            if not pts:
                continue
            xs, ys = [q[0] for q in pts], [q[1] for q in pts]
            boxes.append((_ring_area([(q[0], q[1]) for q in pts]), [min(xs), min(ys), max(xs), max(ys)]))
        if not boxes:
            continue
        full = [min(b[1][0] for b in boxes), min(b[1][1] for b in boxes), max(b[1][2] for b in boxes), max(b[1][3] for b in boxes)]
        if c["a3"] in MAINLAND_OVERRIDES:
            c["mainland_bbox"] = MAINLAND_OVERRIDES[c["a3"]]
            n += 1
        elif full[2] - full[0] > 60 and full[3] > -60:
            big = max(boxes, key=lambda b: b[0])[1]
            if big[2] - big[0] > 180:   # a polygon cut at the antimeridian has no honest mainland box
                continue
            c["mainland_bbox"] = [round(v, 2) for v in big]
            n += 1
    write_json(facts_path, facts)
    print(f"  mainland_bbox on {n} countries", file=sys.stderr)
    return 0


# ----------------------------------------------------------------------------- G5
def cmd_places(args) -> int:
    """Regenerate every view of the locations store (same code path as `locations.py build`)."""
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import location_views
    import locations
    written = location_views.write_all(locations.load())
    for p in written:
        print(f"  wrote {p.relative_to(ROOT)}", file=sys.stderr)
    if not written:
        print("  places: up to date", file=sys.stderr)
    return 0


def cmd_all(args) -> int:
    for fn in (cmd_base, cmd_admin1, cmd_admin2, cmd_gazetteer, cmd_places):
        args.iso3 = getattr(args, "iso3", None); args.force = getattr(args, "force", False)
        fn(args)
    return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("base").set_defaults(fn=cmd_base)
    sub.add_parser("admin1").set_defaults(fn=cmd_admin1)
    a2 = sub.add_parser("admin2"); a2.add_argument("iso3", nargs="*"); a2.add_argument("--force", action="store_true"); a2.set_defaults(fn=cmd_admin2)
    sub.add_parser("gazetteer").set_defaults(fn=cmd_gazetteer)
    sub.add_parser("places").set_defaults(fn=cmd_places)
    sub.add_parser("world").set_defaults(fn=cmd_world)
    al = sub.add_parser("all"); al.add_argument("--force", action="store_true"); al.set_defaults(fn=cmd_all)
    args = ap.parse_args(argv)
    return args.fn(args)


if __name__ == "__main__":
    sys.exit(main())
