# My map: phone wireframes (390 px and 320 px)

Spec: [features/world-map-scratch.md](../../features/world-map-scratch.md). Desktop: [desktop.md](desktop.md). Palette:
[palette.md](palette.md). Written 27 Oct 2026 (SCRATCHMAP-SPEC, travel-planner Opus). Planned only.

Principles checked on every frame: P2 (the map first, the country on demand), P3 (count at a glance, a country one tap
away, the way back visible), P4 (every control labelled with its state), P5 (sheet grows from the tap; the map keeps its
zoom and selection), P7 (the primary action is named on each frame), T2 (one hand, poor signal).

Legend for the ASCII: `▓` been (deeper `█`), `▒` want to go (dots), `░` transit (hatch), `·` sea, plain land is unmarked.
Colours are in palette.md; the patterns are part of the design, not a drawing shortcut.

## P1. First use: an empty map with Quick mark on

```
390 px
┌──────────────────────────────────────────┐
│ TRIP PLANS              [search][user][◐] │ 56 px header (unchanged)
├──────────────────────────────────────────┤
│ ( 0 of 195 )                [Find a country] │ floating, 8 px from the edges, 44 px tall
│ · · · · · · · · · · · · · · · · · · · · ·│
│ · ·  ___        __      _____ ___ · · · ·│ Equal Earth, whole world fits the width
│ · · /   \__   _/  \_  _/          \__ · ·│ silhouette painted by the server,
│ · ·|  N.Am  | |Eur |_/    Asia       \ · │ shapes and state after the envelope read
│ · · \_   __/   \__/ \   ___         _/ · │
│ · · · \_/  \  · /Afr \ /   \_  __  / · · │
│ · · · · · S.Am \     /  · · ·\/  \/· · · │
│ · · · · · \  / ·\__/ · · · · ·(Aus)· · · │
│ · · · · · · \/ · · · · · · · · · · · · · │
│                                    [ + ] │ 44 px controls, bottom right,
│                                    [ − ] │ above the sheet peek
│                                    [ ⌂ ] │ World (reset)
├──────────────────────────────────────────┤
│ ─────                                    │ sheet peek, 96 px, grab handle
│ Tap the countries you have been to.      │
│ [■ Quick mark: on ]   [ Map | List | Stats ] │ switch with its state in words; views
└──────────────────────────────────────────┘
│ Trips │Places │ Globe │Search │ Mine ● │ bottom bar, Mine current
```

Primary action: tap a country. Quick mark is on while the map is empty (spec 1.5): a tap marks Been with the wipe from the
finger, the counter rolls to "1 of 195", and the toast "France marked as been · Undo" sits above the peek for 5 s.

## P2. Twelve countries, Country depth, a country tapped

```
390 px
┌──────────────────────────────────────────┐
│ TRIP PLANS              [search][user][◐] │
├──────────────────────────────────────────┤
│ ( 12 of 195 · +1 territory )  [Find a country] │ count pill opens Stats
│ · · · ▓▓▓  · · · ▓█▓▓ · · · · · · · · · ·│
│ · · ▓▓██▓▓ · · · ▓▓▓▒ ·  ░  · · · · · · ·│ Canada lived (█ + stripes), US been,
│ · · ·▓▓▓▓ · · · · ▓▓▓▓[It]· · · · · · · ·│ Italy selected: amber edge over ink casing
│ · · · ·▓ · · · · · ▓▓ · · · · · · · · · ·│
│ · · · · ▒▒ · · · · · · · · · · · · ▒ · · │ Peru and Japan want to go (dots)
│                                    [ + ] │
│                                    [ − ] │
│                                    [ ⌂ ] │
├──────────────────────────────────────────┤
│ ─────                                    │ sheet at half height (bar hides above half)
│ IT  Italy                          [ × ] │ flag glyph, name --t-page, close
│ Southern Europe · 3 places · since 2019  │ mono meta
│ [ Been ✓ ] [ Lived ] [ Transit ] [ Want ]│ chips 44 px; selected = accent fill + check
│ Colour: automatic (step 2 of 4)  Change ›│ manual override (spec 1.7)
│──────────────────────────────────────────│
│ PLACES IN ITALY                       3  │
│ ● Florence · city · Jul 2019           ⋯ │
│ ● Lake Braies · our page ›             ⋯ │
│ ● Ortisei · our page ›                 ⋯ │
│ [ + Add a city or place ]                │
│──────────────────────────────────────────│
│ We have 2 trips and 42 places in Italy   │
│ [ Plan a trip here ]   Trips ›  Places › │ primary action for an unvisited or partly
└──────────────────────────────────────────┘ visited country
```

Rules: the sheet grows from the tapped country (P5); dragging it down to the peek keeps the selection; tapping the sea
clears it. "Plan a trip here" opens the trip builder (trip-builder.md). The bottom bar is hidden while the sheet is above
half height and returns at the peek.

## P3. "Which one?" over the Caribbean (tiny units)

```
390 px
│ · · · ▓▓ · · · · ·                       │
│ · · · · ▓ ∘ ∘ ∘ · ·   ← the tap covers 4 dots within 44 px
│ · · · · · ∘● ∘ · · ·                     │
├──────────────────────────────────────────┤
│ ─────                                    │ small sheet, auto height
│ Which one?                         [ × ] │
│ LC  Saint Lucia                Not yet › │ each row 56 px, state in words
│ VC  Saint Vincent and the Gr.  Not yet › │
│ BB  Barbados                      Been › │
│ MQ  Martinique (France)        Not yet › │ territories name their sovereign
└──────────────────────────────────────────┘
```

Picking a row opens P2's sheet for that unit. With Quick mark on, a row tap marks it directly and the sheet stays open
for the next.

## P4. Add a city

```
390 px, sheet full height
┌──────────────────────────────────────────┐
│ ← Italy                                  │ back to the country (the way back is visible, P3)
│ Add a city or place in Italy             │
│ [ Florence_                            ] │ search field, results as you type
│ CITIES                                   │ from the Italy gazetteer slice (one fetch, ≤ 25 KB gz)
│   Florence · Tuscany                 [+] │
│   Fiesole · Tuscany                  [+] │
│ OUR PLACES                               │ from the public place list for Italy (names only)
│   Florence Cathedral · sight         [+] │
│ Not listed? Suggest a place ›            │ feedback-and-reports.md, prefilled
│──────────────────────────────────────────│
│ When (optional)  [ Year ▾ ] [ Month ▾ ]  │ never a day (spec G6)
│ Level            [ Been ✓ ][ Lived ][ Transit ][ Want ] │
└──────────────────────────────────────────┘
```

## P5. List view (the non-visual equivalent)

```
390 px, Map | List | Stats = List
┌──────────────────────────────────────────┐
│ [ Search countries        ]   Sort: Name ▾│
│ [ All 249 ] [ Been 12 ] [ Want 3 ] [ … ] │ filter chips with counts
│ EUROPE                          5 of 44  │ sticky group head with count
│ ┌──────────────────────────────────────┐ │
│ │ AL Albania                  Not yet ▾ │ │ level control: a radio group in a menu,
│ │ AD Andorra                  Not yet ▾ │ │ the same state as the map
│ │ AT Austria          Been · 2 places ▾ │ │
│ │ ...                                  │ │
│ └──────────────────────────────────────┘ │
│ ASIA                            2 of 48  │
│ ...                                      │
└──────────────────────────────────────────┘
```

Rows are 56 px; at 200% text they wrap, never truncate. A change here animates on the map when the visitor returns to it
(reduced motion: no animation).

## P6. Stats

```
390 px, Map | List | Stats = Stats
┌──────────────────────────────────────────┐
│ 12 of 195 countries                      │ --t-display numerals
│ +1 territory · 6.8% of the world's land  │
│ CONTINENTS                        4 of 7 │
│ Europe        ▇▇▇▇▇▁▁▁▁▁▁▁▁▁▁▁   5 of 44 │ bar in the been ramp step 3; text carries the number
│ N. America    ▇▇▇▁▁▁▁▁▁▁▁▁▁▁▁▁   3 of 23 │
│ Asia          ▇▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁   2 of 48 │
│ ...                                      │
│ UN REGIONS                       9 of 22 │ collapsed list, one tap opens
│ PLACES                                   │
│ 31 cities and places · 7 with our pages ›│
│ MILESTONES                               │
│ [First stamp] [5 countries] [10 countries] │ quiet chips; tap shows the one-line reason
│ GOAL                                     │
│ 30 countries by 2030  ▇▇▇▇▁▁▁▁  12 of 30 │ set by the visitor; no reminders
│ [ Share image ]  [ Export ]              │ v1.1
└──────────────────────────────────────────┘
```

## P7. Mine › Map tab

```
390 px
┌──────────────────────────────────────────┐
│ MINE                                     │
│ ┌──────────────────────────────────────┐ │
│ │ Kept in this browser only.  Sign in › │ │ account card (unchanged)
│ └──────────────────────────────────────┘ │
│ [ My trips 2 | Favourites 5 | Map 12 ]   │ three segments, ≥ 97 px each at 320
│ ┌──────────────────────────────────────┐ │
│ │   (mini map, 110m, not interactive)   │ │ 16:9, the visitor's colours
│ └──────────────────────────────────────┘ │
│ 12 of 195 countries · 4 of 7 continents  │
│ [ Open my map ]                          │ primary
└──────────────────────────────────────────┘
```

## P8. 320 px fit

| Part | Width |
|---|---|
| Content width (320 minus 2 x 14) | 292 px |
| Count pill "12 of 195 · +1 territory" in mono 12.5 | about 170 px; shortens to "12 of 195" below 360 px |
| Find a country | icon only below 360 px (44 px, `aria-label` "Find a country") |
| Level chips in the sheet | four chips wrap to two rows of two at 320 px; each at least 44 px tall |
| Mine segments | three at 97 px; labels "Trips", "Favourites", "Map" with the count on a second line at 200% text |

## Motion (P5) and reduced motion

| Motion | Duration | Reduced motion |
|---|---|---|
| Scratch wipe (radial mask from the tap) | 320 ms ease-out | instant fill |
| Counter roll | 240 ms | instant |
| Chip pulse on select | 120 ms scale 1 to 1.06 to 1 | none |
| Sheet open from the country | the components' sheet timing | jump |
| Badge toast | 600 ms fade and scale | fade only |

## Dark

The same frames on `--bg` dark: sea `--scratch-sea` dark, unmarked land `--scratch-land` dark, the ramp lightens with
depth (palette.md). The selection edge is amber, which passes 3:1 on dark land and the first two steps by itself; the
ink casing carries it on the deeper steps.
