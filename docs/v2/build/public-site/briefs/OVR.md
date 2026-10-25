# OVR: best-time windows, the trip overview, thumbnails (phase 1, public); customisation (phase 2, CUS); admin photos (phase 3, PHO)

Written 25 Oct 2026 by travel-planner (Opus). Spec: [features/trip-overview-and-customisation.md](../../../features/trip-overview-and-customisation.md)
(read it whole first; this brief does not repeat its rules). Rows: BACKLOG 15.51 to 15.56; PLAN R-62 to R-67.

- **Order (owner rule: one queue item at a time).** Phase 1 starts after the closure queue (REMAINING-CLOSURE-PLAN) and
  R-59 (TRIP-NAVIGATION-PLAN) merge, because R-59 owns `web/components/trips/**`. The data batches D7-R, D8-R and D5b
  (DATA brief) run in the data seat and do not wait for the code queue. Phase 2 (CUS) waits for phase 1's owner preview,
  the R-61 HTTPS preview and the owner's ruling on `planner_draft_signal` (HANDOVER item 5). Phase 3 (PHO-1) waits for the
  SRV-0 catalogue cutover and F17 roles; PHO-0 can run any time.
- **Principles:** P1 (counts, 10,000-scale lists), P2, P3, P4 (four pills, Clear all), P5 (overview and timeline linked,
  in-place expand), P6, P7 (Copy with my dates stays primary), P8 (light rows, per trip, capped), P9 (DataClient only),
  T1, T3, T4, T5.
- **Worktrees:** `git -C /Users/nks/workspace/travel worktree add /Users/nks/workspace/travel-wt/v2-<part> -b public/<part> main`,
  then `pnpm install --frozen-lockfile` at the worktree root. Ports: OVR 3490, CUS 3492, PHO 3494. Never touch 3440 or 3476.

## Parts, agents, models, effort

| Part | What | Agent | Model | Effort | After |
|---|---|---|---|---|---|
| OVR-N | Design note: When to go cards, overview tabs, scope pill, filter bar, rows with thumbnails, phone layout, amends patterns 3.4 | `travel-design-reviewer` | Opus | 3 h | R-59 merged |
| OVR-Ca | Contract: `trip-windows/1` Zod schema and validator codes; `tripItems` and `tripItemCounts` store methods, Zod row allowlist, endpoints, OpenAPI, contract cases | `travel-builder` (API lane, one author) | Opus (shared contract) | 4 h | OVR-N; D7-R landed |
| OVR-Cb | Implement OVR-Ca in `JsonStore`, `StubStore`, StaticAdapter, routes, `DataClient`; windows loader | `travel-builder` | Sonnet | 6 h | OVR-Ca |
| OVR-0 | Start-JS headroom: move `CategoryView` into a dynamic chunk; measure | `travel-builder` | Sonnet | 3 h | OVR-Cb |
| OVR-1 | When to go: window cards in the season band, `w` in the profile codec, sun window, "May be closed" chips, copy sheet week | `travel-builder` | Sonnet | 6 h | OVR-0 |
| OVR-2 | Trip overview: `view=all`, tabs, scopes, filters, rows, Bookings grouping, empty states, links to the timeline | `travel-builder` | Sonnet | 14 h | OVR-1 |
| OVR-3 | Thumbnails: `pickPhotos(ref)` in core, rows and expanded timeline entries, credits list, placeholder | `travel-builder` | Sonnet | 4 h | OVR-2; D5b partly merged |
| OVR-R | Design review of OVR-1 to OVR-3 | `travel-design-reviewer` | Opus | 3 h | each part |
| OVR-V | Independent verification | `travel-verifier` | Sonnet | 3 h | review |
| CUS-C | Migration 0011 (`planner_draft` columns), Zod `trip-custom/1`, account route contract, scheduler `removeItem` contract, RLS and isolation tests | `travel-builder` | Opus (privacy, shared contract) | 6 h | phase 1 preview; R-61 |
| CUS-1 | Customise flow, `/t/<id>/`, add, remove, move, Maybe, nearby scope actions, undo, autosave with revision | `travel-builder` | Sonnet | 20 h | CUS-C |
| CUS-2 | Real-service E2E on the Vercel HTTPS preview (sign in, customise, reload, isolation) | `travel-verifier` | Sonnet | 3 h | CUS-1; R-61 preview |
| CUS-R | Design review and privacy audit | `travel-design-reviewer` | Opus | 3 h | CUS-1 |
| PHO-0 | `photo-overrides/1` file, `gallery_pick.py --pin/--hide/--none`, precedence tests | `travel-builder` | Sonnet | 3 h | OVR-3 (`pickPhotos`) |
| PHO-1 | Admin photo console (F16), changeset write, audit, rollback | `travel-builder` | Opus contract 3 h, Sonnet build 10 h | 13 h | SRV-0 cutover; F17 roles |

Totals: phase 1 about 46 h (Opus 10, Sonnet 36); phase 2 about 32 h (Opus 9, Sonnet 23); phase 3 about 16 h. Research
batches are in the DATA brief (about 50 h, mostly Opus). Record the model in every hand-back.

## OVR (phase 1, public)

### Goal

A visitor to the Rockies trip sees 2 to 4 sourced best-time windows with plus and minus points and can plan for one; and
opens one overview of every trail, sight, activity and booking in the trip, with counts, scopes and filters, each row with
a credited thumbnail or an honest placeholder; with no login, no new start JS and no bulk data.

### Files you own

| Part | Paths |
|---|---|
| OVR-Ca, OVR-Cb | `core/src/schema/windows.ts` (new), `core/src/validate/windows.ts` (new) and its codes in `core/src/validate/codes.ts`, `core/src/schema/api/trip.ts` (append only), `core/src/catalogue/store.ts` (two methods appended), `core/src/catalogue/json/**`, `core/src/catalogue/stub/**`, `core/src/catalogue/openapi.ts`, `web/app/api/v1/trips/[slug]/items/route.ts` and `items/counts/route.ts` (new), `web/lib/client/data.ts`, `api.ts`, `static.ts`, `stub.ts` (the two methods only), `web/lib/public/windows.ts` (new loader for `data/windows/`), the check-all stage line that runs the windows validator in `tools/check-all.sh`, contract cases in `core/test/api/**` and `web/tests/api/**` |
| OVR-0 to OVR-3 | `web/components/trips/overview/**` (new), `web/components/trips/when/**` (new), `web/components/trips/SeasonBand.tsx`, `CategoryView.tsx`, `CategoryStrip.tsx`, `TripPlan.tsx` (the view switch and lazy import only), `useTripUrl.ts`, `model.ts` (summary counts), `core/src/schedule/profileCodec.ts` (the `w` key only), `core/src/media/**` (new, `pickPhotos`), `web/lib/public/photos.ts` (call `pickPhotos`), `web/styles/overview.css` (new), `web/styles/trips.css` (season band rows), `web/tests/trips/overview*.test.ts`, `web/tests/trips/windows*.test.ts`, `web/tests/e2e/trip-overview.spec.ts`, `web/tests/e2e/trip-windows.spec.ts`, `docs/v2/design/trip-page/overview-note.md` (OVR-N, reviewer) |

### Do not touch

`data/**` (research lanes own it; read only), `legacy/**` (frozen), `core/src/schedule/**` except `profileCodec.ts` (if the
sun window cannot be passed without a scheduler change, stop and ask; any change runs the scheduler bundle test),
`web/components/map/**`, `web/components/places/**`, `web/components/globe/**`, `web/lib/server/**` except the two new
routes, `web/app/account/**`, `core/src/db/**`, `web/app/themes.css` (generated; a new token goes through
`tools/theme_tokens.py` and is named in the note), `web/.env.local` and the root `.env.local` (never print them),
`HANDOVER.md`, `docs/v2/build/public-site/EXECUTION-PLAN.md`, the Obsidian notes vault.

### Steps

1. **OVR-N (Opus reviewer).** Rule the layout in `docs/v2/design/trip-page/overview-note.md`: window card anatomy and
   verdict words (no colour scale, no green), the phone snap list, tab order, the scope pill, the four filter pills and
   More filters, row anatomy with a 96 x 72 (desktop) and 64 x 64 (phone) thumbnail, the Bookings groups, the empty and
   gap states, the credits disclosure, and the amendment to patterns 3.4. Tokens only.
2. **OVR-Ca (Opus, API lane).** Write the Zod `trip-windows/1` schema and validator exactly as spec 2.2, with codes
   `E_WIN_COUNT`, `E_WIN_DEFAULT`, `E_WIN_LENGTH`, `E_WIN_SUN`, `E_WIN_SRC`, `E_WIN_DATE`, `E_WIN_LONG`, `W_WIN_CLOSE`.
   Validate `data/windows/canadian-rockies-2029.json` from D7-R (folder moved from `data/seasons/` on 25 Oct, DATA-ROADMAP DD-1; `data/seasons/` holds D6a's `trip-season-basic/1` files, which this validator must not read); fix the schema, not the data, only where the data shows
   the spec was wrong, and say so in the hand-back. Add `trip.windows` to the `getTrip` contract. Specify `tripItems(slug,
   query, page)` and `tripItemCounts(slug, query)` with the row allowlist of spec 3.5, the filters of 3.4, page size 24
   (max 50), the profile parameter, and contract cases K29 (allowlist keys), K30 (caps), K31 (one trip only), K32
   (unknowns never match a yes filter), K33 (Nearby needs a base point).
3. **OVR-Cb (Sonnet).** Implement both methods in `JsonStore` from the data the trip page already loads (legacy datasets
   through the adapter, capture records, suitability sidecars) and `near` with `r=30` per base; join by exact refs, never
   by name. Implement the routes through `respond()`, the StaticAdapter per-trip prerendered file and the `DataClient`
   methods.
4. **OVR-0 (Sonnet).** Measure trip page start JS on `main`. Move `CategoryView` and the future overview into one dynamic
   chunk loaded on the first "Trip overview" click or a direct `view=all`. Measure again. The number may not exceed the
   `main` value.
5. **OVR-1 (Sonnet).** When to go: server-render the window cards inside `SeasonBand`; "Plan for this window" is a link
   that sets `w`; add `w` to `PROFILE_KEYS` and pass the window's `sun` pair as the scheduler's sun window; add the
   "May be closed in this window" chip on day entries whose ref is in `affects`; the copy sheet opens on the matching
   week. Gap state when no file exists.
6. **OVR-2 (Sonnet).** The overview: Day by day / Trip overview switch, the tab strip with counts (reuse `CategoryStrip`),
   the scope pill, filters and URL keys of spec 3.4, rows and cards, Bookings grouping, the nearest-match empty state,
   "Day 5" links that open the timeline at the entry (P5), and `view=category` plus category fragments as aliases.
7. **OVR-3 (Sonnet).** `pickPhotos(ref)` in `core/src/media/` with the precedence of spec 4 (override, lane pick, record
   photos, none); thumbnails on rows and expanded timeline entries, lazy, fixed 4:3, 160 and 320 px; the credits
   disclosure; the placeholder.

### Acceptance checks

| # | Check |
|---|---|
| 1 | Spec acceptance A1 to A7 and A11 pass |
| 2 | `node core/bin/validate.ts` (or the new windows stage) passes on every file in `data/windows/`; a fixture with a calendar date fails with `E_WIN_DATE` |
| 3 | Contract cases K29 to K33 pass on the stub, `JsonStore` and the handler |
| 4 | Trip page start JS not above `main`; HTML at rest grows by at most 4 KB (`web/tests/budget.test.ts`, the HTML size test) |
| 5 | Rockies Trails tab, In this plan: 33 rows; Also researched: 29; numbers pinned in a test from the data, not typed in |
| 6 | Filters: Easy plus under 3 h plus fits 6 returns only answered matches, and the not-checked count is shown |
| 7 | No new hard-coded colour or host (the CONS ratchet); one map family per page still holds |
| 8 | Privacy: the API and HTML carry no household data (existing privacy tests extended to the new routes) |
| 9 | `git diff --name-only` shows only owned paths |

### Verification

`pnpm --dir web typecheck`, lint, the unit tests for your area and your own e2e specs only, then
`PATH=<venv>/bin:$PATH bash tools/check-all.sh` with `web/.env.local` moved aside (mode 600) and restored. Playwright
screenshots at 1440 x 900 and 390 x 844, light and dark, set through the site's theme control, on `GPU_ARGS`
(`--use-angle=metal` on macOS), into `web/test-results/shots/OVR/` (copy the ones for review outside `test-results`,
which Playwright wipes): When to go, the overview on Trails with one filter, Bookings, a placeholder thumbnail, the
phone filter panel. Read tall pages in tiles. Then `travel-design-reviewer`, then `travel-verifier`.

### Commit rules

One commit per part: `docs(v2): trip overview note (OVR-N)`, `core(OVR-C): trip windows and trip items contract`,
`web(public/OVR-1): when to go (R-62)`, `web(public/OVR-2): trip overview (R-63)`, `web(public/OVR-3): thumbnails (R-64)`.
Stage owned paths only with `git -C <worktree> add <paths>`, never `-A`. End each message with the Co-Authored-By
trailer. Rebase onto `main`; do not push. The coordinator merges, marks BACKLOG 15.51 to 15.53 and moves the TODO row.

## CUS (phase 2, signed in)

### Goal

A signed-in person makes a private copy of a public trip, adds and removes items (from the overview's Also researched and
Nearby scopes or the timeline), sees each day re-flow with warnings, undoes anything, and finds the copy saved; nothing of
it reaches public output.

### Files you own

`core/src/db/migrations/0011_planner_draft_doc.sql` (new), `core/src/db/tx.ts` (the draft read and write queries only),
`core/src/schema/custom.ts` (new, `trip-custom/1`), `core/src/schedule/schedule.ts` and `diff.ts` (`removeItem` only, with
the bundle test), `web/lib/server/drafts.ts`, `web/app/api/account/drafts/**`, `web/app/t/[id]/**` (new),
`web/components/trips/custom/**` (new), the edit actions in `web/components/trips/overview/**`, `web/styles/custom.css`
(new), `core/test/db/**` (new cases), `web/tests/account/**`, `web/tests/e2e/customise.spec.ts`,
`web/scripts/neon-e2e.mjs` (customise steps).

### Do not touch

`/api/v1/**` (public; a draft never appears there), `web/lib/server/same-origin.ts` (do not loosen the guard to pass a
test), `planner_draft_signal` (content-free; no content may be added), the root `.env.local` (never print, never use as
`TEST_DATABASE_URL`), `legacy/**`, `data/**`, everything phase 1 owns except the overview edit actions.

### Steps

1. **CUS-C (Opus).** Migration 0011 adds `source_trip`, `source_revision`, `doc jsonb`, `revision int` to `planner_draft`
   under the existing owner-predicate policies; run locally and on the child branch `srv-migrate-verify`, never on the
   production branch without the owner. Zod `trip-custom/1` (spec 5.6) with a 64 KB cap. Account route contract: `GET`,
   `PATCH` with `If-Match: <revision>` (409 on a stale revision), same-origin guard unchanged. Scheduler `removeItem(day,
   itemId)` contract and its diff output. Isolation and RLS cases for the new columns.
2. **CUS-1 (Sonnet).** "Customise this trip" in the plan bar (secondary to Copy with my dates); sign-in with return URL
   carrying the URL state; create the draft; `/t/<id>/` with `noindex`, `private, no-store`, no OG; add, remove, move,
   Maybe and Reset; the warnings table of spec 5.4; undo and redo (50 steps); autosave with the revision; the live signal
   re-fetch.
3. **CUS-2 (Sonnet verifier).** Extend `web/scripts/neon-e2e.mjs` and run it against the Vercel HTTPS preview: sign in,
   customise, reload, undo, a second user gets 404 on the first user's copy, no draft text in any `/api/v1` response.

### Acceptance checks

Spec A8 and A9; RLS suite green on the child branch (`core/test/db`, 0 skipped); account suites green; scheduler bundle
test green and the bundle under its limit; the privacy scan over public routes with drafts present; screenshots at 1440
and 390 in light and dark of a private copy with a warning and the undo bar.

### Verification and commits

As OVR, plus `TEST_DATABASE_URL="$(neon connection-string br-damp-breeze-b41mtvn5 --project-id damp-queen-64719841)" pnpm --dir core exec vitest run test/db`.
Commits `core(CUS-C): planner draft doc and removeItem`, `web(CUS-1): customise a trip (R-65)`. Same staging and trailer
rules; do not push.

## PHO (phase 3, admin photos)

### Goal

The owner replaces, picks, reorders or hides any record's photo, research never undoes it, and every change has an
audit record.

### Files you own

PHO-0: `tools/gallery/gallery_pick.py` (the `--pin`, `--hide`, `--none` modes), `data/capture/photo-overrides.json` (the
schema and an empty file only; entries are owner data), `core/src/media/overrides.ts` (reader), `core/test/media/**`,
`tools/tests/test_gallery_pick*.py`, `research/tools.md` (one row). PHO-1: `web/app/admin/photos/**` (new),
`web/components/admin/**` (new), the media migration (`pinned`, `pinned_by`, `reason`, `focal_x`, `focal_y`), the F16
changeset operations it uses.

### Do not touch

Research lane files (`PH.json`), `legacy/**`, the public `/api/v1` contract, `web/app/themes.css`.

### Steps

1. **PHO-0.** The overrides file and command per spec 6.2; `pickPhotos` reads it first; tests that a later lane pick
   cannot replace a pinned or hidden entry and that a non-allowlisted licence is refused.
2. **PHO-1.** After the cutover and roles: the console flow of spec 6.3, behind the admin role (RLS and op auth tests,
   F16 acceptance 5), changeset plus `op_event` audit, one-step rollback.

### Acceptance checks

Spec A10; a pinned photo survives a D5 rerun in a test; a non-admin gets 404 on `/admin/photos/`; the audit shows before,
after, actor and reason.

## Hand-back (every part)

Commits; the model used; start JS and HTML sizes before and after; contract cases added; the Rockies counts per tab and
scope; screenshots' paths; anything not verified and why.
