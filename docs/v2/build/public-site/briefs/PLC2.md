# PLC2: trail facts and AllTrails (part a, phase A), Nearby and related (part b, phase E)

> **Corrected 21 Oct 2026:** part a is phase A (EXECUTION-PLAN tasks A8, A8b, A9), not phase B; part b is E9. Entry point: [docs/v2/PLAN.md](../../../PLAN.md). Worktree paths below are from the first (Linux) machine; use `<repo parent>/travel-wt/` here.

> **Revised 23 Oct (phase E start sheet).** Part a is merged (phase A). Part b runs from [PHASE-E-START.md](../PHASE-E-START.md) in seat B on Thu 29 to Fri 30 Oct, after META-1, DATA D1 and API-3. Changes in this brief: **Around here and In the same park are lazy** (decision D-E8; the place-size budget of +25% median is the binding limit, BACKLOG 15.30): the page renders one summary line at build ("8 places within 25 km · nearest 2.6 km", under 300 bytes of HTML) and loads the list from `nearbyForPlace` through the API when the section opens (P2, P8). This supersedes step 6's "under 2 KB of HTML a page" and nearby spec 5.2's build-time block. "Where it happens" on offer pages stays in the HTML (one line). The branch is `public/PLC2b-E` (`public/PLC2b` was used by an R1 fix round); worktree `/Users/nks/workspace/travel-wt/v2-PLC2b-E`, port 3482. `core/src/schema/api/nearby.ts` already exists (API-1a) and is API-3's in E; a change is a request (collision E2). The store method goes in a new `core/src/catalogue/json/nearby.ts` with one line in `json/index.ts` (collision E1); the route file `web/app/api/v1/places/[slug]/nearby/route.ts` exists. Use `core/src/geo/` (`haversineKm`, `bearing8`, `bandOf` in `bands.ts`) and `core/src/catalogue/distance.ts` (the pinned distance rule: `distanceKm = round1(haversineKm)`, inclusion on the unrounded value); do not edit `core/src/geo/**` or `core/src/config/**` (E8). Remove the pending entry for the `nearbyForPlace` table from the three contract runners. Approximate points never enter a distance (K17). GPU flag on macOS: `--use-angle=metal`.

Extends [PLC.md](PLC.md) (stage 4). This brief is self-contained for round 2.

- **Agent:** `travel-builder` (Sonnet).
- **Effort:** part a 14 h (6 h plus 8 h of place page polish from the coverage sweep); part b 10 h (including review and verification).
- **Rows:** a: 10.1 (key-facts strip), 10.3 and Q53 (AllTrails search links), and the place polish lines 4.12 (S5 to S13, the far pointer), R4-PP2, R4-PP4, R4-PP5, R4-C1, VI-5 and 3.49 in [COVERAGE.md](../COVERAGE.md). b: 8.2 place part, 8.14 and Q57 (bands), 8.15 (pair collapse), Q56, 13.5 UI part (related places, offers show where they happen).
- **Plan:** [EXECUTION-PLAN.md](../EXECUTION-PLAN.md) tasks A8, A8b, A9, E9 (corrected 21 Oct; was "B2, B3, E10"); section 6.7 (what the UI needs from the data).
- **Specs:** [nearby-and-regions.md](../../../features/nearby-and-regions.md) 5.1, 5.2, 5.4; [place-page-sections.md](../../../design/place-page-sections.md) section 11; [capture-contract.md](../../../../../research/method/capture-contract.md) (`glance`, relations).
- **Principles:** P2, P3, P6, P8, T3, T5.
- **Starts:** a day 1 (no API dependency: the page reads `getPlace()` as today); b after gate G-B, META-1 and DATA D1 (points). Part b puts the nearby logic in `core/src/nearby/` (pure) and serves it through `CatalogueStore.nearbyForPlace()` and `GET /api/v1/places/{slug}/nearby`; the page block renders from the same function at build or request time.
- **Opus review:** after each part.

## Goal

A trail page answers length, climb, time, route type and suitability at a glance with honest gaps; every trail links to AllTrails; every place page shows what is around it by distance and band, what else is in the same park, and every activity page names where it happens.

## Read first

- BACKLOG 10.1, 10.3, 8.2, 8.14, 8.15 word for word.
- `web/components/places/PlacePage.tsx`, `sections/Sections.tsx`, `sections/Relevance.tsx`; `web/lib/public/sections.ts` (the "At this place you can also" relation blocks, `reached_by`), `contract.ts`, `relevance.ts`; `web/lib/map/links.ts`.
- `node core/bin/capture.ts fields --type nature.trail.hike` for the glance slots.
- `core/src/geo/**`, `core/src/config/nearby.ts` (CONS-2) before part b.

## Files you own

| Part | Paths |
|---|---|
| a | `web/components/places/**` except `rows.ts`, `PlacesMap.tsx`, `PlaceCardFooter.tsx`, `cluster.ts`; `web/lib/public/sections.ts`, `contract.ts`; `web/lib/map/links.ts` (the one builder for derived links: directions, Google Maps URL, AllTrails search, Komoot search); `web/tests/places/**`, `web/tests/map/links*.test.ts`, `web/tests/e2e/place*.spec.ts`, `places-trail.spec.ts` |
| b | part a's place files plus `core/src/nearby/**` (new, pure), `core/src/catalogue/json/nearby.ts` (new) and the `nearbyForPlace` line in `json/index.ts`, the `// nearby (PLC2b)` section of `web/lib/client/data.ts`, `web/components/places/sections/Nearby.tsx` (new), `core/test/nearby/**` (new), the pending entries for `nearbyForPlace` in the three contract runners, `web/tests/e2e/place-nearby.spec.ts` (new). Not `core/src/schema/api/nearby.ts` (API-3 in E) |

## Do not touch

`web/lib/public/places.ts` (META-1 owns the point read order), `web/lib/client/**` (CONS, LST2), `web/lib/entities/**`, `web/components/entity/**` (LST2), `data/**` (DATA), `web/lib/map/**` other than `links.ts` (TRP2 in E), everything else.

## Steps

### Part a

1. **Trail facts strip** at the top of trail pages, rendered from the contract's `glance` for `nature.trail` (no per-type code): length, gain and loss, high point, adult time, route type, effort (the source grade and our family scale), surface, hazards and exposure, dogs, stroller, wheelchair, season, trailhead and parking, route status. A missing value shows "Not checked yet" in its slot. Units follow the unit switch.
2. **AllTrails on every trail.** In `links.ts`, `allTrailsLink(place)`: the direct URL when the record has an `alltrails` link with `state: filled`, else a search URL built from name and area (deterministic, no fetch), labelled "Search AllTrails", new tab, "third-party site" note. Verify the search URL form once by opening it in a browser by hand; never crawl it. The same module builds the Google Maps and directions URLs from **our** coordinates only.
3. Trail facts and links render from `getPlace()`; nothing new is fetched at runtime.
4. **Place page polish (coverage lines; check each first and report it if already fixed):** 4.12 S5 (one source for "Starts at" and the Directions card; Sorapis, Lagazuoi), S6 (section values follow the mi/ft switch), S7 (one marker per gap, no raw keys), S9 (one glyph on the rule chip), S10 (a chip row at rest in section 3), S11 (a lone "Not checked yet" chip says what is missing; kind and effort glyphs differ), S12 (a section index on phone pages over 4,000 px), S13 (no group named like its section), the far pointer whose target has no page; Akureyri's season glance agrees with "When you can go" (R4-PP2); Otzi's hours printed once (R4-PP4); no orphan dot on the Gondola cover line (R4-PP5); the cover Directions button opens the same chooser as the rail (R4-C1); fact repetition, "the pin we stored" wording and the map cluster over the trailhead pin (VI-5); Otzi's price glance and the checks count (3.49).

### Part b

5. `core/src/nearby/` (pure, no React, no `fs`): distance and bearing through `core/src/geo`, bands from `core/src/config/nearby.ts` ("under 15 min ≈", "15-30 min ≈", "30-60 min ≈", "1-2 h ≈", and walks under 1.2 km), the 200 m pair collapse ("Johnston Canyon · and its walk"), grouping by band then kind, and `nearbyForPlace(slug)`. Approximate points never enter a distance. A routed value (MX later) replaces a band where it exists.
6. **Around here** block after the two judged blocks (Nearby worth adding, Similar nearby): up to 8 places within 25 km, a "Day trips (25-100 km)" count and link to near mode (`/places/?near=place:<slug>&r=100`), the towns line once META-2 has merged, and the honest empty line with the build date. Not drawn when the page has no point or an approximate one. Under 2 KB of HTML a page.
7. **Related:** an "In the same park" row (same `area_id` or `part_of` parent, top 4 by relevance) in the same section. **Offer pages** show "Where it happens" with the place link from `at`, `on` or `starts_at`; check whether `sections.ts` already renders it and add the line if not.

## Acceptance checks

| # | Check |
|---|---|
| 1a | a: each place polish line fixed on its page at 1440 and 390, light and dark, or shown already fixed |
| 1 | a: Fenland Loop shows every slot with "Not checked yet" for gaps; Tre Cime shows its track figures |
| 2 | a: every trail page (122) has an AllTrails link; the test asserts the builder is the only place AllTrails, Google Maps and directions URLs are formed |
| 3 | b: Moraine Lake lists Larch Valley about 2.6 km SW and Lake Louise about 10 km N with bands; pairs collapse; no approximate point used |
| 4 | b (revised 23 Oct): the summary line is under 300 bytes of HTML on every page and the list loads on open (test over the build and an e2e network assertion); the place-size test stays green with the median not raised; the place page JS stays inside its budget |
| 5 | b: every offer page names its place; a gondola page shows "Where it happens" |
| 6 | Screenshots at 1440 and 390, light and dark: Fenland Loop, Tre Cime, Moraine Lake, a gondola offer, an empty Around here |
| 7 | `git diff --name-only` shows only owned paths |

## Server switch

The strip and the blocks render a `PageModel` from `getPlace(slug)`; a server `GET /api/v1/places/:slug` returns the same model. `nearbyForPlace(slug)` is a `CatalogueStore` method backed by the pure `core/src/nearby/`; `GET /api/v1/places/{slug}/nearby` serves it; a proposed `PostgresStore` (SRV-0, not implemented) implements it with PostGIS and passes the same contract cases. Link builders are pure. Components, URLs and tests are unchanged on the switch.

## Verification

Typecheck, lint, unit tests, your specs only, `bash tools/check-all.sh` with `web/.env.local` moved aside and restored. Screenshots at 1440 and 390, light and dark (site theme control), GPU flags, into `web/test-results/shots/PLC2/`, read in tiles. Then `travel-design-reviewer`, then `travel-verifier`.

## Commit rules

Worktree `/Users/nks/workspace/travel-wt/v2-PLC2b-E`, branch `public/PLC2b-E` from `main` (`git -C /Users/nks/workspace/travel worktree add /Users/nks/workspace/travel-wt/v2-PLC2b-E -b public/PLC2b-E main`, then `pnpm install --frozen-lockfile` at the worktree root), port 3482. Part a used `v2-PLC2a`, now merged. Commits per step: `web(public/PLC2): ...`. Owned paths only, `git -C <worktree> add <paths>`, never `-A`; Co-Authored-By trailer; rebase; do not push.

## Hand-back

Commits, test counts, the AllTrails direct versus search counts, the Around here size distribution, pages with an empty block.
