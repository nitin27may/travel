# Brainstorm: editing a copied trip (the brainstorm prototype)

Status: **open design questions with recommendations, docs only** (27 Oct 2026, travel-planner, Opus, task PROTO-TODO).
Owner instruction of 27 Oct 2026 (the "brainstorm prototype list"). PLAN R-284; BACKLOG 15.357. Nothing here is decided
until the owner answers Q-BE1 to Q-BE8 (section 9). Where a recommendation would change a spec page, the page is named;
it is not edited until the owner answers.

**Scope decision (owner, 27 Oct 2026):** the edit experience is "part 2" of the program and is one experience for both
sources: a trip generated from scratch by the builder and a published trip that was copied and customised. In both cases
the trip is edited from the trip details page (`/trips/<id>/`, read-only today), together with the enhancements still
pending for that page. The builder (part 1) ends by handing the trip to that page; it does not carry its own editor.

**Answers (owner, 27 Oct 2026, all as recommended):** Q-BE1 yes (same page in edit mode, changes marked inline, Restore);
Q-BE3 yes (move buttons plus handle-only long-press drag); Q-BE4 yes (undo 50 steps kept across reload, Reset Day n and
Reset to our plan, no History in v1); Q-BE5 yes (relabel and re-check, ask where days go, never auto-move); Q-BE6 yes (two
warning levels, never block). Still unanswered: Q-BE2, Q-BE7, Q-BE8.

**Owner requirement (27 Oct 2026):** in edit mode every day lets the person delete any existing stop (not only ones they
added) and add more stops, for generated and copied trips alike. Already specified in `features/edit-my-trip.md` (section 6
row "Remove any stop; move it to another day", EM-4, and Add a place to Day N); the part 2 spec must carry both on the
details page, with Undo and the removed stop offered again in Add.

Inputs: the planner and builder prototypes in this folder; [FLOW.md](../design/trip-builder/FLOW.md) (TF9 to TF11,
5, 7.1), [edit-my-trip.md](../features/edit-my-trip.md) (EM1 to EM8, 2, 4.4, 5), reviews
[TB-N2](../reviews/review-TB-N2-trip-builder-flow-2026-10-27.md) and
[TB-N2R](../reviews/review-TB-N2R-trip-builder-flow-recheck-2026-10-27.md), components 8.1, and
[FINDINGS-2026-10-27.md](FINDINGS-2026-10-27.md) item 12 (the convert notice). Gaps by file are in [TODO.md](TODO.md).
Principles cited by number from [foundation/principles.md](../design/foundation/principles.md).

Settled and not reopened: one editor at `/t/<id>/` shared with the builder (F-Q2); a copy is `plan-draft/1` in template
mode that follows the public trip (EM1, EM3); the first engine action converts it in place with Undo for the session
(F-Q3); what the person placed stays placed (TF11); signed out, a device copy is fully editable (EM8).

## 0. Recommendations at a glance

| # | Question | Recommendation | Trade-off |
|---|---|---|---|
| Q1 | Public plan versus your copy | The copy opens as **the published days for your party and dates**, never an engine rebuild. Your changes show inline in words ("Added by you", "Moved from Day 3") and in one collapsed line "4 changes from our plan · Show", with Restore per change | A removed stop is visible only in that list, not in the day |
| Q2 | Day versions A, B, C | **Keep the version menu while the copy follows our trip.** On conversion the chosen version's stops become "from our trip" items; the other versions' places stay reachable through "Add to Day n" | After conversion there is no A, B, C switch; Undo this session or Reset brings it back |
| Q3 | Moving stops on a phone | **Both, buttons first**: the row's ⋯ opens Move to day (first row) and Up and Down; a visible handle allows long-press 300 ms drag inside the open day only | Two ways to do one thing; drag adds test surface |
| Q4 | Undo and history | **Undo and Redo, 50 steps per session, kept across a reload in the same tab; Reset Day n and Reset to our plan for copies.** No History list in v1 | No undo across devices or days later; Reset covers "start again" |
| Q5 | Dates and party changes | **Relabel and re-check at once, never move stops by themselves.** A longer or shorter trip asks where days go; a party change offers "Re-flow for a 6-year-old" with placed items kept | A plan can sit with warnings until the person acts |
| Q6 | An edit breaks the plan | **Preview, then warn; never block the person's own edit.** "Fix" level (closed that day, no road, deadline passed) shows at rest; "Check" level on the day header with one fix | A person can keep an unworkable day on purpose |
| Q7 | What the copy adds to the builder's item actions | **One action layer with a mode flag.** Template mode hides lock and Keep on Day n, keeps every shape-keeping edit, adds the version menu, Reset, Maybe and the "We updated this trip" notice; engine actions show the convert notice first | One more mode to test per action |
| Q8 | Sync and conflicts in the editor | **Quiet**: edits never wait for the network; one state word in the header; a notice only when a change from this device could not apply; rows changed on another device marked for 6 s | Another device's change can take up to 60 s to appear |

## 1. Q1. The public plan versus your copy

**What the prototype shows.** `?copy=dolomites` runs `copyCreateNow`: it takes `OUR_TRIP.picks`, runs `buildPlan` and
marks every stop "From our trip". A non-modal **Make it yours** card sits above Day 1 (Change places, Your driving and
pace, Where you start, Keep it as it is). **Compare before and after** exists, but only against the last rebuild.

**What it does not.** It never shows the published days: the copy is a fresh engine plan whose days, order and bases
can differ from the trip page the person just read. There is no marker for "changed by you" against the original, no
list of changes, no Restore, no "We updated this trip" notice (edit-my-trip 5.5), and no link back to the public trip.

| Option | For | Against |
|---|---|---|
| A. Your copy is the page; changes marked inline in words, one collapsed "N changes from our plan · Show" line | P3 (a glance), P2 (detail on Show); the day reads as one plan | Removed stops live only in the list |
| B. Side-by-side "ours" and "yours" always | Every change visible | Halves the width on a phone; P7: the 90% task is to use the plan, not audit it |
| C. A toggle "Show our plan" that overlays the original | Full original on demand | A mode the person must discover (P4); two renderings of one day |

**Recommendation: A.** The starting point is the published plan rendered for the copy's party and dates (template mode,
the versions the profile picks), exactly what the trip page showed. Inline chips use words: "Added by you", "Moved from
Day 3", "Version C" (P6, never colour alone). The line "4 changes from our plan · Show" opens a sheet listing each
`template` op (added, removed, moved, version, day ops) with **Restore** per row; Restore is an op with an inverse.
The prototype's Compare sheet becomes "Compare with our plan" inside that sheet on desktop. A header link "From our
Dolomites trip" opens the public page in a new tab. **Trade-off:** a removed stop is not drawn in its day; the list
names it.

## 2. Q2. Day versions A, B, C in a copy

**What the prototype shows.** Nothing: neither prototype models versions. The live site's trip page has the **Version
of Day N** menu with a consequence line per version, and a copy stores the choice in `template.overrides`
(edit-my-trip 2, 5.3 step 3).

**What it does not.** Versions are lost at copy time (the engine rebuild in Q1), there is no menu in the editor, and no
rule says what happens to versions when the copy converts.

| Option | For | Against |
|---|---|---|
| A. Keep versions in template mode; flatten on conversion, other versions' places offered in "Add to Day n" | Our research (the alternatives) stays usable; conversion has one clear meaning | The switch is gone after conversion |
| B. Drop versions at copy time; build days from scratch | Simplest editor | Throws away the research that makes our trips worth copying (P7) |
| C. Keep versions forever, also in built mode | Most flexible | Needs a variants shape in `plan-draft/2`; the engine must plan around alternatives; L work for little use |

**Recommendation: A.** A version swap is shape-keeping (FLOW C4), so it stays in template mode and keeps our later
fixes flowing in. The first engine action (Q7) converts: the chosen version's stops become "from our trip" items, and
the other versions' places stay one tap away as the first group in "Add to Day n" ("Other options for this day").
Building days from scratch is only ever the explicit Rebuild. **Trade-off:** no A, B, C after conversion; the convert
notice says so, and Undo this session or Reset to our plan (Q4) brings the versions back. Affects: FLOW 5 C5 (one
sentence on versions).

## 3. Q3. Moving stops on a phone

**What the prototypes show.** The **planner** has no move at all: its itinerary is read-only and "Edit plan" goes to the
builder; Today only ticks stops done and adds a free-text stop. The **builder** has a full item sheet: **Move to day…**
(each day with base, free time, the driving change and a Fits or Tight chip from `simMove`), **Order in the day** with
Up and Down buttons, Swap with, Swap for a nearby place, Keep on Day n, Must see, Remove. Desktop drag works (HTML5) within
a day, across days and onto the day chips.

**What they do not.** Touch drag (HTML5 drag does not fire on phones), a visible handle on phones, long-press, haptics,
autoscroll, the insertion line and pill ("to Day 3 · before 11:30 · +42 min driving"), position announcements, and the
row-level ⋯ (the whole row opens the sheet, so the trigger is not obvious).

**Conflict in the specs.** FLOW 7.1 and components 8.1 allow long-press 300 ms drag on phones (never across days,
WCAG 2.5.7); edit-my-trip 5.3 step 6 says phones reorder with Move up and Move down, "not drag (P4: no hidden gesture)".

| Option | For | Against |
|---|---|---|
| Move buttons only | Works for everyone, one-handed, no hidden gesture (P4) | Moving a stop three places is three taps and three sheet opens |
| Long-press drag only | Fast for people who know it | Hidden (P4); fails WCAG 2.5.7 without an alternative; fights scrolling |
| Both, buttons first | Everyone has the buttons; drag is an accelerator | Two paths to test |

**Recommendation: both, buttons first.** Each row has a visible ⋯ (44 px) and a visible handle (28 x 44, components 8.1).
The sheet's first row is Move to day (as the builder prototype), then Up and Down. Long-press 300 ms **on the handle only**
lifts the row within the open day, with autoscroll and the pill; there is no cross-day drag on a phone (use Move to day).
Each move toasts "Moved to Day 2 · kept there" with Undo (TB-N2R L-R1) and announces the position. **Trade-off:** two
ways to do one thing; starting drag only from the handle avoids the scroll and text-selection clash. Affects:
edit-my-trip 5.3 step 6 is amended to FLOW 7.1 once the owner agrees.

## 4. Q4. Undo and history

**What the prototype shows.** The builder keeps a full snapshot per step (`HIST`): Undo and Redo in the toast, the ⋯
menu and Ctrl or Cmd+Z; a **History** sheet that jumps to any step; Compare before and after the last rebuild. The
planner has Undo only in the toast after a delete or remove (9 s).

**What it does not.** History is lost on reload and reset on open; there is no cap; there is no Reset Day n or Reset to
our plan (edit-my-trip 5.1); conversion's "Undo this session" (F-Q3) is not tied to the stack.

| Option | For | Against |
|---|---|---|
| One undo (the last action) | Simple | A person who made three edits cannot get back |
| A stack plus a visible History list | Powerful | A list of op labels is a power feature most people never open (P2, P7) |
| Reset to the original only | One clear escape | Loses good edits with the bad |

**Recommendation: the stack plus Reset, no History list in v1.** Undo and Redo per draft, 50 steps, kept in
`sessionStorage` so a reload in the same tab keeps them (phones reload often); not synced (FLOW 7.1). For copies, the
day ⋯ has **Reset Day n** and the copy's ⋯ has **Reset to our plan**; each is one op, undoable, and Reset to our plan
confirms when it discards more than three changes. Conversion is a stack entry, so Undo walks back through it until the
tab closes. **Trade-off:** no undo next week or from another device; Reset is the long-range escape. The prototype's
History sheet can return later if usage asks for it.

## 5. Q5. Dates and party changes

**What the prototypes show.** Builder: new dates set nights from the range and recalculate closures by month, sunset by
month and book-by dates; nights, party or pace changes raise "Settings changed" and an Apply line that rebuilds with
kept items stated ("Rebuild 6 days · 3 locked and 2 placed by you stay"); a child's age re-checks at once. Planner:
Change dates relabels only (the nights field does not add or drop days); party changes re-run its checks and offer
"Re-run suggestions in the builder".

**What they do not.** Weekday opening hours (closures are month-level `cl`); adding or dropping days when the range
changes; any rule for which days go; re-checking book-by deadlines that have already passed.

| Option | For | Against |
|---|---|---|
| Relabel only | Nothing moves (T3, TF14) | Silent problems: a stop closed on the new weekday |
| Re-time automatically | Always consistent | Moves what the person arranged; breaks TF11 |
| Relabel, re-check at once, offer a re-flow | Honest and in the person's control | The plan can sit with warnings |

**Recommendation: relabel, re-check, offer.** A date change relabels days and re-runs closures, opening days, sun and
book-by at once; problems appear as Q6 warnings with one fix each. A change in length asks once: "Add 2 days · at the
end / after Day 4", "Drop 1 day · Day 7 (2 stops move to Day 6)", with the effect line. A party change re-checks fit and
pace at once and offers "Re-flow for a 6-year-old · placed items stay" (one Apply, Undo). In template mode the public
scheduler already re-flows from the template for a party change (edit-my-trip 5.3 step 5); that stays, because it is
shape-keeping. **Trade-off:** a plan can carry warnings until the person acts. Affects: none (fits FLOW stage 7 Apply
and edit-my-trip 5.1).

## 6. Q6. When an edit breaks the plan

**What the prototype shows.** Warnings on the day with one fix each ("Drives 5 h 10, over your 4 h a day · Move Seceda to
a lighter day"; "Day ends 40 min after sunset"; "Long day"; "Tre Cime is closed in Nov · Swap or remove it"); Move to day
previews Fits or Tight with the driving change; Add rows say "fits after Siusi · +15 min · ends 17:55" or "Day full: try
Day 5"; the Checks line counts warnings. Nothing ever blocks.

**What it does not.** Severity: a closed-that-day stop and a slightly long day look the same; no state for "no road";
no warning at rest in the trip header; warnings do not survive into the planner (its own `P.checks`).

| Option | For | Against |
|---|---|---|
| Warn | The person decides (it is their trip) | Easy to ignore something serious |
| Block | No impossible plans | Blocks real choices ("we will take the shuttle"); the data is not always right (T3) |
| Quiet | Calm | Hides a closed gate or a passed deadline (against P2's safety exception) |

**Recommendation: preview, then warn in two levels; never block.** Before the edit: Fits or Tight in Move to day and
Add (exists). After: **Fix** (closed that day, no road, a book-by date passed, a booking on a dropped day) shows at rest
on the day header and as a count in the trip header (P2 safety exception); **Check** (over the drive budget, after
sunset, long day) shows on the day header, collapsed to one line when there are several. Every warning has one fix.
Estimates (≈) are never a warning. No dismiss in v1 (a dismiss needs a stored acknowledgement, a `plan-draft/2` key).
**Trade-off:** a person can keep an unworkable day on purpose, and the Fix stays visible until they change it.

## 7. Q7. One editor at /t/<id>/: what a copy adds to the builder's item actions

**What the prototype shows.** The Make it yours card, the convert sheet (with an extra switch that frees "from our
trip" stops, F: item 12), "From our trip" chips, and the Keep on Day n switch with its reason line.

**What it does not.** The version menu, Reset, the Maybe list, the "We updated this trip" notice, a source link, and a
rule for which FLOW 7.1 actions keep template mode.

**Recommendation: one action layer with a mode flag.** Shape-keeping actions write `template` ops and keep our fixes
flowing in; engine actions show the convert notice first (C5), then run on the converted plan.

| FLOW 7.1 action | Template mode (follows our trip) | After conversion |
|---|---|---|
| Reorder inside a day | `moved` op; stays in template mode | `moveItem`, Placed by you |
| Move to another day | `moved` op | same, Placed by you |
| Swap two stops | two `moved` ops | `swapItems` |
| Replace with a nearby place | `removed` plus `added` | `replacePick` |
| Add with "fits here" | `added` op; first group "Other options for this day" (Q2) | `addPick` |
| Remove | `removed` op | `removePick` |
| Lock, Keep on Day n | **hidden**: nothing re-flows across days in template mode | shown |
| Must see | hidden (nothing is dropped) | shown |
| Add or drop a day | `days` op | `insertDay`, `dropDay` |
| Version of Day n | **copy only**: `overrides` | gone (Q2) |
| Reset Day n, Reset to our plan | **copy only** | Reset to our plan becomes "Back to our plan" (re-copy, Undo) |
| Dates, party, pace | profile change; the scheduler re-flows (shape-keeping) | Apply line, re-flow with placed items kept |
| Start, Where, day-out driving, bases, Rebuild | **convert notice first** | engine |
| Notes, title | `notes`, title | same |

**On FINDINGS item 12** (does conversion free "from our trip" stops?): **keep them placed**, as FLOW C5 says, and drop the
prototype's switch. A person who changes driving or pace after conversion sees the Apply line name "11 from our trip
stay"; "Let the plan move them" is one button on that line, one op, undoable. **Trade-off:** one more mode to test per
action; the table above is the test matrix. Affects: FLOW 7.1 (a template-mode column) and 5 C5.

## 8. Q8. Sync and conflicts in the editor

**What the prototypes show.** "Saved on this phone · just now" in the builder header; "Trips live in this browser. Sign
in to keep them on every device." in the planner, whose Sign in explains that the prototype has no accounts; an offline
badge flag on Today.

**What they do not.** Any account, any second device, the state words, the rebase notice, removal on another device,
the newer-document read-only state.

| Option | For | Against |
|---|---|---|
| A. Quiet: state word, notice only when something could not apply | Edits never wait (EM4, EM5); calm (Q-EM7) | Up to 60 s stale (EM7) |
| B. Banner on every sync | Visible | Noise on every keystroke |
| C. Lock editing while syncing | No conflicts | Unusable on a weak signal (T2) |

**Recommendation: A.** The header's state word ("In your account", "Syncing", "On this device", "Not synced · Retry",
a polite live region that announces changes of state only). A rebase that skipped an op shows one notice above the open
day: "1 change from this device was not applied: Moraine Lake was removed on another device · Show · OK" (edit-my-trip
4.4). When a refresh brings another device's change into the open day, the changed rows carry "Changed on another
device" for 6 s, focus and scroll stay put (P5), and undo entries whose targets are gone are dropped with the same
notice. A copy removed elsewhere opens read-only with "Removed on another device · Restore" (30-day tombstone, 4.5).
**Trade-off:** another device's change can take up to a minute to show. For the next prototype round, two tabs and a
`BroadcastChannel` are enough to show it.

## 9. Owner questions

| Id | Question | Recommended |
|---|---|---|
| Q-BE1 | A copy opens as the published days, with changes marked inline and a "changes from our plan" list with Restore? | Yes |
| Q-BE2 | Keep the version menu until conversion, then flatten, with other versions offered in Add? | Yes |
| Q-BE3 | Phones: Move buttons first plus handle-only long-press drag within a day; amend edit-my-trip 5.3 step 6? | Yes |
| Q-BE4 | Undo 50 steps per session kept across a reload; Reset Day n and Reset to our plan; no History list in v1? | Yes |
| Q-BE5 | Dates and party: relabel and re-check at once, ask where days go, offer a re-flow; never move stops by themselves? | Yes |
| Q-BE6 | Two warning levels, never block, no dismiss in v1? | Yes |
| Q-BE7 | Template-mode table of section 7; conversion keeps "from our trip" stops placed (FINDINGS item 12)? | Yes |
| Q-BE8 | Quiet sync with the state word and notices only when a change could not apply? | Yes |

## Change log

| Date | Change |
|---|---|
| 2026-10-27 | Created (PROTO-TODO, travel-planner, Opus): eight questions with what the prototypes show, what they do not, options and a recommendation each |
