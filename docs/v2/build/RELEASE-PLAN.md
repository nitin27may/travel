# Release plan: one ordered train from v0.1 to the Postgres cutover

> **26 Oct 2026, evening (ALIGN, R-256):** the bundle table of 0a.2 is rewritten with every task the specs of 26 Oct added
> (UX fixes, entity graph, parks, property matrix, API for MCP, the MCP product, the privacy fix PRIV-TD): C 301.5 h, H 81 h,
> new bundle **H2** (v0.20a, v0.20b) 115 h if the owner answers QX2 yes, 1,350.5 h in all. The ordering is
> [MASTER-ORDER](MASTER-ORDER.md) 0, 4.3 and 5.4; the audit and the consolidated owner questions are
> [alignment-2026-10-26.md](alignment-2026-10-26.md). The UX design is approved (G-UXA passed 26 Oct) and its build is in
> C's queue.

> **27 Oct 2026 (BUILDER-DEPS):** the builder program (trip builder TB-P1 to TB-P5, kinds and profile, drive model,
> sources, data coverage, My map) adds 945 h to bundles D to K (program 2,295.5 h; 2,181 h without H2). D carries the first
> slice FS-1 (feature v0.11b) and My map (v0.11a); E the country flow (v0.14a) and map ties (v0.14b); F suggested bases and
> getting there (v0.16a). No bundle G2 unless the new seat B3 is refused. 0a.2, 0a.3 rows 15 to 19, 0a.4; detail in
> [builder-dependency-map.md](builder-dependency-map.md).

> **26 Oct 2026: releases are bundles A to K (section 0a, owner decision).** The v0.x numbers below are feature labels.

Written 25 Oct 2026 by travel-planner (Opus) at `main` 52339a0. Planned only: nothing here is built or deployed by this
page. Requirement PLAN [R-180](../PLAN.md); owner questions Q220 to Q229 (section 9; **all answered 25 Oct 2026: Q220 to Q226, Q229 yes as recommended; Q227 and Q228 changed**). Release notes live in the root
[CHANGELOG.md](../../../CHANGELOG.md).

**The owner's request (25 Oct 2026).** "Add everything in detail and in proper order; make what is built live; then build
feature by feature and release each; keep release notes; make the repo public so GitHub Actions stops being a problem."
The public-repo decision belongs to the separate audit PUBLIC-AUDIT, which runs first. This page does not decide it; its
GitHub Actions plan (section 7) applies once the repository is public, and works unchanged on a private one.

**Supersedes:** "no production deployment" in the PLAN platform paragraph, the PLAN section 3 Hosting row, HANDOVER's
current section and EXECUTION-PLAN 13.2. Production has been live since 25 Oct 2026 at
https://travel-beta-tan.vercel.app, commit 47be5b5, migrations 0001 to 0011 applied. The TODO row "Owner action: turn on
the Cloudflare Web Analytics beacon" says a builder must add the script; the script is already in `web/app/layout.tsx`
behind `NEXT_PUBLIC_CF_BEACON_TOKEN`, so only the token and a privacy-page line are needed (v0.2).

## 0a. Release bundles (owner decision, 26 Oct 2026; read first)

**Owner decision, 26 Oct 2026 (release cadence):** A ships first, on its own, as soon as its T3 passes (the sweep was already running). Bundles B and C are built in parallel (B2 seat: B's auth, backup and catalogue tasks and C's contract chain; B1 seat: the UXB UI tasks) and ship as ONE release with ONE T3, so three regressions become two. Google sign-in (v0.9) ships in this release switched ON (owner, 26 Oct 2026); it needs the owner Google console steps (MASTER-ORDER 7.3) done before the cut. Only a feature that is not ready by the cut ships switched off. The B+C release carries the migrations of both bundles; take one Neon snapshot before it.

The owner (26 Oct 2026): "merge a few into one; the verification overhead per release is too high." **The train is now
eleven bundles, A to K. The v0.x numbers stay as feature labels**, so every reference in the specs, BACKLOG and briefs
keeps working ("FAV-1 ships in v0.3" now reads "FAV-1 is feature v0.3, which ships in bundle A"). PLAN R-250; BACKLOG
15.260 to 15.262. This section supersedes "each feature released on its own" (R-180) and the one-release-per-number
reading of [MASTER-ORDER](MASTER-ORDER.md) 5.3; the gate, smoke list, checklist and CI plan of sections 4 to 8 stand,
applied once per bundle. **Trade-off:** about four times fewer T3 runs, owner approvals and smoke rounds, against bigger
deploys whose rollback takes a whole bundle back, and features that wait for their bundle mates (a ready feature waits at
most one bundle, because a late mate is shipped dark, rule B3).

### 0a.1 Rules

| # | Rule |
|---|---|
| B1 | A release is a **bundle of independent features**, each behind its capability flag (`web/lib/capabilities.ts`). Data has no flag: a merged data batch rides the next bundle's deploy whatever its label |
| B2 | **Test tiers** ([TEST-STRATEGY.md](TEST-STRATEGY.md)): each feature gets only **T1** while it is built (the builder's hand-back; design review and verifier for UI features, as today). **T2** runs once per stack of merged branches. **T3** (section 4.1: check-all, budgets in both builds, the quiet full e2e, the privacy audit, migrations on the child) runs **once per bundle** on its named commit, with every flag of the bundle on |
| B3 | **A feature that is not ready is left flagged off and does not block the bundle.** It ships dark (code merged, flag off, listed under Internal as "built, switched off") and its flag turns on in the next bundle after its own T1 is green. A feature whose migration is not applied is not merged |
| B4 | **Security-heavy bundles keep their reviews:** B (EML-S for sign-in by code, GSI-S for Google, the BKP-1 gate of Q185) and H (MCP-S1 on the public half before it opens, MCP-S on the private half before its door opens). D keeps FBK-S, F keeps CUS-R. No bundle ships with an open high finding |
| B5 | **Rollback is per bundle.** First the flags (off, redeploy the same commit). Then `vercel rollback`, which on the Hobby plan reaches only the immediately previous production deployment; anything older is a redeploy of the previous bundle's tag through section 6 steps 8 and 9. Bundles that deploy twice (B, H, K, rule B9) leave their own first step as "previous", so a whole-bundle rollback is always the tag redeploy |
| B6 | **Tags:** `release/<letter>` for bundles A to K (`release/A` ...); a fix to a live bundle is `release/<letter>.1`; `release/v0.1` stays as it is. Letters cannot collide with the feature labels, which a `release/v0.x` tag would. "The latest release tag" (CAT-V, section 6) means the latest `release/*` tag by creation date: `git for-each-ref --sort=-creatordate --count=1 refs/tags/release/` |
| B7 | **Notes:** one CHANGELOG entry per bundle, `## [A] - <date>`, whose first line lists the feature labels it carries ("Features: v0.2, v0.3, v0.4"), then the groups of section 8. A feature shipped dark appears under Internal, and under Added only in the bundle that turns it on |
| B8 | **Data readiness:** every bundle names the scoreboard numbers ([DATA-PLAN.md](DATA-PLAN.md) 5) its features display. The data seat schedules research so they are met at the bundle's T3 (DATA-PLAN 2.2). Data that falls short ships partial, each gap a dated `searched_none` and one Known limits line; it never blocks the bundle |
| B9 | **Two-step bundles.** B: deploy with `NEXT_PUBLIC_SIGN_IN_GOOGLE=0`, owner O-E1 (Require Verification), smoke; then redeploy the same named commit with the Google flag on and run GSI-E (Google linking needs required verification, email spec 12). H: deploy with `MCP_PRIVATE_ENABLED=0` and the public MCP on; after MCP-S and at least 7 days of clean public use, O-M2 and O-M6, then the private flag on and a redeploy of the same commit (keeps Q225, public before private). K: one seam flag per redeploy of the same commit, a week apart, CAT-V clean between flips. Each step is a flag change on the bundle's tag, not a new release |
| B10 | **Order.** A, B, C ... is the recommended deploy order; B (built in B2) and C (built in B1) are ready at about the same time and may swap. As with Q224, the letter follows the deploy order |
| B11 | **(26 Oct, ALIGN) Bundle H2**, if QX2 is yes: between H and I; two deploys, v0.20a (user writes and MCP Apps views, MCP-S3) then v0.20b (staging, owner only, MCP-S4), each with its own T3, security review and smoke, tags `release/H2a` and `release/H2b`; J (the UI and UX audit) follows H2 and covers its views and the approval page |

### 0a.2 The bundles

Hours are agent hours. "Build" is what is left after the merges on `main` by 26 Oct (BUD-1, GSI-P, NAV-C, FAV-C, RIS-J are
merged and not counted). "Infra" is the test-strategy and platform work that rides the bundle as Internal. "Data" is the
research and the load and verify work the data seat does for the bundle; task by task in
[DATA-PLAN.md](DATA-PLAN.md) 2. Feature detail stays in section 3 (under the old numbers) and in MASTER-ORDER 5.3.

**Rewritten 26 Oct 2026, evening (ALIGN).** Same convention (work merged before the morning of 26 Oct is not counted);
the 26 Oct additions are named in the last column. The morning's version of this table (986 h) is replaced.

| Bundle | Features (labels) | What a visitor gets | Build h | Infra h | Data h | **Total h** | Added 26 Oct | Migrations | Security reviews | Deploys |
|---|---|---|---|---|---|---|---|---|---|---|
| **A** | v0.2 + v0.3 + v0.4 | sign-in reachable on phones, the privacy page, page-view counts, basics for the 74 stored places, Mine with copies and favourites on this device, trip-page go-live fixes, share images; no "Finished plan" from household dates (PRIV-TD). **The first deploy since v0.1 waits for Mine** | 59 | 20 | 5 | **84** | PRIV-TD 2.5 | none | the Opus privacy audit at T3 | 1 |
| **B** | v0.5 + v0.9 | sign in by emailed code, verified accounts, backups, Continue with Google; Internal: the catalogue in Neon (CAT-1) and the database cross-check | 37.5 | 8 | 36.5 | **82** | | `backup_reader`, `research_meta` | EML-S, GSI-S, BKP-1 gate | 2 (B9) |
| **C** | v0.6 + v0.7 + v0.8, UX fixes, parks P1, graph (Internal) | trip tabs with a Summary, party bar, the trip's shape, when to go, Table view, Bookings and Photos tabs; place pages that show what is known; park entry requirements in Book ahead; places near a town, the closure queue; photos on trail and stop pages; links and directions beside every stop; getting there | 214.5 | 10 | 77 | **301.5** | UXB 67, EG 23, PA 31 | `relation_kinds` | none | 1 (cut rule Q309) |
| **D** | v0.10 + v0.11, property matrix (Internal); **v0.11a, v0.11b; sources and gazetteer pipeline (Internal)** | report a problem, suggest an improvement or a place, ask for a trip with research-ready detail and "What we already have"; **plan a day out or a short stay from a hub, an airport or your location, with honest drive times (FS-1); My map** | 265.25 | 79 | 21.5 | **365.75** | PM 13; 27 Oct +234.5 | `intake`, `leg_cache_server_write` | FBK-S; Opus privacy check of `/plan/` (party and start never stored) | 1 |
| **E** | v0.12 + v0.13 + v0.14, place context, parks P2, facts model; **v0.14a, v0.14b; gazetteer from Postgres and wave 0 data** | best time to go and the trip overview, Where to stay on every trip, trips written as data get pages; "In Banff National Park", ways to do a trail, how to get there; park pages; **build a trip in a country by regions, your interests, plans in your account; map ties** | 238 | 14 | 260 | **512** | EG 15, PA 23.5, API-P 6; 27 Oct +299 | `plan_draft` | TB-SY review (RLS) | 1 |
| **F** | v0.14.1 + v0.15 + v0.16; **v0.16a** | field slimming, customise a trip (signed in), copies and favourites follow you into your account; **suggested bases, getting there; interests and map in the account; wave 1 at T0** | 188.75 | 0 | 112.5 | **301.25** | 27 Oct +200.5 | `custom_draft`, `draft_cap`, `account_favourite`, `account_start`, `account_interests`, visit tables | CUS-R, WM-SR | 1 |
| **G** | v0.17 + v0.18, parks P3, API for MCP (Internal); **drive model wave 1, wave 1 T1 data** | more edits, your own stops, base tweaks; search the map for a stop we do not have; plan a park visit and camping | 92 | 22.5 | 202 | **316.5** | PA 21, API 22.5; 27 Oct +197 | none | REQ-G key and terms check (SRC-O) | 1 |
| **H** | v0.19 + v0.20 (MP1, MP2) | public MCP (21 tools, method resources, validate, typed payloads with view hints), then private MCP (your plans, read) and Connected apps; `get_my_map` | 83.5 | 0 | 0 | **83.5** | +25; 27 Oct +2.5 | `mcp_access`, token tables | MCP-S1, MCP-S | 2 (B9) |
| **H2** | v0.20a + v0.20b (MP3, MP4); **only if QX2 is yes** | plan with your AI: copy, customise, own plans (as `plan-draft/1`, 27 Oct) with private places, MCP Apps views; research and admin: staged batches approved on our site (owner only) | 114.5 | 0 | 0 | **114.5** | new; 27 Oct −0.5 | `user_place`, `research_stage` | MCP-S3, MCP-S4 | 2 (B11) |
| **I** | v0.21 | own domain and Email Phase 2, only on the Q148 trigger | 29 or 42.5 | 0 | 0 | **29 or 42.5** | | mail tables | EML-S2 | 1 |
| **J** | v0.22; builder polish (TB-P5) | the UI and UX audit and its fixes, once, on the finished product (after H2), including `/plan/` and `/mine/map/` | 84.5 | 0 | 2 | **86.5** | | none | none | 1 |
| **K** | v1.0 to v1.2 | the public catalogue served from Postgres, one seam at a time | 19 | 0 | 0 | **19** | | none expected | parity per method | 3 flips (B9) |
| | | **All, I at 29 h** | **1,425.5** | **153.5** | **716.5** | **2,295.5** | **+364.5; 27 Oct +945** | | | |

Without H2 (QX2 no): 2,181 h (1,235.5 h before 27 Oct). Later, in no bundle: DT-W23, DT-X, SRC-G, CTRY-L (18 h). The morning's table (A 81.5, C 180.5, D 118.25, E 168.5, G 76, H 56; 986 h) is superseded.

Not in a bundle: LOCAL-4 (5 h) and E2E-YML (3 h) wait for the repository to be public and ride the next bundle after it;
DP (4 h, optional), new areas (L5, sized per request), GLB2b (25 h, on the globe mock approval), TD-4, TD-6, 7.11 and the
rest of MASTER-ORDER 3.8 "not on the train".

How the hours were counted, per bundle:
- **A.** Build: ACCT-PH-RV 1.5 (narrowed, 0a.3 row 1), OVR-0 3, NAV-F 1.5, NAV-1 5.5, NAV-2 6, NAV-R1/V1 4, FAV-1 12, FAV-R/V 4,
  TRP-GL-C 3, TRP-GL 5, TRP-GL review 4, IMG-1 7. Infra: TS-1 5, TS-2a 3, TS-2 8, TS-4 4. Data: TRP-GL-D 2, L4 2, D610 1.
- **B.** Build: EML-S 2, EML-V 2, EML-P 1, EML-E 2, BKP-1 6.5, GSI 24. Infra: TS-6 2, TS-3 4, TS-5 2. Data: LOCAL-3 3, RIS-M 7,
  RIS-L 8, RIS-T 7, LOCAL-5 2, CAT-V 2, CAT-1 1.5, DV-1 6 (built in the data seat during A's window).
- **C.** Build: v0.6 48 (LST2b 12, LST2c 9, MX 5, LST2-RV 6, R-14 3, CONS-3 8, GB-A-4 2, ACC-1 3), v0.7 13 (PHO-C 1, PHO-R 8,
  review 4), v0.8 44 (R-59 19, ORG phase 1 25 without ORG-G), RIS-H 3. Infra: TS-7 5, TS-8 2, RIS-S 3. Data: AREA-2 6, ORPH-7 3,
  D3 10, TRL-REL 3.5, D5c 4, ORG-G 3, TRK-1 7, TRK-CA 5, TRK-DO 2, TRK-RW 2, D10-RO 7, D10-DO 3.5, OFR-1 3.5, DV-2 3.
- **D.** Build: v0.10 67.25, v0.11 31.5, CAT-Q 6. Data: D10-UT 1.5, D10-PA 2, D10-IC 2, D10-CH 1.5, D10-PAST 1, STO-1 1.5, L3 4.
- **E.** Build: v0.12 45 (OVR-N 3, OVR-Ca 4, OVR-Cb 6, OVR-1 6, OVR-2 14, OVR-3 3, OVR-R/V 6, PHO-0 3), v0.13 46, v0.14 22. Data:
  D8-R 8, D8 8, D7 16, D9 8.5, RIS-A 8, OVT 7.
- **F.** v0.14.1 27.5, v0.15 36.25, v0.16 37. **G.** v0.17 47, v0.18 29. **H.** MCP-C 5.5 (with the database-import test of
  [mcp/README.md](../mcp/README.md) 1.1), MCP-1 6, MCP-S1 1.5, ORG-MCP 1.5, v0.20 38.5, AU-D 3. **J, K, I** as MASTER-ORDER 5.3.
- **27 Oct additions (BUILDER-DEPS; task by task in [builder-dependency-map.md](builder-dependency-map.md) 2).** D: build TB-P1 58, TK 28.5, DT 23, WM 51; data DT-P0 5,
  DT-T0 3; infra SRC 24, DC pipeline 42. E: build TB 34, TK 19, DT 6, WM 24; infra DC-SRV 14; data TB-RG 6, TK 9, DT 10, DC-5 2,
  DC-RB 3, DC-W0 172. F: build TB 66, TK-SY 4, WM 18; data TB-BL 3.5, TB-D4 4, DC-W1 T0 105. G: data DT-W1 28, DC-W1 T1 170;
  build SRC-O 1, REQ-G0 −1, REQ-G −1. H: WM-M 2.5. H2: TK-MCP 2, WM-M 2.5, UPL −5. J: build TB-P5 8, TK 6; data TK-H 2. K: SRV-0 −4.
- **26 Oct additions (ALIGN).** A: PRIV-TD 2.5 (build). C: UXB 67 (build 64; data UXB-W 3), EG 23 (build EG-C 6, EG-R0 1,
  EG-FX 2.5, EG-I 6, EG-DOC 2; data EG-M 2.5, EG-D 3), PA P1 31 (build PA-C 6, PA-FX 3, PA-X 4, PA-D 3.5, PA-W 4, PA-M 1.5,
  PA-R1/V1 3; data PA-R-CA 6). D: infra PM-C 4, PM-G 5, PM-F 4. E: EG-N 2, EG-Q 4, EG-W 6, EG-R/V 3; PA-N 3, PA-Q 2, PA-2 10,
  PA-DV 2, PA-R2/V2 4; data PA-MUS 2.5; API-P 6. G: PA-N3 2, PA-3C 3, PA-3 8, PA-R3/V3 4; data PA-R-ON 4; infra API-G 4, API-T 3,
  API-S 1.5, API-V 5, MTH-G 6, MTH-1 3. H: MP1 40 (AU-D 3, MCP-C 10, MCP-1 8, MCP-M 3, MCP-GR 2, ORG-MCP 1.5, MCP-PK 3, MCP-EV 6,
  MCP-S1 2.5, MCP-E1 1) and MP2 41 (MCP-G 6, MCP-T 5, MCP-2 9, MCP-O 4, MCP-U 10, MCP-S 4, MCP-E 3). H2: MP3 60, MP4 55
  ([MASTER-ORDER](MASTER-ORDER.md) 3.9).

### 0a.3 Dependency check inside each bundle (the master order's conflict map, MASTER-ORDER 4)

Every bundle was checked against the contract order (MASTER-ORDER 4.3), the hot spots (4.1), migrations (4.4), budgets (4.5)
and owner gates (4.6). Ten findings; each is fixed here and in the page named.

| # | Bundle | Problem the grouping causes | Fix |
|---|---|---|---|
| 1 | A | The first deploy waits for Mine, so ACCT-PH's interim bar item never reaches production: NAV-1 replaces it 1:1 before any deploy | ACCT-PH-F dropped; ACCT-PH-RV keeps only the start-JS and place-HTML baselines NAV-1 needs (verifier 1.5 h; the design review of the interim item is dropped). MASTER-ORDER 3.6 |
| 2 | B | Google linking is safe only after Require Verification (O-E1), and O-E1 must follow the deploy (email spec 12). One deploy for v0.5 and v0.9 would open Google before O-E1 | two-step deploy (B9) |
| 3 | B | CAT-1's fallback was "v0.6" | fallback is the next bundle (C); B ships without it |
| 4 | C | One bundle now holds PHO-R's owner-approved re-baseline (Q263) and every data batch that adds bytes to place pages (AREA-2, D3, D10-RO, D10-DO, track lines) | data batches merge before PHO-R, each alone in its stack with `budget:report` before and after; PHO-R's re-baseline then covers the photo figure only. A standing rule for research-filled pages is asked as Q290 (DATA-PLAN 6) |
| 5 | C | R-59 and ORG-1 need ORG-G's gateways, and ORG-G waits on ORG-D (B2) | ORG-D stays in B2 row 6; ORG-G moves to data-seat row 9, ahead of ORG-1 (MASTER-ORDER 5.4) |
| 6 | D | REQ-RF rebuilds the towns layer (one writer); D's research splits (Utah, Patagonia, Iceland, Chamonix) can add points in a new admin-1, which also rebuilds it | the D10 splits run in data-seat row 12, before REQ-RF starts in B2 row 13; a split that meets a new admin-1 after that waits for REQ-RF to merge |
| 7 | E | D7 (16 h of windows, E's data) waits on OVR-Ca, which sat in B2 row 14, the last row of D's window, leaving D7 on E's critical path | OVR-Ca moves to B2 row 13, right after REQ-RF-C (the one-author contract order of MASTER-ORDER 4.3 is unchanged); D7 runs in data-seat row 14 |
| 8 | F | v0.14.1 opens only at gate G-AUD, with v0.14 live; v0.14 is in E | F's field audit starts after E is live; CUS-C starts after FA-D, inside F. No bundle can hold both v0.14 and v0.14.1 |
| 9 | H | Q225: the public MCP ships before the private one; one bundle would open both at once | two-step (B9): the private door stays shut at the deploy and opens on a flag after MCP-S and 7 days of public use |
| 10 | K | "One seam per release" (EXECUTION-PLAN 14.2) | one seam flag per redeploy of the K tag, a week apart, CAT-V clean between (B9); the bundle is one release with three flips |
| 11 | C (26 Oct, ALIGN) | C is 301.5 h, 3.7 times A; one slow feature holds every C feature | cut rule (Q309): C cuts when the UX round, parks P1, the graph and the closure queue are verified; PHO-R, R-59 and getting there ship dark if late (B3) |
| 12 | C | parks P1 needs the graph contract (same files, one author) and the migration `relation_kinds` before C's sync | contract chain RIS-H, EG-C, PA-C, PA-X (MASTER-ORDER 4.3); EG-M on the child in C's window, on production at C's release before step 9a |
| 13 | A | the live site prints "Finished plan" from the household's real trip date (BACKLOG 15.310) | PRIV-TD rides A, merged before T3 |
| 14 | H, H2 | MCP-C needs the API tasks of G (API-G, API-T, API-S, API-V) and the matrix (D); H2 needs CUS-C, TD-1, REQ-E-C, FAV-D, FBK-1 | all land in D to G first; checked in MASTER-ORDER 4.3; J follows H2 |
| 15 | D (27 Oct) | D grows to 365.75 h with features that do not share D's intake files; one slow builder or map task would hold D | cut rule as Q309: D cuts when v0.10, v0.11 and the property matrix are verified; v0.11a and v0.11b ship dark if late (B3) and turn on in E |
| 16 | D | the builder's shared lines (flag, OpenAPI, detector keys, `data.ts`, Mine registry) would collide with C's contract chain | they are hooks landed by B2 after the B+C release commit is named (MASTER-ORDER 4.3 row 4); builder new files may merge earlier, inert |
| 17 | D | DT-1b changes drive times on public trip and place pages | alone in its stack, before and after table in the hand-back, before CUS-C on the schedule engine (Q-DEP5) |
| 18 | E | gazetteer records would enter the static build and `JsonStore`'s cold start (P8, P9) | no gazetteer record merges before DC-SRV (E); wave 0 data that is not merged by E's T3 rides F |
| 19 | E, F | the seed link needs OVR-1 on the CopySheet (E); TB-P3 needs STY-E (E) | TB-W2 after OVR-1 inside E; TB-P3 and TB-P4 in F, after E is live |

Checked with no problem: A (OVR-0 before every other trip-page consumer; NAV-C and FAV-C merged; TRP-GL after FAV-1; IMG-1
before PHO-R in C); B (EML-P after GSI-P, merged; BKP-1 before the first non-owner account); C (LST2b after A; the closure
queue before R-59 in B1's order; PHO-R after IMG-1 and PHO-C; R59-1 after TRP-GL); D (FBK-1 after B's Turnstile and quotas;
CAT-Q before FBK-C; FBK-N after OVR-0; REQ-1 after NAV-1); E (OVR after R59-1 and ORG-2; STY-1 after OVR-2; TD-1 on Q267);
F (FAV-2 after Google in B, Q124; NAV-D and FAV-D after CUS-C); G (v0.17 after CUS-1; REQ-G0 inside G); H (AU-D on G's
commit before MCP-C); J (G-UI after H, and after I if shipped); K (after J).

### 0a.4 Data readiness per bundle

Baseline 26 Oct 2026 ([coverage report](../../../research/reports/coverage-2026-10-26.md)): 114 of 498 records at the
required tier (23%); store basics 54 of 74; `E_PLACE_AREA` 227; `E_PLACE_ORPHAN` 7; trail geometry 9 of 118; trail relevance
43 of 118; windows 1 of 14 trips; base plans 1 of 14; overview facts 0 of 14; gateways 0 of 13; place pages showing a
photo 60 of 355. Targets are measured at the bundle's T3 with the commands of DATA-PLAN 5.

| Bundle | Data readiness line (targets at T3) | If short |
|---|---|---|
| A | store basics 54 of 74 held; L4 cross-check 9 of 10 sampled values or better; the 3 Rockies identities of TRP-GL-D fixed; `gaps --budget --check` OK | ships; gaps listed |
| B | Postgres equals the files: the database cross-check (DATA-PLAN 4) green on the child and production; row counts per table and family recorded with `seed_commit`; exposure parity 0 differences | CAT-1 rides C; B ships |
| C | required tier: Rockies 180 of 199 (90%), Dolomites 68 of 76; `E_PLACE_AREA` at most 25 (Rockies 0); `E_PLACE_ORPHAN` 0; trails: 118 of 118 with distance, gain and time or a dated `searched_none`, relevance 118 of 118, every trail track attempted (confirmed or held back with a stated reason; 60 or more confirmed); every Rockies and Dolomites place record has a photo or a dated "No licensed photo yet"; 250 or more of 355 place pages show a photo; gateways 13 of 13 | ships; the other trips' tracks and the Dolomites fills ride D |
| D | required tier 90% or more on each of the 8 trips with days (448 or more of 498 overall); store basics 73 of 74 (Grand-Sault on the owner's ruling); store photos 74 of 74 or dated; "What we already have" counts equal in Postgres and the files | ships; gaps listed |
| E | windows 8 of 14 (every trip with days; 14 of 14 if Q99 yes); overview facts 8 of 8 trips with days; base plans 8 of 8 trips with days (Dolomites on its base-split ruling); the 6 overview trips' stops (about 88) captured at the required tier; RIS-A leftovers promoted | ships; a trip without windows or bases shows today's view |
| F | every field has a ledger row and an audit verdict; required-tier share recorded before and after slimming (both numerator and denominator) | ships |
| G | no new data; gap budget does not rise | ships |
| H | MCP publishes only the fields AU-D kept; exposure parity 0; required tier 90% or more overall | ships |
| C additions (26 Oct) | parks P1: the 5 Rockies parks and 2 zones at the required tier with every requirement; `graph.ts build --check` green; `E_CAP_REL_TARGET` strict after EG-D; Summary highlights have licensed photos for the Rockies (D5c) | parks rows ship dark; highlights fall back to the gallery by name |
| D (27 Oct) | FS-1 on today's data (QB2, QB3): a region or drive band under the slice bar shows its true count and "Ask us"; DT golden legs: mean error at most 22% overall, Canada 20%, Italy 33%; wave 0 country profiles CA, US, IT present | builder ships with greyed regions; never padded |
| E (27 Oct) | DC-SRV merged before any gazetteer record; wave 0 T0 for the 7 slice regions with A1 to A6 green; DT wave 0 ferries, CA-US crossings and passes; region groups for IT, CA, US, FR, IS | the rest of wave 0 rides F |
| F (27 Oct) | wave 0 slice at T2 (DC 2.3 bar) for Ontario and Quebec; Italy T1; lodging signal for the offered regions; transport notes; wave 1 at T0 begun | TB-P3 runs on the regions that meet the bar; others greyed |
| G (27 Oct) | wave 1 at T0 accepted; T1 for the six trip countries and France begun; DT wave 1 profiles | ships partial |
| H2 | user places and staged batches carry only registry properties; the staging export passes every validator on the then-current tree | ships dark |
| I, J | none | |
| K | CAT-V clean for the last 4 weekly runs and the last bundle; the database cross-check green on production; parity per method | the seam does not flip |

**Can the data seat do it?** Yes, with two moves made in MASTER-ORDER 5.4 (lane S in A's window as planned; OVR-Ca one row
earlier, 0a.3 row 7) and assuming one data-seat hour per B1 hour. Load per window: A 43 of 43.5 available (ORPH-7 fills
the spare); C 59.5 of 71.5; D 45.5 of 52.5; E 23.5 of 68 (DATA-PLAN 2.2). The tight windows are A (no spare: if lane S
slips, ORPH-7 moves to C and CAT-1 rides C) and
C (12 h spare: if Overpass or the Opus usage cap slows it, TRK-RW and D10-DO ship partial in C with dated gaps and finish
in D; C still ships). The work no task covered before 26 Oct adds about 59 h (DATA-PLAN 2.1: 34 h of research and sample reviews, 16 h for the
track fetcher and its runs, 9 h for the database cross-check); it fits only because
lane S, which used the data seat's idle time, ends in A's window. Opus research lanes pause above 70% of the week's use; that is the most likely cause of a slip.

## 0. Corrections from the master order (25 Oct 2026; read first)

[MASTER-ORDER.md](MASTER-ORDER.md) (R-220) analysed every remaining task for conflicts and re-cut this train. **Its
section 5.3 is the release order and numbering from v0.4 onward; the release numbers in sections 1 to 3 below are the
first version's** (Q262, approved 25 Oct 2026: the section 5.3 numbering is THE train; the release numbers in sections 1 to 3 are legacy). Sections 4 to 8 (gate, smoke, rollback, checklist, CI,
notes) are unchanged. The corrections, each argued in MASTER-ORDER 5.5:

| # | Correction |
|---|---|
| C0 | `release/v0.1` goes on `47be5b58`: the history was rewritten, and 47be5b5 (the deployed commit) is its private-history id |
| C1 | v0.4 (D2b) folds into v0.2: D2b and Q88's option A are already merged and data has no flag. v0.2's owner actions gain `HOME_POINT_LAT` and `HOME_POINT_LON` in Vercel Production and Preview (the build fails closed without them since PUBLIC-SCRUB), the Vercel Firewall rate-limit rule on `/api/v1/*` (BACKLOG 15.22), and the Q88 ruling. v0.2 also gains ACCT-PH-RV (ACCT-PH merged without review) and BUD-1 (Q260) |
| C2 | New v0.4: the TRP2b2 "before go-live" deferrals (REMAINING-CLOSURE-PLAN 4), open while production is live |
| C3 | The image and share-image build fix (IMG-1, 7 h) moves from v0.8 to v0.4 |
| C4 | BKP-1 has no LOCAL-4 dependency (Q228) and adds the migration `backup_reader` to v0.5 |
| C5 | New v0.6: the owner's 23 Oct closure queue (API/HYG loose ends, LST2b) with LST2c, MX and CONS-3, before R-59 |
| C6 | Photos (15.158) move to v0.7, before R-59; `pickPhotos` belongs to the photos task; the photo figure needs Q263 |
| C7 | R-59 is sized (19 h, read-only part) and its part 3 (base changes, signed in) moves to v0.17 |
| C8 | New v0.11: the request forms (R-190 to R-196), right after the report release (Q238) |
| C9 | New v0.13: Where to stay (R-76 to R-78) on the public site; STY-2 joins v0.17 |
| C10 | New v0.14: trips written as data get pages (TD-1 to TD-3, Q267), before customise |
| C11 to C14 | OVR-0 has no dependency on OVR-Cb; migration files are named by slug; FBK-C's migration does not wait for FAV-D; GSI-1 builds on `SignInCard.tsx`; section 2's seat table is replaced by MASTER-ORDER 5.1 and 5.4 |
| C15 | (owner decision, 26 Oct 2026) The catalogue load moves forward from v1.0 to v0.5 as Internal: CAT-1 with RIS-M (`research_meta`), RIS-L, RIS-T, LOCAL-3, LOCAL-5 and the drift job CAT-V; production is seeded with no seam flipped and the site keeps serving files; CAT-Q (the store router and three Postgres methods for connected callers) before v0.10; checklist step 9a syncs production after every release that changes data. [CATALOGUE-EARLY.md](CATALOGUE-EARLY.md) |

**Audits (25 Oct 2026, amended 26 Oct, [AUDITS-AFTER-RELEASE.md](AUDITS-AFTER-RELEASE.md), R-230 to R-237, Q270 to Q279;
Q271 answered by the 26 Oct decision).** After v0.14 is live, the field-usefulness audit runs and its changes ship as the
**patch release** `release/v0.14.1` (field slimming), which only removes or fixes and keeps the gate, smoke list, rollback and
checklist of sections 4 and 6 unchanged (Q271: v0.14.1 is the only patch release). The UI and UX audit moved (owner, 26 Oct):
it runs once at the end of the UI train, after v0.20 and v0.21 (if shipped), and ships as the new release **v0.22 "UI and UX
audit and fixes"** just before the v1.0 Postgres cutover; v0.14.2 no longer exists. No other release is renumbered. CUS-C
(v0.15) starts after the owner approves the field list; CUS-1 does not wait for a UI audit; a narrowed delta pass (the MCP
field list) runs before v0.19. Recording during the build (a fixed screenshot set for every release outside the repository,
`budget:report` in each CHANGELOG Internal line, UI issues appended to [UI-NOTES.md](UI-NOTES.md)) is that page's section 8.

The test-strategy and trip-origin plans are merged (I7, I8 and their log rows below). Their text uses the first version's
numbers: "v0.9" in the trip-origin rows is new v0.8 (MASTER-ORDER 5.3), and I7's "before v0.9" is before new v0.8.

Old to new numbers: v0.2 and v0.4 to v0.2; v0.3 stays; v0.5 stays; v0.6 to v0.9; v0.7 to v0.10; v0.8 to v0.7; v0.9 to
v0.8; v0.10 to v0.12; v0.11 to v0.15; v0.12 to v0.16; v0.13 to v0.17; v0.14 to v0.18; v0.15 to v0.19; v0.16 to v0.20;
v0.17 to v0.21. New: v0.4, v0.6, v0.11, v0.13, v0.14, and (26 Oct) v0.22. The summary table and sections below keep the old numbers; v0.22 is a new
number in both schemes and follows the old v0.17 (new v0.21).

## 1. Summary

| Release | Goal in one line | Agent hours (from the specs) | Migrations (slugs; numbers at merge) |
|---|---|---|---|
| **v0.1** | What is live today: the public read-only site, password sign-in, own plans | shipped (47be5b5) | 0001 to 0011 |
| **v0.2** | Sign-in reachable on phones, a privacy page, page-view counts, the Maps key locked down | ACCT-PH (built, unsized) + GSI-P 2 h | none |
| **v0.3** | Mine: find your copied trips and favourites on this device, phone and desktop | 43 h | none |
| **v0.4** | Basics for the 74 stored places, under the ruled place-size budget (Q88) | D2b about 6 h (done, integrating) + Q88 option | none |
| **v0.5** | Sign in by emailed code; new accounts verified by code | 7 h + BKP-1 6 h | none |
| **v0.6** | Continue with Google | 24 h | none |
| **v0.7** | Report a problem, suggest a place or an improvement, ask for a trip (signed in) | 67.5 h | `intake` |
| **v0.8** | The licensed trail and stop photos shown, resized on our host, and share images | unsized (15.158 and the image build fix) | none |
| **v0.9** | Trail links and directions beside every stop; whole-day route; getting there from your city or the nearest airport | unsized (R-59) + ORG 16.5 h (core and data, 11.5 h, ride earlier as internal) | none |
| **v0.10** | Best time to go and the trip overview with thumbnails | 46 h + D8-R 8 h | none |
| **v0.11** | Customise a trip (signed in) | 34 h | `custom-draft` |
| **v0.12** | Copies and favourites follow you into your account | 33 h | `draft-cap`, `account_favourite` (+ `account-start` if Q246) |
| **v0.13** | More edits in a customised trip; add your own stops from our places | 20 h (+2 h CUS-C widening counted in v0.11) | none |
| **v0.14** | Search the map for a stop we do not have; suggest it to us | 29 h | none |
| **v0.15** | Public MCP (read-only catalogue, no sign-in), security-reviewed | 11 h + review slice (Q225) | none |
| **v0.16** | Private MCP (your plans, read), security-reviewed | 40 h | `mcp_access` and MCP-T's token tables |
| **v0.17** | Own domain and Email Phase 2 (only when Q148 triggers) | 29 h (Q149 no) or 42.5 h | `account_mail_state`, `mail_suppression` (+ `hook_event` if Q149 yes) |
| **v0.22** | UI and UX audit and fixes, run once on the whole product (owner, 26 Oct); its fixes only change the UI | UA-0 5 h + AU-GU 0.5 h + 65 h (24 h placeholder) | none |
| **v1.0 to v1.2** | Postgres cutover, one seam per release, `JsonStore` kept one release | about 68 h before the first flip | RIS-M `meta`, SRV-0 loader tables |

Infra work with no visitor change (CI, backups, drift gate) ships inside the next release and is listed under
"Internal" in its notes (section 5, track I).

**Ordering rules used.** Value first, risk second, dependencies always. What is built and unreleased goes first; then
small visitor wins; then the account features in the order their specs require (EML before Google, Google before
favourites sync per Q124, feedback before requests, CUS before the REQ copy edits); MCP in its own reviewed releases;
the domain only on a trigger; the store swap last. Two places differ from the coordinator's listed order, both forced
by the specs: photos (v0.8) sit between requests day one (v0.7) and requests phases 2 and 3 (v0.13, v0.14), because
phase 2 needs CUS-1, CUS needs the overview's phase 1 preview (OVR brief), and the overview's thumbnails (OVR-3) reuse
the photo read path of 15.158; and Google sign-in (v0.6), absent from the list, is placed where the email and Google
specs put it.

**Main is always releasable.** Every feature merges behind its capability flag (`web/lib/capabilities.ts`), off in Vercel
until its release, so merge order and release order are independent. A release is: flags on, migrations applied,
the named commit deployed. Data releases (v0.4) have no flag, so they ride the first deploy after they merge; v0.3 and
v0.4 may swap, and the version number follows the deploy order.

## 2. Critical path and parallel work

```mermaid
flowchart LR
  classDef rel fill:#1F4E79,stroke:#163A5A,color:#FFFFFF
  classDef core fill:#2A7F8F,stroke:#1E5F6B,color:#FFFFFF
  classDef owner fill:#B7791F,stroke:#8A5A12,color:#FFFFFF
  classDef gate fill:#9B2C2C,stroke:#6B1E1E,color:#FFFFFF
  classDef infra fill:#5A6772,stroke:#3E4850,color:#FFFFFF

  V1["v0.1 live<br/>47be5b5"]:::rel
  AP["ACCT-PH review<br/>GSI-P"]:::core
  V2["v0.2"]:::rel
  NAV["NAV-F, NAV-C, NAV-1,<br/>NAV-2, FAV-C, FAV-1, OVR-0"]:::core
  V3["v0.3"]:::rel
  FBK["FBK-C, FBK-M, FBK-1,<br/>FBK-S, FBK-2, FBK-3, REQ-1"]:::core
  V7["v0.7"]:::rel
  PH["15.158 photos,<br/>image build fix"]:::core
  V8["v0.8"]:::rel
  R59["R-59 links"]:::core
  OVR["OVR-N to OVR-3"]:::core
  CUS["CUS-C, CUS-1, CUS-2"]:::core
  REQ2["REQ-E, REQ-P"]:::core
  REQ3["REQ-G0, REQ-G,<br/>REQ-S, REQ-L, REQ-A"]:::core
  V14["v0.14"]:::rel
  SRV["RIS-M, RIS-L, SRV-0,<br/>parity, LOCAL-5"]:::infra
  V22["v0.22<br/>UI and UX audit and fixes"]:::gate
  V10["v1.0 to v1.2"]:::rel

  D2B["D2b + Q88"]:::owner
  EML["EML-S, EML-V, EML-P,<br/>O-E1, EML-E, BKP-1"]:::gate
  GSI["GSI-0 to GSI-E"]:::core
  SYNC["NAV-D, FAV-D, FAV-2, NAV-3"]:::core
  MCP["MCP-C, MCP-1, MCP-G,<br/>MCP-T, MCP-2, MCP-O, MCP-U, MCP-S"]:::gate
  CI["LOCAL-3, LOCAL-4<br/>after PUBLIC-AUDIT"]:::infra

  V1 --> AP --> V2 --> NAV --> V3 --> FBK --> V7 --> PH --> V8 --> R59 --> OVR --> CUS --> REQ2 --> REQ3 --> V14 --> V22 --> SRV --> V10
  V2 -.-> D2B
  V3 -.-> EML --> GSI
  CUS -.-> SYNC
  GSI -.-> SYNC
  V3 -.-> MCP
  V2 -.-> CI
```

The critical path is the solid line: the web seat (seat A) carries every visitor-facing UI task, and the REQ chain is the
long pole. Dotted work runs in seat B on disjoint files. The owner's rule is two lanes at a time; the table names what
may pair with what.

| Seat A (web UI, mostly Sonnet) | Seat B at the same time (core, contracts, data, infra, mostly Opus) | Files that must not overlap |
|---|---|---|
| ACCT-PH review and merge; GSI-P | D2b integration and the Q88 option; Q-D key restriction (owner) | place budget: whichever merges second re-measures `place-size.test` |
| NAV-1, NAV-2 | NAV-C, then FAV-C, then EML-S | `core/src/privacy/detect.ts` (NAV-C, FAV-C, CUS-C each add keys): one at a time |
| FAV-1 | EML-V, EML-P, BKP-1, LOCAL-3 | `web/app/privacy/page.tsx` (GSI-P creates; EML-P, FBK-2 add sections): one at a time |
| OVR-0 (before R-59 starts) | GSI-0, GSI-T | `web/components/trips/**`: OVR-0, then R-59, then OVR own it in turn |
| FBK-2 | FBK-C, FBK-M, FBK-1, then GSI-1, GSI-2 | `web/components/auth/**` (GSI-1's button slot) and `web/app/account/page.tsx` (GSI-1, GSI-2, later NAV-3): sequential |
| REQ-1 | FBK-3, MCP-C, MCP-G (core only, no web files) | `core/src/catalogue/store.ts`, `core/src/schema/api/**`, OpenAPI: one contract author (D-E2) for FAV-C, OVR-Ca, MCP-C |
| 15.158 photos | MCP-1 (`web/app/mcp/**`), LOCAL-4 | Commons: one runner, never two agents (images build included) |
| R-59 | OVR-Ca, OVR-Cb (store and routes) | `web/components/actions/CopySheet.tsx`: NAV-2 and OVR-1 never in parallel |
| R-59, then ORG-1 and ORG-2 | ORG-C, then ORG-D, ORG-G, ORG-M (core and data only) | `core/src/privacy/detect.ts` and `core/src/catalogue/store.ts`: ORG-C one at a time with NAV-C, FAV-C, CUS-C and OVR-Ca (one contract author); ORS: one runner |
| OVR-1, OVR-2, OVR-3 | D8-R research (data only), CUS-C | `web/scripts/neon-e2e.mjs` (EML-E, GSI-E, FBK-E, FAV-2E, NAV-E, CUS-2): one at a time |
| CUS-1 | MCP-T, MCP-2 | `web/lib/capabilities.ts`: append-only; rebase, never reorder |
| REQ-E UI, REQ-P | NAV-D, FAV-D, FAV-2, NAV-3 (account routes) | `web/app/t/**`: REQ-E never in parallel with CUS-2 |
| REQ-S, REQ-L | REQ-G (route), REQ-A (CLI), MCP-O, MCP-U | `core/bin/intake.ts`: FBK-3 before REQ-A |
| SRV-0 parity work | RIS-M, RIS-J, RIS-H, RIS-A, RIS-L, RIS-T, LOCAL-5 | `core/bin/capture.ts`: RIS-N (done) and RIS-S serial |

Shared budgets are a collision even when files are disjoint: trip start JS (2 B headroom) and place HTML (19 B in the
sign-in-on build). Every UI task measures both, in the public and the sign-in-on builds, with its own flag on and off.

## 3. The releases

**Data work rows below are the 25 Oct record (26 Oct note):** the data each bundle ships, with its hours, is
[DATA-PLAN.md](DATA-PLAN.md) 2 and the readiness lines of section 0a.4; the rows are not kept in step.

Every release uses the same gate (section 4), the same checklist (section 6) and the same rollback (section 4.3) unless
its row adds to them. "Smoke" lists only the URLs added to the standard list of section 4.2. Sizes are copied from the
specs; "unsized" means no spec gives one, and the task's brief must size it before it is scheduled.

### v0.1: the public site as it is live today (shipped)

| Field | Content |
|---|---|
| Goal | Record what visitors can use today and tag it, so every later release has a named baseline |
| Contents | Everything on `main` up to 47be5b5: phase A, B and E work merged by then (trips, places, globe, search, timeline, Google trip map with routed legs, Export trip, copy and share, suitability, seasons on six trips, phone back-to-top, youngest-child default 10), the Neon foundation (R-58), EML-M, EML-Q and EML-1 (the passwordless-first card with codes off, the auth proxy guard, owner alerts) |
| Migrations | 0001 to 0011 applied on the production branch |
| Owner actions done | approved the named commit; Vercel env set; Neon trusted domain `https://travel-beta-tan.vercel.app` |
| Coordinator action now | tag it retroactively: `git tag -a release/v0.1 47be5b5 -m "v0.1: public site live"`, push the tag on its own line (Q220) |
| Known limits | photos load from Wikimedia Commons, not from resized copies on our host; no share (link preview) images; sign-in by emailed code is off; the phone header has no sign-in link; a copied trip is kept in the browser but no page lists it; researched trail and stop photos are not shown; Realtime allowed origins not updated for production (live refresh of account drafts across tabs is not expected to work there; check in the v0.2 smoke) |
| Notes | CHANGELOG entry v0.1 (written with this page) |

### v0.2: sign-in on phones, privacy page, page-view counts

| Field | Content |
|---|---|
| Goal | A phone visitor can reach sign-in; the site says what it collects; the owner starts counting page views per path |
| Built on main since v0.1 | LOCAL-2 seed engine (`db:seed`, `db:sync`, `db:verify`; internal, no visitor change) and docs. **Nothing a visitor sees.** Recommendation: do not deploy main alone; it rides v0.2 (Q221). Trade-off: production stays one internal change behind main until v0.2 |
| Contents | ACCT-PH (built in `travel-wt/v2-ACCTPH`, uncommitted, unsized): the fifth bottom-bar item "Sign in" / "Account", interim until NAV-1 replaces it 1:1 (navigation spec N12). GSI-P (Sonnet 2 h; copy by the planner, owner approves): `/privacy/` and its footer link, pulled forward from v0.6 (Q222) so the beacon is named before it loads. The beacon itself: config only |
| Dependencies | ACCT-PH design review and verifier; ACCT-PH's start-JS and place-HTML baseline measured (NAV-1 needs it) |
| Owner actions | (1) Q-D: confirm the browser Maps key is restricted to `travel-beta-tan.vercel.app` and the localhost ports, Maps JavaScript API only, with a daily quota (production is public now; this was "before any preview leaves this Mac"). (2) Q205: create the Cloudflare Web Analytics site for the production host and set `NEXT_PUBLIC_CF_BEACON_TOKEN` in Vercel **Production only** (not Preview). (3) Approve the privacy page words. (4) Optional: `neon deploy` for the Realtime allowed origins in `neon.ts`, or skip it (the smoke records whether live draft refresh works). (5) Phone check on a real phone. (6) Approve the named commit |
| Data work | none |
| Migrations | none |
| Risks | The beacon adds one script tag to every page, about 150 B of HTML, against 19 B of place-HTML headroom. Recommendation (Q222): measure the budget on the public build without the token (as today) and record the tag as a fixed overhead outside the ratio, since it is not catalogue growth (P8 protects the catalogue, not third-party tags). ACCT-PH is short-lived (replaced in v0.3) |
| Extra gate | budgets in the public build and the sign-in-on build; one build with the beacon token set to prove the tag renders and nothing else changes |
| Smoke | `/privacy/`; on a 390 px phone the bar shows the sign-in item and reaches `/sign-in/`; the page source of `/` contains `static.cloudflareinsights.com` once and only on production |
| Rollback | standard; unset the beacon token and redeploy |
| Notes | coordinator drafts, owner approves |

### v0.3: Mine, copies and favourites on this device

| Field | Content |
|---|---|
| Goal | A visitor who copies a trip or favourites a place finds it again in Mine, on phone and desktop, with no account (P7: copy is the 90% action, and today the copy is unfindable) |
| Contents | NAV phase 1 (20 h): NAV-F 1.5 h, NAV-C 3 h (+0.25 h: `copies/1` reserves `from` and `gw`, [origin spec](../features/trip-origin-and-nearest-airport.md) 10), NAV-1 5.5 h (with the phone header sign-in icon, Q203), NAV-2 6 h, NAV-R1 2 h, NAV-V1 2 h. Favourites step 1 (20 h): FAV-C 4 h, FAV-1 12 h (re-scoped to the Mine panel), FAV-R 2 h, FAV-V 2 h. OVR-0 3 h (pulled forward, Q223): `CategoryView` into a dynamic chunk, which frees trip start JS for the trip-page heart. Total 43 h |
| Dependencies | v0.2 merged (ACCT-PH baseline); Q101 to Q108 answered (Q108 favourite scope and cap); OVR-0 merges before R-59 starts, because both own `web/components/trips/**` |
| Owner actions | phone check at 320 and 390 px (five items in the bar, the header icon, copy a trip then find it in Mine after reload); approve |
| Data work | none |
| Migrations | none (device storage only: `copies/1`, `favourites/1`) |
| Risks | Two budgets at their limit (trip start JS 2 B, place HTML 19 B): NAV-1 pays with CSS icon masks and drops the dot if the net is above 0 B. The old `travel:v1:copy-drafts` key must move, never drop. If Q223 is no, the trip-page heart waits for v0.10 and only places get one |
| Extra gate | privacy test: no copy, party or favourite in any exported page, `/api/v1` body or catalogue file (navigation acceptance 8); quiet full e2e |
| Smoke | `/mine/`, `/mine/?show=favourites`, `/favourites/` (redirects to Mine), `/trips/canadian-rockies-2029/` copy sheet then Mine, `/places/moraine-lake/` heart then Mine |
| Rollback | standard; flags `mine` and `favourites` off and redeploy (copies stay in the browser) |
| Notes | coordinator drafts, owner approves |

### v0.4: basics for the 74 stored places

| Field | Content |
|---|---|
| Goal | Every stored place shows its basics (identity, seasons, points) or an honest "Not checked yet", inside a ruled place-size budget |
| Contents | DATA-D2b (about 6 h, four splits US 35, CA 22, IT 10, INT 7), integrated on `public/D2b-INT` (re-derived towns, areas, relevance, source registry; seven store notes cleaned of household planning text). The Q88 option the owner picks: A, re-baseline the 56 former stub pages to their first full record (`public/D2b-INT-size-options` at b8000f2 (private history), test-only; median after 1.2491); B, lazy rows (uncommitted in `travel-wt/v2-D2B-INT-size`); C, raise the cap to +35% |
| Dependencies | Q88 ruling. This page does not change Q88's recommendation in PLAN section 5 (keep +25%, lazy sections) |
| Owner actions | rule Q88; approve |
| Data work | D2b, plus the follow-ons (`suitability.ts migrate --write`, `towns.py build`, `capture.ts derive-near --write`) already run on the integration branch |
| Migrations | none (`JsonStore` serves) |
| Risks | With option A the median sits at 1.2491 against 1.25, so the next renderer change of about 0.1% fails it; every later UI release then pays for its bytes or takes lazy rows. Option B adds a request when a section opens and fewer crawlable links |
| Extra gate | `capture.ts gaps --budget --check` (the gap budget may only fall); `basics --report` before and after; privacy audit of the 74 pages (household text) by an Opus auditor |
| Smoke | three stored places, one per split country, each section showing data or "Not checked yet"; `/places/` counts unchanged except where basics add filters |
| Rollback | standard; data only, so a redeploy of v0.3's tag restores it |
| Notes | coordinator drafts, owner approves |

### v0.5: sign in by emailed code, verified accounts

| Field | Content |
|---|---|
| Goal | Sign in or create an account with a code by email; every new password account is verified by code |
| Internal (C15, 26 Oct) | **CAT-1, the catalogue in Neon:** LOCAL-3 3 h, RIS-M 7 h, RIS-L 8 h, RIS-T 7 h, LOCAL-5 2 h, CAT-V 2 h (data seat), CAT-1 1.5 h (coordinator) ([CATALOGUE-EARLY.md](CATALOGUE-EARLY.md) 4, 11.7). No visitor change. If lane S is not green at the cut, CAT-1 rides the next bundle (C) and bundle B ships without it (0a.3 row 3). Migration `research_meta` after `backup_reader`; the child rehearsal of the named commit before the production migrations; the production sync at step 9a; Q280 to Q286; the owner confirms the Neon Data API is off |
| Contents | Built in v0.1: EML-M, EML-Q, EML-1, EML-R. Remaining Phase 1 (7 h): EML-S 2 h (security review before O-E1), EML-V 2 h, EML-P 1 h (the "Sign-in emails" section on `/privacy/`, after GSI-P), EML-E 2 h + 20 min owner (real-service checks after O-E1). Q168's revoke of other sessions after a reset is built (`web/lib/auth/revoke.ts`); EML-E proves it live. BKP-1 6 h (infra track) as a gate: Q185 asks for it before the first non-owner account, and code sign-in makes accounts one step away |
| Dependencies | v0.2 (privacy page); EML-S with no open high finding; BKP-1 green, or the owner accepts a manual Neon snapshot regime until it is (Q185) |
| Owner actions | O-E0 Application Name "Trip Plans" on the production branch; O-E2 Turnstile widget (hostnames `travel-beta-tan.vercel.app`, `localhost`), `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`; O-E3 `AUTH_QUOTA_SECRET`, `OWNER_EMAIL`, `SITE_ORIGIN` in Vercel (confirm what v0.1 already set); set `NEXT_PUBLIC_SIGN_IN_CODE=1`; after the deploy, O-E1 (Require Verification by code) in the same session; EML-E test inboxes (20 min); approve EML-P words |
| Data work | the first catalogue sync to production (CAT-1, Internal, step 9a); no data file changes |
| Migrations | `backup_reader` (BKP-1, C4) and `research_meta` (RIS-M, C15), numbers at merge, the child first; 0011 `quota` is applied |
| Risks | Neon's shared sender: Gmail's "suspicious" banner and the "Neon Auth" sender name (EML-0); some codes land in spam. Disable Sign Up does not stop a code sign-in from creating an account, so any admission gate is our own server-side check (Q67). O-E1 before the deploy would lock unverified users out; the order is deploy, then O-E1 |
| Extra gate | EML-S report; quotas: 20 parallel calls admit exactly the limit (EML-Q tests); identical answers for known and unknown addresses |
| Smoke | `/sign-in/` "Email me a code" with the owner's address; `/sign-up/` password with a code; `/sign-in/reset/`; an owner alert arrives; where the code mail lands in Gmail and Outlook (recorded) |
| Rollback | fastest first (email spec 11.2): `NEXT_PUBLIC_SIGN_IN_CODE=0` and redeploy; O-E1 reversed (`--require-email-verification=false`); `AUTH_GUARD=off` while a fix ships |
| Notes | coordinator drafts; privacy wording checked by the EML-S reviewer; owner approves |

### v0.6: Continue with Google

| Field | Content |
|---|---|
| Goal | One-tap sign-up and sign-in with Google on `/sign-in/` and `/sign-up/`, and Ways to sign in on Account |
| Contents | GSI-0 3 h + 20 min owner (skip if the owner's own-client setup already answered U1 to U9), GSI-T 1 h, GSI-1 8 h, GSI-2 4 h, GSI-S 2 h, GSI-E 3 h + 30 min owner, GSI-R 1.5 h, GSI-VF 1.5 h. Total 24 h. GSI-P moved to v0.2; GSI-V2 superseded by EML-1 |
| Dependencies | v0.5 (required verification makes Google linking safe; email spec 12); the CVE-2026-53516 linking gate L1 on the child branch |
| Owner actions | O-1 to O-5 (about 1 h 15 min; the own Google client and redirect URIs exist, so confirm what is left); `NEXT_PUBLIC_SIGN_IN_GOOGLE` non-sensitive in Vercel; approve |
| Migrations | none |
| Risks | An unverified password account must never link (L1). GSI-E was written for an HTTPS preview; production is now the HTTPS origin, so GSI-E runs there with a test Gmail and deletes its users |
| Smoke | `/sign-in/` Continue with Google with the test Gmail; `/account/` Ways to sign in |
| Rollback | standard; `NEXT_PUBLIC_SIGN_IN_GOOGLE=0` and redeploy |
| Notes | coordinator drafts, owner approves |

### v0.7: report or suggest, and requests (signed in)

| Field | Content |
|---|---|
| Goal | A signed-in visitor reports a problem on a trail, trip, day, stop or place, suggests a place or an improvement, or asks for a trip; the owner triages from the CLI |
| Contents | Feedback (54 h, FBK-M at 2 h per email spec 12): FBK-N 2 h, FBK-C 8 h, FBK-M 2 h, FBK-1 8 h, FBK-S 4 h, FBK-2 16 h, FBK-R 3 h, FBK-V 3 h, FBK-3 4 h, FBK-E 4 h. Requests day one (13.5 h, requests spec 11.1): FBK-C +1.5 h (`improve`, `for_trip`, `for_day`, `source_ref`), FBK-3 +2 h, REQ-1 6 h, REQ-R1 2 h, REQ-V1 2 h. FBK-C +0.25 h (trip `start` as `{ref, text}`, origin spec 10). Total 67.75 h |
| Dependencies | NAV-1 (v0.3, for the Mine "Your requests" link); EML-Q's `quota_bucket` and Turnstile (v0.5); Q130 to Q137 answered; widen FBK-C before its migration is applied |
| Owner actions | none new (Turnstile from v0.5); approve the "Reports and suggestions" privacy section; approve |
| Data work | none; triage writes data later through the skills |
| Migrations | `intake` (FBK-C's extended intake migration with the three nullable columns and the partial index) |
| Risks | Visitor text is untrusted input to the skills (fenced in briefs, FBK-3); private-list probing (a private duplicate answers like any other, PRIV1); spam (layers 0 to 13, kill switch). Guest submissions wait for a mail domain (`guestIntake` off) |
| Extra gate | FBK-S with no open must; planted-injection and PII tests; flag `reportForm` on, `guestIntake` off |
| Smoke | a report from a trip day on `/trips/canadian-rockies-2029/`; "Suggest an improvement" with a catalogue stop; a trip request for a country with "What we already have"; `/account/submissions/` lists them; `node core/bin/intake.ts list --type improve` shows them |
| Rollback | standard; `reportForm` off; the intake tables stay (additive) |
| Notes | coordinator drafts; privacy wording checked by the FBK-S reviewer; owner approves |

### v0.8: photos

| Field | Content |
|---|---|
| Goal | The 131+ licensed Commons photos already in the data (106 of 118 trails) show on their pages with credits, served as our own resized copies, and shared links get a preview image |
| Contents | BACKLOG 15.158 builder task (unsized): read record `photos` in the web adapter, feed the renditions and the credits snapshot, first photo as the card thumbnail, credit and licence on the page. The image and OG build fix (EXECUTION-PLAN 13.2, HANDOVER item 3; unsized): `scripts/images.mjs` and `scripts/og.mjs` run before the Vercel adapter collects pages, or deploys become prebuilt from the Mac. Design review and verifier |
| Dependencies | Q88 ruled (v0.4): thumbnails load lazily or in list rows only; Commons calls one runner only |
| Owner actions | approve; if the fix is "prebuilt", the coordinator's deploy command changes for every later release (section 6 step 8) |
| Data work | none (D5a and D5b merged) |
| Migrations | none |
| Risks | Place-HTML budget; Commons 429 on a cold cache (copy `web/.og-cache` into the deploy worktree); credit strings kept as Commons holds them (owner ruling 25 Oct) |
| Smoke | `/places/peyto-lake-lookout/` photo with credit; `/trips/` cards with thumbnails; the share preview of a trip URL in a link debugger shows an image; image URLs point at our host, not `upload.wikimedia.org` |
| Rollback | standard |
| Notes | coordinator drafts, owner approves |

### v0.9: links and directions beside every stop, and getting there

| Field | Content |
|---|---|
| Goal | Each stop shows Directions, View in Maps and AllTrails or official links beside its name; each day opens as one ordered route with every stop; each trip says how you get there, from the nearest airport by default or from the city you choose, and Day 1 and the last day follow it |
| Contents | R-59 ([TRIP-NAVIGATION-PLAN.md](public-site/TRIP-NAVIGATION-PLAN.md), unsized): visible stop actions, combined day directions without silent truncation, base-aware plan changes (the read-only part). Then ORG ([trip-origin-and-nearest-airport.md](../features/trip-origin-and-nearest-airport.md) 13): ORG-N 1.5 h, ORG-A 2 h, ORG-1 7 h, ORG-2 2 h, ORG-R 2 h, ORG-V 2 h (16.5 h), flag `gettingThere`. ORG-C 4 h, ORG-D 3 h, ORG-G 3 h and ORG-M 1.5 h run in seat B before this and ship earlier as internal |
| Dependencies | OVR-0 merged (v0.3); R-59 owns `web/components/trips/**` while it runs, so ORG-1 starts after R-59 merges; ORG-C, ORG-D, ORG-G merged; NAV-2 merged (v0.3) for ORG-2; Q240 to Q249 answered |
| Owner actions | phone check of the stop actions and of Starting from; approve (Q240 to Q249 answered 25 Oct) |
| Data work | ORG-G and ORG-M; see DATA-PLAN 2.1 row 18 (bundle C) |
| Migrations | none |
| Risks | trip start JS (OVR-0 freed some; R-59 measures; ORG-1 adds at most 200 B and loads its panel on open); links only, never AllTrails data; OurAirports' scheduled-service flag can be stale (gateways override it); a visitor's start must never reach server HTML, OG or logs |
| Extra gate | server HTML of a trip byte-identical with and without `?from=`; privacy test over `origin/1` and the copies' `from`; the 27-destination golden test |
| Smoke | `/trips/canadian-rockies-2029/` a day with more than nine stops opens one route with all of them; a trail stop shows its AllTrails link; the Getting there line names Calgary (YYC); Starting from "Mumbai" changes Day 1 and the last day in place; `/trips/algonquin-muskoka-2026/` reads "from Toronto" |
| Rollback | standard; `gettingThere` off |
| Notes | coordinator drafts, owner approves |

### v0.10: best time to go and the trip overview

| Field | Content |
|---|---|
| Goal | A trip shows 2 to 4 sourced best-time windows and one overview of every trail, sight, activity and booking, with counts, scopes, filters and thumbnails |
| Contents | OVR phase 1 ([briefs/OVR.md](public-site/briefs/OVR.md)): OVR-N 3 h, OVR-Ca 4 h, OVR-Cb 6 h, OVR-1 6 h, OVR-2 14 h, OVR-3 4 h, OVR-R 3 h, OVR-V 3 h (43 h; OVR-0 shipped in v0.3); PHO-0 3 h (photo overrides, runs any time after OVR-3). Total 46 h. Data D8-R 8 h (Rockies overview facts, not started) |
| Dependencies | R-59 merged (v0.9); D7-R merged (windows); Q93 to Q100 answered; OVR-1 never in parallel with NAV-2 on `CopySheet.tsx` (NAV-2 shipped in v0.3) |
| Owner actions | the phase 1 owner preview that CUS waits for (OVR brief); approve |
| Data work | D8-R, D8, D7 (windows in `data/windows/`, DD-1): DATA-PLAN 2.1 rows 28, 34, 37 (bundle E) |
| Migrations | none |
| Risks | contract change (OVR-Ca, one author); trip start JS and place HTML |
| Smoke | `/trips/canadian-rockies-2029/` When to go cards and `?view=all` overview tabs; a filter combination with counts |
| Rollback | standard |
| Notes | coordinator drafts, owner approves |

### v0.11: customise a trip (signed in)

| Field | Content |
|---|---|
| Goal | A signed-in visitor makes a private copy at `/t/<id>/` and adds, removes, moves and parks items, with undo and autosave |
| Contents | CUS-C 6 h + 2 h widening (`title`, `moved`, `days`, `notes`, `custom` before its migration is applied) + 0.25 h (`from` and `gw`, origin spec 10), CUS-1 20 h, CUS-2 3 h, CUS-R 3 h. Total 34.25 h |
| Dependencies | v0.10's owner preview; the `planner_draft_signal` ruling; Q98 (who may customise: invite-only recommended) and Q67, Q103, Q120 (sign-up policy) |
| Owner actions | the rulings above; approve |
| Migrations | `custom-draft` (`planner_draft` gains `source_trip`, `source_revision`, `doc`, `revision`; same RLS) |
| Risks | **Planning gap:** Q98's invite-only answer needs a server-side allow check, and no sized task builds one (EML-0 found Neon's flag does not gate code sign-in). Q229 asks to put it inside CUS-C. Cross-user isolation (another user's copy is a 404) |
| Extra gate | RLS and isolation tests on the child branch; CUS-R privacy audit; real-service CUS-2 on production with test users deleted |
| Smoke | sign in, Customise the Rockies trip, remove one stop, reload, undo; a second test user gets 404 on the first user's `/t/<id>/` |
| Rollback | standard; the customise flag off; the columns stay (additive) |
| Notes | coordinator drafts; privacy wording checked by CUS-R; owner approves |

### v0.12: copies and favourites in the account

| Field | Content |
|---|---|
| Goal | Device copies and favourites merge into the account once at sign-in and follow the visitor to other devices |
| Contents | NAV phase 2 (14 h): NAV-D 2 h, NAV-3 6 h, NAV-E 2 h, NAV-R2 2 h, NAV-V2 2 h. Favourites sync (19 h): FAV-D 4 h, FAV-2 12 h, FAV-2E 3 h. Total 33 h; plus ORG-H 4 h (the account's private default Starting from, migration `account-start`) if Q246 is answered yes |
| Dependencies | CUS-C (v0.11); Google (v0.6, Q124) |
| Owner actions | approve |
| Migrations | `draft-cap` (client ids, 50-draft cap trigger), `account_favourite` |
| Risks | the merge must never load on a public page (`boundary.test`); sign-out leaves nothing of the account in the browser |
| Smoke | signed out: copy a trip and favourite a place; sign up; both appear once in Mine; a second browser of the same user sees them; sign out clears them |
| Rollback | standard; `favouritesSync` off |
| Notes | coordinator drafts, owner approves |

### v0.13: more edits and your own stops from our places

| Field | Content |
|---|---|
| Goal | In a customised trip: reorder within a day, add and drop a day, notes, title, dates; add a stop from our catalogue or towns, or as your own |
| Contents | REQ phase 2 (22 h in the spec, of which the CUS-C +2 h widening ships in v0.11): REQ-E 3 h core + 8 h UI, REQ-P 5 h, REQ-R2 2 h, REQ-V2 2 h. 20 h here |
| Dependencies | CUS-1 and CUS-2 (v0.11); REQ-E never in parallel with CUS-2 on `web/app/t/**` |
| Migrations | none |
| Smoke | in `/t/<id>/`: move an entry, drop a day (items go to Maybe), add a catalogue stop, add "my own" stop; reload keeps all |
| Rollback | standard |
| Notes | coordinator drafts, owner approves |

### v0.14: search the map for a stop we do not have

| Field | Content |
|---|---|
| Goal | "Search the map" in the copy finds any public place through Google Places (fallback openrouteservice, then Photon) and offers to suggest it to us |
| Contents | REQ phase 3 (29 h, requests spec 11.1; EXECUTION-PLAN 10.2 says 27, the spec wins): REQ-G0 3 h, REQ-G 2 h + 6 h, REQ-S 8 h, REQ-L 3 h, REQ-A 3 h, REQ-R3 2 h, REQ-V3 2 h |
| Dependencies | v0.13; FBK-3 (v0.7); REQ-G0's go or no-go for Google |
| Owner actions | Google Cloud setup (TODO row): project, billing, Places API (New), a key restricted to it, a daily quota of 300, budget alerts at 50, 90, 100 percent, `GOOGLE_PLACES_API_KEY` in Vercel |
| Migrations | none (`quota_bucket` buckets) |
| Risks | Google terms: only `place_id` stored, no Google names or coordinates in our data, results never on MapLibre maps; cost cap |
| Extra gate | a Google fixture's name, address and point absent from route output and logs; neither key in client output |
| Smoke | search "a peak near Canmore" in a copy, add it, the suggestion box is ticked; search an address, no box |
| Rollback | standard; `GEOCODE_PROVIDER=ors` or `GEOCODE_ENABLED=0` |
| Notes | coordinator drafts, owner approves |

### v0.15: public MCP (read-only, no sign-in)

| Field | Content |
|---|---|
| Goal | A chat app can search and read the public catalogue at `/mcp/` with no sign-in, under quotas and the privacy detector |
| Contents | MCP-C 5 h (contracts, levels vocabulary, annotations, the read and write split, the public tool rename), MCP-1 6 h; ORG-MCP 1.5 h (`get_trip.origin`, `nearest_airports`, origin spec 11); a security review of the public half (Q225; MCP-S is 4 h for the whole MCP and the spec does not split it; the brief sizes the slice) |
| Dependencies | EML-Q (v0.1); Q165 (60 calls an hour per IP) answered; the one Hobby WAF rate-limit rule shared with `/api/v1/*` (15.22) |
| Owner actions | the WAF rule in Vercel Firewall; approve |
| Migrations | none |
| Risks | the public tool set must never import a stdio handler (test); household strings in tool output (planted-string test) |
| Smoke | MCP Inspector lists the tools at `https://travel-beta-tan.vercel.app/mcp/`; the 61st call in an hour is refused; a request with an `Authorization` header gets 400 |
| Rollback | standard; `MCP_PUBLIC_ENABLED=0` and redeploy |
| Notes | coordinator drafts, owner approves |

### v0.16: private MCP (your plans, read)

| Field | Content |
|---|---|
| Goal | Claude and Claude Code sign in through our consent page and read the signed-in person's own plans at `plans_read`, with Connected apps and access on Account |
| Contents | MCP-G 6 h, MCP-T 5 h, MCP-2 8 h, MCP-O 4 h, MCP-U 10 h, MCP-S 4 h, MCP-E 3 h. Total 40 h (51 h before production use, less v0.15's 11 h) |
| Dependencies | v0.15; EML-1; Q190 to Q198 answered; the switch-on order of the MCP spec 14.8.4 (door shut first) |
| Owner actions | O-M3 (`MCP_RESOURCE_URL`, `MCP_AUDIT_SALT`, `MCP_PRIVATE_ENABLED=0`, `MCP_MAX_LEVEL=plans_read`), deploy, O-M2 (OAuth provider on the production branch), O-M6 (allow list), then `MCP_PRIVATE_ENABLED=1` and redeploy, O-M4 (connect claude.ai and Claude Code), O-M5 later (Allow Localhost off) |
| Migrations | `mcp_access` (MCP-G) and MCP-T's token tables |
| Risks | Neon's plugin is all or nothing per branch; issued refresh tokens survive a plugin disable (X7), so the env switch stays at 0 until checked |
| Extra gate | MCP-S report with no open high finding; every 14.8.3 item checked |
| Smoke | `/mcp/private/` answers 403 with the door shut; after switch-on, Claude Code signs in and `list_my_drafts` returns only the caller's rows; Revoke on Account cuts access on the next call |
| Rollback | `MCP_PRIVATE_ENABLED=0` and redeploy; Pause every app; Neon OAuth provider Disable |
| Notes | coordinator drafts; security wording checked by the MCP-S reviewer; owner approves |

### v0.17: own domain and Email Phase 2 (on a trigger)

| Field | Content |
|---|---|
| Goal | Our own sender name, magic links, guest reports and notices, on a domain the owner registers |
| Trigger | Q148: register only when codes land in spam or go missing, the "Neon Auth" sender name puts people off, or guest reporting, magic link or notices are wanted. Until then this release does not ship |
| Contents | Email Phase 2: 29 h with Q149 no (EML-M2, EML-TT, EML-T, EML-TR, EML-Q2, EML-2, EML-N, EML-B, EML-S2, EML-R2, EML-V2, EML-E2), 42.5 h with Q149 yes (adds EML-W). Feedback guest flow: `guestIntake` on (FBK-E's guest cases); FBK-O |
| Owner actions | O-E4 domain and DNS, O-E4a Neon custom SMTP through Resend, O-E5 `MAIL_FROM`, O-E6 if Q149 yes, O-E7 magic link, O-E8 notices; the domain move: Vercel domain and a 308 from the `vercel.app` host, Neon trusted domains, Google OAuth origins and redirect URIs, Turnstile hostnames, the Maps key referrers, Realtime origins, MCP URLs (O-M2 again), `SITE_ORIGIN` |
| Migrations | `account_mail_state`, `mail_suppression` (+ `hook_event` if Q149 yes) |
| Risks | every origin list must change in one window or sign-in breaks; old `vercel.app` links must keep working |
| Rollback | email spec 11.2 (provider back to `shared`, webhook off, `NEXT_PUBLIC_SIGN_IN_LINK=0`); keep the `vercel.app` host serving until the domain has run clean for a week |
| Notes | coordinator drafts, owner approves |

### v0.22: UI and UX audit and fixes (owner decision, 26 Oct 2026)

| Field | Content |
|---|---|
| Goal | Audit every public and signed-in screen once, on the finished product, and ship the approved Must and Should fixes |
| Tasks | UA-0, AU-GU, UA-1, UA-P, UA-W, UA-A, UA-2, UA-3, UA-T, UA-D (owner), UA-FX, UA-FX-R, UA-AF ([AUDITS-AFTER-RELEASE.md](AUDITS-AFTER-RELEASE.md) 6); starts from [UI-NOTES.md](UI-NOTES.md) |
| Gate to open | G-UI (AUDITS-AFTER-RELEASE 2.3): every UI release and the MCP surfaces live (the old v0.15 and v0.16, and v0.17 if shipped), the audited commit frozen, 28 days of beacon data where possible, UA-0 merged |
| Owner actions | O-AU1 (analytics export), UA-D (approve the list), release approval of the named commit |
| Migrations | none |
| Gate, smoke, rollback | as sections 4 and 6; the release only fixes the UI, so the rollback is the previous release tag |
| Blocks | v1.0: the cutover waits for the fixes so the audit is not carried into Postgres serving |
| Notes | v0.14.2, the 25 Oct slot for this audit, is withdrawn |

### v1.0 to v1.2: Postgres cutover, one seam per release

| Field | Content |
|---|---|
| Goal | The public catalogue reads from Neon Postgres behind the same contract, with `JsonStore` one switch away |
| Pre-work | **Changed 26 Oct (C15):** RIS-M, RIS-L, RIS-T, LOCAL-3, LOCAL-5 and the first load ship in v0.5 (CAT-1); CAT-Q before v0.10. Left here: SRV-0 21 h and R-9 2 h (23 h). RIS-J is merged; RIS-H, RIS-A, RIS-S ride earlier as Internal |
| Releases | v1.0 seam 1: list, counts, near, towns. v1.1 seam 2: search and parse. v1.2 seam 3: detail and export. Seam 4 (report) is already Postgres through the intake tables (v0.7); seam 5 is the planner (later). EXECUTION-PLAN 14.2 |
| Dependencies | contract kit green per method against `PostgresStore`; parity against `JsonStore`; CAT-V clean for the last 4 weekly runs and the last release ([CATALOGUE-EARLY.md](CATALOGUE-EARLY.md) 6). Q183 is superseded: production holds the catalogue from v0.5 |
| Owner actions | a manual Neon snapshot before each step; approve each seam's named commit |
| Data work | none new: production has been synced at every data release since v0.5 (step 9a) |
| Migrations | none expected (`research_meta` ships in v0.5) |
| Rollback | `CATALOGUE_STORE=json` for the seam's methods and redeploy; `JsonStore` stays deployable for one release after each flip |
| Notes | coordinator drafts, owner approves |

### Not on this train (planned elsewhere, no release slot yet)

Stay bases and optimisation (R-76 to R-80), short trips (backlog 2.17, 3.11 to 3.14), smart search phase 2 (3.15), the planner (F01 to
F17), the admin console (F16, INT-5, PHO-1 after the cutover), MCP-3 and MCP-P, REQ-M, NAV-M, ORG-P (the place-page airport row, after Q88 and Q248), TD-1 to TD-4 and
legacy removal (7.11). Each gets a release row when its spec is scheduled. **(26 Oct, ALIGN: stale in part.** Stay bases are v0.13 and TD-1 to TD-3 v0.14 since the master order; MCP-3, MCP-P and
REQ-M move to bundle H2 if QX2 is yes; the bundle table of 0a.2 is the current list.)

## 4. Verification gate, smoke test and rollback

### 4.1 The gate (every release)

**Since 26 Oct (section 0a, B2): "every release" means every bundle.** This table is T3: it runs once per bundle on its
named commit with all of the bundle's flags on. Features get T1 while built and T2 per stack; rows 6 to 8 (design review,
verifier, security review) are done per feature during the build and only re-checked here (their notes exist, no open
high finding).

| # | Check | Command or owner | Pass |
|---|---|---|---|
| 1 | Full gate on the release commit | `mv web/.env.local <aside> && PATH=<venv>/bin:$PATH bash tools/check-all.sh; mv <aside> web/.env.local` | ends `CHECK-ALL OK` (it stops at the first failure: read the last `==` line) |
| 2 | Typecheck | `pnpm --dir web exec tsc --noEmit`, `pnpm --dir core exec tsc --noEmit` | 0 errors |
| 3 | Budgets | `web/tests/data/place-size.test.ts`, `web/tests/budget.test.ts`, `boundary.test` in the public build and the sign-in-on build, with the release's flags on | under the limits (+25% place median or the Q88 ruling; 200 KB gzipped start JS) |
| 4 | Folder contract | `python3 tools/tree_check.py --check` | no new violation |
| 5 | Quiet full e2e (UI releases) | `PATH=<venv>/bin:$PATH SKIP_WEB_BUILD=1 pnpm --dir web e2e` right after check-all, on a quiet machine | 0 failed |
| 6 | Design review (UI releases) | `travel-design-reviewer` (Opus) against P1 to P9, T1 to T5 and the feature spec, screenshots at 1440 and 390 in light and dark | approved |
| 7 | Verifier | `travel-verifier` (Sonnet), independent sweep including a first-use walk (P4) | passes |
| 8 | Security review (auth, intake, MCP, geocode releases) | the spec's review task (EML-S, GSI-S, FBK-S, CUS-R, MCP-S) | no open high finding |
| 9 | Migrations | `node --env-file=.env.local core/bin/db-migrate.ts plan` against the child, then `up`; `core/test/db` on the child | additive only; child suite green |
| 10 | Privacy | the detector runs inside `respond()`; for releases that change public output, an Opus audit of rendered HTML and `/api/v1` bodies | 0 household strings |
| 11 | Owner approval of the named commit | the owner's reply "approved <sha>" (Q43) | recorded in the release notes |

### 4.2 Standard live smoke test (production, after every deploy)

Base `https://travel-beta-tan.vercel.app`. Pages use trailing slashes (`trailingSlash: true`); an API path without one
answers 308 to the slash form, which counts as a pass.

| # | URL | Check |
|---|---|---|
| 1 | `/` | renders, cover, search opens with `/` |
| 2 | `/trips/` | list, filters, counts |
| 3 | `/trips/canadian-rockies-2029/` | timeline Day 1 to N, the day map loads (Google), Export trip downloads an ICS, copy sheet opens |
| 4 | `/places/` | Cards, List, Table, Map views |
| 5 | `/places/moraine-lake/` | map, sections, "Not checked yet" where empty |
| 6 | `/places/peyto-lake-lookout/` | trail page, links |
| 7 | `/globe/` | loads, rotates, a pin opens its card |
| 8 | `/search/?q=easy%20hike%20near%20Banff` | chips from the parser, results |
| 9 | `/about/data/`, `/terms/`, `/privacy/` (from v0.2) | render; credits present |
| 10 | `/sign-in/`, `/sign-up/`, `/sign-in/reset/` | the card renders; owner test account signs in with a password |
| 11 | `/account/` | signed out: sends to `/sign-in/`; signed in: the account page and its plans |
| 12 | `/api/v1/health` | 200 |
| 13 | `/api/v1/trips`, `/api/v1/places`, `/api/v1/openapi.json` | 200, light rows, no household fields |
| 14 | `/sitemap.xml`, `/robots.txt` | 200; robots disallows the AI crawlers by name |
| 15 | `/places/does-not-exist/` | the 404 page |
| 16 | production alias | `vercel inspect https://travel-beta-tan.vercel.app` shows the new deployment, built from the named commit |
| 17 | phone (owner, real device) | bar, sign-in reach, a trip map, back-to-top, dark mode |

### 4.3 Rollback

Per bundle since 26 Oct (section 0a, B5): flags first, then `vercel rollback` (one deploy deep), then a redeploy of the
previous bundle's tag.

- **Code:** `vercel rollback <previous deployment url>`. On the Hobby plan this reaches only the immediately previous
  production deployment ([Vercel docs](https://vercel.com/docs/cli/rollback)). Anything older is a redeploy of the older
  `release/vX.Y` tag through section 6 steps 8 and 9 (minutes, not seconds). While a rollback is active, production
  auto-assignment is paused; the next release must confirm the alias moved (smoke 16) and use `vercel promote` if not.
- **Flags:** every feature has a capability flag; turning it off and redeploying is the first rollback for a feature bug.
- **Database:** migrations are additive only (new tables, nullable columns, new functions). A destructive change takes
  two releases: expand and switch reads in one, contract in a later one after the rollback window has passed. Never roll
  a migration back on production; roll the code back and leave the schema.
- **Neon config** (Require Verification, OAuth provider, SMTP): each release that changes one lists its reverse command;
  take a manual snapshot of the production branch before any production database or auth step (Q185).

## 5. Infra track I (no visitor change; ships with the next release, listed under "Internal")

Bundles since 26 Oct (section 0a.2): TS-1, TS-2a, TS-2, TS-4 ride A; TS-6, TS-3, TS-5, I1, I3, I5, I10 and CAT-1 ride B; TS-7,
TS-8, RIS-S, RIS-H and I7 ride C; I11 (CAT-Q) rides D; I9's FA-1 rides E and UA-0 rides J; I2 (LOCAL-4) and E2E-YML ride the
first bundle after the repository is public.

| Id | Task | Size (spec) | When | Note |
|---|---|---|---|---|
| I1 | LOCAL-3 drift stage in check-all | 3 h | v0.5 (C15, data seat) | needed by CI and CAT-1 |
| I2 | LOCAL-4 first CI workflow, plus the CI fixes of section 7.3 | 4 h (the fixes are unsized) | after PUBLIC-AUDIT; Q182 | section 7 |
| I3 | BKP-1 backups of private data | 6 h | gate for v0.5; Q185, Q228 | a local launchd job on the Mac, not in Actions or a companion repository (section 7.6) |
| I4 | MIG-N migration numbers at merge | 0.5 h | now | docs |
| I5 | LOCAL-5 child rehearsal command | 2 h | v0.5 (C15; was before v1.0) | the coordinator runs it before every production migration and data sync |
| I10 | CAT-V read-only production drift job (launchd on the Mac, weekly and after each release) | 2 h | v0.5 (C15) | [CATALOGUE-EARLY.md](CATALOGUE-EARLY.md) 6, 11.6 |
| I11 | CAT-Q store router and three `PostgresStore` methods for connected callers | 6 h | before FBK-C (v0.10) | anonymous routes stay on `JsonStore` (Q281) |
| I6 | Retro tag `release/v0.1` at 47be5b5 | minutes | now (Q220) | coordinator |
| I7 | ORG-C, ORG-D, ORG-G, ORG-M: origin contracts, the airports layer, trip gateways, routed gateway legs | 11.5 h | any time before v0.9 (seat B) | no visitor change until ORG-1 turns `gettingThere` on in v0.9 |
| I8 | Test strategy TS-1 to TS-8: tiered gates, the path-to-suite map, `tools/gate.sh`, caching, stacks, slots, nightly T3 | about 35 h | Q250 answered 25 Oct (yes); TS-1 any time | [TEST-STRATEGY.md](TEST-STRATEGY.md); the gate of 4.1 stays T3 |
| I9 | Audit tooling: FA-1 `node core/bin/fields.ts` and UA-0 the audit sweep harness | 10 h + 5 h | FA-1 around v0.11 to v0.12 (B2), before the gate G-AUD; UA-0 just before v0.22 (B1; moved from v0.14 on 26 Oct), before the gate G-UI | [AUDITS-AFTER-RELEASE.md](AUDITS-AFTER-RELEASE.md) 6, 7; no visitor change |

## 6. Release checklist for the coordinator

Run it top to bottom for every release. Push and tag commands go on lines of their own (the bash guard).

**Since 26 Oct a release is a bundle (section 0a):** `vX.Y` in the steps below reads as the bundle letter (`release/A`);
step 1 lists every feature of the bundle with its flag and marks each ready or shipped dark (B3); step 3 is T3 once for the
bundle; step 4 writes one CHANGELOG entry for the bundle with its "Features:" line (B7) and the data readiness numbers
measured against section 0a.4; the two-step bundles (B, H, K) repeat steps 7 to 9 for the flag step on the same commit
(B9) and tag once, after the first step's smoke.

1. **Ready.** Every task in the release row is merged on `main` with its review and verify notes; the flags to turn on,
   the migrations, the owner actions and the smoke additions are listed in the row.
2. **Merge.** In the main checkout: `git merge --no-ff public/<lane>` for each lane; then
   `git -C /Users/nks/workspace/travel push origin main` on its own line.
3. **Gate.** Section 4.1 on `main` HEAD. Write down the commit: this is the release's named commit.
4. **Notes.** Move the release's lines in [CHANGELOG.md](../../../CHANGELOG.md) from "Next" into a `vX.Y` entry with the
   date left as "pending", the commit, migrations and owner actions. Commit `docs(release): vX.Y notes` with only that
   file. The named commit stays the code commit of step 3 (a notes-only commit after it changes nothing that runs).
5. **Approval.** Send the owner the named commit, the notes, the flags, the migrations and their owner actions. Wait for
   "approved <sha>" (Q43). Nothing below runs without it.
6. **Snapshot and migrate.** If the release has migrations or a Neon config change: a manual snapshot of the production
   branch (owner or coordinator in the console), then `node --env-file=.env.local core/bin/db-migrate.ts plan` and `up`
   against production. Migrations go before the deploy; they are additive, so the running code tolerates them.
7. **Env.** The owner sets secrets in Vercel; non-sensitive flags (`NEXT_PUBLIC_*`) are set by the owner or by the
   coordinator with the owner's approval of the list. Confirm names only with `vercel env ls production`; never print a
   value. `NEXT_PUBLIC_*` values are inlined at build, so they take effect only with the deploy.
8. **Deploy the named commit.** In a clean worktree at that commit:
   `git -C /Users/nks/workspace/travel worktree add --detach /Users/nks/workspace/travel-wt/release-vX.Y <sha>`;
   `git -C /Users/nks/workspace/travel-wt/release-vX.Y status --porcelain` must print nothing; copy `web/.og-cache` and the git-ignored `.vercel/` project link from the main checkout;
   from that folder `vercel deploy --prod --meta commit=<sha>` (until v0.8 says prebuilt; then
   `vercel build --prod` followed by `vercel deploy --prebuilt --prod --meta commit=<sha>`). Record the deployment URL
   and id. Never run `./publish.sh` or `tools/publish.py` in a deploying mode.
9. **Smoke.** Section 4.2 plus the release's additions. The owner does the phone row for UI releases.
9a. **Catalogue sync (from CAT-1, v0.5; [CATALOGUE-EARLY.md](CATALOGUE-EARLY.md) 11.7).** In the release worktree (created
    at step 6 when the release has a database step): `pnpm db:sync --target production --dry-run`; if it exits 0 and the
    release has no migration, skip to step 11. Otherwise `pnpm db:rehearse` must be green for the named commit (before
    step 6 when there are migrations), then `pnpm db:sync --target production --approve <sha>` and `pnpm db:verify --target
    production` (exit 0), then one CAT-V run. Record the `load_run` id and row totals in the notes' Internal group. The
    owner's approval of the named commit covers this step (Q282). Deploy first, sync after: Postgres may lag the files by
    minutes, never lead them (Q283).
10. **If the smoke fails:** rollback (section 4.3), flags back, a "Rolled back" line in the notes, a BACKLOG row for the
    cause. Stop here.
11. **Tag.** `git -C /Users/nks/workspace/travel tag -a release/vX.Y <sha> -m "vX.Y: <goal>"`; then
    `git -C /Users/nks/workspace/travel push origin release/vX.Y` on its own line.
12. **Finalise the notes.** Fill the date and the deployment id in CHANGELOG, commit, push `main` on its own line.
13. **GitHub Release** (once the repository is public; it also works while private):
    `gh release create release/vX.Y --verify-tag --title "vX.Y: <goal>" --notes-file <the vX.Y section saved to the scratchpad>`.
14. **Records.** TODO rows to Done with the commit; BACKLOG rows; PLAN status cells; this page's release row marked
    shipped with the tag; HANDOVER's current section. Remove the release worktree.

## 7. GitHub Actions plan

### 7.1 Recommendation

**Two workflows that never deploy and never use a production secret (the production secrets stay stored in GitHub by the owner's choice, Q227; section 7.5 lists the rules that make that safe): `check.yml` (LOCAL-4, the gate on every push to
`main` and every pull request, plus a manual child-database job behind a protected environment) and `e2e.yml` (nightly on
`main` and manual, Chromium only).** Deploys stay a named commit run by hand (section 6). Answer Q182 yes. Trade-off: a
second top-level folder joins the folder contract, and CI results are advisory (no required check), because the
coordinator merges and pushes `main` directly.

### 7.2 Workflows

| Workflow | Triggers | Jobs | Secrets | Notes |
|---|---|---|---|---|
| `check.yml` (LOCAL-4, 4 h) | `push` to `main`, `pull_request`, `workflow_dispatch` | `gate`: checkout, pnpm, Node 22, Python, `pnpm install --frozen-lockfile`, build and start the `tools/db` Postgres 18 image on 127.0.0.1:54329, wait, `bash tools/check-all.sh` with `CI=true` (typecheck, unit tests for core, web and tools, `tree_check`, hard-coding scan, generated-file checks, budgets, the LOCAL-3 drift stage against the container); a step that fails if `DATABASE_URL` is set | none | top-level `permissions: contents: read`; `concurrency` per ref with cancel-in-progress; `timeout-minutes: 30` |
| `check.yml` job `child-db` | `workflow_dispatch` only | `core/test/db` against the Neon child | `TEST_DATABASE_URL`, held in a GitHub environment `child-db` with the owner as required reviewer | never runs on `pull_request`; 29 of 29 (or the count at build time), 0 skipped |
| `e2e.yml` (new; unsized, Q229 answered yes) | `schedule` nightly on `main`, `workflow_dispatch` | Playwright Chromium, one worker, after a build, on decoy data | none, no production secret (maps fall back to MapLibre without the `NEXT_PUBLIC_*` keys, as check-all builds do) | WebKit and the iPhone project stay on the Mac |
| Code scanning | GitHub default setup (no file) | CodeQL for JavaScript and TypeScript, Python | none | free on public repositories |
| Never | | anything that deploys, any workflow that reads a production secret (7.5), `pull_request_target` on pull request code, `workflow_run` with secrets, a self-hosted runner, a job that calls Commons, OSM, Wikidata or ORS | | the one-runner rule for public services holds in CI too |

### 7.3 CI fixes LOCAL-4 must include (found while planning; unsized)

| Problem | Effect in a clean CI checkout | Fix |
|---|---|---|
| `tree_check.py` rule 10 fails when `web/.og-cache` is absent (HANDOVER section 2; reproduced in this worktree) | the gate fails on every run | add `.og-cache` to the runtime-path pattern in `tools/tree_check.py`, with a test |
| The web build fetches Commons renditions when the cache is empty | thousands of calls from a shared GitHub IP, a 429, a broken one-runner rule | an offline image mode for CI (pages keep Commons URLs, as Vercel builds do today), asserted by a test that no Commons host is called |
| The place-size baseline was measured on builds with the image cache | a CI build without renditions may measure differently | run the budget stage in the same mode the baseline used; if they differ, mark the stage "Mac only" in CI until v0.8 makes builds deterministic |
| Third-party actions | a moved tag runs new code | pin `pnpm/action-setup` and any non-GitHub action to a commit SHA |

### 7.4 Safe settings for a public repository

| Setting | Value | Why |
|---|---|---|
| Actions, fork pull request workflows | "Require approval for all outside collaborators" | no stranger's code runs without the owner's click |
| Workflow permissions | "Read repository contents and packages permissions"; "Allow GitHub Actions to create and approve pull requests" off | a leaked token can do nothing |
| Allowed actions | GitHub-authored plus the listed, pinned ones | supply chain |
| Repository secrets | **kept** (owner, Q227, 25 Oct 2026): the production secrets and the `OWNER_EMAIL` variable stay stored in GitHub, because the owner wants them there. The names currently set are listed in 7.5. No workflow may use them, and `TEST_DATABASE_URL` is used only inside the protected `child-db` environment. The compensating rules are in 7.5 | the usual leak is a workflow that can read a secret; the rules remove every path to it that does not need the owner's click |
| Secret scanning and push protection | on | free on public repositories; blocks a pushed key |
| Dependabot alerts and security updates | on; version updates off | signal without noise |
| Private vulnerability reporting | on | a safe channel instead of a public issue |
| Rulesets on `main` | block force pushes and deletion; no required pull request or status check | keeps the coordinator's direct merges working |
| Rulesets on tags `release/*` | block update and deletion | a release tag never moves |
| Issues | off | reports go through the private form (Q133) |
| Vercel Git integration | disconnected, or `git.deploymentEnabled: false` (Q226) | Preview runs on production values (one-environment decision), so a pull request preview would build untrusted code with production secrets |
| BKP-1 backups | not in this repository's Actions and not in a private companion repository: a local scheduled job on the owner's Mac (section 7.6; Q228, 25 Oct 2026) | Actions artifacts of a public repository can be downloaded by any signed-in GitHub user; an encrypted dump of household data should not be there at all |

PUBLIC-AUDIT decides whether the repository goes public (history, the home point in `core/src/privacy/home.ts`, which
PLAN section 1 says must move to a secret before any visibility change, and anything else). This plan only says what
CI and the settings must be once it does. On a private repository the same workflows cost about 10 to 15 minutes a run
against the free 2,000 a month (local-database spec Q182).

### 7.5 Kept secrets: compensating rules (Q227, owner decision of 25 Oct 2026)

The owner keeps the production secrets and `OWNER_EMAIL` in GitHub Actions secrets and is not deleting them. The earlier
recommendation (delete them, because no workflow needs them) is superseded. Recommendation and trade-off: keep them
stored but make them unreachable by policy; the risk is one future workflow mistake, a secret that no workflow can read
cannot leak that way. These are owner-visible conditions; the coordinator checks them at every workflow change and
PUBLIC-AUDIT checks them before the repository goes public.

| Rule | Condition |
|---|---|
| R1 | No workflow may use a production secret. `check.yml` and `e2e.yml` read none; `check.yml` keeps its step that fails if `DATABASE_URL` is set |
| R2 | Pull request and fork workflows never receive them: fork pull requests get no secrets (GitHub default, left on), and `pull_request_target` is not used on pull request code |
| R3 | Any workflow that ever needs one must run in a GitHub environment named for production deploys (for example `production-deploy`) with the owner as required reviewer, restricted to the `main` branch and `release/*` tags; the secret is stored on that environment only, not as a repository secret |
| R4 | `TEST_DATABASE_URL` stays in the protected `child-db` environment with the owner as required reviewer, and never runs on `pull_request` |
| R5 | A change to anything under `.github/` is read by the owner before it merges, and the allowed-actions list stays GitHub-authored plus pinned |
| R6 | Recommend the owner reconsider this decision when the first workflow lands (LOCAL-4): at that point the choice is concrete, and deleting costs one `gh secret delete` per name, with a re-add if a deploy workflow is ever built |

Names currently set as repository secrets (from [the local-database spec](../features/local-database-and-seed-sync.md)
section 3, names only, no values; the list is as documented on 25 Oct and the coordinator confirms it with
`gh secret list` before PUBLIC-AUDIT): `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NEON_AUTH_BASE_URL`,
`NEON_AUTH_COOKIE_SECRET`, `NEON_AUTH_JWKS_URL`, `NEON_REALTIME_URL`, `NEON_REALTIME_SECRET`,
`NEXT_PUBLIC_GOOGLE_MAPS_KEY`, `NEXT_PUBLIC_GOOGLE_MAP_ID`, `NEXT_PUBLIC_PLACE_MAP_FAMILY`, `NEXT_PUBLIC_SIGN_IN`,
`ORS_API_KEY`, `RESEND_API_KEY`, `TEST_DATABASE_URL`. The `OWNER_EMAIL` variable is set too (a variable, not a secret).
Secrets added later in plans (for example `GOOGLE_PLACES_API_KEY`, `TURNSTILE_SECRET_KEY`, `INTAKE_*`) belong in Vercel
only, never in GitHub.

### 7.6 Backups run from this machine (Q228, owner decision of 25 Oct 2026)

BKP-1 is a local scheduled job on the owner's Mac. It does not run in GitHub Actions and not from a private companion
repository; the earlier recommendation (a private companion repository) is superseded. Planned only, additive; nothing
here is built.

| Part | Plan |
|---|---|
| Scheduler | a launchd user agent (`~/Library/LaunchAgents/`, a label such as `com.nks.travel.backup`) running nightly; `StartCalendarInterval` fires on wake if the Mac was asleep at the time |
| Script | `tools/db/backup.sh` (or `backup.mjs`), in the repository, no secret inside it; it runs `pg_dump` of the private tables of production through a read-only database role (created by an additive migration, `SELECT` on the private tables only, no write grant), then encrypts the dump with `age` to the owner's public key |
| Destination | an encrypted local backup folder outside the repository (for example `~/Backups/travel/`), retention by script: 7 daily and 4 weekly, older files removed |
| Credentials | only from `~/.config/travel-secrets` (file mode 600, checked by the script, which refuses to run if the mode is wider); the `age` private key is never on this machine's backup folder or in the repository |
| Logs | a log file with start, end, byte size, row counts and result; a test asserts that no connection string, password or key appears in it |
| Restore test | monthly, into the local Docker database, counting rows (as in the local-database spec) |
| Risk, stated | backups run only when the machine is on; a night with the Mac off is a missed backup, and the log shows the gap. The 6-hour Neon window and a manual snapshot before each production step (Q185) stay the cover. A **second copy** (for example an encrypted offsite upload) is a later option, not planned now |
| Gate | still the gate for v0.5 (BKP-1 green, or the owner accepts the manual snapshot regime, as before) |

## 8. Release notes convention

- One file, the root [CHANGELOG.md](../../../CHANGELOG.md), in Keep a Changelog style: newest first, a "Next" section at
  the top for what is merged or planned and not released, then one entry per release. **Since 26 Oct one entry per bundle**
  (`## [A] - <date>`), whose first line names the feature labels it carries (`Features: v0.2, v0.3, v0.4`); `v0.1` keeps its
  entry. Template:

  ```
  ## [A] - <date>
  Features: v0.2, v0.3, v0.4. Commit <sha>. Deployment <id>. Migrations: none. Owner actions: <list>.
  ### Added / Changed / Fixed / Removed / Security
  ### Data  (the bundle's readiness line, measured: target and result)
  ### Known limits
  ### Internal  (infra, the catalogue sync, features built and switched off)
  ```
- Each entry carries: the date, the named commit, the deployment id, migrations applied (numbers), the owner actions
  done, then the groups Added, Changed, Fixed, Removed, Security and Known limits, and "Internal" for changes with no
  visitor effect.
- Plain English for a visitor: what they can now do, where, and what still does not work. No task ids in the visitor
  lines (they go in the header line), no emojis, no household data (no party, ages, home town, travel dates, booking
  state or names), no secrets or env values, no internal URLs.
- The coordinator drafts the entry at step 4; the owner approves it in the same message as the named commit; for
  releases that change sign-in, intake or MCP, the spec's security reviewer also reads the wording.
- GitHub Releases copy the entry verbatim (step 13).

## 9. Owner questions (Q220 to Q229, all answered 25 Oct 2026)

R-178, R-179 and Q219 stay unused. The parallel REQ-FORM task took R-190 to R-196, Q230 to Q239 and BACKLOG 15.190 to 15.196 ([request-intake-fields.md](../features/request-intake-fields.md)).

| ID | Question | Recommendation (and answer) | Trade-off |
|---|---|---|---|
| Q220 | Release numbering v0.1, v0.2, ... with tags `release/vX.Y`, `release/v0.1` tagged now at 47be5b5, and the notes approved in the same message as the named commit? | **Yes** (ANSWERED 25 Oct 2026: yes, as recommended.) | One more line in each approval message |
| Q221 | Do not deploy `main` alone now (LOCAL-2 and docs change nothing for visitors); it rides v0.2 | **Yes** (ANSWERED 25 Oct 2026: yes, as recommended.) | Production stays one internal change behind `main` until v0.2 |
| Q222 | Pull GSI-P (`/privacy/`, 2 h) into v0.2 and switch the beacon on then, measuring the place budget without the beacon tag and recording the tag as a fixed overhead outside the ratio | **Yes** (ANSWERED 25 Oct 2026: yes, as recommended.) | One third-party script on every page; the budget no longer counts every byte a visitor downloads |
| Q223 | Pull OVR-0 (3 h) into v0.3 so trip pages get the favourite heart and later trip features have start-JS room | **Yes** (ANSWERED 25 Oct 2026: yes, as recommended.) | It touches `web/components/trips/**` before R-59 and must merge before R-59 starts |
| Q224 | Accept that v0.4 (D2b) and v0.3 may swap, the number following the deploy order | **Yes** (ANSWERED 25 Oct 2026: yes, as recommended.) | Version numbers in this page may shift by one |
| Q225 | Ship the public MCP (v0.15) before the private one, with its own security review slice cut from MCP-S | **Yes** (ANSWERED 25 Oct 2026: yes, as recommended.) | A second, smaller review; the spec's 4 h MCP-S must be split at brief time |
| Q226 | Disconnect the Vercel Git integration, or set `git.deploymentEnabled: false`, before the repository goes public | **Yes, required** (ANSWERED 25 Oct 2026: yes, as recommended.) | Previews only by hand (`vercel deploy` without `--prod`) |
| Q227 | Delete the production secrets and the `OWNER_EMAIL` variable from GitHub; keep only `TEST_DATABASE_URL` in a protected `child-db` environment | ~~Yes~~ **CHANGED (owner, 25 Oct 2026): keep the production secrets and `OWNER_EMAIL` in GitHub Actions secrets; not deleting.** Compensating rules R1 to R6 in section 7.5; reconsider when the first workflow lands | The leak surface stays stored; it is closed only by the rules, not by absence |
| Q228 | Run BKP-1 outside this repository's Actions: from a private companion repository (free private minutes) or the owner's Mac, with the encrypted dump stored privately | ~~Private companion repository~~ **CHANGED (owner, 25 Oct 2026): run BKP-1 from this machine as a local scheduled job** (launchd, section 7.6), not from GitHub Actions and not from a companion repository | Backups run only when the Mac is on; a second, encrypted offsite copy is a later option |
| Q229 | Two planning gaps: (a) add the `e2e.yml` nightly workflow as a LOCAL-4 follow-up (unsized; its brief sizes it); (b) build the invite-only check Q98 implies for customisation inside CUS-C (unsized) | **Yes to both** (ANSWERED 25 Oct 2026: yes, as recommended.) | (a) Actions time each night (the full three-project e2e takes about 41 minutes on the Mac; Chromium alone is less), free on a public repository; (b) CUS-C grows |

Open questions this train waited on: Q101 to Q108, Q130 to Q137, Q93 to Q100, Q67, Q98, Q103, Q120, Q160 to Q167, Q190 to Q198, Q148 and Q149 were **answered 26 Oct 2026, yes as recommended** (ANSWERS-5; PLAN section 5, answered table). Q148 means the v0.17 domain release ships only on a trigger, and a domain name and price are owner input needed. Still open: the `planner_draft_signal` ruling. The owner inputs are listed once in [MASTER-ORDER.md](MASTER-ORDER.md) 7.3. Q280 to Q286 (CAT-1) were answered 26 Oct: yes, as recommended; Q183 is superseded.

## 10. Gotchas

- **Hobby rollback is one step deep.** Two quick deploys in a row leave no instant way back to the first; space releases
  so each has its smoke run before the next deploy. Bundles B, H and K deploy twice by design (0a, B9): their own first step
  is then the only instant way back, and the previous bundle needs a tag redeploy.
- **`NEXT_PUBLIC_*` is build-time.** Flipping a flag in Vercel does nothing until the named commit is deployed again.
- **One environment.** Preview runs on production values (owner, 25 Oct): a preview is not a safe test bed for a
  migration or a Neon config change; the child branch is.
- **Budgets are shared across releases.** Trip start JS 2 B and place HTML 19 B of headroom at v0.1; any release can
  break the next one's budget. Measure before and after, in both builds.
- **Production is live but HANDOVER and PLAN still say "no production deployment"** in places; this page and PLAN's
  header line win until the coordinator rewrites them.
- **ACCT-PH is interim.** Its bar item lives one release (v0.2 to v0.3); do not build on it.
- **Data releases have no flag.** A merged data batch ships with the next deploy whatever its number.

## Change log

| Date | Change |
|---|---|
| 2026-10-27 (BUILDER-DEPS) | Banner; 0a.2 rows D to K, All (2,295.5 h) and the count lines; 0a.3 findings 15 to 19; 0a.4 lines for D to G. [builder-dependency-map.md](builder-dependency-map.md) |
| 2026-10-26 (ALIGN, evening) | Banner rewritten (G-UXA passed); 0a.1 rule B11 (bundle H2, if QX2); 0a.2 table rewritten with the 26 Oct additions (C 301.5 h, H 81 h, H2 115 h, 1,350.5 h) and their counting; 0a.3 findings 11 to 14; 0a.4 rows for C additions and H2. [alignment-2026-10-26.md](alignment-2026-10-26.md) |
| 2026-10-26 (ANSWERS-5) | Section 9's open-questions paragraph updated: Q101 to Q108, Q93 to Q100, Q130 to Q137, Q160 to Q168, Q190 to Q198, Q148 and Q149 answered 26 Oct 2026, yes as recommended; bundle A's tag is `release/A` (Q290). Nothing else changed |
| 2026-10-26 (PLAN-CONSOLIDATE job 3) | Section 3 note and two Data work rows point to [DATA-PLAN.md](DATA-PLAN.md) instead of repeating it |
| 2026-10-26 (PLAN-CONSOLIDATE, owner decision) | Section 0a: releases become bundles A to K with the v0.x numbers kept as feature labels; rules B1 to B10 (independent flagged features, T1 per feature, T2 per stack, T3 per bundle, late features shipped dark, security reviews kept in B and H, rollback per bundle, tags `release/<letter>`, one CHANGELOG entry per bundle, data readiness, two-step bundles, order); hours per bundle with research added (986 h with I at 29 h); ten dependency findings and their fixes; data readiness per bundle and the data-seat capacity check. Notes on 4.1, 4.3, 5, 6, 8 and 10. Supersedes one release per feature (R-180) |
| 2026-10-26 (CATALOGUE-EARLY, owner decision) | C15: the catalogue load moves from v1.0 to v0.5 as Internal (CAT-1); v0.5 gains an Internal row and `research_meta`; v1.0 pre-work, dependencies, data work and migrations rewritten (23 h left); I1 and I5 to v0.5, new I10 (CAT-V) and I11 (CAT-Q); checklist step 9a (catalogue sync after the deploy); open-question line. No release renumbered ([CATALOGUE-EARLY.md](CATALOGUE-EARLY.md)) |
| 2026-10-26 (H-DOCS) | Status lines fixed (MASTER-ORDER H4): the owner action for Q240 to Q249 reads answered 25 Oct; I8 waits on Q250, answered 25 Oct, not on "the Q250 answer". Nothing else changed |
| 2026-10-26 (AUDIT-MOVE) | Section 0 note: the UI and UX audit moves from patch release v0.14.2 to the new release v0.22 before v1.0 (owner decision); v0.14.1 is the only patch release (Q271 answered); I9 timing for UA-0; UI-NOTES.md. Train: v0.22 follows v0.21 (MASTER-ORDER 5.3); no other release renumbered |
| 2026-10-25 (audits after release) | Section 0 note: audits after v0.14 with patch releases v0.14.1 and v0.14.2 (Q271, open); infra row I9 for the audit tooling ([AUDITS-AFTER-RELEASE.md](AUDITS-AFTER-RELEASE.md)). No release renumbered |
| 2026-10-25 (owner answers, ANSWERS-4) | Q262 approved 25 Oct 2026: the section 5.3 numbering is THE train; the release numbers in sections 1 to 3 are legacy. Section 0 sentence marked; nothing else changed |
| 2026-10-25 (master order) | Section 0 added: corrections C0 to C14 and the old-to-new release numbers from [MASTER-ORDER.md](MASTER-ORDER.md) 5.3 and 5.5 (R-220, Q260 to Q268); sections 1 to 3 keep the first version's numbers until the owner answers Q262 |
| 2026-10-25 (test strategy) | Infra row I8 added for TS-1 to TS-8 ([TEST-STRATEGY.md](TEST-STRATEGY.md)); the gate of section 4.1 is that page's T3, unchanged |
| 2026-10-25 (trip origin) | Getting there from the nearest airport or the visitor's city ([spec](../features/trip-origin-and-nearest-airport.md)): v0.9 gains ORG-N, ORG-A, ORG-1, ORG-2, ORG-R, ORG-V (16.5 h) after R-59; ORG-C, ORG-D, ORG-G, ORG-M ride earlier as internal; widenings in v0.3 (NAV-C), v0.7 (FBK-C), v0.11 (CUS-C); ORG-H with v0.12 if Q246; ORG-MCP in v0.15; ORG-P not on the train; one parallel row. Q240 to Q249 open |
| 2026-10-25 (owner answers, ANSWERS-3) | Q220 to Q226 and Q229 answered yes as recommended. Q227 changed: the production secrets and `OWNER_EMAIL` stay in GitHub Actions secrets, with compensating rules R1 to R6 (new 7.5, the 7.4 row, 7.1 and 7.2). Q228 changed: BKP-1 runs from this machine as a launchd job (new 7.6, 7.4 row, I3). The earlier recommendations are marked superseded in section 9 |
| 2026-10-25 | First version: release train v0.1 to v1.2, critical path and seats, gate, smoke list, rollback, the coordinator's checklist, the GitHub Actions plan for a public repository, the release-notes convention, Q220 to Q229 |
