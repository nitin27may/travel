# AREA-2: new registry areas, then area_id derived again (26 Oct 2026)

Lane AREA-2, researcher, model Opus 5.5. Run record: `data/capture/runs/area-2-2026-10-26-new-areas.json` (235 results:
206 filled, 1 conflict, 28 gaps). Rule and thresholds unchanged from AREA (`research/runs/AREA-derive-area.md`): parent first,
then the nearest label within 10 km, a 2x margin over every other area, the region test and the town test.

**Result: E_PLACE_AREA 227 to 28** (gap budget lowered twice, `gaps --budget --write`). 203 derived area_id values written,
3 authored by owner decision, Cortina d'Ampezzo moved from derived to authored (value unchanged).

## Product-visible change: 76 new store places, 76 new public place pages

`derive-area` labels come from authored records and the locations store's places, and `locations.py` creates a region or area only
with a place. Each new area therefore got one or more real places in the store (import of
`research/inbox/2026-10-26-area2-area-labels.json` through the `location` skill): **76 places, 37 areas, 14 regions**. Each place's
coordinates are Wikidata P625 (read 26 Oct, never Google), then `edit --wikidata Q... --basis community` with a dated source row.
No label shares a name with a capture record: an "Emerald Lake" label took over the record's public page (slug drift) and was
reverted, and `slugs.ts --check` shows no takeovers. `web/redirects.json` gained the redirects for the new pages.

## Areas created (anchor places)

| Region | Area | Anchors |
|---|---|---|
| CA/BC | yoho-national-park | Field, Yoho Valley, Chancellor Peak |
| CA/BC | columbia-shuswap-regional-district | Golden |
| CA/BC | kootenay-national-park | Sinclair Canyon |
| CA/BC | mount-robson-provincial-park | Mount Robson Provincial Park, Mount Robson |
| CA/BC | whiteswan-lake-provincial-park | Whiteswan Lake |
| CA/BC | elk-lakes-provincial-park | Upper Elk Lake |
| CA/AB | jasper-national-park | Jasper, Mount Edith Cavell, Mount Kerkeslin, Maligne Lake, Curly Phillips Boathouse, Athabasca Glacier, Ashlar Ridge |
| CA/AB | kananaskis-country | Mount Lawrence Grassi, Kananaskis Village, Barrier Lake, Spray Valley PP, Burstall Lakes, Upper Kananaskis Lake, Highwood Pass, Paddy's Flat |
| CA/AB | waterton-lakes-national-park | Waterton Park, Mount Blakiston |
| CA/AB | beauvais-lake-provincial-park | Beauvais Lake |
| IT/trentino-alto-adige | bolzano (labels) | Castelrotto, Nova Levante, Val Gardena, Dantercepies gondola, Dobbiaco station, Collegiate Church of San Candido, Rifugio Fondovalle, San Cassiano |
| FR/ARA | haute-savoie | Chamonix-Mont-Blanc, La Flegere, Vallorcine station (keeps Vallorcine out of Switzerland) |
| CH/VS | saint-maurice-district | Lac d'Emosson |
| IS (GeoNames admin1) | capital-region/reykjavikurborg, southern-peninsula/grindavikurbaer, west/snaefellsbaer, west/grundarfjardarbaer, northwest/skagafjordur, northeast/akureyrarbaer, northeast/thingeyjarsveit, northeast/vatnajokull-national-park, east/mulathing, east/hornafjordur, south/skaftarhreppur, south/myrdalshreppur, south/rangarthing-eystra, south/blaskogabyggd | one or more towns or sights each |
| AR/Z | lago-argentino-department | El Chalten, Perito Moreno Glacier |
| AR/V | ushuaia-department | Ushuaia, Southern Fuegian Railway, Cerro Castor |
| AR/C | buenos-aires | Buenos Aires |
| CA/ON | muskoka-district-municipality, haliburton-county, algonquin-provincial-park | Dwight, Arrowhead PP; Oxtongue Lake; Lake of Two Rivers |
| US/VT | lamoille-county, caledonia-county, franklin-county | Smugglers' Notch SP, Morrisville; East Burke, Danville; Montgomery |
| US/UT | wayne-county, garfield-county, salt-lake-county | Capitol Reef visitor center; Calf Creek; Salt Lake City |

## Owner decisions applied (26 Oct)

- **Bryce:** authored `place/bryce-canyon-national-park` and `part/...#visitor-center-lot` changed from `US/UT/kane-county` to
  `US/UT/garfield-county`; the store's Bryce place moved to Garfield with `edit --area` (its id still reads `kane-county`; ids
  are not renamed). Recorded as a **conflict**: the US Census block lookup (geo.fcc.gov) puts the store point and all four
  amphitheatre record points in Garfield County (FIPS 49017); Wikidata Q219562 P131 lists Kane County only. The park spans both.
  The four Bryce records (Navajo Loop and its payoff, the amphitheatre rim, Sunset Point) now derive Garfield.
- **Rifugio Scotoni:** authored `IT/trentino-alto-adige/bolzano` (Alta Badia side). Its near_town is in Veneto, so the point rule
  could never reach Bolzano.
- **Cortina d'Ampezzo (follow-on):** the new Scotoni label sits 12 km from Cortina, inside the 2x margin of the Lago di Sorapis
  label (5.5 km), so the rule would have dropped Cortina's correct Belluno area. Made authored instead (Wikidata Q41158 P131 =
  Q16126, Province of Belluno) by removing its ledger entry; the value did not change.
- **Border near_town cases** stay unresolved with their reasons (below).
- **Laguna Nimez point stays pinned**: see Findings.

## Medium confidence (kept, flagged for review)

- Ragged Falls placed in `CA/ON/haliburton-county` (Oxtongue Lake label; close to the Muskoka line).
- Canmore Nordic Centre, Grassi Lakes and Ha Ling records placed in `CA/AB/kananaskis-country` (Mount Lawrence Grassi label). They
  sit on the Canmore edge, where the line between Kananaskis Country's parks and the town of Canmore was not checked against a
  source in this run.

## Measured accuracy (hold-out of the 172 authored records)

| Hold-out | Answered | Match | Precision | Coverage |
|---|---|---|---|---|
| the record alone | 154 | 153 | 99.4% | 89.0% |
| the record and its family | 137 | 136 | 99.3% | 79.1% |

The one confusion is the old one: `place/viel-dal-pan` (authored Belluno, rule says Trento; see AREA).

## Still unresolved (28)

| Reason | Records |
|---|---|
| Border near_town (region test fails, correctly; owner: leave) | Marble Canyon, Paint Pots and their two walks (near_town Banff); Lake Magog, Sunburst (near_town Canmore); Vallorcine, Col des Montets (near_town in Valais); penguin colony on Isla Martillo (near_town Puerto Williams, Chile) |
| Default anchor shares the record's name (slug takeover) | Castle PP, Top of the World PP, Goblin Valley, Dead Horse Point (also no margin), Borgarfjordur waterfalls (Hraunfossar) |
| No label within 10 km | Sunwapta Falls, Icefields Parkway drive, Parker Ridge, Kicking Horse float river base, Rienza rafting, Beagle Channel boat, Dorset lookout tower, Laguna Nimez |
| No clear margin | Elk Lakes park, Rockwall Lookout, Solitaire Lake trail |
| Town test | Ptarmigan Cirque |
| Out of scope | Drava cycle path (Carinthia, Austria) |
| No point | Lac du Chatelard (D1b decision 1) |

## Findings for the owner

- **Laguna Nimez point looks wrong.** The record point (-50.3167, -72.6333) is about 27 km from El Calafate; the reserve is at
  the town's edge. The point is pinned by `data/capture/migration-ledger.json`, so it stays until a points supersede exists.
- **Tooling gaps:** no command creates a region or area without a place; `slugify` drops the letters thorn, eth and ae
  (`IS/west/snfellsbr`), so Iceland areas use ASCII names and place aliases (same ids a fixed slugify would give; display names
  need a rename command later); the name resolver first picked the Yukon Emerald Lake, so every anchor was then given an explicit
  QID.

## Hosts

www.wikidata.org 194 requests (P625, P131, search), geo.fcc.gov 6 (census block lookups for Bryce). One request at a time.
