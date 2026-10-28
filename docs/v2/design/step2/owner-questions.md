# Step 2: owner questions

Status: **open** (27 Oct 2026, travel-planner, Opus, STEP2-PLAN). Seven questions, each answerable yes or no (or one pick).
Everything with a sensible default is decided in the spec and listed under "Assumed" below; say the word to flip any of
them. Master plan: [README.md](README.md).

| # | Question | Recommendation | If yes | If no | Blocks |
|---|---|---|---|---|---|
| OQ1 | Your own trip opens at **`/t/<id>/`**, rendering the same trip details page as `/trips/<slug>/` (same cover, tabs, days, map, print), and the bridge on `/trips/<slug>/#mine=` (EM-3) is not built? | **Yes** | `/trips/` stays public, cacheable and inside its start-JS headroom; one address for copies and builder plans; old `mine=` links redirect | edit mode on `/trips/<slug>/` needs a start-JS budget waiver on the public page (under 1 KB headroom today), and builder plans still need `/t/<id>/` (they have no slug), so two addresses | STEP2-T1 |
| OQ2 | On your own trip, the one filled button is **Edit trip**, with Add to calendar (or Add dates) as the first secondary? | **Yes** | editing is obvious (your "seems not editable"); calendar stays one tap away | the primary is Add to calendar or Add dates (F-Q4 as decided for Review), and Edit trip is a secondary button | STEP2-T1, STEP2-FND |
| OQ3 | Confirm the three brainstorm questions still open, as recommended: **Q-BE2** day versions stay until a copy converts, then flatten with the other versions offered in "Add a place"; **Q-BE7** the template-mode action table (edit-mode-spec 13.1), conversion keeping "From our trip" stops placed; **Q-BE8** quiet sync, a notice only when a change could not apply? | **Yes to all three** | the spec stands as written (marked "assumed" today) | name the one to change; Q-BE2 no means versions are dropped at copy time (simpler, loses our alternatives); Q-BE8 no means a banner on every sync | STEP2-C1, STEP2-E1 |
| OQ4 | Turn on **sync of My trips** (`NEXT_PUBLIC_ACCOUNT_TRIPS`) in production as soon as STEP2-C1 merges, before edit mode ships? | **Yes** | signed-in copies follow the account now (your earlier request R-276), with today's edits; C1's keys are in `plan-draft/1` before the first document is stored | sync ships with edit mode at GO-2; if it is turned on before C1, every Step 2 key becomes a `plan-draft/2` change | GO-1 |
| OQ5 | Build **edit mode for copies first** (phases A and B, about 23 sessions), and the builder's hand-off and built-plan editing with FS-1 after (phase C, 7 sessions)? | **Yes** | the trips you already have become editable without waiting for the builder engine | both ship together after FS-1; copies stay read-only until then | build order |
| OQ6 | Changing **bases on a copy** goes through the one convert notice and then the builder's engine; the separate signed-in base tweak on copies (STY-2's template `stays` operation, about 10 h planned) is not built? | **Yes** | one base-change path; no two engines that disagree | STY-2 is built as planned for copies, and the builder's engine for built plans: two ways to change a base | STEP2-B2, STY |
| OQ7 | **Copy to my trips** opens your copy straight away in edit mode with the "Make it yours" card and an Undo toast, replacing today's done step ("Open in Mine")? | **Yes** | copying leads into customising (your 27 Oct ask); one fewer screen | the done step stays; the copy opens from it in read mode | STEP2-P3 |

## Assumed (decided in the spec; flip on request)

| What | Decided as | Where |
|---|---|---|
| The builder's first build | lands in **edit mode** with the just-built line; reopening from Mine opens read mode | edit-mode-spec 2.1, 2.3 |
| Review and prepare (FLOW stage 8) | no screen of its own; its content is the Summary and Bookings tabs and the cover actions | README ruling R2 |
| The FLOW Plan grid (outline 256, day 640, map) | not built; the details page's Days list with its map column is the plan | README ruling R2 |
| Edit mode's address | `?edit=1` with `pushState`; Back leaves edit mode; Done never waits for the network | edit-mode-spec 3 |
| Phone bar in edit mode | Settings · Done; Undo in the toast and the cover `⋯` | edit-mode-spec 3 |
| Compare before and after (the builder prototype's sheet) | not built; the Changes from our plan list with Restore is the comparison | edit-mode-spec 10 |
| After conversion | one label "Reset to our plan" (not the brainstorm's "Back to our plan"); the confirm says it replaces your trip | README 5.2 |
| Maybe list | copies only | edit-mode-spec 5 |
| Reorder days | built trips only, inside one base's nights | edit-mode-spec 6 |
| Table view | read only; editing works in List | gap-analysis H10 |
| Remove label | "Remove from Day 5" (replaces "Remove from this day") | README 5.2 |
| Drag keys | Space or Enter lifts and drops | README ruling R5 |
| Reset to our plan | confirms over 3 changes (a foundation exception you approved in Q-BE4) | README ruling R7 |
| Mine | one list for copies and plans; no separate "My plans" tab | README ruling R8 |
| Warning levels | the Fix and Check code table of edit-mode-spec 11.1 | edit-mode-spec 11 |
| Add-a-place groups | today's labels kept, four groups added | edit-mode-spec 7.2 |
| "In your trips" on place pages | from Mine's light rows and documents already on the device; never fetches a document | gap-analysis 2.4 |
| Save to a trip on a park | adds places in the park; the park itself is never a stop | gap-analysis 2.4 |
| The plan model for `/t/` | a public, cacheable endpoint per trip; the person's changes are applied on the device | gap-analysis D6 |
| Flags | new `tripEdit`; `planBuilder` needs `tripEdit` on | build-plan 2 |
| Migrations | none in Step 2 | gap-analysis D11 |
| Prototype round first | STEP2-PR and gate G-S2 before any edit-mode UI build | build-plan STEP2-PR |
| Today mode, packing, reminders, stops we do not have | later (F13, F09, REQ-P) | README 2 |

## Change log

| Date | Change |
|---|---|
| 2026-10-27 | Created (STEP2-PLAN, travel-planner, Opus): OQ1 to OQ7 |
