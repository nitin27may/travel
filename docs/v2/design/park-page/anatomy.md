# Park page: anatomy, phone and desktop

Part of [the park page design](README.md) (PA-N, gate G-PA). One template for every `nature.protected.*` place and zone
(PN1). The frame is the place page of patterns 3.6 and 3.11 (detail grid: full-bleed cover, glance strip overlapping the
cover by 46 px, two columns 1fr / 400 px on desktop, one column on phones). Values in the wireframes are Banff National
Park's records on `main` (27 Oct 2026: `data/capture/catalogue/PA-ca.json`, `data/capture/canadian-rockies-2029/CS7.json`,
the graph index `data/catalogue/graph/CA.json`); counts are record counts and the built page counts public places, so it
may show fewer. Layout is the specification; numbers are examples.

## 1. Sections, in order

Each section is drawn only with a value or a safety gap (Q300, patterns 3.11); non-safety gaps go to the one Not checked yet
block. For `nature.protected.*` places this order replaces W10's "Park, area" row; other areas keep W10.

| # | Section | At rest (first view) | One step deeper | Data (see [data-map.md](data-map.md)) | Principles |
|---|---|---|---|---|---|
| 1 | **Cover and identity** | breadcrumb "Parks · Canada · Alberta"; kicker "National park · Parks Canada · Alberta"; name; one summary line when held; relevance badge; completeness chip with "What is not checked" | the badge's why; the gap block | park record, `run_by`, `PlaceContext.chain`, relevance | P3, P7 |
| 2 | **Actions** | Plan a visit chips (Day · Weekend · 2 or 3 days) when the builder is on (PN6); Directions, Save to a trip, Share, heart. Without the builder, Save to a trip is the primary | the builder (another page) | slug, point, members count | P7 |
| 3 | **Banner** (at most one, PN11) | closed for the season, or a dated closure overlapping today or the next 30 days, with "as of <date>" and the alerts link | the Seasons section | `EntryBlock.closures`, season state | P2, T1, T3 |
| 4 | **Glance** | up to 6 held facts: season, places inside, camping, gateway town, nearest airport, designations (PN13) | each fact's section | see data map | P3, P6 |
| 5 | **Entry and bookings** | state line ("1 to book ahead · 1 pass · checked 27 Oct 2026"); rows in three groups: Book ahead, Passes and fees, On the day; "Inside the park: own bookings" names and count | a row opens in place: validity, how to buy, proof, change and cancel, exemptions, quota, read date and source, the booking link | `EntryBlock` (PA-Q) | P2 exception, P5, P6, T1, T3 |
| 6 | **Safety and rules** | wildlife and hazard chips with one short line each ("Bears: carry bear spray and keep food stored"); group-size or dog rules when held; the alerts and fire-ban link | provenance of each line | park hazards, member `ext.wildlife.*`, `conditions` link | P2 exception, P6 |
| 7 | **Things to do** | count cards per kind (Trails 17, Lakes 6, ...); the three largest groups with their top 6 places each; "Areas inside" (zones) as links | "Show all 17 trails" to `/places?within=banff-national-park&k=trail` | `PlaceContext.members` (EG-Q) through EG-W's block | P1, P3, P8 |
| 8 | **Where to stay or camp** | campgrounds, backcountry sites, huts and lodges inside, each with its window chip; then gateway towns outside the park with distance | the campground's page; the window detail | members `stay.*` and their lodging offers; `near_town` | P6, T1 |
| 9 | **Getting there** | gateway town and its distance; nearest airport; transit and shuttles that are members (Park and Ride, Lake Connector); Directions | the shuttle's page | `near_town`, ORG airports, members `access.transit`, `access.park` | T2, T5 |
| 10 | **Seasons and closures** | operating season as the month strip season variant; access seasons of roads and zones; gate hours; standing closures with dates; the alerts link | each closure's source and read date | `season`, `access_season`, `hours.closures`, zones, `conditions` link | T1, T3, P2 |
| 11 | **Not checked yet** | one block, one line per section (components 6.5) | | gaps from the completeness engine | P2, T3 |
| 12 | **Facts and sources** | static disclosure, closed: sources and read dates only | open | sources registry | T3 |

The right column on desktop (top to bottom): the map card (park point, visitor centres and the shown members, at most 24
pins, clusters), "In public trips" (Canadian Rockies · Days 3 to 6), Links (Official · Fees · Alerts · Booking, tabs only
when two or more groups hold links), the authority card (Parks Canada, its reservation portal). On phones the map and
"In public trips" move under the glance, as patterns 2 says.

## 2. Desktop, 1440: Banff National Park

```
+------------------------------------------------------------------------------------------------------------------+
| Parks · Canada · Alberta                                                                                         |
| [cover 420 px: licensed park photo, or the kind glyph band 120 px with "No licensed photo yet"]                  |
|   NATIONAL PARK · PARKS CANADA · ALBERTA                                       (kicker, white 80% on the photo)  |
|   BANFF NATIONAL PARK                                                    Early research · n of m  [What is not checked] |
|   <one summary line when the relevance record holds one>                 <relevance badge when held>             |
|                                                                                                                  |
|   Plan a visit   [ Day  no night ]  [ Weekend  1 night ]  [ 2 or 3 days  2 nights ]      (secondary buttons, links) |
|   [Directions]  [Save to a trip]  [Share]  [heart]                                                               |
+------------------------------------------------------------------------------------------------------------------+
| (!) Johnston Canyon trail, day-use area and P1 lot closed 13 Oct to 11 Dec 2026. Parks Canada, read 27 Oct 2026. |
|     As of Tue 27 Oct 2026 · Current alerts ->                                     (caution banner, components 5.4)|
+------------------------------------------------------------------------------------------------------------------+
| GLANCE  56 places inside · 2 visitor centres · Gateway: Banff, inside the park · <nearest airport, ORG>          |
|         (only held facts, at most 6; the season fact is absent: the park record holds no operating season)      |
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
|           Opens on a launch day each year, usually in April, at 08:00 local (40% of seats);              |
|           then 2 days before, at 08:00 local (60%) · 1 Jun to 12 Oct · CAD 12.75 adult   [Details v]     |
|                                                             | MANAGED BY                                          |
| SAFETY AND RULES                                            |  Parks Canada · reservation portal ->              |
|  [wildlife] Wildlife: <the park's wildlife hazard line when held; gap chip "Not checked yet" while it is not>   |
|  Alerts, fire bans and wildlife closures change daily: Parks Canada alerts ->                                   |
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
| WHERE TO STAY OR CAMP                                       |                                                    |
|  Gateway towns: Banff (inside the park) · <more from the stay-bases data when held>                            |
|  (no campground, hut or lodge member is held yet: those names go to the Not checked yet block)                 |
|                                                             |                                                    |
| GETTING THERE                                               |                                                    |
|  Banff, inside the park · <nearest airport and its drive, ORG>                                                 |
|  Transit and shuttles: Lake Louise Park and Ride · Lake Connector · <the 4 transit members as links>           |
|  [Directions to the Banff visitor centre]                                                                      |
|                                                             |                                                    |
| SEASONS AND CLOSURES                                        |                                                    |
|  Operating season: not checked yet (safety row kept: closures are a safety fact)                               |
|  Moraine Lake shuttle runs 1 Jun to 12 Oct (weather permitting) · Lake Louise area: <zone access season>       |
|  Closed 13 Oct to 11 Dec 2026: Johnston Canyon trail, day-use area and P1 lot (read 27 Oct 2026)               |
|  Current alerts and closures: Parks Canada bulletins ->                                                        |
|                                                             |                                                    |
| NOT CHECKED YET                                                                                                 |
|  Seasons: operating season, gate hours · Safety: wildlife rules, food storage · Where to stay: campgrounds,     |
|  huts and lodges inside · Glance: summary, photo, designations                                                 |
|                                                                                                                  |
| FACTS AND SOURCES  [v]   (closed: sources and read dates, never the values again)                               |
+------------------------------------------------------------------------------------------------------------------+
```

Notes on the frame:

- The Discovery Pass is drawn as its own row in Passes and fees because the fee row names it; a pass is never drawn on a
  park whose fees it does not cover. "3 other parks we hold" counts the `covered_by` inverse in our catalogue, never the
  authority's full list (T5: we say only what we hold).
- No saving line ("the pass is likely cheaper"): the park page has no day count, so QP5 forbids it. The trip page says it.
- The Moraine Lake shuttle is a member's own requirement (`scope` Moraine Lake). The park page names it in "Inside the park:
  own bookings" with its window at rest, because a missed launch day stops that visit (P2). At 10,000 members this group
  shows at most 4 rows at rest and "Show 3 more" (a static disclosure); the names of all of them stay visible in the
  group's count line ("7 places inside need their own booking: Moraine Lake, ...").

## 3. Phone, 390: Banff National Park

```
+--------------------------------------+
| ... · Canada · Alberta               |   (breadcrumb collapses to the last two, components 1.5)
| [cover 240 px or glyph band 120 px]  |
| NATIONAL PARK · PARKS CANADA         |
| BANFF NATIONAL PARK                  |
| Early research · n of m              |
|                                      |
| Plan a visit                         |
| [Day]  [Weekend]  [2 or 3 days]      |   (three secondary buttons, 44 px tall, one row: 284 of 362 px)
|  no night  1 night   2 nights        |   (sub-labels inside each button, mono --t-meta)
| [Directions] [Save] [Share] [heart]  |
+--------------------------------------+
| (!) Johnston Canyon trail, day-use   |
| area and P1 lot closed 13 Oct to     |
| 11 Dec 2026. As of Tue 27 Oct.       |
| Alerts ->                            |
+--------------------------------------+
| 56 places inside · 2 visitor centres |
| Gateway: Banff, inside the park      |   (glance: two lines, wraps, never scrolls sideways)
+--------------------------------------+
| [map, 200 px, park point and shown   |
|  members; "Open map" expands it]     |
| In Canadian Rockies · Days 3 to 6    |
+--------------------------------------+
| ENTRY AND BOOKINGS                   |
| 1 to book ahead inside · 1 pass      |
| checked 27 Oct 2026                  |
| Passes and fees                      |
| [ticket] Daily admission             |
|  [Buy any time]                      |
|  Everyone entering · per person/day  |
|  CAD 12.25 adult · 17 and under free |
|  Discovery Pass covers it            |
|  Fees page ->          [Details v]   |
| [ticket] Discovery Pass              |
|  [Buy any time] 12 months            |
|  CAD 83.50 adult · 167.50 family     |
| Inside the park: own bookings (1)    |
| [ticket] Moraine Lake shuttle seat   |
|  Launch day, usually April, 08:00;   |
|  then 2 days before at 08:00         |
|  1 Jun to 12 Oct      [Details v]    |
+--------------------------------------+
| SAFETY AND RULES                     |
| Wildlife: not checked yet (gap chip) |
| Alerts and fire bans change daily:   |
| Parks Canada alerts ->               |
+--------------------------------------+
| THINGS TO DO                         |
| [Trails 17  >] [Lakes 6        >]    |   (count cards, 2 columns)
| [Views 5    >] [Waterfalls 2   >]    |
| [Lifts 3    >] [6 more kinds   >]    |
| Trails              Show all 17 ->   |
|  [row] [row] [row]                   |   (list rows 3.2, 56 px, top 6)
|  [row] [row] [row]                   |
| Lakes                Show all 6 ->   |
|  [row x 6]                           |
| Viewpoints and summits  Show all ->  |
|  [row x 5]                           |
| Areas inside: Lake Louise area ->    |
+--------------------------------------+
| WHERE TO STAY OR CAMP                |
| Gateway: Banff (inside the park)     |
+--------------------------------------+
| GETTING THERE                        |
| Banff, inside the park               |
| Shuttles: Lake Louise Park and Ride, |
|  Lake Connector, ...                 |
| [Directions]                         |
+--------------------------------------+
| SEASONS AND CLOSURES                 |
| [month strip, season variant, 6 x 2] |
| Closed 13 Oct to 11 Dec 2026:        |
|  Johnston Canyon trail and P1 lot    |
| Alerts ->                            |
+--------------------------------------+
| NOT CHECKED YET (one block)          |
| FACTS AND SOURCES [v]                |
+--------------------------------------+
```

Phone rules: one column; no sideways scroll at 320 (the three Plan a visit buttons measure about 284 px at 390 and wrap
to two rows at 320, never shrink below 44 px); the map is a 200 px card with an "Open map" button that expands it in
place (P5), not a bottom sheet (the place page has no sheet). Count cards are two columns (components 3.6). Members are
list rows, not cards, to keep the page short.

## 4. A provincial park in the same template (shape, not research)

The same frame for an Ontario-style provincial park, using protected-area-entry 2.4 B and 7's illustrative "Lakeview
Provincial Park" (no such record exists; Algonquin is the pilot, PA-R-ON). Only data changes:

```
| PROVINCIAL PARK · <PROVINCIAL AGENCY> · ONTARIO                                   |
| LAKEVIEW PROVINCIAL PARK                                                          |
| Plan a visit [Day] [Weekend] [2 or 3 days]   [Directions] [Save] [Share] [heart]  |
| (!) Closed for the season: the park operates <from> to <to>. As of <date>. ->     |   <- PN11, outside the season
| ENTRY AND BOOKINGS                                                                |
|  Book ahead                                                                       |
|   Day-use reservation   Peak weekends only · opens 5 days before at 07:00 local   |
|                         Day visitors only                                         |
|   Campsite, North Campground   Opens 150 days before at 07:00 local              |
|  Passes and fees                                                                  |
|   Daily vehicle permit  per vehicle, per day · covered by the annual day-use pass |
|                         Not needed: campers (the campsite permit covers it)       |
|   Backcountry permit    per person, per night · daily quota                      |
|                         Backcountry campers only                                  |
| SAFETY AND RULES   Bears: food lockers at campgrounds · fire bans: alerts ->      |
| THINGS TO DO       [Trails n] [Lakes n] [Beaches n] [Canoe routes n] ...          |
| WHERE TO STAY OR CAMP   North Campground (window chip) · South Campground ...      |
| SEASONS AND CLOSURES    [month strip: open May to Oct, closed Nov to Apr]         |
```

Nothing in the template knows it is provincial: the kicker word comes from `label_by_country` (Q-PN9), the vehicle
permit and its camper exemption from the offers, the operating season from `season`.

## 5. Requirement row: what opens in place

At rest (P2, P6): kind glyph, name, the window chip (to book, caution or urgent per tokens 3.1 when a trip date is known;
on the dateless park page always the neutral "to book" or "Buy any time" chip), who needs it, the price line (at most
three bands, then "+n"), the pass that covers it, the scope when it is a zone's or a member's, the official or booking
link. Opened (static disclosure, components 6.4): validity ("1 day from purchase"), how to get it (online, gate, visitor
centre), proof ("display it"), change and cancel ("Non-refundable"), exemptions, quota, the season it is in force, the read
date and the source, and the "Booking window not published (checked <date>)" line when the window is `searched_none`.
A requirement that is mandatory is never only inside the disclosure: its existence, window and who needs it are at rest.

## 6. Member pages: the park line

Every member page (a trail, lake or campground in the park) carries one line in its safety tier, from `requirementsOf`
through `EntryBlock.inheritedFrom` (protected-area-entry 2.3, 6.4): "In Banff National Park: daily admission applies
(Discovery Pass covers it) ->", linking to the park page's `#entry`. A member with its own requirement (Moraine Lake)
shows its own row above the park line. PA-2 owns the line; EG-W owns the rest of the context block.

## 7. Motion, keyboard, print

- Requirement rows and the "Show 3 more" tails open in place, height by grid rows over `--d-base` `--e-std`; reduced
  motion jumps (P5, components 6.4).
- The section index (the existing `SectionIndex`) lists only drawn sections; Entry is `#entry`, Things to do `#todo`,
  Where to stay `#stay`, Getting there `#getting-there`, Seasons `#seasons`.
- Print opens every static disclosure (components 6.4 `beforeprint`), prints the Entry rows in full, the alerts URL as text,
  and no map (T2).
- Plan a visit chips are links (Tab stops, Enter follows); the screen reader name is "Plan a day visit with no night",
  "Plan a weekend, 1 night", "Plan 2 or 3 days, 2 nights".
