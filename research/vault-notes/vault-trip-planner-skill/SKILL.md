---
name: trip-planner
description: Interactive, end-to-end trip planning that produces a detailed step-by-step itinerary as an Obsidian vault note plus a sharable Google My Maps file. Asks the traveller's preferences first with selection menus — trip vibe (relaxing, super fun, adventure, nature, food, romantic, family), pace, group, budget, activities — then plans for that profile, since the same place is a different trip for different people. Handles three scales from a saved home base — local day trips and picnics (choosable by driving distance and time), weekend getaways, and multi-day or international vacations. Use when the user wants to plan a trip, choose a destination, set a travel budget, find things to do (hidden gems, must-see spots, nature, relaxing, adventure, food), build a day-by-day itinerary, plan a day trip or picnic from home, or create a sharable map. Triggers on "plan a trip", "where should we go", "day trip", "picnic spot", "weekend getaway", "things to do in X", "itinerary for X", "what to see in X", or "trip budget".
---

# Trip Planner

Plans a trip from a blank slate to a finished, day-by-day itinerary saved as a vault note, with a Google My Maps file the user can import and share. Works at three scales — local day trip, weekend getaway, multi-day trip — all anchored on a saved home base.

## How to use this skill

Work through the phases below. Depth scales with the trip: a day trip is light, a multi-day vacation runs the full process. The full detail for each phase is in `references/workflow.md` — read it before planning anything beyond a simple day trip.

1. **Scope and interactive intake** — Determine the scale, read the home base and defaults, then run a structured intake to capture the traveller's profile. See `references/intake.md`.
2. **Destination selection** — Only if the destination is open. Propose and recommend candidates.
3. **Discovery** — Live web research for places across every requested category, including genuine hidden gems. See `references/discovery.md`.
4. **Budget** — Per-day and total, reconciled against the target. See `references/budget.md`.
5. **Itinerary** — Day-by-day, geographically clustered, realistically paced, with a backup per day.
6. **Maps and outputs** — Generate the My Maps CSV and links, write the vault note(s). See `references/maps.md`.

### Choosing the scale

| Scale | Trigger | How much to do |
|-------|---------|----------------|
| Day trip / picnic | "day trip", "picnic", "somewhere Saturday" | Light: cluster of spots near home, single day, one-line cost |
| Weekend getaway | "weekend", "overnight", "1-2 nights" | Medium: a base + 1.5-2 days, light budget |
| Multi-day / international | "vacation", "road trip", "N days in X" | Full: destination choice, deep research, real budget, routed multi-day plan |

## Be interactive — capture the traveller's profile

The same destination is a different trip for different people, so don't guess preferences — ask. Use the **AskUserQuestion** tool to run a structured intake with selection and multi-select menus: trip vibe (relaxing, super fun, adventure, nature, food, romantic, family), pace, group, budget, and the activities they're into. For local day trips, let the user choose by **driving distance/radius** and time available. Pre-fill from the Preferences note and the request so you only ask what's missing, batch questions into one or two rounds, and offer an express path if they just want it planned. The full question bank, options, and when each applies is in `references/intake.md`. Record the captured profile in the note so the plan is personalized and reusable.

## Home base and defaults (read first)

The skill is anchored on a **Travel Preferences note** at `personal/travel/Travel Preferences.md` holding the home base address and defaults (travellers, budget style, pace, interests, passes held). Read it at the start of every run.

- **If it exists**, use it. The user can then say "plan a day trip this Saturday" with no further setup.
- **If it does not exist**, create it from `assets/travel-preferences-template.md`. Seed the home base from context — the user's day-trip notes use **Whitby, Ontario** — but confirm it with the user before saving.

## Live web research

The user chose live research. For hidden gems, current hours, prices, seasonal events, and pass terms, **search the web** — do not answer from memory; this information drifts. `references/discovery.md` has the query patterns and what to capture per place.

## Generating the map

After the itinerary is set, assemble all places into a JSON file (schema in `scripts/make_maps.py`) and run:

```bash
python3 .claude/skills/trip-planner/scripts/make_maps.py /tmp/<trip-slug>.json --outdir <output-folder>
```

It produces a Google My Maps CSV (pins, color-codable by day) and a markdown file of clickable per-place pins and per-day driving routes. Embed the links in the note and give the user the CSV import steps from `references/maps.md`.

## Saving to the vault

Output is saved as Obsidian vault notes — this is the user's second brain.

- **Multi-day / weekend trips** → `personal/travel/<Destination Trip Name>.md` from `assets/trip-itinerary-template.md`.
- **Day trips** → `personal/travel/<Destination> Day Trip.md` from `assets/day-trip-template.md`, or append to the existing `personal/travel/Day Trips Local.md` if the user prefers one rolling note.

Mandatory for every vault note (a PostToolUse hook validates this and blocks non-compliant writes):

- Start with the frontmatter block. `area: travel`, valid `type` (`project` for an active trip, `resource` for a day-trip reference), valid `status` (`active`), `tags` as a YAML list, and `created`/`modified` set to today's date. Never change an existing `created` date.
- Use `[[wiki-link]]` syntax for internal links — never relative paths. Link the new note from `personal/travel/Plan.md` so it shows in the trip library.
- Match the existing travel-note voice: practical and specific — costs, timing, crowd-avoidance, parking, packing, backup plans, and wind-down spots — not generic listicle filler. Emoji section markers and Obsidian callouts are used throughout the travel folder; match that style there.

## Reference files

- `references/intake.md` — the interactive question bank: vibe, pace, activities, day-trip distance/time, how to run it with AskUserQuestion. Use in Phase 0.
- `references/workflow.md` — full detail on every phase and the three trip scales. Read before non-trivial planning.
- `references/discovery.md` — categories, web-search patterns, finding real hidden gems, what to capture per place.
- `references/budget.md` — budget framework, regional passes (Ontario Parks, Parks Canada), money-saving levers.
- `references/maps.md` — places JSON, running the script, and the My Maps import steps.
