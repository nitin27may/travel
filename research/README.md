# Research: the map (placeholder)

This folder is the one research home (CLEANUP-PLAN, decision D11). The folder skeleton exists; the map itself is not
written yet.

TODO for CLN-1c (the Opus authoring step; spec in `docs/v2/CLEANUP-PLAN.md` sections 2.5 to 2.8 and 5.1). Replace this
page and write:

1. `research/README.md`: the map, to the 12-section outline in CLEANUP-PLAN 2.7 (under 400 lines).
2. `research/tools.md`: every research script by its real path (CLEANUP-PLAN 2.8).
3. `research/formats/README.md` and `research/formats/templates/*` (capture record, suitability, relevance, capture-run,
   inbox batch, lane notes, run note), each JSON template validated with `node core/bin/validate.ts` or `run --check`.
4. `research/trips/README.md`: turn the verbatim summaries (moved from CLAUDE.md under D17) into the index table, one row
   per folder in `research/trips/` (13), then keep the summaries below it.
5. `docs/README.md` (two lines), and the "Running a fan-out" section of `research/method/lanes/README.md`.
6. Thin skills and agents: `.claude/skills/location/SKILL.md`, `.claude/agents/*.md` (researcher thin wrapper under 2.5 KB;
   builder and design-reviewer D6 changes), and the research rules moved into `research/README.md` section 9.
   **Not** `.claude/skills/trip-planner/` and **not** `legacy/_system/TRIP-PAGE.md`: decision D18 is still open with the
   owner, so the skill's HTML half stays where it is until D18 is answered.
7. `CLAUDE.md`: the folder-contract text of CLEANUP-PLAN 5.1, the research pointer, the "Destinations" and "Photo
   galleries" replacements, `legacy/peru/` fixed, `prototype/` out of the agents table, `docs/v2/research/capture/*`
   named as `research/types/*` (only after CLN-R). CLN-1b already replaced "Current trips" and "Queued" with a pointer.
8. `README.md` layout table (its `docs/briefs/` paragraph now points to `docs/archive/v1/briefs/`),
   `research/vault-notes/README.md` ("move under `research/`" line; `locations/` is now `data/locations/`),
   `docs/v2/design/globe/review.md` line 23, and a superseded banner on `research/method/skills-and-prompts.md` section 2.
9. Banners on the archived v1 pages in `docs/archive/v1/` if wanted.

`research/types/` is not created here: `capture.ts build` writes it after CLN-R, and nothing else may live in it.
