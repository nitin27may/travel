# Maps and Sharable Links

How to produce the Google Maps assets in Phase 5. The user chose **My Maps CSV + clickable links**.

## Contents

- [The places JSON](#the-places-json)
- [Running the script](#running-the-script)
- [Importing the CSV into Google My Maps](#importing-the-csv-into-google-my-maps)
- [Link formats (for manual edits)](#link-formats-for-manual-edits)

## The places JSON

Assemble every place from the itinerary into one JSON file. Full schema is in the header of `scripts/make_maps.py`. Minimum per place: `name` and either `address` or `lat`/`lng`. Add `day`, `category`, `description`, `time_needed`, and `cost` so the CSV is useful and color-codable. Set `home_base` so per-day routes start from the right origin.

Write the JSON to a temp path (e.g. `/tmp/<trip-slug>.json`) — it's an intermediate, not a vault note, so it doesn't need frontmatter and shouldn't live in the vault.

## Running the script

```bash
python3 .claude/skills/trip-planner/scripts/make_maps.py /tmp/<trip-slug>.json --outdir <output-folder>
```

It writes two files:

- `<stem>-mymaps.csv` — import into Google My Maps
- `<stem>-map-links.md` — clickable per-place pins and per-day driving routes

Embed the contents of the links file into the itinerary note (per-day route link at the top of each day, place pins inline or in a map section). Tell the user where the CSV is saved and how to import it.

## Importing the CSV into Google My Maps

Give the user these exact steps:

1. Go to mymaps.google.com and click **Create a new map**.
2. Click **Import** under the untitled layer.
3. Upload the `*-mymaps.csv` file.
4. **Choose columns to position placemarks:** select **Address** (or **Latitude** and **Longitude** if those are filled).
5. **Choose a column to title markers:** select **Name**.
6. Open the layer's **Style** menu, set **Group places by** → **Day** (or **Category**), and pick **uniform style** per group to color-code each day.
7. Click a pin to see its description, time needed, and cost. Use **Share** to send a view/edit link, or the map menu to export to KML for the Google Maps app.

One layer holds up to 2,000 rows and a map up to 10 layers — far beyond any single trip. For a very large multi-week trip, split into one layer per region by importing the CSV more than once with a filter, but this is rarely needed.

## Link formats (for manual edits)

The script handles encoding; use these only when hand-editing the note. Always URL-encode the query.

**Single place pin:**

```
https://www.google.com/maps/search/?api=1&query=<URL-encoded "Name, Address">
```

**Driving route (origin → waypoints in order → destination):**

```
https://www.google.com/maps/dir/?api=1&origin=<enc>&destination=<enc>&travelmode=driving&waypoints=<enc stop>|<enc stop>
```

The existing vault notes also use simple search links like `https://www.google.com/maps/search/Stowe+Vermont` and image/YouTube links — fine for the destination-ideas style, but for itinerary pins prefer the `?api=1&query=` form above, which opens reliably on mobile and desktop.
