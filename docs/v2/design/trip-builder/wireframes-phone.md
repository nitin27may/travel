# Trip builder: phone wireframes (390 px)

Spec: [features/trip-builder.md](../../features/trip-builder.md). Index and shared rules: [README.md](README.md).
Counts in the frames are **measured on 27 Oct 2026** where they name our data (Italy: 69 records in the Nord-Est group,
8 in the rest of the country; Ontario: 4 records), so the frames show the honest thin-data states the build must handle.
Everything else is illustrative.

Phone rules (all frames): the step header is fixed at the top (52 px); the primary action sits in the bottom bar (64 px,
inside the thumb zone); sheets open from the bottom; nothing important is under the top 20% of the screen only (T2).

## Stage frames (TB-FLOW, 27 Oct 2026)

The flow is [FLOW.md](FLOW.md): stages 0 to 8, one document, copy enters at stage 7. These frames replace P1, P1b, P2,
P3, P4, P5, P6, P6a, P7 and P8 below (kept for history under "Earlier frames"); P3f, P3m and P9 stay as drawn. They apply
TB-N's findings (branch `public/TB-N`): kind first, focused flow (the step header and action bar replace the public
header and bottom bar while `/plan/` is open), Pick and Picked only with Must see in the tray, kids chip first, no swipe,
no drive-time rings, every Next names its destination. The step count counts only the stages a kind asks (FLOW 2.1).

| Old frame | New frame | Why |
|---|---|---|
| P1, P1b | F0 Kind, F1 Start | kind first (TB-N C1); from where, who and when for every kind (FLOW TF4) |
| P2 | F2 Where, F2n near envelope | macro-region, then travel regions (TF5) |
| P3 | F3 Pick, F3s near what you picked | towns then places; nearby on every pick (TF6) |
| P4, P5 | F4 Days and driving, F5 Build | driving per day and suggestions (TF7); bases inside the build (TF1) |
| P6, P6a | E1 to E6 | the editor (FLOW 7.1) |
| P7 | F6 | unchanged in substance |
| P8 | F8 Review and prepare | after Customise; known costs, book ahead (TF16) |
| none | C1 to C3 | copy and customise (FLOW 5) |

## F0. Stage 0: kind, and the ways in

```
+--------------------------------------+
| x  Plan a trip                       |   step header (focused flow); x keeps drafts
|--------------------------------------|
|  WHAT KIND OF TRIP?                  |
|  ( ) Day trip                        |   56 px tiles, radio + words
|  ( ) Weekend          1 or 2 nights  |
|  ( ) Long weekend     3 or 4 nights  |
|  ( ) A week by car    from home      |
|  ( ) A week by air    fly somewhere  |
|  ( ) Longer holiday   10 to 21 nights|
|                                      |
|  YOUR DRAFTS                         |
|  Italy · 9 places · Build      Open >|   resumes at its stage (TF14)
|  Rockies (your copy) · 15 days Open >|
|                                      |
|  OR START FROM                       |
|  A place you saved             >     |
|  One of our trips              >     |
|  Surprise me                   >     |
|--------------------------------------|
|          [ Next: Start ]  (disabled) |   one tap on a tile enables it
+--------------------------------------+
```

## F1. Stage 1: from where, who, when

```
+--------------------------------------+
| <  Weekend                  1 of 4   |
|--------------------------------------|
|  STARTING FROM                       |
|  [ Toronto (public hub)        v ]   |   one picker (OR11)
|  Use my location (stays on phone)    |
|                                      |
|  WHO IS GOING                        |
|  2 adults · 1 child (6)       Edit   |   device party, seeded from Account
|                                      |
|  WHEN?                               |
|  (*Next weekend*)(This weekend)      |
|  (A month v)(Summer)(Dates...)       |
|  (Not sure yet)                      |   a gap is never "open": scored unknown
|--------------------------------------|
| 9 places within 3 h ≈ · Oct          |   live count (near kinds)
|               [ Next: Discover ]     |   Where is shown done for Weekend
+--------------------------------------+
```

For air kinds the header reads "A week by air · 1 of 6", the count line is absent, and Starting from offers "Decide
later". Underneath: "We use this to suggest the airport to fly into."

## F2. Stage 2: where (trip mode)

```
+--------------------------------------+
| <  Italy                    2 of 6   |
|--------------------------------------|
| [ Italy                        x ]   |
| [ map peek 170 px: macro areas ]     |   tap = tick; count is text below
|--------------------------------------|
| (*Northern Italy 74*)(Central 2)     |   macro chips, counts in text
| (Southern Italy 3)(Islands 0)        |
|                                      |
| NORTHERN ITALY · pick one or more    |
| [x] Dolomites                 69     |
|     Val Gardena, Cortina, Braies     |
| [ ] Lake Garda       Thin: 3 places  |
| [ ] Venice                     2     |
| [ ] Lombardy lakes   Not researched  |   45%, gap chip
|     yet · Ask us to research it  >   |
|--------------------------------------|
| 1 region · 69 places                 |
|               [ Next: Pick ]         |
+--------------------------------------+
```

## F2n. Stage 2: where (near mode, long weekend and week by car)

```
+--------------------------------------+
| <  Long weekend             2 of 5   |
|--------------------------------------|
|  HOW FAR FROM TORONTO, EACH WAY?     |
|  ( 2 h )( 3 h )(*4 h*)( 6 h )        |
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

## F3. Stage 3: pick (towns, then places)

```
+--------------------------------------+
| <  Pick                     3 of 6   |
|--------------------------------------|
| (Filters 2)(Looking for: Hikes v)    |
| (Kids 6+ v)(July v)                  |
| 41 places · July · fits age 6  Clear |
|--------------------------------------|
| TOWNS AND CITIES                     |
| Ortisei     Town · Val Gardena       |
|   (Fits 6)(Worth a detour)  [Picked] |
|   [x] Stay here                      |   pins a base (TB2)
| Cortina     Town · 1 h 10 ≈ east  [Pick]|
| Show 4 more towns  v                 |
|--------------------------------------|
| PLACES                               |
| [ph] Seceda ridge             [Pick] |
|  Lift + walk · 2 h · 8 km from Ortisei|
|  (Fits 6)(Book ahead: lift slot)     |   kids chip first, safety never drops
| [ph] Lago di Braies         [Picked] |
|  Lake · walk 1 h 30                  |
|  NEAR WHAT YOU PICKED (3)        v   |   F3s opens here, under the pick
|              ( Map )                 |
|======================================|
| 6 picked · Must see 1 · about 5 days≈|   tray peek; tap = tray sheet
|               [ Next: Days ]         |
+--------------------------------------+
```

## F3s. Near what you picked (strip under a picked row)

```
|  NEAR LAGO DI BRAIES                 |
|  Prato Piazza   25 min ≈   [ Pick ]  |
|  Lago di Dobbiaco 15 min ≈ [ Pick ]  |
|  Tre Cime loop  50 min ≈   [ Pick ]  |
|  (Book ahead: toll road slot)        |
|  Hide these                          |
```

Up to six rows, the day-trip radius of the pick, ranked by score; announced "3 places near Lago di Braies". Our T0
records never appear here (QB9).

## F4. Stage 4: days and driving

```
+--------------------------------------+
| <  Days and driving         4 of 6   |
|--------------------------------------|
| Your 9 picks need about 6 days ≈     |
| Nights      [ - ]  9  [ + ]          |
| Driving per day                      |
| ( 2 h )( 3 h )(*4 h*)( 6 h )         |   driveDayMin (TF7)
| Pace    ( Relaxed )(*Standard*)(Full)|
| Moves   (*Fewer*)( Balanced )(Shorter)|
| We plan by car.                      |   TF17
|--------------------------------------|
| ALSO WITHIN YOUR DRIVING (12)        |
| Alpe di Siusi   35 min ≈ from Seceda |
|   (Fits 6)(Worth the journey)  [ + ] |
| Val di Funes    40 min ≈       [ + ] |
| Show 10 more                    v    |
|--------------------------------------|
|               [ Build my days ]      |
+--------------------------------------+
```

## F5. Stage 5: build (result)

```
+--------------------------------------+
| <  Your 10 days             5 of 6   |
|--------------------------------------|
| YOUR BASES · 1 MOVE                  |
| A Ortisei  5 nights [- +]  Keep base |
|   5 picks · avg 35 min ≈ · why  v    |
| B Cortina  4 nights [- +]  Swap town |
| Other ways: 1 base Bolzano +1 h 40/day|
|--------------------------------------|
| CHECKS                               |
| Driving 1 h 25 a day ≈ · 1 move      |
| Book ahead 3 · Warnings 1 · Did not  |
| fit 1 · Known costs EUR 74 + 4 not   |
| priced                          v    |
|--------------------------------------|
| (1)(2A)(3A)(4A)(5A)(6B)(7B)(8B)(9B)  |   day chips with base letters
| Day 2 · A Ortisei · 1 h 10 driving ≈ |
|  08:25  Seceda lift and ridge  2 h   |
|         (Book ahead: lift slot)      |
|         drive 20 min ≈               |
|  12:30  Lunch                        |
|  14:00  Alpe di Siusi walk     2 h   |
|  17:30  Back at Ortisei              |
|======================================|
| Map ^       [ Next: Getting there ]  |   near kinds: [ Edit my plan ]
+--------------------------------------+
```

Building state: the checks block is a progress card "Working out drive times · 12 of 30"; Next disabled.

## F6. Stage 6: getting there (air kinds)

```
+--------------------------------------+
| <  Getting there            6 of 6   |
|--------------------------------------|
| From  [ Toronto (YYZ)          v ]   |
| Fly into  Venice (VCE)  2 h 30 ≈ to A|   region gateway beats nearest (OR3)
|   or Verona (VRN) · Innsbruck (INN)  |
| Home from Venice (same airport)      |
|   or open jaw: out of Milan (MXP)    |
|   saves 1 h 10 ≈ on Day 10           |
| (Fares not shown)  Search flights ^  |
| Car  Pick up at VCE · one-way fees:  |
|      ask the rental company          |
| Day 1 is now an arrival day.         |
|--------------------------------------|
|               [ Edit my plan ]       |
+--------------------------------------+
```

## E1. Stage 7: the editor (a day)

```
+--------------------------------------+
| [ph] Italy · 10 days · July    ...   |   trip header (scenario rule 1)
| 2 adults · 1 child (6) · On device   |   sync state word (edit-my-trip 4.7)
|--------------------------------------|
| (1)(2A)(3A)(4A)(5A)(6B)(7B)(8B)(9B)  |
| Day 2 · A Ortisei · 1 h 10 ≈    ...  |   day menu: add a day, drop, note
|  = 08:25 Seceda lift and ridge  2 h  |   = handle; tap row = E2
|          (Locked to Day 2)           |
|  = 14:00 Alpe di Siusi walk     2 h  |
|  ! Day ends 40 min after sunset      |   W_DAYLIGHT with a fix
|    [ Move Siusi to Day 3 ]           |
|  + Add a place to Day 2              |   E4
|  Add a note                          |
|======================================|
| Undo  Settings  Review >             |   Settings opens stages 1, 2, 4, 6
+--------------------------------------+
```

## E2. Item sheet

```
+--------------------------------------+
| Alpe di Siusi walk                   |
| Day 2 · 14:00 · 2 h                  |
|--------------------------------------|
| Move up                              |
| Move down                            |
| Move to day ...                   >  |   E3
| Swap with ...                     >  |
| Swap for a nearby place           >  |   the stop's near strip
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
|--------------------------------------|
| NEAR DAY 2                           |
| Val di Funes                  [ + ]  |
|   fits after Siusi · +15 min ≈ ·     |
|   day ends 17:55                     |
| Resciesa lift                 [ + ]  |
|   Day full: try Day 3                |
| Seiser Alm hut lunch          [ + ]  |
|   fits at 12:30 · +5 min ≈           |
+--------------------------------------+
```

## E5. Rebuild confirm and what moved

```
+--------------------------------------+
| Rebuild unlocked days?               |
| 3 locked stops stay where they are.  |
| [ Rebuild ]            [ Cancel ]    |
+--------------------------------------+

after:
| Days 3 to 5 rebuilt · 2 stops moved  |   toast with Undo; rows marked
|                    [ Undo ] [ Show ] |
```

## E6. Settings sheet (a stage reopened from the editor)

```
+--------------------------------------+
| Driving and pace                x    |
|--------------------------------------|
| Driving per day ( 3 h )(*4 h*)( 6 h )|
| Pace  ( Relaxed )(*Standard*)( Full )|
| Nights  [ - ] 9 [ + ]                |
|--------------------------------------|
| Changes rebuild unlocked days.       |
| [ Apply ]                            |
+--------------------------------------+
```

The same sheet form hosts Start (from, who, when), Where and Getting there.

## F8. Stage 8: review and prepare

```
+--------------------------------------+
| <  Review                            |
|--------------------------------------|
| Italy · 10 days · July · 2 bases     |
| 1 move · 9 places · 1 h 25 a day ≈   |
|--------------------------------------|
| BOOK AHEAD (3)                       |
| Seceda lift slot   by 1 Jun   Link ^ |
| Tre Cime toll road by 15 Jun  Link ^ |
| Ortisei stay       now (July) Link ^ |
| WARNINGS (1)  Day 7 ends after sunset|
| DID NOT FIT (1)  Sorapis lake  >     |
| KNOWN COSTS                          |
| EUR 74 known · lodging, car, food    |
| and 4 activities not priced          |
| Check entry rules for Italy      ^   |   trips abroad only
|--------------------------------------|
| [ Keep in Mine ]                     |   F-Q4; short kinds: Add to calendar
| [ Copy link ] [ Calendar ] [ PDF ]   |
| Kept on this phone. Sign in to have  |
| it on every device. The link carries |
| the places, never who is going.      |
+--------------------------------------+
```

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

## C2. Make it yours (first open of a copy, stage 7)

```
+--------------------------------------+
| Make it yours                   x    |
|--------------------------------------|
| Keep it as it is                  >  |
| Change dates and who              >  |
| Change where you start            >  |
| Change places or regions          >  |   stage 3, trip's places ticked
| Rebuild with my driving and pace  >  |   stage 4
|--------------------------------------|
| You can do all of this later from    |
| Settings.                            |
+--------------------------------------+
```

## C3. Converting a copy into your own plan (first engine action)

```
+--------------------------------------+
| This makes it your own plan.         |
| Our later updates to the Dolomites   |
| trip will no longer change it.       |
| [ Continue ]           [ Cancel ]    |
+--------------------------------------+
after: toast "Now your own plan" [ Undo ]
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
