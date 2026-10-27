# Neon database, identity and live updates

> **Renamed (owner decision, 27 Oct 2026; EM-F):** migration 0009 created the drafts table as `planner_draft` and 0010 its signal
> table as `planner_draft_signal`; migration 0013 renames them, with every policy, trigger, function, index and constraint named after
> them, to `plan_draft` and `plan_draft_signal`. 0009 and 0010 are applied and checksummed, so their files keep the old name; this page
> uses the new one.

Owner decision, 24 Oct 2026: replace the planned Supabase backend with the existing
Neon project "Travel Planner", provision Postgres, Managed Better Auth and Realtime,
wire the services into this app, and migrate all application tables.

This supersedes the Supabase-specific provisioning instructions in SRV-0, not the
CatalogueStore contracts, privacy rules, source/serving split or least-privilege
requirements. Public browsing remains available without an account.

## Delivery and boundaries

1. Link the owner-specified production branch, deploy `neon.ts`, and retain all
   secrets only in ignored mode-600 environment files.
2. Create versioned SQL migrations for every application table in `schema.sql`,
   applying the schema-diff decisions instead of copying the obsolete Supabase
   auth stub. Managed `neon_auth` tables are provider-owned and never recreated.
   Use text app-user identities compatible with Managed Better Auth.
3. Test migrations on an isolated child database branch before applying reviewed,
   additive migrations to production. Record table inventory, checksums and RLS
   coverage. No drops or destructive reset.
4. Enable RLS before use on every private-content application table. The sole
   exception is the content-free `plan_draft_signal` required for Neon
   Realtime, as specified below. Private household, traveller, booking and
   saved-location tables start empty and receive no public read grant.
   Do not upload private repository documents, coordinates or wishlist provenance.
5. Add a genuine authenticated application path: sign-in/up/out and an account
   page. Save a small user-owned planner draft to Postgres and list it in a live
   subscription. Two sessions belonging to different users cannot read or change
   one another's drafts. This is service integration, not the complete planner.
6. Keep the existing public catalogue on JsonStore until a PostgresStore passes
   the full per-method contract kit; creating its tables is not claiming that
   cutover is complete. Do not load raw private files to make a demo pass.

## Shared integration contract

Application table `plan_draft`: `id uuid primary key`, `user_id text not null`,
`title text not null` (1 to 160 characters), `created_at timestamptz not null`,
`updated_at timestamptz not null`. User identity always comes from the verified
server session, never a request body. This bounded draft title proves persistence
and live updates without copying household data. The database migration lane owns
this table and policies; the app lane owns authenticated read/create/rename/delete
and sealing endpoints. Each write returns its transaction id. A stable user-id
predicate is embedded in every sealed live query because Realtime does not enforce
application RLS. Full session changes unload all prior-user client state.

Use the existing Node Next.js route handlers. Read environment at runtime, fail
explicitly when configured services fail, and keep database/realtime secrets out of
browser bundles. Pooled application traffic; direct migrations. Vercel is now
selected as the frontend host; project setup/deployment is a separate R-61 gate
after the branch is merge-ready. No photo migration or broad catalogue
implementation is included.

## UI

Keep Trailhead components, tokens and both themes. Sign-in offers email/password
and clear service errors/loading states. Account shows authenticated identity,
sign-out, a bounded draft-title form and a live draft list with loading, empty,
reconnecting and error states. Registration and sign-in do not imply access to
another user's data or public publication rights. Public navigation and pages
remain usable with Neon unconfigured, while private routes fail closed.

## Acceptance

- Root `npm run build` delegates to the workspace web build and passes.
- Complete table inventory and migration ledger match on a clean test branch and
  production; every private-content application table has RLS enabled, with
  exactly one content-free non-RLS signal relation and no app-role grants.
- Actual database writes survive reload and a new app process.
- Sign-up/sign-in/sign-out/session restoration and denied anonymous access are
  exercised against Managed Better Auth; report email verification limits honestly.
- Two browser contexts of the same user receive an actual live insert/update;
  another user's queries and writes cannot access that row.
- Build and start the application, exercise all three provisioned services through
  it, then design review and independent verification.
- Report public-catalogue cutover as deferred, not as a migrated data-serving path.

---

## Blocker resolution: live list without weakening RLS

Written 24 Oct 2026 (model: Opus). This subsection is the single, authoritative execution plan for
the one open blocker on the account live list. It does not compete with PLAN/TODO/BACKLOG; the
coordinator persists the overall rule. **The decision gate (G2) below is cleared (coordinator
exception, 24 Oct 2026); the ordered steps are being executed with full test coverage.**

### The blocker, stated precisely (verified, not assumed)

Neon Realtime (experimental, pre-GA) **rejects any subscription whose sealed query resolves to a base
table with `relrowsecurity = true`**. Reconfirmed end-to-end on the production Realtime endpoint with
synthetic, reversible objects (run `neon-realtime-view-probe-20261024-1055`, a throwaway
seal-on-server + client-subscribe harness, run then removed):

| Relation subscribed | Realtime result |
|---|---|
| Plain table, **no RLS** | `live` |
| `plan_draft`-shaped table, **RLS on** (even a permissive `using(true)` policy) | `upstream_rejected` |
| **View** over the RLS table (default **security-definer**) | `upstream_rejected` |
| **View** over the RLS table (**`security_invoker = true`**) | `upstream_rejected` |

So a view/authorized-query "escape" **does not exist**: Realtime resolves the view to its RLS base
and rejects. `plan_draft` (migration 0009) enables RLS, so its live list cannot be read by
Realtime directly. The non-Realtime paths are unaffected and stay fully RLS-enforced: the SSR read
and all writes run through `withUserTransaction` under the `NOBYPASSRLS` `travel_app` role.

### Assumptions

1. RLS on `plan_draft` (and every private source table) is **non-negotiable and stays on**. We do
   not drop RLS, do not add `BYPASSRLS`, and do not replace the owner-predicate policies with a
   write-only trigger (that would drop read-side RLS).
2. Realtime is **pinned to the production branch compute**; the child verify branch has no Realtime
   endpoint. DB mechanics (trigger, isolation, RLS retention) are verifiable on the child branch;
   the live subscription half can only be verified on production.
3. Neon Realtime's sanctioned authorization is the **sealed query predicate** (`where user_id = $1`
   from the server-verified session), not RLS. This is how `signalLiveQuery()` is scoped.
4. Applying a **non-RLS auxiliary relation** to production is a security-model deviation that needs an
   **explicit owner/coordinator sign-off** (gate G2) before it is applied anywhere that serves real
   sessions.

### Chosen resolution (the only one that keeps RLS on all private content)

**Invalidation-only stream + authenticated re-fetch.**

- `plan_draft` is **unchanged** — RLS stays on, all content stays private.
- A new migration (`0010_plan_draft_signal`) adds `plan_draft_signal (user_id text primary
  key, version bigint not null default 0, changed_at timestamptz not null default now())`. It holds
  **no draft content** — only a per-user monotonic counter. It is the *only* relation with RLS off,
  and only because Realtime requires that.
- A `SECURITY DEFINER` trigger on `plan_draft` (AFTER INSERT/UPDATE/DELETE), owned by the schema
  owner, upserts `plan_draft_signal` for the row's `user_id` and increments `version`. `travel_app`
  gets **no SELECT and no direct DML** on the signal table; only the definer trigger writes it, so the
  app role can never enumerate other users' ids.
- Realtime subscribes to a sealed `select user_id, version from plan_draft_signal where
  user_id = $1` (server-verified id; same sealing authorization as today).
- On each signal change the client calls the existing authenticated, same-origin
  `/api/account/live-query`-style endpoint to **re-fetch the drafts** through the RLS-scoped
  `withUserTransaction` read, then reconciles the list. `awaitTxId` continues to gate optimistic
  writes, keyed on the signal stream's transaction id.

What leaks vs. what stays private:

| Data | Where | Protection |
|---|---|---|
| Draft **titles / content** | `plan_draft` | **RLS on** — never leaves the RLS path; Realtime never reads it |
| `user_id` + change counter | `plan_draft_signal` | RLS off (Realtime requirement); sealed `where user_id=$1` scopes each subscriber to their own row; no `travel_app` read/DML; definer-only writes |

Rejected alternatives: drop RLS on `plan_draft` (forbidden); write-only trigger replacing RLS
(drops read-side RLS — forbidden); mirror titles into a non-RLS table (copies private content —
defeats the point); wait for Realtime RLS GA (not available now).

### Decision gates

- **G1 — evidence accepted.** The probe table above is reproduced and the view-escape is confirmed
  dead. *(Met: run `neon-realtime-view-probe-20261024-1055`.)*
- **G2 — security exception approved.** Owner/coordinator sign off that a single non-RLS,
  content-free `plan_draft_signal` relation is acceptable, with the role constraints above.
  *(Approved by the coordinator 24 Oct 2026 as a coordinator exception — see Status below.)*

### Ordered steps (execute strictly in order, only after G2; each ships its tests; stop on first red)

1. **DB — migration `0010_plan_draft_signal`.** Signal table (RLS off), definer trigger on
   `plan_draft`, grants (no `travel_app` SELECT/DML on the signal table). `core/src/db` gains a
   `signalLiveQuery()` (Realtime subscription) + `draftsReadQuery()` (RLS read) and the inventory
   lists the one intentional RLS-off relation (`RLS_EXEMPT_TABLES`) with a guard test asserting
   *exactly* one content-free non-RLS application relation.
2. **DB verification on the child branch** `br-damp-breeze-b41mtvn5`: migrate up, assert
   `plan_draft` still `rowsecurity=true`; a write as user A bumps only A's signal row; `travel_app`
   is denied SELECT on the signal table; cross-user isolation on `plan_draft` unchanged.
3. **Web server** — swap the sealed subscription from `plan_draft` to `plan_draft_signal`; add
   the authenticated re-fetch endpoint/action that reads drafts via `withUserTransaction`; keep the
   fail-closed 401 and same-origin gate.
4. **Web client** — `AccountDrafts`/`RealtimeRoot` subscribe to the signal stream, re-fetch on
   change, reconcile with the optimistic queue; preserve loading / empty / reconnecting / error
   states and `awaitTxId` behaviour.
5. **Production application** (owner-authorized, additive): apply `0010` to production over the direct
   owner connection; no drops.
6. **Full live verification** via `neon-e2e.mjs` against `next start` on production services.
7. **Screenshots** of `/account/` loaded, empty, and live-insert states at 1440×900 and 390×844,
   light and dark, 2×.

### Acceptance matrix (every changed behaviour and its failure path is tested)

| Layer | Must pass | Failure path tested |
|---|---|---|
| **Backend (core)** | `0010` applies idempotently on the child branch; `plan_draft.rowsecurity=true` after; inventory guard asserts exactly one RLS-off app relation (the signal table); trigger bumps only the acting user's signal `version`; `signalLiveQuery()`/`draftsReadQuery()` fingerprints match server + renewal | `travel_app` denied SELECT/INSERT/UPDATE/DELETE on `plan_draft_signal` (SQLSTATE 42501); user B cannot read A's signal row; forging A-owned `plan_draft` still rejected (RLS `WITH CHECK`, 42501) |
| **Backend (web)** | `tsc --noEmit` clean; re-fetch endpoint returns A's drafts via RLS read; seal uses the signal query | anonymous re-fetch → 401; cross-origin → 403; sign-out mid-stream → 401 and client unloads prior-user state |
| **UI (unit)** | `tests/account/*` green; on a signal event the list re-fetches and reconciles; optimistic add/rename/delete hold until `awaitTxId`; loading / empty / reconnecting / error render | re-fetch failure → "Live updates stopped" error block, drafts still listed from last good read; title > max rejected before submit |
| **E2E (`neon-e2e.mjs`, real services)** | same-user second context sees a live insert/rename/delete with no reload (now via signal + re-fetch); draft survives full reload; sign-in UI reaches `/account/` | anonymous `/account/` → `/sign-in/`; renewal after sign-out → 401; user B sees none of A's drafts and cannot update/delete A's row (0 rows) |
| **Regression** | `bash tools/check-all.sh` → `CHECK-ALL OK`; existing `core/test/db/{loader,inventory,runner,integration}` and `web` unit suites unchanged-green; root `npm run build` passes | no public route regresses with Neon unconfigured (private routes still fail closed) |

### Status

- G1 **met** (evidence above). G2 **approved by the coordinator** (24 Oct 2026) as a *coordinator
  exception*, not an owner authorization: a single non-RLS, content-free `plan_draft_signal`
  relation is accepted with the role constraints above; `plan_draft` and every other private/app
  table keep RLS. Implementation of the ordered steps is therefore unblocked. The non-RLS auxiliary
  signal remains a documented security-model deviation; an independent verifier and docs/spec
  alignment follow as separate tasks before this is treated as settled for production.

- **Verified end to end (24 Oct 2026).** Migration 0010 is applied to the production branch
  (`br-soft-glade-b4mkqyvd`): `plan_draft` keeps RLS, `plan_draft_signal` is RLS-off /
  content-free / no `travel_app` grant, with the same-transaction `SECURITY DEFINER` bump trigger.
  The real browser E2E (`neon-e2e.mjs`, real Neon auth + Realtime + Postgres, no mocks) passes
  **12/12**, including same-user live insert/rename/delete propagation via signal + authenticated
  re-fetch, reload persistence, renewal-401-after-sign-out, and cross-user RLS isolation. core db
  unit 22/22 and integration 7/7 (child branch `br-damp-breeze-b41mtvn5`); web account unit, boundary,
  env-table and hardcode-scan green; root `npm run build` passes. Screenshots at 1440×900 and 390×844,
  light and dark, are in `web/test-results/shots/`. Full evidence:
  `research/runs/neon-realtime-invalidation-20261024-1420.md`.

- **Two operational gotchas found during verification** (not architecture): (1) The Realtime endpoint
  enforces `neon.ts` `realtime.allowedOrigins` (`http://localhost:3000`, `http://127.0.0.1:3000`); a
  browser served on any other origin gets a **403** on the WebSocket handshake. **Run the app on port
  3000.** No secret rotation or config change is needed — production already matches policy. (2) With
  `trailingSlash: true`, client fetches to `/api/account/...` without a trailing slash get a 308
  redirect; the account client now uses trailing slashes on both fetches.

### Shell/auth bundle & OG repair (24 Oct 2026, owner plan before code)

Full `check-all` surfaced six regressions that the account/auth integration introduced **outside the
blocker**, all in the public shell/auth surface (not the signal stream). This plan fixes the root
causes without raising any budget, baseline, or exception. Acceptance = the existing public limits
stay as written and go green.

**Assumptions.** `capabilities.signIn` is `false` in public/test builds (no `NEXT_PUBLIC_SIGN_IN`), so
the account nav is never rendered there. The failing budgets encode the correct pre-account public
limits; the fix is to stop the account/auth code reaching those bundles, not to relax the numbers.

**Root causes.**
1. `SiteHeader` **statically** imports `AccountNav`, which statically imports `Menu` (Base UI popover)
   and `getAuthClient` (`@neondatabase/auth/next`). A static import bundles those modules into the
   shared client chunk even when `signIn` is off and nothing renders — inflating both the start JS
   (`budget.test`: `/trips` 319 KB > 200, place 288 KB > 180; Base UI `data-base-ui` in the `/places`
   and `/trips` start chunks) and the module/flight HTML embedded on every page (`place-size.test`:
   median/largest page over +25 %, six pages over +50 %).
2. `/sign-up` calls `notFound()` when `signIn` is off; the emitted `sign-up/index.html` is a 404 shell
   that lacks `<html lang="en">` (`og.test`), whereas `/sign-in` renders a real noindex notice.

**Ordered steps.**
1. Add `web/components/shell/SignInLink.tsx`: a tiny client component rendering only the ghost
   `Sign in` `ButtonLink` — no Base UI, no auth client — so it can be server-rendered on every page.
2. Keep `AccountNav` a static (SSR) import in `SiteHeader` so the lightweight `Sign in` link stays in
   the server HTML (accessible, no layout shift; `shell-flags.test`), but make `AccountNav` itself
   lazy for the heavy parts: it server-renders `SignInLink`, imports the auth client **dynamically**
   inside its effect, and swaps in a dynamically-imported `AccountMenu` (`web/components/shell/
   AccountMenu.tsx`, the Base UI avatar menu) only once a session is confirmed. Base UI and Better
   Auth thus never reach the initial shared bundle.
3. Lazy-load the sign-in/sign-up form: `web/components/auth/AuthFormLazy.tsx`
   (`dynamic(() => import('./AuthForm'), { ssr: false })`), used by both pages, so the Better Auth
   client leaves the `/sign-in` and `/sign-up` start bundles (they render a notice, not the form, in
   the public build).
4. Make `/sign-up` mirror `/sign-in`: render a noindex notice when `!capabilities.signIn` instead of
   `notFound()`, so the exported page carries `<html lang="en">`.
5. Harden the drafts re-fetch (review follow-up): move the response interpretation into a pure,
   node-testable `web/lib/drafts-ui.ts` (`fetchDrafts`, `applyOptimistic`, `commitAction`,
   `newestFirst`). `fetchDrafts` guards `res.json()` and the parse inside try/catch and returns a
   discriminated `ok | stale | unauthenticated | failed`. On a durable write whose re-fetch fails or
   times out, the component **folds the committed change into the base snapshot** (`commitAction`) and
   shows an explicit *saved-but-not-refreshed* notice, so a committed item is never hidden.

**Acceptance matrix.**

| Layer | Pass | Failure path |
| --- | --- | --- |
| Build/bundle | `budget.test` + `place-size.test` green at the **unchanged** 200/180 KB and +25 % limits; no `data-base-ui` in `/places` or `/trips` start chunks | n/a — budgets never raised |
| OG | `og.test` green: every exported page, incl. `sign-up/index.html`, has `<html lang="en">` and OG/canonical tags | n/a |
| UI unit (node) | `drafts-ui.test.ts`: `fetchDrafts` returns `ok` on good JSON; `failed` on non-ok, network throw, malformed JSON, bad rows; `unauthenticated` on 401; `stale` when a newer fetch superseded; `commitAction` add/rename/delete fold durable writes without dup or loss | each failure branch asserted |
| Regression | account unit (actions/title/live-query/drafts-route/neon-env), boundary, env-table, hardcode-scan, full `check-all`, root `npm run build` | surfaced immediately |
| E2E | real `neon-e2e.mjs` 12/12 unchanged (behaviour of the live path is unchanged) | re-run if the client write path is touched |

**Repair verified (24 Oct 2026).** All five steps are implemented and the full matrix is green against
a fresh public (`signIn` off) build: `budget.test`, `place-size.test`, `og.test`, `boundary.test`,
`shell-flags.test` and the new `drafts-ui.test.ts` pass (47 tests across the six suites); `budget` and
`place-size` hold the **unchanged** 200/180 KB and +25 % limits with no `data-base-ui` in the `/places`
or `/trips` start chunks. `PATH=/tmp/v/bin:$PATH bash tools/check-all.sh` → **CHECK-ALL OK** (web 1743,
core 1991). Because the client write path was touched, the real `neon-e2e.mjs` was re-run on port 3000
and passes **12/12**. Screenshots of every changed screen (sign-in, sign-up, signed-in account) at
1440×900 and 390×844, light and dark, are in `web/test-results/shots/`; the lazy auth client, dynamic
`AccountMenu` avatar and lazy `AuthForm` all render correctly and the account list stays `Live`.

### Configured-build place-size + degraded-UX coverage repair (24 Oct 2026, owner plan before code)

The independent verifier (`NEON-VERIFICATION.md`) reproduced a **blocker under the owner's exact
thresholds**: with Neon configured (`signIn` ON, the `root npm run build` output), `place-size.test`'s
median place page is `1.2505691 > 1.25` — over by **43 bytes** on `cinque-torri` (now 93 939 B, cap
93 896 B). The only configured-vs-public delta is the 67-byte server-rendered Sign-in anchor
(`<a class="btn btn-ghost header-signin" href="/sign-in/">Sign in</a>`) added to every page; the
public (`signIn` OFF) build already passes with only **24 bytes** of headroom. The verifier also noted
an honest coverage gap: the drafts *saved-but-not-refreshed* degraded UX is proven only at the
pure-function level — no rendered component test and no E2E drives a durable write then a failed
re-fetch and asserts the notice renders with the committed row still visible.

**Assumptions.** The 25 % place-size cap and all other budgets stay exactly as written — the fix
reclaims bytes, it does not relax the number. The Sign-in link's accessibility (server-rendered, works
without JS) and responsive hide (`header-signin`) must stay; auth must not be hidden. A failing budget
is a blocker, never "non-blocking".

**Root causes.**
1. Every button rendered through `Button` wraps its children in a `<span class="btn-label">` (≈31 B)
   whose only job is the loading-spinner opacity swap. For **icon-only** buttons that are not loading
   (the header Search and Theme toggles on every page, plus icon buttons sitewide) the wrapper is pure
   overhead: the icon is `aria-hidden` and the `.btn` box already centres it. That is 62 B of dead
   markup on every place page in both builds — more than the 43 B the configured median is over.
2. The degraded-write resilience lived only in `web/lib/drafts-ui.ts` pure functions; the rendered
   `AccountDrafts` notice + preserved committed row had no component or E2E proof.

**Ordered steps.**
1. `web/components/ui/Button.tsx`: when `icon` is set and the button is **not** loading, render
   `children` directly (no `btn-label` wrapper). Loading icon buttons and all text buttons keep the
   wrapper, so the spinner/label-opacity behaviour and accessible name are unchanged. This removes a
   non-semantic span from every icon button; identical render (same flex centring), so no visual change.
2. Rebuild both variants and re-measure: configured median `cinque-torri` must be ≤ 93 896 B (≤ 1.25)
   with real headroom; public median headroom widens. No budget number changes.
3. Prove the degraded-write UX **in a real browser** (the owner's "rendered/e2e", stronger than a
   jsdom unit): add a case to `web/scripts/neon-e2e.mjs` that performs a real durable create, then
   injects a transport fault (`page.route` → 500) on the **re-fetch** (`/api/account/drafts/`) only, so
   the server-action write and the signal stream stay real but the refresh fails. Assert the committed
   row stays visible **and** the explicit saved-but-not-refreshed notice renders, then confirm the row
   is actually durable in the database under RLS. (jsdom/@testing-library are not in the repo; adding
   them for one case is out of scope — the real-browser case renders the actual component and is a
   superset of what a jsdom render would assert.)
4. Re-run the DB integration suite (`core/test/db/integration.test.ts`, the 7 isolation cases) against
   the existing child verify branch URL (no secrets logged), closing the verifier's offline skip gap.

**Acceptance matrix.**

| Layer | Pass | Failure path |
| --- | --- | --- |
| Configured build | `root npm run build` then `place-size.test` green on the **signIn-ON** `web/out`: median and largest ≤ 1.25 at the unchanged cap, with headroom | median > 1.25 fails the suite (blocker) |
| Public build | `check-all` place-size/budget/og still green at unchanged limits; public median headroom ≥ before | surfaced by `check-all` |
| UI rendered (real browser) | new `neon-e2e.mjs` case: after a durable write whose re-fetch is faulted (500), the committed row is still rendered and the saved-but-not-refreshed notice shows; the row is durable in the DB | the case fails if the row vanishes or the notice is missing |
| E2E | real `neon-e2e.mjs` passes all cases incl. the injected-refetch-fault case; durable write stays real; cleanup runs | case fails if the row vanishes or the notice is missing |
| DB integration | `integration.test.ts` 7/7 against the child branch URL (no secrets printed) | surfaced immediately |
| Regression | full `check-all` OK; `budget`/`og`/`boundary`/`shell-flags` unchanged; no icon-button visual change in screenshots | surfaced immediately |

### Independent-verification follow-up: regression wording and account phone overflow

Independent verification of the final repair revision (24 Oct 2026) passed the
configured build and place-size/OG gates, both typechecks, affected DB/account
unit suites and the real Neon E2E **14/14**. It found two additional failures
before this item can close:

1. `tools/tests/test_tree_check.py::test_real_tree_passes_and_is_fast` reports
   `[rule 10] 'HANDOVER.md' names 'core/web', which does not exist`. The prose
   “core/web typechecks pass” is being parsed as a path. Rewrite it as “core
   and web typechecks pass”; do not weaken the folder-contract test.
2. The 390×844 account page overflows horizontally in empty, loaded and degraded
   states, in both themes. The account header's identity flex child cannot
   shrink around its nonwrapping email. Make the header's content column
   shrinkable and constrain the email within it without hiding the sign-out
   action or changing desktop layout.

**Ordered repair.** First make the handover wording-only correction. Then make
the smallest account CSS change that allows the identity column and email to
shrink/ellipsis while preserving the sign-out button. Add a regression assertion
for no horizontal overflow at 390px that covers the account page states; retain
the existing real-service E2E. Do not change budgets, skip folder checks, or
touch any unrelated synthetic data.

**Design-review follow-up.** The first review approves the no-overflow layout
and email ellipsis but requires a minimum 44px sign-out hit area on phone and an
interaction check that switches theme through the site's theme control (not
only by setting `data-theme` directly). Preserve the existing 38px visual
button if possible while extending its interactive area, and assert the theme
control changes the rendered theme.

**Acceptance matrix.**

| Layer | Pass | Failure path |
| --- | --- | --- |
| Folder contract | `test_real_tree_passes_and_is_fast` no longer interprets prose as a path; full check-all reaches completion | exact obsolete `core/web` path diagnostic fails |
| UI/browser | 390×844 account empty, loaded and degraded layouts have no horizontal overflow in light and dark; sign-out remains visible with at least a 44px hit area; 1440×900 layout remains intact; browser test toggles light to dark through the site control | any horizontal scroll/overflow, clipped sign-out, undersized hit area or ineffective theme toggle fails |
| Regression | targeted browser/layout assertion, relevant account suites, then full `PATH=/tmp/v/bin:$PATH bash tools/check-all.sh` pass | report first failure; do not weaken assertions |
| Service scope | previously passing Neon E2E 14/14 remains valid; no migrations or deployment | rerun E2E only if account interaction behavior changes |

After the repairs, repeat the applicable visual sweep and update
`NEON-VERIFICATION.md` with final evidence and the child-branch DB integration
blocker if its URL remains unavailable. Configured place-size headroom remains
only 19 bytes and must not regress.

## R-60 — align live backend and planner specifications

Owner-approved 24 Oct 2026; starts after the Neon implementation and independent
verification. This is a documentation-only reconciliation in the existing plan
system, not a new roadmap or permission to provision services.

### Verified baseline every edited spec must use

- Neon Postgres, Managed Better Auth and Neon Realtime are provisioned; 10
  migrations are applied. `plan_draft` and 86 other application tables, plus
  the migration ledger, retain RLS.
- `plan_draft_signal` is the sole content-free, non-RLS application relation:
  no app-role grants, definer-trigger updates, and a server-sealed per-user
  Realtime query followed by an authenticated RLS-scoped draft re-fetch. This
  remains a **coordinator-approved exception**, not explicit owner security
  policy approval.
- Implemented account scope is email/password sign-up, sign-in/out, private
  draft CRUD, persistence, live invalidation/re-fetch and cross-user isolation.
  This is not the full household/trip planner, collaboration or admin console.
- Public catalogue reads still use `JsonStore`. Catalogue loading, a
  parity-tested `PostgresStore`, and any cutover are not implemented.
- Hosting, object storage, serverless functions, jobs, presence and wider
  collaboration remain proposed or unselected. Do not infer their selection
  from the three provisioned Neon services.
- Final independent verification passes the repaired scope. Child-branch DB
  integration was blocked because `TEST_DATABASE_URL` was unavailable; do not
  describe its seven cases as independently passed.

### Ordered document changes

1. **Update controlling status first:** `docs/v2/PLAN.md`, `TODO.md` and
   `build/public-site/BACKLOG.md`. Reconcile R-58, R-60/15.49, R-7 and R-51;
   keep product requirements and evidence, and do not claim public catalogue
   parity or full planner completion. R-60 remains open until the final
   consistency check.
2. **Resolve architecture and decision language:** `04-stack.md`,
   `05-roadmap.md`, `06-questions.md`, `08-self-hosted.md`,
   `01-domain-model.md`, `03-mcp-and-research.md`, `11-quality-and-delivery.md`,
   `migration/README.md`, and `build/SERVER-SIDE-LAUNDRY-LIST.md`. Record the
   selected database/auth/realtime stack; mark self-hosting, hosting, storage,
   functions and operational plans proposed unless implemented. Keep older
   decision analysis clearly historical. Retain all product, privacy, backup,
   consent and acceptance requirements.
3. **Reconcile feature, UX and MCP contracts:** `features/README.md`, F11, F15,
   F16, F17, `smart-search.md`, `nearby-and-regions.md`, `ux/README.md`,
   `ux/tokens-and-patterns.md`, `ux/screens/S01-sign-in-and-consent.md`,
   `ux/screens/S23-settings.md`, `mcp/README.md`, `mcp/security.md`, and the
   index `docs/v2/README.md`.
   Preserve future requirements such as household authorization, guest
   planning, OAuth/MFA, sharing, presence, collaboration, admin, offline maps,
   storage, and consent, but label them unimplemented. Describe current
   Realtime only as account-draft invalidation plus authenticated re-fetch.
   Preserve `Supabase/gte-small` when it names the model, not infrastructure.
4. **Reconcile public-site store work:** the root `docs/v2/PLAN.md`,
   `build/public-site/{MASTER-PLAN.md,COVERAGE.md,STATUS.md,EXECUTION-PLAN.md,
   PHASE-B-START.md,PHASE-E-START.md,README.md,BACKLOG.md}`, and the active
   briefs `SRV.md`, `API.md`, `CONS.md`, `PLC2.md` and `TRP2.md`. Keep the root
   plan authoritative; maintain the old master/coverage lists as subordinate
   references, and label the dated STATUS snapshot as superseded by the current
   plan/handover. Retain the `JsonStore` parity gate; describe any future
   catalogue store as a proposed `PostgresStore`, with loader, per-method
   contract tests, privacy checks and rollback still ahead. Remove live
   instructions for Supabase CLI/types/configuration; do not change API
   contracts or claim account drafts serve the public catalogue.
5. **Keep historical artifacts safe:** do not rewrite archives, prior run
   evidence, dated audits/reviews or migration history. Leave
   `docs/v2/schema.sql` as explicitly non-authoritative historical material;
   its header already disclaims execution. Retain clearly future-labelled
   Supabase alternatives in `10-sharing.md`; update any active future-store
   references in `features/nearby-and-regions.md` to the proposed Neon
   `PostgresStore`.
6. **Audit the finished diff:** classify every remaining Supabase reference as
   historical, an unchanged model/vendor identifier, or a clearly labelled
   future alternative. Fix contradictory live claims and links in the existing
   docs; do not create another plan or edit code/configuration.

### Decisions that must remain distinct

| Decision | R-60 treatment |
| --- | --- |
| Q65 backend | Neon is selected for Postgres, Managed Better Auth and Realtime. Vercel is separately selected for frontend hosting (R-61); object storage and functions are not selected. |
| Q66 sign-in | Email/password is implemented. Do not silently mark magic-link, Google, passkeys, MFA or MCP OAuth complete. |
| Q67 admission | Invite-only versus open registration remains unresolved unless another explicit owner decision settles it. A working sign-up path does not imply public admission approval. |
| Q68 guest planning | Preserve the existing guest-planning decision and Q59 linkage; guest drafts, sharing and import remain unimplemented. |
| Q69 household privacy | Preserve household privacy as mandatory. Do not describe deny-by-default household tables as a completed membership-authorized planner. Keep the signal exception narrow and explicit. |

### Acceptance and verification

R-60 closes only when PLAN/TODO/BACKLOG and the active specs agree; all audited
live provider claims are corrected or explicitly retained as historical/future;
product requirements, privacy rules and acceptance criteria are preserved; and
the diff does not claim that private account integration is a planner or
catalogue migration. Validate links to changed files, search remaining
case-insensitive Supabase references in the scoped live docs and classify each,
then review changes against the Neon baseline above. Run repository
documentation checks if available; no code build or service E2E is required for
documentation-only edits. Record the DB integration blocker honestly. Do not
mark R-60 complete until this review is done.
