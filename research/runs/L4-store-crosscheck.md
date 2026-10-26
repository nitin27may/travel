# L4: cross-check of the stored places against their sources (26 Oct 2026)

Branch `public/L4` (worktree `v2-L4`, from `main` 54404107). Model: Sonnet (Claude Sonnet 5.5), role verifier. Run record:
`data/capture/runs/l4-2026-10-26-store-crosscheck.json` (`capture.ts run --check`: OK). Sampler, sample and verdicts:
`research/runs/L4-store-crosscheck/` (`sampler.py`, `sample.json`, `verdicts.py`, `verdicts.json`). No store, capture, sidecar or point
value was changed (see "Changes made").

## What "the 74 stored places" are

`data/locations/locations.json` now holds 150 places; 76 were added on 26 Oct by other lanes. The 74 of DATA-PLAN section 2 are the places
with `added` before 2026-10-26 (63 on 16 Oct, 9 on 19 Oct, 1 on 17 Oct, 1 on 18 Oct). Their capture records are the `catalogue` lane
(`BA-ca`, `BA-int`, `BA-it`, `BA-us`) joined by the slug of `place/<slug>` or by the Wikidata link; 8 of the 74 are tied to a trip.

## Sampling rule (written before any source was read)

1. Seed `20261026`. Ten values per place family, six families: settlement (city, town), region (region, island), park, high (mountain,
   viewpoint, lighthouse), water (lake, waterfall, canyon, valley), route (trail, activity, drive, place). 60 values.
2. Candidate values per place, with weight: point (lat and lon, one value) 3; elevation_m 2; season_months 2; Wikidata QID 1; each store
   source that has a URL 2; each catalogue link with a URL other than Wikidata and OSM 2; each filled catalogue price, hours, window,
   season, best_time or best_window 2.
3. Weighted draw without replacement (Efraimidis and Spirakis keys, `-ln(u)/w`, `u` from `sha256(seed|family|place|field|detail)`), so the
   draw does not depend on iteration order; at most two values per place. Rerun: `python3 research/runs/L4-store-crosscheck/sampler.py`
   gives the same 60.
4. Verdicts: confirmed (the cited or an official source states it or the check reproduces it), changed (new value with source), unreachable
   (source did not load), cannot verify (no source states it). A confirmed link means it resolved and is the thing it is cited as.

Note on the draw: the weights favour the fields the owner asked for, but the store holds few fees, hours or windows (13 prices, 7
windows, 5 hours across the lane), so those appear 4 times in 60 (Havasu and Monument Valley prices, Manitou window, Pic Champlain best time).

## Counts

| Measure | Value |
|---|---|
| Values checked | 60 on 43 places |
| Confirmed | 56 (93.3%) |
| Changed | 0 |
| Source unreachable | 1 (1.7%), `sepaq.com/pq/bon` answered 403 |
| Cannot verify | 3 (5.0%), all `season_months` |
| Independent of the store's own source class | 21 of the 56 confirmations read an official, operator or tourism page; 35 re-read Wikidata, Wikipedia or 3DEP, the class the value was copied from, so they prove the copy, not the fact |

By family:

| Family | Checked | Confirmed | Changed | Unreachable | Cannot verify |
|---|---|---|---|---|---|
| settlement | 10 | 10 | 0 | 0 | 0 |
| region | 10 | 8 | 0 | 1 | 1 |
| park | 10 | 10 | 0 | 0 | 0 |
| high | 10 | 10 | 0 | 0 | 0 |
| water | 10 | 10 | 0 | 0 | 0 |
| route | 10 | 8 | 0 | 0 | 2 |

By field (registry name in the run record in brackets):

| Field | Checked | Confirmed | Unreachable | Cannot verify |
|---|---|---|---|---|
| point | 9 | 9 | 0 | 0 |
| elevation_m (altitude_m) | 6 | 6 | 0 | 0 |
| season_months (season) | 11 | 8 | 0 | 3 |
| wikidata | 5 | 5 | 0 | 0 |
| store source URL (a value's cited source; the value is an elevation or a point) | 8 | 8 | 0 | 0 |
| catalogue link | 17 | 16 | 1 | 0 |
| catalogue price | 2 | 2 | 0 | 0 |
| catalogue window | 1 | 1 | 0 | 0 |
| catalogue best_time | 1 | 1 | 0 | 0 |

Per place (43 places sampled; the other 31 of the 74 were not drawn):

| Place | Checked | Confirmed | Changed | Unreachable | Cannot verify | Fields |
|---|---|---|---|---|---|---|
| CA/.../la-crete | 1 | 0 | 0 | 0 | 1 | season_months |
| CA/.../montmorency-falls | 1 | 1 | 0 | 0 | 0 | season_months |
| CA/.../montagne-de-marbre | 1 | 1 | 0 | 0 | 0 | store_source_url |
| CA/.../cap-bon-ami | 2 | 2 | 0 | 0 | 0 | capture_link, point |
| CA/.../cap-gaspe | 1 | 1 | 0 | 0 | 0 | point |
| CA/.../mont-saint-alban | 1 | 1 | 0 | 0 | 0 | season_months |
| CA/.../sentier-la-chute | 2 | 2 | 0 | 0 | 0 | store_source_url, season_months |
| CA/.../mont-saint-pierre | 1 | 1 | 0 | 0 | 0 | capture_link |
| CA/.../mont-xalibu | 1 | 1 | 0 | 0 | 0 | wikidata |
| CA/.../pic-champlain | 2 | 2 | 0 | 0 | 0 | capture_best_time, capture_link |
| CA/.../bonaventure-island | 1 | 0 | 0 | 1 | 0 | capture_link |
| CA/.../canyon-des-portes-de-l-enfer | 2 | 2 | 0 | 0 | 0 | capture_link, season_months |
| CA/.../mont-du-dome | 1 | 0 | 0 | 0 | 1 | season_months |
| FR/.../provence | 1 | 1 | 0 | 0 | 0 | wikidata |
| IN/.../gurudongmar-lake | 1 | 1 | 0 | 0 | 0 | capture_link |
| IT/.../amalfi-coast | 1 | 1 | 0 | 0 | 0 | capture_link |
| IT/.../capri | 1 | 0 | 0 | 0 | 1 | season_months |
| IT/.../trento | 2 | 2 | 0 | 0 | 0 | capture_link, wikidata |
| IT/.../florence | 1 | 1 | 0 | 0 | 0 | capture_link |
| IT/.../dolomites | 1 | 1 | 0 | 0 | 0 | point |
| IT/.../verona | 1 | 1 | 0 | 0 | 0 | capture_link |
| US/.../kennecott | 2 | 2 | 0 | 0 | 0 | elevation_m, store_source_url |
| US/.../havasu-falls | 1 | 1 | 0 | 0 | 0 | capture_price |
| US/.../monument-valley | 1 | 1 | 0 | 0 | 0 | capture_price |
| US/.../manitou-incline | 2 | 2 | 0 | 0 | 0 | capture_window, season_months |
| US/.../ouray | 1 | 1 | 0 | 0 | 0 | point |
| US/.../cape-cod | 2 | 2 | 0 | 0 | 0 | season_months, point |
| US/.../finger-lakes | 2 | 2 | 0 | 0 | 0 | season_months, wikidata |
| US/.../arches-national-park | 1 | 1 | 0 | 0 | 0 | point |
| US/.../stansbury-island | 1 | 1 | 0 | 0 | 0 | season_months |
| US/.../kanarra-falls | 1 | 1 | 0 | 0 | 0 | capture_link |
| US/.../bryce-canyon-national-park | 2 | 2 | 0 | 0 | 0 | elevation_m, wikidata |
| US/.../canyonlands-national-park | 1 | 1 | 0 | 0 | 0 | elevation_m |
| US/.../lake-wenatchee | 1 | 1 | 0 | 0 | 0 | store_source_url |
| US/.../leavenworth | 2 | 2 | 0 | 0 | 0 | point, store_source_url |
| US/.../olympic-peninsula | 1 | 1 | 0 | 0 | 0 | capture_link |
| US/.../baker-snoqualmie-national-forest | 2 | 2 | 0 | 0 | 0 | capture_link, point |
| US/.../lake-chelan | 2 | 2 | 0 | 0 | 0 | elevation_m, capture_link |
| US/.../mount-baker-wilderness | 2 | 2 | 0 | 0 | 0 | point, capture_link |
| US/.../mount-st-helens | 2 | 2 | 0 | 0 | 0 | capture_link, store_source_url |
| US/.../grand-teton-national-park | 2 | 2 | 0 | 0 | 0 | store_source_url, elevation_m |
| VN/.../sa-pa | 2 | 2 | 0 | 0 | 0 | store_source_url, elevation_m |
| VN/.../ha-long-bay | 1 | 1 | 0 | 0 | 0 | capture_link |

## Every value checked

Read date for every row: 2026-10-26. `API(Q)` stands for `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q&props=labels|claims`
(one batch request of 19 ids, then one of 2, under `/tmp/travel-wikidata.lock`). 3DEP is the USGS Elevation Point Query Service
(`epqs.nationalmap.gov/v1/json`), one request every 2 s. Overpass, Nominatim and Commons were not used. User-Agent for every request I
sent by script or curl: `travel-capture/1.0 (+https://nks-travel.pages.dev/about/)`; WebFetch and WebSearch use their own.

| # | Family | Place | Field | Stored | Verdict | Source URL | Note |
|---|---|---|---|---|---|---|---|
| 1 | high | pic-champlain | capture_best_time | capture_best_time | confirmed | https://baliseqc.ca/upload/fiches-pret-a-partir/PaP_RE06_ParcNationalBic_Murailles_1j.pdf | PDF text: 'Les couchers de soleil sont splendides!' (read with pdftotext) |
| 2 | high | cap-bon-ami | capture_link | https://parks.canada.ca/pn-np/qc/forillon/visit/tarifs-fees | confirmed | https://parks.canada.ca/pn-np/qc/forillon/visit/tarifs-fees | page is the Forillon fees page (adult $10 peak, $7.25 shoulder, 2026); it does not name Cap-Bon-Ami |
| 3 | high | mount-st-helens | capture_link | https://en.wikipedia.org/wiki/Mount_St._Helens | confirmed | https://en.wikipedia.org/api/rest_v1/page/summary/Mount_St._Helens | page resolves; wikibase_item Q4675 equals the store QID |
| 4 | high | pic-champlain | capture_link | https://baliseqc.ca/upload/fiches-pret-a-partir/PaP_RE06_ParcNationalB | confirmed | https://baliseqc.ca/upload/fiches-pret-a-partir/PaP_RE06_ParcNationalBic_Murailles_1j.pdf | PDF resolves (200); it is the Les Murailles sheet to Pic Champlain |
| 5 | high | cap-gaspe | point | 48.75,-64.17 | confirmed | https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q112854948&props=labels|claims | P625 48.75,-64.17 equals the store; the item is a hamlet in Gaspe, not the lookout (see finding F4) |
| 6 | high | mont-saint-alban | season_months | [5, 6, 7, 8, 9, 10] | confirmed | https://parks.canada.ca/pn-np/qc/forillon/visit/tarifs-fees | 2026 admission and seasonal pass run 30 May to 13 Oct, so months 5 to 10 hold; no page states a month list |
| 7 | high | cap-bon-ami | point | 48.81389,-64.22222 | confirmed | https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q112836599&props=labels|claims | P625 48.81389,-64.22222 equals the store; the item is an administrative sector (F4) |
| 8 | high | mont-xalibu | wikidata | Q26999326 | confirmed | https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q26999326&props=labels|claims | Q26999326 is 'Mont Xalibu', mountain, 1120 m, same point |
| 9 | high | mount-st-helens | store_source_url | https://www.wikidata.org/wiki/Q4675 | confirmed | https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q4675&props=labels|claims | P2044 +2549 m equals the store elevation |
| 10 | high | dolomites | point | 46.61306,12.16306 | confirmed | https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q1283&props=labels|claims | P625 46.613056,12.163056 equals the store (rounded) |
| 11 | park | mount-baker-wilderness | point | 48.8081,-121.743 | confirmed | https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q3326014&props=labels|claims | P625 48.8081,-121.743 equals the store |
| 12 | park | grand-teton-national-park | store_source_url | https://epqs.nationalmap.gov/v1/json | confirmed | https://epqs.nationalmap.gov/v1/json?x=-110.70083&y=43.83333&wkid=4326&units=Meters | 3DEP value 2104.71 m, store 2105 (computed at the stored point, F3) |
| 13 | park | arches-national-park | point | 38.72806,-109.54 | confirmed | https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q223969&props=labels|claims | P625 38.72805556,-109.54 equals the store |
| 14 | park | grand-teton-national-park | elevation_m | 2105 | confirmed | https://epqs.nationalmap.gov/v1/json?x=-110.70083&y=43.83333&wkid=4326&units=Meters | same query as 12; the same stored value, read through the field's own source id |
| 15 | park | mount-baker-wilderness | capture_link | https://en.wikipedia.org/wiki/Mount_Baker_Wilderness | confirmed | https://en.wikipedia.org/api/rest_v1/page/summary/Mount_Baker_Wilderness | page resolves; wikibase_item Q3326014 equals the store QID |
| 16 | park | baker-snoqualmie-national-forest | capture_link | https://www.fs.usda.gov/r06/mbs | confirmed | https://www.fs.usda.gov/r06/mbs | page resolves (200), title 'Mount Baker-Snoqualmie National Forest' |
| 17 | park | baker-snoqualmie-national-forest | point | 47.766,-121.378 | confirmed | https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q3079176&props=labels|claims | P625 47.766,-121.378 equals the store |
| 18 | park | bryce-canyon-national-park | elevation_m | 2406 | confirmed | https://epqs.nationalmap.gov/v1/json?x=-112.17&y=37.64&wkid=4326&units=Meters | 3DEP 2405.59 m, store 2406 (F3) |
| 19 | park | canyonlands-national-park | elevation_m | 1498 | confirmed | https://epqs.nationalmap.gov/v1/json?x=-109.76&y=38.1669&wkid=4326&units=Meters | 3DEP 1498.11 m, store 1498 (F3) |
| 20 | park | bryce-canyon-national-park | wikidata | Q219562 | confirmed | https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q219562&props=labels|claims | Q219562 is Bryce Canyon National Park |
| 21 | region | capri | season_months | [5, 6, 7, 8, 9] | cannot verify |  | no official page states Capri's season; secondary guides give April to October (search 26 Oct); store 5 to 9 is unsourced |
| 22 | region | finger-lakes | season_months | [6, 7, 8, 9, 10] | confirmed | https://www.visitfingerlakes.com/events/annual-events/fall-colors/ | official tourism guide supports the Sep to Oct colour window and summer lake season; no page lists the months June to October as a range |
| 23 | region | cape-cod | season_months | [6, 7, 8] | confirmed | https://www.capecodchamber.org/explore/seasons/ | chamber names summer as peak season, September to early June as shoulder |
| 24 | region | stansbury-island | season_months | [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] | confirmed | https://www.utah.com/things-to-do/outdoor-recreation/mountain-biking/stansbury-island-trail/ | state tourism site: the trail can be ridden year-round (secondary); BLM land is the south end only |
| 25 | region | cape-cod | point | 41.68889,-70.29694 | confirmed | https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q49152&props=labels|claims | first of three P625 values equals the store (41.688889,-70.296944) |
| 26 | region | olympic-peninsula | capture_link | https://en.wikipedia.org/wiki/Olympic_Peninsula | confirmed | https://en.wikipedia.org/api/rest_v1/page/summary/Olympic_Peninsula | page resolves; wikibase_item Q780293 equals the store QID |
| 27 | region | provence | wikidata | Q101081 | confirmed | https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q101081&props=labels|claims | Q101081 is Provence, region and historical province; point 44,6 equals the store |
| 28 | region | finger-lakes | wikidata | Q1416994 | confirmed | https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q1416994&props=labels|claims | Q1416994 is Finger Lakes; P625 equals the store |
| 29 | region | amalfi-coast | capture_link | https://en.wikipedia.org/wiki/Amalfi_Coast | confirmed | https://en.wikipedia.org/api/rest_v1/page/summary/Amalfi_Coast | page resolves; wikibase_item Q212214 equals the store QID |
| 30 | region | bonaventure-island | capture_link | https://www.sepaq.com/pq/bon | unreachable | https://www.sepaq.com/pq/bon | HTTP 403 to curl and WebFetch on 26 Oct; no value checked (the link itself is not shown to be dead) |
| 31 | route | mont-du-dome | season_months | [9, 10] | cannot verify |  | no official season; a Narcity article says the trail is open all year with fall hunting limits; store 9 to 10 is the saved post's foliage window, unsourced |
| 32 | route | kennecott | elevation_m | 624 | confirmed | https://epqs.nationalmap.gov/v1/json?x=-142.889&y=61.4861&wkid=4326&units=Meters | 3DEP 623.86 m, store 624 (F3) |
| 33 | route | sentier-la-chute | store_source_url | https://www.wikidata.org/wiki/Q139862201 | confirmed | https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q139862201&props=labels|claims | P625 48.84296,-64.26511 equals the store |
| 34 | route | la-crete | season_months | [9, 10] | cannot verify |  | no official page found for Sentier La Crete's season (search 26 Oct); store 9 to 10 is a saved-post window, unsourced |
| 35 | route | sentier-la-chute | season_months | [5, 6, 7, 8, 9, 10] | confirmed | https://parks.canada.ca/pn-np/qc/forillon/visit/tarifs-fees | same Forillon season evidence as 6 |
| 36 | route | manitou-incline | capture_window | capture_window | confirmed | https://coloradosprings.gov/manitouincline | 'Reservations for the upcoming month become available on the 1st'; up to 8 weeks; 45 per half hour (stored url coloradosprings.gov/incline redirects here) |
| 37 | route | kennecott | store_source_url | https://epqs.nationalmap.gov/v1/json | confirmed | https://epqs.nationalmap.gov/v1/json?x=-142.889&y=61.4861&wkid=4326&units=Meters | same query as 32 |
| 38 | route | manitou-incline | season_months | [5, 6, 7, 8, 9, 10] | confirmed | https://coloradosprings.gov/manitouincline | summer hours 1 May to 31 Oct match months 5 to 10; the Incline is open Nov to Apr on winter hours, so the stored range is the summer-hours window |
| 39 | route | montagne-de-marbre | store_source_url | https://www.wikidata.org/wiki/Q21428295 | confirmed | https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q21428295&props=labels|claims | P625 45.33417,-71.01278 and P2044 923 m equal the store |
| 40 | route | ha-long-bay | capture_link | https://halongtourism.com.vn/ | confirmed | https://halongtourism.com.vn/ | page resolves (200), title 'Ha Long' |
| 41 | settlement | leavenworth | point | 47.5964,-120.665 | confirmed | https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q1025813&props=labels|claims | P625 47.5964,-120.665 equals the store |
| 42 | settlement | sa-pa | store_source_url | https://www.wikidata.org/wiki/Q1000140 | confirmed | https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q1000140&props=labels|claims | P2044 holds 1500 and 1718 m; the store took 1500 and the note says so |
| 43 | settlement | florence | capture_link | https://www.comune.fi.it/ | confirmed | https://www.comune.firenze.it/ | stored www.comune.fi.it redirects to www.comune.firenze.it (title 'Citta di Firenze'); not changed, the link's source is Wikidata P856 (F5) |
| 44 | settlement | leavenworth | store_source_url | https://www.wikidata.org/wiki/Q1025813 | confirmed | https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q1025813&props=labels|claims | P2044 +357 m (and +1171 ft) equals the store 357 |
| 45 | settlement | mont-saint-pierre | capture_link | https://montsaintpierre.ca/ | confirmed | https://montsaintpierre.ca/ | page resolves (200), municipal site |
| 46 | settlement | verona | capture_link | https://en.wikipedia.org/wiki/Verona | confirmed | https://en.wikipedia.org/api/rest_v1/page/summary/Verona | page resolves; wikibase_item Q2028 equals the store QID |
| 47 | settlement | ouray | point | 38.0233,-107.672 | confirmed | https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q1759444&props=labels|claims | P625 38.0233,-107.672 equals the store |
| 48 | settlement | trento | capture_link | http://www.comune.trento.it/ | confirmed | https://www.comune.trento.it/ | stored http:// URL redirects to https:// (F5) |
| 49 | settlement | sa-pa | elevation_m | 1500 | confirmed | https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q1000140&props=labels|claims | P2044 +1500 m present (1718 m is the recorded alternative) |
| 50 | settlement | trento | wikidata | Q3376 | confirmed | https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q3376&props=labels|claims | Q3376 is Trento, city |
| 51 | water | lake-chelan | elevation_m | 335 | confirmed | https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q1115201&props=labels|claims | P2044 +335 m equals the store |
| 52 | water | kanarra-falls | capture_link | https://kanarrafalls.com/ | confirmed | https://kanarrafalls.com/ | operator site, 'permit system', limit 200 general admission a day; the page states no season |
| 53 | water | canyon-des-portes-de-l-enfer | capture_link | https://www.terfa.ca/fr/terfa/canyon-des-portes-de-l-enfer/ | confirmed | https://www.terfa.ca/fr/terfa/canyon-des-portes-de-l-enfer/ | operator page resolves and is the canyon's page |
| 54 | water | havasu-falls | capture_price | capture_price | confirmed | https://havasupaireservations.com/faqs/ | 'Campground permits are $455 per person for 3 nights.' and children 6 and under need no paid permit |
| 55 | water | lake-wenatchee | store_source_url | https://www.wikidata.org/wiki/Q7172855 | confirmed | https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q7172855&props=labels|claims | P2044 +571 m equals the store |
| 56 | water | lake-chelan | capture_link | https://en.wikipedia.org/wiki/Lake_Chelan | confirmed | https://en.wikipedia.org/api/rest_v1/page/summary/Lake_Chelan | page resolves; wikibase_item Q1115201 equals the store QID |
| 57 | water | monument-valley | capture_price | capture_price | confirmed | https://navajonationparks.org/tribal-parks/monument-valley/ | '$10 per person, per day' and '$15 per Vehicle'; the page states no year, the record's applies_to 2026 is the record's own |
| 58 | water | gurudongmar-lake | capture_link | https://en.wikipedia.org/wiki/Gurudongmar_Lake | confirmed | https://en.wikipedia.org/api/rest_v1/page/summary/Gurudongmar_Lake | page resolves; wikibase_item Q2264090 equals the store QID |
| 59 | water | montmorency-falls | season_months | [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] | confirmed | https://www.quebec-cite.com/en/businesses/parc-de-la-chute-montmorency | Visit Quebec City page: 'Open year-round', closed 25 Dec |
| 60 | water | canyon-des-portes-de-l-enfer | season_months | [5, 6, 7, 8, 9, 10] | confirmed | https://www.terfa.ca/fr/terfa/canyon-des-portes-de-l-enfer/ | 'Saison 2026 le site est accessible du 16 mai a la fin octobre' |

## Changes made

None. Nothing the sources contradict was found, and no point was touched (`data/capture/migration-ledger.json` pins untouched). The two
link redirects (Florence, Trento) were left because the stored URL is what Wikidata P856 states and the link's source id cites Wikidata.

## Findings for the owner

- **F1, season months have no source (decision).** All 51 of the 51 stored places that carry `season_months` have no `field_meta` entry for
  it (no source, no basis, no date). 8 of the 11 sampled were supported by a page (Forillon, Pic Champlain, Montmorency, Canyon des Portes
  de l'Enfer, Manitou Incline, Cape Cod, Finger Lakes, Stansbury); 3 could not be (Capri 5 to 9, Mont du Dome 9 to 10, Sentier La Crete 9 to
  10). The two Quebec trail values are the saved Instagram post's foliage window, which is an intent, not a season. Options: record
  the basis (`our_inference` or `owner_intent`) in `field_meta`, or source each; I did not touch them.
- **F2, 3DEP elevations are elevations at the stored point, not stated heights (information).** For the six US places whose
  `elevation_m` cites `epqs.nationalmap.gov/v1/json`, the check reproduces the value to under 0.5 m, but the stored URL is the bare API
  endpoint, not a replayable query, and for a park centroid the figure is the ground at that point, not the park's or a summit's
  height. A page reader sees "official_info" and may take it for a published elevation. Suggest the note says "computed at the stored
  point" (it does in the source row) and the page does not show it as the park's height.
- **F3, Cap-Gaspe and Cap-Bon-Ami points (decision, point finding).** Both points are the Wikidata coordinates of an item that is not the
  viewpoint: Q112854948 is "hamlet in Gaspe" (48.75,-64.17, a rounded value) and Q112836599 is "administrative sector in Gaspe"
  (48.81389,-64.22222). Both match the store, so I changed nothing; the points stay pinned. If the owner wants the lookouts, an OSM
  viewpoint node is the better source for a new point.
- **F4, one source host refuses automated reads.** `www.sepaq.com` (Bonaventure Island link, and the park pages for Montmorency) returns
  403 to curl and WebFetch. Value not checked: catalogue link `https://www.sepaq.com/pq/bon` on `place/bonaventure-island`. This is not
  proof the link is dead. The Montmorency season was confirmed through Visit Quebec City instead.
- **F5, stale or redirecting links.** `www.comune.fi.it` redirects to `www.comune.firenze.it`; `http://www.comune.trento.it/` redirects to
  https; `coloradosprings.gov/incline` redirects to `/manitouincline` (the Manitou window source). Roma and Venezia use `http://` the same way
  (not sampled). Low priority; a change needs the link's source to be a page, not Wikidata.
- **F6, half of the confirmations are circular.** 35 of the 56 confirmations compare a stored value to Wikidata, Wikipedia or 3DEP, which is
  where it was copied from. They show no copying error, not that the fact is right. The 21 independent ones (operator, park, tourism and
  tribal pages, the Pic Champlain sheet) all agreed. A deeper pass should weight toward fees, hours and windows, which the store holds few of.
- **F7, price and window pages.** The Monument Valley page states $10 per person per day and $15 per vehicle but no year; the record says
  `applies_to` 2026 on its own authority. Havasupai ($455 per person for 3 nights; children 6 and under free with a permit holder) and the
  Manitou Incline window (1st of the month, up to 8 weeks, 45 per half hour) match their records. Kanarra Falls' official site states a
  daily limit of 200 general admission tickets and "from $15", and no season.

## Sources unreachable

`https://www.sepaq.com/pq/bon` (403, 26 Oct; also `https://www.sepaq.com/pq/chm/`, same). The PDF at baliseqc.ca could not be read by WebFetch (binary),
so I read it with `pdftotext` from the downloaded file.

## Checks run

See the run command list in the hand-back; all focused, no `check-all`, no web build.
