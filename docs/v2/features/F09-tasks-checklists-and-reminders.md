# F09. Tasks, checklists and reminders

## Purpose

Turn a trip into a to-do list that mostly writes itself: what to book and when, what to buy, pack
and prepare, which documents to check; and reach people at the right moment ("Moraine Lake shuttle
seats release in 15 minutes"). Inline checklists cover the small stuff attached to a place or a day.

## User stories

1. As a planner, I want a Book task to appear for every to-book reservation with its deadline, so that nothing is forgotten.
2. As a parent, I want a packing list generated from the trip type, season and the kids' ages, so that I start from 80% done.
3. As a traveller, I want a phone notification 15 minutes before a booking window opens, so that I get the slot.
4. As a household, I want tasks assigned to a person ("Priya: buy crampons for Aarav"), so that we split the work.
5. As a planner, I want a checklist on the gondola item ("jackets, cash, tickets"), so that small reminders live where they matter.
6. As anyone, I want to see all reminders in one inbox with their state, so that I know what fired and what is next.

## Detailed behaviour

### Tasks

1. Groups: **Book, Buy, Pack, Documents, Prepare, On the day**. Each group shows done/total.
2. Fields: title, group, due (absolute, or relative: "90 days before start", "at window opening", "evening before day 3"), owner (a member) or traveller, status (todo, done, skipped, not_needed), link, cost, notes, proof attachment, sort.
3. **Generated sources** and their rules:
   - reservations (09-reservations.md 5): book, cancellation deadline, balance due, check-in, boarding passes, licence, late-arrival notice, tickets download, reconfirm;
   - booking windows of catalog offers on trip items without a reservation yet ("Algonquin day permit for Sun 11 Oct opens Tue 6 Oct, time inferred 07:00");
   - document rules (passport validity, eTA or visa, minor consent letter when a child travels without both parents, travel insurance);
   - pack templates by trip type, season, destination climate and age band (hut trip, glacier, beach, city, camper, kids);
   - prepare: offline download (3 days before), conditions check (2 days before), currency, phone plan or eSIM, home tasks (pet care, mail);
   - on the day: from items (bring headlamp for a sunrise hike; swimwear for a lake).
4. Generated tasks have a stable `source_ref`; regeneration never duplicates and never overwrites a task with `user_edited = true`. Deleting a generated task marks it not_needed so it doesn't come back.
5. Manual tasks: added anywhere (Tasks view, day, item, or household level).
6. Due dates resolve when trip dates change; relative tasks without dates show "set dates to schedule".
7. Checking off: one tap, undo toast, readiness bar updates (F13).
8. Household-level tasks (no trip): passport renewal, pass renewal, annual insurance.

### Checklists (inline)

9. Item kind `checklist` with lines `{id, text, done}`; sits in a list or a day; any member ticks lines; a line's menu offers "Make it a task" (moves it to Tasks with a due date).
10. Pack lists are tasks in group Pack, but shown in a checklist layout with per-person columns ("Aarav", "Priya") when the template is per person.

### Reminders

11. A reminder row per (task or reservation, kind, fire time, channels). Default schedule for a booking window: 7 days before, the evening before (19:00 local to the user), 15 minutes before, at opening, and "did you get it?" 2 hours after. Slow-selling offers: one reminder 7 days before book-by. Task due: the morning of (08:00) and 2 days before for Prepare tasks.
12. **Channels**: Web Push (primary; on iOS requires the app installed to the Home Screen, so the app prompts install at the first time-critical reminder), email (fallback and digest), calendar (ICS feed per trip with alarms; plus a single-deadline `.ics` download for immediate alarms).
13. **Quiet hours** per user (default 22:00-07:00); a booking opening overrides quiet hours unless muted per reminder.
14. Times are computed in UTC from the operator's zone (opening) and displayed in both zones ("08:00 MT · 10:00 your time").
15. The worker container polls due reminders every 30 s, sends, records `sent_at`, retries twice on failure, then marks failed and falls back to email.
16. **Inbox** lists reminders: upcoming, due, sent, acknowledged, missed; each links to the task and the reservation or booking page; "Snooze 10 min" and "Done".
17. **Weekly digest** email during Book and Prepare phases: what is due this week, what opens, what is late.

## Data touched

`task`, `reminder`, `notification_pref`, `push_subscription`, `calendar_feed`, `pack_template`, `document_rule`, `reservation`, `offer`, `trip_item` (checklists), `attachment`.

### Schema additions

- `reminder.kind` values: `window_week`, `window_eve`, `window_15`, `window_open`, `window_followup`, `book_by`, `due_morning`, `due_2d`, `cancel_deadline`, `balance_due`, `check_in`.
- `task.relative_to text check (relative_to in ('start','end','window_open','book_by','day'))` and `task.offset_minutes int` (instead of free JSON) for clean recomputation.
- `pack_template.items` entries: `{text, per_person boolean, applies {age_min, age_max, types[], months[]}}`.

## Operations and MCP tools

Operations: `task.add`, `task.update`, `task.complete`, `task.skip`, `task.reassign`, `task.remove`, `task.regenerate` (system), `checklist.add`, `checklist.tick`, `checklist.promote`, `reminder.snooze`, `reminder.ack`, `notification.set_prefs`, `push.subscribe`, `calendar_feed.rotate`.

MCP: `tasks` (list by trip or household, add, complete); reminders are read-only through `get_trip`.

## Edge cases

- A user with no push subscription and no email verified: reminders show in the Inbox only, and the trip dashboard warns "you won't be notified".
- Daylight-saving change between scheduling and firing: fire times stored in UTC computed from local wall time at the operator; recomputed if the trip's dates change.
- A window that opens while the user is flying: the reminder still fires; another member can be set as the backup owner for time-critical bookings.
- A member removed from a trip: their tasks move to the owner.
- ICS feed refresh lag in Google Calendar (hours): never the only channel for openings.

## Acceptance criteria

1. A to-book Moraine Lake shuttle with a window at 08:00 MT on a known date creates 5 reminders at the right UTC instants for a user in Toronto.
2. Regenerating tasks after changing trip dates moves due dates of generated, unedited tasks and leaves edited ones alone.
3. Ticking the last Book task moves the readiness bar's Book segment to complete.
4. A push reminder reaches an installed PWA on Android and iOS (manual test) and the Inbox shows it as sent.
5. A checklist line promoted to a task keeps its text and gains a due date and reminder.

## Milestone

M3.

## Open questions

1. Backup owner for time-critical bookings (two people get the alarm)? Default: yes, optional per reservation.
2. SMS as a channel? Default: no (cost); push and email only.
3. Should the digest go to all adult members or only the owner? Default: all members with editor role, each can opt out.
