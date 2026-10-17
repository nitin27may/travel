# F07. Day checks, drafting and route optimising

## Purpose

Catch what makes a plan fail in real life (too much driving, a closed lift, a child who is too
young, a hike ending after dark, no bed for night 4) while there is still time, and offer one-tap
fixes. Optionally place ideas onto days and order a day to cut driving, always as a preview the
user accepts. All deterministic; no model cost.

## User stories

1. As a planner, I want a warning when a day has 3 h 50 of driving on a balanced pace, with a fix, so that I don't plan an exhausting day.
2. As a parent, I want to be told when an item doesn't fit someone in the party (via ferrata 12+, Aarav is 11 on that date).
3. As a road-tripper, I want a stop suggested about every 2 hours of driving, so that long legs have breaks (household avoid rule).
4. As a planner, I want "Fill this day" from my Ideas list, so that I get a sensible draft I can adjust.
5. As a planner, I want "Reorder to cut driving", so that a day doesn't zig-zag.

## Detailed behaviour

### Checks

1. Checks run after every operation on the server (fast, per affected day) and in the client for optimistic feedback. Results are shown inline on the item and as a count on the day header and the outline; never a blocking dialog.
2. Each check result: code, severity (info, warn, error), message with numbers, affected items, and zero or more **fixes**, each a ready `edit_trip` payload (one tap applies it, one undo reverts it).

| Code | Fires when | Example message | Fixes |
|---|---|---|---|
| `overlap` | two timed items overlap for the same people | "Lunch overlaps the boat tour by 30 min" | shift lunch to 13:30; shorten the tour |
| `travel_gap` | gap between items shorter than the leg | "1 h 50 drive, 45 min gap" | start next later; swap order |
| `daylight` | outdoor item ends after sunset (or civil dusk for hikes) | "Hike ends 40 min after sunset (19:52)" | start 08:00; move to a longer day |
| `closed` | item date outside the entity's season or hours, or a known closure | "Gondola closes 13 Sep; this is 14 Sep" | move to an earlier day; use the alternative |
| `pace` | day's driving, walking km, gain or item count exceeds the pace profile | "3 h 50 driving + 14 km walking on a balanced pace" | move X to Ideas; split over two days |
| `eligibility` | a traveller in `who` fails an entity limit on that date | "Via ferrata Loen needs 12+; Aarav is 11 on 4 Jul" | give Aarav the family variant; remove him from this item |
| `break_gap` | a drive leg longer than the household or profile break interval with no stop | "3 h drive with nothing to break it" | add a suggested stop near the 1 h 30 mark |
| `no_stay` | a night has no stay (from `trip_night_base`) | "No stay for night 4 (16 Jul)" | add a stay placeholder; mark as travel night |
| `check_in` | arrival at the base before check-in or after its last check-in time | "Arrive 13:10, check-in from 15:00" | add a luggage drop note; move an item before |
| `flight_bound` | items before arrival + buffers or after "be at the airport by" | "Item at 10:00 but you land at 09:05 + 1 h 30" | move to the afternoon |
| `car_bound` | a drive leg outside the rental window | "No car on day 1 before pickup at 11:00" | switch mode to transit; move pickup |
| `booking_risk` | a to-book item whose window opened or whose book-by is near | "Shuttle not booked; window opened 3 days ago" | open the reservation |
| `weather_rule` | a weather-sensitive item on a day without a Plan B | "Ridge hike with no Plan B" | add a Plan B from suggestions |
| `campsite` | camper trips: night not at a campsite open on that date | "Night 9 campsite closes 31 Aug" | pick another open campsite |
| `road_legality` | leg uses a road not allowed for the vehicle (F-roads for 2WD) | "F208 not allowed for 2WD campers" | route around; drop the item |
| `connection` | train/ferry connections under a minimum change time | "12 min to change at Bolzano" | choose a later service |

3. Thresholds come from the trip's pace and type profiles (F02) and the household avoid rules (F01); every threshold can be overridden per trip.
4. A check can be dismissed per item ("I know"), which records who dismissed it and hides it until the inputs change.

### Fill this day (drafting)

5. Input: the trip's Ideas (or a chosen list), the day's base, daylight, the pace profile, priorities, opening hours, eligibility and the items already fixed on the day (anchored reservations, timed items).
6. Algorithm v1 (deterministic, explainable): filter candidates to those open on the date and fitting the party; score by priority (must > should > nice), distance from the base, best-light time for viewpoints, and type boosts; greedily place into time slots (morning, midday, afternoon, evening) honouring durations, legs and a lunch break; stop when the pace budget is reached.
7. Output is a **preview**: proposed items highlighted with a reason each ("morning: front-lit until 10:30; 25 min from base"); Accept all, accept some, or discard. One operation, one undo.
8. **Draft my days** runs the same over all days, first assigning items to days by geographic clustering around each night's base, then filling each day. Bases themselves come from stays; if none, the draft proposes bases (clusters) as stay placeholders.

### Reorder to cut driving

9. For one day, reorder the unanchored items to minimise total leg time from the base and back (or to the next base on a move day), keeping anchored and timed items fixed. Small days (under 10 items) solved exactly; larger with nearest-neighbour plus 2-opt. Preview with "saves 35 min" before applying.

### Breaks and stops along a route

10. For drive legs over the break interval, suggest stops in a corridor along the route geometry (PostGIS `ST_DWithin` on the leg line, 5 km default) near each interval mark: viewpoints, toilets, food, playgrounds for family trips, fuel or EV chargers on remote legs. Each suggestion shows the detour in minutes.

## Data touched

`trip_item`, `day_note`, `entity` (season, hours, limits), `offer`, `reservation`/`reservation_segment`, `trip_night_base`, `leg_cache`, `traveller`/`person` (ages, fitness), `trip_type_profile`, household `prefs`.

### Schema additions

- `check_dismissal (trip_id, code, item_id, input_hash, dismissed_by, at)`.
- `trip.check_overrides jsonb` (per-trip thresholds).
- `leg_cache.geometry` is required for corridor search (already present as text; store as `geography(LineString)` instead).

## Operations and MCP tools

Queries: `trip.check` (all days or one), `day.draft_preview`, `day.optimise_preview`, `leg.stops_along`. Writes: `check.apply_fix` (applies a fix payload), `check.dismiss`, `day.draft_apply`, `day.optimise_apply`.

MCP: `check_trip` (results with fix payloads the client can send back via `edit_trip`), `draft_days` (preview or apply), `plan_drive` (legs and suggested stops).

## Edge cases

- Missing hours or season data: the check reports "unknown" at info level instead of passing silently.
- Routing unavailable: leg times fall back to straight-line × factor (1.4 rural, 1.8 mountain) marked "estimate".
- Variants: checks run per variant for its travellers.
- Polar summer or winter (Iceland, Lofoten): daylight check uses civil twilight and handles no-sunset days.
- A day with only anchored items (a flight day): drafting adds nothing and says why.

## Acceptance criteria

1. Each check code has a fixture test with a minimal trip that triggers it and a fix that clears it.
2. `eligibility` uses the traveller's age on the item's date (birthday boundary test).
3. Fill this day on a Banff test day places at most the pace budget, never places a closed item, and explains every placement.
4. Reorder to cut driving never increases total leg time and never moves anchored items.
5. Corridor stop search on the Calgary-Jasper fixture returns at least one stop within 15 min of each 2 h mark.

## Milestone

Checks in M2; Fill this day and Reorder in M2 (v1 greedy); Draft my days across the trip and corridor stops in M7.

## Open questions

1. Should check results be stored (for the outline badges and notifications) or always recomputed? Default: stored per day with an input hash, recomputed on change.
2. Weather rule thresholds: shared defaults per activity type or per item only? Default: defaults per subkind (ridge hike, boat tour), editable per item.
