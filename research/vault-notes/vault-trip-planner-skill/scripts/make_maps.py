#!/usr/bin/env python3
"""Turn a trip's places list into Google Maps assets.

Reads a places JSON file and writes two outputs next to it:
  1. <stem>-mymaps.csv   -> import into Google My Maps (one click, pins every place)
  2. <stem>-map-links.md -> clickable per-place pins and per-day driving routes

The CSV is designed for My Maps: it geocodes from the Address column (or uses
Latitude/Longitude when present) and can be styled by the Day or Category column.

Input JSON schema:
{
  "trip": "Vermont Fall Foliage",
  "home_base": "Whitby, ON, Canada",          # optional; used as route origin
  "places": [
    {
      "name": "Stowe Village",                  # required
      "address": "Main St, Stowe, VT 05672",    # required if no lat/lng
      "lat": 44.4654, "lng": -72.6874,          # optional
      "day": 1,                                  # optional (groups + colors)
      "category": "must-see",                    # optional
      "description": "Covered bridges, shops",   # optional
      "time_needed": "2-3 hrs",                  # optional
      "cost": "Free"                             # optional
    }
  ]
}

Usage:
  make_maps.py <places.json>
  make_maps.py <places.json> --outdir /path/to/output
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path
from urllib.parse import quote

CSV_COLUMNS = [
    "Name",
    "Address",
    "Latitude",
    "Longitude",
    "Day",
    "Category",
    "Description",
    "TimeNeeded",
    "Cost",
    "GoogleMapsLink",
]


def place_query(place: dict) -> str:
    """Best free-text query for a place: name + address, or raw coords."""
    name = str(place.get("name", "")).strip()
    address = str(place.get("address", "")).strip()
    if name and address:
        return f"{name}, {address}"
    if name:
        return name
    if address:
        return address
    lat, lng = place.get("lat"), place.get("lng")
    if lat is not None and lng is not None:
        return f"{lat},{lng}"
    return ""


def search_link(place: dict) -> str:
    """Clickable Google Maps pin for a single place."""
    query = place_query(place)
    return f"https://www.google.com/maps/search/?api=1&query={quote(query)}" if query else ""


def route_link(places: list[dict], origin: str | None) -> str:
    """Driving-directions link chaining an ordered list of places.

    Google Maps dir URL: origin -> waypoints (in order) -> destination.
    """
    stops = [place_query(p) for p in places if place_query(p)]
    if not stops:
        return ""
    if origin:
        sequence = [origin] + stops
    else:
        sequence = stops
    if len(sequence) == 1:
        return search_link({"name": sequence[0]})
    origin_q = quote(sequence[0])
    dest_q = quote(sequence[-1])
    middle = sequence[1:-1]
    url = (
        "https://www.google.com/maps/dir/?api=1"
        f"&origin={origin_q}&destination={dest_q}&travelmode=driving"
    )
    if middle:
        url += "&waypoints=" + quote("|".join(middle))
    return url


def write_csv(places: list[dict], out_path: Path) -> None:
    with out_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
        writer.writeheader()
        for p in places:
            writer.writerow(
                {
                    "Name": p.get("name", ""),
                    "Address": p.get("address", ""),
                    "Latitude": p.get("lat", ""),
                    "Longitude": p.get("lng", ""),
                    "Day": p.get("day", ""),
                    "Category": p.get("category", ""),
                    "Description": p.get("description", ""),
                    "TimeNeeded": p.get("time_needed", ""),
                    "Cost": p.get("cost", ""),
                    "GoogleMapsLink": search_link(p),
                }
            )


def group_by_day(places: list[dict]) -> dict:
    """Preserve first-seen day order; places without a day go under 'Unscheduled'."""
    groups: dict = {}
    for p in places:
        key = p.get("day", "Unscheduled")
        groups.setdefault(key, []).append(p)
    return groups


def write_links(places: list[dict], home_base: str | None, trip: str, out_path: Path) -> None:
    lines: list[str] = [f"# {trip} — Map Links", ""]

    groups = group_by_day(places)
    for day, day_places in groups.items():
        header = f"Day {day}" if isinstance(day, int) or str(day).isdigit() else str(day)
        lines.append(f"## {header}")
        lines.append("")
        route = route_link(day_places, home_base)
        if route:
            origin_note = " (from home base)" if home_base else ""
            lines.append(f"**Driving route{origin_note}:** [Open in Google Maps]({route})")
            lines.append("")
        for p in day_places:
            link = search_link(p)
            name = p.get("name", "Unnamed")
            cost = f" — {p['cost']}" if p.get("cost") else ""
            time_needed = f" ({p['time_needed']})" if p.get("time_needed") else ""
            if link:
                lines.append(f"- [{name}]({link}){time_needed}{cost}")
            else:
                lines.append(f"- {name}{time_needed}{cost}")
        lines.append("")

    out_path.write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Build Google Maps CSV + links from a places JSON.")
    parser.add_argument("places_json", help="Path to the places JSON file")
    parser.add_argument("--outdir", help="Output directory (defaults to the JSON file's folder)")
    args = parser.parse_args()

    src = Path(args.places_json)
    if not src.exists():
        print(f"error: {src} not found", file=sys.stderr)
        return 1

    try:
        data = json.loads(src.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        print(f"error: invalid JSON in {src}: {exc}", file=sys.stderr)
        return 1

    places = data.get("places", [])
    if not places:
        print("error: no places found in JSON ('places' is empty)", file=sys.stderr)
        return 1

    trip = data.get("trip", src.stem)
    home_base = data.get("home_base")

    outdir = Path(args.outdir) if args.outdir else src.parent
    outdir.mkdir(parents=True, exist_ok=True)
    csv_path = outdir / f"{src.stem}-mymaps.csv"
    links_path = outdir / f"{src.stem}-map-links.md"

    write_csv(places, csv_path)
    write_links(places, home_base, trip, links_path)

    print(f"Wrote {csv_path} ({len(places)} places)")
    print(f"Wrote {links_path}")
    print("\nImport the CSV into Google My Maps: New map -> Import -> select CSV ->")
    print("position from Address (or Latitude/Longitude) -> title from Name ->")
    print("'Style by data column' -> Day to color-code each day.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
