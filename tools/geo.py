"""Great-circle helpers: the Python mirror of core/src/geo/distance.ts (CONS-2).

One earth radius lives here and in the TypeScript module, nowhere else (the `earth-radius` rule of tools/cons/hardcode_scan.py).
tools/tests/test_geo_parity.py runs both against the one table in core/test/geo/pairs.json, so a change to either side fails the other.
The band arithmetic mirrors core/src/config/nearby.ts; change a number there and here together (the parity test pins them).
"""
from __future__ import annotations

import math

EARTH_RADIUS_KM = 6371.0088

# core/src/config/nearby.ts
WALK_KM = 1.2
ROAD_FACTOR = 1.42
ROAD_EXTRA_KM = 1.5
SHORT_DRIVE_KM = 60
SLOW_KMH = 46
FAST_KMH = 72
DRIVE_PADDING_MIN = 3
DRIVE_BAND_EDGES_MIN = (15, 30, 60)

BEARINGS = ("N", "NE", "E", "SE", "S", "SW", "W", "NW")
NEAR_BANDS = ("walk", "lt15", "15-30", "30-60", "60-120")


def haversine_km(a_lat: float, a_lon: float, b_lat: float, b_lon: float) -> float:
    """Great-circle distance in km between two points in degrees (longitude positive east)."""
    p1, p2 = math.radians(a_lat), math.radians(b_lat)
    dp, dl = math.radians(b_lat - a_lat), math.radians(b_lon - a_lon)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(min(1.0, math.sqrt(h)))


def haversine_m(a_lat: float, a_lon: float, b_lat: float, b_lon: float) -> float:
    return haversine_km(a_lat, a_lon, b_lat, b_lon) * 1000


def bearing8(a_lat: float, a_lon: float, b_lat: float, b_lon: float) -> str:
    """Eight-point compass bearing (initial great-circle bearing) from a to b."""
    y = math.sin(math.radians(b_lon - a_lon)) * math.cos(math.radians(b_lat))
    x = math.cos(math.radians(a_lat)) * math.sin(math.radians(b_lat)) - math.sin(math.radians(a_lat)) * math.cos(math.radians(b_lat)) * math.cos(
        math.radians(b_lon - a_lon)
    )
    deg = (math.degrees(math.atan2(y, x)) + 360) % 360
    # JavaScript Math.round rounds halves up; Python's round() rounds them to even.
    return BEARINGS[int(math.floor(deg / 45 + 0.5)) % 8]


def band_of(km: float) -> str:
    """The walk or drive band of a straight-line distance (nearby spec 5.1)."""
    if km < WALK_KM:
        return "walk"
    short = km < SHORT_DRIVE_KM
    road = km * ROAD_FACTOR + (ROAD_EXTRA_KM if short else 0)
    minutes = road / (SLOW_KMH if short else FAST_KMH) * 60 + DRIVE_PADDING_MIN
    a, b, c = DRIVE_BAND_EDGES_MIN
    return "lt15" if minutes < a else "15-30" if minutes < b else "30-60" if minutes < c else "60-120"
