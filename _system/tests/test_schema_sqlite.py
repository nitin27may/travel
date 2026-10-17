"""The DDL in locations_schema.sql loads into SQLite and holds every migrated row."""
import json
import sqlite3
import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "tools"))
import locations as D  # noqa: E402
import migrate_locations_v2 as M  # noqa: E402

DDL = HERE.parent / "tools" / "locations_schema.sql"
FIXTURE = HERE / "fixtures" / "locations-v1.json"


def _has_json1(con) -> bool:
    try:
        con.execute("select json_valid('[]')")
        return True
    except sqlite3.OperationalError:
        return False


def _connect() -> sqlite3.Connection:
    con = sqlite3.connect(":memory:")
    ddl = DDL.read_text(encoding="utf-8")
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


def test_every_row_loads_and_foreign_keys_hold(v2):
    con = _connect()
    load_all(con, v2)
    assert con.execute("PRAGMA foreign_key_check").fetchall() == []
    for t in D.TABLES:
        assert con.execute(f"SELECT count(*) FROM {t}").fetchone()[0] == len(v2[t]), t


def test_check_constraints_reject_bad_rows(v2):
    con = _connect()
    load_all(con, v2)
    with pytest.raises(sqlite3.IntegrityError):      # lat without lon
        con.execute("UPDATE places SET lon = NULL WHERE lat IS NOT NULL AND id = ?", (v2["places"][0]["id"],))
    with pytest.raises(sqlite3.IntegrityError):      # source with two owners
        con.execute("INSERT INTO sources (id, place_id, collection_id, type, saved) VALUES ('s', ?, ?, 'note', '2026-01-01')",
                    (v2["places"][0]["id"], v2["collections"][0]["id"]))
    with pytest.raises(sqlite3.IntegrityError):      # place in a missing area
        con.execute("UPDATE places SET area_id = 'nope' WHERE id = ?", (v2["places"][0]["id"],))
