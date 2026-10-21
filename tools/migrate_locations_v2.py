#!/usr/bin/env python3
"""Migrate data/locations/locations.json from schema v1 to v2 (and on to v3: it chains migrate_locations_v3).

    python3 tools/migrate_locations_v2.py --check   # print a summary, write nothing
    python3 tools/migrate_locations_v2.py           # rewrite the store in place

`migrate(v1)` is a pure function. Running on a v2 store prints "already v2" and exits 0.
Field-by-field rules are in docs/archive/v1/PLAN-locations-g5.md section 1.4.
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import locations as L  # noqa: E402


def _most_common(names: list[str]) -> str:
    return Counter(names).most_common(1)[0][0]


def migrate(v1: dict, a3: dict[str, str] | None = None, log: list[str] | None = None) -> dict:
    """Pure: v1 store dict in, v2 store dict out. Conflicting names are reported through `log`."""
    log = log if log is not None else []
    a3 = a3 if a3 is not None else L.load_a3()
    places_in = sorted(v1.get("places", []), key=lambda p: p["id"])

    v2 = {"schema_version": 2, "updated": v1["updated"], "layout": "single"}
    for t in L.TABLES:
        v2[t] = []

    # geography
    country_names = dict(v1.get("countries", {}))
    for p in places_in:
        country_names.setdefault(p["country"], p["country_name"])
    for code in sorted(country_names):
        v2["countries"].append({"code": code, "a3": a3.get(code), "name": country_names[code]})
    region_names: dict[str, list[str]] = {}
    area_names: dict[str, list[str]] = {}
    for p in places_in:
        rid = f"{p['country']}/{p['region']}"
        region_names.setdefault(rid, []).append(p["region_name"])
        area_names.setdefault(f"{rid}/{p['area']}", []).append(p["area_name"])
    for rid in sorted(region_names):
        country, code = rid.split("/", 1)
        if len(set(region_names[rid])) > 1:
            log.append(f"region {rid}: names {sorted(set(region_names[rid]))}, using the most common")
        v2["regions"].append({"id": rid, "country": country, "code": code, "name": _most_common(region_names[rid]),
                              "iso_3166_2": L.region_iso(country, code)})
    for aid in sorted(area_names):
        rid, slug = aid.rsplit("/", 1)
        if len(set(area_names[aid])) > 1:
            log.append(f"area {aid}: names {sorted(set(area_names[aid]))}, using the most common")
        v2["areas"].append({"id": aid, "region_id": rid, "slug": slug, "name": _most_common(area_names[aid])})

    # tags vocabulary starts from the initial aliases
    L.seed_aliases(v2)

    # places, tags, place sources
    for p in places_in:
        raw_tags = list(p.get("tags") or [])
        unconfirmed = bool(p.get("location_unconfirmed")) or "location-unconfirmed" in raw_tags
        v2["places"].append({
            "id": p["id"], "area_id": f"{p['country']}/{p['region']}/{p['area']}",
            "name": p["name"], "resolved_name": p.get("resolved_name"), "kind": p["kind"], "status": p["status"],
            "trip": p.get("trip"), "lat": p.get("lat"), "lon": p.get("lon"), "elevation_m": p.get("elevation_m"),
            "location_status": "unconfirmed" if unconfirmed else "resolved", "resolver": p["resolver"],
            "wikidata": p.get("wikidata"), "image": p.get("image"),
            "season_months": L.parse_months(p.get("season")), "kid_fit": p.get("kid_fit") or "unknown",
            "stats": p.get("stats") or {}, "stats_verified": bool(p.get("verified")),
            "notes": p.get("notes") or "", "added": p["added"],
        })
        for t in L.normalize_tags(v2, raw_tags, p["kind"]):
            v2["place_tags"].append({"place_id": p["id"], "tag_id": t})
    for p in places_in:
        L.add_sources(v2, L._source_rows({"sources": [dict(s, saved=s.get("saved") or p["added"]) for s in p.get("sources", [])]}),
                      place_id=p["id"])

    # collections, in slug order, so their sources number after the place sources
    for c in sorted(v1.get("collections", []), key=lambda c: c["slug"]):
        v2["collections"].append({"id": c["slug"], "name": c["name"], "country": c.get("country"),
                                  "notes": c.get("notes") or "", "added": c["added"]})
        for n, pid in enumerate(c.get("places", []), 1):
            v2["collection_places"].append({"collection_id": c["slug"], "position": n, "place_id": pid})
        L.add_sources(v2, L._source_rows({"sources": c.get("sources", [])}, saved=c["added"]), collection_id=c["slug"])
    for t in v2["tags"]:        # a v2 tag has no `kind`; migrate_locations_v3 adds it
        t.pop("kind", None)
    return v2


def summary(v2: dict) -> str:
    return ", ".join(f"{t} {len(v2[t])}" for t in L.TABLES)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true", help="print a summary and write nothing")
    args = ap.parse_args(argv)
    if not L.PATHS.store.exists():
        print(f"no store at {L.PATHS.store}", file=sys.stderr)
        return 1
    data = json.loads(L.PATHS.store.read_text(encoding="utf-8"))
    if data.get("schema_version") in (2, L.SCHEMA_VERSION):
        print("already v2 or later (a v2 store: run tools/migrate_locations_v3.py)")
        return 0
    log: list[str] = []
    v2 = migrate(data, log=log)
    for line in log:
        print("  note: " + line)
    import migrate_locations_v3 as M3          # the store on disk is always the current schema
    v3 = M3.migrate(v2)
    errs = L.validate(v3)
    for e in errs:
        print("ERROR " + e)
    print(("would write: " if args.check else "wrote: ") + summary(v2))
    if errs:
        print(f"{len(errs)} problem(s); store not changed", file=sys.stderr)
        return 1
    if not args.check:
        L.save(v3, touch=False)
    return 0


if __name__ == "__main__":
    sys.exit(main())
