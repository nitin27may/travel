# Master plan: the public site (no login), everything that is left

The one list. Every pending item for the public, read-only site is here, in the order we will do it, with the backlog row that holds its status and the plan or spec that holds its detail. The planner product (sign-in, saved trips, collaboration) is listed at the end as a separate product.

**Rules for this file.** It never holds detail: it links. A new finding goes into `BACKLOG.md` first, then gets a line here. Status lives in `BACKLOG.md` (the row) and `STATUS.md` (the coordinator's handover). Owner decisions live in section 8. Updated 20 Oct 2026.

## 0. Where we are in one paragraph

The public site is built and on `main` (the old site is tagged `legacy-final`). All stage 3 and stage 4 lanes are merged. The whole-site design review ran and its must-fixes are fixed. The full browser suite ran on a quiet machine: 699 passed, 2 failed, both fixed. A preview is up at https://bbs-increases-festival-ccd.trycloudflare.com (rebuilt from `main` on 20 Oct). Nothing is published: the live site at nks-travel.pages.dev is still the old site. What is left is, in order: your bug reports and enhancements from testing, the independent cross-model checks, your review, the go-live steps, and later the nearby and trip-builder work.

## 1. The documents this plan links

| Document | What it holds |
|---|---|
| [STATUS.md](STATUS.md) | The coordinator's live handover: lanes, merges, decisions in force, services |
| [BACKLOG.md](BACKLOG.md) | Every finding with an ID, stage, status and commit; the owner questions table (Q1 to Q62) |
| [REPORT-2026-10-20.md](REPORT-2026-10-20.md) | The status report: design state, stage state, remaining steps, merge timing |
| [STAGE4-plan.md](STAGE4-plan.md) | Stage 4 lanes, the whole-site review, stage 5 cross-model checks, stage 6 preview pass, stage 7 go-live checklist |
| [OWNER-ROUND1-plan.md](OWNER-ROUND1-plan.md) | The fix plan for everything the owner reported while testing: cause, fix, lane, files, acceptance |
| [briefs/](briefs/) | One build brief per stage 4 lane (SHL, PLC, TRP, GLB, LST, CS7d) |
| [../../features/nearby-and-regions.md](../../features/nearby-and-regions.md) | Where filter (country, state, city), nearby places, the data rule, the towns layer, the smart trip builder |
| [../../features/smart-search.md](../../features/smart-search.md) | The query parser, chips, "Not checked yet", the embedding spike verdict |
| [../../features/trip-timeline.md](../../features/trip-timeline.md) | The trip page timeline, profile and scheduler |
| [../../features/short-trips.md](../../features/short-trips.md) | Day and weekend trips, hub drive matrix |
| [../../design/foundation/principles.md](../../design/foundation/principles.md) | P1 to P9, T1 to T5 |
| [../../design/review-stage4-whole-site.md](../../design/review-stage4-whole-site.md) | The whole-site Opus review |
| [../../design/lists-stage4-note.md](../../design/lists-stage4-note.md), [trip-page/stage4-map-note.md](../../design/trip-page/stage4-map-note.md) | Design rulings for the lists and the trip map |
| [../../design/place-page-sections.md](../../design/place-page-sections.md), [suitability-display.md](../../design/suitability-display.md) | Place page layout and "Who it suits" |
| [../../research/capture-contract.md](../../research/capture-contract.md) | The one data contract: types, properties, placement, supersede rule |
| [../../research/suitability.md](../../research/suitability.md), [relevance.md](../../research/relevance.md), [sources-and-licences.md](../../research/sources-and-licences.md) | Suitability, relevance, sources and licences |
| [../../research/smart-search-spike.md](../../research/smart-search-spike.md) | The measured embedding test |
| [../../research/capture-research-backlog.md](../../research/capture-research-backlog.md), [operator-questions-2026-10-18.md](../../research/operator-questions-2026-10-18.md) | The data research queue and the operator questions |
| [../SERVER-SIDE-LAUNDRY-LIST.md](../SERVER-SIDE-LAUNDRY-LIST.md) | The second list: everything that needs login or a server; links F01 to F17 |
| [../../features/README.md](../../features/README.md), F01 to F17 | The planner product specs |

## 2. How to read the tables

Phase: **A** now (fixes you reported, small), **B** before your review, **C** your review, **D** go-live, **E** the first weeks after go-live, **F** later. Status words: done, running, next, waiting (on you), paused (data research), later.

## 3. Phase A and B: before your review

| # | Item | Rows | Detail | Lane | Effort | Depends on | Status |
|---|---|---|---|---|---|---|---|
| 1 | Home search panel opens clipped (anchor to viewport, not the button) | 9.1 | [round 1 plan](OWNER-ROUND1-plan.md) item 1 | FIXF | 2 h | none | next |
| 2 | Globe: "Fly here" does nothing; river draws a state; wrong centre for landforms | 9.7, 9.4 | round 1 plan items 4 and 5 | GLB2 | 12 h | none | next |
| 3 | Globe: switch for natural features (rivers, ranges, plains) | 9.8, Q52 | round 1 plan item 6 | GLB2 | 3 h | 9.4, 9.7 | next |
| 4 | Hide or explain the header "Sign in" (no login exists) | 11.1 | below | SHL | 1 h | owner choice | next |
| 5 | "Report a problem" link (no personal address in the page) | 11.2 | below | SHL | 2 h | Q63 | next |
| 6 | Where filter: country and state or province, with counts (the city level follows) | 8.1, Q54 | [nearby spec](../../features/nearby-and-regions.md) section 4, phase N0 | LST2 | 8 h | Q54 | waiting |
| 7 | Trail key-facts strip and a Search AllTrails link on every trail | 10.1, 10.3, Q53 | round 1 plan items 13 and 15 | PLC2 | 6 h | Q53 | waiting |
| 8 | Stage 5 independent checks: sweep, output audit, timeline plausibility, code and security audit, closure of every review item | 5.1 to 5.6 | [STAGE4 plan](STAGE4-plan.md) section 4 | other-model checkers | 1 day | items 1 to 7 merged | next |
| 9 | Fix whatever stage 5 finds | 5.x-n | | builders | up to 1 day | item 8 | next |
| 10 | Refresh the preview, speed numbers, hand-over | 6.3, 2.47 | STAGE4 plan section 5 | me | half a day | item 9 | next |

## 4. Phase C: your review

| # | Item | Rows | Detail | Who | Status |
|---|---|---|---|---|---|
| 11 | You review the preview: the Rockies trip and "Plan it for", a place page on both layouts, the places list on a phone, the globe, a sentence search, Safari on your iPhone and Mac, dark mode on a phone | 6.1 | STAGE4 plan section 5 | you | waiting |
| 12 | Your findings go into the backlog first, then get fixed in rounds; re-check after each | 6.2 | | me and builders | |

## 5. Phase D: go-live (only after you approve)

| # | Step | Rows | Who | Rollback |
|---|---|---|---|---|
| 13 | Approve the preview | 6.1, Q43 | you | n/a |
| 14 | Remove `/specimen` from the public build | 2.42, 7.8 | me | revert a commit |
| 15 | Retire the legacy pages behind redirects (302 for a week, then 301), including the five with household names | 7.1, 7.10, 2.48, Q45 | me; you confirm | remove the rules |
| 16 | Cache headers (built into `publish.sh --product`) | 2.46, 7.12 | me | delete the file |
| 17 | `robots.txt` blocks AI crawlers; custom domain; bot protection and one rate-limit rule | 7.6, 7.7, Q44 | you in Cloudflare | toggle off |
| 18 | Cloudflare Pages settings check; remove the unused Map ID variable; Google points of interest | 7.4, 7.3, Q48 | me, you for the style | re-add |
| 19 | Merge to main (done: `main` is already the product), run `./publish.sh --product --go-live`, check every old and new address, submit the sitemap | 7.5, 7.11, 7.12 | me | roll back the Pages deployment |
| 20 | Restore the Google key's website restrictions | 7.2 | you | widen again |
| 21 | Post-publish check and Lighthouse on production | 7.5 | verifier | |
| 22 | Cleanup: remove merged worktrees and stale tunnels (with your confirmation); move the files the code still reads from `legacy/` into `data/`, then remove `legacy/` | 7.11, Q49 | me | recreate from branches |
| 23 | Exports stay per item and public until sign-in exists; amend the P8 wording | 7.9, Q46 | you decide | n/a |

## 6. Phase E: the first weeks after go-live

| # | Item | Rows | Detail | Lane | Effort | Status |
|---|---|---|---|---|---|---|
| 24 | Towns and cities layer (GeoNames), the `city=` level in the Where filter, province on Trips | 8.4, 8.1, Q55, Q61, Q62 | nearby spec N1 | LST2 | about 28 h | later |
| 25 | The data rule: placement block on every record, validator, gap report, researcher checklist | 8.3 | nearby spec section 3 | DATA | 10 h | later |
| 26 | Placement migration steps 1 to 3 and 5 (no research needed): join fix (23 places), area from the hierarchy (346 records), trail points from held data, nearest town derived | 8.3 | nearby spec 3.5 | DATA | 12 h | later |
| 27 | Locations list: fill the required tier for all 74 places from open data; warnings for both tiers | 8.7, Q58 | audit in BACKLOG 8.7 | DATA | 6 h | later |
| 28 | Whitby in the public towns layer (privacy call) | Q50 | nearby spec 2.4 | owner | n/a | waiting |
| 29 | Nearby: the "Around here" block on place pages and "near <place>" in the list | 8.2, Q56, Q57 | nearby spec section 5, phase N2 | PLC2, LST2 | about 24 h | later |
| 30 | Globe: city outlines from the towns layer; home globe look (design note, then build) | 9.3, 9.2 | round 1 plan items 2 and 3 | GLB2 | about 20 h | later |
| 31 | Trip route map on Google Maps with solid routed legs; visible "Export trip" (print, calendar, CSV, KML or GPX) | 9.5, 9.6, Q51 | round 1 plan items 10 and 11 | TRP2 | 16 h | waiting on Q51 |
| 32 | Trail photos (Commons, credited), trail facts filled from sources, map points for the 47 trails with none | 10.4, 10.2, 10.5 | round 1 plan items 14, 16, 17 | DATA | per batch | paused |
| 33 | Drive-time matrix (ORS) for nearby and short trips | 8.13, 3.12 | nearby spec N3 | DATA | 8 h | later |

## 7. Phase F: later

| Item | Rows | Detail |
|---|---|---|
| Data research batches: facts, prices, summaries, seasons, minimum ages and weights, the remaining 8 Dolomites routes, Waterton fares, Walcott dates | 3.53, 3.61, 3.28, 3.47, 3.49 | paused by the owner; [capture research backlog](../../research/capture-research-backlog.md) |
| Short trips (day and weekend outings) and the legacy time import for 8 trips | 3.1c, 3.12, 3.13, 3.14 | [short-trips.md](../../features/short-trips.md) |
| Search: full-text "Words" chip, header Search closes on a second tap, search sizes at 10,000 places, parser code budget | 3.66, 3.51 | polish |
| Embedding-model search | 3.15 | measured, not worth it yet; revisit near 1,000 places with summaries |
| Trip page leftovers: map hover ring and pin-click scroll, scheduler size, Patagonia cover and day map, overview Copy text, Dolomites day-4 limits | 3.67 | polish |
| Globe stalls on long flights (inside the map library) | 4.7, 3.65 | profile again on the real deploy |
| Capture point as a record property | 3.37 | next contract change |
| Smart trip builder (guest draft, then sign-in) | 8.5, 8.6, Q59, Q60 | [nearby spec section 6](../../features/nearby-and-regions.md) |
| The signed-in planner and the backend (the second product) | F01 to F17 | **[SERVER-SIDE-LAUNDRY-LIST.md](../SERVER-SIDE-LAUNDRY-LIST.md)**: foundation, the public site's server versions, every planner feature, order and the first decisions (Q65 to Q69). Starts after this master list is done |

## 8. Owner decisions, open

Every one has a recommendation in `BACKLOG.md`. "Go with the recommendations" settles all of them.

| ID | Decision | Recommended |
|---|---|---|
| Q42 | Cloudflare login on your phone, only if it expired | Yes, only if needed |
| Q43 | Approve the preview for go-live | After your review rows close |
| Q44 | Custom domain, so bot protection applies | Yes |
| Q45 | Legacy redirects: 302 for a week, then 301 | Yes |
| Q46 | Exports per item and public until sign-in | Yes |
| Q48 | Turn off Google points of interest | Yes |
| Q49 | Remove merged worktrees and stale tunnels | After go-live, as one listed batch |
| Q50 | Whitby in the public towns layer | Yes |
| Q51 | Google Maps on the trip route map | Yes |
| Q52 | Natural features default on or off | On, with the switch |
| Q53 | AllTrails: search links for all, direct links as supplied | Yes |
| Q54 | Where pill (country, province) at launch, city level in week 1 | Yes |
| Q55 | GeoNames as the towns source | Yes |
| Q56 | Radius 10, 25, 50, 100 km, cap 100 | Yes |
| Q57 | Drive-time bands, not exact minutes | Yes |
| Q58 | Open-data-only points pass despite the research pause | Yes |
| Q59 | Guest trip drafts in memory plus a share link | Yes |
| Q60 | Unresearched places shown signed-in only | Yes |
| Q61 | Province level on Trips | Yes |
| Q62 | The `city=` URL key | Yes |
| Q63 | Report a problem: a form or an issue link, never a personal email in the page | Issue link first |
| Q65 to Q69 | Server-side decisions: where the backend lives, sign-in method, who may sign in, guest planning, household privacy | See [SERVER-SIDE-LAUNDRY-LIST.md](../SERVER-SIDE-LAUNDRY-LIST.md) section 1 (needed only when the server work starts) |
| Q64 | The header "Sign in": hide until the planner exists, or keep with a "coming later" note | Hide |
| Research | Unpause research for the trail gap report and map points first | Yes |

## 9. Standing rules (apply to every lane)

No green. Overlays non-modal, motion smooth. P8: nothing lets one request pull the catalogue. P9: all data through `web/lib/client/data.ts`. No household data. Public text says who a place suits, never who travelled. A gap is never a yes. Trips are dateless. AllTrails, Komoot, Tripadvisor and Google are links only, never data sources; coordinates never from Google. OSM, Overpass, Wikidata and Commons calls sequential with the no-email user agent. Kill servers by PID, never by name. Visual checks on the Arc GPU flags. Opus plans, researches and reviews design; Sonnet builds and verifies; never Fable. Every finding goes into `BACKLOG.md` first. The owner reviews at stage 6.

## 10. Change log

| Date | Change |
|---|---|
| 2026-10-20 | First version: all pending public-site items, linked to their plans |
