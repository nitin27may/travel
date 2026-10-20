# Owner testing round 1: the fix plan (20 Oct 2026)

Every item the owner reported while testing the preview, with its cause, the fix, the lane, the files, the effort, how we know it is fixed, what it depends on, and the order. Backlog rows are the source of truth for status; this file is the plan. Nothing here is started. The owner decides what goes before his review and what goes after.

## 1. The items

| # | Row | What the owner reported | Cause (confirmed unless marked) | Fix | Acceptance check |
|---|---|---|---|---|---|
| 1 | 9.1 | Clicking the home search button opens a clipped panel | **Confirmed by repro.** The hero button opens the dialog anchored to the button; at 1100 px and wider its left edge is at x = -161, cut off and overlapping the hero card. The header button is fine | Anchor the panel to the viewport and header, never to the clicked button; clamp inside the viewport | e2e opens it from both buttons at 1000, 1100, 1440 and 1920 px and asserts the whole panel is inside the viewport |
| 2 | 9.2 | Home globe: blank background, washed-out water | Flat grey page, pale water tokens, few labels | Opus design note and mock: sky or space background that works in light and dark, richer ocean colour, more labels at rest, no green; then build | Mock approved; contrast AA in both themes; shots read at 1440 and 390 |
| 3 | 9.3 | A city is not highlighted on the globe, a state is | **To confirm.** City outlines were only prebuilt for cities with our content; others fall back to a ring | Build city boundary polygons for the cities in the towns layer (8.4), simplified, sharded per country (P8: geometry is not the catalogue); honest fallback only where OSM has no polygon | Pick 10 cities from search (Whitby, Banff, Calgary, Quebec City...): each shows an outline or the stated fallback; size and build time inside budget |
| 4 | 9.4 | Picking a river draws a state outline | **Confirmed.** A river has no area polygon, so the framing falls back to the parent region | Line features draw their own line (OSM waterway, simplified) or nothing, and fly to fit it | Ganges, Danube, Nile each draw a line, never a state |
| 5 | 9.7 | "Fly here" does nothing on feature cards | **Confirmed by repro.** Landform pick leaves the camera at world scale; the point is wrong (Ganges Plain at 86.95 E 19.37 N); Fly here has no effect | Every feature class gets a fit (point, line, area), the card sits on it, Fly here animates and writes the camera to the URL; audit every landform centre against its bounding box | e2e picks a river, plain, delta, lake and range and asserts the camera ends inside the feature's box |
| 6 | 9.8 | Option to switch off river selection | Request | "Natural features" switch in Map options, carried in the URL (`nf=0`), no storage; results grouped Places and cities first, features last | e2e: off removes features from search and map picking; the link keeps it |
| 7 | 8.1 | Filter by country, state and city, not only country | **Confirmed.** Places shows only a Country pill; the hierarchy and URL keys exist in data | Cascading Where control with counts: country, state or province, city (and area); phone behaviour per the lists note | Alberta lists every Alberta place; the URL round-trips; counts match; works on phone |
| 8 | 8.2, 8.4 | Show nearby places; "near Whitby" includes Oshawa and Ajax; day trips | Needs the points and the towns layer | Nearby section on place pages; "near <place or city>" mode with radius in the list; towns and cities layer from our gazetteer | Moraine Lake lists Lake Louise and others by distance; "near Whitby" includes Oshawa and Ajax; no whole-catalogue file |
| 9 | 8.3 | Every record must map to country, state, city and carry a GPS point | Not enforced today: 62 place pages and 47 trails have no point; several records lack `area_id` | Capture-contract placement rule, validator, gap report, researcher checklist | Gap report shows 0 unknown for new records; check-all enforces it |
| 10 | 9.5 | Trip map is not Google Maps | It is MapLibre by earlier decision; owner prefers Google | Q51: Google Maps JS on the trip route map, MapLibre kept for the globe; solid routed legs from ORS geometry, estimates dashed and labelled; pins numbered in day order | Map shows roads and names; day change fits the day; legend is true; one map family on the page |
| 11 | 9.6 | No export of the whole trip | Export exists but is hidden | Visible "Export trip" in the plan bar and page top: print/PDF, calendar for a dated copy, CSV, KML or GPX; includes gaps honestly; honours the chosen profile | Each format opens correctly; no household data; gaps shown as "Not checked yet" |
| 12 | 8.5, 8.6 | Smart trip: choose a destination, ask what is nearby for 7 or 8 days, pick by distance | Product idea | The planner product; spec by the Opus planner (running) | Spec approved; build after go-live |
| 13 | 10.1 | Trail pages need length, elevation and other properties | The contract defines them; pages do not show them | Key-facts strip from the contract (length, gain and loss, high point, time, route type, effort, surface, hazards, dogs, stroller, wheelchair, season, trailhead, route status) | Fenland Loop shows every slot, with "Not checked yet" for gaps |
| 14 | 10.2 | Proper trail data | About 41 of 128 have time; 12 have a profile | Trail gap report, then fill (needs the owner's go: research is paused) | Gap report; later: counts rise |
| 15 | 10.3 | AllTrails link for each trail | Mostly a "not checked" tab | Link on every trail: direct where supplied, else a labelled "Search AllTrails" link; never fetched | Every trail page has the link; opens in a new tab |
| 16 | 10.4 | One or two images per trail | About 6 of 128 have an image | Commons (sequential, credited), owner photos, official only where licensed; honest where none | Credits shown; no parallel Commons requests |
| 17 | 10.5 | Missing map points on trails | 47 trails have no point | Fill from OSM and Wikidata (research) | 0 trails without a point |

## 2. Lanes and files (disjoint)

| Lane | Items | Owns | Effort | Review |
|---|---|---|---|---|
| FIXF | 1 | `web/components/search/**` (the dialog), `web/components/shell/**`, `web/components/home/CoverSearch.tsx` | 2 h | verifier |
| GLB2 | 2, 3, 4, 5, 6 | `web/components/globe/**`, `web/lib/globe/**`, `web/app/globe*/**`, `tools/globe_data.py`, globe styles, the home cover globe | 18 h | Opus design note first (item 2), Opus after |
| PLC2 | 13, 15, 8.2 Nearby section on place pages | `web/components/places/**`, `web/components/suit/**`, `web/lib/public/{places,sections,seeds}.ts` | 10 h | after |
| LST2 | 7, 8 list part, 8.4 | `web/lib/client/data.ts`, `web/lib/entities/**`, `web/components/entity/**`, `web/lib/search/**`, list shards, towns layer files | 20 h | before (design note) and after |
| TRP2 | 10, 11 | `web/components/trips/**`, trip map, export code, `web/lib/export/**` | 16 h | before (map family note) and after |
| DATA | 9, 14, 16, 17 | `data/**`, capture contract, `docs/v2/research/**` | per batch | Sonnet verifier |
| PLAN | 12 | docs only | spec running | owner |

Shared files rule as in the stage 4 plan: `types.ts` additive blocks, coordinator edits BACKLOG and STATUS.

## 3. Order and dependencies

1. **FIXF first.** Small, clearly a bug, no dependency. Suggested before the owner's review.
2. **GLB2 part A**: Fly here, river lines, natural-features switch (items 4, 5, 6). They share one fit model. Suggested before the review if the owner wants the globe tidy.
3. **Towns layer (8.4) and the data rule (8.3)** before anything that uses them: city outlines (3), the Where filter's city level (7), Nearby (8).
4. **LST2 and PLC2 in parallel** after the planner's spec: Where filter, near mode, Nearby section, trail facts strip, AllTrails links.
5. **GLB2 part B**: city outlines, home look (items 2, 3) after the towns layer and the design note.
6. **TRP2** after Q51: Google trip map and the Export trip.
7. **DATA** batches when the owner unpauses research: gap report first, then points (17), then photos (16), then trail facts (14).
8. **PLAN item 12**: the planner product starts after go-live.

## 4. Decisions needed from the owner

| ID | Decision | Recommendation |
|---|---|---|
| Q51 | Google Maps on the trip route map, MapLibre kept for the globe | Yes |
| Q52 | Natural features default on or off once fixed | On, with the switch |
| Q53 | AllTrails: paste direct links, or search links for now | Search links for all, direct links added as supplied |
| Q50, Q54-Q62 | Where filter, nearby, towns layer, planner phasing | See `features/nearby-and-regions.md` section 8: Q50 Whitby in the public towns layer, Q54 launch scope, Q55 GeoNames towns, Q56 radius, Q57 drive-time bands, Q58 open-data points pass, Q59 guest drafts, Q60 unresearched places signed-in only, Q61 province on Trips, Q62 the `city=` key |
| Research | Unpause data research for trails and points (items 14, 16, 17) | Yes, but only the trail gap report and points first |
| Scope | Which items go before his review and which after | FIXF and GLB2 part A before; the rest after go-live except 7 and 13 if he wants them |

## 5. What stays true

No green, non-modal overlays, smooth motion, P8 and P9, no household data, a gap is never a yes, AllTrails and similar sites are links only, Commons and OSM calls sequential with the no-email user agent, kill servers by PID, Arc GPU flags for visual checks, never Fable.

## 6. Change log

| Date | Change |
|---|---|
| 2026-10-20 | First version |
| 2026-10-20 | Planner spec landed (nearby-and-regions.md): audit numbers, phases N0-N3 and P1, questions Q50 and Q54-Q62 |
