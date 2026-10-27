# Review STACK-REVIEW-1: the contract stack after EG-C

Task STACK-REVIEW-1, Opus reviewer, 27 Oct 2026 (R4, one review per feature stack). Read-only for code. Subject: what merged on
`main` after the EG-C review ([review-eg-c-2026-10-27.md](review-eg-c-2026-10-27.md), `606d2065`), up to `3daf05aa`:

| Task | Commit (merge) | What |
|---|---|---|
| EG-FX | `5427b773` (`3ded7540`) | synthetic graph fixtures |
| EG-I | `8c89e7b7` (`cd80d03e`) | graph index, `graph.ts build --check`, `requirementsOf`, inheritance modes |
| PA-C | `a520b58b` (`190b2a34`) | parks capture contract and the EG-R0 fixes |
| PA-FX | `79b4ad3a` (`c47caa59`) | synthetic protected-area fixtures, seed counts from data |
| PM-C | `a3908cae` (`76849fef`) | privacy class and per-surface exposure in the registry, `exposure.ts` |
| PM-G | `74086876` (`695a070e`) | property matrix generator, K1 to K12, allow list |
| PA-X | `95502a0e` (`c2d7153d`) | rule and row kinds, `parkVisits`, `tripParks`, export model v2, `legacyUrl` removed |
| (fix) | `3daf05aa` | exposure rows follow PA-X (K8) |
| EG-I2 | `f9999cac` (`143471b9`) | `requirementsOf` unwraps the entry Val (seen, not reviewed: its own task) |

Compared against [protected-area-entry](../features/protected-area-entry.md), [entity-graph](../features/entity-graph.md) and
[property-display-matrix](../features/property-display-matrix.md).

## Verdict

| Task | Verdict |
|---|---|
| PA-C | **go**. EG-R0 M1, S1, S2, S4, S5, S6, S7 and S10 are fixed and tested. S3, S8 and S9 are still open (below) |
| PM-C | **go** |
| PM-G | **go after fixes**: M1 (the allow list can be swapped) |
| PA-X | **go**. It merged red (S1) and `3daf05aa` repaired it. M2 is a privacy ruling this task's own reasoning brings up |
| EG-I | **go**. The `requires.ts` unwrap bug is fixed by EG-I2. S8 and S9 of EG-R0 still apply (S5, S6 below) |
| EG-FX, PA-FX | **go** |

Nothing needs a revert. The two must-fixes are small. Neither blocks PA-W or PA-D. M2 blocks API-P and PA-Q: they publish
more refs.

## Evidence (at `3daf05aa`)

| Check | Result |
|---|---|
| `node core/bin/validate.ts --all` | OK, 105 files, 0 errors. New on real data: 2 `W_PARK_AREA` (beauvais-lake-pp, elk-lakes-park: both are among the 8 pinned `E_CAP_REF_TOP` records). `E_CAP_REL_TARGET` 10 (all `known`), `E_CAP_REF_TOP` 8 (unchanged) |
| `capture.ts build --check` | OK at `3daf05aa`. **At `c2d7153d` (the PA-X merge) it failed**: K8 `tripDetail.legacyUrl` and `tripDetail.parks` |
| `capture.ts gaps --budget --check` | OK, no count rose; `known` 10 entries, all live (S2 check), `strict` empty |
| `graph.ts build --check` | OK, 12 files, 504 records |
| `openapi.ts --check` | OK (`ExportModel` component, `version`, `tripDetail.parks`) |
| vitest (registry-exposure, matrix, export, parks, graph, entry-*, relations-eg-r0, graph-fixtures, catalogue) | green at `3daf05aa`; **5 failures at `c2d7153d`** (matrix x4, registry-exposure x1) |
| Probe: allow-list swap (scratch script, real `judge`) | removing one fixed entry and adding a planted K8 entry for a new key: 41 entries, 0 fresh, 0 stale. Passes both `judge` and the ceiling test (M1) |
| Probe: built pages (`web/out`, built 21 Oct; the code path is unchanged) | 68 place pages carry `legacy/canadian-rockies-sept-2029/...` in element ids and RSC keys (M2). The trip pages and `web/redirects.json` carry none |

## EG-R0 follow-up

| Item | State |
|---|---|
| M1 two parks over one area | fixed (`containersOf` returns `[]` for a `covers_areas` record), and EG-I's `capture/graph.ts` rule 4 matches. Tested; fixture `eg-r0/two-parks-one-area.json` |
| S1 severity by `known` only | fixed (`levelOfLink`); spec 5.2 amended. Tested |
| S2 stale `known` entries | fixed (`staleKnown` in `checkBudget`); the shipped-budget test checks every entry is live |
| S3 the 8 `E_CAP_REF_TOP` | **open, no owner** in any plan or backlog row. The 2 new `W_PARK_AREA` sit on two of the same records |
| S4 merge loop | fixed (in-degree check). Tested |
| S5 self-link via alias | fixed. Tested |
| S6 `variants` | fixed: home `derived`; no checklist asks for it |
| S7 value types | fixed: `variant_of` is `ref`, `covers_areas` is `area_list` (and `api: none`) |
| S8 variant chain in the spec | **open**: see S5 below |
| S9 one containment function | **open**: `core/src/capture/graph.ts` exists, but the validator keeps its own copy and the two differ (S6 below) |
| S10 repeated targets | fixed (`W_CAP_REL_DUP`, no count toward cardinality). Tested |
| Test gaps | `E_CAP_REL_DERIVED` end to end still covers 8 of 14 names (missing `members_all`, `passed_by`, `starts_here`, `ends_here`, `operator_of`; `offers_on` only once). Still missing: a cross-file case, and a test that a target with no capture record is skipped |

## Cross-task consistency

- **Field names and units agree.** PA-C's `windowSpec` (`rule`, `days_before`, `opens_from`/`opens_to`, `month_lead_days`,
  `closes_*`, `share_pct`, one `then`) maps one-to-one onto PA-X's `BookRulePhase` (`bookRuleFromWindow`).
  `BOOK_RULE_KINDS` equals `WINDOW_RULE` and `tripPark.modes` equals `VISIT_MODE` (pinned in `bookings-kinds.test.ts`). The
  saving line compares only `price.per` `family` or `vehicle`, with no residency, on one-day fees (`entry.valid`), which is QP5.
  `parkVisits` never emits `through`, and the API enum allows it. That is consistent with QP4 (drive-through is not a visit
  until P3).
- **Registry exposure of `entry` and booking data is right.** Every booking fact is public research: `entry`, `window`,
  `price`, `covered_by`, `access_cost` are `public` and go to `book`/`sum`. `covers_areas` and `near_town_km` are off the API.
  No household-derived value is in a read model: `envelopeProblems` refuses one, and the MCP-public body passes
  `privacyHits`. `ExportBooking.park` is a name, and `requirementRows` takes an opaque key, never a capture ref.
- **P8 and P9 hold.** `PLACE_ROW_KEYS` and `tripRow` are unchanged. `tripDetail.parks` is optional and detail-only.
  `parkVisits` and `tripParks` run server side over the graph index.
- **Removing `legacyUrl` is safe for redirects.** `web/redirects.json` does not read it. `PublicTrip.legacyUrl` stays on the
  page model for `summary.ts` `folderOf` (server only). `tripDetailOf` deletes it, and two tests pin it absent.

## Must-fix

- **M1 (PM-G). The allow list can be swapped, and K8 is allowable.** `judge` (`core/src/capture/matrix.ts`) matches entries
  only by id. The only limit is `ALLOW_CEILING = 41` in `core/test/capture/matrix.test.ts:17`, a count. One change can fix one
  property, drop its entry and allow a new break: the probe passes. `ALLOWABLE` (`matrix.ts:28`) includes K8, the
  read-model privacy-row rule, though the list has no K8 entry. Fix: take K8 out of `ALLOWABLE`. Then pin
  the allowed ids as a frozen set in the test (`entries` must be a subset of the set shipped by PM-G), and lower the set in
  the change that removes entries. A count is not a ratchet.
- **M2 (planner ruling, before API-P and PA-Q). Dated folder names: one rule, not two.** PA-X removed `tripDetail.legacyUrl`
  because "old folder names encode real travel months", and `core/src/parks/line.ts:8` says "no record ref (legacy refs name
  dated trip folders)". The same names are public elsewhere:
  - `apiPlaceRef` (`core/src/schema/api/common.ts:28`, owner Q74) is the capture ref verbatim, so `placeRow.ref` and
    `placeDetail.ref` of every migrated record read `legacy/canadian-rockies-sept-2029/...`;
  - `refSlugs` keys are refs (`exposure.ts:51`, MCP public);
  - `web/components/places/sections/Sections.tsx:150` builds row ids from `o.ref`, so 68 built place pages carry the name in
    the HTML.
  Either the names are public (then `legacyUrl` did not need to go, and line.ts's comment is wrong), or they are private (then
  refs need a public alias before API-P, PA-Q and MCP publish them). The planner records the ruling. Under "private", add the
  pattern `-(jan|...|dec)(-[a-z]+)?-20\d\d` to the privacy detector and to the `web/out` audit grep (R1 audit line 87 already
  greps `patagonia-feb-mar`).

## Should-fix

- **S1 (process). PA-X was merged onto a main that already had PM-C and PM-G, without running their checks on the result.**
  `c2d7153d` failed `capture.ts build --check` and 5 tests until `3daf05aa`. The merge step must run `capture.ts build --check`
  and the vitest of every task in the stack on the merged tree. The branch alone is not enough.
- **S2 (PM-C, matrix).** `EXPORT_FORMATS` (`properties.ts:76`) has no `json`, but the `format=json` export model is a public
  surface. `book_url` has `export: []`, yet PA-X puts it in every export row as `ExportBooking.link`. Add `json` to the formats
  and give `book_url` (and `entry`, `covered_by` for `park`) their real export surfaces.
- **S3 (EG-R0 S3, still open).** Give the 8 `E_CAP_REF_TOP` records and the 2 `W_PARK_AREA` an owner: EG-D, or PA-R-CA for the
  six Canadian ones. Retype lake-magog, kananaskis-lakes-day-use and the Blue Lagoon lava fields rather than create places.
- **S4 (PM-C, exposure).** The relation properties `part_of`, `covered_by`, `variant_of`, `run_by`, `at`, `on`, `starts_at`
  are `api: detail`, `mcp: public`, and they hold capture refs. Whatever M2 decides, the facts model must project a relation
  as `{ slug, name }`, never as a raw ref. Write that in property-display-matrix 8.1 as a rule (E1 already says a derived
  relation is a read model; say it for stored ones too).
- **S5 (EG-R0 S8, spec).** `core/src/graph/build.ts:80-84` does what 4.5 says: a variant's own `reaches`/`starts_at`/`ends_at`
  win, and the primary's are used only when it has none. Entity-graph 6.2 still says "then for a variant the primary's chain".
  When a variant states any one of the three, the code drops the `variant_of` step whole, so it also loses the primary's
  containers if it has no `part_of` or `area_id` of its own. Amend 6.2 to the code's rule. Then either keep the primary's
  `part_of` in that case or require the variant's own placement (`W_` code).
- **S6 (EG-R0 S9).** The validator's `containersOf` (`core/src/validate/capture.ts:336`) still makes an **offer** with an
  `area_id` an area member, and `capture/graph.ts` does not ("offers are never area members"). So `W_CAP_INHERITED_COPY` and
  the cycle walk on offers disagree with the graph index. Have the validator call `buildContainment`, which closes the TODO.
- **S7 (PA-X).** `core/src/parks/line.ts:102`: the comment "the graph's own mode filter reads a bare entry" is stale after
  EG-I2. The local `needed_for` check is still right, because a visit spans several modes. Fix the comment, or call
  `requirementsOf` once per mode.

## What the next tasks must know

- **PA-W**: nothing reads `bookingCounts` yet. `BookingsPanel.tsx:14`, `summary/text.ts:49`, `lib/export/client.ts:47` and
  `TripPrintView.tsx:57` still count `bookings.length`, so they count checks and passes as "to book". Switch them to
  `bookingCounts().toBook`. Fill `tripDetail.parks` inside `tripDetailOf`, which already strips `legacyUrl`. `tripParks`'s
  default `slugOf` takes `place/<slug>` as the public slug, so pass the page index's slug map instead. `CategoryItem.bookKind`
  is optional, and a row without it reads as before.
- **PA-D**: `parkVisits` (`core/src/parks/visits.ts`) and `requirementRows` (one row per ridden day, check rows never
  counted) already exist from PA-X. PA-D adds only `entryNeeds` and `entryFor`, and must not rebuild them. Shrink its brief
  and acceptance to match.
- **EG-M**: `covers_areas` still has no storage (EG-R0). Records can repeat targets (`W_CAP_REL_DUP` is a warning). The
  loader must load through `uniqueTargets`, or link-table primary keys collide.
- **EG-D**: the S2 check now fails a `known` entry left behind after its fix. Remove each entry with its fix, then add
  `E_CAP_REL_TARGET` to `strict`. Take on S3.
- **API-P**: settle M2 and S4 first. The facts model is the first surface that serves relation properties.
- **STY-P**: every new registry row gets `privacy` and its exposure from `exposeOf` defaults, and changes
  `registry-exposure.snap.json` (245 rows today). Give units and a freshness class up front: a new K4/K6 break fails
  `build --check`, and after M1 the allow list cannot absorb it.
- **Readers of `Incoming`** (EG-R0): never spread, clone or serialise it. That still holds.
