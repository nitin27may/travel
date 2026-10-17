#!/usr/bin/env python3
"""Build the data and vendored libraries behind globe/index.html.

    python3 _system/tools/globe_data.py base            # G1: country facts, 50m country polygons, vendored MapLibre
    python3 _system/tools/globe_data.py admin1          # G2: states/provinces for every country (Natural Earth 10m)
    python3 _system/tools/globe_data.py admin2 [ISO3..] # G2: districts for the priority list (geoBoundaries), mapshaper-simplified
    python3 _system/tools/globe_data.py gazetteer       # G3: search index (countries, admin-1, cities, physical names)
    python3 _system/tools/globe_data.py all

Outputs go under globe/assets/ (published). Raw downloads are cached in _system/site/cache/ (gitignored).
Every output must stay under 20 MB (Cloudflare Pages limit is 25 MB per file). Stdlib only; mapshaper via npx.
See _system/site/GLOBE-RESEARCH.md for sources and licences.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "globe" / "assets"
CACHE = ROOT / "_system" / "site" / "cache"
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
    write_json(ROOT / "_system" / "site" / "countries.json", {k: {"a2": v["a2"], "a3": v["a3"], "name": v["name"]} for k, v in facts.items()})

    # 2. country polygons for hover and click (TopoJSON, 50m)
    src = fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json", CACHE / "countries-50m.json")
    (ASSETS / "data").mkdir(parents=True, exist_ok=True)
    (ASSETS / "data" / "countries-50m.json").write_bytes(src.read_bytes())
    print(f"  wrote globe/assets/data/countries-50m.json ({src.stat().st_size // 1024} KB)", file=sys.stderr)

    # 3. vendored MapLibre (ESM build, its worker chunks and CSS), pinned. v6 loads the worker
    #    from maplibre-gl-worker.mjs next to the main module, so all three must sit together.
    for name in ("maplibre-gl.mjs", "maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs", "maplibre-gl.css"):
        f = fetch(f"https://unpkg.com/maplibre-gl@{MAPLIBRE}/dist/{name}", CACHE / f"maplibre-{MAPLIBRE}-{name}")
        (ASSETS / "vendor").mkdir(parents=True, exist_ok=True)
        (ASSETS / "vendor" / name).write_bytes(f.read_bytes())
        print(f"  wrote globe/assets/vendor/{name} ({f.stat().st_size // 1024} KB)", file=sys.stderr)
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


def cmd_all(args) -> int:
    for fn in (cmd_base, cmd_admin1, cmd_admin2, cmd_gazetteer):
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
    al = sub.add_parser("all"); al.add_argument("--force", action="store_true"); al.set_defaults(fn=cmd_all)
    args = ap.parse_args(argv)
    return args.fn(args)


if __name__ == "__main__":
    sys.exit(main())
