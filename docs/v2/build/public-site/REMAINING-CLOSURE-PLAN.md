# Finish the partly built work, one item at a time

Owner request, 23 Oct 2026: focus on half-done items, pull their existing plans or
write a detailed plan, then finish them one by one. Execution approved the same day.

This is a closure queue under [PHASE-E-START.md](PHASE-E-START.md), not a replacement
for its contracts, lane ownership or R2 criteria. Finish a queue item before starting
the next. The owner selected Vercel and directed project setup/deployment once the
branch is merge-ready (PLAN R-61); this document does not authorize deployment before
that gate, legacy deletion or merge into the main checkout.

## 1. State established before execution

The session branched from `main` at `47bf9ab`. API-3, META-2, HYG and TRP2b are
already merged. The restoration of decisions A29 to A40 and its guard test are also
done (`9a7fc66`, merged in `47bf9ab`); do not repeat that work.

TRP2b2 was the only confirmed active unfinished lane: four commits on
`public/TRP2b2` at `d20a9f5`. Those were cherry-picked into
`nitin27may-phase-e-remaining-plan` as `d2b1498`, `1bc4ec3`, `e141477` and
`3383ce8`. The follow-up implementation and regression coverage are committed as
`da3760a` on this session branch. They are not on `main` until separately integrated.

## 2. Closure queue

**Owner sequencing update, 24 Oct:** finish the currently active
[Neon integration](NEON-SETUP.md), reconcile its specs, then create/configure Vercel
and deploy when the branch is merge-ready (R-61). Continue the remaining queue below
after deployment. Then take up [trip navigation links and base-aware day
routes](TRIP-NAVIGATION-PLAN.md) (BACKLOG 15.48). The navigation request is planned,
not an instruction to interrupt the active backend work or start another UI
implementation now.

| Order | Item | Existing foundation | Remaining work and exit |
|---|---|---|---|
| 1 | TRP2b2: map and trip exports | Google map, routed legs, export contract and four fix commits | Close preview blockers, design review, independent verification, preserve explicit go-live/server deferrals. Detailed result in section 3 |
| 2 | API/HYG review loose ends | API-3 and HYG already merged | Reconcile R-14 against actual contract tests before adding tests. Close proven gaps with tests on the stub, JsonStore and handler. R-9 and R-10/R-11 keep their pre-server deadlines; do not reopen completed work |
| 3 | LST2b: finish Where | Country/region/area menu, towns and API contracts exist | City menu and radius counts, city scope/nearest order, Trips province filter and one capped unchecked-row request (R-12). Follow LST2 part b; review then verify |
| 4 | CONS-3: finish consolidation | CONS-1/2 guards and shared foundations exist | Generated palette fallback, shared user agent/endpoints and host cleanup, with unchanged behavior. Follow CONS steps 10 to 12; slug-table step 9 stays with TD-2 |

Item 2 starts with inspection, not an assumption that every old open row still needs
implementation. Its sources are BACKLOG 15.39 to 15.42 and
[review-API3-2026-10-23.md](review-API3-2026-10-23.md).
Any contract or privacy change keeps the one-author API-lane rule.

### Item 2 execution checks

1. Map each R-14 claim to an existing case and its three runners; record a
   finding as already closed if the executable case proves it.
2. Add only missing cases and fix only behavior those cases establish as wrong.
   Do not silently remove `pending` or `awaits` markers for features not yet built.
3. Verify the affected contract targets. Record R-9 caching, R-10 build ID,
   R-11 server revision and export parity as separate pre-server tasks if not done.
4. Update the finding rows with evidence and the actual commit.

### Item 3 execution checks

Use [LST2.md](briefs/LST2.md), part b and acceptance 2, not its historical dates.
META-2 and API-3 prerequisites are satisfied.

1. Complete Cities and towns with scoped counts from the same boundary function
   as the fallback route. Keep the existing country/region/area URL keys.
2. Implement city selection and clear behavior; exact points only in distances.
3. Add province filtering on Trips, derived from its stops.
4. Replace unchecked full-row scans with the capped API request.
5. Prove Canmore nearest order, honest empty-city results, old `area=banff` links,
   clearing parent scope and Trips Alberta. Run all affected contract targets.
6. Review desktop/phone in both themes, then independent verification; keep
   new place content lazy and inside the existing size budget.

### Item 4 execution checks

Use [CONS.md](briefs/CONS.md), with step 9 deferred.

1. Measure the current hardcode baseline before edits.
2. Generate palette fallback values from the existing theme source.
3. Consolidate user-agent and endpoint constants without changing their values.
4. Remove remaining in-scope host duplication without behavioral changes.
5. Require the ratchet to pass without adding exceptions to conceal regressions,
   and prove before/after parity on affected pages. Finish before GLB2b edits the
   same globe files.

## 3. TRP2b2 preview closure

The [original review](../../design/trip-page/review-trp2b-2026-10-23.md)
remains the finding list. The
[fix-round review](../../design/trip-page/review-trp2b2-2026-10-23.md),
section 10, approves the preview, not go-live.

| Area | Implemented closure |
|---|---|
| Route truthfulness | Dashed connectors join route ends to pins; walking routes and All days legend match the drawn lines; phone collapsed key prioritizes routes |
| Loading and hover | Pins draw immediately; lines/key wait for legs or 1.2 seconds; routed hover increases width instead of applying an already-identical color |
| Ordered export routes | Map and export share `routedSteps`; only consecutive selected-plan steps export. Airports without map pins are excluded from both |
| Place/trail identity | Four Rockies pairs join through exact catalogue coordinates, without fuzzy names, proximity guesses or invented points |
| Print | Selected timeline supplies local/suggested time, duration, note and version; untimed entries do not invent missing-fact markers; travel-only days print travel |
| Export menu and credits | Purpose-first labels and counts follow the selected plan; print icon; visible OpenRouteService credit; shared legs request |
| Phone map | Expanded key overlays rather than shrinking the map; map retains at least 240 px; close/keyboard coverage |

Fixed route-count expectations for map/export parity: Rockies adults 0,
family-6 10, family-4 11; Dolomites 36 per tested profile. Zero adults routes
is intentional: the selected days have one hike and no placed base to connect.

### Evidence and validation boundary

Builder: Sonnet. Design review: Opus. Independent verifier: Sonnet.

Independent verification passed check-all, typecheck, lint, affected units and
Chromium trip/export tests. The real production trip start JS measured 199.2 KB
against the 200 KB ceiling. Place HTML and hardcode gates passed.

The verifier diagnosed a wall-clock race in the new loading test. It was replaced
with request gates and Playwright virtual time, not a longer sleep. Print assertions
now compare individual row durations, and the trip-routes suite is registered on
both WebKit projects. Final independent confirmation passed all 36 trip-routes
tests in one invocation: 12 Chromium, 12 WebKit desktop and 12 WebKit iPhone.
Typecheck, lint (zero errors) and whitespace checks also passed on the final state.
The phone Escape assertion establishes keyboard behavior with the toggle focused;
it does not claim Safari focuses buttons after a pointer click.

Screenshots and print PDFs live in session artifacts, outside Playwright's disposable
output directory. They use the stand-in Google script and a plain-surface route
overlay. They establish layout, key/menu/print and adapter output only; they do
**not** establish real Google basemap contrast, camera fit or real-map appearance.
The owner-preview refresh still requires a credentialed build and serving approval;
it was not performed from another checkout.

## 4. Explicit remaining deferrals

These are not silently counted as completed by a preview approval.

| Deadline | Finding | Required completion |
|---|---|---|
| Before go-live | MUST-6 | Booking windows in print and CSV, with dateless rules and contract review |
| Before go-live | SHOULD-2, D4 | Real Google dark-map contrast and large route-end connector evidence; rule on token changes from actual basemap shots |
| Before go-live | B4/D5 | Resolve Emerald Lake/lakeshore, Lake Louise/lakeshore and Paint Pots/walk identity where one side has no point, through sourced data |
| Before go-live | N1 | Keep the open phone key to at most half the map and its toggle stationary |
| Before go-live | N2 | Include travel-day break and arrival rows in print, particularly the Dolomites airport arrival |
| Before go-live, trip-page lane | N3 | Check doubled drive distance on Dolomites day 14 and the intended display units |
| Before go-live | N4 | Bring remaining map/key controls to the specified 44 px touch targets |
| Before server switch | SHOULD-9, R-9 | Browser/API export parity and read-once legs behavior; explicitly settle profile/override CSV time parity as part of the export contract work |
| SRV-0 | R-10, R-11 | Build-ID override and server data revision |
| Follow-up polish | N5 and original review polish | Nonshrinking menu icons and remaining review polish, tracked rather than expanded into this preview round |

Accent folding (BACKLOG 15.44) remains an owner decision, not authorization inferred
from approval of this closure queue. Q80, the globe mock, hosting and key-console
decisions retain their existing status.

## 5. Work after this queue

Keep the established dependency chain: D1 before PLC2b; LST2b and PLC2b before
LST2c; LST2c before MX; CONS-3 before GLB2b. Data lanes D3a/D4a/D5a/D6a,
E15 and R2 keep the start sheet's acceptance bar. No new completion dates are
promised from its historical calendar.
