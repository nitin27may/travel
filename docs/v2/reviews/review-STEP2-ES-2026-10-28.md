# Review STEP2-ES: security and privacy of `/t/<id>/` and edit mode

Status: security and privacy review, 28 Oct 2026, Opus 5.5 (`claude-opus-5-5`). Package STEP2-ES (BACKLOG 15.373,
[build-plan.md](../design/step2/build-plan.md) STEP2-ES). Review only: this file is the only change. Reviewed: `main` at
06822e9d (merge of STEP2-E6), branch `step2/ES`.

## Verdict

- **`tripEdit` may be turned on for the owner's own testing: yes.** Nothing found lets one person read another's trip, nothing private
  reaches the server or a URL, and with the flag off `/t/` is a 404 and the public bundles hold no edit code. One gate is red on
  `main` (ES-004, the builder fence) and should be fixed in the next small patch. If the test deploy sets `NEXT_PUBLIC_CF_BEACON_TOKEN`,
  the beacon runs on `/t/` (ES-003): acceptable for the owner's own data, not for anyone else's.
- **Before `NEXT_PUBLIC_ACCOUNT_TRIPS=1`: fix ES-001 (high), ES-005, ES-006 and ES-008.** ES-001 is the one that matters. At the
  sign-in merge the person's removals, moves, day changes, notes and Maybe list are silently dropped, because they live in a device
  sidecar that the merge never sends. The sidecar then stays on the device with the notes in it, after the trip has moved to the account
  and after sign-out.
- **Before any user other than the owner sees `/t/` (GO-2): also ES-002 and ES-003.**

| Severity | Count | IDs |
|---|---|---|
| blocker | 0 | |
| high | 1 | ES-001 |
| medium | 4 | ES-002, ES-003, ES-004, ES-005 |
| low | 8 | ES-006 to ES-013 |

## 1. How this was checked

- Code read against [edit-mode-spec.md](../design/step2/edit-mode-spec.md) 9.3, 10, 12, 14, 15 and EA13,
  [gap-analysis.md](../design/step2/gap-analysis.md) D6 and the `/t/` route row, [edit-my-trip.md](../features/edit-my-trip.md) 4 and 7,
  and the earlier server review [review-em-s-2026-10-27.md](../design/shell/review-em-s-2026-10-27.md). Its blockers B1 (legacy
  `/account/` actions now scoped to `doc is null and deleted_at is null`, `core/src/db/tx.ts:107-130`) and B2 (minute, hour and day
  windows and the tombstone cap, `core/src/config/plans.ts:45-53`) are in the code.
- Two builds in the worktree: `NEXT_PUBLIC_TRIP_EDIT=1` and flag off (`NEXT_DIST_DIR=.next-off`), both with the decoy
  `HOME_POINT_LAT=10.5 HOME_POINT_LON=-140.5`, no root `.env.local`, `next start` on ports 4593 and 4594. Nothing was published or
  deployed.
- Headers taken with `curl -D -` for `/t/<uuid>/`, `/t/not-a-uuid/`, `/t/<uuid>` (no slash), `/trips/<slug>/`, the plan-model route
  and `/api/account/plans/`.
- Browser probe (Playwright Chromium, script in the session scratchpad, not committed). It seeded a device copy titled "Rockies with
  Emma and Leo" with children `[4, 7]`, start 2029-09-08. It added a note naming the children, removed a stop, then took Print, ICS,
  CSV, GPX and KML and pressed Share. It recorded every request (URL and body), every address the tab showed, the console, and
  `localStorage` and `sessionStorage` afterwards.
- `privacyHits` (`core/src/privacy/detect.ts`) and `nearHome` (`core/src/privacy/home.ts`) run over each generated file, the device
  storage and the plan-model answer.
- Unit tests: `tests/plan/isolation.test.ts`, `tests/trip-edit/**`, `tests/export/own-trip.test.tsx`, `tests/mine/**`.
- `git diff 232322ef^ HEAD` over `web/package.json`, `core/package.json` and `pnpm-lock.yaml`.

## 2. What is sound (verified, no action)

| Area | Evidence |
|---|---|
| `/t/` headers | 200 with `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate` (Next's default for `force-dynamic`), `<meta name="robots" content="noindex, nofollow">`, no canonical, no `og:*`, not in the sitemaps. The page sets these by hand in `web/app/t/[id]/page.edit.tsx:12-17` |
| Not-found semantics | The server page knows nothing of the trip and answers the same 200 HTML for every id, including `not-a-uuid`. The client checks the format (`isTripId`, `web/lib/trip-edit/keys.ts:16`) before it looks anything up. Signed in, the page never requests the id in its address: it reads the person's own list (`useAccountTrips`), and `GET /api/account/plans/{id}` answers 404 under RLS for an id the caller does not hold (`web/lib/server/plans.ts:274-285`). So no request depends on someone else's id, and nothing signals that it exists. Ids are `crypto.randomUUID()` (`web/lib/mine/copies.ts:22`) and keyed per user server-side |
| Reflected id | `/t/%3Cscript%3E.../` is percent-encoded in the RSC payload; no unescaped reflection |
| Nothing private in URLs | The probe's address list holds only `?view=day&edit=1` and `#day-n`. The party bar that writes `p=family-<age>` (`ProfileBar.tsx:146`) is replaced on `/t/` by `PartyLine`, and the document source writes operations, not the address (`web/lib/trip-edit/source.ts:96-112`). `?add=` is checked against `^[a-z0-9][a-z0-9-]*$` and removed with `replaceState` (`EditLayer.tsx:133-141`); `?mine=<id>` redirects only to a same-origin `/t/<uuid>/` (`web/lib/trip-edit/redirect.ts:25-33`). No open redirect |
| Nothing private in requests | 198 requests recorded. None carries the title, the note, the start date, an age or `family-4`. Reads go to public routes only (`resolve`, `plan-model`, `export/trip/<slug>`, `trips/<slug>/legs`, place rows), plus map tiles. Map tiles get the default `strict-origin-when-cross-origin` referrer, so no trip id leaves the origin |
| Plan-model API | Public data only. `planModelRun` builds the page's own model from `getTrip` (`web/lib/server/planModel.ts:30-37`), and `respond()` runs `privacyHits` over it. The probe's scan of the live answer: `[]`. With the flag off the route still answers 200; that is the model the public page already embeds, so no new data |
| Exports | Print, ICS, CSV, GPX and KML are built on the device (`web/lib/export/own.ts`). The party is words only: "2 adults, 2 children", never an age. The CSV carries no notes. GPX/KML text goes through `x()` (escape plus control-character strip). CSV quoting follows RFC 4180. Notes and titles render as React text: no `dangerouslySetInnerHTML` under `components/trips/edit`, `lib/export` or the print view. `privacyHits` is clean on print, CSV, GPX and KML; ICS has one false positive (ES-012). `nearHome` is 0 of 32 points on GPX and KML |
| Logs and errors | No `console.*` in `components/trips/edit`, `lib/trip-edit`, `lib/export` or `lib/mine` beyond the existing sync rules; toasts and sync notices are fixed words |
| Account routes | Flag, same-origin, session, JSON-only, bounded body (17 KB PUT), per-user write quota taken before any database work, whole-document Zod parse with the 16 KB rule (`core/src/schema/plan-draft.ts:747-758`), server-derived row columns, owner-only RLS, fixed error codes, `private, no-store`. No IDOR. Notes are capped at 2000 characters and reject control characters except tab and newline (`plan-draft.ts:427-432`); `opLog` is capped at 64 ids (`plan-draft.ts:516`) |
| Operation replay | `applyOp` parses each operation (`core/src/plan/ops.ts:414-416`) and validates the whole result. A resend whose id the document already holds is a no-op (template entries carry op ids; built documents keep `opLog`). A hostile undo stack planted in `sessionStorage` can only produce operations that pass the same parse |
| Dark by flag | Flag off: `/t/<uuid>/` answers 404. The route is not in the build (`pageExtensions`, `web/next.config.ts:16`), and no client chunk contains `travel.trip-edit`, `trip-doc-changed` or "Edit trip" |
| Home point | No client chunk contains `HOME_POINT`, the decoy values or the town pattern. `core/src/config/home.ts` appears in a client import trace through `web/lib/config/product.ts`, but that trace predates Step 2 (`build-S2-T1F-base.log`) and the bundler drops the module |
| Dependencies | None added since STEP2-C1 |

## 3. Findings

### ES-001 (high, before account sync): the sign-in merge drops the person's edits and leaves their notes on the device

- **Evidence.** A device copy keeps its removals, moves, day operations, notes, Maybe list and added-place op ids in the sidecar
  `travel.trip-edit.device` (`web/lib/trip-edit/deviceEdits.ts:46-59`), because `copies/1` cannot hold them. The merge posts only
  the `copies/1` items (`web/lib/mine/sync.ts:508-512`). It then caches each taken copy as `copyToPlanDraft(c)` with no sidecar laid
  over it (`sync.ts:524-540`), and `markMerged` removes the copy from `copies/1` (`core/src/schema/copies.ts:902-907`). After sign-in,
  `openTrip` reads the account document first (`web/lib/trip-edit/open.ts:51-54`), so every removal, move, note and day change made
  before signing in disappears from the trip without a word. The spec admits the gap (edit-mode-spec change log, 28 Oct 2026:
  "the sign-in merge does not carry them yet").
- **Second effect.** The sidecar entry is pruned only inside `storeDeviceEdits`, when another device copy is saved (`deviceEdits.ts:53`).
  With no device copy left, the notes stay in `localStorage` indefinitely. That is after the trip has moved to the account and after
  sign-out (`clearAccountData`, `sync.ts:893-895`, clears only `travel.mine.acct.*` and `travel.mine.outbox.*`). The probe's storage
  after one note reads `{"notes":{"4:bow-lake":"Emma EpiPen in red bag, Leo nap 13:00"}}`.
- **Repro.** Build with `NEXT_PUBLIC_SIGN_IN=1 NEXT_PUBLIC_ACCOUNT_TRIPS=1 NEXT_PUBLIC_TRIP_EDIT=1`. Signed out, copy a trip, remove a
  stop, add a note. Sign in and open Mine. The trip opens with the stop back and no note; `travel.trip-edit.device` still holds both.
- **Fix.** Merge the document, not the copy. On the device, lay the sidecar over each copy (`withDeviceEdits`) before the merge, and
  send the resulting `plan-draft/1`. Either extend the merge body with an optional `doc` per copy (validated whole on the server, as in
  PUT, and counted against the same 16 KB rule), or follow each `inserted` id with a revision-0 PUT of the full document. Cache that
  document, not `copyToPlanDraft(c)`. When a copy leaves `copies/1` (in `markMerged`'s caller), delete its sidecar entry in the same
  write. Add a test: device edits survive the merge byte for byte, and no `travel.trip-edit.device` entry outlives its copy.
  This shares a root with STEP2-P2 (the device list becoming `plan-drafts/1`); if P2 lands first, the sidecar goes away and only the
  merge needs the document.

### ES-002 (medium, before GO-2): removing or replacing a copy leaves its notes and edits on the device

- **Evidence.** `removeById` and `saveCopy` with `replace` (`web/lib/mine/copies.ts:41-85`) rewrite `copies/1` only; nothing touches
  `travel.trip-edit.device`. The orphan entry is dropped only on a later save of some other device copy (`deviceEdits.ts:53`), so a
  person who removes their only trip from a shared browser leaves the notes behind. A removed copy's tab-session undo stack
  (`travel.trip-edit.undo.<id>`) stays until the tab closes.
- **Fix.** Prune the sidecar against the live `copies/1` ids at every Mine read and on `removeById`, once the Undo window has passed.
  The simplest form is a `pruneDeviceEdits(storage, liveIds)` called from Mine's load and from `storeDeviceEdits`. `undoRemove` within
  the window keeps working because the entry is still there. Remove the copy's undo key from `sessionStorage` on Remove.

### ES-003 (medium, before GO-2): the analytics beacon runs on `/t/`

- **Evidence.** `Beacon` renders on every path that `beaconAllowed` does not exclude (`web/components/shell/Beacon.tsx:12-16`), and
  `NO_BEACON_PATHS` holds only the account and sign-in paths (`web/lib/beacon.ts:8`). Cloudflare Web Analytics records the Path dimension
  and History API navigations (Cloudflare docs, Web Analytics "Dimensions": Path, Navigation type "Routing APIs").
- **Effect.** Every person's trip id goes to a third party as a distinct path, and so does every `?edit=1` or tab change. A third-party
  script also runs on the one page that shows children's ages, notes and dates. The privacy page describes the counts as which pages
  were opened, "for example `/trips/dolomites-2027/`" (`web/app/privacy/PrivacyBody.tsx:49-53`), which is not true of a private id.
  This is the same reasoning that took the beacon off `/account/` (review GSI-S S7).
- **Fix.** Add `/t/` (and `/mine/`, for the same reason) to `NO_BEACON_PATHS`. Extend `web/tests/analytics.test.ts` with a flag-on
  `/t/<uuid>/` case that asserts no `cloudflareinsights` script, both in the server HTML and after a client navigation from `/trips/`.

### ES-004 (medium, now): the builder fence (G1) fails on `main`

- **Evidence.** `tests/plan/isolation.test.ts` "G1: only the builder and the extension points import builder code" fails with
  `["web/components/trips/edit/add/fit.ts", "web/lib/export/own.ts"]`. `fit.ts:4` imports `warnLevel` from
  `@travel/core/plan/warnings.ts`; `own.ts:9` imports the type `PlanDraft` from `@travel/core/schema/plan-draft.ts`. X-S2 allows these
  targets only under `web/lib/trip-edit/**` (`isolation.test.ts:43-50`). Both were added after the fence (STEP2-E3/INT and STEP2-E6), so
  the gate has been red since.
- **Fix.** Re-export `warnLevel` (and its types) from `web/lib/trip-edit/model.ts`, which exists for exactly this
  (`model.ts:1-2`), and import `PlanDraft` from there in `own.ts`. Do not widen X-S2 to `components/trips/edit/**` or `lib/export/**`.
  Then make sure the unit project runs in the gate the E-lanes report against; a red G1 should not have merged twice.

### ES-005 (medium, before account sync): the privacy page does not say what edit mode and account trips keep

- **Evidence.** edit-my-trip 7 requires the paragraph "When you are signed in, your trips, their dates and who is going (adults and
  children's ages) are kept in your account ... Only you can read them. Delete a trip or your account to remove them." It is not in
  `web/app/privacy/PrivacyBody.tsx`. The device paragraph (`PrivacyBody.tsx:26-32`) lists "trips you copy" but not the notes, the
  removed and moved stops kept per trip (`travel.trip-edit.device`), or the tab's undo history (`travel.trip-edit.undo.<id>`).
- **Fix.** Add the edit-my-trip 7 paragraph behind the same flag the routes read (`accountTripsOn`), and one sentence on the device
  keys: their names, that notes are kept with the trip in this browser, and that the undo history lasts until the tab closes. Pin
  both with a privacy-page test, as the Google and Turnstile sentences are.

### ES-006 (low, before account sync): the undo stack survives sign-out in the tab

- **Evidence.** `travel.trip-edit.undo.<id>` (`web/lib/trip-edit/keys.ts:21`, `undo.ts:36-51`) holds inverse operations. For an account
  trip these include the previous note text and the previous `travellers` (a `setParty` inverse carries the children's ages). Sign-out
  runs `clearAccountData` on `localStorage` only (`app/account/SignOutButton.tsx:35`, `sync.ts:893-895`). The next person in the same
  tab cannot open the trip, but the ages and notes stay readable in `sessionStorage` until the tab closes. edit-my-trip 4.6 says
  nothing of the account stays on the device after sign-out.
- **Fix.** At sign-out and at a user switch, also remove every `sessionStorage` key starting with `travel.trip-edit.undo.` (through
  `lib/storage/safe.ts`). Add a sign-out test that plants one.

### ES-007 (low): Share hands the person's own title to the share sheet

- **Evidence.** `OwnActions` passes `title` (the person's title, e.g. "Rockies with Emma and Leo") to `ShareButton`
  (`web/components/trips/edit/shell/OwnActions.tsx:66`; `TripShell.tsx:252`), and the native sheet sends it with the URL
  (`ShareButton.tsx:42`). edit-mode-spec 14 says "Share (copy): the public trip's URL without the person's settings". The URL is right
  (`/trips/<slug>/`, verified); the title is the person's.
- **Fix.** Pass the public trip's title (`ourTitle`) to `ShareButton` on `/t/`. Keep the person's title for the button's
  `aria-label` only.

### ES-008 (low, before account sync and STEP2-B1): a built trip uses its private id as a public slug

- **Evidence.** With no template, `slug` is null and the shell passes `slug ?? id` to `OwnActions` and `TripPlan`
  (`TripShell.tsx:252`, `255`, `269`). The export menu then reads `/api/v1/export/trip/<uuid>/` and `/api/v1/trips/<uuid>/legs/`
  (`ExportMenu.tsx:66-80`). That puts the private id in server and CDN logs, earns two 404s, and labels files `<uuid>.ics`. Share
  falls back to `location.href` (`TripShell.tsx:185`), so it copies `/t/<id>/?edit=1`; the spec says built trips share the builder's
  keys. Built trips reach `/t/` only from the account (the device side has no built drafts), so this waits for account sync and B1.
- **Fix.** On a built trip, give `OwnActions` no export target until B1 defines the built export. Hide Share (or use the builder share
  keys of trip-builder 2.5), and never fall back to `location.href`. Add a B1 acceptance line: a built trip makes no request with its
  id in the path.

### ES-009 (low): a carriage return in a title passes into the ICS

- **Evidence.** `icsText` escapes `\r?\n` but not a lone `\r` (`core/src/export/ics.ts:13`), and the trip title goes into
  `X-WR-CALNAME` (`ics.ts:98`). The document title is `name` = `z.string().min(1).max(120).regex(/\S/)`, with no control-character
  rule (`core/src/schema/plan-draft.ts:169`; the same in `copies.ts:95`), unlike notes and refs. The UI's single-line input cannot
  produce a CR, and only the person can write their own document, so this is self-injection into their own calendar.
- **Fix.** Add the `NO_CONTROL` rule (`plan-draft.ts:161`) to `name` and to the copy title, and make `icsText` replace `/\r\n|\r|\n/g`.

### ES-010 (low): GPX and KML carry the person's own title

- **Evidence.** `ownModel` sets `title: own.title` (`web/lib/export/own.ts:131`), which becomes `<name>` and the description in GPX
  and KML (`core/src/export/gpx.ts:24-34`). The probe's files name "Rockies with Emma and Leo" three times. These are the files people
  upload to Google My Maps or a GPS app and share; the ICS and print are personal by nature.
- **Fix.** Owner's call. The recommendation: the route files use "Your copy of <our title>" (the print header's lead) and keep the
  person's title in ICS and print only. Otherwise document in the privacy page that exports carry the trip's name as you wrote it.

### ES-011 (low): `/t/` privacy headers are a framework default and are not pinned

- **Evidence.** `Cache-Control: private, no-store` comes from Next's `force-dynamic` default, not from this code. There is no
  `X-Robots-Tag` and no `Referrer-Policy`, and no test asserts any of them. A move to static rendering, a CDN rule or a framework change
  would lose them silently.
- **Fix.** Add a `headers()` entry in `web/next.config.ts` for `/t/:path*`: `Cache-Control: private, no-store`,
  `X-Robots-Tag: noindex, nofollow` and `Referrer-Policy: same-origin`. Add a flag-on built test that reads them (EA13 asks for
  exactly this).

### ES-012 (low): the privacy detector misreads clock times, so the ICS is not scanned

- **Evidence.** `STREET_ADDRESS` (`core/src/privacy/detect.ts:34`) matches "19:00 Vermilion Lakes Drive" as a street address. The
  probe's ICS gets `{"why":"a household planning note"}` from a published Day 1 line. The own-trip privacy tests run `privacyHits` on
  print, CSV and JSON but not on the ICS (`web/tests/export/own-trip.test.tsx:128-131`), and their `PRIVATE` pattern tests the literal
  `HOME_POINT`, which can never appear in an export.
- **Fix.** Anchor the number: `(?<![\d:])\b\d{2,5}\s+...`. Then add the ICS to `privacyHits` in `own-trip.test.tsx` and
  `t-edit-export.spec.ts`. Replace the `HOME_POINT` literal with a `nearHome` check over every GPX and KML point.

### ES-013 (low): Report a problem would publish a private trip id

- **Evidence.** `ReportLink` prefills the feedback form with `usePathname()` (`web/components/shell/ReportLink.tsx:19-23`). On `/t/`
  that is `/t/<uuid>/`. `reportUrl` is `null` today (`web/lib/config/product.ts:10`); once it points at the public feedback repo, the
  id is published in an issue.
- **Fix.** Normalise `/t/<anything>` to `/t/` in `reportLink`, with a test.

## 4. Device storage as built (for GO-2 and P2)

| Key | Store | Holds | Lifetime | Cleared by |
|---|---|---|---|---|
| `travel.copies.local` (`copies/1`) | local | id, slug, title, start, adults, children's ages, profile (youngest), versions, places added | until removed | Remove in Mine; the merge for taken copies |
| `travel.trip-edit.device` | local | per copy: removed, moved, day ops, Maybe, added op ids, notes | until another device copy is saved after its copy is gone | nothing else (ES-001, ES-002) |
| `travel.trip-edit.undo.<id>` | session | up to 50 steps of inverse operations, with labels naming places (previous notes and travellers included) | the tab | nothing (ES-006) |
| `travel.mine.acct.<h>`, `travel.mine.outbox.<h>` | local | account documents and unsent operations | sign-out or a user switch | `clearAccountData`, `purgeOtherAccounts` |

On a shared device, signed out, anyone using the browser sees the copies (by design: "kept in this browser"). The sidecar and the
undo stack are the two places where data outlives what the person removed.

## 5. What to re-test after the fixes

1. ES-001: merge test with planted device edits, and the e2e flow signed out → edit → sign in → same document.
2. ES-002 and ES-006: storage after Remove, after Undo of Remove, and after sign-out holds no `travel.trip-edit.*` entry for the trip.
3. ES-003: `tests/analytics.test.ts` flag-on `/t/` case.
4. ES-004: `pnpm --dir web exec vitest run --project unit tests/plan/isolation.test.ts` green.
5. ES-011: header test on `/t/<uuid>/` in both flag states.
6. Re-run this note's probe (seeded copy with children, note naming them, all five exports, Share). Expect requests and addresses
   free of household data, and `privacyHits` clean on all five files including the ICS (after ES-012).

## 6. Status after the fixes (STEP2-SEC, 28 Oct 2026, Opus 5.5, branch `step2/SEC`)

| ID | Status | Where |
|---|---|---|
| ES-001 | **fixed** `37d90d6d` | `web/lib/mine/sync.ts`: each merged copy is cached as its document with `withDeviceEdits` laid over it, marked `seed`, and sent whole as a PUT at revision 0 by the next send; a list never replaces a seeded document; a conflict (the account moved past the insert) leaves the account's document as the source. A copy M3 would skip as the same trip but that holds device edits is created beside it "(from this device)" by a PUT `base: null`, or stays on the device when that is refused. The device entry is pruned once the cache holds the document and the copy left `copies/1`. Tests: `tests/mine/sync.test.ts` "the sign-in merge carries the device edits" (8 cases: survive byte for byte, sign-out leaves no note, kept across a reload when the send fails, idempotent, account newer, conflict at send, M3 kept beside, M3 refused) and e2e `mine-sync.spec.ts` (fake account) |
| ES-002 | **fixed** `37d90d6d` | `lib/mine/copies.ts`: Remove and a replace take the entry (`lib/trip-edit/deviceStore.ts`) and the tab undo stack; Undo of Remove and of a replace put the entry back; Mine's load prunes entries of copies that are gone (`pruneOrphanEdits`). Tests: `tests/mine/copies.test.ts` (3) |
| ES-003 | **fixed** `5db522d9`, one residual | `/t/` and `/mine/` in `NO_BEACON_PATHS`; `tests/beacon.test.ts` renders `Beacon` on `/t/<id>/` and `/mine/` with the token set. Residual: a beacon already loaded on a public page stays loaded after a client navigation into `/t/` or `/mine/` (React keeps an `async` script resource), and Cloudflare's SPA mode reports History API paths. Closing it needs `"spa": false` in the beacon config (fewer counted client navigations site-wide) or full page loads into `/t/` and `/mine/`: owner's call before GO-2 |
| ES-004 | **fixed** `eb03fc95` | `warnLevel` and `PlanDraft` re-exported from `web/lib/trip-edit/model.ts`; `tests/plan/isolation.test.ts` green. The unit project in check-all is not changed here |
| ES-005 | **fixed** `5db522d9` | `PrivacyBody.tsx`: the device sentence (`travel.trip-edit.device`, `travel.trip-edit.undo`) with `tripEdit` on, the edit-my-trip 7 paragraph (word for word) plus the merge and sign-out lines with `accountTrips` on; the flag-off page is unchanged. Test: `tests/shell/privacy-page.test.ts` |
| ES-006 | **fixed** `37d90d6d` | `clearAccountData` (sign-out), `purgeOtherAccounts` when another account's cache was there (user switch), the account Remove and the device Remove clear `travel.trip-edit.undo.*` through `lib/storage/safe.ts` (`removeSessionWithPrefix`). Test in `tests/mine/sync.test.ts` |
| ES-007 | **fixed** `5db522d9` | `OwnActions` gets `shareTitle` (the public title); the person's title never reaches `navigator.share`. Test: `tests/trip-edit/own-actions.test.tsx` |
| ES-008 | **fixed in part** `5db522d9`; rest **deferred to STEP2-B1** | A trip with no public slug gets no Export and no Share, and `publicUrl` never falls back to `location.href`. `TripPlan` still receives `slug ?? id` (it makes no request with it today); the built export and share keys belong to B1, whose BACKLOG row (15.374) now carries the acceptance line |
| ES-009 | **fixed** `5db522d9` | No control characters in `plan-draft/1` `title`, the `copies/1` title and the account PUT title; `icsText` turns `\r\n`, `\r` and `\n` into the escape and drops other control characters. Test: `core/test/plan/title-control.test.ts`. Generated schema and OpenAPI unchanged (`--check` clean) |
| ES-010 | **fixed** (the review's recommendation) `5db522d9` | GPX and KML of the person's trip are named "Your copy of <our title>" (`OwnTrip.routeTitle`); ICS and print keep the person's title. Tests: `tests/export/own-trip.test.tsx`, e2e `t-edit-export.spec.ts` |
| ES-011 | **fixed** `5db522d9` | `next.config.ts` `headers()` adds `X-Robots-Tag: noindex, nofollow` and `Referrer-Policy: same-origin` on `/t/:path*` with the flag on (none with it off). `Cache-Control` stays Next's `force-dynamic` answer (a value set in `headers()` is overwritten for pages), pinned by `tests/trip-edit/headers.test.ts` and e2e `t-read.spec.ts` |
| ES-012 | **fixed** `5db522d9` | `STREET_ADDRESS` ignores digits after a colon or a digit (`(?<![\d:])`), so "19:00 Vermilion Lakes Drive" passes and "12 Vermilion Lakes Drive" still fails (`core/test/privacy/detect.test.ts`). `own-trip.test.tsx` and `t-edit-export.spec.ts` scan the ICS (and GPX, KML) with `privacyHits`; the `HOME_POINT` literal is replaced by `nearHome` over every GPX and KML point |
| ES-013 | **fixed** `5db522d9` | `reportLink` sends `/t/` for any `/t/...` path. Test: `tests/shell/shell-flags.test.ts` |

Before `NEXT_PUBLIC_ACCOUNT_TRIPS=1`: ES-001, ES-005 and ES-006 are fixed; ES-008's remainder waits for B1 (built trips reach `/t/` only from the account after B1). Still to do: the ES-003 residual (owner), a run of the merge against the real account service (EM-E / STEP2-ERV), and this review's probe (section 5, item 6) re-run on the merged build.

Sources: Cloudflare Web Analytics, "Dimensions" (Path; Navigation type "Routing APIs") and "Data origin and collection",
developers.cloudflare.com/web-analytics/data-metrics/.
