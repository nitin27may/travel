# Place page sections: the contract's 14 sections, designed

Status: design, 18 Oct 2026 (travel-design-reviewer, S1 Part 0). Governs the layout, wording, states and motion of every
place, route and offer page section that had no design before S1: Cover with the relevance badge, At a glance, the
warnings ("Before you go"), The route or the activity, Options and prices, How to get there, When to go, Facilities, At
this place you can also, Nearby (worth adding, similar nearby, Plan B, the pointer), and the empty and gap state of each.
"Who it suits" is [suitability-display.md](suitability-display.md), reused unchanged. Part B of
[S1](../build/public-site/S1-who-it-suits.md) builds from this page.

Mock: [place-page-sections/mock/index.html](place-page-sections/mock/index.html), five pages by `?page=`:
`moraine` (a place with rich data), `larch` (a route whose payoff carries the draw), `gondola` (a lift line and its
ticket offer), `louise` (the near-empty page), `states` (every section's empty, gap and edge states). `?theme=dark` for
dark, `?clean` hides the dashed blue spec notes, `?pop` opens the badge provenance. Values are illustrative unless this
page says they come from the data; prices and times are 2026 patterns.

Inputs read: [capture-contract.md](../../../research/method/capture-contract.md) 2.5, 2.7, 3, 6; `data/schema/capture/contract.json`
(14 sections, 236 properties); [relevance.md](../../../research/method/relevance.md) 3.2, 3.6, 3.7, 6.2, 7;
[CC-adapter-requests.md](../build/public-site/CC-adapter-requests.md); [principles.md](foundation/principles.md);
the built `web/components/places/PlacePage.tsx`; the Rockies capture, suitability and derived relevance files.

## 1. Decisions

| # | Decision | Why |
|---|---|---|
| PS1 | **One home per property.** Every property renders with its provenance, gap marker and conflicts in exactly one row: its registry section (contract 6.1), except that a property in the type's suitability row is homed in section 4 when its registry section is 5. Any other appearance (glance slot, warning line, a collapsed Who it suits summary, the cover) is an **echo**: the same `Val`, the same provenance popover, never a gap marker or a count of its own. | Sections 3, 4, 5 and 9 of the contract overlap with the suitability groups. Without a home rule the same gap would show three times and the research counts would disagree (T3). Echoes keep P3 (the glance) without forking a fact. |
| PS2 | **Reading order is the contract order 1 to 14 on every surface.** At 1024 and wider a 380 px sticky rail carries only the map card and the primary action; it is a second view of section 7, not a section. Below 1024 the rail is not drawn and the map sits at the top of section 7. | One template for every type (contract 6.1). The rail keeps Directions one glance away while reading (P3, P7) and costs nothing on phone (T2). |
| PS3 | **One primary (amber) action per viewport.** The rail holds it on desktop: "Directions to <where you can park>" for places and routes, "Tickets and times" for a record whose ticket offer is the point (a lift). The same buttons in the cover and in section 7 are secondary at 1024 and wider, and primary on phone where the rail is absent. | Amber is "the primary action" in the foundation; two amber buttons in one view split the eye (P7). |
| PS4 | **Directions go to where you can drive.** When the subject has no road access (shuttle only, a route start with no parking, a summit), Directions target the access place that `parks_for` or `serves` it, and the button names it ("Directions to the Park and Ride"), with one line saying why. With no access place stored, Directions go to our point and say so. | T5: a pin on a lake you cannot drive to sends a car to a closed road. |
| PS5 | **The relevance badge is an outlined chip: 1 px `--ink` border, `--ink` 600 text, a signpost glyph.** At most one, after the title in the cover body and after the name on rows. It is a button that opens its provenance popover. Never amber, never green, never filled. | It must not read as a rule (filled, lock), our suitability advice (`--line-2` outline, person) or a selection (amber). The darker border and the glyph separate it without a hue (palette rules, suitability-display 3.1). |
| PS6 | **The cover keeps the title on the photo and puts the badge, the `why` line, the payoff line and the pointer below it, on `--surface`.** No chip sits on a photo. With no licensed photo the media band is a 180 px `--well` band with the kind glyph, and the title moves below it. | Contrast on photos is unpredictable; chips on `--surface` have known ratios. A 420 px empty band on a near-empty page wastes the first view (P3). |
| PS6a | **Amendment (S1b review, 19 Oct 2026): a place with no licensed photo keeps the dark band with the title on it, at most 260 px, instead of a 180 px well band with the title below.** The title is set at the page size (72) rather than the cover size so a long name stays in the band. | White on `--header` is above 13:1 in both themes and the band is the same object as the photo cover, so the page does not change shape when a photo arrives. |
| PS7 | **Section 3 is titled "Before you go".** It lists every Rest! item that is not the main hazard: access rules, bookings that must be made, closures in force, wildlife rules, out-of-season access. Each line is one sentence, a mono kind label ("Access", "Book", "Closed", "Wildlife", "Last down"), the basis and read date, and a link to its home row. No cap on lines (P2 safety exception). | "Warnings" overstates a booking; "Before you go" is the parent's own question. The hazard that decides the day is the Who it suits warning line directly below, so it is not repeated (PS1). |
| PS8 | **Plan B sits under the risk it answers.** For an anchor with a fallible access cost, a "Plan B" line follows the booking line in section 3 ("No seat? Peyto Lake is the same kind of view, roadside, with no booking. 50 km.") and the same place is tagged "Plan B" in Similar nearby. | Relevance 6.2 places it on the page without a slot. A parent reading "seats sell out" needs the fallback on the same line, not three sections later (P2, P6). |
| PS9 | **The pointer lives in the cover**, after the `why` line: compass glyph, serif 16 `--ink-2`, "Coming from far? Nearby, <place> is the one people travel for. <km>". Under the day lens it becomes the drive from the hub. Never on a place whose pointer target is its own `part_of` parent, its payoff (`reaches`, `draw_from`) or its start: there the cover says "Part of <parent>" instead. | It answers the far visitor's first question in the first view (P3), and it is a pointer, not a put-down (relevance R7). The guard fixes a real case (section 7, F1). |
| PS10 | **Section 11 holds both questions**: "Nearby, worth adding" (as well as) first, then a sub-block "Similar nearby" (instead of). Hand-picked pairs first with their reason in italic serif and "our pick · <source>"; derived pairs after; at most 3 each. A pair with no point shows no distance. | Relevance asks for "Similar nearby" as a new section; the contract fixes 14. Folding it into 11 keeps the template and keeps "as well as" and "instead of" side by side, which is how a visitor compares them. |
| PS11 | **Offers split by class.** Section 6 shows the subject's own ticket and access offers (what you buy to get in or on: a lift ticket, a park pass, a shuttle seat, a timed entry) and an offer page's variants. Section 10 shows experience and rental offers `at` or `on` the subject, grouped by domain. Section 7's way rows point to the section-6 offer they need ("Seat needed · CAD 8"). | Contract 6.1 puts price and window in section 6 and "at this place" offers in section 10; the class decides which, from data, with no type branch (CC8). |
| PS12 | **Routes: section 7 owns start, on the way and payoff; section 10 owns offers on the route and its payoff's offers.** Section 10's heading follows the layer: "At this place you can also", "On this route you can also", "With this you can also" (offer). A route whose payoff has around items lists them under a group label "At the payoff: <name>". | Contract 2.5 item 3 and 6.1 row 7 both claim `passes` and `reaches`. Section 7 wins because those places are the route's shape; section 10 stays "things to do", never "places on the way". |
| PS13 | **The glance strip** reads `display.glance`, else the first six R properties with a short renderer, **skipping any property the Who it suits chip row already shows**, ordered by home section with section-4 properties last. Slots are links: a click scrolls to the home row (smooth, or a jump under reduced motion) and the row flashes a 3 px `--ink` ring for 1.2 s. A missing R slot shows the gap chip; a type with fewer properties draws fewer slots and never pads. | P3: six answers at a glance, one click to the evidence. Repeating "1 h 30 – 3 h" in the strip and in the chip below wastes one of six slots. |
| PS14 | **Empty and gap states use only four forms**, the same in every section: a value; a searched-none value sentence in `--ink-2` with its search date ("No public transport found · searched 12 Oct 2026"); the dashed gap chip "Not checked yet" at an R slot; one closing line "? Not checked yet: a, b, c" for missing A properties or for an R section with no values. A section is absent only when every property is N for the record (D9), and the derived blocks (Similar nearby, the pointer, Plan B) are absent when derive finds nothing, since nothing was researched. | The owner's marker rule (P2 table) with suitability-display D8 and D9, applied to every section. "No data" and italic prose are gone. |

### Research level words (S1b round 4)

The word beside the count counts every check the page has, the place checks and the family checks of Who it suits together, and says why a page is held back. The word and the count come from one scope (`web/lib/public/levelWord.ts`, REVIEW4 4.29): "Checked" needs a full count, and "Partly checked" adds the optional or untracked checks still open after "of" ("25 of 29", never "25 of 25"). The tooltip carries the one explanation of the two scopes: "25 of 25 required checks done, place and family together; 4 optional checks are still open and counted after \"of\""

| Level from the engine | Words | Rule |
|---|---|---|
| complete | "Checked" | nothing missing |
| usable | "Partly checked · n of m" | required checks done, some optional ones open; m counts the open ones too, so a Partly never carries a full count |
| draft, a third or more of the checks done | "Early research · n of m" | a required check is open |
| draft, under a third done | "Basics only" | |
| any level, no point stored | "Early research · n of m, no map point yet" | a place with no point never reads above Early research, and the count is followed by the reason |

"Draft" is never shown. The hints a researcher follows ("add a point with 5 decimals") stay in the research tools (`capture.ts gaps`); the page shows only "Not checked yet".

## 2. The page frame

```
1440                                                       content 940 · gap 28 · rail 380 (sticky, top 76)
┌─ breadcrumbs ───────────────────────────────────────────────────────────────────────────────┐
│ ┌ 1 COVER ─────────────────────────────────────────┐  ┌ RAIL ──────────────────────────┐    │
│ │ photo 420, kicker + title on the photo           │  │ map card (point, access, ways) │    │
│ │ [signpost Worth the journey] why line (italic)   │  │ one line: what the map shows   │    │
│ │ payoff line (routes) · pointer (local places)    │  │ [Directions to the Park and Ride] (amber)│
│ │ summary · actions (Directions, Save, Share, Globe)│  │ In public trips (when any)     │    │
│ └──────────────────────────────────────────────────┘  └────────────────────────────────┘    │
│ 2 GLANCE  3 × 2 slots, each a link to its home row; level chip and place-check count below  │
│ 3 BEFORE YOU GO · 4 WHO IT SUITS · 5 THE ROUTE · 6 OPTIONS AND PRICES · 7 HOW TO GET THERE   │
│ 8 WHEN TO GO · 9 FACILITIES · 10 AT THIS PLACE YOU CAN ALSO · 11 NEARBY, WORTH ADDING       │
│ 12 PHOTOS · 13 LINKS · 14 FACTS AND SOURCES                                                 │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
390: one column, no rail; glance 2 × 3; the map card opens section 7; actions wrap two per row.
```

Every section is a `--surface` card, radius 12, 1 px `--line`, padding 18 22 (phone 14). Heading Big Shoulders 800
26 (phone 23) uppercase; a mono 12.5 `--muted` meta on the right (read date, count, "2026 prices used as a pattern").
Section ids are the contract ids (`#warnings`, `#access`, ...), so a glance slot, a warning link and a shared URL land on
the section, with `scroll-margin-top` clearing the sticky header.

## 3. Sections

### 3.1 Cover (section 1)

- Photo 420 (phone 300) with the bottom gradient, kicker mono 12.5 white 80% "Lake · Banff National Park · Alberta",
  title Big Shoulders 800 72 (phone 46) white. No chip on the photo (PS6).
- Body on `--surface`: the badge (PS5) then the `why` line, serif italic 19 `--ink-2`; the badge wraps above the line
  when the line is long. The badge opens the provenance popover (components 5.2, non-modal, in flow on the mock):
  "Our judgement · read <date>", the judgement note, designations with their scope ("inherited from the park"),
  editorial mentions, fame signals with read dates, and "No ratings or review counts are used". Esc closes and returns
  focus.
- Routes: a payoff line above the badge, mono 13.5: "To **Sentinel Pass** · 2,611 m · photo and judgement from the pass",
  linking the payoff place (CC-adapter 3). A route with no payoff place and `route_is_attraction` keeps its own judgement
  and shows no payoff line; a route expected to have one and lacking it shows the gap chip "Payoff place not checked yet".
- The pointer (PS9) and, for parts, "Part of <parent>".
- Summary serif 17, at most 68 ch. Actions: Directions (PS3, PS4), Save to a trip, GPX (routes), Share, Globe.
- States: not judged (draw R, missing): a dashed badge "Worth the trip? Not checked yet". Judged with no badge (filler,
  local only): nothing, never a negative chip. No photo: PS6.

### 3.2 At a glance (section 2)

3 × 2 grid (phone 2 × 3) of slots inside one bordered card, hairlines between. Slot: mono 12 label with a 14 px glyph,
serif 600 18 (phone 16) value, mono 12 provenance "Parks Canada · read 12 Oct 2026". Conflicts show the honesty chip
"2 values" (dashed `--crit`, tooltip). Below the strip, the level chip ("Usable", "Usable, partly unverified", "Draft")
and the place-check count "21 of 26 place checks done · read 12 Oct 2026" (the contract's engine; the family-check count
stays in section 4). Rules: PS13.

### 3.3 Before you go (section 3)

List of lines (PS7): glyph 17 px in `--warn` (`--crit` for "Closed" when the closure is in force today or in the trip
window), mono 11.5 uppercase kind label in the same colour, the sentence serif 16.5 `--ink` with the decisive number in
600, then a mono 12.5 `--muted` line "<basis> · read <date> · <home section link>". Plan B follows its line (PS8). A
checked "none" is a value line with a neutral glyph: "No booking or permit needed · Parks Canada · read 12 Oct 2026".
With R properties unanswered: one closing line "Not checked yet: bookings, permits and closures · ask <land manager>
before you go". A booking rule carries "2026 rule used as a pattern" on future-dated trips (T3).

### 3.4 Who it suits (section 4)

[suitability-display.md](suitability-display.md) sections 1 to 4, unchanged. Two notes for the page: its Facilities and
When you can go groups are echoes of sections 9 and 8 (PS1), so their gap markers and counts are not repeated; on a lift
line the research line ends "· from the ticket", because the chips come from `offer/<ref>#ticket` (CC-adapter 4).

### 3.5 The route or the activity (section 5)

Titled by the record: "The route" (trail), "The ride" (lift), "The course", "On the water" only when a section-5
property is left after PS1. Anatomy: the stat line mono 14 (distance, up, down, high point, adult time; units muted);
L4b's `TrailMap` unchanged, full content width, 16:7; L4b's `TrailProfile` under it, 160 px, components 4.4 (amber
only on the scrub cursor); the markers list (name serif 15, "4.3 km · 2,440 m" mono) for `passes` and the payoff;
`TrailExport` (GPX, KML) with "exports carry the ODbL notice and the read date". Honesty chips from L4b stay as they are:
"Route not confirmed yet", "Shape estimated from length and climb". A lift draws its line as a dotted cable between the
two stations, with ride time, vertical and cabin. Not drawn for places whose section-5 properties are all N or homed in
section 4 (lakes, viewpoints, museums).

### 3.6 Options and prices (section 6)

One card per offer (PS11): name serif 600 17, "operator · class · how it is sold" mono 12.5; the from-price serif 600 17
right-aligned with "adult · return · 2026 price" under it; chips: the offer's own limits chip (rule look) when it
differs from section 4, the window chip ("Book ahead · 48 h release at 08:00 MT"), frequency or slots, refund; a
price table (who · price · read) at most 520 px wide; one "Book on <operator>" button with "official · opens in a new
tab". Variants are rows of the same card. States: price not published is a value ("Price not published · searched
<date> · ask the operator"); a missing R price or window is a gap chip in its slot; an offer with no `at` place shows
"Where: Not checked yet · no meeting place recorded" (the minitrekking, CC-adapter 5). Not drawn when nothing is sold
on or at the record (every R? trigger false).

### 3.7 How to get there (section 7)

- Header count: "3 ways", or "start, payoff and on the way" for a route; meta "no parking at the lake" when it applies.
- **Ways** (places): one row per `reached_by` route, lift, road or shuttle: 34 px glyph tile, name (link to its page),
  mono line "from → to · time · frequency", chips for the effort name ("Easy · Parks Canada Easy") or the seat or ticket
  it needs, linked to section 6. **Routes**: Start, On the way (with `at_km`), Payoff, each a row with its link.
- **Where you arrive**: access point cards (two columns, one on phone): name, role chip (Stop, Parking, Trailhead),
  `walk_m` with its source, fee, fills-by with "2 dated reports · Aug 2025, Sep 2025" (one report is a gap, contract
  3.2 fills_by), transit and timetable link, accessible spaces.
- **Directions row**: the Directions button (PS3, PS4), Apple Maps, and the point line "Our point · OpenStreetMap way
  4123987 · 51.4269, -116.1774" (the L4b 2.41 wording).
- States: ways not researched: "Not checked yet: the shuttle, roads and trails that reach the lake"; access points
  missing: the same closing line; transit searched-none is a value.

### 3.8 When to go (section 8)

A month grid (mono 11.5 initials; rows labelled mono 12): one row each for the season (operating), getting there
(`access_season`, by `via`), snow-free window (routes) and best weeks (`best_window`). Cells: open `--ink`; part of the
month hatched `--line-2`; best weeks `--ink-2` at 55%, drawn as part cells when the window starts or ends mid-month; not
checked yet as dashed empty cells. Legend under it. Then "Best time of day: sunrise · the Ten Peaks light first" and
crowds with their report count, serif 15.5. Hours: "Today: 08:00 – 21:00 · last up 20:30 · last down 21:00" at rest,
the season table below (`last_down` in 600, it strands people), "2026 timetable used as a pattern" in the meta (T1, T3).
Hours that do not apply (open land) say so in one line rather than leaving a hole.

### 3.9 Facilities (section 9)

Collapsed group with values inline, exactly like the suitability groups ("toilets at the shuttle stop · cafe at the
lodge · Not checked yet: drinking water, phone signal, baby change"), meta "4 of 7 recorded". Opening is 200 ms
`--e-out` (grid-row height), the chevron rotates, the scroll position is kept; rows are the suitability row anatomy with
provenance stubs. Titled by layer: "On site", "Along the way", "At both stations".

### 3.10 At this place you can also (section 10)

"Part of <parent>" first (mono 13, link). Group labels mono 12 uppercase by domain ("On the water", "Viewpoints here",
"At the payoff: <name>"). Row: glyph tile, name (link) and its badge if any, mono line "Rental · at the lodge dock · June
to September", the two card chips (kids, effort or time; suitability-display D5), a right-aligned "where" ("at the
dock", "350 m"). At most 6 rows at rest; "Show all 9" expands in place (200 ms, focus stays on the button, the URL does
not change). States: nothing recorded is an A closing line "Not checked yet: guided walks and offers on this route".

### 3.11 Nearby, worth adding (section 11)

PS10. Pair row: as section 10 plus the reason line (serif italic 15.5) and "our pick · <source>" for hand-picked pairs;
right column "starts here · about 4–6 h" or "from the stop · about 2 h" (the extra time, relevance 3.2 sort). Similar
nearby rows: name, badge, the access load in words ("roadside · no booking", "shuttle or bus only · seat needed"),
family effort when the class has one, straight-line km on the right; "Plan B" tag on the Plan B row. States: pairs
checked and none qualify: "Nothing nearby is short enough to add · checked <date>" (a value); pairs not researched: the
A closing line; similar nearby empty: block not drawn.

### 3.12 to 3.14 Photos, Links, Facts and sources

Unchanged from the built page (gallery 4.5, `LinksTabs`, the sources list), with the four state forms of PS14: "No
licensed photo yet, so none is shown"; a link kind with none found is a dashed tab "Trip report · none found"; a link
kind not yet searched is a dashed tab "Official · not checked yet"; sources collapse to one group with counts by
publisher.

### 3.15 Motion

Group open and "Show all": 200 ms `--e-out` on grid-row height, chevron 200 ms; popovers 200 ms fade and 4 px rise,
non-modal, Esc closes and returns focus; glance and warning links scroll smoothly and flash the target 1.2 s. Nothing
jumps to the top; reduced motion jumps and keeps the flash as a static ring for 1.2 s (P5).

## 4. The near-empty page: Lake Louise

Read from the data on 18 Oct 2026, not invented. After S1 reads the sidecars, Lake Louise has its family checks: the
R2a suitability record answers age band, kid note, stroller (all-terrain), wheelchair (partial, 20 accessible stalls),
time on site (1 h 30 – 3 h), walk from the lot (200 m) and access season (shuttle 15 May – 12 Oct 2026, road all year
with parking that fills before sunrise), so section 4 reads "7 of 7 family checks done". The relevance record gives the
badge and the `why` line. Almost nothing else in the contract is answered. The mock (`?page=louise`) draws every section
the lake has:

| # | Section | What shows |
|---|---|---|
| 1 | Cover | no photo: 180 px well band; badge "Worth the journey" and its `why`; "No licensed photo yet" line |
| 2 | Glance | Booking, Access points, Best time of day as gap chips; Getting there, Walk from the lot, Wheelchair as values; level "Draft" |
| 3 | Before you go | "Not checked yet: bookings, permits and closures · ask Parks Canada before you go" |
| 4 | Who it suits | three chips, collapsed groups, closing line "Not checked yet: hazards" |
| 5 | The route or the activity | not drawn (all N for a lake): no marker |
| 6 | Options and prices | "Not checked yet: shuttle seat, park pass and parking prices" (price R?, the trigger holds) |
| 7 | How to get there | ways not checked; the lower lot card with its walk and stalls, fee and point as gap chips; Directions to the lake's own point, saying no parking point is stored |
| 8 | When to go | shuttle and road rows from data; best weeks as dashed cells; "Not checked yet: best time of day, best weeks" |
| 9 | Facilities | "Not checked yet: toilets, drinking water, food, shade, phone signal, picnic, baby change"; accessible parking as the one value |
| 10 | At this place you can also | the canoe rental (offer `at` the lake, "Worth a detour"), its ages as a gap chip |
| 11 | Nearby | pairs: closing line; Similar nearby: Moraine Lake and Emerald Lake from derive |
| 12-14 | Photos, Links, Sources | gap lines and dashed link tabs |

The page reads as research in progress, not as a broken page: every hole is in the same words at its own slot, and
the three things a visitor most needs that are present (how to get there in season, the walk, who it suits) are in the
first view.

## 5. Scored against the principles

| Principle | How the design meets it | Residual risk |
|---|---|---|
| P1 scale | One template from the contract; at most 6 around rows and 3 pairs and 3 similar at rest, counts and "Show all"; no list grows with the catalogue | A cluster (Niagara) with 30 children relies on "Show all" grouping; check it on the built page |
| P2 progressive | Safety items at rest in section 3 and the Who it suits warning line; detail one click (groups, popovers); empty sections stay as markers | The page is long on phone (Moraine about 8,600 px); the glance and section links carry the jump |
| P3 glance | Cover answers "is it worth it" (badge, why, pointer); glance answers six facts; each is one click from its evidence | — |
| P4 no manual | Plain labels ("Before you go", "Seat needed", "Plan B"), no codes, the glyphs have words beside them | The signpost glyph is new; it never stands alone |
| P5 smooth | 200 ms opens in place, no scroll loss, reduced-motion jumps (3.15) | — |
| P6 right moment | Booking where it is due (section 3 and 6), steepness in section 5, provenance one step away | — |
| P7 primary goal | One amber action per viewport (PS3): Directions, or Tickets and times | — |
| P8 catalogue | Everything is on the item page; list rows gain only `badge` (S12); no new list keys from this design | — |
| P9 server-ready | Every block reads the adapter's page model (`sections`, `suitability`, `relevance`); no client fetch | — |
| T1 when | Section 8 months, hours with last down, booking windows with their release rule | — |
| T2 field | Phone single column, 44 px targets, Directions to where you park, GPX and KML per route | The map card on phone sits in section 7, not at the top |
| T3 trust | Read dates on every value and line; "2026 … used as a pattern" on prices, rules and timetables | — |
| T4 families | Who it suits stays fourth and its chips are first in any row; Plan B and pairs carry the kids and effort chips | — |
| T5 honest maps | Directions target named; "Our point" with its source; unconfirmed lines dashed and not exported | — |

Contrast pairs used (light / dark; tokens.md 2.2): `--ink` on `--surface` 16.06 / 13.83 (badge text and border, titles);
`--ink-2` on `--surface` 12.09 / 10.76 (why line, Plan B line); `--muted` on `--surface` 6.94 / 7.45 (stubs, gap
lines); `--muted` on `--bg` 6.42 / 8.23 (glance footer); `--warn` on `--surface` 6.92 / 8.31 (section 3 labels and
glyphs); `--crit` on `--surface` 6.61 / 7.01 ("Closed"); `--ink` on `--surface-2` 13.66 / 12.24 (selected link tab);
`--accent-ink` on `--accent` 6.96 (primary button); `--line-2` on `--surface` 3.67 / 3.42 (borders, 3:1 UI); kicker
white 80% on the photo gradient's 85% `--header` foot. All AA; no new token.

## 6. Conflicts, and how each is resolved

| # | Conflict | Resolution | Change required |
|---|---|---|---|
| X1 | Contract 6.1 row 2 fills the glance with "the first six R properties", which repeats the Who it suits chips (time on site, stroller on a lake) | PS13: skip chip-row properties, order by home section, section-4 properties last | contract 6.1 row 2 and Part A `glanceFor` (coordinator) |
| X2 | Contract section 3 lists "main hazard"; suitability-display draws the same hazard as its warning line | PS7: the hazard is homed in section 4's warning line when section 4 is drawn; section 3 takes it only when section 4 is absent | none to suitability-display; contract 6.1 row 3 gains the sentence |
| X3 | Contract section 5 has a KindBlock; suitability-display's kind group ("On the water", "The course") shows the same `ext.*` fields | PS1: section 4 homes suitability-row properties; section 5 draws the rest (line, stats, map, profile, export) | contract 6.1 row 5 gains the sentence |
| X4 | Contract section 9 Facilities and suitability-display's Facilities group hold the same toilets, food and shade | PS1: section 9 is the home of every facility property; section 4's group is an echo with the same values and popover, no gap of its own | none; recorded here. Question Q3 |
| X5 | Contract 2.5 item 3 puts a route's `passes` and `reaches` in section 10; 6.1 row 7 puts them in section 7 | PS12: section 7 | contract 2.5 item 3 (coordinator) |
| X6 | Relevance 6.2 adds "Similar nearby" as a new section; contract 6.1 fixes 14 | PS10: a block inside section 11 | relevance 6.2 row "Similar nearby" points here |
| X7 | Relevance 6.2 gives the pointer and Plan B no position | PS9 (cover), PS8 (section 3 and the Similar block) | none |
| X8 | Contract 6.1 puts price and window in section 6 and offers `at` the place in section 10 without saying which offers go where | PS11: by offer class | contract 6.1 rows 6 and 10 gain the class rule |
| X9 | Contract 2.7.4 excludes ways, payoffs and parts from pairs but not a route's start place, which section 7 already shows | Pairs also exclude the record's `starts_at` place | contract 2.7.4 list (coordinator); Part A `relevance.ts` |
| X10 | The built page targets "the pin we stored" for Directions even when the place has no road | PS4 | Part B; patterns 3.6 text |
| X11 | Patterns 3.6 has the rail carry Hazards and Links; the contract orders them 3 and 13 | PS2: the rail carries the map and the primary action only; Hazards and Links render in order | patterns 3.6 (foundation edit, coordinator) |
| X12 | S1 check S1 says "Lake Louise shows every R gap"; the data has every family check answered | Read as every contract (place) R gap; section 4 shows "7 of 7" | S1 brief check S1 wording |

## 7. Data findings for Part A and CS7 (read 18 Oct 2026)

| # | Finding | Where | Who |
|---|---|---|---|
| F1 | The Lake Louise Lakeshore route's `far_pointer` is Lake Louise at 0 km, its own `part_of` parent ("Coming from far? Nearby, Lake Louise…" on the lakeshore trail would be wrong); the Moraine Lakeshore has the same pattern | `data/relevance/derived/canadian-rockies-2029.json` | Part A `relevance.ts` applies the PS9 guard; derive could exclude `part_of` targets |
| F2 | Moraine Lake has `plan_b: null` although access is shuttle only: its relevance `access_cost` is `[]` with a note deferring to the suitability `access_season.via`, so derive sees no fallible cost. Relevance 3.2 names Peyto as the Plan B | same file; `data/relevance/canadian-rockies-2029/R2a.json` | derive reads `access_season.via: shuttle` as `shuttle_only`, or CS7 records it |
| F3 | Larch Valley is still `route_is_attraction` with no payoff place, so check S6 ("names and links Sentinel Pass") cannot pass on today's data; the mock shows the target state | `data/capture/canadian-rockies-2029/migrated.json` | CS7 (payoff places batch) |
| F4 | Derived `part_of` is mutual between Lake Louise and its lakeshore trail | derived relevance | Part A: the "Part of" line reads the capture `part_of` only |
| F5 | The Moraine Lake hand-picked pair to Larch Valley says `how: drive`, 2.6 km, though the trail starts at the shore | derived relevance | CS7 or derive; the page shows "starts here" from `starts_at` |

## 8. Acceptance checks for Part B (add to S1's table)

1. Each section's states match section 3 and the `?page=states` mock: four forms only (PS14); "No data", "recorded yet"
   and italic gap prose appear nowhere.
2. A property's gap marker appears once on a page (PS1); the place-check and family-check counts each count it once.
3. At 1440 exactly one amber button is in any viewport; on phone the cover's Directions is amber (PS3).
4. Moraine Lake's Directions go to the Lake Louise Park and Ride and say why; Lake Louise's go to the lake's point and
   say that no parking point is stored (PS4).
5. No relevance chip is filled, amber or green; at most one per row (PS5, S8).
6. The lakeshore routes show "Part of Lake Louise" / "Part of Moraine Lake", not the pointer (PS9, F1).
7. Glance slots do not repeat a Who it suits chip (PS13); every slot link lands on its home row and flashes it.
8. Section 10 never lists a way to the place; section 11 never lists the start place (X9).
9. Lake Louise draws sections 1-4 and 6-14 with the markers of section 4 of this page, and no section 5.

## 9. Questions for the owner

1. **"Before you go" or "Warnings"** for section 3? Recommendation: "Before you go". It holds bookings and access rules,
   which are not warnings, and the hazard has its own line in Who it suits.
2. **The not-judged badge.** Show a dashed "Worth the trip? Not checked yet" in the cover when draw is not judged, or
   show nothing there and count it in the place checks only? Recommendation: show it. It is your marker rule, and the
   chip is quiet.
3. **Facilities in two places.** Who it suits keeps its collapsed Facilities group as an echo of section 9 (as designed
   in suitability-display). Keep the echo, or drop the group from place pages and keep it only on trip entries?
   Recommendation: keep it for the first build, then decide on the built pages; dropping it is a one-line change.
4. **Plan B twice** (under the booking line and tagged in Similar nearby). Recommendation: keep both: the first answers
   the risk where it is read, the second is where a visitor compares.

## Change log

| Date | Change |
|---|---|
| 2026-10-18 | First design (S1 Part 0): 14 decisions, the frame, sections 1-3 and 5-14 with their states, Lake Louise near-empty walk-through from real data, P1-P9 and T1-T5 scoring, 12 conflicts with resolutions, 5 data findings, 9 Part B checks, 4 owner questions; mock with five pages rendered at 1440 and 390, light and dark, 2x, on the Arc GPU |

## Rendering check (18 Oct 2026)

Chromium 1248 on the Arc GPU (`--use-gl=angle --use-angle=gl --ignore-gpu-blocklist --enable-gpu-rasterization`), 1440 and
390 at 2x, light and dark, five pages, read in 800 px tiles. Fixed during the check, and now rules in this page:
- The phone page was 510 px wide: the grid's `1fr` column grew to a nowrap chip's width. The column is `minmax(0, 1fr)`
  and window chips are at most about 36 characters ("Book ahead · 48 h release at 08:00 MT").
- Three amber buttons were visible at once on desktop (cover, rail, section 7). PS3.
- The glance repeated the time-on-site chip on the lake pages. PS13.
- The no-photo cover hid its title (white on `--surface`) and left a 420 px empty band. PS6.
- The route markers list squeezed names into three lines; markers stack name over distance.
- Best-weeks cells filled whole months for a mid-September to early-October window; part cells now.
- The gap chip inside a collapsed summary picked up the summary's separator dot inside its border.
- On phone the price table wrapped "from CAD 70" and the read dates over two lines; table cells do not wrap and drop to mono 12.
- A variant with no price showed two gap chips for one property; one chip in the price slot (PS1).
