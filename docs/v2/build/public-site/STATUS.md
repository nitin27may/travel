# Public site build: live status (coordinator handover)

Updated 2026-10-18, late evening. Read this first after a context reset. **The full backlog to go-live, with every finding and its status, is `BACKLOG.md` in this folder: every new finding goes there first.** Then read `docs/v2/TODO.md` and `README.md`.

## Where things are

- Integration branch: `claude/serene-goldberg-wtn3di`, worktree `/home/nitin27may/workspace/travel-wt/v2`. Everything merges here, and it is pushed after each merge.
- `main` (`/home/nitin27may/workspace/travel`) is the published site. It keeps the legacy globe until the owner approves the go-live. Never run `./publish.sh` from the v2 branch.
- The public site is built in `web/` (Next.js static export). `prototype/` is frozen as the reference and is the workbench for the planner, which comes later.
- Lane worktrees are `/home/nitin27may/workspace/travel-wt/v2-<lane>` on branch `public/<lane>`.

## Lanes

| Lane | Scope | State | Notes |
|---|---|---|---|
| L0 | foundation: tokens, fonts, components, header, routes | merged 1f9e7d9 | |
| LD | read-only data adapter (`web/lib/public`) | merged ac4d947 | 14 trips (all public), 105 places, privacy allow-list, dateless |
| LM | map adapter (`web/lib/map`, `web/components/map`) | merged 24b6609 | maplibre by default; google-js/embed through `NEXT_PUBLIC_PLACE_MAP_FAMILY` |
| L5 | copy, export, share | merged 972fbd4 | ICS only for dated copies, licence guard on GPX/KML/CSV |
| L1 | home and global search | merged bc8d102 | the cover is still a flat map; swap to L2's `GlobeCover` after L2 merges |
| L2 | full-screen globe | merged 4777821 | verified twice on the Arc GPU; the remaining cosmetic items are in L2b (backlog 3.3b) |
| L3 | trips list and trip page | merged 65eee4c | dark-style label hiding via `web/lib/map/maplibre/labels.ts` (additive LM edit, `hideBasemapLabels`); TripsMap lazy for the JS budget |
| L4 | places list and place/trail pages | merged d0cb415 | real Google key checked 18 Oct (facade, our points, directions from our coordinates) |
| PS | privacy: personal place status off public output | merged e883636 | Status facet becomes "In a public trip"; payload test |
| L2b | globe experience | spec in progress (Fable) | `globe/experience-review.md`, `spec.md`, owner feedback F1, F3, F4, F6 |
| L3c | trip page timeline and party profile | design + model in progress | `design/trip-page/timeline-design.md`, `features/trip-timeline.md`, brief `L3c-trip-timeline.md` |
| L3b | trip tags and filters at parity with Places | queued | TODO row; spec `features/trip-tags.md` first |
| L4b | real trail tracks; trail pages for every trip's trails | queued | TODO row; `research/lanes/trails.md` |

Merge procedure per lane:
1. travel-verifier (Sonnet) checks the lane.
2. Fix anything it finds.
3. `git merge --no-ff public/<lane>` into the v2 branch.
4. Run tsc, test and build on the merged result.
5. Push.

## Final plan to the owner's review (agreed 18 Oct, late evening)

The owner tries the whole site once everything below is fixed: trips (every view), trip pages, places, place and trail pages, the globe. Work goes down this list in order; new feedback is slotted into the stage it belongs to, not started on its own. Every build lane ends with travel-verifier (Sonnet, on the Arc GPU) and every UI stage with travel-design-reviewer (Fable).

| Stage | Work | Feedback it closes | Gate |
|---|---|---|---|
| 1 | Finish wave 2: L2 verify, then L2 fixes (verifier must-fixes, F2 rings, F5 reset view), merge. PS privacy lane, verify, merge. Fable experience review and the rewritten globe spec land as docs. | F2, F5, F7 | verifier pass per lane; tsc, test, build on the merged branch |
| 2 | Integration pass (list below): GlobeCover on home, adapter note scrub at the source, L0 fixes, foundation doc edits, full e2e, Lighthouse, privacy grep | | integration sweep `verify-integration.md` |
| 3 | Wave 3, four lanes in parallel with disjoint files. **L3c trip page timeline** (whole-trip and per-day timelines, a scheduler in `core/`, party profile replacing per-day A/B/C; design by Fable and model by Opus, both in progress) and **L3b trip tags and filters** (trips first, as the owner asked); **L2b globe experience** (rendering, motion, look, selection cards, city areas, Canada census divisions and the ADM2 audit, image-first place card); **L4b trail tracks** (real OSM lines, elevation and GPX from them, trail pages for every trip's trails) | F1, F3, F4, F6, trip tags, trail maps, trip timeline | verifier per lane, Fable re-review of L2b against its spec |
| 4 | Fable review of the whole built site (`review.md`), then the fixes it lists | | Fable sign-off |
| 5 | Sanity checks across models: travel-verifier full sweep on the GPU (every page, 1440 and 390, light and dark, frame times on the globe); an independent Opus audit of privacy, data honesty and the dateless rule over `web/out` | | both pass |
| 6 | Owner preview on a tunnel: he reviews trips, trip pages, places, place and trail pages and the globe | | owner approval |
| 7 | Go-live: restore the Google key's website restrictions, set Cloudflare Pages env vars, publish from main after merging v2 | | owner go |

Ownership in wave 3: L2b owns `web/lib/globe`, `web/components/globe`, `web/styles/globe.css`, `web/public/globe`; L3b owns `web/lib/entities/descriptors/trip.tsx`, `web/components/trips`, the trip side of `data/vocab/tags.json`; L4b owns `web/components/places` trail parts, the trail code in `web/lib/public/places.ts`, and new track data. Shared files (`web/lib/public/types.ts`, `web/lib/map`) take additive edits only, listed in each report.

## After every lane is merged (the integration pass, done by the coordinator)

1. Scrub internal capture notes in the adapter. Today they are filtered per page, in L1 and L4.
2. Fix the L0 items:
   - the `/specimen/` axe failure (a loading button with no name, small-text contrast)
   - scope the `app.css` phone `.search` rule to `.filter-bar`
   - the unused `rows` lint warning in `tests/export/formats.test.ts`
3. Swap the home cover to `GlobeCover`.
4. Foundation doc edits from the globe spec section 10 (hover fill and casings, `--map-park`, `--map-casing`, `--globe-edge`, `?f=`, pitch and bearing in `?c=`).
5. Run the full e2e on a quiet machine (places-parity is flaky under load), run a real Lighthouse (home first paint is 1.47 s against a 1.5 s target), and do the privacy grep of `web/out`.
6. Integration sweep (travel-verifier), recorded in `verify-integration.md`.
7. Fable design review of the built site (`review.md`), then fixes.
8. Serve a tunnel preview to the owner. Go-live only with his approval.

## Owner decisions in force (18 Oct)

- The public read-only site comes first, with no login; the planner comes second. Under 100 users in year one, so free tiers. No green palette. Design direction is C, Trailhead.
- All 14 trips are public, and **public trips are dateless** (Day 1 to N, a season window, booking rules relative to days). Dates attach only when a trip is copied.
- Maps:
  - MapLibre for the globe, trips and the planner.
  - Google Maps JS on place pages, with Embed as the fallback.
  - Google Maps URLs for directions.
  - OpenRouteService for drive legs.
  - Never two map families on one page.
- Coordinates never come from Google. Trailheads and car parks come from OSM.
- Business phone numbers (huts, operators) may be shown. Photos credited "Unknown" on Commons are kept with their licence.
- Owner keys are in `travel-wt/v2/web/.env.local` (mode 600, gitignored). Never print or commit them. Copy the file to a lane worktree only when that lane needs it.

## Running services (after cleanup, 18 Oct evening)

| Service | Port | What |
|---|---|---|
| http.server | 5197 | `docs/v2/design` (redesign, foundation specimen) behind the tunnel https://accountability-workshops-refused-rural.trycloudflare.com |
| lane dev servers | 3412 to 3414 | started and stopped by lane agents (kill by PID on the port) |

Removed 18 Oct with the owner's approval:
- the merged worktrees and branches v2-L0, LD, LM, L1 and L5
- the old prototype servers on 5191 and 5192 and their tunnel
- the stray untracked `docs/design/` folder in `main`

## Older work still open (pre-v2)

- `travel-wt/p3b` (phase/p3b): parked after 3 of its 5 steps; it has uncommitted a11y edits. Superseded by the v2 public site.
- `travel-wt/p4b` (phase/p4b): PR #7 is open and unmerged; its catalog ingestion logic carries into v2. Verify it before merging, or close it.
