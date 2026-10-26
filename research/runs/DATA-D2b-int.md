# DATA-D2b-int: basics and required tier for the 7 trip-less places in VN, FR, CN, IN (25 Oct 2026)

Branch `public/DATA-D2b-int` (worktree `v2-DATA-D2b-int`, from `main` a03c8f0). Model: Sonnet (Claude Sonnet 5.5). Lane `catalogue`.
Run record: `data/capture/runs/api-2026-10-25-data-d2b-int.json`. Lane files: `data/capture/catalogue/BA-int.json`,
`data/suitability/catalogue/R9-int.json`, `data/relevance/catalogue/R9-int.json` (the `R9-` prefix is the allowed sidecar pattern, as in D3a).
Reports: `research/runs/DATA-D2b-int/` (basics before and after, required tier before and after, placement of the lane after).

Places (all trip-less): Paris (FR), Provence (FR), Hanoi (VN), Sapa (VN), Ha Long Bay (VN), Gurudongmar Lake (IN), QQ Canyon Racer mountain
coaster, Gulong Gorge (CN). Images were not searched (Commons belongs to D5b).

## Counts before and after

| Measure | Before | After |
|---|---|---|
| Basics fields missing, the 7 places (of 65 asked) | 40 | 1 (the QQ coaster photo, Commons is D5b's) |
| Places with every basics field answered (of the 7) | 0 | 6 |
| Lane records (trip `catalogue`) | 0 | 11: 7 places, 3 access places (Ha Long port, Gurudongmar road end, Gulong car park), 1 offer (coaster ticket) |
| Lane records with the required tier complete | 0 of 0 | 11 of 11 |
| Suitability records, relevance records | 0, 0 | 8, 11 |
| Dated `searched_none` answers | 0 | 55: 51 in the lane files (9 capture, 30 suitability, 12 relevance) and 4 store columns |
| Store: Wikidata, elevation, season months (of 7) | 6, 4, 2 | 6 plus 1 searched_none; 4 plus 3 searched_none; 5 (Gurudongmar and QQ answer season in the lane through `access_season` and `season`) |
| Placement of the lane | n/a | 11 records, 0 no area, 0 no point, 3 approximate (each with a note), 0 no nearest town |
| `gaps --budget --check` | OK | OK (no pinned count moved; the lane's records are new, so nothing to lower) |

Layers (the 7 places): identity 7 of 7 missing something before, 0 after; when 5 of 7 before (season), 0 after; links 7 of 7 before (official, osm), 0 after; parking
(3 asked: QQ, Ha Long, Gurudongmar) 3 before, 0 after; booking (1 asked, QQ) 1 before, 0 after; image 1 of 7 before and after (QQ).

## Sources used

- Wikidata API (QID, P625, P2044, P1566 GeoNames id, P1435, P856): 4 requests under `/tmp/travel-wikidata.lock`.
- OpenStreetMap through Overpass (relation, way and node ids, `ref:whc`, car park, port): 10 queries under `/tmp/travel-overpass.lock`, 12 s apart; several answered 502 and were repeated.
- Operator and official pages read: gulongxia.com (home, QQ Canyon Racer page, visitor-services page), vietnam.travel (Hanoi, Sapa, Ha Long), halongtourism.com.vn, sikkim.gov.in (7 Sep 2025 release), outlooktraveller.com (12 Jul 2023), provenceweb.fr, dahepiao.com (a ticket reseller, kind `reseller`, basis `community`).
- Not read, blocked with 403 on 25 Oct: parisinfo.com (climate page, metro accessibility page) and whc.unesco.org. Their statements come from a search extract and are marked so in the source title. sikkimtourism.gov.in (permit page) loaded without text.
- Not used for any value: AllTrails, Google, Tripadvisor, Komoot.

## What could not be found

- Ha Long Bay sightseeing ticket price and child rule: no page read states them (the guide page has an empty price section). `price` is a dated `searched_none`; a lead is a 2026 guide quoting about 290,000 VND, not read.
- Gurudongmar: no best time of day, no minimum age, no walking distance, no mapped car park or road end (the road-end record is approximate and says so), no window or fee for the permit. Lachen reopening after the Oct 2023 flood is unconfirmed after 7 Sep 2025.
- QQ Canyon Racer: ride limits (age, height, weight, riders, load, driver rule, pregnancy, cancellation) are not on the operator pages; all are dated `searched_none`. The operator's own price is not published; the 88 CNY figure is a reseller's, April 2025.
- Provence: no regional official tourism page or OSM region boundary found; elevation is not a single figure. Wikidata point is a 1-arc-minute centroid.
- Sapa: no town or provincial tourism site confirmed (laocaitourism.vn was named in an old article, not reachable in the results).
- Wikidata for the coaster: none (Q64841090 is the observation deck, a different object).

## 10-value sample check (against the source, 25 Oct)

| # | Value | Source read | Result |
|---|---|---|---|
| 1 | Hanoi best time Sep to Nov | vietnam.travel Ha Noi page, "Sep - Nov" | pass |
| 2 | Sapa best time Sep to Nov, March to May mild | vietnam.travel Sapa page | pass |
| 3 | Ha Long best time Sep to Nov; summer storms | vietnam.travel Ha Long page, "summer is hot with the chance of storms" | pass |
| 4 | Provence lavender mid-June to end of July | provenceweb.fr, quote of 80 characters | pass |
| 5 | Gurudongmar 17,800 ft and no entry after 11 am | Outlook Traveller page, quote | pass |
| 6 | Lachen to reopen "in the next tourist season", 7 Sep 2025 | sikkim.gov.in release | pass |
| 7 | Coaster 3,680 m, 28 bends, up to 30 km/h | gulongxia.com attraction page | pass |
| 8 | Coaster 88 CNY, 09:00 to 16:30 (reseller, April 2025) | dahepiao.com page | pass |
| 9 | Paris UNESCO site id 600, Hanoi citadel id 1328, Ha Long 672 | OSM `ref:whc` tags via Overpass | pass |
| 10 | GeoNames ids for six places | Wikidata P1566 | pass |

10 of 10 pass. Two values rest on a search extract, not a page I could open: Paris `wheelchair` (metro line 14 only; tram and RER A and B) and the Paris best months.
They are marked in the source titles. The Ctrip hours conflict on the coaster is also from an extract.

## Places I am least sure of

- Provence: typed `settlement.district` because no region type exists; class `town/historic-village`, draw `local` (no designation found, which is conservative for a famous region).
- Gurudongmar: class `lake/glacial-turquoise` is the nearest of 57 classes; the road-end point is the nearest mapped node (a monastery), approximate. Altitude has three figures (Wikidata 5,148 m, OSM 5,100 m, press 17,800 ft); Wikidata is kept, the others sit as a conflict.
- QQ Canyon Racer: the store point and the OSM coaster track are 150 m apart; the track (way 1424946284) is used. The operator page lists a second coaster (Cliff Racer, 4.8 km) that this record does not cover.
- Sapa: the OSM relation is a `boundary=historic` ward; Wikidata gives two elevations (1,500 and 1,718 m), 1,500 kept.

## DECISIONS NEEDED

1. **Place-page size budget (`web/tests/data/place-size.test.ts`, S13).** With these 7 records the median page ratio is 1.280 (limit 1.25) and the QQ page is 70,189 bytes against 45,814 (+53.2%, limit +50% unless listed). Only 99 of 209 baseline pages are at or under 1.25 already; it takes 105 for the median to pass, so no trimming of seven pages can fix it, and the other three splits (65 more places) will widen the gap. D3a held records back for the same budget. I kept the data and left the test untouched. Options: raise the budget for catalogue-lane pages, or measure the median over pages that have a lane record separately. The coordinator or owner decides; `check-all` stage "web test" fails on these two assertions until then.
2. **Towns anchors (`tools/towns.py build`, `tools/tests/test_towns.py`).** Paris adds an anchor in Ile-de-France, and `fr-idf` then gzips to 21,358 bytes against the 20,000 budget, so `towns.py build` refuses to run and `test_anchors_are_rounded_public_points_and_cover_every_public_point` fails (Paris 48.85667, 2.35222 is 5 km from no anchor). The fix is builder work (raise the budget or split `fr-idf`). Any later public point in a dense city (Rome, Milan, Florence) may hit the same.
3. **Point provenance budget.** `data/capture/points.json` is still `capture-points/1`, so each new row carries the free-text `point_source`. My 10 rows raise `core/test/schema/keep-budget.json` `point_source_rows` and `core/test/normalise/normalise-budget.json` `points.point_src` from 185 to 195. RIS-J converts them with the other 185. Merge: take the sum of the splits' rises.
4. **New operator.** `operator/gulong-gorge-eco-tourism` (name and URL from the operator site) is in `data/capture/operators.json`; `core/test/capture/migration.test.ts` pins the operator count (23 to 24). The same line will change in other splits that add an operator.
5. **Generated files that every split touches:** `data/locations/locations.json` (`updated` date and source ids `src-00037` to `src-00047`, which other splits will also use for different rows: renumber at merge), `WISHLIST.md`, `legacy/globe/assets/data/places.json`, `legacy/locations/index.html`, `data/sources/registry.json`, `data/relevance/inputs/points.json`, `data/relevance/derived/catalogue.json`, and `data/suitability/{canadian-rockies-2029,dolomites-2027}/migrated.json` (`suitability.ts migrate` copies the store's `updated` date into a source `read` field, so any store edit needs `migrate --write`; the change is one date per file).

## Gotchas found

- `derive-near --write` and `suitability.ts derive --write` write into the lane files; regenerating a lane file wipes them, so run both after every rewrite.
- The household-text scrubber (`core/src/privacy/dateless.ts`) matches "digits, a few words, then road" as a street address and drops the sentence from the public page: "above 5,000 m with a road to it" was dropped. Avoid a number followed by "road", "way", "lane", "drive" in public text.
- Relevance `draw` needs a note that names a signal (designation, top list, headline) even at `local`, and a designation on a place that is not an area must say `scope: parent`.
- Access places (car park, dock) need `summary` and `access_cost` through a relevance record even though the contract marks relevance N for them; a dock also asks for `parks_for`.
- The coaster offer needs its own suitability record with the same required keys as its place.
- `gulongxia.com` answers over http (301 to https) from this machine; WebFetch could not reach it.
