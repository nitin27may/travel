"""tools/towns.py (META-2): the towns files are GeoNames' own rows, filtered mechanically, and nothing else.

Two kinds of test: a tiny made-up dump that pins the rules of the filter and the ids (needs no download), and the committed
data/reference/towns files, checked against their manifest and, when the GeoNames download is cached on this machine, against the dump.
"""
import gzip
import json
import re
import subprocess
import sys
import zipfile
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
import towns as T  # noqa: E402

OUT = ROOT / "data" / "reference" / "towns"
TOWN_ID_RE = re.compile(r"^[a-z]{2}-[a-z0-9]+-[a-z0-9-]+$")  # core/src/schema/capture/points.ts TOWN_ID_RE


def city(gid, name, lat, lon, pop, cc="CA", admin1="08", code="PPL", cls="P", ascii_name=None):
    """One cities1000.txt line, as the dump has it (19 tab-separated columns)."""
    f = [str(gid), name, ascii_name or name, "", str(lat), str(lon), cls, code, cc, "", admin1, "", "", "", str(pop), "", "", "UTC", "2026-01-01"]
    return f


NAMES = {"CA.08": "Ontario", "CA.01": "Alberta", "XX.07": "Seven", "US.NY": "New York"}
ANCHORS = [[43.9, -78.9]]


@pytest.fixture
def iso_table(monkeypatch):
    table = {"CA": {"08": ["on", "Ontario"], "01": ["ab", "Alberta"]}, "US": "identity"}
    monkeypatch.setattr(T, "load_iso_table", lambda: table)
    return table


def test_filter_keeps_populated_places_of_a_thousand_near_an_anchor_and_big_cities_in_the_same_country(iso_table):
    rows = [
        city(1, "Near Town", 43.95, -78.9, 5000),
        city(2, "Too Small", 43.95, -78.9, 999),
        city(3, "A Section", 43.95, -78.9, 5000, code="PPLX"),
        city(4, "Not A Place", 43.95, -78.9, 5000, cls="S"),
        city(5, "Far Small", 51.0, -115.0, 5000, admin1="01"),
        city(6, "Far Big", 51.0, -115.0, 150000, admin1="01"),
        city(7, "Far Big Elsewhere", 10.0, 10.0, 150000, cc="XX", admin1="07"),
        city(8, "Historical", 43.95, -78.9, 5000, code="PPLH"),
    ]
    kept = {r[0] for r in T.select(rows, ANCHORS)}
    assert kept == {"1", "6"}  # near an anchor; a big city of a country that holds a near town. Nothing else.


def test_the_filter_never_looks_at_a_name(iso_table):
    a = [city(1, "Alpha", 43.95, -78.9, 5000), city(2, "Beta", 43.95, -78.9, 5000)]
    b = [city(1, "Zed", 43.95, -78.9, 5000), city(2, "Yan", 43.95, -78.9, 5000)]
    assert [r[0] for r in T.select(a, ANCHORS)] == [r[0] for r in T.select(b, ANCHORS)]


def test_ids_are_cc_admin1_slug_with_the_iso_suffix_and_duplicates_take_the_geonames_id(iso_table):
    rows = [city(30, "Springfield", 43.9, -78.9, 5000), city(20, "Springfield", 43.91, -78.9, 6000), city(10, "Saint-Étienne", 43.92, -78.9, 6000, ascii_name="Saint-Etienne")]
    groups = T.build_rows(rows, NAMES, iso_table)
    ids = [r[0] for r in groups[("ca", "on")]["rows"]]
    assert ids == sorted(ids)
    assert set(ids) == {"ca-on-springfield", "ca-on-springfield-30", "ca-on-saint-etienne"}
    assert all(TOWN_ID_RE.match(i) for i in ids)
    assert [r for r in groups[("ca", "on")]["rows"] if r[0] == "ca-on-springfield"][0][7] == 20  # the lower GeoNames id keeps the plain slug


def test_a_row_is_the_dump_row_verbatim(iso_table):
    groups = T.build_rows([city(5882873, "Ajáx", 43.85012, -79.03288, 119677, ascii_name="Ajax")], NAMES, iso_table)
    assert groups[("ca", "on")]["rows"] == [["ca-on-ajax", "Ajáx", 43.85012, -79.03288, 119677, "on", "Ajax", 5882873]]


def test_country_without_a_table_uses_00_and_a_wrong_table_fails(iso_table):
    assert T.admin1_iso("XX", "07", NAMES, iso_table) == ("00", "Seven")
    assert T.admin1_iso("US", "NY", NAMES, iso_table) == ("ny", "New York")
    with pytest.raises(SystemExit, match="GeoNames calls it"):
        T.admin1_iso("CA", "08", {"CA.08": "Quebec"}, iso_table)
    with pytest.raises(SystemExit, match="no entry"):
        T.admin1_iso("CA", "99", {"CA.99": "Nowhere"}, iso_table)


def test_a_country_over_the_budget_splits_by_admin1_and_one_admin1_over_it_fails(iso_table, monkeypatch):
    big = [city(i, f"Town {i:05d}", 43.9, -78.9, 5000 + i, admin1="08" if i % 2 else "01") for i in range(1, 3000)]
    groups = T.build_rows(big, NAMES, iso_table)
    monkeypatch.setattr(T, "GZIP_BUDGET", 20_000)
    parts = T.make_parts(groups)
    assert set(parts) == {"ca-on.json", "ca-ab.json"} or set(parts) == {"ca.json"}
    monkeypatch.setattr(T, "GZIP_BUDGET", 200)
    with pytest.raises(SystemExit, match="over the"):
        T.make_parts(groups)


# ---- the committed files ---------------------------------------------------------------------------------------------------------
def manifest():
    return json.loads((OUT / "manifest.json").read_text())


def all_rows():
    for p in manifest()["parts"]:
        yield p, json.loads((OUT / p["file"]).read_text())


def test_the_manifest_records_source_download_date_licence_and_hashes():
    m = manifest()
    assert m["source"]["licence"]["id"] == "CC BY 4.0"
    assert m["source"]["licence"]["attribution"] == "Contains data from GeoNames, CC BY 4.0"
    assert re.fullmatch(r"\d{4}-\d\d-\d\d", m["source"]["downloaded"])
    for name in ("cities1000.zip", "admin1CodesASCII.txt"):
        f = m["source"]["files"][name]
        assert f["url"].startswith("https://download.geonames.org/export/dump/")
        assert re.fullmatch(r"[0-9a-f]{64}", f["sha256"])
    assert m["filter"]["population_min"] == 1000


def test_every_part_matches_the_manifest_and_fits_the_budget():
    assert T.verify_against_manifest() == []
    for p in manifest()["parts"]:
        b = (OUT / p["file"]).read_bytes()
        assert len(gzip.compress(b, 9, mtime=0)) <= 20_000, p["file"]


def test_ids_are_unique_across_every_part_and_well_formed():
    seen = set()
    for _p, doc in all_rows():
        for r in doc["rows"]:
            assert TOWN_ID_RE.match(r[0]), r[0]
            assert r[0] not in seen, r[0]
            seen.add(r[0])
            assert r[0].startswith(f"{doc['cc']}-{r[5]}-")
            assert len(r) == 8 and r[4] >= 1000
    assert len(seen) == manifest()["totals"]["rows"]


def test_every_town_has_a_country_part():
    files = {p["file"] for p in manifest()["parts"]}
    for _p, doc in all_rows():
        cc = doc["cc"]
        for r in doc["rows"]:
            assert r[0][:2] == cc
        assert f"{cc}.json" in files or any(f.startswith(f"{cc}-") for f in files)


def test_the_five_named_towns_resolve_by_id():
    ids = {r[0]: r for _p, doc in all_rows() for r in doc["rows"]}
    for tid in ("ca-on-whitby", "ca-on-oshawa", "ca-on-ajax", "ca-ab-canmore", "it-34-cortina-d-ampezzo"):
        assert tid in ids, tid


def test_the_script_names_no_town():
    src = (ROOT / "tools" / "towns.py").read_text() + (ROOT / "tools" / "towns_admin1.json").read_text()
    for _p, doc in all_rows():
        for r in doc["rows"]:
            assert r[0] not in src


def test_deterministic_two_derivations_are_identical():
    cache = T.cached_meta()
    if cache is None:
        pytest.skip("the GeoNames download is not cached on this machine")
    anchors = json.loads((OUT / "anchors.json").read_text())
    assert T.expected(cache, anchors) == T.expected(cache, anchors)


def test_every_row_is_in_the_downloaded_dump_unchanged():
    if T.cached_meta() is None:
        pytest.skip("the GeoNames download is not cached on this machine")
    with zipfile.ZipFile(T.CACHE / "cities1000.zip") as z:
        dump = {}
        for line in z.read("cities1000.txt").decode("utf-8").split("\n"):
            if line:
                f = line.split("\t")
                dump[int(f[0])] = f
    for _p, doc in all_rows():
        for r in doc["rows"]:
            f = dump[r[7]]
            assert (r[1], r[6], r[2], r[3], r[4]) == (f[1], f[2], float(f[4]), float(f[5]), int(f[14])), r[0]
            assert f[8].lower() == doc["cc"]


def test_check_passes_without_the_network():
    r = subprocess.run([sys.executable, str(ROOT / "tools" / "towns.py"), "--check"], capture_output=True, text=True, timeout=300)
    assert r.returncode == 0, r.stdout + r.stderr


def test_check_fails_when_a_point_is_edited(tmp_path, monkeypatch):
    target = next(f for f in OUT.glob("*.json") if f.name not in ("manifest.json", "anchors.json"))
    monkeypatch.setattr(T, "OUT", tmp_path)
    for f in OUT.glob("*.json"):
        (tmp_path / f.name).write_bytes(f.read_bytes())
    assert T.verify_against_manifest() == []
    doc = (tmp_path / target.name).read_text()
    (tmp_path / target.name).write_text(re.sub(r"(\d+\.\d+)", lambda m: str(float(m.group(1)) + 0.01), doc, count=1))
    problems = T.verify_against_manifest()
    assert any(target.name in p and "differs from the manifest" in p for p in problems)


def test_anchors_are_rounded_public_points_and_cover_every_public_point():
    anchors = json.loads((OUT / "anchors.json").read_text())
    assert anchors == sorted(anchors)
    grid = T.Grid(anchors)
    for path, key in T.ANCHOR_SOURCES:
        for la, lo in T.points_from(path, key):
            assert grid.within(la, lo, 5), f"{path}: a public point is not within 5 km of an anchor; rerun: python3 tools/towns.py build"
