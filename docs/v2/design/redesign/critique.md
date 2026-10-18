# Why the prototype feels basic (18 Oct 2026)

The prototype is functionally rich: drag by handle, a real basemap, booking windows with reminder
ladders, a trail record with sources, offline state in Today. What the owner is reacting to is not
missing features. It is that every screen is drawn with the same three things: a white card with a
hairline, a grey pill, and a condensed capital headline. Nothing on screen tells you this is a trip to
the Dolomites rather than a tax return.

Screenshots are in [shots/current/](shots/current/), taken at 1440 x 900 and 390 x 844 from the dev
server on 18 Oct 2026 (light unless the file name says dark).

## The seven things that make it read as basic

| # | Problem | Evidence | What it costs |
|---|---|---|---|
| 1 | **No photography anywhere.** Trip cards use a procedurally drawn contour pattern or a grey relief crop; the public trip page has a 90 px strip of grey relief as its "hero"; place and trail pages have no image at all | `home-light.png`, `publictrip-light.png`, `place-light.png` | Travel is a visual subject. Wanderlog puts a photo on every place card (`reference/wanderlog-place-added.webp`). Without one, cards cannot be told apart at a glance and the product has no emotional pull |
| 2 | **One surface treatment for everything.** White card, 1 px line, 10 px radius, used for the "needs you" alert, trip cards, booking rows, task groups, budget totals and the trail facts | every shot | No hierarchy between "this blocks your trip" and "here is a fact". The eye has nowhere to land first |
| 3 | **Flat type scale with a single display trick.** Big Shoulders capitals at one size (TRIPS, BOOKINGS, TASKS, DOLOMITES) and Schibsted at 14-16 px for everything else. Card titles, row titles and section labels differ by weight only | `bookings-light.png`, `tasks-light.png`, `budget-light.png` | Pages look like forms. The condensed caps are the only identity, and repeated on every page they read as a template header rather than a signpost |
| 4 | **Colour is either absent or alarming.** Pink-red fills for "needs you" panels, crimson outlines on Today's next card, crimson day numbers; everything else grey. Day colours on the map are a random categorical set (orange, teal, mauve, olive) unrelated to the rest of the UI | `home-light.png` (pink alert slab), `plan-light.png` (map), `today-light.png` | Urgency is shouted with a filled pink slab, which makes three routine reminders look like an incident. The map palette fights the page |
| 5 | **Decorative patterns where content should be.** Concentric arcs and diagonal hatching on trip cards (`tone: relief / lake / steppe`) are generated texture, not information | `home-light.png` | Reads as placeholder. It is the most "unfinished" signal on the page |
| 6 | **The rail is a list of 14 equal icons.** Global areas (Trips, Discover, Explore, Templates, Review, Settings) and trip areas (Plan, Today, Bookings, Tasks, Budget) share one 76 px rail with tiny 11 px labels; the trip name is truncated to "DOLO..." in a pink chip; and the same trip views are repeated as tabs in the header | `plan-light.png` (rail and header tabs both present) | Two navigation systems for the same five views. The selected trip, the most important context, is the least legible thing on the screen |
| 7 | **Map is a technical layer, not a designed one.** Grey hillshade with full basemap labels (Treviso, Padova, Castelfranco), thin straight lines between pins, 14 colours, a pale route line running to Venice that dominates the frame | `plan-light.png`, `plan-dark.png` | The map is 35% of the Plan screen and it is the noisiest part of it. The trip's three bases are not visible as places; the Venice transfer leg owns the composition |

## Screen by screen

### Trips home (`home-light.png`, `home-dark.png`, `home-light-phone.png`)
- "Needs you this week" is a full-width pink slab with three equal rows and three equal outline buttons.
  A deadline in 2 days and a review request read with the same weight. It should be a ranked list with a
  date column, the closest item visually first, and colour only on the item that is actually late.
- Trip cards are 350 x 260 with a 90 px pattern top. Five lines of metadata, then four 3 px progress
  bars labelled PLAN BOOK PREPARE GO in 11 px caps. The bars are the right idea (readiness) drawn too
  small to read and too uniform to compare.
- "Going soon" holds one card in a 3-column grid, leaving two thirds of the row empty.
- Done trips (Algonquin, Vermont, Quebec) are below the fold with no distinct treatment; the brief
  asks for them to read as templates.
- Status badges ("Preparing", "in 7 days") are white pills floating over a pattern, both corners of the
  card, competing.

### Plan (`plan-light.png`, `plan-dark.png`, `plan-light-phone.png`)
- Three columns (outline 228 px, document 620 px, map 516 px) with the document column centred in a
  white field; the page title DOLOMITES repeats the header's DOLOMITES 80 px above it.
- The outline is the best element in the prototype (base groups, nights, drive time, mini bars), but at
  11-12 px with 3 px bars it is a debug view, not a navigator.
- Above Day 1 there are six blocks before any plan content: title, share, search, "Next" alert,
  booking chips (two rows), drag hint, ideas chips. Day 1 starts 590 px down a 900 px screen.
- Item rows: a 20 px numbered dot, 18 px title, 13 px kind and duration, inline drive leg. No photo,
  no thumbnail, no fit icon. The timeline line is 2 px grey.
- The drag handle is a 6-dot glyph in `--faint` at the far right edge, 380 px from the title it moves.
  It is visible but reads as noise rather than as an affordance.
- Phone: the map sheet covers half the screen by default; the day strip is good (date pills with a
  warning dot) but the pills are plain white boxes.

### Today (`today-light.png`, `today-light-phone.png`, `today-dark.png`)
- The content is correct (leave-by, drive, parking note, running late, offline state, sunlight mode)
  and the leave-by figure in large crimson caps is the right instinct.
- But on desktop it is a 640 px column centred on an empty grey field, and on the phone the "Running
  late?" buttons are four equal outline boxes with no consequence shown (what moves if I tap +30?).
- No map or photo of where you are going; no sense of the rest of the day at a glance (the day list
  starts below the fold on the phone).
- Offline is a 12 px green pill; it should be a state the whole screen expresses (what is cached,
  how old it is).

### Bookings (`bookings-light.png`)
- Pink "Opens next" slab again. Rows are uniform white cards with a 32 px grey icon square, title,
  two grey lines, and two status pills right-aligned. Flight, car, hotel and parking look identical.
- A flight with two legs, seats and a code is shown as one line; the detail is hidden behind a
  selection whose empty state is a grey box saying "Select a booking".
- Filter chips and "Paste confirmation" (a black button) sit in the same row with the same height,
  so the primary action reads as a filter.

### Tasks (`tasks-light.png`)
- Four card groups (Book, Buy, Pack, Documents) in a two-column masonry. Each task: checkbox, title,
  "in 148 days, Mon, 15 Mar 2027", grey source pill. The reminder ladder for the Tre Cime slot is
  excellent content shown as a grey table inside the card.
- "in 148 days" is precise but not useful as a primary cue; what matters is the order and the month.
  A timeline (by month, with the booking window drawn) would carry this better than category boxes.

### Budget (`budget-light.png`)
- Three equal stat cards and a horizontal bar chart with black on grey bars. Correct, and the most
  finished-looking screen, but generic: it could be any expense app. No per-day or per-base view,
  which is how this family thinks about cost.

### Public trip (`publictrip-light.png`)
- The page that should sell the plan has no image. The "hero" is a grey relief strip.
- The season band is a strong idea (valid mid-July to end of August, temperature, rain, daylight)
  presented as a white card with a black left border and three grey wells.
- Day by day is a list of white cards with 14 px stop names; no photo per day, no map.
- "Copy to my trips" is the right primary action and correctly placed.

### Trail page (`place-light.png`)
- Six identical stat boxes (DISTANCE 10 km ... SEASON late Jun - Sep). The elevation chart is a thin
  grey area with a pink dot. The "Map and route data" block exposes the data-source fallback chain
  (osm_relation, link-out cards) to the traveller; that is admin content.
- No photo, no map of the trailhead, and the links (12 of them, the most valuable part) are pushed to
  the right column below hazards.

## Systemic issues behind the screens

| Area | Today | Should be |
|---|---|---|
| Type scale | 2 sizes of note (11-16 px UI, 44-56 px condensed caps) | 6-7 steps with clear roles: display, page title, section, card title, body, meta, label |
| Density | Even padding everywhere (16-24 px), no tight zones | Dense where scanning (outline, tables, bookings), generous where choosing (trip cards, public trip) |
| Imagery | None | Real photography on every trip, day, place and trail; credited |
| Iconography | 16 px line icons, single weight, mostly generic (ticket for lifts and activities) | One set drawn for the domain: lift, hut, pass, trailhead, parking, ferry, via ferrata, toll |
| Elevation | Same hairline card for every level | Three levels: page, raised card, floating; plus a "sunk" well for inputs |
| Motion | Hover colour only | Section and day transitions, map fly-to, list reorder springs (already specified in `design/README.md` 5 but not visible) |
| Map | Default hillshade + labels + straight connectors | Styled basemap with labels reduced to trip places, bases as named stops, day colour tied to UI, routes drawn as roads not chords |
| States | Pink fill = attention, green text = ok | Status by shape and position first, colour second; urgency colour reserved for real deadlines (< 7 days) |
| Tables and lists | Card per row | Real rows with columns and alignment; cards only where an image or a choice justifies them |
| Forms | Native date input on the public trip page; plain selects | Designed date range picker; inline editable fields |

## What to keep

- The outline with bases, nights and drive time per day (better than Wanderlog's date list).
- Leave-by as the dominant number in Today.
- The booking-window reminder ladder.
- The season band on public trips.
- Charcoal as the primary action colour; one urgency colour; green only for done.
- Facts with sources and read dates.
