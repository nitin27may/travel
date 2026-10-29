-- 0014_leg_cache_server_write.sql — the server leg service (TB-L, DT-L; driving-time-model.md 5.6) may read and write routed legs.
-- HELD: not applied until the owner says go. Additive: nothing here changes a row that exists.
--
-- Until now `leg_cache` (0003) had RLS on and no grant: only the owner role (the seed) touched it. The leg service runs as the app
-- role `travel_app`, so this adds the columns of spec 5.6, three policies and the grants, and a prune function.
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
  add column if not exists last_used timestamptz not null default now();

create index if not exists leg_cache_last_used on leg_cache (last_used);

-- A key of the grammar (keys.ts parseCacheKey). Dated trip folders are refused by the service (aliasKey), which owns the month list.
create or replace function leg_cache_key_ok(k text) returns boolean
  language sql immutable parallel safe set search_path = pg_catalog as $$
  select k ~ '^(r:[a-z0-9][a-z0-9/#._-]{1,199}|t:[1-9][0-9]{0,9}|g:[0-9bcdefghjkmnpqrstuvwxyz]{6})$'
$$;

create policy leg_cache_read on leg_cache for select to travel_app using (true);
create policy leg_cache_insert on leg_cache for insert to travel_app
  with check (mode = 'drive' and profile = 'driving-car' and leg_cache_key_ok(from_cell) and leg_cache_key_ok(to_cell) and seconds >= 0 and metres >= 0);
create policy leg_cache_update on leg_cache for update to travel_app
  using (mode = 'drive' and leg_cache_key_ok(from_cell) and leg_cache_key_ok(to_cell))
  with check (mode = 'drive' and profile = 'driving-car' and leg_cache_key_ok(from_cell) and leg_cache_key_ok(to_cell));

revoke all on leg_cache from public;
grant select, insert, update on leg_cache to travel_app;
-- No delete for the app role: the prune below runs as the owner.

-- Rows of the grammar older than p_days (default 180, at least 1) by computed_at or by last_used, for a scheduled job run as the owner.
-- Returns the number dropped. Rows the seed wrote under other keys are left alone.
create or replace function leg_cache_prune(p_days integer default 180) returns integer
  language sql set search_path = pg_catalog, public as $$
  with gone as (
    delete from public.leg_cache
      where public.leg_cache_key_ok(from_cell) and public.leg_cache_key_ok(to_cell)
        and (computed_at < now() - make_interval(days => greatest(coalesce(p_days, 180), 1))
          or last_used < now() - make_interval(days => greatest(coalesce(p_days, 180), 1)))
      returning 1)
  select count(*)::integer from gone
$$;
revoke all on function leg_cache_prune(integer) from public;
