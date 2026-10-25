# Local database: usage (LOCAL-1)

Spec: [local-database-and-seed-sync.md](local-database-and-seed-sync.md). This page is the how-to. A Postgres 18 with PostGIS 3.6
(the same minors as Neon production, 18.6 and 3.6.4) runs in Docker on `127.0.0.1:54329`. Migrations 0001 to 0010 apply to it
unchanged and `core/test/db` runs against it with nothing skipped. It models Auth and Realtime only as far as plain Postgres
can: see "What it does not do".

## Start Docker Desktop

1. `open -a Docker`, then wait for "Engine running" in the menu bar (about 20 seconds).
2. Check: `docker info --format '{{.ServerVersion}}'` prints a version.
3. Optional: Docker Desktop, Settings, General, "Start Docker Desktop when you sign in".

If the engine is off, every `db:*` command that needs it says so and exits 3.

## Commands (repo root)

| Command | Does |
|---|---|
| `pnpm db:up` | creates the credentials file on first use, builds `travel-pg18:local` (first time about a minute), starts the container and waits for its healthcheck |
| `pnpm db:migrate` | `core/bin/db-migrate.ts up` against the local database; a second run prints "up to date" |
| `pnpm db:status` | applied and pending migrations |
| `pnpm db:test` | `core/test/db` with `TEST_DATABASE_URL` set to the local database |
| `pnpm db:psql` | `psql` inside the container, as `neondb_owner` (extra arguments go to psql, for example `pnpm db:psql -c 'select 1'`) |
| `pnpm db:down` | stops and removes the container, keeps the volume `travel_pg18` |
| `pnpm db:reset` | removes the container **and the volume**, starts again and migrates. Local loopback only |
| `pnpm db:url` | prints the local URL (contains the password; use it to set `TEST_DATABASE_URL` in your own shell) |

First run: `pnpm db:up && pnpm db:migrate && pnpm db:test`. pnpm 12 has no `-s` flag; use `$(pnpm db:url | tail -1)` if you need
the bare URL.

`db:reset` is idempotent: running it twice in a row ends in the same state (ten migrations applied, the same column
fingerprint), and `db:migrate` afterwards has nothing to do. `core/test/db/localReset.test.ts` asserts it; it is opt-in because
it destroys the volume: `LOCAL_DB_RESET_TEST=1 pnpm --dir core exec vitest run test/db/localReset.test.ts`.

## Credentials and the production guard

- The password is generated at the first `db:up` into `~/.config/travel/local-db.env` (directory mode 700, file mode 600). It is
  outside the repo and never committed. Override the path with `LOCAL_DB_ENV_FILE`. Deleting the file and the volume together
  (`db:down`, `docker volume rm travel_pg18`, remove the file) gives a new password.
- The `db:*` scripts resolve their target in `core/src/db/localTarget.ts`. They **never read `DATABASE_URL`,
  `DATABASE_URL_UNPOOLED` or the root `.env.local`** (that file holds production values), and child processes get an
  environment with every database URL removed.
- The decision is the LOCAL-C guard (`core/src/seed/guard.ts`, one table, spec 12.2). A production host (the endpoint
  `ep-quiet-leaf-b4oz2a4v`, a host of the ambient `DATABASE_URL`, or a host the root `.env.local` names; only host names are read
  from that file) is refused unless the production approvals hold (`--approve <sha of HEAD>`, a clean tree, a green child rehearsal).
  Any other non-loopback host must be a Neon host and needs `--allow-remote`. `db:reset` and `db:seed` refuse every non-loopback host.
  Messages name the host only, never the URL, user or password.
- `LOCAL_DATABASE_URL` or `--url=` can point the scripts at another local database (CI will use it).

## Seed and sync (LOCAL-2)

The JSON in git is the seed ([spec](local-database-and-seed-sync.md), build notes 13). After `pnpm db:up && pnpm db:migrate`:

| Command | Does | Exit |
|---|---|---|
| `pnpm db:seed` | first load into an **empty** catalogue: 5,542 rows in about a quarter of a second (the whole command, 0.7 s). Refuses a database that already holds rows | 0 done, 1 error |
| `pnpm db:sync --dry-run` | prints the plan, writes nothing (a read only transaction) | 0 no difference, 3 a difference, 1 error |
| `pnpm db:sync` | plans, then applies inserts, updates and deletes in one transaction under the seed advisory lock | 0 done, 1 error |
| `pnpm db:verify` | read only: per table, the seed's rows and table hash against the database (`seed-drift/1`) | 0 equal, 1 any difference |

All three take `--target local|ci|child|production|<url>` (default `local`), `--url <postgres url>`, `--allow-remote`,
`--commit <sha>` (read the files of that commit, not the working tree), `--approve <sha>`, `--root <dir>` (read the inputs from
another folder; for tests) and `--json` (print the plan or the drift result). A target the guard refuses exits 2 before any file is
read or connection opened. `child` and `production` have no connection source until LOCAL-5; with a URL they go through the guard
like any other (production needs the approvals, a clean tree and a green child rehearsal).

Tables loaded today: `type_node` 398, `tag` 81, `relevance_class` 57, `area` 336 (249 countries, 25 regions, 62 areas), `town` 4,223,
`operator` 23, `source` 423, and the `seed_commit` row of `catalogue_meta`. Counts come from the data, so they move with it.

The plan, one line per table, then up to 20 record ids per change kind, the totals and the commit:

```
town             +0  ~1  -0  x0  =4222
  update: ca-ab-bearspaw
total            +0  ~1  -0  x0  =5541
commit <sha>; 1 row(s) would be written; contract v1
```

`+` inserts, `~` updates, `-` retires, `x` deletes, `=` unchanged (rows the seed no longer has but a sync keeps are counted
there too and shown as `(n retained)`).

What a sync does with a row the seed dropped: `town`, `area`, `type_node`, `operator` and `source` are **kept** (retained; other
tables point at them, and they have no status column), `tag` and `relevance_class` are **deleted**. A private table (accounts,
drafts, households) is never read, written or deleted: every statement is checked against the contract first.

Gotchas:
- `db:sync` on an unchanged tree is 0 writes. The commit marker (`catalogue_meta.seed_commit`) is a stamp, not content, so a commit
  that changes no data does not make the plan non-empty; it still moves the marker on a real sync.
- A hand edit of a row the seed owns shows in `db:verify` (and is overwritten by the next `db:sync`). A hand edit of a *retained*
  row (one the seed no longer has) is not drift.
- Non-local targets and `--commit` read committed files only; the working tree can be dirty and is ignored.
- The generated source registry must match the lane files before `source` rows are read (the `sources.ts check` rule); a drifted
  file stops the run with `E_SEED_REGISTRY` and the fix (`node core/bin/sources.ts build`).
- `pnpm db:psql` needs a terminal. In scripts use `docker exec ... psql`.
- If something else already listens on 54329 (another project's Postgres), `db:up` fails to bind. Point `LOCAL_DB_ENV_FILE` at a
  copy of the credentials file with another `LOCAL_DB_PORT` for that shell instead of editing the shared one.

## What matches Neon

| Item | Local | Note |
|---|---|---|
| Postgres, PostGIS | 18.6, 3.6.4 | image built from `postgres:18-trixie` plus `postgresql-18-postgis-3=3.6.*`; `postgis/postgis` is amd64 only |
| `neondb_owner` | LOGIN, CREATEDB, CREATEROLE, **BYPASSRLS**, not superuser, owns `neondb` | a query outside `withUserTransaction` is unrestricted, as in production |
| `travel_app` | created by migration 0001: NOLOGIN, NOBYPASSRLS, non-owner | unchanged |
| Extensions | postgis, pg_trgm, unaccent, ltree | created by the superuser in `tools/db/init/02-extensions.sql` (PostGIS is not trusted); 0001's `if not exists` is then a no-op |
| `neon_auth` | stub of `user`, `session`, `account`, columns read from the child branch on 25 Oct | owned by NOLOGIN role `neon_auth`; `neondb_owner` has select on `user` and delete on `session`. Local tests only, never in a migration |
| `travel_template` | extensions, roles, stub; no migrations | for a throwaway database per check run (`create database x template travel_template`) |

`core/test/db/stub.test.ts` compares the stub's column list with the real one; point `TEST_DATABASE_URL` at the child to check
for drift (read-only queries).

## What it does not do

No Managed Better Auth (sign-up, sessions are only rows you insert yourself), no Realtime subscription, no pooler. Those stay on
the Neon child branch (spec 3.5).

## Files

`tools/db/Dockerfile`, `compose.yml`, `init/01-roles.sh`, `02-extensions.sql`, `03-neon-auth-stub.sql`, `04-template.sh`;
`core/bin/db-local.ts` (the commands); `core/src/db/localTarget.ts` (the resolver, deciding through `core/src/seed/guard.ts`); `core/bin/db-seed.ts` and `core/src/catalogue/postgres/load/` (the seed engine); `core/test/db/localTarget.test.ts`,
`stub.test.ts`, `localReset.test.ts`, `seed.integration.test.ts`; `core/test/catalogue/load-*.test.ts`.

## Gotchas

- The init scripts run only on an empty volume. After editing them, run `pnpm db:reset`.
- Postgres 18 images keep data under `/var/lib/postgresql/18/`, so the volume mounts at `/var/lib/postgresql`, not `.../data`.
- Port 54329 avoids a Homebrew `postgresql@17` on 5432. Change it with `LOCAL_DB_PORT` in the credentials file.
- `docker compose` run by hand needs `--env-file ~/.config/travel/local-db.env`; use the pnpm scripts.
