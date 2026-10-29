# Trip builder golden fixtures (TB-G1)

Inputs for `core/src/plan/engine.ts` (`buildPlan`), pinned outputs, and the test that holds them. The engine is pure and
deterministic, so each output is compared byte for byte with `<name>.expected.json` (two-space JSON, final newline). A diff in
a pinned file is a behaviour change: read it, then regenerate on purpose.

| Fixture | File | What it shows |
|---|---|---|
| `quebec` | `quebec.ts` | Near mode from the Montreal hub, 2 nights, July, a party with a 7-year-old. One base (Levis, chosen on the drive from the start), a must placed, two age-limited picks as `TB_FIT` with the age |
| `algonquin` | `algonquin.ts` | Toronto hub, 2 nights, October (the trails' shoulder month: open). Four trails as stops; the park pick is the trip's area (TB-PIN R1): in `areas` with its 4 members, never on a day, never in Did not fit or the matrix. Oxtongue Lake (about 45 km from the park's point) is not a member |
| `daytrip` | `daytrip.ts` | Nights 0, one day, no base, drive out and back from the Toronto hub; one pick beyond the one-way limit is `TB_TOO_FAR`; the start is never keyed (a start cell in the routed map changes nothing) |
| `infeasible-time` | `infeasible.ts` | Nine must-sees in 2 days: `TB_TIME` with the smallest Add N days, `TB_TOO_FAR` with a town near it |
| `infeasible-closed` | `infeasible.ts` | January: three summer places are `TB_CLOSED` with Change month; the winter places are planned |

Every case also checks: each pick placed once, in Did not fit or pinned as an area (exactly one, none lost); day caps; reasons carry numbers and any
estimated drive figure carries "≈"; two builds are equal, also with towns and places reordered; the answer holds no home point,
start coordinate or coordinate-like number.

Coordinates are real towns and sights, rounded to about 1 km; they make a plausible plan, they are not catalogue data. Nothing
here reads a file, the clock or the environment. The drive model is `EMPTY_DRIVE` (every leg is `rough`, so every figure is
an estimate, "≈").

## Commands (from `core/`)

- `pnpm vitest run test/plan/golden.test.ts`: the default run (part of the unit suite).
- `pnpm golden:update`: regenerate the `*.expected.json` files (`GOLDEN_UPDATE=1`). Review the diff before committing.
- `pnpm golden:timing`: the 300 ms build budget (median of 9 builds after a warm-up) for each golden and the largest build
  (40 picks, 40 towns, 14 nights). Opt-in (`TB_TIMING=1`), because time depends on the machine; skipped in the default run.
