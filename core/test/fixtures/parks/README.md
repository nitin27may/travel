# Park fixtures (PA-X)

`rockies-style.json` is a synthetic capture file shaped like the Canadian Rockies plan (protected-area-entry 6.3): four national
parks whose daily entry fees are `covered_by` one system pass on the operator, a zone (Lake Louise area) holding two lakes, a
two-phase shuttle (`fixed_date` then `rolling`), a monthly-release transit pass, a lottery bus on a gated zone (Lake O'Hara) with
seats left after the draw, a conservation-area vehicle permit sold until 23:59 on the day, and a parking lot paid on arrival.

Park and lake names are real so the park line reads like the spec; every area id is invented (`ZZ/..`), every URL is
`example.org`, and the prices and windows are illustrative shapes, not research claims. Nothing here ships: tests read this folder,
`data/` never does. Tests: `core/test/parks/*.test.ts`, `core/test/export/bookings-kinds.test.ts`.
