# Public site build: live status (coordinator handover)

Updated 2026-10-18, evening. Read this first after a context reset. Then read `docs/v2/TODO.md` and `README.md` in this folder.

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
| L2 | full-screen globe | **fixing** (builder agent) | blocking: the map has no height in the export (review 3.1, L2-1). Fixing L2-1 to L2-7, then re-verify with tiles and merge |
| L3 | trips list and trip page | **fixing** (builder agent) | day-row photos, map label collisions, map fit, country names, decimals, done-trip view, share links. Then merge |
| L4 | places list and place/trail pages | **building** (builder agent) | uses the owner's real Google key (`web/.env.local` in v2-L4); make places-parity e2e deterministic; filter internal notes |
| L2b | globe enhancements | queued | `docs/v2/design/globe/spec.md`, after L2 merges |

Merge procedure per lane:
1. travel-verifier (Sonnet) checks the lane.
2. Fix anything it finds.
3. `git merge --no-ff public/<lane>` into the v2 branch.
4. Run tsc, test and build on the merged result.
5. Push.

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

## Running services (as of this update)

| Service | Port | What | Stop |
|---|---|---|---|
| Vite dev, prototype | 5191 | `prototype/` dev server | kill by the PID on the port |
| http.server | 5192 | `prototype/dist`, behind the tunnel vinyl-scales-hawaiian-taylor | kill by the PID on the port |
| http.server | 5197 | `docs/v2/design` (redesign, foundation specimen), behind the tunnel accountability-workshops-refused-rural | kill by the PID on the port |
| two cloudflared quick tunnels | n/a | the two preview links above | kill by PID |
