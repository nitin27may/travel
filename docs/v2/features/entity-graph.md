# Entity graph: how every record is told apart and linked, once, for every country and every kind of plan

Status: **spec only, planned** (26 Oct 2026, travel-planner, Opus). No app code, no new HTML. Owner request of 26 Oct 2026
("decide the schema for linking everything together"). TODO row of 26 Oct 2026; BACKLOG 15.295 to 15.299; questions QG1 to
QG5 (section 14).

**This page is the general model. [protected-area-entry.md](protected-area-entry.md) is one instance of it** (a park is a
container place with requirement offers) and was rewritten the same day to point here.

Supersedes, as of 26 Oct 2026:
- capture contract ([capture-contract.md](../../../research/method/capture-contract.md)) 2.5 (relations table) and 2.4 rule 1
  (embedded offer `variants`): the relation vocabulary, directions, target kinds and derived inverses are section 5 here; a
  variant is its own record with `variant_of` (section 4.5). The contract text is aligned by EG-DOC (section 13).
- protected-area-entry.md 2.1 (relation table), 2.3 (membership) and the relation half of its contract diff (C4, C6, the
  relation part of C7): they move into this page's contract task EG-C. Its `park` facet (PA-Q) becomes the general
  `within` facet (section 9). Its refs `place/lake-louise-area`, `place/lake-ohara` and `place/tunnel-mountain-village-1`
  do not resolve under today's ref rules and are replaced (section 4.4).
- protected-area-entry.md 5.1's line "No Neon migration in P1": the new relation kinds need the migration `relation_kinds`
  (EG-M, section 11.3).

It builds on, and does not replace: the type tree (`data/vocab/types.json`), the property registry
(`core/src/schema/capture/properties.ts`), the placement block and tiers (contract 3.7), AREA-2's areas, the slug registry
(`data/catalogue/slugs.json`), the `CatalogueStore` contract (`core/src/catalogue/store.ts`), and the catalogue tables of
`core/src/db/migrations/0003_catalogue.sql` (`entity`, `offer`, `relation`).

## 0. The decision in one paragraph

Everything we hold is one of **four record layers** (place, route, offer, event) plus the **operator** record; an **area**
is not a record but the geography index of the locations store. Kinds are told apart by one question each (section 4.2): a
place is where you go, a route is what you travel along, an offer is what someone runs, sells, rents or permits, an event is
when something happens. A park, a zone, a cluster and a ski area are ordinary places that other records name as their
container; a trail's short and long versions are separate route records joined by `variant_of`; a lake is one place
whatever you do there (activities are offers `at` it, routes that `pass` or `reach` it). **Links are stored once, on the
record with the smaller fan-out, in one direction, and every reverse is derived** (members, ways to get there, offers here,
variants, what covers this fee). One rule table (`RELATION_RULES`) names each relation's source and target kinds,
cardinality and inverse, and both the validator and the index read it. Facts are never copied down: a trail "needs a day
pass" because its containment chain reaches a park whose requirement offer applies to its visit mode, computed by one
function in core (section 7). The graph is indexed by one generated, committed set of per-country files under
`data/catalogue/graph/`, read only through the store (P8, P9), and the same code later fills a `containment` table in
Postgres. **Trade-off:** a one-off contract task (EG-C, Opus, about 6 h), a migration, and about 10 data fixes now, against
park-, trip- or country-specific link fields that each new plan type would add again.

## 1. Owner request, traced

| # | Owner, 26 Oct 2026 | Section |
|---|---|---|
| E1 | Keep JSON records; decide the schema for linking everything together | 0, 5, 8 |
| E2 | A park links to lakes, trails, hikes, canoe routes, campgrounds, viewpoints, activities and offers; each is its own record with its own properties | 4, 6 |
| E3 | How kinds differ: place, route, offer, event, area, zone; trail, hike, route variant; lake as place or as activity venue | 4.1 to 4.6 |
| E4 | How they link: containment, membership, near, access (starts at, ends at, reached via), requires, operated by, serves, variant of, part of a trip; no duplicated facts | 5, 7 |
| E5 | Reusable for every country and every plan type (day trip, weekend, multi-day, camping), decided once | 4.7, 7.4, 10 |
| E6 | Research first: inventory, gaps and contradictions, comparable open models with sources | 2, 3 |
| E7 | Inheritance: what a member inherits from its park and may override | 7 |
| E8 | Query contract, read model, `/api/v1` shape, pagination and filters | 9 |
| E9 | Data-fill path, migration, smallest contract diff, Opus versus data tasks | 10, 11, 13 |
| E10 | Rewrite protected-area-entry.md as an instance, keep QP1 to QP6 | 12 |
| E11 | Tasks with hours, model, dependency and bundle, under the contract-first rule | 13 |

## 2. What exists today (measured 26 Oct 2026 on `main` 4d4eae90)

### 2.1 Records and refs

504 capture records in `data/capture/**` (`capture/1`): place 310, route 143, offer 50, event 1. Operators are their own
file (`data/capture/operators.json`, `capture-operators/1`).

| Ref form | Records | Resolves when (`core/src/suitability/refs.ts` `RefResolver.why`) |
|---|---|---|
| `legacy/<folder>/<dataset>/<id>` | 150 | the row exists in `legacy/<folder>/data/<dataset>.json`, dataset trails, sights or adventures |
| `part/<parent ref>#<slug>` | 138 | the parent resolves; the slug is not empty |
| `place/<slug>` | 108 | the slug is a place page in `data/suitability/scope.json` (a locations-store place, a legacy row or a capture record with a pinned slug) |
| `trip/<trip>/<item>` | 91 | the item is in scope.json |
| `offer/<parent ref>#<product>` | 17 | the parent resolves |

Layer by ref form: routes are `legacy/` (79), `trip/` (33), `place/` (17) and `part/` (14); places are `part/` (123),
`place/` (89), `trip/` (55) and `legacy/` (43). **The ref form records where an id was born, not what the record is.**

Pages: 39 `part/` refs, 88 `trip/` refs and 191 `place/` refs hold a pinned page slug; no `offer/` ref has one.

### 2.2 Relations in the data

| Relation | Records using it | Source layer | Target layer seen |
|---|---|---|---|
| `area_id` (field) | 425 | place 292, route 133 | an area of the locations store |
| `reaches` | 49 | route | place 51 |
| `passes` | 4 | route | place 7 |
| `part_of` | 8 | place 7, event 1 | place 8 |
| `starts_at` | 16 | route 14, offer 2 | place 15, **route 1** |
| `ends_at` | 0 | | |
| `on` | 10 | offer | route 8, **place 2** |
| `at` | 40 | offer | place 41 |
| `run_by` | 33 | offer | operator |
| `parks_for` | 62 | place | place 56, route 2, **offer 7** |
| `serves` | 5 | place | place 5 |
| `variant_of` | 2 | offer | offer 2 |
| `combo_with`, `alternative_to` | 0 | | |
| `aliases` | 2 | route | |

The 22 `nature.protected.*` places have no members: no record says `part_of` a park. Most Rockies records already carry a
park-named area (`CA/AB/banff-national-park` and others, AREA-2).

### 2.3 Derived inverses and storage today

- `loadWorld` (`core/src/capture/records.ts`) builds `incoming` per process: `at`, `on`, `parks_for`, `serves`, `children`
  (inverse of `part_of`), `reached_by`, `starts_here`. Not derived: `passes`, `ends_at`, `variant_of`, the symmetric pairs,
  and any transitive closure (a member of a member).
- Only `reached_by` is refused when typed (`E_CAP_REL_DERIVED`).
- The validator (`core/src/validate/capture.ts`) checks that a relation's **source** layer is allowed (`E_CAP_REL_KIND`) and
  that its target resolves (`E_CAP_REL_REF`). It never checks the **target's** kind, cardinality or cycles.
- Postgres (`0003_catalogue.sql`): `relation(from_id, to_id, kind)` with a CHECK list of 12 kinds; `run_by` is a column of
  `offer` only; `entity` has no `run_by`; `relation.to_id` references `entity(id)`, so a link to an operator cannot be a
  relation row.
- Trips: `items.place_id`, `trail_id`, `activity_id`, `offer_id` point at the catalog family's ids; `data/trips/stop-refs.json`
  bridges stop names to capture refs until TD-1 adds `items.ref` (v0.14).

### 2.4 Gaps and contradictions found

| # | Finding | Effect | Resolved in |
|---|---|---|---|
| G1 | `place/<slug>` resolves only when a place page exists; `place/banff-national-park`, `place/kananaskis-country`, `place/lake-louise-area`, `place/lake-ohara`, `place/tunnel-mountain-village-1`, `place/algonquin-provincial-park` do not (checked against scope.json) | the protected-area spec's new records would fail `E_CAP_REF`; the trip-less lane (`E_CAP_LANE`) also needs a pinned `place/` root | 4.4 |
| G2 | `RefResolver.why` splits an `offer/` or `part/` ref at the **first** `#`; the lane's `rootRef` unwraps at the **last** | a nested ref (`offer/part/X#a#b`) fails resolution although the lane rule accepts it | 4.4 rule 3 |
| G3 | The `part/` prefix is read by people as "part of"; 123 places have a `part/` ref, 7 have `part_of` | containment guessed from an id would be wrong (a shuttle stop `part/...moraine-lake#shuttle-stop` `serves` the lake; it is not inside it) | 4.4 rule 2 |
| G4 | No target-kind rule: 10 records link to the wrong kind (7 `parks_for` an offer, 2 `on` a place, 1 `starts_at` a route) | "Trailhead and parking" and "Ways to do this route" read the wrong records | 5.1, 11.2 |
| G5 | `variant_of` is offer-only; route variants (Larch Valley to the meadows or to Sentinel Pass) have no shape | one record holds two itineraries with different distance, climb and payoff | 4.5 |
| G6 | Contract 2.4 describes embedded offer `variants`; `capRecord` has no such key and the data uses separate offers with `variant_of` | two rules for one thing | 4.5 |
| G7 | `combo_with` and `alternative_to` have no storage rule (which side, both?) | duplicate or one-sided links | 5.2 |
| G8 | Stage order of a route made of routes (Alta Via stages) is undefined; `ends_at` is unused | a trek's stages cannot be listed in order | 4.6 |
| G9 | Postgres `relation.kind` CHECK hard-codes 12 kinds; the capture enum has 13 (with `run_by`); no test pins the two | `covered_by` (protected areas) and any new kind fail the load at the next sync | 11.3 |
| G10 | Inverses are rebuilt per process, partially, with no closure; 2.9 s first call at 10,000 places (BACKLOG 15.28) | "everything in this park, including inside its zones" has no fast answer | 8 |
| G11 | The protected-area spec adds a `park` facet; other containers (a zone, Niagara's cluster, a ski area) would need their own | one facet per container type | 9.2 |
| G12 | Trip items use catalog-family ids, the catalogue uses capture refs | "what a trip touches" needs the stop-refs bridge until TD-1 | 9.1 |

## 3. Comparable open data models, and what we keep

| Model | How it links | What we keep | What we refuse |
|---|---|---|---|
| OpenStreetMap: route relations | `type=route` with `route=hiking`, `canoe` and so on; ordered members; `route_master` groups the variants and directions of one route; super-relations hold stages; alternatives and excursions "should go in a separate relation" ([Relation:route](https://wiki.openstreetmap.org/wiki/Relation:route)) | a variant is its own route record grouped by `variant_of` (like `route_master`); a stage is a route `part_of` the whole (like a super-route); order comes from the chain of stages | per-way membership and roles: we hold itineraries, not the way network |
| OpenStreetMap: site relations | `type=site` groups discontiguous objects of one named feature; "relations are not categories"; limited consumer support; not for areas with clear boundaries, where spatial queries infer what is inside ([Relation:site](https://wiki.openstreetmap.org/wiki/Relation:site)) | membership stated on the member, never a parent list; a park is not a category of its members | geometry containment: we hold no park polygons (ODbL share-alike, P9, T5 honest maps; protected-area-entry 2.2) |
| Wikidata | `part of` (P361) is transitive and asymmetric, inverse `has part` (P527), and is advised against for geographic location ([P361](https://www.wikidata.org/wiki/Property:P361)); `located in protected area` (P3018) is a subproperty of `located in the administrative territorial entity` (P131) ([P3018](https://www.wikidata.org/wiki/Property:P3018)) | one direction stored, the inverse derived; transitive containment; the protected area as a location of its members. We keep one `part_of` field and tell "located inside" (target is a place) from "is a leg of" (target is a route) by the target's layer | a second containment field: our two meanings never meet on one pair, and both carry the same inheritance |
| schema.org | `containedInPlace` is "the basic containment relation between a place and one that contains it", inverse `containsPlace` ([containedInPlace](https://schema.org/containedInPlace)) | store the child-to-parent direction only; the inverse is defined, never typed | |
| GeoJSON (RFC 7946) | no link between features; "foreign members" carry no GeoJSON semantics ([RFC 7946 6.1](https://www.rfc-editor.org/rfc/rfc7946#section-6.1)) | GeoJSON stays a per-item export format (P8); the graph lives in our JSON, never inside a FeatureCollection | a bulk FeatureCollection of the catalogue |
| Overture Maps divisions | each division stores `parent_division_id`; `hierarchies` lists the chains, the first is the default ([division](https://docs.overturemaps.org/schema/reference/divisions/division/)) | a record may have up to two containers, the first is the default for breadcrumbs | |
| US National Park Service API | park resources are keyed by a park code (`/parks?parkCode=acad`, [NPS guides](https://www.nps.gov/subjects/developer/guides.htm)); third-party summaries describe things to do, campgrounds and alerts filtered by `parkCode` ([2s.io](https://2s.io/park/lookup), secondary, not verified against the official reference) | the child names its park; campgrounds, visitor centres and things to do are separate resources, as our members are separate records | park-specific link fields: a park is one instance of the general container rule |

Not used: RIDB (Recreation.gov) and Parks Canada link models were searched and no primary documentation of their link
fields was reachable on 26 Oct 2026; nothing here depends on them.

## 4. Vocabulary: kinds, identity, and how to tell them apart

### 4.1 The kinds

| Kind | Is | Stored as | Identity (ref) | Has its own | Example |
|---|---|---|---|---|---|
| **Area** | a bucket of the geography index for browsing and breadcrumbs: country, region, area | the locations store (`countries`, `regions`, `areas`), never a capture record | `CC/REGION/slug` | a name, a region, a slug; no facts | `CA/AB/banff-national-park` |
| **Place** | a point or patch you go to | capture record, layer `place` | `place/`, `part/`, `legacy/`, `trip/` (4.4) | point, area, hours, season, facilities, suitability, relevance | Moraine Lake, the Rockpile viewpoint, a campground |
| **Container place** | a place other records name with `part_of`; any place type may be one | a place record; nothing extra | as a place | as a place, plus `covers_areas` when it is a protected area (protected-area-entry 4.1) | Banff National Park, the Lake Louise area zone, Niagara Falls cluster, a ski area |
| **Zone** | a separately managed or gated part of a protected area | a place of type `nature.protected.zone` (new leaf, protected-area-entry C8), `part_of` the park | `part/<park ref>#<slug>` | its own requirements and links | Lake O'Hara in Yoho |
| **Route** | a line you travel from a start to an end | capture record, layer `route` | as a place | geometry or `searched_none`, distance, climb, time, effort, start, end | Larch Valley to Sentinel Pass, a canoe route, the Icefields Parkway, a gondola line |
| **Route variant** | another itinerary of the same route family: same start or most of the way, different length, climb or payoff | a route with `variant_of` the primary route | `part/<primary ref>#<slug>` | its own distance, climb, time, effort, payoff, geometry | Larch Valley to the meadows |
| **Stage** | a leg of a longer route that is also done on its own | a route with `part_of` the whole route | `part/<whole ref>#<slug>` | its own facts; order from `starts_at`/`ends_at` | Alta Via 1 stage 3 |
| **Offer** | something someone runs, sells, rents or permits; class experience, rental, ticket, access or lodging | capture record, layer `offer` | `offer/<anchor ref>#<product>`; a system pass `offer/operator/<slug>#<product>` | operator, price, window, limits, season, hours | canoe rental at Moraine Lake, a guided hike, a campsite booking |
| **Requirement** | an access offer a visitor must hold to enter or use something (fee, pass, permit, timed entry, shuttle seat) | an offer of class access (`access.pass.*`) with the `entry` block | as an offer | `entry`, window, price, validity, cancel | Banff daily admission, the Discovery Pass, a backcountry permit |
| **Event** | a dated or seasonal occurrence | capture record, layer `event` | `part/<anchor ref>#<slug>` | dates or season, where | the elk rut, larch season, a festival |
| **Operator** | who runs offers and manages places | `data/capture/operators.json` | `operator/<slug>` | name, URL, terms, waiver | Parks Canada, Pursuit |
| **Trip** | a plan that uses records on days and nights | `data/trips/` and the catalog family; **not a node of the graph** | `trip/<slug>` (trips list) | days, bases, items | Canadian Rockies 2029 |

### 4.2 Telling them apart: one question each, in this order

| # | Question | If yes |
|---|---|---|
| 1 | Is it only a name for browsing and breadcrumbs, with no facts a visitor would decide on? | area (locations store); never a capture record |
| 2 | Is it something someone runs, sells, rents, books or issues, with a price, an operator or a window? | offer; if it lets you in or onto something, a requirement (`access.pass.*`) |
| 3 | Does it happen on dates or in a season and then stop (a rut, a festival, larch colour)? | event |
| 4 | Do you travel along it from a start to an end, and do distance, climb or time decide whether you do it? | route |
| 5 | Is it the same family as a route we hold, from the same start or along most of the same way, but with a different length, climb or payoff? | route variant (`variant_of`) |
| 6 | Is it a leg of a longer route that people also do on its own? | stage (`part_of` the route) |
| 7 | Otherwise | place; if other records sit inside it, it is also a container |

Tests the order settles:
- **Trail versus hike.** "Trail" and "hike" are one record: the route. `nature.trail.hike` is its type (the effort family), not a
  second record. Hiking it yourself is never an offer (contract 2.7 T1); a **guided** hike is an offer `on` the route. A signed
  trail segment ("Larch Valley trail" on a sign) is not a record unless people do it as an itinerary of its own (contract 2.7 T4).
- **Lake as place versus activity venue.** A lake is one place. What you do there hangs off it: rentals and cruises are
  offers `at` it, the shore walk is a route that `passes` or `reaches` it, a canoe route `passes` it, a beach on it is a place
  `part_of` it, swimming facts are on the lake (or on the beach). Paddling your own canoe on it is not stored. There is never a
  second "lake activity" record.
- **Area versus park versus zone.** The area `CA/AB/banff-national-park` is a browsing bucket with no facts. The park
  `place/banff-national-park` is a record with an authority, links and requirements; `covers_areas` says the area is the
  park, so every record in that area is a member with no edit. A zone is a record inside the park with its own rules.
- **Place versus offer at a ticketed place.** The museum is a place; its ticket is an offer (contract 2.1 rule 3).
- **Route versus offer on a lift.** The gondola line is a route; the ticket is an offer `on` it (contract 2.1 rule 4).

### 4.3 Containers

Any place may be a container. In practice containers are protected areas and zones (`nature.protected.*`), clusters
(`settlement.cluster`), ski areas (`snow.ski.ski_area`), amusement and theme parks (`play.amusement.*`), gardens
(`nature.garden.*`), old towns (`culture.heritage.old_town`), and a summit area or canyon that holds named parts (the
Sulphur Mountain summit holds the top station; Johnston Canyon holds the falls). **A settlement is not a container by
default:** a record's town is its `near_town` (derived, META-2) and its area; listing every museum as `part_of` a town would
duplicate both. A settlement becomes a container only for a part that exists only inside it (a district, a cluster).

### 4.4 Identity: the ref grammar

| # | Rule |
|---|---|
| 1 | A ref is an **opaque, stable id** (contract 3.7.5): it never changes; a rename is an alias. |
| 2 | **The ref form carries no meaning.** `part/X#y` does not mean "y is part of X", and `offer/X#p` does not mean "p is sold at X". Containment is only `part_of`, place of sale only `at` or `on`. No reader may parse a ref to find a relation. |
| 3 | **One wrapper only.** `part/<root>#<slug>` and `offer/<root>#<product>`, where `<root>` is a `place/`, `legacy/`, `trip/` or (for offers) `operator/` ref. A child of a child anchors at the same root (`part/place/banff-national-park#tunnel-mountain-village-1`, its offer `offer/place/banff-national-park#tunnel-mountain-village-1-campsite`). `E_CAP_REF` refuses a nested wrapper with that message. The slug is unique within its root. |
| 4 | **A top-level record is born in the locations store.** A park, a stand-alone lake, a town or any record with no natural root gets a locations-store place through the `location` skill (it is a place Nitin would remember), then a pinned page slug (`slugs.ts build`), then its capture record `place/<slug>`. Everything inside or offered at it hangs off that root by rule 3. (QG1) |
| 5 | `place/<slug>` is historical wording for "page": 17 routes already use it. It stays; it does not make the record a place. |
| 6 | A **system pass** has no place: `offer/operator/<slug>#<product>` (protected-area-entry QP1; the resolver change is C10 there). |
| 7 | A page slug comes only from the slug registry (`data/catalogue/slugs.json`); offers and events have no page of their own (they render on their anchor's page) unless the slug registry pins one. |

### 4.5 Variants

| Rule | Detail |
|---|---|
| Separate records | Each variant is a record with its own ref (rule 3), so a trip can name the one it uses, a track can be fetched for it and its own suitability holds. Embedded `variants` arrays (contract 2.4) are retired: the schema never had them, the data never used them. |
| One primary | `variant_of` points at the primary; the primary has none. One level only: a variant of a variant is `E_CAP_VARIANT`. Same layer and same category as the primary. |
| What a variant inherits | starts_at, part_of, area_id, access_season, the route's official rules (group minimum), `conditions` and `official` links, hazards, and therefore every requirement (7.2). It states its own distance, climb, time, effort, payoff (`reaches`), end, geometry, child time. |
| Display | the primary's page lists "Ways to do it" with each variant's distance, climb, time and effort; a list card shows the primary with "2 ways" (contract 2.7.3 dedup rule). Whether a variant also gets its own page is QG2. |
| Offers | unchanged: two products of one operator that differ in limits, time or price are offers joined by `variant_of` (the Kicking Horse Wild Water and Hydra records already do this). |

### 4.6 Stages

A stage is a route `part_of` the whole route. Order is derived, never typed: stage n's `ends_at` equals stage n+1's
`starts_at` (a hut, a campsite, a portage landing). When the stages of one route do not form one chain, the validator warns
`W_CAP_STAGE_ORDER` and the page lists them by name. A stage inherits the whole route's requirements (a trek permit `on` the
whole route) by the chain (7.2).

### 4.7 Worked examples

Refs that exist today are marked "exists"; values are illustrative where they are not ours yet (research fills them).

| Example | Kind and type | Ref | Links stored on it | Derived for it |
|---|---|---|---|---|
| Banff National Park | container place, `nature.protected.national_park` | `place/banff-national-park` (new: locations store first, rule 4) | `covers_areas: [CA/AB/banff-national-park]`, `run_by: operator/parks-canada` | members (every record in that area, plus explicit `part_of`), its requirements, member counts by kind |
| Lake Louise area | zone, `nature.protected.zone` | `part/place/banff-national-park#lake-louise-area` (new) | `part_of: [place/banff-national-park]` | members; the park's requirements apply inside it |
| Lake Louise (the lake) | place, `water.body.lake` | `place/lake-louise` (exists) | `part_of: [part/place/banff-national-park#lake-louise-area]` (new edit) | offers at it (canoe rental, horse ride, exist); parking offer reached by its access point; requirements: zone's and park's |
| Moraine Lake | place, `water.body.lake` | `legacy/canadian-rockies-sept-2029/sights/moraine-lake` (exists) | `part_of: [part/place/banff-national-park#lake-louise-area]` (new edit) | shuttle seat (its own requirement, `at` it, exists), canoe rental, routes that start at its stop, Rockpile viewpoint as a member |
| Larch Valley to Sentinel Pass (primary) | route, `nature.trail.hike` | `legacy/canadian-rockies-sept-2029/trails/larch-valley-sentinel-pass` (exists) | `starts_at` Moraine Lake's shuttle stop, `passes` the Larch Valley meadows, `reaches` Sentinel Pass (exist) | variants; requirements: the shuttle seat (through the stop it starts at, which `serves` the lake) and Banff's entry fee (through the area chain); the group-of-four rule is its own `official_rule` |
| Larch Valley to the meadows (variant) | route variant, `nature.trail.hike` | `part/legacy/canadian-rockies-sept-2029/trails/larch-valley-sentinel-pass#larch-valley-meadows` (new) | `variant_of` the primary, `reaches` `part/...#larch-valley` (exists) | everything the primary inherits (4.5), its own distance and climb |
| Canoe route in an Ontario provincial park | route, `water.paddle.canoe.canoe_trip` | `part/place/algonquin-provincial-park#canoe-lake-to-tom-thomson-lake` (illustrative; Algonquin needs its locations-store place first, PA-R-ON) | `starts_at` the access point (`access.transit.boat_launch`), `passes` lakes (each a `water.body.lake` place), `ends_at` an interior site when one-way; portages in `ext.paddle.portages` | requirements: the park's daily vehicle permit (`needed_for: day`), the backcountry permit (`needed_for: overnight_back`) by visit mode; canoe rental offers `at` the access point's outfitter |
| A campground | place, `stay.camp.campground` | `part/place/banff-national-park#tunnel-mountain-village-1` (new) | `area_id` in the park's area (membership with no edit), `run_by` when a concessionaire runs it | the campsite lodging offer `offer/place/banff-national-park#tunnel-mountain-village-1-campsite` (`at` the campground); the park fee with the `camper` exemption where one applies |
| A day-use permit | requirement, `access.pass.day_use_permit` or `access.pass.vehicle_permit` | `offer/place/algonquin-provincial-park#daily-vehicle-permit` (illustrative) | `at: [the park]`, `entry`, `window`, `price`, `covered_by` the provincial annual pass | applies to every member whose visit mode it names (7.2) |
| A guided activity | offer, class experience, `mountain.alpine.guided_summit` | `legacy/canadian-rockies-sept-2029/adventures/burgess-walcott` (exists) | `run_by` the operator; `starts_at` its meeting place (today a `parks_for` from the meeting place, fixed in EG-D) | requirements of the meeting place's chain (Yoho's fee); `includes` when the operator states the fee is included |
| A viewpoint | place, `nature.viewpoint.viewpoint` | `part/legacy/canadian-rockies-sept-2029/sights/moraine-lake#rockpile` (exists) | `area_id` (park area) or `part_of` the zone | reached by the Rockpile loop (derived from the route's `reaches`); the park's requirements |

## 5. Relations

### 5.1 The relation table (the content of `RELATION_RULES`)

"Stored on" is the only side that may hold the link; the reverse is derived and refused if typed (`E_CAP_REL_DERIVED`,
widened to every inverse name). Cardinality is per source record. "Chain" says whether the link is followed when the
requirements and inherited facts of a record are computed (section 7).

| Relation | Meaning | Source kinds | Target kinds | Card. | Stored on | Derived inverse | Chain | Status |
|---|---|---|---|---|---|---|---|---|
| `part_of` | located inside a container (target a place), or a stage of a route (target a route) | place, route, event | place (any type); route only from a route | 0..2 (more warns `W_CAP_REL_PARENTS`); the first is the default for breadcrumbs | the member | `members` (direct), `members_all` (closure) | yes | exists; target rule new |
| `covers_areas` (field) | the areas that are this protected area | place `nature.protected.*` | locations-store area ids | 0..n | the park | members by area | yes (as `part_of`) | new (from protected-area-entry C4) |
| `reaches` | the payoff of a route | route | place | 1..n, ordered, first primary | the route | `reached_by` | yes | exists |
| `passes` (with `at_km`) | on the way | route | place | 0..n | the route | `passed_by` | no | exists |
| `starts_at` | where a route starts or an offer meets | route, offer | place | 0..1 per route (more warns), 0..n per offer | the route or offer | `starts_here` | yes | exists; target rule new |
| `ends_at` | where a one-way route or stage ends | route | place | 0..1 | the route | `ends_here` | yes | exists, unused |
| `at` | where an offer is sold or happens | offer | place | 1..n, first primary | the offer | `offers_at` | yes | exists |
| `on` (with `from_km`, `to_km`) | the route an offer runs on | offer | route | 0..n | the offer | `offers_on` | yes | exists; target rule new |
| `parks_for`, `serves` | an access point for a place or route | place `access.*` | place, route | 1..n | the access place | `access_points` | yes (the target's chain, 7.2) | exists; target rule new |
| `run_by` | who runs or manages it | offer; place `nature.protected.*`, `stay.*`, `access.*` | operator | 0..1 | the record | `operator_of` | no (display only) | exists; places new (protected-area-entry C7) |
| `covered_by` | a pass or booking that satisfies this requirement | offer `access.pass.*` | offer `access.pass.park_pass` or `vehicle_permit`, or a lodging offer | 0..n | the requirement (few passes per fee) | `covers` | no | new (protected-area-entry C4, C6) |
| `includes` | a product that includes a requirement (a tour with park admission) | offer, class experience, ticket or lodging | offer `access.pass.*` | 0..n | the product (few fees per tour) | `included_in` | no | **new** |
| `variant_of` | another version of the same route or product | route, offer | same layer and category | 0..1, one level | the variant | `variants` | yes (fallback facts, 4.5) | exists; routes new |
| `alternative_to` | one or the other: a requirement that can replace another (the private bus or the shuttle), a Plan B route | offer, route, place | same layer | 0..n | either side, **once** (`E_CAP_REL_SYM` if both) | symmetric | no | exists, unused |
| `combo_with` | goes well done together | any | any | 0..n | either side, once | symmetric | no | exists, unused |
| `pairs_with` (relevance) | hand-picked "nearby, worth adding", with a reason | place, route | any | 0..n | the subject (relevance record) | not shown | no | exists |
| aliases | old refs of this record | any | | 0..n | the record | primary of | | exists |
| near | within a distance | | | | **never stored**: computed from points by the store's `near()` | | no | exists |
| trip use | a trip uses this record on a day or night | trip item, base | any record | | **the trip only**; never on the catalogue record (privacy, P8) | `used_by_trips`, public trips only | no | exists through the stop-refs bridge; TD-1 |

**Store-side rule ("many side").** A link between many records and few is stored on the many side: a member names its park,
a fee names the pass that covers it, a tour names the fee it includes, an offer names its place. No record ever lists 80
members, 80 fees or 30 tours. This is the rule for any future relation.

**"Membership" in the owner's sense** needs no new relation: a park in a park system is `run_by` the system's operator and
its fee `covered_by` the system pass; a designation (World Heritage, dark-sky preserve) is a relevance
`signals.designations` row; a trail in a long-distance network is a stage (`part_of` the network route); a place in a trip
is the trip's own data.

### 5.2 Validator rules

The rules read `RELATION_RULES` (new file `core/src/schema/capture/relations.ts`, the one source of truth); codes go in
`core/src/validate/codes.ts`.

| Code | When | Severity |
|---|---|---|
| `E_CAP_REL_KIND` (exists) | the source layer or type is not allowed for the relation | error |
| `E_CAP_REL_TARGET` (new) | the target's layer or type is not allowed (an offer `parks_for`, an offer `on` a place, a route `starts_at` a route) | by the gap budget: pinned records warn, new records error (contract 3.7.3) |
| `E_CAP_REL_CYCLE` (new) | `part_of` or `variant_of` loops, counting `covers_areas` membership | error |
| `E_CAP_REL_SYM` (new) | a symmetric relation is stored on both records | error |
| `E_CAP_VARIANT` (new) | `variant_of` names another layer or category, or a record that is itself a variant | error |
| `E_CAP_REL_DERIVED` (widened) | any derived inverse name (`members`, `reached_by`, `passed_by`, `offers_at`, `offers_on`, `access_points`, `starts_here`, `ends_here`, `variants`, `covers`, `included_in`, `requirements`) is typed | error |
| `E_CAP_REF` (message widened) | a nested `part/` or `offer/` wrapper (4.4 rule 3) | error |
| `W_CAP_REL_PARENTS` (new) | more than two `part_of` parents | warning |
| `W_CAP_STAGE_ORDER` (new) | stages of one route do not chain by `ends_at` to `starts_at` | warning |
| `W_CAP_INHERITED_COPY` (new) | a record stores a fact it already inherits: a `conditions`, `status` or `booking` link with the same URL as an ancestor's, or a requirement offer of the same type and booking page as one up its chain | warning (it is how "no duplicated facts" is checked) |
| `W_ENTRY_OVERRIDE` (new, PA-C) | a member's own sourced `access_cost: no_limit` removes requirements it would inherit (7.1) | warning, listed for review |

## 6. Containment and the chain

### 6.1 Order of the rules

1. An explicit `part_of` wins.
2. Else `covers_areas`: a record whose `area_id` is a covered area is a member of that protected area.
3. Never geometry (protected-area-entry QP2).
4. A record with an explicit `part_of` to another container is not also an area member of a different park (the 10 km rule
   placed it wrongly, or it sits on a shared edge).

### 6.2 The chain of a record

`chain(x)` is the ordered list of records whose rules apply to x, nearest first, computed once per build (section 8):

| x is | chain(x) |
|---|---|
| a place | x, then its containers up `part_of` (or area membership), transitively |
| an access place (`access.*`) | x, its containers, then for each `serves` or `parks_for` target: chain(target) |
| a route | x, its `part_of` containers (stages: the whole route), then chain(`starts_at`), chain(`reaches`), chain(`ends_at`), then for a variant the primary's chain |
| an offer | x, then chain of each `at` and `on` target, then chain(`starts_at`) |
| an event | x, then chain of its `part_of` target |

Duplicates are dropped keeping the first. The **nearest protected area** of x is the first `nature.protected.*` record in
chain(x); a member page names it ("In Banff National Park").

## 7. Inheritance: what a member gets from its containers

### 7.1 The rules

Four modes, one per fact. No fact is copied into a member's file; the reader computes it (`W_CAP_INHERITED_COPY` catches
copies).

| Mode | Meaning |
|---|---|
| **union** | the member shows its own and every one up its chain |
| **bound** | the container limits the member; the member's own value is cut to the container's (shown as "Park closed November to April") |
| **fallback** | the member's own value wins; when it has none, the nearest one up the chain is shown, labelled with its source record |
| **never** | each record states its own, or the gap shows |

| Fact | Mode | A member may override by | Example |
|---|---|---|---|
| Entry requirements (access offers `at` or `on` any record in the chain) | union, filtered by visit mode (`entry.needed_for`), season and `entry.for_types` (7.3) | a sourced `access_cost: no_limit` on itself (shown with its source; `W_ENTRY_OVERRIDE` lists every such record for review), or an `entry.exemptions` row on the requirement (`through_traffic`, `camper`) | Larch Valley: Banff entry fee (area chain) and the Moraine Lake shuttle seat (start chain) |
| Alternatives among requirements | union; an `alternative_to` pair renders as one need with options | none | "Parks Canada shuttle, or the Roam Super Pass" |
| What covers a requirement | derived from `covered_by` and `includes` | none | "Discovery Pass covers it" |
| Operating `season` of a gated container | bound, only when the container's `hours` or season says it closes its gates | the member's own narrower season | an Ontario provincial park's gate season bounds its beach |
| `access_season` | fallback | its own | a trail with no access season shows the zone's road season, labelled |
| Standing closures (`hours.closures` of a container) | union | none | a park-wide fire closure |
| Alerts and status links (`conditions`, `status`) | fallback | its own link | a trail shows the park's alerts page |
| Reservation portal (`booking` link of the container) | fallback, only when the member has a requirement or lodging offer with no booking link | its own | a campground's offer with no link shows the park portal |
| Area-wide hazards (`wildlife`, fire danger on the container) | union | none (safety, P2 exception) | bear country on every Banff member |
| Wildlife rules (`ext.wildlife.*`) | fallback | its own | minimum distance from the park when the member has none |
| `area_id` | derivation only (`derive-area` already reads `part_of`); the member stores its own | its own | |
| Time zone (for hours) | fallback | its own | |
| Managing authority (`run_by` of the protected area) | fallback, display only ("Managed by Parks Canada") | its own `run_by` (a concessionaire) | |
| Official link, summary, facilities, suitability, relevance, photos, effort, distance, price | never | | the visitor-centre toilets are not the lake's |
| Data licence and sources | never: every value carries its own `src` and licence | | |
| Offer limits (age, height) | never from a place to an offer (contract 2.4 rule 3) | | |

Variant inheritance is 4.5; stage inheritance follows the chain (a stage's chain holds the whole route).

### 7.2 "What does this record need": the one function

`requirementsOf(ref, { mode?, month?, types? })` in `core/src/graph/requires.ts`:

1. Take chain(ref).
2. Collect every offer of class access whose `at` or `on` names a record of the chain, and every access offer the record
   itself is (a requirement needs itself).
3. Keep those whose `entry.needed_for` includes `mode` (all modes when absent), whose `season` overlaps `month`, and whose
   `entry.for_types` (when present) matches the record's type or `types`.
4. Drop those an exemption or the record's own sourced `no_limit` removes.
5. Group `alternative_to` pairs into one need with options.
6. Attach `coveredBy` (from `covered_by`) and `includedIn` (from `includes`).
7. Return each with `inheritedFrom` (the chain record it came from) so the page says "Banff National Park: entry fee".

`entryNeeds` and `entryFor` of protected-area-entry 6.1 and 6.2 are thin callers of this function (PA-D).

### 7.3 Activity permits

Some requirements apply only to an activity, not to every visitor: a fishing permit, a climbing or boating registration, a
backcountry permit. They are access offers with **`entry.for_types`** (type id prefixes, for example `water.fishing`,
`mountain.climb`, `water.paddle`) added to the protected-area `entrySpec` (PA-C), and a new leaf `access.pass.activity_permit`
for those that are none of the existing kinds. A fishing permit `at` a park then appears on the park's fishing spots and
fishing offers only.

### 7.4 One graph, every plan type

| Plan | The trip stores | Derived from the graph |
|---|---|---|
| Day trip | day 1 items (a lake, a trail) | visit mode `day` per container; requirements for `day`; members near the items |
| Weekend camping | base nights at a campground (a member) | mode `overnight_front`; the campsite offer's window; the vehicle permit dropped by the `camper` exemption |
| Multi-day road trip | bases and items across several parks | one park line per container entered (protected-area-entry 6.2), passes that cover several |
| Backcountry or trek | a route with stages, nights at sites (members) | mode `overnight_back`; the backcountry permit; stage order |

Nothing in any of these is written on a catalogue record, and nothing on a trip is a copy of a catalogue fact.

## 8. Index: fast answers with no database

### 8.1 What is generated

`node core/bin/graph.ts build` reads the capture, suitability and relevance sidecars, the operators file, the locations
store's areas and the slug registry, and writes **`data/catalogue/graph/`**, each file starting with the line
`"generated": "Generated by node core/bin/graph.ts build. Do not edit."`. `graph.ts build --check` fails when a file is
stale; it joins `tools/check-all.sh` (one appended step) and the gate map.

| File | Shape | Answers |
|---|---|---|
| `index.json` | `{schema: "catalogue-graph/1", generated, inputs: <hash>, counts: {records, edges, containers}, shards: ["CA", "IT", ...]}` | the revision the store caches on |
| `<CC>.json` (one per country of the record's `area_id`) | `nodes: {ref: [layer, type, area, slug]}`; `chain: {ref: [refs]}`; `inv: {ref: {rel: [refs]}}`; `members: {container: {kind: [refs]}}`; `req: {ref: [{ref, from}]}` | members by kind, every inverse, the chain, the requirement refs before the mode and month filter |

Rules:
- **Server-side only.** The files are read through `CatalogueStore` (P9 one data boundary) and never copied to `web/public`
  or any served path (P8 no bulk files). No component imports them.
- **Refs only.** No fact, name, link or suitability value is copied into the index; the store joins refs to its existing list
  rows and lookups, so the P8 row allowlist does not change.
- **Sharded by country.** A park query reads one shard; cross-border links (Waterton and Glacier, joined by `combo_with`)
  hold the foreign ref in `inv`.
- **Size.** At 504 records the index is a few hundred kilobytes; at 10,000 records about 3 to 4 MB in total, about 0.5 MB for
  the largest country, loaded once per process.
- **Committed**, like `data/capture/derived-areas.json`: a data change shows its graph effect in review ("this edit adds 37
  members to Banff"). One writer (the data seat) at a time.
- `near` is not indexed: the store's existing `near()` answers it. A cell index is added only if the 10,000-place check fails.

### 8.2 In Postgres later

The same core code fills two tables at load time (lane S, after CAT-1): `relation` holds the stored links (one row per link;
`run_by` on places moves to a new `entity.run_by` column, EG-M), and a generated `containment(member_id, container_id,
basis, depth)` table holds the closure, so `PostgresStore` answers `within` with one indexed join. No recursive SQL is
written: the closure has one implementation, in TypeScript (CATALOGUE-EARLY's rule that the loader is a pure transform).

## 9. Query contract

### 9.1 The questions the product answers

| Question | Store method (P9) | `/api/v1` | Notes |
|---|---|---|---|
| What is in this park, by kind, with counts? | `countPlaces({facets: {within: [slug]}})` (counts per `k`) | `GET /api/v1/places/counts?within=banff-national-park` | `within` covers the closure: members of zones count for the park |
| Trails in this park in September, easy, with kids from 6, under 3 hours | `listPlaces({facets: {within, k: ["trail"], season: ["9"], effort: ["1", "2"], kid: ["6"], length: [...]}}, page)` | `GET /api/v1/places?within=banff-national-park&k=trail&season=9&effort=1,2&kid=6&page=2` | existing facets and bands; page number in the URL (no infinite scroll, P4); `pageSize` default 48, max 100 (`API_LIMITS`) |
| Where does this sit, and what are its parts, variants, stages, ways in, offers here? | `getPlace(slug).context: PlaceContext` | `GET /api/v1/places/{slug}` | each group capped at 6 at rest with a count and a "Show all" query (P1, P3) |
| What does this trail need, as a day visitor or a camper, in month M? | `getPlace(slug).entry: EntryBlock` (protected-area-entry 6.5), built by `requirementsOf` | `GET /api/v1/places/{slug}?mode=day&month=9` | `EntryRequirement` gains `inheritedFrom: {slug, name} \| null` |
| Everything near here | `near(q, page)`, `nearbyForPlace(slug)` (exist) | `GET /api/v1/near`, `GET /api/v1/places/{slug}/nearby` (exist) | unchanged; `within` may be added to `near`'s facets like any place facet |
| What does this trip touch: containers, days, modes, needs | `getTrip(slug).touches: TripTouches` | `GET /api/v1/trips/{slug}` | public trips stay dateless (day numbers); until TD-1 the adapter joins stops through `stop-refs.json` |
| Which public trips use this record? | `getPlace(slug).context.inTrips` (exists as the "In a public trip" facet) | as today | public trips only; never a private copy |

### 9.2 The `within` facet

`within` joins `PLACE_FACET_KEYS` (`core/src/schema/api/place.ts`). Its values are container slugs; a record matches when
any record of its closure (members of members) has that slug. It replaces protected-area-entry's `park` facet (PA-Q), so a
zone, Niagara's cluster or a ski area need no facet of their own. It is not one of the four primary filters (P4): it is set
by links ("Show all trails in Banff National Park") and shows as a removable chip.

### 9.3 Read model

```ts
// core/src/schema/api/place.ts (EG-Q); every key is public, P8 row-allowlist test unchanged (lookups are per item)
interface RefLink { slug: string; name: string; k: PlaceKind }
interface PlaceContext {
  chain: { slug: string; name: string; kind: "park" | "zone" | "cluster" | "container" | "area" | "region" | "country"; basis: "explicit" | "area" }[]; // root first, for breadcrumbs
  park: { slug: string; name: string } | null;          // nearest protected area
  members: { k: PlaceKind; n: number; top: RefLink[] }[] | null; // containers only; top <= 6, ordered by draw
  variants: { primary: RefLink; ways: (RefLink & { km: number | null; gainM: number | null; effort: string | null })[] } | null;
  stages: { route: RefLink; list: (RefLink & { n: number | null })[] } | null; // n null when the chain is broken
  reachedBy: RefLink[];   // "How to get there"
  startsHere: RefLink[];
  offersHere: RefLink[];  // "At this place you can also" (contract 2.5 rules)
  accessPoints: RefLink[];
  more: Partial<Record<"members" | "reachedBy" | "startsHere" | "offersHere" | "accessPoints", number>>; // counts beyond the caps
}
interface TripTouches {
  containers: TripPark[];  // protected-area-entry 6.5, widened to any container with requirements
  counts: { k: PlaceKind; n: number }[];
}
```

Privacy: no party, household or date in any of these (the existing detectors run on `PlaceContext` and `TripTouches`, PA-W
and EG-W tests). MCP: the public MCP tools reach these through the same store methods (mcp/README 1.1; the aligning agent
adds `within` and `context` to MCP-C's tool-to-route table).

## 10. Data-fill path: incoming research lands in the right record and link

### 10.1 The steps every researcher follows (becomes `research/method/linking.md`, EG-DOC)

| Step | Do | Check |
|---|---|---|
| 1. Find | search our records by name and 500 m (`core/src/normalise/dupes.ts`, the "Is it one of these?" rule) before creating | no duplicate ref (`E_CAP_DUP_REF`) |
| 2. Classify | the seven questions of 4.2, then the type leaf (`capture.ts types --tree`) | `E_CAP_TYPE`, `E_CAP_LAYER` |
| 3. Identify | top-level: the `location` skill, then `slugs.ts build`, then `place/<slug>`; inside or at something: `part/<root>#<slug>` or `offer/<root>#<product>` (4.4) | `E_CAP_REF`, `slugs.ts --check` |
| 4. Place | `area_id` (`derive-area`), point (the points runner) | placement codes |
| 5. Link | the one stored side of each relation of 5.1; a container only when its area does not already cover the record; a variant or stage instead of a second copy | `E_CAP_REL_*`, `E_CAP_VARIANT` |
| 6. Do not copy | never re-state a fee, alert link or hazard the container holds | `W_CAP_INHERITED_COPY` |
| 7. Requirements | each fee, pass, permit, seat or timed entry is an access offer `at` the container that imposes it, with `entry` (protected-area-entry 3, 4.2) | `E_ENTRY_*` |
| 8. Close | `validate.ts --all`, `capture.ts run --check`, `gaps --budget --check`, `graph.ts build`, `graph.ts gaps --trip <id>` | all green; graph files committed with the data |

### 10.2 The graph gap report

`node core/bin/graph.ts gaps [--trip <id>] [--container <ref>] [--json]` lists, per trip or container:

| Gap | Hint |
|---|---|
| a protected area with no requirement offers and no sourced `access_cost` | "Entry not checked yet" (protected-area-entry 4.5) |
| a record whose point lies within 2 km of a protected area's point, outside every covered area and with no `part_of` | "Is it in <park>?" (a question for the researcher, never an automatic link) |
| a route with no `starts_at` | the trailhead or put-in is missing |
| a variant whose primary has no `reaches`, or two routes from one start with the same payoff and no `variant_of` | a possible variant |
| stages that do not chain | `W_CAP_STAGE_ORDER` |
| a container with no members | a zone or cluster created and never filled |
| a trip day whose items reach a container with an unanswered requirement | a book-ahead row will say "not checked" |

It feeds `research/backlog.md` through the research skill, like `capture.ts gaps`.

## 11. Migration and the smallest contract diff

### 11.1 Contract diff (EG-C, one Opus author)

| # | File | Change |
|---|---|---|
| G1 | `core/src/schema/capture/relations.ts` (new) | `RELATION_RULES`: per relation the source and target layers and type prefixes, cardinality, symmetric flag, inverse name, chain flag (5.1); `CHAIN_RULES` (6.2) |
| G2 | `core/src/schema/enums.ts` | `CAP_RELATION` gains `covered_by` (moved from protected-area-entry C6) and `includes`; `CAP_RELATION_DERIVED` gains every inverse name of 5.2 |
| G3 | `core/src/schema/capture/records.ts` | `covered_by`, `includes` (ref arrays), `covers_areas` (moved from protected-area-entry C4); `variant_of` unchanged in shape |
| G4 | `core/src/schema/capture/properties.ts` | `variant_of` layers gain route; `run_by` layers gain place (moved from protected-area-entry C7); new relation properties `covered_by`, `includes`, `covers_areas` |
| G5 | `core/src/validate/capture.ts`, `codes.ts` | the codes of 5.2; `E_CAP_REL_TARGET` emitted through the gap budget's severity; the ref resolver message for nested wrappers |
| G6 | `core/src/capture/records.ts` | `Incoming` built from `RELATION_RULES` for every inverse (today's field names kept as aliases for existing readers) |
| G7 | `data/vocab/types.json` | leaves `nature.protected.zone`, `access.pass.entry_fee`, `access.pass.vehicle_permit` (moved from protected-area-entry C8) and `access.pass.activity_permit` (new); one writer, Opus review (MASTER-ORDER 4.1) |

`entry.for_types` stays in protected-area-entry's `entrySpec` (PA-C). Generated files rebuild from these (`capture.ts build`).

### 11.2 Data changes

| Change | Records | Task |
|---|---|---|
| `parks_for` from a meeting place or launch to an offer becomes the offer's `starts_at` that place | 7 (banff-springs-spa, bow-river-raft, burgess-mt-stephen, heli-flight-canmore x2, norquay-via-ferrata, yamnuska-scramble) | EG-D |
| `on` a river place becomes `at` it | 2 (Kicking Horse Wild Water and Hydra) | EG-D |
| `starts_at` a lift line becomes `starts_at` its top station place | 1 (Lagazuoi tunnels) | EG-D |
| Larch Valley meadows variant | 1 new route, `variant_of` the existing record | EG-D (researcher fills distance, climb, time with sources) |
| Lakes and zones of the Lake Louise area, park records, campgrounds, requirements | new | PA-R-CA (protected-area-entry 11, with refs per 4.4) |
| `E_CAP_REL_TARGET` added to the gap budget's `strict` list once the 10 are fixed | | EG-D |

Every pinned value stays (the migration ledger rule): these are relation edits on records whose values do not change, made
with a `capture-changeset/1` file, so `capture_supersedes` is not needed.

### 11.3 Database (EG-M)

Migration slug `relation_kinds` (number at merge, MASTER-ORDER 4.4): the `relation.kind` CHECK becomes `CAP_RELATION`
minus `run_by`; `entity.run_by text references operator(ref)` (nullable); a test in `core/test/db/` fails when the SQL list
and the enum differ. The loader mapping (lane S, RIS-L's files) writes `covered_by` and `includes` rows and `entity.run_by`.
It must apply before the first production sync that carries the new relations (the PA-R-CA data in bundle C).

### 11.4 Shared-contract tasks (Opus) versus data and build tasks

| Opus, shared contract (one author at a time, MASTER-ORDER 4.3) | Sonnet or data seat |
|---|---|
| EG-C (graph contract), EG-M (migration and drift test), EG-Q (store and API: `within`, `PlaceContext`, `TripTouches`), PA-C and PA-X (protected areas, after EG-C), EG-DOC (contract text) | EG-FX (fixtures), EG-I (index builder and CLI), EG-D (data fixes; the variant by the Opus researcher), EG-W (place-page context block), PA-D, PA-W, PA-2 |

## 12. How this changes protected-area-entry.md

Rewritten the same day (its change log says so):

| Section there | Change |
|---|---|
| 0 | A park is a container place of this graph; its requirements are access offers; membership, inheritance and indexing are the general rules here |
| 2.1 | Relation rows point to 5.1 here; `covered_by`, `covers_areas`, `run_by` on places come from EG-C |
| 2.3 | The hub is the container rule (6) and the inheritance table (7) |
| 2.4 | Refs follow 4.4: `part/place/banff-national-park#lake-louise-area`, `part/place/yoho-national-park#lake-ohara`, campgrounds `part/place/<park>#<name>`, their offers `offer/place/<park>#<name>-campsite`; each park record is born in the locations store first |
| 5.1 | C4, C6 and the relation part of C7 move to EG-C; C8's leaves move to EG-C; `entrySpec` gains `for_types`; PA-C runs after EG-C and is 6 h |
| 6.5 | `park` facet becomes `within` (EG-Q); `EntryRequirement` gains `inheritedFrom` |
| 9.3, 11 | the locations-store step first; refs per 4.4 |
| 12 | PA-C 6 h (after EG-C), PA-D 3.5 h (after EG-I), PA-Q 2 h (after EG-Q); P1 31 h, P2 23.5 h, P3 21 h, all 75.5 h |
| 13 | membership tests move to EG-I's `core/test/graph/` |
| 14 | QP1 to QP6 stand as answered |
| 15 | new conflict rows (refs that do not resolve; the "no Neon migration" line) |

## 13. Tasks

Models per CLAUDE.md: a task that creates a shared contract is Opus even when it is code; reviews never below the writer.
Bundles per MASTER-ORDER 0. **Contract-first (MASTER-ORDER 4.3):** EG-C writes `records.ts`, `properties.ts`, `enums.ts`,
`validate/capture.ts`, `codes.ts` and `types.json`, the same files as RIS-H and PA-C, so the order in bundle C is
**RIS-H, then EG-C, then PA-C, then PA-X**, one author at a time; EG-Q writes `store.ts` and `schema/api/**`, so in bundle E
it takes the slot after REQ-RF-C and before OVR-Ca (and before PA-Q). The aligning agent places these in MASTER-ORDER 3.5,
4.1, 4.3, 4.4 and 5.4, RELEASE-PLAN and DATA-PLAN.

| Id | Task | Seat, model | h | After | Files owned | Acceptance | Bundle |
|---|---|---|---|---|---|---|---|
| G-EG | Owner reads this spec and answers QG1 to QG5 | owner | | | | answers recorded in 14 | before C's contract slot |
| EG-C | Graph contract 11.1 G1 to G7, generated files, focused tests | B2, **Opus** | 6 | G-EG, RIS-H | the files of 11.1, `core/test/capture/relations*.test.ts` | each new code has a failing and a passing case; the 10 records of 11.2 warn (pinned), a new record with the same fault errors; `capture.ts build --check` green | C |
| EG-R0 | Review of EG-C (contract) | travel-design-reviewer or an Opus reviewer | 1 | EG-C | review note | no relation without a target rule; inverse names unique | C |
| EG-M | Migration `relation_kinds`, `entity.run_by`, the enum and SQL drift test, loader mapping of the new keys | data seat (lane S), **Opus** | 2.5 | EG-C, RIS-L | `core/src/db/migrations/<n>_relation_kinds.sql`, `core/test/db/relation-kinds.test.ts`, the loader's mapping file | child rehearsal loads the PA fixtures; drift test fails on a planted extra kind | C |
| EG-FX | Graph fixtures: a park with a zone and area members, a variant pair, a three-stage trek, a canoe route with sites, a campground, a requirement reached through `serves`, a cycle, a symmetric pair, a copied link | B2, Sonnet | 2.5 | EG-C | `core/test/fixtures/graph/**` | every row of 5.1 and 7.1 appears in a fixture | C |
| EG-I | Index builder and CLI: `core/src/graph/**` (chain, closure, inverses, `requirementsOf`), `core/bin/graph.ts build \| --check \| explain <ref> \| gaps`, one check-all step, gate-map row | B2, Sonnet | 6 | EG-FX | `core/src/graph/**`, `core/bin/graph.ts`, `core/test/graph/**`, `data/catalogue/graph/**` (generated), one line in `tools/check-all.sh`, `tools/gate/map.json` row | fixtures give the chains, members and requirements of 4.7 and 7.1; a 10,000-record synthetic build under 5 s and under 4 MB; `--check` fails on a stale file | C |
| EG-D | Data: the 10 relation fixes, the Larch Valley meadows variant (researcher fills it), `strict` list, gap budget lowered, graph rebuilt | data seat, Sonnet 1.5 + **Opus** researcher 1.5 | 3 | EG-C, EG-I | a changeset under `data/capture/`, `data/capture/canadian-rockies-2029/*` (the variant), `data/capture/dolomites-2027/*` (Lagazuoi), `data/capture/gap-budget.json`, `data/catalogue/graph/**` | `validate --all`, `run --check`, `gaps --budget --check`, `graph.ts build --check` green | C |
| EG-DOC | Capture contract 2.4, 2.5, 3.3 and 3.7.2 aligned to this page (supersede notes); `research/method/linking.md` from 10.1; kinds README row; research README pointer | travel-planner, **Opus** | 2 | EG-C | those docs | `relink.py check` passes; no contract line contradicts 5.1 | C |
| **Bundle C** | | | **23** | | | | |
| EG-N | Design note: the context block on place pages (breadcrumb chain, "In <park>" line, Ways to do it, Stages, How to get there, At this place) at 390 and 1440 | travel-design-reviewer, **Opus** | 2 | UXB-7 | `docs/v2/design/place-context/**` | owner approves (gate G-EG-UI) | E |
| EG-Q | Store and API contract: `within` facet, `PlaceContext`, `TripTouches`, OpenAPI, privacy detector keys | B2, **Opus** | 4 | EG-I, REQ-RF-C | `core/src/catalogue/store.ts`, `core/src/catalogue/json/index.ts`, `core/src/schema/api/place.ts`, `core/src/schema/api/trip.ts`, `core/src/query/**`, `core/src/privacy/detect.ts` (keys only), OpenAPI | P8 row-key test unchanged; `within` over the closure; a 10,000-place synthetic list filters by `within` within the list budget | E |
| EG-W | Place-page context block per EG-N | B1, Sonnet | 6 | EG-N, EG-Q | `web/components/places/context/**` (new), `web/lib/public/places.ts` (context join only) | the block renders the 4.7 examples; no new client bulk load (P9); place-size budget held (lazy sections per D-E8) | E |
| EG-R, EG-V | Design review and verify of EG-W | Opus 1.5, Sonnet 1.5 | 3 | EG-W | notes | P1, P2, P3, P5, P6 cited; screenshots 1440 and 390, light and dark | E |
| **Bundle E** | | | **15** | | | | |
| **All** | | | **38** | | | | |

Effect on protected-area-entry: PA-C 7 to 6 h, PA-D 5 to 3.5 h, PA-Q 4 to 2 h (P1 33.5 to 31 h, P2 25.5 to 23.5 h).
Net change: bundle C +20.5 h (23 minus 2.5), bundle E +13 h (15 minus 2).

### 13.1 Brief rules for every EG build task

Goal and owned files as in the table. Must not touch: `legacy/**`, `data/locations/**` by hand (the `location` skill only),
generated files except through their tool, MASTER-ORDER, RELEASE-PLAN, DATA-PLAN, `docs/v2/mcp/**`, any other lane's files.
Steps: read this page's sections named in the task, capture contract 2 and 3.7, protected-area-entry 2 to 6, principles P1
to P9. Verification: `pnpm --dir core exec tsc --noEmit` and `pnpm --dir web exec tsc --noEmit` where touched; the focused
tests of the row (TEST-STRATEGY T1, not the full chain); UI tasks take Playwright screenshots at 1440 and 390 in light and
dark into `web/test-results/shots/` (gitignored). Commit: one commit per task, `core(EG-C): ...`, `data(EG-D): ...`,
`web(EG-W): ...`; `git -C <worktree> add <owned paths>`, never `-A`; end with the project's Co-Authored-By trailer. Delete any
`node_modules` or `.next` a worktree created.

## 14. Owner questions (QG1 to QG5)

| Q | Question | Recommended | Trade-off |
|---|---|---|---|
| QG1 | A top-level record (a park, a stand-alone lake) is born in the locations store through the `location` skill, so it gets `place/<slug>`; everything inside it or sold at it is `part/<root>#<slug>` or `offer/<root>#<product>`, one wrapper deep. No new ref form? | **Yes** | parks and other top-level places appear in the locations store (and WISHLIST.md) as ideas; zones, campgrounds, permits and trail variants never do. The alternative, a new kind-neutral ref form, means a second identity path beside the store and the slug registry |
| QG2 | Route variants (Larch Valley to the meadows, to Sentinel Pass) are separate records joined by `variant_of`; the primary's page shows "Ways to do it" and the list shows one card with "2 ways". Should a variant also get its own page? | **No own page:** a variant renders on its primary's page with an anchor; trips link to the anchor | one fewer page per variant (place-size and sitemap stay small, P1); a search for the short name lands on the primary page, scrolled to the variant |
| QG3 | Requirements reach a record through its start, its payoff and its access point's target (Larch Valley needs the Moraine Lake shuttle because it starts at the stop that serves the lake). This can show a requirement that a visitor arriving another way does not need. Show it, labelled with where it comes from? | **Yes** (P2 safety exception) | an occasional over-cautious row ("from Moraine Lake: shuttle seat or the Roam pass"), against a missed permit that stops a day |
| QG4 | EG-C, EG-M, EG-FX, EG-I, EG-D and EG-DOC ride bundle C ahead of PA-C (C grows by about 20.5 h, to about 234 h); EG-N, EG-Q, EG-W and reviews ride bundle E (+13 h)? | **Yes** | PA-C cannot land without EG-C (same files, one author); the alternative, PA's relation fields first and the graph later, writes the same files twice and leaves `covered_by` without target rules |
| QG5 | Migration `relation_kinds` (the relation CHECK follows the enum, `entity.run_by` added) goes to the Neon child and then production in bundle C, before the first sync of the park data. This replaces protected-area-entry's "no Neon migration in P1". | **Yes** | one more production migration in C, against a production sync that fails on `covered_by` rows |

Decided here without a question (reversible): one containment field (`part_of`) for "inside a container" and "a stage of a
route", told apart by the target's layer; settlements are not containers by default; symmetric relations stored once on
either side; the index committed and checked; `includes` added now with `covered_by`; `access.pass.activity_permit` and
`entry.for_types` for activity permits; `within` replaces `park`.

## 15. Conflicts with existing decisions

| Decision or page | Conflict | Resolution |
|---|---|---|
| protected-area-entry 2.4, 11: refs `place/lake-louise-area`, `place/lake-ohara`, `place/tunnel-mountain-village-1`, `place/kananaskis-country`, `place/banff-national-park` | the first three can never resolve (no page); the last two need a locations-store place first | refs per 4.4; QG1 |
| protected-area-entry 5.1: "No Neon migration in P1" | `relation.kind` CHECK refuses `covered_by` | EG-M (QG5) |
| protected-area-entry 5.1 C4, C6, C7 (relation half), C8 | the same files as EG-C, two authors | moved into EG-C; PA-C after it |
| protected-area-entry 6.5, PA-Q: `park` facet | one facet per container kind | `within` (EG-Q) |
| protected-area-entry PA-D: membership index in `core/src/parks/**` | a second index beside the graph | membership from EG-I; PA-D keeps visits and needs on top |
| capture contract 2.4 rule 1: embedded `variants` on an offer | not in the schema, not in the data | separate records with `variant_of` (4.5); EG-DOC edits the contract |
| capture contract 2.5: `variant_of` offer only; relation targets untyped | route variants; 10 wrong-target links | 5.1; EG-D |
| capture contract 2.5: `part_of` "place → place, route → route" | events use it (1 record), routes sit in parks | 5.1 widens the sources; the target rule is "a place, or a route from a route" |
| capture contract 3.7.2 proposal: events gain `at` | the one event uses `part_of` | kept as `part_of` (no change); `at` on events not added |
| `loadWorld` `incoming` field names (`children`, `starts_here`) | inverse names in 5.1 differ (`members`) | old names kept as aliases in G6 until their readers move |
| MASTER-ORDER 4.3 one-author order | new contract tasks EG-C (bundle C) and EG-Q (bundle E) | slots proposed in 13; the aligning agent edits MASTER-ORDER |
| `ref` prefixes read as meaning (`part/` as "part of") in research notes | 4.4 rule 2 | EG-DOC states it in the contract and `research/method/linking.md` |

## Gotchas

- `covers_areas` membership follows `area_id`, which AREA-2 derives by a 10 km rule: a record near a park edge can land in
  the park. Check the "Is it in <park>?" and the members list after each area derivation; an explicit `part_of` overrides.
- Kananaskis Country's area includes the Canmore edge (protected-area-entry Gotchas): its conservation-pass requirement uses
  `entry.for_types` or an exemption, never a guess.
- A record with two parents (a trail across a park boundary) shows the first in breadcrumbs; both in "In ... and ...".
- Never parse a ref to find a parent (4.4 rule 2); the lane's `rootRef` is for the lane rule only.
- `graph.ts build` must run after any capture or locations change in the same commit, or check-all fails on a stale index.
- A slug takeover (a capture record named exactly like a store place, AREA-2 lesson): run `slugs.ts --check` after every new
  top-level record.
- Public trips stay dateless: `TripTouches` uses day numbers only.

## Change log

- 26 Oct 2026: written (travel-planner, Opus) from the owner's request of the same day; protected-area-entry.md rewritten as
  an instance of it.
