# Engineering standard: the rules any coding agent follows in this repo

Written 26 Oct 2026 by the planner (Opus 5.5) on `public/STANDARD` (BACKLOG 15.332; TODO row of 26 Oct). **Docs only.**

**Who this is for.** Any agent or person that changes this repository: the project's own Claude agents, another vendor's
model (GPT, Gemini, an open model), or a contractor. Nothing here assumes one tool. Where a rule needs a capability (read a
file, run a command, take a screenshot) it says so in plain words and gives the command. Claude-only conveniences (hooks,
agent files, skills) are listed in section 15 with the manual step that replaces each one.

**How it fits with the other pages.** This page is the *how*: the rules every change obeys. [PLAN.md](../PLAN.md) is the
*what* (requirements, order, decisions). [MASTER-ORDER.md](MASTER-ORDER.md) is the *when and who* (tasks, lanes, owned
files, the one-author contract order). [TASK-BRIEF-TEMPLATE.md](TASK-BRIEF-TEMPLATE.md) is the shape of the one document a
worker receives. [proposed-AGENTS.md](proposed-AGENTS.md) is the short root file that points here. When this page and a
task brief disagree, **the brief wins for that task** and the hand-back says so. When this page and PLAN section 1
disagree, PLAN wins and this page is fixed the same day.

**Reading rule.** Each rule has an id (`S<section>.<n>`), the rule, why it exists, and how it is enforced. "Enforced"
names a script, test, gate step or review. **"Not yet enforced"** names the task in section 17 that closes the gap.
Until then the rule holds anyway and the coordinator checks it by the review checklist (16.4).

## Index

| # | Section |
|---|---|
| 0 | [Roles and model tiers](#0-roles-and-model-tiers) |
| 1 | [Repo map and folder contract](#1-repo-map-and-folder-contract) |
| 2 | [Data, contracts, schemas and generated files](#2-data-contracts-schemas-and-generated-files) |
| 3 | [Shared contracts: one author at a time](#3-shared-contracts-one-author-at-a-time) |
| 4 | [Hard-coding ratchet and environment variables](#4-hard-coding-ratchet-and-environment-variables) |
| 5 | [Privacy and secrets](#5-privacy-and-secrets) |
| 6 | [Design system and UI](#6-design-system-and-ui) |
| 7 | [Budgets](#7-budgets) |
| 8 | [Testing tiers and the gate](#8-testing-tiers-and-the-gate) |
| 9 | [Branches, worktrees and commits](#9-branches-worktrees-and-commits) |
| 10 | [Things a worker never does](#10-things-a-worker-never-does) |
| 11 | [External services and fetching](#11-external-services-and-fetching) |
| 12 | [Data and research tasks](#12-data-and-research-tasks) |
| 13 | [Definition of done](#13-definition-of-done) |
| 14 | [The hand-back](#14-the-hand-back) |
| 15 | [Stop and ask: escalation](#15-stop-and-ask-escalation) |
| 16 | [Conformance: how we check an agent follows this](#16-conformance-how-we-check-an-agent-follows-this) |
| 17 | [Tasks, hours and placement](#17-tasks-hours-and-placement) |
| 18 | [Owner questions](#18-owner-questions) |
| 19 | [Gotchas](#19-gotchas) |

## 0. Roles and model tiers

| Role | Does | Never does | Claude agent today |
|---|---|---|---|
| Coordinator | Cuts worktrees, hands out briefs, merges, runs T2 and T3, pushes `main`, moves BACKLOG and TODO rows | builds features | the main session |
| Planner | Writes specs, plans, briefs, decisions | changes code | `travel-planner` |
| Builder | Implements one brief inside its owned files, runs T0 and T1 | merges, pushes, edits files outside the brief | `travel-builder` |
| Contract builder | A builder on a shared contract file (section 3) | runs beside another contract author | `travel-builder` on the strong tier |
| Researcher (data seat) | Fills data to the capture contract through the tools | writes code outside its brief, runs two fetchers on one service | `travel-researcher` |
| Design reviewer | Judges UI against the foundation and spec; writes a review note | fixes code | `travel-design-reviewer` |
| Verifier | Re-runs checks independently, takes and reads screenshots, reports pass or fail | fixes code, trusts the builder's cache | `travel-verifier` |

**Model tiers.** Plans name three tiers. Pick the cheapest tier that can do the task well (owner, 21 Oct).

| Tier | Claude model today | Use for | Examples |
|---|---|---|---|
| Light | Haiku | mechanical work with no judgement: search, count, rename, format, link checks | find every reference to a folder |
| Standard | Sonnet | a written brief inside owned files with acceptance checks: implement, test, verify, fill data to a clear contract | a UI task from a brief; a verifier run |
| Strong | Opus | ambiguity or cross-cutting work: shared contracts, a new abstraction, privacy or security, more than three interdependent files, design taste, research needing judgement, gates and audits | a contract task; a design review; a data batch review |

Rules: a review or audit never runs on a lower tier than the work it checks. Escalate one tier when a hand-back shows a
judgement error, the same fix fails twice, or the task turns out to touch a shared contract. **Never use the model named
Fable** (owner, 18 Oct). Another vendor's model is placed on a tier by the coordinator before its first task (16.3).

## 1. Repo map and folder contract

| Path | Holds | Who writes it |
|---|---|---|
| `web/` | The Next.js app (App Router, server build, `/api/v1/` route handlers). The only product surface | builders |
| `core/` | Zod schemas, the catalogue store and its contract kit, operations, privacy detector, checks, CLIs in `core/bin/` | builders, contract builders |
| `tools/` | Python and shell tools: the gate, the folder contract, the hard-coding ratchet, towns, locations, theme tokens | builders |
| `data/` | The system of record: trips, schedules, capture records, sidecars, locations, vocab, reference data, generated schema | tools and researchers (section 2, 12) |
| `research/` | Research method, per-type checklists (generated), per-trip prose, run notes, audits; map in `research/README.md` | researchers |
| `docs/v2/` | Plan, TODO, specs (`features/`, `ux/`, `mcp/`), design (`design/`, foundation in `design/foundation/`), build plans and briefs (`build/`) | planner, reviewer |
| `docs/archive/` | Superseded documents; nothing live links into it | planner |
| `legacy/` | The 14 frozen pages of the old site | **nobody** (S10.6) |
| `.claude/` | Claude-only: agent definitions, skills, hooks config | owner and planner |

| Id | Rule | Why | Enforced by |
|---|---|---|---|
| S1.1 | No new top-level folder. Root files are the owner's | one layout every agent can predict | `python3 tools/tree_check.py` rule 1 (check-all, gate `tree` suite) |
| S1.2 | Research lives only in `research/`, in the folders its README lists; nothing new at the `research/` root; no `docs/` file named `*research*` | one home for research (cleanup D11) | `tree_check.py` rules 2, 3 |
| S1.3 | `research/types/**` is generated; never add a file there | `capture.ts build` deletes files it did not write | `tree_check.py` rule 4; `capture.ts build --check` |
| S1.4 | No duplicate files in `docs/` and `research/`; images named and under 1.5 MB | drift between copies; repository size | `tree_check.py` rules 7, 8 |
| S1.5 | Every repo path named in code or docs exists; nothing live links into `docs/archive/` | dead paths mislead the next agent | `tree_check.py` rules 9, 10; `python3 tools/relink.py check` |
| S1.6 | Never add a baseline entry to hide a new folder-contract break | the baseline lists known exceptions, one reason each | review (16.4 item 6); `tools/tree_contract.json` is a review path |
| S1.7 | Verification screenshots go outside the repo or to `web/test-results/shots/` (ignored); commit a screenshot only when a spec or review names it | repository size; Playwright wipes `web/test-results/` at every run | review; `tree_check.py` rule 8 caps size only |

## 2. Data, contracts, schemas and generated files

**Where things live.**

| Thing | Path | Written by |
|---|---|---|
| Trip | `data/trips/<id>/trip.json` | `node core/bin/ops.ts <operation> --input <file>` only; each operation returns an inverse; `trip.restore` undoes |
| Schedule | `data/schedules/<id>.json` | per `data/trips/README.md` |
| Capture records (place, route, offer, event; `capture/1`) | `data/capture/<trip>/<lane>.json`; trip-less in `data/<kind>/catalogue/` | researchers, to the capture contract, then validated |
| Suitability and relevance sidecars | `data/suitability/<trip>/`, `data/relevance/<trip>/` | researchers and their tools |
| Locations (the wishlist store, schema v3) | `data/locations/locations.json` | `python3 tools/locations.py add|edit|import|quick-add` only |
| Type tree and profile rules | `data/vocab/types.json` (the one authored file of the capture contract) | strong-tier author only (S3) |
| Property registry | `core/src/schema/capture/properties.ts` | strong-tier author only (S3) |
| API contracts | `core/src/schema/api/**` (Zod); OpenAPI generated | contract builder (S3) |
| Store interface and decisions A1 to A40 | `core/src/catalogue/store.ts` | contract builder (S3) |
| Migrations | `core/src/db/migrations/<n>_<slug>.sql` | contract builder; number assigned at merge |
| Colour tokens | `web/app/themes.css` | `python3 tools/theme_tokens.py` only |
| Product constants | `web/lib/config/product.ts`, `core/src/config/` | builders (S4) |

**Never hand-edit.** Run the generator, commit its output with the change that caused it, and never resolve a merge
conflict in a generated file by hand (regenerate after the rebase).

| Output | Generator | Check that catches a hand edit |
|---|---|---|
| `data/schema/generated/**` | `node core/bin/schema.ts generate` | `schema.ts generate --check` |
| `data/schema/generated/openapi.json` | `node core/bin/openapi.ts` | `openapi.ts --check` |
| `data/schema/capture/*`, `data/schema/suitability-applicability.json`, `research/types/**` | `node core/bin/capture.ts build` | `capture.ts build --check` |
| `data/sources/registry.json` | `node core/bin/sources.ts build` | `sources.ts check` |
| `data/suitability/<trip>/migrated.json` | `node core/bin/suitability.ts migrate --write` | `suitability.ts check` |
| `data/relevance/derived/<trip>.json` | `node core/bin/relevance.ts derive --write` | `relevance.ts derive --check` |
| `data/suitability/scope.json` | the scope vitest run (check-all step) | `git diff --exit-code` on it in check-all |
| `web/data-snapshots/**`, `web/redirects.json` | `pnpm --dir web snapshot` | `snapshot:check` |
| search `vocab.json` | `node web/scripts/search-vocab.mjs` | `search-vocab.mjs --check` |
| `web/app/themes.css` | `python3 tools/theme_tokens.py` | `tools/tests/test_theme_tokens.py`; `web/tests/no-hex.test.ts` |
| `data/catalogue/slugs.json`, `data/locations/page-keys.json` | `node core/bin/slugs.ts build|rename|alias|merge|withdraw` | `slugs.ts --check` |
| `data/reference/towns/**` | `python3 tools/towns.py build` (GeoNames verbatim) | `towns.py --check` |
| `near_town`, `area_id` on records | `capture.ts derive-near --write`, `derive-area --write` | `derive-near --check`, `derive-area --check` |
| `data/schedules/legs/*.json` | `node web/scripts/legs-ors.mjs` | `legs-ors.mjs --check` |
| `data/locations/WISHLIST.md` and two legacy outputs | `python3 tools/locations.py build` | `locations.py build --check` |
| `research/reports/trip-tag-conflicts.md` | `pnpm --dir web tag-conflicts` | review |
| `web/public/img`, `web/public/og` | `pnpm --dir web build` (images and og scripts) | `images.mjs --verify` |

| Id | Rule | Why | Enforced by |
|---|---|---|---|
| S2.1 | A trip changes only through an operation in `core/src/ops/` | every write has an inverse and is validated | `core/bin/ops.ts`; `validate.ts --all`; review of any diff to `trip.json` without an ops run in the hand-back |
| S2.2 | A new type is one entry in `types.json`; a new property is a registry change in `properties.ts`; a record's type profile equals its kind's (E_CAP_TYPE) | one taxonomy, extensible without code | `capture.ts build --check`; `validate.ts` |
| S2.3 | The gap budget (`data/capture/gap-budget.json`) only falls; on a rebase take the lower number | a rise means the data got worse | `capture.ts gaps --budget --check` |
| S2.4 | The migration ledger pins every pre-migration leaf; `capture.ts migrate` never runs again | proves the 61-record split lost nothing | ledger test in core; the CLI refuses |
| S2.5 | A slug never changes silently; use `slugs.ts rename|alias|merge|withdraw` | URLs are public; a rename answers 308 | `slugs.ts --check` |
| S2.6 | Migrations are additive, carry a slug in the branch and get their number at merge (MIG-N); every new table has row-level security before app code reads it; never run a migration against the child or production branch from a worker | two branches never fight for a number; RLS-first | MASTER-ORDER 4.4; db suites (`pnpm db:test`, Docker); the LOCAL-C target guard; review |
| S2.7 | Data edits have follow-on commands: after a locations edit `node core/bin/suitability.ts migrate --write`; after points in a new area `python3 tools/towns.py build` then `capture.ts derive-near --write` | derived files go stale silently | the `--check` commands above (fail at T1 when the data suites are selected) |

## 3. Shared contracts: one author at a time

**Shared contract files** (MASTER-ORDER 4.1, "contract" rows): `core/src/catalogue/store.ts`, `core/src/schema/api/**`
(above all `trip.ts` and `place.ts`), the OpenAPI output, `core/src/privacy/**` (above all `detect.ts`),
`core/src/schema/trip-custom.ts`, `core/src/schedule/profileCodec.ts`, the `core/src/schedule/**` engine,
`core/src/db/migrations/**`, `core/src/db/inventory.ts`, `core/src/db/tx.ts`, the capture contract
(`core/src/schema/capture/{records,properties,relations}.ts`, `core/src/schema/enums.ts`, `core/src/validate/capture.ts`,
`codes.ts`, `data/vocab/types.json`), `web/lib/server/respond.ts`, `core/src/api/**`, `core/src/capture/generate.ts`.

**Append-only shared files** (several tasks add a section, none rewrites another's): `web/lib/capabilities.ts`,
`web/lib/client/data.ts`, `tools/check-all.sh`, `tools/gate/map.json`, `web/styles/timeline.css` (one block per task).

| Id | Rule | Why | Enforced by |
|---|---|---|---|
| S3.1 | Only the task named in MASTER-ORDER 4.3 for the current slot edits a shared contract file; it merges before the task that consumes it starts | two authors on one contract produce two truths | MASTER-ORDER 4.3 (coordinator); **not yet enforced mechanically**: STD-3 flags a diff that touches a contract path the brief does not own |
| S3.2 | A consumer that finds a gap in a contract writes a request in its hand-back; it never edits the contract | keeps the one-author order | review; STD-3 |
| S3.3 | A contract change ships with its cases in the contract kit (`core/test/catalogue/contract/*.cases.ts`) on all three runners (stub, `JsonStore` on real data, the handlers); a `pending` case is an `it.todo` with a reason | every store method has one written behaviour; the Postgres store must pass the same cases | `web/tests/api/contract-store.test.ts`, `web/tests/api/contract.test.ts`, core contract tests |
| S3.4 | A contract task is strong tier and its diff is read by a second strong-tier reviewer before hand-back | a shared contract is a cross-cutting decision | review (brief line); the gate's `review` paths |
| S3.5 | Components read data only through `web/lib/client/data.ts` (`DataClient`); MCP tools sit on the same store, contracts and operations, never import a database client | P9: one data boundary; R-252 | `web/tests/data/boundary.test.ts`; the MCP grep test (MCP-C) |
| S3.6 | Append-only files: add your own section at the end, never reorder or edit another task's section; merges are serial | text conflicts stay trivial | review; MASTER-ORDER 4.1 |

## 4. Hard-coding ratchet and environment variables

| Id | Rule | Why | Enforced by |
|---|---|---|---|
| S4.1 | No new literal colour, slug, host, user agent, threshold or env name in `core/`, `web/`, `tools/` source. New values go in `web/lib/config/product.ts` or `core/src/config/` | one place to change a value; the count may only fall | `python3 tools/cons/hardcode_scan.py --check` against `tools/cons/baseline.json` (check-all; gate) |
| S4.2 | `--write` on the ratchet only after you removed findings, never to admit new ones | the ratchet turns one way | review of any `baseline.json` diff (16.4 item 6) |
| S4.3 | Every environment variable read in code is a row (name only, never a value) in "Environment variables" of `docs/v2/build/public-site/README.md` | a reader can see every switch the app has | `hardcode_scan.py` env-table rule; `web/tests/cons/env-table.test.ts` |
| S4.4 | `NEXT_PUBLIC_*` values are inlined at build; a server secret never gets that prefix and never reaches `.next/static` | client bundles are public | check-all build step (ORS key name and value grep); **not yet enforced for other keys**: STD-6 |

## 5. Privacy and secrets

The owner's household uses the site's plans. Public output is every HTML page, `/api/v1` body, export, share image,
sitemap, MCP response, and every tracked file (the repository is planned to become public).

| Id | Rule | Why | Enforced by |
|---|---|---|---|
| S5.1 | No household data in public output or tracked files: no party, traveller names or ages, birthdays, home town as "home", real trip dates, personal status (for example "Finished plan"), stay ideas, booking state or codes, costs of the family. Public text says who a plan suits, never who travelled | the owner's family | `core/src/privacy/detect.ts` inside `respond()` (fails closed on every API body); `web/tests/privacy.test.ts`, `web/tests/data/public-privacy.test.ts`, `web/tests/scrub.test.ts`, `web/tests/data/dateless.test.ts`; **tracked research prose: not yet enforced** (STD-6) |
| S5.2 | The home point is read only from `HOME_POINT_LAT` / `HOME_POINT_LON` by `core/src/config/home.ts`; never print, log, copy into a fixture or a tracked file. Unset, `nearHome()` throws | it is the one household coordinate | `HomePointUnsetError`; privacy tests; **a tracked-file scan for the value: not yet enforced** (STD-6) |
| S5.3 | Towns are shown exactly as the public GeoNames and OSM data has them: never moved, dropped or flagged; the detector accepts a point only when it equals the gazetteer point for that town id (A33, A39, A40) | a moved or missing town is itself an oracle for the home point | `python3 tools/towns.py --check`; detector tests |
| S5.4 | Refs are opaque `place/<slug>`; the `loc:` to slug link lives only in `data/locations/page-keys.json`; no `sourceTypes` or `added` in public output | a field must not reveal which places came from the wishlist | `web/tests/data/light-data.test.ts` (allowlist); detector |
| S5.5 | Trips are dateless templates: Day 1 to N, a length, a season window | the 90% reader copies a plan onto their own dates (P7) | `web/tests/data/dateless.test.ts`; detector |
| S5.6 | Device-only data (the party, copies, favourites) is read and written through `web/lib/storage/safe.ts`; ages never enter a URL | household data stays on the device | eslint `no-restricted-globals` and `no-restricted-properties` in `web/eslint.config.mjs`; `web/tests/storage/safe.test.ts` |
| S5.7 | Never print, paste, log or commit a secret. Never copy the root `.env.local` (production values). `web/.env.local` only when the brief allows it: mode 600, deleted before hand-back | secrets in git are permanent | check-all ORS grep; **no general secret scan yet** (STD-6) |
| S5.8 | Nothing about travel goes in the owner's personal notes vault (outside this repo) | owner rule | review |
| S5.9 | An outside model (any vendor API) works with a decoy home point, never the real one (Q-S4) | the real value would leave the machine in the model's context | `tools/gate.sh` today **reads the real value from the main checkout's `.env.local`** when unset: see 19.1; STD-6 adds the decoy switch |

## 6. Design system and UI

The design system is `docs/v2/design/foundation/`: `principles.md` (P1 to P9, T1 to T5), `tokens.md`, `components.md`,
`patterns.md`, `specimen.html`, `review.md`. Every UI task also reads `docs/v2/design/trip-scope-scenarios.md` and
`docs/v2/design/keep-from-live-site.md`.

| Id | Rule | Why | Enforced by |
|---|---|---|---|
| S6.1 | Read P1 to P9 and T1 to T5 before any design, build or review, and cite them by number in commits and hand-backs | one vocabulary for judging UI | review (16.4 item 9) |
| S6.2 | Colour only from `web/app/themes.css` tokens. No literal colour in `web/` source | one palette, light and dark | `web/tests/no-hex.test.ts`; `hardcode_scan.py` colour rule |
| S6.3 | No green anywhere (status colours and maps included) and no purple | owner, 18 Oct (Trailhead direction) | `test_theme_tokens.py` checks AA pairs and the old green shell only; **a hue check on every token: not yet enforced** (STD-8). The Google basemap's green is a console style, not code |
| S6.4 | No new HTML pages. A visual change is a `web/` change; a trip or a fact is data | the web app is the only product surface (owner, 21 Oct) | `tree_check.py` rule 11 (legacy pins); review |
| S6.5 | Use the foundation's components and tokens; Base UI (`@base-ui/react`), not Radix; every state (hover, focus, disabled, loading, empty, error) and the motion timings with reduced-motion rules | P4, P5 | eslint `no-restricted-imports`; design review |
| S6.6 | A gap is never a yes: an expected but empty section reads "Not checked yet"; a place without details reads "No details available" | honesty markers (T5) | `web/tests/data/sections.test.ts`; review |
| S6.7 | Accessibility: keyboard reachable, visible focus, 44 px targets on phones, text pairs at WCAG AA, minimum text 11.5 px, ARIA patterns from the foundation | the public site is for everyone | `test_theme_tokens.py` (AA, size); axe in the foundation and page e2e specs; design review |
| S6.8 | Overlays are non-modal unless the foundation says otherwise; motion is smooth and linked (P5) | owner, 18 Oct | design review |
| S6.9 | Maps: MapLibre on the globe; Google Maps JS on place and trip maps; never two map families on one page; coordinates never from Google | licences and one look | review; `relevance.ts check` for link-only sources |
| S6.10 | **Every UI round ends with the design review, then the verifier**, in that order, before the coordinator merges. Never run a design review while an e2e run is in progress | judgement before evidence; Playwright wipes shots | coordinator; **not yet enforced mechanically** (STD-4 merge trailers) |
| S6.11 | UI issues found outside your task go as one row each in `docs/v2/build/UI-NOTES.md`, in your commit | the final UI audit starts from them | review |
| S6.12 | Screenshots: Playwright from `web/` (`pnpm --dir web exec playwright ...`), device scale 2, 1440x900 and 390x844 (plus 320x640 when the brief says), light and dark, dark set by clicking the site's own theme control; cut tall pages into viewport tiles and read the tiles | the owner verifies UI by screenshots | the verifier; **evidence check not yet enforced** (STD-7: distinct files, right sizes) |

## 7. Budgets

| Budget | Limit | Test | Rule |
|---|---|---|---|
| Start JS, every page | 200 KB gzip | `web/tests/budget.test.ts` | the trip page is near the limit; every trip-page task ends at or above the headroom it started with |
| Place HTML (S13) | median and largest at most +25% over `web/tests/data/place-html-baseline.json`, catalogue content only | `web/tests/data/place-size.test.ts` | new place sections are lazy; a re-baseline needs the owner's ruling |
| Shell chrome | caps per build (public, sign-in on) | `web/tests/data/shell-size.test.ts` | one shell change per stack |
| Light list rows | exact key allowlist | `web/tests/data/light-data.test.ts` | P8: list rows carry only what a card or filter shows |
| Start-chunk boundary | named modules stay out of start chunks | `web/tests/data/boundary.test.ts` | lazy chunks for editors, panels, menus |
| Per-chunk caps in briefs | for example `/mine/` 30 KB | the brief's own test | quoted in the hand-back |

| Id | Rule | Why | Enforced by |
|---|---|---|---|
| S7.1 | Any task that can change page output runs `pnpm --dir web budget:report` before and after, on the public build and the sign-in-on build, and pastes both (under 20 lines each) into the hand-back | budgets have almost no room; two passing branches can fail together | the budget tests (hard limits); the report is review (16.4 item 8) |
| S7.2 | Baselines (`place-html-baseline.json` and the budget tests) change only in a task the owner ruled on | a baseline edit hides a regression | baselines are `full` paths in `tools/gate/map.json`; review |
| S7.3 | P8: no bulk files, no new client-side bulk load, exports per item, caps inside the store methods | the research is the product | `light-data.test.ts`, `boundary.test.ts`, contract kit caps |

## 8. Testing tiers and the gate

The owner's rule (25 and 26 Oct): **run the focused tests a change needs, not the whole chain.** The full chain runs once
per stack (T2) and once per release (T3), on a quiet machine, by the coordinator. Detail: [TEST-STRATEGY.md](TEST-STRATEGY.md);
the gate: [tools/gate/README.md](../../../tools/gate/README.md).

| Tier | Who | When | Command |
|---|---|---|---|
| T0 | builder | after each edit that compiles | `tools/gate.sh --tier 0` (typecheck of changed packages, related unit tests, eslint on changed files) |
| T1 | builder, before every hand-back and after each fix round | the map's selection for the branch plus the working tree | `tools/gate.sh --tier 1 --base main`; see what it would run with `--dry-run` |
| T2 | coordinator (or verifier on its behalf) | once per stack of up to four ready branches | `tools/gate.sh --tier 2` |
| T3 | coordinator | release commit; nightly | `tools/gate.sh --tier 3` (check-all, full e2e on every browser project, db suites) |

| Id | Rule | Why | Enforced by |
|---|---|---|---|
| S8.1 | A builder runs T0 while editing and T1 before hand-back. Never `bash tools/check-all.sh` or the full e2e unless the brief says T2 or T3 | one check-all is about 5 minutes and 665,000 characters of output; the full e2e about 41 minutes; they load the machine and make timing tests flake | TEST-STRATEGY 8.1; machine slots in `tools/gate/locks.py`; review |
| S8.2 | Every code change ships with tests for the changed behaviour and its failure paths; anything testable is tested | owner execution rule, 24 Oct | review; the gate map check M1 (every test file belongs to a suite) |
| S8.3 | Never pass by weakening: no new skip, no `.only`, no looser assertion, no mock standing in for an external service's proof, no quarantine without a reason and an expiry | a green run must mean something | `tools/gate/check_map.py` M5 (quarantine expiry); review (16.4 item 7) |
| S8.4 | A suite that could not run is DEFERRED, never a pass; list it in the hand-back. One retry after 5 minutes, no loops | no tier passes on a skip | gate exit code 2 |
| S8.5 | Before calling a failure pre-existing or flaky, run the same test on a clean `main` and quote both results | "it was already broken" is the most common false claim | review |
| S8.6 | A new test file, folder, e2e spec or check-all step is mapped in `tools/gate/map.json` in the same branch | an unmapped test never runs at T1 | `check_map.py` M1 to M4 (check-all and every T1) |
| S8.7 | A change under `tools/gate/**` needs a strong-tier reviewer's line that no rule got narrower | the map decides what runs | TEST-STRATEGY 10.1; `tools/gate/**` is a `full` path |
| S8.8 | Builders run only the e2e specs the gate selects (or the brief names); one Playwright run and two builds at a time on the machine | load causes flakes | `locks.py` slots; gate |
| S8.9 | Read the gate's summary (at most 40 lines). Never paste a whole log; quote the failure excerpt; the log path is in the summary | token cost and signal | review |
| S8.10 | Kill any server you start by its PID, never by process name | other projects run servers on this machine | review |

Single commands, when the brief names them: `pnpm --dir web typecheck`, `pnpm --dir core typecheck`, `pnpm --dir web lint`,
`pnpm --dir web exec vitest run <files>`, `pnpm --dir core exec vitest run <files>`,
`SKIP_WEB_BUILD=1 pnpm --dir web exec playwright test tests/e2e/<name>.spec.ts --project=chromium` (after one build),
`python3 -m pytest tools/tests/<file> -q`, `python3 tools/tree_check.py`, `python3 tools/relink.py check`,
`python3 tools/cons/hardcode_scan.py --check`, `python3 tools/gate/check_map.py`.

## 9. Branches, worktrees and commits

| Id | Rule | Why | Enforced by |
|---|---|---|---|
| S9.1 | One task, one branch `public/<TASK>`, one worktree `/Users/nks/workspace/travel-wt/v2-<TASK>`, cut from `main` (or the bundle branch the brief names): `git -C /Users/nks/workspace/travel worktree add /Users/nks/workspace/travel-wt/v2-<TASK> -b public/<TASK> main`, then `pnpm install --frozen-lockfile` and `cp -R /Users/nks/workspace/travel/web/.og-cache web/` | parallel lanes never share a working tree | coordinator; **branch name not yet checked** (STD-4) |
| S9.2 | Edit only the files the brief's "Owns" list gives. A needed change elsewhere is a request in the hand-back | parallel lanes own disjoint files | **not yet enforced mechanically** (STD-3 compares the diff with the brief) |
| S9.3 | Stage only owned paths by name: `git -C <worktree> add <paths>`. Never `git add -A`, `git add .`, `git commit -a`, or a bare `git stash` | stray files from other tools end up in commits | **not yet enforced** (STD-3 catches the result: a file outside Owns) |
| S9.4 | Subject `<area>(<TASK>): <what, imperative>`; `<area>` is one of `web`, `core`, `data`, `research`, `tools`, `docs`, `design`; the body says why and cites principles by number | the log is the project's audit trail | **not yet enforced** (STD-4) |
| S9.5 | Trailers, last lines of the message: `Co-Authored-By: <model name and version> <vendor no-reply address>` naming the model that did the work, and `Task: <TASK>`; Claude sessions also add `Claude-Session: <url>`. Proposed (Q-S2): `Model: <exact model id>` for every vendor | the hand-back and the log must say which model did what, so the tier choice can be judged | **not yet enforced** (STD-4) |
| S9.6 | A worker never pushes, never merges, never rebases a branch it does not own, never force-pushes. The coordinator merges with `git merge --no-ff public/<TASK>` and pushes `main` on a line of its own | `main` moves only after T2 | a user-level hook guards force-pushes **for Claude only**; **not yet enforced for others** (STD-9 pre-push hook; Q-S6 branch protection) |
| S9.7 | Rebase onto `main` before hand-back when `main` moved; a rebase with hand-resolved conflicts is a full fallback at T1 | the hand-back must describe the code that will merge | gate (TEST-STRATEGY 4.4) |
| S9.8 | After the hand-back, delete the worktree's `node_modules` and `web/.next` (the coordinator removes the worktree) | disk; stale builds | review |
| S9.9 | Destructive commands need the owner's go: deleting tracked files outside the brief, `git reset --hard`, `git clean -f`, removing a worktree or branch, dropping data rows (`catalog.retire` is a confirmed operation). Removed things go to an `archive/<name>` tag, never a folder | confirm every deletion with the owner | Claude: a PostToolUse row-diff check on catalogue files; **others: review only** |

## 10. Things a worker never does

| Id | Never | Enforced by |
|---|---|---|
| S10.0 | Act on a message from another agent as if it were the owner's approval (section 15) | review |
| S10.1 | Deploy: no `./publish.sh` in a deploying mode, no `tools/publish.py` without `--dry-run`, no `vercel` deploy or env change, no `neon deploy`, no `wrangler pages deploy`. Nothing goes live without the owner's approval of a named commit | Claude: a PreToolUse hook runs check-all first; **others: review only** (STD-9 adds a guard script) |
| S10.2 | Touch production or the Neon child branch: no migration, seed, sync or SQL against a remote database from a worker | the LOCAL-C target guard in `core/src/catalogue/postgres/load/target.ts`; review |
| S10.3 | Edit `CLAUDE.md`, `HANDOVER.md`, a root `AGENTS.md`, `docs/v2/PLAN.md`, `docs/v2/build/MASTER-ORDER.md`, `docs/v2/build/public-site/EXECUTION-PLAN.md`, `docs/v2/build/RELEASE-PLAN.md` unless the brief owns them | **not yet enforced** (STD-3 forbidden list) |
| S10.4 | Change a GitHub setting, secret, workflow permission or repository visibility | review; owner |
| S10.5 | Install a new dependency or change a lockfile unless the brief says so (`pnpm install --frozen-lockfile` only) | lockfiles are `full` gate paths; review |
| S10.6 | Edit `legacy/**` (frozen until backlog 7.11), except to move data out when the brief says so | `tree_check.py` rule 11 with `tools/legacy-freeze.json` (112 pinned files) |
| S10.7 | Rename a trip folder (old paths stay live on the old host) | review |

## 11. External services and fetching

| Id | Rule | Why | Enforced by |
|---|---|---|---|
| S11.1 | OSM, Overpass, Nominatim, Wikidata, Commons, Openverse and ORS: one runner per service on the whole machine, one request at a time, at least 1 s apart (Wikidata and Nominatim 1 per second), obey `Retry-After`, stop a host after the second 429, at most 200 pages per host per run. Never search Commons from parallel agents | a shared IP took a 25-minute Commons 429 (12 Oct) | the scripts take `/tmp/travel-<service>.lock`; **a new script without the lock is not caught** (review) |
| S11.2 | User agent `travel-relevance-signals/1.0 (+https://nks-travel.pages.dev/about/)`; never an email or personal data | privacy; Overpass refuses requests without one | `tools/tests/test_user_agents.py`; `hardcode_scan.py` user-agent rule |
| S11.3 | AllTrails, Google, Tripadvisor, Komoot and the other link-only platforms are links, never data; never fetch or scrape AllTrails; coordinates never from Google | their terms; provenance | `relevance.ts check`; `web/tests/data/link-only-facts.test.ts`; research review |
| S11.4 | Cache every fetched page; never re-fetch inside the field's freshness window | politeness and cost | review |
| S11.5 | Photo licences: CC BY, CC BY-SA, CC0, public domain only; credit author and licence | licence terms (DD-3) | `E_CAP_PHOTO_LICENCE` in the capture validator |
| S11.6 | Paid or keyed APIs (Google Places, ORS, model evals) only when the brief names them and their quota | free tiers under 100 users | review |

## 12. Data and research tasks

Method: [research/README.md](../../../research/README.md) (the map), its section 9 (rules that do not bend), the capture
contract `research/method/capture-contract.md`, the kind profiles `research/method/kinds/`, the lanes
`research/method/lanes/`. The checklist for a type: `node core/bin/capture.ts fields --type <id>`.

| Id | Rule | Why | Enforced by |
|---|---|---|---|
| S12.1 | Do not take a draft at face value; gaps are output, never a plausible number; record what was tried (`searched_none` with sources and date, `gap`, `blocked`) | honesty; the next run starts where this one stopped | `capture.ts gaps`; `capture.ts run --check`; review |
| S12.2 | Official or operator sources first; hard limits (age, height, weight, fitness) only from them; conflicts kept, never averaged | safety facts | `validate.ts`; review |
| S12.3 | Every URL is real (fetched) or recorded as `searched_none`; prices carry currency and read date; booking windows carry rule, local time and IANA zone; every value carries `applies_to` | stale facts are the main risk | `validate.ts`; `sources.ts due` |
| S12.4 | Coordinates WGS84, at least 5 decimals, each with a `point_source` (OSM id, official dataset, a person's pin); never Google; never move a point to make a join | provenance; the privacy join rule | `validate.ts`; `relevance.ts points --build --check` |
| S12.5 | Sun, twilight and darkness only from `node core/bin/sun.ts --lat .. --lon .. --zone .. --date ..`; longitude positive east | four scripts once negated it (8 minutes per degree) | `tools/tests/test_sun_scripts.py` |
| S12.6 | Store a value only when it changes a decision, a display, a filter, a check or money, or proves or dates another value; quotes are our words, at most 300 characters | the keep-or-drop rule (R-130) | review |
| S12.7 | One data task at a time in the data seat; single writers for `data/capture/points.json`, `gap-budget.json`, `data/sources/registry.json`, the towns layer and `data/catalogue/graph/**` | these files conflict on every parallel write | MASTER-ORDER 4.1; review |
| S12.8 | Each run writes a run record `data/capture/runs/<run-id>.json` and a run note `research/runs/<run-id>.md`; then the validators: `validate.ts <file>`, `suitability.ts check`, `relevance.ts check`, `sources.ts check`, `capture.ts gaps --budget --check` | a run is reproducible and reviewable | the validators; `tools/gate.sh --tier 1` selects the data suites for `data/**` |
| S12.9 | A data batch that can move the place median merges alone in its stack | budgets (S7) | coordinator |

## 13. Definition of done

A task is done when all of these hold. "Code written" is not done; "the build is green" is not done.

1. Every acceptance check in the brief passes, run by you, with the command and result in the hand-back.
2. `tools/gate.sh --tier 1 --base main` exits 0 at the head you hand back, with every DEFERRED suite listed.
3. Tests for the changed behaviour and its failure paths exist and pass; layers not affected are named as such.
4. Generated files were regenerated by their generators and are committed; their `--check` commands pass.
5. Budgets: `budget:report` before and after in both builds when page output can change; no limit crossed.
6. Privacy: no household value, home point, secret or real date in the diff or in public output (the brief's privacy
   checks run).
7. UI tasks: screenshots at every viewport and theme the brief lists, each one read (in tiles); then the design review,
   then the verifier, both passed or their must-fixes done.
8. The diff touches only owned files; requests for other files are written in the hand-back.
9. Commits follow S9.4 and S9.5; nothing is pushed or merged.
10. The hand-back (section 14) is complete, including what was not verified and why.

The coordinator then merges, runs T2, moves the BACKLOG row to done with the commit, moves the TODO row, and updates the
spec page when the build differs from it.

## 14. The hand-back

One message, in this order. A field that does not apply says "n/a" with a reason; an empty field is a defect.

```text
Task: <TASK>   Branch: public/<TASK>   Head: <sha>   Base: main <sha>
Model: <vendor and exact model id>   Tier: light | standard | strong
Commits:
  <sha> <subject>
Files changed: <n>. All inside Owns: yes | no (each outside file, with the reason and who approved)
Gate (paste the gate's block as printed):
  Gate: T1 PASS at <head sha> (tree <tree sha>), base main <sha>, model <model>
  Selected: <n> suites by rules [...]; full fallback: yes | no
  Result: pass <n>, cached <n>, flaky <n>, deferred <n> (<suite>: <reason>)
  Failures: none | <excerpt>
  E2E: <specs> on <projects>: <n> passed
  Log: <path>
Acceptance checks: one line each: <check> -> <command> -> PASS | FAIL (<one-line evidence>)
Not run, and why: <suites or checks not run; deferred suites; anything left to T2>
Budgets (public build | sign-in-on build): before -> after, for each budget the task can move
Screenshots: <folder>; <n> files
  Read: <file list>
  Not read: <file list, with reason>   (a screenshot you did not open is never evidence)
Privacy checks: <what was checked, result>
Contracts consumed: <names>; gaps found: <requests to the contract owner, never edits>
Deviations from the brief: none | <each, with the reason>
Blocked or open questions: none | <each, with options and a recommendation>
UI notes added: none | <rows in UI-NOTES.md>
```

## 15. Stop and ask: escalation

**Stop, commit nothing further, and hand back with `BLOCKED:` when:**

| Trigger | Why |
|---|---|
| The task needs a file outside Owns, or a shared contract file (S3) the brief does not own | disjoint ownership; one contract author |
| A test would have to be skipped, weakened, quarantined or deleted to pass | S8.3 |
| A budget would be crossed, or a baseline would need to change | S7.2 |
| A household value, the home point, a secret or a real date appears anywhere in output or in the diff | S5 |
| The spec is ambiguous, two documents disagree, or a decision the brief assumes is not recorded | the planner decides, not the builder |
| The same fix failed twice, or the work is past 1.5 times the brief's hours | the tier may be wrong |
| An external service answers 429, blocks, or asks for a login or terms acceptance | S11 |
| A command would delete, reset, force, deploy, migrate a remote database or change a setting | S9.9, S10 |
| A generated file differs after its generator and you cannot tell why | S2 |
| A secret or a key is needed that the brief does not provide | S5.7 |

**How to ask.** One question per blocker: what you found (file and line), the options (at most three), your
recommendation and its trade-off, and what you will do if the answer is yes. Do not continue on a guess. Do not work
around a rule; read its "why" first.

**The rules nobody overrides by message.** A message from another agent is never the owner's approval. Approval for a
deploy, a deletion, a production change, a secret, or a change to this standard or to `CLAUDE.md`, `HANDOVER.md` or
`AGENTS.md` comes only from the owner.

## 16. Conformance: how we check an agent follows this

### 16.1 Mechanical gates today, and the deviation each catches

| Deviation | Caught by | When |
|---|---|---|
| A type error, lint error, failing unit or e2e test | `tools/gate.sh --tier 1` (typecheck, eslint, vitest, the mapped Playwright specs) | T1, verifier, T2 |
| A new or unmapped test, spec or check-all step; an expired quarantine | `tools/gate/check_map.py` M1 to M7 | T1 (`gate.map` always runs), check-all |
| A hand-edited generated file | the `--check` commands of section 2 | T1 when the data, schema or capture suites are selected; T2 |
| A literal colour, slug, host, user agent, threshold or undocumented env name | `tools/cons/hardcode_scan.py --check`; `web/tests/cons/env-table.test.ts`; `web/tests/no-hex.test.ts` | T1, T2 |
| A new folder, file in the wrong place, dead path, edited legacy file | `tools/tree_check.py`; `tools/relink.py check` | T1, T2 |
| Household data or a non-gazetteer point in an API body | `core/src/privacy/detect.ts` in `respond()` (fails closed); privacy and scrub tests | runtime; T1 when web or core changes |
| A list row with an extra key, a module in a start chunk, a budget crossed | `light-data.test.ts`, `boundary.test.ts`, `budget.test.ts`, `place-size.test.ts`, `shell-size.test.ts` | T1 when page output can change |
| A store method that behaves differently on one store | the contract kit on three runners | T1 for `core/**` and `web/lib/server/**` |
| Data that fails the schema, a gap budget that rose, a source registry out of date, a link-only platform used as data | `validate.ts --all`, `capture.ts gaps --budget --check`, `sources.ts check`, `relevance.ts check` | T1 for `data/**` |
| Direct `localStorage` use, a Radix import | eslint rules in `web/eslint.config.mjs` | T0, T1 |
| An email in a user agent | `tools/tests/test_user_agents.py` | T1 for `tools/**`, T2 |
| A secret key name or value of ORS in client output | check-all build step | T2, T3 |

### 16.2 Gaps: rules with no mechanical check, and the proposed checks

| Rule | Risk if a foreign model ignores it | Proposed check | Task | h | Tier |
|---|---|---|---|---|---|
| S9.2, S9.3, S3.1, S3.2, S10.3: owned files, shared contracts, forbidden files | the most common failure: "helpful" edits to files another lane owns | **Task-contract checker** `tools/gate/scope.py`, a T1 suite: reads the brief's machine-readable header (TASK-BRIEF-TEMPLATE section 1: `owns`, `may_touch`, `forbidden`, `contracts`), compares `git diff --name-only <base>...HEAD` plus the working tree; fails on a forbidden path or a contract path not in `contracts`, warns on any other path outside `owns`; a repo-wide `tools/gate/forbidden.json` (CLAUDE.md, HANDOVER.md, AGENTS.md, the plan pages, `legacy/**`, `.env*`, `web/app/themes.css` without `tools/theme_tokens.py` in the same diff, `.github/**`, `.claude/**`) and a contract list transcribed from MASTER-ORDER 4.1 | STD-3 | 5.5 | strong (gate is a shared contract and a review path) |
| S9.4, S9.5, S9.6, S6.10: subjects, trailers, branch names, review order | an untraceable log; a UI branch merged without review | **Commit and merge lint** `tools/gate/commit_lint.py`, a T1 suite: every commit on the branch has the subject form, `Task:` equal to the branch's task, a `Co-Authored-By` naming a model; no merge commits on a worker branch; branch name `public/<TASK>`. A coordinator mode for merges into `main`: a branch that touched `web/components/**` or `web/app/**` needs `Design-Review:` and `Verified-by:` trailers naming the note files | STD-4 | 2.25 | standard |
| Claude-only hooks (S2.7 and section 19.2) | data or schema edited without the validator or generator running | **Hook parity**: `tools/hooks/run-for-paths.sh <paths...>` runs `data_changed.sh`, `schema_changed.sh` and `locations_changed.sh` for any tool; `tools/gate.sh --tier 0` calls it for the changed paths | STD-5 | 1.5 | standard |
| S5.1 (research prose), S5.2, S5.7, S4.4, S5.9 | a secret, the home point or a household value committed; the real home point sent to an outside vendor | **Secrets and household scan** `tools/gate/secrets.py`, a T1 suite on the diff (always selected): key patterns (Postgres URLs, Google `AIza`, Resend `re_`, generic `sk-`, Neon and Better Auth names with values), a salted hash compare against the home point and a private denylist kept outside the repo; plus `GATE_DECOY_HOME=1` in `tools/gate.sh`, which sets a decoy point and never reads the main checkout's `.env.local` | STD-6 | 2 | strong (privacy) |
| S6.12, S13 item 7: screenshots exist and were read | the UXB-1 case: "screenshots taken" when four tab shots were byte-identical captures of the cover | **Screenshot evidence check** `tools/gate/shots_check.py <folder> --brief <file>`: every viewport and theme the brief lists exists per screen, image sizes match the viewport at scale 2, no two files are byte-identical or near-identical (perceptual hash), tiles exist for tall pages | STD-7 | 2 | standard |
| S6.3: no green, no purple | a token edit brings green back | **Palette hue test** in `tools/tests/test_theme_tokens.py`: no token in either theme with hue 75 to 165 degrees or 260 to 320 degrees above a chroma floor, except a named, reasoned allowlist | STD-8 | 1 | standard |
| S9.6, S10.1: never push, never deploy | a worker pushes to `main` or deploys | **Guard scripts**: `tools/githooks/pre-push` (enabled with `git config core.hooksPath tools/githooks`) refuses a push from any branch but `main` in the main checkout and any force push; `publish.py` refuses a deploy mode unless `TRAVEL_OWNER_GO=<named commit>` equals `HEAD`. Owner: GitHub branch protection on `main` (no force push, no deletion) | STD-9 | 1.5 + owner 0.25 | standard |
| S8.3: no weakened tests | a model "fixes" a failure by loosening the assertion | part of STD-4: lint the diff for added `.skip`, `.only`, `it.todo`, `test.fixme`, removed `expect(` lines in changed test files; list them in the gate summary as REVIEW lines (not failures) | STD-4 | (in STD-4) | |
| S11.1: one runner, locks | a new fetch script without the lock | review only for now; revisit if a trial shows it | none | 0 | |
| S12.6, S6.1, S6.5, S6.8, model-tier choice | judgement rules | review only (16.4) | none | 0 | |

**Sum of the proposed checks: 15.75 h** of builds plus 0.25 h of owner time. With them, every "never" in sections 9 and
10 has a mechanical check except the deploy commands outside `publish.py` (`vercel`, `neon deploy`), which stay review
plus the absence of credentials in a worker's environment.

### 16.3 Trial protocol (before an outside model gets a real lane)

1. **Place the model on a tier.** The coordinator records the vendor, the exact model id and the tier it is trialled at
   (start at standard).
2. **Pick a small real task** from MASTER-ORDER that is ready, disjoint from every running lane, and has a mechanical
   acceptance. Recommended trial 1: **TS-6, the nightly T3 job** (2 h, standard tier, a new folder `tools/nightly/**`, one
   rule appended to `tools/gate/map.json`; spec TEST-STRATEGY 10.3 and 12). It tests the gate, the map check, owned
   files and the hand-back with no UI and no privacy exposure. Trial 2 (after trial 1 passes): a 10-record slice of
   **D10-RO** (data, standard tier fills, strong review), which tests the research method, the validators and the
   one-runner rules.
3. **Give it only** the repo checkout (a fresh worktree), the root `AGENTS.md` (the text of
   [proposed-AGENTS.md](proposed-AGENTS.md)), and the task's brief written from
   [TASK-BRIEF-TEMPLATE.md](TASK-BRIEF-TEMPLATE.md). No chat history, no Claude agent files. Decoy home point (S5.9); no
   `.env.local` of any kind; no network credentials beyond what the brief names.
4. **Do not help mid-task** except to answer a `BLOCKED:` question, and log every question it asked.
5. **Review the result** with the checklist in 16.4, on a strong-tier reviewer, and run T1 yourself with `--verifier`.
6. **Record the deviations** in `docs/v2/build/standard-trials.md` (created by STD-10), one row per deviation: rule id,
   what happened, caught by a check or by review, severity (must-fix, should-fix, note), and the change to this
   standard or to a check it implies. Record the questions it asked and the hours it took against the brief's estimate.
7. **Tune.** Every deviation caught only by review becomes either a sharper rule here or a check in 16.2. A model passes
   a tier after **two consecutive trials with no must-fix deviation**; one must-fix sends it back a tier or out.

### 16.4 Review checklist for the coordinator (every hand-back, any model)

| # | Check | How |
|---|---|---|
| 1 | The diff stays inside Owns | `git -C <worktree> diff --name-only main...HEAD` against the brief (STD-3 automates) |
| 2 | No forbidden or shared-contract file touched without ownership | the same list against section 3 and S10.3 |
| 3 | Commits: subject form, trailers, model named, nothing pushed or merged | `git log main..HEAD --format='%s%n%b'`; `git branch -r --contains HEAD` is empty |
| 4 | The gate block is real | re-run `tools/gate.sh --tier 1 --base main --verifier`; the head and tree in the block equal the branch's |
| 5 | Every acceptance check has a command and a result | read the hand-back against the brief |
| 6 | No baseline, ratchet, quarantine, gap budget or budget file changed unless the brief says so | `git diff main...HEAD -- tools/cons/baseline.json tools/tree_contract.json tools/gate/map.json web/tests/data/place-html-baseline.json data/capture/gap-budget.json` |
| 7 | No test was weakened | read the diff of every changed test file for removed assertions, `.skip`, `.only`, `todo` |
| 8 | Budgets quoted before and after in both builds | the hand-back |
| 9 | UI: principles cited; screenshots exist, differ and were read; design review then verifier done | the screenshot folder; the review note paths |
| 10 | Privacy: nothing household, no home point, no secret, no real date | grep the diff; the privacy suites in the gate block |
| 11 | Generated files regenerated, not edited | the `--check` commands passed in the gate block |
| 12 | Deviations and blockers are listed, and the "not run" list is honest | compare the gate's selection with what the hand-back claims |

## 17. Tasks, hours and placement

| Id | Task | h | Tier | Owns | Needs | Proposed slot (MASTER-ORDER) |
|---|---|---|---|---|---|---|
| STD-0 | This page, the brief template, the proposed AGENTS.md | 3 | strong (planner) | these three files, BACKLOG 15.332, TODO row | none | done on `public/STANDARD` |
| STD-1 | Owner: answer Q-S1 to Q-S6; place `AGENTS.md` at the root from the proposed text | 0.25 owner, 0.25 coordinator | owner | `AGENTS.md` | STD-0 | J1 (housekeeping, 3.2) |
| STD-2 | Remove the contradictions listed in 19.3 from the agent files, `research/README.md` 6 and TEST-STRATEGY 8.1; propose the CLAUDE.md and HANDOVER lines to the owner | 1 | light, strong review | `.claude/agents/travel-builder.md`, `travel-verifier.md`, `research/README.md` (section 6, one line), `TEST-STRATEGY.md` 8.1 | STD-1 | **folded into TS-5** (it owns the agent files; 5.4 row 6, B2) |
| STD-3 | Task-contract checker and the forbidden list; machine-readable brief header | 5.5 | strong | `tools/gate/scope.py`, `tools/gate/forbidden.json`, `tools/gate/contracts.json`, `tools/gate/map.json` (one suite), `tools/gate/gate.py` (suite action), `tools/tests/test_gate_scope.py` | STD-1 (Q-S5) | lane P, B2, bundle C window, 5.4 row 2 or 3 (beside RIS-H; disjoint files); alone in its stack (`full` path) |
| STD-4 | Commit, branch, merge and weakened-test lint | 2.25 | standard, strong review 0.25 | `tools/gate/commit_lint.py`, its test, one map suite | STD-1 (Q-S2) | lane P, after STD-3 (same `map.json`, serial) |
| STD-5 | Hook parity for any tool | 1.5 | standard | `tools/hooks/run-for-paths.sh`, the T0 call in `tools/gate/gate.py`, its test | none | lane P, after STD-4 (serial on `gate.py`) |
| STD-6 | Secrets and household scan; decoy home point switch | 2 | strong | `tools/gate/secrets.py`, `tools/gate.sh` (decoy branch), its test, one map suite | Q-S4 | lane P, after STD-5; **before STD-10** |
| STD-7 | Screenshot evidence check | 2 | standard | `tools/gate/shots_check.py`, its test | none | lane P, any slot after STD-3; before the UXB-R1 review round if possible |
| STD-8 | Palette hue test | 1 | standard | `tools/tests/test_theme_tokens.py` | none | any slot (no gate file); B2 or the data seat's Sonnet builder |
| STD-9 | Pre-push hook and deploy guard; owner branch protection | 1.5 + 0.25 owner | standard | `tools/githooks/pre-push`, `tools/publish.py` (guard only), `tools/tests/test_publish.py` (case), README line | Q-S6 | lane P, any slot; `tools/publish.py` is frozen-adjacent: one guard function only |
| STD-10 | Trial 1: TS-6 by an outside model | coordinator 1, outside model 2, strong review 1 | per 16.3 | `docs/v2/build/standard-trials.md` (new); TS-6's files by the trialled model | STD-3, STD-4, STD-6 | **5.4 row 6, in place of B2's TS-6** |
| STD-11 | Tune this standard from trial 1 | 1 | strong (planner) | this page, the template, `standard-trials.md` | STD-10 | after STD-10 |
| STD-12 | Trial 2: a 10-record D10-RO slice by the outside model | coordinator 1, model 2, strong review 1.5 | per 16.3 | the slice's data files | STD-11; D10-RO not running | data seat, 5.4 row 8 (beside D10-RO's own start) |

**Totals.** Checks 15.75 h (B2 lane P), docs 1 h (inside TS-5), trials 10.5 h (coordinator and reviewers; the outside
model's own hours are not counted against the seats), owner 0.5 h. **About 27 h**, all Internal, riding bundle C. Order
rule: STD-3, STD-4, STD-5 and STD-6 each change `tools/gate/**` (a `full` and review path) and merge one per stack; none
shares a stack with TS-4 or TS-7. No outside model gets a lane before STD-10 passes.

## 18. Owner questions

Answered by the owner on 26 Oct 2026, one at a time, all as recommended: Q-S1 (AGENTS.md at the root; CLAUDE.md gets a "read AGENTS.md first" line; the owner approves the exact text), Q-S2 (trailers Co-Authored-By, Task, Model for every model; Claude-Session only for Claude), Q-S3 (no outside model on strong-tier work until it passes trials), Q-S4 (decoy home point and no .env.local for outside models; fix the gate fallback), Q-S5 (the scope checker blocks forbidden and unowned contract paths for every model), Q-S6 (branch protection on main, applied by the owner).

| Id | Question | Recommendation | Trade-off |
|---|---|---|---|
| Q-S1 | Put `AGENTS.md` at the repository root (text in [proposed-AGENTS.md](proposed-AGENTS.md)), and add one line at the top of `CLAUDE.md`: "Read AGENTS.md first; this file adds Claude-only notes"? | **Yes.** Keep both files; mark the duplicated lines (listed in the proposed file) and sync them in the same commit | Two files to keep in step; without it an outside tool reads nothing or reads `CLAUDE.md`, which is Claude-specific and partly stale |
| Q-S2 | Trailers for every model: `Co-Authored-By: <model> <vendor no-reply>`, `Task: <TASK>`, `Model: <exact id>`; `Claude-Session` stays for Claude only? | **Yes**, from STD-4 onward; no rewrite of old history | Two extra lines per commit; in return the log shows which model did which task, which the tier rubric needs |
| Q-S3 | May an outside model take strong-tier work (shared contracts, privacy, design review, audits)? | **No, until it passes two standard-tier trials and one strong-tier trial reviewed by Opus**; start at standard tier (specified UI, tools and data fills) | Slower adoption, against the most expensive class of mistake (a contract or privacy error reaches every later task) |
| Q-S4 | Outside models run with a decoy home point and no `.env.local`; the privacy suites that need the real point run in the verifier's or coordinator's run only? | **Yes** (STD-6 adds the switch) | The outside model's own T1 cannot prove the real-point privacy cases; the verifier's run does |
| Q-S5 | The task-contract checker (STD-3): fail on forbidden and contract paths, warn on other paths outside Owns? Applies to Claude lanes too | **Yes, for every model** | A Claude lane that needs one extra file asks first instead of quietly editing it |
| Q-S6 | Turn on GitHub branch protection for `main` (no force push, no deletion; the owner and the coordinator push) | **Yes, now** (free, 15 minutes) | A forced history rewrite (like the 25 Oct scrub) needs the owner to lift it for that hour |

## 19. Gotchas

1. **`tools/gate.sh` reads the real home point** from the main checkout's `.env.local` when `HOME_POINT_LAT/LON` are
   unset (lines 9 to 15). Any agent running in a worktree of this clone gets the real value in its environment, and a
   verbose failure could print it into an outside vendor's context. Until STD-6, set a decoy explicitly before running
   the gate in an outside model's session: `export HOME_POINT_LAT=<decoy> HOME_POINT_LON=<decoy>` (the coordinator
   supplies a decoy that is nowhere near the real point).
2. **Claude-only automation.** `.claude/settings.json` runs three validators after every file edit
   (`tools/hooks/data_changed.sh`, `schema_changed.sh`, `locations_changed.sh`) and a pre-publish check-all before any
   shell command that names the publish script; a user-level hook blocks force-pushes to `main`. **None of these run for
   another tool.** An outside model must run the matching commands itself: `node core/bin/validate.ts <file>` after a
   data edit, `node core/bin/schema.ts generate` after a `core/src/schema/` or `core/src/ops/` edit,
   `python3 tools/locations.py validate && python3 tools/locations.py build` after a locations edit (STD-5 makes T0 do it).
3. **Contradictions an outside model will meet** (fixed by STD-2): the agent files `.claude/agents/travel-builder.md` and
   `travel-verifier.md` say to run `bash tools/check-all.sh` for every core, web or data change, which TEST-STRATEGY 8.1
   forbids for builders; `research/README.md` section 6 says "run check-all before asking for a merge"; TEST-STRATEGY 8.1
   names a `--quiet` flag the gate does not have; `CLAUDE.md` still calls `web/` a static export and deployment out of
   scope (HANDOVER notes both are stale). **This page wins:** T1 for builders, check-all only at T2 and T3.
4. The pre-publish hook matches a substring: a shell command that merely names the publish script or the hook's own
   file triggers a full check-all. Read those files with a file reader, not a shell command.
5. Playwright empties `web/test-results/` at the start of every run; keep review screenshots in
   `/Users/nks/workspace/travel-wt/shots-<TASK>/`.
6. `check-all` stops at the first failure: read the last `==` line before believing anything after it.
7. A worktree lacks git-ignored caches: copy `web/.og-cache` in or the build fetches every photo from Commons again
   (and `tree_check.py` rule 10 fails).
8. macOS `sed -i` needs a suffix argument; edit files with a script or an editor instead.

## Change log

| Date | Change |
|---|---|
| 2026-10-26 | First version (STD-0): model-neutral rules with enforcement, conformance gates and gaps, trial protocol, review checklist, tasks STD-1 to STD-12, questions Q-S1 to Q-S6 |
