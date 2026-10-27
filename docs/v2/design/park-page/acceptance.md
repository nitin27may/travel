# Park page and /parks: acceptance checklist and build briefs

Part of [the park page design](README.md) (PA-N, revised after PA-NR). **Nothing here starts before gate G-PA** (the owner
sees the revised screens) and **FND-PA** (the foundation edits, after G-PA), plus the dependencies in each brief. Principles
cited by number from [foundation/principles.md](../foundation/principles.md).

## 1. Acceptance checklist (travel-builder, then travel-design-reviewer, then travel-verifier)

Each line is checked on Banff National Park (researched), Yoho National Park's Lake O'Hara area (zone, seasonal bus),
Castle Provincial Park (basics only) and, once PA-R-ON lands, Algonquin Provincial Park (provincial, camping).

| # | Check | How it is measured | Principle |
|---|---|---|---|
| AC-1 | Sections draw in the order of [anatomy.md](anatomy.md) 1: Entry and bookings, Safety and rules, Seasons and closures, Where to stay or camp, Things to do, Getting there, Not checked yet, Facts and sources; a section with no value and no safety gap is not drawn | Playwright: section ids in DOM order on the four parks; no empty `<section>` | P2, P3, T1 |
| AC-2 | Entry and bookings is the first section under the cover, at rest, on every park, including "Entry not checked yet" on a park with no requirement | Playwright on Castle: the gap row is visible without a click | P2 exception |
| AC-3 | One template: no branch on the park's type in `web/components/places/park/**` | `git grep -nE "nature\.protected\.(national_park|state_provincial_park|conservation_area|nature_reserve|forest|dark_sky_site|zone)" web/components/places/park` prints only the label-map import (anchored to the type ids) | PN1 |
| AC-4 | Requirement rows show at rest: name, window chip (under the name on phones), who needs it, price (3 bands then "+n"), covered-by, scope, link; "Details" opens in place with validity, channel, proof, change, cancel, quota, read date | unit test of `RequirementRow` against the Banff daily admission, the Discovery Pass, the Lake O'Hara bus and the Moraine Lake shuttle; Playwright opens one Details | P2, P5, P6, T1 |
| AC-5 | No pass-saving line on a park page | unit: no "cheaper" text in the park HTML | QP5 |
| AC-6 | "Inside the park: own bookings" shows at most 4 rows at rest, names every one in the count line, and never puts a row with "May be out of date" in the tail; campsite reservations never appear in Entry (only counted and linked to Where to stay) | unit with a fixture of 7 member requirements and 2 campgrounds | P1, P2, P6 |
| AC-7 | Actions: **Save to a trip is the single filled primary on every park page**, with or without the builder; Directions secondary; Share and heart icon buttons. Plan a visit: four links, "Day trip" `/plan/?m=near&n=0&p=<slug>`, "1 night" `n=1`, "2 nights" `n=2`, "Part of a longer trip" `/plan/?m=trip&cc=CA&p=banff-national-park` (`cc` is the ISO 3166-1 alpha-2 code in upper case); no `within`, `from`, `r`, date or party; one-line labels; `role="group"` labelled by the visible heading; drawn only with `planBuilder` on and 3 or more members with points | unit on `planVisitHref` (writes `cc=CA` for a park whose chain country is `ca`); Playwright with the flag on and off (one `--accent` filled button in both); the builder's URL parser test accepts the four links (README R1) | P7, PN6, PN7, OR9 |
| AC-8 | Things to do: count cards for every kind present; the three largest groups with at most 6 each; "Show all n" links to `/places?within=<slug>&k=<kind>`; at most 18 member cards in the HTML | unit with a 10,000-member synthetic park; HTML size check | P1, P3, P8 |
| AC-9 | Zone page: kicker "Area of <park>", own rows then "From <park>" rows with `inheritedFrom`; Plan a visit `p` is the zone's slug | Playwright on the Lake O'Hara area | P6 |
| AC-10 | Member page line "In Banff National Park: daily admission applies (Discovery Pass covers it)" links to the park's `#entry` | Playwright on Moraine Lake and one Banff trail | P6, T1 |
| AC-11 | Stale facts: a price older than 120 days reads "read <month year>, may have changed" in `--muted` with **no chip**; a booking window older than 365 days or a closure read more than 7 days ago gets the honesty chip "May be out of date"; one chip per row at most | unit with a clock fixed past each class | T3, PN19 |
| AC-12 | Banner: at most one; **notice** for closed for the season or between seasons, **caution** for a dated closure overlapping today or the next 30 days (member named as a link, "1 of n closures" when more); "as of <date>"; pages revalidate daily | unit with fixed dates on the Lake O'Hara bus (Nov: notice; Jul: none) and Banff's Johnston Canyon closure (caution); route config `revalidate` 86400 | P2, T1, T3, PN11 |
| AC-13 | Season: a park open all twelve months shows "Open all year, read <date>" and no strip; otherwise the month strip `variant="season"` (open, part, closed, blank; 12 x 1 from 400 px, 6 x 2 below; screen-reader summary line) | unit on `MonthStrip variant="season"`; existing trip MonthStrip tests pass unchanged | T1, PN10 |
| AC-14 | Basics-only park uses the compact template with the entry row, places inside (when above 0), the trips line and "Not researched yet"; "Ask us to research this park" only when REQ's route exists | Playwright on Castle | P2, P3, R7 |
| AC-15 | No record ref, party, date or home in the HTML or RSC payload | existing privacy detectors on the four park pages | P8, privacy |
| AC-16 | Budgets: every non-park place page +0 B HTML; park pages under their own new baseline; start JS +0 B on every page (the Plan a visit buttons are links) | `pnpm --dir web budget:report` before and after | PN17, P9 |
| AC-17 | `/parks` lists only the types of [parks-index.md](parks-index.md) 1; zones absent; group by country with counts; 48 per page | API contract test; Playwright | P1, P4 |
| AC-18 | `/parks` pills Where (two levels), Type, **Open in**, and (after PA-IXD) Drive time; live counts; one "Clear all"; a park with no checked season appears under "Season not checked (n)", never dropped; empty result names the filter to remove | Playwright first-use walk with no prior knowledge; a fixture with Banff (no season) filtered to July shows Banff in the second group | P1, P4, PN20 |
| AC-19 | `/parks` URL round-trips every key of parks-index 2 in the patterns 1.2 order; `drive` uses the existing `<hub>-<band>` codec (`toronto-3`), the same value smart search writes; there is no `from` key; an unknown hub, a town id or a point in `drive` is dropped | unit on the parser shared with `/trips`; a test plants a town id and a point and expects both dropped | P9, OR9, PN15 |
| AC-20 | `/parks` views are List (default), Cards and Map, as `/places`; the map loads only in the Map view; "Search this area" sets `bbox`; switching List and Map keeps scroll; no list-beside-map in v1 | Playwright at 1440 and 390; network log shows no map chunk in List view | P5, P9, PN14 |
| AC-21 | `/parks` rows carry only the allowlisted keys plus `entry` (`none`, `fee`, `book_ahead`, `fee_book_ahead`, `not_checked`) and `members` (and `driveMin`, `driveBasis` only in a `drive` response); on phones at most two chips per row and places inside in the meta line; Sort in the Filters sheet under 640 px | the P8 row-key test, updated once by PA-IXC with the waiver noted; Playwright at 390 | P8, P3 |
| AC-22 | No literal colour; tokens only from `web/app/themes.css`; no green | stylelint and `git grep -nE "#[0-9a-fA-F]{3,6}\b" web/components/places/park web/app/parks` prints nothing | foundation |
| AC-23 | Keyboard: every link and Details reachable by Tab in reading order; focus ring visible; reduced motion jumps | Playwright keyboard walk; `prefers-reduced-motion` run | P5, a11y |
| AC-24 | axe: no serious or critical violations on the four parks and `/parks` in light and dark | `a11y-place.spec.ts` widened | a11y |
| AC-25 | **Phones: Entry first, map after Safety.** On a 390 x 844 viewport the Entry and bookings heading is above 1,244 px (844 + 400) on Banff, Lake O'Hara and Castle; the map card and "In public trips" come after Safety and rules | Playwright `boundingBox` at 390 x 844 | P2, T2, PN18 |

## 2. Brief: PA-2, the park template and the member line

- **Goal.** Render every `nature.protected.*` place and zone with the park template of this design, and add the park line
  to member pages, reading only `EntryBlock` and `PlaceContext` through `web/lib/public`.
- **Seat and model.** B1, Sonnet, 10.5 h. Review PA-R2 (Opus), verify PA-V2 (Sonnet).
- **After.** G-PA, FND-PA (foundation 3.8 Requirement row, 4.7 season prop, 2.8 label, patterns 2 phone line), PA-Q
  (EntryBlock), EG-Q and EG-W (members block), UXB-7 (place templates).
- **Files owned.** `web/components/places/park/**` (new: `ParkPage.tsx`, `EntrySection.tsx`, `RequirementRow.tsx`,
  `PlanVisit.tsx`, `planVisitHref.ts`, `SafetySection.tsx`, `SeasonsSection.tsx`, `StaySection.tsx`, `GettingThere.tsx`,
  `ParkLine.tsx`, `park.css`); `web/lib/public/places.ts` (the entry join only); `web/app/places/[slug]/page.tsx` (one
  branch: a protected-area place renders `ParkPage`); one additive `variant` prop in
  `web/components/trips/summary/MonthStrip.tsx` (default unchanged); tests `web/tests/places/park/**`,
  `web/tests/e2e/park-page.spec.ts`.
- **Must not touch.** `core/**` (contracts are PA-Q's and EG-Q's), `web/components/places/context/**` (EG-W; import only),
  `web/components/places/PlacePage.tsx` (the branch lives in the route), `web/app/themes.css`,
  `web/app/{app,globals}.css`, `web/components/ui/ui.css`, any `web/**/plan/**` (builder fence, trip-builder ISO-2),
  `docs/v2/design/foundation/**` (FND-PA's), `legacy/**`, `data/**`, budget baselines (re-measured by the verifier only).
- **Steps.**
  1. Read [README.md](README.md), [anatomy.md](anatomy.md), [states.md](states.md), [components.md](components.md),
     [data-map.md](data-map.md), the PA-NR review, principles P1 to P9, protected-area-entry 4.5 and 6.4.
  2. Route branch: a place whose type starts with `nature.protected.` renders `ParkPage` with the same props plus
     `entry` and `context`.
  3. Actions: Save to a trip as the one primary (`SaveToTrip`, primary variant), Directions secondary, Share and heart icon
     buttons; on phones they fit one row from 375 px and wrap Directions below that.
  4. Build sections in anatomy 1 order, each returning `null` with no value and no safety gap; the entry section always
     renders (state line or gap row). On phones place the map card and "In public trips" after Safety and rules (PN18).
  5. `RequirementRow` per components N1 (group rules included); Details as a native `<details>`; campsite rows go to
     `StaySection` only, Entry's state line counts and links them.
  6. `PlanVisit`: a `div role="group"` with four `<a>` secondary buttons from `planVisitHref(slug, mode)`; render only when
     the capability is on and members with points are 3 or more.
  7. Banner per PN11 (notice or caution) from `EntryBlock.access` and `closures`, with the render date; route
     `revalidate` 86400.
  8. Seasons: "Open all year, read <date>" or `MonthStrip variant="season"`.
  9. Things to do through EG-W's block with `groupsAtRest=3`, `perGroup=6` (README R2).
  10. Member pages: `ParkLine` in the safety tier from `EntryBlock` with `inheritedFrom`.
  11. Stale rules of states.md 3 (prices text; windows and closures chip) from `read` dates and
      `data/schema/freshness.json` classes, read on the server.
- **Acceptance.** AC-1 to AC-16, AC-22 to AC-25.
- **Verification.** `pnpm --dir web exec tsc --noEmit`; the focused tests `pnpm --dir web exec vitest run tests/places/park`
  and the existing MonthStrip and place tests; Playwright `park-page.spec.ts`; screenshots of Banff, the Lake O'Hara area
  and Castle at **1440 and 390, light and dark**, into `web/test-results/shots/` (gitignored), not while another e2e run
  is going; `pnpm --dir web budget:report` before and after.
- **Commit.** One commit `web(PA-2): park template and member park line`; `git -C <worktree> add <owned paths>`, never
  `-A`; end with the project's Co-Authored-By trailer. Delete any `node_modules` or `.next` the worktree created.

## 3. Brief: PA-IX, the /parks index (without the drive pill)

- **Goal.** A `/parks` page that is the places list with the protected-area kinds fixed, pills Where (two levels), Type and
  Open in, and the `/places` views List (default), Cards, Map.
- **Seat and model.** B1, Sonnet, **5 h** (was 7: no split view). After PA-IXC (Opus contract: row keys `entry` with five
  values and `members`; `label_by_country` with fallback "Park"; the kind set; `drive` allowed on places lists for
  protected areas), FND-PA and PA-2.
- **Files owned.** `web/app/parks/**` (new: `page.tsx`, `parks.css`), `web/components/parks/ParksList.tsx` (new), the
  two-line list-row variant as a new file with its own CSS in `web/components/ui/` (per FND-PA's 3.2 text; never
  `ui.css`), one additive `levels` prop in `web/components/entity/WhereMenu.tsx` and `whereModel.ts`, the sitemap entry in
  `web/app/sitemaps/**` (one line), the "Parks" link in the Places title block (one line, in its owner's file order), tests
  `web/tests/parks/**`, `web/tests/e2e/parks-index.spec.ts`.
- **Must not touch.** `core/**`, `web/lib/client/data.ts` beyond calling existing methods, the list engine's filter code
  (`web/lib/entities/**`) except reading it, `web/app/themes.css`, global CSS, `web/**/plan/**`, `legacy/**`, `data/**`.
- **Steps.** Read [parks-index.md](parks-index.md) and components 2.7, 2.9, 3.2, 7.1, 8.5; wire the page to the existing
  list adapter with `k` fixed; the two-line row (two chips at most on phones, places inside in the meta line); the Open in
  pill with the "Season not checked" group; the `/places` views with the map only in Map view; Sort into the Filters sheet
  under 640 px; empty, error and loading states of parks-index 6; URL state of parks-index 2.
- **Acceptance.** AC-17 to AC-24 (AC-18 and AC-19 without Drive time).
- **Verification.** `tsc`, focused vitest, Playwright `parks-index.spec.ts`, screenshots of `/parks` and
  `/parks?country=ca&region=ab&season=jul` at **1440 and 390, light and dark**; the 10,000-park synthetic list check;
  budget report.
- **Commit.** `web(PA-IX): /parks index`; same rules as PA-2.

## 4. PA-IXD, the Drive time pill (later)

After PA-IX, the driving-time model (`estimateDrive`) and the hub list. A 2.7 pill with a hub menu, in
`web/components/parks/DrivePill.tsx` and its test; it writes the existing `drive=<hub>-<band>` value (no `from` key) and
generalises the drive label beyond Toronto in its owner's order. Acceptance AC-18 (Drive time), AC-19. Sonnet, 2 h. Same
verification and commit rules.
