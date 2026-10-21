# Audit R1: public output and phase A security read (EXECUTION-PLAN check 5.2, scoped to A)

Auditor: Opus (claude-opus-5-5), 21 Oct 2026. Read-only except this file.
Target: `web/out` (static build of `main` 92d74d1, built with the public Google Maps key only) and the phase A diff
`git diff 763aed2...92d74d1 -- web core data tools` (1,030 files: lanes TST, FIXF, SHL2, GLB2a, TRP1, LST2a, PLC2a, E2E, CLN-R; 884 of the files are `web/public/globe/line/*.json`).

## Verdict

**Pass with fixes.** No must finding. No household data, no secret, no owner email, no Sign in link and no live Report link in the output. Four should findings (two in phase A code, two older but caught by this check) and five later findings, most of them readiness items that belong to R2 or phase D.

| Severity | Count |
|---|---|
| must | 0 |
| should | 4 |
| later | 5 |

## Findings

### 5.2-R1-1 (should) Report link: the page path can inject query keys into the issue-form URL

Evidence: `web/lib/config/product.ts:15` builds `?page=${encodeURI(clean)}`. `encodeURI` leaves `&`, `=` and `+` alone, so a visitor path such as `/x&labels=bug&title=Hi there/` becomes `...&page=/x&labels=bug&title=Hi%20there/` (checked with `node -e "console.log(encodeURI('/x&labels=bug&title=Hi there/'))"`). The path comes from `usePathname()` in `web/components/shell/ReportLink.tsx`, and the footer that carries the link is on `404.html` too (`grep -c site-footer web/out/404.html` = 1), so any URL on the host reaches it. Someone could hand out a link to the site whose Report link opens a GitHub issue form with their own title, body, labels or template filled in. It is dormant today because `reportUrl` is `null` (`product.ts:8`), and nothing in `web/out` points at a feedback repo (`grep -rl "travel-feedback\|nitin27may" web/out` = 0).

Fix: in `reportLink`, use `encodeURIComponent(clean).replace(/%2F/g, '/')` so the slashes stay readable and `&`, `=`, `?`, `#`, `+` are encoded. Add a case to `web/tests/shell/shell-flags.test.ts`: `reportLink(FORM, '/x&title=y/')` must contain `page=/x%26title%3Dy/` and no second `title=`.

### 5.2-R1-2 (should) 1,474 new-tab links carry `rel="noreferrer"` without `noopener`

Evidence: across `web/out/**/*.html`, 3,439 anchors have `target="_blank"`. 1,965 carry `noopener noreferrer`, and 1,474 carry only `rel="noreferrer"` (python scan below; first case `places/banff-gondola/index.html`). They come from four string builders: `web/components/places/sections/legacyHtml.ts:26`, `:49` (touched in phase A: the Google Maps, Directions and Apple Maps buttons), `:55`, and `web/components/suit/html.ts:88` (source links). Every current browser treats `noreferrer` as `noopener`, so this is not exploitable. The rule asks for both, and the other builders in the same files already write both.

Fix: write `rel="noopener noreferrer"` in those four template strings. Add an assertion to `web/tests/places/built-pages.test.ts` that no `target="_blank"` anchor in `web/out` lacks `noopener`.

### 5.2-R1-3 (should) About the data does not say what Natural Earth is now used for

Evidence: GLB2a's `tools/globe_data.py features` builds the 1,267 landform, 294 sea and 349 river rows in `globe/data/gazetteer.json` (with the new `bbox` and `lineId` columns) and the 884 line files from Natural Earth. Each line file carries `"credit":"Natural Earth (public domain)"`, and the city search rows also come from Natural Earth populated places. The Natural Earth row on `/about/data/` still reads "Used for: Country outlines and the base geography of the globe" (`data/reference/licences.json:62-68`, `covers`). Natural Earth is public domain, so no credit is legally required. The row is still out of date with what the site uses it for.

Fix: set `covers` in `data/reference/licences.json` to "Country outlines, the city, landform, sea and river names in globe search, and the outline or line drawn when a landform or river is picked." Rebuild About the data.

### 5.2-R1-4 (should) A third-party email address and tax code appear in a source line

Evidence: the scan for email addresses finds one, in 4 files of `places/lago-dantorno/` (HTML and the three RSC payloads): the publisher field reads "Comune di Auronzo di Cadore (auronzo.info; footer: Via Roma 24, C.F. 83000710257, PEC auronzo.bl@cert.ip-veneto.net)". It is a municipality's public certified-mail address, not household data, and it is older than phase A (added in 98721e4, an ancestor of 763aed2). It is still a research note shown as text, and it breaks the plain "no email address anywhere in web/out" check this audit is asked to apply. The source of the text is `data/capture/dolomites-2027/migrated.json:148` and `data/sources/registry.json:522`.

Fix: shorten the publisher in both files to "Comune di Auronzo di Cadore (auronzo.info)". Then add an email pattern to `householdLeaks` in `web/tests/privacy.test.ts` (outside `_next/static/`) so the next one fails the build. `migrated.json` is pinned by `data/capture/migration-ledger.json`, so change it through the capture tooling, not by hand.

### 5.2-R1-5 (later) Owner's first name on every trip page

Evidence: `web/components/trips/TripCover.tsx:55` renders the chip "by Nitin", and `web/components/trips/TripEnd.tsx:28` adds "Plan researched and written by Nitin" to all 14 trip pages (`grep -l Nitin web/out/trips/*/index.html` = 14). This predates phase A (75f8ac9, 18 Oct). `docs/v2/design/review-stage4-whole-site.md:21` already ruled it authorship, not household data. It names the author, not who travelled, so it does not break the party rule. This audit's brief lists names, though, so the owner should confirm the byline at R2.

Fix: none unless the owner wants it gone. If so, put the byline in `web/lib/config/product.ts` as `authorName: string | null` and render nothing when it is `null`.

### 5.2-R1-6 (later) The planned feedback URL would publish a handle equal to the owner's email local part

Evidence: `web/lib/config/product.ts:6` (a comment, not shipped: 0 hits in `web/out`) gives the future value as `https://github.com/nitin27may/travel-feedback/...`. The handle is the same string as the local part of the owner's email address. Once `reportUrl` is set, every page footer links it.

Fix: an owner choice under Q70. Either accept it (a GitHub handle is public anyway) or host the feedback repo under an organisation or handle that is not the email local part. Decide before the flag is turned on.

### 5.2-R1-7 (later) Readiness items from EXECUTION-PLAN 13.1 still open (expected at R1)

Evidence and fix, one line each:
- Item 4: `web/out/robots.txt` is `User-Agent: * / Allow: /` and names no AI crawler. Add the disallow list in `web/app/robots.ts`.
- Item 5: `/specimen/` is still built. It is `noindex, nofollow`, missing from `sitemap.xml` (0 hits) and linked from no page (`grep -rlE 'href="/specimen' web/out` = 0). Its chunk `_next/static/chunks/1x7y6t1m1hv4j.js` carries demo booking fields ("Confirmation code", "CAD 5,4OO") but no household value (no "Kai", "Partner", "passport", "Whitby"). Remove the route from the production build as item 5 says.
- Item 7: the Google key and the Map ID are in the client bundles, as intended for a public client key. The key's referrer restrictions and daily quota are an owner console task.

### 5.2-R1-8 (later) world-countries (CC BY-SA 4.0) is not credited

Evidence: `tools/globe_data.py:64` builds `globe/data/countries.json` (capital, flags and facts for the globe's country card) from the `world-countries` npm data, CC BY-SA 4.0 by `research/reports/globe-research-2026-10-16.md:35`. `/about/data/` has no row for it (`grep -i "world-countries\|mledoze" web/out/about/data/index.html` = 0). This predates phase A. GeoNames is not used yet: the city rows come from Natural Earth, so no GeoNames credit is needed today.

Fix: add a `world-countries` row (CC BY-SA 4.0, "Country names, capitals and flags on the globe") to `data/reference/licences.json`. Check it in the full R2 credit audit.

### 5.2-R1-9 (later) Test-only static server: prefix check without a separator

Evidence: `web/tests/e2e/globe.features.gpu.spec.ts:19` guards with `f.startsWith(SITE)`. A request for `/../.site-other/x` resolves to a sibling folder whose name starts with `.site` and passes the check. The server listens on `127.0.0.1` only and runs only inside the test, so the risk is nil. The Python fixture in `web/tests/e2e/fixtures.ts` also binds `127.0.0.1` with `ThreadingHTTPServer`.

Fix: `if (f !== SITE && !f.startsWith(SITE + path.sep))`.

## What was checked and found clean

All commands ran from `/Users/nks/workspace/travel` against `web/out` as built. Scratch scanners are in the session scratchpad (`scan.py`, `platforms.py`). No server was started and nothing was rebuilt.

**1. Household data (5,972 text files scanned, framework chunks excluded only for prose patterns).**
- Home town: `whitby` (case-insensitive) in 0 files, HTML, RSC payloads, JSON, sitemaps and chunks included. The Q50 exemption (towns rows, near chips) is not used at all.
- Home point: 0 coordinate pairs within 2 km of the home point in any `.html/.txt/.json/.xml/.js/.svg` file, including the 884 `globe/line/*` files, `globe/trip/*`, `globe/place/*` and `globe-data/*`. Day bases newly placed on the trip route map (TRP1, `web/lib/public/trips.ts`) add no point near home.
- Party: 0 hits for "a child around N", "N-year-old" (1 to 17), "family of N", "N adults plus/and N children", "with kids N+", "the other adult", "both adults", "my/our kids/child/wife/family", "we're travelling/bringing". These are the patterns from `web/lib/public/party.ts` and `web/tests/privacy.test.ts`.
- Status and stays: 0 `"status":` or `stayStatus` keys, 0 "planned as", 0 "hotel/stay/hut idea|choice|pick|booked", 0 booking-reference phrases outside the specimen chunk.
- Private fields: `height_cm`, `weight_kg`, `age_years`, `citizenship`, `price_paid`, `insurer_tel` do not occur as data. The 32 hits are the public suitability row ids `su-min_weight_kg` ("Minimum weight", an operator limit).
- Dates: on the 14 trip pages, `trips/index.html`, `index.html`, `sitemap.xml`, `og/`, `search/`, `globe/trip/` and `globe/place/` the `dateless.ts` date pattern finds no calendar date in visible text except provenance ("read 18 Oct 2026", "upd. 2026-06-14"). The other hits are Commons file names in `globe-data/card` image credits and the `added` capture date in list rows. `added` is on the pinned row allowlist (`web/tests/data/light-data.test.ts:35`) and phase A did not change it.
- Phones: one number, the Jasper park dispatch line (public safety information) on `trips/canadian-rockies-2029`.
- Research paths: `research/` and `inbox/` in 0 files.
- New data files: `data/trips/covers.json` (the dated folder name `patagonia-feb-mar-2027`) and `data/reference/globe/landform-audit.json` are not published (`grep -rl "trip-covers\|patagonia-feb-mar" web/out` = 0). The `research/runs/...` paths in `data/tracks/inputs.json` are source notes and never reach the output.
- The new trail facts strip: on 115 trail pages, every value comes from our rows or a "Not checked yet" chip (`web/components/places/sections/trailFacts.ts`). The 15th tile is the AllTrails link.

**2. Link-only platforms (all 359 place pages, 14 trip pages and 5 index pages, not a sample of 30).** After removing scripts, styles and tags, the visible text contains "AllTrails", "Komoot" and "Tripadvisor" 0 times. "Google" appears only as a link label: "Google Maps directions" and the `pl-maplinks` "Google Maps" buttons, which the privacy test deliberately allows. Next to a platform name there are no ratings, stars, review counts or grades; the 8 "value-like" hits are parking names inside Google Maps link labels. The AllTrails tile's visible text is "Trail guide · link only / Search for this trail" or "Open trail page". The platform name is only in `aria-label` and the RSC link list (`allTrailsLink`, `web/lib/map/links.ts:57`, accepts a stored URL only if it matches `^https://(www.)?alltrails.com/`). Google coordinates: there is no Geocoder, PlacesService or `places.googleapis` call in `web/lib`, `web/components`, `core/src`, `tools/*.py` or any client chunk, and the phase A diff changes no `lat`/`lon` in `data/capture` or `data/trips`.

**3. Secrets and links.**
- Using the first 8 characters of each value in `web/.env.local` and `.env` (never printed): `ORS_API_KEY` is in 0 files of `web/out`. `NEXT_PUBLIC_GOOGLE_MAPS_KEY` is in 4 client chunks only (`_next/static/chunks/02-7y9s-9c77y.js`, loaded by the 14 trip pages, and three lazy map chunks), never in HTML or RSC text. Neither prefix is in any tracked file at 92d74d1 or in the phase A diff. Both env files are git-ignored.
- Generic patterns: one `AIza...` string (the public key itself); 0 GitHub tokens, `sk-` keys, JWTs, AWS keys, `supabase.co` or `service_role`.
- Email: the owner's address in 0 files; one third-party address (5.2-R1-4). The phase A diff adds no User-Agent and no `mailto:`. `tools/globe_data.py` uses `travel-relevance-signals/1.0 (+https://nks-travel.pages.dev/about/)`.
- Report link: `reportUrl = null` (`web/lib/config/product.ts:8`). "Report a problem" appears only as the component's default label in one chunk, with no URL. 0 links to a feedback repo; every `github.com` URL in the output is a library licence or issue link inside MapLibre or core-js.
- Sign in: `capabilities.signIn = false` (`web/lib/capabilities.ts`). No page has `href="/sign-in`. `/sign-in/` and `/specimen/` both carry `noindex, nofollow`.
- Sitemap: 380 URLs (360 places, 14 trips plus `/trips/`, about, globe, terms, home), all present in `web/out` (0 missing). No specimen or sign-in URL. `sitemaps/-/sitemap.xml` is an empty `urlset` left by the static export of the index route (older than phase A, harmless).

**4. P8.** The 884 line files are one feature each: largest 3,215 bytes, 723 KB in total, each fetched by its own id through `globeLine()` (`web/lib/client/data.ts:427-429`, `encodeURIComponent(id)`), and no file concatenates them. The gazetteer (14,090 rows, 970 KB) is world geography from Natural Earth (country, admin1, city, physical, marine, river), not our catalogue: it holds no row of kind place or trip. The new `bbox` and `lineId` columns are public-domain geometry ids. Phase A adds no list, search or export file. The list rows still match the pinned allowlist, and exports stay per item (`data-export-data="trip:<slug>"` per page).

**5. Security read of the diff.**
- URL inputs. `nf` is only compared with `'0'` (`web/lib/globe/url.ts`). `country`, `region` and `area` are rendered through React (escaped). Shard loading takes its file ids from the manifest, never from the URL value (`shardsForScope`, `web/lib/entities/shards.ts:111`), so an unknown value loads nothing. `fitByName` matches basemap names against the in-memory gazetteer and builds no path. The `page=` key is 5.2-R1-1.
- String-built HTML. `glanceHtml`'s `external` tile escapes the URL and label with `esc` (all five characters), and the URL is either our built AllTrails search URL or a stored URL checked against the AllTrails pattern. `hide` is a set of row keys used only to filter. `withUnits` escapes every piece. The three `dangerouslySetInnerHTML` sites in the diff (`PlacePage.tsx` glance line, the `ps-glance` section, `suitsInner`) all go through `esc` or `withUnits`.
- New-tab links. All phase A new-tab links (AllTrails tile, ReportAnchor, StatCan credit, cover Directions) have `noopener noreferrer`. The older builders are 5.2-R1-2.
- Paths. Line ids are `_slug()` output (`[a-z0-9-]`), written only under `web/public/globe/line/`.
- `tools/relink.py` makes no network call. It writes only files that `git ls-files` lists under `--root` and that the `--scope` file selects, so nothing outside the repo is touched (a tracked symlink pointing outside would be followed; the repo has none in scope).
- `globe_data.py features` downloads only from `raw.githubusercontent.com/nvkelso/natural-earth-vector`, with the no-email user agent, and caches in `tools/.cache/`.
- The test servers bind `127.0.0.1` (Python `ThreadingHTTPServer` in `web/tests/e2e/fixtures.ts`, Node in `globe.features.gpu.spec.ts`).
- The client bundles hold no secret besides the public Google key.

**6. Licences.** Natural Earth (public domain) is credited on `/about/data/` and inside every line file. geoBoundaries, Statistics Canada (OGL-Canada), OpenStreetMap (ODbL, also on `/terms/`), OpenFreeMap, Mapterhorn and Commons are credited on `/about/data/` and in the site footer. GeoNames is not used, so its credit is not due yet (13.1). The gaps are 5.2-R1-3 (wording) and 5.2-R1-8 (world-countries).

### Commands

```
python3 -I <scratchpad>/scan.py web/out                     # household, email, phone, party, date, status, research-path, specimen and sign-in links
python3 -I <scratchpad>/platforms.py web/out                # visible-text scan of 378 pages for AllTrails, Komoot, Tripadvisor, Google
python3 -I - (inline)                                       # target=_blank rel audit; home-point 2 km scan; sitemap existence; env first-8 checks (values never printed)
grep -rl "travel-feedback\|nitin27may\|Report a problem" web/out
grep -rlE 'href="/(specimen|sign-in)' web/out ; grep -o '<meta name="robots"[^>]*>' web/out/{specimen,sign-in}/index.html
git diff 763aed2...92d74d1 -- web core tools ':!web/public' | grep -nE '^\+.*(dangerouslySetInnerHTML|http\.server|User-Agent|mailto:)'
git grep -l -F <first 8 chars> 92d74d1 --                   # run inside python, prefix never echoed
```
