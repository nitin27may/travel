# Three directions (18 Oct 2026)

Each direction is a complete system: colour roles in light and dark, a type pairing, shape, elevation,
motion, imagery, map and icons. All three use the same household data (trip-scope-scenarios.md), the same
real Dolomites plan, the same Wikimedia Commons photos and the same Mapterhorn relief, so the only thing
that differs between them is the design.

Previews: open [index.html](index.html). Every direction has the same pages: Trips home (S1), Plan on
desktop, Plan on a phone, Today on a phone (S5), the Bookings switch (S2), a public trip from Discover and a
trail page. Trailhead also has the Places table kept from the live site. Every page has a theme toggle (sun
icon, or `?theme=dark` / `?theme=light` in the URL).

## Rules all three share

- **Trip identity.** Every trip gets a hero photo and one colour from a fixed set, the Okabe-Ito palette,
  which stays distinguishable under the common colour-vision deficiencies: blue `#0072B2` (Dolomites),
  orange `#E69F00` (Patagonia), rose `#CC79A7` (Elora), teal `#009E73` (Costa Rica), sky `#56B4E9`
  (Iceland), yellow `#F0E442` (Chamonix), vermillion `#D55E00` (Rockies). The colour never appears alone:
  it is a ring round the trip photo, a bar under the photo, or a square beside the name. It is never used for
  text, so its contrast with the page does not matter for reading.
- **Status colours mean one thing each.** Urgent (crimson or coral) is used only for a deadline inside 7
  days or something that breaks the day. Green is used only for done and booked. The accent is used for
  selected, now and the primary action.
- **Contrast.** `build/contrast.py` checks every text pair in both themes; all 62 pairs pass WCAG AA
  (4.5:1 for text). The output is in [contrast-report.txt](contrast-report.txt).
- **Fonts.** The fonts are open-licence (OFL) and self-hosted in [fonts/](fonts/), with their licences.
- **Photos.** Photos are hotlinked from Wikimedia Commons at the standard thumbnail widths (330, 960, 1920).
  Every page credits what it shows: title linked to the file page, author, and licence linked to its deed.
- **Map.** The relief is rendered from Mapterhorn terrarium tiles (zoom 10), with OpenStreetMap rivers and the
  border. Routes are drawn through road waypoints, not as straight lines between stops. Bases are named;
  catalogue labels are left off.

## A. Atlas: the trip as a magazine feature

**Idea.** The photograph carries the colour and the type carries the authority. White paper, a high-contrast
editorial serif for anything that is a name (trip, day, place), and a quiet grotesk for everything you
operate. It feels like a travel magazine that happens to be editable. It is closest to what Wanderlog wants
to be, done with more restraint.

| Role | Light | Dark |
|---|---|---|
| page `--bg` | `#FFFFFF` | `#0E0F11` |
| paper, wells `--paper` | `#F6F5F2` | `#16181B` |
| text `--ink` / `--ink2` | `#111317` / `#383C43` | `#ECECEA` / `#C9CACC` |
| secondary `--muted` | `#5F646C` | `#9EA2A9` |
| hairline `--line` / `--line2` | `#E7E5E0` / `#D2CFC8` | `#25282C` / `#34383D` |
| primary action `--act` (text `--act-ink`) | `#111317` on `#FFFFFF` | `#ECECEA` on `#0E0F11` |
| urgent `--crit` / `--crit-soft` | `#B3263E` / `#FBEEF0` | `#F28B9B` / `#2A1519` |
| done `--ok` / `--ok-soft` | `#2C7A4B` / `#E9F4EE` | `#6FC495` / `#14231A` |
| window opens `--warn` / `--warn-soft` | `#8F5B00` / `#FBF3E4` | `#E0AE62` / `#2A2113` |

- **Type.** Instrument Serif 400 (and its italic) for display: trip titles 84-128 px, day numbers, section
  heads and the italic notes on items. Instrument Sans 400-700 for the interface: 15 px body, 13 px meta and
  11 px capital labels. The figures are proportional.
- **Shape.** 6 px on controls and 10 px on cards and photos; buttons are full pills. In light, elevation is
  one soft shadow plus a deep lift for drag and popovers. In dark, a 1 px hairline replaces the shadow.
- **Motion.** Photos scale 1.03 on hover over 600 ms (cubic-bezier .2,.8,.2,1). Sheets and drawers take
  240 ms. Map fly-to takes 700 ms. Reduced motion swaps these for fades.
- **Imagery.** Full-bleed photography: the trip header is 200-240 px tall, the public trip cover is 640 px
  and the trail cover is 560 px. Every day, item and trail gets a photo. Where none exists, a kind glyph sits
  on a paper well.
- **Map.** Paper-white relief with no contours and charcoal routes. Bases are white squares with a house
  glyph and an italic serif label. In dark the map is near-black relief.
- **Icons.** 24 px line icons, 1.5 stroke, round caps.
- **Strengths.** It has the most emotional pull. The public trip page sells the plan. It is the clearest on
  a phone.
- **Weaknesses.** The serif display costs vertical space in dense planning views. It is the least
  distinctive structurally, and is nearest to a generic premium travel app.

## B. Altimeter: a precise instrument, dark first

**Idea.** The planner is treated as an instrument panel. It is near-black, numbers are set in mono with
slashed zeros, every day is a small gauge (drive bar, walk bar, base colour), and one signal colour (amber)
marks now, selected and dragging. Navigation is a left rail with the trip as a module at the top: photo,
countdown, readiness gauge, and ⌘K to switch. It suits the owner as an architect and power user; Linear and
an avionics display are the references.

| Role | Dark (default) | Light |
|---|---|---|
| page `--bg` | `#0A0C0E` | `#F3F4F5` |
| surfaces `--s1` / `--s2` / `--s3` | `#101316` / `#161A1E` / `#1D2227` | `#FFFFFF` / `#FFFFFF` / `#F0F2F3` |
| text `--ink` / `--ink2` | `#E4E8EB` / `#B6BEC5` | `#0D1013` / `#33393F` |
| secondary `--muted` | `#8B959D` | `#59626A` |
| hairline `--line` / `--line2` | `#20262C` / `#2D353C` | `#E1E4E7` / `#CDD2D6` |
| signal fill `--sig` / text `--sig-text` | `#FFB547` / `#FFB547` | `#FFB547` / `#8A4F00` |
| urgent `--crit` | `#FF7480` | `#B3263E` |
| done `--ok` / `--ok-soft` | `#5FD08F` / `#10261A` | `#1F7A47` / `#E5F3EA` |

- **Type.** Archivo (variable width) at 112-125% width for headings and capital labels. JetBrains Mono for
  every number, time, code and date. Body is 14 px, so it is denser than the other two.
- **Shape.** 6-8 px radius, square line caps on the icons, and 1 px hairlines. Elevation is a lighter
  surface plus a hairline; no shadow is used except under the palette and drag ghost.
- **Motion.** 120 ms for state changes. The ⌘K palette opens in 160 ms. Gauges count up over 300 ms. Drag
  uses a spring that settles in about 220 ms.
- **Imagery.** Photos are framed as data: the trip module, 72 px item thumbnails, a 120 px card strip and a
  trail split screen. Images are dimmed 12% in dark.
- **Map.** A contour-line basemap with 100 m and 500 m lines on black relief. Each base gets its own grey for
  its routes. The picked day is amber. The map has a readout panel and a scale bar.
- **Icons.** The same set at 1.6 stroke with mitred joins.
- **Strengths.** Densest planning. The best keyboard story (⌘K, ⌘1-4, ⌘[ back). The day strip shows the
  whole trip's effort at a glance. It is also the most distinctive of the three.
- **Weaknesses.** It is the coldest of the three for a family audience and for the public site. The mono
  type and capital labels read as a tool rather than a trip, and a dark-first default suits planning at night
  but not sharing with grandparents.

## C. Trailhead: the live site, re-coloured and grown into an app

**Idea.** The owner likes the live Trips, Places and Globe pages in context, so this direction keeps their
structure, components and type pairing. It keeps Big Shoulders signpost titles, Source Serif 4 for prose,
IBM Plex Mono labels, photo cards with countdown chips and an editorial line, filter pills for each
dimension, group and sort, Cards/List/Table/Map, the table tools and the honesty markers. **It drops the
forest green completely** (owner, 18 Oct): the base is cool stone paper with slate ink, and a navy header
with the amber rule under it, light first. Amber means one thing: selected, now, or the primary action. The
day sign (an amber arrow plate, DAY 03) is the one decorative element, and it is functional.

| Role | Light (default) | Dark |
|---|---|---|
| page `--bg` / `--deep` | `#F5F6F8` / `#ECEFF3` | `#0F1620` / `#0B1119` |
| cards `--surface` / `--surface2` | `#FFFFFF` / `#E9EDF2` | `#16202C` / `#1E2A38` |
| text `--ink` / `--ink2` | `#172230` / `#2B3746` | `#E7ECF1` / `#C9D2DC` |
| secondary `--muted` | `#4D5B6B` | `#A3B0BE` |
| hairline `--line` / `--line2` | `#D8DEE5` / `#8C99A8` | `#2A3A4C` / `#52667B` |
| header `--header` (text `--header-ink`) | `#172230` (`#F4F6F8`) | `#0B1119` (`#F4F6F8`) |
| accent fill `--accent` (text on it `--accent-ink`) | `#D9962B` (`#241703`) | same |
| accent as text `--accent-text` / soft `--accent-soft` | `#8A5300` / `#FBEFD9` | `#E8A94A` / `#2E2617` |
| kind glyphs `--teal` | `#0B5B5E` | `#5CC4C8` |
| urgent `--crit` / `--crit-soft` | `#A8341F` / `#F9E5E0` | `#F28E80` / `#3A2020` |
| done `--ok` / `--ok-soft` | `#1D6B3A` / `#E0F0E6` | `#8FD0A0` / `#173025` |

- **Type.** Big Shoulders Display 800 for titles and signs. Source Serif 4 for reading text, place names and
  notes, at 16 px. IBM Plex Mono 500 for labels, dates, numbers and chips, at 11.5-13 px. Mono never sets a
  sentence longer than one line.
- **Shape.** 8 px on controls, 10-12 px on cards, and full pills for chips and filters. In light, elevation is
  a hairline plus one soft shadow on floating things. In dark it is hairlines only.
- **Motion.** As in the current design README: 90-120 ms feedback, a spring for reorder, 200-260 ms sheets
  and a distance-scaled fly-to.
- **Imagery.** The live site's card anatomy: a 16:10 photo with the trip colour bar under it, then title,
  mono meta, countdown and status chips, a serif summary, readiness, and the next deadline. Places without a
  photo get a kind glyph on a tinted well, as on the live site.
- **Map.** A topographic basemap: hypsometric stone tint, relief, and 100 m and 500 m contours in warm grey.
  It turns slate at night. Bases are amber signposts with a Big Shoulders label. The globe keeps the live
  site's controls (Relief, Light and Dark styles, 3D terrain, auto-spin, drill-down, saved places by
  country) under the new header.
- **Icons.** The same set at 1.75 stroke with round caps. Kind glyphs are teal, as on the live site.
- **Strengths.** It is continuous with what the owner already likes and with the published read-only site.
  It is the most legible across planning, reading and the read-only catalogue. The live site's power-user
  tools (table, saved views, CSV) are already part of it.
- **Weaknesses.** It has three typefaces, so it needs discipline (the rules above). Big Shoulders in capitals
  is loud if overused, so it is kept to titles, signs and counts.

## Rebuilding the previews

```bash
cd docs/v2/design/redesign/build
python3 atlas.py && python3 altimeter.py && python3 trailhead.py   # writes ../<direction>/*.html
python3 contrast.py                                                 # AA check, exits 1 on a failure
python3 dem.py && python3 render_maps.py                            # only if the map area changes; fetches Mapterhorn tiles once
```

`data.py` holds all content and photo credits; `common.py` the icons, the trip map, credits and page shell.
