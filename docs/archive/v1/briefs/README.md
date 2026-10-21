# Phase briefs (platform plan, revision 4)

> **Archived 21 Oct 2026** (CLEANUP-PLAN CLN-1). Superseded by `docs/v2/PLAN.md`; kept for its ideas. Paths in this page are as they were when it was written.

One brief per phase of `docs/PLAN-platform.md` section 6. Each brief is self-contained: paste it to a coding agent with no other context. The plan stays the source of design truth; a brief says exactly what to build, in what order, and how to prove it.

P1a (code and data move) is running from the review's own checklist and has no brief. Its end state is the starting state of P1b: `tools/`, `tools/tests/`, `tools/hooks/`, `data/locations/`, `data/reference/`, `data/schema/legacy/` and `research/places/PRIORITIES.md` in place, all 109 tests green, `.site/` byte-identical; trips, `globe/`, `locations/index.html`, `locations/inbox/` and `_system/` (minus tools and tests) still at their old paths.

## Order, dependencies, models

| # | Brief | Goal | Depends on (merged to main) | Can run in parallel with | Model | Worktree |
|---|---|---|---|---|---|---|
| 1 | [P1b](P1b.md) | legacy move, `publish.py`/`hub.py`, docs | P1a | nothing | Sonnet | main checkout, branch `phase/p1b` |
| 2 | [P2a](P2a.md) | schema source (Zod), JSON Schema export, DDL, structural validator, hooks | P1b | P3a | Sonnet | `travel-wt/p2a` |
| 3 | [P3a](P3a.md) | app scaffold, theme, places in three views, `/about/data/`, privacy, publish merge | P1b | P2a, P2b | Sonnet | `travel-wt/p3a` |
| 4 | [P2b](P2b.md) | locations v3 and the inbox move, day checks, operation catalogue, read-only MCP | P2a | P3a, P3b | Sonnet | `travel-wt/p2b` |
| 5 | [P3b](P3b.md) | map view, advanced filters, saved views, `/schema/`, accessibility suites | P3a, P2a | P2b, P4a, P4b, P4c | Sonnet | `travel-wt/p3b` |
| 6 | [P4a](P4a.md) | operations core, file store, ops CLI, local API, book-by, sun | P2b | P3b | Sonnet | `travel-wt/p4a` |
| 7 | [P4b](P4b.md) | catalog ingestion, coverage, backlog, lanes, `/review/` | P4a | P3b | Sonnet | `travel-wt/p4b` |
| 8 | [P4c](P4c.md) | geocode, import the Rockies and Patagonia, data-readiness report | P4b | P3b | Sonnet; **Opus for step 4 (the two prose mapping runs)** | `travel-wt/p4c` |
| 9 | [P5a](P5a.md) | plan pages, maps, trail geometry, offline and PWA, exports, storage migration | P4c, P3b | P5b1-P5b3, P5c, P6 | Sonnet | `travel-wt/p5a` |
| 10 | [P5b1](P5b1.md) | creation flow S0-S6, drafts, undo, autosave, Download/Import | P4c, P3b | P5a, P5c, P6 | Sonnet | `travel-wt/p5b1` |
| 11 | [P5b2](P5b2.md) | day board, board map, keyboard moves, `/edit/` | P5b1 | P5a, P5c, P6 | Sonnet | `travel-wt/p5b2` |
| 12 | [P5b3](P5b3.md) | bookings and review screens, notes, custom items, search and indexes, guardrails | P5b2 | P5a, P5c, P6, P7 | Sonnet | `travel-wt/p5b3` |
| 13 | [P5c](P5c.md) | skills and agents | P5a, P4c | P5b1-P5b3, P6 | **Opus** | `travel-wt/p5c` |
| 14 | [P6](P6.md) | globe route, coverage layer, catalog lists, area pages, backlog view | P3b, P4c | P5a, P5b1-P5b3, P5c | Sonnet | `travel-wt/p6` |
| 15 | [P7](P7.md) | planner v1 and the data-readiness view | P5b2 | P5b3, P8 | Sonnet | `travel-wt/p7` |
| 16 | [P8](P8.md) | routing with breaks (Phase 1 part) | P5b3 | P7 | Sonnet | `travel-wt/p8` |

```
P1a -> P1b -> P2a -> P2b -> P4a -> P4b -> P4c -> P5a -> P5c
          \       \                          |\-> P5b1 -> P5b2 -> P5b3 -> P8
           \       \-> P3b <- P3a            |               \-> P7
            \-> P3a                          \-> P6
```

Critical path: P1b, P2a, P2b, P4a, P4b, P4c, P5b1, P5b2, P5b3, P8. P3a/P3b, P5a, P5c and P6 run beside it.

Model rule: Sonnet codes; Opus owns P5c and the model-spend step of P4c (and any model help on geocoding misses). The orchestrator launches the P4c Opus step as a separate agent with `model: "opus"` and the step text from the P4c brief.

## Owner approvals needed before each phase

| Brief | Before it starts | During or at the end |
|---|---|---|
| P1b | none (P1a's report reviewed) | review the PR; merge |
| P2a | D26 (Zod as the schema source; recommended) | review the PR |
| P3a | optional D30 (Cloudflare Web Analytics token); none blocking | review the PR including the `/places/` parity screenshots |
| P2b | none | the inbox move rewrites stored screenshot paths: confirm in the PR |
| P3b | none | review the PR |
| P4a | none | review the PR |
| P4b | none | review the PR; confirm the auto-accept policy file |
| P4c | **D29** (one Opus mapping run per trip, two in total; recommended) | run (or allow) the owner-run geocode step (Wikidata and Nominatim, about 3-5 minutes); review the geocode misses; sign off both mapping fixtures and the prose sections; review the data-readiness report |
| P5a | optional D12 (Google Maps Embed key) | run (or allow) the owner-run trail geometry fetch; review both plan pages against the legacy pages before `web_published` is set |
| P5b1 | none | review the PR |
| P5b2 | none | review the PR |
| P5b3 | none | review the PR |
| P5c | none | one review packet for all skills and agents; Patagonia's conditions routine must exist by 28 Dec 2026 |
| P6 | none | confirm the deletion of `legacy/globe/` (house rule on deletions) |
| P7 | none | review the PR |
| P8 | the owner fetches the Calgary-Banff-Lake Louise-Jasper route fixture with an ORS key (free plan) or approves the agent doing it with the key from the environment | review the PR |
| Phase 2 plan | **D28** (git-backed writes recommended) | |

## Rules every brief repeats

- Work in the brief's checkout only, with absolute paths; never `cd` (parallel shell calls share the working directory).
- Stage owned paths only (`git -C <checkout> add <paths>`), never `git add -A` or `.`; check `git -C <checkout> diff --cached --stat` before every commit (one bad pathspec stages nothing and the commit still succeeds).
- One commit per step, green, prefix `<ID> step <n>: `, trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (P5c uses the Opus trailer), push after each step.
- Rebase onto `origin/main` before the PR; `gh pr create` has no `--json` flag; the owner merges; branch and worktree cleanup only after `merged` is `true`, and only after asking.
- Tests, hooks and builds never call the network. Owner-run fetch steps are marked as such.
- No deletion of a tracked file outside `git mv` without the owner's yes.
- Kill a dev server by the PID on its port, never with `pkill -f` (another agent's server may share the name).
