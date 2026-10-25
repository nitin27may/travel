-- 0005_reference.sql — reference data, notifications, sharing, trip-state. Identities TEXT.
-- RLS enabled, no policy (deny) — internal/household in this integration.

create table travel_goal (id text primary key, household_id text not null references household(id) on delete cascade,
  year int not null, rule text not null, budget numeric, currency text);

create table calendar_window (id text primary key, region_code text not null, kind text not null
  check (kind in ('public_holiday','long_weekend','school_break','custom')),
  label text not null, starts_on date not null, ends_on date not null,
  household_id text references household(id));

create table pack_template (id text primary key, name text not null, applies jsonb not null, items jsonb not null);

create table document_rule (id text primary key, citizenship text not null, destination text not null,
  rule jsonb not null, source_id text references source(id), observed_on date);

create table push_subscription (id text primary key, user_id text not null references app_user(id) on delete cascade,
  endpoint text unique not null, p256dh text not null, auth text not null,
  created_at timestamptz not null default now());

create table notification_pref (user_id text references app_user(id) on delete cascade,
  trip_id text references trip(id) on delete cascade,
  channels text[] not null default '{push,email}', quiet_hours jsonb, digest text default 'weekly',
  unique (user_id, trip_id));

create table share_link (
  id text primary key, trip_id text not null references trip(id) on delete cascade,
  token_hash text unique not null, name text,
  scope jsonb not null, includes jsonb not null default '{}',
  allow_copy boolean not null default false, pin_hash text,
  expires_at timestamptz, revoked_at timestamptz,
  created_by text references app_user(id), created_at timestamptz not null default now(),
  view_count int not null default 0, last_viewed_at timestamptz);

create table user_settings (user_id text primary key references app_user(id) on delete cascade,
  units text not null default 'metric', lang text not null default 'en', quiet_hours jsonb, extra jsonb);

create table mcp_token (
  id text primary key, user_id text not null references app_user(id) on delete cascade,
  name text not null, token_hash text unique not null, scopes text[] not null,
  created_at timestamptz not null default now(), last_used_at timestamptz, revoked_at timestamptz);

create table inbound_address (user_id text primary key references app_user(id) on delete cascade,
  local_part text unique not null);

create table inbound_email (id text primary key, user_id text not null references app_user(id) on delete cascade,
  received_at timestamptz not null default now(), subject text, sender text, storage_key text not null,
  parsed jsonb, status text not null default 'new' check (status in ('new','parsed','needs_review','applied','failed')),
  trip_id text references trip(id), reservation_id text references reservation(id),
  delete_after timestamptz not null default now() + interval '30 days');

create table fx_rate (base text not null, quote text not null, on_date date not null, rate numeric not null,
  source text not null, primary key (base, quote, on_date));

create table check_dismissal (trip_id text references trip(id) on delete cascade, day int, item_id text,
  code text not null, dismissed_by text references app_user(id), at timestamptz not null default now(),
  unique (trip_id, day, item_id, code));

create table day_state (trip_id text references trip(id) on delete cascade, day int not null,
  delay_min int not null default 0, plan_b_active boolean not null default false, notes text,
  primary key (trip_id, day));

create table item_memory (id text primary key, trip_id text not null references trip(id) on delete cascade,
  item_id text references trip_item(id) on delete set null, author text references app_user(id),
  note text, rating smallint check (rating between 1 and 5), media_key text,
  private boolean not null default true,
  created_at timestamptz not null default now());

create table template_update_decision (trip_id text references trip(id) on delete cascade,
  template_version int not null, change_ref text not null,
  decision text not null check (decision in ('applied','ignored')),
  primary key (trip_id, template_version, change_ref));

create table calendar_feed (trip_id text primary key references trip(id) on delete cascade,
  token text unique not null);

alter table travel_goal              enable row level security;
alter table calendar_window          enable row level security;
alter table pack_template            enable row level security;
alter table document_rule            enable row level security;
alter table push_subscription        enable row level security;
alter table notification_pref        enable row level security;
alter table share_link               enable row level security;
alter table user_settings            enable row level security;
alter table mcp_token                enable row level security;
alter table inbound_address          enable row level security;
alter table inbound_email            enable row level security;
alter table fx_rate                  enable row level security;
alter table check_dismissal          enable row level security;
alter table day_state                enable row level security;
alter table item_memory              enable row level security;
alter table template_update_decision enable row level security;
alter table calendar_feed            enable row level security;
