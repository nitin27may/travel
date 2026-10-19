# Stage 2 integration sweep (backlog 2.15, 2.16)

Verifier: travel-verifier. Date: 2026-10-18. Tested commit: 992dc5a on claude/serene-goldberg-wtn3di (the branch has since moved to 88edf08; nothing newer was tested). Throwaway worktree /tmp/sweep, removed at the end. Read-only: no product code was changed. The one exception is a throwaway edit used only for the 10,000-place build (section 6), never committed.

Machine note: not fully quiet. Other agents' dev servers (v2-L4 `next dev`, `next start` on :3100) were running, load average about 4 on 20 cores.

## 1. Gates

| Check | Result | Evidence |
|---|---|---|
| `bash tools/check-all.sh` | pass | "CHECK-ALL OK". python 166 passed 1 skipped; core vitest 1164 passed (52 files); web vitest 486 passed (60 files); typecheck, lint, build all clean, no `Error:` line in the build |
| Full e2e, 4 projects, once | pass | 228 passed, 14 skipped, 0 failed, 8.7 min. chromium 192, webkit-iphone 12, webkit-desktop 12, firefox 12 |
| Flake | none seen | No retries are configured, so a flake would have shown as a failure. The 14 skips are the opt-in screenshot specs (`trips.shots` needs TRIPS_SHOT_URL, `globe.shots` needs GLOBE_SHOTS) |

## 2. Lighthouse (lighthouse via npx in /tmp/lh, Playwright Chromium 1248, web/out served gzip on :3440)

Mobile = default throttling. Desktop = `--preset=desktop`. Chrome's software GL makes the map pages meaningless for TBT (home mobile TBT 166 s, globe 11 s), so home, trip, place, trail and globe are reported on the GPU flags (`--use-gl=angle --use-angle=gl --ignore-gpu-blocklist --enable-gpu-rasterization`). Trips and Places have no map on first load, so their default run is used.

| Page | Profile | Perf | A11y | BP | SEO | FCP | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|---|---|
| home | mobile | 50 | 100 | 73 | 100 | 1.5 s | 16.0 s | 1,220 ms | 0.015 |
| home | desktop | 76 | 100 | 73 | 100 | 0.4 s | 5.6 s | 80 ms | 0.005 |
| /trips/ | mobile | 71 | 100 | 73 | 100 | 1.2 s | 5.6 s | 80 ms | 0.181 |
| /trips/ | desktop | 96 | 100 | 73 | 100 | 0.3 s | 1.4 s | 0 | 0 |
| trip (dolomites-2027) | mobile | 61 | 100 | 73 | 100 | 1.4 s | 8.0 s | 550 ms | 0 |
| trip | desktop | 95 | 100 | 73 | 100 | 0.4 s | 1.5 s | 20 ms | 0 |
| /places/ | mobile | 71 | 100 | 73 | 100 | 1.4 s | 5.3 s | 90 ms | 0.187 |
| /places/ | desktop | 94 | 100 | 73 | 100 | 0.4 s | 1.6 s | 0 | 0 |
| place (lago-di-braies) | mobile | 72 | 100 | 96 | 100 | 2.0 s | 3.3 s | 760 ms | 0 |
| place | desktop | 100 | 100 | 96 | 100 | 0.4 s | 0.7 s | 50 ms | 0 |
| trail (tre-cime-di-lavaredo-loop) | mobile | 72 | 100 | 96 | 100 | 2.0 s | 3.3 s | 780 ms | 0 |
| trail | desktop | 100 | 100 | 96 | 100 | 0.4 s | 0.7 s | 40 ms | 0 |
| /globe/ | mobile | 63 | 96 | 96 | 100 | 1.4 s | 3.1 s | 2,830 ms | 0.005 |
| /globe/ | desktop | 90 | 96 | 96 | 100 | 0.4 s | 0.6 s | 260 ms | 0 |

Home first paint (target 1.5 s): FCP reads 1.5 s on mobile, on the line, no headroom. Desktop 0.4 s. The real home problem is LCP, not FCP.

Top 3 per page (Lighthouse's own "opportunities" list only ever shows unused JS and CSS, so these are drawn from its insights):

- **home**: (1) the LCP element is a trip card image, `loading="lazy"`, hot-linked from commons.wikimedia.org through a redirect (Special:FilePath to thumb.wikimedia.org), no priority hint, and the first request loads a 1920 px, 773 KB thumbnail into a 313 px card; page weighs 6.1 MB on mobile. (2) Map and app JS: 164 KB unused, a 504 KB maplibre chunk, 14 s of main-thread boot on software GL, TBT 1.2 s on the GPU. (3) Three render-blocking CSS files, about 300 ms; Wikimedia images carry cache lifetime 0 and third-party cookies (WMF-Uniq), which is the whole of the Best Practices 73.
- **/trips/**: (1) LCP card image is lazy and hot-linked (5.6 s mobile); 1.5 MB of Wikimedia thumbnails on first load. (2) CLS 0.18 from `section.results` re-flowing after hydration. (3) Render-blocking CSS, 150 to 300 ms.
- **trip**: (1) 171 KB unused JS (map), 1.2 s mobile; TBT 550 ms. (2) Hero cover has `fetchpriority=high` (good) but is a hot-linked 1920 px thumbnail, 234 KB; LCP still 8.0 s mobile because of the Commons redirect chain. (3) 100 requests and 3.6 MB; gallery tiles fail `label-content-name-mismatch` (visible text vs aria-label "Open photo 1 of 22: ...").
- **/places/**: same as trips: lazy hot-linked LCP image 5.3 s, CLS 0.19, render-blocking CSS.
- **place and trail**: (1) 165 to 168 KB unused JS from the map, TBT about 770 ms mobile. (2) FCP 2.0 s on mobile although the LCP is text, so something blocks first paint (CSS plus fonts chain, see the network-dependency tree). (3) Third-party OpenFreeMap sprite and glyph requests (225 KB) on load.
- **/globe/**: (1) TBT 2.8 s mobile (map style, terrain, clustering on the main thread). (2) 7.3 MB and 134 requests, 3.2 MB of it tiles. (3) Two pins fail target-size (28 px pins partly obscured, 1.5 px visible), which is why A11y is 96.

Every page also logs one console error: `/favicon.ico` returns 404 (no favicon in web/out). That counts against Best Practices on all pages.

Also fix-worthy and not in the scores: the CLS on Trips and Places (0.18) is above the 0.1 good threshold.

## 3. Privacy grep of web/out (excluding globe/admin boundary files, _next and og)

| Check | Result |
|---|---|
| Whitby, or a point within 2 km of 43.88,-78.94 | No hit. Numeric scan of every pair of numbers in html, json, txt, xml: none within 2 km. Only near hit: `globe/data/gazetteer.json` lists the world city "Oshawa" at -78.85,43.88, 7.6 km away, a generic gazetteer row. |
| Whitby in what the new site links to | **Hit (outside web/out but one click away):** legacy pages quebec-sept-2026, new-hampshire-stopover-2026, niagara-day-aug-2026, vermont-fall-2026, algonquin-muskoka-oct-2026 contain "Whitby". The new trip pages link to them ("Read the full plan" / "Read the original plan"). |
| Household wording | **Hits.** `trips/canadian-rockies-2029/index.html` (and its .txt payloads): "a child around 6", "the child", "a 6-year-old pays the child fare", "the other adult and the child", "keep the child within arm's reach", "whole family", "a family of 3", "2 adults plus 2 children", "not for the child" (many occurrences, in day notes and track text). `index.html` (home trip card): "Every day has an adults' hike, a family hike and a shorter option for a child around 6." Trip name **"Patagonia with kids 11+"** appears in 232 files (page title, og:title, trips list, search shard trip-ar, every globe pin payload). `trips/patagonia-2027/index.html`: "Age 8 to 65" (an activity limit, fine). The About page says "Never published: traveller ages...", which the Rockies page contradicts. |
| Status words (Planned, Shortlisted, Visited, Dropped) | No hit. |
| Stay ideas, booking codes | No booking codes, confirmations or "stay idea" text. One stay-kind stop: `trips/iceland-ring-road-2027` day 1 "Campsite Reykjavik" (kind "stay", generic). Bases are towns only. |
| Calendar dates in public trip text | None in trip prose. Only operating seasons ("1 May - 31 Oct") and "Researched 18 Oct 2026" / "read Aug 2026" provenance lines on place pages (18+ files). |
| "Planned as" | No hit. |
| Trip folder names with dates | Hits as link targets only: `/quebec-sept-2026/`, `/niagara-day-aug-2026/`, `/costa-rica-feb-2027/`, `/patagonia-feb-mar-2027/`, `/chamonix-mont-blanc-sept-2028/`, `/canadian-rockies-sept-2029/`, `/algonquin-muskoka-oct-2026/` in `trips/<slug>/index.html` (button href plus `legacyUrl` field). Not in prose. |
| Link-only platform ratings | No "stars", "reviews", "rating" or "Tripadvisor" text. `AllTrails (link only)` label links to alltrails.com on 18 place pages, and `AllTrails: <trail name>` links on some; labels only, no scores. |
| Email addresses | None. |

## 4. P8 check

- **No whole-catalogue file.** No `places.json`, `trips.json` or `export-data/` anywhere in web/out. The largest data files are the globe boundary and gazetteer files (world geography, not our catalogue).
- **Requests to collect every fact:** about 122. One request for `sitemap.xml` (125 URLs: 107 places, 15 trips, home, /about/data/, /globe), then 106 place pages plus 14 trip pages (about 15 MB + 4 MB). Each page also has duplicate `index.txt` and `__next._full.txt` copies. At one request per second this is two minutes with no throttling. The robots.txt is `Allow: /` with no AI-crawler block, and there is no terms page (only /about/data/, whose "Our own words" card says "not licensed for reuse"). This matches the P8 honest-limit text; the edge rule and a terms page are still to do before go-live.
- **Search index:** 30 shards under `search/<kind>-<country>/data.json` plus `manifest.json`, 88 KB in total, records carry `k, h, n, s, x, kind` only: names, kind and area. All names are collectable in about 31 requests, as designed.
- **List-row allowlist holds in the built payload.** `/places/index.html` embeds 106 rows, all with one identical key set equal to `PLACE_ROW_KEYS` in `web/tests/data/light-data.test.ts`; honesty items are `{id,label}`, completeness `{label,level}`, trips `{slug,title}`. The trips list rows carry `ageFit, approx, country, countryName, cover, days, depth, effort, firstBase, id, isDone, lat, lon, nights, region, seasonLabel, seasonMonths, seasonNotSet, slug, title` (matches TRIP_LIST_KEYS).
- Note: every `globe/place/*`, `globe/trip/*` and `globe/<path>` page embeds the pin list; see section 6 for what that costs at scale.

## 5. Sweep on the Arc GPU

Chromium 1248 with the GPU flags, 2x, light and dark, 1440 and 390. 84 shots in `/tmp/sweep-report/shots/` named `<scene>-<width>-<theme>.png` (full-page scenes were scrolled first so lazy images load; shots were halved to 1440 px or 780 px wide to keep the folder small). Contact sheets in `shots/sheets/`, tiles in `shots/tiles/`. Scenes: home, trips (cards, list, table, map), three trip pages (Dolomites, Rockies, Vermont done-trip), places (cards, table, map, more filters), Braies, Tre Cime, globe (world, /globe/it/, sea hit "Black Sea", place hit "Seceda"), about (/about/data/), 404. Raw run log: `sweep.log`. No page error and no horizontal overflow at any size; only console noise is the favicon 404 and 404s from the globe's `/globe/it/` tile requests.

I read the 1440 light shots of every scene, 390 light contact sheets of every scene, 390 dark sheets of trips, places, globe and home, and 1440 dark for places and the Italy globe. Dark mode held up everywhere I read it (contrast fine, no light-mode leftovers). Peak hit: the gazetteer holds no peaks, so a "peak" search ("Seceda") opens the place page, not a globe marker; the sea hit does place a named marker.

### Defects, ranked

**Broken**
1. Vermont done-trip route map frames Europe (Netherlands, Germany, Italy, Turkey) with no stops: "8 stops have no map position yet" leaves nothing to fit. `shots/tiles/trip-vermont-done-1440-light-t00.png` and `-t01.png`. The Rockies page reports 78 stops with no map position. The map for a trip with unpositioned stops must fall back to the base towns or hide.
2. `/about/` is a 404 (the page is `/about/data/`), and the 404 page offers Trips, Places, Globe and Search but no About link. `shots/about-1440-light.png` is the real page; the first pass of `about-*` shots at /about/ is overwritten.
3. Privacy content (section 3): child's age and party size published on the Rockies page and home card; "Patagonia with kids 11+" in the trip title everywhere.

**Wrong**
4. Home LCP 16 s mobile and 5.6 s desktop, 6.1 MB home page: hot-linked Wikimedia images (redirect chain, 1920 px thumbnail for a 313 px card, lazy on the LCP image). Not a layout bug but the largest performance gap against the 1.5 s first-paint intent.
5. Places table clips content at the right edge: the Kids column reads "Easy with kid", "Older or stron"; cells carry an inline label ("Length 13.7...", "Climb 480 m") and truncate it. No scroll cue. `shots/places-table-1440-light.png`. On 390 the table shows only Name and Kind (and Trips only Trip and Nights); other columns are off-screen. `shots/sheets/m-places-light.png`, `m-trips-light.png`.
6. Trips map clusters sit at their centroid away from the pins: the "2" in Hudson Bay and the "3" in the US midwest where no trip is. `shots/trips-map-1440-light.png`. Trips map also opens on the whole world rather than fitting the pins.
7. CLS 0.18 to 0.19 on Trips and Places on mobile (results section re-flows after hydration).
8. Globe cluster pins cover country labels and each other: "29" and "26" overlap on the world view, "Kingd" and "Arge" are cut by pins, Europe pin stack "3/52". `shots/globe-world-1440-light.png`, `shots/sheets/m-globe-light.png`, dark the same. In the Dolomites at /globe/it/ the "16" pin sits on two others.
9. Globe Style panel is translucent and the map labels show through it ("Malta", "Annaba", "Setif", "Constantine" in light, dark and mobile). `shots/globe-sea-hit-1440-light.png`, `globe-italy-1440-dark.png`.
10. Day-row thumbnails repeat one photo (days 5, 7 and 8 on the Dolomites page show the same Cortina panorama; 9 and 10 the same Sass Pordoi shot) and days 13 and 14 show a bare placeholder. `shots/tiles/dolo-rescroll-a.png`.
11. `/favicon.ico` 404 on every page.
12. Two globe pins fail the 24 px target-size check (28 px pin with 1.5 px visible), Lighthouse.
13. Gallery tiles: aria-label "Open photo 1 of 22: ..." does not contain the visible text (`label-content-name-mismatch`).
14. Photo credits print raw Commons descriptions ("Dolomites, 13 nights . This Photo was taken by Wolfgang Moroder . CC BY-SA 3.0"). `shots/tiles/trip-dolomites-1440-light-t04.png`.

**Rough**
15. Place page repeats the same facts three times (trailhead cards, then the facts list: Fee, Parking, Lot, What all say P4 EUR 44). Directions panel text "the car park we stored" / "the pin we stored" reads like database talk. `shots/tiles/place-braies-1440-light-t00.png`, `-t01.png`.
16. Map pin cluster "3" sits on the trailhead pin and its label on the Braies map.
17. Card grids have ragged row heights (Trips and Places) and a footer line "No source yet  Draft  Place page  Globe" on most places, which is heavy for a glance. 5 or more place cards have only a kind placeholder instead of a photo.
18. Trip route maps draw dashed straight lines across the Dolomites map; busy but honest ("straight estimates").
19. Mobile bottom nav spends one of four slots on Sign in (public site has no login today).
20. Home on 390 puts the globe above the search card; the first screen has no heading.

### First-use walk (P4): family-friendly lake hike in Canada, then directions to its car park

Steps taken with no prior knowledge, 1440 wide: home, then the search box, then Places, then the Country, Kind and Kids pills. Shots `walk-1-home.png`, `walk-3-kind.png`, `walk-5-kids.png`, `walk-6-results.png`, `walk-7-lake-louise.png`, `walk-8-lake-louise-full.png`, `walk-9-search.png`.

Hesitation points:
1. The home hero is a search box: typing "family lake hike canada" returns "No trip or place matches" and offers "Search canada instead (40 matches)". The honest empty state is good, but a plain-words query finds nothing; the visitor has to guess that the box matches names only.
2. Trips, Places or Globe: the home page does not say which one answers "a lake hike". The nav is the only cue.
3. Country, Kind and Kids are pills that open check lists. The count updates live (22, then 2), which is good. There is no "Done" button; the list stays open until Escape or click-away.
4. Canada plus Lake gives two places, Lake Louise and Lac aux Americains, both "Draft" with "No source yet".
5. The Kids pill offers only "Any" and "Not checked yet" for these lakes. There is no family-friendly choice to pick, so the question cannot be answered; with Kind = Trail the pill offers "Easy with kids" (1), "Older or strong kids" (3).
6. On the Lake Louise page every fact reads "No ... recorded yet", "No trailhead or parking recorded yet", and Directions goes to "the pin we stored" at the lake, not a car park. The visitor has to leave for Google Maps and find parking alone. For comparison Lago di Braies shows four parking cards and directions to P4, but with "Location unconfirmed" and "Pin not checked yet" chips that make it hard to trust.

Result: the goal (a car park for a family lake hike in Canada) was not achievable in the shipped data. The interface did not mislead; it ran out of facts. The content gap is the issue, not the UI.

## 6. Large-data check (P1, quick version)

A fixture mechanism exists (`web/scripts/build-fixture.mjs`, `TRAVEL_ROOT`). I cloned the 64 fixture places to 10,000 (unique names and ids, coordinates jittered 1.5 degrees, tags kept) in a throwaway root and built with `next build`. A first build with all detail pages exhausted the disk quota, so the second build capped static detail pages at 30 places, 30 globe place pages and 40 globe paths (throwaway edit in the sweep worktree only, since reverted by removing the worktree). The list, search index and globe data are the full 10,000. GPU Chromium, 1440 x 900, served gzip.

| Measure | CPU x1 | CPU x4 (mobile-like) |
|---|---|---|
| /places/ first card visible | 218 ms | 516 ms |
| /places/ load event | 482 ms | 1,607 ms |
| Kind=Lake filter, click to updated count (10,041 to 634) | 351 ms | 466 ms |
| Search keystroke to updated result (first 3 letters of "braies") | 99 to 121 ms | 371 to 454 ms |
| Globe pins | 7 clusters at 1.6 s from request, p50/p95 frame 16.7/16.8 ms idle and during a drag | not measured |
| Long tasks over 50 ms | none | none |

Reading these numbers: the list renders only 48 cards a page (pagination), so DOM size is flat (1,890 nodes). The cost is in the payload.
- `/places/index.html` is 10.9 MB decoded (387 KB gzip), plus a 9.3 MB `index.txt` copy. At 106 places it is 217 KB. Every row is in the HTML, which is the "load everything then filter" shape P9 warns about; it holds at 10,000 but is a visible mobile download.
- **Scale blocker for the static export: every globe page embeds the whole pin list.** At 10,000 places each of the `globe/place/<slug>`, `globe/trip/<slug>` and `globe/<path>` pages is 7.9 MB of HTML plus 7 MB of `.txt` copies; 70 pages came to 2.0 GB. A full 10,000-place export (one globe page per place) would be several hundred GB. The pins belong in one data file fetched by the globe, not in each page. This also affects P8 (each page re-ships the whole map list).
- The search keystroke times above are the real ones for the first three letters; the later letters did not change the count and were not counted as latency (my harness timed out waiting). The search is debounced, about 100 ms.

Not measured: table view and map view at 10,000 rows, the globe with unclustered pins at street zoom, the cold build time (about 10 minutes for the capped build), the 10,000-slug sitemap.

## Must fix before stage 3

1. Privacy: remove the child's age, "the child", party size and "kids 11+" from public Rockies, Patagonia and home-card text (and from data in the search shard and globe pins); decide how the legacy "Read the full plan" links, which reach pages that name Whitby, are handled. Re-run section 3 afterwards.
2. Vermont (and any trip with unpositioned stops) map framing: show base towns or hide the map instead of Europe.
3. Home and list LCP: stop hot-linking full-size Commons thumbnails (size to the card, no redirect chain, eager and priority for the first card, or host the card images); this is the 16 s mobile LCP and the CLS 0.18 on Trips and Places.
4. Globe payload: move the pin list out of every globe page before the dataset grows (section 6); today 170 pages carry it.
5. Places and Trips table: stop clipping the right-hand columns and label text; show something on 390 that says more columns exist.
6. `/about/` should resolve (redirect to /about/data/ or add the page), and the 404 page should link to About; add a favicon.
7. Terms page and edge protections (robots AI-crawler block, rate limit) before go-live, as P8 requires; none exists in the build.

## Later

- Globe label collisions, translucent Style panel, cluster overlaps, two small pins (target-size).
- Trips map cluster centroids and initial framing.
- Repeated day thumbnails and placeholders; gallery credit wording; `label-content-name-mismatch` on gallery tiles.
- Place page fact repetition and "the pin we stored" wording; map cluster over the trailhead pin.
- "Kids" facet has nothing to offer for most lakes: raise the content bar (assessed kid fit, parking) for the places most visitors will search first.
- Natural-language search ("family lake hike canada"); a Done button on filter pills.
- Mobile nav slot used by Sign in; home 390 order of globe and search.
- Large-data follow-up: table and map views at 10,000, unclustered globe, sitemap size.
