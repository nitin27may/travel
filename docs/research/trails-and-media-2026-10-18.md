# Trail maps and images: research and product recommendations (owner feedback, 17-18 Oct 2026)

Research checked 2026-10-17 and 2026-10-18 (web research plus live probes from this machine, marked "probed"). Written for whoever plans the next version (the from-scratch plan in `docs/v2/`, or the current `docs/PLAN-platform.md`); it does not assume either structure. Section numbers such as 0A.4, 2.5 or R17 refer to `docs/PLAN-platform.md` (revision 4). Where a recommendation names a table or column, read it as the shape of the data, whether it ends up as JSON in git or as Postgres tables (`docs/BLUEPRINT.md`).

The owner's feedback this answers: (1) past trips must not show by default; trips need a status; a done trip should be a reusable template anyone can copy; (2) the deep-forest look does not suit everything; (3) there is no trail map anywhere; every trail needs one, AllTrails-style if nothing better; (4) more relevant images and galleries for trails and destinations, with licences, and a way for users to add images; (5) trip naming, layout, photos and gallery need to be better, soon.

## Contents

1. Trail maps: embeds, open geometry, live coverage, the fallback chain
2. Images: sources, licences, search, storage, uploads
3. The media record
4. Trip status, visibility and templates
5. Naming conventions for trips, editions and days
6. The trip page
7. Design restyle: why tokens make it cheap
8. Risks and decisions for the owner
9. Sources

## 1. Trail maps: embeds, open geometry, live coverage, the fallback chain

Checked 2026-10-17 (web research plus live probes against six trails we hold: Laguna de los Tres, Laguna Torre, Plain of Six Glaciers, Mont du Dôme, Cinque Torri, and Fitz Roy, which is the same route as Laguna de los Tres).

**Main finding.** OSM has usable geometry for 5 of the 6 trails, but **Waymarked Trails no longer serves GPX from its API** (probed): `/api/v1/details/relation/{id}/geometry/gpx`, `/geometry`, `/geometry/geojson` and `/gpx` all return 404. The site builds GPX in the browser (`get_gpx()` in `hiking.waymarkedtrails.org/build/main.js`). The endpoint that works is `GET https://hiking.waymarkedtrails.org/api/v1/details/relation/{id}`. It returns each member way as a LineString in **EPSG:3857**, so reproject to 4326, plus `route.length` in metres.

### AllTrails

| Question | Answer |
|---|---|
| Embed | Share > Embed gives `<iframe class="alltrails" src="https://www.alltrails.com/widget/trail/{country}/{region}/{slug}" ...>`. Probed: `/widget/trail/argentina/santa-cruz/laguna-de-los-tres` returns 200 with `X-Frame-Options: ALLOWALL` to browser headers (Mapbox GL page, polyline inline, no key). A bare curl gets 406; `/trail/...` pages get 403 (bot block) |
| Terms (updated 17 Dec 2025) | "The Products must not be framed on any other website, nor may you create a link to any part of the Products unless you have written permission." Licence is personal non-commercial. "Distribution Content" is allowed only in blogs and reviews, may carry trackers, and can be withdrawn. Scraping is banned, and robots.txt disallows nearly everything |
| API | None public |
| Offline | No (live Mapbox tiles) |
| **Verdict** | **Link-out only.** No embeds in a multi-user product without written permission. Never extract the polyline or GPX |

### Alternatives

| Source | Embed or geometry | Terms | Verdict |
|---|---|---|---|
| Komoot | `https://www.komoot.com/tour/{id}/embed?profile=1&hl=en` | B2B page: "Free for personal and commercial sites, with no rate limits"; public tours only; full ToS not checked | Acceptable embed fallback |
| Wikiloc | Share > Embed Map (iframe, optional elevation and photos) | Terms page blocked by Cloudflare; GPX licence is per uploader | Embed only after the terms are read; never store its GPX |
| Outdooractive | oEmbed for published content; API needs a domain-bound key; white-label is Pro+ | Commercial | No |
| Hiking Project | Still live (REI returned it to its founder in 2020) | No open API confirmed | No |
| Strava | Route embed iframe (routes, not activities) | Terms not checked | No |
| SchweizMobil | Own terms not found; geo.admin.ch allows iframes unchanged | Unverified | Link-out |
| **Parks Canada Trails APCA** | GeoJSON, SHP, KML, ArcGIS REST (`vw_Trails_Sentiers_APCA_V2_FGP/FeatureServer/0`) | **OGL-Canada**, modified 2026-07-22 | **Primary for Canadian parks** |
| **NPS Public Trails** | ArcGIS FeatureServer, GeoJSON and PBF, 2,000 records a query | CC BY 4.0 (data.gov) | **Primary for US national parks** |
| **USFS NFS Trails** | EDW MapServer and ArcGIS hub | CC BY 4.0; coverage varies by forest | Primary for US national forests |
| Argentina APN | No open trail dataset found (portals timed out or 502) | Unknown | OSM only |
| Overpass | Public instances about 10,000 requests a day, under 1 GB a day, 429 when throttled | **Requests without a User-Agent got 406** (probed) | Build-time only, with a User-Agent |
| OSM tiles | Visible attribution; no prefetch or offline; User-Agent and Referer required | | Never use `tile.openstreetmap.org` |
| OpenFreeMap | Free, no key, no view limits, commercial OK; attribution | | Online basemap |
| Protomaps | Planet PMTiles copied to own storage (R2); `pmtiles extract --maxzoom` for cutouts | ODbL Produced Work | Offline packs |

### Live coverage (probed)

| Trail | OSM | Other open data | Notes |
|---|---|---|---|
| Laguna de los Tres (Fitz Roy) | Relation 4485261 "Sendero Laguna de los Tres", 11,228 m | APN: none | A search for "Fitz Roy" finds nothing; same route |
| Laguna Torre | Relation 9051398 "Senda Laguna Torre" | none | Also named ways |
| Plain of Six Glaciers | Ways only (179152439, 179152440, 128099165, 613989339, 613989340, 1081255556), no relation | Parks Canada: 5 segments (OBJECTID 962, 1073, 1147, 1202, connector 1067) | **Parks Canada is primary** |
| Mont du Dôme (QC) | Relation 9288133 "Sentier du Dôme"; peak node 7878860685 | Sépaq not checked | At the edge of Grands-Jardins |
| Cinque Torri | Ways only ("Giro delle 5 Torri": 229103971, 318733621, 363006574) plus CAI relations nearby | none | **False positive:** Waymarked's top hit, relation 7345182 "Le Cinque Torri", is in Liguria |

**Matching rule:** a name-search hit counts only if its bbox or centroid lies within about 5 km of our trailhead, and a person confirms every match before publishing.

### The fallback chain

| Step | Render | Fields |
|---|---|---|
| 1. Own line from open data | GeoJSON layer over OpenFreeMap or Protomaps; offline once cached | `geometry` (LineString or MultiLineString, EPSG:4326, simplified about 5 m Douglas-Peucker), `geometry_source` (`osm_relation`, `osm_ways`, `parks_canada`, `nps`, `usfs`, `manual`), `source_ids`, `osm_relation_id`, `geometry_licence`, `attribution_text`, `geometry_fetched_at`, `bbox`, `computed_length_km` |
| 2. Third-party embed (Komoot, or Wikiloc once its terms are checked) | Lazy iframe, online only | `embed_provider`, `embed_url`, `embed_terms_checked_at` |
| 3. Pins-only map | Trailhead and destination pins; dashed "approximate" connector or no line | `trailhead_lat`, `trailhead_lon`, `end_lat`, `end_lon`, `end_label`, `route_shape` (out-and-back, loop, point-to-point) |
| 4. Link-out cards (always shown) | Outbound links | `alltrails_url`, `komoot_url`, `wikiloc_url`, `park_page_url` |

Shared stats: `distance_km`, `elevation_gain_m`, `max_elevation_m`, `duration_hours`, `difficulty`, `stats_source`. Elevation profiles come from the stored line sampled against the terrain DEM.

**Never draw a guessed line.** An invented route is a safety liability. When nothing exists, use step 3 and optionally queue the trail for tracing from imagery. A trace contributed to OSM reaches step 1 on the next sync.

**ODbL:** a simplified OSM extract stored in our database is a derivative database. Keep it under ODbL, show "© OpenStreetMap contributors", and keep it separate from closed data.

### Recommendation

1. OSM stays primary. Fetch `/details/relation/{id}` from Waymarked, then reproject, merge and simplify ourselves. Use Overpass `way(id);out geom;` with a User-Agent for trails that exist only as ways.
2. Treat official national datasets (Parks Canada, NPS, USFS) as first-class sources; they win where OSM is fragmented.
3. Fetch geometry at build or research time and store it. The browser never calls Overpass or Waymarked.
4. Basemap from OpenFreeMap online and Protomaps extracts offline.
5. No AllTrails embeds. AllTrails is a link-out card.
6. A person reviews every geometry match before it is published.

Unverified: Komoot's full ToS, Wikiloc's terms, SchweizMobil's terms, APN data availability, Waymarked's API usage policy.

## 2. Images: sources, licences, search, storage, uploads


Checked 2026-10-17 (web research, plus two live probes from this machine marked "probed"). Sources are listed at the end of the plan under "Revision 5".

### Sources and their terms

| Source | Licence and terms | Search by coordinates or id | Rate and access | Verdict |
|---|---|---|---|---|
| **Wikimedia Commons** | per file: CC BY, CC BY-SA, CC0, public domain; credit = author, title if given, link to the source, licence name with a link; follow any credit line the author asks for. Share-alike binds changes to the image itself, not the page it sits on (our reading) | `list=geosearch` with `gscoord=lat|lon`, `gsradius` 10-10,000 m (or `gsbbox`), `gsnamespace=6`, `gsprimary=all` (file coordinates are often secondary), `gslimit` up to 500; metadata `prop=imageinfo&iiprop=url|size|sha1|extmetadata&iiextmetadatafilter=LicenseShortName|LicenseUrl|Artist|Credit|ImageDescription|AttributionRequired`, about 10 files a request (extmetadata is expensive) | Robot policy (updated 16 Mar 2026): Action API unauthenticated concurrency 1 and under 5 requests a second; wait 5 s after any request slower than 1 s; honour `Retry-After` on 429; `upload.wikimedia.org` total concurrency 2 and only originals or **standard thumbnail widths** (20, 40, 60, 120, 250, 330, 500, 960, 1280, 1920, 3840 px; other widths are refused with HTTP 429 "Use thumbnail steps"; enforced since January 2026). User-Agent `<client>/<version> (<contact>) <lib>/<version>` | **Primary** |
| **Wikidata** | CC0 (statements); the images it names are Commons files | P948 (Wikivoyage page banner, a wide hero; it changes sometimes), P18 (image), P373 (Commons category, then `list=categorymembers&cmtype=file`) | same policy | **Primary entry point**: resolve the QID first (places already carry `wikidata`) |
| **NPS** | NPS-created media are generally public domain; some items are third-party and copyrighted; the Arrowhead logo is a trademark | NPS galleries and npgallery by park | none needed | **Second**, per-image credit check |
| **Flickr** (CC) | API terms: an app is commercial if its main purpose is revenue (ads count); show "This product uses the Flickr API but is not endorsed or certified by SmugMug, Inc."; at most 30 Flickr photos a page; remove photos that go private and anything the owner asks within 24 hours; API keys appear to be Pro-only now (Help Center snippet; the page returned 403, not confirmed) | `flickr.photos.search` with `bbox` or `lat`/`lon`/`radius` (under 32 km) plus a limiting parameter (a tag or `min_date_taken`), `license=4,5,7,8,9,10,11,12` (BY 2.0, BY-SA 2.0, no known restrictions, US Gov, CC0, PD mark, BY 4.0, BY-SA 4.0) | about 3,600 queries an hour per key | **Third, optional** (needs a key, Q8); hotlink only, because of the 24-hour removal rule |
| **Unsplash** | free to use; must hotlink `photo.urls`, call `links.download_location` when a photo is used, credit the photographer and Unsplash with `utm_source`/`utm_medium=referral` links; may not replicate Unsplash's core experience | keyword search only, no coordinates | demo 50 requests an hour, production 1,000 an hour (not 5,000; only API JSON calls count) | **Fallback for generic area shots only**, hotlinked; never for a specific trail or viewpoint (keyword search returns lookalikes) |
| **Pexels** | no attribution required by the licence, but the API terms require a prominent Pexels link and photographer credit where possible; no redistribution as a stock or wallpaper service | keyword only | 200 an hour, 20,000 a month | same as Unsplash |
| **Mapillary** | CC BY-SA 4.0; token required; bbox under 0.01 degrees square | by bbox | 10,000 searches a minute | **Not for galleries** (street-level dashcam); possibly a "what the trailhead car park looks like" shot later |
| **Parks Canada** | non-commercial reproduction allowed with title and author credit; commercial redistribution needs Crown Copyright Clearance; the terms page does not apply the Open Government Licence to photos | manual | | **Excluded** while D17 might bring ads or fees; link to the park's page instead |
| **Argentina APN** | text CC BY-NC, photographs all rights reserved | | | **Excluded** |
| Tourism boards (Tourism PEI, Destination Vancouver checked; Banff and Lake Louise Tourism and Destination Canada terms not found publicly) | media-only or promotion-only licences; third-party apps not permitted unless authorised | | | **Excluded** |
| Instagram, Facebook, blogs | not ours | | | **Excluded** (unchanged, 0A.4) |

**Probed 2026-10-17.** `Special:FilePath/<file>?width=720` on a 4,000 px original redirects to the **960 px** standard thumbnail (130,668 bytes; same bytes as `?width=960`), and a file smaller than the request returns the original. So today's app (widths 160, 560, 720, 900, 1400 in `web/components/**`) does not break, but downloads the next standard step up: 160 becomes 250, 560 and 720 become 960, 900 becomes 960, 1400 becomes 1920. Direct `upload.wikimedia.org/.../thumb/...` URLs at a non-standard width are refused. **Rule from now on: request only 330, 960 and 1920** (cards, sheets and galleries, heroes), through one helper (`web/lib/format/image.ts`, M1 step 1).

### Search per subject (the media lane)

1. Resolve the subject's Wikidata QID (places carry `wikidata`; trails and areas get one where it exists). Read P948 (hero candidate), P18 (main image) and P373 (category).
2. Commons geosearch on namespace 6 with `gsprimary=all`: radius 500 m for a place, 2 km for an area centroid, and for a trail one point every 1 km along the stored line (or the trailhead and destination pins when there is no line) at 300 m each.
3. Members of the P373 category (files only), capped at 50.
4. Merge, dedupe on `sha1`, drop non-free licences and files without an author; fetch `extmetadata` for the survivors about 10 at a time.
5. Filter: landscape for heroes (ratio at least 1.4), at least 1,600 px wide for heroes and 960 for gallery; not already used on the same page.
6. Write candidates to the subject's sidecar (`records.media[]`, status `candidate`) and a contact sheet; a person picks (the existing `gallery_pick.py` flow); picks become `approved`.
7. Optional sources (NPS by park; Flickr when Q8 is yes) run after Commons, the same filter and review.

One sequential searcher per host (the 2026-10-12 lesson: four parallel agents caused a 429 that lasted 25 minutes): one worker for the Commons API and, separately, at most two for `upload.wikimedia.org` downloads. The lane is owner-run, cached under `tools/.cache/media/`, never in tests, hooks or builds.

### Storing and serving

| Option | Fit | Verdict |
|---|---|---|
| Hotlink Commons standard thumbnails (330, 960, 1920) | what the legacy pages and the app do today; zero files in the deploy; Commons says hotlinking is "not recommended" but possible; works on `*.pages.dev` | **Phase 1** |
| Self-host on Cloudflare Pages | 500 subjects x 10 images x 3 sizes = 15,000 files, against the 20,000-file free cap with the rest of the site | rejected |
| Self-host on R2 behind a custom domain (`img.<domain>`), WebP at the three widths, EXIF stripped, keys `<source>/<sha1>/<w>.webp` | free tier 10 GB-month and free egress; about 2.3 GB for 15,000 files at 150 KB; `r2.dev` URLs are not for production; needs the custom domain (D14) | **Phase 2**, when the custom domain exists; the `media` rows already carry `sha1` and `storage_key`, so it is a copy job, not a schema change |
| Cloudflare Images / `/cdn-cgi/image/` | 5,000 unique transformations a month free; needs a zone with transformations enabled, so not on `*.pages.dev` (inference: the docs do not mention it) | not before user uploads |
| `next/image` | the default loader does not work in a static export | a custom `loaderFile` that maps to the three widths |

Exceptions: Unsplash must stay hotlinked by its terms; Flickr is hotlinked because of the 24-hour removal rule.

### User-added images

| Step | Phase 1 (owner only) | Phase 2 (others) |
|---|---|---|
| Add by URL | paste a Commons file page URL; the tool reads `extmetadata` and fills licence, author, source | same, plus Flickr and NPS URLs |
| Upload own photo | the owner's files go to `research/` and are committed only after a pick; served from Commons is better: the owner can upload to Commons first (keeps the licence public) | upload through the Worker to R2: the uploader confirms they took it and picks CC BY 4.0 or CC BY-SA 4.0 (or grants the site a licence); EXIF and GPS stripped server-side (orientation kept); Turnstile on the form; an NSFW classifier; Cloudflare's free CSAM Scanning Tool on the serving zone (inferred to cover R2 behind the same zone); every upload lands `candidate` and is never auto-published |
| Legal | none beyond attribution | a DMCA designated agent (US$6, renewed every 3 years), a takedown policy and a repeat-infringer policy, before the first upload by anyone else |


## 3. The media record


**Decision (from section 2).** Images are catalog rows in a new `media` table, found by a `media` research lane that starts from Wikidata and Commons, credited on every display, hotlinked from Commons at three standard widths in Phase 1 and copied to R2 when the custom domain exists. Source order: the owner's own photos (uploaded to Commons first, so the licence is public), Wikidata P948 and P18, Commons geosearch plus the P373 category, NPS public domain (checked per image), Flickr CC (optional, Q8), Unsplash or Pexels only for generic area shots. Excluded: Parks Canada photos (commercial redistribution needs clearance), APN, tourism boards, Instagram, Facebook, blogs.

**`media` table** (`data/catalog/media/<CC>.json`; catalog common block not applied, because an image has no kid fit or grade; its own provenance columns instead):

| Column | Type | Null? | Rule |
|---|---|---|---|
| id | text | no | `md-` plus the first 12 hex of the file's `sha1` (the same image used by two subjects is one row) |
| subjects | json | no | `[{entity, id, role, rank}]`: `entity` in `place`, `area`, `trail`, `activity`, `stay`, `trip`; `role` in `hero`, `gallery`, `card`; `rank` orders the gallery. One subject may have one `hero` |
| source | text | no | `commons`, `nps`, `flickr`, `unsplash`, `pexels`, `owner`, `user` |
| source_id | text | no | Commons file title, Flickr photo id ... |
| source_url | text | no | the file page (the attribution link) |
| url | text | no | the original or the largest allowed rendition |
| thumbs | json | no | `{"330": url, "960": url, "1920": url}`; only standard widths for Commons |
| width, height | int | no | of the original |
| sha1 | text | no | from Commons `imageinfo`, else computed; dedupe key |
| mime | text | no | |
| licence | text | no | SPDX-style: `CC-BY-4.0`, `CC-BY-SA-4.0`, `CC-BY-SA-3.0`, `CC-BY-2.0`, `CC0-1.0`, `PD`, `PD-USGov`, `Unsplash`, `Pexels` |
| licence_url | text | no | |
| attribution_required | bool | no | |
| author | text | no | plain text (Commons `Artist` is HTML; sanitise) |
| author_url | text | yes | |
| credit_raw | text | yes | the source's own credit line, kept verbatim for checking |
| caption | text | no | our words, at most 120 characters |
| alt | text | no | written by hand for what the image shows, never copied from the description |
| lat, lon | real | yes | where taken, when the source states it |
| taken | date | yes | |
| status | text | no | `candidate`, `approved`, `rejected`, `withdrawn` (the source removed it or asked) |
| rejected_reason | text | yes | |
| hotlink | bool | no | true for Commons in Phase 1, Unsplash and Flickr always |
| storage_key | text | yes | `<source>/<sha1>/` once copied to R2 (Phase 2) |
| contributed_by | json | no | actor ids (the lane, the owner, later a user) |
| approved_by, approved_at | text, date | yes | |
| retrieved | date | no | |

The legacy `gallery.json` files (Patagonia 42 photos, Switzerland, Dolomites, Costa Rica, Chamonix and others) map one to one: each photo becomes a `media` row with `subjects: [{entity: "trip", id: <slug>, role: "gallery"}]`, and where its section names a place in the store, a second subject for that place. M1 writes the importer; places' current `image` column (52 of 64 places have one) becomes a `hero` media row each, and the column is then derived from `media` (kept for the legacy list page until P6 retires it).

**Components and flows.** `Gallery` (grid by section, lightbox with arrows, keys and swipe, the existing behaviour of `gallery.py inject`), `PhotoStrip` (at most 4 inline photos on a day, place or trail), `HeroImage` (with a visible credit line), `Credit` ("Photo: {author} / {licence, linked} / via {source, linked}"; "resized" added for re-encoded BY-SA files; "Courtesy NPS" for public domain), a per-page "Photo credits" list in the footer, and the Flickr disclaimer when a Flickr photo is on the page. "Add a photo" on place, area, trail and trip pages: in Phase 1 it opens the owner's local flow (paste a Commons URL; the local API calls `media.add`, which reads `extmetadata` and creates a `candidate`); on the deployed static site it explains where adding works. Review is the existing `/review/` queue with a media tab (approve, reject with a reason, set hero, reorder).

**Moderation if others contribute (Phase 2).** Every contributed image lands `candidate`; nothing is auto-published; uploads follow the table in section 2 (licence choice, EXIF stripped, Turnstile, NSFW check, CSAM scanning, DMCA agent and takedown policy before launch); a takedown sets `withdrawn` and removes the R2 copy within 24 hours.

**Operations.** `media.add` (by URL or from a lane sidecar; writes `candidate`), `media.approve`, `media.reject`, `media.attach` (add a subject and role), `media.detach`, `media.set_hero`, `media.reorder`, `media.withdraw`; reads `media.for` (subject) in the catalogue and as MCP read tool `get_media`.


## 4. Trip status, visibility and templates


**Why.** `/trips/` and the home page list 14 legacy trips; five of them ended between 29 Aug and 12 Oct 2026 (Niagara, Quebec, New Hampshire, Vermont, Algonquin) and still sit beside Patagonia 2027. The product is also opening to other people, so a finished, well-researched trip is worth more as a plan someone else can reuse ("summer in Banff" works every summer) than as an archive entry.

### Status

`trip.status` is replaced (schema bump, trip family v1 to v2, `core/src/migrate/trip-v2.ts`, per the 2.5 policy):

| Status | Meaning | Set by | In default lists | May be offered as a template |
|---|---|---|---|---|
| `draft` | just created (by hand, by the builder, or copied from a template); not researched | `trip.create`, `trip.copy`, `trip.use_template`, the builder | only to its owner (a draft is `private` unless the owner changes it) | no |
| `planning` | research and the day plan in progress | owner | yes | yes, if `visibility: public` and `web_published: true` |
| `booked` | the bookings that matter are made | owner (the UI suggests it when every `must`/`urgent` booking is `booked` or `paid`) | yes | yes, same condition |
| `done` | travelled, or the dates passed | owner; the build suggests it (below) | **no** | **yes (the main case)** |
| `archived` | dropped, superseded or withdrawn | owner | **no** | no; archiving withdraws a template offer (existing copies keep their lineage) |

Old to new values: `idea` to `draft`, `researching` and `planned` to `planning`, `booked` stays, `travelled` to `done`, `dropped` to `archived`. No `data/trips/*` file exists yet (P4c has not run), so the migration touches fixtures and the ops that set a status (`trip.copy` sets `draft`, not `idea`); P4c writes v2 directly.

**Derived "past".** At build, `ended = true` when the chosen or booked edition's `end` is before the build date (`HUB_TODAY` in tests). A trip that has `ended` but whose status is `planning` or `booked` is treated as `done` by the default filter and shows the owner a badge "Ended 4 Oct 2026: mark as done?" (`trip.set_status`). Status is never changed silently. A trip with no edition never ends (an undated template stays where its status puts it).

**Edition status follows.** `editions.status` keeps its own enum (`candidate`, `chosen`, `booked`, `travelled`, `cancelled`). `trip.set_status done` also marks the chosen or booked edition `travelled` and proposes `place.visit_add` for every place used (G6, unchanged).

### Default filters and lists

| Surface | Default | Changing it |
|---|---|---|
| `/trips/` | `status` in `draft` (owner only), `planning`, `booked`, and `ended = false`; sorted by next edition start, undated last | a "When" chip group: Upcoming (default), Done (`n`), Archived (`n`), All; the URL carries `status=` only when it differs from the default, so shared default links stay short |
| Home page | upcoming trips only (as today's "Upcoming"), plus "Done trips (5)" and "Templates (n)" links | none |
| `/templates/` (new route; `templates` added to the reserved slugs of 1.1) | trips with `template: offered`, `visibility: public`; cards show length, months, region, party fit and "Based on a trip done in Feb 2027" | the usual filter bar: region, length, months (`season`), style, kid fit |
| `/places/`, `/trails/` "part of N plans" | counts every non-archived trip; done trips count (they are evidence) | none |
| `/data/trips.json` | every public trip with `status` and `ended`, so a third party can apply its own filter | none |

**Legacy trips.** The 14 served legacy pages have no `trip.json`. `legacy/MANIFEST.json` gains, per trip folder, `status` and `template` (the owner confirms the values). The proposed values from the hub's dates (read 18 Oct 2026):

| Legacy slug | Dates (hub) | Proposed status | Proposed template |
|---|---|---|---|
| `niagara-day-aug-2026` | 29 Aug 2026 | `done` | `offered` (a day-trip template) |
| `quebec-sept-2026` | 29 Sep - 1 Oct 2026 | `done` | `none` (discussion-stage page) |
| `new-hampshire-stopover-2026` | 30 Sep - 1 Oct 2026 | `done` | `none` |
| `vermont-fall-2026` | 1-4 Oct 2026 | `done` | `offered` (fall foliage long weekend) |
| `algonquin-muskoka-oct-2026` | 10-12 Oct 2026 | `done` | `offered` (Thanksgiving weekend) |
| `costa-rica-feb-2027`, `patagonia-feb-mar-2027`, `dolomites-july-2027`, `switzerland-2027`, `iceland-ring-road`, `chamonix-mont-blanc-sept-2028`, `canadian-rockies-sept-2029` | 2027-2029 | `planning` | `none` until done |
| `norway-summer`, `usa-southwest-rockies` | dates open | `planning` | `none` |

A legacy template's "Use this template" button is disabled with "Available when this trip moves to the new plan pages" until the trip is imported (copying needs a `trip.json`).

### Templates

A template is not a separate entity. It is an ordinary trip with `template: offered`; copying it makes a new trip.

| Column (trip, revised 5) | Type | Rule |
|---|---|---|
| `template` | enum `none`, `offered` | `offered` needs `visibility: public`, `web_published: true` (or a legacy page) and status `planning`, `booked` or `done` (`E_TEMPLATE_STATE` otherwise) |
| `template_licence` | enum `cc-by-4.0`, `cc-by-sa-4.0`, `all-rights-reserved`, null | required when `template: offered` (Q3 recommends `cc-by-4.0`); covers the trip's own words (day plans, prose, notes marked shared), not the catalog (ODbL, D18) or images (per file, section 3) |
| `copied_from` | json, nullable | `{slug, title, owner_id, author_name, copied_at, source_updated, template_licence}`; set once by `trip.use_template` or `trip.copy`, never edited; drives "Based on <title> by <author>" on the copy's page |
| `author_name` | text | public display name of the owner (`Nitin` today, from `data/reference/actors.json`); the only identity shown publicly |
| `aliases` | json | extra slugs that 301 to this trip (section 5); written into `_redirects` |
| `ended` | derived, never stored | above |

`data/reference/actors.json` (new): `[{id, display_name, kind: "person" | "agent", url}]`, public; `u_owner` is the first row. Phase 2 replaces it with a users table; ids do not change.

**`trip.use_template`** (new operation; `trip.copy` stays for copying one's own trip) does exactly this, in one changelog row:

| Part of the source | In the copy |
|---|---|
| `trip` | new slug from the copier (section 5 convention), `owner_id` = copier, `status: draft`, `visibility: private`, `web_published: false`, `template: none`, `copied_from` set, title kept with "(from template)" dropped once the copier renames it |
| `profile`, `trip_tags`, `day_tracks`, `days`, `items`, `bases`, `trip_trails`, `trip_activities`, `routes`, `hazards`, `weather_rules`, `packing`, `documents` (rules only), `gotchas`, `knowledge`, `sources`, `research_refs` | copied as references (catalog ids unchanged); item times and legs kept |
| `editions` | **cleared**; the copy has no dates until the copier adds an edition (`edition.add`) |
| `trip_bookings` | kept as rows with `offer_id`, `used_days`, `priority`; `status` reset to `todo`; `book_by_offset` recomputed when an edition is chosen; `price_paid_*`, `confirmation`, `contact`, `deadline_date`, `edition_id` cleared |
| `travellers` | **not copied** (private); the copier enters their own party, and the day checks re-run (a Track A trail may now warn for a 6-year-old) |
| `notes` | only `shared` notes, re-attributed "From the original" |
| `budget` | copied with `basis` kept and a freshness badge; `fare_windows`, `fare_quotes` not copied (dated) |
| `custom_items` | copied |
| `changelog` | one new row: `op: trip.use_template`, `refs: [source slug, source updated]` |

The source trip is untouched apart from a public `used_as_template` counter derived at build from the copies that are themselves public (private copies are not counted, so a copy never leaks).

**Editions and templates.** A trip is season-based already (2.1): days are numbered and deadlines are offsets, so a template carries no dates. The source keeps its own past edition (`travelled`) for its own page; the template card says "Done Feb-Mar 2027" from it. Re-using a template for a new year is the same operation as a stranger copying it: `trip.use_template` then `edition.add`. A template whose trip used a seasonal booking window (Moraine Lake shuttle, Piratour) computes the copier's book-by dates from the catalog offer, so the copy is correct for the new year without editing.

### Multi-user implications (designed now, built in Phase 2)

| Concern | Rule now | Phase 2 |
|---|---|---|
| Ownership | `owner_id` on every trip (exists); `trip.use_template` sets the copier's id; ops check it (0A.4) | per-user ids from D21 auth |
| Attribution of the original author | `copied_from.author_name` and a link to the source, printed on the copy's page and kept if the source is later archived (the link then shows "no longer offered") | the same; a public profile page per author |
| Licence of a shared template | `template_licence` per trip (Q3); the template page shows it in the footer with the catalog's ODbL line and the image credits | a contributor agreement at sign-up |
| Privacy of the copier | a copy is `private` by default; nothing about it is public until its owner publishes it | per-user visibility |
| Abuse | only the owner can offer templates in Phase 1 | templates by others go through a review queue like catalog proposals (D19) |


## 5. Naming conventions for trips, editions and days


**What is wrong today** (from the hub's own list, 18 Oct 2026): the year sits in the slug for 11 trips and not in 4 (`iceland-ring-road`, `norway-summer`, `switzerland-2027` has only a year, `usa-southwest-rockies` none); months are spelled three ways (`aug`, `sept`, `july`); titles carry the dates after a dash ("Dolomites — 13 to 26 July 2027"), so the dates appear twice on every card; lengths mix "14 days" and "13 nights". A template reused in 2028 would carry "2027" in its address and its title.

### Trips

| Part | Rule | Example (Patagonia) |
|---|---|---|
| Title | the place and the idea, **no dates, no length**; at most 48 characters; local spellings with accents (Chaltén) | "Patagonia: Ushuaia, El Chaltén and El Calafate" |
| Subtitle (cards, hero) | generated, never typed: `<days> days · <months> · <party>` | "14 days · Feb-Mar · family, children 11+" |
| Slug (new trips) | `<where>-<idea>-<days>d`, lowercase ASCII, no year, no month; `<where>` is the region or area slug from the place hierarchy; `<idea>` is optional (one or two words: `ring-road`, `larches`, `fall-colours`); at most 48 characters; validated by `W_SLUG_CONVENTION` (a warning, so legacy slugs pass) | `patagonia-14d`, `banff-larches-7d`, `iceland-ring-road-12d` |
| Collision | a numeric suffix (`-2`) in Phase 1; in Phase 2 other users' trips live under `/u/<handle>/<slug>/` and the root namespace stays the owner's | `patagonia-14d-2` |
| Season words | only as an idea where they are unambiguous everywhere (`larches`, `midnight-sun`, `fall-colours`); never "summer" or "winter" alone in a slug, because Patagonia's summer is Canada's winter; the months live in the subtitle and the season facet | |

### Editions

| Part | Rule | Example |
|---|---|---|
| Edition id | `e<YYYY>` or `e<YYYY>-<MM>` when one year has two | `e2027`, `e2028-07` |
| Edition label | `<Mon>[-<Mon>] <YYYY>`, plus a window name when there are candidates | "Feb-Mar 2027", "Window A: Sep 2027" |
| Where dates appear | the hero's edition picker, day headers (derived), cards ("Next: Feb-Mar 2027" or "Done Feb-Mar 2027") | never in the title or the slug |

### Days

| Part | Rule | Example |
|---|---|---|
| Heading | `Day <n>: <title>`; the date and weekday come from the edition and are shown beside it, never typed into the title | "Day 8: Laguna de los Tres" with "Thu 4 Mar" |
| Title | the main thing of the day, at most 40 characters; travel days are `<from> to <to>` | "El Chaltén to El Calafate" |
| Day 0 | "Before Day 1: <what>" | "Before Day 1: overnight to Buenos Aires" |
| Anchor | `#day-<n>`; `#day-<n>-<track>` for a track tab | `#day-8-b` |
| Kind chip | from `days.kind` (`travel`, `hike`, `sightseeing`, `city`, `rest`, `buffer`, `mixed`) with an icon, so the day rail reads at a glance | |

### Existing slugs: no URL breaks

Published slugs stay canonical (R17: slugs are frozen once published; changing them would also orphan the checklist ticks stored under `<slug>:<id>` in localStorage, 4.10, and the OG previews already shared). The convention applies to **titles and subtitles at once** (the P5a page and the P3c list show the convention title for legacy trips from a `title` override in `legacy/MANIFEST.json`) and to **slugs of new trips** only. A convention alias may be added per trip in `trip.aliases`, served as a 301 to the canonical slug:

| Canonical (kept) | Convention title | Alias (301 to canonical, optional) |
|---|---|---|
| `patagonia-feb-mar-2027` | "Patagonia: Ushuaia, El Chaltén and El Calafate" | `patagonia-14d` |
| `canadian-rockies-sept-2029` | "Canadian Rockies: Banff, Jasper and Kananaskis" | `canadian-rockies-15d` |
| `vermont-fall-2026` | "Vermont: the Notch and the Kingdom" | `vermont-fall-colours-4d` |
| `iceland-ring-road` | "Iceland: the Ring Road by camper van" | `iceland-ring-road-12d` |

A copy made from any of these templates gets a convention slug from the start. Q4 records the choice; the alternative (rename the slugs and redirect the old ones) is rejected because the localStorage ticks and shared links are worth more than tidy addresses.


## 6. The trip page


The data spine of 4.5 stands (every table still renders). What changes is the order, the naming, and three things the legacy pages do well and the 4.5 list buried: the stays as a timeline, stop-by-stop road-trip days, and photos where the reader is.

| # | Block | Contents | Component | Data |
|---|---|---|---|---|
| 1 | Hero | full-bleed photo (`media` role `hero` of the trip, else of its first base), title, generated subtitle, status pill, edition picker, countdown; for a template "Use this template" and "Done Feb-Mar 2027"; for a copy "Based on <title> by <author>" | `TripHero`, `EditionPicker`, `Countdown`, `TemplateBar` | trip, editions, media, copied_from |
| 2 | At a glance | days, nights, bases, km driven, km walked (Track A and B), hardest trail badge, bookings due in the next 30 days, total cost range | `NumbersStrip` | derived |
| 3 | The answer first | the plan in a paragraph | `Prose` | `answer_prose` |
| 4 | Route and stays | one map with bases and the legs between them; under it the **stays strip**: a horizontal bar, one segment per base sized by nights, with check-in and check-out dates and the booking state | `RouteMap`, `StaysStrip` | bases, days, legs, trip_bookings |
| 5 | Before you go | three tabs: Bookings (the book-by timeline with ICS), Checklist (documents and packing, ticks in localStorage), Hazards (the severity-3 items first, the rest collapsed) | `BookingTimeline`, `Checklist`, `HazardList` | trip_bookings + offers, documents, packing, hazards |
| 6 | Days | a sticky **day rail** (Day 1..N with date, kind icon and base; a horizontal scroller on phones) and one section per day in order: heading (Day N: title, date, base, sunrise and sunset), a **per-day map**, the timeline of items as cards with time chips and the leg between each pair ("75 km, 1 h 10, matrix"; road-trip days render as `RouteStrip`, stop by stop, with fuel and closure chips), track tabs A/B/C when split, the Plan B card, weather-rule chips, day-of links, the bookings used that day, and a photo strip of that day's places and trails | `DayRail`, `DaySection`, `DayMap`, `TimeChips`, `ItemCard`, `LegChip`, `RouteStrip`, `TrackTabs`, `PlanBCard`, `WeatherRuleChip`, `DayOfLinks`, `PhotoStrip` | days, day_tracks, items, legs, weather_rules, media |
| 7 | Gallery | the trip's photos grouped by place in day order, assembled from `media` of the places and trails the trip uses plus the trip's own picks (`media.subject_entity = trip`); lightbox; every photo credited | `Gallery` (M1) | media |
| 8 | Reference | trails as cards with a mini map and badge, linking to `/trails/<id>/` (the trail pages, section 1); activities with fit; stays; budget; gotchas; emergency per base; state of knowledge; open questions; change log | `TrailCards`, `AdventureTable`, `StayTable`, `BudgetTable`, `GotchaList`, `EmergencyCards`, `KnowledgeTable`, `QuestionList`, `ChangeLog` | as 4.5 |

Rules: the day rail and scrollspy replace the legacy sticky nav; "today mode" opens on today's day; every map is followed by its text equivalent (0B.6); a block with no data is omitted, not shown empty; photos never repeat between the day strips and the gallery's first row (the strip shows at most 4, the gallery the rest).

**Migration of legacy pages.** The plan-page work renders the two imported trips (Patagonia, Rockies) on this spine and switches each one only after the owner's review (unchanged rule). The other 12 follow by D15 (next travel date: Costa Rica, Dolomites, Switzerland, Iceland, Chamonix, Norway, Utah) as each is imported; the five done trips are imported only if they are offered as templates (Vermont, Algonquin, Niagara proposed), because importing is how a template becomes copyable.


## 7. Design restyle: why tokens make it cheap


**Input.** Another agent is writing three design directions with live previews in `docs/design/`. The owner picks one (Q1). The restyle implements it and, since the pick is not known yet, is specified as a function of two inputs the chosen direction must supply:

| Input | File (written by the design agent or by the restyle from the chosen preview) | Contents |
|---|---|---|
| Tokens | `docs/design/<direction>/tokens.json` (copied to `data/design/tokens.json`, the committed source) | colour roles for light and dark (the existing role names: `bg`, `surface`, `surface-2`, `line`, `line-2`, `ink`, `ink-2`, `muted`, `accent`, `accent-ink`, `accent-text`, `accent-soft`, `teal` (renamed `info` only if the direction asks; the alias stays), `header`, `warn`, `ok-text`, `focus`, `scrim`, `st-*`), type (three families with self-hostable OFL or Apache files, a size scale, weights, line heights), radii (`radius`, `radius-sm`, `radius-lg`), spacing scale, shadows (`shadow-1`, `shadow-2`), motion (`ease`, durations), grade colours for house grades 1-5 with dash patterns, day colours (8, colour-blind safe) |
| Layout rules | `docs/design/<direction>/layout.md` | page widths, header style (solid, transparent over hero, condensed on scroll), card anatomy (image ratio, title placement), list density, the hero treatment, the day rail placement, map frame style |

**Why it is cheap.** The current app already put every colour behind role tokens: `web/app/themes.css` is generated by `tools/theme_tokens.py`, `web/app/app.css` uses `var(--...)` 199 times and no colour literal (a test enforces it), and components use semantic classes (`.card`, `.card-media`, `.seg`) rather than inline utilities. Two things are not yet tokens: the shell palette is a Python dict inside `tools/theme_tokens.py`, and radius, spacing and easing are literals in `app.css :root`. The restyle moves both into `data/design/tokens.json`, so a future change of direction is a JSON edit plus `python3 tools/theme_tokens.py`.

| Layer | What the restyle does | Re-skinned (tokens only) or re-laid-out (markup and CSS structure) |
|---|---|---|
| Tokens | `data/design/tokens.json` becomes the source; `tools/theme_tokens.py` reads it (and keeps the eight legacy trip themes as `[data-theme]` blocks for plan pages); the AA contrast gate runs on every role pair; `--check` byte-stable | source of everything below |
| Fonts | swap the three self-hosted families if the direction changes them (WOFF2 plus licence files, `@font-face` in `globals.css`); the font test still bans Google Fonts URLs | re-skin |
| Shell (header, nav, footer, theme toggle) | header style, nav placement, footer per `layout.md` | **re-laid-out** |
| Home page | hero band, upcoming trips first, templates row, done trips link | **re-laid-out** (and it gains the status and template sections) |
| Entity pages (filter bar, view switcher, cards, list, table, detail sheet, empty state) | card anatomy and density per `layout.md`; filter bar and table keep their structure and keyboard paths | cards and detail sheet **re-laid-out**; filter bar, list, table **re-skinned** |
| Map views (P3b) | basemap style choice (OpenFreeMap `positron` or `liberty` or `dark` per direction), cluster and pin colours from tokens, frame style | re-skin; `MapView.tsx` itself unchanged except the style id, which comes from a token |
| Place pages | header with the hero image, facts grid, sources; the gallery block arrives with the media work | **re-laid-out** |
| `/about/data/`, `/schema/`, `/review/` | type and spacing only | re-skin |
| Legacy pages | untouched (byte-identical rule) | none |
| Plan pages | not built yet; the plan-page work builds them on the new tokens and layout rules from the start | n/a |

Tests the restyle adds or keeps: the no-hex test (now also over `data/design/tokens.json` consumers), the AA contrast gate on all role pairs in light and dark, `theme_tokens.py --check`, axe on every route, the budget test (a font swap must not push list pages over 200 KB), and visual snapshots of six routes at 1440 and 390 px, at 2x, read in tiles before the PR (house rule). A direction that needs a component library change (for example HeroUI) is out of the restyle's scope and comes back as a decision.


## 8. Risks and decisions for the owner

| ID | Decision | Recommendation | Trade-off |
|---|---|---|---|
| Q1 | Design direction | Pick from the previews; only "Atlas" exists in `docs/design/` so far, and the v2 branch has its own design system | Choosing before the v2 design system is reviewed may mean restyling twice |
| Q3 | Licence for shared templates | `cc-by-4.0` | Lets anyone copy and adapt with credit; share-alike would restrict reuse |
| Q4 | Existing trip slugs | Keep them; new trips use the naming convention | Untidy old URLs, but no broken links or lost ticks |
| Q8 | Flickr as an image source | No for now | Fewer candidates in areas Commons covers thinly; avoids a paid key and the 24-hour removal duty |
| T1 | AllTrails | Link-out only, never embed | No in-app AllTrails map; no terms risk |
| T2 | Trail geometry sources | OSM plus Parks Canada, NPS and USFS, reviewed by a person | Review costs time per trail; an unreviewed name match can put a Liguria route on a Dolomites trail |

| Risk | Mitigation |
|---|---|
| A wrong or guessed trail line used for navigation | Never draw a guessed line; bbox matching rule; human review; pins-only fallback |
| Commons rate limits (429 for 25+ minutes) | One sequential searcher per host; standard thumbnail widths only; cache |
| Third-party embeds withdrawn or terms changed | Embeds are step 2 only, with `embed_terms_checked_at`; link-out cards always shown |
| ODbL contamination of the catalog | Keep OSM-derived geometry in its own table with attribution |

## 9. Sources

Trail maps (checked 2026-10-17):
- AllTrails terms: https://www.alltrails.com/terms
- AllTrails embed: https://help.touchstay.com/en/articles/13715393-how-to-embed-alltrails-in-your-guide
- Komoot embed: https://www.komoot.com/b2b/embed
- Wikiloc embed: https://help.wikiloc.com/article/259-share-embed-iframe-insert-embed-trail-route-wikiloc-web-blog-digital-online-html
- Outdooractive: https://developers.outdooractive.com/Overview/Outdooractive-Platform.html
- Hiking Project status: https://gearjunkie.com/news/rei-adventure-projects-app-split
- Strava route embed: https://help.touchstay.com/en/articles/13715417-how-to-embed-a-strava-route-in-your-guide
- geo.admin.ch embed: https://docs.geo.admin.ch/map-viewer/embed-in-an-iframe.html
- Parks Canada trails: https://open.canada.ca/data/en/dataset/64a90e8d-5bc0-4027-8645-b5881b4068d4
- NPS Public Trails: https://mapservices.nps.gov/arcgis/rest/services/NationalDatasets/NPS_Public_Trails/FeatureServer/0
- USFS trails: https://catalog.data.gov/dataset/national-forest-system-trails-feature-layer-f51e8
- Overpass usage: https://dev.overpass-api.de/overpass-doc/en/preface/commons.html
- OSM tile policy: https://operations.osmfoundation.org/policies/tiles/
- OpenFreeMap: https://openfreemap.org/
- Protomaps downloads: https://docs.protomaps.com/basemaps/downloads
- Waymarked Trails: https://hiking.waymarkedtrails.org/

Images (sections 2 and 3): the source list was to sit in a plan revision that was withdrawn, and the agent stopped before copying it here. The terms quoted in section 2 come from the Wikimedia robot policy, the Commons and Wikidata APIs, the NPS, Flickr, Unsplash, Pexels, Mapillary and Parks Canada terms pages. URLs to be re-added on the next research pass.
