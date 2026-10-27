# Park page: states

Part of [the park page design](README.md) (PA-N, revised after PA-NR; gate G-PA open). Every state draws what is known and says what is not
(Q300, components 6.5); a safety gap keeps its own row (P2 exception). Freshness classes are those of
`data/schema/freshness.json` (prices 120 days, hours 180, booking windows 365, closures 7 and never trusted, summaries 730).

## 1. The state table

| State | When (computed on the server, P9) | What the page draws | What it never does |
|---|---|---|---|
| **Researched** | the park has requirement offers or a sourced `access_cost: no_limit`, and at least one held section | the full anatomy ([anatomy.md](anatomy.md)) | |
| **No entry needed** | `EntryBlock.state = none_needed` | Entry and bookings shows one line: "No entry fee or permit · <authority>, read <date>" and the official link | hide the section: "no fee" is a fact a visitor checks (T1) |
| **Entry not checked** | `EntryBlock.state = not_checked` (no requirement offer and no sourced no-fee) | Entry and bookings shows the gap row "Entry not checked yet" (gap chip, components 2.8) with "Check the official page ->" when the official link is held | move entry to the Not checked yet block: a missing permit can stop a visit (protected-area-entry 4.5) |
| **No data (basics only)** | the completeness level is `basics` (name, kind, point) | the compact template (below) | draw empty sections or link tabs |
| **Stale data** | a shown fact's read date is older than its freshness class | the fact stays, with its read date and an age note; booking windows and closures add the honesty chip "May be out of date"; prices get text only (below, PN19) | hide or silently drop an old fact |
| **Closed season** | today (at render) falls outside every `season` row with `status: open`, or a `closed` row covers today | the notice banner (PN11), the month strip, and Plan a visit still drawn (people plan for next season) | grey out the page or hide entry |
| **A zone** | type `nature.protected.zone` | the same template; kicker "Area of Yoho National Park"; breadcrumb ends at the park; Entry shows the zone's own rows, then "From Yoho National Park" rows (`inheritedFrom`) | duplicate the park's sections |
| **Loading, error** | the page is server-rendered; only the expanded map is lazy | map: skeleton (components 6.2) "Loading map"; map error: components 6.3 inline "We couldn't load the map" with Retry, the list of pins stays | a spinner for a region; a blank page |

## 2. No data: the compact park template

A basics-only park (today: Castle Provincial Park, Top of the World Provincial Park, Mount Robson Provincial Park and
most store-only parks) uses the compact template of patterns 3.11, with three park rules on top: the entry safety row, the
places inside, and on phones the map after the entry row (PN18, review M4).

```
390                                     1440 (one column, 760 px, centred in the 1fr column; right column as usual)
+--------------------------------------+  +---------------------------------------------------------------------+
| ... · Canada · Alberta               |  | Parks · Canada · Alberta                                            |
| [kind glyph band, 120 px]            |  | [kind glyph band 120 px] "No licensed photo yet"                     |
| PROVINCIAL PARK · ALBERTA            |  | PROVINCIAL PARK · ALBERTA                                           |
| CASTLE PROVINCIAL PARK               |  | CASTLE PROVINCIAL PARK                     Basics only               |
| Basics only                          |  | [## Save to a trip ##] [Directions] [share] [heart]                 |
| [## Save ##] [Directions] [sh] [hrt] |  +---------------------------------------------+-----------------------+
| ENTRY AND BOOKINGS                   |  | ENTRY AND BOOKINGS                          | [map card]            |
|  Entry not checked yet (gap chip)    |  |  Entry not checked yet (gap chip)           | In Canadian Rockies   |
|  Official page ->                    |  |  Official page ->                           |  · Day 14             |
| [map, 200 px]                        |  | PLACES INSIDE                               | LINKS  Official       |
| Places inside: 3 (as links)          |  |  [Trails 2 >] [Lakes 1 >]                   |                       |
| In Canadian Rockies · Day 14         |  | NOT RESEARCHED YET                          |                       |
| Not researched yet                   |  |  Season, entry and pass, camping, safety    |                       |
|  Season, entry and pass, camping,    |  |  and wildlife, getting there, summary,      |                       |
|  safety and wildlife, getting there, |  |  photo                                      |                       |
|  summary, photo                      |  |                                             |                       |
| [Ask us to research ->] (R7, later)  |  |  Ask us to research this park -> (R7, later)|                       |
+--------------------------------------+  +---------------------------------------------+-----------------------+
```

- **No Plan a visit group** when the park has fewer than 3 member places with points (PN6): the builder would have
  nothing to plan around. Save to a trip is the primary action, as on every park page (PN7).
- On phones the map card sits under the entry row, never above it (PN18): Entry's heading must be inside the first
  scroll (AC-25).
- "Places inside" appears only when the count is above 0, as count cards; the trips line only when a public trip uses it.
- "Ask us to research this park" links to the request route REQ ships, prefilled with the park's slug, as a plain link
  (+0 B JS). That route is not in `web/app` today (review section 5), so **until it exists the link is not drawn** (R7).
- The values above for Castle are a shape: the built page shows its real counts. Day numbers are illustrative.

## 3. Stale data

T3: a fact that changes shows its age. Rules:

| Fact | Class | At rest when fresh | At rest when stale |
|---|---|---|---|
| Fee and pass prices | prices, 120 days | "CAD 12.25 adult (2026)" and, in the opened row, "read 27 Oct 2026" | text only (PN19, review S5): the price line ends "· read Mar 2026, may have changed" in `--muted`, and the fees link moves next to the price. **No chip** |
| Booking window rule | booking windows, 365 days | "Opens on a launch day, usually in April" ("usually" is fixed wording, protected-area-entry 5.2) | the honesty chip "May be out of date" on the row, and "Read for the 2025 season; check before you book ->" |
| Operating season, gate hours | hours, 180 days | the month strip; "read <date>" under it | the strip keeps its cells; the line under it reads "Read <date>, may have changed" in `--muted` |
| Standing closures | closures, 7 days, never trusted | dated rows with read date; the alerts link always at rest | a closure whose end date has passed is not drawn; one read more than 7 days ago gets the honesty chip "May be out of date", keeps "read <date>", and the alerts link is placed first |
| Summary, designations | summaries, 730 days | as is | no marker (low risk) |

The honesty chip "May be out of date" uses the existing honesty look (components 2.8: dashed `--crit`, triangle). It is a
new label in that set, added by the design reviewer in FND-PA after G-PA (README R4). It appears **only on booking windows
and closures**, the facts that stop a visit; stale prices and summaries carry text only, so routine fee rows never alarm.
One chip per row at most, and the row's text does not repeat it. A row with the chip is never collapsed into the "Show
more" tail.

```
Stale price (text only):
| [ticket] Daily admission                          [Buy any time]                          |
|          Everyone entering · per person, per day                                          |
|          CAD 12.25 adult · 17 and under free (2026) · read Mar 2026, may have changed     |
|          Fees page ->                                                    [Details v]       |

Stale booking window (chip):
| [ticket] Moraine Lake shuttle seat                [Launch day, usually April]             |
|          [! May be out of date]                                                           |
|          Read for the 2025 season; check before you book ->              [Details v]       |
```

## 4. Closed season

Two real cases and one shape.

**A zone with a short season: Lake O'Hara area (Yoho), seen in November.** The bus season is 19 Jun to 4 Oct 2026; the
lottery runs 2 to 23 Mar at 08:00 Mountain time; leftover seats until 15:30 the day before.

```
| ... · Yoho National Park                                                                   |
| AREA OF YOHO NATIONAL PARK                                                                 |
| LAKE O'HARA AREA                                                                           |
| [## Save to a trip ##] [Directions] [share] [heart]                                        |
| Plan a visit [Day trip] [1 night] [2 nights] [Part of a longer trip]                       |
| (i) The day-use bus runs 19 Jun to 4 Oct (2026 season); the next lottery is usually in     |
|     early March. As of Tue 3 Nov 2026. Alerts ->                    (notice banner, PN11)   |
| ENTRY AND BOOKINGS                                                                         |
|  Book ahead                                                                                |
|   [ticket] Lake O'Hara day-use bus                        [Lottery, usually in March]       |
|            Day visitors · CAD 25.50 per person return; CAD 10 per draw application         |
|            Lottery: apply usually 2 to 23 Mar at 08:00 local; seats left after the draw    |
|            until 15:30 the day before · In force 19 Jun to 4 Oct          [Details v]       |
|            Walking in instead: 22 km return on the fire road                               |
|  From Yoho National Park                                                                   |
|   [ticket] Daily admission  ·  Discovery Pass covers it                    Fees page ->     |
| SEASONS AND CLOSURES   [month strip: open Jun (from 19) to Oct (to 4), closed the rest]     |
```

**A whole park outside its operating season** (the provincial shape of [anatomy.md](anatomy.md) 4): the banner reads
"Closed for the season: the park operates <from> to <to>. As of <date>." in a **notice** banner (`--info-soft`, info
icon; review S7) When the record holds standing exceptions
(winter day use, a winter campground) they follow in one line: "Open in winter: <what>". Plan a visit stays (a visitor
plans for next summer); the builder applies its own season rule (trip-kinds 1.4: a closed row moves to "Closed in summer").

**A park open all year with seasonal services** (most national parks): no banner and **no month strip**: one line, "Open
all year, read <date>" (review S8); the service seasons ("Moraine Lake shuttle 1 Jun to 12 Oct") are rows in Seasons and
closures.

Banner priority and kind (PN11): closed for the season or between seasons (notice), then a dated closure that overlaps
today or the next 30 days (caution, naming the member as a link and "1 of n closures, see Seasons and closures" when there
are more), then none. Never two banners; the second fact is a row in Seasons and closures.

### 4.1 The month strip, season variant

The existing month strip (components 4.7) with season words instead of planning words, drawn **only when at least one
month is closed or partly open** (S8). Same cells, same container
query (12 x 1 from 400 px, 6 x 2 below), same screen-reader pattern ("Open: June to October. Closed: November to May.").

| State | Look (existing cell looks, new words) | Word in the cell |
|---|---|---|
| open all month | `--ink` fill, label `--surface` 600 (the "best" look) | open |
| open part of the month (19 Jun) | `--surface` with the hatched foot band (the "good" look) | part |
| closed | `--surface`, label `--muted`, cross-hatched foot (the "avoid" look) | closed |
| not checked | `--surface`, 1 px `--line-2`, label `--muted` | (blank) |

The legend line is "Operating season, read <date>" plus the patterns in use. Contrast pairs are those of components 4.7
(confirmed in the PA-NR review, section 3). Not a new component: a `variant="season"` prop, added to the foundation in
FND-PA.

## 5. Zones

Zones (`nature.protected.zone`) use the same template:

- kicker "Area of <park>"; the breadcrumb ends Parks · Canada · British Columbia · Yoho National Park;
- Entry: the zone's own rows first, then "From <park>" rows, each with its `inheritedFrom` label (entity-graph 7.2);
- Plan a visit links carry the zone's slug as `p` (no `within` key); the builder pins it as the trip's area and ranks the
  zone's members, never scheduling the zone itself as a stop (README R1);
- zones never appear as their own rows on `/parks`; they appear under the park's "Areas inside" line.
