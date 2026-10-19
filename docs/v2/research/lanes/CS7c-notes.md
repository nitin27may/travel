# CS7 batch 3: research levels, re-reads, Plan B, tracks and facets

Read on 19 Oct 2026 by travel-researcher (Opus). Page reads were one page at a time by the lead and five read-only helpers. All
Overpass calls ran one at a time under `/tmp/travel-overpass.lock` (run record `data/capture/runs/api-2026-10-19-cs7c-overpass.json`:
94 requests, 52 answered, 42 retried after 502/504 or a timeout, no 429). No Wikidata, Nominatim or Commons call was made. Every
point is "agent checked, needs a person's check".

## 3.53 Research levels

Measured with the public adapter (`createPublicData`, every place page's `completeness`), before and after this lane:

| | Basics only | Early research | Partly checked | Checked |
|---|---|---|---|---|
| All 209 places, before | 103 | 106 | 0 | 0 |
| All 209 places, after | 101 | 105 | 3 | 0 |
| 87 trip stops, before | 3 | 84 | 0 | 0 |
| 87 trip stops, after | 1 | 83 | 3 | 0 |

What blocks `usable` on the trip stops (missing R checks, count of stops):

| Check | Before | After | Why it is left |
|---|---|---|---|
| geometry (routes) | 75 | 75 | **code**: `geometry` has no `home` in `core/src/schema/capture/properties.ts` and no case in `readProperty`, so no route can pass it whatever the data; it should read `data/tracks/<place>.json` (confirmed or not) |
| access_points / starts_at (routes) | 69 | 69 | needs a trailhead or parking record per route; not reached in this batch (pointless while geometry blocks every route) |
| area_id | 84 | 62 | the area vocabulary (the household store's 53 areas) has no South Tyrol, Yoho, Jasper, Kootenay, Kananaskis, Mount Robson, Wayne or Garfield County, Patagonia, Iceland or Chamonix area |
| links (official) | 84 | 0 | done: 69 filled, 15 searched_none |
| summary and the other relevance checks | 32 | 34 | 32 routes have no relevance record (the two new hut records add two) |

The six non-route stops that now miss only `area_id` (Lago di Braies, Lago di Landro, Ötzi, Passo Gardena, La Val, plus Santa Maddalena
with access points) would read Partly checked once the vocabulary has a Province of Bolzano area. Lago d'Antorno, Lago di Limides and
Lake Louise now read Partly checked.

`capture.ts gaps` counts R properties per record; the official links alone answer one R per stop on all eight trips.

## 3.49 Ötzi

From iceman.it (operator): single 13 EUR, under 6 free, reduced 10, family 26 (2 adults) and 13 (1 adult), audio guide 4; Tuesday to
Sunday 10:00-18:00, last entry 17:30, Mondays closed except holidays and in July and August; closed on three holidays; all year;
skip-the-line booking optional for today and the next six days. The fee table states no year.

## 3.50 Re-reads

All nine "(search result, not opened)" sources load. Confirmed: babytrekking (Sorapis stroller, Federa carrier, stroller, difficile,
350 m, 4 km, about 2 h 15), Swiss Family Fun (Vallunga all-terrain stroller), disabili.com (Misurina partial wheelchair), ecnews
(Federa 4 km), l'Adige (Passo Gardena 150-vehicle cap with booking), linexo (Drava asphalt). Contradicted:

- planetmountain "Lago di Limides" is a winter snowshoe route (220 m, 3.5-4 h). The official cortina.dolomiti.org page (easy, 2.2 km,
  +132 m, about 1 h, lake after 45 min, from Rifugio Col Gallina) supports the stored values and is now a source of them.
- l'Adige dates the Passo Gardena trial to autumn 2026, not "from 2027" as the access season note says. No Province page found; the
  pre-migration note stays until a supersede entry (9.7) or a person corrects it.
- The Drava path's "side roads with cars and tractors" and `traffic: crossings` are on no page read; suedtirol.info says "almost always
  away from the road". Unverified.

The 18 "written from memory" pages are household-store rows (`data/locations/locations.json` notes), which this lane may not edit; the
site already marks them unverified. They are idea places, none a trip stop.

AllTrails-only legacy facts, re-sourced (for whoever edits the prototype source; the snapshot is not this lane's):

| Legacy fact | Official or operator value | Source |
|---|---|---|
| Braies "17,000 visitors on peak summer days" | over 17,400 a day at peaks in summer 2018, before the access rule | Province press office, 16 Nov 2020 |
| Federa parking "small and often full" | "piccolissimo, gratuito" (community); "often full" not found | babytrekking; operator question added |
| Federa trailhead | Ponte de Rucurto, 1,708 m, on the Passo Giau road | cortina.dolomiti.org |
| Federa shuttle | the jeep runs to the hut from Cortina, not to Ru Curto | babytrekking (community) |
| Cinque Torri chairlift | 2026 season early June to mid October, 09:00-17:00 | 5torri.it |
| Fanes via ferrata "not for small children" | the tourist office calls it suitable "from beginners to families", kit essential | cortina.dolomiti.org (conflict) |
| Nuvolau hut 2,575 m | confirmed; 2027 planned season late June to late September | rifugionuvolau.it |
| Seceda top station 2,457 m | 2,518 m | seceda.it |
| Seceda parking about 30 EUR | 2.50 EUR per 30 min, 30 EUR a day cap | valgardena.it |
| Seceda lifts late May to early November | confirmed for 2026 | seceda.it |
| Forcella Pana "often blocked by rockfall" | currently closed | valgardena.it |

## 3.45 Plan B

Sentinel Pass now has its own suitability record with the Moraine Lake access season (shuttle, `official_rule`, "Moraine Lake Road is
closed to personal vehicles year-round"), so derive treats it as shuttle-only. Plain of Six Glaciers' Plan B moved from Sentinel Pass to
the Iceline trail (Yoho, 18 km, road access).

Tre Cime: Alpe di Siusi (52 km, lift-only plateau) is a poor match and Adolf Munkel (41 km) carries a toll-reservation cost too, so
derive cannot pick it either. **Proposal: Monte Piana.** It starts at Lago d'Antorno, whose car park (OSM way 234899048) is about 1 km
before the toll booth (OSM node 277726434), so it needs no toll slot; it faces the Tre Cime from the south-west across 4.6 km; the
tourism board gives 3.9 km and 368 m one way (dreizinnen.com tour 22272); it is a Great War open-air museum, so it has its own story.
Its relevance class is `sight/heritage-site`, which is right for it, so the fix is not a reclass: derive should honour a hand-picked
`plan_b` on the relevance record (`{ref, reason, src}`), the way it honours `pairs_with`. Val Fiscalina (to the Locatelli north face
without the toll) is the alternative for strong walkers.

## 3.47 Tracks

| Route | Finding (OSM, read 19 Oct 2026) | Stored |
|---|---|---|
| Nuvolau | 452 meets 443 at Passo Giau and 464 under Forcella Nuvolau; 443 meets 439 by Scoiattoli; 439 runs Cinque Torri, Averau, the hut. 439 and 464 are 185 m apart near Forcella Nuvolau (46.4995, 12.0428), joined only by untagged ways 39426697 and 1013608145 | destination Rifugio Nuvolau (way 200226208) in `inputs.json`; a person must confirm the connector |
| Pordoi | 627 ends at Rifugio Boè; 638 (relation 9491502) continues to the Piz Boè summit hut (8 m) | 638 added to the capture osm links; destination way 42223145 |
| Federa | Lago Fedèra (way 26430242, Q3825692) is 88 m from path 434 (relation 3170181) and 1.5 km from 437 | 434 added to the walk's osm links |
| Fiscalina | Talschlusshütte (way 96096595) is 28 m from relation 1116674 | destination |
| Vallunga | the line reaches about 1,805 m at Pra da Ri; Crist de Pra da Ri (node 6582175776) | destination (the landmark is our inference from the official 1,817 m high point) |
| Cinque Torri | the walk is at the lift top (Scoiattoli, 101 m from 439) | needs a start-point override in the fetcher (code) |
| Fanes | the walk starts at Pian de Loa, not the Sant'Uberto pin | needs a start-point override (code) |

`node web/scripts/tracks-osm.mjs --check` reports the Pordoi and Federa osm lists as changed until the track lane refetches.

## 3.25 Facets

Dogs on 38 trail records (leash): the Parks Canada leash law with Banff's "allowed on all trails unless specified" and Jasper's per-trail
table (none of the trip trails is on Jasper's 2026 dog-ban list; Bald Hills is, and is off-plan for this field), Yoho and Kootenay, Alberta
Parks (2 m leash; no Kananaskis page bans dogs on Ptarmigan Cirque), BC Parks, the South Tyrol nature-park decree, the Ampezzo park.
Not applied where a trail straddles a park edge (Tre Cime loop, Monte Piana) or where the park's reach was not confirmed (Sorapis, Federa,
Cinque Torri). Toilets: Lake Minnewanka. Culture: Cave and Basin (hours, season, 10 CAD, 2-3 h), Glacier Skywalk and Ice Explorer (season,
hours, duration). Best time: Bow Lake, Lake Louise, Lago d'Antorno, Lago di Braies. No official page states swimming for any Rockies lake;
Braies asks visitors to "avoid swimming", which the `swimming` enum cannot hold (no `discouraged`; schema question). No official page
states railings at any trip viewpoint.

## 9. Rockies base points (nothing moved)

| Base | Schedule point | Nearest OSM place | Distance | Finding |
|---|---|---|---|---|
| Banff | 51.1784, -115.5708 | node 29546626 Banff (town, Q58337) | 380 m | right (downtown) |
| Lake Louise | 51.4254, -116.1773 | node 2665400241 Lake Louise (hamlet, Q12826048) | 51 m | right. The relevance town point (51.41167, -116.22806) is the lake, 3.8 km west: its QID is the lake's, not the hamlet's |
| Jasper | 52.8737, -118.0814 | node 51971014 Jasper (town, Q999429) | 184 m | right |
| Kananaskis Village | 50.936, -115.145 | node 283707361 Kananaskis Village (town) | 2.07 km | the schedule point is north of the village, near the Nakiska side; OSM and Q6360620 (50.91748, -115.1474) agree on the village. Recommend the OSM node |
| Calgary airport | 51.1139, -114.0203 | way 234496840 Calgary International Airport (Q1160343) | 1.1 km to the centroid | fine for an airport |

## Code changes needed (for builders)

1. `geometry`: give it a home (the track file) and a `readProperty` case; today every route is draft by construction.
2. The adapter skips offer-layer records when it joins a place page to its capture record, so a page whose only record is an offer
   (Funbob) never gets the capture model.
3. Track fetcher: a start-point override in `inputs.json` (Cinque Torri, Fanes).
4. Derive: a hand-picked `plan_b` on the relevance record (Tre Cime to Monte Piana).
5. The supersede override (capture contract 9.7).
6. Area vocabulary for the public trips (Bolzano first: six stops wait on it); the id `IT/trentino-alto-adige/belluno` names a Veneto
   province under the wrong region.
7. `ext.water.swimming` has no value for "discouraged".
