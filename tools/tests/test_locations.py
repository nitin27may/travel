"""Offline tests for tools/locations.py (schema v2). Run: python3 -m pytest tools/tests -q
Every test points the tool at a tmp root with monkeypatch.setattr(D, "PATHS", D.Paths(tmp_path))."""
import copy
import json
import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import locations as D  # noqa: E402
import location_views as V  # noqa: E402


@pytest.fixture
def root(tmp_path, monkeypatch):
    monkeypatch.setattr(D, "PATHS", D.Paths(tmp_path))
    (tmp_path / "legacy" / "trip-one").mkdir(parents=True)
    (tmp_path / "legacy" / "trip-one" / "index.html").write_text("<html></html>")
    return tmp_path


def run(*argv) -> int:
    return D.main(list(argv))


def seed(root):
    """A small valid store built through the CLI: two Alberta places, one Quebec place, one collection."""
    assert run("add", "Lake Louise", "--country", "CA", "--region", "AB", "--area", "Banff National Park",
               "--kind", "lake", "--tags", "Lakes,family,iconic", "--season", "Jun,Jul", "--lat", "51.41167",
               "--lon", "-116.22806", "--offline") == 0
    assert run("add", "Moraine Lake", "--country", "CA", "--region", "AB", "--area", "Banff National Park",
               "--kind", "lake", "--lat", "51.3217", "--lon", "-116.186", "--offline") == 0
    assert run("add", "Le Buton", "--country", "CA", "--region", "QC", "--area", "Charlevoix", "--kind", "viewpoint",
               "--lat", "47.28", "--lon", "-70.61", "--offline", "--source", "https://example.com/x",
               "--source-type", "official") == 0
    assert run("collection", "add", "--slug", "loop", "--name", "Loop", "--places",
               "Lake Louise,Le Buton") == 0
    return D.load()


def test_slugify_strips_accents_and_punctuation():
    assert D.slugify("L'Éperon, Parc national") == "l-eperon-parc-national"
    assert D.slugify("Mont-Sainte-Anne") == "mont-sainte-anne"


def test_make_id_has_four_levels_with_upper_codes():
    pid = D.make_id("ca", "ab", "Banff National Park", "Lake Louise")
    assert pid == "CA/AB/banff-national-park/lake-louise"
    assert D.PLACE_ID_RE.match(pid)


def test_kind_from_p31_prefers_first_match():
    assert D.kind_from_p31(["Q23397"]) == "lake"
    assert D.kind_from_p31(["Q46169"]) == "park"
    assert D.kind_from_p31(["Q99999999"]) == "place"


def test_haversine_lake_louise_to_banff_about_55km():
    assert 50 < D.haversine_km(51.41167, -116.22806, 51.1784, -115.5708) < 60


def test_country_qid_map_covers_the_countries_in_the_store():
    for q, cc in {"Q16": "CA", "Q30": "US", "Q38": "IT", "Q142": "FR", "Q881": "VN", "Q668": "IN"}.items():
        assert D.COUNTRY_QID[q] == cc


def test_wikidata_scoring_rejects_wrong_country(monkeypatch):
    """'Page' must resolve to Arizona, not the Australian suburb, when --country US is given."""
    cands = [{"id": "Q_AU", "label": "Page", "description": "suburb of Canberra"},
             {"id": "Q_US", "label": "Page", "description": "city in Coconino County, Arizona"}]
    ents = {"Q_AU": {"id": "Q_AU", "claims": {"P17": [{"mainsnak": {"datavalue": {"value": {"id": "Q408"}}}}],
                                               "P625": [{"mainsnak": {"datavalue": {"value": {"latitude": -35.2, "longitude": 149.0}}}}],
                                               "P31": [{"mainsnak": {"datavalue": {"value": {"id": "Q532"}}}}]}},
            "Q_US": {"id": "Q_US", "claims": {"P17": [{"mainsnak": {"datavalue": {"value": {"id": "Q30"}}}}],
                                               "P625": [{"mainsnak": {"datavalue": {"value": {"latitude": 36.9, "longitude": -111.4}}}}],
                                               "P31": [{"mainsnak": {"datavalue": {"value": {"id": "Q515"}}}}],
                                               "P131": []}}}
    monkeypatch.setattr(D, "wd_search", lambda name, limit=7: cands)
    monkeypatch.setattr(D, "wd_entities", lambda ids: {i: ents[i] for i in ids if i in ents})
    monkeypatch.setattr(D, "walk_admin_chain", lambda ids, max_hops=6: ([], None, None))
    monkeypatch.setattr(D, "reverse_area", lambda lat, lon: "Coconino County")
    res = D.resolve_wikidata("Page", "US", "Arizona", None, kind_hint="town")
    assert res["wikidata"] == "Q_US" and res["lat"] == 36.9 and res["area_name"] == "Coconino County"


# ----------------------------------------------------------------------------- build_place, tags, add
def test_build_place_offline_uses_hints():
    b = D.build_place({"name": "Mont du Dôme", "country": "CA", "region": "QC", "area": "Charlevoix",
                       "stats": {"km": 9.5}, "source": "https://instagram.com/p/x", "tags": ["fall"],
                       "season": ["Sep", "Oct"]}, offline=True)
    p = b["place"]
    assert p["id"] == "CA/QC/charlevoix/mont-du-dome" and p["area_id"] == "CA/QC/charlevoix"
    assert p["lat"] is None and p["resolver"] == "none" and p["stats_verified"] is False
    assert p["season_months"] == [9, 10] and p["location_status"] == "resolved"
    assert b["region"]["id"] == "CA/QC" and b["region"]["code"] == "QC"
    assert b["sources"][0]["saved"] and b["sources"][0]["url"] == "https://instagram.com/p/x"
    assert json.dumps(b)


def test_build_place_lat_lon_is_manual_and_needs_both():
    b = D.build_place({"name": "X", "country": "CA", "region": "QC", "area": "A", "lat": 1.5, "lon": 2.5}, offline=False)
    assert b["place"]["resolver"] == "manual" and b["place"]["lat"] == 1.5
    with pytest.raises(D.Fail):
        D.build_place({"name": "X", "country": "CA", "region": "QC", "lat": 1.5}, offline=True)


def test_tag_normalisation_alias_plural_kind_and_unconfirmed(root):
    data = D.empty_store()
    got = D.normalize_tags(data, ["Waterfalls", "waterfall", "Fall Colours", "lake", "location-unconfirmed", " "], "lake")
    assert got == ["fall-colours", "waterfall"]
    assert {"id": "fall-colours", "label": "Fall colours", "alias_of": None} in data["tags"]


def test_skill_example_command_parses_offline(root):
    rc = run("add", "Mont du Dôme", "--country", "CA", "--region", "QC", "--area", "Zec des Martres",
             "--kind", "trail", "--tags", "fall-colours,family", "--season", "Sep,Oct", "--kid", "strong-kid",
             "--stats", '{"km": 9.5, "gain_m": 543, "hours": "3.5-4"}', "--note", "3-summit loop; Saint-Michel quietest",
             "--source", "https://www.instagram.com/p/abc", "--source-type", "instagram", "--offline")
    assert rc == 0
    data = D.load()
    p = data["places"][0]
    assert p["id"] == "CA/QC/zec-des-martres/mont-du-dome" and p["season_months"] == [9, 10]
    assert data["sources"][0]["url"].startswith("https://www.instagram.com")
    assert (root / "data" / "locations" / "WISHLIST.md").exists()


def test_add_with_lat_lon_sets_manual_and_creates_geography(root):
    data = seed(root)
    p = next(x for x in data["places"] if x["name"] == "Lake Louise")
    assert p["resolver"] == "manual"
    assert [r["id"] for r in data["regions"]] == ["CA/AB", "CA/QC"]
    assert next(r for r in data["regions"] if r["id"] == "CA/AB")["iso_3166_2"] == "CA-AB"
    assert D.validate(data, D.PATHS) == []


def test_add_duplicate_exits_1_and_force_suffixes_id(root):
    seed(root)
    args = ["add", "Lake Louise", "--country", "CA", "--region", "AB", "--area", "Banff National Park",
            "--lat", "0.5", "--lon", "0.5", "--offline"]
    assert run(*args) == 1
    assert run(*args, "--force") == 0
    ids = [p["id"] for p in D.load()["places"]]
    assert "CA/AB/banff-national-park/lake-louise-2" in ids


def test_duplicate_by_distance_and_by_name(root):
    data = seed(root)
    assert D.find_duplicate(data, "X/Y/z/w", "lake louise", None, None, "CA/AB") is not None
    assert D.find_duplicate(data, "X/Y/z/w", "Other", 51.4120, -116.2285, "CA/AB") is not None
    assert D.find_duplicate(data, "X/Y/z/w", "Far away", 10.0, 10.0, "CA/AB") is None


def test_add_with_screenshot_and_note_makes_source_with_post_date(root):
    assert run("add", "Foo", "--country", "CA", "--region", "QC", "--area", "A", "--offline",
               "--screenshot", "research/inbox/2026-10-16-foo.jpg", "--source-note", "saved post, 15 Oct 2026",
               "--unconfirmed") == 0
    s = D.load()["sources"][0]
    assert s["screenshot"] == "research/inbox/2026-10-16-foo.jpg" and s["post_date"] == "2026-10-15" and s["url"] is None


def test_import_batch_with_collection_by_name(root, tmp_path):
    batch = {"places": [{"name": "A One", "country": "CA", "region": "QC", "area": "X", "lat": 1, "lon": 1,
                         "sources": [{"type": "instagram", "note": "post 3 Sep 2026", "screenshot": "research/inbox/a.jpg"}],
                         "season": ["Sep"]},
                        {"name": "B Two", "country": "CA", "region": "QC", "area": "X", "lat": 2, "lon": 2, "unconfirmed": True}],
             "collections": [{"slug": "ab", "name": "AB", "places": ["A One", "B Two"], "notes": "n",
                              "sources": [{"type": "instagram", "url": None}]}]}
    f = tmp_path / "batch.json"
    f.write_text(json.dumps(batch))
    assert run("import", str(f), "--offline") == 0
    data = D.load()
    assert [r["position"] for r in data["collection_places"]] == [1, 2]
    assert {s["id"] for s in data["sources"]} == {"src-00001", "src-00002"}
    assert next(s for s in data["sources"] if s["collection_id"])["saved"] == D.today()
    assert D.validate(data, D.PATHS) == []


# ----------------------------------------------------------------------------- edit, visit, tag
def test_edit_merges_stats_notes_sources_and_tags(root):
    data = seed(root)
    pid = "CA/AB/banff-national-park/lake-louise"
    assert run("edit", pid, "--stats", '{"km": 2}', "--note", "first", "--note-append", "second",
               "--source", "https://example.com/y", "--source-type", "article", "--tags-add", "views,Lakes",
               "--tags-remove", "family") == 0
    assert run("edit", "lake-louise", "--stats", '{"minutes": 30}', "--status", "shortlisted") == 0
    data = D.load()
    p = next(x for x in data["places"] if x["id"] == pid)
    assert p["stats"] == {"km": 2, "minutes": 30}
    assert p["notes"] == "first\nsecond" and p["status"] == "shortlisted"
    tags = sorted(r["tag_id"] for r in data["place_tags"] if r["place_id"] == pid)
    assert tags == ["iconic", "views"]
    assert [s["url"] for s in data["sources"] if s["place_id"] == pid] == ["https://example.com/y"]
    assert D.validate(data, D.PATHS) == []


def test_edit_trip_area_coordinates_and_status_visited_guard(root):
    seed(root)
    pid = "CA/AB/banff-national-park/moraine-lake"
    assert run("edit", pid, "--trip", "trip-one", "--status", "planned", "--area", "Valley of Ten Peaks",
               "--lat", "51.32", "--lon", "-116.18") == 0
    p = next(x for x in D.load()["places"] if x["id"] == pid)
    assert p["trip"] == "trip-one" and p["area_id"] == "CA/AB/valley-of-ten-peaks" and p["id"] == pid
    assert D.validate(D.load(), D.PATHS) == []
    assert run("edit", pid, "--status", "visited") == 1
    assert run("edit", pid, "--no-trip") == 0
    assert run("edit", "nope") == 1
    assert run("edit", pid) == 1


def test_visit_add_sets_status_and_validates(root):
    seed(root)
    pid = "CA/QC/charlevoix/le-buton"
    assert run("visit", "add", pid, "--date", "2026-10-02", "--end", "2026-10-03", "--trip", "trip-one") == 0
    data = D.load()
    assert data["visits"][0]["id"] == "vis-00001"
    assert next(p for p in data["places"] if p["id"] == pid)["status"] == "visited"
    assert D.validate(data, D.PATHS) == []
    assert run("visit", "add", pid, "--date", "2026-13") == 1
    assert run("visit", "add", pid, "--date", "2026-10-05", "--end", "2026-10-01") == 1


def test_tag_alias_repoints_place_tags(root):
    seed(root)
    assert run("edit", "le-buton", "--tags-add", "scenic,views") == 0
    assert run("tag", "alias", "scenic", "views") == 0
    data = D.load()
    assert [r["tag_id"] for r in data["place_tags"] if r["place_id"].endswith("le-buton")] == ["views"]
    assert next(t for t in data["tags"] if t["id"] == "scenic")["alias_of"] == "views"
    assert D.validate(data, D.PATHS) == []
    assert run("tag", "list") == 0


def test_collection_add_accepts_names_and_replaces(root):
    data = seed(root)
    assert [r["place_id"] for r in data["collection_places"]] == [
        "CA/AB/banff-national-park/lake-louise", "CA/QC/charlevoix/le-buton"]
    assert run("collection", "add", "--slug", "loop", "--name", "Loop 2", "--places", "Le Buton,Le Buton",
               "--source", "https://example.com/c") == 0
    data = D.load()
    assert len(data["collections"]) == 1 and data["collections"][0]["name"] == "Loop 2"
    assert [r["position"] for r in data["collection_places"]] == [1, 2]
    assert [s["collection_id"] for s in data["sources"] if s["collection_id"]] == ["loop"]


# ----------------------------------------------------------------------------- store format, build
def test_store_is_one_row_per_line_and_round_trips(root):
    seed(root)
    text = D.PATHS.store.read_text(encoding="utf-8")
    lines = text.splitlines()
    assert lines[0] == "{" and lines[1] == '"schema_version": 2,'
    place_lines = [l for l in lines if l.startswith('{"id":"CA/') and '"area_id"' in l]
    assert len(place_lines) == 3
    data = D.load()
    assert D.dumps(data) == text
    ids = [p["id"] for p in data["places"]]
    assert ids == sorted(ids)


def test_build_twice_is_identical_and_check_detects_drift(root):
    seed(root)
    assert run("build", "--check") == 0
    before = {p: p.read_bytes() for p in V.render_all(D.load(), D.PATHS)}
    assert run("build") == 0
    assert before == {p: p.read_bytes() for p in before}
    D.PATHS.wishlist.write_text("tampered\n")
    assert run("build", "--check") == 1
    assert run("render") == 0          # render is an alias of build
    assert run("build", "--check") == 0
    D.PATHS.globe_places.unlink()
    assert run("build", "--check") == 1


def test_wishlist_keeps_headings_and_place_lines(root):
    seed(root)
    text = D.PATHS.wishlist.read_text(encoding="utf-8")
    assert "## Canada" in text and "### AB" in text and "#### Banff National Park" in text
    assert text.index("**Lake Louise**") < text.index("**Moraine Lake**")
    assert "## Collections" in text and "1. Lake Louise" in text
    assert "#iconic" in text and "#lake" not in text      # the tag equal to the kind is dropped


def test_list_filters(root, capsys):
    seed(root)
    capsys.readouterr()
    assert run("list", "--country", "CA", "--tag", "lakes") == 0
    out = capsys.readouterr().out
    assert out == ""        # "lakes" is an alias of "lake", which the kind drop removed from both lakes
    assert run("list", "--status", "idea", "--q", "buton") == 0
    assert "le-buton" in capsys.readouterr().out


# ----------------------------------------------------------------------------- validate
@pytest.fixture
def good(root):
    return seed(root)


def errs(data):
    return "\n".join(D.validate(data, D.PATHS))


def test_validate_ok_on_seed(good):
    assert D.validate(good, D.PATHS) == []


def test_validate_v1_store_points_at_migration(root):
    out = D.validate({"version": 1, "places": []}, D.PATHS)
    assert len(out) == 1 and "migrate_locations_v2.py" in out[0]


def test_validate_bad_foreign_key(good):
    good["places"][0]["area_id"] = "CA/ZZ/nowhere"
    assert "area_id" in errs(good)
    good["place_tags"].append({"place_id": "nope", "tag_id": "iconic"})
    assert "place_id is not in places" in errs(good)
    good["collection_places"][0]["place_id"] = "nope"
    assert "unknown place nope" in errs(good)


def test_validate_two_source_owners_or_none(good):
    good["sources"][0]["collection_id"] = "loop"
    assert "exactly one of place_id or collection_id" in errs(good)
    good["sources"][0]["collection_id"] = None
    good["sources"][0]["place_id"] = None
    assert "exactly one of place_id or collection_id" in errs(good)


def test_validate_visited_without_visit(good):
    good["places"][0]["status"] = "visited"
    assert "needs at least one visit" in errs(good)


def test_validate_bad_pdate_and_visit_order(good):
    pid = good["places"][0]["id"]
    good["visits"].append({"id": "vis-00001", "place_id": pid, "date_start": "2026-13", "date_end": None,
                           "trip": None, "notes": ""})
    assert "date_start must be pdate" in errs(good)
    good["visits"][0].update(date_start="2026-10-05", date_end="2026-10-01")
    assert "date_end is before date_start" in errs(good)
    good["visits"][0].update(date_start="2026-10", date_end="2026-10-20")
    assert "date" not in errs(good)


def test_validate_lat_without_lon_and_missing_coordinates(good):
    good["places"][0]["lon"] = None
    assert "lat and lon must both be set" in errs(good)
    p = good["places"][1]
    p["lat"] = p["lon"] = None
    assert "no coordinates" in errs(good)
    p["location_status"] = "unconfirmed"
    assert "no coordinates" not in errs(good)


def test_validate_unknown_column_and_top_level_key(good):
    good["places"][0]["verified"] = False
    good["bogus"] = []
    out = errs(good)
    assert "unknown column 'verified'" in out and "unknown top-level key 'bogus'" in out


def test_validate_alias_pointing_at_alias(good):
    good["tags"].append({"id": "waterfall-x", "label": "x", "alias_of": "waterfalls"})
    assert "is itself an alias" in errs(good)


def test_validate_place_tag_must_be_canonical(good):
    good["place_tags"].append({"place_id": good["places"][0]["id"], "tag_id": "lakes"})
    assert "is an alias" in errs(good)


def test_validate_missing_trip_folder(good):
    good["places"][0]["trip"] = "no-such-trip"
    assert "trip folder 'no-such-trip' does not exist" in errs(good)
    good["places"][0]["trip"] = "trip-one"
    assert "trip folder" not in errs(good)


def test_validate_enums_ids_and_ranges(good):
    p = good["places"][0]
    p.update(kind="spaceport", status="maybe", kid_fit="x", location_status="?", resolver="gps",
             lat=95.0, wikidata="Q", image="http://x", season_months=[10, 9], stats={"a": [1]})
    out = errs(good)
    for needle in ("kind 'spaceport'", "status 'maybe'", "kid_fit", "location_status", "resolver 'gps'",
                   "lat out of range", "wikidata must look like", "image must be an https URL",
                   "distinct sorted ints", "stats values"):
        assert needle in out, needle
    p["id"] = "bad id"
    assert "does not match" in errs(good)


def test_validate_collection_positions_and_dupe_keys(good):
    good["collection_places"][1]["position"] = 5
    assert "contiguous" in errs(good)
    good["places"].append(copy.deepcopy(good["places"][0]))
    assert "duplicate key" in errs(good)


def test_validate_source_url_screenshot_and_type(good):
    s = good["sources"][0]
    s.update(url="javascript:alert(1)", screenshot="/etc/passwd", type="smoke")
    out = errs(good)
    assert "url must be http(s)" in out and "research/inbox/" in out and "type 'smoke'" in out


def test_validate_warns_but_passes_over_300_places(good):
    assert D.warnings(good) == []
    good["places"] = good["places"] * 101
    assert D.warnings(good)


def test_validate_command_exit_codes(root, capsys):
    seed(root)
    assert run("validate") == 0
    data = D.load()
    data["places"][0]["status"] = "maybe"
    D.PATHS.store.write_text(D.dumps(data))
    assert run("validate") == 1
    assert "status 'maybe'" in capsys.readouterr().out
    D.PATHS.store.write_text(json.dumps({"version": 1, "places": []}))
    assert run("validate") == 1
    assert run("add", "X", "--offline") == 1       # writes refuse a v1 store
