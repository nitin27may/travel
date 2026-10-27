# Trip builder: phone wireframes (390 px)

Spec: [features/trip-builder.md](../../features/trip-builder.md). Index and shared rules: [README.md](README.md).
Counts in the frames are **measured on 27 Oct 2026** where they name our data (Italy: 69 records in the Nord-Est group,
8 in the rest of the country; Ontario: 4 records), so the frames show the honest thin-data states the build must handle.
Everything else is illustrative.

Phone rules (all frames): the step header is fixed at the top (52 px); the primary action sits in the bottom bar (64 px,
inside the thumb zone); sheets open from the bottom; nothing important is under the top 20% of the screen only (T2).

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
