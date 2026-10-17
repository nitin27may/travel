# Trip Planning Workflow

Detailed end-to-end process. SKILL.md has the summary; this file has the depth for each phase.

## Contents

- [Phase 0 — Scope and inputs](#phase-0--scope-and-inputs)
- [Phase 1 — Destination selection](#phase-1--destination-selection)
- [Phase 2 — Discovery](#phase-2--discovery)
- [Phase 3 — Budget](#phase-3--budget)
- [Phase 4 — Itinerary](#phase-4--itinerary)
- [Phase 5 — Maps and outputs](#phase-5--maps-and-outputs)
- [Three trip scales](#three-trip-scales)

## Phase 0 — Scope and inputs

First decide the **scale**, because it changes how much of this workflow runs:

| Scale | Trigger phrases | Phases that run |
|-------|-----------------|-----------------|
| Day trip / picnic | "day trip", "picnic", "somewhere this Saturday", "out and back" | 0, 2 (light), 4 (single day), 5 |
| Weekend getaway | "weekend", "long weekend", "1-2 nights", "overnight" | 0, 1 (if no destination), 2, 3, 4, 5 |
| Multi-day trip | "vacation", "road trip", "X days in Y", "holiday" | all phases |

Read the home base and defaults from the **Travel Preferences note** (`personal/travel/Travel Preferences.md`). If it does not exist, create it first (see SKILL.md). Then run the **interactive intake** to capture the traveller's profile with selection menus — see `intake.md` for the full question bank and how to run it with AskUserQuestion. Personalization matters: the same destination is a different trip depending on vibe, pace, group, budget, and activities.

Across intake and any free-text, you need:

- **Origin** — home base for local trips; for destination trips, the departure city/airport
- **Destination** — a place, a region, or "help me choose"
- **Dates / season / duration** — exact dates if known, else season + number of days
- **Travellers** — who, how many, ages (kids change pace, activity choice, drive tolerance)
- **Budget** — total or per-day target, and currency (CAD for local, destination currency for abroad)
- **Vibe / interests** — any mix of: must-see landmarks, hidden gems, nature/scenic, relaxing/slow, adventure, food, culture/history, family-friendly, romantic, photography
- **Constraints** — mobility, dietary, pace (packed vs slow), driving tolerance, no-fly, weather sensitivity, must-include or must-avoid items

Confirm the scope back in one or two sentences before researching, so a wrong assumption doesn't waste a research pass.

## Phase 1 — Destination selection

Only when the destination is open. Propose 3-5 candidates that fit budget, season, travel time from origin, and vibe. For each candidate give a one-line hook, why it fits the dates/season, rough travel time and cost from the origin, and the standout experiences. Score them against the stated priorities and make a clear recommendation with a runner-up — do not just list options. Then confirm before going deep.

Cross-check the existing vault destination list (`personal/travel/Location.md`) and `personal/travel/Plan.md` — the user already tracks bucket-list places, annual goals, and long-weekend slots. Prefer surfacing and advancing those over inventing new ones.

## Phase 2 — Discovery

This is where the trip gets its character. See `discovery.md` for the full category playbook and web-search query patterns. Use **live web research** (the user chose this) — do not rely on memory for hidden gems, seasonal events, hours, or prices, which all drift.

Collect places across every requested category. For each place capture: name, category, one-line why, time needed, cost, best time of day/season, the area/cluster it sits in, and a logistics note (booking required, closed days, height/age limits, weather-dependent, cell-dead zone). Aim wide first, then cut to what fits the days and pace. Always include a few genuine hidden gems, not just the top-10 list every guide repeats.

Capture practical intel the existing vault notes are known for: crowd-avoidance timing, money-saving passes (see `budget.md`), advance-booking deadlines, and wind-down/ice-cream/picnic spots to end the day.

## Phase 3 — Budget

Skip for simple day trips beyond a quick per-day estimate. Otherwise build a real budget — see `budget.md` for the category framework, regional passes, and money-saving levers. Produce a per-day and total figure, reconcile it against the user's stated target, and call out the biggest cost drivers and where to trim if it runs over.

## Phase 4 — Itinerary

Build the day-by-day plan. Rules that make an itinerary actually usable:

- **Cluster geographically.** Group each day's stops by area to minimize backtracking. Order stops as a sensible route, not by priority.
- **Pace realistically.** Account for drive/transit time between stops, meals, and rest. Leave slack. Over-packed days are the most common planning failure — fewer, better stops beat a checklist march, especially with kids.
- **Time each block.** Morning / midday / afternoon / evening, with approximate clock times and the time each stop needs.
- **Sequence by daylight and crowds.** Hit popular spots early; save flexible/indoor options for crowded midday; plan scenic/sunset spots for golden hour.
- **Meals as anchors.** Name specific places where it matters; otherwise note the area to eat in.
- **One backup per day.** A rain plan or indoor alternative — the existing vault notes do this and it matters.
- **End-of-day wind-down.** A relaxed final stop before the drive/walk home.

For multi-day trips, also sort lodging strategy (one base vs. moving), and order the days to flow geographically across the region rather than radiating from one point and doubling back.

## Phase 5 — Maps and outputs

1. Assemble every place into a places JSON (schema in `make_maps.py` header), with `day`, `category`, `cost`, and `address` filled in. Include coordinates when known for reliable pins.
2. Run `scripts/make_maps.py <places.json>` to generate the My Maps CSV and the clickable links file. See `maps.md` for the import steps and link formats.
3. Write the vault note(s) from the templates in `assets/`, embedding the per-place and per-day route links. Save the CSV path in the note so the user can import it.
4. Add the closing sections: packing list (tailored to season + activities), pre-trip booking/checklist with dates, and links back to `personal/travel/Plan.md` and the destination guide.

See SKILL.md "Saving to the vault" for where files go and frontmatter rules.

## Three trip scales

**Day trip / picnic (out and back from home base).** Origin is the home base. Find a cluster of spots within the stated drive radius (default ~1.5-2 hrs), pick a primary anchor plus 2-3 nearby stops and a picnic/wind-down spot, and lay out a single realistic day. Keep budget to a one-line estimate. This is the lightest path — don't over-produce it.

**Weekend getaway (1-2 nights).** Pick or confirm a destination within comfortable range, find one good base to sleep, and plan 1.5-2 days of clustered activities with one nice dinner and a slower morning. Light budget table.

**Multi-day trip.** The full workflow: destination selection if needed, deep discovery, real budget, multi-day routed itinerary with lodging strategy, full packing and booking checklists, and the complete maps output.
