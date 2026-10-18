# Design system (working draft, 17 Oct 2026)

Built from scratch for this product, not copied from Wanderlog, TripIt or the legacy pages. The owner's
brief: light is truly light, dark is truly dark and easy on the eyes, and the planning experience
(search, setting a base, the map, drag and drop, distances, transitions) makes or breaks the product.

| Page | Contents |
|---|---|
| this file | identity, colour tokens for light and dark, type, space, shape, motion, map styling |
| [interactions.md](interactions.md) | every core interaction specified: predictive search, set a base, add, drag between days and lists, drag on the map, distance recalculation, undo, transitions, phone gestures |
| [tech.md](tech.md) | libraries chosen for rendering and interaction, with alternatives and why |
| [prototype.md](prototype.md) | what the clickable prototype covers, how to run it, what it does not prove |

## 1. Identity

**Subject:** families and couples planning trips that involve real terrain: trails, passes, lakes, lifts,
long drive days. The product's job on screen is to make a plan **legible at a glance** (where we sleep,
how far we drive, what fits whom) and **effortless to change**.

**Visual idea: "contour and signpost".** Calm surfaces like a well-printed topographic map, with
information set like an alpine trail signpost: condensed capitals for day numbers and place types,
precise tabular numbers for times and distances, and colour used only to mean something.

**One accent with a meaning: alpenglow.** The pink-red light on the Dolomites at sunset (*enrosadira*)
marks *now and here*: the selected day, the base you sleep at, the item being dragged, today's next
stop. Everything else is ink on paper or a quiet teal for actions. Colour never decorates.

What it deliberately avoids: cream paper with serif headlines, purple gradients, neon on black, cards
with a coloured left rail, emoji as icons, and Inter as a default face.

## 2. Colour tokens

Names say what a colour does, never what it is (as in `legacy/_system/`).

| Token | Role | Light | Dark |
|---|---|---|---|
| `--bg` | app background | `#F6F7F5` near-white with a faint green-grey bias (limestone) | `#07090A` near-black, faint green bias |
| `--surface` | panels, cards, sheets | `#FFFFFF` | `#0F1312` |
| `--sunk` | inputs, wells, the outline rail | `#EDF0EC` | `#050606` |
| `--raised` | popovers, drag ghost | `#FFFFFF` + shadow | `#161B19` + 1 px `--line` |
| `--ink` | primary text | `#131C18` (16:1 on bg) | `#D3DBD7` (14:1 on bg; not pure white, to avoid halation on black) |
| `--muted` | secondary text, icons | `#56635D` (5.9:1) | `#86938D` (6.2:1) |
| `--line` | hairlines, dividers | `#D6DCD8` | `#222A27` |
| `--act` | actions, links, selection outline | `#16191C` charcoal (17:1; was glacier teal, changed 18 Oct 2026: the owner rejected green, and green buttons beside the crimson accent read as two brands) | `#E4E6E8` (15:1); buttons use `--bg` text on it. Green stays only in `--ok` for done and booked states |
| `--glow` | *now and here*: selected day, base, dragging, next stop | `#C2385C` alpenglow (4.9:1) | `#E58BA1` (8.1:1) |
| `--ok` / `--warn` / `--crit` | fits / caution / blocks | `#2D7A4B` / `#9A6200` / `#B3362F` | `#6BBF8A` / `#D9A45A` / `#E57F77` |
| `--route` | route lines on the map | `--ink` at 80% | `--ink` at 70% |

All text and icon pairs meet WCAG AA in both themes (checked 17 Oct 2026; script in prototype.md).

**Dark theme rules (eye strain):** near-black, not grey; text slightly dimmed from white; accents
desaturated and lightened rather than reused; elevation shown by a lighter surface plus a hairline,
never by shadows (invisible on black); the map turns dark too (its own relief rendering), so a night
check of tomorrow's plan does not flash a white map. Images are dimmed 8% in dark mode.

**Sunlight mode** (a third, manual theme for Today mode outdoors): light theme with `--ink` at pure
`#000`, `--line` darker, and larger type, for reading at a trailhead.

## 3. Type

| Role | Face | Use |
|---|---|---|
| Signpost (display) | **Big Shoulders Display** 700-800 | day numbers ("DAY 3"), section labels in capitals, the trip title; never body text |
| Interface and reading | **Schibsted Grotesk** 400-700 | everything else: controls, cards, notes |
| Numbers | **Schibsted Grotesk**, proportional figures | times, distances, durations, prices, elevations |
| Codes | **IBM Plex Mono** 450-600 | booking codes, email addresses, field keys in the admin review |

Scale (rem, 16 px base): 0.75 caption · 0.875 small · 1 body · 1.125 card title · 1.375 section ·
2 day number (display) · 2.75 trip title (display). Body line height 1.5; labels in capitals get 0.06 em
letter spacing. Numbers use the interface face (changed 18 Oct 2026: mono for every number made prose
sentences look like code). Do not turn on `tnum`: Schibsted's tabular set also widens `:` `,` `.`, which
renders 18:30 as "18 : 30". Columns of numbers right-align instead.

## 4. Space, shape, elevation

- 4 px grid: 4, 8, 12, 16, 24, 32, 48.
- Radius by role: 6 px controls, 10 px cards and sheets, full round only for avatars and pins.
- Elevation in light: one soft shadow for floating things only (popover, drag ghost, bottom sheet).
  In dark: no shadows, a lighter surface and a hairline.
- Touch targets 44 px minimum; dense desktop rows 36 px with a 44 px hit area.

## 5. Motion

| Purpose | Duration | Curve |
|---|---|---|
| Hover and press feedback | 90-120 ms | ease-out |
| Item moves (reorder, between days) | spring: stiffness 520, damping 40 (settles ~220 ms) | spring, interruptible |
| Panel and sheet open | 200-260 ms | cubic-bezier(.2,.8,.2,1) |
| Map fly-to on section change | 600-900 ms, distance-scaled | MapLibre ease |
| Numbers changing (drive time, totals) | 300 ms count | ease-out |
| Pin drop | 260 ms drop + 1 small settle | spring |

Rules: motion shows where something went or came from, never decorates; every animation is
interruptible; `prefers-reduced-motion` replaces moves with 120 ms fades and turns off fly-to (jump).

## 6. Map styling

- Base: shaded relief with a hypsometric tint (valleys faintly green, high ground near white in light;
  charcoal to slate in dark), then roads and water, then **our** layers on top. Labels are kept sparse:
  only places that matter to the trip are named; the basemap's own labels are reduced.
- Pins: numbered circles in `--ink` (`--surface` number); the selected item and the night's base in
  `--glow`; the base is a house glyph; ideas (unscheduled) are hollow rings; catalog suggestions are
  small dots that grow on hover.
- Route for the selected day: a solid `--route` line with a 2 px halo in `--bg`; other days faded to 25%.
- Distances: a small label at each leg's midpoint ("38 min · 24 km"), hidden below zoom 9.
