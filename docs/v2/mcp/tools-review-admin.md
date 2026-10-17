# Review and admin tools

Scopes: `review` for `review_queue`, `decide`, `merge_entities`; `admin` for `publish_template`,
`coverage` (writes), `backlog` (writes). At family scale the owner holds both; the web admin console
(`/admin`) is the main place to review, and these tools let the owner review from a chat client too.

---

## `review_queue`

**Purpose.** Open changesets with their changes as diffs, evidence and automatic checks.

| Field | Type | Req. | Meaning |
|---|---|---|---|
| `status` | string[] | no | default `submitted` |
| `area`, `lane`, `author` | string | no | filters |
| `changeset_id` | string | no | one changeset in full |
| `limit`, `cursor` | | no | |

**Output.**

```json
{ "changesets":[ {"id":"cs_12","author":"owner (pat:research-laptop)","job":"El Chaltén trails","submitted_at":"...",
   "changes":[ {"id":"chg_88","op":"create","target":"entity","name":"Laguna de los Tres",
      "diff":{"attrs.distance_km":{"old":null,"new":21.2}},
      "evidence_summary":"2 sources: 1 official, 1 reference",
      "checks":{"schema":"ok","inside_area":"ok","duplicates":[],"licence":"ok","official_source":true},
      "suggested":"accept"} ] } ] }
```

`suggested` is `accept` only when the schema passes, there is an official source for each fact, no
duplicate is suspected and nothing conflicts with an accepted value.

**Ops.** `review.queue`.

---

## `decide`

**Purpose.** Accept, reject or edit-then-accept changes.

| Field | Type | Req. | Meaning |
|---|---|---|---|
| `decisions` | `{change_id, decision:"accept"\|"reject"\|"edit", patch?, note?}[]` | yes | |
| `changeset_id` + `all` | | no | bulk: `all:"suggested"` accepts every change marked suggested |
| `trust` | `stated` \| `verified` | no | for accepted facts; `verified` needs a second official source or the reviewer's own visit |
| `client_op_id` | string | yes | |

**Output.** `{applied:n, rejected:n, entities:[{id, url, version}], changeset_status:"accepted"|"partial"|"rejected"}`.

**Errors.** `conflict` (the entity changed since the proposal's `base_version`: shows both),
`forbidden`.

**Ops.** `proposal.apply`, `proposal.reject` (apply writes the entity, evidence rows and an `op_event`;
the inverse is kept so an accepted changeset can be rolled back).

**Notes.** Never accept on the user's behalf without them asking. Bulk accept only `suggested` changes.

---

## `merge_entities`

**Purpose.** Merge duplicates (the same lake imported from OSM and proposed by research).

| Field | Type | Req. | Meaning |
|---|---|---|---|
| `keep` | string | yes | surviving entity |
| `merge` | string[] | yes | entities folded into it |
| `field_choices` | `{field: entity_id}` | no | which value wins per field (default: `keep`'s) |

**Output.** `{kept:{id, url}, merged:[...], references_moved:{trip_items:n, relations:n, media:n, evidence:n}}`.

**Ops.** `catalog.merge` (redirects old ids so trips never break).

---

## `publish_template`

**Purpose.** Publish (or unpublish) a trip as a template after a privacy check.

| Field | Type | Req. | Meaning |
|---|---|---|---|
| `trip` | string | yes | |
| `action` | `preview` \| `publish` \| `unpublish` | yes | |
| `visibility` | `public` \| `link` | publish | |
| `curated` | bool | publish | owner's featured samples (admin only) |
| `release_note` | string | no | shown to people who forked an earlier version |

**Output (preview).** Exactly what others will see, and what was stripped:
`{template_outline, stripped:{travellers:4, reservation_details:9, attachments:6, private_notes:3, expenses:12},
blocked_by:["Day 7 note mentions a confirmation number"], url_preview}`.

**Ops.** `template.preview`, `template.publish` (copies the trip into a template snapshot with
`template_version` + 1; never shares the source trip's private rows).

**Notes.** Always run `preview` first and show the stripped list to the owner.

---

## `coverage`

**Purpose.** Read (and for admin, recompute) how well each area is covered per kind.

| Field | Type | Req. | Meaning |
|---|---|---|---|
| `area` | string | no | default: all areas with entities |
| `recompute` | bool | no | admin |

**Output.** `{areas:[{area, kinds:{trail:{n:42, with_media:0.8, fresh:0.9, score:"good"}, stay:{...}}}]}`.

**Ops.** `catalog.coverage`.

---

## `backlog`

**Purpose.** The research to-do list: gaps from coverage, stale fields, conflicts, user requests.

| Field | Type | Req. | Meaning |
|---|---|---|---|
| `action` | `list` \| `add` \| `close` | yes | |
| `area`, `lane` | string | no | filters / for add |
| `reason` | string | add | |
| `id` | string | close | |

**Output.** `{items:[{id, area, lane, reason, priority, trips_affected, requested_by, status}]}`.
Priority = max(1, trips using the area) × urgency (days until the nearest trip) × severity.

**Ops.** `backlog.add`, `backlog.list`, `backlog.close`.
