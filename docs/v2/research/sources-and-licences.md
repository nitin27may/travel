# Sources and licences

Status: draft (17 Oct 2026). Not legal advice; take advice before selling data or a paid product.

The catalog will grow into a product, so what we store must be ours to store. The rule of thumb: **facts
are not copyrightable, wording and databases can be.** We store facts in our own words with their
source, store open data under its licence in a separable layer, and link to everything else.

## 1. Source kinds

| Kind | Examples | Evidence confidence | May we store? |
|---|---|---|---|
| Official | park agencies, governments, land managers, UNESCO, meteorological services | `official` | facts in our words; their open data under its licence (Parks Canada open data, OGL-CA; swisstopo; NPS public domain) |
| Operator | the business running the activity, hotel, shuttle, restaurant | `operator` | facts in our words; short exact phrases for rules and limits |
| Reference | Wikidata, OpenStreetMap, geoBoundaries, OurAirports, GeoNames | `official` for identity and geometry purposes only | yes, under their licences (below) |
| Community | blogs, forums, trip reports, clubs, local press | `community` | dated observations in our words; never text |
| Media | Wikimedia Commons, agency photo libraries | n/a | link (Commons thumbnails) with attribution; agency public-domain images may be copied |
| Agent | computed by the runner (sun, doubled distance, Naismith time) | `agent_inferred` | yes; the method goes in the quote |

## 2. Licences we handle

| Source | Licence | What it means for us |
|---|---|---|
| **OpenStreetMap** | ODbL 1.0 | Share-alike for databases. Geometry and ids from OSM live in their own layer (`track.source = osm`, `entity.osm_ref`, OSM-derived points flagged by evidence source). If we publish a database **derived** from OSM, that derived database must be offered under ODbL. Keep our own facts (descriptions, parking fill times, limits) in separate tables so the catalog is a collective database with OSM as one separable part. Attribution "© OpenStreetMap contributors" wherever OSM data is shown. Decide before any data export or sale (open question 3) |
| **Wikidata** | CC0 | free to use; we still record the QID as the source |
| **Wikipedia** | CC BY-SA | text is never copied; facts paraphrased with a link |
| **Wikimedia Commons** | per file (CC BY, CC BY-SA, CC0, public domain) | link with attribution shown; reject non-free; licence from metadata only |
| **geoBoundaries** | CC BY 4.0 (most layers; check per country) | attribution on the about-data page |
| **OurAirports** | public domain | free |
| **Parks Canada open data** | Open Government Licence - Canada | attribution "Contains information licensed under the Open Government Licence - Canada" |
| **NPS** | public domain (most content) | free; credit as courtesy |
| **swisstopo** | open (OGD) | attribution |
| Operator and agency web pages | copyright | facts only, our words, short quotes for exact rules |

## 3. Never store

| Source | Why | What instead |
|---|---|---|
| **Google Maps, Places, Street View** | terms forbid storing content (place details, reviews, photos, ratings) beyond narrow caching | link to Google Maps by place name or our coordinates; navigation deep links built at render time |
| **AllTrails, Komoot, Gaia, Outdooractive, Wikiloc** | terms forbid scraping and reuse | `entity_link` with `link_only = true`; figures come from official sources |
| **TripAdvisor, Yelp, Booking.com, Expedia** content | terms and copyright | links only; never ratings, review text or prices |
| Paywalled guidebooks | copyright | facts verified elsewhere |
| Personal data in sources (names in trip reports, photos of people) | privacy | omit |

## 4. The paraphrase rule

- `quote` on evidence: our own words, at most 300 characters, or a short exact phrase in quotation marks
  when the precise wording matters ("Minimum age 12, minimum weight 40 kg").
- Summaries are written fresh from several sources; never a lightly edited copy of one.
- Lists copied wholesale from a source (a park's full trail table) are a database extraction concern:
  take the facts we need per entity, with evidence per entity, rather than mirroring the table.

## 5. Attribution in the product

- An **About the data** page lists every source licence in use and the OSM, OGL and CC BY attributions.
- Each image shows its author and licence; each entity page shows its sources with read dates.
- Map tiles carry their own attribution (OpenFreeMap / OpenStreetMap).

## 6. Robots, rate limits and politeness

Honour robots.txt and terms; one request at a time per host for scrapers and importers; a descriptive
user agent with a contact; caches for every fetched page so research never re-fetches the same page
within its freshness window. Commons: one runner, sequential, as in lanes/media.md.
