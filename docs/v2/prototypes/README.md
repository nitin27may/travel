# Clickable prototypes (throwaway)

Generated 27 Oct 2026 for owner review. These are **not product code** and not part of the web build. The product is `web/`;
these only show the flows specified in `docs/v2/design/trip-builder/FLOW.md` and `docs/v2/design/park-page/`.
The owner called them "an OK starting point, not what he is looking for" (PLAN R-280): the next design round starts from his list of gaps.

| Folder | What | Spec |
|---|---|---|
| `parks-app/` | `/parks` index and the park page template (Banff, Lake O'Hara, Castle, Algonquin) | `design/park-page/` |
| `builder/` | Trip Builder: kind, start, where, pick, days and driving, build, editor, review, copy | `design/trip-builder/FLOW.md` |
| `shared/` | Pieces all three apps use: `sun.js` (port of `core/src/sun`), `contract.js` (`proto.trips` and `proto.requests`: normalise, validate, store helpers), `ics.js` (timed and all-day calendar events), `map.js` (SVG map), `engine.js` (builder engine, API in `shared/engine-api.md`), `tests/` | phase 0 of the fix plan |
| `planner/` | My trips, trip home, today view, print | `features/edit-my-trip.md`, `features/navigation-and-mine.md` |

Findings, known gaps and the enhancement list from testing: [FINDINGS-2026-10-27.md](FINDINGS-2026-10-27.md); the plan to fix them: [FIX-PLAN-2026-10-27.md](FIX-PLAN-2026-10-27.md).
What is not real yet, per prototype, with owner, size and FS-1 or later: [TODO.md](TODO.md) (R-283).
Open design questions for editing a copied trip: [BRAINSTORM-edit-trip.md](BRAINSTORM-edit-trip.md) (R-284).

## Run

Plain HTML, CSS and JS, no build, no network calls. Pages use absolute paths (`/themes.css`, `/fonts/`), so serve this folder as the site root with the script, which maps `/fonts/` to `docs/v2/design/redesign/fonts/` (no font is copied, folder contract rule 7):

```
python3 docs/v2/prototypes/serve.py 4300
```

then open `http://127.0.0.1:4300/`. The three apps share `localStorage` (`proto.trips`, `proto.saved`, `proto.draft`), so serve them from one origin.

## Test

Run each suite from the repo root. Each uses Playwright from `web/node_modules` (no new dependency) and starts `serve.py` on a free port.

| Suite | Command | Covers |
|---|---|---|
| Everything | `bash docs/v2/prototypes/tests/run.sh` | The root run picks up every `<app>/tests/` folder: shared (`sun`, `contract`, `ics`, map, engine, page sweep), builder (no own `run.sh`; its specs run here), parks and planner |
| Parks only | `bash docs/v2/prototypes/parks-app/tests/run.sh` | index, pages, keyboard, a11y, data |
| Planner only | `bash docs/v2/prototypes/planner/tests/run.sh` | travellers re-flow, dates, ICS, map and sun, offline, header, deep links |

Each script takes Playwright arguments (`-g sun` for one group, `-g builder` for the builder's specs by title). `PROTO_STRICT=1` makes the page sweep fail on contrast, focus traps and unnamed controls. In total the suites hold 304+ specs. Shared helpers: `serve.js`, `contrast.js` (`checkContrast(page)`, light and dark), `keyboard.js` (`walkKeyboard(page)`), `a11y.js` (`dumpA11y(page, file)`). The page sweep writes findings and accessibility-tree dumps to `docs/v2/prototypes/test-results/sweep/` (ignored).

## Gotchas
- All data is placeholder: places, drive times, airports, prices and counts. Drive minutes come from coordinates and a factor, not routing.
- `themes.css` is a snapshot of `web/app/themes.css`; regenerate it from there, never edit it here.
- Builder deep links: `?m=near&n=0|1|2&p=<park>`, `?m=trip&cc=CA&p=<park>`, `?add=<park>--<place>&p=<park>`, `?saved=1`, `?copy=dolomites`, `?edit=<id>`, `?review=<id>`; `?fast` skips the build delay.
- Every app reads and writes `proto.trips` and `proto.requests` through `shared/contract.js`; `shared/sun.js` is the only source of sunrise and sunset.
- Planner deep links: `planner/trip.html?id=<id>`, `planner/today.html?id=<id>` and `planner/print.html?id=<id>` open the demo trips even when the builder seeded `proto.trips` first (spec `planner/tests/deeplink.spec.js`).
- Planner-only fields (notes, item done, stale, private) still live in `proto.planner.ext` until the planner moves to `trip.ext` (`contract.js` keeps `ext` as a plain object).
- Demo trips are seeded into `proto.trips` only when it is empty. The planner's "Reseed" and "Clear" replace every trip in the browser.
- Walkthrough screenshots are not committed (repo rule: shots only when a spec names them).

## Status (27 Oct 2026)

The owner accepted the three prototypes as OK for now. They are not pixel perfect (he named the checkboxes among other issues) and he will list the gaps later; do not polish further until that list exists (PLAN R-280).
