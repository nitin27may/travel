"""The locations DDL loads into SQLite and holds every migrated row.

Two DDL files are checked with the same cases: the legacy hand-written locations_schema.sql and the DDL
generated from core/src/schema (data/schema/generated/schema.sql). The generated one also has to load
the whole platform: the real locations store, plus every fixture under core/test/fixtures when present.
"""
import json
import sqlite3
import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import locations as D  # noqa: E402
import migrate_locations_v2 as M  # noqa: E402

ROOT = HERE.parents[1]
LEGACY_DDL = ROOT / "data" / "schema" / "legacy" / "locations_schema.sql"
GENERATED_DDL = ROOT / "data" / "schema" / "generated" / "schema.sql"
FIXTURE = HERE / "fixtures" / "locations-v1.json"
CORE_FIXTURES = ROOT / "core" / "test" / "fixtures"
DDLS = [pytest.param(LEGACY_DDL, id="legacy"), pytest.param(GENERATED_DDL, id="generated")]


@pytest.fixture(params=DDLS)
def ddl_path(request) -> Path:
    return request.param


def _has_json1(con) -> bool:
    try:
        con.execute("select json_valid('[]')")
        return True
    except sqlite3.OperationalError:
        return False


def _connect(ddl_path: Path) -> sqlite3.Connection:
    con = sqlite3.connect(":memory:")
    ddl = ddl_path.read_text(encoding="utf-8")
    if not _has_json1(con):
        import re
        ddl = re.sub(r"\s+CHECK \(json_valid\(\w+\)\)", "", ddl)
    con.executescript(ddl)
    con.execute("PRAGMA foreign_keys = ON")
    assert con.execute("PRAGMA foreign_keys").fetchone()[0] == 1
    return con


def _insert(con, table: str, rows: list[dict]) -> None:
    cols = [c[0] for c in D.COLUMNS[table]]
    for r in rows:
        vals = []
        for name, typ, _ in D.COLUMNS[table]:
            v = r.get(name)
            if typ == "json":
                v = json.dumps(v, ensure_ascii=False)
            elif typ == "bool":
                v = int(v)
            vals.append(v)
        con.execute(f"INSERT INTO {table} ({','.join(cols)}) VALUES ({','.join('?' * len(cols))})", vals)


def load_all(con, v2: dict) -> None:
    order = ["countries", "regions", "areas", "places", "tags", "place_tags", "collections",
             "collection_places", "sources", "visits"]
    assert set(order) == set(D.TABLES)
    for t in order:
        rows = v2[t]
        if t == "tags":      # canonical rows first: alias_of is a foreign key
            rows = sorted(rows, key=lambda r: r["alias_of"] is not None)
        _insert(con, t, rows)


@pytest.fixture(scope="module")
def v2():
    v = M.migrate(json.loads(FIXTURE.read_text(encoding="utf-8")))
    pid = v["places"][0]["id"]
    v["visits"].append({"id": "vis-00001", "place_id": pid, "date_start": "2026-10", "date_end": None,
                        "trip": None, "notes": ""})
    return v


def test_every_row_loads_and_foreign_keys_hold(v2, ddl_path):
    con = _connect(ddl_path)
    load_all(con, v2)
    assert con.execute("PRAGMA foreign_key_check").fetchall() == []
    for t in D.TABLES:
        assert con.execute(f"SELECT count(*) FROM {t}").fetchone()[0] == len(v2[t]), t


def test_check_constraints_reject_bad_rows(v2, ddl_path):
    con = _connect(ddl_path)
    load_all(con, v2)
    with pytest.raises(sqlite3.IntegrityError):      # lat without lon
        con.execute("UPDATE places SET lon = NULL WHERE lat IS NOT NULL AND id = ?", (v2["places"][0]["id"],))
    with pytest.raises(sqlite3.IntegrityError):      # source with two owners
        con.execute("INSERT INTO sources (id, place_id, collection_id, type, saved) VALUES ('s', ?, ?, 'note', '2026-01-01')",
                    (v2["places"][0]["id"], v2["collections"][0]["id"]))
    with pytest.raises(sqlite3.IntegrityError):      # place in a missing area
        con.execute("UPDATE places SET area_id = 'nope' WHERE id = ?", (v2["places"][0]["id"],))


# ----------------------------------------------------------------------------- the whole generated DDL
TRIP_TABLE_NAMES = {"trip": "trips", "sources": "trip_sources"}
CATALOG_TABLE_NAMES = {"sources": "catalog_sources"}


def _q(name: str) -> str:
    return '"' + name + '"'


def _scalar(v):
    if isinstance(v, bool):
        return int(v)
    if isinstance(v, (list, dict)):
        return json.dumps(v, ensure_ascii=False)
    return v


def _insert_rows(con, table: str, rows: list[dict], extra: dict | None = None) -> None:
    cols = [r[1] for r in con.execute(f"PRAGMA table_info({table})")]
    assert cols, f"generated DDL has no table {table}"
    for row in rows:
        full = {**row, **(extra or {})}
        unknown = set(full) - set(cols)
        assert not unknown, f"{table}: columns {sorted(unknown)} are not in the generated DDL"
        con.execute(f"INSERT INTO {table} ({','.join(_q(c) for c in cols)}) VALUES ({','.join('?' * len(cols))})",
                    [_scalar(full.get(c)) for c in cols])


def load_document(con, doc: dict, file_key: str = "") -> str:
    """Insert one trip, catalog or locations document. Returns its family.

    `file_key` names the catalog file ("trails/AR"): source ids restart in every file."""
    if "trip" in doc and "profile" in doc:
        slug = doc["id"]
        for key, value in doc.items():
            if key in ("schema_version", "id", "updated"):
                continue
            table = TRIP_TABLE_NAMES.get(key, key)
            if key == "trip":
                _insert_rows(con, "trips", [value])
            else:
                rows = [value] if isinstance(value, dict) else value
                _insert_rows(con, table, rows, {"trip_id": slug})
        return "trip"
    if "country" in doc:
        for key, value in doc.items():
            if key in ("schema_version", "country"):
                continue
            extra = {"file": file_key} if key == "sources" else None
            _insert_rows(con, CATALOG_TABLE_NAMES.get(key, key), value, extra)
        return "catalog"
    for t in D.TABLES:
        rows = doc.get(t, [])
        if t == "tags":      # canonical tags first so alias_of resolves
            rows = sorted(rows, key=lambda r: r["alias_of"] is not None)
        _insert_rows(con, t, rows)
    return "locations"


def _fixture_documents() -> list[Path]:
    """root/ locations and catalog files first, then every valid/*.json (trips and catalog files)."""
    out: list[Path] = []
    root = CORE_FIXTURES / "root"
    if root.is_dir():
        out += sorted((root / "data" / "locations").glob("*.json"))
        out += sorted((root / "data" / "catalog").glob("*/*.json"))
    valid = CORE_FIXTURES / "valid"
    if valid.is_dir():
        out += sorted(valid.glob("*.json"))
    return out


def test_generated_ddl_loads_the_real_store():
    con = _connect(GENERATED_DDL)
    con.execute("PRAGMA foreign_keys = OFF")        # file order is not dependency order; the check below is the test
    store = json.loads((ROOT / "data" / "locations" / "locations.json").read_text(encoding="utf-8"))
    load_document(con, store)
    assert con.execute("SELECT count(*) FROM places").fetchone()[0] == len(store["places"])
    assert con.execute("PRAGMA foreign_key_check").fetchall() == []


@pytest.mark.skipif(not (CORE_FIXTURES / "valid").is_dir(), reason="core fixtures arrive in P2a step 5")
def test_generated_ddl_loads_every_valid_fixture():
    """The fixture root (locations and catalog) plus every valid trip and catalog file, then a foreign key check."""
    con = _connect(GENERATED_DDL)
    con.execute("PRAGMA foreign_keys = OFF")
    families = {}
    for path in _fixture_documents():
        doc = json.loads(path.read_text(encoding="utf-8"))
        key = f"{path.parent.name}/{path.stem}"
        families.setdefault(load_document(con, doc, key), []).append(path.name)
    assert con.execute("PRAGMA foreign_key_check").fetchall() == []
    assert {"trip", "catalog", "locations"} <= set(families)
    trips = {p.stem for p in (CORE_FIXTURES / "valid").glob("*.json") if "trip" in json.loads(p.read_text())}
    assert trips and con.execute("SELECT count(*) FROM trips").fetchone()[0] == len(trips)
    assert con.execute("SELECT count(*) FROM items").fetchone()[0] > 10


def test_generated_ddl_trip_foreign_keys_are_scoped_to_the_trip():
    """Two trips may reuse the same local ids; a child row may not point at another trip's parent."""
    con = _connect(GENERATED_DDL)
    con.execute("PRAGMA foreign_keys = OFF")
    trips = {
        slug: {"slug": slug, "title": "t", "subtitle": "", "status": "idea", "primary_style": "mixed",
               "duration_shape": "day-trip", "movement_shape": "single-base", "party_shape": "solo",
               "countries": ["CA"], "region_label": "x", "season_months": [8], "season_note": "", "nights": 0,
               "origin": "Toronto", "origin_tz": "America/Toronto", "base_currency": "CAD", "theme": None,
               "hero_image": None, "answer_prose": None, "orientation_prose": None, "web_published": False,
               "visibility": "private", "owner_id": "u_owner", "shared_with": [], "generated_by": None,
               "legacy_url": None, "created": "2026-10-17"} for slug in ("a-trip", "b-trip")
    }
    _insert_rows(con, "trips", list(trips.values()))
    con.commit()                                      # PRAGMA foreign_keys is ignored inside a transaction
    con.execute("PRAGMA foreign_keys = ON")
    day = {"n": 1, "title": "d", "kind": "hike", "base_id": None, "summary": "", "prose": None, "flexible_group": None,
           "decision_rules": [], "plan_b_title": "", "plan_b_text": None, "sun_note": None, "day_of_links": [],
           "accepted_warnings": []}
    _insert_rows(con, "days", [day], {"trip_id": "a-trip"})
    track = {"day": 1, "track": "A", "audience": "family", "title": "", "notes": "", "split": False}
    _insert_rows(con, "day_tracks", [track], {"trip_id": "a-trip"})
    with pytest.raises(sqlite3.IntegrityError):      # day 1 exists only in a-trip
        _insert_rows(con, "day_tracks", [track], {"trip_id": "b-trip"})
    with pytest.raises(sqlite3.IntegrityError):      # the trip must exist
        _insert_rows(con, "days", [day], {"trip_id": "nope"})
