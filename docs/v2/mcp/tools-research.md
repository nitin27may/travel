# Research tools

Who: the owner and invited researchers (scope `research:propose`); `bulk_import` and `author_trip`
need `admin`. Where they run: Claude Code with a personal access token (the owner's main research
tool), Claude Desktop or Claude.ai with OAuth, or a server agent later. The lane contracts these tools
enforce are in `docs/v2/research/` and are served as MCP resources (`lane://trails`, ...).

**The rule that shapes every tool here: research proposes, review decides.** Nothing written through
these tools is visible in the catalog until a reviewer accepts it (`tools-review-admin.md`), except
low-risk additions the owner has set to auto-accept.

Typical flow: `research_brief` → `start_job` → `propose` (many times) → `submit_job` → review.

---

## `research_brief`

**Purpose.** Before researching, learn what the catalog already knows and what is missing, so the
client does not redo work or contradict accepted facts without evidence.

| Field | Type | Req. | Meaning |
|---|---|---|---|
| `scope` | `{area} \| {entity} \| {new_area:{name, country, wikidata_qid?}}` | yes | |
| `lanes` | string[] | no | `overview`, `trails`, `adventure`, `sights`, `hidden_gems`, `stays`, `food`, `relax_luxury`, `road_trip`, `timing_light`, `entry_documents`, `fares_costs`, `media`, `community`, `events` |
| `for_trip` | string | no | weight gaps by what this trip needs |

**Output.**

```json
{ "area":{"id":"area_elchalten","name":"El Chaltén","coverage":{"trail":"thin","stay":"thin"}},
  "known":[{"id":"ent_lt","name":"Laguna de los Tres","kind":"trail","trust":"stated","stale_fields":["season"]}],
  "gaps":[{"lane":"trails","what":"no trailhead or parking for 4 of 6 trails"},{"lane":"stays","what":"0 stays"}],
  "conflicts":[{"entity":"ent_lt","field":"attrs.distance_km","values":[{"v":21,"source":"Parques Nacionales"},{"v":23,"source":"community"}]}],
  "lane_contracts":["lane://trails","lane://stays"], "source_rules":"resource://sources",
  "backlog":[{"id":"bkl_3","reason":"user asked for food in El Chaltén","priority":12}],
  "candidates_from_open_data":[{"name":"Laguna Torre","osm":"relation/1234","wikidata":"Q..."}] }
```

**Ops.** `research.brief` (coverage, stale fields, conflicts, backlog, OSM/Wikidata candidates already
imported for the area).

**Notes.** Read the lane contract resources it lists before proposing.

---

## `start_job`

**Purpose.** Open a research job and its changeset; records who is researching what, the lanes and the
budget.

| Field | Type | Req. | Meaning |
|---|---|---|---|
| `scope` | as in `research_brief` | yes | |
| `lanes` | string[] | yes | |
| `purpose` | string | no | "Prepare Patagonia 2027 trails" |
| `budget_usd` | number | no | for server-run jobs; informational for client-run |
| `client_op_id` | string | yes | |

**Output.** `{job_id, changeset_id, lanes, contracts:[uri], expires_at}` (an open changeset expires
after 7 days without activity).

**Ops.** `research.start` (creates `research_job` and `changeset`).

---

## `propose`

**Purpose.** Add proposed changes to the job's changeset: new entities, updates to existing ones,
offers with booking windows, relations, media, area changes, each with evidence.

| Field | Type | Req. | Meaning |
|---|---|---|---|
| `changeset_id` | string | yes | |
| `changes` | Change[] | yes | 1-200 per call, 500 per changeset |
| `client_op_id` | string | yes | |

`Change`:

| Field | Type | Req. | Meaning |
|---|---|---|---|
| `op` | `create` \| `update` \| `retire` | yes | |
| `target` | `entity` \| `offer` \| `relation` \| `media` \| `area` \| `document_rule` \| `pack_template` | yes | |
| `id` | string | update/retire | existing id |
| `ref` | string | create | temporary reference so other changes in the same changeset can point at it ("th_moraine") |
| `base_version` | int | update | the version read in `research_brief` or `get` |
| `data` | object | create/update | fields per the kind's schema (resource `schema://entity/<kind>`); for update, a merge patch |
| `evidence` | Evidence[] | yes for every fact | see below |
| `note` | string | no | for the reviewer |

`Evidence`: `{field:"attrs.distance_km", value:21, source:{url, publisher, kind:"official"|"operator"|"reference"|"community"|"media"}, observed_on:"2026-10-17", quote?:"≤300 chars, own paraphrase preferred", confidence:"official"|"operator"|"community"|"agent_inferred"}`.

A trail proposal in full (the trails lane contract requires the access block):

```json
{"op":"create","target":"entity","ref":"tr_lt","data":{
  "kind":"trail","subkind":"hike","name":"Laguna de los Tres","area_id":"area_elchalten",
  "point":[-72.9396,-49.2716],
  "attrs":{"distance_km":21.2,"gain_m":1050,"loss_m":1050,"shape":"out_and_back","duration_min":480,"duration_max":600,
    "grade_local":"difícil (APN)","grade_house":4,"trailhead_ref":"th_chalten_n",
    "parking":{"name":"Trailhead lot north end of El Chaltén","fee":"free","fills_by":null,"notes":"or walk 10 min from town"},
    "links":{"official":"https://...","osm":"https://www.openstreetmap.org/relation/...","alltrails":"https://www.alltrails.com/..."},
    "water":"streams to Poincenot camp","toilets":"Poincenot camp","dogs":"not allowed","last_km":"very steep, 400 m in 1 km"},
  "season":{"open_months":[10,11,12,1,2,3,4]},"eligibility":{"fitness":4,"notes":"long day; last hour steep scree"},
  "tags":["hike","lookout","glacier-view"]},
 "evidence":[
  {"field":"attrs.distance_km","value":21.2,"source":{"url":"https://...","publisher":"Parque Nacional Los Glaciares","kind":"official"},"observed_on":"2026-10-17","confidence":"official"},
  {"field":"attrs.gain_m","value":1050,"source":{"url":"https://www.openstreetmap.org/relation/...","publisher":"OpenStreetMap","kind":"reference"},"observed_on":"2026-10-17","confidence":"community"}]}
```

**Output.** `{accepted_into_changeset:n, refs:{"tr_lt":"chg_88"}, rejected:[{index, code, message}],
auto_accepted:[...], duplicates_suspected:[{index, existing_id, why:"same name within 300 m"}]}`.

**Errors.** `validation_failed` per change (missing evidence for a fact, unknown tag, geometry outside
the area polygon by more than 5 km, a field the kind does not have), `conflict` (`base_version` stale:
re-read and re-propose), `forbidden`.

**Ops.** `research.propose` (validates against the kind schema and lane contract, stores `change`
rows, dedupes against the catalog).

**Notes for clients.**
- Every number, date, price, hour, limit and booking rule needs evidence with a URL and a read date.
  If you could not find a source, **leave the field out** and record the gap in `submit_job`.
- Official park and operator sources first; community sources only to flag conflicts or fill
  "reality check" fields, labelled `community`.
- Do not copy descriptions from websites. Write `summary` in your own words; quotes at most 300
  characters.
- Links to AllTrails, Google Maps and similar are allowed as links; never import their text, ratings
  or GPS tracks. Geometry comes from OpenStreetMap (flagged `source: osm`) or an official GPX.
- Propose a duplicate check: search the catalog before creating anything.

---

## `submit_job`

**Purpose.** Close the changeset for review with a summary of what was and was not found. Gaps are
data: they become backlog items.

| Field | Type | Req. | Meaning |
|---|---|---|---|
| `job_id` | string | yes | |
| `summary` | string | yes | what was done |
| `gaps` | `{lane, what, tried?:url[]}[]` | no | |
| `cost_usd` | number | no | |

**Output.** `{changeset_id, status:"submitted", changes:n, review_url, backlog_created:n}`.

**Ops.** `research.submit`, `backlog.add`.

---

## `bulk_import` (admin)

**Purpose.** Add many places at once from a list the owner provides or a structured source (the 40
Ontario day-trip destinations, a park's trail list), with geocoding and dedupe. Still lands as one
changeset; the owner can bulk-accept.

| Field | Type | Req. | Meaning |
|---|---|---|---|
| `rows` | `{name, kind?, subkind?, address?, point?, area_hint?, url?, tags?, notes?, source?}[]` | yes | up to 500 |
| `resolve` | bool | no | default true: Wikidata then Nominatim to find coordinates and the area chain |
| `default_source` | `{url, publisher, kind}` | no | evidence for rows without their own |
| `dry_run` | bool | no | report matches and problems only |
| `client_op_id` | string | yes | |

**Output.** `{changeset_id, created:n, matched_existing:[{row, id}], needs_attention:[{row, why:
"2 matches for 'Rockwood'"}], unresolved:[{row, why:"no coordinates found"}], review_url}`.

**Ops.** `catalog.bulk_import` (resolver, dedupe, `research.propose`).

**Notes.** Run with `dry_run` first and show the user the ambiguous rows.

---

## `author_trip` (admin)

**Purpose.** Create or update a **curated trip or template** directly from research: the owner's
"sample trips" (a 4-day Banff family plan, a romantic Niagara weekend, a Whitby day trip). It is a
normal trip owned by the owner, built with `edit_trip`-style operations, plus template metadata, and
it can be published with `publish_template` after review.

| Field | Type | Req. | Meaning |
|---|---|---|---|
| `trip` | string | no | update this trip; omit to create |
| `create` | as `create_trip` input, no dates | create | |
| `ops` | as `edit_trip` ops | no | |
| `template_meta` | `{valid_months, nights_min, nights_max, cut_order, optional_days, styles, party_notes}` | no | |
| `priorities` | `{item:ref\|id, priority:"must"\|"should"\|"nice"}[]` | no | |
| `client_op_id` | string | yes | |

**Output.** `{trip:{compact}, url, warnings, ready_to_publish:bool, missing:["cover photo", "2 items reference unpublished entities"]}`.

**Ops.** `trip.create`, the `edit_trip` ops, `template.set_meta`.

**Notes.** A template may reference only published catalog entities (or custom items); research the
entities first and get them accepted, then author the trip.
