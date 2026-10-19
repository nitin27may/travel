# CS7d: data batch 4 for the preview (stage 4)

- **Agent:** `travel-researcher` (Opus).
- **Effort:** about 14 h, in two batches.
- **Rows:**
  - 3.55 and 3.58 (duplicate pairs, empty-shell targets)
  - 3.47 (the remaining held-back tracks)
  - 3.35 (three Rockies stop points)
  - 3.9 (seasons for the 6 trips showing "season not set yet")
  - 3.10 (34 dated texts as relative wording)
  - 3.53 (the remainder: the checks that block `usable` for anchors and trip stops)
  - 3.50 (anything CS7c left)
  - 4.15 (Kids content for the lakes most visitors search first)
- **Plan:** [STAGE4-plan.md](../STAGE4-plan.md).
- **Lane notes:** `docs/v2/research/lanes/CS7d-notes.md` (new). Read `CS7c-notes.md` first.
- **Principles:** T1, T3, T4, T5, P8. **A gap is never a yes.**
- **Starts:** when D2 has merged (it carries CS7c).
- **Merges:** batch A before PLC's final shots; batch B before LST's final shots.
- **Review:** no design review. `travel-verifier` (Sonnet) checks samples in stage 5 check 5.3.

## Goal

The data the preview shows is honest, de-duplicated and as complete as the sources allow:
- one record per real place;
- every trip has a season;
- no dated prose;
- every trip stop has a point;
- the anchors and trip stops pass the basics of `usable`.

## Read first

- [research/capture-contract.md](../../../research/capture-contract.md) (9.7 supersede override), `research/suitability.md`, `research/relevance.md`.
- `node core/bin/capture.ts fields --type <id>` for every type you touch, and `capture.ts gaps --trip <trip>`.
- `CS7c-notes.md`, `research/capture-research-backlog.md`, `research/operator-questions-2026-10-18.md`.
- BACKLOG 3.9, 3.10, 3.35, 3.47 (as D2 leaves it), 3.50, 3.53, 3.55, 3.58 and 4.15.

## Files you own

`data/capture/**`, `data/suitability/**`, `data/relevance/**` (sidecars, `inputs/points.json`, and derived files via `relevance.ts derive`), `data/sources/**`, the data files under `data/tracks/**` (not `web/scripts/tracks-osm.mjs`), `docs/v2/research/lanes/CS7d-notes.md`, `docs/v2/research/operator-questions-2026-10-18.md`, `research/capture-research-backlog.md`.

## Do not touch

- `web/**` and `core/**`. If the adapter needs a change, write it in the notes for PLC, TRP or LST.
- `data/schedules/**` (TRP).
- `data/vocab/**` (a type change is requested, not made).
- `data/trips/base-points.json` (GLB).
- `legacy/**` is read only, except where 3.10 needs a source rewrite. In that case, list the file and stop; the coordinator decides whether a legacy plan is edited.

## Steps

Batch A, for PLC:

1. **Duplicates (3.55, 3.58).** Mark each pair with `same_place_as` on the second record:
   - Radium Hot Springs;
   - Red Rock Parkway;
   - the Lake Louise gondola and sightseeing;
   - canmore-nordic-centre-summer and canmore-nordic-centre-provincial-park;
   - banff-horseback-rides and brewster-stables-lake-louise-horseback.

   Keep the first record as the survivor; move any value the second holds that the first lacks, with its source; keep the ledger rule (no pre-migration leaf lost).
2. **Empty shells (3.58).** For each page PLC lists as a shell (the Banff horseback page first): fill the basics from an operator or official page, or record `searched_none` with the date. **Never fill from memory.**
3. **Rockies stop points (3.35).** Three stops with no coordinates: points from OSM or Wikidata, never Google, sequential under the `flock` locks with the no-email UA, and the source recorded.

Batch B, for LST and the preview:

4. **Seasons (3.9)** for the six trips that show "season not set yet". Use the plan's own months, or the main sights' access seasons; say which.
5. **Dated texts (3.10).** Find the 34 texts the dateless rule drops: where they live, and which file feeds the adapter. Rewrite each as relative wording ("two weeks before", "in late September") in the data that feeds the adapter. List any that live in adapter code for TRP.
6. **Usable basics (3.53).** For the anchors and the trip stops of the public trips: the summary, season and point checks first, then re-run derive and report the new level distribution.
7. **Held-back tracks (3.47).** Nuvolau, Braies, Fanes, Monte Piana, Viel dal Pan, Lagazuoi and Siusi: confirm the OSM relation or segment, or a destination point, through the Overpass lock. What cannot be confirmed stays held back, with the reason.
8. **Kids for lakes (4.15).** For the 12 lakes on public trips: stroller access, walk from the car, toilets and an age band where a source says so. The point is that the first-use walk task 1 ("a family-friendly lake walk in Canada, and how to park for it") can be answered from data.
9. **3.50 leftovers.** If any "search result, not opened" or "written from memory" source line remains after CS7c, open the page or drop the fact.

## Acceptance checks

| # | Check |
|---|---|
| 1 | `bash tools/check-all.sh` passes, with every capture, suitability and relevance check and `derive --check` |
| 2 | Each duplicate pair has one survivor, and the migration ledger test is green |
| 3 | No value without a source; no Google, AllTrails, Tripadvisor or Komoot value; every gap is `searched_none` with a date, or left empty |
| 4 | Every Rockies stop has a point; every public trip has a season |
| 5 | `capture.ts gaps` shows fewer blocking gaps for the anchors and trip stops than before, with the counts in the notes |
| 6 | No household data in any file you wrote |

## Commit rules

- **Worktree:** `/home/nitin27may/workspace/travel-wt/v2-CS7d`, branch `public/CS7d`.
- **Commits:** one commit per step, `data(CS7d): ... (<row>)`. The lane notes go in a `docs(v2):` commit. Batch A and batch B are separate hand-backs, so the coordinator can merge A early.
- Stage owned paths with `git -C <worktree> add <paths>`, never `-A`. Co-Authored-By trailer from your harness. Do not push.

## Hand-back (per batch)

- the commits;
- the counts (pairs merged, shells filled or searched-none, points added, seasons set, texts rewritten);
- the new research level distribution;
- any adapter request for PLC, TRP or LST;
- new operator questions.
