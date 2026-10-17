-- Travel platform v2: first-cut schema (PROPOSAL, 17 Oct 2026). Explained in 01-domain-model.md.
-- Postgres + PostGIS on self-hosted Supabase (decided 17 Oct 2026, 08-self-hosted.md). Supabase Auth owns
-- auth.users; app_user is our profile row keyed by the same uuid (created by a trigger on auth.users).
-- The stub below lets this file load on plain Postgres for tests; on Supabase auth.users already exists.
-- Ids are ULIDs stored as text (sortable, safe to mint offline on the client).

create extension if not exists postgis;
create extension if not exists pg_trgm;
create extension if not exists unaccent;
create extension if not exists ltree;
-- create extension if not exists vector;   -- later: semantic "places like this"

-- unaccent() is only STABLE, so generated columns need an immutable wrapper (standard pattern).
create function unaccent_immutable(text) returns text language sql immutable parallel safe strict
  as $$ select public.unaccent('public.unaccent'::regdictionary, $1) $$;

-- ───────────── people ─────────────
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);   -- test stub only

create table app_user (                      -- profile for a Supabase Auth user
  id uuid primary key references auth.users(id) on delete cascade, email text unique not null, name text, role text not null default 'user'
    check (role in ('user','researcher','moderator','admin')),
  home_tz text, created_at timestamptz not null default now());

create table household (
  id text primary key, owner_id uuid not null references app_user(id),
  name text not null,
  home_point geography(Point,4326), home_label text, home_tz text,
  prefs jsonb not null default '{}',         -- radius_min, transport, budget_style, pace, interests[], avoid[], dietary
  created_at timestamptz not null default now());

create table household_member (household_id text references household(id) on delete cascade,
  user_id uuid references app_user(id), role text not null check (role in ('owner','adult')),
  primary key (household_id, user_id));

create table person (                        -- private to the household
  id text primary key, household_id text not null references household(id) on delete cascade,
  name text not null, birth_date date, birth_year int, height_cm int, fitness smallint check (fitness between 1 and 5),
  mobility text, dietary text, citizenship text[], passport_expires date,
  weight_kg int,                               -- optional, asked only when an activity has a weight limit
  user_id uuid references app_user(id));

create table membership (                    -- passes the household holds
  id text primary key, household_id text not null references household(id) on delete cascade,
  offer_id text, label text not null, expires_on date);

-- ───────────── geography & catalog ─────────────
create table area (
  id text primary key, parent_id text references area(id), path ltree not null,
  level text not null check (level in ('country','region','area')),
  name text not null, iso_code text, wikidata_qid text unique,
  centre geography(Point,4326), boundary geography(MultiPolygon,4326), tz text);
create index on area using gist (path);
create index on area using gist (boundary);

create type entity_kind as enum ('place','trail','activity','stay','eatery','hub','event');
-- place subkinds include trailhead, parking, shuttle_stop, meeting_point, pass, ferry_route, splash_pad... (research/README.md R14)

create table entity (
  id text primary key, kind entity_kind not null, subkind text not null,
  name text not null, names jsonb not null default '{}', slug text not null unique,
  area_id text references area(id),
  point geography(Point,4326), shape geography(Geometry,4326),
  summary text, tags text[] not null default '{}',
  season jsonb, hours jsonb, eligibility jsonb,   -- {min_age, min_height_cm, max_weight_kg, fitness, notes}
  cost_band smallint check (cost_band between 0 and 4),
  duration_min int, duration_max int, website text,
  attrs jsonb not null default '{}',              -- kind-specific, validated by the kind's Zod schema
  -- hot kind-specific values promoted for filtering
  trail_km numeric generated always as ((attrs->>'distance_km')::numeric) stored,
  trail_gain_m int generated always as ((attrs->>'gain_m')::int) stored,
  wikidata_qid text unique, osm_ref text,
  status text not null default 'published' check (status in ('draft','published','retired')),
  trust text not null default 'unverified' check (trust in ('unverified','stated','verified')),
  fresh_until date, version int not null default 1,
  search tsvector generated always as (
    setweight(to_tsvector('simple', unaccent_immutable(name)), 'A') ||
    setweight(to_tsvector('simple', unaccent_immutable(coalesce(summary,''))), 'C')) stored,
  created_by uuid references app_user(id), created_at timestamptz not null default now(),
  updated_at timestamptz not null default now());
create index on entity using gist (point);
create index on entity using gin (tags);
create index on entity using gin (search);
create index on entity using gin (name gin_trgm_ops);
create index on entity (kind, area_id);
create index on entity (fresh_until);

create table saved_place (                       -- the household wishlist: private status on shared catalog places
  household_id text not null references household(id) on delete cascade,
  entity_id text not null references entity(id) on delete cascade,
  status text not null default 'idea' check (status in ('idea','planned','visited','dropped')),
  notes text, source_url text, added_at timestamptz not null default now(),
  primary key (household_id, entity_id));

create table offer (
  id text primary key, entity_id text references entity(id),
  kind text not null check (kind in ('ticket','permit','shuttle','tour','room','campsite','ferry','pass','rental','other')),
  name text not null, operator text, url text,
  price_min numeric, price_max numeric, currency text, price_basis text, price_read_on date,
  window_rule text not null default 'anytime'
    check (window_rule in ('anytime','fixed_date','rolling','monthly_release','lottery','same_day')),
  window_spec jsonb not null default '{}',             -- opens_on | days_before | day_of_month, opens_time, tz, ...
  sellout text check (sellout in ('minutes','hours','days','weeks','rarely')),
  fallback text, eligibility jsonb,               -- per product: Norquay via ferrata routes 12+ and 14+ (R5)
  status text not null default 'published', version int not null default 1);

create table relation (
  from_id text not null references entity(id) on delete cascade,
  to_id text not null references entity(id) on delete cascade,
  kind text not null,                             -- trailhead_of, part_of, near, alternative_to, combo_with, serves, covered_by
  attrs jsonb, primary key (from_id, to_id, kind));

-- research/README.md R2-R7: links, tracks, conditions, events, gaps
create table entity_link (
  id text primary key, entity_id text not null references entity(id) on delete cascade,
  kind text not null,                              -- official, conditions, osm, gpx_source, alltrails, komoot, gaia, trip_report, webcam, video, booking...
  url text not null, label text, lang text, licence text,
  link_only boolean not null default false,        -- may link, never copy data (AllTrails, Google)
  source_id text, last_checked date, http_status smallint, added_by uuid,
  unique (entity_id, url));

create table track (
  id text primary key, entity_id text not null references entity(id) on delete cascade,
  geom geography(LineString,4326) not null,
  source text not null check (source in ('osm','park','agency','manual_gpx')), source_ref text,
  licence text not null, fetched_on date not null,
  length_m int, gain_m_dem int, loss_m_dem int, profile bytea);   -- compact elevation profile

create table condition_report (
  id text primary key, entity_id text references entity(id) on delete cascade, area_id text,
  kind text not null check (kind in ('closure','warning','restriction','status')),
  status text not null check (status in ('open','closed','caution','restricted')),
  summary text not null, source_id text, observed_at timestamptz not null,
  valid_from timestamptz, valid_until timestamptz, superseded_by text,
  check (num_nonnulls(entity_id, area_id) >= 1));
create index on condition_report (entity_id, valid_until);

create table event_occurrence (
  entity_id text not null references entity(id) on delete cascade, year int not null,
  starts_on date not null, ends_on date not null,
  status text not null check (status in ('confirmed','expected','cancelled')), source_id text,
  primary key (entity_id, year, starts_on));

create table source (
  id text primary key, url text not null unique, publisher text,
  kind text not null check (kind in ('official','operator','reference','community','media','agent')),
  licence text, first_read date);

create table evidence (
  id text primary key, entity_id text, offer_id text, field text not null,   -- JSON path, e.g. attrs.distance_km
  value jsonb not null, source_id text references source(id), observed_on date not null,
  quote text check (length(quote) <= 300),
  confidence text not null check (confidence in ('official','operator','community','agent_inferred')),
  author_id uuid references app_user(id), changeset_id text,
  check (num_nonnulls(entity_id, offer_id) = 1));
create index on evidence (entity_id, field);

create table freshness_rule (field_prefix text primary key, max_age_days int not null);

create table media (
  id text primary key, entity_id text references entity(id) on delete cascade,
  storage text not null check (storage in ('commons','r2','external')), key text not null,
  width int, height int, licence text not null, author text, attribution text not null,
  source_url text, caption text, role text not null default 'gallery' check (role in ('hero','gallery','map','user')),
  status text not null default 'proposed' check (status in ('proposed','approved','hidden')),
  phash bigint, created_by uuid references app_user(id));

create table leg_cache (
  from_cell text not null, to_cell text not null,  -- geohash precision 7 (~150 m) for points, 6 for user origins
  mode text not null check (mode in ('drive','walk','bike','transit')),
  seconds int not null, metres int not null, geometry text, provider text not null,
  computed_at timestamptz not null default now(), primary key (from_cell, to_cell, mode));

create table saved_view (id text primary key, owner_id uuid references app_user(id),  -- null = system persona
  name text not null, filters jsonb not null, sort smallint);

-- ───────────── plans ─────────────
create table trip (
  id text primary key, owner_id uuid not null references app_user(id),
  household_id text references household(id),
  title text not null, slug text not null, cover_media_id text,
  scale text not null default 'multi_day' check (scale in ('day_trip','weekend','multi_day')),
  trip_types text[] not null default '{}',        -- family, couple, romantic, luxury, adventure, road_trip, camper... (trip_type ids)
  check_overrides jsonb,                          -- per-trip thresholds for day checks
  budget_target numeric, food_per_person_day numeric,
  area_id text references area(id),
  start_date date, nights int check (nights >= 0), date_window jsonb,
  origin geography(Point,4326), origin_label text, home_tz text not null,
  prefs jsonb not null default '{}',
  phase_override text, visibility text not null default 'private' check (visibility in ('private','link','public')),
  is_template boolean not null default false, forked_from text references trip(id),
  template_version int, forked_from_version int,  -- forks see "updates available" when the template moves on
  template_meta jsonb,                            -- {seasons, min_nights, max_nights, party_fit, travelled: bool, price_year}
  budget_buffer_pct numeric not null default 12, currency text not null default 'CAD',
  version int not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (owner_id, slug),
  check (not is_template or start_date is null));

create table trip_member (trip_id text references trip(id) on delete cascade,
  user_id uuid references app_user(id), invite_email text,
  role text not null check (role in ('owner','editor','viewer')),
  can_invite boolean not null default false, budget_access boolean not null default true,
  unique (trip_id, user_id), unique (trip_id, invite_email));

create table traveller (id text primary key, trip_id text not null references trip(id) on delete cascade,
  person_id text references person(id), name text not null, age_band text, sort_key text not null);

create table trip_candidate (id text primary key, trip_id text not null references trip(id) on delete cascade,
  area_id text references area(id), label text not null, travel_time text, best_time text,
  duration text, cost_estimate numeric, pros text, cons text, notes text, chosen boolean not null default false,
  votes jsonb not null default '{}', sort_key text not null);

create table trip_list (id text primary key, trip_id text not null references trip(id) on delete cascade,
  name text not null, colour text, sort_key text not null);   -- "Ideas" (default), "Restaurants", "Maybe"

-- Reservations: what the travellers booked themselves (we never sell or book), or still have to book.
-- Explained in 09-reservations.md. Kind-specific fields live in details, validated by Zod per kind.
create table reservation (
  id text primary key, trip_id text not null references trip(id) on delete cascade,
  kind text not null check (kind in ('flight','stay','car','train','bus','ferry','transfer','activity',
    'restaurant','parking','insurance','other')),
  status text not null default 'to_book'
    check (status in ('to_book','held','booked','cancelled','done')),   -- held = reserved, pay later / provisional
  title text not null,                              -- "AC 892 Toronto → Venice", "Hotel Ambra, Ortisei"
  provider text, booked_via text,                   -- "Air Canada"; "Expedia" when booked through an agent
  entity_id text references entity(id),             -- the hotel, station, trailhead... when in the catalog
  offer_id text references offer(id),               -- the catalog offer, for its booking window
  opens_at timestamptz, book_by timestamptz,        -- to_book only: from the offer window or set by hand
  price_total numeric, currency text, paid numeric, balance_due_on date,
  payment text check (payment in ('paid','deposit','pay_later','free')),
  refundable boolean, free_cancel_until timestamptz, cancel_policy text,
  contact_phone text, contact_email text, manage_url text,
  details jsonb not null default '{}',               -- per kind: room type, breakfast, car class, insurance cover...
  notes text, source text not null default 'manual'
    check (source in ('manual','email','mcp','import')),
  created_by uuid references app_user(id), version int not null default 1);
create index on reservation (trip_id, status);

-- Codes that let someone change or cancel a booking. Separate table, stricter policy:
-- trip members only; never in link/public views, templates, exports or MCP without reservations:read.
create table reservation_secret (
  reservation_id text primary key references reservation(id) on delete cascade,
  confirmation text, pnr text, agent_ref text, pin text, extra jsonb);

-- One reservation, one or more timed parts: each flight leg, a train leg, a stay (check-in → check-out),
-- a car rental (pickup → drop-off), an activity slot. Times are local wall clock + IANA zone at each end.
create table reservation_segment (
  id text primary key, reservation_id text not null references reservation(id) on delete cascade,
  seq smallint not null,
  start_local timestamp, start_tz text, end_local timestamp, end_tz text,
  from_label text, from_code text, from_point geography(Point,4326), from_entity text references entity(id),
  to_label text, to_code text, to_point geography(Point,4326), to_entity text references entity(id),
  carrier text, number text,                         -- "AC", "892"; train or ferry operator and service number
  terminal_from text, terminal_to text, cabin text,
  details jsonb not null default '{}',               -- stay: room, check-in from/until; car: class; activity: meeting point
  unique (reservation_id, seq));

-- Who is on it, and what is theirs (fixes the "only one passenger imported" problem).
create table reservation_traveller (
  reservation_id text references reservation(id) on delete cascade,
  traveller_id text references traveller(id) on delete cascade,
  seat text, ticket_no text, baggage text, notes text,
  primary key (reservation_id, traveller_id));

create table trip_item (
  id text primary key, trip_id text not null references trip(id) on delete cascade,
  kind text not null check (kind in ('visit','hike','activity','stay','transport','meal','break','note','checklist','custom')),
  entity_id text references entity(id), offer_id text references offer(id),
  title text, point geography(Point,4326), address text, url text,
  list_id text references trip_list(id) on delete set null,  -- used when day is null
  day int check (day >= 1), end_day int, check (end_day is null or end_day >= day),
  start_time time, end_time time, tz text,
  time_hint text check (time_hint in ('sunrise','morning','midday','afternoon','sunset','evening','night')),
  sort_key text not null, parent_id text references trip_item(id) on delete cascade,
  variant_group text, variant text, chosen boolean not null default true,
  plan_b_for text references trip_item(id) on delete set null,
  who text[] not null default '{}',                -- traveller ids; empty = everyone
  status text not null default 'planned' check (status in ('planned','done','skipped')),
  notes text, cost_estimate numeric, currency text,
  checks jsonb,                                    -- kind 'checklist': [{id, text, done}]
  private boolean not null default false,          -- excluded from every shared view (10-sharing.md)
  priority text not null default 'should' check (priority in ('must','should','nice')),  -- used when adapting length
  weather_sensitive boolean not null default false, min_daylight_min int,
  source_item_id text,                             -- the template item this was forked from
  actual_start timestamptz, actual_end timestamptz, -- recorded during the trip (Today mode)
  segment_id text references reservation_segment(id) on delete cascade,  -- anchored: times come from the reservation
  check (entity_id is not null or title is not null or kind in ('note','checklist')));
create index on trip_item (trip_id, day, sort_key);

-- Where each night is spent: the stay segment covering that date (stays use from_* for the property).
-- Feeds routing (each day starts and ends at the night's base) and the "no stay for night N" check.
create view trip_night_base as
select t.id as trip_id, n as night, (t.start_date + n - 1) as on_date,
       s.id as segment_id, r.id as reservation_id, r.title, r.status, s.from_point as point
from trip t
cross join lateral generate_series(1, t.nights) as n
left join (reservation r join reservation_segment s on s.reservation_id = r.id)
  on r.trip_id = t.id and r.kind = 'stay' and r.status in ('held','booked','done')
 and s.start_local::date <= t.start_date + n - 1 and s.end_local::date > t.start_date + n - 1
where t.start_date is not null;

create table day_note (trip_id text references trip(id) on delete cascade, day int not null,
  title text, notes text, private boolean not null default false,
  base_item_id text references trip_item(id) on delete set null,
  weather_rule text, primary key (trip_id, day));


create table task (
  id text primary key, trip_id text references trip(id) on delete cascade,
  household_id text references household(id),     -- year-level tasks (passports) have no trip
  grp text not null check (grp in ('book','buy','pack','documents','prepare','on_the_day')),
  title text not null, due_rule jsonb, due_at timestamptz,
  source text not null default 'manual'
    check (source in ('manual','reservation','booking_window','document_rule','pack_template','conditions')),
  source_ref text, user_edited boolean not null default false,
  owner_user uuid references app_user(id), traveller_id text references traveller(id),
  status text not null default 'todo' check (status in ('todo','done','skipped','not_needed')),
  link text, cost numeric, notes text, sort_key text not null,
  unique (trip_id, source, source_ref),
  check (num_nonnulls(trip_id, household_id) >= 1));

create table reminder (
  id text primary key, task_id text references task(id) on delete cascade,
  reservation_id text references reservation(id) on delete cascade,
  fire_at timestamptz not null, channels text[] not null, kind text not null,
  state text not null default 'scheduled' check (state in ('scheduled','sent','failed','acknowledged','cancelled')),
  sent_at timestamptz, attempts int not null default 0);
create index on reminder (fire_at) where state = 'scheduled';

create table attachment (id text primary key, trip_id text not null references trip(id) on delete cascade,
  reservation_id text references reservation(id), task_id text references task(id),
  r2_key text not null, mime text not null, bytes int not null, uploaded_by uuid references app_user(id));

create table budget_line (id text primary key, trip_id text not null references trip(id) on delete cascade,
  category text not null check (category in ('getting_there','local_transport','lodging','food','activities','misc')),
  label text not null, estimate numeric, actual numeric, currency text not null,
  basis text not null default 'group' check (basis in ('group','per_person','per_person_day')),
  reservation_id text references reservation(id), item_id text references trip_item(id));

create table expense (                           -- what was actually spent, during or after the trip
  id text primary key, trip_id text not null references trip(id) on delete cascade,
  spent_on date not null, label text not null, amount numeric not null, currency text not null,
  amount_home numeric, category text not null
    check (category in ('getting_there','local_transport','lodging','food','activities','misc')),
  item_id text references trip_item(id) on delete set null, reservation_id text references reservation(id) on delete set null,
  paid_by text references traveller(id), split_between text[],   -- optional: enables group balances later
  receipt_id text references attachment(id), created_by uuid references app_user(id));

create table travel_goal (id text primary key, household_id text not null references household(id) on delete cascade,
  year int not null, rule text not null, budget numeric, currency text);

create table calendar_window (id text primary key, region_code text not null, kind text not null
  check (kind in ('public_holiday','long_weekend','school_break','custom')),
  label text not null, starts_on date not null, ends_on date not null, household_id text references household(id));

-- reference data that generates tasks
create table pack_template (id text primary key, name text not null, applies jsonb not null, items jsonb not null);
create table document_rule (id text primary key, citizenship text not null, destination text not null,
  rule jsonb not null, source_id text references source(id), observed_on date);

-- notifications
create table push_subscription (id text primary key, user_id uuid not null references app_user(id) on delete cascade,
  endpoint text unique not null, p256dh text not null, auth text not null, created_at timestamptz not null default now());
create table notification_pref (user_id uuid references app_user(id) on delete cascade, trip_id text references trip(id) on delete cascade,
  channels text[] not null default '{push,email}', quiet_hours jsonb, digest text default 'weekly',
  unique (user_id, trip_id));
create table share_link (                        -- guest links (10-sharing.md); only the token hash is stored
  id text primary key, trip_id text not null references trip(id) on delete cascade,
  token_hash text unique not null, name text,
  scope jsonb not null,                            -- {kind: trip|days|today|list|item|reservation|attachment, ids, from_day, to_day}
  includes jsonb not null default '{}',            -- {notes, stays, transport, codes:[reservation ids], attachments:[ids], costs, tasks}
  allow_copy boolean not null default false, pin_hash text,
  expires_at timestamptz, revoked_at timestamptz,
  created_by uuid references app_user(id), created_at timestamptz not null default now(),
  view_count int not null default 0, last_viewed_at timestamptz);

create table user_settings (user_id uuid primary key references app_user(id) on delete cascade,
  units text not null default 'metric', lang text not null default 'en', quiet_hours jsonb, extra jsonb);

create table mcp_token (                          -- personal access tokens (fallback to OAuth for MCP)
  id text primary key, user_id uuid not null references app_user(id) on delete cascade,
  name text not null, token_hash text unique not null, scopes text[] not null,
  created_at timestamptz not null default now(), last_used_at timestamptz, revoked_at timestamptz);

create table inbound_address (user_id uuid primary key references app_user(id) on delete cascade,
  local_part text unique not null);              -- <local_part>@in.<domain> for forwarded confirmations
create table inbound_email (id text primary key, user_id uuid not null references app_user(id) on delete cascade,
  received_at timestamptz not null default now(), subject text, sender text, storage_key text not null,
  parsed jsonb, status text not null default 'new' check (status in ('new','parsed','needs_review','applied','failed')),
  trip_id text references trip(id), reservation_id text references reservation(id),
  delete_after timestamptz not null default now() + interval '30 days');

create table fx_rate (base text not null, quote text not null, on_date date not null, rate numeric not null,
  source text not null, primary key (base, quote, on_date));

create table check_dismissal (trip_id text references trip(id) on delete cascade, day int, item_id text,
  code text not null, dismissed_by uuid references app_user(id), at timestamptz not null default now(),
  unique (trip_id, day, item_id, code));

create table day_state (trip_id text references trip(id) on delete cascade, day int not null,
  delay_min int not null default 0, plan_b_active boolean not null default false, notes text,
  primary key (trip_id, day));

create table item_memory (id text primary key, trip_id text not null references trip(id) on delete cascade,
  item_id text references trip_item(id) on delete set null, author uuid references app_user(id),
  note text, rating smallint check (rating between 1 and 5), media_key text, private boolean not null default true,
  created_at timestamptz not null default now());

create table template_update_decision (trip_id text references trip(id) on delete cascade,
  template_version int not null, change_ref text not null, decision text not null check (decision in ('applied','ignored')),
  primary key (trip_id, template_version, change_ref));

create table calendar_feed (trip_id text primary key references trip(id) on delete cascade, token text unique not null);

-- ───────────── research & review ─────────────
create table research_job (id text primary key, scope jsonb not null, lanes text[] not null,
  requested_by uuid references app_user(id), runner text not null, status text not null default 'queued',
  budget_usd numeric, spent_usd numeric default 0, created_at timestamptz not null default now(), finished_at timestamptz);

create table changeset (id text primary key, author_id uuid references app_user(id), client text not null,
  job_id text references research_job(id), purpose text,
  status text not null default 'open' check (status in ('open','submitted','accepted','partial','rejected')),
  reviewed_by uuid references app_user(id), created_at timestamptz not null default now(), reviewed_at timestamptz);

create table change (id text primary key, changeset_id text not null references changeset(id) on delete cascade,
  op text not null check (op in ('create','update','retire','merge')),
  target_kind text not null check (target_kind in ('entity','offer','relation','media','area','document_rule','pack_template')),
  target_id text, temp_ref text, base_version int, patch jsonb not null,
  decision text check (decision in ('accepted','rejected','edited')), reviewer_note text);

create table research_gap (id text primary key, job_id text references research_job(id),
  entity_id text references entity(id), temp_ref text, field text not null, reason text not null,
  tried jsonb, created_at timestamptz not null default now(), closed_by_change text, closed_at timestamptz);

create table lane (id text primary key, version int not null, contract jsonb not null, updated_on date not null);
create table trip_type (id text primary key, label text not null, lanes jsonb not null,
  default_filters jsonb not null default '{}', defaults jsonb not null default '{}', deal_breakers jsonb not null default '[]');

create table coverage (area_id text references area(id), kind entity_kind, n int not null,
  with_media numeric, fresh numeric, score text check (score in ('thin','usable','good')),
  computed_at timestamptz not null default now(), primary key (area_id, kind));

create table backlog (id text primary key, area_id text references area(id), entity_id text references entity(id),
  lane text, reason text not null, priority numeric not null, status text not null default 'open',
  requested_by uuid references app_user(id));

-- ───────────── events ─────────────
create table op_event (id bigserial primary key, at timestamptz not null default now(),
  actor_id uuid references app_user(id), client text not null, op text not null,
  trip_id text, entity_id text, client_op_id text, batch_id text,   -- batch = one undo for many ops (MCP edit_trip)
  input jsonb, inverse jsonb, result_version int,
  unique (actor_id, client_op_id));            -- idempotent replay of offline ops
create index on op_event (trip_id, id);

-- ───────────── row-level security (defence in depth; the op layer checks first) ─────────────
-- On Supabase, auth.uid() reads the caller's JWT; our op layer runs as the caller (never service_role)
-- so these policies apply to every operation, and to Realtime channel authorization on realtime.messages.
-- create function app_uid() returns uuid language sql stable as $$ select auth.uid() $$;
-- alter table trip enable row level security;
-- create policy trip_read on trip for select using (
--   visibility <> 'private' or exists (select 1 from trip_member m where m.trip_id = id and m.user_id = app_uid()));
-- create policy trip_write on trip for update using (
--   exists (select 1 from trip_member m where m.trip_id = id and m.user_id = app_uid() and m.role in ('owner','editor')));
-- The same pattern covers every trip-owned table (via trip_id) and household-owned table (via household_member).
-- person, traveller, attachment: never readable through visibility 'link' or 'public'; public views use a
-- separate SECURITY DEFINER function that returns the template shape without them.
