# UXB-W: weather and climate links for the 14 public trips

Run 2026-10-26, agent `travel-researcher` (Opus), branch `public/UXB-W`. Spec: [trip-and-places-ux-fixes.md](../../docs/v2/features/trip-and-places-ux-fixes.md)
sections 6.3, 6.4 and 13.3; Q298 answered yes (links only, no weather API call from our pages).

## Scope

Every public trip (Peru has no page and is out): one official forecast link per base or base area, at least one official
climate link per trip, and a generic official fallback. Output is a proposed reference file,
[`data/reference/weather-links.json`](../../data/reference/weather-links.json) (`weather-links/1`), 14 trips, 72 links,
14 fallbacks. No capture record, sidecar or trip file was touched, so no run record was written: `capture-run/1` names
record refs and fields, and this run filled none (section "Data shape" explains why the links are not on capture records).

## How the links were checked

- One script, one request at a time, 1.5 s apart, user agent `travel-capture/1.0 (+https://nks-travel.pages.dev/about/)`.
  Each URL was read once (HTTP status, final URL, page title). Yr place ids came from Yr's location search (10 calls);
  four coordinates came from Wikidata P625 (Île d'Orléans Q128172, Torrey Q483141, Moab Q130134, Bryce Canyon City Q483332).
- Coordinates inside ECCC and NWS URLs come from our own data (`data/trips/base-points.json`, `data/schedules/canadian-rockies-2029.json`,
  `data/capture/points.json`, `data/locations/locations.json`) or Wikidata, never Google. They are a lookup key for the
  publisher's page, rounded to 3 or 4 decimals; they are not stored as place points.
- The page each URL resolves to was confirmed by its title (ECCC names the forecast site: "Banff, AB", "Lake of Two Rivers, ON",
  "Sainte-Famille-de-l'Île-d'Orléans, QC") or, for NWS, by the "Point Forecast" line ("Springdale UT", "Torrey UT", "Lincoln NH").
- Made-up paths were tried where a 200 could be meaningless: meteoam.it answers 404 for an unknown city, MeteoSwiss 404 for
  a wrong slug or postcode, vedur.is 404 for an unknown area. The South Tyrol site answers 200 with the same app shell for
  any path, so its three links are marked `content: app_shell`; the route names (`municipality-weather`, `mountain-weather`,
  `climate-charts`) were confirmed in the site's own script.
- We store links only. No forecast or climate value was copied. Terms pages were not read: linking to a public page needs
  no data licence.

## The table

English: whether the linked page itself is in English. Reachable: the status our script got on 2026-10-26.

| Trip | Destination (bases) | Forecast URL | Climate URL | English | Reachable |
|---|---|---|---|---|---|
| algonquin-muskoka-2026 | Dwight, Lake of Bays | <https://weather.gc.ca/en/location/index.html?coords=45.331,-79.012> | <https://climate.weather.gc.ca/climate_normals/results_1991_2020_e.html?searchType=stnProv&lstProvince=ON&climate_id=6115524&dispBack=0> (Muskoka) | yes | yes |
| algonquin-muskoka-2026 | Algonquin Park, Highway 60 | <https://weather.gc.ca/en/location/index.html?coords=45.56,-78.578> (Lake of Two Rivers) | as above | yes | yes |
| canadian-rockies-2029 | Calgary | <https://weather.gc.ca/en/location/index.html?coords=51.114,-114.02> | none of its own (a pass-through) | yes | yes |
| canadian-rockies-2029 | Banff | <https://weather.gc.ca/en/location/index.html?coords=51.178,-115.571> | <https://climate.weather.gc.ca/climate_normals/results_1991_2020_e.html?searchType=stnProv&lstProvince=AB&climate_id=3050519&dispBack=0>; <https://parks.canada.ca/pn-np/ab/banff/securite-safety/meteo-weather> | yes | yes |
| canadian-rockies-2029 | Lake Louise | <https://weather.gc.ca/en/location/index.html?coords=51.425,-116.177> | Banff normals and the Parks Canada page (Lake Louise averages) | yes | yes |
| canadian-rockies-2029 | Jasper | <https://weather.gc.ca/en/location/index.html?coords=52.874,-118.081> | <https://climate.weather.gc.ca/climate_normals/results_1991_2020_e.html?searchType=stnProv&lstProvince=AB&climate_id=3053520&dispBack=0> | yes | yes |
| canadian-rockies-2029 | Kananaskis Village | <https://weather.gc.ca/en/location/index.html?coords=50.919,-115.148> | Banff normals | yes | yes |
| chamonix-mont-blanc-2028 | Les Praz, Argentière | <https://meteofrance.com/previsions-meteo-france/chamonix-mont-blanc/74400>; mountain <https://meteofrance.com/meteo-montagne/chamonix/740562> and <https://meteofrance.com/meteo-montagne/chamonix-mont-blanc-3845m/740566> | <https://meteofrance.com/climat/normales/france/auvergne-rhone-alpes/BOURG%20ST%20MAURICE> (nearest public station, another valley) | no | yes |
| costa-rica-2027 | Rincón de la Vieja, Arenal, Manuel Antonio, Uvita | <https://www.imn.ac.cr/en/reporte-pronostico-regional> (one page, all regions) | <https://www.imn.ac.cr/en/clima-en-costa-rica> (English) plus four regional PDFs in Spanish (in the JSON) | yes (PDFs no) | yes |
| dolomites-2027 | San Candido, Ortisei or Selva, Bolzano | <https://weather.province.bz.it/en/municipality-weather>; mountain <https://weather.province.bz.it/en/mountain-weather/dolomites> | <https://weather.province.bz.it/en/climate-charts> | yes | app shell (see above) |
| dolomites-2027 | Cortina d'Ampezzo | <https://www.meteoam.it/it/meteo-citta/cortina-d-ampezzo> | GAP | no | yes |
| dolomites-2027 | San Vito di Cadore | <https://www.meteoam.it/it/meteo-citta/san-vito-di-cadore> | GAP | no | yes |
| dolomites-2027 | Venice | <https://www.meteoam.it/it/meteo-citta/venezia> | none (arrival and departure only) | no | yes |
| iceland-ring-road-2027 | Keflavík, Reykjavík | <https://en.vedur.is/weather/forecasts/areas/reykjavik/> | <https://en.vedur.is/climatology/iceland/>; <https://en.vedur.is/climatology/data/> | yes | yes |
| iceland-ring-road-2027 | Selfoss, Laugarvatn, Vík | <https://en.vedur.is/weather/forecasts/areas/south/> | as above | yes | yes |
| iceland-ring-road-2027 | Skaftafell, Höfn | <https://en.vedur.is/weather/forecasts/areas/southeast/> | as above | yes | yes |
| iceland-ring-road-2027 | Seyðisfjörður, Egilsstaðir | <https://en.vedur.is/weather/forecasts/areas/eastfjords/> | as above | yes | yes |
| iceland-ring-road-2027 | Mývatn, Akureyri | <https://en.vedur.is/weather/forecasts/areas/northeast/>; aurora <https://en.vedur.is/weather/forecasts/aurora/> | as above | yes | yes |
| iceland-ring-road-2027 | Grundarfjörður (Snæfellsnes) | <https://en.vedur.is/weather/forecasts/areas/breidafjordur/> | as above | yes | yes |
| niagara-day-2026 | Niagara Falls | <https://weather.gc.ca/en/location/index.html?coords=43.129,-79.06> | <https://climate.weather.gc.ca/climate_normals/results_1991_2020_e.html?searchType=stnProv&lstProvince=ON&climate_id=6139445&dispBack=0> (Welland-Pelham) | yes | yes |
| norway-summer-2028 | Svolvær, Reine, Andenes, Fjordgård (Senja) | Yr pages 1-276917, 1-272752, 1-299319, 1-304638 (full URLs in the JSON) | <https://www.yr.no/en/statistics/graph/1-276917/Norway/Nordland/V%C3%A5gan/Svolv%C3%A6r> (observations against the 1991-2020 normal) | yes | yes |
| norway-summer-2028 | Ålesund, Åndalsnes, Geiranger, Loen, Aurlandsvangen, Bergen | Yr pages 1-181828, 1-190429, 1-177457, 1-169613, 1-124143, 1-92416 | <https://www.yr.no/en/statistics/graph/1-92416/Norway/Vestland/Bergen/Bergen> | yes | yes |
| patagonia-2027 | Buenos Aires, Ushuaia, El Chaltén, El Calafate | <https://www.smn.gob.ar/> (no per-town link known) | GAP | no | **no (403)** |
| quebec-2026 | Île d'Orléans | <https://weather.gc.ca/en/location/index.html?coords=46.936,-70.947> | <https://climate.weather.gc.ca/climate_normals/results_1991_2020_e.html?searchType=stnProv&lstProvince=QC&climate_id=7016294&dispBack=0> (Québec City airport) | yes | yes |
| switzerland-2027 | Lucerne | <https://www.meteoswiss.admin.ch/local-forecasts/lucerne/6003.html> | <https://www.meteoswiss.admin.ch/climate/the-climate-of-switzerland/climate-normals/climate-diagrams-and-normals-per-station.html> (pick the station) | yes | yes |
| switzerland-2027 | Wengen | <https://www.meteoswiss.admin.ch/local-forecasts/wengen/3823.html> | as above (Interlaken) | yes | yes |
| switzerland-2027 | Zermatt | <https://www.meteoswiss.admin.ch/local-forecasts/zermatt/3920.html> | as above (Zermatt) | yes | yes |
| utah-five-parks | Springdale (Zion) | <https://forecast.weather.gov/MapClick.php?lat=37.1844&lon=-112.9997> | <https://www.nps.gov/zion/planyourvisit/weather-and-climate.htm> | yes | yes |
| utah-five-parks | Bryce Canyon City | <https://forecast.weather.gov/MapClick.php?lat=37.6739&lon=-112.1569> | <https://www.nps.gov/brca/planyourvisit/weather.htm> | yes | yes |
| utah-five-parks | Torrey (Capitol Reef) | <https://forecast.weather.gov/MapClick.php?lat=38.3017&lon=-111.42> | <https://www.nps.gov/care/planyourvisit/weather.htm> | yes | yes |
| utah-five-parks | Moab (Arches, Canyonlands) | <https://forecast.weather.gov/MapClick.php?lat=38.5725&lon=-109.5497> | <https://www.nps.gov/arch/planyourvisit/weather.htm>; <https://www.nps.gov/cany/planyourvisit/weather.htm> | yes | yes |
| utah-five-parks | Salt Lake City | <https://forecast.weather.gov/MapClick.php?lat=40.75&lon=-111.8833> | <https://www.weather.gov/wrh/Climate?wfo=slc> (NOWData tool) | yes | yes |
| vermont-fall-2026 | Hyde Park (Stowe) | <https://forecast.weather.gov/MapClick.php?lat=44.6245&lon=-72.5648> | <https://www.weather.gov/btv/climate> | yes | yes |
| new-hampshire-stopover-2026 | Lincoln | <https://forecast.weather.gov/MapClick.php?lat=44.045&lon=-71.6706> | <https://www.weather.gov/gyx/climate> | yes | yes |

Fallbacks (all 200 except SMN): ECCC province lists (`index_e.html?id=ON`, `AB`, `QC`), `weather.gov`, MeteoSwiss home,
Météo-France Alpes du Nord mountain page, South Tyrol home, vedur.is home, yr.no, IMN home, SMN home (403).

## Unreachable or unconfirmed

- **SMN Argentina** (`www.smn.gob.ar`): 403 on `/`, `/estadisticas`, `/pronostico` to the script and to WebFetch. Stored as a
  link with `reachable: false`, so the page will not draw it until a person confirms it in a browser.
- **ARPAV Dolomiti Meteo** (`www.arpa.veneto.it`, `meteo.arpa.veneto.it`): timed out (40 s, IPv4) and refused WebFetch. Not stored.
- **South Tyrol weather** (`weather.province.bz.it`): 200 but a JavaScript shell for any path; content not confirmed by the script.

## Gaps

- GAP: Patagonia has no confirmed forecast or climate link (SMN 403; searches `site:smn.gob.ar pronóstico Ushuaia` and
  `smn.gob.ar estadísticas climatológicas normales 1991-2020 Ushuaia El Calafate`, 2026-10-26, returned no smn.gob.ar page).
- GAP: Veneto bases (Cortina d'Ampezzo, San Vito di Cadore) have no climate link (ARPAV unreachable; `meteoam.it/it/clima`
  and `/it/climatologia` answer 404).
- GAP: Chamonix has no Météo-France normals page for its own station; the public list for Auvergne-Rhône-Alpes has six
  stations and the nearest, Bourg-Saint-Maurice, is in the Tarentaise. Its label says so.
- No per-town deep link for South Tyrol municipalities (the slug comes from a data file the app loads); the map page is stored.
- Lake Louise and Kananaskis have no 1991-2020 ECCC normals station; Banff's stands in.
- Jasper has no Parks Canada weather page that answered (three guessed paths answered 404, one search found none); ECCC Jasper normals cover it.

## Conflicts

None. No values were read, so none could disagree.

## Data shape (proposal)

**Where.** `data/reference/weather-links.json`, schema string `weather-links/1`, keyed by trip id, then by area. No Zod
schema owns it yet: `validate.ts --all` does not walk `data/reference/`, and `sources.ts build` does not read it. This
file deviates from spec 6.4 and brief 13.3, which put the links on the base places' `conditions` links in
`data/capture/<trip>/`. That route does not fit today: 6 of the 14 trips have no capture records, bases are trip rows and
not capture records, area links (an Iceland forecast region, Costa Rica's one regional page) have no single place to sit
on, and the climate link belongs to the trip. The coordinator asked for the reference file, so it is written here and
the choice goes to the owner (question 1).

**Shape.**

```
{ schema, status, note, researched, run, user_agent,
  publishers: { <key>: { name, short, country, kind, english, langs[], home, terms_note } },
  label_rule, privacy: { rel, target, sr_only, rule }, selection_rule,
  trips: [ { trip, research_folder, country, region,
             links: [ { kind: forecast|climate|mountain|aurora, area, bases[], label, publisher, url, english,
                        url_pattern: coords|station_id|place_id|slug|slug_postcode|area_slug|site_id|document_id|office_code|station_name|fixed,
                        built_from, check: { read, http, reachable, content, page_title, method }, note } ],
             fallback: { url, check }, gaps[] } ] }
```

**How the page picks a link.** By trip id, then by area: forecast rows in stored order (the order of the bases), then
mountain and aurora, then climate. A row with `check.reachable: false` is not drawn; with no drawable forecast the page
draws the fallback. A day can pick the rows whose `bases` include its base name. Only `label`, `url`, `publisher.short`,
`english` and `kind` need to reach the payload; `check`, `built_from` and `note` stay in the data.

**Labels.** `<row label> (<publisher short>)`: "Forecast: Banff (Environment Canada)", "Climate averages 1991-2020: Banff
(Environment Canada)", "Mountain forecast: Chamonix (Météo-France)", "Aurora and cloud cover forecast (Icelandic Met Office)".
A page not in English gets the word "French", "Italian" or "Spanish" after the publisher (from `english: false` and `langs`).

**Privacy and behaviour.** Plain `<a>` links with `target="_blank" rel="noopener noreferrer"`, the external glyph and the
sr-only "(opens in a new tab, third-party site)", which is the house rule for outbound links (design review phase A, M17).
`noreferrer` matters here: our trip URLs can carry the youngest-age band and adult count (spec D6), and without it the
browser could pass the page URL to the weather service. We add no query of our own. Nothing is fetched by our pages or our
build.

**Stability.** ECCC and NWS links are built from coordinates (stable while the services keep these patterns; ECCC's old
`/city/pages/ab-49_metric_e.html` pattern already answers 404, so the coordinate form is the current one). Yr uses place
ids (stable; Yr redirects the id-only form to the canonical path). MeteoSwiss uses English slug plus postcode. Météo-France
and IMN use site and document ids. A refresh pass should re-run the check at least yearly (the `rules` freshness class,
365 days) and before each trip's pre-trip conditions check.

**Follow-up task (proposed: UXB-WL, Sonnet, about 1 h, before UXB-C step 3).** Add a Zod schema `weather-links/1` in
`core/src/schema/` with the shape above, a `detect` rule and an `allFiles` entry in `core/src/validate/index.ts` for
`data/reference/weather-links.json`, a check that every `trip` is a known trip id and every `publisher` key exists, and a
`sources.ts build` reader so the links join the source registry with their read dates. UXB-C then reads this file (not
capture `conditions` links) for `weather` on the trip payload.

## Questions for the owner

1. Keep the links in `data/reference/weather-links.json` (this run) rather than on capture records' `conditions` links as
   spec 6.4 says? Recommended: yes, the reference file; the spec and brief 13.3 then change.
2. Patagonia: show nothing (today's state) until a person opens smn.gob.ar in a browser and confirms the town and statistics
   pages, or show the SMN home link unconfirmed? Recommended: a person checks it once (5 minutes), then we store the URLs.
3. Non-English pages (Météo-France, Aeronautica Militare, SMN, the IMN PDFs): link them with the language named, or prefer an
   English non-national page? Recommended: keep the national service and name the language.
4. Chamonix climate: link Bourg-Saint-Maurice (another valley, labelled as such) or leave Chamonix without a climate link?
5. Should mountain and aurora rows show in the When to go section, or only on the days they matter (lift days, Mývatn)?

## Files written

- `data/reference/weather-links.json` (new, proposed `weather-links/1`)
- `research/runs/UXB-W-weather-links.md` (this note)

## Commands run

See the hand-back for exact results: `node core/bin/validate.ts --all`, `node core/bin/sources.ts check`,
`python3 tools/tree_check.py`, `python3 tools/relink.py check`, `node core/bin/capture.ts gaps --placement --trip canadian-rockies-2029`.
