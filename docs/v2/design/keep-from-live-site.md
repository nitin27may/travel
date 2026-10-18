# Keep from the live site (owner, 18 Oct 2026)

The owner said that https://nks-travel.pages.dev/trips/, /places/ and /globe/ "look good for the end user who has to search an existing trip, see all details and the globe… don't lose the good stuff". The redesign and the prototype must keep everything below.

The colours are the one open point. The owner earlier rejected the deep-green look, but he likes these pages. So one redesign direction must be an evolution of this look, and he chooses.

Screenshots taken 18 Oct 2026 are in [live-site/](live-site/): trips.png, places.png, places-table.png, places-list.png and globe.png.

## Trips (/trips/)

- **Real hero photographs on every card**, not patterns.
- A display title per card: condensed signpost type, two lines when long.
- Dates, nights and where the trip goes in small mono type under the title.
- A countdown chip ("In 119 days") and a link chip ("Legacy page").
- A one-sentence editorial summary in a reading serif.
- Search with the `/` shortcut, and a live count ("14 trips").
- Filters as pills (When, Source).
- **Group by** and **Sort by** with a direction toggle; groups such as Upcoming and Past have a heading and a count.
- **Four views on one data set: Cards, List, Table, Map.** The selected view is a solid accent segment.
- The top bar keeps the brand on the left, simple section tabs (Trips, Places, Globe, About the data) with an underline for the current one, and a theme toggle.

## Places (/places/)

- **Filter pills for each dimension:** Country, Kind, Status, Kids, Season, Tag and Plan. Each opens a menu.
- Cards show a photo, or a kind glyph when no photo exists.
- Each card has its area chain ("Banff National Park, Alberta, Canada").
- Chips per card:
  - kind, with an icon and colour
  - status: Planned, or Idea with a dashed outline
  - season months
  - Kid friendly or Strong kids only
- Honesty markers on the cards: "Location unconfirmed", "Unverified", "No source yet", and source counts ("Instagram post +1").
- Footer links on each card: Place page and Globe.
- **Grouped by country** with a sticky group header and a count.
- **Table view:**
  - Saved views, a Columns chooser, a density toggle ("Comfortable rows") and Export CSV.
  - Collapsible country groups.
  - Columns: kind with icon, status dot, region, area, season, kids, elevation (right-aligned) and sources.
- Map view, with URL state, so a filtered view can be shared.

## Globe (/globe/)

- **A 3D globe with relief.** Drag to spin, scroll to zoom, hover a country for facts, click to fly in. The drill goes country, then state, then district.
- A style switcher (Relief, Light, Dark), a 3D Terrain toggle with a relief strength slider, and Auto-spin.
- Saved-place pins; the side panel shows saved places by country, with flags and counts.
- Search for a country, state, city, sea or mountain range, which flies to it.
- A breadcrumb chip ("World") and a hint bar ("drag to spin · scroll to zoom…").

## How the v2 product keeps them

- **Trips home** keeps cards, list, table and map, with group, sort and search, and the cards keep photos and countdowns. The trip-scope rules add the household's deadlines on top ([trip-scope-scenarios.md](trip-scope-scenarios.md)).
- **Explore/Places** keeps the filter-pill set, the honesty markers, the table tools (saved views, columns, density, CSV), the grouping and the four views.
- **The globe** stays as the way into the catalog and as the cover of the travel year. The trip map and the globe use the same basemap family (OpenFreeMap and Mapterhorn).
- **Discover/public trips** use the same card anatomy as Trips.
