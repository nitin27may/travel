# Short trips: day trips, overnights and weekends

Status: spec, 18 Oct 2026. Owner request of 18 Oct 2026. Written by travel-planner (Opus).

This page covers trips of 0 to 3 nights. It builds on:
- [trip-timeline.md](trip-timeline.md), which governs the timeline data and rules;
- [public-trips-dateless.md](../design/public-trips-dateless.md);
- [F02](F02-trip-creation-and-trip-types.md);
- the core trip schema (`core/src/schema/trip.ts`);
- the public adapter types (`web/lib/public/types.ts`).

A short trip is mostly one timeline. This page adds what that timeline lacks for a trip that starts and ends at home: the trip-level frame (leave by, home by, both drives, permits, go/no-go, a bring list) and a compact page.

**This page supersedes or amends:**
- **F02**, "Trip types": the Day trip and Weekend rows. Length now comes from the night count (section 2.1). F02's type profiles (family, couple and the rest) stay.
- **Core `DURATION_SHAPE` and `shapeForNights`** (`core/src/validate/trip.ts`): the bands are day-trip 0, weekend 1-2, short-break 3-5. Section 2.1 replaces them. The core change waits for the planner schema milestone. The public adapter uses the new function now.
- **[public-trips-dateless.md](../design/public-trips-dateless.md)**, the row "Day 3 (and 'Sunday' nowhere)". A short trip with a weekday pattern may name the weekday ("Day 1 · Saturday"), because a pattern is not a date (section 2.4). **This waits for the owner (Q1).** Until he answers, the page shows Day N only, and the pattern line carries the weekday.
- **trip-timeline.md 1.1** refers to a "home-by anchor (3.12)" that it never defines. Section 2.3 defines it.

## Key decisions

| # | Decision | Why | Trade-off |
|---|---|---|---|
| K1 | **The length class is derived from the night count, never stored**: day (0), overnight (1), weekend (2), long weekend (3), multi-day (4+). A separate, stored **weekday pattern** says when it fits (a Saturday; Fri to Sun; Sat to a holiday Monday; midweek; any day) | Nights are a fact. Whether a trip is a "weekend" also depends on the weekdays: Québec is 2 nights from Tuesday to Thursday, and Algonquin is 2 nights from Saturday to Thanksgiving Monday | Two fields instead of one. The card label combines them: "2 nights · midweek", "2 nights · long weekend" |
| K2 | **Short = 0 to 3 nights.** Short trips get the compact page and the outing frame. Trips of 4+ nights keep the L3c page | One threshold, easy to test. Three nights is the longest trip still planned as a single drive out and back | A 4-night trip from home (a cottage week) gets the full page. That is right: it has a base |
| K3 | **The outing frame is data next to the schedule**: origin, return point, leave by, home by, permits and slots, go/no-go checks, Plan B, a bring list and cost lines. It goes in `data/outings/<slug>.json` (`trip-outing/1`), not in L3c's `data/schedules/` file | L3c owns `data/schedules/`. Disjoint files let the two lanes run in parallel. The outing frame is trip-level, while the schedule is per day | Two files per short trip. Both are dateless and tested |
| K4 | **Leave by and home by are outputs of the scheduler**, not authored text. Leave by is solved back from the first pinned entry (a slot, an opening time, a sun anchor). Home by is the end of the drive back. An authored **home-by target** ("home by 20:00 for bedtime") is a constraint that raises `S_HOME_BY` when it is missed | One source of truth. A visitor who changes pace or party sees both times move | Authored leave times in the legacy plans ("Out 8:00 AM") become pins only when they carry a reason |
| K5 | **The household's origin is household data and never public.** Public pages use a neutral hub, "from Toronto" by default. The visitor can pick another hub (Hamilton, Ottawa, Montréal), or use their own location, which stays in the browser and gives a straight-line estimate marked ≈ | Whitby appears in the built public output today (section 4.4). The family's town should not be published, and a visitor in Ottawa does not care about Whitby | Every short trip's drives are recomputed from the hub at publish time. The authored Whitby legs are kept only in the private plan |
| K6 | **Drive times come from ORS, at publish time, on the server**: a hub-by-destination matrix, stored and committed. They never come from Google. In the planner, they come from the household's origin through `leg_cache` (01-domain-model 2.7) | ORS's free matrix (500 a day) covers 4 hubs times about 20 short trips in one run. The terms let us store the result. Google's terms do not allow us to store its coordinates or times | No live traffic. Traffic becomes authored rules of thumb, labelled as such (2.6) |
| K7 | **Go/no-go is a list of typed checks with a time to decide**, not a weather paragraph. The kinds are weather, status page, river flow, permit sold out and colour report. Each check names its source, a threshold and the Plan B it triggers | Elora (river flow over 8 m³/s closes tubing) and Algonquin (no permit means Plan B) are decided by one check each, the evening before or that morning | It extends core `weather_rules`, which handles only weather (2.5) |
| K8 | **Permits and timed slots are first-class**: a release rule (days before, a time, a zone), the channel (online only, gate), walk-up yes or no, refund terms and requirements (height, swimming). They render on the page as a "Book ahead" card and in the timeline as `booking` entries | The day hangs on them. Algonquin day permits open at 07:00 ET, 5 days before, and all sales are final (Ontario Parks FAQ, read 18 Oct 2026) | None. The same rule shape as `BookRule` |
| K9 | **The public site gets the read side before go-live** (the length class, a filter, drive from Toronto, the compact page, the privacy rewrite). **The planner gets the creation flow later** (from a place or a template, pick a day and origin, the schedule is generated) | Public site first (product direction). The creation flow needs accounts and the household | The public "Add to calendar" for a short trip asks for one date in the browser. No account is needed (3.4) |

## 1. Benchmarks

Read 18 Oct 2026. Where a claim could not be confirmed from a primary page, the row says so.

| Product | What it does for short trips | What makes it quick | Take for us | Source |
|---|---|---|---|---|
| **Google Maps: lists, and "Set depart or arrive time"** | Save places to lists, share a list as a link that others follow. Directions accept "Arrive by" and suggest when to leave, with a predicted-traffic range ("typically 22 to 45 min"). Timeline is a record of past visits, organised by time and place | One tap to save. "Arrive by" turns a fixed time into a leave time | **Leave by is solved back from a fixed time** (K4). Show drive time as a range when it is an estimate. A shared short trip opens without an account | [Google: lists](https://blog.google/products/maps/keep-track-your-favorite-places-and-share-them-friends/); [Saved tab help](https://support.Google.com/maps/answer/9948049); depart and arrive time from third-party guides ([Perkins](https://www.perkins.org/resource/setting-departure-time-google-maps/)), not Google's own help page |
| **Wanderlog** | Day-by-day plan with travel time and distance between stops and **daily totals**. A route optimiser reorders stops. Plans work offline. Exporting to Google Maps is a paid feature | Totals per day show at a glance whether a day is too long | Day totals in the leave-by and home-by bar. **No optimiser on the public page**: L3c D3 keeps the authored order | [App Store listing](https://apps.apple.com/us/app/wanderlog/id1476732439) (marketing text) |
| **Roadtrippers** | Waypoints with notes and budget. The "Measure" tool shows where N hours or km of driving lands from a waypoint. Round trip and reverse in one action. Adding dates assigns them to waypoints | **"N hours from here"** as a first-class query. Round trip in one action | "Within N h" filter (section 4). Out and back are drawn by default for short trips | [Planning a trip](https://support.roadtrippers.com/hc/en-us/articles/200632079-Planning-a-Trip); [Measure drive time](https://support.roadtrippers.com/hc/en-us/articles/34399213711124) |
| **Komoot** | Plan a tour: pick the sport, then a start point. Duration is estimated from distance, climb and **your fitness level**. Discover tours by sport and location, filtered by duration and difficulty | Start point plus sport plus fitness gives a time with no typing | Matches L3c's pace and child multipliers. Filter short trips by "on foot" totals as well as drive | [road.cc guide](https://www.road.cc/content/feature/getting-started-komoot-280827); [Komoot features](https://www.komoot.com/en-us/features) |
| **AllTrails** | Custom routes (Peak tier, 2025): tap points or draw, or modify an existing route; "shorten" and "less climb" adjustments; offline maps | Start from an existing route and adjust | The template-first flow (3.1). AllTrails stays link-only (its terms) | [Tom's Guide](https://www.tomsguide.com/wellness/fitness/i-tried-alltrails-new-custom-routes-tool-and-its-a-game-changer-for-hikers-bikers-and-runners); [PopSci](https://www.popsci.com/gear/alltrails-peak-subscription-hiking-app/) |
| **Airbnb flexible search** | "I'm flexible": search by trip length (a weekend, a week, a month) and months, not dates. Results come with specific open dates | **Length and a month instead of dates.** This is our dateless model | The weekday pattern plus season window (2.4), and "next 4 matching Saturdays" chips when a date is picked (3.4) | [Airbnb newsroom](https://news.airbnb.com/new-flexible-search/); [Engadget](https://www.engadget.com/airbnb-flexible-search-140306311.html) (2021 launch; the current UI was not checked) |
| **Booking.com weekend flows** | No primary source found for a "this weekend" or "within N h" search in the current UI. Secondary guides note that weekend rates are higher than weekday rates | | No input. We do not sell stays (09-reservations) | searched; none found |
| **Ontario Parks day use** | Advance daily vehicle permits open **at 07:00 ET, 5 days before** arrival. Select parks sell **2 h and 4 h slots** as well as a full day. Sales are final (cancel within 2 h of purchase for a refund). Walk-up only if space remains. Automatic-gate parks need a reservation. A day-use availability map shows other parks with space | The release rule is exact, so a reminder can be exact | `Permit.opens` as a rule; `walkUp: false`; refund terms on the card; "nearby parks with space" as Plan B text | [Ontario Parks day-use FAQ](https://ontarioparks.ca/dayuse/faq) |
| **GRCA Elora Gorge tubing** | Online only, **up to 3 days ahead**, no walk-ups, an online waiver. 2026 season 26 Jun to 7 Sep. Last registration 16:00. Closes without notice on high water. Everyone 122 cm and over | | A slot rule with requirements; a river-flow go check | [GRCA tubing](https://www.grandriver.ca/outdoor-recreation/tubing/); [2026 opening release](https://www.grandriver.ca/news/posts/elora-gorge-conservation-area-tubing-opening/) |
| **Conservation Halton (parkvisit.ca)** | Reservations recommended, not required (current page). The COVID-era system used 2 h slots | | Some permits are "recommended", not "required": `required: false` | [Conservation Halton](https://www.conservationhalton.ca/?p=736) (current policy not confirmed on parkvisit.ca) |
| **"Day trips from Toronto" pages** (Lonely Planet, Afar, Toronto Tourism) | Each entry has a drive time from downtown, what to do, where to eat, and sometimes GO train access. Times differ by source (Niagara is given as 1 h 30 to 1 h 45) | **Drive time from the city is the first fact on every entry** | A drive-from-hub chip on every short-trip card. Our times are routed and dated, with the basis shown | [Lonely Planet](https://www.lonelyplanet.com/articles/day-trips-from-toronto) (page body not readable by our fetch); [Afar](https://www.afar.com/magazine/easy-day-trips-from-toronto); [Toronto Tourism](https://www.torontotourism.org/day-trips-from-toronto/) |
| **Our own vault list** (`research/vault-notes/Day Trips Local.md`) | 40 destinations grouped by drive band from home: under 30 min, 30 to 60 min, 1 to 2.5 h. Tips by outing type (beach, hike, park) | Bands, not exact minutes, are how a family chooses | The drive bands (4.2). Packing by outing type feeds the bring list (2.7) | repo |

**What makes a short plan quick, in all of them:**
1. a **start point** set once (home, or a city);
2. **one fixed time** that sets the rest (a slot, an opening time, sunset, "arrive by");
3. **time budgets** you can see: drive each way, on foot, the day's span;
4. a **template** or an existing route to start from, instead of a blank page;
5. **one-tap adds** to a list or a day, and one-tap share.

None of the benchmarks handles a go/no-go decision or a permit release rule. Both are where the family's real short trips fail (Algonquin's Sunday permit, Elora's river level), so they are our edge.

## 2. The schema

### 2.1 Length class (derived)

```ts
// core/src/derive/length.ts (pure; shared by web and planner)
export type LengthClass = 'day' | 'overnight' | 'weekend' | 'long-weekend' | 'multi-day';
export function lengthClass(nights: number): LengthClass {
  if (nights <= 0) return 'day';
  if (nights === 1) return 'overnight';
  if (nights === 2) return 'weekend';
  if (nights === 3) return 'long-weekend';
  return 'multi-day';
}
export const isShort = (nights: number) => nights <= 3;
```

| Class | Nights | Filter label | Card label (with the pattern, 2.4) |
|---|---|---|---|
| `day` | 0 | Day trips | "Day trip · a Saturday" |
| `overnight` | 1 | Overnights | "1 night · any day" |
| `weekend` | 2 | Weekends (2 nights) | "2 nights · a weekend", "2 nights · midweek", "2 nights · long weekend" |
| `long-weekend` | 3 | Long weekends (3 nights) | "3 nights · a long weekend" |
| `multi-day` | 4+ | (L3b length bands: 4-8, 9-14, 15+) | as today |

- The night count is the number of nights away from home. A Day 0 drive day (New Hampshire) counts its night.
- The core `duration_shape` stays until the planner schema milestone, then becomes derived (the validator already forces it to equal a function of `nights`, so storing it adds nothing). The planner adopts `lengthClass`. **Gotcha:** until then, core says a 3-night trip is a "short-break" and the public site says "long weekend". Only the public site shows labels, so nobody sees both.

### 2.2 What a short trip needs that a long one does not

| Need | Field (public adapter, additive) | Planner (core, later) | Notes |
|---|---|---|---|
| Origin and return point | `outing.origin: { hub, label, point }`, `outing.returnTo: { kind: 'origin' \| 'place' \| 'trip', label, point, trip?: TripRef }` | `trip.origin` (**mark `private: true`**, it is not today), `trip.origin_tz`; new `trip.return_to` | Québec and New Hampshire end in Hyde Park, Vermont (`returnTo.kind = 'trip'`, the Vermont trip). All others return to the origin |
| Leave by, home by | `outing.leaveBy`, `outing.homeBy`: `{ time, confidence, reason }`, computed by the scheduler for the default profile and re-run in the browser | computed; `trip.home_by_target` (hh:mm, nullable) | 2.3 |
| Drives both ways as first-class legs | the day's first `leg` (origin to the first stop) and its last (last stop to `returnTo`), with `leg.role: 'out' \| 'back'` | `items` type `transfer` with the `leg_*` columns; `routes` for the polyline | The out and back legs are drawn on the map and counted in the bar. The out leg carries the drive breaks (trip-timeline 2.5) |
| Drive from a hub | `outing.fromHubs: { hub, minutes, km, basis: 'routed' \| 'estimate', fetched }[]` | `leg_cache` from the household origin | 4.1 |
| Permits and timed slots | `outing.permits: Permit[]` (below) | `trip_bookings` with `category: 'permit'`, `book_by_offset`, `book_by_basis: 'release'` | They render as `booking` entries in the timeline (trip-timeline 1.1 `sub: day-use-permit`, `timed-entry`) and as the "Book ahead" card |
| Go/no-go and Plan B | `outing.goChecks: GoCheck[]`, `outing.planB: { title, summary, variantKey } \| null` | a new `go_checks` table that absorbs `weather_rules` (2.5); Plan B is `day_tracks` track `P` (exists) | Plan B is a day variant with `audience: 'plan-b'`. The L3c variant selector already shows it as an alternative |
| One-day bring list | `outing.bring: { item, why, fromEntry: string \| null }[]`, mostly derived (2.7) | `packing`; `PACKING_REASON` gains `swim`, `cash`, `permit`, `offline`, `footwear` | Short list, at most 10 rows |
| Meals on the road | no new field: `meal` entries with `style`. Add `'packed'` and `'roadside'` to the meal styles, and `onTheWay: true` for a meal stop on a leg | `items` type `meal` | Niagara's dinner at Apna Pind is on the drive back (open to 02:00 on Saturdays); New Hampshire's packed lunch is on the move |
| Best start time | `outing.bestStart: { earliest, latest, reasons: string[] }` | computed | 2.6 |
| Weekday pattern | `outing.when: { pattern, weekdays, holiday, label, why }` | `trip.when_pattern` | 2.4 |
| Cost on one card | `outing.cost: { item, amount, per, currency, year, note }[]`: permits, parking, fuel, tolls, food, activity | `budget` | Prices keep their read year (dateless rule) |
| A chain to a longer trip | `outing.chain: { role: 'prologue' \| 'stopover' \| 'epilogue', trip: TripRef } \| null` | `trip.part_of` | Québec leads into Vermont, and so does New Hampshire. Q4 |

```ts
// web/lib/public/types.ts, additive
export type HubId = 'toronto' | 'hamilton' | 'ottawa' | 'montreal';
export interface Permit {
  id: string;
  title: string;                         // "Algonquin daily vehicle permit"
  kind: 'day-use-permit' | 'timed-entry' | 'activity-slot' | 'parking' | 'waiver';
  required: boolean;                     // false = "recommended" (Conservation Halton)
  opens: BookRule | null;                // { daysBefore: 5, dayN: 1, time: '07:00', tz: 'America/Toronto' }
  channel: 'online-only' | 'online-or-gate' | 'gate';
  walkUp: boolean;
  refund: string | null;                 // "Final sale; cancel within 2 h of buying for a refund"
  requirements: string[];                // ["Everyone 122 cm and over", "Competent swimmers"]
  price: { amount: number; currency: string; per: 'vehicle' | 'person'; year: number } | null;
  url: string | null;
  entryId: string | null;                // the timeline `booking` entry it pins
  soldOutPlanB: boolean;                 // true when "sold out" is a go check that triggers Plan B
}
export interface GoCheck {
  id: string;
  kind: 'weather' | 'status-page' | 'river-flow' | 'permit' | 'colour-report' | 'road';
  title: string;                         // "Tubing open"
  rule: string;                          // "River flow at Elora under 8 m³/s and tubing status Open"
  decideAt: { when: 'evening-before' | 'morning-of' | 'days-before'; daysBefore?: number; time: string };
  source: { label: string; url: string } | null;
  ifFails: 'plan-b' | 'drop-entry' | 'shorten' | 'cancel';
  entryId: string | null;                // the entry it governs (tubing), or null for the whole trip
}
export interface Outing {
  lengthClass: LengthClass;
  when: { pattern: 'saturday' | 'sunday' | 'weekend' | 'long-weekend' | 'midweek' | 'any'; weekdays: number[]; holiday: string | null; label: string; why: string | null };
  origin: { hub: HubId; label: string; point: Point };
  returnTo: { kind: 'origin' | 'place' | 'trip'; label: string; point: Point | null; trip: TripRef | null };
  fromHubs: { hub: HubId; minutes: number; km: number; basis: 'routed' | 'estimate'; fetched: string }[];
  leaveBy: { time: string; confidence: Confidence; reason: string };
  homeBy: { time: string; confidence: Confidence; reason: string; target: string | null };
  bestStart: { earliest: string; latest: string; reasons: string[] } | null;
  totals: { driveMin: number; onFootKm: number; spanMin: number };
  permits: Permit[];
  goChecks: GoCheck[];
  planB: { title: string; summary: string; variantKey: string } | null;
  bring: { item: string; why: string; fromEntry: string | null }[];
  cost: { item: string; amount: number | null; per: string; currency: string; year: number | null; note: string | null }[];
  chain: { role: 'prologue' | 'stopover' | 'epilogue'; trip: TripRef } | null;
}
// PublicTripCard gains: lengthClass, isShort, fromHubs (card chip and filters). PublicTrip gains: outing: Outing | null.
```

### 2.3 Leave by and home by

1. The scheduler (trip-timeline 2.9 step 4) solves the day start back from the first pinned entry: the slot time, minus the check-in rule (`booking.checkin`, 20 min), the park walk-in, the buffer and the **out leg from the hub**. That start is **leave by**, with `confidence` taken from the pin (a slot gives `fixed`-derived, shown as "Leave by 07:50 for the 10:00 slot").
2. With no pin, the start is the latest of these:
   - the profile default (trip-timeline 2.4);
   - the first stop's opening time minus the out leg;
   - for a sunrise-anchored stop, the anchor minus the leg.
   It is `suggested`.
3. **Home by** is the `end` entry (`sub: 'at-home'`, trip-timeline 1.1): the last entry's end, plus any meal on the way, plus the back leg. When the trip has a `homeByTarget`, an end after the target raises **`S_HOME_BY`**: "Home about 23:50; the target is 21:00. Leave Queen's Royal Park at 20:00 to save 25 min." The message names the authored decision rule when there is one (Niagara has three).
4. New warning **`S_CAR_SHARE`** (day trips only): driving is over 45% of the span. "4 h 35 of the 15 h 50 day is driving." It is a note, not an error. The Niagara day passes (29%); a day trip to New Hampshire would not.
5. For multi-day short trips, leave by belongs to Day 1 and home by to the last day. Days in between start and end at the base, as in L3c.

### 2.4 Dateless in public: a weekday pattern and a season window

| Stored | Public line | After a date is picked |
|---|---|---|
| `pattern: 'saturday'`, `why: "Elora Farmers' Market is Saturday mornings"`, season late June to early September | **"A Saturday, late June to early September"** | the date picker offers the next Saturdays inside the window; any other weekday warns, with the reason |
| `pattern: 'long-weekend'`, `holiday: 'Canadian Thanksgiving'` | **"A long weekend in mid-October (Canadian Thanksgiving fits)"** | the holiday Monday closures from the plan become checks on the real Monday |
| `pattern: 'midweek'`, `why: "Tuesday arrival beats the Thanksgiving crowds; several operators close on 11-12 Oct"` | **"Midweek, late September"** | weekday checks run (the inn restaurant is closed on Tuesday evenings) |
| `pattern: 'any'` | the season line only | |

- The pattern is a rule, not a date, so it is allowed under the dateless rule. Day headers show **Day 1, Day 2** until the owner answers Q1, and the pattern line carries the weekday.
- Times of day stay (leave by 07:50). Sun times are a range for the season window (L3c D7). Niagara's sunset becomes "about 19:55 to 20:45" for a late July to end of August window (`core/bin/sun.ts` at Niagara-on-the-Lake, 25 Jul and 31 Aug), not "7:58 PM". A wide window makes the evening entries vague, so short trips should keep their season window tight.
- Permit release rules stay relative: "Opens at 07:00 ET, 5 days before Day 1."

### 2.5 Go/no-go checks (planner: `go_checks`)

| Column | Type | Notes |
|---|---|---|
| `id`, `kind`, `title`, `rule` | as `GoCheck` | |
| `metric`, `op`, `value` | nullable | weather and flow checks keep core `weather_rules`' machine form (`precip_prob > 60`, a new metric `flow_m3s > 8`) so the planner can evaluate them against a forecast |
| `decide_offset`, `decide_time` | offset and hh:mm | "-1 day 20:00", "0 day 06:30" |
| `source_url` | text | GRCA River Flows, Ontario Parks availability, Friends of Algonquin colour report |
| `if_fails`, `plan_b_track`, `item_id` | | |

`weather_rules` rows migrate to `go_checks` with `kind: 'weather'`. In the planner, each check becomes a task due at `decide_at` ("Decide Elora: check the river flow, Fri 20:00") and a reminder.

### 2.6 Best start time, and traffic

`bestStart` combines three limits and states each one:
1. **Opening hours and slots:** the earliest useful arrival (the gate opens at 08:00; Flume Gorge at 09:00, so Artist's Bluff goes first).
2. **Sun:** the light the plan depends on (Echo Rock is back-lit until about 13:30; the Cache Lake ledge is front-lit until about 10:30), from `needs.sun` on entries.
3. **Traffic and crowds:** authored rules of thumb, `trafficRules: { leg: 'out' | 'back'; avoid: [from, to]; why; source }[]`.
   - Example: "Thanksgiving Monday southbound: leave by 13:30, or after 19:30."
   - Example: "Day-use lots fill by 10:00 on summer weekends."
   - A leg inside an `avoid` window raises `S_TRAFFIC`, a note.
   - They are labelled **"Traffic rule of thumb, not measured"**, because ORS has no live traffic, and the Algonquin plan says its own traffic timing is a GAP.

Output: "Best start 07:30 to 08:00: the lot fills by 10:00; the slot is 10:00; the gorge light is best before noon."

### 2.7 The bring list (derived first, authored second)

| Derived from | Bring |
|---|---|
| a water entry (`lake.shore`, tubing, a splash pad) | swimwear, towels, a full change of clothes |
| a permit with `channel: 'online-only'`, or a place with "no signal" in its facts | the permit as a screenshot; an offline map |
| a fee marked cash only (WMNF $3 cash, no change; the Québec funicular) | cash, with the amount |
| a trail with stairs or talus (Niagara Glen) | lugged soles; the plan's footwear rule |
| a meal with `style: 'packed'` | lunch and water (500 mL per person per hour on trail, from the vault list) |
| a border crossing (New Hampshire, Québec to Vermont) | passports or NEXUS for everyone: a Documents check, person-level (trip-scope rule 6) |
| family with the youngest under 10 | snacks every 2 h 30 (the L3c rule) |

Authored rows add what rules cannot know ("a credit card or cash for the $75 tubing deposit; no debit"). The list caps at 10 rows on the page, with "More".

### 2.8 What a short trip drops

| Dropped or collapsed | Why |
|---|---|
| Bases and stays (day trips); a single base row (1 to 3 nights) | one stay at most; it shows as a `checkin` entry and one Stays row |
| The whole-trip timeline strip (day trips) | there is one day; trips of 1 to 3 nights get a 2 to 4 tab day strip instead |
| The By category view as a tab | under 15 items: a "Places on this trip" strip under the timeline replaces it. The six-category model stays in the data |
| Editions, fare windows and quotes, FX (unless it crosses a border), the multi-currency budget | no flights; one currency |
| Emergency per base | one area card (nearest hospital, the park's number) |
| Documents | only when a border is crossed |
| Gallery at full size | at most 12 photos |
| Split lanes | allowed in data but rare; the L3c rules apply unchanged |

### 2.9 Fit with the timeline model and the party profile

- **No new entry kinds.** Everything short trips need is already in trip-timeline 1.1: `start leave-home`, `leg` with a role, `booking day-use-permit` and `timed-entry`, `meal` with styles, `end at-home`. This page adds `leg.role`, the `packed` and `roadside` meal styles, `onTheWay`, the home-by target, and three warnings (`S_HOME_BY`, `S_CAR_SHARE`, `S_TRAFFIC`).
- **The out and back legs are generated from the hub** at publish time (ORS) and in the browser when the visitor changes hub (the stored matrix) or uses their location (straight line × 1.42, ≈).
- **The party profile is unchanged.** On a short trip it also:
  - changes leave by (a relaxed pace starts later, or the slot holds it);
  - changes home by;
  - sets the drive break interval on the out leg.

  Requirements the profile cannot check (height 122 cm, a competent swimmer) show as requirement chips on the permit and on the entry, not as a pass or fail.
- **Plan B is a variant** (`audience: 'plan-b'`), so the variant chip offers it ("Plan B: no permit"), and `d=1P` in the URL shows it. Go checks link to it.

## 3. UX

### 3.1 Fast creation (planner, later)

The F02 entry point "Day trip from home" is expanded here. The goal is a usable plan in **under 30 seconds and 4 taps after the place is chosen**.

| Step | Screen (phone first) | Default | Taps |
|---|---|---|---|
| 0 | Start from: **a place** (any place page: "Make a day trip"), **a template** (a public short trip: "Use this"), or **"Within 2 h of home"** (a ranked shortlist with drive bands and outing-type chips) | | 1 |
| 1 | **Pick a day**: chips for the next 4 days that fit the pattern and the season ("Sat 24 Oct", "Sun 25 Oct", "Sat 31 Oct", "Other"). Weekends and long weekends are shaded (F03) | the next fitting Saturday | 1 |
| 2 | **Origin**: Home (the household point), or another address, or "from the end of another trip" (a chain) | Home | 0 |
| 3 | **Party and pace**: the household, with ages computed for that day | household | 0 |
| 4 | **Generated**: the timeline, leave by and home by, both drives, the permits with their real release times ("Algonquin permit opens Tue 6 Oct 07:00 ET"), go checks as tasks, the bring list. Primary action: **"Save"**. Secondary: "Add a stop" (L3c `addItem`) | | 1 |

- The tasks and reminders it creates come from F09: book at release, with reminders 15 min before and at opening; the go check the evening before; "Leave by 07:50" on the morning.
- **The scenario this must pass** (trip-scope S1, S5): Elora appears in Home's deadlines with its slot opening, and on the day Today opens Elora with "Leave by".

### 3.2 The compact public trip page (before go-live)

Phone, 390 wide. One column. The desktop page puts the timeline left and the map right, as L3c's sticky map does.

```
+--------------------------------------+
| [photo]  Niagara Gorge to the Lake   |
| Day trip · a Saturday · late Jul-Aug |
| From Toronto 1 h 25 ≈ [change]       |
+--------------------------------------+
| LEAVE BY 07:50 -> HOME ABOUT 23:20   |  <- sticky bar on phone
| 4 h 10 driving · 6 km on foot        |
+--------------------------------------+
| Go / no-go                       (2) |
|  Decide the evening before:          |
|  - Rain over 60%: Glen rim only      |
|  - Trail status: Whirlpool closed    |
+--------------------------------------+
| Book ahead                       (0) |  <- hidden when empty
+--------------------------------------+
| Party: 2 adults, standard  [Edit]    |
+--------------------------------------+
| 07:50  Leave Toronto                 |
|   |  1 h 25 drive ≈                  |
| 09:15  Breakfast, St. Catharines     |
| 10:50  Niagara Glen rim              |
| ...    (the L3c day timeline)        |
| about 19:55-20:45 Sunset (range)     |
|   |  Dinner on the way back          |
| 23:20  Home                          |
+--------------------------------------+
| Bring (5)   Cost about $24-47 (2026) |
| Places on this trip (6) ->           |
| [Add to calendar] [Share] [Copy]     |
+--------------------------------------+
```

- **The bar is the page's spine**: leave by, home by, the drive total and the on-foot total. On a phone it sticks under the header as the trip-context strip (trip-scope rule 1). Tapping it scrolls to the first or last entry.
- **Go/no-go and Book ahead come before the timeline**, because they decide whether the day happens. Each card hides when it is empty.
- **One timeline.** For 1 to 3 nights, a day strip ("Day 1 · Day 2 · Day 3") sits above it, with each day's span. The L3c whole-trip timeline is not drawn.
- **Map:** one route, out and back in two weights, stops numbered as in the timeline. On a phone it is behind a "Map" button that opens the existing bottom sheet.
- The profile selector collapses to one line (L3c 3.1 phone rule).
- **Honesty:** the drive from the hub shows ≈ unless routed; "from Toronto" names the hub point in its tooltip ("Toronto City Hall"); the traffic rules carry their chip.
- **Print** fits one A4 page for a day trip (the existing print hooks).

### 3.3 The trips list and filters

| Element | Spec | Lane |
|---|---|---|
| Length filter pill | Day trips · Overnights · Weekends (2 nights) · Long weekends (3 nights), then L3b's bands 4-8, 9-14, 15+ | L3b (changes its proposed bands, which start at 1-3) |
| Drive pill | "From Toronto: under 1 h · 1-2 h · 2-3 h · 3 h+", with the hub switchable inside the pill menu. URL `drive=toronto-2` | L3b |
| Card chip | "Day trip · from Toronto 1 h 25" in the card's mono line, in place of the nights | L3b (card) |
| Group by | adds "Length" (Day trips first) | L3b |
| Home strip | "Short trips from Toronto" row on `/`, the 6 nearest | integration pass after L3e |
| Places | "Within N h of Toronto" on Places is a later step: the matrix covers only short-trip destinations | later |

### 3.4 Quick actions

| Action | Public site (no account) | Planner |
|---|---|---|
| **Add to calendar** | For a short trip only, the sheet asks for **one date**: chips for the next 4 days that fit the pattern inside the season, or a picker. It downloads an ICS at once, with L5's timed events at the computed times, the permit release as a separate event ("Algonquin permit opens 07:00"), and the go check the evening before. The date lives only in the browser (L5's dated-copy rule) | a dated trip, with reminders |
| **Share** | the URL with profile, hub and overrides (L3c 3.8, plus `from=ottawa`). The native share sheet on a phone | a trip link with roles (10-sharing) |
| **Copy to my trips** | L5's copy sheet, prefilled with the pattern's next date; held in the browser until sign-in exists | a dated trip; origin becomes Home and the legs are recomputed from the household origin |
| **Turn into a template** | not on the public site (public trips already are templates) | "Save as template" on a done short trip: dates, travellers and the origin are stripped, the pattern and season are kept (F12) |

### 3.5 Phone first

- The short-trip page is designed at 390 wide first. The design reviewer judges the 390 frames before the 1440 frames.
- Thumb reach (trip-scope S8): the bar, "Map" and "Add to calendar" sit in the bottom half or in the sticky strip.
- Offline: the page is static, so it can be saved. "Save for offline" is part of the planner (F13).

## 4. Distance from home

### 4.1 Drive time from a hub

- **Hubs** (`data/outings/hubs.json`): Toronto (City Hall), Hamilton, Ottawa, Montréal. Each has a point from OSM or Wikidata, never Google. Four is enough for year one; adding one is a data change.
- **The matrix** (`web/scripts/hubs-ors.mjs`, a new script modelled on L3c's `legs-ors.mjs`):
  - It calls ORS `matrix` with `driving-car`: hubs times each short trip's first stop and last stop.
  - The key is sent as the Authorization header, never printed. Calls are sequential, from one lane only.
  - Output goes to `data/outings/from-hubs.json`, with the date fetched and the ORS attribution. `--check` fails on a missing pair. The build never calls ORS.
  - About 20 short trips × 4 hubs × 2 points is 160 cells: one or two requests.
- **The visitor's own location:** `navigator.geolocation`, only after a tap. The straight-line rule (× 1.42) runs in the browser and is marked ≈. The position is never sent, stored or put in the URL.

### 4.2 "Day trips within N hours"

- The bands are under 1 h, 1-2 h, 2-3 h and 3 h+, from the vault list's grouping. The value is one-way minutes to the first stop.
- The filter's source is `fromHubs`. A trip with no routed value falls back to the estimate and shows ≈ in the band chip.

### 4.3 The planner

The household's home point is private household data (01-domain-model 3.2). Drive times go through `leg_cache`, keyed by a ~1 km geohash cell (01-domain-model 2.7). "Within 2 h of home" runs a PostGIS straight-line prefilter, then ORS for the top results, server side. A copied public trip swaps the hub legs for the household legs.

### 4.4 Privacy: the origin is never public

- **Found 18 Oct 2026:** "Whitby" is in the built public output, in `web/out/trips/index.html` and in the Québec, Algonquin and Vermont trip pages ("Whitby to Île d'Orléans ..."). The New Hampshire and Niagara titles and plans say "Whitby" too.
- **The rule:** the adapter replaces the household origin with the trip's hub label in every public string ("Whitby to Île d'Orléans" becomes "Toronto to Île d'Orléans"). The household origin list lives in a private config (`data/private/origins.json`, gitignored, with a committed example). Drive figures quoted from the origin in prose ("~525 mi from Whitby") are dropped from prose, because the hub leg replaces them.
- **Test:** a privacy test fails when a public payload contains a household origin string or a point within 2 km of it. It extends the PS lane's payload test.
- The old legacy pages at `/<slug>/` also say Whitby. They go away with the 7.1 redirects.

## 5. Migration of the existing short trips

| Trip (public slug) | Today | Nights, class, pattern | Maps to | Missing |
|---|---|---|---|---|
| **Elora Gorge** (no legacy folder; `research/vault-notes/day-trips/Elora Gorge Day Trip.md`, June 2026) | not a public trip. In the trip-scope scenarios as the household's Sat 24 Oct trip | 0, day, `saturday` (the farmers' market) | rim hike `trail`, tubing `booking activity-slot` (online only, 3 days ahead, 122 cm, $75 deposit, card or cash), a late picnic `meal packed`, Bissell Park splash pad, Mill Street, ice cream. Plan B variant: Elora Quarry (a separate timed reservation) or rim plus village. Go check: river flow under 8 m³/s and the GRCA status | **Season conflict:** GRCA's 2026 tubing season ran 26 Jun to 7 Sep, so a 24 Oct trip has no tubing, and "slot opens Mon 19 Oct" is also wrong (tickets go on sale 3 days ahead). It needs a researcher refresh (2026 prices, gate hours, points from OSM), a public trip record, and a decision (Q3) |
| **Niagara** (`niagara-day-2026`) | overview, 1 day, 15 clock times in PLAN.md | 0, day, `saturday` (the Sunday concert at Queenston makes Sunday busier) | the L3d overview conversion to 1 day; 15 times become authored pins; sunset becomes an anchor range; the 3 decision rules become go checks and `S_HOME_BY` hints; Apna Pind is `meal onTheWay` | points for 7 stops; hub legs (Toronto to St. Catharines replaces Whitby to St. Catharines); a season window (it says August only); the parking-receipt advice as a Know before you go bullet; the trail closures as a `status-page` go check; prices dated 2026 |
| **New Hampshire stopover** (`new-hampshire-stopover-2026`) | overview, Day 0 plus Day 1, 1 night | 1, overnight, `midweek` | Day 0 the long drive (3 breaks, a border crossing); Day 1 Artist's Bluff, Flume Gorge (opens 09:00, so it is a pin), the Kancamagus, Sabbaday Falls with a packed lunch; `returnTo` Hyde Park, `chain` prologue to Vermont | **the most incomplete**: the route and border crossing are not chosen, lodging is not chosen, and the Day 0 times are placeholders. Missing: WMNF $3 cash as a permit row; a passport document; points; hub legs (a 9 h 15 day 0 from Toronto fails `S_CAR_SHARE` by design) |
| **Algonquin and Muskoka** (`algonquin-muskoka-2026`) | summary, 3 days, 7 items; 24 times in PLAN.md | 2, weekend, `long-weekend` with `holiday: 'Canadian Thanksgiving'` | the L3d import of 24 times; the Algonquin day permit (release confirmed **07:00 ET, 5 days before; final sale**, Ontario Parks FAQ, which closes the plan's "inferred" and "refund GAP"); the Dorset tower `timed-entry` slot; Plan B as a variant on Day 2; Limberlost waiver as a `waiver` permit; the Monday traffic rule ("leave by 13:30 or after 19:30"); the Monday closures as weekday checks | points (3 exist in PLAN.md, the rest are missing); Ragged Falls fee (GAP); a season window ("early to mid October" with the colour-year caveat as an observation); go checks for the colour report (8 Oct in the plan, so "2 days before") |
| **Île d'Orléans / Québec** (`quebec-2026`) | overview, 3 days, 2 nights, 12 times | 2, weekend, `midweek` (Tue to Thu, before Thanksgiving) | the L3d conversion of 3 days; one base (an inn on Île d'Orléans, from six options); `returnTo` Hyde Park, `chain` prologue to Vermont; cash for the funicular in the bring list | points; hub legs; the inn's Tuesday-evening closure as a weekday check; a season window (late September to early October); a passport check for the Vermont crossing |

**Gotchas for the migration:**
- **Every one of these trips states its distances from Whitby.** They must be recomputed from the hub, not edited by hand.
- **Two of the five end in Vermont.** A visitor copying Québec alone needs a "return home instead" option. It is generated as the back leg from the last stop to the origin, and offered as a variant of the last day.
- The Algonquin page is the best template for the frame (permit, Plan B, traffic, closures). Build L3e against it and Niagara first.

## 6. Build brief outline and sequencing

### 6.1 Where it fits

| Lane | Relation to this work |
|---|---|
| **L3b** (tags and filters, wave 3) | **Adds** the length classes (0 to 3 nights), the drive pill, the card chip and group-by Length. L3b is still to be specced (`features/trip-tags.md`), so these go into its spec. Only `lengthClass` and `fromHubs` are needed, from the adapter's index (L3b's `tags.ts`) |
| **L3c** (timeline, wave 3) | **Prerequisite.** It provides the scheduler, `start leave-home`, `end at-home`, legs, slots, variants and Plan B. This page adds, in a later lane: `leg.role`, the meal styles, the home-by target and three `S_` codes. Two small asks can go into L3c now at no cost: name the `home-by` anchor in its types, and reserve `audience: 'plan-b'` |
| **L3d** (legacy times and overview conversion) | **Prerequisite for the content.** Niagara, New Hampshire and Québec are overview trips, and Algonquin's times are in the legacy page. They have no timeline until L3d converts them |
| **L3e short trips** (new) | After L3c merges, together with or right after L3d's short-trip part |

### 6.2 L3e brief outline (to expand into `build/public-site/L3e-short-trips.md` after L3c merges)

- **Agent:** travel-builder (Sonnet). **Effort:** about 14 h.
- **Goal:** the outing frame and the compact page for trips of 0 to 3 nights.
- **Owns:**
  - `core/src/derive/length.ts`, and in `core/src/schedule/`: `outing.ts` (leave by, home by, best start), the three `S_` codes and the hub legs;
  - `data/outings/**` (`trip-outing/1`, `hubs.json`, `from-hubs.json`);
  - `web/scripts/hubs-ors.mjs`;
  - `web/lib/public/outing.ts`, with additive `types.ts` fields;
  - `web/components/trips/short/**` (bar, go/no-go card, book-ahead card, bring and cost, day strip), `web/styles/short-trip.css`;
  - the short branch in `web/app/trips/[slug]/page.tsx`;
  - the short-trip date step in `CopySheet` and `ics.ts`.
- **Must not touch:** L3b list files; L2b; L4b; `web/components/ui/**`.
- **Steps:**
  1. `lengthClass`, tested.
  2. The hub matrix script, sequential, with the key in the header, and its committed output.
  3. The `trip-outing/1` schema and the dateless test.
  4. The outing files for Algonquin and Niagara first, then Québec and New Hampshire after L3d. Elora after Q3.
  5. The adapter: origin rewrite and privacy test; `outing`; `fromHubs` on cards.
  6. Scheduler additions with fixtures `niagara-day1-adults-standard.json` and `algonquin-day2-planb.json`.
  7. The compact page at 390, then 1440.
  8. Add to calendar with one date.
  9. Hub switch and "use my location" (≈).
- **Acceptance:**
  1. Each short public trip shows the bar, with leave by back-solved from its first pin.
  2. `?from=ottawa` changes the legs and both times.
  3. No public string or point contains the household origin.
  4. The Algonquin Plan B is reachable from its go check and from `d=2P`.
  5. "Add to calendar" on Niagara with a picked Saturday gives an ICS with timed events and the go check the evening before.
  6. The dateless test passes on `data/outings/**`.
- **Verification:** tsc, tests, and Playwright at 1440 and 390, light and dark, for Niagara and Algonquin. Then design review (Fable) and the verifier.

### 6.3 Public site now, planner later

| Before go-live (public site) | Waits for the planner |
|---|---|
| **Privacy: the origin rewrite and its test (urgent; Whitby is in `web/out` today)** | The creation flow (3.1): from a place, a template, or within N h of home |
| `lengthClass` and the length filter, card chip, group-by (in L3b) | The household origin and `leg_cache` drive times from home |
| The hub matrix (ORS) and the "from Toronto" drive pill | Real dates, permit release reminders, go checks as tasks and push |
| L3e compact page: the bar, go/no-go, book ahead, bring, cost, one timeline, the day strip | A live forecast against go checks (`metric`, `op`, `value`) |
| Add to calendar with one date in the browser; share with `from=` | Save as template from a done trip; chains in the planner |
| Outing data for Algonquin and Niagara (then Québec and New Hampshire after L3d) | `go_checks`, `trip.when_pattern`, `trip.return_to`, a private `trip.origin` and `lengthClass` in the core schema |
| | "Within N h" on Places; the home strip "Short trips from Toronto" (integration pass) |

### 6.4 Backlog rows added

The rows are in [BACKLOG.md](../build/public-site/BACKLOG.md): 2.19 (the privacy rewrite) in stage 2; 3.11 to 3.14 in stage 3; and owner questions Q8 to Q11, which are this page's Q1 to Q4.

## 7. Open questions for the owner

| # | Question | Recommendation |
|---|---|---|
| Q1 | Short trips with a weekday pattern: may the day header say "Day 1 · Saturday"? (It amends the dateless rule, which bans weekday names) | Yes. A pattern is not a date, and on a weekend trip the weekday is the point (Thanksgiving Monday closures) |
| Q2 | The public origin: "from Toronto" only, or Toronto plus 3 switchable hubs and "use my location" (≈, kept in the browser)? | Toronto as the default, plus Hamilton, Ottawa and Montréal and the location estimate. Each costs one matrix row |
| Q3 | Elora: tubing ended on 7 Sep this year, so the Sat 24 Oct scenario cannot include a tubing slot. Publish Elora as a summer template (late June to early September, tubing plus a Plan B), and change the scenario's October trip to something open in late October? | Yes to both. A gorge-and-village October variant can be a second, smaller template later |
| Q4 | New Hampshire and Québec end in Vermont. Publish each as its own short trip, linked "leads into Vermont", or fold them into the Vermont trip as optional prologue days? | Québec stands alone (with "return home instead"), linked to Vermont. Fold New Hampshire into Vermont as an optional Day 0 and Day 1, because on its own it is a 9-hour drive to one morning |

## Change log

| Date | Change |
|---|---|
| 2026-10-18 | First version. Amends F02 trip types (Day trip and Weekend rows), core `shapeForNights` bands (at the planner milestone), and public-trips-dateless (weekday names, pending Q1). Defines the home-by anchor that trip-timeline 1.1 refers to. |
