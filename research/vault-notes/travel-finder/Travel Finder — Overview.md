---
type: idea
area: resources
status: draft
tags:
  - fun-project
  - travel-finder
  - web-app
  - brainstorm
created: 2026-06-17
modified: 2026-06-17
---

# Travel Finder — Overview

> Brainstorm for a standalone, public travel-discovery web app built on top of the trip data I'm already generating in this vault. This note is the index; the detail lives in the linked notes below.

## The idea in one line

A regional day-trip and weekend finder where a visitor **sets their own location** (address or map pin) and every trip and place **re-sorts and recalculates by real drive-time from them** — turning my Whitby-anchored research into something anyone in the region can use.

## Why it's worth doing

I'm not a dedicated travel blogger and I don't want to be. The value here isn't a blog — it's the **structured, research-backed data** that already falls out of the [[trip-planner]] workflow every time we plan a trip: places with addresses, costs, timing, categories, kid-friendliness, booking gotchas, and shareable maps. That data **compounds** with every trip. A good map + search + agent-readable API on top of it is genuinely useful and barely exists well for this region.

The honest risk isn't the concept, it's treating it like a content blog that needs constant feeding. The framing that keeps it sane: **data + map + search first**, photos and write-ups as a light layer on top.

## What it is (and isn't)

- **Is:** a discovery tool — "what's near me, sorted by how far I'd actually drive, filtered to what my kind of traveller wants."
- **Is:** a place to combine multiple stops into a route I can share.
- **Isn't (yet):** a social network, a booking engine, or a paid AI product.

## Seed data already in the vault

- 5 detailed day trips with structured `*-mymaps.csv` files → [[Day Trip Options 2026]]
- The 40-destination cheat sheet → [[Day Trips Local]]
- Cycling day trips → [[Day Trips Bike]]
- Bucket-list destinations → [[Location]]
- The home-base concept to generalize per-user → [[Travel Preferences]]

Roughly 150–200 distinct places across ~60–70 trips. Addresses are clean; coordinates need a one-time geocoding pass.

## Decisions locked (this brainstorm session)

- **v1 scope:** public regional resource — polished and SEO-ready, no logins yet.
- **UI:** hybrid, user-switchable **map ↔ cards**, with frictionless instant search and faceted filters. UX is a priority.
- **Design language:** Claude-inspired — Anthropic's warm palette (ivory `#faf9f5`, near-black `#141413`, coral `#d97757`), Poppins headings + Lora body. Full spec in [[Travel Finder — UX & UI]].
- **Distance:** **real drive-time from day one** (engineered to avoid runaway API cost).
- **Stack:** Next.js (App Router) + Supabase (Postgres + PostGIS + Auth + Storage) on Vercel.
- **Standalone product** — not tied to the technical blog; its own brand/domain (TBD).
- **AI-agent-readable by design** — structured data + a clean public API + an optional MCP server, with no LLM cost on our side.
- **Data for all traveller types** (faceted tags + personas) and a **multi-point route / place-graph builder**.

## The notes

- [[Travel Finder — Architecture & Stack]] — how it's built and hosted, and the drive-time engineering.
- [[Travel Finder — Data Model]] — schema, faceted tags/personas, the place graph, and vault ingestion.
- [[Travel Finder — UX & UI]] — the hybrid interface, search/filters, and the route builder.
- [[Travel Finder — AI & Agent Readiness]] — making the site usable by AI agents for free.
- [[Travel Finder — Roadmap & Risks]] — phased build, what "done" looks like, and the gotchas.

## Open questions

- Brand and domain for the product.
- Region focus first (Durham / GTA) or open national from the start?
- How much of the "blog/story" layer (photos, write-ups) do I actually want vs. pure tool?
