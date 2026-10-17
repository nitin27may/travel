# F14. After the trip

## Purpose

Close the loop: record what really happened, keep the memories with the plan, feed corrections back
into the catalog, see what it cost, and turn a good trip into a template others can use. This is
how the catalog gets better from real visits and how the owner's travelled trips become curated
samples.

## User stories

1. As a traveller back home, I want the plan pre-marked with what we did and skipped (from Today mode), so that recording takes minutes.
2. As a family, we want a few photos and a one-line note per highlight, so that the trip is remembered next to the plan.
3. As a traveller, I want to report "the trail was closed" or "parking now costs $15", so that the next family isn't caught out.
4. As a planner, I want a "what would we change" note per day, so that the template learns.
5. As the owner, I want to publish the trip as a travelled template in a few steps.

## Detailed behaviour

1. **Trip phase `after`** begins the day after the last day; the dashboard leads with "How did it go?".
2. **Review pass**: day by day, items pre-marked done or skipped from Today mode ticks (`actual_start`/`actual_end`); unmarked items are asked about in one screen per day (done, skipped, changed to...). Actual times kept when recorded.
3. **Memories**: per item or per day, up to N photos (phone uploads, resized in the browser, stored privately), a short note, a rating (1-5, private, used only for the household's own suggestions), and "would do again" / "skip next time". Shown in a trip story view.
4. **Corrections**: per item, "Something was different" with presets (closed, moved, price changed, hours changed, parking changed, harder or easier than stated, booking window different) and an optional photo or link; creates a changeset (F16 review) with the visit date as evidence (`confidence: community`, or `official` when the user attaches an official notice).
5. **Visits** feed the catalog: visited counts and recent visit dates (aggregated, no names) improve freshness for fields the visit confirms ("parking fee confirmed on 18 Sep 2029").
6. **Lessons**: a per-day and per-trip "what we'd change" note, kept private by default, optionally carried into the template as public notes.
7. **Cost close-out**: actual vs planned summary (F10); missing expenses prompt ("3 reservations have no paid amount").
8. **Trip story**: a read-only page of the trip with highlights, photos, the route map and day summaries; private to members by default; shareable via guest link (see Sharing).
9. **Publish as template** (F12): pre-fills `travelled = true`, travelled dates, priorities from ratings (rated 5 and "would do again" → must; "skip next time" → nice or removed), lessons as public notes if chosen; privacy preview required.
10. **Archive**: after review, trips move to Past (hidden by default in the trip list, searchable); offline data offered for removal.

## Sharing

See [10-sharing.md](../10-sharing.md). The **trip story** can be shared as a guest link (photos and notes the user selects; no ages, codes, costs unless included) or as image cards per highlight via the Web Share API. Corrections are public only after review, and without the reporter's name unless they choose to be credited.

## Data touched

`trip` (phase), `trip_item` (status, actual times), `day_note`, `changeset`/`change`, `evidence`, `entity` (freshness), `expense`, `budget_line`, `attachment` / Storage (photos), `template_version`.

### Schema additions

- `item_memory (id, trip_id, item_id, day, author_id, note, rating smallint, again text check (again in ('yes','no','maybe')), photo_ids text[], created_at)`.
- `trip_lesson (trip_id, day, text, public boolean default false)`.
- `visit_stat (entity_id, month, visits int, last_visit date)` aggregated nightly from done items (no personal data).

## Operations and MCP tools

Operations: `trip.review_day`, `item.mark_done`, `item.mark_skipped`, `memory.add`, `memory.update`, `memory.remove`, `correction.submit`, `lesson.set`, `trip.archive`, `template.publish_preview` (F12).

MCP: `tasks`/`edit_trip` cover marking; `propose` (research scope) is not needed for corrections from members: `correction.submit` is exposed in `edit_trip` as `report_correction`.

## Edge cases

- A trip abandoned midway (weather, illness): remaining days marked skipped in one action with a reason.
- Photos with location metadata: stripped before any sharing; kept privately for placing on the map.
- Corrections that contradict official sources: queued with lower confidence; the reviewer sees both.
- A trip never reviewed: after 30 days it auto-archives with items left as they were.

## Acceptance criteria

1. Items ticked in Today mode appear as done in the review without re-entry.
2. A correction submitted from an item creates exactly one changeset with the visit date and the item's entity, visible in the admin queue.
3. Publishing a reviewed trip proposes priorities from ratings and passes the F12 privacy test.
4. Photo metadata (GPS EXIF) is removed from any shared image.
5. Archived trips are hidden from the default trip list and still searchable.

## Milestone

M5.

## Open questions

1. Photo storage limit per trip on the home server? Default: 200 photos per trip at 2048 px, originals not kept.
2. Should ratings ever influence public suggestions? Default: no in year one; only the household's own.
