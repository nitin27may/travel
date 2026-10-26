# Design review: ACCT-PH, the phone bottom bar "Sign in" / "Account" item (25 Oct 2026)

Reviewer: `travel-design-reviewer`, model Opus 5.5 (`claude-opus-5-5`). Review only: no app code changed. Task ACCT-PH-RV
(MASTER-ORDER 6.2). Code on `main` at 4fe7721c (ACCT-PH merged at 7ab0657, commit 22c91873). Worktree
`/Users/nks/workspace/travel-wt/v2-ACCTRV`, branch `public/ACCT-PH-RV`. The verifier half (`verify-ACCT-PH.md`, budgets in
both builds) is a separate run.

**Verdict: approved.** No must finding, so no ACCT-PH-F follow-up is needed. The item does what it was for: a phone
visitor reaches sign-in in one tap from every page, and a signed-in visitor reaches the account in one tap. It costs no
start JS on public pages, has no layout shift and passes contrast in both themes. Every remaining point is either polish
for an interim item that NAV-1 replaces next (Q206), or something NAV-1 must know before it builds the Mine item and the
phone header icon (Q203). Counts: **0 critical, 3 important (all for NAV-1 or other owners), 4 polish.**

## 0. What this is based on

- **Code**: `git show 22c91873`: `AccountItems.tsx`, `AccountCurrent.tsx`, `BottomBar.tsx`, `AccountNav.tsx`,
  `app.css` lines 67 to 79, `app/sign-in/layout.tsx`, `app/account/layout.tsx`, `lib/config/product.ts`
  (`ACCOUNT_LINKS`), `tests/shell/shell-flags.test.ts`. Read with `AccountMenu.tsx`, `SignInLink.tsx`, `account.css`
  (avatar) and `app/account/page.tsx`.
- **Authority**: [principles.md](../foundation/principles.md) P1 to P7, T1, T2; [components.md](../foundation/components.md)
  1.1 and 1.4; [navigation-and-mine.md](../../features/navigation-and-mine.md) N3, N6, N12, section 1.1 (phone header,
  320 px fit check), 1.4 and 6; [product-direction-2026-10-18.md](../product-direction-2026-10-18.md) (public no-login
  site first, no green); [keep-from-live-site.md](../keep-from-live-site.md);
  [trip-scope-scenarios.md](../trip-scope-scenarios.md) (rule 9 and S8 thumb reach for the bar).
- **Build**: `NEXT_PUBLIC_SIGN_IN=1 pnpm exec next build` in `web/` with the home point sourced from
  `~/.config/travel-secrets/home-point.env`, then `node scripts/images.mjs`, then `next start` on a spare port. No auth
  env was present, so the session read fails closed (signed out), as on a deployment whose auth is down.
- **Renders**: Chromium from `web/node_modules` (Playwright cache), Metal GPU flags, 2x, at 320 x 844, 390 x 844 and
  1440 x 900, light and dark. Dark was set by clicking the site's own "Switch to dark theme" control. Pages: home,
  `/trips/`, `/places/lake-louise/`, `/trips/canadian-rockies-2029/`, `/sign-in/`, `/sign-up/`, `/account/`. 84 shots
  plus bar crops, a keyboard walk and a header width probe, kept in the session scratchpad
  (`scratchpad/acctrv/shots/`, `scratchpad/acctrv/metrics.json`), not committed.
- **Signed in**: no real session was created. The signed-in bar was faked by setting `html[data-signed-in]` after load,
  which is exactly what `AccountNav` does after a successful session read. This proves the bar's swap and current state;
  it does not show the header's avatar menu, which needs a real session (point I2 below is from the code and measured
  widths, not a render).

## 1. What is right

- **One tap to sign in on a phone (P4, P7).** The fifth item reads "Sign in" with the `user` icon at 320, 390 and every
  width below 640. Before ACCT-PH a phone visitor had no route to `/sign-in/` at all. Signed in, it reads "Account" and
  goes to `/account/`. The words match the desktop header ("Sign in", and "Account" in the avatar menu), so nothing needs
  explaining.
- **Bottom right, thumb reach (S8, nav spec 1.1 slot 5).** The account sits in the right thumb's easiest corner, the slot
  Mine inherits in NAV-1, so the interim teaches the right place.
- **Targets.** Measured item size 62.4 x 56 at 320 and 76.4 x 56 at 390 for all five items, over the 56 x 56 minimum in
  components 1.4. "Sign in", the longest label, fits on one line at 320 with about 13 px to spare.
- **Current state.** `aria-current="page"` and the accent icon on `/sign-in/` (and its `reset/` child) and on `/account/`,
  in both states. No other page marks it. The icon colour carries the state together with the brighter label, so it is
  not colour alone.
- **Works without JS and on poor signal (T2).** The item is a plain server-rendered `<a>`; with no JS, or if the session
  read fails, it shows "Sign in" and works. The hidden twin is `display: none`, so it is neither focusable (checked:
  `focus()` on the hidden "Account" link does nothing) nor announced.
- **No layout shift.** The bar grid is auto-flow with equal columns, so the label swap after the session read changes no
  width. CLS measured 0 on place, trip, sign-in, sign-up and account pages. The non-zero CLS on home (0.037, the globe's
  attribution control) and `/trips/` (0.006, the results section) comes from page content, not the bar.
- **No start JS on public pages.** `AccountItems` is a server component; `AccountCurrent` is mounted only by the
  sign-in and account route layouts, so its few bytes live in those chunks. The verifier records the numbers.
- **Desktop unchanged.** At 1440 the bar is hidden and the header still shows Trips · Places · Globe with search, theme
  and Sign in, in both themes.
- **Keyboard.** The bar is a `nav` named "Main, bottom"; Tab reaches Trips, Places, Globe, Search, Sign in in visual
  order after the page and footer, with the header focus ring (`--focus-in-header`, #f4f6f8).

### Contrast (measured from computed styles)

| Pair | Light (bar #172230) | Dark (bar #0b1119) |
|---|---|---|
| Label at rest `--header-mute` #b8c3cf | 8.98:1 | 10.60:1 |
| Current label `--header-ink` #f4f6f8 | 14.82:1 | 17.49:1 |
| Current icon `--accent` #d9962b (non-text, 3:1 needed) | 6.38:1 | 7.53:1 |
| Focus ring #f4f6f8 | 14.82:1 | 17.49:1 |

All pass AA (4.5:1 text, 3:1 non-text). No green anywhere; the palette is the shipped amber and slate.

## 2. Principles check

| Principle | Result |
|---|---|
| P1 scale | Not affected: the item is constant, whatever the catalogue size. |
| P2 progressive | Pass: sign-in is one step away, never pushed on the visitor. |
| P3 glance | Pass: label and icon read at a glance; current state visible. |
| P4 no manual | Pass: plain label, same words as desktop. |
| P5 smooth | Pass: no motion added; full page load to sign-in is correct for an auth page. |
| P6 metadata | Not applicable. |
| P7 the 90% | Pass: the item sits after Search, so the 90%'s first action keeps its slot; sign-in is offered, not in the way. |
| T1 when | Not applicable. |
| T2 field | Pass: no JS needed, fails closed to "Sign in". |

## 3. Findings

### Important (none block ACCT-PH; each names its owner)

**I1. The nav spec and the backlog describe a mechanism ACCT-PH did not build (docs; owner: planner, before NAV-1
starts).** Screen: none (documents). N12 says NAV-1 removes "the bar's use of `useSignedIn`", the current-state table
(navigation-and-mine.md, "what exists today") says ACCT-PH is "in progress, uncommitted" and reads the session "through
`lib/auth/header-session.ts`", the BACKLOG ACCT-PH row says the same, and section 13 (Gotchas) tells NAV-1 to "remove ACCT-PH's session read
first". None of that exists: there is no `useSignedIn` and no `header-session.ts`. The bar makes no session
read; `AccountNav` sets `document.documentElement.dataset.signedIn` and two CSS rules swap the links. Why it matters: a
builder on a 2 B start-JS budget will spend time hunting for savings that are not there, and the NAV-1 "+0 B" arithmetic
in section 6 assumes it. Fix: in `docs/v2/features/navigation-and-mine.md` (the "what exists today" row "ACCT-PH", N12, the
start-JS budget row and the first gotcha in section 13) and `docs/v2/build/public-site/BACKLOG.md` row ACCT-PH, replace the `useSignedIn` / `header-session.ts`
wording with the real list NAV-1 removes: `ACCOUNT_LINKS` in `web/lib/config/product.ts`, `web/components/shell/AccountItems.tsx`,
`web/components/shell/AccountCurrent.tsx`, `web/app/sign-in/layout.tsx`, `web/app/account/layout.tsx`, the two
`data-acct` rules in `web/app/app.css` (lines 73 and 74), and the `account` prop in `BottomBar.tsx` and `layout.tsx`. Say
that `AccountNav`'s `dataset.signedIn` write stays, because the Q203 header icon needs it (I2).

**I2. Q203 implication: signed in on a phone, the header already shows the avatar menu, and the phone header buttons are
38 px, not 44 (owner: NAV-1, `SiteHeader.tsx`, `AccountNav.tsx`, `app.css`).** Screen: phone header, every page,
signed in. `app.css` line 79 hides only `.header-signin` below 640 px; the avatar trigger (`.avatar-btn`, 44 x 44,
`account.css` 211) is not hidden, so a signed-in phone visitor today sees brand, search, theme and the avatar disc, and
loading it pulls in Base UI and the auth client on phones. Measured at 320 (signed out): brand 98 px, tools 84 px (two
38 x 38 buttons and an 8 px gap); adding the 44 px avatar gives 98 + 22 + 136 = 256 of 292, so it fits, but nobody has
seen it rendered. N6 says the phone gets an icon link (no avatar menu); the nav spec's 320 px arithmetic assumes 44 px
targets, while the shipped search and theme buttons are 38 px. Why it matters: on a phone the 44 px target is the
accessibility floor N6 sets, and an avatar menu on a phone adds start JS NAV-1 has no room for. Fix (in NAV-1, already in
its brief, add to its acceptance): below 640 px render the signed-in state as the same `user` icon link to `/account/`
(`aria-label="Account"`), not `AccountMenu`, driven by the `dataset.signedIn` attribute or the existing `user` state; make
the phone header search, theme and sign-in targets 44 x 44 (`.header-tools .btn-icon` inside the 639 px media query) and
re-run the 320 fit check with 44 px; add a signed-in phone header shot to NAV-1's shot list (needs a real local session,
`docs/v2/build/public-site/NEON-SETUP.md`).

**I3. Out of scope, found during the sweep: the home search box overflows at 320 px (owner: whoever next touches
`web/app/page.tsx` and the `.home-search` rules; new backlog row).** Screen: home, 320 px, both themes. The search button
ends at x = 338 in a 320 px viewport (`document.scrollWidth` 338), so the placeholder "Search trips, places and
countries" is cut and the page scrolls sideways by 18 px. Why it matters: search is the 90%'s first action (P7) and the
home page's main control; a sideways wobble on the smallest phones looks broken. Not caused by ACCT-PH (the bar is fixed
and 320 wide). Fix: give `.home-search` `width: 100%; max-width: 100%; min-width: 0` and `box-sizing: border-box` inside
its card, and let `.home-search-text` truncate with `overflow: hidden; text-overflow: ellipsis; white-space: nowrap`;
check at 320 that `scrollWidth` equals 320.

### Polish

**P-1. `/sign-up/` does not mark the item current (NAV-1).** Screen: `/sign-up/`, phone. "Sign in" is not current there,
though the visitor is in the same account flow; the nav spec's slot table says Mine is current on `/sign-up/**`, but the
NAV-1 acceptance line lists only `/mine/`, `/account/`, `/sign-in/`. Why it matters: a visitor who taps Create an account
loses the "you are here" cue. Fix: no ACCT-PH change (interim); add `/sign-up/` to NAV-1's acceptance in
`docs/v2/features/navigation-and-mine.md` section 11 item 1 and the BACKLOG 15.163 row, and compute Mine's current state in
`BottomBar.tsx` from the path (`/mine/`, `/account/`, `/sign-in/`, `/sign-up/`), which also lets NAV-1 delete
`AccountCurrent` and the two route layouts.

**P-2. Signed in, the label shows "Sign in" until the session read returns (interim; NAV-1 removes it).** Screen: every
page, phone, signed in. The swap happens after hydration and the auth fetch, so on a slow connection a signed-in visitor
sees "Sign in" for a moment. No shift (equal columns). Why it matters: brief mixed message, mostly on poor signal (T2).
Fix: none for ACCT-PH; Mine's constant label (N12) removes it.

**P-3. The signed-out `/account/` heading is body text (owner: account page).** Screen: `/account/` signed out, all
widths. "Account" renders at body size under the icon disc, while `/sign-in/` uses the page title style ("SIGN IN"). The
bar label and the page title do match, which is what this review checks. Fix: give the signed-out `h1` in
`web/app/account/page.tsx` the same class as the signed-in title (`account-title`) or the auth page title style used by
`/sign-in/`.

**P-4. Text zoom is untested for the bar.** Tokens set the bar label in px, so a root font-size change does not grow it
(checked at 200%); browser zoom scales the whole page and keeps the fit. "Sign in" has a space and would wrap to two lines
inside the 56 px item, as the nav spec requires, never truncate. Fix: none now; NAV-1's "Mine" is shorter.

## 4. Must list

None. ACCT-PH is approved as merged; no ACCT-PH-F task is needed. I1 and I2 go into the NAV-1 brief and the nav spec
before NAV-1 starts; I3 is a new backlog row for the home page.
