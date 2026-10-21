# verify-R1: independent sweep of Preview 1 (main 92d74d1), 21 Oct 2026

Verifier: travel-verifier, model Sonnet 5.5. Target: static build served at http://127.0.0.1:3440/ (not rebuilt, not restarted).
Chromium 1248 (bundled) on Metal GPU flags, 2x; WebKit 2370 (desktop, iPhone 14 emulation). Dark mode set through the site's own
theme key `travel:v1:theme` before load (the toggle writes the same key; I did not click the toggle for the sweep). Screenshots (2x
originals, tiles, and 1x light|dark pair views) are in
`/private/tmp/claude-501/-Users-nks-workspace-travel/6ecdf19c-bdc2-4d26-a05a-b168e5a5515a/scratchpad/sweep-R1/{chromium,webkit}/`
(pair views in `view/`). Scripts are in `.../scratchpad/h/`. Nothing in the repo changed except this file.

## Summary table

| Area | Pages | Viewports | Themes | Browsers | Result |
|---|---|---|---|---|---|
| Static pages | home, /trips/, /places/, /globe/, /about/, /sign-in/ | 1440x900, 390x844, 844x390 | light, dark | Chromium | no horizontal scroll, 0 broken images, no console errors |
| Trips | Rockies (top, day 6, day 9), Patagonia (top, day 2), Switzerland, Dolomites (top, day 3, day 4), Costa Rica, Quebec | all three | both | Chromium | pass with findings 1-3, 8 |
| Places | Fenland Loop, Tre Cime loop, Moraine Lake, Capri, Otzi, Akureyri, Beagle Channel | all three | both | Chromium | pass with findings 1, 2 |
| Where pill | Canada, Alberta, Banff, remove Canada, sort menu, lone Kind; phone drill-down + Filters sheet | 1440, 390 | both | Chromium | pass |
| Globe | Ganges river then Ganges Plain, Fly here, line draw, nf=0 and reload, phone card, pins | 1440, 390, 844x390 | both (landscape light only) | Chromium (GPU, live tiles) | pass with findings 5, 6 |
| Search panel | hero and header buttons at 1000, 1100, 1440, 1920, 390; second tap | 5 widths | light (1440 and 390 also dark) | Chromium | pass, 14 of 14 inside viewport, 7 of 7 header second-taps closed |
| Changed pages | home, trips, places, globe, Rockies d6, Patagonia d2, Switzerland, Dolomites d4, Fenland, Tre Cime, Moraine, Capri, Otzi, Akureyri | 1440, 390 | both | WebKit desktop and iPhone-14 emulation | rendered and read in tiles; interactions NOT run on WebKit (see not checked) |
| Header and footer | home and /about/ HTML | n/a | n/a | n/a | "Sign in" count 0; "Report a problem" absent (flag off); /sign-in/ HTTP 200, `noindex, nofollow` |
| Coordinator extras | sitemap (380 URLs) all 200; /globe/ca/, /globe/it/, /globe/ca/alberta/ reload 200; no `/specimen` link in any HTML; no legacy folder in `out/`; no ORS endpoint string in `_next` | | | curl | pass (the /specimen page itself is 200, noindex, not in sitemap) |
| Green | computed colour hue scan (hue 80 to 170) on 7 pages, light and dark | 1440 | both | Chromium | none found |
| Lighthouse | 7 pages, mobile and desktop presets | | | Chromium 1248 | see below |

Console on page load: no `error` or `pageerror` on any swept page except one 404 (finding 7). Warnings only (listed in finding 7).
Same-origin `ERR_ABORTED` prefetches were excluded as noise.

## M-row confirmation (design review review-phaseA-2026-10-21.md)

| Row | Verdict | Evidence (file under sweep-R1/chromium/) |
|---|---|---|
| M1 feature card covers the feature | landed | phone card docked as a bottom sheet, river fully visible: `globe-03-ganges-river-p-light.png`, `globe-06-plain-fly-p-light.png`; desktop card sits top-left, river fits right of it: `globe-03-ganges-river-d-light.png`. On 844x390 the card still covers the western edge of the plain (`globe-05-plain-l-light.png`), see finding 5 |
| M2 pin discs overlap | landed | no touching discs at 1440 (`globe-01-world-d-light.png`), 390 (`globe-01-world-p-light.png`), 844x390 (`view/globe-l-t00.png`); 16 and 68 over Europe sit within a few px at 1440 |
| M3 Natural features unexplained, silent off | landed | note "Rivers, seas, ranges and plains, in search and on tap" (`globe-pnf-1-options-dark.png`); nf=0 + "Ganges" shows "Ganges is a natural feature. Natural features are off. Turn on" (`globe-pnf-2-nfoff-search-light.png`); nf=0 in URL and survives reload |
| M4 cover numerals underlined | landed | `view/home-p-t00.png`, `view/home-l-t00.png` (no underline) |
| M5 limits chip runs out of card | landed | wraps inside the card at 390 and 1440: `dolo-limits-p-dark.png`, `trip-dolomites-day4-d-light-t00.png` (the "+2" sits detached on the right, finding 4) |
| M6 season said three times, two banners | partly | Switzerland: one banner, no "valid for" section, season cell kept (`trip-switzerland-d-dark-t00.png`). Quebec overview still stacks two info banners (finding 3) |
| M7 map pill covers reading | landed | Map is the last cell of the sticky day strip at 390, no floating pill: `view/trip-dolomites-day4-p-t00.png`, `dolo-limits-p-dark.png` |
| M8 slug literal in code | landed | `lib/public/trips.ts` reads `data/trips/covers.json`, no `GALLERY_COVER` left; Fitz Roy cover shows (`trip-patagonia-top-d-light-t00.png`) |
| M9 day with only unplaced stops | landed (no-point branch only) | Patagonia day 2 reads "Day 2 has no stops on the map", whole-trip view (`trip-patagonia-day2-d-light-t00.png`). The "base is shown" branch was not seen on any page |
| M10 Day 6 zone marker, Day 9 canoe pin | landed | day 6 marker "Mount Robson is on Pacific time: clocks go back 1 hour" with PT times (`trip-rockies-day6-d-light-t00.png`); canoe "last rental 14:00" is in the schedule data (6 hits in the page). Marker does not say it is an inference (finding 9) |
| M11 back row as amber heading | landed | chevron button + ink title "Alberta", level 0 title "Where": `where-3-drill2-p-light.png` (titles read back Alberta, Canada, Where) |
| M12 own option marks | landed | ink-filled checkbox, ring radio with ink dot: `where-2-alberta-d-light.png` |
| M13 "0 of 0 food" | landed | count "No places", title "No food places here yet", "Show all 359 places": `where-7-lone-kind-d-light.png`, `where-7-lone-kind-p-dark.png` |
| M14 strip too tall on phone | landed | no provenance per tile, one "Read 18 to 19 Oct 2026. Sources are in each section." line; strip about 600 px at 390: `view/place-fenland-p-t00.png` |
| M15 "Hazards listed above" | landed | tile reads "No exposure · Mosquitoes": `place-fenland-d-light-t00.png` |
| M16 parking tile says not checked | landed | "Townsite lot" |
| M17 AllTrails tile regex and look | landed with a wording gap | `ga ga-ext` anchor, arrow glyph, underline, `target=_blank rel=noopener noreferrer`, sr-only note in the aria-label (HTML check). Visible label reads "Trail guide · link only / Open trail page", never "AllTrails" (finding 1) |
| M18 empty glance cells | landed | Otzi wheelchair tile spans the row: `place-otzi-d-dark-t00.png` |
| M19 no primary on a place without a point | landed | Fenland: Save to a trip is the one primary, no Directions button; rail says "No point is stored yet" |

M not landed: none. M6 partly (Quebec).

## Findings

| ID | Severity | Page, viewport, theme, browser | What I saw |
|---|---|---|---|
| 5.1-R1-1 | should | Fenland Loop, Tre Cime, Moraine Rockpile loop, all viewports, both, Chromium | The trail-guide tile says "Trail guide · link only" and "Open trail page". The word AllTrails appears only in the aria-label. R1 checklist row 5 tells the owner to "Search AllTrails", so the owner will not find that wording. The search-fallback variant has the same visible text |
| 5.1-R1-2 | should | Moraine Lake place, 1440, light, Chromium | Cover has no Directions button although a point is stored (rail shows 51.32250,-116.18556 with Google and Apple links). Save is the primary. Capri, Tre Cime, Otzi and Akureyri have Directions on the cover. Confirm this is intended (shuttle-only access) or it is a missed case of M19 |
| 5.1-R1-3 | later | /trips/quebec-2026/, 1440, light | Two separate info banners ("A finished plan..." and "Overview only...") with a visible gap, plus the "Overview only" chip. The M6 merge covers the season banner only |
| 5.1-R1-4 | later | Dolomites day 4, 390, dark and light | Wrapped limits chip: "Minimum age 3 · Under 8 with an adult · alone from 8" breaks mid-phrase and the "+2" is pushed to the far right of the chip. Readable, but the review asked for breaks at the joins. "Recommended: From about 3" is still there (L12) |
| 5.1-R1-5 | should | /globe/, 844x390, light, Chromium | After picking a feature the card (300 px) covers the western part of the Ganges Plain and "Copy link" wraps to two lines. A count disc ("3") sits under the zoom column, and the Map options button crowds the control column. Landscape phone was not covered by the M1 fix (dock as a sheet applies at 390 wide only) |
| 5.1-R1-6 | later | home at 844x390, both, Chromium | The hero card covers the lower pins of the cover globe ("83" and "1" are half hidden behind it). Landscape home is cramped (pins 246 and 26 clear) |
| 5.1-R1-7 | later | console, various | One real error: `404 https://tiles.mapterhorn.com/3/1/5.webp` on Patagonia trip pages (landscape, Chromium). Warnings: MapLibre `layers[boundary_3].filter[1]: Expected value to be of type number, but found null` on every trip with a map (Rockies, Chromium and WebKit); `Image "circle-11" could not be loaded` on the WebKit globe in dark; globe hillshade and terrain share one source; `calculateFogMatrix not supported on globe projection`; unused CSS preload warnings (home, place pages, globe). None visible to a visitor |
| 5.1-R1-8 | later | Places, phone Filters sheet, 390, dark | The Where group shows the summary "Where" and then a second "Where" heading inside it |
| 5.1-R1-9 | should | Rockies day 6, 1440, light | The zone marker states "Mount Robson is on Pacific time" as fact. The data source says "an inference to verify" but the page does not say so, and R1 row 11 asks the owner to judge that inference |
| 5.1-R1-10 | later | Otzi, 1440, dark | "EUR 13 adult" in the glance against "€13" in the lede (L15 not landed); "all year" is lower case |
| 5.1-R1-11 | later | Lighthouse, mobile | see numbers: mobile performance 27 to 71 under simulated 4x CPU and slow 4G; globe CLS 0.21 and TBT about 5 s, home and Rockies LCP about 22 s |

Counts: must 0, should 4 (5.1-R1-1, -2, -5, -9), later 7. M rows: 18 landed, 1 partly (M6), 0 not landed.

## Lighthouse (13.5.0, Chromium 1248, default throttling; localhost is not a CDN)

| Page | Preset | Perf | A11y | BP | SEO | LCP ms | TBT ms | CLS |
|---|---|---|---|---|---|---|---|---|
| home | desktop | 95 | 100 | 100 | 100 | 1251 | 0 | 0.008 |
| home | mobile | 30 | 100 | 100 | 100 | 22674 | 1998 | 0.039 |
| /trips/ | desktop | 96 | 100 | 100 | 100 | 1350 | 0 | 0.004 |
| /trips/ | mobile | 71 | 100 | 100 | 100 | 8805 | 26 | 0.006 |
| Rockies | desktop | 84 | 100 | 100 | 100 | 2043 | 0 | 0.000 |
| Rockies | mobile | 30 | 100 | 100 | 100 | 22636 | 1626 | 0.000 |
| /places/ | desktop | 95 | 100 | 100 | 100 | 1469 | 0 | 0.004 |
| /places/ | mobile | 69 | 100 | 100 | 100 | 10077 | 29 | 0.006 |
| Moraine Lake | desktop | 97 | 100 | 100 | 100 | 1188 | 0 | 0.010 |
| Moraine Lake | mobile | 67 | 100 | 100 | 100 | 7942 | 50 | 0.000 |
| Tre Cime | desktop | 97 | 100 | 100 | 100 | 1268 | 0 | 0.000 |
| Tre Cime | mobile | 70 | 100 | 100 | 100 | 6710 | 29 | 0.000 |
| /globe/ | desktop | 95 | 100 | 100 | 100 | 1067 | 1 | 0.000 |
| /globe/ | mobile | 27 | 100 | 100 | 100 | 7841 | 4991 | 0.210 |

Accessibility, best practices and SEO are 100 everywhere. Desktop performance is 84 to 97. Mobile performance is low where a WebGL map or a
large hero loads (home, Rockies, globe) under simulated throttling on a single-threaded static server; judge again at R2 on the real host.

## Other checks run

- Search panel (A1): 14 of 14 openings inside the viewport (panel at x 328 to 976 at 1000, 640x124; 0,56 390x122 on the phone); 7 of 7 header second presses close it; dark at 1440 and 390 checked. Screenshots `search-{hero,header}-{1000,1100,1440,1920,390}-*.png`.
- Globe (A4 to A6): Ganges river draws a `MultiLineString`, Ganges Plain a `Polygon`; Fly here moved z 3.92 to 4.87 (river) and 3.79 to 4.85 (plain) at 1440 and 3.08 to 3.84 at 390; the URL then carries `c=` and nf=0 is written as `nf=0`, and reload keeps the switch off.
- Where (A7): Canada 178, Alberta 116 of 178, Banff 45 of 178, chips Canada, Alberta, Banff; removing Canada clears all three and returns 359; sort menu has 7 options (Country then photos, Name, Kind, Area, Length, Climb, Date added), the R4-P3 target was 6 or fewer (7 is one over; folded into no finding because the review row for it was not in M1 to M19, flag for the coordinator). Typing "Banff National Park" in the area list finds a 1-place row separate from the 45-place "Banff" row (a duplicate-area naming issue in the data).

## Not checked, and why

- WebKit interaction passes (search panel, Where menu, globe search, nf switch, Directions chooser): only page renders and load console were run on WebKit. Safari on a real iPhone and Mac was not tested.
- Firefox: opt-in on this machine, not run.
- I clicked the theme toggle in none of the sweep; dark mode used the key the toggle writes. The toggle button was present in every header screenshot.
- Report a problem link opening the feedback form: the link is off (flag off), so only its absence was checked (L20).
- Tall pages were captured in tiles (up to 12 per page, fewer for trips: Rockies 4 of about 20 tiles plus day-anchored views). The Rockies list pages and the 12 phone places tiles were generated and the first tiles read; the middle of the Places list and most of the Rockies trip were spot-read only. Every image I read is named above; the rest were checked by automated tests (horizontal scroll, broken images, console).
- Motion and frame time were not measured.
- The home globe mock (R1 row 7), metadata page (row 8) and sentence search (row 6) were out of this scope.
- Perf under a tunnel was not run; the numbers are from localhost.
