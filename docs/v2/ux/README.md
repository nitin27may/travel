# UX: navigation, layout and screens

Status: **draft** (17 Oct 2026). Extends [../02-experience.md](../02-experience.md); where they differ,
02 states the intent and these pages state the detail. Decisions assumed: self-hosted Supabase with
Next.js on the home server ([../08-self-hosted.md](../08-self-hosted.md)), reservations recorded and
never sold ([../09-reservations.md](../09-reservations.md)), live co-editing, family first.

## Pages

| Page | What it covers |
|---|---|
| [components.md](components.md) | Every reusable component: purpose, props, variants, states, behaviour, accessibility, where used |
| [tokens-and-patterns.md](tokens-and-patterns.md) | Tokens, type, spacing, motion, icons, light and dark, map style, interaction patterns, copy rules, Wanderlog lessons |
| [screens/S01-sign-in-and-consent.md](screens/S01-sign-in-and-consent.md) | Sign in, sign up, MCP client consent |
| [screens/S02-home-and-trips.md](screens/S02-home-and-trips.md) | Home (signed out and in), the trips list by phase |
| [screens/S03-travel-year.md](screens/S03-travel-year.md) | The year: goals, long weekends, school breaks, trips, candidates, budget |
| [screens/S04-new-trip.md](screens/S04-new-trip.md) | Starting a trip: intent sheet, express path, day trip from home, every trip type |
| [screens/S05-candidates.md](screens/S05-candidates.md) | Comparing destinations before choosing |
| [screens/S06-explore.md](screens/S06-explore.md) | Map + cards, filters, persona chips, typed queries as chips, zero-result rescue |
| [screens/S07-entity-sheet-and-pages.md](screens/S07-entity-sheet-and-pages.md) | Trail, activity, stay and place: the sheet and the full page |
| [screens/S08-trip-dashboard.md](screens/S08-trip-dashboard.md) | The phase-aware trip home |
| [screens/S09-plan-document.md](screens/S09-plan-document.md) | The desktop plan: outline, document, map |
| [screens/S10-board.md](screens/S10-board.md) | Columns of days for big rearranging |
| [screens/S11-phone-day-pager.md](screens/S11-phone-day-pager.md) | Planning on the phone, one day at a time |
| [screens/S12-reservations.md](screens/S12-reservations.md) | The reservations list and booking timeline |
| [screens/S13-reservation-forms.md](screens/S13-reservation-forms.md) | Per-kind forms; paste, forward and upload flows |
| [screens/S14-wallet.md](screens/S14-wallet.md) | Tickets and codes at the desk, offline |
| [screens/S15-tasks-and-checklists.md](screens/S15-tasks-and-checklists.md) | Tasks by group, inline checklists, promoting a line to a task |
| [screens/S16-budget-and-expenses.md](screens/S16-budget-and-expenses.md) | Planned vs actual, expenses, quick add |
| [screens/S17-people-and-household.md](screens/S17-people-and-household.md) | Travellers on a trip, who can do what; household people and passes |
| [screens/S18-templates-and-adapt.md](screens/S18-templates-and-adapt.md) | Template gallery, preview, fork and adapt (length, month, party) |
| [screens/S19-today.md](screens/S19-today.md) | Today mode during the trip |
| [screens/S20-tomorrow-briefing.md](screens/S20-tomorrow-briefing.md) | The evening card |
| [screens/S21-after-the-trip.md](screens/S21-after-the-trip.md) | How did it go, corrections, publish as template |
| [screens/S22-inbox.md](screens/S22-inbox.md) | Reminders and notifications with their state |
| [screens/S23-settings.md](screens/S23-settings.md) | Household, notifications, connected MCP clients, access tokens |
| [screens/S24-admin-review.md](screens/S24-admin-review.md) | Review queue with diffs and evidence |
| [screens/S25-admin-coverage-and-jobs.md](screens/S25-admin-coverage-and-jobs.md) | Coverage map, backlog, research jobs |
| [screens/S26-share-sheet.md](screens/S26-share-sheet.md) | One share sheet for every scope: audience, include toggles with live preview, expiry, PIN, exports, active links |
| [screens/S27-guest-view.md](screens/S27-guest-view.md) | What a link recipient sees, signed out; "Copy to my trips" |

Every screen page uses the same headings: Purpose · Entry points · Wireframes (desktop and phone) ·
Regions and components · Primary action · States · Interactions · Copy · Accessibility · Data and
operations · Acceptance criteria · Share (where sharing enters this screen; rules in
[../10-sharing.md](../10-sharing.md)).

## 1. Navigation model

### 1.1 Outside a trip

| Phone (bottom bar, 4 items) | Desktop (left rail, collapsible to icons) |
|---|---|
| **Trips** · **Explore** · **Inbox** (badge = due reminders) · **You** | Trips · Explore · Year · Templates · Inbox · Settings · Admin (role-gated) |

"Year" and "Templates" live under **You** on the phone, because they are monthly, not daily, actions.

### 1.2 Inside a trip

| Phone (bottom bar replaces the global one; a back chevron returns to Trips) | Desktop (tabs under the trip title) |
|---|---|
| **Overview** (becomes **Today** during the trip) · **Plan** · **Bookings** · **Tasks** · **More** (Budget, People, Map, Settings, Share) | Overview · Plan · Bookings · Tasks · Budget · People · Today (only during the trip) |

The map is not a tab on desktop: it is always the right column of Plan and Overview. On the phone it is
a bottom sheet inside Plan and Explore, and a "Map" entry under More shows the whole trip.

### 1.3 Command palette

`/` or `⌘K` / `Ctrl K` anywhere on desktop; a search icon in the top bar on the phone. One box for:
- jump to a trip, a day ("day 4"), a list, a reservation, a task;
- search the catalog ("Moraine Lake") and add the result to the current trip;
- add a custom item ("Dinner at Nonna's" → "Add as my own");
- run an action by verb ("add day", "mark shuttle booked", "shift today by 30 min", "download offline").

Results group by kind; the first row is always the most likely action, so Enter does the obvious thing.

### 1.4 URLs

Every view has a URL that restores it, including filters and the focused item:
`/t/rockies-2029/plan?day=6&focus=itm_01H…`, `/explore?near=51.42,-116.18&r=45m&tags=lake,kid-9`.
Sheets that open over a view add `?focus=` so the back button closes them.

## 2. Breakpoints and layout

| Name | Width | Layout |
|---|---|---|
| phone | < 640 px | one column; bottom bar; sheets from the bottom; map full-screen behind a draggable sheet |
| tablet | 640–1023 px | two columns where useful (document + map in Plan, list + map in Explore); rail collapses to icons |
| desktop | ≥ 1024 px | three columns in Plan: outline (220 px) · document (fluid, max 760 px) · map (≥ 38 % of width) |
| wide | ≥ 1440 px | outline widens to 260 px; map gets the extra width; never wider text columns than 760 px |

Rules:
1. The document column never exceeds ~76 characters per line of prose.
2. The map is resizable on desktop (drag the divider; remembered per user); it can be collapsed to a
   48 px strip, never fully hidden in Plan.
3. Sheets: right-side panel over the map on desktop, bottom sheet on phone and tablet portrait.
4. No horizontal page scroll at any width; long tables scroll inside their own container with a
   sticky first column.
5. Landscape phone: Today mode keeps the timeline and moves the map to the right half.

## 3. Phase-aware defaults

| Trip phase | Opening a trip lands on | The Overview leads with |
|---|---|---|
| idea | Overview (candidates if no area) | "Choose where" or the candidates table |
| plan | Plan | next unplanned day, lists with counts, day warnings |
| book | Overview | next booking window or deadline, the bookings strip |
| prepare | Overview | readiness bar, open tasks, "Make available offline" |
| go | **Today** | next stop and "leave by" |
| after | Overview | "How did it go?" and "Publish as template" |

The user can always switch tabs; the default only decides the first screen. Phase is computed from
dates and progress (01-domain-model.md 3.1) and can be overridden in trip settings.

## 4. One-handed reach (phone)

- Primary actions sit in the bottom third: the bottom bar, a floating **+** above it (right side,
  56 px), sheet action rows anchored to the bottom.
- The top bar holds only title, back, search and presence avatars; nothing that is used repeatedly.
- Destructive actions are never in the thumb zone by default; they live in a "⋯" menu and always offer
  undo.
- Targets are at least 44 × 44 px with 8 px between adjacent targets.
- Swipe gestures always have a visible button equivalent (swipe between days = the day pager arrows
  and the day chips).

## 5. Offline indicators

- **Offline badge** in the top bar: a cloud-off icon plus "Offline · saved 07:12"; tap for details
  (what is cached, how many edits are queued, the last sync time).
- Queued edits show a small clock mark on the affected item until the server confirms them.
- Anything not available offline is shown, not hidden: greyed with "Needs connection" (for example
  catalog search beyond the trip, or the weather refresh).
- The download status per trip appears on the trip card ("Offline ready · 84 MB · 2 days ago").

## 6. Accessibility rules (apply to every screen)

1. WCAG 2.2 AA contrast for text and UI in light and dark; sunlight-readable mode (higher contrast)
   switchable in Today mode.
2. Every drag has a keyboard and a menu alternative ("Move to… Day 3 · after Lunch").
3. Focus is moved deliberately when a sheet opens (to its heading) and returned when it closes.
4. Live regions announce: filter result counts, undo toasts, remote edits by collaborators ("Priya
   moved Lake Agnes to day 4"), sync completion.
5. Maps have a list equivalent on the same screen; pins have accessible names ("3, Lake Agnes Tea
   House, 7.4 km").
6. Colour is never the only signal: status uses icon + text; categories use shape + colour.
7. `prefers-reduced-motion` turns map fly-tos into jumps and removes item fly animations.
8. Local names carry `lang` (Seceda, Lago di Braies, Laguna de los Tres) so screen readers pronounce them.
9. Text scales to 200 % without loss; the layout reflows to one column.
10. Times are read with their zone when it differs from the device ("09:05 Venice time").
