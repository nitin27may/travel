---
type: idea
area: resources
status: draft
tags:
  - fun-project
  - travel-finder
  - roadmap
  - planning
created: 2026-06-17
modified: 2026-06-17
---

# Travel Finder — Roadmap & Risks

> A phased, ship-something-early build with clear "done" lines, the gotchas to watch, and what's still open. Part of [[Travel Finder — Overview]].

## Phased roadmap (PR-sized increments)

### P0 — Scaffold + Supabase + schema
Next.js (App Router, TS strict, Tailwind) deployed to a Vercel preview; Supabase project with PostGIS enabled; migrations for the [[Travel Finder — Data Model]] schema + GIST index + RLS read policies.
**Done:** `supabase db reset` applies cleanly; `postgis_version()` works; anon read returns rows, anon write is rejected; placeholder page reads the empty `trips` table.

### P1 — Ingestion + geocode + seed
Python `tooling/ingest` (uv + Pydantic): parse the 5 `*-mymaps.csv` + the 40-row table in [[Day Trips Local]] + trip frontmatter, geocode addresses (cached), idempotent upsert.
**Done:** DB populated with `geom` set for everything geocodable; a second run reports 0 changes; a distance query from Whitby reproduces the known near→far ordering.

### P2 — Hybrid discovery (the hero)
Map ↔ Cards ↔ Split toggle; set-your-location (address/pin/geolocation, stored in URL+localStorage); **drive-time** via `ST_DWithin` prefilter + cached Matrix; instant search + faceted filters + persona presets. See [[Travel Finder — UX & UI]].
**Done:** with no login, setting origin to Toronto re-sorts list + map by real drive-time; radius and facet filters work; the URL captures and restores state; drive-time cache hits on repeat queries.

### P3 — Detail pages + route/graph builder + export
Trip and place detail pages; multi-stop route tray with nearest-neighbour ordering over `place_edges`; map polyline + graph view; export as Google Maps waypoint link and a `make_maps.py`-shaped My Maps CSV.
**Done:** a user builds a 4-stop route, sees ordered legs with drive-times, and exports a working My Maps CSV + directions link from their own location.

### P4 — Agent-readability + SEO
JSON-LD on all pages, `/llms.txt`, `sitemap.ts`, OG images; the documented public read API. See [[Travel Finder — AI & Agent Readiness]].
**Done:** JSON-LD validates; the public API returns typed results; pages are crawlable and share cleanly.

### P5 — Media + accounts/favorites
Supabase Storage for trip/place photos (my own shots, credited); optional Auth so a logged-in user can save a default location, favorites, and visited.
**Done:** images render; anonymous flow still works; a second test user cannot read another user's saved rows (RLS verified).

### P6 — Later
Drive-time everywhere, contributions from trusted users, richer personalization, the optional MCP server.

## Consolidated risks & gotchas

- **PostGIS on Supabase:** enable the extension in migrations; queries/RPCs must qualify the function schema (`extensions.st_distance`) or set `search_path`, or they fail at runtime.
- **`geography` vs `geometry`:** use `geography(Point,4326)` so distances come back in metres — no projection math.
- **Geocoding + Matrix cost / ToS:** throttle, cache, and prefilter spatially before any Matrix call. Never loop a paid API on render or in CI. Nominatim is a free fallback only (1 req/s, no bulk).
- **Key security:** `service_role` lives only on the laptop; browser map/autocomplete keys are referrer-restricted; powerful keys stay server-side in Route Handlers.
- **RLS fails closed:** enable + explicit read policies on every table; verify cross-user isolation with a second account before shipping P5.
- **Content accuracy drift:** hours/fees/seasons go stale (the source notes warn of this). Show a "last verified" date, treat prices as estimates, never present stale data as authoritative.
- **Image licensing:** only my own photos or properly-licensed/credited images; store credit + license on upload.
- **Vault ↔ DB sync:** one-way, idempotent ingest — re-running is the cure for drift. Document it as the single sync ritual after each new trip.

## Reusable assets (don't reinvent)

- `.claude/skills/trip-planner/scripts/make_maps.py` — canonical CSV/JSON interchange + `search_link()`/`route_link()` to port to TS.
- `assets/day-trips/*-mymaps.csv` — clean seed data (5 trips), needs geocoding.
- [[Day Trips Local]] — the 40-destination bulk seed.
- [[Travel Preferences]] — the home-base concept the app generalizes to a per-user origin.
- The [[trip-planner]] skill itself — it keeps producing the CSVs that feed ingestion.

## Open questions (whole project)

- Brand + domain.
- Region focus first (Durham/GTA) vs. national from day one.
- Provider: Google end-to-end vs. all-Mapbox.
- How much "story/blog" layer to add on top of the tool.
- When to invest in the MCP server vs. just the documented API.

## Next step when I want to start

Begin at **P0** in a fresh `travel-finder` repo. Everything above is brainstorm — no app code exists yet.
