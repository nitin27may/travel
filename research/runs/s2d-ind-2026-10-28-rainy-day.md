# S2D-IND: the rainy-day (indoor) flag, 28 Oct 2026

Task S2D-IND (DG-01; docs/v2/build/DATA-PLAN.md 2.4). Run record: `data/capture/runs/s2d-ind-2026-10-28-rainy-day.json`.
No web requests and no capture, suitability or relevance file was written: the rule is a type default plus a value that records already hold.

## The rule

A place is indoor (row flag `indoor`, which the add picker's Rainy day chip and the `f.indoor-or-rainy-day` facet read) when:

1. its own relevance record has `weather: indoor` (a researcher's judgement of that one place), or
2. its type, or the nearest ancestor that sets one, has `indoor_default: true` in `data/vocab/types.json`.

A node may set `false` to cancel its parent's default. A mixed type has no default, so only a record can make it indoor.
`weather: any_weather` does not count: it means "worth it in any weather", not "under a roof", so a weather-proof viewpoint is never
indoor. The flag is emitted only when true. A no adds nothing a list filters on, and adds no bytes.

The flag is worked out when a list row is built (`core/src/capture/indoor.ts`, called from `bandsOf` and from the no-record path of
`web/lib/public/bands.ts`). No place JSON stores it. A place page carries no row flags, so the place-size median stays at 1.2542, the
same as before the change.

| Indoor by type | Not indoor by type (cancels a parent) | Mixed: no default, the record decides |
|---|---|---|
| `culture.museum` (all museums, galleries, science centres, planetariums), `culture.heritage.visitor_centre`, `culture.heritage.palace`, `culture.under` (show caves, mine tours), `culture.tour.factory_tour`, `cooking_class`, `tasting`, `culture.show.performance`, `animals.see.aquarium`, `water.swim.aquatic_centre`, `water.thermal.spa`, `sauna`, `mountain.climb.indoor_wall`, `play.playground.indoor_play`, `play.amusement.trampoline_park`, `family_centre`, `food.eat` (restaurant, cafe, bakery, teahouse, bar, hut kitchen), `food.drink` (brewery, winery, distillery, cidery), `food.market.food_hall`, `grocery`, `access.amenity.visitor_info` | `culture.museum.open_air_museum`, `food.eat.food_truck` | every lift (`ride.lift.*`), scenic rail, `water.thermal.hot_spring`, `water.thermal.thermal_bath`, castles, religious sites, historic sites, zoos, markets, skating rinks, sound and light shows, caving, every viewpoint |

The tree has no shop type, so shops are not covered. Adding one is a new type entry in types.json; this run did not add one.

## What each trip's records flag now

Records counted over the capture world, with an offer that only sells a place left out. "Why" is the input that set the flag.

| Trip | Flagged | Records | Why |
|---|---|---|---|
| canadian-rockies-2029 | 3 | 203 | Cave and Basin (relevance weather), Fairmont Banff Springs spa (type `water.thermal.spa`), Sky Bistro at the Banff Gondola summit (type `food.eat.restaurant`; a part, no page of its own) |
| catalogue | 6 | 114 | the six Parks Canada and Kananaskis visitor centres (type `access.amenity.visitor_info`, and relevance agrees); parts of their parks, no pages of their own |
| dolomites-2027 | 1 | 75 | Ötzi, South Tyrol Museum of Archaeology (type, and relevance agrees) |
| chamonix-mont-blanc-2028 | 1 | 21 | Grotte de la Mer de Glace (type `culture.under.show_cave`, and relevance agrees) |
| iceland-ring-road-2027 | 1 | 31 | Glaumbaer turf farm (type `culture.museum.museum`, and relevance agrees; see review) |
| patagonia-2027 | 1 | 28 | "Cafe and bookshops", El Chalten (relevance weather; typed as a town) |
| algonquin-muskoka-2026, new-hampshire-stopover-2026, usa-southwest-rockies, utah-five-parks, vermont-fall-2026 | 0 | 6, 2, 8, 25, 7 | none |

Public places (the Places list and the API) that carry `indoor`: 5 of 436 (Cave and Basin, Fairmont Banff Springs spa, Ötzi museum,
Grotte de la Mer de Glace, Glaumbaer turf farm).

## The Rainy day chip, per day

The chip is drawn only when a place on show carries the flag, so it shows on the days below and stays hidden everywhere else. The
counts are from `GET /api/v1/places/?bbox=` round each day's base, as the picker reads it (first page of 48, places within 30 km that
are stops). Every indoor place was on the first page. The plan model's own nearby candidates now carry `indoor: true` too (the
fallback when the API read fails).

| Trip | Days with the chip | Indoor places near | Days with no chip |
|---|---|---|---|
| Canadian Rockies | 1, 2 (Banff), 3 (Lake Louise; its centre is a stop near Banff) | 2: Cave and Basin, Fairmont Banff Springs spa | 4 to 15 (Jasper, Lake Louise, Kananaskis): 0 |
| Dolomites | 10, 11, 12 (Ortisei), 13 (Bolzano), 14 | 1: Ötzi museum | 1 to 9 (San Candido, Cortina, Ortisei day 9): 0 |

Kids is on by default for a family. For a child of 10 it hides the spa (from 18), so a Banff day with both chips on lists Cave and
Basin alone. A Dolomites day lists the Ötzi museum (no age limit).

## For human review

- **Hot springs.** The brief listed them as indoor; DATA-PLAN 2.4 lists them as mixed. The plan's reading is kept: Banff Upper, Miette
  and Radium are outdoor pools. If the owner wants "a good thing to do in the rain" rather than "under a roof", the fix is a second
  flag fed by relevance `any_weather`, not a wider `indoor`.
- **Gondolas and cable cars** (Banff, Jasper, Lake Louise, Kicking Horse, Nakiska, Lagazuoi, Aiguille du Midi, Montenvers): left mixed.
  Each has a covered ride and a summit building, but the visit is the view.
- **Thermal baths.** These were indoor by type until this run found Myvatn Nature Baths, an outdoor lagoon, under the same type. The
  type is now mixed.
- **Cave and Basin.** It has an indoor exhibit and cave and outdoor boardwalks. Its relevance record says indoor; the historic-site
  type says nothing. The flag follows the record.
- **Glaumbaer turf farm.** It is typed museum, but it is an open-air museum of turf houses. Retyping it as
  `culture.museum.open_air_museum` would drop the type default, and its relevance weather of indoor would still flag it.
- **Mistyped places with no record.** Places with no capture record take the type their kind implies, often `culture.heritage.landmark`.
  So the Capitol Reef visitor center and the collegiate church of San Candido are not flagged. Typing them is a data task (a record
  per place), not a rule change.
- **Patagonia "Cafe and bookshops".** It is flagged from its relevance record, but its type is a town. A typing pass could move it to
  `food.eat.cafe`.
- **No explicit "not indoor" on a record.** A record can say yes (relevance weather `indoor`) but cannot cancel an indoor type. The
  registry's `indoor` property still has no home (`home: none`). Giving it a capture home is a registry and schema change that alters
  the place page and API exposure, so it was left for when a record needs it.
- **Per-stop values for the Rockies and Dolomites days** (the Sonnet half of S2D-IND) are not written. The type rule and the
  relevance values cover what the files can say. The rest are the mixed cases above, which need the owner's call.
