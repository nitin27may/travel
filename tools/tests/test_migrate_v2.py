"""v1 to v2 migration, run against the frozen fixture fixtures/locations-v1.json."""
import json
import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import locations as D  # noqa: E402
import migrate_locations_v2 as M  # noqa: E402

FIXTURE = HERE / "fixtures" / "locations-v1.json"


@pytest.fixture(scope="module")
def v1():
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


@pytest.fixture
def v2(v1):
    return M.migrate(json.loads(json.dumps(v1)))


def test_counts_match_the_fixture(v1, v2):
    assert len(v2["places"]) == len(v1["places"]) == 63
    assert len(v2["countries"]) == len(v1["countries"])
    assert len(v2["regions"]) == len({(p["country"], p["region"]) for p in v1["places"]})
    assert len(v2["areas"]) == len({(p["country"], p["region"], p["area"]) for p in v1["places"]})
    assert len(v2["collections"]) == len(v1["collections"])
    assert len(v2["collection_places"]) == sum(len(c["places"]) for c in v1["collections"])
    assert len(v2["sources"]) == sum(len(p["sources"]) for p in v1["places"]) + sum(len(c["sources"]) for c in v1["collections"])
    assert v2["visits"] == [] and v2["layout"] == "single" and v2["schema_version"] == 2
    assert v2["updated"] == v1["updated"]


def test_every_v1_id_survives_and_geography_comes_from_the_joins(v1, v2):
    assert {p["country"] for p in v1["places"]} <= set(v1["countries"])
    assert {p["id"] for p in v1["places"]} == {p["id"] for p in v2["places"]}
    ix = D.V.Index(v2)
    for p1 in v1["places"]:
        c, r, a = ix.geo(ix.place[p1["id"]])
        assert (c["code"], c["name"]) == (p1["country"], v1["countries"][p1["country"]])   # one v1 row says IT is "France"
        assert (r["code"], r["name"]) == (p1["region"], p1["region_name"])
        assert (a["slug"], a["name"]) == (p1["area"], p1["area_name"])
    assert not {"country", "region", "area", "country_name", "region_name", "area_name", "tags", "sources",
                "season", "verified"} & set(v2["places"][0])


def test_validates_clean(v2):
    assert D.validate(v2, D.Paths(HERE.parents[1])) == []


def test_unconfirmed_place_has_status_and_no_tag(v2):
    p = next(x for x in v2["places"] if x["id"].endswith("/chute-du-grand-sault"))
    assert p["location_status"] == "unconfirmed"
    assert all(r["tag_id"] != "location-unconfirmed" for r in v2["place_tags"])
    assert all(t["id"] != "location-unconfirmed" for t in v2["tags"])
    assert sum(p["location_status"] == "unconfirmed" for p in v2["places"]) == 1


def test_season_months_are_ints(v1, v2):
    for p in v2["places"]:
        assert all(isinstance(m, int) for m in p["season_months"])
    old = next(p for p in v1["places"] if p["season"])
    new = next(p for p in v2["places"] if p["id"] == old["id"])
    assert new["season_months"] == sorted({D.V.MONTHS.index(m) + 1 for m in old["season"]})
    assert next(p for p in v2["places"] if not [x for x in v1["places"] if x["id"] == p["id"]][0]["season"])["season_months"] == []


def test_sources_are_sequential_with_post_dates(v2):
    ids = [s["id"] for s in v2["sources"]]
    assert ids == [f"src-{n:05d}" for n in range(1, len(ids) + 1)]
    place_owned = [s for s in v2["sources"] if s["place_id"]]
    assert [s["place_id"] for s in place_owned] == sorted(s["place_id"] for s in place_owned)
    assert all(s["collection_id"] for s in v2["sources"][len(place_owned):])
    posted = [s for s in v2["sources"] if (s["note"] or "").endswith("15 Oct 2026")]
    assert posted and all(s["post_date"] == "2026-10-15" for s in posted)
    for s in v2["sources"]:
        assert s["post_date"] == D.parse_post_date(s["note"])
    assert sum(s["post_date"] is not None for s in v2["sources"]) >= 10
    assert all(s["saved"] for s in v2["sources"])


def test_tags_are_canonical_and_kind_tags_dropped(v2):
    amap = {t["id"]: t["alias_of"] for t in v2["tags"]}
    kinds = {p["id"]: p["kind"] for p in v2["places"]}
    for r in v2["place_tags"]:
        assert amap[r["tag_id"]] is None
        assert r["tag_id"] != kinds[r["place_id"]]
    for alias, target in D.INITIAL_ALIASES.items():
        assert amap[alias] == target and target in amap
    assert "waterfalls" not in {r["tag_id"] for r in v2["place_tags"]}


def test_collection_order_is_kept(v1, v2):
    for c in v1["collections"]:
        got = [r["place_id"] for r in sorted(v2["collection_places"], key=lambda r: r["position"])
               if r["collection_id"] == c["slug"]]
        assert got == c["places"]


def test_migrate_does_not_mutate_input(v1):
    snap = json.dumps(v1, sort_keys=True)
    M.migrate(v1)
    assert json.dumps(v1, sort_keys=True) == snap


def test_cli_check_writes_nothing_and_second_run_is_a_no_op(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(D, "PATHS", D.Paths(tmp_path))
    D.PATHS.store.parent.mkdir(parents=True)
    D.PATHS.store.write_bytes(FIXTURE.read_bytes())
    for slug in {p["trip"] for p in json.loads(FIXTURE.read_text())["places"] if p["trip"]}:
        (tmp_path / slug).mkdir()
    assert M.main(["--check"]) == 0
    assert D.PATHS.store.read_bytes() == FIXTURE.read_bytes()
    assert M.main([]) == 0
    first = D.PATHS.store.read_bytes()
    assert json.loads(first)["schema_version"] == 2
    capsys.readouterr()
    assert M.main([]) == 0
    assert "already v2" in capsys.readouterr().out
    assert D.PATHS.store.read_bytes() == first
    assert D.PATHS.wishlist.exists() and D.PATHS.globe_places.exists()
    assert D.main(["validate"]) == 0
