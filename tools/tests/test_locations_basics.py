"""DATA-LOC L1 (PLAN R-110, BACKLOG 15.110): `quick-add`, `basics --report`, the `edit` basics flags and field_meta.
Offline: the resolvers are monkeypatched and every test points the tool at a tmp root. Run: python3 -m pytest tools/tests -q"""
import fcntl
import json
import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import locations as D  # noqa: E402

REPO = HERE.parents[1]


@pytest.fixture
def root(tmp_path, monkeypatch):
    monkeypatch.setattr(D, "PATHS", D.Paths(tmp_path))
    monkeypatch.setattr(D, "WD_LOCK", tmp_path / "wd.lock")
    monkeypatch.setattr(D, "NOMINATIM_LOCK", tmp_path / "nominatim.lock")
    (tmp_path / "legacy" / "trip-one").mkdir(parents=True)
    return tmp_path


def run(*argv) -> int:
    return D.main(list(argv))


def resolved(name, cc="CA", region="AB", area="Banff National Park", lat=51.4, lon=-116.2, kind="lake", qid="Q1"):
    return {"name": name, "wikidata": qid, "description": "", "lat": lat, "lon": lon, "kind": kind, "country": cc,
            "country_name": D.COUNTRY_NAMES.get(cc, cc), "region": region, "region_name": "Alberta", "area_name": area,
            "elevation_m": None, "image": None, "resolver": "wikidata"}


def put(root: Path, rel: str, doc) -> None:
    p = root / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(doc), encoding="utf-8")


# ----------------------------------------------------------------------------- core constants
def test_lane_id_and_bases_are_read_from_core_not_copied():
    assert D.tripless_lane() == "catalogue"
    lane_ts = (REPO / "core/src/capture/lane.ts").read_text()
    assert f'export const TRIPLESS_LANE = "{D.tripless_lane()}"' in lane_ts
    assert "our_inference" in D.value_bases() and "official_info" in D.value_bases() and "operator_info" in D.value_bases()
    with pytest.raises(D.Fail):
        D.ts_const("capture/lane.ts", "NO_SUCH_CONSTANT")


# ----------------------------------------------------------------------------- quick-add
def test_parse_quick_line_name_country_kind():
    assert D.parse_quick_line("Lake Louise, CA") == {"name": "Lake Louise", "country": "CA", "kind": None}
    assert D.parse_quick_line("Moraine Lake, Canada, lake") == {"name": "Moraine Lake", "country": "CA", "kind": "lake"}
    assert D.parse_quick_line("Banff, Alberta, ca") == {"name": "Banff, Alberta", "country": "CA", "kind": None}
    for bad in ("Lake Louise", "Lake Louise, Narnia", ", CA", "Lake, CA, lakes"):
        with pytest.raises(D.Fail):
            D.parse_quick_line(bad)


def test_quick_add_writes_resolved_and_prints_ambiguous_unresolved_duplicate(root, monkeypatch, capsys):
    def wd(name, country, region, pick, kind_hint=None, strict=False):
        assert strict, "quick-add resolves strictly"
        if name == "Moss Glen Falls":
            print("AMBIGUOUS: re-run with --pick N", file=sys.stderr)
            raise SystemExit(2)
        if name == "Nowhere Pond":
            return None
        if name == "Lake Louise Again":
            return resolved("Lake Louise", lat=51.41167, lon=-116.22806)
        return resolved(name, lat={"Lake Louise": 51.41167, "Moraine Lake": 51.3217}[name],
                        lon={"Lake Louise": -116.22806, "Moraine Lake": -116.186}[name], kind=kind_hint or "lake")
    monkeypatch.setattr(D, "resolve_wikidata", wd)
    monkeypatch.setattr(D, "resolve_nominatim", lambda *a: None)
    names = root / "names.txt"
    names.write_text("# a saved list\nLake Louise, CA\nMoraine Lake, Canada, lake\n\nMoss Glen Falls, US, waterfall\n"
                     "Nowhere Pond, CA\nLake Louise Again, CA\nBroken line\n", encoding="utf-8")
    assert run("quick-add", str(names), "--source-note", "saved list, 25 Oct 2026") == 2   # an ambiguous name wins the exit code
    out = capsys.readouterr().out
    data = D.load()
    assert sorted(p["name"] for p in data["places"]) == ["Lake Louise", "Moraine Lake"]
    assert "AMBIGUOUS Moss Glen Falls" in out and "--pick N" in out
    assert "NOT FOUND Nowhere Pond" in out
    assert "DUPLICATE Lake Louise Again of CA/AB/banff-national-park/lake-louise" in out
    assert "line 8: not read" in out
    assert "added 2, ambiguous 1, not found 1, duplicate 1, unreadable 1" in out
    assert {s["note"] for s in data["sources"]} == {"saved list, 25 Oct 2026"}
    assert D.validate(data) == []


def test_quick_add_is_strict_two_same_country_candidates_are_ambiguous(root, monkeypatch, capsys):
    """`add` lets a matching country hint settle a tie; quick-add does not (the two Moss Glen Falls of Vermont, live 25 Oct 2026)."""
    def ent(qid, lat):
        claim = lambda v: [{"mainsnak": {"datavalue": {"value": v}}}]  # noqa: E731
        return {"id": qid, "claims": {"P17": claim({"id": "Q30"}), "P31": claim({"id": "Q34038"}),
                                      "P625": claim({"latitude": lat, "longitude": -72.8})}}
    cands = [{"id": "Q_A", "label": "Moss Glen Falls", "description": "waterfall in Vermont"},
             {"id": "Q_B", "label": "Moss Glen Falls", "description": "waterfall in Vermont"}]
    ents = {"Q_A": ent("Q_A", 44.0), "Q_B": ent("Q_B", 44.5)}
    monkeypatch.setattr(D, "wd_search", lambda name, limit=7: cands)
    monkeypatch.setattr(D, "wd_entities", lambda ids: {i: ents[i] for i in ids if i in ents})
    monkeypatch.setattr(D, "walk_admin_chain", lambda ids, max_hops=6: ([], None, None))
    monkeypatch.setattr(D, "reverse_area", lambda lat, lon: "Lamoille County")
    assert D.resolve_wikidata("Moss Glen Falls", "US", None, None, kind_hint="waterfall")["wikidata"] == "Q_A"
    with pytest.raises(SystemExit):
        D.resolve_wikidata("Moss Glen Falls", "US", None, None, kind_hint="waterfall", strict=True)
    names = root / "names.txt"
    names.write_text("Moss Glen Falls, US, waterfall\n", encoding="utf-8")
    assert run("quick-add", str(names)) == 2
    cap = capsys.readouterr()
    assert "--pick 1: Q_B" in cap.err and "AMBIGUOUS Moss Glen Falls" in cap.out
    assert not D.PATHS.store.exists()


def test_quick_add_dry_run_writes_nothing(root, monkeypatch, capsys):
    monkeypatch.setattr(D, "resolve_wikidata", lambda name, *a, **k: resolved(name))
    names = root / "names.txt"
    names.write_text("Lake Louise, CA\n", encoding="utf-8")
    assert run("quick-add", str(names), "--dry-run") == 0
    assert "would add CA/AB/banff-national-park/lake-louise" in capsys.readouterr().out
    assert not D.PATHS.store.exists()


def test_quick_add_falls_back_to_nominatim_and_marks_the_resolver(root, monkeypatch):
    monkeypatch.setattr(D, "resolve_wikidata", lambda *a, **k: None)
    monkeypatch.setattr(D, "resolve_nominatim", lambda name, cc, region: dict(resolved(name, qid=None), resolver="nominatim"))
    names = root / "names.txt"
    names.write_text("Lake Louise, CA\n", encoding="utf-8")
    assert run("quick-add", str(names)) == 0
    assert D.load()["places"][0]["resolver"] == "nominatim"


def test_quick_add_waits_for_the_wikidata_lock_and_gives_up(root, monkeypatch, capsys):
    monkeypatch.setattr(D, "LOCK_WAIT_S", 0)
    monkeypatch.setattr(D, "resolve_wikidata", lambda name, *a, **k: pytest.fail("called the service while another runner held it"))
    names = root / "names.txt"
    names.write_text("Lake Louise, CA\n", encoding="utf-8")
    with open(D.WD_LOCK, "a") as held:
        fcntl.flock(held, fcntl.LOCK_EX)
        assert run("quick-add", str(names)) == 1
    assert "is held by another runner" in capsys.readouterr().err
    # released: the next run takes it
    monkeypatch.setattr(D, "resolve_wikidata", lambda name, *a, **k: resolved(name))
    assert run("quick-add", str(names)) == 0


# ----------------------------------------------------------------------------- edit: the basics columns and field_meta
@pytest.fixture
def store(root):
    assert run("add", "Lake Louise", "--country", "CA", "--region", "AB", "--area", "Banff National Park", "--kind", "lake",
               "--lat", "51.41167", "--lon", "-116.22806", "--offline") == 0
    assert run("add", "Larch Valley", "--country", "CA", "--region", "AB", "--area", "Banff National Park", "--kind", "trail",
               "--lat", "51.32", "--lon", "-116.2", "--offline") == 0
    return root


def place(name):
    return next(p for p in D.load()["places"] if p["name"] == name)


def test_edit_sets_wikidata_elevation_image_with_provenance(store):
    assert run("edit", "lake-louise", "--wikidata", "q2217047", "--elevation-m", "1731", "--image", "File:Lake_Louise_Banff.jpg",
               "--basis", "official_info", "--source", "https://parks.canada.ca/x", "--source-type", "official") == 0
    p = place("Lake Louise")
    assert (p["wikidata"], p["elevation_m"]) == ("Q2217047", 1731)
    assert p["image"] == D.COMMONS_FILEPATH + "Lake%20Louise%20Banff.jpg"
    src = D.load()["sources"][-1]["id"]
    assert p["field_meta"]["elevation_m"] == {"state": "value", "on": D.today(), "basis": "official_info", "src": [src]}
    assert set(p["field_meta"]) == {"wikidata", "elevation_m", "image"}
    assert D.validate(D.load()) == []


def test_commons_image_forms_and_refusals():
    want = D.COMMONS_FILEPATH + "Moraine%20Lake.jpg"
    wiki = D.COMMONS_FILEPATH.split("Special:FilePath/")[0]
    for x in ("Moraine Lake.jpg", "File:Moraine_Lake.jpg", wiki + "File:Moraine_Lake.jpg", D.COMMONS_FILEPATH + "Moraine%20Lake.jpg"):
        assert D.commons_image(x) == want, x
    for bad in ("https://images.unsplash.com/photo-1", "https://www.pexels.com/photo/x/", "Moraine Lake", "File:"):
        with pytest.raises(D.Fail):
            D.commons_image(bad)


def test_edit_rejects_a_bad_qid_elevation_and_basis(store, capsys):
    assert run("edit", "lake-louise", "--wikidata", "2217047") == 1
    assert run("edit", "lake-louise", "--elevation-m", "12000") == 1
    assert run("edit", "lake-louise", "--wikidata", "Q1", "--basis", "a guess") == 1
    assert place("Lake Louise")["wikidata"] is None


def test_edit_searched_none_needs_tried_an_empty_column_and_clears_on_a_value(store):
    assert run("edit", "larch-valley", "--searched-none", "walk_km") == 1            # no --tried
    assert run("edit", "larch-valley", "--searched-none", "kind", "--tried", "x") == 1   # not a basics column
    assert run("edit", "larch-valley", "--searched-none", "walk_km,elevation_m", "--tried", "Parks Canada trail page",
               "--tried", "Wikidata (no P2044)") == 0
    p = place("Larch Valley")
    assert p["field_meta"]["walk_km"] == {"state": "searched_none", "on": D.today(), "tried": ["Parks Canada trail page", "Wikidata (no P2044)"]}
    assert D.validate(D.load()) == []
    assert run("edit", "larch-valley", "--elevation-m", "2100") == 0                  # a value drops its searched_none
    p = place("Larch Valley")
    assert p["field_meta"]["elevation_m"]["state"] == "value" and p["field_meta"]["walk_km"]["state"] == "searched_none"
    assert run("edit", "larch-valley", "--searched-none", "elevation_m", "--tried", "x") == 1   # has a value now


def test_validate_field_meta_rules(store):
    data = D.load()
    p = next(x for x in data["places"] if x["name"] == "Lake Louise")
    p["field_meta"] = {"nope": {"state": "value", "on": "2026-10-25"},
                       "wikidata": {"state": "searched_none", "on": "2026-10-25"},
                       "elevation_m": {"state": "value", "on": "2026-10-25"},
                       "image": {"state": "maybe"},
                       "season_months": {"state": "searched_none", "on": "yesterday", "tried": ["x"], "basis": "a guess", "src": ["src-99999"]}}
    errs = "\n".join(D.validate(data))
    assert "field_meta.nope: not a places column" in errs
    assert "field_meta.wikidata: searched_none needs `tried`" in errs
    assert "field_meta.elevation_m: state value, but the column is empty" in errs
    assert "field_meta.image: must be an object with state" in errs
    assert "field_meta.season_months: needs `on`" in errs
    assert "basis 'a guess' not in" in errs
    assert "src 'src-99999' is not a source row of this place" in errs


# ----------------------------------------------------------------------------- basics --report
def test_basics_report_asks_by_kind_and_reads_the_lane_records(store, capsys):
    lane = D.tripless_lane()
    put(store, "data/locations/page-keys.json", {"keys": {"loc:CA/AB/banff-national-park/lake-louise": "place/lake-louise",
                                                           "loc:CA/AB/banff-national-park/larch-valley": "place/larch-valley"}})
    v = lambda x: {"v": x, "state": "value", "basis": "official_info", "src": ["src-0001"]}  # noqa: E731
    put(store, f"data/capture/{lane}/BA.json", {"trip": lane, "records": [
        {"ref": "place/larch-valley", "links": [{"kind": "official", "state": "filled"}, {"kind": "osm", "state": "searched_none"}]},
        {"ref": "part/place/larch-valley#parking", "layer": "place", "parks_for": ["place/larch-valley"]}]})
    put(store, f"data/suitability/{lane}/BA.json", {"trip": lane, "records": [{"ref": "place/larch-valley", "suitability": {
        "effort": {"drivers": {"distance_km": v(8.6), "gain_m": {"v": None, "state": "searched_none", "on": "2026-10-25", "tried": ["x"]}},
                   "source_grade": {"v": None, "state": "gap"}}}}]})
    put(store, f"data/relevance/{lane}/BA.json", {"trip": lane, "records": [{"ref": "place/larch-valley", "why": "Larches in late September."}]})
    rep = D.basics_report(D.load(), store)
    rows = {r["id"].rsplit("/", 1)[1]: r for r in rep["places"]}
    lv, ll = rows["larch-valley"], rows["lake-louise"]
    assert lv["lane"] == lane and lv["has_record"] and lv["ref"] == "place/larch-valley"
    assert "length" not in lv["missing"]["trail"] and "gain" not in lv["missing"]["trail"]   # a dated searched_none answers
    assert "difficulty" in lv["missing"]["trail"]                                            # a gap is never a yes
    assert "links" not in lv["missing"] and "summary" not in lv["missing"]["identity"]
    assert lv["missing"]["parking"] == ["fee or permit"]                                    # the car park record answers the point
    assert "trail" not in ll["missing"] and ll["missing"]["parking"] == ["parking point", "fee or permit"]
    assert lv["asked"] > ll["asked"]
    assert rep["store"]["trails"] == 1 and rep["store"]["trails_with_length"] == 1
    assert rep["layers"]["trail"] == {"asked": 1, "missing": 1}
    assert [r["id"] for r in rep["places"]] == sorted((r["id"] for r in rep["places"]), key=lambda i: -rows[i.rsplit("/", 1)[1]]["missing_count"])
    assert run("basics", "--report") == 0
    out = capsys.readouterr().out
    assert out.startswith("Basics: 2 places (2 tied to no trip, 0 to one)")
    assert "trails with length 1 of 1" in out
    assert run("basics", "--report", "--json") == 0
    assert json.loads(capsys.readouterr().out)["schema"] == "locations-basics/1"


def test_basics_report_searched_none_on_a_store_column_answers_it(store):
    assert run("edit", "lake-louise", "--searched-none", "elevation_m,season_months", "--tried", "Wikidata Q1 (no P2044)") == 0
    rep = D.basics_report(D.load(), store)
    ll = next(r for r in rep["places"] if r["id"].endswith("lake-louise"))
    assert "elevation" not in ll["missing"].get("identity", []) and "when" not in ll["missing"]
    assert ll["ref"] is None and ll["lane"] == D.tripless_lane()   # no page ref until slugs.ts build pins one


def test_basics_report_reproduces_the_data_loc_counts_on_the_real_store(monkeypatch):
    """DATA-LOC section 1 (25 Oct 2026): 74 places, 66 with a QID, 62 with an image, 32 with elevation, 0 of 7 trails with length.
    Read-only on the repository. The counts may only improve as D2b fills the basics, so the test pins floors, not equalities."""
    monkeypatch.setattr(D, "PATHS", D.Paths(REPO))
    rep = D.basics_report(D.load(), REPO)
    s = rep["store"]
    assert s["places"] >= 74 and s["trails"] >= 7
    assert s["with_wikidata"] >= 66 and s["with_image"] >= 62 and s["with_elevation"] >= 32 and s["with_season_months"] >= 24
    assert s["without_page_ref"] == 0
    assert {r["lane"] for r in rep["places"] if not r["has_record"] and not r["tied_trip"]} == {D.tripless_lane()}
