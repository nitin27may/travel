-- 0007_projections.sql — serving-tier projections (M13), written later by the core builder from
-- createPublicData() output. Public read; empty until the loader runs (catalogue cutover deferred).

create table place_row (
  slug text primary key, ref text not null, row jsonb not null,
  country text, region text, area text, near_town_id text, type_id text, legacy_kind text,
  point geography(Point,4326), approx boolean, bands jsonb,
  sort_name text collate "C");
create index on place_row using gist (point);
create index on place_row (country, region, area);
create index on place_row (type_id);
create index on place_row (sort_name);

create table place_page (slug text primary key, ref text, doc jsonb);
create table trip_row (slug text primary key, row jsonb);
create table trip_page (slug text primary key, doc jsonb);

alter table place_row  enable row level security;
alter table place_page enable row level security;
alter table trip_row   enable row level security;
alter table trip_page  enable row level security;

create policy p_read on place_row  for select using (true);
create policy p_read on place_page for select using (true);
create policy p_read on trip_row   for select using (true);
create policy p_read on trip_page  for select using (true);

grant select on place_row, place_page, trip_row, trip_page to travel_app;
