# Lane: community reality checks

Status: draft (17 Oct 2026).

## 1. Purpose

What visitors report that official pages do not: real parking fill times, queues, crowds, bugs, smell,
noise, construction, whether the view is worth it, whether the "family-friendly" trail has a scary
ledge, whether a restaurant's hours are real. This lane rarely creates entities; it **adds dated community
evidence and flags conflicts** with what the catalog says.

## 2. Produces

Evidence rows with `confidence = community` on existing fields (`attrs.fills_by`, `attrs.crowds`,
`attrs.payoff`, `hours`), `condition_report` rows of kind `warning` with short validity, and conflict
flags; occasionally `attrs.reality_note` (our words, dated).

## 3. Required fields

For each finding: the field it bears on, the observation, the **date of the observation** (not of
reading), the source URL, and for patterns (fill times, crowds) at least two independent reports.

## 4. Optional fields

Season and day of week of the observation; party type of the reporter (family, solo) when stated.

## 5. Sources, in order

Recent trip reports (blogs with dates), forums (Reddit, regional hiking forums, Rick Steves forum), club
trip logs, local news, video walk-throughs. Review sites are read for patterns but their text is never
stored (paraphrase, link only where allowed).

## 6. Evidence rules

Community evidence never overrides `official` values; it creates a conflict or a dated note. A single
report is a note, not a pattern.

## 7. Leave empty

Opinions without observations ("overrated"); anything older than 3 seasons for conditions.

## 8. Freshness

365 days for patterns; 7-30 days for conditions observations.

## 9. Traps

Viral posts with wrong locations; one bad day presented as the norm; reports from a different season;
copying review text.

## 10. Example changeset (abridged)

```json
{ "changes": [ { "op": "update", "target_kind": "entity", "target_id": "ent_parking_xyz", "base_version": 4,
  "patch": { "attrs": { "fills_by": [ { "season": "07-01..08-31", "days": "weekend", "time": "08:45" } ] } },
  "evidence": [
    { "field": "attrs.fills_by", "value": "08:45", "source": { "url": "https://...blog-2025-08", "kind": "community" }, "observed_on": "2026-10-17", "applies_to": "2025-08-16", "quote": "Lot full when we arrived at 08:50 on a Saturday", "confidence": "community" },
    { "field": "attrs.fills_by", "value": "08:30", "source": { "url": "https://...forum-2026-07", "kind": "community" }, "observed_on": "2026-10-17", "applies_to": "2026-07-11", "quote": "Full by 08:30, overflow on the road", "confidence": "community" } ] } ] }
```
