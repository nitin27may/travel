# S24. Admin: review queue

## Purpose
Where research becomes catalog: changesets from Claude Code, chat clients, imports and user
corrections, each change shown as a diff with its evidence and source, accepted, edited or rejected
per change. Owner (and later moderators) only.

## Entry points
Rail **Admin → Review** (role-gated); Inbox "12 changes to review from 'Banff trails' job"; MCP
`review_queue` for doing the same from a chat client.

## Wireframes

Desktop (three panes):

```
┌ Review ─────────── Filter: [All jobs ▾] [Area: Banff ▾] [Kind ▾] [Risk: low first] ┐
│ CHANGESETS            │ CHANGES in "Banff trails · lane trails"  │ EVIDENCE              │
│ ● Banff trails (34)   │ ☐ + NEW trail  Lake Agnes Tea House       │ Parks Canada trail    │
│   Claude Code · 2 h   │   distance 7.4 km  gain 400 m  out-and-back│ page ↗ read 17 Oct   │
│ ● Correction (1)      │   trailhead → Lake Louise lakeshore        │ "7.4 km return, 400 m│
│   Priya · Dolomites   │   parking: Lake Louise lot, fills ~07:30   │ gain" (paraphrase)   │
│ ● Commons media (12)  │   [✓ accept] [✎ edit] [✕ reject]           │ OSM relation 123 ↗   │
│                       │ ☐ ~ UPDATE Moraine Lake  shuttle window    │ conflicts: none      │
│                       │   - "book anytime"                         │                       │
│                       │   + "rolling 48 h, 08:00 MT, sells out min"│                       │
│                       │ ☐ ~ UPDATE Peyto Lake  status → closed     │ ⚠ single community    │
│                       │   (2026 viewpoint works)                   │ source · needs 2nd    │
│                       │ [Accept 31 low-risk with official sources] │                       │
└───────────────────────┴────────────────────────────────────────────┴───────────────────────┘
```

Phone: changeset list → change cards one at a time (swipe right accept, left reject, tap edit),
evidence below each card.

## Regions and components
ChangesetList (author, client, job, count, age) · ChangeRow with DiffView (field-level, old → new,
new entity as a field list, map preview for geometry) · EvidencePanel (SourceLine, confidence,
paraphrase, conflicts with existing evidence) · BulkAcceptBar (rule-based: official source + low
risk) · EditInline · DuplicateWarning ("Looks like Lake Agnes Trail (ent_…) — merge?").

## Primary action
Accept (per change); bulk accept for low-risk with official sources.

## States
- **Duplicate suspected**: merge or keep both.
- **Geometry change**: map shows old (grey) and new (accent) lines.
- **Conflicting evidence**: both sources shown with dates; reviewer picks the value; the other stays
  as a conflict record.
- **Licence issue**: media without a free licence blocked with the reason.
- **Empty**: "Nothing to review. Backlog has 14 open gaps ›".

## Interactions
Keyboard: `J/K` next/prev change, `A` accept, `R` reject, `E` edit, `Shift A` accept changeset.

## Copy
Risk labels in words: "low risk: new viewpoint with an official source".

## Accessibility
Diffs readable as text ("distance: was empty, now 7.4 km"); not colour-only.

## Data and operations
`changeset`, `change`, `evidence`, `source`; ops `decide` (accept/edit/reject per change), `merge_entities`.

## Acceptance criteria
1. Accepting a change applies it, records evidence and updates `trust` per the rules (stated/verified).
2. Every rejected change keeps a reason.
3. Bulk accept only touches changes matching the shown rule.

## Share
Not shareable outside admins.
