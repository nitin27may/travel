# Mine, the phone bar and the header: design spec (NAV-F, 26 Oct 2026)

Author: `travel-design-reviewer`, model Opus 5.5 (`claude-opus-5-5`). Task NAV-F, docs only. Branch `public/NAV-F` from
`main` at ce94e12e. This page is what NAV-1 (shell), NAV-2 (My trips) and FAV-1 (Favourites panel, hearts) build from,
and what NAV-R1 and FAV-R review against (section 12).

Authority, in order: [principles.md](../foundation/principles.md) P1 to P9, T1, T2;
[navigation-and-mine.md](../../features/navigation-and-mine.md) N1 to N12 and the owner answers Q200 to Q207 (25 Oct);
[visitor-suggestions-and-favourites.md](../../features/visitor-suggestions-and-favourites.md) sections 3, 4, 13, 14;
the ACCT-PH review (`docs/v2/design/shell/review-acct-ph-2026-10-25.md` on branch `public/ACCT-PH-RV`, not yet on
`main`) findings I1 to I3 and P-1 to P-4; [L5-copy-export-share.md](../../build/public-site/L5-copy-export-share.md) and
patterns 3.7 for the copy sheet; [product-direction-2026-10-18.md](../product-direction-2026-10-18.md) (public no-login
site first, no green, under 100 users); [keep-from-live-site.md](../keep-from-live-site.md);
[trip-scope-scenarios.md](../trip-scope-scenarios.md) (rule 9, S8 thumb reach). The foundation text is in
[components.md](../foundation/components.md) 1.1, 1.4, 2.11 and [patterns.md](../foundation/patterns.md) 1.1, 3.7 to 3.9;
this page holds the measurements, strings and checks behind it.

## 0. What this is based on (rendered, not read)

- Build: `NEXT_PUBLIC_SIGN_IN=1 next build` of `main` ce94e12e in the worktree, `next start` on a spare port. No auth
  env, so the session read fails closed (signed out).
- Renders: Chromium from the Playwright cache through `web/node_modules`, Metal GPU flags, 2x, at 320 x 844, 390 x 844
  and 1440 x 900, light and dark; dark set by clicking the header's "Switch to dark theme". Pages: home, `/trips/`,
  `/places/lake-louise-lakeshore/`, `/trips/dolomites-2027/`, `/sign-in/`, `/sign-up/`, `/account/`. Shots in
  `web/test-results/shots/navf/` (not committed).
- A mock of the proposed phone header and bar was drawn into the live page with the shipped tokens only (44 px tool
  buttons, the `user` icon link, the Mine item with its dot), signed out and signed in, at 320 and 390, light and dark,
  and measured. The numbers in section 2 come from that mock, not from arithmetic.

## 1. Decisions

| # | Decision | Why (principle) |
|---|---|---|
| D1 | **Phone header: brand, Search, Sign in or Account, Theme; every tool is a 44 x 44 visual button**, not a 38 px button with a padded hit area | With 38 px looks and 44 px hit areas, neighbouring hit areas sit 2 px apart, under the 8 px gap rule (components, shared rules). Measured fit at 320 leaves 45.6 px spare, so no shrink rule fires (2.2). ACCT-PH-RV I2 |
| D2 | **The account icon is two server-rendered links swapped by `html[data-signed-in]`**: signed out the bare `user` glyph to `/sign-in/`; signed in the same glyph inside a 30 px ring to `/account/`. No avatar menu below 640 px | Zero new start JS (the trip page has 2 B), works with no script, and the state shows by shape, not colour (P4). It is the ACCT-PH mechanism moved from the bar to the header, so the bar loses the same bytes the header gains |
| D3 | **Bar Trips · Places · Globe · Search · Mine; Mine's label and icon never change**, current on `/mine/` (`aria-current="page"`) and on `/account/`, `/sign-in/`, `/sign-up/` (`aria-current="true"`), computed from the path in `BottomBar` | One constant item needs no session read (N12); `/sign-up/` was missed (ACCT-PH-RV P-1); "page" only where the link is the page |
| D4 | **The Mine dot: 7 px `--accent` disc, 2 px `--header` ring, no count**, on phone and desktop, cleared when `/mine/` opens; the item's name gains ", new items" | Amber means "now" and stays off urgency colour (tokens 3.1, N10); a count of favourites is not urgent |
| D5 | **Desktop: Mine is a header button with icon and label at 900 px and wider, icon only from 640 to 899**, between Theme and Sign in; it mounts after hydration into a width the cluster reserves | Personal, not a catalogue tab (N5); 0 server bytes on the place page (19 B headroom) and no shift |
| D6 | **The Mine tabs use the segmented look (components 2.9) with tab semantics** (`role="tablist"`, not `radiogroup`), 44 px tall on phones, labels with counts | They switch panels and the URL (`?show=`), which is a tab's job; 2.9's 40 px is under the 44 px touch floor |
| D7 | **The account card sits under the page title on every width**, one line on desktop, two on phones | The first focusable controls in `main` are the way to keep the list (N6, P2); the long device notice goes after the list so it never pushes the list down |
| D8 | **My trips rows follow the switcher row (components 1.3), three lines, with the menu button on line 1 only**, so lines 2 and 3 run under it; dates and countdown on line 2, length and party on line 3 | Fits 320 px without truncating the date or countdown (T1); one row component for this list now and the planner's switcher later |
| D9 | **Favourites are list rows with the kind glyph, never photo cards**, at every width (two columns from 1,024 px); the heart in the row removes with Undo; cards in Trips and Places carry a decorative badge only, never a second toggle | The `favourites/1` snapshot has no photo (P8, light data); a card is one link (components 3.1), and 48 extra toggles per page are 48 extra tab stops |
| D10 | **The heart is an icon toggle with a constant name and `aria-pressed`**: "Favourite Lake Louise Lakeshore"; outline `--ink` at rest, filled `--accent-text` when pressed; after Share in the cover's action row | A toggle whose name flips and also reports pressed reads twice ("Remove from favourites, pressed"); this amends visitor spec 13. Amber is selected; coral is reserved for urgent (tokens 3) |

## 2. Phone header (below 640 px)

### 2.1 Anatomy

```
320 px, signed out                               320 px, signed in
┌──────────────────────────────────────┐          ┌──────────────────────────────────────┐
│ TRIP PLANS        [ ⌕ ][ 👤 ][ ☾ ]    │ 56 px     │ TRIP PLANS        [ ⌕ ][(👤)][ ☾ ]    │
└══════════════════════════════════════┘ 2 px amber└══════════════════════════════════════┘
 14 px margin, brand 98.4, gap, 3 x 44 + 2 x 8       the account glyph sits in a 30 px ring
```

| Part | Value | Token |
|---|---|---|
| Height | 56 px, 2 px amber rule inside the bottom | `--phone-header-h`, `--accent` |
| Background | header navy | `--header` |
| Brand | "TRIP PLANS", Big Shoulders 24, measured 98.4 px wide | `--t-card`, `--header-ink` |
| Tools | Search, account, Theme, in that order; 44 x 44 each, 8 px apart, radius 8 | `--touch-min`, `--s-2`, `--r-3` |
| Glyphs | 18 px, stroke 1.75, `currentColor` | `--header-ink` |
| Account, signed out | `user` glyph, link to `/sign-in/`, name "Sign in" | |
| Account, signed in | `user` glyph centred in a 30 px circle drawn as a 1.5 px inset ring; link to `/account/`, name "Account" | ring `--header-mute` |
| Hover | `--header-2` fill (as today's header buttons) | `--header-2` |
| Pressed | 1 px down, 120 ms | `--d-fast` |
| Focus | 2 px ring, 2 px offset | `--focus-in-header` |
| Current (the account link's own page) | glyph in `--accent`; `aria-current="page"` on `/sign-in/` (signed out) or `/account/` (signed in) only | `--accent` |
| Sign-in capability off | the account link is not rendered; Search and Theme keep their places | |

Implementation shape (for NAV-1, not a code order): the header renders both account links on the server, hidden or
shown by `html[data-signed-in]` below 640 px, as ACCT-PH does in the bar today; `AccountNav` keeps writing
`dataset.signedIn`. From 640 px up the phone links are `display: none` and the existing Sign in link or avatar menu shows.
The avatar trigger (`.avatar-btn`) is hidden below 640 px, so a phone never loads `AccountMenu` (ACCT-PH-RV I2).

### 2.2 The 320 px fit table (measured)

| Part | 320 px | 390 px |
|---|---|---|
| Viewport minus 2 x 14 px margin | 292 | 362 |
| Brand "TRIP PLANS" at `--t-card` | 98.4 | 98.4 |
| Tools: 3 x 44 + 2 x 8 | 148 | 148 |
| Gap between brand and tools (the flex gap is 12, `--s-3`; the rest is spare) | 12 | 12 |
| **Spare** | **33.6** | **103.6** |
| Tools start at x | 158 | 228 |
| Header overflow | none | none |

Rules: a fifth tool (none planned) must re-run this table. If a future brand or tool pushes the spare below 0, the brand
steps down to `--t-row` (21) first; a tool never drops under 44 px and the tools never wrap (nav spec 1.1). Browser zoom
scales the whole header and keeps the fit; text-only zoom does not grow the header because the brand and glyphs are set
in px (ACCT-PH-RV P-4).

### 2.3 Contrast, phone header (both themes measured from `web/app/themes.css`)

| Pair | Light (`--header` #172230) | Dark (`--header` #0B1119) | Need |
|---|---|---|---|
| Glyph `--header-ink` #F4F6F8 | 14.82 | 17.49 | 3:1 non-text |
| Signed-in ring `--header-mute` #B8C3CF | 8.98 | 10.60 | 3:1 non-text |
| Current glyph `--accent` #D9962B | 6.38 | 7.53 | 3:1 |
| Glyph on hover fill `--header-2` (#1F2D3D / #16202C) | 12.91 | 15.18 | 3:1 |
| Focus ring `--header-ink` | 14.82 | 17.49 | 3:1 |

`--header-line` (1.77 / 2.09 on `--header`) is too faint to carry the signed-in ring; it is not used for it.

## 3. Phone bottom bar

### 3.1 Anatomy

| Part | Value | Token |
|---|---|---|
| Height | 84 px including the 26 px home-indicator inset; padding 8 px top, 4 px sides | `--phone-bottombar-h`, `--s-2`, `--s-1` |
| Grid | auto-flow columns, equal widths (ACCT-PH's grid, kept) | |
| Items | Trips (`cards`), Places (`pin`), Globe (`globe`), Search (`search`, a button), Mine (`layers`) | |
| Item size | 62.4 x 56 at 320, 76.4 x 56 at 390 (measured, all five equal); minimum 56 x 56 | `--touch-min` is exceeded |
| Icon | 22 px | |
| Label | mono 11.5, one line; at 200% zoom may wrap to two lines inside the item, never truncates | `--t-chip` |
| Rest | label and icon `--header-mute` | |
| Current | label `--header-ink`, icon `--accent` | |
| Background, top line | `--header`, 1 px `--header-line` | |
| Hides | while a bottom sheet is above half height and while the keyboard is open (components 1.4) | |

Mine is current by path, computed in `BottomBar`: `/mine/**` gives `aria-current="page"`; `/account/**`,
`/sign-in/**` and `/sign-up/**` give `aria-current="true"` with the same look. NAV-1 deletes `AccountItems`,
`AccountCurrent`, the two route layouts that mount it, `ACCOUNT_LINKS` and the `data-acct` rules (ACCT-PH-RV I1).

### 3.2 The dot

| Property | Value |
|---|---|
| Size and colour | 7 px disc `--accent` with a 2 px `--header` ring (11 px overall) |
| Position | top -2 px, right -4 px of the 22 px icon box (phone); of the 18 px icon on desktop |
| Set | when a copy or a favourite is added on this device after `travel.mine.seen` |
| Cleared | when `/mine/` renders (writes `travel.mine.seen`); another tab clears through the `storage` event |
| Name | the item reads "Mine, new items" (visually hidden ", new items" inside the link); the dot is `aria-hidden` |
| Motion | appears with a 200 ms scale from 0 to 1, `--e-out`; reduced motion: appears without animation |
| Never | a number, a pulse, or a colour other than `--accent` |
| Budget | one `localStorage` read in the bar's existing effect; if NAV-1 measures a net cost above 0 B on the trip page, the dot is dropped (nav spec 6) |

Contrast: `--accent` dot on `--header` 6.38 / 7.53 (3:1 needed). The ring separates the dot from the glyph; it is the
same colour as the bar, so it never reads as a second shape.

### 3.3 Contrast, bar (measured)

| Pair | Light | Dark |
|---|---|---|
| Label at rest `--header-mute` on `--header` | 8.98 | 10.60 |
| Current label `--header-ink` on `--header` | 14.82 | 17.49 |
| Current icon and dot `--accent` on `--header` | 6.38 | 7.53 |
| Focus ring `--header-ink` on `--header` | 14.82 | 17.49 |

## 4. Desktop and tablet header (640 px and wider)

```
1440: TRIP PLANS  Trips  Places  Globe                         [⌕] [☾] [▤ Mine•] [Sign in]
 900+ : Mine shows icon and label;  640 to 899: [⌕] [☾] [▤•] [Sign in]
signed in:                                                      [⌕] [☾] [▤ Mine] (N)  avatar menu: Account · Sign out
```

| Part | Value |
|---|---|
| Cluster order | Search, Theme, Mine, Sign in or the avatar (N5) |
| Mine, 900 px and wider | ghost header button, 38 px tall, `layers` 18 px plus "Mine" in `--t-mono`, 8 px icon-label gap, `--header-ink` |
| Mine, 640 to 899 px | icon only, 38 x 38 visual with the 44 px padded hit area (desktop pointer), `aria-label="Mine"` |
| Current on `/mine/**` | `aria-current="page"`; icon `--accent`, label weight 600 (the bar's rule) |
| Dot | as 3.2 on the 18 px icon |
| Mount | after hydration; `.header-tools` reserves the link's width at each breakpoint in CSS, so CLS stays 0 |
| Avatar menu | Account and Sign out only (Mine is visible, so not repeated) |

Measured with a placeholder of Mine's width in the live header (signed out, Sign in 85 px wide):

| Width | Tabs end at x | Cluster starts at x | Cluster width | Gap |
|---|---|---|---|---|
| 640 (Mine icon only, 38) | 362 | 385 | 223 | 23 |
| 899 (icon only) | 362 | 644 | 223 | 282 |
| 900 (icon and label, 88) | 362 | 595 | 273 | 233 |

At 640 the gap is 23 px, enough but tight: no further item may join the cluster below 900 px without moving Mine's label
breakpoint or re-measuring. Signed in, the 44 px avatar replaces the 85 px Sign in and the gap grows to 64 px.

## 5. The Mine page (`/mine/`)

### 5.1 Layout

```
390 px, signed out, 2 copies, 5 favourites                1440 px (content column 1,376 max)
┌──────────────────────────────────────────┐            MINE
│ MINE                                     │ page head  ┌───────────────────────────────────────────────┐
│ ┌──────────────────────────────────────┐ │            │ Kept in this browser only.  [Sign in] Create… │ 56
│ │ Kept in this browser only.           │ │ card       └───────────────────────────────────────────────┘
│ │ [Sign in]  Create an account          │ │ 2 lines   [ My trips 2 | Favourites 5 ]   (auto width)
│ └──────────────────────────────────────┘ │            UPCOMING · 2      rows in two columns from 1,024
│ [  My trips 2     |   Favourites 5   ]   │ 44 px tabs
│ UPCOMING                              2  │ group head
│ ▭ Dolomites                         [⋯]  │ row, 3 lines
│   Sat 3 Jul 2027 · in 251 days           │
│   14 days · 2 adults, 1 child            │
│ ...                                      │
│ ⓘ Your trips and favourites are kept ... │ notice after the list
│   [Sign in] [Got it]                     │
└──────────────────────────────────────────┘
```

| Part | Value |
|---|---|
| Page head | the list pages' `.page-head`: "MINE" in `--t-page` (phone variant as `/trips/`, 44 px measured at 320 and 390); no lede on phone |
| Account card | `--surface`, 1 px `--line`, radius 12 (`--r-4`), padding 12 16, 16 px under the head; text serif 15.5 (the banner text size, components 5.4) `--ink`; buttons: **Sign in** secondary 38 px (hit 44), **Create an account** ghost link, `--s-2` apart. Phone: text on line 1, buttons on line 2. 640 px and wider: one line, buttons right |
| Tabs | 24 px under the card; segmented look of 2.9 (`--line-2` frame, radius 8, selected `--accent` fill with `--accent-ink` 600); phone: full width, two equal segments, 44 px; 640 px and wider: auto width, 40 px with the padded 44 px hit area. Label "My trips" plus the count in mono 11.5 after it ("My trips 2") |
| Panel | 24 px under the tabs; group heads in `--t-cap` `--muted` with the count right in mono 12.5; 8 px under a head to the first row |
| Notice | after the panel, 32 px gap, components 5.4 notice (`--info-soft`, info icon 16, serif 15.5 `--ink`), buttons **Sign in** (secondary sm) and **Got it** (ghost sm); shown signed out only, until snoozed |
| Footer | the site footer as on every page; the bottom bar on phones |

Signed in: the card reads "Signed in as a@b.com" with **Account** (secondary); before CUS-C a second line in `--muted`
says "Copies on this device move to your account when the planner opens." No notice.

Sign-in capability off: the card reads "Kept in this browser only." with no buttons, and the notice has **Got it** only.

Default tab: the one with the newest item (last copy or last heart); with nothing on either, My trips. `?show=trips` or
`?show=favourites` selects a tab, written with `replaceState`; toasts that point to Mine link to the right tab.

### 5.2 My trips rows

Anatomy (components 1.3 switcher row, widened):

| Part | Value |
|---|---|
| Row | min 76 px, padding 12 0, 1 px `--line` between rows, no card border; whole row is the Open link except the menu button |
| Photo | 52 x 38, radius 6; signed out a 1 px `--line-2` keyline; signed in the identity ring (2 px `--surface`, 2.5 px identity colour, 1 px `--line-2`). Missing photo: the `route` glyph 22 px `--ink` on `--well` |
| Line 1 | name in `--t-row` (Big Shoulders 21), one line, truncates; menu button at the right, 44 x 44, `⋯` glyph 18 px, ghost |
| Line 2 | mono 12.5 `--muted`: start date and countdown, "Sat 3 Jul 2027 · in 251 days"; during the trip "Day 4 of 14 · now"; the countdown is neutral (no urgency colour; tokens 3.1 applies only to due dates and windows) |
| Line 3 | mono 12.5 `--muted`: length and party, "14 days · 2 adults, 1 child", then " · from Toronto" when an origin is set (nav spec amendment) |
| Lines 2 and 3 | start under the name and run under the menu column (the menu sits on line 1 only), one line each, truncate with an ellipsis; the full text is in the row's name |
| Signed in | a neutral chip after line 3 when the list mixes both: "On this device" or "In your account" (components 2.8 neutral). Signed out, every copy is on this device and no chip is drawn |
| Hover | `--surface-2` |
| Focus | ring inside the row |

Width check at 320 (mono 12.5 advances 7.5 px a character): text column 292 - 52 - 12 = 228 px holds 30 characters.
"Sat 3 Jul 2027 · in 251 days" is 28 and "14 days · 2 adults, 1 child" is 27, so both fit at 320 with no ellipsis;
only an origin suffix truncates, which is the least important part.

Groups: **Upcoming** (start in the future, soonest first), **No date** (signed-in plans without dates), **Past** (a
44 px disclosure "Past (3)", closed by default). At most 20 device copies and 50 account drafts: no pager (P1: groups and
counts carry the scale).

Row menu (components 5.2, labelled "Actions for Dolomites"), items in this order:

| Item | Does | Feedback |
|---|---|---|
| Open | (also the row link) signed out: `/trips/<slug>/` with the copy's profile from the profile codec; signed in with a customised copy: `/t/<id>/` | page change |
| Add to calendar | downloads the ICS from the copy's dates (L5 ICS, the copy's start) | toast "Downloaded dolomites-2027.ics · 14 events" |
| Print | opens Open's URL and starts the print dialog once the page has loaded, through a one-shot `sessionStorage` key (`travel.mine.print`), no URL key; the printout is the public page's print view with the copy's profile (Day 1 to N, N8) | the browser's print dialog |
| Change dates | reopens the copy sheet with the copy's date and travellers; saving keeps the id and replaces the row in place | toast "Dolomites now starts Sat 10 Jul 2027" with **Undo** |
| (divider) | | |
| Remove | `--crit` text, last (components 5.2); no confirm (patterns 4.4: reversible) | the row collapses 200 ms; toast "Removed Dolomites from Mine" with **Undo** (6 s); Undo puts it back at the same position |

A copy whose trip is no longer listed: the photo becomes the `warn` glyph on `--well`, the name stays (snapshot), line 2
is the gap chip "No longer listed" (dashed `--line-2`, `--muted`), the row is not a link, and the menu button is
replaced by a **Remove** secondary sm button (hit 44). It is never removed silently.

### 5.3 Favourites panel

| Part | Value |
|---|---|
| Filter row | a segmented control (2.9 look, radiogroup) "All 7 · Places 5 · Trips 2", 34 px on desktop with the 44 px hit, full width 44 px on phone; then Kind and Country pills (2.7) and Sort (Newest, Name) on desktop; on phone those three sit behind "Filters (n)" in a bottom sheet |
| Row | components 3.2 list row: 56 px, kind glyph 26 px on a 40 px `--well` disc (trips use `route`), title serif 17/600 (`--t-title`), meta mono 12.5 `--muted` ("Lake · Canada", "Trip · 14 days · Italy"), the heart button at the right, 44 x 44, pressed |
| Columns | one column below 1,024 px, two from 1,024 |
| Pages | 48 rows a page with the pager (8.5) and `?page=`; never infinite scroll |
| Remove | tap the heart: the row collapses 200 ms; toast "Removed Moraine Lake from favourites" with **Undo** |
| No longer listed | glyph `warn`, the name kept, meta replaced by the gap chip "No longer listed", the heart replaced by **Remove** (secondary sm); the row is not a link |
| Error | inline error (6.3): "We couldn't refresh your favourites. Showing the list on this device." **Try again** |

### 5.4 Empty states (components 6.1)

| Case | Glyph | Title | Line | Primary | Secondary |
|---|---|---|---|---|---|
| My trips, empty | `layers` | No trips copied yet | Open a trip and choose Copy to my trips. It stays here with your dates. | **Browse trips** | none |
| Favourites, empty | heart (lazy chunk) | No favourites yet | Tap the heart on a place or a trip to keep it here. | **Browse places** | Browse trips |
| Storage blocked | `warn` | This browser is not keeping data | Copies and favourites last until you close this tab. Sign in to keep them. | **Sign in** (signed-in capability on; else none) | none |
| Account list failed | `warn` | We couldn't load your trips. | Showing what this device holds. | **Try again** | none |

Each empty state: 32 px glyph on a `--well` disc, serif 17/600 title, serif 15.5 line, centred, 48 px padding. The
account card stays above an empty state: a visitor with nothing yet still learns where things will be kept.

### 5.5 Contrast, Mine page (measured from `themes.css`)

| Pair | Light | Dark | Need |
|---|---|---|---|
| Body and names `--ink` on `--bg` | 14.85 | 15.28 | 4.5 |
| `--ink` on `--surface` (card, rows on cards) | 16.06 | 13.83 | 4.5 |
| Meta `--muted` on `--bg` | 6.42 | 8.23 | 4.5 |
| Meta `--muted` on `--surface` | 6.94 | 7.45 | 4.5 |
| Selected tab `--accent-ink` on `--accent` | 6.96 | 6.96 | 4.5 |
| Tab at rest `--ink-2` on `--surface` | 12.09 | 10.76 | 4.5 |
| Segment frame `--line-2` on `--surface` | 3.67 | 3.42 | 3 |
| Notice text `--ink` on `--info-soft` | 13.24 | 12.74 | 4.5 |
| Notice icon `--info` on `--info-soft` | 5.91 | 7.61 | 3 |
| Gap chip `--muted` on `--bg` | 6.42 | 8.23 | 4.5 |
| Gap chip dashed border `--line-2` on `--bg` | 3.39 | 3.78 | 3 |
| Kind glyph `--ink` on `--well` | 13.92 | 15.94 | 3 |
| Remove item `--crit` on `--surface` (menu) | 6.61 | 7.01 | 4.5 |
| Toast `--toast-ink` on `--toast-bg` | 14.85 | 15.28 | 4.5 |

## 6. The heart (FAV-1)

| Property | Value |
|---|---|
| Where, place page | the cover's action row, after Share: Save to a trip (primary) · Export · Share · heart. At 390 the row wraps after Export (measured), so the heart sits beside Share on the second line |
| Where, trip page | the cover's action row, after Share: Copy to my trips (primary) · Export trip · Share · heart |
| Where, Mine | the Favourites row's right slot (pressed) |
| Never | on cards as a control (cards carry a decorative badge), in the header, before the primary action (P7) |
| Size | icon button: 38 x 38 visual with the padded 44 px hit area at 640 px and wider; 44 x 44 visual below 640 (as the header tools, D1) |
| Look | secondary button: `--surface` fill (as the cover's Export and Share), 1 px `--line-2`, radius 8; glyph 18 px |
| Glyph | heart path `M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z`, stroke 1.75, in the lazy chunk, never in `Icon.tsx` |
| Rest | outline glyph `--ink` |
| Pressed (a favourite) | glyph filled and stroked `--accent-text`; `aria-pressed="true"` |
| Hover | border `--ink`, `--surface-2` at 60% (2.1) |
| Focus | page focus ring |
| Disabled | never; with storage blocked it still works for the tab (session list) |
| Name | constant: "Favourite Lake Louise Lakeshore" (place or trip name); `title` "Favourite"; state from `aria-pressed` |
| Mount | after hydration (0 server bytes on the place page; the trip page pays only the import stub), so the row has no heart in the server HTML and gains it without shifting anything before it |
| Motion | fill 120 ms plus a scale 1 to 1.15 to 1 over 200 ms `--e-out`; reduced motion: the fill changes with no scale |

Contrast on the button's `--surface` fill: rest glyph `--ink` 16.06 / 13.83; pressed `--accent-text` 6.33 / 7.99
(3:1 non-text needed); button border `--line-2` 3.67 / 3.42. On the trip cover the button keeps its `--surface` fill, so
the photo never sits behind the glyph. Pressed is told apart by shape (filled versus outline) and by `aria-pressed`,
never by colour alone.

Card badge (Places, Trips, home strips): an 18 px filled heart in `--accent-text` on a 26 px `--surface` disc with a 1 px
`--line-2` keyline, at the photo's top right, 8 px in; `aria-hidden`; the card's name gains ", in your favourites".
Added after first paint from the local set.

## 7. Toasts and notes (components 5.3)

All sit above the bottom bar on phones, polite live region, Undo reachable by Tab before the toast leaves.

| When | Text | Actions | Time |
|---|---|---|---|
| First favourite on this device, sign-in on | "Added to favourites on this device. Sign in to keep them on every device." | **Undo** · **Sign in** | 8 s, once per device |
| First favourite, sign-in off | "Added to favourites. They are kept in this browser." | **Undo** | 6 s |
| Later favourites | "Added Moraine Lake to favourites" | **Undo** | 6 s |
| Un-favourite | "Removed Moraine Lake from favourites" | **Undo** | 6 s |
| Copy made | "Copied Dolomites to Mine · 14 days from Sat 3 Jul" | **Undo** | 6 s |
| Copy removed | "Removed Dolomites from Mine" | **Undo** | 6 s |
| Dates changed | "Dolomites now starts Sat 10 Jul 2027" | **Undo** | 6 s |
| Merge | "2 trip copies and 12 favourites added to your account." | none | 4 s |
| Sign out | "Signed out. Your trips and favourites are in your account." | none | 4 s |

Strings that are not toasts:

| Where | Text |
|---|---|
| Bar label, header link, page title | Mine |
| Header account link names | Sign in · Account |
| Account card, signed out | "Kept in this browser only." **Sign in** · **Create an account** |
| Account card, signed in | "Signed in as a@b.com" **Account** |
| Account card, before CUS-C | "Copies on this device move to your account when the planner opens." |
| Device notice | "Your trips and favourites are kept in this browser only. Clearing browser data, using a private window or switching devices loses them, and some browsers clear site data after a few weeks without a visit. Sign in to keep them in your account." **Sign in** · **Got it** (snoozes for 30 days or until 10 more items, copies and favourites together) |
| Replace prompt | "You already have a copy from Sat 3 Jul 2027. Copy again to replace it." **Replace** · Cancel |
| Cap, copies | "You have 20 trip copies on this device, the most we keep. Remove one to copy another." |
| Cap, favourites | "You have 500 favourites, the most we keep. Remove one to add another." |
| Session only | "This browser is not keeping data, so this copy lasts until you close this tab. The calendar file keeps your dates." |
| Copy sheet footer, signed out | "Kept in this browser. Sign in to keep it on every device." |
| Copy sheet done step | **Open in Mine** (primary), the export list, Done |

Never "saved" for copies or favourites (visitor spec 3). No emojis, no exclamation marks.

## 8. Keyboard

| Where | Keys |
|---|---|
| Header, phone | Tab order: skip link, brand, Search, account, Theme, then `main` |
| Header, desktop | brand, tabs, Search, Theme, Mine, Sign in or avatar |
| Bar | after `main` and the footer: Trips, Places, Globe, Search, Mine |
| Mine tabs | Tab enters the selected tab; Left and Right move and select (automatic activation, the panels are local); Home and End jump; Tab leaves to the panel's first control |
| My trips row | Tab to the row link (Enter opens), Tab to its menu button (Enter or Space opens the menu; arrows, Home, End, type-ahead, Esc returns focus to the button) |
| After Remove | focus moves to the next row's link, or to the previous one when it was last, or to the empty state's primary; the toast's Undo is reachable by Tab and returns the row and focus |
| Favourites row | row link, then the heart |
| Heart | Space or Enter toggles |
| Notice | Sign in, Got it; after Got it focus goes to the tabs |

## 9. Screen reader

| Element | Role and name |
|---|---|
| Bar | `nav` "Main, bottom"; Mine "Mine" or "Mine, new items"; current item announced as "current page" or "current" |
| Header account | link "Sign in" or "Account" |
| Mine page | `h1` "Mine"; account card is a `section` labelled "Your account"; tablist labelled "Mine"; tabs "My trips, 2" and "Favourites, 5"; each panel a `tabpanel` labelled by its tab |
| Group heads | `h2` "Upcoming, 2 trips" |
| Trip row link | "Dolomites, from Sat 3 Jul 2027, in 251 days, 14 days, 2 adults, 1 child" (plus ", on this device" when the chip shows) |
| Row menu button | "Actions for Dolomites", `aria-haspopup="menu"`, `aria-expanded` |
| No longer listed | the row reads "Dolomites, no longer listed"; the button "Remove Dolomites" |
| Heart | "Favourite Lake Louise Lakeshore, toggle button, pressed / not pressed" |
| Toasts | polite live region; the action names are the visible words |
| Dot, glyphs, card badge | `aria-hidden` |

## 10. Motion (tokens 11, patterns 6)

| Moment | Motion | Reduced motion |
|---|---|---|
| Tab change | the selected fill slides 200 ms `--e-std`; the panel cross-fades 120 ms | no slide; panel swaps |
| Row removed | height collapse 200 ms `--e-std` | row disappears |
| Undo | the row expands back 200 ms | appears |
| Dot appears | scale 0 to 1, 200 ms `--e-out` | appears |
| Heart toggled | fill 120 ms, scale 1 to 1.15 to 1 over 200 ms `--e-out` | fill only |
| Toast | rise 200 ms, fade 160 ms | 120 ms fade |
| Past disclosure | height 200 ms | instant |
| Theme switch | 200 ms cross-fade (unchanged) | |

Nothing animates on first paint, and nothing in the header or bar moves when the session read returns.

## 11. Findings carried into the build (from this NAV-F render sweep and ACCT-PH-RV)

Ranked as the reviewer's rules require. None blocks NAV-F; each names an owner.

**Important**

1. **Home search still overflows at 320 px (ACCT-PH-RV I3, still open on ce94e12e).** Screen: home, 320, both themes;
   `scrollWidth` 338. The button `.home-search` ends at x 338. Why: search is the 90%'s first action (P7) and the page
   wobbles sideways on small phones. Fix: `.home-search { width: 100%; max-width: 100%; min-width: 0; }` inside its card,
   `.home-search-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }`; check
   `scrollWidth` is 320. Owner: a small home row (BACKLOG), or NAV-1 if the coordinator adds the `.home-search` rules to
   its files.
2. **Place pages overflow at 320 px (new).** Screen: `/places/lake-louise-lakeshore/`, 320; `scrollWidth` 330. "The
   route" section (`.ph`, `.pl-conflict`, `.pl-profile` and its SVG) is 299 px wide from x 31, 10 px past the viewport.
   Why: a family on the trail checks the profile on the smallest phones (T2); sideways scroll hides the right edge of
   the chart. Fix: give the route section's grid column `min-width: 0` and the profile SVG `width: 100%; height: auto`
   (no fixed `width` attribute), then check `scrollWidth` equals 320 on a trail page with and without a stored line.
   Owner: the place page lane.
3. **The phone header buttons are 38 px with padded hit areas 2 px apart (ACCT-PH-RV I2).** Fixed by D1 in NAV-1.

**Polish**

4. **`/account/` signed out still titles the page in body text (ACCT-PH-RV P-3).** Measured: `h1` is Source Serif 16 px,
   while `/sign-in/` uses Big Shoulders 32. Fix: the signed-out `h1` takes the auth title class used by `/sign-in/`.
   Owner: the account page (NAV-3 touches `web/app/account/page.tsx`).
5. **`/sign-up/` does not mark the account item current (ACCT-PH-RV P-1).** Fixed by D3.
6. **The specimen drew `--ok` green** (`#1D6B3A` light, `#8FD0A0` dark), against tokens.json (`#1F4E8C`, `#8DB6EE`) and
   the owner's no-green rule. Fixed in this task in `specimen.html`; changes-from-preview row 3 corrected.

## 12. Acceptance checks for NAV-R1 and FAV-R

Render at 2x, 320 x 640, 390 x 844 and 1440 x 900, light and dark (dark through the header toggle), signed out and with a
real local session (NEON-SETUP), and check:

1. Phone header at 320, 390 and 639: brand, Search, account, Theme on one row; each tool 44 x 44; 8 px between them;
   `scrollWidth` equals the viewport; spare at 320 at least 30 px.
2. The account link goes to `/sign-in/` signed out and `/account/` signed in; signed in shows the ring; no avatar menu
   below 640 px and no `AccountMenu` chunk requested on a phone.
3. Bar: five items, each at least 56 x 56 at 320 (expected 62.4 x 56); Mine current on `/mine/`, `/account/`,
   `/sign-in/`, `/sign-up/` and nowhere else; `aria-current="page"` only on `/mine/`.
4. The dot appears after a heart or a copy, clears on `/mine/`, clears in a second tab, reads "Mine, new items", shows no
   number; the trip page start JS is at or under the ACCT-PH baseline.
5. Desktop: Mine with label at 900 and 1440, icon only at 640 and 899; CLS 0 when it mounts; the avatar menu holds only
   Account and Sign out.
6. Mine: card under the title; tabs with counts, 44 px on phones; arrow keys switch tabs and `?show=` follows; the
   default tab is the newest activity.
7. A My trips row at 320 shows date and countdown and length and party without an ellipsis for "Sat 3 Jul 2027 · in
   251 days" and "14 days · 2 adults, 1 child"; the menu has Open, Add to calendar, Print, Change dates, Remove; Remove
   collapses the row and Undo restores it at the same place with focus.
8. Favourites rows show the kind glyph, never a photo; a withdrawn item shows "No longer listed" and Remove.
9. Heart on a place and a trip page: after Share, 44 px on phones, outline at rest, filled `--accent-text` when
   pressed, constant name with `aria-pressed`; the first-save toast appears once per device with Undo and Sign in.
10. Every pair in sections 2.3, 3.3, 5.5 and 6 measures at or above the ratio given; no colour literal in the CSS; no
    green or purple anywhere.
11. Keyboard walk of section 8 and a screen-reader pass of section 9 (VoiceOver on Safari for the phone header, bar
    and tabs).
12. Reduced motion: nothing in section 10 scales or slides.

## Amends

| What | Where | Now |
|---|---|---|
| Heart name flips between "Add ... to favourites" and "Remove ... from favourites" with `aria-pressed` | visitor spec 13 | constant name "Favourite <name>" with `aria-pressed` (D10) |
| "44 px hit target, 32 px visual on cards" for the heart | visitor spec 13 | no toggle on cards; a decorative 18 px badge (D9, section 6) |
| Mine tabs as `role="tablist"` while components 2.9 is a radiogroup | nav spec 8 and components 2.9 | tab semantics with the 2.9 look, recorded in components 2.9 (D6) |
| Mine current on `/mine/`, `/account/`, `/sign-in/` | nav spec 11 item 1 | adds `/sign-up/`; `aria-current="true"` off `/mine/` (D3) |
| The phone header's 44 px arithmetic assumed while buttons were 38 px | nav spec 1.1 | measured, and the phone tools become 44 px visual (D1, 2.2) |
| Copy made: a toast with **Undo** while the sheet shows its done step | section 7, copy sheet done step | no toast while the sheet is open; the done step's footer holds **Done** and **Undo** (ghost). The modal sheet traps focus, so a toast's Undo is out of reach (NAV-R2 should 2) |
| Print reader unspecified | 5.2 Print | `ExportMenu` (the owner of the trip's print model) reads and removes `travel.mine.print` when it equals its slug, waits for the export data and the timeline, and prints through the same path as Export > PDF; never a hidden frame or a timer (NAV-R2 I1) |
| Change dates reopens the copy sheet with its full export list | 5.2 Change dates | in Change dates the list holds Calendar, GPX and CSV only; Print stays in the row menu (NAV-R2 I2) |
| Rows in two columns from 1,024 px | 5.1 | two columns that fill down (CSS columns), so dates read in order down each column; the group count sits after the label from 1,024 px ("Upcoming · 3") (NAV-R2 should 4, polish 1) |
