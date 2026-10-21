# Lane: family and kids

Status: draft (17 Oct 2026).

## 1. Purpose

Make every entity answer "can **our** children do this, and will they enjoy it": hard limits, realistic
distances, facilities, safety edges, family versions of adult activities, kid prices, and kid-specific
places (splash pads, playgrounds, interactive museums, beaches with shallow water). The household in the
intent notes travels with kids 9-12 and avoids unfenced cliff edges; the Rockies plan was built around a
6-year-old with a family track every day.

## 2. Produces

Fields on existing entities and offers, plus kid-specific places (sights lane subkinds `splash_pad`,
`playground`, `science_centre`, `zoo`, `aquarium`, `farm`, `beach`), and `alternative_to` relations from
family options to adult ones.

## 3. Required fields (for any entity a family might choose)

`eligibility.min_age` / `min_age_guidance` (rule versus our judgement, never confused), height and
weight limits where they exist, `attrs.kid_note` (one honest sentence with the numbers behind it),
`eligibility.stroller`, `attrs.toilets`.

## 4. Optional fields

`attrs.kid_prices` (age bands), `attrs.free_under`, `attrs.cliff_edges` (`fenced`, `partly_fenced`,
`unfenced`, with where), `attrs.water_safety` (lifeguards, depth, currents), `attrs.shade`, `attrs.nap_friendly`
(drive-time naps, quiet rooms), `attrs.family_alternative` (relation), `attrs.less_walking_alternative`,
`attrs.kid_engagement` (what keeps them interested: tea house, scramble section, wildlife, junior ranger
programme with its dates), `attrs.change_tables`.

## 5. Sources, in order

Operators and land managers (limits and facilities); official family pages; parent blogs and forums with
dates (engagement, real difficulty); school-programme pages for seasonal kids' programmes.

## 6. Evidence rules

Limits `operator`/`official` only. Guidance (min age, kid note) is `agent_inferred` from stats plus
community, and is labelled as guidance in the UI.

## 7. Leave empty

A min age "rule" where none exists; claims like "kids love it" without an observation.

## 8. Freshness

Limits 365 days; programmes per season.

## 9. Traps

Age on the activity date; weight in pounds; programmes ending before the trip (Junior Explorer ends
about 31 Aug); "family" rafting with a weight minimum a small child fails; viewpoints with a fence on one
side only.

## 10. Example changeset (abridged)

```json
{ "changes": [ { "op": "update", "target_kind": "entity", "target_id": "ent_larch_valley_sentinel", "base_version": 1,
  "patch": { "eligibility": { "min_age_guidance": 9, "stroller": "no" },
    "attrs": { "kid_note": "11.2 km return and 750 m gain: long for under-9s; Larch Valley meadow (about 8 km, 535 m) is a natural turnaround", "cliff_edges": "unfenced" } },
  "evidence": [ { "field": "eligibility.min_age_guidance", "value": 9, "source": { "url": "research", "kind": "agent" }, "observed_on": "2026-10-17", "quote": "guidance from distance and gain; no official minimum", "confidence": "agent_inferred" } ] } ],
  "relations": [ { "from": "ent_moraine_lakeshore", "to": "ent_larch_valley_sentinel", "kind": "alternative_to", "attrs": { "reason": "family" } } ] }
```
