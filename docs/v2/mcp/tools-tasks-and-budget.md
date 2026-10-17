# Tasks, budget and household tools

Scopes `trips:read` / `trips:write`. Household needs the user to be a household member.

---

## `tasks`

**Purpose.** List, add, complete and reassign trip tasks (Book, Buy, Pack, Documents, Prepare, On the
day) and household tasks (renew a passport). Generated tasks (from reservations, booking windows,
document rules, pack templates) are listed with their source and can be edited like any other.

| Field | Type | Req. | Meaning |
|---|---|---|---|
| `action` | enum | yes | `list`, `add`, `update`, `complete`, `reopen`, `skip`, `remove` |
| `trip` | string | one of | trip id |
| `household` | bool | one of | household-level tasks |
| `filter` | `{groups?, status?, due_before?, owner?}` | list | |
| `items` | Task[] | add | 1-50 |
| `id` | string | update/complete/... | |
| `patch` | Task (partial) | update | |
| `client_op_id` | string | writes | |

`Task`: `{group:"book"|"buy"|"pack"|"documents"|"prepare"|"on_the_day", title, due?:{at? | before_start_days? | day?, time?}, owner?:user|traveller label, link?, cost?, notes?, remind?:("push"|"email")[]}`.

**Output.** `list`: `{tasks:[{id, group, title, due_at, due_label:"in 12 days, Sat 15 Apr", status,
source, owner, link}], progress:{book:"2/5", pack:"0/31"}}`. Writes: `{results:[{id, url}],
reminders_scheduled:[{fire_at, channels}], version}`.

**Example.** `{"tool":"tasks","arguments":{"action":"add","trip":"trp_rockies","client_op_id":"01JC...","items":[{"group":"buy","title":"Bear spray x2 (buy in Canmore, not allowed on flights)","due":{"day":1}}]}}`

**Errors.** `validation_failed` (due before today is allowed only with a warning), `not_found`.

**Ops.** `task.add`, `task.update`, `task.set_status`, `task.remove`, `reminder.schedule`.

**Notes.** For something that has to be booked, use `reservations` with status `to_book` instead of a
plain task. Relative dues ("90 days before") are preferred: they move with the trip dates.

---

## `budget`

**Purpose.** Planned budget lines and actual expenses, by category, in the trip and home currency.

| Field | Type | Req. | Meaning |
|---|---|---|---|
| `action` | enum | yes | `summary`, `add_line`, `update_line`, `add_expense`, `update_expense`, `remove` |
| `trip` | string | yes | |
| `lines` | `{category, label, estimate, currency, basis?}[]` | add_line | categories: getting_there, local_transport, lodging, food, activities, misc |
| `expenses` | `{spent_on, label, amount, currency, category, item?, reservation?}[]` | add_expense | |
| `id`, `patch` | | update | |
| `client_op_id` | string | writes | |

**Output.** `summary`: `{currency, buffer_pct, by_category:[{category, estimate, actual}],
total:{estimate, actual, with_buffer}, home_currency:{code, rate, rate_date, total}}`. Reservations
with prices count automatically; do not add them again as lines.

**Ops.** `budget.upsert`, `expense.add`, `expense.update`, `budget.summary`.

**Notes.** Quote the exchange-rate date. Never estimate prices as facts: label estimates as such in
`label` ("estimate: groceries 14 days").

---

## `household`

**Purpose.** Read and update the household's standing preferences and people (so new trips pre-fill),
and memberships and passes.

| Field | Type | Req. | Meaning |
|---|---|---|---|
| `action` | enum | yes | `get`, `set_prefs`, `add_person`, `update_person`, `add_membership` |
| `prefs` | object | set_prefs | home base, radius_min, transport, budget_style, pace, interests, avoid, dietary |
| `person` | `{name, birth_year?, height_cm?, fitness?, citizenship?, passport_expires?}` | add/update | sensitive fields need `people:read` |
| `membership` | `{label, offer_id?, expires_on?}` | add_membership | |

**Output.** `get`: prefs, people as labels (with ages only under `people:read`), memberships.

**Ops.** `household.update`, `person.add`, `person.update`, `membership.add`.

**Notes.** Only change standing preferences when the user says it is a lasting preference ("we
always..."), not for one trip.
