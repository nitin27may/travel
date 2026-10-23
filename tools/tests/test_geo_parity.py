"""tools/geo.py against core/src/geo/distance.ts: both read core/test/geo/pairs.json (captured from the TypeScript functions before
CONS-2 replaced them). The TypeScript side is checked by core/test/geo/distance.test.ts."""
import json
import math
import re
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
import geo  # noqa: E402

TABLE = json.loads((ROOT / "core/test/geo/pairs.json").read_text())
PAIRS = TABLE["pairs"]


def test_table_has_twenty_or_more_pairs():
    assert len(PAIRS) >= 20


def test_radius_matches_the_typescript_module():
    ts = (ROOT / "core/src/geo/distance.ts").read_text()
    assert float(re.search(r"EARTH_RADIUS_KM = ([\d.]+)", ts).group(1)) == geo.EARTH_RADIUS_KM == TABLE["radiusKm"]


def test_band_constants_match_nearby_config():
    ts = (ROOT / "core/src/config/nearby.ts").read_text()
    pairs = {
        "WALK_KM": geo.WALK_KM, "ROAD_FACTOR": geo.ROAD_FACTOR, "ROAD_EXTRA_KM": geo.ROAD_EXTRA_KM, "SHORT_DRIVE_KM": geo.SHORT_DRIVE_KM,
        "SLOW_KMH": geo.SLOW_KMH, "FAST_KMH": geo.FAST_KMH, "DRIVE_PADDING_MIN": geo.DRIVE_PADDING_MIN,
    }
    for name, value in pairs.items():
        assert float(re.search(rf"export const {name} = ([\d.]+);", ts).group(1)) == value, name
    edges = re.search(r"DRIVE_BAND_EDGES_MIN = \[([\d, ]+)\]", ts).group(1)
    assert tuple(int(x) for x in edges.split(",")) == geo.DRIVE_BAND_EDGES_MIN


@pytest.mark.parametrize("row", PAIRS, ids=[f'{r["a"]["name"]}->{r["b"]["name"]}' for r in PAIRS])
def test_pair_matches_typescript(row):
    a, b = row["a"], row["b"]
    km = geo.haversine_km(a["lat"], a["lon"], b["lat"], b["lon"])
    assert km == pytest.approx(row["km"], abs=1e-6)
    assert geo.haversine_m(a["lat"], a["lon"], b["lat"], b["lon"]) == pytest.approx(row["m"], abs=1e-3)
    assert geo.bearing8(a["lat"], a["lon"], b["lat"], b["lon"]) == row["bearing"]
    assert geo.band_of(row["km"]) == row["band"]


def test_antipodes_do_not_raise():
    assert geo.haversine_km(0, 0, 0, 180) == pytest.approx(math.pi * geo.EARTH_RADIUS_KM)
