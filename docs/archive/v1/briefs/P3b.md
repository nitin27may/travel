# P3b: map view, advanced filter panel, saved views, schema page, accessibility suites

## Goal

Complete the shared entity page: a MapLibre map view that shares the filter state of the other three views, the advanced filter panel with saved views and CSV export on the table view, and the `/schema/` documentation page. Lock in accessibility with axe and keyboard suites over every route and view, so every later list inherits all four views for free.

## Prerequisites (state at start)

P3a and P2a merged on `main` (P2b, P4a or P4b may be running in parallel).

- `web/` (Next.js 16.4.2 static export, pinned versions in `web/package.json`), `EntityPage`, `FilterBar`, `ViewSwitcher`, `CardsView`, `ListView`, `TableView` (TanStack Table v8), `DetailSheet`, `EmptyState` in `web/components/entity/`; the URL codec `web/lib/entities/url.ts` and filter `web/lib/entities/filter.ts`; the place descriptor; `/places/` with the Map tab present but disabled; `/data/places.json` written at build.
- `data/schema/generated/schema.json` and (once P2b merges) `ops.json`.
- `tools/check-all.sh` runs the web suites.
- Spec: `docs/PLAN-platform.md` 3B (MapLibre integration, pinned `maplibre-gl@6.14.0`), 4.2 (MapView, AdvancedFilterPanel, the `f` grammar), 0B.6 (accessibility rules, revised 4), 4.13.

## Files you own

`web/components/map/MapView.tsx`, `web/lib/map/**` (`useMap`, style loading, attribution assembly, clustering helpers), `web/components/entity/AdvancedFilterPanel.tsx`, `web/lib/entities/savedViews.ts`, `web/lib/entities/csv.ts`, `web/lib/entities/advanced.ts` (the `f` grammar), `web/app/schema/**`, `web/tests/e2e/a11y/**`, `web/tests/e2e/keyboard/**`, `web/tests/unit/{advanced,csv,savedViews,map}.test.ts`. Limited edits: `web/components/entity/TableView.tsx` (wire the panel and a column chooser), `web/components/entity/ViewSwitcher.tsx` (enable Map), `web/components/entity/EntityPage.tsx` (pass `bbox`), `web/package.json` (add `maplibre-gl@6.14.0`, append-only).

Must not touch: `core/**`, `data/**`, `tools/**`, `web/app/review/**`, other routes' pages.

## Steps

### Step 0. Worktree

```bash
git -C /home/nitin27may/workspace/travel fetch origin
git -C /home/nitin27may/workspace/travel worktree add -b phase/p3b /home/nitin27may/workspace/travel-wt/p3b origin/main
pnpm --dir /home/nitin27may/workspace/travel-wt/p3b install && bash /home/nitin27may/workspace/travel-wt/p3b/tools/check-all.sh   # expect: CHECK-ALL OK
```

### Step 1. MapView

`maplibre-gl@6.14.0`, imported only inside client components loaded with `next/dynamic` (`ssr: false`), so the initial JS of list pages stays under the P3a budget (the budget test must still pass). `useMap` is a thin house hook over the raw API (no `react-map-gl`). Styles: OpenFreeMap `liberty`, `positron`, `dark` (no key). Points cluster (count, click to zoom); hover shows a mini card; click opens `DetailSheet` via `?focus=`; "Search as I move the map" toggles a `bbox` filter in the URL that all four views honour. Attribution assembled from the sources on screen. Under the map, a visually hidden table lists the visible rows (plan 0B.6, text equivalent); the canvas has `aria-hidden="true"`.
Tests: unit tests for bbox parsing and the row-to-GeoJSON conversion; a Playwright spec that loads `/places/?view=map`, waits for the map's `load` event, asserts the GeoJSON source has 64 features, applies `country=CA` and asserts the count changes, toggles bbox and checks the URL. Tile requests are routed to a 404 in tests (never call OpenFreeMap from tests).

Commit `P3b step 1: map view on MapLibre 6.14.0 with shared URL state`.

### Step 2. Advanced filter panel, column chooser, CSV, saved views

`AdvancedFilterPanel` (table view only, opened from "Advanced"): rows of field + operator + value with the operators of plan 4.2 per type, AND or OR, sort and group-by pickers. `web/lib/entities/advanced.ts`: the `f` grammar (`f=km.gt.10~gain_m.lt.800~or`) with an exact round trip. Column chooser writes `cols`. CSV export of the filtered rows (RFC 4180 quoting, UTF-8 with BOM, only allow-listed columns). Saved views: named URL states in `localStorage` key `travel:v1:views` (`{name, path, query, saved}`), listed in the panel; default presets "Family with young kids", "Hard hikes", "Rainy-day rescue" as data, not code.
Tests: grammar round trip and evaluation (each operator); CSV quoting; saved view round trip in Playwright (save, reload, apply).

Commit `P3b step 2: advanced filter panel, column chooser, CSV export, saved views`.

### Step 3. `/schema/`

`web/app/schema/page.tsx` renders every table from `data/schema/generated/schema.json` (family, columns with type, nullability, enum values, private flag, FK target) and, if `ops.json` exists, every operation (name, kind, phase, summary, MCP tool). If `ops.json` is absent, show the tables only. Anchors per table.

Commit `P3b step 3: generated schema documentation page`.

### Step 4. Accessibility and keyboard suites

- `web/tests/e2e/a11y/all-routes.spec.ts`: axe (`@axe-core/playwright`) on every exported route; for entity pages in all four views; zero violations of impact `serious` or `critical`.
- `web/tests/e2e/keyboard/entity.spec.ts`: keyboard-only path through the filter bar, a facet menu, the advanced panel (add a condition, apply), a grid cell, the view switcher, opening and closing the detail sheet with focus returning to the trigger; on a view change, focus lands on the new region's heading and the live region announces "Table view, 64 places".
- `prefers-reduced-motion`: a spec with `reducedMotion: 'reduce'` asserts that no element on the entity page has a computed `transition-duration` above 0s.
- `lang` attributes: place names from the store with a known local language get `lang` (use the country's main language until `name_lang` is set).

```bash
pnpm --dir /home/nitin27may/workspace/travel-wt/p3b/web test && pnpm --dir /home/nitin27may/workspace/travel-wt/p3b/web build && pnpm --dir /home/nitin27may/workspace/travel-wt/p3b/web e2e   # expect: all passed
```

Commit `P3b step 4: axe and keyboard suites across routes and views`.

### Step 5. PR

```bash
git -C /home/nitin27may/workspace/travel-wt/p3b fetch origin && git -C /home/nitin27may/workspace/travel-wt/p3b rebase origin/main
pnpm --dir /home/nitin27may/workspace/travel-wt/p3b install && bash /home/nitin27may/workspace/travel-wt/p3b/tools/check-all.sh
git -C /home/nitin27may/workspace/travel-wt/p3b push --force-with-lease -u origin phase/p3b
gh pr create --repo nitin27may/travel --base main --head phase/p3b --title "P3b: map view, advanced filters, saved views, schema page, a11y" --body-file /tmp/p3b-pr.md
```

Attach screenshots (2x, read in tiles) of `/places/` in map and table views with the advanced panel open, desktop and phone.

## Acceptance criteria

1. Map view shows 64 features unfiltered, honours every facet and `bbox`; a view switch keeps filters; reload restores the state.
2. A 3-condition AND/OR filter, group by country, column chooser, CSV export of filtered rows and a saved-view round trip pass in Playwright.
3. `/schema/` lists every table in `schema.json`.
4. axe: zero serious or critical violations on every route and view; keyboard spec and reduced-motion spec pass.
5. The P3a budget test still passes (MapLibre is not in the initial bundle).
6. `bash tools/check-all.sh` ends with `CHECK-ALL OK`.

## Tests to add

`web/tests/unit/{advanced,csv,savedViews,map}.test.ts`; `web/tests/e2e/{map-view,advanced-panel,saved-views}.spec.ts`; `web/tests/e2e/a11y/all-routes.spec.ts`; `web/tests/e2e/keyboard/entity.spec.ts`.

## Pitfalls

1. MapLibre must be 6.14.0 (the globe's vendored version); a different version diverges in projection and style-spec support.
2. `next/dynamic` with `ssr: false` must sit in a client component; importing `maplibre-gl` anywhere on the server path breaks the static export.
3. Tests never fetch tiles: route `**/tiles.openfreemap.org/**` and `**/*.pbf` to a 404 in Playwright.
4. TanStack Table stays on v8 (8.21.3); v9 changed APIs.
5. Kill any test server by the PID on its port, never with `pkill -f`.
6. Never `cd`; never `git add -A`.

## Commit and push rules

- Checkout `/home/nitin27may/workspace/travel-wt/p3b`, branch `phase/p3b`.
- `git -C /home/nitin27may/workspace/travel-wt/p3b add <owned paths>` only; never `git add -A`, `.` or `commit -a`; check `git -C /home/nitin27may/workspace/travel-wt/p3b diff --cached --stat` before each commit.
- One commit per step, green; message `P3b step <n>: <summary>`, body, trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Push after each step: `git -C /home/nitin27may/workspace/travel-wt/p3b push -u origin phase/p3b`.
- `gh pr create` (no `--json`), body ending with the attribution line your harness specifies; the owner merges.

## Report back

Commit hashes; test counts; axe results per route (count of violations by impact, all zero for serious and critical); JS budget per route after MapLibre; screenshots looked at; deviations.
