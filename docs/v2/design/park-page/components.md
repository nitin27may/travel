# Park page and /parks: components

Part of [the park page design](README.md) (PA-N, revised after PA-NR; gate G-PA open). Every piece maps to the foundation
([components.md](../foundation/components.md), [patterns.md](../foundation/patterns.md), [tokens.md](../foundation/tokens.md)).
Colour only from `web/app/themes.css` tokens; no literal colour, no green (product direction). After the review, **one
component is new** (the requirement row), plus two variants of existing components and one chip label. The design reviewer
writes them into the foundation in **FND-PA, after G-PA and before PA-2** (README R4); the review's section 3 holds the
measured pairs.

## 1. Existing components, reused as they are

| Where on the page | Foundation component | Notes |
|---|---|---|
| Breadcrumb "Parks · Canada · Alberta" | 1.5 Breadcrumbs | root link to `/parks` (PN3) |
| Cover, kicker, title, summary | patterns 3.6 and 3.11 cover; `web/components/places/cover.css` | kicker white 80% on a photo, never amber; check the scrim on real park photos in PA-2 |
| Completeness chip, "What is not checked" | 3.11 identity; `levelWord` | links to `#not-checked` |
| Relevance badge | `CoverRelevance` | unchanged |
| **Save to a trip** | 2.1 Buttons, **primary** (`--accent` fill, `--accent-ink`); `SaveToTrip` | the one primary on every park page (PN7, review M1) |
| Directions | 2.1 Buttons, secondary | |
| Share | 2.1 Buttons, **icon** (38 px, hit area 44), `aria-label` | (review M1) |
| Heart | 2.11 Favourite toggle (icon button) | unchanged |
| Plan a visit group | 2.1 Buttons, **secondary**, as `<a>`, one-line labels "Day trip", "1 night", "2 nights", "Part of a longer trip"; 38 px desktop, 44 px tall on phones | `div role="group" aria-labelledby` the visible heading "Plan a visit"; no sub-labels; not segmented (they navigate) |
| Banner | 5.4 Banners: **notice** (`--info-soft`) for closed for the season or between seasons; **caution** (`--warn-soft`) for a dated closure in the next 30 days | one at most (PN11, review S7) |
| Glance strip | patterns 3.11 glance | six facts at most; the Entry fact is a link to `#entry` |
| Window chips on requirement rows | 2.8 Chips: **to book** (ticket), neutral "Buy any time"; caution and urgent only where a trip date is known | the dateless park page never draws urgency colour |
| Gap rows ("Entry not checked yet") | 2.8 **gap** chip | safety gaps keep their row (P2) |
| Requirement detail and "Show n more" tails | 6.4 Disclosure, **static** (`<details>`) | zero JS; print opens it |
| Season | 4.7 Month strip with `variant="season"` (section 2) or the one line "Open all year, read <date>" | strip only when a month is closed or partly open (S8) |
| Member counts | 3.6 Count card | one `<a>` each to `/places?within=<slug>&k=<kind>` |
| Members, desktop | 3.1 Place card, 3-up grid, 6 per group | kids chip first, then effort (2.8) |
| Members, phone | 3.2 List row | 56 px rows |
| Members block itself | EG-W's members block (`web/components/places/context/**`) | imported, not rebuilt (PN9, README R2) |
| Map card | 7.1 Map with `MapSpec` `style: 'auto'`, `Pin.quiet` for crowded pins, clusters | at most 24 pins; honesty line (T5); after Safety on phones (PN18) |
| Links | `LinksTabs` | tabs only with two or more groups |
| Not checked yet | 6.5 | unchanged |
| Facts and sources | 6.4 static disclosure | unchanged |
| `/parks` toolbar | patterns 2 public list grid; 2.10 Search with `/`; 2.7 Filter pills (phone docking); 2.9 Segmented (List, Cards, Map) | the `/places` views, default List (PN14) |
| Where pill | `WhereMenu` | gains `levels={2}` (hides "Parks and areas"); PA-IX |
| Drive time pill | 2.7 Filter pill with a hub menu ("From", "Use my location", band chips) | not a new component (review N5); PA-IXD; the existing `drive=<hub>-<band>` codec |
| `/parks` rows and cards | 3.2 List row `variant="two-line"` (section 2), 3.1 Place card | |
| Pager | 8.5 | 48 per page |
| Empty, skeleton, error | 6.1, 6.2, 6.3 | |

## 2. New after the review

| # | Piece | Verdict (PA-NR 4) | What it is | Owner |
|---|---|---|---|---|
| N1 | **Requirement row** | **new component, foundation 3.8** | one entry requirement at rest: kind glyph 26 px on `--well`, name serif 16.5/600, the window chip (right on desktop; **directly under the name on phones**), who-needs-it line mono `--t-meta`, price line mono 13.5 (three bands then "+n"), covered-by line, scope label ("Moraine Lake", "From Yoho National Park"), link; a static disclosure "Details" for the rest. **Group rules folded in** (was N2): a group is a heading `--t-label` `--ink-2` with a mono count and a `<ul>`; empty groups are not drawn; "Inside the park: own bookings" shows 4 rows at rest, names all in its count line, the rest in a "Show n more" static tail; a row with "May be out of date" never goes in the tail. Reused later on member pages and the trip's Bookings tab | FND-PA writes 3.8; PA-2 builds `web/components/places/park/RequirementRow.tsx` |
| N2 | Requirement group | **dropped as a component**; rules in N1 | | |
| N3 | **Month strip, season variant** | **a prop**, not a component | `MonthStrip variant="season"`: words open, part, closed, blank (states.md 4.1); not drawn for a park open all twelve months | FND-PA (4.7 text); PA-2 (the prop) |
| N4 | **Two-line list row** | **a general 3.2 variant**, not a park component | `ListRow variant="two-line"`: about 96 px at 1440, and it grows when the name wraps on phones (rendered 98 to 152 px at 390); line 1 name; line 2 meta (kicker · area · drive · places inside) and at most two chips; photo 96 x 64 or the glyph. `/places` can use it too | FND-PA (3.2 text); PA-IX builds it in `web/components/ui/` (not `ParkRow`) |
| N5 | List beside the map | **deferred** (review S6) | a list-engine feature for `/places` and `/parks` together, later, with the map after first paint and a measured budget | not in v1 |

Plus one **new label** in an existing chip kind: the honesty chip "May be out of date" (components 2.8, honesty look),
for stale **booking windows and closures** only (states.md 3, PN19).

Not new, deliberately: no "park card" component (the place card serves), no "entry chip strip" (the requirement row is
denser and opens in place), no tabs on the park page (sections with a section index, as every place page), no drive pill
component (a 2.7 pill).

## 3. Tokens used

`--surface`, `--well`, `--line`, `--line-2`, `--ink`, `--ink-2`, `--muted`, `--accent` and `--accent-ink` (the Save to a
trip primary), `--accent-text` (links and the selected pin ring), `--warn-soft` and `--warn` (caution banner), `--crit`
(honesty chip), `--info-soft` and `--info` (notice banner), the map tokens of tokens.md 5. No new token. Every pair is in
the review's section 3 (all pass AA; no green; `--ok` is not used on these pages).

## 4. Accessibility

- Requirement rows are a `<ul>` per group with the group heading as its label; each row's window chip has text, never
  colour alone; the disclosure summary reads "Details of Daily admission".
- The Plan a visit group is `div role="group" aria-labelledby` its visible heading, with four links; names in
  [anatomy.md](anatomy.md) 7. Not a `<nav>` landmark.
- Share is an icon button named "Share <park>"; the heart as components 2.11.
- Count cards are links named "17 trails in Banff National Park".
- `/parks`: in the Map view the map is `role="application"` with the list one segment away as its on-screen equivalent
  (components 7.1).
- Targets 44 x 44 on touch; 8 px between targets; no sideways scroll at 320.
