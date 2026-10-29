# Run dg2f-2026-10-28-ledger-points: the four held trailheads stored, the plan model joined to the stops' own records

Follow-up to DG-02 ([dg2-2026-10-28-stop-points.md](dg2-2026-10-28-stop-points.md),
[../reports/stop-points-2026-10-28.md](../reports/stop-points-2026-10-28.md)). Agent: travel-builder, model Opus. No network request:
every point below was researched in DG-02 (Overpass, one at a time) and is stored here as it was read.

## The ledger exception (owner decision, delegated 28 Oct 2026)

A pinned point of `data/capture/migration-ledger.json` that is a derivation (`trailhead "X" at <ref>`, the destination's centre) may be
replaced by the record's own researched OpenStreetMap point. Points only; no suitability or relevance leaf is excepted. The tool is
`node core/bin/capture.ts ledger-point` (core/src/capture/ledgerPoints.ts); each replacement is logged in the ledger's `replaced` list with
the pinned value, the derivation it was, the OSM element, the date and the reason, and `core/test/capture/migration.test.ts` checks every
entry against both points files. The refusals are tested: a pin that is a fact (Athabasca Falls, `Q739181 P625`), a ref with no capture
row (Miette Mine Trail), a row that is not OSM or is approximate, a missing reason.

RECORDED legacy/canadian-rockies-sept-2029/trails/iceline-trail data/capture/points.json 2026-10-28: OSM node 2368078636 (was the derived Takakkaw Falls parking point).

RECORDED legacy/canadian-rockies-sept-2029/trails/emerald-lakeshore data/capture/points.json 2026-10-28: OSM node 269747928 (was the Emerald Lake centre).

RECORDED legacy/canadian-rockies-sept-2029/trails/lake-louise-lakeshore data/capture/points.json 2026-10-28: OSM node 269752723 (was the Lake Louise centre).

RECORDED legacy/canadian-rockies-sept-2029/trails/moraine-lakeshore data/capture/points.json 2026-10-28: OSM node 269752450 (was the Moraine Lake centre).

Each row: `point_role: trailhead`, `coord_src: osm`, provider OpenStreetMap, ODbL 1.0, agent checked, `meta.run_id` the DG-02 run that read
it. Derived files rebuilt: `relevance.ts points --build` (these four rows only), `capture.ts derive-near --write` (near_town_km on three
records of `canadian-rockies-2029/migrated.json`), `derive-area --write` (the ledger `derived-areas.json` only; no area_id changed).

The four place pages do not draw the new pins: `web/lib/public/join-deferred.json` holds them back for S13 (the median is already over,
DG-11), so no place page grew (all 439 place pages are byte-identical to main's build). The plan model reads them through the record.

## Not done

GAP: `legacy/canadian-rockies-sept-2029/trails/jasper-miette-mine-trail`: OSM node 2383706255 (53.203884, -117.926217) waits for the data
lane: storing it needs `tools/towns.py build`, which downloads a GeoNames dump and re-dates `near_town` in 22 capture files. Then
`capture.ts ledger-point --ref <it> --reason ...` takes the same exception (its pin is the derived Miette Hot Springs point).

Map data from OpenStreetMap, © OpenStreetMap contributors, ODbL 1.0.
