---
type: idea
area: resources
status: draft
tags:
  - fun-project
  - travel-finder
  - ai-agents
  - mcp
created: 2026-06-17
modified: 2026-06-17
---

# Travel Finder — AI & Agent Readiness

> Make the site easy for AI agents to read and act on — without us paying for any LLM inference. Part of [[Travel Finder — Overview]].

## The principle

We are **not** building an AI feature (no chatbot, no per-query model cost). Instead we make the site **structured and machine-actionable** so that *someone else's* agent — a user's ChatGPT/Claude, a browser agent, a future "WebMCP" client — can discover, query, and use it. Agents bring their own model; we expose clean data and tools. Cost to us: effectively zero.

This is mostly good engineering that also helps SEO and accessibility, so it pays off even if no agent ever shows up.

## Three layers, cheapest first

### 1. Structured data on every page (free, do first)

- **JSON-LD** using schema.org types: `TouristTrip` for trips, `TouristAttraction` / `Place` + `GeoCoordinates` for places, `ItemList` for results. Lets general crawlers and agents understand pages without scraping prose.
- Clean semantic HTML, real URLs, `generateMetadata` + Open Graph per page, `sitemap.ts`.
- **`/llms.txt`** at the root: a short, plain-text map of the site and its API for agents — what the site is, the key routes, and a pointer to the API docs.

### 2. A documented public read API (cheap, high-leverage)

A small, stable, read-only JSON API backed by the same Postgres RPCs the UI uses — so agents (and other apps) get first-class access:

```
GET /api/places?lat=&lng=&radius_min=&tags=&kid_friendly=   → places sorted by drive-time
GET /api/trips?region=&scale=                                → trips
GET /api/trips/{slug}                                        → a trip + ordered stops
GET /api/route?points=slugA,slugB,slugC&origin=lat,lng       → ordered route + drive legs + export links
```

- Typed with Zod, versioned, rate-limited, CORS-open for read.
- Returns the same DTOs the UI uses (shared contract — see [[Travel Finder — Data Model]]).
- This is the backbone the next layer wraps.

### 3. Optional MCP / "WebMCP" server (when the spec settles)

A lightweight MCP server (a Vercel function) exposing the API as **tools** an agent can call directly:

- `find_places_near(location, radius_minutes, filters)` 
- `get_trip(slug)` 
- `build_route(place_slugs, origin)` → returns ordered stops + a shareable map link

The agent does the reasoning ("plan me a relaxed Saturday near Ajax with a waterfall and a splash pad for a 7-year-old"); our tools do the lookups and the routing. Still **no model cost on our side** — we're the tool provider, not the model host.

> [!note] "WebMCP" (MCP delivered over the web so any site can offer agent tools) is still early. Plan of record: ship layers 1 and 2 now (they stand on their own), and add the MCP server when the spec and client tooling are stable.

## Why this fits the project

The data is already structured and the API is a thin wrapper over the spatial queries we're building anyway for the UI. Agent-readability is then almost free, and it's exactly the kind of "AI goes through the site" capability worth designing in from the start rather than bolting on.

## Open questions

- Auth/rate-limiting for the public API — anonymous with generous limits, or API keys for heavy use?
- Should `build_route` be a pure function (stateless) or persist named routes (needs the accounts work)?
- Watch the WebMCP spec — adopt when stable; don't over-invest before then.
