---
name: travel-repo-on-github
description: ~/workspace/travel is a git repo pushed to private github.com/nitin27may/travel (since 2026-10-16); .site/ is ignored
metadata:
  node_type: memory
  type: project
  originSessionId: 714f2667-d381-5eea-95c1-8887ada73bc1
  modified: 2026-10-16T20:02:10.189Z
---

`~/workspace/travel` was not a repo until 2026-10-16. Now `main` tracks the private `nitin27may/travel` on GitHub, with the repo-local `trip-planner` skill at `.claude/skills/trip-planner/`. `.site/`, `__pycache__`, `*-candidates.json`, `links-report.txt` and `_system/gallery.html` are gitignored.

Folder contract since 2026-10-16 (P0 of `AUDIT-2026-10-16.md`): `research/<lane>.md`, `gallery/gallery.json`, `assets/` (the only non-index files publish.sh ships), `archive/` (never published). P1 done the same day: `locations/locations.json` (63 places, 4 collections) + generated `WISHLIST.md`, tool `_system/tools/locations.py`, skill `location`, hook in `.claude/settings.json`, tests in `_system/tests`. **The Obsidian `Location.md` (both copies) is a bare pointer; never add places there. Nitin wants everything location-related in travel/locations/ (renamed from destinations/ on 2026-10-16), including PRIORITIES.md.** Resolver gotchas: same-named places (Page AU, Mont-Sainte-Anne in the Laurentians, L'Éperon in Lanaudière) need the country claim and a plausibility look at coordinates; a DNS blip once failed 47 lookups, so `_get` retries. Roadmap P2-P5 remains in the audit.

**Why:** Nitin pulls on other machines ([[push-after-each-logical-block]]).

**How to apply:** commit and push after each trip change. Not in the repo: `~/.claude/plans/no-just-let-s-create-purring-kettle.md` (referenced in CLAUDE.md, file is missing on this machine) and the user-level skills in `~/.claude/skills`. The Obsidian `Location.md` bucket list lives in `~/workspace/notes`, a different repo. See [[patagonia-feb-mar-2027-trip]].

**2026-10-17, schema v2 + list page + G5 (plan `_system/site/PLAN-locations-g5.md`, Opus-planned, Sonnet-coded in phases A1, A2, B1, C1, C2):** `locations/locations.json` is schema_version 2 with ten flat tables (countries, regions, areas, places, tags, place_tags, sources, visits, collections, collection_places), SQLite-proven by a test; one row per line. `locations.py` gained `edit`, `visit add`, `tag alias|list`, `build [--check]`, `layout split|single` (split only above 300 places). `location_views.py` generates WISHLIST.md, `locations/index.html` (the grid/list page) and `globe/assets/data/places.json` deterministically; `publish.sh` runs `build` first and has `PUBLISH_DRY_RUN=1`. Public fields are an allow-list (first line of notes, http(s) links only). Never hand-edit the generated pages. Decision: JSON in git stays the system of record; SQLite/D1 only when phone capture is wanted.

> Note 2026-10-21 (CLN-7): the `trip-planner` skill was retired; skills are now `trip`, `research`, `location` in `.claude/skills/`. The old skill is kept at tag `archive/trip-planner-skill-2026-10-21`.
