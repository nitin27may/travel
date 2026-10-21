# P3a: app scaffold, theme, places in three views, privacy, publish merge

## Goal

Create the Next.js static-export app in `web/` with the house theme, the shared entity page (cards, list and table views over one filter bar with all state in the URL), the places list and place pages, the home and trips pages, and `/about/data/`. Wire it into `tools/publish.py` so the app and every legacy page publish together, with visibility filtering, a privacy test, a JS budget and Open Graph tags from day one.

## Prerequisites (state at start)

P1b merged on `main`. P2a may be running in parallel or merged; do not depend on it (if `core/` is on `origin/main` when you open the PR, see step 9).

- Root `package.json` and `pnpm-workspace.yaml` (packages `core`, `web`) exist; no `web/`.
- `data/locations/locations.json` (v2, 64 places in a relational layout: `countries`, `regions`, `areas`, `places`, `tags`, `place_tags`, `sources`, `visits`, `collections`, `collection_places`); `data/reference/countries.json`.
- `legacy/<slug>/index.html` for 14 served trips, `legacy/MANIFEST.json`, `legacy/locations/index.html` (the list page, served at `/locations/`), `legacy/globe/`, `legacy/_system/themes/*.css` (8 themes; colour lives only there).
- `tools/publish.py` stages legacy routes and calls `tools/hub.py` for `/`; `tools/tests/fixtures/served-urls.txt`; `python3 tools/publish.py --dry-run` builds `.site/`.
- `docs/PLAN-locations-g5.md` section 2.4 defines the list page's URL parameters; `docs/PLAN-platform.md` 3B (pinned versions), 4.1-4.3, 4.13, 1.3 (merge order, visibility) and 14 (`SITE_ORIGIN`) are the spec. Read them.

## Files you own

`web/**` except: `web/components/map/MapView.tsx`, `web/lib/map/**`, `web/components/entity/AdvancedFilterPanel.tsx`, `web/app/schema/**` (P3b); `web/app/review/**` (P4b); anything later phases list. Also `tools/theme_tokens.py` and its test, `tools/publish.py` (merge order and route table), `tools/hub.py` (add a `--json` mode only; the HTML output stays as it is), `data/reference/licences.json`, `tools/tests/test_publish_merge.py`, `README.md` (full text), and append-only edits to `tools/check-all.sh` if it exists.

Must not touch: `core/**`, `data/**` except `data/reference/licences.json`, `tools/locations.py`, `tools/location_views.py`, `legacy/**`, the root `package.json` and `pnpm-workspace.yaml`, `docs/**`.

## Steps

### Step 0. Worktree (no commit)

```bash
git -C /home/nitin27may/workspace/travel fetch origin
git -C /home/nitin27may/workspace/travel worktree add -b phase/p3a /home/nitin27may/workspace/travel-wt/p3a origin/main
```

`W=/home/nitin27may/workspace/travel-wt/p3a` below.

### Step 1. Scaffold with pinned versions

Create `web/` by hand (no interactive generator): `package.json` (`"name": "@travel/web"`, `"private": true`, scripts `dev`, `build` = `next build`, `typecheck` = `tsc --noEmit`, `lint` = `eslint .`, `test` = `vitest run`, `e2e` = `playwright test`), dependencies exactly `next@16.4.2`, `react@19.3.1`, `react-dom@19.3.1`, `@tanstack/react-table@8.21.3`, `@tanstack/react-virtual@3.14.21`, `@base-ui/react@1.9.0`; devDependencies `typescript@6.0.3`, `tailwindcss@4.3.3`, `@tailwindcss/postcss@4.3.3`, `eslint@10.13.0` with the Next config, `vitest@5.0.5`, `@playwright/test@1.64.1`, `@axe-core/playwright@4.14.0`, `@types/react`, `@types/node@22`. `next.config.ts`: `output: 'export'`, `trailingSlash: true`, `images: {unoptimized: true}`, `distDir` default, `outDir` default (`web/out`). `tsconfig.json` strict. `components.json` for shadcn with base `base` (Base UI); add components with `pnpm --dir <W>/web dlx shadcn@4.22.0 add <name>`; add an ESLint `no-restricted-imports` rule banning `@radix-ui/*`. Fonts: copy the WOFF2 files for Big Shoulders Display, Source Serif 4 and IBM Plex Mono (SIL OFL) into `web/public/fonts/` with their `OFL.txt`, declared with `@font-face` in `web/app/globals.css` (download once from the Google Fonts GitHub repositories; never link `fonts.googleapis.com`).

```bash
pnpm --dir /home/nitin27may/workspace/travel-wt/p3a install
pnpm --dir /home/nitin27may/workspace/travel-wt/p3a/web typecheck && pnpm --dir /home/nitin27may/workspace/travel-wt/p3a/web lint
pnpm --dir /home/nitin27may/workspace/travel-wt/p3a/web build     # expect: web/out/index.html exists
```

Commit `P3a step 1: Next.js 16 static export scaffold with pinned versions` (paths `web pnpm-lock.yaml`).

### Step 2. Theme tokens

`tools/theme_tokens.py` (stdlib): reads every `legacy/_system/themes/*.css`, writes `web/app/themes.css` with one `[data-theme="<name>"]` block per theme using the same token names (`--accent`, `--header`, `--warn` ...) and a shell block from the hub identity (deep forest `#14251d`, amber `#d69329`); `--check` exits 1 if the output would change. `tools/tests/test_theme_tokens.py`: every legacy token appears; output deterministic; no hex colour appears in `web/**/*.{ts,tsx,css}` outside `web/app/themes.css` (a grep test in `web/tests/no-hex.test.ts`). Tailwind reads the tokens through `@theme` variables. Light and dark both defined; plan pages default to light.

Commit `P3a step 2: theme tokens generated from the legacy themes`.

### Step 3. Data loading, entity contract and the views

- `web/lib/data/places.ts`: reads `data/locations/locations.json` at build (the file system, from a `TRAVEL_ROOT` env defaulting to the repo root two levels up) and joins places with area, region, country and tags. Types are local interfaces now; step 9 switches to `@travel/core` if it exists.
- `web/lib/entities/types.ts`: `EntityDescriptor<Row>` as in plan 4.2 (type list includes `place`, `trip`, `trail`, `activity`, `stay`, `eatery`, `offer`, `booking`).
- `web/lib/entities/url.ts`: the URL codec for `q`, `country`, `region`, `area`, `status`, `kind`, `style`, `grade`, `kid`, `season`, `tag`, `trip`, `due`, `bbox`, `view` (`cards`, `list`, `table`, `map`; legacy `view=grid` maps to `cards`), `sort`, `group`, `cols`, `f`, `sv`, `focus`, `ids`, `label`. Round trip is exact.
- `web/lib/entities/filter.ts`: one pure filter over rows plus facet counts.
- `web/components/entity/{EntityPage,FilterBar,ViewSwitcher,CardsView,ListView,TableView,DetailSheet,EmptyState}.tsx`. `TableView` uses TanStack Table v8: sort (with `aria-sort`), group by with counts, sticky header, virtualised over 300 rows (TanStack Virtual), resizable columns. The Map view tab is present but disabled with "Map view arrives in the next release" (P3b builds it). `DetailSheet` is driven by `?focus=` and returns focus to its trigger on close. `EmptyState` names the chip that removed the last rows and offers one-tap loosen.
- `web/lib/views/`: writes `/data/places.json` (`entity-view/1`: `{schema, generated, rows}`) at build with an explicit per-descriptor allow-list of fields (never a deny-list).
- Vitest: URL codec round trips; filter and facet counts; `view=grid` shim; allow-list (the written JSON has exactly the listed keys).

Commit `P3a step 3: entity contract, URL state, cards, list and table views`.

### Step 4. Routes: home, places, place pages, trips, about

- `/places/` (descriptor `place`), `/places/<CC>/<region>/<area>/<place>/` with `generateStaticParams` from the store (place page: name, kind, status, season, kid fit, stats, sources as links, a "part of N plans" line, no research paths).
- Hash shim: on load, `/places/#country=CA&...` rewrites to the query string (the legacy list and the globe link with hashes).
- `/trips/`: rows from `data/trips/*/trip.json` where `trip.visibility = "public"` (none exist yet; the loader must work with zero) plus `legacy/MANIFEST.json` rows with `served: true`, using `python3 tools/hub.py --json` output (step 6) for their title, dates, region and hero; legacy rows carry a "legacy page" badge and link to `/<slug>/`.
- `/`: the home page with the hub's content (upcoming and past trips as image cards with the Today / Tomorrow / In N days / Past trip badges, links to the globe and places) from the same JSON, plus the next booking deadlines once trips exist. Date-relative badges use `HUB_TODAY` if set at build, else the build date.
- `/about/data/`: rendered from `data/reference/licences.json` (create it: one entry per source with id, name, URL, attribution text and what it covers: ODbL for the catalog and OSM-derived lines, OGL-Canada, NPS public domain, opendata.swiss open use, Open-Meteo CC BY 4.0, Copernicus via Open-Meteo, Natural Earth public domain, geoBoundaries per country, Wikimedia Commons per image, Frankfurter/ECB, plus `own-words`), and the privacy line ("never published: traveller ages, heights, weights and citizenship; booking confirmations and contacts; prices paid; inbox captures; the research tree").
- `/locations/`: a static redirect page to `/places/` (meta refresh plus a link) and `web/redirects.json` with `/locations/* /places/:splat 301`.
- Every page: `<html lang="en">`, `og:title`, `og:description`, `og:image`, `og:url` and canonical built from `SITE_ORIGIN` (default `https://nks-travel.pages.dev`), `twitter:card`. Lists are indexable; nothing else in P3a needs `noindex`.

Commit `P3a step 4: home, places, place pages, trips and about routes`.

### Step 5. Visibility filter and privacy test

- `web/lib/visibility.ts`: the rule of plan 1.3 (`public` built and listed; `unlisted` built but excluded from lists, `/data/*.json`, indexes and the sitemap, `noindex`; `private` never built). All loaders go through it.
- Fixture root `web/tests/fixtures/root/` (repo-shaped: `data/locations/locations.json` copy, `data/trips/{public-trip,unlisted-trip,private-trip}/trip.json` with only the fields the loaders read plus sentinel private values: a traveller `height_cm: 137`, a `trip_bookings` row with `confirmation: "CONF-SENTINEL-7Q"`, a private note "NOTE-SENTINEL-PRIVATE").
- `web/tests/privacy.test.ts`: builds with `TRAVEL_ROOT=<fixture root>` into a temp `distDir`/`out` (a script `build:fixture`), then greps every file: no sentinel, no `private-trip` anywhere, `unlisted-trip` only under its own folder, no `research/`, `inbox/`, `screenshot` strings, and no private field name (`height_cm`, `weight_kg`, `age_years`, `citizenship`, `confirmation`, `contact`, `price_paid_amount`, `insurer_tel`) as a JSON key in `/data/*.json`.

Commit `P3a step 5: visibility filtering and the privacy test`.

### Step 6. Publish merge and the legacy-trip JSON

- `tools/hub.py --json <out>`: writes the trip list it already computes (slug, title, sub, img, date, dates, dur, region, status, badge) as JSON for the app; the HTML mode is unchanged.
- `tools/publish.py`: the merge order of plan 1.3: `locations.py build`; `python3 tools/hub.py --json web/.generated/legacy-trips.json`; `pnpm --dir web build` (skip with `--no-web` for tests); copy `web/out/*` into the empty `.site/`; copy each legacy route unless the app wrote that path (a legacy `/<slug>/` that collides with an app file is an error unless `data/trips/<slug>/trip.json` has `web_published: true`); `/locations/` comes from the app (redirect page), not from `legacy/locations/index.html`; the Python hub is no longer written when `web/out/index.html` exists; write `_redirects` last from `web/redirects.json`; then run the superset check against `tools/tests/fixtures/served-urls.txt` and fail on a missing URL; `--check` as before.
- `tools/tests/test_publish_merge.py`: with a fake `web/out` in a tmp dir: app files first, legacy routes second, `_redirects` last; collision error; superset check fails when a URL disappears.
- `.gitignore`: `web/out/`, `web/.next/`, `web/.generated/`.

```bash
python3 /home/nitin27may/workspace/travel-wt/p3a/tools/publish.py --dry-run          # expect: staged app routes and every legacy route, "dry run: ..."
python3 -m pytest /home/nitin27may/workspace/travel-wt/p3a/tools/tests -q            # expect: all passed
find /home/nitin27may/workspace/travel-wt/p3a/.site -type f | wc -l                  # expect: under 15000
```

Commit `P3a step 6: publish merges the app and legacy routes`.

### Step 7. Units, analytics, budgets, fonts, OG tests

- `web/lib/format/`: distance (km or mi, one decimal), elevation (m or ft, nearest 10), temperature (C or F), money display (currency preference; conversion arrives with `fx` in P5a); preference stored in `localStorage` key `travel:v1:prefs`, default from `navigator.language` (`en-US` imperial). Unit tests for every formatter.
- Analytics: the Cloudflare Web Analytics beacon script in the root layout only when `NEXT_PUBLIC_CF_BEACON_TOKEN` is set at build. Test both ways.
- `web/tests/budget.test.ts`: parse every `web/out/**/index.html`, collect `<script src>` that load at start (not dynamic chunks), sum gzipped sizes: fail above 200 KB for list pages.
- `web/tests/og.test.ts`: every exported HTML has the four OG tags; no `nks-travel.pages.dev` string outside canonical/OG tags, `robots.txt` and the footer.
- `web/tests/fonts.test.ts`: no exported file references `fonts.googleapis.com` or `fonts.gstatic.com`.

Commit `P3a step 7: units, analytics flag, JS budget, OG and font tests`.

### Step 8. Parity with the legacy list page (Playwright)

`web/tests/e2e/places-parity.spec.ts`: serve `.site/` (after `python3 tools/publish.py --dry-run`) with `python3 -m http.server <port> --directory <W>/.site` on a free port (pick it at run time; kill it by that PID at the end), and serve `legacy/locations/index.html` the same way from a temp copy at `/legacy-locations/`. For each parameter set of `docs/PLAN-locations-g5.md` 2.4 (at least: none, `country=CA`, `country=US`, one region, one area, each status, two kinds, one tag, one season, `kid=yes`, and two combined), read the visible result count on the legacy page (hash form) and on `/places/` (query form): they must be equal, and with no filters both must be **64**. A second spec checks that the three views share URL state, that reload restores it and that a view switch keeps filters.

```bash
pnpm --dir /home/nitin27may/workspace/travel-wt/p3a/web exec playwright install chromium
pnpm --dir /home/nitin27may/workspace/travel-wt/p3a/web e2e          # expect: all passed
```

Commit `P3a step 8: places parity with the legacy list page`.

### Step 9. README, rebase, PR

- `README.md` (full): what lives where (plan 1.1 in ten lines), how to add a place (the `location` skill), how to build and publish (`python3 tools/publish.py --dry-run`, then without `--dry-run`), how to run tests, where the plan and briefs are.
- `git -C <W> fetch origin && git -C <W> rebase origin/main`. If `core/` is now on main (P2a merged): regenerate the lockfile with `pnpm --dir <W> install`; replace the local place interfaces with `z.infer` types imported from `@travel/core/schema/locations.ts` if the shapes match (they must; if not, keep the local types and report the difference); add the `web` lines to `tools/check-all.sh` if they are not there (append-only).
- Re-run every check, push, open the PR.

```bash
pnpm --dir /home/nitin27may/workspace/travel-wt/p3a/web typecheck && pnpm --dir /home/nitin27may/workspace/travel-wt/p3a/web lint && pnpm --dir /home/nitin27may/workspace/travel-wt/p3a/web test && pnpm --dir /home/nitin27may/workspace/travel-wt/p3a/web build
python3 /home/nitin27may/workspace/travel-wt/p3a/tools/publish.py --dry-run && python3 -m pytest /home/nitin27may/workspace/travel-wt/p3a/tools/tests -q
git -C /home/nitin27may/workspace/travel-wt/p3a push --force-with-lease -u origin phase/p3a
gh pr create --repo nitin27may/travel --base main --head phase/p3a --title "P3a: app scaffold, places, privacy, publish merge" --body-file /tmp/p3a-pr.md
```

Attach to the PR body desktop and phone (390 x 844) screenshots of `/`, `/places/` in each view and one place page, taken at 2x and looked at in tiles (zoom in on each tile before claiming they look right).

## Acceptance criteria

1. `pnpm --dir web typecheck`, `lint`, `test`, `build` all exit 0.
2. Places parity spec passes; unfiltered count is exactly 64 on both pages.
3. Privacy, budget, OG, fonts, no-hex and visibility tests pass.
4. `python3 tools/publish.py --dry-run` stages the app plus every legacy trip route; `/locations/` redirects to `/places/` (redirect page plus `_redirects` line); the superset check passes; `.site` has fewer than 15,000 files.
5. `python3 -m pytest tools/tests -q`: all passed (existing plus `test_theme_tokens.py`, `test_publish_merge.py`).
6. No file outside the owned list changed (`git diff --name-only origin/main...HEAD`).

## Tests to add

`web/tests/{url,filter,views-allowlist,format,analytics,budget,og,fonts,no-hex,privacy,visibility}.test.ts`, `web/tests/e2e/{places-parity,url-state}.spec.ts`, `tools/tests/{test_theme_tokens,test_publish_merge}.py`.

## Pitfalls

1. Static export has no Server Actions, cookies, rewrites, redirects or headers; every dynamic segment needs `generateStaticParams`. Redirects are files.
2. shadcn's default base is Base UI since July 2026; online examples mix Radix (`asChild`) and Base UI (`render`) APIs. Use Base UI only; the lint rule enforces it.
3. Today's list page uses `view=grid` for cards and the hash for state. The app uses the query string and maps `grid` to `cards`.
4. The privacy rule is an allow-list per descriptor. Never serialise a whole row into `/data/*.json`.
5. `HUB_TODAY` keeps date badges reproducible in tests; without it the home page differs every day.
6. Do not hard-code the host; read `SITE_ORIGIN`.
7. MapLibre is not installed in P3a (P3b, `maplibre-gl@6.14.0`). Keep it out of the initial bundle when it arrives.
8. Kill the test HTTP server by its PID, never with `pkill -f` (another agent's server may match).
9. P2a may change the root `pnpm-lock.yaml` in parallel; never hand-edit it, regenerate with `pnpm install` after a rebase.
10. Never `cd`; use `pnpm --dir` and absolute paths.

## Commit and push rules

- Checkout `/home/nitin27may/workspace/travel-wt/p3a`, branch `phase/p3a`.
- `git -C /home/nitin27may/workspace/travel-wt/p3a add <owned paths>` only; never `git add -A`, `.` or `commit -a`; check `git -C /home/nitin27may/workspace/travel-wt/p3a diff --cached --stat` before each commit.
- One commit per step, green; message `P3a step <n>: <summary>`, body, trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Push after each step: `git -C /home/nitin27may/workspace/travel-wt/p3a push -u origin phase/p3a`.
- `gh pr create` (no `--json`), body ending with the attribution line your harness specifies; the owner merges.

## Report back

Commit hashes; versions installed (from the lockfile); test counts (Vitest, Playwright, pytest); the parity table (parameter set, legacy count, app count); JS budget per route; `.site` file count; screenshots looked at and anything that looked wrong; any deviation from the plan.
