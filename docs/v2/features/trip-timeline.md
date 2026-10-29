# Trip timeline and party profile (public trip page)

> **Amended 26 Oct 2026 (UX fixes, planned, waiting for the owner's design approval):** 3.1's selector (Who is going, Youngest stepper) is replaced by a collapsed party bar with adults, children and each child's age kept on the device; 3.8's `a` widens to `a=1` to `a=12`; `view` gains `summary` (the new default), `table`, `bookings`, `photos`; 3.10's "whole-trip timeline" with each day's span is replaced by "The trip's shape" in the Summary tab. See [trip-and-places-ux-fixes.md](trip-and-places-ux-fixes.md) 3.4, 4, 5 (PLAN R-260 to R-262).

> **Amended 25 Oct 2026 (trip origin and nearest airport):** the arrival and departure day rules (6) keep their mechanics; the airport now comes from the origin ladder (the visitor's start, else the trip's gateway, else the nearest airport), the 6 h day cap applies when the flight estimate exceeds 5 h, and `airport.before` picks domestic (120) or international (180) from the visitor's country. URL keys `from` and `gw` join 3.8 after `walk`. See [trip-origin-and-nearest-airport.md](trip-origin-and-nearest-airport.md) sections 7 and 10 (PLAN R-203, R-206).

Status: spec, 18 Oct 2026. Owner direction of 18 Oct 2026. Build brief: [L3c-trip-timeline.md](../build/public-site/L3c-trip-timeline.md).
Design (layout, motion, colour): [design/trip-page/timeline-design.md](../design/trip-page/timeline-design.md) (Fable, written in parallel).
Where the two disagree, this page governs the data and the rules, and the design page governs the layout.

**Supersedes:**
- the per-day "Track A · B · C segment inside the expanded row" in [L3-trips.md](../build/public-site/L3-trips.md) step 9;
- the same line in [design/foundation/patterns.md](../design/foundation/patterns.md) 3.4.

A trip-level party profile now chooses the track, and the page renders the whole trip for that choice.

> **Amended 25 Oct 2026 by [trip-overview-and-customisation.md](trip-overview-and-customisation.md) (planned, not built).**
> The By category view (`view=category`, 3.8 and 3.10) is superseded by the trip overview (`view=all`, with
> `view=category` and the category fragments kept as aliases). A new URL key `w` (a best-time window) sets the scheduler's
> sun window (2.1, 2.8) and is added to `PROFILE_KEYS` after `add`. 3.7 "Add to this day" and its 30 km candidate rule
> are unchanged and reused for the overview's Nearby scope. 3.9 `CopyDraft` gains `removed`, `maybe` and `window` in the
> signed-in copy (`trip-custom/1`).

## Purpose

About 90% of visitors search, open a trip page, and add the trip to their calendar or account with their own dates.
About 10% plan. So the trip page is the most important page, and chronological order matters most.

The page is a timeline at two levels:
1. **The trip:** Day 1, Day 2 ... Day N.
2. **The day:** a realistic run of events in time order. You leave at 07:30, drive 1 h, take a 10:00 boat, eat a picnic lunch, walk a 3 km loop, rest at the base, eat dinner, and watch the sunset at a lake.

The times come from a deterministic scheduler, plus authored data where we have it. Each time says how firm it is.
The party (who is going, the youngest child's age, the pace) is chosen once at the top. It reshapes every day.
There is no A/B/C choice on each day.

## Key decisions

| # | Decision | Why | Trade-off |
|---|---|---|---|
| D1 | One typed **entry list per day** (12 kinds), each entry with a start, a duration, places, and a time confidence (`fixed`, `anchored`, `suggested`) plus a labelled source | The page, the copy, the ICS file and the planner's `items` rows all read the same list | Meals and breaks become data we invent by rule, so they must be labelled "suggested" |
| D2 | The scheduler is **pure TypeScript in `core/src/schedule/`**. It runs at build time for the trip's default profile, and in the browser when the visitor changes the profile | First paint and SEO get the default; profile changes need no server (static export) | The scheduler ships in the trip page bundle (under 13 kB gzip; the limit rose from 12 once, for lanes, the sun anchor and the leg ladder. Any further raise needs a trim of the scheduler first) |
| D3 | **The authored order is never changed.** The scheduler assigns times. It does not reorder. Only items the visitor adds are placed by the scheduler | The owner's order carries reasons (light, crowds, a booked slot) that rules cannot see | A badly ordered day shows warnings and is not "fixed" silently |
| D4 | Sources in this order: **operator slot > authored (plan) > our data > rule by kind** | Our own research is better than a generic rule | Authored times need a one-off import and a person's check (L3d) |
| D5 | **Party profile at trip level** replaces per-day tracks. Each day keeps its variants (A, B, C) as data. A selection rule picks one per day; a day can be overridden | One choice at the top; days still adapt; "swap this day" stays possible | A day can end up in a variant the author did not intend for that party, so the rule's reason is shown |
| D6 | Variants carry a **relation**: `alternative` (pick one) or `parallel` (the party splits and rejoins). Rockies `needs_split` days make Track A parallel to B | Rockies Track A on a family trip is "one adult hikes while the others do B". It is not a different trip | Two lanes on one day need a two-lane layout (Fable) |
| D7 | Public times are **times of day only**. Sun anchors show a **range across the season window** ("sunset about 19:55 to 20:30") until dates attach | Public trips are dateless ([public-trips-dateless.md](../design/public-trips-dateless.md)) | Anchored times are less precise on the public page |
| D8 | Validation **reuses the core day-check codes** (`W_OVERLAP`, `W_HOURS`, `W_DAYLIGHT`, `W_PACE`, `W_DRIVE_LIMIT`, `W_EARLY`, `W_CEILING`, `W_FIT`) and adds five `S_` codes | A trip copied into the planner gets the same warnings it had on the public page | `checkDays` works on planner rows, so the scheduler maps its entries to those rows for the check (2.11) |
| D9 | Research markers (INFERENCE, CALC, GAP, conflict, low confidence) never reach public prose. They become **honesty chips**. Units in prose become quantity tokens rendered through the visitor's unit preference | Prose like "(20:16 CALC)" is internal. "1.9 km" next to "1.2 mi" is wrong | The cleaner is heuristic; a test sweeps every public string |
| D10 | Drive legs: stored **OpenRouteService** values fetched once at publish time (sequential, server side, key never printed). Fallback: the plan's own minutes, then the base matrix, then straight line × 1.42 marked ≈ | ORS free tier; terms let us store the result ([map-stack](../../../research/reports/map-stack-2026-10-18.md)) | Trips without coordinates (the Rockies, the summary trips) stay ≈ until points exist |

## 1. The day schedule model

### 1.1 Entry kinds

| Kind | `sub` values | What it is | Duration source | Planner `items.type` |
|---|---|---|---|---|
| `start` | `leave-base`, `leave-home`, `land`, `wake` | when the day begins: leaving the base or home (short trips), or landing on the arrival day | 0 | none (day start) |
| `leg` | mode: `drive`, `walk`, `shuttle`, `bus`, `train`, `ferry`, `boat`, `lift`, `flight` | travel between two places; carries `from` and `to` | ORS, plan, matrix, estimate (2.5) | `transfer` (or the `leg_*` columns on the next item) |
| `visit` | `sight`, `viewpoint`, `lake`, `waterfall`, `town`, `activity`, `lift-ride`, `hot-spring`, `scenic-drive` | a place you stop at, or an activity you do | data, rule (2.3) | `sight` or `activity` |
| `trail` | `hike`, `walk`, `bike`, `paddle`, `via-ferrata` | a walk or ride with distance and climb | data hours, Naismith rule, × pace (2.4) | `trail` |
| `meal` | `breakfast`, `lunch`, `dinner`; `style`: `sit-down`, `picnic`, `on-trail`, `at-base` | eating, inside a meal window | rule, or the eatery's data | `meal` |
| `break` | `coffee`, `snack`, `fuel`, `leg-stretch`, `groceries` | short stops on a day or a drive | rule | `break` |
| `rest` | `free-time`, `at-base`, `downtime` | time with nothing planned. It is shown, not hidden, when over 10 min (`FREE_ROW_MIN`, core/src/config/schedule.ts; SW-022) | the gap between entries | `rest` |
| `checkin` | `stay`, `hut`, `campsite` | arriving at the night's base | rule (30 min) or the stay's check-in window | `checkin` |
| `checkout` | `stay` | leaving a base for good | rule (20 min) | `checkout` |
| `booking` | `slot`, `timed-entry`, `day-use-permit`, `departure`, `meeting-point` | a fixed operator time: a boat, a timed ticket, a shuttle, a guided tour | operator | an `activity` row with `booking_id` and `start` |
| `sun` | `sunrise`, `golden-am`, `golden-pm`, `sunset`, `civil-dusk`, `nautical-dusk`, `no-sunset` | a light marker with no duration. An entry can be anchored to it | `core/src/sun` | none (computed) |
| `end` | `at-base`, `at-next-base`, `at-airport`, `at-home` | when the day ends; `at-home` can carry a **home-by** anchor (3.12) | 0 | none |

A `booking` entry is the slot itself. The place it belongs to is its `visit`, and the two are linked by `bookingOf`. The booking also stays a Logistics row in By category.

### 1.2 Types (`core/src/schedule/types.ts`)

```ts
export type Confidence = 'fixed' | 'anchored' | 'suggested';
/** Who said it. Shown as the source label. */
export type TimeSource = 'operator' | 'plan' | 'sun' | 'data' | 'rule' | 'visitor';
export type LegBasis = 'routed' | 'plan' | 'matrix' | 'estimate';      // routed = stored ORS

export interface PlaceRef {
  name: string;
  placeSlug: string | null;            // link to /places/<slug> when the place has a page
  point: { lat: number; lon: number } | null;
}

export interface TimelineEntry {
  id: string;                          // stable: source item id, or `${day}-${lane}-${kind}-${n}` for generated entries
  day: number;
  lane: 'all' | 'A' | 'B' | 'C';       // 'all' unless the day is split (parallel variants)
  kind: EntryKind;
  sub: string | null;
  title: string;                       // "Spirit Island cruise", "Picnic lunch at the boathouse", "Drive to Maligne Lake"
  start: string;                       // "HH:MM" local to `tz`
  durationMin: number;
  end: string;                         // derived; never past 23:59 (see S_MIDNIGHT)
  tz: string;                          // IANA zone of the entry
  at: PlaceRef | null;                 // where it happens (visit, trail, meal, booking, rest, checkin)
  from: PlaceRef | null;               // legs only
  to: PlaceRef | null;                 // legs only
  time: {
    confidence: Confidence;
    source: TimeSource;
    pinned: boolean;                   // the scheduler may not move it (fixed, or an authored time)
    anchor?: { to: SunEventId; offsetMin: number; range: [string, string] };   // "sunrise -15", range over the season window
    window?: { from: string; to: string; why: string };                        // opening hours, last ride, meal window
    note: string | null;               // "Book the 10:00 sailing", "Last ride up 19:30"
  };
  duration: { source: TimeSource | 'pace'; basis: string };                    // "data 4-5 h, standard = 4 h 30", "rule: lake viewpoint 45 min x 1.0"
  leg?: { mode: LegMode; km: number | null; basis: LegBasis; breaks: number };
  stats?: { distanceKm: number | null; gainM: number | null };                 // trails
  optional: boolean;                   // "if the child wants more"
  addedBy: 'author' | 'scheduler' | 'visitor';
  sourceItemId: string | null;         // the DayItem id it came from
  bookingOf?: string;                  // a booking entry points at its visit
  insideOf?: string;                   // a lunch eaten on a trail points at the trail
  honesty: HonestyId[];                // e.g. ['drive_estimated'], ['estimate'], ['not_known']
}

export interface DayTimeline {
  day: number;
  variant: { key: string; label: string; chosenBy: 'profile' | 'override'; reason: string };
  lanes: ('all' | 'A' | 'B' | 'C')[];   // ['all'], or ['B', 'A'] on a split day (the party's lane first)
  entries: TimelineEntry[];             // sorted by start, then lane, then a fixed kind order
  span: { start: string; end: string; minutes: number };
  totals: { activeMin: number; driveMin: number; walkKm: number; gainM: number };
  warnings: ScheduleWarning[];
  fits: boolean;                        // false when no variant fits the profile (3.5)
}
```

The scheduler's output is plain JSON, like the rest of the public model. `PublicDay` gains `variants` and `scheduleInput` (2.1). `PublicTrip` gains `schedule: { defaultProfile, timelines: DayTimeline[] }` for the default profile.

### 1.3 Time confidence and source

| Confidence | Means | Examples | Shown as (wording; look from the design page) |
|---|---|---|---|
| `fixed` | set by someone else; the day bends around it | a booked boat at 10:00; a timed park entry; the last gondola up at 19:30; a ferry departure; a flight landing | the time in full weight, with the label **Slot** or **Last ride up** |
| `anchored` | tied to the sun; moves with the date | "at Braies 15 min before sunrise"; "Vermilion Lakes for the last hour before sunset" | **about 05:15** plus a sun glyph; hovering shows "sunrise -15 min · 05:00 to 05:30 in this window" |
| `suggested` | worked out by the scheduler, or a plan's suggestion that can move | leave 07:30; lunch 11:45; coffee 15:00 | **~11:45** in a lighter weight; the legend reads "~ suggested time" |

The source label sits next to the time in the expanded entry and in the tooltip:

| Source | Label |
|---|---|
| `operator` | "Operator timetable" |
| `plan` | "From the plan" |
| `sun` | "Sun, computed for the season" |
| `data` | "From our place data" |
| `rule` | "Our rule for a <kind>" |
| `visitor` | "You added this" |

An authored time is `suggested` with source `plan` and `pinned: true`. The exceptions are a slot or a last ride (`fixed`) and a sun-relative time (`anchored`).

### 1.4 Worked example: Rockies Day 5, profile `family-6`, `standard`

This is the target output for the fixture `core/test/fixtures/schedule/rockies-day5-family6-standard.json`. Jasper's sun in the season window (8 to 22 Sep, `core/bin/sun.ts`): sunrise 07:13 to 07:36, sunset 19:54 to 20:28.

| Time | Conf. | Lane | Kind | Entry | Duration | Source |
|---|---|---|---|---|---|---|
| 07:30 | sugg. pinned | all | start | Leave Jasper | | plan ("Leave Jasper 07:30") |
| 07:30 | sugg. | all | leg drive | Jasper to Maligne Lake ≈ | 1 h | plan, ≈ |
| 08:30 | sugg. | B | break coffee | Coffee and a snack at the boathouse | 20 min | rule |
| 08:50 | sugg. | B | rest | Free time by the lake | 50 min | gap |
| 09:40 | fixed | B | booking | Board the Spirit Island cruise (check in 20 min before) | 20 min | rule, tied to the slot |
| 10:00 | fixed | B | visit | Spirit Island cruise | 1 h 30 | operator slot; duration from data |
| 11:30 | sugg. | B | meal lunch picnic | Picnic lunch at the boathouse | 45 min | rule (family lunch window 11:30 to 13:00) |
| 12:20 | sugg. | B | trail | Mary Schaffer Loop · 3.2 km · 84 m | 1 h 20 | rule: Naismith 51 min × 1.6 (age 6) |
| 13:40 | sugg. | B | rest | Free time | 20 min | gap |
| 08:40 | sugg. | A | trail | Bald Hills · 10.4 km · 500 m (one adult) | 4 h 30 | data "4-5 h", standard = midpoint |
| 13:10 | sugg. | A | meal lunch on-trail | Packed lunch on the trail | inside | rule |
| 14:00 | sugg. pinned | all | rest | Together again at the boathouse car park | | plan (rejoin "about 14:00") |
| 14:00 | sugg. | all | leg drive | To Moose Lake trailhead ≈ | 10 min | estimate (local move) |
| 14:10 | sugg. | all | trail optional | Moose Lake Loop · 2.7 km · 59 m, if the child wants more | 1 h 05 | rule × 1.6 |
| 15:15 | sugg. | all | leg drive | Back to Jasper ≈ | 1 h | plan, ≈ |
| 16:15 | sugg. | all | rest | Rest at the base | 1 h 30 | gap |
| 17:45 | sugg. | all | meal dinner | Dinner in Jasper | 1 h 15 | rule (family dinner window) |
| 19:10 | sugg. | all | leg drive | To Pyramid Lake ≈ | 10 min | estimate |
| 19:20 | anchored | all | visit lake | Pyramid Lake, calm water before sunset | 45 min | plan; anchored sunset -40 |
| about 19:55 to 20:30 | anchored | all | sun | Sunset | | sun |
| 20:15 | sugg. | all | end | Back at the base | | |

Day cap at the default profile (round 3 golden): the cap is measured on **time away from base**, so a long rest, dinner or an errand done at the base itself (a stored zero-minute leg to `base`) never counts. Across the Rockies trip it warns on **Days 2, 4, 5 and 13**: Day 4 is the Icefields Parkway move day (about 10 h 15 away) and Day 13 carries the optional Rawson Lake, which the message names. Days 2 and 5 pass the cap by a few minutes because the wait for the other adult at the rejoin time is scheduled in every view, the one lane and the two-lane view alike (TRP, L3c I-1). Day 7 (laundry at the base, 2 h) does not warn. `core/test` and `web/tests/trips/timeline.test.ts` pin this list.

Lane A is not shown by default for `family-6`. The day shows a "Split option: one adult can walk Bald Hills (4 h 30) and rejoin at 14:00" row, and `split=1` opens the two lanes (3.2).

## 2. How schedules are made

### 2.1 Pipeline

```
build time (web/lib/public, LD adapter)                          browser (trip page)
  legacy + prototype + data/schedules/<slug>.json                   profile from the URL
    -> PublicDay.variants + scheduleInput  -------- JSON props -->   core/src/schedule.scheduleTrip(input, profile)
    -> scheduleTrip(input, defaultProfile)                           -> DayTimeline[] (re-run on each change)
    -> PublicTrip.schedule.timelines (pre-rendered HTML)
```

- `scheduleInput` per day holds the inputs below:
  - the base (point, tz)
  - the day kind (arrival, departure, normal, transfer)
  - the variants with their ordered items: kind, sub, place, point, durations, stats, windows, slots, minAge, audience
  - the stored legs
  - the sun window (season months, plus the base point)
  - the authored overrides

  It holds no prose beyond the titles.
- The trip page renders the default profile's timelines on the server. On hydration it re-runs only when the URL profile differs from the default. A test checks server and client parity: same input, same output.
- The scheduler never reads files, the clock or the network. A date-free run takes the **sun reference** from the input. That is the middle of the season window, and each anchor carries the window's range.

### 2.2 Source ladder per value

| Value | 1st | 2nd | 3rd | 4th |
|---|---|---|---|---|
| start time of an item | operator slot (`fixed`) | authored time (`data/schedules`, prototype `time`, legacy time cells) | sun anchor from the item's `needs: 'sunrise' / 'sunset'` | scheduler (forward pass) |
| duration | authored override | our data: trail `hours` (range), sight `time_needed_hours`, prototype `durationMin`, operator duration | rule by kind (2.3) | none (never null: the rule table is total) |
| leg | stored ORS (`routed`) | the plan's minutes (`drive` text, legacy legs) | base matrix (Rockies `drive_times_min`) | straight line × 1.42 (2.5), marked ≈ |
| opening hours, last ride | our data (`open_from`, `open_to`, `last_up`, `last_down`), read for the season | authored override | none: the check is skipped and the entry shows "Hours: not known yet" | |

### 2.3 Duration rules by kind (`core/src/schedule/rules.ts`)

The default minutes for an adult at standard pace, before multipliers. Every rule has an id, so the expanded entry can say "Our rule for a lake viewpoint: 45 min".

| Rule id | Applies to | Minutes |
|---|---|---|
| `viewpoint.roadside` | viewpoint or pullout, walk under 300 m | 15 |
| `viewpoint.short-walk` | viewpoint with a walk up to 1.5 km | 30 |
| `lake.viewpoint` | lake, look and photos | 45 |
| `lake.shore` | lake with a shore walk, canoe or swim | 90 |
| `waterfall.roadside` | waterfall under 300 m from the car | 20 |
| `waterfall.walk` | waterfall with an access walk | the walk's trail time plus 15 |
| `sight.landmark` | landmark, church, castle exterior | 45 |
| `sight.museum` | museum, gallery, castle interior | 120 |
| `town.stroll` | old town or village visited | 90 |
| `town.errands` | groceries, cash, pharmacy | 45 |
| `scenic-drive` | a drive that is the outing | the leg plus 10 per named stop |
| `lift.ride` | a lift used as the outing, return | 20 ride + 60 at the top |
| `lift.access` | a lift that only starts a walk | 20 one way, folded into the trail |
| `hot-spring` | ticketed pools | 120 |
| `activity.default` | an operator activity with no stated duration | 180 |
| `boat.default` | a cruise with no stated duration | 90 |
| `trail.naismith` | a trail with no `hours` | km × 12 + gain_m ÷ 10, then + 10% for stops |
| `meal.breakfast` | out, not at the base | 45 |
| `meal.lunch.sit-down` / `.picnic` | lunch | 60 / 40 |
| `meal.dinner` | dinner | 75 |
| `break.coffee` / `.snack` / `.fuel` / `.groceries` | | 20 / 15 / 15 / 45 |
| `checkin` / `checkout` | stay | 30 / 20 |
| `booking.checkin` | a slot that needs arrival ahead | 20 (operator value when known) |
| `arrival.car-hire` | collect a hire car after landing | 60 |
| `airport.before` | before a departing flight | 180 international, 120 domestic |
| `park.walk-in` | car park to the subject | 10, or the lot's stated walk |

A trail `hours` range ("4-5 h") resolves by pace: relaxed takes the upper end, standard the midpoint, full the lower end.

### 2.4 Profile multipliers

| | relaxed | standard | full |
|---|---|---|---|
| core pace (`profile.pace`, `PACE_MIN` active budget) | 2 (420 min) | 3 (540 min) | 4 (660 min) |
| default day start | 08:30 | 08:00 | 07:00 |
| visit durations | × 1.25 | × 1.0 | × 0.85 |
| buffer between items | 20 min | 15 min | 10 min |
| coffee breaks | mid-morning and mid-afternoon | mid-afternoon | none |
| day span cap, adults | 10 h | 11 h 30 | 13 h |
| day span cap, family (youngest 4 to 12) | 9 h | 10 h | 11 h |
| day span cap, youngest under 4 | 8 h | 9 h | 9 h 30 |

| Youngest child's age | Trail time multiplier | Default walk ceiling (one walk) | Snack every |
|---|---|---|---|
| none (adults) | 1.0 | none | none |
| 0 to 3 (carried) | 1.3 | 8 km, 400 m, carrier assumed | 2 h |
| 4 to 5 | 1.8 | 4 km, 200 m | 2 h |
| 6 to 7 | 1.6 | 6 km, 350 m | 2 h 30 |
| 8 to 9 | 1.35 | 9 km, 500 m | 2 h 30 |
| 10 to 12 | 1.15 | 12 km, 750 m | 3 h |
| 13 to 17 | 1.0 | adult | none |

The ceilings match the Rockies child notes. "Too long and steep for a 6 year old (11.2 km, 750 m)" is over 6 km and 350 m. These numbers are rules, not research: the expanded entry names the rule, and the owner can tune them in one file.

### 2.5 Drive legs

1. **Stored ORS** (`basis: 'routed'`): `web/scripts/legs-ors.mjs` reads `ORS_API_KEY` from `web/.env.local`. It never prints, logs or commits the key. It runs sequentially, at most 30 requests a minute, and only for consecutive item pairs with coordinates. The output is committed to `data/schedules/legs/<slug>.json`, with distance, minutes, the profile (`driving-car` or `foot-hiking`), the date fetched and the attribution. A `--check` mode fails when a pair is missing, and the build never calls ORS.
2. **The plan's minutes** (`plan`): "about 1 h each way", the prototype's `driveMin`, legacy leg cells. They are parsed by the adapter and kept ≈ when the plan itself marked them INFERENCE.
3. **The base matrix** (`matrix`): Rockies `bases.json` `drive_times_min`. It is ≈.
4. **Straight line** (`estimate`): the prototype's rule (`src/lib/geo.ts` of the retired prototype, tag `archive/prototype-2026-10-22`):
   - under 1.2 km: a walk, at distance × 1.3 and 4.5 km/h;
   - over that: distance × 1.42 (+1.5 km under 60 km), at 46 km/h (72 over 60 km), +3 min.
   It is always ≈ with the "Drive time estimated" chip.
5. **No coordinates at all, same area**: a 10 min "local move" leg, ≈. The entry says "time between stops not known".

Between rungs 4 and 5, when one end has a point and the other has none but a stored leg from the start base (the hub rung): from a placed stop
the way runs back through the base (the estimate to the base plus the stored leg, drawn "via <base>"). When the placed end is the **next base**
on a transfer day, the stop is taken to lie on the way instead: the base-to-base estimate less the stored leg, at least
`TRANSFER_STOP_FLOOR_MIN` (30), ≈ and never "via" (S2D-SCHED; adults Day 4 once read Wilcox Pass to Jasper as 5 h 20 "via Lake Louise").

**The rejoin pin** of a split day is a moment where the party already is, unless a stored leg leads from the stop before it into its id
(`<day>-together`): then the party's lane draws that drive, named for the rejoin's place ("Drive to Sunshine Village gondola base car park"), and
the next leg starts from the pin by the stored leg out of it. The back-solved day start (2.9 step 4) counts the same leg. Rockies Day 2 B carries
the two legs (Minnewanka back to the Sunshine car park 35, Sunshine to the Upper Hot Springs 30); no other day names its rejoin (S2D-SCHED).

Breaks on long drives:
- A drive over the break interval gets a `break` (`leg-stretch`, `fuel` or `coffee`) inside it. The interval is 90 min for a family with a youngest under 10, else 120 (`profile.break_every_min`).
- The break lands at the leg's midpoint, or at a named town on the way when the plan names one.
- The leg's minutes are split around the break.

### 2.6 Meals, breaks and buffers

| Meal | Adults window | Family window | Placement |
|---|---|---|---|
| breakfast | at the base before the start (not drawn) | same | drawn only when the start is before 07:00: "Breakfast packed" at the first stop |
| lunch | 12:00 to 13:30 | 11:30 to 13:00 | at the first boundary between entries inside the window. When a trail covers the whole window, a `meal` with `style: 'on-trail'` and `insideOf` the trail (no extra time). When a town or eatery is on the day near the window, sit-down; else picnic |
| dinner | 18:30 to 20:30 | 17:30 to 19:00 | at the base, unless the plan names a restaurant. An evening outing after dinner is kept in the authored order |

- **Buffers** (2.4) go between consecutive non-leg entries. The car park walk-in after a drive out to a trailhead is drawn as a `leg` (mode `walk`, "Walk to the start of ...", rule `park.walk-in`), not hidden in the trail's start (SW-022).
- A **gap** of more than 10 min (`FREE_ROW_MIN`) before a pinned entry becomes a `rest` entry ("Free time by the lake"); the walk-in follows the rest and ends at the pin.
- A gap of 10 min or less widens the buffer instead: the times on the rail add up to within 10 minutes.
- **Midday return to the base** (`MIDDAY_RETURN` in `core/src/config/schedule.ts`): on a normal or arrival day (after check-in), a wait of more
  than 120 min before a pinned stop (not the rejoin) is spent at the base when the drive back and the drive out are each at most 30 min and the
  data knows both (a stored leg or two points; never the 10 minute local move): "Back to <base>", "Rest at the base", lunch at the base when its
  window falls in the wait, then the leg out, timed to the pin. Otherwise the wait stays a Free time at the stop. Dolomites Day 2 (Braies at first
  light, Val Fiscalina at 14:00) waits at San Candido, not 5 h at the Fiscalina car park (S2D-SCHED).

### 2.7 Opening hours, last rides and slots

- Windows come from our data: `open_from` and `open_to`, closed weekdays, `last_up` and `last_down` for lifts, booking slot times.
- They are read for the season window. 2026 hours carry the `pattern_2026` chip.
- A visit before opening waits; the wait becomes `rest` when over 10 min.
- A visit that would end after closing, or a lift ride after the last ride up, raises a warning (2.11). The scheduler never moves an authored item to another day to fix it.
- Weekday closures cannot be checked on a dateless page. They show as a rule chip ("Closed Tuesdays") and turn into a warning once dates attach (dateless page, weekday rules).

### 2.8 Sun anchors

- `sun` entries are computed with `core/src/sun` (`sunDay`) at the day's base point, for the first and last day of the season window. Public pages show a range; dated copies show the real time.
- An item can declare `needs: { sun: 'sunrise' | 'sunset' | 'golden-pm' | 'civil-dusk' | 'nautical-dusk', offsetMin }`. Its start is the anchor time plus the offset at the window's midpoint, with `confidence: 'anchored'`. A `nautical-dusk` item (dark-sky watching) is never given a clock time: it follows the day as "After dark, about 21:05 to 22:10 in this window, if the sky is clear", outside the span, the cap and the totals, so it cannot land in daylight.
- Example: Braies with `sunrise -30` gives "about 05:00 to 05:30".
- Each day draws `sunrise` and `sunset` markers only when they fall inside the day's span or an entry is anchored to them. The design page decides how quiet they are.
- Polar days (Norway, Iceland in June) use `no-sunset` and skip the daylight check (`sunState` from `core/bin/sun.ts`).

### 2.9 The algorithm (`scheduleDay(input, profile, overrides) -> DayTimeline`)

1. **Choose the variant** (3.3) and, on a split day, the parallel lane.
2. **Resolve durations** per item with the ladder (2.2) and the multipliers (2.4). Record the source and basis text.
3. **Lay pins**: operator slots and authored times become pinned entries. Sun anchors resolve to times at the reference date.
4. **Set the day start**: the authored start; else back-solve from the first pinned entry (its time minus the legs and buffers before it); else the profile default. An early start before 06:00 is allowed only when it is pinned or anchored by the plan; otherwise `W_EARLY`. The plan's authored start of a split day is the family's: when the walkers' version (relation `parallel`) is scheduled on its own (no second lane drawn) and the back-solved start, from its first pinned stop other than the rejoin, is more than `LATE_START_SLACK_MIN` (60) later, the day leaves at the back-solved time (adults Day 4 A: 11:10 for the 12:30 Wilcox Pass, not 07:30 and a 3 h 20 wait). A start the person set or an operator's time never moves, nor does any pinned stop (S2D-SCHED).
5. **Forward pass** over the authored order:
   - the leg (2.5), with drive breaks;
   - a wait until the next pin or the opening time (a wait over 10 min becomes `rest`);
   - the park walk-in, drawn as a walking leg;
   - the entry;
   - the buffer.
6. **Insert meals and snacks** (2.6) at boundaries. If a meal would push a pinned entry late, it is shortened to its minimum (lunch 30) or becomes a picnic, before anything else moves.
7. **Back-pressure**: when an unpinned entry would end after a pinned one starts, reduce buffers to 5 min, then drop generated coffee and snacks, then raise `S_FIXED_MISSED`. Pinned entries never move.
8. **Close the day**: the leg back to the base (or on to the next base on a transfer day), `checkin`, a `rest` until dinner, dinner, any authored evening item, `end`.
9. **Round** suggested starts to 5 min (pinned and operator times stay exact). Compute `span` and `totals`. `totals.driveMin` is the sum of the drive legs as each is drawn (to 5 min), so the day header and the legs under it agree (SW-022).
10. **Validate** (2.11) and return.

The function is deterministic. There is no randomness, no clock and no locale. Entries tie-break by `(start, lane order, kind order, id)`.

`addItem(dayTimeline, input, item)` (3.7) runs cheapest insertion:
- it tries each boundary between unpinned entries;
- it picks the slot that keeps every pin, then dinner on time, then the earliest end of the day, then the least added leg time;
- it re-runs `scheduleDay` with the item inserted at that position.

It is the only path that changes order, and only for visitor items.

### 2.10 Authored overrides, stored as data

These are for things the rules cannot know: a time the owner chose, a slot, a rejoin point, a walk that takes longer than the formula says, a variant's audience. One file per trip: `data/schedules/<trip-slug>.json`, schema `trip-schedule/1`. The file is dateless: a test fails it on any calendar date (`DATE_TEXT` from `web/lib/public/dateless.ts`).

```json
{
  "schema": "trip-schedule/1",
  "trip": "canadian-rockies-2029",
  "defaultProfile": { "party": "family", "youngest": 10, "pace": "standard", "adults": 2 },
  "writtenFor": "families with a child from about 6",
  "variants": {
    "A": { "label": "Adults' hike", "audience": "adults" },
    "B": { "label": "Whole family", "audience": "family" },
    "C": { "label": "Easy day", "audience": "easy" }
  },
  "days": {
    "5": {
      "start": { "time": "07:30", "source": "plan" },
      "split": { "parallel": ["A"], "rejoin": { "time": "14:00", "place": "Maligne Lake boathouse car park" } },
      "items": {
        "maligne-lake-cruise": { "time": "10:00", "confidence": "fixed", "source": "plan", "note": "Book the 10:00 sailing", "durationMin": 90, "checkinMin": 20 },
        "pyramid-lake": { "needs": { "sun": "sunset", "offsetMin": -40 }, "optional": true },
        "moose-lake-loop": { "optional": true, "note": "if the child wants more" }
      },
      "insert": [],
      "legs": [{ "from": "base", "to": "maligne-lake-spirit-island", "minutes": 60, "basis": "plan", "estimate": true }]
    }
  },
  "places": {
    "banff-gondola": { "lastUp": "19:30", "open": ["09:00", "21:00"], "seasonNote": "2026 hours, 8 Sep to 12 Oct" }
  }
}
```

- `items` keys are item ids from the adapter, or place slugs. `insert` adds authored entries the source plan names but the item list lacks ("Groceries in Canmore", "Border crossing at Highgate Springs"), each with a kind, an `after`, a title and a duration.
- The Dolomites already carry authored times in the prototype (29 of 29 items). Its file adds only slots, sun anchors and legs.
- Legacy plans with time cells get their file from the L3d import (section 4), checked by a person before the times show as "From the plan".

### 2.11 Validation

The validation runs on every `DayTimeline` and per lane. It produces warnings, never errors. A warning is shown on the entry and counted on the day.

| Code | Fires when | Message pattern |
|---|---|---|
| `W_OVERLAP` | two entries in one lane overlap after legs | "Lunch overlaps the 10:00 cruise by 15 min." |
| `W_HOURS` | a visit starts before opening or ends after closing | "Ends 17:45; the museum closes at 17:00." |
| `S_LAST_RIDE` | a lift outing is not back down by `lastDown`, or starts after `lastUp` | "Last ride up is 19:30; this starts at 19:40." |
| `W_DAYLIGHT` | a trail or `needs_daylight` entry ends after sunset (trails: civil dusk -30 min) at the late end of the window | "Ends about 20:10; sunset can be 19:55 in this window." |
| `S_DAY_CAP` | the time away from base is over the profile's cap (2.4); time at the base never counts | "Day 5 runs 12 h 45, over 10 h for a standard family day. Optional: Pyramid Lake, Moose Lake Loop." |
| `W_PACE` | active time is over the `PACE_MIN` budget | as core |
| `W_DRIVE_LIMIT` | driving is over `daily_max_drive_min` (relaxed 180, standard 240, full 360) | as core |
| `W_EARLY` | an unpinned start before 06:00 | as core |
| `W_CEILING` | a trail is over the walk ceiling | "Bald Hills is 10.4 km; the ceiling for a 6 year old is 6 km." |
| `W_FIT` | an item's min age or height is over the party | "Canyoning is 5+; the youngest is 4." |
| `S_FIXED_MISSED` | back-pressure (2.9 step 7) could not reach a pin | "Arrives 10:10 for the 10:00 cruise." |
| `S_MIDNIGHT` | an entry would end after 23:59 | "Runs past midnight." |
| `S_NO_FIT` | no variant fits the profile (3.5) | "No version of Day 6 fits a 3 year old." |
| `S_HOME_BY` | the `at-home` end is later than its home-by window (3.12) | "Home 21:40, 40 min after your home-by of 21:00." |

`core/src/schedule/toItems.ts` maps a `DayTimeline` to planner `items` rows (`start`, `duration_min`, `type`, `leg_mode`, `leg_minutes`, `leg_basis`, `track`, `open_from`, `open_to`, `needs_daylight`). It does this so that `checkDays` from `core/src/checks` can run on the result. A test runs both on the fixtures: every `W_` code the scheduler raises, `checkDays` raises too.

### 2.12 Honesty wording (visitor-facing)

- Banner above the first day, once: **"Suggested times.** Built from the plan and our rules for your party. Times marked Slot are fixed by the operator; sun times are a range for the season. Check opening hours before you go."
- Summary trips add: "This plan was condensed, so most times are suggested by our rules."
- Legend, in the day header's info button: "~ suggested · Slot fixed · ☼ tied to the sun · ≈ estimated drive".
- An expanded entry says why: "~12:20 · Our rule: lunch 40 min, then the walk. Walk time: Naismith 51 min × 1.6 for a 6 year old."
- Never: "Optimised", "Perfect day", or a time to the minute without a source.

## 3. The party profile

### 3.1 The selector (top of the trip page, under the season band)

| Control | Values | Default |
|---|---|---|
| Who is going | **Adults** · **Family** with "youngest child" (0 to 17, a stepper; ages shown as "6 years") | the trip's `defaultProfile` (Rockies: family, 10), else adults |
| Pace | **Relaxed** · **Standard** · **Full** | standard |
| Adults | 1 · 2 or more (inside "More"; only matters for split days) | 2 |
| Longest walk | Any · 5 · 8 · 12 km (inside "More") | from the youngest age (2.4) |
| Split days | "Split when the plan allows" (only on trips with parallel variants) | off |

- Below the controls is one line: **"Showing the plan for a family, youngest 6, standard pace. 13 days family version · 2 days easy version. Written for families with a child from about 6."**
- A **Reset** link appears when anything differs from the default.
- On a phone the selector collapses to that line plus an Edit button that opens an inline panel. It is not a modal.
- The selector is shown only on trips with days (`full` and `summary`).

### 3.2 Variants and their relation

```ts
interface DayVariant {
  key: 'A' | 'B' | 'C' | 'main';       // trips without variants have one 'main'
  label: string;                        // from data/schedules variants, else "Adults' hike" / "Whole family" / "Easy day"
  audience: 'adults' | 'family' | 'easy' | 'any';
  relation: 'alternative' | 'parallel'; // parallel = runs at the same time as the party's lane, then rejoins
  items: ScheduleItem[];
  needs: { minAge: number | null; maxWalkKm: number; maxGainM: number; activeMin: number };   // derived
  rank: number;                         // A = 3, B = 2, C = 1, main = 2: how ambitious
}
```

| Source | Becomes |
|---|---|
| Rockies `track_a/b/c` | A `adults`, B `family`, C `easy`. On a `needs_split` day, A is `parallel` to B for a family profile and `alternative` for an adults profile. `rejoin` becomes the split's rejoin. |
| Dolomites `variant: 'A' / 'B'` items (Day 4) | two `alternative` variants. The audience is derived from the trail stats, or set in the overrides file. |
| Summary and other trips | one `main` variant. The profile still changes durations, meals, start times and the fit warnings. |

### 3.3 Selection rule (`selectVariant(day, profile)`)

1. **Eligible** variants:
   - Adults: all of them.
   - Family: `family`, `easy` and `any`. An `adults` variant is eligible for a family only when its `minAge` and walk ceiling fit the youngest. A family with a 14 year old can get Track A.
2. **Fits** means all of these hold:
   - `minAge ≤ youngest`;
   - the longest trail is within the ceiling (km and gain);
   - the activity is within `PACE_MIN[pace] × 1.1`.
3. Pick the **highest `rank`** that fits. A relaxed pace compares against the relaxed budget, so it lands on the easier variant when the harder one is long.
4. If none fits, pick the lowest rank and mark `fits: false` (3.5).
5. A **parallel** variant on a split day is offered when the party has two or more adults and the variant fits an adult. It is drawn as a lane only when `split=1`.

The selection always records its reason, shown in the day header's variant chip:
- "Family version: fits a 6 year old"
- "Easy version: the family walk is 1 h 50 over a relaxed day"
- "Adults' hike: the youngest is 14"

### 3.4 What the profile changes

| Profile input | Changes |
|---|---|
| party, youngest | variant per day; trail multiplier; walk ceiling; meal windows; snack breaks; day cap; drive break interval; `W_FIT` and `W_CEILING` |
| pace | `PACE_MIN` budget; day start; visit multiplier; buffers; coffee breaks; day cap; trail range end; drive limit |
| adults | whether split days can split |
| longest walk | overrides the age-derived ceiling |
| split | draws parallel lanes |

The whole-trip timeline (Day 1 to N) re-renders with each day's span, drive share and variant chip, so the effect is visible at once.

### 3.5 A day with no fitting option

- The day renders the lowest-ranked variant, so the timeline never has a hole.
- The day header carries a warning chip: **"Not suited to a 3 year old"**.
- The first row of the day says why, with numbers: "Every version of Day 6 includes Berg Lake viewpoint (9 km, 350 m). The youngest's limit is 4 km."
- It offers what our data has:
  - Rockies `family_alternative_id` and `less_walking_alternative`;
  - places of the same base with a fitting kind;
  - "Make this a rest day" (an `easy` stub: the town stroll and the base).

  Each opens the "add" flow (3.7).
- Nothing is dropped silently. The whole-trip timeline marks the day.

### 3.6 Per-day override

- The variant chip on each day is a menu: "Family version (chosen for your party) · Easy version · Adults' hike". Picking one sets `d=<day><key>` in the URL.
- The day header then shows **"Changed for this day · Reset"**, and the trip summary line counts the changes.
- An override wins over the profile even when it does not fit. The warning still shows.

### 3.7 "Add to this day"

- **Opened from:** a day's footer ("Add to Day 5"), or a place card elsewhere on the page.
- **Candidates:**
  - items from the day's other variants;
  - the trip's places that share the day's base;
  - catalog places within 30 km of the base that have a page (`listPlaces()` with a point).

  Free text is not allowed on the public page, and **only places are offered**: never a meal, a break or a rest. The scheduler alone generates those, so an added lunch can never double the plan's lunch (round 4 decision).
- The scheduler inserts the item (2.9 `addItem`), re-flows the day and shows the result in place.
- **The diff** is highlighted:
  - the new entry, marked "You added this";
  - the entries that moved, with a small "moved 40 min later" note (the real difference between the two starts, rounded to 5 minutes, paired by a stable entry id; nothing is said about an entry that did not move);
  - the generated entries the day no longer has room for ("Left out now there is less room: Rest at the base"), so nothing vanishes silently;
  - new warnings.
- **Dinner holds.** An added or optional stop that would push dinner past its latest start (19:30 for a family) is placed after dinner instead, with a warning naming it. When dinner cannot hold (a transfer day), the warning names what was added. Lunch is likewise kept: a stop that would run across the whole lunch window is preceded by lunch.
- **Generated ids** are named for the entry and the stop it precedes (meals: `<day>-<lane>-meal-lunch`, `-meal-dinner`), never for a running count, so adding a stop elsewhere does not rename them. `core/src/schedule/diff.ts` holds the comparison; `web/tests/trips/add-invariants.test.ts` checks every order of one to three added places on every Rockies and Dolomites day.
- **Adding a third or fourth thing is allowed.** When the day goes over its cap, the message gives numbers and names the optional entries to drop ("Day 5 is now 11 h 20, 1 h 20 over a standard family day. Optional: Moose Lake Loop."). The visitor removes an entry with its own "Remove" action.
- Added items live in the URL (`add=`), so a shared link reproduces the day.

### 3.8 URL state

Keys, in this order, after the path. Defaults are omitted. The existing `view` and the `#day-N` anchor are kept.

| Key | Example | Meaning |
|---|---|---|
| `p` | `p=adults`, `p=family-6` | party; `family-<youngest age>` |
| `pace` | `pace=relaxed` | relaxed, standard, full |
| `a` | `a=1` | adults count when 1 (no split lanes) |
| `walk` | `walk=8` | longest walk in km |
| `split` | `split=1` | draw parallel lanes |
| `d` | `d=5C,9A` | per-day variant overrides |
| `add` | `add=5.moraine-lake,5.lake-agnes-teahouse` | visitor additions, `<day>.<place-slug>`, in insertion order |
| `view` | `view=category` | existing |

Example: `/trips/canadian-rockies-2029?p=family-4&pace=relaxed&d=5C&add=5.pyramid-lake#day-5`.

- The codec is pure and lives in `core/src/schedule/profileCodec.ts`, so the planner can reuse it.
- Unknown or invalid values fall back to the default without an error. An `add` slug that does not resolve is dropped and the page notes "1 added place is no longer available".
- **Foundation edit requested:** patterns 1.2's trip page row should list these keys (coordinator routes it).

### 3.9 Copy to my trips, and ICS

- `CopyDraft` (`web/lib/export/draft.ts`) gains:
  - `profile: { party, youngest, pace, adults, walk, split }`
  - `overrides: Record<number, string>`
  - `added: { day: number; placeSlug: string }[]`
- The copy sheet prefills its traveller choice from the profile: adults, plus children with the youngest's age. When the visitor edits the children's ages in the sheet, the profile follows the youngest, and the page updates behind the sheet.
- **In the planner:** each day takes the chosen variant as its items.
  - Pinned times are copied as `start`.
  - Suggested times are copied as `start` with `pinned: false`.
  - Anchored times are recomputed for the real date.
  - On a split day both lanes copy as tracks A and B with their `day_tracks.split = true`.
  - Generated meals and breaks are copied as `meal` and `break` items, so the planner can delete them.
- **ICS** (dated copy only, as today):
  - all-day events per day, as now;
  - timed events for `visit`, `trail`, `booking`, `checkin`, sit-down `meal`, and `leg` of 45 min or more, at the computed times in the trip's VTIMEZONE;
  - each description starts with "Fixed slot", "Suggested time" or "Sun-timed", plus the source;
  - coffee, snacks, rest and sun markers are left out unless "Full detail" is ticked;
  - sun-anchored events use the real date's sun times.

### 3.10 What shows first and what expands (for the design page)

| Always visible | Expands |
|---|---|
| profile line and controls | "More" controls (adults, longest walk, split) |
| whole-trip timeline: every day with number, base, span (start to end), variant chip, drive share, warning mark | nothing; a tap scrolls to the day |
| each day: header (Day 5 · Jasper · 07:30 to 20:15 · 2 h 20 drive · 7.3 km walking), variant chip, the full entry list with times, legs as connectors with minutes, meals and breaks as compact rows | an entry: notes, Know before you go, place card and link, source of the time and duration, alternatives |
| the split option row on split days | the parallel lane (or `split=1`) |
| warnings as a count on the day header and a mark on the entry | the warning text and its fix |
| "Know before you go" title with a count | the bullets (3 shown, rest on "More") |

The timeline itself is never collapsed. Days are expanded by default; the old collapsed day row becomes the whole-trip timeline's item.

### 3.11 What the profile needs from suitability metadata ([research/suitability.md](../../../research/method/suitability.md))

The scheduler and `selectVariant` read one normalised record per item. The suitability spec owns the fields, their research, their sources and the grade mappings. This page owns only how the profile uses them. Until that spec lands, the adapter fills what it can (Rockies `min_age`, `child_6yo_ok`, `audience`, km and gain), and the rest stays `null`.

```ts
// core/src/schedule/suitability.ts: the contract the suitability spec fills
export interface Suitability {
  minAge: number | null;                 // hard operator or harness rule (via ferrata 12+)
  maxAge: number | null;
  minHeightCm: number | null; maxHeightCm: number | null;
  minWeightKg: number | null; maxWeightKg: number | null;
  rule: 'hard' | 'advice' | null;        // hard = operator or law; advice = our or a guide's recommendation
  stroller: 'yes' | 'partly' | 'no' | null;    // 'partly' carries a note (first 1.2 km paved)
  wheelchair: 'yes' | 'partly' | 'no' | null;
  carrierOk: boolean | null;             // a child carrier is sensible (no scrambling, no ladders)
  familyEffort: 1 | 2 | 3 | 4 | 5 | null;  // the family effort scale, mapped from SAC, CAI, IMBA, whitewater classes
  sourceGrade: { system: 'SAC' | 'CAI' | 'IMBA' | 'whitewater' | 'operator' | 'local'; value: string } | null;
  childTime: {                           // child-pace time where a source states one, else null (we use 2.4)
    byAge: { fromAge: number; minutes: number }[];
    source: string;
  } | null;
  adultTime: { min: number; max: number; source: string } | null;   // "4-5 h", in minutes
  distanceKm: number | null; gainM: number | null; lossM: number | null;
  provenance: string;                    // shown in the entry's "why"
}
```

How the profile uses it:

| Field | Used for |
|---|---|
| `minAge`, `maxAge`, the height and weight limits with `rule: 'hard'` | `W_FIT`, and the variant does not "fit" (3.3). Height and weight are checked only once traveller details exist (copy sheet or planner); the public page shows "Limits: 120 cm, 25 kg" as a chip |
| `rule: 'advice'` | a warning chip without excluding the variant |
| `familyEffort` | applies **together with** the km and gain ceiling, not instead of it (amended 18 Oct by research/suitability.md 6.1: a flat 14 km and a short exposed ledge are different problems). The default maximum by youngest age is: 0-3 carried, 2; 4-5, 2; 6-7, 3; 8-9, 3; 10-12, 4; 13-15, 4; 16+, 5. Grade 5 below 16 is advice only. Relaxed pace takes one level less. The suitability spec owns this table |
| `stroller`, `carrierOk` | under 4: a trail with `stroller: 'no'` and `carrierOk: false` does not fit |
| `wheelchair` | not a profile input in v1; shown as a chip. Open for later as an "access needs" control |
| `childTime` | wins over the 2.4 multiplier for the matching age band |
| `adultTime` | wins over Naismith; the range resolves by pace (2.3) |
| `distanceKm`, `gainM` | the walk ceiling when `familyEffort` is null, and the stats line |

### 3.12 Short trips: day trips, overnights and weekends ([features/short-trips.md](short-trips.md))

Short trips use the same model with no new entry kinds. Most are one timeline.

| Need | How the model covers it |
|---|---|
| origin and return legs | the input carries `origin: PlaceRef` (home, the household's home base in the planner, or "your start point" on a public page). The day opens with `start` `leave-home`, then a `leg` from the origin. It closes with a `leg` to the origin and `end` `at-home`. On a public page the origin legs are drawn only once a start point is given; until then they read "from your start point" with no minutes |
| leave-by | the `start` entry is back-solved from the first pin (2.9 step 4). When the trip states a leave-by ("leave by 08:10"), it is a pinned `start` with source `plan` |
| home-by | `end` `at-home` can carry `time.window = { to: "21:00", why: "home by" }`. Back-pressure (2.9 step 7) treats it like a pin from the other side: drop generated coffee, then cut optional entries, then raise **`S_HOME_BY`** ("Home 21:40, 40 min after your home-by of 21:00. Optional: Dwight Beach sunset.") |
| day-use permit slots | a `booking` `day-use-permit` entry with `time.window` (the permit's valid hours, Algonquin 07:00 to 22:00) and `fixed` confidence for a timed slot (the Elora tubing slot). The booking rule ("sold online 5 days ahead at 07:00") stays a Logistics row relative to the day |
| a long drive with breaks | the drive breaks in 2.5 apply to origin legs (Vermont's three 20 min breaks) |
| overnight and weekend | 2 or 3 days of the same model. Night 1's `checkin` ends Day 1; the last day ends `at-home` |
| profile | the same selector. On a one-day trip the whole-trip timeline is hidden and the day timeline is the page |

New validation code: `S_HOME_BY`, added to 2.11. The `origin` field and the home-by window go into the scheduler types in L3c, so the short-trips lane only supplies data.

## 4. Data audit: the 14 public trips

Sources checked on 18 Oct 2026:
- the adapter output (`createPublicData()`, every trip);
- `legacy/*/PLAN.md`;
- the `class="time"` cells of `legacy/*/index.html`;
- the Rockies `data/*.json`.

"Clock cells" are authored times of day in the legacy page.

| Trip | Depth | Days | Items (adapter) | Times now | Durations | Coordinates | Legs | Authored times in legacy | What can be derived | Schedule quality | Effort |
|---|---|---|---|---|---|---|---|---|---|---|---|
| dolomites-2027 | full | 14 | 29 (26 linked to place pages) | **29 of 29** (prototype `time`) | 26 of 29 | all places, 4 of 4 bases | day `driveMin` (≈) | 26 clock cells | ORS legs (coordinates exist); sun anchors (Braies dawn) | **real**: authored + fill | S (2 h) |
| canadian-rockies-2029 | full | 15, tracks on all 15, 7 split days | 105 (3 linked) | 0 as fields; about 80 clock times inside track notes, plus `rejoin` times | trails 33 of 33 hours; sights `time_needed_hours`; adventures none | none (map URLs are text queries; 3 via locations.json) | day `drive` text (INFERENCE); base matrix | 10 cells, 12 PLAN rows | slots, starts and rejoins lifted from notes into the overrides file; trailhead points from L4b when it lands | **real** after extraction | M (5 h) |
| patagonia-2027 | summary | 14 | 25 | 0 | 25 of 25 | none | day `driveMin` | **37** clock cells (ranges) | import of the time cells | real after L3d import | M |
| iceland-ring-road-2027 | summary | 12 | 28 | 0 | 28 of 28 | none | day `driveMin` | **37** | import | real after L3d | M |
| algonquin-muskoka-2026 | summary | 3 | 7 | 0 | 7 of 7 | none | day `driveMin` | **24** (minute-level, with legs) | import; the plan has more entries than the 7 stops | real after L3d | S |
| vermont-fall-2026 | summary | 4 | 8 | 0 | 8 of 8 | none | day `driveMin` | **49** (breaks, legs, check-in) | import; adds about 30 entries the stop list lacks | real after L3d | S |
| chamonix-mont-blanc-2028 | summary | 9 | 15 | 0 | 15 of 15 | none | day `driveMin` | 6 cells (first cabin 08:10, lift times) | rules plus 6 anchors | partly authored | S |
| utah-five-parks | summary | 11 | 21 | 0 | 21 of 21 | none | day `driveMin` | 0 clock; part-of-day labels ("Day 4 · sunset", "Day 5 · dawn") | sun anchors from the labels; rules | suggested only | S |
| niagara-day-2026 | overview | (1) | 0 | 0 | | | | **15** (minute-level, one day) | convert to 1 day, then import | real after conversion | S |
| new-hampshire-stopover-2026 | overview | (2) | 0 | 0 | | | | **12** (breaks, border) | convert, import | real after conversion | S |
| quebec-2026 | overview | (3) | 0 | 0 | | | | **12** | convert, import | real after conversion | S |
| switzerland-2027 | overview | (15) | 0 | 0 | | | | **21** | convert (15 day sections), import | real after conversion | M |
| costa-rica-2027 | overview | (11) | 0 | 0 | | | | 4 clock, plus part-of-day labels; PLAN day table (base, activities, drive) | convert the day table; rules; tide anchors are out of scope | suggested only | M |
| norway-summer-2028 | overview | (15) | 0 | 0 | | | | 5 clock, plus part-of-day labels | convert; rules; midnight-sun handling | suggested only | M |

**Headline:**
- **Today, 1 trip has real times in the public data (Dolomites).** The note that "no trip has times" holds for 13 of 14: the prototype's Dolomites items all carry `time`.
- **10 of 14 can get real, mostly authored schedules:**
  - Dolomites, now;
  - the Rockies, after lifting the times out of the track notes;
  - 8 more, after importing the legacy pages' time cells: Patagonia, Iceland, Algonquin, Vermont, Niagara, New Hampshire, Quebec, Switzerland. The legacy pages hold about 330 authored clock times across 12 trips. The adapter drops them today.
- **4 get suggested-only schedules from rules and sun anchors:** Chamonix (partly anchored), Utah, Costa Rica, Norway.
- **6 overview trips need converting to days first.**
- **No trip outside the Dolomites has coordinates for its stops,** so their legs stay ≈ until points exist. The coordinates can come from L4b's trailheads, from locations.json, or from a sequential OSM lookup.

**Phasing.** L3c builds the model, the scheduler and the UI against the Dolomites and the Rockies, and gives the 6 summary trips rule schedules marked "suggested". L3d (to brief after L3c merges) has three parts:
- import the legacy time cells into `data/schedules/<slug>.json` for the 10 trips that have them;
- convert the 6 overview trips to days;
- have a person check each import. About 10 min a trip; the owner or the coordinator does it.

## 5. Cleaning public prose

`web/lib/public/prose.ts`, pure, run by the adapter on every public string: titles, summaries, notes, booking notes, the Rockies `decision_rule`, `wet_weather` and `status_flags`.

### 5.1 Markers become chips

| Marker in research text | Example | Public text | Chip (new `HonestyId`) | Tooltip |
|---|---|---|---|---|
| `INFERENCE`, `matrix INFERENCE`, `researcher INFERENCE` | "about 1 h each way (INFERENCE, not in the matrix)" | "about 1 h each way" | `estimate`: **Estimate** (dashed) | "Worked out by us, not read from a source." |
| `CALC` | "sunset (20:16 CALC)" | the time is replaced by the computed sun range: "sunset (about 19:55 to 20:30)" | none: the sun entry says "Sun, computed for the season" | |
| `GAP`, `hours GAP`, `2029 GAP` | "cave-and-basin; hours and admission GAP" | "Hours and admission: not known yet." | `not_known`: **Not known yet** | "We looked and found no reliable figure." |
| `conflict` | "Parks Canada 28 Aug-2 Oct; a blog says 1 Sep-6 Oct; 2026, conflict" | the official value, made dateless | `sources_disagree`: **Sources disagree** | both values with their sources |
| `low confidence`, `blogs`, `unsourced` | "(2025-26 blogs, low confidence)" | the parenthesis is removed | `low_confidence`: **Low confidence** | "From blogs, not an official page." |
| `2026 hours used`, `2026 terms`, "(2026: ...)" | "2026 hours 8 Sep-12 Oct 09:00-21:00" | "Hours in 2026: 09:00 to 21:00 in this season" | existing `pattern_2026` | as today |
| `VERIFIED`, `checked` | | the marker is removed | none | |
| `status_flags` lines | "GAP: Maligne Canyon status in 2029" | a Know before you go bullet: "Maligne Canyon: status for your dates not known yet." | `not_known` | |

- A chip attaches to the sentence it came from. In the timeline it sits on the entry. In a Know before you go bullet it sits at the bullet's end.
- **Test:** no public string in `web/out` or in the adapter output matches `/\b(INFERENCE|CALC|GAP)\b|low confidence|\(\s*\d{1,2}:\d{2}\s+CALC\)/`.

### 5.2 Units through the preference

- Prose quantities are parsed into tokens: `{ value: 1.9, unit: 'km' }`, `{ value: 500, unit: 'm', dim: 'elevation' }`, `{ value: 12, unit: 'C' }`, `{ value: 30, unit: 'm', dim: 'distance' }`.
- Note text becomes `ProseRun[]` (text and quantity runs). The `<Prose>` component renders each quantity through `web/lib/format/prefs.ts`, so "1.9 km" and the item line's "1.2 mi" agree.
- **Rules:**
  - `m` next to a km figure, or with up, climb, gain or elevation, is elevation. Otherwise a `m` under 1000 is a distance. "min" is never metres.
  - A number inside a name is never converted: Highway 93, 1A, Route 100, P4 and similar, by an allow-list of road and lot patterns.
  - Ranges convert as ranges ("10-12 km").
  - Converted values round to the same number of significant figures as the original.

### 5.3 Long notes become "Know before you go"

- A note over 2 sentences or 240 characters is split into sentences.
- The first sentence stays as the entry's lead line.
- The rest become bullets, each classified by keyword:

| Group | Keywords |
|---|---|
| Book | book, reserve, slot, ticket, sells out |
| Getting there | lot, parking, shuttle, road, park and ride |
| With kids | child, stroller, carrier, toilet |
| Conditions | closed, status, bears, grizzly, snow, rain |
| Decide on the day | `decision_rule` |
| If it rains | `wet_weather` |
| Other | anything else |

- The groups always appear in that order. Three bullets are visible; the rest go behind "More".
- Day-level notes (`summary`, `decision_rule`, `wet_weather`, `status_flags`) go to the day's Know before you go. Item notes go to their entry.

## 6. Edge cases

| Case | Rule |
|---|---|
| **Split days** (`needs_split`, Rockies 2, 5, 7, 9, 10, 11, 13) | Family profile with 2+ adults: lane B drawn, plus a "Split option" row naming lane A, its duration and the rejoin. `split=1` draws both lanes with a shared `rest` entry "Together again" at the rejoin time (pinned, plan). One adult (`a=1`): no split option; lane A is not offered. Adults profile: A is the whole day, no split. |
| **"If Track A is taken" rejoins on non-split days** (3, 4, 6, 8, 12) | treated like a split day, but the split option row is quieter ("One adult could split off"). |
| **Arrival day** | `start` is `land` at the plan's arrival time, else 10:00 with "arrival time not set". Then `arrival.car-hire` 60 min, groceries when the plan says so, a leg, `checkin` (the stay's window, else from 15:00), and a light item. The day cap is 6 h after landing for a flight over 5 h. Rockies Day 1 runs Fenland Loop, then Vermilion Lakes anchored to the last hour before sunset. |
| **Departure day** | `checkout` 10:00 (stay data, else rule), items that fit, a leg to the airport, `end` "at-airport" 3 h before an international flight. The flight time is unknown on a public trip, so the end reads "At the airport by 3 h before your flight" and the last activity is checked against a 17:00 flight, with that assumption stated. In a dated copy with a flight booking the anchor is fixed. |
| **Transfer days with no base** (Iceland camper, Lake Louise to Jasper) | the day runs base A to base B; `end` is `at-next-base`; check-in at B. No `rest` at a base mid-day. |
| **Days with no base at all** (`baseId: null`) | the scheduler starts from the first item. The start is the profile default with "start point not set". Legs before the first item are not drawn. |
| **Time zones within a day** (Golden in Mountain time, Vermont and Québec) | each entry carries `tz`. A zone change inserts a zero-length marker "Clocks go back 1 h (Pacific time)" between the entries, and the span uses elapsed minutes. |
| **Midnight sun** (Norway, Iceland in June) | `no-sunset` marker; `W_DAYLIGHT` off; late authored items (Reinebringen at 22:00) are allowed; the cap still applies. |
| **Overnight in a hut** (Chamonix Lac Blanc, optional) | `checkin` at the hut ends the day. The next day starts at the hut. |
| **Day 0** (New Hampshire "Day 0 notes") | allowed; `n` runs 0..N (as `E_DAYS_CONTIGUOUS`). Day 0 has no cap. |
| **Authored time that breaks a rule** (lunch at 14:00) | the authored time wins. A warning shows only for a hard check (overlap, hours, last ride, daylight). |
| **Overview-only trips** | no selector and no timeline. The existing banner "This plan has not been converted to days yet." Copy and ICS keep their current overview behaviour. |
| **Summary trips** | the selector works. Every time is `suggested` unless L3d has imported times. The banner adds the condensed line (2.12). |
| **Unknown duration and unknown kind** | the rule table is total. An item with no matching kind uses `activity.default` and carries `not_known` "duration not known". |
| **Two items at the same place in a row** | no leg; a 5 min buffer. |
| **A slot earlier than the day start allows** (Moraine shuttle 06:30) | the start back-solves from the slot. A start before 06:00 is allowed because it is pinned; the day header shows "early start". |

## 7. Build

- [L3c-trip-timeline.md](../build/public-site/L3c-trip-timeline.md):
  - the core scheduler (its own step, first);
  - the overrides for the Dolomites and the Rockies;
  - the ORS legs for the Dolomites;
  - the adapter and the prose cleaner;
  - the UI;
  - copy and ICS.
- L3d: the legacy time-cell import and the overview conversions. The brief follows after L3c merges (section 4).

## 8. Acceptance criteria (feature level)

1. Every full and summary trip page shows a whole-trip timeline (Day 1 to N) and a per-day timeline with times. Overview pages show neither.
2. Each time shows its confidence and, expanded, its source. The banner "Suggested times" is present.
3. Changing the profile changes the variant, times and warnings on every affected day, in place, with URL state. Back restores the previous profile.
4. `/trips/canadian-rockies-2029?p=adults` shows Track A on every day that has one. The default (`family-10`) shows B, with split options on the 7 split days. `?p=family-3` shows the no-fit chip on every day whose easiest variant exceeds a 3 year old.
5. A per-day override and an added item survive reload and a shared link, and re-flow the day with the diff marked.
6. No public string contains INFERENCE, CALC, GAP or "low confidence". Prose quantities follow the unit preference.
7. The validation fixtures pass. The scheduler and `checkDays` agree on shared codes.
8. A copy carries the profile, overrides and additions. The ICS for a dated copy has timed events at the computed times with their confidence in the description.

## 9. Open questions for the owner

| # | Question | Recommendation |
|---|---|---|
| 1 | The default profile on each trip: the party the plan was written for (Rockies: families with a child from about 6), or a neutral "adults, standard" for everyone? | The written-for party. It is the plan as researched, and the line "Written for ..." says so. |
| 2 | Generated meals and coffee breaks: show them in the timeline by default, or behind a "Show breaks" toggle? | Show them as compact rows. They are what makes the day feel real, and they are clearly marked suggested. |
| 3 | "Add to this day": only places in this trip and the catalog within 30 km of the base, or any catalog place? | Trip plus 30 km. It keeps legs plausible and the list short. |
| 4 | L3d imports about 330 authored times from the legacy pages. Will you skim each imported trip (about 10 min each) before its times show as "From the plan", or should they show as "suggested" until checked? | Show them as suggested until checked, then flip trip by trip. |
| 5 | The pace and child-age numbers in 2.4 (day caps, walk ceilings, the 1.6 multiplier at 6 to 7) are rules of thumb. Accept them as the starting point? | Accept. Tune after the first trips render; they live in one file. |

## 10. Gotchas

- The Rockies `date` fields ("Wed 12 Sep") and `recommended.start` must never reach the timeline. The scheduler input has no date field at all.
- The Rockies track notes hold the authored times as prose ("Leave Jasper 07:30. Book a 10:00 cruise"). Lift them into `data/schedules/canadian-rockies-2029.json` by hand, with a script's help, and check them. Do not regex them at build time.
- `parseDriveMin` in `trips.ts` reads "about 1 h each way" as 60 for the day. The scheduler needs per-leg values: out 60, back 60.
- Static export: the profile lives in the query string, which a static host ignores. The pre-rendered HTML is always the default profile, and the client re-renders. Never `generateStaticParams` per profile.
- The ORS key is in `web/.env.local`. The legs script must not echo the request URL (the key is a query parameter in some ORS examples; send it as the `Authorization` header).
- Parallel Commons or ORS calls from several agents trip rate limits. The legs script runs from one lane, sequentially.

## Change log

| Date | Change |
|---|---|
| 2026-10-18 | First version. Supersedes the per-day Track A · B · C segment (L3 step 9, patterns 3.4). |
| 2026-10-28 | S2D-SCHED (the S2D-LEG report's four code causes): the hub rung never sends a transfer-day stop back through its start base (2.5); a rejoin pin a stored leg leads into draws that drive (2.5); a long wait near the base is spent at the base (2.6, `MIDDAY_RETURN`); the walkers' version on its own leaves when it needs to (2.9 step 4). Published days that change: Rockies Day 2 B (drive 1 h 30 to 2 h 10, ends 19:25), Dolomites Day 2 (back to San Candido for the midday, `S_DAY_CAP` gone); Rockies Day 4 A and Day 1 B change only for parties that pick them. Tests: `core/test/schedule/s2d-sched.test.ts`, `web/tests/trips/s2d-sched.test.ts` |
| 2026-10-28 | SW-022 (S2-LEG): a wait over 10 min is a row (was 20); the car park walk-in is a walking leg; the day's drive total is the sum of the drawn legs. A stop moved to another day gets real legs (template.ts: point to point from `placePoint`, else the stored way from its own base plus the drive between the bases, else `MOVED_STOP_LEGS`), always ≈ |
