"""v2 to v3 migration, run against the frozen fixture fixtures/locations-v2.json (the store as P1 left it)."""
import copy
import json
import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import location_views as V  # noqa: E402
import locations as D  # noqa: E402
import migrate_locations_v3 as M  # noqa: E402

FIXTURE = HERE / "fixtures" / "locations-v2.json"
STYLE = {"adventure", "active-nature", "scenic-relaxed", "luxury-relax", "relax", "city-culture", "road-trip",
         "family", "romantic", "hidden-gems", "mixed"}


@pytest.fixture(scope="module")
def v2():
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


@pytest.fixture
def v3(v2):
    return M.migrate(copy.deepcopy(v2))


@pytest.fixture
def root(tmp_path, monkeypatch):
    """A tmp root holding the v2 fixture where the real store lives, plus the trip folders its places name."""
    monkeypatch.setattr(D, "PATHS", D.Paths(tmp_path))
    D.PATHS.store.parent.mkdir(parents=True)
    D.PATHS.store.write_bytes(FIXTURE.read_bytes())
    for slug in {p["trip"] for p in json.loads(FIXTURE.read_text())["places"] if p["trip"]}:
        (tmp_path / "legacy" / slug).mkdir(parents=True)
    return tmp_path


def test_fixture_is_v2_with_64_places(v2):
    assert v2["schema_version"] == 2 and len(v2["places"]) == 64 and "tags" in v2


def test_counts_and_ids_equal_between_v2_and_v3(v2, v3):
    assert v3["schema_version"] == 3
    for t in D.TABLES:
        assert len(v3[t]) == len(v2[t]), t
    for t, key in (("places", "id"), ("regions", "id"), ("areas", "id"), ("tags", "id"), ("sources", "id"),
                   ("collections", "id"), ("countries", "code")):
        assert [r[key] for r in v3[t]] == [r[key] for r in v2[t]], t


def test_every_v2_place_id_is_present(v2, v3):
    assert {p["id"] for p in v2["places"]} <= {p["id"] for p in v3["places"]}


def test_v2_columns_keep_their_values(v2, v3):
    for a, b in zip(v2["places"], v3["places"]):
        assert {k: b[k] for k in a} == a, a["id"]      # kind, status, trip and the rest are untouched


def test_new_place_columns_get_the_listed_defaults(v3):
    for p in v3["places"]:
        assert p["review_status"] == "proposed" and p["confidence"] == "stated"
        assert p["licence"] == "own-words" and p["accessibility"] == "unknown"
        assert p["contributed_by"] == ["u_owner"] and p["merged_from"] == [] and p["field_meta"] == {}
        assert p["updated"] == p["added"]
        for col in ("name_lang", "min_age", "max_age", "min_height_cm", "max_height_cm", "min_weight_kg",
                    "max_weight_kg", "house_grade", "walk_km", "walk_gain_m", "duration_min", "cost_ref",
                    "verified_by", "last_verified"):
            assert p[col] is None, col
    assert [c[0] for c in D.COLUMNS["places"]][20:] == list(D.PLACE_V3_DEFAULTS) + ["updated"]


def test_every_tag_has_a_kind_and_aliases_follow_their_target(v3):
    by_id = {t["id"]: t for t in v3["tags"]}
    assert all(t["kind"] in D.TAG_KINDS for t in v3["tags"])
    assert {t["id"] for t in v3["tags"] if t["kind"] == "style"} <= STYLE
    for t in v3["tags"]:
        if t["alias_of"]:
            assert t["kind"] == by_id[t["alias_of"]]["kind"], t["id"]
    assert by_id["adventure"]["kind"] == "style" and by_id["waterfalls"]["kind"] == by_id["waterfall"]["kind"]


def test_migrate_does_not_mutate_its_input(v2):
    snap = json.dumps(v2, sort_keys=True)
    M.migrate(v2)
    assert json.dumps(v2, sort_keys=True) == snap


def test_migrate_refuses_anything_but_v2(v3):
    with pytest.raises(D.Fail):
        M.migrate(v3)


def test_cli_check_writes_nothing(root, capsys):
    before = {p: p.read_bytes() for p in root.rglob("*") if p.is_file()}
    assert M.main(["--check"]) == 0
    assert "would write: 64 places" in capsys.readouterr().out
    assert {p: p.read_bytes() for p in root.rglob("*") if p.is_file()} == before
    assert not D.PATHS.vocab.exists()


def test_cli_converts_then_second_run_is_a_no_op(root, capsys, v2):
    assert M.main([]) == 0
    first = {p: p.read_bytes() for p in root.rglob("*") if p.is_file()}
    store = json.loads(D.PATHS.store.read_text(encoding="utf-8"))
    assert store["schema_version"] == 3 and "tags" not in store and len(store["places"]) == 64
    capsys.readouterr()
    assert M.main([]) == 0
    assert "already v3" in capsys.readouterr().out
    assert {p: p.read_bytes() for p in root.rglob("*") if p.is_file()} == first
    assert D.main(["validate"]) == 0


def test_vocabulary_file_equals_the_v2_tags_plus_kind(root, v2):
    assert M.main([]) == 0
    vocab = json.loads(D.PATHS.vocab.read_text(encoding="utf-8"))
    assert vocab["schema_version"] == 1 and list(vocab) == ["schema_version", "tags"]
    assert [list(t) for t in vocab["tags"]][0] == ["id", "label", "kind", "alias_of"]
    assert [{k: v for k, v in t.items() if k != "kind"} for t in vocab["tags"]] == sorted(v2["tags"], key=lambda t: t["id"])
    assert D.load()["tags"] == vocab["tags"]


def headings(md: str) -> list[str]:
    return [l for l in md.splitlines() if l.startswith("#") and not l.startswith("#" + "#" * 6)
            and l.split(" ", 1)[0].strip("#") == ""]


def test_wishlist_headings_are_the_same_from_v2_and_v3(root, v2, v3):
    """Place lines carry #tag words, so only real headings (a run of # then a space) are compared."""
    def wishlist(data):
        out = V.render_all(data, D.PATHS)
        return out[D.PATHS.wishlist].decode("utf-8") if isinstance(out[D.PATHS.wishlist], bytes) else out[D.PATHS.wishlist]
    a, b = headings(wishlist(v2)), headings(wishlist(v3))
    assert a and a == b
    assert any(h.startswith("### ") for h in a)


def test_store_layout_stays_one_row_per_line(root):
    assert M.main([]) == 0
    lines = D.PATHS.store.read_text(encoding="utf-8").splitlines()
    assert lines[:2] == ["{", '"schema_version": 3,']
    assert sum(1 for l in lines if l.startswith('{"id":"') and '"area_id"' in l) == 64
    assert D.dumps(D.load()) == D.PATHS.store.read_text(encoding="utf-8")


def test_split_layout_survives_the_migration(root, v2):
    """A v2 store already split by country migrates part by part and still loads as one."""
    data = copy.deepcopy(v2)
    data["layout"] = "by-country"
    top, parts = D.split_rows(data)
    top["tags"] = v2["tags"]
    D.PATHS.store.write_text(json.dumps(top, ensure_ascii=False), encoding="utf-8")
    for cc, part in parts.items():
        D.part_path(cc).write_text(json.dumps({"schema_version": 2, "country": cc, **part}), encoding="utf-8")
    assert M.main([]) == 0
    assert json.loads(D.part_path("CA").read_text())["schema_version"] == 3
    merged = D.load()
    assert merged["layout"] == "by-country" and len(merged["places"]) == 64 and len(merged["tags"]) == 80
    assert D.validate(merged) == [] and D.main(["build", "--check"]) == 0
