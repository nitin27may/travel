# Rendering and interaction technology (working draft)

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
