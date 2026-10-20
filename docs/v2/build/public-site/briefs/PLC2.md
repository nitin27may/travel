# PLC2: trail facts and AllTrails (part a, phase B), Nearby and related (part b, phase E)

Extends [PLC.md](PLC.md) (stage 4). This brief is self-contained for round 2.

- **Agent:** `travel-builder` (Sonnet).
- **Effort:** part a 6 h; part b 10 h (including review and verification).
- **Rows:** a: 10.1 (key-facts strip), 10.3 and Q53 (AllTrails search links). b: 8.2 place part, 8.14 and Q57 (bands), 8.15 (pair collapse), Q56, 13.5 UI part (related places, offers show where they happen).
- **Plan:** [EXECUTION-PLAN.md](../EXECUTION-PLAN.md) tasks B2, B3, E10; section 6.7 (what the UI needs from the data).
- **Specs:** [nearby-and-regions.md](../../../features/nearby-and-regions.md) 5.1, 5.2, 5.4; [place-page-sections.md](../../../design/place-page-sections.md) section 11; [capture-contract.md](../../../research/capture-contract.md) (`glance`, relations).
- **Principles:** P2, P3, P6, P8, T3, T5.
- **Starts:** a day 1; b after CONS-2, META-1 and DATA D1 (points) merge.
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
| b | part a's place files plus `web/lib/public/nearby.ts` (new, pure), `web/components/places/sections/Nearby.tsx` (new), `web/tests/data/nearby*.test.ts` (new), `web/tests/e2e/place-nearby.spec.ts` (new) |

## Do not touch

`web/lib/public/places.ts` (META-1 owns the point read order), `web/lib/client/**` (CONS, LST2), `web/lib/entities/**`, `web/components/entity/**` (LST2), `data/**` (DATA), `web/lib/map/**` other than `links.ts` (TRP2 in E), everything else.

## Steps

### Part a

1. **Trail facts strip** at the top of trail pages, rendered from the contract's `glance` for `nature.trail` (no per-type code): length, gain and loss, high point, adult time, route type, effort (the source grade and our family scale), surface, hazards and exposure, dogs, stroller, wheelchair, season, trailhead and parking, route status. A missing value shows "Not checked yet" in its slot. Units follow the unit switch.
2. **AllTrails on every trail.** In `links.ts`, `allTrailsLink(place)`: the direct URL when the record has an `alltrails` link with `state: filled`, else a search URL built from name and area (deterministic, no fetch), labelled "Search AllTrails", new tab, "third-party site" note. Verify the search URL form once by opening it in a browser by hand; never crawl it. The same module builds the Google Maps and directions URLs from **our** coordinates only.
3. Trail facts and links render at build from `getPlace()`; nothing new is fetched at runtime.

### Part b

4. `nearby.ts` (pure, no React, no `fs`): distance and bearing through `core/src/geo`, bands from `core/src/config/nearby.ts` ("under 15 min ≈", "15-30 min ≈", "30-60 min ≈", "1-2 h ≈", and walks under 1.2 km), the 200 m pair collapse ("Johnston Canyon · and its walk"), grouping by band then kind, and `nearbyForPlace(slug)`. Approximate points never enter a distance. A routed value (MX later) replaces a band where it exists.
5. **Around here** block after the two judged blocks (Nearby worth adding, Similar nearby): up to 8 places within 25 km, a "Day trips (25-100 km)" count and link to near mode (`/places/?near=place:<slug>&r=100`), the towns line once META-2 has merged, and the honest empty line with the build date. Not drawn when the page has no point or an approximate one. Under 2 KB of HTML a page.
6. **Related:** an "In the same park" row (same `area_id` or `part_of` parent, top 4 by relevance) in the same section. **Offer pages** show "Where it happens" with the place link from `at`, `on` or `starts_at`; check whether `sections.ts` already renders it and add the line if not.

## Acceptance checks

| # | Check |
|---|---|
| 1 | a: Fenland Loop shows every slot with "Not checked yet" for gaps; Tre Cime shows its track figures |
| 2 | a: every trail page (122) has an AllTrails link; the test asserts the builder is the only place AllTrails, Google Maps and directions URLs are formed |
| 3 | b: Moraine Lake lists Larch Valley about 2.6 km SW and Lake Louise about 10 km N with bands; pairs collapse; no approximate point used |
| 4 | b: the block is under 2 KB on every page (test over the build); the place page JS stays inside its budget |
| 5 | b: every offer page names its place; a gondola page shows "Where it happens" |
| 6 | Screenshots at 1440 and 390, light and dark: Fenland Loop, Tre Cime, Moraine Lake, a gondola offer, an empty Around here |
| 7 | `git diff --name-only` shows only owned paths |

## Server switch

The strip and the blocks render a `PageModel` from `getPlace(slug)`; a server `GET /api/places/:slug` returns the same model. `nearbyForPlace(slug)` is a pure function the build calls now and a server calls later (or `GET /api/places/:slug/nearby` with the same Zod output). Link builders are pure. Components, URLs and tests are unchanged on the switch.

## Verification

Typecheck, lint, unit tests, your specs only, `bash tools/check-all.sh` with `web/.env.local` moved aside and restored. Screenshots at 1440 and 390, light and dark (site theme control), GPU flags, into `web/test-results/shots/PLC2/`, read in tiles. Then `travel-design-reviewer`, then `travel-verifier`.

## Commit rules

Worktrees `/home/nitin27may/workspace/travel-wt/v2-PLC2a` and `v2-PLC2b` (branches `public/PLC2a`, `public/PLC2b`, from `main`), port 3465. Commits per step: `web(public/PLC2): ...`. Owned paths only, `git -C <worktree> add <paths>`, never `-A`; Co-Authored-By trailer; rebase; do not push.

## Hand-back

Commits, test counts, the AllTrails direct versus search counts, the Around here size distribution, pages with an empty block.
