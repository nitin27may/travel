# Public trips are dateless templates (owner, 18 Oct 2026)

Every public trip, past or upcoming, is shown as a template: **Day 1 to Day N, the length and the season it is valid for**, never calendar dates. Dates exist only in a person's own copy in the signed-in planner. The household's own planned trips keep their real dates in the planner. The public page is the template view of the same trip.

## What the public page shows

| Instead of | Show |
|---|---|
| Fri 26 Feb - Thu 11 Mar 2027 | **13 nights · 14 days** and the season band **"Valid late February to mid-March"**, with the reason and a weather card |
| Day 3, Thu 15 Jul | **Day 3** (and "Sunday" nowhere) |
| Booking opens Tue 15 Jun 2027 | **Opens 30 days before Day 3, at 08:00 local** |
| Book by 31 Oct | **Book about 4 months ahead; sells out**, from the booking rule, not a date |
| Thanksgiving weekend, Sat 10 - Mon 12 Oct | **A long weekend in mid-October** (named holidays only as context: "Canadian Thanksgiving fits") |
| Colours peaked 27 Sep 2026 | **Observed: in 2026 colours peaked in late September**, labelled as an observation with its year |
| Market only on Saturdays | A **weekday rule** ("market on Saturdays only") shown as a check that turns into a warning once dates are picked |
| Sunrise 05:31 | **Sunrise about 05:30 to 06:00 in this window**, computed for the season range with `core/src/sun` |
| Leave by 08:10 | Kept: times of day are not dates |
| Prices read in 2026 | Kept, with the read date ("EUR 40, 2026 price") |

The season window comes from the trip's research (timing lane): open months for lifts, roads and huts, snow-free dates, light and crowds. Each trip states it once with the reason.

## Picking dates: copy to my trips

1. Someone copies the public trip. Sign-in is required to keep it; without an account the copy is held in the browser with a warning.
2. They pick a start date. A date picker shades weekends, long weekends and school breaks (F03) and marks the trip's season window. A start outside the window warns, with the reason.
3. The planner attaches dates to every day and then:
   - turns booking rules into real dates with reminders ("Tre Cime toll slot opens Tue 15 Jun 2027 08:00 Rome")
   - checks weekday rules against the chosen days (a closed-Monday museum on a Monday)
   - computes sun times for the real dates
   - flags any holiday that now falls inside the trip
4. From then on it is their trip: they customise days, add bookings, tasks and budget.

## Data rules (for LD and the planner)

- The public snapshot stores `day_n`, never `date`. Booking windows are stored as rules (`opens: {days_before: 30, day_n: 3, time: "08:00", tz: "Europe/Rome"}`), not dates.
- Date-bound text in legacy plans is rewritten through the table above. An observation keeps its year and the label "observed".
- Anything that cannot be made relative is dropped from the public view and listed in the snapshot report for a person to rewrite. It is never silently kept with a date.
- The trip's `season` (months, label, reason, weather) is required for a public trip. A trip without it is listed with "season not set yet".
