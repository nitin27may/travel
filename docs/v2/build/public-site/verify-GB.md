# Gate G-B verification (checks 4, 9, 11, 13, 15, 16)

Verifier: travel-verifier, model Sonnet 5.5. Date: 2026-10-22. Commit tested: d1a1156 (main), worktree `/Users/nks/workspace/travel-wt/v2-GB` (branch `public/GB`, no `web/.env.local`). Preview 1 (74b2a14, built with the public maps key) on :3440 was only read. My servers ran on 3481 (static-adapter build, `.next-static`) and 3482 (API build, `.next`); both killed by PID. Screenshots and diffs are in the session scratchpad `.../scratchpad/gb/shots/` (not in the repo). Nothing in the repo was changed except this file.

## Summary

| # | Check | Result | Evidence |
|---|---|---|---|
| 4 | Static adapter smoke (own build) | PASS with 2 named failures, both explained | 335 passed, 2 failed, 15 skipped (see 4) |
| 9 | Pixel diff vs preview 1 | PASS: 0 unexplained diffs | 21 of 24 pairs 0.000%; 3 explained (lazy images, one chip digit, noise floor) |
| 11 | Sitemap URL list | PASS | 380 URLs on both, `diff` empty, 0 slug changes |
| 13 | Evidence hashes, tree_check | PASS | three hashes unchanged (redirects reorder only), gazetteer hash unchanged, tree_check OK, 19 tests pass |
| 15 | Ownership per lane | REPORTED, not judged | table below |
| 16 | Timings at 10,000 places | PARTIAL | HTTP at 359 real places; 10,000 measured in-process through JsonStore with a cloned dataset |

## 4. Static adapter smoke

Build: `NEXT_DIST_DIR=.next-static NEXT_PUBLIC_DATA_ADAPTER=static next build` (22.7 s), served by `next start` on 3481. Command: `PW_REUSE_SITE=1 PW_SITE_URL=http://127.0.0.1:3481 playwright test --project=chromium home trips places globe search-panel export url-state places-parity`. The filter matches every spec whose name contains those words, so it ran 352 tests (it includes places-where, places-facets, globe.*, trips-*, and so on), not only the eight named files. `api-default` and `api-reads` were not in the set.

First run: 320 passed, 17 failed, 15 skipped. 15 of the 17 were a harness artifact, not the adapter: `PW_REUSE_SITE=1` skips global setup, so `.site` is not assembled, and `assembleInto(dest, '.next-static')` in `web/tests/helpers/built.ts` copies `web/public/` only when `dist === '.next'` (line 96). The specs that serve `.site` themselves (globe.stage4, globe.features.gpu) then had no fonts and no `/globe/data/*`, so the globe never painted. After assembling `.site` from `.next-static` and copying `web/public/` in, the four affected files (globe.cards, globe.features, globe.stage4, places-where: 50 tests) gave 48 passed, 2 failed. Control: the same four files against the API build with the normal global setup: 50 of 50 passed. Net: 335 passed, 2 failed, 15 skipped.

The 2 failures on the static build, neither on the API build:

| Test | Cause | Class |
|---|---|---|
| `places-where.spec.ts:166` "Counting..." shows while the country rows load | The spec delays `GET /api/v1/places/?country=CA` by 5 s; the static adapter never calls that URL, so "Counting" never shows | Expected (asserts `/api/v1`) |
| `globe.cards.spec.ts:51` a card with a photo, from our own renditions | `GET /globe-data/card/place/lake-louise/data.json` on the static build returns the raw Commons URL (`https://commons.wikimedia.org/wiki/Special:FilePath/...?width=960`); the API build returns `/img/b5f206d971-960.webp`. Renditions are applied only inside the API store path (API1c). With remote hosts blocked the card shows no photo and the spec fails | Real difference in the static fallback: its globe cards carry Commons photo URLs, not renditions. Not an `/api/v1` assertion. The fallback is not the default, so this is a note for the owner, not a G-B blocker, unless the fallback must ship as is |

The 15 skipped are skips in the specs themselves (the same count as in the first run, none are failures).

## 9. Pixel diff against preview 1

Method: Chromium with `--use-gl=angle --use-angle=metal --ignore-gpu-blocklist --enable-gpu-rasterization`, 2x, viewports 1440x900 and 390x844, light and dark (set through the site's theme key in localStorage, as `web/tests/e2e/shots.ts` does), remote hosts blocked as the fixture does, `reducedMotion: reduce`. Home and place pages are full page (stitched strips), trip top, trip day 6 and the globe are one viewport. Pages: `/`, `/trips/canadian-rockies-2029/` (top, `#day-6`), `/places/fenland-loop/`, `/places/moraine-lake/`, `/globe/`. Counted pixels: any channel differs by more than 24 of 255. The new build is the API adapter with NO maps key (maplibre family); preview 1 is built with the key, but with remote hosts blocked neither draws a basemap, so a map difference could not show.

Noise floor (same build captured twice): 0.000% on 22 of 24, but home 390 light 0.97% and home 390 dark 4.8% (lazy card images that finished loading in one run and not the other). So a diff on home only means something when it survives a re-run.

| Page | 1440 light | 1440 dark | 390 light | 390 dark |
|---|---|---|---|---|
| globe | 0.000 | 0.000 | 0.000 | 0.000 |
| home (first run) | 1.212 | 0.001 | 0.967 | 3.805 |
| home (re-run with a scroll-through to load lazy images, both builds) | 1.213 | 1.138 | 0.002 | 0.002 |
| trip top | 0.000 | 0.000 | 0.000 | 0.000 |
| trip day 6 | 0.000 | 0.000 | 0.000 | 0.000 |
| place fenland-loop | 0.000 | 0.000 | 0.000 | 0.000 |
| place moraine-lake | 0.000 | 0.000 | 0.000 | 0.000 |

(moraine-lake 1440 light shows 4 pixels of anti-aliasing on exact comparison; under the 24 threshold it is 0.000.)

Classification of every diff area:

1. Home, the large areas (y 600-1000 css at 1440, 1000-1450 at 390): the Canadian Rockies trip card image loads in one capture and not the other. I looked at both crops. Both builds link the same `/img/...-640.webp` files (HTTP 200, same byte sizes on both servers), and the same build captured twice differs by up to 2.45% in the same strip. Cause: lazy image timing in the harness. Not a build difference.
2. Home, a constant 7 x 8 px area (about 100 px, at 1440 x 310-316 y 1923-1931, at 390 x 260-266 y 1435-1443): the Lake Louise card chip reads "Partly checked - 25 of 48" in preview 1 and "25 of 49" now. Cause: META-0 (`core(META-0): placement properties`, merged after 74b2a14) added one tracked check, so the denominator went up by one. Caused by a lane.
3. Globe (0.000% at all four): the pair is identical, but both show "The globe tiles are not available right now" because remote hosts are blocked, so this proves the shell, panel and pins match and says nothing about the basemap. The globe changes since 74b2a14 (GLB2d Enter waits for the gazetteer, API1c level URLs) are behaviour, not first paint.
4. Place pages, trip: 0.000%, so the PRIV1 chip, PLC follow-ups and the META-0 "GeoNames" line do not appear on these four pages (the page source for fenland-loop has no "geonames" text on either build). If the owner expects them visible, they need a page that has them; none of the two places sampled does.

Unexplained diffs: none.

Web commits since 74b2a14 touching `web/` (git log): PLC2 noopener and the shuttle-only cover line, GLB2 landscape feature card, CLN4 gazetteer read, API1a/1b/1c, PRIV1, API2 and CONS2 moves, GLB2d. None changes markup on the sampled pages except what is listed above.

## 11. Sitemap

`/sitemap.xml` on 3440 and on 3482: both a single urlset (no nested sitemaps), 380 `<loc>` entries each, sorted lists identical (`diff` empty). 0 slug changes, total 380 as expected.

## 13. Evidence

| Item | ec7d51a | 74b2a14 | d1a1156 |
|---|---|---|---|
| `web/data-snapshots/prototype.json` sha1 | b436cf3e263f | b436cf3e263f | b436cf3e263f |
| `web/data-snapshots/snapshot-report.json` sha1 | e3f0b6e77a37 | e3f0b6e77a37 | e3f0b6e77a37 |
| `web/data-snapshots/photo-credits.json` sha1 | 0bde89ee01bf | same | same |
| `web/redirects.json` sha1 | a5abe3cd592d | a5abe3cd592d | 632753728eb8 |
| `web/public/globe/data/gazetteer.json` sha1 | 99b596798ef5 | same | same |
| `legacy/globe/assets/data/gazetteer.json` sha1 | b92fbd1e7cf8 | same | same |

`redirects.json`: both versions are lists of 80 entries and equal as a set of entries (0 symmetric difference); only the order changed (commit 86a6874, 5 lines). The three CLN-3 hashes: two byte-identical, one reorder only. Gazetteer: both copies unchanged.

`python3 tools/tree_check.py --check`: "folder contract OK: 11 rules, 11161 files, 84 baselined exception(s), 112 legacy files pinned". It also prints 4 baseline entries that no longer fire (rule 10: `core/src/catalogue/distance.ts::core/src/geo`, `core/src/catalogue/json/source.ts::core/src/query`, `core/src/catalogue/store.ts::core/src/query`, `core/src/catalogue/stub/index.ts::core/src/query`), which tools/tree_contract.json should drop (it does not fail the check). `python3 -m pytest tools/tests/test_tree_check.py -q`: 19 passed; there is a failing-fixture test for each of rules 1 to 11 (rule 6 has two, rule 10 has three, plus clean-tree, baseline and real-tree tests).

## 15. Ownership per lane (merges since ec7d51a; reported, not judged)

Owned lists from the briefs (`briefs/API.md`, `briefs/CONS.md`, `briefs/GLB2.md`, `docs/v2/CLEANUP-PLAN.md` for CLN-3 and CLN-5). E2E2 and API1c have no brief row; E2E2 is compared with `web/tests/e2e/**`, API1c with the API-0 plus API-1b lists. A path counts as outside when it is not under any owned prefix. Many are new test or helper files beside owned code.

| Lane (merge) | Files | Outside the owned list |
|---|---|---|
| CLN3 (92e7cfb) | 100 (`prototype/` removal excluded from the check) | `.claude/agents/travel-builder.md`, `travel-design-reviewer.md`, `travel-verifier.md`, `README.md`, `docs/v2/features/trip-timeline.md`, `web/redirects.json` (Do-not-touch by hand; regenerated, order only) |
| API1b (4239bfc) | 75 | 36: `core/src/catalogue/openapi.ts`; `core/test/catalogue/{contract.test.ts, openapi.test.ts, contract/{getPlace,handler,household,listPlaces}.cases.ts, kit.ts, run.ts}`; `docs/v2/build/public-site/README.md`; `web/components/trips/TripsMapLazy.tsx`; `web/instrumentation.ts`; `web/lib/entities/descriptors/trip.tsx`; `web/lib/public/{globe,index,vals}.ts`; `web/lib/search/search.ts`; `web/lib/server/{engine,exports,moved,placeDetail,privacy,source,sources,tripDetail}.ts`; `web/tests/data/boundary.test.ts`; `web/tests/e2e/{api-default,places}.spec.ts`; `web/tests/{entities/shards,export/page-data,globe/cards,globe/model,search/data,search/fulltext,search/ranges,search/split}.test.ts` |
| E2E2 (10ba0ce) | 6 | none |
| API1c (e60932b) | 11 | `core/test/catalogue/contract/{images.cases,index}.ts`, `data/sources/registry.json`, `web/lib/server/{images,source}.ts`, `web/tests/e2e/globe.levels.spec.ts`, `web/tests/globe/routes.test.ts` |
| GLB2d (277af67) | 2 | none |
| CLN5 (09cae8c) | 6 | `docs/v2/CLEANUP-PLAN.md`, `tools/legacy-freeze.json` |
| API2 (095e208) | 90 | `tools/cons/baseline.json`, `web/lib/format/{age,season}.ts`, `web/lib/map/types.ts`, `web/lib/public/types.ts`, `web/lib/search/{normalize,types}.ts` |
| CONS2 (d1a1156) | 38 | `core/src/capture/placementBlock.ts`, `core/src/catalogue/distance.ts`, `core/src/checks/days.ts`, `core/src/config/package.json`, `core/src/schedule/legs.ts`, `core/test/{geo/distance.test.ts, geo/pairs.json, privacy/home.test.ts, relevance/examples.test.ts, schedule/rules.test.ts}`, `web/lib/entities/{kind-labels.json,labels.ts}`, `web/lib/search/build.ts`, `web/scripts/{kind-labels.d.mts, kind-labels.mjs, legs-ors.mjs, tracks-osm.mjs}`, `web/tests/entities/kind-labels.test.ts`, `web/tests/places/place-polish.test.tsx` |

Merges before ec7d51a (API0, META0, CONS1, CLN4, API1a, API1a2, CLN2, CLN7, TD0, PLANB) were not in scope.

## 16. Timings at 10,000 places

How 3.66 and verify-integration section 6 measured it: the 64 fixture places cloned to 10,000 (unique ids, jittered coordinates) via `build-fixture.mjs`/`TRAVEL_ROOT`, a full `next build`, GPU Chromium at CPU x1 and x4: first card 218 ms (x1) and 516 ms (x4), Kind filter click to count 351 ms and 466 ms, search keystroke 99 to 121 ms and 371 to 454 ms; 3.66 adds a cold filter of 1.2 s at x4. Those are browser end to end and not reproducible here without a 10-minute capped build and a throwaway source edit, so I did not repeat them. The "near" query returns `not_available` ("Near mode lands in phase E (N2)"), so it cannot be measured.

Measured here:

A. Real server, `next start` on 3482, real dataset of 359 places, `/api/v1`, `fetch` from node, 1 cold request then 20 warm (ms):

| Call | Status | Size | Cold | p50 | p95 |
|---|---|---|---|---|---|
| listPlaces page 1 (48 rows) | 200 | 46.4 KB | 25.1 | 3.4 | 4.8 |
| listPlaces kind=lake | 200 | 29.1 KB | 3.5 | 2.5 | 3.0 |
| countPlaces kind=lake | 200 | 5.6 KB | 5.0 | 5.1 | 6.2 |
| countPlaces country=CA, kind=lake | 200 | 3.5 KB | 7.2 | 4.7 | 7.3 |
| search q=louise | 200 | 1.0 KB | 4.3 | 2.8 | 3.1 |
| getPlace lake-louise | 200 | 25.8 KB | 3.2 | 2.5 | 2.8 |
| near | 400 until a correct `near=place:...`, then `not_available` | | | | |

B. 10,000 places, in-process through `JsonStore` (a temporary vitest file in the worktree, since deleted): the real source with `placeRows` cloned 28 times (359 x 28 = 10,052 truncated to 10,000; clone slugs `<slug>-sN`, details mapped back to the base). This leaves out HTTP, JSON serialisation and the search index (a name search is not measured at 10,000; the text filter `q=louise` through listPlaces is). Warm: 20 calls. Numbers in ms:

| Call | 359 real: first / p50 / p95 | 10,000 synthetic: first / p50 / p95 |
|---|---|---|
| listPlaces page 1 | 330.3 / 0.57 / 0.92 | 2,860 / 21.3 / 22.4 |
| listPlaces kind=lake | 0.6 / 0.25 / 0.34 | 4.2 / 3.4 / 3.7 |
| countPlaces kind=lake | 5.0 / 2.2 / 2.9 | 66.5 / 62.8 / 66.1 |
| countPlaces country=CA, kind=lake | 4.3 / 2.1 / 2.7 | 54.6 / 54.9 / 57.3 |
| listPlaces q=louise (text) | 0.5 / 0.33 / 0.36 | 8.7 / 8.4 / 9.4 |
| getPlace | 0.0 / 0.00 / 0.06 | 0.0 / 0.00 / 0.00 |

The first call of a process includes the revision hash over every place detail: 0.33 s at 359 and 2.9 s at 10,000. Count with a filter is the slowest warm call at 10,000 (about 60 ms server side, scaling about linearly with rows). Each is well under the browser numbers in 3.66; add about 2 to 3 ms per request for HTTP (part A).

## Could not check

- The 10,000-place figures through HTTP and the browser (first card, filter-to-count, near): needs the cloned-root `next build` of verify-integration section 6, 10+ minutes and a throwaway edit; near is not built until phase E. Only the in-process equivalents are given.
- Basemap pixels (globe, place maps): remote hosts are blocked by design, so tiles and fonts from remote hosts are not compared.
- WebKit and the rest of the full e2e: not requested here (the coordinator ran it: 742 passed).
- `api-default.spec.ts` and `api-reads.spec.ts` against the static build were not run (they assert `/api/v1` by design).
