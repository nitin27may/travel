#!/usr/bin/env python3
"""Build the globe's data under web/public/globe (the app's only copy).

    python3 tools/globe_data.py base            # G1: country facts, 50m country polygons, vendored MapLibre
    python3 tools/globe_data.py admin1          # G2: states/provinces for every country (Natural Earth 10m)
    python3 tools/globe_data.py admin2 [ISO3..] # G2: districts for the priority list (geoBoundaries), mapshaper-simplified
    python3 tools/globe_data.py gazetteer       # G3: search index (countries, admin-1, cities, physical names)
    python3 tools/globe_data.py features        # GLB2: landform and river boxes, line files, centre audit (web gazetteer patched in place)
    python3 tools/globe_data.py world           # L2b: 110m world, 1,000 largest lakes, mainland_bbox (writes web/public/globe/data)
    python3 tools/globe_data.py canada          # L2b: the 293 Canadian census divisions (StatCan 2021), one file per province
    python3 tools/globe_data.py split           # L2b: USA, India and Brazil districts, one file per state
    python3 tools/globe_data.py audit           # L2b: audit every ADM2 file; a failing country falls back to ADM1 only
    python3 tools/globe_data.py check           # L2b: rebuild the files above from the cached sources and fail on any difference
    python3 tools/globe_data.py places          # G5: saved-place pins (legacy/globe/assets/data/places.json, which location_views owns), plus the list page and WISHLIST.md
    python3 tools/globe_data.py all

Outputs go under web/public/globe/ only (CLN-4); the one exception is `places`, whose pins file is owned by location_views. Raw downloads are cached in tools/.cache/ (gitignored).
Every output must stay under 20 MB (Cloudflare Pages limit is 25 MB per file). Stdlib only; mapshaper via npx.
See research/reports/globe-research-2026-10-16.md for sources and licences.
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
# The one writer target and the only place the app reads (CLN-4). The legacy page's copy under legacy/globe/assets is frozen.
WEB = ROOT / "web" / "public" / "globe"
CACHE = ROOT / "tools" / ".cache"
UA = {"User-Agent": "travel-relevance-signals/1.0 (+https://nks-travel.pages.dev/about/)"}
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
    print(f"  wrote {path.relative_to(ROOT) if path.is_relative_to(ROOT) else path} ({size // 1024} KB)", file=sys.stderr)


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
    write_json(WEB / "data" / "countries.json", facts)
    # keep the small code map used elsewhere in sync
    write_json(ROOT / "data" / "reference" / "countries.json", {k: {"a2": v["a2"], "a3": v["a3"], "name": v["name"]} for k, v in facts.items()})

    # 2. country polygons for hover and click (TopoJSON, 50m)
    src = fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json", CACHE / "countries-50m.json")
    (WEB / "data").mkdir(parents=True, exist_ok=True)
    (WEB / "data" / "countries-50m.json").write_bytes(src.read_bytes())
    print(f"  wrote web/public/globe/data/countries-50m.json ({src.stat().st_size // 1024} KB)", file=sys.stderr)

    # The vendored MapLibre build is not written any more (CLN-4): the app takes maplibre-gl from npm and the frozen legacy page keeps its own copy.
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
    out_dir = WEB / "admin"; out_dir.mkdir(parents=True, exist_ok=True)
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
    out_dir = WEB / "admin"; out_dir.mkdir(parents=True, exist_ok=True)
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


def _build_adm2(iso3: str, out: Path) -> None:
    """Download (if not cached) and simplify one whole-country geoBoundaries ADM2 file into `out`."""
    with urllib.request.urlopen(urllib.request.Request(f"https://www.geoboundaries.org/api/current/gbOpen/{iso3}/ADM2/", headers=UA), timeout=60) as r:
        meta = json.loads(r.read().decode("utf-8"))
    raw = fetch(meta["simplifiedGeometryGeoJSON"], CACHE / "adm2" / f"{iso3}.geojson")
    pct = "4%" if raw.stat().st_size > 20_000_000 else "8%"
    each = ["-each", "name=shapeName,id=shapeID,delete shapeGroup,delete shapeType,delete shapeISO"]
    mapshaper(raw, out, pct, each)
    if out.stat().st_size > LIMIT:
        mapshaper(raw, out, "2%", each)


def _audited_before() -> set[str]:
    f = WEB / "admin" / "adm2-audit.json"
    return {r["a3"] for r in json.loads(f.read_text(encoding="utf-8"))["countries"]} if f.exists() else set()


def _whole_adm2(a3: str) -> Path | None:
    """The whole-country ADM2 file the audit reads. It is not shipped for countries that were split or fell back to ADM1 only, so it
    comes from the download cache (tools/.cache/adm2), simplified the way `admin2` does, and is fetched through the same code when
    the cache lacks it. None when there is no ADM2 for the country."""
    shipped = WEB / "admin" / f"{a3}-ADM2.json"
    if shipped.exists():
        return shipped
    out = CACHE / "adm2-whole" / f"{a3}-ADM2.json"
    if out.exists():
        return out
    if a3 not in _audited_before():       # only countries a previous audit looked at are worth a download
        return None
    out.parent.mkdir(parents=True, exist_ok=True)
    raw = CACHE / "adm2" / f"{a3}.geojson"
    try:
        if raw.exists():
            pct = "4%" if raw.stat().st_size > 20_000_000 else "8%"
            each = ["-each", "name=shapeName,id=shapeID,delete shapeGroup,delete shapeType,delete shapeISO"]
            mapshaper(raw, out, pct, each)
            if out.stat().st_size > LIMIT:
                mapshaper(raw, out, "2%", each)
        else:
            _build_adm2(a3, out)
    except Exception as ex:
        print(f"  {a3}: no ADM2 source ({str(ex)[:100]})", file=sys.stderr)
        out.unlink(missing_ok=True)
        return None
    return out


# ----------------------------------------------------------------------------- G3
def cmd_gazetteer(args) -> int:
    """Search index: countries, admin-1, populated places, physical features. Compact rows: [kind, name, lon, lat, iso3, extra]."""
    rows = []
    facts = json.loads((WEB / "data" / "countries.json").read_text(encoding="utf-8"))
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
    rows += feature_rows()[0]
    rows = [r for r in rows if r[1]]
    print(f"  gazetteer: {len(rows)} rows", file=sys.stderr)
    # Local names go in as aliases in column 8 (backlog 4.13, review S7): a visitor types "Firenze" or "Munchen".
    write_json(WEB / "data" / "gazetteer.json", _with_aliases(rows))
    return 0



# ----------------------------------------------------------------------------- GLB2 (A4, A5): landform extents and lines
# Natural Earth regions, marine areas and rivers (public domain). Each landform row now carries its bounding box (column 9) and, for a
# river or a mapped area, the id of a per-feature file under web/public/globe/line/ (column 10), loaded when the feature is picked.
NE_RAW = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/"
AUDIT = ROOT / "data" / "reference" / "globe" / "landform-audit.json"
NE_CREDIT = "Natural Earth (public domain)"


def _parts(geom) -> list[list[list[list[float]]]]:
    """A geometry as a list of polygons, each a list of rings (outer first)."""
    if geom["type"] == "Polygon":
        return [geom["coordinates"]]
    if geom["type"] == "MultiPolygon":
        return list(geom["coordinates"])
    return []


def _crosses(lons: list[float]) -> bool:
    return bool(lons) and max(lons) - min(lons) > 180


def _unwrap(parts, shift: bool):
    """Longitudes below 0 move up by 360 when the shape crosses the antimeridian, so the box and the label point are continuous."""
    if not shift:
        return parts
    return [[[[x + 360 if x < 0 else x, y] for x, y in ring] for ring in poly] for poly in parts]


def _norm_lon(x: float) -> float:
    return x - 360 if x > 180 else x


def _pip(ring, x: float, y: float) -> bool:
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][0], ring[i][1]; xj, yj = ring[j][0], ring[j][1]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def _in_poly(poly, x: float, y: float) -> bool:
    return _pip(poly[0], x, y) and not any(_pip(h, x, y) for h in poly[1:])


def _signed_area(ring) -> float:
    return sum(ring[i][0] * ring[(i + 1) % len(ring)][1] - ring[(i + 1) % len(ring)][0] * ring[i][1] for i in range(len(ring))) / 2


def _label_point(parts) -> tuple[float, float]:
    """A point inside the largest part: its area centroid, else the middle of the widest chord through the centroid's latitude."""
    big = max(parts, key=lambda p: abs(_signed_area(p[0])))
    ring = big[0]
    a = _signed_area(ring)
    if abs(a) > 1e-12:
        cx = sum((ring[i][0] + ring[(i + 1) % len(ring)][0]) * (ring[i][0] * ring[(i + 1) % len(ring)][1] - ring[(i + 1) % len(ring)][0] * ring[i][1]) for i in range(len(ring))) / (6 * a)
        cy = sum((ring[i][1] + ring[(i + 1) % len(ring)][1]) * (ring[i][0] * ring[(i + 1) % len(ring)][1] - ring[(i + 1) % len(ring)][0] * ring[i][1]) for i in range(len(ring))) / (6 * a)
        if _in_poly(big, cx, cy):
            return cx, cy
    else:
        cy = ring[0][1]
    xs = sorted(ring[i][0] + (cy - ring[i][1]) * (ring[(i + 1) % len(ring)][0] - ring[i][0]) / (ring[(i + 1) % len(ring)][1] - ring[i][1])
                for i in range(len(ring)) if (ring[i][1] > cy) != (ring[(i + 1) % len(ring)][1] > cy))
    chords = [(xs[i], xs[i + 1]) for i in range(0, len(xs) - 1, 2)]
    lo, hi = max(chords, key=lambda c: c[1] - c[0]) if chords else (ring[0][0], ring[0][0])
    return (lo + hi) / 2, cy


def _dp(pts: list[list[float]], tol: float) -> list[list[float]]:
    """Douglas-Peucker, iterative (a 10m coastline has thousands of vertices)."""
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts); keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        (x1, y1), (x2, y2) = pts[a][:2], pts[b][:2]
        dx, dy = x2 - x1, y2 - y1
        d2 = dx * dx + dy * dy
        best, idx = -1.0, -1
        for i in range(a + 1, b):
            x, y = pts[i][:2]
            if d2 == 0:
                d = (x - x1) ** 2 + (y - y1) ** 2
            else:
                t = max(0.0, min(1.0, ((x - x1) * dx + (y - y1) * dy) / d2))
                d = (x - x1 - t * dx) ** 2 + (y - y1 - t * dy) ** 2
            if d > best:
                best, idx = d, i
        if best > tol * tol:
            keep[idx] = True
            stack += [(a, idx), (idx, b)]
    return [p for p, k in zip(pts, keep) if k]


def _r(p, nd=2):
    return [round(p[0], nd), round(p[1], nd)]


def _slug(s: str) -> str:
    import re
    return re.sub(r"[^a-z0-9]+", "-", _fold(s)).strip("-") or "feature"


def _bbox_of(points) -> list[float]:
    xs = [p[0] for p in points]; ys = [p[1] for p in points]
    import math
    # rounded outwards to 0.1 degree, so a point on the shape is never outside its own box
    return [math.floor(min(xs) * 10) / 10, math.floor(min(ys) * 10) / 10, math.ceil(max(xs) * 10) / 10, math.ceil(max(ys) * 10) / 10]


def feature_rows(write_files: bool = False):
    """Gazetteer rows for landforms, seas and rivers, plus the per-feature line files (written when asked).

    Row: [kind, name, lon, lat, None, featurecla, rank, None, None, [w, s, e, n], line_id or None]. East may pass 180 for a shape that
    crosses the antimeridian. The label point of a polygon lies inside the polygon (the old rows averaged the vertices of the first ring).
    """
    rows: list = []
    files: dict[str, dict] = {}
    used_ids: set[str] = set()
    legacy: dict[tuple, tuple] = {}
    shapes: dict[tuple, list] = {}   # (kind, name) -> polygons, longitudes unwrapped across the antimeridian

    def uid(name: str, cls: str) -> str:
        i = _slug(name)
        if i in used_ids:
            i = f"{i}-{_slug(cls)}"
        n = 2
        base = i
        while i in used_ids:
            i = f"{base}-{n}"; n += 1
        used_ids.add(i)
        return i

    seen: set[tuple] = set()
    srcs = (("ne_10m_geography_regions_polys", "physical"), ("ne_10m_geography_marine_polys", "marine"), ("ne_10m_geography_regions_points", "physical"))
    # polygons first, so a point row of the same name can take the box
    for name, kind in srcs:
        raw = fetch(f"{NE_RAW}{name}.geojson", CACHE / f"{name}.geojson")
        for f in json.loads(raw.read_text(encoding="utf-8"))["features"]:
            p = {k.lower(): v for k, v in f["properties"].items()}
            nm = p.get("name") or p.get("name_en")
            if not nm:
                continue
            if nm.isupper() and len(nm) > 3:
                nm = nm.title()
            cls = p.get("featurecla")
            if f["geometry"]["type"] == "Point":
                lon, lat = f["geometry"]["coordinates"]
                if (kind, nm.lower()) in seen:
                    continue   # the polygon of the same name already supplies the row
                seen.add((kind, nm.lower()))
                rows.append([kind, nm, round(lon, 3), round(lat, 3), None, cls, p.get("scalerank"), None, None, None, None])
                continue
            if (kind, nm.lower()) in seen:
                continue
            seen.add((kind, nm.lower()))
            parts = _parts(f["geometry"])
            if not parts:
                continue
            lons = [x for poly in parts for x, _ in poly[0]]
            cross = _crosses(lons)
            up = _unwrap(parts, cross)
            allpts = [pt for poly in up for pt in poly[0]]
            box = _bbox_of(allpts)
            lx, ly = _label_point(up)
            lon, lat = _norm_lon(lx), ly
            shapes[(kind, nm)] = up
            ring0 = parts[0][0]   # what the first build used: the mean of the vertices of the first ring (kept to make the audit reproducible)
            legacy[(kind, nm)] = (sum(x for x, _ in ring0) / len(ring0), sum(y for _, y in ring0) / len(ring0))
            rank = p.get("scalerank")
            row = [kind, nm, round(lon, 3), round(lat, 3), None, cls, rank, None, None, box, None]
            # A line file for the shapes whose outline says something: ranges, plains, deltas, plateaus, deserts, basins, valleys and the like.
            # Islands and island groups are drawn by the basemap, seas have no honest edge at this scale, and a shape across the antimeridian
            # cannot be drawn as one line.
            if kind == "physical" and cls and cls.lower() not in ("island", "island group", "continent", "geoarea", "pole", "dragons-be-here") and not cross:
                span = max(box[2] - box[0], box[3] - box[1])
                tol = max(0.02, span * 0.004)
                big = max(abs(_signed_area(poly[0])) for poly in parts)
                keep = [poly for poly in parts if abs(_signed_area(poly[0])) >= big * 0.02]
                out = []
                for poly in keep:
                    ring = _dp(poly[0], tol)
                    if len(ring) >= 4:
                        out.append([[_r(q) for q in ring]])
                if out:
                    fid = uid(nm, cls)
                    row[10] = fid
                    files[fid] = {"id": fid, "name": nm, "kind": "area", "bbox": box, "geometry": {"type": "MultiPolygon", "coordinates": out}, "credit": NE_CREDIT}
            rows.append(row)

    # rivers: one row and one file per name, the segments joined as a MultiLineString
    raw = fetch(f"{NE_RAW}ne_10m_rivers_lake_centerlines.geojson", CACHE / "ne_10m_rivers_lake_centerlines.geojson")
    byname: dict[str, dict] = {}
    for f in json.loads(raw.read_text(encoding="utf-8"))["features"]:
        p = f["properties"]
        nm = p.get("name_en") or p.get("name")
        if not nm or p.get("featurecla") != "River" or (p.get("scalerank") or 99) > 6:
            continue
        e = byname.setdefault(nm, {"rank": p["scalerank"], "lines": []})
        e["rank"] = min(e["rank"], p["scalerank"])
        e["lines"] += f["geometry"]["coordinates"]
    for nm, e in sorted(byname.items()):
        lines = e["lines"]
        pts = [q for ln in lines for q in ln]
        box = _bbox_of(pts)
        span = max(box[2] - box[0], box[3] - box[1])
        tol = max(0.01, span * 0.003)
        simp = [[_r(q) for q in _dp(ln, tol)] for ln in lines if len(ln) >= 2]
        simp = [ln for ln in simp if len(ln) >= 2]
        if not simp:
            continue
        # a point that lies on the line: the middle vertex of the longest piece
        longest = max(simp, key=len)
        mid = longest[len(longest) // 2]
        fid = uid(nm, "river")
        rows.append(["river", nm, round(mid[0], 3), round(mid[1], 3), None, "river", int(e["rank"]), None, None, box, fid])
        files[fid] = {"id": fid, "name": nm, "kind": "line", "bbox": box, "geometry": {"type": "MultiLineString", "coordinates": simp}, "credit": NE_CREDIT}
    if write_files:
        outdir = WEB / "line"
        if outdir.exists():
            for old in outdir.glob("*.json"):
                old.unlink()
        outdir.mkdir(parents=True, exist_ok=True)
        for fid, doc in files.items():
            (outdir / f"{fid}.json").write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return rows, files, shapes, legacy


def cmd_features(args) -> int:
    """GLB2: landform, sea and river rows with a box and a line id; per-feature line files; the centre audit. Patches the web gazetteer in place.

    Reads Natural Earth (cached under tools/.cache), so it needs no other download; the rows of countries, states and cities are untouched.
    """
    import gzip
    gz_path = WEB / "data" / "gazetteer.json"
    old = json.loads(gz_path.read_text(encoding="utf-8"))
    rows, files, shapes, legacy = feature_rows(write_files=True)
    # The audit: every landform and water row whose shape we hold, its OLD point against the exact box and against the polygon itself.
    outside_box, outside_poly, new_bad, checked = [], [], [], 0
    for r in rows:
        sh = shapes.get((r[0], r[1]))
        if not sh:
            continue
        checked += 1
        pts = [q for poly in sh for q in poly[0]]
        xs = [q[0] for q in pts]; ys = [q[1] for q in pts]
        def inside(lon, lat):
            lon = lon + 360 if (max(xs) > 180 and lon < 0) else lon
            return min(xs) <= lon <= max(xs) and min(ys) <= lat <= max(ys), any(_in_poly(poly, lon, lat) for poly in sh)
        o = legacy.get((r[0], r[1]))
        if o:
            in_box, in_poly = inside(*o)
            if not in_box: outside_box.append(r[1])
            if not in_poly: outside_poly.append(r[1])
        if not inside(r[2], r[3])[0]: new_bad.append(r[1])
    audit = {"rows_with_a_shape": checked, "old_points_outside_box": len(outside_box), "old_points_outside_shape": len(outside_poly),
             "old_outside_box_names": sorted(outside_box), "new_points_outside_box": len(new_bad),
             "rows": {k: sum(1 for r in rows if r[0] == k) for k in ("physical", "marine", "river")}, "line_files": len(files)}
    sizes = [len(gzip.compress(json.dumps(d, separators=(",", ":")).encode())) for d in files.values()]
    audit["line_gzip_bytes"] = {"total": sum(sizes), "max": max(sizes), "median": sorted(sizes)[len(sizes) // 2]}
    AUDIT.parent.mkdir(parents=True, exist_ok=True)
    AUDIT.write_text(json.dumps(audit, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    keep = [r for r in old if r[0] not in ("physical", "marine", "river")]
    write_json(gz_path, keep + rows)
    print(f"  features: {audit}", file=sys.stderr)
    return 0


ALIAS_LANGS = ("de", "es", "fr", "pt", "it", "nl")


def _fold(s: str) -> str:
    import unicodedata
    return unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower()


def _alias_list(name: str, props: dict, keys: list[str]) -> list[str]:
    """Distinct spellings (other languages, the local and alternate names) that differ from `name` once accents are folded."""
    seen = {_fold(name)}
    out: list[str] = []
    for k in keys:
        for v in str(props.get(k) or "").replace("|", ",").split(","):
            v = v.strip()
            if v and _fold(v) not in seen and _fold(v):
                seen.add(_fold(v)); out.append(v)
    return out


def _with_aliases(rows: list) -> list:
    """Rows with an alias string (`a|b`) in column 8: cities from the full Natural Earth table, admin-1 from its name_* fields."""
    full = fetch("https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places.geojson", CACHE / "ne_10m_populated_places.geojson")
    city: dict[tuple, str] = {}
    for f in json.loads(full.read_text(encoding="utf-8"))["features"]:
        p = f["properties"]; lon, lat = f["geometry"]["coordinates"]
        al = _alias_list(p["NAME"], p, ["NAMEPAR", "NAMEALT"] + [f"NAME_{l.upper()}" for l in ALIAS_LANGS])
        if al:
            city[(p["NAME"], p["ADM0_A3"], round(lon, 3), round(lat, 3))] = "|".join(al)
    adm = fetch("https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson", CACHE / "ne_10m_admin_1.geojson")
    admin: dict[tuple, str] = {}
    for f in json.loads(adm.read_text(encoding="utf-8"))["features"]:
        p = f["properties"]
        if p.get("longitude") is None:
            continue
        name = p.get("name_en") or p.get("name")
        if not name:
            continue
        al = _alias_list(name, p, ["name", "name_local"])   # provinces carry their parent region in the other fields: noise, not names
        if al:
            admin[(name, p.get("adm0_a3"), round(p["longitude"], 3), round(p["latitude"], 3))] = "|".join(al)
    # NAMEALT sometimes holds a country ("Italy" on an Antarctic base): never an alias of a place that is not that country
    countries = {_fold(r[1]) for r in rows if r[0] == "country"}
    out = []
    for r in rows:
        key = (r[1], r[4], r[2], r[3])
        al = city.get(key) if r[0] == "city" else admin.get(key) if r[0] == "admin1" else None
        if al:
            al = "|".join(a for a in al.split("|") if _fold(a) not in countries)
        if al:
            out.append(list(r) + [None] * (8 - len(r)) + [al])
        else:
            out.append(r)
    return out

# ----------------------------------------------------------------------------- L2b: web/public/globe

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


# ----------------------------------------------------------------------------- L2b: Canada census divisions, ADM2 splits, audit
UA_SIGNALS = {"User-Agent": "travel-relevance-signals/1.0 (+https://nks-travel.pages.dev/about/)"}
STATCAN_CD = "https://geo.statcan.gc.ca/geo_wa/rest/services/2021/Cartographic_boundary_files/MapServer/4/query"
# Statistics Canada PRUID to ISO 3166-2, the key the per-province files are filed under (Natural Earth admin-1 `iso`)
PRUID_ISO = {"10": "CA-NL", "11": "CA-PE", "12": "CA-NS", "13": "CA-NB", "24": "CA-QC", "35": "CA-ON", "46": "CA-MB", "47": "CA-SK",
             "48": "CA-AB", "59": "CA-BC", "60": "CA-YT", "61": "CA-NT", "62": "CA-NU"}
CAN_SOURCE = "Statistics Canada 2021 census divisions, cartographic boundary file (Open Government Licence - Canada)"
# countries whose ADM2 is split into one file per ADM1 so a visitor to Texas does not download Alaska (spec 8.2)
SPLIT_ADM2 = ["USA", "IND", "BRA"]


def _manifest() -> dict:
    return json.loads((WEB / "admin" / "index.json").read_text(encoding="utf-8"))


def _write_manifest(m: dict) -> None:
    write_json(WEB / "admin" / "index.json", dict(sorted(m.items())))


def _geojson_from_topo(topo_path: Path, out: Path) -> dict:
    """The shipped TopoJSON as GeoJSON (through mapshaper, so the arcs are decoded the way every other tool decodes them)."""
    subprocess.run(["npx", "-y", "mapshaper", str(topo_path), "-o", "format=geojson", str(out)], check=True, capture_output=True, text=True)
    return json.loads(out.read_text(encoding="utf-8"))


def _rep_points(geom) -> list[tuple[float, float]]:
    """A few points that vote for the state a district sits in: the mean of the biggest outer ring (which can fall outside a
    crescent-shaped county) and four vertices spread round it, nudged toward the mean so they are inside the district."""
    polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    ring = max((p[0] for p in polys), key=len)
    mx, my = sum(p[0] for p in ring) / len(ring), sum(p[1] for p in ring) / len(ring)
    pts = [(mx, my)]
    for k in range(4):
        x, y = ring[(k * len(ring)) // 4]
        pts.append((mx + (x - mx) * 0.8, my + (y - my) * 0.8))
    return pts


def _state_of(geom, states: list) -> dict | None:
    votes: dict[int, int] = {}
    for x, y in _rep_points(geom):
        for i, st in enumerate(states):
            if _in_geom(st["geometry"], x, y):
                votes[i] = votes.get(i, 0) + 1
                break
    return states[max(votes, key=lambda i: (votes[i], -i))] if votes else None


def _in_ring(ring, x: float, y: float) -> bool:
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]; xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def _in_geom(geom, x: float, y: float) -> bool:
    polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    return any(_in_ring(p[0], x, y) and not any(_in_ring(h, x, y) for h in p[1:]) for p in polys)


def cmd_canada(args) -> int:
    """F4: replace geoBoundaries' 76 economic regions with the 293 census divisions, one file per province (Whitby is in Durham)."""
    import time
    cache = CACHE / "statcan-cd"; cache.mkdir(parents=True, exist_ok=True)
    listing = CACHE / "statcan-cd-list.json"
    if not listing.exists():
        url = STATCAN_CD + "?" + urllib.parse.urlencode({"where": "1=1", "outFields": "CDUID,CDNAME,PRUID", "returnGeometry": "false", "f": "json"})
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA_SIGNALS), timeout=120) as r:
            listing.write_bytes(r.read())
    rows = [f["attributes"] for f in json.loads(listing.read_text(encoding="utf-8"))["features"]]
    assert len(rows) == 293, f"expected 293 census divisions, StatCan lists {len(rows)}"
    for a in rows:
        dest = cache / f"{a['CDUID']}.geojson"
        if dest.exists() and dest.stat().st_size > 100:
            continue
        # The service fails on some divisions with a long coast (Division No. 1 is whole-island Newfoundland): ask for full detail
        # first, then for coarser copies, and keep the first answer. The coarsest is 0.01 degrees, about 1 km, under our own simplification.
        body = None
        for offset, attempt in [(o, t) for o in (None, 0.002, 0.005, 0.01) for t in range(3)]:
            q = {"where": f"CDUID='{a['CDUID']}'", "outFields": "CDUID", "outSR": "4326", "f": "geojson"}
            if offset:
                q["maxAllowableOffset"] = str(offset)
            try:
                with urllib.request.urlopen(urllib.request.Request(STATCAN_CD + "?" + urllib.parse.urlencode(q), headers=UA_SIGNALS), timeout=300) as r:
                    body = r.read()
                json.loads(body)
                break
            except Exception as ex:   # 500 or an HTML error page: the service is flaky, so retry, then try a coarser copy
                body = None
                print(f"  {a['CDUID']} offset {offset} try {attempt + 1}: {str(ex)[:60]}", file=sys.stderr)
                time.sleep(2.0)
        if body is None:
            raise SystemExit(f"census division {a['CDUID']} could not be fetched at any detail")
        dest.write_bytes(body)
        time.sleep(1.0)
    feats = []
    for a in sorted(rows, key=lambda r: r["CDUID"]):
        gj = json.loads((cache / f"{a['CDUID']}.geojson").read_text(encoding="utf-8"))
        for f in gj["features"]:
            name = " ".join(str(a["CDNAME"]).split())
            feats.append({"type": "Feature", "geometry": f["geometry"], "properties": {"name": name, "id": a["CDUID"], "pr": PRUID_ISO[a["PRUID"]]}})
    out_dir = WEB / "admin"
    parts = {}
    for iso in sorted(set(PRUID_ISO.values())):
        sub = [f for f in feats if f["properties"]["pr"] == iso]
        tmp = CACHE / "canada" / f"{iso}.geojson"; tmp.parent.mkdir(parents=True, exist_ok=True)
        tmp.write_text(json.dumps({"type": "FeatureCollection", "features": sub}), encoding="utf-8")
        out = out_dir / f"CAN-ADM2-{iso.split('-')[1]}.json"
        mapshaper(tmp, out, "1.5%", ["-each", "delete pr"])
        parts[iso] = out.name
        print(f"  {iso}: {len(sub)} divisions -> {out.stat().st_size // 1024} KB", file=sys.stderr)
    old = out_dir / "CAN-ADM2.json"
    m = _manifest()
    m["CAN"]["adm2"] = {"file": None, "parts": parts, "n": len(feats), "source": CAN_SOURCE}
    _write_manifest(m)
    print(f"  CAN: {len(feats)} census divisions in {len(parts)} province files; {old.name} is no longer referenced", file=sys.stderr)
    return 0


def cmd_split(args) -> int:
    """Split the biggest ADM2 files by ADM1 (Natural Earth `iso`), so one state loads on its own. Reads the cached geoBoundaries
    download and simplifies it exactly as `admin2` does, so the parts are what the whole file would have been."""
    m = _manifest()
    adm1_all = json.loads((CACHE / "ne_10m_admin_1.geojson").read_text(encoding="utf-8"))["features"]
    (CACHE / "split").mkdir(parents=True, exist_ok=True)
    for a3 in (args.iso3 or SPLIT_ADM2):
        raw = CACHE / "adm2" / f"{a3}.geojson"
        if not raw.exists():
            print(f"  {a3}: no cached geoBoundaries download, skipped", file=sys.stderr); continue
        states = [f for f in adm1_all if f["properties"].get("adm0_a3") == a3 and f.get("geometry")]
        pct = "4%" if raw.stat().st_size > 20_000_000 else "8%"
        whole = CACHE / "split" / f"{a3}-whole.json"
        mapshaper(raw, whole, pct, ["-each", "name=shapeName,id=shapeID,delete shapeGroup,delete shapeType,delete shapeISO"])
        gj = _geojson_from_topo(whole, CACHE / "split" / f"{a3}.geojson")
        groups: dict[str, list] = {}
        lost = 0
        for f in gj["features"]:
            hit = _state_of(f["geometry"], states)
            if not hit or not hit["properties"].get("iso_3166_2"):
                lost += 1; continue
            groups.setdefault(hit["properties"]["iso_3166_2"], []).append(f)
        parts = {}
        for iso, fs in sorted(groups.items()):
            tmp = CACHE / "split" / f"{a3}-{iso}.geojson"
            tmp.write_text(json.dumps({"type": "FeatureCollection", "features": fs}), encoding="utf-8")
            out = WEB / "admin" / f"{a3}-ADM2-{iso.split('-', 1)[1]}.json"
            mapshaper(tmp, out, "100%")
            parts[iso] = out.name
        m[a3]["adm2"] = {"file": None, "parts": parts, "n": sum(len(v) for v in groups.values()), "source": "geoBoundaries gbOpen ADM2 (CC BY 4.0)"}
        print(f"  {a3}: {m[a3]['adm2']['n']} districts in {len(parts)} state files ({lost} outside every state)", file=sys.stderr)
    _write_manifest(m)
    return 0


# ---- the ADM2 audit (spec 11, F4) --------------------------------------------------------------------------------------
COAST_TOL = 0.05        # degrees, about 5 km: a 50m coast vertex farther than this from every ADM2 edge has been simplified away
COAST_FAIL_PCT = 25.0   # a country fails when more than this share of its sampled coast vertices are that far from the ADM2 outline
MIN_DEEPER = 1.3        # districts must outnumber states by this ratio, or the file is the state level under another name


def _topo_lines(topo: dict) -> list[list[tuple[float, float]]]:
    """Every arc of a TopoJSON as absolute lon/lat points."""
    tr = topo.get("transform", {"scale": [1, 1], "translate": [0, 0]})
    sc, tl = tr["scale"], tr["translate"]
    out = []
    for arc in topo["arcs"]:
        x = y = 0
        pts = []
        for dx, dy in arc:
            x += dx; y += dy
            pts.append((x * sc[0] + tl[0], y * sc[1] + tl[1]))
        out.append(pts)
    return out


class _Grid:
    """Segments in 0.25 degree cells; `near` asks whether any segment is within `tol` degrees of a point (longitude scaled by cos latitude)."""
    CELL = 0.25

    def __init__(self, lines):
        import math
        self.cells: dict[tuple[int, int], list] = {}
        for pts in lines:
            for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
                for cx in range(math.floor(min(x0, x1) / self.CELL), math.floor(max(x0, x1) / self.CELL) + 1):
                    for cy in range(math.floor(min(y0, y1) / self.CELL), math.floor(max(y0, y1) / self.CELL) + 1):
                        self.cells.setdefault((cx, cy), []).append((x0, y0, x1, y1))

    def nearest(self, x: float, y: float, tol: float) -> float:
        import math
        k = math.cos(math.radians(y))
        best = 9.0
        r = int(tol / self.CELL) + 1
        cx0, cy0 = math.floor(x / self.CELL), math.floor(y / self.CELL)
        for cx in range(cx0 - r, cx0 + r + 1):
            for cy in range(cy0 - r, cy0 + r + 1):
                for x0, y0, x1, y1 in self.cells.get((cx, cy), ()):
                    ax, ay, bx, by = (x0 - x) * k, y0 - y, (x1 - x) * k, y1 - y
                    dx, dy = bx - ax, by - ay
                    d2 = dx * dx + dy * dy
                    t = 0.0 if d2 == 0 else max(0.0, min(1.0, -(ax * dx + ay * dy) / d2))
                    d = math.hypot(ax + t * dx, ay + t * dy)
                    if d < best:
                        best = d
        return best


def cmd_audit(args) -> int:
    """Audit every ADM2 file we ship: level meaning, truncated names, and shoreline fidelity against the 50m coast. A failing
    country loses its ADM2 entry (its shapes fall back to ADM1 only); the whole-country files of those countries are not shipped (removed 19 Oct 2026); they are rebuilt from tools/.cache/adm2."""
    atlas = json.loads((CACHE / "countries-50m.json").read_text(encoding="utf-8"))
    facts = json.loads((WEB / "data" / "countries.json").read_text(encoding="utf-8"))
    a3_of = {str(k).zfill(3): v["a3"] for k, v in facts.items()}
    # the 50m boundary of each country as points to test
    tr = atlas["transform"]
    sc, tl = tr["scale"], tr["translate"]
    arcs = []
    for arc in atlas["arcs"]:
        x = y = 0
        pts = []
        for dx, dy in arc:
            x += dx; y += dy
            pts.append((x * sc[0] + tl[0], y * sc[1] + tl[1]))
        arcs.append(pts)
    boundary: dict[str, list[tuple[float, float]]] = {}
    for g in atlas["objects"]["countries"]["geometries"]:
        a3 = a3_of.get(str(g.get("id", "")).zfill(3))
        if not a3:
            continue
        rings = g["arcs"] if g["type"] == "Polygon" else [r for poly in g["arcs"] for r in poly] if g["type"] == "MultiPolygon" else []
        pts = [pt for ring in rings for i in ring for pt in (arcs[i] if i >= 0 else arcs[~i])]
        boundary.setdefault(a3, []).extend(pts)
    m = _manifest()
    rows = []
    for a3, e in sorted(m.items()):
        a2 = e.get("adm2")
        whole = None if a2 else _whole_adm2(a3)
        if whole is not None:
            # an entry an earlier audit dropped: look at the source again, so the audit gives the same answer every time it runs
            t = json.loads(whole.read_text(encoding="utf-8"))
            a2 = {"file": f"{a3}-ADM2.json", "n": len(next(iter(t["objects"].values()))["geometries"]), "source": "geoBoundaries gbOpen ADM2 (CC BY 4.0)"}
            e["adm2"] = a2
        if not a2:
            continue
        files = [a2["file"]] if a2.get("file") else list(a2.get("parts", {}).values())
        names, n_trunc, lines = 0, [], []
        for f in files:
            topo = json.loads(((whole if whole is not None and f == a2["file"] else WEB / "admin" / f)).read_text(encoding="utf-8"))
            obj = next(iter(topo["objects"].values()))
            for g in obj["geometries"]:
                names += 1
                nm = str((g.get("properties") or {}).get("name", ""))
                if "*" in nm:
                    n_trunc.append(nm)
            lines.extend(_topo_lines(topo))
        grid = _Grid(lines)
        # only the 50m coast inside the box the ADM2 file covers: overseas territories (French Guiana, Svalbard) are not its to match
        xs = [p[0] for l in lines for p in l]; ys = [p[1] for l in lines for p in l]
        box = (min(xs) - 0.5, min(ys) - 0.5, max(xs) + 0.5, max(ys) + 0.5)
        pts = [p for p in boundary.get(a3, []) if box[0] <= p[0] <= box[2] and box[1] <= p[1] <= box[3]]
        step = max(1, len(pts) // 1500)
        sample = pts[::step]
        far = [d for d in (grid.nearest(x, y, COAST_TOL * 2) for x, y in sample) if d > COAST_TOL]
        pct = 100.0 * len(far) / max(1, len(sample))
        n1 = e.get("adm1", {}).get("n", 0)
        problems = []
        if n_trunc:
            problems.append(f"{len(n_trunc)} truncated names")
        if n1 and a2["n"] < MIN_DEEPER * n1:
            problems.append(f"level: {a2['n']} districts for {n1} states")
        if pct > COAST_FAIL_PCT:
            problems.append(f"coast: {pct:.0f}% of sampled coast vertices more than {COAST_TOL} degrees from the ADM2 outline")
        rows.append({"a3": a3, "n2": a2["n"], "n1": n1, "files": len(files), "truncated": len(n_trunc), "example": n_trunc[0] if n_trunc else "",
                     "coast_far_pct": round(pct, 1), "samples": len(sample), "source": a2.get("source", ""), "problems": problems})
        print(f"  {a3}: {a2['n']} districts, {pct:.0f}% far, {len(n_trunc)} truncated {'FAIL ' + '; '.join(problems) if problems else 'ok'}", file=sys.stderr)
    out = {"tolerance_deg": COAST_TOL, "coast_fail_pct": COAST_FAIL_PCT, "min_deeper": MIN_DEEPER, "countries": rows}
    write_json(WEB / "admin" / "adm2-audit.json", out)
    failing = [r for r in rows if r["problems"]]
    for r in failing:
        m[r["a3"]].pop("adm2", None)
    _write_manifest(m)
    print(f"  audit: {len(rows)} countries, {len(failing)} fall back to ADM1 only", file=sys.stderr)
    return 0


def cmd_check(args) -> int:
    """Rebuild every file `world`, `canada`, `split` and `audit` write into a temp dir from the cached sources, and fail on any
    difference from what is shipped. Without the cached downloads (tools/.cache is not in git) there is nothing to rebuild from:
    it says so and passes."""
    import filecmp
    import shutil
    import tempfile
    needed = [CACHE / "countries-110m.json", CACHE / "ne_10m_lakes.geojson", CACHE / "statcan-cd-list.json", CACHE / "ne_10m_admin_1.geojson", CACHE / "countries-50m.json"]
    missing = [p.name for p in needed if not p.exists()]
    if missing:
        print(f"globe_data check: skipped, no cached sources ({', '.join(missing)})", file=sys.stderr)
        return 0
    global WEB
    shipped = WEB
    tmp = Path(tempfile.mkdtemp(prefix="globe-check-"))
    try:
        (tmp / "data").mkdir(); (tmp / "admin").mkdir()
        # the inputs these steps read from the shipped tree: the facts, the manifest and the admin-1 files
        shutil.copy(shipped / "data" / "countries.json", tmp / "data" / "countries.json")
        shutil.copy(shipped / "admin" / "index.json", tmp / "admin" / "index.json")
        for f in (shipped / "admin").glob("*.json"):       # the whole-country files that ARE shipped (listed in index.json); dropped and split
            if "-ADM2-" not in f.name and f.name != "index.json":   # countries have none and the audit reads their source from the cache
                shutil.copy(f, tmp / "admin" / f.name)
        WEB = tmp
        ns = argparse.Namespace(iso3=None, force=False)
        for fn in (cmd_world, cmd_canada, cmd_split, cmd_audit):
            fn(ns)
        WEB = shipped
        bad = []
        names = {"data/countries-110m.json", "data/lakes-10m.json", "data/countries.json", "admin/index.json", "admin/adm2-audit.json"}
        names |= {f"admin/{p.name}" for p in (tmp / "admin").glob("*-ADM2-*.json")}
        for rel in sorted(names):
            a, b = tmp / rel, shipped / rel
            if not b.exists() or not filecmp.cmp(a, b, shallow=False):
                bad.append(rel)
        extra = sorted(f"admin/{p.name}" for p in (shipped / "admin").glob("*-ADM2-*.json") if f"admin/{p.name}" not in names)
        if bad or extra:
            print("globe_data check: the shipped files differ from a rebuild of the cached sources:", *(bad + [f"{e} (no longer produced)" for e in extra]), sep="\n  ", file=sys.stderr)
            return 1
        print(f"globe_data check: {len(names)} files rebuilt identically", file=sys.stderr)
        return 0
    finally:
        WEB = shipped
        shutil.rmtree(tmp, ignore_errors=True)


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
    sub.add_parser("features").set_defaults(fn=cmd_features)
    sub.add_parser("world").set_defaults(fn=cmd_world)
    sub.add_parser("canada").set_defaults(fn=cmd_canada)
    sub.add_parser("audit").set_defaults(fn=cmd_audit)
    sub.add_parser("check").set_defaults(fn=cmd_check)
    sp = sub.add_parser("split"); sp.add_argument("iso3", nargs="*"); sp.set_defaults(fn=cmd_split)
    al = sub.add_parser("all"); al.add_argument("--force", action="store_true"); al.set_defaults(fn=cmd_all)
    args = ap.parse_args(argv)
    return args.fn(args)


if __name__ == "__main__":
    sys.exit(main())
