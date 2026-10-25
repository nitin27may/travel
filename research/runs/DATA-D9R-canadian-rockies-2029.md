# DATA-D9R: Rockies stay bases and alternatives (25 Oct 2026)

Branch `public/DATA-D9R` (worktree `v2-DATA-D9R`, from `main` f2dee4b). Model: Claude Opus 5.5 (travel-researcher), as
the brief asks. Spec: `docs/v2/features/stay-bases-and-optimisation.md` 3.2 to 3.7, 6, 9.2, 9.3, 9.5, 14. Outputs:

- `data/base-plans/canadian-rockies-2029.json` (`trip-base-plans/1`, draft alternatives and swaps)
- `research/trips/canadian-rockies-sept-2029/stay-bases.md` (public-safe prose: routing, day map, 3.5 answers, town facts
  in the 9.3 order)
- `research/runs/DATA-D9R/` (budget before, ORS evidence and day-trip totals). The `gaps --placement --json` and
  `gaps --tier required --json` reports before and after are byte-identical to `research/runs/DATA-D1-points/after-placement.json`
  (sha256 272819a5803dbb6b...) and `after-tier.json` (6e09fbe8bad81610...), so they are not stored twice (tree rule 7)

No capture records written: `BS.json` waits for STY-P, and `points.json` belongs to D1b. No `data/schedules/**`, no
`data/trips/**`, no change in web, core or tools, no `legacy/**` edit, no run record in `data/capture/runs/` (not in this batch's
owned paths; this note is the record).

## Counts before and after

| Report | Before | After |
|---|---|---|
| `gaps --placement` (8 trips, 394 records) | E_PLACE_AREA 277, E_PLACE_ORPHAN 17, W_PLACE_POINT 6, approx 41 | identical (byte-equal JSON, same sha256) |
| `gaps --tier required` | W_TIER_REQUIRED 385 records, 3,875 keys | identical (byte-equal) |
| `gaps --budget --check` | OK (same output as `DATA-D1b-points/before-budget.txt`; the identical D9R copy was removed at merge) | OK, same output, no count rose (no `--write` needed) |
| `capture.ts build --check` | OK | OK |
| `validate.ts --all` | 61 files, 0 errors, 1,575 warnings | the same |
| `locations.py validate` | ok | ok |
| `sources.ts check` | not run | 405 sources, 0 errors |

The counts do not move because this batch writes no capture record; its output is the base-plans file and the prose.

## External calls (one runner per service)

`flock` was already installed at `/opt/homebrew/bin/flock` (another agent installed it; no install needed here). Every
scripted call ran under `flock`, sequentially, with the user agent `travel-relevance-signals/1.0
(+https://nks-travel.pages.dev/about/)`.

| Service | Lock | Calls | What |
|---|---|---|---|
| Wikidata API | `/tmp/travel-wikidata.lock` | 6 searches, 2 `wbgetentities` batches (8 ids) | airports and town items, P625, P2044 with units |
| Nominatim | `/tmp/travel-nominatim.lock` | 4 searches, 1.5 s apart | Lake Louise Park and Ride, ski resort, Sunshine, Miette |
| ORS directions | `/tmp/travel-ors.lock` (new) | 65 (2.3 s apart; cache `tools/.cache/legs-ors/` in this worktree, same key as `legs-ors.mjs`; the main checkout's cache had no hit) | base, gateway, park-and-ride and day-map pairs |
| ORS matrix | `/tmp/travel-ors.lock` | 1 (20 locations) | bases against the plan-day areas |
| Alberta economic data API | none | 3, 5 s apart | CBRE ADR series (one returned empty) |
| Official and operator pages | none | about 45 page reads (WebFetch / WebSearch), never two on one host within 5 s | listed in the prose |

No Overpass, no Commons. The ORS key was copied from the main checkout's `web/.env.local` to a mode-600 file in the
session scratchpad (outside the repo), never printed, and deleted after the last ORS call.

## Hand check of the base-plans file against spec 9.5 (no validator yet)

| Rule | Result |
|---|---|
| E_BP_NIGHTS: every strategy covers nights 1 to 14 once; `nights` 14 | pass (script check: all four) |
| E_BP_DEFAULT: `as-planned`, kind `planned`, equals the plan's base per night (itinerary.json: Banff 1-2, Lake Louise 3, Jasper 4-7, Lake Louise 8-11, Kananaskis Village 12-14) | pass |
| E_BP_COUNT: 3 alternatives, 3 swaps, one swap per base | pass |
| E_BP_DAYMAP, E_BP_LOST: both day maps are permutations of days 1 to 15; plan day 1's dropped items are in `left_out` | pass (by hand against the schedule's item ids) |
| E_BP_SRC: every plus, minus, `requires` and `left_out` entry has a `src` or basis `computed` / `our_inference` with a note | pass |
| E_BP_DATE: no calendar date in any text (repo `DATE_TEXT` regex over every string) | pass; dates sit only in `researched`, `read`, `on`, `searched` |
| E_BP_PROPERTY, E_PRIVACY: no `stay.room.*` or `stay.self.*`; `privacyHits()` | pass: no hits; `HOUSEHOLD_TEXT`, `PLANNING_NOTE`, `STREET_ADDRESS` no hits |
| E_FK: base refs resolve | **fails today by design**: only Jasper has a settlement record; the other refs are proposals (`ref_status`) until STY-P and `BS.json`. `place/lake-louise` is the lake, so the village is `place/lake-louise-village` |
| E_BP_LONG: texts at most 120 characters | pass |
| W_BP_UNROUTED | every strategy leg is unrouted in `data/schedules/legs/` until STY-L |

`src` ids are computed with `core/src/sources/normalize.ts` (`sourceId(normaliseUrl(url))`), so they match the ids the
registry build will give; the registry does not read base-plans files yet, so `sources.ts check` cannot see them
(coordinator item).

## Comparison expected from the evaluator (stays, moves, ORS)

| Strategy | Stays | Moves | Base to base incl. airport | Day-trip drive | Longest transfer |
|---|---|---|---|---|---|
| as-planned | 5 | 4 | 728 min | 21.3 h | 197 |
| fewer-moves | 4 | 3 | 725 min | 21.3 h + day 4 +45 min, day 3 +6 min | 242 |
| three-bases | 3 | 2 | 680 min | 24.8 h | 333 |
| three-bases-canmore | 3 | 2 | 685 min | 25.3 h | 333 |
| three-bases + golden-for-lake-louise | 3 | 2 | 801 min | 30.1 h | 333 |

Messages that should fire (spec 5.1), all silent while the strategies are `draft` (S6): M1 (Lake Louise twice), M2
(one-night Lake Louise; `fewer-moves` adds at most +45 min to one day), M4 (three-bases: two fewer check-ins; the per-day
cap of 90 min needs the evaluator: the Kananaskis Lakes and Highwood days from Banff add about 105 min and an unrouted
amount, so M4 may fail its 90-min test and stay silent; with Canmore the Kananaskis Lakes day adds about 74 min), M7 (open
jaw). M3 stays silent (no comparable bands). M5 does not fire (the plan's last base is 85 min from the airport).

## Leg pairs for STY-L (from, to, why)

Base points as in `stay-bases.md` section 1; stop keys are the schedule's item ids.

| From | To | Why |
|---|---|---|
| calgary-airport | banff, canmore, kananaskis-village, lake-louise, golden, jasper | arrival and departure legs of every strategy and swap |
| edmonton-airport | jasper | open-jaw note |
| edmonton-airport | calgary-airport | open-jaw context |
| banff | lake-louise, jasper, kananaskis-village, golden | as-planned, fewer-moves (day 4), golden swap |
| lake-louise | jasper, kananaskis-village, golden, canmore | as-planned, three-bases transfers, swaps |
| jasper | golden | golden swap (day 5) |
| golden | banff, canmore | golden swap transfer (day 10) |
| canmore | kananaskis-village, jasper | canmore swaps, one-base check |
| paint-pots-walk | banff, canmore, golden | fewer-moves day 3; three-base day 10 last stop to the new base |
| banff | bow-lake | fewer-moves day 4 first stop |
| lake-louise, golden | bow-lake; glacier-skywalk (return) | three-base day 6 (plan day 4 out and back) |
| saskatchewan-crossing | lake-louise, golden | three-base day 5 last stop to the middle base |
| lake-louise, golden | johnston-canyon | three-base day 10 first stop |
| golden | takakkaw-falls-walk, emerald-lake-canoe, lake-louise-lakeshore, moraine-lake (via the Park and Ride) | golden swap days 7 to 9 |
| banff, canmore | canmore-groceries, grassi-lakes-upper, canmore-nordic-centre | three-base day 12 |
| banff, canmore | interlakes-trail, kananaskis-lakes-day-use, rawson-lake | three-base day 13 |
| banff, canmore | ptarmigan-cirque, wedge-pond-loop | three-base day 14 (not routed yet) |
| banff, canmore | troll-falls; troll-falls to calgary-airport | three-base day 15 |
| canmore | sunshine-gondola; banff-upper-hot-springs (return) | three-bases-canmore day 11, canmore-for-banff day 2 |
| canmore | fenland-loop, vermilion-lakes | canmore-for-banff on as-planned day 1 |
| canmore | the day 13 and 14 first and last stops; troll-falls | canmore-for-kananaskis |
| lake-louise-park-and-ride | lake-louise, banff, canmore, golden | Moraine day from each candidate base |

## Sample check (11 values against their sources)

Re-read on 25 Oct 2026 after writing (six pages fetched again; five against the saved responses). 11 of 11 pass.

| # | Value | Source | Result |
|---|---|---|---|
| 1 | Banff downtown parking CAD 12 an hour, 1 May to 31 Oct, 08:00 to 20:00 | banff.ca/parking | pass |
| 2 | First Moraine shuttle 06:30 from the Park and Ride; Moraine Lake Road closed to personal vehicles year-round | Parks Canada Lake Louise and Moraine page | pass |
| 3 | Kananaskis pass CAD 15 a day, CAD 90 a year; Canmore townsite needs none | alberta.ca | pass |
| 4 | Golden keeps Mountain time, aligned with Alberta | golden.ca notice | pass |
| 5 | Hertz Canada: "no separate drop-off fees on most rentals" | hertz.ca one-way page | pass |
| 6 | Tourism Golden: book ahead for high season and holiday weekends, no months stated | tourismgolden.com | pass |
| 7 | BC booster seat from 18 kg until nine years or 145 cm | ICBC fact sheet TS274S (saved PDF text) | pass |
| 8 | Alberta Resorts ADR CAD 709.50, September 2025 | Alberta economic data API (saved response) | pass |
| 9 | Golden elevation 800 m | Wikidata Q1020179 P2044, unit metre (saved response) | pass |
| 10 | Golden in `America/Edmonton` ("AB, BC(E)") | tz `zone1970.tab` (read once) | pass |
| 11 | Calgary airport to Jasper 333 min, 420.9 km | ORS response in the worktree cache | pass |

Caveat: these are re-reads of the same pages by the same agent, not an independent person's check.

## DECISIONS NEEDED

1. **Town refs (E_FK).** Six bases and both airports have no settlement or gateway record. I used proposed refs
   (`place/banff`, `place/lake-louise-village`, `place/kananaskis-village`, `place/canmore`, `place/golden`,
   `place/calgary-international-airport`, `place/edmonton-international-airport`) marked `ref_status: proposed`. Safest
   reversible choice: nothing else references them. The coordinator or STY-P confirms the refs when `BS.json` creates the
   records (and pins the slugs).
2. **`as-planned` review.** Set to `approved`, as in the spec 9.2 example, because it is the published plan; every
   alternative and swap is `draft`. The owner may prefer `draft` until the tab is reviewed (D10).
3. **Night split of the three-base strategies: Jasper 4, Lake Louise 5, Banff (or Canmore) 5**, not the spec's placeholder
   5 / 4 / 5: set from the day content (stay-bases.md 2.1). Owner check with Q114.
4. **Plan day 4 in the Jasper-first order** is a whole out-and-back day from the middle base (no item lost), instead of the
   spec's keep-subset day from Banff. The cost is the Icefield area two days running. If the owner prefers the spec's
   version, new day 6 becomes a `keep` of Bow Lake and Peyto and three items go to `left_out`.
5. **Price bands.** No town has an operator sample of 5 or an official town-level band, so every band is `searched_none`
   and every cost cell reads "Cost not compared yet". The only official figure is the CBRE monthly ADR for the five-town
   "Alberta Resorts" region (and Calgary Airport hotels). Whether it may appear as a dated area line is Q113.
6. **Check-in pattern samples are 1 to 2 pages.** Operator FAQ pages are hard to find; aggregator pages agree on 16:00 /
   11:00 but are excluded. Accept a pattern with n below 5, or keep `searched_none` until n reaches 5?
7. **Source registry.** Base-plans `sources` use registry-style ids that the registry build does not read yet. STY-Ca
   should include `data/base-plans/*.json` in `sources.ts build`, or the coordinator registers them.
8. **Moraine routing.** ORS will not route to Moraine Lake (closed road). The stored Moraine-day legs should end at the
   Park and Ride (OSM way 262311607) for the drive part; the evaluator should treat the shuttle as a fixed slot.

## New points for the coordinator (D1b owns `points.json`)

| Record (proposed) | Point | Role | Source |
|---|---|---|---|
| place/canmore | 51.08335, -115.35206 | centre | GeoNames 5914894 (towns layer); Wikidata Q991515 590 m away |
| place/golden | 51.29995, -116.9689 | centre | GeoNames 5962582; Wikidata Q1020179 250 m away |
| place/banff | 51.17622, -115.56982 | centre | GeoNames 5892532; Wikidata Q58337 |
| place/lake-louise-village | 51.42497, -116.17754 | centre | OSM node 2665400241 (D1 ruling) |
| place/kananaskis-village | 50.91861, -115.14809 | centre | OSM node 926027463 (D1 ruling) |
| place/calgary-international-airport | 51.113889, -114.020278 | entrance | Wikidata Q1160343 P625 |
| place/edmonton-international-airport | 53.31, -113.579444 | entrance | Wikidata Q269588 P625 (precision 1 arc-second) |
| Lake Louise Park and Ride (parking for the Moraine shuttle) | 51.44171, -116.16323 | parking | OSM way 262311607 via Nominatim |

## Not verified

- Every ORS number is free-flow; real September traffic, roadworks and closures are not in them.
- Sunshine Meadows and Sulphur Skyline day-trip values in the totals are OSRM (ORS did not snap); Highwood Pass is not
  routed at all.
- Golden "outside the national parks" and the Banff and Lake Louise why / why-not lines are our inference.
- Jasper capacity after the fire has no official figure; the 2025 "about 20 % fewer" is a local paper's report.
- Whether hotel guests in Kananaskis Village need the Conservation Pass in the hotel's own lot.
- The 2029 rules: every rule here is the 2026 pattern (passes, shuttle times, parking rates, the BC and Alberta clocks).
- An untracked empty `web/.og-cache` was created in this worktree so `tools/tree_check.py` passes (as in DATA-ROADMAP 7).

## Private: not for public output

Operator pages behind the check-in pattern (field 5), read 25 Oct 2026. Named here only; no public file depends on the
names, only on the count n.

| Town | Property | Page | Check-in / check-out | Minimum stay |
|---|---|---|---|---|
| Banff | Buffalo Mountain Lodge (CRMR) | https://crmr.com/resorts/buffalo-mountain/faq/ | 16:00 / 11:00 | none stated |
| Banff | Banff Park Lodge | https://www.banffparklodge.com/faq | after 16:00 / 11:00 | none stated |
| Lake Louise | Post Hotel | https://posthotel.com/faqs | 16:00 / 11:00 | none stated |

Tried and failed (no operator page reached): a Kananaskis Village lodge site (404), a Jasper inn and a Golden lodge (the
guessed domains did not resolve; not recorded as URLs). No property rate was read from an operator page; OTA and
aggregator prices that appeared in search results were not used.
