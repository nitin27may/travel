# Handover: pick this up on another machine

Written 20 Oct 2026; updated 21 Oct. **Read `docs/v2/PLAN.md` first: it is the single plan (requirements, order, status, the first 10 tasks, open decisions).** This file covers setup. For task detail read `docs/v2/build/public-site/EXECUTION-PLAN.md` (the sequenced plan: UI fixes, review R1, API-over-JSON, features, review R2, readiness; rewritten 20 Oct) and `COVERAGE.md` (every pending item mapped), then `STATUS.md` and `MASTER-PLAN.md` in the same folder. Everything needed to continue is in this repository except the secrets and a few caches listed in section 4.

## 1. State in one paragraph

The new public site (no login: search, globe, trips, places) is built and is **`main`**. The old hand-built site is preserved at the git tag `legacy-final` (commit `74b97ad`). The live site at https://nks-travel.pages.dev/ is **still the old site**: nothing from this work has been published, and nothing may be until the owner approves after reviewing the preview. All build lanes are merged. What is left, in the owner's order of 20 Oct: phase A fixes every UI issue (his reports plus every visible defect in `COVERAGE.md`), then his review R1; phase B builds API-over-JSON (route handlers under `web/app/api/v1/` over a `CatalogueStore` with a `JsonStore`, shared Zod contracts, OpenAPI) and removes the static export; phase E builds nearby, the Where city level, towns, the Google trip map, exports and the data passes on the API; his review R2; then a hosting-agnostic readiness checklist. **Deployment is out of scope until the hosting is chosen.** API-over-Supabase (SRV-0) is defined for after E, local only. A second list holds everything that needs login or a server.

## 2. What to read, in this order

| Order | File | Why |
|---|---|---|
| 0 | `docs/v2/PLAN.md` | **The single entry point (21 Oct):** owner requirements R-1 to R-52, phases and status, the first 10 tasks, open decisions, and which document is the authority for what |
| 1 | `HANDOVER.md` (this file) | Setup, commands, rules, what is not in git |
| 1b | `docs/v2/build/public-site/EXECUTION-PLAN.md`, `COVERAGE.md` and `briefs/` (TST, FIXF, SHL2, GLB2, TRP1, LST2, PLC2, SRV, API, CONS, META, DATA, TRP2, MX, GO-LIVE as readiness) | The agreed order of work, the API layer, tasks, owned files, review gates, readiness checklist, and every pending item mapped. Open owner questions: EXECUTION-PLAN section 18 |
| 2 | `docs/v2/build/public-site/STATUS.md` | The coordinator's live handover: merged lanes, decisions in force, services |
| 3 | `docs/v2/build/public-site/MASTER-PLAN.md` | Every pending public-site item, by phase, with links to its plan (no longer the entry point; PLAN.md is) |
| 4 | `docs/v2/build/public-site/BACKLOG.md` | Every finding with an ID, status and commit; the owner questions table (Q1 to Q72) |
| 5 | `docs/v2/build/public-site/OWNER-ROUND1-plan.md` | The fix plan for everything the owner reported while testing |
| 6 | `docs/v2/build/public-site/REPORT-2026-10-20.md` | The status report and merge timing |
| 7 | `docs/v2/build/public-site/STAGE4-plan.md` | Stage 4 record; its stage 5 to 7 parts are superseded by the execution plan |
| 8 | `docs/v2/features/nearby-and-regions.md` | Where filter (country, state, city), nearby places, the location data rule, the smart trip builder |
| 9 | `docs/v2/build/SERVER-SIDE-LAUNDRY-LIST.md` | The second list: everything that needs login or a backend |
| 10 | `docs/v2/design/foundation/principles.md` | The UX principles P1 to P9 and T1 to T5 |
| 11 | `docs/v2/build/handover/memory/` | The owner's working memory notes (decisions and rules, with reasons) |

Also: `CLAUDE.md` (repo rules and the agents table), `docs/v2/TODO.md`, `research/method/capture-contract.md` (the one data contract), `README.md`.

## 3. Set up a new machine

```bash
git clone https://github.com/nitin27may/travel.git      # private; needs your GitHub login
cd travel && git checkout main
git tag -l legacy-final                                   # the old site, kept
# tools: node 22, pnpm, python 3.12 or newer, git; optional: cloudflared, wrangler (npx)
(cd core && pnpm install) ; (cd web && pnpm install)
python3 -m pip install pytest                             # the python tests
(cd web && pnpm exec playwright install chromium firefox webkit)   # browsers for e2e
tools/handover-cache.sh unpack                            # optional: restores the caches from ../travel-caches
```

Versions used on the first machine: node 22.23, pnpm 12.4, Python 3.14, git 2.53, Playwright with Chromium build 1248. Other recent versions should work.

Check it works (about 4 minutes; builds the site):

```bash
mv web/.env.local /tmp/envlocal 2>/dev/null     # check-all must run WITHOUT the env file (it sets the Google map family)
bash tools/check-all.sh                           # must end with CHECK-ALL OK
mv /tmp/envlocal web/.env.local 2>/dev/null
```

`check-all.sh` runs: python tests, locations validate and build check, core tests and typecheck, the MCP server check, the generated-schema and capture-contract checks, data validation, the search vocabulary check, the suitability scope manifest, suitability, relevance and source registry checks, then the web typecheck, lint, unit tests, a clean build, and the privacy tests over the built output.

### Commands you will use

| What | Command |
|---|---|
| Full gate | `bash tools/check-all.sh` (env file moved aside) |
| Build the site | `cd web && pnpm build` (static export into `web/out/` until lane API-0 lands; after it, `pnpm build && pnpm start` runs the server build with the `/api/v1/` handlers) |
| Dev server | `cd web && pnpm dev` |
| Unit tests | `cd web && pnpm test` |
| Browser tests (about 40 minutes for all) | `cd web && pnpm e2e` (stages `.site/` today; against `next start` after API-0) ; one spec: `pnpm exec playwright test tests/e2e/<file>:<line> --project=chromium` |
| Location tool | `python3 tools/locations.py add\|edit\|validate\|build [--check]` |
| Capture contract | `node core/bin/capture.ts fields --type <id>`, `gaps [--placement]`, `build [--check]` |
| Sources | `node core/bin/sources.ts check` ; `build` regenerates the registry |
| Regenerate derived files | `python3 tools/locations.py build`; `node core/bin/capture.ts build`; `node core/bin/sources.ts build --write`; `node core/bin/suitability.ts migrate --write`; `pnpm --dir web exec vitest run -c ../tools/suitability-scope/vitest.config.mts` (scope manifest); `node web/scripts/snapshot-prototype.mjs` (redirects and snapshot report) |
| Publish | **Out of scope (owner, 20 Oct):** deployment waits for the hosting decision. `./publish.sh --product --dry-run` still stages the old static path; never run a deploying mode. The readiness checklist is EXECUTION-PLAN section 13 |

Never hand-edit generated files (the locations views, `data/schema/**`, `research/types/**`, `data/sources/registry.json`, `web/redirects.json`, the scope manifest): regenerate them with the tool above, or `check-all` fails.

## 4. What is NOT in git (recreate or copy)

| What | Where it was | What to do |
|---|---|---|
| **Secrets: `web/.env.local`** (mode 600, gitignored) | the first machine | Create it with these names only: `NEXT_PUBLIC_GOOGLE_MAPS_KEY`, `NEXT_PUBLIC_GOOGLE_MAP_ID`, `NEXT_PUBLIC_GOOGLE_MAPS_MAPID` (unused, to remove), `NEXT_PUBLIC_PLACE_MAP_FAMILY`, `ORS_API_KEY`. Values: the Google Maps key and Map ID from the Google Cloud console (the key's website restrictions were opened for testing and **must be restored at go-live**); the OpenRouteService key from openrouteservice.org. **Never commit or print them.** The ORS key must not appear in `web/out`; the build check greps for it |
| **Caches, packed next to the repo folder**: `../travel-caches/og-cache.tar.gz` (Commons photos for the build, 57 MB unpacked, gitignored `web/.og-cache/`) and `../travel-caches/globe-cache.tar.gz` (raw boundary and gazetteer downloads for the globe build, 443 MB unpacked, gitignored `tools/.cache/`) | `/home/nitin27may/workspace/travel-caches/` on the first machine, beside the `travel` folder | Copy the whole `travel-caches/` folder to the new machine **next to the cloned repo folder** (same parent), then run `tools/handover-cache.sh unpack`. Without them everything still works, only slower: the build refetches photos one at a time from Wikimedia Commons, and a globe rebuild redownloads boundaries. To refresh the packs on any machine: `tools/handover-cache.sh pack`. Nothing secret is in them; `web/.env.local` is never packed |
| Cloudflare login | the first machine | `npx wrangler login --device` (the localhost callback fails; approve on the phone). The Pages project is `nks-travel` |
| Preview tunnel and the design-mock tunnel | the first machine (a `cloudflared` quick tunnel, URL changes each time) | Recreate: `cd web && pnpm build && python3 -m http.server 3440 --bind 127.0.0.1 --directory out &` then `cloudflared tunnel --no-autoupdate --url http://127.0.0.1:3440` |
| Claude memory | `~/.claude/projects/.../memory/` | Copies of the travel notes are in `docs/v2/build/handover/memory/` (see its README) |
| Claude agents and skills | `.claude/agents/`, `.claude/skills/` | In git (the repo), nothing to do |
| Git worktrees and lane branches (`travel-wt/v2-*`, `public/*`) | the first machine | All merged into `main` and not needed. They exist only locally; `git cherry` showed no unmerged work. Do not recreate them |
| Old remote branches | `phase/p3b`, `phase/p4b` (pre-v2 work), `claude/serene-goldberg-wtn3di` (the same commit as `main`), and the `wip-*` work | **Done 21 Oct 2026:** deleted from the remote and kept as tags `archive/claude-serene-goldberg-wtn3di`, `archive/phase-p3b`, `archive/phase-p4b`, `archive/wip-*`; PR #7 closed. No old branch held a doc missing from `main`. Restore one with `git switch -c <name> archive/<tag>` |

## 5. How we work (the rules that carry over)

- **Branch and push.** New work starts from `main` in its own worktree and branch (`git worktree add ../x -b public/X main`), merged with a merge commit, pushed right after each verified merge.
- **BACKLOG first.** Every finding goes into `docs/v2/build/public-site/BACKLOG.md` with an ID first, and is marked done with its commit. The owner reviews at gates R1 and R2, not before (the earlier "stage 6" rule is superseded).
- **Delegation.** Opus plans, researches and reviews design (`travel-planner`, `travel-researcher`, `travel-design-reviewer`); Sonnet builds and verifies (`travel-builder`, `travel-verifier`). **Never Fable.** Parallel lanes get disjoint file ownership. Builders do not run the full e2e while other lanes run: it flakes under load; the coordinator runs it on a quiet machine.
- **Confirm every deletion** with the owner. **Kill servers by PID, never by name** (`pkill -f` has killed other agents' servers).
- **Never print or commit secrets.** Never put the owner's email in headers, URLs or payloads: the user agent for OSM, Overpass, Wikidata and Commons is `travel-relevance-signals/1.0 (+https://nks-travel.pages.dev/about/)`.
- **Sources.** AllTrails, Google, Tripadvisor and Komoot are links only, never data sources; coordinates never from Google. OSM, Overpass, Wikidata and Commons calls are strictly sequential (one at a time), Overpass under `flock /tmp/travel-overpass.lock`.
- **Visual checks** run on a real GPU (Chromium with `--use-gl=angle --use-angle=metal --ignore-gpu-blocklist --enable-gpu-rasterization`); SwiftShader is about 35 times slower, so never judge motion with it. Set dark mode through the site's own theme control. Read every screenshot you take, in tiles for tall pages.
- **Product rules.** No green anywhere (status colours included). Overlays non-modal, motion smooth. P8: nothing lets one request pull the catalogue. P9: all data goes through `web/lib/client/data.ts`. No household data on the public site (no party, ages, home town, dates, personal status, stay ideas). Public text says who a plan suits, never who travelled. A gap is never a yes. Trips are dateless. Empty place sections stay visible as "Not checked yet". The data model is complete and extensible: a new type is one entry in `data/vocab/types.json`.
- **Nothing goes live without the owner, and deployment is out of scope until the hosting is chosen.** Do not run `./publish.sh` in a way that deploys.
- **Server-ready by rule:** every task names its boundary function, its API contract and what stays unchanged at the switch; components never read data files; caps live in the store methods (EXECUTION-PLAN 4.3).

## 6. Where things are on the site (code map)

| Path | What |
|---|---|
| `web/app/**` | Next.js 16: home, trips, places, globe, about, terms, the list and search data routes (a static export today; server build with `web/app/api/v1/` handlers after API-0 and API-1) |
| `web/lib/public/**` | The adapter that reads the JSON data, scrubs it (privacy), and builds trips, places and sections |
| `web/lib/client/data.ts` | The one data boundary (P9) |
| `web/lib/search/**` | The query parser and vocabulary; `web/lib/entities/**` the list and filter engine |
| `web/components/**` | Trips and timeline, places and sections, globe, search, shell |
| `core/` | Schemas, validators, the trip scheduler (`core/src/schedule`), the capture engine, CLIs (`core/bin/*.ts`) |
| `data/` | The system of record: `locations/`, `capture/` (records), `suitability/`, `relevance/`, `sources/`, `tracks/`, `schedules/`, `trips/`, `vocab/types.json` |
| `legacy/` | The old hand-built pages. The new code still reads some files from here (for example the Rockies `data/*.json`); they move to `data/` before `legacy/` is removed (backlog 7.11) |
| `tools/` | Python tooling (locations, publish, globe data) and `check-all.sh` |
| `docs/v2/` | Plans, specs, designs, research, reviews |

## 7. First actions on the new machine

1. Run section 3 and confirm `CHECK-ALL OK`.
2. Read `docs/v2/PLAN.md`, then EXECUTION-PLAN sections 1 to 3, COVERAGE and BACKLOG (section 2).
3. Start with phase A of `EXECUTION-PLAN.md` section 3 (the UI fixes). Order is agreed (20 Oct). Lanes: TST, FIXF, SHL2, GLB2a, TRP1, LST2a, PLC2a (disjoint files), SRV-D (read-only diff) in parallel; merge in that order; quiet-machine full e2e (A11) closes the phase. Before A3 merges with the link on, create the public feedback repo (needs the owner's go).
4. When told to start a lane, write or read its brief in `docs/v2/build/public-site/briefs/`, create a worktree from `main`, delegate per the rules above.

A starting message for a new Claude session: "Read HANDOVER.md, docs/v2/PLAN.md, EXECUTION-PLAN.md (sections 1 to 3) and COVERAGE.md. Tell me the current state, the next three actions and any decision you need from me. Do not start work."

## 8. Open owner decisions

Q42 to Q64 and Q70 to Q72 are decided (20 Oct). L7 is closed (21 Oct: PR #7 closed, branches archived as `archive/*` tags). Still open: creating the public feedback repo under the owner's account, where this machine's `web/.env.local` values come from, and L9 (free AI features); see `docs/v2/PLAN.md` section 5; Q65 to Q69 wait for the server work; every hosting question waits for the hosting decision.

## 9. Change log

| Date | Change |
|---|---|
| 2026-10-20 | First version |
| 2026-10-20 | Execution plan for phases A, B, E, D written and linked; the work order is now EXECUTION-PLAN.md |
| 2026-10-21 | `docs/v2/PLAN.md` is the first thing to read; L7 closed and old remote branches archived as `archive/*` tags; reviews at R1 and R2, not stage 6 |
| 2026-10-20 | Rewritten for the owner's later decisions: UI fixes first, API-over-JSON, deployment out of scope, SRV-0; COVERAGE.md added |
