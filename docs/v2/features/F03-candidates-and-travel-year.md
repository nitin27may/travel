# F03. Candidates and the travel year

## Purpose

Two decisions come before any itinerary: **where** (comparing a few destinations) and **when** (which
long weekend, which school break, against a yearly goal and budget). `Plan.md` does both by hand in
tables: "Fall colors trip ideas", "India trip options", "Long weekend opportunities 2026", a yearly
budget. This feature makes those tables live.

## User stories

1. As a parent in January, I want to see 2027's long weekends, school breaks and our planned trips on one timeline, so that I can pick when to go.
2. As a planner, I want to compare Vermont, the White Mountains and the Finger Lakes for a fall trip by drive time, best weeks, cost and fit, so that we choose with numbers.
3. As a family member, I want to vote on candidates, so that the choice is shared.
4. As a household, I want a yearly goal ("1 international + 1 local family holiday") and a budget target, so that I can see whether the year is on track.

## Detailed behaviour

### Candidates

1. A trip in phase `idea` (or any trip) can hold candidates. Add by area search, by free text ("Cape Cod"), or from Explore ("compare as a destination").
2. Each candidate row shows: drive or flight time from home (drive computed from the household base; flight as free text in v1), best time (from the area guide's season data when known, else entered), duration suggestion, rough cost, pros, cons, notes, a vote per member (up, neutral, down), and **how many catalog things fit the party there** ("24 fit, 9 for a 10-year-old").
3. Sorting by any column; a "fit" column computed from coverage and the party.
4. **Choose** sets the trip's area (and dates if the candidate had a date window) and folds the others into a "Considered" section at the bottom of the trip overview. They stay for reference and can be swapped back.
5. Candidates with an area link open the area guide in a sheet.
6. A candidate can carry its own date window ("Columbus Day weekend", "Dec winter break"), which is how the India trip options (July vs November vs December) are modelled: three candidates with the same area and different windows.

### The travel year

7. `/year` shows a horizontal timeline for a calendar year (scrollable to the next): months, public holidays and long weekends for the household's region (reference data), school breaks (entered once per household; Durham District School Board dates for the Singh household), trips as bars coloured by phase, candidates with date windows as dashed bars, and household tasks with due dates (passport renewals).
8. **Goals**: per year, one or more rules ("1 international", "1 local 3-4 days", "a fall colours trip"), each ticked when a trip with a matching tag or scale exists in that year. Budget target with the sum of trips' planned totals and actuals (F10) in the home currency.
9. **Plan from a window**: tapping a long weekend opens the intent sheet with those dates ("Thanksgiving, Sat 10 - Mon 12 Oct").
10. **Conflicts**: two trips overlapping dates show a warning on both bars.
11. Phone: a vertical list by month instead of the horizontal timeline.

## Data touched

`trip_candidate`, `trip` (`date_window`, phase), `travel_goal`, `calendar_window`, `task` (household tasks), `budget_line`, `expense`.

### Schema additions

- `trip_candidate.date_window jsonb` (exact dates or a named window id).
- `trip_candidate.drive_minutes int` (computed, cached) and `fit_count int` (computed on view, not stored, unless slow).
- `travel_goal.match jsonb` (rule: `{scale, tags, international}`) so ticking is automatic.
- `household.school_board text` and household-scoped `calendar_window` rows (kind `school_break`) already supported by `calendar_window.household_id`.

## Operations and MCP tools

Operations: `candidate.add`, `candidate.update`, `candidate.vote`, `candidate.choose`, `candidate.remove`, `goal.set`, `calendar_window.add` (household), `year.read` (query).

MCP: `edit_trip` with `add_candidate`/`choose_candidate`; `list_trips` with a `year` filter; a read `travel_year(year)` returning windows, trips and goals so a chat client can answer "which long weekend is free for a fall trip?".

## Edge cases

- A candidate with no area in the catalog: free-text row, no fit count, "research this" button (F16 backlog, owner only).
- Long weekends differ by province and country; the household region decides; trips abroad show the destination's holidays as a second lane on the trip page, not on the year view.
- Votes from viewers: not allowed; only members with editor role vote.

## Acceptance criteria

1. Three candidates with areas show drive times from home within 5 seconds (cached legs) and a fit count per candidate.
2. Choosing a candidate sets the trip's area, keeps the others under Considered, and is undoable in one step.
3. The 2027 year view shows Canadian statutory holidays for Ontario, the household's school breaks, and all trips with correct bars.
4. A goal "1 international" ticks when a trip with an international destination exists in that year.

## Milestone

Candidates in M2; travel year in M3.

## Open questions

1. Public holiday data source: a maintained open dataset (for example the `date.nager.at` API or a bundled JSON) vs hand-entered. Default: bundled JSON refreshed yearly, Canada and US first.
2. Flight time for candidates abroad: free text in v1, or a rough great-circle estimate? Default: great-circle estimate labelled "approx.".
