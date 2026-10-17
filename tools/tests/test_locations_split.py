"""Tests for the per-country split layout (locations.py load/save IO and `layout`).
Every test points the tool at a tmp root with monkeypatch.setattr(D, "PATHS", D.Paths(tmp_path))."""
import json
import shutil
import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import locations as D  # noqa: E402
import location_views as V  # noqa: E402
from test_locations import run, seed  # noqa: E402

REPO = HERE.parents[1]


@pytest.fixture
def root(tmp_path, monkeypatch):
    monkeypatch.setattr(D, "PATHS", D.Paths(tmp_path))
    (tmp_path / "legacy" / "trip-one").mkdir(parents=True)
    (tmp_path / "legacy" / "trip-one" / "index.html").write_text("<html></html>")
    return tmp_path


def seed_two_countries(root):
    seed(root)
    assert run("add", "Stowe", "--country", "US", "--region", "VT", "--area", "Lamoille County", "--kind", "town",
               "--lat", "44.46", "--lon", "-72.69", "--offline", "--source", "https://example.com/s") == 0
    assert run("visit", "add", "US/VT/lamoille-county/stowe", "--date", "2026-10-02") == 0


def snapshot(root) -> dict:
    return {p.name: p.read_bytes() for p in (root / "data" / "locations").glob("*") if p.is_file()}


def test_single_split_single_is_byte_identical(root):
    seed_two_countries(root)
    before = (root / "data" / "locations" / "locations.json").read_bytes()
    assert run("layout", "split") == 0
    assert (root / "data" / "locations" / "CA.json").is_file() and (root / "data" / "locations" / "US.json").is_file()
    assert run("layout", "single") == 0
    assert (root / "data" / "locations" / "locations.json").read_bytes() == before
    assert not (root / "data" / "locations" / "CA.json").exists()
    assert not (root / "data" / "locations" / "US.json").exists()


def test_root_and_part_contents(root):
    seed_two_countries(root)
    run("layout", "split")
    r = json.loads((root / "data" / "locations" / "locations.json").read_text())
    assert r["layout"] == "by-country" and r["parts"] == ["CA", "US"]
    assert set(r) == {"schema_version", "updated", "layout", "parts", "countries", "collections",
                      "collection_places"}
    ca = json.loads((root / "data" / "locations" / "CA.json").read_text())
    assert list(ca) == ["schema_version", "country", "regions", "areas", "places", "place_tags", "sources", "visits"]
    assert ca["country"] == "CA" and {p["id"].split("/")[0] for p in ca["places"]} == {"CA"}
    assert len(ca["places"]) == 3 and ca["place_tags"]
    us = json.loads((root / "data" / "locations" / "US.json").read_text())
    assert len(us["visits"]) == 1 and len(us["sources"]) == 1
    # one row per line, same as the single file
    rows = [l for l in (root / "data" / "locations" / "CA.json").read_text().splitlines() if l.startswith("{\"")]
    assert len(rows) == sum(len(ca[t]) for t in D.PART_TABLES)


def test_collection_sources_stay_in_root(root):
    seed_two_countries(root)
    assert run("collection", "add", "--slug", "tour", "--name", "Tour", "--places", "Stowe",
               "--source", "https://example.com/c") == 0
    run("layout", "split")
    r = json.loads((root / "data" / "locations" / "locations.json").read_text())
    assert [s["collection_id"] for s in r["sources"]] == ["tour"]
    merged = D.load()
    assert any(s["collection_id"] == "tour" for s in merged["sources"])


def test_load_merges_parts_to_the_same_data(root):
    seed_two_countries(root)
    single = D.load()
    run("layout", "split")
    merged = D.load()
    for t in D.TABLES:
        key = lambda r: D._sort_key(t, r)  # noqa: E731
        assert sorted(merged[t], key=key) == sorted(single[t], key=key), t


def test_save_routes_new_rows_into_the_right_part(root):
    seed_two_countries(root)
    run("layout", "split")
    assert run("add", "Cinque Terre", "--country", "IT", "--region", "liguria", "--area", "La Spezia",
               "--kind", "park", "--lat", "44.1", "--lon", "9.7", "--offline") == 0
    r = json.loads((root / "data" / "locations" / "locations.json").read_text())
    assert r["parts"] == ["CA", "IT", "US"]
    it = json.loads((root / "data" / "locations" / "IT.json").read_text())
    assert [p["name"] for p in it["places"]] == ["Cinque Terre"]


def test_part_with_foreign_row_is_rejected(root):
    seed_two_countries(root)
    run("layout", "split")
    p = root / "data" / "locations" / "CA.json"
    ca = json.loads(p.read_text())
    ca["places"].append(json.loads(json.dumps(
        next(x for x in json.loads((root / "data" / "locations" / "US.json").read_text())["places"]))))
    p.write_text(json.dumps(ca))
    with pytest.raises(D.Fail, match="belongs to"):
        D.load()


def test_part_with_wrong_country_is_rejected(root):
    seed_two_countries(root)
    run("layout", "split")
    p = root / "data" / "locations" / "CA.json"
    ca = json.loads(p.read_text())
    ca["country"] = "US"
    p.write_text(json.dumps(ca))
    with pytest.raises(D.Fail, match="country"):
        D.load()


def test_missing_part_is_rejected(root):
    seed_two_countries(root)
    run("layout", "split")
    (root / "data" / "locations" / "US.json").unlink()
    with pytest.raises(D.Fail, match="US.json is listed in parts but missing"):
        D.load()
    assert run("validate") == 1      # main turns the Fail into exit 1, no traceback


def test_split_store_validates_builds_and_is_stable(root, capsys):
    seed_two_countries(root)
    run("layout", "split")
    assert run("validate") == 0
    assert run("build", "--check") == 0
    before = snapshot(root)
    assert run("build") == 0
    assert snapshot(root) == before


def test_second_save_does_not_rewrite_unchanged_parts(root):
    seed_two_countries(root)
    run("layout", "split")
    us = root / "data" / "locations" / "US.json"
    m = us.stat().st_mtime_ns
    assert run("edit", "Lake Louise", "--note", "x") == 0
    assert us.stat().st_mtime_ns == m


def test_layout_is_idempotent(root, capsys):
    seed_two_countries(root)
    assert run("layout", "single") == 0
    assert "already single" in capsys.readouterr().out
    run("layout", "split")
    assert run("layout", "split") == 0
    assert "already by-country" in capsys.readouterr().out


def test_validate_warns_but_passes_above_300_places_when_single(root, capsys):
    seed(root)
    data = D.load()
    base = data["places"][0]
    for i in range(301):
        data["places"].append({**base, "id": f"CA/AB/banff-national-park/bulk-{i}", "name": f"Bulk {i}"})
    D.PATHS.store.write_text(D.dumps(data), encoding="utf-8")
    capsys.readouterr()
    rc = run("validate")
    out = capsys.readouterr().out
    assert "WARN" in out and "300" in out
    assert rc == 0, out               # warnings never decide the exit code
    assert not any(l.startswith("ERROR") and "300" in l for l in out.splitlines())


def test_real_store_split_in_tmp_validates_and_renders(tmp_path, monkeypatch):
    """A copy of the committed store, split in a tmp root, gives the same validation and the same views."""
    store = REPO / "data" / "locations" / "locations.json"
    if not store.is_file():
        pytest.skip("no committed store")
    dst = tmp_path / "data" / "locations"
    dst.mkdir(parents=True)
    shutil.copy(store, dst / "locations.json")
    (tmp_path / "data" / "vocab").mkdir(parents=True)
    shutil.copy(REPO / "data" / "vocab" / "tags.json", tmp_path / "data" / "vocab" / "tags.json")
    for d in (REPO / "legacy" / "_system" / "site",):
        (tmp_path / "legacy" / "_system").mkdir(parents=True, exist_ok=True)
        shutil.copytree(d, tmp_path / "legacy" / "_system" / "site", dirs_exist_ok=True)
    (tmp_path / "data" / "reference").mkdir(parents=True, exist_ok=True)
    shutil.copy(REPO / "data" / "reference" / "countries.json", tmp_path / "data" / "reference" / "countries.json")
    for child in (REPO / "legacy").iterdir():      # trip folders, so the trip-exists rule sees what it sees in the repo
        if child.is_dir() and (child / "index.html").is_file() and not child.name.startswith((".", "_")):
            (tmp_path / "legacy" / child.name).mkdir(parents=True, exist_ok=True)
            (tmp_path / "legacy" / child.name / "index.html").write_text("<html></html>")
    monkeypatch.setattr(D, "PATHS", D.Paths(tmp_path))
    single = D.load()
    expected = {p.relative_to(tmp_path): b for p, b in V.render_all(single, D.PATHS).items()}
    assert D.validate(single) == []
    assert D.main(["layout", "split"]) == 0
    assert (tmp_path / "data" / "locations" / "CA.json").is_file()
    split = D.load()
    assert split["layout"] == "by-country"
    assert D.validate(split) == []
    got = {p.relative_to(tmp_path): b for p, b in V.render_all(split, D.PATHS).items()}
    assert got == expected
    assert D.main(["validate"]) == 0
    assert D.main(["build", "--check"]) == 0
    assert D.main(["layout", "single"]) == 0
    assert (tmp_path / "data" / "locations" / "locations.json").read_bytes() == store.read_bytes()
