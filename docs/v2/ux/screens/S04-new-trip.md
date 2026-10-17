# S04. Starting a trip: intent sheet, express path, every trip type

## Purpose
Turn "we want to go somewhere" into a trip with enough intent (where, when, who, style, how) to make
suggestions useful, without a form. Pre-filled from the household so most people change two things.
Covers every trip type: day trip, weekend, vacation, family, couple and romantic, luxury, adventure,
luxury adventure, road trip, camper van, multi-generation, solo, visiting family.

## Entry points
"Plan a trip" (home, trips list, year view with dates); "Day trip from home"; "Start from a template"
(→ S18); command palette "new trip"; an MCP client's `create_trip` (no UI, lands as a draft).

## Wireframes

Desktop: a centred sheet (max 640 px) over the trips list, five steps with a progress rail and a live
fit line at the bottom.

```
┌─────────────────────────────────────────────────────────────┐
│ New trip                                    1 ─ 2 ─ 3 ─ 4 ─ 5 │
│                                                             │
│ Where?                                                      │
│ [ Dolomites                                          ✕ ]    │
│   Suggestions: Val Gardena · Alta Badia · Cortina           │
│ ( ) Not sure yet — compare a few places                     │
│ ( ) Surprise me within [ 5 h ▾ ] of Whitby                  │
│                                                             │
│ What kind of trip?  (pick any)                              │
│ [Vacation][Weekend][Day trip][Road trip][Camper van]        │
│ [Family][Couple · romantic][Friends][Solo][Visiting family] │
│ [Adventure][Luxury][Relax][Culture][Food][Nature]           │
│                                                             │
│ ─────────────────────────────────────────────────────────── │
│ 214 things in the Dolomites · coverage: good                │
│ [ Just start ]                               [ Next → ]     │
└─────────────────────────────────────────────────────────────┘
```

Steps: 1 Where + kind · 2 When · 3 Who · 4 Style · 5 How. Every step has "Skip"; "Just start" is
always visible after step 2.

Step 2 When:

```
│ When?                                                       │
│ (•) Dates      [ Tue 13 Jul 2027 ] → [ Mon 26 Jul ] 13 nights│
│ ( ) A month    [ Jul 2027 ▾ ]  for [ 12–14 ] nights          │
│ ( ) A long weekend  [ Thanksgiving 9–11 Oct ▾ ]              │
│ ( ) Not sure                                                 │
│ ⓘ July: all lifts and high routes open; peak crowds 25 Jul+  │  ← from area_guide season notes
```

Step 3 Who: household people as toggles with age at travel ("Aarav · 12 in Jul 2027"), "+ Guest"
(name + age band). Step 4 Style: vibe chips, activity chips, must-do (search), avoid (chips + free
text; household avoid rules pre-ticked, e.g. "unfenced cliff edges with young kids", "long drives with
no break"). Step 5 How: pace (Slow · Balanced · Packed), walking limit per day (km and gain sliders,
per traveller override), budget band, transport (Car · Transit · Camper · Mixed · Fly + car), base
strategy (one base · move between bases · decide later).

Phone: full-screen steps with a sticky bottom bar (Back · Next) and the fit line above it.

```
┌───────────────────────────┐
│ ✕  New trip        2 of 5 │
│ When?                     │
│ ◉ Dates                   │
│   13 Jul → 26 Jul · 13 n  │
│ ○ A month                 │
│ ○ A long weekend          │
│ ○ Not sure                │
│                           │
│ 214 things fit · good     │
│ [Back]          [Next →]  │
└───────────────────────────┘
```

**Day trip from home** (a separate short path):

```
│ Day trip from Whitby                                       │
│ How far?    [<1 h] [1–2 h] [2–3 h] [3 h+]                  │
│ How long?   [Half day] [Full day] [Sunrise to sunset]      │
│ What?       [Picnic][Active][Scenic][Food][Kids' fun]      │
│ When?       [This Sat 18 Oct ▾]                            │
│ → shortlist of 8, ranked by drive time, each with reason   │
│   Elora Gorge · 1 h 35 · gorge trail + tubing (closed Oct) │
│   [Make this the day]                                      │
```

Choosing one creates a one-day trip with the item, a "Leave by" time from the drive and the opening
hour, and the return drive.

## How trip types change the defaults

| Type | Pre-sets | Asks extra | Leads with |
|---|---|---|---|
| Day trip | scale day_trip, origin = home | radius, half/full day | ranked shortlist |
| Weekend | 2 nights | base town | stays + 6–10 highlights |
| Vacation | scale multi_day | base strategy | area guide and candidates |
| Family | party from household, kid-fit filters on | ages, nap or early bedtime | fit avatars everywhere |
| Couple · romantic | 2 adults | special occasion date | sunset spots, dinners, stays with a view |
| Luxury | budget band high | stay style | stays and experiences first |
| Adventure | pace packed, adventure lane | fitness per person, gear owned | trails, limits, booking windows |
| Luxury adventure | both above | guide vs self-guided | guided activities, comfortable bases |
| Road trip | transport car, move bases | max drive per day, breaks every N h | route legs and stops |
| Camper van | transport camper | 2WD/4WD, campsite-only law | campsites as bases (Iceland pattern) |
| Multi-generation | grandparents as travellers | mobility notes | per-person walking limits, variants |
| Visiting family | custom items first | host address | the host as the base; few catalog suggestions |

## Regions and components
StepRail · DestinationSearch · TripTypeChips · DateRangePicker (dates · month · long weekend) ·
TravellerToggles (FitAvatars) · VibeChips · AvoidChips · PaceSegmented · LimitSlider · FitLine
(live count + coverage) · CoverageWarning.

## Primary action
"Next" per step; "Create trip" on step 5; "Just start" from step 2.

## States
- **Thin coverage**: fit line turns to a warning "We know little about food in El Chaltén yet (thin).
  You can still add your own." with "Request research" (adds to backlog).
- **No household yet**: step 3 asks for people and offers "Save as my household".
- **Signed out**: allowed; the trip is a local draft with a banner "Sign in to keep this".
- **Offline**: creating a trip works (local ids); the fit line shows "Counts when online".
- **Validation**: end date before start date → inline fix "Swap dates".

## Interactions
Enter = Next; Esc closes with "Keep as draft?"; chips toggle with Space; sliders have arrow-key steps.

## Copy
"Aarav is 12 on 13 Jul 2027" (ages at travel). "214 things fit · 61 suit a 12-year-old".

## Accessibility
Each step is a fieldset with a legend; the fit line is a polite live region.

## Data and operations
`create_trip` (scale, dates or window, area, party, prefs) as one operation; `search` counts for the
fit line (debounced 300 ms); household defaults from `household.prefs`.

## Acceptance criteria
1. With a household set, a Dolomites vacation can be created in ≤ 4 taps after typing the place.
2. Every step can be skipped; skipping all of 3–5 gives household defaults.
3. Day trip path produces a one-day trip with a leave-by time in ≤ 5 taps.
4. Ages shown are ages on the trip's dates.

## Share
Not shown during creation; after "Create trip" a toast offers "Invite Priya" (S26, audience people in the trip).
