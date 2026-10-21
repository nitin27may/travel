#!/usr/bin/env python3
"""Migrate data/locations/locations.json from schema v2 to v3.

    python3 tools/migrate_locations_v3.py --check   # print what would change, write nothing
    python3 tools/migrate_locations_v3.py           # rewrite the store in place

v3 (docs/archive/v1/PLAN-platform.md 2.3A "Locations v3"):
  * the `tags` table leaves the store for data/vocab/tags.json and gains `kind`
    (style, activity, feature, audience, free);
  * `places` gains the catalog common-block columns it lacked, set to defaults
    (review_status proposed, confidence stated, licence own-words, accessibility unknown,
    contributed_by ["u_owner"], updated = the place's `added`);
  * schema_version becomes 3. Every id survives; WISHLIST headings do not change.

`migrate(v2)` is a pure function. A second run prints "already v3" and changes nothing.
"""
from __future__ import annotations

import argparse
import copy
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import locations as L  # noqa: E402

# Kind of every tag in the v2 store. Style ids come from locations.STYLE_IDS; an alias takes its
# target's kind; a tag missing here (added after this table was written) falls back to `free`.
KIND_OF: dict[str, str] = {
    # activity: something you do
    **dict.fromkeys(["boat", "camping", "cruise", "food", "ferries", "hiking", "kart", "kayaking", "paragliding",
                     "photography", "rafting", "railway", "trekking", "via-ferrata", "whale-watching", "wine",
                     "scenic-drive", "alpine-coaster", "mountain-coaster", "road-trip-stop", "permit"], "activity"),
    # feature: something you see or stand in
    **dict.fromkeys(["arches", "badlands", "bay", "beach", "canals", "canyon", "canyons", "cliffs", "coast",
                     "dark-sky", "fall-colours", "gannets", "geysers", "gorge", "gorges", "hoodoos", "hot-springs",
                     "lake", "lakes", "lavender", "lighthouse", "lighthouses", "mountain", "mountain-pass",
                     "mountains", "national-park", "rice-terraces", "rifugi", "ski-resort", "slot-canyon",
                     "spire", "stairs", "suspension-bridge", "suspension-bridges", "viewpoint", "villages",
                     "waterfall", "waterfalls", "wildlife", "wilderness", "landmark", "unesco", "views"], "feature"),
    # audience: who it suits
    "family-hike": "audience",
    # style ids (adventure, family) are assigned from locations.STYLE_IDS; the rest of the loose words are free
}


def kind_for(tid: str, alias_of: str | None, rows: dict[str, dict]) -> str:
    if alias_of and alias_of in rows:
        return kind_for(alias_of, rows[alias_of].get("alias_of"), rows)
    if tid in L.STYLE_IDS:
        return "style"
    return KIND_OF.get(tid, "free")


def migrate(v2: dict) -> dict:
    """Pure: v2 store dict in, v3 store dict out (tags still inside as data["tags"], with `kind`)."""
    if v2.get("schema_version") != 2:
        raise L.Fail(f"expected schema_version 2, got {v2.get('schema_version')!r}")
    v3 = copy.deepcopy(v2)
    v3["schema_version"] = L.SCHEMA_VERSION
    rows = {t["id"]: t for t in v3["tags"]}
    for t in v3["tags"]:
        t["kind"] = kind_for(t["id"], t.get("alias_of"), rows)
    for p in v3["places"]:
        for col, default in L.PLACE_V3_DEFAULTS.items():
            p.setdefault(col, copy.deepcopy(default))
        p["updated"] = p["added"]
    return v3


def summary(v3: dict) -> str:
    kinds: dict[str, int] = {}
    for t in v3["tags"]:
        kinds[t["kind"]] = kinds.get(t["kind"], 0) + 1
    return (f"{len(v3['places'])} places keep their ids and gain {len(L.PLACE_V3_DEFAULTS) + 1} columns; "
            f"{len(v3['tags'])} tags move to {L.PATHS.vocab.relative_to(L.PATHS.root)} ("
            + ", ".join(f"{k} {n}" for k, n in sorted(kinds.items())) + ")")


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true", help="print what would change and write nothing")
    args = ap.parse_args(argv)
    if not L.PATHS.store.exists():
        print(f"no store at {L.PATHS.store}", file=sys.stderr)
        return 1
    try:
        v2 = L.load()
    except L.Fail as ex:
        print(f"error: {ex}", file=sys.stderr)
        return 1
    if v2.get("schema_version") == L.SCHEMA_VERSION:
        print("already v3")
        return 0
    try:
        v3 = migrate(v2)
    except L.Fail as ex:
        print(f"error: {ex}", file=sys.stderr)
        return 1
    errs = L.validate(v3)
    for e in errs:
        print("ERROR " + e)
    print(("would write: " if args.check else "wrote: ") + summary(v3))
    if errs:
        print(f"{len(errs)} problem(s); store not changed", file=sys.stderr)
        return 1
    if not args.check:
        L.save(v3, touch=False)
    return 0


if __name__ == "__main__":
    sys.exit(main())
