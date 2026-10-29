-- 0014_leg_cache_server_write.sql — the server leg service (TB-L, DT-L; driving-time-model.md 5.6) may read and write routed legs.
-- HELD: not applied until the owner says go. Additive: nothing here changes a row's leg values.
--
-- Until now `leg_cache` (0003) had RLS on and no grant: only the owner role (the seed) touched it. The leg service runs as the app
-- role `travel_app`, so this adds the columns of spec 5.6, an `origin` column, three policies and the grants, and a prune function.
--
-- Two writers share the table (SEEDC, 28 Oct 2026; local-database-and-seed-sync.md 2.4): the seed (rows from the legs files,
-- `origin = 'seed'`) and the leg service (routed rows, `origin = 'server'`). The seed contract scopes `leg_cache` to `origin = 'seed'`
-- (core/src/seed/contract.ts SeedTableSpec.scope): a sync reads, updates and deletes only its own rows, so a server-written row survives
-- every seed run. The prune below drops only server rows. The two key spaces are disjoint (leg_cache_origin_keys), so a seed row and a
-- server row can never meet on the primary key: a seed insert cannot fail on a server row, and a server upsert can never touch a seed row.
--
-- Privacy: the policies accept only the three public key kinds (`r:<public ref>`, `t:<geonameid>`, `g:<geohash 6>`) on BOTH ends and
-- only mode 'drive'. The database cannot know where the household lives, so the home radius refusal stays in the service
-- (core/src/drive/keys.ts writableLegKey) and in its test; a visitor's start has no key and so cannot match.

alter table leg_cache
  add column if not exists profile text not null default 'driving-car',
  add column if not exists engine text not null default 'ors' check (engine in ('ors', 'osrm')),
  add column if not exists engine_version text,
  add column if not exists flags text[] not null default '{}',
  add column if not exists hits integer not null default 0 check (hits >= 0),
  add column if not exists last_used timestamptz not null default now(),
  -- every row that exists before this migration was written by the owner role, so by the seed: backfilled 'seed'
  add column if not exists origin text not null default 'seed' check (origin in ('seed', 'server'));

-- from here on a row with no origin is the leg service's (the seed always names its own)
alter table leg_cache alter column origin set default 'server';

create index if not exists leg_cache_last_used on leg_cache (last_used);

-- A key of the grammar (keys.ts parseCacheKey). Dated trip folders are refused by the service (aliasKey), which owns the month list.
create or replace function leg_cache_key_ok(k text) returns boolean
  language sql immutable parallel safe set search_path = pg_catalog as $$
  select k ~ '^(r:[a-z0-9][a-z0-9/#._-]{1,199}|t:[1-9][0-9]{0,9}|g:[0-9bcdefghjkmnpqrstuvwxyz]{6})$'
$$;

-- A server row has grammar keys on both ends; a seed row has at least one end outside the grammar (the legs files' stop ids). So the
-- primary keys of the two writers never collide. Fails the migration (whole, in its transaction) if a pre-existing row breaks it.
alter table leg_cache add constraint leg_cache_origin_keys
  check ((origin = 'server') = (public.leg_cache_key_ok(from_cell) and public.leg_cache_key_ok(to_cell)));

create policy leg_cache_read on leg_cache for select to travel_app using (true);
create policy leg_cache_insert on leg_cache for insert to travel_app
  with check (origin = 'server' and mode = 'drive' and profile = 'driving-car' and leg_cache_key_ok(from_cell) and leg_cache_key_ok(to_cell) and seconds >= 0 and metres >= 0);
create policy leg_cache_update on leg_cache for update to travel_app
  using (origin = 'server' and mode = 'drive' and leg_cache_key_ok(from_cell) and leg_cache_key_ok(to_cell))
  with check (origin = 'server' and mode = 'drive' and profile = 'driving-car' and leg_cache_key_ok(from_cell) and leg_cache_key_ok(to_cell));

revoke all on leg_cache from public;
grant select, insert, update on leg_cache to travel_app;
-- No delete for the app role: the prune below runs as the owner.

-- Server rows older than p_days (default 180, at least 1) by computed_at or by last_used, for a scheduled job run as the owner.
-- Returns the number dropped. Seed rows (origin 'seed') are never pruned here: the seed sync owns them.
create or replace function leg_cache_prune(p_days integer default 180) returns integer
  language sql set search_path = pg_catalog, public as $$
  with gone as (
    delete from public.leg_cache
      where origin = 'server'
        and public.leg_cache_key_ok(from_cell) and public.leg_cache_key_ok(to_cell)
        and (computed_at < now() - make_interval(days => greatest(coalesce(p_days, 180), 1))
          or last_used < now() - make_interval(days => greatest(coalesce(p_days, 180), 1)))
      returning 1)
  select count(*)::integer from gone
$$;
revoke all on function leg_cache_prune(integer) from public;
