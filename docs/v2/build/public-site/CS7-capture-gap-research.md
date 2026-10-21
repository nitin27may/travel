# CS7: capture contract step 7, gap-filling research

Stage 3, data only. It runs in parallel with every build lane (L3c, L4b, L3b, L2b, S1) because it writes only under `data/` and research docs that no build lane owns. It merges in three batches.
- **Agent:** `travel-researcher` (Opus). It may split into per-trip sub-lanes for page reads (disjoint files by trip); every Overpass, Commons, Wikidata and Nominatim call stays with **one runner** for the whole machine (see "Shared services").
- **Effort:** about 18 hours:
  - batch 1, the research backlog, placement review, attraction flags, lakes, 8 h
  - batch 2, hours, prices, booking windows, toilets and parking on the public trips' days, 8 h
  - batch 3, the facets L3b's coverage rule hides, 2 h
- **Backlog:** capture-contract step 7 (3a.12), contract 10.5 step 1, owner Q22 to Q24 (answered by "go with your recommendations" or still open; see "Owner questions"), and L8 for the public trips.
- **Specs:**
  - [research/backlog.md](../../../../research/backlog.md): the places and relations the migration could not create. **Work through it first.**
  - [research/capture-contract.md](../../../../research/method/capture-contract.md) 2.5 and 2.7 (relations and layers, which facts live where), 3 (the base contract and the per-type deltas), 9 (crawler and scraper rules, provenance per value, the run record), 10.3 and 10.5 (the missing properties and the order).
  - [research/suitability.md](../../../../research/method/suitability.md) 3 (provenance and honesty) and [suitability-applicability.md](../../../../research/method/suitability-applicability.md) 8 (lane instructions); [research/relevance.md](../../../../research/method/relevance.md) 3.7, 5 and 8.2 (relevance for new payoff places).
  - [research/sources-and-licences.md](../../../../research/method/sources-and-licences.md); the capture contract 9.3 User-Agent rule replaces its "contact" wording.
  - Principles T1 (when is part of every answer), T3 (trust shows its age), T4, T5 and P8 in reverse (we do not bulk-copy others).

## Goal

Make the public trips' place, route and offer records usable under the contract, so S1's pages show values where research can find them and honest gaps where it cannot.

1. **The research backlog:** every row of backlog.md becomes records and relations: Sulphur Mountain's summit, Sanson's Peak and the summit boardwalk; the Tre Cime north-face viewpoint, the mountain, Rifugio Auronzo, Lavaredo and Locatelli with their lodging offers, the Auronzo toll road and its toll; the Moraine Rockpile, its walk, the shuttle stop and the shuttle seat; Sentinel Pass and the Larch Valley meadows; the Kicking Horse put-ins, take-outs and river sections; the Aiguille du Midi terraces and Step into the Void; Johnston Canyon's Lower and Upper Falls and the Ink Pots. Niagara waits: its trip is private and has no days.
2. **The 26 payoff places** get `point` (OSM or Wikidata P625), `area_id`, `summary`, `links` and `photos`.
3. **The 52-item placement review** in `data/capture/placement.json` (`review`): for each fact left on a route, decide from the source whether it belongs to the route, the payoff place or the trailhead, and move it or confirm it, with the reason.
4. **`route_is_attraction` on the flagged routes** (52 per the migration report): keep the flag when the route is itself the experience (a circuit, a scenic drive, a ride), or create the payoff place and move the draw to it (relevance 3.7). Each decision keeps or rewrites `attraction_reason`.
5. **Lakes: parking and kids data.** For the 21 lake records: access points with point, name, fee, fill time and `walk_m`; and for kids, `age_band`, stroller, the swimming facts (lifeguard, water temperature band, entry), toilets and change rooms where they apply.
6. **Hours, prices, booking windows, toilets and parking** for the records on the public trips' days, in the Q23 order: Patagonia, the Rockies days, the Dolomites, Iceland, then Chamonix. Prices carry their currency and year; booking windows are rules, never dates.
7. **Every fact has a source registry entry:** every new source row reaches `data/sources/registry.json` through `sources.ts build`, with its terms note and `automated` flag.

## Read first

- backlog.md, then contract 2.5, 2.7, 3, 9 and 10, then the lane instructions in applicability 8 and relevance 8.2.
- `data/capture/README.md`, `data/capture/<trip>/migrated.json`, `data/capture/placement.json` (`review`, `route_is_attraction`, `draw_moves`), `data/capture/operators.json`, `data/capture/type-map.json`.
- `node core/bin/capture.ts fields --type <id>` (the checklist for a type), `fields --ref <ref>` (what a record still lacks), `explain <type>`, `gaps --trip <trip>`, `run --check <file>`.
- `data/suitability/README.md`, `data/relevance/README.md`, `data/relevance/inputs/points.json`, `data/sources/registry.json`, `core/bin/sources.ts` (`build`, `who`, `due`, `check`, `links`).
- [research/operator-questions-2026-10-18.md](../../../../research/method/operator-questions-2026-10-18.md): add to it; never contact anyone.
- [README.md](README.md) 8 and the repo `CLAUDE.md` gotchas on Commons (the 429 of 12 Oct 2026).

## Files you own

| Area | Paths |
|---|---|
| Capture records | `data/capture/<trip>/CS7.json` (new records: the backlog places, payoff places, huts, stops, sections), values added in place to existing records in `data/capture/<trip>/migrated.json` (one record per ref across files: `E_CAP_DUP_REF`), `data/capture/placement.json` (`review` resolved into `applied`, `route_is_attraction` decisions), `data/capture/operators.json` (append), `data/capture/runs/**` (one run record per API run) |
| Suitability | values added in place to the existing record's lane file under `data/suitability/<trip>/` (a lane file supersedes `migrated.json` for a ref, so never add a second record for a ref); new records for new refs in `data/suitability/<trip>/CS7.json`; `data/suitability/scope.json` when the scope test regenerates it |
| Relevance | records for the new payoff places in `data/relevance/<trip>/CS7.json`, edits in place to moved draws, `data/relevance/inputs/points.json` (append), `data/relevance/derived/**` (regenerated by `relevance.ts derive`, never hand-edited) |
| Sources | `data/sources/registry.json` and `links.json` (regenerated by `sources.ts build` and `links`) |
| Research docs | `research/runs/CS7-<trip>.md` (new: what was read, decisions, gaps), `research/backlog.md` (mark rows done with the commit), `research/method/operator-questions-2026-10-18.md` (append) |

## Do not touch

- **L3c** (building now in `v2-L3c`; everything it owns): `core/src/schedule/**`, `core/test/schedule/**`, `core/test/fixtures/schedule/**`, `core/bin/schedule.ts`, `data/schedules/**`, `web/scripts/legs-ors.mjs`, and every `web/` path in its brief.
- **L4b:** `data/tracks/**`, `web/scripts/tracks-osm.mjs`. An OSM relation id you find for a trail goes into the capture record's `links.osm` (yours) and into the hand-back, so L4b's next fetch picks it up.
- **L3b:** `data/vocab/tags.json`, `core/src/capture/bands.ts`, `core/src/derive/**`, `core/src/suitability/derive.ts`.
- **L2b:** `data/reference/globe/**`, `web/public/globe/**`, `tools/globe_data.py`.
- **S1:** nothing of S1's is under `data/`; do not edit `web/**` at all.
- `data/vocab/types.json`, `data/vocab/relevance-classes.json`, `core/src/schema/**`: a new type, class or property is a planner and builder change. Propose it in `CS7-<trip>.md` with the record that needs it, and store the record under the nearest existing type with a note.
- Generated files: `data/schema/**`, `research/types/**`, `data/schema/suitability-applicability.json`.
- `data/locations/locations.json` and `research/inbox/`: the household's store; not part of this lane.
- `legacy/`, `prototype/`: read only.

## Shared services (one runner each, across every agent on the machine)

| Service | Rule |
|---|---|
| Overpass (OSM) | sequential, one request at a time, at least 1 s apart, cached outside git with the read date; wrap each run in `flock /tmp/travel-overpass.lock` (L4b and L2b use the same lock); at most 200 requests a run; obey `Retry-After`; stop after the second 429 |
| Wikimedia Commons | one runner, a couple of seconds between requests, inside `flock /tmp/travel-commons.lock` (L2b's credit fetch uses it too); never from parallel sub-agents; the 25-minute 429 of 12 Oct 2026 is why |
| Wikidata | by QID, one request a second, inside `flock /tmp/travel-wikidata.lock` |
| Nominatim | one request a second, single runner, only when OSM and Wikidata have no point |
| User-Agent for every API call | `travel-relevance-signals/1.0 (+https://nks-travel.pages.dev/about/)`: the project and the public site, **never an email** |

## Never

- **AllTrails, Komoot, Gaia, Outdooractive, Wikiloc, Trailforks, FATMAP, Strava:** link only (`found_in_search` with the search date); never fetched, never a source of a stat, a review, a photo or a line.
- **Google** (Maps, Places, search result pages, Street View), **Apple and Bing maps:** never a source of any stored value. **No coordinate from Google.** A coordinate of unknown origin counts as Google-derived and is not stored.
- **Tripadvisor, Yelp, Booking.com, Expedia, Airbnb, resellers** (GetYourGuide, Viator): link only; a limit a reseller states is kept as a conflict, never as the chosen value; no ratings, review text, counts, ranks or prices.
- **Automated crawling of operator or agency pages:** until Q24 is answered, every page is a one-page `read` by you. Open-data APIs (Wikidata, Overpass, Commons, NPS, Parks Canada open data) are `api` with a run record.
- **Household data:** no traveller names or ages, no home town, no personal status, no booking codes. Public trips are dateless: a booking window is a rule ("opens 5 days ahead at 07:00"), and `applies_to` holds the season year the fact describes ("2026 data used as a pattern", T3).

## Steps

### Batch 1. Backlog, placement, attraction flags, lakes (merges before S1 Part B's shots)

1. **Before you start**, record `capture.ts gaps --trip <trip>` for the five public trips with days; the hand-back compares against it.
2. **Backlog rows** (backlog.md), one at a time:
   - pick the type with `capture.ts explain`, and fill what `capture.ts fields --type <id>` asks for, R first;
   - give each new record a `part/<parent ref>#<slug>` or `offer/<parent ref>#<product>` ref and store it in `data/capture/<trip>/CS7.json`;
   - store the relations (`reaches`, `passes`, `starts_at`, `part_of`, `at`, `on`) on the record that holds them; `reached_by` is derived and never stored;
   - a point comes from OSM (node or way centroid) or Wikidata P625, with `point_source` naming it; append it to `points.json`.
3. **The 26 payoff places:** point, `area_id`, `summary` (one line, our words), the official link and the link checklist for its type, and up to 3 photos from Commons with author, licence and source (Commons runner only).
4. **Placement review:** for each of the 52 `review` items, read the source the fact came from. Move the fact to the place it describes (the trailhead's toilets to the trailhead or parking record, a lake fact to the lake) or confirm it on the route with the reason; record the decision in `placement.json`. Never move a limit from an offer to a place (contract 12: offer fallback is one-way).
5. **`route_is_attraction`:** for each flagged route, keep the flag with a sharpened `attraction_reason`, or create the payoff place and move the draw to it (a relevance record on the place, the route's record removed, `draw_from` derived). The Tre Cime loop keeps its flag and gains the mountain and the viewpoint (backlog row 2).
6. **Lakes:** access points with fee and fill time (official parking pages, park agencies; OSM for the lot point), `walk_m` from lot to shore, `age_band` with our reason, stroller with extent, the swimming facts, toilets and change rooms.
7. **Relevance for every new place:** the relevance.md 8.2 instructions (QID confirmed by coordinates and description, class, draw with evidence, standing with scope, distinction, easy payoff, weather, designations with scope, `why`). Then `relevance.ts derive`.

### Batch 2. Hours, prices, windows, toilets, parking (public trips' days, Q23 order)

8. For each record on a public trip's day, in the order Patagonia, the Rockies days, the Dolomites, Iceland, Chamonix: structured hours (with last entry and last down), operating season as rows, prices with currency and year, booking windows as rules (release lead time, time of day, channel, walk-up, refund), toilets and parking. Use the contract's source tiers (9.1): the operator or land manager first, then the tourism board, then dated community reports (two for a pattern, in our words).
9. **A value you cannot find** is `searched_none` with every source you tried and the read date, or a question added to the operator questions file. Never fill a gap with an estimate unless the property allows `our_inference`, and then with the method in `note`.

### Batch 3. The facets L3b hides (after L3b's hand-back)

10. L3b's hand-back lists every facet its coverage rule hides (under 60% answered in scope). Fill the cheapest of those first, for the public trips' records only, so the facets appear (contract 12: "facet thresholds move with data").

### For every value, in every batch

- The source row: `{id, url, title, publisher, kind, read, method, run}`; `method` is `read`, `api` or `computed`; `run` for API runs.
- `quote`: the exact short phrase the value came from, at most 300 characters.
- `basis`: whose statement it is (`operator_rule`, `operator_info`, `official_rule`, `official_grade`, `official_info`, `community`, `our_inference`). A recommendation is never a rule.
- `applies_to`: the season year the fact describes.
- Hard limits, prices, windows and closures are listed in the hand-back for the verifier's sample; a value that contradicts a stated value is kept as a conflict, never overwritten.
- Each API run writes `data/capture/runs/<run-id>.json` (`capture-run/1`) with hosts, request counts, robots and terms status and per-field outcomes (`filled`, `searched_none`, `gap`, `blocked`, `conflict`).
- After each trip: `sources.ts build`, then `sources.ts check` and `sources.ts links` (the link checker).

## Acceptance checks

| # | Check | Against |
|---|---|---|
| 1 | Every row of backlog.md is done (records and relations stored) or marked with why it cannot be (no source found, private trip) | backlog |
| 2 | All 52 placement `review` items are resolved, each with a reason | placement |
| 3 | Every flagged route either keeps `route_is_attraction` with a reason that names the experience, or its draw sits on a payoff place it `reaches` | relevance 3.7 |
| 4 | Every lake record has access points (or `searched_none` with sources), `age_band` and stroller answered | goal 5 |
| 5 | `capture.ts gaps` per public trip shows R properties answered up from the start figures, for hours, prices, windows and toilets on the plan's days | contract 10.5 |
| 6 | Every new value has a source row, a quote, a basis and a read date; every source is in `registry.json` with its terms note; `sources.ts check` passes; `sources.ts links` finds no broken link among the new sources | contract 9.4, 3a.7 |
| 7 | No stored value or point cites AllTrails, Komoot, Google, Tripadvisor or another link-only platform; no coordinate without an OSM, Wikidata, official or GPS source | contract 9.2, T5 |
| 8 | No household data; no calendar date in any value that reaches a public string (`DATE_TEXT` test); booking windows are rules | privacy, dateless |
| 9 | Every API run has a valid run record (`capture.ts run --check`); no Overpass or Commons request ran in parallel with another (the lock logs) | contract 9.3, 9.6 |
| 10 | `node core/bin/capture.ts build --check`, `suitability.ts check`, `relevance.ts check` and `relevance.ts derive --check` pass; `bash tools/check-all.sh` passes | check-all |
| 11 | `travel-verifier` samples 10% of the new values (at least 40) against their pages: at least 90% match, every hard limit matches, and no value comes from a forbidden source | the 3a.10 standard |
| 12 | `git diff --name-only` shows only owned paths | README 4.1 |

## Verification

```
node core/bin/capture.ts build --check --root .
node core/bin/capture.ts gaps --trip <trip>          # before and after, for each public trip with days
node core/bin/capture.ts run --check data/capture/runs/<run>.json
node core/bin/suitability.ts check --root .
node core/bin/relevance.ts check --root . && node core/bin/relevance.ts derive --check --root .
node core/bin/sources.ts build --root . && node core/bin/sources.ts check --root . && node core/bin/sources.ts links --root .
bash tools/check-all.sh   # with web/.env.local moved aside; the web build reads the new data
```

No UI, so no screenshots from this lane. S1's shots judge the pages built on this data. Then `travel-verifier` (Sonnet) runs check 11.

## Commit rules

- **Worktree:** `/home/nitin27may/workspace/travel-wt/v2-CS7`, branch `public/CS7`. No dev server.
- **Commits,** per trip and per batch, for example:
  1. `data(CS7): research backlog places and relations, <trip>`
  2. `data(CS7): placement review and attraction flags`
  3. `data(CS7): lake parking and kids data`
  4. `data(CS7): hours, prices, windows and toilets, <trip>`
  5. `docs(v2): CS7 lane notes and operator questions`
- Stage with `git -C <worktree> add <owned paths>`, never `-A`.
- End each message with the Co-Authored-By trailer your harness gives.
- Rebase onto the latest v2 branch before each batch hand-back. Do not push.
- **Merge order:** data only, so each batch merges when its checks and the verifier's sample pass. **Batch 1 merges before S1 Part B takes its final shots.** Batches change counts that build-lane tests may read: no build lane pins a count of today's data, and a lane that breaks on a CS7 batch rebases and fixes its test, not the data.

## Hand-back report (per batch)

Keep it short. Include:
- the commits;
- `capture.ts gaps` before and after for each trip, R properties answered;
- the backlog rows done and not done, with why;
- the placement and attraction decisions that moved a draw;
- the list of new hard limits, prices, windows and closures for the verifier's sample;
- OSM relation ids found for trails (for L4b);
- proposed new types, classes or properties (for the planner);
- the operator questions added;
- every API run, with request counts and any 429.
