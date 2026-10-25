-- 0010_planner_draft_signal.sql — content-free invalidation stream for the live draft list.
--
-- Why this exists (verified, not assumed): Neon Realtime (experimental, pre-GA) rejects any
-- subscription whose sealed query resolves to a relation with row-level security enabled — the base
-- table directly and a view over it, in BOTH security modes, all return `upstream_rejected`
-- (research/runs/neon-realtime-view-probe-20261024-1055.md). planner_draft (migration 0009) keeps
-- RLS on, so its rows cannot be read live. This auxiliary table carries NO draft content — only a
-- per-user monotonic version — and is the ONE application relation with RLS deliberately OFF, under
-- the coordinator exception recorded in NEON-SETUP.md ("Blocker resolution: live list without
-- weakening RLS"). The browser subscribes to a sealed `where user_id = $1` on this table, then
-- re-fetches the actual drafts through the RLS-scoped authenticated read (withUserTransaction).
--
-- Private ownership is unchanged: planner_draft and all 86 application tables keep RLS. The app role
-- travel_app gets NO grant on this signal table, so it can neither read nor write it directly and
-- cannot enumerate other users' ids. The only writer is the SECURITY DEFINER trigger below (owned by
-- the schema owner), which fires inside the same transaction as the planner_draft change, so the
-- version bump shares that write's transaction id and the stream's awaitTxId() resolves on it.

create table planner_draft_signal (
  user_id text primary key,
  version bigint not null default 0,
  changed_at timestamptz not null default now());

-- RLS is intentionally OFF here (the Realtime requirement). Realtime reads the table through its own
-- replication role; the sealed `where user_id = $1` predicate is the per-subscriber authorization.
-- A fixed search_path stops a search-path hijack of the definer body.
create or replace function planner_draft_bump_signal() returns trigger
  language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  uid text := coalesce(new.user_id, old.user_id);
begin
  insert into public.planner_draft_signal as s (user_id, version, changed_at)
    values (uid, 1, now())
  on conflict (user_id) do update
    set version = s.version + 1, changed_at = now();
  return null; -- AFTER trigger: return value is ignored
end $$;

-- One bump per affected planner_draft row, after the change commits its effect in the same txn.
create trigger planner_draft_signal_t
  after insert or update or delete on planner_draft
  for each row execute function planner_draft_bump_signal();

-- No grants to travel_app on planner_draft_signal: the app role cannot touch it directly.
