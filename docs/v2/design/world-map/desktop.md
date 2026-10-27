# My map: desktop wireframes (1440 px and 1024 px)

Spec: [features/world-map-scratch.md](../../features/world-map-scratch.md). Phone: [phone.md](phone.md). Palette:
[palette.md](palette.md). Written 27 Oct 2026 (SCRATCHMAP-SPEC, travel-planner Opus). Planned only.

Desktop is not a stretched phone: the map takes the whole width left of a 400 px panel, hover gives names and counts
without a click, the keyboard drives everything, and the stats are a dashboard rather than a sheet. Principles as in
phone.md, plus P1 (all 249 units readable at once in the list) and components 1.2 ("don't hide tabs behind More on
desktop").

Legend as in phone.md.

## D1. 1440 px, 23 countries, Italy selected

```
1440 px
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ TRIP PLANS   Trips   Places   Globe                                        [search] [◐] [▤ Mine] [Sign in]       │ 60 px header
├──────────────────────────────────────────────────────────────────────────────────────┬───────────────────────────┤
│ [/ Find a country      ]  Colour by: [Country depth|Cities]  [■ Quick mark: off]       │ [ Country | Stats | List ]│ toolbar 48 px;
│                                         [Share] [Print] [⋯ Export · Import · Settings] │                           │ panel tabs
│ · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · │ IT  Italy           [ × ] │
│ · · · · · ▓▓▓▓▓ · · · · · · · · · ▓▓▓█▓ · · · · · · · · · · · · · · · · · · · · · · │ Southern Europe           │
│ · · · ▓▓▓██████▓▓ · · · · · · · ▓▓▓▓▒▓▓ · · ░ · · · · · · · · · · · · · · · · · · · │ 3 places · since 2019     │
│ · · · · ▓▓▓▓▓▓▓▓ · · · · · · · · ▓▓▓[Italy]▓  · · · ▓▓ · · · · · · · · · · · · · · ·│                           │
│ · · · · · ▓▓▓▓ · · · · · · · · · · ▓▓▓ ▓ · · · · · ▓▓▓ · · · · ▒ · · · · · · · · · · │ [Been ✓][Lived][Transit]  │
│ · · · · · · ▓▓ · · · · · · · · · · · ▓▓ · · · · · · · · · · · · · · · · · · · · · · │ [Want to go]   1 2 3 4 ⌫  │ key hints
│ · · · · · · · ▒▒▒ · · · · · · · · · ·▓▓▓ · · · · · · · · · · · · ▓▓▓ · · · · · · · · │ Colour: automatic, step 2 │
│ · · · · · · · · ▒▒ · · · · · · · · · · ▓ · · · · · · · · · · · · ▓▓▓▓ · · · · · · · · │   Change ›                │
│ · · · · · · · · · ▒ · · · · · · · · · · · · · · · · · · · · · · · · ▓ · · · · · · · · │───────────────────────────│
│ · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · │ PLACES IN ITALY        3  │
│                                ┌─────────────────────┐                                │ ● Florence · city  Jul 19 │
│                                │ ES Spain  · Not yet │ hover card at the cursor        │ ● Lake Braies · page ›    │
│                                │ Click to open       │ (name, state, places count)     │ ● Ortisei · page ›        │
│                                └─────────────────────┘                                │ [+ Add a city or place]   │
│                                                                              [+]      │───────────────────────────│
│                                                                              [−]      │ We have 2 trips and 42    │
│                                                                              [⌂]      │ places in Italy           │
│ ▢ Unmarked ▓ Been (1-4 steps) █ Lived ▒ Want to go ░ Transit      Natural Earth · ...  │ [ Plan a trip here ]      │
├──────────────────────────────────────────────────────────────────────────────────────┴───────────────────────────┤
│ 23 of 195 countries · +2 territories · 9.1% of the world's land · 5 of 7 continents         keys: / ← → + − 0 Esc  │ status line 32 px
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

| Region | Width at 1440 | Notes |
|---|---|---|
| Map | 1,040 px (the content width minus the panel) | Equal Earth's 2.05:1 ratio fits 1,040 x 507 at 1x; the rest is sea, so 2x zoom is the useful default on a 900 px tall screen |
| Panel | 400 px, `--surface`, 1 px `--line` | tabs Country · Stats · List; collapses to a 48 px rail with the three icons (button "Hide panel") |
| Legend | always visible, bottom left of the map | patterns and words; the attribution line at the right |
| Status line | always visible | the counts at a glance (P3) and the key hints (P4) |

## D2. Stats dashboard (panel tab Stats, or full width)

```
1440 px, Stats opened full width ("Expand" in the panel)
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ← Map                                                                                              [Share] [Print] │
│ ┌────────────────────────┐ ┌────────────────────────┐ ┌────────────────────────┐ ┌────────────────────────┐        │
│ │ 23 of 195              │ │ 9.1%                   │ │ 5 of 7                 │ │ 41                     │        │
│ │ countries              │ │ of the world's land    │ │ continents             │ │ cities and places      │        │
│ │ +2 territories         │ │                        │ │                        │ │ 9 with our pages ›     │        │
│ └────────────────────────┘ └────────────────────────┘ └────────────────────────┘ └────────────────────────┘        │
│ CONTINENTS                                   UN REGIONS (9 of 22)                    BY YEAR (when given)         │
│ Europe      ▇▇▇▇▇▇▇▇▁▁▁▁▁▁  11 of 44         Northern Europe     4 of 10            2015 ▇ 2                      │
│ N. America  ▇▇▇▁▁▁▁▁▁▁▁▁▁▁   4 of 23          Southern Europe     5 of 16            2017 ▇▇ 3                     │
│ Asia        ▇▇▁▁▁▁▁▁▁▁▁▁▁▁   4 of 48          ...                                    2019 ▇ 1                      │
│ ...                                                                                  no year: 17                  │
│ MILESTONES                                                     GOAL                                               │
│ [First stamp] [5] [10] [Region complete: Northern Europe]      30 countries by 2030  ▇▇▇▇▇▇▇▁▁▁  23 of 30          │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Every number is text; bars repeat it, never replace it. No chart needs a legend to be read (P4).

## D3. List (panel tab List, or full width)

Full width at 1440: a table with columns Country, Continent, Region, Level (a select), Places, Year, Note, sortable,
grouped by continent with sticky group heads and counts (keep-from-live-site: grouping, counts, sticky heads). Filter
chips All · Been · Lived · Want to go · Transit · Not yet with counts; one "Clear". 249 rows, no pagination needed
(P1: one visitor's own list is bounded).

## D4. 1024 px

The panel narrows to 360 px; the toolbar folds Share, Print and the More menu into "⋯"; Colour by becomes a select. The
map keeps at least 640 px.

## D5. Print poster

```
A3 landscape (print CSS, vector)
┌──────────────────────────────────────────────────────────────────────┐
│  [ the map in the visitor's theme, full width, no controls ]           │
│                                                                        │
│  23 countries · 5 continents · 9.1% of the world's land                │
│  [display name, only if the visitor typed one]   ▢ ▓ █ ▒ ░ legend      │
│  Natural Earth · world-countries (ODbL) · trip plans                   │
└──────────────────────────────────────────────────────────────────────┘
```

Defaults as the share image (spec 1.11): no Lived (drawn as Been), no years, no notes, cities off.

## D6. Keyboard and focus

As spec 2.2. Focus ring: 2 px `--focus` outside the shape's edge, drawn over the amber selection when both apply. The
hover card also appears for keyboard focus, anchored to the shape's centre, so a keyboard user gets the same glance.

## D7. Hover

| Target | Card | Delay |
|---|---|---|
| A country | flag, name, state in words, places count | 120 ms, follows the cursor, flips at the edges |
| A dot | as a country | as above; crowded dots fan out at 1x to 2x |
| A city pin | name, level, year if given | as above |

Hover never changes state; a click does. Touch laptops get the phone's tap rules.

## Dark

As phone.md. The panel and toolbar use the normal dark surfaces; the map uses the scratch tokens.
