# Design review and verification: STEP2-PRV, phase D (29 Oct 2026)

Status: **review** (travel-design-reviewer, Claude Opus 5.5). Branch `nxt2/PRV` from `main` fbc7b4cb. Review only: no code
was changed.

**Subject.** These packages:
- Save to a trip, STEP2-P1 (b842f207)
- one Mine list, STEP2-P2 (38f61c51)
- the copy lands in your trip, STEP2-P3 (1769006c)
- the Table view, UXB-5 (8ab979c0)
- the address and map links, LT-M (73bb0d57), with the LT-1 addresses now in data
- the /mine budget refactor (149cf536)
- the dark theme on /t/ (fb031226)

**Standard.** These documents:
- the foundation: principles P1 to P9 and T1 to T5, tokens, components, patterns 1.2, 3.7, 3.8, 3.9 and 3.11
- `web/app/themes.css`
- [README.md](README.md) sections 3 to 6.1
- [edit-mode-spec.md](edit-mode-spec.md) 7.4 and EA12
- [location-type-requirements.md](../../features/location-type-requirements.md) section 13
- the owner's bar: alignment, full width, 44 px targets, AA, no green, purple or emojis, phone and desktop, light and dark

## Verdict

| Surface | Verdict | Ship with flags on (GO-2)? |
|---|---|---|
| Save to a trip, picker and "In your copy" line (P1) | Not ready. The picker sends a family to the wrong trip, and the park flow does not finish | **NO-GO** until PR-001, PR-002 and PR-003 are fixed |
| One Mine list: rows, menu, draft row, empty state (P2) | Works. Three copies and one draft list as four rows, once each. The menu is right. Thumbnails and rings are right in both themes | **GO**, with PR-010 and PR-011 fixed before or soon after |
| Copy to my trips landing, Undo, storage blocked, "You have a copy" (P3) | Works end to end at every width. Undo removes the copy and returns. The blocked fallback keeps the done step | **GO**, with PR-008 and PR-009 as follow-ups |
| Table view (UXB-5; public, not behind a flag) | Good structure and semantics. One overlap bug shows at every width and in print | **Fix PR-004 before the next deploy** (no flag gates it) |
| Address and map links (LT-M) | The page part works and is honest. The exports carry no addresses for the flagship trip | **GO** for pages. PR-012 and PR-013 are follow-ups |
| /mine budget (MINE-BUDGET) | Holds | PASS |
| Dark theme on /t/ (THEME) | Stored dark survives a full load and client navigation to `/t/<id>/` | PASS |
| EA12, flag off | **Fails as stated**: 450 place pages change by 24 to 37 B with the flag off (PR-005). `/trips/` HTML is unchanged in content | Fix PR-005 (one line) |

Counts: 4 must-fix, 14 should-fix, 8 nice-to-have.

## Fix status (STEP2-PRV-PRFA, 29 Oct 2026, branch `prv/PRFA`)

Fixed with before and after shots in `PRV-PRFA-shots/`. PR-003, PR-011, PR-012, PR-013 and PR-026 belong to PRFB and the places template.

| Row | Status | How |
|---|---|---|
| PR-001 | fixed | The picker ranks by the nearest base: near trips by distance, trips with no known points, then "Far from <place>" ones. Base points are a small device cache (`travel.copy-bases.local`, `web/lib/mine/bases.ts`), written when a copy is made and looked up once from the trip's public export for a copy made before; no change to `copies/2` |
| PR-002 | fixed | A far row says "Open trip"; the add picker's far state offers Back to the place, Save without a trip, and the builder link when `planBuilder` is on |
| PR-004 | fixed | A word time breaks at its space in a wider Time column; a Playwright check at 320 to 1760 |
| PR-005 | fixed | `edit` is spread only with the flag on; 436 of 439 flag-off place pages lost the 24 B prop and none carries it |
| PR-006 | fixed | "On Day 11 in this trip" and Open Day 11; the arrival leads with it and puts Move behind a button |
| PR-007 | fixed | Title "Add to a trip", place name above the rows, full snap from three rows, no size buttons |
| PR-008 | fixed | A copy lands with the Days under the sticky line; an add shows its day (`#day-N`) |
| PR-009 | fixed | "No date yet" on the cover line, the Starts stat and the Summary; README 5.1 |
| PR-010 | fixed | With `planBuilder` off an unbuilt draft is not a link, says "Draft · the planner is not open yet", and its menu is Remove |
| PR-014 | fixed | 44 px |
| PR-015 | fixed | From 1024 px the Table takes the full content width and the map is behind the Map button |
| PR-016 | fixed | Where is the stop's own area, empty when unknown (the column is dropped when no stop has one); the base is in the caption |
| PR-017 | fixed | Modal sheet plus a Tab wrap at both ends |
| PR-018 | fixed | The cover kicker sits on a header-coloured pill (about 8:1 over white) on /t/ and on place covers |
| PR-019 to PR-025 | fixed | Plan day in the "In your copy" line; a damaged store says so; a scrim on the side sheet; own icon for Change dates (Add to calendar uses the `event` glyph, no plus variant in the set); row names from visible text; group counts right at every width; the stop is the row header and the caption reads "Day 4" |

## How this was reviewed

- **Builds.** Three production builds (`pnpm --dir web build`), each with `HOME_POINT_LAT=10.5 HOME_POINT_LON=-140.5` and no
  `.env.local`. `.og-cache` was copied read-only from the main checkout.
  - Flag on: `NEXT_PUBLIC_TRIP_EDIT=1`, `.next-on`, served on port 4731.
  - Plain build (flag off): `.next-off`, served on port 4732.
  - Baseline for EA12: HEAD with the THEME, UXB5, MINEB, P23 and P1 merges reverted on a throwaway branch, `.next-base`. The
    branch was deleted afterwards. LT-M was kept, so this diff isolates the phase D UI work.
- **Browser.** Playwright from `web/node_modules`, Chromium on Metal (`--use-gl=angle --use-angle=metal`) at 2x.
  - Widths 390 (touch), 768, 1440 and 1760, in light and dark. Dark was set with the site's own "Switch to dark theme"
    button.
  - Storage was seeded with `copies/2` (Canadian Rockies, Dolomites, Algonquin with no date, Vermont) and one `plan-drafts/1`
    draft ("Alps loop", not built).
  - Storage blocked: `localStorage.setItem` was made to throw.
- **Checks.** axe-core on the picker, the day tables, Mine and a place page. Keyboard walks of the picker and the List |
  Table switch. Downloaded ICS files. A print PDF of the Table view. Privacy headers on `/t/`. A search of all three builds
  for the decoy home point (no hit; the only matches are SVG path numbers).
- **Shots.** 230 images in `/Users/nks/workspace/travel-wt/N2-PRV-shots/`, named by flow (`p1` picker, `p2` add-picker
  landing, `p3` Mine, `p4` copy, `p5` table, `p6` directions, `p10` flag off). Every image was read.
- **Not verified.**
  - Mine sync chips. They need an account and the `ACCOUNT_TRIPS` dist; the code path was read but not rendered.
  - Long-press and WebKit.
  - Import of the ICS files into a real calendar app.
  - The clipboard on iOS Safari.
  - Production with `planBuilder` on: the "Start a new trip with ..." rows were judged from code only.

## Findings

Severity: **must-fix** blocks the GO for that surface; **should-fix** before GO-2 or in the next round; **nice** is polish.

| # | Sev | Surface | Viewport / theme | Finding | Evidence | Proposed fix | Owner |
|---|---|---|---|---|---|---|---|
| PR-001 | must-fix | Save to a trip picker (P1) | all, both | **Trip rows are sorted by date, not by distance, and no far trip says "Far from Moraine Lake".** On Moraine Lake (Banff), the order is Vermont, Dolomites, Canadian Rockies, Algonquin, each with the same Add button and "The best day is picked next". This breaks patterns 3.9, README 5.2 and ruling C5, and repeats the prototype's must-fix M3. A family saving a Banff lake is offered Vermont first, then gets an empty answer (PR-002) | `p1-390-light-06-picker-many.png`, `p1-1440-light-06-picker-many.png`, `p1-390-light-08-park-picker.png`; `web/components/trip-picker/rows.ts` `pickRows` (Upcoming, No date, Past) | Sort by the distance from the place to the trip's nearest base, and write "Far from Moraine Lake" (muted, second line) on a trip with no base within `ADD_PIN_FAR_KM`, sorted last. The copy row holds no bases, so read them from light data, never a document (P8, P9). Either store the trip's base points (`[lon,lat][]`, under 200 B) on `copies/2` at copy time, or add one light `DataClient` call that returns base points per public slug (cached). Pin it with a test: Moraine Lake with Rockies, Dolomites and Vermont puts the Rockies first and the other two as Far | STEP2-P1 |
| PR-002 | must-fix | Picker to add picker, far trip (P1, E3) | all, both | **A far trip is a dead end.** Add on Dolomites opens `/t/<dolomites>/?edit=1&add=moraine-lake`. The sheet reads only "Moraine Lake is 4,995 mi from this trip's bases." There is no button, no way back to the place and no Save without a trip. With `planBuilder` off (production for GO-2) the "Start a new trip" row is not drawn, so the sheet has nothing to do | `p2-1440-light-dolo-landed.png`, `p2b-390-dolo-6000.png`; `PickRowView.tsx` (`r.far` with `newTrip` null draws no action) | Fix PR-001 first, so a far trip is not the first thing offered. In the far state, always offer an action: **Back to Moraine Lake** (`history.back()` or the place URL) and **Save without a trip** (the heart, with Undo), plus **Start a new trip with Moraine Lake** when `planBuilder` is on. In the picker, a "Far" row's button reads "Open trip" (to `/t/<id>/`) instead of Add, so nothing promises an add that cannot happen | STEP2-P1, STEP2-E3 |
| PR-003 | must-fix | Park: Save to a trip, then the trip's add picker (P1, E3) | all, both | **The park arrival does not finish.** On `banff-national-park` with the Rockies copy, the sheet lists 45 members:<br>- After 15 s, 44 rows still read "Working out the day". Only the first row is scored.<br>- Every row's button reads "Add to Day 1" (Kananaskis rows read "Add to Day 13"). The first row is "Day full" and still offers Day 1.<br>- "In Banff National Park" lists Kananaskis places that are not in the park: Kananaskis River, Barrier Lake, Nakiska, Ribbon Creek, Troll Falls, Smith-Dorrien.<br>- There is no search or filter over 45 rows (P1).<br>A family who taps Add puts a place on a full first day | `p2b-390-park-6s.png`; DOM dump in the run log (`p2c`); `Arrival.tsx` line 212 (`waiting={x.day !== null && !x.row.on}`) | Score every member, or score lazily as rows scroll in, with a time-out that falls back to "Pick a day" (opens Move to day). Never show "Day full" with an Add button for that day: name the best other day ("Day full · try Day 3") or offer "Pick a day". Build membership from the park's polygon or the record's `in_park` relation, not a radius from the park point. Above 12 rows, add the picker's search field and group by base | STEP2-E3 (arrival), LT data (membership) · **fixed `cf9c7e45` (PRV-PRFB)**; data gaps DG-14 |
| PR-004 | must-fix | Table view (UXB-5), public and own trip | 390, 768, 1440, 1760, print; both | **Sun-anchored times overflow the Time column and print over the stop name.** "about 19:00", "about 20:00", "about 07:16" and "After dark" are wider than the 5.25 to 5.5 rem column, so "about 19:00Vermilion Lakes Drive" collides. It happens on 11 distinct times on the Rockies trip, at every width and in the PDF. The Time column is the table's first scan line (P3) | `p5b-390-about-time.png`; `p5-print-table.pdf` p. 5; `.dt-time { white-space: nowrap }` with a fixed `.dt-c-time` width | Write a sun-anchored time the way the list does, as "≈19:00" (one character, the honesty marker kept). Or let `.dt-time` wrap at the space ("about" over "19:00") by dropping `nowrap` for that row. Add a Playwright check that no `.dt-time` has `scrollWidth > clientWidth` | UXB-5 |
| PR-005 | should-fix | EA12, flag off (P1) | build | **Flag-off place pages are not byte-identical.** 450 place pages differ from the baseline by 24 B (Johnston Canyon by 37 B). The cause is one RSC prop, `"edit":"$undefined"`, on `SaveToTrip`, serialised even with `tripEdit` off. Chunk and module-id changes were normalised out. `/trips/`, `/mine/`, home, globe and lists are unchanged in content | baseline diff (normalised build id, chunk names, module ids); `PlacePage.tsx` passes `edit={TRIP_EDIT_ON ? ... : undefined}` | Spread the prop only when on: `{...(TRIP_EDIT_ON ? { edit: {...} } : {})}`. Add the place pages to the EA12 test that already pins `/trips/` | STEP2-P1 |
| PR-006 | should-fix | Save to a trip row, a place already in the trip (P1, E3) | all, both | Moraine Lake is on Day 11 of our Rockies plan, but the picker row reads "The best day is picked next". The trip's add picker then opens "On Day 11 now. Move it to" with 14 Move buttons, Day full rows included. Saving a place that is already there turns into a move | `p1-1440-light-06-picker-many.png`, `p2-1440-light-rockies-landed.png` | The row reads "On Day 11 in this trip" from the public plan's day (the `InYourTrips` data already has it) and its button reads **Open Day 11** (`/t/<id>/?view=day#day-11`). In the arrival, a place already on the trip leads with "On Day 11 · Open Day 11" and puts Move to day behind one button, as ruling C5 does for park members | STEP2-P1, STEP2-E3 |
| PR-007 | should-fix | Picker sheet on a phone (P1) | 390, both | The title wraps to two lines ("Add Moraine Lake / to a trip"), and to three on a park, beside three icon buttons (expand, collapse, close). The park adds a lead sentence. At the half snap, only one or two rows show, and **Save without a trip** is below the fold | `p1-390-light-04-picker-1copy.png`, `p1-390-light-08-park-picker.png` | Title "Add to a trip", with the place name as the kicker above it. Drop the park lead sentence: each row already says "Choose the places next". Open at the full snap when there are three or more rows. Drop the collapse button: the grabber and the expand button are enough | STEP2-P1 |
| PR-008 | should-fix | Copy landing and Save-to-a-trip landing (P3, P1) | all, both | The copy lands on `/t/<id>/?edit=1&view=day`, but the screen shows the cover at the top. The Days panel and the **Make it yours** card (patterns 3.7, "opens ... on Days with the Make it yours card above Day 1") are below the fold. The Save-to-a-trip arrival leaves the page on Summary behind the sheet (spec 3.9: "on its best-fitting day") | `p4-390-light-04-landed-settled.png`, `p4-1440-dark-04-landed-settled.png`, `p2-1440-light-rockies-landed.png` | After the first paint, scroll so the tab bar sits at its sticky line (patterns 3.10 item 4), with Make it yours in view. On `add=`, switch to Days and scroll the target day into view when the person picks a day (P5: context kept) | STEP2-P3, STEP2-E3 |
| PR-009 | should-fix | Undated copy, words (P3, P2) | all | Four words for one state:<br>- the cover: "Dates not set yet"<br>- the stat: "Not set yet"<br>- Mine: "No date"<br>- the copy sheet: "No date yet"<br>README 5 is "one name per thing" | `p4-390-light-04-landed-settled.png`, `p3-390-light-01b-mine-full.png` | Use **No date yet** on the cover line and the Starts stat. Keep Mine's group head "No date" (a group label). Add the word to README 5.1 | STEP2-T1 (cover), README 5 |
| PR-010 | should-fix | Mine draft row (P2) | all, flag on without `planBuilder`, and flag off | The draft row ("Alps loop", "Draft · ready to build") links, and its menu's **Continue** goes, to `/plan/?draft=...&s=4`. That route is a 404 when `planBuilder` is off, which is production at GO-2. A device that ever held a draft (a preview, or a flag turned off) shows a row that leads nowhere | `p3-*-04-rowmenu-draft.png`; `curl /plan/?draft=x&s=4` returns 404 on the flag-on build | With `PLAN_BUILDER_ON` false, draw an unbuilt draft as not a link, with the chip "Draft · the planner is not open yet" and a menu of **Remove** only. Keep built drafts (`/t/<id>/`) as they are | STEP2-P2 |
| PR-011 | should-fix | Mine row menu: Add to calendar (P2) | all | Mine's **Add to calendar** and the trip page's **Add to calendar** give different files for the same copy:<br>- from Mine: 15 all-day events with no LOCATION, built from our public plan (`loadExport('trip', slug)`), so a copy's own edits and LT-M's LOCATION and GEO are missing<br>- from the cover: 88 timed events, 30 with LOCATION and GEO<br>One label, two files, and the person's edits are lost from one of them | downloaded ICS from both (`p11`) | Route Mine's Add to calendar through the same builder as the cover: a lazy import that reads the copy's document on the device. Or do as Print does: open `/t/<id>/` and arm the calendar | STEP2-P2 · **fixed `152ead2a` (PRV-PRFB)** |
| PR-012 | should-fix | LT-M exports: print and ICS | print, ICS | On the flagship Rockies trip, no stop gets an address line in print or an address in ICS LOCATION. LOCATION falls back to the stop name. Every LT-1 address sits on an access point (`#parking`, `#toe-parking`); the exports read only the place's own address. The Directions card uses the drive target's address, so page and exports disagree | own-trip print view text and ICS (`p7b`): `LOCATION with comma count 0`, "print view has address? false" | Use the same rule in the exports as on the card: the address of the drive access point the card goes to, else the place's own (`PageModel.address`). Name whose it is ("Lake Louise Lakeshore parking, Lake Louise Drive ...") | LT-M · **fixed `a53dd55f` (PRV-PRFB)**; data gaps DG-15 |
| PR-013 | should-fix | LT-M Copy address, and LT-1 data | all | The address is a nearest road plus an administrative area: "Near Lake Louise Drive, Improvement District No. 9". **Copy** drops "Near" and copies "Lake Louise Drive, Improvement District No. 9". A navigation app reads that as a street address, and "Improvement District No. 12" is not a place name a family or a sat-nav uses. The card is honest; the copied text is not (T5) | `p6-1440-dark-lake-louise-dir.png`; clipboard read in the run log | Copy the target's name, the road and the nearest named settlement and postcode: "Lake Louise Lakeshore parking, Lake Louise Drive, Lake Louise AB T0L 1E0". For a `nearest_road` address, keep "near". In LT-1 data, replace the locality "Improvement District No. N" or "Area A (...)" with the nearest named settlement (research method change) | LT-M (copy text), LT research (data) · **copy text fixed `a53dd55f` (PRV-PRFB)**; locality names stay with LT research |
| PR-014 | should-fix | Directions card buttons (LT-M) | all | **Copy address** is 30 px tall, under the 44 px target. The map buttons (Google, Apple, and the new OpenStreetMap and Official map) are 38 px | `getBoundingClientRect` in the run log | `min-height: var(--touch-min)` on `.pl-addr-copy` and `.pl-dir-links .btn` (or a 44 px hit area with `::after`) | LT-M |
| PR-015 | should-fix | Table view, desktop (UXB-5) | 1440, 1760, both | Beside the map column, the table is 470 to 680 px wide for six columns. Where and Notes wrap to 4 to 8 lines, and a drive's Where reads "from Bear spray and groceries in Banff". At 1760 the table does not grow (678 px) | `p5-1440-dark-02-public-table-scrolled.png`; measured table width 678 px at 1440 and 1760 | In Table, let the tables take the full content width and put the map behind the Map button, as on phones: a table is for scanning, and the map column does not follow table rows. Or, at table widths under 900 px, fold Kind into What. For legs, leave Where empty and keep "from X" in the What fold | UXB-5 |
| PR-016 | should-fix | Table view, Where column (UXB-5) | all, print | The Where column shows the day's base, not the stop's area. Bow Lake and Peyto Lake on Day 4 read "Jasper townsite"; Johnston Canyon on Day 3 reads "Lake Louise village". The column says where a stop is, and it is wrong for road-trip days | `p5-print-table.pdf` pp. 6 to 7 | Use the place's own area (`areas[placeSlug]`, which falls back to the base now) and put the base in the caption ("base Jasper townsite"). If the area is not known, leave the cell empty | UXB-5 |
| PR-017 | should-fix | Picker focus, desktop side sheet (P1) | 768, 1440, both | Tab from **Save without a trip** goes to a `SPAN` and then to `BODY`, out of the dialog, though the sheet is `modal="trap-focus"`. Esc does return focus to Save to a trip (correct) | keyboard walk: `H2 > Close > Add (Dolomites) > Add (Rockies) > Save without a trip > SPAN > BODY` | Wrap focus at the sheet's end, as the copy sheet does (the shared `SideSheet` focus guard), and add a keyboard test to `save-to-trip.spec.ts` | STEP2-P1 (or the `SideSheet` owner) |
| PR-018 | should-fix | /t/ cover kicker over a bright photo | 390, light and dark | The kicker "Your copy · from our Canadian Rockies, 14 nights trip" sits on the sky at about 2.4 to 2.75:1. The public cover's kicker on the same photo is about 2.35:1, so the cause is shared and existing, but the /t/ kicker carries new words a person must read | pixel sample: text #E9ECF0 on the sky median #6A92BB is 2.75:1 (`p4-390-light-04`); the public cover is 2.35:1 | Strengthen the cover scrim at the top on phones (a gradient of `--scrim` from the top 40%), or set the kicker on a `--scrim` pill. The target is 4.5:1 | STEP2-T1 (cover) |
| PR-019 | nice | "In your copy of" line (P1) | all | With no day held, the line reads "In your copy of Canadian Rockies · ≈ your copy may differ". It names no day, though our plan has Moraine Lake on Day 11 | `p1-390-light-05-place-top-many-inline.png` | "In your copy of Canadian Rockies · Day 11 in our plan". Keep "≈" | STEP2-P1 |
| PR-020 | nice | Picker, damaged store (P1) | all | A `copies` envelope that does not read shows "No trips yet" with Browse trips. Mine shows its error state for the same data | first run of `p1` with a `copies/1` envelope holding an undated copy | "We could not read your trips · Open Mine", the same words as Mine | STEP2-P1 |
| PR-021 | nice | Picker scrim (P1) | 768, 1440 | The side sheet has no scrim, so the place page behind looks live while focus is trapped (or meant to be, PR-017) | `p1-768-light-06-picker-many.png` | A light `--scrim` under 1024 px, matching the copy sheet | STEP2-P1 |
| PR-022 | nice | Mine row menu icons (P2) | all | **Edit** and **Change dates** use the same pencil | `p3-1440-dark-02-rowmenu.png` | Use the calendar icon for Change dates and the pencil for Edit; Add to calendar keeps its icon with a plus | STEP2-P2 |
| PR-023 | nice | Mine rows, accessible name (P2) | all | axe `label-content-name-mismatch` on 3 rows. The link's `aria-label` rewrites the visible text ("·" becomes ","), which voice control users cannot match | axe run in the log | Drop the `aria-label` and add the state words in a visually hidden span, so the visible text starts the name | STEP2-P2 |
| PR-024 | nice | Mine group heads (P2) | 1440 compared with 390 and 768 | The count sits inline at 1440 ("UPCOMING · 2") and right-aligned at 390 and 768 | `p3-1440-dark-02-rowmenu.png`, `p3-768-light-01-mine.png` | One rule at every width (right-aligned, as on phones) | STEP2-P2 |
| PR-025 | nice | Table semantics (UXB-5) | all | Each row's header cell is the time. A screen reader announces "~14:20" before every cell; the stop name is the better row header. Captions "DAY 01" pad with a zero where the vocabulary says "Day 1" | axe: no violations; markup read | Make the What cell `th scope="row"` and the time a `td`. Caption "Day 1 ·" (the sign style can stay visual) | UXB-5 |
| PR-026 | nice | Place page, phone order (existing) | 390 | The Directions card, now with the address, is the last card on a phone, after Links and Facts and sources. P6 wants the way in near the top | `p6-390-light-upper-elk-lake-dir.png` | Move Directions after the map card on phones (patterns 3.11 item 4) | Places template · **fixed `a53dd55f` (PRV-PRFB)** |

## Fixes: PRV-PRFB (29 Oct 2026, Claude Opus 5.5)

Branch `prv/PRFB` from `main` 529e84e8. Shots in `/Users/nks/workspace/travel-wt/PRV-PRFB-shots/` (park flow, Directions card,
print; 390 and 1440, light, 2x).

- **PR-003, `cf9c7e45`.**
  - Cause of the 44 waiting rows: the fit effect restarted on every render, because the park's centre was a new object
    each render and re-made the rows. Only row 1 was ever scored.
  - Members are now the park's named area (`add/members.ts`), read by one bounded search of light rows. There is no radius.
    No Kananaskis, Canmore or Kootenay place is a Banff member, and Moraine Lake and Bow Lake now are.
  - The rows on show are scored in idle-time batches (`add/stage.ts`): 12 a page with Show more, a search field above 12,
    grouped by the base of the nearest day.
  - Each row names its best day ("Add to Day 3"; "Day 1 full: try Day 3"), or offers **Pick a day**: that place's day list,
    with Back. Pick a day shows when every near day is full or the score takes longer than 4 s.
  - Tests: `park-arrival.test.ts` and e2e `t-park-arrival` (the first 12 rows resolve within 2 s; none waits after 5 s).
- **PR-011, `152ead2a`.**
  - One builder, `lib/export/ownCalendar.ts`. Mine (flag on) hands off as Print does and opens the copy; the copy's page
    makes the file.
  - The hand-off waits until the page's timelines are the person's (`pending` false).
  - e2e `t-own-calendar`: Mine's file and the cover's have the same UIDs and the same events.
- **PR-012, `a53dd55f`.**
  - `ownModel` dropped the address. It now keeps the Directions target's address, named in files: "Lake Louise Lakeshore
    parking, near Lake Louise Drive, Improvement District No. 9".
  - This reaches the print line, the CSV and ICS LOCATION.
  - On the Rockies trip only Lake Louise (Day 10 C), Wedge Pond (Days 14 and 15 C) and Maligne Lake have such a target.
    The rest is data: DG-15.
- **PR-013, `a53dd55f`.**
  - Copy now copies the line as shown, "Near" kept, and the target's point on a second line. The button reads "Copy
    address and point".
  - Replacing "Improvement District No. N" with a settlement name stays with LT research.
- **PR-026, `a53dd55f`.** Directions follows the map card on phones, by CSS only (no markup change).
- **Data gaps for DATA-PLAN 2.4.1** (LT-2 writes `data/capture`; nothing was edited there):
  - **DG-14, park membership.** Kananaskis Country misses 24 of its 36 capture members. Their light rows read Peter
    Lougheed, Spray Valley, Canmore Area, Elbow-Sheep or Mount Assiniboine.
  - Also in DG-14: 9 rows are members by name with no capture `area_id`, and 3 Kicking Horse River rows conflict with their
    records.
  - The lasting fix is a light `parks` field on the list row from the graph: an API contract change for Opus.
  - **DG-15, access points not linked to the stops beside them.** Examples: `yoho-valley#takakkaw-falls-parking` for
    takakkaw-falls, `mount-kerkeslin#athabasca-falls-parking` for athabasca-falls, `highwood-pass#highwood-meadows`,
    `mount-lawrence-grassi#grassi-lakes-parking`, `upper-kananaskis-lake#north-interlakes`, `ashlar-ridge#miette-parking`.
  - Also in DG-15: `maligne-lake-cruise` has no place slug.
- **Left open.**
  - The arrival groups by the base of the nearest day, so Moraine Lake Rockpile shows under "Near Jasper townsite": Day 4
    passes it on the way to Jasper.
  - Pick a day on a place whose near days are all full lists every day as "Day full". The engine finds no room on any day
    (ER-004 keeps Add live).

## What works (verified)

- **Save to a trip with no trips:** "No trips yet" with Browse trips. **Save without a trip** sets the heart and its toast.
  Esc returns focus to the button. The "In your copy" line reads only the device. No trip document, `/t/` or plan-model
  request was seen while browsing.
- **Mine:** one list, four rows once each. Upcoming, then No date. The menu reads Open · Edit · Add to calendar · Print ·
  Change dates · Remove. An undated copy reads "Calendar: add dates first" (disabled) and "Add dates". **Print** lands on the
  copy and prints. The empty state's words are right with `planBuilder` off. The identity rings are right in both themes.
- **Copy to my trips:**
  - No date is allowed.
  - The copy lands on `/t/<id>/?edit=1&view=day` with the toast "Copied Canadian Rockies to My trips · Undo". Undo empties
    the store and returns to `/trips/canadian-rockies-2029/`.
  - A second copy asks "You already have a copy from ... Replace · Cancel".
  - Storage blocked keeps the done step with the right sentence.
  - "You have a copy of this trip · Open it" shows at every width, at 13.5:1 on the scrim at 390.
- **Flag off:** the place page keeps its note, with no "In your copy" line. Mine rows open the public trip with the codec.
  There is no "You have a copy" line.
- **`/t/` privacy:** `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: same-origin`, `Cache-Control: private, no-store`.
  The decoy home point appears in no build. Addresses on pages and in exports are public road and car-park addresses only;
  nothing household-related.
- **Table view:**
  - One `<table>` per day with a `<caption>`: 15 tables and 15 captions on the Rockies, 90 `th scope="col"`.
  - The List | Table switch is a radio group. ArrowRight switches and keeps focus.
  - Stops only writes `rows=stops`.
  - The edit-mode line "Editing works in List · Switch to List" shows.
  - Print keeps six columns, repeats the head and keeps a day on one page.
  - No axe violations on the tables.
- **Dark theme on `/t/`:** stays dark after a full load and after Copy's client navigation.

## Budgets and EA12

| Measure | Baseline (UI merges reverted, flag off) | HEAD flag off | HEAD flag on | Limit |
|---|---|---|---|---|
| Heaviest start JS (any page; a trip page) | 193.2 KB | 195.2 KB | 196.6 KB | 200 KB |
| Place size S13, median and largest | 1.2049 | 1.2050 | 1.2055 | 1.25 |
| Shell chrome, largest | 3223 B | 3223 B | 3226 B | 5028 B |
| Rockies Days, start plus lazy within 1 s | 620.6 KB | 625.8 KB | 633.1 KB | (reported) |

- **`/trips/<slug>/` HTML:** unchanged in content against the baseline, flag off (only build ids and chunk names differ).
  With the flag on, start JS is 1.4 KB above flag off (the "You have a copy" loader and the Save-to-a-trip branch), the same
  margin ERV recorded. Headroom with the flag on is 3.4 KB.
- **Place pages, flag off:** see PR-005.
- **OSM button pages:** the OpenStreetMap map button is drawn on **75** place pages today, not 39: 39 at LT-M and the rest
  from LT-1's data. This is expected, but the "known 39" number in the brief is out of date.
- **`/mine/`:** under the 200 KB start line. It is not the heaviest page.
- **`/t/`:** it is dynamic, so `budget:report` does not measure it. It was not re-measured by the report's method here.

## Contrast of the pairs approved

All from `web/app/themes.css`, WCAG 2 ratios.

| Pair | Light | Dark |
|---|---|---|
| `--ink` on `--surface` (picker names, Mine names, table text) | 21.00 | 13.83 |
| `--ink-2` on `--surface` (picker and Mine meta lines, table Where and Notes) | 12.09 | 10.76 |
| `--muted` on `--surface` ("The best day is picked next", table legs, Takes second line) | 6.94 | 7.45 |
| `--muted` on `--well` (table column heads) | 6.02 | 8.58 |
| `--accent-text` on `--surface` ("In your copy of" link) | 6.33 | 7.99 |
| `--warn` on `--surface` (table warnings, "Day full") | 6.92 | 8.31 |
| `--crit` on `--surface` (Mine Remove) | 6.61 | 7.01 |
| `--accent-ink` on `--accent` (filled buttons, selected segments) | 6.96 | 6.96 |
| `--ink` on `--surface-2` (the edit-mode table line) | 17.86 | 12.24 |
| Cover ink on the cover scrim ("You have a copy", 390) | 13.5 (sampled) | above that (darker scrim) |

Not approved: the cover kicker over a bright sky, about 2.4 to 2.75:1 (PR-018).

## Principles

- **P1:** PR-003 (45 unfiltered rows) and PR-001 (no ranking). Mine and the tables scale.
- **P3:** the Table's Time column (PR-004); Mine's one list.
- **P4:** the picker's words read without help, but a far trip offers an action that cannot happen (PR-002).
- **P5:** the landings keep the URL but not the place on the page (PR-008).
- **P6:** the address sits where the drive starts (good), but not in the exports (PR-012).
- **P7:** Save to a trip is the place's primary action and its flow does not yet finish (PR-001 to PR-003).
- **P8 and P9:** no document read for the picker or the line. Mine's calendar reads a public export, not the person's
  document (PR-011).
- **T5:** the copied address text overstates precision (PR-013).

## Hand-off

Owners in the table. A re-review of P1 should re-shoot `p1`, `p2` and `p2b` at 390 and 1440 in both themes, with a
Moraine Lake device holding the Rockies, Dolomites and Vermont copies, and a park arrival on the Rockies copy.
