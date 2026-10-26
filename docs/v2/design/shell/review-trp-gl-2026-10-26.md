# Review: TRP-GL, trip-page go-live fixes (26 Oct 2026)

Reviewer: `travel-design-reviewer` (Opus 5.5). Scope: commit `4d234ae3` as merged in `dae375b8`: N1 to N6, MUST-6 print,
F7 and F8 imports, 15.223c booking rows; the open rulings SHOULD-2 and D4 from
[review-trp2b2-2026-10-23.md](../trip-page/review-trp2b2-2026-10-23.md) and
[REMAINING-CLOSURE-PLAN.md](../../build/public-site/REMAINING-CLOSURE-PLAN.md) 4.

Evidence: the builder's shots and print PDFs in `travel-wt/shots-TRP-GL/` (all 23 PNGs and both PDFs read, the PDFs
rasterised and read page by page), the commit's diff, and the code it touches. No build and no render of my own: the
coordinator asked for none while other lanes build. Contrast figures are WCAG ratios computed from token values and from
pixels sampled in the real-key shots.

Against: [principles.md](../foundation/principles.md) P1 to P9 and T1 to T5, [components.md](../foundation/components.md),
[tokens.md](../foundation/tokens.md) 5, [google-map-note.md](../trip-page/google-map-note.md), the trip-scope rules,
[keep-from-live-site.md](../keep-from-live-site.md) and the product direction (public, no login, no green).

## Verdict

**Approved with two must-fixes.** Both are small changes to the phone key panel, which this lane introduced. The print,
the travel-day rows, the booking rows, the imports and the hit areas are approved. SHOULD-2 is met with no new token. D4
needs a one-off data check, not a shot hunt, and blocks only if that check finds a stub of 1 km or more.

## Must fix before merge to the release

### M1. Tab from "Map key" crosses the whole map before it reaches the panel (important, a11y)

Screen: trip page below 1,024 px, map key open. `RouteKey` portals the panel into `.tl-mapbox`, and `createPortal`
appends it after the map. So Tab from the toggle goes to the OpenStreetMap credit link, then the Google map (its canvas,
"Keyboard shortcuts", "Map Data", "Terms", "Report a map error"), then Zoom in, Zoom out and Fit, and only then to Close.
That is about eight stops between a disclosure and what it disclosed. That fails WCAG 2.4.3 focus order. On a tablet with
a keyboard, a parent who opens the key cannot reach it without passing through the map. Not acceptable.

Fix (P5: open and close are linked):

- `web/components/trips/TripRouteMap.tsx`: make `<div className="tl-mapkey-slot" />` the first child of
  `<div ref={box} className="tl-mapbox">`, and in `RouteKey`'s `open()` change the host query to
  `.querySelector('.tl-mapkey-slot')`.
- `web/styles/timeline.css`: add `.tl-mapkey-slot { display: contents; }`. The panel stays absolutely positioned
  against `.tl-mapbox`.
- Check, in `trip-routes.spec.ts`: with the key open, Tab from "Map key" focuses Close, Shift+Tab from Close goes back to
  "Map key", and Escape still closes the panel and puts focus on the toggle. The portal keeps React's event bubbling, so
  the Escape handler on `.trip-map-key` is unchanged.

Do not move focus into the panel on open. With the DOM order right, a disclosure needs no focus move.

### M2. The open phone key shows one row, and not the line it exists to explain (important, P3, P6)

Screens: `phone-key-open-390-*` and `should2-dolomites-*-390-*-key`. The map box is about 250 px tall at 390, so the
panel gets about 125 px. The sticky head spends about 40 px of that on a row that holds only Close. The two-column grid
leaves each label about 96 px, so "Stop, numbered in the day's order" wraps to four lines. A family sees only the stop and
the base, or the stop and the straight line. The amber road line, which is the loudest thing on the map, is below the
scroll. At 320 the label column is about 60 px, about one word a line. N1 is met in the letter (half the map, the toggle
stays put, Google's strip stays visible), but a key that needs scrolling to name the route is not a glance (P3).

Fix:

- `web/styles/timeline.css`, inside the existing below-1,024 block. Close sits beside the list, not above it, and the list
  is one column:

  ```css
  .trip-map-key-panel { display: grid; grid-template-columns: minmax(0, 1fr) auto; column-gap: var(--s-2); align-content: start; padding: var(--s-2) var(--s-3) var(--s-3); }
  .trip-map-key-head { grid-column: 2; grid-row: 1; align-self: start; position: sticky; top: 0; padding: 0; margin: 0; background: none; }
  .trip-map-key-panel .trip-map-key-list { grid-column: 1; grid-row: 1; grid-template-columns: minmax(0, 1fr); row-gap: var(--s-1); }
  .trip-map-key-panel .trip-map-key-note { grid-column: 1 / -1; }
  .trip-map-key-panel .trip-map-key-list li[data-line] { order: -1; }
  ```

- `web/components/trips/TripRouteMap.tsx`, `list()`: put `data-line` on the `li` when `k.style` is `straight-estimate`,
  `route` or `route-pick`. In the phone panel the lines come first. The desktop key keeps the note's order.
- `web/components/trips/routeSpec.ts`: `KEY_LABEL.stop` becomes `"Stop, in the day's order"`. The swatch already shows
  the numeral, so "numbered" says nothing the swatch does not. Update the tests that pin the label.
- Acceptance, at 2x with the real key: at 390, Dolomites day 3 and Rockies day 5 show both line swatches (straight line
  and road) without scrolling. At 320, the same two swatches show without scrolling. Close stays visible while the rest
  scrolls.

## Should fix (go-live, own rows)

### S1. N3: "in all" sits beside the half's time (important, T1)

`Entry.tsx` prints "Drive **1 h 20** · 169.5 mi in all to Venice Marco Polo Airport". Read left to right, 1 h 20 and
169.5 mi are one claim, and a driver reads that as 127 mph. The second half carries no distance, which is right.

Fix in `LegRow`: on a split first half, put the distance after the destination: "Drive **1 h 20** to Venice Marco Polo
Airport · 169.5 mi in all". That is `{word} <b>{fmtHM}</b>{split ? '' : km}{to part}{split ? km : ''}`. Update
`trip-golive.spec.ts` N3 to expect `/to Venice Marco Polo Airport · [\d.]+ (mi|km) in all$/`. Evidence gap: no shot of the
Dolomites day 14 timeline exists. TRP-GL-V takes it at 1440 and 390, light and dark.

**The units question (UI-NOTES row):** no per-country default. Units belong to the reader, not the trip. They come from
the stored preference, then the browser locale, and the km | mi switch is the override (patterns.md 2, the header unit
switch). An en-US family reading miles on an Italy trip is correct. Close the row with this ruling.

### S2. Rockies "Book ahead" prints stale and research text (important, T1, trust)

Print and page both show "Maligne Canyon trailhead and Cavell Road closed for 2026" on a 2029 trip, "(not known yet on
lead time)", and "Whether a young child counts is not known yet". The Lake O'Hara lottery and the Lake Louise and Moraine
shuttle reservation are left out, because their only notes were dated and the dateless scrub removed them. Those two are
the bookings with the earliest deadlines on the trip. A family printing this sheet would skip a booking they cannot make
later. This is TRP-GL-C review F1, owned by BACKLOG 15.223b (data), not by this lane. It must land before go-live. When
it does, add the Dolomites test's year guard to the Rockies MUST-6 test: `expect(r.book).not.toMatch(/\b(19|20)\d\d\b/)`.

### S3. The collapsed phone key can name a line that is not on screen (important, pre-existing, P3)

`phone-controls-390-*`: Rockies days 4 and 5 show "Road route" or "Road or path route" in the collapsed row. In the
fitted view, the only line drawn is the dashed straight line between stops 3 and 1·2. `RouteKey` prefers `road` over
`estimate` whenever a road line exists anywhere in the spec. Either the road leg lies outside the fit or it has not drawn
yet. TRP-GL-V checks which. If it lies outside the fit, the picked day's fit should include its lines, not just its pins.
If the line simply has not drawn yet, nothing changes. Not introduced by TRP-GL. Open a row on the trip-page lane.

### S4. Evidence TRP-GL-V must retake (blocks the verifier's pass, not this review)

- `should2-dolomites-day4B-1440-light` and `should2-dolomites-day4B-390-light-key` show Day 3, not Day 4.
- Both `booking-rows-canadian-*` shots have the sticky header painted over the first row ("Calgary rental car..."). Take
  them with the row scrolled below the header.
- `phone-map-closed-390-*` shows the map before its tiles, with every pin in one row along the top edge. Retake after the
  map is ready, and confirm that frame never shows to a reader. If it does, it is a separate finding.
- No 320 shots exist. Take the key open and the map controls at 320.
- No shot of the Dolomites day 14 timeline (S1).
- The stop-level "Book ahead:" print line never renders: no booking row carries a `placeSlug` today
  (`withStopBookings`), so only the unit test covers it. Record that; it needs no fix.

## Polish

- **P1.** Print day 14 reads "Drive to Venice Marco Polo Airport · 1 h 20", then "Drive on to Venice Marco Polo Airport ·
  1 h 20". The second line could print "Drive on · 1 h 20". Low value; take it only with another print change.
- **P2.** `formatDistance` prints one decimal at every size ("169.5 mi"). Above 100, a whole number reads faster
  ("170 mi"). It is a shared function, so it gets its own row.
- **P3.** N5 (`shrink-0` on menu icons) is approved from the diff. No shot shows a long menu label at 320; TRP-GL-V adds
  one with the Export menu open.

## Approved, with ratios

- **N1 geometry.** The panel is at most 50% of the map box, scrolls with `overscroll-behavior: contain`, and sits 28 px
  above the bottom. Google's logo and the "Keyboard shortcuts · Map Data · Terms" strip stay visible in all six open
  shots. The toggle does not move, because the collapsed key stays in place with `visibility: hidden`. The panel clears
  the zoom column by 12 px. Text: `--ink` on `--surface` is 16.06:1 light and 13.83:1 dark. The Close and More borders,
  `--line-2` on `--surface`, are 3.67:1 light and 3.42:1 dark (non-text, 3:1 minimum). The base swatch is amber on white
  at 2.52:1, but it carries its `--ink` casing at 16.06:1, so it passes.
- **N2 travel-day print.** Dolomites day 14 prints the drive, the stretch break, the second drive and "At the airport 3 h
  before an international flight", each with a time (~09:05, ~10:25, ~10:40, ~12:00). The start and check-out are left
  out. This matches T1 and the airport scenario.
- **N4 hit areas.** `::before` gives 44 px on the zoom, Fit, toggle, More and Close buttons, and the drawn size is
  unchanged. On a fine pointer the 34 px controls sit 10 px apart, so adjacent 44 px areas meet exactly and do not
  overlap. On a coarse pointer the buttons are drawn at 44 px. The 10 px gap also applies to every map that uses
  `Controls`, which is intended.
- **MUST-6 print.** "Book ahead" comes after the meta line and before Day 1, with name, day and the rule or note, and is
  kept on one page (`break-inside: avoid`). Dolomites prints "Opens 30 days before Day 3" with no year. Notes are
  `--muted` on white at 6.94:1.
- **F7 and F8.** The page, print and CSV now share core `bookRuleText` and `printTime`. `bookRuleLabel` and the third
  wording in `trips.ts` are gone. The dangling " local" is fixed in one place.
- **15.223c.** The "By category" rows use `publicBookingNote`, and a row whose note says there is nothing to book keeps
  the row and drops the line. This is the same test as the export's `bookingOf`. In the shots, Johnston Canyon parking and
  Jasper SkyTram show no booking line, and Tre Cime shows its rule once, as a chip, not twice.

## SHOULD-2 ruling: met, no new token

The open item was the picked-route amber over Google's dark basemap: 4.8:1 on typical land, about 2.1:1 on the lightest
pixels. I quantised the map area of `should2-dolomites-day3-1440-dark` and `day4B-1440-dark` and measured every class
against both layers of the line (`--map-route-pick` `#D9962B` 3.5 px over `--map-casing` `#0B1119` 5.5 px):

| Basemap class (share of map) | Amber | Casing | Edge carried by |
|---|---|---|---|
| Teal land `#11303C` to `#193D4D` (about 50%) | 4.60 to 5.52 | 1.36 to 1.64 | amber |
| Grey-violet rock `#363F53` / `#394055` (11 to 16%) | 4.19 / 4.10 | 1.80 / 1.84 | amber |
| Lightest land `#2D4E5B` / `#2C4B5A` (5 to 7%) | 3.55 / 3.69 | 2.12 / 2.04 | amber |
| Darkest land `#17242D` (4 to 7%) | 6.29 | 1.20 | amber |
| Grey roads and label glyphs `#79858D`, `#687B73` (4 to 7%) | 1.50 / 1.79 | 5.01 / 4.21 | casing |
| Light mode, every fill (`#B1DEC3` to `#F6FCF5`) | 1.69 to 2.42 | 10.79 to 18.19 | casing |

The 2.1:1 figure comes from the grey road and glyph pixels, and the casing frames those at 4.2 to 5.0:1. Within 6 px of
the line, 1.35% (day 4) and 3.31% (day 3) of pixels miss 3:1 against both layers. Every one of them is the line's own
anti-aliased edge (`#725422`, `#7F5717`: amber blended into casing), not basemap. Each edge therefore has one layer at
3:1 or more, which is the rule in tokens.md 5.1.

After the Map ID restyle (Q-A), the dark wood target `#2B3845` gives amber 4.76:1, and the dark `--map-land` `#1A2330`
gives 6.29:1. No `--map-estimate`, no halo change, no thicker stroke, no dash change; `tools/theme_tokens.py` needs no
change. I recorded the measurement in [tokens.md](../foundation/tokens.md) 5.1, as a note with no token value changed, so
`tokens.json`, the specimen and `components.md` stay as they are.

The trp2b concern about the near-white estimate out-reading amber is also closed. In the dark shots, the 2 px dashed
estimate (8 to 13:1) reads as secondary next to the 3.5 px solid cased amber.

**Carried, not this lane (critical, owner):** the light shots still show Google's green land and park fills (`#C1EFD3`
to `#D3F8E2`, about 60% of the map) and green dashed trails. That breaks the no-green rule. It is google-map-note F1 and
Q-A (console Map ID restyle) and must be done before go-live. Until then, Google's green dashed trails also look like our
dashed estimate, which matters for D4.

## D4 ruling: a data check first; blocks only if a large stub exists

No shot shows a dashed stub of 1 km or more, because in the current data the Croda del Becco pin sits at the route's end
at Braies (the crop of `day4B-1440-dark` shows the amber line ending under pin 1), and Dolomites day 3 ends at the
Cadini and Auronzo pins. The required evidence:

1. A one-off unit test or script over the built public trips (`routeSpec` with the real `legs`, every picked day and
   every variant) that lists each `straight-estimate` stub (`:a` and `:b` ids) with its `gapM`. Attach the list, sorted by
   length, to the TRP-GL-V hand-back.
2. If no stub is 1 km or more, D4 closes on that list. The 50 m rule is covered by the existing unit test. **Not
   blocking.**
3. If any stub is 1 km or more: real-key 2x shots of the longest one at 1440 and 390, light and dark, through the theme
   control. Pass if the stub starts where the amber ends, its dash and halo are at least 3:1 against the land
   (`--map-route` dark `#E7ECF1` is 8 to 13:1 on the measured fills; light `--ink` with its halo), and it cannot be taken
   for a Google trail. That last condition needs Q-A done or the trail layer hidden in the Map ID. **Blocking until those
   shots pass.**
