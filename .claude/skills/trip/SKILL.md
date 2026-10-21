---
name: trip
description: Plan, research or revise a trip in ~/workspace/travel as DATA - the research fan-out for a destination, capture records and sidecars, the trip file and its schedule, validation and the gap report. Use when Nitin asks to plan a trip, revise or extend one, compare trip shapes, or "start the X trip". The web app renders the result; this skill never writes HTML.
---

# Trip: plan a trip as data

Not this skill: remembering a place (`location`); filling gaps or refreshing facts outside a plan (`research`); changing how a page looks (a `web/` change: `docs/v2/PLAN.md` 4.1). Never edit `legacy/`; it is frozen (`docs/v2/SKILLS-AND-DATA-ONLY.md` 6).

## Steps
1. Read `research/README.md` 3b and 9. Give a new trip its row in `research/trips/README.md` first; its id names `research/trips/<id>/` and `data/*/<id>/`.
2. Treat the draft as a hypothesis (rule zero, `research/README.md` 9).
3. Trip type and lane depth: `research/method/trip-types.md`.
4. Fan-out: `research/method/lanes/README.md` "Running a fan-out". Media is one sequential runner, never parallel.
5. Outputs per lane: `research/formats/README.md`.
6. Validate: `research/README.md` 6, then `node core/bin/capture.ts gaps --trip <id>`.
7. Trip file and schedule: `data/trips/README.md`. Write through `node core/bin/ops.ts` (never by hand); check with `node core/bin/validate.ts data/trips/<id>/trip.json` and `node core/bin/schedule.ts`.
8. Photos and cover: `research/README.md` 3e.
9. Conditions check before departure: `research/README.md` 3f.
10. Review: `pnpm --dir web dev`, open `/trips/<id>/`; `travel-verifier` shoots 1440 and 390, light and dark.
11. Merge: `research/README.md` 8, after `bash tools/check-all.sh`.

## Who runs what
Lanes: `travel-researcher` (Opus; Sonnet for a lane that only fills a clear contract; Haiku for link checks and photo finding). Synthesis, step 7: `travel-planner` (Opus). Checks: `travel-verifier` (Sonnet).

## The reply
Lead with what changed from the draft and why. Give times, distances and capacities, never "arrive early". State physical risks plainly. Put hours gotchas in a table. Mark what you added that was not asked for. End with what is verified, what is a gap, and what to confirm nearer the date.
