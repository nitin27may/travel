"""Offline checks on the globe's built data (globe/assets). Run: python3 -m pytest tools/tests -q
These guard the publish: every file the page fetches must exist, parse, and stay under the Pages limit."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "globe" / "assets"
PAGE = ROOT / "globe" / "index.html"
LIMIT = 20 * 1024 * 1024


def _json(p: Path):
    return json.loads(p.read_text(encoding="utf-8"))


def test_vendor_files_present_and_pinned():
    for name in ("maplibre-gl.mjs", "maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs", "maplibre-gl.css"):
        assert (ASSETS / "vendor" / name).exists(), name
    assert (ASSETS / "vendor" / "maplibre-gl.mjs").stat().st_size > 500_000
    assert "maplibre-gl 6." in (ASSETS / "vendor" / "VERSIONS.txt").read_text()


def test_country_facts_cover_world_atlas_ids():
    facts = _json(ASSETS / "data" / "countries.json")
    topo = _json(ASSETS / "data" / "countries-50m.json")
    ids = {str(g["id"]).zfill(3) for g in topo["objects"]["countries"]["geometries"] if g.get("id") is not None}
    missing = sorted(i for i in ids if i not in facts)
    assert len(missing) <= 10, f"world-atlas ids without facts: {missing}"   # a few territories have no ISO row
    assert all(v["a3"] and v["a2"] and v["name"] for v in facts.values())
    with_pop = sum(1 for v in facts.values() if v.get("population"))
    assert with_pop > 200, "population mostly missing; the Wikidata query failed"


def test_admin_manifest_matches_files_and_sizes():
    manifest = _json(ASSETS / "admin" / "index.json")
    assert len(manifest) >= 180
    adm1 = sum(1 for v in manifest.values() if "adm1" in v)
    adm2 = sum(1 for v in manifest.values() if "adm2" in v)
    assert adm1 >= 240 and adm2 >= 170, (adm1, adm2)
    for iso3, levels in manifest.items():
        for lvl, meta in levels.items():
            f = ASSETS / "admin" / meta["file"]
            assert f.exists(), f"{iso3} {lvl} listed but missing"
            assert f.stat().st_size < LIMIT, f"{f.name} over the 20 MB ceiling"
            assert meta["n"] >= 1


def test_every_admin_file_is_valid_topojson():
    files = sorted((ASSETS / "admin").glob("*-ADM*.json"))
    assert len(files) >= 400
    for f in files:
        t = _json(f)
        assert t.get("type") == "Topology", f.name
        obj = next(iter(t["objects"].values()))
        assert obj["geometries"], f.name
        assert all("properties" in g for g in obj["geometries"]), f.name


def test_india_drill_path_exists():
    manifest = _json(ASSETS / "admin" / "index.json")
    adm1 = _json(ASSETS / "admin" / manifest["IND"]["adm1"]["file"])
    names = {g["properties"]["name"] for g in next(iter(adm1["objects"].values()))["geometries"]}
    assert "Maharashtra" in names
    adm2 = _json(ASSETS / "admin" / manifest["IND"]["adm2"]["file"])
    names2 = {g["properties"]["name"] for g in next(iter(adm2["objects"].values()))["geometries"]}
    assert "Mumbai Suburban" in names2


def test_gazetteer_shape_and_coverage():
    rows = _json(ASSETS / "data" / "gazetteer.json")
    assert len(rows) > 12000
    kinds = {r[0] for r in rows}
    assert {"country", "admin1", "city", "marine", "physical"} <= kinds
    for r in rows:
        assert r[1] and -180 <= r[2] <= 180 and -90 <= r[3] <= 90, r
    names = {r[1] for r in rows}
    for must in ("Mumbai", "Quebec", "Sahara", "Alps", "Bay of Bengal", "Canada"):
        assert must in names, must
    assert not any(r[1].isupper() and len(r[1]) > 3 for r in rows if r[0] == "physical"), "upper-case landform names leaked"


def test_page_references_only_files_that_exist():
    html = PAGE.read_text(encoding="utf-8")
    for ref in set(re.findall(r"""['"](assets/[A-Za-z0-9_./-]+)['"]""", html)):
        assert (ROOT / "globe" / ref).exists(), ref
    assert "maplibre-gl.mjs" in html and "openfreemap.org" in html and "mapterhorn" in html
    assert "<script src=" not in html, "no external classic scripts; the module import is vendored"


def test_places_json_contract_and_counts():
    doc = _json(ASSETS / "data" / "places.json")
    assert doc["schema"] == "globe-places/1"
    places = doc["places"]
    assert doc["count"] == len(places) > 0
    ids = [p["id"] for p in places]
    assert len(ids) == len(set(ids)), "duplicate place ids"
    for p in places:
        assert p["status"] != "dropped", p["id"]
        lat, lon = p["lat"], p["lon"]
        assert (lat is None) == (lon is None), p["id"]
        if lat is not None:
            assert -90 <= lat <= 90 and -180 <= lon <= 180, p["id"]
        for link in p.get("links") or []:
            assert link["url"].startswith(("http://", "https://")), p["id"]
    store = ROOT / "data" / "locations" / "locations.json"
    if store.exists():
        data = _json(store)
        if "countries" in data:   # schema v2, single layout
            kept = [x for x in data["places"] if x.get("status") != "dropped"]
            assert doc["count"] == len(kept)
