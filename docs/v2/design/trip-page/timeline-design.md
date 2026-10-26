# Trip page as a timeline (design, 18 Oct 2026)

Owner direction, 18 Oct 2026: about 90% of visitors search, open a trip and add it to their calendar or
account with their own dates; about 10% plan. The trip page matters most, and chronological order
matters most of all. Today's page has no timeline. This document redesigns the public trip page
(`/trips/<slug>`) so the whole trip reads as a timeline (Day 1 to N) and each day reads as a timeline
(leave at a time, drive 1 h 30, a sight that takes 2 h, a coffee, lunch), realistically.

Companion files: the static mock at [mock/index.html](mock/index.html) (open it in a browser; the pill at
the bottom right switches theme and profile), its screenshots in [mock/shots/](mock/shots/), and the
benchmark sources in [research-benchmark-raw.md](research-benchmark-raw.md). The data model and the
scheduler rules are in [features/trip-timeline.md](../../features/trip-timeline.md), written in parallel;
that page governs data and rules, this page governs layout. Section 9 lists where the two meet and the
three places this page deliberately renders the spec's wording differently.

Changes to foundation patterns 3.4 are marked **[changes 3.4]** throughout and collected in section 10.

## 1. Verdict on today's page

Screenshots: [mock/shots/before-desktop-day1.png](mock/shots/before-desktop-day1.png),
[mock/shots/before-phone-day1.png](mock/shots/before-phone-day1.png) (Rockies Day 1, 18 Oct 2026).

| Rank | Finding | Why it matters to a family | Fix in this design |
|---|---|---|---|
| critical | No times anywhere. Day 1 lists "Fenland Loop · Vermilion Lakes Drive · Elk rut viewing" as a bag of names. | A reader cannot tell whether the day is tight or lazy, when to leave or whether a 6-year-old will last. | Every day is a time rail with typed entries, drive legs with duration and distance, meals, a rest and the sunset (section 4). |
| critical | The whole plan is not visible as a shape: 14 uniform rows, no sense of where the long drives or the booked slots fall. | The first question is "what kind of two weeks is this": move days, big days, slow days. | The trip at a glance: a 14-cell strip under base brackets, drive and walk bars, fixed-slot dots (section 3.3). |
| critical | "B · Whole family / C · Easy day" is a toggle inside every day. A visitor must choose 14 times and the choice never applies to the trip. | The party is one fact about the trip, not about each day. Repeating it reads as indecision and buries the content. | One profile selector at the top (who, days, pace) renders the whole trip; a quiet per-day override remains (section 3.2 and 4.6). **[changes 3.4]** |
| critical | Research markers leak: "(INFERENCE)", "(20:16 CALC)", "(2025-26 blogs, low confidence)". | Internal provenance language reads as broken text and makes the plan look unfinished. | Provenance becomes the honesty chip once per entry ("2029 schedules not out", "estimated" on a leg) and the "Suggested times" label; never inline parentheses (section 5). |
| important | A 120-word prose paragraph before the stop list. | Phone readers scroll past 9 lines before the first stop; the useful warnings are lost inside it. | Prose is split into "Know before you go" bullets, collapsed per entry and per day (section 4.5). |
| important | Mixed units: "1.9 km" in the note, "1.2 mi · 70 ft up" in the row. | Two unit systems in one card reads as an error; the child-fit judgement depends on the number. | One unit system per page, switched in the sticky bar; notes are templated, never hand-typed with units (section 5). |
| important | Flat item rows with "Option B" tags and no legs. | Without legs the reader cannot see the 1 h 30 drive that shapes the arrival day. | Legs are first-class connectors (section 4.3). |
| important | The map is above the days and does not follow them. | The route and the day are read in two places. | Desktop: the map is a sticky right column that follows the day in view. Phone: a "Map · Day 1" pill opens a bottom sheet (section 6). **[changes 3.4]** |
| polish | The day row's thumbnail and title are good and stay. The DAY sign, the season band, the cover and the category strip stay. | | Kept; see keep-from-live-site.md. |

What the live legacy page does better than v2 today, and this design keeps: "Light: sunrise 07:05, sunset
20:16" per day; "Decision rule" and "Wet-weather swap" per day; drive stated with its road; bookings
listed per day. What neither does and this design adds: times of day, legs, meals, breaks, the rest.

## 2. Benchmark

Sources and caveats are in [research-benchmark-raw.md](research-benchmark-raw.md); numbers in brackets
are its source list. Several help centres blocked fetching, so the rows for Lonely Planet, Atlas Obscura,
Apple Journal, Komoot and Google are low confidence and were not checked hands-on.

| Product | Time rail | Leg connectors | Collapse rule | Day overview, sticky day nav | Map in sync | What we take | What we avoid |
|---|---|---|---|---|---|---|---|
| Wanderlog [1-6] | optional start and end time per place | time and distance on every leg, daily totals, directions hand-off | not documented | by day or by category; no documented sticky bar | list and map in one view, colour-coded pins joined in order | legs with duration and distance, daily totals, "by day / by category" on one data set | opt-in times (most days end up timeless); unlabelled drive estimates that users report as wrong |
| TripIt [7-11] | one chronological timeline of bookings | none | none | none | none | the single chronological spine; every booking sits on it | nothing but bookings: no meals, breaks, walks or sun |
| Google Travel, Maps, AI Mode [12-17] | none per stop | none | none | none | itinerary pins on an expandable map, saved as a list | map list export (.kml, Maps list) as an export target | four surfaces, no single page; AI itineraries with mistakes |
| Airbnb Experiences and Trips tab [18-20] | durations per step in minutes, no clock | none | none | none | none | one photo plus one line per step; booked items inline in the schedule | duration-only steps: a reader cannot place the day in the clock |
| Lonely Planet, Make My Day [21-24] | morning, afternoon, evening blocks | prose | none | itineraries titled by day count | none | block labels as a fallback when a time is unknown ("morning") | prose-only days |
| Atlas Obscura Trips [25] | none; narrative days | none | none | "Day 1" sections | none | meals named in the day | no times, legs or map |
| Apple Journal [26-28] | moments by date | none | none | calendar jump | places map of entries | nothing for planning | retrospective only |
| Polarsteps planner [29-32] | arrival date and nights per step | transport mode per leg | none | none | map-first builder | the step-with-nights model for the base brackets | granularity of days, not hours |
| Komoot multi-day [33-38] | stages by moving time | each stage is a routed tour to the accommodation door | none | stage list | drag the route on the map | stage sizing by moving time maps to our pace setting | stages saved as separate tours |
| Linear activity [39] | ordered events | none | groups similar consecutive events, collapses older activity between comments | none | none | collapse minor items (coffee, rest) into quiet rows, never hide timed ones | undocumented expand |
| GitHub, Primer Timeline [40-42] | vertical rail with badges per item | `Timeline.Break` decorative separator hidden from AT | `condensed` items without a badge well; "Load more" for the middle | none | none | the rail anatomy: badge, condensed items, a decorative break; list semantics for screen readers (8 Oct 2026) | hiding the middle of a day |

Conclusion from the benchmark: no product shows a fixed time differently from a suggested one, none
documents sticky day navigation or scroll-linked maps, and none has meal or break item types. Those three
are the gaps this design fills, and they are also the three things a family needs most.

## 3. Page structure, top to bottom

1. Cover (unchanged anatomy, patterns 3.4 item 1). Standfirst copy changes to say what the page does:
   "Pick who is going and the pace once; every day below is laid out hour by hour for that choice."
2. Glance strip (unchanged): Length · Bases · Drive a day · Valid for.
3. **Plan it for**: the party profile selector (3.2). **[changes 3.4: new item 2]**
4. **Sticky plan bar**: the compressed profile line, the day rail (14 numbers with drive-load bars), and
   the unit switch; sticky under the header from here down (3.4). **[changes 3.4: new]**
5. Season band (unchanged content, one row shorter: the 12-month strip and weather tiles collapse behind
   "Why this window" on phone).
6. **The trip at a glance**: the whole-trip timeline (3.3). **[changes 3.4: replaces "The route" as the
   first section after the band; the map moves beside the days]**
7. **Day by day**: the By day / By category segment and the category strip stay above the content. In By
   day, the content is the per-day timelines (section 4) with the map in a sticky right column (section 6).
   In By category, the six sections as today; each row keeps its "Day 3 · 11:30" sign, now with the time.
8. Copy and export, credits (unchanged), with the line "Times are suggestions from the published plan;
   fixed slots and sun times are exact for the season window."

### 3.1 Desktop wireframe (1440)

```
┌ header 60 ────────────────────────────────────────────────────────────────────────────┐
│ TRIP PLANS   Trips  Places  Globe                                   search  theme  Sign in │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌ cover 620 ─────────────────────────────────────────────────────────────────────────┐ │
│ │ PUBLISHED PLAN · ALBERTA AND BRITISH COLUMBIA                                       │ │
│ │ CANADIAN ROCKIES, 14 NIGHTS                                                         │ │
│ │ standfirst · chips · [Copy to my trips] [Export] [Share]                            │ │
│ └──┬ glance: LENGTH 14 nights · 15 days │ BASES 5 │ DRIVE A DAY ≈1 h 40 │ VALID FOR ┬─┘ │
│ ┌ PLAN IT FOR  One choice for the whole trip. Any day can still be changed on its own. ┐ │
│ │ WHO IS GOING            DAYS                 PACE                                   │ │
│ │ [Adults only│Family] [youngest − 6 +]  [14 nights│16 nights]  [Relaxed│Standard│Full]  More  [Copy with these choices] │
│ │ sub-lines: what each choice means in one sentence                                   │ │
│ │ 14 of 14 days fit · ≈48 km walking · ≈23 h driving · 6 fixed slots · (i) as Nitin wrote it │
│ └─────────────────────────────────────────────────────────────────────────────────────┘ │
├ sticky plan bar 52 ───────────────────────────────────────────────────────────────────┤
│ Planned for Family, youngest 6 · 14 nights · Standard  Change   [1] 2 3 │4 5 6 7 │8 … 14   [km│mi] │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ THIS PLAN IS VALID FOR   EARLY TO LATE SEPTEMBER   why · 12-month strip · weather        │
│ THE TRIP AT A GLANCE                                                                     │
│ ┌ BANFF 2 nights ─┬ LAKE LOUISE 1 ┬ JASPER 4 nights ───────┬ LAKE LOUISE 4 nights ┬ KANANASKIS 3 ┐ │
│ │ 01   02   03   │ 04            │ 05  06  07  08         │ 09  10  11  12       │ 13  14      │ │
│ │ ▇▂   ▂▃   ▆▃   │ █▂            │ ▃▄  ▅▄  ▂▅  █▂         │ ▂▅  ▂▆  ▄▅  ▇▃       │ ▃▅  ▃▄      │ │
│ │ Vermilion Sunshine Johnston …  (one highlight word per day, truncated)                │ │
│ │ ●    ●◌   ·    │ ●             │ ●   ·   ◌   ●          │ ●◌  ●◌  ◌   ·        │ ◌   ·       │ │
│ └ ■ driving ■ walking ● fixed slot · Light: sunrise 07:05–07:25, sunset 20:16–19:45 · Move days 3, 4, 8, 12 ┘ │
│ DAY BY DAY   [By day│By category]      Stays 5  Trails 33  Sights 28  Activities 15  Food 0  Logistics 15 │
│ Suggested times  ■ fixed slot  ◎ sun  ○ suggested                                        │
│ ┌ day card 680 ──────────────────────────────────┐ ┌ map, sticky, fluid ───────────────┐ │
│ │ [thumb] DAY 01  Banff · night 1 of 2  ☼ 07:05 → 20:16  [Family version ⌄] │ │ [All 14 days│Day 1│Bases]   + − │ │
│ │         Toronto to Banff, then the first evening flat     │ │ DAY 1 Calgary → Banff · follows your scroll │
│ │         🚗 2 h 05 driving · 1.9 km walking · Family day   │ │                                  │ │
│ │ 10:40 ○ ✈ Land at Calgary, YYC  [2029 schedules not out]  │ │        ②Banff                     │ │
│ │          from Toronto, about 4 h 15 in the air            │ │          ╲ amber route            │ │
│ │ 11:30 ○ ⚿ Collect the car and bear spray  50 min          │ │           ╲                       │ │
│ │          ⌄ Know before you go · 2                         │ │            ①YYC                   │ │
│ │       ┆  🚗 Drive 1 h 30 · 128 km via Trans-Canada Hwy 1 estimated │ │ legend · attribution     │ │
│ │ 13:30 ∘ 🍴 Lunch in Canmore  Main Street, 45 min          │ └──────────────────────────────────┘ │
│ │       ┆  🚗 Drive 25 min · 26 km via Hwy 1 into Banff     │                                        │
│ │ 14:45 ○ 🛏 Check in, Banff  [stay to choose]  2 nights    │                                        │
│ │ 15:15 ∘ ⌂ Rest at the hotel  the child's body clock is 2 h ahead │                                 │
│ │ 16:30 ○ 🥾 Fenland Loop  1.9 km · 20 m up · 45 min · flat │                                        │
│ │ 18:00 ∘ 🍴 Early dinner, Banff Avenue                      │                                        │
│ │       ┆  🚗 Drive 10 min · 5 km via Vermilion Lakes Rd    │                                        │
│ │ 19:15 ◎ 👁 Vermilion Lakes Drive  the last hour before sunset │                                    │
│ │ 20:16 ☼ Sunset · about 20:16 in this window               │                                        │
│ │ 20:45 ○ ⌖ Back at base, Banff                             │                                        │
│ │          ┌ + Add a stop, meal or break to this day ┐      │                                        │
│ │ [⚑ Know before you go · 4] [Copy link to this day] [Open on the map] │                             │
│ └──────────────────────────────────────────────────┘                                        │
│ ┌ DAY 02 … ┐  ┌ DAY 03 … ┐  …  ┌ DAY 14 … ┐                                              │
│ [Copy to my trips] [Export PDF] [Calendar (.ics)]  credits                                 │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 The party profile selector ("Plan it for")

A card (`--surface`, 1 px `--line`, radius 12, padding 18 22) directly under the glance strip. Title
`--t-section` "PLAN IT FOR" with a serif 15.5 `--muted` line "One choice for the whole trip. Any day can
still be changed on its own." Three fields in a row on desktop (1.4fr 1fr 1fr) and a primary button:

| Field | Control | Values | Sub-line (serif 12.5 mono, `--muted`) |
|---|---|---|---|
| Who is going | segmented control (2.9), 40 px | Adults only · Family | "Adults' days: the longer hikes (10 to 14 km), early starts, no rest block." / "Family days: walks under about 6 km, catwalks and bridges fenced, a rest after lunch." |
| youngest | stepper beside Family: "youngest − 6 +", mono 13, 40 px, 30 px hit buttons padded to 44 | 0 to 17; disabled at 45% when Adults only | none |
| Days | segmented control | the published length first ("14 nights"), then each published option ("16 nights") | "As published. 16 nights adds Waterton Lakes." |
| Pace | segmented control | Relaxed · Standard · Full (the spec's names; they drive the rules in features/trip-timeline.md 2.4) | "Relaxed: lifts, boardwalks and hot springs; walks under 2 km; start 08:30." / "Standard: one main outing a day, back at base before dinner." / "Full: the longest option every day; start 07:00, dinner late." |
| More | a 30 px ghost "More" that reveals a second row | Adults (1 · 2 or more) · Longest walk (Any · 5 · 8 · 12 km) · "Split when the plan allows" switch, only on trips with parallel variants | one mono line each; hidden by default because 90% of readers never need them |
| action | primary button "Copy with these choices" | | opens the copy sheet (patterns 3.7) with the profile pre-filled |

Footer line (hairline above): `--t-section` amber-text count "14" + mono "of 14 days fit", then
"≈ 48 km walking", "≈ 23 h driving", "6 fixed slots", and a notice chip (`--info-soft`) that states
whose plan is showing: "Showing the plan as written: families with a child from about 6" or, after a change,
"Re-laid for your choice; the plan was written for families with a child from about 6".

Behaviour.
- The page loads with the **author's profile** selected and labelled as such. A read-only page must show
  content without a form, so nothing is blank; the label makes the preselection honest. (This is the one
  place the "nothing preselected" rule does not apply; it is a reading default, not a generation choice.)
- Changing any field re-renders every day (section 7 motion), updates the sticky plan bar line, the
  footer totals, the trip strip bars and the map. Per-day overrides are cleared when Who or Pace changes,
  with a toast "Day 2 reset to the new profile · Undo" when any existed.
- The choice is written to the URL with the spec's codec (features/trip-timeline.md 3.8):
  `?p=family-6&pace=relaxed&d=2C&add=5.pyramid-lake` (defaults omitted) so a shared link opens the same
  rendering; Back restores the previous profile.
- "Days fit" counts days whose selected variant fits the party (spec 3.3); a day with no fitting variant
  renders its easiest variant with the warning chip "Not suited to a 3 year old" and a first row that
  says why with numbers (spec 3.5). A day with no adults-only variant on an Adults profile shows the
  family version and a notice banner inside the card ("No adults-only option on this day: an arrival day
  after a 4 h flight. Showing the family plan.").
- The variant per day comes from `selectVariant` (spec 3.3); the mock uses a stand-in mapping (Relaxed →
  C; Adults only → A, fallback B; Family → B). The reason is shown on the day's variant chip, never the
  rule.
- Keyboard: each segmented control is a radiogroup; the stepper is two buttons with `aria-label`
  "Younger" and "Older" and a live region "youngest 7".

Phone: fields stack; each segmented control is full width; the stepper sits under Family; the footer
stats wrap to two lines and the notice chip wraps (chips may wrap only here).

### 3.3 The trip at a glance (whole-trip timeline)

A card with two grids of 14 equal columns (gap 4), horizontally scrollable below 1024 px.

- **Base brackets** (top): one cell per base spanning its days, 2 px `--line-2` top rule, name in
  `--t-sign-s` upper case, nights in mono 12.5 `--muted`. A base that is returned to (Lake Louise twice)
  appears twice; that is the truth of the route.
- **Day cells**: `--t-sign` number (01 to 14); a 28 px bar well with two bars, driving (`--ink` at 85%)
  and walking (`--line-2`), heights proportional to the day's share of the trip maximum; one highlight in
  serif 14.5/600 truncated with ellipsis and a `title` ("Johnston Canyon"); a pin row with an 8 px filled
  dot for a fixed slot and a dashed ring for a day with an adults-only split option.
- The cell for the day in view has a 1 px `--accent` border and `--accent-soft` fill (scroll spy). Hover
  `--surface-2`. Click scrolls to `#day-N`.
- Footer: legend, "Light: sunrise 07:05 to 07:25 · sunset 20:16 to 19:45 across the window" (computed from
  `core/src/sun` for the season range, never typed), "Move days: 3, 4, 8, 12".
- A move day draws a 1 px `--line-2` separator before the cell in the sticky rail (and the base bracket
  edge here).

Why a strip and not a Gantt: the reader's question is "what kind of day is each day"; two bars and one
word per day answer it in 14 glances, and the strip doubles as navigation. A horizontal Gantt of items
would need scroll on every width and would duplicate the day timelines.

### 3.4 The sticky plan bar

From the top of "Plan it for" downwards, a 52 px bar (`--bg`, hairline below, `--z-sticky`, under the
60 px header): "Planned for **Family, youngest 6 · 14 nights · Standard** Change" (mono 12.5; Change is
`--accent-text` underlined and scrolls to the selector), the **day rail** (14 cells, `--t-sign-s` number
with a 3 px bar under it whose width encodes drive load, 44 px min, radius 8; the day in view is
`--accent` with `--accent-ink`), and the **unit switch** (small segmented km | mi, desktop only; on phone
the unit follows the device locale and is changeable in the selector card).

Phone: 56 px header, then the bar wraps to two rows (profile line 28 px with Change at the right, rail 36 px
cells, snap-x), total about 88 px. This is the one-hand day switcher: the thumb reaches it at the top
with the phone held low, and the "Map · Day 1" pill floats above the bottom bar for the other reach.

## 4. The per-day timeline

### 4.1 Day card

`--surface`, 1 px `--line`, radius 12, `scroll-margin-top` 124 (header + bar). The day in view gets a 1 px
`--accent` border plus a 1 px `--accent` shadow ring (2 px visual) and its DAY sign turns `--accent`
(the only amber at rest on the page apart from the primary button; it means "now", the day you are
reading).

Header grid 96 px thumb · content · actions:
- thumb 96 x 68 radius 8 (72 x 52 on phone), or the kind glyph on `--well` when no photo;
- meta row: DAY sign (`--t-sign-s`, quiet `--surface-2`), "Banff · night 1 of 2", "☼ 07:05 → 20:16"
  (sunrise and sunset for the season window, from `core/src/sun`);
- title `--t-card` (24; 21 on phone), two lines max;
- totals row mono 12.5 `--ink-2`: "🚗 2 h 05 driving" (dotted underline and `title` when any leg is an
  estimate) · "1.9 km walking" or "no walking" · "2 fixed slots" (omitted at zero) · "1 warning" in
  `--warn` when the scheduler raised any (spec 2.11), omitted at zero;
- actions: the **variant chip** (small secondary button with a chevron: "Family version", "Adults' hike",
  "Easy version"; its `title` and tooltip give the reason, "fits a 6 year old") which is also the per-day
  override menu (4.6), and, when overridden, the chip "Changed for this day · Reset" in `--accent-soft`.

### 4.2 Time rail and entries

Grid **50 px time · 24 px node · content** (44 · 24 · content on phone), 14 px gaps, a 2 px `--line`
rail behind the node column from the first to the last entry. Entry padding 9 px vertical; quiet entries
(meal, snack, rest) 6 px.

| Part | Spec |
|---|---|
| time | `--t-time` mono 13.5/600 right-aligned; `--ink` for fixed and anchored, `--muted` 500 for suggested. No "~" prefix: on a realistic day four entries in five are suggested, so the tilde would mark the rule and not the exception; the weight and node carry it, and the "Suggested times" banner says it once (a deliberate difference from spec 1.3; section 9) |
| node | 12 px: suggested = ring 2 px `--line-2` on `--surface`; fixed = filled `--ink` square radius 3; anchored (sun) = ring `--accent-text` on `--accent-soft`; quiet entries = 8 px ring |
| source label | fixed entries carry the word **Slot** (or "Last ride up", "Departure") in mono 12.5 `--ink-2` as the first meta item; expanded, every entry shows the time's source ("From the plan", "Operator timetable", "Our rule for a lake viewpoint: 45 min") and the duration's basis, as spec 1.3 and 2.12 |
| warning | a `--warn` triangle and one line under the entry ("Arrives 10:10 for the 10:00 cruise"), as components 4.3; never a fill |
| kind glyph | 26 px on `--well` radius 8 (components 3.2); quiet entries draw the glyph bare in `--muted` |
| title | `--t-title` serif 17/600; a place with a page is a link with a 1 px `--line-2` underline; quiet entries serif 16/400 `--ink-2` |
| duration | mono 12.5 `--muted` after the title when the entry has one and no end time ("50 min") |
| chips | after the title: honesty (dashed `--crit`), idea ("stay to choose", dashed `--line-2`), "To book" (neutral outline, ticket) |
| meta | mono 12.5 `--muted`, " · " separated: for a trail distance · climb · time · character ("flat", "catwalks"); for a sight hours and best light; for an activity duration · price with its year · child rule; for a stay nights · status |
| note | one italic serif 15.5 `--ink-2` sentence, the why |
| Know before you go | a 28 px ghost button "⌄ Know before you go · 2" that reveals a `--well` panel of bullets (4.5) |

Entry kinds (spec 1.1; durations come from the spec's rule table 2.3, never from this page) and their glyph:

| Kind | Glyph | How it reads |
|---|---|---|
| start (`leave-base`, `leave-home`, `land`, `wake`) | key; plane for `land` | "Leave Banff", "Land at Calgary, YYC" |
| leg (drive, walk, shuttle, bus, train, ferry, boat, lift, flight) | car; walker; bus; train; boat; lift; plane | a connector, not an entry (4.3) |
| visit (sight, viewpoint, lake, waterfall, town, activity, lift-ride, hot-spring, scenic-drive) | eye; bolt for activity; lift for lift-ride; boat for a cruise | hours, best light, price with its year, child rule |
| trail (hike, walk, bike, paddle, via-ferrata) | walker | distance · climb · time · character |
| meal (breakfast, lunch, dinner; sit-down, picnic, on-trail, at-base) | fork | quiet row; a named eatery links to Food; on-trail lunch is drawn inside the trail entry as its last meta item |
| break (coffee, snack, fuel, leg-stretch, groceries) | cup; fuel pump for fuel | quiet row; a break inside a drive splits the leg |
| rest (free-time, at-base, downtime) | house | quiet row, shown when over 20 min |
| checkin, checkout | bed | nights · stay status; "Check out, Banff" |
| booking (slot, timed-entry, day-use-permit, departure, meeting-point) | ticket | fixed node, "Slot" label; "opens 30 days before Day 3 at 08:00 local" |
| sun (sunrise, golden-am, golden-pm, sunset, civil-dusk, no-sunset) | sun or sunset glyph | a one-line row (4.4) |
| end (at-base, at-next-base, at-airport, at-home) | pin | "Back at base, Banff"; `at-home` with a home-by shows the window |
| zone change marker | clock | a zero-height row "Clocks go back 1 h (Pacific time)" in mono 12.5 `--muted` |

### 4.3 Legs

Between two entries a **leg row** uses the same grid: empty time cell, a 34 px dashed 2 px `--line-2`
segment in the node column (dotted for walking legs), and a mono 12.5 `--muted` label "🚗 Drive **1 h 30**
· 128 km via Trans-Canada Hwy 1 estimated". The duration is 500 `--ink-2`; "estimated" has a dotted
underline and a `title` ("A straight line scaled to a road time; road routing comes later") and comes
from `driveIsEstimate`, never from text. "back to Banff" replaces "via" when the leg returns to base. A
walking leg under 15 min is folded into the next entry's meta ("5 min from the lot"); longer walking legs
are legs. The map draws the leg of the hovered row in amber (section 6).

Realism rule: an entry's start time = previous end + leg duration, rounded to 5 minutes; a conflict with
a fixed slot ("arrives 9 min after the 14:00 sailing") renders a `--warn` line under the leg, as components
4.3. The author's times are kept when present; computed times fill the gaps and are marked suggested.

### 4.4 Sun anchors

Sunrise and sunset are rows of their own: time `--ink` 600 (the window's midpoint), the sun glyph in
`--accent-text` in the node column, label "Sunset · about 19:55 to 20:30 in this window" (the range across
the season window, spec D7 and 2.8; the mock shows a single value and must gain the range). Sunrise is
shown only when an entry starts within an hour of it (a dawn lake) or the day's span includes it;
otherwise it stays in the header. An entry whose time is tied to the sun ("the last hour before sunset")
is **anchored**: amber ring node, `--ink` time written "about 19:15"; hover or expand shows "sunset −60
min · 18:55 to 19:30 in this window". In a dated copy these recompute first. Polar days draw one
"No sunset" row and no daylight warnings.

### 4.5 Visible at rest, visible on expand

At rest a day shows every entry's time, node, glyph, title, chips, meta and the one-sentence note, every
leg, and the sun row. Nothing timed is ever hidden: the day must read as a day. What expands:

- **Know before you go** on an entry: provenance-free bullets specific to that stop (parking, what to
  carry, a closure pattern, a child rule). Button → `--well` panel, 200 ms rise and fade.
- **Know before you go** on the day (footer): the day's decision rule, wet-weather swap, safety notes and
  the "2026 pattern" caveats, as bullets; the count sits on the button. The old prose paragraph is split
  into these two lists by the LD rewrite; a sentence that is only provenance ("INFERENCE", "CALC") is
  dropped and its fact becomes the chip.
- The **season band** on phone: 12-month strip and weather behind "Why this window".
- On phone, **days other than the one in view** are not collapsed: the page is one long timeline. The
  sticky rail is the navigation. (Collapsing days on phone was considered and rejected: the owner's
  requirement is that the timeline stays, and a rail of 14 numbers covers the jump.)

Day footer: "⚑ Know before you go · 4", "Copy link to this day", "Open on the map" (phone: opens the
map sheet on that day). 30 px secondary buttons.

### 4.6 Per-day override and "add to this day"

- The **variant chip** in the day header is a menu (components 5.2): "Family version · chosen for your
  party" (checked) · "Easy version" · "Adults' hike", each with a one-line consequence ("13.4 km · 5 to 6 h
  · collect at 13:30") and a `--warn` note when it does not fit. Picking re-renders that day only (motion
  7); the header gains "Changed for this day · Reset" in `--accent-soft` (an active-filter look, because it
  is a filter on the profile); the sticky line counts changes ("2 days changed"). The URL gains `d=3C`.
- **+ Add a stop, meal or break to this day**: a dashed 40 px row at the end of the timeline, indented to
  the content column. It opens "Add to Day 3": a search field over the spec's candidate set (items from the
  day's other variants, the trip's places at this base, catalog places within 30 km with a page; no free
  text) and three quick chips Coffee · Lunch · Rest. The scheduler inserts the item by cheapest insertion
  (spec 2.9) and the day re-flows in place with the **diff marked**: the new entry carries the chip "You
  added this" and the dashed idea border, moved entries show a mono 12 `--muted` "moved 40 min later" after
  their time for one viewing, new warnings appear on their entries, and a `--warn` line in the day header
  gives the numbers when the cap is passed ("Day 5 is now 11 h 20, 1 h 20 over a standard family day.
  Optional: Moose Lake Loop."). Each added entry has a Remove action in its expanded state. Additions live
  in the URL (`add=5.pyramid-lake`), so a shared link reproduces the day, and they travel into the copy.
  This satisfies "sometimes a person wants three things on one day" without turning the public page into
  an editor.

### 4.7 Split days: two lanes

Rockies days where one adult hikes while the family does the easier version (spec D6, 6). On a Family
profile with two adults the day shows the family lane as the timeline and, directly under the header, a
**split option row**: `--surface-2`, radius 8, the walker glyph, "Split option: one adult can walk Bald
Hills (10.4 km · 4 h 30) and rejoin at 14:00 at the boathouse car park", and a small secondary button
"Show both lanes" (`split=1`). With both lanes shown, the timeline becomes two columns on desktop
(the party's lane left at 1fr, the adult's lane right at 1fr, one shared time rail at the left; shared
entries such as "Together again at 14:00" span both columns on a `--surface-2` band). On phone the lanes
stack: the family lane first, then a lane heading "One adult: Bald Hills" and the second lane, with the
rejoin band between them. Lane headings are `--t-sign-s`. Nothing in a lane is amber; the rejoin band's
time is `--ink` 600 because it is pinned. On an Adults profile lane A is the whole day and no split row
appears; with one adult no split is offered.

## 5. Copy, units and honesty

- One unit system per page. All distances and climbs are stored in metric and formatted at render;
  notes never contain units typed by hand (the LD rewrite moves "1.9 km, 20 m, 45 min" out of prose and
  into `stats`). The switch is km | mi; feet follow miles.
- Research markers never render. `INFERENCE`, `CALC`, `GAP`, "low confidence" become: an honesty chip on
  the entry ("2029 schedules not out", "price not found", "family loop distance missing"), "estimated" on
  a leg, or nothing when the fact is not shown. The page header line "Suggested times" and the credits line
  carry the general caveat once.
- Dates never appear (public-trips-dateless.md). "Opens 30 days before Day 3 at 08:00 local" is the
  booking rule; prices carry their year ("EUR 40 per car, 2026 price").
- The banner above the first day (spec 2.12), once, as a notice banner (components 5.4): "**Suggested
  times.** Built from the plan and our rules for your party. Times marked Slot are fixed by the operator;
  sun times are a range for the season. Check opening hours before you go." Summary trips add "This plan
  was condensed, so most times are suggested by our rules." The mock shows the short legend form; the
  built page uses the banner on first view and the legend after it has been dismissed once (stored on the
  device).
- Honesty chips follow spec 5.1: Estimate, Not known yet, Sources disagree, Low confidence, 2026 pattern;
  a chip sits on the entry it came from, or at the end of its Know before you go bullet.
- Labels: "Suggested times" (never "Approximate" or "Estimated schedule"); "Know before you go" (never
  "Notes" or "Warnings"); "Plan it for" (never "Profile" or "Settings"); "Changed for this day" (never
  "Override").

## 6. Map in sync

Desktop and tablet: the map is a sticky right column (`top` 124 px, 560 px tall, components 7.1) beside
the day list. A scroll spy (IntersectionObserver, root margin -30% 0 -55%) sets the day in view; the map
fits that day's bounds (600 to 900 ms by distance), its route turns `--map-route-pick` (amber with ink
casing) while other days dim to 28%, its stops become numbered ink pins, its base the amber signpost. The
map's segmented control reads "All 14 days · Day 2 · Bases" and the label block "DAY 2 · Banff · Sunshine ·
Minnewanka · follows your scroll". Hovering or focusing a timeline entry rings its pin (2 px amber ring)
and draws the leg before it in amber; hovering a pin highlights the row (`--surface-2`). Clicking a pin
scrolls the row into view. "All 14 days" pauses following until the reader picks a day again.

Phone: a floating pill "Map · Day 1" (`--toast-bg`, 44 px, above the bottom bar) opens the bottom sheet
(5.5) at half height with the same map for the day in view; the sheet's peek shows the day's route strip
and base names. The pill's label follows the scroll spy.

The legend keeps "Lines are straight estimates between stops; road routes come later" until routing lands.

## 7. Motion and interaction

| Moment | What moves | Duration, curve | Reduced motion |
|---|---|---|---|
| Change Who, Days or Pace | the selected segment fill slides; day cards cross-fade to the new entries (old fades out 120 ms, new fades in 200 ms, 20 ms stagger per day up to 5); totals count; trip-strip bars resize; the sticky line updates | 200 ms `--e-std`, counts 300 ms | one 120 ms fade, no stagger, bars jump |
| Add to this day | the new entry slides into its slot (layout animation); moved entries slide to their new times; the "moved 40 min later" notes fade in, then out after 6 s | spring 520/40, notes 200 ms | fade; notes stay until the next change |
| Show both lanes | the second lane grows from 0 width (desktop) or height (phone); the shared rail stays put | 260 ms `--e-out` | fade |
| Stepper + or − | the number flips (translateY 6 px fade) and days re-render as above | 120 ms | fade |
| Per-day override | that card's timeline cross-fades; the override chip rises in | 200 ms `--e-out` | fade |
| Know before you go (entry or day) | panel height from 0, 4 px rise, chevron rotates 180° | 200 ms `--e-out`; close 160 ms `--e-in` | fade 120 ms |
| Scroll spy | the day in view gains the amber border and sign; the rail cell and strip cell switch; the map flies | border 200 ms; fly 600 to 900 ms | border swap, map jump |
| Rail or strip click | smooth scroll to `#day-N` | native smooth | instant |
| Hover an entry | the pin ring 120 ms; the leg before it turns amber 200 ms | | ring only |
| Map sheet (phone) | bottom sheet slides up to half; the pill fades out while the sheet is above half | 260 / 200 ms | fade |
| Add to this day | the dashed row becomes the add sheet (phone) or a popover (desktop) | 200 ms | fade |
| Unit switch | numbers swap in place; no layout animation | none | none |

Never animated: text colour on honesty chips, the trip bar, the day rail's bar widths after first paint.
Everything is interruptible.

## 8. Phone, tablet, desktop, print

- **Phone (< 640)**: one column; cover 420; glance 2 x 2; selector stacked; two-row sticky bar (profile
  line + rail); trip-at-a-glance scrolls sideways inside its card (860 px inner width) with the bases row
  scrolling with it; day cards full width; time rail 44 px; legs wrap to two lines with the car glyph on
  the first; footer buttons stack; the map is the sheet. Touch targets 44 px (rail cells 48 x 36 with
  padding to 44, stepper buttons 30 px drawn in a 44 px hit area).
- **Tablet (640 to 1023)**: selector 2 x 2; the map sits above the day list (order -1) at 360 px and is not
  sticky; otherwise desktop.
- **Desktop (≥ 1024)**: as the wireframe; the day column is 680 max, the map takes the rest (≥ 360).
- **Print and PDF** (the Export PDF uses the same stylesheet with `@media print`): the sticky bar, map,
  dev pill, add rows and footer buttons are hidden; the selector prints as one line "Planned for Family,
  youngest 6 · 14 nights · Standard"; each day starts on a new page with its header and timeline; Know before
  you go panels print open; the trip-at-a-glance strip prints at full width in landscape and wraps to two
  rows of 7 in portrait; colours drop to ink and `--line-2` except the honesty chips, which keep their
  dashed border; links print their URL after the text for place pages only.

## 9. Empty and partial states, and what the data model must provide

- **Overview trips** (`depth === 'overview'`): no selector and no strip; the notice banner "This plan has
  not been converted to days yet" stays, followed by the season band and the category counts if any.
- **Summary trips** (`depth === 'summary'`): the selector shows only the fields the data has (often none;
  the card then collapses to the author line "Planned for adults, 14 nights"); days render entries without
  times in **block order** with the labels Morning · Afternoon · Evening in the time column (the Lonely
  Planet fallback) and no legs; the honesty chip "condensed plan" sits in the header.
- **A day with no entries**: the empty state "No stops are planned for this day yet" with the glyph on a
  `--well` disc (components 6.1).
- **A day with entries but no times**: block labels as above; the day totals show what can be summed.
- **Missing distance or duration**: the meta says "distance not set yet" with the honesty chip; totals
  exclude it and the header's walking figure gets "≈".
- **No photo**: the kind glyph thumb.

**Alignment with features/trip-timeline.md (read 18 Oct 2026).** The spec supplies everything this
design renders: `TimelineEntry` (kind, sub, start, durationMin, end, `time.confidence`, `time.source`,
anchor with its range, window, leg with basis, stats, optional, addedBy, honesty), `DayTimeline`
(variant with its reason, lanes, span, totals, warnings, fits), the profile codec and URL keys, the
cleaned prose with quantity tokens, and Know before you go split into day and entry bullets by group
(Book · Getting there · With kids · Conditions · Decide on the day · If it rains · Other; three shown,
"More" for the rest). The design renders those groups as bold lead words on the bullets. Three places
where this page renders the spec's wording differently, on purpose, for the owner to confirm:

1. **No "~" on suggested times** (spec 1.3 writes "~11:45"). Reason in 4.2: most times are suggested, so
   the tilde would be everywhere; weight, node and the banner carry the meaning. If the owner prefers the
   tilde, it is one CSS `::before`.
2. **Selector above the season band** (spec 3.1 says under it). Reason: the owner's "the choice comes
   first, at the top"; the band is context, the choice shapes the content.
3. **Phone selector stays expanded** (spec 3.1 collapses it to a line plus Edit). Reason: the 90% reader
   should see what the plan is for without a tap; the sticky bar is the compressed form from then on.
   "More" controls are collapsed on every width.

## 10. Changes to foundation patterns 3.4

1. New item 2, **Plan it for**, between the glance strip and the season band; the per-day A, B, C
   segmented control is removed from day rows.
2. New **sticky plan bar** (profile line, day rail, units) from the selector down; on phone it replaces
   the non-sticky category strip as the By day navigation (the category strip stays sticky in By category
   as written).
3. **The route** section becomes **The trip at a glance** (the strip) and the map moves into a sticky
   column beside the days (desktop) or a bottom sheet (phone).
4. Day rows become **day cards with per-day timelines**: time rail, typed entries, legs, sun rows, Know
   before you go; "expandable to its stops" is replaced by "always shows its timeline; details expand".
5. Category rows keep "Day 3 · 11:30" and gain the confidence styling of the time.
6. Tokens: no new colour. New type use: `--t-time` on the rail (already defined). New components for
   components.md: Party profile selector (2.11), Day rail (1.6), Trip strip (4.6), Timeline entry and Leg
   (replaces 4.3's planner-only row with a shared anatomy), Sun row, Add row. Chips may wrap only inside
   the selector footer on phone (an exception to "mono never wraps", recorded here).

## 11. Acceptance checks

Measurable by a builder and a verifier on the built page at 1440 x 900 and 390 x 844, light and dark.

1. No page text contains "INFERENCE", "CALC", "GAP", "(low confidence)" or a four-digit year in a date
   position; a grep of the rendered HTML for `\((INFERENCE|CALC|GAP)` returns nothing.
2. Every day card has a time rail: at least one entry with a time, every drive between two placed stops
   drawn as a leg with duration and distance, and the sunset row; the first and last entries are start and
   end types.
3. Each day header shows driving total, walking total (or "no walking"), fixed-slot count when > 0, the
   track word, and sunrise → sunset.
4. Times: fixed entries have the filled square node and `--ink` time; anchored entries the amber ring;
   suggested entries the `--line-2` ring and `--muted` time; the legend "Suggested times" is above the
   first day.
5. The profile selector exists once, above the season band; no day row contains an A, B, C control.
   Changing Pace to Relaxed changes Day 1's title and entries without a page reload; the URL gains
   `?pace=relaxed`; reload reproduces the rendering; Back restores Standard.
6. The variant chip on Day 2 opens a menu; picking "Easy version" changes Day 2 only; "Changed for this
   day · Reset" appears; Reset clears it; the URL gains and loses `d=2C`.
6a. On Rockies Day 5 with the default profile, a split option row names the adult's hike and the rejoin
   time; "Show both lanes" draws two lanes with one shared rail and the "Together again" band; on phone
   the lanes stack.
6b. Adding Pyramid Lake to Day 5 inserts it at the cheapest slot, marks it "You added this", shows which
   entries moved and by how much, and writes `add=5.pyramid-lake`; Remove undoes it.
7. Units: with mi selected, no "km" or "m up" string remains in the day list; with km, no "mi" or "ft".
8. The sticky bar is visible at every scroll position below the selector at both widths; the day in view
   is `--accent` in the rail, the strip cell has the amber border, and the map's label names the same day
   (desktop); on phone the pill reads "Map · Day N" for the same N.
9. Phone: no horizontal page scroll (document width = 390); rail cells ≥ 44 px hit; the "Add" row and
   footer buttons ≥ 44 px; the bottom bar and the map pill never overlap text that is being read for more
   than one line (the pill sits above the bar, under the last 100 px).
10. Contrast: every text pair is one from tokens.md 2.2. Pairs this design relies on: `--muted` on
    `--surface` 6.94 / 7.45, `--ink-2` on `--surface` 12.09 / 10.76, `--accent-text` on `--surface` 6.33 /
    7.99, `--accent-text` on `--accent-soft` 5.56 / 7.26, `--crit` on `--surface` 6.61 / 7.01, `--info` on
    `--info-soft` 5.91 / 7.61, `--accent-ink` on `--accent` 6.96; the amber ring node on `--surface` is UI
    (3:1 required): `--accent-text` on `--surface` 6.33 passes.
11. Reduced motion: with `prefers-reduced-motion: reduce`, a profile change completes in one fade and the
    map jumps; no stagger.
12. Keyboard: Tab reaches the selector controls, the rail cells, every entry's place link and Know before
    you go button, the add row and the footer buttons in reading order; arrow keys move within each
    segmented control; the focus ring is visible on the amber rail cell (ink ring, 6.38:1).
13. Print: each day starts on a new page; no sticky bar, map or add row; Know before you go panels open.
14. Thin data: a summary trip renders block labels (Morning · Afternoon · Evening) in the time column and
    no legs; an overview trip renders no selector and no strip.
15. Screen reader: the timeline is an `<ol>` with each entry an `<li>` whose accessible name reads
    "16:30, suggested, trail, Fenland Loop, 1.9 km, 20 m up, 45 min, flat"; legs read "Drive 1 h 30,
    128 km via Trans-Canada Highway 1, estimated"; the day in view is announced once on change via a
    polite live region ("Day 2 in view").

## 12. Mock

[mock/index.html](mock/index.html) is a static page on Trailhead tokens with real Rockies Days 1 to 3 and
Dolomites Day 3 (San Candido base, Tre Cime). Query keys: `?theme=dark`, `?p=adults|easy|dolo`,
`?units=mi`, `?open=1` (opens one Know before you go panel and the Day 1 footer), `?nodev` (hides the
switcher pill). The pill at the bottom right switches theme and profile live. Times in the mock were
authored from the plan's facts (gondola opens 08:00, Minnewanka sailings 10:00 to 18:00, sunset 20:16,
Johnston Canyon by 08:00 to beat the crowds); the data model will compute them.

Screenshots (2x, downscaled to 1x) in [mock/shots/](mock/shots/): `before-*` (today's page),
`desktop-light-top`, `desktop-light-day1`, `desktop-light-day2-sticky-map`, `desktop-dark-day1`,
`desktop-adults-profile` (the Adults profile with Day 1's fallback notice), `desktop-dolomites-day3`,
`phone-light-top`, `phone-light-day1-sticky` (the two-row sticky bar), `phone-light-day1-timeline`,
`phone-dark-day1`, `phone-easy-profile`.

Rendering check, 18 Oct 2026: Chromium 1248 on the Arc GPU (`--use-gl=angle --use-angle=gl`), 1440 and
390 at 2x, light and dark. Fixed during the check: a non-wrapping chip made the phone page 439 px wide
(chips now wrap only in the selector footer); leg glyphs wrapped onto their own line on phone (the leg
label is now a two-column flex); "via back to Banff" read badly (returns to base drop "via"); "0 km walking"
became "no walking".

## 13. Questions for the owner

1. The page opens on the author's profile, labelled "Showing the plan as Nitin wrote it". Is that right,
   or should a first-time visitor pick before any day renders? (The spec's open question 1 asks the same;
   both pages recommend the author's profile.)
2. Suggested times: plain lighter weight with the banner saying "Suggested times" once (this page), or a
   "~" before every suggested time (the spec's 1.3)?
3. The selector sits above the season band and stays open on phone (this page); the spec puts it under the
   band and collapses it on phone. Which order and phone treatment?


## Amendment (18 Oct, from design/suitability-display.md)

Suitability chips (kids, effort, limits) lead each entry's chip row and may wrap to two lines on phone. The entry meta line drops its "child rule" text, because the limits chip carries it. Where the two pages differ, design/suitability-display.md wins for suitability chips.
