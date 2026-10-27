-- 0012_account_profile.sql — a signed-in person's saved travellers and setup state (ACCT-PC;
-- docs/v2/features/account-profile-and-travellers.md 5.1 and 9, amended 27 Oct 2026: ages, not birth months).
--
-- One row per user. `travellers` is the `travellers/1` document (core/src/schema/travellers.ts): the adult count and each
-- child's age with the date it was entered (`age_as_of`), an optional date of birth (`dob`), optional adults' ages. No names.
-- Zod validates every read and write; the CHECK below is the second net, so a bug cannot store another shape, an unknown key or
-- an out-of-range age. User identity always comes from the verified server session (bound as app.user_id by core/src/db/tx.ts),
-- never a request body.
--
-- The trigger owns the bookkeeping, so no caller can forge or forget it:
--   revision                 0 while no travellers were ever saved (and for "no row"); +1 on every change of `travellers`.
--                            A change of `setup_done_at` alone does not move it: the revision guards the travellers document.
--   travellers_saved_at      when `travellers` last changed.
--   travellers_consented_at  the first save of a travellers document (with the AP-15 wording on screen); kept after a removal.
--   setup_done_at            set once (finished or skipped), never cleared by an update.
--   created_at, updated_at   as usual.
--
-- Owner-only RLS (the planner_draft pattern, 0009). No Realtime signal, no SECURITY DEFINER function, and no foreign key into
-- neon_auth (Neon owns that schema). Birth and age data never leave the owner's own requests (spec 10.1).

create table account_profile (
  user_id text primary key check (char_length(user_id) between 1 and 255),
  travellers jsonb,
  travellers_saved_at timestamptz,
  travellers_consented_at timestamptz,
  setup_done_at timestamptz,
  revision integer not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- The shape of travellers/1. A CASE keeps the order of evaluation, so a cast or an array function never meets a value of the
  -- wrong type; jsonpath reads the entries (lax: a missing key is an empty sequence, so the comparison is false). The caps are
  -- the party's (core/src/trips/party.ts: adults 1..12, children 0..8, a child 0..17) and the document's (2 KB,
  -- core/src/config/account.ts); the date and date-of-birth rules that need "today" are Zod's alone.
  constraint account_profile_travellers check (
    travellers is null or case
      when jsonb_typeof(travellers) <> 'object' then false
      when (travellers - array['schema', 'adults', 'adult_ages', 'children']) <> '{}'::jsonb then false
      when travellers->>'schema' is distinct from 'travellers/1' then false
      when jsonb_typeof(travellers->'adults') is distinct from 'number' then false
      when jsonb_typeof(travellers->'children') is distinct from 'array' then false
      when travellers ? 'adult_ages' and jsonb_typeof(travellers->'adult_ages') <> 'array' then false
      when pg_column_size(travellers) > 2048 then false
      else
        jsonb_path_exists(travellers, '$ ? (@.adults >= 1 && @.adults <= 12 && @.adults == @.adults.floor())')
        and jsonb_array_length(travellers->'children') <= 8
        and jsonb_array_length(coalesce(travellers->'adult_ages', '[]'::jsonb)) <= (travellers->>'adults')::numeric
        -- strict: every element is an object (lax mode would unwrap a nested array and read the object inside it)
        and not jsonb_path_exists(travellers, 'strict $.children[*] ? (@.type() != "object")')
        and not jsonb_path_exists(coalesce(travellers->'adult_ages', '[]'::jsonb), 'strict $[*] ? (@.type() != "object")')
        and jsonb_array_length(jsonb_path_query_array(travellers,
          '$.children[*] ? (@.type() == "object" && @.age.type() == "number" && @.age >= 0 && @.age <= 17
             && @.age == @.age.floor() && @.age_as_of like_regex "^[0-9]{4}-[0-9]{2}-[0-9]{2}$"
             && (!exists(@.dob) || @.dob like_regex "^[0-9]{4}-[0-9]{2}-[0-9]{2}$")
             && !exists(@.keyvalue() ? (@.key != "age" && @.key != "age_as_of" && @.key != "dob")))'))
          = jsonb_array_length(travellers->'children')
        and jsonb_array_length(jsonb_path_query_array(travellers,
          '$.adult_ages[*] ? (@.type() == "object" && @.age.type() == "number" && @.age >= 18 && @.age <= 120
             && @.age == @.age.floor() && @.age_as_of like_regex "^[0-9]{4}-[0-9]{2}-[0-9]{2}$"
             && (!exists(@.dob) || @.dob like_regex "^[0-9]{4}-[0-9]{2}-[0-9]{2}$")
             && !exists(@.keyvalue() ? (@.key != "age" && @.key != "age_as_of" && @.key != "dob")))'))
          = jsonb_array_length(coalesce(travellers->'adult_ages', '[]'::jsonb))
    end));

-- The bookkeeping above, on every insert and update. A fixed search_path stops a search-path hijack of the body.
create or replace function account_profile_touch() returns trigger
  language plpgsql set search_path = pg_catalog, public as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.updated_at := now();
    new.revision := case when new.travellers is null then 0 else 1 end;
    new.travellers_saved_at := case when new.travellers is null then null else now() end;
    new.travellers_consented_at := case when new.travellers is null then null else now() end;
    return new;
  end if;
  new.created_at := old.created_at;
  new.updated_at := now();
  new.setup_done_at := coalesce(old.setup_done_at, new.setup_done_at);
  new.travellers_consented_at := coalesce(old.travellers_consented_at, case when new.travellers is not null then now() end);
  if new.travellers is distinct from old.travellers then
    new.revision := old.revision + 1;
    new.travellers_saved_at := now();
  else
    new.revision := old.revision;
    new.travellers_saved_at := old.travellers_saved_at;
  end if;
  return new;
end $$;
create trigger account_profile_touch_t before insert or update on account_profile
  for each row execute function account_profile_touch();

alter table account_profile enable row level security;

-- Owner predicate: app_current_user_id() (0001) is the transaction-local, server-verified id, or NULL (which no row matches) for
-- an anonymous or unset transaction. WITH CHECK stops a user writing a row owned by someone else.
create policy account_profile_select on account_profile for select
  using (user_id = app_current_user_id());
create policy account_profile_insert on account_profile for insert
  with check (user_id = app_current_user_id());
create policy account_profile_update on account_profile for update
  using (user_id = app_current_user_id())
  with check (user_id = app_current_user_id());
create policy account_profile_delete on account_profile for delete
  using (user_id = app_current_user_id());

revoke all on account_profile from public;
grant select, insert, update, delete on account_profile to travel_app;
