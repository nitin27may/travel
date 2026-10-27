# Patterns (18 Oct 2026)

Navigation, layout, page templates, flows, states and choreography. Components are in
[components.md](components.md); values in [tokens.md](tokens.md). The public read-only site is the primary
surface and is specified first; the planner reuses every template.

## 1. Navigation

### 1.1 Decision: top bar, not a rail

Both the public site and the planner use the **60 px top bar** (components 1.1). The desktop rail from the
prototype is dropped: it mixed global and trip areas into fourteen equal icons and truncated the trip name.
Trip areas live in the **trip bar** (components 1.2) under the header. Reasons: the public pages already use
a top bar and the owner likes them; a rail costs 76 px of width on Plan where the map needs it; the trip
chip in the header is a better switcher than a rail module.

| Surface | Header tabs | Trip areas | Phone |
|---|---|---|---|
| public (signed out or in) | Trips · Places · Globe; cluster Search · Theme · Mine · Sign in or avatar | none (public trip page has in-page anchors) | header brand · Search · Sign in or Account · Theme; bottom bar **Trips · Places · Globe · Search · Mine** |
| signed in, planner stage, outside a trip | Home · Trips · Places · Globe | none | bottom bar Home · Trips · Places · Mine · More (Globe first in More; Q207, decided with the analytics then) |
| signed in, inside a trip | same, with the trip chip | trip bar: Plan · Today · Bookings · Tasks · Budget · Share | top bar names the trip; bottom bar [photo] Plan · Today · Bookings · More |

**Mine** (NAV-F, 26 Oct 2026; owner Q200 to Q207) is the visitor's own place: copied trips and favourites, kept in
this browser when signed out and in the account when signed in, at `/mine/` (3.8). There is no More menu on the public
site: every secondary item (units, About the data, Terms, Privacy, Report or suggest) is in the footer of every page and
the theme is in the header. Globe stays a main item on phone and desktop. Decision record:
[navigation-and-mine.md](../../features/navigation-and-mine.md); measurements:
[mine-and-bar-spec.md](../shell/mine-and-bar-spec.md).

"Discover" from the recommendation is renamed **Trips**: for a visitor the published trips *are* the
trips. The signed-in household's own trips are **Home**. Names people already know beat a new noun.

### 1.2 URLs: the one table

This table is the only place URLs are defined. trip-scope-scenarios.md rule 9, recommendation.md 2 and
every component follow it; where an older page differs, this table wins. Public URLs are shared and
bookmarked, so they never change after launch; the planner lives under `/t/` so that `/trips/...` always
means a public, read-only page.

| Surface | URL | Example |
|---|---|---|
| Home / inspiration | `/` | |
| Trips search | `/trips` + list state | `/trips?when=2027&country=it&view=table&group=year&sort=start&dir=asc&page=2` |
| Public trip page | `/trips/<trip-slug>`; anchors `#day-3`, `#stays`, `#trails`, `#sights`, `#activities`, `#food`, `#logistics`; timeline keys in this order, defaults omitted (features/trip-timeline.md 3.8, codec `core/src/schedule/profileCodec.ts`): `p=` party (`adults`, `family-<youngest age>`), `pace=` (`relaxed`, `standard`, `full`), `a=1` one adult, `walk=` longest walk in km, `split=1` parallel lanes, `d=` per-day variant overrides (`5C,9A`), `add=` visitor additions `<day>.<place-slug>` in insertion order; then `view=category` for the By category segment. Unknown values fall back silently; an `add` slug that no longer resolves is dropped with a note. **From UXB-1 (3.10):** `view` names the page tab: omitted = Summary, `day`, `table` (Days in its Table view), `all` (Stops; `category` stays an alias), `bookings`, `photos`; then `rows=stops` (Table's Stops only); `a` widens to `a=1` to `a=12` (default 2, omitted); `#day-N` with no `view` opens Days and a category fragment opens Stops; OVR's `tab=` is the sub-tab inside Stops | `/trips/canadian-rockies-2029?p=family-4&pace=relaxed&d=5C&add=5.pyramid-lake#day-5`; `/trips/canadian-rockies-2029?view=bookings` |
| Places search | `/places` + list state | `/places?q=lake&kind=trail,lake&status=planned&kids=yes&season=jul&tag=photo&plan=dolomites-2027&view=table&group=country&sort=area&dir=asc&page=2` |
| Public place or trail page | `/places/<place-slug>` | `/places/tre-cime-di-lavaredo-loop` |
| Globe, world | `/globe` | |
| Globe, country / state / district | `/globe/<country>[/<state>[/<district>]]` (ISO 3166 code for the country, URL slugs below it; the resolver also accepts the ISO code of a state, `it-32`, so a renamed node keeps old links) | `/globe/it/south-tyrol/pustertal` |
| Globe, place | `/globe/place/<place-slug>` (flies in, opens the selection card) | `/globe/place/lago-di-braies` |
| Globe, trip | `/globe/trip/<trip-slug>` (fits the route, pins in the trip ring when signed in) | `/globe/trip/patagonia-2027` |
| Globe, basemap feature | any globe URL plus `?f=<class>:<id>` (class in river, lake, sea, peak, range, park, city; id the Wikidata QID or the name): the feature card floats, the level does not change. `replaceState`, optional, never needed to resolve the page | `/globe/it?f=lake:Q13364` |
| Mine | `/mine/`; `?show=trips` or `?show=favourites` selects the tab (`replaceState`); Favourites adds `kind`, `country`, `sort`, `page` in the list-state order; `/favourites/` redirects to `/mine/?show=favourites`. Private, noindex, never under `/trips/` | `/mine/?show=favourites&kind=lake` |
| Globe, filters | `?show=trips` or `?show=places`, and `?kind=trail,lake` when places are shown; list-state order rule below | `/globe/ca?show=places&kind=trail` |
| Plan builder (proposed, TB-N; behind `planBuilder`) | `/plan/` only, noindex, out of the sitemap; the step and mode are query keys, never path segments (trip-builder 2.5, ISO-1): `m`, `cc`, `rg`, `from`, `r`, `n`, `p`, `f`, `act`, `sea`, `d`, `pace`, `mv`, `mo`, `b`, `o`, `gw`, `s`, `draft`, `seed`. Party, interests and device location never appear | `/plan/?m=near&from=hub-toronto&r=180&n=2&s=3`, `/plan/?seed=dolomites-2027` |
| Planner home | `/home`; `?view=year` for the Year view; `?due=week` for Needs-you, all trips | `/home?view=year` |
| Trip (last tab) | `/t/<trip-slug>` redirects to that trip's remembered tab | `/t/patagonia-2027` |
| Trip tab | `/t/<trip-slug>/<tab>` with `tab` in plan · today · bookings · tasks · budget · share | `/t/patagonia-2027/bookings` |
| Plan, a day | `/t/<trip-slug>/plan?day=3` | |
| Item inside a tab (opens the sheet) | `/t/<trip-slug>/<tab>/<item-id>`; item ids are prefixed and opaque: `it_` plan item, `bk_` booking, `tk_` task, `ex_` expense | `/t/patagonia-2027/bookings/bk_7f3a`, `/t/patagonia-2027/tasks/tk_2c91`, `/t/dolomites-2027/plan/it_9d0e` (day inferred) |
| Shared link | the planner URL plus `?share=<token>`; a guest keeps `share` while moving inside that trip; a signed-in member of the trip is redirected to the plain URL with their own role (N4) | `/t/patagonia-2027/bookings/bk_7f3a?share=k9QwL3` |
| Cross-trip pages | `/inbox`, `/people`, `/people/<person-id>`, `/settings` | `/people/pe_kai` |
| Not found | any unknown path renders the 404 template (components 6.3) at the requested URL | |

Rules. **Slugs**: a trip slug is the kebab-case name plus the start year for dated trips
(`patagonia-2027`, `elora-gorge-2026`); an undated idea uses the name alone (`peru`) and gains the year when
it is dated, with the old slug redirecting. A place slug is the kebab-case name, disambiguated by its area
when two share a name (`moss-glen-falls-stowe`, `moss-glen-falls-granville`). **List state** is always in the
query string with keys in this order: `q`, filters (`when`, `source`, `country`, `kind`, `status`, `kids`,
`season`, `tag`, `plan`; `k=<type id>` and the contract's `f.<facet>` follow the base filters, sorted), `view`, `group`, `sort`, `dir`, `page`; defaults are omitted, multi-values are
comma-separated. **The filter bar** shows four pills, or six when a Kind is chosen (the Kind's two promoted facets); the rest sit under "More filters". **Sheets** are path segments, so Back closes a sheet and returns to the tab; nothing opens
in a sheet without a URL. **Map view** of a list carries `?view=map&c=lon,lat,zoom`; the globe adds the same
`c=` for camera as `c=lng,lat,zoom[,pitch,bearing]` (pitch and bearing because the fly-in tilts; both omitted when
zero), written with `replaceState` at most every 400 ms after `moveend`, optional and never required to resolve a
link. Globe key order: `f`, `show`, `kind`, `c`. A link never opens the wrong trip (rule 9):
the trip slug is in the path of every trip-scoped URL, and an item id that belongs to another trip is a 404,
not a redirect.

### 1.3 Keyboard layer (desktop)

`/` search · ⌘K switcher and jump · ⌘[ previous trip · N add in the current trip (booking, task or
expense by tab) · ⌘Z / ⌘⇧Z undo and redo · ⌘1 to ⌘6 trip tabs · ? shows the list. Shortcuts never fire
inside inputs.

## 2. Layout grids

- **Public list pages** (Trips, Places): page title block (title 72, intro serif 19, actions right) ·
  toolbar (search 300, pills, view segment right) · subbar (count, group by, sort by, direction) ·
  groups with sticky headings · grid 4/3/2/1 or table · pager · credits footer.
- **Plan** (desktop): outline 256 (`--well`) · document 620 to 680 · map fluid (≥ 38%). The divider is
  draggable and remembered; the map collapses to a 48 px strip, never hidden. Tablet: document + map, the
  outline becomes a day strip under the trip bar. Phone: one day per page with the day strip, map as a
  bottom sheet.
- **Trip tabs other than Plan**: a 12-column page with a 620 to 900 px content column; drawers open on
  the right under the trip bar.
- **Detail pages** (public trip, place, trail): full-bleed cover · glance strip overlapping the cover by
  46 px · two columns 1fr / 400 px (phone one column; the sidebar's "In Dolomites" card and map move to
  the top).
- **Globe**: full-bleed canvas under the header; everything else floats (components 7.2).
- Max content 1376 px; 32 px margins; 14 px on phone. No horizontal page scroll at any width.

## 3. Page templates, public

### 3.1 Home / inspiration (`/`)

Cover: the globe, live, at 60% height with the search field centred and the hint bar; pins by continent.
Under it: "Trips" strip (6 published trip cards, newest first, "All 14 trips →"), "Places worth a trip"
strip (8 place cards with the kind glyph and area chain), "About the data" one paragraph with the honesty
markers explained. No sign-in prompt above the fold; "Sign in" is in the header only. First paint under
1.5 s on a mid-range phone: the globe loads after the first strip. The search field never makes the page wider than
the viewport (at 320 px it truncates its placeholder; a 338 px overflow was measured on 26 Oct, mine-and-bar-spec 11).

### 3.2 Globe (`/globe`), full screen

Canvas under the header, controls as components 7.2. States: **World** (auto-spin on, pins as country
counts), **Country** (flown in, state pins, panel lists the country's places), **State** (district pins),
**Place selected** (selection card). Search flies to any country, state, city, sea or range. Selecting a
pin opens the selection card, never a new page; "Open place" or "Open trip" goes to the detail page and
Back returns to the same camera. Signed in: the household's trips appear as pins in their identity rings
("Patagonia · 26 Feb"). Phone: the panel is a peek sheet (120 px) listing countries; the control card is a
single "Map options" button opening a sheet.

### 3.3 Trips search (`/trips`)

The live Trips page, re-coloured. Toolbar: search, When, Source (and Country, Kids added), four views.
Groups: Upcoming, Past as templates (desaturated photos, "Use as a template" when signed in). Cards: photo,
title, meta (dates, nights, route) one line, neutral countdown chip and "Public page" link chip, serif
summary. Table view columns: title, dates, nights, countries, bases, drive per day, kids, copied. Map view:
one pin per trip at its first base with the cover photo in the selection card.

### 3.4 Trip detail (`/trips/<slug>`), categorised and chronological

Full design: design/trip-page/timeline-design.md (its section 10 is the list of changes applied here); model and
URL keys: features/trip-timeline.md.

**Amended 26 Oct 2026 (UXB-N, owner-approved design G-UXA).** When UXB-1 ships, items 3, 5 and 6 below are replaced by the
tabbed template in **3.10**: the season band becomes "When to go" in the Summary, "The trip at a glance" becomes "The
trip's shape", and "In this trip" with its By day / By category segment becomes the Days and Stops tabs. Item 2 becomes
the collapsed party bar (3.10). Items 1, 4 and 7 stay. The category table and rules below stay and apply to the Stops tab.

1. **Cover** 620 px (phone 420): photo, gradient 10% to 88%, kicker white 80% ("Published plan · South
   Tyrol and Veneto, Italy"), title 96, standfirst serif 21, chips (14 days, 4 bases, drive 1 h 10 a day,
   moderate, kids from 8, by Nitin · copied 41 times), actions: **Copy to my trips** (primary), Export
   (menu: PDF, GPX, CSV, calendar), Share. The glance strip overlaps the cover by 46 px (section 2).
2. **Plan it for** (the party profile selector, timeline-design 3.2): one card, "Plan it for" + who is going
   (Adults · Family, youngest [age]), pace (Relaxed · Standard · Full), longest walk, units; it sets `?p=`,
   `pace=` and the rest of the timeline keys (1.2). Nothing is preselected on first visit except what the URL
   carries; the default plan is the one as written. **There is no per-day Track A / B / C control anywhere on
   the page**: the profile picks the variant for every day, and a per-day override lives in the day card (4.6).
3. **Season band**: "This plan is valid for" + the window in `--t-trip` (40), why, the 12-month strip
   (solid as written, hatched possible), weather tiles (sized to content), warnings.
4. **Sticky plan bar** (timeline-design 3.4) from the selector down: 52 px, `--bg`, hairline below,
   `--z-sticky`, under the header. Profile line (mono 12.5, "Planned for Family, youngest 6 · 14 nights ·
   Standard", Change in `--accent-text`), the **day rail** (one cell per day, `--t-sign-s` number over a 3 px
   bar whose width is the day's drive load, 44 px min, radius 8; the day in view is `--accent` with
   `--accent-ink`, the only amber at rest on the page because it is "now"), the unit switch (km | mi, desktop).
   On phone it wraps to two rows (about 88 px) and is the By day navigation; the category strip stays sticky in
   By category as written below.
5. **The trip at a glance** (timeline-design 3.3): the whole-trip strip, one column per day with base, drive and
   the day's shape, replacing the old "The route" map block. The **map** moves into a sticky column beside the
   days on desktop (1fr / 400 px) and a "Map · Day 1" bottom sheet on phone; all days by road, bases named,
   6 px stop dots; the day in view is the picked day on the map (route amber with the casing, numbered pins).
6. **In this trip**: a category strip of **six** chips with counts — **Stays 4 · Trails 9 · Sights 6 ·
   Activities 3 · Food 3 · Logistics 5** — above a segmented control **By day / By category**.
   - By day (default): one **day card per day** (timeline-design 4.1) with the quiet sign DAY 03, title, base ·
     drive, and its **per-day timeline always open**: time rail (`--t-time`), typed entries (components 4.3),
     legs as connectors, sun rows, the suitability chips on each entry, "Know before you go" collapsed under the
     card. Details expand per entry; the timeline itself never collapses. `#day-3` anchors. Entries whose times
     are rule-derived show the confidence styling of the time (timeline-design 4.2) and the honesty wording
     (trip-timeline 2.12).
   - By category: six sections in the strip's order; each item is a list row (components 3.2) with its
     kind glyph, name, area, the day sign it belongs to ("Day 3 · 11:30", with the same confidence styling of
     the time) and a link to its place page. Stays show nights and check-in; Logistics holds flights, car,
     tolls, slots and passes.
7. **Copy and export** repeated at the end, then credits and attribution.

Chronological order is never changed by the category view; category only regroups the same items. Tokens: no new
colour; the only new type use is `--t-time` on the rail. New components the page adds to components.md: party
profile selector, day rail, trip strip, timeline entry and leg (shared with 4.3), sun row, add row; they are
specified in timeline-design 3 and 4 until their components.md sections are written.

**Kind to category.** Six categories, not five: the research kinds (research/method/kinds/README.md)
store adventures and lifts as `activity`, not `place`, and they are the items a family checks limits and
booking windows on, so they get their own chip instead of hiding under Sights. Every one of the fifteen
kinds maps once:

| Kind (entity kind / subkind) | Category | How it reads in the row |
|---|---|---|
| stay (hotel, lodge, b_and_b, apartment, campsite, …) | **Stays** | nights, check-in, cancellation; the base town is the row's area, not an item of its own |
| hut with beds (`stay` / `hut`) | **Stays** | a hut night; a hut that is only a lunch stop is its `eatery` / `hut_kitchen` row under Food |
| trail (hike, walk, scramble, trek_stage, snowshoe, bike, paddle, via_ferrata_approach) | **Trails** | distance · climb · time; "starts at" names the trailhead; "by Seceda gondola" names a lift used only for access |
| trailhead | **Trails** | never its own row: it is the "starts at" line of its trail; a trailhead scheduled on its own (shuttle meeting point) is **Logistics** |
| parking | **Logistics** | always with what it serves: "P4 for Lago di Braies · reserve"; shown only when it is a booking or has a fee or fill time worth planning |
| viewpoint (viewpoint, summit, pullout) | **Sights** | light, walk from the car |
| lake | **Sights** | swim, boats, parking |
| waterfall (waterfall, canyon, gorge) | **Sights** | access walk when over 2 km |
| sight (museum, church, castle, landmark, old_town, market, garden, zoo, …) | **Sights** | hours, last entry, ticket |
| town, village, city | **Sights** when visited (old-town stroll, market morning); a base that is only slept in is not an item (see Stays) |
| swim spot, natural (beach, swim_spot, hot_spring) | **Sights** | with the lake or shore it belongs to |
| swim spot, ticketed (`activity` / hot_spring, thermal_bath) | **Activities** | price, hours, ages |
| adventure (zipline, via-ferrata, rafting, canyoning, glacier-walk, boat-tour, kayak, …) | **Activities** | operator, duration, ages and heights, booking window |
| lift (gondola, cable_car, chairlift, funicular, rack_railway, scenic_train) | **Activities** when it is the outing; folded into a Trails row when it only shortens the walk; a pass covering several lifts is **Logistics** |
| eatery (restaurant, cafe, bakery, hut_kitchen, winery, grocery, …) | **Food** | meal slot, booking if any |
| event, attended (festival, market, sport) | **Activities** | dates, tickets |
| event, affecting (closure, natural, holiday) | not an item: drawn as a warning on the day rows it touches and in the season band | |
| bookings that are not places (flights, car hire, tolls, slots, passes, transfers, insurance) | **Logistics** | book-by date coloured by tokens 3.1 |

Rules. **One item, one category**: the category comes from the item's primary entity; an item made of a
subject and its access (a lake and its lot) files under the subject and names the access in its row, and
the access becomes its own Logistics row only when it is a separate booking. **Counts** are distinct items in
the trip; a place visited on two days is one row whose day signs read "Day 3 · also Day 5". **Empty
category**: the chip shows "Food 0" at 45% opacity and is not clickable; the section is omitted in By
category and the anchor resolves to the top of "In this trip". **Tapping a chip** (desktop and phone)
switches to By category and scrolls to that section; in By day the chips are counts only. **Order** is
fixed: Stays · Trails · Sights · Activities · Food · Logistics (where you sleep, then the day's spine, then
the rest), never re-sorted by count.

**Phone.** The strip is one horizontal row of 32 px chips (44 px hit via padding) that scrolls sideways
with scroll-snap per chip and a 24 px fade at the right edge; no "More" and no select, because six chips
with counts fit in about 1.6 screens and the scroll is the whole gesture. In **By category** the strip is
sticky under the 56 px phone header (`--z-sticky`, `--bg` background, hairline below) and scroll-spies:
the chip for the section in view takes the active-filter look (`--accent-soft`, `--accent` border) and the
strip auto-scrolls to keep it visible. In **By day** the strip is not sticky; the day strip (components
pdst) is. Counts stay on the chips at every width. The By day / By category segment sits directly above
the strip and is 40 px, full width, two equal segments.

### 3.5 Places search (`/places`)

The live Places page, re-coloured: pills Country, Kind, Status, Kids, Season, Tag, Plan; four views; count;
group by country with sticky headers; cards with the kind glyph when there is no photo, area chain, chips
(kind, status, season, kids), honesty markers, footer links; table with the tools row; map with URL state.

### 3.6 Place and trail detail (`/places/<slug>`)

Cover 560 (trail) or 420 (place), kicker white 80% (Trail · Auronzo · Sesto Dolomites), title, summary,
actions: public **Save to a trip** (opens the switcher for signed-in users; for visitors a notice "Sign in
to add this to a trip" with Copy link and GPX), GPX, Share, then the **heart** (3.9). Glance strip: six facts, each with a value and
a **text** provenance line ("operator · read 18 Oct 2026"). Left: The route (elevation profile + hut list)
· Trailhead and parking (photo, facts, booking window callout with Remind me) · When to go · Who it suits
(fit chips, honesty chip). Right: "In Dolomites · Day 3" card (signed in, when planned), mini map, Hazards,
Links as tabs (Official 3 · Booking 1 · Route 4 · Conditions 3 · Report 1) with "every link checked
18 Oct 2026". Places of other kinds use the same frame with their own facts (lake: swim, boats, parking;
viewpoint: light, walk from the car; stay: nights, check-in, cancellation; activity: ages, duration,
booking window).

**Amended 26 Oct 2026 (UXB-N, owner Q300).** What a place page draws is decided by what is known: **3.11**. A section with
no value is not drawn, and empty link tabs are not drawn.

### 3.7 Copy and export

**Copy to my trips** (signed in, planner stage): a sheet asking only the start date (date picker with the shading; the
valid window pre-highlighted) and who is going (traveller toggles); the copy keeps days, not dates, and lands on the new
trip's Plan with a toast "Copied Dolomites · 14 days from Tue 13 Jul · Undo".

**Visitors** (NAV-2, now): the same sheet; nothing is preselected and the primary stays disabled until a date is picked
(L5). The copy is kept **in this browser** as one `copies/1` item per trip (a second copy of the same trip asks "You
already have a copy from Sat 3 Jul 2027. Copy again to replace it." **Replace** · Cancel; at most 20 per device) and
listed in **Mine › My trips** (3.8). Footer note, signed out: "Kept in this browser. Sign in to keep it on every
device." The done step leads with **Open in Mine** (primary), then the export list (calendar with the chosen dates,
PDF), then Done. Toast: "Copied Dolomites to Mine · 14 days from Sat 3 Jul" with **Undo**, and the Mine dot appears
(components 1.4). With storage blocked the done step leads with **Add to calendar** and says "This browser is not keeping
data, so this copy lasts until you close this tab. The calendar file keeps your dates." The word "saved" is never used
for a copy.

**Export**: PDF (the public page's reading order, credits included), GPX (routes and stops), CSV (stops with day, time,
kind, coordinates, links), calendar (.ics, one all-day event per day plus timed bookings).

### 3.8 Mine (`/mine/`)

The visitor's own page: copied trips and favourites, signed out or in. Full measurements, strings and acceptance
checks: [mine-and-bar-spec.md](../shell/mine-and-bar-spec.md) 5 to 12.

1. **Page head** "MINE" (`.page-head`, as `/trips/`).
2. **Account card** under the title on every width (first focusable controls in `main`): `--surface`, 1 px `--line`,
   radius 12, padding 12 16. Signed out: "Kept in this browser only." with **Sign in** and **Create an account** (both
   return to `/mine/`); one line from 640 px, text then buttons on two lines on a phone. Signed in: "Signed in as
   a@b.com" with **Account**. Sign-in off: the sentence alone.
3. **Tabs** My trips · Favourites with counts (components 2.9 tab variant; 44 px full width on phones). Default: the tab
   with the newest item; My trips when both are empty. `?show=` keeps the choice.
4. **My trips**: groups Upcoming (soonest first) · No date (signed-in plans) · Past (collapsed, "Past (3)"). Row
   (switcher row anatomy, components 1.3): photo 52 x 38 (identity ring signed in, keyline signed out), name `--t-row`
   with a 44 px `⋯` menu button on line 1 only, line 2 mono 12.5 "Sat 3 Jul 2027 · in 251 days", line 3 mono 12.5
   "14 days · 2 adults, 1 child"; lines 2 and 3 run under the menu column so both fit at 320 px. The row is the
   **Open** link (signed out: the public trip with the copy's profile restored by the codec; signed in with a customised
   copy: `/t/<id>/`). Menu: Open · Add to calendar · Print · Change dates · divider · Remove (`--crit`, last). Remove
   collapses the row (200 ms) with a "Removed Dolomites from Mine" toast and **Undo**, no confirm (4.4). Signed in, a
   neutral chip "On this device" or "In your account" shows only when the list mixes both.
5. **Favourites**: a segment All · Places · Trips with counts, then Kind, Country and Sort (Newest, Name; behind
   "Filters (n)" on a phone); list rows (components 3.2) with the kind glyph (never a photo: the snapshot has none, P8),
   name, mono meta ("Lake · Canada"), and the pressed heart at the right, which removes with Undo; two columns from
   1,024 px; 48 a page with the pager.
6. **No longer listed** (a copied or favourited item withdrawn from the catalogue): glyph `warn`, the name kept, the
   gap chip "No longer listed" (dashed `--line-2`, `--muted`), not a link, a **Remove** button in place of the menu or
   heart. Never removed silently.
7. **Empty states** (components 6.1): "No trips copied yet" · "Open a trip and choose Copy to my trips. It stays here
   with your dates." · **Browse trips**; "No favourites yet" · "Tap the heart on a place or a trip to keep it here." ·
   **Browse places**, Browse trips; storage blocked "This browser is not keeping data" · "Copies and favourites last
   until you close this tab. Sign in to keep them." · **Sign in**. The account card stays above them.
8. **Device notice** after the list, signed out only (banner 5.4, notice kind): "Your trips and favourites are kept in
   this browser only. Clearing browser data, using a private window or switching devices loses them, and some browsers
   clear site data after a few weeks without a visit. Sign in to keep them in your account." **Sign in** · **Got it**
   (snoozes for 30 days or until 10 more items).

Principles: the page answers "what have I kept, and is it safe" at a glance (P3: counts on the tabs, the card's one
sentence); detail is one tap away (P2: the row menu); nothing pushes sign-in as a gate (P7, visitor spec V2); the lists
are the visitor's own small data, not a catalogue load (P8, P9: only `web/lib/mine/**` reads storage).

### 3.9 Favourites: the heart on place and trip pages

The heart (components 2.11) sits in the cover's action row **after Share**, never before the primary action (P7): place
pages Save to a trip · Export · Share · heart; trip pages Copy to my trips · Export trip · Share · heart. On phones the
row wraps after the second button (measured at 390), so the heart sits beside Share. It mounts after hydration and
adds nothing to the server HTML. Toasts (components 5.3, above the bottom bar on phones):

| When | Text | Actions |
|---|---|---|
| first favourite on this device | "Added to favourites on this device. Sign in to keep them on every device." | **Undo** · **Sign in**, 8 s, once per device (sign-in off: "Added to favourites. They are kept in this browser." with Undo) |
| later | "Added Moraine Lake to favourites" | **Undo** |
| removed | "Removed Moraine Lake from favourites" | **Undo** |

Every add sets the Mine dot (components 1.4). A heart never adds anything to a trip, and Save to a trip never adds a
favourite (visitor spec 4.6).

### 3.10 Trip detail with tabs (UXB, bundle C)

Owner-approved design (G-UXA, Q293 to Q302): [features/trip-and-places-ux-fixes.md](../../features/trip-and-places-ux-fixes.md)
3 to 7, wireframes W1 to W9; component choices and the tabs analysis:
[trip-page/uxb-components-2026-10-26.md](../trip-page/uxb-components-2026-10-26.md). Replaces 3.4 items 2, 3, 5 and 6
when UXB-1 ships.

Order: **cover** (3.4 item 1; the "Valid for" stat becomes "Best time") · **party bar** · **tab bar** · the panel ·
"Take this plan with you" · credits.

1. **Party bar** ("Plan it for", collapsed by default): one row, "2 adults · 1 child (10) · Standard pace" and a pencil
   **Edit** (live disclosure, components 6.4) that opens the editor inline: Stepper (2.12) for adults and children, a
   select per child's age, pace (2.9), More. Party words come from one function shared with Mine. The party is kept on
   the device (`travel.party`); a link carries only `p=family-<youngest>` and `a`.
2. **Tab bar** (components 1.6): **Summary · Days · Stops · Bookings · Photos**, only tabs with content. Each tab answers
   one question: what is this trip and is it for me; what happens when; show me all the trails, stays and sights; what
   must we reserve; what does it look like. Map, Stays, Notes and Season are not tabs (the map is a column beside Days,
   Stops and Bookings and a sheet on phones; stays are the bases ribbon and the Stays chip; notes and season are Summary
   sections). Tabs by trip state: full and summary trips 3 to 5; an overview trip Summary · Photos; an overview with no
   gallery has no tab bar. Bookings is drawn with one booking or more; Photos with 6 licensed photos or more (Q307
   pending; until answered, with any gallery).
3. **Panels.**
   - **Summary** (default): What you will do · count cards (components 3.6) · Highlights (3.7) · When to go (hero, month
     strip 4.7, four equal cards, other weeks, worth knowing, weather links) · The trip's shape (bases ribbon, count line,
     per-day table behind a live disclosure) · Who it suits and Know before you go (safety lines at rest). Server-rendered.
   - **Days**: the Suggested times banner, the plan bar with the day rail, `[List | Table]` and, in Table,
     `Show [Everything | Stops only]`; day cards as 3.4 item 6, or one day table per day (components 4.6, lazy).
   - **Stops**: the six category chips with counts and, from OVR-2, filter pills (2.7) with live counts and one Clear all.
     Lazy.
   - **Bookings**: every booking grouped by day (by booking group after OVR-2), its rule and note; header counts; one
     "Prices: not checked yet" line, never a column of blanks; filters only above 12 rows.
   - **Photos**: the gallery by section with a credit line under each tile (4.5). Lazy.
4. **Sticky.** Desktop: the tab bar sticks under the header, and on Days the plan bar and on Stops the category strip stick
   under it. **Phones (under 640 px): one row sticks under the header**: the day rail on Days and the category strip on
   Stops (the tab bar scrolls away with the content above it, and back-to-top returns to it), the tab bar on the other
   tabs (owner Q303 pending; if no, both rows stick and the plan bar drops its party line on phones). The back-to-top
   button stays above the bottom bar and hides under an open editor. Switching tabs scrolls so the tab bar sits at its
   sticky line; never a jump to the top (P5).
5. **URL** (1.2): `view` names the tab; switching is `pushState` (Back returns to the previous tab); scrolling inside a
   tab is `replaceState`. Precedence on load: the URL's `view` or `#day-N`, then the tab remembered for this trip on the
   device (`travel.tripui`), then Summary. Mine's Open adds `view=day`. Links into tabs from the Summary (count cards,
   highlight day signs, shape rows) are real `<a href>` links; with script they switch the tab and move focus to the
   target heading.
6. **Keyboard**: components 1.6 (manual activation). Focus lands on the tab after a switch from the tab bar, on the target
   heading after a link.
7. **No script**: every panel renders in order with its heading; the tabs become in-page links.
8. **Print**: Summary, then Days (List, or Table when chosen), then Bookings when the trip has any (Q305 pending), never
   Photos or Stops, whatever tab is on screen.
9. **Budget**: no net trip start JS (spec D12): Summary, cards, month strip, ribbon and the gap lines are server HTML;
   the party editor, the shape's rows, the day tables, Stops and Photos are lazy chunks.

Principles: P2 and P3 (a first screen that answers "what is this trip", detail one tab or one disclosure away), P4 (plain
labels, counts, every option visible at 320), P5 (Back between tabs, no jump), P6 and T1 (when to go and bookings where
the decision is made), P7 (Summary first for the 90%), P8 and P9 (light summary data from the adapter, lazy chunks).

### 3.11 Place page: what is known first (UXB-7)

Spec [trip-and-places-ux-fixes.md](../../features/trip-and-places-ux-fixes.md) 8 and W10; owner Q300. Order:

1. **Identity**: breadcrumb, kind and area, name, summary when held, relevance badge, the completeness chip ("Early
   research · 30 of 32") with "What is not checked" linking to the gap block.
2. **Primary actions** (P7): Directions to the right point, Save to a trip, Export, Share, the heart.
3. **Glance**: only facts held, 6 to 8 by type; a glance fact is never repeated in a section row.
4. **Context**: the map with its honesty line, "In <trip> · Day n", Nearby (30 km), the official link.
5. **Type sections** in the template's order (Trail, Lake, Viewpoint and summit, Waterfall and canyon, Town, Park and
   area, Island, Offer: the W10 table), **each drawn only with a value or a safety gap**. Offers always show Limits.
6. **Not checked yet** block (components 6.5).
7. **Facts and sources**: a static disclosure (6.4) with sources and read dates, never the values again.

Links by group: tabs only when two or more groups hold links; one group is a plain list; an empty group is not drawn.
**Basics-only pages** (the `basics` level) use the compact template: identity, actions, map, nearby, trips and one "Not
researched yet" line. Principles: P2 (safety gaps at rest), P3, P6 (facts where they matter), P8 (the page shrinks).

### 3.12 Plan builder (`/plan/`), proposed (TB-N, pending owner approval)

Spec [features/trip-builder.md](../../features/trip-builder.md) and kinds
[trip-kinds-and-interest-profile.md](../../features/trip-kinds-and-interest-profile.md) 1; design, findings and mocks
[trip-builder/design-note-TBN.md](../trip-builder/design-note-TBN.md); components 9.

1. **One flow, eight steps**, kind first: Where or Start · Regions · Discover · Days (or Nights) · Bases (or Base) · Build
   · Getting there · Review. A kind skips steps (design note 2): the phone counts only steps that ask; the desktop rail
   shows every step, skipped ones done with their value.
2. **Phone: a focused flow.** Under 640 px the step header (components 9.1) replaces the public header and the action bar
   (9.4) replaces the public bottom bar while `/plan/` is open. Close keeps the draft and returns to the page the visitor
   came from (or `/`). One step per screen; the primary is always in the action bar, in the thumb zone (T2). Lists, map,
   filters and tray are sheets (9.3). No swipe gestures.
3. **Desktop: everything at once.** Header, the step rail (9.1) with the one primary at its right end, then panes:
   Discover is filters 232 · list 500 · map fluid · tray 300; Days and Bases share one screen (settings and bases 480 ·
   map); Build is the Plan grid (outline 256 · day 620 to 640 · map). Hovering a row lifts its pin and the reverse (P5).
4. **Live counts everywhere** (P4): the count line on Discover, "Show n places" on the start and filters, the tray's
   "about n days ≈". A zero count suggests the nearest match (6.1).
5. **Honesty**: every estimate carries ≈; thin and empty regions are shown with their count and "Ask us"; nothing
   unresearched is added; Did not fit lists every left-out pick with its reason and one fix (9.6).
6. **State**: the draft is on the device (`plan-draft/1`), the URL carries public keys only (1.2). Edits raise the Undo
   toast; Back goes to the previous asking step.
7. **States**: building (status card with progress, skeleton days), failed build (urgent banner, Try again, draft kept),
   offline (dashed notice, last build opens), estimates only (notice), paused (`PLAN_BUILDER_PAUSED`: notice, drafts
   read-only, Next disabled), no results, no picks, thin supply (design note 4).
8. **Review primary by kind** (P7): Add to calendar for day trips, weekends and long weekends; Save to Mine for a week or
   longer.
9. **Budget** (ISO-9): `/plan/` start JS at most 90 KB gzip; each step, the map and the editor are lazy chunks; no other
   page changes by a byte.

Principles: P1 (paged candidates, counts, park rows), P2 (safety and booking chips at rest), P3 (one step per screen on
a phone, everything at once on desktop), P4 (kind tiles, plain labels, live counts), P5 (linked list and map, no jump),
P6 (reasons where the choice is made), P7 (no header tab; the 90% pages unchanged), P8 and P9 (light rows, one data
boundary, no bulk).

## 4. Planner templates

### 4.1 Home (signed in)

Title block ("Sunday 18 October. Three trips are moving; one needs you tomorrow." from data), Needs you
this week as per-trip columns, toolbar, groups In progress · Planning and ideas · Done (templates), the
**Year** view as a fifth view segment: a horizontal timeline of every trip with its booking windows and
spend per currency (CAD and USD stay separate).

### 4.2 Plan

Outline (bases with photos and nights, days with drive time and warning dots, lists) · document (one-line
Next banner, add box, collapsed and open days, items, legs) · map. Picking a day anywhere (outline, map
chip, day header) sets the one focused day: amber sign, amber route and pins, outline row `--surface-2`.

### 4.3 Add and edit flows

- **Add from inside a trip** (N, the add box, "+"): the form opens as a drawer under the trip bar with the
  trip's photo header; Save names the trip.
- **Add from a cross-trip place** (Home, Inbox, a forwarded email): the first field is **Files under**
  with the trip suggested from the dates and a Change link; Save is disabled until a trip is chosen.
- **Edit in place**: titles, times, notes and facts edit inline on click (serif 17 → an input of the same
  size, no layout shift); Enter saves, Esc reverts; a pencil icon appears on hover and is always present
  on touch.
- **Move to another trip**: an explicit menu action with a confirmation sheet naming both trips; undoable.

### 4.4 Confirm and undo

Reversible actions never ask; they show a toast with Undo (6 s) and support ⌘Z. Only irreversible actions
confirm, inline and specific: delete a trip ("Delete Dolomites and its 9 bookings? It stays in Trash for 30
days."), revoke a share link, remove a person. The confirm sheet's primary is a danger button with the
object named; Cancel is first in tab order.

### 4.5 Reminders and notifications

Every notification names the trip first and opens it in context: "Patagonia · Book El Chaltén lodging ·
due Sat 31 Oct". Push: title is the trip, body is the task and due; tapping opens
`/t/patagonia-2027/tasks/tk_2c91` (1.2). Email: subject "Patagonia: book El Chaltén lodging by Sat 31 Oct",
one button to the same URL. Inbox rows carry the trip photo in its ring. Notification timing follows the
urgency rule (tokens 3.1): the ladder fires at caution (30 days), urgent (7 days), the day before and the
day a window opens. Notification centre template: 4.8 N6.

### 4.6 Offline and Today mode

Offline is a state the whole screen expresses: the dashed notice banner with the saved time and what is
cached; anything unavailable is shown greyed with "Needs connection"; queued edits get a clock mark; the
trip card shows "Offline ready · 84 MB · 2 days ago". Today mode: the leave-by card first, Navigate in the
lower half, running-late consequences before committing, sunlight theme available, the travel-day override
note (S5). On a travel day Today opens the trip in progress regardless of the last-selected trip.

### 4.7 Error and permission states

Inline errors replace the region, keep cached data visible and say what to do. Permission: viewers see the
trip bar with a "view only" chip and no add controls; editors see everything; a guest by link sees the
guest banner and Copy to my trips. Expired links: "This link expired on 1 May. Ask Nitin for a new one."
Who sees what on a shared item link is in 4.8 N4.

### 4.8 Before the planner: six templates still to write (N1 to N6)

The public site does not need these. Each is specified here in one paragraph so the planner build starts
from the same words; each becomes a full template (anatomy, states, phone) before its screen is built, and
nothing in them changes the public templates above.

- **N1 Tasks page** (`/t/<trip-slug>/tasks`, S6). Title block "TASKS · 1 of 12 done" (one count, the same
  as the tab's), filter segment All · Open · Mine · Person checks, "Add a task" primary (N). Body: task rows
  (components 3.5) **grouped by month** with a quiet month heading (`--t-sign-s`) and, inside a month, a
  drawn booking window where one exists: a 4 px `--line-2` bar from opens to closes with the open date
  labelled, turning `--warn` while open (tokens 3.1). Person checks sit in the month they fall due with the
  person's initial disc and "shared with Patagonia". Footer: the cross-trip line "2 more due this week in
  other trips →" to `/home?due=week`; omitted at zero. Done tasks collapse under "Done (4)" at the end.
  Empty: "Nothing to do yet. Tasks come from bookings and the plan, or add one."
- **N2 Inbox review** (`/inbox`, S3). One household address receives forwarded confirmations. A row:
  sender and subject (serif 16/600), parsed facts as mono chips (dates, place, money, code), and a
  **Files under** field pre-filled from the dates with "matched by the dates" and **Change** (switcher menu);
  when the dates match no trip, Files under is empty and Save is disabled until a trip is chosen (rule 4).
  Actions: **Add to Patagonia** (primary, names the trip), Not a booking, Open the email. Rows that could
  match two trips show both with the dates that matched and no pre-selection. After saving: toast with Undo
  and a **Move to another trip** item in the booking's menu (4.3). The bell count is the number of unreviewed
  rows plus urgent notifications. Phone: full-width rows, the review as a bottom sheet.
- **N3 Year view** (`/home?view=year`, S7). A horizontal 12-month axis (Big Shoulders month initials in
  `--t-sign-s`, today as a 2 px `--accent` line, the only amber) with one 56 px row per trip that is not
  done: photo in its ring and name left (sticky column), the trip's dates as an `--ink` bar with the identity
  bar beneath it, booking windows as hollow `--line-2` brackets labelled with the item ("Tre Cime slot ·
  opens 15 Jun"), book-by dates as 8 px dots coloured by tokens 3.1. Right-hand money column: **spend per
  currency on separate lines**, never summed across currencies ("CAD 4,212 · EUR 1,340"), with "≈" for
  estimates; a footer row totals each currency across trips the same way. Hover a bar: tooltip with phase,
  nights, next deadline; click opens `/t/<slug>`. Phone: the axis scrolls sideways under a sticky name
  column; money moves to a line under the name.
- **N4 Shared item link: editor vs guest** (S9). `/t/patagonia-2027/bookings/bk_7f3a?share=k9QwL3` resolves
  the token first. A **signed-in member** of that trip is redirected to the plain URL and sees the trip bar
  and that booking's sheet with their own role (editor: everything, including Edit and Move; viewer: the
  "view only" chip, no add controls). A **guest** (no account, or an account that is not a member) stays on
  the `?share=` URL with the guest header (components 1.1: "Shared by Nitin · view only", Copy to my trips,
  Sign in), the trip bar without Share and Offline, the booking open, and may browse that trip's tabs read
  only; secret codes stay "••••" with no Reveal. A signed-in non-member who is offered edit by the link sees
  "Join as editor" in the guest banner. Expired or revoked: 4.7.
- **N5 People** (`/people`, `/people/<person-id>`, S4). A card per traveller (initial disc 56 px, name,
  birth year and age on the next trip's dates, height and weight if entered, private). Under each: the
  person's documents and memberships as task rows with validity ("Passport · valid to Oct 2027 · too short
  for Dolomites" in `--crit` when a trip fails the six-month rule), and the trips they are on as identity
  chips. Editing a person-level item here updates every trip's linked check at once; the toast names the
  trips ("Updated in Dolomites and Patagonia"). Add a person; remove asks (4.4).
- **N6 Notification centre** (the bell, `/inbox` second tab "Notifications"). List rows 56 px: trip photo
  28 px in its ring, mono 12 due line coloured by tokens 3.1, serif 16 text that names the trip first
  ("Patagonia · Book El Chaltén lodging · due Sat 31 Oct"), right: Open (lands in context at the URL in
  1.2) and Snooze. Grouped Today · This week · Later · Done; unread rows have a 6 px `--ink` dot. Channels
  per notification are set from the task's reminder chip (8.2), not here. Clear all is per group and
  undoable.

## 5. Density and reading

Two densities, named: **reading** (public pages, cards, detail sidebars: 16 to 24 px padding, serif 16)
and **scanning** (outline, tables, bookings, needs-you, switcher: 8 to 12 px, rows 32 to 44, mono meta).
A screen uses one density per region and never a third.

## 6. Animation choreography

| Moment | What moves | Duration and curve |
|---|---|---|
| Page change (tab, list ↔ detail) | content cross-fades; header and trip bar stay | 220 ms `--e-out`; shared element for a card photo → cover when the image is the same |
| Sheet open / close | slides from the right (desktop) or bottom (phone); scrim fades | 260 / 200 ms, `--e-out` / `--e-in` |
| Menu, switcher, ⌘K | fade + 4 px rise | 200 ms |
| List reorder, move between days | items slide apart to open the slot (layout animation); the dragged ghost follows the pointer; drop settles with the spring; legs and totals count | spring 520/40; counts 300 ms |
| Add from search | the result row flies to its slot; the pin drops on the map at the same moment; the day's totals count | 300 ms move, pin drop 260 ms + settle |
| Map fly-to (outline click, day pick) | camera eases to the day's bounds; the picked route fades to amber as the others dim | 600 to 900 ms by distance; route colour 200 ms |
| Map pins | hover ring 120 ms; cluster split 200 ms; co-located fan-out 200 ms | |
| Globe | auto-spin 1 revolution per 90 s; on pointer down spin decays over 400 ms; drag has inertia (deceleration 2500, at rest within 600 ms); one fly-in per step, 1200 ms, with the tilt inside the last 15% of the zoom and the terrain ramp over the last 400 ms; hover styles 120 ms | resumes 20 s after the last interaction at world, 2 s after stepping out to world; off under reduced motion, where flights jump |
| Today | the next-stop card grows into place on arrival; leave-by counts when it changes | 300 ms |
| Toast | rise 200 ms, fade 160 ms | |
| Mine: tab change, row removed or restored | selected fill slides, panel cross-fades; removed row collapses, Undo expands it back | 200 ms `--e-std`; panel 120 ms |
| Heart toggled, Mine dot appears | heart fills and scales 1 to 1.15 to 1; dot scales from 0 | fill 120 ms, scale 200 ms `--e-out`; dot 200 ms `--e-out`; reduced motion: no scale |
| Theme switch | surfaces cross-fade; images do not flash | 200 ms |
| Trip page tab change (3.10) | the underline slides; the panel swaps without animation; the page keeps the tab bar at its sticky line | underline `--d-fast` `--e-std`; reduced motion: jump |
| Plan builder step change (3.12, proposed) | the new step cross-fades; header, rail and action bar stay; focus moves to the step heading; the rail's underline slides | `--d-page` `--e-out`; underline `--d-fast` `--e-std`; reduced motion: jump |
| Pick toggled; tray count | the pill fills; the bar's numbers count to the new values | fill `--d-fast`; counts `--d-count`; reduced motion: no count animation |
| Disclosure open or close (components 6.4); the party editor; the shape's table | content grows or shrinks in place (grid rows 0fr to 1fr); the chevron turns | `--d-base` `--e-std`; reduced motion: jump |

Never animated: text and border colour on status change, table rows, the trip bar, form validation.
Everything is interruptible; a second input cancels the first animation and starts from the current frame.
Reduced motion: fades of 120 ms, camera jumps, no spin, no shimmer.
