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
| SW-A | v2-SWA | sweep must-fixes 2.34 (privacy: no party, child ages or "with kids N+" in public text; remove the links to legacy plans), 2.35 (Vermont map frames Europe), 2.36 (/about/, the 404 page's links, favicon) and 2.37 (terms page) | verify, then merge |
| SW-B | v2-SWB | sweep must-fixes 2.38 (self-hosted resized images, LCP and CLS), 2.39 (globe pin list into on-demand data files) and 2.40 (tables scroll with a sticky first column) | verify, then merge |

After both merge, start **stage 3**. Run lanes in parallel with disjoint files:
- **L3c**, the trip timeline. It goes first; its brief is `L3c-trip-timeline.md`.
- **S1**, the "Who it suits" display and capture-contract step 5 (UI sections from the contract). Read `CC-adapter-requests.md`.
- **L3b**, trip tags and filters (step 6, type-aware filters).
- **L2b**, the globe experience (`design/globe/spec.md`).
- **L4b**, trail tracks.
- **Capture contract step 7**, gap-filling research: hours, prices, booking windows, toilets and parking. Work through `research/capture-research-backlog.md` first.

Stage 4 is the design review by the Opus reviewer (never Fable), scored against P1-P9 and T1-T5. Stage 5 is the cross-model checks. Stage 6 is the owner's review. Stage 7 is go-live.

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
  - All 14 trips are public and dateless.
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
| http.server | 5197 | `docs/v2/design`, behind https://accountability-workshops-refused-rural.trycloudflare.com (mocks: `/trip-page/mock/`, `/globe/mock/`, `/suitability-display/mock/`) |
| http.server | 3430 | `/tmp/l2preview/web/out`, an older build of the site, behind https://storage-repeat-reflects-growing.trycloudflare.com. Rebuild it from v2 HEAD before showing it again |

## Cleanup due

The merged lane worktrees can be removed once the owner agrees (confirm every deletion): v2-L2, L3, L4, PS, S0, S0b, RV0, RVC, CF, SR, RC, INTA, INTB, INTC and CC. Older pre-v2 work: `travel-wt/p3b` (parked) and `travel-wt/p4b` (PR #7 still open).
