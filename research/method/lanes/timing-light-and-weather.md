# Lane: timing, light and weather

Status: draft (17 Oct 2026).

## 1. Purpose

When to go and when in the day: seasons and their peaks (foliage, larches, wildflowers, waterfalls at
melt, whale and salmon runs, aurora darkness), climate by month, storm cycles, crowds by day and hour,
school and public holidays (local and the travellers' own), and **light**: which places want sunrise,
sunset or overcast, when a gorge is lit, when a valley loses the sun. This lane decides dates (Iceland's
dates were set by the darkness arithmetic) and the order inside days.

## 2. Produces

- `attrs.light` on entities (R12): computed windows per subject and month.
- Seasonal events as `event` entities with occurrences (R6), for natural events with yearly variation
  (larch peak, foliage peak by sub-region).
- Climate per area per month in the area guide: `climate[month] = {high_c, low_c, precip_mm, wet_days,
  daylight_h, notes}`.
- Crowd patterns: `attrs.crowds` on entities; holiday calendars as `calendar_window` reference rows.

## 3. Required fields

For an area: climate by month (12 rows), daylight range by month (computed), main seasonal peaks with
their typical windows and variability, holiday calendars that affect it.

For a viewpoint or photo subject: `point`, `attrs.viewpoint_bearing`, light windows computed for the
months the area is visited.

## 4. Optional fields

`astronomical_darkness` windows (aurora, stars), `moon` (for dark-sky trips), `fog_inversion`
tendencies, `wind` (ferries, ridges), `water_temp_c` by month, `allergy` seasons, `insects` (blackfly
season in Ontario, midges in Scotland), `wildfire_smoke` risk months.

## 5. Sources and methods, in order

- **Sun, twilight, darkness: `core/src/sun` only** (`node core/bin/sun.ts --lat .. --lon .. --zone ..
  --date ..`). Longitude is positive east; never hand-copy the formula, never take times from memory
  (research/audits/sun-audit-2026-10-18.md: a sign error shifted four legacy scripts by 8 minutes per degree).
- Horizon-aware light (when a valley loses the sun): sun position from core/src/sun plus a DEM horizon
  profile; label as computed.
- Climate: national meteorological services (Environment Canada, NOAA, MeteoSwiss, met.no, Vedur.is)
  normals.
- Seasonal peaks: official park and tourism "colour reports", long-running local trackers, dated
  community observations for several years to estimate variability.
- Holidays: official government calendars; school boards for the household's own calendar.

## 6. Evidence rules

Peaks are ranges with variability and their years of evidence ("larch peak about 20-30 Sept, 7-10 day
window, non-official sources" stays `community`). Computed light is `agent_inferred` with the method in
the quote.

## 7. Leave empty

Peak dates for a future year as facts; "golden hour" advice without computation; climate figures without
the station and period.

## 8. Freshness

Climate normals 10 years; peaks 365 days (update with each season's observation); holidays per year;
light computations never stale (recomputed on demand for new dates).

## 9. Traps

Early colour years (2026: Algonquin peaked about 27 Sep, Lake of Bays lagged); no astronomical darkness
in Iceland before about 3 Sep; back-lit viewpoints until early afternoon; peaks that differ by elevation
and aspect; daylight saving changes inside a trip.

## 10. Example changeset (abridged)

```json
{ "changes": [ { "op": "update", "target_kind": "entity", "target_id": "ent_echo_rock", "base_version": 2,
  "patch": { "attrs": { "viewpoint_bearing": 250,
    "light": [ { "subject": "lake and cliffs", "best": "afternoon", "until_hhmm": null, "from_hhmm": "13:30", "months": [9,10], "note": "back-lit before about 13:30" } ] } },
  "evidence": [ { "field": "attrs.light", "value": "...", "source": { "url": "core/src/sun", "kind": "agent" }, "observed_on": "2026-10-17", "quote": "computed: sun azimuth passes 250 deg at about 13:30 local on 10 Oct", "confidence": "agent_inferred" } ] } ] }
```
