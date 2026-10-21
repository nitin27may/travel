# P4c: geocode, import the Canadian Rockies and Patagonia, data-readiness report

## Goal

Turn the two best-researched trips into the first real data: catalog rows (places, trails, activities, stays, offers with price snapshots) and two `trip.json` files, all through the ingestion pipeline and operations, with every Rockies row geocoded or explicitly marked. Then measure what two well-researched regions actually look like (coverage and a data-readiness report) so the coverage targets and the planner are calibrated on facts, not guesses.

## Prerequisites (state at start)

P4b merged on `main` (P3b may be running in parallel; it only touches `web/`).

- `core/`: schemas, validator, day checks, operations runner (`node core/bin/ops.ts`), book-by, sun, edition resolution, the catalog pipeline (`node core/bin/catalog.ts normalise|match|propose|apply|freshness|coverage|backlog`), `catalog.*` operations, research index and lanes, the local API (`node core/bin/serve.ts`) and `/review/` in the app.
- Inputs (read only): `legacy/canadian-rockies-sept-2029/data/{sights,trails,adventures.merged,bookings,bases,itinerary}.json` (48 sights, 62 trails, 43 adventures, 33 bookings, 16 bases; **no row has coordinates**; trails carry a `trailhead` name; difficulty is `easy`, `moderate` or `hard`; distances in km and `mi`), `legacy/canadian-rockies-sept-2029/PLAN.md` (day sections `### Day N, ...` with three tracks), `research/trips/canadian-rockies-sept-2029/*.md`; `legacy/patagonia-feb-mar-2027/PLAN.md` (pipe tables under `## Trails`, `## Bookings and deadlines`, `## Adventures`, `## Budget`, `## Night split`, `## Day by day`; lists under `## Hazards`, `## Gotchas`), `research/trips/patagonia-feb-mar-2027/*.md` (8 files including `sun.md`).
- `tools/locations.py` has the Wikidata-then-Nominatim resolver (one request a second, User-Agent set).
- Spec: `docs/PLAN-platform.md` 0A.1-0A.3, 1.4, 2.1-2.4, 2.3A, 2.7, 5.4, 10.1, 4.10 (legacy storage keys; this phase writes the mapping file).

## Owner approvals before you start

- **D29**: two Opus runs (one per trip) for step 4. Do not start step 4 without the owner's yes in the conversation.
- Step 1 makes network calls (Wikidata, Nominatim). The owner runs it, or tells you to run it.

## Files you own

`tools/geocode.py`, `tools/tests/test_geocode.py`, `tools/tests/fixtures/geocode/**`; `research/trips/canadian-rockies-sept-2029/{geocode.json,geocode-report.md}`; `research/trips/{canadian-rockies-sept-2029,patagonia-feb-mar-2027}/{tables.json,mapping.json}` and the sidecars the import writes there; `core/src/import/**`, `core/bin/import.ts`, `core/test/import/**`; `data/trips/{canadian-rockies-sept-2029,patagonia-feb-mar-2027}/**` (including `legacy-keys.json`); catalog rows in `data/catalog/**` and places in `data/locations/` for both regions, written only through operations and `tools/locations.py`; `data/catalog/{coverage,backlog}.json`, `data/catalog/changes/*.jsonl`, `data/catalog/proposals/*.json`; `docs/reports/data-readiness-<date>.md`; `.claude/skills/trip-import/SKILL.md` (working draft); append-only `tools/check-all.sh`.

Must not touch: `web/**`, `legacy/**` (inputs are read only), `core/src/{schema,validate,ops,store,catalog}/**` (report needed changes), other trips.

## Steps

### Step 0. Worktree

```bash
git -C /home/nitin27may/workspace/travel fetch origin
git -C /home/nitin27may/workspace/travel worktree add -b phase/p4c /home/nitin27may/workspace/travel-wt/p4c origin/main
pnpm --dir /home/nitin27may/workspace/travel-wt/p4c install && bash /home/nitin27may/workspace/travel-wt/p4c/tools/check-all.sh
```

### Step 1. Geocode the Rockies (owner-run network step)

`tools/geocode.py` (stdlib; imports the resolver from `tools/locations.py`): `python3 tools/geocode.py rockies --out research/trips/canadian-rockies-sept-2029/geocode.json [--offline]` builds one query per row: sights by `name` plus `park` and "Alberta" or "British Columbia" (from `jurisdiction`), trails by `trailhead` plus `park`, bases by `name` plus `park_or_area`; one request a second, cached under `tools/.cache/geocode/`; writes `{id, kind, query, lat, lon, source: wikidata|nominatim|null, confidence: high|medium|none, candidates: [...]}` per row, sorted by id; `geocode-report.md` lists every row with `confidence` below `high` and every miss. `--offline` uses only the cache (tests). `tools/tests/test_geocode.py` runs against recorded responses in `tools/tests/fixtures/geocode/`, never the network.

```bash
python3 /home/nitin27may/workspace/travel-wt/p4c/tools/geocode.py rockies --out /home/nitin27may/workspace/travel-wt/p4c/research/trips/canadian-rockies-sept-2029/geocode.json   # network, about 3-5 minutes for 126 rows
python3 -m pytest /home/nitin27may/workspace/travel-wt/p4c/tools/tests -q
```

The owner reviews the misses in `geocode-report.md`. A miss may be fixed by the owner (or, with the owner's yes under D29, by an Opus agent reading the research files) by editing `geocode.json` with a `source: manual` entry; anything still unresolved is imported as `review_status: raw` with `W_NO_COORDS`, never invented.

Commit `P4c step 1: geocode the Rockies rows` (code, tests, fixtures, `geocode.json`, report).

### Step 2. Table extraction by code

`core/src/import/rockies.ts`: reads the five JSON files plus `geocode.json` and writes sidecars (`research-sidecar/1`) under `research/trips/canadian-rockies-sept-2029/`: `sights.json` records to `places` (kind from the row, area from the park), `trails.json` to `trails` (`mi` dropped after checking it against km within 2%; difficulty mapped to the house grade with the effort rule; `trailhead_*` from the geocode; `family_alternative_id` kept for the trip side), `adventures.merged.json` to `activities` plus `offers` and `offer_prices` (`price_cad_2026` as a snapshot with `basis_year: 2026`; `min_age`, `min_height_cm`, `max_weight_kg` as limits; `book_url`), `bookings.json` to `offers` (window text kept in `opens_rule`; `opens_kind: unknown` unless the text states a rule the parser can read, with `opens_evidence`), `bases.json` to `stays` where a property is named, else area-level notes.
`core/src/import/patagonia-tables.ts`: parses the pipe tables of PLAN.md sections Trails, Bookings and deadlines, Adventures, Budget and Night split into `research/trips/patagonia-feb-mar-2027/tables.json` and sidecars of the same shape.
`core/test/import/counts.test.ts`: Rockies: 48 places, 62 trails, 43 activities, 33 offers from bookings (plus the activity offers), 16 base rows accounted for (stay or note), each with its source row id; Patagonia: for each parsed section the record count equals the number of data rows the test's own independent parser counts in that section of PLAN.md (count table lines that start with `|`, minus header and separator rows, per table).

Commit `P4c step 2: table extraction for both trips`.

### Step 3. Catalog ingestion

Run the pipeline over the step 2 sidecars, review, apply:

```bash
W=/home/nitin27may/workspace/travel-wt/p4c
node $W/core/bin/catalog.ts propose --sidecars $W/research/trips/canadian-rockies-sept-2029 --root $W
node $W/core/bin/catalog.ts propose --sidecars $W/research/trips/patagonia-feb-mar-2027 --root $W
```

Auto-accepted changes apply as `proposed`/`stated`. Possible duplicates and conflicts go to the owner through `/review/` (start `node $W/core/bin/serve.ts --root $W` and a `pnpm --dir $W/web dev` with `NEXT_PUBLIC_EDITING=local`, or the owner uses `node core/bin/catalog.ts apply --proposal <id> --changes <ids>`). Places are written through `tools/locations.py add` (the ops CLI delegates `place.*`), never by editing the store. Then re-run both `propose` commands: they must produce empty proposals (idempotence).

```bash
node $W/core/bin/validate.ts --all --root $W; echo "rc=$?"        # expect: rc=0
python3 $W/tools/locations.py validate && python3 $W/tools/locations.py build --check
```

Commit `P4c step 3: catalog rows for the Rockies and Patagonia`.

### Step 4. Prose mapping (Opus; one run per trip; needs D29)

This step is run by an **Opus** agent launched by the orchestrator with `model: "opus"`, once per trip, with this instruction (fill in the slug):

> Read `legacy/<slug>/PLAN.md` and every file in `research/trips/<slug>/`. Using only facts stated there, write `research/trips/<slug>/mapping.json` with: `days` (one per day section, with `n`, `title`, `kind`, `summary`, `base_id`, `flexible_group`, `decision_rules`, `plan_b_title`, `plan_b_text`, `sun_note`, `day_of_links`), `day_tracks`, `items` (per day and track, in order, each referencing catalog ids from `data/catalog/**` and `data/locations/` where the row exists, with times only where the plan states them), `bases` (with IANA `tz`), `trip`, `profile` and `editions` values the plan states, `hazards`, `gotchas`, `knowledge` (from "State of knowledge"), `questions` (from "Open questions"), and `prose` (the answer-first, orientation and each day's narrative as Markdown files to write under `prose/`, wording unchanged). Mark anything you infer `confidence: inference` with a note; never invent a fact, time or price. List every sentence you could not place in `unmapped` with its section. Do not write any other file.

Sonnet then reviews the fixture mechanically (step 5 validates it) and the owner signs it off in the PR. Record the run (model, date, tokens if shown) in the PR body.

Commit `P4c step 4: reviewed prose mapping fixtures for both trips` (the two `mapping.json` files only).

### Step 5. Build the trips through operations

`core/src/import/trip.ts` and `core/bin/import.ts <slug>`: from `mapping.json` plus the catalog ids, emit a `trip.import` proposal (plan 5.4) under `data/trips/<slug>/proposals/`, then apply it with `proposal.apply`, which runs `trip.create`, `edition.add`, `base.set`, `day.add`, `track.set`, `item.add`, `trail.link`, `trip_activity.set`, `trip_booking.upsert`, `hazard.upsert` and the rest. `unmapped` sentences become `knowledge` rows with `status: gap`. Prose files are written under `data/trips/<slug>/prose/`. The legacy `PLAN.md` is copied (not moved) to `research/trips/<slug>/PLAN.md`. Every day-check warning is fixed in the mapping or accepted in `days.accepted_warnings` with a reason in the PR body. `trip.visibility` is `public`, `web_published` is `false` (P5a sets it after the owner's review). Also write `data/trips/<slug>/legacy-keys.json`: every checkbox id on `legacy/<slug>/index.html` (`input[data-k]` and `[data-ck]`) mapped to the new packing, document or booking id (plan 4.10), or to `null` with a reason.

```bash
node $W/core/bin/import.ts canadian-rockies-sept-2029 --root $W && node $W/core/bin/import.ts patagonia-feb-mar-2027 --root $W
node $W/core/bin/validate.ts $W/data/trips/canadian-rockies-sept-2029/trip.json $W/data/trips/patagonia-feb-mar-2027/trip.json --root $W   # expect: no ERROR lines; every WARN accepted
echo '{"slug":"patagonia-feb-mar-2027","edition":"e2027","resolve":true}' | node $W/core/bin/ops.ts trip.get --input - --root $W --json | grep -c '2026-10-31\|2026-11-30'   # expect: at least 2
node $W/core/bin/import.ts patagonia-feb-mar-2027 --root $W --check     # expect: "no changes" (idempotent)
```

Commit `P4c step 5: trip.json for both trips through operations`.

### Step 6. Coverage, backlog and the data-readiness report

```bash
node $W/core/bin/catalog.ts freshness --date 2026-10-17 --root $W
node $W/core/bin/catalog.ts coverage --date 2026-10-17 --root $W
node $W/core/bin/catalog.ts backlog --date 2026-10-17 --root $W
```

Write `docs/reports/data-readiness-<date>.md`: for Banff, Lake Louise, Jasper, Kananaskis, El Chalten, Ushuaia, El Calafate: counts per type with freshness, the provisional score and band, and what planner v2 would need that is missing (rows with `duration_min`, rows with weekday hours, eateries, area guides, legs between the top places and the stays, rows without coordinates). End with a proposed calibration row for the table at the end of plan 0A.3 (the owner decides; do not edit the plan).

Commit `P4c step 6: coverage, backlog and the data-readiness report`.

### Step 7. Skill draft and PR

`.claude/skills/trip-import/SKILL.md` (working draft; P5c finalises): when to use, the commands of steps 1-6 in order, the D29 rule (a new mapping fixture is an Opus run the owner approves), and the review points.

```bash
git -C $W fetch origin && git -C $W rebase origin/main
pnpm --dir $W install && bash $W/tools/check-all.sh
git -C $W push --force-with-lease -u origin phase/p4c
gh pr create --repo nitin27may/travel --base main --head phase/p4c --title "P4c: geocode and import the Rockies and Patagonia" --body-file /tmp/p4c-pr.md
```

The PR body is one review packet: counts table, geocode misses, the accepted warnings with reasons, the five rows most worth the owner's check, the `unmapped` lists, and the report link.

## Acceptance criteria

1. Every Rockies source row (48 + 62 + 43 + 33 + 16) is in the catalog or the trip, or in a listed exclusion with a reason (the counts test).
2. Every Rockies row has coordinates or is `raw` with `W_NO_COORDS` and listed in `geocode-report.md`.
3. Patagonia record counts per parsed section equal the test parser's counts; the prose sections are in `prose/` or `knowledge` rows and the owner signs them off.
4. Both trips validate with zero errors; every warning is fixed or accepted with a reason.
5. Patagonia book-by offsets -118 and -88 resolve to 2026-10-31 and 2026-11-30 for the 2027-02-26 edition.
6. Re-running propose and import is a no-op.
7. `coverage.json`, `backlog.json` and the data-readiness report exist for the seven areas.
8. `bash tools/check-all.sh` ends with `CHECK-ALL OK`.

## Tests to add

`tools/tests/test_geocode.py` (recorded responses), `core/test/import/{counts,rockies,patagonia-tables,trip,idempotent,legacy-keys}.test.ts`.

## Pitfalls

1. Tests never touch the network; the geocoder has an `--offline` cache mode for them.
2. Never invent coordinates, times or prices; a miss stays a miss (`raw`, `W_NO_COORDS`).
3. `adventures.merged.json`, not `adventures.json`, is what the Rockies page uses.
4. Places go through `tools/locations.py`; catalog rows through `catalog.apply`; trips through `proposal.apply`. No hand edits under `data/`.
5. Prices are 2026 snapshots used as a pattern: `basis_year: 2026`, read date from the research file.
6. Time zones (bases need an IANA `tz`): Banff, Lake Louise, Jasper and Kananaskis are `America/Edmonton`; Yoho (Field, BC) keeps Mountain Time, so also `America/Edmonton`; Mount Robson (Day 6, BC) is on Pacific Time as far as we know (`America/Vancouver`; verify from a source and record it), so items there need `items.tz`; Patagonia bases are `America/Argentina/Ushuaia`, `America/Argentina/Rio_Gallegos` (El Calafate and El Chalten) and `America/Argentina/Buenos_Aires`; the Toronto departure day uses `America/Toronto`. Record the source of each zone in the mapping.
7. The Opus step is the only model spend; a second run needs the owner's yes.
8. The legacy pages stay live and unchanged; this phase reads them only.
9. Never `cd`; never `git add -A`; kill dev servers by PID.

## Commit and push rules

- Checkout `/home/nitin27may/workspace/travel-wt/p4c`, branch `phase/p4c`.
- `git -C /home/nitin27may/workspace/travel-wt/p4c add <owned paths>` only; never `git add -A`, `.` or `commit -a`; check `git -C /home/nitin27may/workspace/travel-wt/p4c diff --cached --stat` before each commit.
- One commit per step, green; message `P4c step <n>: <summary>`, body, trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (the step 4 commit made by the Opus agent uses `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`).
- Push after each step: `git -C /home/nitin27may/workspace/travel-wt/p4c push -u origin phase/p4c`.
- `gh pr create` (no `--json`), body ending with the attribution line your harness specifies; the owner merges.

## Report back

Commit hashes; the counts table; geocode results (high, medium, none); accepted warnings; the two `unmapped` counts; coverage per area; the proposed calibration row; the Opus runs (date, model, approximate size).
