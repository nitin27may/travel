# To do: owner requests not yet built (running list)

Newest first. Each line links to where it is specified. Move a line to "Done" with the commit when it ships.

## Open

| Added | Item | Spec |
|---|---|---|
| 2026-10-18 | **Public trips are dateless templates.** Every public trip shows Day 1-N, its length and a season window; date-bound details become relative (booking rules, a long weekend in mid-October, observed-in-2026, weekday checks, sun-time ranges). Dates attach only when a trip is copied into an account and a start date is picked. | [design/public-trips-dateless.md](design/public-trips-dateless.md) |
| 2026-10-18 | **Map stack decided** (hybrid: MapLibre for globe/trip/planner, Google on place pages, Maps URLs for directions, ORS for legs); owner to create Google Cloud project, restricted key, daily cap, ORS key, R2 bucket | [research/map-stack-2026-10-18.md](research/map-stack-2026-10-18.md) |
| 2026-10-18 | Public site L0: foundation in code (tokens to CSS, fonts, base components, public header, routes, contract stubs, screenshot harness). Wave 1, lands first | [build/public-site/L0-foundation.md](build/public-site/L0-foundation.md) |
| 2026-10-18 | Public site LD: read-only data adapter (trips by depth, places of every kind, photos with credits, kind to category, completeness, redirects). Wave 1 | [build/public-site/LD-data-adapter.md](build/public-site/LD-data-adapter.md) |
| 2026-10-18 | Public site LM: map adapter (MapLibre default, Google JS and Embed behind a flag, one family per page, directions links). Wave 1 | [build/public-site/LM-map-adapter.md](build/public-site/LM-map-adapter.md) |
| 2026-10-18 | Public site L1: home and inspiration, global search. Wave 2 | [build/public-site/L1-home.md](build/public-site/L1-home.md) |
| 2026-10-18 | Public site L2: full-screen globe ported from legacy/globe. Wave 2 | [build/public-site/L2-globe.md](build/public-site/L2-globe.md) |
| 2026-10-18 | Public site L3: trips search and the categorised, chronological trip page. Wave 2 | [build/public-site/L3-trips.md](build/public-site/L3-trips.md) |
| 2026-10-18 | Public site L4: places search and place/trail pages. Wave 2 | [build/public-site/L4-places.md](build/public-site/L4-places.md) |
| 2026-10-18 | Public site L5: copy, export (PDF, ICS, GPX/KML, CSV) and share. Wave 2 | [build/public-site/L5-copy-export-share.md](build/public-site/L5-copy-export-share.md) |
| 2026-10-18 | Public site gates: verifier per lane, integration sweep, Fable design review, fixes, tunnel preview; owner decides which trips are public (7 of 14 are private) and approves go-live | [build/public-site/README.md](build/public-site/README.md) sections 6 and 7 |
| 2026-10-18 | **Trail data for a person to confirm.** Braies P1 lot (inferred from a bus stop); the Monte Piana trailhead node; the OSM routes for Fanes, Seceda and Nuvolau; the Viel dal Pan and Siusi figures; Lago d'Antorno is about 500 m off in places.ts | prototype/src/data/trails.ts |
| 2026-10-18 | Enforce per-kind completeness (validator, badge, skill, MCP) | [research/kinds/README.md](research/kinds/README.md) |
| 2026-10-18 | **Next round, starting after the current tasks finish (owner direction).** Step 1 is the public read-only site first: no login; trip, place and globe search; a full-screen globe with better animation; a categorised, chronological trip detail page; copy and export. Step 2 is a new end-to-end colour palette (no green). Step 3 is the map stack chosen for look, distance and directions within free tiers (Google included). Then the signed-in planner, then the schema and backend. | [design/product-direction-2026-10-18.md](design/product-direction-2026-10-18.md); build plan for step 1: [build/public-site/README.md](build/public-site/README.md) (built in `web/`, lanes L0, LD, LM, then L1 to L5, then the gates) |
| 2026-10-18 | **Keep what works on the live site.** Trips and Places keep photo cards, filter pills, group/sort, the Cards/List/Table/Map views, the table tools (saved views, columns, density, CSV) and the honesty markers. The globe keeps 3D relief, styles, terrain, drill-down and saved places. One redesign direction evolves the live look. | [design/keep-from-live-site.md](design/keep-from-live-site.md) |
| 2026-10-18 | **Year calendar: school calendar.** Covers the school year from and to, March break, winter break and PA days, entered once or pasted from the board's calendar, and per school when there are two. It also shades weekends, highlights long weekends (including ones made by PA days), lets the household add its own holidays and days off, has a "Find time" list of free windows, and uses the same shading in every date picker. | [F03](features/F03-candidates-and-travel-year.md), section "School calendar, weekends and holidays" |
| 2026-10-18 | Apply the chosen redesign direction to the prototype, then re-verify on desktop and phone, light and dark | `design/redesign/` |
| 2026-10-18 | Person-level items shared across trips (passport renewal as a linked check in every trip that needs it) | [design/trip-scope-scenarios.md](design/trip-scope-scenarios.md), rule 6 |
| 2026-10-18 | Bookings Wallet view still uses old sample cards; base it on the stored bookings | F08 |
| 2026-10-18 | Explore map: pin labels overlap where places cluster; needs label collision handling | F15 |
| 2026-10-18 | Trip and template cards need real photos, not placeholder patterns | redesign |

## Done

| Date | Item | Commit |
|---|---|---|
| 2026-10-18 | **All 14 trips are public** (owner): the 7 private flags are removed from legacy/MANIFEST.json, reversing b06fb01. Household data inside trip plans (names, ages, booking codes, costs, phones) still stays out of the public site through LD's allow-list. | (this commit) |
| 2026-10-18 | Trailhead and parking coordinates from OpenStreetMap for 18 trails, with the full link checklist (133 links checked) and Google/Apple Maps buttons. Lift-start trails send Directions to the valley car park; fee disagreements are shown as conflicts. | 0673ca9 |
| 2026-10-18 | Per-kind research profiles (15 kinds, Draft/Usable/Complete checks, enforcement design) | 236a874, 34f2c7e, ca086e6 |
| 2026-10-18 | Fable design foundation (tokens, components, patterns, specimen) and the scenario-check gate: Go for the public site | 74314f2, fb904a8, 47d4059 |
| 2026-10-18 | Project agents with per-task models, and the rule that the plan and TODO are cross-checked before work and updated after | c534d21 |
| 2026-10-18 | **Design direction chosen: C, Trailhead.** It keeps the live site's structure, cards, filters, four views, table tools and type, with no green: stone paper, slate ink, a navy header with an amber rule. It borrows Atlas's full-bleed photo covers and Altimeter's ⌘K trip switcher. | 271e014 |
| 2026-10-18 | Trip as a container: header with tabs, rail grouped under the trip, picker and switcher | 978ae6d, 183edaa |
| 2026-10-18 | Drag and drop rebuilt around a visible handle with an insertion line | 70f04bb |
| 2026-10-18 | Map shows all days by default and is filtered to one day when picked; real basemap | 70f04bb, c7fdd98 |
| 2026-10-18 | Trips views (cards, list, table with advanced search), Discover and public trip pages | 079f7ba |
| 2026-10-18 | Bookings with full details, shared through the trip store | 060fa93, 6059822 |
| 2026-10-18 | Trail details and links on the place page | b86e1e9 |
