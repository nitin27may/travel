# P2b: locations v3 and the inbox move, day checks, operation catalogue, read-only MCP

## Goal

Move the locations store to schema v3 (shared tag vocabulary, catalog columns on places, screenshots under `research/inbox/`) without losing an id or changing a WISHLIST heading, and finish the two deferred P1 items. Add the day checks with named warning codes, the operation catalogue that every API and MCP surface is generated from, and a read-only stdio MCP server so Claude Code can query the data.

## Prerequisites (state at start)

P2a merged on `main` (P3a may be running or merged; it does not affect you).

- `core/` exists: Zod schemas in `core/src/schema/` (trip, catalog, locations v2, sidecars), `core/src/validate/` with the `E_*` codes of plan 2.4, `core/bin/schema.ts generate [--check]` writing `data/schema/generated/{schema.json,schema.sql}`, `core/bin/validate.ts`, fixtures in `core/test/fixtures/{root,valid,broken}`.
- `tools/check-all.sh` runs every suite; `tools/hooks/{data_changed,schema_changed,locations_changed,prepublish}.sh` are registered.
- `data/locations/locations.json` is v2 (64 places). `locations/inbox/` still exists at the repo root (deferred from P1). `tools/location_views.py:199-200` still writes the old strings "Generated from `locations/locations.json`" and "`python3 _system/tools/locations.py add`" into `data/locations/WISHLIST.md` and `legacy/locations/index.html`.
- Read `docs/PLAN-platform.md` 2.3A ("Locations v3"), 2.4 (the `W_*` table), 2.1 (zone rule), 5.3, 5.7, 5.8, 0A.2 (operations), 1.2 (the inbox row).

## Files you own

`tools/locations.py`, `tools/location_views.py`, `tools/migrate_locations_v3.py` (new), `tools/tests/test_locations.py`, `test_location_views.py`, `test_locations_split.py`, `test_site_outputs.py`, `test_migrate_v3.py` (new), `tools/tests/fixtures/locations-v2.json` (new, frozen copy of today's store); `data/locations/**`, `data/vocab/tags.json` (new); the move `locations/inbox` to `research/inbox`; `.claude/skills/location/SKILL.md`; `core/src/schema/locations.ts`, `core/src/checks/**`, `core/src/ops/catalogue.ts`, `core/bin/mcp.ts`, `core/test/checks/**`, `core/test/mcp/**`, `core/test/fixtures/warn/**`, `core/test/parity/**`; append-only: `core/bin/schema.ts` (add the `ops.json` output), `core/package.json` (one dependency), `data/schema/generated/**` (regenerated), `.mcp.json` (new), `tools/check-all.sh`.

Must not touch: `web/**`, `legacy/**` except the regenerated `legacy/locations/index.html`, `core/src/validate/**` except adding the v3 locations family, `docs/**`.

## Steps

### Step 0. Worktree

```bash
git -C /home/nitin27may/workspace/travel fetch origin
git -C /home/nitin27may/workspace/travel worktree add -b phase/p2b /home/nitin27may/workspace/travel-wt/p2b origin/main
pnpm --dir /home/nitin27may/workspace/travel-wt/p2b install
bash /home/nitin27may/workspace/travel-wt/p2b/tools/check-all.sh       # expect: CHECK-ALL OK; note the pytest count N0
```

`W=/home/nitin27may/workspace/travel-wt/p2b`. If your session's hooks point at the main checkout, run `python3 <W>/tools/locations.py validate` yourself after every store change.

### Step 1. Inbox move and the generated strings

- `git -C <W> mv locations/inbox research/inbox` (the `locations/` folder is then empty and disappears).
- `tools/locations.py`: the screenshot rule (around line 1267: "screenshot must be a path under ...") and the `--screenshot` help text (around lines 1386 and 1412) say `research/inbox/`; the docstring example `import locations/inbox/batch.json` becomes `research/inbox/batch.json`.
- Rewrite stored values: every `sources.screenshot` starting with `locations/inbox/` becomes `research/inbox/...` (do it with the tool's own load and save so the store keeps its one-row-per-line format; add a `migrate-inbox` subcommand or do it inside the v3 migration in step 2, but then make step 1 green by running it here).
- Tests: the five assertions (`test_locations.py` near lines 157, 160, 165, 404; `test_location_views.py` near line 143) and `test_site_outputs.py` near line 31 say `research/inbox/`.
- `tools/location_views.py:199-200`: "Generated from `data/locations/locations.json` on ... add with `python3 tools/locations.py add ...` or the `location` skill."
- Rebuild in the same commit: `python3 <W>/tools/locations.py build` (rewrites `data/locations/WISHLIST.md`, `legacy/locations/index.html`, `legacy/globe/assets/data/places.json`).
- `.claude/skills/location/SKILL.md`: `locations/inbox/` to `research/inbox/` (lines 35 and 52-53 today).

```bash
grep -rn 'locations/inbox' /home/nitin27may/workspace/travel-wt/p2b --include=*.py --include=*.md --include=*.json --include=*.sh | grep -v '/docs/'   # expect: no output
python3 -m pytest /home/nitin27may/workspace/travel-wt/p2b/tools/tests -q       # expect: N0 passed
python3 /home/nitin27may/workspace/travel-wt/p2b/tools/locations.py validate && python3 /home/nitin27may/workspace/travel-wt/p2b/tools/locations.py build --check
```

Commit `P2b step 1: inbox moves to research/inbox; generated strings name the new paths`.

### Step 2. Locations v3

- `tools/tests/fixtures/locations-v2.json`: a frozen copy of `data/locations/locations.json` as it is after step 1 (the fixture for the migration test).
- `data/vocab/tags.json`: `{"schema_version": 1, "tags": [{"id", "label", "kind", "alias_of"}]}` built from the store's `tags` table; `kind` is `style` for the 11 style ids of plan 2.6 (`adventure`, `active-nature`, `scenic-relaxed`, `luxury-relax`, `relax`, `city-culture`, `road-trip`, `family`, `romantic`, `hidden-gems`, `mixed`; `luxury` is an alias of `luxury-relax`), otherwise `activity`, `feature`, `audience` or `free` (list your assignment in the report).
- `tools/migrate_locations_v3.py` (stdlib, like `migrate_locations_v2.py`): `--check` writes nothing and prints what would change; a run converts v2 to v3 (plan 2.3A "Locations v3": the `tags` table leaves the store for `data/vocab/tags.json`; `places` gains the listed columns with the listed defaults; `schema_version` 3); a second run prints "already v3" and changes nothing.
- `tools/locations.py` and `tools/location_views.py`: read and write v3 (tags from `data/vocab/tags.json`; new place columns in `COLUMNS`; `add` and `edit` set `updated` and append `u_owner` to `contributed_by`); views unchanged in output except what the columns require (none in the WISHLIST layout).
- `core/src/schema/locations.ts`: v3 (keep the v2 schema exported as `locationsV2` for the migration fixture); regenerate `data/schema/generated/`.
- `tools/tests/test_migrate_v3.py`: counts and ids equal between the v2 fixture and the migrated result; every v2 id present; tags equal to the vocabulary file; defaults set; idempotence; `--check` writes nothing; the WISHLIST rendered from v2 and from v3 has the same headings (`#`, `##`, `###` lines) in the same order.
- Run the migration on the real store in this step and commit the migrated `data/locations/locations.json`, `data/vocab/tags.json`, rebuilt `WISHLIST.md`, list page and globe pins.

```bash
python3 /home/nitin27may/workspace/travel-wt/p2b/tools/migrate_locations_v3.py --check; echo "rc=$?"
python3 /home/nitin27may/workspace/travel-wt/p2b/tools/migrate_locations_v3.py && python3 /home/nitin27may/workspace/travel-wt/p2b/tools/migrate_locations_v3.py   # expect: second run "already v3"
python3 /home/nitin27may/workspace/travel-wt/p2b/tools/locations.py validate && python3 /home/nitin27may/workspace/travel-wt/p2b/tools/locations.py build --check
node /home/nitin27may/workspace/travel-wt/p2b/core/bin/schema.ts generate --check
python3 -m pytest /home/nitin27may/workspace/travel-wt/p2b/tools/tests -q        # expect: at least N0 passed, 0 failed
```

Commit `P2b step 2: locations schema v3 with the shared tag vocabulary`.

### Step 3. The place parity test

`core/test/parity/places.test.ts`: for the real store and for `core/test/fixtures/locations/{valid,broken}/*.json` (add at least one broken fixture per locations rule that both implementations check: missing area, unknown tag, lat without lon, duplicate id, bad screenshot path, unknown kind), run `node core/bin/validate.ts <file>` and `python3 tools/locations.py validate` against a tmp root holding that file (use `LOCATIONS_ROOT` or the tool's `Paths` override) and assert the same verdict (both pass or both fail). This is the one parity pair the plan keeps (plan 1.5).

Commit `P2b step 3: place validation parity between core and locations.py`.

### Step 4. Day checks

`core/src/checks/`: `checkDays(trip, ctx)` returning warnings with the `W_*` codes of plan 2.4, per day and per track (whole-group items merged into each track's timeline). `ctx` injects what later phases supply: `resolveDate(dayN)`, `sun(dayN, lat, lon, tz) -> {sunrise, sunset}`, `bookBy(tripBooking) -> offset | null`, and catalog lookups. P2b ships a stub `sun` (fixed 07:00 and 19:00) and a stub `bookBy` (returns the stored offset) used by tests; P4a plugs in the real ones. Implement the 2.1 zone rule (`W_TZ_MISSING`). `node core/bin/validate.ts` prints warnings after errors as `WARN W_PACE data/trips/x/trip.json#/days/8: ...`; warnings never change the exit code.

Fixtures `core/test/fixtures/warn/<CODE>.json`, one per `W_*` code (including `W_FIT_UNKNOWN`), each a valid trip with one condition that triggers its code; plus the plan 2.7 A example (Patagonia Day 8), which must produce `W_PACE` on Track A (680 min against 540) and nothing else; `core/test/checks/codes.test.ts` asserts the fixture list equals the declared `W_*` codes.

`data_changed.sh` prints the warning summary (count per code) after a successful validation, exit 0.

Commit `P2b step 4: day checks with named warning codes`.

### Step 5. Operation catalogue

`core/src/ops/catalogue.ts`: one entry per operation of plan 5.3, 5.8 and 0A.2 (`schema.*`, `ops.*`, `rows.query`, `trip.*`, `place.*`, `tag.*`, `edition.*`, `base.set`, `day.*`, `item.*`, `track.set`, `trail.*`, `trip_activity.set`, `trip_booking.*`, `hazard.upsert` and the other row upserts, `fare.*`, `research.*`, `proposal.*`, `note.*`, `custom_item.*`, `route.*`, `search.*`, `catalog.*`, `backlog.*`, `planner.draft`, `inbox.*`): `{name, summary, kind: "read" | "write", phase: 1 | 2, tables, input: <Zod schema built from the entity schemas>, output, mcp?: {tool, phase}}`. Every write input includes the envelope `{actor: {id, via}, client_op_id?, expected_rev?}`; an input without `actor` fails validation. `core/bin/schema.ts generate` also writes `data/schema/generated/ops.json` (sorted by name; input and output as JSON Schema). Tests: every name is unique; every MCP tool name of plan 5.7 and 5.8 is present with the stated phase; a write without `actor` is rejected; `generate --check` covers `ops.json`.

Commit `P2b step 5: operation catalogue exported to ops.json`.

### Step 6. Read-only stdio MCP server

`core/bin/mcp.ts` with `@modelcontextprotocol/sdk@1.32.1` (stdio transport): registers every catalogue entry whose `mcp.phase` is 1 and `kind` is `read`, plus `validate_trip`, generated from the catalogue (description = summary, `inputSchema` = the exported JSON Schema of the input). Implement: `list_entity_types`, `get_entity_schema` (from `schema.json`), `list_operations`, `describe_operation`, `query_rows` (filter grammar of plan 4.2 as JSON over trips, places and catalog files), `get_trip` (`resolve: false` only until P4a; with `resolve: true` return an error "resolve arrives with P4a"), `get_place`, `get_trail`, `search` (name and alias substring across entities), `list_due_bookings` (empty until trips exist), `validate_trip` (stored slug or candidate JSON; returns errors and warnings), `get_coverage` and `list_backlog` (read their files when present, else empty). Root from `--root` or the server file's location.
`.mcp.json` at the repo root: `{"mcpServers": {"travel": {"command": "node", "args": ["core/bin/mcp.ts"]}}}`.
`core/test/mcp/server.test.ts`: spawn the server with the SDK client against the fixture root; list tools (snapshot of names); every registered `inputSchema` is byte-equal to the one in `ops.json`; call `get_place` and `validate_trip` with a broken fixture.

```bash
pnpm --dir /home/nitin27may/workspace/travel-wt/p2b/core test         # expect: all passed
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"t","version":"0"}}}' | node /home/nitin27may/workspace/travel-wt/p2b/core/bin/mcp.ts --root /home/nitin27may/workspace/travel-wt/p2b | head -1   # expect: a JSON-RPC result line
```

Commit `P2b step 6: read-only stdio MCP server and .mcp.json`.

### Step 7. PR

```bash
git -C /home/nitin27may/workspace/travel-wt/p2b fetch origin && git -C /home/nitin27may/workspace/travel-wt/p2b rebase origin/main
pnpm --dir /home/nitin27may/workspace/travel-wt/p2b install && bash /home/nitin27may/workspace/travel-wt/p2b/tools/check-all.sh   # expect: CHECK-ALL OK
git -C /home/nitin27may/workspace/travel-wt/p2b push --force-with-lease -u origin phase/p2b
gh pr create --repo nitin27may/travel --base main --head phase/p2b --title "P2b: locations v3, inbox move, day checks, ops catalogue, MCP" --body-file /tmp/p2b-pr.md
```

State in the PR body that stored screenshot paths were rewritten (the owner confirms).

## Acceptance criteria

1. `migrate_locations_v3.py --check` writes nothing; a second run is a no-op; all 64 v2 ids are present after migration; WISHLIST headings unchanged.
2. `grep -rn 'locations/inbox'` over code, tests, skills and data prints nothing; `research/inbox/` exists with the moved files.
3. The two generated strings name `data/locations/locations.json` and `python3 tools/locations.py add`; `build --check` passes.
4. One fixture per `W_*` code; the Patagonia Day 8 example yields exactly `W_PACE`.
5. Place parity test passes on the store and every locations fixture.
6. `ops.json` is generated and checked; an operation without `actor` is rejected.
7. The MCP server lists the Phase 1 read tools and `validate_trip`, with schemas byte-equal to `ops.json`.
8. `bash tools/check-all.sh` ends with `CHECK-ALL OK`; the pytest count is at least N0.

## Tests to add

`tools/tests/test_migrate_v3.py`; updated `tools/tests/test_locations*.py`, `test_location_views.py`, `test_site_outputs.py`; `core/test/parity/places.test.ts`; `core/test/checks/**`; `core/test/fixtures/warn/**`; `core/test/fixtures/locations/**`; `core/test/ops/catalogue.test.ts`; `core/test/mcp/server.test.ts`.

## Pitfalls

1. The inbox rule is a behaviour change: rule, five assertions, one site-output assertion, skill text and stored values move together in one commit.
2. v2 places already have `kind`, `status` (the owner's wishlist status) and `trip`; do not add or rename them. The catalog lifecycle column on places is `review_status`.
3. Keep the store's one-row-per-line layout; use the tool's own `dumps`, never `json.dump` with an indent.
4. The split layout (one part per country above 300 places) must keep working in v3; `test_locations_split.py` covers it.
5. `W_DAYLIGHT` and `W_DEADLINE` use injected providers; do not write a sun or book-by algorithm here (P4a).
6. Run the hooks' commands yourself in the worktree; the session's registered hooks may point at the main checkout.
7. `tools/` stays stdlib-only.
8. Never `cd`; never `git add -A`.

## Commit and push rules

- Checkout `/home/nitin27may/workspace/travel-wt/p2b`, branch `phase/p2b`.
- `git -C /home/nitin27may/workspace/travel-wt/p2b add <owned paths>` only; never `git add -A`, `.` or `commit -a`; check `git -C /home/nitin27may/workspace/travel-wt/p2b diff --cached --stat` before each commit.
- One commit per step, green; message `P2b step <n>: <summary>`, body, trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Push after each step: `git -C /home/nitin27may/workspace/travel-wt/p2b push -u origin phase/p2b`.
- `gh pr create` (no `--json`), body ending with the attribution line your harness specifies; the owner merges.

## Report back

Commit hashes; pytest count before and after; `core` test count; the tag-kind assignment table; number of screenshot paths rewritten; the `W_*` fixture list; the MCP tool list; anything in the plan you found ambiguous.
