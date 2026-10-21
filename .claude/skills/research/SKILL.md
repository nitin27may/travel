---
name: research
description: Research or refresh facts in ~/workspace/travel for a place, trail, route, activity offer or event, to the capture contract - per-type checklist, raw capture in research/inbox, capture/1 records with suitability and relevance sidecars, validators, gap report and run record. Use to fill a trip's gaps, refresh stale prices or hours, find photos, check links, or research one thing outside a full trip plan.
---

# Research: facts to the capture contract

Not this skill: a whole trip (`trip`); remembering a place (`location`). Everything here is data; no HTML.

## Steps
1. Read `research/README.md` 1-2 and the recipe for the job: 3c gaps, 3d refresh, 3e photos.
2. What the type needs: `node core/bin/capture.ts fields --type <id>`, then the kind profile and lane contract (`research/README.md` 4).
3. Raw captures to `research/inbox/`; records and sidecars to the paths in `research/formats/README.md`.
4. Validate: `research/README.md` 6. Gaps, conflicts and the run record: section 7.
5. Merge: section 8.

## Rules that hold even if you read nothing else
Full text: `research/README.md` 9.
- No coordinate from Google; every point has a `point_source`.
- Never invent a URL; record `searched_none` with the query and date.
- Age, height and weight limits only from official or operator sources.
- Conflicts are recorded with both values, never picked.
- Overpass, Nominatim and Commons: one runner for the machine, never parallel agents.
- AllTrails, Google and Tripadvisor are links only, never a stored value.
- Nothing in the Obsidian vault; no household data in any public field.

## Who runs what
`travel-researcher` (Opus) for judgement; Sonnet to fill a clear contract; Haiku for link checks and photo finding. Scripts by real path: `research/tools.md`.
