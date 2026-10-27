# Clickable prototypes (throwaway)

Generated 27 Oct 2026 for owner review. These are **not product code** and not part of the web build. The product is `web/`;
these only show the flows specified in `docs/v2/design/trip-builder/FLOW.md` and `docs/v2/design/park-page/`.
The owner called them "an OK starting point, not what he is looking for" (PLAN R-280): the next design round starts from his list of gaps.

| Folder | What | Spec |
|---|---|---|
| `parks-app/` | `/parks` index and the park page template (Banff, Lake O'Hara, Castle, Algonquin) | `design/park-page/` |
| `builder/` | Trip Builder: kind, start, where, pick, days and driving, build, editor, review, copy | `design/trip-builder/FLOW.md` |
| `planner/` | My trips, trip home, today view, print | `features/edit-my-trip.md`, `features/navigation-and-mine.md` |

## Run

Plain HTML, CSS and JS, no build, no network calls. Pages use absolute paths (`/themes.css`, `/fonts/`), so serve this folder as the site root with the script, which maps `/fonts/` to `docs/v2/design/redesign/fonts/` (no font is copied, folder contract rule 7):

```
python3 docs/v2/prototypes/serve.py 4300
```

then open `http://127.0.0.1:4300/`. The three apps share `localStorage` (`proto.trips`, `proto.saved`, `proto.draft`), so serve them from one origin.

## Gotchas
- All data is placeholder: places, drive times, airports, prices and counts. Drive minutes come from coordinates and a factor, not routing.
- `themes.css` is a snapshot of `web/app/themes.css`; regenerate it from there, never edit it here.
- Builder deep links: `?m=near&n=0|1|2&p=<park>`, `?m=trip&cc=CA&p=<park>`, `?add=<park>--<place>&p=<park>`, `?saved=1`, `?copy=dolomites`, `?edit=<id>`, `?review=<id>`; `?fast` skips the build delay.
- Demo trips are seeded into `proto.trips` only when it is empty. The planner's "Reseed" and "Clear" replace every trip in the browser.
- Walkthrough screenshots are not committed (repo rule: shots only when a spec names them).
