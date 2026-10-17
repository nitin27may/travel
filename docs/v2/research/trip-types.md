# Trip types: what each kind of trip needs from research

Status: draft (17 Oct 2026).

A trip type is not a label on a trip; it decides **which lanes get depth**, **which filters and defaults
the intent sheet sets**, **which facts are deal-breakers**, and **which questions research must answer
before a plan can be trusted**. A trip can carry several types (a family road trip with one luxury night),
so profiles combine: lanes take the deepest requirement, filters take the strictest limit.

Stored as reference data (`trip_type`, research/README.md R9). The persona quick-starts in Explore are
saved views that point at these profiles.

Depth legend for lanes: **D** = deep (every required and most optional fields), **S** = standard
(required fields), **L** = light (only what the plan touches), **-** = skip.

## Lane depth matrix

| Type | overview | trails | adventure | sights | gems | stays | food | relax/lux | road/legs | timing | entry | fares | events | media | reality | family | access |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Day trip | L | D | S | D | D | - | S | L | D | S | - | L | S | S | D | per party | per party |
| Weekend | S | S | S | D | S | D | D | S | S | S | L | S | S | S | S | per party | per party |
| Vacation (1-3 weeks) | D | S | S | D | S | D | S | S | D | D | D | D | S | D | S | per party | per party |
| Family, young kids (under 8) | S | S | S | D | S | D | S | L | D | S | S | S | S | S | D | **D** | S |
| Family, tweens and teens | S | D | **D** | S | S | D | S | L | S | S | S | S | S | S | S | **D** | L |
| Couple | S | S | S | D | D | D | D | S | S | D | S | S | S | D | S | - | per party |
| Romantic / honeymoon | S | L | L | D | D | **D** | **D** | **D** | S | **D** | S | S | S | D | S | - | per party |
| Luxury | S | L | S | S | S | **D** | **D** | **D** | S | S | S | D | S | D | S | per party | per party |
| Adventure | S | **D** | **D** | S | S | S | L | - | S | **D** | S | S | L | S | **D** | per party | - |
| Luxury-adventure | S | **D** | **D** | S | S | **D** | D | D | S | D | S | D | L | D | D | per party | per party |
| Road trip | S | S | S | D | D | S | S | L | **D** | D | S | S | S | S | S | per party | per party |
| Camper / van | S | S | S | S | S | **D** (campsites) | L | - | **D** | D | S | S | L | L | D | per party | per party |
| Hut-to-hut / trek | D | **D** | S | L | L | **D** (huts) | L | - | S | **D** | S | S | - | S | **D** | per party | - |
| Multi-generation | S | S | S | D | S | D | D | S | D | S | S | S | S | S | S | **D** | **D** |
| Solo | S | D | D | D | D | S | S | L | S | S | D | D | S | S | D | - | per party |
| Friends group | S | S | D | S | S | D | D | S | S | S | S | D | D | S | S | - | per party |
| Accessible | S | L (only accessible) | L | D | S | D | S | S | D | S | S | S | S | S | D | per party | **D** |

"per party" means the family-and-kids or accessibility lane goes deep when the party includes children or
anyone with a mobility, sensory or medical need, whatever the trip type.

## Profiles

Each profile lists: **what matters**, **defaults and filters** the intent sheet applies, **deal-breakers**
(facts that remove an item or a destination), and **questions research must answer** before a plan is
trusted.

### Day trip

- What matters: drive time from home (each way), the order of the day (parking fills, light, crowds),
  one big payoff plus one or two fillers, a break at least every 2 hours of driving, food on the way,
  a rainy-day fallback within 30 minutes.
- Defaults: radius from the household (`Travel Preferences.md`: about 200 km or 2 hours); half day,
  full day or sunrise-to-sunset; transport car, transit or bike.
- Deal-breakers: lot that fills before the realistic arrival time with no shuttle; a reservation that
  must be made days ahead (Conservation Halton parks, Elora tubing) when the trip is "this Saturday".
- Questions: Does the lot need a reservation, and when do slots release? What time does it fill on a
  summer Saturday? Is there a fee, and is it a provincial pass or a conservation-authority one (the
  Ontario Parks pass does not cover CA parks)? What is open on the day of the week chosen?

### Weekend (1-3 nights)

- What matters: one base, Friday evening arrival, Sunday afternoon departure traffic, two full days at
  most, places to eat on Friday night and Sunday morning, check-in and check-out times.
- Defaults: one base; balanced pace; leave after 17:00 Friday, home by 20:00 Sunday.
- Deal-breakers: minimum-stay rules (2 or 3 nights on long weekends), sold-out lodging.
- Questions: Long-weekend traffic patterns (the Algonquin plan: leave by 13:30 or after 19:30)? Which
  restaurants are closed Sunday or Monday? Minimum stays on holiday weekends?

### Vacation (1-3 weeks)

- What matters: bases and nights per base, travel days, booking windows months ahead, documents, fares,
  rest days, weather-swappable days, a Plan B per weather-sensitive day.
- Defaults: 3-5 bases; at least one slack day per week; no more than 3 hours driving on two consecutive
  days.
- Deal-breakers: entry rules the party cannot meet in time (visa lead time, passport validity); a
  must-do whose booking window has passed with no fallback.
- Questions: When does each booking window open (and in which time zone)? Which roads, lifts and huts
  close inside the dates? School holidays and local holidays that change crowds and prices?

### Family with young kids (under 8)

- What matters: hard limits (age, height, weight) per activity; walking distance and gain per day;
  toilets, shade, water, playgrounds; nap windows; stroller or carrier; short drives; fenced edges;
  family rooms or two-bedroom units; early dinners; kids' prices and free ages.
- Defaults: walk limit about 5 km and 300 m gain per day; drive legs under 2 hours with a stop; avoid
  unfenced cliff edges (household rule from `Travel Preferences.md`).
- Deal-breakers: minimum age or height above the youngest child for a must-do with no family
  alternative; hotel rooms that cannot sleep the party; long exposed sections.
- Questions: Exact minimum age, height and weight per product (not per operator)? Is there a family
  version (Kicking Horse family float 8+ versus Class III 12+)? Toilets at the trailhead? Child fares
  and the age bands? Stroller-friendly surface?

### Family with tweens and teens

- What matters: real adventure that they can legally do (via ferrata 12+, rafting 12+, zipline weight
  bands), independence, Wi-Fi, food they will eat, enough challenge on hikes.
- Defaults: walk limit about 12 km and 800 m gain (the Norway plan's ceiling was 12 km round trip);
  one adventure per two days.
- Deal-breakers: limits checked against age **on the day of the activity** (a child who turns 12 the
  week before counts as 12).
- Questions: Limits per product, harness weight ranges (Loen via ferrata 40-120 kg), whether a parent
  must accompany, waiver age (often 18 to sign).

### Couple

- What matters: scenery per hour of effort, good food, a few special moments (a sunset spot, a
  viewpoint at the right light), walkable bases, flexibility.
- Defaults: balanced pace; evenings free; one splurge meal.
- Questions: Which viewpoint at which light (computed, not "golden hour")? Which base is pleasant in the
  evening rather than only by day?

### Romantic / honeymoon

- What matters: the room (view, bath, privacy, adults-only), dinner reservations at the right places,
  sunset timing, spa, slow mornings, few transfers, surprise-able moments (private tour, scenic flight).
- Defaults: slow pace; at most one change of base per 3 nights; adults-only filter on stays.
- Deal-breakers: a "romantic" room that faces the car park; restaurants that need booking 60 days ahead
  and are full.
- Questions: Room categories and which ones have the view (by floor or side)? Honeymoon perks? Dinner
  booking windows? Sunset direction from the terrace on the exact dates?

### Luxury

- What matters: stays (category, service, room type), private transfers, chef's tables, spas, private
  guides, the cost of each upgrade, cancellation terms on expensive items.
- Defaults: comfortable or splurge budget; door-to-door transfers; no shared shuttles unless the only
  access (Moraine Lake is shuttle or tour only, even for luxury travellers).
- Questions: What does the top category actually include? Is the "private" tour private? What is the
  free-cancellation deadline on each high-cost booking?

### Adventure

- What matters: the hard objectives (summits, via ferrata, canyoning, glacier travel), conditions
  windows (snow-free dates, avalanche bulletins, river levels), guide requirements, gear rental, fitness,
  acclimatisation, rescue and insurance.
- Defaults: packed pace allowed; weather-swappable days; Plan B per objective.
- Deal-breakers: a route closed for the season or by a superintendent closure; a guide-only route with
  no guide available; insurance that excludes the activity.
- Questions: Snow-free window by aspect and elevation? Group-size rules (Parks Canada group-of-four in
  grizzly areas)? Permits? Gear rental availability? Emergency access and coverage?

### Luxury-adventure

- What matters: the adventure lane at full depth plus stays and food at luxury depth; private guiding;
  heli access; recovery (spa, massage) after big days.
- Questions: Heli-hike operators and their minimum ages and weights; private guide day rates; lodge
  options at the trailhead end.

### Road trip

- What matters: legs and stops (a break every 2 hours), fuel or charging, scenic detours, road closures
  and seasonal openings (Trollstigen, Going-to-the-Sun), ferries and their booking, tolls and passes,
  winter tyres, one-way rental fees, cell dead zones.
- Defaults: no leg over 4 hours without a meaningful stop; arrive at bases before dark.
- Questions: Seasonal road opening dates and their variability? Ferry reservations needed? EV charging
  gaps on the route?

### Camper / van

- What matters: campsites (open dates, hookups, showers, reservations), where sleeping is legal (Iceland:
  campsite only), vehicle restrictions (2WD barred from F-roads, length limits on mountain passes),
  dump stations, water, propane, insurance exclusions.
- Defaults: days ordered around campsites, not trailheads (the Iceland plan's finding).
- Deal-breakers: campsite closed for the season; a road the vehicle may not use; no insurer covers a
  required river crossing.
- Questions: Which campsites are open on each night? Camping-card validity dates? Vehicle-specific road
  rules?

### Hut-to-hut / trek

- What matters: hut opening dates, booking opening dates and how fast they fill, stage distances and
  gains, exits and bailouts, water, half-board, cash-only huts, luggage transfer, the last bus at the end.
- Defaults: rest or weather day every 4-5 stages.
- Deal-breakers: huts closing before the dates (the Chamonix plan: huts close about 20 Sep, bookings open
  about 15 Oct the year before); stage beyond the party's limits with no bailout.
- Questions: Hut booking opening date and channel? Cash only? Snow on passes in the dates? Bailout points
  per stage?

### Multi-generation

- What matters: the slowest and the youngest decide the day; split days (tracks A, B, C as in the
  Rockies plan); accessible rooms close to lifts; rest times; seating at viewpoints; short walks to the
  car; senior fares.
- Questions: Step-free routes and viewpoints? Benches and toilets? Senior prices and age bands? Lodging
  with lifts and ground-floor rooms?

### Solo

- What matters: safety (trailhead traffic, cell coverage, check-in services), social options (group
  tours, hostels with private rooms), single supplements, transit over car where possible.
- Questions: Which hikes are reasonable alone? Group-tour options with single pricing? Night safety of
  bases?

### Friends group

- What matters: group bookings (large rentals, group rates), activities with group minimums, split costs,
  nightlife, a mix of difficulty levels.
- Questions: Group rates and minimums? Large-rental options and their rules (quiet hours, parties)?

### Accessible

- What matters: step-free routes, accessible parking, accessible toilets, surfaces and gradients, rest
  points, accessible transport (shuttles with lifts), room features (roll-in shower, grab bars), sensory
  considerations, service-animal rules.
- Defaults: show only items with accessibility `step-free` or `partial` plus a reason.
- Deal-breakers: "accessible" with a single step at the entrance; a shuttle without a lift when it is the
  only access.
- Questions: Exact surface and gradient (boardwalk, packed gravel)? Accessible parking count? Does the
  shuttle carry wheelchairs?

## How profiles drive a research job

1. The trip (or the area being onboarded for a set of expected trip types) names its types.
2. `research_brief` merges their lane depths and returns the lanes with the required field sets for that
   depth.
3. The job runs the lanes in the order in onboarding-and-refresh.md, skipping lanes marked `-`.
4. Coverage is computed per kind and per trip type ("good for families with young kids" can be thin while
   "good for adventure" is good), and the intent sheet reports the score for the trip's types.
