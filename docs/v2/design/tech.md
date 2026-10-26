# Rendering and interaction technology (working draft)

> **Amended 25 Oct 2026 (requests and custom places):** map stack job 3 ("Find a place by name") is refined: our
> catalogue, then our towns layer, then Google Places autocomplete through a signed-in server route (owner decision
> 25 Oct, Q210: 10 to 20 users, free monthly usage) with openrouteservice, then Photon, as the switchable fallback.
> Google terms hold: only `place_id` is stored, no Google names or coordinates in our data, results never on MapLibre
> maps. Nominatim stays a research resolver only, because its usage policy forbids type-ahead. See [requests-and-custom-places.md](../features/requests-and-custom-places.md) section 4.3 (PLAN R-174).

Chosen to make the interactions in interactions.md fast on a mid-range phone. Versions checked on the
npm registry on 17 Oct 2026 (the prototype pins versions at least two weeks old).

| Need | Choice | Alternatives considered | Why |
|---|---|---|---|
| Map rendering | **MapLibre GL JS** (6.x; prototype 6.11.2) | Mapbox GL (licence, per-load cost), Leaflet (raster-first, weaker for vector styling and smooth zoom), deck.gl (for heavy data layers; not needed) | WebGL vector rendering, smooth fly-to, terrain and hillshade, globe, open source; already pinned in the repo plan. v6 is ESM-only |
| Basemap tiles (app) | **OpenFreeMap** vector tiles (free, no key) online; **Protomaps PMTiles** extracts for offline trip areas | Mapbox, MapTiler (keys and quotas) | free, OpenStreetMap-based, offline-capable |
| Terrain | AWS open terrain tiles (Terrarium) for hillshade and elevation profiles; Mapterhorn later | Mapbox terrain | free; the prototype renders its own relief from them |
| Pins and labels | MapLibre **symbol and circle layers** fed by one GeoJSON source per trip (fast for hundreds of pins); **HTML markers only for the few interactive ones** (selected, base, dragged) | all HTML markers (slow past ~100) | GPU rendering for the many, DOM flexibility for the few |
| Drag and drop | **dnd-kit** (core + sortable) | Atlassian Pragmatic drag and drop (smaller, built on native HTML5 drag, weaker touch and custom overlays), react-beautiful-dnd (deprecated) | pointer, touch and keyboard sensors, custom drag overlay, sortable lists across containers, accessible announcements |
| Layout animation | **Motion** (`motion/react`, layout animations, springs) | React `<ViewTransition>` / View Transitions API (snapshots, not interruptible mid-flight) | reorder and move animations must be interruptible during drag; View Transitions are kept for page-level navigation |
| Bottom sheet (phone) | own component on Motion drag with three snap points | Vaul (maintenance unclear; shadcn moved to Base UI's drawer), Base UI Drawer | the map sheet needs custom snap behaviour and must coexist with map gestures |
| Predictive search | local index in memory: normalised (diacritics removed) prefix + trigram scoring, < 5 ms for 5,000 places; server search (Postgres trigram + full text) for the wider catalog, debounced 150 ms | Fuse.js, MiniSearch | tiny, predictable ranking that we control (trip first, then near base) |
| Ordering | **fractional-indexing** keys | integer positions | moves never renumber siblings; collaborators rarely collide |
| Distances | leg cache (server), straight-line × terrain factor as instant estimate; OpenRouteService for routed values | client-side routing | the UI never waits on the network |
| Virtualisation | TanStack Virtual for long day lists (14 nights × 3 tracks) | none | keeps a long trip at 60 fps |
| Gestures | Pointer Events everywhere; long-press 300 ms on touch | Hammer.js | native, no dependency |
| Haptics | `navigator.vibrate(8)` on lift where supported (Android); nothing on iOS web | | small, optional |

## Performance budget

- Plan screen interactive in < 2 s on a mid-range phone for a 14-night trip; drag at 60 fps; search
  results in < 16 ms locally.
- JavaScript for the plan screen under ~350 KB gzipped (MapLibre is the bulk, loaded in parallel).
- Map: one GeoJSON source updated with `setData` on change (MapLibre's `updateData` for partial updates
  on large trips).

## Map stack, in plain terms (18 Oct 2026)

"The map" is four separate jobs; each can come from a different provider.

| Job | What it does | Choice | Why not Google |
|---|---|---|---|
| 1. Draw the map | the picture: roads, terrain, labels; pins and routes drawn on top | **MapLibre** (renderer) + **OpenFreeMap** tiles online, **Protomaps PMTiles** for offline, terrain from open DEM tiles | Google's tiles cannot be downloaded for offline use, and its terms do not allow Google content (place details, routes) to be shown on a non-Google map |
| 2. Distances and drive times | A→B time and km, and matrices for "rank by drive time" | instant straight-line estimate on screen, then **OpenRouteService** (free key, daily quota) behind our leg cache; later **self-hosted OSRM or Valhalla** for the regions we use | Google Routes is accurate but paid per call after the free monthly allowance, and results may only be cached briefly, so every trip re-pays |
| 3. Find a place by name | search box, pasted addresses | our **catalog first**, then **Photon/Nominatim** (OpenStreetMap geocoders), **Wikidata** for named sights | Google Places has the best coverage of restaurants and shops, but its data cannot be stored (only the place id), so it cannot feed the catalog |
| 4. Hand-off to navigation | "Navigate" on the phone | **links that open Google Maps or Apple Maps** with the destination; free, no key, allowed | this is where Google is used, and only as a link |

The prototype's map is a stand-in for job 1: our own relief image, because the published preview
cannot load tiles from the internet. On the real app job 1 is OpenFreeMap vector tiles.

Known gap: OpenStreetMap is strong for trails, peaks, parking, huts and roads, and weaker than Google for
restaurant and shop details (hours, photos, reviews). The plan accepts that (07-competitors.md 5): such
places are added by link or by hand.
