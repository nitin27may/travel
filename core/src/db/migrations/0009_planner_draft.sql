-- 0009_planner_draft.sql — the shared integration contract (NEON-SETUP.md).
--
-- Exact shape: id uuid, user_id text not null, title text not null (1..160 chars),
-- created_at timestamptz not null, updated_at timestamptz not null. User identity always comes from
-- the verified server session (bound as app.user_id by core/src/db/tx.ts), never a request body.
--
-- Owner-predicate RLS keyed on the transaction-local app.user_id, so a transaction can only read or
-- change its own user's drafts. Realtime does NOT enforce RLS, so the live subscription embeds the
-- same user-id predicate directly (see sealedDraftQuery in core/src/db/tx.ts).

create table planner_draft (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  title text not null check (char_length(title) between 1 and 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now());
create index on planner_draft (user_id, updated_at desc);

-- Keep updated_at honest on every rename.
create or replace function planner_draft_touch() returns trigger
  language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
create trigger planner_draft_touch_t before update on planner_draft
  for each row execute function planner_draft_touch();

alter table planner_draft enable row level security;

-- Owner predicate: app_current_user_id() returns the transaction-local, server-verified id, or NULL
-- (which no row matches) for anonymous/unset transactions. The insert/update WITH CHECK stops a user
-- writing a row owned by someone else.
create policy planner_draft_select on planner_draft for select
  using (user_id = app_current_user_id());
create policy planner_draft_insert on planner_draft for insert
  with check (user_id = app_current_user_id());
create policy planner_draft_update on planner_draft for update
  using (user_id = app_current_user_id())
  with check (user_id = app_current_user_id());
create policy planner_draft_delete on planner_draft for delete
  using (user_id = app_current_user_id());

grant select, insert, update, delete on planner_draft to travel_app;
