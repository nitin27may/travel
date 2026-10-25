# Local database, the seed and sync with Neon

Status: spec, 25 Oct 2026, travel-planner (Opus). Docs only; nothing here is built. PLAN R-140 to R-146, BACKLOG 15.140 to
15.148, questions Q180 to Q187, TODO row of 25 Oct. Measured on `main` 196207e with read-only commands: the Neon CLI 8.11.1
(`neon projects get`, `neon branches list`), one read-only query on the child branch (`set default_transaction_read_only`),
a row-count script over `data/**`, and one size load into a throwaway Postgres 17 in the session scratchpad (loopback only,
deleted afterwards). No Docker container was started and no Neon setting was changed.

Owner question, 25 Oct 2026 (dictated): "Why is data migration blocked, are we not using Postgres from Neon? Do we have a seed
data handy? We talked about keeping a seed data always in sync, so that when we run locally we can spin a Postgres database in
Docker, and the same thing we can sync to Neon remote also. I think we have a strategy already; double check and let us know
what is missing or needs to be done."

## 0. The short answer

| Question | Answer |
|---|---|
| Is data migration blocked? | **No technical blocker; it is unbuilt and scheduled late.** Neon Postgres is live with the full schema (migrations 0001 to 0010, 86 tables with RLS). The catalogue, research and projection tables are empty because the JSON-to-Postgres loader, the `PostgresStore`, the parity tests and the cutover have not been written. EXECUTION-PLAN decision D9 and section 4.8 put that work (SRV-0) after the E features and the closure queue, with flags off |
| Are we using Postgres from Neon? | Yes, for accounts and private drafts only (`app_user`, `planner_draft`, the signal table and Realtime). The public site still reads `JsonStore` over `data/**` |
| Do we have seed data? | **Yes, in effect: the JSON in git is the seed** (about 10,500 rows for 0003 to 0007, 5.6 MB of input, section 5). What is missing is the command that turns it into rows. `data/seed/prototype/*.ts` is the old prototype seed for the web snapshot, not a database seed |
| Did we have a strategy? | **Partly.** The two-tier load (R-55), the loader contract (R-135: idempotent, rollback by run id) and "tests against a real Postgres in Docker or a Neon branch" (04-stack, section 2) are written. **Not written anywhere:** a local Postgres, a `db:seed` that works on any target, a `db:sync` with a diff, a drift gate in `check-all`, CI, the target guard that protects production, and what is never seeded |
| What needs doing? | Eight tasks (section 8). Four can ship now without the `PostgresStore`: LOCAL-1 (Docker Postgres that matches Neon), LOCAL-C (the seed and target contract), LOCAL-2 (the seed engine for the reference tables), LOCAL-3 (the drift gate). About 34 h new work (Opus 10, Sonnet 24); the existing RIS and SRV-0 tasks are merged in, not duplicated |
| What must you decide? | Q180 to Q187 (section 10). The ones that unblock work today: Q180 (start LOCAL-1 to LOCAL-3 now, ahead of the SRV-0 window), Q181 (Docker Desktop running on your Mac), Q182 (allow a `.github/` folder for the first CI workflow) |

Principles: P9 (one data boundary: the seed engine writes what `JsonStore` already reads, through the same core functions, and
adds no client-side load), P8 (the seed is a server-side copy; no bulk file is served and no per-request export changes), P1
(the plan holds at 10,000 places: section 5.3 sizes it), P7 (the public site first: nothing here changes a page until a 14.2
seam flips). No screen is added, so the trip scope scenarios and the keep-from-live-site rules are not touched.

## 1. Is data migration blocked? The evidence

### 1.1 What is built

| Piece | Where | State | Evidence |
|---|---|---|---|
| Neon project and branches | project `damp-queen-64719841` (Free plan, org `org-fancy-dream-16320709`, aws-us-east-2) | live | `neon branches list`: `production` `br-soft-glade-b4mkqyvd` 44.5 MB logical; `srv-migrate-verify` `br-damp-breeze-b41mtvn5` 47.7 MB, child of production; neither protected, neither with an expiry |
| Postgres version | both branches | 18.6; extensions postgis 3.6.4, pg_trgm 1.6, unaccent 1.1, ltree 1.3 | read-only query on the child, 25 Oct |
| Schema | `core/src/db/migrations/0001` to `0010` | applied on both branches | [NEON-MIGRATIONS.md](../build/public-site/NEON-MIGRATIONS.md); 86 tables with RLS plus the ledger; `planner_draft_signal` the one content-free exception |
| Migration runner | `core/src/db/runner.ts`, `core/bin/db-migrate.ts` | built | versioned, checksummed, advisory-locked, one transaction per file; refuses drift, a missing file or an out-of-order file; `--url=` takes any connection string |
| Runtime role | `travel_app` (0001) | built | NOLOGIN, NOBYPASSRLS; the owner connection drops to it per transaction (`core/src/db/tx.ts`) |
| Account and draft path | `planner_draft`, `planner_draft_signal`, Realtime | built and verified | child suite `core/test/db` 29 of 29 on 25 Oct ([NEON-VERIFICATION.md](../build/public-site/NEON-VERIFICATION.md)) |
| Storage contract | `core/src/schema/rowMeta.ts` (RIS-C) | merged (f76e60d) | [catalogue-intake-and-storage.md](catalogue-intake-and-storage.md) 3.3 |
| Normaliser | `core/bin/normalise.ts` (RIS-N) | merged (a03c8f0) | `--report` today: 72 files, 24 would change, 689 changes, 1 error (the refused street address in `canadian-rockies-2029/CS7.json`) |
| D3a and D4a data | lane files | merged (7a2a6a8) | so RIS-J no longer waits on them |

### 1.2 What is empty

Every table of 0003 (catalogue, sources, source tier, suitability and relevance serving), 0005 (reference), 0006 (research
queue) and 0007 (projections) holds 0 rows on both branches; 0003 says so in its header ("No data is loaded here"). Only
`app_user`, `planner_draft` and `planner_draft_signal` receive rows, from real sign-ins and the test suites.

### 1.3 What stands between today and a cutover, in order

| # | Missing piece | Task (existing or new) | Ready to start? |
|---|---|---|---|
| 1 | A local Postgres that matches Neon, so loader work does not need Neon at all | **LOCAL-1** (new) | yes |
| 2 | The seed and target contract: table order, natural keys, content hash, what is never seeded, never-delete rules, the production guard | **LOCAL-C** (new) | yes |
| 3 | The seed engine for tables that need no schema change (vocab, areas, towns, operators, sources) and the `db:seed`, `db:sync`, `db:verify` commands | **LOCAL-2** (new) = the first part of RIS-L | after LOCAL-1 and LOCAL-C |
| 4 | A drift gate: `check-all` builds the seed, loads it into a throwaway database and compares | **LOCAL-3** (new) | after LOCAL-2 |
| 5 | Today's JSON in the storage contract | RIS-J (15.133) | **yes now**: D3a and D4a are merged |
| 6 | The migration for `meta`, `notes_private`, `load_run`, evidence columns and column-list grants | RIS-M (15.136) | after RIS-C (done); number at merge (Q186) |
| 7 | The rest of the loader: capture records, sidecars, evidence, run records, changesets, `meta` stamping, rollback by run id | RIS-L (15.137), the remainder after LOCAL-2 | after RIS-M and RIS-J |
| 8 | Round trip, idempotency, rollback, privacy, size and parity tests | RIS-T (15.138) plus the sync cases of 6.6 | with item 7 |
| 9 | The `PostgresStore` and the contract kit per method | SRV-0 (EXECUTION-PLAN 4.8) | the SRV-0 window |
| 10 | A child-branch rehearsal, then production, per seam | LOCAL-5 (new) and the 14.2 runbook | after items 7 to 9 |

### 1.4 What the owner approves

| Step | Approval | Standing rule |
|---|---|---|
| Start items 1 to 4 now, before the SRV-0 window | Q180 | D9 says SRV-0 is "not built now"; these tasks change no served page and write nothing to Neon |
| Each migration on production | a named commit | your standing approval of 25 Oct covers "migrations on production when a named commit is approved"; RIS-M is Q177 |
| The first seed of production | a named commit, after a green child rehearsal | Q183 recommends doing it only when the first 14.2 seam is ready to flip |
| Each store flip (`CATALOGUE_STORE=postgres` per seam) | a named commit after a preview | 14.2; `JsonStore` stays deployable for one release |
| A `.github/` folder | Q182 | the folder contract allows only eight top-level folders (`tools/tree_contract.json`) |

## 2. The strategy

### 2.1 The rules

1. **The JSON in git is the seed of record.** Catalogue, research and reference rows are a pure function of one git commit
   of `data/**`. No catalogue row is ever authored in a database. A wrong row is fixed in the JSON, then synced.
2. **One engine, one code path, every target.** `core/bin/load-catalogue.ts` (the SRV-0 name) builds the seed in memory from
   the commit, then plans and applies the difference against a target. `db:seed` and `db:sync` are the same engine; a seed is a
   sync into an empty database. The targets are local Docker, a CI container, the Neon child branch and Neon production. There
   is no Neon-only or Docker-only path.
3. **Deterministic and idempotent.** The same commit gives the same rows byte for byte (canonical key order, fixed number
   formatting, sorted arrays where order is not meaningful). A second sync of the same commit writes 0 rows.
4. **Stamped.** Every sync writes a `load_run` row (RIS-M: id, commit, the sha256 of every input file, counts, status) and,
   after RIS-M, `meta.run_id`, `meta.imported_from` and `meta.imported_at` on every row it writes.
5. **Plan before apply.** `db:sync --dry-run` prints the diff by table and record id. Nothing is written.
6. **Rollback is a sync to an earlier commit.** Because the seed is a function of the commit, `db:sync --commit <previous>`
   restores the serving tier exactly. RIS-L's rollback by run id stays for the append-only `evidence` rows.
7. **Production last.** Local, then the child branch (reset from production first), then production on a named commit. The
   engine refuses production without `--approve <sha>` equal to `HEAD`, a clean tree and a green child run of the same commit
   (6.4).
8. **Private data is never seeded and never in git.** Accounts, drafts, favourites, submissions, quotas and every household
   table stay in the database they were written in (6.2).

### 2.2 The flow

```mermaid
flowchart LR
  classDef core fill:#1F4E79,stroke:#163A5A,color:#FFFFFF
  classDef data fill:#2A7F8F,stroke:#1E5F6B,color:#FFFFFF
  classDef ext fill:#B7791F,stroke:#8A5A12,color:#FFFFFF
  classDef infra fill:#5A6772,stroke:#3E4850,color:#FFFFFF
  classDef guard fill:#9B2C2C,stroke:#6B1E1E,color:#FFFFFF
  classDef ok fill:#2F6B3A,stroke:#1F4A28,color:#FFFFFF

  GIT["data/** at one commit<br/>(the seed of record)"]:::data
  CHK["normalise --check,<br/>validate --all"]:::core
  BLD["seed builder (pure)<br/>rows + content hashes"]:::core
  PLAN["planner: diff by table<br/>and record id"]:::core
  GUARD{"target guard"}:::guard
  LOC["local Docker<br/>Postgres 18 + PostGIS 3.6"]:::infra
  CI["CI service container"]:::infra
  CHILD["Neon child branch<br/>(reset from production)"]:::ext
  PROD["Neon production<br/>(named commit)"]:::guard
  VER["db:verify: counts and<br/>hashes equal the seed"]:::ok

  GIT --> CHK --> BLD --> PLAN --> GUARD
  GUARD -- "local, ci" --> LOC
  GUARD -- "ci" --> CI
  GUARD -- "child" --> CHILD
  GUARD -- "production + --approve" --> PROD
  LOC --> VER
  CI --> VER
  CHILD --> VER
  PROD --> VER
```

### 2.3 The commands (root `package.json`)

| Command | Does | Targets allowed |
|---|---|---|
| `pnpm db:up` | `docker compose -f tools/db/compose.yml up -d --wait` (waits for the healthcheck) | local |
| `pnpm db:down` | stops the container, keeps the volume | local |
| `pnpm db:reset` | drops the volume, starts again, migrates, seeds | local only; refuses any other host |
| `pnpm db:migrate [--target t]` | `core/bin/db-migrate.ts up` against the resolved target | local, child; production with `--approve` |
| `pnpm db:seed [--target t]` | the engine's apply on an empty catalogue; fails if catalogue rows exist (use `db:sync`) | local, ci, child |
| `pnpm db:sync --target t --dry-run` | the plan: per table inserts, updates, retires, deletes, and the first 20 record ids of each | any, read-only |
| `pnpm db:sync --target t [--commit sha] [--approve sha]` | plan, then apply in one transaction under its own advisory lock; writes `load_run` | local, ci, child; production with the guard |
| `pnpm db:verify --target t` | read-only: row count and table hash per table against the seed of the commit; exit 1 on any difference | any |
| `pnpm db:psql [--target t]` | `psql` to the target; local by default | local, child |
| `pnpm db:rehearse` | coordinator only: reset the child from production, migrate, sync, verify, run `core/test/db` and RIS-T there, print one report | child (LOCAL-5) |

`t` is `local` (default), `ci`, `child`, `production`, or a full URL. A URL whose host ends in `.neon.tech` must also be named
`child` or `production`, so a pasted production URL cannot pass as "a URL".

### 2.4 What is seeded, table by table

| Table family | Seeded from | Key | Notes |
|---|---|---|---|
| `type_node`, `tag`, `relevance_class` | `data/vocab/types.json`, `tags.json`, `relevance-classes.json` | `id`, `key` | LOCAL-2 |
| `area` | `data/reference/countries.json` and the locations store's countries, regions and areas (public names, ids and chains only) | `id` | LOCAL-2; `path` labels built as NEON-MIGRATIONS says (`-` to `_`, `/` to `.`) |
| `town` | `data/reference/towns/*.json` (GeoNames, CC BY 4.0) | `id` | LOCAL-2; 4,522 rows today |
| `operator` | `data/capture/operators.json` | `ref` | LOCAL-2 |
| `source` | `data/sources/registry.json` (generated; read only after `sources.ts check` passes) | `id` | LOCAL-2 |
| `entity`, `offer`, `entity_alias`, `relation`, `entity_link`, `media`, `track` | capture lane files, `points.json`, `operators.json`, `data/tracks/*.json`, the slug registry | `entity.id` = `ref` verbatim; `slug` only from `data/catalogue/slugs.json` | RIS-L remainder |
| `dataset_file`, `record_doc`, `source_local`, `capture_supersede` | every loaded file, verbatim | `id` = repo path; `(file_id, ref)` | RIS-L remainder; trip-level families after RIS-M widens `record_doc.family` |
| `suitability`, `relevance`, `relevance_signal` | sidecars and signal files | `ref`; `(source, key)` | RIS-L remainder |
| `evidence`, `research_job`, `research_gap`, `changeset`, `change` | Vals and conflicts, run records, changeset files | `content_hash`, run id, changeset id | RIS-L remainder; `evidence` is append-only |
| `place_row`, `place_page`, `trip_row`, `trip_page`, `relevance_derived` | computed by the same core code as `JsonStore` | `slug`; `(trip_slug, ref)` | written last; never hand-loaded |
| `leg_cache` | `data/schedules/legs/*.json` stored legs | `(from_cell, to_cell, mode)` | through STY-L; a cache, so sync may delete |
| `freshness_rule` | `data/schema/freshness.json` | `field_prefix` | RIS-L remainder |
| `catalogue_meta` | the revision of the commit | `key` | written last, in the same transaction, so readers see one revision |

### 2.5 References, photos and tracks

- **Slugs and refs.** `entity.id` is the `ref` verbatim (R-55). Slugs come only from the pinned registry
  `data/catalogue/slugs.json`; the engine never mints one. `merged` and `formerKeys` entries become `entity_alias` rows;
  `retired` and `withdrawn` entries become `status = 'retired'`. A ref is never rewritten.
- **Never delete an entity.** `saved_place.entity_id` references `entity(id)` with `on delete cascade` (0003), and
  `trip_item` and `reservation` reference `offer(entity_id)`. A row missing from the seed is retired, never deleted, so a
  user's saved place or booking never disappears with a catalogue edit. Catalogue-owned children of a seeded entity
  (`relation`, `entity_link`, `media`, `track`) may be deleted.
- **Photos are rows that point at files.** `media` holds the Commons file title (`key`), licence, author, attribution and
  file page URL. Image bytes are never in Postgres or git; renditions are built into `web/public/img/` (gitignored) by the
  image script. Object storage is not selected, and the seed does not need it.
- **Tracks are rows.** The 17 files under `data/tracks/` (116 KB) become `track.geom` lines with their source, licence and
  lengths; processing facts go to `track.attrs` (RIS-M). GPX is generated from the row per item (P8).
- **Static map files are not seeded.** The globe files (27 MB under `web/public/globe/`) and the town and outline shards stay
  build outputs.

### 2.6 How the seed stays in sync automatically

| Layer | Check | When | Fails on |
|---|---|---|---|
| Offline | `load-catalogue.ts build --check`: build the seed in memory from the working tree; every row valid for its column types; every foreign key resolvable inside the seed; every slug from the registry | every `check-all` (LOCAL-3) | a JSON change that cannot load |
| Local database | create a throwaway database `seed_check_<pid>` from the `travel_template` database on the local server, migrate, seed, verify, run the idempotency step (a second sync writes 0 rows), drop it | `check-all` when the local server answers `pg_isready`; otherwise the stage prints `SKIPPED` | drift between the JSON, the migrations and the engine |
| CI | the same stage against a service container; `CI=true` turns a skip into a failure | every push and pull request (LOCAL-4) | the same, on a clean machine |
| Child and production | `db:verify --target child` and `--target production` | before and after each rehearsal and production sync | a target that drifted from the commit it claims |

There is no committed seed manifest. A generated manifest would change in every data commit and conflict in every parallel
data lane merge; the engine recomputes the hashes in under a second at today's size.

## 3. Local development

### 3.1 The container

**Recommendation: a small image of our own, `tools/db/Dockerfile`, `FROM postgres:18-trixie` (the official, multi-arch
image) plus the PGDG package `postgresql-18-postgis-3`, pinned to PostGIS 3.6.** Trade-off: one image build of about a minute
the first time. The alternatives fail on this Mac: `postgis/postgis:18-3.6` publishes amd64 only (Docker Hub, checked 25 Oct),
so it runs under emulation on the owner's Apple M1 Pro; `imresamu/postgis:18-3.6` is multi-arch but a personal namespace. The
Homebrew `postgresql@17` already on the Mac is no substitute: wrong major version and no PostGIS.

| Setting | Value | Why |
|---|---|---|
| Postgres | 18 (Neon runs 18.6) | `grant ... with set true` in 0001 needs 16 or later; 18 matches production |
| PostGIS | 3.6 (Neon 3.6.4) | same minor as production |
| Port | `127.0.0.1:54329` | loopback only; avoids 5432, where a Homebrew server could sit |
| Volume | named volume `travel_pg18` | survives `db:down`; `db:reset` drops it |
| Healthcheck | `pg_isready -U neondb_owner -d neondb`, every 2 s, 30 retries | `up --wait` returns only when the server accepts connections |
| User | the image's non-root `postgres` user | as in the official image |
| Init | `tools/db/init/01-roles.sql`, `02-extensions.sql`, `03-neon-auth-stub.sql`, `04-template.sql` | run once by the image's entrypoint on an empty volume |

### 3.2 Roles and extensions, made to match Neon

| Object | On Neon (read 25 Oct) | Locally | Why it matters |
|---|---|---|---|
| Owner role | `neondb_owner`: LOGIN, **BYPASSRLS**, not superuser | `neondb_owner` LOGIN PASSWORD `local` CREATEDB CREATEROLE **BYPASSRLS** NOSUPERUSER, owner of database `neondb` | migrations and the engine run as it; tests must see the same bypass the real owner has |
| App role | `travel_app` NOLOGIN NOBYPASSRLS (0001) | created by 0001 as on Neon | the same `set local role` path as production |
| Extensions | postgis, pg_trgm, unaccent, ltree | created by the superuser in `02-extensions.sql`, because PostGIS is not a trusted extension; 0001's `create extension if not exists` then does nothing | 0001 runs unchanged |
| `neon_auth` schema | provider-owned, 16 tables | a stub of three tables: `"user"` (id uuid, name, email, `"emailVerified"`, image, `"createdAt"`, `"updatedAt"`, role, banned, `"banReason"`, `"banExpires"`), `session` (id uuid, `"expiresAt"`, token, `"createdAt"`, `"updatedAt"`, `"ipAddress"`, `"userAgent"`, `"userId"` uuid, `"impersonatedBy"`, `"activeOrganizationId"`), `account` (id uuid, `"accountId"`, `"providerId"`, `"userId"` uuid, tokens and expiries, scope, password, `"createdAt"`, `"updatedAt"`), owned by a NOLOGIN role `neon_auth`, `select` on `"user"` and `delete` on `session` granted to `neondb_owner` | EML-1's `web/lib/auth/revoke.ts` (on `public/EML-1`) deletes from `neon_auth.session` joined to `neon_auth."user"`; no other code reads `neon_auth` |
| Template | none | `travel_template` with the extensions, the roles' grants and the stub; `datistemplate = true` | each check run creates a throwaway database from it in milliseconds, so parallel worktrees share one container |

The stub is for local tests only. It is never created on Neon (Managed Better Auth owns that schema), and no migration
mentions it. LOCAL-1 adds a test that, when `TEST_DATABASE_URL` points at the child, compares the stub's column list with
the child's `information_schema` and fails on any difference.

### 3.3 Environment and target choice

| Variable | Read by | Local default | Rule |
|---|---|---|---|
| `LOCAL_DATABASE_URL` | the `db:*` scripts | `postgres://neondb_owner:local@127.0.0.1:54329/neondb` (a constant in `core/src/db/target.ts`; the password is loopback-only, not a secret) | no file needed |
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | the web app and `core/src/db/client.ts` | not set for local work | **the `db:*` scripts never read them implicitly**: the root `.env.local` holds production values |
| `TEST_DATABASE_URL` | `core/test/db/**`, RIS-T | `pnpm -s db:url local` prints the local URL | a skip is not a pass |
| `CATALOGUE_STORE` | the server store router (proposed in EXECUTION-PLAN 5.2) | `json` | `postgres` only after the seam's parity is green |
| `CI` | `check-all` | unset | `true` makes the database stage required |

To run the web app on the local database once the `PostgresStore` exists: `DATABASE_URL=$(pnpm -s db:url local)
CATALOGUE_STORE=postgres NEXT_PUBLIC_SIGN_IN=off pnpm dev`. Explicit variables must win over the root env file; LOCAL-1
checks that `web/scripts/with-root-env.mjs` gives the process environment precedence for `DATABASE_URL` (it does for the auth
variables today).

`.env.*` is gitignored, so no example env file is committed; the defaults live in `core/src/db/target.ts` and this page.

### 3.4 Docker on the owner's Mac

Docker Desktop's CLI is installed (29.8.2) and `/Applications/Docker.app` exists; the daemon was not running on 25 Oct.
1. Open Docker Desktop once (Applications, Docker), or run `open -a Docker`; wait for "Engine running".
2. Check: `docker info --format '{{.ServerVersion}}'` prints a version.
3. `pnpm db:up`, then `pnpm db:migrate`, then `pnpm db:seed`.
4. Optional: Settings, General, "Start Docker Desktop when you sign in".

Colima is the fallback if Docker Desktop is unwanted (`brew install colima docker-compose`, `colima start --cpu 2 --memory 2`);
the same compose file works. Docker Desktop is free for personal use.

### 3.5 What Docker cannot replace

| Needs Neon | Why | Runs on |
|---|---|---|
| Managed Better Auth (sign-up, sign-in, codes, Google, sessions) | a hosted service bound to a branch; there is no local Auth | the child branch (its own Auth endpoint) |
| Neon Realtime (`planner_draft_signal` subscription) | hosted, pre-GA | the child branch |
| EML-0 and EML-Q real-service checks (session revoke after reset, quotas end to end) | need real `neon_auth` rows written by Neon | the child branch |
| `web/scripts/neon-e2e.mjs` (14 real-service checks) | Auth plus Realtime plus Postgres over HTTPS | the HTTPS preview against production values, as today |
| Migration and seed rehearsal before production | the real extension versions, roles and data | the child branch, reset from production |

| Runs on Docker | Tests |
|---|---|
| everything that is plain Postgres plus RLS | `core/test/db/**` (runner, inventory, integration with `planner_draft` isolation and the signal trigger), RIS-T, the contract kit against `PostgresStore`, the revoke query against the stub, every future ops-on-Postgres test (11-quality: "every op against real Postgres") |

### 3.6 CI: the first workflow

There is no workflow in the repository; GitHub lists only the dynamic Copilot reviewer. The repository is private, so Actions
minutes count against the free 2,000 a month. Secrets already stored (names only): `DATABASE_URL`, `DATABASE_URL_UNPOOLED`,
`NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, `NEON_AUTH_JWKS_URL`, `NEON_REALTIME_URL`, `NEON_REALTIME_SECRET`,
`NEXT_PUBLIC_GOOGLE_MAPS_KEY`, `NEXT_PUBLIC_GOOGLE_MAP_ID`, `NEXT_PUBLIC_PLACE_MAP_FAMILY`, `NEXT_PUBLIC_SIGN_IN`,
`ORS_API_KEY`, `RESEND_API_KEY`, `TEST_DATABASE_URL`.

**Recommendation: `.github/workflows/check.yml` with one required job (the gate, no secrets) and one manual job (the child
suite).** The gate gets no Neon secret, so a pull request can never reach production. Trade-off: a new top-level folder (Q182)
and about 10 to 15 minutes of Actions time per run.

```yaml
# .github/workflows/check.yml (sketch for LOCAL-4; the builder fixes versions and caching)
on: { push: { branches: [main] }, pull_request: {}, workflow_dispatch: {} }
jobs:
  gate:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: "22", cache: pnpm }
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - run: pnpm install --frozen-lockfile
      - run: docker build -t travel-pg18 tools/db && docker run -d --name pg -p 127.0.0.1:54329:5432 travel-pg18
      - run: node tools/db/wait.mjs   # pg_isready loop, 60 s cap
      - run: bash tools/check-all.sh
        env: { CI: "true" }
  child-db:
    if: github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: "22", cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --dir core exec vitest run test/db
        env: { TEST_DATABASE_URL: "${{ secrets.TEST_DATABASE_URL }}" }
```

CI never seeds the child: two runs would race on one shared branch. The child is seeded only by `db:rehearse`, by one person.

## 4. The Neon side

### 4.1 A Neon dev branch or Docker?

| | Docker (recommended for daily work) | A long-lived Neon dev branch |
|---|---|---|
| Cost on Free | none | counts toward 10 branches, the 1 GB project storage (a child is billed on the lower of its changes and its size) and the **100 CU-hours a month shared with production** |
| Speed of a reset | seconds (`db:reset`) or milliseconds (a database from the template) | seconds (`neon branches reset <b> --parent`) but a network round trip on every query |
| Offline | yes | no |
| Parallel worktrees | one throwaway database each | one branch each, or collisions |
| Auth and Realtime | no | yes |
| Matches production | major and minor versions pinned; roles copied | exact |

**Recommendation: no new long-lived dev branch (Q184).** Daily work and CI run on Docker; the existing child
`srv-migrate-verify` keeps three jobs: Auth and Realtime spikes, the child DB suite, and the rehearsal before every production
migration or sync. A spike that needs its own branch uses a short-lived one; `neon.ts` already gives new branches a 7-day TTL,
and `neon branches create --expires-at` and `neon branches set-expiration` exist in CLI 8.11.1. Trade-off: Auth and Realtime
work still needs the network.

### 4.2 The order for any production change

```mermaid
sequenceDiagram
  participant L as Local Docker
  participant C as Neon child
  participant O as Owner
  participant P as Neon production
  L->>L: migrate, sync, verify, tests (check-all)
  C->>C: reset from production (copies prod schema and data)
  C->>C: delete copied sessions (gotcha)
  C->>C: migrate, sync --dry-run, sync, verify, core/test/db, RIS-T
  C-->>O: rehearsal report for commit <sha>
  O->>P: approves the named commit
  P->>P: manual snapshot, then migrate, sync --approve <sha>
  P->>P: verify; record load_run id in the hand-back
```

The engine checks the child's `load_run` for a green run of the same commit before it accepts `--target production`.

### 4.3 Backups: what exists

| Layer | Exists today | Gap |
|---|---|---|
| Neon instant restore | yes: 6-hour window (`history_retention_seconds` 21600), capped at 1 GB-month of change history on Free | 6 hours is short; a bad sync noticed the next day is outside it |
| Neon snapshots | 1 manual snapshot on Free; none taken | take one before each production migration or sync (Q185) |
| Our own nightly `pg_dump` | **no**: planned in 04-stack 1.2 and 05-roadmap, no job, no storage selected | BKP-1 |
| The catalogue | rebuildable from git at any commit | none: the seed is the catalogue's backup |

So only private data needs a backup: accounts (`neon_auth`, provider-owned), `app_user`, `planner_draft`, and later favourites,
submissions and the planner. **Recommendation (Q185): now, a manual Neon snapshot before each production step; before the
first non-owner account, BKP-1:** a nightly `pg_dump --schema=public` of the private tables, encrypted with an `age` public key
whose private key never enters the repository, kept as a GitHub Actions artifact for 7 days, plus a monthly restore into local
Docker. Whether `neondb_owner` can dump `neon_auth` was not tested, so BKP-1 starts with that check. Trade-off: one more
workflow and one key for you to keep.

### 4.4 Migration safety

| Rule | How it holds |
|---|---|
| Additive only | reviewed in every migration task; the runner never drops |
| Applied migrations are immutable | the runner refuses checksum drift and a missing file |
| No out-of-order file | the runner refuses a new file numbered below the last applied one |
| One runner at a time | session advisory lock, fail closed |
| Numbers | **0011 is taken by EML-1's `0011_quota.sql` (on `public/EML-1`, not yet merged)**, while the customisation, favourites, feedback and storage specs still say "0011 is reserved by CUS-C". Recommendation (Q186): no reservations; a spec names its migration by slug (`planner_draft_doc`, `account_favourite`, `research_meta`), and the number is the next free one when the branch merges. Two branches that both add `0012_*` cannot both merge: the runner's duplicate-version guard fails the second one's tests |
| Rehearsed | child first, every time (4.2) |
| Seed after schema | the engine refuses a target whose `schema_migrations` lacks a version it needs (it reads the ledger read-only first) |

## 5. The measured size of the seed

### 5.1 Rows the loader would write from today's JSON

Script: a read-only walk of `data/**` mapping each file family to its target tables (section 2.4). One row per record, link,
photo, relation target, source, town, type node, Val and conflict reading.

| Table | Rows | Table | Rows |
|---|---|---|---|
| `evidence` (5,226 Vals + 115 conflict readings) | 5,341 | `entity_link` | 358 |
| `town` | 4,522 | `place_row`, `place_page` (each) | 358 |
| `record_doc` | 1,147 | `relevance_derived` (rebuilt, not loaded) | 248 |
| `source_local` | 736 | `relevance` | 206 |
| `suitability` | 533 | `media` | 164 |
| `relevance_signal` | 443 | `relation` | 148 |
| `source` | 423 | `area` (locations store chain; countries file adds up to 249) | 94 |
| `type_node` | 398 | `tag` | 81 |
| `entity` (place 201, route 143, offer 49, event 1) | 394 | `leg_cache` | 76 |
| `dataset_file` | 59 | `relevance_class` | 57 |
| `offer` | 49 | `research_gap` | 42 |
| `operator` | 23 | `track` | 17 |
| `trip_row`, `trip_page` (each) | 14 | `research_job` | 12 |
| `capture_supersede` | 3 | `entity_alias` | 2 |
| **Total** | **about 10,500** | `saved_source` (private, **not seeded**) | (36) |

Points (185 rows of `points.json`) are columns of `entity`, not rows. Towns came out at 4,522, above the 1,500 to 3,000
estimate in EXECUTION-PLAN 14.1.

### 5.2 Bytes

| Measure | Value | Method |
|---|---|---|
| Loader input | 5,634,964 bytes (5.6 MB) over 20 file families; largest: suitability 1.42 MB, sources 1.05 MB, relevance 0.63 MB, capture lanes 0.61 MB, towns 0.39 MB | `os.path.getsize` over the files of 2.4 (includes 0.49 MB of derived relevance and 0.12 MB of locations store that are not loaded) |
| The same rows as jsonb in Postgres | **9.1 MB** (9,076,736 bytes) for 17 tables; largest `record_doc` 1.76 MB, `suitability` 1.65 MB, `evidence` 1.37 MB, `place_page` 0.96 MB, `town` 0.71 MB | loaded into a throwaway Postgres 17 (one `jsonb` column per table, `pg_total_relation_size` after `vacuum analyze`) |
| Estimated real load | **14 to 18 MB** | the 9.1 MB plus 50 to 100% for indexes (GiST, GIN on `search`, `tags`, trigram) and typed columns beside `doc` |
| Production today | 44.5 MB logical (empty schema, PostGIS, `neon_auth`) | `neon branches list` |
| Production after a full seed | about 60 to 63 MB, 6% of the 1 GB Free project limit | sum |
| Project after a child rehearsal | about 76 to 81 MB, 8% | the child adds its changes |
| At 10,000 places (P1; about 25 times today's 394 records) | about 450 MB on production; a full child rehearsal on top approaches the 1 GB cap | linear scaling of the 16 MB |

Assumptions: rows grow linearly with records; `entity.doc` and `offer.doc` hold `{}` (Q172), so the record is stored once in
`record_doc` and once as typed columns; `place_page` is approximated by everything known about one ref (average 2.1 KB, largest
6.6 KB); evidence grows with every refresh (RIS-S reports its count). **At P1 scale the rehearsal moves to a schema-only child
plus a sample, or the project moves to Launch** (storage USD 0.35 per GB-month, Neon pricing page 25 Oct).

## 6. The contract LOCAL-C writes (summary for the brief)

### 6.1 Target guard (`core/src/db/target.ts`)

1. Resolve `--target` to a URL: `local` (constant), `ci` (`LOCAL_DATABASE_URL`), `child` (`neon connection-string
   br-damp-breeze-b41mtvn5 --project-id damp-queen-64719841` at run time; never stored or printed), `production`
   (`DATABASE_URL_UNPOOLED` from the root `.env.local`), or a URL.
2. Refuse a `*.neon.tech` URL that is not named `child` or `production`.
3. Refuse `production` unless `--approve <sha>` equals `git rev-parse HEAD`, the tree is clean, and the child's `load_run`
   holds a green run of that commit.
4. Refuse `db:reset` and `db:seed` on any non-loopback host.
5. Print only the target name and host, never the URL, user or password; errors print SQLSTATE codes only (as `runner.ts`).

### 6.2 What is never seeded

| Data | Tables | Rule |
|---|---|---|
| Accounts and sessions | `neon_auth.*`, `app_user`, `user_settings`, `mcp_token`, `push_subscription`, `notification_pref`, `inbound_*` | written only by sign-in and the account routes in their own database |
| Drafts and plans | `planner_draft`, `planner_draft_signal`, `trip` and every 0004 table, `day_state`, `check_dismissal`, `item_memory`, `share_link`, `calendar_feed` | the user's data |
| Household | `household`, `household_member`, `person`, `membership`, `travel_goal`, `saved_place`, `saved_view`, `saved_source`, `visit`, `collection`, `collection_place` | private (R-55, PRIV1) |
| Favourites, submissions, reports, quotas | `account_favourite`, the intake tables, `quota_bucket` (future migrations) | private or operational |
| The owner's list origin | `loc:` and `proto:` keys, saved-post dates and platforms, wishlist status | the privacy detector refuses them in any seeded row |

The engine holds an allowlist of seed-owned tables. A table not on it is never read, written or truncated, and a test asserts
the allowlist and the private-table list are disjoint and together cover `ALL_APP_TABLES` in `core/src/db/inventory.ts`.

### 6.3 Content hash and idempotency

The content hash of a row is sha256 over its canonical JSON (sorted keys, no whitespace, numbers as the JSON had them,
geometry as WKT with 7 decimals) **excluding** `meta.run_id`, `meta.imported_at` and `updated_at`. Before RIS-M the engine reads
target rows back and hashes them the same way; after RIS-M it can compare `meta.imported_from.sha256` first to skip whole files.
An update uses `is distinct from`, so an unchanged row keeps its `version` and `updated_at`.

### 6.4 Plan output (dry run)

One line per table: `table  +inserts  ~updates  -retires  xdeletes  =unchanged`, then up to 20 record ids per change kind,
then the totals and the commit. Exit 0 when there is no difference, 3 when there is (so a script can tell), 1 on an error.

### 6.5 Apply order

Inside one transaction under an advisory lock (a different key from the migration lock): vocab, `area`, `town`, `operator`,
`source`, `entity`, `offer`, `entity_alias`, `relation`, `entity_link`, `media`, `track`, `suitability`, `relevance`,
`relevance_signal`, source tier, `evidence` (append only), research tables, `leg_cache`, `freshness_rule`, projections,
`catalogue_meta` (the revision) last, then the `load_run` row.

### 6.6 Sync tests (added to RIS-T)

1. A dry run on a database at commit A against commit B lists exactly the record ids that differ.
2. A retired ref keeps its `entity` row (`status = 'retired'`) and its `saved_place` rows.
3. A private table's rows (a fixture `planner_draft` and `saved_place`) are unchanged after a sync.
4. A second sync of the same commit writes 0 rows.
5. `db:sync --commit A` after B restores the serving tier byte for byte.
6. `--target production` without `--approve`, with a dirty tree, or with no green child run exits 2 before connecting.

## 7. Conflicts with existing decisions

| # | Existing decision or text | Conflict | Resolution |
|---|---|---|---|
| L1 | [08-self-hosted.md](../08-self-hosted.md) (Supabase in Docker on a home server, superseded 24 Oct) | this page brings Docker back | different scope: plain Postgres for development and CI only; nothing is hosted in Docker. 08 stays historical |
| L2 | EXECUTION-PLAN banner and change log, 24 Oct: "Supabase CLI, Docker and generated-types steps removed as historical" | a Docker Postgres is current again | those steps were Supabase-specific; a pointer is added to 4.8 |
| L3 | EXECUTION-PLAN D9 and 4.8: SRV-0 after the E features, flags off | LOCAL-1 to LOCAL-3 start now and take part of RIS-L forward | Q180; they change no served page, write nothing to Neon and keep `CATALOGUE_STORE=json` |
| L4 | The "flags off" rule (EXECUTION-PLAN 5.2) | none if kept | `CATALOGUE_STORE` defaults to `json`; production is seeded only when a seam is about to flip (Q183) |
| L5 | [catalogue-intake-and-storage.md](catalogue-intake-and-storage.md) 9 and 10: Neon Free storage 0.5 GB | the plan page and the CLI say 1 GB per project (`branch_logical_size_limit` 1024 MB) | 1 GB from 25 Oct; noted there |
| L6 | The same page 4.3 and BACKLOG 15.136: "0011 is reserved by CUS-C"; CUS-C, favourites and feedback specs say the same | EML-1 uses `0011_quota.sql` | Q186: number at merge, slug in specs |
| L7 | RIS-L (15.137) as one 10 h task in the SRV-0 window | its engine, guard and reference families move to LOCAL-C and LOCAL-2 now | RIS-L keeps the record families, evidence, run records, changesets and run-id rollback, about 7 h |
| L8 | 05-roadmap: "CI ... against a throwaway Postgres + PostGIS container" (historical banner) | it becomes current | LOCAL-4 delivers it |

## 8. Tasks

Model rule (CLAUDE.md): shared contracts and security are Opus; compose, scripts and specified code are Sonnet; reviews are
never below the model that wrote the work. Every hand-back records the model.

| Task | What | Agent, model | Effort | Depends on | BACKLOG | Merges with |
|---|---|---|---|---|---|---|
| LOCAL-1 | `tools/db/Dockerfile`, `compose.yml`, `init/*.sql` (roles, extensions, `neon_auth` stub, template), `tools/db/wait.mjs`, root `db:up`, `db:down`, `db:reset`, `db:migrate`, `db:psql`, `db:url`; `core/test/db/**` green against local; the stub drift test | travel-builder, Sonnet | 5 h | Q181 (Docker running) | 15.141 | new |
| LOCAL-C | `core/src/db/target.ts` (guard, 6.1), `core/src/catalogue/postgres/load/contract.ts` (table allowlist, private list, natural keys, apply order, canonical hash, never-delete rules, plan format), tests | travel-builder, Opus | 4 h | none (parallel with LOCAL-1) | 15.142 | takes RIS-L's contract part |
| LOCAL-2 | `core/bin/load-catalogue.ts` (build, plan, apply, verify), `core/src/catalogue/postgres/load/engine.ts` and `reference.ts`; families: vocab, area, town, operator, source; `db:seed`, `db:sync`, `db:verify` | travel-builder, Sonnet; Opus review | 8 h | LOCAL-1, LOCAL-C | 15.143 | **the first part of RIS-L** |
| LOCAL-3 | `check-all` stage: offline `build --check`; with a reachable local server, the throwaway-database round trip and idempotency step; `CI=true` makes a skip fail | travel-builder, Sonnet | 3 h | LOCAL-2 | 15.144 | new |
| LOCAL-4 | `.github/workflows/check.yml` (3.6); `tools/tree_contract.json` gains `.github` | travel-builder, Sonnet | 4 h | LOCAL-3; Q182 | 15.145 | delivers 05-roadmap's CI line |
| RIS-J | today's JSON into the contract | travel-builder, Sonnet | 6 h | none now | 15.133 | existing |
| RIS-M | the storage migration (number at merge) | travel-builder, Opus | 6 h | Q177, Q186 | 15.136 | existing |
| RIS-L (remainder) | capture, sidecars, source tier, evidence, run records, changesets, `meta` stamping, run-id rollback, projections, as families of the LOCAL-2 engine | travel-builder, Sonnet; Opus review | 7 h (was 10) | RIS-M, RIS-J, LOCAL-2 | 15.137 | existing, reduced |
| RIS-T | round trip, idempotency, rollback, privacy, size, parity, plus the sync tests of 6.6; runs on local Docker, then on the child | travel-builder then travel-verifier, Sonnet | 6 h (was 5) | RIS-L | 15.138 | existing, extended |
| LOCAL-5 | `db:rehearse`: child reset from production, delete copied sessions, migrate, sync, verify, child suites, one report | travel-builder, Sonnet; coordinator runs it | 2 h | RIS-L | 15.146 | new |
| SRV-0 store | `PostgresStore` and the contract kit per method | travel-builder | 24 h | RIS-T | EXECUTION-PLAN 4.8 | existing, unchanged |
| BKP-1 | encrypted nightly dump of private tables, artifact retention, monthly restore test into Docker; first: can `neondb_owner` dump `neon_auth` | travel-builder, Opus design 3 h, Sonnet build 3 h | 6 h | LOCAL-4; Q185; before the first non-owner account | 15.147 | new |
| MIG-N | migration numbering: reword the four specs that reserve 0011 to slugs; note "numbers taken" in NEON-MIGRATIONS | coordinator (docs) | 0.5 h | Q186 | 15.148 | new |
| Reviews | LOCAL-C and BKP-1 security review; LOCAL-2 code review | Opus reviewer | 2 h | each task | in each row | |

New work: about 34 h (LOCAL-1 5, LOCAL-C 4, LOCAL-2 8, LOCAL-3 3, LOCAL-4 4, LOCAL-5 2, BKP-1 6, reviews 2); Opus 10 (LOCAL-C 4,
BKP-1 design 3, reviews 3 with the LOCAL-2 review), Sonnet 24. RIS-L falls by 3 h and RIS-T rises by 1 h, so the RIS and SRV-0
totals change by minus 2 h.

### 8.1 Build order

```mermaid
flowchart LR
  classDef now fill:#1F4E79,stroke:#163A5A,color:#FFFFFF
  classDef later fill:#2A7F8F,stroke:#1E5F6B,color:#FFFFFF
  classDef gate fill:#9B2C2C,stroke:#6B1E1E,color:#FFFFFF
  classDef infra fill:#5A6772,stroke:#3E4850,color:#FFFFFF

  L1["LOCAL-1<br/>Docker + migrate + RLS tests"]:::now
  LC["LOCAL-C<br/>contract + guard"]:::now
  RJ["RIS-J<br/>JSON into contract"]:::now
  L2["LOCAL-2<br/>engine, reference tables"]:::now
  L3["LOCAL-3<br/>drift gate"]:::now
  L4["LOCAL-4<br/>CI (Q182)"]:::infra
  RM["RIS-M<br/>migration (Q177)"]:::gate
  RL["RIS-L remainder"]:::later
  RT["RIS-T + sync tests"]:::later
  L5["LOCAL-5<br/>child rehearsal"]:::later
  S0["SRV-0 PostgresStore"]:::later
  P["production per seam<br/>(named commit)"]:::gate

  L1 --> L2
  LC --> L2
  L2 --> L3 --> L4
  RJ --> RL
  RM --> RL
  L2 --> RL --> RT --> L5 --> S0 --> P
```

Waves: **now** LOCAL-1, LOCAL-C and RIS-J in parallel (disjoint files); then LOCAL-2; then LOCAL-3 and LOCAL-4. **Next** RIS-M
on the child (production on Q177). **SRV-0 window** RIS-L remainder, RIS-T, LOCAL-5, the store, then the seams.

### 8.2 Briefs (self-contained)

Common to every brief. **Must not touch:** `HANDOVER.md`, `CLAUDE.md`, `legacy/**`, `web/app/themes.css`,
`data/catalogue/slugs.json`, `data/capture/migration-ledger.json`, any `data/**` file (these tasks read data, never write it),
existing migrations `0001` to `0010`, files another running lane owns (check `git worktree list` and the roadmap's run table).
**Never:** connect to Neon production; print or commit a connection string, password or key; read the root `.env.local`
except through `core/src/db/target.ts`. **Verification:** `pnpm --dir core typecheck` and `pnpm --dir web exec tsc --noEmit`
clean; `pnpm --dir core test` passes; `bash tools/check-all.sh` passes; `python3 tools/tree_check.py` passes. No task changes
a page, so Playwright screenshots are a regression check only: `/`, `/places/rawson-lake/` and the Rockies trip page at 1440
and 390 in light and dark, saved to `web/test-results/shots/` (gitignored, outside any running e2e) and compared with `main`;
no difference is expected. **Commit rules:** a branch from `main` in its own worktree; `git -C <worktree> add <owned paths>`
only, never `-A`; message `<type>(LOCAL-n): <what>` ending with the session's `Co-Authored-By` trailer; no push, no merge; the
hand-back names the model used and pastes the commands run with their exit codes.

**LOCAL-1 (Sonnet).** Goal: `pnpm db:up && pnpm db:migrate` gives a local database that behaves like Neon for everything
except Auth and Realtime. Owns `tools/db/**` (new), the `db:*` script lines in the root `package.json`, `core/test/db/stub.test.ts`
(new), and a precedence fix in `web/scripts/with-root-env.mjs` only if `DATABASE_URL` from the process does not win today.
Steps: the Dockerfile of 3.1 (`postgres:18-trixie`, `postgresql-18-postgis-3` pinned to 3.6); `compose.yml` with the settings
of 3.1; the four init files of 3.2 (the stub copies the three tables' columns exactly as listed there); `wait.mjs`; the
scripts of 2.3 that need no engine (`up`, `down`, `reset` without seed, `migrate`, `psql`, `url`), each resolving `local` only.
Acceptance: on a fresh volume, `db-migrate.ts up` applies 0001 to 0010 and a second run says "up to date"; `TEST_DATABASE_URL`
set to the local URL runs `core/test/db` with 0 skipped and all passing; `select rolbypassrls from pg_roles where rolname =
'neondb_owner'` is true and false for `travel_app`; extension versions print 18.x and PostGIS 3.6.x; the stub test passes
locally and, with the child URL, compares column lists; `db:reset` refuses a non-loopback URL; `docker compose down` keeps the
data, `db:reset` removes it.

**LOCAL-C (Opus).** Goal: the contract every seed task reads, and the guard that keeps production safe. Owns
`core/src/db/target.ts` (new), `core/src/catalogue/postgres/load/contract.ts` (new), tests under `core/test/db/target.test.ts`
and `core/test/catalogue/load-contract.test.ts`. Steps: 6.1 to 6.5 exactly; export the seed-owned allowlist and the private list.
Acceptance: the allowlist and private list are disjoint and cover `ALL_APP_TABLES` plus `RLS_EXEMPT_TABLES`; a `.neon.tech`
URL passed as a plain URL fails; `production` without `--approve`, with a wrong sha or a dirty tree fails before any
connection (a fake `connect` that throws proves no connection was tried); no error message contains a URL, user or password
(tested with a URL holding a sentinel password); the canonical hash of the same row built twice is equal and ignores
`meta.run_id`, `meta.imported_at` and `updated_at`.

**LOCAL-2 (Sonnet, Opus review).** Goal: `pnpm db:seed` and `pnpm db:sync --dry-run` work locally for the reference tables.
Owns `core/bin/load-catalogue.ts` (new), `core/src/catalogue/postgres/load/engine.ts` and `reference.ts` (new), the engine
script lines in `package.json`, tests under `core/test/catalogue/load-*.test.ts`. Steps: `build` (pure, from the working tree
for `local`, from `git show <sha>:<path>` for every other target), `plan`, `apply`, `verify`; families vocab, area, town,
operator, source as in 2.4; a `load_run` row only after RIS-M (until then, a `catalogue_meta` key `seed_commit`). Acceptance:
on a migrated local database, `db:seed` writes 398 type nodes, 81 tags, 57 relevance classes, 4,522 towns, 23 operators and
423 sources (counts as of 196207e; take them from the data at build time); a second `db:sync` writes 0 rows; editing one
town's name in a scratch copy shows exactly one update in the dry run; `db:verify` exits 0 after a seed and 1 after a manual
`update town`; `travel_app` can read the seeded rows (public read) and still cannot read `trip`.

**LOCAL-3 (Sonnet).** Goal: a JSON change that the database cannot hold fails the gate. Owns one stage line in
`tools/check-all.sh` and `tools/db/seed-check.mjs` (new). Steps: 2.6 rows one to three. Acceptance: with Docker off, the stage
prints `SKIPPED (no local Postgres)` and passes, and with `CI=true` it fails; with Docker on, it creates and drops
`seed_check_<pid>`; a fixture with a dangling `area_id` fails the offline step; two worktrees running `check-all` at once do
not collide.

**LOCAL-4 (Sonnet).** Goal: the gate runs on every push and pull request. Owns `.github/workflows/check.yml` (new) and the
`top_level_folders` entry in `tools/tree_contract.json`. Steps: 3.6. Acceptance: a run on a branch is green; the gate job has
no secrets in its environment (asserted by a step that fails if `DATABASE_URL` is set); the manual `child-db` job passes 29 of
29 (or the count at build time) with 0 skipped.

**LOCAL-5 (Sonnet; the coordinator runs it).** Goal: one command rehearses a production change on the child. Owns
`tools/db/rehearse.mjs` (new) and its `package.json` line. Steps: `neon branches reset br-damp-breeze-b41mtvn5 --parent
--project-id damp-queen-64719841` behind a typed confirmation; delete every row of `neon_auth.session` on the child; migrate;
sync dry run, then sync; verify; `core/test/db` and RIS-T with `TEST_DATABASE_URL` from the CLI at run time; one report with the
commit, the plan totals, the `load_run` id and every exit code. Acceptance: the report names the commit and the child; no
connection string appears in the output or the report; the script refuses to run if the branch id resolves to the default
branch.

**BKP-1 (Opus design, Sonnet build).** Goal: private data survives a mistake noticed after Neon's 6-hour window. Owns
`.github/workflows/backup.yml` (new), `tools/db/backup.mjs` and `restore-test.mjs` (new). Steps: first test whether
`neondb_owner` can `pg_dump` `neon_auth`; dump the private tables of 6.2 nightly; encrypt with `age` to the owner's public key
(stored as a secret); upload as an artifact with 7-day retention; a monthly restore into Docker that counts rows. Acceptance:
an artifact exists after a manual run; it cannot be read without the private key; the restore test passes; nothing
unencrypted is written to the runner's disk outside a temp dir removed at the end.

## 9. Gotchas

- **The name "loader" is taken.** `core/src/db/loader.ts` loads migration files. The data engine lives in
  `core/src/catalogue/postgres/load/**` and `core/bin/load-catalogue.ts`.
- **The root `.env.local` holds production values.** `web/scripts/with-root-env.mjs` injects them into `pnpm dev` and
  `build`. The `db:*` scripts must never fall back to `DATABASE_URL`; `core/bin/db-migrate.ts` does today
  (`--url`, then `DATABASE_URL_UNPOOLED`, then `DATABASE_URL`), so it must be called through the target resolver.
- **`neondb_owner` bypasses RLS on Neon.** Any query outside `withUserTransaction` runs with full access. The local owner
  role copies that, so a missing `set local role` shows up in local tests the same way it would in production.
- **A child reset copies production's accounts.** `neon branches reset --parent` brings production's `neon_auth` rows,
  including live sessions, into the child. LOCAL-5 deletes `neon_auth.session` on the child straight after a reset.
- **`saved_place` cascades on entity delete.** The sync retires; it never deletes an entity or an offer.
- **Compute hours are per project.** Heavy test loops on the child spend the same 100 CU-hours a month as production; the
  project's autoscaling maximum is 2 CU, which burns 2 CU-hours an hour under load.
- **`postgis/postgis` is amd64 only.** Do not "simplify" the Dockerfile to it; on the owner's M1 it runs under emulation.
- **PostGIS is not a trusted extension.** Locally the superuser creates it in the init script; on Neon, `neondb_owner`
  creates it through `neon_superuser`. 0001 must keep `create extension if not exists`.
- **Port 54329, not 5432.** A Homebrew `postgresql@17` is installed on the Mac (not running on 25 Oct).
- **`.env.*` is gitignored**, so `.env.example` would be ignored too; the defaults live in code.
- **A new top-level folder breaks the folder contract** until `tools/tree_contract.json` lists it (`.github`, Q182).
- **`data/seed/prototype/` is not the database seed.** It feeds the web snapshot (CLN-3). The database seed is `data/**` as a
  whole; do not move files into `data/seed/`.
- **The content hash must ignore stamps.** `meta.run_id`, `meta.imported_at` and `updated_at` change on every write; hashing
  them would make every sync rewrite every row.
- **Non-local targets read committed files only.** A dirty tree would seed data that no commit can reproduce.
- **Seeding production before RIS-M is unsafe.** 0003 grants `travel_app` select on whole tables, including `entity.doc` and
  `offer.doc`; the column-list grants of RIS-M must be on production before any record reaches it (Q172, RI-6).
- **Migration numbers collide across branches.** EML-1 holds 0011; any other branch that adds 0011 fails the runner's
  duplicate guard when both are on `main`.

## 10. Owner questions

| # | Question | Recommendation and trade-off |
|---|---|---|
| Q180 | Start LOCAL-1, LOCAL-C, LOCAL-2 and LOCAL-3 now, ahead of the SRV-0 window that EXECUTION-PLAN D9 sets? | **Yes.** They change no page, write nothing to Neon and keep `CATALOGUE_STORE=json`, and they take the risk out of SRV-0. Trade-off: about 20 h of builder time now, beside the E features |
| Q181 | Use Docker Desktop (already installed) as the local database runtime, and start it now? | **Yes, Docker Desktop**, set to start at sign-in; Colima if you prefer no desktop app. Trade-off: about 2 GB of memory while it runs |
| Q182 | Allow a `.github/` top-level folder for the first CI workflow (the gate on every push and pull request, no secrets; a manual child-branch job)? | **Yes.** It is the only way the drift gate runs on a clean machine. Trade-off: about 10 to 15 Actions minutes a run against the private repo's free 2,000 a month |
| Q183 | Seed Neon production only when the first 14.2 seam is ready to flip, not as soon as the loader works? | **Yes.** Until something reads it, a production copy can only go stale. Trade-off: the production catalogue tables stay empty for longer |
| Q184 | No new long-lived Neon dev branch: Docker for daily work and CI; the existing child for Auth, Realtime and rehearsals, reset from production before each rehearsal? | **Yes.** It keeps the 100 CU-hours for production. Trade-off: Auth and Realtime work still needs the network, and a reset wipes the child's own test accounts |
| Q185 | Backups: a manual Neon snapshot before each production step from now on, and the encrypted nightly dump (BKP-1) before the first non-owner account? | **Yes.** The catalogue is in git; only private data needs a backup, and today it is only yours. Trade-off: a 6-hour restore window until BKP-1 lands |
| Q186 | Assign migration numbers at merge and name migrations by slug in specs (0011 is now EML-1's `quota`; CUS-C, favourites, feedback and RIS-M renumber)? | **Yes.** Reservations have already collided once. Trade-off: specs cannot cite a number until merge |
| Q187 | Keep the private parts of `data/locations/locations.json` (collections, saved posts, wishlist status) in git only, and load them into your account's private tables only when the planner needs them? | **Yes.** Loading needs your Neon Auth user id, which exists only in production, and nothing reads those tables yet. Trade-off: your list stays file-based for now |

## 11. Not verified

- Whether a new Neon branch gets a working Neon Auth endpoint of its own, and how a reset treats the child's Auth settings
  (Google client, trusted origins).
- Whether branch expiry works on the Free plan: the CLI has the flags; the plans page does not say.
- Whether `neondb_owner` can dump `neon_auth` (BKP-1 starts with it).
- The 14 to 18 MB load size is an estimate: the 9.1 MB is a jsonb approximation in Postgres 17 without indexes or PostGIS
  types.
- The CI workflow sketch was not run; Actions minutes per run are an estimate.
- The PGDG package version for PostGIS 3.6 on `postgres:18-trixie` arm64 was not built here.
- Whether `with-root-env.mjs` lets the process environment win for `DATABASE_URL` (it does for the auth variables).

## 12. Build notes: LOCAL-C (the seed contract and the target guard, 25 Oct 2026)

Built by travel-builder (Opus 5.5), branch `public/LOCAL-C`. New files only: `core/src/seed/**`, `core/src/config/database.ts`,
`core/test/seed/**`, this section and rows in `research/tools.md`. No database, Docker or Neon command was run; nothing reads
`DATABASE_URL` from the environment.

### 12.1 Where it lives (differs from 6.1 and 8.2)

The coordinator's brief put the contract and the guard in `core/src/seed/` rather than `core/src/db/target.ts` and
`core/src/catalogue/postgres/load/contract.ts`, because LOCAL-1 runs in parallel and owns the local target resolver. The split:
**the guard decides** (pure, `core/src/seed/guard.ts`), **the resolver resolves** (LOCAL-1's `core/src/db/target.ts`: a name to a
URL, the local constant, `neon connection-string` for the child, the root env file for production) and calls the guard before it
returns a URL to anyone. The engine (LOCAL-2) lives in `core/src/catalogue/postgres/load/**` as 8.2 says and imports the contract
from `core/src/seed/`.

| Module | What it holds | Pure |
|---|---|---|
| `core/src/config/database.ts` | Neon project, production endpoint `ep-quiet-leaf-b4oz2a4v`, production branch `br-soft-glade-b4mkqyvd`, child branch `br-damp-breeze-b41mtvn5`, `.neon.tech`, loopback hosts, local host and port 54329, the env keys whose hosts are production, the seed advisory lock key (migration key + 1), the rehearsal folder and maximum age, coordinate decimals, plan sample size | yes |
| `seed/contract.ts` | `SEED_TABLES` (apply order, family, owner task, input globs, key, identity, mode, `onMissing`, retire column, set and geometry columns), `DELETE_ORDER`, `NOT_SEEDED` with a class and reason per table, `PRIVATE_CLASSES`, `FUTURE_TABLES`, `NEVER_TOUCH_SCHEMAS`, `NEVER_READ_INPUTS`, `SEED_FORBIDDEN_KEYS`, `assertSeedTable`, `assertDeletable`, `SEED_COMMIT_KEY`, `LOAD_RUN_TABLE`, `SEED_CONTRACT_VERSION` | yes |
| `seed/hash.ts` | `canonicalRow`, `contentHash`, `rowId`, `derivedId`, `tableHash`, `geometryWkt`, `seedRunId`, `stampSeedMeta` (wraps RIS-N's `stampImportedFrom`) | yes |
| `seed/plan.ts` | `classifyRow` (the idempotency and never-delete rule), `planTable`, `seedPlan`, `formatPlan` (6.4), `planWrites`, `planExitCode` (0 same, 3 differs, 1 error) | yes |
| `seed/drift.ts` | the `seed-drift/1` result of `db:verify`: `compareTable`, `driftResult`, `formatDrift`, `driftSummary`, `driftExitCode` (0 or 1) | yes |
| `seed/guard.ts` | `describeTarget` (URL to host, port, database; credentials dropped), `hostsFromEnvText`, `isProductionHost`, `guardTarget`, `assertTarget`, `guardedConnect`, `targetFactsSchema` | yes |
| `seed/rehearsal.ts` | the `seed-rehearsal/1` evidence file: schema, `checkRehearsal`, `rehearsalEvidenceText` | yes |
| `seed/privacy.ts` | `inputRefusals` (deny list), `rowRefusals` (origin refs and the owner's list keys, by path, never by value) | yes |
| `seed/io.ts` | `readRepoState` (HEAD, clean tree), `readRehearsal`, `readProductionHosts` (hosts only), `expandInputs` (globs to files, denied files reported) | no: the one module that reads the machine |
| `seed/schemaRefs.ts` | `createdTables`, `tableReferences`, `hasColumn`: what the migrations' SQL says, so the tests prove the contract against the schema | yes |

### 12.2 The guard's decision table

Evaluated top to bottom; the first matching row decides. Every refusal exits 2 before any connection (`guardedConnect` never calls
`connect` on a refusal). "Kind" is the declared kind: the target name (`local`, `ci`, `child`, `production`), or `--target-kind`
for a URL; a name and a flag that disagree are refused.

| # | Condition | Result |
|---|---|---|
| 1 | `--target` is not a URL or a known name | refuse `E_TARGET_NAME` |
| 2 | no host, or a host that is not a bare host name | refuse `E_TARGET_HOST` |
| 3 | `--target-kind` not one of local, ci, child, production | refuse `E_KIND_UNKNOWN` |
| 4 | the name and `--target-kind` disagree | refuse `E_KIND_MISMATCH` |
| 5 | loopback host, kind child or production | refuse `E_LOOPBACK_KIND` |
| 6 | loopback host, kind none, local or ci | **allow** every operation (local, or ci) |
| 7 | non-loopback, no kind (a pasted URL, `.neon.tech` or not) | refuse `E_KIND_REQUIRED` |
| 8 | a production host (endpoint `ep-quiet-leaf-b4oz2a4v`, pooled or direct; a host of the root env file's `DATABASE_URL` or `DATABASE_URL_UNPOOLED`; or branch hint `br-soft-glade-b4mkqyvd`) under any kind but production | refuse `E_PRODUCTION_UNDECLARED` |
| 9 | kind local or ci on a non-loopback host | refuse `E_LOCAL_NOT_LOOPBACK` |
| 10 | kind production on a host that is not production | refuse `E_PRODUCTION_HOST` |
| 11 | kind child on a non-Neon host | refuse `E_CHILD_NOT_NEON` |
| 12 | kind child with a branch hint other than the child branch | refuse `E_CHILD_BRANCH` |
| 13 | kind production with a branch hint other than the production branch | refuse `E_PRODUCTION_HOST` |
| 14 | operation `reset` or `seed` on a non-loopback host | refuse `E_LOOPBACK_ONLY` |
| 15 | kind child, any other operation (migrate, sync, dry run, verify, psql) | **allow**, no approval |
| 16 | production, `psql` | refuse `E_PRODUCTION_SHELL` |
| 17 | production, `sync_dry_run` or `verify` (read only) | **allow**, no approval |
| 18 | production write (migrate, sync), no `--approve` | refuse `E_APPROVE_REQUIRED` |
| 19 | `--approve` not a full 40-hex sha | refuse `E_APPROVE_FORMAT` |
| 20 | HEAD or the tree state could not be read | refuse `E_REPO_STATE` |
| 21 | `--approve` is not HEAD | refuse `E_APPROVE_MISMATCH` |
| 22 | `--commit` given and not HEAD | refuse `E_COMMIT_NOT_HEAD` |
| 23 | the working tree is not clean (a tracked change or an untracked file that is not ignored) | refuse `E_DIRTY_TREE` |
| 24 | no rehearsal file for HEAD / it does not parse or match `seed-rehearsal/1` / other contract version / other commit / not the child branch, or a production host / not green (status, verify, or a required step missing, non-zero or with skips) / older than 72 h | refuse `E_REHEARSAL_MISSING` / `_INVALID` / `_CONTRACT` / `_COMMIT` / `_TARGET` / `_FAILED` / `_STALE` |
| 25 | otherwise | **allow** production |

Output rule: the only target facts any decision, message, plan or drift result holds are the name, the kind and the host
(`targetFactsSchema` refuses anything else in a host). The tests run every operation, host, name and flag combination with a URL
holding a sentinel password and assert no output contains the password, the user, `postgres://` or a query string.

### 12.3 The rehearsal evidence file (`seed-rehearsal/1`)

`tools/.cache/db-rehearsal/<commit>.json` (gitignored with the tool cache; per checkout, so the coordinator rehearses and approves
from the same checkout). Written by LOCAL-5 through `rehearsalEvidenceText`; strict, with no free text:

```json
{
  "schema": "seed-rehearsal/1",
  "commit": "<40 hex>",
  "contract_version": 1,
  "target": { "kind": "child", "branch_id": "br-damp-breeze-b41mtvn5", "host": "<bare host>" },
  "started_at": "<ISO>", "finished_at": "<ISO>",
  "steps": [ { "name": "reset", "exit": 0, "skipped": 0 }, "... delete_sessions, migrate, sync_dry_run, sync, verify, db_tests, ris_t" ],
  "plan_totals": { "insert": 0, "update": 0, "retire": 0, "delete": 0, "unchanged": 0, "retained": 0 },
  "verify": { "ok": true, "tables": 0, "differing": 0 },
  "load_run_id": null,
  "status": "green"
}
```

Required green steps: reset, delete_sessions, migrate, sync, verify, db_tests (exit 0, 0 skipped). `sync_dry_run` may exit 3;
`ris_t` joins the required list when RIS-T exists. After RIS-M, the engine also confirms the child's `load_run` row for the commit;
the file stays the proof checked before any connection.

### 12.4 What is never seeded, and how it is tested

`NOT_SEEDED` classifies 54 tables (53 on `main` plus EML-1's `quota_bucket`, listed in `FUTURE_TABLES` so that branch merges
already classified): account 7, plan 24 (every 0004 table, the drafts and the signal, day state, dismissals, memories, share
links, feeds, template decisions), household 12 (including `calendar_window`, whose custom rows carry a household), operational 5
(`op_event`, `fx_rate`, `coverage`, `backlog`, `quota_bucket`), unsourced 6 (`condition_report`, `event_occurrence`,
`pack_template`, `document_rule`, `lane`, `trip_type`: no JSON family yet; giving one a family moves it into `SEED_TABLES` on
purpose). `neon_auth` is never touched. Tests (`core/test/seed/contract.test.ts`):
- the allowlist (34 tables) and `NOT_SEEDED` are disjoint and together equal `ALL_APP_TABLES` plus `RLS_EXEMPT_TABLES`; a
  classified table is in the inventory or in `FUTURE_TABLES`;
- every `create table` in `core/src/db/migrations/*.sql` is classified, so a new migration table fails even if the inventory is
  not updated; a fixture `create table account_secret_thing` shows the failure;
- no seed table has a `household_id`, `user_id`, `owner_id` or `trip_id` column or references `household`, `trip` or `planner_draft`;
- `assertSeedTable` throws for every table outside the allowlist; the engine calls it before every statement;
- `NEVER_READ_INPUTS` refuses the inbox, the migration ledger, the gap budget, local-only relevance inputs, the town anchors
  (`data/reference/towns/anchors.json`: coordinates near the owner's places) and the wishlist; `expandInputs` reports, never
  returns, a denied file; the locations store is read for `countries`, `regions` and `areas` only;
- every seed input file today is free of `loc:`/`proto:` refs and of the owner's list keys.

### 12.5 Retire, never delete; idempotency; hashes

- `onMissing`: **retire** `entity`, `offer` (`status = 'retired'`; a seeded row that was retired is updated back to live);
  **keep** `type_node`, `area`, `town`, `operator`, `source`, `evidence`, `catalogue_meta` (no status column, or history); **delete**
  the rest (catalogue-owned children, sidecars, source tier, research, cache, rules, projections). Tested from the migrations: the
  four tables a non-seed table points at (`area`, `entity`, `offer`, `source`) never delete, and no row a retained row points at
  can be deleted (closure). `assertDeletable` refuses the others; TRUNCATE is never allowed.
- Deletes run in `DELETE_ORDER` (reverse of the apply order); the apply order is tested as a topological order of every foreign
  key between seed tables.
- Hash: sha256 of the catalogue revision's `canonicalJson` of the row, set columns sorted, geometry as WKT with 7 decimals. **It
  also excludes `meta.imported_from`, `meta.first_run_id`, `version` and `dataset_file.loaded_at`** beside 6.3's three: a file's
  sha256 moves when any record in it moves, and hashing it would show every row of an edited file as updated (LOCAL-2's
  acceptance needs one town edit to be one update). So `meta.imported_from` means "the file version that last changed this row".
  The engine hashes the same column set on both sides; columns the database fills alone are in neither.
- Append-only: an `evidence` row whose content changed under the same key is an error (`E_SEED_APPEND_ONLY`), never an update.
- Run id: `seed-<UTC yyyymmddThhmmssZ>-<12 hex of the commit>`, valid under RowMeta's `RUN_ID_RE`.

### 12.6 Interfaces other tasks consume

| Task | Uses |
|---|---|
| LOCAL-1 | `core/src/db/target.ts` resolves a name to a URL, then: `const d = assertTarget({ operation, target: describeTarget(url, name, branchId), flags, repo: readRepoState(root), productionHosts: readProductionHosts(root), rehearsal: readRehearsal(root, head) })`; prints only `d.label`. `db:reset` passes `operation: "reset"` (refused off loopback by row 14). `LOCAL_DB_HOST`, `LOCAL_DB_PORT` from `core/src/config/database.ts`. The migrate wrapper passes `operation: "migrate"` |
| LOCAL-2 | `SEED_TABLES` filtered by `owner === "LOCAL-2"` (type_node, tag, relevance_class, area, town, operator, source, catalogue_meta); `expandInputs` for files; `inputRefusals`, `rowRefusals` before writing; `contentHash`, `rowId`; `planTable` per table then `seedPlan`, `formatPlan`, `planExitCode`; `assertSeedTable` before every statement and `assertDeletable` before every delete; `SEED_ADVISORY_LOCK_KEY`; `seedRunId`; `SEED_COMMIT_KEY` until `load_run`; `guardedConnect` as the only way to open the target |
| LOCAL-3 | `compareTable` per table, `driftResult`, `driftExitCode`, `formatDrift`; a second `planWrites` of 0 is the idempotency step |
| LOCAL-5 | writes the evidence with `rehearsalEvidenceText`, `verify` from `driftSummary`, at `rehearsalPath(root, commit)` |
| RIS-L | its families from `SEED_TABLES` (`owner === "RIS-L"`), `derivedId` for link, media, change and gap ids, `stampSeedMeta` on `META_TABLES` rows |
| RIS-M | adds `load_run` (`LOAD_RUN_TABLE`); must add the new table to the inventory and classify it (the test fails otherwise); a status column on `area` or `source` would let them retire instead of keep (contract version bump) |

### 12.7 Differences from the text above

- `db:seed` is loopback only (6.1 item 4), not "local, ci, child" (2.3): the child gets data through `db:sync`, the same engine.
- `ci` is loopback only (a service container mapped to 127.0.0.1, as 3.6 sketches).
- A target name declares its kind; `--target-kind` is needed only for a URL. Production also needs the known production host.
- `psql` on production is refused; `migrate` on production needs the same approval, clean tree and green rehearsal as a sync (4.2
  rehearses before every production migration).
- On production `--commit` must equal HEAD: a rollback to an earlier commit checks that commit out, rehearses it and approves it.
- The guard checks a rehearsal FILE before connecting; 4.2's "the child's `load_run`" check follows once RIS-M adds the table.
- `area`, `town`, `type_node`, `operator` and `source` are kept, not deleted, when the seed drops a row (no status column; retired
  rows and private tables point at them). The plan shows them as retained.

## Change log

| Date | Change |
|---|---|
| 2026-10-25 | First version (travel-planner, Opus): answer to "is migration blocked", the seed-of-record strategy, local Docker matching Neon, the Neon side, measured seed size, tasks LOCAL-1 to LOCAL-5, LOCAL-C, BKP-1, MIG-N, conflicts L1 to L8, Q180 to Q187 |
| 2026-10-25 | LOCAL-C built (travel-builder, Opus 5.5), branch `public/LOCAL-C`: `core/src/seed/**`, `core/src/config/database.ts`, section 12 |

Sources for Neon and Docker facts: [Neon plans](https://neon.com/docs/introduction/plans) (Free: 1 GB per project, 10 branches,
100 CU-hours, 6-hour restore window, 1 manual snapshot; Launch storage USD 0.35 per GB-month), the Neon CLI 8.11.1 help
(`branches reset --parent`, `set-expiration`, `create --expires-at`, `--schema-only`), [Docker Hub postgis/postgis
tags](https://hub.docker.com/r/postgis/postgis/tags) (amd64 only for 18-3.6), [Docker Hub imresamu/postgis
tags](https://hub.docker.com/r/imresamu/postgis/tags) (amd64 and arm64).
