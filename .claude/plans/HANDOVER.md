# Handover: travel platform v2 planning + prototype (18 Oct 2026)

Pick this up on any machine:

```
git fetch origin claude/serene-goldberg-wtn3di
git checkout claude/serene-goldberg-wtn3di
```

Everything below is committed on that branch. Nothing lives only on the old machine except the
throwaway caches noted in section 7.

## 1. What this work is

A **clean-slate design for a trip-planning product** (to replace the hand-built legacy pages in `legacy/`
over time), plus a **clickable prototype** of the experience. Owner: Nitin (family travel, Whitby ON).
Status: **planning and prototyping only. No production code, no database, nothing deployed.** All plans
are a **working draft**; anything marked "decided" is current direction and can be reopened.

## 2. Where things are

| Path | What |
|---|---|
| `.claude/plans/v2/` | symlink to `docs/v2/`: the whole plan (read its `README.md` first) |
| `docs/v2/README.md` | index of every plan document and folder, with the tracker |
| `docs/v2/01-domain-model.md` … `11-quality-and-delivery.md` | core design: domain model, experience, MCP and research, stack, roadmap, decisions, competitors (Wanderlog/TripIt), self-hosting, reservations, sharing, quality and delivery |
| `docs/v2/schema.sql` | Postgres + PostGIS schema, 63 tables; loads cleanly on Postgres 16 + PostGIS 3 |
| `docs/v2/features/` | 17 feature pages (F01-F17) with stories, behaviour, acceptance criteria, milestone |
| `docs/v2/ux/` | navigation and layout rules, 27 screen pages (S01-S27) with wireframes, ~80 components, tokens and patterns |
| `docs/v2/research/` | research system: trip-type profiles, 17 lane contracts (trails with links, trailhead, parking), sources and licences, skills and prompts, onboarding and refresh |
| `docs/v2/mcp/` | MCP server: 29 tools with schemas and examples, scopes, resources, prompts, client recipes, security |
| `docs/v2/migration/` | inventory of this repo and how each trip and dataset is imported |
| `docs/v2/design/` | design system (identity, light and true-dark tokens, type, motion, map styling), interaction specs, technology choices incl. the map stack, prototype notes |
| `docs/v2/06-questions.md` | every decision and open question with its current answer |
| `docs/v2/reference/` | the owner's Wanderlog screenshots |
| `prototype/` | the clickable prototype (Vite + React 19 + MapLibre 6 + dnd-kit + Motion), own lockfile |
| `docs/BLUEPRINT.md` | the earlier blueprint, superseded in part by docs/v2 |

## 3. Current direction (working draft)

- **Stack:** self-hosted **Supabase** (Postgres + PostGIS, Auth incl. OAuth 2.1 for MCP, Realtime,
  Storage) on the owner's Ubuntu box with Docker (a Supabase Cloud trial is also acceptable); **Next.js 16**
  app with **Hono** mounted for `/api` and `/mcp`; a Node **worker** container (reminders, jobs, email
  import, backups); **Cloudflare Tunnel** for public HTTPS. See `docs/v2/08-self-hosted.md`
  (supersedes the Neon/Better Auth/Vercel reasoning kept in `04-stack.md`).
- **Audience:** family first, public later. **Live co-editing** like Wanderlog (Realtime broadcast of ops).
- **We never book anything:** users record reservations (flights, stays, cars, tickets) or keep them as
  "to book" with tasks and reminders (`09-reservations.md`). Sharing everywhere (`10-sharing.md`).
- **Maps:** MapLibre + OpenFreeMap online + PMTiles offline; drive times from OpenRouteService then
  self-hosted OSRM/Valhalla; place search from our catalog + Photon/Nominatim + Wikidata; **Google only as
  a "Navigate" link** (terms forbid storing or showing its data off its map). `design/tech.md`.
- **Research:** changesets with evidence, reviewed before publishing; owner runs research from Claude Code
  skills or any chat client via MCP. New research is recorded as changesets, not `research/trips/*.md`.
- **Templates:** owner's trips become templates visible to invited family and friends first.
- **Legacy site:** 7 pages marked `"private": true` in `legacy/MANIFEST.json` (5 past trips, Norway,
  Utah). `tools/publish.py` stages a noindex placeholder and overwrites their assets; **not yet deployed**:
  takes effect on the next `./publish.sh` from the owner's machine. Tests: `python3 -m pytest tools/tests -q` (162 pass).

## 4. The prototype

Published privately (opens in a browser when signed in to claude.ai):
**https://claude.ai/artifact/CXW1R6aixJEy3Lmufx16Hv** (version 2).

Run locally (real dev server; online map tiles are not wired yet, it uses the bundled relief):
```
cd prototype
pnpm install --ignore-workspace     # own lockfile, not part of the pnpm workspace
pnpm dev                            # builds MapLibre's worker bundle, then starts Vite
pnpm build:artifact                 # single-file build in dist-single/ (artifact.html + 2 relief images)
npx tsc --noEmit                    # typecheck
```
To republish the same link from Claude Code: publish `prototype/dist-single/artifact.html` with `url`
set to the link above and `files` = the two `relief-*.webp` in `dist-single/`.

What works (details in `docs/v2/design/prototype.md`):
- **Plan screen** on the real Dolomites trip (13-26 Jul 2027): days as a **timeline** (time spine, travel
  as rail segments, free time and clashes with a one-tap "Let it follow" fix, sunrise/sunset from
  `core/src/sun`, leave/back at the night's base, split-day lanes); outline grouped by where you sleep with
  a mini day shape; Ideas shelf; **place search** (`/`) with map preview pin and add/move to any day;
  per-day add box (predictive, "9:30 seceda day 12", move-not-duplicate); set where you sleep; **drag**
  within a day (reorder releases the moved stop's fixed time) and between days/lists/outline with a
  predicted driving delta and dashed map preview; draggable own pins; right-click/long-press to add
  from the map; undo everywhere; phone day pager + map bottom sheet; themes light / true dark / sunlight.
- **Other screens** (each with local state): trips home and travel year, new trip (intent sheet, trip
  types, candidates), templates with adapt preview, bookings (timeline, forms, paste/forward, wallet),
  tasks, budget, Today, share sheet with live recipient preview, guest view, settings (household,
  notifications, MCP clients, tokens), explore, place page (trailhead, parking, links, evidence), admin review.
- Map basemap is our own shaded relief (AWS Terrain Tiles, rebuilt by `prototype/scripts/make_relief.py`)
  plus Natural Earth borders/rivers (`scripts/clip_basemap.py`), because the artifact sandbox cannot load tiles.

Known rough edges (next work):
1. Screens don't share state (a booking added in Bookings doesn't reach Plan). Move to the shared store.
2. Ideas list items still use the old card style; Today's timeline doesn't match the new day timeline.
3. Drive times are estimates (straight line × 1.42); no real tiles or routing in the prototype.
4. Hotels are labelled examples; coordinates approximate.
5. Online mode (OpenFreeMap vector tiles when reachable) not implemented in MapView yet.

## 5. What the owner asked for most recently (in order)

1. Treat plans as working drafts, not final.
2. UI/UX is make-or-break: research it, prototype every screen, original identity (not copied), light truly
   light, dark truly dark and easy on the eyes. Done; latest palette is neutral (spruce green actions,
   alpenglow accent only for "now/here").
3. Cards and timeline were not good enough. Redesigned as the timeline above.
4. Place search, drag within a day (place 2 before place 1). Done.
5. A link to review on a laptop. The artifact link works in any browser; a Cloudflare Tunnel cannot run
   from the cloud sandbox (all tunnel hosts blocked). On the owner's own machine:
   `cd prototype && pnpm dev` then `cloudflared tunnel --url http://localhost:5173`.

Owner's working style (from preferences): wants pushback, not agreement; direct, concise; no flattery.

## 6. Suggested next steps

1. Owner reviews the prototype (search, reorder, timeline, colours in both themes) and gives feedback.
2. Fix the rough edges in section 4 (shared state first).
3. Decide brand and domain (needed for the tunnel, sign-in, reminder emails) and confirm the home server.
4. Start **M0** (`docs/v2/11-quality-and-delivery.md` section 7 lists 10 tasks): Docker Supabase stack,
   migrations from `schema.sql`, Supabase Auth, the op layer, Hono API + MCP, OAuth 2.1 spike, Realtime,
   backups, CI. Only after the owner says the plan is ready.

## 7. Environment notes for the next session

- Cloud sandboxes here allow npm, PyPI, GitHub raw and AWS S3 (terrain tiles); map tile, routing,
  geocoding and Cloudflare tunnel hosts are blocked. A local machine has none of these limits.
- Playwright: Chromium at `/opt/pw-browsers/chromium` in the cloud image; `prototype` has
  `playwright-core` as a dev dependency for screenshots (launch with `--use-gl=swiftshader`).
- Not in git (rebuildable): `prototype/node_modules`, `prototype/src/vendor/maplibre-worker.js` (built by
  `pnpm run worker`), `prototype/dist*`, `prototype/.cache` (DEM tiles and Natural Earth downloads).
- Each screen's CSS is scoped under `.scr-<screen>` (see the header comment `/* scoped */` in
  `prototype/src/screens/*.css`); new screens must follow that or styles leak across screens.
- The legacy site still publishes with `./publish.sh` (needs `npx wrangler login --device` on the owner's machine).
