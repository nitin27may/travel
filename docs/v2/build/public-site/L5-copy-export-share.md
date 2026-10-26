# L5: copy, export and share

> **Amended 25 Oct 2026 (navigation and Mine):** a visitor's copy is kept in this browser as a `copies/1` envelope and
> listed in Mine › My trips; the sheet's "Sign in to save it" footer and its done step become the device note and
> "Open in Mine" ([navigation-and-mine.md](../../features/navigation-and-mine.md) 3.4, task NAV-2).

Wave 2, parallel with L1 to L4. Agent: `travel-builder` (Sonnet). Effort: about 5 hours.
Plan: [README.md](README.md). Starts after L0 and LD are merged (LM not needed).

## Goal

Everything a visitor takes away, with no account and no server: Copy to my trips (the sheet now, the planner later),
Export as PDF (print), calendar (.ics), GPX and KML where the data is ours to give, CSV, and share links. L3 and L4
render your components; you implement them behind the props L0 committed.

## Read first

- `docs/v2/design/foundation/patterns.md` 3.7 (copy and export), 3.4 item 1 and 5, 3.6 actions, 4.4 (toasts and
  undo), 1.2 (canonical URLs, anchors, list state).
- components.md 2.1, 2.4 (date picker with shading), 5.1, 5.2, 5.3, 5.5.
- `research/reports/map-stack-2026-10-18.md` "What we may store" (only our OSM and official points, ORS geometry;
  nothing from Google) and kinds README 5 (`point_source`).
- L0 stubs `web/components/actions/{CopySheet,ExportMenu,ShareButton}.tsx` (props are fixed; changing them needs the
  coordinator); LD `getTrip()`, `getPlace()` types.

## Files you own

`web/components/actions/**` (from the L0 stubs), `web/lib/export/**`, `web/styles/print.css`, `web/tests/export/**`,
`web/tests/e2e/export*.spec.ts`.

## Do not touch

The pages that render your components (`web/app/trips/**`, `web/app/places/**`: L3, L4), `web/components/ui/**`
(L0), `web/lib/public/**` (LD), everything else outside your files.

## Steps

1. **CopySheet** (patterns 3.7): side sheet desktop, bottom sheet phone. Asks only the start date (date picker with
   weekend shading and the trip's valid window pre-highlighted) and who is going (traveller toggles: Adults, Children
   with ages, kept in component state only). The copy keeps days, not dates. Footer for visitors: "Sign in to save it
   to your trips" (link to `/sign-in`) and the export options **active with the chosen dates** (the calendar uses the
   picked start date). Nothing is stored in the browser: guest planning is decided with the schema (product
   direction). Primary stays disabled until a date is picked (no default selection).
2. **ExportMenu** (menu 5.2) with the formats the caller passes; each item names its contents ("Calendar: 14 all-day
   events"). Formats:
   - **PDF**: `window.print()` with `web/styles/print.css`: the page's reading order (cover title and facts, season
     band, days chronologically with their stops, categories as lists, links as URLs printed after the text,
     gallery reduced to one row, **credits and map attribution always printed**), no header, bottom bar, maps or
     interactive controls; A4 and Letter margins; page breaks between days avoided inside a day row.
   - **ICS** (RFC 5545): one all-day event per day ("Day 3 · Tre Cime loop · base Cortina"), plus timed events for
     items with a time; `TZID` from the trip zone; UID stable per trip and day; dates from the trip or the CopySheet
     start date; summary trips include their condensed stops; overview trips have no ICS (menu item absent).
   - **GPX 1.1**: waypoints for stops, trailheads and parking (name, kind, day as `<type>`), tracks only for lines LD
     marks `exportable` (OSM-derived with `osm_ref`, or official sources whose licence allows it). Metadata carries
     the attribution ("© OpenStreetMap contributors, ODbL" and the source) and the page URL. Points whose
     `point_source` is not ours (never Google) are skipped and counted in a comment.
   - **KML 2.2**: the same content for Google Earth and My Maps, folders by day.
   - **CSV**: trip stops with day, time, name, kind, category, area, lat, lon, links; for lists the current filter and
     columns (Places and Trips already have this through the table tools; reuse that code path, do not fork it).
   Files are named `<slug>-<format>.<ext>`; generation is client-side from the page's props; a toast confirms
   ("Downloaded dolomites-2027.gpx · 61 points").
3. **ShareButton**: Web Share API where available (phone), otherwise copy the canonical URL with a toast "Link copied".
   The URL keeps the anchor (`#day-3`) or the list state (`?kind=trail&view=map`), never `c=` unless the user is on a
   map view. Also "Copy link to this day" in each expanded day row through an exported `shareUrl(trip, day)` helper
   (L3 calls it).
4. **Licence guard**: `web/lib/export/licence.ts` decides per point and line whether it may be exported, from LD's
   `point_source` and source licence; unit tests for an OSM point, an official Parks Canada point, a Commons-only
   photo location, and a hypothetical Google-sourced point (rejected).

## Acceptance checks

| # | Check | Against |
|---|---|---|
| 1 | Copy sheet asks only start date and travellers; the window is highlighted; nothing preselected; visitors get "Sign in to save it" and working exports | patterns 3.7, memory rule no default selection |
| 2 | PDF keeps the reading order and always prints credits and map attribution | patterns 3.7 |
| 3 | ICS validates (an RFC 5545 parser in the test) and imports into Google Calendar and Apple Calendar with the right local dates | patterns 3.7 |
| 4 | GPX validates against the GPX 1.1 schema; KML opens in Google Earth; no point or line from a Google source; attribution present | map-stack research, kinds 5 |
| 5 | CSV for a trip has one row per stop in chronological order; list CSV equals the table's export | keep-from-live-site (Export CSV) |
| 6 | Share copies the canonical URL with the anchor or list state; the toast is a polite live region | patterns 1.2, components 5.3 |
| 7 | No private trip can be exported (functions refuse a trip LD did not build) | README 2.3 |

## Verification

```
pnpm --dir web typecheck && pnpm --dir web lint && pnpm --dir web test
pnpm --dir web build && pnpm --dir web e2e     # downloads checked in Playwright, files parsed in the test
```

Screenshots with the L0 harness at 1440 x 900 and 390 x 844, light and dark: the Copy sheet with a date picked,
the Export menu open on a trip and on a trail, the print preview of `/trips/dolomites-2027` (emulate print media,
tile it), the share toast.

## Commit rules

Worktree `/home/nitin27may/workspace/travel-wt/v2-L5`, branch `public/L5`, dev port 3415. Commits: licence guard and
formats with tests; ExportMenu and print stylesheet; CopySheet; ShareButton. `git -C <worktree> add <owned paths>`,
never `-A`. Message `web(public/L5): ...` with your Co-Authored-By trailer. Rebase onto the v2 branch, do not push.
