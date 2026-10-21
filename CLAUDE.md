# Travel plans repo

**Start here on a new machine or session: read `docs/v2/PLAN.md` (the single plan: requirements, order, status, next tasks, open decisions), then `HANDOVER.md` (setup), then `docs/v2/build/public-site/EXECUTION-PLAN.md` for task detail and `BACKLOG.md` for row status.** `main` is the new public site (v2); the old site is the tag `legacy-final`; the live site is unchanged until the owner approves go-live.

Each trip is one folder: `legacy/<slug>/` containing `index.html` (the deliverable) and `PLAN.md`; its research lives in `research/trips/<slug>/`.

**Use the `trip-planner` skill** (`.claude/skills/trip-planner/`) for any new or revised trip plan — it defines the research process, the HTML format and design system, link/photo conventions, and the publish step.

## Destinations: the laundry list — `locations/` (since 16 Oct 2026)

Every place Nitin wants to remember goes in `data/locations/locations.json` (schema v2) through the
`location` skill or `python3 tools/locations.py add ...` (Wikidata then Nominatim
resolve coordinates and the country > region > area chain). Change a place with
`locations.py edit ID ...` and record a trip there with `locations.py visit add ID --date ...`.
`locations.py build` (`build --check` to verify) generates two views from one code path: the
private `data/locations/WISHLIST.md` (full notes) and the published `legacy/locations/index.html` list page,
plus the globe's pins in `legacy/globe/assets/data/places.json`. Never hand-edit those; a PostToolUse hook
validates the store and rebuilds them on every write, and `publish.sh` (a wrapper for `tools/publish.py`) runs `build` first and fails
if it fails. The store is one file until it passes 300 places, when `validate` warns and it can be
converted to the split layout (one part per country). The Obsidian `Location.md` is retired and
points here. Capture only; research happens when a trip adopts the place (`trip` field).
Tests: `python3 -m pytest tools/tests -q`. Details: `data/locations/README.md`.
`python3 tools/publish.py --dry-run` (or `PUBLISH_DRY_RUN=1 ./publish.sh`) stages `.site/` and stops before wrangler.

## Shared design system — `legacy/_system/` (Phase 0 complete, Aug 29 2026)
Components and themes are being centralised so a CSS fix lands once instead of five times.
See `legacy/_system/README.md`. Colour lives ONLY in `legacy/_system/themes/*.css`; `base.css` uses tokens
named for what they do (`--accent`, `--header`, `--warn`), never for a colour.

    python3 legacy/_system/build.py --check        # validate system + 8 themes (hex gate + WCAG AA gate)
    python3 legacy/_system/build.py --gallery      # regenerate the side-by-side theme gallery

Status: `legacy/norway-summer/` is the **first page built through `legacy/_system/`** — see its
`build_page.py`, which imports `legacy/_system/build.py` and calls `assemble()`. The original five
pages are still hand-written HTML (the original plan file for the migration is gone; see
`docs/archive/v1/AUDIT-2026-10-16.md` section 2.3 for the target). `build.py` still has no CLI
build command, so each trip supplies its own thin `build_page.py`.

## Folder contract (layout since 17 Oct 2026)

`legacy/<slug>/` holds `index.html` (published), `PLAN.md`, `build_page.py` and `gallery/` (`gallery.json` plus
the spec and picks; `*-candidates.json` is gitignored); `assets/` is the only other thing published (kml, csv, gpx).
`legacy/_system/`, `legacy/globe/` and `legacy/locations/index.html` are the design system and the two site pages.
Research is `research/trips/<slug>/` (lane files, `notes/`, `archive/` of superseded plans, never published); the
gallery tools are `tools/gallery/`; the audit is `docs/archive/v1/AUDIT-2026-10-16.md`. The full layout is `docs/PLAN-platform.md` 1.1.
`publish.sh` copies `index.html` and `assets/` only, per route in `legacy/MANIFEST.json`.

Deploy everything with `./publish.sh` (wrapper for `python3 tools/publish.py`; `--dry-run` stages only) → https://nks-travel.pages.dev/<slug>/
Cloudflare login on this machine must be `npx wrangler login --device` (localhost callback fails; approval happens on phone).

## Trips

The index of every trip, with its state, dates, season window and open items, is `research/trips/README.md` (moved there from this file on 21 Oct 2026). Each trip folder holds its research: `research/trips/<folder>/`.

## Photo galleries
Every page carries a photo gallery injected from `legacy/<trip>/gallery/gallery.json` by `tools/gallery/gallery.py`
(`verify`, `sheet`, `inject`). Find candidates with `tools/gallery/gallery_find.py` (one API request per query,
cached, contact sheets for you to look at), pick with `tools/gallery/gallery_pick.py`. **Never search Commons from
parallel agents:** one shared IP, and four agents at once got a 429 that lasted 25+ minutes (2026-10-12).
Done for switzerland-2027, dolomites-july-2027, costa-rica-feb-2027, chamonix-mont-blanc-sept-2028.
`build_page.py` trips must call `gallery.inject` at the end of the build or a rebuild erases the gallery.
The gallery opens in a full-screen lightbox (arrows, keys, swipe). `inject(..., after="trails")` places it after a named section; `--dedupe` drops photos already on the page (off by default).

## Landing page
`https://nks-travel.pages.dev/` is generated by `publish.sh` — image cards per trip, sorted by
date, with Today/Tomorrow/In-N-days badges and an auto "Past" section. Card image is scraped
from each page's hero; date/duration/region come from `<meta name="trip-*">` tags that every
page now carries. Add a trip and the card appears; nothing to maintain by hand.

## Gotchas
- `"private": true` on a `legacy/MANIFEST.json` folder takes a page down: `publish.py` stages a noindex
  placeholder and overwrites its `assets/` files (a deploy that merely omits a path leaves it live), and
  the hub skips it. Seven pages are private since 17 Oct 2026 (the five past trips, Norway, Utah); the
  next `./publish.sh` applies it. Platform plan: `docs/v2/`, a working draft, not final.
- Renaming a trip folder leaves the OLD path live on Cloudflare Pages (prior deployments'
  assets persist). The hub regenerates correctly, but the stale URL keeps serving. Delete it
  in the Pages dashboard if it matters.
- The older three pages (quebec, dolomites, switzerland) use a **different component vocabulary**
  from the newer two (`.card .chead .cbody` + `.s-*`/`.g-*` vs `.card .split .content` +
  `.blaze.*`). They also carry a different `<meta name="viewport">` string, which has already
  broken one scraping pass. `legacy/_system/` unifies both — until migration, edit each family on its
  own terms.
- `publish.sh` used to copy every non-`.md` file in a trip folder to the public site (81 scripts,
  JSON and scratch files were live until 16 Oct 2026). It now publishes `index.html` and `assets/`
  only; anything else you want downloadable goes in `assets/` on purpose.

## Platform (in progress)
`core/` holds the schema (Zod, exported to `data/schema/generated/`) and the validator; run `bash tools/check-all.sh` before publishing.
Locations are schema v3 (`data/vocab/tags.json` holds the tags, captures live in `research/inbox/`); day checks are `core/src/checks/`, the operation catalogue `core/src/ops/catalogue.ts` (exported to `data/schema/generated/ops.json`), and `.mcp.json` registers the read-only MCP server `core/bin/mcp.ts`.

Sun, twilight and darkness times come from `core/src/sun` (`node core/bin/sun.ts --lat .. --lon .. --zone .. --date ..`); longitude is positive EAST (Reykjavik is -21.94). Negating it shifts every time by 8 minutes per degree, which is how four legacy scripts went wrong until S1 (`research/audits/sun-audit-2026-10-18.md`). Never hand-copy the formula or take times from memory.

`web/` is the Next.js app (a static export of home, trips, places, about until lane API-0 makes it a server build with `/api/v1/` route handlers; see `docs/v2/PLAN.md`); `tools/publish.py` merges it with the legacy pages (see README.md). Colour comes only from `web/app/themes.css`, generated by `python3 tools/theme_tokens.py`.

Capture contract (3a.12 steps 1-4, lane CC): `data/vocab/types.json` is the one authored file (the 15-domain, 61-category, 324-id type tree, the suitability profile rows, layer and offer-class rules, marks per node); `core/src/schema/capture/properties.ts` is the property registry. `node core/bin/capture.ts fields --type <id>` is the checklist a researcher or crawler follows, `explain`, `gaps --trip` and `run --check` are the rest; `capture.ts build` writes `data/schema/capture/*`, `docs/v2/research/capture/*` and `data/schema/suitability-applicability.json` (never edit those; `build --check` runs in check-all). Records are place, route, offer or event in `data/capture/<trip>/*.json` (`capture/1`, joined to the suitability and relevance sidecars by ref); a lift's suitability block sits on its `offer/<ref>#ticket`. Gotchas: a new TYPE is one entry in types.json, a new PROPERTY is a registry change; the profile of a record's type must equal the profile of its kind/subkind (E_CAP_TYPE); the 61-record migration ran once (`capture.ts migrate` refuses to run again) and `data/capture/migration-ledger.json` pins that every pre-migration leaf still exists with the same value (new records and leaves are allowed; the count tests cover `migrated.json` only).

Operations (P4a): every write to `data/trips/` is an operation in `core/src/ops/` (`node core/bin/ops.ts <name> --input <file or ->`, or `node core/bin/serve.ts` for the local API); each returns an inverse, and `trip.restore` undoes it. Book-by dates are `core/src/bookings/`, sun times `core/src/sun/`.

## Agents and models (since 18 Oct 2026)

Delegate by kind of work. The project agents are in `.claude/agents/`. The v2 plan (`docs/v2/`) is on `main`; its entry point is `docs/v2/PLAN.md`. The old integration branch `claude/serene-goldberg-wtn3di` was deleted on 21 Oct 2026 and kept as the tag `archive/claude-serene-goldberg-wtn3di` (with `archive/phase-p3b`, `archive/phase-p4b` and `archive/wip-*`); new work branches from `main`.

| Work | Agent | Model |
|---|---|---|
| Plans, specs, feature pages, decisions, build briefs | `travel-planner` | Opus |
| Research: places, trails, sights, adventures, stays, coordinates, links, booking windows | `travel-researcher` | Opus |
| Coding and tests in prototype/, web/, core/, tools/ | `travel-builder` | Sonnet |
| UI/UX and design-system review, foundation changes | `travel-design-reviewer` | Opus (not Fable, owner 18 Oct) |
| Independent checks and visual sweep before reporting done | `travel-verifier` | Sonnet |
| Quick file search | `explorer` (global) | Haiku |

Every UI round ends with `travel-design-reviewer`, then `travel-verifier`. Parallel agents get disjoint file ownership. Commons searches stay sequential.

### Model by task complexity (owner, 21 Oct 2026)

The table above is the default per agent. The coordinator overrides it per task with the Agent tool's `model` parameter, picking the cheapest model that can do the task well. Never Fable.

| Complexity signal | Model | Examples |
|---|---|---|
| Mechanical, no judgement: search, count, list, rename, format, run a command and summarise, link checks | Haiku | find every reference to a folder, grep counts, hash duplicates |
| Well specified, inside owned files, a brief and acceptance check exist: implement, write tests, verify, screenshot sweep, fill data to a clear contract | Sonnet | phase A lanes, test-race fixes, trail-fact rendering, `travel-verifier` runs |
| Ambiguous or cross-cutting: no spec yet, a shared contract or new abstraction, more than three interdependent files, privacy or security, a hard algorithm, taste (design review), research that needs judgement, gates and audits | Opus | API-1 contracts and `CatalogueStore`, the globe fit model, schema diffs, plans, design review, public-output and code audits |

Rules: start at the lowest model that fits. Escalate one step when a hand-back shows a judgement error, the same fix fails twice, or the task turns out to touch a shared contract. Step down for mechanical follow-ups (a renamed import, a snapshot update). A builder task that creates a shared contract is Opus even though it is code. Reviews and audits are never below the model that wrote the work. Record the model in each lane's hand-back so the choice can be judged afterwards.

## The plan is the source of truth

- Before starting anything, read `docs/v2/PLAN.md`, then `docs/v2/TODO.md` and the spec pages it links: `docs/v2/features/`, `docs/v2/ux/`, `docs/v2/design/`, `docs/v2/research/`. Check whether the work is already planned, half done, or in conflict with a decision.
- When work ships, move its row to Done with the commit, and update the spec page if the build differs from it.
- Any new request from Nitin becomes a new Open row the same day, linked to where it is specified. Write the spec first if none exists.
- Current priorities are in `docs/v2/design/product-direction-2026-10-18.md`:
  - the public read-only site first, with no login
  - the planner second
  - a new palette, with no green
  - under 100 users in year one, so free tiers
