# Lane: events and seasonal

Status: draft (17 Oct 2026).

## 1. Purpose

What is happening during the dates: festivals, markets, sporting events that fill hotels (UTMB in
Chamonix), cultural and religious holidays (Diwali), natural events (salmon runs, migrations, blooms,
larch and foliage peaks), and seasonal closures that are events in themselves (the Mont Blanc tunnel's
autumn closure, lift closing Sundays).

## 2. Produces

`entity` kind `event` (R6) with `event_occurrence` rows per year; relations to the places affected
(`affects`, new relation kind, with `attrs.effect`: `crowds`, `prices_up`, `closure`, `road_closed`,
`must_see`).

## 3. Required fields

`name`, `area_id`, `attrs.kind` (`festival`, `market`, `sport`, `holiday`, `natural`, `closure`), the
recurrence pattern (`attrs.recurrence`: fixed date, nth weekday, lunar, condition-driven), at least one
occurrence with status (`confirmed`, `expected`, `cancelled`) and source.

## 4. Optional fields

`attrs.effect`, `attrs.tickets` (offer), `attrs.family_friendly`, `attrs.crowd_level`, `attrs.best_spot`.

## 5. Sources, in order

Organisers; official tourism event calendars; municipal notices; for natural events, park and wildlife
agencies and long-running trackers.

## 6. Evidence rules

Confirmed occurrences need the organiser or an official calendar; expected ones state the pattern and
the years observed.

## 7. Leave empty

Future dates presented as confirmed when only the pattern is known (UTMB 2028 dates unknown when the
Chamonix plan was made).

## 8. Freshness

Occurrences: until confirmed, re-checked every 60 days inside a year of the date; patterns 365 days.

## 9. Traps

Events that make a base impossible (hotel prices tripled); closures that look like events
(lift-closing Sunday may fall on 10 Sep); lunar holidays moving each year.

## 10. Example changeset (abridged)

```json
{ "changes": [ { "op": "create", "target_kind": "entity", "temp_ref": "e1",
  "patch": { "kind": "event", "name": "UTMB week", "area_id": "area_chamonix",
    "attrs": { "kind": "sport", "recurrence": "late August, about 7 days", "effect": ["crowds", "prices_up"] } } } ],
  "occurrences": [ { "entity": "e1", "year": 2028, "status": "expected", "starts_on": null, "ends_on": null } ],
  "gaps": [ { "target": "e1", "field": "occurrence.2028.starts_on", "reason": "dates not announced" } ] }
```
