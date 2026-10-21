# Master plan: the public site (no login), everything that is left

The one list. Every pending item for the public, read-only site is here, in the order we will do it, with the backlog row that holds its status and the plan or spec that holds its detail. The planner product (sign-in, saved trips, collaboration) is listed at the end as a separate product.

**Rules for this file.** It never holds detail: it links. A new finding goes into `BACKLOG.md` first, then gets a line here. Status lives in `BACKLOG.md` (the row) and `STATUS.md` (the coordinator's handover). Owner decisions live in section 8. Updated 20 Oct 2026.

## 0. Where we are in one paragraph

The public site is built and on `main` (the old site is tagged `legacy-final`). All stage 3 and stage 4 lanes are merged. The whole-site design review ran and its must-fixes are fixed. The full browser suite ran on a quiet machine: 699 passed, 2 failed, both fixed. A preview is up at https://bbs-increases-festival-ccd.trycloudflare.com (rebuilt from `main` on 20 Oct). Nothing is published: the live site at nks-travel.pages.dev is still the old site. What is left, in the owner's order of 20 Oct: phase A (every UI fix), your first review (R1), phase B (API-over-JSON and the foundations), phase E (towns, nearby, the Where city level, the Google trip map, exports and the data passes, on the API), your second review (R2), then a hosting-agnostic readiness checklist (D). Deployment waits for the hosting decision. The sequenced plan is [EXECUTION-PLAN.md](EXECUTION-PLAN.md); the coverage matrix is [COVERAGE.md](COVERAGE.md).

## 1. The documents this plan links

| Document | What it holds |
|---|---|
| [EXECUTION-PLAN.md](EXECUTION-PLAN.md) | The sequenced plan: phases A, B, E, D and S, gates R1, G-B and R2, the API layer, lanes, owned files, server switch, calendar |
| [COVERAGE.md](COVERAGE.md) | Every pending item from every source, mapped to its task (244 lines, 0 unmapped) |
| [STATUS.md](STATUS.md) | The coordinator's live handover: lanes, merges, decisions in force, services |
| [BACKLOG.md](BACKLOG.md) | Every finding with an ID, stage, status and commit; the owner questions table (Q1 to Q72) |
| [REPORT-2026-10-20.md](REPORT-2026-10-20.md) | The status report: design state, stage state, remaining steps, merge timing |
| [STAGE4-plan.md](STAGE4-plan.md) | Stage 4 lanes, the whole-site review, stage 5 cross-model checks, stage 6 preview pass, stage 7 go-live checklist |
| [OWNER-ROUND1-plan.md](OWNER-ROUND1-plan.md) | The fix plan for everything the owner reported while testing: cause, fix, lane, files, acceptance |
| [briefs/](briefs/) | One build brief per lane: stage 4 (SHL, PLC, TRP, GLB, LST, CS7d) and round 2 (TST, FIXF, SHL2, GLB2, TRP1, LST2, PLC2, API, SRV, CONS, META, DATA, TRP2, MX, GO-LIVE as readiness) |
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

**Order (owner, 20 Oct 2026, revised the same day):** phase **A** fixes every UI issue first, then the owner reviews it (**R1**). Phase **B** builds API-over-JSON and the foundations (internal gate **G-B**). Phase **E** builds the features on the API, then the owner reviews again (**R2**). Phase **D** is a hosting-agnostic readiness checklist: **deployment is out of scope until the hosting is chosen**, and the site is no longer a static export. API-over-Supabase is lane **SRV-0**, after E, local only. The sequenced plan with lanes, files, efforts, gates, the server switch and the calendar is **[EXECUTION-PLAN.md](EXECUTION-PLAN.md)**; every pending item from every source is one line of **[COVERAGE.md](COVERAGE.md)** (244 lines, 0 unmapped). Status words: done, running, next, waiting (on you), later.

## 3. Phase A: the UI fixes (before review R1)

| # | Item | Rows | Detail | Lane | Effort | Status |
|---|---|---|---|---|---|---|
| 1 | Flaky browser tests fixed (wait for settled values) | 3.63, 3.67g | [briefs/TST.md](briefs/TST.md) | TST | 4 h | next |
| 2 | Home search panel clipped; header Search second tap closes | 9.1, 3.66a | [briefs/FIXF.md](briefs/FIXF.md) | FIXF | 2.5 h | next |
| 3 | Sign in hidden; Report a problem to the public feedback repo; gallery tile accessible names | 11.1, 11.2, Q70, 15.2 | [briefs/SHL2.md](briefs/SHL2.md) | SHL2 | 4 h | next (the repo must exist before the link turns on) |
| 4 | Globe: Fly here, rivers draw lines, natural-features switch; globe and home polish | 9.7, 9.4, 9.8, 3.65, 15.3, 15.4 | [briefs/GLB2.md](briefs/GLB2.md) part a | GLB2a | 19 h | next |
| 5 | Trip page polish: phone map pill, Patagonia, Switzerland, Dolomites day 4, merged-duplicate stop, Rockies markers | 15.5, 3.62b, 3.67d, 3.35 | [briefs/TRP1.md](briefs/TRP1.md) | TRP1 | 8 h | next |
| 6 | Where pill (country, province, parks and areas) and list polish | 8.1, Q54, 3.62, 3.66, 15.3, 15.4 | [briefs/LST2.md](briefs/LST2.md) part a | LST2a | 16 h | next |
| 7 | Trail facts strip, AllTrails links, place page polish (4.12 and the review list) | 10.1, 10.3, 4.12, 3.49, 15.3, 15.4 | [briefs/PLC2.md](briefs/PLC2.md) part a | PLC2a | 14 h | next |
| 8 | Read-only schema diff (risk check for the API and Supabase) | 14.1 | [briefs/SRV.md](briefs/SRV.md) | SRV-D | 3 h | next |
| 9 | Scoped checks (screenshot sweep, output audit, closure), preview 1 | 5.1, 5.2, 5.6, 2.47 | EXECUTION-PLAN 7, 8.1 | checkers, me | 1 day | next |

## 4. Phase C: your reviews (two gates)

Entry criteria, checklist, roles, exit and the round loop, with a one-page script for you, are in [EXECUTION-PLAN.md](EXECUTION-PLAN.md) sections 8 (R1) and 11 (R2).

| # | Item | Rows | Who | Status |
|---|---|---|---|---|
| 10 | **R1** after phase A: every UI fix and every visible defect in COVERAGE.md phase A, plus the carried-over set (Rockies and "Plan it for", a place page on both layouts, the places list on a phone, the globe, a sentence search, Safari on your iPhone and Mac, dark mode on a phone), the home globe mock, the Mount Robson marker, the default list order, the metadata baseline | 6.1, 6.2, 6.3, 2.47, 13.6, 14.7 | you | waiting |
| 11 | R1 findings into the backlog first (`6.2-R1-n`), fixed in rounds, re-checked | 6.2 | me and builders | |
| 12 | **R2** after phase E: R1 again, plus towns and cities, the Where city level, Nearby, "near Whitby" with Oshawa and Ajax, globe city outlines and the home look, the Google trip map, Export trip, trail photos, facts and points, activities, the metadata report at 0 unknown; your approval (Q43) | 6.1, 6.2, Q43 | you | waiting |
| 13 | R2 findings into the backlog first (`6.2-R2-n`), fixed in rounds, re-checked | 6.2 | me and builders | |

## 5. Phase B: API-over-JSON and the foundations (during R1)

| # | Item | Rows | Detail | Lane | Effort | Status |
|---|---|---|---|---|---|---|
| 14 | Server build mode (no static export); harness and the tests that read `web/out` | 14.2, 15.1 | [briefs/API.md](briefs/API.md) API-0 | API | 10 h | next |
| 15 | Zod contracts, `CatalogueStore` with `JsonStore`, route handlers under `/api/v1/`, OpenAPI, the API adapter as default, the contract kit | 14.3, 13.1, 13.4 | API-1 | API | 22 h | next |
| 16 | Pure modules into `core/` (filters, parser, scrub, export, links) | 14.4 | API-2 | API | 14 h | next |
| 17 | Hard-coding guards; one geo module, thresholds, kind labels | 13.2, 13.3 | [briefs/CONS.md](briefs/CONS.md) | CONS-1, CONS-2 | 14 h | next |
| 18 | Metadata rule, tiers per kind, validator and gap reports | 8.3, 13.5, 3.37 | [briefs/META.md](briefs/META.md) META-0 | META | 10 h | next |
| 19 | Gate G-B: code audit, contract kit, static fallback smoke, quiet e2e | 5.5 | EXECUTION-PLAN 9 | Opus auditor, me | 1 day | next |

## 6. Phase E: features on the API (before review R2)

| # | Item | Rows | Detail | Lane | Effort | Status |
|---|---|---|---|---|---|---|
| 20 | Placement migration (join fix, area, trailheads) and the towns layer with Whitby and the GeoNames credit | 8.3, 8.4, 8.7b, 8.9, 8.10 | briefs/META.md | META-1, META-2 | 12 h | next |
| 21 | Data passes: points (81 trails among the 121 pointless pages), locations required tier, trail facts, activities, trip and stop basics, photos | 8.7, 8.8, 10.2, 10.4, 10.5, 3.9, 3.10, 3.53, 3.61 | [briefs/DATA.md](briefs/DATA.md) D1 to D6 | DATA | 44 h agent | next (D3, D4, D6 start in phase B) |
| 22 | Where city level, Trips by province | 8.1, 8.11, 8.12 | briefs/LST2.md part b | LST2b | 12 h | next |
| 23 | Nearby: Around here, related places, offers show where they happen | 8.2, 8.14, 8.15 | briefs/PLC2.md part b | PLC2b | 10 h | next |
| 24 | Near mode, towns strip, parser near rule | 8.2, 8.11, 8.16 | briefs/LST2.md part c | LST2c | 9 h | next |
| 25 | Trip route map on Google; Export trip through the API | 9.5, 9.6, 3.67b-c | [briefs/TRP2.md](briefs/TRP2.md) | TRP2 | 18 h | next |
| 26 | Globe city outlines and the home globe look | 9.2, 9.3 | briefs/GLB2.md part b | GLB2b | 25 h | next |
| 27 | ORS nearby and hub matrices | 8.13, 3.12 | [briefs/MX.md](briefs/MX.md) | MX | 5 h | next |
| 28 | Hard-coding burn-down (slug tables, palettes, UA, endpoints, host) | 13.2 | briefs/CONS.md CONS-3 | CONS | 8 h | next |
| 29 | Full stage 5 run, fixes, preview 2 | 5.1 to 5.6 | EXECUTION-PLAN 7, 11.1 | checkers, me | 3 days | next |
| 30 | SRV-0: API-over-Supabase locally, contract kit against it (beside R2, flags off) | 14.5 | briefs/SRV.md | SRV | 24 h | later |

## 7. Phase D: readiness (after your approval at R2), hosting-agnostic

The checklist is EXECUTION-PLAN section 13 and [briefs/GO-LIVE.md](briefs/GO-LIVE.md). **Revisit when the hosting is chosen:** the deploy itself, preview environments, the custom domain (Q71), edge protection and rate limits, how redirects and cache rules are expressed, environment variables, rollback (rows 7.4 to 7.7, 7.12, 14.6).

| # | Step | Rows | Who |
|---|---|---|---|
| 31 | Your approval of a named commit | Q43 | you |
| 32 | Privacy over HTML and API output; Whitby only in towns rows and near chips | 5.2, Q50 | Opus auditor |
| 33 | Redirect policy as data (461 old URLs; 302 for a week after the real deploy, then 301) | 7.1, 7.10, 2.48, Q45 | me |
| 34 | Robots policy; sitemap clean; `/specimen` removed | 7.6, 7.8, 2.42 | me |
| 35 | Cache rules (ETag, Cache-Control per path) | 2.46 | me |
| 36 | Google key restrictions ready, daily quota, Map ID with POIs off, unused Map ID variable removed | 7.2, 7.3, Q48 | you; me for the env file |
| 37 | No secret in bundles or API output; Lighthouse numbers recorded | 5.5, 2.47 | me, verifier |
| 38 | Exports per item and public until sign-in; P8 wording | 7.9, Q46 | me |
| 39 | Cleanup with your confirmation (worktrees, tunnels); later move legacy-read files and remove `legacy/` | Q49, 7.11 | me |

## 7b. Phase F: later

Items pulled into A, B or E are in EXECUTION-PLAN section 12.

| Item | Rows | Detail |
|---|---|---|
| Data research not needed by E: Walcott dates, the remaining Dolomites routes, Nuvolau chaining | 3.61b, 3.47d, 3.28 | [capture research backlog](../../research/capture-research-backlog.md) |
| Short trips and the legacy time import | 3.1c, 3.13, 3.14 | [short-trips.md](../../features/short-trips.md) |
| Search polish: the "Words" chip | 3.66b | polish |
| Embedding search and free AI features | 3.15, L9 | needs your go (L9); recommended not now |
| Scheduler bundle trim | 3.67a | budget holds |
| Smart trip builder (flags and `/plan/` reserved) | 8.5, 8.6, Q59, Q60 | [nearby spec section 6](../../features/nearby-and-regions.md) |
| The signed-in planner and the backend | F01 to F17, Q65 to Q69 | **[SERVER-SIDE-LAUNDRY-LIST.md](../SERVER-SIDE-LAUNDRY-LIST.md)**; the switch-over order is EXECUTION-PLAN 14.2 |

## 8. Owner decisions

**Decided 20 Oct 2026 (owner: "go with all recommendations"): Q42 to Q64**, each as recommended below. Q43 is the approval itself, given at R2 exit. Q65 to Q69 (server side) stay open and out of scope.

| ID | Decision | Decided |
|---|---|---|
| Q42 | Cloudflare login on your phone, only if it expired | Yes, only if needed |
| Q43 | Approve the preview for go-live | At R2 exit, after your review rows close |
| Q44 | Custom domain, so bot protection applies | Yes (name: Q71); deferred with hosting |
| Q45 | Legacy redirects: 302 for a week, then 301 | Yes |
| Q46 | Exports per item and public until sign-in | Yes |
| Q48 | Turn off Google points of interest | Yes |
| Q49 | Remove merged worktrees and stale tunnels | After go-live, as one listed batch |
| Q50 | Whitby in the public towns layer | Yes |
| Q51 | Google Maps on the trip route map | Yes |
| Q52 | Natural features default on or off | On, with the switch |
| Q53 | AllTrails: search links for all, direct links as supplied | Yes |
| Q54 | Where pill (country, province) at launch, city level after | Yes; the pill ships in phase A, the city level in phase E |
| Q55 | GeoNames as the towns source | Yes |
| Q56 | Radius 10, 25, 50, 100 km, cap 100 | Yes |
| Q57 | Drive-time bands, not exact minutes | Yes |
| Q58 | Open-data points pass | Yes; research is unpaused for all of E |
| Q59 | Guest trip drafts in memory plus a share link | Yes (when the builder is built) |
| Q60 | Unresearched places shown signed-in only | Yes |
| Q61 | Province level on Trips | Yes |
| Q62 | The `city=` URL key | Yes |
| Q63 | Report a problem: an issue link first, never a personal email | Yes (destination: the public feedback repo, Q70) |
| Q64 | The header "Sign in": hide until the planner exists | Hide |
| Research | Unpause research | Yes, for all phase E data work |

**Decided later on 20 Oct:** Q70 a small public feedback repo with an issue form (still to be created); Q71 register the domain through Cloudflare Registrar, name to come (now deferred with hosting); Q72 start the next phase during R1 (applied to phase B). **Still open:** creating the feedback repo under your account, L7 (close PR #7 and the P3b worktree), L9 (free AI features); recommendations in EXECUTION-PLAN section 18.

**Still open, out of scope:** Q65 to Q69, the server-side decisions (where the backend lives, sign-in method, who may sign in, guest planning, household privacy); see [SERVER-SIDE-LAUNDRY-LIST.md](../SERVER-SIDE-LAUNDRY-LIST.md) section 1. Needed only when the server work starts.

## 9. Standing rules (apply to every lane)

No green. Overlays non-modal, motion smooth. P8: nothing lets one request pull the catalogue. P9: all data through `web/lib/client/data.ts`. No household data. Public text says who a place suits, never who travelled. A gap is never a yes. Trips are dateless. AllTrails, Komoot, Tripadvisor and Google are links only, never data sources; coordinates never from Google. OSM, Overpass, Wikidata and Commons calls sequential with the no-email user agent. Kill servers by PID, never by name. Visual checks on the Arc GPU flags. Opus plans, researches and reviews design; Sonnet builds and verifies; never Fable. Every finding goes into `BACKLOG.md` first. The owner reviews at R1 and R2. Every item names its server switch (EXECUTION-PLAN 4.2).

## 10. Change log

| Date | Change |
|---|---|
| 2026-10-20 | First version: all pending public-site items, linked to their plans |
| 2026-10-20 | Rewritten after the owner's later decisions: UI fixes first with R1 straight after; API-over-JSON in phase B; deployment out of scope, phase D a readiness checklist; SRV-0 after E; COVERAGE.md; Q70 to Q72 decided |
| 2026-10-20 | Re-ordered to A, B, E, D with review gates R1 and R2 (owner); Q42 to Q64 decided; E moved before go-live; CONS and META workstreams; Q70 to Q72; Q1 to Q62 corrected to Q1 to Q72; links to EXECUTION-PLAN.md |
