# F05. Catalog entity pages

## Purpose

Every thing you can visit has one page that answers "should we, can we, and how": the facts with
their sources and dates, who in the party can do it, when it is open, how to get there and park,
what to book and when, and every useful link. Trails get the most structure because they are the
heart of most trips in this repo (Rockies, Dolomites, Patagonia, Chamonix, Norway, Utah).

## User stories

1. As a hiker, I want the trailhead pin, the parking lot, whether it fills by 08:00, and the shuttle alternative, so that I know when to leave.
2. As a parent, I want to see at once that the Laguna de los Tres hike is 21 km with ~750 m gain and not for a 9-year-old, with the source and date of those numbers.
3. As a planner, I want all links in one place (official park page, the OSM route, a GPX source, AllTrails as a link), so that I stop keeping 12 tabs open.
4. As an adventure planner, I want the via ferrata's age 12+ and 40-120 kg harness limits shown per traveller, so that we decide before booking.
5. As anyone, I want "suggest a correction", so that wrong facts get fixed.

## Detailed behaviour

### Common layout (every kind)

1. Opens as a sheet over the current view (map panel on desktop, bottom sheet on phone); a full page at `/p/<slug>` for sharing and search engines (JSON-LD `TouristAttraction`, `Place`, `GeoCoordinates`).
2. Header: name, kind and subkind, area breadcrumb (Canada > Alberta > Banff National Park), trust badge (unverified, stated, verified), freshness ("facts read Mar 2026"), hero photo with attribution.
3. Tabs: **About** (our summary, highlights, best time, why go), **Facts** (each field with value, source, read date, and conflicts), **Getting there** (point, address, parking, transit, drive time from the lens), **Book** (offers with booking windows), **Photos** (Commons and approved uploads, each with licence and author), **Nearby** (relations: near, alternative_to, combo_with, rainy-day alternatives).
4. Fit row per traveller of the open trip (F04), with reasons.
5. Actions: + Add (to a list or a day), Open in Google Maps / Apple Maps, Share, Suggest a correction (opens a short form that creates a changeset with optional source URL), and for admins Edit.
6. **Conflicts are shown honestly**: "Parks Canada: 21 km (read Mar 2026) · trip report 2025: 23 km" with the chosen value bold.

### Trail page

7. **Key numbers** (big, top): distance (km), elevation gain and loss (m), estimated time (range), route type (loop, out-and-back, point-to-point, lollipop), difficulty on the house 1-5 scale plus the **local grade** (Parks Canada easy/moderate/difficult, SAC T1-T6 in the Alps, Norway's green/blue/red/black, YDS where relevant), max elevation.
8. **Map with track and elevation profile**: the line from `entity.shape` (source: OSM relation, an official GPX, or a hand-traced track, recorded in evidence); the profile computed from a DEM (Mapterhorn or AWS Terrain Tiles); hovering the profile moves a dot on the map; steep sections shaded.
9. **Trailhead**: a linked `place` entity (subkind `trailhead`) with its own point, name, and access road; "start here" navigation link. Several trailheads allowed (main, alternative, shuttle drop).
10. **Parking**: one or more linked `parking_lot` entities, each with: point, name, capacity (approx. spaces), fee and how to pay (machine, app, park pass covers it), **fills by** (typical time on summer weekends, with source), overnight allowed, toilets, EV charging, max vehicle length (camper vans), winter access, and the **alternative when full** (shuttle, overflow lot, bike). Moraine Lake: no private vehicles, Parks Canada shuttle or Roam transit only; Lake Louise lot full by sunrise in summer.
11. **Getting there without a car**: shuttle or bus with season, frequency, booking window (links to the offer).
12. **Permits and bookings**: day-use permits (Algonquin day permit sold online 5 days ahead), quotas (Lake O'Hara lottery), timed entry; each an `offer` with its booking window and the "book by" for the open trip.
13. **Season and conditions**: open months, typical snow-free window, closures (seasonal, wildlife: Parks Canada group-of-4 bear restrictions on some Lake Louise trails in summer), link to the official conditions page, last checked date.
14. **Hazards**: exposure, scrambling, river crossings, avalanche terrain, cliffs (unfenced edges, from the household avoid rules), wildlife, altitude; each with a severity and whether it disqualifies a traveller type.
15. **Who it suits**: minimum age suggested, kid-friendly score, stroller (none, jogger only, yes), wheelchair, dogs (allowed, leashed, banned), fitness 1-5; fit row for the party.
16. **Facilities**: toilets at the trailhead or on route, water, huts or refuges (with their own entity pages and booking windows), cell coverage.
17. **Links** (all of them, labelled by type): official page (park or operator), conditions page, OpenStreetMap relation, GPX download source, Wikidata, Wikipedia, **link-only** to AllTrails, Komoot, Gaia, Outdooractive, Strava segments (we link, we never copy their data), a trip report or video (community). Each link has a type, a label, and a last-checked date; broken links are flagged by the nightly link checker (`check_links.py` successor).
18. **Variants**: shorter or longer options from the same trailhead (Track A/B/C in the Rockies plan: "to the teahouse only, 7 km" vs "Plain of Six Glaciers, 14 km") as related trail entities (`part_of`, `alternative_to`), each with its own numbers.
19. **Best light**: when the main viewpoint is front-lit (from the sun module plus the viewpoint's bearing), sunrise and sunset times on the trip's dates. Algonquin's Echo Rock is back-lit until about 13:30, so afternoon.
20. **Exports**: GPX download (when licence allows), "add to trip", open the trailhead in Maps.

### Activity / adventure page

21. Operator (name, link, contact), what it is, duration, season and slot times, **limits**: minimum age, minimum and maximum height, weight range, fitness, swimming ability, pregnancy, health declarations, accompanying adult rules; each limit checked per traveller with the reason (Via Ferrata Loen: 12+, 40-120 kg, harness limits, not negotiable).
22. Price per person and per group, what is included (gear, transport), meeting point (entity), cancellation policy, booking window and sell-out speed, weather dependency and the operator's rule (cancelled in wind over N km/h), waiver needed.
23. Links: operator booking page, reviews (link only), safety info.

### Stay page

24. Type (hotel, lodge, hut, campsite, rental), address and point, check-in and check-out times, rooms or site types, family rooms, breakfast, parking (with fee and height limits for vans), EV, accessibility, distance to the main sights, cancellation norms, booking window (huts that open bookings on a fixed date: Refuge du Lac Blanc, Norwegian DNT), campsite open and close dates (Iceland), links (official site; booking platforms link only).

### Eatery page

25. Cuisine, price band, hours by day, reservation needed (and how far ahead), kid-friendly, dietary options (vegetarian, gluten-free), links. Coverage is deliberately shallow: we do not copy Google Places data (07-competitors.md 5); users add their own via a pasted link.

### Place page (viewpoint, waterfall, lake, town, museum...)

26. Key facts by subkind (viewpoint: bearing and best light; waterfall: best flow months; museum: hours, kids' sections; town: services), access, parking, fees, links.

### Area page

27. See F04 area guides.

## Sharing

See [10-sharing.md](../10-sharing.md). Every entity page has a public URL (`/p/<slug>`) and a Share action: link, Web Share API sheet on phones, and an **image card** (photo, name, key numbers such as "21 km · 750 m gain · Parks Canada", map snippet) for chat apps. "Open in Google Maps / Apple Maps" shares the point. Sharing an entity from inside a trip can include the trip's context for members only ("on Day 3, Track A"), never for public links.

## Data touched

`entity` (kinds trail, activity, stay, eatery, place, hub), `offer`, `relation`, `media`, `evidence`, `source`, `area`, `leg_cache`, `changeset`/`change` (corrections).

### Schema additions

- Trail `attrs` (validated by the trail Zod schema): `distance_km`, `gain_m`, `loss_m`, `max_elev_m`, `time_min_h`, `time_max_h`, `route_type`, `difficulty`, `local_grade {system, value}`, `trailhead_ids[]`, `parking_ids[]`, `hazards[] {type, severity, note}`, `dogs`, `stroller`, `wheelchair`, `facilities {toilets, water, huts[]}`, `cell_coverage`, `links[] {type, url, label, checked_on}`, `track_source`, `conditions_url`.
- New subkind `parking_lot` (kind `place`) with `attrs`: `capacity`, `fee {amount, currency, basis, pass_covers[]}`, `fills_by {time, days, season, source}`, `overnight`, `toilets`, `ev`, `max_vehicle_m`, `winter_access`, `when_full`.
- New subkind `trailhead` (kind `place`).
- `entity_link` as a table instead of `attrs.links` (for the link checker and per-link evidence): `(id, entity_id, type, url, label, checked_on, status, http_code)`. Recommended over JSON.
- Activity `attrs.limits {min_age, max_age, min_height_cm, max_height_cm, min_weight_kg, max_weight_kg, fitness, swim, notes}` used by eligibility.

## Operations and MCP tools

Queries: `catalog.get` (with tabs data), `catalog.track` (geometry + elevation profile), `catalog.links`. Writes: `changeset.correction` (any signed-in user), admin `entity.update` through an auto-accepted changeset.

MCP: `get` returns the full entity with links, parking, limits and evidence summary; `propose` (research scope) adds or corrects any of these fields with evidence (see research/ and mcp/ pages).

## Edge cases

- Trail with no geometry yet: show trailhead and the numbers; the profile area says "track not available; GPX source: none yet".
- Conflicting distances from two official sources: show both, keep trust at `stated`, add to backlog.
- Parking data unknown: show "parking: unknown" with a "research this" (owner) rather than hiding the section.
- Link to a site that blocks bots: link checker marks "could not verify" without flagging it broken.
- Elevation profile across a DEM gap (glacier, sea): interpolate and mark.

## Acceptance criteria

1. A trail page shows distance, gain, time, route type, house and local difficulty, trailhead, at least one parking entry or "unknown", season, hazards, suits, facilities and links, each fact with source and date on the Facts tab.
2. The elevation profile and the track stay in sync on hover; the profile's total gain is within 15% of the stated gain or a discrepancy note appears.
3. An activity with min age 12 shows amber for a traveller who is 11 on the trip date and green for one who turns 12 the day before.
4. Suggest a correction creates a changeset visible in the admin review queue with the user's note and source.
5. All AllTrails, Komoot and similar links are links only; no data from them is stored in facts or evidence.

## Milestone

M1 (pages for Banff and Lake Louise entities, trail layout, parking, links), M2 (fit rows for trips), M6 (link checker, best light).

## Open questions

1. Elevation profiles computed on the server once per track, or in the browser? Default: server once, stored as a compact array.
2. Show community trip reports and videos as links? Default: yes, as `community` links with a clear label.
3. Do we offer GPX download of OSM-derived tracks (ODbL attribution required)? Default: yes with attribution in the file.
