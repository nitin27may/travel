# Scenario check before applying Trailhead (18 Oct 2026)

The design gate from [trip-scope-scenarios.md](trip-scope-scenarios.md) ("How this page is used", step 3).
It checks two things: the chosen design (the foundation in [foundation/](foundation/) plus the Trailhead
previews in [redesign/trailhead/](redesign/trailhead/), with the foundation winning where they differ) and
the current prototype on :5191. It also checks the must-keep list, the product direction and the
consistency of the foundation documents.

Method: Chromium 1248 through `prototype/node_modules/playwright-core`, 1440 x 900 at 2x (phone 390 x 844
at 2x), tall pages cut into 1600 px tiles, localStorage `proto.trip` and `proto.theme` set before each load.
Screenshots are in [scenario-check/](scenario-check/), quantised to 256 colours to keep the repo small.
Prototype "today" is Sun 18 Oct 2026.

Verdicts: **PASS** = drawn and correct · **SPEC ONLY** = written in the foundation but not drawn anywhere ·
**FAIL** = missing or wrong.

## Go / No-go

**Go for the public read-only site, after five small spec fixes (B1 to B5).** None of them needs a redesign;
together they are a few hours of editing in tokens.md, components.md, patterns.md and specimen.html. The
signed-in planner is a **Go with conditions**: its spec-only items (S3, S6, S7, S9) are fine to build from
words, but S6 is only written in recommendation.md and must move into the foundation first (N1).

The design itself fails no scenario and no rule. The prototype fails all ten scenarios and eight of nine
rules. That is expected (it predates the trip-scope rules and the foundation), and the migration list in
section 2 is the work.

### Blocking fixes, in order

| # | Fix | Where | Why it blocks |
|---|---|---|---|
| B1 | **One URL table.** Public `/trips/<slug>`, `/places/<slug>`, `/globe/...`; planner `/t/<slug>/<tab>/<id>`. Rewrite rule 9's example (`/trips/patagonia-2027/bookings/r-123`) and recommendation.md section 2 (`/discover`, `/t/<slug>` as the *public* trip, `/p/<slug>`, `/trips/<id>/<tab>`) to match, or mark them superseded. Fix the slug in patterns 4.5 (`/t/patagonia/...` vs `patagonia-2027`). | patterns.md 1.2, trip-scope-scenarios.md rule 9, recommendation.md 2 | Public URLs are shared and must not change after launch. Today `/t/<slug>` means a public trip in one document and the private planner in another. |
| B2 | **One urgency threshold.** tokens.md 3 says `--crit` = due inside 7 days; components.md 1.3 and recommendation.md 2 say the switcher turns coral inside 14 days. Pick: `--crit` ≤ 7 days, `--warn` 8 to 14 days, neutral beyond. Then fix the specimen and previews that draw 13 days in coral (see section 5). | tokens.md 3, components.md 1.3 | Status colour is the one thing a parent scans for; two thresholds mean two meanings. |
| B3 | **Close the display type scale.** tokens.md 6 allows Big Shoulders only at 96, 72, 40, 32, 24, 19, 15 and 78; components.md and specimen.html also use 18, 20, 21, 22, 30, 34 and 52. Either add named tokens (e.g. `--t-chip-name` 18, `--t-row-name` 21, `--t-group` 22, `--t-sheet` 34, `--t-window` 52, `--t-count` 34) or map each use to an existing step. | tokens.md 6, components.md 1.3, 3.3, 4.2, 5.1, patterns.md 3.4 | The implementer generates the CSS tokens from tokens.json first; an open scale becomes ad-hoc sizes again (review section 4). |
| B4 | **Amber on public surfaces.** Globe country pins are `--accent` discs at rest (tokens.md 5, components.md 7.2) and the elevation profile is an `--accent` line and area (components.md 4.4, specimen). Neither is "selected, now, primary action". Make resting globe pins and the profile `--ink`; amber only for the hovered/selected pin and the scrub cursor. | tokens.md 5, components.md 4.4, 7.2 | These are the two most-seen public components, and C1 was the review's top finding. |
| B5 | **Category taxonomy for the trip detail.** patterns.md 3.4 names five categories (Stays, Trails, Sights, Food, Logistics) but not which of the fifteen place kinds in `research/method/kinds/` go where (lake, waterfall, viewpoint, swim spot, town, event, adventure, lift, parking, trailhead, hut). Add the mapping, the rule for an item with two kinds, and the empty-category behaviour. Also say how the category strip behaves on phone (scrolling chips or a select). | patterns.md 3.4 | The categorised trip page is the owner's top public ask; without the mapping two people build two different pages. |

### Gate fixes (18 Oct, evening)

All five blocking items are resolved in the foundation; the specimen and the changed previews were
re-rendered at 2x in light and dark and read in tiles.

| # | Resolved by | Where |
|---|---|---|
| B1 | One URL table: public `/trips/<trip-slug>`, `/places/<place-slug>`, `/globe/<country>/<state>`, `/globe/place/<slug>`, `/globe/trip/<slug>`; planner `/home`, `/t/<trip-slug>/<tab>/<item-id>`; shared `?share=<token>`; slugs carry the start year; item ids prefixed (`bk_7f3a`). Rule 9's example, recommendation.md 2/5/6 and patterns 4.5 now match. | foundation/patterns.md 1.2; trip-scope-scenarios.md rule 9; redesign/recommendation.md 2 (superseded note) |
| B2 | One urgency rule: `--crit` within 7 days or a window opening within 48 h or missed; `--warn` 8 to 30 days or window open; neutral beyond. Switcher, needs-you, booking card, task row, trip card, badge and Next banner all cite it; Patagonia's 13-day deadlines are ochre everywhere. | foundation/tokens.md 3.1, tokens.json `urgency`; components.md shared rules, 1.3, 1.4, 2.8, 3.1, 3.3, 3.4, 3.5, 5.4; specimen Rows, Cards, Switcher, Chips; home.html and bookings-switch.html rebuilt |
| B3 | Display scale closed at nine steps: `--t-row` 21 added (switcher rows, trip chip, group headings, needs-you heads, calendar month, day strip); 30/34 map to `--t-section` 32 (sheet title, count); 52 and the tab page title map to `--t-trip` 40; the map base label is `--t-sign-s` 15. `--t-tab` 13.5 added for tabs. | foundation/tokens.md 6, tokens.json `type.row`, `type.tab`; components.md 1.1, 1.2, 1.3, 3.3, 4.2, 5.1; patterns.md 3.4; specimen Type and every affected component |
| B4 | Globe country pins are `--ink` discs with `--surface` counts at rest, amber only hovered or selected (`--globe-pin`, `--globe-pin-pick`); the elevation profile is an `--ink` line and 10% area with an amber scrub cursor and position dot only. | foundation/tokens.md 5, tokens.json `map.globe-pin*`; components.md 4.4, 7.2; specimen Map and globe, Elevation |
| B5 | Six categories (Activities added, justified by the `activity` entity kind); all fifteen kinds mapped with the two-kind rule, counts, empty-category and chip-tap behaviour; phone strip: 32 px chips scrolling sideways with snap and a fade, sticky and scroll-spied in By category only. | foundation/patterns.md 3.4; changes-from-preview.md 7 |

Also fixed: the date slips in 5.1 (specimen 13 and 28 days, Tre Cime slot "to book" neutral, home.html Sunday,
Halloween replaced by Thanksgiving in components 2.4, places count 57, Iceland nights once); the dark done
check (`--ok-soft` fill, `--ok` glyph, 7.87:1); the side sheet at 460/140/32 in both documents; hex in
components replaced by `--accent-hover`, `--on-crit-fill`, `--kicker-on-photo`; radii 10 and 14 and text
under 11.5 px brought onto the scale; search input 16 px; `phone-header-h` and the bottom-bar ring
exception recorded; N1 to N6 written as one-paragraph specs in patterns.md 4.8 with the S6 cross-trip link in
components 3.5. The preview slips were fixed in the generator and the previews rebuilt (byte-identical
before the change), so a rebuild keeps them. Rows still open from 5.1 are the prototype's (`TODAY`
constant, Tasks counts, the Air Canada sample) and belong to the migration.

### Fixes that can be done during implementation

Listed in sections 2 (prototype migration) and 5 (consistency). The planner-only ones (N1 to N6) come before
the planner is built, not before the public site.

### Counts

| Subject | PASS | SPEC ONLY | FAIL |
|---|---|---|---|
| Design, scenarios S1-S10 | 6 | 4 | 0 |
| Design, rules 1-9 | 7 | 2 | 0 |
| **Design total** | **13** | **6** | **0** |
| Prototype, scenarios S1-S10 | 0 | n/a | 10 |
| Prototype, rules 1-9 | 0 | n/a | 9 (two partly met: rule 1 on desktop, rule 2 keeps the tab) |
| Must-keep list (design), 24 items | 18 kept · 6 kept with change · 0 lost (7 of the kept items are spec or specimen only: 16, 19-24) | | |

## 1. Scenarios S1-S10

| # | Design (foundation + previews) | Evidence | Prototype | Evidence | Gap and fix |
|---|---|---|---|---|---|
| S1 Monday evening, nothing selected | **PASS** | [design-home-t1](scenario-check/design-home-t1.png): Needs you as columns per trip (Elora, Patagonia, Dolomites, Aarav), photo in the identity ring, tick / Snooze / "Open in Bookings →". components 3.3. | **FAIL** | [proto-s1-home](scenario-check/proto-s1-home.png), [proto-s1-open-bookings](scenario-check/proto-s1-open-bookings.png), [proto-s1-open-bookings-dolo-selected](scenario-check/proto-s1-open-bookings-dolo-selected.png) | Prototype lists Patagonia, Elora and a done trip (Algonquin), not Dolomites; one pink slab, not grouped by trip, no trip colour; one button per row, no tick or snooze. **"Open bookings" on the Patagonia row opens the trip picker when nothing is selected, and opens Dolomites Bookings when Dolomites was last selected** (`Home.tsx` calls `go(n.to)` without the trip). Countdowns are one day off (section 5). Migration: build components 3.3; `go(tab, tripId, itemId)`. Design note: home.html still reads "Monday 18 October" (review P1 fixed it in words only). |
| S2 Patagonia flight, then Dolomites hotel | **PASS** | [design-bookings-switch-t1](scenario-check/design-bookings-switch-t1.png), [-t2](scenario-check/design-bookings-switch-t2.png): switcher with deadlines, lands on Patagonia Bookings, drawer header "NEW BOOKING IN PATAGONIA", frame 3 back to Dolomites Bookings. | **FAIL** | [proto-s2-1](scenario-check/proto-s2-1-dolomites-bookings.png), [proto-s2-2](scenario-check/proto-s2-2-switcher-open.png), [proto-s2-3](scenario-check/proto-s2-3-after-switch-patagonia.png), [proto-s2-4](scenario-check/proto-s2-4-add-stay-form-dolomites.png) | Switching keeps the Bookings tab (good), but switcher rows show only dates, no photo, no deadline; the form header says "Add stay / New stay" and Save says "Save stay", never the trip (`BookingForm.tsx` line 71, 216). Only Dolomites has data, so Patagonia lands on an empty state. Design note: the Patagonia "Book by Sat 31 Oct" is coral at 13 days, against tokens.md 3 (B2). |
| S3 Forwarded hotel email, 1-5 Mar 2027 | **SPEC ONLY** | patterns 4.3 ("Files under" suggested from dates, Save disabled until a trip is chosen), components 8.4. "Forward a confirmation" button drawn on home and bookings; the review step is not drawn. | **FAIL** | [proto-s3-paste-confirmation](scenario-check/proto-s3-paste-confirmation.png), [proto-r1-bookings-scrolled](scenario-check/proto-r1-bookings-scrolled.png) | Prototype forwards to a per-trip address (`dolomites-7kq@in.trips.example`), so nothing suggests a trip from dates. Its own sample shows an "Air Canada · K7Q2PZ · 2 Mar" item added to **Dolomites**, a date inside Patagonia's 26 Feb-11 Mar and in the future relative to 18 Oct. Fix (design, N2): add an **Inbox review** template to patterns.md 4 (row anatomy, suggested trip, Change, Move). Fix (prototype): one household address, review step with date matching. |
| S4 "Renew Aarav's passport" | **PASS** | home.html Aarav column "linked to Dolomites, Patagonia" (design-home-t1); specimen task row "Fri 15 Jan · in 89 days · shared with Patagonia" with a Person chip ([crop](scenario-check/design-specimen-needs-you-row-date-slip.png)); components 3.5. | **FAIL** | [proto-s4-s6-tasks-dolomites](scenario-check/proto-s4-s6-tasks-dolomites.png) | Prototype has "Passports valid 3 months past 26 Jul" as a Dolomites task; no person entity. Migration: People store, linked checks. |
| S5 Sat 24 Oct at Elora, Dolomites last selected | **PASS** | [design-today-phone-t1](scenario-check/design-today-phone-t1.png) frame 1: "TODAY · Sat 24 Oct", travel-day note "Opened Elora… You were planning Dolomites" with a Dolomites button. | **FAIL** | [proto-s5-today-dolomites-selected](scenario-check/proto-s5-today-dolomites-selected.png) | Prototype Today is a simulated Dolomites day 3 (Thu 15 Jul) for whichever trip is selected; no travel-day override, no banner. Migration: components 5.4 travel-day banner, Today resolves the trip by date first. |
| S6 Tasks inside Dolomites | **SPEC ONLY**, and only in recommendation.md | recommendation.md 3 and 5 ("2 more due this week in other trips"). Not in components.md 3.5 or patterns.md; no Tasks template. | **FAIL** | [proto-s4-s6-tasks-dolomites](scenario-check/proto-s4-s6-tasks-dolomites.png) | Prototype shows only Dolomites tasks (good) but no person checks and no cross-trip link; header says "1 of 15 done" while the tab says "1/12". Fix (design, N1): add the cross-trip link and the Tasks page template to the foundation. |
| S7 February budgets, Costa Rica and Patagonia | **SPEC ONLY** | patterns 4.1 (Year view, spend per currency, CAD and USD separate). Not drawn in Trailhead (recommendation points to Atlas and Altimeter drawings). | **FAIL** | [proto-s7-budget-dolomites](scenario-check/proto-s7-budget-dolomites.png), [proto-s7-year-view](scenario-check/proto-s7-year-view.png) | Per-trip budget exists for Dolomites only (CAD with EUR converted). Year view shows one total "$9.4k / $16k" with no currency split and no booking windows. Fix (design, N3): a Year view component spec (rows, windows, money column per currency). |
| S8 Phone, one hand, car park | **PASS** | design-today-phone-t1 and [design-plan-phone-t1](scenario-check/design-plan-phone-t1.png): trip photo "Switch" first in the bottom bar, Navigate in the lower half, top bar names the trip; sizes corrected in components 1.4 (review I10). | **FAIL** | [proto-s8-phone-bookings](scenario-check/proto-s8-phone-bookings.png), [proto-s8-phone-plan](scenario-check/proto-s8-phone-plan.png) | Prototype names the trip in the top bar (text only, no photo or colour), but the switcher is top-left, out of thumb reach; the bottom bar is Trips, Plan, Today, Bookings, Tasks, More. Migration: components 1.4. |
| S9 Partner opens a shared Patagonia booking link | **SPEC ONLY** | patterns 1.2 (`/t/<slug>/bookings/<id>`), 4.7 (view-only chip, guest banner), components 1.1 guest header. | **FAIL** | [proto-s9-share](scenario-check/proto-s9-share.png) | Prototype URLs are `#bookings` with the trip in localStorage; a link cannot carry trip or booking. Share has viewer/editor roles (good). Fix: B1 first; migration: router with trip slug and item id. Design gap (N4): say what a signed-in **editor** (the partner) sees on that link versus a guest. |
| S10 Done trip (Vermont) | **PASS** | home.html "Done 3 · templates", each "read-only" with "Use as a template" ([design-home-t2](scenario-check/design-home-t2.png)); switcher footer "Done (3) →". | **FAIL** | [proto-s10-past-trips](scenario-check/proto-s10-past-trips.png) | Prototype hides done trips from the switcher and lists them under "Past 3" (good), but opening one goes to an editable empty Plan with "Start from a template", not a read-only trip with "Use as a template". |

## 2. The nine rules

| Rule | Design | Evidence | Prototype | Gap and fix (prototype migration unless marked design) |
|---|---|---|---|---|
| 1 One trip in context, always visible | **PASS** | trip bar on plan, bookings-switch; phone top bar on both phone pages; components 1.2 fixes the drawer overlap (I3) | **FAIL** (desktop partly met) | Desktop trip header stays on scroll ([proto-r1](scenario-check/proto-r1-bookings-scrolled.png)) with name, dates, phase, but no photo or identity colour and no Share tab; the rail truncates the name to "DOLO…". Phone: text only. Build components 1.2 and 1.4. |
| 2 Switching is one action and keeps your place | **PASS** | bookings-switch frames 1-3; components 1.3 restores last tab, scroll, map day; Back toast 8 s | **FAIL** (keeps the tab) | No per-trip memory of tab, scroll or map day; rows lack next deadline; no Back toast; ideas mixed with in-progress. |
| 3 Every trip has an identity | **PASS** | photo + Okabe-Ito ring/bar/square with keyline everywhere (tokens 4) | **FAIL** | Identity is a CSS pattern "tone" (relief, lake, ice, forest…), several trips share one, so two trips are told apart by name. Assign photo + identity key per trip. |
| 4 Nothing silently in the wrong trip | **PASS** | drawer header and "Save to Patagonia", "Files under · matched by the dates · Change" (bookings-switch frame 2); patterns 4.3 | **FAIL** | Form never names the trip; Needs-you "Open" acts on the last-selected trip; no Move to another trip. |
| 5 Cross-trip views summarise | **PASS** (Year view spec only) | Needs-you columns, three verbs only | **FAIL** | Rows not grouped by trip, one verb, Open lands in the wrong trip; Year view has no per-currency spend. |
| 6 Person-level items shared | **PASS** | Aarav column; task row "shared with Patagonia" | **FAIL** | No person entity. |
| 7 Today belongs to the trip in progress | **PASS** | today-phone frame 1 | **FAIL** | No date-based trip resolution. |
| 8 Reminders name the trip | **SPEC ONLY** | patterns 4.5 (push, email, inbox copy); drawn only as needs-you rows and the switch toast | **FAIL** | Reminder ladders in Tasks read "A week before it opens" with no trip; no notification surface. |
| 9 URLs carry the trip | **SPEC ONLY**, with a conflict | patterns 1.2 vs rule 9 example vs recommendation.md 2 (B1) | **FAIL** | `#screen` only. |

## 3. Must-keep list (keep-from-live-site.md)

Live-site reference shots: [live-site/](live-site/) (trips.png, places.png, places-table.png, places-list.png,
globe.png, taken 18 Oct 2026). "Spec" means kept in the foundation's words but not drawn.

| # | Item | Design | Evidence | Prototype today |
|---|---|---|---|---|
| 1 | Real hero photos on every card | kept | design-home-t1/t2, public-trip | lost (pattern tones) |
| 2 | Display title, two lines when long | kept | home.html Chamonix, components 3.1 | kept (smaller) |
| 3 | Dates, nights, route in small mono | kept with change: one line, truncate (review I4) | components 3.1 | kept, sans not mono |
| 4 | Countdown chip and link chip | kept with change: countdown neutral; "Legacy page" becomes "Public page" | patterns 3.3 | countdown kept, no link chip |
| 5 | One-sentence serif summary | kept | home.html | lost |
| 6 | Search with `/`, live count | kept | home.html "12 trips"; components 2.10 | lost on Trips (only plan search has `/`) |
| 7 | Filter pills When, Source | kept | home.html When, Phase, Who, Source | changed to phase chips |
| 8 | Group by, Sort by with direction, group headings with counts | kept | home.html subbar | lost (fixed groups) |
| 9 | Cards, List, Table, Map; selected solid accent | kept | home.html, components 2.9 | Map view lost |
| 10 | Top bar: brand, section tabs underlined, theme toggle | kept with change: tabs Trips · Places · Globe; **"About the data" leaves the header** and becomes a strip on the home page (patterns 3.1); Sign in added | components 1.1 | rail instead of top bar |
| 11 | Places filter pills: Country, Kind, Status, Kids, Season, Tag, Plan | kept | [design-places-t1](scenario-check/design-places-t1.png) | lost ([proto-explore](scenario-check/proto-explore.png) has preset chips) |
| 12 | Cards with photo or kind glyph | kept with change: glyph ink on a well, no teal | components 3.1, specimen | lost |
| 13 | Area chain on each card | kept (spec for cards; drawn as the table's Area column) | components 3.1, places.html | partial ("Ampezzo") |
| 14 | Chips: kind with icon and colour, status (Idea dashed), season, kids | kept with change: kind keeps icon, loses hue (C6) | components 2.8 | lost |
| 15 | Honesty markers and source counts | kept | places.html: Unverified, No source yet, Location unconfirmed, "Instagram post +1" | lost |
| 16 | Footer links Place page · Globe | kept, spec only | components 3.1 | lost |
| 17 | Grouped by country, sticky header, count | kept | places.html "ITALY 10 of 10" | lost |
| 18 | Table tools: saved views, columns, density, CSV; collapsible groups; columns incl. right-aligned elevation | kept with change: density is a Compact / Comfortable segment; region and area merged in one Area column | places.html, components 4.2 | lost |
| 19 | Map view with URL state | kept, spec only | patterns 1.2 | lost |
| 20 | 3D globe with relief, drag, zoom, hover facts, fly-in, country-state-district drill | kept, spec only (C4) | patterns 3.2, components 7.2 | lost (no globe) |
| 21 | Style switcher, 3D terrain with relief slider, auto-spin | kept, spec + specimen control card | components 7.2, specimen "Map and globe" | lost |
| 22 | Saved-place pins, side panel by country with flags and counts | kept, spec only | components 7.2 | lost |
| 23 | Search a country, state, city, sea or range that flies to it | kept, spec only | components 7.2 | lost |
| 24 | Breadcrumb chip and hint bar | kept, spec + specimen | components 1.5, 7.2 | lost |

Nothing is lost in the design. The prototype keeps almost none of it, which is why the public site should be
built from the foundation and the live site, not by restyling the prototype's Trips, Discover and Explore.

## 4. Product direction: can the public site be built from the foundation?

| Public surface | Template in the foundation | Drawn? | Missing before or while building |
|---|---|---|---|
| Home / inspiration (`/`) | patterns 3.1 | no | Phone layout; what the globe cover does on a phone (static image or live); the "About the data" strip's content. Non-blocking. |
| Globe, full screen | patterns 3.2, components 7.2, tokens 5 | control card, hint bar and chip in the specimen; page not drawn | B4 (pin colour). The map-stack decision (product-direction step 2) decides the globe engine; tokens assume OpenFreeMap + Mapterhorn. Pin data contract (places + published trips, count source). |
| Trip search (`/trips`) | patterns 3.3 | yes, as the signed-in home (home.html) | Public header variant (C3) only in words; Table columns listed. Non-blocking. |
| Trip detail, categorised + chronological | patterns 3.4 | **no**; public-trip.html is superseded for structure (chronological only, no Export) | **B5** category mapping. Phone layout of the strip and By day / By category. |
| Place and trail detail, all kinds | patterns 3.6 | trail only (trail.html) | Facts for the other kinds are one sentence for five kinds; `research/method/kinds/` has fifteen profiles. Map each kind profile to the glance strip and left column. **Distance and directions** (product direction: "maps for distance and directions") have no component: add a "Getting there" block (from a typed origin or the user's base: drive time, distance, open in Google Maps link) once the map stack is chosen. Non-blocking for the first build; blocking for "done". |
| Copy and export | patterns 3.7 | no (public-trip.html has Copy, no Export) | Copy sheet and export menu not drawn; PDF layout unspecified beyond "reading order". Non-blocking. |
| Search, 404, empty, error | components 2.10, 6.1-6.3 | specimen | none |

Missing to start the public site: B1, B4, B5. Everything else can be wireframed in the prototype itself,
which is the next step in product-direction "Order of work" anyway.

## 5. Consistency and slips

### 5.1 Dates and counts

Checked with a script against Sun 18 Oct 2026; every weekday in the foundation and previews is right except
the first row.

| Where | Says | Should say |
|---|---|---|
| redesign/trailhead/home.html title block | "Monday 18 October" | "Sunday 18 October" (patterns 4.1 already has it right; review P1) |
| foundation/specimen.html, Rows, needs-you column ([crop](scenario-check/design-specimen-needs-you-row-date-slip.png)) | "Sat 31 Oct · in 6 days", drawn in `--crit` | "Sat 31 Oct · in 13 days", in `--warn` under B2 (neutral under the current 7-day rule) |
| same | "Sun 15 Nov · in 21 days" | "in 28 days" |
| specimen booking cards; bookings-switch.html frame 2 | "Book by Sat 31 Oct" in coral | 13 days out: caution under B2 |
| specimen booking cards | Tre Cime toll slot chip "Window open", "Opens Tue 15 Jun" | the window opens 15 Jun 2027; on 18 Oct 2026 it is "to book" (neutral), not open |
| components.md 2.4 | date-picker tooltip example "long weekend: Halloween" | Halloween is not a statutory holiday; use Thanksgiving (Mon 12 Oct 2026) or Family Day (Mon 15 Feb 2027) |
| redesign/trailhead/places.html | "64 places" | groups show Italy 10 + Canada 22 + United States 25 = 57 |
| redesign/trailhead/home.html, Iceland card | "4 – 15 Sep 2027, 11 nights, Ring Road · 11 nights" | nights once |
| prototype `screens/tripsutil.ts` | `TODAY = 2026-10-17` while `Tasks.tsx` and `trails.ts` use 18 Oct | one shared today; it causes "in 14 days, Sat 31 Oct", "in 2 days, Mon 19 Oct" (tomorrow), "in 7 days" for Elora (6) and "today, Sat 17 Oct" on Home |
| prototype Tasks | header "1 of 15 done", tab "1/12" | one count |
| prototype Budget and Bookings sample | Air Canada tickets dated 2 Mar 2027 in the Dolomites trip | July dates, or move to Patagonia (it is the S3 mistake in the sample data) |

### 5.2 Foundation documents disagreeing

| # | Topic | tokens.md / tokens.json | components.md | specimen.html | Fix |
|---|---|---|---|---|---|
| 1 | Urgent threshold | `--crit` inside 7 days | 7 days (3.3, 3.4); **14 days** in the switcher (1.3) | crit at 13 days | B2 |
| 2 | Display sizes | eight steps only | 18, 21, 22, 34, 52 also used | 18, 20, 21, 22, 30, 34 also used | B3 |
| 3 | Minimum text 11.5 px | rule in 6 | badge count mono 10 (1.4); map attribution mono 11 (7.1); elevation axis mono 11 (4.4) | badge 10, phone day strip 10.5, gallery credit 11 | raise to 11.5 or record the exceptions (badge digits, attribution) |
| 4 | Radius steps 4, 6, 8, 12, 16, 18 | rule in 7 | 10 for booking card, banners, lifted plan row | 10 (legend, late toggles, day strip), 14 (leave-by card), 6 for `.selbox` where 2.3 says "styled like an input" (8) | add `--r-10` or use 8/12 |
| 5 | Hex in components | "Components never contain a hex value" | drawer kicker `#F0B356`, primary hover `#C98A22`, danger text `#FFFFFF` | same | add `--accent-hover`, `--on-crit-fill`, `--kicker-on-photo` tokens |
| 6 | Kicker colour on photos | review I8: white at 80% | drawer kicker is amber `#F0B356` (5.1) | amber | white at 80%, as the cover kickers |
| 7 | Side sheet size | | 460 px wide, 140 px photo, title 34 | 420 px, 120 px, title 30 | pick one |
| 8 | Amber uses | 3: selected, now, primary | elevation line and area; globe pins at rest | same | B4 |
| 9 | Tab and button type | `--t-mono` 13/500, `--t-time` 13.5/600 | header and trip tabs mono 13.5/500 | 13.5/500; search field 17 px (inputs are 16) | add `--t-tab` 13.5/500; search 16 |
| 10 | Done check in dark | `--ok` dark `#8FD0A0` | 3.5 says a 24 px round check, no colours | `.ck.on` fills `--ok` with a white check: **1.8:1 in dark** (6.5:1 light) | check glyph `--bg` on `--ok`, or `--ok` check on `--ok-soft`; add the pair to tokens 2.2 |
| 11 | Identity ring width | 2.5 px ring | 1.4 says 2 px ring on the bottom bar photo | 2 px | state the bottom-bar exception or use 2.5 |
| 12 | Phone header height | `phone-topbar-h` 64 | 1.1: 56 px outside a trip; 1.4: 64 px on trip screens | 64 | add `phone-header-h: 56` to tokens.json |
| 13 | Names and routes | | patterns 1.1 renames Discover to Trips and the signed-in Trips to Home | previews still show a Discover tab | recommendation.md 2 still uses Discover; mark superseded (part of B1) |

## 6. Design gaps for the planner (N1-N6, before the planner build)

| # | Gap | Fix |
|---|---|---|
| N1 | S6 cross-trip link and the Tasks page exist only in recommendation.md | add a Tasks template (grouped by month, booking windows, person checks, "2 more due this week in other trips") to patterns.md 4 and the link to components 3.5 |
| N2 | No Inbox / forwarded-email review template (S3) | patterns.md 4: inbox row, parsed fields, suggested trip from dates, Change, Move |
| N3 | Year view only one sentence (S7) | component: trip rows on a 12-month axis, booking windows, spend per currency |
| N4 | S9 editor vs guest on a shared item link | patterns 4.7: signed-in member lands with their role; guest gets the view-only header |
| N5 | People page (passports, memberships) has no template (S4) | patterns.md 4 |
| N6 | Notification centre (rule 8) has no template | patterns.md 4.5: list anatomy with trip photo ring, grouping, open-in-context |

## 7. Screenshots

All in [scenario-check/](scenario-check/). Design: `design-home-t1/t2`, `design-bookings-switch-t1/t2`,
`design-today-phone-t1`, `design-plan-phone-t1`, `design-public-trip-t1..t3`, `design-places-t1/t2`,
`design-specimen-needs-you-row-date-slip`. Prototype: `proto-s1-*`, `proto-s2-1..4`, `proto-s3-*`,
`proto-s4-s6-*`, `proto-s5-*`, `proto-s7-*`, `proto-s8-*`, `proto-s9-*`, `proto-s10-*`,
`proto-r1-bookings-scrolled`, `proto-public-trip-t1`, `proto-discover`, `proto-explore`.
