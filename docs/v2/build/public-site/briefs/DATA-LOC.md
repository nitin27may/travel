# DATA-LOC: every location has the basics, whether or not a trip uses it (D7, D2b, D5b)

Status: spec, 25 Oct 2026 (owner request, this session). Nothing in this brief is built yet. Owner words, summarised: widen the search; every
location (city, lake, nature, trail, activity) should carry basic facts even when no trip plans it; images for every location, from wherever
licensed images can be found; trail facts (length, gain, difficulty) with links; parking when a place needs a car; booking when an activity
needs one; the same record shape must load into Neon Postgres; make adding locations easy.

Read with [DATA.md](DATA.md) (batches D1 to D6) and [research/README.md](../../../../research/README.md) 3e. The rules there stay: data only, a
source row, a read date and a basis for every value, `searched_none` for a gap, link-only platforms never a source of a stored value.

## 1. What the store holds today (25 Oct, `data/locations/locations.json`)

| | count |
|---|---|
| Places | 74 (66 tied to no trip, 8 tied to one) |
| By kind | park 12, town 8, city 8, trail 7, mountain 7, lake 6, region 5, waterfall 4, island 4, viewpoint 3, canyon 3, activity 2, place 2, lighthouse 1, valley 1, drive 1 |
| By country | US 35, CA 22, IT 10, VN 3, FR 2, CN 1, IN 1 |
| With a point | 73 (1 `unconfirmed`) |
| With a Wikidata QID | 66 (8 missing) |
| With an image | 62 (12 missing, all Commons or none) |
| With elevation | 32 |
| With season months | 24 |
| With walk length or gain | 0 of 7 trails |
| With a capture record (parking, links, booking, suitability) | the trip-tied ones only; the 66 others have none |

So the store is a short list of names with a point and a Commons image. Parking, booking, trail numbers and a source row per value are missing for
every untied place. (The wider laundry list of saved posts is private, owner Q75: the store row stays the only public shape.)

## 2. The basics tier (the minimum for any location)

One tier, three layers. Every value carries a source row, read date and basis, or `searched_none` with what was tried (README 7).

| Layer | Fields | Where it lives |
|---|---|---|
| Identity and place | name, kind, city or town, state or region, country (from the area chain), point with `point_role`, nearest town (derived), Wikidata QID, one own-words summary | `locations.json` plus `data/capture/points.json` |
| Image | one licensed photo: file page URL, author, licence, width, search date; else "No licensed photo yet" | `gallery.json` per place (section 4) |
| When | season months, closures status page | store plus capture `access_season` |
| By kind: trail | distance, gain, shape (loop, out-and-back, point to point), surface, difficulty on the local scale (SAC, parks-canada, NPS, YDS and so on) with the scale named, time, dogs, stroller, wheelchair, trailhead point, parking point | capture route plus suitability block |
| By kind: any place reached by car | parking point, fee, capacity note, shuttle or permit rule | capture `access_points`, `access_cost`, `parks_for` |
| By kind: activity or lift | operator, season, duration, price, minimum age, height and weight limits as stated, whether booking is needed (`none_stated` if silent), booking URL, booking window | capture offer record (`price`, `window`, `links.booking`) |
| Links | `official`; `osm`; AllTrails, Komoot, Gaia, Wikiloc as link-only | capture `links` |

Neon: no new shape. `locations.json` already maps to the tables in `data/schema/legacy/locations_schema.sql`, and capture records map to the generated
tables in `data/schema/generated/`. The rule is: **write nothing that does not fit an existing column or capture property**; a new field is a registry
change first (`core/src/schema/capture/properties.ts`), never a free-text blob.

## 3. Trail numbers and AllTrails

- Order: computed OSM track (no request, `data/tracks/`), then the official park or operator page, then a marked estimate. This is D3a, extended to
  the 66 untied trails and every trail kind in the store.
- AllTrails stays a **link**: `links.alltrails` holds the URL where an official page or a person links it. We do not fetch its pages, store its
  ratings, reviews, counts or ranks, or take its coordinates (README 7; it blocks bots and its terms forbid scraping). Same for Komoot, Gaia, Wikiloc.
- **Owner decision needed (Q-LOC-1):** if you read a trail's AllTrails page yourself, may we store the four basic numbers you type in (length, gain,
  difficulty label, time) as `basis: owner_stated`, flagged "source: owner read AllTrails", never ratings or reviews? Default until you answer: no.
  Official pages and the OSM track are tried first for every trail, so this only fills what both leave empty.

## 4. Photos: widen the sources, keep the licence rule

Owner asked for photos from wherever they can be found, and downloaded if public. Decision: **widen to every source whose licence lets us reuse the
file with credit; do not take a file just because it is publicly visible.** A public web page, a non-commercial site and a friend-and-family audience
do not change who holds the copyright; an unlicensed photo is not ours to copy. For an unlicensed photo we store a link card (title, page URL, no
image) or leave "No licensed photo yet".

Order, one runner, one request at a time (the Commons 429 rule in `method/lanes/media.md` applies to every service):

1. Wikimedia Commons (geosearch 1 km, category, Wikidata P18).
2. Openverse (one API over Flickr, Geograph, museum and agency collections; filter `license` to CC0, PDM, BY, BY-SA).
3. Flickr, CC0 / CC BY / CC BY-SA / "no known copyright restrictions" only (free API key needed: Q-LOC-2).
4. Geograph (CC BY-SA, UK), US National Park Service and other public-domain government media, Parks Canada and agency pages that state an open licence.
5. Unsplash and Pexels: free to use under their own licence, not Creative Commons. Allowed, with the licence text and photographer recorded as the licence.
6. The owner's own photos.

Record per photo: file page URL, author, licence (from the file's metadata), width at least 1600 for a hero, search date, `subject_check`. Reject
"all rights reserved" and "no derivatives" files (we resize and crop). "Non-commercial" (NC) files are allowed while the site earns nothing and the
licence is recorded, so they can be dropped in one query if that ever changes. This needs `tools/gallery/` to learn Openverse, Flickr and Geograph (builder work, section 7). It also changes README 3e item 4
and `method/lanes/media.md` section 5; both are edited with this brief.

## 5. Easy way to add a location

Today `locations.py add` resolves one place at a time, and `edit` has no flag for Wikidata, elevation, image, parking or booking. Proposed (builder work):

1. `locations.py quick-add names.txt` (one `Name, Country[, kind]` per line) creates the rows with the existing Wikidata then Nominatim resolution, one request a
   second, and prints the ones that came back ambiguous.
2. `locations.py basics --report` lists every place by missing basics layer (section 2) so the researcher works the worst first. This is the table in section 1 as a command.
3. `edit` gains `--wikidata`, `--elevation-m`, `--image`, and a `capture` sub-command that opens (or creates) the place's capture record for parking, links and booking.
4. A place with no trip gets its capture records in a trip-less lane (proposed `data/capture/wishlist/`, trip id `wishlist`), using the same schema, so the
   validators, gap reports, suitability sidecars and the Neon load treat them like any trip's. **To verify in step 1:** that the validators accept a lane
   that is not in `data/trips/` (the page-key file `data/locations/page-keys.json` already gives such places a `loc:<id>` ref).

## 6. Steps

| Step | Work | Owner kind | After |
|---|---|---|---|
| L1 | Builder: the section 5 tools and the trip-less lane; verify the validators | travel-builder | none |
| L2 | Basics for the 74: Wikidata QID (8 missing), elevation (42 missing), point (1 unconfirmed), season months, summary, `official` and `osm` links, by kind the trail, parking and booking fields | Opus researcher | L1, D1 merged |
| L3 | Photos for the 74 (12 missing first), then every trail, activity and stop; the wider source order of section 4 | researcher, one runner | L1 media tools; D5a shares this runner |
| L4 | Cross-check pass: the store against capture records, points, tracks and the relevance sidecars; one `gaps --basics` report; conflicts recorded, none picked silently | verifier | L2, L3 |
| L5 | Grow the list: the saved-post captures and the plan's named but unresearched places (`research/inbox/`), through `quick-add` then L2 | researcher | L1 |

Run order with the DATA batches: D1 (done, `public/DATA-D1`), then L1 and D6a/D3a/D4a in parallel on disjoint files, then L2 and D5a/L3 (one photo runner
at a time, never two agents on Commons), then L4.

## 7. Open decisions

- **Q-LOC-1** Store hand-typed AllTrails basics as `owner_stated`? (section 3; default no)
- **Q-LOC-2** Flickr API key: create a free non-commercial key and put it in the local environment (never in a file); Openverse works with a keyless anonymous rate limit.
- **Q-LOC-3** The `wishlist` trip-less lane for untied places (section 5.4), or a second table. Recommended: the lane, so the Neon tables stay one set.
- **Q-LOC-4** README 3e widened as in section 4: edited with this brief; revert it if you want Commons only.
