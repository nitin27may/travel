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
- A URL for the production endpoint `ep-quiet-leaf-b4oz2a4v`, the production branch id, or a host equal to the ambient
  `DATABASE_URL` host is refused. Any other non-loopback host needs `--allow-remote`. `db:reset` refuses every non-loopback host.
  Messages name the host only, never the URL, user or password.
- `LOCAL_DATABASE_URL` or `--url=` can point the scripts at another local database (CI will use it).

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
`core/bin/db-local.ts` (the commands); `core/src/db/localTarget.ts` (the resolver and guard); `core/test/db/localTarget.test.ts`,
`stub.test.ts`, `localReset.test.ts`.

## Gotchas

- The init scripts run only on an empty volume. After editing them, run `pnpm db:reset`.
- Postgres 18 images keep data under `/var/lib/postgresql/18/`, so the volume mounts at `/var/lib/postgresql`, not `.../data`.
- Port 54329 avoids a Homebrew `postgresql@17` on 5432. Change it with `LOCAL_DB_PORT` in the credentials file.
- `docker compose` run by hand needs `--env-file ~/.config/travel/local-db.env`; use the pnpm scripts.
