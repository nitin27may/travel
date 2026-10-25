-- PostGIS is not a trusted extension, so the superuser creates all four here; migration 0001's
-- `create extension if not exists` then does nothing, as on Neon.
create extension if not exists postgis;
create extension if not exists pg_trgm;
create extension if not exists unaccent;
create extension if not exists ltree;
