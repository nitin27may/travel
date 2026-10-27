# Trip builder: desktop wireframes (1440 px)

Spec: [features/trip-builder.md](../../features/trip-builder.md). Index and shared rules: [README.md](README.md).
Grid: foundation tokens section 10 (12 columns, 32 px gutters, max content 1376; the map goes full-bleed). Desktop uses the
whole width: at every step after step 2, filters or the outline, the main list, the map and the tray or itinerary are on
screen at once, so nothing needs a modal to compare (P3, P5).

## D1. Start (where, or near mode)

```
+----------------------------------------------------------------------------------------------------------------------+
| Travel   Trips  Places  Globe  Plan                                                         Mine   Sign in   (theme) |
|----------------------------------------------------------------------------------------------------------------------|
| Plan a trip   1 Where > 2 Regions > 3 Discover > 4 Days > 5 Bases > 6 Build > 7 Getting there > 8 Review    (A1)      |
|----------------------------------------------------------------------------------------------------------------------|
|  Where do you want to go?                                  |                                                         |
|  [ Italy                                            x ]    |      [ globe or map: Italy highlighted,                 |
|                                                            |        region groups shaded by how many                 |
|  ( Travel from home instead: day trips and short stays )   |        places we hold ]                                 |
|                                                            |                                                         |
|  Start from one of our trips                               |                                                         |
|  [ Dolomites, 14 days ] [ Rockies, 14 days ] [ Quebec ]    |                                                         |
|                                                            |                                                         |
|  Your drafts on this device                                |                                                         |
|  Italy · 9 places · 10 days · edited today          Open   |                                                         |
|                                                            |                                    [ Next: Regions ]    |
+----------------------------------------------------------------------------------------------------------------------+
```

## D2. Regions

```
+----------------------------------------------------------------------------------------------------------------------+
| Plan a trip · Italy   1 Where > [2 Regions] > 3 Discover > ...                                                       |
|-------------------------------------------+--------------------------------------------------------------------------|
| Pick one or more regions                  |                                                                          |
| [x] Northern Italy, east            69    |        [ map: Italy, admin-1 polygons grouped; ticked groups filled;     |
|     [x] Trentino-Alto Adige   35          |          hover a row = outline that region; click a region = toggle ]    |
|     [x] Veneto                34          |                                                                          |
|     [ ] Friuli Venezia Giulia  0          |                                                                          |
| [ ] Northern Italy, west             3    |                                                                          |
| [ ] Central Italy                    2    |                                                                          |
| [ ] Southern Italy                   3    |                                                                          |
| [ ] Islands                          0    |                                                                          |
|     Not researched yet · Ask us           |                                                                          |
|-------------------------------------------|                                                                          |
| 2 regions · 69 places        [ Next ]     |                                                                          |
+-------------------------------------------+--------------------------------------------------------------------------+
```

## D3. Discover and pick (four panes)

```
+----------------------------------------------------------------------------------------------------------------------+
| Italy · NE (2 regions) x   1 Where > 2 Regions > [3 Discover] > 4 Days > ...                       Search places  /   |
|-----------------+-------------------------------------+----------------------------------+---------------------------|
| Filters  Clear  | 41 places · July · fits age 6       |                                  | Your picks (6)            |
|                 | Sort: [Best match v]   View: List|Table |   [ map: clusters, picked pins | about 5 days ≈            |
| Kind            |-------------------------------------|     filled, hover lifts the row; |---------------------------|
| [x] Hikes   18  | [ ] [ph] Tre Cime loop              |     the visible area filters the | 1 Lago di Braies    must  |
| [x] Lakes    9  |     Hike · 10 km · 3 h 30 · 25 km NE|     list when "Search as I move" |   1 h 30                  |
| [ ] Lifts    7  |     (Worth the journey)(Fits 6)     |     is on ]                      | 2 Seceda ridge            |
| [ ] Sights   5  |     (Jul ok)(Moderate)              |                                  |   2 h · Book ahead        |
| Activity        |-------------------------------------|                                  | 3 Alpe di Siusi           |
| [ ] Via ferrata 3| [x] [ph] Lago di Braies            |                                  | 4 Tre Cime loop           |
| [ ] Bike     2  |     Lake · 3.5 km · 1 h 30          |                                  | 5 Cinque Torri            |
| Effort          |     (Worth the journey)(Fits 6)     |                                  | 6 Val di Funes            |
| [x] Easy    14  |-------------------------------------|                                  |                           |
| [x] Moderate 17 | [ ] [ph] Seceda ridge               |                                  | Drag rows here, or press  |
| [ ] Hard    10  |     Lift + walk · 2 h               |                                  | Space on a row            |
| Kids  youngest 6|     (Book ahead: lift slot)(Fits 6) |                                  |                           |
| Season [July v] |-------------------------------------|                                  |                           |
| Time on site    | ... page 1 of 2   [ Next page ]     |                                  | [ Next: Days and pace ]   |
| 240 px          | 420 px                              | fluid                            | 360 px                    |
+-----------------+-------------------------------------+----------------------------------+---------------------------+
```

## D4. Days, pace and bases (one screen on desktop)

On desktop steps 4 and 5 share a screen: the settings on the left change the suggestion on the right as they change, so
the trade-off is visible (P3). The step rail still shows them as two steps.

```
+----------------------------------------------------------------------------------------------------------------------+
| Italy · NE · 9 picks      ... > [4 Days] > [5 Bases] > 6 Build > ...                                                |
|------------------------------------------+---------------------------------------------------------------------------|
| Your 9 picks need about 6 days           |                                                                           |
| Days      [ - ] 10 [ + ]                 |   [ map: picks as dots; base A Ortisei and B Cortina as lettered pins     |
| Pace      Relaxed |*Standard*| Full      |     with 60 and 90 min rings ≈; lines from each pick to its base ]        |
| Moves     *Fewer* | Balanced | Shorter   |                                                                           |
| Month     [ July v ]                     |                                                                           |
| Who       2 adults · youngest 6   Edit  |                                                                           |
|------------------------------------------|                                                                           |
| Suggested: 2 bases                       |                                                                           |
| A Ortisei          5 nights [- +] Lock   |                                                                           |
|   5 picks · avg 35 min · max 55 min ≈    |                                                                           |
|   Why Ortisei?  v                        |                                                                           |
|   - closest town to 4 of your 5 western  |                                                                           |
|     picks; Bolzano saves 0 picks, adds   |                                                                           |
|     25 min a day                         |                                                                           |
|   - lodging: many places to stay listed  |                                                                           |
|     on OpenStreetMap (no names shown)    |                                                                           |
| B Cortina d'Ampezzo 4 nights [- +] Lock  |                                                                           |
|------------------------------------------|                                                                           |
| Compare               moves  drive/day   |                                                                           |
| * Two bases (ours)       1    1 h 25 ≈   |                                                                           |
|   One base, Bolzano      0    3 h 05 ≈   |                                                                           |
|   Three bases            2    1 h 00 ≈   |                                                                           |
|               [ Build my days ]          |   Drag a base pin to another town to override; it snaps to towns.        |
+------------------------------------------+---------------------------------------------------------------------------+
```

## D5. Build: the itinerary editor (three panes, the foundation's Plan grid)

```
+----------------------------------------------------------------------------------------------------------------------+
| Italy · 10 days · July · 2 bases        ... > [6 Build] > 7 Getting there > 8 Review         Undo  Redo   Rebuild   |
|-------------------+---------------------------------------------------+----------------------------------------------|
| Outline           | Day 2 · Base A Ortisei · 1 h 10 driving ≈         |                                              |
| A Ortisei 1-5     |-------------------------------------------------- |   [ map: day 2 legs drawn, numbered stops;   |
|  1 Arrive  ·      | 08:00  Leave Ortisei                              |     other days faint; base A pin ]           |
|  2 Seceda    *    | 08:25  Seceda lift and ridge          2 h  [lock] |                                              |
|  3 Funes          |        (Book ahead: lift slot opens 1 Jun)        |                                              |
|  4 Siusi          | 10:45  drive 20 min                               |                                              |
|  5 Rest  ·        | 12:30  Lunch (picnic)                             |                                              |
| B Cortina 6-9     | 14:00  Alpe di Siusi walk             2 h         |                                              |
|  6 Move day       | 17:30  Back at base                               |                                              |
|  7 Tre Cime       |                                                   |                                              |
|  8 Braies         | Day 3 · Base A · 2 h 05 driving ≈                 |                                              |
|  9 Cinque Torri   | ...                                               |                                              |
| 10 Depart         |                                                   |                                              |
|-------------------|---------------------------------------------------|                                              |
| Did not fit (1)   | Warnings (2): Day 7 ends 40 min before sunset;    |                                              |
| Sorapis lake      | Day 6 drive 2 h 40 over the 2 h break interval    |                                              |
| [Add 1 day]       | with a suggested stop                              |                                              |
| 256 px            | 620 px                                            | fluid                                        |
+-------------------+---------------------------------------------------+----------------------------------------------+
```

### Desktop interactions

| Action | Mouse | Keyboard |
|---|---|---|
| Move an item to another day | drag its row onto a day in the outline | `M` then the day number, Enter |
| Reorder inside a day | drag with the insertion line (8.1) | `Alt+Up` / `Alt+Down` |
| Lock or unlock | the lock icon | `L` |
| Drop | the row menu | `Delete`, then the Undo toast (`Ctrl/Cmd+Z`) |
| Swap two items | drag one onto the other with `Shift` | `S`, then pick the other with arrows, Enter |
| Next or previous day | click in the outline | `J` / `K` |
| Rebuild unlocked items | the Rebuild button | `R` (asks once; locks are kept) |
| Open details | click the name: a side sheet (5.1) | Enter |

Every keyboard command is listed under `?` and in the ⌘K palette (foundation 1.3).

## D6. Getting there

```
+----------------------------------------------------------------------------------------------------------------------+
| Italy · 10 days                        ... > [7 Getting there] > 8 Review                                            |
|------------------------------------------------------------+---------------------------------------------------------|
| From  [ Toronto (YYZ)                v ]  Use my location  |  [ map: YYZ to VCE as a great-circle arc (no route     |
|                                                            |    claimed), VCE to A by road, B to VCE by road ]       |
| Arrive   VCE Venice Marco Polo  · nearest to base A ≈      |                                                         |
|          alternates: VRN Verona, INN Innsbruck             |                                                         |
| Leave    VCE (same airport)   or  open jaw: out of MUC     |                                                         |
| Flights  Fares not shown       [ Search flights ]          |                                                         |
| Car      Pick up at VCE · 2 h 30 ≈ to Ortisei             |                                                         |
|          One-way drop-off fees: ask the rental company     |                                                         |
| Transit  Bus or train possible to Ortisei (region note)    |                                                         |
|          [ Open each leg in Google Maps ]                  |                                                         |
| Day 1 is now an arrival day; Day 10 a departure day.       |                                                         |
|                                     [ Next: Review ]       |                                                         |
+------------------------------------------------------------+---------------------------------------------------------+
```

## D7. Review

```
+----------------------------------------------------------------------------------------------------------------------+
| Italy · 10 days · July · 2 bases · 1 move · 9 places · 1 h 25 driving a day ≈                                       |
|------------------------------------------------------------+---------------------------------------------------------|
| [ Save to Mine ]  [ Copy link ]  [ Add to calendar ]  [ PDF ] |  whole-trip map: bases, days coloured with numbers   |
| Book ahead (3): Seceda lift slot, Tre Cime toll road, ...    |                                                       |
| Did not fit (1): Sorapis lake  [ Add 1 day ]                 |                                                       |
| Day 1 ... Day 10 (compact rows, as the public trip page)     |                                                       |
| Saved on this device. Sign in to keep it everywhere.         |                                                       |
+------------------------------------------------------------+---------------------------------------------------------+
```

## D8. Near mode, desktop

Same four-pane layout as D3. The left rail starts with "From Toronto (hub) · within 3 h · 2 nights"; the list is sorted by
drive time with bands (≈ until routed); the map draws drive-time bands as rings from the start point. With 1 to 3 nights,
step 5 shows one suggested base (the town that minimises driving to the picks). With 0 nights, it goes straight to Build.
