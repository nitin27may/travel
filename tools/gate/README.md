# tools/gate: which tests a change must run

The path-to-suite map of [TEST-STRATEGY](../../docs/v2/build/TEST-STRATEGY.md) (TS-1). Every small change runs only the
suites its paths select; the full chain runs at T2 (a stack), at T3 (release and nightly), or when a change touches a
shared contract. The gate that runs the selection is TS-2; this folder holds the map, its check and the replay.

| File | What it is |
|---|---|
| `map.json` | the map, as data: suites, rules, the `full` and `quiet` lists, quarantine, review paths |
| `gatemap.py` | loads the map, matches globs, parses check-all steps, and `select()`s suites for a change set (TS-2 imports it) |
| `check_map.py` | checks M1 to M6 (TEST-STRATEGY 4.3); a step of `tools/check-all.sh`; about one second |
| `replay.py` | applies the map to the last N merges into `main` (the TS-1 acceptance check) |

```bash
python3 tools/gate/check_map.py                          # one OK line, or at most 40 problem lines
python3 tools/gate/check_map.py --explain web/app/page.tsx   # what one path selects, and which rule chose each suite
python3 tools/gate/replay.py --merges 80                 # one row per merge, then the totals; exit 1 on a miss
python3 -m pytest tools/tests/test_gate_map.py -q
```

## The map

- **`suites`**: one entry per suite id of TEST-STRATEGY 4.1, plus `gate.map` (this check). Each has `run` (the commands as
  check-all runs them today; `vitest.project` names the project TS-2a creates), `cost` (`s`, `m`, `l`, `xl`), `always_at`
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
| M6 | a web unit test file is owned by zero or two of `web.unit`, `web.built`, `web.fixture`, `web.timing`; once `web/vitest.config.ts` declares projects (TS-2a), one of the four names is missing |

## Changing the map

- A new folder, test file, spec or check-all step fails M1 to M4 until it is mapped: add it to the nearest rule, or a new
  rule with a `why`.
- `tools/gate/**` is a `full` and a `review` path: the hand-back needs an Opus reviewer's line that no rule got narrower,
  or the evidence for the narrowing (TEST-STRATEGY 10.1).
- An escape found by T3 or the escape audit widens the map the same day.

## Gotchas

- `web.built`, `web.fixture` and `web.timing` run through the one web vitest config until TS-2a splits it into projects;
  the `tests` lists are the split TS-2a must reproduce (M6 then compares them with the config).
- The `web.fixture` tests read the real build as well as the two fixture builds, so the project needs both.
- `web/scripts/legs/dump.test.ts` and `web/scripts/embed-spike/metrics.test.mjs` look like tests but are not (`not_tests`).
- The replay reads `git log` of `main`; in a shallow clone the pytest replay case skips.
