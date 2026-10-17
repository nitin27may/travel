# Tokens, patterns and copy

Status: **draft**. The final palette and type come from the design previews the owner picks; this
page fixes the names, the scales and the rules those previews must satisfy. Colour values never
appear in components, only tokens (same rule as `legacy/_system/`).

## 1. Tokens (semantic names only)

### Colour roles
| Token | Role |
|---|---|
| `--surface`, `--surface-raised`, `--surface-sunken` | page, cards and sheets, wells (add boxes) |
| `--text`, `--text-muted`, `--text-inverse` | body, secondary, on accent |
| `--border`, `--border-strong` | hairlines, focus-adjacent |
| `--accent`, `--accent-text`, `--accent-soft` | primary actions, selection, route lines |
| `--ok`, `--warn`, `--danger`, `--info` (+ `-soft` each) | done/fits, warnings/overdue, destructive/cannot, neutral notices |
| `--focus` | focus ring (≥ 3:1 against neighbours) |
| `--cat-nature`, `--cat-water`, `--cat-view`, `--cat-culture`, `--cat-food`, `--cat-stay`, `--cat-transport` | map and card category marks (always paired with a shape) |
| `--phase-plan`, `--phase-book`, `--phase-prepare`, `--phase-go`, `--phase-after` | trip bars and readiness |
| `--presence-1` … `--presence-6` | collaborator colours |
| `--map-*` | basemap overrides (water, land, park, road, label) per theme |

Themes: `light`, `dark`, `sunlight` (Today mode high-contrast). Every pair must pass AA (4.5:1 text,
3:1 large text and UI); a build gate checks it (as `legacy/_system/build.py --check` does today).

### Type
- One UI sans, self-hosted (candidates: Inter, Source Sans 3); optional reading serif for area guides.
- Scale (px, 1.2 ratio, rounded): 12 caption · 14 small/UI · 16 body · 19 h4 · 23 h3 · 28 h2 · 34 h1 · 41 display.
- Line height 1.5 body, 1.25 headings. Tabular numbers for times, distances, money.
- Minimum body on phone 16 px (prevents iOS zoom on inputs).

### Spacing, radius, elevation
- Spacing scale (4 px base): 4, 8, 12, 16, 24, 32, 48, 64.
- Radius: `--r-sm` 6 (chips inner), `--r-md` 10 (inputs, rows), `--r-lg` 14 (cards, sheets), `--r-full` (chips, pills).
- Elevation: `--e-0` flat, `--e-1` cards (hairline + soft shadow), `--e-2` sheets and popovers, `--e-3` toasts. Dark theme uses lighter surfaces instead of shadows.

### Motion
- Durations: `--t-fast` 120 ms (hover, press), `--t-base` 200 ms (sheets, chips), `--t-slow` 320 ms (map fly-to, item fly to a day).
- Easing: standard `cubic-bezier(.2,0,0,1)`; exits faster than entrances.
- Reduced motion: no fly animations, map jumps, cross-fades only.

### Icons
Lucide, 20 px in UI, 16 px inline, 24 px in the bottom bar; stroke 1.75. Kinds have fixed icons
(✈ flight, bed stay, car, train, ferry, ticket activity, fork/knife restaurant, P parking, shield
insurance, boot hike, eye viewpoint, droplet waterfall). Icons never carry meaning alone.

## 2. Map styling
- Calm basemap (OpenFreeMap style trimmed: fewer POIs, muted roads), hillshade in mountains.
- Pins: numbered circles for the section in view; category by shape (circle place, triangle trail/peak,
  square stay, diamond transport) and colour; selected = larger + accent ring; faded = 40 % opacity.
- Routes: the open day's route in `--accent` 4 px; other days 2 px muted; flights as geodesic dashed arcs.
- Stays: house icon with the night numbers ("2–4").
- Clusters show counts; never cluster the section in view.
- Labels in the local language with the English name on hover/focus.
- Offline: PMTiles pack for the trip area; beyond it a plain background with pins and routes.

## 3. Patterns

### Sheets
Desktop: right panel over the map, 440 px, non-modal; phone: bottom sheet with snap points. URL
gets `?focus=`; Back closes. One sheet at a time; opening another replaces it with a back arrow.

### Drag and drop
dnd-kit with pointer, touch (long-press 250 ms) and keyboard sensors. Drop targets: positions in a
day or list, outline entries, board columns. Every drag has the Move menu equivalent. Auto-scroll near
edges. A drop = one operation = one undo.

### Undo
Every operation returns an inverse ([../01-domain-model.md](../01-domain-model.md) section 5). Toast
with Undo for 6 s; ⌘Z/⌘⇧Z on desktop; Undo/Redo buttons in the trip top bar; batches (a chat
client's 6 adds, a template adaptation) undo as one.

### Optimistic updates
The client applies the op through the shared reducer immediately, marks it pending, and confirms or
rolls back on the server's answer ("Couldn't move: the item was deleted by Priya").

### Live presence and remote edits
Supabase Realtime channel per trip ([../08-self-hosted.md](../08-self-hosted.md) §4): avatars in the
top bar; a coloured ring on the item someone has open; remote moves animate (or jump) and are
announced politely; never steal focus or scroll position.

### Offline queue
Ops queue in IndexedDB with client ids; clock mark on affected items; OfflineBadge counts; replay in
order on reconnect; failures surface as a list ("2 changes couldn't be saved: Keep mine / Discard").

### Conflict
Intent ops rarely conflict; field edits (notes, titles) use last-writer-wins with a ConflictBanner
when the field changed under an open editor. Never silently drop text: the losing version is kept in
the item history.

### Progressive data
Straight-line distances first, routed times later (≈ marks the estimate). Facts with sources load
with the sheet; photos lazy-load.

### Confirmation
No "Are you sure?" for reversible actions (undo instead). Ask only for irreversible ones: revoke a
client, delete account, delete a trip (with a 30-day trash).

## 4. Copy rules
1. Verbs on buttons: "Book the shuttle", "Add a day", "Leave by 07:10", "Copy link".
2. Dates relative and absolute: "in 12 days, Sat 15 Apr".
3. Times with zones when they differ: "09:00 Rome (03:00 your time)".
4. Every suggestion has a reason; every warning has a fix.
5. Plain words, no jargon: "Book" not "Reserve inventory"; "Who can do what" not "Eligibility matrix".
6. Name people, not roles: "Priya booked it".
7. Never "From the web" without a source and read date.
8. Short: one sentence per message; details behind "Why?".
9. Numbers where decisions are made: distance, gain, drive, cost, days left.
10. Errors say what happened and what to do: "We couldn't send the email. Try again or use Google."

## 5. Lessons from Wanderlog (screenshots in ../reference/, review in ../07-competitors.md §7)

| Wanderlog | Our rule |
|---|---|
| Outline with lists and dates only | outline entries carry state: counts, base town, warnings, done/total |
| "Add a place" box per list and day, with note and checklist buttons | AddBox with a ⊞ menu; also accepts links and custom names |
| Numbered cards = numbered pins | kept; section in view highlighted on the map |
| Map opened on Birmingham for a Dolomites trip | the map always opens on the trip's area |
| PRO badges, AI button, hotel ad inside Day 1 | no upsell or ads inside the plan |
| "From the web" description without source | facts with source and read date; our paraphrase |
| Ghost "Untitled" list, ghost list title, "+ New list" button | lists appear on first item; "+" divider inserts |
| Later days collapse to headers | kept, with base and warnings in the collapsed line |
| Budgeting at the end of the document; tripmates inside budget | budget at the end; people stay in People |
| Five-tip onboarding carousel | empty states that do the thing |
| Place panel over the map with "which list" | DetailSheet with "In: list ▾", facts, fit, booking window |
