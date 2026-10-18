# Foundation tokens (18 Oct 2026)

Final values for Trailhead after [review.md](review.md). Machine-readable copy: [tokens.json](tokens.json).
Names say what a token does. Components never contain a hex value. Contrast ratios are WCAG 2.x relative
luminance, computed on 18 Oct 2026; the check script is `docs/v2/design/redesign/build/contrast.py` and
should be pointed at tokens.json as the build gate.

## 1. Themes

| Theme | When | Notes |
|---|---|---|
| `light` | default everywhere, public site always starts here | paper and slate ink |
| `dark` | user choice or `prefers-color-scheme: dark` on signed-in screens | slate, not black; images at 92% |
| `sunlight` | manual, Today mode only | light theme with `--ink: #000000`, `--line: #8C99A8`, body 18 px, meta 14 px, no soft wells (status by text and icon) |

## 2. Colour roles

### 2.1 Surfaces and text

| Token | Role | Light | Dark |
|---|---|---|---|
| `--bg` | page | `#F5F6F8` | `#0F1620` |
| `--well` | sunk areas: outline column, table head, inputs, kind-glyph wells, phone canvas | `#ECEFF3` | `#0B1119` |
| `--surface` | cards, rows, sheets, menus | `#FFFFFF` | `#16202C` |
| `--surface-2` | quiet fills: hover rows, quiet day signs, collapsed days, segments at rest | `#E9EDF2` | `#1E2A38` |
| `--ink` | primary text, pins, routes, filled dots | `#172230` | `#E7ECF1` |
| `--ink-2` | body in cards, secondary headings | `#2B3746` | `#C9D2DC` |
| `--muted` | meta, labels, icons at rest | `#4D5B6B` | `#A3B0BE` |
| `--line` | hairlines, card borders, dividers | `#D8DEE5` | `#2A3A4C` |
| `--line-2` | input and button borders, keylines on identity swatches, strong dividers | `#7A8794` | `#5E748E` |
| `--header` | app header, phone bottom bar | `#172230` | `#0B1119` |
| `--header-2` | chip and button fills inside the header | `#1F2D3D` | `#16202C` |
| `--header-ink` | text and icons in the header | `#F4F6F8` | `#F4F6F8` |
| `--header-mute` | inactive tabs in the header | `#B8C3CF` | `#B8C3CF` |
| `--header-line` | borders inside the header | `#3A4A5D` | `#3A4A5D` |
| `--scrim` | behind menus and sheets | `rgba(11,17,25,.45)` | `rgba(0,0,0,.6)` |
| `--toast-bg` / `--toast-ink` | toast | `#172230` / `#F5F6F8` | `#E7ECF1` / `#0F1620` |

### 2.2 Allowed text pairs and their ratios

Minimum AA (4.5:1 for text under 24 px regular or 19 px bold; 3:1 for larger text and UI). AAA marked where
reached (7:1). No other text pair is allowed; add a row here before using one.

| Text on background | Light | | Dark | |
|---|---|---|---|---|
| `--ink` on `--bg` | 14.85 | AAA | 15.28 | AAA |
| `--ink` on `--surface` | 16.06 | AAA | 13.83 | AAA |
| `--ink` on `--surface-2` | 13.66 | AAA | 12.24 | AAA |
| `--ink` on `--well` | 13.92 | AAA | 15.94 | AAA |
| `--ink-2` on `--bg` | 11.18 | AAA | 11.88 | AAA |
| `--ink-2` on `--surface` | 12.09 | AAA | 10.76 | AAA |
| `--ink-2` on `--surface-2` | 10.28 | AAA | 9.52 | AAA |
| `--muted` on `--bg` | 6.42 | AA | 8.23 | AAA |
| `--muted` on `--surface` | 6.94 | AA | 7.45 | AAA |
| `--muted` on `--surface-2` | 5.91 | AA | 6.59 | AA |
| `--muted` on `--well` | 6.02 | AA | 8.58 | AAA |
| `--header-ink` on `--header` | 14.82 | AAA | 17.49 | AAA |
| `--header-mute` on `--header` | 8.98 | AAA | 10.60 | AAA |
| `--accent-ink` on `--accent` | 6.96 | AA | 6.96 | AA |
| `--accent-text` on `--bg` | 5.85 | AA | 8.83 | AAA |
| `--accent-text` on `--surface` | 6.33 | AA | 7.99 | AAA |
| `--accent-text` on `--accent-soft` | 5.56 | AA | 7.26 | AAA |
| `--crit` on `--bg` | 6.11 | AA | 7.75 | AAA |
| `--crit` on `--surface` | 6.61 | AA | 7.01 | AAA |
| `--crit` on `--crit-soft` | 5.45 | AA | 6.36 | AA |
| `#FFFFFF` on `--crit-fill` | 5.70 | AA | 5.70 | AA |
| `--ok` on `--bg` | 6.04 | AA | 10.12 | AAA |
| `--ok` on `--surface` | 6.53 | AA | 9.16 | AAA |
| `--ok` on `--ok-soft` | 5.53 | AA | 7.87 | AAA |
| `--warn` on `--bg` | 6.40 | AA | 9.18 | AAA |
| `--warn` on `--surface` | 6.92 | AA | 8.31 | AAA |
| `--warn` on `--warn-soft` | 6.11 | AA | 7.84 | AAA |
| `--info` on `--bg` | 6.62 | AA | 9.13 | AAA |
| `--info` on `--surface` | 7.16 | AAA | 8.26 | AAA |
| `--info` on `--info-soft` | 5.91 | AA | 7.61 | AAA |
| `--toast-ink` on `--toast-bg` | 14.85 | AAA | 15.28 | AAA |
| pin numeral `--surface` on `--ink` | 16.06 | AAA | 13.83 | AAA |
| picked pin numeral `--accent-ink` on `--accent` | 6.96 | AA | 6.96 | AA |
| `--header-ink` at 80% on cover gradient (darkest band `rgba(11,17,25,.88)` over any photo) | ≥ 7.0 | AAA | same | |

UI (non-text) pairs: `--line-2` on `--surface` 3.67 light / 3.42 dark; `--line-2` on `--bg` 3.39 / 3.78;
`--accent` on `--header` 6.38 / 7.53; `--accent` on `--bg` 2.33 / 7.22 (so in light the accent never
stands alone as a thin indicator; the selected tab is also bold ink and the picked route has an ink casing).

## 3. Accent, status and semantic colours

One hue, one meaning. Fills and text are separate tokens because a fill carries dark text and a text
token must pass on paper.

| Role | Meaning | Light | Dark | Rules |
|---|---|---|---|---|
| `--accent` | **selected, now, primary action** (fill) | `#D9962B` | `#D9962B` | primary button, selected segment, picked day sign and route and pins, current day chip, insertion line, drag pill, active filter chip border |
| `--accent-ink` | text on `--accent` | `#241703` | `#241703` | |
| `--accent-text` | accent as text | `#8A5300` | `#E8A94A` | the live count, the leave-by number, the active filter chip text, the "Bookings →" affordance in the switcher; never body text |
| `--accent-soft` | accent well | `#FBEFD9` | `#2E2617` | active filter chip, booking-window callout |
| `--crit` | **urgent**: deadline inside 7 days, missed, breaks the day, destructive text | `#A8341F` | `#F28E80` | text and icon; dashed border for honesty markers |
| `--crit-soft` | urgent well | `#F9E5E0` | `#3A2020` | |
| `--crit-fill` | danger button fill, white text | `#B3402A` | `#B3402A` | |
| `--warn` | **caution**: window open, over pace, possible-but-check, unverified value | `#7A5200` | `#E0B15C` | text + triangle icon on `--warn-soft`; **never a fill**, so it cannot be confused with `--accent` |
| `--warn-soft` | caution well | `#FBF0D6` | `#2B2314` | |
| `--ok` | **done, booked, fits** | `#1D6B3A` | `#8FD0A0` | text + check icon; the only green in the system; never a brand or surface colour |
| `--ok-soft` | ok well | `#E0F0E6` | `#173025` | |
| `--info` | **notice**: offline, saved at, remote edit, template, read-only | `#3D5A78` | `#9DBBDA` | text + icon on `--info-soft`; dashed border for offline |
| `--info-soft` | notice well | `#E3EAF2` | `#182738` | |
| `--focus` | focus ring | `#172230` | `#E7ECF1` | inside `--header`: `#F4F6F8` |

Status mapping (components.md "Chips"): to book = neutral outline; window open = caution; due ≤ 7 days or
missed = urgent; held = outline + clock; booked and done = ok; idea = dashed neutral; unverified, no source,
location unconfirmed = dashed `--crit`.

## 4. Trip identity colours

Okabe-Ito, unchanged in both themes. Assigned per trip at creation, unique among trips that are not done;
done trips show `--line-2`. Each colour is used as a **ring** (2 px surface gap, then 2.5 px colour),
a **bar** (4 px under a photo) or a **square** (10 px beside a name), always with a **1 px `--line-2`
keyline** outside it, always within 8 px of the trip's photo or name. Never text, never a fill behind text,
never on the map.

| Key | Hex | On white | On `--header` dark | Trip in the household data |
|---|---|---|---|---|
| blue | `#0072B2` | 5.19 | 3.65 | Dolomites |
| orange | `#E69F00` | 2.25 (keyline) | 8.41 | Patagonia |
| rose | `#CC79A7` | 3.06 | 6.19 | Elora |
| teal | `#009E73` | 3.42 | 5.54 | Costa Rica |
| sky | `#56B4E9` | 2.31 (keyline) | 8.21 | Iceland |
| yellow | `#F0E442` | 1.32 (keyline) | 14.33 | Chamonix |
| vermillion | `#D55E00` | 3.87 | 4.90 | Rockies |
| none | `--line-2` | | | ideas and done trips |

The keyline is what makes yellow and sky legal on white. Orange and vermillion are near amber and coral;
they are permitted because identity never fills a control or carries text, so the nearest they come to a
status is a 10 px square beside a name.

## 5. Map palette

| Token | Light | Dark | Use |
|---|---|---|---|
| `--map-land` | `#EEECE6` | `#1A2330` | hypsometric base at valley floor |
| `--map-high` | `#FFFFFF` | `#2E3A48` | high ground tint |
| `--map-shade` | `rgba(23,34,48,.35)` | `rgba(0,0,0,.55)` | hillshade multiply |
| `--map-contour` | `#B9B1A4` | `#3A4A5C` | 100 m contours, 0.6 px; 500 m at 1 px |
| `--map-water` | `#6F9FB4` | `#3F7C8F` | rivers, lakes |
| `--map-border` | `--muted` at 60%, dash 4 4 | same | |
| `--map-label` | `--ink-2`, mono 12 px, halo `--map-halo` | | only trip places are labelled |
| `--map-halo` | `#FFFFFF` at 90% | `#0B1119` at 90% | behind routes and labels |
| `--map-route` | `--ink`, 2 px | `#E7ECF1`, 2 px | every day's route by road |
| `--map-route-dim` | route at 28% | | other days when one is picked |
| `--map-route-pick` | `--accent`, 3.5 px, 1 px `--ink` casing | same | the picked day |
| `--map-route-preview` | `--accent`, 2.5 px, dash 6 4 | | the dragged item's new leg |
| `--map-stop` | `--ink` dot 6 px, halo 1.5 px | | stops in All days |
| `--map-pin` | `--ink` 22 px circle, `--surface` numeral mono 600 11 px | | the picked day's stops |
| `--map-pin-pick` | `--accent` circle, `--accent-ink` numeral, 26 px | | selected item |
| `--map-pin-idea` | hollow ring 2 px `--ink` | | unscheduled |
| `--map-base` | `--ink` 26 px rounded square, `--surface` house glyph, Big Shoulders 800 14 px label with halo | | where you sleep |
| `--map-base-pick` | `--accent` square, `--accent-ink` glyph | | base of the picked day |
| `--map-cluster` | `--ink` circle 28 px, numeral count; co-located stops: one pin with a mono badge "3 · 5" | | |
| `--map-select-ring` | 2 px `--accent`, 4 px offset | | hovered or focused pin |
| `--map-leg-label` | mono 12 px `--ink-2` with halo, hidden below zoom 9 | | "38 min · 24 km" |

Globe (public): styles Relief, Light, Dark use the same land, water and label tokens; country pins are
`--accent` discs with `--accent-ink` counts (public: places + published trips), 28 to 44 px by count; the
hovered country fills `--accent-soft` at 35%; the selected country outline is 2 px `--accent`.

## 6. Type

Three families, all OFL, self-hosted from `docs/v2/design/redesign/fonts/` (woff2, latin subset):
Big Shoulders Display (variable, 100 to 900), Source Serif 4 (variable, roman and italic), IBM Plex Mono
(400, 500, 600). `font-display: swap` in the app; fallbacks `'Arial Narrow', sans-serif`, `Georgia, serif`,
`ui-monospace, monospace`.

| Token | Face | Size / line | Weight | Use |
|---|---|---|---|---|
| `--t-cover` | Big Shoulders | 96 / 0.86 | 800 | public cover titles only; 56 on phone |
| `--t-page` | Big Shoulders | 72 / 0.85 | 800 | page titles TRIPS, PLACES; 44 on phone |
| `--t-trip` | Big Shoulders | 40 / 0.9 | 800 | trip name in the trip bar; 26 on phone |
| `--t-section` | Big Shoulders | 32 / 1 | 800 | section heads, day titles, group headings |
| `--t-card` | Big Shoulders | 24 / 0.95 | 800 | card titles, switcher rows, base names in the outline |
| `--t-sign` | Big Shoulders | 19 / 1 | 800 | day signs (DAY 03), tracking .04em |
| `--t-sign-s` | Big Shoulders | 15 / 1 | 800 | small signs in rows and collapsed days |
| `--t-leave` | Big Shoulders | 78 / 0.85 | 800 | the leave-by number, `--accent-text` |
| `--t-body` | Source Serif 4 | 16 / 1.5 | 400 | body, summaries, descriptions, row titles at 600 |
| `--t-body-l` | Source Serif 4 | 19 / 1.45 | 400 | page intro lines, cover standfirst (21 on cover) |
| `--t-title` | Source Serif 4 | 17 / 1.25 | 600 | item and row titles |
| `--t-note` | Source Serif 4 italic | 15.5 / 1.4 | 400 | notes under items |
| `--t-small` | Source Serif 4 | 14.5 / 1.4 | 400 | tile notes, help text |
| `--t-mono` | IBM Plex Mono | 13 / 1 | 500 | buttons, tabs, pills, segments, table cells |
| `--t-meta` | IBM Plex Mono | 12.5 / 1.45 | 400 | card meta, dates, legs |
| `--t-label` | IBM Plex Mono | 12 / 1.3 | 500 | field labels, column heads, `--muted` |
| `--t-cap` | IBM Plex Mono | 11.5 / 1.2 | 600 | capital labels, tracking .06em, uppercase |
| `--t-chip` | IBM Plex Mono | 11.5 / 1 | 500 | chips |
| `--t-time` | IBM Plex Mono | 13.5 / 1 | 600 | times in timelines |

Rules. Big Shoulders only at the sizes above; never for a button, a sentence or a value under 15 px. Mono
sets one line; if it would wrap, truncate with an ellipsis and a `title`. Numbers in prose are serif;
numbers in rows, chips and tables are mono. Mono has slashed zeros by default; no `tnum` is needed. Minimum
text size 11.5 px, and 16 px for inputs on phone.

## 7. Spacing, radius, borders, elevation

- Space: `--s-1` 4, `--s-2` 8, `--s-3` 12, `--s-4` 16, `--s-5` 20, `--s-6` 24, `--s-8` 32, `--s-10` 40,
  `--s-12` 48, `--s-16` 64. Scanning density uses 8 to 12; reading density 16 to 24.
- Radius: `--r-1` 4 (kbd, badges), `--r-2` 6 (selects, small thumbs), `--r-3` 8 (buttons, inputs, segments,
  signs' thumbnail), `--r-4` 12 (cards, menus, drawers' header photo), `--r-5` 16 (phone cards, map
  panel), `--r-sheet` 18 top corners, `--r-full` 999 (pills, chips, rings).
- Borders: 1 px `--line` on cards and rows; 1 px `--line-2` on inputs, buttons, pills; 2 px `--accent`
  for selected cards and inputs in focus (plus the focus ring); dashed 1 px for idea, offline and honesty.
- Elevation (light): `--e-0` none; `--e-1` cards: 1 px `--line`; `--e-2` floating (menus, popovers,
  drag ghost, toast): `0 0 0 1px --line, 0 20px 50px rgba(23,34,48,.16)`; `--e-3` sheets and drawers:
  `0 0 0 1px --line-2, 0 24px 60px rgba(23,34,48,.22)`. Dark: `--e-1` 1 px `--line`; `--e-2`
  `0 0 0 1px --line-2, 0 20px 50px rgba(0,0,0,.5)`; `--e-3` `0 0 0 1px --line-2, 0 24px 60px rgba(0,0,0,.6)`.

## 8. Focus

`outline: 2px solid var(--focus); outline-offset: 2px; border-radius: inherit` on `:focus-visible` only.
Inside `--header` and on `--accent` fills the ring is `--focus` (ink in light, which is 6.38:1 on amber), and
inside the header it is `--header-ink`. Pins and map controls use `--map-select-ring`. Never remove the
ring without a replacement of equal size.

## 9. Z-index layers

| Layer | z | Holds |
|---|---|---|
| `--z-base` | 0 | content |
| `--z-sticky` | 10 | group headings, table heads |
| `--z-tripbar` | 15 | trip bar |
| `--z-header` | 20 | app header, phone bottom bar |
| `--z-drawer` | 25 | side sheet, bottom sheet |
| `--z-scrim` | 30 | scrim under menus and modal sheets |
| `--z-menu` | 40 | menus, popovers, switcher, ⌘K |
| `--z-toast` | 45 | toasts |
| `--z-drag` | 50 | drag ghost |

## 10. Breakpoints and grid

| Name | Width | Columns, margins | Notes |
|---|---|---|---|
| phone | < 640 | 1 col, 14 px margins | bottom bar, sheets from the bottom |
| tablet | 640 to 1023 | 8 col, 24 px | two columns where useful; outline collapses to a day strip |
| desktop | 1024 to 1439 | 12 col, 32 px, max content 1376 | Plan: outline 256 / document 620 / map fluid |
| wide | ≥ 1440 | 12 col, 32 px, max 1376 (map and covers full-bleed) | document stays 620 to 680; prose never over 76 characters |

Card grids: 4 columns ≥ 1280, 3 at 1024, 2 at tablet, 1 on phone; gap 18.

## 11. Motion

| Token | Value | Use |
|---|---|---|
| `--d-fast` | 120 ms | hover, press, chip toggle, focus ring |
| `--d-base` | 200 ms | menu open, popover, segment thumb, row expand |
| `--d-sheet` | 260 ms | drawer and bottom sheet open; close 200 ms |
| `--d-page` | 220 ms | view cross-fade |
| `--d-count` | 300 ms | numbers counting to new values |
| `--d-fly` | 600 to 900 ms, by distance | map fly-to |
| `--d-globe` | 1200 ms | globe fly-in; spin-down 400 ms |
| `--e-out` | `cubic-bezier(.2,.8,.2,1)` | entrances, sheets |
| `--e-in` | `cubic-bezier(.4,0,1,1)` | exits (always shorter than entrances) |
| `--e-std` | `cubic-bezier(.2,0,0,1)` | moves within the page |
| `--spring` | stiffness 520, damping 40, mass 1 (settles ~220 ms), interruptible | reorder, drag settle, pin drop |

What animates: position (reorder, move between days, sheet travel), opacity (fades), scale on lift
(1.02), transform on pins, numbers counting, map camera, globe camera and spin. What never animates: text
colour on status change, border colour on validation, the trip bar, table rows, anything on the Today
screen except the next-stop card growing into place and the sheet.

Reduced motion (`prefers-reduced-motion: reduce`): every move becomes a 120 ms fade; fly-to and globe
fly-in jump; auto-spin is off and the switch is disabled with a note; skeletons do not shimmer; springs
are replaced by 150 ms `--e-std`.
