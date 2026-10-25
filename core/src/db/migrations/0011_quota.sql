-- 0011_quota.sql — fixed-window quotas for the auth guard and the owner-alert budget (EML-Q; email spec 5.2, 9 and 12).
--
-- One row per (bucket, key, window length, window start) with a count. Keys are never raw: an address or an IP arrives as a 32-hex
-- HMAC under a server secret, mixed with the UTC day (core/src/quota/keys.ts), and the CHECK below refuses anything else, so a bug
-- cannot store a raw value. Global counters (the send cap, monitoring counts, the alert budget) use the empty key.
--
-- RLS is on with NO policy and NO grant: the app role `travel_app` can neither read nor write nor enumerate the table. It reaches it
-- only through the two SECURITY DEFINER functions below (owned by the schema owner, fixed search_path), which are granted to it:
--   quota_take(...)  checks and counts several rules atomically (all or nothing) and returns counts only, never another row;
--   quota_peek(...)  reads one GLOBAL counter (empty key); a hashed row cannot be read this way.
-- Rows with a key are purged 48 hours after their window ends; content-free global counters after 35 days (the weekly stats signal).

create table quota_bucket (
  bucket text not null check (bucket ~ '^[a-z][a-z0-9:_-]{0,63}$'),
  key text not null check (key ~ '^([0-9a-f]{32})?$'),
  window_s integer not null check (window_s between 60 and 2592000),
  window_start timestamptz not null,
  count integer not null default 0 check (count >= 0),
  primary key (bucket, key, window_s, window_start));
create index quota_bucket_window_start on quota_bucket (window_start);

alter table quota_bucket enable row level security;
-- No policy and no grant to travel_app (deny). PUBLIC has nothing (0001 default privileges); stated again for the reader.
revoke all on quota_bucket from public;

create or replace function quota_take(
  p_bucket text[], p_key text[], p_window integer[], p_limit integer[],
  out allowed boolean, out failed integer, out retry_after integer, out counts integer[])
  language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  n integer := coalesce(array_length(p_bucket, 1), 0);
  t double precision := extract(epoch from now());
  starts timestamptz[] := '{}';
  i integer;
  c integer;
begin
  if n < 1 or n > 8
     or coalesce(array_length(p_key, 1), 0) <> n
     or coalesce(array_length(p_window, 1), 0) <> n
     or coalesce(array_length(p_limit, 1), 0) <> n then
    raise exception 'quota_take: 1 to 8 rules, all arrays the same length' using errcode = '22023';
  end if;

  -- Make sure every row exists (the CHECKs validate bucket, key and window here), then lock them all in one fixed order, so two
  -- concurrent calls never deadlock and never both pass a full window.
  for i in 1..n loop
    if p_window[i] is null or p_window[i] < 60 then
      raise exception 'quota_take: bad window' using errcode = '22023';
    end if;
    starts := starts || to_timestamp(floor(t / p_window[i]) * p_window[i]);
    insert into public.quota_bucket (bucket, key, window_s, window_start)
      values (p_bucket[i], p_key[i], p_window[i], starts[i])
      on conflict do nothing;
  end loop;
  perform 1 from public.quota_bucket q
    join unnest(p_bucket, p_key, p_window, starts) as r(b, k, w, s)
      on q.bucket = r.b and q.key = r.k and q.window_s = r.w and q.window_start = r.s
    order by q.bucket, q.key, q.window_s
    for update of q;

  allowed := true;
  retry_after := 0;
  counts := '{}';
  for i in 1..n loop
    select q.count into c from public.quota_bucket q
      where q.bucket = p_bucket[i] and q.key = p_key[i] and q.window_s = p_window[i] and q.window_start = starts[i];
    counts := counts || c;
    if p_limit[i] is not null and c >= p_limit[i] then
      if allowed then failed := i; end if;
      allowed := false;
      retry_after := greatest(retry_after, ceil(extract(epoch from starts[i]) + p_window[i] - t)::integer);
    end if;
  end loop;

  if allowed then
    for i in 1..n loop
      update public.quota_bucket set count = count + 1
        where bucket = p_bucket[i] and key = p_key[i] and window_s = p_window[i] and window_start = starts[i];
      counts[i] := counts[i] + 1;
    end loop;
  end if;

  -- Retention, a little at a time: hashed rows 48 h after their window ends, global counters after 35 days.
  delete from public.quota_bucket where ctid = any (array(
    select ctid from public.quota_bucket
      where window_start < now() - interval '48 hours' - make_interval(secs => window_s)
        and (key <> '' or window_start < now() - interval '35 days')
      limit 100));
end $$;

create or replace function quota_peek(p_bucket text, p_window integer, p_at timestamptz) returns integer
  language sql stable security definer set search_path = pg_catalog, public as $$
  select coalesce((select q.count from public.quota_bucket q
    where q.bucket = p_bucket and q.key = '' and q.window_s = p_window
      and q.window_start = to_timestamp(floor(extract(epoch from p_at) / p_window) * p_window)), 0)
$$;

revoke all on function quota_take(text[], text[], integer[], integer[]) from public;
revoke all on function quota_peek(text, integer, timestamptz) from public;
grant execute on function quota_take(text[], text[], integer[], integer[]) to travel_app;
grant execute on function quota_peek(text, integer, timestamptz) to travel_app;
