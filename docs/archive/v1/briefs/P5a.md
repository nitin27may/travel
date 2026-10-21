# P5a: plan pages, maps, trail geometry, offline and PWA, exports

## Goal

Render a full plan page from `trip.json` for the two imported trips (the Canadian Rockies and Patagonia) with day maps, trail maps and elevation profiles, at the same URLs the legacy pages use today, and reach feature parity with those pages. Make the pages work at a trailhead with no signal (service worker, installable PWA, self-hosted fonts, GPX/KML/CSV/ICS downloads), and switch each trip from its legacy page to the app only after the owner has reviewed it.

## Prerequisites (state at start)

P4c and P3b merged on `main`. P5b1-P5b3, P5c and P6 may run in parallel (see "Files you own").

- `data/trips/{canadian-rockies-sept-2029,patagonia-feb-mar-2027}/trip.json` (validated; `web_published: false`, `visibility: public`), `prose/`, `legacy-keys.json`; catalog rows for both regions in `data/catalog/**` (trails without geometry yet), places in `data/locations/`.
- `core/`: schemas, validator, day checks, book-by, sun, edition resolution (`core/src/derive/`), ops CLI and local API.
- `web/`: entity pages with four views (MapView on `maplibre-gl@6.14.0` in `web/components/map/MapView.tsx`, frozen for you: wrap it, do not edit it), `/places/`, `/trips/`, `/about/data/`, home, privacy, budget, OG and font tests; `tools/publish.py` merges `web/out` with legacy routes (a legacy `/<slug>/` wins unless `trip.web_published` is true).
- Legacy pages (the parity target): `legacy/canadian-rockies-sept-2029/index.html`, `legacy/patagonia-feb-mar-2027/index.html`; their `legacy/*/gallery/gallery.json`; `legacy/_system/base.js` (checklists, countdown, A/B toggle, scrollspy).
- Spec: `docs/PLAN-platform.md` 4.4, 4.5, 4.8, 4.9 (offline harness), 4.10 (parity list and storage keys), 4.13, 3A (trail capture), 0A.6 (deep links, weather, FX), 0B.6 (accessibility).

## Files you own

`web/app/[slug]/page.tsx` (and its layout), `web/app/[slug]/print/**`, `web/app/trails/**`, `web/app/bookings/**`, `web/components/plan/**`, `web/components/map/**` except `MapView.tsx`, `web/public/{sw.js,manifest.json}`, `web/public/icons/**`, `web/lib/{exports,storage,weather,fx,deeplinks,plan}/**`, `web/lib/entities/descriptors/{trail,booking}.ts`, `web/scripts/shots.ts`, `web/tests/**` files named `plan-*`, `trail-*`, `offline-*`, `export-*`, `storage-*`; `tools/trails.py`, `tools/tests/test_trails.py`, `tools/tests/fixtures/trails/**`; `data/catalog/trails/geo/**` and `data/catalog/trails/geo/NOTICE-ODbL.md`; trail rows' geometry fields (through `catalog.edit` only); the two trips' `web_published` flag (final step, after the owner's yes) and `gallery.json` moves.

Must not touch: `web/app/{new,edit,globe,activities,stays,eateries,offers,areas,backlog,review,schema}/**`, `web/components/{create,globe,review}/**`, `web/components/map/MapView.tsx`, `core/**`, `.claude/**`, other trips' data.

## Steps

### Step 0. Worktree and parity snapshot

```bash
git -C /home/nitin27may/workspace/travel fetch origin
git -C /home/nitin27may/workspace/travel worktree add -b phase/p5a /home/nitin27may/workspace/travel-wt/p5a origin/main
pnpm --dir /home/nitin27may/workspace/travel-wt/p5a install && bash /home/nitin27may/workspace/travel-wt/p5a/tools/check-all.sh
```

Freeze the parity target: copy both legacy pages to `web/tests/fixtures/legacy/<slug>.html` (legacy pages may be edited while you work; parity is against this snapshot). Commit `P5a step 0: parity snapshot of the two legacy pages`.

### Step 1. Plan page data and spine

`web/lib/plan/`: loads a trip with `core`'s edition resolution (dates, weekdays, ages, book-by, sun per base zone, booking states for a "today" from `HUB_TODAY` or the build date); joins catalog rows. `web/app/[slug]/page.tsx`: `generateStaticParams` returns trips with `web_published: true`, plus every data trip when `TRAVEL_PREVIEW=1` (a local preview build; never published). Components in `web/components/plan/` for every row of the plan 4.5 spine: `TripHero` (with an edition picker), `Countdown`, `NumbersStrip`, `Prose`, `BookingTimeline`, `DocumentsChecklist`, `PackingChecklist`, `RegionCards`, `Gallery` (lightbox; reads `data/trips/<slug>/gallery.json` if present, else `legacy/<slug>/gallery/gallery.json`), `NightSplit`, `DaySection`, `TimeChips`, `TrackTabs`, `WeatherRuleChip`, `PlanBCard`, `DayOfLinks`, `SunTimes`, `TrailTable`, `AdventureTable` (fit per traveller: "Fits all", "Not for Child (11)", "Limits unknown"; never a height or weight), `StayTable`, `BudgetTable` (in `trip.base_currency` with the "ECB rate of <date>" line from `fx`), `HazardList`, `GotchaList`, `EmergencyCards`, `KnowledgeTable`, `QuestionList`, `ChangeLog`, `DayNav` (IntersectionObserver scrollspy), "today mode". Times show their zone abbreviation when the trip spans more than one zone. Distances and temperatures go through `web/lib/format/`. Plan pages carry `noindex`, per-trip OG tags (hero at `?width=1200`) and the theme from `trip.theme`.
Tests: `web/tests/plan-spine.spec.ts` builds with `TRAVEL_PREVIEW=1` and checks every section heading of 4.5 on both trips; `web/tests/plan-parity.test.ts` checks the 4.10 rows against the snapshot (for each legacy feature, the app page has the component or field: day count equal, every trail and booking name present, every day title present, every checklist item present).

Commit `P5a step 1: plan page spine for both trips`.

### Step 2. Maps, trails and profiles (component side)

`web/components/map/`: `DayMap` (numbered items, legs as lines: dashed straight when not routed, solid with stored geometry; trail lines coloured by house grade with dash patterns; base icon; Track A/B/C selector), `TrailMap` (line, start and end, trailhead, km markers), `ElevationProfile` (the shadcn chart, `[distance, elevation]`, hover-linked to the `TrailMap` marker through a small `useSyncExternalStore` store; footer: stated versus computed gain, source and attribution; the min, max, gain and loss also as text), `DifficultyBadge` (filled pill, hollow when `effort-only`, local grade text), `RouteStrip`, `StaticMapFallback` (build-time SVG of the stored GeoJSON, no tiles), `ExternalLinks` (plan 4.8: our map first, then official, AllTrails, Google Maps, OSM, Waymarked Trails links; Google embed only behind a button and only if `NEXT_PUBLIC_MAPS_EMBED_KEY` is set). Every map wraps `MapView` and is followed by the sr-only table of items and legs (plan 0B.6).
`/trails/` (descriptor `trail`, four views) and `/trails/<id...>/` trail pages; `/bookings/` (descriptor `booking`, Timeline plus the four views, public trips with a chosen edition).
Tests use committed GeoJSON fixtures in `web/tests/fixtures/trails/` only.

Commit `P5a step 2: day maps, trail maps, profiles, trails and bookings routes`.

### Step 3. Trail geometry (owner-run fetch, committed outputs)

`tools/trails.py` (stdlib; owner-run; never called by tests, hooks or builds): `find --name <n> --near <lat,lon>` (Overpass bbox search 5 km, User-Agent, back off 30 s on 429, cached in `tools/.cache/trails/`), `fetch <trail-id>` (agency dataset when `geometry_source` says so, else Waymarked Trails relation details and `way-elevation`, else a GPX in `research/trips/<slug>/gpx/`; Douglas-Peucker 5 m, 5 decimals; profile resampled to 200 points; writes `data/catalog/trails/geo/<id with / as __>.geojson` with `properties.profile`, `source`, `source_id`, `fetched`, `licence`), `check` (length within 15% of stated km, start within 300 m of the trailhead, profile present: warnings), `refetch --changed` (reports, writes nothing), `contract` (one known relation, 10692471, still returns geometry: the weekly owner-run check). `tools/tests/test_trails.py` runs on recorded responses in `tools/tests/fixtures/trails/`. A size test fails if a geometry file passes 150 KB.

The owner runs (or approves you running) `python3 tools/trails.py find` and `fetch` for every trail of both trips; results are committed; each trail row gets its `geometry_*` fields through `node core/bin/ops.ts catalog.edit`; a trail with no geometry gets a reason in `notes` (for example "no OSM relation; agency dataset has no line").

Commit `P5a step 3: trail geometry for both trips` (tool, tests, GeoJSON, NOTICE, row edits).

### Step 4. Offline, PWA, fonts

`web/public/sw.js` (hand-written, no plugin): "Save this trip for offline" precaches the plan page HTML and RSC payload, the shell JS and CSS, `web/public/fonts/*`, `/data/trips/<slug>.json`, every trail GeoJSON the trip uses, the `/data/index/geo/<gh3>.json` files for the trip's bounding box when they exist (P5b3 writes them; skip when absent), gallery thumbnails at `?width=480` capped at 60, and basemap tiles for each day box at zooms 10-12 then 13-14 around trailheads, capped at 1,500 tiles (the button shows the size; the page says "Basemap saved for N of M days" when capped). Cache name carries the build id. `web/public/manifest.json` and icons (192, 512, maskable). Without tiles, `DayMap` renders GeoJSON on a blank style, then `StaticMapFallback`.
`web/tests/offline-trip.spec.ts` (plan 4.9 harness): load, press "Save for offline", wait for the worker's `cached` message, `context.setOffline(true)`, reload; assert the page, every `DayMap` GeoJSON source has features, checklists, `document.fonts.check('16px "Source Serif 4"')` and the emergency block; OpenFreeMap requests routed to a 404 throughout.

Commit `P5a step 4: offline trip pages and installable PWA`.

### Step 5. Exports and deep links

`web/lib/exports/`: per trip and per day GPX and KML (items in order, trail lines), CSV of items, and `/<slug>/assets/<slug>.ics` for the chosen edition (plan 4.13: book-by events, check-in and check-out, day titles; `UID` `<slug>-<row id>@nks-travel`; `DTSTAMP` = build date; 75-octet line folding); written into `web/out/<slug>/assets/` at build. `web/lib/deeplinks/`: Google Maps directions per day (items in order), Booking.com `searchresults.html` with dates and party, Google Flights `q=` query, tested for exact URLs. `web/lib/weather/`: a client-side Open-Meteo forecast strip per base when the chosen edition is within 16 days (live, on demand, attributed); nothing at build. `web/lib/fx/`: conversion with the `fx` table only.
Tests: snapshot of the Patagonia ICS, GPX and KML; ICS parsed by a strict parser in the test; deep link URLs.

Commit `P5a step 5: GPX, KML, CSV and ICS exports; deep links; forecast strip`.

### Step 6. Storage migration and print

`web/lib/storage/`: app keys `travel:v1:<slug>:check:<id>`, `travel:v1:<slug>:edition`, `travel:v1:<slug>:migrated`; first load copies legacy values (`<slug>:<id>`, then the `data-ck-legacy` prefix) through `data/trips/<slug>/legacy-keys.json` and never deletes legacy keys; an existing new key wins. Unit tests for every case. `/<slug>/print/`: one day per page, maps as the build-time SVG, links as short URLs, a QR code per day for the Google directions link (generate the QR at build with a small, dependency-free encoder or add one pinned package, append-only).

Commit `P5a step 6: storage migration and print layout`.

### Step 7. Review build, screenshots, owner review

```bash
W=/home/nitin27may/workspace/travel-wt/p5a
TRAVEL_PREVIEW=1 pnpm --dir $W/web build
node $W/web/scripts/shots.ts --out /tmp/p5a-shots --routes /canadian-rockies-sept-2029/ /patagonia-feb-mar-2027/ --widths 1440 390 --scale 2 --tile 1200
```

`web/scripts/shots.ts` serves `web/out` on a free port, screenshots each route at 2x, splits into tiles. Look at every tile (zoom in; check edges through boxes, labels, maps, profiles) for both trips, desktop and phone, and side by side with the legacy snapshot. Fix what is wrong. Put the tiles in the PR (or a gist) for the owner.

The owner reviews both pages. **Only after the owner says yes for a trip**: set `trip.web_published = true` for that trip through `node core/bin/ops.ts trip.update`, move its gallery with `git mv legacy/<slug>/gallery/gallery.json data/trips/<slug>/gallery.json` (the legacy page stays in `legacy/` and keeps working; its builder is not run again), and commit `P5a step 7: publish <slug> from the app` (one commit per trip). Then `python3 tools/publish.py --dry-run` serves that slug from `web/out` and the superset test passes.

### Step 8. PR

```bash
git -C $W fetch origin && git -C $W rebase origin/main
pnpm --dir $W install && bash $W/tools/check-all.sh
git -C $W push --force-with-lease -u origin phase/p5a
gh pr create --repo nitin27may/travel --base main --head phase/p5a --title "P5a: plan pages, maps, trails, offline, exports" --body-file /tmp/p5a-pr.md
```

## Acceptance criteria

1. Both plan pages render every 4.5 section and pass the 4.10 parity test against the snapshot.
2. Every trail on both trips has a geometry file or a recorded reason; profiles render; badges follow the house scale.
3. The offline harness passes; the PWA manifest validates (name, icons, `start_url`, `display`).
4. ICS, GPX, KML and CSV snapshot tests pass; deep-link URL tests pass.
5. Storage migration tests pass.
6. Budget (plan page under 250 KB gzipped before the map island), OG, privacy, axe and keyboard suites pass.
7. `web_published` is set only for trips the owner approved, each in its own commit.
8. `bash tools/check-all.sh` ends with `CHECK-ALL OK`; `python3 tools/publish.py --dry-run` passes the superset check.

## Tests to add

`web/tests/{plan-spine,offline-trip,export-*,trail-*}.spec.ts`, `web/tests/{plan-parity,storage-migration,deeplinks,ics}.test.ts`, `tools/tests/test_trails.py` with recorded fixtures.

## Pitfalls

1. Tests never call Overpass, Waymarked Trails, OpenFreeMap or Open-Meteo; geometry comes from committed files.
2. Waymarked Trails' `/geometry/gpx` path returns 404 since 2023; use `details/relation/<id>` and `way-elevation` (verified 2026-10-17).
3. The 1,500-tile cap is usually hit on mountain trips; the blank-basemap fallback is the expected offline map, and the page says so.
4. Never import `MapView` internals; wrap it.
5. Never show heights or weights; fit verdicts only.
6. The stated gain is primary; computed gain is labelled and a difference over 25% is a build warning, not an error.
7. One geometry source per file (ODbL and OGL never mixed); keep the NOTICE file.
8. Legacy pages stay live until `web_published`; do not run their builders after moving `gallery.json`.
9. Kill servers by PID; never `cd`; never `git add -A`.

## Commit and push rules

- Checkout `/home/nitin27may/workspace/travel-wt/p5a`, branch `phase/p5a`.
- `git -C /home/nitin27may/workspace/travel-wt/p5a add <owned paths>` only; never `git add -A`, `.` or `commit -a`; check `git -C /home/nitin27may/workspace/travel-wt/p5a diff --cached --stat` before each commit.
- One commit per step, green; message `P5a step <n>: <summary>`, body, trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Push after each step: `git -C /home/nitin27may/workspace/travel-wt/p5a push -u origin phase/p5a`.
- `gh pr create` (no `--json`), body ending with the attribution line your harness specifies; the owner merges.

## Report back

Commit hashes; test counts; the parity checklist with status per 4.10 row; trails with and without geometry (and reasons); JS budget for both plan pages; offline harness result; screenshot tiles reviewed and fixes made; which trips the owner approved.
