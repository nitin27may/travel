# Clickable prototype (working draft, 18 Oct 2026)

> **Retired 22 Oct 2026 (CLN-3).** The `prototype/` folder is gone. Restore it with `git checkout archive/prototype-2026-10-22 -- prototype`. Its four data files live in `data/seed/prototype/`; the snapshot script reads them there. The run steps below apply to the restored folder only.

Published privately: https://claude.ai/artifact/CXW1R6aixJEy3Lmufx16Hv (rebuild with `pnpm build:artifact`, then republish `dist-single/artifact.html` with the two relief images).

`prototype/` is a throwaway front-end that tests the experience, the rendering libraries and the
interactions in docs/v2/design/interactions.md on real data: the Dolomites trip (13-26 Jul 2027) from
`legacy/dolomites-july-2027/PLAN.md`. It has no backend; every change lives in memory with undo.

## Run it

```
cd prototype
pnpm install --ignore-workspace     # its own lockfile; not part of the pnpm workspace
# pnpm 12 gotcha: --ignore-workspace still resolves the repo root as the workspace and installs into
# prototype/prototype/node_modules (and edits the root lockfile). If vite cannot resolve 'vite', run
# `npm install` instead (every version in package.json is pinned exactly); package-lock.json stays uncommitted.
pnpm dev                            # bundles MapLibre's worker, then starts Vite
pnpm build:artifact                 # one self-contained HTML file + the two relief images, for publishing
```

## What it proves

| Interaction | Where | Status |
|---|---|---|
| Predictive add: first-letter matching, diacritics ignored, ranked "in this trip" → near tonight's base → elsewhere, drive time from the base and a fit chip on every row, "9:30 seceda day 12" parsed into time and day, add your own place, paste a link | every day and list (add box) | working |
| Already planned → **move** instead of duplicating | add box | working |
| Set where you sleep, for 1-6 nights, candidates ranked by total drive time to the day's stops | "Sleep:" under each day | working |
| Drag between days and lists; drop on a day in the outline; the day under the card shows its **predicted change in driving** before the drop; the map follows the target day and draws the new leg dashed | plan document + outline + map | working |
| Keyboard move (Space, arrows, Space) with spoken announcements | cards | working (dnd-kit) |
| **Day as a timeline**: time down the left, a rail with stops as nodes (height follows how long you stay) and travel as rail segments (solid drive, dotted walk), free time and clashes between stops ("arrives 9 min after 16:30"), sunrise and sunset where they fall, home base at both ends with leave and back times, split days as side-by-side lanes | each day | working |
| Outline grouped by where you sleep, each day with a mini shape (drive vs stops, 05:00-22:00) and a warning dot | left column | working |
| Ideas and lists on a collapsible shelf above the days; it opens while you drag | plan document | working |
| Trailheads: a walk that starts at its car park (Sorapis from Passo Tre Croci) is a short walk, not a drive to the lake | timeline, totals, map | working |
| Legs between every pair of stops and day totals (driving, walking, climb, sunset) that **count** to new values with a delta chip | day sections | working; drive times are estimates (≈), straight line × 1.42 mountain factor |
| Real sunset times from `core/src/sun` (the repo's tested sun code, imported directly) | day header | working |
| Map: own shaded relief in light and true dark, numbered pins matching the document, base as a house, focus-day route with halo, other days faint, leg labels | right column / phone sheet | working |
| Drag your own pin on the map; legs update **during** the drag | custom places | working |
| Right-click / long-press the map: nearest catalog places first, or drop a pin as your own place | map | working |
| Undo for every change (toast, Ctrl/Cmd+Z) | everywhere | working |
| Phone: day pager (swipe), map in a bottom sheet with three snap points, long-press to drag | ≤ 760 px | working |
| Themes: system, light, dark (near-black), sunlight (high contrast for outdoors) | rail / top bar | working |
| Other screens: trips home and year, new trip, templates and adapt, bookings and wallet, tasks, budget, Today, share sheet and guest view, settings, explore, place page, admin review | navigation | see each screen |

## What it does not prove

- Real map tiles: the published copy cannot fetch tiles (the artifact sandbox blocks external hosts), so
  it ships its own relief rendered from AWS Terrain Tiles plus Natural Earth borders and rivers. The app
  uses OpenFreeMap vector tiles online and PMTiles offline (tech.md).
- Routed drive times, live collaboration, persistence, auth, the MCP: all specified elsewhere, not here.
- Coordinates are approximate and the hotels are labelled examples.

## Attribution

Relief: AWS Terrain Tiles (Mapzen terrain, open data; sources include SRTM and others). Borders and
rivers: Natural Earth (public domain). Trip facts: PLAN.md, 2026 operator data, re-verify for 2027.
