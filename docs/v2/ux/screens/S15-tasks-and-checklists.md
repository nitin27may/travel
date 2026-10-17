# S15. Tasks and checklists

## Purpose
The trip as a to-do list: Book · Buy · Pack · Documents · Prepare · On the day, most generated,
all editable, each with an owner, a due date and reminders. Checklists are lighter: lines inside a
list or a day ("Gondola: jackets, cash") with no date; any line can be promoted to a task.

## Entry points
Trip tab **Tasks**; readiness bar rows; Inbox reminders; ☑ in an AddBox (checklist block); household
tasks under You → Household ("Renew Aarav's passport before Jun 2027").

## Wireframes

Desktop:

```
┌ Tasks · Dolomites ───────────── Filter: [All ▾] [Mine] [Due soon]  [+ Add task] ┐
│ BOOK  3/9 ▰▰▰▱▱▱▱▱▱                                                             │
│  ☐ Book Seceda lift tickets        ●Nitin  Mon 26 Oct · in 9 d   🔔 4  [Open]    │
│  ☐ Book Rifugio Lagazuoi           ●Priya  1 Nov · in 15 d       🔔 2            │
│  ☑ Book Hotel Ambra                ●Nitin  done 12 Oct                           │
│ DOCUMENTS 1/3                                                                    │
│  ☐ Aarav's passport valid to Jan 2028 ✓ / Mira's expires 2 Dec 2027 → renew      │
│     (Italy: valid 3 months after return; source: …)   ●Priya  by 1 Apr          │
│  ☐ ETIAS for Canadians (if in force by Jul 2027)       ●Nitin  check 1 Mar       │
│ PACK  0/34 · from template "Alpine summer, kids 9–12" [Edit list]                │
│  ☐ Via ferrata: helmets ×2 (rent in Ortisei)  ☐ Rain shells ×4  …                │
│ BUY · PREPARE · ON THE DAY ›                                                     │
└──────────────────────────────────────────────────────────────────────────────────┘
```

Phone: groups as collapsible sections with progress; swipe right = done (undo toast), swipe left =
⋯ (snooze, reassign, not needed); + floating button.

```
┌───────────────────────────┐
│ Tasks        Mine ▾   [+] │
│ Book 3/9 ▰▰▰▱             │
│ ☐ Seceda tickets  in 9 d  │
│ ☐ Rif. Lagazuoi   in 15 d │
│ Documents 1/3 ▰▱▱         │
│ ☐ Mira passport → renew   │
│ Pack 0/34 ›               │
└───────────────────────────┘
```

Checklist block inside a day:

```
│ ☑ Gondola day bag  (2/4)          [→ task] ⋯ │
│   ☑ jackets  ☑ cash  ☐ snacks  ☐ sunscreen   │
```

## Regions and components
TaskGroup (header, progress) · TaskRow (checkbox, title, owner avatar, DateRelative, ReminderChip
count, source mark: "from booking", "from passport rule", link) · TaskSheet (all fields: due rule
"90 days before start" or absolute, owner, reminders, link, cost, proof attachment, notes) ·
ChecklistBlock · PackTemplatePicker.

## Primary action
Checking a task off (one tap, undo).

## States
- **Generated vs edited**: generated tasks show their source; once edited they keep the edit when
  the trip changes ("you edited this, so it won't update automatically").
- **Overdue**: red text + icon, sorted first in its group.
- **No dates on trip**: relative due rules show "90 days before start (set dates)".
- **Empty group**: "Nothing to pack yet. Start from a list: Alpine summer · Beach · City · Hut trip".
- **Offline**: check off works, queued.

## Interactions
Drag to reorder within a group (handle) or Move menu; `X` toggles done; `Enter` opens the sheet;
"Promote to task" on a checklist line opens the sheet with the line as title.

## Copy
"Book Seceda lift tickets · on sale Mon 26 Oct 09:00 Rome (03:00 your time)"; "Not needed" rather
than "Dismiss".

## Accessibility
Checkboxes are real checkboxes with full task names; progress has text.

## Data and operations
`task` (grp, due_rule, due_at, source, source_ref, user_edited, owner, status), `reminder`,
`pack_template`, `document_rule`; ops `tasks.add/complete/update`, `promote_checklist_line`.

## Acceptance criteria
1. Changing trip dates moves relative due dates and their reminders, except user-edited tasks.
2. A checklist line promoted to a task keeps a link back to its block.
3. The passport task flags a traveller whose passport expires within the destination's rule.

## Share
"Assign" (member picker) on every task; pack lists and checklists have "Share list" (S26, scope list, read-only checkable copy for a guest helper).
