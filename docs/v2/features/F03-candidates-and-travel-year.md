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

### School calendar, weekends and holidays (owner request, 18 Oct 2026; TO DO)

The household enters its school calendar once a year, and the year view uses it to show when the family is free.

1. **School calendar editor** (Settings > Household > School calendar, and inline from the year view):
   - School year from and to (first and last day of classes).
   - Named breaks with from and to dates: Winter break, March break, Thanksgiving, others.
   - PA days (professional activity days, single dates).
   - One calendar per school, so two children at different schools works; each child links to a school.
   - The board's published calendar can be pasted (text or a link to the PDF). The assistant or the MCP reads it into a draft that the parent confirms. Durham District School Board is first.
   - Next year's calendar is copied from this one with the dates left for confirmation, flagged "not confirmed yet".
2. **Public holidays** for the household's region come from reference data (Ontario statutory and civic holidays first). The household can switch individual ones on or off; for example, Civic Holiday is not a day off for everyone.
3. **The household's own days off**: add a holiday or personal day (a family event, a work day off, "Diwali", a day already taken off work). Each is a single date or a range, with a label, and is visible to the household only.
4. **Highlighting on the year view and the date pickers:**
   - Weekends are shaded.
   - Public holidays are marked.
   - **Long weekends** are a weekend joined to a holiday, a PA day or an own day off. They are computed and highlighted, with their length ("4 days: Fri PA day + Sat-Mon Thanksgiving").
   - School breaks are drawn as bands.
   - Trips are bars; a trip's bar turns amber if it overlaps school days and shows "misses N school days".
5. **Free windows**: a "Find time" filter lists every stretch of N or more days off for everyone in the group (school breaks, long weekends, holidays combined), with work days needed if any. Tapping one starts a trip with those dates.
6. **Date pickers everywhere** (new trip, booking forms, public trip "pick your start date") use the same shading, so weekends, long weekends, breaks and PA days are visible while choosing dates.

Data: `calendar_window` rows with kind `school_term`, `school_break`, `pa_day`, `public_holiday`, `own_day_off`; `school` and `child_school` link rows; a computed `long_weekend` view.
MCP: `set_school_calendar`, `add_day_off`, `find_free_windows(year, min_days, people)`.

Acceptance:
- The 2026-27 DDSB calendar (first day, winter break, March break, PA days, last day) can be entered in under 3 minutes or pasted and confirmed.
- The year view shades weekends and highlights every long weekend, including PA-day ones.
- "Find time ≥ 4 days" lists the expected windows.
- A trip over school days shows how many days it misses.

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
