# P2a: schema source, JSON Schema export, DDL, structural validator, hooks

## Goal

Create the `core/` TypeScript package and write the one schema source for `trip.json`, the catalog, research sidecars and locations in Zod 4, exporting a committed JSON Schema and a SQLite/D1 DDL from it. Add the structural validator with named error codes, the hooks that run it on every data write, and the local gate script, so every later phase builds on one validated shape.

## Prerequisites (state at start)

P1b is merged on `main`. Layout (repo `/home/nitin27may/workspace/travel`):

- `tools/` Python, stdlib only: `locations.py`, `location_views.py`, `migrate_locations_v2.py`, `globe_data.py`, `publish.py`, `hub.py`, `gallery/`, `hooks/{locations_changed.sh,prepublish.sh}`, `tests/` (109 tests plus `test_publish.py`).
- `data/locations/{locations.json,WISHLIST.md,README.md}` (schema v2, 64 places), `data/reference/countries.json`, `data/schema/legacy/locations_schema.sql`.
- `legacy/` (15 trip folders, `_system/`, `globe/`, `locations/index.html`, `MANIFEST.json`), `research/trips/<slug>/`, `research/places/`, `locations/inbox/` (moves in P2b), `docs/`.
- Root `package.json` and `pnpm-workspace.yaml` (packages `core` and `web`) exist as a skeleton from P1b; no `core/`, no `web/` (P3a may be creating `web/` in parallel). Node 22.23.2 and pnpm 12.4.1 are installed; Node runs `.ts` files directly (type stripping).

Read first, fully: `docs/PLAN-platform.md` sections 1.5 (runtimes), 2.1 to 2.5 (the canonical tables, rule codes and the Zod decision), 0A.1 (freshness table), 0A.2 (auto-accept table), 3A (difficulty mapping and storage), 0B.5 (route sidecar), 10.1 (sidecar). This brief does not repeat the columns; the plan is the column spec.

## Files you own

Create: `core/**` (`package.json`, `tsconfig.json`, `vitest.config.ts`, `src/schema/**`, `src/validate/**`, `bin/schema.ts`, `bin/validate.ts`, `test/**`); `data/schema/generated/{schema.json,schema.sql}`; `data/schema/freshness.json`, `data/schema/difficulty-map.json`; `data/catalog/policy.json`; `data/catalog/{trails,activities,stays,eateries,offers,legs,areas}/.gitkeep`, `data/catalog/trails/geo/.gitkeep`, `data/catalog/legs/geo/.gitkeep`, `data/catalog/changes/.gitkeep`; `tools/pyproject.toml`; `tools/check-all.sh`; `tools/hooks/data_changed.sh`, `tools/hooks/schema_changed.sh`.
Edit: `tools/tests/test_schema_sqlite.py` (extend), `.claude/settings.json` (append two hook entries), `tools/hooks/prepublish.sh` (run `check-all.sh` instead of only pytest), `pnpm-lock.yaml` (regenerated only), `CLAUDE.md` (one line under a "Platform" heading).

Must not touch: `web/**` (P3a owns it and may be running now), `tools/locations.py`, `tools/location_views.py`, `data/locations/**` (P2b), `legacy/**`, `docs/PLAN-platform.md`, `docs/briefs/**`.

## Steps

### Step 0. Worktree (no commit)

```bash
git -C /home/nitin27may/workspace/travel fetch origin
git -C /home/nitin27may/workspace/travel worktree add -b phase/p2a /home/nitin27may/workspace/travel-wt/p2a origin/main
python3 -m pytest /home/nitin27may/workspace/travel-wt/p2a/tools/tests -q     # expect: all passed (note the count, N0)
```

All later commands use `W=/home/nitin27may/workspace/travel-wt/p2a`. If your session's project directory is the main checkout, its PostToolUse hooks validate the main checkout, not `W`: run the validators yourself after every data write.

### Step 1. Workspace and package scaffold

- Root `package.json` and `pnpm-workspace.yaml` already exist (P1b); do not edit them.
- `core/package.json`: name `@travel/core`, `"type": "module"`, `"private": true`, `"exports": {"./*": "./src/*"}`, scripts `test` (`vitest run`), `typecheck` (`tsc --noEmit`); dependencies `zod@4.6.7`; devDependencies `vitest@5.0.5`, `typescript@6.0.3`, `@types/node@22`.
- `core/tsconfig.json`: `strict`, `"module": "nodenext"`, `"moduleResolution": "nodenext"`, `"target": "es2023"`, `"erasableSyntaxOnly": true`, `"allowImportingTsExtensions": true`, `"noEmit": true`, `"verbatimModuleSyntax": true`. Imports carry `.ts` extensions. No `enum`, no `namespace`, no parameter properties (type stripping cannot erase them).
- `core/test/smoke.test.ts` and `core/bin/schema.ts --help` that prints usage.
- `tools/pyproject.toml`: `[project] name = "travel-tools"`, `version = "0"`, `requires-python = ">=3.12"`, `dependencies = []`; `[dependency-groups] dev = ["pytest>=8"]`.

```bash
pnpm --dir /home/nitin27may/workspace/travel-wt/p2a install          # expect: lockfile written, no errors
pnpm --dir /home/nitin27may/workspace/travel-wt/p2a/core test        # expect: 1 passed
pnpm --dir /home/nitin27may/workspace/travel-wt/p2a/core typecheck   # expect: exit 0
node /home/nitin27may/workspace/travel-wt/p2a/core/bin/schema.ts --help   # expect: usage text, exit 0, no warning
```

Commit `P2a step 1: core package`. Paths: `pnpm-lock.yaml core tools/pyproject.toml`. The root `pnpm-lock.yaml` is shared with P3a: never hand-edit it; after a rebase, regenerate it with `pnpm --dir <W> install`.

### Step 2. Schema building blocks and the subset rule

`core/src/schema/meta.ts`: column helpers for the plan's types (`text`, `int`, `real`, `bool`, `json`, `date`, `datetime`, `month`, `hhmm` with the regex of 2.1, `offset`, `tz` validated against `Intl.supportedValuesOf('timeZone')`), a `moneyPair(name)` helper producing `<name>_amount` and `<name>_currency`, and `table(name, shape, meta)` where `meta = {pk: string[], family: "trip" | "catalog" | "locations" | "sidecar", sql?: {checks?: string[], indexes?: string[][]}, ui?: {...}, private?: string[], rules?: Rule[]}`. Column-level metadata (`ui` labels and facets, `private: true`, `fk: "table.col"`) goes through `.meta()`. Every object is `z.strictObject`.

`core/test/subset.test.ts`: scans every file in `core/src/schema/` and fails on `.transform(`, `.refine(`, `.superRefine(`, `.preprocess(`, `z.lazy(`, `z.custom(` (they do not export to JSON Schema).

Commit `P2a step 2: schema helpers and subset rule`.

### Step 3. The schemas

Files: `core/src/schema/trip.ts` (every table of plan 2.2 and 2.3, in the 2.2 key order, with `x-private` columns marked), `core/src/schema/catalog/{common,trails,activities,stays,eateries,offers,legs,areas,changes,backlog,sources}.ts` (2.3A), `core/src/schema/locations.ts` (v2 exactly as `tools/locations.py` `COLUMNS` defines it today; P2b adds v3), `core/src/schema/researchSidecar.ts` (10.1, records as revised), `core/src/schema/routeGeometry.ts` (0B.5), `core/src/schema/policy.ts`, `freshness.ts`, `index.ts` (the registry: every table in a stable order sorted by family then name).

Tests (`core/test/schema/`):
- `locations-columns.test.ts`: spawns `python3 -c "import sys,json; sys.path.insert(0,'<W>/tools'); import locations as D; print(json.dumps(D.COLUMNS))"` and asserts the Zod locations tables have the same tables, column names, types and nullability.
- `trip-columns.test.ts`: a snapshot of `{table: [columns]}` for the trip family, so a column change is a visible diff.
- `private.test.ts`: the `x-private` set equals the plan's list (travellers except `id`, `label`, `role`; `trip_bookings.price_paid_*`, `confirmation`, `contact`; `notes` with `visibility = private` is handled by the export, not the column; `emergency.insurer_tel`; `fare_windows.party`).

Commit `P2a step 3: Zod schemas for trips, catalog, locations, sidecars`.

### Step 4. Export and DDL generator

`core/bin/schema.ts generate [--check]`:
- writes `data/schema/generated/schema.json`: one JSON Schema 2020-12 document, `$defs` keyed `<family>.<table>`, sorted, built with `z.toJSONSchema` per table plus the table `meta` copied under `x-sql`, `x-ui`, `x-private`, `x-rules`, `x-pk`; two-space indent, trailing newline;
- writes `data/schema/generated/schema.sql` from the exported JSON (not from Zod internals): `CREATE TABLE` per table; types `text`/`date`/`datetime`/`hhmm`/`tz` to `TEXT`, `int`/`month`/`offset` to `INTEGER`, `real` to `REAL`, `bool` to `INTEGER CHECK (col IN (0,1))`, `json` to `TEXT CHECK (json_valid(col))`; `NOT NULL` from nullability; `CHECK (col IN (...))` for enums; `PRIMARY KEY`; `REFERENCES` from column `fk`; trip-family tables get a leading `trip_id TEXT NOT NULL REFERENCES trips(slug)` (the `trip` object becomes the table `trips`); `meta.sql.checks` copied verbatim; indexes from `meta.sql.indexes` plus the plan's (`trips.owner_id`, `trips.visibility`, catalog `review_status`, `last_verified`, `area_id`);
- `--check` regenerates in memory and exits 1 with a unified diff if either file differs.

The locations tables must reproduce every constraint of `data/schema/legacy/locations_schema.sql` (read it; for example lat and lon both null or both set, a source has exactly one owner); put them in `meta.sql.checks`.

Extend `tools/tests/test_schema_sqlite.py` (stdlib and pytest only): parametrize the existing tests over two DDL files, the legacy one and `data/schema/generated/schema.sql` (locations tables only for the existing cases), and add a test that loads the whole generated DDL into SQLite and inserts every valid fixture of `core/test/fixtures/valid/` (read the JSON, insert rows per table, `trip_id` = slug) with `PRAGMA foreign_key_check` empty.

Tests in `core/test/generate.test.ts`: `generate --check` passes on the committed files; every table `meta` key appears in `schema.json`; output is byte-stable across two runs.

```bash
node /home/nitin27may/workspace/travel-wt/p2a/core/bin/schema.ts generate
node /home/nitin27may/workspace/travel-wt/p2a/core/bin/schema.ts generate --check; echo "rc=$?"   # expect: rc=0
python3 -m pytest /home/nitin27may/workspace/travel-wt/p2a/tools/tests -q                          # expect: N0 + new, all passed
pnpm --dir /home/nitin27may/workspace/travel-wt/p2a/core test                                      # expect: all passed
```

(The valid fixtures are written in step 5; in this step the SQLite fixture test may load only the locations store. Add the trip fixtures in step 5.)

Commit `P2a step 4: JSON Schema export and DDL generator`.

### Step 5. Structural validator and fixtures

`core/src/validate/`: `validateFile(path, root)` and `validateDoc(doc, family, root)` returning `{errors: Issue[], warnings: Issue[]}` with `Issue = {code, path, message}`; messages in the style of plan 4.7 (field-level, plain English, an example of a valid value). Implements every `E_*` code of plan 2.4. Cross-file references are resolved by loading the referenced files under `root` (`data/locations/locations.json`, `data/catalog/<entity>/<CC>.json`, `data/vocab/tags.json` if present, else the tags table inside the store). Family is detected from the path (`data/trips/<slug>/trip.json`, `data/catalog/<entity>/<CC>.json`, `data/locations/*.json`, `research/**/*.json` sidecars).

`core/bin/validate.ts <file...> | --all [--root <dir>] [--json]`: prints one line per issue, `ERROR E_FK data/trips/x/trip.json#/items/3/trail_id: ...`, exit 1 on any error, 0 otherwise. `--all` walks `data/trips`, `data/catalog`, `data/locations`.

Fixtures (`core/test/fixtures/`):
- `root/`: a minimal repo-shaped tree (a `data/locations/locations.json` with two countries, three places, the tags; one catalog file per entity; one research file) that fixtures reference;
- `valid/`: at least a day trip (Niagara shape, plan 2.7 C), a multi-base trip with three tracks and Plan B (Patagonia Day 8 shape from plan 2.7 A), a road-trip day (2.7 B), and one catalog file per entity;
- `broken/<CODE>.json`: one per `E_*` code of 2.4 (25 files), each a copy of a valid fixture with one defect, plus `broken/<CODE>.expect` naming the code.

`core/test/validate.test.ts`: every valid fixture has zero errors; each broken fixture yields its code and no other `E_*` code; the list of broken fixtures equals the list of `E_*` codes declared in `core/src/validate/codes.ts` (so a new code without a fixture fails).

```bash
pnpm --dir /home/nitin27may/workspace/travel-wt/p2a/core test                                       # expect: all passed
node /home/nitin27may/workspace/travel-wt/p2a/core/bin/validate.ts --all --root /home/nitin27may/workspace/travel-wt/p2a; echo "rc=$?"   # expect: rc=0 (the real store validates; there are no trips yet)
node /home/nitin27may/workspace/travel-wt/p2a/core/bin/validate.ts /home/nitin27may/workspace/travel-wt/p2a/core/test/fixtures/broken/E_FK.json --root /home/nitin27may/workspace/travel-wt/p2a/core/test/fixtures/root; echo "rc=$?"   # expect: an ERROR E_FK line, rc=1
python3 -m pytest /home/nitin27may/workspace/travel-wt/p2a/tools/tests -q                           # expect: all passed (SQLite loads every valid fixture)
```

Commit `P2a step 5: structural validator with named codes and fixtures`.

### Step 6. Policy and reference files

- `data/schema/freshness.json`: the freshness table of plan 0A.1 (field class, field paths, `stale_after_days`, `on_stale`).
- `data/schema/difficulty-map.json`: the house-scale table of plan 3A (per local system, local grade to house grade) and the effort bands.
- `data/catalog/policy.json`: the auto-accept table of plan 0A.2 as revised (new rows land `proposed`/`stated`; promotion rule; each rule with `"enabled": true`).
- the empty catalog folders with `.gitkeep`.
Each file validates against its Zod schema (`policy.ts`, `freshness.ts`); add both to `validate --all`. (`data/reference/licences.json` belongs to P3a, which renders `/about/data/` from it.)

Commit `P2a step 6: freshness, difficulty and policy files`.

### Step 7. Hooks, settings and the local gate

- `tools/hooks/data_changed.sh` (PostToolUse on Write, Edit, MultiEdit): read `tool_input.file_path` from stdin JSON like `locations_changed.sh` does; act only on `*/data/trips/*`, `*/data/catalog/*`, `*/data/vocab/*` (not `*/data/locations/*`, which `locations_changed.sh` owns); `ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"`; if `$ROOT/core/node_modules` is missing, print "core dependencies missing: run pnpm --dir $ROOT install" and exit 2; run `node "$ROOT/core/bin/validate.ts" "$path" --root "$ROOT"`; on failure print the output and exit 2; if the path is a `.json` under `data/catalog/` and the write removed rows (compare with `git show HEAD:<path>` ids when the file is tracked), exit 2 with "deleting catalog rows is catalog.retire, confirmed by the owner".
- `tools/hooks/schema_changed.sh` (PostToolUse): act on `*/core/src/schema/*`; run `generate` then `generate --check`; exit 2 on failure.
- `.claude/settings.json`: append both to the existing `PostToolUse` matcher `Write|Edit|MultiEdit` hooks list (keep the existing `locations_changed.sh` entry and the `PreToolUse` entry exactly as they are).
- `tools/check-all.sh` (bash, `set -euo pipefail`, `ROOT` from its own location, absolute paths): `python3 -m pytest "$ROOT/tools/tests" -q`; `python3 "$ROOT/tools/locations.py" validate`; `python3 "$ROOT/tools/locations.py" build --check`; `pnpm --dir "$ROOT/core" test`; `pnpm --dir "$ROOT/core" typecheck`; `node "$ROOT/core/bin/schema.ts" generate --check`; `node "$ROOT/core/bin/validate.ts" --all --root "$ROOT"`; then, only if `$ROOT/web/package.json` exists, `pnpm --dir "$ROOT/web" typecheck`, `lint`, `test`, `build`. Print `CHECK-ALL OK` at the end.
- `tools/hooks/prepublish.sh`: replace the pytest call with `bash "$ROOT/tools/check-all.sh"`; keep the match rules.
- `CLAUDE.md`: under a new heading "Platform (in progress)", one line: "`core/` holds the schema (Zod, exported to `data/schema/generated/`) and the validator; run `bash tools/check-all.sh` before publishing."

Hand tests:

```bash
W=/home/nitin27may/workspace/travel-wt/p2a
mkdir -p /tmp/p2a-hook/data/trips/x && cp $W/core/test/fixtures/broken/E_FK.json /tmp/p2a-hook/data/trips/x/trip.json
echo "{\"tool_input\":{\"file_path\":\"/tmp/p2a-hook/data/trips/x/trip.json\"}}" | bash $W/tools/hooks/data_changed.sh; echo "rc=$?"   # expect: ERROR lines, rc=2
echo '{"tool_input":{"file_path":"/x/README.md"}}' | bash $W/tools/hooks/data_changed.sh; echo "rc=$?"   # expect: rc=0, no output
echo "{\"tool_input\":{\"file_path\":\"$W/core/src/schema/trip.ts\"}}" | bash $W/tools/hooks/schema_changed.sh; echo "rc=$?"   # expect: rc=0
bash $W/tools/check-all.sh                                                                                  # expect: last line CHECK-ALL OK
```

(The data hook resolves `--root` from its own location, so the broken fixture's foreign keys point nowhere in the real repo: that is what makes it fail with `E_FK`.)

Commit `P2a step 7: data and schema hooks, check-all gate`.

### Step 8. PR

```bash
git -C /home/nitin27may/workspace/travel-wt/p2a fetch origin && git -C /home/nitin27may/workspace/travel-wt/p2a rebase origin/main
pnpm --dir /home/nitin27may/workspace/travel-wt/p2a install && bash /home/nitin27may/workspace/travel-wt/p2a/tools/check-all.sh
git -C /home/nitin27may/workspace/travel-wt/p2a push --force-with-lease -u origin phase/p2a
gh pr create --repo nitin27may/travel --base main --head phase/p2a --title "P2a: schema source, export, DDL, validator, hooks" --body-file /tmp/p2a-pr.md
```

If `origin/main` gained `web/` (P3a merged first), `check-all.sh` now also runs the web steps; fix only what is yours.

## Acceptance criteria

1. `node core/bin/schema.ts generate --check` exits 0; running `generate` twice leaves `git status` clean.
2. `python3 -m pytest tools/tests -q`: all passed; the existing `test_schema_sqlite.py` cases pass against both the legacy and the generated DDL; every valid fixture loads into SQLite with `PRAGMA foreign_key_check` empty.
3. `pnpm --dir core test`: all passed, including: one broken fixture per `E_*` code yielding exactly that code; every `meta` key present in the export; the locations column parity test; the subset test.
4. `node core/bin/validate.ts --all --root <W>` exits 0 on the real repo.
5. The two hooks behave as in the hand tests (rc 2 on a broken trip, rc 0 otherwise).
6. `bash tools/check-all.sh` ends with `CHECK-ALL OK`.
7. No file under `web/`, `tools/locations.py`, `tools/location_views.py` or `data/locations/` changed (`git diff --name-only origin/main...HEAD`).

## Tests to add

`core/test/{smoke,subset,generate,validate}.test.ts`, `core/test/schema/{locations-columns,trip-columns,private}.test.ts`, `core/test/fixtures/{root,valid,broken}/**`; extended `tools/tests/test_schema_sqlite.py`.

## Pitfalls

1. Node strips types but does not transform: no `enum`, `namespace`, decorators or parameter properties; imports need the `.ts` extension. `tsc --noEmit` with `erasableSyntaxOnly` catches these.
2. `z.toJSONSchema` cannot export transforms or refinements; the subset test bans them. Put cross-field rules in `meta.rules` and implement them in the validator.
3. Money is two scalar columns everywhere (plan 2.1). There is no money object; a fixture with `{"amount": ...}` must fail `E_SCHEMA`.
4. The catalog lifecycle column is `review_status`, not `status` (`places.status` and `trip.status` mean other things).
5. There is no `items.offer_id`, no `adventures` or `bookings` table, no `bases.booking_id`, no `web` object (one `trip.web_published` bool).
6. Keep the generated files byte-stable: sorted keys where order is not semantic, `\n` line endings, trailing newline.
7. The hooks registered in your session may point at the main checkout; validate `W` yourself.
8. `tools/` stays stdlib-only: the extended SQLite test uses `sqlite3` and `json` only.
9. Never `cd`; parallel shell calls share the working directory.

## Commit and push rules

- Checkout `/home/nitin27may/workspace/travel-wt/p2a`, branch `phase/p2a`.
- `git -C /home/nitin27may/workspace/travel-wt/p2a add <owned paths>` only; never `git add -A`, `.` or `commit -a`; check `git -C /home/nitin27may/workspace/travel-wt/p2a diff --cached --stat` before each commit.
- One commit per step, green; message `P2a step <n>: <summary>`, body, trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Push after each step: `git -C /home/nitin27may/workspace/travel-wt/p2a push -u origin phase/p2a`.
- PR with `gh pr create` (no `--json`), body ending with the attribution line your harness specifies; the owner merges; do not remove the worktree or branch.

## Report back

Commit hashes; test counts (Python before and after, `core` total); number of `E_*` codes and broken fixtures; the `generate --check` and `check-all.sh` outputs; any column in the plan you found ambiguous and how you resolved it (list it; do not edit the plan).
