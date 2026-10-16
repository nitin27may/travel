"""Offline tests for _system/tools/locations.py. Run: python3 -m pytest _system/tests -q
(or python3 _system/tests/test_locations.py when pytest is not installed)."""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "tools"))
import locations as D  # noqa: E402


def _place(**kw):
    base = dict(name="Lake Louise", country="CA", region="AB", area="Banff National Park",
                kind="lake", lat=51.41167, lon=-116.22806, status="idea", tags=["lake"])
    base.update(kw)
    spec = {k: base[k] for k in ("name", "country", "region", "area", "kind", "tags", "status")}
    p = D.build_place(spec, offline=True)
    p["lat"], p["lon"] = base["lat"], base["lon"]
    return p


def test_slugify_strips_accents_and_punctuation():
    assert D.slugify("L'Éperon, Parc national") == "l-eperon-parc-national"
    assert D.slugify("Mont-Sainte-Anne") == "mont-sainte-anne"


def test_make_id_has_four_levels_with_upper_codes():
    pid = D.make_id("ca", "ab", "Banff National Park", "Lake Louise")
    assert pid == "CA/AB/banff-national-park/lake-louise"
    assert pid.count("/") == 3


def test_kind_from_p31_prefers_first_match():
    assert D.kind_from_p31(["Q23397"]) == "lake"
    assert D.kind_from_p31(["Q46169"]) == "park"
    assert D.kind_from_p31(["Q99999999"]) == "place"


def test_haversine_lake_louise_to_banff_about_55km():
    km = D.haversine_km(51.41167, -116.22806, 51.1784, -115.5708)
    assert 50 < km < 60


def test_duplicate_by_distance_and_by_name():
    data = {"places": [_place()], "collections": []}
    near = _place(name="Lake Louise Lakeshore", lat=51.4120, lon=-116.2285)
    assert D.find_duplicate(data, near["id"], near["name"], near["lat"], near["lon"], "AB") is not None
    same_name = _place(name="lake louise", lat=0.0, lon=0.0)
    assert D.find_duplicate(data, "X/Y/z/w", same_name["name"], None, None, "AB") is not None
    far = _place(name="Moraine Lake", lat=51.3217, lon=-116.1860)
    assert D.find_duplicate(data, far["id"], far["name"], far["lat"], far["lon"], "AB") is None


def test_validate_catches_missing_coordinates_and_bad_status():
    p = _place()
    p["lat"] = p["lon"] = None
    p["status"] = "maybe"
    errs = D.validate({"places": [p], "collections": [{"slug": "c", "name": "C", "places": ["nope"]}]})
    joined = "\n".join(errs)
    assert "no coordinates" in joined
    assert "status" in joined
    assert "unknown place nope" in joined


def test_render_groups_country_region_area(tmp_path, monkeypatch=None):
    data = {"version": 1, "updated": "2026-10-16", "countries": {"CA": "Canada"},
            "places": [_place(), _place(name="Moraine Lake", lat=51.3217, lon=-116.1860)],
            "collections": [{"slug": "two-lakes", "name": "Two lakes", "places": [], "notes": "n"}]}
    data["collections"][0]["places"] = [p["id"] for p in data["places"]]
    D.WISHLIST = tmp_path / "WISHLIST.md"
    text = D.render(data)
    assert "## Canada" in text and "### AB" in text and "#### Banff National Park" in text
    assert text.index("**Lake Louise**") < text.index("**Moraine Lake**")
    assert "## Collections" in text and "1. Lake Louise" in text
    assert (tmp_path / "WISHLIST.md").exists()


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


def test_build_place_offline_uses_hints():
    p = D.build_place({"name": "Mont du Dôme", "country": "CA", "region": "QC", "area": "Charlevoix",
                       "stats": {"km": 9.5}, "source": "https://instagram.com/p/x", "tags": ["fall"]}, offline=True)
    assert p["id"] == "CA/QC/charlevoix/mont-du-dome"
    assert p["lat"] is None and p["resolver"] == "none" and p["verified"] is False
    assert p["sources"][0]["type"] == "note" and p["sources"][0]["saved"]
    assert json.dumps(p)  # serialisable


if __name__ == "__main__":
    import inspect
    import tempfile
    fails = 0
    for name, fn in list(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                kw = {}
                if "tmp_path" in inspect.signature(fn).parameters:
                    kw["tmp_path"] = Path(tempfile.mkdtemp())
                fn(**kw)
                print("ok  ", name)
            except Exception as ex:  # noqa: BLE001
                fails += 1
                print("FAIL", name, ex)
    sys.exit(1 if fails else 0)
