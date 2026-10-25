# Lane: media

Status: draft (17 Oct 2026).

## 1. Purpose

Photos that show what a place is actually like, legally reusable, attributed, and right for the trip
(season, light, no misleading angle). Carries over the repo's gallery rules (`tools/gallery/`,
CLAUDE.md "Photo galleries").

## 2. Produces

`media` rows: entity, storage (`commons` link, `r2`/Supabase Storage for user uploads), width, height,
licence, author, attribution text, source URL (the Commons file page), caption, role (`hero`, `gallery`,
`map`), status (`proposed`, `approved`, `hidden`), perceptual hash, `taken_on` and `taken_point` when the
metadata has them, `season` tag.

## 3. Required fields

`entity_id`, storage key or Commons filename, `licence` (from the file's metadata, not assumed),
`author`, `attribution`, `source_url`, `width`, `height`, verified hotlink (HTTP 200 on the thumbnail URL).

## 4. Optional fields

`caption` (our words), `taken_on`, `taken_point`, `season`, `subject_check` (the runner's note that it
shows the right place), `role`.

## 5. Sources, in order

Wikimedia Commons (search by category and by coordinates); Openverse; Flickr (CC0, CC BY, CC BY-SA, no known
copyright restrictions); Geograph; official agencies with open licences (Parks Canada, NPS public domain);
Unsplash and Pexels (their own licence, recorded as the licence); the owner's own photos; user uploads
(moderated). Widened 25 Oct 2026, see `docs/v2/build/public-site/briefs/DATA-LOC.md` section 4. A file with no
reuse licence is never taken because it is publicly visible.

## 6. Rules

- **Never run Commons searches from parallel agents**: one shared IP; four agents at once caused a 429 for
  25+ minutes on 2026-10-12. One runner, one request at a time, a couple of seconds apart; probe
  `action=query&meta=siteinfo` first; a user agent is required.
- Cheapest model for finding; a person or a larger model looks at the contact sheet before approval.
- Reject: watermarks, wrong valley or wrong season, people in the foreground, grey weather (unless the
  point is weather), images under 1600 px wide for hero and gallery.
- Licence from metadata; CC BY and CC BY-SA require attribution shown with the image; non-free licences
  are rejected.
- Commons images are linked (their thumbnails), not copied.

## 7. Leave empty

Licence when not in metadata (reject the image instead).

## 8. Freshness

Hotlink check every 90 days; licence never (unless the file page changes).

## 9. Traps

Same-name places; winter photos for a summer trip; drone shots implying access that does not exist; PDFs
and book scans in search results.

## 10. Example changeset (abridged)

```json
{ "media": [ { "entity": "ent_moraine_lake", "storage": "commons", "key": "Moraine_Lake_17092005.jpg",
  "licence": "CC BY-SA 3.0", "author": "...", "attribution": "Photo: ... / Wikimedia Commons, CC BY-SA 3.0",
  "source_url": "https://commons.wikimedia.org/wiki/File:Moraine_Lake_17092005.jpg", "width": 3072, "height": 2048,
  "role": "hero", "season": "summer", "subject_check": "Rockpile view, Ten Peaks visible" } ] }
```
