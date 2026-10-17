# Resources and prompts

## Resources

Read-only documents a client loads into context. All carry `schema_version` and are cacheable. They
are generated from the same sources the server validates with (Zod schemas in `packages/domain`,
vocabularies and lane contracts in the database or `docs/v2/research/`), so they never drift.

| URI | Content | Generated from |
|---|---|---|
| `schema://entity/<kind>` (`place`, `trail`, `activity`, `stay`, `eatery`, `hub`) | JSON Schema of the kind: common fields, `attrs`, required fields, enums, units | Zod kind schemas |
| `schema://offer` | offer fields and the booking-window rules (`fixed_date`, `rolling`, `monthly_release`, `lottery`, `same_day`, `anytime`) with examples | Zod |
| `schema://reservation/<kind>` | reservation and segment fields per kind | Zod |
| `schema://trip` | trip, item, list, day note, edit ops | Zod |
| `vocab://tags` | the tag vocabulary: id, label, kind (style, activity, feature, audience), aliases | `tag` table (seeded from `data/vocab/tags.json`, 80 tags today) |
| `vocab://subkinds` | allowed subkinds per kind | Zod enums |
| `vocab://difficulty` | house scale 1-5 with mapping from local grades (Parks Canada easy/moderate/difficult, SAC T1-T6, CAI T/E/EE/EEA, YDS classes, APN) | `difficulty_scale` (seeded from `data/schema/difficulty-map.json`) |
| `rules://freshness` | how long each field family stays fresh (prices 120 days, hours 180, closures 7 in season, booking windows yearly, geometry 3 years) | `freshness_rule` (seeded from `data/schema/freshness.json`) |
| `rules://sources` | source order per lane, what counts as evidence, licences (OSM ODbL, Wikidata CC0, Commons per image, Google and AllTrails link-only), quoting limits | `docs/v2/research/` sources page |
| `lane://<lane>` | the lane contract: required fields, optional fields, preferred sources, how to record gaps, examples of a good proposal | `docs/v2/research/lanes/` |
| `profile://trip-type/<type>` | trip-type profiles (family, couple, romantic, luxury, adventure, luxury-adventure, road trip, camper van, day trip, weekend, multi-generation, solo): what matters, defaults, lanes to emphasise | `docs/v2/research/` trip types page |
| `profile://persona/<id>` | the saved views (persona quick-starts) and their filters | `saved_view` |

## Prompts

Prompts are recipes a user can pick in their client ("/travel plan-a-trip"). Each is a template with
arguments; the outline below is the text the server returns (shortened here where marked).

### `plan-a-trip` (args: `destination?`, `when?`, `nights?`, `who?`)

1. Call `household` (`get`) for standing preferences; ask only for what is missing: where, when (or
   a window), how long, who (ages), style, pace, walking limit, budget.
2. If the destination is undecided, `create_trip` with `candidates` and compare them with
   `area_guide` per candidate (travel time from home, best months, coverage). Let the user choose.
3. `list_templates` for the area and month; if one fits, offer `fork_template` or `adapt_trip` with a
   preview. Otherwise `create_trip`.
4. `search` with `for_trip` per interest; present 5-10 picks with their reasons and fit per person;
   add the chosen ones to Ideas with one `edit_trip` call.
5. Offer `draft_days` (preview); apply on agreement.
6. `check_trip`; walk the user through each issue and its fixes.
7. List what has to be booked (`reservations` to_book with `book_by`) and the next deadline.
8. End with the trip URL. Never invent facts; say when coverage is thin.

### `research-destination` (args: `area`, `lanes?`, `for_trip?`) — owner/researchers

1. `research_brief`; read the lane contracts and `rules://sources`.
2. `start_job` with the lanes.
3. Per lane: search official sources first (park authority, operator, tourism board), then reference
   (Wikidata, OpenStreetMap), then community only for reality checks. Record every fact with URL and
   read date. For trails, the access block (trailhead, parking, links, shuttle, permit) is required.
4. Dedupe with `search` before every create; propose in batches of up to 50 with `propose`.
5. `submit_job` with a summary and every gap (what you looked for and where).

### `research-lane` (args: `area`, `lane`) — same as above for one lane, with the lane contract inline.

### `add-reservation-from-email` (args: `trip?`)

1. Ask the user to paste the confirmation (or forward it to their import address instead).
2. Extract per booking: kind, provider, times with each end's zone, places, travellers, price,
   cancellation terms, contact. Never invent; mark missing fields.
3. Match passengers to travellers; ask if unclear. Drop passport and card numbers.
4. Show what you will save; on agreement call `reservations` `add` (codes only with
   `reservations:read`; otherwise tell the user to add the code in the app).
5. Report anchored items, tasks created and warnings (flight bounds, missing stays).

### `adapt-template` (args: `template`, `start_date?`, `nights?`, `who?`)

1. `get` the template outline; confirm new dates, length and party.
2. `adapt_trip` preview; explain cuts, replacements, unresolved items and passed booking windows.
3. Ask before dropping any `must` item; adjust with `keep`/`drop` and preview again.
4. Apply; then `check_trip` and list the to-book items with deadlines.

### `conditions-check` (args: `trip`, `days?`)

Run 7 days and 1 day before a trip (or on request):
1. `get_trip` for the days; `weather` forecast per base; `sun` for early or late items.
2. For each weather-sensitive item, apply its rule (gusts, rain, snow line) and report Plan B swaps.
3. Check closures and alerts on the official source for each trail and road in the plan (record any
   new closure as a `propose` change if the user has `research:propose`, else as a trip note).
4. Report one verdict per day: go, go with changes (list), switch to Plan B.
5. Offer `edit_trip` to apply the swaps.

### `refresh-area` (args: `area`, `fields?`) — owner/researchers

1. `research_brief` with stale fields and conflicts for the area.
2. Re-read the official source for each stale field; propose updates with new evidence (even when the
   value is unchanged: the new read date makes it fresh again).
3. Resolve conflicts by finding the official value; otherwise leave both and explain.
4. `submit_job`.
