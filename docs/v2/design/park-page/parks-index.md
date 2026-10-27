# The /parks index

Part of [the park page design](README.md) (PA-N, revised after PA-NR; gate G-PA open). `/parks` lists every national, provincial or state park and
equivalent we hold. It is **the places list engine with the protected-area kinds fixed** (PN14): the same `listPlaces`
and `countPlaces` calls through `web/lib/public` and `/api/v1/places`, the same cards, pills, pager and map, a different
title and filter set, and the `/places` views (List, Cards, Map; default List). No new list code, no new client bulk load (P9).

## 1. What is listed

| Included (type) | Filter label (Type pill) | Card kicker |
|---|---|---|
| `nature.protected.national_park` | National park | National park |
| `nature.protected.state_provincial_park` | State or provincial park | "Provincial park" (CA), "State park" (US), else "Park" (Q-PN9) |
| `nature.protected.conservation_area`, `nature.protected.nature_reserve` | Conservation area or reserve | Conservation area · Nature reserve |
| `nature.protected.forest` | National forest | National forest |
| `nature.protected.dark_sky_site` | Dark-sky site | Dark-sky site |

Not listed: `nature.protected.zone` (zones live inside their park's page), places of other types, and the four records of
Q-PN6 until the data seat has reviewed them. Store-only parks (a locations-store place of kind `park` with no capture
record) are listed when the type map gives them a `nature.protected.*` type; PA-IXC checks this.

Measured on `main`, 27 Oct 2026: 29 capture records typed `nature.protected.*` (12 national parks, 11 state or provincial
parks, 4 nature reserves, 3 conservation areas, 2 forests, 2 zones; the coordinator's "34" counted branches not yet
merged) and 17 locations-store places of kind `park`. The page is designed for 10,000 (P1).

## 2. URL and list state

`/parks` plus list state in the patterns 1.2 order. Defaults are omitted. The `/parks` row is added to patterns 1.2 in
FND-PA after G-PA (README R4).

| Key | Meaning | Example |
|---|---|---|
| `q` | search within parks (names and areas) | `q=lake` |
| `country`, `region` | the Where pill (country, then province or state) | `country=ca&region=on` |
| `k` | Type, as type ids (the Places `k` facet) | `k=nature.protected.national_park` |
| `season` | open in these months (the Open in pill) | `season=jul,aug` |
| `drive` | Drive time, the **existing** codec (PN15, review M6): `<hub>-<band>`, the band in whole hours up to the parser's `HUB_MAX`, comma list allowed; the same values smart search writes (`core/src/parse/parse.ts`) and labels (`core/src/query/valueLabels.ts`: "Within 3 hours of Toronto") | `drive=toronto-3` |
| `view` | `list` (default), `cards`, `map`, as `/places` | `view=map` |
| `bbox` | "Search this area" in the Map view (existing `ListState.bbox`) | `bbox=-80.5,44.9,-77.4,46.2` |
| `sort`, `dir` | `draw` (default), `name`, `drive` (default when `drive` is set) | `sort=name` |
| `page` | pager, 48 per page (components 8.5) | `page=2` |

Example: `/parks?country=ca&region=on&season=jul&drive=toronto-3`.

No `from` key. `drive` carries only a public hub id (today `toronto`; more hubs as the hub list grows; airports as ids such
as `yyz` once ORG has them), never a town, a point or a home (trip-builder OR9). An unknown hub drops the key and shows the
Drive time pill unset. `drive` is a trips-only facet today (`TRIPS_ONLY` in the parser); PA-IXC allows it on places lists
for protected areas, with the same meaning.

## 3. Filters (P4: four pills, results update as you choose)

| Pill | Menu | Count per option | Notes |
|---|---|---|---|
| **Where** | the existing WhereMenu with two levels only (country, then province or state); the "Parks and areas" column is hidden here | yes, live | `WhereMenu` gains a `levels={2}` prop (one small change, PA-IX) |
| **Type** | checkboxes of section 1; labels follow the chosen country, fallback "Park" (Q-PN9) | yes | multi-select |
| **Drive time** | "From" (the hub list; airports when ORG adds them) and "Use my location" (the device picks the nearest public hub and the pill says "From Toronto, nearest to you"); then "Up to" chips by band (1 h, 2 h, 3 h, 4 h) | yes, per band | the existing 2.7 pill with a hub menu; drawn only when the driving-time model and the hub list exist (PA-IXD, Q-PN5); routed times say "about 2 h 50", modelled ones "≈ 2 h 50" |
| **Open in** | months (Jan to Dec), multi-select; "Open all year" option | yes | filters opening, not quality. **Parks with no checked season stay in the result**, in a second group "Season not checked (n)" under the open parks, each with the gap chip (PN20, review M5). Nothing is dropped silently |

"More filters" is not drawn in v1 (no extra row keys). Camping and Entry filters are a later step when the counts justify
them (they would need more row keys, P8).

Active state, clear, counts and the phone docking menus are components 2.7 unchanged. "Clear all" in the subbar. Under
640 px Sort moves into the Filters sheet, so the subbar keeps one line (review S9).

## 4. Layout

v1 uses the `/places` views: **List (default), Cards, Map**. The list-beside-map split is **deferred** (review S6): it would
load the map at first paint on desktop, which `/places` does not, and it is a list-engine feature to add for `/places` and
`/parks` together later, with the map after first paint and a measured budget.

### 4.1 Desktop, 1440: List view (default)

```
+--------------------------------------------------------------------------------------------------------------+
| TRIP PLANS    Trips  Places  Globe                                   [search] [theme] [Mine] [Sign in]        |
+--------------------------------------------------------------------------------------------------------------+
| PARKS                                                                                                        |
| National, provincial and state parks we have researched, with what you need to enter.                        |
| [ / Search parks ]  (Where: Canada · Ontario x) (Type v) (Drive time v) (Open in: Jul x)   [List|Cards|Map]  |
| 14 parks · Clear all                                     Sort: Most worth it v  [dir]                         |
+--------------------------------------------------------------------------------------------------------------+
| OPEN IN JULY · CANADA · ONTARIO                                                                     9        |
| +----------------------------------------------------------------------------------------------------------+ |
| | [photo 96x64] ALGONQUIN PROVINCIAL PARK                                                                 > | |
| |               Provincial park · Ontario · ≈ 2 h 50 from Toronto · 120 places inside                      | |
| |               [Fee · book ahead] [Open May to Oct]                                                        | |
| +----------------------------------------------------------------------------------------------------------+ |
| | ...                                                                                                      | |
| +----------------------------------------------------------------------------------------------------------+ |
| SEASON NOT CHECKED · CANADA · ONTARIO                                                               5        |
| +----------------------------------------------------------------------------------------------------------+ |
| | [glyph]       ARROWHEAD PROVINCIAL PARK                                                                 > | |
| |               Provincial park · Ontario                                                                  | |
| |               [Entry not checked yet] [Season not checked]                                               | |
| +----------------------------------------------------------------------------------------------------------+ |
| ‹ 1 ›  1 to 14 of 14                                                                                         |
+--------------------------------------------------------------------------------------------------------------+
| credits footer                                                                                               |
+--------------------------------------------------------------------------------------------------------------+
```

Values in the frame are a shape: Algonquin has no park record yet (PA-R-ON), and drive times wait for the model.

- Rows are the list row `variant="two-line"` (components 3.2 variant, review N4): photo or glyph, name (serif 17/600), meta
  line (kicker · area · drive · places inside), then at most two chips (entry label, season). Kids and effort chips are not
  drawn on park rows (a park has no single effort); they are on the park's members.
- Group by country with sticky headings and counts (keep-from-live-site); one country chosen: group by province or state.
  With Open in set, the open parks come first and "Season not checked" second, each grouped the same way.
- `Cards` view uses the place card (3.1) in the 4/3/2/1 grid. `Map` view is the map full width with the pins of the
  current page, per-country count discs, "Search this area" after a pan, a "List" button, and the honesty line "Pins mark
  each park's main visitor centre or map point; no park boundary is drawn" (T5). The map loads only in the Map view.

### 4.2 Phone, 390

```
+--------------------------------------+
| TRIP PLANS            [s] [user] [t] |
+--------------------------------------+
| PARKS                                |
| National, provincial and state parks |
| [ Search parks               ]       |
| (Where: Ontario x) (Type) (Drive) >  |   (pills scroll sideways with a fade; "Filters (2)" opens the sheet, with Sort)
| 14 parks · Clear all   [List | Map]  |
+--------------------------------------+
| OPEN IN JULY · ONTARIO            9  |
| [glyph] ALGONQUIN PROVINCIAL PARK >  |
|  Provincial park · ≈ 2 h 50 ·        |
|  120 places inside                   |
|  [Fee · book ahead] [May to Oct]     |   (two chips at most, one chip line)
| ------------------------------------ |
| SEASON NOT CHECKED · ONTARIO      5  |
| [glyph] ARROWHEAD PROVINCIAL PARK >  |
|  Provincial park                     |
|  [Entry not checked yet]             |
| ...                                  |
| ‹ 1 ›  1 to 14 of 14                 |
+--------------------------------------+
| Trips   Places   Globe   Mine        |   (bottom bar)
+--------------------------------------+
```

Map on phones is the `Map` segment: the map fills the content area under the toolbar, a peek card (components 7.2's
selection card pattern) opens on a pin tap with "Open park", and "List" returns with the scroll kept (P5).

## 5. The row: what it carries (P8)

| Shown | Row key | Status |
|---|---|---|
| name, kind word, area, slug, season, completeness label | existing allowlist | exists |
| entry label: "No fee", "Fee", "Book ahead", "Fee · book ahead", "Entry not checked yet" | `entry` enum `none`, `fee`, `book_ahead`, `fee_book_ahead`, `not_checked` | new, Q-PN4 (answered, with `fee_book_ahead`), PA-IXC |
| places inside | `members` (integer) | new, Q-PN4, PA-IXC |
| drive time from the chosen hub | `driveMin` and its basis (routed, modelled), only in a response to a `drive` query | new query output, PA-IXD; never stored on the row |
| photo | existing card photo ref | exists |

No prices, windows, links, authority names or facts on a row: those are on the park page, one request per park (P8).

## 6. States

| State | What shows |
|---|---|
| Loading | 8 skeleton rows (components 6.2); in the Map view the map's `--well` "Loading map" |
| Open in, some parks unknown | the open parks, then "Season not checked (n)" with the gap chip on each; never a "show them" link (M5) |
| Empty result | components 6.1, with the nearest match (principles P4): "No parks open in January in Ontario in our catalogue. Without 'Open in: Jan' there are 14." and one button "Remove Open in"; then "Ask us to research a park ->" (only when REQ's route exists, R7) |
| No parks in a country at all | "We have not researched parks in <country> yet." (never padded with other countries) |
| Drive time with nothing in range | "No parks within 1 h of Toronto in our catalogue. 6 within 2 h ->" (widens the band by one step) |
| Error | components 6.3 inline, Retry |
| Map error | the Map view shows the error with Retry and a "List" button |

## 7. Entry points

- Places page title block: a link chip "Parks" beside the view segment (`/parks`, carrying `country` and `region` when set).
- Home: one tile in the inspiration grid when Home is redesigned (not in this task).
- Every park and zone breadcrumb root (PN3).
- The Globe's park feature card (`?f=park:<id>`): "All parks in <country> ->".
- `sitemap.xml` lists `/parks` once; filtered URLs are not in the sitemap and carry `rel=canonical` to `/parks`.

## 8. Performance and scale (P1, P9)

- Server-rendered first page (48 rows), with list state from the URL; filters call `/api/v1/places` with the fixed `k`
  set, as the Places page does.
- The map loads only in the Map view and draws only the current page's pins plus per-country count discs from
  `countPlaces` (no full point set); "Search this area" sets `bbox`.
- `/parks` start JS no larger than `/places` (PN17), measured by `pnpm --dir web budget:report`.
- The 10,000-place synthetic check (principles P1 table) runs with 10,000 synthetic parks: first page under the list
  budget, counts correct, pager correct, and the "Season not checked" group counted right.
