# Edit mode on the trip details page

Status: **spec, docs only** (27 Oct 2026, travel-planner, Opus, STEP2-PLAN). Master plan: [README.md](README.md); words:
README section 5 (vocabulary); gaps and files: [gap-analysis.md](gap-analysis.md); tasks: [build-plan.md](build-plan.md).
Principles cited by number from [foundation/principles.md](../foundation/principles.md). Folds and supersedes
[edit-my-trip.md](../../features/edit-my-trip.md) 5, [FLOW.md](../trip-builder/FLOW.md) 7.1 and stage 5 to 8 screens, the
brainstorm Q1 to Q8 ([BRAINSTORM-edit-trip.md](../../prototypes/BRAINSTORM-edit-trip.md)), and
[trip-overview-and-customisation.md](../../features/trip-overview-and-customisation.md) 5.

Owner answers used (27 Oct 2026): Q-BE1, Q-BE3, Q-BE4, Q-BE5, Q-BE6 yes. **Assumed** (recommendation, not yet answered):
Q-BE2 (versions until conversion, then flatten), Q-BE7 (the template-mode table of section 13), Q-BE8 (quiet sync). Each
assumed rule is marked **[assumed Q-BE2]** and so on where it applies; owner question OQ3 asks to confirm all three.

## 0. The decision in one paragraph

Edit mode is a mode of the trip details page at `/t/<id>/`, the same page the person reads. **Edit trip** turns it on
(`?edit=1`, `pushState`), **Done** turns it off; every change is already saved on the device and, signed in, synced. In
edit mode every stop on every day can be removed, moved to another day, moved up or down, and dragged; every day can take
more places from one picker, be added after another day, dropped, reset or given a note; the trip's title, dates, who is
going and pace change from one Settings sheet. Each change is one operation with an inverse on `plan-draft/1`, so Undo and
Redo walk 50 steps that survive a reload. A copy of one of our trips keeps following our plan while the person's changes
keep its shape (template mode); the first change that needs the engine (where you start, driving, bases, a rebuild) asks
once and converts it into the person's own trip, keeping every stop as "From our trip". A builder plan is the same page in
built mode from its first build. Warnings come in two levels and never block. **Trade-off:** there are two modes per action
to build and test (template and built, section 13); in exchange one page, one menu and one set of words serve every trip.

## 1. Same in read mode and edit mode

Nothing moves when the mode changes (P5). Edit mode only adds controls.

| Element | Read mode | Edit mode adds |
|---|---|---|
| Cover | photo, kicker, title, chips, actions | the title becomes editable inline (foundation patterns 4.3); Edit trip becomes Done |
| Party bar | "Planned for 2 adults · 1 child (6) · Standard pace · Edit" | nothing (it is already editable; it writes `setParty`) |
| Tabs | Summary · Days · Stops · Bookings · Photos, same rules (patterns 3.10) | nothing; the current tab stays |
| Day cards, timeline entries, legs, sun rows, Know before you go | as on `/trips/` | a handle and a `⋯` on each entry; a `⋯` on each day header; the "Add a place to Day n" row on every day |
| Marks ("Added by you", "Moved from Day 3", "From our trip", "Kept on Day 4") | shown | shown |
| Changes line "4 changes from our plan · Show" (copies) | shown above Day 1 and in the Summary | the same, with Restore rows |
| Warnings | Fix level at rest on the day header and counted in the sticky row; Check level on the day header | the same, plus each warning's fix button |
| Map | the map column (desktop) or sheet (phone), the day in view | the same; a drag lifts the stop's pin |
| Stops tab | the six category chips and rows | row actions: Add to Day n, Move to day…, Remove from the trip |
| Bookings, Photos | read | read (bookings follow their stop) |
| Table view (UXB-5) | read | read; the Days segment switches to List with "Editing works in List" |
| Print, Export, Add to calendar, Share | available | available (the trip `⋯` and the cover) |

## 2. Entry points

| # | From | URL it lands on | What the person sees first | Focus |
|---|---|---|---|---|
| 2.1 | Builder stage 4, **Build my days** | `/t/<id>/?edit=1&built=1` (`history.replaceState`, so Back leaves the builder's stage 4 and returns to where the builder was opened, FLOW L9) | edit mode on Days; above Day 1 the just-built status line "Built 10 days · 1 did not fit · 1 warning" (announced once), Bases "2 bases · Ortisei 5 nights, Cortina 4 · Change" and Checks "1 h 25 driving a day ≈ · 1 move · Book ahead 3 · Known costs: 5 of 9 priced" collapsed to one line each; Day 1 open; `built=1` is removed from the URL after the first paint | the status line |
| 2.2 | Public trip, **Copy to my trips** | `/t/<id>/?edit=1` | edit mode on Days, the **Make it yours** card inline above Day 1 (components 9.11): "Change places · Your driving and pace · Where you start", dismissed by **Keep it as it is**; toast "Copied Canadian Rockies to My trips · Undo" (Undo removes the copy and returns to `/trips/<slug>/`) | the card's heading |
| 2.3 | Mine › My trips row | `/t/<id>/?view=day` | read mode on Days | the Days heading |
| 2.3b | Mine row menu **Edit** | `/t/<id>/?edit=1&view=day` | edit mode on Days | the first day heading |
| 2.4 | Place or park page, **Save to a trip** › a trip | `/t/<id>/?edit=1&add=<place-slug>` | edit mode; the add picker open with that place chosen and the days listed by fit (7.4) | the picker's first fitting day |
| 2.5 | Public trip, "You have a copy of this trip · Open it" | `/t/<id>/` | read mode, Summary | the cover title |
| 2.6 | A `mine=` link on `/trips/` (EM-B's Open, bookmarks) | redirects to `/t/<id>/` when the id is on this device or in this account; otherwise the public page with "This copy is not on this device or in your account. · Open Mine" | as 2.3 | |
| 2.7 | A `/t/<id>/` link on another device or account | the not-found state (15): no existence signal | | |

**First build lands in edit mode** (2.1) because the builder's promise is "take it as a base and edit it" (FLOW M1); a trip
reopened later from Mine opens in read mode (2.3), because the 90% reopen is to read and use it (P7).

## 3. The mode switch

| Concern | Rule |
|---|---|
| URL | `edit=1` added with `pushState`; Back returns to read mode at the same tab, day and scroll (P5). Edit mode is never the only way to a fact: everything in edit mode is readable in read mode |
| Loading | the edit chunk (`web/components/trips/edit/**`) loads on the first **Edit trip** press or when `edit=1` is in the URL; hovering or focusing Edit trip prefetches it. While it loads, the button shows a 14 px spinner and the page stays as it is |
| Desktop chrome | the sticky row (plan bar on Days) shows, at its right: **Undo**, **Redo** (icon buttons, 38 px, hit 44, disabled when the stack is empty), the changes count for copies ("4 changes"), **Settings**, **Done** (the only filled button). The cover's Edit trip becomes a secondary **Done** (outlined, never filled) so the page never shows two filled buttons (README ruling C1). The cover title keeps its display size and box: the title is the input itself, with a dashed underline and a pencil, Enter saves, Esc reverts (P5, patterns 4.3) |
| Phone chrome | the public bottom bar is replaced by the **edit bar**: Settings (left) · Done (right, filled; the cover's Done is secondary there too); the "n to fix" count is a button on its own line under the tabs that jumps to the first Fix warning, never inside the tab row; Undo and Redo live in the toast and in the cover's `⋯` (FLOW TF18). The edit bar sits above the safe area; the back-to-top button hides while it shows |
| Done | turns edit mode off (`pushState` removes `edit=1`), keeps the day and scroll, toast none (nothing to confirm: every edit is saved). If an op is still in the outbox the sync word says "Syncing" or "Not synced yet"; Done never waits |
| Keyboard | `E` toggles edit mode when focus is on the page and not in a field (listed under `?`, turned off with the single-letter keys setting, WCAG 2.1.4) |
| Screen reader | the cover region announces "Editing Canadian Rockies" (polite) on entry and "Done editing" on exit |
| Signed out | identical (EM8); the Settings sheet foot reads "Kept in this browser. Sign in to keep it on every device." |
| Not editable | a newer document, a paused builder (`PLAN_BUILDER_PAUSED` for built drafts), or a trip removed on another device: Edit trip is disabled with its reason as the button's description (15) |

## 4. The stop row

The timeline entry of components 4.3 (handle 24 · time 50 · glyph 26 · content · photo 96 x 68). R59-1's visible actions
(Map: <name>, Directions, AllTrails) sit in the content column's action line in both modes. Edit mode fills two slots:

| Slot | Read mode | Edit mode |
|---|---|---|
| Leading (24 px desktop, 28 x 44 phone) | empty (the time rail starts at the left edge as today) | the six-dot handle (components 8.1), `--muted`, `--ink` on hover |
| Trailing (44 x 44) | empty | the `⋯` button, accessible name "Actions for Seceda, Day 3" |
| Mark line (under the title) | the stop's marks as neutral chips (2.8) with words | the same |

### 4.1 Marks

| Mark | When | Mode |
|---|---|---|
| Added by you | an `addPlace` or `addPick` entry | both |
| Moved from Day 3 | a published stop moved to another day | template |
| Moved by you | a stop the person moved inside or across days | built |
| From our trip | a stop that came from our plan when a copy converted | built (converted) |
| Kept on Day 4 | the Keep on Day n switch is on (lock or placed) | built |
| Version C | the day uses a version other than the one chosen for the party (shown on the day header, not the entry) | template |
| Changed on another device | the row changed in a sync refresh; static for 6 s, then gone | both |

At most two marks on an entry; a third goes into the `⋯` sheet's header line. Marks are text, never colour alone (P6).

## 5. Per-stop actions

Every action is reachable by a visible button; drag is only an accelerator (WCAG 2.5.7). The template and built operation
columns are the test matrix (section 13).

| Action | Phone | Desktop | Keyboard (focus on the entry) | Template op | Built op | Re-flow | Feedback |
|---|---|---|---|---|---|---|---|
| Move to another day | item sheet **first row** "Move to day…": a list of days, each with base, free time, the driving change and a Fits or Tight chip | menu "Move to day…" (same list as a popover), or drag onto another day in the day list or the day rail | `M`, then the day number and Enter; or lift (Space or Enter), PageUp or PageDown, drop | `moveItem` (to `toDay`, at the end, or after a chosen stop) | `moveItem` (built), marks Moved by you, Keep on Day n on | both days, on the device | toast "Moved Seceda to Day 4 · kept there · Undo"; live region "Moved Seceda to Day 4, position 3 of 5" |
| Move up, Move down | item sheet second row: two 44 px buttons Up, Down | menu items; drag within the day | Alt+Up, Alt+Down; or lift, arrows, drop | `moveItem` (same day, `after`) | `moveItem` | that day | toast "Moved Seceda up · Undo"; live region with the position |
| Remove | item sheet "Remove from Day 5" (`--crit` text, no confirm, foundation 4.4) | menu item | Delete or Backspace | `removePlace` (a published stop by `day` and `item`; an added place by its op id) | `removePick` | that day | the entry collapses (200 ms, a jump under reduced motion); toast "Removed Moraine Lake from Day 5 · Undo"; focus to the next entry, else the day's add row. The removed stop is offered again in that day's add picker (7.2 group "Removed from this day") |
| Swap with… | item sheet "Swap with…" lists the other stops of the trip | menu "Swap with…"; Shift-drag onto the other stop | `S` | two `moveItem` as one undo step **[assumed Q-BE7]** | `swapItems` | both days | toast "Swapped Seceda and Lago di Braies · Undo"; both marked |
| Swap for a nearby place | item sheet "Swap for a nearby place": the stop's near rows (fit, month and the Rainy day chip applied) | menu item | menu | `removePlace` plus `addPlace` as **one** undo step | `replacePick` | that day; ≈ until rebuilt (built) | toast "Swapped Seceda for Col Raiser · Undo" |
| Add to Maybe | item sheet "Add to Maybe" | menu item | menu | `removePlace` plus `addMaybe` as one step | not offered (a built stop removed goes to Did not fit only if the engine drops it; a person's removal is just removed) | that day | toast "Moved Opal Hills to Maybe · Undo"; Maybe (n) in the Summary and the add picker |
| Keep on Day n (switch) | item sheet switch with its reason line ("On because you placed it. Turn off to let the plan move it.", TB-N2R R1) | menu switch; the lock icon in the row | `L` | hidden (nothing re-flows across days in template mode) **[assumed Q-BE7]** | on: `lock`; off: `release` | none | chip "Kept on Day 4" appears or goes |
| Must see (switch) | item sheet | menu; star | Shift+M | hidden **[assumed Q-BE7]** | `setMust` | none | chip |
| Add a note | item sheet "Add a note" | inline under the title (foundation 4.3: serif 17 field, Enter saves, Esc reverts) | Enter on "Add a note" | `setNote` with key `<day>:<item>` | `setNote` (built, top-level `notes`) | none | none; the note shows under the title |
| Open place page | item sheet last row | the title link (unchanged) | Enter on the title | | | | |

**Any stop can be removed**: published stops, added places, stops from our trip, engine-placed stops. A booking attached
to a removed stop is named in the toast ("Removed Spirit Island cruise and its booking slot · Undo"); the booking row
leaves the Bookings tab with it and comes back on Undo (trip-overview 5.4).

### 5.1 Move to day sheet

| Row part | Content |
|---|---|
| Day | "Day 4 · Thu 1 Jul" (dated) or "Day 4" |
| Base | "Base: Jasper" |
| Free time | "2 h 10 free" from the day's timeline |
| Driving change | "+35 min driving ≈" from the drive model (`modelDrive` for a template copy; the re-flow chunk for built) |
| Fit chip | **Fits** or **Tight** (Tight: the day would raise a Check-level warning); a day that would raise a Fix-level warning says why ("Closed on Thursdays") and stays choosable (never block, Q-BE6) |
| Current day | in day order like the others, disabled, "Now on Day 3" (README ruling C3: listing it first breaks the order a reader scans by) |

Inserted days are listed with their label ("Day 6 (added)"). The sheet has at most `PLAN_DOC_LIMITS.templateDays` rows; a
long trip scrolls inside the sheet.

### 5.2 Drag

| Concern | Desktop | Phone |
|---|---|---|
| Start | press on the handle and move 4 px, or press anywhere on the row and move 8 px | **long-press on the handle only**, `TRIP_EDIT_UI.longPressMs`, with haptic where supported; a press on the row body scrolls the page as normal (Q-BE3) |
| Where it can drop | any position in any day of the Days list; onto a day cell of the day rail (moves to the end of that day; hovering a day cell 400 ms scrolls to that day) | **within the open day only**; to another day use Move to day… (no cross-day drag on a phone, Q-BE3, ruling R4) |
| Feedback | ghost at scale 1.02, origin at 32%, insertion line with the pill "to Day 3 · before 11:30 · +42 min driving ≈" (components 8.1) | the same ghost and line; autoscroll at the top and bottom 64 px of the viewport |
| Drop | spring settle, legs and totals count for 300 ms, toast with Undo | the same |
| Cancel | Esc, or dropping where it started | releasing over the starting place |
| Reduced motion | no lift scale or settle; the line and pill only | the same |

### 5.3 Keyboard model

Space or Enter lifts the focused entry and drops it; arrows move it within the day; PageUp and PageDown move it to the
previous or next day; Home and End to the top or bottom of the day; Esc cancels and returns it (ruling R5). Every step is
announced in a polite live region: "Seceda, Day 3, position 2 of 4". Alt+Up and Alt+Down move without lifting.
Single-letter keys (`M`, `S`, `L`, `A`, `E`, `?`) work only while focus is on an entry or the day list, never in a field,
and turn off with one setting in the `?` list (FLOW 7.1, WCAG 2.1.4).

### 5.4 Rows the rules made (STEP2-E1B)

Every row of a day can be removed, not only stops: the start of the day ("Land and head out"), Collect the hire car,
check-in and check-out, meals (lunch, picnic lunch, the packed lunch on the trail, dinner), rests and free time, coffee and
stretch breaks, a booking's check-in slot, and the end of the day ("Back at Banff"). Legs are connectors, not rows (design
4.3), and the sun rows are facts, so neither has a `⋯`; a leg re-flows with the rows around it.

| Concern | Rule |
|---|---|
| Menu | the same `⋯` and item sheet; Move to day, Move up and Move down, Add to Maybe and Open place page apply only to stops, so a rule row offers **Add a note** and **Remove from Day n** |
| What removing does | the row leaves the day and takes no time, so the rows after it re-flow (removing the hire car starts the drive to Banff an hour earlier). A rest or free time is a wait for a set time (a slot, an opening, the dinner window): its row goes and the wait stays as a gap. Removing the end of the day also removes the drive to it after the day's last stop ("the drive back") |
| Never blocks (foundation 4.4) | when the day still relies on the row, one line in the item sheet says what stays, above Remove and as its description: hire car "The drive to Banff stays; nothing meets the car."; check-in "You still sleep in Banff; nothing checks you in."; the end "The drive back to Banff goes; the day ends after Elk rut viewing." No dialog |
| Feedback | toast "Removed Picnic lunch from Day 1 · Undo"; the end is named by its drive ("Removed the drive back to Banff from Day 1"); Undo, the changes sheet's **Put it back** (toast "Restored Collect the hire car on Day 1") and Reset to our plan restore it |
| Stays removed | the row is kept as a **rule key**: its lane, kind and sub, and for a row that precedes a stop (a rest, a break, a slot) that stop's id; one-a-day rows (start, hire car, check-in, check-out, each meal, the end) have no anchor. So it stays removed when other edits re-flow the day, and a row that precedes a stop moved in later is hidden too |
| Copies only | built trips get it with STEP2-B2 (built ops); an inserted day (E4) has no published day number to key it on yet |

**Schema note (no change, no migration).** A removed rule row is an ordinary `template.removed` entry whose `item` is
`rule:` and the rule key: `{ "op": "o-…", "day": 1, "item": "rule:all-car-hire" }`. `planScheduleId` already admits it, so
`plan-draft/1`, the operations (`removePlace`, `deleteEntry`, `restoreEntry`, `reset`), the device sidecar
`travel.trip-edit.device` and the account sync carry it unchanged. A stop note on such a row uses the existing
`<day>:<item>` key (`1:rule:all-meal-lunch`). An older reader that does not know the prefix treats it as a published stop
not on the day and changes nothing. Scheduler side: `core/src/schedule/ruleRows.ts` (`ruleKeyOf`, `rowsOfKeys`),
`DayEdit.hidden` (rule keys) and `ScheduleOptions.hidden` (entry ids, resolved by `template.ts`).

## 6. Day-level actions

| Action | Where | Template op | Built op | Rule | Feedback |
|---|---|---|---|---|---|
| Add a place to Day n | the add row at the end of every day (exists as `AddToDay.tsx`) | `addPlace` | `addPick` with `day` | section 7 | toast with Undo |
| Add a day after Day n | day `⋯` | `insertDay` (`after`) | `insertDay` | the new day is empty with the base of the day before; capped by `PLAN_DOC_LIMITS.dayOps` | toast "Added Day 6 · Undo"; the new day opens with its add row focused |
| Drop Day n | day `⋯` | `dropDay` | `dropDay` | stops on it: the sheet asks "Drop Day 7 · its 2 stops move to Day 6 / go to Maybe / are removed", default move to the day before; a booking on it: confirm "Drop Day 7 and its canoe booking?" (the only confirm, foundation 4.4) | toast with Undo |
| Reset Day n | day `⋯` (copies) | `reset` with `day` | not offered (built: Undo, or Rebuild) | undoable; no confirm | toast "Day 5 is back to our plan · Undo" |
| Version of Day n | day `⋯` and the existing day menu (copies, before conversion) **[assumed Q-BE2]** | `setVariant` | gone after conversion | the menu shows each version's consequence line (exists) | toast "Day 5 now uses version C · Undo" |
| Add a note | day `⋯`, or "Add a note" under the day title | `setNote` (key the day) | `setNote` | | |
| Reorder days | **built mode only**, day `⋯` "Move Day 5 earlier" or "later", **inside one base's run** (`moveDay`, new in STEP2-C1); never on a copy | | `moveDay` | a copy's days are tied to our plan's bases, versions and bookings; moving stops covers the need | toast with Undo |
| An emptied day | | | | "No stops on Day 4 · Add a place to Day 4 · Drop Day 4"; dropping an empty day happens at once with an Undo toast, no question (foundation 4.4) | |

## 7. The add-a-place picker

One picker for "Add a place to Day n", "Swap for a nearby place", Save to a trip's hand-off (2.4) and the Make it yours
card's "Change places". Phone: full-height sheet; desktop: the 460 px side sheet (components 5.1), no scrim, so the day re-flows in view. Rows are light (name,
kind glyph, area, one fit chip, distance band; P8); at most `PAGE_SIZE.list` rows a group, "Show n more" pages within a
group (P1). Every row reads from `DataClient` (P9): the trip's plan model (already loaded), `near` for nearby, and the
place list engine for search; nothing new is bulk-loaded.

### 7.1 Header

Title "Add a place to Day 5" with the day's base, free time and date: "Base: Jasper · 2 h 10 free · Thu 1 Jul". A search
field (`/` focuses it) and chips: **Rainy day** (filters `indoor`, FLOW TF20), **Kids** (the party's fit, on by default with
children), **Open in July** (the trip's month, on when dated).

### 7.2 Groups, in this order

| # | Group | Contents | Shown when |
|---|---|---|---|
| 1 | **From the other versions of this day** (live label) | the places of the day's other versions (A, B, C) **[assumed Q-BE2]**; after conversion, the versions' places kept in the plan model | a copy (also converted) whose day has versions |
| 2 | **Removed from this day** | stops the person removed from this day, newest first | any removal on this day |
| 3 | **Maybe** | the trip's Maybe list | a copy with Maybe items |
| 4 | **Your picks not on a day** | built picks that are in Did not fit or not placed | built |
| 5 | **Elsewhere on this trip, near here** (live label) | the trip's stops at this base on other days ("also on Day 3") | always |
| 6 | **Within 30 km, with a place page** (live label; the number is read from the config value) | places with a page and a non-approximate point within the add radius of the day's base (today the literal `NEARBY_KM = 30` in `web/components/trips/timeline/model.ts`; STEP2-E3 moves it to `core/src/config/nearby.ts` as `ADD_NEARBY_KM`, one home; it is not the near API's `NEAR_KM` of 25), grouped by distance band, with "12 km NE · 15 to 30 min ≈" | the base has a point; else "Nearby places need this base's location; not researched yet" |
| 7 | **In Banff National Park** | members of a park the trip's days fall within (`PlaceContext.members`, after EG-Q) | a park in the trip |
| 8 | **Search results** | the search field's matches across the catalogue, nearest the base first | the field has text |

A place already on the trip shows "On Day 3" and its button reads **Move here** (a `moveItem`), never a duplicate (`duplicate`
skip reason).

### 7.3 A row

| Part | Content |
|---|---|
| Line 1 | kind glyph, name, the fit chip (suitability 2.8, kids chip first) |
| Line 2 | "fits after Maligne Canyon · +15 min ≈ · ends 17:55", or "Day full: try Day 6" (FLOW 7.1), or a Fix-level reason ("Closed on Thursdays") |
| Action | **Add** (44 px); Enter on the row adds |

After Add: the picker stays open with the row now "Added · Undo" (so several places can be added); the day re-flows behind
it; the sheet's close returns focus to the day's add row. Each add is one undo step.

### 7.4 Arriving with a place (`add=<slug>`)

The picker opens with that place pinned at the top as "Moraine Lake" with one row per day, best fit first ("Day 5 · Lake
Louise · fits after Lake Agnes · +20 min ≈"); **Add to Day 5** on each. A park slug opens the park's members instead (the park itself is never a stop, TB-PIN R1): titled "Add a place in Banff National Park", members not on the trip first, each with its best day and **Add to Day n**; members already on the trip show "On Day n" and no Move button (README ruling C5). A place or park beyond `ADD_PIN_FAR_KM` (100 km) of every base shows one line, "Moraine Lake is 8,100 km from this trip's bases.", and **Start a new trip with Moraine Lake**, with no day rows (an impossible leg is never Tight; README ruling M3). A slug the catalogue does not hold: "We do not have this place any more."
`add` is removed from the URL once the picker opens.

### 7.5 Limits and empty

At `PLAN_DOC_LIMITS.added` places added, Add is disabled with "You have added 30 places to this copy, the most a copy holds.
Remove one to add another." Empty groups are not drawn; all empty: "Nothing we hold near Jasper fits. Try search or another
day." (components 6.1).

## 8. Trip-level: the Settings sheet

One sheet, opened from the edit bar (phone) or the sticky row (desktop). Sections in this order; each changes the trip
with one Apply that states its effect, then an Undo toast; no second dialog (FLOW L5).

| Section | Fields | Template op | Built op | Effect line before Apply |
|---|---|---|---|---|
| Title | the trip's title (also inline on the cover) | `setTitle` | `setTitle` | none (saves on Enter) |
| Dates | start date or "No date"; nights stepper (built) | `setDates`; a length change is `insertDay` or `dropDay` | `setDates`, `setNights` | 9.2 |
| Who is going | adults, children with each age (the party editor of UXB-2; "Use my travellers" fills from the account, ACCT-P) | `setParty` (travellers and profile together) | `setParty` | 9.3 |
| Pace, longest walk, split days | as the party bar | `setParty` (profile) | `setPace` | "Day 5 gets 40 min shorter" |
| When to go window | only when the trip has windows (OVR-1) | `setWindow` | | |
| Make it yours (copies) | the card's three choices as links: Change places (opens the add picker on Day 1), Your driving and pace, Where you start | | | |
| Where you start, Where, Days and driving, Bases, Getting there (built; and copies after the convert notice) | the builder's stage components 1 to 4 and the getting-there sheet, lazily (extension point X10) | **convert notice first** (13.2) | `setOrigin`, `setWhere`, `setDriveDay`, `setBase`, `setNights` then a server rebuild of free items | "Rebuild 6 days · 3 kept and 2 added by you stay" |
| Rebuild (built) | | | `rebuild` | the same line |

Phone: full-height sheet that returns to the same day and scroll on close (P5); desktop: 420 px side panel over the map.

## 9. Dates and party (Q-BE5)

### 9.1 Rule

Relabel and re-check at once; never move a stop by itself.

### 9.2 Dates

| Change | What happens |
|---|---|
| Same length, new start | days relabel ("Day 4 · Thu 1 Jul"); closures by weekday, opening hours, sun times, book-by dates re-run at once; problems appear as warnings (section 11) with one fix each |
| Longer | one question in the Dates section before Apply: "Add 2 days · at the end / after Day 4", with the effect line; Apply makes `insertDay` ops |
| Shorter | "Drop 1 day · Day 7 (2 stops move to Day 6) · Change", choosing which day goes and where its stops go (as 6, Drop Day); Apply makes `dropDay` ops |
| Book-by date already passed | Fix-level warning on the day and in the Bookings tab: "Book-by date passed (1 Jun)" with "Check availability" linking the booking |
| Undated (No date) | relabel to Day numbers only; book-by dates show "Add dates to see book-by dates" (FLOW stage 8) |

### 9.3 Who is going and pace

| Mode | What happens |
|---|---|
| Template | the scheduler re-flows from our plan for the new party at once (shape-keeping, as today); the day versions follow the party unless the person chose one; fit chips re-check; toast "Planned for 2 adults · 1 child (4) · Undo" |
| Built | fit and pace re-check at once; problems appear as warnings; the Apply line offers **Re-flow for a 4-year-old · 3 kept and 2 added by you stay** (one op, Undo); nothing moves until Apply |

The trip's party never changes `travel.party` (EM-B, Q-EM4). Children's ages are household data (edit-my-trip 7): never in
a URL, share text, log or export other than the person's own.

## 10. Undo, redo, reset and changes from our plan (Q-BE1, Q-BE4)

| Concern | Rule |
|---|---|
| Stack | per trip, per tab session: each op's inverse; `PLAN_EDIT.undoSteps` (50) steps; kept in `sessionStorage` under the key named in `web/lib/trip-edit/keys.ts`, so a reload in the same tab keeps it; not synced (FLOW 7.1). A new op clears Redo |
| Keys and buttons | Ctrl or Cmd+Z, Ctrl or Cmd+Shift+Z; the toast's **Undo** (6 s, components 5.3); desktop Undo and Redo in the sticky row; phone Undo and Redo in the cover `⋯` |
| Grouped steps | Swap for a nearby place, Add to Maybe, a Drop Day that moves stops, an Apply with several ops, and conversion are one step each |
| Sync and undo | an undo is a new op (the inverse) sent like any other; a step whose target another device removed is dropped from the stack with the rebase notice (12) |
| Reset Day n (copies) | one op (`reset` with the day), undoable; no confirm |
| Reset to our plan (copies) | one op (`reset` with `day: null`), undoable this session; confirms when it discards more than `PLAN_EDIT.resetConfirmOver` (3) changes: "Reset to our plan? Your 7 changes are removed. You can undo this until you leave the page." **Reset** (danger) · Cancel first in tab order (ruling R7). After conversion the same label replaces the trip with our current plan as a new copy in place (the confirm says so) |
| Changes from our plan (copies) | one collapsed line above Day 1 and at the top of the Summary: "4 changes from our plan · Show" (P3); Show opens the **Changes from our plan** sheet (the prototype's Compare before-and-after sheet is not built; this list is the comparison): one row per template entry (added, removed, moved, version, day ops, notes), newest first, each with what and where ("Removed Moose Lake Loop from Day 5"; a note shows its text) and one button that names its action (an op with an inverse, `deleteEntry` or `restoreEntry`): **Remove it** on an Added row, **Put it back** on a Removed row, **Move it back** on a Moved row, **Remove note**, **Use our version**, **Remove day** (README ruling C4); a header link "Open our Canadian Rockies trip" (new tab) |
| No History list | not in v1 (Q-BE4) |

## 11. Warnings: two levels, never block (Q-BE6)

### 11.1 Levels

The level of each code lives in one table, `WARN_LEVEL` in `core/src/plan/warnings.ts` (STEP2-C1); the UI reads the level,
never a code list of its own.

| Level | Codes (core `core/src/checks/codes.ts` and the builder's) | Where it shows | Look |
|---|---|---|---|
| **Fix** | `W_HOURS` (closed that weekday or outside opening hours), `W_DEADLINE` (a book-by date passed), `W_BOOKING_DAY` (a booking on another or a dropped day), `W_FIT` when a **rule** fails for the party, `W_NO_ROUTE` (new: no road between two stops), the builder's `TB_CLOSED` (closed that month) | at rest on the day header, and counted in the sticky row ("1 to fix") and in the Summary's Checks line (P2 safety exception) | `--crit` text with the triangle icon, never a fill |
| **Check** | `W_DRIVE_LIMIT`, `W_DAYLIGHT`, `W_PACE`, `W_CEILING`, `W_EARLY`, `W_OVERLAP`, `W_FIT` when **our advice** fails | on the day header, collapsed to one line "3 to check · Show" when there are several | `--warn` text on `--warn-soft` |
| hidden | `W_ORDER`, `W_LEG_MISSING`, `W_LEG_DRIFT`, `W_NO_COORDS`, `W_TZ_MISSING` (author data checks) | never to visitors; `W_FIT_UNKNOWN` shows as the gap chip "Not checked yet", not a warning | |

**Built (STEP2-E5):** a Fix warning's one fix is Move to the nearest day that takes the stop with no new warning, else Remove (`W_HOURS`, `W_BOOKING_DAY` move; `W_FIT` rule and `W_DEADLINE` remove); `W_NO_ROUTE` and the builder's codes are levelled but not offered yet. The scheduler's `W_FIT` carries no basis field, so the UI reads it from the sentence ("has a minimum age of" is the rule).

Estimates (≈) are never a warning. Every warning has one fix button: "Move Seceda to a lighter day", "Swap or remove Tre
Cime", "Check availability", "Start 30 min earlier" (built). No dismiss in v1 (a dismiss needs a stored acknowledgement).

### 11.2 Before an edit

Move to day and Add show Fits or Tight and any Fix reason before the person commits (5.1, 7.3). Nothing is ever disabled
because of a warning.

### 11.3 When our trip changes (copies)

A copy follows our plan (EM3). When the trip's content revision differs from the copy's `rev`, a notice above Day 1:
"We updated this trip on 3 Nov. 2 of your changes no longer apply: Moose Lake Loop was removed from our plan. · Show ·
OK" (notice kind, components 5.4). Show lists them in the changes sheet as "No longer applies"; OK records the new `rev`.
Never silent (P4).

## 12. Sync states and conflicts [assumed Q-BE8]

Built over EM-2's engine (`web/lib/mine/sync.ts`) and edit-my-trip 4. Edits never wait for the network.

| State | Where | Words | Screen reader |
|---|---|---|---|
| Signed in, nothing pending | sticky row, right | "In your account" (mono 12.5 `--muted`, cloud glyph) | announced only on change |
| Pending over 1 s | same | "Syncing" with the small spinner (no spin under reduced motion) | "Syncing" |
| Offline with pending ops | same | "Not synced yet" | "Not synced yet, will sync when online" |
| Three rounds failed or refused | same | "Not synced · Retry" (a 44 px button, `--warn` text and icon) | "Not synced, retry button" |
| Signed out | same | "On this device" | |

| Event | What the page does |
|---|---|
| A rebase skipped an op | one notice above the open day: "1 change from this device was not applied: Moraine Lake was removed on another device. · Show · OK"; the undo stack drops entries whose target is gone |
| A refresh brings another device's change into the open day | the changed rows carry "Changed on another device" for `TRIP_EDIT_UI.changedMarkMs` (6 s); focus and scroll stay put (P5) |
| The trip was removed on another device | read-only, "Removed on another device · Restore" (restores within the tombstone window, `PLAN_SYNC.tombstoneDays`) |
| A newer document (`plan-draft/2` written by a newer app) | read-only, "This trip was changed by a newer version of the site. Reload to edit it." |
| Refetch | on focus, `visibilitychange`, after each write and every `PLAN_SYNC.refetchSeconds` while the page is open (EM7) |

## 13. Template mode and built mode [assumed Q-BE7]

### 13.1 The action table

| Action | Template mode (follows our trip) | After conversion or built |
|---|---|---|
| Reorder inside a day | `moveItem`; stays template | `moveItem`; Moved by you, Kept on Day n |
| Move to another day | `moveItem` | same |
| Swap two stops | two `moveItem` as one undo step | `swapItems` |
| Swap for a nearby place | `removePlace` + `addPlace` | `replacePick` |
| Add to a day | `addPlace` | `addPick` |
| Remove | `removePlace` (any stop) | `removePick` (any stop) |
| Keep on Day n, Must see | hidden | shown |
| Add Maybe | `addMaybe` | not offered |
| Add or drop a day | `insertDay`, `dropDay` | same, built form |
| Reorder days | not offered | `moveDay` within a base's run |
| Version of Day n | `setVariant` **[assumed Q-BE2]** | gone; the versions' places are group 1 of the add picker |
| Reset Day n, Reset to our plan | offered | Reset to our plan only (re-copy, confirm) |
| Dates, party, pace | profile ops; the scheduler re-flows from our plan | Apply line, re-flow with kept items |
| Where you start, Where, driving, bases, getting there, Rebuild | **convert notice first** | engine |
| Notes, title | `setNote`, `setTitle` | same |

### 13.2 Conversion (F-Q3, FLOW C5)

The first engine action on a copy shows an inline notice above the Settings section, not a dialog: "This makes it your own
trip. Our later updates to the Dolomites trip will no longer change it. You can undo this until you leave the page."
**Continue** · **Cancel**. Continue runs `convert` (one op, one undo step): the copy's days become built days whose stops are
**placed "From our trip"** (`edits[].fromTrip`, kept on their day), our plan's stops become picks, its bases pinned bases,
the chosen versions flattened **[assumed Q-BE2]**; then the engine action runs on the converted trip. "From our trip" stops
stay placed (FINDINGS item 12, decided: the prototype's switch is not built); a later driving or pace change names them on
the Apply line ("11 from our trip stay") with one button **Let the plan move them** (`release` for all, one op). Mine's row
reads "Dolomites · your trip · from our Dolomites trip" at once.

## 14. Calendar, export, print, share (same in both modes)

| Output | Own trip |
|---|---|
| Add to calendar (dated) | one ICS per trip: all-day event per day, timed stops, book-by events from `core/src/bookings`; built from the person's timelines (P8: per trip) |
| Add dates (undated) | opens Settings › Dates |
| Export | PDF (the print view), GPX (routes and stops), CSV (stops with day, time, kind, coordinates, links), ICS; per trip only |
| Print | `TripPrintView` (built from the edited timelines, STEP2-E6; the trip `⋯` Print and Export both use it): Summary, Days (List or Table), Bookings after the days (Q305), never Photos or Stops; header "Your copy of Canadian Rockies · Fri 25 Jun 2027 · 2 adults, 1 child" |
| Share (copy) | the public trip's URL (`/trips/<slug>/`) without the person's settings; "with my settings" adds the public timeline keys (party word and adult count only, Q296; never children's ages, start, dates or notes) |
| Share (built) | the builder's share keys (public refs only; trip-builder 2.5; never the party, start town, dates or notes); the recipient rebuilds with their own party and can "Use this plan" (FLOW 6) |

## 15. States

| State | What the page shows |
|---|---|
| Loading (document or plan model not yet read) | skeleton cover and three skeleton day cards (components 6.2); Edit trip disabled for at most the fetch; then one cross-fade (a jump under reduced motion) |
| Not found (not on this device or in this account) | "This trip is not on this device or in your account." · **Open Mine**. Same answer for another account's id (no existence signal) |
| A built draft with no build | "Not built yet" · **Open the builder** (`/plan/?draft=<id>&s=4`); resume never builds by itself (TF14) |
| A build older than the engine or data revision | notice "Rebuild to refresh drive times and closures" with Rebuild in Settings (TF14) |
| Building or rebuilding | the status card "Working out drive times · 12 of 30" (honest progress or an indeterminate line); edits paused for that time |
| Build failed | urgent banner "We could not rebuild your days · Try again"; the last build stays |
| Drive quota out or routing down | notice "Some drive times are estimates"; every new leg ≈ (driving-time-model 4.2) |
| Offline | edits work; "Not synced yet"; the dashed offline banner only on the second failed attempt; nearby and search groups say "Needs a connection" |
| Storage blocked, signed out | the trip lasts for the tab; Settings foot "This browser is not keeping data" |
| Paused builder (`PLAN_BUILDER_PAUSED`) | built drafts read-only with a notice; copies stay editable |
| A pick no longer in our list | "1 place is no longer in our list · Remove it" (kept in Did not fit, S12) |
| A kept stop that no longer fits after a rebuild | a Check warning naming it, with "Let the plan move it" |
| Cap reached (device 20, account 50) | Copy to my trips and Build my days say so (X1 wording), never silently fail |

## 16. Accessibility

- Every action has a visible button; drag is never the only way (WCAG 2.5.7); the keyboard model of 5.3.
- Menus use the `role="menu"` pattern of `VariantMenu`; Esc returns focus to the trigger; after Remove, focus moves to the
  next entry, else the day's add row; after Move to day, focus stays on the moved entry in its new day and the page
  scrolls to it (P5).
- Live regions: one polite region for moves, adds and removes (position and day); the sync word announces changes of state
  only; the just-built line once.
- Targets 44 px on phones, 38 px with a 44 px hit area on desktop; chips are words, never colour alone.
- Reduced motion: no lift scale, no settle, no cross-fade; the static "moved" marker for 6 s replaces the highlight.
- 200% text: the sticky row wraps to two lines and the edit controls stay visible; the item sheet scrolls.
- Screen-reader names carry the day: "Actions for Seceda, Day 3"; "Add a place to Day 5".

## 17. Phone and desktop

```
Phone 390, edit mode, Days                    Desktop 1440, edit mode, Days
+--------------------------------------+      +--------------------------------------------------------------------------------+
| [photo] Canadian Rockies   In your acc|      | Your copy · from our Canadian Rockies trip                                    |
| Day rail  1 2 3 [4] 5 6 ...           |      | [Summary] [Days] [Stops] [Bookings] [Photos]   [Undo][Redo] 4 changes [Settings] [## Done ##] |
| 4 changes from our plan · Show        |      | Planned for 2 adults · 1 child (6) · Standard · Edit      | map column         |
| DAY 04  Jasper · 1 h 10 driving       |      | 4 changes from our plan · Show                            |                    |
|  1 to fix: Maligne cruise closed Thu  |      | DAY 04  Jasper · 1 h 10 driving   1 to fix  [...]         |  day 4 route,      |
|  [Swap or remove it]            [...] |      | [::] 09:00  Maligne Canyon        Added by you    [...]   |  numbered pins     |
| [::] 09:00 Maligne Canyon       [...] |      |      Map: Maligne Canyon · Directions                     |                    |
|      Added by you                     |      | [::] 11:30  Maligne Lake cruise   Fix: closed Thu [...]   |                    |
| [::] 11:30 Maligne Lake cruise  [...] |      | + Add a place to Day 4                                    |                    |
| + Add a place to Day 4                |      | DAY 05 ...                                                |                    |
+--------------------------------------+      +--------------------------------------------------------------------------------+
| [ Settings ]            [## Done ##] |
+--------------------------------------+
[::] the handle (long-press on a phone)   [...] the actions button   [## ##] the one filled button
```

Frames to draw in STEP2-PR at 390 and 1440, light and dark: read mode (copy and built), edit mode at rest, item sheet,
Move to day, the add picker, Settings, the changes sheet, the convert notice, the just-built landing, Make it yours, each
sync state, not found, offline.

## 18. Config homes for every number in this page

No number above becomes a literal in code. Each lives in one home; the build packages read it from there.

| Value | Home | Exists |
|---|---|---|
| undo steps 50; Reset confirms over 3 changes | `core/src/config/plans.ts`, new block `PLAN_EDIT` (`undoSteps`, `resetConfirmOver`) | new (STEP2-C1) |
| added 30, removed 40, moved 40, day ops 10, notes 2,000, template days 99, device 20, account 50, 16 KB | `core/src/config/plans.ts` `PLAN_DOC_LIMITS` | yes |
| tombstone 30 days, refetch 60 s, rebase rounds 3 | `core/src/config/plans.ts` `PLAN_SYNC` | yes |
| add-picker radius (30 km today) | `core/src/config/nearby.ts`, new `ADD_NEARBY_KM`, moved from the literal `NEARBY_KM` in `web/components/trips/timeline/model.ts` | moved in STEP2-E3 |
| long-press 300 ms, changed-row mark 6 s, sync word delay 1 s, drag thresholds 4 and 8 px, autoscroll edge 64 px | `web/lib/config/product.ts`, new block `TRIP_EDIT_UI` | new (STEP2-E1) |
| toast 6 s with Undo, 4 s without | `web/lib/config/product.ts`; today `FAVOURITES_TOAST_TIMES` holds 6 s; STEP2-E1 adds a general `TOAST_TIMES` and points favourites at it | partly |
| `/t/` start-JS budget | `web/lib/config/product.ts` `TRIP_EDIT_JS_BUDGET_KB`, value set at STEP2-T1's measured baseline | new |
| page size of picker groups | `web/lib/config/product.ts` `PAGE_SIZE.list` (48) | yes |
| warning levels | `core/src/plan/warnings.ts` `WARN_LEVEL` | new (STEP2-C1) |

## 19. Acceptance (feature level)

| # | Check | Principle |
|---|---|---|
| EA1 | On the Rockies copy, every day's every stop (published, added, from our trip) can be removed in edit mode, with Undo bringing it back to the same position | owner requirement, P4 |
| EA2 | Every day has "Add a place to Day n"; the picker lists other versions (copy), removed stops, Maybe, the trip's stops at that base and nearby places with a page, and an added place re-flows the day | owner requirement, P3 |
| EA3 | Move to day, Move up, Move down work by button at 390 with no drag; long-press on the handle drags within the day; a press on the row body scrolls | Q-BE3, WCAG 2.5.7 |
| EA4 | Keyboard only: lift, move across days, drop, cancel, with each position announced | WCAG 2.1.1 |
| EA5 | 50 undo steps survive a reload in the same tab; a 51st drops the oldest | Q-BE4 |
| EA6 | The changes sheet lists every template entry with Restore; Reset Day n and Reset to our plan undo; Reset to our plan confirms with 4 or more changes | Q-BE1, Q-BE4 |
| EA7 | A date change relabels and re-checks without moving a stop; a shorter range asks which day goes; a party change re-flows a copy and offers Apply on a built trip | Q-BE5 |
| EA8 | Fix warnings show at rest and in the sticky row's count; Check warnings collapse to one line; no edit is ever disabled by a warning | Q-BE6, P2 |
| EA9 | The first engine action on a copy shows the convert notice; Continue keeps every stop "From our trip"; Undo restores the copy with its versions | F-Q3, Q-BE2 |
| EA10 | Two browser contexts as one account: an edit on one appears on the other within the refetch period; an op whose target the other removed is listed, not dropped | Q-BE8, EM5 |
| EA11 | Signed out, a device copy is fully editable; nothing is sent to the server | EM8, P9 |
| EA12 | `/trips/<slug>/` start JS and HTML are unchanged by Step 2 (budget report before and after); `/t/` within `TRIP_EDIT_JS_BUDGET_KB` | P1, P9 |
| EA13 | `/t/<id>/` is `noindex`, `private, no-store`, not in the sitemap, has no OG image; another account's id gives the not-found state; a privacy scan over public routes while trips exist finds no document field | privacy, P8 |
| EA14 | Screenshots at 1440 and 390, light and dark, of each frame listed in 17 | design review |

## Change log

| Date | Change |
|---|---|
| 2026-10-28 | As fixed (STEP2-SEC, review [STEP2-ES](../../reviews/review-STEP2-ES-2026-10-28.md)): the sign-in merge now carries `travel.trip-edit.device` (each merged copy is cached as its document with the device edits laid over it and sent whole as a PUT at revision 0; the account wins a conflict; a copy M3 would skip but that the person changed is kept beside it "(from this device)"); a device entry leaves with its copy (Remove, a replace, the merge, Mine's load), Undo of Remove puts it back; sign-out, a user switch and an account Remove clear the tab's undo stacks. `/t/` sends `X-Robots-Tag: noindex, nofollow` and `Referrer-Policy: same-origin`; no analytics beacon on `/t/` or `/mine/`; Share hands over the public trip's title; GPX and KML are named "Your copy of <trip>"; a built trip offers no Export or Share until B1 |
| 2026-10-28 | STEP2-E3 built: 7 uses the 460 side sheet with no scrim (the day re-flows in view); group 6 reads the list's `bbox` because the near API is `not_available` until N2; Rainy day reads the `indoor-or-rainy-day` row flag; a park's members are the places within `AREA_DEFAULT_R` until `PlaceContext.members` exists; "Start a new trip with" is drawn only with `NEXT_PUBLIC_PLAN_BUILDER=1`; "free" in the header is the day cap less the day's span |
| 2026-10-28 | STEP2-E1B: every row of a day is removable and restorable, the rows the rules made too (5.4), superseding E1's "generated rows have no `⋯`". Kept as `rule:` entries of `template.removed`, no schema change. Known gaps: built trips and inserted days (5.4 last row); removing check-in keeps the drive to the stay, and removing the end keeps dinner where the plan has it |
| 2026-10-28 | As built (STEP2-E1): Move to day rows read "Day 4 · Thu 1 Jul", the base, "ends 17:55" (the scheduler has no free-time figure, so the end of the day replaces "2 h 10 free"), the driving change and Fits or Tight; a Fix reason shows in `--crit` with no chip. A moved stop's known gap (C2): a stop moved to another day gets the 10 minute default leg until the drive model prices it. Changes rows are grouped by kind (added, removed, moved, Maybe, days, versions, notes), each newest first, because the template lists carry no clock. Generated rows (meals, rests, check-in, the hire car and the landing) have no `⋯`: they come from rules and return by themselves; only stops that are items of our plan or places added can be removed. A device copy keeps removals, moves, notes and Maybe in `travel.trip-edit.device` (copies/1 cannot hold them) until STEP2-P2 folds it; the sign-in merge does not carry them yet. Swap rows, the inline cover title and the `E` key wait for E3, a TripCover.tsx owner and the single-letter-keys setting |
| 2026-10-28 | As built (STEP2-E4): Reset Day n is disabled with "Day n is already our plan" when nothing differs; Drop on a phone opens the question in the same half sheet (no back row, Cancel closes); the stops question counts places only (a regroup row is not a stop) and Maybe keeps those with a place page; a booking is a booking check-in row of the day or a Bookings tab row counted from that day; Dates gains a Days stepper (a staged change with its question and Apply) and **No date** only for account trips (a device copy always holds a date); rows the rules made on an added day have no `⋯` (no published day to key them); an added day shows the empty-day line and "Your day" as its title. Known gap: a day added after an added day lands after the days already added at that place (the document orders insertions by operation) | 
| 2026-10-28 | Amended by the rulings of README 6.1 (C1 to C6): cover Done secondary, title keeps its size, current day in order, park and far pins in 7.4, per-kind verbs in 10, empty day drops at once |
| 2026-10-27 | Created (STEP2-PLAN, travel-planner, Opus) |
