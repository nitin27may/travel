# Lane CC: what the public adapter (S1, 3a.5) must do to read the new model

Lane CC changed data and core only. `web/` still reads what it read before and builds. These are the changes S1 needs so the place
pages can draw the new sections (capture contract section 6). Nothing here is done in `web/`.

1. **Read the contract, not labels.** `data/schema/capture/contract.json` (`capture-ui-contract/1`) has the 14 sections, every
   property with its section, display levels, value type, honest-gap wording and filter role, the facet list by scope, and the
   bands. It replaces `web/lib/public/contract.ts` from the spec (generated file, so the adapter reads this one at build time, P9).
   `glanceFor()` becomes: the type's `display.slot3`, then its first R properties with a short renderer. The per-type resolved marks
   are in `data/schema/capture/<domain>.json` (a node that is identical to its parent says `inherits`).
2. **Join by ref.** A record is the join of its capture record (`data/capture/<trip>/*.json`: `type`, `layer`, `name`, relations),
   its suitability record (same ref) and its relevance record (same ref). `core/src/capture/records.ts` `loadWorld(root)` does
   the join and the derived inverses (`incoming.reached_by`, `.at`, `.on`, `.children`, `.parks_for`); `completeness(world, ref)`
   gives the level and what is missing, for the data-notes badge. Use them behind the adapter or copy the join; do not re-derive.
3. **Routes no longer carry the payoff's draw.** For the 33 trails judged as their payoff, the route keeps its ref but its relevance
   record is gone: read the draw, standing, class, photo and badge from the first `reaches` place ("to Sentinel Pass"). The
   place cards for these (26 new `part/<ref>#payoff` places, 7 existing places) are new items; a place page's "How to get there"
   is its `reached_by` routes.
4. **Lifts.** The line (old ref, a route) has no suitability record. Its chips, last up and last down, limits and stroller on board
   come from the ticket offer `offer/<ref>#ticket` (found through `incoming.on` of the line). The top station is a place
   (`reaches`).
5. **Offers keep their refs.** The 15 activities that were stored as places keep their ref and now have `layer: "offer"` and an
   `at` place (the minitrekking has none: show "Not checked yet"). A place's "At this place you can also" is its `incoming.at` and
   `incoming.on`, grouped by domain; "Part of" is `part_of`. The place pages for the new `part/...#place` records can fold into
   the parent page; they have a name and no values yet.
6. **Points.** `data/relevance/inputs/points.json` still keys by ref: a route's point is its trailhead; the payoff place has the
   payoff point (Wikidata P625). 111 refs still have none.
7. **New refs** have the forms `part/<parent ref>#<slug>` and `offer/<parent ref>#<product>`; they resolve through the parent.
   `data/suitability/scope.json` is unchanged (207 items), and a capture record's `aliases` would list old refs if any were renamed.
8. **Facets.** `facets` in contract.json lists each facet's scope (a type id or `intent:see|walk|do`), its control, and the list-row
   band it reads (`time_band`, `price_band`, `booking`, `kids_from`, `effort`, `length_band`, `climb_band`, `walk_band`,
   `season_band`). The P8 allowlist test must add those band keys by name when step 6 lands.
9. **Relevance classes.** 15 classes are new in `data/vocab/relevance-classes.json`; a moved relevance record has the payoff's
   `kind` (lake, viewpoint, waterfall, sight) instead of `trail`.
10. **Pregnancy** has a fourth value, `not_recommended`; the medical block may carry a `not_recommended` list. Hand-picked
    `pair_with` can have `km`, `how` and `extra_min` all `null` (a record without a point): show the pair with no distance.
