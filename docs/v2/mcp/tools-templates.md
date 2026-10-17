# Template tools: reuse a planned trip as it is, or adapted

A **template** is a trip with `is_template = true`: day numbers instead of dates, no travellers'
personal data, no reservation details (only "to book" placeholders), published by the owner (curated)
or by a user. Templates are how the owner's researched trips become samples others start from.

Templates carry adaptation metadata (needed in the schema; see "Data the adapter needs" below):
valid months, the nights range it supports, which days can be cut first, optional extra days, and a
priority per item (`must`, `should`, `nice`).

---

## `list_templates`

**Purpose.** Find templates to start from.

**Scope.** `catalog:read`.

| Field | Type | Req. | Meaning |
|---|---|---|---|
| `area` | string | no | |
| `month` | int | no | only templates valid in that month (or adaptable to it) |
| `nights` | `{min?, max?}` | no | |
| `styles` | string[] | no | `family`, `couple`, `romantic`, `adventure`, `luxury`, `road_trip`, `day_trip`, `weekend`, `hiking`... |
| `party` | `{ages:int[]}` | no | fit summary per template |
| `curated_only` | bool | no | owner-published only |

**Output.** `{templates:[{id, title, area, nights, nights_range:[10,16], valid_months:[6,7,8,9],
styles, author:"owner"|"user", fit:"good"|"partial: 3 adult-only days have family tracks", summary,
cover, url, version}]}`.

**Ops.** `template.list`.

---

## `fork_template`

**Purpose.** Copy a template into a new trip of the user's own, unchanged except dates and party.
Use `adapt_trip` when length, season or party differ from the template's.

**Scope.** `trips:write`.

| Field | Type | Req. | Meaning |
|---|---|---|---|
| `template` | string | yes | |
| `start_date` | date | no | without it the trip keeps day numbers only |
| `travellers` | as in `create_trip` | no | default household |
| `title` | string | no | |
| `mode` | `preview` \| `apply` | no | default preview |
| `preview_id` | string | with apply | |
| `client_op_id` | string | apply | |

**Output (preview).** `{preview_id, trip_outline:[{day, date?, base, items:n}], to_book:[{title,
kind, book_by}], warnings:[party_fit, season], summary}`. **Apply:** `{trip:{compact}, url,
tasks_created:n}`.

**Ops.** `trip.fork` (copies lists, items, day notes, variants, Plan B links, to-book placeholders;
recomputes booking deadlines, sun, checks; records `forked_from` and template `version`).

**Notes.** If the preview shows party or season warnings, offer `adapt_trip` instead.

---

## `adapt_trip`

**Purpose.** Reshape a template or an existing trip to a **different length, dates or season, or
party**, as a reviewable diff. Example: "the Rockies 14-night plan, but 10 nights in late June with a
6-year-old".

**Scope.** `trips:write` (and `catalog:read` for templates).

| Field | Type | Req. | Meaning |
|---|---|---|---|
| `source` | string | yes | template id or trip id |
| `into` | `"new_trip"` \| trip id | no | default `new_trip` for templates, the same trip for trips |
| `start_date` | date | no | new dates (season follows) |
| `month` | int | no | when only the month is known |
| `nights` | int | no | new length |
| `travellers` | as in `create_trip` | no | new party |
| `prefs` | object | no | pace, walking limit, styles to weigh |
| `keep` | string[] | no | item or entity ids that must survive |
| `drop` | string[] | no | item or entity ids to remove |
| `mode` | `preview` \| `apply` | no | default preview |
| `preview_id` | string | with apply | |
| `client_op_id` | string | apply | |

**What the adapter does, in order** (deterministic, explained per change):

1. **Length.** Shorter: remove `nice` items, then whole days in the template's cut order (each cut
   day's `must` items move to neighbouring days at the same base if they fit the pace), then merge
   bases with one night left. Longer: insert the template's optional days first (for the Rockies, the
   Waterton days of the 16-night option), then spare days at bases with the most unplaced `should`
   items. Base order and the open-jaw shape are kept.
2. **Season.** For each item, compare the entity's season, closures and hours with the new dates.
   Closed or out of season → replace with an `alternative_to` relation or the item's Plan B, else move
   to Ideas with the reason. Weather-sensitive items get the month's normals checked (snow above the
   tree line, rain days). Sunrise and sunset items are re-timed from `sun`. Seasonal draws (larches,
   foliage, midnight sun) that do not happen in the new month are flagged, not silently dropped.
3. **Party.** Eligibility per traveller (age, height, weight, walking limit, gain). On days with
   variants, pick the track that fits; where one person cannot do an item and no variant exists,
   propose the catalog's `family_alternative` / `less_walking` relation or split the day.
4. **Bookings.** Every reservation becomes a `to_book` placeholder with its new `book_by` from the
   offer window; windows already passed for the new dates are flagged ("Moraine shuttle seats for
   late June released on 15 Apr: already open").
5. **Checks.** Day checks on the result; anything still failing is listed with fixes.

**Output (preview).**

```json
{ "preview_id":"prv_9", "expires_at":"2026-10-18T12:00:00Z",
  "summary":"14 → 10 nights; 2029-06-20 to 2029-06-30; 4 days cut; 6 items replaced for June; 5 items swapped to family tracks",
  "days":[ {"day":1,"date":"2029-06-20","base":"Banff","changes":[]},
           {"day":4,"base":"Lake Louise","changes":[
             {"type":"replace","from":"Larch Valley to Sentinel Pass","to":"Moraine Lake Rockpile","reason":"Child 1 (6): 750 m gain over limit; larches not in season in June"},
             {"type":"warn","item":"Plain of Six Glaciers","reason":"Snow on upper trail usually into early July (catalog: season mid-Jul)"}]} ],
  "cut_days":[{"template_day":11,"reason":"cut order 1: Jasper rest day"}],
  "to_book":[{"title":"Moraine Lake shuttle","book_by":"2029-04-15T14:00:00Z","note":"40% of seats at opening; rest 48 h ahead"}],
  "unresolved":[{"item":"Athabasca Glacier ice walk","why":"min age 8 (operator); no alternative in the catalog"}] }
```

**Errors.** `validation_failed` (nights below the template's minimum: hint gives the minimum),
`needs_confirmation` on apply without `preview_id`, `not_found`.

**Ops.** `trip.adapt` (planner + checks + season and eligibility rules), then `trip.fork` or a batch of
item operations on apply.

**Notes for clients.** Show the summary and the `unresolved` list before applying. Do not promise
that a seasonal highlight will happen in the new month. Ask the user before cutting a `must` item.

---

## Data the adapter needs (requirements on the schema)

These are not yet in `schema.sql` and should be added when templates are built (M5):

| Field | On | Meaning |
|---|---|---|
| `template_meta` jsonb | `trip` | `valid_months`, `nights_min`, `nights_max`, `cut_order` (day numbers), `optional_days` (refs to day groups), `party_notes`, `styles` |
| `priority` | `trip_item` | `must`, `should`, `nice` (default `should`) |
| `template_version` int | `trip` | increments when a published template changes; forks store the version they came from so the app can say "the template has 3 updates" |
| `weather_sensitive` bool | `trip_item` | derived from the entity kind and tags, overridable |
