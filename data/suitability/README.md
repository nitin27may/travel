# data/suitability: who a place suits, with provenance

Sidecar files in the `suitability/1` format. They say whether a trail, activity, lake, sight or town suits a 6-year-old, a baby in a stroller, someone with limited capacity, and how hard it is, with a source and a read date for every value. The spec is `docs/v2/research/suitability.md`; the schema is `core/src/schema/suitability.ts`, exported to `data/schema/generated/schema.json` as `sidecar.suitability`.

```
data/suitability/
  README.md                          this file
  scope.json                         the 207 in-scope refs and every place slug (generated, do not edit)
  <trip>/migrated.json               S0: values moved out of the existing fields; nothing new
  canadian-rockies-2029/migrated-offplan.json
                                     S0: the Rockies rows on no plan day (the Kicking Horse and horse fixes live here)
  <trip>/<lane>.json                 R1-R6: one file per enrichment lane
```

## Commands

```
node core/bin/suitability.ts check [--coverage <trip>]   validate every file; with --coverage, list scope refs nobody covers
node core/bin/suitability.ts derive [--write] [--trip t] print the computed effort; --write stores the flat catalogue copy
node core/bin/suitability.ts migrate [--write|--check]   regenerate the migrated files from the existing fields
node core/bin/suitability.ts codes                         list the E_SUIT_* and W_SUIT_* codes
pnpm --dir web exec vitest run -c ../tools/suitability-scope/vitest.config.mts   regenerate scope.json from the public adapter
```

`check` runs inside `bash tools/check-all.sh`. `node core/bin/validate.ts --all` validates the same files with the same codes.

## The file

```jsonc
{
  "schema": "suitability/1",
  "trip": "dolomites-2027",
  "lane": "R1",
  "researched": "2026-10-20",
  "agent": "travel-researcher",
  "model": "opus",
  "sources": [
    { "id": "src-0001", "url": "https://...", "title": "...", "publisher": "...", "kind": "official", "read": "2026-10-20" }
  ],
  "records": [ { "ref": "place/lago-di-braies", "kind": "lake", "suitability": { }, "ext": { }, "offers": [ ], "hints": [ ], "flat": { } } ]
}
```

- `sources` is the file's own table. Every `src` id in a value must be in it, and every source has a read date. A source that is a file of this repo uses `kind: computed`.
- A record is one ref. A ref appears once across the lane files of a trip. A `migrated*.json` record for the same ref is superseded by the lane record and is not a duplicate.
- `suitability` is the shared block (spec 1.2). Every field is optional, and every value in it is a `Val` (below).
- `ext` is the per-kind extension (spec 2), a union on `ext.kind`: `trail`, `ride`, `paddle`, `ferrata`, `water`, `cave`, `snow`. `water` holds nothing yet; water facts are in `suitability.water_safety`.
- `offers[]` are products that differ (Family Float and Class III). Each has a `name` and its own `suitability`. An offer's fields win; anything it leaves out falls back to the record.
- `hints[]` are pointers for the next lane: a thing the old data said that a migration may not turn into a value (`child_6yo_ok`, a plan audience, a label such as "hard"). A lane reads them and then sets real values.
- `flat` is the computed copy of the flat catalogue columns (`min_age`, the height and weight limits, `house_grade`, `kid_fit`, `accessibility`, `walk_km`, `walk_gain_m`). Never type it: run `derive --write`. `check` fails when it is stale.

## A value

```jsonc
{ "v": 8, "state": "value", "basis": "operator_rule", "src": ["src-0001"], "read": "2026-10-20", "quote": "minimum age 8", "note": "..." }
```

| State | Meaning | Needs |
|---|---|---|
| `value` | a value | `v`, a `basis`, and either `src` or basis `our_inference` with a `note` that names the method |
| `none_stated` | the source says there is no limit | a `basis` (whose statement it is) |
| `searched_none` | looked, nothing published | `on` (the date) and `tried` (the pages: the operator's or the land manager's own page first) |
| `not_applicable` | does not apply to this kind | nothing; hidden in the UI |
| `gap` | not checked yet | nothing |

`v` is null unless the state is `value`.

| Basis | Use for |
|---|---|
| `operator_rule` | the operator's own rule: age, height, weight, harness, swim test, adult ratio |
| `official_rule` | a land manager's or a law's rule: a group of four, a permit age |
| `official_grade` | a published grade in a recognised system: SAC T2, CAI E, Parks Canada Moderate, Class II |
| `official_info` | a fact from an operator or land manager that is not a rule: "paved for 1.2 km" |
| `community` | dated trip reports and forum posts; never for a limit; fine for shade, signal, stroller |
| `our_inference` | our judgement or computation, with the method in `note` |

Rules the validator enforces:

- **A hard limit** (`min_age`, `max_age`, the height and weight limits, `adult_required`) rests on `operator_rule` or `official_rule`. `group_min` rests on `official_rule`. Anyone else's figure goes under `conflicts`, never into `v` (`E_SUIT_LIMIT_BASIS`).
- **Say which end it is.** `min_weight_kg` and `max_weight_kg` are two fields. The Kicking Horse 50 lb minimum was once stored as a maximum.
- **Units.** A quote in lb, in, ft or mi needs a `note` with the conversion: "44 in = 112 cm" (`E_SUIT_UNIT`). Weights to one decimal.
- **Link-only sources.** AllTrails, Komoot, Gaia, Outdooractive, Wikiloc, Google, Tripadvisor and booking sites are never a `src` (`E_SUIT_LINK_ONLY_SRC`). Trailforks only for `community` values.
- **Family effort is computed.** Do not type `family_effort`, `terrain`, `band` or `effort_km` (`E_SUIT_TYPED_EFFORT`). Give `effort.source_grade` and `effort.drivers`; `derive` does the rest: terrain from the grade through `data/schema/difficulty-map.json`, else from the drivers, else from `effort.override`; band from `effort_km = km x mode factor + gain_m / 100`; family effort is the larger of the two.
- **`wheelchair: step_free`** needs `official_info`. An accessible entrance with one step is `partial`.
- **Conflicts are kept, never averaged.** `conflicts: [{ v, basis, src, note }]` sits next to the state; the validator warns (`W_SUIT_CONFLICT`).

## Refs

| Form | For |
|---|---|
| `place/<slug>` | an item with a public place page |
| `legacy/<folder>/<dataset>/<id>` | a row of `legacy/<folder>/data/<dataset>.json`: `trails`, `sights` or `adventures` |
| `trip/<trip>/<kind>:<normName>` | a summary-trip stop with no page and no id |
| `offer/<parent ref>#<product>` | a product of an activity (offers are normally nested, so this form is for cross-reference) |

Every ref must resolve (`E_SUIT_REF`). `scope.json` lists the `place/` and `trip/` refs; `legacy/` refs are read from the dataset.

## Examples

Full files that validate are in `core/test/fixtures/suitability/valid/`. The three families, trimmed:

**A trail**

```json
{
  "ref": "legacy/canadian-rockies-sept-2029/trails/larch-valley-sentinel-pass",
  "kind": "trail", "subkind": "hike",
  "suitability": {
    "age_band": { "v": { "from": 10, "to": null }, "state": "value", "basis": "our_inference", "src": [],
      "note": "11.2 km and 750 m (effort_km 18.7) is over the 6-7 and 8-9 ceilings" },
    "kid_note": "Too long and steep for a 6-year-old; the meadow is a natural turnaround.",
    "stroller": { "v": "none", "state": "value", "basis": "our_inference", "src": ["src-0001"] },
    "stroller_extent": { "scope": "whole" },
    "group_min": { "v": null, "state": "searched_none", "basis": null, "src": [], "on": "2026-10-18",
      "tried": ["parks.canada.ca Moraine Lake page", "Banff trail conditions"] },
    "effort": {
      "source_grade": { "v": null, "state": "gap", "basis": null, "src": [] },
      "drivers": {
        "distance_km": { "v": 11.2, "state": "value", "basis": "official_info", "src": ["src-0001"] },
        "gain_m": { "v": 750, "state": "value", "basis": "official_info", "src": ["src-0001"] }
      }
    }
  },
  "ext": { "kind": "trail", "shape": "out-and-back" }
}
```

**An activity with offers**

```json
{
  "ref": "legacy/canadian-rockies-sept-2029/adventures/kicking-horse-family-float",
  "kind": "activity", "subkind": "rafting",
  "suitability": { "limit_reason": "seat" },
  "ext": { "kind": "paddle", "craft": { "v": "raft", "state": "value", "basis": "operator_rule", "src": ["src-0001"] } },
  "offers": [
    { "name": "Family float",
      "suitability": {
        "min_age": { "v": 8, "state": "value", "basis": "operator_rule", "src": ["src-0001"] },
        "min_weight_kg": { "v": 22.7, "state": "value", "basis": "operator_rule", "src": ["src-0001"], "quote": "50 lb", "note": "50 lb = 22.7 kg, a minimum" },
        "water_safety": { "class": { "v": { "system": "whitewater", "value": "II" }, "state": "value", "basis": "official_grade", "src": ["src-0001"] } }
      } },
    { "name": "Class III", "suitability": { "min_age": { "v": 12, "state": "value", "basis": "operator_rule", "src": ["src-0001"] } } }
  ]
}
```

**A lake with water safety**

```json
{
  "ref": "place/lago-di-braies",
  "kind": "lake",
  "suitability": {
    "stroller": { "v": "smooth", "state": "value", "basis": "official_info", "src": ["src-0001"] },
    "stroller_extent": { "scope": "part", "part_note": "west shore only; steps on the east side" },
    "wheelchair": { "v": "partial", "state": "value", "basis": "official_info", "src": ["src-0001"] },
    "water_safety": {
      "lifejacket": { "v": "bring_own", "state": "value", "basis": "official_info", "src": ["src-0001"] },
      "lifeguard": { "v": null, "state": "searched_none", "basis": null, "src": [], "on": "2026-10-18", "tried": ["lake operator page", "municipality page"] }
    },
    "access_season": { "v": [{ "from": "06-15", "to": "09-30", "status": "open", "via": "road" }], "state": "value", "basis": "official_info", "src": ["src-0001"], "applies_to": "2026" }
  },
  "ext": { "kind": "water" }
}
```

## Lane acceptance checks

A research lane (R1-R6) fails if any of these fails:

1. `node core/bin/suitability.ts check` has no errors on the lane's files.
2. `check --coverage <trip>` lists nothing: every in-scope ref of the trip appears exactly once across the trip's files.
3. No hard limit has a basis other than `operator_rule` or `official_rule`. No source is on the link-only list.
4. Every `searched_none` has `on` and at least two `tried` entries, one of them the operator's or the land manager's own page.
5. Every trail with a distance or gain cites `official_info`, an operator, or a track plus a DEM. AllTrails appears only as a cross-check link in the markdown.
6. Every unit conversion has a note. Every weight says minimum or maximum.
7. At least 80% of records reach Usable on the F checks (spec section 4). The rest are listed with the operator contact to ask.
8. The final report gives the count by level and the list of operator questions.

Start from `<trip>/migrated.json`: do not re-type a migrated value without re-reading its source. A lane file supersedes the migrated record for the same ref: leave `migrated.json` alone (it is S0's file) and put the ref in your own file. A ref may appear in only one lane file; the adapter reads lane records first and falls back to the migrated record.

## Known issues

- **A conflict is not a value.** The migrated limits (Rockies activities, Dolomites Funbob and rafting) are conflicts with basis `our_inference`: the old data had no operator or official basis for them. They show as `gap` until a lane reads the operator page. That is why the flat `min_age` columns here are empty.
- **`scope.json` is a snapshot.** It is dumped from the public adapter (`web/lib/public`), so a change to a trip's items needs a re-dump. S1 owns keeping it in step.
- **Rockies items outside the plan days** (28 adventures, 29 trails, 20 sights) are in `migrated-offplan.json`. They are not part of the 207 and `--coverage` ignores them.
- **`kind_default` terrain.** A zip line, a show cave or a cruise has a fixed terrain by spec 2.5 and 2.7 when nothing else is stored. `derive` marks it `kind_default`.
- **Case of grade systems.** The ids are lower case (`sac`, `cai`, `imba`), the timeline's interface capitalised some.
