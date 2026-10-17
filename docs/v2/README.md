# Travel platform v2: clean-slate design (17 Oct 2026)

Status: **PROPOSAL, not approved.** Written as if starting from zero, then mapped back onto what exists.
It replaces `docs/BLUEPRINT.md` where they disagree; the blueprint's principles mostly survive, but
several of its mechanisms were too heavy or too fragile (section "What changed from BLUEPRINT.md").

| File | What it decides |
|---|---|
| [01-domain-model.md](01-domain-model.md) | Catalog vs plans, evidence, changesets, trip items, tasks, bookings, reminders |
| [schema.sql](schema.sql) | First-cut Postgres + PostGIS DDL for everything in 01 |
| [02-experience.md](02-experience.md) | Screens, flows, desktop vs phone, Today mode, tasks, reminders, admin |
| [03-mcp-and-research.md](03-mcp-and-research.md) | MCP tool surface, OAuth, research pipeline, trust, licences |
| [04-stack.md](04-stack.md) | Every technology choice with the alternative and why; Neo4j; Neon vs Supabase; cost |
| [05-roadmap.md](05-roadmap.md) | Milestones with exit criteria, and how today's repo migrates |
| [06-questions.md](06-questions.md) | Decisions and questions for the owner |
| [08-self-hosted.md](08-self-hosted.md) | **Current deployment decision:** self-hosted Supabase on the home server, risks, containers, backups, MCP over a tunnel |
| [09-reservations.md](09-reservations.md) | Flights, stays, cars, tickets: recorded (never sold), to-book tasks, routing from stays and flights, wallet, privacy |
| [10-sharing.md](10-sharing.md) | Sharing everywhere: objects, audiences, guest links with includes and preview, privacy rules, exports |
| [07-competitors.md](07-competitors.md) | Wanderlog and TripIt: what to take (plan document, email import), where to beat them |

Inputs read: `docs/BLUEPRINT.md`, `docs/PLAN-platform.md`, the owner's brief of 17 Oct 2026, and the
owner's own intent notes in `research/vault-notes/` (Travel Finder overview, UX, data model, agent
readiness, roadmap; `Travel Preferences.md`; `Plan.md`; the vault trip-planner's intake, discovery and
budget references). [schema.sql](schema.sql) loads cleanly on Postgres 16 + PostGIS 3 (40 tables; spatial,
full-text and trigram queries checked on sample rows).

## The product in one paragraph

A trip planner where a person describes **who is going and what they like**, then builds the trip by
**picking from a researched catalog or adding anything by hand**, shapes it into days, and is then
**walked through booking, preparing and travelling** by deadlines, tasks and a phone-first Today view
that works offline. It serves a Saturday day trip from home as well as a two-week holiday: the
household's location is the lens (drive time from you), and its standing preferences (who, ages,
pace, interests, what to avoid) pre-fill every new trip. The catalog grows through **research that any MCP chat client can do**, always as
reviewable changesets with sources, never as silent overwrites. Every action in the app is also an
API operation and an MCP tool, so a chat client and a person editing by hand are equal citizens.

## Seven design rules

1. **Catalog and plans are separate.** The catalog says what is true about the world; a trip only
   points at catalog entries and adds choices (day, time, who, notes). Improving the catalog improves
   every trip that uses it.
2. **Current value in columns, evidence beside it.** A catalog entity stores its current values as
   normal typed fields, so reads and forms are simple. Each field can carry evidence (source, read
   date, author). Research arrives as a **changeset** (a proposed diff with evidence) that a reviewer
   accepts, partly accepts or rejects.
3. **One operation layer.** Every write is a named, typed operation. Web, HTTP API, MCP, CLI and
   background jobs call the same operations; nothing writes to the database around them. Every
   operation logs an event and returns an inverse, so undo and the activity feed are free.
4. **Manual first.** Anything a chat client can do, a person can do in the UI. AI is a faster
   keyboard, not a requirement.
5. **A trip is a timeline, not a spreadsheet.** Items can be unscheduled ideas, sit on a day, have a
   time, span several days, or nest (a 4-day trek with its daily stages). Days come from the trip's
   dates; templates have day numbers and no dates.
6. **The app changes with the trip's phase.** Plan, Book, Prepare, Go, After. The home screen of a
   trip leads with the one next action for its phase.
7. **Portable and cheap.** Plain Postgres, open-source libraries, no feature that only one vendor
   provides. Target running cost at launch: $0/month plus a domain.

## What changed from BLUEPRINT.md, and why

| Blueprint said | v2 says | Why |
|---|---|---|
| Every fact is a claim; values are derived from claims | Values live in typed columns; evidence rows attach to fields; research proposes changesets | A pure claim store (entity, attribute, value) makes every read a pivot, every form a custom widget and every query slow to write. Wikidata can afford that; a two-person product cannot. Changesets keep the safety (no silent overwrite, full history, conflicts visible) at a fraction of the complexity |
| Separate tables for poi, trail, activity, stay, eatery, offer, area_guide | One `entity` table with a `kind` and kind-specific `attrs` validated by schema; `offer` stays separate | Nine near-identical tables mean nine editors, nine search paths and nine sets of MCP tools. One table with a schema registry gives one editor, one search, one review queue |
| `edition` (real dates for one run of a trip) | Dropped. Templates have day numbers; forking a template creates your own trip with your dates | Editions solved "same trip, different year" for one owner; for users, fork is simpler and already needed for templates |
| `day` rows with `item` rows | Items carry an optional day number, optional times, optional span and optional parent; days are derived | Real trips have multi-day treks, overnight ferries, an ideas tray, and items whose day is not chosen yet |
| MCP generated one tool per operation | About 20 grouped tools plus an `apply` tool for batches; resources for schema and taxonomy | Chat clients choose tools worse as the tool count grows past ~20-30; grouped tools with good descriptions work better than 43 thin ones |
| Supabase Cloud for data, auth, storage, queues | **Self-hosted Supabase** on the owner's Ubuntu box (decided 17 Oct 2026, 08-self-hosted.md); Neon + Better Auth was the earlier answer and stays documented in 04-stack.md | Free, always on, everything in one stack for family use; Supabase Cloud or a VPS remain a dump-and-restore away |
| Vercel for the app | Next.js in a container beside the database, reached through a Cloudflare Tunnel | server rendering next to the data; no ports opened at home; Vercel stays an option later |
| ICS calendar feed as the most reliable reminder | ICS is the backstop; Web Push and email are primary for time-critical openings | Google Calendar refreshes subscribed feeds only every several hours, so a feed cannot deliver "opens in 15 minutes" reliably |

## Detailed pages (tracker)

The numbered files above are the design decisions. The folders below break the product into small
pages that can be tracked, reviewed and built one at a time. Status: **draft** = written, not yet
reviewed by the owner; **reviewed**; **building**; **done**.

| Folder | What is in it |
|---|---|
| [features/](features/README.md) | One page per feature area: purpose, user stories, behaviour, data, operations and MCP tools, edge cases, acceptance criteria, milestone |
| [ux/](ux/README.md) | Navigation and layout rules, one page per screen (desktop and phone), the component inventory, tokens, patterns and states |
| [research/](research/README.md) | How research works from Claude Code and from any chat client: trip-type profiles, one contract per lane (trails with every link, trailhead and parking; adventure; stays; ...), sources and licences, skills and prompts |
| [mcp/](mcp/README.md) | The MCP server in detail: auth and scopes, every tool with inputs and outputs, resources, prompts, example client sessions |
| [migration/](migration/README.md) | What exists in this repo today and how each piece becomes catalog entries, trips or templates |
