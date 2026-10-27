# Trip builder: phone wireframes (390 px)

Spec: [features/trip-builder.md](../../features/trip-builder.md). Index and shared rules: [README.md](README.md).
Counts in the frames are **measured on 27 Oct 2026** where they name our data (Italy: 69 records in the Nord-Est group,
8 in the rest of the country; Ontario: 4 records), so the frames show the honest thin-data states the build must handle.
Everything else is illustrative.

Phone rules (all frames): the step header is fixed at the top (52 px); the primary action sits in the bottom bar (64 px,
inside the thumb zone); sheets open from the bottom; nothing important is under the top 20% of the screen only (T2).

## Stage frames (TB-FLOW, 27 Oct 2026; revised after review TB-N2)

The flow is [FLOW.md](FLOW.md). These frames replace P1, P1b, P2, P3, P4, P5, P6, P6a, P7 and P8 below (kept for
history under "Earlier frames"); P3f, P3m and P9 stay as drawn. TB-N's findings apply (focused flow, Pick and Picked
with Must see in the tray, kids chip first, no swipe, no rings, every Next names its stage). Review TB-N2 is applied:
the first build lands in the editor (E0), Getting there is a card on Day 1 and the last day, hand edits are "Placed by
you", the reach is changeable on stage 3, and the editor has one bottom bar. The step count counts stages 1 to 4 that
ask (FLOW 2.1). The Review primary is a placeholder until the owner chooses F-Q4.

| Old frame | New frame |
|---|---|
| P1, P1b | F0 Kind, F1 Start |
| P2 | F2 Where, F2n near reach |
| P3 | F3 Pick, F3s near what you picked |
| P4, P5, P6, P6a, P7 | F4 Days and driving; E0 just built (bases, checks, Day 1 getting-there card); E1 to E7 the editor |
| P8 | F8 Review and prepare |
| none | C1 to C3 copy; X1 empty and error states |

## F0. Stage 0: kind, and the ways in

```
+--------------------------------------+
| x  Plan a trip                       |   focused flow; x keeps plans
|--------------------------------------|
|  WHAT KIND OF TRIP?                  |
|  [ Day trip             by car    > ]|   tiles are buttons: a tap advances
|  [ Weekend   1 or 2 nights · by car >]|
|  [ Long weekend 3 or 4 · by car    > ]|
|  [ A week by car   from home       > ]|
|  [ A week by air   fly somewhere   > ]|
|  [ Longer holiday  10 to 21 nights > ]|
|                                      |
|  YOUR PLANS                          |
|  Italy · 9 places · ready to build > |
|  Rockies · your copy · built,        |
|    edited today                    > |
|  Algonquin · 3 places · ready to   > |
|    build                             |
|  All plans in Mine                 > |   three at most (P1)
|                                      |
|  OR START FROM                       |
|  A place you saved  ·  One of our    |
|  trips  ·  Surprise me               |
+--------------------------------------+
```

## F1. Stage 1: from where, who, when

Weekend (near kind):

```
+--------------------------------------+
| <  Weekend                  1 of 3   |
|--------------------------------------|
|  STARTING FROM                       |
|  [ Toronto (public hub)        v ]   |
|  Use my location (stays on phone)    |
|                                      |
|  WHO IS GOING                        |
|  2 adults · 1 child (6)       Edit   |
|                                      |
|  WHEN?                               |
|  (*Next weekend*)(This weekend)      |
|  (A month v)(Summer)(Dates...)       |
|  (Not sure yet)                      |
|--------------------------------------|
| [ 4 places within 3 h so far ≈ v ]   |   a button: opens the reach control
|   Ask us for more                    |   thin state (F-Q1); else "9 places
|               [ Next: Pick ]         |    within 3 h ≈ · Oct"
+--------------------------------------+
```

A week by air:

```
+--------------------------------------+
| <  A week by air            1 of 4   |
|--------------------------------------|
|  STARTING FROM                       |
|  [ Toronto                     v ]   |
|  Fly from Toronto Pearson (YYZ)      |
|  35 min ≈ from you · Change          |   alternates: YTZ, BUF (origin 4.2)
|  We use this for your flights; the   |
|  airport you land at comes from      |
|  where you go. We plan a hire car    |
|  from the airport.                   |
|                                      |
|  WHO IS GOING                        |
|  2 adults · 1 child (6)       Edit   |
|  WHEN?  (*July*)(A month v)(Dates...)|
|         (Not sure yet)               |
|--------------------------------------|
|               [ Next: Where ]        |
+--------------------------------------+
```

## F2. Stage 2: where (trip mode)

```
+--------------------------------------+
| <  Italy                    2 of 4   |
|--------------------------------------|
| [ Italy                        x ]   |
| [ map peek 170 px: macro areas ]     |
|--------------------------------------|
| (*Northern Italy 74*)(Central 2)     |
| (Southern Italy 3)(Islands 0)        |
|                                      |
| NORTHERN ITALY · pick one or more    |
| [x] Dolomites                 69     |
|     Val Gardena, Cortina, Braies     |
|     Fly into VCE or VRN · car needed |
| [ ] Lake Garda       Thin: 3 places  |
| [ ] Lombardy lakes   Not researched  |
|     yet · Ask us to research it  >   |
|--------------------------------------|
| 1 region · 69 places                 |
|               [ Next: Pick ]         |
+--------------------------------------+
```

## F2n. Stage 2: where (Long weekend, A week by car)

```
+--------------------------------------+
| <  Long weekend             2 of 4   |
|--------------------------------------|
|  LONGEST DRIVE FROM HOME, EACH WAY   |
|  ( 2 h )( 3 h )(*4 h*)( 6 h )( 8 h ) |
|                                      |
|  Within 4 h ≈: 14 places             |
|  Narrow to (optional)                |
|  (Muskoka 3)(Algonquin 5)            |
|  (Adirondacks 2)(Laurentians 1)      |
|  (Finger Lakes 0 · Ask us)           |
|--------------------------------------|
| 14 places · 4 h ≈                    |
|               [ Next: Pick ]         |
+--------------------------------------+
```

## F3. Stage 3: pick

```
+--------------------------------------+
| <  Pick                     2 of 3   |   Weekend
|--------------------------------------|
| (Within 3 h ≈ v)(Filters 2)          |   reach pill first for Day trip and
| (Looking for v)(Kids 6+ v)(Oct v)    |    Weekend (M3)
| 9 places · Oct · fits age 6   Clear  |
|--------------------------------------|
| TOWNS AND CITIES                     |
| Huntsville  Town · 2 h 20 ≈ N [Picked]|
|   [x] Stay here                      |   only on a picked town
| Dwight      Town · 2 h 35 ≈ N  [Pick]|
|--------------------------------------|
| PLACES                               |
| [ph] Lake of Two Rivers       [Pick] |
|  Lake · 3 h 05 ≈ · N                 |
|  (Fits 6)(Day permit: book ahead)    |
| [ph] Arrowhead Prov. Park   [Picked] |
|  Park · 2 h 20 ≈ · N                 |
|  3 places near Arrowhead · Show  v   |   F3s; one strip, collapsed
| [ph] Algonquin Logging Museum [Pick] |
|  Museum · 3 h ≈                      |
|                                      |   72 px bottom padding
|======================================|
| Map | 2 picked · about 2 days ≈      |   Map in the bar (S7)
|     |            [ Next: Days ]      |
+--------------------------------------+
```

## F3s. Near what you picked (expanded)

```
|  NEAR ARROWHEAD (3)            Hide  |
|  Huntsville Lookout          [ Pick ]|
|    10 min ≈ from Arrowhead           |
|    (Fits 6)                          |
|  Limberlost trails           [ Pick ]|
|    20 min ≈ from Arrowhead           |
|    (Fits 6)(Moderate)                |
|  Muskoka Heritage Place      [ Pick ]|
|    15 min ≈ from Arrowhead           |
```

Same query as the list (kids, month, Looking for): unfit or closed places never appear. When the next pick is made this
strip moves into the tray sheet under "Near your picks". Announced "3 places near Arrowhead".

## F4. Stage 4: days and driving

A week by air (three controls plus Moves); a Weekend shows only Nights and Pace.

```
+--------------------------------------+
| <  Days and driving         4 of 4   |
|--------------------------------------|
| Your 9 picks need about 6 days       |
| (5 nights) ≈                         |
| Nights · 10 days  [ - ]  9  [ + ]    |
| Driving on a day out from your base, |
| in total                             |
| ( 2 h )( 3 h )(*4 h*)( 6 h )         |
| Pace    ( Relaxed )(*Standard*)(Full)|
| Moves   (*Fewer*)( Balanced )(Shorter)|
|--------------------------------------|
| ALSO WITHIN YOUR DRIVING (12)        |
| Alpe di Siusi                  [ + ] |
|   35 min ≈ from Seceda               |
|   (Fits 6)(Worth the journey)        |
| Val di Funes                   [ + ] |
|   40 min ≈ from Seceda · (Fits 6)    |
| Show 10 more                    v    |
|--------------------------------------|
|               [ Build my days ]      |
+--------------------------------------+
```

With nights below the estimate the card reads "Your 9 picks need about 6 days (5 nights); 3 nights will leave about 5
places out".

## E0. The plan, just built (stage 5 lands in the editor)

```
+--------------------------------------+
| [id] Italy · 10 days · July      ... |   identity colour or first pick photo
| 2 adults · 1 child (6) · On phone    |   ... = Undo, Redo, Rebuild, Close plan
|--------------------------------------|
| Built 10 days · 1 did not fit ·      |   status line, announced once
| 1 warning                            |
| 2 bases: Ortisei 5, Cortina 4    v   |   collapsed; expands in place
| 1 h 25 a day ≈ · 1 move · Book ahead |
| 3 · 5 of 9 priced                v   |
|--------------------------------------|
| (1)(2A)(3A)(4A)(5A)(6B)(7B)(8B)(9B)  |
| Day 1 · Arrive · A Ortisei           |
| +----------------------------------+ |
| | Fly into Venice (VCE)            | |   Day 1 getting-there card
| | 2 h 30 ≈ to Ortisei · hire car   | |   expanded on the first build only
| | at VCE              Change       | |
| +----------------------------------+ |
| = 15:30 Ortisei village walk  1 h    |   handles live from the first second
| = 17:00 Check in                     |
| + Add a place to Day 1               |
|======================================|
| Settings               Review >      |   the only bottom bar (M4)
+--------------------------------------+
```

URL becomes `/t/<id>/` (before ED: `/plan/?draft=<id>&s=plan`) by `replaceState`. The last day ends with "Fly home from
Venice (VCE) · Change".

## E1. The editor (a day)

```
+--------------------------------------+
| [id] Italy · 10 days · July      ... |
| 2 adults · 1 child (6) · In account  |
|--------------------------------------|
| (1)(2A)(3A)(4A)(5A)(6B)(7B)(8B)(9B)  |
| Day 2 · A Ortisei · 1 h 10 ≈    ...  |
|  = 08:25 Seceda lift and ridge  2 h  |
|          (Locked to Day 2)           |
|  = 11:00 Lago di Braies       1 h 30 |
|          (Placed by you · Day 2)     |
|  = 14:00 Alpe di Siusi walk     2 h  |
|  ! Day ends 40 min after sunset      |
|    [ Move Siusi to Day 3 ]           |
|  + Add a place to Day 2              |
|  Add a note                          |
|======================================|
| Settings               Review >      |
+--------------------------------------+
toast above the bar: "Moved Lago di Braies to Day 2 and kept there · Undo"
```

## E2. Item sheet

```
+--------------------------------------+
| Lago di Braies                       |
| Day 2 · 11:00 · 1 h 30               |
| Placed by you                        |
|--------------------------------------|
| Move to day ...                   >  |   first (L8)
| Order in the day     [ Up ] [ Down ] |   one row, two 44 px buttons
| Swap with ...                     >  |
| Swap for a nearby place           >  |
| Let the plan move it                 |   only on Placed by you
| Locked to Day 2             [ off ]  |
| Must see                    [ off ]  |
| Details                           >  |
|--------------------------------------|
| Remove from the plan                 |   --crit; Undo toast, no confirm
+--------------------------------------+
```

## E3. Move to day

```
+--------------------------------------+
| Move Alpe di Siusi to                |
|--------------------------------------|
| Day 3 · A Ortisei · 1 h 40 free      |
|   fits · +10 min driving ≈           |
| Day 4 · A Ortisei · 30 min free      |
|   too full: ends after sunset        |
| Day 6 · Move day to B                |
|   +1 h 05 driving ≈                  |
|--------------------------------------|
| Cancel                               |
+--------------------------------------+
```

## E4. Add a place with "fits here"

```
+--------------------------------------+
| Add to Day 2                    x    |
| [ Search places               ]      |
| (Near Day 2)( Rainy day )            |   Rainy day filters on indoor (TF20)
|--------------------------------------|
| Val di Funes                  [ + ]  |
|   fits after Siusi · +15 min ≈ ·     |
|   day ends 17:55 · (Fits 6)          |
| Resciesa lift                 [ + ]  |
|   Day full: try Day 3                |
| Museum Gherdëina              [ + ]  |   with Rainy day on
|   indoor · fits at 15:00 · +5 min ≈  |
+--------------------------------------+
```

## E5. After a rebuild or a settings change

No dialog (L5). The settings sheet's Apply states the effect; then:

```
| Days 3 to 5 rebuilt · 2 stops moved ·|   toast
| 3 locked and 2 placed by you stayed  |
|                    [ Undo ] [ Show ] |
```

## E6. Settings sheet

```
+--------------------------------------+
| Settings                        x    |
|--------------------------------------|
| Make it yours (copies only)       >  |
| Start: Toronto · 2 adults, 1 child · |
|   July                            >  |
| Where: Dolomites                  >  |
| Days and driving: 9 nights · 4 h ·   |
|   Standard                        >  |
| Getting there: VCE in and out     >  |
+--------------------------------------+

opened row (Days and driving):
| Nights · 10 days [ - ] 9 [ + ]       |
| Driving on a day out ( 3 h )(*4 h*)  |
| Pace ( Relaxed )(*Standard*)( Full ) |
| [ Rebuild 6 days · 3 locked and 2    |
|   placed by you stay ]               |   one button that states the effect
```

## E7. Getting there sheet (from the Day 1 card)

```
+--------------------------------------+
| Getting there                   x    |
|--------------------------------------|
| From  Toronto Pearson (YYZ)  Change  |
| Arrive  (*Venice (VCE)*)( Verona )   |
| Leave   (*Venice (VCE)*)( Milan MXP )|
|   Out of MXP adds 2 h 10 ≈ on Day 10 |   bases locked: warning (S11)
|   [ Reverse the bases ]              |
| (Fares not shown)  Search flights ^  |
| Car  pick up at VCE · one-way fees:  |
|      ask the rental company          |
|--------------------------------------|
| [ Apply · base order re-checked ]    |
+--------------------------------------+
```

## F8. Stage 8: review and prepare

```
+--------------------------------------+
| <  Review                            |
|--------------------------------------|
| Italy · 10 days · July · 2 bases     |
| 1 move · 9 places · 1 h 25 a day ≈   |
| In Mine · on this phone              |   state line, not a button
|--------------------------------------|
| BOOK AHEAD (3)                       |
| Seceda lift slot                     |
|   by about 1 Jun ≈ (for early July) ^|   month only; dated plans: exact date
| Tre Cime toll road                   |
|   by about 15 Jun ≈               ^  |
| WARNINGS (1)  Day 7 ends after sunset|
| DID NOT FIT (1)  Sorapis lake  >     |
| KNOWN COSTS                          |
| EUR 74 for 5 of 9 places priced      |
| (Free) Lago di Braies, Val di Funes  |
| Check entry rules for Italy      ^   |
|--------------------------------------|
| [ Primary action (F-Q4) ]            |   owner to choose (FLOW 10)
| [ Copy link ]  [ PDF ]  Edit my plan |
| Sign in to keep it on every device   |
+--------------------------------------+
```

"Not sure yet" plans show "Add dates to see book-by dates" with the item names. A shared link with refs the recipient
cannot see: "2 places in this plan are not public · showing 7".

## C1. Copy from a public trip

```
+--------------------------------------+
| Copy Dolomites                  x    |
|--------------------------------------|
| Start date  [ Tue 13 Jul 2027  ]     |
| Who is going 2 adults · 1 child (6)  |
|--------------------------------------|
|         [ Copy and make it mine ]    |
+--------------------------------------+
```

## C2. Make it yours (non-modal card on first open)

```
+--------------------------------------+
| [id] Dolomites · your copy       ... |
| Tue 13 Jul 2027 · 2 adults, 1 child  |
|--------------------------------------|
| (1)(2)(3)(4)(5)(6)(7)(8)(9)(10)      |
| +----------------------------------+ |
| | MAKE IT YOURS                    | |   inline at the top of Day 1
| | Change places  ·  Your driving   | |
| | and pace  ·  Where you start     | |
| | Keep it as it is                 | |   dismiss
| +----------------------------------+ |
| Day 1 · Arrive · Ortisei             |
| ...                                  |
|======================================|
| Settings               Review >      |
+--------------------------------------+
```

## C3. Converting a copy into your own plan (inline notice)

```
| This makes it your own plan. Our     |
| later updates to the Dolomites trip  |
| will no longer change it. You can    |
| undo this until you leave the page.  |
| [ Continue ]           [ Cancel ]    |
after: toast "Now your own plan · Undo"; Mine: "Dolomites · your plan · from our Dolomites trip"
```

## X1. Empty and error states (S12)

```
Device cap (F0):
| 20 plans on this device. Delete one  |
| or sign in to keep more.             |
| [ Open Mine ]  [ Sign in ]           |

Stale place on resume (E1, top of the plan):
| 1 place is no longer in our list:    |
| Old Mill viewpoint · [ Remove it ]   |   also listed in Did not fit

Resume with picks and no build: opens F4 with [ Build my days ]; never builds by itself.

Shared link (F8 and E1):
| 2 places in this plan are not public |
| · showing 7                          |
```

## Earlier frames (27 Oct 2026, first pass)

Superseded by the stage frames above except P3f, P3m and P9, which stay as drawn.

## P1. Start: where

```
+--------------------------------------+
| <  Plan a trip              1 of 8   |   step header (A1)
|--------------------------------------|
|  Where do you want to go?            |
|  [ Italy                         x ] |   one field: country, region, park, town
|                                      |
|  ( Travel from home instead )        |   switches to near mode (P1b)
|                                      |
|  Or start from one of our trips      |
|  [Dolomites 14 d] [Rockies 14 d] >   |   horizontal cards; seeds the draft
|                                      |
|  Your drafts on this phone           |
|  Italy · 9 places · 10 days   >      |
|                                      |
|--------------------------------------|
|                     [ Next: Regions ]|   bottom bar, thumb zone
+--------------------------------------+
```

## P1b. Start: near mode (day trips and short stays)

```
+--------------------------------------+
| <  Plan a day out           1 of 6   |
|--------------------------------------|
|  Starting from                       |
|  [ Toronto (hub)             v ]     |   hub list, airport, or "Use my location"
|  Use my location (stays on phone)    |   rounded, never sent as a town
|                                      |
|  Longest drive, one way              |
|  ( 1 h )( 2 h )(*3 h*)( 4 h )        |   segmented, 44 px
|                                      |
|  Nights                              |
|  [ - ]   2 nights   [ + ]            |   0 = day trip
|                                      |
|  Who is going                        |
|  2 adults · youngest 6        Edit   |   private, device only
|--------------------------------------|
|              [ Show places (6) ]     |   live count
+--------------------------------------+
```

## P2. Regions (multi-select, grouped)

```
+--------------------------------------+
| <  Italy · Regions          2 of 8   |
|--------------------------------------|
| [ simplified map: 5 groups shaded ]  |   tap a group on the map = tick it
|--------------------------------------|
| Pick one or more                     |
| [x] Northern Italy, east     69  v   |   group row; v expands its regions
|      Dolomites, Venice, Lake Garda   |
|      [x] Trentino-Alto Adige   35    |
|      [x] Veneto                34    |
| [ ] Northern Italy, west      3  v   |
| [ ] Central Italy             2  v   |
| [ ] Southern Italy            3  v   |
| [ ] Islands                   0      |   greyed: "Not researched yet ·
|      Ask us to research it  >        |    Ask us" (request link)
|--------------------------------------|
| 2 regions · 69 places   [ Next ]     |
+--------------------------------------+
```

## P3. Discover and pick (list is the default)

```
+--------------------------------------+
| <  Discover                 3 of 8   |
|--------------------------------------|
| (Kind v)(Activity v)(Kids v)(July v) |   four primary pills; row scrolls
| 41 places · July · fits age 6  Clear |   live count and state (P4)
|--------------------------------------|
| [photo] Tre Cime loop          [ + ] |   + = pick (A2); swipe right = pick
|  Hike · 10 km · 3 h 30               |
|  (Worth the journey)(Fits 6)(Jul ok) |   reason chips (A5), three at most
|--------------------------------------|
| [photo] Lago di Braies         [ v ] |   picked state: tick and "Picked"
|  Lake · walk 3.5 km · 1 h 30         |
|  (Worth the journey)(Fits 6)(Jul ok) |
|--------------------------------------|
| [photo] Seceda ridge           [ + ] |
|  Lift + walk · 2 h                   |
|  (Book ahead: lift slot)(Fits 6)     |   safety and booking stay visible (P2)
|--------------------------------------|
|             ( Map )                  |   floating pill, swaps to P3m
|======================================|
| 6 picked · about 5 days       Next > |   tray peek bar (A4); tap = P4t
+--------------------------------------+
```

## P3f. Filters sheet

```
+--------------------------------------+
| Filters                       Close  |
|--------------------------------------|
| Kind                                 |
| (Hikes 18)(Lakes 9)(Lifts 7)(Sights 5)|
| Activity                             |
| (Rafting 0)(Via ferrata 3)(Bike 2)   |   zero counts shown, disabled
| Effort                               |
| (Easy 14)(Moderate 17)(Hard 10)      |
| Kids                                 |
| Youngest  [ 6 v ]   (Fits 29)        |
| Season    [ July v ]                 |
| Time on site  (< 2 h)(Half day)(Day) |
| Within    (Any)(Picked areas)        |
|--------------------------------------|
| Clear all          [ Show 41 places ]|
+--------------------------------------+
```

## P3m. Map as a sheet (half snap)

```
+--------------------------------------+
| <  Discover                 3 of 8   |
|--------------------------------------|
|                                      |
|   [ map: cluster pins, picked pins ] |
|   [ filled, others outlined        ] |
|                                      |
|--------------- ==== -----------------|   grab handle; snaps: peek, half, full
| 41 places in view          ( List )  |
| [photo] Lago di Braies   12 km NE  v |   tapping a pin scrolls here (P5)
| [photo] Prato Piazza     18 km E   + |
|======================================|
| 6 picked · about 5 days       Next > |
+--------------------------------------+
```

## P4. Days and pace (pre-filled)

```
+--------------------------------------+
| <  Days and pace            4 of 8   |
|--------------------------------------|
| Your 9 picks need about 6 days       |   computed from durations and drives
| at a standard pace.                  |
|                                      |
| Days          [ - ]  10  [ + ]       |
| Pace          ( Relaxed )(*Standard*)( Full ) |
| Moves         (*Fewer*)( Balanced )( Shorter drives ) |
| Month         [ July v ]             |
| Who           2 adults · youngest 6  |
|                                      |
| 4 spare days: we will suggest        |
| more places near your bases.         |
|--------------------------------------|
|                 [ Next: Bases ]      |
+--------------------------------------+
```

## P5. Bases (suggested, accept or override)

```
+--------------------------------------+
| <  Where to stay            5 of 8   |
|--------------------------------------|
| [ map peek: A and B pins, 2 rings ]  |
|--------------------------------------|
| We suggest 2 bases                   |
| A  Ortisei · 5 nights      [ - 5 + ] |
|    Covers 5 picks · avg 35 min ≈     |
|    Why?  >                            |   A5 disclosure
|    Swap town  >                       |
| B  Cortina d'Ampezzo · 4 nights      |
|    Covers 4 picks · avg 30 min ≈     |
|    Why?  >   Swap town  >            |
|--------------------------------------|
| Other ways                           |
|  One base (Bolzano): 0 moves,        |
|  +1 h 40 driving a day ≈        Use  |
|  Three bases: 2 moves, -25 min/day   |
|                                  Use |
|--------------------------------------|
|        [ Build my days ]             |
+--------------------------------------+
```

## P6. The built itinerary

```
+--------------------------------------+
| <  Your 10 days             6 of 8   |
|--------------------------------------|
| (1)(2)(3)(4)(5)(6)(7)(8)(9)(10)  >   |   day chips; tap jumps
|--------------------------------------|
| Day 2 · A Ortisei · 1 h 10 driving   |
|  08:00  Leave Ortisei                |
|  08:25  Seceda lift and ridge  2 h   |
|         (Book ahead: lift slot)      |
|  12:30  Lunch                        |
|  14:00  Alpe di Siusi walk     2 h   |
|  17:30  Back at base                 |
|                                      |
| Day 3 · A Ortisei · 2 h 05 driving   |
|  ...                                 |
|--------------------------------------|
| Did not fit (1)                  v   |   A6: reason and one fix
|  Sorapis lake: day budget full       |
|  [ Add 1 day ]  [ Swap with... ]     |
|======================================|
| Map ^        Next: Getting there >   |
+--------------------------------------+
```

## P6a. Item actions sheet (tap an item)

```
+--------------------------------------+
| Seceda lift and ridge                |
| Day 2 · 08:25 · 2 h                  |
|--------------------------------------|
| Move to day ...                   >  |   opens a day list sheet
| Swap with ...                     >  |
| Lock to day 2                [  ]    |   A8
| Drop from the plan                   |   undo toast after
| Details                           >  |   the place page in a sheet
|--------------------------------------|
|                 Close                |
+--------------------------------------+
```

Reorder inside a day: long-press the row (400 ms), drag with the insertion line (8.1). Across days: always through
"Move to day", because a drag across a scrolled list on a phone is unreliable and fails 2.5.7.

## P7. Getting there

```
+--------------------------------------+
| <  Getting there            7 of 8   |
|--------------------------------------|
| From  [ Toronto (YYZ)          v ]   |   the one Starting from picker (OR11)
|                                      |
| Fly   YYZ -> VCE Venice              |   arrival from base A's nearest
|       Fares not shown  [Search]      |   researched gateway or O6 airport
|       Home from VCE (same airport)   |
|       or open jaw: in VCE, out MUC   |   offered when bases suggest it
| Car   Pick up at VCE · 2 h 30 ≈ to A |
|       One-way fees: check with the   |
|       rental company                 |
| Transit  Possible to Ortisei by bus  |   only when the region says so
|       [Open in Google Maps]          |
|                                      |
| Day 1 becomes an arrival day:        |
| land, drive to Ortisei, short walk.  |
|--------------------------------------|
|              [ Next: Review ]        |
+--------------------------------------+
```

## P8. Review, save, share

```
+--------------------------------------+
| <  Review                   8 of 8   |
|--------------------------------------|
| Italy · 10 days · July               |
| 2 bases · 1 move · 9 places          |
| Driving: 1 h 25 a day on average ≈   |
| Book ahead: 3 items  >               |
| Did not fit: 1  >                    |
|--------------------------------------|
| [ Save to Mine ]                     |   device first; synced when signed in
| [ Copy link ]   [ Add to calendar ]  |   link carries refs, never the party
| [ Download PDF ]                     |
|--------------------------------------|
| Saved on this phone. Sign in to keep |
| it on every device.                  |
+--------------------------------------+
```

## P9. Near-mode results (thin data, honest)

```
+--------------------------------------+
| <  Within 3 h of Toronto    2 of 6   |
|--------------------------------------|
| (Kind v)(Kids v)(October v)          |
| 4 places within 3 h ≈ · 2 more at 4 h|
|--------------------------------------|
| Lake of Two Rivers, Algonquin  [ + ] |
|  3 h 05 ≈ · N                        |
| Arrowhead Provincial Park      [ + ] |
|  2 h 20 ≈ · N                        |
| ...                                  |
|--------------------------------------|
| We have few places near Toronto yet. |
| ( Show 4 h ) ( Ask us for more )     |   never pads with unresearched places
|======================================|
| 2 picked · 2 nights        Next >    |
+--------------------------------------+
```
