# GLB: globe stage-4 fixes (stage 4)

- **Agent:** `travel-builder` (Sonnet).
- **Effort:** about 14 h, in four parts:
  - scoping and framing, 4 h
  - cards and search, 4 h
  - overlaps and the home cover, 3 h
  - long tasks and tests, 3 h
- **Rows:**
  - 4.5 (L2b Opus review, stage 4)
  - 4.7 (long tasks in flights)
  - 4.13 (L2b review leftovers: S7, S9, S10, S11, N1, N3, N4)
  - 3.46 (globe trip pins from base points)
  - 3.3b (the remainder: the south-pole disc, the Antarctica hover fill)
- **Plan:** [STAGE4-plan.md](../STAGE4-plan.md).
- **Specs:** [design/globe/spec.md](../../../design/globe/spec.md), [review-L2b.md](../../../design/globe/review-L2b.md) ("Stage-4 fixes", round 2 "New findings", the long-task ruling).
- **Principles:** P1, P3, P4, P5, T5.
- **Starts:** when D2 has merged. **Merges:** fourth by default. You share no file with the other lanes, so you can merge whenever you pass.
- **Opus review:** none before; `travel-design-reviewer` after.

## Goal

Every level of the globe shows only what is inside it, every deep link survives a reload, and every selection lands where the crumb says. Nothing overlaps at 1440, 1024, 390 x 844 or 844 x 390, and long flights hold frames.

## Read first

- review-L2b.md, all of it.
- BACKLOG 4.5, 4.7, 3.46 and 3.3b.
- `web/lib/globe/engine.ts`, `controller.ts`, `flight.ts`, `framing.ts`, `search.ts`, `cluster.ts`, `geo.worker.ts`; `web/components/globe/*`; `web/lib/public/globe.ts` (`tripPin` and base points).
- `data/trips/base-points.json`.
- [README.md](../README.md) 8 (GPU rendering, deep links).

## Files you own

| Area | Paths |
|---|---|
| Globe app and code | `web/app/globe/**`, `web/app/globe-data/**`, `web/lib/globe/**`, `web/components/globe/**` (with `GlobeCover.tsx`), `web/styles/globe.css` |
| Globe data | `web/public/globe/**`, `tools/globe_data.py`, `web/scripts/globe-*.mjs`, `data/reference/globe/**`, `data/trips/base-points.json` |
| Adapter | `web/lib/public/globe.ts` |
| Spec note | `docs/v2/design/globe/spec.md` 3.2 (record the accepted left-dock landscape card) |
| Tests | `web/tests/globe/**`, `web/tests/e2e/globe*.spec.ts` |

## Do not touch

- `web/lib/client/data.ts` (LST). If you need a new reader, ask in the hand-back; the existing `globePins`, `globeCard`, `globeAdmin` and `globeGazetteer` should be enough.
- `web/redirects.json` (PLC; see step 4).
- `CoverGlobe.tsx` and the home page (SHL).
- Everything else.

## Steps

### Part 1. Scoping and framing

1. **Scope the panel to the level (S1).** List only the trips with a base inside the current area. A level with no content shows the 4.4 empty-state card.
2. **District framing for approximate pins (S5).** An approximate place (29 of 127, for example lago-di-braies) uses the district camera when the district is known, never the whole country.
3. **Trip pins from base points (3.46).** Chamonix, Utah, Vermont and New Hampshire use `data/trips/base-points.json` like the trips list. Add each missing entry from a sourced point: OSM or Wikidata through the sequential `flock` runners with the no-email UA, and the source in the file. Nothing stays at a country centroid.
4. **Levels that 404 on reload (S2).** Choose one of two:
   - **(a)** Export an empty shell per admin-1 level that has content beneath it.
   - **(b)** Rely on one rewrite `/globe/*  /globe/  200`, with the client reading the path.

   **Recommended: (b)**, because (a) grows with the world. You do not own `web/redirects.json`, so put the exact rule in the hand-back; the coordinator appends it as the last rule at merge (C7). Make the client handle any `/globe/<path>/` it is loaded under. Test that with a static server that serves `/globe/index.html` for unknown paths.

### Part 2. Cards and search

5. **City search (S7, N3).** Index local names as aliases ("Firenze"). Rank a city above an admin area with the same name.
6. **Open the card on `moveend` (N4)** for a search pick from the world, not at the start of the flight.
7. **An honest ring for a city with no outline (N1):** the 4.2 ring (casing plus amber) at the city point while its card is open.
8. **Card weight and facts (S10).** Serve the 640 rendition, not the 960. Fill up to three facts from the card data the adapter already holds; do not add fields beyond the P8 card allowlist.
9. **Census divisions (S6).** Draw 0.5 px district lines once a state is open, and a 1.5 px cased hover line.

### Part 3. Overlaps and the home cover

10. **No overlap at any size (S3, S9, 4.5).**
    - Offset the round markers toward the sea by `discSize/2 + 8`, so country names stay readable at world level.
    - On the phone, the attribution "i" sits clear of its text.
    - In landscape, the scale bar sits clear of Map options.
11. **Home cover (S4):** run the same clustering pass as `/globe/`; use the `/globe/` attribution and halo rules in dark.
12. **Immersive mode (S8):** a Fullscreen API button, or collapse the site header, so immersive mode is truly full screen.
13. **Remainders of 3.3b:** no pale disc or grey ring at the south pole in Relief; the Antarctica hover fill draws above the ice layer.

### Part 4. Long tasks (4.7, S11)

14. Profile the World crumb and search-pick flights on the GPU. Then:
    - move the 50m world parse into `geo.worker.ts` if it is not there yet;
    - defer the panel re-render and the "Loading states" fetch to `moveend`;
    - prewarm sprites and shaders at idle.

    Add a long-flight budget (no task over 100 ms) to the M1 e2e. If MapLibre's own tile work still breaks it, record the measured numbers and the cause, and do not loosen the test silently. 4.7 is re-profiled on the preview deploy at stage 6.
15. Check the `places-trail.spec.ts:47` load flake (Fanes "Route not confirmed yet"). Report the cause; the file is PLC's.

## Acceptance checks

| # | Check | Against |
|---|---|---|
| 1 | Waterloo lists no Rockies trip; Ontario shows the empty-state card | S1, P1 |
| 2 | Lago di Braies frames its district; the crumb and the camera agree | S5, T5 |
| 3 | No trip pin at a country centroid on the globe | 3.46, T5 |
| 4 | Every `/globe/<level>/` URL reached from the UI loads on reload under the rewrite (e2e with a rewrite-capable server) | S2 |
| 5 | "Firenze" finds Florence; "Birmingham" ranks the city first and opens its card on `moveend`; a no-outline city shows the ring | S7, N1, N3, N4 |
| 6 | Card images are 640 px; payloads stay inside the allowlist (test) | S10, P8 |
| 7 | No overlap at 1440, 1024, 390 x 844 or 844 x 390 (rect checks in e2e: the card, crumb, search, rail, attribution and scale bar) | S3, S9 |
| 8 | Home cover discs do not overlap, and the attribution reads at 4.5:1 in dark | S4 |
| 9 | Immersive mode fills the screen | S8 |
| 10 | The hue scan finds 0% green at zoom 6 and 12, light and dark, and no south-pole disc | 3.3b |
| 11 | Long flights: no task over 100 ms in 3 runs, or the numbers and cause are recorded | 4.7 |
| 12 | `git diff --name-only` shows only owned paths | 2.1 |

## Verification

`pnpm --dir web typecheck && pnpm --dir web lint && pnpm --dir web test && pnpm --dir web build && pnpm --dir web e2e`, and `bash tools/check-all.sh` on the rebased branch. `globe_data.py` has no `--check` mode; if you regenerate globe data, commit the output and say which subcommand you ran.

Screenshots at 1440, 1024, 390 x 844 and 844 x 390, light and dark, 2x, into `web/test-results/shots/GLB/`:
- world;
- Ontario;
- Waterloo;
- a Firenze card;
- a Birmingham card;
- the Braies pick;
- immersive mode;
- the home cover.

Read them, along with the frame sheets of two long flights. Then `travel-design-reviewer` (Opus), then `travel-verifier` on the Arc GPU.

## Commit rules

- **Worktree:** `/home/nitin27may/workspace/travel-wt/v2-GLB`, branch `public/GLB`, dev port 3454.
- **Commits:**
  1. `web(public/GLB): panel scoped to the level, district framing, trip base points (4.5, 3.46)`
  2. `web(public/GLB): city search aliases and ranking, card on moveend, honest ring, 640 cards`
  3. `web(public/GLB): overlaps, home cover, immersive full screen, south pole`
  4. `web(public/GLB): long flights (4.7)`
- Stage owned paths with `git -C <worktree> add <paths>`, never `-A`. Co-Authored-By trailer from your harness.
- Rebase onto the latest v2 branch before hand-back. Do not push.

## Hand-back

- the commits and the test counts;
- the exact `_redirects` rule for the coordinator;
- the long-task numbers;
- the base points added, with their sources;
- the cause of the `places-trail` flake.
