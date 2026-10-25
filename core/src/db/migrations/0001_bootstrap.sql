-- 0001_bootstrap.sql
-- Extensions, shared helper functions, the non-owner application role, and schema lockdown.
--
-- Identity model (adapted for Managed Better Auth): application user ids are TEXT. Managed Better
-- Auth owns the neon_auth schema (neon_auth.user et al.); we never create or reference it here. Our
-- app_user profile row (migration 0002) is keyed by the verified Better Auth user id as text.
--
-- The runtime role `travel_app` is non-owner and NOBYPASSRLS, so row-level security actually applies
-- to application traffic. Migrations and the offline loader run as the database owner, which keeps
-- full access. See core/src/db/tx.ts for how a transaction drops to this role and binds app.user_id.

create extension if not exists postgis;
create extension if not exists pg_trgm;
create extension if not exists unaccent;
create extension if not exists ltree;

-- unaccent() is only STABLE, so generated columns need an immutable wrapper (standard pattern).
create or replace function unaccent_immutable(text) returns text
  language sql immutable parallel safe strict
  as $$ select public.unaccent('public.unaccent'::regdictionary, $1) $$;

-- The transaction-local, server-verified identity used by owner-predicate RLS policies.
-- Returns NULL when unset, which no real user id matches, so anonymous transactions see no owned row.
create or replace function app_current_user_id() returns text
  language sql stable
  as $$ select nullif(current_setting('app.user_id', true), '') $$;

-- Non-owner application role. No LOGIN (the app connects as the pooled owner and drops to this role
-- per transaction via `set local role`); NOBYPASSRLS so policies are enforced; no CREATE rights.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'travel_app') then
    create role travel_app nologin nobypassrls nosuperuser nocreatedb nocreaterole noinherit;
  end if;
end $$;

-- Let the owner adopt the role for a transaction (`set role travel_app`). SET option only — the
-- owner does not INHERIT travel_app's (narrow) privileges and we do not re-grant ADMIN. PG16+ gives
-- the creator ADMIN but SET=false by default, so this grant is what actually enables `set role`.
-- Safe to run repeatedly.
grant travel_app to current_user with set true, inherit false;

-- Lock the public schema down: no implicit privileges to PUBLIC, explicit USAGE for the app role.
revoke all on schema public from public;
grant usage on schema public to travel_app;

-- New objects created by the owner grant nothing to PUBLIC by default.
alter default privileges in schema public revoke all on tables from public;
alter default privileges in schema public revoke all on sequences from public;
alter default privileges in schema public revoke all on functions from public;
