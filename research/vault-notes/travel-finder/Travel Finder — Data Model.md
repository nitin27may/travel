---
type: idea
area: resources
status: draft
tags:
  - fun-project
  - travel-finder
  - data-model
  - postgis
created: 2026-06-17
modified: 2026-06-17
---

# Travel Finder — Data Model

> The schema, how it serves every kind of traveller, the place-graph that powers multi-stop routes, and how vault data flows in. Part of [[Travel Finder — Overview]].

## Goals shaping the model

1. **Spatial-first** — every place has a real coordinate so "distance from you" is a database operation, not an afterthought.
2. **All traveller types find their data** — rich, faceted tagging plus persona presets, so a family with young kids, a hardcore hiker, a foodie, or someone needing accessibility all filter to *their* version of the region.
3. **Places relate to each other** — a graph of nearby/combinable places so multi-point routes and "what else can I pair with this" work well.

## Core schema (Postgres + PostGIS)

```sql
create extension if not exists postgis;

create type trip_scale as enum ('day_trip','weekend','multi_day');

create table trips (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  scale trip_scale not null default 'day_trip',
  home_base text,                 -- original anchor (provenance only; app recomputes per user)
  summary text,
  best_season text,
  est_cost_min numeric, est_cost_max numeric, currency text default 'CAD',
  source_note text,               -- vault path, for traceability
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table places (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  address text,
  geom geography(Point,4326),     -- metres-true distance; nullable until geocoded
  geocode_status text default 'pending'
    check (geocode_status in ('pending','ok','failed','manual')),
  description text,
  time_needed text,               -- preserve source strings ("2-3 hrs")
  cost text,
  cost_tier smallint,             -- 0 free .. 4 splurge, for filtering
  -- facets so every traveller type can filter:
  kid_friendly smallint check (kid_friendly between 0 and 5),
  difficulty smallint,            -- 0 easy .. 3 hard (trails)
  indoor boolean default false,
  pet_friendly boolean,
  transit_accessible boolean,
  accessibility jsonb,            -- {stroller, wheelchair, washrooms, ...}
  season_months int[],            -- e.g. {5,6,7,8,9}
  google_maps_link text,
  search_doc tsvector,            -- name + description + tags, for instant search
  source_note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table trip_places (
  trip_id uuid references trips(id) on delete cascade,
  place_id uuid references places(id) on delete cascade,
  day_number smallint, stop_order smallint, arrival_time time, notes text,
  primary key (trip_id, place_id, day_number, stop_order)
);
```

## Faceted tags + traveller personas

Free filtering comes from tags plus the facet columns above.

```sql
create table tags (id smallserial primary key, slug text unique, label text, kind text);
-- kind: 'activity' (hike, swim, tubing), 'vibe' (relaxing, adventure, romantic),
--       'feature' (waterfall, lookout, cave, splash-pad), 'audience' (family, accessible)
create table place_tags (place_id uuid references places(id) on delete cascade,
                         tag_id smallint references tags(id) on delete cascade,
                         primary key (place_id, tag_id));
```

**Personas** are saved filter presets, not a separate table of users — e.g. "Family with young kids" = `kid_friendly >= 3 AND tags ~ splash-pad/easy-trail`, "Hardcore hiker" = `difficulty >= 2 AND tags ~ hike/lookout`, "Accessible day out" = `accessibility.wheelchair`, "Foodie weekend" = `scale=weekend AND tags ~ food/market`. These become one-tap quick-starts in the UI (see [[Travel Finder — UX & UI]]).

## The place graph (multi-point routes)

This is the "graphical relation across multiple points" idea. Precompute edges between places that are realistically combinable, store drive metrics, and use them to order multi-stop routes and suggest pairings.

```sql
create table place_edges (
  a_id uuid references places(id) on delete cascade,
  b_id uuid references places(id) on delete cascade,
  drive_minutes int, drive_km numeric, straight_km numeric,
  primary key (a_id, b_id)
);

create table drive_time_cache (        -- user-origin -> place, cached by rounded origin
  origin_geohash text, place_id uuid references places(id) on delete cascade,
  minutes int, km numeric, fetched_at timestamptz default now(),
  primary key (origin_geohash, place_id)
);
```

Edges are built within a region (only pairs under, say, 60 min apart) from the same Matrix calls used for drive-time — so the graph is a byproduct, not extra cost. A route builder runs nearest-neighbour over the selected nodes; rendering and export are covered in [[Travel Finder — UX & UI]].

## Indexes + RLS

```sql
create index places_geom_gix on places using gist (geom);
create index places_search_gix on places using gin (search_doc);
create index places_trgm on places using gin (name gin_trgm_ops);   -- fuzzy search

alter table trips enable row level security;
alter table places enable row level security;
create policy "public read" on trips for select using (true);
create policy "public read" on places for select using (true);
-- no write policies for anon/auth; ingestion uses service_role (bypasses RLS).
```

> [!warning] RLS fails closed: enabling it **without** a select policy silently returns zero rows. Always pair `enable row level security` with an explicit read policy, and verify.

## Ingestion from the vault

A re-runnable Python job (`tooling/ingest`, uv + Pydantic) that:

1. Reads every `assets/day-trips/*-mymaps.csv` (already the canonical shape — see [[Travel Finder — AI & Agent Readiness]] for the shared contract idea).
2. Parses the 40-row table in [[Day Trips Local]] (the bulk seed).
3. Reads trip-note frontmatter for metadata + `source_note` path.
4. **Geocodes** addresses → `geom`, with a persistent SQLite cache so re-runs never re-geocode; manual lat/lng always wins (`geocode_status='manual'`).
5. **Upserts** on a stable `slug` (slugify name + town) → idempotent: a second run with no vault changes is a no-op.

The Pydantic models mirror the `make_maps.py` JSON schema exactly, so the same contract is enforced on both the tooling and the web side.

## What's reliably populated vs. sparse

- **Reliable:** name, address, description, cost, time_needed, category/tags, trip linkage + ordering (for the 5 structured trips).
- **Needs a pass:** coordinates (geocode), `kid_friendly`/`difficulty`/`accessibility` (infer from prose now, refine later), `place_edges` (built from Matrix), seasonal open/close.

## Open questions

- Categories in the current CSVs are free-text (`hike-tubing`, `splash-pad`) — normalize into the `tags` vocabulary with a small mapping table; how strict a vocabulary?
- Do bucket-list / multi-day trips ([[Location]]) share the same `places` table or get a lighter "dream" treatment?
- Store opening hours structured, or keep as prose with a "last verified" date?
