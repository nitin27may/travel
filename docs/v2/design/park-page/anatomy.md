# Park page: anatomy, phone and desktop

Part of [the park page design](README.md) (PA-N, revised after PA-NR; gate G-PA open). One template for every
`nature.protected.*` place and zone (PN1). The frame is the place page of patterns 3.6 and 3.11 (detail grid: full-bleed
cover, glance strip overlapping the cover by 46 px, two columns 1fr / 400 px on desktop, one column on phones), with one
park exception on phones (PN18). Values in the wireframes are Banff National Park's records on `main` (27 Oct 2026:
`data/capture/catalogue/PA-ca.json`, `data/capture/canadian-rockies-2029/CS7.json`, the graph index
`data/catalogue/graph/CA.json`); counts are record counts and the built page counts public places, so it may show fewer.
Layout is the specification; numbers are examples.

## 1. Sections, in order

Each section is drawn only with a value or a safety gap (Q300, patterns 3.11); non-safety gaps go to the one Not checked yet
block. For `nature.protected.*` places this order replaces W10's "Park, area" row; other areas keep W10.

| # | Section | At rest (first view) | One step deeper | Data (see [data-map.md](data-map.md)) | Principles |
|---|---|---|---|---|---|
| 1 | **Cover and identity** | breadcrumb "Parks · Canada · Alberta"; kicker "National park · Parks Canada · Alberta"; name; one summary line when held; relevance badge; completeness chip with "What is not checked" | the badge's why; the gap block | park record, `run_by`, `PlaceContext.chain`, relevance | P3 |
| 2 | **Actions** | **Save to a trip** (the one filled primary), Directions (secondary), Share and heart (icon buttons); then the "Plan a visit" group: Day trip · 1 night · 2 nights · Part of a longer trip (secondary links; builder on and 3 or more members only) | the builder (another page) | slug, point, country, members count | P7 |
| 3 | **Banner** (at most one, PN11) | notice: closed for the season or between seasons; caution: a dated closure overlapping today or the next 30 days, naming the member as a link and "1 of n closures" when more; "as of <date>"; the alerts link | Seasons and closures | `EntryBlock.closures`, season state | P2, T1, T3 |
| 4 | **Glance** | up to 6 held facts: Season, Entry (one word, links `#entry`), Camping, places inside, gateway town, nearest airport (PN13) | each fact's section | see data map | P3, P6 |
| 5 | **Entry and bookings** | state line ("1 to book ahead inside the park · 1 pass · checked 27 Oct 2026", plus "· 2 campgrounds book ahead, see Where to stay" when any); requirement rows in groups Book ahead, Passes and fees, On the day, Inside the park: own bookings. Campsite reservations are not here (PN12) | a row opens in place: validity, how to buy, proof, change and cancel, exemptions, quota, read date and source, the booking link | `EntryBlock` (PA-Q) | P2 exception, P5, P6, T1, T3 |
| 6 | **Safety and rules** | wildlife and hazard chips with one short line each; group-size or dog rules when held; the alerts and fire-ban link | provenance of each line | park hazards, member `ext.wildlife.*`, `conditions` link | P2 exception, P6 |
| (phones) | **Map card and In public trips** | here on phones only, after Safety (PN18); in the right column on desktop | "Open map" expands in place | point, members' points | P2, T2 |
| 7 | **Seasons and closures** | "Open all year, read <date>" for a park open every month; otherwise the month strip `variant="season"`; access seasons of roads and zones; gate hours; standing closures with dates; the alerts link | each closure's source and read date | `season`, `access_season`, `hours`, `closures`, zones, `conditions` link | T1, T3, P2 |
| 8 | **Where to stay or camp** | campgrounds, backcountry sites, huts and lodges inside, each with its window chip (the one home of these windows); then gateway towns outside the park with distance | the campground's page; the window detail | members `stay.*` and their lodging offers; `near_town` | P6, T1 |
| 9 | **Things to do** | count cards per kind (Trails 17, Lakes 6, ...); the three largest groups with their top 6 places each; "Areas inside" (zones) as links | "Show all 17 trails" to `/places?within=banff-national-park&k=trail` | `PlaceContext.members` (EG-Q) through EG-W's block | P1, P3, P8 |
| 10 | **Getting there** | gateway town and its distance; nearest airport; transit and shuttles that are members; Directions | the shuttle's page | `near_town`, ORG airports, members `access.transit`, `access.park` | T2, T5 |
| 11 | **Not checked yet** | one block, one line per section (components 6.5) | | gaps from the completeness engine | P2, T3 |
| 12 | **Facts and sources** | static disclosure, closed: sources and read dates only | open | sources registry | T3 |

The right column on desktop (top to bottom): the map card (park point, visitor centres and the shown members, at most 24
pins, clusters), "In public trips" (Canadian Rockies · Days 3 to 6), Links (Official · Fees · Alerts · Booking, tabs only
when two or more groups hold links), the authority card (Parks Canada, its reservation portal).

## 2. Desktop, 1440: Banff National Park

```
+------------------------------------------------------------------------------------------------------------------+
| Parks · Canada · Alberta                                                                                         |
| [cover 420 px: licensed park photo, or the kind glyph band 120 px with "No licensed photo yet"]                  |
|   NATIONAL PARK · PARKS CANADA · ALBERTA                                       (kicker, white 80% on the photo)  |
|   BANFF NATIONAL PARK                                        Early research · n of m  [What is not checked]      |
|   <one summary line when the relevance record holds one>     <relevance badge when held>                         |
|                                                                                                                  |
|   [## Save to a trip ##]  [Directions]  [share]  [heart]          (one filled primary; icon buttons 38 px)       |
|   Plan a visit  [Day trip]  [1 night]  [2 nights]  [Part of a longer trip]        (secondary link buttons)        |
+------------------------------------------------------------------------------------------------------------------+
| (!) Johnston Canyon closed 13 Oct to 11 Dec 2026: trail, day-use area and P1 lot. Parks Canada, read 27 Oct 2026. |
|     As of Tue 27 Oct 2026 · Current alerts ->                         (caution banner; "Johnston Canyon" a link)  |
+------------------------------------------------------------------------------------------------------------------+
| GLANCE  Entry: Fee -> · 56 places inside · Gateway: Banff, inside the park · <nearest airport, ORG>              |
|         (Season and Camping absent: Banff has no operating-season record and no campground member yet)           |
+-------------------------------------------------------------+----------------------------------------------------+
| ENTRY AND BOOKINGS                                          | [map card: park point, 2 visitor centres, the       |
| 1 to book ahead inside the park · 1 pass · checked 27 Oct   |  shown members; clusters; honesty line "Pins mark    |
|                                                             |  the visitor centre and places we hold; no park      |
| Passes and fees                                             |  boundary is drawn"]                                 |
|  [ticket] Daily admission                       [Buy any time]                                                  |
|           Everyone entering, every season · per person, per day                                                 |
|           CAD 12.25 adult · 10.75 senior · 24.50 family or group · 17 and under free (2026)                     |
|           Discovery Pass covers it (also Jasper, Yoho, Kootenay)                 Fees page ->   [Details v]     |
|           Not needed: through traffic on Highways 1 and 93 South                                                 |
|  [ticket] Parks Canada Discovery Pass           [Buy any time]                | IN PUBLIC TRIPS                    |
|           12 months from purchase · CAD 83.50 adult · 167.50 family (2026)    |  Canadian Rockies · Days 3 to 6    |
|           Covers daily admission here and at 3 other parks we hold   Buy ->   |   and 9 to 11                      |
|                                                             |                                                    |
| Inside the park: own bookings (1)                           | LINKS  Official · Fees · Alerts                     |
|  [ticket] Moraine Lake shuttle seat · Moraine Lake          |   every link read 27 Oct 2026                        |
|           [Launch day, usually April]                                                                             |
|           Opens on a launch day each year, usually in April, at 08:00 local (40% of seats);              |
|           then 2 days before, at 08:00 local (60%) · 1 Jun to 12 Oct · CAD 12.75 adult   [Details v]     |
|                                                             | MANAGED BY                                          |
| SAFETY AND RULES                                            |  Parks Canada · reservation portal ->              |
|  [wildlife] Wildlife: Not checked yet (gap chip; the row stays: a safety gap)                                   |
|  Alerts, fire bans and wildlife closures change daily: Parks Canada alerts ->                                   |
|                                                             |                                                    |
| SEASONS AND CLOSURES                                        |                                                    |
|  Operating season: Not checked yet (gap chip)                                                                   |
|  Moraine Lake shuttle runs 1 Jun to 12 Oct (weather permitting)                                                 |
|  Closed 13 Oct to 11 Dec 2026: Johnston Canyon trail, day-use area and P1 lot (read 27 Oct 2026)               |
|  Current alerts and closures: Parks Canada bulletins ->                                                        |
|                                                             |                                                    |
| WHERE TO STAY OR CAMP                                       |                                                    |
|  Gateway towns: Banff (inside the park) · <more from the stay-bases data when held>                            |
|  (no campground, hut or lodge member is held yet: they go to the Not checked yet block)                        |
|                                                             |                                                    |
| THINGS TO DO                                                |                                                    |
|  [Trails 17 >] [Lakes 6 >] [Viewpoints and summits 5 >] [Waterfalls 2 >] [Lifts 3 >] [Cycling 2 >] [4 more >]  |
|                                     (count cards, components 3.6; each card is one link to the filtered list)  |
|  Trails                                                     Show all 17 trails ->                              |
|   [card][card][card]                                                                                           |
|   [card][card][card]          (top 6 by draw, place cards 3.1 with the kids and effort chips first)             |
|  Lakes                                                      Show all 6 lakes ->                                |
|   [card][card][card] [card][card][card]                                                                        |
|  Viewpoints and summits                                     Show all 5 ->                                      |
|   [card][card][card] [card][card]                                                                              |
|  Areas inside: Lake Louise area ->                                                                             |
|                                                             |                                                    |
| GETTING THERE                                               |                                                    |
|  Banff, inside the park · <nearest airport and its drive, ORG>                                                 |
|  Transit and shuttles: Lake Louise Park and Ride · Lake Connector · <the transit members as links>             |
|  [Directions to the Banff visitor centre]                                                                      |
|                                                             |                                                    |
| NOT CHECKED YET                                                                                                 |
|  Seasons: operating season, gate hours · Where to stay: campgrounds, huts and lodges inside ·                   |
|  Cover: summary, photo, designations                                                                          |
|                                                                                                                  |
| FACTS AND SOURCES  [v]   (closed: sources and read dates, never the values again)                               |
+------------------------------------------------------------------------------------------------------------------+
```

Notes on the frame:

- Primary (M1): one filled `--accent` button, Save to a trip. Plan a visit is a quieter row of outlined link buttons; it
  is absent when the builder is off or the park has fewer than 3 members with points.
- The Discovery Pass is its own row in Passes and fees because the fee row names it; a pass is never drawn on a park whose
  fees it does not cover. "3 other parks we hold" counts the `covered_by` inverse in our catalogue (T5).
- No saving line ("the pass is likely cheaper"): the park page has no day count, so QP5 forbids it.
- The Moraine Lake shuttle is a member's own requirement (`scope` Moraine Lake), named at rest with its window because a
  missed launch day stops that visit (P2). At 10,000 members this group shows at most 4 rows at rest and "Show 3 more"
  (a static disclosure); the names of all stay in the count line. A row with "May be out of date" is never in the tail.
- The glance's Entry word is "Fee": Banff has a fee, and its only book-ahead row belongs to a member.

## 3. Phone, 390: Banff National Park

```
+--------------------------------------+
| ... · Canada · Alberta               |   (breadcrumb collapses to the last two, components 1.5)
| [cover 240 px or glyph band 120 px]  |
| NATIONAL PARK · PARKS CANADA         |
| BANFF NATIONAL PARK                  |
| Early research · n of m              |
| [## Save to a trip ##] [Directions] [sh] [♡] |   (one row from 375 px; Save, Directions and two 44 px icon buttons)
| Plan a visit                         |
| [Day trip] [1 night] [2 nights]      |   (one line each, 44 px tall)
| [Part of a longer trip]              |
+--------------------------------------+
| (!) Johnston Canyon closed 13 Oct to |
| 11 Dec 2026. As of Tue 27 Oct.       |
| Alerts ->                            |
+--------------------------------------+
| Entry: Fee -> · 56 places inside     |
| Gateway: Banff, inside the park      |   (glance: wraps, never scrolls sideways)
+--------------------------------------+
| ENTRY AND BOOKINGS                   |   (in the first scroll: PN18, AC-25)
| 1 to book ahead inside · 1 pass      |
| checked 27 Oct 2026                  |
| Passes and fees                      |
| [ticket] Daily admission             |
|  [Buy any time]                      |   (window chip directly under the name)
|  Everyone entering · per person/day  |
|  CAD 12.25 adult · 17 and under free |
|  Discovery Pass covers it            |
|  Fees page ->          [Details v]   |
| [ticket] Discovery Pass              |
|  [Buy any time]                      |
|  12 months · CAD 83.50 adult         |
| Inside the park: own bookings (1)    |
| [ticket] Moraine Lake shuttle seat   |
|  [Launch day, usually April]         |
|  then 2 days before at 08:00         |
|  1 Jun to 12 Oct      [Details v]    |
+--------------------------------------+
| SAFETY AND RULES                     |
| Wildlife: Not checked yet (gap chip) |
| Alerts and fire bans change daily:   |
| Parks Canada alerts ->               |
+--------------------------------------+
| [map, 200 px, park point and shown   |   (map and trips here on phones only, PN18)
|  members; "Open map" expands it]     |
| In Canadian Rockies · Days 3 to 6    |
+--------------------------------------+
| SEASONS AND CLOSURES                 |
| Operating season: Not checked yet    |
| Closed 13 Oct to 11 Dec 2026:        |
|  Johnston Canyon trail and P1 lot    |
| Alerts ->                            |
+--------------------------------------+
| WHERE TO STAY OR CAMP                |
| Gateway: Banff (inside the park)     |
+--------------------------------------+
| THINGS TO DO                         |
| [Trails 17  >] [Lakes 6        >]    |   (count cards, 2 columns)
| [Views 5    >] [Waterfalls 2   >]    |
| [Lifts 3    >] [6 more kinds   >]    |
| Trails              Show all 17 ->   |
|  [row x 6]                           |   (list rows 3.2, 56 px)
| Lakes                Show all 6 ->   |
|  [row x 6]                           |
| Viewpoints and summits  Show all ->  |
|  [row x 5]                           |
| Areas inside: Lake Louise area ->    |
+--------------------------------------+
| GETTING THERE                        |
| Banff, inside the park               |
| Shuttles: Lake Louise Park and Ride, |
|  Lake Connector, ...                 |
| [Directions]                         |
+--------------------------------------+
| NOT CHECKED YET (one block)          |
| FACTS AND SOURCES [v]                |
+--------------------------------------+
```

Phone rules: one column; no sideways scroll at 320; no target below 44 px (the action row wraps Directions to a second line
below 375 px rather than shrinking). The Plan a visit labels are one line each; four buttons take two rows. The map card
follows Safety and rules (PN18) and expands in place (P5). Count cards are two columns; members are list rows.

## 4. A provincial park in the same template (shape, not research)

The same frame for an Ontario-style provincial park, using protected-area-entry 2.4 B and 7's illustrative "Lakeview
Provincial Park" (no such record exists; Algonquin is the pilot, PA-R-ON). Only data changes:

```
| PROVINCIAL PARK · <PROVINCIAL AGENCY> · ONTARIO                                           |
| LAKEVIEW PROVINCIAL PARK                                                                  |
| [## Save to a trip ##] [Directions] [share] [heart]                                       |
| Plan a visit [Day trip] [1 night] [2 nights] [Part of a longer trip]                      |
| (i) Closed for the season: the park operates <from> to <to>. As of <date>. ->             |  <- notice banner, PN11
| Season: May to Oct · Entry: Fee · book ahead -> · Camping: 2 campgrounds · ...            |  <- glance
| ENTRY AND BOOKINGS  1 to book ahead · 2 passes · 2 campgrounds book ahead, see Where to stay -> |
|  Book ahead                                                                               |
|   Day-use reservation   [Opens 5 days before]  Peak weekends only · Day visitors only     |
|  Passes and fees                                                                          |
|   Daily vehicle permit  per vehicle, per day · covered by the annual day-use pass         |
|                         Not needed: campers (the campsite permit covers it)               |
|   Backcountry permit    per person, per night · daily quota · Backcountry campers only    |
| SAFETY AND RULES   Bears: food lockers at campgrounds · fire bans: alerts ->              |
| SEASONS AND CLOSURES   [month strip, season variant: open May to Oct, closed Nov to Apr]   |
| WHERE TO STAY OR CAMP                                                                     |
|   North Campground [Opens 150 days before at 07:00] · South Campground [...]              |
| THINGS TO DO       [Trails n] [Lakes n] [Beaches n] [Canoe routes n] ...                  |
```

Nothing in the template knows it is provincial: the kicker word comes from `label_by_country` (Q-PN9), the vehicle permit
and its camper exemption from the offers, the operating season from `season`. Campsite windows appear only under Where to
stay or camp (PN12).

## 5. Requirement row: what opens in place

At rest (P2, P6): kind glyph, name, the window chip **directly under the name on phones** (to book, or neutral "Buy any
time"; caution and urgent colours only on a page that knows a trip date, never on the dateless park page), who needs it,
the price line (at most three bands, then "+n"), the pass that covers it, the scope when it is a zone's or a member's, the
official or booking link. Opened (static disclosure, components 6.4): validity, how to get it, proof, change and cancel,
exemptions, quota, the season it is in force, the read date and source, and "Booking window not published (checked
<date>)" when the window is `searched_none`. A mandatory requirement's existence, window and who needs it are always at
rest.

Group rules (folded into the row component, review N2): a group is a heading `--t-label` `--ink-2` with a mono count and a
`<ul>`; an empty group is not drawn; "Inside the park: own bookings" shows 4 rows at rest, names all of them in its count
line, and puts the rest in a static "Show n more" tail.

## 6. Member pages: the park line

Every member page carries one line in its safety tier, from `requirementsOf` through `EntryBlock.inheritedFrom`
(protected-area-entry 2.3, 6.4): "In Banff National Park: daily admission applies (Discovery Pass covers it) ->", linking to
the park page's `#entry`. A member with its own requirement (Moraine Lake) shows its own row above the park line. PA-2 owns
the line; EG-W owns the rest of the context block.

## 7. Motion, keyboard, print

- Requirement rows and "Show n more" tails open in place, height by grid rows over `--d-base` `--e-std`; reduced motion
  jumps (P5, components 6.4).
- The section index (the existing `SectionIndex`) lists only drawn sections: `#entry`, `#safety`, `#seasons`, `#stay`,
  `#todo`, `#getting-there`.
- Print opens every static disclosure, prints the Entry rows in full and the alerts URL as text, and no map (T2).
- The Plan a visit group is `div role="group" aria-labelledby` its visible heading (not a `<nav>` landmark). Link names:
  "Plan a day trip", "Plan a visit with 1 night", "Plan a visit with 2 nights", "Plan a longer trip that includes Banff
  National Park".
- Share and the heart are icon buttons with names ("Share Banff National Park"; the heart per components 2.11).
