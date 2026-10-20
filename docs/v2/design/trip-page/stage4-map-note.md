# Stage 4 map note (TRP, pre-build, 19 Oct 2026)

Rulings for brief steps 8, 15 and 16. These are written from the code, the design and L3c and are not rendered yet; the after-review renders them. Tokens come from `web/app/themes.css`.

## 1. Sticky map column, 1024 px and up

```
| header 60                                                   |
| plan bar (--spy-bar-h 52), full width                       |
| days minmax(0,680px) | 32 | aside >= 360                    |
|  Day 4               |    | [All days|Day 5]  DAY 5 · Jasper |
|  -- focus line --    |    | +-----------------------------+ |
|  Day 5 09:00 ...     |    | | 1--2--3   other days 28%    | |
|                      |    | +-----------------------------+ |
```

- **Layout:** `grid-template-columns: minmax(0,680px) minmax(360px,1fr); gap: var(--s-8)`. That gives 568 + 360 at 1024 and 680 + 664 at 1440. Move the existing `#route` section into the aside; keep one `MapSurface`.
- **Sticky:** `top: calc(var(--header-h) + var(--spy-bar-h) + var(--s-4))` (128 px), with `align-self: start`. The aside stacks a 40 px label row, then the map at `clamp(360px, calc(100dvh - 192px), 720px)`, then the key.
- **Short page:** the grid row gets `min-height` equal to the aside, so the footer never slides under the map. Below 600 px of viewport height, the map is not sticky and shows static at 360.
- **What it shows:**
  - The whole trip (`fit: 'all'`) before Day 1 reaches the focus line, and in the category view.
  - After that, the settled TS1 day: its route in `--map-route-pick`, other days in `--map-route-dim`, `stop-numbered` pins in timeline order, and the base signpost.
- **Fit:** `fit(dayFitIds(...))` with 48 px padding and `maxZoom 13`.
- **Timing:**
  - Keep the 350 ms debounce after `onSettle`.
  - The fly takes 600 ms if the old and new bounds overlap and 900 ms if they do not, on `--e-std`.
  - During a rapid scroll the camera does not move. A day that settles mid-fly stops the current fly and starts the new one from where the camera is. Flies never queue.
  - Reduced motion: a jump.
- **Linking:**
  - Hover or focus on a current-day entry rings its pin (2 px `--map-select-ring`, 120 ms) and turns the leg before it amber (200 ms).
  - Entries on other days do nothing; hovering never flies the map.
  - Hovering a pin gives its row `--surface-2`.
  - Clicking a pin scrolls the row to the focus line. Activating a pin by keyboard also focuses the entry title.
- **Area-only and unplaced stops:**
  - An area-only stop uses the hollow `place` pin, labelled "(area only)". It gets no number and no line vertex, and it stays out of the fit. The entry keeps the "Area only" chip.
  - An unplaced stop gets no pin. The label row reads "1 stop not on the map".
  - Only pinned stops are numbered, so the map and the timeline numbers always match.
- **Whole trip or day:** the label row holds a two-segment control, "All days | Day N".
  - "All days" pauses following and shows "Paused · Follow Day N" (a link).
  - Following resumes from that link, from the Day segment, or from a rail cell or strip click.
  - Scrolling back above Day 1 returns to the whole trip without pausing.
- **Keyboard and screen readers:**
  - `<aside aria-labelledby="route-h">`.
  - The canvas is one tab stop. Pins are not tab stops; the timeline is the accessible list.
  - Each segment has `aria-pressed`.
  - The label row is `aria-live="polite"` and updates on settle only: "Map: Day 5, Maligne Lake, 4 stops".

## 2. Phone "Map · Day N" pill

```
|  ...day list...                      |
| (Map · Day 5)               [96 px clear] |
| Trips  Places  Globe  Sign in  (84)  |
```

- **Pill:**
  - `position: fixed; left: var(--s-4); bottom: calc(var(--phone-bottombar-h) + var(--s-3))`.
  - 44 px tall, `--r-full`, `--toast-bg` on `--toast-ink` (14.85:1 light, 15.28:1 dark), `--t-tab` type, an 18 px map icon, `--z-tripbar`.
  - The right 96 px above the bar stays clear for the Search slot.
- **When it shows:** it fades in over 200 ms once `#route` leaves the viewport, and only when the route has positions. Its label follows the settled day; before Day 1 it reads "Map · All days".
- **Sheet:** `BottomSheet` with `modal={false}`, `snaps={['peek','half']}`, `initial="half"`. There is no full snap.
  - The frame sits at `bottom: var(--phone-bottombar-h)`.
  - Half height is `min(50dvh, 100dvh - 428px)`, which keeps at least 200 px of days visible.
  - Peek is 120 px and shows "DAY 5 · Jasper · 4 stops".
  - The pill hides while the sheet is open.
- **Drag and dismissal:**
  - Drag snaps with velocity. A drag below peek closes the sheet, as does "Close map" (44 px).
  - Esc closes it and returns focus to the pill.
  - No history entry is pushed, so Back behaves normally.
  - On open, focus goes to the sheet heading (`tabindex=-1`). Tab can leave the sheet, so there is no trap.
  - The page scrolls beneath the sheet at half.
- **Follows scroll:** the sheet opens on the current day and then follows the settled day, with the same debounce and fly rules as section 1.
- **Motion:** 260 ms in, 200 ms out. Reduced motion fades.

## 3. Strip hour ticks

```
        06          12          18
Day 1 |..|..[=====|=====]=====|..|  2 h 30
```

- **Positions:** keep the 05:00 to 23:00 scale. The ticks sit at 6.7%, 38.9% and 72.2%.
- **Drawing:** draw the ticks as a background gradient on `.tl-bar`, 1 px `--line-2` on `--well` (3.18:1 light, 3.94:1 dark, which passes the 3:1 non-text rule). The span paints over them, so the ticks show only outside the day.
- **Labels:**
  - One `aria-hidden` header row sits above the list, aligned to the bar column, in `--t-label` `--muted` (6.94:1 light, 7.45:1 dark).
  - Repeat the header at the foot when the trip has more than 10 days.
- **390 px:** the bar and the header span the full row (334 px), so the ticks land at about 22, 130 and 241 px. There are never more than these three at any width.
- **Early or late days:** set the domain once per trip to `[min(05:00, floor(earliest start)), max(23:00, ceil(latest end))]`, clamped to 00:00 to 24:00. Ticks stay on multiples of 6 inside it.

## 4. L3c polish rulings (rows 4.4 and 4.10)

- **Variant menu:** each option gets one consequence line from the scheduler for the current profile, in `--t-meta` `--muted`, and a `--warn` fit note when it does not fit. Never type these by hand.
- **Phone day header:** the sun range joins the meta row and the chip sits inline. The summary is clamped to 2 lines and shown in full on expand. The header is at most 260 px before the first time.
- **"Plan it for":** sits under the glance tiles, above the season band. On the phone it is one line, "Planned for Family, 6 · Standard · Change", and it opens inline.
- **"Show both lanes":** a view switch only. The rejoin wait is scheduled in both views. Only the 260 ms lane growth changes; the times and warnings stay the same.

## 5. Scorecard

| | Met by |
|---|---|
| P1 | Per-day fit, numbering and ticks, which do not grow with trip length; the header repeats on long trips |
| P2 | The whole trip at rest, then the day, then a pin |
| P3 | Strip and pill to glance at, then segment, pin and sheet clicks |
| P4 | "Paused · Follow Day N" |
| P5 | Settle, interrupt, never queue; reduced motion jumps |
| P6 | The day's stops show while that day is read |
| P7 | The pill sits left and the sheet is non-modal, so the primary action stays reachable |
| P8, P9 | Same `RouteModel`, no new loads |
| T1 | The ticks place each day on the clock |
| T2 | The map is optional and hidden in print |
| T3 | Not affected |
| T4 | 44 px targets |
| T5 | Area-only pins are hollow and unnumbered; unplaced stops are counted, not drawn |
