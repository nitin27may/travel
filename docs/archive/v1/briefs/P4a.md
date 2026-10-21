# P4a: operations core, file store, ops CLI, local API, book-by, sun

## Goal

Implement the operations that every write path uses (CLI, local API, the browser board, later MCP and the Worker) as pure TypeScript functions over a storage adapter, with changelog rows, warnings and an inverse for undo. Add the computed book-by dates and sun times that the day checks and plan pages need, so trips can be created and edited through operations alone.

## Prerequisites (state at start)

P2b merged on `main` (P3b may be running in parallel; it only touches `web/`).

- `core/`: Zod schemas (trip, catalog, locations v3, sidecars), the structural validator (`E_*`), day checks (`W_*`, `core/src/checks/`, with injected `sun` and `bookBy` providers stubbed), `core/src/ops/catalogue.ts` (every operation's name, input and output schemas, kind, phase, MCP tool), `data/schema/generated/{schema.json,schema.sql,ops.json}`, `core/bin/{schema,validate,mcp}.ts`.
- `data/locations/` v3, `data/vocab/tags.json`, empty `data/catalog/*/`, no `data/trips/` yet.
- `legacy/patagonia-feb-mar-2027/sun-times.py` (NOAA-style formula) produced `research/trips/patagonia-feb-mar-2027/sun.md`; `legacy/iceland-ring-road/sun-times.py` and `dark-times.py` produced Iceland's tables.
- Spec: `docs/PLAN-platform.md` 5.1-5.4, 5.8 (operations), 2.3 (book-by table, `trip_bookings`), 2.4 (codes), 0B.2 (undo via inverse), 4.7 (message format).

## Files you own

`core/src/ops/**` except `catalogue.ts` (append entries only if an operation you implement is missing), `core/src/store/**` (`FileStore`, `MemoryStore`, `Store` interface), `core/src/bookings/**`, `core/src/sun/**`, `core/src/derive/**` (resolving an edition: dates, weekdays, ages, book-by dates, sun), `core/bin/ops.ts`, `core/bin/serve.ts`, `core/test/ops/**`, `core/test/sun/**`, `core/test/bookings/**`, `core/test/fixtures/trips/**`; wiring the real providers into `core/src/checks/` (replace the stubs' default, keep the injection); append-only `tools/check-all.sh`, `CLAUDE.md` (one line).

Must not touch: `web/**`, `tools/*.py`, `data/**` (tests use fixtures and tmp roots), `core/src/schema/**` (ask in the report if a schema change is needed), `core/src/validate/**`.

## Steps

### Step 0. Worktree

```bash
git -C /home/nitin27may/workspace/travel fetch origin
git -C /home/nitin27may/workspace/travel worktree add -b phase/p4a /home/nitin27may/workspace/travel-wt/p4a origin/main
pnpm --dir /home/nitin27may/workspace/travel-wt/p4a install && bash /home/nitin27may/workspace/travel-wt/p4a/tools/check-all.sh   # expect: CHECK-ALL OK
```

### Step 1. Sun times

`core/src/sun/`: a port of the NOAA-style function in `legacy/patagonia-feb-mar-2027/sun-times.py` (fractional year, equation of time, declination, hour angle for zenith 90.833 sunrise and sunset, 96 civil, 102 nautical, 108 astronomical), plus solar azimuth and elevation at a time; returns times as minutes in the IANA zone given (use `Intl.DateTimeFormat` to get the offset for that date, so daylight saving is handled), with explicit results for "never rises" and "never sets".
Tests: `core/test/sun/patagonia.test.ts` reproduces every cell of the table in `research/trips/patagonia-feb-mar-2027/sun.md` (four places by three dates; take the coordinates from the Python script) within 1 minute; `core/test/sun/iceland.test.ts` reproduces Iceland's darkness rows from the tables written by `legacy/iceland-ring-road/dark-times.py` (read the research file it produced; within 1 minute or the same "no darkness" result); a high-latitude midsummer case returns "never sets".

Commit `P4a step 1: sun times ported from the trip scripts`.

### Step 2. Book-by and edition resolution

`core/src/bookings/bookBy.ts`: the table of plan 2.3 ("Recommended book-by, computed") from the offer's window fields and the booking's `used_days`; returns `{offset, deadline_date?, basis, gap}`. `core/src/derive/edition.ts`: for a trip and an edition id, day dates and weekdays, traveller ages at the edition, each booking's resolved date and derived state (`not-yet-open`, `open`, `urgent`, `booked`, `sold-out`) for a given "today".
Wire `sun` and `bookBy` into `core/src/checks/` as the default providers (the stubs stay available for tests).
Tests: every row of the book-by table; the Patagonia case: for an edition with `start: 2027-02-26`, offsets -118 and -88 resolve to Sat 31 Oct 2026 and Mon 30 Nov 2026; `unknown` windows give the conservative default with `gap: true`; `W_DAYLIGHT` now uses the real sun (the plan 2.7 A example passes daylight on 5 Mar: 07:15 + 9 h ends 16:15, before the 20:38 sunset).

Commit `P4a step 2: book-by and edition resolution; real providers in the day checks`.

### Step 3. Store adapters and the operation runner

- `core/src/store/`: `Store` (`read(path)`, `write(path, bytes, expectedRev?)`, `rev(path)` = sha256 of the bytes, `list(prefix)`), `FileStore(root)` (atomic writes: temp file then rename; refuses paths outside `data/`), `MemoryStore` (tests and the browser draft).
- `core/src/ops/run.ts`: `runOp(store, name, input) -> {ok, changed, warnings, changelog_seq, inverse}`: validates the input against the catalogue's Zod schema (an input without `actor` fails), loads the affected files, applies the operation's pure function, validates the result with the structural validator (any `E_*` aborts with `ok: false` and writes nothing), runs the day checks, appends one `changelog` row (`seq`, `at`, `actor_id`, `actor_via`, `op`, `summary`, `refs`), writes with the trip writer (2.2 key order, rows sorted by primary key, one row per line), and returns the inverse operation that restores the previous bytes. `client_op_id`: a repeated id within the trip's changelog returns the original result without writing. `expected_rev` mismatch: `{ok: false, code: "E_STALE", rev}`.
Tests: a write without `actor` fails; a failing validation writes nothing; inverse restores the exact bytes; replaying a `client_op_id` is a no-op; `E_STALE` on a stale rev.

Commit `P4a step 3: store adapters and the operation runner`.

### Steps 4 and 5. The trip operations (step 4: trip, edition, base, day, item, track, trail operations; step 5: activities, bookings, rows, notes, custom items, routes, research refs, proposals, reads)

Implement, each as a pure function with a fixture test (`core/test/ops/<name>.test.ts`: apply to a fixture trip in `MemoryStore`, compare the result file to an expected fixture, check changelog row, warnings and inverse): `trip.create`, `trip.update`, `trip.copy` (new ids, references only, no private data, no booking statuses, no edition), `trip.adopt_place` (delegates the place write to `python3 tools/locations.py edit <id> --trip <slug> --status planned` through a `PlaceBackend` interface; the test uses a fake backend), `edition.add`, `edition.update` (any edition field, for example `conditions_trigger`), `edition.choose`, `base.set` (validates cover), `day.add`, `day.update`, `day.swap` (renumbers items), `day.remove`, `item.add`, `item.update`, `item.move` (keeps `seq` contiguous on both days), `item.remove`, `item.pin`, `item.unpin`, `track.set`, `trail.link`, `trip_activity.set`, `trip_booking.upsert` (recomputes book-by unless `book_by_basis = owner`), `trip_booking.set_status`, `hazard.upsert`, `weather_rule.upsert`, `budget.upsert`, `document.upsert`, `emergency.upsert`, `question.add`, `question.answer`, `knowledge.add`, `gotcha.add`, `fare.add_window`, `fare.add_quote`, `note.add`, `note.update`, `note.remove`, `custom_item.add`, `custom_item.update`, `route.set`, `research.add_ref`, `proposal.apply`, `proposal.reject` (proposals stored under `data/trips/<slug>/proposals/<id>.json`; applying runs the listed operations in order and stops at the first failure with nothing written). Read operations: `trip.get` (with `resolve` through `core/src/derive/`), `rows.query`, `bookings.due`, `search`.
Also enable `get_trip` with `resolve: true` in the MCP server (one-line change in `core/bin/mcp.ts`, append-only).

Commits: `P4a step 4: trip, day and item operations`, then `P4a step 5: bookings, rows, notes, proposals, reads`; each green.

### Step 6. CLI and local API

- `core/bin/ops.ts <name> --input <file or -> [--root <dir>] [--json]`: runs one operation against `FileStore(root)` (root defaults to the repo root two levels up), prints the result (`--json` for machines), exit 1 when `ok` is false. `node core/bin/ops.ts --list` prints the catalogue.
- `core/bin/serve.ts [--port 4319] [--root <dir>]`: localhost-only HTTP server (Node `http`, no framework): `POST /api/v1/ops/<name>` with the JSON input, `GET /api/v1/trips/<slug>?resolve=1`, `GET /api/v1/health`; binds `127.0.0.1` only; CORS allows `http://localhost:*` only.
- `core/test/ops/paths.test.ts`: the same sequence of five operations through the CLI (spawned) and through the local API (spawned on a free port, killed by PID at the end) against two copies of a fixture root produces byte-identical files.

```bash
pnpm --dir /home/nitin27may/workspace/travel-wt/p4a/core test       # expect: all passed
echo '{"actor":{"id":"u_owner","via":"cli"},"trip":{"slug":"demo-trip"}}' | node /home/nitin27may/workspace/travel-wt/p4a/core/bin/ops.ts trip.create --input - --root /tmp/p4a-root --json; echo "rc=$?"   # use a tmp root with a copy of data/locations; expect ok or a precise E_* message
bash /home/nitin27may/workspace/travel-wt/p4a/tools/check-all.sh   # expect: CHECK-ALL OK
```

Commit `P4a step 6: ops CLI and local API server`.

### Step 7. PR

```bash
git -C /home/nitin27may/workspace/travel-wt/p4a fetch origin && git -C /home/nitin27may/workspace/travel-wt/p4a rebase origin/main
pnpm --dir /home/nitin27may/workspace/travel-wt/p4a install && bash /home/nitin27may/workspace/travel-wt/p4a/tools/check-all.sh
git -C /home/nitin27may/workspace/travel-wt/p4a push --force-with-lease -u origin phase/p4a
gh pr create --repo nitin27may/travel --base main --head phase/p4a --title "P4a: operations core, file store, CLI, local API, book-by, sun" --body-file /tmp/p4a-pr.md
```

## Acceptance criteria

1. Every listed operation has a fixture test asserting the file, the changelog row, the warnings and that the inverse restores the original bytes.
2. CLI and local API produce byte-identical files for the same sequence.
3. Patagonia offsets -118 and -88 resolve to 2026-10-31 (Saturday) and 2026-11-30 (Monday) for the 2027-02-26 edition.
4. Sun times match every cell of `research/trips/patagonia-feb-mar-2027/sun.md` within 1 minute.
5. `client_op_id` replay is a no-op; stale `expected_rev` gives `E_STALE`; an operation without `actor` is rejected; a result with any `E_*` writes nothing.
6. `bash tools/check-all.sh` ends with `CHECK-ALL OK`.

## Tests to add

`core/test/sun/{patagonia,iceland,polar}.test.ts`, `core/test/bookings/bookBy.test.ts`, `core/test/derive/edition.test.ts`, `core/test/ops/*.test.ts` (one per operation plus `run`, `paths`), `core/test/fixtures/trips/**`.

## Pitfalls

1. Operations are pure: `(dataset, input, actor) -> {next, changelog, warnings, inverse}`. No file system or clock inside them; the runner passes `now`.
2. The trip writer must produce stable bytes (2.2 key order, sorted rows, one row per line); the CLI and API test depends on it.
3. `place.*` writes stay in Python (`tools/locations.py`); go through the `PlaceBackend` interface and never write `data/locations/` from TypeScript.
4. Time zones: use the IANA zone of the base (plan 2.1 zone rule), never a fixed offset; Patagonia is UTC-3 all year, Toronto changes.
5. `FileStore` refuses writes outside `data/`.
6. The local server binds `127.0.0.1` only; kill it by PID in tests.
7. Never `cd`; never `git add -A`.

## Commit and push rules

- Checkout `/home/nitin27may/workspace/travel-wt/p4a`, branch `phase/p4a`.
- `git -C /home/nitin27may/workspace/travel-wt/p4a add <owned paths>` only; never `git add -A`, `.` or `commit -a`; check `git -C /home/nitin27may/workspace/travel-wt/p4a diff --cached --stat` before each commit.
- One commit per step, green; message `P4a step <n>: <summary>`, body, trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Push after each step: `git -C /home/nitin27may/workspace/travel-wt/p4a push -u origin phase/p4a`.
- `gh pr create` (no `--json`), body ending with the attribution line your harness specifies; the owner merges.

## Report back

Commit hashes; test counts; the operation list with test status; the sun comparison table (expected, got, difference); any schema change you needed and did not make.
