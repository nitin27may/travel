-- 0002_people.sql — people & households. All user identities are TEXT (Better Auth ids).
-- Private household data: RLS enabled, no policy (deny-all for the app role in this integration).

create table app_user (
  id text primary key,                            -- verified Managed Better Auth user id (text)
  email text unique not null, name text,
  role text not null default 'user' check (role in ('user','researcher','moderator','admin')),
  home_tz text, created_at timestamptz not null default now());

create table household (
  id text primary key, owner_id text not null references app_user(id),
  name text not null,
  home_point geography(Point,4326), home_label text, home_tz text,
  prefs jsonb not null default '{}',
  created_at timestamptz not null default now());

create table household_member (household_id text references household(id) on delete cascade,
  user_id text references app_user(id), role text not null check (role in ('owner','adult')),
  primary key (household_id, user_id));

create table person (
  id text primary key, household_id text not null references household(id) on delete cascade,
  name text not null, birth_date date, birth_year int, height_cm int,
  fitness smallint check (fitness between 1 and 5),
  mobility text, dietary text, citizenship text[], passport_expires date,
  weight_kg int,
  user_id text references app_user(id));

create table membership (
  id text primary key, household_id text not null references household(id) on delete cascade,
  offer_id text, label text not null, expires_on date);

alter table app_user         enable row level security;
alter table household         enable row level security;
alter table household_member  enable row level security;
alter table person            enable row level security;
alter table membership        enable row level security;
