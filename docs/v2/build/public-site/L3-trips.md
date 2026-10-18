# L3: trips search and the trip page

Wave 2, parallel with L1, L2, L4, L5. Agent: `travel-builder` (Sonnet). Effort: about 9 hours.
Plan: [README.md](README.md). Starts after L0, LD and LM are merged.

## Goal

1. `/trips`: the live Trips page on the foundation (patterns 3.3) with all its tools and the Map view switched on.
2. `/trips/<slug>`: the owner's top public ask (patterns 3.4): cover, season band, route map, the six-category strip
   with By day / By category, fourteen uniform day rows in chronological order, copy and export, credits. It is
   honest about depth: full, summary (condensed) or overview.

## Read first

- `docs/v2/design/foundation/patterns.md` 3.3, 3.4 (all of it, including the kind table, the rules and Phone),
  3.7, 1.2 (trips URLs and anchors), 2 (public list and detail grids), 8.5 pager.
- components.md 2.7 to 2.10, 3.1, 3.2, 4.2, 4.3 (row anatomy), 4.5, 5.4, 6.1, 6.2, 7.1.
- `docs/v2/design/redesign/trailhead/public-trip.html` for cover, season band and day-row look only; **superseded for
  structure and colour** (changes-from-preview 1, 7).
- `docs/v2/design/keep-from-live-site.md` Trips section; `docs/v2/design/live-site/trips.png`.
- LD `listTrips()`, `getTrip()`, `tripSlugs()`; LM `MapSurface`; L0 `CopySheet`, `ExportMenu`, `ShareButton` stub props.

## Files you own

`web/app/trips/**` (list page and the `[slug]` stub), `web/components/trips/**`, `web/lib/entities/descriptors/trip.tsx`,
`web/styles/trips.css`, `web/tests/trips/**`, `web/tests/e2e/trips*.spec.ts`, and the existing `url-state.spec.ts`
cases for trips.

## Do not touch

`web/components/entity/**` and `web/components/ui/**` (L0; ask in the hand-back), `web/components/actions/**` (L5:
render them, do not edit them), `web/lib/public/**` (LD), `web/lib/map/**` (LM), places files (L4).

## Steps

### Trips search

1. Toolbar: search with `/` and the live count; pills When, Source, Country, Kids (patterns 3.3); view segment Cards ·
   List · Table · Map. Subbar: count, Group by, Sort by, direction. Groups Upcoming and Past (Past: desaturated photos;
   "Use as a template" appears only when signed in, so not now). Sticky group headings with counts.
2. Cards: photo with credit, title two lines max, meta one line (dates · nights · route), neutral countdown chip,
   "Public page" link chip (to `/trips/<slug>`) and "Original plan" link chip (legacy page), depth notice chip for
   summary and overview, serif summary three lines.
3. Table: columns title, dates, nights, countries, bases, drive per day (≈ when estimated), kids, depth; the tools row
   from L0 (Saved views, Columns, Density, Export CSV). List view: list rows.
4. Map view: supply `renderMap` in the trip descriptor (L0's slot), one pin per trip at its
   first base, selection card with the cover photo; `?view=map&c=lon,lat,zoom`.
5. Pager at 48 cards / 100 rows; URL state per patterns 1.2 key order.

### Trip page

6. **Cover** 620 px (phone 420): photo, gradient 10% to 88%, kicker white 80% ("Published plan · South Tyrol and
   Veneto, Italy"), title `--t-cover`, standfirst serif 21, chips (14 days, 4 bases, drive ≈1 h 10 a day, effort, ages,
   by Nitin), actions **Copy to my trips** (primary, opens `CopySheet`), Export (`ExportMenu` with pdf, ics, gpx, kml,
   csv), Share (`ShareButton`). Glance strip overlapping the cover by 46 px.
7. **Season band**: "This plan is valid for" + window in `--t-trip`, the why, the 12-month `SeasonStrip`, weather tiles
   sized to content, warnings (events that affect days, from LD).
8. **The route**: `MapSurface` with every day's stops as 6 px dots, bases as signposts, lines `straight-estimate` with
   the legend note; picking a day row highlights that day (numbered pins, `route-pick`) and flies to it.
9. **In this trip**: the category strip of six chips with counts, then the By day / By category segment
   (`?view=category`). Follow patterns 3.4 exactly:
   - By day (default): uniform day rows (quiet DAY 03 sign, 96 x 68 thumbnail, `--t-card` title, mono base · drive,
     serif stop list), expandable to stops with legs; `#day-3` anchors; chronological, never re-sorted. Rockies days
     with tracks show a Track A · B · C segment inside the expanded row; the collapsed row lists track B (family) by
     default and says "3 options". **Superseded 18 Oct 2026** by the trip-level party profile and day timelines in
     [features/trip-timeline.md](../../features/trip-timeline.md) (lane [L3c](L3c-trip-timeline.md)).
   - By category: six sections in fixed order; list rows with kind glyph, name, area, the day sign ("Day 3 · 11:30",
     "Day 3 · also Day 5") and a link to the place page; Stays show nights; Logistics shows book-by dates coloured by
     tokens 3.1 (all neutral for a visitor unless a window is open).
   - Chips are counts only in By day; tapping a chip switches to By category and scrolls to it. Empty category: 45%,
     not clickable, section omitted, anchor resolves to the top of the strip.
   - Phone: 32 px chips scrolling sideways with snap and a 24 px fade; sticky and scroll-spied only in By category;
     the segment is 40 px full width above the strip.
10. **Depth.** Summary trips: the same rows plus a notice chip "Condensed from the full plan" and a link to the
    original page. Overview trips: no strip and no rows; notice banner "This plan has not been converted to days yet.
    Read the full plan" with the legacy link; keep cover, season band when known, gallery, credits.
11. **End**: Copy and export repeated, the gallery (L0 `Gallery`), credits and attribution (photos, OpenFreeMap,
    OpenStreetMap, Mapterhorn, sources).
12. `generateStaticParams` from `tripSlugs()`; metadata and OG from the cover; register the page family `maplibre`.

## Acceptance checks

| # | Check | Against |
|---|---|---|
| 1 | Trips keeps photo cards, display titles, mono meta, countdown and link chips, serif summary, `/` search with live count, pills, group and sort with direction, the four views with the solid accent segment | keep-from-live-site Trips |
| 2 | Map view works and its URL restores the camera | patterns 1.2, 3.3 |
| 3 | Dolomites page: 14 day rows in date order; strip shows six chips with real counts; By category regroups the same items and never changes the order inside a day | patterns 3.4 |
| 4 | Every item lands in exactly one category per the kind table; an item on two days is one row with both day signs | patterns 3.4 rules |
| 5 | Phone strip scrolls with snap, is sticky and scroll-spied only in By category | patterns 3.4 Phone |
| 6 | Summary and overview trips are labelled; no fake zeros; legacy link present | README 2.3 |
| 7 | Nothing amber at rest: countdown neutral, "to book" neutral outline, only the focused day sign and route-pick amber | changes-from-preview 1 |
| 8 | Anchors `#day-3`, `#stays` ... `#logistics` and `?view=category` work on load and on Back | patterns 1.2 |
| 9 | Drive times marked ≈ with the honesty marker; route lines labelled as straight | README 8 |
| 10 | Done trips (when made public) open read-only with no planner controls | trip-scope S10 |
| 11 | No private trip in the list, the table, CSV, the map or `web/out` | README 2.3 |
| 12 | axe clean; no horizontal scroll at 390 | WCAG AA, tokens 10 |

## Verification

```
pnpm --dir web typecheck && pnpm --dir web lint && pnpm --dir web test
pnpm --dir web build && pnpm --dir web e2e
```

Screenshots with the L0 harness at 1440 x 900 and 390 x 844, light and dark: `/trips/` in each of the four views,
grouped and filtered; `/trips/dolomites-2027` full page tiled, By day with Day 3 expanded, By category scrolled to
Trails; `/trips/canadian-rockies-2029#day-5` with tracks; `/trips/patagonia-2027` (summary); `/trips/switzerland-2027`
(overview).

## Commit rules

Worktree `/home/nitin27may/workspace/travel-wt/v2-L3`, branch `public/L3`, dev port 3413. Commits: trips search and
map view; trip page cover, season and route; category strip and day rows; depth states. `git -C <worktree> add <owned
paths>`, never `-A`. Message `web(public/L3): ...` with your Co-Authored-By trailer. Rebase onto the v2 branch, do not
push.
