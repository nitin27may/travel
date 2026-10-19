# data/capture

The capture contract's data (docs/v2/research/capture-contract.md, backlog 3a.12). The one authored file of the contract is
`data/vocab/types.json`; everything under `data/schema/capture/` and `docs/v2/research/capture/` is generated from it
(`node core/bin/capture.ts build`, checked by `build --check` in `tools/check-all.sh`).

| Path | What | Edited by |
|---|---|---|
| `<trip>/<lane>.json` | `capture/1` sidecars: per ref, its `type`, `layer` (place, route, offer, event), `name`, relations (`reaches`, `passes`, `part_of`, `starts_at`, `ends_at`, `on`, `at`, `run_by`, `parks_for`, `serves`, `combo_with`, `alternative_to`, `variant_of`) and, as research fills them in, hours, season, price, window, links and photos, each with its provenance. `reached_by` is derived and is never stored. `migrated.json` is what the step 4 migration wrote. | a lane or the migration |
| `operators.json` | one record per operator (name, URL, terms and waiver URLs). `run_by` points here. The 9 from the migration were taken from the publisher of an operator's own page behind an offer's operator-stated values, and keep where (`derived_from`). | research |
| `type-map.json` | the reviewed type for every record that does not take the type its kind and subkind give it (the legacy pairs in types.json) | review |
| `splits/<trip>.json` | the reviewed splits of the 61 records that mixed layers (SP1 to SP3) and the seven relevance judgements the splits displaced, verbatim | review |
| `migration-ledger.json` | the multiset of every value leaf of the suitability and relevance lane files before the migration, and the points; a test pins that every ledger leaf still exists with the same value (new records and leaves are allowed) | the migration, once |
| `runs/<run>.json` | one `capture-run/1` record per crawl or API run (`capture.ts run --check`) | a crawler |

A record's `type` must exist in types.json, its `layer` must be one the type allows, and the suitability profile of its type must
equal the profile its suitability record has through kind and subkind (E_CAP_TYPE). New types are one entry in types.json
(section 8 of the spec); new properties are a registry change in `core/src/schema/capture/properties.ts`.

Commands: `capture.ts fields --type <id>` (the checklist a crawler follows), `fields --ref <ref>` (and what that record still
lacks), `explain <type>`, `gaps --trip <trip>`, `types --tree`, `run --check <file>`.
