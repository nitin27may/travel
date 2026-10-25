# Trip navigation links and base-aware day routes

Owner request, 24 Oct 2026: show trail links and directions directly in the
timeline, provide a combined day map with every stop, and explain how one fixed
base changes the plan and driving. **Plan only for now. Execute after the current
Neon work and the previously queued closure work are complete.**

## Evidence and existing foundation

The owner's screenshot shows linked stop titles and driving summaries but no
visible trail-provider or navigation actions beside those stops. A title linking
to our detail page does not replace an outbound trail or directions link.

There is already a combined-day URL builder:
`web/components/trips/directions.ts`, used under the map in `TripRouteMap.tsx`.
It uses the morning base, ordered stop pins and night base. It is not a new
feature from scratch: improve discoverability, route semantics and completeness.
It currently caps intermediate waypoints at nine and truncates the remainder.
That does not meet the owner's requirement that all stops be represented.

Reuse F05 (external trail links, link-only), F02 (base strategy), F06 (day legs
and sleep base), F12 (adaptation without losing must-dos), existing map link
helpers and the shared selected-plan route model. No parallel route builder.

## Delivery order

### 1. Visible links beside each stop

- Keep the stop title as the internal place/trail detail link. Add clearly named
  actions in the timeline: **Directions**, **View in Maps**, **AllTrails** when a
  verified source link exists, and other available official trail/park links.
  Do not hide the essential navigation actions inside Export or the map key.
- **Owner clarification, 24 Oct:** every stop must have its own separate map
  action displayed beside that stop's name, not just one combined-day link.
  Use a visible label such as **Map: Interlakes Trail** and an accessible name
  identifying the stop. Keep the internal title link and the separate map link
  distinct. Where coordinates/access are genuinely missing, show a clear
  stop-specific unavailable state and capture the gap; never fabricate a pin.
- Directions targets the verified road-accessible trailhead, parking area or
  meeting point, not a summit, lake centre or arbitrary point on a hiking route.
  View in Maps may show the attraction itself; label this distinction.
- Keep walking/hiking navigation separate from driving. A trail line is not a
  driveable road. If an access point is unknown, explain the gap rather than
  generating a misleading driving destination.
- Reuse authored links through the public data boundary; expose an allowlisted
  link shape if the current timeline payload omits them. Never invent an
  AllTrails URL or copy restricted trail content. Missing links become targeted
  research tasks, not guessed search-result matches.
- Show actions on phone and desktop, with accessible names and touch targets.
  The plan remains readable when a provider link is absent.

### 2. Combined day directions

- Place **Open day route in Google Maps** at each day header, next to its driving
  summary, as well as under the map. Offer per-stop navigation without requiring
  a day map selection. All-days mode still exposes each day's action.
- Use the active profile, selected split lane and actual timeline stop order.
  Include the morning departure base, every included road-access stop, and the
  overnight base/return destination when known. Show the route's stop count and
  start/end labels before leaving the app.
- Split hiking and other non-driving segments out of the driving itinerary.
  Multiple stops sharing one parking point may share a driving waypoint, but
  the UI must still account for each visit and explain the shared access.
- Verify provider waypoint/URL limits for desktop and mobile at implementation.
  When a complete day will not fit, generate numbered consecutive route parts
  with overlapping boundary stops. Never silently drop later stops. Explain any
  stop that cannot be routed because its verified access point is missing.
- A one-stop day still offers destination directions; a base-out-and-back day
  must not be rejected just because start and end coordinates match.
- Links are navigation hand-offs, not guarantees that Google will reproduce our
  route geometry, traffic estimates or stop timing. Label estimates honestly.

### 3. One-base and changed-base behavior

> **Related (25 Oct 2026):** researched, read-only ways to stay per trip (fewer moves, lower cost, one base) are
> specified in [stay-bases-and-optimisation.md](../../features/stay-bases-and-optimisation.md) (R-76 to R-80). They use
> the same recomputation as this section through one evaluator (`core/src/stays/`), but are authored and precomputed, so
> they do not need the planner backend; the visitor's own base edits below stay signed in, as written here (that spec,
> section 16 C2 and C3). Nothing in this section is changed.

**Expected behavior:** choosing one stay as the base makes day trips start and
finish there, unless a day explicitly ends elsewhere. That changes driving legs,
distances, drive durations, departure/return times, map geometry and navigation
URLs. It may make the original schedule infeasible. Changing only the label of a
base must not leave the previous base's route or drive totals in place.

- Distinguish one base for the whole trip, a base for a day range, and an
  overnight base change. Show which days the choice affects before applying it.
- First preserve selected activities, their order, fixed bookings and split-lane
  meet-ups. Recompute travel and the dependent schedule; do not silently drop,
  reorder or replace stops. Propose changes separately, with reasons, if the
  new base cannot support the existing day.
- Flag excess driving, late arrival, missed timed entry, impossible meet-up or
  return, and unavailable routing. Offer a comparison of old/new daily driving
  and departure/return times. Keep estimates explicit while routing is pending.
- Apply a base edit as an operation with undo and persisted state. Invalidate
  affected leg-cache entries by actual endpoints/mode/routing version. Update
  timeline, totals, map, per-stop/day links and exports from the same revision.
  Never show newly selected base labels with stale previous-base directions.
- Keep private accommodation coordinates in the authenticated plan. Public
  templates, exports and shared links retain their audience-specific privacy
  rules; no private base may leak into public API output.
- The current public template is not an editable personal itinerary. Do not
  claim existing base selection already triggers recomputation. Implement this
  against the real planner operation/data contract after the backend work.

## Implementation gates and acceptance

1. Inspect source-link availability and access-point coverage for the screenshot's
   Interlakes, Rockwall and Kananaskis stops. Record exact gaps; research only what
   is needed through the research method. Resolve canonical refs, never fuzzy
   place-name matching.
2. Specify any shared API/operation changes before building. Design review rules
   on day-header and stop actions, base-scope control, comparison and conflict
   states; then travel-builder implements.
3. Test link presence and correct destination coordinates, malicious URL rejection,
   missing facts, repeated parking, one-stop days, base round trips, every stop
   beyond provider limits, active profile and split-lane parity.
4. Test fixed-base and moving-base cases: base change alters first/last legs and
   route links, recomputes schedule/totals, detects booking conflicts, persists
   across reload, and undo restores all derived views. Failed routing cannot
   leave stale directions presented as current.
5. Verify privacy for public versus authenticated/shared output. Check phone and
   desktop in both themes and actual outbound URLs, not just anchor counts.
   End with design review and independent verification.

Acceptance is complete only when a person can open a trail's available source,
navigate to its correct access point and open the whole selected day without
losing stops, with base changes consistently reflected throughout the plan.
