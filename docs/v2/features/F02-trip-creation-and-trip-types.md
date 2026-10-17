# F02. Trip creation and trip types

## Purpose

Start a trip in under a minute, from the household's defaults, and let the trip's **type** shape
everything after it: which things are suggested, how full a day may be, which checks run, which
tasks and packing lists appear. A Saturday day trip from Whitby and a 14-night Rockies holiday use
the same model, but they must not feel the same.

## User stories

1. As a parent on a free Saturday, I want "day trip from home, under 2 h, waterfall and swim" to give me a ranked shortlist, so that I can pick and leave in 30 minutes.
2. As a planner, I want to start a trip with only "Banff, September, 2 weeks" and fill the rest later, so that starting is never a chore.
3. As a couple, I want a romantic weekend to suggest a good dinner, a sunset spot and a slow morning, not a 20 km hike.
4. As an adventure group, I want limits (age, height, weight, fitness) front and centre, so that nobody books something they cannot do.
5. As a camper-van traveller (Iceland 2027), I want days ordered around campsites, so that the plan respects where we can legally sleep.
6. As a planner, I want to combine types (family + adventure + road trip), so that the defaults reflect our real mix.

## Detailed behaviour

### Entry points

1. **Plan a trip** opens the intent sheet (02-experience.md 3.2): Where, When, Who, Style, How. Every step is skippable; "Just start" after Where and When.
2. **Day trip from home** asks two things: radius (chips from the household default) and outing type (picnic and relax, active, sightseeing, food, kid-focused). It shows a ranked shortlist from Explore (F04) with drive time from home; one tap creates a one-day trip with the place on Day 1, a "leave by" time and the drive legs.
3. **Fork a template** (F12).
4. **From a chat client**: `create_trip` over MCP with the same fields; the trip shows "created by Claude".
5. **From a candidate** (F03): choosing a candidate destination converts it into the trip's area.

### The intent sheet fields

| Step | Field | Notes |
|---|---|---|
| Where | area (search), or "not sure yet" (candidates), or "surprise me within N h" | area sets the map and the coverage line |
| When | exact dates, a month, "a long weekend" (from the travel year), or not sure | `start_date`+`nights`, or `date_window` |
| Who | household people ticked, guests added (name, age band) | ages computed at travel |
| Style | trip types (multi-select), vibes, activities, must-do, avoid | types drive the profile below |
| How | pace, walking limit per day (km and gain), budget band, transport, base strategy (one base with day trips, or move) | pre-filled from household |

A live line at the bottom: "38 things fit · 12 suit a 10-year-old · coverage: good", or a thin-coverage warning.

### Trip types and what each changes

A trip can carry several types (`trip.trip_types`). Each type has a **profile** (`trip_type_profile`, reference data, editable by the owner) with defaults; when types combine, the stricter limit wins and the lists merge.

| Type | Defaults it sets | Explore emphasis | Checks it turns on or tightens | Tasks and packing |
|---|---|---|---|---|
| **Day trip** | one day, no stays, origin = home, return the same day, radius from household | drive time from home first; "good right now"; free and cheap | total drive under radius × 2; back home by a set time; daylight | day bag, snacks, swimwear when water; reservations for timed entry (Conservation Halton parkvisit.ca) |
| **Weekend** | 1-3 nights, Fri evening or Sat start, one base | within 3-5 h of home; one stay | no more than one base change; Sunday drive home before 18:00 | overnight bag; book stay task |
| **Vacation** (multi-day) | 5+ nights; base strategy asked | full catalog of the area | rest day every 4-5 days at balanced pace; drive days limited | documents, packing by season |
| **Family** | pace balanced; walking limit from the youngest traveller's fitness; breaks every 2 h | kid-fit tags (splash pad, easy trail, hands-on museum, beach, toilets); eligibility by age | eligibility per child; no item longer than the youngest's limit; meal times; bedtime hint (last item ends by 20:00) | kids' packing (snacks, layers, entertainment), car seats for rentals |
| **Couple / romantic** | pace slow or balanced; late starts allowed | sunset and sunrise spots, special dinners, spas, scenic drives, quiet stays | no back-to-back early starts; at least one free evening | dinner reservation tasks |
| **Luxury** | budget comfortable or splurge; transfers over self-drive when offered | stays with high ratings, private tours, spas, fine dining | travel days kept short; fewer bases | dress-code notes, reservation tasks for signature dinners |
| **Adventure** | pace packed allowed; early starts | trails by difficulty, via ferrata, rafting, glacier walks, zip lines; operator limits shown | eligibility (age, height, weight, fitness) per traveller; weather-sensitive items need Plan B; daylight buffer | gear lists (helmet, harness rental, crampons), insurance task, waivers |
| **Luxury adventure** | adventure + luxury: guided over self-guided, comfortable stays between hard days | guided treks, heli or boat access, lodges | same as adventure plus "recovery evening" after big days | guide booking tasks |
| **Road trip** | moving bases; drive legs prominent; breaks every 2 h | stops along the route corridor (F07), viewpoints, food on the way | max drive per day (default 5 h), break gaps, fuel and EV range on remote legs | car checks, offline maps for the route |
| **Camper / van** | stays must be campsites (law in Iceland); car = the van | campsites with open dates, dump stations, showers; 2WD-legal roads only (no F-roads) | night must be at a campsite open on that date; road legality for the vehicle; campsite closing dates (Iceland: many shut during September) | camping card, gas, power adapters |
| **Multi-generation** | pace slow; walking limit from the least mobile; accessibility | accessible trails, benches, lifts and gondolas, short walks | mobility rules per traveller; stairs and gain warnings | medication and mobility aids |
| **Solo** | flexible pace; safety notes | social tours, hostels with private rooms, transit | late-night arrival warnings; share-itinerary task | emergency contacts task |
| **Friends** | pace packed; nightlife allowed | groups, activities, food and drink | group size limits on activities | (expense splitting is out of v1) |

7. **Profiles are data, not code.** `trip_type_profile` rows hold defaults (pace, max drive, break interval, walking limit factor), Explore boosts (tags with weights), checks to enable with thresholds, and pack template ids. The owner can tune them in the admin console without a release.
8. **Changing types later** re-applies only the defaults the user never edited (same rule as generated tasks: user edits win).
9. **Base strategy.** "One base with day trips" groups suggestions by distance from a single stay; "move" proposes bases by geography when drafting (F07).
10. **Trip status and phase.** A new trip starts in phase `idea` (no dates) or `plan` (dates). Phase moves automatically (F09 readiness) with a manual override.

## Data touched

`trip` (`scale`, `prefs`, `start_date`, `nights`, `date_window`, `origin`, `area_id`), `traveller`, `trip_list` (Ideas created on first item), `saved_view`, `pack_template`.

### Schema additions

- `trip.trip_types text[] not null default '{}'` with a check against the profile ids.
- `trip_type_profile (id text primary key, label text, defaults jsonb, explore_boosts jsonb, checks jsonb, pack_template_ids text[], sort smallint)`.
- `trip.scale` stays (day_trip, weekend, multi_day) because it changes the UI shape; `trip_types` changes content.

## Operations and MCP tools

Operations: `trip.create`, `trip.set_intent` (dates, area, prefs, types), `trip.set_travellers`, `trip.rename`, `trip.archive`, `trip.delete`, `day_trip.shortlist` (query), `day_trip.create_from_pick`.

MCP: `create_trip` (title, scale, types, dates or window, area, party from the household by default, prefs); `edit_trip` with `set_prefs` and `set_types`; `search` with `fits_trip` to get type-aware results.

## Edge cases

- No dates and no area: allowed (an "idea" trip); Explore falls back to household home base.
- A day trip that turns into an overnight: changing `scale` adds a stay placeholder and Day 2; nothing is lost.
- Conflicting types (luxury + camper): the stricter rules apply (campsite stays), luxury boosts still rank nicer campsites first; a note explains.
- Dates across a time-zone change (flight east): days follow the destination's dates; the arrival day starts at arrival (F08).
- A guest without an age: eligibility checks list them as "unknown" rather than passing.

## Acceptance criteria

1. "Plan a trip" with only Where and When creates a trip in under 3 taps after typing, with household travellers and prefs applied.
2. Day trip from home with radius 2 h returns places sorted by drive time from the home base, and one tap creates a dated one-day trip with the place, a leave-by time and both drive legs.
3. Selecting type Family on a trip with a 10-year-old hides nothing silently but marks every 12+ item amber with the reason.
4. Selecting type Camper on an Iceland trip makes "no campsite for night N" an error-level check.
5. Changing trip types does not overwrite a pace the user set by hand.

## Milestone

M2 (intent, types, profiles, day-trip flow). Profile tuning UI in M6.

## Open questions

1. Is "vacation" a type or simply `scale = multi_day`? Default: drop "vacation" as a type; it is the multi-day scale.
2. Should the day-trip shortlist include "combine 2-3 stops" suggestions (Travel Finder's route builder) in v1? Default: yes, as "pairs well with" chips on each card, full route builder in M7.
3. Who can edit trip-type profiles? Default: owner only, via admin.
