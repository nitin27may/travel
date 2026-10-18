# L1: home and inspiration, and the global search

Wave 2, parallel with L2 to L5. Agent: `travel-builder` (Sonnet). Effort: about 3 hours.
Plan: [README.md](README.md). Starts after L0, LD and LM are merged.

## Goal

`/` as patterns 3.1: the live globe as a 60% cover with the search centred, then a Trips strip, a Places strip and
"About the data". The header's search (and `/`) opens one search over trips and places. No sign-in prompt above the
fold. First paint under 1.5 s on a mid-range phone: the globe loads after the first strip.

## Read first

- `docs/v2/design/foundation/patterns.md` 3.1, 2 (public list grid), 6 (globe spin, reduced motion);
  components.md 2.10 (search), 3.1 (cards), 7.2 (pins), 6.1 and 6.2.
- `docs/v2/design/redesign/trailhead/home.html` for card anatomy only (it is the planner home; the foundation wins).
- `docs/v2/design/keep-from-live-site.md` (Trips cards: real photos, countdown, summary).
- L0's components and the `GlobalSearch` stub props; LD `listTrips()`, `listPlaces()`, `globeIndex()`; LM `MapSurface`.

## Files you own

`web/app/page.tsx`, `web/components/home/**`, `web/components/search/GlobalSearch.tsx` (from the L0 stub),
`web/lib/search/**` (the client index), `web/styles/home.css`, `web/tests/home/**`, `web/tests/e2e/home*.spec.ts`.

## Do not touch

`web/components/globe/**` and `web/lib/globe/**` (L2): use the globe through L2's exported `<GlobeCanvas mode="cover">`
when it exists; until L2 merges, render a MapLibre globe through LM's `MapSurface` with country-count pins from
`globeIndex()` and keep the swap to one import line. Everything else outside your files.

## Steps

1. **Cover.** 60% viewport height (phone 420 px), full bleed under the header. Globe with auto-spin (one revolution
   per 90 s, off under reduced motion), country pins as ink discs with counts (amber only on hover), the search field
   centred (420 px, serif 16, `/` kbd) and the hint bar. Clicking a pin goes to `/globe/<cc>`; the search opens
   `GlobalSearch`. Load the globe after the first strip is painted (`requestIdleCallback` or an
   IntersectionObserver), with a `--well` skeleton and a static caption until then.
2. **Trips strip.** "Trips" section title, the 6 newest listed trips as public trip cards (photo, title, meta one
   line, neutral countdown chip, depth chip for summary and overview trips, serif summary), "All <n> trips →" from the
   real count (7 today). Phone: horizontal scroll with snap.
3. **Places strip.** "Places worth a trip": 8 place cards chosen by a stable rule (has a credited photo, Usable or
   better, spread across countries; tie-break by name), kind glyph when no photo, area chain, kind chip, completeness
   badge. "All <n> places →" with n from `listPlaces().length`.
4. **About the data.** One paragraph explaining sources, the honesty markers (show each chip once with its meaning)
   and the completeness badge, linking to `/about/data/`.
5. **Global search.** Client index built at build time from LD (trips: title, region, countries; places: name, aka,
   area chain, kind): diacritics removed, prefix plus trigram scoring (tech.md "Predictive search"). Results grouped
   Trips · Places · Areas with counts; arrow keys, Enter opens; Esc clears then closes; the live count is a polite
   region. Opens as a popover under the header on desktop, a full-height sheet on phone. Empty result: "No trip or
   place matches 'xyz'. Try a country or a kind, like lake."
6. **Credits footer** on the page for every photo shown.

## Acceptance checks

| # | Check | Against |
|---|---|---|
| 1 | Cover, Trips strip, Places strip, About the data, in that order; no sign-in prompt above the fold | patterns 3.1 |
| 2 | Cards use the foundation anatomy; meta never wraps; countdown neutral; real photos with credits | components 3.1, keep-from-live-site |
| 3 | Nothing amber at rest on the globe | changes-from-preview 23 |
| 4 | Counts come from data ("All 7 trips", "All <n> places"), never typed | keep-from-live-site (live count) |
| 5 | `/` focuses search from anywhere outside an input; results on the first character; under 16 ms per keystroke for the current data | components 2.10, tech.md |
| 6 | Lighthouse mobile (throttled) on the static build: first contentful paint under 1.5 s; MapLibre not in the initial bundle | patterns 3.1 |
| 7 | Reduced motion: no spin, jumps instead of flights | tokens 11 |
| 8 | No private trip anywhere on the page or in the search index | README 2.3 |

## Verification

```
pnpm --dir web typecheck && pnpm --dir web lint && pnpm --dir web test
pnpm --dir web build && pnpm --dir web e2e
```

Screenshots with the L0 harness: `/` (full page, tiled), the search open with results, the search with no result,
at 1440 x 900 and 390 x 844, light and dark.

## Commit rules

Worktree `/home/nitin27may/workspace/travel-wt/v2-L1`, branch `public/L1`, dev port 3411. Commits: search index
and GlobalSearch; home sections; cover globe. `git -C <worktree> add <owned paths>`, never `-A`. Message
`web(public/L1): ...` with your Co-Authored-By trailer. Rebase onto the v2 branch, do not push.
