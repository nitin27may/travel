# Lane: accessibility

Status: draft (17 Oct 2026).

## 1. Purpose

Precise, verifiable access information so that people with mobility, sensory or medical needs (and
grandparents, and strollers) can plan with confidence. "Accessible" is never a single flag: it is
surfaces, gradients, steps, distances, facilities and transport.

## 2. Produces

`eligibility.accessibility` (`step-free`, `partial`, `none`, `unknown`) plus structured `attrs.access`
on entities, parking lots and stays; `alternative_to` relations to accessible options.

## 3. Required fields (when the entity is marked anything but `unknown`)

`attrs.access.route` (`{surface, max_gradient_pct, length_m, steps: count, width_min_cm}`),
`attrs.access.parking` (accessible spaces and distance), `attrs.access.toilet` (accessible toilet yes/no
and where), source.

## 4. Optional fields

`attrs.access.rest_points` (benches every N m), `attrs.access.transport` (shuttle with lift or ramp),
`attrs.access.rooms` (roll-in shower, grab bars, door widths) for stays, `attrs.access.sensory` (quiet
hours, sensory kits), `attrs.access.service_animals`, `attrs.access.equipment_loan` (all-terrain
wheelchairs, beach wheelchairs), `attrs.access.assist` (staff assistance on request, booking lead).

## 5. Sources, in order

Land managers' accessibility pages; operators; disability organisations' guides (AccessNow, Euan's Guide,
national associations); community reports from disabled travellers with dates.

## 6. Evidence rules

`step-free` requires an `official` or `operator` statement plus no contradicting community report;
otherwise `partial` with what is known.

## 7. Leave empty

`step-free` from photos; gradients guessed from a map.

## 8. Freshness

365 days; temporary barriers (construction) as condition reports with 7-day freshness.

## 9. Traps

A single step at an "accessible" entrance; accessible toilets locked or seasonal; shuttle-only access
without lifts; boardwalk with a steep final ramp.

## 10. Example changeset (abridged)

```json
{ "changes": [ { "op": "update", "target_kind": "entity", "target_id": "ent_moraine_lakeshore", "base_version": 2,
  "patch": { "eligibility": { "accessibility": "partial" },
    "attrs": { "access": { "route": { "surface": "packed gravel and roots", "length_m": 1300, "steps": null }, "toilet": { "accessible": true, "where": "day-use area" } } } } } ],
  "gaps": [ { "target": "ent_moraine_lakeshore", "field": "attrs.access.route.max_gradient_pct", "reason": "not published" } ] }
```
