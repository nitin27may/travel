# Master order: every remaining task, what it conflicts with, the lanes, and the release train

Written 25 Oct 2026 by travel-planner (Opus 5.5) on `public/MASTER-ORDER`, branched from `main` 09784bc (rewritten public
history; `main` has since gained ed0056d, an e2e-only commit). **Planned only: no product code changed.** Requirement PLAN
R-220; BACKLOG 15.220 to 15.229; owner questions Q260 to Q268 (section 7; all answered 25 Oct 2026, yes as recommended). Principles cited by number from
[principles.md](../design/foundation/principles.md).

**The owner's request (25 Oct 2026, after answering Q200 to Q239).** "Fold the detailed plan for everything remaining,
then analyse the whole plan and group it in logical order so work items do not conflict or step on each other, before
any new build starts."

**Supersedes:**
- [RELEASE-PLAN.md](RELEASE-PLAN.md) release numbers from v0.4 onward and its section 2 seat table (section 5 here maps
  old to new numbers; RELEASE-PLAN section 0 points here). The gate, smoke list, rollback, checklist and CI plan of
  RELEASE-PLAN sections 4 to 8 stand unchanged.
- [briefs/OVR.md](public-site/briefs/OVR.md): OVR-0 "after OVR-Cb" (OVR-0 has no dependency, Q223), and `pickPhotos`
  ownership (moves from OVR-3 to the photos task PHO-C), and the CUS owned file `0011_planner_draft_doc.sql` (0011 is
  `quota`; numbers at merge, MIG-N).
- [local-database-and-seed-sync.md](../features/local-database-and-seed-sync.md) 8: BKP-1 "depends on LOCAL-4" (it is a
  local launchd job since Q228) and "no migration" (its read-only role needs one).
- [feedback-and-reports.md](../features/feedback-and-reports.md) 10.3: FBK-C "intake migration number after FAV-D" (FAV-D
  now ships six releases later; the intake migration takes the next number at its own merge).
- [google-and-apple-sign-in.md](../features/google-and-apple-sign-in.md) 13: GSI-1's owned files `AuthForm.tsx` and a new
  `return-path.ts` (EML-1 replaced the first and created the second; GSI-1 builds on `SignInCard.tsx`).

## 1. Decision in one paragraph

Run **four working seats at most**: builder 1 (B1, public web UI, Sonnet), builder 2 (B2, contracts, core, auth,
platform and MCP, mostly Opus), one data seat (researcher on Opus, or a Sonnet builder for code-run data tasks), and one
verifier (Sonnet), with the design reviewer (Opus) called per UI task and docs-only lanes on top. The heavy machine
work is two builds and one Playwright run at a time (TEST-STRATEGY 7.3). B1 is the critical path (about 355 agent
hours); B2 keeps one release ahead of it with the contract each B1 task needs. Every UI task moves one of two
budgets that have almost no room left (trip start JS 0.6 KB, place HTML about 0.1% of the median), so UI branches
are built in parallel but merged one per stack, and two measures land first: OVR-0 frees trip start JS (v0.3), and
BUD-1 measures the place budget on catalogue content only (v0.2, Q260). The train is re-cut in value and dependency
order: the D2b data already on `main` ships in v0.2; the overdue trip-page go-live fixes and share images get v0.4; the
owner's 23 Oct closure queue (Where by city, near mode, CONS-3), which RELEASE-PLAN dropped, gets v0.6 before R-59;
photos move ahead of R-59; request forms, Where to stay and trips-from-data get their own releases. **Trade-off:** more
releases (v0.2 to v0.21, then v1.x) and one renumbering now, against releases that each have one owner preview, one
budget story and no hidden dependency.

## 2. State at the start (checked 25 Oct 2026)

| Fact | Evidence | Consequence |
|---|---|---|
| `main` is the rewritten public history; every commit id quoted in tracked docs before it (684 mentions in 87 files) points at the private history | `git merge-base --is-ancestor d93127b main` fails; [public-scrub audit](../../../research/audits/public-scrub-2026-10-25.md) 5.5 | H3 rewrites them from the commit map (Q264); until then, read old ids through the map |
| Production runs the private commit d93127b, which is `47be5b58` on the public history (filter-repo commit map) | the map in the session scratch folder `filter/filtered.git/filter-repo/commit-map` | tag `release/v0.1` on `47be5b58`, not on d93127b (H1); copy the map out of the scratch folder before it is cleaned (H2) |
| ACCT-PH is merged (`7ab0657`) with no design review or verify note | no review file in `docs/v2/design/shell/` for it | ACCT-PH-RV is a v0.2 task |
| D2b (74 stored places) is merged (`41ca7f4`), with option A of Q88 (`1726dfe`, "not for merge without a ruling") also on `main` | `git log main` | D2b rides the next deploy (v0.2), so Q88 needs the owner's ruling before it; the median is 1.2491 against 1.25 |
| BUDGET-FIX merged (lazy Add-to-day panel): trip start JS 199.4 of 200 KB | [origin spec](../features/trip-origin-and-nearest-airport.md) 12 | 0.6 KB for every trip-page addition until OVR-0 |
| PUBLIC-SCRUB merged: the home point is read only from `HOME_POINT_LAT`/`HOME_POINT_LON`; unset, `nearHome()` throws | `core/src/config/home.ts` | every worktree's check-all and every Vercel build needs the two variables (Q261, and an owner action in v0.2) |
| The TRP2b2 "before go-live" deferrals are open while production is live | [REMAINING-CLOSURE-PLAN.md](public-site/REMAINING-CLOSURE-PLAN.md) 4 | TRP-GL in v0.4 |
| The owner's closure queue items 2 to 4 (API/HYG loose ends, LST2b, CONS-3) are in no release; the 24 Oct owner sequencing put them before R-59, and Q206 let only NAV phase 1 jump ahead | closure plan 2; Q206 | v0.6 |
| `public/TEST-STRATEGY` was on the public history and is merged into `public/DOCS-STACK` (25 Oct): TS-1 to TS-8, R-210 to R-214, Q250 to Q258, BACKLOG 15.210 to 15.218, EXECUTION-PLAN 10.4, RELEASE-PLAN I8 | `git log public/DOCS-STACK` | merged first (H0); its tiers are this page's gates |
| `public/ORIGIN-PLAN` (1bb4783) was on the **private** history (base aa01821) and is merged into `public/DOCS-STACK` as a cherry-pick of its single commit (25 Oct): ORG-*, R-200 to R-207, Q240 to Q249, BACKLOG 15.200 to 15.208, EXECUTION-PLAN 10.3, RELEASE-PLAN I7 | `git log public/DOCS-STACK` | cherry-picked onto the public history, scrub scan of the stack's diff against `main` passed (H0); the old branch is deleted at H7 |
| Every other `public/*` branch is content-equal to `main` (patch ids differ only by the scrub's text rewrite: 54 per branch) | `git cherry main <branch>` over the 96 branches | delete them as one batch on the owner's go (H7, Q265); never merge an old-history branch |
| Migrations 0001 to 0011 applied; next free number 0012 | `core/src/db/migrations/` | numbers at merge (MIG-N); section 3.4 lists the provisional order |
| `/privacy/` does not exist; the beacon script is in `web/app/layout.tsx` behind `NEXT_PUBLIC_CF_BEACON_TOKEN` | file tree | GSI-P in v0.2 |
| No rate limit covers `/api/v1/*` on production (15.22); the Maps key restriction (Q-D) is unconfirmed | BACKLOG 15.22, 15.25 | owner actions in v0.2 (P8) |

## 3. Inventory: every remaining task

Sizes are agent hours from the specs; a size marked "new" is set here. Models follow CLAUDE.md (Haiku mechanical,
Sonnet specified, Opus contracts, privacy, review and research). "Release" is the new train of section 5. Status:
**open** (specified, not started), **ready** (no blocker left), **blocked** (the cell names the blocker), **planned, spec
merged** (the spec is on `main`'s docs stack, no code yet), **later** (not on the train).

### 3.1 Done since the specs were written (deduplicated; do not schedule again)

| Done | Where | Specs or rows that still say "planned" |
|---|---|---|
| EML-0, EML-M, EML-Q, EML-1, EML-R | `main` (EML-1 merge `47be5b5`, migration 0011) | BACKLOG 15.100 to 15.107 |
| MCP-0 spike (child OAuth plugin on) | `main` | BACKLOG 15.125 |
| LOCAL-1, LOCAL-C, LOCAL-2 | `main` (`61e8b92` LOCAL-2) | BACKLOG 15.141 to 15.143 |
| RIS-C, RIS-N | `main` | BACKLOG 15.131, 15.132 |
| D1, D1b, D2b (US, CA, IT, INT), D3a, D4a, D5a, D5b, D6a, D6a-W, D7-R, D9-R, L1, AREA (derive-area) | `main` | DATA-ROADMAP section 2 (D2b "in progress"), BACKLOG 15.110 to 15.113 |
| PLC2b, TRP2b2 (preview closure), FIXDOC, ACCT-PH (build only), BUDGET-FIX, E2E-FIX, FAMAGE10, TOTOP, PUBLIC-AUDIT, PUBLIC-SCRUB | `main` | HANDOVER "running or open work" |
| Superseded, never build: INT-C, INT-1, INT-S, INT-2, INT-4 UI, REP-1 (by FBK-*); GSI-V2 (by EML-1); DATA D2 (by D2b); the public feedback repo (Q133); R1 and R2 as release gates (by the per-release approval, Q268) | specs | visitor spec 15, PLAN 3 |

### 3.2 Housekeeping and coordinator (docs only; no build slot)

| Id | Task | h | Model | Owns | Spec | Status | Release |
|---|---|---|---|---|---|---|---|
| H0 | Merge the three docs branches in order: TEST-STRATEGY (merged), ORIGIN-PLAN (cherry-picked, scrub scan passed), MASTER-ORDER; planning-doc text conflicts resolved with both sides kept. Done on `public/DOCS-STACK`; the fast-forward of `main` is the coordinator's | 0.5 | coordinator | merges | this page 6 | stacked, awaiting the fast-forward of `main` | J0 |
| H1 | Tag `release/v0.1` on `47be5b58` with the message "v0.1: public site live (deployed as d93127b on the private history)" | 0.1 | coordinator | tag | RELEASE-PLAN I6 (corrected) | ready | v0.1 |
| H2 | Copy the filter-repo commit map out of the session scratch folder to the owner's private backup folder | 0.1 | coordinator | none in the repo | scrub 4, 5.5 | ready, urgent | J0 |
| H3 | Rewrite the 684 stale commit ids in 87 tracked files to public ids from the map; ids with no public commit (archive tags, private-only merges) get a "(private history)" suffix | 3 | Haiku script, Sonnet check | `docs/**`, `HANDOVER.md`, `CHANGELOG.md`, `research/runs/**`, `research/audits/**`, one comment in `core/src/catalogue/store.ts`, four test comments, the note in `data/capture/gap-budget.json` | scrub 5.5 | blocked: Q264, J0 | J1 |
| H4 | Status sync: BACKLOG and DATA-ROADMAP rows for the work in 3.1 marked done with public ids | 1.5 | Haiku | `BACKLOG.md`, `DATA-ROADMAP.md` | this page 3.1 | blocked: H3 | J1 |
| H5 | HANDOVER current section rewritten (text in 8.2) | 1.5 | Opus planner | `HANDOVER.md` | 8.2 | blocked: J1 | J1 |
| H6 | CLAUDE.md edits (text in 8.1) | 0.25 | owner | `CLAUDE.md` | 8.1 | owner | J1 |
| H7 | Delete the merged old-history `public/*` branches and their worktrees as one listed batch | 1 | coordinator | refs, worktrees | 2; R-44 | blocked: Q265 | J1 |
| H8 | MIG-N: specs that reserve 0011 say slugs; NEON-MIGRATIONS lists numbers taken | 0.5 | coordinator | the four specs, `NEON-MIGRATIONS.md` | local-db 8 | ready | J1 |
| H9 | Close R1 and R2 in PLAN 3 and EXECUTION-PLAN 8 and 11 as superseded by per-release approval | 0.5 | Opus planner | those sections | Q268 | blocked: Q268 | J1 |

### 3.3 Platform, CI and test infrastructure (lane P)

| Id | Task | h | Model | Owns | Spec | Status | Release |
|---|---|---|---|---|---|---|---|
| O-HP | Owner: the home point for every worktree from one mode-600 file the shell loads, not a copy of the root `.env.local` (Q261) | 0.1 | owner | `~/.config/travel-secrets/home-point.env`, `~/.zshenv` (one line) | Q261 | blocked: Q261 | J0 |
| BUD-1 | (new) Place-size S13 measures catalogue content only: shell chrome (header, footer, bottom bar, beacon tag) leaves the ratio and gets its own cap (today's bytes + 1 KB); a `budget:report` script prints both budgets' headroom for hand-backs | 3 | Opus | `web/tests/data/place-size.test.ts`, `web/tests/data/place-html-baseline.json` (re-measured by the new rule only), `web/tests/budget.test.ts` (report hook), `web/scripts/budget-report.mjs` (new), `web/package.json` (one script) | Q222, Q260 | blocked: Q260 | v0.2 |
| IMG-1 | (new, was unsized) Renditions and share images run before the Vercel adapter collects pages, or deploys go prebuilt; CI offline image mode with a test that no Commons host is called; `tree_check` rule 10 accepts an absent `web/.og-cache` | 7 (Opus 2 spike, Sonnet 5) | Opus, Sonnet | `web/scripts/images.mjs`, `web/scripts/og.mjs`, `web/package.json` build scripts, `tools/tree_check.py` and its test, `web/tests/images*.test.ts` | EXECUTION-PLAN 13.2; RELEASE-PLAN 7.3 | ready | v0.4 |
| TS-1 | Path-to-suite map and its check | 5 | Opus | `tools/gate/map.json`, `tools/gate/check_map.py`, tests | TEST-STRATEGY 12 | planned, spec merged | I (with v0.3) |
| TS-2a | Web vitest projects `unit`, `built`, `fixture`, `timing` | 3 | Sonnet, Opus review | `web/vitest.config.ts`, `web/tests/global-setup*.ts` | TS 12 | planned, spec merged | I (v0.3) |
| TS-2 | `tools/gate.sh` and `gate.py` | 8 | Sonnet | `tools/gate.sh`, `tools/gate/**`, one step in `tools/check-all.sh` | TS 12 | planned, spec merged | I (v0.4) |
| TS-4 | Slots, load guard, flake ledger | 4 | Sonnet | `tools/gate/slots.py`, `flakes.py` | TS 12 | planned, spec merged | I (v0.4) |
| TS-6 | Nightly T3 by launchd | 2 | Sonnet | `tools/nightly/**` | TS 12 | planned, spec merged | I (v0.5) |
| TS-3 | Cache by tree hash | 4 | Sonnet, Opus review | `tools/gate/cache.py` | TS 12 | planned, spec merged | I (v0.5) |
| TS-5 | Agent definitions and HANDOVER commands | 2 | Opus planner | `.claude/agents/travel-builder.md`, `travel-verifier.md`, HANDOVER section 2 rows | TS 12, Q257 | planned, spec merged | I (v0.5) |
| TS-7 | `--stack` with ejection and bisect | 5 | Sonnet, Opus review | `tools/gate/stack.py` | TS 12 | planned, spec merged | I (v0.6) |
| TS-8 | First escape audit, measured savings | 2 | Sonnet, Opus | TEST-STRATEGY 11, 15 | TS 12 | planned, spec merged | I (two weeks after TS-2) |
| BKP-1 | Backups of private tables by a local launchd job; read-only role by an additive migration (`backup-reader`); `age` encryption; retention; monthly restore test | 6 (+0.5 migration) | Opus 3, Sonnet 3.5 | `tools/db/backup.*`, the plist template, `core/src/db/migrations/<n>_backup_reader.sql`, tests | RELEASE-PLAN 7.6 | ready | v0.5 |
| LOCAL-3 | Drift stage in check-all | 3 | Sonnet | one `tools/check-all.sh` step, its test | local-db 8 | ready | I (v0.6) |
| LOCAL-4 | `.github/workflows/check.yml` plus RELEASE-PLAN 7.3 fixes not in IMG-1 (pinned actions, budget stage mode); the decoy home point as plain workflow `env` (not a secret) | 5 | Sonnet | `.github/**`, `tools/tree_contract.json` | RELEASE-PLAN 7.2 | blocked: repository public, Q182, LOCAL-3, IMG-1 | I (after the publish) |
| E2E-YML | Nightly `e2e.yml`, Chromium, decoy data (Q229a) | 3 | Sonnet | `.github/workflows/e2e.yml` | RELEASE-PLAN 7.2 | blocked: LOCAL-4, TS-6 | I |
| LOCAL-5 | `db:rehearse` | 2 | Sonnet | `core/bin/**` rehearse command | local-db 8 | blocked: RIS-L | v1.0 |

### 3.4 Data research (lane D; one runner per service; one writer for `points.json`, `gap-budget.json`)

| Id | Task | h | Model | Owns | Spec | Status | Release |
|---|---|---|---|---|---|---|---|
| Q88 | Owner ruling on the place budget: option A is already merged | 0 | owner | | PLAN 5 | blocked: owner | v0.2 |
| RIS-J | `normalise --write` on every family; registry reads windows, base plans, seasons; check first what D2b already converted to `capture-points/2` | 6 | Sonnet builder in the data seat | outputs of `normalise --write` on `data/**` families, `core/src/sources/**`, `data/sources/registry.json` | catalogue-intake 6 | ready (D2b merged) | v0.3 (data, no flag) |
| TRP-GL-D | Identity of Emerald Lake/lakeshore, Lake Louise/lakeshore, Paint Pots/walk (closure B4/D5) through sourced data | 2 | Opus researcher | the three records' files | closure plan 4 | blocked: RIS-J | v0.4 |
| ORPH-7 | Place records for the 7 offers that say where nowhere (`E_PLACE_ORPHAN` 7 to 0) | 3 (new) | Opus researcher | `data/capture/canadian-rockies-2029/*.json` new place records, slugs through `slugs.ts` | DATA-ROADMAP D4a | blocked: RIS-J | v0.6 |
| AREA-2 | Area records for the 227 records with no area (`E_PLACE_AREA` 227 down); any new type is one `types.json` entry by one writer with an Opus review | 6 (new) | Opus researcher | area records, `data/capture/derived-areas.json` via `derive-area`, `data/vocab/types.json` (only if a type is missing) | gap budget | blocked: RIS-J | v0.6 |
| RIS-S | `capture.ts stale` from the JSON | 3 | Sonnet (B2) | `core/bin/capture.ts`, `core/src/capture/stale*` | catalogue-intake 6 | ready | I (v0.6) |
| D3 | Trail facts for the rest | 10 | Opus researcher | `TF.json` and sidecars per trip | DATA D3 | blocked: RIS-J | v0.7 (data) |
| D5c | Photos for plan-day stops beyond D5a (unverified count) | 4 | Opus picks, Haiku runs | `PH.json` per trip | DATA D5b | blocked: Commons runner free | v0.7 (data) |
| L3 | Photos for the 74 stored places beyond Commons | 4 | Opus, Haiku | place galleries | DATA-LOC | blocked: DD-3 | later |
| STY-P | `base` property group on settlement types (registry) | 2 | Opus (B2, contract lane) | `core/src/schema/capture/properties.ts`, `capture.ts build` outputs | stays 15 | ready | v0.13 (internal earlier) |
| RIS-H | Homes for 7 researched properties | 3 | Opus (B2, contract lane) | `core/src/schema/capture/properties.ts`, renderers | catalogue-intake 6 | ready; not beside STY-P (same file) | I (v0.7) |
| RIS-A | Promote research (D7-R access seasons, D3a and D4a proposals, D1b facts; D9-R town facts after STY-P) | 8 | Opus researcher | changeset files; coordinator applies | catalogue-intake 6 | blocked: RIS-J, RIS-H, STY-P | v0.13 (data) |
| ORG-G | Gateways for the 13 public trips | 3 | Opus researcher | `data/trips/gateways.json`, research notes | origin spec 13 | planned, spec merged; blocked: ORG-D | v0.8 |
| D8-R | Rockies overview facts | 8 | Opus researcher | `OV.json` and sidecar | DATA D8 | blocked: RIS-J | v0.12 |
| D8 | Overview facts, 7 more trips | 8 | Opus researcher | per trip | DATA D8 | blocked: D8-R | v0.12 |
| D7 | Windows for 13 more trips | 16 | Opus researcher | `data/windows/<trip>.json` | DATA D7 | blocked: OVR-Ca | v0.12 |
| D9 | Stay bases for the other trips | 8.5 | Opus researcher | `data/base-plans/<trip>.json` | DATA D9 | blocked: STY-Ca, STY-E | v0.13 |
| DP | Dolomites prose to records (optional) | 4 | Opus researcher | `data/capture/dolomites-2027/DP.json` | DATA-ROADMAP | open | later |
| L4 | Cross-check the 74 | 2 | Sonnet verifier | report | DATA-LOC 6 | open | v0.6 (data) |
| D610 | The 42 dated texts list (BACKLOG 3.10) and the D6a run note | 1 | Haiku | BACKLOG 3.10 list, `research/runs/DATA-D6a-seasons.md` | DATA-ROADMAP DD-4 | open | J1 |
| D1B-Q | The five open D1b rulings (owner and coordinator) | 0.5 | owner | the run note | DATA-D1b run note | open | v0.4 |

### 3.5 Contracts (lane C, run by B2; one author at a time on the shared contract files of 4.3)

| Id | Task | h | Model | Spec | Status | Release |
|---|---|---|---|---|---|---|
| NAV-C | `copies/1`, legacy-key move, storage probe, the `trip-custom/1` skeleton (`start`, `travellers`; reserved `from`, `gw` per the origin spec), detector keys | 3.25 | Opus | navigation 10 | ready | v0.3 |
| FAV-C | `favourites/1`, `resolveRefs` store method, route contract, detector keys | 4 | Opus | visitor 15 | ready after NAV-C | v0.3 |
| TRP-GL-C | Booking windows in print and CSV (closure MUST-6): dateless rules in the export contract | 3 (new) | Opus | closure 4 | ready | v0.4 |
| LST2b-C | City facet and counts in `core/src/query/**`, `core/src/schema/api/places.ts` (the contract part of LST2b, R-12 capped unchecked rows) | 3 (inside LST2b's 12) | Opus | LST2 brief b | ready | v0.6 |
| PHO-C | (new) `pickPhotos(ref)` in `core/src/media/**`: record photos, then lane picks, then none; overrides join in PHO-0 | 1 | Opus | overview 4; BACKLOG 15.158 | ready | v0.7 |
| R59-C | (new) Allowlisted stop-link shape on the timeline payload; day route builder with numbered overlapping parts, no silent truncation | 3 | Opus | TRIP-NAVIGATION-PLAN 1, 2 | ready | v0.8 |
| ORG-C | Origin rule, schemas, store methods, airport identity rule, codec keys `from`, `gw` | 4 | Opus | origin 13 | planned, spec merged | v0.8 (internal earlier) |
| FBK-C | Intake union and migration `intake` with every widening: `improve`, `for_trip`, `for_day`, `source_ref` (+1.5), `intake-detail/1` and scores (+2.5), trip `start` (+0.25) | 12.25 | Opus | feedback 10.3; requests 11.4; intake fields 12 | ready | v0.10 |
| REQ-RF-C | `regions(cc)`, the `towns` fallback, `gn:` ids | 2 | Opus | intake fields 12 | ready | v0.11 |
| OVR-Ca | `trip-windows/1` validator, `tripItems`, `tripItemCounts` | 4 | Opus | OVR brief | ready | v0.12 |
| STY-Ca | `trip-base-plans/1`, `tripBasePlans`, `tripBasePlanDays`, `tripLegs` strategy | 5 | Opus | stays 15 | blocked: OVR-Ca (same `trip.ts`) | v0.13 |
| STY-E | Evaluator and messages | 6 | Opus | stays 15 | blocked: STY-Ca | v0.13 |
| TD-1 | `items.ref`, sub-regions, cover format in the core trip schema | 6 | Opus | SKILLS-AND-DATA-ONLY 5 | blocked: Q267 | v0.14 |
| CUS-C | Migration `custom-draft`, full `trip-custom/1` (+2 widening, +0.25 origin), account route contract, `removeItem`, and the invite-only allow check (Q229b, +2 new) | 10.25 | Opus | OVR brief CUS; requests 11.4 | blocked: v0.11 owner preview, `planner_draft_signal` ruling, Q98 | v0.15 |
| NAV-D | Migration `draft-cap` | 2 | Opus | navigation 10 | blocked: CUS-C | v0.16 |
| FAV-D | Migration `account_favourite` | 4 | Opus | visitor 15 | blocked: CUS-C | v0.16 |
| STY-2C | `trip-custom/1` `stays` operations | 2 | Opus | stays 15 | blocked: CUS-C | v0.17 |
| REQ-E-C | Scheduler `moveItem`, `insertDay`, `dropDay` | 3 | Opus | requests 11 | blocked: CUS-1 | v0.17 |
| R59-3C | (new) Base-change recompute as an operation with inverse (signed in) | 3 | Opus | TRIP-NAVIGATION-PLAN 3 | blocked: CUS-1 | v0.17 |
| REQ-G-C | Geocode contract | 2 | Opus | requests 11 | blocked: REQ-G0 | v0.18 |
| MCP-C | Remote contracts, levels vocabulary, annotations | 5 | Opus | MCP 14.9 | ready (core only) | v0.19 |
| MCP-G | Migration `mcp_access`, the level check | 6 | Opus | MCP 14.9 | blocked: MCP-C | v0.20 |
| RIS-M | Migration `research_meta` | 6 | Opus | catalogue-intake 6 | ready on the child; production Q177 | v1.0 |

### 3.6 Web UI (lane W, run by B1; every row moves a budget and ends with design review then verifier)

| Id | Task | h | Model | Owns (main paths) | Spec | Status | Release |
|---|---|---|---|---|---|---|---|
| ACCT-PH-RV | (new) Design review and verify of the merged ACCT-PH; record trip start JS and place HTML in both builds (NAV-1's baseline) | 3 | Opus reviewer, Sonnet verifier | review and verify notes | RELEASE-PLAN v0.2 | ready | v0.2 |
| ACCT-PH-F | Fixes the review asks for, if any | 0 to 2 | Sonnet | `web/components/shell/Account*.tsx`, `BottomBar.tsx` | | blocked: ACCT-PH-RV | v0.2 |
| GSI-P | `/privacy/` page and footer link, beacon named | 2 | Sonnet (words by the planner, owner approves) | `web/app/privacy/page.tsx` (new), `web/components/shell/SiteFooter.tsx` (one link), `web/lib/sitemap.ts` (one entry), tests | Google 13 | ready | v0.2 |
| OVR-0 | `CategoryView` into a dynamic chunk | 3 | Sonnet | `web/components/trips/CategoryView.tsx`, `TripPlan.tsx` (lazy import only) | OVR brief | ready | v0.3 |
| NAV-F | Foundation text | 1.5 | Opus reviewer | `docs/v2/design/foundation/components.md`, `patterns.md` | navigation 10 | ready | v0.3 |
| NAV-1 | Mine in the bar, phone header icon, `/mine/` shell | 5.5 | Sonnet | `web/components/shell/BottomBar.tsx`, `SiteHeader.tsx`, `MineLink.tsx`, `web/app/app.css`, `web/app/mine/**`, `web/lib/mine/storage.ts` | navigation 10 | blocked: NAV-C, ACCT-PH-RV | v0.3 |
| NAV-2 | My trips on the device; copy sheet footer and done step | 6 | Sonnet | `web/lib/mine/copies.ts`, `web/components/mine/**`, `web/lib/export/draft.ts`, `web/components/actions/CopySheet.tsx` | navigation 10 | blocked: NAV-1 | v0.3 |
| NAV-R1, NAV-V1 | Review and verify | 4 | Opus, Sonnet | notes | navigation 10 | blocked: NAV-2 | v0.3 |
| FAV-1 | Favourites panel in Mine; hearts on place and trip pages | 12 | Sonnet | `web/lib/favourites/**`, `web/components/mine/Favourites*.tsx`, `web/app/api/v1/resolve/route.ts`, mount lines | visitor 15 | blocked: FAV-C, NAV-R1, OVR-0 | v0.3 |
| FAV-R, FAV-V | Review and verify | 4 | Opus, Sonnet | notes | visitor 15 | blocked: FAV-1 | v0.3 |
| TRP-GL | (new) Closure deferrals N1 (phone key at most half the map), N2 (travel-day rows in print), N3 (Dolomites day 14 units), N4 (44 px targets), SHOULD-2 (dark basemap evidence on a credentialed build), MUST-6 UI | 5 + 4 review | Sonnet; Opus, Sonnet | `web/components/trips/**` (map key, print), `web/components/actions/**` (print, CSV), `web/styles/timeline.css` | closure 4 | blocked: TRP-GL-C, FAV-1 | v0.4 |
| LST2b | Where at city level, Trips by province (with LST2b-C) | 9 | Sonnet | `web/components/entity/WhereMenu.tsx`, descriptors, `web/components/places/rows.ts` (one key), tests | LST2 brief b | ready after v0.4 | v0.6 |
| LST2c | Near mode, NearChip, towns strip, distance sort | 9 | Sonnet | `web/components/entity/NearChip.tsx`, `web/components/places/PlacesMap.tsx`, `core/src/catalogue/json/near.ts`, near routes | EXECUTION-PLAN E10 | blocked: LST2b | v0.6 |
| MX | ORS nearby and hub matrices | 5 | Sonnet (B2) | `web/scripts/nearby-ors.mjs`, `data/outings/**` | E13 | blocked: LST2c | v0.6 |
| LST2-RV | Review and verify LST2b, LST2c | 6 | Opus, Sonnet | notes | LST2 | blocked: LST2c | v0.6 |
| PHO-R | (new, BACKLOG 15.158) Render record photos: adapter read, renditions, credits snapshot, first photo as card thumbnail (lazy), photo and credit on place and trail pages | 8 + 4 review | Sonnet; Opus, Sonnet | `web/lib/public/places.ts`, `web/lib/public/photos.ts`, the place photo figure in `web/components/places/**`, card thumbnail slots | BACKLOG 15.158 | blocked: PHO-C, IMG-1, Q263 | v0.7 |
| R59-N | Design note: stop actions, day route, parts | 2 | Opus reviewer | `docs/v2/design/trip-page/navigation-note.md` | TRIP-NAVIGATION-PLAN | ready | v0.8 |
| R59-1 | Stop actions beside each stop, day route at each day header, numbered parts | 10 + 4 review | Sonnet; Opus, Sonnet | `web/components/trips/**` (timeline entries, day header, `directions.ts`), `web/lib/public/timeline.ts` (links) | TRIP-NAVIGATION-PLAN 1, 2 | blocked: R59-C, R59-N, TRP-GL | v0.8 |
| ORG-N, ORG-A, ORG-1, ORG-2, ORG-R, ORG-V (and ORG-D, ORG-M in B2) | Getting there | 16.5 (+4.5 B2) | Opus, Sonnet | origin spec 13 | origin spec | planned, spec merged; ORG-1 after R59-1 | v0.8 |
| FBK-N | Entry-point note | 2 | Opus | `docs/v2/build/public-site/FBK-entry-points.md` | feedback 10.3 | blocked: OVR-0 | v0.10 |
| FBK-2 | The sheet, entry points, `/feedback/`, `/account/submissions/` (place and trip fields moved to REQ-F) | 13 | Sonnet | `web/components/intake/**`, `web/app/feedback/**`, `web/app/confirm/**`, `web/app/account/submissions/**`, `web/components/shell/ReportLink.tsx`, mount lines, one `/privacy/` section | feedback 10.3 | blocked: FBK-1, FBK-N | v0.10 |
| FBK-R, FBK-V; REQ-1; REQ-R1, REQ-V1 | Review, verify; the improve UI; their review | 6 + 6 + 4 | Opus, Sonnet | `web/components/intake/improve/**` | requests 11 | blocked: FBK-2, NAV-1 | v0.10 |
| REQ-F2, REQ-F1, REQ-F3, REQ-R4, REQ-V4 | Place and trip request forms | 17.5 + 4 | Sonnet; Opus, Sonnet | `web/components/intake/**` branches (one lane at a time) | intake fields 12 | blocked: REQ-1, REQ-RF | v0.11 |
| OVR-N, OVR-1, OVR-2, OVR-3, OVR-R, OVR-V | When to go and the overview (OVR-3 now 3 h: `pickPhotos` is PHO-C's) | 3 + 6 + 14 + 3 + 6 | Opus, Sonnet | OVR brief | OVR brief | blocked: OVR-Cb, R59-1, ORG-2 | v0.12 |
| PHO-0 | Photo overrides | 3 | Sonnet (B2) | `tools/gallery/gallery_pick.py` modes, `core/src/media/overrides.ts` | OVR brief | blocked: PHO-C | v0.12 |
| STY-N, STY-1, STY-Q, STY-R, STY-V | Where to stay tab | 3 + 14 + 8 | Opus, Sonnet | `web/components/trips/stays/**`, codec `st`, `sw` | stays 15 | blocked: STY-Cb, OVR-2 | v0.13 |
| TD-2 | Trip pages from `data/trips/<id>/trip.json` | 11 | Sonnet | `web/lib/public/sources.ts`, trip loaders | SKILLS-AND-DATA-ONLY | blocked: TD-1 | v0.14 |
| CUS-1, CUS-2, CUS-R | Customise flow at `/t/<id>/` | 20 + 3 + 3 | Sonnet; Opus | `web/app/t/**`, `web/components/trips/custom/**` | OVR brief CUS | blocked: CUS-C | v0.15 |
| NAV-3, NAV-E, NAV-R2, NAV-V2; FAV-2, FAV-2E; ORG-H | Signed-in Mine and sync; account default start | 14 + 15 + 4 | Sonnet, Opus | navigation 10; visitor 15; origin 13 | | blocked: NAV-D, FAV-D, Google (Q124) | v0.16 |
| REQ-E UI, REQ-P, REQ-R2, REQ-V2; STY-2, STY-2V; R59-3 UI | More edits, own stops, base tweaks | 8 + 5 + 4 + 10 + 5 + 7 | Sonnet; Opus | `web/app/t/**` (never beside CUS-2) | requests 11; stays 15 | blocked: CUS-1, REQ-E-C, STY-2C, R59-3C | v0.17 |
| REQ-S, REQ-L, REQ-R3, REQ-V3 | Map search tier, link and upgrade | 8 + 3 + 4 | Sonnet; Opus | requests 11 | | blocked: REQ-G | v0.18 |
| MCP-U | Connected apps and access page | 10 | Sonnet | `web/app/account/connected-apps/**` | MCP 14.9 | blocked: MCP-O | v0.20 |
| GLB2b | City outlines, home globe look | 25 | Sonnet, Opus ruling | globe files | EXECUTION-PLAN E12 | blocked: R1 item 7 (mock approval), CONS-3 | later |

### 3.7 Auth and mail (lane A, B2)

| Id | Task | h | Model | Status | Release |
|---|---|---|---|---|---|
| EML-S | Security review of EML-Q, EML-1, EML-M and the Neon config, before O-E1 | 2 | Opus | ready | v0.5 |
| EML-V | Verifier sweep of the card and `/sign-in/reset/` | 2 | Sonnet | ready | v0.5 |
| EML-P | "Sign-in emails" section on `/privacy/` | 1 | Sonnet | blocked: GSI-P | v0.5 |
| EML-E | Real-service checks on production after O-E1 | 2 + owner 20 min | Sonnet | blocked: EML-S, O-E1 | v0.5 |
| O-E0 to O-E3, O-E1 | Owner: app name, Turnstile widget and keys, env, then Require Verification after the deploy | owner 1 h | owner | | v0.5 |
| O-0 | Owner: shared Google credentials removed from production (Q123); confirm | owner 5 min | owner | check | v0.9 |
| GSI-0, GSI-T, GSI-1, GSI-2, GSI-S, GSI-E, GSI-R, GSI-VF | Continue with Google; GSI-1 re-scoped onto `SignInCard.tsx` and `ChooserStep.tsx` | 24 | Opus, Sonnet | ready (GSI-0) | v0.9 |
| FBK-M, FBK-1, FBK-S, FBK-3, FBK-E | Intake mail, routes, security review, CLI, real-service e2e | 2 + 8 + 4 + 6 + 4 | Opus, Sonnet | blocked: FBK-C | v0.10 |
| REQ-RF, REQ-FB | Regions and world towns (generated parts); research-ready briefs | 4 + 4 | Sonnet | blocked: REQ-RF-C; FBK-3 | v0.11 |
| REQ-G0, REQ-G, REQ-A | Google Places go or no-go; geocode route; CLI for custom suggestions | 3 + 6 + 3 | Opus, Sonnet | blocked: v0.17 | v0.18 |
| EML Phase 2 (EML-M2, TT, T, TR, Q2, 2, N, B, S2, R2, V2, E2; EML-W if Q149), FBK-O, guest intake | Own domain and mail | 29 or 42.5 | Opus, Sonnet | blocked: Q148 trigger | v0.21 (on trigger) |
| EML-3, EML-C, APL-0 | Ways to sign in by email; change email; Apple re-plan | 3; later; 2 | Opus | later | later |

### 3.8 MCP (lane X, B2) and server cutover (lane S, B2)

| Id | Task | h | Model | Status | Release |
|---|---|---|---|---|---|
| MCP-1, MCP-S1, ORG-MCP | Public endpoint, the public half of the security review (Q225), origin tools | 6 + 1.5 + 1.5 | Sonnet, Opus | blocked: MCP-C | v0.19 |
| MCP-T, MCP-2, MCP-O, MCP-S, MCP-E; owner O-M2, O-M3, O-M6, O-M4 | Private MCP | 5 + 8 + 4 + 2.5 + 3 | Opus, Sonnet | blocked: MCP-G | v0.20 |
| MCP-3, MCP-P, REQ-M | Research proposals, approvals, intake tools | 8 + 8 + 6 | Opus, Sonnet | later | later |
| R-14 | API/HYG loose ends: map each R-14 claim to a case on three runners; add only missing cases | 3 | Sonnet | ready | v0.6 |
| ACC-1 | Accent folding in A16 (15.44), if the owner says yes | 3 | Opus | blocked: 15.44 | v0.6 |
| CONS-3 | Slug-table step deferred to TD-2; palette fallbacks, one UA and endpoints module, `siteOrigin()` | 8 | Sonnet | ready at a quiet point | v0.6 (internal) |
| R-9 | Export parity browser against API, read-once legs | 2 | Sonnet | open | v1.0 |
| RIS-L, RIS-T, SRV-0 (with R-10, R-11, GB-A-11) | Loader remainder, load tests, `PostgresStore` per method | 7 + 6 + 24 | Sonnet, Opus review | blocked: RIS-M, RIS-J | v1.0 to v1.2 |
| GB-A-4 (15.20) | Unknown globe levels render on request and cache | 2 | Sonnet | open | v0.6 |
| TD-3, TD-4, TD-6, 7.11 and CLN-6 | Galleries to data; import the 14 old trips; orientation block; legacy removal | 5; 24; 8; 6 | Sonnet, Opus | TD-3 with v0.14; the rest later | v0.14; later |
| Not on the train | short trips (2.17, 3.11 to 3.14), smart search phase 2 (3.15), the planner F01 to F17, NAV-M, PHO-1, INT-5, ORG-P | | | later | later |

## 4. Conflict map

### 4.1 Hot spots and their rule

| Hot spot | Kind | Tasks that write it | Rule |
|---|---|---|---|
| `web/components/trips/**` | folder | OVR-0, FAV-1 (mount), TRP-GL, R59-1, ORG-1, OVR-1, OVR-2, OVR-3, STY-1, FBK-2 (mount), CUS-1 (`custom/**`), R59-3 UI | one task at a time, in that order |
| `web/components/actions/CopySheet.tsx` and `actions/**` | file | NAV-2, TRP-GL (print, CSV), ORG-2, OVR-1 (week) | never in parallel; order NAV-2, TRP-GL, ORG-2, OVR-1 |
| `web/components/shell/**` | folder | ACCT-PH-F, GSI-P (`SiteFooter.tsx`), NAV-1 (`BottomBar.tsx`, `SiteHeader.tsx`, `MineLink.tsx`), FBK-2 (`ReportLink.tsx`) | file-disjoint, so parallel builds are allowed; merges one at a time (shell chrome budget) |
| `web/components/mine/**`, `web/lib/mine/**` | folder | NAV-1, NAV-2, FAV-1, ORG-2, NAV-3 | serial |
| `web/components/intake/**` | folder | FBK-2, REQ-1, REQ-F2, REQ-F1, REQ-F3 | serial (feedback 10.3, intake fields 12) |
| `web/app/t/**` | folder | CUS-1, CUS-2, REQ-E UI, REQ-P, STY-2, REQ-S, REQ-L | serial; REQ-E never beside CUS-2 |
| `web/components/auth/SignInCard.tsx` | file | GSI-1, MCP-O (one hook) | GSI-1 first |
| `web/app/account/page.tsx` | file | GSI-1, GSI-2, NAV-3, FAV-2 | serial in that order |
| `web/app/privacy/page.tsx` | file | GSI-P (creates), EML-P, FBK-2, ORG-A (log line) | GSI-P first; then one at a time |
| `web/scripts/neon-e2e.mjs` | file | EML-E, GSI-E, FBK-E, FAV-2E, NAV-E, CUS-2, STY-2V | one at a time |
| `web/lib/capabilities.ts` | file | NAV-1, FAV-1, FBK-2, ORG-1, FAV-2, REQ-F, CUS-1 | append only; rebase, never reorder |
| `web/lib/client/data.ts` | file | FAV-1, OVR-Cb, FBK-2, REQ-RF, ORG-A, STY-Cb | append a section per task; merges serial |
| `core/src/catalogue/store.ts`, `core/src/schema/api/**`, OpenAPI | contract | FAV-C, LST2b-C, R59-C, ORG-C, FBK-C (removes `report`), REQ-RF-C, OVR-Ca, STY-Ca | one contract author (B2); order in 4.3 |
| `core/src/privacy/detect.ts` | contract | NAV-C, FAV-C, ORG-C, FBK-C, CUS-C, MCP-G | one at a time, same order |
| `trip-custom/1` (`core/src/schema/trip-custom.ts`) | contract | NAV-C (creates the skeleton), CUS-C (full), STY-2C (stays), ORG (`from`, `gw` reserved in NAV-C) | NAV-C names the file `trip-custom.ts` (the OVR brief's `custom.ts` is superseded); each widening lands before its migration is applied |
| `core/src/schedule/profileCodec.ts` | contract | ORG-C (`from`, `gw`), OVR-1 (`w`), STY-1 (`st`, `sw`) | serial; each adds keys only |
| `core/src/schedule/**` engine | contract | CUS-C (`removeItem`), REQ-E-C, R59-3C | serial, scheduler bundle test each time |
| `core/src/db/migrations/**`, `core/src/db/inventory.ts`, `core/src/db/tx.ts` | migration | BKP-1, FBK-C, CUS-C, NAV-D, FAV-D, MCP-G, MCP-T, RIS-M, ORG-H, EML Phase 2 | slug in the branch, number at merge (4.4) |
| `data/vocab/types.json` | generated contract (a TEST-STRATEGY `full` path) | AREA-2 (only if a type is missing), any data batch that meets a new kind | one writer, Opus review; the branch goes first in its stack |
| `core/src/schema/capture/properties.ts` | contract | STY-P, RIS-H | serial; `capture.ts build` after each |
| `core/bin/capture.ts` | file | RIS-S | alone |
| `core/bin/intake.ts` | file | FBK-3, REQ-FB, REQ-A | FBK-3 first |
| Towns layer (`tools/towns.py`, `data/reference/towns/**`) | generated data, privacy trust root | REQ-RF (regions, world towns), any data batch that adds points in a new admin-1 (`towns.py build` then `derive-near`) | one writer; REQ-RF not beside a data batch that rebuilds towns |
| `data/capture/points.json`, `data/capture/gap-budget.json`, `data/sources/registry.json` | data | every data batch, RIS-J | one data task at a time (the data seat); RIS-J first and alone |
| `tools/check-all.sh` | file | TS-2, LOCAL-3, OVR-Ca (windows stage), ORG-D, REQ-RF, EML-TT | append one step each; serial merges |
| `tools/tree_contract.json`, `tools/tree_check.py` | file | IMG-1, ORG-D, LOCAL-4 | serial |
| `web/tests/data/place-html-baseline.json`, `place-size.test.ts`, `budget.test.ts` | budget (a `full` path) | BUD-1, PHO-R (Q263 re-baseline) | only those two, each with the owner's ruling |
| Commons, Openverse | service | D5c, L3, IMG-1 (cold-cache renditions) | one runner on the machine |
| ORS | service | MX, ORG-M, STY-L | one runner |
| Overpass, Wikidata | service | AREA-2, ORPH-7, D3, D8-R | one runner each |

### 4.2 Pairwise matrix of the UI hot spots

**F** never build in parallel (same files); **C** the column task needs the row task merged (contract or order);
**B** may be built in parallel but merges one after the other and re-measures (same budget); **.** free.

| | OVR-0 | NAV-1 | NAV-2 | FAV-1 | GSI-P | TRP-GL | LST2b | PHO-R | R59-1 | ORG-1 | ORG-2 | OVR-1 | OVR-2 | STY-1 | FBK-2 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **OVR-0** | | B | B | F C | . | F | . | B | F | F | B | F | F C | F | F C |
| **NAV-1** | | | C | C | B | B | . | B | B | B | C | B | B | B | B C |
| **NAV-2** | | | | F | . | F | . | . | B | B | F C | F | B | B | . |
| **FAV-1** | | | | | B | F | B | F | F | F | F | F | F | F | B |
| **GSI-P** | | | | | | . | . | B | . | . | . | . | . | . | F C |
| **TRP-GL** | | | | | | | . | . | F C | F | F | F | F | F | F |
| **LST2b** | | | | | | | | B | . | . | . | . | . | . | . |
| **PHO-R** | | | | | | | | | B | B | . | . | C | . | F |
| **R59-1** | | | | | | | | | | F C | B | F | F | F | F |
| **ORG-1** | | | | | | | | | | | C | F | F | F | F |
| **ORG-2** | | | | | | | | | | | | F | B | B | . |
| **OVR-1** | | | | | | | | | | | | | C | F | F |
| **OVR-2** | | | | | | | | | | | | | | F C | F |
| **STY-1** | | | | | | | | | | | | | | | F |

Readings: the trip-page tasks (OVR-0, TRP-GL, R59-1, ORG-1, OVR-1, OVR-2, STY-1) are one serial chain; the Mine tasks
are another; the two chains share both budgets, so a stack never holds one of each. LST2b and GSI-P are the only UI
tasks that can be built beside almost anything.

### 4.3 Contracts that must land first, and their one-author order

B2 is the only author of the shared contract files of 4.1 while a contract task runs. Order (each merges before the
task that needs it starts): **NAV-C, FAV-C** (v0.3) → **TRP-GL-C** (v0.4) → **LST2b-C** (v0.6) → **PHO-C** (v0.7) →
**R59-C, ORG-C** (v0.8) → **FBK-C** (v0.10; every widening inside it before its migration is applied) → **REQ-RF-C**
(v0.11) → **OVR-Ca** (v0.12) → **STY-Ca, STY-E** (v0.13) → **TD-1** (v0.14) → **CUS-C** (v0.15; the invite-only check inside it,
Q229b) → **NAV-D, FAV-D** (v0.16) → **STY-2C, REQ-E-C, R59-3C** (v0.17) → **REQ-G-C** (v0.18) → **MCP-C, MCP-G** (v0.19,
v0.20) → **RIS-M** (v1.0). The navigation contract (NAV-C) is the one the request named "NAV-C"; the custom contract
(CUS-C) is the one Mine sync, REQ-E and STY-2 wait for; the feedback contract (FBK-C) is the one REQ-1, REQ-F and REQ-A
wait for.

### 4.4 Migrations (slugs in branches, numbers at merge)

| Provisional number | Slug | Task | Release |
|---|---|---|---|
| 0012 | `backup_reader` (read-only role for BKP-1) | BKP-1 | v0.5 |
| 0013 | `intake` | FBK-C | v0.10 |
| 0014 | `custom_draft` | CUS-C | v0.15 |
| 0015, 0016 | `draft_cap`, `account_favourite` | NAV-D, FAV-D | v0.16 |
| (with v0.16) | `account_start` | ORG-H (if Q246) | v0.16 |
| 0017, 0018 | `mcp_access`, MCP-T token tables | MCP-G, MCP-T | v0.20 |
| 0019 | `research_meta` | RIS-M | v1.0 |
| on trigger | `account_mail_state`, `mail_suppression` (+ `hook_event` if Q149) | EML Phase 2 | v0.21 |

No two branches share a number because none holds one: the coordinator assigns it at merge (MIG-N). Two migrations in
one release (v0.16, v0.20) are applied in the order of the table, on the child first.

### 4.5 Shared budgets

| Budget | Room today | Consumers, in merge order (cap each) | Rule |
|---|---|---|---|
| Trip start JS (200 KB gzip) | 0.6 KB (199.4 KB) | OVR-0 (frees; measured), NAV-1 (+0 B against the ACCT-PH baseline), NAV-2 (+0), FAV-1 (+0.15 KB), TRP-GL (+0), R59-1 (target +0.2 KB; stop actions server-rendered), ORG-1 (+0.2 KB), FBK-2 (+0.1 KB), OVR-1 to OVR-3 and STY-1 (net 0, dynamic chunks) | OVR-0 merges before any other trip-page consumer; every task quotes `budget:report` before and after in both builds, flag on and off |
| Place HTML (+25% median) | public build median 1.2491 of 1.25 (option A); 19 B in the sign-in-on build | GSI-P (footer link), the beacon tag, NAV-1 (frees about 1 KB a page with CSS masks), FAV-1 (heart), PHO-R (photo figure, about 400 B), data batches (D3, ORPH-7, AREA-2, RIS-J, any new record on a place page) | BUD-1 first (Q260) so shell chrome leaves the ratio; NAV-1 before PHO-R; PHO-R's re-baseline by Q263 only; a data batch that moves the median merges alone in its stack |
| Shell chrome (new with BUD-1) | today + 1 KB | GSI-P, NAV-1, FBK-2 (`ReportLink`), beacon | one shell change per stack |
| Sheet chunk 18 KB (+2 KB REQ-1); request chunks 9, 7, 5 KB; Mine 30 KB; stays 10 KB; panel chunks | each new | their own tasks | measured in the hand-back |

### 4.6 Owner actions that gate a task

| Owner action | Gates | Release |
|---|---|---|
| `HOME_POINT_LAT`, `HOME_POINT_LON` in Vercel Production and Preview (without them the build fails closed) | every deploy from v0.2 | v0.2 |
| O-HP: the home point for worktrees (Q261) | every builder's check-all | J0 |
| Q88 ruling; Q260 | BUD-1, the v0.2 deploy | v0.2 |
| Q-D key restriction; the Vercel Firewall rate-limit rule on `/api/v1/*` (15.22, shared later with `/mcp`); beacon token (Production only); privacy words | v0.2 smoke | v0.2 |
| Q101 to Q108 (favourites) | FAV-C, FAV-1 | v0.3 |
| O-E0 to O-E3, O-E1 after the deploy, Q185 | v0.5 | v0.5 |
| Q263 photo figure | PHO-R | v0.7 |
| Q240 to Q249 (origin, planned, spec merged) | ORG-1 | v0.8 |
| O-0, O-1 to O-5 (Google) | GSI-E | v0.9 |
| Q130 to Q137; Turnstile (from v0.5) | FBK-1 | v0.10 |
| Q93 to Q100; the phase 1 owner preview | OVR, CUS | v0.12 |
| Q109 to Q116, DD-6 | STY-1 | v0.13 |
| Q267 | TD-1 | v0.14 |
| Q98, Q67, Q103, Q120, `planner_draft_signal` | CUS-C | v0.15 |
| Google Cloud Places setup | REQ-G | v0.18 |
| Q160 to Q167, Q190 to Q198, O-M2 to O-M6 | MCP | v0.19, v0.20 |
| Q270 to Q279, O-AU1 (analytics export), FA-D, UA-D | the audits, CUS-C (FA-D), MCP-C (AU-D, narrowed to the MCP field list), v0.22 (G-UI, UA-D) | v0.14.1, v0.22 |
| Q148, Q149 | Email Phase 2 | v0.21 |
| Q177, Q183, snapshots | v1.x | v1.0 to v1.2 |
| the publish of the public repository (scrub 6), Q182, Q266 | LOCAL-4, E2E-YML | I-track |

## 5. Lanes, sequence points and the release train

### 5.1 Lanes

| Lane | Seat | Owns (folders) | Order inside the lane |
|---|---|---|---|
| W, public web UI | B1 (Sonnet) | `web/components/{trips,shell,mine,places,intake,entity}/**`, `web/app/{mine,privacy,feedback,t}/**` | GSI-P, OVR-0, NAV-1, NAV-2, FAV-1, TRP-GL, LST2b, LST2c, PHO-R, R59-1, ORG-1, ORG-2, FBK-2, REQ-1, REQ-F2, REQ-F1, REQ-F3, OVR-1, OVR-2, OVR-3, STY-1, TD-2, CUS-1, NAV-3, FAV-2, REQ-E UI, REQ-P, STY-2, R59-3 UI, REQ-S, REQ-L, MCP-U |
| C, contracts and core | B2 (Opus) | the contract files of 4.1, `core/src/**` new modules | the order of 4.3 |
| P, platform and test | B2 between contracts (Sonnet or Opus) | `tools/gate/**`, `tools/db/**`, `tools/nightly/**`, `web/vitest.config.ts`, `web/scripts/{images,og,budget-report}.mjs`, `.github/**` | BUD-1, TS-1, TS-2a, TS-2, TS-4, IMG-1, BKP-1, TS-6, TS-3, TS-5, LOCAL-3, TS-7, RIS-S, then LOCAL-4 and E2E-YML after the publish |
| A, auth and mail | B2 | `web/components/auth/**`, `web/lib/auth/**`, `web/app/{sign-in,sign-up,account}/**`, `core/src/mail/**` | EML-S, EML-P, EML-E, GSI-0 to GSI-VF, FBK-M, FBK-1, FBK-3, FBK-E, REQ-RF, REQ-FB, REQ-G0, REQ-G, REQ-A |
| D, data | data seat (Opus researcher; Sonnet builder for RIS-J) | `data/**` through the tools, `research/**` | RIS-J (alone), TRP-GL-D, D1B-Q, ORPH-7, AREA-2, L4, D3, D5c, ORG-G, RIS-A, D8-R, D8, D7, D9, DP |
| X, MCP | B2 | `web/app/mcp/**`, `core/src/mcp/**`, `web/app/oauth/**` | MCP-C, MCP-1, MCP-S1, ORG-MCP, MCP-G, MCP-T, MCP-2, MCP-O, (MCP-U in B1), MCP-S, MCP-E |
| S, server | B2 | `core/src/catalogue/postgres/**`, loader | RIS-M, RIS-L, RIS-T, LOCAL-5, SRV-0, seams |
| H, docs | coordinator, Haiku, planner | `docs/**`, `HANDOVER.md` | H0, H2, H1, then J1: H3, H4, H8, D610, H5, H9 |
| V, verify and review | verifier (Sonnet), design reviewer (Opus) | notes only | each UI task, in merge order |

**Concurrency.** Two builders (B1, B2), one verifier and one data seat; reviewers and docs lanes on top. Heavy work
stays inside TEST-STRATEGY's slots: two builds and one Playwright run at a time, the full e2e alone. Until TS-4 enforces
the slots, the coordinator does: the data seat's hand-back runs its data checks and core tests and leaves `web.build`
to the stack (T2); the verifier runs e2e only while at most one builder is building; no design review while an e2e
runs (HANDOVER section 3).

### 5.2 Sequence points (where lanes join)

| Join | What lands | Gate |
|---|---|---|
| J0 | H2, H0 (TEST-STRATEGY, ORIGIN-PLAN cherry-picked, MASTER-ORDER; stacked on `public/DOCS-STACK`), H1; owner O-HP and the v0.2 owner actions | `links` and `tree_check` on the merged tip (docs only) |
| J1 | H3 and H4 (one docs branch, opened only when no other docs branch is open), H8, D610, then H5, H9 | links, tree_check |
| Each release vX.Y | its rows in 5.3, merged through stacks of at most four branches (TEST-STRATEGY 9.1: disjoint files except planning docs, at most one `full` path branch and it goes first, never two branches that move the same budget) | T2 per stack; T3 on the release commit (RELEASE-PLAN 4.1); then the RELEASE-PLAN 6 checklist |
| Infra (I) | TS, LOCAL, RIS-S rows | ride the next release as "Internal" |

Until TS-2 ships (Q250), T1 is today's lane check (typecheck, the affected vitest suites, the lane's own e2e specs,
screenshots), T2 is the coordinator's check-all plus the mapped e2e after each merge, and T3 is RELEASE-PLAN 4.1.

### 5.3 The release train (renumbered; old RELEASE-PLAN numbers in brackets)

| New | Goal | Tasks (hours) | Hours | Migrations | Why here |
|---|---|---|---|---|---|
| v0.1 | shipped | tag on `47be5b58` (H1) | 0 | 0001 to 0011 | |
| **v0.2** [v0.2 + v0.4] | Sign-in on phones, a privacy page, page-view counts, basics for the 74 stored places | ACCT-PH-RV 3, ACCT-PH-F 0 to 2, BUD-1 3, GSI-P 2; D2b and BUDGET-FIX already merged | 8 to 10 | none | D2b is on `main` and data has no flag (correction C1) |
| **v0.3** [v0.3] | Mine: copies and favourites on this device | OVR-0 3, NAV-F 1.5, NAV-C 3.25, NAV-1 5.5, NAV-2 6, NAV-R1/V1 4, FAV-C 4, FAV-1 12, FAV-R/V 4; RIS-J 6 (data) | 49.25 | none | unchanged; OVR-0 goes first (budget) |
| **v0.4** [new] | Trip page go-live fixes and share images | TRP-GL-C 3, TRP-GL 5, TRP-GL review 4, TRP-GL-D 2, IMG-1 7 | 21 | none | production is live with closure deferrals open (C2); IMG-1 blocks photos, CI and share previews (C3) |
| **v0.5** [v0.5] | Sign in by emailed code; backups | EML-S 2, EML-V 2, EML-P 1, EML-E 2, BKP-1 6.5 | 13.5 | `backup_reader` | BKP-1 has no LOCAL-4 dependency and needs a migration (C4) |
| **v0.6** [new] | Places near a town: Where at city level, near mode, routed times; the closure queue finished | LST2b 12 (incl. LST2b-C), LST2c 9, MX 5, LST2-RV 6, R-14 3, CONS-3 8, GB-A-4 2, ACC-1 3 (if 15.44 yes), ORPH-7 3, AREA-2 6, L4 2 (data) | 59 | none | the owner's 23 Oct closure queue, dropped by RELEASE-PLAN, comes before R-59 (C5) |
| **v0.7** [v0.8] | Photos on trail and stop pages, from our host | PHO-C 1, PHO-R 8, PHO-R review 4; D3 10, D5c 4 (data) | 27 | none | needs IMG-1 only; `pickPhotos` moves from OVR-3 (C6) |
| **v0.8** [v0.9] | Links and directions beside every stop; getting there | R59-C 3, R59-N 2, R59-1 10, R59 review 4; ORG phase 1 28 (ORG-C, ORG-D, ORG-G, ORG-M ride earlier as internal) | 47 | none | R-59 sized here (C7); ORG after R-59 as the origin spec says |
| **v0.9** [v0.6] | Continue with Google | GSI-0 3, GSI-T 1, GSI-1 8, GSI-2 4, GSI-S 2, GSI-E 3, GSI-R/VF 3 | 24 | none | built in B2 beside v0.6 to v0.8; ships when ready, after v0.5 (email spec 12) |
| **v0.10** [v0.7] | Report a problem, suggest an improvement (signed in) | FBK-C 12.25, FBK-N 2, FBK-M 2, FBK-1 8, FBK-S 4, FBK-2 13, FBK-R/V 6, FBK-3 6, FBK-E 4, REQ-1 6, REQ-R1/V1 4 | 67.25 | `intake` | FBK-2 is 3 h smaller (Q238); widenings counted in FBK-C |
| **v0.11** [new] | Ask for a trip and suggest a place with research-ready detail | REQ-RF-C 2, REQ-RF 4, REQ-F2 7, REQ-F1 8.5, REQ-F3 2, REQ-FB 4, REQ-R4/V4 4 | 31.5 | none | a few days after v0.10 (Q238); missing from RELEASE-PLAN (C8) |
| **v0.12** [v0.10] | Best time to go and the trip overview | OVR-N 3, OVR-Ca 4, OVR-Cb 6, OVR-1 6, OVR-2 14, OVR-3 3, OVR-R/V 6, PHO-0 3; D8-R 8, D8 8, D7 16 (data) | 77 | none | unchanged content |
| **v0.13** [new] | Where to stay on every trip | STY-P 2, STY-Ca 5, STY-E 6, STY-L 3, STY-Cb 5, STY-N 3, STY-1 14, STY-Q/R/V 8; D9 8.5 (data); RIS-A 8 (data) | 62.5 | none | owner: "do not miss it"; public, read-only; RELEASE-PLAN had no slot (C9) |
| **v0.14** [new] | Trips written as data get pages | TD-1 6, TD-2 11, TD-3 5 | 22 | none | Q80's "after R2" premise is gone; before CUS so `source_trip` is a data trip id (Q267, C10) |
| **v0.14.1** [new, audits] | Field slimming: fields nobody fills or reads leave the pages and the contract | AU-G 0.5, FA-2 6, FA-3 2, FA-D owner, FA-4 6, FA-5 3, FA-6 9, FA-7 1 ([AUDITS-AFTER-RELEASE.md](AUDITS-AFTER-RELEASE.md) 6) | 27.5 | none | the gate after v0.14 (Q270); before CUS-C copies the field set (Q271, 26 Oct: the only patch release) |
| **v0.15** [v0.11] | Customise a trip (signed in) | CUS-C 10.25, CUS-1 20, CUS-2 3, CUS-R 3 | 36.25 | `custom_draft` | unchanged |
| **v0.16** [v0.12] | Copies and favourites follow you into your account | NAV-D 2, NAV-3 6, NAV-E 2, NAV-R2/V2 4, FAV-D 4, FAV-2 12, FAV-2E 3, ORG-H 4 | 37 | `draft_cap`, `account_favourite`, `account_start` | unchanged |
| **v0.17** [v0.13] | More edits, your own stops, base tweaks | REQ-E-C 3, REQ-E UI 8, REQ-P 5, REQ-R2/V2 4, STY-2C 2, STY-2 10, STY-2V 5, R59-3C 3, R59-3 UI 7 | 47 | none | STY-2 and R-59 part 3 had no slot (C9) |
| **v0.18** [v0.14] | Search the map for a stop we do not have | REQ-G0 3, REQ-G-C 2, REQ-G 6, REQ-S 8, REQ-L 3, REQ-A 3, REQ-R3/V3 4 | 29 | none | unchanged |
| (before v0.19) | Delta audit narrowed to the MCP field list (the field tool on the v0.18 commit) | AU-D 3 | 3 | none | MCP-C publishes only kept fields (Q277) |
| **v0.19** [v0.15] | Public MCP | MCP-C 5, MCP-1 6, MCP-S1 1.5, ORG-MCP 1.5 | 14 | none | unchanged |
| **v0.20** [v0.16] | Private MCP | MCP-G 6, MCP-T 5, MCP-2 8, MCP-O 4, MCP-U 10, MCP-S 2.5, MCP-E 3 | 38.5 | `mcp_access`, token tables | unchanged |
| **v0.21** [v0.17] | Own domain and Email Phase 2 (on the Q148 trigger only; its number is taken when it ships) | as RELEASE-PLAN | 29 or 42.5 | mail tables | unchanged |
| **v0.22** [new, audits; 26 Oct] | UI and UX audit and fixes, run once on the whole product just before the Postgres cutover | UA-0 5, AU-GU 0.5, UA-1 4, UA-P 3, UA-W 4.5, UA-A 0.5, UA-2 8, UA-3 6, UA-T 3, UA-D owner, UA-FX 24 (placeholder), UA-FX-R 10, UA-AF 2 | 70.5 | none | owner decision 26 Oct: the audit waits until everything is built; gate G-UI after v0.20 (and v0.21 if shipped); reads [UI-NOTES.md](UI-NOTES.md); v1.0 waits for its fixes |
| **v1.0 to v1.2** | Postgres cutover, one seam per release | RIS-M 6, RIS-L 7, RIS-T 6, LOCAL-5 2, SRV-0 24, R-9 2 | 47 (RIS-J, RIS-H, RIS-S, LOCAL-3 ride earlier) | `research_meta`, loader tables | unchanged |
| I (Internal, any release) | Test strategy and CI | TS-1 to TS-8 35, LOCAL-3 3, LOCAL-4 5, E2E-YML 3, RIS-S 3, RIS-H 3 | 52 | none | ride the next release |

**Audits (25 Oct, amended 26 Oct, [AUDITS-AFTER-RELEASE.md](AUDITS-AFTER-RELEASE.md), Q270 to Q279; Q271 answered by the 26 Oct decision).** v0.14.1 (field slimming) is the only patch release, between v0.14 and v0.15. The UI and UX audit is the new release v0.22 between v0.21 and v1.0; it moved from v0.14.2 on the owner's decision of 26 Oct 2026 (the audit waits until everything is built). No other release or task is renumbered. CUS-C waits for FA-D (the owner's field approval); CUS-1 no longer waits for any UI audit (the 25 Oct note that it waits for UA-D is removed). The field tool (FA-1, B2 around v0.11 to v0.12) rides earlier as internal; the sweep harness UA-0 moved from v0.14 to just before v0.22. UI issues found during the build are appended to [UI-NOTES.md](UI-NOTES.md) so the audit starts from known items, and REC-2 keeps a screenshot set for every release because the audit compares them.

Two seats in parallel means the train is not strictly serial: B2 builds v0.5 and v0.9 beside B1's v0.4 to v0.8, and
the version number follows the deploy order (Q224). The order above is the recommended deploy order (Q262).

### 5.4 Critical path (week-less, ordered, with sizes)

B1 carries the critical path; B2 keeps the next contract merged before B1 needs it. Hours are agent hours, reviews
included where they block the next B1 task.

| # | B1 (critical path) | h | B2 at the same time | h | Data seat | h |
|---|---|---|---|---|---|---|
| 1 | GSI-P | 2 | BUD-1 (after Q260), then NAV-C | 6.25 | RIS-J | 6 |
| 2 | OVR-0 | 3 | TS-1, FAV-C | 9 | TRP-GL-D, D1B-Q | 2.5 |
| 3 | NAV-1 (after ACCT-PH-RV) | 5.5 | TS-2a, TS-2 | 11 | ORPH-7 | 3 |
| 4 | NAV-2, NAV-R1/V1 | 10 | TRP-GL-C, IMG-1 | 10 | AREA-2 | 6 |
| 5 | FAV-1, FAV-R/V | 16 | TS-4, BKP-1, EML-S, EML-P | 13.5 | L4, D610 | 3 |
| 6 | TRP-GL and review | 9 | EML-E, TS-6, TS-3, LOCAL-3, ORG-C, ORG-D | 18 | ORG-G | 3 |
| 7 | LST2b | 12 | R-14, CONS-3 (quiet point), PHO-C, R59-C | 15 | D3 | 10 |
| 8 | LST2c, LST2-RV | 15 | MX, GB-A-4, ACC-1, ORG-M, ORG-A | 13.5 | D5c (Commons runner) | 4 |
| 9 | PHO-R and review | 12 | GSI-0, GSI-T, GSI-1 | 12 | D8-R | 8 |
| 10 | R59-N, R59-1 and review | 16 | GSI-2, GSI-S, GSI-E, TS-5, TS-7, RIS-S | 19 | D8 | 8 |
| 11 | ORG-N, ORG-1, ORG-2, ORG-R/V | 16.5 | FBK-C | 12.25 | RIS-A (after STY-P) | 8 |
| 12 | FBK-N, FBK-2 and review | 21 | FBK-M, FBK-1, FBK-S | 14 | | |
| 13 | REQ-1 and review | 10 | FBK-3, FBK-E, REQ-RF-C, REQ-RF | 16 | | |
| 14 | REQ-F2, REQ-F1, REQ-F3, review | 21.5 | REQ-FB, OVR-Ca, OVR-Cb, STY-P | 16 | D7 (after OVR-Ca) | 16 |
| 15 | OVR-N, OVR-1, OVR-2, OVR-3, review | 32 | PHO-0, STY-Ca, STY-E, STY-L, STY-Cb | 22 | D9 (after STY-E) | 8.5 |
| 16 | STY-N, STY-1, review | 25 | TD-1, TD-3 | 11 | | |
| 17 | TD-2 | 11 | CUS-C | 10.25 | DP (optional) | 4 |
| 18 | CUS-1, CUS-R (CUS-2 by the verifier) | 26 | NAV-D, FAV-D, ORG-H core, MCP-C | 12 | | |
| 19 | NAV-3, FAV-2, NAV-E, FAV-2E, reviews | 27 | REQ-E-C, STY-2C, R59-3C, MCP-1, MCP-S1, ORG-MCP | 17 | | |
| 20 | REQ-E UI, REQ-P, STY-2, R59-3 UI, reviews | 39 | REQ-G0, REQ-G-C, REQ-G, REQ-A, MCP-G, MCP-T | 25 | | |
| 21 | REQ-S, REQ-L, review | 15 | MCP-2, MCP-O | 12 | | |
| 22 | MCP-U | 10 | MCP-S, MCP-E; then RIS-M, RIS-L, RIS-T, LOCAL-5, R-9, SRV-0 (built, not deployed before v0.22) | 52.5 | | |
| 23 | UA-0 (just before v0.22), then the UA-FX lanes after UA-D | 29 | UA-1, UA-P, UA-W, UA-A, UA-2, UA-3, UA-T by the verifier, reviewers and planner | 29.5 | | |

B1 total about 385 h including the review time it waits on; B2 about 350 h; data about 90 h. LOCAL-4 and E2E-YML go in
when the public repository exists; Email Phase 2 only on its trigger; GLB2b when the owner approves the globe mock.

### 5.5 Corrections made to RELEASE-PLAN (each also in RELEASE-PLAN section 0)

| # | Correction | Reason |
|---|---|---|
| C0 | `release/v0.1` on `47be5b58`, not d93127b | the history was rewritten; d93127b is not on `main` |
| C1 | v0.4 (D2b) folds into v0.2; v0.2 owner actions gain `HOME_POINT_*` in Vercel, the `/api/v1` rate-limit rule (15.22) and the Q88 ruling | D2b and option A are merged; data has no flag; the scrub made the home point mandatory; production is live with the catalogue unthrottled (P8) |
| C2 | New v0.4: the TRP2b2 "before go-live" deferrals | production went live with them open |
| C3 | IMG-1 sized (7 h) and moved from v0.8 to v0.4 | photos, share previews and CI's offline image mode all need it |
| C4 | BKP-1 drops its LOCAL-4 dependency and gains the migration `backup_reader` | Q228 made it a local job; its read-only role is a database change |
| C5 | New v0.6 for LST2b, LST2c, MX, R-14 and CONS-3 before R-59 | the owner's 23 Oct closure queue and 24 Oct sequencing; Q206 let only NAV phase 1 jump ahead |
| C6 | Photos move from after the report release to v0.7; `pickPhotos` belongs to PHO-C, not OVR-3; the photo figure needs Q263 | no dependency on the report or overview releases; place HTML has no room for it |
| C7 | R-59 sized: R59-N 2, R59-C 3, R59-1 10, review 4 (19 h); its part 3 (base changes, signed in) moves to v0.17 with STY-2 | the read-only part has no planner dependency; part 3 needs the signed-in copy |
| C8 | New v0.11 for the request forms (REQ-RF-C, REQ-RF, REQ-F1 to REQ-F3, REQ-FB, reviews), right after the report release | Q230 to Q239 were answered after RELEASE-PLAN was written; Q238 |
| C9 | New v0.13 (Where to stay, public) and STY-2 in v0.17 | RELEASE-PLAN listed stays as "not on this train"; the owner asked that they are not missed |
| C10 | New v0.14 for TD-1 to TD-3 before customise | R2 no longer exists, so Q80's "after R2" has no date (Q267); CUS-C's `source_trip` should name a data trip id |
| C11 | OVR-0 has no dependency on OVR-Cb; the CUS migration file name is a slug; the trip-custom file is `core/src/schema/trip-custom.ts` | brief text left over from before Q223 and MIG-N |
| C12 | FBK-C's intake migration does not wait for FAV-D's number | FAV-D ships in v0.16 |
| C13 | GSI-1 re-scoped onto `SignInCard.tsx`; GSI-1 before MCP-O on that file | EML-1 replaced `AuthForm.tsx` |
| C14 | The RELEASE-PLAN 2 seat table is replaced by 5.1 and 5.4 here | the lanes and their file sets |

## 6. What starts first

Start these after J0 (coordinator: H2 now, then H0 and H1). Items 1 to 5 use two builders, one verifier and the data
seat; the docs lane (item 6) runs beside them. Paste each brief as it stands.

**Common to every brief.** Worktree from the current `main` (public history only):
`git -C /Users/nks/workspace/travel worktree add /Users/nks/workspace/travel-wt/v2-<TASK> -b public/<TASK> main`, then
`pnpm install --frozen-lockfile` and `cp -R /Users/nks/workspace/travel/web/.og-cache web/`. The home point must reach
the shell (Q261, O-HP); never copy the root `.env.local` (it holds production values). Read P1 to P9 and T1 to T5 in
`docs/v2/design/foundation/principles.md` first and cite them by number. Stage only owned paths with
`git -C <worktree> add <paths>`, never `-A`; message `<area>(<TASK>): ...` ending with the Co-Authored-By trailer of the
model that did the work; do not push or merge. Never touch `legacy/**`, `HANDOVER.md`, `CLAUDE.md`, `docs/v2/PLAN.md`,
`EXECUTION-PLAN.md`, `web/app/themes.css`, the root `.env.local`, or another active lane's files; never put travel
material in the Obsidian notes vault; never print a secret or the home point. Record the model used in the hand-back.

**Gates by tier (until TS-2 ships).** T0 while editing: `pnpm --dir <pkg> exec tsc --noEmit` for the changed package and
the related vitest files. T1 before hand-back: both typechecks, the affected vitest suites, the lane's own e2e specs on
Chromium with `SKIP_WEB_BUILD=1` after one build, the budget tests in the public and the sign-in-on builds when page
output can change, `python3 tools/tree_check.py --check`, `python3 tools/relink.py check`; UI tasks add Playwright
screenshots at 1440x900 and 390x844 in light and dark (theme set through the site's control) saved outside
`web/test-results/`. T2 (coordinator, on the stack): check-all and the mapped e2e. T3 (release): RELEASE-PLAN 4.1.

### 6.1 BUD-1: budgets that measure what they protect (B2, Opus, 3 h; starts on Q260 yes)

- **Goal.** The place-size budget (S13) measures catalogue content, not shell chrome, so a footer link, a bar item or the
  beacon tag cannot fail it, while every byte a record or a section adds still counts (P8). Shell chrome gets its own
  cap. A report command prints the headroom of both budgets for hand-backs.
- **Owns.** `web/tests/data/place-size.test.ts`, `web/tests/data/place-html-baseline.json` (re-measured by the new rule
  only; the note line says so), `web/tests/budget.test.ts` (report hook only), `web/scripts/budget-report.mjs` (new),
  `web/package.json` (one `budget:report` script), `web/tests/data/shell-size.test.ts` (new).
- **Must not touch.** Any component, `web/app/layout.tsx`, `web/components/shell/**`, `data/**`, the 200 KB start-JS
  limit and the 1.25, 1.5 and 2.0 caps.
- **Steps.** 1. Measure today: median ratio and largest page in the public and sign-in-on builds; trip start JS.
  2. Define chrome as the bytes of the shell elements (header, footer, bottom bar, the beacon script) in a page's HTML
  and their share of the RSC payload; prove the method on three page types. 3. Rewrite S13 to compare `page − chrome`
  against the baseline's `page − chrome`, and re-measure the baseline file by that rule only. 4. Add the chrome cap
  (today's chrome bytes + 1 KB, both builds). 5. `budget:report` prints both budgets with headroom in bytes.
- **Acceptance.** T1: adding 70 bytes to `SiteFooter.tsx` in a scratch build changes the S13 median by under 0.0001 and
  moves the chrome measure by 70 ± 10; adding 70 bytes inside a place section moves S13 as before; the median in both
  builds is at or under 1.25 with recorded headroom; the beacon fixture build passes; `budget:report` output is under
  20 lines. Opus review of the method by a second Opus agent. T2: check-all.
- **Commit.** `test(BUD-1): place budget measures catalogue content; shell chrome capped on its own`.

### 6.2 ACCT-PH-RV: review and verify what is already merged (design reviewer Opus 1.5 h, verifier Sonnet 1.5 h)

- **Goal.** Close v0.2's open gate: the fifth bottom-bar item "Sign in" or "Account" (merged at `7ab0657`) reviewed
  against P1 to P7, T1, T2, components 1.4 and navigation spec N12, verified at 320, 390 and 1440 in light and dark, and
  the start-JS and place-HTML baselines NAV-1 must meet recorded in both builds.
- **Owns.** `docs/v2/design/shell/review-acct-ph-2026-10-25.md` (new), `docs/v2/build/public-site/verify-ACCT-PH.md`
  (new).
- **Must not touch.** Code. A must finding becomes the follow-up ACCT-PH-F (Sonnet), written into the review note with
  exact files.
- **Steps.** Reviewer: screenshots signed out and signed in (sign-in-on build), keyboard walk, target sizes, the label on
  `/account/` and `/sign-in/`, CLS. Verifier: independent sweep, first-use walk (P4: a phone visitor reaches sign-in in
  one tap), budgets in both builds with the numbers written into the verify note.
- **Acceptance.** Review approved or a must list; verify passes; both baselines recorded with their build commands.
- **Commit.** `docs(ACCT-PH-RV): review and verify of the phone sign-in item`.

### 6.3 GSI-P: the privacy page (B1, Sonnet, 2 h; words drafted by the planner, approved by the owner)

- **Goal.** `/privacy/` says what the site keeps and what it does not, names Cloudflare Web Analytics (cookieless, page
  views by path, production only), Neon for accounts, Turnstile when it is on, Resend for owner alerts only, Vercel's
  request logs, and that public pages hold no household data; a footer link on every page; listed in the sitemap.
- **Owns.** `web/app/privacy/page.tsx` (new), `web/components/shell/SiteFooter.tsx` (one link only),
  `web/lib/sitemap.ts` (one entry), `web/tests/shell/privacy-page.test.ts` (new), `web/tests/e2e/privacy.spec.ts`
  (new).
- **Must not touch.** `web/app/layout.tsx` (the beacon is already there), other shell files (NAV-1's), `web/app/themes.css`,
  `data/**`.
- **Steps.** 1. Page from existing components and tokens (no new colour, no green). 2. One footer link. 3. Sitemap entry.
  4. Tests: renders in the public build with sign-in off; the footer link on a trip, a place and the home page; noindex
  not set (the page is public); the words match the approved copy.
- **Acceptance.** T1 gates; place HTML: if BUD-1 has merged, chrome under its cap and S13 unchanged; if not, S13 still at
  or under 1.25 in both builds (shorten the footer sentence by the link's bytes if needed); trip start JS +0 B; axe
  passes on Chromium and WebKit; screenshots of `/privacy/` and the footer at 1440 and 390, light and dark; then
  `travel-design-reviewer`, then `travel-verifier`.
- **Commit.** `web(GSI-P): privacy page and footer link`.

### 6.4 NAV-C: the copies contract (B2, Opus, 3.25 h; after BUD-1 or beside it, disjoint files)

- **Goal.** As [navigation-and-mine.md](../features/navigation-and-mine.md) 10 NAV-C, plus: the file
  `core/src/schema/trip-custom.ts` is created here as the skeleton CUS-C extends (`start`, `travellers`), and `copies/1`
  and `trip-custom/1` reserve the optional private fields `from` and `gw` (origin spec, planned, spec merged), so neither
  envelope changes shape again before v0.8.
- **Owns.** `core/src/schema/copies.ts` (new), `core/src/schema/trip-custom.ts` (new), `core/src/privacy/detect.ts`
  (keys `copiedAt`, `travellers`, `from`, `gw` only), `core/test/schema/copies.test.ts`,
  `core/test/schema/trip-custom.test.ts`, regenerated `data/schema/generated/**` if the exporter covers these schemas.
- **Must not touch.** `web/**`, `core/src/catalogue/**`, `data/**` (except the generated schema output).
- **Steps.** Envelope with version; legacy key `travel:v1:copy-drafts` moved, deleted only after a good write; storage
  probe; merge rule (idempotent, dedupe by trip and start, cap 20 a device, 50 an account); property tests; detector
  planted-key tests.
- **Acceptance.** Spec acceptance for NAV-C; a planted `travellers` or `from` in a public payload fails the detector;
  `pnpm --dir core exec tsc --noEmit`, `pnpm --dir core test`, `pnpm --dir web exec tsc --noEmit` (no web code changed,
  but types are shared). No screenshots (no screen). T2: check-all (a `full` path: `core/src/privacy/**`).
- **Commit.** `core(NAV-C): copies and trip-custom envelopes, detector keys`.

### 6.5 RIS-J: bring the JSON into the contract (data seat, Sonnet builder, 6 h; alone in the data lane)

- **Goal.** Every data family passes `normalise --check`; the source registry reads windows, base plans and seasons; no
  value changes meaning; data batches that follow start from compliant files
  ([catalogue-intake-and-storage.md](../features/catalogue-intake-and-storage.md) 6.1).
- **Owns.** The outputs of `node core/bin/normalise.ts --write` on `data/capture/**`, `data/suitability/**`,
  `data/relevance/**`, `data/windows/**`, `data/base-plans/**`, `data/seasons/**`, `data/tracks/**`,
  `data/capture/points.json`; `core/src/sources/**` (registry build); `data/sources/registry.json` (regenerated).
- **Must not touch.** `web/**`, `data/locations/**` by hand, `data/vocab/**`, `core/src/schema/**` (a contract gap
  is a written request to B2), `legacy/**`.
- **Steps.** 1. Check first what D2b already converted to `capture-points/2`; record it. 2. `normalise --check` per
  family, then `--write`, one family per commit. 3. Extend `sources.ts build` to the three trip-level folders.
  4. Re-run `capture.ts gaps --budget --check`, `sources.ts check`, `validate.ts --all`, `suitability.ts check`,
  `relevance.ts check`, `slugs.ts --check`, `snapshot:check`.
- **Acceptance.** All of the above pass; no gap-budget count rises; the migration-ledger test passes; the 233 hash ids
  resolve; a screenshot pair of `/places/moraine-lake/` and `/places/peyto-lake-lookout/` at 1440 and 390 in light and
  dark shows no change. Leave `web.build` and the budget tests to the coordinator's stack (T2) unless a build slot is
  free; say which in the hand-back.
- **Commit.** `data(RIS-J): <family> normalised to the research contract` per family.

**6.6 Docs lane at J1 (Haiku, then Sonnet check; not a build seat).** H3, H4 and H8 as one branch
`public/H-DOCS`, opened only when no other docs branch is open: rewrite the stale ids from the copied commit map
(exact prefix match, ids with no public commit suffixed "(private history)"), then the BACKLOG and DATA-ROADMAP status
sync, then the migration-number wording. Acceptance: `relink.py check` and `tree_check` pass; a sample of 20 rewritten
ids resolves with `git cat-file -t`; no text other than ids and status cells changed (`git diff --word-diff` sample).

## 7. Risks and owner decisions

### 7.1 Risks

| Risk | Effect | Recommendation |
|---|---|---|
| An old-history branch is merged | the scrubbed household strings and images come back into `main` | never merge a branch whose base is not on `main`; `git merge-base --is-ancestor <base> main` before every merge; ORIGIN-PLAN was cherry-picked, not merged, after a scrub scan of the stack's diff; H7 |
| The commit map is lost with the scratch folder | 684 ids become unreadable | H2 now |
| `HOME_POINT_*` missing in Vercel | the next deploy fails closed at build | v0.2 owner action, checked with `vercel env ls production` (names only) |
| Budgets: 0.6 KB of trip JS, about 0.1% of place HTML | a small UI change fails the gate; lanes argue over bytes | BUD-1, OVR-0 first, one budget mover per stack, `budget:report` in every hand-back |
| B2 (one contract author) falls behind B1 | B1 waits | keep B2 one release ahead; move TS, LOCAL and RIS-S into B2's gaps; a second Opus builder only for a contract-free task |
| The catalogue is unthrottled on production | scraping or cost (P8) | the Vercel Firewall rule in v0.2 |
| The TRP2b2 deferrals stay open | wrong print and CSV booking windows; small phone targets | v0.4 |
| REQ-RF adds about 1 to 2 MB of generated world towns | function size on Vercel and repository growth | REQ-RF measures and lists the parts in `runtime-files.ts` only where a route reads them |
| The Vercel Git link (scrub step 7) builds pull-request previews with production values | a secret exposed to untrusted code | Q266 |
| CI and the home point | `check.yml` cannot run check-all | LOCAL-4 sets the decoy from `core/test/setup` as plain workflow `env`, not a secret (RELEASE-PLAN 7.2 "Secrets: none" holds) |
| Data batches and RIS-J overlap | double edits of every family | RIS-J first and alone |
| GSI-1 and MCP-O briefs predate EML-1 | wrong owned files | re-scope at brief time (C13) |
| Three agents building at once before TS-4 | timing tests flake; machine stalls | the coordinator's interim rule in 5.1 |

### 7.2 New questions for the owner (Q260 to Q268, all answered 25 Oct 2026)

| ID | Question | Recommendation | Trade-off |
|---|---|---|---|
| Q260 | Measure the place-size budget on catalogue content only, with shell chrome (header, footer, bar, beacon) under its own cap of today's bytes + 1 KB (BUD-1)? | **Yes** (ANSWERED 25 Oct 2026: yes, as recommended. BUD-1 is released to start.) | Shell growth is checked by a separate, looser cap; the ratio no longer counts every byte a visitor downloads (as Q222 already accepted for the beacon) |
| Q261 | Home point for builders' worktrees: put `HOME_POINT_LAT` and `HOME_POINT_LON` in a mode-600 file `~/.config/travel-secrets/home-point.env` that `~/.zshenv` exports, instead of copying the root `.env.local` into worktrees? | **Yes** (ANSWERED 25 Oct 2026: yes, as recommended. Worktrees source `~/.config/travel-secrets/home-point.env`.) | Every process of your user account sees the two variables; no worktree ever holds production secrets |
| Q262 | Approve the renumbered train of 5.3 (v0.2 to v0.21, v1.x), with the version number still following the deploy order (Q224)? | **Yes** (ANSWERED 25 Oct 2026: yes, as recommended. The renumbered train is THE train; the old numbers are legacy.) | Four more releases and one renumbering, against releases without hidden dependencies |
| Q263 | The photo figure on place and trail pages (about 400 bytes: image and credit, server-rendered for previews and crawlers) as one owner-approved re-baseline in v0.7, rather than a client-only lazy figure? | **Server-render, re-baseline once** (ANSWERED 25 Oct 2026: yes, as recommended. Server-rendered, with one re-baseline in v0.7.) | The ratio absorbs one figure per page; a lazy figure keeps the ratio but shows no photo without JS and none in link previews |
| Q264 | Rewrite the 684 stale commit ids in place from the commit map (H3), keeping the map in your private backup folder? | **Yes** (ANSWERED 25 Oct 2026: yes, as recommended. The stale commit-id rewrite is approved.) | One large docs diff at a quiet point; the alternative leaves every old id unreadable to the public |
| Q265 | Delete the 95 merged old-history `public/*` branches and their worktrees as one listed batch (H7)? | **Yes** (ANSWERED 25 Oct 2026: yes, as recommended. Approved only for the coordinator to carry out.) | The private history stays in the private remote and the `archive/*` tags; local clutter and the risk of merging one go |
| Q266 | Keep the Vercel Git integration disconnected (Q226) even after the scrub's step 7 links the new repository, using `git.deploymentEnabled: false` if a link is needed; and use RELEASE-PLAN 7.4's ruleset (no required pull request) instead of the scrub's "PRs required"? | **Yes to both** (ANSWERED 25 Oct 2026: yes, as recommended. Vercel Git stays off; the RELEASE-PLAN ruleset stands.) | Previews by hand only; direct merges by the coordinator keep working |
| Q267 | TD-1 to TD-3 (trip pages from data) as v0.14, before customise, now that R2 no longer exists (Q80's premise)? | **Yes** (ANSWERED 25 Oct 2026: yes, as recommended. Trips from data in v0.14.) | 22 h before customise; without it a trip planned through the `trip` skill has no page |
| Q268 | Close R1 and R2 as superseded by the per-release approval of a named commit with its smoke and phone check? | **Yes** (ANSWERED 25 Oct 2026: yes, as recommended. R1 and R2 are closed.) | No single big review; each release gets a small one |

### 7.3 Open questions this order waits on (already asked; not re-asked)

Q88 (now urgent: option A is merged; v0.2), Q101 to Q108 (v0.3), Q185 and Q141 (v0.5), BACKLOG 15.44 accent folding
(v0.6), Q117 to Q124 (v0.9), Q130 to Q137 (v0.10), Q93 to Q100 (v0.12),
Q109 to Q116 and DD-6 (v0.13), Q67, Q98, Q103, Q120 and `planner_draft_signal` (v0.15), Q160 to Q167, Q190 to Q198
(v0.19, v0.20), Q148, Q149 (v0.21), Q170 to Q177, Q180 to Q187 (track I and v1.x), Q91 (GLB2b inside E or after R2; the globe mock itself was approved at R1). Recommendation: one reply "yes as recommended" for each block, with any
exception named; each block unblocks the release in brackets.

## 8. Proposed edits the owner (or a later docs lane) applies

### 8.1 CLAUDE.md (owner)

| Section | Now | Proposed |
|---|---|---|
| Start here | "read HANDOVER.md ..., then docs/v2/PLAN.md ..., then EXECUTION-PLAN ..." | add "then `docs/v2/build/MASTER-ORDER.md` (lanes, conflicts, release order) and `docs/v2/build/RELEASE-PLAN.md`" |
| Folder contract | "Deployment is out of scope until the hosting is chosen" | "Production runs on Vercel (`travel-beta-tan.vercel.app`); releases follow `docs/v2/build/RELEASE-PLAN.md`; deploy only a named commit the owner approved" |
| Platform | "`web/` is the Next.js app (a static export ... until lane API-0 ...)" | "`web/` is the Next.js server build with `/api/v1/` route handlers" |
| Platform | (none) | "Every worktree needs `HOME_POINT_LAT` and `HOME_POINT_LON` in the environment (Q261); never copy the root `.env.local`" |
| Platform | "run `bash tools/check-all.sh` before publishing" | the TEST-STRATEGY 14 text, after TS-2 and Q257 |
| Agents and models | the agent table | one line: "At most two builders, one verifier and one data seat at a time; lanes and their files: MASTER-ORDER 5.1" |
| Gotchas | (none) | "Commit ids in docs written before 25 Oct evening refer to the private history until H3; branches made before the rewrite are never merged, only rebased with `--onto`" |

### 8.2 HANDOVER.md, current section (H5)

Replace "Vercel preview live ... **No production deployment yet**" and the "Running or open work" table with: production
live since 25 Oct at `47be5b58` (private d93127b), migrations 0001 to 0011; merged since then ACCT-PH, D2b with option A,
BUDGET-FIX, PUBLIC-SCRUB (home point from the environment), E2E-FIX; nothing running; next tasks MASTER-ORDER 6; owner
actions MASTER-ORDER 4.6; setup adds the home point (Q261) and "worktrees from the public history only". Remove the
"Email Phase 1 backend: building" and the data-batch "running" rows (all merged). Section 2's command table follows
TEST-STRATEGY once TS-5 runs.

## Change log

| Date | Change |
|---|---|
| 2026-10-26 (AUDIT-MOVE, owner decision) | 5.3: v0.14.2 removed, v0.22 "UI and UX audit and fixes" added before v1.0, AU-D narrowed to the MCP field list (6 h to 3 h); 5.4: row 23 for UA-0 and the UA-FX lanes, B1 total about 385 h; the note that CUS-1 waits for UA-D is removed (CUS-C still waits for FA-D); 4.6 owner actions updated. UA-0 timing moves to just before v0.22; REC-2 keeps screenshots per release because the audit compares them. Nothing else renumbered |
| 2026-10-25 (audits after release) | 5.3 gains the patch releases v0.14.1 and v0.14.2 and the delta audit row before v0.19, with a note that CUS-C waits for FA-D and CUS-1 for UA-D; 4.6 gains the audit owner actions. Detail in [AUDITS-AFTER-RELEASE.md](AUDITS-AFTER-RELEASE.md) (R-230 to R-237, Q270 to Q279); nothing renumbered |
| 2026-10-25 (owner answers, ANSWERS-4) | Q260 to Q268 answered 25 Oct 2026, yes as recommended: Q260 (BUD-1 released), Q261 (home-point file), Q262 (renumbered train is THE train), Q264 to Q268 as listed. Section 7.2 rows marked; section 7.3 pruned to the questions still open (answered Q240 to Q249 and Q250 to Q258 removed; R1 item 7 replaced by Q91, the open question GLB2b waits on). Nothing else changed |
| 2026-10-25 | First version (MASTER-ORDER, planned only): inventory deduplicated against `main`, conflict map with hot spots, pairwise UI matrix, contract order, migrations and budgets, lanes and joins, the renumbered train v0.2 to v0.21 and v1.x with corrections C0 to C14, critical path, the first five briefs, risks, Q260 to Q268, proposed CLAUDE.md and HANDOVER edits |
