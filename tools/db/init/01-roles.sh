#!/bin/bash
# Roles as on Neon. The owner role `neondb_owner` has BYPASSRLS there, so it has it here: a query that forgets
# `set local role travel_app` is as unrestricted locally as in production. `travel_app` is created by migration 0001.
set -euo pipefail
psql -v ON_ERROR_STOP=1 -v owner_pw="$OWNER_PASSWORD" --username postgres --dbname postgres <<'SQL'
create role neondb_owner login password :'owner_pw' createdb createrole bypassrls nosuperuser;
alter database neondb owner to neondb_owner;
SQL
