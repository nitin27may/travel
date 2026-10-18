# Changes from the Trailhead previews (18 Oct 2026)

What the foundation changes relative to `docs/v2/design/redesign/trailhead/*.html` and directions.md
section C, and why. Where a preview is listed as superseded, build from the foundation docs, not the HTML.

| # | Change | Why | Previews affected |
|---|---|---|---|
| 1 | **Amber only for selected, now, primary action.** Countdown chips are neutral; "to book" is a neutral outline chip (caution when the window is open, urgent inside 7 days); only the focused day sign is amber, the rest are quiet; base pins are ink signposts; cover kickers are white at 80%; globe controls fill only the active option. | Amber meant nine things on one screen (review C1). | all; home, plan, bookings-switch, public-trip, trail superseded for colour |
| 2 | **New caution and info roles** (`--warn` ochre text on a pale well, never a fill; `--info` slate). Danger fill `--crit-fill` with white text in both themes. | The previews had only urgent and done; "window open", "over pace", "offline" and "read-only" had no colour of their own. | tokens only |
| 3 | **Green stays only for done, booked, fits.** Provenance dots on trail facts become text labels. Kind glyphs are ink on a well, not teal. | Owner: no green palette; teal glyphs collided with the Costa Rica identity. | trail, places, home (Peru idea card) |
| 4 | **Identity swatches get a 1 px `--line-2` keyline.** | Yellow (1.3:1) and sky (2.3:1) vanished on white. | home, bookings-switch, phones |
| 5 | **Public header variant**: Trips · Places · Globe, search, theme, Sign in; no trip chip or bell for visitors. "Discover" is renamed Trips; the household's own trips are Home. | Read-only without login is the primary surface. | home, public-trip, trail, places headers |
| 6 | **Trip bar is a fixed 88 px band**, one-line truncating name and meta; drawers open below it. | Patagonia's meta wrapped and the drawer covered the tabs. | plan, bookings-switch |
| 7 | **Public trip page is categorised and chronological**: category strip (Stays, Trails, Sights, Food, Logistics), By day / By category segment, fourteen uniform day rows instead of six cards plus eight rows. | Owner's product direction; the preview was chronological only and changed shape halfway. | public-trip superseded for structure |
| 8 | **Globe specified** (full-bleed, floating controls, side panel, selection card, fly-in rules) instead of a screenshot of the live page. | It is the public entry point and was not designed. | places (globe section) superseded |
| 9 | **Map: All-days view uses 6 px dots and routes; numbered pins only for the picked day; co-located stops merge with a "3 · 5" badge; the picked route gets a 1 px ink casing; dark-map contour, water and halo tokens.** | 40 overlapping numbered pins were unreadable; dark contours were invisible. | plan, public-trip, plan-phone maps |
| 10 | **Drag handle has a 24 x 44 hit area (28 x 44 phone); insertion pill reads "to Day 3 · before 11:30".** | 17 px glyph with no target. | plan, plan-phone |
| 11 | **Mono never wraps**: card meta is one truncating line; section subtitles are serif. Lower-casing of place names removed. | "Sat 24 Oct 2026, day trip from whitby" wrapped and was mangled. | home, places |
| 12 | **Readiness is one labelled bar** that splits into four stages on hover. | Four unlabelled 4 px bars. | home |
| 13 | **Table status**: Planned = filled ink dot, Idea = dashed ring, Done = check; density is a Compact / Comfortable segment. | Amber status dot (see 1); the toggle did not show its state. | places |
| 14 | **Phone bottom bar**: 11.5 px labels, 28 px photo with ring and keyline, 56 px items. | 10.5 px labels and a 26 px switcher. | plan-phone, today-phone |
| 15 | **Input and button borders** `#7A8794` light / `#5E748E` dark. | Preview `#8C99A8` was 2.9:1 on white, under the 3:1 UI minimum. | all |
| 16 | **Focus, pressed, disabled, loading, error and empty states defined** for every component, with the focus ring token. | None were drawn. | all (additive) |
| 17 | **Type scale fixed to eight display sizes** (96, 72, 40, 32, 24, 19, 15, and 78 for leave-by). | Ten ad-hoc sizes in the previews. | all |
| 18 | **Links on the trail page become tabs by group**; hazards move above the fold. | 12 links pushed hazards down a 400 px column. | trail |
| 19 | **No infinite scroll**: 48 cards / 100 rows per page with a pager and URL `?page=`. | Credits and attribution must stay reachable; CSV and group collapse need a bounded set. | spec only |
| 20 | **"Held" chip** is an outline with a clock, not dashed. | Dashed is reserved for Idea and honesty markers. | bookings-switch |

Not changed: the palette base (paper `#F5F6F8`, slate `#172230`, navy header with the amber rule, dark
`#0F1620`), the three typefaces, the card anatomy, the day sign, the item row, the switcher menu, the
form drawer with the trip photo header and "Files under", the Needs-you columns, the Today frames
(content and layout), the season band, the credits footer. Build those from the previews as drawn.
