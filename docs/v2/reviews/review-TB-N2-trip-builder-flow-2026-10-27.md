# Review TB-N2: the Trip Builder end-to-end flow

Status: design review, 27 Oct 2026, `travel-design-reviewer`, model Opus 5.5 (`claude-opus-5-5`). Reviewed: branch
`design/TB-FLOW` at dda24882: [FLOW.md](../design/trip-builder/FLOW.md),
[wireframes-phone.md](../design/trip-builder/wireframes-phone.md),
[wireframes-desktop.md](../design/trip-builder/wireframes-desktop.md), [README.md](../design/trip-builder/README.md),
[trip-builder-location-metadata.md](../features/trip-builder-location-metadata.md), against the foundation
([principles](../design/foundation/principles.md) P1 to P9 and T1 to T5, components, patterns, tokens), the TB-N design
note (branch `public/TB-N`, 4fee4a8b, not merged), [trip-scope-scenarios.md](../design/trip-scope-scenarios.md),
[keep-from-live-site.md](../design/keep-from-live-site.md) and
[product-direction-2026-10-18.md](../design/product-direction-2026-10-18.md).

**Verdict: approve the flow with changes.** The shape is right: kind first, from where / who / when, where, pick with
nearby, driving with more in range, build, edit, review, and copy entering the editor. Four must-fix items stand
between this page and the TB-W1 and ED build briefs. The biggest is that build and edit are still two screens, which is
the wizard seam the owner asked to remove.

## 0. How this was checked

No product UI exists for these stages, so I rendered the new FLOW frames as throwaway mocks. They were built from
`web/app/themes.css` and the self-hosted fonts, reusing the TB-N mock generator. The generator lives in the scratchpad
and is not committed. Each frame was shot at 2x, phone 390 x 844 and desktop 1440 x 900, light and dark, with dark set
by clicking the page's theme control. Chromium ran from `web/node_modules` with the Metal GPU flags. The frames follow
the wireframes as written, so the problems below are visible in them. The shots are in
`web/test-results/shots/TBN2/` (gitignored, not committed):

| Frame | Shots |
|---|---|
| F1 Start (weekend) | `n01-390-light.png`, `n01-390-dark.png` |
| F3 Pick with towns and the near strip | `n03-390-*` |
| F4 Days and driving with suggestions | `n04-390-*` |
| F5 Build result | `n05-390-*` |
| E1 Editor, public bottom bar back (FLOW 7) | `n06-390-*` |
| E2 Item sheet | `n07-390-*` |
| E3 Move to day | `n08-390-*` |
| E4 Add with "fits here" | `n09-390-*` |
| C2 Make it yours (copy) | `n10-390-*` |
| F8 Review and prepare | `n11-390-*` |
| WE + WC desktop editor with Make it yours and the C3 notice | `w01-1440-*` |

Measured on the shots:
- **E1 (n06).** The day gets 570 of 844 px. The bars take 64 (trip header), 61 (day chips), 61 (editor bar) and 84
  (public bar).
- **F5 (n05).** The first day starts at 415 px, so the bases card and Checks fill the whole first view.
- **F3 (n03).** The floating Map pill covers the second near-strip row and its Pick button.

## 1. Owner requirements, traced

| # | Owner requirement | Where in FLOW | Verdict |
|---|---|---|---|
| R1 | One continuous experience, not a create-only wizard | TF1, TF9, stage 7, section 2 | **Partly met.** One document, autosave, settings reopen as sheets: good. But stage 5 (Build) and stage 7 (Editor) render the same day twice with different powers, joined by "Edit my plan" (and by stage 6 for air kinds). See M1 |
| R2 | Pick the trip kind | Stage 0, TF2 | Met. Six tiles; kind derived, never stored |
| R3 | Start city (nearest airport) | Stage 1, origin ladder | **Partly met.** The city is asked, but no departure airport is shown, and F1's note says the start is used "to suggest the airport to fly into", which is the wrong direction. See S2 |
| R4 | Country, then north or south, then regions | Stage 2, TF5, metadata M1 and M2 | Met. Macro chips, then multi-select travel regions with true counts and "Not researched yet" |
| R5 | Multi-select towns | Stage 3, TF6 | Met. Towns first, multi-select, "Stay here" pins a base. "Stay here" must appear only on a picked town (F3 draws it that way; FLOW should say so) |
| R6 | Sights and hikes with nearby suggestions | Stage 3 near strip | Met in substance. The phone layout needs work (S7) |
| R7 | Daily driving comfort that suggests more places in range | Stage 4, TF7 | Met. The label clashes with the near-mode reach (S1), and the suggestions must obey fit and season (S9) |
| R8 | Itinerary in time order and road order across days | Stage 5 "Order inside a day"; base order from the arrival airport | Met for days and air kinds. FLOW should state the base order for near kinds (a loop from the start). Open jaw breaks it (S11) |
| R9 | Full customisation | Stage 7, 7.1 | Met in scope. Two rules break the trust promise: hand edits are lost on rebuild (M2), and the keyboard model conflicts (S6) |
| R10 | Copying leads into customising | Section 5, TF10 | Met. The modal sheet costs the 90% a tap (S3) |
| R11 | Family factors: who, when, pace, reality checks, book-by deadlines, resume | Section 3, stages 1, 4, 5, 8, TF13, TF14 | Met without bloat (two rows on stage 1). Gaps: book-by dates without dates (S5), and the resume states (S12) |

## 2. Findings

### Must-fix (critical)

| # | Screen | What is wrong | Why it matters to a family | Exact fix |
|---|---|---|---|---|
| M1 | F5 Build vs E1 Editor (n05, n06); F6 for air kinds | The build result is its own stage. It shows the same day as the editor but without handles. The primary is "Next: Getting there" or "Edit my plan", and only then does the plan become editable. On the phone the bases card and Checks fill the first view; the first day starts at 415 px | The parent sees their plan, cannot touch it, and has to find a button to get permission. This is the create-then-edit wizard seam the owner asked to remove. P3: the first view of a build should answer "what do my days look like". P4: the same rows behave differently on two screens | **The first build lands in the editor.** Stage 5 becomes the editor's "just built" state: one status line "Built 10 days · 1 did not fit · 1 warning", then the bases card and Checks collapsed to one line each, with day 1 open below them and handles live. "Edit my plan" goes. For air kinds, **Getting there becomes the Day 1 and last-day header card** ("Fly into Venice (VCE) · 2 h 30 ≈ to Ortisei · Change"). On the first build it is expanded once, and "Change" opens the stage 6 sheet. Phone step counts end at "Build my days": Day trip 2, Weekend 3, Long weekend 4, Week by car 4, by air 4, Longer 4 (with S1). The URL moves to `/t/<id>/` at the first build with `history.replaceState`, so Back leaves the planner instead of returning to a stale step (also closes L9). Cost: the editor chunk loads at the first build, which the 30 KB re-flow budget already assumes |
| M2 | 7.1 rules; TF11; E5; E6 | A re-flow or rebuild after a server change (driving, pace, nights, base) moves **every unlocked item**. A stop the person moved by hand to Day 4, or reordered, is unlocked, so the next pace change silently undoes their edit. The confirm counts only locks ("3 locked stops stay") | TF11's own reason is "an edit must not be undone by the engine". A parent who moved the lake to the day grandma joins loses it without being told; trust in every later edit goes | **An explicit placement keeps itself.** Move to day, reorder, add to a day, swap and replace set the item's lock with origin `user` (`edits[].locked: "user"`; TB-C2 owns the key). The chip reads "Placed by you · Day 4", and the item sheet offers "Let the plan move it". The toast reads "Moved to Day 4 and kept there · Undo". The rebuild line counts both kinds: "Rebuild 6 days · 3 locked and 2 placed by you stay". Engine-placed items stay free |
| M3 | Day trip and Weekend on phone (FLOW 2.1, F1) | Stage 2 is "done" for both kinds and stage 4 is "done" for Day trip, and F1 has no reach control. **On a phone there is no way to change how far you will drive** except the thin-state button in P9 | "Within 2 h of Toronto" is the main question of a day out. A family willing to drive 3 h for Algonquin cannot ask for it. P3 (the way back is visible) and P4 (state visible and changeable) | For near kinds with stage 2 done, the **first pill on stage 3 is the reach**: "Within 2 h ≈ ▾". It opens the 1 to 8 h segmented control (F2n's control), and its value is in the live count. Stage 1's live count line ("9 places within 3 h ≈") is a button that opens the same control |
| M4 | E1 phone editor (n06); FLOW 7 "the public bottom bar returns" | Trip header 64 + day chips 61 + editor bar 61 (Undo, Settings, Review) + public bottom bar 84, plus the toast. The day gets 68% of the screen. Undo appears twice (toast and bar). This is TB-N's finding C3 again, now in the screen the person lives in | One-handed in a car park (S8, T2), the thumb lands on Trips or Places and leaves the plan. Two bars of buttons read as two apps | **One bottom bar inside a plan.** Until the planner's trip bar ships (components 1.4 "[photo] Plan · Today · Bookings · More"), keep the focused flow in the editor: its action bar (Settings · Review, 84 px with the home inset) replaces the public bar. Undo lives in the toast and in the header's ⋯ menu (Undo, Redo, Rebuild, Make it yours). The trip header's ⋯ also holds "Close plan", which keeps the draft |

### Should-fix (important)

| # | Screen | What is wrong | Why it matters | Exact fix |
|---|---|---|---|---|
| S1 | F2n "How far from Toronto, each way?" and F4 "Driving per day" (n04) | Two driving controls with the same options (2, 3, 4, 6 h) and different meanings. The weekend phone also asks Moves, which means nothing with one base | A parent sets "4 h" twice and cannot tell which one changes the plan (P4: "if a control needs explaining, the control is wrong") | Label them "Longest drive from home, each way" and "Driving on a day out from your base, in total". Ask **Driving per day** only when nights are 3 or more. **Hide Moves** for Day trip and Weekend (one base). F4 then has three controls for long kinds and two for the weekend |
| S2 | F1 for air kinds | The departure airport is never shown, and the note points at the arrival airport | The owner's "start city (nearest airport)". Families choose between nearby airports on price (YYZ, YTZ, BUF) | Under "Starting from", for air kinds: "Fly from Toronto Pearson (YYZ) · 35 min ≈ · Change", with alternates from origin 4.2. Note: "We use this for your flights; the airport you land at comes from where you go." Saved as `origin` (exists) |
| S3 | C2 Make it yours (n10); WC (w01) | A bottom sheet covers every new copy. "Change dates and who" repeats the copy sheet that was just completed. On desktop, "Make it yours" and "Settings" are two header buttons that open the same stage panels | 90% of copiers want the trip as it is with their dates (P7). A sheet on arrival costs them a tap and hides the trip they chose | A **non-modal card** at the top of Day 1 on first open: "Make it yours: Change places · Your driving and pace · Where you start", with "Keep it as it is" as its dismiss. Afterwards it is a section at the top of Settings. Drop "Change dates and who" from the card (it is in Settings › Start). Desktop: one Settings button; the card sits inline above the day, not in a fifth column |
| S4 | F8 Review (n11); F-Q4 | "Keep in Mine" is the primary, but TF13 already put the draft in Mine at its first pick. The shot shows the button directly above "Kept on this phone" | A button that does nothing teaches people that buttons lie (T3). They also wonder whether the earlier sittings were lost | **No save button.** A state line: "In Mine · on this phone" (signed in: "In your account"). Primary by state: dated → **Add to calendar** (days and book-by deadlines); undated → **Add dates** (needed for book-by dates). Secondary: Copy link, PDF, and, signed out, "Sign in to keep it on every device" |
| S5 | F8 Book ahead; 7.1 book-ahead rows | With "Not sure yet" or a month there is no date to count back from. "Ortisei stay · now (July)" is a generic rule for lodging, for which we hold no data | A wrong or invented deadline costs a booking (T1, T3) | Month only: "by about 1 Jun ≈ (for early July)". "Not sure yet": the section reads "Add dates to see book-by dates" with the item names kept. Lodging rows appear only when `core/src/bookings` has a sourced rule, labelled "rule of thumb ≈" |
| S6 | 7.1 keyboard and gesture model | It conflicts with components 8.1: Alt+Up/Down and `M`+number against Space, arrows and PageUp/PageDown, and long-press 400 ms against 300 ms. The single-letter keys (`M`, `S`, `A`, `L`, `R`, Delete) breach WCAG 2.1.4 unless scoped | Keyboard and screen-reader users get two models. A stray `R` while typing a note rebuilds | Keep 8.1 as the drag model (Space, arrows, PageUp/PageDown, Esc) and 300 ms on phones. The letter keys work **only while focus is on a plan row or the day document, never in a field**, are listed under `?`, and can be turned off in one setting. `R` opens the rebuild line (L5) and never rebuilds directly |
| S7 | F3 near strip (n03) | The strip opens inside the list under every pick and pushes the rows below. Strips pile up as you pick. The Map pill covers its second row and Pick button. The drive time wraps under the name | One-handed scrolling loses its place; a misplaced tap picks the wrong place (T2, P5) | **One strip at a time**, under the latest pick, **collapsed** to one row "3 places near Lago di Braies · Show", expanded on tap. Earlier strips move into the tray sheet ("Near your picks"). Rows have two lines: name, then "15 min ≈ from Braies". Move Map into the action bar's left slot (as F5), or give the list 72 px bottom padding so the pill never covers a control |
| S8 | Stage 4 "We plan by car" (TF17) | The car-only limit is disclosed at stage 4, after three stages of picking | A family without a car invests its time and then learns the plan does not fit them | Add "by car" to the kind tiles' meta (Day trip, Weekend, Long weekend, A week by car), and to F1 for air kinds: "We plan a hire car from the airport" |
| S9 | Near strip, "Also within your driving", E4 "fits here" | FLOW ranks them "by score" and does not say whether the party fit and the month apply | A suggestion that does not fit a 6-year-old, or is closed in July, undoes the stage 3 filters (T4, T1). The P2 safety exception applies to suggestions too | All three use the stage 3 query (kids, month, Looking for). Unfit or closed items are never suggested. Rows carry the same fit, safety and booking chips as candidates (F3s already shows "Book ahead") |
| S10 | Stage 7 header, "photo or kind colour" (FLOW 7) | A kind colour makes every weekend draft the same colour | Scenario rule 3: two trips are never told apart by name alone | Give each draft an identity colour from the fixed set when it is created, and use the first pick's photo when one exists |
| S11 | Stage 6, open jaw | Choosing "out of MXP" re-flows only days 1 and N; the base order may now run backwards | Day 10 gains hours of driving with no warning (T3) | Changing the arrival or departure airport re-runs the base order on the server with locks kept. If the bases are locked: a warning "Out of MXP adds 2 h 10 ≈ on Day 10 · Reverse the bases" |
| S12 | Empty and error states | Not designed: the device draft cap (20) when it is reached; a pick no longer in the catalogue on resume; resume to "no build" must not run the engine; nights below the estimate before Build; a shared link with refs the recipient cannot see | Each is a dead end the first time it happens | Cap: "20 plans on this device. Delete one or sign in to keep more." Stale ref: "1 place is no longer in our list · Remove it", kept in Did not fit. Resume with picks and no build: open stage 4 with "Build my days" as the primary, never an automatic build. Nights below the estimate: the count card reads "Your 9 picks need about 6 days; 3 nights will leave about 5 out" before Build. Shared link: "2 places in this plan are not public · showing 7" |

### Polish

| # | Screen | Fix |
|---|---|---|
| L1 | F1 (n01) | "Next: Discover" should read "Next: Pick" (the stage was renamed) |
| L2 | F4, F5 (n04) | The estimate is in days and the stepper in nights ("About 6 days", "Nights 9", "Your 10 days"). Use "About 6 days (5 nights)" and label the stepper "Nights · 10 days" |
| L3 | F0 drafts | "Italy · 9 places · Build" reads as a command. Use "ready to build" and "built, edited today". Show three drafts, then "All plans in Mine" (P1) |
| L4 | F0 kind tiles | A tile tap advances to stage 1 (one tap, not tap and Next). Tiles become buttons; Back returns with the tile marked |
| L5 | E5, E6 | Two confirmations for a rebuild (Apply, then a dialog), while Remove has none (patterns 4.4: undoable means no confirm). Use one Apply button that states the effect ("Rebuild 6 days · 3 locked stay") and an Undo toast. Drop the E5 dialog |
| L6 | Desktop rail (W0 to W8) | The rail lists "7 Edit > 8 Review", but the editor uses the trip header, not the rail. The rail should show stages 0 to 6 and end with a "Your plan" node |
| L7 | FLOW 2 Mermaid | Stages 7 and 8 use a green fill (`#2F6B4F`). This is allowed for a documentation diagram and does not touch the product palette (`--ok` is blue: `#1F4E8C` light, `#8DB6EE` dark). Keep it out of any UI mock |
| L8 | E2 item sheet (n07) | Nine rows fill 59% of the screen. Put "Move to day…" first, and make Move up and Move down one row with two 44 px buttons |
| L9 | TF9 URL | Say when `/plan/?draft=` becomes `/t/<id>/`: at the first build (M1) |

## 3. Step count and cognitive load (phone)

Taps to an editable plan, using every default and one pick:

| Kind | As designed | With M1, M3 and L4 |
|---|---|---|
| Weekend | 7 (tile, Next, Next, Pick, Next, Build my days, Edit my plan) | 5 |
| Day trip | 6 | 4 |
| A week by air | 11, plus typing and picks (Getting there and Edit my plan included) | 8 |

Controls per screen:

| Stage | Controls | Load |
|---|---|---|
| 1 Start | 3 blocks | Light |
| 2 Where | 2 to 3 | Light |
| 3 Pick | 4 pills, two lists and the tray | Heaviest, but familiar from Places (keep-from-live-site) |
| 4 Days and driving | 4 controls plus a list | Too much for a weekend; S1 makes it 2 or 3 |

The "asked stages only" count (TB-N Q-TB-N5) stays right.

## 4. Defaults and skip rules

Sound:
- Every input after the kind is pre-filled.
- "Not sure yet" is scored as unknown, never as open.
- Pace and moves come from the party.

Fix:
- **M3**: a stage shown as done must still be changeable on the phone.
- **S1**: hide controls that mean nothing for the kind.
- **S12**: resume must never run the engine on its own.

## 5. Editor interaction model

| Area | Verdict |
|---|---|
| Moves, reorder, swap, replace, add with "fits here", remove without confirm, lock, must see, days, notes, undo and redo | All right |
| "Move to day" with free time and the driving change (E3, n08) | The best screen in the set (P6) |
| Warnings with one fix on the day header | Right |
| Book-ahead rows that follow their stop | Right |
| Undo (50 steps per session, not synced) | Acceptable; the C3 notice should not imply that Undo survives the session |
| Hand edits on rebuild | **Must fix (M2)** |
| Keyboard model | **Should fix (S6)** |
| Confirms | Polish (L5) |
| Phone drags never cross days | Right (WCAG 2.5.7) |

## 6. Copy journey

| Area | Verdict |
|---|---|
| C1 and C2 (template draft with its own party, straight into the editor) | Right. Copy goes where the owner asked |
| C4 (shape-keeping edits stay in template mode) | Right |
| C5 conversion in place, with an honest notice and Undo | Right |
| C3 (days become locked edits when converting) | Matches M2. The rebuild line should name them "from our trip" |
| S10 "Done" trips that open as templates | Enter the same way |
| The arrival sheet | Should be non-modal (S3) |

Foundation: patterns 5.2 (the copy done step "Open in Mine") must be amended to "open the copy in the editor". This
belongs to the TB-N foundation pass, below.

## 7. Accessibility

Meets:
- Every drag has a menu and a keyboard path.
- No swipe.
- The map is never required.
- Live regions announce counts, builds and moves.
- Lock, must see and warnings use words, not colour alone.
- Targets are 44 px on phone.
- Inputs are 16 px.

Gaps:
- S6: WCAG 2.1.4 and the two keyboard models.
- The toast's 6 s Undo is fine only because the ⋯ menu also holds Undo; keep it there after M4.
- Focus after Remove moves to the next row: specify "or the day's Add row when the last row was removed".
- Changed rows "flash" after a move: under reduced motion, use a static "moved" marker for 6 s, not nothing.

## 8. Principles

| Principle | Verdict |
|---|---|
| P1 scale | Pass. Paginated candidates, 6-row strips, 12 suggestions, country field and travel regions. L3 for the drafts list |
| P2 progressive | Pass, with S9 (the safety chips on suggestions) |
| P3 a glance | Fails at F5 (M1), passes elsewhere |
| P4 no manual | S1 (two driving numbers), S4 (no-op button) |
| P5 linked open and close | Pass. Sheets return to the same day and scroll. M2 protects the person's context |
| P6 the right metadata | Pass. "Fits here", the Move-to-day deltas and book-ahead on the stop |
| P7 the 90% | S3 (copy sheet). No header Plan tab is kept (TB-N I3) |
| P8 protect the catalogue | Pass. Light rows; the build returns only the picks; per-draft PDF and ICS; the share link carries refs and never the party |
| P9 server-ready | Pass. Everything goes through `PlanService` and `DataClient`, and the client re-flow uses the build's picks matrix (no bulk load) |
| T1 when | S5 |
| T3 age | S5, S12 |
| T4 families | S9 |
| T5 honest maps | Pass. No rings, flights not drawn |
| Scenario rules 1, 3, 4, 9 | 1 pass; 3 needs S10; 4 pass ("Add to a plan" asks which plan); 9 needs L9 |
| No green | **Pass.** The fit chip uses `--ok` (blue). The only green is the doc diagram (L7) |
| Under 100 users | Pass. Collaboration and budget are deferred for the right reasons |

## 9. Items moved to later: correctly deferred?

| Item | Verdict |
|---|---|
| Budget band and running total (TF16) | Correct. A total built on 50 of 504 prices would be too low. Add a "Free" chip where a zero price is known, and say "EUR 74 for 5 of 9 places priced" |
| School and public holidays | Correct (no reference data) |
| Mobility as a party field | Correct; v1 uses filters |
| Pets' lodging | Correct |
| First-timer profile | Correct |
| No-car, train, camper, EV routing | Correct to defer. The **disclosure** is too late (S8) |
| Practical must-haves checklist | Correct; the one-line entry-rules link is enough for v1 |
| Collaboration (votes, comments) | Correct at under 100 users; the share link covers v1 |
| Compare destinations | Correct |
| Packing list, Today view of a draft, post-trip notes | Correct |
| Per-place "what changed" list | Correct, **but** the minimal stale-ref state is v1 (S12) |
| **Not planned at all: a rainy-day option** | **Wrongly missing.** Mountain trips with children need a plan B, and the data exists (`indoor`, metadata M16). v1-lite: E4 "Add to Day n" gets a "Rainy day" chip that filters on `indoor`, about 1 h inside ED. No new data |

## 10. Answers to F-Q1 to F-Q6

| # | Answer |
|---|---|
| F-Q1 | **Agree: research later**, on one condition. Toronto is the default start (nearest public hub), so the first near-kind view most visitors get is 4 places. FS-1 must show the honest thin state in stage 1's live count, before Pick ("4 places within 3 h so far · Ask us for more"), and keep the trip-mode kinds as the launch story (Dolomites, Rockies). If the owner wants weekends from Toronto as the launch story, fund the batch |
| F-Q2 | **Yes**, with an exit rule: one action layer in `web/components/plan/editor/**`, and the `/plan/` stage 7 mount is deleted in the same ED task that mounts `/t/[id]/`. Two renderers never ship in two releases |
| F-Q3 | **Yes, in place.** The notice must not imply that Undo lasts beyond this session. The Mine row label changes at once ("your plan · from our Dolomites trip") |
| F-Q4 | **No, neither "Save to Mine" nor "Keep in Mine".** The draft is already in Mine (TF13). Show the state and make the primary the next real job: Add to calendar, or Add dates (S4). This also keeps the foundation's "never 'saved' for a copy" rule |
| F-Q5 | **Yes.** Known costs only, each dated, with "Not priced" named. Add the "Free" chip and the "of N priced" count |
| F-Q6 | **Yes.** This is not a design concern; nobody sees the table name. Ship the migration and the code together (or with a one-release compatibility view) so the live sync never meets a missing table |

## 11. Contrast of every pair the mocks use (WCAG 2.x, from `web/app/themes.css`)

All pass AA. Text pairs are 4.5:1 or more; UI pairs are 3:1 or more.

| Pair | Where | Light | Dark |
|---|---|---|---|
| `--header-ink` on `--header` | step and trip header titles | 14.82 | 17.49 |
| `--header-mute` on `--header` | header sub-line, bottom bar labels | 8.98 | 10.60 |
| UI: `--accent` on `--header` | current bar icon, header rule | 6.38 | 7.53 |
| `--ink` on `--surface` | names, sheet rows | 16.06 | 13.83 |
| `--ink` on `--bg` | count card, lists | 14.85 | 15.28 |
| `--ink` on `--surface-2` | hovered or current row | 13.66 | 12.24 |
| `--muted` on `--surface` | meta lines | 6.94 | 7.45 |
| `--muted` on `--bg` | captions, count state | 6.42 | 8.23 |
| `--accent-text` on `--bg` | live count, book-by dates | 5.85 | 8.83 |
| `--accent-text` on `--surface` | current outline day | 6.33 | 7.99 |
| `--accent-text` on `--accent-soft` | Picked, active pills | 5.56 | 7.26 |
| `--accent-ink` on `--accent` | primary buttons, current day chip, selected segment | 6.96 | 6.96 |
| `--ok` on `--ok-soft` | "Fits age 6" (blue, no green) | 6.85 | 7.56 |
| `--warn` on `--warn-soft` | warning chips, Did not fit reason | 6.11 | 7.84 |
| `--ink` on `--warn-soft` | caution banner text | 14.17 | 13.05 |
| `--ink` on `--info-soft` | notices, the C3 banner | 13.24 | 12.74 |
| `--info` on `--info-soft` | notice icons | 5.91 | 7.61 |
| `--crit` on `--surface` | "Remove from the plan" | 6.61 | 7.01 |
| `--toast-ink` on `--toast-bg` | Undo toast, Map pill | 14.85 | 15.28 |
| UI: `--line-2` on `--surface` | pills, steppers, switches at rest | 3.67 | 3.42 |
| UI: `--line-2` on `--bg` | day chips at rest | 3.39 | 3.78 |

No new token is needed for any fix above.

## 12. What TB-N2 still owes (not done in this pass)

- **TB-N alignment.** The design note and its foundation proposals (components 9, patterns 3.12, tokens 2.2, the
  specimen section, changes row 33) are on `public/TB-N` and not merged. When they merge, they must take this
  review's fixes: M1 changes patterns 3.12 (the build lands in the editor), M4 changes the focused-flow rule, and S3 and
  F-Q4 amend patterns 5.2. I did not change the foundation here, so the six foundation files stay consistent with each
  other.
- **FLOW.md edits.** The planner applies M1 to M4 and S1 to S12 to FLOW.md and the wireframes. A short re-review
  follows, on the new frames, before the TB-W1 and ED briefs.

## Change log

- 2026-10-27: created (TB-N2, `travel-design-reviewer`, Opus 5.5).
