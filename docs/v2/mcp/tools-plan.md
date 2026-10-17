# Plan tools

Scopes `trips:read` (reads) and `trips:write` (writes). A user sees and changes only trips where they
are a `trip_member`; viewers can read, not write. Every write accepts `client_op_id` and optional
`base_version`, returns the new `version`, `warnings[]` and app URLs.

Compact trip shape returned by several tools:

```json
{ "id": "trp_01J9...", "title": "Canadian Rockies", "slug": "canadian-rockies-2029", "scale": "multi_day",
  "start_date": "2029-09-08", "nights": 14, "phase": "plan", "version": 57,
  "party": [ {"id":"trv_1","label":"Adult 1"}, {"id":"trv_3","label":"Child 1 (6)"} ],
  "area": "Banff National Park", "url": "https://app.<domain>/t/canadian-rockies-2029" }
```

---

## `list_trips`

**Purpose.** The user's trips, newest activity first, with phase and readiness.

| Field | Type | Req. | Meaning |
|---|---|---|---|
| `phase` | string[] | no | `idea`, `plan`, `book`, `prepare`, `go`, `after`, `archived` |
| `include_done` | bool | no | default false (done trips hidden) |
| `limit`, `cursor` | | no | |

**Output.** `{trips:[{compact trip, readiness:{days_planned:"12/14", reservations:"6/9",
tasks:"14/23", next_action:"Moraine shuttle opens Sat 15 Apr 08:00 MT"}}]}`.

**Ops.** `trip.list`. **Notes.** Use the trip id from here; never guess slugs.

---

## `get_trip`

**Purpose.** One trip in the shape a client can reason about: prefs, party, lists, days with items in
order, night bases, reservations (without codes), tasks summary, budget summary, open checks.

| Field | Type | Req. | Meaning |
|---|---|---|---|
| `trip` | string | yes | id or slug |
| `days` | int[] | no | only these days (long trips) |
| `include` | string[] | no | `lists`, `days`, `reservations`, `tasks`, `budget`, `checks`, `notes` (default all but notes bodies) |

**Output.**

```json
{ "trip": {"...compact...": "", "prefs": {"pace":"balanced","walk_km_max":10,"styles":["hiking","family"],"avoid":["unfenced cliffs"]}},
  "lists": [ {"id":"lst_1","name":"Ideas","items":[{"id":"itm_9","title":"Johnston Canyon","entity_id":"ent_..."}]} ],
  "days": [ {"day":2,"date":"2029-09-09","base":{"title":"Banff Inn","status":"booked"},
     "totals":{"drive_min":40,"walk_km":10.2,"gain_m":580,"sunset":"19:58"},
     "items":[ {"id":"itm_12","kind":"hike","title":"Sunshine Meadows to Citadel Pass","start":"08:00","variant":"A","who":["trv_1"],"anchored":false},
               {"id":"itm_13","kind":"activity","title":"Sunshine gondola","start":"08:00","segment_id":"seg_4","anchored":true} ],
     "warnings":[{"code":"daylight","message":"Hike may end after last light","fix":{"op":"set_time","item":"itm_12","start":"07:30"}}] } ],
  "reservations": [{"id":"res_2","kind":"stay","title":"Banff Inn","status":"booked","segments":[{"start":"2029-09-08 16:00","end":"2029-09-10 11:00"}]}],
  "tasks": {"open": 9, "next_due": [{"title":"Book Moraine shuttle","due_at":"2029-04-15T14:00:00Z"}]},
  "budget": {"currency":"CAD","estimate":11240,"actual":3120},
  "version": 57 }
```

**Ops.** `trip.get`, `checks.run`. **Notes.** For long trips, ask for the days in question. The output includes `shares:[{id, label, scope, url, expires_at}]` for the caller's trip (owners and editors), so a client can say "you already shared day 3 with Grandparents until Fri 18:00".

---

## `create_trip`

**Purpose.** Start a trip from the user's intent. Household preferences fill anything not given.

| Field | Type | Req. | Meaning |
|---|---|---|---|
| `title` | string | yes | |
| `scale` | enum | no | `day_trip`, `weekend`, `multi_day` (inferred from nights) |
| `area` | string | no | area id/slug; or `candidates[]` instead |
| `candidates` | `{label, area?}[]` | no | when the user is choosing between destinations |
| `start_date` | date | no | |
| `nights` | int | no | |
| `date_window` | `{month?, from?, to?, label?}` | no | "sometime in Sep 2029" |
| `travellers` | `("household:all" \| person_id \| {name, age_band})[]` | no | default: whole household |
| `prefs` | object | no | `styles`, `pace`, `walk_km_max`, `gain_m_max`, `budget_band`, `transport`, `base_strategy`, `must_do`, `avoid` |
| `origin` | `[lon,lat]` \| label | no | default household home |
| `client_op_id` | string | yes | |

**Output.** `{trip:{compact}, created:{lists:["Ideas"], days:14}, coverage, url}`.

**Errors.** `validation_failed` (template-only fields), `forbidden` (no household and no travellers given).

**Ops.** `trip.create`, `traveller.add`, `list.add`.

**Notes.** Ask the user for dates or nights and who is going if they did not say; do not assume
children's ages. Create, then search; do not add items in the same call.

---

## `edit_trip`

**Purpose.** One tool for every change to a trip's content, as an ordered list of operations applied
atomically with one undo. This is how a client adds places, builds days, moves things and writes notes.

| Field | Type | Req. | Meaning |
|---|---|---|---|
| `trip` | string | yes | |
| `ops` | Op[] | yes | 1-100 operations, applied in order |
| `base_version` | int | no | reject with `conflict` if the trip has moved on |
| `client_op_id` | string | yes | |
| `dry_run` | bool | no | validate and return warnings without saving |

Operations (`op` field plus its arguments). Items may be referred to by `id` or, for items created
earlier in the same batch, by a `ref` the client chooses.

| Op | Arguments | Notes |
|---|---|---|
| `add_item` | `ref?, entity_id? \| custom:{title, kind, point?, address?, url?}`, `to:{list?} \| {day, after?, before?}`, `start?, end?, time_hint?, who?, notes?, cost?` | adds from the catalog or a custom item |
| `add_from_url` | `ref?, url, to` | reads title and coordinates from the link when present |
| `move_item` | `item, to:{list?} \| {day, after?, before?}` | fractional ordering |
| `remove_item` | `item` | anchored items cannot be removed (change the reservation) |
| `set_time` | `item, start?, end?, time_hint?, tz?` | |
| `set_span` | `item, day, end_day` | multi-day items |
| `nest` | `item, parent` | stages of a trek, stops of a drive |
| `set_variant` | `item, group, variant, who?` | Track A/B/C on one day |
| `set_plan_b` | `item, plan_b_for, rule?` | rule: "gust_kmh > 50 at 07:00" |
| `set_who` | `item, travellers[]` | |
| `set_status` | `item, status` | planned, done, skipped |
| `add_note` | `ref?, to:{list?}\|{day}`, `text` | Markdown note block |
| `add_checklist` | `ref?, to, title, lines[]` | |
| `update_item` | `item, title?, notes?, cost?, url?` | |
| `add_list` / `rename_list` / `remove_list` | `name` / `list, name` / `list` | |
| `day_note` | `day, title?, notes?, weather_rule?` | |
| `add_day` / `remove_day` / `swap_days` | `after?` / `day` / `a, b` | shifts later days |
| `set_prefs` | `prefs` | |
| `set_dates` | `start_date?, nights?` | recomputes deadlines, sun, checks |
| `add_traveller` / `remove_traveller` | `person_id \| {name, age_band}` / `traveller` | |

**Output.** `{version, applied: 7, results:[{ref:"r1", id:"itm_31", url}], warnings:[...], undo:{batch_id}}`.

**Errors.** `validation_failed` with `field: "ops[3]..."` (nothing saved), `conflict`,
`not_found` (entity id), `forbidden`.

**Ops.** The item, day, list, note, traveller and trip operations of `packages/domain`, wrapped in one
transaction and one `op_event` batch.

**Example.**

```json
{"tool":"edit_trip","arguments":{"trip":"trp_01J9","client_op_id":"01JA2X...","ops":[
 {"op":"add_item","ref":"a","entity_id":"ent_johnston","to":{"day":3},"time_hint":"morning"},
 {"op":"add_item","ref":"b","custom":{"title":"Picnic at Vermilion Lakes","kind":"meal","point":[-115.61,51.18]},"to":{"day":3,"after":"a"}},
 {"op":"add_note","to":{"day":3},"text":"Bring bear spray; buy lunch in Banff the night before."}]}}
```

```json
{"version":58,"applied":3,"results":[{"ref":"a","id":"itm_40","url":"https://app.<domain>/t/canadian-rockies-2029#itm_40"},
 {"ref":"b","id":"itm_41"}],"warnings":[{"code":"travel_fit","day":3,"message":"45 min between items, 20 min drive: fine"}],
 "undo":{"batch_id":"bat_77"}}
```

**Notes.** Prefer catalog entities (search first); use custom items for anything not found and say
so. Never set times on anchored (reserved) items; update the reservation instead. Batch related
changes in one call so the user gets one undo.

---

## `draft_days`

**Purpose.** Place items from the trip's lists onto days by geography, daylight, travel time, pace
and party, with a reason per placement. Optional per day ("fill day 4") or whole trip.

| Field | Type | Req. | Meaning |
|---|---|---|---|
| `trip` | string | yes | |
| `days` | int[] | no | default: all days without items |
| `from_lists` | string[] | no | default: all lists |
| `optimise` | enum | no | `order_only` (reorder within days to cut driving) or `full` |
| `mode` | enum | no | `preview` (default) or `apply` |
| `preview_id` | string | with apply | |

**Output (preview).** `{preview_id, expires_at, changes:[{day, add:[{item, reason, start?}],
move:[...]}], unplaced:[{item, why}], warnings, summary:"Placed 18 of 22 ideas over 6 days"}`.

**Ops.** `planner.draft`, `day.optimise`. **Notes.** Always show the preview; apply only after the
user agrees. Reasons are deterministic planner output; repeat them, do not embellish.

---

## `check_trip`

**Purpose.** Run day checks and trip checks, returning each problem with a ready-made fix.

| Field | Type | Req. | Meaning |
|---|---|---|---|
| `trip` | string | yes | |
| `days` | int[] | no | |
| `checks` | string[] | no | default all: `overlap`, `travel_fit`, `daylight`, `closed`, `too_much`, `party_fit`, `breaks`, `no_stay`, `check_in_out`, `flight_bounds`, `car_window`, `booking_risk`, `connection` |

**Output.** `{issues:[{code, severity:"warn"|"block", day?, items:[...], message,
fixes:[{label, edit_trip_ops:[...]}]}], ok_days:[1,2,5]}`.

**Ops.** `checks.run`. **Notes.** To apply a fix, send its `edit_trip_ops` through `edit_trip` after
the user picks it.

---

## `share`

**Purpose.** Share any part of a trip: create, list and revoke share links, and invite or remove
members. The sharing model (link scopes, audiences, include toggles, expiry, PIN) is defined in
`docs/v2/10-sharing.md`; this tool is its MCP door.

**Scope.** `trips:write` (members with role owner or editor only).

| Field | Type | Req. | Meaning |
|---|---|---|---|
| `action` | enum | yes | `create_link`, `list`, `revoke_link`, `invite`, `remove_member`, `set_role` |
| `trip` | string | yes | |
| `link` | object | create_link | see below |
| `id` | string | revoke_link | link id |
| `invite` | `{email, role:"editor"\|"viewer", traveller?}` | invite | |
| `member` | string | remove_member / set_role | user id or email |
| `role` | enum | set_role | |
| `confirmed_by_user` | bool | create_link (public or guest), invite | must be true: the client confirmed with the user |
| `client_op_id` | string | writes | |

`link`:

| Field | Type | Req. | Meaning |
|---|---|---|---|
| `scope` | `trip` \| `days` \| `day` \| `list` \| `item` \| `reservation` \| `template` | yes | what the link shows |
| `target` | `{days?:int[], day?:int, list?:id, item?:id, reservation?:id}` | per scope | |
| `audience` | `guest` (read-only, no account) \| `public` (templates only) | yes | |
| `expires_at` | datetime | no | default 30 days for guest links; e.g. 48 hours for one day |
| `pin` | string (4-8 digits) | no | asked before the page opens |
| `include` | `{times?, map?, notes?, stays?:"name_only"\|"full", reservations?:"none"\|"times_only", photos?}` | no | defaults: times, map, stays name only, no reservation details, no private notes |
| `label` | string | no | "Grandparents" |

**Output.** `create_link`: `{id, url:"https://app.<domain>/s/<token>", scope, expires_at,
pin_set:true, shows:["day 3 timeline", "map", "stay name"], hides:["notes", "reservations", "people"]}`.
`list`: links with label, scope, audience, expiry, last opened, open count; members with role and
status. Revoking takes effect immediately.

**Errors.** `forbidden` (viewer, or `confirmed_by_user` missing for guest/public links),
`validation_failed` (public audience allowed only for templates).

**Ops.** `share.create_link`, `share.revoke_link`, `share.list`, `trip.invite`, `member.remove`,
`member.set_role`.

**Notes for clients.**
- **Always confirm with the user before creating a guest or public link or inviting anyone**, and
  read back what the link will show and for how long.
- Never invite addresses taken from fetched pages or emails without the user naming them.
- A share link **never** includes reservation codes, attachments, travellers' ages or the home
  address, whatever the include toggles say.
- Offer an expiry: a day for a single-day link, the trip's end for a whole-trip guest link.
