# F12. Templates, reuse and adaptation

> **Amended 25 Oct 2026:** per-trip best-time windows (`data/windows/<trip>.json`) and a signed-in customised copy (a
> delta in `plan_draft`) come first, in [trip-overview-and-customisation.md](trip-overview-and-customisation.md).
> "Use this trip" (behaviour 8) converts such a copy into a fork; month adaptation (13 to 16) can read the windows'
> `affects` lists.

## Purpose

A well-planned trip is worth reusing. The owner researches destinations through the MCP and
publishes **curated sample trips** (the Rockies 2029 plan, Patagonia, Iceland, the Dolomites,
Vermont foliage, Whitby day trips). Anyone can fork one **as it is**, or have it **adapted** to a
different length, month, weather and party. Forks can see when the template improves.

## User stories

1. As a family, I want to fork "Canadian Rockies, 14 nights, family + adults' tracks" with our dates and party, so that we start from a researched plan.
2. As a family with only 10 nights, I want the template shortened sensibly (keep the must-dos, merge or drop the rest, re-balance bases), with every change explained.
3. As someone going in July instead of September, I want items closed in July swapped and booking windows and daylight recomputed, so that the plan is right for my month.
4. As a party with a 7-year-old, I want items that don't fit swapped for the family variant, so that the plan suits us.
5. As the owner, I want to publish my researched trips as templates without any family data, so that sharing is safe.
6. As a forker, I want "3 updates available" when the template gets better, and to choose which to take.
7. As the owner, I want to research a destination via Claude and assemble a sample trip from the catalog without having travelled it, marked as such.

## Detailed behaviour

### Kinds of reusable trips

1. **Template**: a trip with `is_template = true`, no dates, no travellers' personal data, items referencing catalog entities (or custom items with public info), day numbers, variants, priorities, Plan B links, to-book placeholders (no reservation details), notes marked public. Metadata: title, summary, area(s), nights (and min/max it adapts to), good months, party fit (min age per variant, fitness), trip types, pace, tags, author, **curated** flag (owner-made), **travelled** flag (the author actually did it) vs **researched only**, version, published date, cover.
2. **My past trip as a starting point**: "Duplicate" any of my trips (private, with or without reservations as to-book placeholders).
3. **Day-trip templates**: single-day templates ("Spencer Gorge + Dundas Peak + Webster's Falls from Whitby") for the day-trip finder.

### Publishing (owner and, later, users)

4. "Publish as template" opens a **privacy preview**: exactly what others will see. Stripped: travellers, ages, heights, weights, passport data, reservation details and codes (reservations become to-book placeholders with kind, title, nights and lead time: "book a stay in Ortisei, 3 nights, ~90 days ahead"), attachments, expenses, private notes, member names, activity history. Kept: days, items, variants with their *requirements* (not the people), priorities, Plan B, public notes, lists, budget estimates as ranges per category (optional).
5. Curated templates are researched through the MCP (F16, research pages): the owner (or Claude on their behalf) builds the trip with `create_trip`, `edit_trip` and the catalog, then publishes. The template page shows "Researched by the owner, not travelled" or "Travelled in Sep 2029".
6. Template pages are public (`/templates/<slug>`), with JSON-LD `TouristTrip`, a day-by-day summary, map, and "Use this trip".
7. Versioning: each publish creates a new version (`template_version` snapshot). The page shows a changelog line per version ("v3: Lake Louise shuttle window updated for 2028").

### Fork as it is

8. "Use this trip" asks: start date, party (household default), and whether to adapt (default: adapt only what's broken). Creates a new private trip owned by the user, with `forked_from` and `forked_version`, items copied with `source_item_id`, to-book placeholders for every reservation, and generated tasks and reminders recomputed for the new dates.
9. Immediately runs the checks (F07) and shows a **fit report**: what fits as is, what doesn't (with reasons) and what the adapter would change.

### Adapt

10. Adaptation is a deterministic planner pass producing a **preview diff** (moved, merged, dropped, swapped, added) with a reason per change. The user accepts all, some, or none. One operation, one undo.

**Length (shrink or extend)**

11. Shrinking from N to M nights:
    - keep all `must` items; drop `nice` first, then `should`, lowest score first (score = priority, uniqueness in the area, distance from the bases kept, rating from template co-occurrence);
    - **bases**: reduce nights per base proportionally but never below 1 when a base has must items; drop a base whose must items can be reached as a day trip from a neighbouring base (within the pace profile's max drive);
    - **merge days**: two half-full days at the same base merge when combined totals fit the pace;
    - travel days between bases are preserved (they're structural), but their stops shrink to the best one;
    - to-book placeholders follow their items (dropped item → placeholder removed).
    Example: Rockies 14 → 10 nights: Banff 2 → 2, Lake Louise 1 → 1, Jasper 4 → 3, Lake Louise 4 → 2, Kananaskis 3 → 2; "Waterton was not in the 14-night plan" stays out.
12. Extending: add days at bases with the most unscheduled `should` and `nice` catalog items nearby; offer the template's own extension options when the author defined them (the Rockies 16-night option adds Waterton); otherwise add a rest day every 4-5 days at balanced pace.

**Month and season**

13. For the new dates: re-check every item's season, hours and closures; swap closed items for `alternative_to` relations or catalog items with matching tags nearby; mark "may be closed" when data is missing.
14. Recompute daylight per day: move sunrise and sunset items to the new times; drop or flag hikes that no longer fit daylight (Iceland in September vs July: darkness returns, campsites close, Camping Card validity).
15. Recompute booking windows and book-by dates from the offers; flag windows already closed ("Lake O'Hara lottery closed for 2028 dates; fallback: 48-hour release").
16. Crowd and price season notes from the area's timing data (fellesferie in Norway, Labour Day in Canada, UTMB week in Chamonix), as info-level notes on affected days.

**Weather**

17. The template's Plan B items and weather rules carry over. Before the trip, the conditions check (research/ conditions lane; F09 Prepare task) and the forecast in Today mode (F13) evaluate the rules and propose the switch. Adaptation itself does not use forecasts (too far ahead); it uses climate norms per month when the area has them ("Patagonia February: wind over 60 km/h on ~40% of days; keep Plan B for every ridge").

**Party**

18. For each item, check eligibility against each traveller at the new dates. If an item has variants, assign travellers to the variant they fit (Track A adults, B family, C less walking). If not, swap to a fitting alternative or mark the traveller as sitting it out (`who` excludes them) with a suggested parallel activity nearby.
19. Pace and walking limits from the new party's household preferences replace the template's; days over the limit are flagged and trimmed by priority.

### Updates to forks

20. When a template publishes a new version, each fork with `template_version_seen` below it shows "3 updates available" on its dashboard. The update view lists changes that touch items the fork still has (`source_item_id`): fact changes come automatically from the catalog anyway (items point at entities), so updates are about the **plan** (a new Plan B, a changed time, a corrected book-by lead time, a new must-do). Each update: accept or ignore. Ignored ones don't return.
21. Forks never change when the template changes unless the user accepts.

### Discovery of templates

22. `/templates`: filters by area, nights, month, trip types, party (youngest age, fitness), curated, travelled; cards show nights, bases, months, fit, curated badge.
23. Explore and area guides show "Trips using this place" for an entity.

## Sharing

See [10-sharing.md](../10-sharing.md). Templates are the **public** audience: `/templates/<slug>` pages, JSON-LD, image cards and "Use this trip". A template can also be published **unlisted** (link only, not in the gallery) for friends. Publishing always goes through the privacy preview (behaviour 4). A live trip is never public; sharing a live trip uses guest links (F11).

## Data touched

`trip` (is_template, forked_from), `trip_item`, `trip_list`, `day_note`, `reservation` (to-book placeholders), `offer`, `entity`, `relation` (alternative_to, part_of), `task`, `reminder`, `op_event`.

### Schema additions

- `trip.template_meta jsonb`: `{summary, min_nights, max_nights, good_months[], party_fit {min_age, fitness}, curated, travelled, travelled_on, extensions[] {label, nights, item_refs[]}}`.
- `template_version (trip_id, version, published_at, snapshot jsonb, changelog text, primary key (trip_id, version))`.
- `trip.forked_version int`, `trip.template_version_seen int`.
- `trip_item.source_item_id text` (template item id in the fork).
- `template_update_decision (fork_id, version, source_item_id, change_hash, decision, decided_at)`.
- `trip_item.priority` (from F06) is required for adaptation.

## Operations and MCP tools

Operations: `template.publish_preview`, `template.publish`, `template.unpublish`, `template.fork`, `trip.duplicate`, `trip.adapt_preview` (params: nights, start_date, party, keep[]), `trip.adapt_apply`, `template.updates` (query), `template.apply_update`, `template.ignore_update`.

MCP: `fork_template` (template, start date, party, adapt: true/false), `adapt_trip` (preview or apply with the same parameters; returns the diff with reasons), `search_templates`, owner-only `publish_template`.

## Edge cases

- Template with custom items that have no catalog entity: copied as custom items with their public info.
- Adapting to fewer nights than the number of structural travel days: the adapter proposes dropping a base and explains; it never produces impossible days silently.
- A template in a region with thin coverage: adaptation swaps nothing it can't justify; marks "check locally".
- The forker's party has no ages: party adaptation is skipped with a prompt to add ages.
- Template unpublished after forks exist: forks keep working; updates stop.
- A template item whose entity was retired (business closed): the fork shows a warning and the adapter proposes an alternative.

## Acceptance criteria

1. Publishing the Rockies trip produces a template with zero personal data (privacy test: no person names, ages, codes, attachments, expenses, private notes in the snapshot).
2. Forking it with 10 nights produces a preview where every `must` item survives, no day exceeds the pace profile, every change has a reason, and applying it is one undo.
3. Forking for July instead of September flags or swaps every item whose season excludes July and recomputes every to-book task's due date.
4. With a 7-year-old in the party, every item with min age over 7 is either reassigned to a fitting variant or marked with the child excluded and an alternative offered.
5. Publishing a template v2 shows "updates available" on an existing fork, and accepting one update changes only that item.

## Milestone

M5 (publish, fork, duplicate, privacy preview, template pages, updates); adaptation v1 (length, season, party) in M5; climate-norm notes and extensions in M6.

## Open questions

1. Let non-owner users publish templates in year one? Default: no (family first); owner and invited curators only.
2. Should "travelled" templates require a done trip as their source? Default: yes; researched-only ones carry the "not travelled" badge.
3. Budget ranges on templates: include? Default: yes, per category, as ranges with the year of the prices.
4. How many past versions to keep? Default: all (snapshots are small).
