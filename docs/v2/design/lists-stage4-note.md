# LST stage 4: pre-build design note

Reviewer: travel-design-reviewer (Opus), 19 Oct 2026, `public/LST`. Rules for Part 2 and the S5 part of Part 3. It is drawn from review-L3b, review-SQ1b, smart-search.md and the current code (`FilterBar.tsx`, `GlobalSearch.tsx`, `filters.css`), with no render; the after-review renders. Tokens are from `web/app/themes.css`. Screen budget: 390 x 844, phone header 56 px (`--phone-header-h`), bottom bar 84 px (`--phone-bottombar-h`).

## 1. Collapsed phone filter bar (under 640 px)

```
at rest, top of list (in flow, covers nothing)      scrolled (sticky, 52 px)
+--------------------------------------+            +--------------------------------------+
| [Search places            ] [Filters 3]|          | 11 places · 3 filters      [Edit v] |
| Country · Kind · Season · Kids  pills |            +--------------------------------------+
| 11 of 125 trails · for age 6          |          expanded (overlay, max 380 px)
| 50 not checked yet · Why?             |          | 11 places · Read as 3 filters [Undo][Edit ^]|
| (Kind x) (Youngest child 6 x) Clear all|         | [Search places                     ] |
+--------------------------------------+            | (Kind x) (Youngest child 6 x) +1  Clear all |
                                                    | [Country ] [Kind    ]                |
                                                    | [Season  ] [Youngest child]          |
                                                    | [More filters]                [Done] |
                                                    +--------------------------------------+
```

- **States.** In flow at the top, the bar is the full bar of today. It covers nothing, so it has no cap. Once its bottom passes under the phone header (an IntersectionObserver on a sentinel, not a scroll handler), a sticky summary shows at `top: var(--phone-header-h)`, `z-index: var(--z-sticky)`.
- **Summary.** It is 52 px tall: a 44 px row (`--touch-min`) plus `--s-1` padding top and bottom, with a `--b-hairline` bottom border, on `--surface`. Text is `--t-label` in `--ink-2`, and the count is `--t-mono` in `--ink`.
  - Content: "{n} {noun} · {k} filters", then an Edit button (44 x 44, `aria-expanded`, `aria-controls`).
  - With no filters it reads "209 places · Filter".
  - While the shards load, it reads "Counting…".
- **Smart reading.** With an applied reading, the second clause becomes "Read as 3 filters", and an Undo button (44 px) sits before Edit. The full query is in Undo's accessible name.
  - The undo row is never sticky in any other form (SQ1b M3). In flow, it renders above the results and scrolls away.
- **Expanded panel.**
  - Opens below the summary as a non-modal overlay: no scrim, no `inert`, no focus trap.
  - `max-height: 380px` including the summary (45% of 844), `overflow-y: auto`, `overscroll-behavior: contain`, `--e-2`, bottom radius `--r-4`.
  - Holds:
    - the search box;
    - the active chips on one line, wrapping to two at most, then "+N";
    - Clear all, beside the chips;
    - the primary pills as a two-column grid of 44 px buttons, each opening its menu in place;
    - "More filters", which opens the existing PhoneFilterSheet;
    - Done.
- **Scrolling.** The summary stays put: it does not hide on scroll down, because jitter costs more than 52 px. An open panel closes after 48 px of page scroll unless focus is inside it. Esc and Done close it, and focus returns to Edit.
- **Motion.** The panel opens through `grid-template-rows: 0fr` to `1fr` with opacity over `--d-base` `--e-out`, and closes over `--d-sheet-close` `--e-in`. The chevron turns 180 degrees, and the count tweens over `--d-count`. The summary fades in over `--d-fast`. With reduced motion, everything jumps.
- **Cap.**
  - The sticky summary is 52 px (6.2%), or 12.8% with the header, and never more.
  - Expanded, it is at most 380 px (45%).
  - The e2e test measures both after scrolling, with three filters and an applied reading.

## 2. Non-modal header search (S5)

```
desktop 1440                                   phone 390
| header ............... [Search  /] |         | header                              |
|                  +---------------+ |         +-------------------------------------+
|  page stays      | [query      x]| |         | [query                           x] |
|  live, scrolls   | > Show 11 places|         | > Show 11 places                    |
|                  | TRIPS 2         |         | TRIPS 2 · PLACES 5 · AREAS 1        |
|                  | PLACES 5  See all|        | ...  (scrolls inside)               |
|                  | AREAS 1         |         +-------------------------------------+
|                  +---------------+ |         | Home  Globe  [Search*]  Trips  Me   |
```

- **Desktop.**
  - The panel is `position: fixed` at `top: calc(var(--header-h) + var(--s-2))`, with its right edge on the header's content edge.
  - Size: `width: min(640px, 100vw - 2 * var(--margin))`, `max-height: min(70vh, 640px)`.
  - Style: `--z-menu`, `--e-2`, `--r-4`, on `--surface`.
- **Phone.**
  - The panel spans the full width from `top: var(--phone-header-h)` down to the bottom bar: `max-height: calc(100dvh - var(--phone-header-h) - var(--phone-bottombar-h))`, with the keyboard taken from `visualViewport`.
  - The bottom bar stays visible, and its Search slot shows as open with `--accent-text`.
- **Not modal.**
  - Drop `Dialog`, the backdrop and `aria-modal`.
  - The opener has `aria-expanded` and `aria-controls`. The input is a `combobox` over a `listbox`.
  - The panel renders right after the opener in DOM order, so Tab flows on naturally.
  - The page keeps its scroll, and nothing is `inert`.
- **Closing.**
  - Esc with text clears the text; Esc on an empty box closes the panel and focuses the opener.
  - A click outside closes it, and focus stays where the click landed.
  - Focus leaving the panel by Tab closes it.
  - Page scroll (desktop only) closes it once the input is empty and the page has moved 60 px. Typed text is never lost to a scroll.
- **Results.** The list keeps today's order: first the reading row ("Show 11 places"), then Trips, Places and Areas, five each with "See all N". Group heads use `.gs-group-h`. Arrow keys move through the list, and Enter opens the active row.
- **Bottom bar.** The bottom-bar Search slot and the header button toggle one shared instance through SHL's existing open event, so keep the event name. A second tap on the slot closes the panel, and focus returns to whichever control opened it.
- **Motion.**
  - Desktop opens with opacity and `translateY(-8px)` over `--d-base` `--e-out`, and closes over `--d-fast` `--e-in`.
  - Phone opens with `clip-path: inset(0 0 100% 0)` to `inset(0)` over `--d-sheet`.

## 3. One Kids control

- **Label.** "Youngest child" everywhere: the pill, the active chip ("Youngest child 6"), the smart-search chip, the summary line and the URL label table. "A child of 6" and "fits from N" go away.
- **Picking an age.** `AgeControl` on both pages:
  - a stepper from 0 to 17, where 0 reads "Baby";
  - quick chips for Baby, 3, 6, 9 and 12;
  - "Any age", which clears the age.

  The pill reads "Youngest child · 6".
- **Behaviour.** An age **rule** hides the item; age **advice** fades it. Trips have no rule-versus-advice split yet, so a trip whose fit age is above the chosen age fades and is never hidden. The menu foot says this in one muted line, "Trips above this age fade; none are hidden yet" (`--t-small`, `--muted`).
- **"All ages · checked".** The card chip stays. When an age is picked, all-ages items pass with no extra chip.
- **Not checked yet.** These items are hidden when an age is picked. They are counted as a link in the count line ("50 not checked yet"), and the link opens the collapsed `UncheckedRows` group at the end. A gap is never a yes.
- **The fade and its reason.** Only the media and the glyph fade, to 0.6. Text keeps full contrast.
  - Cards and list rows: the chip under the title (`--surface-2`, `--line-2` border, `--ink-2`, `--t-chip`, 24 px tall).
    - Places: "A stretch at 6 · advice says 8+".
    - Trips: "A stretch at 6 · plan suits 10+".
  - Table: a 56 px "Fit" column after Name shows "8+" in the same chip, with the full sentence as hidden text. An empty cell means it fits.

## 4. The count line (two lines at most)

```
75 of 125 trails · for age 6
50 not checked yet · Why these? v
  +-- (opens in place) -------------------------------+
  | 33 are a stretch at 6, shown faded                 |
  | 4 hidden by an age rule                            |
  | Shape and Dogs hidden: too few trails carry them   |
  | Relaxed: dropped "Any stroller"                    |
  +----------------------------------------------------+
```

- **Line 1.** The count in `--t-mono` `--ink`, "of {scope}" (the scoped kind, not the catalogue), and at most one qualifier: the age, or the reading.
- **Line 2.** The "not checked yet" link and a "Why these?" disclosure button (`aria-expanded`). Both are `--t-small` in `--accent-text`.
- **Behind "why".** The stretch count, the rule-hidden count, the coverage-hidden facets with their reason, relaxed filters, and any other note. It opens in place with the same `grid-template-rows` motion.
- **Text.** `--t-small` (20.3 px line). The test asserts a height of 42 px or less at 390, with Kind and Kids set.

## One-line rulings

- **Effort "not known".** A muted, unselectable last row, "27 not known yet · hidden when you pick one", counted in scope.
- **"Did you mean".** One suggestion, at the top of the list's empty state, as a button that rewrites `q` and keeps the chips. It shows only if the suggestion returns rows.
- **The kind chip.** `k` is never a relax candidate while any other chip can go. If `k` is alone, the empty state says "No waterfalls here yet" and offers the area.
- **Labels.** Chips and pills take labels from the descriptor's option table only. "With kids" without an age is the ask chip. "Easy or a stroll" is one pill, "Effort · Easy, Stroll".
- **Back.** `applied` goes into `history.state`. Back and Forward restore the undo line, and Undo uses `replaceState`.
- **Full-text pass.** Its results show in the same list, narrowing it, with a removable chip `Words: "quiet"`, never as a separate group. If the pass returns 0 rows, it is not applied and the words show as "not used yet" (H4). The header search keeps name hits as their own group.

## Do not

- No scrim, `aria-modal`, `inert` or focus trap, on any overlay in this lane.
- No sticky undo row on phone, and no sticky region taller than 52 px.
- No hiding on a guess: trips fade until a rule split exists.
- No count where the shards are not loaded: show "Counting…".
- No green: links use `--accent-text`, and notes use `--muted`.

## Scores (designed intent)

| P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 | P9 | T1 | T2 | T3 | T4 | T5 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Pass: scoped denominators, Counting… | Pass: "why" disclosure | Pass: 2-line count | Pass: one label set | Pass: linked motion, Esc returns focus | Pass: reason chip on the row | Pass: Show N first | Pass: no new row keys (Fit uses `from`) | Pass: counts via data.ts | n/a | Pass: 6% sticky | n/a | Pass: gaps never a yes | n/a |
