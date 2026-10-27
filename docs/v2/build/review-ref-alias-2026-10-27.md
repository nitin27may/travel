# Review: public ref aliases (REF-C + REF-W), R4 privacy

Reviewer: independent code audit (Opus), 27 Oct 2026. Task REF-REVIEW.
Scope: `public/REF-C` @ `52a05894` and `public/REF-W` @ `dca6bbab`, stacked on `main` @ `7a112a84`. Spec:
[public-ref-aliases.md](../features/public-ref-aliases.md). The owner rulings (QR1 to QR4) are taken as given: a month with a year is
private; a year alone, or a season with a year, is public; a dated ref sent as input answers `unknown`; the repo stays public; old-site
redirects come later (REF-L).

**Verdict: merge after fixes.** No served byte holds a dated folder or a month plus year of a planned trip, and the resolver is not an
oracle. There is one must-fix, and it applies only if release A ships without this stack. The should-fix items harden the change and
can follow it.

## How it was checked

- A scratch worktree at `dca6bbab` with a clean `pnpm install` and a full `pnpm --dir web build`, using the home-point env. Deleted afterwards.
- Every served file was scanned: 10,974 files across `.next/server/app` (`*.html`, `*.rsc`, `*.body`, `*.meta`, `.segments/**`),
  `.next/static` and `public/`. The scan looked for the 8 pinned names, case-insensitive, and for a generic
  `word[-_ ]month[-_ ,]year` pattern. The 8 names had 0 hits in served files. They do appear in 10 server JS chunks and in `*.nft.json`
  traces, but neither of those is served. Every generic hit is a place fact ("read 19 Oct 2026", "5 Apr-1 Oct 2027 open house") and
  none is a trip date. The trip pages and every export format of three dated trips (ics, csv, kml, gpx, print, json) hold no ISO date
  and no month with a year.
- `next start` was probed with curl. `resolve` gave the same answer for the right month, a wrong month, mixed case and `%2F`-encoded
  input: `unknown` with `space:null`, about 2 to 6 ms each. The alias form answers `current`. `LEGACY/...` fails the shape check
  (`invalid_input`) whatever the month. `search`, `places?trip=`, `trips/<dated>`, `globe/card`, `export`, the 404/400 bodies, the
  headers (no `Location`, `Link` or `Content-Disposition` holds a month) and `openapi.json` all behaved the same way for the right month
  and a wrong one. Error bodies echo only the visitor's own string.
- Tests: the core alias, slugs, public-store, detect, resolve, public-ref, validate and contract tests (477 passed). `slugs.ts --check`
  reported OK with 8 folder aliases. The web tests `dated-refs-output` and `origin-refs` passed (13). `tests/api`, `tests/privacy` and
  `tests/favourites` passed except 3 photo tests, which fail because the scratch worktree had no Commons cache. That has nothing to do
  with this change.
- A probe script ran the detector and `publicRef` over about 40 edge cases (listed below).

## Must-fix

**M1. Stored favourites become `invalid` if release A ships before this stack.** `core/src/schema/favourites.ts:77` now makes `favRef`
refuse a dated ref, and `favItem.ref`, `favPending.ref`, `mergeItem.ref` and `accountFavourite.ref` all use `favRef`. The read path
(`core/src/favourites/envelope.ts:137`) treats any schema failure as `invalid`, and `web/lib/favourites/store.ts` then refuses every
write. Release A-prep (`e08a4a15`) already has favourites and `GET /api/v1/resolve`, and without this stack its resolver answers
`ref: legacy/canadian-rockies-sept-2029/...`. A visitor who hearts Bow Lake on A and then gets this stack is left with a Mine list that
cannot be read or written. Production v0.1 has neither `/mine/` nor `/resolve/` (both 404), so no device is affected today.
Fix, either of:
- (a) ship this stack in release A (recommended; see the backport notes);
- (b) on read, accept `favRefShape` and set a dated `ref` to `null`, so the next resolve fills in the alias. Add a test that plants an
  envelope holding a dated ref.

Do (b) as well if A ships first. It costs little and also covers the account rows that REF-V counts.

## Should-fix

- **S1. Detector false positives.** `DATED_FOLDER_RE` reads every string, prose included, while spec 2 says the rule covers ids only.
  `you-may-2020`, `covid-march-2020`, `open-may-2026`, a scheme-less `www.on-top.ca/...-July-2022.html` and a protocol-relative
  `//host/...` all hit. Only `http(s)://` links are skipped (`withoutOtherHosts`, `detect.ts:163`). Real data is clean today: every
  `/api/v1` body answers 200, and the built scan passes. The day research adds such a string, CI turns red, which is the right failure.
  If it reaches the server without CI, the endpoint answers 500 for that place. Skip `//host` and `www.` links too, and pin the
  prose-token cases in `detect.test.ts` so the behaviour is a decision, not an accident.
- **S2. The detector and `publicRef` disagree on encodings.** The detector decodes `%252F` and `%2D`, but `publicRef` rewrites only a
  single `%2F`, `%3A` or `%23` (`alias.ts:80`). Doubly encoded input or an encoded hyphen therefore fails closed (500) instead of being
  aliased. That is safe, but write it down or make the two agree.
- **S3. Links to other hosts that wrap our URL bypass the detector.** Examples:
  `https://web.archive.org/web/2026/https://nks-travel.pages.dev/<F>/` and `https://x.com/r?u=nks-travel.pages.dev/<F>`.
  `ABS_URL` removes the whole match, so our embedded URL goes with it. `publicRef` still rewrites the 8 pinned names, so nothing leaks
  today. A dated folder that is not pinned, inside such a link, would pass both checks. Fix: after removing a link to another host, scan
  its path and query again for an own-host substring, or skip only the path of such a link.
- **S4. The `E_SLUG` trip-id rule is narrower than the ruling** (`validate/trip.ts:96`). These all pass: `sept-2029` (no word before the
  month), `rockies-sept2029`, `rockies-2029-09`, `rockies_sept_2029`, `septembre` and other non-English months, and a non-breaking
  hyphen (U+2011). Trip slugs are new public ids, so the rule should be strict here. Add `(month)\d{4}`, `\d{4}-[01]\d`, a leading
  month, and the `[_\s]` separators.
- **S5. The removal half of `E_SLUG_ALIAS_PINNED` has no effect in CI.** `--base` defaults to `HEAD` (`core/bin/slugs.ts:126`), which is
  the commit under test, so a removed entry is compared with itself. A changed value is still caught by the rule-equality check, and a
  removed entry by `E_SLUG_ALIAS_MISSING`, as long as the folder is still known. Run check-all with `--base origin/main`, or drop the
  `base` path and its claim.
- **S6. `summary.ts:35` falls back without a word.** `folderOf` uses `?? trip.legacyUrl`, which is now the public form, so a trip
  missing from `TRIP_SLUGS` reads the folder `canadian-rockies-2029`. That folder does not exist, and the summary loses its legacy data
  without any error. Throw, or log at build time.
- **S7. Default `SITE_ORIGIN`.** With the variable unset, the build writes `https://nks-travel.pages.dev` into the canonical link, the
  sitemap (453 links) and the export `url`. That host's home page links all 8 dated folders (G2). On Vercel, `SITE_ORIGIN` is set (the
  live canonical is `travel-beta-tan.vercel.app`), so in practice the point is moot. Still, fail the build when `VERCEL_ENV=production`
  and `SITE_ORIGIN` is unset, so a misconfigured deploy cannot send visitors to the old host.

## Residual exposures (accepted or out of scope)

- G1 (the repo is public) and G2/S13 (the old site and its deployments), as ruled. These are the largest exposures. REF-L and QR3 stay open.
- `trip/<F>` keys in `data/trips/base-points.json` and `stop-refs.json` alias to `trip/<alias>`, and `privateRef` does not invert
  `trip/`. Today no `data/trips/<id>/` exists, so nothing collides. When TD-3/TD-4 create `data/trips/canadian-rockies-2029/`, the
  injectivity test (`alias.test.ts:131`) does not read `data/trips/**`. Extend it before TD-3 lands.
- Old shared deep links with a dated element anchor (`#offer-legacy-<F>-...`) now land at the top of the page. The links still work;
  only the fragment is lost.
- Detector gaps that do not matter today because legacy is frozen and the only names are the 8 pinned, hyphenated English ones:
  underscores, a joined `sept2029`, `septembre`/`juillet`, U+2011, a two-digit year (`sept-29`), and numeric `2029-09`. All of these
  miss. `publicRef` covers the real names whatever the detector does.
- Server JS chunks and `.nft.json` traces contain the dated names (`TRIP_SLUGS`, legacy file paths). They are not served, but they are
  inside the deployed function. That is acceptable under G1.

## Specific questions from the brief

- **Oracle:** none found. `isDated` short-circuits before any lookup (`alias.ts:128`, `resolve.ts:125`), and `isAskable` uses
  `favRefShape`, so a dated ref is never `invalid_input` because of its month. The verbatim `asked` echo passes the detector through the
  `asked` echo key and answers 200 (checked live). There was no measurable timing difference.
- **The `server-only` deviation:** acceptable. 0 hits for the 8 names in `.next/static`. `aliases.ts` reads through `node:fs`, so a
  client import would fail the build. The built scan (`dated-refs-output.test.ts`) is the guard that keeps this true, so keep it in
  `web.built`, where the gate map now has it.
- **Boundaries outside `/api/v1`:** the globe-data, list, search and sitemap route handlers and the OG prebuild all read the
  `@/lib/public` getters, which return the public form. The one server action (`app/account/actions.ts`) handles drafts only. There is
  no RSS. `tripSlugs`, `placeSlugs` and `globePaths` are not wrapped, but they hold only public slugs.
- **Pinning:** values are tied to the rule (`aliasOfFolder`), so the table cannot be hand-edited to show a month, and
  `E_SLUG_ALIAS_DATED` catches a dated alias. All 8 aliases equal their trip slugs, with no collision warning.

## Test quality and gaps

The tests are good where it counts. The scanner proves it can fail (planted forms, a directory with and without a planted file). The
store without the wrapper is shown to leak and to answer 500. The contract kit runs over a planted dated stub through `publicStore`
(K7). Gaps:
- no favourites envelope holding a dated ref (M1);
- no prose false-positive cases (S1);
- no doubly encoded or wrapped-link cases (S2, S3);
- no strict `E_SLUG` cases (S4);
- `--base` removal is tested only through `--base-file` (S5);
- `publicStore.resolveRefs` restores `asked` by index, and no test sends duplicate refs to confirm the rows stay one per input in the
  same order;
- the e2e `place-ref-anchors.spec.ts` was not run in this review.

## Merge readiness and backport

- REF-C and REF-W must merge together (G5): the detector rule without the wrapper turns K7 and the API privacy tests red. The stack
  merges cleanly onto the current `main` (`8823ec4a`, `git merge-tree`, no conflicts). `tools/gate/map.json` changed on both sides and
  merged textually, so re-run the gate check after the merge.
- Backport to `release/A-prep` (`e08a4a15`): `git merge-tree --merge-base 7a112a84 e08a4a15 dca6bbab` merges cleanly. Of the 39 files
  the stack touches, only 3 differ between A-prep and the stack base:
  - `data/schema/generated/openapi.json` (+4737/-2297): regenerate it on A; do not take the textual merge;
  - `tools/gate/map.json` (+53/-35);
  - `docs/v2/build/public-site/README.md` (+2).

  Every other file, including `respond.ts`, `detect.ts`, `favourites.ts`, `resolve.ts`, `store.ts` and `lib/public/index.ts`, is
  byte-identical on A-prep. The behaviour differs in one place: A-prep still serves `tripDetail.legacyUrl`
  (`core/src/schema/api/trip.ts:218`). The wrapper turns it into the alias path (`/canadian-rockies-2029/`), which does not leak, but it
  is a dead link to the old site. Drop the field on A, or accept it. The backport was not built or tested in this review: run the full
  gate on the merged A tree before release.
