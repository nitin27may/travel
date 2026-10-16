---
name: location
description: Capture a place, trail, viewpoint, activity or road trip into the structured location list (locations/locations.json) with country > region > area > place hierarchy, coordinates and the source post. Use when Nitin names a place to remember, pastes or screenshots a saved Instagram/Facebook post, says "add this to the list", or asks "what do we have in Quebec". Capture only; no itinerary research.
---

# Location capture

The laundry list. Everything Nitin wants to remember goes into `locations/locations.json`
as structured data; `locations/WISHLIST.md` is regenerated from it. There is one copy, in this
repo. The Obsidian `Location.md` is retired and points here.

Capture is cheap and fast. Research (hours, prices, trail verification) happens later, when a trip
adopts the place. Numbers from a social post are stored as `stats` and stay `unverified`.

## Steps

1. **Extract.** From the message, screenshot or caption, list every place named. A list post
   ("5 hikes in Quebec") is one place per item plus, if it is a route, one collection. A road trip
   is a collection of places in the post's order. Keep stats exactly as written (km, gain, time).
2. **Hints.** Give the tool what you know: `--country`, `--region` (ISO code: QC, AB, NY), `--area`
   (park, valley, resort or town the place sits in; only when the post or your knowledge is
   certain), `--kind`, `--tags`, `--season`, `--kid`, `--stats`, `--note`, `--source`.
3. **Add.** One call per place:

   ```bash
   python3 _system/tools/locations.py add "Mont du Dôme" --country CA --region QC --area "Zec des Martres" \
     --kind trail --tags fall-colours,family --season Sep,Oct --kid strong-kid \
     --stats '{"km": 9.5, "gain_m": 543, "hours": "3.5-4"}' --note "3-summit loop; Saint-Michel quietest" \
     --source "https://www.instagram.com/p/..." --source-type instagram
   ```

   For five or more places write a batch file in `locations/inbox/<date>-<topic>.json` (shape:
   `{"places": [spec...], "collections": [...]}`, spec keys match the flags) and run `import`.
4. **Ambiguity.** Exit code 2 prints candidates. Pick by country and description yourself when
   one is obviously right; ask Nitin one question only when two are plausible (two Moss Glen Falls).
   Re-run with `--pick N`.
5. **Duplicates.** Exit code 1 with `DUPLICATE of <id>` means the place exists (same id, same
   name in the region, or within 1.5 km). Do not add; if the new post has new facts, merge them
   into the existing entry's `notes`, `stats` and `sources` by editing the JSON, then `render`.
6. **Screenshots.** Copy the image into `locations/inbox/` named `<date>-<slug>.jpg` and put
   that path in the source entry as `"screenshot"`. The post link goes in `url` when known.
7. **Finish.** `validate` runs automatically through the hook on every write to the JSON. Commit
   and push (`destinations: add <n> places (<topic>)`). Reply with one line per place:
   name, resolved chain (Canada > Quebec > Charlevoix), kind, and anything unresolved.

## Resolution rules

- Wikidata first (coordinates, administrative chain, country, elevation, a Commons image), then
  Nominatim. Both need a user agent and one request a second; the tool does this.
- The region is the first ancestor with an ISO 3166-2 code; the area is the protected area the
  place is in (Wikidata P3018), otherwise the direct parent, otherwise your `--area` hint. Always
  check the printed chain. A wrong parent is worse than a missing one.
- If neither resolver finds the place, add with `--offline` plus `--country`, `--region`, `--area`
  so the hierarchy is still right, and say so; `validate` will flag the missing coordinates until
  someone supplies `lat`/`lon`.

## Reading saved posts in bulk

- Instagram or Facebook data export ("Saved" in JSON): parse the links and captions, resolve the
  places, then check the posts whose caption names nothing in the browser (location tag, pinned
  comment). Only download a video (`yt-dlp` plus frame extraction) when the caption and location
  tag give no place at all.
- Pilot on 10 posts and report the hit rate per source before running the rest.

## Do not

- Do not research hours, prices or trail conditions here; that is the trip-planner's job.
- Do not write to the Obsidian vault.
- Do not invent a region or area; leave the hint out and let the resolver answer, then check it.
