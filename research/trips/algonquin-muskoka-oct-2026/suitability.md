# Suitability and relevance pass, Algonquin and Muskoka (lane R6)

Researched 18 Oct 2026 by travel-researcher. Files:
- `data/suitability/algonquin-muskoka-2026/R6.json` (6 records)
- `data/relevance/algonquin-muskoka-2026/R6.json` (6 records)

All dates are the 2026 pattern (`applies_to: 2026`).

## What was checked

| Source | Used for |
|---|---|
| algonquinpark.on.ca Track and Tower page (opened) | 7.5 km loop, "Difficult", km 25.0, parking and toilets, fall-danger icon at the lookout, permit required |
| algonquinpark.on.ca day-use fees (opened) | $21 per vehicle, 07:00-22:00, online or phone only, up to 5 days ahead, up to 14 people |
| ontarioparks.ca Oxtongue River-Ragged Falls (opened) | day use 8 May - 18 Oct 2026, vault privies, all-terrain wheelchairs not available |
| discovermuskoka.ca Ragged Falls listing (opened) | "only 1 km", gravel access road, lookout |
| algonquinhighlands.ca Dorset Scenic Lookout Tower (opened) | 30 m tower, 142 m above the lake, hours, booking 19 Sep - 25 Oct, fees, dogs not on the tower, restrooms |
| limberlostforest.com Hiking Trails (opened) | Solitaire 6.3 km "Easy to moderate", 09:00-17:00, waiver, outhouses, leashed dogs |
| Wikidata (search, then coordinates checked) | QIDs below |

## Findings

1. **No hard age, height or weight rule applies to any record.** None of the land managers publishes one.
2. **The Algonquin permit is the gate**, not an age: online or phone only, up to 5 days ahead, valid 07:00-22:00.
3. **The Track and Tower lookout carries the park's fall-danger symbol**; trip reports describe the ledge as unfenced.
4. **No published climb figure** for Solitaire or Track and Tower; only route platforms give one, and they disagree (Solitaire 48 m against 284 m). Both are `searched_none`.

## Open conflicts

| Record | Field | Conflict |
|---|---|---|
| Track and Tower | `effort.source_grade` | "Difficult" on the park's trail page against "Moderate" on the Ontario Parks activities index (trip research; not re-read) |
| Solitaire | distance | 6.3 km now against 13 km in the 2015 brochure (stale; the current page wins) |
| Track and Tower | time | park index "4 hours" (trip research) against 2 h 15 - 2 h 45 in trip reports; the record holds our Naismith range 150-240 min |

## Applicability questions

- **Dwight Beach sunset** is mapped as a `viewpoint`. In summer it would be a `beach` (lifeguard, entry, water temperature). For an October sunset visit the viewpoint profile fits; a second record would be needed for swimming.
- **Ragged Falls** is a `waterfall`; `water_safety.current_or_tide` is A and would matter (fast water beside the lookouts), but no source states it.
- **Solitaire Lake** sits on a private reserve with a compulsory waiver. The `hike` profile has no field for a waiver unless `operated`; the waiver is in `access_season.note`.

## Operator questions (for the owner to send, Q14)

| To | Contact | Question |
|---|---|---|
| Algonquin Park Information | 705-633-5572, info@algonquinpark.on.ca | What is the official climb of Track and Tower, and is the Cache Lake ledge fenced? Is the trail graded Difficult or Moderate? |
| Oxtongue River-Ragged Falls Provincial Park | 705-789-5105 | Day-use fee; trail surface to the lookouts; are the lookouts railed; is the trail pushchair or wheelchair usable? |
| Township of Algonquin Highlands (Dorset tower) | 705-766-1032 | Distance from the car park to the tower; is the base step-free; any age rule for the climb? |
| Limberlost Forest and Wildlife Reserve | 705-635-1584, info@limberlostforest.com | Climb of the Solitaire loop; is Echo Rock railed; any closed season? |
| Township of Lake of Bays | township office | Is Dwight Beach maintained in October; washrooms and step-free access? |

## Records and levels

| Record | Profile | Level | Notes |
|---|---|---|---|
| Ragged Falls | waterfall | Usable | wheelchair `searched_none` |
| Huntsville | town | Usable | wheelchair `searched_none` |
| Solitaire Lake Trail | hike | Usable | gain, navigation, group rule `searched_none` |
| Track and Tower Trail | hike | Usable | gain, navigation, group rule `searched_none` |
| Dorset lookout tower | viewpoint | Usable | wheelchair and walk_m `searched_none` |
| Dwight Beach sunset | viewpoint | Usable | wheelchair, access season, walk_m `searched_none` |

6 of 6 Usable, 0 Complete.

## Relevance

| Record | QID | Draw | Standing | Distinction | Class | draw_suggested |
|---|---|---|---|---|---|---|
| Ragged Falls | Q1669132 (not the New Brunswick falls) | regional | top | rare | waterfall/roadside | local (no signals fetched) |
| Huntsville | Q1024091 | regional | good | common | town/lakeside | local |
| Solitaire Lake Trail | Q22650927 (the lake) | local | good | common | trail/lookout | local |
| Track and Tower Trail | searched_none; parent Algonquin Q1543478 | regional, peak national 20 Sep - 15 Oct | top | rare | trail/lookout | local |
| Dorset lookout tower | searched_none | regional | top | rare | viewpoint/summit-panorama | local |
| Dwight Beach sunset | searched_none | local | good | common | lake/swim-beach | local |

Designations: Algonquin Provincial Park and Oxtongue River-Ragged Falls Provincial Park, both `scope: parent`. The Track and Tower `draw_peak` needs a trip window in `inputs/points.json` before derive uses it.

## Correction pass RC (18 Oct 2026)

- **rebase-basis.** The Solitaire Lake toilets moved from `operator_rule` to `operator_info`. The dog leash rule stays a rule.
