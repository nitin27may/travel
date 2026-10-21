# Trips as data: the contract

Written 21 Oct 2026 by travel-planner (Opus), task TD-0 ([SKILLS-AND-DATA-ONLY.md](../../docs/v2/SKILLS-AND-DATA-ONLY.md)
section 5, gap G1). Every op name, input shape, error code and command below was run on `main` at fffb38d.

A trip is data, never HTML (owner, 21 Oct; [PLAN.md](../../docs/v2/PLAN.md) section 1, "No new HTML"). A new trip is
`data/trips/<id>/trip.json`, written only through the ops CLI, plus a dateless schedule and the `capture/1` records its
research produced. The schema is `core/src/schema/trip.ts`; the template is
[research/formats/templates/trip.json](../../research/formats/templates/trip.json), built by the op sequence in section 5.

**Recommendation.** A public trip fills the public tables of section 3 and leaves every planner table empty. The web
adapter (TD-2) reads only the allowlist in section 3, so a planner table cannot leak even when it is filled.
**Trade-off:** the format still holds household tables, so a public trip and a household's private trip share one file
shape, and the allowlist must grow by hand when TD-1 adds a table or column.

## 1. Files per trip

| File | Format | Written by | Holds | Published |
|---|---|---|---|---|
| `data/trips/<id>/trip.json` | trip, `schema_version` 1 (`core/src/schema/trip.ts`) | the ops CLI only (section 5) | the trip, its bases, days, tracks, items, and the planner tables | only the allowlisted columns, through the adapter (after TD-2) |
| `data/trips/<id>/routes/<route-id>.json` | `route-geometry/1` | nothing yet: `route.compute` is catalogued but not implemented | a stored route line (`routes.geometry_file`) | through the adapter |
| `data/trips/<id>/proposals/<proposal-id>.json` | proposal | read by `proposal.apply` and `proposal.reject`; the ops that would write one (`research.propose`, `day.optimise`) are catalogued but not implemented | changes not yet applied | never |
| `data/schedules/<id>.json` | `trip-schedule/1` ([../schedules/README.md](../schedules/README.md)) | by hand; no op writes it | the order, pinned times, splits and legs a rule cannot know | the timeline built from it |
| `data/schedules/legs/<id>.json` | `trip-legs/1` | `node web/scripts/legs-ors.mjs` (needs `ORS_API_KEY`) | road times between consecutive stops | the timeline built from it |
| `data/capture/<id>/<lane>.json` | `capture/1` ([research/formats/README.md](../../research/formats/README.md)) | research lanes | the places, routes, offers and events the trip visits | as place pages |
| `data/suitability/<id>/<lane>.json`, `data/relevance/<id>/<lane>.json` | `suitability/1`, `relevance/1` | research lanes | who each record suits; why it matters | on the place pages |
| `research/trips/<id>/<lane>.md` | Markdown | research lanes | raw findings, never published | never |
| `data/trips/<id>/gallery.json` | `trip-gallery/1` | **not yet: TD-3** | the trip's photos | after TD-3 |

Three files at the top of `data/trips/` are shared, not per trip, and are keyed by **legacy folder**, not by trip id:
`base-points.json` (`trip-base-points/1`, the pin of a trip with no positioned base), `covers.json` (`trip-covers/1`) and
`stop-refs.json` (`trip-stop-refs/1`). A new data trip has no entry in any of them. TD-3 re-keys `covers.json` by trip id.

The `<id>` is the same string in every path above. A schedule, a legs file and the capture folder of a new trip all use
the trip id, never a legacy folder name.

## 2. Ids

| Id | Rule | Enforced by |
|---|---|---|
| Trip id (`id`, `trip.slug`, the folder) | Lower-case words joined by hyphens (`^[a-z0-9]+(-[a-z0-9]+)*$`). The three must be equal. **A new trip id carries no year** (`scottish-highlands`, not `scottish-highlands-2027`; SD-9). The 14 existing slugs keep their years | `E_SLUG` in `core/src/validate/trip.ts` |
| Reserved words | Not one of `places`, `trips`, `trails`, `activities`, `stays`, `eateries`, `offers`, `areas`, `adventures`, `bookings`, `globe`, `locations`, `inbox`, `api`, `mcp`, `data`, `assets`, `geo`, `_next`, `legacy`, `new`, `edit`, `review`, `backlog`, `plan`, `schema`, `about`, `fonts`, `icons` (`RESERVED_SLUGS`, `core/src/schema/enums.ts`) | `E_SLUG` |
| Slug stability | The slug is stored, not computed, so it does not drift the way place slugs do (SRV-D risk 2, [schema-diff-2026-10.md](../../research/reports/schema-diff-2026-10.md) section 13). It never changes: `trip.update` refuses a new slug with `E_SLUG`. To rename, `trip.copy` to the new slug (references only) and retire the old one; a redirect is then needed | `trip.update` |
| Legacy collision | A data trip whose slug equals a legacy folder hides that folder's list row (`loadTrips`, `web/lib/data/trips.ts`). The deploy staging step refuses the collision unless `trip.web_published` is true. Do not reuse a legacy slug for a new trip | `tools/publish.py` `web_published()` |
| Row ids inside a trip | Kebab case, unique per table, stable once written: other rows and the change log name them. Suggested forms: bases by town (`el-chalten`), items `d<n>-<what>` (`d2-viewpoint`), gotchas `g-<n>`, hazards `h-<n>`, weather rules `wr-<n>`, knowledge `k-<n>` | the primary keys in `trip.ts`; `E_PK_CHANGE` on update |
| Day numbers | `days.n` runs 1..N, or 0..N when day 0 is a travel day before Day 1, with no gaps | `E_DAYS_CONTIGUOUS` |
| Capture refs on items | **Not yet.** Items carry `place_id`, `trail_id`, `activity_id` and `eatery_id`, which point at the old catalogue (`data/catalog/**`, `data/locations/locations.json`), not at `capture/1` refs. TD-1 adds the link from an item to its capture record. Until then, leave those columns null unless the catalogue row exists, and name the place in `title` | TD-1 |

## 3. Public tables and planner tables (the allowlist TD-2 reads)

Every column flagged `private` in `core/src/schema` is in a trip table, and all 14 are in planner tables:
`travellers` (`age_years`, `age_as_of`, `height_cm`, `weight_kg`, `fitness`, `citizenship`, `notes`), `trip_bookings`
(`price_paid_amount`, `price_paid_currency`, `confirmation`, `contact`), `fare_windows` (`party`) and `emergency`
(`insurer_tel`). No catalogue, locations or capture schema carries the flag. The column flag is not enough on its own:
whole tables (`editions`, `budget`, `documents`) are household data with no flag. Hence a table-level allowlist, and inside
a public table, a column-level one.

**Public tables, with the columns the adapter may read.** A column not named here is never read, even in a public table.

| Table | Public columns | Left out, and why |
|---|---|---|
| `trip` | `slug`, `title`, `subtitle`, `primary_style`, `duration_shape`, `movement_shape`, `party_shape`, `countries`, `region_label`, `season_months`, `season_note`, `nights`, `theme`, `hero_image`, `answer_prose`, `orientation_prose` | `status` (personal state); `origin`, `origin_tz`, `base_currency` (the home town and its money); `owner_id`, `shared_with`, `generated_by`, `created` (account and file metadata); `legacy_url`. `visibility` and `web_published` are read as gates, never output |
| `trip_tags` | `tag_id` | none |
| `bases` | `id`, `name`, `place_id`, `night_from`, `nights`, `lat`, `lon`, `tz`, `elevation_m`, `why`, `why_not` | `stay_id`, `lodging` (no stay ideas on the public site) |
| `days` | `n`, `title`, `kind`, `base_id`, `summary`, `prose`, `flexible_group`, `decision_rules`, `plan_b_title`, `plan_b_text`, `sun_note`, `day_of_links` | `accepted_warnings` (validator bookkeeping) |
| `day_tracks` | all: `day`, `track`, `audience`, `title`, `notes`, `split` | none |
| `items` | all except the three on the right | `booking_id` (booking state), `pinned` and `override` (planner state) |
| `trip_trails` | `trail_id`, `role`, `alternative_of`, `turnaround_rule`, `kid_fit`, `verdict` | `party_note` (about the party that went), `override` |
| `trip_activities` | `activity_id`, `day`, `verdict`, `why`, `offer_id` | none |
| `custom_items` | `id`, `name`, `kind`, `lat`, `lon`, `address`, `osm_id`, `notes`, `duration_min`, `open_from`, `open_to` | `proposed`, `catalog_id` (catalogue workflow) |
| `routes` | `id`, `days`, `waypoints`, `profile`, `geometry_file` | `break_every_min`, `daily_max_drive_min`, `corridor_km`, `break_types`, `avoid`, `provider`, `computed` (driver preferences and tool state) |
| `hazards` | all | none |
| `weather_rules` | all | none |
| `knowledge` | all: `id`, `claim`, `status`, `src` | none. A `gap` or `conflict` status is shown, never hidden (honesty rule) |
| `gotchas` | all | none |
| `sources` | `id`, `url`, `title`, `publisher`, `kind`, `checked` | `research_ref` (points into `research/`) |

**Planner tables: never read for the public site, and empty in a public trip.** `profile`, `travellers`, `editions`,
`trip_bookings`, `notes`, `budget`, `fx`, `fare_windows`, `fare_quotes`, `documents`, `emergency`, `packing`,
`questions`, `research_refs`, `changelog`.

- `profile` is required by `trip.create` and must hold valid values, but it describes the household's pace, budget and
  limits, so it is never read for the public site. The template fills it with neutral defaults.
- `travellers` may be `[]`. A public trip says who it suits through `party_shape`, the day tracks' `audience` and the
  suitability sidecars, never through people.
- `emergency` is planner-only today because it shares a row with `insurer_tel`. A public emergency block would need its own
  column list; that is a later decision, not TD-2's.
- `changelog` is written by every op. It names actors and times, so it stays internal.

As a machine-readable list for TD-2 (`web/lib/public/data-trips.ts`, not yet written):

```json
{
  "trip": ["slug", "title", "subtitle", "primary_style", "duration_shape", "movement_shape", "party_shape", "countries", "region_label", "season_months", "season_note", "nights", "theme", "hero_image", "answer_prose", "orientation_prose"],
  "trip_tags": ["tag_id"],
  "bases": ["id", "name", "place_id", "night_from", "nights", "lat", "lon", "tz", "elevation_m", "why", "why_not"],
  "days": ["n", "title", "kind", "base_id", "summary", "prose", "flexible_group", "decision_rules", "plan_b_title", "plan_b_text", "sun_note", "day_of_links"],
  "day_tracks": ["day", "track", "audience", "title", "notes", "split"],
  "items": ["id", "day", "track", "seq", "start", "window_start", "window_end", "tz", "duration_min", "type", "optional", "title", "place_id", "trail_id", "activity_id", "eatery_id", "custom_item_id", "base_id", "lat", "lon", "address", "leg_id", "leg_mode", "leg_km", "leg_minutes", "leg_basis", "leg_notes", "cost_amount", "cost_currency", "cost_per", "open_from", "open_to", "closed_weekdays", "needs_daylight", "plan_b_item_id", "notes", "links"],
  "trip_trails": ["trail_id", "role", "alternative_of", "turnaround_rule", "kid_fit", "verdict"],
  "trip_activities": ["activity_id", "day", "verdict", "why", "offer_id"],
  "custom_items": ["id", "name", "kind", "lat", "lon", "address", "osm_id", "notes", "duration_min", "open_from", "open_to"],
  "routes": ["id", "days", "waypoints", "profile", "geometry_file"],
  "hazards": ["id", "category", "title", "text", "severity", "days", "trail_ids", "place_ids", "mitigation", "src"],
  "weather_rules": ["id", "day", "metric", "op", "value", "at", "action", "plan_b_day"],
  "knowledge": ["id", "claim", "status", "src"],
  "gotchas": ["id", "text", "src"],
  "sources": ["id", "url", "title", "publisher", "kind", "checked"]
}
```

TD-2 owns the code and the test that pins this list against `TRIP_TABLES`: a new table or column must be classified here
before it can reach the site.

## 4. Dateless rules

Public trips are templates: Day 1 to N, a length and a season window ([PLAN.md](../../docs/v2/PLAN.md) section 1,
"Trips"; the owner's rewrite table is [public-trips-dateless.md](../../docs/v2/design/public-trips-dateless.md)).

| Rule | How |
|---|---|
| No calendar date in a public table | Dates live only in planner tables: `editions` (`start`, `end`), `fare_windows`, `fare_quotes`, `trip_bookings.deadline_date`, `budget.read_date`, `questions.asked`. A public trip has `editions: []` |
| Days are relative | `days.n` is Day 1 to N. Text says "Day 3", never "Thu 15 Jul". Item times are clock times (`hh:mm`) in the item's or the base's `tz`; times of day are not dates |
| The season is months, with the reason | `season_months` (for example `[9, 10]`) and `season_note` (why those months). The season is required for a public trip. The schedule's `season` is a month-day pair used only for sun times |
| Weekdays are rules, not dates | "Market on Saturdays only" is a rule (`items.closed_weekdays`, a decision rule); the planner checks it once a person picks dates |
| A year is a data vintage, not a date | A bare year is allowed when it labels a reading: "EUR 40, 2026 price", "Observed: in 2026 colours peaked in late September". A day and month ("27 Sep") or a month and year ("February 2027") is not |
| Booking timing is relative | "Book about 4 months ahead", "opens 30 days before Day 3 at 08:00 local". The rule is a property of the offer (`window` in the `capture/1` record), not a date in the trip. `trip_bookings` and its `book_by_offset` are planner state |
| File metadata is not a trip date | `updated`, `trip.created`, `changelog.at` and `sources.checked` are dates, but they are bookkeeping or provenance, never when to travel. `trip.created` and `changelog` are outside the allowlist |
| Who it suits, not who went | No traveller names, ages or home town. `origin` is `""` in a public trip; `origin_tz` is the trip's own zone |

Nothing checks `trip.json` text for dates yet. The public adapter has the pattern (`DATE_TEXT` in
`web/lib/public/dateless.ts`, tested in `web/tests/data/dateless.test.ts`) and drops dated text from legacy trips; TD-2
should run it over the allowlisted columns of a data trip and fail the build on a hit.

## 5. Writes go only through the ops

Never edit `trip.json` by hand. Every write goes through `node core/bin/ops.ts <operation> --input <file or ->`, which:
- validates the whole trip before it writes, so a failing write changes nothing ("Nothing was written");
- appends a `changelog` row with the actor;
- returns an `inverse` (`--json`), a `trip.restore` input that puts the exact earlier bytes back.

A hook (`tools/hooks/data_changed.sh`) also validates `data/trips/*/trip.json` after any editor write, but it is a safety
net, not a licence to hand-edit.

Every write needs an `actor`: `{"id": "agent:trip", "via": "skill:trip"}` from the `trip` skill, `{"id": "u_owner",
"via": "cli"}` from the owner. Pin the clock with `TRAVEL_TODAY=YYYY-MM-DD` and `TRAVEL_NOW=<ISO datetime>` for
reproducible output. Full input schemas: `echo '{"name":"item.add"}' | node core/bin/ops.ts ops.describe --input -`.

**Row inputs are complete rows.** `base.set`, `item.add`, `track.set` and the `*.upsert` / `*.add` row ops take a strict
row: every column of the table must be present, nullable ones as `null`. Only `day.update`, `item.update` and
`trip.update` take a partial `patch`. Copy a row from the template and change it.

### 5.1 The sequence for a new trip

| # | Op | What it does | Minimal input (besides `actor` and `slug`) |
|---|---|---|---|
| 1 | `trip.create` | Creates `data/trips/<slug>/trip.json` with N+1 empty days (`kind` `mixed`) and, when N > 0, one provisional base `base-1` covering every night | `trip` (all 27 columns), `profile` (all 25), `travellers: []`, `trip_tags: [{"tag_id": <primary_style>}]`; no `editions` |
| 2 | `base.set` | Replaces the night split; days whose base vanished move to the base that covers their night | `bases: [<full base row>, ...]` |
| 3 | `day.update` | Patches one day | `n`, `patch: {"title", "kind", "summary", ...}` |
| 4 | `day.add`, `day.remove`, `day.swap` | Changes the day count; the bases and every day column move with it | `row`, or `n`, or `a` and `b` |
| 5 | `track.set` | Adds a track (A adult-only, B family, C less walking, P Plan B) to a split day | `row: {"day", "track", "audience", "title", "notes", "split"}` |
| 6 | `item.add` | Adds an item; `seq` is renumbered 1..n per day and track | `row: <full items row>` |
| 7 | `item.update`, `item.move`, `item.remove` | Edits, moves or removes an item | `id` and `patch`, or `seq`, `day`, `track` |
| 8 | `gotcha.add`, `knowledge.add`, `hazard.upsert`, `weather_rule.upsert` | The "what to know first" layer | `row: <full row>` |
| 9 | `trail.link`, `trip_activity.set`, `custom_item.add`, `route.set` | Catalogue links, trip-local stops, a route request | `row` |
| 10 | `trip.update` | Patches the trip row, for example `orientation_prose` or `hero_image` | `trip: {<columns>}` |
| 11 | `trip.validate` | Reads only: the validator plus the day checks | `{"slug": "<id>"}` or `{"candidate": <whole trip>}` |

Worked inputs (the template was built with exactly these, in this order: `trip.create`, `base.set`, `day.update` x3,
`item.add` x4, `gotcha.add`, `hazard.upsert`, `weather_rule.upsert`, `knowledge.add`):

```bash
node core/bin/ops.ts trip.create --input create.json   # trip, profile, travellers [], trip_tags: copy from the template
node core/bin/ops.ts base.set --input - <<'EOF'
{"actor": {"id": "agent:trip", "via": "skill:trip"}, "slug": "example-trip",
 "bases": [{"id": "example-base", "name": "Example town", "place_id": null, "stay_id": null, "lodging": null,
            "night_from": 1, "nights": 2, "lat": null, "lon": null, "tz": "America/Toronto", "elevation_m": null,
            "why": "Why this town is the base.", "why_not": "What it costs."}]}
EOF
node core/bin/ops.ts day.update --input - <<'EOF'
{"actor": {"id": "agent:trip", "via": "skill:trip"}, "slug": "example-trip", "n": 2,
 "patch": {"title": "The main day", "kind": "hike", "summary": "The day the trip is for.",
           "plan_b_title": "Rain plan", "plan_b_text": "What to do instead.",
           "decision_rules": ["If the forecast at 07:00 gives rain above 60%, switch to Plan B."]}}
EOF
node core/bin/ops.ts item.add --input item.json        # row: copy an item of the template, change id, day, title
```

### 5.2 Rules the ops and the validator enforce

| Code | Rule | What to do |
|---|---|---|
| `E_NIGHTS_SUM` | `trip.nights` equals the sum of `bases.nights` | `base.set` with nights that add up; `day.add` and `day.remove` keep them in step |
| `E_BASE_COVER` | every night is covered by exactly one base; a day trip (0 nights) has no base | set `night_from` 1, then contiguous |
| `E_DURATION_SHAPE` | `duration_shape` follows `nights`: day-trip 0, weekend 1-2, short-break 3-5, week 6-9, multi-week 10+ | set it in `trip.create` |
| `E_STYLE_TAG` | `primary_style` also appears in `trip_tags`, and the tag must exist (`E_FK`) | see section 7, gap 4 |
| `E_FK` | `countries` must be in the locations store; tags in `data/vocab/tags.json` or the store; `place_id`, `trail_id` and the other catalogue ids must exist | see section 7, gap 5 |
| `E_ITEM_REF` | a `trail` item names a `trail_id`; `checkin` and `checkout` name a `base_id`; at most one of trail, activity, eatery and custom item | |
| `E_ITEM_TIME` | `start` or a window, never both; `window_end` not before `window_start` | |
| `E_VISIBILITY` | `web_published` is false on a private trip | |
| `E_SRC` | every id in a `src` column is in the trip's `sources` table | see section 7, gap 6 |
| `W_NO_COORDS` and the other `W_` day checks | warnings only; they never change the exit code | give items or bases `lat` and `lon`, or a catalogue id |

## 6. Validate

```bash
node core/bin/validate.ts data/trips/<id>/trip.json            # one trip; exit 1 on an error
echo '{"slug":"<id>"}' | node core/bin/ops.ts trip.validate --input -   # same checks, JSON out
node core/bin/validate.ts --all                                 # every data file, trips included
bash tools/check-all.sh                                         # the whole gate
```

The `check-all` stages that cover a trip and its research: "core tests" (which validate the template), "ops CLI lists the
catalogue", "generated schema is up to date", "validate every data file", "suitability sidecars", "relevance sidecars",
"relevance derived files are current", "source registry is current and valid", and the web typecheck, lint, test and
build (the trips list reads `trip.json`). Run it with `web/.env.local` moved aside.

The template cannot be validated in place (the validator reads every JSON file under `research/` as a research sidecar).
Validate a copy outside the repository, as [research/formats/README.md](../../research/formats/README.md) shows.

## 7. What the web app reads today, and what is not yet possible

**Reads today.** `loadDataTrips` (`web/lib/data/trips.ts`) reads `trip.slug`, `title`, `subtitle`, `visibility`,
`web_published`, `legacy_url`, `region_label`, `hero_image`, `nights`, and the first chosen or booked `editions` row for
the list date. It skips a private trip without reading further. The result is one row in the trips list. `tools/publish.py`
reads `trip.web_published` for the legacy collision rule. The MCP server (`core/bin/mcp.ts`) and `trip.get` read the whole
file. Nothing else in `web/` reads `trip.json`: no trip page, no days, no items, no place pages.

**Ignored today.** Every table except `trip` and `editions`. The trip pages under `/trips/<slug>/` are built only from the
14 legacy folders (`TRIP_SLUGS` in `web/lib/public/slugs.ts`), and a data trip's capture records get no place pages
(`captureSeeds` skips a trip with no legacy folder).

**Note for TD-2.** `loadDataTrips` reads `editions`, a planner table, to date the list row. A public trip has no
editions, so nothing leaks today, but the allowlist in section 3 forbids it; TD-2 removes that read.

**Until TD-2 merges**, a new public trip keeps `web_published: false` and `legacy_url: null`
([SKILLS-AND-DATA-ONLY.md](../../docs/v2/SKILLS-AND-DATA-ONLY.md) 4.4). It then shows in the trips list with no link and
no date.

| # | Not yet possible | Why | Closed by |
|---|---|---|---|
| 1 | An item cannot name the capture record it visits | `items` has catalogue ids only (`place_id`, `trail_id`, ...), no capture ref | TD-1 |
| 2 | Sub-regions with a photo each; a cover with a defined format | `orientation_prose` is one text field; `hero_image` is free text | TD-1 |
| 3 | A trip page, or place pages for its records | the web app builds trip pages from legacy folders only | TD-2 |
| 4 | Any `primary_style` except `adventure` | `E_STYLE_TAG` requires the style in `trip_tags`, and only `adventure` of the eight styles exists as a tag in `data/vocab/tags.json` or the locations store (`active-nature`, `scenic-relaxed`, `luxury-relax`, `relax`, `city-culture`, `road-trip`, `mixed` fail `E_FK`) | TD-1 (add the seven style tags, or relax the rule); until then use `adventure` or add the tag first |
| 5 | A trip to a country not in the locations store | `countries` is a foreign key to the store's countries, which holds 7 codes today (CA, CN, FR, IN, IT, US, VN). A Scottish Highlands trip (`GB`) fails `E_FK` | add one place in that country through the `location` skill first, which creates the country row |
| 6 | Sources on gotchas, hazards and knowledge | no op writes the trip's `sources` table, so every `src` must stay `[]` (`E_SRC` otherwise). Facts are cited in the `capture/1` records, which is where the public site shows provenance | not scheduled; raise with TD-1 if a trip needs it |
| 7 | A gallery or a cover for a data trip | the only gallery home is `legacy/<folder>/gallery/`, which is frozen; `covers.json` is keyed by legacy folder | TD-3 |
| 8 | The 14 existing trips as data | their content is in legacy JSON, the prototype snapshot and HTML meta tags | TD-4, after R2 |
| 9 | Writing a schedule through an op | `data/schedules/<id>.json` is written by hand and checked by the web timeline tests | not scheduled |
| 10 | A stored route line, or proposals from research | `route.compute`, `research.propose` and `day.optimise` are in the catalogue (`--list`) with no implementation; running one fails with `E_UNIMPLEMENTED`. Road times come from `data/schedules/legs/<id>.json` instead | not scheduled |

## Gotchas

- `trip.create` seeds N+1 days of kind `mixed` and a base `base-1` named after `region_label`. The result validates, so a
  half-finished trip passes check-all. Read the days back before calling it done.
- `base.set` replaces all bases. Days pointing at a removed base move to the base that covers their night, and the last
  day's `base_id` becomes `null`.
- Validating the template in place fails with `research-sidecar` errors. That is the path rule, not a broken template.
- `trip.copy` keeps references only, sets the copy private and drops `editions`; it is how a household plan becomes a
  public template, or the reverse.
