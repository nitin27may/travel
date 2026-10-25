-- 0008_household_private.sql — private household tables from locations.json (M14, owner decision
-- 13.3: collections and Instagram saves are private). RLS enabled, no policy, nothing loaded.

create table saved_source (
  id text primary key, household_id text not null references household(id) on delete cascade,
  entity_id text references entity(id) on delete cascade,
  source_type text, url text, doc jsonb not null default '{}',
  added_at timestamptz not null default now());

create table visit (
  id text primary key, household_id text not null references household(id) on delete cascade,
  entity_id text references entity(id) on delete cascade,
  trip_id text, visited_on date, doc jsonb not null default '{}');

create table collection (
  id text primary key, household_id text not null references household(id) on delete cascade,
  name text not null, doc jsonb not null default '{}',
  created_at timestamptz not null default now());

create table collection_place (
  collection_id text not null references collection(id) on delete cascade,
  entity_id text not null references entity(id) on delete cascade,
  "position" int not null default 0,
  primary key (collection_id, entity_id));

alter table saved_source     enable row level security;
alter table visit            enable row level security;
alter table collection       enable row level security;
alter table collection_place enable row level security;
