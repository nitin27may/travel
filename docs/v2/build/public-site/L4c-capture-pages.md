# L4c: page seeds for capture-only places (backlog 3.48)

Lane L4c, after S1b. It reuses the L4b mechanism ([L4b-trail-tracks.md](L4b-trail-tracks.md)): a capture record becomes a `PublicPlace` in `web/lib/public/places.ts`, and the S1 modules build its sections, "Who it suits" and relevance from the record. Code: `web/lib/public/seeds.ts`.

## The rule: which capture record gets a page

A record gets a page when all of these hold:

1. Its layer is `place`, `route` or `offer` (an `event` is not a place), and its trip is public (served, not private in the manifest; fails closed).
2. Its type is **visitable**: the nearest node of `data/vocab/types.json` with `marks` has `draw` of `R` or `R?` (a draw is expected: something to see or do). Food, stays and access types carry `draw` N and get no page. The `settlement` domain keeps `draw` R but is a base, not a sight (`BASE_DOMAINS` in `seeds.ts`, the only hard-coded exception). A new type is therefore one data entry; nothing in code lists type ids.
3. It is not a trail route (`nature.trail.*`): `trail-places.ts` builds those (L4b).
4. An offer whose `at` or `on` resolves to a place that has a page is shown under that place ("At this place you can also"; a lift's ticket under the lift) and gets no page. A standalone offer (a horse ride, a heli flight, a spa) is itself the place.
5. A record whose name an older page already carries is that page. A payoff part (`part/...#payoff`) that carries the name of a trail is the trail's own.
6. It has an area (country, state, district): Rockies from `sights.json`/`adventures.json` `park`; other trips from `SEED_AREAS` (written out, no geocoding), the trail areas, or the area of the page of the part's parent. A record with none is skipped and reported, never placed by guess.

Visitable types in use today: lake, pond or reservoir, river, sea or fjord, waterfall, canyon, gorge, valley, mountain, summit, viewpoint, glacier view, nature reserve, provincial park, wildlife viewing spot and tour, landmark, historic site, dam, museum, show cave, scenic drive, mountain pass, gondola, cable car, rack railway, hot spring, thermal bath, spa, beach, alpine coaster, Nordic centre, bike path and trail, glacier walk, guided summit, horse ride, float, boat cruise and taxi, heli tour, via ferrata.

## Slugs, points, names

- Existing slugs never move (`web/tests/data/place-slugs-frozen.json` pins all 209). Seeds fill free names in order: plain name (records that are places before parts), then `name-district`, then `name-district-type`, then a number. Moraine Lake is `moraine-lake`, the Banff Gondola `banff-gondola`.
- A name loses a trailing bracketed note ("Banff Gondola (Sulphur Mountain summit)" is "Banff Gondola"); the full record name still finds the page for trip stops.
- A point is the record's own OpenStreetMap node, way or relation, or its Wikidata P625, from `data/relevance/inputs/points.json`. A derived trailhead, a prototype approximation or a locations.json copy is not used. No point: the page is listed, has no globe pin, and says "no map point yet".
- A seeded page whose name equals a trail's (Kinney Lake, Peyto Lake Lookout) stays out of the name lookup, as the trail does, so day items do not jump to the wrong page; it is reached by its capture ref, list, search and globe.

## Numbers (19 Oct 2026)

Pages 209 before, 353 after (+144). New pages by trip: Rockies 89, Iceland 19, Chamonix 10, Utah 9, Patagonia 6, Dolomites 5, Vermont 3, Algonquin 3. 82 of the 144 have a map point.

Skipped capture records (reported by `buildPlaces().seedSkips`): infrastructure types 41, base towns 27, name already a page 23, offers shown under their place 22, trail payoffs 15, events 1 (not a place).

## Gotchas

- `data/suitability/scope.json` is generated from the adapter (`pnpm --dir web exec vitest run -c ../tools/suitability-scope/vitest.config.mts`); its item list is unchanged, only `places` grows. Regenerate after adding seeds.
- Sight and adventure records of the Rockies that describe one thing (Radium Hot Springs, Red Rock Parkway, Lake Louise sightseeing and gondola) are separate capture records and so separate pages until CS7 merges them.
