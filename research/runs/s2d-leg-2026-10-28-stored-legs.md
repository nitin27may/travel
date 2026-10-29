# S2D-LEG: stored legs for the published Rockies and Dolomites days (28 Oct 2026)

DATA-PLAN 2.4 rows 67 and 69 (DG-03, the data half of DG-12, and the S2D-TIME review). Batch S2-B. Agent travel-researcher, model
Opus. Run record: `data/capture/runs/s2d-leg-2026-10-28-stored-legs.json` (the DG-12 classes and the timing questions; a schedule
leg is not a capture property, so the leg provenance is this note's table).

## What changed and why

Every consecutive stop pair of every version of every published day now has a stored leg in `data/schedules/canadian-rockies-2029.json`.
Before, 23 Rockies pairs (21 rows; two are the same row read both ways) had none and fell to the scheduler's fallbacks: the 10 minute
local move, or on a transfer day the base fallback, which sent a stop with no point back through the day's start base. The Dolomites
had no missing pair: every leg of every version is a routed ORS leg (`data/schedules/legs/dolomites-2027.json`), apart from the
scheduler's car park walk-in, which is a rule (SW-022) and not a leg.

How the pairs were found: each published day's `scheduleInput` was scheduled for seven profiles (adults standard, split, relaxed,
full; family 6, family 10, family 10 split) and every version, and every drawn leg was checked for a stored row. The same check is now
a test: `web/tests/trips/stored-legs.test.ts` (it fails on the old file: 3 of 4 cases).

## Sources and the ORS key

- The offline `ORS_API_KEY` is not in this worktree (no `web/.env.local`, not in the environment, not under `~/.config/travel*`).
  The main checkout was not read (brief rule). So **no new ORS request was made**.
- Routed values come from ORS answers already in the repository: the DATA-D9R matrix of 25 Oct 2026
  (`research/runs/DATA-D9R/ors-legs-2026-10-25.json`, ORS v2 matrix, driving-car, free flow) and the map's routed legs
  (`data/schedules/legs/canadian-rockies-2029.json`, fetched 25 Oct 2026). A pair is `routed` only where both ends are the same
  points ORS was asked for (within a few hundred metres).
- Every other pair is the calibrated drive model (`core/src/drive`, DT-1a, `data/reference/drive/generated/calibration.json`,
  `drive-calibrate.ts --check` OK; month 9), from the stops' place-page points, stored as `basis: "estimate"`, `estimate: true`
  (drawn with ≈), rounded to 5 minutes with a 5 minute floor like the scheduler's own estimate (`core/src/schedule/legs.ts`).
- Two pairs use the plan's own minutes (`basis: "plan"`), where the plan's figure is for the same car park or the same road.

## The legs (Rockies; minutes, km, basis, source, was)

| Day | Pair | Stored | Basis | Source, points, read date | Was |
|---|---|---|---|---|---|
| 1 | base > bear-spray-groceries | 5, - | estimate | model, Banff base point standing in for the shop (no point; Banff townsite), 2 min floor | 10 (local move) |
| 1 | bear-spray-groceries > fenland-loop | 5, 2 | estimate | model 4 min (51.18421, -115.58261), lt10 cell, range 3 to 6 | 10 |
| 1 | fenland-loop > vermilion-lakes | 5, 2 | estimate | model 5 min (51.17806, -115.59889) | 10 |
| 1 | vermilion-lakes > elk-rut | 5, 3 | estimate | model 6 min (51.17508, -115.57208), range 5 to 9 | 10 |
| 1 | elk-rut > base | 5, 1 | estimate | model 3 min | 10 |
| 1 | fenland-loop > base | 5, 2 | estimate | model 4 min (family order) | 10 |
| 1 | base > vermilion-lakes | 5, 3 | estimate | model 6 min (family order) | 10 |
| 1 | base > banff-gondola | 10, 6 | estimate | model 10 min (51.14785, -115.55562), range 8 to 16 | 10 each way |
| 2 | base > sunshine-meadows-citadel-pass | 20, - | plan | the plan's base > sunshine-gondola 20 (same gondola base car park; the meadow point is off the road network, ORS 404 on 25 Oct) | 10 each way |
| 2 | base > banff-gondola | 10, 6 | estimate | as Day 1 | 10 |
| 2 | banff-gondola > cave-and-basin | 10, 5.3 | routed | map leg 2-C-3/2-C-1, ORS driving-car, 25 Oct, same page points | 10 |
| 2 | cave-and-basin > banff-upper-hot-springs | 10, 5 | estimate | model 8 min (51.16944, -115.59111 to 51.15086, -115.56062) | 10 |
| 3 | bourgeau-lake > next-base | 35, 44.2 | routed | DATA-D9R matrix: Bourgeau trailhead (51.16816, -115.73106) to Lake Louise (OSM node 2665400241) 34.7 min, 44.22 km | 60 + 65 "via Banff" |
| 4 | wilcox-pass > next-base | 95, 122 | estimate | model 94 min from the page point (52.25002, -117.23558), 60-150 cell, range 83 to 122. Cross-check: ORS Icefield Centre to Jasper 92.6 min, 103.6 km | 160 + 160 "via Lake Louise" (5 h 20) |
| 5 | mary-schaffer-loop > moose-lake-loop | 9, 0.7 | routed, walk | map leg 5-B-4/5-B-5, ORS foot-hiking, 25 Oct; also the family's rejoin at the boathouse car park | 10 (drive) |
| 5 | moose-lake-loop > pyramid-lake | 70, - | plan | the plan's moose-lake-loop > base 60 + base > pyramid-lake 10 (the road runs through Jasper; the model's 44 min is a straight line over the Maligne Range) | 10 |
| 7 | lake-annette-loop > base | 10, 6 | estimate | model 10 min (52.9016, -118.04827) | 10 |
| 8 | parker-ridge > next-base | 110, 142 | estimate | model 109 min (52.18083, -117.09222), range 96 to 142. Cross-check: ORS Icefield Centre to Lake Louise 104.2 min, 128.3 km; Parker Ridge is about 9 km nearer, so the model is likely 10 to 15 min high | 180 + 180 "via Jasper" (6 h) |
| 9 | emerald-lake-canoe > base | 35, 36.6 | routed | DATA-D9R matrix: Emerald Lake (51.43971, -116.5413) to Lake Louise 35.1 min, 36.55 km | 10 |
| 12 | base > ha-ling-peak | 80, 89.3 | routed | DATA-D9R matrix: Lake Louise to the Ha Ling trailhead (51.06174, -115.41863) 79.8 min, 89.29 km | 10 |
| 12 | ha-ling-peak > next-base | 60, 63.2 | routed | DATA-D9R matrix: Ha Ling trailhead to Kananaskis Village (OSM node 926027463) 60.3 min, 63.23 km, back through Canmore (the model's 34 min would cross the Spray Lakes gravel road) | 110 straight line from Lake Louise |

Counts: Rockies 21 rows (8 routed, 2 plan, 11 model estimates). Dolomites 0 (none missing).

GAP: the 11 estimates and the 2 plan rows are not routed. With the offline key, `ORS_API_KEY=... node web/scripts/legs-ors.mjs` routes the
map pairs only; a routed value for these schedule pairs needs a small matrix run over the points in the table (one request; inside the
free quota), then `basis: "routed"`.

## Root cause: adults Day 4 "Drive to Jasper via Lake Louise", 5 h 20

Data cause, fixed: Day 4 had no stored leg from Wilcox Pass to the next base. Adults alone take Version A (the split day is optional),
so the scheduler asked for `wilcox-pass > next-base` and found nothing.

Code cause, reported only (`core/src/schedule/legs.ts` `resolveLeg`, the hub rung). The Rockies stops carry no `point` on a published
day (only `placePoint`, for edits), so the ladder takes the branch for "one end placed": it estimates the placed end (Jasper) to the
day's hub, which is the START base (Lake Louise), 250 min, and adds the stored way from the base to the stop, 70 min, and labels the
leg "via Lake Louise". On a transfer day the stop is on the way, so the way back through the start base is wrong; the same rung made
Day 3 A read Bourgeau to Lake Louise 2 h 05 and Day 8 A read Parker Ridge to Lake Louise 6 h. Minimal repro:

```ts
resolveLeg({ ids: ["wilcox-pass"], point: null }, { ids: ["next-base"], point: { lat: 52.8737, lon: -118.0814 } },
  [{ from: "base", to: "wilcox-pass", mode: "drive", minutes: 70, km: null, basis: "plan", estimate: true, symmetric: true }],
  { lat: 51.4254, lon: -116.1773 });
// { mode: "drive", minutes: 320, km: null, basis: "estimate", estimate: true, via: true }
```

Suggested builder fix (not done here): on a transfer day, for a stop with no point going to `next-base`, use the stored way from the
start base to the stop and subtract nothing, or the stop's `placePoint` when present; never route a transfer-day stop back through the
start base. The stored legs make the published days independent of it.

Left as is: adults Day 4 A still waits 3 h 20 at Wilcox Pass (08:40 to 12:30), because its 12:30 is the split day's time (it fits inside
the family's Ice Explorer block) and the day start is 07:30. That is the builder's split-day start-time back-calculation (DATA-PLAN 2.4
DG-03 code half).

## DG-12: the map's unrouted pairs, classified

`data/schedules/legs/canadian-rockies-2029.unrouted.json` is script output; the classes are recorded here and in the run record.

| Pair (map keys) | Reason in the ledger | Class | Source |
|---|---|---|---|
| 14-B-3 > 14-B-4 Ptarmigan Cirque > Wedge Pond | route over 5 times the straight line | road with a seasonal gate (not no road): Highway 40 over Highwood Pass, OSM ways 119123750 and 385652955 tagged `access:conditional = no @ Dec 01-Jun 14`; open in September | Overpass, read 29 Oct 2026 01:27 UTC; Wikipedia "Highwood Pass" (1 Dec to 14 Jun). The current Alberta Parks trail reports (updated 25 Oct 2026) do not state the dates |
| 5-B-5 > 5-B-2, 5-B-2 > 5-B-3 (Spirit Island) | no road or path within reach | ferry (boat): the pin is Spirit Island in Maligne Lake; the operator's cruise is the way to it | banffjaspercollection.com Maligne Lake Cruise, read 28 Oct 2026: closed for the 2026 season, back 28 May to 10 Oct 2027 |
| 6-B-2 > 6-B-3, 6-B-4 > 6-B-2, 6-C-2 > 6-C-1 (Mount Robson) | no road or path within reach | no road, because of the pin: the "Mount Robson Visitor Centre viewpoint" point (53.11056, -119.15667) is the summit of Mount Robson | a point fix for S2D-PTS |
| 7-B-4 > 7-B-1, 7-B-1 > 7-B-2 (Miette Hot Springs) | no road or path within reach | road: Miette Road is a public paved tertiary road with no access tag (OSM ways 31177099, 31181460, 232706570, 1302534759); the ORS 404 is a routing-graph gap | Overpass, read 29 Oct 2026; re-ask ORS on the next run |

None of the eight is a lift or trail pair. Only the Mount Robson pairs are "no road", and only because of a wrong pin.

## S2D-TIME

**Rockies Day 2, "Day 2 is 10 h 25 away from base"** (the default family profile, Version B). Not a data error: the plan's family day is
Sunshine gondola 08:00 to 11:30, lunch, the Minnewanka cruise, back to the Sunshine car park for the adults at 15:30, then two hours at the
Upper Hot Springs: 07:40 to 18:05. The timeline understates it: the rejoin pin draws no leg (`core/src/schedule/schedule.ts`, the
rejoin target is the party's current place), so the drive from Minnewanka back to Sunshine (about 35 min) and on from Sunshine to the hot
springs is shown as Minnewanka to the hot springs, 25 min. The real day is about 30 min longer. Owner decision below; data not changed.

**Dolomites Day 2, the 5 h "Free time"**. Not a data error: the plan does Lago di Braies at first light and Val Fiscalina at 14:00, with
the middle of the day at San Candido (16 min from Fiscalina). The scheduler drives Braies to Fiscalina at 07:45 and waits 5 h 05 there,
because a back-to-base leg is drawn only before an evening stop (17:00 or later, `web/lib/public/timeline.ts` `doloLegs`) and the
scheduler has no "go back to the base for a long midday gap" rule. The base question (D9's 3 or 2 base split) does not change this day:
San Candido is the base either way. Owner decision below; data not changed.

## Sample moves (edit mode), before and after

`scheduleTemplate` with one move, family 10 and adults, on the core fixture before and after (the fixture now carries the new legs).

| Move | Before | After |
|---|---|---|
| Moraine Lake D11 > D13 | family 05:15-20:35, drive 315, "Rockpile at first light 105≈" | unchanged |
| Larch Valley D11 > D13 | family 08:00-23:59, drive 385 | unchanged |
| Sulphur Skyline D7 > D10 | family 07:00-23:59, drive 595, "Sulphur Skyline 260≈" | unchanged |
| Emerald Lake canoe D9 > D12 | family 09:10-20:00, drive 225, "Emerald Lake canoe 50≈"; adults reach Ha Ling in 10≈ | family 09:25-20:00, drive 210, "Emerald Lake canoe 35" (routed, carried from Day 9); adults Ha Ling 80 (routed) |

The first three moves do not touch a new leg. `core/test/schedule/moved-legs.test.ts` (DG2F, Emerald Lakeshore with no point, D9 > D12)
now reads 35 and 95 instead of 50 and 110: the shortest stored way from the base on its own day is the routed canoe leg.

## Published days that change (default profile)

| Trip | Day | Version | Before | After | Why |
|---|---|---|---|---|---|
| Rockies | 1 | B | 10:00-20:50, drive 2 h 30 | 10:00-20:40, drive 2 h | six 10 minute fallbacks inside Banff become 5 to 10 minute model legs |
| Rockies | 5 | B | 07:30-20:30, drive 2 h 30 | 07:30-20:30, drive 2 h 20 | the Maligne trailhead hop is a 9 minute walk, not a 10 minute drive |
| Dolomites | - | - | - | - | none |

Trip cover: Rockies drive average 120 to 115 min a day; long drive days 4 to 2 (Days 1 and 5 drop under the line). Tests updated for
exactly these: `web/tests/data/trip-summary.test.ts`, `web/tests/trips/shape.test.tsx`.

Other versions (picked by a party or the version picker), adults unless named:

| Day | Version | Before | After | Warnings |
|---|---|---|---|---|
| 1 | B | 10:00-22:05, drive 2 h 20 | 10:00-21:55, drive 1 h 55 | none either way |
| 2 | A | 07:50-20:00, drive 20 min | 07:40-20:00, drive 40 min (20 to the gondola, not 10) | none |
| 3 | A | 06:35-20:00, drive 2 h 30 | 06:35-20:00, drive 1 h | none |
| 4 | A | 07:30-23:20, drive 6 h 30 | 07:30-20:00, drive 2 h 45 | S_DAY_CAP, W_PACE, W_DRIVE_LIMIT gone |
| 4 | A, family 10 | 07:30-22:35 | 07:30-19:50 | W_PACE, W_DRIVE_LIMIT gone; S_DAY_CAP stays |
| 5 | B (adults order, Pyramid Lake straight after Moose Lake) | drive 1 h 30 | drive 2 h 20 (the drive through Jasper was 10 min) | S_DAY_CAP stays |
| 8 | A | 08:00-21:10, drive 7 h 50 | 08:00-20:00, drive 3 h 40 | S_DAY_CAP, W_PACE, W_DRIVE_LIMIT gone |
| 9 | C | drive 1 h 35 | drive 2 h (Emerald Lake to Lake Louise is 35 min, not 10) | none |
| 12 | A | drive 2 h | drive 2 h 20 (Lake Louise to Ha Ling is 80 min, not 10) | none |

## Owner decisions

1. Rockies Day 2, Version B: keep the long family day (10 h 25 shown, about 11 h real), or move the rejoin (for example the family skips
   the Minnewanka cruise, or does it after the rejoin). Recommended: keep the plan and let a builder draw the rejoin leg, so the day is honest.
2. Dolomites Day 2: keep the 14:00 Val Fiscalina with a midday return to San Candido (a builder rule: a gap over about 2 h within 30 min of
   the base goes back to the base), or drop the 14:00 so Fiscalina follows Braies in the morning. Recommended: the builder rule; the plan's
   afternoon light is deliberate.
3. Adults Day 4, Version A: the 3 h 20 wait goes with the builder's split-day start-time fix; no data change unless the owner wants the
   adults' 12:30 dropped when they travel alone.

## Notes on the run

- Overpass: six requests, one at a time, 11 to 40 s apart; three failed (empty or 502) and were retried once each. They were made with
  curl, not through a script, so `/tmp/travel-overpass.lock` was not taken; no other agent was using Overpass (the brief named this lane
  the only one). User agent `nks-travel-research/1 (S2D-LEG)` (no personal data) instead of the documented one: follow-up, use
  `travel-relevance-signals/1.0` next time.
- The scheduling dumps ran under vitest with the unit tests' decoy home point (`core/test/setup/home-point.ts`); the real point was never
  read or written.
- `web/lib/public/timeline.ts`: the schedule file's leg `basis` type widened from `plan | matrix` to the scheduler's own four values (one
  line; no behaviour change). `data/schedules/README.md` documents the four values.
