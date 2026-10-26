# DATA-D2b-it: basics for the 10 Italian stored places (trip-less lane `catalogue`)

Run 25 Oct 2026, model Sonnet, branch `public/DATA-D2b-it`. Lane files: `data/capture/catalogue/BA-it.json`, `data/suitability/catalogue/R9-it.json`, `data/relevance/catalogue/R9-it.json`, run record `data/capture/runs/api-2026-10-25-data-d2b-it.json`, 11 point rows appended to `data/capture/points.json` (and rebuilt into `data/relevance/inputs/points.json`). Reports: `research/runs/DATA-D2b-it/`.

## Counts

| | before | after |
|---|---|---|
| `basics --report` places of IT with no missing field | 0 of 10 | 9 of 10 |
| lane `catalogue` records (capture / suitability / relevance) | 0 / 0 / 0 | 11 / 9 / 11 |
| records with the required tier complete in the lane (`gaps --tier required --trip catalogue`) | 0 | 11 of 11 (every key answered, 0 missing) |
| placement gaps in the lane | n/a | no area 0, no point 0, no nearest town 0, 3 approximate (Lake Como, Amalfi Coast, Capri: rounded Wikidata centres, noted) |
| searched_none values written | 0 | 46 in the lane files (capture 5, suitability 28, relevance 13) + 5 store columns |

Store layers for IT (`basics --report`): identity 9 to 1 missing (summary now from the relevance `why`), links 10 to 1, when 5 to 1; the one place left is the Dolomites.

Searched_none by kind: stroller and wheelchair on 9 places, on_site_min and walk_m on 3, exposure on 2, access_season on 2, best_time on Lake Como, editorial mentions on 11, Wikidata of the two access parts, official link of 4 records (Amalfi Coast, Capri, the car park, the ferry terminal); store: season months of Rome, Milan, Trento, Florence, and elevation of the Amalfi Coast. Each says what was tried.

## What was filled and from where

- Identity: Wikidata QID, label and description, P625 point (role `centre`), P2044 elevation (already in the store; Amalfi Coast has none), Wikipedia language count (sitelinks) as the evidence in each draw note. One Wikidata API call and one SPARQL query, under `/tmp/travel-wikidata.lock`.
- OSM: nine relation ids, each confirmed by its `wikidata` tag through Overpass (relation 541757 Lake Como, 41485 Rome, 44915 Milan, 46663 Trento, 42602 Florence, 44830 Verona, 44741 Venice, 2675353 Capri, 21469402 Amalfi Coast). Five Overpass queries, over 10 s apart, one lock. Two parts from OSM: Autosilo Via Auguadri (Como, way 316776513, fee yes, 800 spaces) as the lake's parking point; the unnamed ferry-terminal node 3711590228 on Capri.
- Heritage: World Heritage ids from Wikidata P757 (SPARQL): Rome 91, Milan 93 (a site inside the city), Florence 174, Venice 394, Verona 797, Amalfi Coast 830. Written as `scope: parent` (the validator refuses `own` on a place).
- Official pages read: lakecomo.is, navigazionelaghi.it (boats; vehicles only between the car-ferry stops), turismoroma.it Trevi page (EUR 2 basin ticket, 2 Feb 2026 to 31 Dec 2027), coopculture Blue Grotto page (hours and rates), feelflorence.it, tourism.verona.it ("ogni momento dell'anno" gave Verona's all-year season), visittrentino.info. Council sites as `official` links come from Wikidata P856.
- GeoNames ids: Rome, Milan, Trento, Florence, Verona from the towns layer (populated-place ids); Venice from Wikidata P1566 (the commune feature), because the layer does not hold Venice.

## Could not be found, and why

- cda.ve.it, veneziaunica.it returned no text to our fetch (script-built pages); the Venice access-fee rule (day permit, 3 Apr to 26 Jul 2026 selected days, age 14 and over, EUR 5 or 10) is from a press report, basis `community`, and is marked as such. Re-read cda.ve.it by hand.
- whc.unesco.org returns 403; yesmilano.it returns 403; capri.it returns 404; no official site for the Amalfi Coast or Capri (Wikidata P856 is empty or a commercial site). Those `official` links are dated searched_none.
- Stroller, wheelchair, time on site, walk length, exposure: no page read states them; written as searched_none, not guessed.
- Season months for Rome, Milan, Trento, Florence: no page names a season. Best time of year has no capture property (`best_window` takes only foliage, flow, larch, bloom, wildlife, snow, water_temp), so it is not stored for any city.
- Images: left as is (no Commons search in this batch). Elevation of the Amalfi Coast: Wikidata has no P2044.

## Sample check (10 values, against the raw API responses saved in the session)

10 of 10 pass: QID and label of Rome; OSM relation 41485 carries `wikidata=Q220`; Capri relation 2675353 carries Q173292; Amalfi relation 21469402 carries Q212214; Venice GeoNames 6542284 equals P1566; Florence point equals P625; Verona P757 797; Venice P757 394; Rome has 274 language editions as the draw note says; Trento elevation 203 equals P2044. Caveat: these check my transcription against the same API reads, not a second independent source; the Opus sampler should open the official pages (Trevi, Blue Grotto, lakecomo.is, navigazionelaghi.it) for the figures with a read date.

## Least sure of

1. Lake Como class `town/lakeside` (no large-lake class exists), Amalfi Coast class `drive/scenic-parkway`, Capri class `sight/landmark`: nearest of the 52 classes, not a fit. DECISIONS NEEDED below.
2. All judged fields (draw, standing, distinction, easy payoff, weather): basis `our_inference`, no ranking source was read. Draws: Rome, Milan, Florence, Venice, Lake Como, Amalfi Coast `world`; Capri, Verona `national`; Trento `regional`.
3. Capri ferry terminal name "Marina Grande" is ours; the OSM node has no name.
4. `near_town` derived for Lake Como's car park is Monza (28.9 km) because the towns layer holds no Como; same blind spot for Venice and Sorrento. Needs `tools/towns.py` anchors for Lombardy lake towns and the Veneto and Campania coasts.

## For the coordinator

- The Dolomites (`place/dolomites`, record in `dolomites-2027/migrated.json`, tied to a trip) still lacks `official` and `osm` links and a parking point. Proposed: osm link relation 2139488 (its `wikidata` tag is Q1283, verified here from Wikidata P402; not queried in Overpass); official left to the trip's owner, since Wikidata P856 is empty and the UNESCO page returned 403. Not written: the lane belongs to another batch.
- Shared files appended only: `data/capture/points.json` (11 rows, end of file), `data/relevance/inputs/points.json` (rebuilt by `relevance.ts points --build`; diff is my rows only). `data/sources/registry.json` not regenerated (rule). `data/locations/WISHLIST.md` and the two legacy outputs were rebuilt by the store hook; take either side and rerun `locations.py build`.
- Leads for later records (no property home yet, or out of scope): Blue Grotto hours (1 Apr to 30 Sep 8:30 to 18:00; 1 to 15 Oct 8:30 to 16:00; 16 Oct to 31 Mar 9:00 to 14:00, "subject to change due to weather", full price EUR 6, coopculture page read 25 Oct 2026) as an offer or part of Capri; Trevi basin ticket as an offer of Rome.
- The store notes of some rows (Dolomites, Rome, Milan, Florence, Venice) hold the original capture remarks, including a hotel idea and a trip date on the Dolomites row. They were not changed; they are not public values but the owner may want them moved to `notes_private`.

## DECISIONS NEEDED

1. Add relevance classes for a large scenic lake and for a coast or island (safe default taken: nearest existing class).
2. Add city season/best-time storage (a city has no season, but the basics tier asks one): safe default taken: season months searched_none, Verona all year from its official guide.
3. Venice access fee: confirm the figure from cda.ve.it before it is shown.

## Checks run

`normalise.ts --check` on the three lane files and the run record: clean (the capture file was converted by `--write` once: `origin` to `meta.origin`). `capture.ts build --check`, `validate.ts --all` (no finding in the lane), `locations.py validate`, `locations.py build --check`, `gaps --budget --check` (no count rose; the lane's records were never in the budget), `tree_check.py --check`: pass. `check-all.sh`: see the hand-back.
