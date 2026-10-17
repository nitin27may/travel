# Interactive world globe: research, inventory and build plan (16 Oct 2026)

Goal, in Nitin's words: the best interactive globe of the world. Spin it, explore continents, oceans and seas, hover and read names, click a country and drill into it, then into a state or province, then a city, with rivers and mountain names along the way. Real world first; our saved places get linked afterwards.

Every figure below was checked live on 16 Oct 2026 (sizes are bytes as downloaded, versions from npm).

---

## 1. Library choice

| Stack | What it gives | What it costs | Verdict |
|---|---|---|---|
| **MapLibre GL JS 6.14** (globe projection since 5.0, Jan 2025; v6 is ESM-only, WebGL2) | One engine from spinning globe to street level. Globe with atmosphere, smooth zoom that becomes Mercator up close, vector tiles with text labels at every zoom (countries, states, cities, towns, villages, rivers, lakes, seas, peaks), 3D terrain and hillshade **on the globe** ("Support Terrain in Globe projection" is in the changelog; the official example combines GlobeControl, terrain and hillshade), hover and click on any feature via `queryRenderedFeatures`, feature-state for highlighting, `fitBounds`/`flyTo` camera animation, collision-managed labels. | About 1 MB of JS. Terrain in globe is recent, so expect occasional rendering bugs at poles and the antimeridian (fixes landed in 6.8). Needs tile servers (all free ones below). | **Use this as the core.** It is the only option that covers globe, drill-down, labels and relief in one coordinate system. |
| globe.gl 2.46 (three.js wrapper) | Beautiful chart-style globe: points, arcs, polygons, hex bins, labels, HTML markers, tile engine, atmosphere, bump map. Easy API. | 1.9 MB. No real drill-down: there is no vector-tile text, no state or city level, no terrain beyond a bump image. Picking is per polygon you load. You would rebuild the whole drill-down yourself (what the first draft started doing). | Good for a "story" globe with arcs and hex bins. Not for exploring the world at street level. Could be a second, decorative view later. |
| CesiumJS 1.146 | Best true 3D earth: terrain meshes, imagery, time-dynamic data, flyovers. | 75 MB package, several MB in the browser; Cesium World Terrain and Bing imagery need an ion token (free tier, metered); heavier mental model; 13x less web adoption than MapLibre by one usage index. Studies show MapLibre faster on vector data. | Overkill for an exploration globe. Revisit only if we want photoreal 3D flyovers. |
| deck.gl 9.4 (+ MapLibre) | GPU layers for millions of points, GlobeView. | Adds complexity; MapLibre alone handles our volumes. | Later, if we ever plot tens of thousands of places. |
| three.js + d3 by hand (first draft) | Total control. | Every feature (labels, collision, tiles, terrain, picking at 40,000 districts) is ours to build and maintain. | Discard the draft. |

Supporting libraries: **d3-geo** only for geometry utilities we may need outside the map (bounds, centroids, point-in-polygon for linking saved places to admin areas), **topojson-client** to unpack our pre-built admin polygons, **pmtiles** if we move to a single tile archive later.

## 2. Data inventory

Hosting constraint: Cloudflare Pages allows 25 MB per file and ships whatever is in `assets/`. Anything bigger is either streamed from a free tile server or cut into per-country files at build time.

| Layer | Source | Size and shape | Licence and attribution | How we use it |
|---|---|---|---|---|
| **Basemap: land, water, oceans and seas with names, rivers and lakes with names, mountain peaks, cities, towns, villages, admin boundary lines (levels 2 to 6), roads at depth** | **OpenFreeMap** vector tiles, OpenMapTiles schema v3.16, planet, z0-14. Styles: liberty, bright, positron, dark, fiord, 3d. Also serves Natural Earth II shaded relief raster (`ne2sr`) for the zoomed-out view. | Streamed per tile (tens of KB each). Vector layers: water, water_name, waterway, landcover, landuse, park, boundary, place, mountain_peak, transportation, poi. | Free, no key, no registration, "no limits on map views". Attribution required: "OpenFreeMap © OpenMapTiles, data from OpenStreetMap" (added automatically). ODbL data. Self-hosting offered (weekly planet dumps). | The whole visible world at every zoom: this is what makes oceans, seas, rivers, peaks and cities appear with names without us maintaining any of it. |
| **Relief: hillshade and 3D terrain** | **Mapterhorn** terrain tiles (terrarium-encoded WebP, used by MapLibre's own globe example). Fallback: AWS Terrain Tiles `elevation-tiles-prod/terrarium/{z}/{x}/{y}.png` (84 KB a tile at z4, public, still live). | Streamed per tile. | Mapterhorn: BSD-3 code, open terrain data, attribution "© Mapterhorn" required. AWS tiles: free, attribution to Mapzen and the DEM sources required. | Mountains read as mountains at every zoom; optional 3D exaggeration slider. |
| **Country polygons for hover-fill and click** | world-atlas 50m TopoJSON (Natural Earth) via jsDelivr, ids are ISO numeric; our `_system/site/countries.json` maps them to ISO2/ISO3 and names (249 countries). | countries-50m.json about 0.8 MB. | Public domain. | Globe level: fill highlight on hover, click to drill. |
| **State and province polygons, all countries** | Natural Earth 10m admin-1 (4,596 features, has `iso_3166_2`, `adm0_a3`, `name_en`, `type_en`, `wikidataid`, `gn_id`). The 50m file is 2.3 MB but holds only 294 features (large countries). | 40.7 MB GeoJSON raw; about 4-6 MB as TopoJSON after mapshaper at 10%, or split per country (most under 200 KB). | Public domain. | Level 1 of the drill-down for every country, consistent coding. |
| **Districts and counties (the city level)** | geoBoundaries gbOpen ADM2 per country (API returns a simplified GeoJSON per ISO3). India ADM2 simplified is 7.8 MB raw; Canada ADM1 is 25 MB raw. CGAZ global composites exist but are 360-550 MB each, unusable in a browser. | Per country, after mapshaper at 4%: typically 100 KB to 1.5 MB (India ADM1 went from 5.1 MB to 66 KB at 8%). | CC BY 4.0, attribution "geoBoundaries". Natural Earth admin-2 covers only a few countries (8 MB), so not a substitute. | Level 2 of the drill-down, built lazily: pre-built for a list of priority countries, fetched and simplified in the browser for the rest. |
| **City points with population and importance** | Natural Earth populated places (7,300 points, `scalerank`, capitals) 4.9 MB; GeoNames cities15000 (26,000 cities, 3.4 MB zip) if we want more. | Small. | NE public domain; GeoNames CC BY 4.0. | Not needed for display (OpenFreeMap labels cities), but needed for **search** ("go to Mumbai") and for the drill target list under a state. |
| **Physical names for search: mountain ranges, deserts, plateaus, peninsulas, bays, gulfs** | Natural Earth 10m geography regions (polys 5.6 MB, points), marine polygons, lakes 5 MB, rivers 7.3 MB, glaciated areas 5.9 MB. | Each under 8 MB; thin to names plus centroid or simplified outline for search and hover. | Public domain. | The "explore oceans, seas, ranges" layer: hover a sea or range on the globe and read its name even when zoomed out; search by name. |
| **Whole-earth imagery for the far-out globe** | OpenFreeMap `ne2sr` raster tiles (Natural Earth II shaded relief with water, 130 KB a tile at z2); alternatives hotlinkable from Commons: NASA Blue Marble 2002 (5.3 MB at 4096 px), Large World Topo Map 2 (15 MB). | Tiles stream; a single texture would be 1-5 MB. | Public domain. | The globe looks like the earth from space before vector detail takes over around zoom 2-3. |
| **Country metadata for the side panel** | world-countries npm (already reduced to `countries.json`): names, ISO codes, capital, region, subregion, area, population, languages, currencies, flags. | 1.4 MB full, 20 KB reduced. | CC BY-SA 4.0. | Continent grouping, flags, capital, population in the panel. Later: link to Wikipedia summary API for a paragraph. |

Not chosen: GADM (non-commercial licence, huge), Who's On First (gazetteer too big for a static site), CesiumJS ion assets (token), Protomaps hosted API (key, 1M tiles a month; self-hosted PMTiles is a good future option on R2 if OpenFreeMap ever changes terms).

## 3. The drill model

| Level | What the user sees | Data | Interaction |
|---|---|---|---|
| 0 World | Spinning globe with atmosphere, relief, oceans and seas named, continents, country names by rank. | OpenFreeMap tiles, ne2sr raster, terrain, country polygons (50m) for highlight. | Auto-rotate until touched; drag to spin, scroll to zoom. Hover: country fill highlight, tooltip with name, flag, capital, continent. Click: fly to the country. Hover on a sea or range shows its name from the physical layer. |
| 1 Country | Camera fits the country; globe becomes Mercator-like at this zoom; states and provinces drawn as polygons with soft fills coloured by region; neighbouring countries dimmed. | NE admin-1 for that country (pre-built TopoJSON). | Hover a state: highlight and name. Click: fly to it. Side panel: country facts, list of states with counts of anything we attach later. Breadcrumb World > India. |
| 2 State or province | Camera fits the state; districts drawn; cities and towns, rivers and peaks from the basemap labels take over visually. | geoBoundaries ADM2 for the country (pre-built or fetched). | Hover a district: name. Click: fly to it. Breadcrumb World > India > Maharashtra. Panel: cities in the state (from populated places), area and population if available. |
| 3 District or city | Camera at zoom 9-12; the basemap shows the city, suburbs, water, parks, roads; peaks and rivers named. | Basemap only. | Hover city labels (queryRenderedFeatures on `place`); click a city to centre it. Breadcrumb World > India > Maharashtra > Mumbai Suburban > Mumbai. "Back" at every level, plus a search box that jumps straight to any country, state, city, sea or range. |

Picking at every level uses MapLibre's own `queryRenderedFeatures` and `setFeatureState`, so highlighting 40,000 districts costs nothing at runtime; the polygons are just another GeoJSON source added when the level opens.

## 4. Look, animation and labels

- **Palette**: ocean and sea in the site's deep teal-greens with the relief raster showing bathymetry-like shading; land coloured by **region** (a muted hypsometric scheme: lowland greens, uplands ochre, high ground grey-white from the terrain) rather than flat political colours; political fills only appear as translucent highlights on hover and selection. Continents get a subtle tint by UN region so the globe reads as regions at a glance.
- **Animation**: idle auto-rotate (one turn in about 90 s), eases out on first touch, resumes after 10 s idle; `flyTo` between levels with a 1.2-1.8 s arc that rises then dives (MapLibre does this natively); atmosphere fades as you zoom in (the official example's `atmosphere-blend` interpolation); `prefers-reduced-motion` disables rotation and shortens flights.
- **Labels**: all text comes from the vector tiles with collision detection, so names never overlap; we control density by zoom using the style's existing `place` rank filters; country names in the local script plus English (`name:en` fallback) from OpenMapTiles; a hover tooltip adds flag, capital, population and continent for countries; sea, range and river names come from the basemap at the zooms where they exist and from the physical layer when zoomed out.
- **Panel**: breadcrumb, facts for the current level, the list of children (states of a country, cities of a state), a search box, a terrain exaggeration toggle, style switcher (relief, light, dark). Later this is where saved places and trip links appear.

## 5. Maintenance: how the data stays fresh

| Piece | Where it lives | How it updates |
|---|---|---|
| Basemap, relief, labels | Streamed from OpenFreeMap and Mapterhorn | Nothing to maintain. Pin nothing; attribution block in the page. |
| Library | `maplibre-gl@6.14.0` pinned on unpkg (or vendored into `globe/assets/` for stability, 1 MB) | Bump deliberately; test globe + terrain after each bump. |
| Admin polygons | `globe/assets/admin/<ISO3>-ADM1.json`, `<ISO3>-ADM2.json` TopoJSON, built by `_system/tools/globe_data.py` from Natural Earth (ADM1) and geoBoundaries (ADM2) with mapshaper; a manifest `globe/assets/admin/index.json` lists what is pre-built | One command refreshes everything; raw downloads cached and gitignored; outputs committed (each well under the 25 MB limit). ADM2 pre-built for a priority list (Canada, US, India, Italy, France, Vietnam, Argentina, Chile, Switzerland, Norway, Iceland, Peru, Costa Rica, Mexico, Spain, Portugal, UK, Japan, New Zealand, Australia); everything else fetched live from geoBoundaries on first click, with a size warning. |
| Gazetteer for search | `globe/assets/gazetteer.json`: countries, admin-1 names and centroids, populated places (NE), physical features (NE) | Same build command; about 2-3 MB; loaded once. |
| Country facts | `_system/site/countries.json` (expanded with capital, population, region, flag) | Same build command from world-countries. |
| Tests | `_system/tests/test_globe_data.py`: manifest consistent, every ADM file valid TopoJSON, feature counts sane, no file over 20 MB, gazetteer ids unique | Run before publish by the pre-publish gate. |

## 6. Build phases

| Phase | Deliverable | Acceptance |
|---|---|---|
| G1 Globe | `globe/index.html` on MapLibre 6.14: globe projection, OpenFreeMap liberty restyled to the house palette, Mapterhorn hillshade and terrain, atmosphere, auto-rotate, country hover highlight and tooltip with flag and capital, click flies to the country. | Smooth at 60 fps on a laptop; oceans, seas, rivers, peaks and cities labelled as you zoom; screenshots at 3 zooms reviewed. |
| G2 Drill | `globe_data.py` builds ADM1 for all countries and ADM2 for the priority list plus the manifest; the page adds levels 1-3 with breadcrumb, panel, back, hash deep-links (`#c=IN&s=Maharashtra`). | Drill World > India > Maharashtra > Mumbai Suburban works; a country without pre-built ADM2 still drills live. |
| G3 Search and physical names | Gazetteer build; search box jumps to countries, states, cities, seas, ranges, rivers; hover names for seas and ranges at globe zoom. | "Sahara", "Bay of Bengal", "Mumbai", "Quebec" all resolve. |
| G4 Polish | Style switcher, terrain exaggeration, reduced-motion, mobile layout, attribution, tests, pre-publish gate, hub link. | Lighthouse performance and accessibility pass; works on a phone. |
| G5 Link our data | Done, unpublished until visual QA | Saved places are pins on the globe (`globe/assets/data/places.json`, built by `locations.py build` or `globe_data.py places`). Counts per country, state and district roll up from the pins. Clicking a pin opens a card with the place's facts, and Plan these starts a trip from the places in the current view. Known problem (R1): the Italy ADM2 data has inverted districts, so a district count or highlight there can land on the wrong shape; it needs a data fix before Italy drill-downs are trusted. |

## 7. Decisions needed

1. **Stack**: MapLibre GL JS as recommended, or do you want to see a globe.gl prototype beside it first?
2. **Terrain source**: Mapterhorn (what MapLibre's own example uses, attribution only) with AWS tiles as fallback. Agree?
3. **ADM2 priority list**: the twenty countries above, or a different set?
4. **Vendor the library** into `globe/assets/` (stable, 1 MB in the repo) or load from unpkg?

## 8. Status (17 Oct 2026)

| Phase | State | Notes |
|---|---|---|
| G1 Globe | Done, live | MapLibre 6.14 vendored (`globe/assets/vendor/`), OpenFreeMap liberty, Mapterhorn hillshade and terrain with AWS fallback, country hover and fly-in. |
| G2 Drill | Done, live | Decision changed from the twenty-country list to **all countries**: ADM1 for 251 (Natural Earth, 2.6 MB), ADM2 for all 180 geoBoundaries has (49,308 districts, 18 MB). Manifest `globe/assets/admin/index.json`; build `globe_data.py admin1`, `admin2 ALL`. |
| G3 Search | Done, live | 13,741-name gazetteer; a city drills to its country, state and containing district. |
| G4 Polish | Done | Style switcher (relief, light, dark) that restores the selection after a restyle, terrain only from zoom 3.5 with a strength slider (this also removes the globe-level shading seams), hillshade strength by zoom, preferences in localStorage, 7 offline tests in `_system/tests/test_globe_data.py`, pre-publish gate hook (`_system/tools/hooks/prepublish.sh`). |
| G5 Link our data | Next | Saved places on the globe with counts per level and "plan this". |

Operational notes: headless Chromium here never renders the OpenFreeMap vector tiles (raster and our polygons do render), so visual QA is done in a real browser; Playwright probes must stay short (a long one hung the MCP server for 30 minutes). REST Countries v3 is deprecated; population comes from a Wikidata SPARQL query at build time.

## 9. What happened to the first draft

`_system/site/globe.html`, `locations.html`, `site.css` and `_system/tools/site_pages.py` were written before this brief changed. `globe.html` was replaced in G1. The `locations.html` draft became the template for the published list page: `location_views.py` renders `locations/index.html` from it, with the globe and the list linking to each other.
