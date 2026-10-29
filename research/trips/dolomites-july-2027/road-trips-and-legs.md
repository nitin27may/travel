# Dolomites: road trips and legs

Read 28 Oct 2026. Lane contract: research/method/lanes/road-trips-and-legs.md. Run note: research/runs/s2d-leg-2026-10-28-stored-legs.md.

## Stored legs on the published days (S2D-LEG)
- Every consecutive stop pair of every version of the 14 days already has a routed leg (40 legs, OpenRouteService, fetched 23 Oct
  2026); none falls to a fallback. The only unrouted rows on the day view are the car park walk-ins, a scheduler rule. [source:
  data/schedules/legs/dolomites-2027.json, read 2026-10-23; checked by web/tests/trips/stored-legs.test.ts]

## Day timing (S2D-TIME)
- Day 2: the plan does Lago di Braies at first light and Val Fiscalina at 14:00, with the middle of the day at San Candido (16 min from
  Fiscalina by road). The day view drives Braies to Fiscalina at 07:45 and shows about 5 h of free time there, because the timeline draws
  a way back to the base only before an evening stop (17:00 or later). The plan time is not wrong; the base split question (3 or 2
  bases) does not change this day, San Candido is its base either way. Owner decision in the run note.

## Sources
- OpenRouteService via data/schedules/legs/dolomites-2027.json (read 2026-10-23)
