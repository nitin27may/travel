# L2: the full-screen globe

Wave 2, parallel with L1, L3, L4, L5. Agent: `travel-builder` (Sonnet). Effort: about 9 hours.
Plan: [README.md](README.md). Starts after L0, LD and LM are merged.

## Goal

`/globe` as patterns 3.2 and components 7.2: a full-bleed MapLibre globe under the header with relief, styles,
terrain, drill-down (country, state, district), saved places and published trips as pins by continent and country,
a floating control card, a side panel, a selection card, smooth fly-in, search that flies anywhere, and reduced
motion. It replaces `legacy/globe/` feature for feature (keep-from-live-site.md "Globe") with better animation, and
every state has a URL.

## Read first

- `docs/v2/design/foundation/components.md` 7.2 (all), 1.5 (breadcrumb chip), 5.5 (peek sheet); patterns.md 3.2, 6
  (globe row: spin 1 rev / 90 s, decay 400 ms, fly-in 1200 ms zoom then tilt, resume after 20 s idle), 1.2 (globe URLs);
  tokens.md 5 (`--globe-pin`, `--globe-pin-pick`), 11.
- `docs/v2/design/keep-from-live-site.md` Globe section and `docs/v2/design/live-site/globe.png`.
- `legacy/globe/index.html` (the logic to port: styles, terrain and the Terrarium fallback, `TERRAIN_MIN_ZOOM`,
  `tally`, `topoFeatures`, `bbox` with the antimeridian, `centroid`, `inFeature`, `loadAdmin`, hit testing, hash
  state, prefs in localStorage) and `legacy/globe/assets/data/*` (countries, countries-50m, gazetteer, places) and
  `assets/admin/*-ADM1/ADM2.json`.
- LD `globeIndex()`, `globePaths()`, `getPlace()`, `getTrip()`; LM `web/lib/map/maplibre` (style, terrain helpers).

## Files you own

`web/app/globe/**` (from the L0 stubs), `web/components/globe/**`, `web/lib/globe/**`, `web/public/globe/**`
(copies of the legacy data and admin files the port needs), `web/styles/globe.css`, `web/tests/globe/**`,
`web/tests/e2e/globe*.spec.ts`.

## Do not touch

`legacy/globe/**` (read and copy only; the live page stays until go-live), `web/lib/map/**` (LM; ask for changes in
the hand-back), `web/components/ui/**` (L0), everything else outside your files.

## Steps

1. **Port the logic** from `legacy/globe/index.html` into typed modules in `web/lib/globe/` (geometry, admin
   loading, hit testing, prefs), with unit tests for `bbox` across the antimeridian (Fiji, Russia), `inFeature`
   with holes, and `tally`. Keep the Terrarium fallback and the rule that terrain only turns on above
   `TERRAIN_MIN_ZOOM` (seams on the globe at low zoom).
2. **Canvas.** Full-bleed under the 60 px header (56 on phone), MapLibre globe projection through LM's style
   builder; theme-aware; attribution always visible. Export `<GlobeCanvas mode="full" | "cover">` for L1.
3. **Pins.** World: one pin per country with content, ink disc with a surface mono 600 count, 28 to 44 px by count,
   2 px halo; hovered or selected pin alone turns amber with the select ring. Continents group the side panel.
   Country: state pins. State: district pins and place dots (`--map-stop`, kind glyph on hover). Published trips: a
   pin at the first base (no identity rings for visitors). Co-located pins merge with a count and fan out.
4. **Controls** (components 7.2): control card bottom-left (Style Relief · Light · Dark; 3D terrain switch with the
   relief slider 0.5x to 2x; Auto-spin switch, disabled with "Off: reduced motion"); search top-centre 420 px
   ("Search a country, state, city, sea or range", from `gazetteer.json` plus LD places and trips); breadcrumb chip
   top-left (World › Italy › South Tyrol) with Back; hint bar bottom-centre, hidden after the first interaction;
   side panel right 360 px, collapsible to a 44 px tab, listing saved places and trips by continent and country with
   flags and counts. Hover a country: soft amber fill at 35% and a facts tooltip (name, places, trips); selected
   country: 2 px amber outline.
5. **Selection card.** Selecting a place or trip pin opens the card (photo with credit, name, area chain, kind chip,
   completeness badge, "Open place" or "Open trip" primary), anchored to the pin on desktop, a peek sheet on phone.
   Never a new page. Open goes to `/places/<slug>` or `/trips/<slug>`; Back returns to the same camera (store the
   camera in `?c=` and in history state).
6. **Motion.** Auto-spin 1 revolution per 90 s; pointer down decays spin over 400 ms; resumes after 20 s idle;
   fly-in to a country 1200 ms zooming then tilting (terrain on when enabled); interruptible at any frame; reduced
   motion jumps, no spin, 120 ms fades.
7. **URLs.** `/globe`, `/globe/<cc>[/<state>[/<district>]]`, `/globe/place/<slug>` (flies in, opens the card),
   `/globe/trip/<slug>` (fits the trip). `generateStaticParams` from `globePaths()`, `placeSlugs()`, `tripSlugs()`;
   other paths reach the page through LD's `/globe/*` rewrite and are resolved client-side from `location.pathname`.
   `pushState` on drill-down so Back steps up one level; Esc also steps back.
8. **Phone.** The panel becomes a 120 px peek sheet listing countries; the control card becomes one "Map options"
   button opening a sheet; the search is full width under the header.
9. **Keyboard and screen reader.** Tab reaches the search, the panel and the pins in list order; Enter flies in;
   Esc steps back; the side panel is the list equivalent of the canvas.
10. **Register** the page as `maplibre` in LM's family registry.

## Acceptance checks

| # | Check | Against |
|---|---|---|
| 1 | Every live-globe feature exists: 3D relief, drag to spin, scroll to zoom, hover facts, click to fly in, drill country › state › district, Relief/Light/Dark, 3D terrain with relief slider, Auto-spin, saved-place pins, side panel by country with flags and counts, search for country/state/city/sea/range, breadcrumb chip, hint bar | keep-from-live-site Globe |
| 2 | Full screen: no page scroll; everything else floats | patterns 3.2, components 7.2 |
| 3 | Nothing amber until pointed at; pins are ink at rest | changes-from-preview 23, gate B4 |
| 4 | Selecting a pin opens the selection card, never a page; Open and Back keep the camera | patterns 3.2 |
| 5 | Every state is a URL; reloading any URL restores it | patterns 1.2 |
| 6 | Motion timings as patterns 6; interruptible; reduced motion jumps and does not spin | patterns 6, tokens 11 |
| 7 | 60 fps spin on a mid-range laptop at 1440; no long task over 200 ms while drilling into Italy | tech.md performance |
| 8 | Phone: peek sheet, Map options sheet, one-hand reach for search and Back | patterns 3.2 |
| 9 | No private trip pinned | README 2.3 |

## Verification

```
pnpm --dir web typecheck && pnpm --dir web lint && pnpm --dir web test
pnpm --dir web build && pnpm --dir web e2e
```

Screenshots with the L0 harness at 1440 x 900 and 390 x 844, light and dark: `/globe` (World, spin paused),
`/globe/it`, `/globe/it/south-tyrol`, `/globe/place/lago-di-braies` (selection card), `/globe/trip/dolomites-2027`,
the control card with terrain on, the phone peek sheet and Map options sheet. Headless Chromium may not render vector
tiles; run the shots headed or with `--use-gl=angle` and keep each probe short (memory: travel globe build).

## Commit rules

Worktree `/home/nitin27may/workspace/travel-wt/v2-L2`, branch `public/L2`, dev port 3412. Commits: logic port with
tests; canvas and pins; controls and panel; selection card and URLs; phone. `git -C <worktree> add <owned paths>`,
never `-A`. Message `web(public/L2): ...` with your Co-Authored-By trailer. Rebase onto the v2 branch, do not push.
