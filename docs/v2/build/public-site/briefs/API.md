# API: API-over-JSON (API-0 build mode, API-1 contracts and store, API-2 pure modules into core), phase B

- **Agent:** `travel-builder` (Sonnet). The interface in step 6 is checked by `travel-planner` (Opus) before handlers are written; the B diff gets an Opus code audit at gate G-B.
- **Effort:** API-0 10 h, API-1 22 h, API-2 14 h (one lane, serial).
- **Rows:** 14.2, 14.3, 14.4, 13.1, 13.4, 15.1, 3.66i (10,000-place timings), L3 (completeness engine part).
- **Plan:** [EXECUTION-PLAN.md](../EXECUTION-PLAN.md) section 4 (shape, the exact `CatalogueStore` interface, endpoints, adapters, contract kit, build changes) and tasks B1 to B3. Input: SRV-D's `docs/v2/research/schema-diff-2026-10.md`.
- **Principles:** P1, P8 (caps inside the functions), P9 (one boundary, server-shaped state).
- **Starts:** at R1 entry (the R1 preview is a frozen build). R1 fix rounds win any shared file.
- **Owner decisions in force:** deployment is out of scope (no static-export assumption); API-over-JSON now; API-over-Supabase later as SRV-0.

## Goal

The browser reads every list, count, search, detail, globe and export through `/api/v1/` route handlers by default. The handlers are thin: they validate with shared Zod contracts, call a `CatalogueStore`, and pass every response through one `respond()` that scrubs, checks the allowlist, sets the ETag and maps errors. `JsonStore` serves the repo JSON now; a `SupabaseStore` later implements the same interface and the contract kit proves parity. A visitor sees nothing change.

## Read first

- EXECUTION-PLAN section 4 in full.
- `web/next.config.ts` (`output: 'export'`), `web/playwright.config.ts`, `web/tests/e2e/global-setup.ts` (stages `.site/` through `publish.py --dry-run`), `web/tests/global-setup.ts` (fixture builds), `tools/check-all.sh` (web steps).
- The 11 tests that read `web/out`: `budget`, `fonts`, `og`, `analytics`, `og-images`, `privacy` (in `web/tests/`), `data/light-data`, `data/place-size`, `data/link-only-facts`, and the `skipIf(web/out)` describes in `trips/timeline-outlinks`, `export/page-data`, `places/built-pages`, `data/photo-credits-clean` (row 15.1: these skip silently when `web/out` is missing).
- `web/lib/client/data.ts` (every export), `web/lib/public/index.ts` (`createPublicData()`), the existing `force-static` JSON routes under `web/app/{list,search,globe-data,sitemaps}/`.
- `core/src/store/` (the byte-level `Store`, `FileStore`, `MemoryStore`), `core/bin/serve.ts` (the local ops API on 127.0.0.1:4319, which already uses `/api/v1/trips/<slug>` for planner trip files).
- `core/src/schema/` (Zod 4.6, `export.ts`, the generated outputs in `data/schema/generated/`).

## Files you own

| Sub-lane | Paths |
|---|---|
| API-0 | `web/next.config.ts`, `web/playwright.config.ts`, `web/tests/e2e/global-setup.ts`, `web/tests/global-setup.ts`, a path helper `web/tests/helpers/built.ts` (new) and the `web/out` path lines in the 11 tests above, `web/scripts/images.mjs`, `web/scripts/og.mjs` (input and output paths), `tools/check-all.sh` (the web build lines), `docs/v2/build/public-site/README.md` (build and run section) |
| API-1 | `core/src/schema/api/**` (new), `core/src/catalogue/**` (new: `store.ts`, `json/**`, `stub/**`, `result.ts`), `core/bin/openapi.ts` (new), `data/schema/generated/openapi.json` (generated), `core/test/catalogue/**` (new), `web/app/api/v1/**` (new), `web/lib/server/respond.ts` (new), `web/lib/server/store.ts` (new: builds the `JsonStore` once from `createPublicData()`), `web/lib/client/contract.ts`, `api.ts`, `static.ts`, `stub.ts` (new), `web/lib/client/data.ts` (exports keep their names and signatures and call the selected adapter), `web/lib/capabilities.ts` (append server flags), `web/tests/api/**` (new), one `--check` line in `tools/check-all.sh` |
| API-2 | `core/src/query/**`, `core/src/parse/**`, `core/src/privacy/**`, `core/src/export/**`, `core/src/links/**` (new), and the moved web files, each reduced to a re-export: `web/lib/entities/{filter,sort,url}.ts`, `web/lib/search/parse/**`, `web/lib/public/{origin,party,dateless}.ts`, `web/lib/export/{ics,csv,kml,gpx,licence}.ts`, `web/lib/map/links.ts`; an ESLint rule (in `core/`) that forbids `react`, `next` and `node:fs` imports in those modules |

## Do not touch

Component files and their layouts (phase A's components must not change again); `web/lib/public/**` other than the three files API-2 moves (the dataset builder stays where it is and is injected into `JsonStore`); `data/**`; `core/src/store/**` (use it, do not change it); `core/bin/serve.ts`; `tools/publish.py` (deployment is out of scope; leave it working for the old mixed mode); generated files by hand.

## Steps

### API-0: server build mode and the harness

1. Remove `output: 'export'`. Keep `trailingSlash`, `images.unoptimized`, `transpilePackages`, `distDir` for the fixture.
2. Keep the existing JSON routes as `force-static` (they prerender at build and are the `StaticAdapter` path).
3. e2e: build once in global setup, start `next start` on a free port, record its PID, stop it by PID in teardown. `PW_REUSE_SITE=1` reuses a running server.
4. Replace every `web/out` read with the helper `builtHtml(path)` (prerendered HTML under the build's `server/app`) and `builtAsset(path)`. The six `skipIf(web/out)` describes must run, not skip; a test fails if the helper finds no build (row 15.1).
5. `images.mjs` and `og.mjs` keep producing the same files, from and into paths that exist in a server build.
6. check-all builds in server mode and runs every test that used to read `web/out`.

### API-1: contracts, store, handlers, OpenAPI, adapters, contract kit

7. Zod schemas in `core/src/schema/api/`: `Page`, `Paged<T>`, `ApiError`, `Result<T>`, `PlaceQuery`, `PlaceRow` (the P8 allowlist, exactly the current list-row keys), `FacetCounts`, `PlaceDetail`, `NearbyBlock`, `NearQuery`, `NearRow`, `TownQuery`, `Town`, `ParsedQuery`, `SearchQuery`, `SearchResult`, `TripQuery`, `TripRow`, `TripDetail`, `ExportQuery`, `ExportFile`, the globe shapes, `ReportInput`, `ReportResult`. Exported through `core/src/schema/index.ts`.
8. `CatalogueStore` in `core/src/catalogue/store.ts`, exactly the method list in EXECUTION-PLAN 4.2. Caps inside each method: `pageSize` ≤ 100, `limit` ≤ 50, `r` clamped to 100 with `clamped: true`, a near query without a resolvable centre returns `invalid_scope` or `not_found`, one item per export.
9. `JsonStore(dataset, fileStore)`: wraps the dataset from `createPublicData()` (injected, so `core/` never imports `web/`) and reads extra files through `FileStore` (the globe files, later the towns). `revision()` is a content hash of the dataset. `near`, `towns` and `nearbyForPlace` return `not_available` until E fills them (their contract cases are marked pending, not skipped silently).
10. `StubStore`: an in-memory fixture (20 places across 3 countries, 2 trips, 10 towns) implementing every method and every cap.
11. `respond()` in `web/lib/server/respond.ts`: parse the query with the Zod input schema (400 `invalid_input` on failure), call the store, run the privacy scrub (moved to `core/src/privacy` in API-2; call the current one until then) and the allowlist check on rows, set `ETag` from `revision()` and answer `If-None-Match` with 304, set `Cache-Control` per EXECUTION-PLAN 4.4, map `ApiError` codes to HTTP statuses.
12. Handlers under `web/app/api/v1/`: one file per endpoint in 4.4, each under 20 lines, depending only on `CatalogueStore`. `POST /api/v1/report` returns `{kind:'link', url}` built from `web/lib/config/product.ts`.
13. OpenAPI: `core/bin/openapi.ts` assembles OpenAPI 3.1 from the Zod schemas with `z.toJSONSchema()` and writes `data/schema/generated/openapi.json`; `--check` in check-all; `GET /api/v1/openapi.json` serves the file.
14. Adapters: `ApiAdapter` (default) calls `/api/v1/*` and, in development and tests, parses responses with the Zod schemas; `StaticAdapter` is today's functions over the prerendered JSON routes, selected with `NEXT_PUBLIC_DATA_ADAPTER=static`; `StubAdapter` for unit tests. `data.ts` keeps every export name and signature.
15. Server components (trip and place pages) read through the same `JsonStore` instance, so a page and the API cannot disagree.
16. Contract kit: `core/test/catalogue/contract/<method>.cases.ts` (one table per method), run against `JsonStore` on the real `data/` and against `StubStore`; `web/tests/api/contract.test.ts` runs the same tables through the handlers in process (no network) to cover `respond()`. Required cases are in EXECUTION-PLAN 4.6.

### API-2: pure modules into core

17. Move, in this order, each with a re-export left at the old path so no import changes: the link builder, the filter engine with sort and URL parsing, the parser, the privacy scrub, the export builders. One commit per module; the web tests pass unchanged after each.
18. The lint rule forbids `react`, `next` and `node:fs` in the moved modules. I/O stays in the store.
19. The scheduler bundle budget test (13,312 bytes) still passes; report the size before and after.

## Acceptance checks

| # | Check |
|---|---|
| 1 | check-all ends `CHECK-ALL OK` in server mode, with `web/.env.local` moved aside; no test skips because a build is missing |
| 2 | Quiet full e2e passes against `next start`; the e2e smoke set passes again with `NEXT_PUBLIC_DATA_ADAPTER=static` |
| 3 | A network assertion shows home, trips, a trip, places with filters, a place, the globe and an export reading from `/api/v1/` |
| 4 | Contract kit green on `JsonStore`, `StubStore` and through the handlers; the cap cases pass |
| 5 | `openapi.json --check` green; the served document validates as OpenAPI 3.1 |
| 6 | 0 household strings in any API response (the privacy test runs over the handler outputs) |
| 7 | Screenshots of home, a trip, a place and the globe at 1440 and 390, light and dark, match the R1 preview (pixel diff under 0.1%) |
| 8 | Moved modules have no React, Next or `fs` import (lint) |
| 9 | `git diff --name-only` shows only owned paths |

## Server switch

This lane is the switch. A later `SupabaseStore` implements `CatalogueStore`; the handlers, `respond()`, the adapters, the components, the URLs and the tests stay unchanged, and the contract kit proves parity (SRV-0).

## Verification

`pnpm --dir core test && pnpm --dir core typecheck`, `pnpm --dir web typecheck && pnpm --dir web lint && pnpm --dir web test`, `node core/bin/openapi.ts --check`, then `bash tools/check-all.sh` with `web/.env.local` moved aside to a mode-600 file and restored after. Run your own specs only; the coordinator runs the full e2e on a quiet machine. Screenshots at 1440 and 390, light and dark (the site's own theme control), on the GPU flags (`--use-gl=angle --use-angle=gl --ignore-gpu-blocklist --enable-gpu-rasterization`), into `web/test-results/shots/API/`, read in tiles. Kill any server you start by its PID.

## Commit rules

Worktree `/home/nitin27may/workspace/travel-wt/v2-API` (branch `public/API0`, then `public/API1`, `public/API2`, each from `main` after the previous merges), port 3469. Commits per step: `web(public/API): ...`, `core(API): ...`. Stage owned paths only with `git -C <worktree> add <paths>`, never `-A`; end each message with the Co-Authored-By trailer your harness provides; rebase onto `main`; do not push.

## Hand-back

Commits; the list of tests re-pointed from `web/out`; the method list with case counts per method; the OpenAPI path count; timings at 10,000 places through the API (first card, filter-to-count, keystroke) against the static numbers in BACKLOG 3.66; the scheduler bundle size; any module that could not move and why.
