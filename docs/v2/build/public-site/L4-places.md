# L4: places search and the place and trail pages

Wave 2, parallel with L1, L2, L3, L5. Agent: `travel-builder` (Sonnet). Effort: about 9 hours.
Plan: [README.md](README.md). Starts after L0, LD and LM are merged.

## Goal

1. `/places`: the live Places page on the foundation (patterns 3.5): every kind, filter pills per dimension, four views
   (Map switched on), grouping by country, table tools, honesty markers, completeness badges.
2. `/places/<slug>`: one frame for every kind (patterns 3.6): facts with text provenance, trailhead and parking,
   the link checklist as tabs, elevation profile, Google and Apple Maps directions, gallery with credits. Trails use
   the 18 researched Dolomites trails.

## Read first

- `docs/v2/design/foundation/patterns.md` 3.5, 3.6, 1.2 (places URLs, list-state keys), 2; components.md 1.5, 2.7,
  2.8 (honesty chips), 3.1 (place card footer), 4.2, 4.4, 4.5, 7.1.
- `docs/v2/design/redesign/trailhead/places.html` and `trail.html` (superseded for colour; links become tabs,
  hazards above the fold: changes-from-preview 3, 18, 23).
- `docs/v2/design/keep-from-live-site.md` Places section; `docs/v2/design/live-site/places*.png`.
- `research/reports/map-stack-2026-10-18.md` (place pages: Google JS behind the flag, Embed fallback, MapLibre until
  the key exists; one family per page; Directions = Maps URLs to our points).
- `research/method/kinds/README.md` 5, 6, 10; `prototype/src/screens/PlacePage.tsx` and `TrailPanels.tsx` for content
  (not code to copy).
- LD `listPlaces()`, `getPlace()`, `placeSlugs()`, `legacyPlaceRedirects()`; LM `MapSurface`, `placePageFamily()`,
  `links.ts`.

## Files you own

`web/app/places/**` (list page, the `[slug]` stub, and the removal of `[cc]/[region]/[area]/[place]` once LD's
redirects are in), `web/app/locations/**`, `web/components/places/**`, `web/lib/entities/descriptors/place.tsx`,
`web/styles/places.css`, `web/tests/places/**`, `web/tests/e2e/places*.spec.ts` (including `places-parity.spec.ts`;
update it, never weaken it).

## Do not touch

`web/components/entity/**`, `web/components/ui/**` (L0), `web/components/actions/**` (L5), `web/lib/public/**` (LD),
`web/lib/map/**` (LM), trips files (L3), `web/redirects.json` (LD).

## Steps

### Places search

1. Pills Country, Kind, Status, Kids, Season, Tag, Plan, each a menu with live counts; Kind lists every kind present
   with its glyph (trail, lake, viewpoint, waterfall, sight, town, area, scenic drive, activity, lift, stay, eatery,
   hut, ...). Search with `/` and the live count. Views Cards · List · Table · Map. Group by country with sticky
   headings and counts (collapsible in Table).
2. Cards: photo with credit or the kind glyph on `--well`; area chain; chips kind, status (Planned; Idea dashed),
   season months, kids (Kid friendly; Strong kids only); completeness badge; honesty markers ("Location unconfirmed",
   "Unverified", "No source yet", source counts "Instagram post +1"); footer "Place page · Globe" (Globe =
   `/globe/place/<slug>`).
3. Table: columns kind with icon, status (filled ink dot Planned, dashed ring Idea, check Done), region, area,
   season, kids, elevation right-aligned, sources, completeness; tools row Saved views, Columns, Density
   (Compact / Comfortable), Export CSV of the current filter and columns.
4. Map view on through `renderMap` in the place descriptor (L0's slot; MapLibre through `MapSurface`), clustered pins, selection card, `?view=map&c=`; the list page is a
   `maplibre` page.
5. Pager 48 / 100; URL state in the patterns 1.2 key order; `/locations/*` keeps redirecting.

### Place and trail page

6. **Cover** 560 (trail) or 420 (other kinds), kicker white 80% ("Trail · Auronzo · Sesto Dolomites"), title, summary,
   actions: **Save to a trip** (visitors: the notice "Sign in to add this to a trip" with Copy link and GPX), GPX
   (`ExportMenu` with gpx, kml where licensed), Share. Breadcrumbs Places · Italy · Sesto Dolomites.
7. **Glance strip**: six facts, each with value and a text provenance line ("operator · read 18 Oct 2026"); conflicts
   shown as a caution chip with both values and sources (fee disagreements); honesty chips where a fact is inferred.
8. **Left column**: The route (elevation profile, components 4.4: ink line and 10% area, amber cursor only on
   scrub, synced to the map marker through `MapHandle.setCursor`; hut list) · Trailhead and parking (facts, fee,
   capacity, booking window callout without "Remind me" for visitors, point and `point_source` as text) · When to go
   (season strip) · Who it suits (fit chips, honesty chip). Hazards above the fold on trails.
9. **Right column**: map, Directions (Google Maps URLs to the parking point for lift-start trails, as the prototype
   does; Apple Maps beside it), "from the base" distance when stored, Hazards, **Links as tabs by group** (Official ·
   Booking · Route · Conditions · Report with counts; `searched_none` shown as "searched, none found on <date>")
   with "every link checked <date>".
10. **Map family**: the page uses `placePageFamily()`; today that is `maplibre` (no key), drawing trailhead, parking
    and the OSM line where stored. With `google-js` the same pins and line go on the Google map behind the
    click-to-load facade; with `google-embed` the page shows the embed and lists the points under it. The sidebar
    mini map and the route map are the **same family**; register the page in LM's registry.
11. **Other kinds** use the same frame with their facts: lake (swim, boats, parking), viewpoint (light, walk from the
    car), sight (hours, last entry, ticket), stay (check-in, cancellation), activity (ages, duration, booking window),
    area (the places inside it as rows). Facts missing for a kind show the honest empty line ("No hours recorded
    yet"), never a blank.
12. **Gallery** with credits; **completeness** badge with the tooltip from LD; credits footer.
13. `generateStaticParams` from `placeSlugs()`; remove the old nested route after confirming LD's redirects cover
    every old URL (test).

## Acceptance checks

| # | Check | Against |
|---|---|---|
| 1 | Places keeps the seven pills with menus, photo or glyph cards, area chain, chips, honesty markers, source counts, footer links, country groups with sticky headers, table tools (saved views, columns, density, CSV), collapsible groups, the column set, Map view with URL state | keep-from-live-site Places |
| 2 | Every kind in the data is filterable and opens a page with its own facts | patterns 3.6, README 2.4 |
| 3 | Provenance is text, never a coloured dot; conflicts show both values | changes-from-preview 3 |
| 4 | Elevation profile ink at rest; amber only for the scrub cursor and dot; the map marker follows | components 4.4, gate B4 |
| 5 | Links are tabs by group with counts and the checked date; hazards above the fold on trails | changes-from-preview 18 |
| 6 | Directions and Apple Maps open our stored parking or trailhead point; lift-start trails go to the valley car park | map-stack research, TODO Done row 0673ca9 |
| 7 | One map family per page; with the flag set to `google-js` and the fake key the facade appears and no MapLibre loads | LM check 4, terms 3.2.3(e) |
| 8 | The unconfirmed trail points from the Open TODO row carry "Location unconfirmed" | README 2.6 |
| 9 | Every old `/places/<cc>/<region>/<area>/<place>/` URL redirects to `/places/<slug>` | patterns 1.2, README 7 |
| 10 | No private trip name on any place card or page | README 2.3 |
| 11 | axe clean; no horizontal scroll at 390; table scrolls in its container with the first column sticky | components 4.2 |

## Verification

```
pnpm --dir web typecheck && pnpm --dir web lint && pnpm --dir web test
pnpm --dir web build && pnpm --dir web e2e
NEXT_PUBLIC_PLACE_MAP_FAMILY=google-js NEXT_PUBLIC_GOOGLE_MAPS_KEY=fake pnpm --dir web build   # facade path builds
```

Screenshots with the L0 harness at 1440 x 900 and 390 x 844, light and dark: `/places/` in the four views, a Kind
pill open, the table grouped and compact; `/places/tre-cime-di-lavaredo-loop` full page tiled with the profile
scrubbed; `/places/lago-di-braies`; a viewpoint, a town, an area and a Draft place with honesty markers.

## Commit rules

Worktree `/home/nitin27may/workspace/travel-wt/v2-L4`, branch `public/L4`, dev port 3414. Commits: places search and
map view; place frame and facts; trail sections (profile, access, links); other kinds; route migration and redirects
test. `git -C <worktree> add <owned paths>`, never `-A`. Message `web(public/L4): ...` with your Co-Authored-By
trailer. Rebase onto the v2 branch, do not push.
