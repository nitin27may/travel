# 03. MCP and research

## 1. Who uses the MCP, for what

| User | Client | Typical session |
|---|---|---|
| A traveller | Claude, ChatGPT, any MCP client | "Plan 4 days in Banff in September for us; the kids are 9 and 11; nothing over 12 km." The client searches the catalog, creates the trip, adds days and items, and the trip appears in the app |
| The owner as researcher | Claude Code, Claude Desktop | "Research El Chaltén trails and stays; refresh prices for Lake Louise." The client submits changesets with sources; the owner reviews them in `/admin` |
| A moderator | any client with the `review` scope | "Show open changesets for Patagonia; accept the official-source ones" |
| Integrations | plain HTTP | the same operations through the OpenAPI spec |

The Travel Finder rule still holds: **we are the tool provider, not the model host.** The user's own
client pays for reasoning; our cost is a database query.

## 2. Tool design

Chat clients pick tools less reliably as the list grows, and thin CRUD tools force long call chains.
So the MCP exposes **about 20 task-shaped tools** over the operation layer, not one tool per operation.
Every tool's input is a Zod schema exported as JSON Schema; every output is compact JSON with ids and a
`url` to the same thing in the app.

### Explore (scope `catalog:read`, also anonymous with low limits)
| Tool | Does |
|---|---|
| `search` | text, kinds, tags, area, near a point with radius or drive minutes, along a route corridor, open in a date range, fits a party (ages, walking limit); returns ranked results **with the reason line** |
| `get` | one or more entities, offers or areas by id or slug, with evidence summary and trust |
| `area_guide` | what an area has per kind, seasons, coverage score, top picks per persona |
| `plan_drive` | legs between points with drive time, and suggested stops every N hours |
| `sun` | sunrise, sunset, twilight, darkness for a place and dates |

### Plan (scopes `trips:read`, `trips:write`)
| Tool | Does |
|---|---|
| `list_trips` / `get_trip` | the user's trips; a trip as days, items, bookings, tasks, checks |
| `create_trip` | title, scale, dates or window, area, party (from the household), prefs |
| `edit_trip` | **one tool, many ops**: an ordered list of operations (`add_item`, `move_item`, `set_time`, `add_note`, `add_custom_item`, `set_variant`, `set_plan_b`, `remove_item`, `add_day_note`, `set_prefs`...) applied atomically with one undo; returns the new version and any day-check warnings |
| `draft_days` | runs the planner over the trip's ideas; returns a preview, or applies it with `apply: true` |
| `check_trip` | day checks with suggested fixes (each fix is an `edit_trip` payload the client can send) |
| `bookings` | list deadlines and windows; mark booked with a confirmation |
| `tasks` | list, add, complete |
| `fork_template` | copy a public template into a new trip with new dates and party |

### Research (scope `research:propose`)
| Tool | Does |
|---|---|
| `research_brief` | for an area or entity: what exists, coverage gaps, stale fields, open conflicts, the lane contracts, and the source rules; **call this first** |
| `start_job` | opens a research job (scope, lanes) and returns its id and an open changeset |
| `propose` | adds changes to a changeset: create or update entities, offers, relations, media, each with evidence (source URL, read date, short paraphrase, confidence) |
| `submit_job` | closes the changeset for review, with a summary of what was and was not found (gaps are data too) |

### Review (scope `review`)
| Tool | Does |
|---|---|
| `review_queue` | open changesets with diffs and evidence |
| `decide` | accept, reject or edit-then-accept per change; merge duplicates |

### Resources and prompts
- Resources: the JSON Schema of every entity kind and offer window rule, the tag vocabulary with
  aliases, the difficulty scale, the freshness rules, the lane contracts, the source and licence rules.
- Prompts: one research recipe per lane ("trails lane: distance, gain, loss, loop or out-and-back,
  local grade, trailhead with parking, season, closures, permit, geometry source; official source
  first"), "plan a trip from my household defaults", "refresh stale facts in an area".

## 3. Auth for MCP clients

- Remote MCP over Streamable HTTP at `/mcp`, OAuth 2.1 with PKCE via Better Auth's MCP plugin.
  Clients register by **Client ID Metadata Documents** (the newer MCP profile) or, where a client still
  needs it, dynamic client registration, which we switch on deliberately.
- The consent screen names the client and the scopes in plain words ("Claude will be able to read
  and change your trips; it cannot see your family's passport dates").
- Every operation records `client` (for example `mcp:claude`) in `op_event`, so the trip's activity
  feed shows "Claude added 6 items" with one-click undo of that batch.
- Tokens are revocable per client in Settings.
- Never exposed over MCP: passport dates, heights, attachments, other people's trips.

## 4. Research as a system

### 4.1 Lanes, each with a contract

Destination overview · trails · adventure (with age, height and weight limits) · sights and
viewpoints · hidden gems · stays · food · relax and luxury · road trip and legs · timing and light ·
entry and documents · fares and costs · media · community reality checks. A contract lists required
fields, preferred sources in order (official park or operator first), what counts as evidence, and
what to leave empty rather than guess.

### 4.2 Onboarding a new destination

1. **Geography**: area tree and polygons from Wikidata and OpenStreetMap (import script, not an LLM).
2. **Candidates**: named POIs, trails and huts from Wikidata and OSM within the polygon (import script).
3. **Lanes**: an MCP client (or a server agent) fills facts, offers and booking windows per lane, as
   changesets with sources.
4. **Media**: Wikimedia Commons candidates by coordinates and category; licence recorded per image.
5. **Review**: the owner accepts; coverage moves from thin to usable to good.

Scripts do what is mechanical and licence-clean (geometry, ids, coordinates); models do what needs
reading (seasons, booking rules, limits, "is this worth it with kids").

### 4.3 Refresh

Staleness per field family (`freshness_rule`): prices 120 days, hours 180, closures 7 in season,
booking windows yearly (before the window opens), geometry 3 years. A nightly job ranks stale fields
used by upcoming trips first and writes them to the backlog. Before each trip, a conditions check
(closures, fires, roads, forecast) runs as a small job and posts a verdict to the trip.

### 4.4 Trust

`proposed` changes become live only when accepted. Accepted values are `stated` with one official or
operator source, `verified` after review plus a second independent official source or the owner's
own visit. Agent-inferred values never rise above `unverified` and are shown with that badge.
Low-risk additions (a new viewpoint with an official source, a photo with a free licence) can be
auto-accepted for trusted researchers.

### 4.5 Licences and terms (product-level risk, decide early)

| Source | Rule |
|---|---|
| OpenStreetMap | **ODbL, share-alike.** A database derived from OSM and made public must be offered under ODbL. Keep OSM-derived geometry and ids in their own fields with `source = osm`, attribute "© OpenStreetMap contributors", and treat our catalog as a collective database where OSM is one clearly separated layer. Take legal advice before selling data |
| Wikidata | CC0, free to use |
| Wikimedia Commons | per-image licence and attribution, stored per media row and shown |
| Google Maps and Places | **must not be stored** (terms); links out only, never imported by research |
| AllTrails and similar | terms forbid scraping; link only; facts from official sources instead |
| Operator and park sites | facts are not copyrightable, wording is: store our own paraphrase, a short quote at most, and the link |

## 5. Server-run research (later)

A queue of research jobs run by Claude Agent SDK workers in a container, each with a token budget and
a hard stop, writing only changesets. Owner-only at first (B4). For other users, research runs in
their own chat client against our MCP, which costs us nothing.
