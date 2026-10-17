"""Views: list-page contract, globe contract, WISHLIST.md, determinism, public allow-list."""
import json
import re
import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "tools"))
import location_views as V  # noqa: E402
import locations as D  # noqa: E402
import migrate_locations_v2 as M  # noqa: E402

FIXTURE = HERE / "fixtures" / "locations-v1.json"

PLACE_KEYS = ["id", "name", "kind", "status", "kid_fit", "season", "country", "country_name", "country_a3", "region",
              "region_name", "region_iso", "area", "area_name", "lat", "lon", "elevation_m", "wikidata", "image",
              "tags", "stats", "stats_verified", "note", "links", "trip", "trip_url", "location_status",
              "collections", "added"]
GLOBE_KEYS = ["id", "name", "kind", "status", "country", "country_a3", "region_name", "area_name", "lat", "lon",
              "note", "links", "wikidata", "trip", "trip_url", "location_status"]


@pytest.fixture
def paths(tmp_path):
    return V.Paths(tmp_path)


@pytest.fixture
def data():
    return M.migrate(json.loads(FIXTURE.read_text(encoding="utf-8")))


def _first(data, pid=None):
    return next(p for p in data["places"] if pid is None or p["id"] == pid)


def test_view_contract_keys_exactly(data, paths):
    v = V.view(data, paths)
    assert list(v) == ["schema", "updated", "countries", "tags", "places", "collections"]
    assert v["schema"] == "locations-view/1" and v["updated"] == data["updated"]
    assert all(list(p) == PLACE_KEYS for p in v["places"])
    assert all(list(c) == ["id", "name", "country", "notes", "stops", "links"] for c in v["collections"])
    assert v["countries"]["CA"] == "Canada"
    lake = next(p for p in v["places"] if p["id"].endswith("/lake-louise"))
    assert lake["season"] == ["Jun", "Jul", "Aug", "Sep"] and lake["country_a3"] == "CAN"
    assert lake["region_iso"] == "CA-AB" and lake["area"] == "banff-national-park"
    assert set(v["tags"]) == {t for p in v["places"] for t in p["tags"]}
    assert v["tags"]["fall-colours"] == "Fall colours"


def test_note_is_first_line_only_and_capped(data, paths):
    p = _first(data)
    p["notes"] = "\n  First line here  \nSecond line, private\n" 
    row = next(r for r in V.view(data, paths)["places"] if r["id"] == p["id"])
    assert row["note"] == "First line here"
    p["notes"] = "x" * 400
    row = next(r for r in V.view(data, paths)["places"] if r["id"] == p["id"])
    assert len(row["note"]) == 280 and row["note"].endswith("…")


def test_links_are_http_only(data, paths):
    pid = _first(data)["id"]
    for i, url in enumerate(["javascript:alert(1)", "ftp://x/y", "https://ok.example/a", "http://ok.example/b", None], 1):
        data["sources"].append({"id": f"src-9{i:04d}", "place_id": pid, "collection_id": None, "type": "article",
                                "url": url, "note": None, "screenshot": None, "post_date": None, "saved": "2026-10-16"})
    row = next(r for r in V.view(data, paths)["places"] if r["id"] == pid)
    assert [l["url"] for l in row["links"]] == ["https://ok.example/a", "http://ok.example/b"]
    assert all(set(l) == {"type", "url"} for l in row["links"])


def test_trip_url_only_when_index_exists(data, paths):
    pid = "CA/AB/banff-national-park/lake-louise"
    p = next(x for x in data["places"] if x["id"] == pid)
    p["trip"] = "canadian-rockies-sept-2029"
    assert next(r for r in V.view(data, paths)["places"] if r["id"] == pid)["trip_url"] is None
    (paths.root / "canadian-rockies-sept-2029").mkdir()
    assert next(r for r in V.view(data, paths)["places"] if r["id"] == pid)["trip_url"] is None
    (paths.root / "canadian-rockies-sept-2029" / "index.html").write_text("x")
    row = next(r for r in V.view(data, paths)["places"] if r["id"] == pid)
    assert row["trip_url"] == "../canadian-rockies-sept-2029/" and row["trip"] == "canadian-rockies-sept-2029"


def test_collections_carry_ordered_stops_and_membership(data, paths):
    v = V.view(data, paths)
    c = next(c for c in v["collections"] if c["id"] == "quebec-gaspesie-road-trip")
    assert c["stops"][3].endswith("/chute-du-grand-sault")
    row = next(r for r in v["places"] if r["id"] == c["stops"][0])
    assert "quebec-gaspesie-road-trip" in row["collections"]


def test_globe_contract_drops_dropped_and_keeps_places_without_coordinates(data, paths):
    data["places"][2]["status"] = "dropped"
    dropped = data["places"][2]["id"]
    g = V.globe_places(data, paths)
    assert list(g) == ["schema", "updated", "count", "places"] and g["schema"] == "globe-places/1"
    assert g["count"] == len(g["places"]) == 62
    assert dropped not in {p["id"] for p in g["places"]}
    assert all(list(p) == GLOBE_KEYS for p in g["places"])
    nocoord = [p for p in g["places"] if p["lat"] is None]
    assert [p["id"].rsplit("/", 1)[1] for p in nocoord] == ["chute-du-grand-sault"] and nocoord[0]["lon"] is None
    ids_view = {r["id"] for r in V.view(data, paths)["places"] if r["status"] != "dropped"}
    assert ids_view == {p["id"] for p in g["places"]}


def _template(paths, body="<style>/*__SITE_CSS__*/</style>built __BUILT__ <script id=\"d\" type=\"application/json\">__SITE_DATA__</script> locations-view/1"):
    paths.template.parent.mkdir(parents=True)
    paths.template.write_text(body, encoding="utf-8")
    paths.css.write_text("body{margin:0}", encoding="utf-8")


def test_list_page_skipped_when_template_missing_or_old(data, paths):
    assert V.list_page_html(data, paths) is None
    _template(paths, "<html>__SITE_DATA__</html>")      # draft that does not read the contract
    assert V.list_page_html(data, paths) is None
    assert paths.list_page not in V.render_all(data, paths)


def test_list_page_fills_placeholders_and_uses_the_store_date(data, paths):
    _template(paths)
    html = V.list_page_html(data, paths)
    assert "__" not in html and "body{margin:0}" in html and f"built {data['updated']}" in html
    blob = re.search(r'type="application/json">(.*?)</script>', html, re.S).group(1)
    assert json.loads(blob) == V.view(data, paths)


def test_script_end_tag_in_data_is_escaped(data, paths):
    _template(paths)
    data["places"][0]["notes"] = "</script><script>alert(1)</script>"
    html = V.list_page_html(data, paths)
    assert html.count("</script>") == 1
    blob = re.search(r'type="application/json">(.*?)</script>', html, re.S).group(1)
    assert "<\\/script>" in blob and json.loads(blob)["places"][0]["note"] == "</script><script>alert(1)</script>"


def test_outputs_never_mention_inbox_or_screenshots(data, paths):
    _template(paths)
    pid = _first(data)["id"]
    for c in data["collections"]:      # the fixture's own collection prose says "screenshot"; the test is about paths and fields
        c["notes"] = c["notes"].replace("screenshot", "post")
    data["sources"].append({"id": "src-99999", "place_id": pid, "collection_id": None, "type": "instagram",
                            "url": "https://i.example/p", "note": "private source note", "screenshot": "locations/inbox/2026-secret.jpg",
                            "post_date": None, "saved": "2026-10-16"})
    public = {p: b for p, b in V.render_all(data, paths).items() if p != paths.wishlist}   # WISHLIST.md is not published
    assert len(public) == 2
    for path, blob in public.items():
        text = blob.decode("utf-8")
        assert "inbox/" not in text and "screenshot" not in text and "private source note" not in text, path
        assert "javascript:" not in text
        assert '"resolver"' not in text


def test_render_is_deterministic_and_free_of_the_clock(data, paths):
    _template(paths)
    a = V.render_all(data, paths)
    b = V.render_all(json.loads(json.dumps(data)), paths)
    assert a == b
    assert set(a) == {paths.wishlist, paths.globe_places, paths.list_page}
    V.write_all(data, paths)
    assert V.stale(data, paths) == []
    assert V.write_all(data, paths) == []          # nothing changed, nothing rewritten
    mtimes = {p: p.stat().st_mtime_ns for p in a}
    V.write_all(data, paths)
    assert mtimes == {p: p.stat().st_mtime_ns for p in a}
    data["updated"] = "2030-01-01"
    assert len(V.stale(data, paths)) == 3          # the store's date is the only stamp


def test_globe_file_is_valid_json_one_place_per_line(data, paths):
    out = V.render_all(data, paths)[paths.globe_places].decode()
    parsed = json.loads(out)
    assert parsed["count"] == 63 and len(out.splitlines()) == 63 + 2
    empty = json.loads(V._globe_json({"schema": "globe-places/1", "updated": "x", "count": 0, "places": []}))
    assert empty["places"] == []


def test_wishlist_headings_and_counts(data, paths):
    text = V.wishlist_md(data, paths)
    assert text.startswith("# Wishlist") and "63 places in 6 countries, 4 collections." in text
    assert "## Canada" in text and "### Alberta" in text and "#### Banff National Park" in text
    assert text.count("<sub>") == 63
    assert "#location-unconfirmed" not in text


def test_default_paths_follow_locations_root(monkeypatch, tmp_path):
    monkeypatch.setenv("LOCATIONS_ROOT", str(tmp_path))
    assert V.default_paths().store == tmp_path / "locations" / "locations.json"
