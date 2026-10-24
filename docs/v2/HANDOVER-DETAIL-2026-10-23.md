# Handover detail (23 Oct 2026)

The long tables behind [/HANDOVER.md](../../HANDOVER.md). Read that file first. Everything here was checked against the repo at `main` 2d6e4b5 on 23 Oct 2026, evening. Where a plan page says otherwise, this file and `git log` win until a docs lane updates the plan pages.

## 1. The gate and the generators

**What `bash tools/check-all.sh` runs, in order.** It stops at the first failure.

| # | Step | Command |
|---|---|---|
| 1 | python tests | `python3 -m pytest tools/tests -q` (needs the venv on `PATH`) |
| 2 | locations validate, build check | `python3 tools/locations.py validate`, `build --check` |
| 3 | core tests, typecheck | `pnpm --dir core test`, `typecheck` |
| 4 | MCP server answers, ops list | `node core/bin/mcp.ts --root .`, `node core/bin/ops.ts --list` |
| 5 | generated schema | `node core/bin/schema.ts generate --check` |
| 6 | capture contract, gap budget | `node core/bin/capture.ts build --check`, `gaps --budget --check` |
| 7 | towns layer, nearest town | `python3 tools/towns.py --check`, `node core/bin/capture.ts derive-near --check` |
| 8 | every data file | `node core/bin/validate.ts --all` |
| 9 | search vocabulary | `node web/scripts/search-vocab.mjs --check` |
| 10 | suitability scope manifest | `pnpm --dir web exec vitest run -c ../tools/suitability-scope/vitest.config.mts`, then a `git diff` of `data/suitability/scope.json` |
| 11 | suitability, relevance, sources | `node core/bin/suitability.ts check`; `relevance.ts check`, `derive --check`; `sources.ts check` |
| 12 | prototype snapshot | `pnpm --dir web snapshot:check` |
| 13 | hard-coding ratchet | `python3 tools/cons/hardcode_scan.py --check` |
| 14 | folder contract | `python3 tools/tree_check.py` |
| 15 | web typecheck, lint, build, test | `pnpm --dir web typecheck`, `lint`, `build` (fails on an `Error:` line, or on the ORS key name or value in `.next/static`), then `SKIP_WEB_BUILD=1 pnpm --dir web test` |
| 16 | server answers | `next start` on a free port: `GET /` 200, `/api/v1/health/` with a 64-hex revision, `/api/v1/openapi.json` 200; the server is killed by PID |
| 17 | OpenAPI, slugs | `node core/bin/openapi.ts --check`, `node core/bin/slugs.ts --check` |

**Generators.** Never hand-edit what they write. Run the generator and commit its output.

| Output | Generator |
|---|---|
| `data/locations/WISHLIST.md`, `legacy/locations/index.html`, `legacy/globe/assets/data/places.json` | `python3 tools/locations.py build` (a PostToolUse hook also runs it on every store write) |
| `data/schema/generated/**` | `node core/bin/schema.ts generate` |
| `data/schema/capture/*`, `data/schema/suitability-applicability.json`, `research/types/**` | `node core/bin/capture.ts build` |
| `data/schema/generated/openapi.json` | `node core/bin/openapi.ts` (after a rebase, regenerate it; never merge it by hand) |
| `data/sources/registry.json` | `node core/bin/sources.ts build` (`build --check` only compares) |
| `data/suitability/<trip>/migrated.json` | `node core/bin/suitability.ts migrate --write` |
| `data/relevance/derived/<trip>.json` | `node core/bin/relevance.ts derive --write` |
| `data/suitability/scope.json` | the scope vitest run in step 10 |
| `web/data-snapshots/`, `web/redirects.json` | `pnpm --dir web snapshot` (from `data/seed/prototype/`) |
| search `vocab.json` | `node web/scripts/search-vocab.mjs` |
| `web/app/themes.css` | `python3 tools/theme_tokens.py` |
| `data/catalogue/slugs.json`, `data/locations/page-keys.json` | `node core/bin/slugs.ts build` (and `rename`, `alias`, `merge`, `withdraw`, `reorigin`) |
| `data/reference/towns/**` and its `manifest.json` | `python3 tools/towns.py build` (GeoNames dump only, verbatim) |
| `near_town` on capture records | `node core/bin/capture.ts derive-near --write` |
| `data/schedules/legs/*.json` (`trip-legs/2`) | `node web/scripts/legs-ors.mjs` (ORS, sequential, the key read from the environment; `--check` and `--list` need no network) |
| `web/public/img`, `og` | `node web/scripts/images.mjs`, `og.mjs` (run by `pnpm --dir web build`) |

## 2. Traps, with symptom and fix

| Trap | Symptom | Fix |
|---|---|---|
| User-level Bash guard (`~/.claude/hooks/bash-guard.sh`) | "Blocked: force-push to main/master" on a line where `git push` is followed by `--force` or ` -f` and the line names main or master, for example a push chained with `git worktree remove --force` | Push on its own line. Remove worktrees in a separate command |
| Repo pre-publish hook (`tools/hooks/prepublish.sh`) | A Bash command that names the publish script, `tools/publish.py` (without `--dry-run`) or a Pages deploy starts the full check-all, then blocks if it fails. With the env file in place, it fails. The match is a substring, so even naming the hook's own file in a command (an `ls` of `tools/hooks/`) triggers it (seen 23 Oct) | Do not type those words in shell commands, not even inside a longer file name. Read the files with the Read and Grep tools. Deployment is out of scope anyway |
| `git reset --hard`, `git clean -f` | The guard asks for confirmation | Avoid both. Confirm every deletion with the owner |
| macOS `sed -i` | "invalid command code" or a stray backup file | Use python or the Edit tool |
| Playwright empties `web/test-results/` at the start of every run | Screenshots taken by a reviewer or another lane vanish (the TRP2b review lost its whole set) | Write shots outside `web/test-results/`, for example a session scratchpad. Never review while an e2e runs |
| Next rewrites `web/tsconfig.json` on every fixture build (`build:fixture`, `.fixture-*` dist dirs) | An unexplained `tsconfig.json` diff after a test run | Commit its `include` lines for the new fixture and add the dist dir to `exclude` (2d6e4b5) |
| A new worktree has no git-ignored caches | `tree_check.py` rule 10 fails ("names web/.og-cache, which does not exist"); the build fetches photos from Commons again | `cp -R /Users/nks/workspace/travel/web/.og-cache <worktree>/web/` and run `pnpm install --frozen-lockfile` at the worktree root |
| The e2e builds once, then runs `next start` | Two e2e runs or a check-all in the same `web/` corrupt `.next` | One `next build` per dist dir at a time. Use `SKIP_WEB_BUILD=1` after a check-all, or `PW_REUSE_SITE=1` with `PW_SITE_URL` to reuse a running server |
| `web/.env.local` present during check-all | Map family tests fail, because `pnpm build` inlines `google-js` | Move it aside (keep mode 600) and restore it afterwards. The e2e pins its own build env in `web/tests/e2e/global-setup.ts`, but move it aside there as well, by habit |
| `check-all` stops at the first failure | A report of "lint fails" says nothing about the build or the tests | Read the last `==` line. Rerun after the fix; do not assume later steps passed |
| Suitability migration reads the locations store's `updated` date | `suitability.ts check` or step 11 fails after a `location` skill run | `node core/bin/suitability.ts migrate --write`, then commit |
| Points added in a new area | `derive-near --check` fails, or `near_town` is null | `python3 tools/towns.py build` (downloads two GeoNames files if not cached), then `node core/bin/capture.ts derive-near --write` |
| The `location` skill | The hook rebuilds the views, but the suitability migration is stale | Always follow it with the migrate step above |
| ResizeObserver on WebKit | "ResizeObserver loop completed with undelivered notifications" fails WebKit specs | Defer the observer callback to the next frame, as FIXE did in the trip map |
| Async counts re-render menus | A menu loses focus or closes when counts arrive from `/api/v1` (the Where menu bug, FIXE) | Keep stable keys; update counts in place, never remount the menu |
| Free text has one rule | Server and browser counts differ ("lake": 20 against 22 before HYG) | Only `core/src/query/text.ts` (A16) and `core/src/search/bm25.ts` (A28). Never re-implement them in `web/` |
| Commons is never hotlinked | A raw `upload.wikimedia.org` URL in output | Images go through renditions (`web/scripts/images.mjs`, `.generated/image-map.json`) and the rewrite in `web/lib/server/images.ts`. HYG logs once when the map is missing |
| GPU in Playwright | Motion judged on SwiftShader looks broken (about 35 times slower) | `GPU_ARGS` in `web/playwright.config.ts` use `--use-angle=metal` on macOS. Check the WebGL renderer string |
| Firefox | "Could not find profile folder" | It is opt-in with `PW_FIREFOX=1`; leave it off on this Mac |
| `flock` is missing on macOS | External-call locks fail | `towns.py` uses a mkdir lock. Other runners need a script lock or must run strictly one at a time |
| Google key referrers | A grey map on a new preview port | Add the origin in the console (Q89, Q-D) |
| `NEXT_PUBLIC_*` inlined at build | A build with the env file and one without it differ | Never pixel-compare the two kinds |
| Two Map ID variables | Wiring `NEXT_PUBLIC_GOOGLE_MAPS_MAPID` does nothing | Only `NEXT_PUBLIC_GOOGLE_MAP_ID` is used. The other goes at readiness item 7 |
| `git add` with one bad pathspec | Nothing is staged and the commit misses files | Check each path exists; stage owned paths explicitly with `git -C <abs> add` |
| Killing servers by name | `pkill -f next` killed other agents' and other projects' servers (`meal-plan` runs here) | `lsof -nP -iTCP:<port> -sTCP:LISTEN`, then `kill <pid>`. For a `pnpm exec next start`, the listening PID is the `next-server` child, not pnpm |
| Store decisions A29 to A40 | `store.ts` cites A30, A33, A34, A36 and A39, but their text is gone (deleted by HYG 48dca1d) | Restore from `git show dbbdeae:core/src/catalogue/store.ts` (lines 151 on) in an API-3 follow-up |
| Branch names already taken | `git worktree add -b` fails | Use the names in PHASE-E-START section 2 (`public/PLC2b-E`, `public/DATA-D1`, and so on) |
| GeoNames admin1 codes | Ontario is `08`, not `ON` | Town ids are `<cc>-<admin1 slug>-<slug>` (`ca-on-whitby`) through `tools/towns_admin1.json` |
| Renaming a legacy folder | The old path stays live on Cloudflare Pages | `legacy/` is frozen. At 7.11, delete the old paths in the Pages dashboard if it matters |

## 3. Services: recreate and stop

**M1 trip-map preview on 3476** (down: its PID 4796 is gone and nothing listens on 3476). Rebuild it after TRP2b2 merges, so the owner sees routed legs:

```bash
git -C /Users/nks/workspace/travel-wt/v2-M1 merge --ff-only main      # public/M1 is an ancestor of main
cd /Users/nks/workspace/travel-wt/v2-M1 && pnpm install --frozen-lockfile
cp -R /Users/nks/workspace/travel/web/.og-cache web/                   # its own copy is empty
pnpm --dir web build                                                   # web/.env.local is in place here: Google family
cd web && nohup pnpm exec next start -p 3476 -H 127.0.0.1 > <scratch>/m1-server.log 2>&1 &
lsof -nP -iTCP:3476 -sTCP:LISTEN                                       # record this PID (the next-server child)
grep -rqF "ORS_API_KEY" .next/static && echo FOUND || echo clean        # the key name must not reach client chunks
```

Then shoot `/trips/canadian-rockies-2029/` days 8 and 9 and `/trips/dolomites-2027/` day 3 at 1440 and 390, light and dark, into a folder outside `web/test-results/`.

**Preview 2 for R2 on 3488.** Build in the main checkout at the R2 commit, with the env file in place. Serve it like M1 on port 3488. The key's referrer list must include 3488.

**Preview 1 on 3440.** `python3 -m http.server 3440 --bind 127.0.0.1 --directory /Users/nks/workspace/travel/web/out`. It serves the frozen phase A export. Retire it when R1 closes, by PID, with the owner's go.

**Tunnel.** `cloudflared tunnel --no-autoupdate --url http://127.0.0.1:<port>`. It needs the owner's go each time. The URL is in its output and changes on every start.

## 4. Lanes left in phase E, and the calendar

Effort in agent-hours from PHASE-E-START section 10. Owned files in short; the brief is the authority. Worktrees are `/Users/nks/workspace/travel-wt/v2-<lane>` on branch `public/<lane>` unless the start sheet names another branch.

| Lane | Agent and model | Depends on | Owns (short) | Effort | Port |
|---|---|---|---|---|---|
| TRP2b2 (in progress) | `travel-builder`, Sonnet; then `travel-design-reviewer`, Opus | TRP2b merged (done) | TRP2 brief files: `web/components/trips/**`, `web/components/map/**`, `web/lib/map/**` except `links.ts`, `data/schedules/**`, `web/scripts/legs-ors.mjs`, the `/about/data` credit | about 4 + 1 Opus re-review with a fresh shot set | own |
| Restore A29 to A40 | `travel-builder`, Sonnet (mechanical) | none | `core/src/catalogue/store.ts`, comment text only | 0.5 | none |
| LST2b, Where at city level, Trips by province | `travel-builder`, Sonnet; Opus review | META-2, API-3 (done) | LST2 part b: `web/components/entity/**`, `core/src/query/**` (city facet), `core/src/catalogue/json/places-city.ts`, `web/app/list/places/**`; R-12 (unchecked rows in one capped request) | 11 + 1 | 3481 |
| CONS-3, palette, UA and endpoints, host rule | `travel-builder`, Sonnet | TRP2b2 merged (palette, legs UA line); before GLB2b | `web/lib/map/palette.ts`, `web/lib/globe/palette.ts`, `core/src/net/**` (new), `tools/net.py`, UA lines in `web/scripts/*.mjs`, `places.ts` line 370 area; slug-table step deferred with TD | 6 | 3486 |
| D1, points | `travel-researcher`, Opus; Haiku checks; Sonnet verify | META-1 (done) | `data/capture/points.json`, `data/capture/<trip>/*`, `research/runs/DATA-*`, gap budget (lower only) | 7 | none |
| PLC2b, Around here (E9), In the same park, Where it happens | `travel-builder`, Sonnet; Opus review | D1, API-3 | `core/src/nearby/**` (new), `core/src/catalogue/json/nearby.ts`, `web/components/places/sections/Nearby.tsx`, the `nearbyForPlace` pending entries | 9 + 1 | 3482 |
| D6a, seasons for 6 trips | `travel-researcher`, Opus | none | trip season data, lane notes | 2 | none |
| LST2c, near mode, NearChip, towns strip | `travel-builder`, Sonnet; Opus review | LST2b, PLC2b | `core/src/catalogue/json/near.ts`, `core/src/parse/**` (near rule), `NearChip.tsx`, `PlacesMap.tsx`, the `near` pending entries | 8 + 1 | 3483 |
| D3a, trail facts (Rockies trails and the five R2 trails) | `travel-researcher`, Opus | META-0 (done) | `data/capture/<trip>/TF.json`, suitability TF | 6 | none |
| GLB2b, city outlines and the home globe look | `travel-builder`, Sonnet; Opus ruling and review | META-2 (done), CONS-3, the owner's mock approval | `web/components/globe/**`, `web/lib/globe/**`, `web/app/globe*/**`, `tools/globe_data.py`, `web/scripts/globe-*.mjs`, `data/reference/globe/**`. A served outline must be the gazetteer outline exactly (R-4) | 23 | 3484 |
| MX, ORS nearby and hub matrices | `travel-builder`, Sonnet | PLC2b, LST2c | `web/scripts/nearby-ors.mjs` (new), `data/outings/**`, the routed read in `core/src/nearby/`, one `--check` line in check-all | 5 | 3485 |
| D4a, activities for the R2 bar | `travel-researcher`, Opus | D1 | `data/capture/<trip>/AC.json`, `operators.json` | 4.5 | none |
| D5a, photos for the R2 bar | `travel-researcher`, Opus (contact sheets need judgement) | D1; no other agent on Commons | `data/capture/<trip>/PH.json` | 3.5 | none |
| E15, R2 entry | coordinator, `travel-verifier` Sonnet; Opus audits 5.2 and 5.5 | everything above | `verify-R2.md`, audits | 15.5 | 3488 |

**Calendar from today.** Two seats, never more than two lanes at once.

| Date | Seat A | Seat B | Owner |
|---|---|---|---|
| Sat 24 Oct | TRP2b2 verify and merge; then LST2b | restore A29 to A40; CONS-3 | Google console steps (Q-A, Q89, Q-D); the mock approval |
| Sun 25 Oct (reset) | LST2b; TRP2b2 Opus re-review | D1 (Opus) | |
| Mon 26 Oct | LST2b review and merge; D6a | D1 merge; PLC2b | M1 rebuilt: a 10-minute look at routed legs |
| Tue 27 Oct | D3a | PLC2b review and merge | |
| Wed 28 Oct | LST2c | GLB2b (outlines only if the mock is not approved) | |
| Thu 29 Oct | LST2c merge; MX | GLB2b | |
| Fri 30 Oct | MX merge; D4a | GLB2b | |
| Sat 31 Oct | D5a | GLB2b review and merge | |
| Sun 1 Nov (reset) | E15 merge check; quiet full e2e | (quiet) | |
| Mon 2 Nov | stage 5 run 2, sweep | Opus audits 5.2 and 5.5 | |
| **Tue 3 Nov** | preview 2 on 3488; hand-over | | **R2 opens (about 60 minutes)** |
| Wed 4 to Thu 5 Nov | `FIX-R2-*` rounds | | rulings Q88, Q90; approval Q43 of a named commit |

Thu 5 Nov stays the committed R2 date. The two days are slack for R1 or M1 fix rounds, which go first and move these dates by their own length.

**Data research: the minimum set for R2** (PHASE-E-START section 9, about 20 h Opus):

| Need | Lane |
|---|---|
| A point or a dated search on every page; at most 10 trails without a point; `E_PLACE_FAR` 0 | D1 |
| `near_town` on every exact point | done (META-2: `W_PLACE_TOWN` 259 to 0) |
| Every offer says where it happens (17 do not), plus the Rockies offers on the plan's days | D4a |
| Five trails with photo, facts or dated gaps, and a map: `fenland-loop`, `johnston-canyon-walk`, `larch-valley`, `tre-cime-di-lavaredo-loop`, `lake-agnes-tea-house`, plus the Rockies trails on the plan's days | D3a (facts), D5a (photos) |
| No trip shows "season not set yet" | D6a |

After R2: D2 (74 locations), the rest of D3 to D6 (about 24 h Opus).

## 5. Readiness checklist (phase D, hosting-agnostic)

From EXECUTION-PLAN 13.1 and the BACKLOG go-live rows. Nothing here deploys.

| # | Item | Rows | Who |
|---|---|---|---|
| 1 | Owner approval of a named commit at R2 exit | Q43 | owner |
| 2 | Privacy audit: 0 household strings in HTML and API output; towns exactly as the gazetteer; nothing within 2 km of home except public town rows | 5.2, A33 | Opus auditor |
| 3 | Redirects: every old legacy URL (461) maps to its new page, 302 for 7 days, then 301; the map is data in `web/redirects.json` | 7.1, 7.10, Q45 | coordinator |
| 4 | Robots: allow search engines, disallow AI crawlers by name (`web/app/robots.ts`) | 7.6 | coordinator |
| 5 | Sitemap: every URL answers 200; `/specimen` removed; unknown globe levels not prerendered | 2.42, 7.8, 15.20 | coordinator |
| 6 | Cache policy as data: ETag and `Cache-Control` per API path; long cache for hashed images | 2.46 | coordinator |
| 7 | Google key restricted to named referrers and the Maps JavaScript API; a daily quota; Map ID restyled (POIs off, no green); `NEXT_PUBLIC_GOOGLE_MAPS_MAPID` removed | 7.2, 7.3, Q48, 15.25, Q-A, Q-D | owner (console), coordinator (env) |
| 8 | Secrets: the ORS key never in client bundles or API responses; no key in the repo; root `.env` mode 600 | 5.5 | coordinator |
| 9 | Lighthouse on the preview, numbers recorded and re-judged on the real host | 2.47 | travel-verifier |
| 10 | Exports stay per item and public until sign-in | 7.9, Q46 | coordinator |
| 11 | Metadata report and hard-coding baseline unchanged from the approved commit | 13.5, 13.2 | coordinator |
| 12 | Rate limit planned for `/api/v1/*` and the JSON fallback routes (applied with the host) | 15.22, 7.6 | travel-planner |
| 13 | Docs updated for the single product | 7.11 | coordinator |
| 14 | Last step: create `nitin27may/travel-feedback` (issues only, form `report.yml` with the page path prefilled), then set `reportUrl` in `web/lib/config/product.ts`, a one-line switch | Q70 | owner's go, coordinator |

With the host (EXECUTION-PLAN 13.2): the deploy command, preview environments, the domain (Q71), edge protection and the rate limit, how the redirect map and cache policy are expressed, the key's host list, the 302-to-301 date, rollback, and the fate of `tools/publish.py` and `nks-travel.pages.dev`.

## 6. SRV-0: Supabase as a store swap

**Plan.** Run `supabase start` locally (Docker), never against a remote. Create migrations with `supabase migration new`, from `research/reports/schema-diff-2026-10.md`. Turn RLS on for every table before any code touches it, with public read policies for the catalogue only. Add a loader, `core/bin/load-catalogue.ts`, that loads `data/**` unchanged, and `SupabaseStore` in `core/src/catalogue/supabase/**`. Generate types with `supabase gen types typescript`. Add a `supabase` target to the contract kit; `core/test/catalogue/supabase.test.ts` is skipped unless a local Supabase is up. Flags stay off. About 24 h. It is off the R2 critical path. The switch-over runbook is EXECUTION-PLAN 14.2: a per-method router, `CATALOGUE_STORE=supabase`.

**Parity requirements the reviews wrote.** SupabaseStore must satisfy all of these.

| Requirement | Source |
|---|---|
| Two tiers: lossless source docs keyed by `ref`, plus a serving tier written by the same core code as JsonStore | Q73 |
| `entity.id` is the `ref` verbatim. Collections and Instagram saves are private: RLS on, no policy, not loaded. Town ids are `<cc>-<admin1>-<slug>` | Q74, Q75, Q76 |
| `data/locations/page-keys.json` is never loaded into a public table | A24 |
| Data and `catalogue_meta` are read in one SQL function or one REPEATABLE READ transaction. The loader swaps the projections and the revision in one transaction | A8b |
| A `TRAVEL_BUILD_ID` override, and a production error on the `dev` build id | R-10, 15.40 |
| `catalogue_meta.data_revision`; revision = SHA-256 of the app build id and the data revision | R-11, 15.40 |
| Runtime output validation of every response | GB-A-11, 15.23 |
| Free text: the loader writes the lower-cased haystack in a column, SQL prefilters with escaped `ILIKE ALL`, and core confirms with `matchesFreeText` | A16, K28 |
| Counts and "Not checked yet" rows: the loader stores the facet values and gap flags that core computes per row; SQL counts them and orders with the A15 rule | A15, A25, A27, K22, K23 |
| Card search: the loader writes postings (term, ref, tf), card lengths and per-country totals; SQL returns postings and core scores them with `searchTexts`, rounded to 6 decimals | A28, K24.order |
| Distance: SQL may only prefilter; core computes and rounds | A17 |
| Scrub before load; `respond()`'s detector unchanged | A18 |
| Towns loaded verbatim from the GeoNames-derived files, checked against the manifest | A33, R-4 |
| Every method async; every cap inside the method | A9, A1 |
| The contract kit green on the `supabase` target with 0 pending | EXECUTION-PLAN 4.6 |

## 7. Index of documents

| Document | The authority for | State |
|---|---|---|
| [/HANDOVER.md](../../HANDOVER.md) and this file | Current state, setup, rules, traps, services, plan forward, open decisions | current (23 Oct, evening) |
| [PLAN.md](PLAN.md) | Requirements R-1 to R-57, phases, rules that do not bend, open decisions, superseded statements | current in rules; status lags `main` |
| [TODO.md](TODO.md) | Owner requests, Open and Done | lags `main` by four merges |
| [build/public-site/PHASE-E-START.md](build/public-site/PHASE-E-START.md) | Phase E order, models, collisions E1 to E21, decisions D-E1 to D-E12, cases K20 to K28, R2 entry, the minimum data set | current; D-E3 superseded by A33 |
| [build/public-site/PHASE-B-START.md](build/public-site/PHASE-B-START.md) | Phase B record: slug rule, refs, sort key, contract cases K1 to K19 | history; decisions still in force |
| [build/public-site/EXECUTION-PLAN.md](build/public-site/EXECUTION-PLAN.md) | API shape (4), CONS (5), META tiers (6), gates R1, G-B and R2 (8, 9, 11), readiness (13), data order and switch-over (14) | current where PHASE-E-START does not amend it |
| [build/public-site/BACKLOG.md](build/public-site/BACKLOG.md) | Every finding and owner question with status and commit | rows 15.34 to 15.39 lag `main` |
| [build/public-site/STATUS.md](build/public-site/STATUS.md) | Merged-lane record and decisions in force | top paragraph lags `main`; older sections are history |
| [build/public-site/COVERAGE.md](build/public-site/COVERAGE.md) | Every pending item from 20 Oct mapped to a task | current as a map |
| [build/public-site/briefs/](build/public-site/briefs/) | One brief per lane, with owned files and acceptance | current for E lanes (revised 23 Oct) |
| [build/public-site/review-API3-2026-10-23.md](build/public-site/review-API3-2026-10-23.md) | Review items R-1 to R-18 of the phase E contract | current; R-7, R-8 done in HYG |
| [build/public-site/audit-GB-output.md](build/public-site/audit-GB-output.md), [verify-GB.md](build/public-site/verify-GB.md), [review-API1a-contract.md](build/public-site/review-API1a-contract.md) | Gate G-B audits and the API-1a review | history; open rows in BACKLOG 15.20 to 15.31 |
| [build/public-site/R1-HANDOVER.md](build/public-site/R1-HANDOVER.md), [verify-R1.md](build/public-site/verify-R1.md), [audit-R1-output.md](build/public-site/audit-R1-output.md) | Review R1 script and its checks | current while R1 is open |
| [design/trip-page/google-map-note.md](design/trip-page/google-map-note.md) | The trip map design, the Map ID console steps (2.2), Q-A to Q-D | current |
| [design/trip-page/review-trp2a-2026-10-23.md](design/trip-page/review-trp2a-2026-10-23.md), [review-trp2b-2026-10-23.md](design/trip-page/review-trp2b-2026-10-23.md) | TRP2a and TRP2b design reviews; the TRP2b2 must list | current |
| [design/foundation/principles.md](design/foundation/principles.md) | P1 to P9, T1 to T5 | current |
| [design/product-direction-2026-10-18.md](design/product-direction-2026-10-18.md), [design/keep-from-live-site.md](design/keep-from-live-site.md), [design/trip-scope-scenarios.md](design/trip-scope-scenarios.md) | Product order, what to keep, scenario rules | current |
| [features/nearby-and-regions.md](features/nearby-and-regions.md) | Where filter, nearby, near mode, the towns rule (2.4, 5.6) | current |
| [SKILLS-AND-DATA-ONLY.md](SKILLS-AND-DATA-ONLY.md) | Skills home, no new HTML, trip-as-data gaps, TD-0 to TD-6 | current |
| [CLEANUP-PLAN.md](CLEANUP-PLAN.md) | Folder contract, CLN-1 to CLN-7, decisions D1 to D22 | current; CLN-6 pending |
| [build/SERVER-SIDE-LAUNDRY-LIST.md](build/SERVER-SIDE-LAUNDRY-LIST.md) | Everything that needs login or a backend; Q65 to Q69 | current |
| [/research/README.md](../../research/README.md) | The research system: jobs, per-type checklists, formats, validators, the rules | current |
| [/data/trips/README.md](../../data/trips/README.md) | The trip data contract, the ops sequence, what the web app reads | current |
| `core/src/catalogue/store.ts` | Store decisions A1 to A28 and the open review items | A29 to A40 text missing (section 2) |
| [build/handover/memory/](build/handover/memory/) | The owner's working rules, with reasons | history; PLAN wins |
| `.claude/agents/`, `.claude/skills/` | Agent models and the three skills | current |
