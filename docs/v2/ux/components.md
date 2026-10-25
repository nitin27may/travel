# Component inventory

Status: **draft**. Each component: purpose · props · variants · states · behaviour · accessibility ·
where used. Props are the design contract, not final TypeScript. Built on Base UI primitives with
Tailwind 4 and the tokens in [tokens-and-patterns.md](tokens-and-patterns.md). Every interactive
component supports keyboard, touch and pointer; every async one has loading, error and offline states.

## 1. Shell and navigation

### AppShell
- **Purpose**: frame for every signed-in screen: rail (desktop) or bottom bar (phone), top bar, content, toasts.
- **Props**: `nav` (global | trip), `trip?`, `title`, `actions[]`, `presence?`, `offline` state.
- **Variants**: global, trip, admin, guest (no nav, GuestBanner).
- **States**: offline (OfflineBadge in top bar), syncing (thin progress line), signed-out (Sign in button).
- **Behaviour**: swaps the bottom bar inside a trip; remembers rail collapsed state; Today replaces Overview during the trip.
- **A11y**: landmarks `nav`, `main`, `header`; skip link to main.
- **Used**: all screens.

### TopBar
- **Props**: `back?`, `title`, `subtitle?`, `presence?`, `actions[]`, `search?`.
- **Variants**: compact (phone), full (desktop with Undo/Redo and Share).
- **A11y**: title is `h1`.

### BottomBar / Rail
- **Props**: `items[{icon,label,href,badge?}]`, `active`.
- **Behaviour**: badges show counts (Inbox due). Rail collapses to icons at tablet.
- **A11y**: `aria-current="page"`; labels always present (visually hidden when icon-only).

### ToTop (floating back-to-top, phone)
- **Spec**: [S28](screens/S28-back-to-top.md). Client-only, lazy; phone width (639 px and narrower) only.
- **Placement**: fixed, `right: --margin`, `bottom: --phone-bottombar-h + --s-3`, `--z-drawer`, 44 x 44, `--surface` fill, `--e-3` ring (no border), `--ink` arrow.
- **Behaviour**: shows 1.5 screens down, hides within 1 screen of the top. Blocked while a text-entry field has focus, while a visible dialog, menu, listbox or `aria-modal` is open, while a toast shows, and while a fixed bottom panel is open (today the trip map sheet, `.tl-mapcol[data-sheet]`). Any new fixed bottom panel must add its open attribute to the blocked list in `ToTop.tsx`.
- **A11y**: native button "Back to top"; focus moves to `main#main`, which shows no outline and loses its tabindex on blur.

### TripTabs
- **Props**: `phase`, `active`, `counts`.
- **Behaviour**: Overview label becomes "Today" during the trip.

### CommandPalette
- **Purpose**: jump, search, add, act from one box.
- **Props**: `scope` (global | trip), `recent[]`.
- **Behaviour**: groups results (Actions, This trip, Catalog, Trips); first row = best action; "Add 'X' as my own" always last in Catalog group; works offline for trip content.
- **States**: empty (recent items), loading (inline spinner per group), offline (catalog group "Needs connection").
- **A11y**: combobox pattern with listbox; `/` and `⌘K` open; Esc closes and restores focus.
- **Used**: global.

### Outline
- **Purpose**: scroll-spy table of contents of the plan document carrying state.
- **Props**: `sections[{id,label,kind:list|day|bookings|tasks|budget|notes, count?, base?, status?:ok|warn|empty, done?/total?}]`, `activeId`.
- **Behaviour**: click scrolls; drop target for items (drop onto a day entry = move to that day, end); hides empty lists.
- **A11y**: `nav` with `aria-current`; drop target has Move menu equivalent.
- **Used**: S09.

### InsertDivider
- **Purpose**: the "+" between sections to insert a new list there.
- **Behaviour**: visible on hover/focus (desktop), always faint on phone; click → new list title field with focus.
- **Used**: S09.

## 2. Plan building blocks

### AddBox
- **Purpose**: the one place to add: catalog search, custom item, pasted link, note.
- **Props**: `target` (list id | day n), `placeholder`, `kinds` (for the ⊞ menu), `nearPoint?`.
- **Behaviour**: suggestions from the catalog near the target's base as you type; Enter adds the first; "Add 'X' as my own" always present; a pasted URL → link item (title and coordinates when the URL has them); ⊞ menu: note, checklist, break, drive, stay, flight, other reservation.
- **States**: loading suggestions, offline (custom only + trip items), error (suggestions failed, custom still works).
- **A11y**: combobox; ⊞ is a menu button with label "More to add".
- **Used**: S09, S10, S11, S05 (candidates), S15 (tasks).

### ItemRow
- **Purpose**: one item in a list or day.
- **Props**: `item`, `number`, `time?`, `timeHint?`, `who[]`, `status`, `warnings[]`, `variant?`, `compact?`, `draggable`, `presence?` (someone editing), `queued?` (offline).
- **Variants**: list (no time), day (time column), compact (board), done/skipped (Today, after).
- **States**: dragging, drop-target, editing by someone else (avatar ring), queued (clock), conflict.
- **Behaviour**: click opens DetailSheet; inline time edit; ⋯ menu (Move to…, Set time, Who, Share, Duplicate, Delete).
- **A11y**: one focusable row; ⋯ menu; announces moves.
- **Used**: S09, S10, S11, S19, S21.

### AnchoredItem
- **Purpose**: an item whose times come from a reservation segment.
- **Props**: `segment`, `reservation`, `status` (to_book dashed, booked solid).
- **Behaviour**: time fields locked with "Edit on reservation" link; ticket mark opens the reservation.
- **Used**: S09, S10, S11, S19.

### LegRow
- **Purpose**: travel between consecutive stops.
- **Props**: `mode`, `duration`, `distance`, `source` (cached, estimate ≈), `warning?`.
- **Behaviour**: tap to change mode; ≈ until a routed time exists.
- **Used**: S09, S11, S19.

### DayHeader
- **Purpose**: a day's identity and feasibility at a glance.
- **Props**: `n`, `date?`, `base?` (from night base), `totals{drive, walk_km, gain_m}`, `sun{rise,set}`, `bookings`, `warnings[]`, `collapsed`, `variants[]`.
- **Variants**: full, collapsed (one line), compact (board, phone).
- **Behaviour**: ⋯ menu: Fill this day, Reorder to cut driving, Share this day, Add day before/after, Swap with…, Clear.
- **A11y**: heading level 2 with the full sentence ("Day 2, Sunday 9 September, sleep at Banff Inn, 1 warning").
- **Used**: S09, S10, S11.

### DaySection
- **Purpose**: container for a day: DayHeader, warnings, VariantTabs, items, AddBox. Virtualised when collapsed off-screen.
- **Used**: S09.

### VariantTabs
- **Purpose**: parallel tracks (A adults, B family, C easy) with who is on each.
- **Props**: `variants[{key,label,who[]}]`, `mode` (tabs | lanes).
- **Used**: S09, S10, S11.

### ChecklistBlock
- **Purpose**: lines with checkboxes inside a list or a day.
- **Props**: `title`, `lines[{text,done}]`, `promotable`.
- **Behaviour**: Enter adds a line; "→ task" on a line opens TaskSheet pre-filled.
- **Used**: S09, S11, S15, S20.

### NoteBlock
- **Purpose**: rich text note (Markdown subset) in a list, day or overview.
- **States**: conflict (ConflictBanner); remote editing indicator.

### SpanBar
- **Purpose**: multi-day stays, treks, car rentals across board columns. **Used**: S10.

## 3. Catalog presentation

### PlaceCard
- **Purpose**: answer "is this for us?".
- **Props**: `entity`, `photo`, `facts` (kind-specific top 2–3), `drive?`, `fit` (per traveller), `reason`, `trust`, `added?` (list/day), `compact?`.
- **Variants**: card (grid), row (list), mini (map peek), suggested (carousel).
- **States**: loading (skeleton), added (check + "In: Ideas"), unavailable in dates (muted with reason).
- **Behaviour**: + Add with target picker; hover syncs map pin.
- **A11y**: card is an article; + Add has label "Add Lake Agnes to Ideas".
- **Used**: S06, S09 suggested row, S02 signed out.

### FitAvatars
- **Purpose**: who in the party can do this.
- **Props**: `travellers[{name,status:fits|warn|no, reason?}]`.
- **Behaviour**: tap → reasons ("Mira: needs 12+").
- **A11y**: text summary "Fits 3 of 4; Mira needs 12+". Status by shape (● ◐ ○) and colour.
- **Used**: S06, S07, S09, S17.

### ReasonLine
- **Purpose**: why a suggestion fits. **Props**: `parts[]`. **Used**: PlaceCard, S07.

### TrustBadge
- **Props**: `level` (unverified | stated | verified). **Behaviour**: tap explains the rule. **Used**: S07, S24.

### SourceLine
- **Props**: `source{publisher,url}`, `readOn`, `confidence`. Renders "Parks Canada · read Mar 2026". **Used**: S07, S24.

### ConflictNote
- **Purpose**: show disagreeing evidence ("A 2025 trip report says 7.8 km"). **Used**: S07, S24.

### TrailheadCard
- **Props**: `name`, `point`, `elevation?`, `facilities[]` (toilets, water, bear lockers), `access` (road type, season), `navigateTo`.
- **Behaviour**: Navigate opens maps; Copy coordinates.
- **Used**: S07, S19 NEXT for hikes.

### ParkingCard
- **Props**: `lot`, `point`, `fee`, `capacity?`, `fillsBy?` (time and season), `permit?`, `shuttle?` (alternative with link and window), `evCharging?`, `notes`, `source`.
- **States**: unknown ("No parking info yet · suggest it").
- **Used**: S07, S19.

### ElevationProfile
- **Props**: `profile[]` (distance, elevation), `markers[]` (lakes, huts, viewpoints), `units`.
- **Behaviour**: hover/scrub syncs a marker on the map; text summary for a11y.
- **Used**: S07, S09 (trail item expand).

### SeasonBar
- **Props**: `months[]` (open/partial/closed with notes), `tripMonths`.
- **Used**: S07, S18.

### LinkList
- **Props**: `links[{type: official|map|gpx|report|status|webcam|booking, label, url, licence?}]`.
- **Behaviour**: groups by type; marks "link only" sources (AllTrails); GPX download shows licence.
- **Used**: S07.

### BookingWindowCard
- **Props**: `offer{window_rule, window_spec, sellout, fallback, tz}`, `tripDates?`.
- **Behaviour**: shows the computed opening in operator and home zones; "Remind me".
- **Used**: S07, S12.

## 4. Map

### MapPanel
- **Purpose**: MapLibre map with the app's layers.
- **Props**: `layers` (pins, routes, bases, flights, areas), `focusSection?`, `selected?`, `offlinePack?`.
- **Behaviour**: follows the section in view (S09); "Search this area" on pan (S06); resizable divider (desktop); bottom sheet (phone).
- **States**: offline (pack tiles or plain background with pins), loading tiles.
- **A11y**: map is `role="application"` with the list as equivalent; keyboard pan/zoom; pins focusable.
- **Used**: S06, S08, S09, S10, S19, S27.

### NumberedPin
- **Props**: `n`, `kind` (shape), `state` (default, hover, selected, faded, done).
- **A11y**: name "3, Lake Agnes Tea House".

### MapPeekCard
- **Purpose**: mini card on pin tap. **Used**: S06, S09.

## 5. Sheets and overlays

### DetailSheet
- **Purpose**: entity or item or reservation detail over the current view.
- **Props**: `kind`, `id`, `tabs[]`, `primaryAction`.
- **Variants**: right panel (desktop), bottom sheet (phone).
- **Behaviour**: `?focus=` in URL; ←/→ to siblings; Esc closes.
- **A11y**: dialog semantics (non-modal on desktop), focus to heading.

### BottomSheet
- **Props**: `snapPoints` (peek, half, full), `initial`.
- **Behaviour**: drag handle; keyboard via buttons; never traps scroll of the page behind when at peek.

### FilterSheet
- **Props**: `facets[]`, `counts`, `value`. **Behaviour**: counts update live; "Clear all"; Apply (phone) / instant (desktop).

### TaskSheet, InviteSheet, NewTokenSheet, StartJobSheet, RunningLateSheet
Specialised sheets; same DetailSheet frame.

## 6. Filters and search

### OmniSearch
- **Purpose**: typed intent → chips ("waterfall near Ajax for kids under 2 hours").
- **Behaviour**: rule-based parsing in v1; unknown words remain text search.
- **Used**: S06, S02.

### FilterChips
- **Props**: `chips[{label, onRemove}]`. **A11y**: each chip is "Remove filter: lake".

### PersonaChips
- **Props**: `views[]` (saved_view), `active`. **Used**: S06, S02.

### LocationLens
- **Props**: `options` (home, trip base, day base, current position, pin), `value`.
- **Used**: S06, S04 day trip.

### ZeroResultRescue
- **Props**: `failingFilters[]`, `nearMisses[]`, `loosenActions[]`. **Used**: S06.

## 7. Bookings and money

### BookingsStrip
- **Purpose**: one chip per reservation kind with counts and status at the top of the plan.
- **Props**: `kinds[{kind,count,booked,toBook,warn}]`, `forwardAddress`.
- **Behaviour**: tap chip → filtered S12; "Forward an email" copies the address.
- **Used**: S09, S08.

### ReservationCard
- **Props**: `reservation`, `segments`, `travellers`, `status`, `nextDeadline?`, `canRevealSecret`.
- **Variants**: row (S12), anchored (S09), detail (sheet).
- **States**: to_book (dashed), held, booked, cancelled (struck), "check 2 fields" (from email).
- **Used**: S12, S09, S08.

### SecretField
- **Purpose**: confirmation codes hidden until revealed; copy. **A11y**: "Reveal confirmation code".

### WalletCard
- **Props**: `reservation`, `segmentToday`, `code`, `names[]`, `address`, `phone?`, `attachments[]`.
- **Behaviour**: big code, copy, read aloud, brightness boost for QR.
- **Used**: S14, S19.

### TimeWithZone
- **Purpose**: "09:05 Venice (03:05 Whitby) +1".
- **Props**: `local`, `tz`, `homeTz`, `showHome` (auto when different), `dayOffset?`.
- **A11y**: reads "9:05 Venice time, next day".

### DateRelative
- **Purpose**: "in 12 days, Sat 15 Apr" / "yesterday". **Props**: `date`, `style` (both | relative | absolute).

### BudgetBar
- **Props**: `planned`, `actual`, `target?`, `currency`, `byCategory[]`.
- **Used**: S16, S08, S09 budget section.

### ExpenseQuickAdd
- **Props**: `currency`, `defaultCategory`, `linkedItem?`. **Behaviour**: amount first, numeric keypad. **Used**: S16, S19.

## 8. Tasks, reminders, readiness

### TaskRow
- **Props**: `task`, `owner`, `due`, `reminders`, `source`, `editedByUser`.
- **Behaviour**: one-tap complete with Toast/Undo; swipe actions on phone.
- **Used**: S15, S08, S22.

### ReminderChip
- **Props**: `state` (upcoming | due | done | missed | snoozed), `at`, `channels[]`.
- **Used**: S12, S15, S22.

### ReadinessBar
- **Props**: `stage` (plan | book | prepare | go), `done`, `total`, `note?`.
- **A11y**: text "Bookings 6 of 9, next deadline in 12 days".
- **Used**: S02, S08.

### NextActionBanner
- **Props**: `action{text, at, tz, verb, href}`.
- **Behaviour**: always one action; dismiss = snooze until the next action changes.
- **Used**: S02, S08, S09.

## 9. Collaboration, sync, offline

### PresenceAvatars
- **Props**: `people[{name, color, editingItemId?}]`. **Used**: TopBar, ItemRow ring.

### ConflictBanner
- **Props**: `field`, `mine`, `theirs`, `who`. **Actions**: Keep mine, Keep theirs, See both. **Used**: NoteBlock, inline fields.

### OfflineBadge
- **Props**: `online`, `lastSync`, `queued`. **Behaviour**: tap opens sync details. **Used**: TopBar, TodayHeader.

### Toast (with Undo)
- **Props**: `message`, `undo?`, `duration` (6 s with undo, 4 s without).
- **A11y**: polite live region; Undo reachable by keyboard before it disappears (pauses on focus/hover).

### SyncLine
- **Purpose**: thin top progress line while syncing queued ops.

## 10. States and feedback

### EmptyState
- **Props**: `title`, `body`, `primary` (verb), `secondary?`. Rule: always one action that does the thing.

### Skeleton
- **Props**: `shape` (card, row, map). Cross-fades to content; no shimmer when reduced motion.

### ErrorState
- **Props**: `message`, `retry`, `cached?` (shows cached data under the message).

## 11. Admin

### DiffView
- **Props**: `before`, `after`, `fields[]`, `geometry?`. Field-level old → new; geometry overlay on a map.
- **Used**: S24, S18 (template changes).

### EvidencePanel
- **Props**: `evidence[]`, `conflicts[]`. **Used**: S24.

### CoverageMap, CoverageTable, BacklogTable, JobRow
- **Used**: S25.

## 12. Sharing (rules: ../10-sharing.md)

### ShareButton
- **Purpose**: consistent entry to sharing on every relevant screen.
- **Props**: `scope` (trip | day_range | day | list | item | reservation | ticket | budget | template | area_guide | search | route), `targetId`, `label?`.
- **Behaviour**: phone → native share sheet first when a link already exists, else ShareSheet; desktop → ShareSheet.
- **A11y**: label names the object ("Share day 3").
- **Used**: S02, S03, S05–S12, S14–S16, S18–S21.

### ShareSheet
- **Props**: `scope`, `targetId`, `role` (owner | editor | viewer), `existingLinks[]`.
- **Regions**: ScopePicker, AudiencePicker, IncludeToggles, SharePreview, ExpiryPicker, PinField, ShareActions, ExportButtons, LinkRow list.
- **Used**: S26.

### AudiencePicker
- **Props**: `value` (members | link | public | export), `allowed[]` (from role and scope).

### IncludeToggles
- **Props**: `flags{plan,times,costs,firstNames,notes,reservations,manageLinks}`, `locked[]` (codes, tickets, ages, heights, passports, attachments).
- **Behaviour**: locked row always visible, never toggleable.

### SharePreview
- **Purpose**: renders GuestView with the chosen flags, exactly what the recipient will get.

### LinkRow
- **Props**: `scope`, `expiresAt`, `views`, `lastViewedAt`, `hasPin`, `revoked?`.
- **Actions**: Copy, QR, Revoke.

### GuestBanner
- **Props**: `sharedBy` (first name), `expiresAt?`, `readOnly`. **Used**: S27.

### ShareCardImage
- **Purpose**: an image card (1080 × 1350) of a day, a place or a trip summary for chat apps and social, generated server-side.
- **Props**: `scope`, `targetId`, `style` (photo | map | text).
- **Behaviour**: shared via Web Share API with files when supported, else downloaded.
- **Used**: S26 exports.

### PinPrompt, CopyToMyTrips
- **Used**: S27.

## 13. Forms

### DateRangePicker, DateTimeZoneField, AirportField, StationField, PlaceField, MoneyFields, TravellerToggles, TravellerRows, SegmentList, AttachmentField, PasteParser
- **Purpose**: S04 and S13 inputs. DateTimeZoneField always shows the zone and computes duration and "+1". AirportField uses OurAirports (code, name, city, zone). PlaceField searches the catalog first, then addresses.
- **A11y**: labels, errors linked, fieldsets for segments.
