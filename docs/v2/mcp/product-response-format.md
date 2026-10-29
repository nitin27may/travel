# MCP product: the response format and generative UI hints

Part of [product.md](product.md). Status: spec only, planned (26 Oct 2026). Answers owner vision item 5. Checked against the
MCP specification 2026-07-28 (structured content, output schemas, resource links, multi round-trip requests) and the MCP
Apps extension `io.modelcontextprotocol/ui` (stable 2026-01-26), read 26 Oct 2026 (sources at the end).

## 0. The decision in one paragraph

Every tool result has three parts. (1) **`content`**: a short text rendering (at most 1,200 characters, plain Markdown, the
answer first, then one line per item, then the page link), plus `resource_link` items to our pages. (2)
**`structuredContent`**: the typed payload, validated by the tool's `outputSchema`, wrapped in a `travel-view/1` envelope
that names a **view kind** (trip card, day timeline, map, booking list, date picker and others), the fields to lead with,
honesty notes and suggested next actions. (3) Optionally, an **MCP Apps view** (`ui://travel/<view>`) declared on the tool
with `_meta.ui.resourceUri`, which hosts that support the extension render in a sandboxed frame from the same structured
payload; hosts without it ignore the metadata and show the text. The contract is the structured payload; views and text are
renderings of it. **Trade-off:** three renderings to keep consistent (one generator per view kind writes both the text and
the hint), against payloads that only one client can display.

## 1. What each client renders (to verify in MCP-PK and MCP-E)

| Client | Text `content` | `structuredContent` | `resource_link` | MCP Apps views | Notes |
|---|---|---|---|---|---|
| Claude (web, desktop) | yes | to the model | shown as links | yes (listed by the ext-apps support matrix) | custom connector by URL; OAuth |
| Claude (mobile) | yes | to the model | links | not confirmed | check in MCP-E |
| ChatGPT (apps and developer mode) | yes | to the model and the widget | links | yes (Apps SDK is built on MCP Apps; host CSS variables; approval modes) | reported July 2026: Android may skip `resources/read` for widgets, so text must stand alone |
| Claude Code | yes (terminal) | to the model | printed | no (terminal) | plugin can bundle the server entry and skills |
| VS Code (Copilot), Goose, Cursor and other MCP Apps hosts | yes | yes | yes | listed as supporting MCP Apps | |
| Plain MCP clients and SDK scripts | yes | yes | yes | no | |

Rule: **the text alone must let a user act.** Views add comfort, never information the text lacks.

## 2. The envelope: `travel-view/1`

```ts
interface ToolResultStructured<T> {
  view: {
    schema: "travel-view/1";
    kind: ViewKind;               // section 3
    title: string;                // what the user is looking at
    lead: string[];               // the 3 to 6 fields to show first, by key in `data` (P3: a glance)
    count?: { shown: number; total: number; nextPage: number | null };
    honesty?: { id: string; label: string }[];      // "Estimate", "Not checked yet: 4 facts", "Pattern from 2026"
    actions?: { label: string; tool: string; arguments: Record<string, unknown>; needs?: "sign_in" | "plans_propose" }[];
    links: { page: string; print?: string };        // our pages; never a third-party link here
  };
  data: T;                        // the projection; its schema is the tool's outputSchema
  revision: string;               // the API content hash
}
```

Rules: `lead` names existing keys only; `actions` are suggestions the client may show as buttons (a view calls them through
the host's `tools/call`; a text client may offer them in words); an action never carries household values the caller did
not send; `honesty` is never dropped by a view.

## 3. View kinds

| Kind | Used by | Data | Text rendering |
|---|---|---|---|
| `trip_card` | `get_public_trip`, `get_my_trip`, `copy_trip` | summary (title, length, season, bases, parks, highlights, effort, ages, shape), counts | title, one line of length and season, highlights, link |
| `trip_list` | `list_public_trips`, `list_my_trips` | rows | one line per trip |
| `place_card` | `get_place` | identity, glance facts (W10 template), safety facts, gaps count, photo | name, type, area; glance; safety lines; "Not checked yet: n"; link |
| `place_list` | `list_places`, `near`, `search`, `get_related` | rows with distance when near | one line per place with the band values |
| `day_timeline` | `get_day`, `get_my_trip {day}` | ordered items with time, duration, kind, drive legs, notes, variants | numbered lines with times |
| `map` | `get_day`, `trip_legs`, `near`, `get_place` (`include: map`) | points and lines (section 4.3) | omitted; the text names the places in order |
| `booking_list` | `trip_bookings`, `place_needs`, `get_my_trip {bookings}` | rows by kind (section 4.4) | grouped lines: Book first, Book ahead, Passes, On the day |
| `comparison_table` | any list with `compare: true` (two to five refs) | columns per item, rows per registry key in display order | a Markdown table, at most 5 columns |
| `date_picker` | `copy_trip` without `start`, `edit_my_trip {set_start}` preview | months allowed, recommended weeks, constraints (section 4.5) | "Best: 8 to 21 Sep; avoid before 1 Jul (shuttle not running)" |
| `facts_table` | `get_place {include: facts}`, `get_type` | key, label, text, read, state | a two-column list |
| `validation_report` | `validate`, `gap_report`, `stage_batch` | errors, warnings, completeness | counts, then the first ten errors with paths |
| `diff` | `edit_my_trip {preview}`, `diff_batch` | ops or changes in words, before and after | one line per change |

## 4. Worked payloads

All examples are illustrative shapes with synthetic values; the field lists are the projections of the API read models.

### 4.1 Trip card (`get_public_trip`)

```json
{
  "content": [
    { "type": "text", "text": "**Canadian Rockies, 14 days** (best mid-Sep). Bases: Canmore 4 nights, Lake Louise 4, Jasper 5. Parks: Banff, Yoho, Jasper, Kananaskis. Highlights: Moraine Lake, Larch Valley, Maligne Canyon. Effort: moderate; suits ages 6+. 5 things to book ahead.\nOpen: https://travel-beta-tan.vercel.app/trips/canadian-rockies-sept-2029/" },
    { "type": "resource_link", "uri": "https://travel-beta-tan.vercel.app/trips/canadian-rockies-sept-2029/", "name": "Canadian Rockies trip page", "mimeType": "text/html" }
  ],
  "structuredContent": {
    "view": {
      "schema": "travel-view/1", "kind": "trip_card", "title": "Canadian Rockies, 14 days",
      "lead": ["length", "season", "bases", "parks", "highlights"],
      "honesty": [{ "id": "drive_estimated", "label": "Some drive times are estimates" }],
      "actions": [
        { "label": "Show day 1", "tool": "get_day", "arguments": { "slug": "canadian-rockies-sept-2029", "day": 1 } },
        { "label": "What to book", "tool": "trip_bookings", "arguments": { "slug": "canadian-rockies-sept-2029" } },
        { "label": "Copy to my trips", "tool": "copy_trip", "arguments": { "source_trip": "canadian-rockies-sept-2029" }, "needs": "plans_propose" }
      ],
      "links": { "page": "https://travel-beta-tan.vercel.app/trips/canadian-rockies-sept-2029/" }
    },
    "data": {
      "slug": "canadian-rockies-sept-2029", "title": "Canadian Rockies", "nights": 13, "days": 14,
      "season": { "months": [9], "label": "Mid-September", "why": "larches turn; shuttles still run" },
      "bases": [{ "name": "Canmore", "nights": 4 }, { "name": "Lake Louise", "nights": 4 }, { "name": "Jasper", "nights": 5 }],
      "parks": [{ "slug": "banff-national-park", "name": "Banff National Park", "days": [3, 4, 5, 6, 7, 8] }],
      "highlights": ["Moraine Lake", "Larch Valley", "Maligne Canyon"],
      "effort": "moderate", "ageFit": 6, "toBookAhead": 5
    },
    "revision": "9f2c...e1"
  }
}
```

### 4.2 Day timeline (`get_day`)

```json
{
  "view": { "schema": "travel-view/1", "kind": "day_timeline", "title": "Day 4: Moraine Lake and Larch Valley",
    "lead": ["items"], "honesty": [{ "id": "estimate", "label": "Times are suggestions" }],
    "actions": [{ "label": "Map of this day", "tool": "get_day", "arguments": { "slug": "canadian-rockies-sept-2029", "day": 4, "include": ["map"] } }],
    "links": { "page": "https://travel-beta-tan.vercel.app/trips/canadian-rockies-sept-2029/#day-4" } },
  "data": {
    "day": 4, "base": "Lake Louise", "driveMin": 35, "driveIsEstimate": false,
    "items": [
      { "time": "07:30", "name": "Parks Canada shuttle to Moraine Lake", "kind": "booking", "booking": "Opens 2 days before Day 4 at 08:00 local" },
      { "time": "08:15", "name": "Larch Valley", "placeSlug": "larch-valley", "kind": "trail", "durationMin": 240,
        "stats": { "distanceKm": 8.6, "gainM": 535 }, "suit": ["From about 7", "Moderate"] },
      { "time": "13:00", "name": "Moraine Lake shoreline", "placeSlug": "moraine-lake", "kind": "lake", "durationMin": 60 }
    ],
    "variants": [{ "key": "B", "label": "Easier", "title": "Moraine shoreline and Consolation Lakes" }]
  }
}
```

### 4.3 Map (`get_day {include: ["map"]}`, `near`)

```json
{
  "view": { "schema": "travel-view/1", "kind": "map", "title": "Day 4", "lead": ["points"],
    "honesty": [{ "id": "location_unconfirmed", "label": "1 pin is approximate" }], "links": { "page": "https://travel-beta-tan.vercel.app/trips/canadian-rockies-sept-2029/#day-4" } },
  "data": {
    "bbox": [-116.24, 51.30, -116.15, 51.44],
    "points": [
      { "id": "larch-valley", "name": "Larch Valley trailhead", "lat": 51.3217, "lon": -116.1862, "approx": false, "role": "trailhead", "kind": "trail", "order": 2, "url": "https://travel-beta-tan.vercel.app/places/larch-valley/" }
    ],
    "lines": [
      { "id": "leg-4-1", "kind": "leg", "encoding": "polyline5", "line": "_p~iF~ps|U_ulLnnqC", "approxShape": false }
    ],
    "attribution": ["© OpenStreetMap contributors", "routing: openrouteservice"],
    "linesIncluded": true
  }
}
```

Rules: coordinates are ours (never Google, T5); approximate points say so and are never used for a distance; track
geometry comes with its licence and attribution and only when asked (`include: ["map"]`, the 64 KB cap); a map is never the
only place a fact appears (T2).

### 4.4 Booking list (`trip_bookings`; on a dated copy, `get_my_trip {include: ["bookings"]}`)

```json
{
  "view": { "schema": "travel-view/1", "kind": "booking_list", "title": "What to book for the Canadian Rockies",
    "lead": ["groups"], "count": { "shown": 9, "total": 9, "nextPage": null },
    "honesty": [{ "id": "pattern_2026", "label": "Windows follow the 2026 pattern" }],
    "links": { "page": "https://travel-beta-tan.vercel.app/trips/canadian-rockies-sept-2029/#bookings", "print": "https://travel-beta-tan.vercel.app/trips/canadian-rockies-sept-2029/print/" } },
  "data": {
    "toBookAhead": 5,
    "groups": [
      { "kind": "booking", "label": "Book ahead", "rows": [
        { "name": "Moraine Lake shuttle, Day 4", "rule": "Opens on a launch day each year, usually in April, at 08:00 local; then 2 days before Day 4 at 08:00 local",
          "link": "https://reservation.pc.gc.ca/", "park": "Banff National Park", "read": "2026-10-20" } ] },
      { "kind": "pass", "label": "Passes", "rows": [
        { "name": "Parks Canada Discovery Pass", "rule": "Buy any time before Day 1", "covers": ["Banff", "Yoho", "Jasper"], "read": "2026-10-20" } ] },
      { "kind": "check", "label": "On the day", "rows": [
        { "name": "Lake Louise lakeshore parking", "rule": "No reservation; lot fills before sunrise" } ] }
    ]
  }
}
```

On a user's **dated** copy (private), each booking row adds `"due": "2029-04-..."` computed by `core/src/bookings`; public
trips never carry a date (dateless rule).

### 4.5 Date picker (`copy_trip` without `start`)

```json
{
  "view": { "schema": "travel-view/1", "kind": "date_picker", "title": "Pick Day 1 for your copy",
    "lead": ["recommended"], "actions": [{ "label": "Use 8 Sep 2029", "tool": "copy_trip",
      "arguments": { "source_trip": "canadian-rockies-sept-2029", "start": "2029-09-08" }, "needs": "plans_propose" }],
    "links": { "page": "https://travel-beta-tan.vercel.app/trips/canadian-rockies-sept-2029/" } },
  "data": {
    "year": 2029, "lengthDays": 14,
    "allowedMonths": [6, 7, 8, 9],
    "recommended": [{ "from": "2029-09-08", "to": "2029-09-21", "why": "larches turn mid-September" }],
    "avoid": [{ "from": "2029-10-14", "to": "2029-12-31", "why": "Moraine Lake Road closes in mid-October" }],
    "constraints": [{ "kind": "booking", "text": "Moraine Lake shuttle launch day is usually in April" }],
    "default": null
  }
}
```

With the 2026-07-28 multi round-trip pattern, `copy_trip` without `start` may answer `resultType: "input_required"` with a
date input request when the client declares support; otherwise it answers this payload and the copy is created dateless
("No date" in Mine) only when the user confirms. The year is the user's own input; it is never stored on a public object.

## 5. MCP Apps views (M3)

| View | Resource | Tools that declare it | Data source | Calls back |
|---|---|---|---|---|
| Trip card | `ui://travel/trip-card` | `get_public_trip`, `get_my_trip`, `copy_trip` | the tool result | `get_day`, `trip_bookings`, `copy_trip` (level permitting) |
| Day timeline | `ui://travel/day-timeline` | `get_day` | the tool result | `get_place`, `edit_my_trip` (preview only) |
| Map | `ui://travel/map` | `get_day`, `near`, `trip_legs` | the tool result (points, polylines) | `get_place` |
| Booking list | `ui://travel/booking-list` | `trip_bookings`, `place_needs` | the tool result | none |
| Date picker | `ui://travel/date-picker` | `copy_trip`, `edit_my_trip` | the tool result | `copy_trip`, `edit_my_trip` with `set_start` |

| Rule | Detail |
|---|---|
| Built in `web/` | `web/mcp-views/**`, one static bundle per view, the design system tokens from `themes.css`, light and dark from `HostContext.theme`, host CSS variables as fallbacks; design review then verifier like any UI (P1 to P9, T1 to T5); not "new HTML" outside the web app |
| Data in, not fetched | a view renders the tool result it is given (`ui/notifications/tool-result`); `connectDomains` is empty except the map view's tile host; `resourceDomains` lists our origin (photo renditions, IMG-1) and the tile host |
| Map | MapLibre with the globe's tile source; never Google Maps JS in a view (key exposure, terms) |
| Calls | only tools of the same server that the connected level may call (`_meta.ui.visibility` `["model","app"]`); app-only helpers none in v1 |
| Model context | a view may set `ui/update-model-context` with the user's selection (a day, a date), never household data the user did not enter |
| Size | each view at most 150 KB gzip; the map view 350 KB |
| Fallback | every tool returns the same text and structured payload with or without the view |
| Security | no `innerHTML` from data; strings escaped; untrusted text shown as text; CSP as declared; the R-252 grep test covers the view bundles |

## 6. Responsiveness rules

| Rule | Value |
|---|---|
| Text rendering | at most 1,200 characters; answer first |
| Default structured size | 16 KB; hard cap 64 KB (`too_large` with a narrowing hint) |
| Lists | 10 rows by default, 25 at most; `count` always present |
| Drill-down | detail, day, map, bookings, facts are separate calls; summaries name the next call in `actions` |
| Latency target | p95 under 800 ms for catalogue read tools (served from `JsonStore` or the edge cache), under 2 s for writes |
| Caching | `tools/list`, `resources/list`, `resources/read` carry `ttlMs` and `cacheScope` (2026-07-28); public reads `ttlMs` 60,000, `cacheScope: "public"`; private `cacheScope: "private"` |
| Order | `tools/list` in a deterministic order (2026-07-28 minor change 3) |

## Sources (read 26 Oct 2026)

- MCP 2026-07-28 changelog: https://modelcontextprotocol.io/specification/2026-07-28/changelog
- MCP Apps specification (stable 2026-01-26): https://github.com/modelcontextprotocol/ext-apps (`specification/2026-01-26/apps.mdx`)
- MCP Apps API overview and host list: https://apps.extensions.modelcontextprotocol.io/api/
- MCP Apps overview: https://workos.com/blog/2026-01-27-mcp-apps
- ChatGPT Apps SDK changelog: https://learn.chatgpt.com/apps-sdk/changelog
- OpenAI developer forum (Apps SDK reports): https://community.openai.com/c/chatgpt-apps-sdk/42

## Change log

- 26 Oct 2026: written (travel-planner, Opus 5.5).
