-- 0013_plan_doc.sql — the editable trip document on the live drafts table, renamed here from planner_draft to plan_draft (EM-M; docs/v2/features/edit-my-trip.md 3, 4.1,
-- 4.5; the column list is PLAN_DOC_MIGRATION in core/src/schema/api/account-plans.ts, pinned by core/test/db/plan-doc-sql.test.ts).
-- It absorbs NAV-D's draft cap and the column half of CUS-C, so neither is written separately. Hardened by EM-F before any apply
-- (docs/v2/design/shell/review-em-s-2026-10-27.md S1, S2, B2): the runner is checksummed with no down migrations, so these are here.
--
-- One table for a copy of a public trip (template mode) and a trip-builder plan (built mode): `doc` is the whole `plan-draft/<n>`
-- document, and the light columns the list reads without it (P8) are derived from the document by the route on every write
-- (core/src/plan/doc.ts planRowFields), never sent separately by a client. The CHECKs below are the second net behind the route's
-- full parse (R5): a bug cannot store another shape, a document of another row, columns that disagree with the document, or a
-- tombstone that still holds household data.
--
-- THE KEY is per user: `primary key (user_id, id)` (S1). The id is made on the device, so a global key would let one account learn
-- that another holds an id (an insert that silently does nothing) and squat a copy's id before its owner signs in. Per user, two
-- accounts may hold the same id and neither can tell. Every query names the user as well as the id.
--
-- The triggers own the bookkeeping, so no caller can forge or forget it:
--   revision    0 on insert; +1 on every update (optimistic concurrency, 4.1); never the client's value.
--   id, user_id fixed by the insert; an update cannot move a row to another id or another user.
--   deleted_at  null on insert; set to now() by the update that tombstones a row (never a caller's time, so a tombstone cannot be
--               backdated into an early purge or pushed into the future to dodge it and the cap); kept as it is by any later
--               update of the tombstone; cleared by a restore.
--   the cap     at most 50 live rows (deleted_at null) per user on insert and on a restore, serialised per user by a transaction
--               advisory lock so two tabs merging at once cannot both pass 49 (edit-my-trip 13, NAV-D's race). It raises SQLSTATE
--               TP001 (message PLAN_CAP), which the route answers 409.
-- The tombstones a user may keep are bounded by the module (core/src/db/plans.ts deletePlan: the newest 150, older ones dropped in
-- the same transaction) and by the plans:write quota (an hour and a day window), so one account cannot grow the table without end.
--
-- RLS: 0009's four owner-predicate policies cover the new columns; no policy is added or changed, and the grants stay
-- `travel_app` only. 0010's content-free signal keeps firing on any change and carries none of these columns; sync does not depend on
-- it (EM7). Household data (a trip's start, its travellers' ages, notes) lives only in `doc` and `start`; a tombstone keeps neither,
-- and the CHECK plan_draft_tombstone makes that a rule of the table, not only of the route.
--
-- Purge: the routes drop the caller's own tombstones older than 30 days inside their write transactions (under RLS), and
-- `plan_draft_purge()` drops everyone's, run daily as the owner by `node core/bin/db-purge.ts` (the scheduled workflow
-- .github/workflows/plan-purge.yml, off until this migration is applied). Neither the app role nor PUBLIC may execute it.

-- THE RENAME (owner decision, 27 Oct 2026): 0009 and 0010 are applied and checksummed, so they keep the old name; this migration
-- renames the table and every object 0009 and 0010 named after it, so nothing is left named planner_draft. The table, its rows, its
-- grants, its RLS and its publication membership move with it (they follow the table, not its name). One body names a table and must
-- be written again: the signal trigger's SECURITY DEFINER function, the same body as 0010's with the new table name, the same owner
-- and the same fixed search_path; travel_app still has no grant on the signal table.
alter table planner_draft rename to plan_draft;
alter table plan_draft rename constraint planner_draft_pkey to plan_draft_pkey;
alter table plan_draft rename constraint planner_draft_title_check to plan_draft_title_check;
alter index planner_draft_user_id_updated_at_idx rename to plan_draft_user_id_updated_at_idx;
alter policy planner_draft_select on plan_draft rename to plan_draft_select;
alter policy planner_draft_insert on plan_draft rename to plan_draft_insert;
alter policy planner_draft_update on plan_draft rename to plan_draft_update;
alter policy planner_draft_delete on plan_draft rename to plan_draft_delete;
alter trigger planner_draft_touch_t on plan_draft rename to plan_draft_touch_t;
alter function planner_draft_touch() rename to plan_draft_touch;
alter table planner_draft_signal rename to plan_draft_signal;
alter table plan_draft_signal rename constraint planner_draft_signal_pkey to plan_draft_signal_pkey;
alter trigger planner_draft_signal_t on plan_draft rename to plan_draft_signal_t;
alter function planner_draft_bump_signal() rename to plan_draft_bump_signal;
create or replace function plan_draft_bump_signal() returns trigger
  language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  uid text := coalesce(new.user_id, old.user_id);
begin
  insert into public.plan_draft_signal as s (user_id, version, changed_at)
    values (uid, 1, now())
  on conflict (user_id) do update
    set version = s.version + 1, changed_at = now();
  return null; -- AFTER trigger: return value is ignored
end $$;

-- The per-user key (S1). 0009 named the key plan_draft_pkey; the id stays a uuid with its default.
alter table plan_draft drop constraint plan_draft_pkey;
alter table plan_draft add constraint plan_draft_pkey primary key (user_id, id);

alter table plan_draft
  add column doc jsonb,
  add column kind text,
  add column source_trip text,
  add column start date,
  add column days integer,
  add column revision bigint not null default 0,
  add column deleted_at timestamptz;

-- A CASE keeps the order of evaluation, and every branch is true or false (a CHECK passes on NULL, so a bare `doc->>'id' = id::text`
-- would let a document without an id through).
alter table plan_draft
  add constraint plan_draft_doc check (
    doc is null or case
      when jsonb_typeof(doc) <> 'object' then false
      when jsonb_typeof(doc->'schema') is distinct from 'string' then false
      when jsonb_typeof(doc->'id') is distinct from 'string' then false
      when (doc->>'schema') !~ '^plan-draft/[1-9][0-9]{0,3}$' then false
      when (doc->>'id') <> id::text then false
      -- jsonb text adds spaces, so the backstop allows half again the route's 16 KB
      else octet_length(doc::text) <= 24576
    end),
  add constraint plan_draft_kind check (kind is null or kind in ('template', 'built')),
  add constraint plan_draft_source_trip check (source_trip is null or source_trip ~ '^[a-z0-9][a-z0-9-]{0,99}$'),
  add constraint plan_draft_days check (days is null or days between 1 and 99),
  add constraint plan_draft_revision check (revision >= 0),
  -- the derived columns and the document agree: a document has a kind, a template has its trip, and both name the same trip
  add constraint plan_draft_doc_kind check ((doc is null) = (kind is null)),
  add constraint plan_draft_template_trip check (kind is null or ((kind = 'template') = (source_trip is not null))),
  add constraint plan_draft_kind_of_doc check (
    doc is null or coalesce((kind = 'template') = coalesce(jsonb_typeof(doc->'template') = 'object', false), false)),
  add constraint plan_draft_trip_of_doc check (
    doc is null or source_trip is not distinct from (doc->'template'->>'trip')),
  -- the start column is the document's start, compared as text (to_char with a fixed pattern: no cast that can throw, no DateStyle)
  add constraint plan_draft_start_of_doc check (
    doc is null or to_char(start, 'YYYY-MM-DD') is not distinct from (doc->>'start')),
  -- a tombstone holds no household data: its id, title and bookkeeping only (S2)
  add constraint plan_draft_tombstone check (
    deleted_at is null or (doc is null and kind is null and source_trip is null and start is null and days is null));

-- Revision, key and tombstone bookkeeping, beside 0009's updated_at touch. A fixed search_path stops a search-path hijack of the body.
create or replace function plan_draft_revision() returns trigger
  language plpgsql set search_path = pg_catalog, public as $$
begin
  if tg_op = 'INSERT' then
    new.revision := 0;
    new.deleted_at := null;
  else
    new.id := old.id;
    new.user_id := old.user_id;
    new.revision := old.revision + 1;
    new.created_at := old.created_at;
    if old.deleted_at is null and new.deleted_at is not null then
      new.deleted_at := now();
    elsif old.deleted_at is not null and new.deleted_at is not null then
      new.deleted_at := old.deleted_at;
    end if;
  end if;
  return new;
end $$;
create trigger plan_draft_revision_t before insert or update on plan_draft
  for each row execute function plan_draft_revision();

-- The cap (Q204, edit-my-trip 3): copies and plans together, live rows only. Runs as the caller (no SECURITY DEFINER): under RLS the
-- count sees the caller's own rows, which are exactly the rows of new.user_id because the policies' WITH CHECK pins it. The advisory
-- lock is per user and per transaction; READ COMMITTED gives each statement of the body a fresh snapshot, so the second of two racing
-- transactions counts the first one's row once it has committed.
create or replace function plan_draft_cap() returns trigger
  language plpgsql set search_path = pg_catalog, public as $$
declare
  n integer;
begin
  if new.deleted_at is not null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.deleted_at is null then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('plan_draft_cap:' || new.user_id, 0));
  select count(*) into n from public.plan_draft where user_id = new.user_id and deleted_at is null;
  if n >= 50 then
    raise exception 'PLAN_CAP' using errcode = 'TP001';
  end if;
  return new;
end $$;
-- Named after the revision trigger: triggers of one event fire in name order, and the cap must see the final deleted_at.
create trigger plan_draft_x_cap_t before insert or update of deleted_at on plan_draft
  for each row execute function plan_draft_cap();

-- The light list (live rows, then recent tombstones, each newest first), the sign-in merge's same trip and start lookup, and the purge.
create index plan_draft_user_live on plan_draft (user_id, deleted_at, updated_at desc);
create index plan_draft_user_trip_start on plan_draft (user_id, source_trip, start) where deleted_at is null;
create index plan_draft_tombstones on plan_draft (deleted_at) where deleted_at is not null;

-- Everyone's tombstones older than p_days (default 30, at least 1), for a scheduled job run as the owner (who bypasses RLS). Returns
-- the number of rows dropped. Account deletion (F17) deletes every row of the user directly.
create or replace function plan_draft_purge(p_days integer default 30) returns integer
  language sql set search_path = pg_catalog, public as $$
  with gone as (
    delete from public.plan_draft
      where deleted_at is not null and deleted_at < now() - make_interval(days => greatest(coalesce(p_days, 30), 1))
      returning 1)
  select count(*)::integer from gone
$$;
revoke all on function plan_draft_purge(integer) from public;

-- The grants are 0009's (select, insert, update, delete to travel_app); stated again for the reader. Nothing to PUBLIC.
revoke all on plan_draft from public;
grant select, insert, update, delete on plan_draft to travel_app;
