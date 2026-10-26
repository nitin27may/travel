# IMG-1a findings: why photos and share images miss Vercel builds, and the prebuild design

> Spike for [briefs-bundle-A.md](../../briefs-bundle-A.md) 7.8 (IMG-1a, Opus, 26 Oct 2026, branch `public/IMG-1a` from `main`
> 4bc4cadb). Investigation and a tested design only: no production code changed, no deploy, no Commons request (every
> experiment ran with a guard that fails any Wikimedia fetch; 0 were attempted). The brief named the output
> `IMG-1-spike.md`; the coordinator named this path, and this page replaces the spike file. Principles: P8 (no Commons
> hotlinks, per-item files, light build inputs), P9 (one data boundary: the photo list comes from the same loaders the
> pages use), P1 (it must scale past 304 photos without a manual step per photo).

## 1. Root cause in five lines

1. Vercel builds with the Next.js build adapter (`@vercel/next` sets `NEXT_ADAPTER_PATH`; the log line is "Applying modifyConfig from Vercel").
2. Under the adapter, Next 16.4 writes prerendered pages to `.next/server/route-cache/APP_PAGE/<hash>/...`, not `.next/server/app/*.html`, and the adapter copies them into the deploy output inside `next build`.
3. `scripts/images.mjs` and `scripts/og.mjs` run after `next build` and look only in `.next/server/app`. They find nothing, print "images: no Commons photos in the build" and "og: no manifest, skipped", and exit 0.
4. So production pages keep all 304 Commons URLs (4,474 occurrences). No `/img` or `/og` file exists. No image map is written, so API responses drop every photo.
5. Even with the right order, `og.mjs` would still fail on Vercel, because Chromium is not installed there: it would copy `og-default.png` under a `.jpg` name. So share images have to come from the Mac's cache, as photos already do.

This is more than a timing problem: the scripts look in a folder the adapter build no longer writes. The fix (D13) holds:
make every image file and the image map **before** `next build`, and have the pages emit rendition URLs while they
render. After that, nothing that runs after the build can affect what ships.

## 2. Evidence

### 2.1 Experiments (local, no deploy, Commons blocked)

Every run used the worktree, the full photo cache copied to a scratch folder (`COMMONS_CACHE`), the home point from
`~/.config/travel-secrets/home-point.env`, and a `NODE_OPTIONS=--import` guard that throws on any `*.wikimedia.org` fetch
and logs the attempt. The Vercel CLI is 58.4.4 with `@vercel/next` 4.20.5. A local `vercel build` turns the adapter on
only with `NEXT_ENABLE_ADAPTER=1`. Section 6 asks the coordinator to confirm the remote build does the same.

| Run | What | Result |
|---|---|---|
| E1 (today) | `NEXT_ENABLE_ADAPTER=1 vercel build`, project build command `pnpm run build` (`next build && images.mjs && og.mjs`) | exit 0, 205 s (load average about 280). Log: `images: no Commons photos in the build`, `og: no manifest, skipped`. `.next/server/app` holds **0** `.html/.rsc/.body` files; `.next/server/route-cache` holds the pages (436 files with Commons URLs). `.vercel/output/functions` has **412 files** with Commons URLs (**4,474 occurrences, 304 distinct photos**); `.vercel/output/static/img` and `static/og` are **empty**; `functions/og-manifest.json.prerender-fallback.body` (**369 items**) is in the deploy output, served as a static prerender (the route's 404 guard never runs). Commons fetches attempted: 0 |
| Collector | the pages' own loaders (`web/lib/public`, `web/lib/globe/data.ts`) run in plain Node **before** any build, walking every trip, place and the globe index for photo URLs | **304** distinct Commons files and **369** share-image items in **6.9 s**. Matches the last local build's image map: all 301 mapped files are in the list, and the 3 extra files are new Waterton photos that are not in the cache. Runs under stable type stripping after a one-line change (section 4, step 2) |
| Prebuild | from the collector's list, cache only: 320/640/960 WebP with sharp, `.generated/image-map.json`, then `og.mjs` on the collector's items | **301 of 304** photos (3 missing from the cache, listed), **897** renditions (53 MB) in **67 s**; **369** share images (15 MB) in **49 s** (Chromium, Mac). Commons fetches attempted: 0 |
| E3 (fix) | the photo URL producers patched to call `renditionOf()` at render time (a photo with no rendition is dropped), `build` reduced to `next build`, then `NEXT_ENABLE_ADAPTER=1 vercel build` | exit 0, 102 s. **0** non-code files with a Commons image URL in `route-cache`, `server/app` or `.vercel/output/functions`. **897** distinct `/img/*.webp` URLs in pages, and all **897** files are in `.vercel/output/static/img`. **369** files are in `static/og`. `og:image` on `/trips/canadian-rockies-2029/` and `/places/moraine-lake/` names a 1200x630 JPEG that exists. `web/.generated/image-map.json` is in the functions' `filePathMap`, so the API carries photos. The only remaining match is a string inside MapLibre's own code in `_next/static`, not an image URL |

The patches were reverted. Only this page is committed. The scratch scripts (the Node module hook, the collector, the
prebuild prototype and the fetch guard) are summarised in section 4.

### 2.2 The code, read against the result

- [`web/package.json`](../../../../../web/package.json): `"build": "next build && node scripts/images.mjs && node scripts/og.mjs"`; the Vercel project runs `pnpm run build` with root `web`.
- [`web/scripts/images.mjs`](../../../../../web/scripts/images.mjs): `OUT = <dist>/server/app`. It walks only that folder and skips `page`, `route` and `chunks`. With no match it exits 0 before it writes the map. This silent no-op is how the fault went unnoticed. The rewrite edits build output in place, and the adapter has already copied that output.
- [`web/scripts/og.mjs`](../../../../../web/scripts/og.mjs): it needs `<dist>/server/app/og-manifest.json.body`, which the adapter build never writes there. It also deletes that body as a privacy step, but the adapter has already copied it into the deploy output, so on Vercel `/og-manifest.json` would serve all 369 items (the audit GB-B-2 issue, reopened by the adapter). It launches Chromium from `@playwright/test`. No browser is installed on Vercel, so it falls back to copying the PNG default under `.jpg` names (the wrong content type).
- [`web/scripts/commons-cache.mjs`](../../../../../web/scripts/commons-cache.mjs): it fetches on every miss, with no offline switch. Its cache key is `base64url(url).slice(-80)`, the tail of the URL, and **two pairs of different photos share a key** today:
  - `Athabasca_Glacier_from_the_valley_floor,_Jasper_National_Park,_Alberta,_Canada.jpg` and `Mount_Andromeda_from_the_Athabasca_Glacier,_Jasper_National_Park,_Alberta,_Canada.jpg` share a cache file and the rendition key `4057548feb`;
  - `Mer_de_Glace_from_Montenvers,_Chamonix,_Haute-Savoie.jpg` and `Panorama_of_Mer_de_Glace_from_Montenvers,_Chamonix,_Haute-Savoie.jpg` share `b8320a3291`.

  So one photo in each pair shows another photo's image under its own author and licence line. That is a wrong credit,
  which is a licence problem as well as a display bug. IMG-1b fixes the key, and 4 files have to be fetched again.
- [`web/lib/server/images.ts`](../../../../../web/lib/server/images.ts): `renditionOf()` already maps a Commons URL to `/img/<key>-<w>.webp` from `.generated/image-map.json`, and `withRenditions()` drops photos that have no rendition. Today only API responses use it. On Vercel the map did not exist when the server functions were traced (it is written later), and [`.vercelignore`](../../../../../.vercelignore) excludes `web/.generated/*`, so deployed functions never had it.
- [`web/lib/server/runtime-files.ts`](../../../../../web/lib/server/runtime-files.ts) and [`web/next.config.ts`](../../../../../web/next.config.ts): the map is already in `REVISION_FILES`, so `outputFileTracingIncludes` ships it **if it exists at trace time**. E3 confirms it does once the map is written before the build.
- The photo URL producers are three: `commonsUrl()` in [`web/lib/public/photos.ts`](../../../../../web/lib/public/photos.ts) (through `makePhoto()` for trip galleries, trip heroes and place photos, and `photoSrcSet()`), and `commonsAt()` in [`web/lib/globe/data.ts`](../../../../../web/lib/globe/data.ts) for Wikidata P18 card images. All are server-only, and no client component imports them. `fileFromUrl()` parses source data, never a produced URL, so mapping at the producer is safe.
- Rendering: all 1,326 prerendered routes have `revalidate: false`, and every dynamic route has `fallback: false` except `/globe/[...path]` (a blocking fallback). This is from the last build's `prerender-manifest.json`. The API goes through `withRenditions()`. Mapping at the producer (section 4) also covers any page rendered at request time, which a rewrite of build output never could.

## 3. The photo cache

| Fact | Value |
|---|---|
| What | `web/.og-cache/`: one 960 px Commons thumbnail (JPEG) per photo URL, written by `commons-cache.mjs` |
| Size today (main checkout) | **299 files, 58 MB** (about 194 KB each). With the 3 missing Waterton photos and the 2 collided pairs split, there will be 304 files, about 59 MB |
| Derived outputs | renditions 897 files, 53 MB (320 px 3.5 MB, 640 px 14.5 MB, 960 px 33.5 MB); share images 369 files, 15 MB |
| In git | no (`web/.gitignore`); P8 rules out committing it |
| In the Vercel upload | **yes**: `.vercelignore` restates every git rule except `web/.og-cache`, and the release runbook copies the cache into the release worktree. Estimated CLI upload: 4,008 tracked files at 72.2 MB, plus 299 cache files at 58 MB, about **4,300 files and 130 MB**. Section 6 has the coordinator read the real number from the next deploy's upload line |
| Who deploys | only the Mac, by CLI: the Git integration stays disconnected (Q226, Q266), so every build is a CLI upload and can carry the cache |

**Storage options for the cache, cheapest first:**

1. **Upload it with the CLI deploy (chosen).** It costs nothing, already works (`.vercelignore`), needs no new secret, no
   new service and no network step in the build. The cache and the code come from the same folder, so they stay in
   step. Limit: it works only for CLI deploys, which is the only kind we make (Q266).
2. **Cloudflare R2** (the bucket R-52 already plans for the planner; about 10 GB free, no egress fees). It is the fallback
   if the Git integration is ever turned on or the upload limit is reached. The prebuild would download one tarball,
   `og-cache-<hash>.tar`, in one request. It costs a read key in Vercel env, an upload step on the Mac, and a network
   dependency in the build.
3. **Vercel Blob.** The Hobby free tier covers 59 MB, but it adds a token, a second store to keep in step, and another
   vendor dependency for no gain over R2.
4. Neon has no object storage (Postgres only). Storing 59 MB of JPEG as `bytea` is possible but is the wrong tool.
   Committing the cache to git breaks P8 and puts 59 MB of binary churn into a repository that is planned to go public. Both are rejected.

**With a missing photo and offline mode (Q292):** the prebuild never fetches unless `--fetch` is passed, so offline is
the default rather than an env setting (section 4, step 3). A file not in the cache gets no rendition and is left out
of the map. At render time `makePhoto()` returns null, the page shows the kind glyph or placeholder it already shows for
uncredited photos, and the credit is dropped with the photo, so no credit is left without its photo. The run ends with
`images: N photo(s) not in the cache: <names>; run "pnpm --dir web images:warm --fetch" on the Mac`. The build still
passes.

## 4. Design for IMG-1b

```
pnpm run build
  = node scripts/images.mjs --prebuild     # list photos from the loaders; cache only; renditions to public/img; .generated/image-map.json
  && node scripts/og.mjs --prebuild        # share items from the same list; copy cached cards (or render if a browser exists); default JPEG otherwise
  && next build                            # pages call renditionOf() while they prerender; the map is traced into the functions
  && node scripts/images.mjs --verify      # read-only: 0 Commons URLs in prerendered output; every og:image file exists; fails on an empty scan
```

1. **One photo and share-item list, from the page loaders (P9).** `web/scripts/prebuild-data.ts` imports
   `sharedPublicData()` from `web/lib/public/index.ts` and the globe index. It walks every trip and place card and
   detail, and collects every Commons file name and the share items, the same list the `og-manifest.json` route builds
   today. It writes `web/.generated/prebuild-photos.json` (file names) and `web/.generated/og-items.json`. It runs in
   plain Node 22.23 (the `engines` pin) through a small `module.registerHooks` module hook
   (`web/scripts/ts-hooks.mjs`, about 30 lines: the `@/` alias, extensionless relative imports, JSON imported without
   attributes). While collecting it sets `IMAGES_SOURCE_URLS=1` so the producers return source URLs. Measured: 6.9 s,
   304 files, 369 items.
2. **Stable type stripping.** `web/lib/public/vals.ts` line 133 has the only TypeScript parameter property on the
   loaders' import graph (`constructor(readonly log?: DropLog) {}`). Rewriting it as a field plus an assignment, with no
   change in behaviour, lets the collector run under Node's default type stripping without
   `--experimental-transform-types`. Tested. The fallback if more TS-only syntax appears later is
   `--experimental-transform-types`, which also passed.
3. **Cache: correct key, offline by default.** `commons-cache.mjs`:
   - The key becomes the first 32 hex characters of `sha256(src URL)`.
   - `thumb()` fetches only when the caller passes `{ fetch: true }`. `IMAGES_OFFLINE=1` is accepted but is now the
     default, so Vercel needs no env value. The briefs-bundle-A.md launch list item O5 becomes "no action".
   - Fetching happens only in `images:warm --fetch` (a new `package.json` script), run under
     `flock /tmp/travel-commons.lock` (one runner).
   - A one-time `--rekey` renames the existing cache files to the new key, computed from the collector's file list. It
     drops the two collided files and reports the 4 names that need fetching again.
4. **`images.mjs --prebuild`:** read `prebuild-photos.json`, take each source from the cache only, write the 320, 640
   and 960 WebP renditions (rendition key = `sha1(bytes)` first 10 characters, unchanged, so URLs stay stable), and write
   `image-map.json` (file name to key). List what is missing at the end. The old walk over `.next/server/app` and the
   in-place rewrite are deleted.
5. **Map at render time:**
   - `commonsUrl()` returns `renditionOf(src)` and `makePhoto()` returns null when there is none.
   - `commonsAt()` does the same, and the P18 card image is null without a rendition.
   - With `IMAGES_SOURCE_URLS=1` (the collector, and vitest through `test.env`, so the existing unit assertions that
     expect Commons source URLs keep passing) both return the Commons URL.
   - `next dev` with no map file passes the URL through (development only).
   - Pages keep asking for 480, 960 and 1600 px. These map to the 640 and 960 renditions, exactly as today's rewrite
     did, so HTML and size budgets do not change. Tidying `photoSrcSet()` is a later task.
   - `withRenditions()` stays as the API guard.
6. **Share images:** `og.mjs --prebuild` reads `og-items.json`. For each item it looks for
   `web/.og-cache/og/<kind>/<slug>-<h>.jpg`, where `h` is `sha256(item JSON, og.mjs source, the --header and --accent tokens)`
   (first 12 hex characters).
   - If the file exists, it copies it to `public/og/<kind>/<slug>.jpg`.
   - If a browser is available (the Mac: check-all, e2e, the release worktree), it renders the card with the current
     template and stores it in the cache first.
   - If not (Vercel), it writes the default card converted to a real JPEG with sharp, and lists the stale or missing
     cards.

   The `og-manifest.json` route and its test are deleted. The e2e check that `/og-manifest.json` does not answer 200
   stays. The release worktree's build, or `images:warm`, keeps the cards current before `vercel deploy`.
7. **`images.mjs --verify` (post-build, read-only):**
   - It scans `.next/server/app` and `.next/server/route-cache` (adapter layout) for `.html .rsc .body .meta .json .txt`,
     skipping `chunks`.
   - It fails on any `commons.wikimedia.org/wiki/Special:FilePath` or `upload.wikimedia.org`.
   - It fails if it scanned **0** prerendered files, which guards against the silent no-op behind this bug.
   - It fails if an `og:image` path in the scanned HTML has no file in `public/og`.
   - It fails if `image-map.json` is missing.
8. **Order elsewhere.** `web/tests/e2e/global-setup.ts` runs the same four steps. A unit test asserts that
   `package.json`'s `build` line and global-setup's list match. `tools/check-all.sh` already runs `pnpm --dir web build`,
   so only its comment (lines 62 to 64) changes. `web/scripts/build-fixture.mjs` (the privacy fixture) keeps a bare
   `next build`, because a missing map only drops photos there.

**Why not the alternatives:**

- Rewriting the adapter's copied output after the build: `vercel build` writes `.vercel/output` outside the build
  command, and the layout belongs to Vercel.
- A custom adapter: too much surface for one feature.
- Next's `opengraph-image` with `next/og`: it does build inside `next build` with no browser, but satori needs TTF or WOFF
  fonts and static weights (we ship variable WOFF2), and the card's look would change and need a design review. It is
  worth considering only if Git-connected builds ever replace CLI deploys.

### 4.1 The prebuilt fallback (`vercel build` on the Mac, then `vercel deploy --prebuilt`)

| | Remote build with prebuild (chosen) | Prebuilt from the Mac |
|---|---|---|
| Fixes the order? | yes | **no, not by itself**: the adapter also runs inside `next build` under `vercel build` (E1 was a local `vercel build`), so the same prebuild change is needed either way (D13) |
| Share images | from the cache, rendered on the Mac | Chromium is available, so they render live |
| Secrets | none on disk beyond today | needs `vercel pull --environment=production`, which writes production env values, secrets included, to `.vercel/.env.production.local` on the Mac. The release flow avoids that today |
| Native code | built on Linux, as Lambda runs | built on macOS arm64. Any native module traced into a function would be the wrong binary (the risk is low today, `pg` is pure JS, but there is no guard) |
| Upload | about 130 MB of source | `.vercel/output`: 309 MB, 13,048 files on disk (E3). Uploads are deduplicated by hash, but this is still more than the source upload |
| Provenance | Vercel records the build log, and the commit is in `--meta` | the log stays on the Mac, and a dirty tree can be deployed |
| Release steps | unchanged (`vercel deploy` / `--prod`) | two commands, and the RELEASE-PLAN 6 step 8 text changes |

Recommendation: remote builds with the prebuild. Use prebuilt only if a preview shows the adapter dropping `public/`
files written before `next build`. E3 shows it does not: `@vercel/next` copies `public/**` into `output/static` after
the build command.

## 5. IMG-1b brief, refined (Sonnet; 7.5 h, was 5 h)

- **Goal.** As 7.8. Production serves every photo from `/img` and every share image from `/og`, and never hotlinks
  Commons (P8).
- **Owns (7.8's list, adjusted).**
  - `web/scripts/images.mjs`, `web/scripts/og.mjs`, `web/scripts/commons-cache.mjs`, `web/scripts/prebuild-data.ts` (new),
    `web/scripts/ts-hooks.mjs` (new).
  - `web/package.json`: the `build` line plus a new `images:warm` script.
  - `web/vitest.config.ts`: one `test.env` line, `IMAGES_SOURCE_URLS`.
  - `web/lib/server/images.ts`, `web/lib/format/image.ts` (comment only).
  - `web/lib/public/photos.ts` (`commonsUrl`, `makePhoto`), `web/lib/public/vals.ts` (line 133 only),
    `web/lib/globe/data.ts` (`commonsAt` and its one call only).
  - `web/app/og-manifest.json/route.ts` (deleted), `web/tests/og-manifest-route.test.ts` (deleted).
  - `web/tests/e2e/global-setup.ts` (the step list), `tools/check-all.sh` (the comment at lines 62 to 64 only),
    `tools/tree_check.py` and its test.
  - `web/tests/images*.test.ts` (new), `web/lib/og.ts` (comment only).
- **Must not touch.** `.vercelignore`, Vercel settings, env values, `web/components/**`, `data/**`, `legacy/**`.
- **Steps.** Section 4, items 1 to 8, in that order.
- **Coordinator step, not the builder's: the one-runner fetch.** After the merge, on the Mac only, run
  `flock /tmp/travel-commons.lock pnpm --dir web images:warm --rekey --fetch`. That is 7 Commons requests, one at a time:
  the 3 Waterton photos and the 2 collided pairs. Then copy the cache back to the main checkout.
- **Tests.**
  - The prebuild, with `fetch` stubbed to throw, completes and calls no Wikimedia host.
  - A cache miss drops the photo: `makePhoto` returns null, and the credit goes with it.
  - `--verify` fails on a planted Commons URL in a `route-cache` file and on an empty scan.
  - Every `og:image` in a build names an existing file.
  - The collector's file list equals the set of `/img` keys in the built pages.
  - The cache key has no collisions: the two known pairs get distinct keys.
  - The `--rekey` dry run.
  - `build` and global-setup run the same steps.
  - `tree_check` passes without `web/.og-cache`.
- **Acceptance (T1).**
  - A clean public build has 0 Commons URLs in `.next/server/app` and `.next/server/route-cache` before `--verify` runs.
  - With the full cache: 304 photos served (301 before the warm-up), 0 Commons fetch attempts during `pnpm build`.
  - `og:image` on `/trips/canadian-rockies-2029/` and `/places/moraine-lake/` names an existing JPEG in `public/og/`.
  - S13, place HTML and trip start JS are unchanged (the URL strings are the same as today's rewritten ones).
  - `NEXT_ENABLE_ADAPTER=1 vercel build` in the worktree (with a no-op install command; see section 6) gives 0 Commons
    URLs in `.vercel/output/functions` and 897 or more files in `.vercel/output/static/img`.
  - `/og-manifest.json` is absent from the output.
- **Commit.** `web(IMG-1): renditions and share images before next build; offline image mode; no Commons hotlinks (P8)`.

## 6. What the coordinator runs (IMG-1V), and the remote facts to confirm

1. **Before IMG-1b (read-only; optional but cheap).** Run `vercel inspect --logs <the 25 Oct preview URL>`, then search
   the log for `Applying modifyConfig from Vercel`, `images: no Commons photos in the build`, `og: no manifest`, the
   Node version and the upload size. That confirms the remote builder uses the adapter, as E1 did, and gives the real
   upload size against the Hobby limit.
2. **After IMG-1b merges, on the Mac only:** run
   `flock /tmp/travel-commons.lock pnpm --dir web images:warm --rekey --fetch` (7 requests), then `pnpm --dir web build`
   once so the share-image cache fills.
3. **Preview (Q266: by hand, never `--prod`).** From the IMG-1b tip in a clean worktree, with `web/.og-cache` and `.vercel/` copied from the main checkout:
   `vercel deploy --meta commit=<sha>`. Then, with protection bypass, `vercel curl /trips/canadian-rockies-2029/ --deployment <preview URL>`
   and the same for `/places/moraine-lake/` (check `vercel curl --help`; the command is beta). Expect:
   - 0 matches for `Special:FilePath` or `upload.wikimedia.org`;
   - `/img/...webp` sources;
   - the `og:image` URL answers 200 `image/jpeg`;
   - `/og-manifest.json` answers 404;
   - the build log shows the prebuild counts (`301`/`304 of 304` photos, `369` share images) and `--verify` passing.
4. Production stays behind Q43, as before.

**Local reproduction (no deploy).** `vercel build` from a worktree. The CLI 58.4.4 cannot parse the pnpm 12 lockfile and
falls back to `npm install`, which fails on `workspace:*`, so use a copy of `.vercel/project.json` whose `installCommand`
is a no-op. Set `NEXT_ENABLE_ADAPTER=1`, point `COMMONS_CACHE` at a copy of the cache, and keep a fetch guard. Delete the
copied `.vercel/` afterwards so nobody deploys with the edited install command.

## 7. Risks

| Risk | Size | Mitigation |
|---|---|---|
| Vercel build time (45 min limit) | low | Measured on the Mac under heavy load: collector 7 s, renditions 67 s, `next build` 100 to 205 s; share images are copies on Vercel. Expect 4 to 6 minutes in total |
| Upload size limit | medium, unconfirmed | about 130 MB with the cache. Read the real figure (section 6 step 1). If it is over the limit, move to the R2 tarball (section 3, option 2) |
| Node on Vercel older than 22.23 (`registerHooks` needs 22.15 or later; default type stripping 22.18 or later) | low | `engines` says 22.23 or later. Read the Node version in the build log; `--experimental-transform-types` works from 22.7 |
| Stale share images on deploy | medium | The cache key covers the inputs, so a stale card is never used. It falls back to the default card and is listed. The release worktree's build re-renders the cards first |
| Licences | **existing defect** | Two pairs of photos show another photo under their own credit today (section 2.2), and IMG-1b fixes it. After IMG-1b, credits travel with the `Photo` object and a photo with no rendition takes its credit with it. The share-image credit line stays in the template. Commons attribution pages (`sourceUrl`) stay as links, not hotlinks |
| Collector drift from the pages | low | Both use the same loaders (P9), and the "collector set equals built `/img` keys" test catches drift |
| `/og-manifest.json` public on Vercel today | low (no household data, but an uncapped bulk list, P8) | Fixed by deleting the route in IMG-1b. Not deployed to production yet |
| Test files in function bundles (seen in E3: `web/tests/api/image-map-log.test.ts` in `trips.func`'s file map) | low, outside this task | One note for the function-size owner. It does not block |
