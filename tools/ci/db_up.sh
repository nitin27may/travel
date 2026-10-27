#!/usr/bin/env bash
# CI database (WF-3; docs/v2/features/local-database-and-seed-sync.md 3.6): the repository's own local-database image, built on a base
# pinned by digest, started on 127.0.0.1:54329 with throwaway passwords. A stock `postgres:18` service container cannot run the db.local
# suite: it has no PostGIS, no `neondb_owner` role, no `neon_auth` stub and no `travel_template` (tools/db/init/*), and a service
# container starts before the checkout, so those files cannot be mounted. Building tools/db is what `pnpm db:up` does on the Mac.
#
#   PG_BASE_IMAGE=postgres:18-trixie@sha256:<64 hex> CI_DB_SUPERUSER_PASSWORD=ci-... CI_DB_OWNER_PASSWORD=ci-... bash tools/ci/db_up.sh
#
# The passwords are plain workflow values that start "ci-" (not secrets: the server lives and dies with the job). Output never
# contains a password. Exit 0 when the server answers over TCP and `travel_template` exists; 1 otherwise.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
base="${PG_BASE_IMAGE:?PG_BASE_IMAGE must be postgres:18-trixie@sha256:<digest>}"
[[ "$base" =~ ^postgres:18-trixie@sha256:[0-9a-f]{64}$ ]] || { echo "db_up: PG_BASE_IMAGE must be postgres:18-trixie pinned by a sha256 digest"; exit 1; }
for v in CI_DB_SUPERUSER_PASSWORD CI_DB_OWNER_PASSWORD; do
  [[ "${!v:-}" =~ ^ci-[A-Za-z0-9-]+$ ]] || { echo "db_up: $v must be a throwaway value starting ci-"; exit 1; }
done
name="${CI_DB_CONTAINER:-travel-localdb-ci}"
port=54329

ctx="$(mktemp -d)"
trap 'rm -rf "$ctx"' EXIT
cp -R "$here/tools/db/." "$ctx/"
# Replace only the base. If the Dockerfile's FROM line ever changes, stop: the digest pin must be revisited by a person.
grep -qx 'FROM postgres:18-trixie' "$ctx/Dockerfile" || { echo "db_up: tools/db/Dockerfile no longer starts FROM postgres:18-trixie; update the pin"; exit 1; }
sed -i.bak "s|^FROM postgres:18-trixie\$|FROM $base|" "$ctx/Dockerfile"
rm -f "$ctx/Dockerfile.bak"
grep -qx "FROM $base" "$ctx/Dockerfile" || { echo "db_up: could not pin the base image"; exit 1; }

# Docker Hub's anonymous pull limit is shared by every job on a runner IP (WF-3 review S8): pull the base first, with a backoff, so one
# refusal does not fail the job. If pulls keep failing, point the digest at mirror.gcr.io/library/postgres (same index digest).
# CI_DB_PULL_BACKOFF is the base delay in seconds; the wait before retry n is base * n * n (10, 40, 90).
pulled=0
for attempt in 1 2 3 4; do
  if docker pull --quiet "$base" >/dev/null 2>&1; then pulled=1; break; fi
  echo "db_up: pulling the base image failed (attempt $attempt of 4; Docker Hub rate limits are per runner IP)"
  [[ "$attempt" -lt 4 ]] && sleep "$(( ${CI_DB_PULL_BACKOFF:-10} * attempt * attempt ))"
done
[[ "$pulled" == 1 ]] || { echo "db_up: could not pull the pinned base image in 4 attempts"; exit 1; }

docker build --quiet --tag travel-pg18:ci "$ctx" >/dev/null
docker rm -f "$name" >/dev/null 2>&1 || true
docker run --detach --name "$name" \
  --env POSTGRES_USER=postgres --env POSTGRES_DB=neondb \
  --env POSTGRES_PASSWORD="$CI_DB_SUPERUSER_PASSWORD" --env OWNER_PASSWORD="$CI_DB_OWNER_PASSWORD" \
  --publish "127.0.0.1:$port:5432" travel-pg18:ci >/dev/null

# Ready means the FINAL server answers over TCP. The throwaway server that runs tools/db/init/* listens on the socket only, so a
# socket check could pass half way through the init scripts.
for _ in $(seq 1 60); do
  if docker exec "$name" pg_isready -h 127.0.0.1 -U neondb_owner -d neondb >/dev/null 2>&1; then
    have="$(docker exec --env PGPASSWORD="$CI_DB_SUPERUSER_PASSWORD" "$name" psql -h 127.0.0.1 -U postgres -d postgres -Atc "select 1 from pg_database where datname='travel_template'" 2>/dev/null || true)"
    if [[ "$have" == 1 ]]; then echo "db_up: ready on 127.0.0.1:$port (travel_template present)"; exit 0; fi
  fi
  sleep 2
done
echo "db_up: the database did not become ready in 120 s"
docker logs --tail 20 "$name" 2>&1 | sed -E 's#(password|PASSWORD)[=: ]+[^ ]+#\1=***#g' || true
exit 1
