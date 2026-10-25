# DATA-D4a: where the Rockies offers happen, and the plan-day offers

Run on 25 Oct 2026 by travel-researcher (Opus 5.5) in worktree `v2-DATA-D4a`, branch `public/DATA-D4a` from `main` f2dee4b.
Run record: `data/capture/runs/data-d4a-2026-10-25-rockies-offers.json`. Gap reports after:
`research/runs/DATA-D4a/after-placement.json` and `after-tier-required.json`. The before reports were byte-identical to D1's
after reports, so they are not kept twice (folder rule 7): `research/runs/DATA-D1-points/after-placement.json` and `after-tier.json`.

Method: one page read per operator where possible (31 operator and Parks Canada pages over 22 hosts, plain reads at
least 5 s apart, user agent `travel-relevance-signals/1.0 (+https://nks-travel.pages.dev/about/)`), plus one browser read
of the Jasper bike shop's booking widget (BACKLOG 3.61f asks for a browser). No Wikidata, Commons or Nominatim call. Two
Overpass requests under `/tmp/travel-overpass.lock` (`flock` was already installed at `/opt/homebrew/bin/flock`): both
failed (overpass-api.de timed out at 90 s, the private.coffee mirror answered 502), so no new points. No values from
AllTrails, Google, Tripadvisor or Komoot. No household data.

## Counts

| Measure | Before | After |
|---|---|---|
| `E_PLACE_ORPHAN` (offers that say nowhere) | 17 | 7 |
| `W_TIER_REQUIRED` records | 385 | 384 |
| `W_TIER_REQUIRED.keys` | 3,875 | 3,804 |
| Rockies offers with any required key missing (keys) | 34 (584) | 33 (501) |
| Offer row of the 6.4 matrix, 49 offers: where | 32 | 42 |
| operator | 12 | 32 |
| season | 16 | 22 |
| price | 24 | 35 |
| window | 4 | 25 |
| official link | 25 | 37 |
| duration | 12 | 13 |
| stated minimum age | 6 | 14 |
| Offers with the required tier complete | 1 | 2 |

The gap budget is lowered in the same commit (`gaps --budget --write`). `E_PLACE_AREA`, `W_PLACE_POINT` unchanged.

## Where each of the 17 happens

| Offer | Set | Basis |
|---|---|---|
| athabasca-icewalks | `at` the Athabasca Glacier and Columbia Icefield | the walk is on the lower glacier (operator) |
| banff-horse-ride | `at` Cave and Basin | the Bow River ride passes Cave and Basin; the stables are at the end of Sundance Road (operator). Near, not the stables themselves |
| burgess-walcott | `starts_at` Takakkaw Falls | "begins near Takakkaw Falls", from the Yoho Lake trailhead lot (Parks Canada) |
| crypt-lake-shuttle | `at` Waterton Townsite | "All departures from Waterton Marina" |
| waterton-cruise | `at` Waterton Townsite | same |
| jasper-waterton-horse | `at` Jasper Townsite and Waterton Townsite | two operators in one record; the Jasper stables are on Pyramid Lake Road, 4 km north of town. Proposal: split (DECISIONS NEEDED 2) |
| jasper-wildlife-tour | `at` Jasper Townsite | pick-ups from townsite accommodation |
| lake-louise-horse | `at` Lake Louise | Brewster Lake Louise Stables, 111 Lake Louise Drive, rides to the lake head, Lake Agnes, Plain of Six Glaciers |
| radium-hot-springs | `at` Radium Hot Springs (the survivor of the CS7d duplicate pair) | Parks Canada |
| assiniboine-lodge-helicopter | `at` Lake Magog and Assiniboine core area | flights land at the lodge helipad (lodge) |

Still saying nowhere (7): no capture place exists that the offer happens at, and a new place record needs a point in
`data/capture/points.json` (D1b's file until it hands back) and, for a new record, its full required tier (a new record
errors from day one). Proposed records for the coordinator, each with its operator-stated meeting place:

| Offer | Proposed place record (type) | Meeting place as the operator states it | Area |
|---|---|---|---|
| banff-springs-spa | Fairmont Banff Springs (`stay.room.resort` or a spa place) | 405 Spray Avenue, Banff | CA/AB/banff-national-park |
| bow-river-raft | Bow Falls launch (`access.transit.boat_launch`) | "the base of Bow Falls", small lot on site, Roam route 2 | CA/AB/banff-national-park |
| burgess-mt-stephen | Yoho Visitor Centre, Field (`culture.heritage.visitor_centre`) | "in front of the Yoho National Park Visitor Centre at 7 am MDT" | none: the store has no BC region (CA/BC) yet |
| heli-flight-canmore, heli-hiking | Canmore heliport (`access.start.meeting_point`) | Alpine Helicopters, 91 Bow Valley Trail, Canmore; White Mountain heli-hikes check in at the Canmore heliport | CA/AB (region; Canmore is outside the park) |
| norquay-via-ferrata | Mount Norquay ski area (`snow.ski.ski_area.ski_resort`) | the Cliffhouse Bistro is the end point; the start is not on the routes page | CA/AB/banff-national-park |
| yamnuska-scramble | Yamnuska classroom, Canmore (`access.start.meeting_point`) | #100, 50 Lincoln Park, Canmore, 8:00 am Saturday; day 2 at a scramble the guide picks | CA/AB |

Points for these (and the meeting points of the 10 placed offers: Banff Trail Riders stables, Brewster Lake Louise
Stables, Waterton Marina, Mount Shark heliport) still need an OSM node or way: Overpass failed twice today, and D1b owns
`points.json`. The query (one request, all boxes) is `research/runs/DATA-D4a/overpass-meeting-points.overpassql`; rerun it
off-peak under the lock.

## Plan-day offers (days 1 to 15 of `data/schedules/canadian-rockies-2029.json`)

| Offer (day) | run_by | season | price | window | book_url | Notes |
|---|---|---|---|---|---|---|
| Banff Gondola ticket (1, 2) | Pursuit (set) | not set: the hours page shows only October to December | searched_none: fares load in the widget by date | anytime, sell-out unknown | not asked by the type | hours 13 Oct to 31 Dec stored; tickets non-refundable |
| Lake Minnewanka cruise (2) | Pursuit (had) | had none; gap | searched_none | none_stated | tickets page | |
| Banff Upper Hot Springs (2) | Parks Canada (set) | gap (hours and closure stored) | had | not read | not read | |
| Columbia Icefield Adventure (4) | Pursuit (set) | had (2027: 1 May to 11 Oct) | searched_none (tickets URL 404) | not set | not set | |
| Maligne Lake cruise (5) | Pursuit (had) | gap | searched_none | none_stated | tickets page | |
| Jasper SkyTram ticket (6) | Pursuit (had) | gap | searched_none | anytime (pre-book flight times) | not asked | |
| Miette Hot Springs (7) | Parks Canada (set) | gap | 19.75 adult, 17.25 youth 3-17, family 64.25, day pass 28.75 CAD | not read | | page year not printed (modified 2026-09-08) |
| Emerald Lake canoe (9) | gap: The Boathouse Trading Co. has no page we found | May to September (months) | searched_none | not asked by the type | | |
| Lake Louise canoe (10) | Fairmont (had) | none_stated (closed until summer 2027, no dates) | 180 / 160 CAD non-hotel, 110 / 100 hotel guests, per canoe, + GST | not asked; first come, first served (in the price note) | | |
| Lake Louise gondola ticket (10) | Lake Louise Ski Resort (had) | gap | searched_none | none_stated | | children under 12 with an adult (R2b has it) |
| Moraine Lake canoe (11) | Moraine Lake Lodge (set) | mid-June to mid-September (06-15 to 09-15, our reading of "mid") | 170 CAD per canoe per hour + tax | not asked; first come, first served | | dock 7:30 to 18:30 |

Not an offer record: `sunshine-gondola` (day 2) has no capture record; `jasper-dark-sky` and the Icefield Skywalk are places.
Suitability limits for the plan-day offers live in R2b (another lane's file); this batch did not touch them.

## Extras

- **3.61a Waterton shuttle fare:** re-read; the page gives one 35 CAD fare (3+, GST extra) under a table of marina departures
  and Crypt Landing pick-ups and never says one-way or return. Kept as stored with a note; operator question D4a-1.
  Booking: no advance reservations, in person, up to 3 days ahead (stored as `window`).
- **3.61f Jasper bike prices:** read in a browser in Vicious Cycle and Snow's booking widget (us.booking.bike.rent), for a
  1-hour rental from 26 Oct 2026 10:00: hardtail 20 CAD, kids bikes 20 CAD, electric cruiser 50 CAD; tax not shown.
  Prices appear only after a date, time and length are picked; nothing was booked.
- **3.61g batch B:** activity ages and weights for 12 off-plan offers in the new suitability lane file R9-AC; meeting points
  as above; the two-operator records (Jasper and Waterton horse: at both towns, no `run_by`; Jasper wildlife: SunDog, whose
  values the record holds, set as `run_by`); the river parts left to D1b and D4a-2.
- **RB-1 Kicking Horse put-ins:** operator question D4a-2 (same as D1b's; one reply closes both).

## DECISIONS NEEDED

1. **Capture edits went into `migrated.json`, not `AC.json`.** The brief names `data/capture/<trip>/AC.json`, but a second
   record for a ref that `migrated.json` already holds fails `E_CAP_DUP_REF`, and the contract (9.7) says post-migration
   capture records are edited in place; CS7d and META-1 did the same. Only offer records and the file's `sources` changed.
   Reversible: revert commit 1. D3a and D8-R meet the same rule; their edits to other records of the same file should merge
   line by line, but D8-R touches the same offer records (booking state, durations), so merge D4a first and rebase D8-R.
2. **Split the two-operator records?** `jasper-waterton-horse` (Jasper Riding Stables, Alpine Stables Waterton; 600 km apart,
   different limits: Jasper 6+, 113 kg; Waterton 6+, 115 kg up to 2 h, 98 kg longer, under 10 led) cannot carry one
   `run_by`. Recommendation: two records after D1b (new refs, each with its stables point). Until then: `at` both towns,
   no operator, limits only in this note.
3. **Seven offers stay orphans** until their places can be created (table above). Recommendation: the coordinator adds the
   six place records with points after D1b hands back, and a BC region in the locations store for Field.
4. **Banff Adventures as an operator.** Its float page reads like an operator ("our rafts") but Banff Adventures is a
   booking office. `run_by` left empty pending D4a-3.
5. **The suitability lane file is `R9-AC.json`, not `AC.json`.** `core/test/suitability/kind-map.test.ts` allows only
   `R<n>*.json` beside the migration output, so `AC.json` failed check-all. Renamed (reversible with `git mv`); D3a (`TF`)
   and D8-R (`OV`) will meet the same test. Either the test learns the DATA lane names or the briefs say `R<n>-<lane>`.

6. **Five offer pages fold into their place pages.** The public adapter shows an offer `at` a place that has a page on that
   page (`web/lib/public/seeds.ts`, pass 2), so placing these offers removes five pages: `athabasca-glacier-guided-ice-walk`
   (now under the Athabasca Glacier), `banff-horseback-rides` (under Cave and Basin), `brewster-stables-lake-louise-horseback`
   (under Lake Louise), `radium-hot-springs-pools` (under Radium Hot Springs, its CS7d duplicate) and
   `mount-assiniboine-helicopter-access` (under Lake Magog). That is the built rule and what "where it happens" asks for, but
   it moves public URLs, and slugs are the coordinator's (`data/catalogue/slugs.json` is never edited by a batch). The
   least clear fold is Banff horseback under Cave and Basin (the ride passes it; the stables are at the end of Sundance Road);
   revert that one `at` if the owner prefers the page.

## Coordinator steps at merge (check-all fails on the branch until these run)

1. `node core/bin/sources.ts build` (30 + 11 new source rows; with it, `sources.ts check` passes: 419 sources, 0 errors, checked
   in the worktree and restored).
2. `node core/bin/slugs.ts merge` for the five refs of decision 6 into their place refs, then `node core/bin/slugs.ts --check`.
3. `pnpm --dir web snapshot` (only `web/redirects.json` is stale) and the suitability scope test, which rewrites
   `data/suitability/scope.json` (the five slugs leave the scope list).
4. The migration count test (below) for a builder.

Check-all on the branch, 25 Oct: python tests, locations, core typecheck, MCP, ops, schema, capture contract, gap budget,
towns, near-town, validate (63 files, 0 errors), vocabulary, suitability (0 errors), relevance and derive, hard-code scan,
folder contract, OpenAPI pass. Core tests: 3 of 2,019 fail, all named here (operator and `run_by` counts, registry drift
before step 1; the lane-name test passed after the rename). Stopped stages: suitability scope, snapshot and slugs (steps 2
and 3). The web typecheck, lint, build, tests and server stage did not run (check-all stops at the first failure; this
batch changes no web code). `web/.env.local` does not exist in this worktree, so nothing was moved aside.

## Requests for builders

- `core/test/capture/migration.test.ts` pins the operators at 10 and the records with `run_by` at 12. This batch adds 13
  operators and 23 `run_by`, so that one test fails (`check-all` fails on it). CLAUDE.md says the count tests cover
  `migrated.json` only; the fix is to count the operators and `run_by` the migration wrote (by `derived_from` file or a
  pinned list), not every one. Every other capture test passes (182 of 183).
- `duration_min`, `activity_min` and `book_url` have no home in `core/src/schema/capture/properties.ts`, so the engine
  always reports them missing even when a record holds them (Icewalks has `duration_min` and still lists it). They are
  about a third of the offer keys still open.
- `book_url` is marked N on ticket offers (gondolas, spa) and `window` N on canoe rentals, so "book ahead" and "first come,
  first served" cannot be stored where a visitor needs them (W_CAP_NA_FIELD). Contract 3.7.2 already proposes `window` R?
  `bookable` on rentals.
- The horse profile has no height field; Brewster states a 132 cm minimum.

## Unverified

- The Jasper bike prices were read once in a browser and are not in the page cache; they are for an October 2026 date.
- Pursuit fares (gondola, SkyTram, cruises, Icefield) were not read: they need a date in the booking widget, and a date in
  2026 says little about September 2029.
- Season years: Norquay and Miette print no year (read October 2026, stored as 2026); Icewalks, Icefield and Assiniboine
  print 2027.
- The new `src` rows resolve: `sources.ts build` then `check` passed (419 sources, 0 errors) in the worktree, and the
  registry was restored, because the coordinator rebuilds it at merge. Until then `sources.ts check` reports drift.

## Sample check

14 values drawn with seed 2510 from the 41 values with a quote read today; each quote was looked up in the cached text of its
page: 14 of 14 found, and each value matches its quote (ages, weights, a 170 CAD canoe, the Walcott and Mount Stephen
reservation rules, the Assiniboine 2027 season, booking links).

## Integration (25 Oct 2026, `public/DATA-INT2`)

Merged before D3a, then main's D1b (gap budget kept at the lower counts: orphans 7, points 1). Coordinator steps run: source registry rebuilt, scope list regenerated, snapshot rewritten. The five folded pages are accepted (owner ruling 4); the Jasper and Waterton horse split stays a note. `slugs.ts merge` was run for the five keys but `slugs.ts --check` still failed, because the dataset builder drops a folded offer's key; the five keys are `withdraw`n instead (slugs reserved, answer not found, no 308). Follow-up for a builder: have the builder report a folded offer as a merged record so the old URL redirects. The Radium pools 301 in `web/redirects.json` went with it. `core/test/capture/migration.test.ts` now pins 23 operators (the 10 the migration wrote must be present) and 32 offers with `run_by` in `migrated.json`.
