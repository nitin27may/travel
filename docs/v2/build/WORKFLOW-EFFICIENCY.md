# Workflow efficiency: verification in GitHub Actions, and planning by feature to cut tokens

**Status:** planned (docs and measurements only; no workflow file, script or agent definition is changed by this page).
**Owner request, 26 Oct 2026:** "Can we use GitHub Actions for verification and end-to-end testing to save tokens? Releases
spend a lot of time and tokens on verification. Check our whole workflow, how we develop, and see where to optimise: what to
combine, how to plan work by feature so we do not waste tokens."
**Plan rows:** TODO (26 Oct 2026, this request), BACKLOG 15.333. Tasks WF-0 to WF-11 (section 7), proposed for
[MASTER-ORDER.md](MASTER-ORDER.md) lane P; the edits other pages need are listed in section 8 and are not applied here.
**Supersedes, once the owner answers section 10 and the tasks land** (each superseded page gets its own line when its edit is
applied; until then those pages stand):

| Today | Becomes | Where it is written today |
|---|---|---|
| Two workflows, `check.yml` and a one-worker Chromium-only nightly `e2e.yml` (LOCAL-4, E2E-YML) | four workflows: `check.yml`, a sharded `e2e.yml` (Chromium on Linux, WebKit on macOS), `visual.yml`, CodeQL default setup (section 4.3) | RELEASE-PLAN 7.1, 7.2; MASTER-ORDER 3.3 |
| CI is advisory; "no required pull request or status check" on `main` | one required aggregate check on `main`, satisfied by pushing the tested stack tip (Q-W2) | RELEASE-PLAN 7.4 |
| The verifier re-runs suites itself, `--no-cache` | the verifier reads the CI summary for the commit, judges visuals from CI contact sheets, and runs only the Mac-only list (section 4.2) | TEST-STRATEGY 8.3; `.claude/agents/travel-verifier.md` |
| Every UI round ends with design review, then verifier | risk tiers R0 to R4 decide (section 5.2; Q-W3) | CLAUDE.md "Agents and models"; TEST-STRATEGY 8.3 |
| Nightly T3 by launchd runs everything on the Mac (TS-6) | GitHub runs the nightly; the Mac nightly keeps only the Mac-only list | TEST-STRATEGY 10.3, 12 (TS-6) |

## 1. Decision in one paragraph

**Move every check that needs no secret, no real home point, no GPU and no public-service call off the Mac and into GitHub
Actions, and make agents read one short CI summary instead of running and watching suites; then cut the larger cost, which
is not test runs but context: long agents, orientation reads of 100 to 200 KB plan files, and per-task review rounds.** The
repository is public, so standard GitHub-hosted runners cost nothing, including macOS. Measured over 5.4 days (21 to 26 Oct
2026) the work used 3.35 billion tokens, about **USD 1,930 at API list prices**; 28% of that went to turns spent on
verification (running, waiting for, and reading tests, builds and screenshots), 42% to exploration (grep and reading specs),
and 53% of all subagent spend was in the 44 agents that ran past 100 turns. CI alone saves about 10% of tokens and about 38
hours of Mac machine time a week; with the planning changes of section 5 the total saving is about **35 to 45%**.
**Trade-off:** CI renders on Linux without a GPU and with a decoy home point, so a fixed Mac-only list (GPU specs, the real
home point audit, photo-cache budgets, real devices) stays local and the release still needs the owner's Mac; and fewer
review rounds on small changes means a design slip on an R2 change is caught at the stack review, a few hours later.

## 2. Measurements

### 2.1 Method and limits

| Item | How |
|---|---|
| Source | every transcript under `~/.claude/projects/-Users-nks-workspace-travel/`: the two coordinator sessions and 191 subagent transcripts with their `.meta.json` (agent type, description, model). Streamed with Python, one line at a time; no file was read whole. Scripts in the session scratchpad, not committed |
| Window | 2026-10-21 13:15 UTC to 2026-10-26 23:56 UTC (5.4 days). Older sessions are no longer on disk |
| Tokens | the `usage` block of each assistant message, deduplicated by message id (a streamed message is written once per content block): input, cache write, cache read, output |
| Cost weight | API list prices per million tokens: Opus 5 in, 25 out; Sonnet 3 in, 15 out; Haiku 1 in, 5 out; cache read 0.1x input, 5-minute cache write 1.25x input. The owner may be on a subscription: read the dollars as a relative weight that accounts for model and cache mix, not as a bill |
| Task kind | the agent type, else keywords in the agent's description (verify, review, research, plan, build); the two main sessions are "coordinator" (they include the owner conversation) |
| Activity | **turn-cost attribution:** each assistant message's own cost is split evenly over the tool calls it issued; a Bash call is classed by regex on its command (check-all, e2e, unit, typecheck, build, wait or poll, read a log, screenshots, git, search, read via bash). This charges an activity for the turns spent on it at the context size of the moment, which is what a turn costs |
| Carry | separately, each tool result's size times the turns left in that agent, as an estimate of the cache reads it caused; screenshots counted at 1,600 tokens each |
| Machine time | check-all logs and e2e logs in the session scratchpads (35 logs with timings), TEST-STRATEGY 2 (stage-by-stage, 25 Oct), tool-call timestamps |
| Limits | regex classes misfile some compound commands (estimated under 5% of turns); background runs return at once, so tool wall times undercount them; one week is a small sample and the gate (TS-2, TS-3) landed on 26 Oct 14:37 UTC, so only 12 builders ran after it |

### 2.2 Where the tokens went, by role and model

| Role | Agents | Tokens (all kinds) | Share of tokens | Cost weight USD | Share of cost | Turns | Avg context per turn |
|---|---|---|---|---|---|---|---|
| Builders | 81 | 1,430 M | 42.7% | 839 | 43.5% | 7,401 | 186 k |
| Planners | 50 | 469 M | 14.0% | 353 | 18.3% | 2,752 | 165 k |
| Coordinator (2 sessions) | 2 | 742 M | 22.2% | 269 | 14.0% | 1,606 | 456 k |
| Researchers | 21 | 385 M | 11.5% | 250 | 12.9% | 2,191 | 171 k |
| Design reviewers and code auditors | 26 | 213 M | 6.4% | 154 | 8.0% | 1,505 | 137 k |
| Verifiers | 8 | 56 M | 1.7% | 30 | 1.6% | 560 | 94 k |
| Other (general-purpose) | 5 | 53 M | 1.6% | 34 | 1.8% | 332 | 156 k |
| **Total** | **193** | **3,348 M** | | **1,930** | | **16,347** | |

By model: Opus 48% of tokens and 62% of cost (102 agents), Sonnet 52% and 38% (87 agents, both coordinator sessions),
Haiku 0.4% (4 agents). **97% of all tokens are cache reads:** each turn re-reads the whole context, so cost grows with
context size times turns, not with what a command prints once.

### 2.3 Where the tokens went, by activity (turn-cost attribution)

| Activity | Cost weight USD | Share | Turns |
|---|---|---|---|
| Exploration: `grep`, `find`, `ls`, `wc` | 556 | 28.8% | 5,628 |
| Exploration: `cat`, `sed`, `head`, `tail` on files | 184 | 9.5% | 1,823 |
| Exploration: Read on specs (`.md`) and code | 66 | 3.4% | 632 |
| **Exploration total** | **805** | **41.7%** | |
| Verify: unit test runs (vitest, pytest) | 134 | 6.9% | 1,181 |
| Verify: waiting (`sleep`, `until` loops) | 111 | 5.7% | 779 |
| Verify: reading logs to see if a run finished | 62 | 3.2% | 394 |
| Verify: taking screenshots | 46 | 2.4% | 481 |
| Verify: reading screenshots | 43 | 2.2% | 411 |
| Verify: e2e runs | 43 | 2.2% | 368 |
| Verify: typecheck | 41 | 2.1% | 304 |
| Verify: check-all runs | 29 | 1.5% | 201 |
| Verify: builds | 22 | 1.2% | 214 |
| Verify: gate runs, browser | 9 | 0.4% | 82 |
| **Verification total** | **541** | **28.0%** | |
| git | 157 | 8.1% | 1,168 |
| Edits and writes | 142 | 7.4% | 650 |
| Answers with no tool call | 87 | 4.5% | 514 |
| Other bash, hand-backs, delegation, installs, web research | 198 | 10.3% | |

Verification share by role: builders 42%, verifiers 52%, reviewers 29%, coordinator 19%, researchers 20%, planners 7%.
Exploration share: planners 58%, researchers 52%, reviewers 45%, builders 38%.

Carry (cache reads caused by tool output staying in context): 1,137 M tokens in total; search output 29%, spec reads 22%,
`cat`/`sed` output 16%, code reads 7%, e2e output 5%, screenshots 5% (54 M), unit output 2%, check-all output 1%.

### 2.4 Context size and agent length

| Measure | Value |
|---|---|
| Context at an agent's first turn (system, CLAUDE.md, tools) | median 15.7 k tokens |
| Context at its tenth turn | median 63.5 k tokens: **about 48 k tokens of orientation reads** in the first ten turns |
| Peak context per agent | median 209 k, p90 364 k; 127 of 191 agents passed 150 k |
| Agents over 100 turns | 44 of 191, **USD 887 of the 1,660 subagent total (53%)** |
| Agents over 150 turns | 15, USD 513 (31%) |
| Cost per turn by agent length | under 50 turns 0.055; 50 to 150 turns 0.106; over 150 turns 0.154 |
| Most expensive single agent | "Build email Phase 1 backend (EML-M, EML-Q)", Opus, 317 turns, USD 117 |
| Coordinator | average context 456 k per turn, USD 0.168 per turn, the highest of any role |
| Brief size | median 3.8 k characters (about 950 tokens), p90 6.2 k: briefs are not the problem; what they make the agent read is |

Most re-read files (Read calls, all agents): `docs/v2/PLAN.md` 51 times (1.2 M characters in total), EXECUTION-PLAN 33,
TODO 33 (1.0 M characters), MASTER-ORDER 23 (0.54 M), `principles.md` 21, the email spec 19, RELEASE-PLAN 18, briefs-bundle-A
18, BACKLOG 17. PLAN.md alone is 199 KB (about 50 k tokens); BACKLOG 296 KB, MASTER-ORDER 117 KB, RELEASE-PLAN 98 KB, TODO 79 KB.

### 2.5 Verification runs counted

Invocations in 5.4 days (a segment of a compound command that runs the suite; greps and log reads excluded):

| Run | Builders | Reviewers | Verifiers | Coordinator | Planners | Researchers | Total |
|---|---|---|---|---|---|---|---|
| `tools/check-all.sh` | 119 | 0 | 1 | 44 | 12 | 23 | **199** |
| Full e2e (`pnpm e2e` with no spec) | 7 | 7 | 4 | 15 | 4 | 0 | **37** |
| Targeted e2e (named specs) | 37 | 8 | 4 | 0 | 2 | 0 | 51 (plus repeats inside loops: 281 builder e2e commands in all) |
| Unit runs | 945 | 65 | 26 | 50 | 32 | 91 | **1,209** |
| Waits and log polls | 641 | 90 | 75 | 119 | 111 | 154 | **1,190** |
| `pnpm install` | 72 | 10 | 7 | 33 | 3 | 19 | 144 |

Per builder: median 10 unit runs (max 64), 3 waits, 1 check-all (19 builders ran it three times or more, max 6). Before the
gate (69 builders): 1.7 check-alls, 11.8 unit runs and 8.1 waits or polls per builder, 40% of builder cost on verification
turns. After it (12 builders): 0.4 check-alls, 10.9 unit runs, 6.9 waits or polls, 42% on verification turns. **The gate
cut check-all runs by three quarters but not the verification share**, because the cost is in the turns spent waiting and
re-running unit tests, which the gate does not change.

### 2.6 Machine time

| Run | Wall time (quiet Mac, M1 Pro 10 cores) | CPU | Runs in 5.4 days | Mac time in 5.4 days |
|---|---|---|---|---|
| check-all | 4.5 to 5.7 min (logs: 4:28 and 5:43; TEST-STRATEGY 2.1: 4.9 min); about 10 min under load | 17.6 CPU-min | 199 | **about 16.5 h wall, 58 CPU-h** |
| Full e2e, Chromium (`workers: 1`) | 38.6 to 40.8 min for 742 to 770 tests (9 logs); 1.1 h with failures under load | | about 33 real full runs | **about 22 h** |
| Web build | 37 s to 96 s; `.next` is 2.1 GB, 1.2 GB of it the build cache | | 153 by builders | |
| `pnpm install` | median 5.6 s, p90 26 s (the shared pnpm store already works) | | 144 | under 1 h |

check-all output is about 665,000 characters per run; 92% of it is `validate --all` warnings (TEST-STRATEGY 2.1).

### 2.7 GitHub settings today (read with `gh api`, 26 Oct 2026)

| Setting | Value now | RELEASE-PLAN 7.4 says |
|---|---|---|
| Visibility | public | |
| Actions enabled; allowed actions | enabled; **all actions allowed**; SHA pinning **not required** | GitHub-authored plus the listed, pinned ones |
| Default workflow token | read; may not approve pull requests | same |
| Fork pull request approval | **first-time contributors only** | all outside collaborators |
| Rulesets | **none** (Q-S6 yes is not applied) | block force push and deletion on `main`; tags `release/*` locked |
| Secret scanning, push protection, Dependabot security updates | on, on, on | on |
| Repository secrets | 14 stored (names as in RELEASE-PLAN 7.5) | kept by the owner (Q227) with rules R1 to R6 |
| `.github/` folder | none | |

Three settings are weaker than the plan while the repository is already public and holds production secrets. They need no
workflow to fix (WF-0, Q-W6).

## 3. Waste patterns, with evidence

| # | Pattern | Evidence (section 2 unless named) | Cost |
|---|---|---|---|
| W1 | **Waiting by polling.** Agents start a long run in the background and then `sleep`, `tail` and `grep` the log until it ends | 1,190 waits and log polls; 8 per builder before the gate, 7 after | USD 173 (9.0%), each poll a full-context turn |
| W2 | **The same suite run three or four times per feature**: builder's check-all, the builder's re-run after a fix, the verifier's re-run, the coordinator's post-merge check-all, then a full e2e after the merge | 199 check-alls and 37 full e2e runs in 5.4 days; the coordinator ran 44 check-alls and 15 full e2e runs after merges (`e2e-api1b`, `e2e-slot4`, `e2e-cons2`, `e2e-gbfix`, `e2e-ref1`, `e2e-trp2a` logs) | about 38 h of Mac time a week; USD 72 of turns |
| W3 | **Unit tests re-run in full inside the edit loop** instead of `vitest related` | median 10 unit runs per builder, max 64 (API-1b); unchanged after the gate | USD 134 (6.9%) |
| W4 | **Long agents.** One agent carries a whole feature to 200 to 300 turns, so every late turn re-reads 250 k or more | 44 agents over 100 turns hold 53% of subagent spend; cost per turn rises 2.8 times from short to long agents | USD 887 in that group |
| W5 | **Orientation tax.** Every agent reads PLAN, TODO, MASTER-ORDER, RELEASE-PLAN, EXECUTION-PLAN or BACKLOG to find its row, then greps across them; the text then rides along for every later turn | 48 k tokens added in the first ten turns; PLAN.md read 51 times; planners spend 58% of their cost on exploration | spec-read carry 247 M tokens; exploration USD 805 |
| W6 | **A coordinator session that never ends.** One session holds the whole day: hand-backs, owner conversation, merges, check-all output | 456 k average context; USD 0.168 per turn | USD 269 |
| W7 | **A fix round per UI feature.** Review finds issues after the build, a new `F` lane is briefed, built, reviewed and verified again | 14 fix lanes merged in a week (NAV-1F, NAV-2F, UXB-1F, TRP-GL-CF, TRP-GL-F, TRP2a2, FIXF, GBFIX and others); 47 agents with fix-round descriptions | USD 267 (13.8%) |
| W8 | **Screenshot sets read image by image**, and sets that prove nothing | 925 screenshot reads (reviewers 422, builders 298, verifiers 131, researchers 74); the UXB-1 set where four tab shots were byte-identical captures of the cover (ENGINEERING-STANDARD 16, STD-7) | USD 89 of turns plus 54 M carried tokens |
| W9 | **Opus on mechanical work**: branch integration, re-pinning after a stack, follow-up fixes | Opus builders: "Integrate the four D2b location branches" USD 32, "Fix the ten stack-check failures", "SLUG-FIX", "FAV-1X"; 28 Opus builders cost USD 490 of the USD 839 builder total | about USD 50 to 75 |
| W10 | **Agent rules lag the gate.** `.claude/agents/travel-builder.md` step 2 and `travel-verifier.md` still say "run `bash tools/check-all.sh`" (TS-5 not done) | read 26 Oct; 0.4 check-alls per builder still after the gate | small now, grows with every lane |
| W11 | **Full-length logs in context.** A check-all log is about 166 k tokens; an agent that `cat`s or `tail -200`s it pays that for every later turn | 35 check-all logs of 600 to 680 KB in the scratchpads; read-via-bash carry 180 M tokens (not all logs) | inside W1 and W5 |
| W12 | **Planners re-deriving settled decisions.** Answered questions and superseded rows sit inline in 100 to 200 KB pages; a planner reads the page to find what is still open | planners' exploration share 58%; MASTER-ORDER and RELEASE-PLAN each carry a "corrections" section and superseded tables | inside W5 |

Not a waste worth fixing: parallel worktree installs (144 installs, median 5.6 s; the pnpm store is shared already) and brief
size (median 950 tokens).

## 4. The optimised workflow

### 4.1 The loop

```mermaid
flowchart LR
  B[Builder in a worktree<br/>T0 while editing, T1 once<br/>no full suites, no polling]:::core --> H[Hand-back block<br/>at most 40 lines]:::core
  H --> C[Coordinator stacks ready branches<br/>pushes int/stack-N]:::core
  C --> CI[GitHub Actions on int/stack-N<br/>check + mapped e2e + visual for UI]:::ext
  CI --> S[ci-summary.json<br/>one background wait, one read]:::ok
  S -->|green| R[Stack review once<br/>design reviewer reads contact sheets<br/>verifier reads CI and runs Mac-only list]:::core
  S -->|red| F[Eject or bisect by suite inputs<br/>fix lane, same brief]:::err
  F --> C
  R --> M[Fast-forward main to the tested tip<br/>required check already green]:::ok
  M --> N[Nightly on GitHub: full e2e Chromium and WebKit<br/>Mac nightly: Mac-only list]:::infra
  N --> T3[Release: CI green on the named commit<br/>plus the Mac-only list and the owner's checks]:::ok
  classDef core fill:#1f6f8b,stroke:#0d3b4f,color:#fff
  classDef ext fill:#d98c1f,stroke:#8a5410,color:#fff
  classDef ok fill:#2f7d4a,stroke:#1b4a2b,color:#fff
  classDef err fill:#b23a3a,stroke:#6e1f1f,color:#fff
  classDef infra fill:#6b7280,stroke:#374151,color:#fff
```

Workers never push (unchanged). Only the coordinator pushes, and only `int/*` stack branches and `main` (Q-W1).

### 4.2 What moves to Actions and what stays on the Mac

| Check | Where | Why |
|---|---|---|
| Links, relink, tree contract, hard-coding scan, gate map check, folder contract | Actions (`check.yml`, every push) | pure repository reads |
| Python tests, locations, core typecheck and tests, every data check (capture, relevance, suitability, sources, towns, normaliser budget, generated files, OpenAPI, slugs) | Actions | decoy home point is enough (`core/test/setup/home-point.ts`) |
| Web typecheck, lint, build (offline image mode, IMG-1b), vitest `unit`, `fixture`, `built` | Actions | no secrets: `BUILD_ENV` already forces MapLibre and empty Google keys |
| Database suites on local Postgres (`db.local`) | Actions, as a `services: postgres:18` container | no secret; the local Docker image today |
| Mapped e2e specs (T2) and the full Chromium e2e, sharded | Actions, Linux | 770 tests at `workers: 1` is 40 min on the Mac; six shards take about 15 min of wall |
| WebKit desktop and iPhone projects | Actions, `macos-15` runner | the macOS WebKit is closer to Safari than Linux WebKit; free on a public repository |
| Visual sweep (1440 and 390, light and dark), STD-7 evidence check, contact sheets, diff against the last `main` sweep | Actions, `macos-15` | same fonts (self-hosted `@font-face`), the owner's platform family |
| Budget report (start JS, search chunks) as a job summary | Actions | deterministic from the build |
| **Place-size budget and anything that needs the photo cache** | **Mac** until Q-W5 | the baseline was measured with renditions; a CI build without the cache leaves photos out |
| **GPU specs** (`*.gpu.spec.ts`: globe motion, hit, deeplink, pole, home, map filters) | **Mac** | hosted runners have no GPU; under SwiftShader the motion specs say nothing (`playwright.config.ts` comment, backlog 3.34) |
| **Timing tests** (`web.timing`: revision, search budget, split) | **Mac**, load-guarded | shared runners are noisy; a red would be noise, a green proves little |
| **The real home point**: the Opus privacy audit at T3, scrub and `nearHome()` against the real value | **Mac** | the value must never leave the machine (S5.2, Q-S4) |
| **Signed-in flows on real services** (Neon Auth, Google, Resend), the Neon child database (`child-db` job stays manual and owner-approved) | **Mac** or the protected environment | production and test secrets (R1 to R4) |
| **Real devices**: iPhone Safari, VoiceOver, keyboard-only owner checks | **owner** | no emulator substitutes |
| **Anything that calls Commons, OSM, Wikidata, ORS** (`images:warm`, gallery, research) | **Mac**, one runner at a time | shared GitHub IPs would hit rate limits; the one-runner rule |
| **Deploy, tags, `vercel`** | **Mac**, clean worktree, by hand | unchanged (RELEASE-PLAN 6) |

### 4.3 Workflows

All four never deploy and never read a secret. Every third-party action is avoided (pnpm comes from Corepack in Node 22),
GitHub-authored actions are pinned to a full commit SHA, and the version is a comment. `<sha>` below is filled at build time
from the action's release; the sketches are not files.

| Workflow | Triggers | Jobs | Wall | Runner minutes per run | Runs a month (estimate) | Minutes a month |
|---|---|---|---|---|---|---|
| `check.yml`, docs-only change | push to `main`, `int/**`; `pull_request` | `plan` (gate selection, under 1 min) and `links` | 2 min | 3 | 80 | 240 |
| `check.yml`, code change | same | `plan`, `core-data`, `web`, `e2e-mapped` (up to 3 shards), `db-local`, `summary` | 15 to 20 min | about 45 | 60 | 2,700 |
| `e2e.yml` full | nightly at 07:00 UTC on `main` when `main` moved; `workflow_dispatch` (release cut, a stack with a `full` path) | 6 Chromium shards on Linux, 2 WebKit jobs on macOS, `merge` | 20 to 25 min | about 140 | 30 | 4,200 |
| `visual.yml` | push to `int/**` touching `web/app/**`, `web/components/**`, `web/styles/**`; `workflow_dispatch` | one macOS job: build, sweep, STD-7 check, contact sheets, diff | 20 to 25 min | 25 | 20 | 500 |
| CodeQL default setup | GitHub default (push to `main`, weekly) | JavaScript and TypeScript, Python | 5 to 8 min | 10 | 40 | 400 |
| **Total** | | | | | | **about 8,000** |

All free on a public repository (standard GitHub-hosted runners, Linux 4 vCPU and 16 GB, macOS M1 3 CPU and 7 GB). The same
load on a private repository would be about four times the 2,000 free minutes, and macOS minutes would be billed at a higher
rate, so a return to private would need the e2e matrix cut to Chromium only. Limits that bind: 20 concurrent jobs, 5 of them
macOS; 10 GB of cache per repository; 6 hours per job.

The CI e2e estimate assumes a Linux 4-vCPU runner is 1.3 to 1.6 times slower per test than the Mac's Chromium: 770 tests
at 40 Mac minutes become 55 to 65 minutes of test time, split six ways, plus about 5 minutes per shard for checkout, install,
browser restore and its own build. WF-6's acceptance check replaces this estimate with the measured number.

#### `check.yml` (sketch)

```yaml
name: check
on:
  push:
    branches: [main, 'int/**']
  pull_request:            # a fork gets no secrets and a read-only token (GitHub default); none are used anyway
  workflow_dispatch:
permissions: {}            # every job asks for what it needs; nothing asks for write
concurrency:
  group: check-${{ github.ref }}
  cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}
env:
  CI: 'true'
  HOME_POINT_LAT: '10.5'   # the decoy of core/test/setup/home-point.ts (open ocean). Plain env, never a secret, never the real point
  HOME_POINT_LON: '-140.5'
  NEXT_PUBLIC_PLACE_MAP_FAMILY: maplibre
  NEXT_PUBLIC_GOOGLE_MAPS_KEY: ''
  NEXT_PUBLIC_GOOGLE_MAP_ID: ''
  GATE_RUNNER: ci          # gate.py: no machine slots, no load guard deferral for non-timing suites, timing suites skipped as mac-only
jobs:
  plan:
    runs-on: ubuntu-24.04
    timeout-minutes: 5
    permissions: { contents: read }
    outputs:
      groups: ${{ steps.sel.outputs.groups }}
      specs: ${{ steps.sel.outputs.specs }}
    steps:
      - uses: actions/checkout@<sha> # v5
        with: { fetch-depth: 0, persist-credentials: false }
      - name: Guard - no production configuration, decoy home point only
        run: |
          test -z "${DATABASE_URL:-}" || { echo "DATABASE_URL must not be set in CI"; exit 1; }
          test "$HOME_POINT_LAT,$HOME_POINT_LON" = "10.5,-140.5" || { echo "only the decoy home point may be used"; exit 1; }
      - name: Lint the workflows themselves (WF-2)
        run: python3 tools/ci/lint_workflows.py .github/workflows
      - id: sel
        name: Select suites from tools/gate/map.json (the same map the builders use)
        run: |
          base=$([ "${{ github.ref }}" = refs/heads/main ] && echo "${{ github.event.before }}" || git merge-base origin/main HEAD)
          python3 tools/gate/gate.py --tier 2 --base "$base" --dry-run --json > plan.json
          python3 tools/ci/plan_to_outputs.py plan.json >> "$GITHUB_OUTPUT"   # groups: links, core-data, web, db, e2e; specs: shard lists

  core-data:
    needs: plan
    if: contains(needs.plan.outputs.groups, 'core-data')
    runs-on: ubuntu-24.04
    timeout-minutes: 20
    permissions: { contents: read }
    steps:
      - uses: actions/checkout@<sha> # v5
        with: { persist-credentials: false }
      - uses: actions/setup-node@<sha> # v5
        with: { node-version: 22, cache: pnpm }
      - uses: actions/setup-python@<sha> # v6
        with: { python-version: '3.13', cache: pip }
      - run: corepack enable && pnpm install --frozen-lockfile
      - run: tools/gate.sh --tier 2 --group core-data --json --out ci-out/core-data.json
      - uses: actions/upload-artifact@<sha> # v5
        if: always()
        with: { name: gate-core-data, path: ci-out/, retention-days: 7 }

  web:
    needs: plan
    if: contains(needs.plan.outputs.groups, 'web')
    runs-on: ubuntu-24.04
    timeout-minutes: 30
    permissions: { contents: read }
    steps:
      - uses: actions/checkout@<sha> # v5
        with: { persist-credentials: false }
      - uses: actions/setup-node@<sha> # v5
        with: { node-version: 22, cache: pnpm }
      - run: corepack enable && pnpm install --frozen-lockfile
      - uses: actions/cache/restore@<sha> # v4   (restore only; main and the nightly save it)
        with:
          path: web/.next/cache
          key: next-${{ hashFiles('pnpm-lock.yaml') }}-${{ github.sha }}
          restore-keys: next-${{ hashFiles('pnpm-lock.yaml') }}-
      - run: tools/gate.sh --tier 2 --group web --json --out ci-out/web.json   # types, lint, build (offline images), unit, fixture, built; budgets except place-size
      - run: pnpm --dir web budget:report --markdown >> "$GITHUB_STEP_SUMMARY"
      - uses: actions/upload-artifact@<sha> # v5
        if: always()
        with: { name: gate-web, path: ci-out/, retention-days: 7 }

  e2e-mapped:
    needs: plan
    if: needs.plan.outputs.specs != '[]'
    runs-on: ubuntu-24.04
    timeout-minutes: 30
    permissions: { contents: read }
    strategy:
      fail-fast: false
      matrix: { shard: '${{ fromJSON(needs.plan.outputs.specs) }}' }   # at most 3 shards for a T2 selection
    steps:
      - uses: actions/checkout@<sha> # v5
        with: { persist-credentials: false }
      - uses: actions/setup-node@<sha> # v5
        with: { node-version: 22, cache: pnpm }
      - run: corepack enable && pnpm install --frozen-lockfile
      - uses: actions/cache@<sha> # v4
        with: { path: ~/.cache/ms-playwright, key: pw-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }} }
      - run: pnpm --dir web exec playwright install --with-deps chromium
      - run: pnpm --dir web exec playwright test --project=chromium ${{ matrix.shard.specs }}
        env: { PW_NO_GPU: '1', PW_BLOB: '1' }
      - uses: actions/upload-artifact@<sha> # v5
        if: always()
        with: { name: blob-${{ strategy.job-index }}, path: web/blob-report, retention-days: 7 }

  db-local:
    needs: plan
    if: contains(needs.plan.outputs.groups, 'db')
    runs-on: ubuntu-24.04
    timeout-minutes: 15
    permissions: { contents: read }
    services:
      postgres:
        image: postgres:18@sha256:<digest>
        env: { POSTGRES_PASSWORD: ci-only-not-secret }
        ports: ['127.0.0.1:54329:5432']
        options: --health-cmd "pg_isready" --health-interval 5s --health-retries 20
    steps:
      - uses: actions/checkout@<sha> # v5
        with: { persist-credentials: false }
      - uses: actions/setup-node@<sha> # v5
        with: { node-version: 22, cache: pnpm }
      - run: corepack enable && pnpm install --frozen-lockfile
      - run: pnpm db:test
        env: { TEST_DATABASE_URL: 'postgres://postgres:ci-only-not-secret@127.0.0.1:54329/postgres' }

  summary:                  # the one required check (Q-W2); it never fails silently
    needs: [plan, core-data, web, e2e-mapped, db-local]
    if: always()
    runs-on: ubuntu-24.04
    timeout-minutes: 5
    permissions: { contents: read }
    steps:
      - uses: actions/checkout@<sha> # v5
        with: { persist-credentials: false }
      - uses: actions/download-artifact@<sha> # v5
        with: { path: in }
      - run: python3 tools/ci/summarise.py in --sha "${{ github.sha }}" --out ci-summary.json --markdown >> "$GITHUB_STEP_SUMMARY"
      - run: python3 tools/ci/scrub_check.py in ci-summary.json      # no secret patterns, no emails outside the allowlist, no .env files
      - uses: actions/upload-artifact@<sha> # v5
        with: { name: ci-summary, path: ci-summary.json, retention-days: 30 }
      - run: python3 tools/ci/summarise.py --exit-code ci-summary.json   # red when any needed job failed or was skipped by error
```

#### `e2e.yml` (sketch; replaces E2E-YML)

```yaml
name: e2e
on:
  schedule: [{ cron: '0 7 * * *' }]      # 03:00 Toronto in summer, 02:00 in winter
  workflow_dispatch:
    inputs:
      ref: { description: 'commit, int/* branch or release candidate', required: true, default: main }
permissions: {}
concurrency: { group: e2e-${{ inputs.ref || 'main' }}, cancel-in-progress: true }
env: { CI: 'true', HOME_POINT_LAT: '10.5', HOME_POINT_LON: '-140.5', PW_NO_GPU: '1', PW_BLOB: '1' }
jobs:
  gate:
    runs-on: ubuntu-24.04
    permissions: { contents: read, actions: read }
    outputs: { run: ${{ steps.moved.outputs.run }} }
    steps:
      - id: moved       # skip the nightly when main has not moved since the last green nightly
        run: python3 tools/ci/main_moved.py >> "$GITHUB_OUTPUT"
        env: { GH_TOKEN: ${{ github.token }} }
  chromium:
    needs: gate
    if: needs.gate.outputs.run == 'true'
    runs-on: ubuntu-24.04
    timeout-minutes: 45
    permissions: { contents: read }
    strategy: { fail-fast: false, matrix: { shard: [1, 2, 3, 4, 5, 6] } }
    steps:
      # checkout (ref input), setup-node, Corepack install, .next/cache restore, Playwright browser cache as in check.yml
      - run: pnpm --dir web exec playwright test --project=chromium --shard=${{ matrix.shard }}/6
      # upload blob-report as blob-chromium-<shard>
  webkit:
    needs: gate
    if: needs.gate.outputs.run == 'true'
    runs-on: macos-15
    timeout-minutes: 60
    permissions: { contents: read }
    strategy: { fail-fast: false, matrix: { project: [webkit-iphone, webkit-desktop] } }
    steps:
      - run: pnpm --dir web exec playwright test --project=${{ matrix.project }}
  merge:
    needs: [gate, chromium, webkit]
    if: always() && needs.gate.outputs.run == 'true'
    runs-on: ubuntu-24.04
    permissions: { contents: read }
    steps:
      - run: pnpm --dir web exec playwright merge-reports --reporter json ./all-blobs > e2e.json
      - run: python3 tools/ci/summarise.py --e2e e2e.json --out ci-summary.json --markdown >> "$GITHUB_STEP_SUMMARY"
      # scrub_check, upload ci-summary (30 days) and the HTML report (7 days); save .next/cache from main only
```

Two config lines in `web/playwright.config.ts` make this work: `testIgnore: /\.gpu\.spec\.ts$/` when `PW_NO_GPU=1`, and a
`blob` reporter when `PW_BLOB=1`. Each shard builds its own site (the `.next` output is about 0.9 GB without the cache, too
big to pass between jobs cheaply); the restored `.next/cache` keeps that build to a few minutes.

#### `visual.yml` (sketch)

```yaml
name: visual
on:
  push:
    branches: ['int/**']
    paths: ['web/app/**', 'web/components/**', 'web/styles/**', 'web/lib/**', 'docs/v2/design/foundation/tokens.json']
  workflow_dispatch:
    inputs: { routes: { description: 'routes file under web/tests/e2e/sweep/ (default: all)', required: false } }
permissions: {}
concurrency: { group: visual-${{ github.ref }}, cancel-in-progress: true }
jobs:
  sweep:
    runs-on: macos-15
    timeout-minutes: 45
    permissions: { contents: read, actions: read }    # actions: read to fetch the last main sweep as the baseline
    env: { CI: 'true', HOME_POINT_LAT: '10.5', HOME_POINT_LON: '-140.5', PW_NO_GPU: '1' }
    steps:
      # checkout, setup-node, Corepack install, webkit and chromium browsers from cache
      - run: pnpm --dir web exec playwright test sweep-ci.spec.ts --project=chromium   # 1440x900 and 390x844, light and dark, scale 2, tiles for tall pages
      - run: python3 tools/gate/shots_check.py web/test-results/shots --brief .github/sweep-routes.json   # STD-7: sizes, no identical or near-identical files
      - run: python3 tools/ci/contact_sheet.py web/test-results/shots --out sheets/                    # one sheet per screen: 4 tiles, labelled
      - run: python3 tools/ci/shot_diff.py --baseline last-main --out diff.json                      # perceptual hash per tile; changed screens listed
      # upload sheets/ and diff.json (14 days), full shots (7 days); summary lines into ci-summary.json
```

### 4.4 How CI results reach agents cheaply

**One file, one command, one turn.**

`ci-summary.json` (schema `ci-summary/1`, WF-4 owns it, an Opus contract):

```json
{
  "schema": "ci-summary/1", "workflow": "check", "sha": "<commit>", "tree": "<tree>", "ref": "int/stack-2026-10-27-1",
  "conclusion": "failure",
  "suites": [{ "id": "web.build", "result": "pass", "seconds": 212 }, { "id": "core.unit", "result": "fail", "seconds": 31,
               "excerpt": "at most 15 lines from tools/gate/extract.py" }],
  "e2e": { "passed": 768, "failed": 1, "flaky": 1, "skipped": 27,
           "failures": [{ "project": "chromium", "spec": "trip-tabs.spec.ts", "title": "...", "excerpt": "at most 15 lines", "artifact": "blob-3" }] },
  "visual": { "screens": 12, "changed": ["trip/summary 390 dark"], "evidence_check": "pass", "sheets": ["sheets/trip-summary.png"] },
  "mac_only_pending": ["web.timing", "gpu specs", "privacy with the real home point", "place-size budget", "real devices"],
  "run_url": "https://github.com/nitin27may/travel/actions/runs/<id>"
}
```

`tools/ci/status.sh <sha|branch> [--wait] [--sheets]` (WF-4):

- finds the runs for the commit with `gh run list --commit`, and with `--wait` blocks on `gh run watch --exit-status`;
- downloads only the `ci-summary` artifact (and with `--sheets` the contact sheets of changed screens);
- prints at most 40 lines: the conclusion, failing suites with excerpts, e2e failures, changed screens, the Mac-only list;
- writes passing suites into the local gate cache (TS-3) keyed by the same input tree hashes, marked `CACHED(ci)`, so a later
  local T1 or T3 on the same tree skips them. It imports only from runs on `push` to this repository's own branches, never from
  `pull_request` runs (a fork could forge a summary).

Agent rule: start `tools/ci/status.sh <sha> --wait` with `run_in_background`, end the turn, and act when it is reported
finished. **No `sleep`, no polling, no reading raw CI logs.** Open a raw log only when the excerpt does not explain a
failure, with `gh run view --log-failed | grep -n <suite>`, never in full.

The verifier's job becomes: read the CI summary for the stack tip (independent of the builder: a clean checkout on another
machine is a stronger check than a re-run on the builder's tree); read the contact sheets and at most four full-size tiles of
flagged screens; run the Mac-only list for the paths the change touches; walk the owner checklist of the brief. Its report
names the CI run.

### 4.5 A red CI cannot be ignored

**Phase 2 note (WF-3).** `check.yml` now has `web` and `db-local` jobs. `check / summary` prints `Overall: partial (not run in CI: ...)`
for a plan that includes a group with no job yet (`e2e`, `visual`), `Overall: green for everything CI runs; the Mac-only checks above
are still owed` when only Mac-only work is left, and plain `green` only when nothing is owed. Two lists name what CI left out: the
suites the map marks `mac_only` (`web.timing`) and the test files it marks `ci_exclude` (place size and the photo-rendition tests, the
household-radius test; each with its reason in `tools/gate/map.json`). Do not make `check / summary` a required status check on `main`
before WF-10: one green week first (Q-W2).

| Guard | How |
|---|---|
| Required check on `main` | a ruleset on `main` requires the `check / summary` status. A pushed commit must already carry a green status, so the coordinator pushes `int/stack-*`, waits for green, then fast-forwards `main` to that exact commit (TEST-STRATEGY 9.2 step 3 already moves `main` this way). Bypass: the owner only. Q-W2 |
| Docs-only merges stay fast | the `plan` job selects only `links` for a docs-only diff: about 2 minutes |
| Red nightly | GitHub emails the owner on a failed scheduled run; the coordinator's first command of a session is `tools/ci/status.sh main --nightly`; a red night blocks new stacks until triaged (TEST-STRATEGY 10.3, unchanged) |
| Flakes | a test that fails then passes on retry is listed as `flaky` in the summary and in the flake ledger (TS-4); retries are 1 in CI, 0 locally; two flakes in 7 days quarantine the test with a BACKLOG row |
| Release | T3 is "CI green on the named commit (check, e2e, visual) plus the Mac-only list green plus the owner's checks"; RELEASE-PLAN 4.1 records the run URL |
| Workflow drift | `tools/ci/lint_workflows.py` runs in `links` (every push) and fails on: a `secrets.` reference outside the `child-db` job, `pull_request_target`, `workflow_run`, an action not pinned to a 40-character SHA, a missing top-level `permissions`, a write permission, `persist-credentials` not false, a self-hosted runner label |

### 4.6 Secrets and privacy on a public repository

| # | Decision | Status |
|---|---|---|
| D1 | `permissions: {}` at the top of every workflow; jobs ask for `contents: read`, and `actions: read` only where a baseline artifact is fetched. No job asks for write: no pull request comments (the job summary and `ci-summary.json` replace them) | this plan |
| D2 | Triggers: `push` to own branches, `pull_request`, `schedule`, `workflow_dispatch`. Never `pull_request_target`, `workflow_run`, `issue_comment` | RELEASE-PLAN 7.2 rule, kept |
| D3 | No workflow reads a repository secret. The `child-db` job keeps `TEST_DATABASE_URL` in its protected environment, `workflow_dispatch` only (R4) | R1, R4, kept |
| D4 | The decoy home point is plain workflow `env`, and a guard step fails if any other value appears. CI never sees the real point; every check that needs it is on the Mac list | MASTER-ORDER LOCAL-4, kept; Q-S4 |
| D5 | Artifacts: e2e traces only on failure (`retain-on-failure`), retention 7 days (sweep sheets 14, summary 30); `scrub_check.py` runs before every upload: no token patterns, no email outside an allowlist, no `.env*`, no cookie jars | this plan |
| D6 | Actions pinned by SHA; repository setting "require SHA pinning" on; allowed actions GitHub-authored only. pnpm via Corepack, so no third-party action is needed. Dependabot version updates for `github-actions` only, so pins move by reviewed pull request | WF-0 (owner), Q-W6 |
| D7 | Fork pull request workflows need approval for **all outside collaborators** (today: first-time contributors only) | WF-0 (owner), Q-W6 |
| D8 | The 14 production secrets: move them from repository secrets to an environment `production-deploy` limited to `main` and `release/*` with the owner as required reviewer (R3). That keeps the owner's choice to store them in GitHub (Q227) and removes the path by which any future job on any branch could read them | Q-W4 |
| D9 | Caches: only runs on `main` and the nightly save caches (`actions/cache/save` behind an `if`); `pull_request` runs restore only, so a fork cannot poison them. The gate-cache import (4.4) trusts `push` runs only | this plan |
| D10 | No Commons, OSM, Wikidata or ORS call from CI: the build runs in its offline image mode, and a test (IMG-1b) fails if a Commons host is called | IMG-1b, kept |
| D11 | CodeQL default setup, secret scanning with push protection, Dependabot alerts on; private vulnerability reporting on | RELEASE-PLAN 7.4, kept |
| D12 | The owner reads every change under `.github/` before it merges (R5); `.github/**` is a review path in `tools/gate/map.json` | R5, kept |

### 4.7 Caveats

| Caveat | Effect | Handling |
|---|---|---|
| Linux Chromium has no GPU and renders text differently from macOS | functional e2e is fine; GPU specs are meaningless; pixel shots differ | GPU specs Mac-only; visual sweep on macOS runners; baselines per platform, never a Mac shot against a CI shot |
| macOS runners are M1 VMs without Metal acceleration | WebGL globe in sweeps is software-rendered | sweep routes skip globe motion; the globe stays an owner check on the Mac |
| Linux WebKit is not iOS Safari; macOS WebKit is closer but still not a phone | engine-level checks only | real iPhone and VoiceOver stay with the owner |
| Free tier: 20 concurrent jobs, 5 macOS; 10 GB cache | a nightly plus two stacks can queue the macOS jobs | concurrency groups cancel superseded runs; `.next/cache` saved from `main` only |
| Artifact storage on a public repository is not clearly documented as unmetered | a quota could fill | short retention (7 to 30 days), summaries are KB, sheets are a few MB |
| Scheduled workflows stop after 60 days without repository activity | a quiet spell silences the nightly | the coordinator's session-start command shows the nightly's date |
| CI timing differs from the Mac | e2e minute estimates may be off | WF-6 acceptance measures them and updates 4.3 |
| Without the photo cache, a CI build leaves photos out | budget and photo-page checks differ from the Mac | place-size budget Mac-only until Q-W5 |

## 5. Planning by feature to cut tokens

### 5.1 One stack per feature, contract first

A feature is planned as one stack, not as a chain of separately reviewed tasks:

1. **Contract** (Opus, small, 1 to 4 h): schema, store method, codec keys. Reviewed by an Opus reviewer before any UI task
   starts, because a contract error is what causes the later fix lanes (W7).
2. **Design check before the build** for UI features: the design reviewer approves the wireframe or the spec's screen list
   and states its acceptance shots. Findings at this stage cost a doc edit, not an `F` lane.
3. **Builds** (Sonnet), in the same worktree branch family, each under the length cap (5.5), each ending in T1.
4. **One stack review**: CI on the stack tip, then the design reviewer reads the contact sheets for the whole feature, then
   the verifier. One fix lane at most, briefed from the joint findings.

Evidence for the change: 14 fix lanes in one week, each with its own brief, build, review and verify; USD 267 (13.8%).

### 5.2 Risk tiers decide review and verification

| Tier | What the change is | Design review | Verifier | CI | Mac-only list |
|---|---|---|---|---|---|
| R0 | docs, plans, research prose | none | none | `links` | none |
| R1 | data within an existing contract (records, sidecars, locations) | none (the data seat's sample check stands) | none | `check.yml` | none |
| R2 | small UI: one component, no new screen, no layout change, no budget moved by more than 1 KB | once per stack, from contact sheets | none; the coordinator reads the CI summary | `check.yml` and `visual.yml` | when GPU paths are touched |
| R3 | a new screen, a feature, a layout change, a budget-moving change | once per feature stack | yes (4.4) | full | the parts the paths select |
| R4 | contracts, privacy, auth, security, migrations, `tools/gate/**`, `.github/**` | per B4 security reviews (Opus) and the Opus contract review | yes, plus the real home point audit when output can change | full plus `e2e.yml` dispatch | all |

The tier is a field in the brief header (TASK-BRIEF-TEMPLATE 1) and the coordinator's stack decision. A change with any R4 path

**Where an expert model is spent on UI (owner, 26 Oct 2026).** Strong-model design review is kept for the decisions that shape the experience, and regular UI work goes through the cheaper path. A UI task is *critical* (always the Opus design reviewer, and a design check BEFORE the build on the wireframe or spec, then again on the real screenshots) when it: introduces a new pattern, component or flow; changes navigation, information architecture or the trip or place page structure; touches the design foundation (tokens, components, patterns); is a first-of-its-kind screen (a park page, a map or MCP view, the party bar); or has an accessibility-critical interaction (keyboard, focus, screen reader) that is new. Everything else (an existing component reused, copy, spacing, a new row in an existing list, a fix) is *regular*: a Sonnet builder, CI checks and visual sheets, no per-task model review, read once at the stack review by the coordinator. The owner's screenshot check still gates each release (memory: owner verifies UI with screenshots). When unsure, the coordinator marks the task critical; the cost of one Opus review is small next to a wrong pattern copied into ten screens.
is R4. This replaces "every UI round ends with design review, then verifier" (Q-W3).

### 5.3 Context pack instead of re-reading the plan

- `tools/context_pack.py <task-id>` (WF-8) writes a pack of at most 10 k tokens into the worktree's scratch: the common block
  of TASK-BRIEF-TEMPLATE 4; the task's rows from MASTER-ORDER, BACKLOG and TODO; the spec sections the brief cites, cut at
  their headings; P1 to P9 as one line each; the gate and CI commands; the hand-back block. The brief says "read the pack;
  do not open PLAN, TODO, MASTER-ORDER, RELEASE-PLAN, BACKLOG or EXECUTION-PLAN".
- `tools/where.py <id>` prints every line in `docs/v2/**` that names an id (file, line, the row's first 160 characters):
  one call instead of a run of greps across six large pages.
- Rule for every agent: never Read a file over 40 KB whole; read its outline (`grep -n '^#'`) and then the section by offset.
  Planners editing those pages are the exception.
- The measured orientation tax is 48 k tokens by turn ten. A pack of 10 k saves about 30 k tokens of context on every later
  turn: about USD 1.0 per agent at the measured mix, about USD 190 a week at this week's 191 agents.

### 5.4 Model by task

The CLAUDE.md table stands; these are the mappings that the week shows were off:

| Task kind | Model | Was |
|---|---|---|
| Branch integration, re-pinning after a stack, regenerating snapshots, applying review findings that name the exact fix | Sonnet | often Opus (W9) |
| Moving TODO and BACKLOG rows to Done, status cells, link fixes, changelog lines | Haiku | Opus planners |
| Counting, listing, measuring from logs or transcripts | Haiku | Opus or Sonnet |
| Contracts, privacy, security, gates, design review, plans with open decisions | Opus | Opus (correct) |
| Builds with a brief and an acceptance check | Sonnet | mostly Sonnet (correct) |

### 5.5 Agent length cap and coordinator rotation

- A brief over 6 agent-hours is split into stacked sub-briefs before it starts.
- At about 100 turns an agent writes a checkpoint hand-back (done, left, next step, the files touched, the T1 state) and
  stops; the coordinator starts a fresh agent with the pack and the checkpoint. Measured: cost per turn is 0.055 under 50
  turns and 0.154 over 150.
- The coordinator starts a new session at each stack landing or at most each half day, from HANDOVER's current section and
  `tools/ci/status.sh main`. Hand-backs it receives are at most 40 lines (TEST-STRATEGY 8.2 block plus findings).

### 5.6 Screenshots

- Screens and states to shoot are listed in the brief (TASK-BRIEF-TEMPLATE); CI takes them (`visual.yml`); STD-7 rejects a set
  with missing viewports, wrong sizes or identical images before any agent reads it.
- Reviewers read one contact sheet per screen (four labelled tiles: 1440 light and dark, 390 light and dark), then at most
  four full-size tiles of screens the diff flagged. Builders do not read their own screenshots unless the brief asks for one
  specific check.
- The owner's screenshot review uses the same sheets, sent from the CI run (memory: owner verifies UI with screenshots).

### 5.7 Worktrees

No template worktree: installs are already fast. One change: when the coordinator creates a worktree, clone the main
checkout's `web/.next/cache` with `cp -c` (APFS copy-on-write, instant) so the first local build is incremental.

### 5.8 Stopping rules (every brief)

| Situation | Rule |
|---|---|
| The same failure after two fix attempts | stop; hand back with the excerpt and what was tried; the coordinator escalates one model step (CLAUDE.md) |
| A test outside the change's paths fails | do not fix it; one retry; report it as a suspected flake with the excerpt |
| A run is deferred by the gate (load, lock) | say so; one retry after 5 minutes; never a loop |
| Waiting for anything | background the command and end the turn; never `sleep` or poll |
| Full suites | builders: none. At most one T1 per hand-back, plus one after a fix |
| CI red on a stack | the coordinator ejects or bisects (TEST-STRATEGY 9.2); no builder re-runs the stack locally |

### 5.9 Research

Researchers spent 52% of their cost on exploration. Two rules: read `capture.ts fields`, `gaps --trip` and `explain` output
rather than raw record JSON; and keep one findings file per trip and topic in `research/trips/<folder>/` that the next
researcher reads first (the folder exists; the rule is to read it before searching). Commons stays one runner at a time.

## 6. Savings, ranked by saving per hour of effort

Savings are a share of the measured week's cost weight (USD 1,930) and in USD per week (the 5.4-day figure times 1.3).
Overlaps are removed where two items touch the same turns (S1 and S9 share unit and poll turns; S3 and S4 share carry), so
the total is lower than the sum of rows.

| Rank | Change | Saving (share; USD a week) | Wall-clock saving | Effort | Model | Depends on | Saving per effort hour |
|---|---|---|---|---|---|---|---|
| 1 | S8 Coordinator rotation and 40-line hand-backs (5.5) | 6%; 155 | none | 0.5 h | coordinator, owner | none | 310 |
| 2 | S4 Agent length cap with checkpoint hand-backs; split briefs over 6 h (5.5) | 9%; 235 | none | 1 h | Opus planner | none | 235 |
| 3 | S7 Model by task: Sonnet for integration and follow-ups, Haiku for row moves and counts (5.4) | 4%; 100 | none | 0.5 h | Opus planner | none | 200 |
| 4 | S5 Risk tiers R0 to R4; one review per feature stack; design check before build (5.1, 5.2) | 6%; 145 | about 1 h per small UI change (no review and verify round) | 1.5 h docs | Opus planner | Q-W3 | 97 |
| 5 | S9 TS-5 now: builder T0 and T1 only, no check-all, `vitest related` in the loop; stopping rules (5.8) | 3%; 70 | 5 to 15 min per lane | 2 h | Opus planner | none | 35 |
| 6 | S3 Context pack and `where.py`; the 40 KB read rule (5.3) | 13%; 330 | 2 to 5 min per agent start | 6 h | Sonnet 5, Opus review 1 | none | 55 |
| 7 | S1 CI summary contract and `status.sh` (background wait, gate cache import); verifier reads CI (4.4) | 6%; 155 | removes about 7 polls per agent | 3 h + its share of S2 | Opus (contract) | S2 core | 50 (counted with S2) |
| 8 | S2 Actions: `check.yml`, sharded `e2e.yml`, `db-local` (4.3) | 2% in tokens; 50 | **about 38 h of Mac time a week**; a stack's T2 in 15 to 20 min of wall while the Mac stays free; full e2e 20 to 25 min instead of 40 to 60 | 12 h | Sonnet, Opus review 2 | WF-0, Q-W1 | 4 in tokens; large in wall time |
| 9 | S6 Screenshots: STD-7, contact sheets, `visual.yml` (5.6) | 3%; 85 | owner and reviewer read 3 to 4 sheets instead of 16 to 40 images | 7 h | Sonnet, Opus review 1 | STD-7, S2 | 12 |
| 10 | S10 Required check on `main` and the red-CI guards (4.5) | prevents regressions reaching a release; tokens indirect (fewer post-release fix lanes) | fewer T3 surprises | 1 h + 0.25 h owner | Sonnet, owner | S2 green one week, Q-W2 | not in tokens |
| | **Total after overlaps** | **about 35 to 45%; 870 to 1,130 a week at this week's pace** | **about 38 h of Mac time a week** | **about 34 h** | | | |

Per typical UI feature lane (measured UXB-1: build USD 21, two reviews USD 18, verify USD 5; TRP2b: USD 37): about 35% less,
from no polling, a pack instead of plan reads, sheets instead of single shots, CI instead of re-runs, and one review per stack.

### 6.1 Quick wins this week (safe before release A and the B+C release)

None of these touch product code, the release gate (T3 stays as RELEASE-PLAN 4.1 until WF-10), or a file a running lane owns.

| # | Quick win | Who | Hours | Why it is safe now |
|---|---|---|---|---|
| QW1 | WF-0: GitHub settings: fork approval for all outside collaborators; allowed actions GitHub-authored only with SHA pinning required; rulesets blocking force push and deletion on `main` and update and deletion on `release/*` tags (Q-S6) | owner | 0.25 | the repository is already public with 14 secrets stored; no workflow exists yet to break |
| QW2 | Coordinator rotation and the 40-line hand-back rule | coordinator | 0.5 | behaviour only |
| QW3 | TS-5 pulled forward: agent files say T0 and T1, never check-all; stopping rules; the 40 KB read rule; the turn cap | Opus planner | 2 | removes W10 before bundle A's last rows (FAV-R, FAV-V, IMG-1V, TRP-GL-V) |
| QW4 | Model mapping of 5.4 applied when briefing A's and B+C's remaining rows | coordinator | 0.5 | changes who runs a task, not what it must pass |
| QW5 | Risk tiers applied to B+C's UXB rows: one design review per UXB stack instead of per task, with the design check before build | coordinator, after Q-W3 | 1 | A is not affected; B+C's T3 still runs in full |
| QW6 | `check.yml` with `plan`, `links` and `core-data` only (no web build, no images, no Postgres) on `int/**` and `main` | Sonnet builder, owner reads `.github/` | 3 | needs nothing from LOCAL-3 or the photo cache; advisory until WF-9 |

## 7. Tasks (proposed for MASTER-ORDER lane P; not added there by this page)

| Id | Task | h | Model | Owns | Depends on | Acceptance | Proposed place |
|---|---|---|---|---|---|---|---|
| WF-0 | Owner settings of 4.6 D6, D7 and the rulesets (QW1) | 0.25 | owner | GitHub settings | Q-W6 | `gh api` shows the four values; a force push to a scratch branch protected by the same ruleset is refused | now, before A's deploy |
| WF-1 | Rules: coordinator rotation, turn cap, 40 KB reads, stopping rules, model mapping, risk tiers in the brief header | 2 | Opus planner | `.claude/agents/*.md`, TASK-BRIEF-TEMPLATE 1 and 4, HANDOVER section 2 rows | Q-W3 for the tiers | a brief written from the template has the tier, the cap and the stopping rules; the agent files name no check-all for builders | merged into TS-5, pulled into A's window |
| WF-2 | `check.yml` phase 1: `plan`, `links`, `core-data`, `summary`; `tools/ci/lint_workflows.py` and its test; `tools/ci/plan_to_outputs.py`; in `gate.py`, `GATE_RUNNER=ci` and the `--group` and `--out` flags the sketches use | 4 | Sonnet; Opus review 1 (a `.github/**` and `tools/gate/**` path) | `.github/workflows/check.yml`, `tools/ci/**`, `tools/gate/gate.py` (the runner switch), `tools/gate/map.json` (the `ci` suite), `tools/tree_contract.json` | WF-0, Q-W1 | green on `main`; a planted `pull_request_target` fails the lint; a docs-only push runs `links` only in under 3 minutes | B+C window, Internal; replaces LOCAL-4's first half |
| WF-3 | `check.yml` phase 2: `web` and `db-local` jobs; offline image mode; place-size marked Mac-only in CI; `budget:report --markdown` | 3 | Sonnet | `.github/workflows/check.yml`, `web/scripts/budget-report.mjs` (flag), `tools/gate/map.json` (`mac_only` list) | WF-2 | green on `main`; the summary lists the Mac-only suites as pending, not passed | B+C window; the rest of LOCAL-4 (LOCAL-3's drift stage joins when it lands) |
| WF-4 | `ci-summary/1` contract, `tools/ci/summarise.py`, `tools/ci/status.sh`, `scrub_check.py`, gate cache import | 3 | **Opus** (shared contract with every agent) | `tools/ci/**`, `tools/gate/cache.py` (import), tests | WF-2 | a red run prints at most 40 lines naming the suite; a summary from a `pull_request` run is refused for import; scrub fails on a planted token | B+C window |
| WF-5 | Verifier and reviewer definitions read CI (4.4, 5.6) | 1 | Opus planner | `.claude/agents/travel-verifier.md`, `travel-design-reviewer.md` | WF-4 | a verify report names the CI run and runs only the Mac-only list | B+C window, after WF-4 |
| WF-6 | `e2e.yml`: 6 Chromium shards, 2 WebKit jobs on macOS, merge, `main_moved.py`; `PW_NO_GPU` and `PW_BLOB` in the Playwright config | 4 | Sonnet; Opus review 0.5 | `.github/workflows/e2e.yml`, `web/playwright.config.ts` (two lines), `tools/ci/main_moved.py` | WF-3 | one dispatch on `main`: test count equals the Mac's minus the GPU specs; measured minutes written into 4.3 | B+C window; **replaces E2E-YML** |
| WF-7 | TS-6 narrowed: the Mac nightly runs only the Mac-only list | 1 (from TS-6's 2) | Sonnet | `tools/nightly/**` | WF-6 | the nightly summary has exactly the Mac-only suites | B+C window, in place of TS-6 |
| WF-8 | `tools/context_pack.py`, `tools/where.py`, their tests; TASK-BRIEF-TEMPLATE line "read the pack" | 6 | Sonnet 5; Opus review 1 | `tools/context_pack.py`, `tools/where.py`, `tools/tests/test_context_pack.py` | none | the pack for UXB-2 is under 10 k tokens and contains its MASTER-ORDER row, BACKLOG row and cited spec sections | B+C window, any slot |
| WF-9 | `visual.yml`, `tools/ci/contact_sheet.py`, `tools/ci/shot_diff.py`, `sweep-ci.spec.ts` and the routes file | 5 | Sonnet; Opus review 1 | `.github/workflows/visual.yml`, `tools/ci/contact_sheet.py`, `tools/ci/shot_diff.py`, `web/tests/e2e/sweep-ci.spec.ts`, `.github/sweep-routes.json` | STD-7, WF-3 | a UI stack yields one sheet per screen; a planted identical pair fails STD-7 | C's UXB rows, before their stack review |
| WF-10 | Required `check / summary` on `main` (after one green week); RELEASE-PLAN 4.1's T3 split into CI plus the Mac-only list | 1 + 0.25 owner | Sonnet (docs), owner (ruleset) | release checklist lines (by the owner of RELEASE-PLAN) | WF-3, WF-6 green for 7 days, Q-W2 | a push of an untested commit to `main` is refused | the release after B+C |
| WF-11 | Re-measure with this page's method two weeks after WF-1 and WF-4; update section 6 with measured savings | 1.5 | Haiku (counts), Opus planner (write-up 0.5) | this page, sections 2 and 6 | WF-1, WF-4 | the tables of 2.2, 2.3 and 2.5 for the new window beside the old | two weeks after WF-4 |

**Total about 32 h of agent time (reviews included) plus 0.5 h of owner time.** Order: WF-0, WF-1 (this week); WF-2, WF-8 (parallel, disjoint files);
WF-3, WF-4; WF-5, WF-6; WF-7, WF-9; WF-10; WF-11. WF-2 and WF-3 together are LOCAL-4 (5 h), resized to 7 h because they
include the gate's CI mode and the workflow lint; WF-6 replaces E2E-YML (3 h) at 4 h.

## 8. Edits other pages need (listed; not applied by this page)

| Page | Edit |
|---|---|
| [MASTER-ORDER.md](MASTER-ORDER.md) 3.3 | add WF-0 to WF-11; LOCAL-4 becomes WF-2 plus WF-3 and its "blocked: repository public" clears (it is public), LOCAL-3 and IMG-1 no longer block phase 1; E2E-YML superseded by WF-6; TS-6 narrowed by WF-7; TS-5 pulled into A's window with WF-1; 5.4 critical path unchanged (all Internal) |
| [RELEASE-PLAN.md](RELEASE-PLAN.md) 7.1, 7.2 | four workflows (4.3), not two; `e2e.yml` sharded with WebKit on macOS, not one-worker Chromium; WebKit no longer "stays on the Mac" |
| RELEASE-PLAN 7.4 | rulesets: the required `check / summary` status (Q-W2) supersedes "no required pull request or status check"; fork approval and allowed-actions rows marked "not applied as of 26 Oct" until WF-0 |
| RELEASE-PLAN 7.5 | R3 applied by moving the 14 secrets into `production-deploy` (Q-W4) |
| RELEASE-PLAN 4.1 and 6 | T3 is CI green on the named commit plus the Mac-only list plus the owner's checks; the release record names the CI run URLs |
| RELEASE-PLAN 0a.1 B2 | "design review and verifier for UI features, as today" becomes the risk tiers of 5.2 |
| [TEST-STRATEGY.md](TEST-STRATEGY.md) 8.3 | the verifier reads CI and runs the Mac-only list; the design reviewer reads sheets |
| TEST-STRATEGY 10.3, 12 | the nightly runs on GitHub; TS-6 narrowed (WF-7); T3 in 4 split into CI and Mac parts |
| [ENGINEERING-STANDARD.md](ENGINEERING-STANDARD.md) | S6.12: screenshots come from `visual.yml`; STD-6 extended with `lint_workflows.py` and `scrub_check.py`; STD-9's pre-push check may rely on the required status; S9 gains the stopping rules and the turn cap |
| [TASK-BRIEF-TEMPLATE.md](TASK-BRIEF-TEMPLATE.md) | header field `risk: R0..R4`; common block: the pack, the 40 KB read rule, the turn cap, the stopping rules, "background and wait, never poll" |
| `.claude/agents/travel-builder.md`, `travel-verifier.md`, `travel-design-reviewer.md` | WF-1 and WF-5 text |
| `CLAUDE.md` (owner) | "Every UI round ends with travel-design-reviewer, then travel-verifier" becomes "The risk tier decides review and verification (WORKFLOW-EFFICIENCY 5.2); R3 and R4 UI rounds end with the design reviewer, then the verifier" |
| `HANDOVER.md` section 2 | session-start command `tools/ci/status.sh main --nightly`; the coordinator rotation rule |

## 9. Risks, and what not to automate

| Risk | Mitigation |
|---|---|
| CI green is read as "release ready" while the Mac-only list was skipped | the summary lists `mac_only_pending` explicitly; T3 needs both; WF-10 writes it into the checklist |
| A workflow change leaks a secret or runs untrusted code | D1 to D12; the workflow lint in every push; owner reads `.github/` |
| R2 tier lets a visual regression through | the stack review still reads every changed screen's sheet; the visual diff flags unchanged-by-intent screens |
| Long-agent splits lose context and redo work | the checkpoint hand-back has a fixed shape; the pack is regenerated from the plan, not from memory |
| The gate map is wrong and CI selects too little | the nightly full e2e and the escape audit (TEST-STRATEGY 10.5) catch it within a day |
| Linux and macOS runners drift from the owner's Mac | baselines per platform; the owner's own Mac remains the judge for release screenshots of R3 and R4 screens |

**Not to automate:** deploys and release tags; anything with the real home point; any call to Commons, OSM, Wikidata or ORS;
signed-in flows on real services; the owner's go/no-go and screenshot approval; real-device and VoiceOver checks; database
migrations on the child or production branch; quarantining a test (a person decides, with a BACKLOG row); fixing a red CI by
an agent without a brief.

## 10. Owner questions

Answered by the owner on 26 Oct 2026, one at a time, all as recommended: Q-W1 (the coordinator pushes stack branches), Q-W2 (required CI check on main after one green week), Q-W3 (risk tiers replace "design review then verifier on every UI round"; the owner updates the CLAUDE.md line, the coordinator drafts it), Q-W4 (production secrets move to a production-deploy environment, owner step), Q-W5 (no photo cache seeding for now), Q-W6 (the owner applies the GitHub settings from commands the coordinator lists).

| # | Question | Recommended answer | Trade-off |
|---|---|---|---|
| Q-W1 | May the coordinator (never a worker) push `int/*` stack branches to the public origin, so CI runs before `main` moves? | **Yes** | work-in-progress branches are visible publicly for a few hours; they hold the same code that lands on `main` an hour later, and the pre-push scan (STD-6, STD-9) runs first |
| Q-W2 | After one green week, make the CI `summary` check required on `main` (owner bypass only), superseding RELEASE-PLAN 7.4's "no required status check"? | **Yes** | every merge, docs included, waits 2 to 20 minutes for CI; in return a red CI cannot reach `main` unnoticed |
| Q-W3 | Replace "every UI round ends with design review, then verifier" with the risk tiers of 5.2 (R0 to R2 lighter, R3 and R4 as today)? | **Yes** | a small UI slip is caught at the stack review, hours later, instead of per task |
| Q-W4 | Move the 14 production secrets from repository secrets to a `production-deploy` environment (main and `release/*` only, owner approval), so they stay in GitHub as you chose but no ordinary job can read them? | **Yes** | about 15 minutes of `gh secret` work; a future deploy workflow must name the environment |
| Q-W5 | Seed CI's photo cache from a release asset you upload from the Mac (76 MB of Commons thumbnails), so budgets and photo pages are checked in CI? | **No, for now.** Keep place-size and photo checks on the Mac; revisit when bundle C's photo work lands | the place-size budget stays a Mac step at T3 |
| Q-W6 | Apply the GitHub settings now (WF-0): approval for all outside collaborators' fork runs, GitHub-authored actions only with SHA pinning required, rulesets that block force push and deletion on `main` and changes to `release/*` tags (this also answers Q-S6)? | **Yes, today** | none for the current flow; the coordinator's direct pushes keep working |

## 11. Gotchas

- 97% of tokens are cache reads. Shortening output helps less than shortening agents and their opening reads.
- `gh run watch` in the foreground hits the Bash tool's 10-minute limit; always background it.
- A Playwright `blob` report is needed to merge sharded results; the `list` reporter alone cannot be merged.
- `actions/cache` saved from a `pull_request` run is readable by later runs on the same pull request only; save on `main`
  only anyway (D9).
- The scheduled nightly runs on the default branch's copy of `e2e.yml`; a change to the cron on another branch does nothing.
- `.next` is 2.1 GB with its cache: never upload it as an artifact.
- A summary from a fork's `pull_request` run must never be imported into the local gate cache (4.4).
- The decoy home point is in open ocean; a CI test that expects a real "near home" exclusion cannot pass in CI, which is why
  that audit is on the Mac list.

## Change log

| Date | Change |
|---|---|
| 2026-10-26 | WF-3 built: `web` and `db-local` jobs in `check.yml` (the db job builds `tools/db` on a base pinned by digest with `tools/ci/db_up.sh`, because a stock `postgres:18` service container has no PostGIS, roles, `neon_auth` stub or `travel_template`); `mac_only` and `ci_exclude` in `tools/gate/map.json` (M8); `budget-report.mjs --markdown`; lint rules `image`, `ports`, `cache`; `vitest_ran.py` (a skipped database test fails the job); the seed-drift stage (LOCAL-3) is pending |
| 2026-10-27 | WF-3b (fixes of the WF-3 review S1 to S8, `review-wf-3-2026-10-27.md`): `ci_exclude` entries are `{reason, row, added, expires}` and M8 requires a BACKLOG row and an expiry (at most 100 days); the five-file exclusion list is down to three whole-file dependencies plus two split-out single tests (`adapters-renditions.test.ts`, `legs-home-radius.test.ts`), so 23 more tests run in CI; `ci_skips` in the map plus `vitest_ran.py --no-skips` fail the web and db jobs on any skip the map does not allow, and the summary lists the allowed ones as owed on the Mac (`public-privacy.test.ts` PUBLIC-SCRUB checks; `localReset.test.ts` is allow-listed instead of enabled because `LOCAL_DB_RESET_TEST` drives `docker compose` on port 54329 with an unpinned base and would clash with the pinned CI database); lint rules close the 8 probes (exact `github.ref == 'refs/heads/main'` in a save `if:`, `${{ }}` images only as `env.*`, any value that names an image, `container:` short form, `ports` entries without `127.0.0.1:`, `-p`/`--publish` in `options:`) and require `package-manager-cache: false` on setup-node; the `ci-jobs` rule is `runner: ci` (the Mac's selection is unchanged); `vitest_ran.py` honours `--`; `db_up.sh` pulls the base with a 4-attempt backoff. **Known drift:** `tools/db/Dockerfile` installs `postgresql-18-postgis-3=3.6.*`, so the digest pins the base image and the PostGIS patch release floats with the PGDG repository (signed; the risk is drift, not tampering). Accepted; pin the full package version if a patch release ever breaks the db job. If Docker Hub rate limits keep failing pulls, use `mirror.gcr.io/library/postgres@<same digest>` |
| 2026-10-26 | First version: token, run and machine-time measurements for 21 to 26 Oct 2026; waste patterns W1 to W12; the CI design (four workflows, Mac-only list, CI summary contract, required check, secrets decisions D1 to D12); planning by feature (stacks, risk tiers, context pack, model mapping, length cap, screenshots, stopping rules); savings ranked; quick wins; WF-0 to WF-11; edits for other pages; Q-W1 to Q-W6 |
