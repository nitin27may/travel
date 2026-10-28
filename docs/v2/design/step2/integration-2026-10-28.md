# STEP2 integration pass: E1, E1B, E2, E3, E4 together (28 Oct 2026)

Branch `step2/INT` from main 047be0dc. Built with `NEXT_PUBLIC_TRIP_EDIT=1`, decoy `HOME_POINT_LAT=10.5 HOME_POINT_LON=-140.5`, served by `next start` on a free port, one spec at a time (`PW_REUSE_SITE=1`). Shots: `/Users/nks/workspace/travel-wt/S2-INT-shots/` (390, 768, 1440; light and dark; 2x; not committed).

## Issues

| # | Where | What | Status | Evidence |
|---|---|---|---|---|
| I1 | `t-edit-drag`, `t-edit-keyboard` specs | counted `li.tl-entry[data-edit]`, which includes rule rows since E1B | Fixed: selectors say `[data-edit="stop"]` | 17 failures to 0 |
| I2 | `drag/registry.ts` `stopRows` | same selector in the product: the drag layer counted rule rows as stops, so a keyboard lift said "position 2 of 10" on a day of 4 stops, and the nudge and insertion maths counted rule rows | Fixed: stops only; rule rows are not slots | `t-edit-keyboard` 8 of 8 |
| I3 | `tests/foundation/tokens-css.test.ts` | `--settle-ms` (drag.css, set from TSX by DragLayer) is not defined in any sheet; the test failed in the unit project | Fixed: added to the runtime-set list in the test | 3 of 3 |
| I4 | `t-edit-keyboard` "A opens the add panel" | still expected E1's old group "Add to Day 2"; E3 replaced it with the picker | Fixed: expects the picker dialog | passes |
| I5 | `mine-trips.spec.ts` | assumed the flag-off build: Open goes to `/trips/<slug>/?...`, the copy sheet link reads "Open in Mine" (5 failures with the flag on) | Fixed: spec reads `NEXT_PUBLIC_TRIP_EDIT` and expects `/t/<id>/` and "Open your trip" when on; flag-off expectations unchanged | 22 of 22 both projects |
| I6 | E3 `addPlace` ops | the picker named the added day by its displayed number; after "Add a day" the day is an inserted day (ref = op id), so the place went to the published day with that number (it appeared on the wrong day) | Fixed: `dayRef(doc, n)` in AddPicker, Arrival (two sites) and the Maybe "back" op in rows.ts; `dayRef` exported from stopOps | `t-edit-flow` |
| I7 | `lib/trip-edit/deviceEdits.ts` | `copies/1` can only hold an added place by a numbered day, and the device envelope's `added` was trusted only when it named exactly the copy's places, so a place on an inserted day was dropped at the next read (after a reload, and after any document re-read) | Fixed: numbered entries are compared, the rest kept | `tests/trip-edit/device-edits.test.ts`, `t-edit-flow` reload |
| I8 | E3 `add/fit.ts` | the fitter scheduled the published days with no day operations: "fits after ...", "Day full", the base line, Move here and the day ranking read the wrong day once a day was added or dropped | Fixed: schedules with the day ops, reads the days as the page does (`effectiveDays`), numbers every map by the shown day; the picker's model uses the effective days | `add-picker.test.ts` new case |
| I9 | Toast (phone) | E1B: the stack covered a phone bottom sheet and stayed past 6 s. Measured: a lone toast lives 6.1 s on mouse and touch. The long stays were a touch (or the pointer resting on the toast) firing `mouseenter` with no `mouseleave`, which pauses the clock for good | Fixed: only a mouse pointer pauses; with a bottom sheet open the region sits on the sheet's edge, shows one toast, lets a tap through to the row under it and keeps Undo tappable | shots `6-picker-added-390-*`; lifetime probe |
| I10 | Cover facts strip at 768 | 4 cells in 3 columns left a tinted empty cell (shared `.trip-glance`, so the public cover too at 640 to ~900) | Fixed: a last cell alone on its row fills it | shot `1-edit-top-768-dark` |
| I11 | Phone edit bar | only Settings and Done by spec (components 8.6): after the toast goes, Undo is in the cover's Trip actions menu, far up the page | Open: design review (P3). Not changed | `1-edit-top-390-*` |
| I12 | Day rail in the sticky bar at 1280 and 1440 with the edit tools | the number strip shows about 7 of 15 days and scrolls by itself to the day in view; a drag to a day cell out of view needs the strip scrolled first | Open: design review. The flow spec scrolls the cell in | `2-stop-menu-1440-light` |
| I13 | Desktop add picker side sheet | the title band is a dark navy block over a light body in the light theme | Open: confirm it is the sheet style (Settings uses the same band) | `6-picker-added-1440-light` |
| I14 | `place size` median in `budget:report` | 1.2542 of 1.25 (headroom -317 B) on this build | Open: place pages are untouched by this pass; check against main | report |

## Measures

- `/t/<id>/` start JS (script tags in the HTML, gzipped): 299.1 KB, under `TRIP_EDIT_JS_BUDGET_KB` 325. `/trips/<slug>/` start JS 193.8 KB (limit 200).
- Flag off (built to a second dist dir): `/t/` answers 404; `/trips/<slug>/` start JS 231.1 KB vs 232.5 KB flag on (budget report 192.4 vs 193.8 KB; the flag-on build carries the edit hooks the earlier packages accepted). The place-size median is 1.2539 with the flag off too, so I14 is not from the flag.
- I10 note: the fix is in shared `styles/trips.css`, so the public cover at 640 to 899 px is a 2 x 2 strip as well.
