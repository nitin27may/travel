---
name: location
description: Capture a place, trail, viewpoint, activity or road trip into the structured location list (data/locations/locations.json) with country > region > area > place hierarchy, coordinates and the source post. Use when Nitin names a place to remember, pastes or screenshots a saved Instagram/Facebook post, says "add this to the list", or asks "what do we have in Quebec". Capture only; no itinerary research.
---

# Location capture

The laundry list. Everything Nitin wants to remember goes into `data/locations/locations.json`
as structured data (schema v3); `data/locations/WISHLIST.md`, the list page `legacy/locations/index.html` and the
globe's `places.json` (the list page and globe pins are legacy outputs, removed at backlog 7.11) are regenerated from it by `locations.py build`. There is one copy, in this
repo. The Obsidian `Location.md` is retired and points here.

Capture is cheap and fast. Research (hours, prices, trail verification) happens later, when a trip
adopts the place, through `research/README.md` sections 3a and 3b (the map of the research system).
Numbers from a social post are stored as `stats` and stay `unverified`.

## Steps

1. **Extract.** From the message, screenshot or caption, list every place named. A list post
   ("5 hikes in Quebec") is one place per item plus, if it is a route, one collection. A road trip
   is a collection of places in the post's order. Keep stats exactly as written (km, gain, time).
2. **Hints.** Give the tool what you know: `--country`, `--region` (ISO code: QC, AB, NY), `--area`
   (park, valley, resort or town the place sits in; only when the post or your knowledge is
   certain), `--kind`, `--tags`, `--season`, `--kid`, `--stats`, `--note`, `--source`. Known coordinates go in
   as `--lat` and `--lon` (skips the resolvers, resolver `manual`). A place whose position is not
   known yet gets `--unconfirmed` instead of a tag.
3. **Add.** One call per place:

   ```bash
   python3 tools/locations.py add "Mont du Dôme" --country CA --region QC --area "Zec des Martres" \
     --kind trail --tags fall-colours,family --season Sep,Oct --kid strong-kid \
     --stats '{"km": 9.5, "gain_m": 543, "hours": "3.5-4"}' --note "3-summit loop; Saint-Michel quietest" \
     --source "https://www.instagram.com/p/..." --source-type instagram
   ```

   A bare list of names: `quick-add <file>` (README 3a).
   For five or more places write a batch file in `research/inbox/<date>-<topic>.json` (format:
   `research/formats/README.md`, "Inbox batch") and run `import`.
4. **Ambiguity.** Exit code 2 prints candidates. Pick by country and description yourself when
   one is obviously right; ask Nitin one question only when two are plausible (two Moss Glen Falls).
   Re-run with `--pick N`.
5. **Duplicates.** Exit code 1 with `DUPLICATE of <id>` means the place exists (same id, same
   name in the region, or within 300 m). Do not add; if the new post has new facts, merge them with
   `edit`:

   ```bash
   python3 tools/locations.py edit CA/QC/charlevoix/le-buton --note-append "Gondola runs to 17:00" \
     --stats '{"minutes": 45}' --tags-add family --source "https://..." --source-type official
   ```

   `edit` also changes `--status`, `--kind`, `--kid`, `--season`, `--area`, coordinates and `--trip`.
   When a trip plan adopts a place: `edit ID --trip SLUG --status planned`. After a visit:
   `visit add ID --date 2026-10-02 --trip SLUG` (this sets the status to visited).
6. **Screenshots.** Copy the image into `research/inbox/` named `<date>-<slug>.jpg` and pass it with
   `--screenshot research/inbox/<file>` (on `add` or `edit`), with `--source-note "saved post,
   15 Oct 2026"` for the date of the post. The post link goes in `--source` when known. Screenshots
   and source notes stay private; the public pages never show them.
7. **Finish.** Every write rebuilds the views, and the hook runs `validate` then `build` after any
   Write or Edit on the store. Run `locations.py build --check` before committing: it must print
   `up to date`. The suitability migration reads the store's
   `updated` date, so also run `node core/bin/suitability.ts migrate --write` and commit what it changes
   (`migrate --check` must pass; check-all fails otherwise). Commit and push (`locations: add <n> places (<topic>)`). Reply with one line per place:
   name, resolved chain (Canada > Quebec > Charlevoix), kind, and anything unresolved.

## Resolution rules

- Wikidata first (coordinates, administrative chain, country, elevation, a Commons image), then
  Nominatim. Both need a user agent and one request a second; the tool does this.
- The region is the first ancestor with an ISO 3166-2 code; the area is the protected area the
  place is in (Wikidata P3018), otherwise the direct parent, otherwise your `--area` hint. Always
  check the printed chain. A wrong parent is worse than a missing one.
- If neither resolver finds the place, add with `--offline` plus `--country`, `--region`, `--area`
  so the hierarchy is still right, and say so; `validate` will flag the missing coordinates until
  someone supplies `--lat`/`--lon` through `edit`, or the place is marked `--unconfirmed`.

## Reading saved posts in bulk

- Instagram or Facebook data export ("Saved" in JSON): parse the links and captions, resolve the
  places, then check the posts whose caption names nothing in the browser (location tag, pinned
  comment). Only download a video (`yt-dlp` plus frame extraction) when the caption and location
  tag give no place at all.
- Pilot on 10 posts and report the hit rate per source before running the rest.

## Do not

- Do not research hours, prices or trail conditions here; that is the `research` or `trip` skill's job.
- Do not write to the Obsidian vault.
- Do not invent a region or area; leave the hint out and let the resolver answer, then check it.
- Do not edit `locations.json` by hand. Use `edit`, `visit`, `tag` and `collection`.
- Tags: the tool resolves aliases and drops a tag that repeats the kind. Merge two spellings with
  `tag alias OLD CANONICAL`; list the vocabulary with `tag list`.
