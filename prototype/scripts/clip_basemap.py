#!/usr/bin/env python3
"""Rebuild src/data/basemap.json: Natural Earth 10 m country borders, region lines and rivers clipped to
the Dolomites box (roads were dropped: too coarse at this zoom). Needs shapely.
    python3 scripts/clip_basemap.py"""
import json, pathlib, re, urllib.request
from shapely.geometry import box, mapping, shape

BASE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson"
CACHE = pathlib.Path(".cache/ne"); CACHE.mkdir(parents=True, exist_ok=True)
bb = box(10.85, 46.1, 12.9, 47.12)
fc = {"type": "FeatureCollection", "features": []}
for name, kind in (("ne_10m_admin_0_boundary_lines_land", "border"), ("ne_10m_admin_1_states_provinces_lines", "region"),
                   ("ne_10m_rivers_europe", "river"), ("ne_10m_rivers_lake_centerlines", "river")):
    f = CACHE / f"{name}.geojson"
    if not f.exists(): urllib.request.urlretrieve(f"{BASE}/{name}.geojson", f)
    for ft in json.loads(f.read_text())["features"]:
        if not ft.get("geometry"): continue
        g = shape(ft["geometry"])
        if not g.intersects(bb): continue
        g = g.intersection(bb).simplify(0.0005)
        if not g.is_empty: fc["features"].append({"type": "Feature", "properties": {"k": kind}, "geometry": mapping(g)})
s = re.sub(r"(\d+\.\d{4})\d+", r"\1", json.dumps(fc, separators=(",", ":")))
pathlib.Path("src/data/basemap.json").write_text(s)
print(len(fc["features"]), "features")
