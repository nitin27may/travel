# tools/gate: which tests a change must run

The path-to-suite map of [TEST-STRATEGY](../../docs/v2/build/TEST-STRATEGY.md) (TS-1). Every small change runs only the
suites its paths select; the full chain runs at T2 (a stack), at T3 (release and nightly), or when a change touches a
shared contract. The gate that runs the selection is `tools/gate.sh` (TS-2); this folder holds the map, its check, the replay
and the gate's code.

| File | What it is |
|---|---|
| `map.json` | the map, as data: suites, rules, the `full` and `quiet` lists, quarantine, review paths |
| `gatemap.py` | loads the map, matches globs, parses check-all steps, and `select()`s suites for a change set (TS-2 imports it) |
| `check_map.py` | checks M1 to M6 (TEST-STRATEGY 4.3); a step of `tools/check-all.sh`; about one second |
| `gate.py` | the gate: plan, run, summary (`tools/gate.sh` is its wrapper) |
| `locks.py` | mkdir slots under the git common dir, so worktrees of one clone never run two builds or two Playwright runs at once |
| `extract.py` | failure excerpts (tsc, vitest, eslint, pytest, Playwright, check-style tools) |
| `replay.py` | applies the map to the last N merges into `main` (the TS-1 acceptance check) |

```bash
python3 tools/gate/check_map.py                          # one OK line, or at most 40 problem lines
python3 tools/gate/check_map.py --explain web/app/page.tsx   # what one path selects, and which rule chose each suite
python3 tools/gate/replay.py --merges 80                 # one row per merge, then the totals; exit 1 on a miss
python3 -m pytest tools/tests/test_gate_map.py tools/tests/test_gate.py -q
```

## Using the gate (`tools/gate.sh`)

```bash
tools/gate.sh --tier 0                      # edit loop: typecheck of changed packages, vitest related, eslint on changed files
tools/gate.sh --tier 1 --base main          # before hand-back: the map's selection for the branch plus the working tree
tools/gate.sh --tier 1 --dry-run            # what would run, and which rule chose each suite; runs nothing
tools/gate.sh --tier 1 --only web.types,links   # exactly these suites (and what they need; --reuse-build drops web.build)
tools/gate.sh --tier 2                      # every unit and data check, one build, budgets, fixtures, timing, mapped e2e + smoke
tools/gate.sh --tier 3 [--visual]           # check-all, full e2e on every browser project, db suites if Docker is up, visual hook
tools/gate.sh --tier 1 --changed docs/v2/PLAN.md  # use a path list instead of git (what the tests and the dry-run examples do)
```

Flags: `--json` (one JSON object), `--keep-going` / `--fail-fast` (T0 and T1 stop at the first failure, T2 and T3 do not),
`--full` (treat as a full run; the trailer `Gate: full` on HEAD does the same), `--allow-dirty`, `--reuse-build`.

- **Tiers.** T0: `web.types` / `core.types` for the changed packages (`tsc --incremental`, build info in the git dir), `vitest
  related` for changed code, eslint on changed files. T1: `gatemap.select()` on the change set, ordered cost class first and
  dependants after their dependency, one build with `SKIP_WEB_BUILD=1` for everything after it, mapped e2e on Chromium. A
  `related` suite (`web.unit`, `core.unit`) is narrowed to `vitest related` only when every path that selected it is a code
  module and no full fallback applies; `web.lint` is narrowed to the changed files the same way. T2: every suite with
  `always_at` at most 2, plus the mapped specs. T3: `bash tools/check-all.sh`, then `pnpm --dir web e2e` (all projects),
  `pnpm db:test` when Docker is up, and the visual hook when `GATE_VISUAL_CMD` is set (a command; without it `visual` is
  deferred).
- **Output.** At most 40 lines: a header (tier, base, head, changed count, the full-fallback reason), one row per suite
  (`PASS 4.1s web.types  rule-id`), a short excerpt for each failure, the totals line and the log path. The full log is
  `$(git rev-parse --git-dir)/gate-logs/<time>-tier<N>.log` (per worktree, untracked), `last.json` beside it. Read the summary;
  open the log only for a failure the excerpt does not explain.
- **Exit codes.** 0 pass; 1 a suite failed or was skipped because a failure stopped the run; 2 refused or any suite
  DEFERRED; 3 the gate broke. A deferred suite is never a pass: it moves to T2 (a T1 hand-back lists it).
- **Refused (exit 2, nothing runs).** T2 and T3 on a dirty tree (results must name a commit; `--allow-dirty` overrides, an
  explicit `--changed` list is exempt); T3 when the 1-minute load per core is above 1.5; a base that is not a commit; an
  unknown `--only` suite; `--reuse-build` with no build.
- **Deferred.** `web.timing` when load per core is above 1.5 (the load guard: no waiting yet, a loud row); a suite whose slot
  stayed busy past `GATE_LOCK_TIMEOUT` seconds (default 1200); `db.local` without Docker; `visual` without a hook.
- **Slots** (`locks.py`). `build` (web.build, web.fixture, check-all), `e2e` (every Playwright run) and `timing`, one holder
  each. A slot is `mkdir <git-common-dir>/gate-locks/<slot>` with an `owner` file (pid, label, start); a dead pid's lock is
  reclaimed, the holder releases on exit and on interrupt, a waiter says who holds it (in the log). Env: `GATE_LOCK_TIMEOUT`,
  `GATE_LOCK_POLL`. Not yet: the second `build` holder, the per-worktree `build-here` lock, the wait-and-recheck load guard
  (TS-4); caching by tree hash (TS-3); `--stack` (TS-7).
- **Where commands come from.** The map's `run` entries are parsed and executed as written; the prose ones (build with its
  `Error:` and ORS checks, the `next start` smoke, the MCP line, e2e, db, visual) are implemented in `gate.py`. A new suite
  whose `run` is not a plain command needs a branch in `actions_for`; until it has one the suite is DEFERRED with that reason.
- **Env.** `GATE_LOAD_PER_CORE` and `GATE_LOAD_LIMIT` (tests and tuning), `GATE_SUITE_TIMEOUT`, `GATE_VISUAL_CMD`,
  `GATE_TSBUILDINFO`. The wrapper pins `NEXT_PUBLIC_PLACE_MAP_FAMILY=maplibre` and empty map keys and puts `.venv/bin` first on
  `PATH` when it exists. Source the home point yourself (`set -a; source ~/.config/travel-secrets/home-point.env; set +a`): a
  unit run without it fails the privacy tests.

## The map

- **`suites`**: one entry per suite id of TEST-STRATEGY 4.1, plus `gate.map` (this check). Each has `run` (the commands as
  check-all runs them today; `vitest.project` names the project of `web/vitest.config.ts`, which reads the `tests` lists of the four web suites from this file), `cost` (`s`, `m`, `l`, `xl`), `always_at`
  (1: every change; 2: T2 and any full run; 3: T3 only), `inputs` (the cache key of TS-3; wide on purpose), `steps` (the
  check-all labels it replaces), `tests` (the test files it owns), `needs` (suites it depends on: `web.built` needs
  `web.build`), `slot` and `requires` (machine slot, venv or Docker, for TS-4), and `related` (T1 may narrow the suite to
  `vitest related` when every path that selected it is a code module; for data, docs or fixtures the whole suite runs).
- **`rules`**: `id`, `paths` (globs), `suites`, `e2e` (spec file names or globs in `web/tests/e2e/`; `@importers` means the
  specs that import the changed helper), `tests` (test files to run whatever the import graph says, for files read with
  `fs`), and `why`.
- **`full`**: shared contracts, configs, lockfiles, the vocabulary, budgets and their baselines, test infrastructure, the
  privacy switch in `legacy/MANIFEST.json`, the colour tokens and the gate itself. Any match: every suite with `always_at`
  at most 2.
- **`quiet`**: paths that may match no rule (docs, Markdown, research prose, `.claude/`). A quiet path that also matches a
  rule still selects that rule's suites: `research/runs/**` runs the data checks, because `validate` checks every
  `research_refs` path and `normalise` reads the prose links.
- **`release_only`**, **`quarantine`**, **`not_tests`**, **`allow_unmatched_globs`**: exceptions, each with a reason, each
  checked by M5 so it cannot outlive its cause.
- **`area_required`**: code that renders a page; every file there must match a rule that attaches e2e specs (M2).

Globs are anchored at the repository root: `*` and `?` stay in one segment, `**` crosses segments, `{a,b}` expands, and a
leading `!` in a list excludes. `*.md` is a root file; `**/*.md` is any depth.

## Selection, in order

1. `links` and `gate.map` always.
2. Every rule whose `paths` match a changed path adds its suites, tests and specs. Selection only adds.
3. A changed test file adds the suites that own it and itself; a changed spec adds itself.
4. A changed `tools/check-all.sh` adds the suites of the steps whose block changed (a lane appending a step runs that step).
5. Full fallback: a `full` path, a path no rule or quiet glob matches, or more than 60 changed files outside `quiet`. The
   trailer `Gate: full`, `--full` and a hand-resolved rebase are the gate's (TS-2).
6. `needs` pull in their dependencies.

## The checks (M1 to M6)

| Check | Fails when |
|---|---|
| M1 | a test file is owned by no suite; a web unit test is in the wrong project (imports `helpers/built` but not in `web.built` or `web.fixture`; reads `.fixture-out` or `.fixture-beacon` but not in `web.fixture`; asserts on a `performance.now()` time but not in `web.timing`; or sits in one of those without the trait) |
| M2 | a file matches no rule, no `full` and no `quiet` glob; a page file has no rule with e2e |
| M3 | a check-all `step` label belongs to no suite, or a suite names a step that is gone |
| M4 | an e2e spec is attached to no rule and is not `release_only` |
| M5 | an unknown suite; a glob (each brace alternative) that matches no file; an expired, over-14-day or unbacked quarantine; a dead exception |
| M6 | a web unit test file is owned by zero or two of `web.unit`, `web.built`, `web.fixture`, `web.timing`; or the files `vitest list --project <name>` resolves to differ from the map's list for that suite (`--no-vitest` skips the listing) |

## Changing the map

- A new folder, test file, spec or check-all step fails M1 to M4 until it is mapped: add it to the nearest rule, or a new
  rule with a `why`.
- `tools/gate/**` is a `full` and a `review` path: the hand-back needs an Opus reviewer's line that no rule got narrower,
  or the evidence for the narrowing (TEST-STRATEGY 10.1).
- An escape found by T3 or the escape audit widens the map the same day.

## Gotchas

- The four web vitest projects (TS-2a) take their file lists from the `tests` of `web.unit`, `web.built`, `web.fixture` and
  `web.timing` in this file; `pnpm --dir web test:unit|built|fixture|timing` run one. Only `unit` has no global setup;
  `timing` runs one file at a time, after the others in a full `pnpm --dir web test`, and has the TS-4 load guard hook.
- The `web.fixture` tests read the real build as well as the two fixture builds, so the project needs both.
- `web/scripts/legs/dump.test.ts` and `web/scripts/embed-spike/metrics.test.mjs` look like tests but are not (`not_tests`).
- The replay reads `git log` of `main`; in a shallow clone the pytest replay case skips.
