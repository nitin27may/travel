# Trip schedules

Authored inputs for the public trip timeline ([features/trip-timeline.md](../../docs/v2/features/trip-timeline.md)). The scheduler in
`core/src/schedule/` assigns times by rule; these files hold what a rule cannot know: the order a plan does things in, a time the
plan chose, a booked slot, a rejoin point, a leg the plan states. A trip with no file here still gets rule-based times
(the summary trips).

```
data/schedules/<trip-slug>.json         overrides, schema trip-schedule/1
data/schedules/legs/<trip-slug>.json    stored road times, schema trip-legs/1 (written by web/scripts/legs-ors.mjs)
```

Both are read by `web/lib/public/timeline.ts` at build time. They are never published as files; the timelines built from them are.

## Rules for these files

- **Dateless.** No calendar date anywhere in `<trip-slug>.json` (`web/tests/trips/timeline-data.test.ts` runs `DATE_TEXT` over it).
  The season window is a pair of month-day numbers, `[9, 8]` to `[9, 22]`, and is used only to compute sun ranges.
- **No household data.** No traveller names or ages. `defaultProfile` is the audience the plan was written for, and `writtenFor`
  is a suitability statement ("families with a child from about 6", "adults"), never a description of who travelled.
- **Every key resolves.** An item key is a record id in the trip's datasets (Rockies: `trails.json`, `sights.json`,
  `adventures.json`) or an entry inserted by the plan. A test fails on a key that resolves to neither.
- **Review with the CLI.** `node core/bin/schedule.ts --input <scheduleInput.json> --day 5 --profile family-6 --pace standard --split`
  prints a day as a table (time, confidence, lane, kind, title, duration, source).

## `trip-schedule/1`

```jsonc
{
  "schema": "trip-schedule/1",
  "trip": "canadian-rockies-2029",
  "defaultProfile": { "party": "family", "youngest": 6, "pace": "standard", "adults": 2 },   // the URL-state default, not a description
  "writtenFor": "families with a child from about 6",                                          // public: who the plan suits
  "tz": "America/Edmonton",
  "season": { "from": [9, 8], "to": [9, 22] },                                                // sun range window, month and day
  "variants": { "A": { "label": "Adults' hike", "audience": "adults" }, "B": {}, "C": {} },
  "bases": { "jasper": { "name": "Jasper", "lat": 52.8737, "lon": -118.0814 } },              // town centres, for sun times
  "titles": { "maligne-lake-cruise": "Spirit Island cruise" },                                 // short titles over the dataset names
  "days": {
    "5": {
      "kind": "normal",                       // arrival | departure | transfer | normal; derived from the bases when omitted
      "start": { "time": "07:30", "source": "plan", "label": "Leave Jasper" },
      "order": {                              // per variant, the items in the order the plan does them (the scheduler never reorders)
        "B": [
          "maligne-lake-cruise",              // a record id
          { "id": "pyramid-lake", "optional": true, "needs": { "sun": "sunset", "offsetMin": -40 } },   // a record id with overrides
          { "id": "jasper-errands", "kind": "visit", "sub": "errands", "title": "...", "durationMin": 120 }   // an id the datasets lack: an inserted entry
        ]
      },
      "items": {                              // overrides by record id, for every variant of the day
        "maligne-lake-cruise": { "time": "10:00", "confidence": "fixed", "source": "operator", "durationMin": 90, "durationSource": "operator", "checkinMin": 20 }
      },
      "split": { "optional": false, "rejoin": { "time": "14:00", "place": "the Maligne Lake boathouse car park", "afterItem": "mary-schaffer-loop" } },
      "legs": [ { "from": "base", "to": "maligne-lake-cruise", "minutes": 60, "mode": "drive", "basis": "plan", "estimate": true } ]
    }
  }
}
```

Item override fields: `time` (`null` clears the source's time), `confidence` (`fixed` for an operator slot, else `suggested`), `source`
(`operator`, `plan`, `data`), `note`, `title`, `kind`, `sub`, `durationMin` with `durationSource` (`plan`, `data`, `operator`),
`checkinMin` (arrive this long before a slot), `optional`, `needs` (`sunrise`, `sunset`, `golden-pm`, `civil-dusk`, `nautical-dusk` (follows the day, after dark, no clock time) with an offset in
minutes), `window` (`from`, `to`, `lastUp`, `lastDown`, `why`), `stats` (`distanceKm`, `gainM`), `minAge`.

Leg endpoints are item ids plus three fixed names: `base` (where the day starts), `next-base` (where a transfer or departure
day ends) and `origin` (the airport on an arrival day). A leg works in both directions unless a reverse row exists. `minutes: 0`
means "the same site": no leg is drawn. A pair with no leg here falls back to the straight-line estimate, then a 10 minute local move.

Times are suggestions unless `confidence` is `fixed`. An authored time is `suggested` with source `plan` and is pinned: the
scheduler bends the day around it. Sun-relative times are `anchored`.

## `trip-legs/1`

```jsonc
{
  "schema": "trip-legs/1",
  "trip": "dolomites-2027",
  "fetched": "2026-10-18",                    // the only date in these files: the header, for the attribution
  "attribution": "Road times from OpenRouteService (openrouteservice.org), route data from OpenStreetMap contributors (ODbL).",
  "legs": [ { "from": "san-candido", "to": "tre-cime", "profile": "driving-car", "mode": "drive", "km": 30.7, "minutes": 48 } ]
}
```

`from` and `to` are prototype place ids. The pairs are the consecutive stops of every day and variant (`web/lib/public/legs-pairs.ts`);
each ends at the place's trailhead or first car park when the data has one. Fill and check the cache with `web/scripts/legs-ors.mjs`
(see its header). The build never calls OpenRouteService, and the key never leaves the `Authorization` header.

## Not placed

Times the plan states in prose that the Rockies file does not carry as a pinned time are listed in the L3c hand-back
(the Rockies track notes hold about 80 clock times; this file pins the starts, slots, rejoins and last rides).
