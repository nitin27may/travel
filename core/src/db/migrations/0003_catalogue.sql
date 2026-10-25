-- 0003_catalogue.sql — geography, catalogue and research-support tables, in their accepted
-- post-diff shape (schema diff M1–M15, research/reports/schema-diff-2026-10.md). Serving-tier
-- tables get a public SELECT policy and a SELECT grant to the app role; source-tier and internal
-- tables get RLS with no policy (deny). No data is loaded here — the public catalogue stays on
-- JsonStore until a PostgresStore passes the contract kit.

-- ---------- vocab (M2) ----------
create table type_node (
  id text primary key, parent_id text references type_node(id),
  level text not null check (level in ('domain','category','type','subtype')),
  label text not null, records text[], profile text, doc jsonb not null default '{}');

create table tag (id text primary key, doc jsonb not null default '{}');
create table relevance_class (key text primary key, doc jsonb not null default '{}');

-- ---------- geography (M3 area_alter, M4 town) ----------
create table area (
  id text primary key, parent_id text references area(id), path ltree not null,
  level text not null check (level in ('country','region','area')),
  name text not null, slug text, iso_code text, iso_a3 text, wikidata_qid text,
  centre geography(Point,4326), boundary geography(MultiPolygon,4326), tz text);
create index on area using gist (path);
create index on area using gist (boundary);

create table town (
  id text primary key,                         -- format ca-on-whitby (owner decision 13.4)
  cc text not null, admin1 text, region_id text references area(id),
  name text not null, ascii text, point geography(Point,4326) not null,
  pop int, geonames_id int unique, wikidata_qid text,
  is_base boolean not null default false, is_hub boolean not null default false,
  licence text not null default 'CC BY 4.0');
create index on town using gist (point);
create index on town using gin (ascii gin_trgm_ops);

create table operator (
  ref text primary key, name text not null, url text, terms_url text, waiver_url text,
  phone text, licence text, doc jsonb not null default '{}');

-- ---------- entity (M5: id = ref verbatim) ----------
create table entity (
  id text primary key,                         -- the stable ref, verbatim
  layer text not null check (layer in ('place','route','offer','event')),
  type_id text references type_node(id),
  kind text,                                   -- legacy family the URL accepts; nullable
  subkind text,
  name text not null, names jsonb not null default '{}', slug text unique,
  area_id text references area(id),
  point geography(Point,4326), shape geography(Geometry,4326),
  point_role text check (point_role in
    ('centre','trailhead','entrance','parking','meeting','summit','route_start')),
  point_approx boolean not null default false, point_src jsonb,
  near_town_id text references town(id), near_town_km numeric,
  route_is_attraction boolean, attraction_reason text, origin jsonb,
  summary text, tags text[] not null default '{}',
  season jsonb, hours jsonb, eligibility jsonb,
  cost_band smallint check (cost_band between 0 and 4),
  duration_min int, duration_max int, website text,
  attrs jsonb not null default '{}',
  doc jsonb not null default '{}',             -- the resolved capture record, verbatim
  wikidata_qid text, osm_ref text,
  status text not null default 'published' check (status in ('draft','published','retired')),
  trust text not null default 'unverified' check (trust in ('unverified','stated','verified')),
  fresh_until date, version int not null default 1,
  search tsvector generated always as (
    setweight(to_tsvector('simple', unaccent_immutable(name)), 'A') ||
    setweight(to_tsvector('simple', unaccent_immutable(coalesce(summary,''))), 'C')) stored,
  created_by text references app_user(id), created_at timestamptz not null default now(),
  updated_at timestamptz not null default now());
create index on entity using gist (point);
create index on entity using gin (tags);
create index on entity using gin (search);
create index on entity using gin (name gin_trgm_ops);
create index on entity (layer, area_id);
create index on entity (wikidata_qid);
create index on entity (fresh_until);

create table entity_alias (alias text primary key, ref text not null references entity(id));

create table saved_place (                     -- household wishlist: private status on shared places
  household_id text not null references household(id) on delete cascade,
  entity_id text not null references entity(id) on delete cascade,
  status text not null default 'idea' check (status in ('idea','planned','visited','dropped')),
  notes text, source_url text, added_at timestamptz not null default now(),
  primary key (household_id, entity_id));

-- ---------- offer (M6: 1:1 extension of entity) ----------
create table offer (
  entity_id text primary key references entity(id),
  offer_class text check (offer_class in ('experience','rental','ticket','access','lodging')),
  name text not null, operator text, url text, book_url text,
  run_by text references operator(ref),
  price jsonb not null default '[]', "window" jsonb not null default '{}', variants jsonb,
  price_min numeric, price_max numeric, currency text, price_basis text, price_read_on date,
  eligibility jsonb, fallback text,
  status text not null default 'published', version int not null default 1,
  doc jsonb not null default '{}');

-- ---------- relation (M10) ----------
create table relation (
  from_id text not null references entity(id) on delete cascade,
  to_id text not null references entity(id) on delete cascade,
  kind text not null check (kind in ('reaches','part_of','passes','at','on','starts_at','ends_at',
    'parks_for','serves','combo_with','alternative_to','variant_of')),
  ord smallint not null default 0, at_km numeric, from_km numeric, to_km numeric,
  attrs jsonb, primary key (from_id, to_id, kind));

-- ---------- links, tracks, conditions, events (M7, track widen) ----------
create table entity_link (
  id text primary key, entity_id text not null references entity(id) on delete cascade,
  kind text not null, url text, label text, lang text, licence text,
  link_only boolean not null default false,
  state text not null check (state in ('filled','searched_none','found_in_search')),
  query text, checked_on date, src text[],
  source_id text, last_checked date, http_status smallint, added_by text,
  check (state <> 'filled' or url is not null),
  unique nulls not distinct (entity_id, kind, url));

create table track (
  id text primary key, entity_id text references entity(id) on delete cascade,
  geom geography(LineString,4326) not null,
  source text not null, source_ref text,
  licence text not null, fetched_on date not null,
  length_m int, gain_m_dem int, loss_m_dem int, profile bytea,
  meta jsonb, elevation jsonb);

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

-- ---------- sources & provenance (M11, M12, evidence) ----------
create table source (
  id text primary key, url text not null unique, publisher text, title text,
  kind text not null,                          -- widened: official/operator/reference/community/media/agent/editorial/agency
  licence text, first_read date, last_read date, licence_note text, terms_note text,
  automated boolean, recheck jsonb,
  link_status text, http_status smallint, final_url text, link_checked date);

create table dataset_file (
  id text primary key,                         -- repo path
  schema text not null, trip text, lane text, researched date,
  agent text, model text, sha256 text not null, loaded_at timestamptz);

create table record_doc (
  file_id text not null references dataset_file(id) on delete cascade,
  ref text not null,
  family text not null check (family in ('capture','suitability','relevance')),
  doc jsonb not null, primary key (file_id, ref));

create table source_local (
  file_id text not null references dataset_file(id) on delete cascade,
  local_id text not null, source_id text references source(id),
  method text, run text, read date, primary key (file_id, local_id));

create table capture_supersede (
  id text primary key, layer text, ref text, path text,
  was jsonb, value jsonb not null, reason text, by text, on_date date);

create table evidence (
  id text primary key, entity_id text, offer_id text, field text not null,
  value jsonb not null, source_id text references source(id), observed_on date not null,
  quote text check (length(quote) <= 300),
  confidence text not null check (confidence in ('official','operator','community','agent_inferred')),
  author_id text references app_user(id), changeset_id text,
  check (num_nonnulls(entity_id, offer_id) = 1));
create index on evidence (entity_id, field);

create table freshness_rule (field_prefix text primary key, max_age_days int not null);

-- ---------- media (M8) ----------
create table media (
  id text primary key, entity_id text references entity(id) on delete cascade,
  storage text not null check (storage in ('commons','r2','external')), key text not null,
  width int, height int, licence text not null, licence_url text, author text,
  attribution text not null, source_url text, caption text,
  trip_slug text, section text, "position" int,
  role text not null default 'gallery' check (role in ('hero','gallery','map','user')),
  status text not null default 'proposed' check (status in ('proposed','approved','hidden')),
  phash bigint, created_by text references app_user(id));

create table leg_cache (
  from_cell text not null, to_cell text not null,
  mode text not null check (mode in ('drive','walk','bike','transit')),
  seconds int not null, metres int not null, geometry text, provider text not null,
  computed_at timestamptz not null default now(), primary key (from_cell, to_cell, mode));

create table saved_view (id text primary key, owner_id text references app_user(id),
  name text not null, filters jsonb not null, sort smallint);

-- ---------- suitability / relevance serving (M9) ----------
create table suitability (
  ref text primary key references entity(id), kind text, subkind text,
  block jsonb not null default '{}', flat jsonb not null default '{}', ext jsonb,
  operated boolean, file_id text);

create table relevance (
  ref text primary key references entity(id),
  class_key text references relevance_class(key), doc jsonb not null default '{}');

create table relevance_derived (
  trip_slug text not null, ref text not null, as_of date, doc jsonb,
  primary key (trip_slug, ref));

create table relevance_signal (
  source text not null, key text not null, doc jsonb, fetched date,
  primary key (source, key));

create table catalogue_meta (key text primary key, value text);

-- ---------- RLS: enable on every table in this migration ----------
alter table type_node         enable row level security;
alter table tag               enable row level security;
alter table relevance_class   enable row level security;
alter table area              enable row level security;
alter table town              enable row level security;
alter table operator          enable row level security;
alter table entity            enable row level security;
alter table entity_alias      enable row level security;
alter table saved_place       enable row level security;
alter table offer             enable row level security;
alter table relation          enable row level security;
alter table entity_link       enable row level security;
alter table track             enable row level security;
alter table condition_report  enable row level security;
alter table event_occurrence  enable row level security;
alter table source            enable row level security;
alter table dataset_file      enable row level security;
alter table record_doc        enable row level security;
alter table source_local      enable row level security;
alter table capture_supersede enable row level security;
alter table evidence          enable row level security;
alter table freshness_rule    enable row level security;
alter table media             enable row level security;
alter table leg_cache         enable row level security;
alter table saved_view        enable row level security;
alter table suitability       enable row level security;
alter table relevance         enable row level security;
alter table relevance_derived enable row level security;
alter table relevance_signal  enable row level security;
alter table catalogue_meta    enable row level security;

-- ---------- public-read serving tier: SELECT policy + grant to the app role ----------
create policy p_read on type_node        for select using (true);
create policy p_read on tag              for select using (true);
create policy p_read on relevance_class  for select using (true);
create policy p_read on area             for select using (true);
create policy p_read on town             for select using (true);
create policy p_read on operator         for select using (true);
create policy p_read on entity           for select using (status = 'published');
create policy p_read on entity_alias     for select using (true);
create policy p_read on offer            for select using (true);
create policy p_read on relation         for select using (true);
create policy p_read on entity_link      for select using (true);
create policy p_read on track            for select using (true);
create policy p_read on condition_report for select using (true);
create policy p_read on event_occurrence for select using (true);
create policy p_read on source           for select using (true);
create policy p_read on media            for select using (status = 'approved');
create policy p_read on suitability      for select using (true);
create policy p_read on relevance        for select using (true);
create policy p_read on relevance_derived for select using (true);
create policy p_read on relevance_signal for select using (true);
create policy p_read on catalogue_meta   for select using (true);

grant select on type_node, tag, relevance_class, area, town, operator, entity, entity_alias,
  offer, relation, entity_link, track, condition_report, event_occurrence, source, media,
  suitability, relevance, relevance_derived, relevance_signal, catalogue_meta to travel_app;
-- saved_place, saved_view, and every source-tier/internal table: RLS on, no policy, no grant (deny).
