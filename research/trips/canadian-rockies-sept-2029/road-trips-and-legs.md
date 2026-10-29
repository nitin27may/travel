# Canadian Rockies: road trips and legs

Read 28 Oct 2026. Lane contract: research/method/lanes/road-trips-and-legs.md. Run note: research/runs/s2d-leg-2026-10-28-stored-legs.md
(the full leg table with points and sources). Data: `data/schedules/canadian-rockies-2029.json` (day `legs`).

## Stored legs on the published days (S2D-LEG)
- Every consecutive stop pair of every version of the 15 days has a stored leg: 21 rows added, 8 routed (OpenRouteService, 25 Oct
  2026), 2 from the plan's own minutes, 11 from the calibrated drive model (≈). [source: OpenRouteService via research/runs/DATA-D9R/ors-legs-2026-10-25.json and data/schedules/legs/canadian-rockies-2029.json, read 2026-10-25; core/src/drive calibration, read 2026-10-28]
- Bourgeau Lake trailhead to Lake Louise: 35 min, 44.2 km by road. [source: OpenRouteService matrix, read 2026-10-25]
- Emerald Lake to Lake Louise: 35 min, 36.6 km. [source: OpenRouteService matrix, read 2026-10-25]
- Lake Louise to the Ha Ling trailhead: 80 min, 89.3 km; Ha Ling trailhead to Kananaskis Village: 60 min, 63.2 km, back through Canmore
  (not over the Spray Lakes road). [source: OpenRouteService matrix, read 2026-10-25]
- Wilcox Pass to Jasper: about 95 min (model, ≈; ORS from the Icefield Centre 3.4 km away: 93 min, 103.6 km). Parker Ridge to Lake
  Louise: about 110 min (model, ≈; likely 10 to 15 min high against ORS from the Icefield Centre, 104 min).
- Moose Lake Loop to Pyramid Lake goes through Jasper: about 70 min (the plan's 60 to Jasper plus 10 to Pyramid Lake).
- GAP: the 11 model legs and 2 plan legs are not routed; the offline ORS key was not available to this run. One ORS matrix request over
  the points in the run note's table closes them.

## Road classes of the map's unrouted pairs (DG-12)
- Highway 40 over Highwood Pass (Ptarmigan Cirque to Wedge Pond): a road with a seasonal gate, closed to motor vehicles 1 Dec to 14 Jun
  (OSM `access:conditional = no @ Dec 01-Jun 14` on ways 119123750 and 385652955); open in September. Routing engines that read the
  conditional tag without a date send the pair the long way round. [source: OpenStreetMap via Overpass, read 2026-10-29]
- GAP: the closure dates are not on the current Alberta Parks trail reports (Peter Lougheed and Sheep and Highwood pages, both updated
  25 Oct 2026); the Wikipedia article says 1 Dec to 14 Jun. An official current page is still to find.
- Spirit Island (Maligne Lake): reached by the operator's cruise, a boat pair. The operator lists the cruise as closed for the 2026
  season and open 28 May to 10 Oct 2027. [source: Pursuit, https://www.banffjaspercollection.com/attractions/maligne-lake-cruise/, read 2026-10-28]
- Mount Robson Visitor Centre viewpoint: the stop's point (53.11056, -119.15667) is the summit of Mount Robson, not the visitor centre
  on Highway 16, so the pair has no road. A point fix for S2D-PTS.
- Miette Hot Springs: Miette Road is a public paved road with no access restriction in OSM (ways 31177099, 31181460, 232706570,
  1302534759); ORS failed on 25 Oct for a graph reason, not for want of a road. [source: OpenStreetMap via Overpass, read 2026-10-29]

## Day timing (S2D-TIME)
- Day 2, Version B (family): 07:40 to 18:05 away from Banff, over the 10 h family line, and the drive back from Lake Minnewanka to the
  Sunshine car park for the 15:30 rejoin is not drawn (about 35 min). Owner decision in the run note.
- Day 4, Version A (adults alone): the 12:30 start at Wilcox Pass is the split day's time; alone, the adults wait about 3 h 20 at the
  trailhead. A builder fix (split-day start time), not data.

## Sources
- OpenRouteService (directions and matrix, driving-car and foot-hiking): research/runs/DATA-D9R/ors-legs-2026-10-25.json,
  data/schedules/legs/canadian-rockies-2029.json (read 2026-10-25)
- OpenStreetMap contributors, via https://overpass-api.de/api/interpreter (read 2026-10-29)
- Pursuit, Maligne Lake Cruise: https://www.banffjaspercollection.com/attractions/maligne-lake-cruise/ (read 2026-10-28)
- Alberta Parks trail reports: https://albertaparks.ca/parks/kananaskis/peter-lougheed-pp/information-facilities/trail-report and
  https://www.albertaparks.ca/parks/kananaskis/kananaskis-country/advisories-and-public-safety/trail-reports/sheep-and-highwood/ (read 2026-10-28)
- Wikipedia, Highwood Pass: https://en.wikipedia.org/wiki/Highwood_Pass (search result, 2026-10-28; secondary)
