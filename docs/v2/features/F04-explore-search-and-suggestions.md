# F04. Explore, search and suggestions

## Purpose

Find what fits **this party, these dates, this place** in seconds, and say why each result fits.
Explore is both a standalone page (signed out works) and the picker inside a trip. The location is
the lens: distances are from home, the trip's base, or the user's live position.

## User stories

1. As a parent, I want "waterfall near Ajax for kids under 2 hours" to turn into visible, editable filters, so that I can see and adjust what I asked.
2. As a planner inside the Rockies trip, I want only things open in September and within our 12 km walking limit, so that I don't wade through the impossible.
3. As anyone, I want every card to tell me why it is suggested and who in the party it suits, so that I trust it.
4. As a user who gets zero results, I want one tap to loosen the filter that is blocking, so that I never hit a dead end.
5. As a returning user, I want saved views ("Family with young kids", "Rainy-day rescue"), so that one tap reshapes the list.

## Detailed behaviour

### Layout

1. Desktop: filter bar on top, results (cards or table) on the left, map on the right, synced both ways (hover lifts the pin; panning shows "Search this area"). Phone: full-screen map with a bottom sheet of cards; filters in a full-height sheet; a Map/List toggle.
2. The URL holds all state (lens, query, filters, sort, view, map bounds), so any view is shareable and reloads identically. Inside a trip the URL also carries the trip id.

### The lens

3. Signed out: browser geolocation if allowed, else a default region with a banner "showing GTA, set your location".
4. Signed in without a trip: household home base.
5. Inside a trip: the night's base for the selected day, or the trip's area centre; a lens switcher shows "from: Hotel Ambra (night 2)".
6. Distances: straight-line first (instant, from PostGIS), then real drive time for the top 30 results from `leg_cache` or the routing service, filled in progressively.

### Filters (chips with counts)

7. Groups: Distance (drive minutes or km from the lens), What (feature tags: waterfall, lookout, cave, lake, beach, splash pad, museum, market...), Kind (trail, activity, stay, eatery, place), Vibe (relaxing, adventure, scenic, romantic, super fun), Who (age of each traveller, accessible, stroller, dogs), How (difficulty 1-5 with the local grade, distance, gain, duration, indoor), When (open on my dates, good this season, good right now, sunrise or sunset spot), Cost (free to splurge), Trust (verified only).
8. Each option shows a count; options with zero are shown greyed with the reason, not hidden.
9. Trip-aware defaults: inside a trip, "open on my dates" and "fits the party" are on by default and removable.

### Search box

10. One box for places, trips, templates, tags and areas, grouped by kind as you type, fuzzy (pg_trgm, unaccent), `/` or ⌘K to focus.
11. Rule-based parsing turns phrases into chips: "near <place>" → lens, "under 2 hours" → drive filter, "for kids", "for a 10-year-old" → age filter, "easy", "dog friendly", tag words. The query becomes chips the user can see and remove. No LLM in v1.

### Cards and table

12. Card: photo, name, kind and subkind, drive time from the lens, 2-3 tags, cost band, a **fit row** (one avatar per traveller: green fits, amber with reason "needs 12+", grey "not for Nonna: 900 m gain"), trust badge, a **reason line** ("Matches waterfall + family · open in September · 40 min from your base · 6 km, within your limit"), and **+ Add** (to Ideas or a chosen list or Day N).
13. Table view: sortable columns (name, kind, distance, drive time, length, gain, difficulty, cost, season, trust), multi-select to add several at once.
14. "Covered by your pass" and "booking opens 15 Apr" badges where relevant.

### Suggestions

15. Ranking score = relevance to filters + type-profile boosts (F02) + persona or saved-view boosts + proximity − penalties (out of season, eligibility misses, already in the trip). Each term contributes words to the reason line, so the ranking is explainable.
16. "Suggested for this list" carousels under trip lists (F06) use the list's contents: a list with three viewpoints suggests other viewpoints nearby; each with its reason.
17. "Pairs well with" on a card: nearby entities often combined (from `relation` `combo_with` and co-occurrence in templates).
18. **Zero-result rescue**: when nothing matches, show the closest near misses and which chip excludes them ("nothing within 1 h with all of: cave, swim, under 5 km; drop 'cave' (6) or widen to 1 h 30 (4)"), with one-tap loosen.

### Saved views and personas

19. System saved views (persona quick-starts): Family with young kids, Hard hikes, Rainy-day rescue, Accessible day out, Foodie weekend, Sunrise and sunset. Users save their own from the current filters.

### Area guides

20. `/explore/<area>`: highlights per kind, seasons (what's open by month), coverage badge per kind (thin, usable, good), top picks per persona, "research this" when thin (owner only).

## Data touched

`entity`, `offer`, `area`, `relation`, `media`, `leg_cache`, `saved_view`, `coverage`, `trip`/`traveller`/`trip_item` (for trip-aware filters and "already in trip").

### Schema additions

- `entity.popularity numeric` (from template co-occurrence and adds; never shown as a number) for tie-breaking.
- Materialised view `entity_search` combining entity, primary media, open months and eligibility bounds for fast filtered queries (refreshed on accept).

## Operations and MCP tools

Queries: `catalog.search` (text, kinds, tags, lens point, max drive or distance, along route, dates, party, trust, sort, page), `catalog.facets` (counts), `catalog.get`, `area.guide`. Writes: `saved_view.save`, `saved_view.delete`, `trip_item.add` from a card.

MCP: `search` (all of the above parameters; returns ranked results with the reason line and fit per traveller), `get`, `area_guide`. Anonymous use allowed with low rate limits; trip-aware search needs `trips:read`.

## Edge cases

- Lens inside a lake or at sea (ferry): snap to the nearest road point for drive times.
- No routing quota left: straight-line distance with "drive time unavailable" rather than wrong numbers.
- Entities without coordinates (imported text-only): excluded from map and distance filters, listed with "location missing".
- A traveller without an age: fit shows grey "unknown" instead of green.
- Very large result sets on the map: clustered pins; list paginated or virtualised.

## Acceptance criteria

1. Filtering Banff trails for "under 8 km, kids 9+, September" returns only matching trails, each with a correct reason line and fit row.
2. Removing a chip restores counts within 300 ms on a warm cache (local server).
3. The zero-result state always offers at least one loosen action that yields results when any exist within 2× the radius.
4. Copying the URL into a private window reproduces the same results and map view.
5. Results never include entities with `status` draft or retired.

## Milestone

M1 (Explore page, filters, cards, map, area guides), M2 (trip-aware filters and "+ Add"), M7 (semantic "places like this" with pgvector).

## Open questions

1. Show a numeric rating at all? Default: no public star ratings in v1; trust badge and reasons instead.
2. Should signed-out users get drive times (routing quota)? Default: straight-line only when signed out.
