# Coverage matrix: every pending public-site item and the task that delivers it

Companion to [EXECUTION-PLAN.md](EXECUTION-PLAN.md) (section 22). Entry point since 21 Oct 2026: [docs/v2/PLAN.md](../../PLAN.md). L7 closed 21 Oct; the counts below are as swept on 20 Oct. Swept on 20 Oct 2026, line by line, from:
- every [BACKLOG.md](BACKLOG.md) row not marked done (stages 2 to 15, the questions table, the Later list);
- every Open row of [docs/v2/TODO.md](../../TODO.md);
- the review and note files under `docs/v2/design/` (the whole-site review's "Fix soon" list item by item; the lane reviews through the rows that collected them, 4.4 to 4.16);
- the lane docs here (L0 to L5, LD, LM, S1, CS7, CC, README, verify-integration's "Later" list, STATUS's open and cleanup parts, STAGE4-plan's conflicts C1 to C11, all resolved);
- `research/backlog.md` and `operator-questions-2026-10-18.md`;
- `docs/v2/features/*.md` open items;
- the owner memory notes in `docs/v2/build/handover/memory/`;
- the code: `TODO`, `FIXME` and "known issue" markers in `web/`, `core/`, `tools/` (2 real ones) and every `test.skip`, `fixme` and `skipIf` in the tests (1 fixme, 1 real defect behind a skip, 6 tests that skip when `web/out` is missing, the rest environment guards).

**Rules.** No item is unmapped. Duplicates are merged into one line and marked "Merged duplicate" with the line they join. A row whose status was stale is marked "Done (status was stale)", and its BACKLOG or TODO status was corrected in the same change. Items found only in code or tests got new BACKLOG rows (15.1, 15.2). "UI" marks a visible defect or polish item a visitor can see (screens, phone, dark mode, accessibility, copy, empty states, performance budgets). Phase A must close every UI line mapped to it.

Phase codes: A (UI fixes, before R1), B (API and foundations), C (review gates and independent checks), E (features and data), D (readiness, hosting-agnostic), S (SRV-0, Supabase store, local), F (later), server side (laundry list), dropped (with a reason), done (status was stale), merged duplicate, needs owner decision.

## Counts

| Phase | Items |
|---|---|
| A (UI fixes) | 58 |
| B (API and foundations) | 14 |
| C (review gates and checks) | 33 |
| E | 42 |
| D (readiness, hosting-agnostic) | 16 |
| S (SRV-0) | 1 |
| F (later) | 13 |
| Server side (laundry list) | 8 |
| Dropped | 4 |
| Done or decided (status was stale) | 32 |
| Merged duplicate | 21 |
| Needs owner decision | 2 |
| **Total lines** | **244** |
| Unmapped | **0** |

Visible UI defects and polish (marked UI): 84 in all, 55 of them in phase A.


## Needs owner decision

| Line | Item | Recommendation |
|---|---|---|
| L7 | P4b PR #7 and the parked P3b worktree | **Closed 21 Oct 2026:** PR #7 closed; the old remote branches deleted and archived as `archive/*` tags. Only L9 remains open |
| L9 | Free AI features (embedding search, CLIP photo picks, similar places) | Not now: keep in Phase F, revisit near 1,000 places with summaries (the spike measured no gain at today's size) |

## The matrix

| # | Source | ID | Title | Type | Delivered by | Phase | Lane | UI |
|---|---|---|---|---|---|---|---|---|
| 1 | BACKLOG | 2.46 | Long-cache headers for hashed images | enhancement | Readiness item 6 (cache policy as data) | D (readiness, hosting-agnostic) | coordinator |  |
| 2 | BACKLOG | 2.47 | Lighthouse off a real CDN | polish | R1 entry 7 and R2 entry; readiness item 9; targets re-judged when hosting is chosen | C (review gates and checks) | coordinator, verifier | UI |
| 3 | BACKLOG | 2.48 | Five legacy pages with household data | bug | Readiness item 3 (legacy URLs redirect; never in a preview) | D (readiness, hosting-agnostic) | coordinator |  |
| 4 | BACKLOG | 3a.12 | Capture contract steps 5 to 7 | data | Steps 5 (S1b) and 6 (L3b) done; step 7 gap research is META-0 gap reports plus DATA D1 to D6 | E | META, DATA |  |
| 5 | BACKLOG | 3.1c | L3d: legacy time import for 8 trips, overview trips to days | enhancement | Phase F: new data import not needed by E; pages show honest overviews | F (later) |  |  |
| 6 | BACKLOG | 3.9 | Seasons for the 6 trips showing "season not set yet" | data | DATA D6 (task E7b) | E | DATA | UI |
| 7 | BACKLOG | 3.10 | 34 dated texts as relative wording | data | DATA D6 (task E7b) | E | DATA | UI |
| 8 | BACKLOG | 3.12 | Hub drive matrix (From Toronto) | data | MX (task E13), pulled in from F | E | MX |  |
| 9 | BACKLOG | 3.13 | L3e short trips | enhancement | Phase F: a new page type | F (later) |  |  |
| 10 | BACKLOG | 3.14 | Elora Gorge public trip | data | Phase F, with short trips (3.13) | F (later) |  |  |
| 11 | BACKLOG | 3.28 | 16 of 17 Dolomites tracks held back | data | Merged into 3.47 | Merged duplicate |  |  |
| 12 | BACKLOG | 3.35a | Rockies Day 6 time-zone marker (Mount Robson) | enhancement | TRP1 (task A13); the inference is signed off at R1 (checklist) | A (UI fixes) | TRP1 | UI |
| 13 | BACKLOG | 3.35b | Rockies Day 9 canoe last-rental conflict pin | enhancement | TRP1 (task A13) | A (UI fixes) | TRP1 | UI |
| 14 | BACKLOG | 3.35c | Rockies Day 15 flight-dependent times | polish | Dropped: "Depends on your flight" is the honest dateless answer | Dropped |  |  |
| 15 | BACKLOG | 3.37 | Point as a record property | decision | META-0 decision: point stays in the sidecar with role and approx | B (API and foundations) | META |  |
| 16 | BACKLOG | 3.47a | Puflatsch track 27% short of official | data | No change: inside the 40% rule and exported with its figure (recorded) | Dropped |  |  |
| 17 | BACKLOG | 3.47b | Seekofel gain conflict 1467 against 1314 m | data | DATA D3: show as a conflict with both sources | E | DATA |  |
| 18 | BACKLOG | 3.47c | Tre Cime stale second line marked exportable | bug | DATA D3: drop the empty line from the export set | E | DATA | UI |
| 19 | BACKLOG | 3.47d | Nuvolau relations do not chain; 8 remaining Dolomites routes | data | Phase F: remaining route research | F (later) |  |  |
| 20 | BACKLOG | 3.47e | Fanes, Pordoi, Cinque Torri, Fiscalina, Vallunga, Federa destination points | data | DATA D1 (destination points as points with role); routes themselves Phase F | E | DATA |  |
| 21 | BACKLOG | 3.47f | Rockies PLAN.md line 199 old wording | polish | Phase F: legacy research file, retired with 7.11 | F (later) |  |  |
| 22 | BACKLOG | 3.49 | Otzi price glance; checks count rule | bug | PLC2a check first (task A8b); price from CS7c | A (UI fixes) | PLC2a | UI |
| 23 | BACKLOG | 3.53 | Research levels all early; usable basics for anchors and stops | data | META acceptance (points) plus DATA D6 (summary, season) | E | DATA |  |
| 24 | BACKLOG | 3.61a | Waterton shuttle fare one-way or return | data | DATA D4 | E | DATA |  |
| 25 | BACKLOG | 3.61b | Walcott page 2025 dates under a 2026 heading | data | Phase F: not needed by E | F (later) |  |  |
| 26 | BACKLOG | 3.61c | Waterton marina point not verified | data | DATA D1 | E | DATA |  |
| 27 | BACKLOG | 3.61d | Elk rut point is the Banff town node | data | DATA D1: mark approx, area-level | E | DATA | UI |
| 28 | BACKLOG | 3.61e | Audit AllTrails and Komoot links in output are link-only | data | Stage 5 check 5.2 (R1 and R2) | C (review gates and checks) | Opus auditor |  |
| 29 | BACKLOG | 3.61f | Jasper bike prices load by script | data | DATA D4 (browser re-read) | E | DATA |  |
| 30 | BACKLOG | 3.61g | Batch B: activity ages and weights, meeting points, two-operator records, river parts | data | DATA D4 | E | DATA |  |
| 31 | BACKLOG | 3.62a | Light trips map green pixels re-measure | polish | R1 screenshot sweep (hue scan) and R2 entry | C (review gates and checks) | verifier | UI |
| 32 | BACKLOG | 3.62b | Merged duplicate drops a Rockies stop; re-pin 207 to 206 | bug | TRP1 (task A13) | A (UI fixes) | TRP1 | UI |
| 33 | BACKLOG | 3.62c | Search cannot show a merged duplicate (add alias) | bug | LST2a (task A7b) | A (UI fixes) | LST2a | UI |
| 34 | BACKLOG | 3.62d | Card kids gap chip and effort glyph live in the place descriptor | polish | LST2a (task A7b) check | A (UI fixes) | LST2a | UI |
| 35 | BACKLOG | 3.63 | Flaky e2e under load (who-it-suits:36, home:40, url-state:110, smart-search:188 webkit) | bug | TST (task A14) | A (UI fixes) | TST |  |
| 36 | BACKLOG | 3.65a | Globe sprite prewarm and panel re-render on pitched picks | polish | GLB2a (task A4b) | A (UI fixes) | GLB2a | UI |
| 37 | BACKLOG | 3.65b | Globe data grew; check home page unaffected by lazy loading | polish | GLB2a (task A4b) budget check | A (UI fixes) | GLB2a | UI |
| 38 | BACKLOG | 3.66a | Header Search second tap does not close | bug | FIXF (task A1) | A (UI fixes) | FIXF | UI |
| 39 | BACKLOG | 3.66b | No "Words" chip for the full-text pass | enhancement | Phase F: polish | F (later) |  |  |
| 40 | BACKLOG | 3.66c | Phone filter panel has no search box | polish | LST2a (task A7b) | A (UI fixes) | LST2a | UI |
| 41 | BACKLOG | 3.66d | "No waterfalls here yet" for a lone Kind chip not built | polish | LST2a (task A7b) | A (UI fixes) | LST2a | UI |
| 42 | BACKLOG | 3.66e | Map view loads all matching row files | bug | LST2a (task A7b) scope by viewport; the API (B2) serves it server-side | A (UI fixes) | LST2a | UI |
| 43 | BACKLOG | 3.66f | Trips-map ring above cluster unconfirmed at 390 | polish | LST2a (task A7b) confirm | A (UI fixes) | LST2a | UI |
| 44 | BACKLOG | 3.66g | Count tween not done | polish | LST2a (task A7b) | A (UI fixes) | LST2a | UI |
| 45 | BACKLOG | 3.66h | Merged-duplicate alias uses the humanised slug | bug | Merged into 3.62c | Merged duplicate |  |  |
| 46 | BACKLOG | 3.66i | 10,000-place timings: cold filter 1.2 s, text search 460-570 ms, table 1.1-2.5 s | polish | API-1 moves filtering server-side (B2); measured in 5.1 at R2 | B (API and foundations) | API | UI |
| 47 | BACKLOG | 3.66j | Default order puts countries with a photo first: confirm | decision | R1 checklist item (owner confirms) | C (review gates and checks) | owner |  |
| 48 | BACKLOG | 3.67a | Scheduler bundle 13,125 of 13,312 bytes | polish | Phase F unless TRP2 touches the scheduler; budget test holds | F (later) |  |  |
| 49 | BACKLOG | 3.67b | Map entry-hover ring and pin-click scroll | enhancement | TRP2 (task E11) | E | TRP2 | UI |
| 50 | BACKLOG | 3.67c | Map fly duration not tuned | polish | TRP2 (task E11) | E | TRP2 | UI |
| 51 | BACKLOG | 3.67d | Dolomites #day-3, Patagonia #day-2 and the 1024 view not re-read | polish | TRP1 (task A13) | A (UI fixes) | TRP1 | UI |
| 52 | BACKLOG | 3.67e | Day 15 "Depends on your flight" | polish | Merged into 3.35c | Merged duplicate |  |  |
| 53 | BACKLOG | 3.67f | Day 6 Mount Robson inference needs owner sign-off | decision | R1 checklist item | C (review gates and checks) | owner |  |
| 54 | BACKLOG | 3.67g | trip-day-spy flake family | bug | TST (task A14) | A (UI fixes) | TST |  |
| 55 | BACKLOG | 4.1 | Whole-site design review | polish | Done: REVIEW4 ran (status corrected) | Done or decided (status was stale) |  |  |
| 56 | BACKLOG | 4.3 | Fixes from the review | bug | Done: FIXA to FIXD merged (status corrected); fix-soon remainders below | Done or decided (status was stale) |  |  |
| 57 | BACKLOG | 4.12 S5 | Glance slots repeat (Trailhead and parking, Starts at); Lagazuoi contradiction | bug | PLC2a (task A8b), check first | A (UI fixes) | PLC2a | UI |
| 58 | BACKLOG | 4.12 S6 | Section values ignore the mi/ft toggle | bug | PLC2a (task A8b), check first | A (UI fixes) | PLC2a | UI |
| 59 | BACKLOG | 4.12 S7 | Links: three markers for one gap, raw keys | bug | PLC2a (task A8b), check first | A (UI fixes) | PLC2a | UI |
| 60 | BACKLOG | 4.12 S9 | Card rule chip draws lock and person together | polish | PLC2a (task A8b), check first | A (UI fixes) | PLC2a | UI |
| 61 | BACKLOG | 4.12 S10 | Section 3 has no chip row at rest (Bolzano) | polish | PLC2a (task A8b), check first | A (UI fixes) | PLC2a | UI |
| 62 | BACKLOG | 4.12 S11 | Lone "Not checked yet" chip does not say what; kind and effort share a glyph | polish | PLC2a (task A8b), check first | A (UI fixes) | PLC2a | UI |
| 63 | BACKLOG | 4.12 S12 | Phone place pages 6,000-8,700 px with no section index | polish | PLC2a (task A8b), check first | A (UI fixes) | PLC2a | UI |
| 64 | BACKLOG | 4.12 S13 | "Who it suits" group inside the "Who it suits" section | polish | PLC2a (task A8b), check first | A (UI fixes) | PLC2a | UI |
| 65 | BACKLOG | 4.12 S-far | Far pointer whose target has no page; cap Nearby at 25 km | polish | PLC2a (task A8b), check first | A (UI fixes) | PLC2a | UI |
| 66 | BACKLOG | 4.22 | REVIEW4 must or confusion item | bug | Done: merged (status corrected) | Done or decided (status was stale) |  |  |
| 67 | BACKLOG | 4.27 | REVIEW4 must or confusion item | bug | Done: merged (status corrected) | Done or decided (status was stale) |  |  |
| 68 | BACKLOG | 4.28 | REVIEW4 must or confusion item | bug | Done: merged (status corrected) | Done or decided (status was stale) |  |  |
| 69 | BACKLOG | 4.29 | REVIEW4 must or confusion item | bug | Done: merged (status corrected) | Done or decided (status was stale) |  |  |
| 70 | BACKLOG | 5.1 | Full sweep and measurements | polish | Section 7: scoped before R1, at G-B, full before R2 | C (review gates and checks) | checkers |  |
| 71 | BACKLOG | 5.2 | Public output audit | polish | Section 7: scoped before R1, at G-B, full before R2 | C (review gates and checks) | checkers |  |
| 72 | BACKLOG | 5.3 | Research sample | polish | Section 7: scoped before R1, at G-B, full before R2 | C (review gates and checks) | checkers |  |
| 73 | BACKLOG | 5.4 | Timeline plausibility | polish | Section 7: scoped before R1, at G-B, full before R2 | C (review gates and checks) | checkers |  |
| 74 | BACKLOG | 5.5 | P8, P9, security audit | polish | Section 7: scoped before R1, at G-B, full before R2 | C (review gates and checks) | checkers |  |
| 75 | BACKLOG | 5.6 | Design-ruling closure | polish | Section 7: scoped before R1, at G-B, full before R2 | C (review gates and checks) | checkers |  |
| 76 | BACKLOG | 6.1 | Owner preview review | decision | Gates R1 and R2 | C (review gates and checks) | owner |  |
| 77 | BACKLOG | 6.2 | Owner findings into the backlog, fixed in rounds | process | R1 and R2 round loops | C (review gates and checks) | coordinator |  |
| 78 | BACKLOG | 6.3 | Preview pass and hand-over | process | R1 entry and R2 entry (no Pages preview branch; local server and tunnel) | C (review gates and checks) | coordinator |  |
| 79 | BACKLOG | 7.1 | Old trip URLs and the old hub replaced | enhancement | Readiness item 3; serving them is a hosting step | D (readiness, hosting-agnostic) | coordinator |  |
| 80 | BACKLOG | 7.2 | Restore the Google key restrictions | enhancement | Readiness item 7 | D (readiness, hosting-agnostic) | owner |  |
| 81 | BACKLOG | 7.3 | Remove the unused Map ID variable; POIs off | enhancement | Readiness item 7 | D (readiness, hosting-agnostic) | owner, coordinator |  |
| 82 | BACKLOG | 7.4 | Hosting environment variables | enhancement | Revisit when the hosting is chosen (13.2) | D (readiness, hosting-agnostic) |  |  |
| 83 | BACKLOG | 7.5 | Merge, publish, served-URL check, sitemap submit | enhancement | Merge is done (main is the product); sitemap check is readiness 5; publish revisits with hosting | D (readiness, hosting-agnostic) | coordinator |  |
| 84 | BACKLOG | 7.6 | Edge protection, AI-crawler block, rate limit | enhancement | Robots policy is readiness 4; edge and rate limit revisit with hosting | D (readiness, hosting-agnostic) | coordinator |  |
| 85 | BACKLOG | 7.7 | Edge protection needs a zone and a custom domain | decision | Revisit when the hosting is chosen (Q71 deferred) | D (readiness, hosting-agnostic) |  |  |
| 86 | BACKLOG | 7.8 | Remove /specimen from the public build | bug | Readiness item 5 | D (readiness, hosting-agnostic) | coordinator | UI |
| 87 | BACKLOG | 7.9 | P8 export wording amended | decision | Readiness item 10 (Q46 decided) | D (readiness, hosting-agnostic) | coordinator |  |
| 88 | BACKLOG | 7.10 | 302 for a week, then 301 | decision | Readiness item 3 (Q45 decided) | D (readiness, hosting-agnostic) | coordinator |  |
| 89 | BACKLOG | 7.11a | One product branch | process | Done: main is the product (20 Oct) | Done or decided (status was stale) |  |  |
| 90 | BACKLOG | 7.11b | Move legacy-read files into data/, remove legacy/ | enhancement | Phase F, after readiness (CONS-3 removes the special cases first) | F (later) |  |  |
| 91 | BACKLOG | 8.1 | Where filter country, province (N0) and city | enhancement | EXECUTION-PLAN 3 and 10 | A (UI fixes) | LST2a, LST2b | UI |
| 92 | BACKLOG | 8.2 | Nearby places and near mode | enhancement | EXECUTION-PLAN 3 and 10 | E | PLC2b, LST2c | UI |
| 93 | BACKLOG | 8.3 | Data rule: placement block | data | EXECUTION-PLAN 3 and 10 | B (API and foundations) | META |  |
| 94 | BACKLOG | 8.4 | Towns and cities layer | data | EXECUTION-PLAN 3 and 10 | E | META |  |
| 95 | BACKLOG | 8.7 | Locations store required tier | data | EXECUTION-PLAN 3 and 10 | E | DATA |  |
| 96 | BACKLOG | 8.7b | Point join gap | data | EXECUTION-PLAN 3 and 10 | E | META |  |
| 97 | BACKLOG | 8.8 | Points for the 121 pointless pages | data | EXECUTION-PLAN 3 and 10 | E | DATA |  |
| 98 | BACKLOG | 8.9 | GeoNames credit | data | EXECUTION-PLAN 3 and 10 | E | META |  |
| 99 | BACKLOG | 8.10 | Privacy scrub and the towns layer | enhancement | EXECUTION-PLAN 3 and 10 | E | META |  |
| 100 | BACKLOG | 8.11 | Shard bbox and where-<cc> counts | enhancement | EXECUTION-PLAN 3 and 10 | E | LST2b, LST2c (static fallback; the API near replaces it) |  |
| 101 | BACKLOG | 8.12 | Trips Where by province | enhancement | EXECUTION-PLAN 3 and 10 | E | LST2b | UI |
| 102 | BACKLOG | 8.13 | ORS nearby matrix | data | EXECUTION-PLAN 3 and 10 | E | MX |  |
| 103 | BACKLOG | 8.14 | Drive bands | enhancement | EXECUTION-PLAN 3 and 10 | E | PLC2b | UI |
| 104 | BACKLOG | 8.15 | Collapse place and its own route | enhancement | EXECUTION-PLAN 3 and 10 | E | PLC2b | UI |
| 105 | BACKLOG | 8.16 | Smart search near rules | enhancement | EXECUTION-PLAN 3 and 10 | E | LST2c | UI |
| 106 | BACKLOG | 8.5 | Smart trip builder | server-side | Laundry list item 23 (SB1, SB2); flags reserved | Server side (laundry list) |  |  |
| 107 | BACKLOG | 8.6 | Suggest-by-theme trip search with days | enhancement | Phase F, with SB1 | F (later) |  |  |
| 108 | BACKLOG | 9.1 | Home search panel clipped | bug | EXECUTION-PLAN 3 and 10 | A (UI fixes) | FIXF | UI |
| 109 | BACKLOG | 9.2 | Home globe look | enhancement | EXECUTION-PLAN 3 and 10 | E | GLB2b (mock approved at R1) | UI |
| 110 | BACKLOG | 9.3 | City outlines on the globe | bug | EXECUTION-PLAN 3 and 10 | E | GLB2b | UI |
| 111 | BACKLOG | 9.4 | River draws a state | bug | EXECUTION-PLAN 3 and 10 | A (UI fixes) | GLB2a | UI |
| 112 | BACKLOG | 9.5 | Trip map on Google | enhancement | EXECUTION-PLAN 3 and 10 | E | TRP2 | UI |
| 113 | BACKLOG | 9.6 | Export trip | enhancement | EXECUTION-PLAN 3 and 10 | E | TRP2 | UI |
| 114 | BACKLOG | 9.7 | Fly here does nothing | bug | EXECUTION-PLAN 3 and 10 | A (UI fixes) | GLB2a | UI |
| 115 | BACKLOG | 9.8 | Natural features switch | enhancement | EXECUTION-PLAN 3 and 10 | A (UI fixes) | GLB2a | UI |
| 116 | BACKLOG | 10.1 | Trail key-facts strip | enhancement | PLC2a (A8) | A (UI fixes) | PLC2a | UI |
| 117 | BACKLOG | 10.2 | Trail data completeness | data | META-0 gap report, DATA D3 | E | DATA |  |
| 118 | BACKLOG | 10.3 | AllTrails link on every trail | enhancement | PLC2a (A9) | A (UI fixes) | PLC2a | UI |
| 119 | BACKLOG | 10.4 | Trail photos | data | DATA D5 | E | DATA | UI |
| 120 | BACKLOG | 10.5 | Trails with no point (81 of 122) | data | DATA D1 | E | DATA | UI |
| 121 | BACKLOG | 11.1 | Header Sign in with no login | bug | SHL2 (A2) | A (UI fixes) | SHL2 | UI |
| 122 | BACKLOG | 11.2 | No way to report a problem | bug | SHL2 (A3), Q70 | A (UI fixes) | SHL2 | UI |
| 123 | BACKLOG | 12.1 | Server-side laundry list | server-side | The laundry list itself | Server side (laundry list) |  |  |
| 124 | BACKLOG | 13.1 | Server-ready seams with placeholders | enhancement | API-1 (B2) and capability flags | B (API and foundations) | API |  |
| 125 | BACKLOG | 13.2 | No hard-coded values | enhancement | CONS-1, CONS-2 (B), CONS-3 (E) | B (API and foundations) | CONS |  |
| 126 | BACKLOG | 13.3 | Consistency rules | enhancement | CONS-2 and every design round; R1 and R2 checklist | B (API and foundations) | CONS |  |
| 127 | BACKLOG | 13.4 | Server switch per item; contract kit | enhancement | API-1 (B2) | B (API and foundations) | API |  |
| 128 | BACKLOG | 13.5 | Metadata for every place and activity | data | META-0 (B), META-1, META-2, DATA (E) | B (API and foundations) | META |  |
| 129 | BACKLOG | 13.6 | Phase C as two gates | process | Sections 8 and 11 | C (review gates and checks) | coordinator |  |
| 130 | BACKLOG | 14.1 | SRV-D: schema.sql against the capture contract (read-only) | enhancement | EXECUTION-PLAN 4, 13 | A (UI fixes) | SRV |  |
| 131 | BACKLOG | 14.2 | API-0: server build mode and harness | enhancement | EXECUTION-PLAN 4, 13 | B (API and foundations) | API |  |
| 132 | BACKLOG | 14.3 | API-1: contracts, store, handlers, OpenAPI, API adapter | enhancement | EXECUTION-PLAN 4, 13 | B (API and foundations) | API |  |
| 133 | BACKLOG | 14.4 | API-2: pure modules into core | enhancement | EXECUTION-PLAN 4, 13 | B (API and foundations) | API |  |
| 134 | BACKLOG | 14.5 | SRV-0: API-over-Supabase, local | enhancement | EXECUTION-PLAN 4, 13 | S (SRV-0) | SRV |  |
| 135 | BACKLOG | 14.6 | Deployment out of scope; hosting-agnostic readiness | decision | EXECUTION-PLAN 4, 13 | D (readiness, hosting-agnostic) | coordinator |  |
| 136 | BACKLOG | 14.7 | UI fixes first with their own gate R1 | decision | EXECUTION-PLAN 4, 13 | C (review gates and checks) | coordinator |  |
| 137 | BACKLOG | 15.1 | Six test files skip silently when web/out is missing (would always skip after API-0) | bug | API-0 (B1): repoint every web/out reader | B (API and foundations) | API |  |
| 138 | BACKLOG | 15.2 | Gallery tiles: accessible name does not match the label on WebKit (trip-day-spy.spec.ts:231; verify-integration Later) | bug | SHL2 (task A2b) | A (UI fixes) | SHL2 | UI |
| 139 | BACKLOG | 15.3 | REVIEW4 fix-soon remainders (lines R4-* below) | bug | Phase A lanes | A (UI fixes) | several | UI |
| 140 | BACKLOG | 15.4 | verify-integration Later remainders (lines VI-* below) | polish | Phase A lanes, check first | A (UI fixes) | several | UI |
| 141 | BACKLOG | 15.5 | Trip page polish lane TRP1 | bug | Task A13 | A (UI fixes) | TRP1 | UI |
| 142 | BACKLOG | 15.6 | Stale TODO and BACKLOG statuses reconciled | process | This sweep (TODO rows moved to Done, BACKLOG statuses corrected) | Done or decided (status was stale) | coordinator |  |
| 143 | BACKLOG Q | Q65 to Q69 | Server-side decisions (backend, sign-in, who, guest, household privacy) | decision | Laundry list section 1; open until server work starts | Server side (laundry list) | owner |  |
| 144 | BACKLOG Q | Q70 | Report a problem goes to a public feedback repo (decided 20 Oct); the repo is still to be created | decision | SHL2 (A3) links to it; creating the repo is an owner-approved action before A3 merges | A (UI fixes) | SHL2, owner | UI |
| 145 | BACKLOG Q | Q71 | Custom domain (decided yes 20 Oct, name to come) | decision | Deferred: revisit when the hosting is chosen | D (readiness, hosting-agnostic) | owner |  |
| 146 | BACKLOG Q | Q72 | Next phase starts during R1 (decided 20 Oct) | decision | Applied: phase B starts at R1 entry | Done or decided (status was stale) |  |  |
| 147 | BACKLOG Later | L1 | Signed-in planner | server-side | Laundry list section 4 | Server side (laundry list) |  |  |
| 148 | BACKLOG Later | L2 | Year and school calendar (F03) | server-side | Laundry list item 21 | Server side (laundry list) |  |  |
| 149 | BACKLOG Later | L3 | Enforce per-kind completeness (validator, badge, skill, MCP) | data | META-0 tiers and W_TIER_REQUIRED (B); the completeness.ts replacement in API-2 | B (API and foundations) | META, API |  |
| 150 | BACKLOG Later | L4 | A person confirms held trail data (Braies P1, Monte Piana, Fanes, Seceda, Nuvolau, Lago d Antorno) | data | R2 optional owner item | C (review gates and checks) | owner |  |
| 151 | BACKLOG Later | L5 | R2 bucket for offline maps | server-side | Laundry list item 32 | Server side (laundry list) |  |  |
| 152 | BACKLOG Later | L6 | Prototype: bookings wallet, Explore map labels, person-level items | server-side | Laundry list items 19, 27, 34 | Server side (laundry list) |  |  |
| 153 | BACKLOG Later | L7 | P4b PR #7 and the parked P3b worktree | decision | Done 21 Oct: PR #7 closed, branches archived as `archive/*` tags | Needs owner decision (closed 21 Oct) | owner |  |
| 154 | BACKLOG Later | L8 | Place-page data enrichment (parking, fees, swimming, boats, loops, best time) | data | Required tier in DATA D1 to D6 (E); the rest of the enrichment tier Phase F | E | DATA |  |
| 155 | BACKLOG Later | L9 | Free AI features (embeddings, CLIP photos, similar places) | decision | Needs owner (proposed, awaiting go) | Needs owner decision | owner |  |
| 156 | TODO | T1 | Public site execution plan | enhancement | This plan | C (review gates and checks) |  |  |
| 157 | TODO | T2 | Smart search with no model bill | enhancement | Phase 1 done (SQ1); phase 2 and 3 Phase F (3.15, L9) | F (later) |  |  |
| 158 | TODO | T3 | Capture contract audit and rethink | enhancement | Merged into 3a.12 | Merged duplicate |  |  |
| 159 | TODO | T4 | Relevance | enhancement | Done (RV0 678e1ab, RVC 03b3318) | Done or decided (status was stale) |  |  |
| 160 | TODO | T5 | Suitability applicability | enhancement | Done (S0b f0c49cc) | Done or decided (status was stale) |  |  |
| 161 | TODO | T6 | Suitability metadata, who it suits | enhancement | Done (S0 e83e77c, R1-R6 6ef1c43, S1) | Done or decided (status was stale) |  |  |
| 162 | TODO | T7 | Short trips | enhancement | Merged into 3.13 | Merged duplicate |  |  |
| 163 | TODO | T8 | Trip page as a timeline with a profile | enhancement | Done (L3c b02f4a4); L3d merged into 3.1c | Done or decided (status was stale) |  |  |
| 164 | TODO | T9 | Trip page as a timeline (second row) | enhancement | Merged into T8 | Merged duplicate |  |  |
| 165 | TODO | T10 | Trip tags and filters (L3b) | enhancement | Done (235058c) | Done or decided (status was stale) |  |  |
| 166 | TODO | T11 | Trail maps on every trail page (L4b) | enhancement | Done (a974eef); the person check is L4 | Done or decided (status was stale) |  |  |
| 167 | TODO | T12 | Globe L2b | enhancement | Done (ea97741) | Done or decided (status was stale) |  |  |
| 168 | TODO | T13 | Scrub internal capture notes at the source | enhancement | Done (PS e883636); its Lighthouse line merged into 2.47 | Done or decided (status was stale) |  |  |
| 169 | TODO | T14 | Test health: places-parity flake, /specimen axe | enhancement | places-parity in TST (A14); /specimen removed at readiness 5 | A (UI fixes) | TST | UI |
| 170 | TODO | T15 | The globe is a major feature | enhancement | Done (L2, L2b, GLB) | Done or decided (status was stale) |  |  |
| 171 | TODO | T16 | Public trips are dateless | enhancement | Done (PS, L3) | Done or decided (status was stale) |  |  |
| 172 | TODO | T17 | Map stack decided; owner keys | enhancement | Superseded by Q51; keys done; daily cap is readiness 7; R2 bucket is L5 | D (readiness, hosting-agnostic) |  |  |
| 173 | TODO | T18 | Public site L2 | enhancement | Done (4777821) | Done or decided (status was stale) |  |  |
| 174 | TODO | T19 | Public site gates | enhancement | Superseded by R1, G-B and R2 | C (review gates and checks) |  |  |
| 175 | TODO | T20 | Trail data for a person to confirm | enhancement | Merged into L4 | Merged duplicate |  |  |
| 176 | TODO | T21 | Enforce per-kind completeness | enhancement | Merged into L3 | Merged duplicate |  |  |
| 177 | TODO | T22 | Next round (owner direction) | enhancement | This plan | C (review gates and checks) |  |  |
| 178 | TODO | T23 | Keep what works on the live site | enhancement | Standing rule; checked by 5.6 and the R1 and R2 checklists | C (review gates and checks) |  |  |
| 179 | TODO | T24 | Year calendar: school calendar | enhancement | Merged into L2 | Merged duplicate |  |  |
| 180 | TODO | T25 | Apply the redesign direction to the prototype | enhancement | Dropped: the prototype is superseded by web/, which carries the Trailhead design | Dropped |  |  |
| 181 | TODO | T26 | Person-level items shared across trips | enhancement | Merged into L6 | Merged duplicate |  |  |
| 182 | TODO | T27 | Bookings Wallet on stored bookings | enhancement | Merged into L6 | Merged duplicate |  |  |
| 183 | TODO | T28 | Explore map label collisions | enhancement | Merged into L6 | Merged duplicate |  |  |
| 184 | TODO | T29 | Trip and template cards need real photos | enhancement | Done on the public site (photo-led cards, 3.56); prototype part dropped | Done or decided (status was stale) |  |  |
| 185 | review-stage4-whole-site | R4-H1 | Phone: "Tap a pin" hint shows over a globe with no pins for 3 s | polish | GLB2a (A4b) | A (UI fixes) | GLB2a | UI |
| 186 | review-stage4-whole-site | R4-H2 | Cover clusters differ from the globe page; one radius | polish | GLB2a (A4b) | A (UI fixes) | GLB2a | UI |
| 187 | review-stage4-whole-site | R4-T1 | Phone "Map · All days" pill over the Plan it for card | bug | TRP1 (A13) | A (UI fixes) | TRP1 | UI |
| 188 | review-stage4-whole-site | R4-T2 | Patagonia: Buenos Aires cover, Day 2 "0 stops", "Exposure: level None" | bug | TRP1 (A13); cover photo pick from the trip gallery | A (UI fixes) | TRP1 | UI |
| 189 | review-stage4-whole-site | R4-T3 | Switzerland overview: Copy text with no Copy button, season twice, grey tiles | bug | TRP1 (A13); season data in DATA D6 | A (UI fixes) | TRP1 | UI |
| 190 | review-stage4-whole-site | R4-T4 | Dolomites Day 4: "weight not stated · height not stated +4" | bug | TRP1 (A13): stated limits only | A (UI fixes) | TRP1 | UI |
| 191 | review-stage4-whole-site | R4-P1 | Filters shown twice at 1440 | bug | Done (4.29, 6bd3839) | Done or decided (status was stale) |  | UI |
| 192 | review-stage4-whole-site | R4-P2 | Kids pill reads "Youngest child · Easy with kids" | bug | LST2a (A7b), check first after 4.24 | A (UI fixes) | LST2a | UI |
| 193 | review-stage4-whole-site | R4-P3 | 15 sort options | polish | LST2a (A7b): 6 or fewer | A (UI fixes) | LST2a | UI |
| 194 | review-stage4-whole-site | R4-PP1 | Sorapis Starts at tile against the Directions card | bug | Merged into 4.12 S5 | Merged duplicate |  | UI |
| 195 | review-stage4-whole-site | R4-PP2 | Akureyri season glance against When you can go | bug | PLC2a (A8b), check first | A (UI fixes) | PLC2a | UI |
| 196 | review-stage4-whole-site | R4-PP3 | "Partly checked · 25 of 25" | bug | Done (4.29) | Done or decided (status was stale) |  | UI |
| 197 | review-stage4-whole-site | R4-PP4 | Otzi opening hours printed twice | bug | PLC2a (A8b), check first | A (UI fixes) | PLC2a | UI |
| 198 | review-stage4-whole-site | R4-PP5 | Gondola cover line starts with an orphan dot | bug | PLC2a (A8b), check first | A (UI fixes) | PLC2a | UI |
| 199 | review-stage4-whole-site | R4-G1 | Lake Louise in a 1-place district; area names disagree across globe, search, breadcrumbs | data | META-1 area migration (E1) and one area table | E | META | UI |
| 200 | review-stage4-whole-site | R4-G2 | Globe search placeholder differs by width | polish | Done (FIXD) | Done or decided (status was stale) |  | UI |
| 201 | review-stage4-whole-site | R4-G3 | Immersive control not found | bug | Done (FIXD, 4.26) | Done or decided (status was stale) |  | UI |
| 202 | review-stage4-whole-site | R4-C1 | Two Directions controls on a place page | polish | PLC2a (A8b): cover button opens the same chooser | A (UI fixes) | PLC2a | UI |
| 203 | verify-integration Later | VI-1 | Globe label collisions, translucent Style panel, cluster overlaps, two small pins (target size) | polish | GLB2a (A4b), check first | A (UI fixes) | GLB2a | UI |
| 204 | verify-integration Later | VI-2 | Trips map cluster centroids and initial framing | polish | LST2a (A7b), check first | A (UI fixes) | LST2a | UI |
| 205 | verify-integration Later | VI-3 | Repeated day thumbnails, gallery credit wording | polish | Done (2.41, TRP and PLC) | Done or decided (status was stale) |  |  |
| 206 | verify-integration Later | VI-4 | Gallery tile label-content-name-mismatch | polish | Merged into 15.2 | Merged duplicate |  |  |
| 207 | verify-integration Later | VI-5 | Place page fact repetition, "the pin we stored", map cluster over the trailhead pin | polish | PLC2a (A8b), check first | A (UI fixes) | PLC2a | UI |
| 208 | verify-integration Later | VI-6 | Kids facet has nothing for lakes | polish | Done (4.15) | Done or decided (status was stale) |  |  |
| 209 | verify-integration Later | VI-7 | Natural-language search; Done button on pills | polish | Done (SQ1, LST) | Done or decided (status was stale) |  |  |
| 210 | verify-integration Later | VI-8 | Mobile nav Sign in slot; home 390 order | polish | Done (4.15) | Done or decided (status was stale) |  |  |
| 211 | verify-integration Later | VI-9 | Large data: table and map views at 10,000, unclustered globe, sitemap size | polish | 5.1 at R2, through the API | C (review gates and checks) | verifier |  |
| 212 | design files | review-L3b.md | Must and stage-4 items | polish | Rowed as 4.4 to 4.16 (done); remainders are 3.62 to 3.67 and 4.12 (above); closure proven by check 5.6 before R1 and R2 | C (review gates and checks) | verifier |  |
| 213 | design files | trip-page/review-L3c.md | Must and stage-4 items | polish | Rowed as 4.4 to 4.16 (done); remainders are 3.62 to 3.67 and 4.12 (above); closure proven by check 5.6 before R1 and R2 | C (review gates and checks) | verifier |  |
| 214 | design files | place-page-sections/review-S1b.md | Must and stage-4 items | polish | Rowed as 4.4 to 4.16 (done); remainders are 3.62 to 3.67 and 4.12 (above); closure proven by check 5.6 before R1 and R2 | C (review gates and checks) | verifier |  |
| 215 | design files | smart-search/review-SQ1b.md | Must and stage-4 items | polish | Rowed as 4.4 to 4.16 (done); remainders are 3.62 to 3.67 and 4.12 (above); closure proven by check 5.6 before R1 and R2 | C (review gates and checks) | verifier |  |
| 216 | design files | globe/review-L2b.md | Must and stage-4 items | polish | Rowed as 4.4 to 4.16 (done); remainders are 3.62 to 3.67 and 4.12 (above); closure proven by check 5.6 before R1 and R2 | C (review gates and checks) | verifier |  |
| 217 | design files | globe/review.md | Must and stage-4 items | polish | Rowed as 4.4 to 4.16 (done); remainders are 3.62 to 3.67 and 4.12 (above); closure proven by check 5.6 before R1 and R2 | C (review gates and checks) | verifier |  |
| 218 | design files | foundation/review.md | Must and stage-4 items | polish | Rowed as 4.4 to 4.16 (done); remainders are 3.62 to 3.67 and 4.12 (above); closure proven by check 5.6 before R1 and R2 | C (review gates and checks) | verifier |  |
| 219 | design files | lists-stage4-note.md | Must and stage-4 items | polish | Rowed as 4.4 to 4.16 (done); remainders are 3.62 to 3.67 and 4.12 (above); closure proven by check 5.6 before R1 and R2 | C (review gates and checks) | verifier |  |
| 220 | design files | trip-page/stage4-map-note.md | Must and stage-4 items | polish | Rowed as 4.4 to 4.16 (done); remainders are 3.62 to 3.67 and 4.12 (above); closure proven by check 5.6 before R1 and R2 | C (review gates and checks) | verifier |  |
| 221 | design files | place-page-sections.md | Must and stage-4 items | polish | Rowed as 4.4 to 4.16 (done); remainders are 3.62 to 3.67 and 4.12 (above); closure proven by check 5.6 before R1 and R2 | C (review gates and checks) | verifier |  |
| 222 | design files | suitability-display.md | Must and stage-4 items | polish | Rowed as 4.4 to 4.16 (done); remainders are 3.62 to 3.67 and 4.12 (above); closure proven by check 5.6 before R1 and R2 | C (review gates and checks) | verifier |  |
| 223 | research | RB-1 | Kicking Horse put-ins and take-outs not published | data | DATA D4 plus an operator question | E | DATA |  |
| 224 | research | RB-2 | Niagara relations not done (no days) | data | Phase F, with L3d (3.1c) | F (later) |  |  |
| 225 | research | RB-3 | Tre Cime and Larch Valley draw moves wait on the ledger | data | DATA D3 with the Q41 supersede override | E | DATA |  |
| 226 | research | OQ | Operator questions (45 rows) for the owner to send | decision | Q14 decided; DATA D4 records replies and adds new questions; the owner sends them | E | DATA, owner |  |
| 227 | features | nearby-and-regions | Where, Nearby, towns, data rule, builder | enhancement | E (and SB1 in Phase F) | E | several | UI |
| 228 | features | smart-search phase 2-3 | Embedding search, CLIP | enhancement | Phase F (3.15, L9) | F (later) |  |  |
| 229 | features | short-trips | Outing frame and pages | enhancement | Merged into 3.13 | Merged duplicate |  |  |
| 230 | features | trip-timeline L3d | Legacy times | enhancement | Merged into 3.1c | Merged duplicate |  |  |
| 231 | features | F01 to F17 | Planner features | server-side | Laundry list section 4 | Server side (laundry list) |  |  |
| 232 | STATUS and build docs | ST-1 | Rockies base points differ from Wikidata (Kananaskis about 2 km, Lake Louise about 4 km) | data | DATA D1: check and source | E | DATA | UI |
| 233 | STATUS and build docs | ST-2 | Cleanup: merged worktrees and stale tunnels (Q49) | process | After readiness, with confirmation of each deletion | D (readiness, hosting-agnostic) | coordinator |  |
| 234 | STATUS and build docs | ST-3 | CS7 batch 3 (remaining gaps) | data | Merged into DATA D1 to D6 | Merged duplicate |  |  |
| 235 | STATUS and build docs | ST-4 | SQ1 phase 2 spike (Q38) | enhancement | Done (smart-search-spike.md, measured, not worth it yet) | Done or decided (status was stale) |  |  |
| 236 | STATUS and build docs | ST-5 | README lists utah-five-parks as private, page not built | polish | Done: nothing is private since 19 Oct; README note corrected in API-0 docs pass | Done or decided (status was stale) |  |  |
| 237 | code | web/lib/public/honesty-overrides.ts:1 | TODO row: trail data for a person to confirm | data | Merged into L4 | Merged duplicate |  |  |
| 238 | code | web/lib/public/completeness.ts:5 | TODO: engine replaces this | data | Merged into L3 | Merged duplicate |  |  |
| 239 | code | web/tests/e2e/globe.motion.gpu.spec.ts:270 | fixme: long-flight long-task budget | polish | GLB2a prewarm (3.65a); re-profiled at R2 entry | A (UI fixes) | GLB2a | UI |
| 240 | code | web/tests/e2e/trip-day-spy.spec.ts:231 | skip: gallery tile name mismatch on WebKit | bug | Merged into 15.2 | Merged duplicate |  |  |
| 241 | code | six skipIf(web/out) tests | timeline-outlinks, light-data, export page-data, built-pages, place-size, photo-credits-clean | bug | Merged into 15.1 | Merged duplicate |  |  |
| 242 | code | environment skips | GPU Chromium, tile server, GLOBE_SHOTS, TRIPS_SHOT_URL, python skips | process | Not defects: environment guards (recorded) | Dropped |  |  |
| 243 | owner memory | travel-app-feedback | Hide done trips; galleries; trail maps | enhancement | Done (dateless templates, galleries, L4b); trail photos in DATA D5 | Done or decided (status was stale) |  |  |
| 244 | owner memory | travel-taxonomy-extensible | Complete, extensible taxonomy; activities first-class | data | Standing rule; META tiers per kind | B (API and foundations) | META |  |

## Change log

| Date | Change |
|---|---|
| 2026-10-20 | First version: full sweep, 244 lines, 0 unmapped; Q70 and Q72 decided by the owner the same day |
