# Recommendation (18 Oct 2026)

## 1. Direction: C, Trailhead

**Build Trailhead.** The live read-only site is the owner's main selling point, and he already likes it in
context. Trailhead keeps that site's structure, components and type, removes the green he rejected, and
carries the same system into the signed-in planner. The other two directions would each mean throwing that
work away:

- **Atlas** has the most emotional pull, but it is a generic premium-travel look. Its editorial serif costs
  space in the dense views (outline, bookings, the places table). It would also mean redesigning the public
  pages that already work.
- **Altimeter** plans best, but it is dark first, cold and mono-heavy. That is wrong for the public site and
  for sharing with family.

Trailhead takes two ideas from the others:

1. From Atlas, the **full-bleed photo cover** on public trip and trail pages (already in the Trailhead
   previews).
2. From Altimeter, the **keyboard layer** on desktop:
   - ⌘K opens the trip switcher as a palette and keeps the current tab.
   - ⌘[ returns to the previous trip.
   - `/` jumps to search.
   - N adds a booking, task or expense in the current trip.

The day strip with its drive and walk gauges is worth a later experiment in the Plan header. It is not in v1.

The palette is light first, with stone paper (`#F5F6F8`), slate ink (`#172230`) and a navy header
(`#172230`) carrying the amber rule. Dark mode is slate (`#0F1620`); it is not black and it is not green.
Tokens and AA results: [directions.md](directions.md) section C and [contrast-report.txt](contrast-report.txt).

## 2. Information architecture

> **Superseded in part (18 Oct 2026, foundation gate B1).** Names, URLs, type sizes and the urgency
> threshold below were replaced by the foundation: "Discover" is **Trips** (`/trips`), the household's own
> trips are **Home** (`/home`), place pages are `/places/<place-slug>`, the planner is `/t/<trip-slug>/<tab>[/<item-id>]`,
> and `/trips/<trip-slug>` is always the public page. The one URL table is
> [../foundation/patterns.md](../foundation/patterns.md) 1.2; thresholds are tokens.md 3.1; sizes are
> tokens.md 6. Where this page and the foundation differ, the foundation wins.

The **public, no-login, read-only experience is the primary surface.** The signed-in planner sits on top of
the same pages. Logging in adds a trip switcher, the household's deadlines and editing; it does not create a
second app.

| Area | Who | Scope | What it holds |
|---|---|---|---|
| **Trips** (`/trips`, `/trips/<trip-slug>`; was "Discover") | everyone | global | published trips: cards, list, table and map views; filters; the public trip page (season band, day by day, route map, copy, export) |
| **Places** (`/places`, `/places/<place-slug>`) | everyone | global | every place and trail: filter pills for each dimension, four views, table tools, honesty markers; place and trail pages with every fact, source and link |
| **Globe** (`/globe`, `/globe/<country>/<state>`, `/globe/place/<place-slug>`, `/globe/trip/<trip-slug>`) | everyone | global | the entry point: pins by continent and country, drill country to state to district, styles, 3D terrain, saved places by country, search that flies to a place |
| **Home** (`/home`; was "Trips") | signed in | cross-trip summary | needs you this week (grouped by trip), in progress, planning, ideas, done as templates; the same card, list, table and map views as Discover; the **Year** view (all trips, their booking windows and spend, each in its own currency) |
| **Inbox** (bell) | signed in | cross-trip | reminders and forwarded emails waiting for review; every row names its trip |
| **People** (from the avatar) | signed in | household | travellers, passports, memberships and passes; checks linked to each person |
| **Trip** (`/t/<trip-slug>/<tab>[/<item-id>]`, e.g. `/t/patagonia-2027/bookings/bk_7f3a`) | signed in, or a viewer by link | one trip | Plan, Today, Bookings, Tasks, Budget and Share |

**Desktop.**

- The header carries the brand, then Home, Trips, Places and Globe, then the **trip chip**: the selected
  trip's photo in its colour ring, with its name. The chip is the switcher.
- When a trip is open, a **trip bar** sits under the header: photo, name in Big Shoulders, dates, countdown,
  phase, and the tabs Plan, Today, Bookings, Tasks, Budget, Share. It is sticky; forms and drawers open
  below it, so the trip name is never covered.
- The trip's identity colour is the rule under the trip bar, the ring on the chip and the bar under the
  card photo.

**Phone.**

- On a trip screen, the top bar shows the trip photo, name, dates and countdown, with the trip colour as its
  bottom rule. The bottom bar holds the trip photo (the switcher), then Plan, Today, Bookings and More (Tasks, Budget, Share).
- Outside a trip, the bottom bar holds Home, Trips, Places, Globe and Me.
- **The trip switcher is the first item of the bottom bar**, the trip photo in its ring, so it is in thumb
  reach (S8). The swap button at the top right stays as a second way in.

**The switcher.**

- It lists trips in progress first, soonest first. Each row has a photo in the colour ring, the name, the
  dates and the next deadline, coloured by the one urgency rule (tokens.md 3.1: coral inside 7 days or when a
  window opens inside 48 hours, ochre 8 to 30 days, neutral beyond).
- Below those come Planning, then a "Done (3)" link.
- Picking a trip keeps the current tab, and each trip remembers its last tab, scroll position and map day.
- A toast offers "Back" to the previous trip for 8 seconds; ⌘[ does the same on desktop.
- On a travel day, Today ignores the last-selected trip and opens the trip in progress. It says so with a
  one-tap way back (S5).

## 3. Tasks, bookings and budget: trip-scoped or global?

**Decision: each of the three lives inside its trip. Cross-trip views only summarise, and anything that
belongs to a person lives on the person.** This follows rules 5 and 6 of
[trip-scope-scenarios.md](../trip-scope-scenarios.md).

| | Where you work on it | The cross-trip view | Person level |
|---|---|---|---|
| **Tasks** | the trip's Tasks tab: only that trip's tasks plus the linked person checks, with a link "2 more due this week in other trips" | Trips home "Needs you this week": grouped by trip, sorted by due date; tick, snooze and open only. Open lands on the item inside its trip | passports, IDP, memberships: one task on the person, shown in every affected trip as a linked check; ticking it once clears it everywhere |
| **Bookings** | the trip's Bookings tab | the Year view draws booking windows on one timeline; deadlines appear in "Needs you"; a forwarded email lands in the Inbox review, which suggests the trip from the dates | none |
| **Budget** | the trip's Budget tab, in the trip's currencies | the Year view totals spend per trip and per currency (CAD and USD stay separate, no forced conversion); it is read-only | none |

**Why not one global task list grouped by trip?**

- A global list invites adding a task without a trip, and then the task goes missing (rule 4).
- It duplicates the trip's own list, so there are two places to edit the same thing.
- It grows without bound across 12 trips.

**What you lose** is a single place to scan everything at once. "Needs you this week" covers the part that
matters (the next deadlines from every trip), and the Year view covers long-range windows. If the owner wants
a full list later, it can be a filter on "Needs you" (all due, not just this week) with the same row rules:
tick, snooze and open only, never edit in place.

**Reminders** always name the trip and open it in context, for example: "Patagonia · Book El Chaltén lodging
· due Sat 31 Oct". This holds for push, email and the Inbox.

## 4. Kept from the live site, and where each item lives

Every item in [keep-from-live-site.md](../keep-from-live-site.md):

| Kept item | Where it lives now | Preview |
|---|---|---|
| Real hero photo on every card | trip cards on Home and Trips; place cards; day cards on the public trip | trailhead/home, public-trip |
| Display title on each card, two lines when long | `--t-card`, Big Shoulders 24 px, on every card | home |
| Dates, nights and route in small mono | card meta line | home |
| Countdown chip, link chip | neutral countdown chip and status chip; "Legacy page" becomes "Public page" on published trips | home |
| One-sentence editorial summary in a reading serif | Source Serif 4, 16 px, on every card | home |
| Search with `/`, live count | toolbar on Home, Trips and Places; the count in `--t-section` `--accent-text` | home, places |
| Filter pills (When, Source; Country, Kind, Status, Kids, Season, Tag, Plan) | the same pills on each list; "Phase" and "Who" added on Trips | home, places |
| Group by, Sort by with a direction toggle, group headings with counts | the subbar on each list | home, places |
| Cards, List, Table, Map on one data set; the selected view is an amber segment | every list (Home, Trips, Places) | home, places |
| Top bar with brand, section tabs underlined, theme toggle | navy header with the amber rule; the trip chip added | all |
| Place cards with a kind glyph when there is no photo | ink glyph on a `--well` disc (no teal: changes-from-preview 3) | trailhead/home (Peru idea), places |
| Area chain on the card | card meta | places (cards view) |
| Chips for kind, status (Idea dashed), season, kids | the same chips | places |
| Honesty markers: location unconfirmed, unverified, no source yet, source counts | dashed coral chips; source counts in the Sources column | places, trail ("Dog policy unverified") |
| Footer links on a card (Place page, Globe) | kept on place cards | spec (not drawn) |
| Grouped by country with a sticky header and count | table and card groups | places |
| Table: saved views, columns, density, Export CSV, collapsible groups, right-aligned elevation | the table tools row | places |
| Map view with URL state | every list's Map view; filters live in the URL | spec |
| 3D globe with relief, drag, zoom, hover facts, fly-in, drill country to state to district | Globe, the public entry point | places (globe panel) |
| Style switcher, 3D terrain and relief slider, auto-spin | globe controls, restyled to the new header | places |
| Saved-place pins and side panel by country | Globe side panel; for signed-in users the pins include their trips in the trip colour | spec |
| Globe search, breadcrumb chip, hint bar | kept | spec |

## 5. S1-S10 walked for Trailhead

Checked against the Trailhead previews. "Spec" means the behaviour is defined above but not drawn as a frame.

| # | Result | Evidence |
|---|---|---|
| S1 Home, nothing selected | **Pass** | trailhead/home: "Needs you this week" has columns for Elora, Patagonia, Dolomites and Aarav (person). Each has the trip photo in its colour ring, the name and dates; rows sorted by due date; tick, snooze, and "Open in Bookings/Today/Tasks" |
| S2 Patagonia flight, then Dolomites Ortisei | **Pass** | trailhead/bookings-switch: frame 1 is the switcher over Dolomites Bookings. Frame 2 is Patagonia Bookings, with the form headed "New booking in Patagonia" and the button "Save to Patagonia". Frame 3 is back on Dolomites Bookings with Ortisei open and "Save to Dolomites" |
| S3 Forwarded hotel email for 1-5 Mar 2027 | **Pass in spec, not drawn** | Inbox review suggests the trip from the dates ("Files under: Patagonia · matched by the dates · Change" is the same field the S2 form shows) |
| S4 Renew Aarav's passport | **Pass** | home: the Aarav column is linked to Dolomites and Patagonia; it is a single task on the person |
| S5 Sat 24 Oct at Elora, Dolomites last selected | **Pass** | trailhead/today-phone: the Elora top bar has its photo and rose rule; the note reads "Opened Elora, the trip you are on today. You were planning Dolomites", with a one-tap Dolomites button |
| S6 Tasks inside Dolomites | **Pass in spec, not drawn** | section 3: trip tasks plus linked person checks, plus the "2 more due this week in other trips" link |
| S7 Feb budget overlap, Costa Rica and Patagonia | **Pass in spec** | each budget is its own; the Year view totals per currency (drawn in the Atlas and Altimeter homes) |
| S8 Phone, one hand, car park | **Pass** | trailhead/plan-phone and today-phone: the trip photo is the first item of the bottom bar and opens the switcher; the next action (Navigate, Show the slot) is a 50 px button in the lower half; the top bar always names the trip |
| S9 Shared link to a Patagonia booking | **Pass in spec** | URLs carry the trip (`/t/patagonia-2027/bookings/bk_7f3a?share=…`, patterns.md 1.2); a viewer link opens read-only with the trip bar |
| S10 Done trip (Vermont) | **Pass** | home: Done group, read-only, "Use as a template"; it is not in the switcher's in-progress list, and the switcher has a "Done (3)" link |

## 6. Migration: what changes in the prototype

The steps are sized for one coding agent each, in this order. Each step ends with `npm run build` and a
screenshot check in light and dark.

1. **Tokens and fonts.**
   - Replace the token blocks in `prototype/src/styles.css` with the Trailhead roles from directions.md.
   - Rename `--act` to `--accent`, and `--glow` to `--crit` for urgency (the accent is now amber).
   - Add `--accent-text`, `--teal`, `--header*` and `--tc` (the trip colour).
   - Self-host Big Shoulders, Source Serif 4 and IBM Plex Mono from `docs/v2/design/redesign/fonts/`, and drop
     the Google Fonts link and Schibsted.
   - Base text becomes serif 16 px; labels, numbers and chips become mono.
2. **Trip identity in data.**
   - Add `colour` (an Okabe-Ito key) and `photo` (a Commons file, author and licence) to `TripCard` in
     `data/trips.ts` and to `Trip`.
   - Add a `Credits` component that renders the photo credits on any screen that shows a photo.
3. **App shell** (`App.tsx`, `app.css`):
   - Remove the rail.
   - Add the navy header with the global tabs and the trip chip.
   - Add a `TripBar` (sticky, with tabs) on trip screens.
   - Phone: a top trip bar, a bottom bar with the trip tabs and the trip photo as the switcher.
   - URL becomes `#/t/<trip-slug>/<tab>[/<item-id>]` (the table in foundation/patterns.md 1.2) instead of `#<screen>`.
   - Remember the tab, scroll and map day per trip in the store.
4. **Trip switcher** (`TripSwitcher`): rebuild it as the menu in trailhead/bookings-switch, with ⌘K, ⌘[ and the
   Back toast. Switching keeps the tab.
5. **Trips home** (`screens/Home.tsx`, `home.css`, `TripRow.tsx`, `TripsTable.tsx`):
   - "Needs you" as columns grouped by trip.
   - Photo cards as in trailhead/home; delete the procedural `tone` patterns.
   - Toolbar: search, pills, the four views, group and sort.
   - Done trips get a template button.
6. **Plan** (`plan/Plan.tsx`, `Outline.tsx`, `DaySection.tsx`, `ItemCard.tsx`, `Timeline.tsx`, `drop.tsx`):
   - The outline gets base headers with photos.
   - The day header is the amber day sign plus a Big Shoulders title.
   - Item rows get a time, a kind glyph, a serif title, mono meta, an italic note and a 96 px photo.
   - The grip moves to the left edge, next to the time.
   - The insertion line is amber with a pill label.
   - Collapsed days show a thumbnail.
7. **Map** (`map/MapView.tsx`):
   - Hillshade colours to stone and slate; add a contour layer (Mapterhorn DEM, 100 m and 500 m).
   - Reduce basemap labels.
   - Routes in ink, the picked day in amber, bases as ink signposts with a Big Shoulders label (the picked day's base amber).
   - Use the trip's colour nowhere on the map, so day and base colours stay readable.
8. **Today** (`screens/Today.tsx`, `today.css`):
   - The leave-by number in amber Big Shoulders.
   - Running late shows its consequences before you commit (preview frames 2 and 3).
   - Offline state is a dashed banner with the time it was saved.
   - The travel-day override note (S5).
9. **Bookings** (`Bookings.tsx`, `BookingDetail.tsx`, `BookingForm.tsx`, `bookings.css`):
   - Rows grouped by day.
   - The form opens as a drawer under the trip bar, with a photo header naming the trip, a "Files under"
     field and "Save to <trip>".
10. **Tasks and Budget**:
    - Restyle both with the same row anatomy.
    - Tasks: person checks and the "N more in other trips" link.
    - Budget: per-currency totals.
    - Add a Year view under Trips.
11. **Public pages** (`Discover.tsx`, `PublicTrip.tsx`, `PlacePage.tsx`, `TrailPanels.tsx`):
    - Cover photo, season band, route map, day cards.
    - Trail page as in trailhead/trail; move the data-source fallback chain to the admin review.
12. **Places and Globe**: port the live site's Places table and Globe into the prototype under the new
    header. Explore becomes Places.

## 7. Gotchas

- **Commons rate limits.** Search one request at a time from one agent. Production should cache thumbnails
  (R2 or a worker) rather than hotlink, because Commons asks heavy users not to hotlink.
- **The Okabe-Ito yellow (`#F0E442`)** disappears on white. It must always be a ring or bar next to a photo,
  never a lone dot on paper. Chamonix is the trip to test with.
- **Big Shoulders in capitals** is the loudest thing in the system. Keep it to titles, day signs, counts and
  the leave-by number. Never use it for a button or a sentence.
- **Mono for labels only.** One line of IBM Plex Mono is fine; a paragraph in it reads as code. This was the
  same mistake as `tnum` in the old system.
- **Map relief images are previews.** The real app renders the same look from Mapterhorn tiles in MapLibre
  (hillshade and contour layers). The PNG relief in `assets/` exists only for these static pages.
- **Pins overlap** where two days share a stop or pass (Misurina on Days 3 and 5, Passo Gardena). The static
  previews draw each day's pins as they are. The app should merge pins at the same place into one pin with a
  "3 · 5" badge, and pull them apart on hover.
