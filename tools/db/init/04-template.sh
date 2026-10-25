#!/bin/bash
# `travel_template`: extensions, roles and the stub, no migrations. A throwaway database for a check run is
# `create database seed_check_1 template travel_template`, which takes milliseconds.
set -euo pipefail
psql -v ON_ERROR_STOP=1 --username postgres --dbname postgres <<'SQL'
create database travel_template template neondb owner neondb_owner;
alter database travel_template is_template true allow_connections false;
SQL
