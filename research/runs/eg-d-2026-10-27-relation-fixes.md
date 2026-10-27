# Run eg-d-2026-10-27-relation-fixes: the wrong-target relation links, the protected-area refs and the park areas

Run record: `data/capture/runs/eg-d-2026-10-27-relation-fixes.json`. Changeset (applied by this seat, which owns the lane
files): `data/capture/changesets/eg-d-2026-10-27-relation-fixes.json`. Agent: travel-researcher (Opus). Task: EG-D
([entity-graph.md](../../docs/v2/features/entity-graph.md) 11.2 and 13; review EG-R0 S3). No web request was made: every
fact used was already held in the capture files.

## Done

| Change | Records | Effect |
|---|---|---|
| `on` the Kicking Horse River place became `at` it | `offer/.../kicking-horse-family-float#wild-water`, `#hydra` | 2 `known` entries removed; each offer now answers its required `at` |
| `starts_at` the Lagazuoi lift line became `starts_at` its top station | `part/place/lagazuoi-cable-car-and-tunnels#tunnels` | 1 `known` entry removed; the route's point is now the top station, so `derive-near --write` moved `near_town_km` from 6.6 to 5.9 km |
| `starts_at` the ORPH-7 meeting place added on the 6 offers that leave from it | bow-river-raft, burgess-mt-stephen, heli-flight-canmore, heli-hiking, norquay-via-ferrata, yamnuska-scramble | the offer side of entity-graph 4.7; `at` is kept (the offer's required placement) |
| `covers_areas` the store area named after the park | beauvais-lake-pp, elk-lakes-park | both `W_PARK_AREA` cleared; 3 trails become members (graph: 11 records with a container) |
| `area_id` the park's own store area | elk-lakes-park | it had none: `derive-area` found no labelled point within 10 km; `E_PLACE_AREA` 28 to 27 (`derived-areas.json` rewritten by `derive-area --write`, a rival distance only) |

Two test assertions pinned the old wrong links and were updated with the data: `core/test/capture/placement.test.ts`
(Kicking Horse: `at`, no `on`) and `core/test/capture/migration.test.ts` (Lagazuoi tunnels start at `#top`).

## Not done, and why

- GAP: the 7 `parks_for` from a meeting place to its offer (6 meeting places, ORPH-7). `access.start.meeting_point`
  marks `parks_for` R in `data/vocab/types.json`. These places are not pinned, so removing the link makes
  `W_TIER_REQUIRED` an error. The kind profile (`research/method/kinds/trailhead.md` U5) already says a meeting point is
  answered by an offer's `starts_at`. The fix is a contract change, so this seat did not make it: mark `parks_for` `R?` on
  the meeting point, or count an incoming `starts_at` as the answer. Then delete the 7 links, empty `known`, and add
  `E_CAP_REL_TARGET` to `strict`. Until then `strict` stays `[]` and 7 `known` entries stay.
- GAP: the Larch Valley meadows variant. Facts held, with sources: Parks Canada's Banff day-hikes page (R2a `src-0001`, read
  18 Oct 2026) rates Larch Valley alone **Moderate, 4.5 km one way, 570 m gain**. No walking time for the meadow is held.
  The research note `timing-hazards.md` says "about 8 km return to the meadow", but it is our inference and marked GAP there,
  so it is not a conflict with the official figure. A new `nature.trail.hike` record is not pinned, and 25 of its 30
  required keys cannot be answered from the captures: relevance keys a route may not hold (`E_CAP_DRAW_LAYER`), geometry
  and wikidata. The tier engine does not apply the inheritance of 4.5, so `validate --all` errors on it. To land it, either
  the tier reads the primary for a variant (EG-I or a contract task), or the record waits for a research pass. The record
  to write then:
  `part/legacy/canadian-rockies-sept-2029/trails/larch-valley-sentinel-pass#larch-valley-meadows`, `nature.trail.hike`,
  `variant_of` the primary, `starts_at` `part/legacy/canadian-rockies-sept-2029/sights/moraine-lake#shuttle-stop`, `reaches`
  `part/.../larch-valley-sentinel-pass#larch-valley`. Its suitability row: `effort.source_grade` parks-canada Moderate,
  `distance_km` 9 (4.5 one way), `gain_m` 570, all `official_info` or `official_grade` from `src-0001`, and
  `adult_time_min` a gap.
- Retypes (EG-R0 S3) were tried and then reverted:
  - **lake-magog** to `water.body.lake`: its suitability row must become `lake/lake`, but `migrated-offplan.json` is pinned
    byte for byte (`suitability migrate --check`, `kind-map.test.ts`).
  - **kananaskis-lakes-day-use**: the same pin applies. Its R2a row also holds an `ext: area` block (the Kananaskis
    Conservation Pass, child trails), which is in the migration ledger, and profile `lake` refuses that block
    (`E_SUIT_EXT_KIND`).
  - **Blue Lagoon lava fields**: `types.json` has no lava-field leaf. No landform type has the `area` profile its pinned
    suitability row needs.

  The three need an owner ruling plus a code or contract change. Retyping them only in the capture file breaks
  `E_CAP_TYPE` and `migration.test.ts`.
- Five real parks with a `legacy/` or `trip/` ref (`E_CAP_REF_TOP`) have no place in the locations store. Under QG1, each
  is born there through the `location` skill, then takes `place/<slug>` as an alias. None was invented: Beauvais Lake
  Provincial Park, Castle Provincial Park, Elk Lakes Provincial Park, Top of the World Provincial Park and Goblin Valley
  State Park. The store has their areas only for Beauvais Lake and Elk Lakes.

## Counts (validate --all, before and after)

| Code | Before | After |
|---|---|---|
| `E_CAP_REL_TARGET` (all warnings, all `known`) | 10 | 7 |
| `E_CAP_REF_TOP` | 8 | 8 |
| `W_PARK_AREA` | 2 | 0 |
| `W_TIER_REQUIRED.keys` (budget) | 3664 | 3663 |
| `E_PLACE_AREA` (budget) | 28 | 27 |
| errors | 0 | 0 |

The tier count went down 2 because the Kicking Horse offers now answer `at`, and up 1 because the Lagazuoi lift line no longer
gets an access point from the tunnel route. That route never started at the line.

## Files written

`data/capture/canadian-rockies-2029/migrated.json`, `data/capture/dolomites-2027/migrated.json`,
`data/capture/changesets/eg-d-2026-10-27-relation-fixes.json` (new), `data/capture/gap-budget.json`,
`data/capture/runs/eg-d-2026-10-27-relation-fixes.json` (new), `data/capture/derived-areas.json`, `data/catalogue/graph/*` (rebuilt),
`core/test/capture/placement.test.ts` and `core/test/capture/migration.test.ts` (one assertion each), and this note.
