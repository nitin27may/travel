# Review EG-R0: the graph contract (EG-C)

Task EG-R0, Opus reviewer, 27 Oct 2026. Subject: merge `8ab1405d` (public/EG-C, commit `7a28f487`) on `main`. Read-only for code.
Compared against [entity-graph](../features/entity-graph.md) 4 to 7, 11.1 and 13 (QG1 to QG5 answered yes),
[protected-area-entry](../features/protected-area-entry.md) 5.1 (C4, C6, the relation half of C7, C8's leaves), and
MASTER-ORDER 4.3 row 3.

## Verdict

**Go after fixes.** The table matches spec 5.1 row for row and CHAIN_RULES matches 6.2. Inverse names are unique except for
`members` and `access_points`, which each gather two relations on purpose. The data shows no false positives except the one
in M1. The fixes are small. They belong to PA-C, the next author of `core/src/validate/capture.ts` under MASTER-ORDER 4.3, and
must land before PA-R-CA adds park records. EG-C stays merged; nothing here needs a revert.

## Evidence

| Check | Result |
|---|---|
| `node core/bin/validate.ts --all` | OK, 105 files, 0 errors |
| Graph findings on real data | 18 warnings: 10 `E_CAP_REL_TARGET` (exactly the 10 `known` entries: 7 `parks_for` to an offer in `ORPH7.json`, 2 `on` a river place, 1 Lagazuoi `starts_at` a lift line) and 8 `E_CAP_REF_TOP` (pinned migrated records: kananaskis-lakes-day-use, beauvais-lake-pp, castle-provincial-park, elk-lakes-park, lake-magog, top-of-the-world-pp, Blue Lagoon lava fields, Goblin Valley) |
| `capture.ts build --check` | OK |
| `vitest run test/capture` | 16 files, 262 tests pass (relations.test.ts: 25) |
| Migration ledger | no lane file under `data/capture/<trip>/` changed; only `gap-budget.json`. Safe |
| Probe (scratch script, real validator) | confirmed M1, S1, S4, S5 below |

## Spec conformance

| Item | Verdict |
|---|---|
| Per-relation source and target kinds (5.1) | exact, including `part_of` to a route only from a route, `parks_for`/`serves` only from `access.*`, `run_by` on `nature.protected`/`stay`/`access` places, `covered_by` to `park_pass`/`vehicle_permit`/lodging, `includes` from experience/ticket/lodging |
| Cardinality | `part_of` 0..2 warns, a route's `starts_at` 0..1 warns, `ends_at` 0..1 errors, `run_by`/`variant_of` 0..1 by shape. `reaches` 1..n and `at` 1..n are only informational (`min`); the placement checks own presence |
| Stored side, derived reverse | every inverse is refused (`E_CAP_REL_DERIVED`, 14 names = `DERIVED_NAMES`, a test pins it) |
| Chain follow (6.2) | CHAIN_RULES equals the table's `chain` flags; access row before place row. `covers_areas` has no step: the fallback is only in the note (EG-I must code it) |
| Validator: target kind | correct; skipped when the target has no capture record (a scope or legacy item): a known false-negative path |
| Cycles incl. `covers_areas` | correct for loops through explicit `part_of` and through area membership; **false positive in M1** |
| One-level variants | correct (layer, category, variant of a variant) |
| Symmetric stored once | correct, alias-aware; reported on both records (two errors per pair) |
| Stage order warning | correct for gaps, branches, missing ends, pure loops; **misses a merge loop** (S4) |
| `W_CAP_INHERITED_COPY` | containment ancestors only (not the full 6.2 chain), requirement twins only through `at`. Enough until EG-I |
| loadWorld `Incoming` | built from RELATION_RULES; `at`, `on` and `children` share their arrays with `offers_at`, `offers_on` and `members`; `parks_for`/`serves` kept as halves of `access_points`. Every current reader still works (`capture/engine.ts` 76, 82, 127; `capture/bands.ts` 78; `web/lib/public/relevance.ts` 291 to 295). A spread or `structuredClone` of an Incoming breaks the sharing, and JSON output repeats the arrays |
| types.json leaves (G7) | the four leaves are added; build is green. The tree note still says "324 type ids" (there are 402 nodes): stale before EG-C too |

## The `known` list

The mechanism is sound for the 10 faults. Each entry is one exact link (`code|ref|rel|target`), a fault on a different
target from the same record still errors (tested), `strict` turns it into an error (tested), and `writeBudget` keeps it. Two
gaps:
- **Pinned records skip it (S1).** `levelOfLink` falls back to `levelOf`, so any of the about 380 pinned records can gain a
  *new* wrong-target link and only warn. The probe confirmed this. Spec 5.2 says "pinned records warn", so the code follows
  the spec, but `known` already covers all 10 real faults and makes the pinned path pointless.
- **Nothing finds stale entries (S2).** The shipped-budget test checks only "at most 10, unique". A link EG-D fixes without
  removing its entry stays allowed.
- **The 8 protected-area refs are not in `known`.** They warn because their records are pinned (`emit` goes through
  `levelOf`). That is acceptable, but `E_CAP_REF_TOP` and `E_CAP_REL_TARGET` are not in `BUDGET_CODES`, so
  `gaps --budget --check` never counts them.

## Must-fix (PA-C, before PA-R-CA data)

- **M1. Two protected areas covering one area make a false `E_CAP_REL_CYCLE` error.** In
  `core/src/validate/capture.ts`, `containersOf` (the `coverIdx` branch) makes each park an area member of the other. The
  probe: `place/waterton` and `place/peace-park`, both with `covers_areas: ["CA/AB/waterton"]` and `area_id` in it, give two
  cycle errors. These are errors outside the gap budget, so nothing can carry them. Real cases: an international peace park
  over a national park, or Kananaskis Country over a provincial park in the same area bucket. Fix: a record that has
  `covers_areas` is never an area member, and only its explicit `part_of` places it:
  `if (x.covers_areas?.length) return [];` after the explicit `part_of` branch. Add a test for it and an EG-FX fixture.
  EG-I's chain must apply the same rule.

## Should-fix

- **S1** (`gapBudget.ts` `levelOfLink`). For `E_CAP_REL_TARGET`, decide by `known` only: a known link warns, any other link in
  the store errors. Amend spec 5.2's severity line to say so. Otherwise EG-D's `strict` step is the only thing that closes the
  hole.
- **S2.** `gaps --budget --check` (or the shipped-budget test) fails when a `known` entry matches no live finding.
- **S3.** The 8 `E_CAP_REF_TOP` warnings have no owner task. Add them to EG-D, or to PA-R-CA for the Canadian ones. At least
  three look mistyped rather than misplaced (lake-magog, kananaskis-lakes-day-use, the Blue Lagoon lava fields): retype them
  instead of creating a locations-store place for each.
- **S4** (`stageChainProblem`). Stages A to B, B to C and C back to B return `null`: B has two predecessors. Add an in-degree
  check (two stages end where one starts).
- **S5.** `part_of: [<own alias>]` is dropped without a finding: `containersOf` filters it and the self-link check compares
  `tg === r.ref`. Compare `primaryOf(tg) === r.ref`.
- **S6** (properties.ts, for PM-C). The registry still has a `variants` property (`object_list`, home `none`, mark A on offer
  checklists in `research/types/*.md`). `variants` is now a derived name that `E_CAP_REL_DERIVED` refuses, and spec 4.5
  retires the embedded array. Make it a derived display property (as `access_points` is) or remove it, so the checklists stop
  asking researchers for a field the validator refuses.
- **S7.** `variant_of` has `value: "relation_list"` but the schema shape is a single ref: use `"ref"`, as `run_by` does.
  `covers_areas` has `value: "relation_list"` but holds area ids, not refs. Today `display: []` keeps it off pages (the
  renderer's `RELATION_ROW` treats every relation_list as refs). Give it its own value type before any reader walks
  relation_lists.
- **S8. Spec inconsistency for EG-I and the planner.** The 6.2 route row follows `variant_of` recursively, so a variant takes
  the primary's `reaches` and `ends_at` chains. Section 4.5 says the variant states its own payoff and end: the meadows variant
  would inherit Sentinel Pass's requirements. Fix the spec before EG-I: follow only the primary's `part_of` and `starts_at`.
- **S9.** The validator's `containersOf`, `ancestorsOf` and `cycleOf` are a second copy of the 6.1 containment that EG-I
  builds. EG-I should export one containment function, and the validator should call it.
- **S10.** Duplicate targets count toward cardinality (`part_of: [x, x, x]` warns as three parents) and are never reported
  as duplicates.

## Builder deviations

The builder's own list of 8 deviations was not in this brief. These are the 8 deviations from the spec found by comparing
the code with it:

| # | Deviation | Ruling |
|---|---|---|
| D1 | new `E_CAP_REF_TOP` (4.4 rule 4 enforced; not in the 5.2 table) | accept; owner per S3 |
| D2 | `E_CAP_REL_CARD` error (`ends_at`) and `W_CAP_REL_CARD` (route `starts_at`) | accept |
| D3 | the gap budget's `known` list (spec 5.2 only says pinned) | accept, with S1 and S2 |
| D4 | `covers_areas` is a rule key but not a `CAP_RELATION` kind; it shares `members` with `part_of` | accept (matches 5.1 and keeps EG-M's CHECK clean) |
| D5 | `CAP_RELATION_DERIVED` adds `operator_of` and `members_all` beyond the 5.2 list | accept (both are 5.1 inverses) |
| D6 | a cross-layer `alternative_to` is reported as `E_CAP_REL_TARGET` (budgeted), not as its own code | accept |
| D7 | `W_CAP_INHERITED_COPY` reads containment ancestors only | accept until EG-I; widen to chain(x) then |
| D8 | `Incoming` keeps the `parks_for`/`serves` halves and gives symmetric reverses their own names | accept |

## Test gaps

- `E_CAP_REL_DERIVED` covers 8 of the 14 names. Missing: `members_all`, `passed_by`, `starts_here`, `ends_here`, `offers_on`,
  `operator_of`.
- No cross-file case: a symmetric pair, a cycle or a wrong target split across two lane files, which are read through the
  world.
- No alias case: a symmetric link through an alias, a cycle through an alias, the S5 self-link.
- `E_CAP_REL_KIND` is untested for `part_of` on an offer, `alternative_to` on an event, and `covers_areas` on a place that is
  not a protected area.
- No test for M1 or S4. No test that a target with no capture record is skipped (document it as intended).
- No test that each shipped `known` entry matches a live finding (S2).

## What the next tasks must know

- **PA-C**: M1 and S5 in `validate/capture.ts`. `E_PARK_ZONE` overlaps the zone branch of `E_CAP_REF_TOP`: do not report a
  zone twice. `E_PARK_AREA` must validate `covers_areas` against the store, which the validator skips today (`shape: "areas"`).
  The marks `covers_areas: A` and `run_by: R` are registry keys now. `W_ENTRY_OVERRIDE` is still to add. The
  `E_PLACE_ORPHAN` exemption can read `incoming.covers`.
- **EG-FX** (merged after EG-C as `3ded7540`): add fixtures for two parks over one area, the alias cases and a merge loop.
- **EG-I**: code the `covers_areas` fallback, which CHAIN_RULES has no step for, with the M1 rule. Use a visited set. Settle S8
  first. An access place that serves several places spreads its targets' requirements to everything that starts there (QG3
  accepts this, but expect long lists at park-and-ride hubs).
- **EG-M**: `CAP_RELATION` now has 15 kinds (14 without `run_by`). Spec 11.3 gives `covers_areas` no storage: it needs an
  entity column or a table, or the database cannot compute members by area.
- **EG-D**: remove each `known` entry as its link is fixed, then add `E_CAP_REL_TARGET` to `strict`. Take on S3.
- **PM-C**: S6 and S7. Matrix rows are needed for `covered_by`, `includes` and `covers_areas`.
- **Readers of `Incoming`**: never spread or clone it, and never serialise it.
