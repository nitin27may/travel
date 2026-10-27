# PA-NR: design review of the park page and /parks (PA-N)

Reviewed 27 Oct 2026 by travel-design-reviewer on **Claude Opus 5.5**, branch `design/PA-NR` from `design/PA-N` commit
1cd4ecb6. Inputs: `docs/v2/design/park-page/*` (README, anatomy, states, parks-index, components, data-map, acceptance),
`docs/v2/features/protected-area-entry.md` 8, `docs/v2/features/trip-builder.md` 2.2 and 2.5, the foundation
(`principles.md` P1-P9 and T1-T5, `components.md`, `patterns.md`, `tokens`), `keep-from-live-site.md`,
`trip-scope-scenarios.md` and `product-direction-2026-10-18.md`.

**Verdict: approve the direction (one template, entry first, a `/parks` index on the list engine), with 6 must-fix and
9 should-fix changes before G-PA.** Nothing has been built, so the fixes are edits to the PA-N pages, not code.

## 0. How it was rendered

Nothing exists in `web/` yet, so the wireframes were turned into static mocks that use only the tokens in
`web/app/themes.css` and the site's fonts: [pa-nr-mock/](pa-nr-mock/) (`banff.html`, `ohara.html`, `castle.html`,
`parks.html`). Each mock was rendered by Playwright (Chromium, Metal GPU flags) at 2x, at 1440 x 900 and 390 x 844, in
light and dark. Dark is set by the page's own theme button, which does what `ThemeToggle` does: it sets
`data-theme` and writes `travel:v1:theme`. Tall pages were read in viewport tiles (Banff 390: 6 tiles). No width
scrolls sideways (`scrollWidth` equals the viewport at both widths). All 40 tiles are in
`web/test-results/shots/pa-nr/` (gitignored). The ones this review names are committed in
[pa-nr-shots/](pa-nr-shots/):

| Shot | What it shows |
|---|---|
| `banff-1440-light-t0.png`, `banff-1440-light-t1.png` | desktop first view and the Entry, Safety and Things to do sections |
| `banff-390-light-t0.png`, `banff-390-dark-t1.png` | the first phone screen, and where Entry starts (screen 2, below the map) |
| `ohara-1440-dark-t0.png`, `ohara-390-light-t1.png` | a zone out of season, a stale row, the month strip (season variant) |
| `castle-390-dark-t0.png` | basics only, the compact template |
| `parks-1440-light-t0.png`, `parks-390-dark-t0.png` | `/parks`, list beside the map, and the phone list |

Mock values are Banff's records where the anatomy gives them. The nearest airport (ORG, planned) and the other Alberta
parks on `/parks` are placeholders that show the layout. They are not data. The live place pages on the local servers
returned 500 (other sessions' servers), so the current place template was not compared side by side.

## 1. Findings

Ranks: **critical** blocks G-PA; **important** must be fixed in PA-N before G-PA; **polish** can be fixed in PA-2 or
PA-IX. "Must-fix" = critical or important; "should-fix" = important items the owner can waive, plus polish.

### Must-fix

| # | Rank | Screen | What is wrong | Why it matters to a family | Exact fix |
|---|---|---|---|---|---|
| M1 | critical | Park page, actions (PN7, anatomy 2) | PN7 makes "Plan a visit" the primary action when the builder is on. The wireframe draws no primary at all: the shots show seven outlined buttons of equal weight (three chips, Directions, Save, Share, heart) | P7: about 90% read and save; about 10% plan. With nothing primary, the eye has nowhere to land, and the most common action (save this park to our trip) looks the same as Share | **Save to a trip is the primary action (filled `--accent`) on every park page**, with or without the builder. Plan a visit stays a labelled group of secondary link buttons. Directions is secondary. Share and the heart are icon buttons (components 2.1 icon, 38 px, hit area 44). Amend PN7, anatomy 1 row 2, anatomy 2 and 3, components 1 and AC-7 ("else Save to a trip is the primary" becomes "Save to a trip is always the primary"). On a phone, `[Save to a trip][Directions][share][heart]` then fits one row of 362 px. Today the heart wraps onto a third row (`banff-390-light-t0.png`) |
| M2 | critical | Plan a visit link (README 5, AC-7) vs trip-builder 2.5 | The link writes `within=<slug>` as a top-level `/plan/` key. Trip-builder 2.5 has no `within` key: filters go in `f`, and in the shared list codec (`core/src/query/url.ts`) `f` is the opaque advanced-filter grammar. AC-7 pins the top-level href, so PA-2 would ship a key the builder does not read, while README 5 says "TB's codec wins" | A family taps "Weekend" and lands in a builder that ignores the park filter. Discover then shows candidates from the whole drive band, not the park, and the visit they asked for is lost silently | **Drop `within` from the link.** The link is `/plan/?m=near&n=<n>&p=<park-slug>`. Request R1 changes to: "a `p` pick that is a protected area or a zone is pinned as the trip's area: Discover is pre-filtered to its `within` closure, and the park itself is never scheduled as a stop with a visit time". This gives one key, no codec dependency and the same result. Amend README 5, the diagram node PLAN, PN6, states 5 (zones), AC-7 and the builder's URL fixture |
| M3 | important | Plan a visit chips (README 5, Q-PN2) | "2 or 3 days" maps to `n=2` (three days). A two-day visit is the Weekend chip (`n=1`), so the third chip promises a length it never builds. Each chip also needs a sub-label to explain itself ("Weekend / 1 night"). At 390 "2 or 3 days" wraps to two lines inside a 44 px button (`banff-390-light-t0.png`), so the "one row of 284 px" claim in anatomy 3 does not hold | P4: if a control needs explaining, the control is wrong. A family that picks "2 or 3 days" for a two-day trip gets three | Labels that say the nights: **"Day trip" (`n=0`), "1 night" (`n=1`), "2 nights" (`n=2`)**, in one line, with no sub-label. Screen-reader names: "Plan a day trip", "Plan a visit with 1 night", "Plan a visit with 2 nights". Add "Weekend" to the 1-night chip only after R1's Saturday-and-Sunday key exists. Amend README 5 table, anatomy 2, 3 and 7, and AC-7 |
| M4 | important | Park page on a phone (anatomy 3, states 2) | Patterns 2 moves the map and "In public trips" to the top on phones. On a park page that puts Entry and bookings on the second screen: cover 240, three button rows, banner, a four-fact glance, a 200 px map card and the trips card come first. In the shot, Entry starts at about 1,290 px (`banff-390-dark-t1.png`). Castle (basics only) is the same: the entry gap row sits under a full map (`castle-390-dark-t0.png`) | P2 safety exception and PN4 promise entry "at rest". A parent at a trailhead with weak signal (T2) scrolls past a map that may not load before reaching "Do we need a pass?". At rest has to mean in the first scroll, not just not behind a click | **A park-page exception to patterns 2:** on phones the map card and "In public trips" come after Entry and bookings and Safety and rules, before Things to do. Record it in anatomy 3, states 2 and acceptance (new AC: "on a 390 x 844 viewport the Entry heading is above 844 + 400 px on Banff, Lake O'Hara and Castle"). Patterns 2 gains one line: "Park pages: the map follows Entry and Safety on phones (PA-N)" |
| M5 | important | `/parks` Season pill (parks-index 3) | "A park with no checked season is not counted as open." On `main`, Banff has no operating season record (anatomy 2 says so). `Season: Jul` therefore drops the best-known park in the catalogue, and most store-only parks with it. The mock shows the result: "5 more parks have no season checked" sits above a list that is missing Banff | A family filtering "open in July" reads the list as complete (P1, P4) and never sees Banff, which is open all year | Parks with no checked season **stay in the result** in a second group, "Season not checked (n)", under the open parks, each with the gap chip. The pill label is "Open in" (it filters opening, not quality). Drop the "show them" link. Amend parks-index 3 and 6 and AC-18 (add: "a park with no season appears under Season not checked, never dropped") |
| M6 | important | `/parks` Drive time URL (parks-index 2, data-map 2) | `drive` already exists in the shared list codec (`FACET_PARAMS` in `core/src/query/types.ts`) and in smart search (`core/src/parse/parse.ts`) as `drive=toronto-<hours band>`, with labels in `valueLabels.ts`. The design gives the same key a new meaning (`from=hub-toronto&drive=180`, minutes) | The same words in a URL would mean two things: a `/trips` link and a `/parks` link built the same way would filter differently, and "parks within 3 hours of Toronto" typed into search could not hand over to `/parks` | **Reuse the existing encoding:** `drive=<hub>-<band>` (`toronto-3`), the hub and band list of `HUB_BANDS`, and the existing labels. Drop the new `from` key from `/parks`. Airports join the hub list as ids (`yyz-2`) once ORG has them. Amend parks-index 2 and 3, data-map 2, AC-19 and PA-IXC's "drive query params reserved" |

### Should-fix

| # | Rank | Screen | What is wrong | Why it matters | Exact fix |
|---|---|---|---|---|---|
| S1 | important | Park page, section order (anatomy 1) | Seasons and closures is section 10, after Things to do, Where to stay and Getting there. Whether the park is open in our month is the second question a family asks, after entry (T1) | "When is part of every answer." A family reads 17 trail cards before learning the shuttle stops on 12 Oct | Order: **Entry and bookings, Safety and rules, Seasons and closures, Where to stay or camp, Things to do, Getting there**, then Not checked yet and Facts and sources. Sections with no value are not drawn, so the short sections cost little. Amend anatomy 1, 2 and 3, the protected-area-entry 8 pointer, and AC-1 |
| S2 | important | Park page, glance (PN13) | The glance holds places inside, visitor centres, gateway and the nearest airport. It leaves out entry and camping, which are the two facts that change the plan. "2 visitor centres" is the weakest fact in the shot (`banff-1440-light-t0.png`) | P3: the first view should answer "can we go, what does it cost, can we camp" | Glance (6 at most, held only): **Season** ("Open all year" or "May to Oct"), **Entry** (the list-row enum of Q-PN4: "Fee", "Fee · book ahead", "No fee", "Entry not checked"; links to `#entry`), **Camping** ("3 campgrounds" or absent), Places inside, Gateway, Nearest airport. Drop visitor centres (they are pins on the map). The entry fact is a one-word summary, not a section row, so "never repeat a section row" holds. Amend PN13 and anatomy 1 row 4 |
| S3 | important | Camping in two places (anatomy 4 vs anatomy 1 row 8) | The provincial frame lists "Campsite, North Campground" under Entry, Book ahead. Anatomy 1 puts campgrounds with their window chips in Where to stay or camp. As written, the same booking window appears twice | P6: a fact appears once, where it is decided. Two copies drift when one is refreshed | Campsite reservations live **only in Where to stay or camp**. Entry's state line counts and links them ("· 2 campgrounds book ahead, see Where to stay"). Entry holds passes, fees, permits, timed entry and day-use reservations. Amend anatomy 4 and 1 and components N2 |
| S4 | important | Plan a visit for a far park (README 5, R1) | Near mode starts from public hubs that are all in Ontario and Quebec today (trip-builder 2.2). A Toronto family on Banff taps "Day trip" and gets a builder that cannot reach the park. R1 offers "Plan it as a trip instead" only after the tap | The chips promise something most visitors to a mountain park cannot use. The 10% who plan hit a dead end on the first step | Add a fourth link to the group, **"Part of a longer trip"**: `/plan/?m=trip&cc=<country>&p=<slug>`, a plain link with +0 B JS. Keep R1's fallback as well. Amend README 5 and AC-7 |
| S5 | important | Stale prices (states 3) | Prices go stale after 120 days, and every stale price row gains the coral "May be out of date" honesty chip. Fees change once a year, so for most of the year most park pages would carry coral chips on routine fee rows. In `ohara-390-light-t1.png` two coral chips sit on one zone page | Alarm fatigue: when every row warns, the warning that matters (a booking window from last season) is lost. T3 needs the age shown, not an alarm | Stale **price**: text only, "read Mar 2026, may have changed" in `--muted`, and no chip. The honesty chip "May be out of date" is for **booking windows and closures** only (the facts that stop a visit). One chip per row at most, and the row's text does not repeat it. Amend states 3 and AC-11 |
| S6 | important | `/parks` desktop list beside the map (N5, PN17) | A sticky map beside the list loads the map at first paint on desktop. `/places` loads the map only when the Map view is chosen. That conflicts with PN17 ("`/parks` start JS no larger than `/places`"), and it is a second layout for the same list engine (PN14 "no new list code") | At under 100 users it gives little: 29 parks fit on one page. It adds a new component and a budget risk | **v1: `/parks` uses the `/places` views (List, Cards, Map), default List.** The split view comes later as a list-engine feature (for `/places` too), with the map loaded after first paint and measured. PA-IX drops `ListMapSplit.tsx` (about -2 h). Amend parks-index 4.1, components N5, AC-20 |
| S7 | polish | Banner kind (states 4 vs components 1) | For a zone between seasons the wireframe says "caution banner 5.4" with an (i) icon. Components 1 says notice | One meaning per colour: amber is for something that may stop you; "out of season" is information | Closed for the season or between seasons: **notice** (`--info-soft`, info icon). A dated closure that overlaps the next 30 days: **caution**. Amend states 4 and PN11 |
| S8 | polish | Month strip, season variant (N3) | Reusing the "best" look (`--ink` fill) for "open" draws a solid black bar for every park that is open all year | A full-black strip reads as "all best", and it is noise on most national parks | A park open all twelve months draws no strip: one line, "Open all year, read <date>". The strip appears only when at least one month is closed or partly open. Approve the four cell looks otherwise (pairs in section 3) |
| S9 | polish | `/parks` rows on a phone (N4) | Three chips wrap to a second chip line. Rows measure about 120 px, not 72 (`parks-390-dark-t0.png`). The single-value `entry` enum hides the fee when a park also needs booking (Jasper shows only "Book ahead") | Fewer parks per screen on the device most visitors use | On phones: two chips at most (entry, season), and "56 places inside" moves into the meta line. The enum gains `fee_book_ahead` ("Fee · book ahead"). Sort moves into the Filters sheet under 640 px, so the subbar keeps one line |

### Polish noted for PA-2 and PA-IX (no change to PA-N needed)

- On phones the requirement row's window chip must sit directly under the name, as the anatomy 3 wireframe shows, never
  after the prose. The mock put it last and the key fact ("Lottery, usually in March") fell below the fold of the row.
- The Plan a visit group is a `div role="group" aria-labelledby` on its visible label, not a `<nav>`. Three action links
  are not a navigation landmark, and an extra landmark adds noise for screen-reader users.
- The closure banner names the member as a link ("Johnston Canyon") and, when there are more, the count
  ("1 of 3 closures, see Seasons and closures").
- The fallback type word in Q-PN9 should be "Park" rather than "Regional park", because "Regional park" is wrong for
  Italian or Icelandic nature parks. The label map grows by country.
- AC-3's grep for `forest` will match unrelated words. Anchor it to the type ids (`nature\.protected\.(national_park|...)`).

## 2. Hierarchy: what a family needs first

| Need | Where PA-N puts it | Verdict |
|---|---|---|
| Entry and bookings (pass, fee, timed entry) | first section, at rest, three groups, rows open in place | **Approve**. Clear in the shots, and the price line is readable. With M4 it moves into the first scroll on phones |
| Season, open or closed | banner when closed; section 10 | **Change** (S1, S8): section 3 and a glance fact |
| Camping | section 8, plus duplicates in Entry (anatomy 4) | **Change** (S3): one home, counted in Entry |
| Things to do | count cards, then the top 6 of the three largest groups, then "Show all" into the list | **Approve**. Count cards and grouped cards read well at 1440. On phones list rows keep the page shorter |
| Safety and rules | at rest, gap chip when not held, alerts link always | **Approve** |
| Getting there | gateway, airport, shuttles | **Approve** |

## 3. Colour and contrast (palette: no green)

Every pair below is a token pair from `web/app/themes.css`, measured with the WCAG 2.x formula (light / dark). All pass
AA, and every text pair passes AAA at normal size except where marked. No green is used anywhere: `--ok` is blue and is
not used on these pages. Accent is amber, info is slate blue and honesty is coral.

| Use on these pages | Pair | Light | Dark | Level |
|---|---|---|---|---|
| Headings, names, prices | `--ink` on `--surface` | 16.06 | 13.83 | AAA |
| Headings on the page | `--ink` on `--bg` | 14.85 | 15.28 | AAA |
| Who-needs-it, covered-by, group headings | `--ink-2` on `--surface` | 12.09 | 10.76 | AAA |
| Group headings on the page | `--ink-2` on `--bg` | 11.18 | 11.88 | AAA |
| Requirement glyph | `--ink-2` on `--well` | 10.48 | 12.39 | AAA |
| Meta, state line, exemptions | `--muted` on `--surface` | 6.94 | 7.45 | AA (AAA dark) |
| Meta on the page | `--muted` on `--bg` | 6.42 | 8.23 | AA (AAA dark) |
| Links | `--accent-text` on `--bg` | 5.85 | 8.83 | AA (AAA dark) |
| Links on cards | `--accent-text` on `--surface` | 6.33 | 7.99 | AA (AAA dark) |
| Caution banner text | `--ink` on `--warn-soft` | 14.17 | 13.05 | AAA |
| Caution icon and caution chip | `--warn` on `--warn-soft` | 6.11 | 7.84 | AA (AAA dark) |
| "As of" line in the caution banner | `--muted` on `--warn-soft` | 6.13 | 7.03 | AA (AAA dark) |
| Alerts link in the caution banner | `--accent-text` on `--warn-soft` | 5.59 | 7.54 | AA (AAA dark) |
| Notice banner text | `--ink` on `--info-soft` | 13.24 | 12.74 | AAA |
| Notice icon | `--info` on `--info-soft` | 5.91 | 7.61 | AA (AAA dark) |
| "As of" line in the notice banner | `--muted` on `--info-soft` | 5.73 | 6.86 | AA |
| Link in the notice banner | `--accent-text` on `--info-soft` | 5.22 | 7.36 | AA (AAA dark) |
| Honesty chip "May be out of date" | `--crit` on `--surface` | 6.61 | 7.01 | AA (AAA dark) |
| Honesty chip on the page | `--crit` on `--bg` | 6.11 | 7.75 | AA (AAA dark) |
| Primary button (M1), selected segment | `--accent-ink` on `--accent` | 6.96 | 6.96 | AA |
| Active filter pill | `--accent-text` on `--accent-soft` | 5.56 | 7.26 | AA (AAA dark) |
| Month strip "open" cell label | `--surface` on `--ink` | 16.06 | 13.83 | AAA |
| Button, chip and pill borders, gap chip dash (non-text, 3:1) | `--line-2` on `--surface` | 3.67 | 3.42 | passes 3:1 |
| The same borders on the page | `--line-2` on `--bg` | 3.39 | 3.78 | passes 3:1 |

The cover kicker (white at 80%) and the breadcrumb on a photo rely on the existing scrim tokens; check them on real park
photos in PA-2, not on the mock gradient.

## 4. The five new components: is each needed?

| # | Piece | Verdict | Reason |
|---|---|---|---|
| N1 | Requirement row | **Keep; add to the foundation as components 3.8** | Nothing existing fits. The booking card (3.4) is a planner object with status and money. A dateless "who needs it, what it costs, when it opens" row is new and is reused on member pages and the trip's Bookings tab |
| N2 | Requirement group | **Drop as a component** | It is a heading, a `<ul>` and the existing 6.4 static tail. Write its rules (empty groups not drawn, 4 at rest, names in the count line) into N1 |
| N3 | Month strip, season variant | **Keep as a prop**, with S8 | The same cells, container query and screen-reader pattern as 4.7. The contrast pairs are unchanged (section 3) |
| N4 | Two-line park row | **Keep as a 3.2 variant ("two-line"), not a park component** | `/places` needs the same row once rows carry more than one chip line. Name it `ListRow variant="two-line"` instead of `ParkRow` |
| N5 | List beside the map, and the Drive time pill | **Defer the split** (S6). **Keep the pill** with M6's encoding | The split is a list-engine feature, not a parks feature. The pill is the existing 2.7 pill with a hub menu |

Foundation edits asked for in README R4 (the `/parks` row in patterns 1.2, N1 and the N3 and N4 variants in
components.md, the label "May be out of date" in 2.8): **not made in this review.** They depend on G-PA and on the fixes
above. Made now, they would freeze an unapproved design into `components.md`, `tokens`, `specimen.html` and
`changes-from-preview.md`. They are one foundation task after G-PA (about 1 h, travel-design-reviewer, Opus), before
PA-2 starts.

## 5. States

| State | Verdict |
|---|---|
| No entry needed, Entry not checked | **Approve.** The gap row is at rest and the official link sits beside it (`castle-390-dark-t0.png`), with M4's move above the map |
| No data (basics only) | **Approve** the compact template and "Ask us to research this park". The request form named ("Suggest an improvement") is not a route in `web/app` today, so the link must point to whatever REQ ships, or be left out until then |
| Stale | **Approve with S5** (alarm only on windows and closures) |
| Closed season | **Approve.** Keeping Plan a visit is right (people plan next summer). Banner kind per S7 |
| Zone | **Approve.** "Area of Yoho National Park", the breadcrumb ending at the park and "From Yoho National Park" rows read clearly (`ohara-1440-dark-t0.png`) |
| Loading, error | **Approve** (only the expanded map is lazy) |

## 6. Principles

| P | Verdict |
|---|---|
| P1 scale | Pass: count cards, 6 per group, 18 cards at most, `/parks` paged at 48, synthetic 10,000 check. M5 fixes the count honesty |
| P2 progressive, safety exception | Pass on desktop. **Fails on phones until M4** |
| P3 glance | Partial: S2 |
| P4 no manual | Partial: M3 (chip labels), M5 (Season excludes silently). The four pills are right |
| P5 smooth | Pass: static disclosures, reduced motion jumps, List and Map keep scroll |
| P6 right metadata | Partial: S3 (camping window in two places) |
| P7 primary goal | **Fails until M1** |
| P8 catalogue | Pass. Two row keys (`entry`, `members`) are coarse labels; approve the waiver (Q-PN4) |
| P9 server-ready | Pass once M2 and M6 keep to the existing codecs. One data boundary (`EntryBlock`, `PlaceContext` through `web/lib/public`), no bulk load |
| T1 when | Partial: S1 |
| T3 trust shows its age | Pass, with S5 |
| T5 honest maps | Pass: no boundary polygon, and the honesty line says so |

## 7. Plan a visit against trip-builder 2.2 and 2.5

| Check | Result |
|---|---|
| Keys exist in 2.5 | `m`, `n`, `p`: yes. `within`: **no** (M2) |
| Only public slugs, no party, home, date or start point (2.4, OR9) | yes |
| `n` within near mode's 0 to 5 | yes; labels per M3 |
| No `from` or `r`, so the builder asks step 1 | right: the builder owns the origin |
| Zone pages pass the zone slug | right, with R1's "pinned as area, never a stop" (M2) |
| A park beyond every near-mode band | R1's fallback plus S4's "Part of a longer trip" link |
| Server-rendered plain links, +0 B start JS | yes |
| Drawn only with `planBuilder` on and at least 3 members with points | approve |

## 8. Recommendations on Q-PN1 to Q-PN9

| Q | Recommendation |
|---|---|
| Q-PN1 park pages at `/places/<slug>`, `/parks` the index only | **Yes** |
| Q-PN2 chips and their nights | **Yes, changed:** labels "Day trip", "1 night", "2 nights" (M3); the link without `within` (M2); a fourth "Part of a longer trip" link (S4). Shown only with the builder on and at least 3 members |
| Q-PN3 no visit-mode control | **Yes.** "Backcountry campers only" on the row is clearer than a mode switch |
| Q-PN4 row keys `entry` and `members` | **Yes**, with `fee_book_ahead` added to the enum (S9) |
| Q-PN5 Drive time later, hubs and airports only | **Yes**, using the existing `drive=<hub>-<band>` encoding (M6) |
| Q-PN6 the kind set, and the four `nature_reserve` records reviewed first | **Yes.** "Dolomites" listed as a park would be the first thing a visitor notices |
| Q-PN7 not a header tab | **Yes.** Header tabs stay at three, and `/parks` is one click from Places and every park breadcrumb |
| Q-PN8 render-time season state, the "as of" date, daily revalidation | **Yes.** The server build now exists, so `revalidate` works. The legacy static export ignores it, and the printed date covers that |
| Q-PN9 type word by country | **Yes**, with "Park" as the fallback (polish list) |

## 9. What changes in PA-N before G-PA

README (PN6, PN7, PN13, section 5, R1, Q-PN2 and Q-PN4 rows), anatomy (1, 2, 3, 4, 7), states (2, 3, 4), parks-index
(2, 3, 4.1, 6), components (N2 dropped, N4 renamed, N5 deferred), data-map 2, and acceptance (AC-1, AC-7, AC-11, AC-18,
AC-19, AC-20 and one new phone AC for M4). Hours: PA-IX goes down about 2 h (S6). PA-2 is unchanged. The foundation
task after G-PA adds about 1 h.

## Change log

- 27 Oct 2026: written (travel-design-reviewer, Claude Opus 5.5).
