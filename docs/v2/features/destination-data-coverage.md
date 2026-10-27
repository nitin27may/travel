# Destination data coverage: tiers, country waves, legal sources and bulk ingestion

> **Amended 27 Oct 2026 (TB-FLOW):** the per-location metadata the builder reads, its true additions (two-level region groups with gateways and transport notes; `on_site_min` on towns) and the per-travel-region audit are in [trip-builder-location-metadata.md](trip-builder-location-metadata.md); DC-5 and TB-RG become one file `region-groups/1`. QB9 is decided no and QB3 is "research later" (owner, 27 Oct 2026): T0 records appear only in a "Not researched yet" group and never enter the engine (FLOW TF15).

Status: **planned only (docs), 27 Oct 2026.** Task DATACOVER-SPEC, planner (Opus). Nothing here is built.
Owner questions Q-DC1 to Q-DC8 are open (section 10).

Related pages, referenced and not repeated:
- [trip-builder.md](trip-builder.md): the builder flow (country, then regions, picks, days, bases, the algorithmic itinerary, day trips). This page defines the data that flow reads.
- [world-map-scratch.md](world-map-scratch.md): the scratch map. It reads only countries and regions, which every tier below includes.
- [nearby-and-regions.md](nearby-and-regions.md) 6: the first sketch of the builder and its "honest limits".
- [entity-graph.md](entity-graph.md): kinds, refs and relations.
- [protected-area-entry.md](protected-area-entry.md): park records and their entry rules.
- [stay-bases-and-optimisation.md](stay-bases-and-optimisation.md): bases.
- [trip-origin-and-nearest-airport.md](trip-origin-and-nearest-airport.md): airports.
- [catalogue-intake-and-storage.md](catalogue-intake-and-storage.md): the keep-or-drop rule and RowMeta.
- [public-ref-aliases.md](public-ref-aliases.md): no dated ids.
- [build/DATA-PLAN.md](../build/DATA-PLAN.md): the data seat's queue.
- [build/CATALOGUE-EARLY.md](../build/CATALOGUE-EARLY.md): Neon load and sizes.
- [research/method/capture-contract.md](../../../research/method/capture-contract.md) 3.7, 3.8 and 9: tiers, the trip-less lane, crawler rules.
- [research/method/sources-and-licences.md](../../../research/method/sources-and-licences.md).
- [research/method/relevance.md](../../../research/method/relevance.md): R6 and the fame signals.

## 0. Decision in one paragraph

**Breadth is cheap and depth is expensive, so we go broad on open data and deep only where the builder needs it.** Every country gets a map-level layer (T0) built mostly by script from Wikidata (CC0), OpenStreetMap extracts (ODbL, kept as a separable layer), GeoNames (CC BY) and OurAirports (public domain), ranked by open fame signals (Wikidata sitelinks and Wikipedia pageviews, never Google, Tripadvisor or AllTrails). Browsable depth (T1) and plan-ready depth (T2) are agent research at the measured 3 to 4 minutes per record, spent first where the builder ships.

**First slice:**
- Ontario, Quebec and the northern US states next to them (NY, VT, NH, ME, MA) to T2.
- Italy to T1, with two regions at T2.
- Canada country-wide to T1.

**Then:**
- Wave 1 is the top 25 countries by 2024 UN Tourism arrivals plus the six public-trip countries outside them, at T0.
- T1 comes per country when requests or visits justify it.
- Waves 2 and 3 (ranks 26 to 100) are T0 only.

Bulk records enter through the existing trip-less lane (`data/capture/catalogue/`) as `proposed` records. Their places are in the locations store's by-country layout with a new `listed` status. They are judged against their coverage tier, not the required tier. They are served from Postgres after CAT-1, never through the static build or a client-side index (P8, P9).

**Trade-off:** for months, most countries are T0 only. There the builder can draft a rough route with honest "Not researched yet" labels (P2, T3), but not a confident itinerary. That is the cost of not spending about 600 agent-hours on T1 for 28 countries before anyone asks for them.

## 1. Owner request, traced

> "To let anyone build their own trip anywhere, we need DATA at scale: choose 25 or 30 or 50, maybe 60 or even 100 most visited countries, and then the most visited places in each, plus hidden gems. We will start listing and scraping the data in such a way that we build on top of it." (owner, 27 Oct 2026)

| Need named by the owner | Where answered |
|---|---|
| Top 25 to 100 most visited countries | 4 (waves; sources cited, order only) |
| Most visited places per country | 2.2 (T0 quotas), 5.4 (fame signal) |
| Hidden gems | 5.4 (`gem_candidate` derived; public `hidden_gem` only after research, relevance 3.4) |
| Regions, grouped | 2.2, 6.2 step 1 (ISO 3166-2, region groups where first-level units exceed 25) |
| Places, sights | T0 |
| Trails, hikes | T1 |
| Activities and adventure offers (rafting, bungee) | T1: operators are read one page at a time. No open dataset lists them, so this is the slow part (6.6) |
| National, provincial and state parks with entry rules | T0 lists every national park; the entry rules are T2 (protected-area-entry) |
| Bases and lodging areas | T2 (stay-bases spec: base towns, never properties) |
| Airports | T0 reference layer (ORG-D, OurAirports), not capture records |
| Transport options | T2 per region: car needed or not, rail, ferry and shuttle stops (`access.transit.*`), and drive times by ORS matrix |
| "Listing and scraping ... build on top of it" | 5 (legal sources) and 6 (one repeatable runbook per country, idempotent runs, run records) |

## 2. Coverage model

### 2.1 Tiers

The tiers are cumulative. Each tier is defined by keys the existing contract already has (`data/vocab/types.json` marks, the property registry, the suitability and relevance sidecars, and the placement block). It is not a second schema (P9: one model).

| Tier | Name | A record has (all of the lower tiers plus) | Contract mapping | Who fills it |
|---|---|---|---|---|
| T0 | Map-level | `ref`, `type` (one of the 324 leaf ids), `layer`, `name`, `area_id`, a point (`coord_src` wikidata, osm or official; never Google), `osm_ref` and Wikidata QID (or a dated `searched_none` for each), one-line `summary` in our words, links (wikidata, wikipedia, osm, official P856 when present), fame signals, provenance per value with a `run` id | placement block (3.7.1), the Place required keys `links` and `summary`, `signals` in `relevance/signals/` | script; Sonnet for summaries; Opus for areas |
| T1 | Browsable | season or all year (`access_season` or `season`), the suitability profile's kid keys (`age_band`, `kid_note`, `stroller`, `wheelchair`: stated, `none_stated` or dated `searched_none`), `on_site_min` band, one photo or "No licensed photo yet", relevance `standing` and `draw`, at least one non-Wikimedia source (official or operator). Trails: distance, gain, time, effort with source grade, `starts_at`. Offers: `at`, `run_by`, season, minimum age as stated | suitability sidecar (profile R paths), relevance sidecar (derived plus judgement), enrichment tier for photos | Sonnet by contract; Opus sample |
| T2 | Plan-ready | the full required tier of 3.7.2 answered, plus: closures and opening season, durations, booking windows (`core/src/bookings`), entry requirements through the park graph (`requirementsOf`, protected-area-entry), the region's base towns with town facts, a drive-time matrix among bases and picks (ORS), a gateway airport (ORG-G), and a transport note per region | required tier (`gaps --tier required` empty), `access.pass.*` offers, `data/base-plans/`, ORS leg cache | Sonnet fills, Opus for hard limits and entry rules (never auto-accepted, 9.5) |
| T3 | Researched trip | a trip in `data/trips/<id>/` with days, schedule, windows and base plans | the `trip` skill | Opus |

**Record tier, region tier, country tier.**
- A record's tier is the highest tier whose keys are all answered. A gap is never a yes, but a dated `searched_none` counts as answered.
- A region is at tier Tk when it meets the quotas of 2.2 at Tk and every headline record in it (each national park and each UNESCO site) is at Tk.
- A country is at Tk when every region is. It is reported as, for example, "T0 country-wide, T2 in 3 of 13 regions".
- These are derived by one engine (DC-4, a `capture.ts coverage` command), never stored by hand.

### 2.2 Quotas per country at T0 and T1

Size classes:
- **S:** a city-state, a Special Administrative Region (HK, MO) or a country under 50,000 km².
- **M:** most countries.
- **L:** US, CA, CN, IN, BR, AU, MX, AR, CL, TR, FR, ES, ZA, plus RU if it is ever unblocked.

| Item | S | M | L | Source of the list |
|---|---|---|---|---|
| Regions (ISO 3166-2 first level; region groups when there are more than 25) | all | all | all | Wikidata P300, then DC-5 |
| Areas (cities, parks, valleys, lake districts, coasts) | 5 to 15 | 40 to 100 | 100 to 250 | Opus from the P131 chain, parks and towns |
| National parks (`nature.protected.national_park`) | all | all | all | Wikidata P31/P279* national park, IUCN P814; agency open data |
| UNESCO sites | all | all | all | Wikidata P757 |
| Other places by fame, per region, with type-family quotas (sights 40%, nature 40%, towns and cities 20%) | 30 to 60 | 200 to 300 | 400 to 800 | Wikidata and OSM, ranked by 5.4 |
| Airports (scheduled; reference rows, not records) | all | all | all | OurAirports (ORG-D) |
| **T0 records, total** | **40 to 80** | **250 to 400** | **500 to 1,000** (US about 1,200) | |
| Trails (T1) | 5 to 15 | 50 to 80 | 100 to 200 | agency lists, OSM `route=hiking` relations with `network=nwn/rwn` and a wikidata tag |
| Activity offers (T1): 1 to 3 operators per activity type per region | 5 to 15 | 30 to 60 | 60 to 150 | Overture places as a discovery list; operator pages read (6.6) |
| **T1 records, total** | **50 to 110** | **330 to 540** | **660 to 1,350** | |

T2 is sized per region, not per country: about 100 to 200 records at the full required tier, plus bases and the matrix.

### 2.3 What "enough data" means for the trip builder at each tier

The builder's 90% goal (P7) is "a credible draft of my trip, with day trips from sensible bases". What each tier supports:

| Builder step (trip-builder.md) | T0 | T1 | T2 |
|---|---|---|---|
| Country, then regions | yes | yes | yes |
| Picks: list, map pins, categories | names, types, pins, fame order; each labelled "Not researched yet" (P2, T3) | plus filter by season, kids and effort; photos | yes |
| Hidden gems shown as gems | no (internal `gem_candidate` only) | only those promoted by research | yes |
| Days: grouping picks into days | straight-line clusters (25 km), bands only | plus a time-on-site band | plus durations and closures |
| Bases | the towns layer only (largest towns near clusters) | same | researched base towns, fewer moves |
| Algorithmic itinerary | "Rough draft" only, every leg an estimate band, no booking warnings | draft with season and party fit | **confident itinerary**: drive times, entry rules, book-by dates, day trips from bases |
| Getting there | nearest airport (ORG) | same | gateway researched |

**"Enough" for a builder region (the T2 acceptance bar for a slice):**
- At least 25 plan-ready picks across at least 4 type families within 100 km of each proposed base.
- At least 2 base towns.
- A drive-time matrix among bases and picks.
- Every park in the region with its entry requirements answered or dated.
- 80% or more of the region's picks complete at the required tier.

Below that bar, the builder says how many it found and does not pad the list (nearby-and-regions 6.2).

## 3. Measured today (27 Oct 2026, `main` 6c422664, read-only)

**Method:**
- `node core/bin/capture.ts gaps --tier required --json`.
- Every `capture/1` lane file under `data/capture/` (runs, splits and changesets excluded).
- The graph shards `data/catalogue/graph/*.json` for the country of records with no area.
- The suitability and relevance sidecars by ref.
- `data/locations/locations.json` (regions, areas, places).
- The towns manifest `data/reference/towns/manifest.json`.

**Record tier as defined in 2.1, approximated:**
- **T0:** placed (area and point, or an offer or event with a chain).
- **T1:** T0 plus a suitability or relevance sidecar.
- **T2:** the required tier complete.

| Country | Regions in store / first-level units | Areas | Capture records (place, route, offer) | Trails | Parks | Offers (non-stay) | Records T0 / T1 / T2 | Store places | Towns rows | Country tier |
|---|---|---|---|---|---|---|---|---|---|---|
| CA | 4 / 13 | 26 | 217 (103, 79, 34) | 62 | 3 | 32 | 30 / 155 / 32 | 53 | 381 | below T0; T3 slices (Rockies, Algonquin); Rockies about T1 |
| US | 10 / 51 | 36 | 88 (72, 16, 0) | 14 | 13 | 0 | 0 / 29 / 59 | 43 | 1,653 | below T0; T3 slices (Utah, Vermont, NH) |
| IT | 6 / 20 | 11 | 84 (55, 22, 7) | 20 | 1 | 2 | 21 / 44 / 19 | 18 | 4,381 | below T0; T3 slice (Dolomites) |
| IS | 7 / 8 | 14 | 30 (23, 5, 2) | 5 | 1 | 1 | 3 / 27 / 0 | 19 | 34 | below T0; T3 (Ring Road), T1 |
| AR | 3 / 24 | 3 | 24 (16, 7, 1) | 7 | 0 | 1 | 2 / 22 / 0 | 6 | 99 | below T0; T3 (Patagonia), T1 |
| FR | 3 / 13 | 3 | 21 (15, 4, 2) | 2 | 0 | 2 | 4 / 15 / 2 | 5 | 1,952 | below T0; T3 (Chamonix) |
| VN | 3 / 34 | 3 | 4 | 0 | 0 | 0 | 0 / 0 / 4 | 3 | 256 | below T0 |
| CN | 1 / 34 | 1 | 3 | 0 | 0 | 1 | 0 / 0 / 3 | 1 | 697 | below T0 |
| IN | 1 / 36 | 1 | 2 | 0 | 0 | 0 | 0 / 0 / 2 | 1 | 531 | below T0 |
| CH | 1 / 26 | 1 | 1 | 0 | 0 | 0 | 0 / 1 / 0 | 1 | 1,069 | below T0; overview trip, no records |
| CL, NO, CR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 38, 17, 22 | none; CL holds part of Patagonia, NO and CR are overview trips |
| No country (no area, no graph shard) | | | 30 | 8 | 4 | 3 | 27 unplaced | | | |
| **All** | **39 regions, 10 countries** | **99** | **504 (310, 143, 50)** | **118** | **22** | **42** | **60 / 296 / 121** | **150** | **11,759 in 22 countries** | **no country at T0** |

**Findings:**
- **The data is trip-deep, not country-broad.** 504 records sit in 8 trip regions. No country has every region, and the largest (US) has 10 of 51 first-level units. Building T0 for Canada alone means about 600 to 1,000 records, more than the whole catalogue today.
- **Only 24% of records (121 of 504) are plan-ready (T2).** DATA-PLAN already queues the 384 below the bar for bundles C to E. This page does not re-plan them.
- **Parks:** 22 park records, entry rules in none yet (PA-R-CA is queued).
- **Activity offers:** 42 non-stay offers, 32 of them in the Rockies.
- **Airports:** none in the data (ORG-D is planned).
- **Towns:** the layer holds 11,759 GeoNames rows, but only within 100 km of an existing anchor (`towns.py` rule), so it is partial in every country.
- **The locations store is one file of 150 places** with a split layout already built (`locations.py layout split`, which warns past 300 places). The tool for scale exists.
- **Today's place page costs about 14 KB of JSON per deep record** (7 MB of capture, suitability, relevance and sources for 504 records). The phase A export of about 364 place pages is 195 MB on disk (`web/out`). Prerendering bulk places is therefore impossible (section 7.3).

## 4. Country list and waves

### 4.1 Sources and method

Only the order is recorded here, with its citation. No table is copied.

| Source | Year | Licence or terms | Used for |
|---|---|---|---|
| UN Tourism, *International Tourism Highlights, 2025 Edition*, and *World Tourism Barometer* (January 2026 excerpt: 2025 arrivals about 1.52 billion) | 2024 country data, 2025 totals | © UN Tourism; free to read, not open data | ranks 1 to 25 |
| Wikipedia, "World Tourism rankings" (summarises the UN Tourism tables; regional top-10 lists) | read 27 Oct 2026 | CC BY-SA (text not copied; only the order was read) | cross-check of ranks 1 to 25 and the regional top 10s |
| World Bank WDI `ST.INT.ARVL` (international tourism, number of arrivals; from UN Tourism) | 2019, the last full pre-pandemic year; the series ends in 2020 | CC BY 4.0 | ranks 26 to 100, with adjustments (below) |

**Method and its limits:**
- Ranks 1 to 25 follow 2024 overnight international arrivals.
- Ranks 18 to 25 are ±3 places, because national series differ.
- WDI mixes overnight tourists (TF) with all visitors including same-day ones (VF). This inflates land-border countries (FR 218 M, PL 88 M, HU 61 M, HR 60 M in 2019). Ranks 26 to 100 are therefore WDI order, with land-crossing-dominated entries (BH, KW, KZ, KG, AD) moved later.
- Countries with a "do not travel" or "avoid all travel" advisory from Canada or the US at ingest time are skipped and re-checked each wave (today RU, BY, UA, SY).
- Hong Kong and Macao ride with China as S-size entries under their own ISO codes. Puerto Rico rides with the US.
- Task CTRY-L refreshes the order when UN Tourism finalises its 2025 country data.

**Popularity is not fit.** Arrivals measure border crossings, not hiking, family or road-trip value. That is why the waves pull forward the countries where public trips already exist.

### 4.2 The waves

| Wave | Countries, in order | Target | When |
|---|---|---|---|
| **0: the first slice** | CA, US, IT | CA: T1 country-wide. CA-ON and CA-QC: T2. US-NY, US-VT, US-NH, US-ME, US-MA: T2. US: T0 country-wide. IT: T1 country-wide, T2 in Lombardy (lakes) and Trentino-Alto Adige/Veneto (Dolomites) | first; it unblocks the builder's first slice (section 8) |
| **1: top 25 plus trip countries** | FR, ES, CN (+HK, MO), TR, MX, GB, DE, JP, GR, TH, AT, SA, PT, MY, NL, HR, PL, AE, VN, MA, KR, EG (ranks 1 to 25 without wave 0); then the trip countries CH, IS, AR, CL, NO, CR | T0 for all. T1 for the six trip countries and FR (Chamonix). T1 for the others by request (Q-DC2) | after wave 0 passes its acceptance (6.8) |
| **2: ranks 26 to 50** | HU, CZ, SG, IN, ID, DK, ZA, IE, TN, DO, BR, BG, RO, AU, BE, TW, PH, SE, CO, JO, GE, KH, AL, NZ, PE | T0 | year one if wave 1 holds its cost; else year two |
| **3: ranks 51 to 100** | UZ, LT, LV, EE, SI, FI, CY, MT, LU, RS, ME, BA, MK, AM, AZ, KZ, KG, BH, OM, QA, KW, IL, LK, MV, NP, LA, BN, KE, TZ, NA, MU, UG, ZW, ZM, BW, RW, CU, JM, BS, PA, UY, PY, EC, GT, SV, HN, BZ, BT, MN, AD | T0 | year two |

**Recommendation and trade-off.** Year one is wave 0 to the slice bar plus wave 1 at T0 (Q-DC2). Depth in the slice is what lets the builder produce something a visitor trusts (P7). Breadth at T0 is what lets the map, the scratch map and the builder's first step work anywhere. The cost is a long tail of countries where the builder can only draft.

## 5. Sources: what is legal, how, and what stays link-only

### 5.1 Verdict per source

| Source | Licence or terms | Verdict | How we fetch | What we may store | Attribution |
|---|---|---|---|---|---|
| **Wikidata** | CC0 | **Primary** for identity, type, coordinates, regions (P300), UNESCO (P757), parks (P814), official site (P856), sitelinks | SPARQL per country and type family (60 s limit, one query at a time, cached), by QID; never the full dump | everything, with the QID as source | courtesy line (already in `licences.json`) |
| **OpenStreetMap** | ODbL 1.0 | **Allowed as a separable layer** (5.2) | Geofabrik country and state extracts (`.osm.pbf`, one download at a time), filtered locally with osmium. **Not Overpass for bulk.** Overpass stays for single features, one runner, 10 s apart | points (`coord_src: osm`), `osm_ref`, geometry, tags as evidence; kept in the OSM layer | "© OpenStreetMap contributors, ODbL" wherever shown |
| **Overture Maps** places | CDLA-Permissive-2.0 (places); other themes may be ODbL | **Discovery only** (operators for activity offers, existence checks) | GeoParquet from the public release via DuckDB, local filter by country and category | existence, category and a website as a lead; the offer's facts come from the operator page | notice in About the data if any value is kept (DC-L) |
| **GeoNames** | CC BY 4.0 | **Allowed** (towns layer, alternate names for dedupe) | `cities1000` and `admin1` dumps (already in `tools/towns.py`); extend anchors per wave | names, positions, populations verbatim | "Contains data from GeoNames, CC BY 4.0" (present) |
| **OurAirports** | public domain | **Allowed** (ORG-D) | one CSV download | airports reference rows | courtesy |
| **Wikipedia pageviews** | CC0 (Wikimedia analytics data; DC-L confirms) | **Allowed**, as a fame signal only | monthly pageview dump files joined locally; the per-article REST API only for single checks | 12-month views per article and language | none needed; named in the method |
| **UNESCO World Heritage** | site content © UNESCO | **List via Wikidata P757**; link to whc.unesco.org | no crawl of the WHC site | the designation as a fact with its link | link |
| **NPS** (US) | public domain; API key free, 1,000 requests an hour | **Allowed** (parks, fees and passes, alerts, things to do, campgrounds) | `developer.nps.gov` API, one runner, cached | values, as proposals (fees and closures never auto-accepted) | courtesy (present) |
| **Recreation.gov RIDB** (US federal facilities, permits) | US government data, API key | **Allowed**; check terms once (DC-L) | API, one runner | facilities and permit existence; windows read from the official page | courtesy |
| **Parks Canada, Ontario GeoHub, Données Québec** | OGL-Canada, OGL-Ontario, CC BY 4.0 | **Allowed** | dataset downloads | boundaries, park lists, trail lists where published | OGL and CC BY lines (DC-L adds Ontario and Québec) |
| **EEA CDDA and Natura 2000** (EU protected areas) | CC BY 4.0 | **Allowed** for park identity and boundaries in the EU | dataset downloads | ids, names, designation | CC BY line |
| **DATAtourisme** (France national tourism POI database) | Licence Ouverte / Etalab 2.0 (DC-L confirms) | **Allowed** for FR, facts only, our words | dataset download | facts and identity; no description text (our paraphrase rule) | Etalab line |
| **WDPA / Protected Planet** | commercial use and redistribution of the data or derived works forbidden without permission | **Not allowed** | none | nothing | n/a |
| **Wikivoyage, Wikipedia text** | CC BY-SA | **Read only**, as a reference (method `read`) | an agent reads single pages | facts in our words with a link; never text, never a copied listing table, never the Wikivoyage region tree wholesale (a copied structure could carry share-alike) | link |
| **Wikimedia Commons** | per file | **Allowed**, allowlist CC BY, CC BY-SA, CC0, public domain (DD-3) | one runner on the machine, sequential, user agent without an email | the link and credit as Commons holds them | per image |
| **openrouteservice** | free plan: 2,000 directions and 500 matrix calls a day; routes from OSM (ODbL) | **Allowed** for T2 drive times | one runner; matrix calls for bases and picks | drive minutes and km as derived values, `our_inference`, with the ORS credit | present in `licences.json` |
| **OSRM public demo server** | usage policy forbids heavy use | **Not for bulk**; self-host OSRM on a Geofabrik extract only if the ORS quota binds | | | |
| **Nominatim** | usage policy forbids bulk geocoding | **Research only**, single lookups, 1 a second | | | |
| **Official tourism boards, agency and operator pages** | copyright | **Read**. Crawl only where robots.txt and terms allow (registry `automated: allowed`; `unknown` means read only) | at most 200 pages per host per run, 1 s apart | facts in our words, quotes of 300 characters or less for exact rules | source row per value |
| **Google (Maps, Places, Search), Apple, Bing** | terms | **Never** a source of any value or coordinate (capture-contract 9.2, T5) | | | |
| **AllTrails, Komoot, Gaia, Outdooractive, Wikiloc, Trailforks, FATMAP** | terms | **Link only** (`found_in_search`) | never fetched | link | |
| **Tripadvisor, Yelp, Booking, Expedia, Airbnb, GetYourGuide, Viator, Civitatis** | terms | **Link only**. Never ratings, counts, ranks, prices or "top" lists (relevance R6, `E_REL_LINK_ONLY_SRC`, `E_REL_COPIED_RATING`) | | | |
| **Social media** | terms, privacy | **Never scraped**; the owner's own captures only | | | |

### 5.2 OpenStreetMap and ODbL, analysed honestly

| Question | Answer |
|---|---|
| Does bulk use trigger share-alike? | Yes. A systematic, repeated extraction of points, ids and geometry per country is substantial (the OSMF Substantial guideline exempts only small, non-systematic extracts). Pages, the API and MCP are public use. The OSM-derived part of our database must be offered under ODbL. |
| Does it reach our own facts and words? | Not if the OSM data is a **separable layer** of a collective database (ODbL 4.5): our facts keyed by our refs in their own files and tables, with OSM values (points with `coord_src: osm`, `osm_ref`, tracks, OSM tag values used as evidence, ORS-derived drive times) in theirs. This is the rule we already have (sources-and-licences 2, P8). |
| Where it leaks | A fact whose only evidence is an OSM tag (opening hours, fee, `access`) is OSM-derived. It carries `licence: odbl` on the value and stays in the OSM layer, or is re-sourced from an official page. DC-C adds a per-value licence flag so the export of the OSM layer can be generated. |
| What we must do | Attribution wherever OSM data shows. Offer the OSM-derived layer as an ODbL download (one file per country, generated, on the About the data page). This costs us nothing, because it is OSM's own data back. Keep a changelog of the layer's build so the "means to recreate" is offered. |
| How to keep the footprint small | Coordinate order: Wikidata (CC0) when its point is within 250 m of the OSM feature and fit for the point role. Else official open data. Else OSM. Trailheads, viewpoints and parking usually need OSM. |
| Effect on P8 | The OSM layer cannot be protected and never could. Our words, suitability, relevance and plans stay ours. The public repository (QR2 in public-ref-aliases) already exposes the files. That question is QR2's, not this page's. |

### 5.3 Scraping rules for bulk runs

These are the existing capture-contract 9.1 to 9.6 rules, restated only where bulk changes them.

- **Bulk means downloads, not crawls.** Wikidata SPARQL, Geofabrik extracts, Overture GeoParquet, GeoNames, OurAirports and the pageview dumps are files or query endpoints built for this. No site is crawled for bulk lists.
- **One runner per service, machine-wide**, under `flock /tmp/travel-<service>.lock`: Wikidata, Commons, Overpass, Nominatim, ORS and the NPS API. Geofabrik and the pageview dumps take one download at a time.
- **User agent:** `travel-capture/1.0 (+https://nks-travel.pages.dev/about/)`, never an email or a person's name.
- **Cache everything**, outside the repository (`~/Library/Caches/travel/<service>/`). Nothing is re-fetched inside its freshness window.
- **Every run writes a `capture-run/1` record**, and every value cites its run. Crawled and API values enter as `review_status: proposed`. Hard limits, prices, windows, closures and entry rules are never auto-accepted.

### 5.4 Most visited and hidden gems: how they are computed

| Signal | Computed from | Scope | Stored as | Privacy |
|---|---|---|---|---|
| **Fame** (the "most visited" proxy) | Wikidata sitelink count, plus 12-month pageviews in English and in the local-language editions with a sitelink, as a percentile within country and type family (relevance 2.3 biases apply: sub-features under-score, roadside views over-score) | record | `data/relevance/signals/` (existing files, sharded by country) | open data only; no user data |
| **Official visitor counts** | NPS IRMA, Parks Canada attendance and similar official statistics | park | `visitor_volume` at park scope (relevance 1) | aggregate public statistics |
| **Designation** | UNESCO P757, national park, IUCN P814, official highlight on the land manager's page | record | relevance signals | |
| **`gem_candidate`** (internal, never public) | fame percentile under 50 in its country and type family, **and** a quality signal: a designation, a land-manager or regional-tourism mention, a local-language article with no English one, or a natural type with a strong payoff (`natural=waterfall`, `tourism=viewpoint`, `natural=hot_spring`, `leisure=swimming_area`) **and** not in a sensitive class (caves, nesting areas, sacred sites: area only) | record | a derived flag in the coverage report | |
| **`hidden_gem`** (public) | unchanged: relevance 3.4 (`standing: top`, draw `local` or `regional`, `access_legal: public` stated by a source, two independent sources) | record | relevance sidecar | crowd-risk `high` lists the area without the point |

**Never:**
- ratings, review counts, "popular" ranks or popular times from any platform (R6);
- our own visitors' behaviour as a ranking input in year one.

If favourites or beacon counts are ever used, they are aggregated with at least 20 distinct devices per item, never per person, and they need an owner decision.

## 6. How it enters our system

### 6.1 Where bulk records live (minimal contract change, DC-C)

| Decision | Rule | Why |
|---|---|---|
| Lane | `data/capture/catalogue/gz-<cc>-<region>.json` (`"trip": "catalogue"`), one file per region; `_country` for country-level records | the trip-less lane already exists (3.8, `E_CAP_LANE`); a region file stays under about 1 MB |
| Identity | every top-level record is born in the locations store (entity-graph QG1) with a pinned `place/<slug>` (`slugs.ts build`); one identity path | keeps refs, aliases and the slug registry single |
| Store layout | `locations.py layout split` (by-country parts) before wave 0 | the single file warns past 300 places; wave 0 alone adds about 2,500 |
| New store status `listed` | a place that came from a gazetteer run, not from the owner's list; excluded from `WISHLIST.md` and the two legacy outputs; `status` stays `idea` or `planned` for the owner's own places | the wishlist keeps its meaning. It also strengthens PRIV1/DD-8: the owner's places become indistinguishable inside a large catalogue |
| Coverage-tier judgement | a record with `meta.target_tier` T0 or T1 is checked against that tier's keys. `W_TIER_REQUIRED` errors only when the record claims T2 or is in a trip lane. A gazetteer record is not "Usable" until promoted | today every new lane record errors on the required tier (3.7.3); T0 records could never be committed |
| Source-to-type map | new authored file `data/vocab/source-type-map.json`: Wikidata P31 classes and OSM tag combinations to the 324 type ids, with a `review` flag for ambiguous classes | the type map is data, not code (P1); a new mapping is one reviewed entry |
| Per-value licence | `licence` on a value whose only evidence is ODbL or CC BY-SA-derived | so the OSM layer export can be generated (5.2) |
| `meta.run`, `meta.review` | RowMeta (catalogue-intake 3) on every gazetteer record | one rollback per run id |

### 6.2 The pipeline, per country (runbook DC-RB)

| Step | What | Tool | Model | Check |
|---|---|---|---|---|
| 0 | Open the run: wave, size class, licence matrix, advisory check | `gazetteer.ts plan --country <cc>` | Haiku | plan file written |
| 1 | **Regions:** ISO 3166-2 first level from Wikidata P300, with region groups where there are more than 25 units (TR, TH, JP, PH...), authored once in `data/reference/region-groups.json` | `gazetteer.ts regions`, then `locations.py` | Opus for groups | every region present; names verbatim from Wikidata |
| 2 | **Areas:** proposed from the P131 chain, national and provincial parks, and the largest towns per region; reviewed as one table per country | `gazetteer.ts areas --propose`, the `location` skill | Opus | one table the owner can scan (Q-DC6) |
| 3 | **Candidates:** SPARQL per type family; OSM extract filter; OurAirports; agency lists | `gazetteer.ts candidates` | Haiku runs | counts per family in the run note |
| 4 | **Rank and select:** fame percentile; quotas per region and family (2.2); `gem_candidate` | `relevance.ts signals --country` (extended), `gazetteer.ts select` | script | quotas met or dated reason |
| 5 | **Dedupe** against the slug registry, capture refs and store places, in order: same QID; same OSM id; same name (accent-folded) within the type's radius (viewpoint 200 m, trailhead 500 m, lake 2 km, park by containment). Only an id match auto-merges; a name and distance match goes to a review queue. Existing values always win; new values fill only empty keys, as proposals | `gazetteer.ts dedupe` | Sonnet first pass, Opus for the queue | 0 duplicate QIDs or OSM ids |
| 6 | **Write:** store places (`listed`), slugs (no month or year in any slug, public-ref-aliases), capture records with the placement block and links, points in `capture-points/1`, run record | `gazetteer.ts write` (through the store and capture tools, never by hand) | script | validators green |
| 7 | **Derive:** `towns.py build` with new anchors, `capture.ts derive-near --write`, `derive-area --write` (AREA-2: the 10 km label rule; a point no area reaches becomes a proposal), `graph.ts build`, coverage tiers | existing tools | script | `derive-area --accuracy` 95% or more |
| 8 | **Summaries:** one line in our words from the structured facts, 40 records per call | `gazetteer.ts summaries` | Sonnet | no copied text; 300-character cap |
| 9 | **Sample review:** 20 random records (point, type, area), the top 20 by fame (no obvious headline missing), 10 values against sources | the verifier's checklist | Opus | 6.8 bars |
| 10 | **Commit per region**, then the local seed and `db:crosscheck` (DATA-PLAN 4.2), then SYNC with the next data bundle | existing | coordinator | cross-check green |

**T1 adds:**
- trails (D3 method);
- offers (6.6);
- season, kid keys and photos (D5c method, Commons runner);
- relevance standing and draw (TRL-REL method);
- a 10-value sample and an Opus 10-record review per region.

**T2 adds:**
- the required tier (the D10 method);
- park entry rules (the PA-R method);
- bases (D9 method);
- the ORS matrix (nearby N3 MX);
- gateway airports (ORG-G).

### 6.3 Refresh

| Layer | Window | How |
|---|---|---|
| T0 identity and fame | yearly per country | rerun steps 3 to 7. The diff is a changeset: new candidates, retired items (never deleted: retire, keep the ref) |
| T1 values | per property freshness (`data/schema/freshness.json`) | the `gaps` report drives the next pass |
| T2 entry rules, fees, windows | each season, before it opens | PA and booking tasks; never auto-accepted |
| Country order | when UN Tourism publishes final country data | CTRY-L |

### 6.4 Which parts are cheap and which need judgement

| Work | Model | Why |
|---|---|---|
| Running fetchers, downloads, counts, coverage reports, the photo runner | Haiku | mechanical (model-by-complexity rule) |
| Code for the pipeline; summaries; T1 fills by contract; trail facts; reading operator pages; dedupe first pass | Sonnet | specified, with acceptance checks |
| Contract (DC-C); region groups; areas; the source-type map's ambiguous classes; dedupe merges; gem promotion; entry rules and hard limits; sample reviews; licence calls | Opus | judgement, shared contracts, taste |

### 6.5 Where the one-runner rules bite

| Service | Wave 1 load | Effect | Mitigation |
|---|---|---|---|
| Wikidata SPARQL | 15 to 30 queries per country | about 30 minutes per country | none needed |
| Overpass | none for bulk | | Geofabrik extracts |
| Pageviews | about 24,000 article-months for wave 1 via the API (6.7 h sequential) | | dumps, joined locally: minutes |
| **Commons** | about 300 targets per M country at T1 (about 9,000 for wave 1) | **the binding constraint**: about 45 h of runner wall clock, shared with D5c and L3 | T1 photos for the top 100 per country by fame; the rest "No licensed photo yet"; schedule after D5c |
| ORS | T2 only: about 1 matrix call per base set | 500 a day is ample | self-host OSRM only if a whole-country matrix is ever needed |
| NPS API | about 500 calls for all parks | fine | cache |

### 6.6 Activities and adventure offers: the slow part

No open dataset lists rafting, bungee or zipline operators with their rules. Overture places (CDLA-P 2.0) and OSM (`sport=*`, `leisure=*`) give leads only. Each offer needs its operator page read: rules, minimum age, season, booking, and the waiver URL. At the measured rate, that is about 5 minutes per offer.

T1 therefore targets **1 to 3 operators per activity type per region**, chosen by the operator's own official status (a licensed operator, a park concession), never by a platform's rating. Resellers are link-only. A limit a reseller states is kept as a conflict, never as the value (9.2).

### 6.7 Privacy

Gazetteer runs read no household data. The coverage report and run records name no origin.
- Slices are defined by regions, never by a home point.
- The neutral lane id `catalogue` is kept.

### 6.8 Acceptance checks per country and tier

| # | Bar | Tier |
|---|---|---|
| A1 | `validate.ts --all`, `capture.ts build --check`, `gaps --budget --check`, `slugs.ts --check`, `locations.py validate` and `build --check`, `graph.ts build --check`: all green | every run |
| A2 | 20 random records: point within 500 m of the source feature (inside the feature for areas and parks) 20 of 20; type right 18 of 20; area right 19 of 20 | T0 |
| A3 | Every national park and every UNESCO site of the country present; Opus reviews the top 20 by fame for an obvious headline missing | T0 |
| A4 | 0 duplicate QIDs or OSM ids; every name and distance collision decided | T0 |
| A5 | No forbidden source in any `src`; no copied text (summary similarity check against the Wikipedia lead below a set threshold) | T0, T1 |
| A6 | Every region holds at least 3 (S) or 8 (M, L) records, or a dated note says why | T0 |
| A7 | 10-value sample against sources, 9 of 10; Opus 10-record review per region | T1, T2 |
| A8 | The slice bar of 2.3 | T2 |

## 7. Sizing

### 7.1 Records and bytes per country

| Tier | S | M | L | Bytes per record (capture, sidecars, points, sources) | M country |
|---|---|---|---|---|---|
| T0 | 40 to 80 | 250 to 400 | 500 to 1,000 | about 1.5 KB | about 0.5 MB |
| T1 | 50 to 110 | 330 to 540 | 660 to 1,350 | about 4 KB | about 2 MB |
| T2 | per region: 100 to 200 | | | about 14 KB (today's deep records) | about 2 MB per region |

### 7.2 Effort for wave 0 and wave 1

**Rates:**
- Measured: 4.1 agent-minutes per place, 2.9 per record, 0.7 per photo target (DATA-PLAN 1).
- Assumed: T0 is mostly script, so about 3 agent-hours per M country, 6 per L and 1 per S, Opus review included.
- T1 is about 17 h per M country: 60 trails 4 h, 40 offers 3.5 h, T1 keys on 300 places 5 h, 300 photos 3.5 h, review 1 h.
- Cost: from WORKFLOW-EFFICIENCY's measured USD 0.055 to 0.15 per turn, about USD 3 to 6 per agent-hour, at about 1.5 to 2.5 M tokens per agent-hour (mostly cache reads). Treat these as estimates.

| Work | Hours | Tokens | USD |
|---|---|---|---|
| Pipeline, one time (section 9) | 60 | about 0.12 B | 180 to 360 |
| Wave 0: the slice to T2 (CA-ON, CA-QC, US-NY, VT, NH, ME, MA), about 840 records | about 95 | about 0.2 B | 290 to 570 |
| Wave 0: IT T1 plus 2 regions at T2; CA T1 country-wide; US T0 | about 85 | about 0.17 B | 260 to 510 |
| Wave 1 T0: 28 countries and 2 SARs (7 L at 6 h, 21 M at 3 h, HK and MO at 1 h) | about 105 | about 0.21 B | 315 to 630 |
| Wave 1 T1 for the 6 trip countries and FR (AR, CL, FR as L at 34 h; CH, IS, NO, CR as M at 17 h) | about 170 | about 0.34 B | 510 to 1,020 |
| **Year-one recommended total** | **about 515** | **about 1.0 B** | **about 1,550 to 3,100** |
| Wave 1 T1 for all 22 others (not recommended up front) | about 450 more | about 0.9 B | 1,350 to 2,700 |
| Waves 2 and 3 at T0 (75 countries) | about 200 | about 0.4 B | 600 to 1,200 |

**Per week with parallel agents.** One Opus research lane at a time and a 70% weekly cap (DATA-PLAN 6.1). Two Sonnet seats on disjoint countries and hosts, plus Haiku runners, deliver about:
- T0: about 8 to 10 M countries a week.
- T1: about 3 to 4 M countries a week.
- T2: about 2 regions a week.

Wave 1 at T0 therefore takes about 3 weeks of wall clock. The Opus work (areas, reviews: about 1.5 h per country) fits the spare hours DATA-PLAN 2.2 shows in windows D (22 h) and E (61 h).

### 7.3 Storage, bundles and P8/P9

| Concern | Measure or estimate | Rule |
|---|---|---|
| JSON in git | wave 0 about 3,500 records (about 20 MB) plus wave 1 T0 about 12,000 records (about 18 MB); with the year-one T1 about 55 to 60 MB | sharded per region (6.1); no file over about 1 MB; generated shards per country (graph) |
| Neon (CAT-1) | production about 70 to 75 MB after CAT-1 (CATALOGUE-EARLY 8). The gazetteer adds about 150 to 200 MB for year one (records, signals, towns for full countries). That is 25 to 28% of the 1 GB project; waves 2 and 3 bring it to about 45 to 50% | CAT-V prints `pg_database_size`; exit path is a paid Neon plan or archiving T0 signals |
| Neon compute (100 CU-hours a month on Free) | bulk pages read Postgres | gazetteer pages are cached (ISR, long revalidate); crawlers meet cached pages (P8 edge rules) |
| Static output | a phase A place page costs about 0.5 MB of output; 12,000 prerendered pages would be about 6 GB | **gazetteer pages are never prerendered**: rendered on request and cached (DC-SRV); the sitemap lists only Usable pages |
| Server memory | `JsonStore` parses every JSON file per cold start; 55 MB would add seconds and approach the function size limit | gazetteer families are read from Postgres through the CAT-Q router; the trip catalogue stays on files until SRV-0 |
| Client bundles (P8, P9) | a client name index of 16,000 rows would be about 1 MB | **no client-side growth**: gazetteer search, nearby and builder candidates are server routes (`/api/v1`). List rows keep the P8 allowlist. T0 records get no place page until Usable (Q-DC5) |
| Globe and scratch map | pins at scale | relevance globe tiers and clustering (P1); world-map-scratch reads countries and regions only |

## 8. The first slice, and why this order

**Ontario and Quebec, with NY, VT, NH, ME and MA, to T2.** This is the fastest path to a builder that works end to end:
- Four public trips already sit there (Algonquin, Vermont, New Hampshire, plus the Quebec and Niagara overview trips). They supply area labels, the derive-area labels and towns anchors.
- nearby-and-regions 6.5 already designs the Quebec City example. The catalogue today holds 21 Quebec places, short of the 25-pick bar.
- The agencies publish open data: Parks Canada (OGL-Canada), Ontario GeoHub (OGL-Ontario), Données Québec (CC BY 4.0), the NPS API (public domain) and NY state open data.
- Day trips across the border test multi-country regions early.

**Italy next (T1 country-wide; T2 in the lakes and the Dolomites).** It is the owner's second example, the Dolomites trip is the deepest data we have, and BA-it already holds Lake Como.

**Canada country-wide at T1 last.** The Rockies (DATA-PLAN's C window) give its T2 slice.

| Step | What | Depends on | Hours |
|---|---|---|---|
| 1 | DC-C, DC-L, DC-6 (contract, licences, store split, `listed`) | REF-C, EG-C merged | 11 |
| 2 | DC-1, DC-2, DC-3, DC-4 (ingest, dedupe, signals, coverage) | 1 | 32 |
| 3 | Slice T0 (7 regions), then T1, then T2 | 2; Commons runner after D5c | 95 |
| 4 | DC-SRV (Postgres reads, on-demand pages, server search for gazetteer families) | CAT-1, CAT-Q | 14 |
| 5 | The builder's first slice reads it | trip-builder.md's own tasks | |

## 9. How this fits the master plan

### 9.1 New tasks (proposed)

| Id | What | h | Model | Depends on | Slot (proposed) |
|---|---|---|---|---|---|
| DC-0 | This spec | done | Opus | | docs |
| DC-C | Contract: gazetteer lane rules, store `listed` status, coverage-tier judgement and `meta.target_tier`, `source-type-map.json`, per-value `licence`, `gem_candidate`, RowMeta use | 6 | Opus (shared contract) | REF-C, EG-C, Q-DC4, Q-DC5 | B2 contract seat, after REF-C and EG-Q |
| DC-L | `licences.json` (Overture, Ontario, Québec, EEA, DATAtourisme, RIDB, pageviews), About the data lines, the ODbL layer statement, registry `automated` flags for the new hosts | 2 | Opus | Q-DC1 | with DC-C |
| DC-6 | `locations.py layout split`; `listed` excluded from WISHLIST and legacy outputs; towns anchors per wave | 3 | Sonnet | DC-C | data seat |
| DC-1 | `core/bin/gazetteer.ts`: plan, regions, areas `--propose`, candidates (SPARQL, Geofabrik plus osmium, Overture, OurAirports through ORG-D), select, write (through the store and capture tools), run records, caches, locks | 16 | Sonnet 14, Opus review 2 | DC-C, ORG-D | lane P or data seat (code) |
| DC-2 | Dedupe engine and review queue; slug minting without dates | 6 | Sonnet 5, Opus 1 | DC-1 | same |
| DC-3 | Fame at scale from pageview dumps and sitelinks; percentiles; `gem_candidate` | 5 | Sonnet | DC-1 | same |
| DC-4 | `capture.ts coverage [--country] [--region] [--json]`; scoreboard row S11 | 5 | Sonnet 4, Opus 1 | DC-C | same |
| DC-5 | `data/reference/region-groups.json` for wave 1 countries with more than 25 first-level units | 2 | Opus | DC-C | data seat |
| DC-RB | Runbook `research/method/lanes/gazetteer.md` (the steps of 6.2; skills and agents point to it) | 3 | Opus | DC-1 to DC-4 | docs |
| DC-SRV | Gazetteer families served from Postgres (list, search, nearby, detail) via the CAT-Q router; on-demand cached pages; sitemap of Usable pages only; budgets unchanged | 14 | Opus 4 (contract), Sonnet 10 | CAT-1, CAT-Q | the bundle that ships the builder's first slice |
| DC-W0 | Wave 0 data (section 8) | 180 | Sonnet and Haiku; Opus about 25 | DC-1 to DC-6 | data seat 2 (new) from D's window |
| DC-W1 | Wave 1 at T0, plus T1 for the trip countries and FR | 275 | same | DC-W0 accepted | after E |
| CTRY-L | Refresh the country order from UN Tourism's final data | 1 | Haiku | | when published |
| **Total to year one** | | **about 518** (pipeline 62, data 455, CTRY-L 1) | | | |

### 9.2 Conflicts with DATA-PLAN and other pages

| Conflict | Resolution |
|---|---|
| One data seat, already queued for 194 h through bundle E | **A second data seat** (Sonnet and Haiku) runs the gazetteer; its Opus work uses the Opus lane's spare windows (D 22 h, E 61 h). The DATA-PLAN queue keeps priority |
| One Opus research lane at a time, with a 70% weekly cap | gazetteer Opus work is review-shaped and batched; it never runs beside PA-R or D8-R on the same week's cap |
| Commons runner shared with D5c and L3 | gazetteer photos after D5c; top 100 per country only |
| Wikidata runner shared with relevance signals (RV0) | the same lock; gazetteer SPARQL is a few queries per country |
| Gap budget: "a new record errors from day one" (3.7.3) | DC-C's tier judgement (Q-DC5); the budget counts gazetteer records per target tier |
| "A new area is an owner decision" (3.7.1) | Q-DC6: area tables approved per country |
| Entity-graph QG1 trade-off ("parks appear in WISHLIST.md as ideas") | superseded in part: with `listed`, gazetteer parks stay out of the wishlist |
| nearby-and-regions 6.2: "places we have not researched (OSM, Wikidata) are a later, signed-in step (Q60)" | **superseded in part**: T0 records are public candidates labelled "Not researched yet". Picking one in the builder still files a research request |
| DATA-PLAN S1 targets (90% of records at the required tier by D) | S1 counts trip lanes and the existing catalogue lane only; gazetteer records are reported by S11 per target tier |

### 9.3 Edits other pages need (not made here)

- **MASTER-ORDER:**
  - add the DC rows to 3.9 and contract order 4.3 (DC-C after REF-C and EG-Q);
  - add data seat 2 to 5.4;
  - add DC-SRV to the builder bundle.
- **RELEASE-PLAN:**
  - a data readiness line for the builder bundle (the slice bar of 2.3);
  - the SYNC size note (Neon at about 30% after year one).
- **PLAN:**
  - new requirements R-27x: "data at scale: tiers T0 to T3, country waves, legal sources, bulk ingestion" (DC-*), and "gazetteer served from Postgres, never prerendered or shipped to the client" (DC-SRV);
  - the Sources section gains Overture, DATAtourisme, EEA, Ontario, Québec, RIDB and the pageview dumps, plus WDPA as forbidden.
- **DATA-PLAN:**
  - section 0 and 2.2: data seat 2;
  - 5.1: scoreboard row S11 (coverage per country and tier, DC-4);
  - 6.1: the Geofabrik-not-Overpass rule for bulk and the pageview-dumps rule.
- **research/method/sources-and-licences.md 2 and 3:** the new rows of 5.1, WDPA under "Never store", and the ODbL leak rule of 5.2 (DC-L).
- **research/method/capture-contract.md 3.7.3 and 3.8:** the tier judgement and the gazetteer lane (DC-C).
- **data/locations/README.md:** the `listed` status (DC-6).
- **nearby-and-regions.md 6.2:** point to this page for "Honest limits" and Q60.
- **entity-graph.md:** QG1's trade-off note.

## 10. Owner questions

| ID | Question | Recommendation | Trade-off |
|---|---|---|---|
| Q-DC1 | Accept OSM-derived data in the catalogue as a separable ODbL layer, offered as a per-country ODbL download, with Wikidata (CC0) coordinates preferred? | **Yes** | trailheads, viewpoints and parking need OSM; without it, T0 has no trail starts and fewer nature places. The layer is OSM's data back, so it costs nothing to share |
| Q-DC2 | Depth or breadth in year one: wave 0 to the slice bar plus wave 1 at T0 (and T1 only for the trip countries and FR), with other T1 on request? | **Yes** (about 515 agent-hours, USD 1,550 to 3,100) | most countries stay draft-only for the builder; T1 everywhere would roughly double the cost before demand is known |
| Q-DC3 | Wave order by 2024 arrivals, with the slice and the trip countries pulled forward, and countries under "avoid all travel" advisories skipped? | **Yes** | arrivals reward border-crossing countries over hiking value; the pull-forward corrects for our audience |
| Q-DC4 | Bulk places go into the locations store (by-country layout) with a new `listed` status, keeping one identity path, rather than a separate gazetteer store? | **Yes** | the store grows to thousands of places; tooling copes after the split. A second store would mean a second slug and identity path |
| Q-DC5 | Gazetteer records are judged against their target tier (T0 or T1), not the required tier, and get no place page until Usable; they show as pins, light list rows and builder candidates labelled "Not researched yet"? | **Yes** | visitors see unresearched names (honestly labelled, P2, T3); without this, nothing bulk can be committed or shown |
| Q-DC6 | Areas at scale: approve each country's proposed area table in one pass, instead of deciding each new area one by one (3.7.1)? | **Yes** | less control per area, much faster; areas can be merged later through retire and alias |
| Q-DC7 | A second data seat (Sonnet and Haiku) for the gazetteer, so DATA-PLAN's queue keeps its order? | **Yes**, from bundle D's window | more parallel work to coordinate; without it the gazetteer starts after bundle E |
| Q-DC8 | Use Overture places (CDLA-Permissive-2.0) as a discovery list for activity operators, facts always read from the operator's own page? | **Yes** | one more licence line; without it, operator discovery is manual searching |

## 10a. Sources read for this page (27 Oct 2026)

- UN Tourism, international arrivals 2025: https://www.untourism.int/news/international-tourist-arrivals-up-4-in-2025-reflecting-strong-travel-demand-around-the-world
- UN Tourism, World Tourism Barometer, January 2026 excerpt: https://pre-webunwto.s3.eu-west-1.amazonaws.com/s3fs-public/2026-01/World_Tourism%20Barometer_Jan26_excerpt_v2.pdf
- Wikipedia, World Tourism rankings (order only; CC BY-SA text not copied): https://en.wikipedia.org/wiki/World_Tourism_rankings
- World Bank WDI `ST.INT.ARVL`, CC BY 4.0, API read once: https://api.worldbank.org/v2/country/all/indicator/ST.INT.ARVL
- Overture attribution and licensing: https://docs.overturemaps.org/attribution
- Protected Planet terms: https://protectedplanet.net/c/terms-and-conditions
- openrouteservice plans and restrictions: https://openrouteservice.org/plans/ and https://openrouteservice.org/restrictions/

## 11. Gotchas

- **WDPA looks like the obvious global parks source and is not allowed** (commercial use and redistribution forbidden). Use Wikidata, national open data, EEA CDDA and OSM.
- **Arrivals are not tourists.** WDI mixes same-day visitors in. Never quote WDI numbers as "tourists".
- **Administrative reforms move regions:**
  - Vietnam merged its provinces in 2025 (63 to 34), and ISO 3166-2 may lag. Use Wikidata's current P300 and keep old ids as aliases.
  - Region groups (DC-5) are ours; never copy a Wikivoyage tree.
- **Wikidata coordinates for large features are centroids.** A lake or park centroid is `point_role: centre`, and for distances it is `approx` until a better point exists (T5).
- **Name collisions at scale.** "Lake Louise" or "Saint-Jean" exist many times. Only an id match auto-merges.
- **Pageview bias.** Sub-features under-score and roadside views over-score (relevance 2.3). Fame is a candidate order, never the published judgement.
- **The towns layer is anchor-bound.** A new country needs anchors before `derive-near` can work. Run `towns.py build` per wave, then `derive-near --write`.
- **The public repository.** Gazetteer shards are open data plus our summaries; our research layers follow whatever QR2 decides.
- **Commons is the bottleneck,** not tokens. Plan photo runs, never parallel.
- **Do not prerender gazetteer pages and do not add them to a client index.** Either one breaks the build budgets (P8, P9).

## Change log

| Date | Change |
|---|---|
| 2026-10-27 | First version (DATACOVER-SPEC, planner, Opus): tiers T0 to T3 mapped to the capture contract; per-country measurement on `main` 6c422664; waves 0 to 3 from UN Tourism 2024 and WDI 2019; source and licence verdicts with the ODbL analysis; the ingestion pipeline and runbook; sizing; first slice; tasks DC-C to DC-W1; Q-DC1 to Q-DC8. Supersedes in part nearby-and-regions 6.2 (Q60's "later, signed-in" for unresearched places) and entity-graph QG1's wishlist trade-off |
