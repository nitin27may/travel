# data/reference

Public reference data the product reads: countries, licences, the towns layer, the drive model, globe data, weather links, and the
trip builder's hubs, airports and region groups. Nothing here is private; no file holds a household point.

| File | Schema | What it is | Source and licence | Validated by |
|---|---|---|---|---|
| `licences.json` | `licences/1` | the sources and their attribution lines, rendered on /about/data/ | ours | the About page |
| `countries.json` | none | ISO 3166-1 numeric to alpha-2, alpha-3 and name | see `tools/globe_data.py` | globe build |
| `towns/*.json` | `towns-part/1` | the towns layer (places of 1,000 people or more) | GeoNames, CC BY 4.0 | towns build |
| `drive/**` | drive data | terrain, crossings and segments of the drive model | see the files | `core/src/drive` |
| `weather-links.json` | `weather-links/1` | outbound weather links per public trip | publishers' pages (links only) | `core/src/validate/weatherLinks.ts` |
| `hubs.json` | `reference-hubs/1` | public start hubs for near mode and weekends (`hub:<id>`) | Wikidata P625, CC0 | `core/src/schema/reference.ts`, `core/src/validate/reference.ts` |
| `airports.json` | `reference-airports/1` | commercial airports a visitor flies into (`iata:<IATA>`) | OurAirports, public domain | same |
| `region-groups.json` | `region-groups/1` | the builder's region groups per country (`<cc>-<id>`) | our labels over the catalogue's regions | same |

## The trip builder's three files (TB-RG, 28 Oct 2026)

`web/lib/server/planService.ts` `fileReference()` reads them on the server; a missing file is an empty list. Each is one object with a
header (`schema`, `updated`, `run`, `note`, and `source` or `min_places`) and one list:

- `hubs.json` `hubs[]`: `id` (a slug, the `id` of a `{kind: "hub"}` origin), `ref` (`hub:<id>`), `name`, `kind` (`city` or `town`), `cc`,
  `iso_3166_2`, `lat`, `lon` (the city's Wikidata coordinate), `wikidata`, `town` (the towns-layer row within 10 km, or null), `source`,
  `licence`, `read`.
- `airports.json` `airports[]`: `id` (OurAirports `ident`), `iata`, `ref` (`iata:<IATA>`), `name`, `city`, `cc`, `iso_3166_2`, `size`
  (`large` or `medium`), `lat`, `lon`, `source`, `source_key` (OurAirports row id), `licence`, `read`. Selection rule in the file's `note`.
- `region-groups.json` `groups[]`: `id` (`<cc>-<id>`, its first two letters are the country), `cc`, `name` (our label, QB7), `basis`
  (`nuts-1`, `census-division` or `traveller`), `basis_code`, `regions` (the catalogue's region facet slugs; PlanService reads them as
  `<CC>/<slug>`), `locations_regions` (the matching `data/locations` region ids), `places` and `offered` (a snapshot on `updated`;
  PlanService counts live and offers a group at `PLAN_GROUP_MIN_PLACES` = 5).

Rules: every point comes from Wikidata or OurAirports, never Google; ids and IATA codes are unique; a region sits in one group of its
country; every catalogue region of a grouped country has a group (`web/tests/data/plan-reference.test.ts`). Adding a hub, an airport or a
group is a data change in the file; DC-5 extends `region-groups.json` for wave 1 countries. Tests: `core/test/reference/plan-reference.test.ts`
and `web/tests/data/plan-reference.test.ts`.

To refresh: download OurAirports `airports.csv` once (public domain) and run one Wikidata SPARQL query for the hub items, one request at
a time with the `travel-capture/1.0` user agent; then re-apply the rule in the file's `note` and update `read` and `updated`.
