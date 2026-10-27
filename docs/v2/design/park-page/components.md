# Park page and /parks: components

Part of [the park page design](README.md) (PA-N, gate G-PA). Every piece maps to the foundation
([components.md](../foundation/components.md), [patterns.md](../foundation/patterns.md), [tokens.md](../foundation/tokens.md)).
Colour only from `web/app/themes.css` tokens; no literal colour, no green (product direction). Five pieces are new; the
design reviewer adds them to the foundation with measured contrast before PA-2 starts (README R4).

## 1. Existing components, reused as they are

| Where on the page | Foundation component | Notes |
|---|---|---|
| Breadcrumb "Parks · Canada · Alberta" | 1.5 Breadcrumbs | root link to `/parks` (PN3) |
| Cover, kicker, title, summary | patterns 3.6 and 3.11 cover; `web/components/places/cover.css` | kicker white 80% on a photo, never amber |
| Completeness chip, "What is not checked" | 3.11 identity; `levelWord` | links to `#not-checked` |
| Relevance badge | `CoverRelevance` | unchanged |
| Plan a visit chips | 2.1 Buttons, **secondary**, md 38 px desktop, 44 px tall on phones, as `<a>` | a group with a visible label "Plan a visit"; sub-label in mono `--t-meta` `--muted` inside the button; not segmented (they navigate, they do not select) |
| Directions, Save to a trip, Share | 2.1 Buttons; `SaveToTrip` | Save to a trip is primary when the builder is off (PN7) |
| Heart | 2.11 Favourite toggle | unchanged |
| Closed-season and closure banner | 5.4 Banners, **caution** (`--warn-soft`); the notice kind for a zone between seasons | one at most (PN11) |
| Glance strip | patterns 3.11 glance | six facts at most |
| Window chips on requirement rows | 2.8 Chips: **to book** (ticket), caution and urgent only with a trip date, neutral "Buy any time" | the dateless park page never draws urgency colour |
| Gap rows ("Entry not checked yet") | 2.8 **gap** chip | safety gaps keep their row (P2) |
| Requirement detail | 6.4 Disclosure, **static** (`<details>`) | zero JS; print opens it |
| Member counts | 3.6 Count card | one `<a>` each to `/places?within=<slug>&k=<kind>` |
| Members, desktop | 3.1 Place card, 3-up grid, 6 per group | kids chip first, then effort (2.8) |
| Members, phone | 3.2 List row | 56 px rows |
| Members block itself | EG-W's members block (`web/components/places/context/**`) | imported, not rebuilt (PN9, README R2) |
| Map card | 7.1 Map with `MapSpec` `style: 'auto'`, `Pin.quiet` for crowded pins, clusters | at most 24 pins; honesty line (T5) |
| Links | `LinksTabs` | tabs only with two or more groups |
| Not checked yet | 6.5 | unchanged |
| Facts and sources | 6.4 static disclosure | unchanged |
| `/parks` toolbar | patterns 2 public list grid; 2.10 Search with `/`; 2.7 Filter pills (phone docking); 2.9 Segmented (List, Cards, Map) | |
| Where pill | `WhereMenu` | gains `levels={2}` (hides "Parks and areas"); PA-IX |
| `/parks` rows and cards | 3.2 List row (two-line variant below), 3.1 Place card | |
| Pager | 8.5 | 48 per page |
| Empty, skeleton, error | 6.1, 6.2, 6.3 | |

## 2. New pieces (five)

| # | Piece | What it is | Built from | Owner task |
|---|---|---|---|---|
| N1 | **Requirement row** | one entry requirement at rest: kind glyph 26 px on `--well`, name serif 16.5/600, window chip right, who-needs-it line mono `--t-meta`, price line mono 13.5 (three bands then "+n"), covered-by line, scope label ("Moraine Lake", "From Yoho National Park"), link; a static disclosure "Details" for the rest | 3.2 List row grid + 2.8 chips + 6.4 disclosure; no card border, 1 px `--line` between rows | PA-2 (`web/components/places/park/RequirementRow.tsx`) |
| N2 | **Requirement group** | heading `--t-label` `--ink-2` ("Book ahead", "Passes and fees", "On the day", "Inside the park: own bookings", "From <park>") with a mono count; empty groups not drawn; "Inside the park" caps at 4 rows and a "Show n more" static tail, its names always listed in the count line | 6.4 static disclosure for the tail | PA-2 |
| N3 | **Month strip, season variant** | `MonthStrip variant="season"`: words open, part, closed, blank (states.md 4.1) | 4.7 Month strip, same cells and container query | PA-2 adds the prop to the existing component; the reviewer confirms the pairs |
| N4 | **Two-line park row** for `/parks` | 3.2 List row at 72 px: line 1 name; line 2 meta (kicker · area · drive) and chips; photo 96 x 64 or the glyph | 3.2 | PA-IX (`web/components/parks/ParkRow.tsx`) |
| N5 | **List beside the map** (`/parks` desktop default) and the **Drive time pill** | layout: list 1fr (min 560) + sticky map 44% from 1024 px; pill: a 2.7 pill whose menu has a hub list, a "Use my location" row and 1 to 4 h chips | patterns 2 public list grid; 2.7; 7.1 | PA-IX (layout), PA-IXD (pill) |

Plus one **new label** in an existing chip kind: the honesty chip "May be out of date" (components 2.8, honesty look),
for stale safety facts only (states.md 3).

Not new, deliberately: no "park card" component (the place card serves), no "entry chip strip" (the requirement row is
denser and opens in place), no tabs on the park page (sections with a section index, as every place page).

## 3. Tokens used

`--surface`, `--well`, `--line`, `--line-2`, `--ink`, `--ink-2`, `--muted`, `--accent`, `--accent-text` (links and the
selected pin ring), `--warn-soft` and `--warn` (caution banner, caution chips), `--crit` (honesty chip), `--info-soft` and
`--info` (notice banner for a zone between seasons), the map tokens of tokens.md 5. No new token. Contrast pairs are those
already measured for each component; N1 and N4 reuse the 3.2 pairs.

## 4. Accessibility

- Requirement rows are a `<ul>` per group with the group heading as its label; each row's window chip has text, never
  colour alone; the disclosure summary reads "Details of Daily admission".
- The Plan a visit group is a `<nav aria-label="Plan a visit">` with three links; names in [anatomy.md](anatomy.md) 7.
- Count cards are links named "17 trails in Banff National Park".
- `/parks`: the map is `role="application"` with the list as its on-screen equivalent (components 7.1); the list is
  always present on desktop and one segment away on phones.
- Targets 44 x 44 on touch; 8 px between targets; no sideways scroll at 320.
