-- 0004_plans.sql — trips, reservations and itinerary. User identities TEXT; offer FKs point at
-- offer(entity_id) (M6 made entity_id the offer PK). All private: RLS enabled, no policy (deny).

create table trip (
  id text primary key, owner_id text not null references app_user(id),
  household_id text references household(id),
  title text not null, slug text not null, cover_media_id text,
  scale text not null default 'multi_day' check (scale in ('day_trip','weekend','multi_day')),
  trip_types text[] not null default '{}',
  check_overrides jsonb,
  budget_target numeric, food_per_person_day numeric,
  area_id text references area(id),
  start_date date, nights int check (nights >= 0), date_window jsonb,
  origin geography(Point,4326), origin_label text, home_tz text not null,
  prefs jsonb not null default '{}',
  phase_override text, visibility text not null default 'private'
    check (visibility in ('private','link','public')),
  is_template boolean not null default false, forked_from text references trip(id),
  template_version int, forked_from_version int, template_meta jsonb,
  budget_buffer_pct numeric not null default 12, currency text not null default 'CAD',
  version int not null default 1, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, slug),
  check (not is_template or start_date is null));

create table trip_member (trip_id text references trip(id) on delete cascade,
  user_id text references app_user(id), invite_email text,
  role text not null check (role in ('owner','editor','viewer')),
  can_invite boolean not null default false, budget_access boolean not null default true,
  unique (trip_id, user_id), unique (trip_id, invite_email));

create table traveller (id text primary key, trip_id text not null references trip(id) on delete cascade,
  person_id text references person(id), name text not null, age_band text, sort_key text not null);

create table trip_candidate (id text primary key, trip_id text not null references trip(id) on delete cascade,
  area_id text references area(id), label text not null, travel_time text, best_time text,
  duration text, cost_estimate numeric, pros text, cons text, notes text,
  chosen boolean not null default false,
  votes jsonb not null default '{}', sort_key text not null);

create table trip_list (id text primary key, trip_id text not null references trip(id) on delete cascade,
  name text not null, colour text, sort_key text not null);

create table reservation (
  id text primary key, trip_id text not null references trip(id) on delete cascade,
  kind text not null check (kind in ('flight','stay','car','train','bus','ferry','transfer','activity',
    'restaurant','parking','insurance','other')),
  status text not null default 'to_book'
    check (status in ('to_book','held','booked','cancelled','done')),
  title text not null, provider text, booked_via text,
  entity_id text references entity(id), offer_id text references offer(entity_id),
  opens_at timestamptz, book_by timestamptz,
  price_total numeric, currency text, paid numeric, balance_due_on date,
  payment text check (payment in ('paid','deposit','pay_later','free')),
  refundable boolean, free_cancel_until timestamptz, cancel_policy text,
  contact_phone text, contact_email text, manage_url text,
  details jsonb not null default '{}',
  notes text, source text not null default 'manual'
    check (source in ('manual','email','mcp','import')),
  created_by text references app_user(id), version int not null default 1);
create index on reservation (trip_id, status);

create table reservation_secret (
  reservation_id text primary key references reservation(id) on delete cascade,
  confirmation text, pnr text, agent_ref text, pin text, extra jsonb);

create table reservation_segment (
  id text primary key, reservation_id text not null references reservation(id) on delete cascade,
  seq smallint not null,
  start_local timestamp, start_tz text, end_local timestamp, end_tz text,
  from_label text, from_code text, from_point geography(Point,4326), from_entity text references entity(id),
  to_label text, to_code text, to_point geography(Point,4326), to_entity text references entity(id),
  carrier text, number text,
  terminal_from text, terminal_to text, cabin text,
  details jsonb not null default '{}',
  unique (reservation_id, seq));

create table reservation_traveller (
  reservation_id text references reservation(id) on delete cascade,
  traveller_id text references traveller(id) on delete cascade,
  seat text, ticket_no text, baggage text, notes text,
  primary key (reservation_id, traveller_id));

create table trip_item (
  id text primary key, trip_id text not null references trip(id) on delete cascade,
  kind text not null check (kind in ('visit','hike','activity','stay','transport','meal','break','note','checklist','custom')),
  entity_id text references entity(id), offer_id text references offer(entity_id),
  title text, point geography(Point,4326), address text, url text,
  list_id text references trip_list(id) on delete set null,
  day int check (day >= 1), end_day int, check (end_day is null or end_day >= day),
  start_time time, end_time time, tz text,
  time_hint text check (time_hint in ('sunrise','morning','midday','afternoon','sunset','evening','night')),
  sort_key text not null, parent_id text references trip_item(id) on delete cascade,
  variant_group text, variant text, chosen boolean not null default true,
  plan_b_for text references trip_item(id) on delete set null,
  who text[] not null default '{}',
  status text not null default 'planned' check (status in ('planned','done','skipped')),
  notes text, cost_estimate numeric, currency text,
  checks jsonb,
  private boolean not null default false,
  priority text not null default 'should' check (priority in ('must','should','nice')),
  weather_sensitive boolean not null default false, min_daylight_min int,
  source_item_id text,
  actual_start timestamptz, actual_end timestamptz,
  segment_id text references reservation_segment(id) on delete cascade,
  check (entity_id is not null or title is not null or kind in ('note','checklist')));
create index on trip_item (trip_id, day, sort_key);

-- security_invoker so the view respects RLS on reservation/reservation_segment (PG15+).
create view trip_night_base with (security_invoker = true) as
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
  household_id text references household(id),
  grp text not null check (grp in ('book','buy','pack','documents','prepare','on_the_day')),
  title text not null, due_rule jsonb, due_at timestamptz,
  source text not null default 'manual'
    check (source in ('manual','reservation','booking_window','document_rule','pack_template','conditions')),
  source_ref text, user_edited boolean not null default false,
  owner_user text references app_user(id), traveller_id text references traveller(id),
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
  r2_key text not null, mime text not null, bytes int not null, uploaded_by text references app_user(id));

create table budget_line (id text primary key, trip_id text not null references trip(id) on delete cascade,
  category text not null check (category in ('getting_there','local_transport','lodging','food','activities','misc')),
  label text not null, estimate numeric, actual numeric, currency text not null,
  basis text not null default 'group' check (basis in ('group','per_person','per_person_day')),
  reservation_id text references reservation(id), item_id text references trip_item(id));

create table expense (
  id text primary key, trip_id text not null references trip(id) on delete cascade,
  spent_on date not null, label text not null, amount numeric not null, currency text not null,
  amount_home numeric, category text not null
    check (category in ('getting_there','local_transport','lodging','food','activities','misc')),
  item_id text references trip_item(id) on delete set null,
  reservation_id text references reservation(id) on delete set null,
  paid_by text references traveller(id), split_between text[],
  receipt_id text references attachment(id), created_by text references app_user(id));

alter table trip                   enable row level security;
alter table trip_member            enable row level security;
alter table traveller              enable row level security;
alter table trip_candidate         enable row level security;
alter table trip_list              enable row level security;
alter table reservation            enable row level security;
alter table reservation_secret     enable row level security;
alter table reservation_segment    enable row level security;
alter table reservation_traveller  enable row level security;
alter table trip_item              enable row level security;
alter table day_note               enable row level security;
alter table task                   enable row level security;
alter table reminder               enable row level security;
alter table attachment             enable row level security;
alter table budget_line            enable row level security;
alter table expense                enable row level security;
-- All private: no policy, no grant to travel_app (deny) in this integration.
