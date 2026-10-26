# Wireframes: trip page tabs, Summary, party bar, when to go, trip shape, table view, places by type

Written 26 Oct 2026 by travel-planner (Opus) for the spec
[features/trip-and-places-ux-fixes.md](../../features/trip-and-places-ux-fixes.md). Design only: nothing here is built.
The owner approves these before any build starts (spec section 0, rule C).

**How to read them.** Each frame is drawn at two widths: **1440** (desktop, content column `--max-content`, map column
400 px where the page has one) and **390** (phone, 16 px margins, `--margin`). 320 px notes follow the 390 frame. Boxes
are not to scale; labels in `[brackets]` are controls, `( )` are notes, `v` is a menu or a collapsed disclosure, `^` an
open one. Every value is **real data from the 26 Oct build of `main`** (the trip export embedded in the built page,
`data/windows/canadian-rockies-2029.json`, the built place pages and `legacy/*/gallery/gallery.json`), unless marked
"illustrative". Tokens are named from `web/app/themes.css`; no new colour, and no green or purple anywhere.

**Test case.** Canadian Rockies (`canadian-rockies-2029`, depth full) is drawn first in every frame. The Dolomites (full)
and an overview trip (Costa Rica, no days) are drawn where they degrade differently.

## Rockies facts used below (computed 26 Oct 2026)

| Fact | Value | Source in the repo |
|---|---|---|
| Length | 15 days, 14 nights | trip export `days`, `nights` |
| Bases (in order, nights) | Banff 2 · Lake Louise village 1 · Jasper townsite 4 · Lake Louise village 4 · Kananaskis Village 3 (Day 15 is the flight home) | export `days[].base`; 4 distinct bases, 5 stays |
| Provinces | 2: Alberta (29 of the 35 linked places), British Columbia (6) | place pages' area chain |
| Parks | 4 national parks: Banff, Jasper, Yoho, Kootenay; 2 provincial parks: Peter Lougheed (Kananaskis Country), Mount Robson; all inside the Canadian Rocky Mountain Parks World Heritage Site | place pages' designation lines |
| Trails | 33 distinct trails in the plan (all versions); 186.5 km if you walked every one; 8,102 m of climb from the 27 that have a climb | export stops (category trails); place glance facts |
| Sights, activities | 28 sights, 15 activities (distinct) | export stops |
| To book | 7 bookings: Day 1 (2: rental car, Parks Canada pass), Day 4 (Icefields Parkway and the Columbia Icefield tour), Day 5 (Maligne Lake cruise), Day 10 (Lake Louise parking and Park and Ride), Day 11 (2: Larch Valley group-of-four rule, Moraine Lake road and shuttle). **None has a published opening rule yet** (`rule: null` on all 7; notes only) | export `bookings` (TRP-GL-C) |
| Highlights ("Worth the journey") | 13 places: Johnston Canyon (Day 3), Lake Louise (3, 10), Peyto Lake Lookout (4), Athabasca Glacier and Columbia Icefield (4, 8), Icefields Parkway (4, 8), Maligne Lake and Spirit Island (5), Athabasca Falls (8), Takakkaw Falls (9), Plain of Six Glaciers (10), Moraine Lake (11), Larch Valley to Sentinel Pass (11), Ptarmigan Cirque (14), Highwood Pass (14) | relevance badge on the place pages |
| Photos | trip gallery: 14 sections, 41 Commons photos (Moraine Lake, Lake Louise, Johnston Canyon, Icefields Parkway, Athabasca Glacier, Maligne Lake, Yoho, Kootenay, Kananaskis, Larches...); **0 of the 35 linked place pages has its own licensed photo** | `legacy/canadian-rockies-sept-2029/gallery/gallery.json`; place pages |
| Season | "Early to late September"; windows file: 4 windows, default `sep-w2` "Second week of September" (Best for this plan, crowds lower), `sep-w1` (Good, crowds high), `jun-last` (Good, rising), `jun-w2` (Workable, lower) | seed season; `data/windows/canadian-rockies-2029.json` (researched 25 Oct, 22 sources) |
| Weather tiles | 2 to 16 C; showers and first snow on high passes possible; sunrise about 07:00, sunset about 19:45 mid-September | seed season |
| Climate source already held | Environment and Climate Change Canada, 1991-2020 climate normals; Parks Canada Banff weather page | windows `sources` |
| Party default | Family, youngest 10, Standard (FAMAGE10); written for families with a child from about 6; whole family on 14 days, adults' hike on 1 | trip page profile line |
| Drive per day | cover says about 1 h 40; the glance's day drives sum to 29 h 45 over 15 days (about 2 h). **Inconsistent: spec 4.7** | cover stat; glance rows |
| Long drive days (2 h 30 or more) | Day 1 (2 h 30), Day 4 (2 h 55), Day 5 (2 h 30), Day 8 (3 h 45) | glance rows |
| Days with a warning | 2, 4, 7, 10, 12, 13 | glance rows |

Dolomites (full): 14 days, 13 nights; bases San Candido 4, Cortina d'Ampezzo 4, Ortisei 4, Bolzano 1; provinces South Tyrol
(14 places), Veneto (9), Trentino (1); nature parks Puez-Odle and Fanes-Sennes-Prags; 10 trails, 94.0 km, 5,337 m; 11
sights, 3 activities; 3 bookings (Day 2 Braies P4 parking, Day 3 Tre Cime toll slot "Opens 30 days before Day 3", Day 12
Seceda lift 08:30 slot); 5 highlights (Lago di Braies, Tre Cime loop, Lago di Sorapis, Alpe di Siusi, Ötzi museum); gallery
8 sections, 22 photos; season "Mid-July to end of August"; **no windows file**.

Costa Rica (overview): 10 nights, no days, no stops, no bookings; season "Mid-February" (`data/seasons/costa-rica-2027.json`);
gallery 6 sections, 17 photos.

---

## W1. Trip page frame and the tab bar

### 1440

```
+--------------------------------------------------------------------------------------------------------------+
| TRIP PLANS   Trips  Places  Globe                                                    (search) (theme) Sign in |
+--------------------------------------------------------------------------------------------------------------+
| [cover photo, 620 px]  Published plan · Alberta and British Columbia, Canada                                  |
|  CANADIAN ROCKIES, 14 NIGHTS                                                                                  |
|  (standfirst, serif 21)                                                                                       |
|  (chips) Moderate · From about 6 · by Nitin · Drive time estimated · 2026 data used as a pattern             |
|  [Copy to my trips]  [Export trip v]  [Share]                                                                 |
|  +-------------------+-------------------+----------------------+------------------------------+             |
|  | LENGTH            | BASES             | DRIVE A DAY          | BEST TIME                    |             |
|  | 14 nights·15 days | 4 bases           | about 2 h on average | 2nd week of September        |             |
|  +-------------------+-------------------+----------------------+------------------------------+             |
+--------------------------------------------------------------------------------------------------------------+
| PLAN IT FOR   2 adults · 1 child (10) · Standard pace                         [pencil Edit]   (W3, collapsed) |
+--------------------------------------------------------------------------------------------------------------+
| Summary      Days 15      Stops 76      Bookings 7      Photos 41                        (sticky, --z-sticky) |
| ========                                                                                                      |
+--------------------------------------------------------------------------------------------------------------+
| (the chosen tab's panel)                                          |  THE ROUTE (map column, 400 px; shown on   |
|                                                                   |  Days, Stops and Bookings; hidden on       |
|                                                                   |  Summary and Photos, where the Summary     |
|                                                                   |  carries its own small route map)          |
+--------------------------------------------------------------------------------------------------------------+
| Take this plan with you  [Copy to my trips] [Export] [Share]       (end of page, every tab)                  |
| Credits · Attribution                                                                                         |
+--------------------------------------------------------------------------------------------------------------+
```

- Tab strip: `--t-tab` labels, count after the label in mono `--t-meta` (`--muted`), current tab `--ink` with
  `--t-tab-current-weight` and a 3 px `--accent` underline flush with the hairline (`--b-hairline`, `--line`); height
  48 px; sticky under the header at `--z-sticky` with `--bg` behind it. It replaces the "By day / By category" segment
  and the "In this trip" heading.
- Counts: Days = days; Stops = distinct stops of the plan (Rockies 33 + 28 + 15 = 76; stays and getting-around rows join
  when OVR-2 lands); Bookings = export `bookings`; Photos = gallery photos.
- The cover stat "VALID FOR" becomes **BEST TIME**, so it no longer repeats the season heading (finding I6).

### 390

```
+--------------------------------------+
| TRIP PLANS                 (q) (m) (o)|
+--------------------------------------+
| [cover 420 px] ... title, chips       |
| [Copy to my trips]                    |
| [Export v] [Share]                    |
| 14 nights · 4 bases · ~2 h drive/day  |
| Best time: 2nd week of September      |
+--------------------------------------+
| Plan it for                           |
| 2 adults · 1 child (10) · Standard    |
|                          [pencil Edit]|
+--------------------------------------+
| Summary  Days  Stops  Bookings  Photos|   (sticky; labels only, no counts on phone)
| =======                               |
+--------------------------------------+
| (panel)                               |
|                          [Map] (Days, |
|                    Stops and Bookings)|
+--------------------------------------+
| (phone bottom bar)                    |
+--------------------------------------+
```

- At 390 the five labels fit on one row with `--s-2` side padding per tab (measured estimate: 30 characters of
  `--t-tab` at about 8.1 px = 243 px plus 80 px padding = 323 px of the 358 px column). **The builder measures it; if it
  does not fit at 390 in Safari, the strip scrolls as at 320.**
- **320:** the strip scrolls sideways with scroll-snap per tab, a 24 px fade at the right edge, and the current tab
  scrolled into view on load (same behaviour as `CategoryStrip`, patterns 3.4 phone).
- The Map control sits in the sticky day rail on Days (as today) and in a small sticky bar on Stops and Bookings.

### Tabs by trip state

| Trip state | Tabs shown | Example |
|---|---|---|
| full | Summary · Days · Stops · Bookings · Photos | Rockies, Dolomites |
| summary (days, condensed times) | Summary · Days · Stops · Bookings (only when the export has bookings) · Photos (only with a gallery) | Utah, Iceland, Patagonia, Chamonix; Algonquin and Vermont have no gallery |
| overview (no days) | Summary · Photos (only with a gallery) | Costa Rica, Norway, Switzerland |
| overview, no gallery | no tab bar; the Summary is the page | New Hampshire, Niagara, Quebec |

A tab with nothing in it is not drawn (P4: never a dead control).

---

## W2. Summary tab

### 1440, Rockies

```
+-------------------------------------------------------------------------------------------------------------+
| WHAT YOU WILL DO                                                                                             |
| 15 days through Alberta and British Columbia, in four national parks (Banff, Jasper, Yoho, Kootenay) and    |
| two provincial parks (Peter Lougheed, Mount Robson), all in the Canadian Rocky Mountain Parks World Heritage |
| Site. (then the trip's own standfirst, serif --t-body-l)                                                     |
|                                                                                                             |
| +----------------+ +----------------+ +--------------------+ +-------------------+ +----------------------+  |
| | 4 bases        | | 33 trails      | | 28 sights          | | 15 activities     | | 7 to book ahead      |  |
| | 14 nights      | | 186.5 km, all  | | in the plan        | | lifts, cruises,   | | none has a published |  |
| | [See the shape]| | versions       | |                    | | tours             | | opening date yet     |  |
| |                | | [See trails]   | | [See sights]       | | [See activities]  | | [See bookings]       |  |
| +----------------+ +----------------+ +--------------------+ +-------------------+ +----------------------+  |
|  (each card is one link: Stops tab filtered, or Bookings, or the shape below; --surface, --r-3, --b-hairline)|
|                                                                                                             |
| HIGHLIGHTS                                                          13 places worth the journey  [See all]  |
| +-----------------+ +-----------------+ +-----------------+ +-----------------+                              |
| | [photo 4:3]     | | [photo 4:3]     | | [photo 4:3]     | | [photo 4:3]     |   (8 cards on desktop,       |
| | Moraine Lake    | | Lake Louise     | | Peyto Lake      | | Maligne Lake    |    two rows of four; photo   |
| | Day 11          | | Days 3 and 10   | | Lookout · Day 4 | | and Spirit      |    from the trip gallery     |
| |                 | |                 | |                 | | Island · Day 5  |    section that names the    |
| +-----------------+ +-----------------+ +-----------------+ +-----------------+    place, credit on hover    |
| | Athabasca       | | Takakkaw Falls  | | Johnston Canyon | | Larch Valley to |    and in Credits)           |
| | Glacier · 4, 8  | | Day 9           | | Day 3           | | Sentinel Pass 11|                              |
| +-----------------+ +-----------------+ +-----------------+ +-----------------+                              |
|  (a card opens the place page; its "Day 11" opens Days at #day-11 with the entry open, P5)                  |
|                                                                                                             |
| WHEN TO GO                                                         (W4, full section)                        |
|                                                                                                             |
| THE TRIP'S SHAPE                                   [Show all 15 days v]   (W5, collapsed by default)         |
| Banff 2 | LL 1 | Jasper townsite 4               | Lake Louise village 4        | Kananaskis Village 3     |
| 15 days · 4 long drive days · 5 days with a booking · 7 highlight days · 6 days with a warning             |
|                                                                                                             |
| WHO IT SUITS                                       KNOW BEFORE YOU GO                                        |
| Moderate · from about 6 · written for families     · Moraine Lake road: no private cars; shuttle or Roam    |
| Whole family on 14 days, adults' hike on 1         · Larch Valley: group-of-four rule when mandatory        |
| [Plan it for your party] (opens W3 editor)         · Parks Canada pass covers all four national parks       |
|                                                    (3 shown, "4 more" expands in place)                      |
+-------------------------------------------------------------------------------------------------------------+
```

- "Know before you go" lines are the trip-level notes the page already holds (booking notes and season notes), at most 3 at
  rest. Safety items (closures, mandatory group rules) are never behind "more" (principles P2 safety exception): the
  Larch Valley rule stays visible.
- The highlights row draws at most 8; "See all" opens Stops filtered to "Worth the journey". A highlight with no gallery
  photo shows the kind glyph on `--well` and "No licensed photo yet" in `--t-small` (never a stock image).

### 390, Rockies

```
+--------------------------------------+
| What you will do                     |
| 15 days through Alberta and British  |
| Columbia, in four national parks     |
| (Banff, Jasper, Yoho, Kootenay) and  |
| two provincial parks (...)  [More v] |   (two lines at rest; "More" opens in place)
|                                      |
| +----------------+ +---------------+ |
| | 4 bases        | | 33 trails     | |   (2 x 3 grid of count cards,
| | 14 nights      | | 186.5 km      | |    each 44 px minimum height,
| +----------------+ +---------------+ |    whole card is the link)
| | 28 sights      | | 15 activities | |
| +----------------+ +---------------+ |
| | 7 to book      | | 41 photos     | |
| +----------------+ +---------------+ |
|                                      |
| Highlights            13  [See all]  |
| < [Moraine Lake] [Lake Louise] [Pey >|   (horizontal snap row, 160 px cards, photo 4:3)
|                                      |
| When to go  (W4)                     |
| The trip's shape  [Show days v] (W5) |
| Who it suits / Know before you go    |
+--------------------------------------+
```

### Dolomites (full): differences only

- Lead: "14 days in South Tyrol, Veneto and Trentino, through the Puez-Odle and Fanes-Sennes-Prags nature parks..." Counts:
  4 bases · 10 trails (94.0 km, 5,337 m climb) · 11 sights · 3 activities · **3 to book ahead, earliest: Tre Cime toll road
  slot, opens 30 days before Day 3**. Highlights: 5 cards (Lago di Braies, Tre Cime loop, Lago di Sorapis, Alpe di Siusi,
  Ötzi museum), photos from the 8 gallery sections.

### Costa Rica (overview): differences only

```
+--------------------------------------+
| What you will do                     |
| 10 nights in Costa Rica. This plan   |
| has not been converted to days yet;  |
| this is the overview.                |
| +----------------+ +---------------+ |
| | 10 nights      | | 17 photos     | |
| +----------------+ +---------------+ |
| Highlights   (gallery sections as    |
|  cards, no day links: Rincon de la   |
|  Vieja, Arenal Volcano, Tabacon,     |
|  Manuel Antonio, Uvita...)           |
| When to go: Mid-February (W4 gap)    |
| (no shape, no counts of stops, no    |
|  bookings card: nothing to count)    |
+--------------------------------------+
```

Provinces and parks come only from linked place pages, so an overview trip says the country only, from its region. It
never invents a count.

---

## W3. "Plan it for": collapsed bar and the editor

### 1440, collapsed (default; state remembered on this device)

```
+-------------------------------------------------------------------------------------------------------------+
| PLAN IT FOR   2 adults · 1 child (10) · Standard pace          Plan as written: family from about 6   [pencil Edit] |
+-------------------------------------------------------------------------------------------------------------+
```

- One row, 56 px, `--surface`, `--b-hairline`, `--r-3`. Label `--t-cap` uppercase; value `--t-row`; the right-hand note
  `--t-small` `--muted`. The pencil button is `Button size="sm"` with the `pencil` icon and the word Edit (44 px target).
- Party words (one function, shared with Mine's rows): "1 adult", "2 adults", "1 child (7)", "2 children (7, 10)",
  "3 children (4, 7, 12)"; ages in the order entered; a child with no age set: "1 child (age not set)".
- After a change, a **Reset** link appears beside Edit ("Reset to the plan as written").
- The sticky day rail on Days keeps the same words in short form: "2 ad · 1 ch (10) · Std · Edit" is **not** used; it says
  "2 adults, 1 child · Standard · Edit" and truncates the pace first on a phone.

### 1440, expanded

```
+-------------------------------------------------------------------------------------------------------------+
| PLAN IT FOR   One choice for the whole trip. Any day can still be changed on its own.           [Done ^]     |
|                                                                                                             |
| ADULTS               CHILDREN                AGES (needed for each child)          PACE                     |
| [ - ]  2  [ + ]      [ - ]  2  [ + ]         Child 1 [ 7  v]  Child 2 [ 10 v]       [Relaxed|Standard|Full]  |
|                                              (0 to 17; "under 1" for 0)            Standard: one main outing |
|                                                                                     a day, back before dinner|
| Showing the plan for 2 adults and 2 children (youngest 7), standard pace. Family version on 13 days ·       |
| easy version on 2 days. Written for families with a child from about 6.                       (aria-live)   |
| [More v]  longest walk, split days                                                                          |
| Kept on this device only. Ages never go into a link you share; a shared link carries the youngest age.      |
+-------------------------------------------------------------------------------------------------------------+
```

- "Who is going: Adults only / Family" and the "Youngest" stepper are **removed**: children 0 means adults only; the
  youngest is the lowest age entered (finding I5: the disabled "no children" stepper).
- Adding a child appends "Child n [Choose age v]" and moves focus to that select. Until an age is chosen the plan uses
  10 (FAMAGE10, PLAN R-121) and the line says "age not set, planning for 10".
- Steppers: adults 1 to 12, children 0 to 8 (the copy sheet's cap). Motion: the editor grows from the bar in `--d-base`
  with `--e-std`; reduced motion jumps (P5).

### 390, collapsed and expanded

```
+--------------------------------------+      +--------------------------------------+
| Plan it for                          |      | Plan it for                  [Done ^]|
| 2 adults · 1 child (10) · Standard   |      | Adults          [ - ]  2  [ + ]      |
|                          [pencil Edit]|      | Children        [ - ]  1  [ + ]      |
+--------------------------------------+      | Child 1 age     [ 10          v]     |
                                              | Pace  [Relaxed|Standard|Full]        |
                                              | Standard: one main outing a day...   |
                                              | Showing the plan for 2 adults and a  |
                                              | 10 year old, standard pace...        |
                                              | [More v]                             |
                                              | Kept on this device only.            |
                                              +--------------------------------------+
```

The editor opens inline, never as a modal (timeline 3.1).

### Shared link state (URL has `p=family-6`, this device has a party of 2 adults and children 7 and 10)

```
| PLAN IT FOR  Shared plan: family, youngest 6 · Standard pace     [Use my party: 2 adults, 2 children] [pencil Edit] |
```

The URL wins; the device party is offered, never applied over a shared link.

---

## W4. When to go (in the Summary tab)

### 1440, Rockies (season data now; the window cards slot fills when OVR-1 lands, bundle E)

```
+-------------------------------------------------------------------------------------------------------------+
| WHEN TO GO                                                                                                  |
| BEST TIME FOR THIS PLAN                                                                                     |
| SECOND WEEK OF SEPTEMBER                                   (--t-trip, --accent-text; "Early to late          |
| After the Labour Day weekend, with the first larch colour   September" until OVR-1 wires the windows)        |
| late in the trip.                                                                                           |
|                                                                                                             |
|  Jan  Feb  Mar  Apr  May  Jun  Jul  Aug  Sep  Oct  Nov  Dec                                                 |
|  [  ][  ][  ][  ][  ][//][  ][  ][##][  ][  ][  ]                                                          |
|  ## best for this plan   // also good, with trade-offs   (blank) not researched for this plan              |
|  (month names, three letters, never single letters: finding I7; pattern + word, never colour alone)        |
|                                                                                                             |
| +---------------------+ +---------------------+ +---------------------+ +---------------------+             |
| | TEMPERATURE         | | RAIN AND SNOW       | | DAYLIGHT            | | CROWDS              |             |
| | 2 to 16 C           | | Showers; first snow | | Sunrise ~07:00      | | Lower than early    |             |
| |                     | | on high passes      | | sunset ~19:45       | | September           |             |
| |                     | | possible            | | mid-September       | | (Parks Canada       |             |
| |                     | |                     | |                     | | visitation)         |             |
| +---------------------+ +---------------------+ +---------------------+ +---------------------+             |
|  (four equal cards in one row: finding I8; --surface, --r-3; value --t-row)                                 |
|                                                                                                             |
| OTHER WEEKS THAT WORK                                     (OVR-1 fills this slot in bundle E; until then)   |
| First week of Sep: Good · crowds high · + every boat and lift runs · - Labour Day weekend start             |
| Last week of June: Good · crowds rising · + longest days, 16.5 h · - Sunshine gondola not open yet          |
| Second week of June: Workable · crowds lower · + before schools finish · - Sunshine and high trails out     |
|  (one line each from data/windows; "Plan for this window" arrives with OVR-1's `w=` key)                    |
|                                                                                                             |
| WORTH KNOWING                                                                                               |
| (i) Moraine Lake road closes in mid-October                                                                 |
| (i) Larch gold peaks in the last third of September into early October                                      |
| (!) Maligne cruise ends early October      (the warn glyph only for a closure or a hazard: finding I9)     |
|                                                                                                             |
| WEATHER  Forecast: Banff, Jasper, Lake Louise, Kananaskis (Environment Canada)  ·  Climate averages         |
|          1991-2020 (Environment Canada)                         (links, open in a new tab; W4 note below)   |
+-------------------------------------------------------------------------------------------------------------+
```

### 390, Rockies

```
+--------------------------------------+
| When to go                           |
| Best time for this plan              |
| SECOND WEEK OF SEPTEMBER             |
| After the Labour Day weekend...      |
| J F M A M J J A S O N D  (letters    |
| are aria-hidden; each cell has its   |
| full month name and state as text)   |
| [ ][ ][ ][ ][ ][/][ ][ ][#][ ][ ][ ] |
| # best   / also good                 |
| +----------------+ +---------------+ |
| | Temperature    | | Rain and snow | |   (2 x 2 grid)
| | 2 to 16 C      | | Showers...    | |
| +----------------+ +---------------+ |
| | Daylight       | | Crowds        | |
| | 07:00 to 19:45 | | Lower         | |
| +----------------+ +---------------+ |
| Other weeks that work (3)      [v]   |   (collapsed on phone)
| Worth knowing (3)              [v]   |   (a hazard line is shown at rest)
| Weather: Forecast · Climate averages |
+--------------------------------------+
```

At 390 single-letter month cells are allowed visually because the row has a legend and each cell carries its month in
text for screen readers; the 1440 frame uses three-letter names.

### Degrade

| Trip | Hero | Strip | Cards | Other weeks | Weather links |
|---|---|---|---|---|---|
| Rockies | the default window (after OVR-1) or the season label | best + also good | 4, crowds from the windows file | 3 lines | climate already sourced; forecasts from WX-1 |
| Dolomites | "Mid-July to end of August" | July, August as "the plan's months" (no "best" until a windows file exists) | 3 cards + "Crowds: not checked" | "Other weeks have not been researched yet." | from WX-1 |
| Costa Rica | "Mid-February" (data/seasons) | February | from the season file if it has weather values; else the cards are omitted | gap line | from WX-1 |

---

## W5. The trip's shape (replaces "The trip at a glance")

### 1440, collapsed (default)

```
| THE TRIP'S SHAPE                                                              [Show all 15 days v]          |
| +--------+---+----------------------------+----------------------------+----------------------+            |
| | Banff  |LL | Jasper townsite            | Lake Louise village        | Kananaskis Village   |            |
| | 2 nts  |1  | 4 nights                   | 4 nights                   | 3 nights + flight    |            |
| +--------+---+----------------------------+----------------------------+----------------------+            |
|  (bases ribbon: one segment per stay, width by nights, --surface-2 fill with a 2 px --line-2 divider;       |
|   no colour per base; the name and nights are text)                                                         |
| 15 days · 4 long drive days · 5 days with a booking · 7 highlight days · 6 days with a warning              |
|  (each phrase is a button that expands the list and filters it to those days)                               |
```

### 1440, expanded

```
| Day  | Base and plan                                           | Driving          | On foot        | Notes                      |
|------|---------------------------------------------------------|------------------|----------------|----------------------------|
| 01   | Banff · Fenland Loop and Vermilion Lakes at sunset      | ======== 2 h 30  | 4.1 km         | Long drive · Book 2        |
| 02   | Banff · Sunshine Meadows stroll, Lake Minnewanka cruise | =====    1 h 30  | ...            | Warning 1                  |
| 03   | Lake Louise · Johnston Canyon, Marble Canyon, Paint Pots| ======   2 h     | ...            | Highlight                  |
| 04   | to Jasper · Bow Lake, Peyto Lake, Ice Explorer, Skywalk | =========  2 h 55| ...            | Long drive · Highlight ·   |
|      |                                                         |                  |                | Book 1 · Warning 1         |
| ...                                                                                                                       |
| 11   | Lake Louise · Rockpile at first light, Moraine lakeshore| (no drive)       | ...            | Highlight · Book 2         |
| 15   | Kananaskis · Troll Falls if the flight leaves after 15:00| ===     1 h 15  | ...            | Flight home                |
```

- A real `<table>` with a caption ("The trip's shape, 15 days"), not a chart. Driving bar: `--ink-2` on `--well`, width by
  the trip's longest drive day (Day 8, 3 h 45 = 100%), value always written beside it. "On foot" from the timeline totals
  (`walkKm`) for the current party (illustrative "..." here; it follows the profile).
- Removed from today's chart: the 05:00 to 23:00 clock bar, the 06 / 12 / 18 scale, the dark drive-share segment, and the
  version column that said "The plan's day" on most Dolomites rows (findings I1 to I3). The version shows only as a note on
  a day where the party's version differs from the main one ("Adults' hike").
- Notes are words, never icons alone: Long drive (2 h 30 or more), Book n, Highlight, Warning n, Light day (on-foot under
  2 h and driving under 1 h, not a travel day), Flight home, Changed (after a per-day change).
- A row is a link: it opens the Days tab at that day (P5: the tab switches, the day scrolls into view, focus lands on the
  day heading).

### 390

```
+--------------------------------------+
| The trip's shape        [Show days v]|
| [Banff 2][LL 1][Jasper 4 ][LL 4][Kan 3]   (ribbon; names shortened only when a segment is under 64 px;
| 15 days · 4 long drives · 5 with a   |    full names in the expanded list)
| booking · 7 highlights · 6 warnings  |
|--------------------------------------|
| 01 Banff                    2 h 30 > |   (expanded: one 2-line row per day;
|    Fenland Loop and Vermilion Lakes  |    line 1 day, base, drive; line 2 title;
|    Long drive · Book 2               |    line 3 notes; whole row is the link)
| 02 Banff                    1 h 30 > |
|    Sunshine Meadows stroll, ...      |
|    Warning 1                         |
+--------------------------------------+
```

---

## W6. Days tab: List and Table

### 1440, Table (Rockies Day 4, from the 26 Oct build at the default party)

```
| Days   [List | Table]        Show [Everything | Stops only]               [Print this table]  [Export v]      |
|                                                                                                              |
| DAY 04 · Lake Louise to Jasper townsite · 07:30 to 19:00 · 2 h 55 driving        (table caption, --t-row)   |
| +-------+------------------------------------------+-----------+------------------+----------+--------------+ |
| | Time  | What                                     | Kind      | Where            | Takes    | Notes, book  | |
| +-------+------------------------------------------+-----------+------------------+----------+--------------+ |
| | 07:30 | Leave Lake Louise                        | start     | Lake Louise      |          |              | |
| | 07:30 |   Drive to Bow Lake                      | drive     |                  | 30 min   |              | |
| | 08:15 | Bow Lake                                 | lake      | Icefields Pkwy   | 45 min   |              | |
| | 09:10 | Peyto Lake Lookout                       | viewpoint | Icefields Pkwy   | 40 min   | Highlight    | |
| | 10:25 | Free time                                | rest      |                  | 35 min   |              | |
| | 11:00 | Early lunch and fuel, Saskatchewan River | meal      | Saskatchewan Cr. | 45 min   |              | |
| |       | Crossing                                 |           |                  |          |              | |
| | 12:30 | Ice Explorer on the Athabasca Glacier    | activity  | Columbia Icefield| 2 h      | Book ahead:  | |
| |       |                                          |           |                  |          | tour for the | |
| |       |                                          |           |                  |          | chosen day   | |
| | 14:35 | Glacier Skywalk                          | activity  | Columbia Icefield| 1 h      |              | |
| | 16:00 |   Drive to Jasper                        | drive     |                  | 1 h      |              | |
| | 17:00 | Check in, Jasper                         | check-in  | Jasper townsite  | 30 min   | From 15:00   | |
| | 17:45 | Dinner in Jasper                         | meal      | Jasper townsite  | 1 h 15   |              | |
| | 19:00 | Back at Jasper                           | end       | Jasper townsite  |          |              | |
| +-------+------------------------------------------+-----------+------------------+----------+--------------+ |
| DAY 05 · Jasper townsite · ...                                                                               |
```

(Times are the build's suggested times for Family 10, Standard; Peyto's 09:10 and the two drive rows are read from the
leg list, rounded. Illustrative where marked; the build reads them from the timeline.)

- One `<table>` per day, chronological, with `<caption>`, `<th scope="col">`, and the time cell as `<th scope="row">`.
  Sticky header row inside each table (`--z-sticky`, `--well`), rows 44 px comfortable (components 4.2). Time in
  `--t-time` with the same confidence styling as the timeline (suggested times show "~" in text, T3).
- Drive legs are indented rows of kind "drive". "Stops only" hides start, rest, meal, sun and end rows; the choice is in
  the URL (`rows=stops`) and remembered on the device.
- The table is the same rows, times and booking words as the CSV and the print (one core function, spec 5.4).

### 390, Table

```
+--------------------------------------+
| Days  [List | Table]   [Stops only]  |
| DAY 04 · Lake Louise to Jasper       |
| 07:30-19:00 · 2 h 55 driving         |
| +------+---------------------+-----+ |
| | Time | What                |Takes| |
| +------+---------------------+-----+ |
| |07:30 | Leave Lake Louise   |     | |
| |      | start               |     | |
| |08:15 | Bow Lake            |45 m | |
| |      | lake · Icefields Pk |     | |
| |09:10 | Peyto Lake Lookout  |40 m | |
| |      | viewpoint · Highlight     | |
| |12:30 | Ice Explorer on the |2 h  | |
| |      | Athabasca Glacier   |     | |
| |      | activity · Book     |     | |
| |      | ahead: tour for the |     | |
| |      | chosen day          |     | |
+--------------------------------------+
```

Three columns, no horizontal scroll: kind, where and notes fold into a second line of the What cell. Same `<table>`
semantics; at 640 px and up the three extra columns are real cells and the folded line is `aria-hidden`.

---

## W7. Bookings tab

### 1440, Rockies

```
| BOOKINGS   7 to book · 0 with a published opening date · 7 with a note only        [Export v] [Print]       |
| Filter: [Day v] [Kind v]                                                                                     |
|                                                                                                              |
| BOOK AHEAD (7)                                        (groups: Book first · Book ahead · On the day ·        |
|                                                         Not checked; empty groups are not drawn)             |
| +----+--------------------------------------------+---------------------------------------------+---------+ |
| |Day | Booking                                    | When to book                                | Link    | |
| +----+--------------------------------------------+---------------------------------------------+---------+ |
| | 01 | Calgary rental car and Edmonton one-way fee| Reserve with free cancellation once lodging | -       | |
| |    |                                            | is booked                                   |         | |
| | 01 | Parks Canada Discovery Pass or daily entry | Annual family pass likely cheaper for 2     | -       | |
| |    |                                            | weeks across 4 parks                        |         | |
| | 04 | Icefields Parkway and Columbia Icefield    | Pre-book the icefield tour for the chosen   | -       | |
| |    | Adventure                                  | day; lead time not known yet                |         | |
| | 05 | Maligne Lake cruise and Maligne Road       | Buy a few weeks ahead                       | -       | |
| | 10 | Lake Louise Lakeshore parking, Park and    | Do not plan to drive to the Lakeshore lot;  | -       | |
| |    | Ride                                       | use the shuttle                             |         | |
| | 11 | Larch Valley / Sentinel Pass group of four | (rule, shown at rest: safety)               | -       | |
| | 11 | Moraine Lake Road: no private vehicles     | Parks Canada shuttle reservation first;     | -       | |
| |    |                                            | priced commercial backup                    |         | |
| +----+--------------------------------------------+---------------------------------------------+---------+ |
| Prices: not checked yet for these 7.   (one line, not a column of blanks)                                   |
```

- Data now: export `bookings` (TRP-GL-C: `name`, `rule`, `note`, `day`, `ref`); notes pass `publicBookingNote`. "Link" is
  the official booking link when the stop has one (the `Book` link kind), else "-". Price appears only when a value is
  held (none for the Rockies today).
- Dolomites: "3 to book · 1 with an opening date". The Tre Cime row reads **"Opens 30 days before Day 3"** (the UI-NOTES
  fix: "local" only after a time).
- After OVR-2 (bundle E) the tab reads `tripItems(tab=bookings)` with booking groups; the frame stays.

### 390

```
| Bookings  7 · none dated yet         |
| [Day v] [Kind v]                     |
| Day 01                               |
|  Calgary rental car and Edmonton...  |
|  Reserve with free cancellation...   |
|  Parks Canada Discovery Pass...      |
|  Annual family pass likely cheaper...|
| Day 04                               |
|  Icefields Parkway and Columbia...   |
| ...                                  |
```

---

## W8. Photos tab

```
1440: | PHOTOS  41 photos · 14 places                                                                            |
      | Moraine Lake and the Valley of the Ten Peaks  (Day 11)                                                   |
      | [img][img][img]                                                                                          |
      | Lake Louise and Lake Agnes  (Days 3, 10)                                                                 |
      | [img][img][img]                                                                                          |
      | ... grouped by the gallery's sections, each section heading links to its place when one matches          |
      | Credits (41)  [v]                                                                                        |
390:  | Photos 41 · 14 places                |
      | Moraine Lake ... (Day 11)            |
      | [img][img]   (2 columns, lightbox)   |
```

Lazy: the gallery chunk and images load when the tab opens (today's `LazyGallery`). Sections not in the plan (Waterton
Lakes, Mount Assiniboine) are labelled "Nearby, not in this plan".

## W9. Stops tab

The OVR overview (trip-overview spec 3.3), unchanged except that its "[Day by day] [Trip overview]" toggle is gone (the
page tabs replace it) and its Bookings sub-tab becomes the page's Bookings tab. Chips: Trails 33 · Sights 28 · Activities
15 · Stays 4 · Food · Getting around, with the OVR filters (effort, duration, booking, day, base, suits) and counts. Until
OVR-2 ships (bundle E), the tab shows today's By category view (`CategoryView`, lazy since OVR-0).

---

## W10. Place pages by type

Measured problems these answer are in the spec, section 7.2 (evidence table).

### 1440, Trail, Adolf Munkel Weg (Early research · 30 of 32)

```
+-------------------------------------------------------------------------------------------------------------+
| Places > Italy > South Tyrol                                                                                |
| [photo or kind glyph band]  Trail · Val di Funes · South Tyrol                                              |
| ADOLF MUNKEL WEG                                       Early research · 30 of 32  [What is not checked v]   |
| A forest-and-meadow path under the Odle north faces, with huts on the way.   Worth a detour (why)            |
| [Directions to Zanser Alm car park]  [Save to a trip]  [Export v]  [Share]  [heart]                          |
+--------------------------------------------------+----------------------------------------------------------+
| 12.4 km · 593 m up · 876 m down · high 2,045 m    | [map: trailhead, car park, OSM line]                    |
| 3 h 50 to 4 h 30 adults · Moderate · point to point | In Dolomites, 13 nights · Day 13                       |
| Road open 1 Jun to 31 Oct · Dogs on a lead         | Nearby: Santa Maddalena 3 km · Seceda 9 km · ...       |
| (glance: only known facts; 6 to 8 values)          |                                                        |
+--------------------------------------------------+----------------------------------------------------------+
| BEFORE YOU GO   Book: paid car park at Zans; reserve online in high season (official, read 18 Oct 2026)   |
| THE ROUTE       [elevation profile]  Sources disagree on time: 3 h 50 to 4 h 30 (official) vs 3.8 h        |
| WHO IT SUITS    From about 10 · Carrier OK · No stroller access · long descent of about 880 m              |
|                 (safety rows keep their own visible gap: "Minimum age: not checked yet")                   |
| HOW TO GET THERE  Trailhead Zanser Alm 1,680 m · Car park 10 EUR/day, traffic light when full · Bus 330    |
| FACILITIES      Food: hut · Dogs: lead                                                                     |
| LINKS           Official (1) · Booking (1) · Route (6) · Conditions (3) · Report (2)                       |
|                                                                                                             |
| NOT CHECKED YET  (one block, one line per section, --t-small --muted)                                       |
|   Route: track high point, turnaround points · When to go: best weeks, time of day, snow-free window ·     |
|   Facilities: toilets, drinking water, shade, phone signal · Options and prices: booking window, price ·    |
|   Who it suits: wheelchair, access detail, accessible toilet and parking, capacity, surface, scrambling,   |
|   fixed aids, child time, water crossings, snow until                                                       |
|                                                                                                             |
| FACTS AND SOURCES  [v]   (collapsed drawer: sources only, never the values again)                           |
+-------------------------------------------------------------------------------------------------------------+
```

Removed: "On this route you can also" (empty on all 348 full pages), "Options and prices" as a section (no row filled),
the duplicate Distance and Climb rows under "Effort and time" and again under "Facts and sources", the empty "Photos"
section (one "No licensed photo yet" line in the header band instead).

### 390, Town with basics only, Akureyri (Basics only)

```
+--------------------------------------+
| Places > Iceland > Northeast         |
| [kind glyph band, 120 px]            |
| Town · Akureyrarbaer · Northeast     |
| AKUREYRI                             |
| Town in Akureyrarbaer, Iceland.      |
| Basics only: name, kind, map point   |
| [Directions] [Save] [Share] [heart]  |
| [map, point placed by hand]          |
| Nearby                               |
|  (illustrative: the near method's    |
|   places within 30 km, nearest first)|
| Not researched yet                   |
|  Season, parking, getting there,     |
|  fee, hazards, summary, photo, links |
+--------------------------------------+
```

Today's page: 7 sections, all empty, 18 "not checked yet" phrases, five empty link tabs each saying "not checked yet".

### 390, Lake, Maligne Lake and Spirit Island (Early research)

```
| Lake · Jasper National Park · Alberta |
| MALIGNE LAKE AND SPIRIT ISLAND        |
| Worth the journey (why)               |
| [Directions] [Save] [Share]           |
| Glance: Cruise to Spirit Island ·     |
|  Canoe rental · Parking at the        |
|  lakeshore · Road open (season)       |
| In Canadian Rockies · Day 5           |
| Before you go / Who it suits /        |
|  Getting there / When to go           |
|  (only rows with values)              |
| Not checked yet (one block)           |
```

### 390, Offer, Jasper wildlife tours (Basics only on the full template)

```
| Wildlife tour · Jasper                |
| JASPER WILDLIFE TOURS                 |
| Basics only                           |
| Limits (safety, always shown):        |
|  Minimum age: not checked yet         |
|  Height or weight: not checked yet    |
| Operator · Duration · Season · Price  |
|  only when held                       |
| Not researched yet: operator, hours,  |
|  duration, price, booking window,     |
|  meeting point, photo                 |
```

Today's page: 11 sections, 7 with nothing filled, 59 "not checked yet" phrases (the second highest of the sample).

### 390, Park, Castle Provincial Park (Basics only on the full template)

```
| State or provincial park · Alberta    |
| CASTLE PROVINCIAL PARK                |
| [Directions] [Save] [Share]           |
| Places inside (from the area tree)    |
|  (illustrative: counts by kind from  |
|   the area tree, as links)            |
| Used in: Canadian Rockies, 14 nights |
| Not researched yet: entry and pass,   |
|  season, facilities, summary, photo   |
```

Today's page: 11 sections, 9 with nothing filled, 41 phrases.

### Type templates (glance facts, then sections in order; a section with no value is not drawn)

| Type | Glance facts (at most 8, only when held) | Sections in order |
|---|---|---|
| Trail | distance, climb up/down, high point, time, effort, route type, season, dogs | Before you go · The route · Who it suits · How to get there · Facilities · Links |
| Lake | swim, boats, loop walk, parking, fee, season, best time of day | Before you go · Who it suits · How to get there · When to go · Facilities · Links |
| Viewpoint, summit | walk from the car, elevation, best light, season, exposure | Before you go · Who it suits · How to get there · When to go · Links |
| Waterfall, canyon | access walk, season, best light, stroller | as viewpoint |
| Town | trips that use it as a base, nearest airport (trip-origin spec), season | Getting there · Nearby · Links |
| Park, area | designations, places inside by kind, entry or pass, season | What is inside · Before you go · How to get there · Links |
| Island | how to get there (ferry or bridge), season, places inside | as park |
| Offer (tour, lift, cruise, rental) | operator, duration, season, hours, price, ages and height or weight limits | Limits (safety) · Options and prices · How to get there · When to go · Links |
