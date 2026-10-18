# Travel plans repo

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
`docs/AUDIT-2026-10-16.md` section 2.3 for the target). `build.py` still has no CLI
build command, so each trip supplies its own thin `build_page.py`.

## Folder contract (layout since 17 Oct 2026)

`legacy/<slug>/` holds `index.html` (published), `PLAN.md`, `build_page.py` and `gallery/` (`gallery.json` plus
the spec and picks; `*-candidates.json` is gitignored); `assets/` is the only other thing published (kml, csv, gpx).
`legacy/_system/`, `legacy/globe/` and `legacy/locations/index.html` are the design system and the two site pages.
Research is `research/trips/<slug>/` (lane files, `notes/`, `archive/` of superseded plans, never published); the
gallery tools are `tools/gallery/`; the audit is `docs/AUDIT-2026-10-16.md`. The full layout is `docs/PLAN-platform.md` 1.1.
`publish.sh` copies `index.html` and `assets/` only, per route in `legacy/MANIFEST.json`.

Deploy everything with `./publish.sh` (wrapper for `python3 tools/publish.py`; `--dry-run` stages only) → https://nks-travel.pages.dev/<slug>/
Cloudflare login on this machine must be `npx wrangler login --device` (localhost callback fails; approval happens on phone).

## Current trips
- `legacy/algonquin-muskoka-oct-2026/` — **Sat 10 – Mon 12 Oct 2026 (Canadian Thanksgiving), 2 nights at Port
  Cunnington Lodge, Dwight (Lake of Bays), from Whitby. Built, NOT published.** Theme `autumn`, build with
  `python3 build_page.py`; PLAN.md + 4 research files. Shape: Sat Huntsville lunch → Solitaire Lake Trail
  (Echo Rock is back-lit until ~13:30, so afternoon) + Dwight Beach sunset; Sun Track and Tower at 08:00
  (**no tower exists**, the payoff is a Cache Lake ledge, front-lit until ~10:30) → Ragged Falls; Mon Dorset
  tower → Huntsville → leave by 13:30 or after 19:30. **Sunday hangs on the $21 Algonquin day permit, sold
  online only 5 days ahead (Sun 11 = Tue 6 Oct, release time inferred); Plan B is in the page toggle.**
  2026 is an early colour year: Algonquin peaked ~27 Sep, Lake of Bays lagged. The address
  "1212 S Limberlost Rd #1150" matches no source; navigate to the reserve by name. Open: Dorset slot
  availability, Ragged Falls fee, all Thanksgiving traffic timing. No Phase 2 conditions routine scheduled yet.
- `legacy/vermont-fall-2026/` — Oct 1–4, 2026, Whitby → Hyde Park VT. Sept 29 cloud routine emails a foliage/weather verdict (trig_01XZPgWV5iHm54Pwcvme6XzG).
- `legacy/quebec-sept-2026/` — Sep 29 – Oct 1, 2026. Prologue leg to Vermont: Whitby → Île d'Orléans
  (2 nights) → Derby Line → Hyde Park. Discussion-stage; Vermont pages NOT changed for it.
- `legacy/iceland-ring-road/` — **4–15 Sep 2027, 11 nights, ~2,190 km. First camper-van trip.**
  Built through `legacy/_system/` (theme `alpine-snow`), 3 research files + PLAN.md + `sun-times.py`
  and `dark-times.py`. KEF in/out, counter-clockwise Ring Road + Snæfellsnes, 10 campsites,
  no hotels. **Dates were set by arithmetic, not taste: Iceland reaches NO astronomical darkness
  before ~3 Sep** (mid-July doesn't even end civil twilight), so an aurora on a summer van trip is
  impossible — but 50 campsites shut during September and **the Camping Card expires 15 Sep**.
  Those two curves cross at 8–15 Sep. Window B (11–22 Sep) is behind the A/B toggle.
  **Van constraints that shaped it:** campsite-only sleeping is law, so days are ordered around
  campsites not trailheads (reverse of every other plan here); **2WD campers are barred from
  F-roads and no Icelandic insurer sells river-crossing cover at any price**, so the highlands are
  out; puffins are gone by September. Biggest unverified risk = **no campsite confirmed open for
  Sept 2027**; all prices are 2026.
- `legacy/dolomites-july-2027/` — Jul 13–26, 2027, YYZ→Venice, rental car, 4 bases. Dates moved
  back from 26 Jun so the high routes and all lifts are open; hut-to-hut considered and
  declined. `research/trips/dolomites-july-2027/archive/PLAN-superseded-june.md` keeps the June reasoning.

- `legacy/chamonix-mont-blanc-sept-2028/` — **Fri 1 – Sat 9 Sep 2028, 8 nights (recommended from a 1–14 Sep window), from Toronto.**
  6 research files + PLAN.md + page built through `legacy/_system/` (theme `alpine-snow`). Shape: Les Praz 3, optional
  Refuge du Lac Blanc hut night 1, Argentiere 4; valley day hikes, **no full Tour du Mont Blanc** (7-11 days,
  huts close ~20 Sep, bookings open ~15 Oct the year before). Every lift-dependent day is before 9 Sep because
  the 2026 pattern closes Brevent/Planpraz/Bellevue ~13 Sep and a 2028 closing Sunday could be 10 Sep.
  **Everything is 2026 data used as a pattern; no 2028 timetable exists.** Biggest risks: the Mont Blanc tunnel
  autumn closure (2025 ran 1 Sep – 12 Dec; ATMB says 2027-28 repeat it, so Courmayeur may be unreachable),
  no Toronto-Geneva nonstop (Toronto-Zurich is), UTMB 2028 dates unknown. Guest card = free trains Servoz-Vallorcine
  only, buses discounted not free. "Lac de Peclerey" does not exist (Montagne de Peclerey). Not published.

- `legacy/canadian-rockies-sept-2029/` — **PUBLISHED. Sat 8 – Sat 22 Sep 2029, 14 nights, Calgary in/out, adults + a child ~6.**
  Built through `legacy/_system/` (theme `alpine-snow`) from `data/*.json` (48 sights, 62 trails, 33 bookings, 43 adventures,
  `itinerary.json`); `merge_data.py` merges lane files, `plan_tables.py` fills PLAN.md tables, `build_page.py` builds the page
  and injects the gallery after the trail list (`after="trails"`). Every day has Track A (adult-only hike), B (family) and
  C (less walking); 7 split days. Bases: Banff 2, Lake Louise 1, Jasper 4, Lake Louise 4, Kananaskis Village 3. **Waterton
  is not in the 14-night plan (it is in the 16-night option).** Window 8-22 Sep chosen over 1-15 Sep for Labour Day (Mon 3 Sep)
  and larch timing (peak ~20 Sep - 5 Oct); costs ~1 more school day. All 2026 data used as a pattern. `check_links.py` result:
  465 URLs, 9 broken (1 on the page: Jasper SkyTram hours, a 520). Child limits: no minimum height found for 42 of 43 adventures.

- `legacy/patagonia-feb-mar-2027/` — **Fri 26 Feb – Thu 11 Mar 2027, 13 nights, Toronto, adults plus children 11+. Built, NOT published.**
  Seed was a video (BA, Calafate, Chalten, Ushuaia); route **reversed**: BA 1, Ushuaia 4, El Chalten 4, El Calafate 2, BA 2
  (penguins a week earlier, walking ramps up, last domestic leg from Calafate). PLAN.md (Opus) + 7 research files + `research/trips/patagonia-feb-mar-2027/sun.md`
  (the logistics sun table is wrong, use this one); page via `build_page.py` (theme `alpine-snow`, `photos.py` for hero/cards),
  gallery 42 photos after the trail list. Torres del Paine: NO (day tour swap costs the Chalten spare day). Big Ice 18+, rafting 16+ cut;
  minitrekking 8-65 fits. Urgent: international flight and Chalten lodging by 31 Oct, domestic flights and car 15 Nov, Piratour and
  minitrekking 30 Nov. Biggest GAPs: Air Canada YYZ-EZE 2027 days, Piratour minimum age, hotel prices, AllTrails links unfetched.
  Open: citizenship, children's heights, car vs buses, 03:00 Fitz Roy appetite. No conditions routine yet (~22 Feb 2027).

## Queued
- `legacy/usa-southwest-rockies/` — **PUBLISHED (nks-travel.pages.dev/usa-southwest-rockies/). Cut on 2026-09-24
  from 15 days Utah+Arizona to 11 days / 10 nights, five Utah parks only.** Springdale 3, Bryce 1,
  Torrey 2, Moab 3, SLC 1; Bryce→Torrey via UT-12 with optional Lower Calf Creek Falls. Dropped
  Page, Antelope, Horseshoe Bend, Monument Valley and the Hanksville badlands (4 nights); every leg
  is paved so AWD is no longer needed. Moab could be 2 nights (10 days) on official figures.
  Night split is inference: no official source gives days per park (`research-days-*.md`).
  The 15-day plan, old page and builder are in `research/trips/usa-southwest-rockies/archive/`.
  `research/trips/usa-southwest-rockies/notes/CALL-LIST.md` is from the 15-day plan and partly stale. Theme `desert`, build with
  `python3 build_page.py`. **Dates open**; the one hard line is 1 October (Narrows dry-suit cold).
- `legacy/norway-summer/` — **summer 2028, exact dates open.** 14 nights. Research (5 files) + PLAN.md
  + a built `index.html`. Shape: **Arctic first** — Lofoten 3, Andenes 1, Senja 2 — then Fjord
  Norway north to south (Ålesund, Åndalsnes 2, Geiranger 1, Loen 2, Aurland 1, Bergen 1).
  Open-jaw EVE in / BGO out, two cars, one internal flight TOS→AES.
  **10 bases, ~1,740 km driven** (legs summed in PLAN.md; estimates, not routed — GAP).
  **Recommended window ~24 Jun – 8 Jul 2028**: 2028 *fellesferie* is 10–30 July (ISO weeks
  28–30), a week later than 2026, so late June is pre-crowd *and* inside the midnight sun.
  Window B (~29 Jul – 12 Aug, itinerary reversed) is in the page behind the A/B toggle.
  Trollstigen is treated as a bonus, never a dependency. **Not published yet.**
  First page built through `legacy/_system/` (theme `coastal`) rather than by hand.
  **Hiking ceiling is 12 km round trip** — this cut the Ryten→Kvalvika beach descent (12–13 km)
  and the Vidden traverse in Bergen (13–15 km, substitute = Ulriken cable car up and back).
  Romsdalseggen (10–11 km, 970 m up / **1,277 m down**) is the biggest day and fits.
  Via Ferrata Loen: **age 12+, 40–120 kg** — harness limits, not policy, so not negotiable.
  Only open question left is **group size**.
- Switzerland, 14 nights — folder exists with PLAN.md + 5 research files and a published page.
- `legacy/peru/` — **research only, no dates, no page yet.** 4 research files + `research/trips/peru/notes/DAYS.md`.
  Triggered by a traveller's Instagram post recommending the Cordillera Huayhuash near Huaraz.
  Verdict: **no honest "see Peru" trip under ~3 weeks**; Huayhuash + Machu Picchu together is
  **24–26 days** door-to-door. Two costed shapes in `DAYS.md` (same notes folder) — **A: 17 days** (Santa Cruz 4-day
  trek + full Cusco block) and **B: 24–26 days** (full 135 km Huayhuash circuit + Cusco).
  Key sequencing finding: **do Huaraz BEFORE Cusco** — you arrive in Cusco already acclimatised
  and the Cusco block drops from 6 nights to 4.
  Hard constraints: Machu Picchu is 4,500 tickets/day (5,600 on peak dates incl. **19 Jun – 2 Nov**),
  one fixed circuit + one fixed entry hour, book 60+ days out; **from 2026 an Inca Trail permit no
  longer includes MP entry**; never sleep night one in Cusco (Sacred Valley is 500–600 m lower);
  leave a buffer day after MP — rail blockades shut the corridor twice in late 2025.
  Best month = **September**. The post's "October = fewer crowds" is wrong for MP specifically.

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

Sun, twilight and darkness times come from `core/src/sun` (`node core/bin/sun.ts --lat .. --lon .. --zone .. --date ..`); longitude is positive EAST (Reykjavik is -21.94). Negating it shifts every time by 8 minutes per degree, which is how four legacy scripts went wrong until S1 (`research/sun-audit-2026-10-18.md`). Never hand-copy the formula or take times from memory.

`web/` is the Next.js app (static export of home, trips, places, about); `tools/publish.py` merges it with the legacy pages (see README.md). Colour comes only from `web/app/themes.css`, generated by `python3 tools/theme_tokens.py`.

Operations (P4a): every write to `data/trips/` is an operation in `core/src/ops/` (`node core/bin/ops.ts <name> --input <file or ->`, or `node core/bin/serve.ts` for the local API); each returns an inverse, and `trip.restore` undoes it. Book-by dates are `core/src/bookings/`, sun times `core/src/sun/`.

## Agents and models (since 18 Oct 2026)

Delegate by kind of work. The project agents are in `.claude/agents/`. The v2 plan (`docs/v2/`) lives on branch `claude/serene-goldberg-wtn3di` (worktree `travel-wt/v2`) until it merges.

| Work | Agent | Model |
|---|---|---|
| Plans, specs, feature pages, decisions, build briefs | `travel-planner` | Opus |
| Research: places, trails, sights, adventures, stays, coordinates, links, booking windows | `travel-researcher` | Opus |
| Coding and tests in prototype/, web/, core/, tools/ | `travel-builder` | Sonnet |
| UI/UX and design-system review, foundation changes | `travel-design-reviewer` | Fable |
| Independent checks and visual sweep before reporting done | `travel-verifier` | Sonnet |
| Quick file search | `explorer` (global) | Haiku |

Every UI round ends with `travel-design-reviewer`, then `travel-verifier`. Parallel agents get disjoint file ownership. Commons searches stay sequential.

## The plan is the source of truth

- Before starting anything, read `docs/v2/TODO.md` and the spec pages it links: `docs/v2/features/`, `docs/v2/ux/`, `docs/v2/design/`, `docs/v2/research/`. Check whether the work is already planned, half done, or in conflict with a decision.
- When work ships, move its row to Done with the commit, and update the spec page if the build differs from it.
- Any new request from Nitin becomes a new Open row the same day, linked to where it is specified. Write the spec first if none exists.
- Current priorities are in `docs/v2/design/product-direction-2026-10-18.md`:
  - the public read-only site first, with no login
  - the planner second
  - a new palette, with no green
  - under 100 users in year one, so free tiers
