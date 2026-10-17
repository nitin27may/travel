---
type: idea
area: resources
status: draft
tags:
  - fun-project
  - travel-finder
  - ux-ui
  - design-system
  - nextjs
created: 2026-06-17
modified: 2026-06-17
---

# Travel Finder — UX & UI

> The full interface spec: a calm, Claude-style design language, the layout and global shell, and — the centerpiece — a search-and-filter system tuned so you **find what you're looking for in seconds**. Part of [[Travel Finder — Overview]].

## North star

> Drop your location, say or tap what you're in the mood for, and the right places surface immediately — sorted by how far you'd actually drive.

Three tenets:

1. **The location is the lens.** Everything is relative to where the user is.
2. **Finding beats browsing.** Search and filters are first-class, instant, and forgiving — not a buried sidebar.
3. **Calm, not busy.** Generous whitespace, one clear action per screen, content does the talking.

## Design language (Claude-inspired)

Warm, editorial, quiet. Built on Anthropic's brand tokens.

### Color

| Token | Hex | Use |
|-------|-----|-----|
| `bg` (Light) | `#faf9f5` | App background — warm ivory, not white |
| `surface` | `#ffffff` / `#f3f1ea` | Cards, panels (slightly raised off the ivory) |
| `fg` (Dark) | `#141413` | Primary text, dark sections |
| `muted` (Mid Gray) | `#b0aea5` | Secondary text, icons, dividers |
| `border` (Light Gray) | `#e8e6dc` | Hairline borders, subtle fills |
| `primary` (Orange/clay) | `#d97757` | Primary actions, active filters, the "you" pin, route lines |
| `accent-blue` | `#6a9bcc` | Water/swim category, secondary highlights |
| `accent-green` | `#788c5d` | Nature/trail category, success/"open now" |

Category colours map to the three accents + tints (waterfall/lookout = clay, water/beach = blue, trail/nature = green, indoor/culture = neutral). Keep the palette tight — colour carries meaning (category, distance heat), not decoration. **Dark mode:** invert to a warm charcoal (`#141413` base, ivory text), coral accent unchanged.

### Typography

- **Display / headings:** Poppins (Arial fallback) — geometric, friendly, confident.
- **Body / reading:** Lora (Georgia fallback) — a serif for descriptions and trip write-ups; gives the editorial, "trusted guide" feel.
- **Dense UI (filters, chips, tables, map labels):** a clean system/ui sans (e.g. Inter or the system stack) so controls stay crisp at small sizes — serif is for reading, not for a 12px filter label.
- Scale: a modular type ramp; large airy headings, comfortable 16–18px body, tight-but-legible UI text.

### Form & motion

- **Radius:** soft — 12–16px on cards/panels, pill (full) on chips, buttons, and the search bar.
- **Elevation:** barely-there. Hairline `border` + a soft, low shadow on raised surfaces; lean on the ivory/white contrast rather than heavy drop shadows.
- **Spacing:** an 8px base scale with generous section padding; let things breathe.
- **Motion:** quiet and purposeful — 150–250ms ease; map fly-to on location change, chips animate in/out, skeletons cross-fade to content. Honour `prefers-reduced-motion`.
- **Imagery:** photos sit in rounded frames with a subtle warm overlay so text stays legible; never let stock-y images dominate the calm.

## Information architecture

```
/                      Home / discover (the default experience)
/?lat&lng&r&q&tags…    Discover with state encoded in the URL (shareable)
/trips/[slug]          Trip detail
/places/[slug]         Place detail (also opens as a modal over discover)
/route                 Route builder (the tray expanded)
/regions/[slug]        Region landing (Durham, GTA…) — SEO entry points
/about, /llms.txt      Static + agent map (see [[Travel Finder — AI & Agent Readiness]])
```

Discover is the home. Everything else is reachable without leaving it (detail opens as a modal; the route tray is persistent).

## Global shell

A single calm app shell wraps everything:

```
┌──────────────────────────────────────────────────────────────┐
│  ◳ TravelFinder   [ 📍 Toronto, ON ▾ ]   [ 🔎 search anything… ]   ⟡route(3)  ☾ │
├──────────────────────────────────────────────────────────────┤
│  (persona chips)  (Family) (Hiker) (Foodie) (Relaxed) (Accessible)             │
│  (active filters) ⏱≤2h ×   🏷 waterfall ×   💧 swim ×        Sort: drive-time ▾ │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│                    ⟨ Cards | Map | Split ⟩  view               │
│                         …results…                              │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

- **Logo / home** (left). **Location control** — the most important control, always visible. **Omnisearch** — wide, central, pill-shaped. **Route tray** — a counter that expands a drawer. **Theme toggle**.
- Below the bar: **persona quick-starts** (one tap reshapes the catalogue) and the **active-filter chip bar** with a sort control on the right.
- On scroll, the bar condenses to a slim sticky strip (location + search + filter count) so the controls are never more than a glance away.

## First-run / home experience

The first visit must answer "what is this and what's near me?" in one screen:

1. A warm one-line value prop and a single prominent **"Set your location"** action (address autocomplete, "use my location," or a map pin). Until set, default to a sensible region (Durham/GTA) clearly labelled "showing GTA — set your location."
2. **Persona quick-starts** as big, inviting chips — tapping "Family with kids" instantly shows family-friendly spots sorted by distance.
3. **"Good right now"** — a season/weather-aware strip (tubing open, fall colours, splash-pad weather) so there's always a timely answer.
4. A few **featured trips** and, on return visits, **recently viewed** (stored locally, no account).

## Discovery experience

One result set, three ways to see it (toggle persists in the URL + localStorage):

- **Cards** (default on mobile): a responsive grid of scannable cards. Card anatomy: photo, name, **drive-time badge** (clay), 2–3 vibe/feature tags, cost tier, kid/accessibility icons, a star-to-route button. Designed to answer "is this for me?" at a glance.
- **Map** (default on desktop wide): MapLibre vector map, pins clustered and colour-coded by category, the user's origin marked in clay. Interactions: click cluster to zoom, click pin to peek a mini-card, **"Search this area"** button appears when the map is panned, optional **radius ring** the user can drag to set the drive-time budget visually.
- **Split**: list + map side by side, fully synced — hover a card → its pin lifts and glows; click a pin → its card scrolls into view.

Sort options: **drive-time** (default), best-season-fit, most-loved, recently-added. Results stream in (Suspense) so the first cards paint instantly.

## Finding easily — the search & filter system (centerpiece)

This is the part that earns the product. The goal: **express intent fast, in whatever form is natural, and never hit a dead end.**

### Omnisearch / command bar

- One wide, pill search that accepts **places, trips, tags, regions, and intent** — typeahead groups results by kind ("Places", "Trips", "Tags", "Regions") as you type, with fuzzy matching (`pg_trgm`) so typos still land.
- **Light natural-language parsing:** typing "waterfall near Ajax for kids under 2 hours" resolves into **filter chips** (`feature: waterfall`, `origin: Ajax`, `audience: kids`, `drive-time ≤ 2h`) the user can see and tweak — the query becomes visible, editable state, not a black box.
- Keyboard-first: `/` or `⌘K` opens it as a command palette; arrow-keys + enter to pick; recent searches remembered.

### Faceted filters

Filters live as a **chip bar** (active filters, each removable) backed by a **filter panel** (drawer on mobile, popover on desktop). Facet groups:

- **Distance:** drive-time radius slider (the primary filter), or "within X min."
- **What:** category/feature tags — waterfall, lookout, cave, beach, splash-pad, trail, museum, market…
- **Vibe:** relaxing, adventure, scenic, romantic, super-fun.
- **Who:** family/kid-age, accessible (wheelchair/stroller), pet-friendly, group.
- **How:** difficulty, indoor/outdoor, transit-accessible, dog-allowed.
- **When:** season / "open now" / good-this-weekend.
- **Cost:** free → splurge tier.

Principles: **show counts** next to each option ("Waterfall (12)"), **never zero-out the world** silently, collapse advanced facets behind "More filters," and make every filter a removable chip so the current query is always legible.

### Persona quick-starts

One-tap presets that set a sensible bundle of facets (defined in [[Travel Finder — Data Model]]): *Family with young kids, Hardcore hiker, Foodie weekend, Relaxed/slow, Accessible day out, Rainy-day rescue.* A starting point — every preset is fully adjustable after.

### State, sharing, and recovery

- **URL is the single source of truth** for location + query + filters + view + sort — so any view is shareable, bookmarkable, and reloads identically. (Also the basis of the public API in [[Travel Finder — AI & Agent Readiness]].)
- **Recents & saved (no account):** recent searches and a local "shortlist" in localStorage; accounts (later) just sync these.
- **Zero-result rescue:** never a dead end. If nothing matches, show the nearest near-misses with the offending chip highlighted ("nothing with *all* of these within 1h — drop 'cave' or widen to 1h30?") and one-tap loosen actions.

```
┌── Filter panel (drawer) ─────────────┐
│ Drive-time   ◉────────●──  ≤ 1h30     │
│ What         ☑ Waterfall(12) ☐ Cave(3)│
│ Who          ☑ Kid-friendly  ☐ Pets   │
│ When         ◉ Open now  ○ This w/end │
│ Cost         ●─── Free–$$             │
│ [ More filters ▾ ]      [ Clear all ] │
└──────────────────────────────────────┘
```

## Detail pages

- **Trip detail:** hero photo, at-a-glance facts, day-by-day stops (ordered), hour-by-hour itinerary, reservations/gotchas, cost + season, a **"last verified"** date (trust + accuracy), and **"add all stops to my route."**
- **Place detail:** categories/tags, kid + accessibility info, **nearby / cool-down / rainy-day-backup** links (from the place graph), booking info, distance-from-you when an origin is set.
- Detail opens as a **modal over discover** (intercepting route) so context isn't lost; a hard navigation/refresh renders the full standalone page (good for sharing + SEO).

## Route / multi-point builder

The "graphical relation across multiple points" feature.

1. **Tray:** star places from anywhere into a persistent "My route (n)" tray.
2. **Auto-sequence:** nearest-neighbour ordering over the `place_edges` graph from the user's origin, so the day doesn't backtrack; drag to reorder manually.
3. **Two views:** a **map polyline** with per-leg drive-times, and a small **node-link graph** showing how stops connect (which pairs are combinable) — for seeing alternatives, not just one line.
4. **Export / share:** Google Maps multi-waypoint link (origin = the user's location), a `make_maps.py`-shaped My Maps CSV that round-trips into the vault, and a shareable route URL.

## Responsive & mobile

- **Mobile:** cards by default; a **bottom-sheet** pattern over a full-screen map (drag the sheet up for the list, down for the map) — the standard map-discovery interaction. Filters open as a full-height drawer; a floating "Map/List" FAB toggles modes. Controls sit in thumb reach.
- **Tablet:** split view becomes available.
- **Desktop:** split is the power view; map and list share the canvas.

## States (don't skip these)

- **Loading:** skeleton cards + a shimmering map; stream real results in (RSC + Suspense).
- **Empty / zero-result:** the rescue flow above — never a blank page.
- **No location set:** clear "showing GTA — set your location for distances" banner.
- **Error / offline:** friendly retry; cached last results where possible; the map degrades to a static region image.
- **Slow network:** drive-times fill in progressively (straight-line first, real drive-time when the cached Matrix result lands).

## Accessibility

Semantic HTML, full keyboard nav (search palette, filter chips, map controls), visible focus, ARIA for the map and live result-count updates, WCAG-AA contrast (the warm palette must still pass), and `prefers-reduced-motion` honoured. Accessibility filters (wheelchair/stroller) are a feature *and* the site itself is accessible.

## Next.js implementation notes (App Router)

- **Route structure** with parallel + intercepting routes so discover hosts both panes and modal detail:
  ```
  app/
    layout.tsx                  # shell: header, location, omnisearch, theme
    (discover)/
      layout.tsx                # filter bar + view toggle
      @list/page.tsx            # list pane (RSC, reads searchParams)
      @map/page.tsx             # map pane (client island)
      page.tsx                  # composes the panes by view mode
      @modal/(.)places/[slug]/page.tsx   # place detail as intercepted modal
    trips/[slug]/page.tsx       # full trip page (SSR, SEO, JSON-LD)
    places/[slug]/page.tsx      # full place page
    regions/[slug]/page.tsx     # region SEO landing
    api/…                       # public read API (see AI note)
  ```
- **searchParams as state:** location/query/filters/view/sort live in the URL. Server Components read them and run the spatial query server-side; the client updates the URL (shallow) on filter changes — no global client store needed.
- **RSC by default, client islands where needed:** list, cards, detail = Server Components (fast, SEO-friendly, stream via Suspense). Client islands: the **map** (MapLibre), the **omnisearch/command palette**, **filter controls**, and the **route tray**.
- **Data:** typed Supabase queries / RPCs (`places_near`, `build_route`) with Zod-validated DTOs shared with the ingestion contract.
- **UI kit:** shadcn/ui + Tailwind, with the Claude tokens wired as CSS variables, e.g.
  ```css
  :root{ --background:#faf9f5; --foreground:#141413; --primary:#d97757;
         --muted:#b0aea5; --border:#e8e6dc; --radius:14px; }
  ```
- **Polish:** `next/image` for photos, the View Transitions API for card→detail morphs, `next/font` for Poppins/Lora.

## Component inventory (first pass)

`AppShell` · `LocationControl` (autocomplete + geolocate + pin) · `OmniSearch`/`CommandPalette` · `FilterBar` (chips) · `FilterPanel`/`Drawer` · `PersonaChips` · `ViewToggle` · `ResultsGrid` + `PlaceCard` · `DiscoveryMap` + `MapPin`/`Cluster` · `MiniCard` (map peek) · `SortMenu` · `TripDetail` · `PlaceDetail` · `RouteTray` · `RouteMap` + `RouteGraph` · `ExportMenu` · `EmptyState` · `Skeletons` · `SeasonStrip` ("good right now").

## What this adds over the first draft (gaps closed)

The earlier version had the hybrid view, search, route builder, and accessibility. This pass adds the missing scaffolding: a concrete **Claude design language**, the **global shell + IA**, a **first-run/home** experience, the **omnisearch + natural-language → chips** model, **persona quick-starts**, **zero-result rescue**, **map "search this area" + radius ring**, full **mobile bottom-sheet** patterns, **loading/empty/error/offline states**, **motion**, and the **Next.js route structure** (parallel + intercepting routes, searchParams-as-state, RSC vs client islands).

## Open questions

- Default landing view — cards (approachable) or map (signals "tool")?
- How smart should NL search be in v1 — keyword + fuzzy + a few parsed patterns (cheap, no LLM), or wait for the MCP/agent layer for true NL?
- Graph view weight — a real node-link diagram, or just "combinable nearby" chips on cards to start?
- Serif body (Lora) everywhere vs. serif for reading + sans for dense UI — confirm legibility on filter/map text.
- Light-only for v1, or ship dark mode from the start?
