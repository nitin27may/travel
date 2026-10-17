# Lane: hidden gems

Status: draft (17 Oct 2026).

## 1. Purpose

Find places locals love and guidebooks skip, **and prove they are real, reachable, legal and safe to
visit**. A hidden gem without evidence is a rumour; a hidden gem on private land or reached by
trespassing is a liability.

## 2. Produces

The same entity kinds as sights, trails, food or stays, with the tag `hidden_gem` and
`attrs.gem_reason` (why it is special, why it is not crowded).

## 3. Required fields

All required fields of the entity's own lane, plus: `attrs.gem_reason`, `attrs.access_legal`
(`public`, `permission_needed`, `paid_entry`, `unclear` (blocks publish)), at least **two independent
sources** (one may be community), `point`.

## 4. Optional fields

`attrs.local_source` (local newspaper, regional blog, club), `attrs.crowd_risk` (would a listing harm it:
`low`, `medium`, `high`; high means we list it without the exact point and say so), `attrs.season_tip`.

## 5. Sources, in order

Regional tourism (small boards, not national), local press, clubs and associations, regional blogs with
dates, conservation-authority pages, OSM and Wikidata for existence and position, community forums.

## 6. Evidence rules

Existence and access need an `official` source or two independent community sources with dates within
3 years. Access legality must be stated by a source, not inferred.

## 7. Leave empty

Points for sensitive sites (nesting areas, fragile caves, sacred places): store the area only and state
why. Anything on private land without stated permission.

## 8. Freshness

As the base lane; plus `attrs.access_legal` 365 days (access changes after crowding).

## 9. Traps

Viral spots closed after crowding; "secret" waterfalls on private property; social-media locations that
were never where the caption said; listing a place that cannot absorb visitors.

## 10. Example changeset (abridged)

```json
{ "changes": [ { "op": "create", "target_kind": "entity", "temp_ref": "g1",
  "patch": { "kind": "place", "subkind": "waterfall", "name": "...", "tags": ["hidden_gem"],
    "attrs": { "gem_reason": "short walk, swimming hole, mostly visited by locals on weekdays", "access_legal": "public", "crowd_risk": "medium" } },
  "evidence": [ { "field": "attrs.access_legal", "value": "public", "source": { "url": "https://...conservation-authority...", "kind": "official" }, "observed_on": "2026-10-17", "quote": "Open to the public dawn to dusk", "confidence": "official" } ] } ] }
```
