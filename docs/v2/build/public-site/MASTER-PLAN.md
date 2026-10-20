# Master plan: the public site (no login), everything that is left

The one list. Every pending item for the public, read-only site is here, in the order we will do it, with the backlog row that holds its status and the plan or spec that holds its detail. The planner product (sign-in, saved trips, collaboration) is listed at the end as a separate product.

**Rules for this file.** It never holds detail: it links. A new finding goes into `BACKLOG.md` first, then gets a line here. Status lives in `BACKLOG.md` (the row) and `STATUS.md` (the coordinator's handover). Owner decisions live in section 8. Updated 20 Oct 2026.

## 0. Where we are in one paragraph

The public site is built and on `main` (the old site is tagged `legacy-final`). All stage 3 and stage 4 lanes are merged. The whole-site design review ran and its must-fixes are fixed. The full browser suite ran on a quiet machine: 699 passed, 2 failed, both fixed. A preview is up at https://bbs-increases-festival-ccd.trycloudflare.com (rebuilt from `main` on 20 Oct). Nothing is published: the live site at nks-travel.pages.dev is still the old site. What is left, in the owner's order of 20 Oct: phase A (your bug reports), phase B, your first review (R1), phase E (towns, nearby, the Where city level, the Google trip map, exports and the data passes), your second review (R2), then go-live (D). The sequenced plan is [EXECUTION-PLAN.md](EXECUTION-PLAN.md).

## 1. The documents this plan links

| Document | What it holds |
|---|---|
| [EXECUTION-PLAN.md](EXECUTION-PLAN.md) | The sequenced plan: phases A, B, E, D, gates R1 and R2, lanes, owned files, server switch, calendar |
| [STATUS.md](STATUS.md) | The coordinator's live handover: lanes, merges, decisions in force, services |
| [BACKLOG.md](BACKLOG.md) | Every finding with an ID, stage, status and commit; the owner questions table (Q1 to Q72) |
| [REPORT-2026-10-20.md](REPORT-2026-10-20.md) | The status report: design state, stage state, remaining steps, merge timing |
| [STAGE4-plan.md](STAGE4-plan.md) | Stage 4 lanes, the whole-site review, stage 5 cross-model checks, stage 6 preview pass, stage 7 go-live checklist |
| [OWNER-ROUND1-plan.md](OWNER-ROUND1-plan.md) | The fix plan for everything the owner reported while testing: cause, fix, lane, files, acceptance |
| [briefs/](briefs/) | One build brief per lane: stage 4 (SHL, PLC, TRP, GLB, LST, CS7d) and round 2 (CONS, FIXF, SHL2, GLB2, LST2, PLC2, META, DATA, TRP2, MX, GO-LIVE) |
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

**Order (owner, 20 Oct 2026): A, then B, then E, then D.** Phase C is the owner's review and runs twice: **R1** after A and B, **R2** after E; D (go-live) follows R2. The sequenced plan with lanes, files, efforts, gates and the calendar is **[EXECUTION-PLAN.md](EXECUTION-PLAN.md)**. Phase F is later. Status words: done, running, next, waiting (on you), later. Two cross-cutting workstreams start first: **CONS** (consistency, server seams, no hard-coded values) and **META** (metadata for every place and activity); see EXECUTION-PLAN sections 5 and 6.

## 3. Phase A and B: before review R1

| # | Item | Rows | Detail | Lane | Effort | Depends on | Status |
|---|---|---|---|---|---|---|---|
| 0 | Typed data client, capability flags, config module, placeholder seams; hard-coding guards and the contract test kit | 13.1 to 13.4 | [EXECUTION-PLAN](EXECUTION-PLAN.md) 5, [briefs/CONS.md](briefs/CONS.md) | CONS-0, CONS-1 | 12 h | none | next |
| 1 | Home search panel opens clipped (anchor to viewport, not the button) | 9.1 | [round 1 plan](OWNER-ROUND1-plan.md) item 1, [briefs/FIXF.md](briefs/FIXF.md) | FIXF | 2.5 h | none | next |
| 2 | Globe: "Fly here" does nothing; river draws a state; wrong centre for landforms | 9.7, 9.4 | round 1 plan items 4 and 5, [briefs/GLB2.md](briefs/GLB2.md) | GLB2a | 12 h | none | next |
| 3 | Globe: switch for natural features (default on) | 9.8, Q52 | round 1 plan item 6 | GLB2a | 3 h | 9.4, 9.7 | next |
| 4 | Hide the header "Sign in" (no login exists) | 11.1, Q64 | [briefs/SHL2.md](briefs/SHL2.md) | SHL2 | 1 h | CONS-0 | next |
| 5 | "Report a problem" link (no personal address in the page) | 11.2, Q63, Q70 | briefs/SHL2.md | SHL2 | 2 h | Q70 | next (Q70 decided: public feedback repo to create) |
| 6 | Where filter: country and state or province, with counts (city level in E) | 8.1, Q54 | [nearby spec](../../features/nearby-and-regions.md) section 4, phase N0; [briefs/LST2.md](briefs/LST2.md) | LST2a | 8 h | CONS-0 | next |
| 7 | Trail key-facts strip and a Search AllTrails link on every trail | 10.1, 10.3, Q53 | round 1 plan items 13 and 15; [briefs/PLC2.md](briefs/PLC2.md) | PLC2a | 6 h | none | next |
| 8 | Metadata rule, tiers per kind, validator and gap reports (META-0) | 8.3, 13.5, 3.37 | EXECUTION-PLAN 6; [briefs/META.md](briefs/META.md) | META | 10 h | none | next |
| 9 | Stage 5 run 1: sweep, output audit, research sample, timeline plausibility, code and security audit, closure | 5.1 to 5.6 | EXECUTION-PLAN 7 | other-model checkers | 1 day | items 0 to 8 merged | next |
| 10 | Fix whatever stage 5 finds | 5.x-n | | builders | up to 1 day | item 9 | next |
| 11 | Preview 1, speed numbers, hand-over with the R1 script | 6.3, 2.47 | EXECUTION-PLAN 8.1 | me | half a day | item 10 | next |

## 4. Phase C: your reviews (two gates)

Full gate definitions (entry criteria, checklist, who does what, exit criteria, the round loop and a one-page script for you) are in [EXECUTION-PLAN.md](EXECUTION-PLAN.md) sections 8 (R1) and 10 (R2).

| # | Item | Rows | Detail | Who | Status |
|---|---|---|---|---|---|
| 12 | **R1** after A and B: the Rockies trip and "Plan it for", a place page on both layouts, the places list on a phone, the globe, a sentence search, Safari on your iPhone and Mac, dark mode on a phone; plus the A and B changes (search panel, Fly here, rivers, the natural-features switch, Sign in hidden, Report a problem, the Where filter, trail facts, AllTrails links), the home globe mock and the baseline metadata report | 6.1, 6.2, 6.3, 2.47 | EXECUTION-PLAN 8 | you | waiting |
| 13 | R1 findings go into the backlog first (`6.2-R1-n`), then get fixed in rounds; re-check after each | 6.2 | EXECUTION-PLAN 8.5 | me and builders | |
| 14 | **R2** after E: the R1 set again, plus towns and cities, the city level in Where, the Nearby block, "near Whitby" with Oshawa and Ajax, the globe city outlines and home look, the Google trip map, Export trip, trail photos, facts and points, activities, the metadata report at 0 unknown; your go-live approval (Q43) | 6.1, 6.2, Q43 | EXECUTION-PLAN 10 | you | waiting |
| 15 | R2 findings into the backlog first (`6.2-R2-n`), fixed in rounds, re-checked | 6.2 | EXECUTION-PLAN 10.5 | me and builders | |

## 5. Phase E: before review R2 (moved before go-live, owner 20 Oct)

| # | Item | Rows | Detail | Lane | Effort | Status |
|---|---|---|---|---|---|---|
| 16 | One geo module, thresholds, kind labels, home point module; then slug tables, palettes, UA and endpoints | 13.2 | EXECUTION-PLAN 5.3 | CONS-2, CONS-3 | 16 h | next (at R1 entry) |
| 17 | Placement migration: join fix, area from the hierarchy, trailheads from held tracks | 8.3, 8.7b | nearby spec 3.5; briefs/META.md | META-1 | 6 h | next |
| 18 | Towns and cities layer (GeoNames), nearest town derived, Whitby in the towns layer, credit | 8.4, 8.9, 8.10, Q50, Q55 | nearby spec 5.6 | META-2 | 6 h | next |
| 19 | Points for the rest of the 121 pointless pages (81 of them trails); locations store required tier | 8.8, 10.5, 8.7, Q58 | [briefs/DATA.md](briefs/DATA.md) D1, D2 | DATA | 10 h agent | next |
| 20 | Trail facts filled from sources; activity basics (where, operator, season, price, limits, window) | 10.2, 13.5, 3.53 part | DATA D3, D4 | DATA | 18 h agent | next |
| 21 | Trail photos (Commons, credited), then activities and trip stops | 10.4 | DATA D5 | DATA | 10 h agent | next |
| 22 | Where city level (`city=`), `where-<cc>.json`, province on Trips | 8.1, 8.11, 8.12, Q61, Q62 | nearby spec N1; briefs/LST2.md | LST2b | 12 h | next |
| 23 | Nearby: "Around here" on place pages, related places, offers show where they happen | 8.2, 8.14, 8.15, Q56, Q57 | nearby spec 5.2; briefs/PLC2.md | PLC2b | 10 h | next |
| 24 | Near mode in the list, towns strip, parser near rule | 8.2, 8.11, 8.16 | nearby spec 5.3, 5.5; briefs/LST2.md | LST2c | 9 h | next |
| 25 | Globe: city outlines from the towns layer; home globe look (mock at R1, then build) | 9.3, 9.2 | round 1 plan items 2 and 3; briefs/GLB2.md | GLB2b | 25 h | next |
| 26 | Trip route map on Google Maps with solid routed legs; visible "Export trip" | 9.5, 9.6, Q51, Q46 | round 1 plan items 10 and 11; [briefs/TRP2.md](briefs/TRP2.md) | TRP2 | 18 h | next |
| 27 | Drive-time matrix (ORS) for nearby, plus the hub matrix (pulled in from F) | 8.13, 3.12 | nearby spec N3; [briefs/MX.md](briefs/MX.md) | MX | 5 h | next |
| 28 | Stage 5 run 2 (scoped to E), fixes, preview 2 with the redirect rehearsal | 5.x | EXECUTION-PLAN 7, 10.1 | checkers, me | 2.5 days | next |

## 6. Phase D: go-live (only after you approve at R2)

The ordered checklist with a rollback for every step is EXECUTION-PLAN section 12; the brief is [briefs/GO-LIVE.md](briefs/GO-LIVE.md).

| # | Step | Rows | Who | Rollback |
|---|---|---|---|---|
| 29 | Approve the preview at R2 exit | 6.1, Q43 | you | n/a |
| 30 | Remove `/specimen` from the public build | 2.42, 7.8 | me | revert a commit |
| 31 | Custom domain, bot protection and one rate-limit rule | 7.6, 7.7, Q44, Q71 | you in Cloudflare | toggle off |
| 32 | `robots.txt` blocks AI crawlers; `_headers`; legacy redirects 302 for a week (including the five with household names) | 7.1, 7.10, 2.46, 2.48, Q45 | me | remove the rules |
| 33 | Restore the Google key's website restrictions, daily quota, Map ID with POIs off, remove the unused Map ID variable | 7.2, 7.3, Q48 | you; me for the env file | widen again |
| 34 | `./publish.sh --product --go-live`, check every old and new address, submit the sitemap; post-publish check and Lighthouse | 7.5, 7.11, 7.12 | me, verifier | roll back the Pages deployment |
| 35 | Day 7: switch the legacy redirects to 301 | 7.10 | me | none after this |
| 36 | Exports stay per item and public until sign-in; amend the P8 wording | 7.9, Q46 | me (doc) | n/a |
| 37 | Cleanup: merged worktrees and stale tunnels (with your confirmation); move the files the code still reads from `legacy/` into `data/`, then remove `legacy/` | 7.11, Q49 | me | recreate from branches |

## 7. Phase F: later

Items pulled forward into A, B or E are listed in EXECUTION-PLAN section 11 (3.37, 3.12, parts of 3.66, 3.67 and 3.53, the globe long-flight profile, Lighthouse).

| Item | Rows | Detail |
|---|---|---|
| Data research batches not needed by E: prices, summaries, seasons for 6 trips, minimum ages beyond the activities, the remaining 8 Dolomites routes, Waterton fares, Walcott dates | 3.61, 3.28, 3.47, 3.49, 3.9 | [capture research backlog](../../research/capture-research-backlog.md) |
| Short trips (day and weekend outings) and the legacy time import for 8 trips | 3.1c, 3.13, 3.14 | [short-trips.md](../../features/short-trips.md) |
| Search: full-text "Words" chip, search sizes at 10,000 places | 3.66, 3.51 | polish |
| Embedding-model search | 3.15 | measured, not worth it yet; revisit near 1,000 places with summaries |
| Trip page leftovers not in TRP2: scheduler size, Patagonia cover and day map, overview Copy text, Dolomites day-4 limits | 3.67 | polish |
| Motion tokens in the foundation | 13.2 part | needs a foundation ruling |
| Smart trip builder (guest draft, then sign-in); placeholder seams exist from CONS-0 | 8.5, 8.6, Q59, Q60 | [nearby spec section 6](../../features/nearby-and-regions.md) |
| The signed-in planner and the backend (the second product) | F01 to F17 | **[SERVER-SIDE-LAUNDRY-LIST.md](../SERVER-SIDE-LAUNDRY-LIST.md)**: foundation, the public site's server versions, every planner feature, order and the first decisions (Q65 to Q69); the switch-over order is EXECUTION-PLAN section 13. Starts after this master list is done |

## 8. Owner decisions

**Decided 20 Oct 2026 (owner: "go with all recommendations"): Q42 to Q64**, each as recommended below. Q43 is the approval itself, given at R2 exit. Q65 to Q69 (server side) stay open and out of scope.

| ID | Decision | Decided |
|---|---|---|
| Q42 | Cloudflare login on your phone, only if it expired | Yes, only if needed |
| Q43 | Approve the preview for go-live | At R2 exit, after your review rows close |
| Q44 | Custom domain, so bot protection applies | Yes (name: Q71) |
| Q45 | Legacy redirects: 302 for a week, then 301 | Yes |
| Q46 | Exports per item and public until sign-in | Yes |
| Q48 | Turn off Google points of interest | Yes |
| Q49 | Remove merged worktrees and stale tunnels | After go-live, as one listed batch |
| Q50 | Whitby in the public towns layer | Yes |
| Q51 | Google Maps on the trip route map | Yes |
| Q52 | Natural features default on or off | On, with the switch |
| Q53 | AllTrails: search links for all, direct links as supplied | Yes |
| Q54 | Where pill (country, province) at launch, city level after | Yes; with the new order the city level also ships before go-live (in E) |
| Q55 | GeoNames as the towns source | Yes |
| Q56 | Radius 10, 25, 50, 100 km, cap 100 | Yes |
| Q57 | Drive-time bands, not exact minutes | Yes |
| Q58 | Open-data points pass | Yes; research is unpaused for all of E |
| Q59 | Guest trip drafts in memory plus a share link | Yes (when the builder is built) |
| Q60 | Unresearched places shown signed-in only | Yes |
| Q61 | Province level on Trips | Yes |
| Q62 | The `city=` URL key | Yes |
| Q63 | Report a problem: an issue link first, never a personal email | Yes (destination: Q70) |
| Q64 | The header "Sign in": hide until the planner exists | Hide |
| Research | Unpause research | Yes, for all phase E data work |

**Open, new (20 Oct):** Q70 where "Report a problem" goes (the repository is private), Q71 the custom domain name, Q72 E starting while you review R1. Recommendations in EXECUTION-PLAN section 18.

**Still open, out of scope:** Q65 to Q69, the server-side decisions (where the backend lives, sign-in method, who may sign in, guest planning, household privacy); see [SERVER-SIDE-LAUNDRY-LIST.md](../SERVER-SIDE-LAUNDRY-LIST.md) section 1. Needed only when the server work starts.

## 9. Standing rules (apply to every lane)

No green. Overlays non-modal, motion smooth. P8: nothing lets one request pull the catalogue. P9: all data through `web/lib/client/data.ts`. No household data. Public text says who a place suits, never who travelled. A gap is never a yes. Trips are dateless. AllTrails, Komoot, Tripadvisor and Google are links only, never data sources; coordinates never from Google. OSM, Overpass, Wikidata and Commons calls sequential with the no-email user agent. Kill servers by PID, never by name. Visual checks on the Arc GPU flags. Opus plans, researches and reviews design; Sonnet builds and verifies; never Fable. Every finding goes into `BACKLOG.md` first. The owner reviews at R1 and R2. Every item names its server switch (EXECUTION-PLAN 4.2).

## 10. Change log

| Date | Change |
|---|---|
| 2026-10-20 | First version: all pending public-site items, linked to their plans |
| 2026-10-20 | Re-ordered to A, B, E, D with review gates R1 and R2 (owner); Q42 to Q64 decided; E moved before go-live; CONS and META workstreams; Q70 to Q72; Q1 to Q62 corrected to Q1 to Q72; links to EXECUTION-PLAN.md |
