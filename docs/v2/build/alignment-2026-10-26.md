# Alignment audit, 26 Oct 2026: one ordering for everything on the master list

Written 26 Oct 2026 (evening) by travel-planner (Opus 5.5) on `public/ALIGN`, from `main` 88404219. **Docs only: no app
code, no new HTML, no spec rewritten.** Requirement PLAN [R-256](../PLAN.md); BACKLOG 15.327 to 15.331; new owner questions
Q308 and Q309 (section 9). Principles cited by number from [principles.md](../design/foundation/principles.md).

**The owner's request (26 Oct 2026).** "The master list is big (MCP and everything). I believe we are somehow not aligned;
double check where this fits properly." Finish the planning for everything linked to the master list before more building.

**What changed because of this page.** [MASTER-ORDER.md](MASTER-ORDER.md) is again the one ordering: section 0 (bundles
with hours), 3.0 (done since the morning), 3.9 (the 26 Oct additions as task rows), 4.1, 4.3, 4.4, 4.5, 4.6, 5.1, 5.3 and
5.4 (critical path) were rewritten or extended. [RELEASE-PLAN.md](RELEASE-PLAN.md) 0a.2 to 0a.4 carry the same bundle
table, [DATA-PLAN.md](DATA-PLAN.md) 2 the new data rows, [PLAN.md](../PLAN.md) the new R rows and open decisions,
BACKLOG and TODO the numbering. Where any older page disagrees with MASTER-ORDER after this commit, MASTER-ORDER wins.

## 0. Decision in one paragraph

The plans disagreed in four ways: (1) **hours**: bundle C was still quoted at 180.5 h in three pages while four specs had
each added to it separately (UX fixes 67 h, parks P1 31 h, entity graph 23 h), so no page held its real size, **301.5 h**;
the program total is **1,350.5 h**, not 986 h; (2) **contract order**: eighteen new contract tasks (EG-C, EG-M, EG-Q,
PA-C, PA-X, PA-Q, PA-3C, PM-C, PM-G, PM-F, API-P, API-G, API-T, API-S, API-V, MTH-G, UPL-C, STG-C) had slots only in
their own specs, two of them in conflict (EG-Q versus OVR-Ca; PM-C versus STY-P on `properties.ts`); (3) **status**: most
of bundle A and the first UX tasks are merged while the plan pages still said "ready" or "waiting for approval"; (4)
**ids**: the MCP product's phases M1 to M5 reuse the ids of the MCP rule (R-252, mcp/README 1.1), and five requirement
rows were never written into PLAN. One privacy finding is real and on production today: the public trip pages say
"Finished plan" from the household's real trip date (`isDone`); the second half of BACKLOG 15.310 (the "home time zone") is
a false alarm. **Decision:** one table and one order, kept in MASTER-ORDER; a 2.5 h privacy fix PRIV-TD in bundle A before
its deploy; bundle C kept as one bundle with a cut rule (Q309); from bundle G the web seat B1 also takes the Sonnet builds
of the MCP lane so B2 does not become the critical path. **Trade-off:** a bigger, honest plan (about 37% more hours than
the 986 h the owner last saw) against a plan whose totals and order nobody could trust.

## 1. Method and state

Read in full or in the parts that decide order and size: CLAUDE.md, PLAN, MASTER-ORDER, RELEASE-PLAN, DATA-PLAN,
AUDITS-AFTER-RELEASE (2.3, 6), TEST-STRATEGY (9.1), BACKLOG 15.220 to 15.326, TODO, briefs-bundle-A (4), and the five new or
changed specs: [entity-graph.md](../features/entity-graph.md) (EG, QG1 to QG5),
[protected-area-entry.md](../features/protected-area-entry.md) (PA, QP1 to QP6),
[property-display-matrix.md](../features/property-display-matrix.md) (PM, API, QM1 to QM10), the MCP product pages
[mcp/product.md](../mcp/product.md) and `product-*.md` with [tools-v1-from-api.md](../mcp/tools-v1-from-api.md) (QX1 to QX12,
Q-B1 to Q-B3), and [trip-and-places-ux-fixes.md](../features/trip-and-places-ux-fixes.md) with
[uxb-components-2026-10-26.md](../design/trip-page/uxb-components-2026-10-26.md) (UXB, Q293 to Q307).

State of `main` at 88404219 (from `git log`), merged since the bundle plan of the morning:

| Bundle | Merged | Still open |
|---|---|---|
| A | OVR-0, NAV-F, NAV-1, NAV-R1, NAV-1F, NAV-2C, NAV-2, NAV-R2, NAV-2F, FAV-1W, FAV-1, FAV-1X, TRP-GL-C, TRP-GL-C-RV, TRP-GL-CF, TRP-GL, TRP-GL-R, TRP-GL-F, TRP-GL-D, IMG-1a, IMG-1b, ACCT-PH-RV, BUD-1-RV, GSI-P-RV, V02-VERIFY, SAFE-STORAGE, OVERFLOW-FIX, KIND-FILTER-FIX, SLUG-FIX, HOUSEHOLD-SCRUB, L4; infra TS-1, TS-2a, TS-2, TS-3 | FAV-R and FAV-V (no merge found), FAV-1F if they ask, IMG-1V, TRP-GL-V, T2, T3, the owner actions, deploy, tag `release/A`; **PRIV-TD (new, section 3)** |
| C (early) | UXB-N, UXB-C, UXB-W, UXB-WL, UXB-1 (built; review "approve with changes, three must-fixes"), AREA-2, ORPH-7, D8-R (dateless booking rules) | UXB-1F (in its worktree), then the rest of C |

No `release/A` tag exists; production still runs v0.1 (`release/v0.1`).

## 2. Disagreements found, and how each is resolved

### 2.1 Bundle membership and hours

| # | Where | Disagreement | Resolution (applied in) |
|---|---|---|---|
| A1 | MASTER-ORDER 0, RELEASE-PLAN 0a.2, PLAN R-250 | Bundle C is 180.5 h; its "Build" breakdown (v0.6 48, v0.7 13, v0.8 44, RIS-H 3) has no UXB task although the row text says "UXB tasks in the UI queue" | C is **301.5 h**: 180.5 + UXB 67 + entity graph (bundle C part) 23 + parks P1 31 (MASTER-ORDER 0; RELEASE-PLAN 0a.2) |
| A2 | UX spec 12.2 ("247.5 h"), parks spec 12 ("about 234 h"), parks QP6 ("about 214 h"), entity-graph QG4 ("about 234 h") | four different totals for C, each adding only its own spec | the four pages keep their text (not rewritten); MASTER-ORDER 0 is the one number; QP6's answer stands (it was about placement, not the total) |
| A3 | RELEASE-PLAN 0a.2 D, E, G | the property matrix (D +13, E +6, G +8.5 then +22.5 with the MCP product), the graph (E +15) and parks P2 and P3 (E +23.5, G +21) are in no bundle total | D 131.25, E 213, G 119.5 (MASTER-ORDER 0) |
| A4 | RELEASE-PLAN 0a.2 H 56 h; tools-v1-from-api 15 "about 64 h"; product packaging 4 "81 h" | three sizes for H | **81 h** (product packaging 4 wins, as its banner on tools-v1 says) |
| A5 | No bundle page has H2 | product packaging 4: new bundle H2, 115 h, two deploys (v0.20a writes, v0.20b staging) | H2 added to the table **on the condition of QX2**; if QX2 is no, MP3 and MP4 return to "later" and the total drops by 115 h |
| A6 | Program total 986 h (MASTER-ORDER 0, RELEASE-PLAN 0a.2, PLAN R-250, TODO) vs "about 1,168 h" (product packaging 4) | 986 h predates five specs; 1,168 h adds only the MCP | **1,350.5 h** (I at 29 h): 986 + UXB 67 + graph 38 + parks 75.5 + MCP product with its API prerequisites and the old "later" MCP rows 181.5 + PRIV-TD 2.5 |
| A7 | Data hours 173 h (DATA-PLAN 2.1) | UXB-W 3, EG-M 2.5, EG-D 3, PA-R-CA 6, PA-MUS 2.5, PA-R-ON 4 are data-seat work outside DATA-PLAN | data **194 h** (DATA-PLAN 2.1 rows 45 to 50) |
| A8 | MASTER-ORDER 5.4 rows 18 and 19 put MCP-C and MCP-1 in bundle F's and G's windows | MCP-C is blocked by API-G, API-P, API-T, API-S, API-V and PM-G (tools-v1 F10), which land in E and G | MCP-C moves to bundle H's window (5.4) |
| A9 | MASTER-ORDER 3.8, RELEASE-PLAN 3 "Not on this train": MCP-3, MCP-P, REQ-M "later" | product packaging 4 puts them in H2 (MP3, MP4) | in H2 if QX2 is yes; the "later" cells point to 3.9 |
| A10 | AUDITS-AFTER-RELEASE 2.3 gate G-UI: "every UI release and the MCP surfaces live (v0.20, v0.21 if shipped)" | the MCP Apps views and the approval page (H2) are new screens; product packaging 7 says J follows H2 | J follows H2 when QX2 is yes; AUDITS 2.3 and AU-GU need the words "and v0.20a, v0.20b" (BACKLOG 15.330, for the AUDITS page owner; this page does not edit it) |
| A11 | Bundle C is now 3.7 times bundle A; its B1 path is about 128 h against A's 38.5 h | the owner merged bundles to cut verification; a bundle this long delays every C feature | keep one bundle C and apply rule B3 with a named cut (Q309): C cuts when the UX round, parks P1 and the closure queue are verified; PHO-R, R-59 and getting there ship dark if late |

### 2.2 Ids and numbering

| # | Collision or gap | Resolution |
|---|---|---|
| N1 | R-252 is the MCP rule and R-253 parks (fixed on `main` at 4d4eae90); the entity graph, the property matrix and the MCP product have **no PLAN row**; the MCP product proposes R-270 | new rows **R-254** (entity graph), **R-255** (property catalogue, display matrix and the API-derived MCP), **R-256** (this alignment), **R-257** (privacy: no household-derived status on public trips); **R-270** kept as proposed (free, and quoted in product.md and QX1). R-258, R-259 and R-267 to R-269 stay free |
| N2 | MCP product phases "M1 to M5" (product.md 5, packaging 3) reuse the ids of the R-252 rules M1 to M5 (mcp/README 1.1, quoted as "R-252 M3" in tools-v1-from-api) and the old "M1" map preview | the phases (written later) are renamed **MP1 to MP5** in the plan pages; the product pages keep "M1 to M5" until their next edit, read through this map. The README rules keep M1 to M5 |
| N3 | Question ids: QP1 to QP6, QG1 to QG5, QM1 to QM10, QX1 to QX12, Q-B1 to Q-B3 beside numbered Q293 to Q307 | no collision: the prefixed ids are namespaced and stay; the parks questions were already moved off Q303 to Q307 (cb4a2a45). New questions from this page take the next free numbers, **Q308** and **Q309** |
| N4 | Q290 used twice (DATA-PLAN 6.2 and briefs-bundle-A 9) | both answered; PLAN 5 already records both; no change |
| N5 | BACKLOG 15.290 to 15.326 | no duplicate row ids (checked with `uniq -d`); 15.300 to 15.312 were written "to be reconciled with ENTITY-SPEC" and do not overlap 15.295 to 15.299; 15.308 (MCP resize) and 15.309 (MCP-GR) are superseded in hours by 15.316 and 15.317; 15.325 (bundle H2 docs edits) is done by this page. New rows **15.327 to 15.331** |
| N6 | "H2" is both a housekeeping task (MASTER-ORDER 3.2: copy the commit map) and the new bundle | the bundle keeps the label **H2** because QX2 asks the owner under that name and its tag `release/H2` cannot clash with a task; the housekeeping row is read "H2 (housekeeping)" |
| N7 | MCP-R (property matrix 12) and MCP-M (product packaging 4) | one task, **MCP-M** (the product page renamed it) |
| N8 | TODO header lists "R-250 to R-252, R-260 to R-266" | header now lists R-250 to R-257, R-260 to R-266, R-270 |

### 2.3 Contract-first ordering (MASTER-ORDER 4.3, one author at a time)

| # | Conflict | Resolution |
|---|---|---|
| C1 | `core/src/schema/capture/{records,properties}.ts`, `enums.ts`, `validate/capture.ts`, `codes.ts`, `data/vocab/types.json` are written by RIS-H (C), EG-C (C), PA-C (C), PM-C (D), STY-P (D/E), FA-4 (F) and PA-3C (G); MASTER-ORDER 4.1 listed only STY-P and RIS-H | one chain, in this order: **RIS-H, EG-C, PA-C, PM-C, STY-P, FA-4, PA-3C** (4.1 and 4.3). PM-C before STY-P (PM-C widens `PropertyDef`; STY-P adds rows) |
| C2 | EG-Q "after REQ-RF-C, before OVR-Ca" (entity-graph 13) while MASTER-ORDER moved OVR-Ca to B2 row 13 right after REQ-RF-C | B2 row 13 runs **REQ-RF-C, EG-Q, OVR-Ca**; OVR-Ca slips about 4 h, D7 still starts inside D's window (data seat has spare there) |
| C3 | `core/src/catalogue/store.ts` and `core/src/schema/api/{place,trip}.ts` gain EG-Q, PA-Q, API-P, PA-X and PRIV-TD | store and API chain: PRIV-TD (A), LST2b-C, PHO-C, PA-X, R59-C, ORG-C (C), CAT-Q, FBK-C, REQ-RF-C, EG-Q, OVR-Ca (D), STY-Ca, STY-E, PA-Q, API-P, TD-1 (E), CUS-C (F) ... (4.3) |
| C4 | PM-F owns the import lines of `web/lib/public/sections.ts`, which UXB-7 rewrites | PM-F after UXB-7 merges (both specs agree); PM-F is a Sonnet core build and goes to **B1** in D's window, where B1 already holds `sections.ts` |
| C5 | API-G edits `web/lib/server/respond.ts`, used by every `/api/v1` route | API-G merges alone in its stack, first (TEST-STRATEGY 9.1 `full` path), at a quiet point in G after REQ-G-C |
| C6 | PA-X and R59-C both widen the trip payload (`core/src/schema/api/trip.ts`) in C | PA-X first (it waits only on PA-C), then R59-C; R59-1 is late in B1's C queue, so nothing waits |
| C7 | PA-W owns `web/components/trips/tabs/BookingsPanel.tsx` and `summary/**`, created by UXB-1 and UXB-6 | PA-W after UXB-R1, UXB-V1 and UXB-F (4.1 trip-page chain) |
| C8 | EG-I adds a check-all step and a `tools/gate/map.json` row; `data/catalogue/graph/**` is generated and committed | `tools/check-all.sh` and `map.json` stay append-only, serial merges; after EG-I every data batch rebuilds the graph in the same commit (one writer, the data seat); CLAUDE.md's generated-files list needs `data/catalogue/graph/**` (owner edit, MASTER-ORDER 8.1) |
| C9 | Migrations: `relation_kinds` (EG-M), `user_place` (UPL-C), `research_stage` (STG-C) are in no list; the parks spec said "no Neon migration in P1" | MASTER-ORDER 4.4 rows added; `relation_kinds` is applied to the child, then production, in C before the first sync that carries `covered_by` rows (QG5) |
| C10 | Budgets: UXB's trip tasks start from about 460 B of trip start JS; UXB-7 must lower the place median; EG-W, PA-2 and PHO-R add to place pages | 4.5: UXB-7 first and its one re-baseline; then the C data batches; then PHO-R; EG-W and PA-2 (E) as lazy sections, each merging alone with `budget:report` |
| C11 | PM-G and MTH-G both read `capture.ts build` outputs; PM-G writes `core/src/capture/generate.ts` (one writer) | PM-G alone on `generate.ts`; MTH-G (G) reads the matrix, never writes it |

### 2.4 Data-seat tasks

| # | Finding | Resolution |
|---|---|---|
| D1 | EG-M is "data seat (lane S), Opus", after RIS-L; EG-D needs EG-C and EG-I; PA-R-CA needs PA-C; PA-MUS (E) and PA-R-ON (G); none is in DATA-PLAN | DATA-PLAN 2.1 rows 45 to 50; seat schedule 2.2 |
| D2 | DATA-PLAN 2.1 shows TRP-GL-D, L4, ORPH-7, AREA-2 as pending | marked done (merged) |
| D3 | Bundle C's B1 queue is now about 128 h, its data queue about 59 h plus 11.5 h new: the data seat would idle | the D10 splits for the other trips (D10-UT to D10-PAST, 8 h) and D8-R's remaining facts move into C's window; they still count in D and E. This also keeps them before REQ-RF, as 0a.3 row 6 requires |
| D4 | RIS-H is "B2 row 8" in the data table; EG-C waits for it | RIS-H is now the first link of the C1 chain; it does not wait for QG answers and can start now |
| D5 | D5c must come before UXB-3 for Summary highlights (UX spec Gotchas) but sat late in C's data queue | D5c moves up in C's data queue, after TRK-1 (Commons runner free) |
| D6 | The parks research PA-R-CA overlaps the Rockies D10-RO split (same lane files `canadian-rockies-2029/CS7.json`) | PA-R-CA owns `catalogue/PA-ca.json` and additions to CS7; D10-RO runs before PA-C lands or after PA-R-CA merges, never beside it |

### 2.5 Stale banners and statuses (fixed in the owned pages)

| Page | Stale text | Now |
|---|---|---|
| MASTER-ORDER line 3, RELEASE-PLAN line 3, PLAN line 5 | "planned, waiting for design approval G-UXA" | G-UXA passed 26 Oct (ANSWERS-6); UXB-N, UXB-C, UXB-W merged; UXB-1 built and reviewed |
| MASTER-ORDER 3.3 to 3.6 status cells | BUD-1 "blocked: Q260", OVR-0 "ready", NAV-1 "blocked", FAV-1 "blocked", TRP-GL "blocked", IMG-1 "ready" | listed as done in the new 3.0 (the rows are not rewritten one by one) |
| MASTER-ORDER 3.5 | MCP-C "ready (core only)" | blocked by API-G, API-P, API-T, API-S, API-V, PM-G, AU-D |
| TODO row "Protected areas" | "QP1 to QP6 open", "P1 (33.5 h)" | answered; P1 31 h, P2 23.5 h |
| TODO rows "One plan for all data", "Merge a few releases"; BACKLOG 15.262 | "Q290 open" | answered 26 Oct |
| features/README.md row 45 | not checked line by line; not owned here | the README owner refreshes it at the next spec merge (15.330) |

### 2.6 Spec-to-spec contradictions and the resolution picked

| # | Contradiction | Resolution |
|---|---|---|
| S1 | Property matrix 11 E3, E4 and product packaging 6 assume new routes `GET /api/v1/places/{slug}/related` and `/needs` for the graph tools; the entity graph (9.1, 9.3) decided `getPlace(slug).context: PlaceContext`, the `within` facet on lists and counts, and `getPlace(slug).entry` with `?mode=&month=` | **The entity graph wins** (it owns relations). No `/related` or `/needs` route. `get_related` is a projection of `list_places {within}` plus `get_place` `context`; `place_needs` is a projection of `get_place` `entry` with mode and month. MCP-GR (2 h) stays; its dependency becomes EG-Q and PA-Q, both in E, so QM9's "dark if the routes are missing" no longer bites |
| S2 | tools-v1-from-api 0: "12 public tools", bundle H 64 h; product pages: 21 tools, H 81 h | the product pages win (their banner on tools-v1 says so) |
| S3 | BACKLOG 15.310 and tools-v1 6.4 and Gotchas: `days[].zone.home`, `homeAbbr` are "the household's home time zone" | **False alarm**: the only data holding them (`data/schedules/canadian-rockies-2029.json`, day 6) says `"home": "Mountain time"`, the trip's base zone, which the page prints as "Back on Mountain time (MT)" after the Pacific-time day at Mount Robson. No household value. The MCP projection may still drop the pair; a rename to `base`, `baseAbbr` can ride TD-1. `isDone` is real (section 3) |
| S4 | Parks spec 5.1 "no Neon migration in P1" | superseded by entity-graph 11.3 (EG-M); QG5 asks it |
| S5 | Property matrix 12 lists MCP-R; product packaging 4 lists MCP-M | MCP-M (N7) |
| S6 | Product packaging 3: MP1 needs "PA-Q (E)" for `place_needs`; property matrix 12: API-P needs PA-Q | consistent once S1 is applied: both read `getPlace` and PA-Q's `PlaceLookup.entry` |
| S7 | mcp/README principle 1 "about 25 tools" vs 21 public and up to 50 at `owner_admin` | product packaging 7 resolves it (levels filter `tools/list`; Q196 accepted about 38); kept |
| S8 | Product direction "planner second" vs user plans with private places through MCP (UPL-C, H2) | H2 comes after the whole public site (A to H) and adds no planner UI; `user-plan/1` is built on TD-1's trip schema so the planner can adopt it. Consistent with the order; the owner sees it inside QX2 and QX5 |
| S9 | REQ-M "after MCP-3 and MCP-S" (requests spec) vs v0.20b | consistent (MP4 runs REQ-M after MCP-3, reviewed by MCP-S4) |

### 2.7 Specs with no master row, and master rows with no spec

| Item | Was | Now |
|---|---|---|
| EG-C, EG-R0, EG-M, EG-FX, EG-I, EG-D, EG-DOC, EG-N, EG-Q, EG-W, EG-R/EG-V | spec only | MASTER-ORDER 3.9 rows |
| PA-C, PA-FX, PA-X, PA-D, PA-R-CA, PA-W, PA-M, PA-R1/V1, PA-N, PA-Q, PA-2, PA-DV, PA-MUS, PA-R2/V2, PA-N3, PA-3C, PA-3, PA-R-ON, PA-R3/V3 | spec only | 3.9 rows |
| PM-C, PM-G, PM-F, API-P, API-G, API-T, API-S, API-V, MTH-G, MTH-1 | spec only | 3.9 rows |
| MP1 to MP4 tasks (AU-D, MCP-C, MCP-1, MCP-M, MCP-GR, ORG-MCP, MCP-PK, MCP-EV, MCP-S1, MCP-E1; MCP-G to MCP-E; UPL-C, UPL-1, MCP-W, MCP-P, MCP-UI, MCP-S3, MCP-EV2, MCP-E3; STG-C, STG-1, STG-P, MCP-3, REQ-M, MCP-A, MCP-P2, MCP-S4, MCP-EV3, MCP-E4) | spec only, or old hours in 3.8 | 3.9 rows; 3.8 points there |
| UXB-N to UXB-F | MASTER-ORDER banner only | 3.9 rows with status |
| PRIV-TD | no task (15.310 was a finding) | 3.9 row, brief in section 3 |
| PMD (property matrix docs follow-up) | open | done by this page, except AUDITS 2.3 and features/README (15.330) |
| Master rows with no spec | none found: every 3.x row names a spec or a brief. Two rows have only a BACKLOG line as their spec: CAT-V (CATALOGUE-EARLY 11.6 has the brief) and R-14 (closure plan 2) | no change |

## 3. Privacy finding 15.310: verified, and the fix PRIV-TD

**Verified on `main` 88404219 and on production's commit `47be5b58`.** `web/lib/public/trips.ts` 427 to 428 sets
`isDone = Date.parse(hub.date) + (nights + 1) * 86400000 < Date.parse(src.today)`, where `hub.date` is the `trip-date`
meta of the old hub page (`tools/hub.py` 101), the household's real start date. `isDone` is in the public contract
(`core/src/schema/api/trip.ts` 41 and 206), so `/api/v1/trips` and `/api/v1/trips/{slug}` serve it, and the pages render it:
`TripCover.tsx` 34 prints **"Finished plan"** instead of "Published plan", `TripCover.tsx` 49 and `trips/[slug]/page.tsx` 50
branch on it, `TripEnd.tsx` 16 changes the closing sentence, `web/app/trips/rows.ts` 84 sorts finished trips last, and the
trip descriptor writes `data-trip-done`. The same lines are in `47be5b58`, so **the live v0.1 site serves it today**. It
tells any visitor which trips the household has already taken and, with the trip's length, roughly when; PLAN section 1
forbids "personal status" and dates on public pages. No owner decision is needed to remove it (the rule exists); Q308
only lets the owner object to the visible wording change.

`days[].zone.home` and `homeAbbr`: not household data (2.6 S3). No fix.

**Schedule.** PRIV-TD rides **bundle A, before its deploy**; it is small, touches files bundle A has already finished
with, and the next deploy is the only way to take the label off production. It is the next author of `trip.ts` (before
PA-X). If bundle A's deploy is close, PRIV-TD merges first in the final stack.

### 3.1 Brief: PRIV-TD (B2, Opus contract 1 h, Sonnet web 1 h, verifier 0.5 h; BACKLOG 15.328)

- **Goal.** No public trip output (HTML, `/api/v1` bodies, share images, exports) carries a value derived from the
  household's real trip dates. Every public trip reads as a published, dateless plan (PLAN 1 Privacy; P9: the boundary
  carries only public fields).
- **Owns.** `core/src/schema/api/trip.ts` (remove `isDone` from the trip row and detail schemas; add a doc comment on
  `zone.home` and `homeAbbr`: "the trip's own base zone, never the household's"), `core/src/privacy/detect.ts` (key
  `isDone` refused in public payloads), `core/src/catalogue/stub/fixture.ts` (drop the key), regenerated
  `data/schema/generated/**` (OpenAPI) through its exporter, `web/lib/public/trips.ts` (drop the computation),
  `web/lib/public/types.ts`, `web/components/trips/types.ts` (key list), `web/components/trips/TripCover.tsx`,
  `web/components/trips/TripEnd.tsx`, `web/app/trips/[slug]/page.tsx`, `web/app/trips/rows.ts`,
  `web/lib/entities/descriptors/trip.tsx`, `TripActions` prop `done` only if it becomes unused, new
  `web/tests/privacy/trip-status.test.ts` and `core/test/privacy/trip-status.test.ts`.
- **Must not touch.** `tools/hub.py`, `legacy/**`, `data/**` (other than the regenerated schema), `web/app/themes.css`,
  any UXB file not listed (`trips/tabs/**`, `trips/summary/**` belong to UXB-1F until it merges; rebase on it if it merged
  first), MASTER-ORDER, RELEASE-PLAN, PLAN, HANDOVER, CLAUDE.md.
- **Steps.** 1. Contract (Opus): remove `isDone` from both schemas; the detector refuses the key on public payloads; the
  stub fixture follows. 2. Web (Sonnet): remove the computation; the cover says "Published plan" (overview trips keep
  "Overview"); one `TripEnd` sentence ("Copy it to plan your own dates, or export it ..."); the list sort drops the done
  key (depth, then title); remove `data-trip-done` and the `done` phase. 3. Tests: a built-HTML test that no trip page
  contains "Finished plan" and no list row carries `data-trip-done`; an API test that `/api/v1/trips` and
  `/api/v1/trips/{slug}` bodies have no `isDone` key; a detector test that a planted `isDone` in a public payload fails;
  a test that `zone.home` equals the zone label of a base of the same trip (guards S3).
- **Acceptance.** `pnpm --dir core exec tsc --noEmit` and `pnpm --dir web exec tsc --noEmit` 0 errors; the new tests and
  the existing trip, privacy and API contract suites green (TEST-STRATEGY T1 map selection); `budget:report` before and
  after in the public and sign-in-on builds: trip start JS and place HTML not larger; Playwright screenshots of
  `/trips/`, `/trips/algonquin-muskoka-2026/` and `/trips/canadian-rockies-2029/` (cover and end) at 1440x900 and
  390x844 in light and dark, saved outside `web/test-results/` (verification shots in `web/test-results/shots/` are
  gitignored and wiped by Playwright, so copy them to `/Users/nks/workspace/travel-wt/shots-PRIV-TD/`); then
  `travel-verifier` (no design review needed: one word changes; the reviewer may waive).
- **Commit.** Two commits: `core(PRIV-TD): public trip contract carries no household-derived status (P9)` and
  `web(PRIV-TD): trips read as published plans; no finished state from household dates (P2, P9)`. Stage only owned paths
  with `git -C <worktree> add <paths>`, never `-A`; end with the Co-Authored-By trailer of the model that did the work;
  do not push or merge. Delete the worktree's `node_modules` and `.next` after the hand-back.

## 4. Numbering map (applied)

| Old or proposed | New | Where applied |
|---|---|---|
| (none) entity graph | R-254 | PLAN 2, TODO header, BACKLOG 15.295 |
| (none) property matrix and API-derived MCP | R-255 | PLAN 2, BACKLOG 15.300 |
| (none) this alignment | R-256 | PLAN 2, BACKLOG 15.327 |
| BACKLOG 15.310 finding | R-257, task PRIV-TD, BACKLOG 15.328 | PLAN 2, MASTER-ORDER 3.9 |
| "proposed R-270" | R-270 (kept) | PLAN 2 |
| MCP product phases M1, M2, M3, M4, M5 | MP1, MP2, MP3, MP4, MP5 | MASTER-ORDER, RELEASE-PLAN, PLAN, BACKLOG 15.316, 15.317 text |
| MCP-R | MCP-M | MASTER-ORDER 3.9 |
| 15.308, 15.309 hours | superseded by 15.316, 15.317 | BACKLOG |
| bundle "H2" vs housekeeping "H2" | bundle keeps H2; the task reads "H2 (housekeeping)" | MASTER-ORDER 3.2 |
| new owner questions | Q308, Q309 | section 9 here, PLAN 5 |
| new backlog rows | 15.327 to 15.331 | BACKLOG |

## 5. The one ordering, in summary (canonical copy: MASTER-ORDER 0, 4.3 and 5.4)

### 5.1 Bundles

Hours are the planned scope (the 0a.2 convention: work merged before the morning of 26 Oct is not counted; work merged
since is counted and shown in the last column).

| Bundle | Features | Build | Infra | Data | **Total** | Added today | Migrations | Status 26 Oct evening |
|---|---|---|---|---|---|---|---|---|
| A | v0.2, v0.3, v0.4; PRIV-TD | 59 | 20 | 5 | **84** | PRIV-TD 2.5 | none | built except FAV-R, FAV-V, IMG-1V, TRP-GL-V, PRIV-TD, T2, T3, deploy |
| B | v0.5, v0.9; CAT-1 | 37.5 | 8 | 36.5 | **82** | | `backup_reader`, `research_meta` | not started (lane S not started) |
| C | v0.6, v0.7, v0.8; UX fixes; parks P1; graph contract and index | 214.5 | 10 | 77 | **301.5** | UXB 67, EG 23, PA 31 | `relation_kinds` | UXB-N, UXB-C, UXB-W, AREA-2, ORPH-7 merged; UXB-1 in fixes |
| D | v0.10, v0.11; property matrix (Internal) | 104.75 | 13 | 13.5 | **131.25** | PM-C, PM-G, PM-F 13 | `intake` | |
| E | v0.12, v0.13, v0.14; graph read model and place context; parks P2; facts read model | 155 | 0 | 58 | **213** | EG 15, PA 23.5, API-P 6 | none | |
| F | v0.14.1, v0.15, v0.16 | 100.75 | 0 | 0 | **100.75** | | `custom_draft`, `draft_cap`, `account_favourite`, `account_start` | |
| G | v0.17, v0.18; parks P3; API for MCP (Internal) | 93 | 22.5 | 4 | **119.5** | PA 21, API-G, API-T, API-S, API-V, MTH-G, MTH-1 22.5 | none | |
| H | v0.19 (MP1), v0.20 (MP2) | 81 | 0 | 0 | **81** | +25 | `mcp_access`, token tables | |
| H2 | v0.20a (MP3), v0.20b (MP4); **only if QX2 is yes** | 115 | 0 | 0 | **115** | new | `user_place`, `research_stage` | |
| I | v0.21, on the Q148 trigger | 29 or 42.5 | 0 | 0 | **29 or 42.5** | | mail tables | |
| J | v0.22, after H2 | 70.5 | 0 | 0 | **70.5** | covers the MCP views and approval page | none | |
| K | v1.0 to v1.2 | 23 | 0 | 0 | **23** | | none expected | |
| **All** (I at 29) | | **1,083** | **73.5** | **194** | **1,350.5** | **+364.5** | | |

### 5.2 Contract order (one author at a time on the shared contract files)

NAV-C, FAV-C, FAV-1W, NAV-2C, TRP-GL-C, UXB-C (done) → **PRIV-TD** (A) → LST2b-C → PHO-C → **RIS-H → EG-C → PA-C → PA-X**
→ R59-C → ORG-C (C) → CAT-Q → FBK-C → **PM-C** → **PM-G** → REQ-RF-C → **EG-Q** → OVR-Ca (D; PM-F after UXB-7 in B1) →
STY-P → STY-Ca → STY-E → **PA-Q** → **API-P** → TD-1 (E) → CUS-C (F; after FA-D and `planner_draft_signal`) → NAV-D,
FAV-D (F) → STY-2C, REQ-E-C, R59-3C, **PA-3C** → REQ-G-C → **API-G** (alone) → **API-T, API-S, API-V, MTH-G** (G) →
MCP-C → MCP-G (H) → **UPL-C** → **STG-C** (H2). EG-M (`relation_kinds`) runs in the data seat after EG-C and RIS-L, outside
this chain (a migration, not a shared contract file).

### 5.3 Critical path

B1 carries it: about **511 agent hours left** (A about 3, C about 128, D about 56.5, E about 91, F about 53, G about 66,
H about 31.5, H2 about 53, J about 29). B2 about 430 h; the data seat about 185 h. The longest chain inside C is
QG1 to QG5 answered → RIS-H 3 → EG-C 6 → EG-R0 1 → EG-FX 2.5 → EG-I 6 → PA-C 6 → PA-FX 3 → PA-X 4 → PA-D 3.5 (B2,
35 h) with PA-R-CA (data, 6 h) beside it, joining B1 at PA-W after the UX round (about 50 B1 hours in), so the QG answers
must come within about a week of B1 starting C or B1 waits. In D, B2 and B1 are about equal (54 and 56.5 h) after PM-G
moves to the data seat and PM-F to B1. From G onward B1 takes the Sonnet builds of lane X (MCP-1, MCP-M, MCP-GR,
ORG-MCP, MCP-PK, MCP-U, MCP-E1, MCP-E, UPL-1, STG-1, STG-P, MCP-UI, MCP-P2), so B2 keeps only contracts, security code
and the evals.

## 6. What can safely build now, and what waits

**Safe now** (contract settled, owner answers in, files free; seat in brackets):

| Task | Why it is safe | Seat |
|---|---|---|
| PRIV-TD | standing privacy rule; files done with by bundle A | B2 (Opus 1 h), then Sonnet 1 h, verifier |
| Bundle A remainder: FAV-R, FAV-V (and FAV-1F if asked), IMG-1V, TRP-GL-V, T2, T3, owner actions, deploy | briefs-bundle-A 4.1 rows 17 to 22 | R, V, coordinator |
| UXB-1F, then merge UXB-1 | review done; three must-fixes in the worktree | B1 |
| UXB-2, UXB-3, UXB-4 (UXB-W merged), UXB-5, UXB-6, UXB-R1, UXB-V1; UXB-7 (FAV-1 merged), UXB-R2, UXB-V2; UXB-F | G-UXA passed; Q293 to Q307 answered; contracts UXB-C merged | B1 (UXB-5, UXB-6, UXB-7 may use a second B1 worktree only if the coordinator runs one) |
| LST2b (with LST2b-C), LST2c, MX, R-14, GB-A-4; CONS-3 at a quiet point | closure queue; no new contract | B1, B2 |
| PHO-C; PHO-R after UXB-7 and the C data batches | Q263 answered, IMG-1 merged | B2, B1 |
| R59-N, R59-C, R59-1 (after the UX round); ORG-C, ORG-D, ORG-M, ORG-A, ORG-G, then ORG-N, ORG-1, ORG-2 | Q240 to Q249 answered | R, B2, data, B1 |
| **RIS-H** | first link of the capture-contract chain; independent of the graph questions | B2 |
| Bundle B: EML-S, EML-V, EML-P, BKP-1, GSI-0 onward; lane S: LOCAL-3, RIS-M, RIS-L, RIS-T, LOCAL-5, CAT-V, DV-1 | Q280 to Q286 and the auth questions answered | B2, data seat |
| TS-4, TS-6, TS-5, TS-7 | Q250 to Q258 answered | B2 between contracts |
| Data: TRK-1, D5c (Commons runner), D3, TRL-REL, TRK-CA, TRK-RW, TRK-DO (not Siusi), D10-RO, D10-DO, OFR-1 (25 offers after RIS-H), D8-R facts, D10-UT to D10-PAST | DATA-PLAN 2.3 answered | data seat, one task at a time |

**Must wait for planning answers:**

| Task | Waits for | Bundle |
|---|---|---|
| EG-C, EG-R0, EG-FX, EG-I, EG-D, EG-DOC, EG-M | QG1, QG3, QG4, QG5 | C |
| PA-C, PA-FX, PA-X, PA-D, PA-R-CA, PA-W, PA-M, PA-R1/V1 | EG-C (so the same QG answers) | C |
| TRK-DO for Siusi; STO-1 for Grand-Sault | the owner's two picks | C, D |
| PM-C, PM-G, PM-F | QM1, QM2, QM7 (QM3 for PM-F) | D |
| EG-N, EG-Q, EG-W | QG2 (EG-W's variant display), EG-C | E |
| API-P | QM3 | E |
| D7 for Utah and Norway; D9 and STY-1 bases | Utah and Norway dates; Dolomites base split; Switzerland pass | E |
| CUS-C | `planner_draft_signal` | F |
| API-G, API-T, API-S | QM5 | G |
| API-V, MTH-G, MTH-1 | QX8, QX9 | G |
| MCP-C and every MP1 task | QX1, QX7, QM4, QM6, QM8, QM10, QX10 (evals) | H |
| Every MP3 and MP4 task | QX2 first, then QX3, QX4, QX5, QX6, QX11, Q-B2, Q-B3 | H2 |
| Bundle C's cut and T3 plan | Q309 | C |

## 7. Risks this alignment adds

| Risk | Effect | Recommendation |
|---|---|---|
| Bundle C is 301.5 h | every C feature waits for the slowest | Q309: cut rule, late features dark (B3) |
| QG answers arrive late | B2's graph and parks chain (35 h) misses PA-W's slot; B1 idles or PA-W slips to D | ask QG1 to QG5 first after the A deploy questions |
| B2 becomes critical in D and H | B1 waits for contracts | PM-G to the data seat, PM-F to B1; lane X Sonnet builds to B1 from G |
| The program grew 37% in a day | owner expectations; Opus weekly cap | MP3 and MP4 hang on QX2; if no, 115 h drop out |
| `relation_kinds` must be on production before C's sync | a sync fails on `covered_by` rows | EG-M on the child in C's window; production at C's release before step 9a |

## 8. Follow-ups outside the owned pages (BACKLOG 15.330)

| Page | Edit | Owner |
|---|---|---|
| AUDITS-AFTER-RELEASE 2.3, 6 (AU-GU) | G-UI also needs v0.20a and v0.20b live when QX2 is yes | AUDITS page owner (planner) |
| features/README.md row 45 and the UX row | status words | next spec merge |
| CLAUDE.md generated-files list | add `data/catalogue/graph/**` (after EG-I) and `data/schema/generated/property-matrix.*` (after PM-G) | owner (MASTER-ORDER 8.1) |
| mcp/product*.md, tools-v1-from-api.md | read M1 to M5 as MP1 to MP5; graph tools per 2.6 S1; `zone.home` per S3 | the MCP spec owner at its next edit |

## 9. Consolidated owner questions (every one still open, de-duplicated, ordered by what blocks the next build)

Each question keeps its id. "Blocks" says what waits: **(a)** the bundle A release, **(b)** the start of bundle C's
contract work, **(c)** later. A recommendation is given for each; "yes as recommended" is enough.

### 9.1 First: the two real tensions about research through the MCP

**Tension 1 (QX4): can an admin's AI write research straight into the shared catalogue?** You want admins to add research
to the catalogue directly through the MCP. The MCP spec chose: the AI stages a batch; you approve it on our site; it is
exported to a git branch, checked by the same validators as every data batch, merged and shipped in the next release.

| Option | What happens | Consequence |
|---|---|---|
| A. Spec as written (staged, approved on the site, shipped with the next bundle) | nothing reaches the catalogue without your click and every check | safest; a new fact goes live with the next bundle, which can be weeks away |
| B. Staged and approved as A, then **published within a day** by an automatic export and a small data-only release (no feature flags change, a data gate and a smoke run, no full T3) | your approval is the last human step; the release follows on its own | fast enough to feel direct; keeps git as the record, every validator and rollback by revert; costs about 8 h (export job, data-release checklist) and more deploys, which matters on the one-deep Hobby rollback |
| C. Direct write by an admin token into the catalogue tables | the AI's write is the publication | **it would not even show:** until bundle K the public site reads the files in git, not Postgres; it also breaks "the files are the seed of record" (CAT-V would flag every such row as drift) and lets one leaked token rewrite the catalogue |
| D. The MCP commits JSON to a git branch for you to merge | the AI writes files, you merge | the MCP server would hold write access to the repository, the biggest key we would own; review moves from our approval page to a raw diff |

**Recommendation: B.** It gives you the directness you asked for (research lands in about a day, from the chat), keeps a
person in the loop and every check, and is the only option whose result is visible before bundle K. Decide it with QX4
("yes, with option B" or "yes, option A").

**Tension 2 (QX3): who reads the web?** You want the MCP to research new destinations. The spec says our server never
fetches third-party pages: the client's model (Claude, ChatGPT, with their own web tools) does the research, and our
tools give it the brief, check its draft and stage it. Under the spec the MCP does research new destinations; what it does
not do is browse on our server.

| Option | Consequence |
|---|---|
| A. Spec: the client researches, we validate and stage | no server-side request forgery risk, no OSM, Wikidata or Commons rate-limit breach from our host (our one-runner-per-service rule cannot be held across serverless instances), no fetch costs; a client without web access cannot research through us |
| B. Plus narrow server lookups by id from the open-data sources we already use (Wikidata item, OSM node or way, OurAirports, GeoNames), owner level only | better points and identities (no Google coordinates), works for weaker clients; about 15 to 20 h, a queue to keep one runner per service, and a security review; those services' usage policies limit volume from shared hosting |
| C. Server fetches any URL the model cites (to check quotes) | an open proxy; not recommended |

**Recommendation: A now, B considered after a month of owner use of v0.20b** (with evidence of what the client could not
find). Answer QX3 "yes" for A.

### 9.2 Blocks the bundle A release (a)

| Id | Question | Recommendation | If yes | If no |
|---|---|---|---|---|
| Q308 | The public trip pages stop saying "Finished plan" (computed from your real trip dates) and every trip reads "Published plan"; the `isDone` field leaves the public API. Object? (Proceeds under the standing privacy rule unless you object) | **No objection** | PRIV-TD rides bundle A; the live label disappears at A's deploy | the label and field stay public, against PLAN 1 "no personal status" |
| Owner inputs (MASTER-ORDER 7.3 rows 9, 10) | Vercel: `HOME_POINT_*`, `IMAGES_OFFLINE=1`, the beacon token, the `/api/v1` Firewall rule; the Q-D key restriction; copy `web/.env.local` | do them before the A deploy | A deploys | the build fails closed (home point) or images are fetched live |

### 9.3 Blocks the start of bundle C's contract work (b)

| Id | Question | Recommendation | If yes | If no |
|---|---|---|---|---|
| QG4 | The graph contract and index (EG-C to EG-DOC, 23 h) ride bundle C ahead of the parks contract; the graph read model and place context (15 h) ride E | **Yes** | parks P1 lands on the general graph in C | parks writes the same files first and the graph rewrites them later; `covered_by` has no target rules |
| QG1 | A park or a stand-alone lake is born in your locations list through the `location` skill (`place/<slug>`); zones, campgrounds, permits and variants inside it are `part/<root>#<slug>` or `offer/<root>#<product>`, one level deep; no new ref form | **Yes** | parks appear in your list and WISHLIST as ideas; one identity path | a second identity scheme beside the list and the slug registry |
| QG3 | A trail shows the requirements of where it starts, ends and how you reach it (Larch Valley needs the Moraine Lake shuttle), labelled with where each comes from, even when a visitor arriving another way would not need it | **Yes** | an occasional over-cautious row | a missed permit can stop a day |
| QG5 | The migration `relation_kinds` goes to the Neon child and then production in bundle C, before the first sync of park data | **Yes** | one more production migration in C | C's sync fails on the new park links |
| Q309 | Bundle C is now about 301.5 h (3.7 times A). Keep one bundle and cut it when the UX round, parks P1, the graph and the closure queue are verified, letting photos (PHO-R), stop links (R-59) and getting there ship switched off if late and switch on in D (rule B3)? | **Yes, one bundle with that cut** | one more T3 avoided; the UX fixes reach you in C as soon as they are ready | the alternative splits C into two bundles (C1 UX, parks, graph, closure queue; C2 photos, links, getting there): visible sooner, one more full verification round |
| Owner input | Siusi: which plateau walk is meant (TRK-DO) | your pick | the track is fetched in C | Siusi ships held back with a reason |

### 9.4 Later (c), in the order the builds need them

| Id | Question | Recommendation | Blocks | Consequence of yes / of no |
|---|---|---|---|---|
| QG2 | Trail variants (Larch Valley to the meadows, to Sentinel Pass) show on the main trail's page with an anchor, no page of their own | **Yes (no own page)** | EG-W (E) | yes: fewer pages, a search for the short name lands on the main page; no: one more page per variant, more sitemap and place-budget weight |
| Owner input | Grand-Sault: which of the 3 candidates | your pick | STO-1 (D) | the other 18 store places go ahead either way |
| QM1 | Every registry property carries its privacy class and where it is shown or exposed, with derived defaults | **Yes** | PM-C (D) | yes: one place decides a property's fate; no: six places keep deciding parts of it and can disagree |
| QM2 | The full property matrix is generated by `capture.ts build` and checked in check-all | **Yes** | PM-G (D) | yes: it cannot drift; no: a hand table that drifts |
| QM7 | `access_cost` is not asked of offers (tours, rentals, tickets, lodging) or events; entry costs live on the place | **Yes** | PM-C, PM-G (D) | yes: fewer blank fields; no: every offer keeps an unanswerable "permit" gap |
| QM3 | The API gets one facts model per place (`/api/v1/places/{slug}/facts`) that MCP, print and CSV read; the formatter moves to core | **Yes** | PM-F (D), API-P (E) | yes: one wording of every fact everywhere; no: MCP and export re-derive facts and drift |
| Owner inputs | Utah dates (hard line 1 Oct), Norway window and group size, Dolomites base split (3 or 2), Switzerland pass | your values | D7, D9, STY-1 (E) | without them those trips ship today's view |
| `planner_draft_signal` | Approve the one content-free table without row-level security, as built | **Approve** | CUS-C (F) | no: RLS-only with polling, CUS-C grows |
| QM5 | `sun` and the type checklists get their own `/api/v1` routes so every MCP tool has a route | **Yes** | API-S, API-T (G) | no: an exception list in the MCP rule |
| QX8 | Publish the research method (README, capture contract sections, checklists, lanes, formats, synthetic examples) as public MCP resources and prompts, privacy-scanned | **Yes** | MTH-G, MTH-1 (G) | yes: any AI can learn our format; no: only agents in this repository can |
| QX9 | A public, stateless `validate` route and tool, size-capped and rate-limited | **Yes** | API-V (G) | no: a model cannot check its own drafts before saving |
| QX1 | The MCP is five layers over one set of operations; R-252 extended as R-270, "never on the database" kept word for word | **Yes** | MCP-C (H) | no: the MCP mirrors read endpoints only |
| QX7 | Fix the response format `travel-view/1` (short text, typed payload, view hint, links) at v0.19 | **Yes** | MCP-C (H) | no: views later need tool changes |
| QM4 | MCP uses the API's page numbers, 25 rows a page | **Yes** | MCP-C (H) | no: a second paging scheme |
| QM6 | `get_place` reads one place per call | **Yes** | MCP-C (H) | no: a bulk read path (P8) |
| QM8 | Private MCP: start dates at "My plans, read"; travellers' ages and the starting town only with the "people" add-on | **Yes** | MCP-2 (H) | no: your home town leaves by default |
| QM9 | Graph tools only when their API answers exist | **Yes** (now moot: they exist from E, section 2.6 S1) | MCP-GR (H) | none |
| QM10 | No per-item export over MCP until after v0.20 | **Yes** | MCP-C (H) | no: export tools and their review join H |
| QX10 | Model-in-the-loop evals at the final check of H and H2, with your API keys, capped at USD 20 a run | **Yes** | MCP-EV (H) | no: we ship tools no model has been tried on |
| QX12 | Defer the public research toolkit and the Anthropic and OpenAI directory listings until after v1.0 | **Yes** | MP5 | no: listing work and its review move earlier |
| Q-B1 | If ChatGPT cannot sign in with client metadata documents, ChatGPT gets the public MCP only, rather than turning on open client registration | **Yes** | MCP-PK (H) | no: open registration, a wider attack surface |
| QX2 | Add bundle H2 after H with v0.20a "Plan with your AI" (user writes) and v0.20b "Research and admin" (staging), each with its own deploy and security review; J and K move after it | **Yes** | all of H2; the place of J and K | yes: +115 h, J and K about two B2 bundles later; no: MP3 and MP4 stay "later" and the total drops to about 1,235 h |
| QX4 | Catalogue writes through MCP only as staged batches approved on our site (see Tension 1 for the publish speed) | **Yes, with option B** | STG-C (H2) | see Tension 1 |
| QX3 | Our server never fetches third-party pages (see Tension 2) | **Yes (option A)** | MCP-3 (H2) | see Tension 2 |
| QX5 | A destination a user researches is their private plan with private places; it reaches the catalogue only as a suggestion you review | **Yes** | UPL-C (H2) | no: users could publish |
| QX6 | MCP Apps views (trip card, day timeline, map, booking list, date picker) in v0.20a, built in `web/` and reviewed as UI | **Yes** | MCP-UI (H2) | no: text and typed payloads only |
| QX11 | Staging is yours only in v0.20b; invited researchers later, after a month of your use and the staging security review | **Yes** | MCP-3, MCP-A (H2) | no: invites and their review in v0.20b |
| Q-B2 | If the globe's map tiles may not be used inside another app's frame, the MCP map view draws points and lines without tiles rather than adding a paid tile provider | **Yes** | MCP-UI (H2) | no: a paid provider and its terms |
| Q-B3 | Name the new labels v0.20a and v0.20b, no renumbering of v0.21 and v0.22 | **Yes** | H2 labels | no: two releases renumbered |
| GB-C-6 | Keep the home point at two decimals (the privacy circle may sit a few hundred metres off-centre) or store a finer one | your choice (no recommendation written) | nothing | either way nothing else waits |
| Owner inputs | Mail domain name and price (Q148 trigger), Peru dates and length, Google console steps (Q89), Neon dashboard Google credentials (Q123), the smn.gob.ar URLs | your values | I; Peru; M1 map; GSI-E (B); Patagonia weather links | each waits only for the value |
