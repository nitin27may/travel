# Audit G-B: API code (5.5), public output (5.2) and the home point (CONS-2)

Auditor: Claude Opus 5.5 (`claude-opus-5-5`), 22 Oct 2026. Read only, on `main` at `d1a1156` (phase B diff `ec7d51a...d1a1156`, 44
commits, lanes API-1b, API-1c, API-2, PRIV1, META-0, CONS-1, CONS-2, CLN-3/4/5). Nothing was built, no test suite or server was run.
The built output read is `web/.next` from 22 Oct 21:26, three minutes after the merge commit (build made with `web/.env.local` aside).
The household home point is called "the home point" throughout; no coordinate near it is quoted here.

## Verdict

**Pass with fixes.** The API code meets the 5.5 bar: caps sit inside the store methods, every query-carrying handler decodes through
core's strict codec, the detector in `respond()` fails closed and never rewrites, and no request value reaches a file path. The
API-1a must findings (R-1 to R-6) are closed. The home point is in one source module, and no served file holds a point within the
exclusion radius.

One must finding blocks check 12: the `/specimen/` page, which the build serves, ships two real trip date ranges, a departure time
and a party composition in its page and client chunk (GB-B-1). The fix is three string edits.

| Severity | Count |
|---|---|
| must | 1 |
| should | 19 |
| later | 7 |

## Findings

### A. API code (5.5)

**GB-A-1 (should). Path-only handlers ignore the query string.**
`getPlace`, `nearbyForPlace`, `health` and the five globe endpoints call the store with path parameters only and never look at the
query (`web/lib/server/respond.ts:44`, `:47-48`, `:56-61`). `GET /api/v1/places/moraine-lake/?anything=1` answers 200, while the codec
refuses an unknown key on every list endpoint (`core/src/catalogue/httpCodec.ts:92-96`). The harm is small: no stray key can filter
anything. But every distinct query string is a distinct CDN cache key on a `public, max-age=3600` globe endpoint, and the rule "every
handler validates its input" does not hold as written. The POST `report` handler also ignores its query.
Fix: in `respond()`, for an endpoint with no `HttpMethod` codec, answer `invalid_input` when `new URL(req.url).searchParams` has any key.
Add one handler case per path-only endpoint to `core/test/catalogue/contract/handler.cases.ts`.

**GB-A-2 (should). `report` reads an unbounded body before checking its size.**
`await r.text()` reads the whole body, then compares its length (`respond.ts:65-66`). App Router route handlers have no default body
limit, so one POST of a few hundred megabytes is held in memory. The 413 for an oversized report also contradicts A1 (a request-size
cap answers 400).
Fix: refuse when `content-length` is absent or above `API_LIMITS.reportText.max + 1000` before reading. Read the stream with a byte cap.
Answer `invalid_input` for an oversized body, as A1 says.

**GB-A-3 (should). The export endpoint labels a JSON envelope as the file.**
`getExport` sends the `ExportFile` object as `application/json`. It also sets `content-disposition: attachment; filename="<slug>.gpx"`
(`respond.ts:99`). A visitor who opens `/api/v1/export/trip/x/?format=gpx` saves a `.gpx` file that holds JSON. The browser client
reads the envelope and `JSON.parse(f.body)` (`web/lib/client/api.ts:167`), so it does not need the header.
Fix: either drop `content-disposition` from the envelope response, or add `?download=1`, which answers the raw `body` with `mime` and the
header. Do not do both in one response.

**GB-A-4 (should). The globe catch-all caches and indexes any well-formed path.**
`web/app/globe/[...path]/page.tsx:9` sets `dynamicParams = true`. Any path shaped like a country code plus up to two slugs renders on
request, and Next caches the result under that path (the file's own comment, `:11-12`). Its metadata reflects the path into the
title, description and canonical URL with `index` allowed (`:26-34`). So `/globe/ca/any-words/at-all/` becomes a cached, indexable page
titled "Globe: Any Words, At All". Anonymous requests can grow the server cache without limit and plant soft-404 pages.
Fix: keep `dynamicParams = true` for the shell, but answer `robots: noindex` for any level not in `globePaths()`. Also set
`export const revalidate = 0` (or `dynamic = 'force-dynamic'`) for the non-prerendered branch, or move unknown levels to a rewrite
to `/globe/`, the same as the static host's `/globe/*` rule. Add one e2e assertion that an unknown level is noindex.

**GB-A-5 (should). A rejected revision is cached for the life of the process.**
`JsonStore.revision()` stores `revPromise` with `??=` (`core/src/catalogue/json/index.ts:50-61`). If one detail throws while the snapshot
is built (`citedSource` throws on an unregistered source, `web/lib/server/sources.ts:44`), the rejected promise stays. Every later
call then answers 500 until a restart. `web/instrumentation.ts:3` says "the store is built again by the first API request", which is
not true when the failure is in `revision()`: the store object stays in `globalThis` (`web/lib/server/store.ts:13`).
Fix: `this.revPromise = ...catch((e) => { this.revPromise = null; throw e; })`. In `register()`, call `setStore(null)` on failure.

**GB-A-6 (should). OpenAPI publishes a globe-card path that does not exist.**
The contract names `GET /api/v1/globe/card/{key}` (`core/src/catalogue/store.ts:215`), and `data/schema/generated/openapi.json` publishes
it. The route is `web/app/api/v1/globe/card/[kind]/[slug]/route.ts`, so the documented URL 404s. Path parameters are also documented as
bare strings, without the slug, id and country patterns.
Fix: change the contract to `GET /api/v1/globe/card/{kind}/{slug}` with `globeCardInput` built from the two. Emit each path parameter's
`pattern` from its input schema in `core/src/catalogue/openapi.ts:37`. Regenerate the document.

**GB-A-7 (should). The detector cannot see coordinates outside `{lat, lon}` objects.**
`privacyHits` tests `nearHome` only on objects with numeric `lat` and `lon` keys (`web/lib/server/privacy.ts:37`). It does not test:
- `[lon, lat]` arrays (globe line geometry, track geometry, the future `globeCity` outline);
- coordinates inside an export `body` (GPX, KML, CSV, the `print` JSON), which is one string.

The scrub upstream covers today's data (GB-B checks). The detector is the fail-closed backstop, and it is blind to these shapes. It also
holds a second copy of the household lists: `HOME_NAME` and `PRIVATE_KEYS` here, `HOUSEHOLD_TEXT` and `PRIVATE_KEYS` in
`core/test/catalogue/contract/kit.ts:111-113`, and a third in `web/tests/privacy.test.ts:17-18`. Each list can drift from the others.
Fix: move one detector to `core/src/privacy/detect.ts`, with one list, `nearHome` on any numeric pair, and a pass over string bodies.
`respond()`, K7 and the web privacy test all import it.

**GB-A-8 (should). The fail-closed detector becomes a home-town oracle in phase E.**
`respond()` answers 500 when a body holds a point within the radius. Today no request can choose a point that is echoed back. In phase E:
- `towns()` returns town rows with coordinates;
- `near?city=<town id>` returns the centre;
- `globeCity` returns an outline.

If the home town's centre or outline is within the radius, exactly one town makes those calls fail with 500. Iterating town ids or
`prefix=` queries then finds the home town. That is the fact the scrub exists to hide.
Fix: before META-2, settle Q50 as a typed rule. Exclude the home town from the towns layer at load (no row, no outline, `city=` answers
`not_found` like any unknown id), so the detector never fires on it. Write this into nearby spec 2 and the API brief before phase E
starts.

**GB-A-9 (should). The planned rate limit does not cover the API.**
EXECUTION-PLAN's "P8 by API" relies on "rate limit when hosting is chosen". Q44 scopes the one rule to `/places/*` and `/trips/*`
(`BACKLOG.md:395`). The bulk paths are now `/api/v1/*` and the static fallback routes: `/list/places/<part>/data.json`,
`/search/<part>/data.json` and `/globe-data/*`.
Fix: amend Q44 and BACKLOG 7.6 to cover `/api/v1/*` and the JSON fallback routes.

**GB-A-10 (later).** `globePins(cc)` has no cap (R-25, unchanged). The API client's `globePins()` with no scope asks for every
country's pins (`web/lib/client/api.ts:183-200`). Fine at 359 places. Measure at the 10,000-place target (G-B check 16).

**GB-A-11 (later).** No runtime output validation. Details are spread from the page model with `as unknown as` casts
(`web/lib/server/placeDetail.ts:99-108`, `tripDetail.ts:11`). The strict allowlist for details holds only in the contract kit
(`getPlace.shape`, `trips.cases.ts:60`). `respond()` checks row keys for `items` only. That is acceptable while data changes only with
a build. When SRV-0 loads data at runtime, validate each detail against its output schema at load.

**GB-A-12 (later).** Small input-codec looseness:
- `r` is coerced with `Number()` (`httpCodec.ts:139`, `:152`), so `r=0x10` is 16.
- A repeated `f.<facet>` key silently overwrites the earlier one (`:87-90`), where every other repeated key is refused.
- `getExport` accepts profile keys and ignores them (`web/lib/server/exports.ts` never reads `q.profile`). `exportQuery`'s comment says a
  trip export "is scheduled for profile".

Fix: decode `r` like `posInt` (a decimal pattern), refuse a repeated `f.` key, and correct the comment or apply the profile.

**GB-A-13 (later).** A moved trip's 308 drops the query (`respond.ts:54`, `:97`): `?p=family` is lost on the redirect. Append
`new URL(req.url).search` to the location.

**GB-A-14 (later).** The images rewrite reads `.generated/image-map.json` from `process.cwd()` (`web/lib/server/images.ts:15`). If it
is missing or the server starts from another directory, every photo silently disappears from the API: the failure is safe, but
silent. Log once when the map is empty. The server file trace for each route also pulls in the stale `web/out/` tree and `web/tests/`
(10,768 files for `api/v1/places`). Set `outputFileTracingExcludes` before hosting.

### B. Output (5.2)

**GB-B-1 (must). `/specimen/` publishes real trip dates and a party composition.**
The specimen page is built and served (`web/.next/server/app/specimen.html`, chunk `static/chunks/1x7y6t1m1hv4j.js`), noindex but public.
Its demo values are the household's:
- the Patagonia card "26 Feb – 11 Mar 2027 · 13 nights · Argentina" (`web/app/specimen/Specimen.tsx:311`);
- the Dolomites card "13 – 26 Jul 2027 · 13 nights · Italy" (`:170`, `:318`);
- a departure field "Fri 26 Feb 2027 23:50" with the Buenos Aires arrival (`:204`);
- "Travellers: 2 adults, 1 child" (`:207`).

Trips are dateless and party-free by rule, and check 12 requires zero household strings. BACKLOG 2.42 cleaned the names from this
page but missed these values. 7.8 (drop `/specimen` from the public build) is queued for stage 7, which is too late for G-B.
Fix now: replace them with values matching no trip, for example "3 – 16 May 2031 · 13 nights", "Mon 5 May 2031 08:10" and "Travellers:
3". Add `/specimen/` to the fixture privacy test's date and party scan: `isDated` and `describesParty` already exist.

**GB-B-2 (should). `/og-manifest.json` is still a route in server mode.**
`web/app/og-manifest.json/route.ts` is `force-static` and is in `.next/prerender-manifest.json`. `scripts/og.mjs:21` deletes its
prerendered body after the share images are made, so under `next start` the route most likely regenerates on the first request. It would
then serve every trip and place slug, title and Commons photo URL in one uncapped response, outside the P8 caps and the K-image rule. I
did not start a server to confirm this. One request at G-B smoke settles it.
Fix: render the manifest inside the prebuild data dump (D-B7) instead of as an app route, and delete the route. Failing that, gate the
route on a build-only environment variable and answer 404 otherwise.

**GB-B-3 (should). A `loc:` ref names the owner's wishlist store.**
PRIV1 removed `locations` from `sources` so the wishlist store is never named (`core/src/schema/api/place.ts:17`,
`web/lib/server/placeDetail.ts:104`). But 74 of the 363 refs are `loc:<id>` (D-B2, `data/catalogue/slugs.json`), and every API row and
detail carries its ref. A client can therefore list exactly which places came from the household's saved list. That is the fact
PRIV1's `sources` change hides. The refs carry nothing else private: no Whitby and no point. All 14 trips behind `trip/` and `legacy/`
refs are public.
Fix: an owner ruling. Either accept that the origin of a ref is public (and say so in PRIV1's note), or mint neutral ids for those 74
(`place:<hash>`), recording the old ones in `formerKeys` so R-2 resolution keeps working. The second is cheap now and expensive after SRV-0.

**GB-B-4 (should). The merged slugs answer 404 on the page route under `next start`.**
`movedTo` resolves the 4 merged slugs, and the API answers 308 (K9.merged). The page routes prerender redirects only for `retired` slugs
(`web/lib/server/moved.ts:13`), with `dynamicParams = false` (`web/app/places/[slug]/page.tsx:15`). So
`/places/lake-louise-sightseeing/` and the other three 404 on the server build. `web/redirects.json` covers them only on a static host.
Fix: have `retiredSlugs(space)` also return the slugs pinned to `merged` keys. The page's existing `currentSlugOf` branch then answers
308.

**GB-B-5 (later).** The production build inlines `NEXT_PUBLIC_GOOGLE_MAPS_KEY` into client chunks by design. This build has none, because
the env file was aside. Before go-live, record that the key must be HTTP-referrer restricted to the production host, and add the
restriction to the hosting checklist (7.x).

### C. The home point (CONS-2 step 3)

**GB-C-1 (should). The point is typed in three test files and one doc, not only in the module.**
A repo-wide search of tracked files for the module's two values (lat and lon as standalone numbers) found them together in five files:
- `core/src/privacy/home.ts` (1 each), the intended home;
- `web/tests/api/contract.test.ts` (1 each, line 37, added by API-1b);
- `web/tests/globe/privacy.test.ts` (1 each, line 12);
- `web/tests/privacy.test.ts` (lon 1, plus a finer-grained lat form, lines 215-218);
- `docs/v2/build/public-site/verify-integration.md` (line 55, in prose).

Two private research files (`research/trips/algonquin-muskoka-oct-2026/{trails,logistics}.md`) also hold a point inside the radius.
They are never published. The CONS-1 scanner skips tests and docs and has no coordinate rule (`tools/cons/baseline.json` notes), so
nothing guards the module comment's "Nothing else may type the point" (`home.ts:7`).
Fix: read the point in tests the way `core/test/privacy/home.test.ts:9-11` does, from the module's text, and use it through a
`homeProbe()` test helper. Remove it from `verify-integration.md`. Add a CONS rule that fails on the two literals anywhere tracked except
`home.ts`. This is a must before any change of repository visibility.

**GB-C-2 (should). The relevance input check does not use the module, and its own source is absent.**
CONS-2 step 6 says `inputsCheck.ts` reads `home.ts`. It imports only `HOME_RADIUS_KM`. It still takes the point from
`data/relevance/inputs/private-origin.local.json` (`core/src/relevance/inputsCheck.ts:16`, `:25-34`, `:48-51`), and that file does not
exist on this machine. So the E_REL_HOUSEHOLD distance check returns early in every check-all run.
Fix: replace the file read with `nearHome()` (keep the local file only as an override, if anyone needs one). Add a test that plants a
hub at the home point and expects `E_REL_HOUSEHOLD`.

**GB-C-3 (should). The core contract runner still skips the home-point check.**
`kit.ts:107-109` says the web runner adds the 2 km check because "core does not hold" the point. Core holds it now. The web runner's check
(`web/tests/api/contract.test.ts:45-61`) covers place rows, detail points, trailheads and parking. It does not cover trip details
(bases and stop points), globe pins, cards or export bodies. SRV-0 adds SupabaseStore to the core runner only, so R-13 stays open.
Fix: K7 in core calls `nearHome` (through the shared detector of GB-A-7) on every output it already scans. Update the kit comment.

**GB-C-4 (should). A failing privacy test would print a point near home.**
`web/tests/privacy.test.ts:169` adds `a point within 2 km of home (${pt})` to the failure list, which prints the matched coordinates in
the test log. That is the one thing the module asks never to be printed.
Fix: report the file and a count only.

**GB-C-5 (should). The town name is typed outside the module.**
`HOME_TOWN` lives in `home.ts:18`. The detector types `/whitby/i` again (`web/lib/server/privacy.ts:8`), and so do
`core/src/relevance/points.ts:63` (`PRIVATE_BASES`) and the kit (`kit.ts:111`). Comments and schema examples (`ca-on-whitby` in
`core/src/schema/api/common.ts:28` and elsewhere) are outside the OpenAPI output (checked), so they do no harm.
Fix: export a non-global `HOME_TOWN_RE` from `home.ts`, import it in the three places, and add the town to the GB-C-1 CONS rule with the
comment and example lines baselined.

**GB-C-6 (later).** The module holds the point at two decimal places, so the 2 km circle is centred up to several hundred metres from
the true home. The radius actually guaranteed around the home is smaller than 2 km by that offset. This is unchanged by CONS-2 and is an
owner choice. If it matters, raise `HOME_RADIUS_KM` or store a finer point when it moves to a secret.

**Radius change (6371 to 6371.0088): no decision can flip in practice.** Every distance grows by the ratio 6371.0088/6371, which is
1 + 1.38e-6. At the 2 km edge that is 2.8 mm. Only a point whose old distance was in the 2.8 mm band just inside 2 km moves from excluded
to not excluded; nothing moves the other way. Measured:
- In built output (7,476 files under `.next/server/app`, `.next/static`, `web/public`), 15 number pairs fall within half a degree of the
  point. None is within 2 km, none is within 50 m of the edge, 0 flip, and the nearest is 7.2 km away.
- In `data/`, 0 are within 2 km, 0 flip, and the nearest is 43.7 km away.

`core/test/privacy/home.test.ts` pins the old and new formulas to agree on a ring that includes offsets either side of 2 km.

**What `nearHome` exposes.** A boolean, plus `PUBLIC_START_CITY` (Toronto) and `HOME_TOWN`. The point itself is not exported.
`origin.ts` re-exports only `nearHome` and `PUBLIC_START_CITY`. No log line, error message or test title prints it:
- `respond()` logs hit paths and reasons (`respond.ts:104`);
- `inputsCheck` messages give the radius only;
- `home.test.ts` messages give offset and bearing.

The one exception is the failure path in GB-C-4. No client chunk holds the point: the scan of `.next/static` found no pair within 2 km.

### D. Carried items

**GB-D-1 (should). C5 is half done: the stub-against-engine corpus case was not added.**
JsonStore filters and counts through the web engine (`web/lib/server/engine.ts`), which re-exports `core/src/query` after API-2. But the
stub still says the engine "lands in API-2" and refuses facet keys it cannot read (`core/src/catalogue/stub/index.ts:107`). No kit case
compares `listPlaces`/`countPlaces` with the engine over a query corpus. Store.ts marked C5 as "must be done there, not deferred further",
and no BACKLOG row tracks it. This is a parity gap for SRV-0, not a public-output risk.
Fix: make StubStore call `core/src/query`, add the corpus case (R-22, R-23), or open a BACKLOG row naming SRV-0 as the deadline.

**GB-D-2 (should). The requested contract changes are a sound deferral, but they are untracked.**
- Export model over `print` (`web/lib/server/exports.ts:14-17`, `:53`): the client reads the structured model through
  `format=print`, which the contract defines as a printable file. Deferring `EXPORT_FORMATS += "json"` is correct while nothing is
  public: renaming it then touches the contract, OpenAPI, `api.ts:167` and one kit case.
- Parsed counts, "not checked yet" counts and full-text search remain static reads inside the API adapter (`...staticClient`,
  `web/lib/client/api.ts:153`; `data.ts:123-134`). Deferring is correct, because a server count needs the parse scope on the server
  (P9).

Neither change has a BACKLOG row, and check 1's statement "every browser read goes to `/api/v1/`" should name these exceptions.
Fix: add two BACKLOG rows (contract: `json` export format; API: parsed counts and text search). List the static exceptions in G-B check 1's
evidence.

**C1 to C7 status.**

| Item | State |
|---|---|
| C1 `servedSnapshot()` from everything read | closed: `json/index.ts:50-61` hashes rows, details, registry, globe (tree, pins, cards, gazetteer, lines), vocabulary, citations, towns |
| C2 codec on every GET, OpenAPI from `*HttpQuery`, detector on every body | closed for query-carrying GETs and OpenAPI (`openapi.ts:38-39`); path-only GETs skip the codec (GB-A-1); detector coverage gaps (GB-A-7) |
| C3 K12 on real data, `src` within `citations` | closed (`placeDetail.ts:30-39`, `sources.ts:41-47` throws on an unknown id) |
| C4 planted registry copy | closed: rename, merge, withdrawal, former key, retired trip slug and an ambiguous alias (`web/tests/api/targets.ts:13-31`) |
| C5 engine parity corpus | open (GB-D-1) |
| C6 K7 on unlisted trips plus the home point | closed for unlisted trips: `getTrip` serves listed trips only (`json/index.ts:202`), which also settles R-29. The home point check is partial (GB-C-3) |
| C7 `rowReads` by a spy | closed (`targets.ts:92`); the handler target sets it undefined and near stays pending until phase E |

**API-1a must findings.** R-1 merged (registry `places.merged`, 4 entries; `movedTo` resolves them, `slugs.ts:230-241`), R-2
`formerKeys` with `resolveRef` (`slugs.ts:252`), R-3 `withdrawn` (`isWithdrawn`, `slugs.ts:244`), R-4 `PLACE_SORT_KEYS` and
`TRIP_SORT_KEYS` (`place.ts:104-109`), R-5 `*HttpQuery` and `httpCodec.ts`, R-6 `sourceTypes` and `added` gone from `placeListRow`
(`place.ts:40-80`), with the detector and K7 treating both as private keys. All six are closed. R-16 is closed as well:
`notes: z.literal("")`, `place.ts:450`.

**K-image.** Sound. `withRenditions` turns every Commons `Special:FilePath` URL into a same-origin rendition and drops photos that have
none. It runs at the source on rows, details, trip rows and details, and cards. The kit case covers those and one place print export
(`core/test/catalogue/contract/images.cases.ts`). The served-output scan found no `upload.wikimedia.org` or `Special:FilePath` URL
anywhere. One theoretical gap: a bare array of image URL strings would pass `walk` untouched (`images.ts:38`). No such shape exists
today. The og-manifest's Commons URLs are GB-B-2.

**Slug registry v2 against the 4 merged and the withdrawn cases.** The registry (`catalogue-slugs/2`) holds 363 place slugs, 4 merged,
0 retired and 0 withdrawn, plus 14 trip slugs. The semantics are right in the store:
- a merged slug answers `moved` to the survivor's slug;
- a withdrawn slug answers `not_found` and stays reserved;
- `ids=` resolves through `currentSlug`, so a merged id follows its survivor and a withdrawn one drops;
- a trip has no withdrawn check, but an absent row is `not_found` anyway.

The gap is on the page route (GB-B-4).

## Checked and found clean

| Check | How | Result |
|---|---|---|
| Caps inside the store | read `json/index.ts` | `page()` refuses `pageSize > 100` with `too_large` (`:67-74`); `search` refuses `limit > 50` (`:179-180`); `near`, `towns` and `nearbyForPlace` validate, then answer `not_available`; `countPlaces` returns no rows; `ids` max 100, values per key max 50, text max 200 (`place.ts:120-126`); every raw query value max 2000 (`http.ts:12`) |
| Volume story (P8) | read A23, EXECUTION-PLAN risk "P8 by API" | Honest. About four pages of 100 rows plus one `getPlace` per slug copy the catalogue today, and the prerendered fallback shards and search parts serve the same in a few dozen files. The caps bound a response, not a client. A rate limit is deferred to hosting (scope gap: GB-A-9) |
| Strict query decoding | read `httpCodec.ts` | Unknown keys refused, repeated keys refused, `page` and `pageSize` must be positive integers, `bbox` four finite numbers, every decoded object re-checked by the method's schema |
| Error shapes and codes | read `result.ts`, `respond.ts:81-112` | `{error:{code,message,details?}}`, statuses 400/400/404/413/501/500, `no-store` on every error, uncaught throws map to 500 `internal` and log server-side only |
| ETag and 304 | `respond.ts:95-108` | ETag is the store revision; `If-None-Match` handles lists, weak validators and `*`; the detector runs before the 304; `no-store` endpoints carry no ETag |
| No body rewriting | `respond.ts:100-108` | The detector only blocks (500); renditions are applied once at the source, so a page and the API agree (A18) |
| Path traversal | read `source.ts`, `globe.ts:94-106`, `exports.ts`, `openapi.json/route.ts` | No request value reaches a path. `globeLine` reads only ids in the directory listing; features are a `Map` lookup; pins and cards index objects by values the regexes limit to `[a-z]{2}` and `place:`/`trip:` slugs; export builds from the dataset by slug; the OpenAPI route reads a constant path |
| Header injection | `respond.ts:99` | `filename` is `<slug>.<ext>`, the slug restricted by `SLUG_RE` and `exportFile.filename`'s pattern |
| Redirects | `respond.ts:97`, `moved.ts`, the page routes | 308 locations come from registry slugs, never from the request: no open redirect. API paths end in `/`, matching `trailingSlash`, so a 308 lands on a canonical URL and cannot loop |
| `[...path]` shapes | `globe/[...path]/page.tsx:13-18` | Lower-cased, 1 to 3 segments, country `[a-z]{2}`, slugs by pattern; anything else 404 (indexing and caching issue: GB-A-4) |
| Cache headers | `respond.ts:13-18` | Data `public, max-age=60, swr=600`; globe `public, max-age=3600`; export `private, max-age=0`; health and report `no-store` |
| Instrumentation | `web/instrumentation.ts` | Node runtime only; warms the store; on failure logs the error server-side and serves pages; exposes no data (retry bug: GB-A-5) |
| Keys | prefix grep of `.env.local` values, counts only | ORS and Google key prefixes: 0 files in `.next/static`, `.next/server/app`, `web/public`, and 0 tracked files. ORS is read only by `scripts/legs-ors.mjs`. `NEXT_PUBLIC_GOOGLE_MAPS_KEY` appears in 4 chunks only as a name in a warning string |
| Household strings in built output | `strscan.mjs` over 7,485 files in `.next/server/app`, `.next/static`, `web/public` | 0 hits for Whitby, instagram, facebook, tiktok, `sourceTypes`, `"added":`, an email address, a status value, `research/`, `inbox/` or `screenshot`, a Commons hotlink, `seed/prototype`. Phone: one public number (Jasper dispatch). "child 3-12" and "adults and children from about 4" are a fee table and the plan's audience line from `party.ts`, not the household. `"notes"` non-empty only on public trip-day notes. The only household values found are GB-B-1 |
| Points near home in built output and `data/` | `homescan.mjs`, counts and distances only | 0 within 2 km (above) |
| OpenAPI document | grep of `data/schema/generated/openapi.json` | No Whitby, instagram, `sourceTypes`, `added` or example values. 20 paths, OpenAPI 3.1.0 (path error: GB-A-6) |
| Private saves in API output | read `placeDetail.ts`, PRIV1 schema, K7 | `sourceTypes` and `added` are not in the row schema; the detector and K7 block them; `sources` never names `locations`; `notes` is literally `""` |
| Point sources | grep of place payloads | OSM, own and `prototype_approx` only: no Google or AllTrails coordinates; AllTrails, Google, Tripadvisor and Komoot appear as links |
| `data/seed/prototype` | scan | Not in `web/public` or any served file; it appears only in server trace manifests (`*.nft.json`), which are not served |
| Unlisted trips | `json/index.ts:44`, `:202`, `:227` | `getTrip` and `getExport` read only listed trips |

### Commands (all read-only; outputs counted, never values)

```
git diff --stat ec7d51a...d1a1156 ; git log --oneline ec7d51a..d1a1156
node <scratchpad>/homescan.mjs web/.next/server/app web/.next/static web/public   # pairs near the point, both radii
node <scratchpad>/homescan.mjs data ; node <scratchpad>/homescan.mjs legacy research
node <scratchpad>/strscan.mjs                                                       # household patterns in served output
node -e '<read home.ts point; count standalone lat and lon literals per tracked file>'
grep -rlF "<first 8 chars of each key, held in a shell variable>" web/.next/static web/.next/server/app web/public | wc -l
grep -rhoE "<day month year>" web/.next/server/app web/.next/static | sort | uniq -c
node -e 'require("./.next/prerender-manifest.json")'  # og-manifest still prerendered
```

The scan scripts live in the session scratchpad and print file names, counts and distances only.
