# Public site build: live status (coordinator handover)

Updated 2026-10-18, night, before a context compaction. Read this first after any reset, then `BACKLOG.md` (the full staged list: every finding goes there first, with an ID, and is marked done with its commit), then `docs/v2/TODO.md` and `README.md`.

## Where things are

- **Integration branch:** `claude/serene-goldberg-wtn3di`, worktree `/home/nitin27may/workspace/travel-wt/v2`. Every lane merges here, and the branch is pushed after each merge. HEAD at handover is deef245.
- **main** (`/home/nitin27may/workspace/travel`) is the published live site. Never run `./publish.sh` from v2. Go-live (stage 7) needs the owner's approval of the preview.
- **Lane worktrees:** `/home/nitin27may/workspace/travel-wt/v2-<lane>`, on branch `public/<lane>`.
- **The gate on the merged branch is `bash tools/check-all.sh`.** Move `web/.env.local` aside to a mode-600 file first and restore it afterwards, because it sets the google-js family. At handover it passed with 166 python tests, 1,273 core and 486 web.

## Running now (at handover)

| Lane | Worktree | Work | Next step |
|---|---|---|---|

Both sweep lanes are merged (19 Oct). **Stage 3** is running. Run lanes in parallel with disjoint files:
- **L3c**, the trip timeline. It goes first; its brief is `L3c-trip-timeline.md`.
- **S1**, the "Who it suits" display and capture-contract step 5 (UI sections from the contract). Read `CC-adapter-requests.md`.
- **L3b**, trip tags and filters (step 6, type-aware filters).
- **L2b**, the globe experience (`design/globe/spec.md`).
- **L4b**, trail tracks.
- **Capture contract step 7**, gap-filling research: hours, prices, booking windows, toilets and parking. Work through `research/capture-research-backlog.md` first.

## Stage 3 lanes (briefs written 19 Oct)

| Lane | Brief | Agent | Owns (summary) | Starts |
|---|---|---|---|---|
| L3c | `L3c-trip-timeline.md` | travel-builder | `core/src/schedule/**`, `data/schedules/**`, the trip page and `components/trips/timeline/**`, `lib/public/timeline.ts` and `prose.ts`, the day code in `trips.ts`, copy and ICS (`draft.ts`, `ics.ts`, `build.server.ts`, `CopySheet.tsx`) | building now (`v2-L3c`, port 3423) |
| L4b | `L4b-trail-tracks.md` | travel-builder | `data/tracks/**`, `web/scripts/tracks-osm.mjs`, `lib/public/tracks.ts`, the trail code in `places.ts`, `slugs.ts`, `honesty-overrides.ts`, `components/places/**` except `rows.ts`, `lib/export/gpx.ts`, `kml.ts`, `licence.ts`; one line in `build.server.ts` after L3c merges | now (`v2-L4b`, 3424) |
| L3b | `L3b-trip-tags-filters.md` | travel-builder | `core/src/capture/bands.ts`, `core/src/derive/length.ts`, appended flat values in `core/src/suitability/derive.ts`, `lib/public/tags.ts`, `bands.ts`, `world.ts`, the calls in `index.ts`, `lib/entities/facets/**` and the facet edits in `lib/entities/*`, the trips list files, `data/vocab/tags.json`, the `facets` block of `descriptors/place.tsx`, `components/places/rows.ts`, the filter UI in `components/entity/`, `places-parity.spec.ts` | now (`v2-L3b`, 3421); its two scheduler tags after L3c merges |
| L2b | `L2b-globe-experience.md` | travel-builder | `app/globe/**`, `app/globe-data/**`, `lib/globe/**`, `components/globe/**`, `styles/globe.css`, `public/globe/**`, `tools/globe_data.py`, `web/scripts/globe-*.mjs`, `data/reference/globe/**`, `lib/public/globe.ts`, an appended section of `lib/client/data.ts`, the ADM2 audit doc | now (`v2-L2b`, 3422) |
| S1 | `S1-who-it-suits.md` | design reviewer (Opus), then travel-builder | Part 0 and A now, new files only: the place-page sections design, `lib/public/contract.ts`, `sections.ts`, `suitability.ts`, `relevance.ts`, `party.ts`, `components/suit/**`. Part B after L3c, L4b and L3b merge: the place join, `PlacePage.tsx`, `components/places/sections/**`, card chips, timeline entry chips | Parts 0 and A now (`v2-S1`, 3425) |
| CS7 | `CS7-capture-gap-research.md` | travel-researcher (Opus) | `data/capture/**`, `data/suitability/<trip>/**`, `data/relevance/<trip>/**` and `inputs/points.json`, `data/sources/**`, CS7 lane notes, the research backlog, the operator questions | now (`v2-CS7`), three batches |

**Merge order: L3c, L4b, L3b, L2b, S1; CS7 batches in between.**
1. **L3c** first: L3b, L4b and S1 each depend on something it owns (the trips tests and `selectVariant`; `build.server.ts`; the timeline entries).
2. **L4b** next: its one line in `build.server.ts` needs L3c, and it adds about 100 trail places, so the lanes that own the list rows and the place page (L3b, S1) rebase onto the final place set.
3. **L3b**: owns `rows.ts`, the place descriptor's facets and `world.ts`, which S1 reuses. Either order with L4b is safe because no test pins a count of today's data; L4b first is preferred.
4. **L2b**: shares no file with the others (only an appended section of `lib/client/data.ts`), so it can merge whenever it passes; this is its default slot.
5. **S1** last: Part B edits files of L3c, L4b and L3b after they merge.
6. **CS7** is data only. Batch 1 (research backlog, placement review, attraction flags, lakes) merges before S1 Part B's final shots; batch 3 follows L3b's hand-back (the facets its coverage rule hides).

**Shared rules for the stage.**
- `web/lib/public/types.ts` takes additive fields from L3c, L4b, L3b and S1, each in its own block; the later merger keeps both sides.
- One runner per external service across every agent: Overpass under `flock /tmp/travel-overpass.lock` (L4b, L2b, CS7), Commons under `flock /tmp/travel-commons.lock` (L2b, CS7), Wikidata under `flock /tmp/travel-wikidata.lock`. User-Agent `travel-relevance-signals/1.0 (+https://nks-travel.pages.dev/about/)`, never an email.
- Moved from the older rows: the Places filters Kids, Effort and Stroller and the trip tags go to L3b (not S1); the RV1 list lens waits for Q18 and a later brief; L3d and L3e briefs are written after L3c merges.
- New owner questions: Q26 (trails of private trips), Q27 (six pills when Kind is narrowed), Q28 (no write-back to `locations.json`). Each has a recommendation; no lane blocks on them.

Stage 4 is the design review by the Opus reviewer (never Fable), scored against P1-P9 and T1-T5. Stage 5 is the cross-model checks. Stage 6 is the owner's review. Stage 7 is go-live.

## Current state (19 Oct, after "go with all recommendations")

Stages 1 and 2 are done. Stage 3 build lanes are merged: L3c, L4b, L3b, L2b, CS7 batches 1 and 2, S1 Part 0 and A, SQ1 part A. The owner approved every open recommendation (Q1-Q41 settled) and both mocks (place page, smart search).

Running now (worktrees `travel-wt/v2-<lane>`, branch `public/<lane>`):

| Lane | Work | Next step |
|---|---|---|
| D1 | code plumbing from CS7b: track matcher (cut, stitch, nearest-line offset), plan_b reads access_season, Sentinel Pass payoff, FacetRow.shape, trip base points (3.41), join by ref (3.40), Rockies note reword (3.22) | verify, merge |
| S1b | S1 Part B: place page sections from the contract, Who it suits, card chips, timeline entry chips, relevance sections, 3.20, 3.21, 3.26, 3.27, 3.42 | verify, Opus design review, merge |
| SQ1b | smart search part B: QueryChips, parser in header and list search boxes, "Not checked yet" group, 3.44 | verify, Opus design review, merge |
| L2b-del | delete the 29 orphaned globe boundary files (Q33 approved) and make globe_data.py independent of them | verify, merge |

After these merge: stage 4 (Opus design review of the whole site against P1-P9 and T1-T5, the polish rows 4.4-4.7 and 2.41), stage 5 (cross-model checks), stage 6 (owner preview from v2 HEAD with the tunnel rebuilt, Lighthouse on the real deploy, 2.47), stage 7 (go-live: redirects for retired legacy pages Q25, restore Google key restrictions, `_headers` caching 2.46, bot protection 7.6, publish).

**Owner asked (19 Oct): after the next merge (D1, S1b or SQ1b), rebuild `web/out` from v2 HEAD with `web/.env.local` moved aside only if needed for the build, serve it on a free port, open a new cloudflared tunnel and send the owner the URL. Kill the stale preview on port 3430 (by PID) when the new one is up.**

Open for the coordinator, not the owner: SQ1 phase 2 spike (Q38), CS7 batch 3 (remaining gaps), Rockies base points that differ from Wikidata (Kananaskis about 2 km, Lake Louise about 4 km; D1 reports them).

**Owner instruction (19 Oct): he reviews at stage 6 only. Do not ask for review or approvals before then; finish the remaining stage 3 work (S1b round 4, L4c page seeds for capture-only places, CS7 batch 3, SQ1 phase 2 spike), stage 4 (Opus design review and polish rows 4.4-4.9, 2.41), stage 5 (cross-model checks), then rebuild the preview from v2 HEAD, run Lighthouse on it (2.47) and hand him the link. Stage 7 only after his approval.**

## Stage 4 plan (19 Oct)

[STAGE4-plan.md](STAGE4-plan.md) holds stages 4 to 7, with briefs in [briefs/](briefs/). The lanes start when D2 (with CS7c inside it) merges.

| Lane | Brief | Work | Merge |
|---|---|---|---|
| SHL | [briefs/SHL.md](briefs/SHL.md) | e2e on the GPU (3.34), phone bar Search slot, home order at 390 | 1 |
| PLC | [briefs/PLC.md](briefs/PLC.md) | place pages (4.9, 4.12), map adapter (3.31, 4.2), seed rules and duplicates (3.58, 3.55) | 2 |
| TRP | [briefs/TRP.md](briefs/TRP.md) | trip page polish (4.4, 4.10), the map follows the day, kind-aware stop links (3.54, 3.57) | 3 |
| GLB | [briefs/GLB.md](briefs/GLB.md) | globe stage-4 fixes (4.5, 4.7, 4.13, 3.46) | 4 (any time) |
| LST | [briefs/LST.md](briefs/LST.md) | list shards (3.59), filters (4.6, 4.11), search (4.8, 4.14) | 5 |
| CS7d | [briefs/CS7d.md](briefs/CS7d.md) | data: duplicates, shells, stop points, seasons, dated texts, held-back tracks | batch A before PLC's final shots, batch B before LST's |
| SQ2s | smart-search.md section 10 | phase 2 spike, measure only; ship after go-live | any |

Then:
- REVIEW4, the whole-site Opus review (4.1, 4.2);
- FIX4 (4.3);
- the stage 5 cross-model checks (5.1-5.6);
- the stage 6 preview on a Pages preview branch with Lighthouse (6.3, 2.47).

Stage 7 waits for the owner. Owner decisions Q42-Q49 go to him with the preview, except Q42, which is needed only if the wrangler login has expired.

Conflicts found: C1-C11 in the plan, section 8. TS1 and TS1b are merged (2.50 is done). D2 edits six BACKLOG rows, which this plan left alone.

**Owner instruction (19 Oct, late): stop data research for now.** Data points can be searched later, once we know what data we want. CS7d batch B and further research lanes are paused (rows 3.25, 3.53, 3.61 and the CS7d batch B list stay queued, not started). Finish the UI work only: SHL, PLC, GLB, TRP, LST, the whole-site Opus design review and its fixes, the verifier passes, then merge everything and refresh the preview. He will review afterwards (stage 6). No stage 7 steps without his approval.

## Merged so far (all verified)

| Lane | Merge | What |
|---|---|---|
| L0, LD, LM, L5, L1 | 1f9e7d9, ac4d947, 24b6609, 972fbd4, bc8d102 | foundation, data adapter, map adapter, copy and export, home and search |
| L3 | 65eee4c | trips list and trip page |
| L4 | d0cb415 | places and place/trail pages; real Google key checked |
| PS | e883636 | personal status, stay state, raw notes, dated titles and the home town removed from public output |
| L2 | 4777821 | full-screen globe: drag, seas, peaks, antimeridian, reset, phone layouts |
| S0, S0b | e83e77c, f0c49cc | suitability schema, and applicability (field marks per kind) |
| RV0 | 678e1ab | relevance ("worth the journey") |
| R1-R6 research | 6ef1c43 | suitability and relevance for the 207 places on planned trips |
| CF | f9d3e98 | operator_info, no_limit, usable_partial, relevance role rules |
| SR | adae259 | source registry (296 sources, link checker) |
| RVC | 03b3318 | fame signals and calibration, points.json, pair_with, bases |
| INT-A | ea37797 | home GlobeCover, cross-browser, a11y, OG images, honest actions, deep links |
| INT-B | ed4f847 | no bulk files (P8), light list rows, split search, the P9 data boundary, four-filter Places |
| RC | 327d8a7 | research correction pass (anchors cut from 57 to 43, links re-sourced, 20 hand pairs) |
| INT-C | 431bd1a | place page JS cut from 197 to 147 KB, link-only facts dropped, build error gate |
| SW-A | a413115 | sweep must-fixes 2.34-2.37: public text says who a plan suits, Vermont no-position map, /about/ index, 404 links, icons, /terms/. Follow-ups 2.42-2.45 |
| SW-B | 1b5f42d | sweep must-fixes 2.38-2.40: self-hosted WebP renditions, globe data per country (globe HTML 15 KB), scrollable tables. Follow-ups 2.46-2.49, Q25 |
| S1 Part 0 + A | 3c59c7d, c40c99a | place page sections design and mock; contract, suitability, relevance and sections modules; party scrub tightened (2.43). Part B (UI) waits for owner mock review and L3c, L4b, L3b |
| CS7 batch 1 | b83b8ea | 53 capture records, 47 points, lake access, placement review, prices; ledger holds original leaves |
| L4b | a974eef | OSM trail tracks (ODbL), profiles, GPX/KML from confirmed tracks, 100 trail pages for every trip |
| L3c | b02f4a4 | trip timeline: profile chosen once, whole-trip and per-day timelines with fixed/anchored/suggested times, split lanes, add a place with re-flow and 1,337 invariant cases, copy and ICS carry the profile, ORS legs for the Dolomites |
| L2b | ea97741 | globe experience: no green, smooth long flights, selectable cities with outlines, Canada census divisions (StatCan OGL), importance tiers, image-first cards, Q6 dark land as tokens; every script UA without an email |
| L3b | 235058c | trip tags and type-aware filters: Kids from and Hike effort with their basis (never below what data proves, never above it from gaps), six pills when scoped, fades with reasons, trips map pins at real stops, clusters that split |
| CC | eaa5684 | capture contract foundation: 324-type tree, property registry, place/route/offer layers, 61 records split with a value ledger |

The stage 2 sweep report is `verify-integration.md` (Lighthouse, privacy, P8, the 10,000-place test, the first-use walk).

## Key specs (read before working in an area)

- **Principles:** `design/foundation/principles.md`. P1-P9, plus the travel cross-check with T1-T5. Includes P8 (protect the catalogue) and P9 (server-ready).
- **Data model:**
  - `research/capture-contract.md`, the single schema contract.
  - `research/suitability.md` and `research/suitability-applicability.md`.
  - `research/relevance.md`, including pair_with and route_is_attraction.
  - `data/vocab/types.json`, the one authored type tree.
- **Trip page:** `features/trip-timeline.md` and `design/trip-page/timeline-design.md`, which has a mock.
- **Short trips:** `features/short-trips.md`.
- **Suitability display:** `design/suitability-display.md`, which has a mock.
- **Globe:** `design/globe/spec.md`, `experience-review.md`, `owner-feedback-2026-10-18.md`.
- **Operator questions for the owner to send:** `research/operator-questions-2026-10-18.md`.

## Owner decisions in force

- **Product scope:**
  - The public read-only site comes first; the planner second.
  - Under 100 users in year one, so free tiers.
  - No green. Trailhead design.
  - All 14 trips are public and dateless. **Nothing is private for now (owner, 19 Oct)**: every trip and all its places and trails are published; the fail-closed visibility code stays for later. Old legacy pages are retired with redirects at go-live (Q25).
- **Maps:**
  - MapLibre on the globe and trips; Google Maps JS on place pages.
  - Never two map families on one page.
  - Coordinates never come from Google.
- **Privacy:**
  - No household data on the public site: no party, no ages of the travellers, no home town (Whitby), no personal status, no stay ideas.
  - Public trips say who they suit, not who went.
- **Catalogue (P8):** nobody can pull the catalogue in bulk; exports are per item.
- **Server (P9):** all data goes through `web/lib/client/data.ts`, so the site can move to a server step by step.
- **Taxonomy:** complete and extensible. A new type is one entry in `types.json`.
- **Models:**
  - Opus for planning, research and design review.
  - Sonnet for building and verifying.
  - **Never Fable.**
  - Browser checks run on the Arc GPU (`--use-gl=angle --use-angle=gl --ignore-gpu-blocklist --enable-gpu-rasterization`), never SwiftShader.
- **Keys:** the owner's keys are in `travel-wt/v2/web/.env.local` (mode 600). Never print or commit them. The Google key's website restrictions are open for testing and must be restored at go-live (7.2).
- **Empty sections:** empty place sections stay visible as markers of missing data. Enrichment fills them.

## Open owner questions

Q1-Q24 are in `BACKLOG.md`, each with a recommendation. "Go with your recommendations" settles all of them. The ones that matter soonest:
- Q6: the dark globe palette.
- Q7: trip page defaults.
- Q17-Q19: relevance badges, default order and hubs.
- Q22-Q24: toilets as required, gap-fill order, crawler.

## Services

| Service | Port | What |
|---|---|---|
| http.server (pid in /tmp/v2preview-server.pid) | 3440 | `/tmp/v2preview`, a copy of `web/out` built from v2 HEAD (rebuilt after SQ1b, d1e7dd5-era, 19 Oct), behind https://bbs-increases-festival-ccd.trycloudflare.com (pid in /tmp/v2preview-tunnel.pid). Built with `web/.env.local` present (public maps key only; the ORS key was checked absent from the output). Rebuild and recopy after each merge |
| http.server | 5197 | `docs/v2/design`, behind https://accountability-workshops-refused-rural.trycloudflare.com (mocks: `/trip-page/mock/`, `/globe/mock/`, `/suitability-display/mock/`) |
| http.server | 3430 | `/tmp/l2preview/web/out`, an older build of the site, behind https://storage-repeat-reflects-growing.trycloudflare.com. Rebuild it from v2 HEAD before showing it again |

## Cleanup due

The merged lane worktrees can be removed once the owner agrees (confirm every deletion): v2-L2, L3, L4, PS, S0, S0b, RV0, RVC, CF, SR, RC, INTA, INTB, INTC and CC. Older pre-v2 work: `travel-wt/p3b` (parked) and `travel-wt/p4b` (PR #7 still open).
