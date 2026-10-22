// The caps of the public API (EXECUTION-PLAN 4.2, principle P8: caps live inside the store methods and are tested there).
//
// One object, so a cap is written once: the store implementations (StubStore now, JsonStore in API-1b, SupabaseStore in SRV-0) and
// the contract kit read it from here. Two classes of cap (store.ts A1, review R-9):
//   - RESULT-SIZE caps (`pageSize`, `searchLimit`): the input schema carries shape only, and the store answers `too_large` (413) with
//     `details.max`. The near radius is the one clamp (`clamped: true`); `towns` and the nearby list cut and say so.
//   - REQUEST-SIZE caps (`query.*`, `reportText`): the input schema carries them as `.max()`, so they answer `invalid_input` (400) with
//     the failing path and `details`; a request this large is malformed, not a request for too many rows.
//
export const API_LIMITS = {
  /** Every paged method: rows per page. Above `max` the store answers `too_large`; absent means `default` (components 8.5: 48 cards). */
  pageSize: { default: 48, max: 100 },
  /** `search`: hits per group. Above `max` the store answers `too_large`. */
  searchLimit: { default: 8, max: 50 },
  /** `near`: radius in km. Above `max` it is clamped to `max` and the answer says `clamped: true` (nearby spec 5.3: no "everything near nothing"). */
  nearRadius: { default: 25, areaDefault: 50, max: 100, presets: [10, 25, 50, 100] },
  /** `towns`: rows in one answer. More matches are cut at `max` and the answer says `truncated: true`. */
  towns: { max: 200 },
  /** `nearbyForPlace`: the "Around here" list (nearby spec 5.2): places within `radius` km, at most `list` of them; day trips up to `dayTrips` km are a count. */
  nearby: { list: 8, radius: 25, dayTrips: 100 },
  /** `listPlaces`, `countPlaces`: values per facet key and the size of a free-text query, so one request cannot carry the catalogue. */
  query: { valuesPerKey: 50, textChars: 200, ids: 100, sortKeys: 4 },
  /** `report`: the free text a visitor may add. */
  reportText: { max: 2000 },
} as const;

export type ApiLimits = typeof API_LIMITS;
