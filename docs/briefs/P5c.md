# P5c: skills and agents (Opus-owned)

## Goal

Rewrite the Claude Code skills and research agents so that every trip, however it starts, runs through the new data layer: lane agents write Markdown plus a structured sidecar, the catalog pipeline proposes, the owner reviews, and the plan is assembled from operations. Each skill must name only commands that exist and must carry the house rules (one sequential Commons searcher, owner-only fares scraping, no deletions without the owner, review before applying).

Model: **Opus** writes this phase (house rule: process and prompt design are Opus work). Trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Prerequisites (state at start)

P5a and P4c merged on `main` (P5b1-P5b3 and P6 may run in parallel; they do not touch `.claude/`).

- Data: `data/trips/{canadian-rockies-sept-2029,patagonia-feb-mar-2027}/` (imported), catalog rows, `data/catalog/{coverage,backlog}.json`, `docs/reports/data-readiness-*.md`.
- Commands that exist (check each with `--help` before you name it): `node core/bin/{ops,catalog,validate,schema,import,mcp,serve}.ts`, `python3 tools/{locations,geocode,trails,publish,hub,globe_data,theme_tokens}.py`, `python3 tools/gallery/{gallery,gallery_find,gallery_pick}.py`, `pnpm --dir web build`, `node web/scripts/shots.ts`, `bash tools/check-all.sh`.
- Skills today: `.claude/skills/location/SKILL.md` (current; leave it), `.claude/skills/trip-planner/SKILL.md` (the old HTML-first process, paths updated in P1b), `.claude/skills/trip-import/SKILL.md` (P4c draft). No `.claude/agents/`.
- Spec: `docs/PLAN-platform.md` 7.1 (skills table, revised 4), 7.2 (agent roster), 7.3 (lanes), 7.4 (offer records), 7.6, 10 (re-synthesis), 11 (fares method, verbatim), 13 (conditions), 0A.2 (pipeline and auto-accept), 0A.6 (owner-only scraping).

## Files you own

`.claude/skills/{trip-planner,trip-import,trip-edit,trip-research,research-trails,trip-fares,trip-build,trip-verify,trip-publish,trip-photos,trip-conditions,catalog-review}/SKILL.md` (and any `references/` beside them), `.claude/agents/*.md` (one per lane of 7.2 plus `bookings-audit` and `plan-synthesis`), `tools/fares/tfs.py`, `tools/fares/__init__.py`, `tools/conditions.py`, `tools/links.py`, `tools/anchors.py`, `tools/tests/{test_tfs,test_conditions,test_links,test_anchors,test_skill_commands}.py` and their fixtures, the conditions-gate lines in `tools/hooks/prepublish.sh` (append), `CLAUDE.md` (the skills section).

Must not touch: `.claude/skills/location/**`, `.claude/settings.json` hook entries other than appending, `web/**`, `core/**`, `data/**`.

## Steps

### Step 0. Worktree

```bash
git -C /home/nitin27may/workspace/travel fetch origin
git -C /home/nitin27may/workspace/travel worktree add -b phase/p5c /home/nitin27may/workspace/travel-wt/p5c origin/main
pnpm --dir /home/nitin27may/workspace/travel-wt/p5c install && bash /home/nitin27may/workspace/travel-wt/p5c/tools/check-all.sh
```

### Step 1. Owner-side helper tools

- `tools/fares/tfs.py` (stdlib): encode, decode, swap the two date strings (same length), one-way builder (`08 1c 10 02` + segment + `40 01 40 01 40 02 48 01 70 01`, never the trailing `82 01 ... 98 01 01`), per plan 11.1; `tools/tests/test_tfs.py` against those bytes.
- `tools/links.py`: HEAD then GET fallback, per-host pacing, a report of broken links per page; the Rockies regression (465 URLs, 9 broken) replayed from a recorded response file in `tools/tests/fixtures/links/` (tests never hit the network).
- `tools/anchors.py`: in-page anchor check for exported HTML (every `href="#x"` has an `id="x"`).
- `tools/conditions.py check [--today <date>]`: for every trip with a chosen edition, warns from T-90 and fails from T-60 when `editions.conditions_trigger` is empty; `prepublish.sh` runs it (append). Test: Patagonia (Day 1 = 2027-02-26) passes on 2026-12-27 and fails on 2026-12-28 without a trigger.

Commit `P5c step 1: fares, links, anchors and conditions helpers`.

### Step 2. Agents

One file per lane in `.claude/agents/`: `research-overview`, `research-sights`, `research-hidden-gems`, `research-trails`, `research-adventure`, `research-relax-luxury`, `research-city-culture`, `research-road-trip`, `research-stays`, `research-timing`, `research-logistics`, `research-entry`, `research-fares`, `research-community`, plus `bookings-audit` and `plan-synthesis`. Each states: model (Sonnet for lanes; Opus for `plan-synthesis`), inputs (from 7.2), what it must cite, public sources first, and outputs: exactly `research/trips/<slug>/<lane>.md` (every claim with a URL; `GAP:` where unverified) and `<lane>.json` (`research-sidecar/1`; records in the 2.3A catalog shapes; bookings as `offers` with `offer_prices`, with `opens_kind: "unknown"` and `opens_evidence` when the window is not found); for a place not tied to a trip, `research/places/<place-id>/`. Re-runs write `<lane>-<YYYY-MM-DD>.md/.json` and never overwrite. House rules in every agent: never search Wikimedia Commons in parallel (one sequential searcher; a 429 lasted 25 minutes on 2026-10-12); never copy text from blogs or social posts into summaries (facts in our words plus the link); never write under `data/` directly; fares scraping only for the owner (`actor.id == u_owner`).

Commit `P5c step 2: lane agents, bookings audit and plan synthesis`.

### Step 3. Skills

Write each skill of plan 7.1 (revised 4) with: trigger phrases, the numbered procedure using only existing commands, what to show the owner before applying (proposal diffs, day-check warnings), what never to do, and a short "Known issues" section. Specifics:
- `trip-planner` (orchestrator): intake one question at a time; `trip.create`; `lanes.select` and its reasons shown before launch; launch the selected lane agents in one message; `bookings-audit`; `node core/bin/catalog.ts propose` and review (`catalog-review`); `plan-synthesis` produces a proposal; apply after review; then `trip-build`, `trip-verify`, `trip-conditions`.
- `trip-import`: finalise the P4c draft (a new mapping fixture is an Opus run the owner approves first, D29).
- `trip-edit`: request to operations through `node core/bin/ops.ts`; show the diff and warnings; "for everyone or only this trip" on fact changes.
- `trip-research`: re-run mode and `--backlog`.
- `research-trails`: `python3 tools/trails.py find/fetch/check`, then `catalog.edit`; owner-run network.
- `trip-fares`: plan 11.1 verbatim; owner-only.
- `trip-build`, `trip-verify` (`bash tools/check-all.sh`, links, anchors, privacy, axe on changed pages, `node web/scripts/shots.ts` tiles read zoomed), `trip-publish` (`python3 tools/publish.py`, then a live 200 check of the changed URLs), `trip-photos` (the Commons pipeline; one sequential searcher), `trip-conditions` (creates the T-2 scheduled task ending in one named verdict: `GO`, `GO, PLAN B ON DAY n`, `SWAP DAYS n AND m`, `DELAY`; stores its id in `editions.conditions_trigger` with `node core/bin/ops.ts edition.update`), `catalog-review` (duplicates first, conflicts next; the review-time check for copied text, R23).

`tools/tests/test_skill_commands.py`: extracts every command line in `.claude/skills/**/SKILL.md` and `.claude/agents/*.md` that starts with `node `, `python3 ` or `pnpm ` and runs its executable path with `--help` (or `--list` for `ops.ts`), asserting exit 0; fails on a path that does not exist.

Commit `P5c step 3: skills for the data-first workflow`.

### Step 4. CLAUDE.md and the conditions routine reminder

`CLAUDE.md`: replace the old "Use the trip-planner skill" paragraph with the new skills table (one line each) and the folder layout pointer; keep every trip description. Add to the PR body: Patagonia's conditions routine must exist by 28 Dec 2026 (T-60); if P5c merges later, the owner creates it by hand with `trip-conditions`.

Commit `P5c step 4: CLAUDE.md points at the new skills`.

### Step 5. Review packet and PR

```bash
W=/home/nitin27may/workspace/travel-wt/p5c
python3 -m pytest $W/tools/tests -q && bash $W/tools/check-all.sh
git -C $W fetch origin && git -C $W rebase origin/main
git -C $W push --force-with-lease -u origin phase/p5c
gh pr create --repo nitin27may/travel --base main --head phase/p5c --title "P5c: skills and agents for the data-first workflow" --body-file /tmp/p5c-pr.md
```

The PR body is one review packet for the owner: a table of skills and agents (name, trigger, model, the one rule most likely to matter), and a dry run of `trip-planner` on a toy request ("a weekend in Algonquin in October") showing the lane selection and the commands it would run, without running agents.

## Acceptance criteria

1. `tools/tests/test_skill_commands.py` passes: every named command exists and answers `--help`.
2. Every agent file names its two outputs, the sidecar schema, and the Commons rule; `trip-photos` carries the Commons rule.
3. `test_tfs.py`, `test_links.py` (recorded), `test_anchors.py`, `test_conditions.py` pass; the conditions gate fails Patagonia from 2026-12-28 without a trigger.
4. `bash tools/check-all.sh` ends with `CHECK-ALL OK`.
5. The owner signs off the review packet.

## Pitfalls

1. A skill that names a command that does not exist is worse than no skill; the command test is the guard.
2. Do not copy the plan into skills; point at commands and the few rules the agent must hold in mind.
3. One sequential Commons searcher, always; never parallel photo agents.
4. Fares scraping is owner-only and never offered through the app, API or MCP.
5. Network-calling helpers are owner-run; their tests use recorded responses.
6. Never `cd`; never `git add -A`.

## Commit and push rules

- Checkout `/home/nitin27may/workspace/travel-wt/p5c`, branch `phase/p5c`.
- `git -C /home/nitin27may/workspace/travel-wt/p5c add <owned paths>` only; never `git add -A`, `.` or `commit -a`; check `git -C /home/nitin27may/workspace/travel-wt/p5c diff --cached --stat` before each commit.
- One commit per step, green; message `P5c step <n>: <summary>`, body, trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (this phase is written by Opus; if a Sonnet agent runs it instead, use `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`).
- Push after each step: `git -C /home/nitin27may/workspace/travel-wt/p5c push -u origin phase/p5c`.
- `gh pr create` (no `--json`), body ending with the attribution line your harness specifies; the owner merges.

## Report back

Commit hashes; the skills and agents table; the command test output; the dry-run transcript; any command the skills need that does not exist yet (list it for a follow-up; do not build it here).
