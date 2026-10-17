# F13. Today mode and offline

## Purpose

The phone during the trip, often with one bar or none: what's next, when to leave, how to get there,
the tickets, the light and the weather, and what to do when you're running late or it's raining.
Works offline from a download made before the trip; edits sync later.

## User stories

1. As a driver at 07:00, I want "Leave by 07:10 for Moraine Lake shuttle (Lake Louise Park & Ride)" with one tap to navigate.
2. As a parent at a ticket desk with no signal, I want the confirmation and QR code on screen.
3. As a traveller running 45 min late, I want to shift the rest of the day and see what no longer fits.
4. As a hiker, I want sunrise, sunset and last light, and the forecast with the day's Plan B rule.
5. As a planner the evening before, I want a briefing for tomorrow (start time, day bag, bookings, forecast).
6. As anyone, I want a note or photo on a stop even offline, synced later.

## Detailed behaviour

### Readiness and phase

1. The trip's phase (idea, plan, book, prepare, go, after) is computed from dates and progress; the dashboard shows a readiness bar: Plan (days with items / days), Book (booked / needed), Prepare (prepare+documents+pack tasks done), Go (downloaded for offline, conditions checked).
2. During the trip's dates, opening the trip lands on **Today** (phone) and the dashboard shows "Today" first (desktop).

### Today screen

3. **Next stop card**: name, time, "Leave by HH:MM" computed from the current position (if allowed) or the previous item/base, the leg's drive time from `leg_cache` (or estimate), plus parking notes ("Lake Louise lot fills by sunrise; use the Park & Ride"). Buttons: Navigate (Google Maps or Apple Maps deep link with the destination), Details, Mark done.
4. **Timeline** of the day: items with times, the current one highlighted, done ticks, legs between them; variants shown per traveller (each sees their own track).
5. **Tickets for today**: the wallet cards for today's reservations (F08), offline.
6. **Light and weather**: sunrise, sunset, civil dusk, golden hours (from `core/src/sun` successor), forecast from Open-Meteo (cached when last online, with age shown), the day's weather rule and its evaluation ("gusts 55 km/h at 07:00: Plan B suggested") with the Plan B toggle.
7. **Running late**: "Shift rest of today by [15, 30, 45, 60, custom] min"; recomputes times of unanchored items; warns about closing times, anchored slots (a booked tour), daylight; offers to drop the lowest-priority item.
8. **Quick actions**: add a note or photo to the current stop; add an expense (F10); mark skipped; call the stay; open the night's base in Maps.
9. **Tomorrow briefing** (evening card, and a 19:00 push if enabled): first start time and leave-by, day bag list (from items: swimwear, headlamp, cash), bookings tomorrow, forecast, "tonight" tasks (charge GPS, buy lunch, check in online).
10. **Offline badge**: "Offline · last synced 07:12 · 3 changes waiting".

### Offline download

11. "Make available offline" (a Prepare task 3 days before; also manual): downloads the trip (items, notes, lists, days, reservations with codes for members, tasks, checklists), attachments, catalog entities referenced (facts, photos at small size), trail tracks and elevation profiles, sun times for each day and base, the latest forecast, and map tiles.
12. **Map tiles**: a PMTiles extract for the trip's area (bounding box of bases and items plus a margin) at zooms that keep the size under a cap (default 300 MB, shown before downloading); trails and pins render even when the basemap is missing ("plain background" fallback, stated honestly for mountain trips where the cap is hit).
13. Storage: IndexedDB for data (TanStack Query persister + Dexie for the op queue and blobs), Cache Storage for tiles and photos. Size shown per trip; "remove offline data" after the trip.
14. **Edits offline**: every operation is queued with a client op id; replayed in order on reconnect; idempotent on the server (`op_event` unique on actor + client_op_id); rejected ops land in a "couldn't apply" tray.
15. **Freshness**: when back online, the app pulls `ops since version` and the latest catalog changes for referenced entities.

### Installation and push

16. PWA install prompt at the first moment it matters (a time-critical reminder or the offline download); iOS needs Home Screen install for push.

## Sharing

See [10-sharing.md](../10-sharing.md). From Today, "Share today's plan" creates a guest link for that day only (times, places, leave-by; no codes), useful for family at home; "Share my next stop" sends a Maps link and the expected arrival time. Live location sharing is not built in; the share sheet hands off to the phone's own location sharing.

## Data touched

`trip`, `trip_item`, `day_note`, `reservation*`, `attachment`, `task`, `expense`, `entity`, `media`, `leg_cache`, `op_event`, client-side IndexedDB and Cache Storage.

### Schema additions

- `trip_item.actual_start timestamptz`, `trip_item.actual_end timestamptz` (from done ticks), `day_state (trip_id, day, delay_min, plan_b_on, updated_at)` for the running-late and Plan B state during the trip.
- `offline_package (trip_id, version, built_at, bytes, tile_bbox, tile_zooms)` to tell the client what to download.

## Operations and MCP tools

Operations: `item.mark_done`, `item.mark_skipped`, `day.shift_rest` (delay), `day.toggle_plan_b`, `item.add_note`, `item.add_photo`, `expense.add`, `offline.package` (query).

MCP: `get_trip` with `today=true` returns the current day's view; chat clients can answer "what's next?" when online.

## Edge cases

- No location permission: leave-by uses the previous item or base.
- Crossing a time zone mid-day (ferry, flight): times shown in each item's zone with a marker.
- Phone storage nearly full: download refuses with the needed size; offers tiles-off download.
- Plan B toggled by one member offline and another online: last writer wins on `day_state`; both see the result after sync.
- A trip spanning the Arctic summer (Lofoten): no sunset; daylight shows "midnight sun".

## Acceptance criteria

1. In airplane mode after download, the Today screen, wallet, timeline, tracks and sun times render, and a note added offline syncs within 10 s of reconnecting.
2. Leave-by for a known leg equals item start − leg time − parking buffer, recomputed when the delay changes.
3. Shift by 45 min moves unanchored items, leaves anchored ones, and lists conflicts.
4. The download size estimate is within 20% of the actual size.
5. The weather rule evaluates against the cached forecast and shows the forecast's age.

## Milestone

M4.

## Open questions

1. Tile cap default 300 MB? Default: yes, adjustable 100 MB-1 GB.
2. Should the tomorrow briefing be a push by default? Default: on during the trip, at 19:00 local.
3. Background location for automatic "done" ticks? Default: no (battery and privacy); manual ticks.
