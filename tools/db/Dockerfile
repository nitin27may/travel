# Local Postgres that matches Neon: Postgres 18 plus PostGIS 3.6 on both amd64 and arm64.
# Do not "simplify" this to postgis/postgis: that image is amd64 only and would run under emulation on Apple silicon.
# The official image already carries the PGDG apt repository, so the package installs directly.
FROM postgres:18-trixie

RUN apt-get update \
 && apt-get install -y --no-install-recommends "postgresql-18-postgis-3=3.6.*" \
 && rm -rf /var/lib/apt/lists/*

COPY init/ /docker-entrypoint-initdb.d/
