# API: API-over-JSON (API-0 build mode, API-1 contracts and store, API-2 pure modules into core), phase B

> **Revised 21 Oct (start sheet).** Order, models, worktrees, ports, preconditions, collisions and rollback now come from [PHASE-B-START.md](../PHASE-B-START.md). Changes in this brief: macOS paths and the Metal GPU flag; API-1 split into **API-1a (Opus: the shared contract)** and **API-1b (Sonnet: the implementation)** by the 21 Oct model rubric; the SRV-D pre-conditions (schema diff subsection 13.1 items 1 to 7) written into API-1a; the slug-stability rule (D-B1), refs (D-B2), canonical URL values (D-B3), provenance output (D-B4), sort key (D-B5) and revision (D-B6); the measured list of 16 tests and 3 scripts that read the build (was "11"); image renditions and share images move before the build (D-B7); the new check-all order.

> **Contract fix round 1 (22 Oct, API-1a2).** The Opus read of the contract ([review-API1a-contract.md](../review-API1a-contract.md)) was applied: the registry is `catalogue-slugs/2` (places and trips spaces with `retired`, `merged`, `withdrawn`; `formerKeys`; `slugs.ts merge` and `withdraw`), sort keys are an allowlist with one ordering rule (`core/src/catalogue/sorting.ts`), each method has a flat `query` schema and `core/src/catalogue/httpCodec.ts` decodes it, `servedSnapshot()` defines what the revision hashes, `PlaceRow` carries `approx`, `getTrip` can answer `moved`, and the facet, count, `q`, distance and privacy rules are written in `core/src/catalogue/store.ts` (decisions A1 and A15 to A23). R-6 (`sourceTypes`, `added`) waits for the owner.

### Carried to API-1b

The same list sits at the top of `core/src/catalogue/store.ts` (C1 to C7). Each is API-1b work, not a further deferral:

| # | Finding | What API-1b does |
|---|---|---|
| C1 | R-7, R-8 | JsonStore builds `servedSnapshot()` from everything it reads (dataset, registry, globe files through `web/lib/public/globe.ts`'s readers, vocabulary, cited sources) and returns that revision with every result |
| C2 | R-5, R-15 | `respond()` calls `httpCodec.fromSearchParams` for every GET; OpenAPI documents the `query` schemas of `CATALOGUE_CONTRACT`, not the store inputs; `respond()` runs the privacy detector on every body and fails closed (500 `internal`, logged), never rewriting |
| C3 | R-10 | K12 on real data: map `src` through each lane file's own source table before the page scrub blanks local urls (184 Rockies values cite "this repo" sources); K12 now requires every `src` to be a key of the detail's `citations`. `fact.provenance` stays display text that names no source id |
| C4 | R-21 | The json target runs over a copy of the registry with one planted rename and one planted merge, so K9 and K9.merged run on real data; its facts list the unlisted trips K7 must scan |
| C5 | R-22, R-23 | JsonStore filters and counts with the web query engine (store.ts A21, A22); the store-against-engine corpus case joins the kit when the engine moves to core in API-2 |
| C6 | R-13, R-14 | K7's home-point check runs in the web runner, reading the point from the local untracked file the privacy test already uses (no new environment variable); the Whitby ruling (Q50) is the owner's, before META-2 |
| C7 | R-28 | JsonStore's `rowReads` (K4) is counted by the target with a `FileStore` spy, not by the store |

Later, unchanged: R-24 (written as A23), R-25 (a `globePins` cap when 3.66 is measured), R-26 (`clamped` on `towns`), R-27 (narrow the open members when API-2 moves the scheduler), R-29 (one meaning of "unlisted" for `getTrip` and `getExport`). R-20's Veneto alias `IT-veneto` comes from the locations store's region code and is fixed there, through `tools/locations.py`, by the data lane.

- **Agents and models:** API-0 `travel-builder` on **Sonnet**. API-1a `travel-builder` on **Opus** (it sets a shared contract), then a 1 h Opus read of the contract before API-1b starts. API-1b `travel-builder` on **Sonnet**. API-2 `travel-builder` on **Sonnet**. `travel-verifier` (Sonnet) after each. The whole B diff gets the Opus code audit at gate G-B. Record the model in each hand-back.
- **Effort:** API-0 12 h, API-1a 9 h, API-1b 13 h, API-2 14 h, plus 1 h verification each and the 1 h contract read (one lane, serial).
- **Rows:** 14.2, 14.3, 14.4, 13.1, 13.4, 15.1, 3.66i (10,000-place timings), L3 (completeness engine part); SRV-D follow-ups (BACKLOG 15.12, Q73 to Q76).
- **Plan:** [EXECUTION-PLAN.md](../EXECUTION-PLAN.md) section 4 (shape, the exact `CatalogueStore` interface, endpoints, adapters, build changes) and tasks B1 to B3; [PHASE-B-START.md](../PHASE-B-START.md) sections 5 (decisions), 6 (contract cases K1 to K19) and 7 (check-all and harness). Input: [research/reports/schema-diff-2026-10.md](../../../../../research/reports/schema-diff-2026-10.md), subsection 13.1 "For API-1" and sections 12 and 13.
- **Principles:** P1, P8 (caps inside the functions), P9 (one boundary, server-shaped state).
- **Starts:** API-0 in slot 0 (R1 entry is done; the R1 preview is a frozen build on port 3440). API-1a in slot 2, API-1b in slot 3, API-2 in slot 4. R1 fix rounds win any shared file.
- **Owner decisions in force:** deployment is out of scope (no static-export assumption); API-over-JSON now; API-over-Postgres later as SRV-0 (proposed `PostgresStore` on Neon, provider revised 24 Oct, PLAN R-58; not implemented); two tiers, `entity.id` = `ref`, locations collections private, town ids `ca-on-whitby` (Q73 to Q76).

## Goal

The browser reads every list, count, search, detail, globe and export through `/api/v1/` route handlers by default. The handlers are thin: they validate with shared Zod contracts, call a `CatalogueStore`, and pass every response through one `respond()` that scrubs, checks the allowlist, sets the ETag and maps errors. `JsonStore` serves the repo JSON now; a proposed `PostgresStore` later implements the same interface and the contract kit proves parity per method before any switch. Every row and detail carries a stable `ref` and a slug that never changes silently. A visitor sees nothing change.

## Read first

- EXECUTION-PLAN section 4 in full; PHASE-B-START sections 3 to 7; schema diff subsection 13.1 and sections 6.3, 12, 13.
- `web/next.config.ts` (`output: 'export'`), `web/playwright.config.ts` (`GPU_ARGS`), `web/tests/e2e/global-setup.ts` (stages `.site/` through the legacy staging script's `--dry-run`), `web/tests/e2e/fixtures.ts` (the `site` and `legacy` fixtures), `web/tests/global-setup.ts` (real and fixture builds), `web/scripts/build-fixture.mjs`, `tools/check-all.sh` (it runs `web test` before `web build` today).
- The 16 test files that read the build: `images`, `budget`, `fonts`, `og-images`, `og`, `privacy`, `analytics` in `web/tests/`; `data/light-data`, `data/place-size`, `data/link-only-facts`, `data/photo-credits-clean`, `data/public-privacy`; `places/built-pages`, `places/tracks-markers`; `export/page-data`; `trips/timeline-outlinks`. The `skipIf` describes in `places/built-pages`, `export/page-data`, `data/light-data`, `data/place-size`, `data/photo-credits-clean` and `trips/timeline-outlinks` skip silently when the build is missing (row 15.1).
- `web/scripts/images.mjs`, `og.mjs` (both rewrite `out/` after the build) and `globe-cities.mjs` (`--from` defaults to `out/`); `web/app/og-manifest.json/route.ts`; `web/lib/format/image.ts`.
- `web/lib/client/data.ts` (every export), `web/lib/public/index.ts` (`createPublicData()`), `web/lib/public/places.ts` (the identity key at about line 436, `assignPlaceSlugs` and `assignSeedSlugs`, `captureRef` stripped from public output), `web/lib/public/slugs.ts`, `web/components/places/rows.ts` (`PlaceListRow`, `PLACE_LIST_KEYS`, `regionAliases`), the `force-static` JSON routes under `web/app/{list,search,globe-data,sitemaps}/`.
- `core/src/store/` (the byte-level `Store`, `FileStore`, `MemoryStore`), `core/bin/serve.ts` (the local ops API on 127.0.0.1:4319, which already uses `/api/v1/trips/<slug>` for planner trip files).
- `core/src/schema/` (Zod 4, `export.ts`, `enums.ts` with `SUIT_STATE` and `SUIT_BASIS`, `relevance.ts` with `REL_BASIS`, `suitability.ts` with the storage `val()`), `data/sources/registry.json` (ids `s-` plus 10 hex characters), the generated outputs in `data/schema/generated/`.

## Files you own

| Sub-lane | Paths |
|---|---|
| API-0 | `web/next.config.ts`, `web/playwright.config.ts`, `web/tests/e2e/global-setup.ts`, `web/tests/e2e/fixtures.ts` (the `site` fixture only), `web/tests/global-setup.ts`, `web/scripts/build-fixture.mjs`, a new helper `web/tests/helpers/built.ts`, the build-path lines in the 16 tests above, `web/scripts/images.mjs`, `web/scripts/og.mjs`, the `--from` default line of `web/scripts/globe-cities.mjs`, a new `web/scripts/prebuild.mjs` and its dataset dump (vitest dump pattern, as in `tools/suitability-scope/`), `web/app/og-manifest.json/route.ts` (removed if the dump replaces it), the rendition lookup in `web/lib/format/image.ts`, the `build` and `prebuild` scripts in `web/package.json`, the `web/public/img/`, `web/public/og/` and dump lines in `.gitignore`, `tools/check-all.sh` (the web block and the "server answers" step), `docs/v2/build/public-site/README.md` (build and run section) |
| API-1a | `core/src/schema/api/**` (new, including `val.ts`), `core/src/catalogue/store.ts`, `core/src/catalogue/result.ts`, `core/src/catalogue/slugs.ts` (new: `assignPlaceSlugs` and `assignSeedSlugs` moved here, taking the registry), `core/src/catalogue/sortKey.ts` (new), `core/src/catalogue/revision.ts` (new), `core/src/catalogue/stub/**`, `core/bin/slugs.ts` (new: `build`, `--check`, `rename`, `alias`), `data/catalogue/slugs.json` (new, generated by `slugs.ts build` from today's slugs), `core/test/catalogue/**` (the contract case tables and the store-level runner), the export lines in `core/src/schema/index.ts`, `web/lib/public/slugs.ts` (the two functions become re-exports), the slug call and the kept `ref` in `web/lib/public/places.ts`, the type and keys lines of `web/components/places/rows.ts`, one `slugs.ts --check` line in `tools/check-all.sh` |
| API-1b | `core/src/catalogue/json/**` (new: `JsonStore`), `core/bin/openapi.ts` (new), `data/schema/generated/openapi.json` (generated), `web/app/api/v1/**` (new), `web/lib/server/respond.ts` (new), `web/lib/server/store.ts` (new: builds the `JsonStore` once from `createPublicData()`), `web/lib/client/{contract,api,static,stub}.ts` (new), `web/lib/client/data.ts` (exports keep their names and signatures and call the selected adapter), `web/lib/capabilities.ts` (append server flags), the data calls in the `force-static` routes under `web/app/{list,search,globe-data,sitemaps}/`, the data-loading lines of `web/app/places/[slug]/page.tsx` and `web/app/trips/[slug]/page.tsx`, `web/tests/api/**` (new), `web/tests/e2e/api-reads.spec.ts` (new), one OpenAPI `--check` line in `tools/check-all.sh` |
| API-2 | `core/src/query/**`, `core/src/parse/**`, `core/src/privacy/**`, `core/src/export/**`, `core/src/links/**` (new), and the moved web files, each reduced to a re-export: `web/lib/entities/{filter,sort,url}.ts`, `web/lib/search/parse/**`, `web/lib/public/{origin,party,dateless}.ts`, `web/lib/export/{ics,csv,kml,gpx,licence}.ts`, `web/lib/map/links.ts`; an ESLint rule (in `core/`) that forbids `react`, `next` and `node:fs` imports in those modules |

## Do not touch

Component files and their layouts (phase A's components must not change again); `web/lib/public/**` other than the files and lines listed above (the dataset builder stays where it is and is injected into `JsonStore`); `data/**` other than `data/catalogue/slugs.json` and the generated `openapi.json`; `core/src/store/**` (use it, do not change it); `core/bin/serve.ts`; the legacy staging script in `tools/` (deployment is out of scope; leave it working for the old mixed mode); `core/src/schema/capture/**` and `core/src/schema/enums.ts` (META-0's; import `POINT_ROLE` from there); `web/tests/e2e/places-where.spec.ts` (the region key does not change, D-B3); generated files by hand; any line an open R1 row names.

## Steps

### API-0: server build mode and the harness

1. Remove `output: 'export'`. Keep `trailingSlash`, `images.unoptimized`, `transpilePackages`, the fixture `distDir`.
2. Keep the existing JSON routes as `force-static` (they prerender at build and are the `StaticAdapter` path).
3. **Renditions and share images before the build (D-B7).** `next start` serves only what was in `public/` at build time. Add `prebuild`: dump the dataset's Commons photo URLs and the share-image items with the vitest dump pattern; run `images.mjs` into `web/public/img/` and `og.mjs` into `web/public/og/` (both gitignored); then `next build`. Move the Commons-to-rendition rewrite into the data path (`web/lib/format/image.ts` and the dataset's image field) so HTML, RSC payloads and API responses carry the same URL. `images.mjs` keeps one request at a time under the Commons lock and its 429 back-off. Report the rendition count against today's end-of-run line.
4. e2e: global setup builds once (skipped with `SKIP_WEB_BUILD=1`), starts one `next start` on a free port, writes its PID, and teardown kills that PID. The `site` fixture returns the shared URL instead of a per-worker Python server. `PW_REUSE_SITE=1` with `PW_SITE_URL` reuses a running server. Keep the `legacy` list fixture.
5. List every e2e spec that relied on legacy routes in `.site/`. Move each to the `legacy` fixture or remove only its legacy assertion, and name each in the hand-back.
6. Replace every build-path read with `builtHtml(route)` (prerendered HTML and `.rsc` under the build's `server/app`; a trailing-slash route is `<route>.html`), `builtStatic(path)` (client chunks under `static/`; strip `_next/` from page references) and `builtFiles()`. The six silent `skipIf` describes must run, and the helper throws when there is no build (row 15.1).
7. The privacy scans read `server/app/**` (`.html`, `.rsc`, `.body`, `.meta`) and `static/**`, not `server/chunks/**` or `cache/**`.
8. check-all: web typecheck, lint, build (server mode, with `prebuild`; keep the `Error:` line guard), then web test with `SKIP_WEB_BUILD=1`, then "server answers" (`next start` on a free port, `GET /` 200, killed by PID). The fixture builds keep their own `distDir`.

### API-1a: the shared contract (Opus)

9. **Zod schemas** in `core/src/schema/api/`: `Page`, `Paged<T>`, `ApiError`, `Result<T>`, `PlaceQuery`, `PlaceRow`, `FacetCounts`, `PlaceDetail`, `NearbyBlock`, `NearQuery`, `NearRow`, `TownQuery`, `Town`, `ParsedQuery`, `SearchQuery`, `SearchResult`, `TripQuery`, `TripRow`, `TripDetail`, `ExportQuery`, `ExportFile`, the globe shapes, `ReportInput`, `ReportResult`. Exported through `core/src/schema/index.ts`, not registered as data tables (so `schema.ts generate` does not change). The SRV-D pre-conditions:
   - **`ref` on `PlaceRow`, `NearRow`, `PlaceDetail`, `TripRow`, `TripDetail`** (13.1 item 1; D-B2): the capture ref verbatim, else `loc:<locations id>`, else `proto:<prototype id>`.
   - **`PlaceRow` moves to Zod** (item 2). `PlaceListRow` in `web/components/places/rows.ts` becomes `z.infer` of it, and `PLACE_LIST_KEYS` is derived from the schema's keys. The keys are today's 41 plus `ref`; no other key is added.
   - **Points** (item 3): every detail point is `{lat, lon, pointRole, approx}`, `pointRole` from META-0's `POINT_ROLE` or null, `approx` true only when marked.
   - **Provenance** (item 4; D-B4): `apiVal(inner)` in `core/src/schema/api/val.ts` with `state` from `SUIT_STATE`, `basis` from `REL_BASIS`, `src` as registry ids only (`/^s-[0-9a-f]{10}$/`), `on`, and `read`, `note`, `conflicts` where present. The storage `val()` is not duplicated.
   - **Canonical URL values** (item 5; D-B3): `region` emits the kebab of the region's English name (`alberta`), pinned in the slug registry; `PlaceQuery.region` accepts every `regionAliases` value and normalises it. `city` is a town id matching `<cc>-<admin1>-<slug>`.
   - **Revision** (item 6; D-B6): `revision()` is the SHA-256 of the canonical JSON (sorted keys) of the served data plus the slug registry; never an mtime.
   - **Sort** (item 7; D-B5): `sortKey(name)` in `core/src/catalogue/sortKey.ts` (NFKD, marks stripped, lower case, code-point order); every paged method sorts by it with `ref` as the tiebreaker.
10. **`CatalogueStore`** in `core/src/catalogue/store.ts`, exactly the method list in EXECUTION-PLAN 4.2. Caps are written as part of the interface's contract: `pageSize` at most 100, `limit` at most 50, `r` clamped to 100 with `clamped: true`, a near query without a resolvable centre returns `invalid_scope` or `not_found`, one item per export. `getPlace` of a retired slug returns the current slug as `moved`.
11. **Slug registry** (D-B1): move `assignPlaceSlugs` and `assignSeedSlugs` into `core/src/catalogue/slugs.ts` with the registry as input; leave re-exports in `web/lib/public/slugs.ts`. `core/bin/slugs.ts build` writes `data/catalogue/slugs.json` (`catalogue-slugs/1`: `places`, `regions`, `retired`) from today's assignment; `--check` fails when a pinned slug would change or a pinned key has no record and is not retired; `rename <key> <slug>` and `alias <old-key> <new-key>` are the only ways to change it. Acceptance for this step: the sitemap's URL list is identical before and after.
12. **`StubStore`**: an in-memory fixture (20 places across 3 countries with one retired slug, two places with the same sort key, one approximate point, 2 trips, 10 towns) implementing every method and every cap.
13. **Contract case tables** `core/test/catalogue/contract/<method>.cases.ts` for cases K1 to K19 of PHASE-B-START section 6, and `core/test/catalogue/contract.test.ts` running them on `StubStore` (green) and on a `JsonStore` placeholder (the table is the API-1b target). Cases that need E data (K3, K4, K5, K15, K17) are marked pending with the task that fills them.
14. Hand the contract to the 1 h Opus read before API-1b starts.

### API-1b: the implementation (Sonnet)

15. `JsonStore(dataset, fileStore, slugRegistry)`: wraps the dataset from `createPublicData()` (injected, so `core/` never imports `web/`) and reads extra files through `FileStore` (the globe files through `web/lib/public/globe.ts`'s exported readers, never a new path literal; later the towns). `near`, `towns` and `nearbyForPlace` return `not_available` until E fills them. Output `src` ids are mapped to registry ids inside the store.
16. `respond()` in `web/lib/server/respond.ts`: parse the query with the Zod input schema (400 `invalid_input` on failure), decode the query with `core/src/catalogue/httpCodec.ts` (R-5), call the store, run the privacy DETECTOR (the scrub itself stays in the dataset builder and later the loader; `respond()` fails closed with 500 `internal` and never rewrites a body, R-15) and the allowlist check on rows, set `ETag` from `revision()` and answer `If-None-Match` with 304, set `Cache-Control` per EXECUTION-PLAN 4.4, map `ApiError` codes to HTTP statuses, answer a `moved` slug with 308.
17. Handlers under `web/app/api/v1/`: one file per endpoint in 4.4, each under 20 lines, depending only on `CatalogueStore`. `POST /api/v1/report` returns `{kind:'link', url}` built from `web/lib/config/product.ts`. `GET /api/v1/health` returns the revision.
18. OpenAPI: `core/bin/openapi.ts` assembles OpenAPI 3.1 from the Zod schemas with `z.toJSONSchema()` and writes `data/schema/generated/openapi.json`; `--check` in check-all; `GET /api/v1/openapi.json` serves the file. Extend API-0's "server answers" step to request `/api/v1/health` and `/api/v1/openapi.json`.
19. Adapters: `ApiAdapter` (default) calls `/api/v1/*` and, in development and tests, parses responses with the Zod schemas; `StaticAdapter` is today's functions over the prerendered JSON routes, selected with `NEXT_PUBLIC_DATA_ADAPTER=static` (inlined at build, so it needs its own build); `StubAdapter` for unit tests. `data.ts` keeps every export name and signature.
20. Server components (trip and place pages) and the `force-static` routes read through the same `JsonStore` instance, so a page, a fallback file and the API cannot disagree. A retired place slug calls `permanentRedirect()` to the current one.
21. Make every case of the contract tables pass on `JsonStore`; `web/tests/api/contract.test.ts` runs the same tables through the handlers in process (no network). `web/tests/e2e/api-reads.spec.ts` asserts that home, trips, a trip, places with filters, a place, the globe and an export read from `/api/v1/`.

### API-2: pure modules into core

22. Move, in this order, each with a re-export left at the old path so no import changes: the link builder, the filter engine with sort and URL parsing, the parser, the privacy scrub, the export builders. One commit per module; the web tests pass unchanged after each.
23. The lint rule forbids `react`, `next` and `node:fs` in the moved modules. I/O stays in the store.
24. The scheduler bundle budget (13,312 bytes; find its test first and name it) still passes; report the size before and after.

## Acceptance checks

| # | Check |
|---|---|
| 1 | check-all ends `CHECK-ALL OK` in server mode, with `web/.env.local` moved aside and the venv on `PATH`; no test skips because a build is missing |
| 2 | Quiet full e2e passes against `next start`; the e2e smoke set passes again with `NEXT_PUBLIC_DATA_ADAPTER=static` (its own build) |
| 3 | A network assertion shows home, trips, a trip, places with filters, a place, the globe and an export reading from `/api/v1/` |
| 4 | Contract kit green on `JsonStore`, `StubStore` and through the handlers; the pending cases are counted and named |
| 5 | `openapi.json --check` green; the served document validates as OpenAPI 3.1 |
| 6 | 0 household strings in any API response, prerendered page or static chunk (the privacy test runs over all three) |
| 7 | Screenshots of home, a trip, a place and the globe at 1440 and 390, light and dark, match the R1 preview (pixel diff under 0.1%) |
| 8 | Moved modules have no React, Next or `fs` import (lint) |
| 9 | `slugs.ts --check` green; the sitemap's URL list equals preview 1's; every row and detail carries `ref` |
| 10 | Every `src` in API output is a registry id; image URLs in HTML and API output agree |
| 11 | `git diff --name-only` shows only owned paths |

## Server switch

This lane is the switch. A later, proposed `PostgresStore` (not implemented; `JsonStore` keeps serving and stays the rollback) implements `CatalogueStore`; the handlers, `respond()`, the adapters, the components, the URLs and the tests stay unchanged, and the contract kit proves parity (SRV-0). The slug registry, the sort key and the content revision are what let the proposed `PostgresStore` return the same pages, slugs and ETags: SRV-0's loader copies `data/catalogue/slugs.json` and stores the sort key.

## Verification

`pnpm --dir core test && pnpm --dir core typecheck`, `pnpm --dir web typecheck && pnpm --dir web lint && pnpm --dir web test`, `node core/bin/openapi.ts --check`, `node core/bin/slugs.ts --check`, then `PATH=<venv>/bin:$PATH bash tools/check-all.sh` with `web/.env.local` moved aside to a mode-600 file and restored after (PHASE-B-START section 1 names the venv). Run your own specs only; the coordinator runs the full e2e on a quiet machine. Screenshots at 1440 and 390, light and dark (the site's own theme control), on the project's `GPU_ARGS` from `web/playwright.config.ts` (on macOS `--use-gl=angle --use-angle=metal --ignore-gpu-blocklist --enable-gpu-rasterization`), into `web/test-results/shots/API/`, read in tiles. Kill any server you start by its PID (`lsof -iTCP:<port> -sTCP:LISTEN` finds it). Never touch port 3440 (preview 1). Search the legacy staging and deploy scripts with the Read and Grep tools, not a shell command that names them (a hook blocks it).

## Commit rules

Worktrees `/Users/nks/workspace/travel-wt/v2-API0`, `v2-API1a`, `v2-API1b`, `v2-API2` (branches `public/API0`, `public/API1a`, `public/API1b`, `public/API2`), each created from `main` after the previous one merges: `git -C /Users/nks/workspace/travel worktree add /Users/nks/workspace/travel-wt/v2-<lane> -b public/<lane> main`, then `pnpm install --frozen-lockfile` at the worktree root. Dev port 3469. Commits per step: `web(public/API): ...`, `core(API): ...`. Stage owned paths only with `git -C <worktree> add <paths>`, never `-A`; end each message with the Co-Authored-By trailer your harness provides; rebase onto `main`; after a rebase, rerun the generators instead of merging generated files; do not push.

## Hand-back

Commits; the model used; the list of tests re-pointed from `web/out` and the legacy-route specs moved or trimmed; the rendition count before and after; the method list with case counts per method (pending cases named); the slug registry row count and the sitemap diff (empty); the OpenAPI path count; timings at 10,000 places through the API (first card, filter-to-count, keystroke) against the static numbers in BACKLOG 3.66; the scheduler bundle size; any module that could not move and why.
