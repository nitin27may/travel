# Review: Account page, travellers editor, first-run setup and the Mine sync chips (ACCT-PR)

Reviewer: `travel-design-reviewer` (Opus 5.5), 27 Oct 2026. Review only; this file is the only change.
Scope: `origin/main` @ `0edda5e2` (ACCT-P1, ACCT-P2 and EM-2 merged). Specs: `docs/v2/features/account-profile-and-travellers.md`
(2.1 to 2.7, 5, 6), `docs/v2/features/edit-my-trip.md` 4.6 and 4.7, foundation principles P1 to P9, components 2.1, 2.2, 2.12, 5.2,
5.4, 6.1, 6.3, patterns 3.7.

## How it was checked

- The builders' shots: `/Users/nks/workspace/travel-wt/shots-ACCTP1/`, `shots-ACCTP2/`, `shots-EM2/` (320, 390, 1440, light and dark).
- Rendered again on `main` (the ACCT-P1 shots predate ACCT-P2, and two sets were taken mid-animation, see Notes N1 to N3), with the
  real components through the same harnesses as `web/tests/account/layout.browser.test.ts` and `travellers.browser.test.ts`
  (Chromium from the Playwright cache, Metal flags, 2x, `reducedMotion: 'reduce'`, dark set by clicking the site's `ThemeToggle`).
  The temporary harness files were removed; the shots are kept in `/Users/nks/workspace/travel-wt/shots-ACCTPR/` (76 files):
  `page-{setup,family,none,failed}-{320,390,1440}-{light,dark}.png` (whole page, header and footer included),
  `step1-empty-*`, `step2-*`, `step2-dob-*`, `done-*`, `name-editor-*`, `editor-*`, `menu-*`, `empty-*`, `vp-dob-*`, `vp-age-*`.
- Code read: `web/app/account/*.tsx`, `web/app/account.css`, `web/components/mine/{CopyRow,SignOutConfirm}.tsx`,
  `web/lib/mine/chips.ts`, `web/components/ui/{Button,Banner}.tsx`, `core/src/db/tx.ts`, `0013_plan_doc.sql`.

**Verdict.** The owner's complaint is answered: the draft box and the stuck "Reconnecting" banner are gone, the name saves, and
travellers are a clear two-step setup with steppers and a per-child Age select. Setup reads well ("What should we call you?", then
"Who usually travels with you?"), Skip is honest, the privacy sentence sits beside Save (AD3), errors wait for Save (P4), and every
colour pair passes AA in both themes. One thing must change before the owner sees it: the Account page's "Saved trips" is not the
same list, words or actions as Mine's "My trips", so "My trips synced when signed in" reads as two different lists. The rest is
should-fix polish of hierarchy and consistency.

## Must-fix

### MF1. "Saved trips" on Account is a second, different list of the same trips (P4, P6, patterns 3.7; EM-S B1)

Screens: `shots-ACCTPR/page-family-1440-light.png` (Saved trips), against `shots-EM2/quiet-1440-light.png` (My trips).
Code: `web/app/account/SavedTrips.tsx:20` and `:137`, `core/src/db/tx.ts:89-96`.

- Mine calls the signed-in copies **My trips** and shows them with dates, party and sync chips. Account calls the same
  `planner_draft` rows **Saved trips**, with "Saved Sat, Oct 24 · 3 d ago" and a "..." menu of Rename and Delete. A parent sees two
  lists with two names for the same thing, which is exactly the doubt the owner raised about sync.
- "Saved" is banned for a copy (patterns 3.7; edit-my-trip 4.7). It appears three times: the heading, every row's meta, and the
  empty state "Trips you copy or build while signed in are saved here."
- The read has no `deleted_at` filter and the Delete is a hard delete (EM-S B1): once `accountTrips` is on, Account lists tombstones
  and its Delete bypasses the tombstone that Mine's Remove relies on. The empty-state promise is also false today with the flag off
  (copies go to the device, not to this list).
- The date is `toLocaleDateString(undefined, ...)`: "Sat, Oct 24" in an en-US browser, while every other date on the site is
  "Sat 24 Oct" and Ways to sign in on the same page says "26 Oct 2026".

Fix (NAV-3's direction, now): rename the section **My trips**; read the same light rows Mine reads (live rows only,
`deleted_at is null`), newest 5, each row a link that opens the trip as on Mine (no Rename or Delete here; managing stays in Mine,
one set of actions), then **See all in Mine**. Meta through the site's date formatter: "Changed 24 Oct". Empty: "No trips in your
account yet." · "Copy a trip while signed in and it is kept here and in Mine." · **Browse trips**. Legacy title-only rows (the
owner's "Nitin" test draft, `doc is null`) show in Mine with Remove only (Q-AP7 stands). Update AP-19 and AP-30 in the spec.

## Should-fix

### SF1. A child "now 18" in the notice is 17 in the summary line (P6, T4)

`shots-ACCTP2/settled-notices-1440-light.png`; `TravellersSection.tsx:228` against `:329` and `:203`. The notice says "Child 1 is
now 18. Count them as an adult?" while the party line and the "differs" notice both say "(17, 9)", because `partyOf` clamps. A
parent reads two ages for one child. Fix: while a grown-up notice is open, the summary line shows the real age from `ageNow` with
the plan note: "2 adults · 2 children (18, 9)" and a muted second line "Trips plan for the 18-year-old as 17 until you choose
below." The differs notice uses the same words.

### SF2. More than one primary button per view in the notices (components 2.1, P3)

`shots-ACCTP2/settled-notices-390-dark.png`; `TravellersSection.tsx:186`, `:215`, `:237`. Two notices stacked give two amber
buttons above the data, and a third (Save travellers) when the editor opens. The notices outshout the one line they are about. Fix:
notice actions are secondary (`Button` default), the first one carries the meaning ("Use saved travellers here", "Move to adults",
"Looks right"); show at most one notice at a time, in the order conflict, differs, grown-up, check ages, storage blocked (the others
wait until it is resolved). Also cut "Save this browser's party" to three words (components 2.1): "Save this party".

### SF3. "Show the latest" throws away the edit in progress without saying so (P4, spec 6.6)

`shots-ACCTP2/conflict-1440-light.png`; `TravellersSection.tsx:250-261`. The conflict notice appears at the top of the section, away
from the Save just pressed, and its only action calls `router.refresh()`, which replaces the open editor's values (8 for child 1 in
the shot). Spec 6.6 says the form is kept. Fix: put the conflict line inside the editor above Save (where the eye is), with two
actions: **Show the latest** (secondary, with the line "Your changes here will be replaced.") and **Save mine anyway** (primary;
re-saves at the new revision). Move focus to the line.

### SF4. The signed-in address is cut to "nitin.exa..." on a phone (P3)

`shots-ACCTPR/page-family-320-dark.png`, `page-setup-390-light.png`; `web/app/account.css:76-82`. On the page whose job is "who
am I signed in as", the address is the one thing a person on a shared phone checks, and at 320 it shows nine characters. Fix:
`white-space: normal; overflow-wrap: anywhere;` and let the Sign out button sit beside the title (it already does); update the pin
in `tests/account/layout.browser.test.ts:184` from `clipped: true` to a wrap check.

### SF5. A failed profile read hides the Name row as well (spec 2.5, fail closed only where needed)

`shots-ACCTPR/page-failed-1440-light.png`; `web/app/account/page.tsx:115-126`. The name lives in Neon Auth (`user.name`), not in
`account_profile`, so it is readable when the profile row is not. Today the whole Profile section becomes the error and Travellers
disappears without a heading. Fix: always render Profile with the Name row; render the Travellers heading with the ErrorState
("We couldn't load your travellers.") under it. The setup card stays suppressed (fail closed), as now.

### SF6. The delete-your-account line is on the page twice (P3)

`shots-ACCTPR/page-family-1440-light.png`; `SignInMethods.tsx:308-310` (strings `deleteBefore`/`deleteAfter`) and `YourData.tsx`.
"To delete your account and everything in it, email ..." under Ways to sign in, then "To delete your account, email ..." under Your
data. Fix: keep it only in Your data (its section), with the longer wording; drop GSI-WAYS string 51 from Ways to sign in.

### SF7. Step 1 with an empty name has a dead Continue (P4)

`shots-ACCTPR/step1-empty-390-light.png`; `SetupCard.tsx:182` (`disabled={!check.ok}`). Email sign-ups start with an empty name
(rule E8), so the first screen they see has a greyed-out primary button and no reason. Fix: keep Continue enabled. Empty plus
Continue moves on and saves nothing (as Skip); an invalid name shows the field error on press. Amend 2.3 rule 1 to match. Also stop
the live error while typing (`SetupCard.tsx:164`, `name.trim() && !check.ok`): errors after the press, as in the travellers editor.

### SF8. "Choose an age." when the date of birth is open and empty (P4)

`shots-ACCTP2/setup-step2-errors-1440-light.png` (child 2); `web/lib/account/travellers-form.ts:60`. The child has two ways to give
an age and the error names one. Fix: when the date field is open, the message is "Choose an age, or enter a date of birth." and it
sits under the pair, tied to both by `aria-describedby`.

### SF9. The setup card is quieter than the rows under it, and repeats itself (P3, P7)

`shots-ACCTPR/page-setup-1440-light.png`, `shots-ACCTP2/setup-done-390-light.png`; `account.css:633-637`, `SetupCard.tsx:155-160`.
- The card's border is `--line` (1.35:1 on `--surface`) while the Ways to sign in rows below use `--line-2` (3.67:1), so the one task
  of a first visit looks less important than a settings row. Fix: `--line-2` border and a 3 px `--accent` top rule on
  `.acct-setup-card`.
- "Two short steps. You can change both later." shows again on step 2. Fix: show it on step 1 only.
- The done state reads "ALL SET" then "All set". Fix: keep the eyebrow "Set up your account" on the done state and the heading
  "All set".
- On a phone the sticky bar at 320 wraps to two rows (Save travellers; Skip for now, Back), 113 px plus the 76 px bottom bar
  (`vp-dob-320.png`). Fix: move **Back** out of the bar to a text button left of the step counter ("Back" · "Step 2 of 2"), so the
  bar is one row: Save travellers, Skip for now.
- `SetupCard.tsx:213`: a failed Skip shows its banner below the sticky bar, off screen on a phone. Fix: render it above the actions.

### SF10. Every row says "On this device" when the account cannot be reached (P6, patterns 3.7 rule 4)

`shots-EM2/on-this-device-1440-light.png`. The card already says "We can't reach your account right now. Changes stay on this
device and are sent when we can.", and both rows repeat "On this device". Patterns 3.7 shows the chip only when the list mixes
both. Fix: no per-row chip when every row is in the same state and the card line says it; the chip appears only on the rows that
differ (over the cap, not merged).

### SF11. Sync state changes are silent for screen readers (WCAG 4.1.3)

`web/components/mine/CopyRow.tsx:85-100`: the chip is `aria-hidden` and the state lives in the link's name, so a row that turns
"Not synced · Retry" is not announced. Fix: one polite live region per list that says, once per change into an exception state,
"Dolomites: not synced. Retry is next to it." Nothing is announced for syncing, and nothing on return to the quiet state.

## Notes (polish, or not a defect)

- **N1. Two builder shot sets were taken mid-fade.** `shots-ACCTP1/name-editor-*` and `shots-ACCTP2/setup-step2-*` caught the
  200 ms `acct-open` animation, so labels and Save look washed out. Settled versions: `shots-ACCTPR/name-editor-*`, `step2-*`. Not a
  defect; future shots should wait for `animationend` or use reduced motion.
- **N2. `shots-ACCTP1/page-*` predate ACCT-P2**: Travellers there is a placeholder with no Add button. Do not show them to the
  owner; use `shots-ACCTPR/page-*`.
- **N3. "Sign in" in the header of the whole-page shots** comes from the harness rendering `SiteHeader` without a session; the
  real header shows the avatar (`shots-EM2/quiet-1440-light.png`). Likewise the near-invisible selected "km, m" in dark
  (`page-family-320-dark.png`) is the Segmented thumb not yet measured in static markup. It is still true before hydration on the
  live site: a CSS fallback `.seg:not(:has(.seg-thumb)) .seg-btn[aria-checked='true'] { background: var(--accent); }` closes it.
- **N4. The name editor shows the name twice** (`name-editor-1440-light.png`: the row value and the field). Hide the value line
  while the editor is open.
- **N5. A one-item menu with a divider above it** (`menu-390-dark.png`; `TravellersSection.tsx:342`, `separatorBefore`). Drop the
  separator when the destructive item is the only one.
- **N6. Two menu triggers** on one page: "More" (bordered text, Travellers) and "..." (`&hellip;` text glyph, Saved trips). Use
  the Mine row's `more` icon for row menus and "More" only for section menus. Moot for Saved trips after MF1.
- **N7. "2 more"** (`shots-ACCTP1/page-many-1440x900-light.png`) reads as text. Add a chevron-down icon and say "Show 2 more".
  Moot after MF1 ("See all in Mine").
- **N8. Steppers sit at the far right at 1440** (`step2-1440-light.png`), 640 px from their labels. Cap the stepper row at
  `max-width: 22rem` so label and control stay together.
- **N9. Empty editor card starts with a hairline** (`shots-ACCTP2/editor-error-1440-light.png`, top of the card): `.acct-editor`
  draws `border-top` even when it is the first child. Use `.acct-editor:not(:first-child)`.
- **N10. Date of birth shows mm/dd/yyyy** in an en-US browser (`vp-dob-320.png`). The native field follows the browser locale;
  acceptable. The derived line "7, from the date of birth" is the check a parent needs, and it is there.
- **N11. Setup step change announces twice**: focus moves to the step heading and the live region says the same words. Keep the
  focus move; announce only the counter ("Step 2 of 2") in the live region.
- **N12. Sign-out question** (`shots-EM2/signout-*`): right. Cancel first and focused, Try again primary, discard as danger, held
  modal, Escape cancels, stacked full width at 320. Only "Sign out and discard it" exceeds three words; it is the clearest wording
  for an irreversible step, so keep it.
- **N13. Chips** (`shots-EM2/quiet`, `syncing`, `not-synced-yet`, `retry`): quiet by default with the card line "Your trips are
  kept in your account.", no "saved" anywhere, Retry is a 44 px button beside the link, spinner stops under reduced motion. Good.
- **N14. 44 px targets**: the 30 px Edit and More faces and the ghost links ("Add date of birth") carry a 44 px `::after` hit area
  under 640 px; steppers are 44 x 44; inputs and selects have `min-height: var(--touch-min)`. Pass.
- **N15. Remove travellers confirm** (`shots-ACCTP2/remove-confirm-*`): Remove first is acceptable because the toast has Undo.
  Hide Edit and More while the question is open.

## Contrast (approved pairs, WCAG 2.x, computed from `web/app/themes.css`)

| Pair | Light | Dark |
|---|---|---|
| `--ink` on `--surface` (values, headings) | 16.06 | 13.83 |
| `--ink` on `--bg` | 14.85 | 15.28 |
| `--muted` on `--surface` (labels, notes, "Not set") | 6.94 | 7.45 |
| `--muted` on `--surface-2` (person legends, "Age" in the child group) | 5.91 | 6.59 |
| `--ink` on `--surface-2` | 13.66 | 12.24 |
| `--accent-text` on `--surface` ("Add adults' ages", "Add date of birth") | 6.33 | 7.99 |
| `--accent-text` on `--surface-2` ("Add date of birth" in the child group) | 5.38 | 7.07 |
| `--accent-ink` on `--accent` (primary buttons) | 6.96 | 6.96 |
| `--on-crit-fill` on `--crit-fill` (Remove, Sign out and discard) | 5.70 | 5.70 |
| `--crit` on `--surface` (field errors) | 6.61 | 7.01 |
| `--crit` on `--surface-2` (child age error) | 5.62 | 6.20 |
| `--info` on `--info-soft` (notice text) | 5.91 | 7.61 |
| `--warn` on `--warn-soft` ("Not synced · Retry") | 6.11 | 7.84 |
| `--toast-ink` on `--toast-bg` | 14.85 | 15.28 |
| `--line-2` on `--surface` (input, stepper and card borders, non-text 3:1) | 3.67 | 3.42 |
| `--line-2` on `--surface-2` (inputs inside the child group) | 3.12 | 3.02 |

Not approved as a boundary: `--line` on `--surface` (1.35 / 1.42) for the setup card (SF9).

## Principles

P3 and P7: the settled page answers "who am I, who travels with me" at a glance; MF1 and SF2 are where it does not. P4: SF7, SF8,
SF3. P5: editors open in place, focus moves in and back, reduced motion jumps (N1 is a shot artifact). P6: SF1, SF10. P8 and P9: no
new public load; the seed module stays off public pages; MF1 removes a second read path for the same rows.

## Screenshots to show the owner

1. `/Users/nks/workspace/travel-wt/shots-ACCTPR/page-setup-390-light.png` (first visit on a phone: step 1 of 2)
2. `/Users/nks/workspace/travel-wt/shots-ACCTPR/step2-1440-light.png` (who travels with you: steppers, per-child Age, the privacy line)
3. `/Users/nks/workspace/travel-wt/shots-ACCTPR/page-family-1440-light.png` (the settled page: name, "2 adults · 2 children (7, 9)")
4. `/Users/nks/workspace/travel-wt/shots-ACCTP2/settled-notices-390-dark.png` (notices; shows SF1 and SF2)
5. `/Users/nks/workspace/travel-wt/shots-EM2/retry-390-light.png` (My trips with the one exception chip)
6. `/Users/nks/workspace/travel-wt/shots-EM2/signout-1440-light.png` (the sign-out question)
