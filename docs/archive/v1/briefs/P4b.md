# P4b: catalog ingestion, coverage, backlog, lanes, review queue

## Goal

Build the one ingestion path that turns research sidecars into catalog rows: normalise, match, merge, propose, review, apply, with provenance and the auto-accept policy. Add freshness, coverage and the research backlog, the research index and lane selection, and a local `/review/` page so the P4c imports, and every later research run, feed the catalog the same way.

## Prerequisites (state at start)

P4a merged on `main` (P3b may be running in parallel).

- `core/`: schemas (catalog tables of plan 2.3A with the common block, `review_status`, `confidence`, `field_meta`, `contributed_by`, `licence`, `merged_from`; sidecar `research-sidecar/1`), the validator, day checks, `core/src/ops/` runner with `FileStore`/`MemoryStore`, `core/bin/{ops,serve,validate,schema,mcp}.ts`, the operation catalogue (with `catalog.*`, `backlog.*`, `research.*`, `lanes.select` entries).
- `data/catalog/policy.json` (auto-accept rules, revised: new rows land `proposed`/`stated`), `data/schema/freshness.json`, `data/schema/difficulty-map.json`, `data/vocab/tags.json`, `data/locations/` v3; catalog folders empty.
- `web/` (P3a, maybe P3b): Next.js app with `EntityPage`, `NEXT_PUBLIC_EDITING` not yet used.
- Spec: `docs/PLAN-platform.md` 0A.2 (pipeline, auto-accept), 0A.3 (coverage, backlog, priority floor), 3A (difficulty normalisation), 7.3 (lane selection and the Patagonia worked example), 10.1-10.2 (sidecars, index, dedupe), 4.11 (`/review/`).

## Files you own

`core/src/catalog/**`, `core/src/research/**`, `core/src/lanes/**`, `core/bin/catalog.ts`, `core/test/catalog/**`, `core/test/research/**`, `core/test/lanes/**`, `core/test/fixtures/sidecars/**`, `tools/hooks/research_changed.sh`; `web/app/review/**`, `web/components/review/**`, `web/tests/e2e/review.spec.ts`; append-only: `core/src/ops/catalogue.ts`, `.claude/settings.json` (one hook entry), `tools/check-all.sh`, `web/app/layout.tsx` (no nav link: `/review/` is owner-only and unlisted).

Must not touch: `data/catalog/**` rows (P4c fills them; your tests use tmp roots), `data/trips/**`, `tools/*.py`, `web/` outside the review folders, `core/src/{schema,validate,ops/run.ts,store}/**`.

## Steps

### Step 0. Worktree

```bash
git -C /home/nitin27may/workspace/travel fetch origin
git -C /home/nitin27may/workspace/travel worktree add -b phase/p4b /home/nitin27may/workspace/travel-wt/p4b origin/main
pnpm --dir /home/nitin27may/workspace/travel-wt/p4b install && bash /home/nitin27may/workspace/travel-wt/p4b/tools/check-all.sh
```

### Step 1. Normalise

`core/src/catalog/normalise.ts`: sidecar `records` to catalog-shaped rows: units to metric (mi to km at 1.609344, ft to m), currencies kept with ISO codes, enums mapped (an explicit table, for example the Rockies' `guided_hike` to `guided-hike`; unknown values become `other` with a warning, never dropped), tags through `data/vocab/tags.json` (aliases resolved, unknown tags reported), local difficulty to the house grade with `data/schema/difficulty-map.json` and the effort rule of plan 3A (`effort_km = km + gain_m / 100`; house = max(technical, effort); `effort-only` when no local grade), dates to ISO, ids proposed from the area hierarchy (`<area_id>/<slug>`; trails and places use the place-style path; legs `lg-<10 hex>` of sha256 of `from_id|to_id|mode`).
Tests with fixtures in `core/test/fixtures/sidecars/`: the three worked examples of plan 3A (Laguna de los Tres 4, Laguna Capri 3, Senda Costera 2), unit conversion, enum mapping, tag aliasing, id proposal, leg id.

Commit `P4b step 1: normalise`.

### Step 2. Match and merge

- `match.ts` in the order of plan 0A.2 step 3: exact id; external ids (wikidata, OSM relation, operator `book_url` host plus path); coordinates within 300 m plus trigram name similarity at least 0.85 for places, stays, eateries; trailhead within 500 m plus name for trails; provider plus product name for offers. 0.6 to 0.85 is "possible duplicate" (always review). Rows without coordinates match only by id or external id.
- `merge.ts` per field: a newer read date with an equal or better source kind (`official` > `operator` > `press` > `reseller` > `blog` > `community`) replaces; an older or weaker value goes to `field_meta.<field>.alternatives`; equal strength and different value becomes `confidence: conflict` for that field.
Tests: a deliberately duplicated place (same name, 120 m apart) is "same entity"; "Mirador" against "Mirador Fitz Roy" 2 km apart is not merged; a 0.7 similarity pair is a possible duplicate; merge precedence by kind and by date; conflict marking.

Commit `P4b step 2: match and merge`.

### Step 3. Propose, review, apply and the catalog operations

- `propose.ts`: from merged records, a proposal `{id, created, actor, source: {sidecar, lane}, changes: [{change_id, op, entity, id, before, after, sources, fact_keys, auto: bool, reason}]}` stored at `data/catalog/proposals/<id>.json`; `auto` per `data/catalog/policy.json`: new rows with at least one `official` or `operator` source, no possible duplicate, all required fields: auto-accepted **as `review_status: proposed`, `confidence: stated`** (never `verified`); new price snapshots and links: auto; filling a null field: auto when the source is `operator` or better; anything else: review.
- Operations (register in the catalogue, implement through the P4a runner): `catalog.add`, `catalog.edit`, `catalog.merge` (keeps the surviving id, records `merged_from`), `catalog.retire` (never deletes a row), `catalog.verify` (sets `review_status: verified`, `verified_by`, `last_verified`; also the two-official-sources promotion rule), `catalog.propose` (read: returns the proposal and writes it under `proposals/`), `catalog.apply` (`proposal_id`, `change_ids?`): writes rows into `data/catalog/<entity>/<CC>.json`, appends `data/catalog/changes/YYYY-MM.jsonl` rows (`seq`, `at`, `actor_id`, `actor_via`, `entity`, `id`, `op`, `before`, `after`, `reason`, `proposal_id`, `sources`), sets `contributed_by`.
- `core/bin/catalog.ts <normalise|match|propose|apply|freshness|coverage|backlog> ...`.
Tests: re-running the same sidecars after apply yields an empty proposal (idempotent); auto-accept never sets `verified`; `catalog.retire` keeps the row; a merge is reversible from `catalog_changes`.

Commit `P4b step 3: proposals, auto-accept policy and catalog operations`.

### Step 4. Freshness, coverage, backlog

- `freshness.ts`: applies `data/schema/freshness.json` for a given date; a row with an expired field becomes `review_status: stale`; deterministic for a given date.
- `coverage.ts`: per area (rolled up to region and country) the per-type score and total of plan 0A.3 with the provisional targets and weights (read them from one config object exported as `PROVISIONAL_TARGETS`, so P4c's calibration changes one place), bands thin, usable, good; style re-weights; writes `data/catalog/coverage.json` (sorted, deterministic per date).
- `backlog.ts`: items from GAP fields, `confidence: gap`, staleness, thin types and conflicts; id `bl-<hash>` stable for the same subject and reason; `priority = max(1, trips_using) * urgency * severity`; keeps owner-added rows; writes `data/catalog/backlog.json`.
Tests: fixture catalog with known counts gives known scores; the floor keeps an unused area's items above zero; ids stable across runs.

Commit `P4b step 4: freshness, coverage and backlog`.

### Step 5. Research index, dedupe, lane selection, hook

- `core/src/research/`: `research.index` writes `research/INDEX.json` (one row per sidecar: path, lane, subject, researched, geo, styles, tags, counts, GAP count; deterministic); `research.dedupe` uses the step 2 matcher.
- `core/src/lanes/`: `lanes.select(trip)` per plan 7.3 with a reason per lane. Test: the Patagonia worked example (active-nature, adventure, family; multi-week; multi-base; AR; `lanes_skip: ["city-culture"]`) selects exactly overview, sights, trails, adventure, stays, timing, logistics, entry, fares, community; a day trip keeps only the day-trip set.
- `tools/hooks/research_changed.sh` (PostToolUse): on `*/research/*.json` run `node "$ROOT/core/bin/validate.ts" "$path"` (the sidecar family); exit 2 on errors. Register it in `.claude/settings.json` (append).

Commit `P4b step 5: research index, dedupe, lane selection and the sidecar hook`.

### Step 6. `/review/`

`web/app/review/page.tsx` (one static page, client-side): with `NEXT_PUBLIC_EDITING=local` it reads proposals from the local API (`GET /api/v1/catalog/proposals`, add the route to `core/bin/serve.ts` only if it is missing; if you must touch `serve.ts`, keep the change append-only), groups changes by area and entity, shows each change's diff (before and after per field), sources and reason, possible duplicates first, then conflicts, then the rest; actions accept, reject, edit-then-accept (calls `catalog.apply` with `change_ids`); with `off` it shows "Review runs on the owner's machine". `web/tests/e2e/review.spec.ts` starts `node core/bin/serve.ts` on a free port against a tmp root with a fixture proposal, accepts one change, rejects one, and checks the files.

Commit `P4b step 6: local review queue`.

### Step 7. PR

```bash
git -C /home/nitin27may/workspace/travel-wt/p4b fetch origin && git -C /home/nitin27may/workspace/travel-wt/p4b rebase origin/main
pnpm --dir /home/nitin27may/workspace/travel-wt/p4b install && bash /home/nitin27may/workspace/travel-wt/p4b/tools/check-all.sh
git -C /home/nitin27may/workspace/travel-wt/p4b push --force-with-lease -u origin phase/p4b
gh pr create --repo nitin27may/travel --base main --head phase/p4b --title "P4b: catalog ingestion, coverage, backlog, review queue" --body-file /tmp/p4b-pr.md
```

## Acceptance criteria

1. Unit tests for normalise, match, merge, propose, apply, freshness, coverage, backlog, index, dedupe and lanes pass with named fixtures.
2. A duplicated place is detected; re-running the same sidecars is a no-op proposal.
3. Auto-accepted rows are never `verified`; `catalog.verify` and the two-official-sources rule are the only ways in.
4. Priority is never zero for an open backlog item.
5. The Patagonia lane example selects exactly the ten lanes listed.
6. `/review/` accept and reject round trip passes in Playwright.
7. `bash tools/check-all.sh` ends with `CHECK-ALL OK`.

## Tests to add

`core/test/catalog/{normalise,match,merge,propose,apply,freshness,coverage,backlog}.test.ts`, `core/test/research/{index,dedupe}.test.ts`, `core/test/lanes/select.test.ts`, `core/test/fixtures/sidecars/**`, `web/tests/e2e/review.spec.ts`.

## Pitfalls

1. One implementation only: there is no Python `catalog.py` and no "TS twin".
2. Never write `verified` from an agent path (plan 0A.2, revised).
3. Deletion is `catalog.retire`; the data hook refuses row removals in `data/catalog/`.
4. Coverage targets are provisional; keep them in one exported object so P4c can calibrate them.
5. File names from ids replace `/` with `__`; ids never contain `__`.
6. Tests never touch the network or the real `data/catalog/` (tmp roots only).
7. Never `cd`; never `git add -A`; kill test servers by PID.

## Commit and push rules

- Checkout `/home/nitin27may/workspace/travel-wt/p4b`, branch `phase/p4b`.
- `git -C /home/nitin27may/workspace/travel-wt/p4b add <owned paths>` only; never `git add -A`, `.` or `commit -a`; check `git -C /home/nitin27may/workspace/travel-wt/p4b diff --cached --stat` before each commit.
- One commit per step, green; message `P4b step <n>: <summary>`, body, trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Push after each step: `git -C /home/nitin27may/workspace/travel-wt/p4b push -u origin phase/p4b`.
- `gh pr create` (no `--json`), body ending with the attribution line your harness specifies; the owner merges.

## Report back

Commit hashes; test counts; the enum mapping table; match thresholds as implemented; the Patagonia lane result with reasons; anything in policy or freshness files you think should change (do not change them).
