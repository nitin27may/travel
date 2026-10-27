# Park page and /parks: acceptance checklist and build briefs

Part of [the park page design](README.md) (PA-N). **Nothing here starts before gate G-PA** (owner approval of the
screens PA-NR produces) and the dependencies in each brief. Principles cited by number from
[foundation/principles.md](../foundation/principles.md).

## 1. Acceptance checklist (travel-builder, then travel-design-reviewer, then travel-verifier)

Each line is checked on Banff National Park (researched), Yoho National Park's Lake O'Hara area (zone, seasonal bus),
Castle Provincial Park (basics only) and, once PA-R-ON lands, Algonquin Provincial Park (provincial, camping).

| # | Check | How it is measured | Principle |
|---|---|---|---|
| AC-1 | Sections draw in the order of [anatomy.md](anatomy.md) 1; a section with no value and no safety gap is not drawn | Playwright: section ids in DOM order on the four parks; no empty `<section>` | P2, P3 |
| AC-2 | Entry and bookings is the first section under the cover, at rest, on every park, including "Entry not checked yet" on a park with no requirement | Playwright on Castle: the gap row is visible without a click | P2 exception |
| AC-3 | One template: no branch on the park's type in `web/components/places/park/**` | `git grep -nE "national_park|state_provincial|conservation_area|nature_reserve|forest|dark_sky" web/components/places/park` prints only the label map import | PN1 |
| AC-4 | Requirement rows show at rest: name, who needs it, price (3 bands then "+n"), window chip, covered-by, scope, link; "Details" opens in place with validity, channel, proof, change, cancel, quota, read date | unit test of `RequirementRow` against the Banff daily admission, the Discovery Pass, the Lake O'Hara bus and the Moraine Lake shuttle; Playwright opens one Details | P2, P5, P6, T1 |
| AC-5 | No pass-saving line on a park page | unit: no "cheaper" text in the park HTML | QP5 |
| AC-6 | "Inside the park: own bookings" shows at most 4 rows at rest, names every one in the count line, and never hides a row with the "May be out of date" chip in the tail | unit with a fixture of 7 member requirements | P1, P2 |
| AC-7 | Plan a visit: three links with the hrefs of README 5 (`m=near`, `n` 0, 1, 2, `p` and `within` the page's slug), no `from`, `r`, date or party; drawn only with `planBuilder` on and 3 or more members with points; else Save to a trip is the primary button | unit on the href builder; Playwright with the flag on and off; the builder's URL parser test accepts the three links (README R1) | P7, PN6, OR9 |
| AC-8 | Things to do: count cards for every kind present; the three largest groups with at most 6 each; "Show all n" links to `/places?within=<slug>&k=<kind>`; at most 18 member cards in the HTML | unit with a 10,000-member synthetic park; HTML size check | P1, P3, P8 |
| AC-9 | Zone page: kicker "Area of <park>", own rows then "From <park>" rows with `inheritedFrom` | Playwright on the Lake O'Hara area | P6 |
| AC-10 | Member page line "In Banff National Park: daily admission applies (Discovery Pass covers it)" links to the park's `#entry` | Playwright on Moraine Lake and one Banff trail | P6, T1 |
| AC-11 | Stale facts: read dates older than their freshness class add "read <month year>, may have changed"; safety facts add the honesty chip "May be out of date" | unit with a clock fixed past 120 days for prices and 365 for windows | T3 |
| AC-12 | Closed season: banner with "as of <date>" when today is outside every open `season` row; one banner at most; pages revalidate daily | unit with fixed dates on the Lake O'Hara bus (Nov: banner; Jul: none); route config `revalidate` 86400 | P2, T1, T3, PN11 |
| AC-13 | Month strip season variant: open, part, closed, blank; 12 x 1 from 400 px, 6 x 2 below; screen-reader summary line | unit on `MonthStrip variant="season"`; existing trip MonthStrip tests pass unchanged | T1 |
| AC-14 | Basics-only park uses the compact template with the entry row, places inside (when above 0), the trips line, "Not researched yet" and "Ask us to research this park" | Playwright on Castle | P2, P3 |
| AC-15 | No record ref, party, date or home in the HTML or RSC payload | existing privacy detectors on the four park pages | P8, privacy |
| AC-16 | Budgets: every non-park place page +0 B HTML; park pages under their own new baseline; start JS +0 B on every page (the chips are links) | `pnpm --dir web budget:report` before and after | PN17, P9 |
| AC-17 | `/parks` lists only the types of [parks-index.md](parks-index.md) 1; zones absent; group by country with counts; 48 per page | API contract test; Playwright | P1, P4 |
| AC-18 | `/parks` pills Where (two levels), Type, Season, and (after PA-IXD) Drive time; live counts; one "Clear all"; empty result names the filter to remove | Playwright first-use walk with no prior knowledge | P4 |
| AC-19 | `/parks` URL round-trips every key of parks-index 2 in the patterns 1.2 order; `drive` without `from` is dropped; `from` accepts hubs and airport codes only | unit on the parser; a test plants a town id and a point in `from` and expects both dropped | P9, OR9 |
| AC-20 | `/parks` desktop: list beside a sticky map from 1024 px; hover a row rings its pin; click a pin highlights the row; "Search this area" sets `bbox`; phones: List and Map segments keep scroll | Playwright at 1440 and 390 | P5, keep-from-live-site |
| AC-21 | `/parks` rows carry only the allowlisted keys plus `entry` and `members` (and `driveMin`, `driveBasis` only in a `from` response) | the P8 row-key test, updated once by PA-IXC with the waiver noted | P8 |
| AC-22 | No literal colour; tokens only from `web/app/themes.css`; no green | stylelint and the G5-style grep `git grep -nE "#[0-9a-fA-F]{3,6}\b" web/components/places/park web/components/parks` prints nothing | foundation |
| AC-23 | Keyboard: every link and Details reachable by Tab in reading order; focus ring visible; reduced motion jumps | Playwright keyboard walk; `prefers-reduced-motion` run | P5, a11y |
| AC-24 | axe: no serious or critical violations on the four parks and `/parks` in light and dark | `a11y-place.spec.ts` widened | a11y |

## 2. Brief: PA-2, the park template and the member line

- **Goal.** Render every `nature.protected.*` place and zone with the park template of this design, and add the park line
  to member pages, reading only `EntryBlock` and `PlaceContext` through `web/lib/public`.
- **Seat and model.** B1, Sonnet, 10.5 h. Review PA-R2 (Opus), verify PA-V2 (Sonnet).
- **After.** G-PA, PA-Q (EntryBlock), EG-Q and EG-W (members block), UXB-7 (place templates).
- **Files owned.** `web/components/places/park/**` (new: `ParkPage.tsx`, `EntrySection.tsx`, `RequirementRow.tsx`,
  `RequirementGroup.tsx`, `PlanVisit.tsx`, `planVisitHref.ts`, `SeasonsSection.tsx`, `StaySection.tsx`,
  `GettingThere.tsx`, `ParkLine.tsx`, `park.css`); `web/lib/public/places.ts` (the entry join only);
  `web/app/places/[slug]/page.tsx` (one branch: a protected-area place renders `ParkPage`); one additive `variant` prop in
  `web/components/trips/summary/MonthStrip.tsx` (default unchanged); tests `web/tests/places/park/**`,
  `web/tests/e2e/park-page.spec.ts`.
- **Must not touch.** `core/**` (contracts are PA-Q's and EG-Q's), `web/components/places/context/**` (EG-W; import only),
  `web/components/places/PlacePage.tsx` except importing nothing new (the branch lives in the route), `web/app/themes.css`,
  `web/app/{app,globals}.css`, `web/components/ui/ui.css`, any `web/**/plan/**` (builder fence, trip-builder ISO-2),
  `legacy/**`, `data/**`, budget baselines (re-measured by the verifier only).
- **Steps.**
  1. Read [README.md](README.md), [anatomy.md](anatomy.md), [states.md](states.md), [components.md](components.md),
     [data-map.md](data-map.md), principles P1 to P9, protected-area-entry 4.5 and 6.4.
  2. Route branch: a place whose type starts with `nature.protected.` renders `ParkPage` with the same props plus
     `entry` and `context`.
  3. Build sections in anatomy order, each returning `null` with no value and no safety gap; the entry section always
     renders (state line or gap row).
  4. `RequirementRow` and `RequirementGroup` per components N1 and N2; Details as a native `<details>`.
  5. `PlanVisit`: three `<a>` secondary buttons from `planVisitHref(slug, nights)`; render only when the capability is on
     and members with points are 3 or more.
  6. Banner per PN11 from `EntryBlock.access` and `closures`, with the render date; route `revalidate` 86400.
  7. Things to do through EG-W's block with `groupsAtRest=3`, `perGroup=6` (README R2).
  8. Member pages: `ParkLine` in the safety tier from `EntryBlock` with `inheritedFrom`.
  9. Stale rules of states.md 3 from `read` dates and `data/schema/freshness.json` classes (read on the server).
- **Acceptance.** AC-1 to AC-16, AC-22 to AC-24.
- **Verification.** `pnpm --dir web exec tsc --noEmit`; the focused tests `pnpm --dir web exec vitest run tests/places/park`
  and the existing MonthStrip and place tests; Playwright `park-page.spec.ts`; screenshots of Banff, the Lake O'Hara area
  and Castle at **1440 and 390, light and dark**, into `web/test-results/shots/` (gitignored), not while another e2e run
  is going; `pnpm --dir web budget:report` before and after.
- **Commit.** One commit `web(PA-2): park template and member park line`; `git -C <worktree> add <owned paths>`, never
  `-A`; end with the project's Co-Authored-By trailer. Delete any `node_modules` or `.next` the worktree created.

## 3. Brief: PA-IX, the /parks index (without the drive filter)

- **Goal.** A `/parks` page that is the places list with the protected-area kinds fixed, pills Where (two levels), Type and
  Season, list beside a map on desktop, List and Map segments on phones.
- **Seat and model.** B1, Sonnet, 7 h. After PA-IXC (Opus contract: row keys `entry`, `members`; `label_by_country`; the kind
  set; `from` and `drive` reserved) and PA-2.
- **Files owned.** `web/app/parks/**` (new: `page.tsx`, `parks.css`), `web/components/parks/**` (new: `ParkRow.tsx`,
  `ParksList.tsx`, `ListMapSplit.tsx`), one additive `levels` prop in `web/components/entity/WhereMenu.tsx` and
  `whereModel.ts`, the sitemap entry in `web/app/sitemaps/**` (one line), the "Parks" link in the Places title block (one
  line, in its owner's file order), tests `web/tests/parks/**`, `web/tests/e2e/parks-index.spec.ts`.
- **Must not touch.** `core/**`, `web/lib/client/data.ts` beyond calling existing methods, the list engine's filter code
  (`web/lib/entities/**`) except reading it, `web/app/themes.css`, global CSS, `web/**/plan/**`, `legacy/**`, `data/**`.
- **Steps.** Read [parks-index.md](parks-index.md) and components 2.7, 2.9, 3.2, 7.1, 8.5; wire the page to the existing
  list adapter with `k` fixed; add the two-line row; the split layout from 1024 px; map pins of the current page and
  country counts; empty, error and loading states of parks-index 6; URL state of parks-index 2.
- **Acceptance.** AC-17 to AC-24 (AC-18 without Drive time).
- **Verification.** `tsc`, focused vitest, Playwright `parks-index.spec.ts`, screenshots of `/parks` and
  `/parks?country=ca&region=ab` at **1440 and 390, light and dark**; the 10,000-park synthetic list check; budget report.
- **Commit.** `web(PA-IX): /parks index`; same rules as PA-2.

## 4. PA-IXD, the Drive time pill (later)

After PA-IX, the driving-time model (`estimateDrive`) and the hub list. Owns `web/components/parks/DrivePill.tsx` and its
test; adds `from` and `drive` to the page's state. Acceptance AC-18 (Drive time), AC-19. Sonnet, 2 h. Same verification
and commit rules.
