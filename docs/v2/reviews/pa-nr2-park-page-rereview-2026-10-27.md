# PA-NR2: short re-review of the revised park page and /parks (PA-N)

Reviewed 27 Oct 2026 by travel-design-reviewer on **Claude Opus 5.5**, branch `design/PA-N` at de883126 (the revision
that applies [PA-NR](pa-nr-park-page-review-2026-10-27.md)). Inputs: `docs/v2/design/park-page/` README (sections 2, 5,
7, 10), anatomy, states, parks-index, components, a skim of data-map and acceptance (AC-25), `docs/v2/features/trip-builder.md`
2.5, and `docs/v2/design/trip-builder/FLOW.md` on `design/TB-FLOW` (3f7cd314).

**Verdict: approve for the owner at G-PA.** All six must-fix (M1 to M6) and all nine should-fix (S1 to S9) are resolved
in the docs and hold up in the rendered mocks. Nothing below blocks G-PA. One important item (the `cc` case) and four
polish items are edits to make before PA-2 starts. The planner can apply them, or FND-PA can fold them in.

## 0. How it was rendered

The four mocks in [pa-nr-mock/](pa-nr-mock/) were rewritten to the revised design (tokens from `web/app/themes.css`
only, the site's fonts). Changes: Save to a trip as the filled primary, Share and the heart as icon buttons, the four Plan
a visit links in a `role="group"`, the new glance, the new section order, the map after Safety on phones, the window chip
under the name on phones, stale prices as text, the notice banner on Lake O'Hara, and `/parks` as a one-column List with
"Season not checked". Playwright Chromium with the Metal GPU flags rendered each mock at 2x, at 1440 x 900 and 390 x 844,
in light and dark. Dark was set by the page's theme button, which sets `data-theme` and writes `travel:v1:theme` as
`ThemeToggle` does. Tall pages were read in viewport tiles (Banff 390: 6 tiles). 46 tiles are in
`web/test-results/shots/pa-nr2/` (gitignored). No page scrolls sideways at either width (`scrollWidth` equals the
viewport).

Measured from the render:

| Check | Banff | Lake O'Hara | Castle | Rule |
|---|---|---|---|---|
| Entry heading top at 390 x 844 | 919 px | 847 px | 295 px | AC-25: above 1,244 px. **Pass** (was about 1,290 on Banff) |
| Map card at 390 | 1,905 px, after Safety (1,771) | 1,615, after Safety (1,482) | 393, after the entry row (295) | PN18. **Pass** |
| Action row at 390 | one row: Save, Directions, two 44 px icons | one row | one row | M1. **Pass** (the heart used to wrap to a third row) |
| Plan a visit at 390 | 2 rows, all one-line labels, 44 px | 2 rows | not drawn (fewer than 3 members) | M3. **Pass** |
| Filled `--accent` buttons | 1 | 1 | 1 | AC-7. **Pass** |

Committed shots for the owner, in [pa-nr2-shots/](pa-nr2-shots/):

| Shot | What the owner should look at |
|---|---|
| `banff-1440-light-t0.png` | desktop first view: one amber Save to a trip, Plan a visit as quiet links, the caution banner naming Johnston Canyon, the glance with Entry: Fee |
| `banff-390-light-t0.png` | phone first screen: the action row on one line, the four Plan a visit links, the banner and the glance |
| `banff-390-dark-t1.png` | phone screen 2: Entry and bookings with the window chip under each name |
| `banff-390-light-t2.png` | phone: the map card after Safety and rules, then Seasons and closures |
| `ohara-1440-dark-t0.png` | a zone between seasons: notice banner (slate, not amber), glance Season Jun to Oct, Entry Fee · book ahead |
| `ohara-390-light-t1.png` | a stale fee shown as text ("read Mar 2026, may have changed"), no coral chip; the lottery chip under the name |
| `castle-1440-light-t0.png`, `castle-390-dark-t0.png` | basics only: entry gap row first, the map under it on phones, no Plan a visit, no "Ask us" link |
| `parks-1440-light-t0.png`, `parks-390-dark-t0.png` | `/parks` List: "Open in July" first, then "Season not checked" with Banff in it; two chips per row |

Mock values are Banff's and Lake O'Hara's records where the anatomy gives them. The airport (YYC, ORG planned), the Lake
O'Hara gateway and member count, and the other Alberta parks on `/parks` are placeholders that show the layout. They are
not data. The `/parks` mock shows v1 (PA-IX) without the Drive time pill, which arrives with PA-IXD.

## 1. The PA-NR findings, re-checked

| # | Resolved? | Where it now lives | Seen in the render |
|---|---|---|---|
| M1 | **Yes** | PN7; anatomy 1 row 2, 2, 3; components 1; AC-7 | one filled button on all three park pages; Share and heart are 38 px icons (44 on phones) |
| M2 | **Yes** | PN6; README 5, R1, diagram; states 5; AC-7 | links carry `m`, `n`, `p` (and `cc`), no `within` |
| M3 | **Yes** | PN6; README 5; anatomy 2, 3, 7; AC-7 | "Day trip", "1 night", "2 nights" on one line each, no sub-label |
| M4 | **Yes** | PN18; anatomy 1 (phone row), 3; states 2; AC-25 (844 + 400 px) | Entry at 919 / 847 / 295 px |
| M5 | **Yes** | PN20; parks-index 3, 6; AC-18 (Banff fixture in the second group) | Banff under "Season not checked", nothing dropped |
| M6 | **Yes** | PN15; parks-index 2, 3; data-map 2; AC-19; PA-IXC | `drive=toronto-3`, no `from`; unknown hub, town or point dropped |
| S1 | **Yes** | anatomy 1 to 3; AC-1 | Seasons is section 3 at 1440 and after the map at 390 |
| S2 | **Yes** | PN13; anatomy 1 row 4; data-map 1 | Entry fact links to `#entry`; visitor centres gone (see P2 below for one stray row) |
| S3 | **Yes** | PN12; anatomy 1, 4; components N1 | Entry's state line counts campgrounds; windows only in Where to stay |
| S4 | **Yes** | PN6; README 5; AC-7 | fourth link "Part of a longer trip" |
| S5 | **Yes** | PN19; states 3; AC-11 | stale price as `--muted` text; chip kept for windows and closures |
| S6 | **Yes** | PN14; parks-index 4; components N5; AC-20; PA-IX 5 h | List, Cards, Map; no split |
| S7 | **Yes** | PN11; states 4 | Lake O'Hara banner is `--info-soft` with the info icon |
| S8 | **Yes** | PN10; states 4, 4.1 | "Open all year, read <date>"; strip only with a closed or partial month |
| S9 | **Yes**, with P1 below | parks-index 3, 4.2, 5; Q-PN4 | two chips; places inside in the meta line; Sort in the Filters sheet |
| Polish (5 items) | **Yes** | anatomy 3, 5, 7; PN11; Q-PN9; AC-3; R7 | `role="group"`, banner names the member, "Park" fallback, anchored grep, no "Ask us" until REQ |
| Components | **Yes** | components 2 | N1 to foundation 3.8 in FND-PA; N2 folded; N3 a prop; N4 `ListRow variant="two-line"`; N5 deferred |

## 2. The link contract against TB-FLOW and trip-builder 2.5

| Check | Result |
|---|---|
| Keys | `m`, `n`, `p`, `cc` all exist in trip-builder 2.5. No `within`, `from`, `r`, date or party. **Match** |
| `n` range | 0, 1, 2 are inside near mode's 0 to 5 (trip-builder step 1). **Match** |
| No `from` on near links | the builder opens on "From where" (FLOW.md stage 1, OR11 one picker). **Match** |
| Park pick pinned as the trip's area | asked of the builder as R1. FLOW.md (3f7cd314) does not yet say what a protected-area pick does, and no BACKLOG row tracks R1 yet. **Open dependency, not a G-PA blocker**: the Plan a visit group is drawn only with `planBuilder` on, so nothing ships before the builder takes R1 |
| `cc` value | **Not pinned.** trip-builder 2.5 writes `cc=IT` (upper case) and the catalogue's country codes are upper case (`core/src/catalogue/stub/fixture.ts`). The park docs write `cc=<country>`, while `/parks` writes `country=ca` in lower case. See I1 |

## 3. New findings

| # | Rank | Screen | What is wrong | Why it matters to a family | Exact fix |
|---|---|---|---|---|---|
| I1 | important | Park page, "Part of a longer trip" (README 5, PN6, AC-7) | `cc=<country>` does not say the case. The rest of the park docs use lower-case country slugs (`/parks?country=ca`), and trip-builder 2.5 uses upper-case ISO codes (`cc=IT`) | If PA-2 copies the `/parks` value, a family that taps "Part of a longer trip" on Banff opens a builder that does not recognise `cc=ca`. They land on an empty country step and the park pick has no country around it | Write `cc=<ISO 3166-1 alpha-2, upper case>` with the example `/plan/?m=trip&cc=CA&p=banff-national-park` in README 5, PN6, the diagram node TRIP, R1's fallback and AC-7. Add to AC-7's unit: "`planVisitHref` writes `cc=CA` for a park whose chain country is `ca`". Ask the builder (R1) to read `cc` without regard to case as well |
| P1 | polish | `/parks` rows on a phone (components N4, parks-index 4.2) | N4 says the two-line row is 72 px. Rendered at 390 the rows are 98 to 152 px: name, meta and chips are three lines, a long name wraps, and "Entry not checked yet" plus a season chip do not fit one chip line in about 266 px. The meta line also repeats "Alberta" under an "Alberta" group heading | Fewer parks per phone screen, and the 72 px figure would make PA-IX's verifier fail a correct build | In components N4, say "about 96 px at 1440; grows when the name wraps on phones". Drop the area from the meta line when the group heading already names it (parks-index 4.1 bullet 1). On phones, when entry is `not_checked`, let the chips wrap to a second line rather than shorten the honesty label |
| P2 | polish | data-map 1, anatomy 2 (Not checked yet block) | data-map still has a row "Glance: designations", and Banff's Not checked yet block lists "Glance: summary, photo, designations". PN13 caps the glance at Season, Entry, Camping, places inside, gateway, airport | A seventh glance fact would come back by the data map, which is what PA-2's builder reads | Move the designations row to "Cover: relevance badge or summary line" in data-map 1, and change the anatomy 2 gap line to "Cover: summary, photo, designations" |
| P3 | polish | Park page, phone wireframe (anatomy 3) | The ASCII frame draws Share and the heart on a second line under Save and Directions, while its note says one row from 375 px. The render fits one row at 390 | A builder reading the frame may build the wrap | Redraw the line as `[## Save to a trip ##] [Directions] [sh] [♡]` on one row, and keep the note on wrapping Directions below 375 px |
| P4 | polish | Castle, basics only (states 2) | The compact template keeps the entry gap row at rest but puts "safety and wildlife" only in the Not researched yet list, with no alerts link. The full template always shows the alerts link at rest (anatomy 1 row 6) | A family at a basics-only park in bear country should still get one tap to current alerts and fire bans (P2 safety exception) | In states 2, add "Current alerts ->" under the entry row when the official alerts link is held (the same link Safety and rules draws on a researched park); otherwise nothing |

## 4. Colour and contrast

`web/app/themes.css` has not changed since the first review (`git log 1cd4ecb6..de883126 -- web/app/themes.css` is
empty), so the pairs measured in [PA-NR section 3](pa-nr-park-page-review-2026-10-27.md) still hold. The pairs that carry
the revised pieces (WCAG 2.x, light / dark):

| Revised piece | Pair | Light | Dark | Level |
|---|---|---|---|---|
| Save to a trip (the one primary) | `--accent-ink` on `--accent` | 6.96 | 6.96 | AA |
| Glance Entry link | `--accent-text` on `--surface` | 6.33 | 7.99 | AA (AAA dark) |
| Stale price text "read Mar 2026, may have changed" | `--muted` on `--surface` | 6.94 | 7.45 | AA (AAA dark) |
| The same on the page background | `--muted` on `--bg` | 6.42 | 8.23 | AA (AAA dark) |
| Notice banner text (Lake O'Hara) | `--ink` on `--info-soft` | 13.24 | 12.74 | AAA |
| Notice icon | `--info` on `--info-soft` | 5.91 | 7.61 | AA (AAA dark) |
| Notice "As of" line | `--muted` on `--info-soft` | 5.73 | 6.86 | AA |
| Notice link | `--accent-text` on `--info-soft` | 5.22 | 7.36 | AA (AAA dark) |
| Caution banner text (Banff) | `--ink` on `--warn-soft` | 14.17 | 13.05 | AAA |
| Caution icon, member link | `--warn` / `--accent-text` on `--warn-soft` | 6.11 / 5.59 | 7.84 / 7.54 | AA (AAA dark) |
| Icon button, Plan a visit and chip borders (3:1) | `--line-2` on `--bg` | 3.39 | 3.78 | passes 3:1 |
| Active Open in pill | `--accent-text` on `--accent-soft` | 5.56 | 7.26 | AA (AAA dark) |

All pass AA. No green anywhere: accent is amber, info is slate blue, honesty is coral, and `--ok` is not used.

## 5. Principles

| P | Verdict |
|---|---|
| P1 scale | Pass. "Season not checked" is counted, the 10,000 synthetic check covers it |
| P2 progressive, safety exception | **Pass on phones now** (Entry in the first scroll on all three). P4 above for basics-only parks |
| P3 glance | Pass: can we go (Season), what does it cost (Entry), can we camp (Camping) |
| P4 no manual | Pass: one-line chip labels, nothing dropped by Open in |
| P5 smooth | Pass, unchanged |
| P6 right metadata | Pass: campsite windows in one place; stale prices as text |
| P7 primary goal | **Pass now**: one filled Save to a trip on every park page |
| P8 catalogue | Pass: row keys `entry` (five values) and `members` only |
| P9 server-ready | Pass: `drive` and the builder keys reuse existing codecs; I1 pins the last value format |

## 6. What the owner decides at G-PA

The revised screens in section 0. Nothing else is open for the owner: Q-PN1 to Q-PN9 were answered on 27 Oct 2026. After
G-PA: I1 and P1 to P4 (doc edits, about 0.5 h, planner or FND-PA), then FND-PA, then PA-IXC, PA-2 and PA-IX as in README 9.
R1 should get its own BACKLOG row under the Trip Builder before PA-2 turns on the Plan a visit group.

## Change log

- 27 Oct 2026: written (travel-design-reviewer, Claude Opus 5.5). Mocks in `pa-nr-mock/` rewritten to the revision.
