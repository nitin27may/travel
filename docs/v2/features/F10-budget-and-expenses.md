# F10. Budget and expenses

## Purpose

Answer "what will this cost and are we on track" before the trip, and "what did it cost" during and
after it, in the trip currency and the household's home currency. Costs flow in from items and
reservations; anything else is added by hand. No expense-splitting UI in v1 (family first).

## User stories

1. As a planner, I want a budget broken into getting there, local transport, lodging, food, activities and misc with a buffer, so that the total is honest.
2. As a parent, I want reservation prices to land in the budget automatically, so that I don't type them twice.
3. As a traveller, I want to add an expense in two taps from Today mode, so that tracking during the trip is painless.
4. As a household, I want to see planned vs actual for the year (F03), so that next year's budget is grounded.
5. As a pass holder, I want covered entry fees to drop to zero and to see when a pass pays for itself.

## Detailed behaviour

1. **Budget section** at the end of the plan document and as its own view on the phone: total planned, total actual, buffer (default 12%, from the vault budget reference), remaining against a target if set.
2. **Categories**: getting_there, local_transport, lodging, food, activities, misc. Each with planned and actual, per group or per person or per person per day.
3. **Sources of planned amounts**: reservation price (booked or estimated for to-book), item `cost_estimate` × people in `who`, manual budget lines, food estimate per person per day (trip setting, default from budget style: budget 40, mid-range 75, comfortable 120 CAD), fuel estimate from drive legs (km × consumption × fuel price, editable).
4. **Expenses**: date, label, amount, currency, home-currency amount (rate stored with its date), category, optional link to item or reservation, receipt photo. Add from the Budget view, from an item's menu, or Today mode's quick add (amount, category, optional photo).
5. **Currencies**: trip currency (CAD default, EUR for the Dolomites), home currency from the household; rates from a free daily source (ECB reference rates) stored per day; manual override.
6. **Passes**: if the household holds a pass covering an entity, its fee is zero and labelled "covered by Parks Canada Discovery Pass"; if not, and several covered entities are in the trip, a suggestion card: "The Discovery Pass (~$151 family) pays for itself after 3 of these 5 park entries."
7. **Breakdown view**: by category, by day, by traveller (planned only), top 5 cost drivers with trims ("cheaper lodging tier saves ~$420"), as in the vault budget reference.
8. **After the trip**: actual vs planned summary feeds the travel year totals.
9. **Not in v1**: who paid and who owes (group balances). The `expense.paid_by` and `split_between` columns exist for a later UI on friends' trips.

## Sharing

See [10-sharing.md](../10-sharing.md). A **budget summary** (totals by category, planned vs actual, no receipts, no line-level notes) can be shared as a guest link or image card. Guest links to the trip hide the budget unless the "costs" include toggle is on. Receipts are never shared by link.

## Data touched

`budget_line`, `expense`, `reservation` (price, paid, balance), `trip_item.cost_estimate`, `trip.currency`, `trip.budget_buffer_pct`, `membership`, `offer` (pass), `relation(covered_by)`, `attachment` (receipts), `travel_goal` (year budget).

### Schema additions

- `fx_rate (on_date, base, quote, rate, source)` with primary key on the first three.
- `trip.budget_target numeric` and `trip.food_per_person_day numeric`.
- `trip.fuel jsonb` (`l_per_100km`, `price_per_l`, `currency`) for fuel estimates.

## Operations and MCP tools

Operations: `budget.set_target`, `budget.add_line`, `budget.update_line`, `budget.remove_line`, `expense.add`, `expense.update`, `expense.remove`, `budget.set_buffer`, `fx.refresh` (worker).

MCP: `budget` (read planned vs actual; add expense). Expense amounts are trip data (`trips:read`); receipts are not returned.

## Edge cases

- Reservation in a third currency (Swiss franc on a Dolomites trip): converted to the trip currency for totals and shown in its own currency on the line.
- Refund after cancellation: an expense with a negative amount linked to the reservation.
- Per-person items where `who` changes: planned amount recomputes; actual expenses don't.
- No rate for a date (weekend): use the last available rate and label it.

## Acceptance criteria

1. Booking a stay with a price adds its amount to lodging planned without a manual line; cancelling removes it.
2. The buffer is applied to planned totals only, and shown separately.
3. Quick add in Today mode creates an expense with today's date and the trip currency in at most 3 taps (amount, category, save).
4. A household holding a Discovery Pass sees Banff entry fees as zero with the pass label.
5. The year view sums trips' planned and actual totals in the home currency.

## Milestone

M3 (budget, lines, reservation feed, expenses); receipts and quick add in M4.

## Open questions

1. Default food per person per day by budget style: are 40/75/120 CAD right for the family? Default: yes, editable per trip.
2. Fuel estimate on by default for road trips? Default: yes, with editable consumption.
