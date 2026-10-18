# Public site: the full backlog to go-live (owner rule: every finding lands here first)

Updated 2026-10-18, late evening. This is the single list. Every finding goes in here with an ID the day it is
made, from the owner, a verifier, a design review or a builder. Items are worked in stage order and marked done
with their commit. STATUS.md holds the live lane state and points here. TODO.md keeps the cross-product list and
points here for the public site.

Owner: the coordinator (Claude), end to end. Gates: travel-verifier (Sonnet, on the Arc GPU) after every lane;
travel-design-reviewer (Fable) after every UI stage; the owner reviews once, at stage 6.

Status words: **done** (with commit), **doing** (agent running), **next** (ready to start), **queued** (waits
for its stage), **owner** (needs Nitin), **later** (after go-live).

## Stage 0: done this round

| ID | Item | Source | Commit |
|---|---|---|---|
| D1 | Foundation in code (L0), data adapter (LD), map adapter (LM), copy/export/share (L5), home and search (L1) | build plan | 1f9e7d9, ac4d947, 24b6609, 972fbd4, bc8d102 |
| D2 | Trips lane L3: day photos, route labels hidden in both styles, map key under the map, map fit, country names, decimals kept whole, done-trip template mode, per-day share links, print hooks, lazy trips map for the JS budget | L3 verifier | 65eee4c |
| D3 | Places lane L4: places search, place and trail pages, link checklist with "none found (checked ...)", no internal wording, OSM records as links, units in the elevation profile, empty-hazard card, dark place maps, quiet cluster pins, deterministic places-parity | L4 verifier | d0cb415 |
| D4 | Real Google key verified on a trail page and a place page (no request before the click, our points, directions from our coordinates) | owner key | 30f7d5f |
| D5 | Browser checks render on the Arc GPU (60 fps) instead of SwiftShader (1.7 fps); recorded in the agents and README | owner | 3608565 (main), v2 agents |
| D6 | Owner feedback F1-F7 recorded with causes | owner | fad4a26, 4a6d23d |
| D7 | Final plan stages 1-7; TODO rows for L3b, L4b, L3c | owner | b283dfc, 33f6569 |

## Stage 1: finish wave 2

| ID | Item | Source | Status |
|---|---|---|---|
| 1.1 | Globe: seas hidden by the `poi` label regex (engine.ts:82) | L2 verifier | doing |
| 1.2 | Globe: peaks not hoverable or selectable in any style (no `mountain_peak` style layer); add our own hit layer | L2 verifier | doing |
| 1.3 | Globe: antimeridian rings on Russia (and USA, Fiji, Kiribati, NZ, Antarctica); test that no segment spans more than 180 degrees | owner F2 | doing |
| 1.4 | Globe: an always-visible Reset view button, Home and Esc keys, breadcrumb never covered | owner F5 | doing |
| 1.5 | Globe: world framing must allow for the control card; Wikipedia link back on the feature card; a country label hit must not replace the facts tooltip; collapse the empty photo block; GlobeCover pauses off-screen; 844x390 spacing | L2 verifier | doing |
| 1.6 | Globe: rebase; delete the obsolete `tests/foundation/stubs.test.tsx`; frame times on the GPU (p50/p95) in the report | coordinator | doing |
| 1.7 | Re-verify L2, merge, run tsc/test/build on the merged branch | gate | queued |
| 1.8 | Privacy lane PS: personal place status and `stayStatus` off all public output; "In a public trip" facet; payload test | owner F7 | doing (verifying 832ccb7) |
| 1.8b | PS verify failed: raw store notes in the public `/data/places.json` ("Planned as dolomites-july-2027 (13-26 Jul 2027). Hotel idea: ...", Stowe "Planned as vermont-fall-2026 (1-4 Oct 2026)"); "Hotel idea" cut mid-URL in the Dolomites hero, meta and og text; dated public trip titles ("Muskoka and Algonquin, 10–12 October 2026"); a source date in Mont du Dome text; the privacy test must scan every file in `web/out` | PS verifier | doing |
| 1.9 | Merge PS | gate | queued |
| 1.10 | Fable globe experience review: `globe/experience-review.md` (M1-M14, S1-S12), rewritten `spec.md` as the L2b build spec, mock at `globe/mock/` | owner F1 | done 3769fe7 |
| 1.11a | Trip timeline model `features/trip-timeline.md` and brief `L3c-trip-timeline.md` (Opus): the entry list, a scheduler in `core/src/schedule/`, the party profile, ORS legs stored at publish, markers to chips. Audit: 1 of 14 trips timed today, 10 of 14 can get authored schedules (about 330 legacy time cells and 80 Rockies note times exist), 4 rule-only, 6 overview trips need days | owner | done (this commit) |
| 1.11b | Trip timeline design `design/trip-page/timeline-design.md` with a mock (Fable): a "Plan it for" selector, a sticky plan bar with a day rail, "The trip at a glance" strip, always-open day timelines with leg connectors, notes as "Know before you go", a sticky map in step with the scroll | owner | done (this commit) |
| 1.13 | Globe M1, blocking: drag dead at world zoom and the release drills into a country (the spin tick calls `jumpTo` while the pointer is down); sent to the L2 builder | Fable review | doing |
| 1.12 | Show the owner the timeline mock and the globe mock before those lanes build | owner rule | queued |

## Stage 2: integration pass (coordinator, after stage 1 merges)

| ID | Item | Source | Status |
|---|---|---|---|
| 2.1 | Home cover becomes `GlobeCover` (one change in `components/home/CoverGlobe.tsx`) | L1 report | queued |
| 2.2 | Re-verify the home page and global search with the merged trips, places and globe (not checked since those lanes merged); the search index covers places, trips, seas and ranges | gap audit | queued |
| 2.3 | Scrub capture notes at the source: the adapter stops putting capture notes into `summary` and `notes`, and drops the first-two-sentences summary logic (`lib/public/places.ts:195`); render-time filters stay as a second guard | L4 adapter request | queued |
| 2.4 | L0 fixes: `/specimen/` axe (loading button with no name, small-text contrast; flaky in 3 runs); scope the app.css phone `.search` rule to `.filter-bar` | L0, verifiers | queued |
| 2.5 | Foundation doc edits: globe spec section 10 (hover fill and casings, `--map-park`, `--map-casing`, `--globe-edge`, `?f=`, pitch and bearing in `?c=`), the L2-4 casing values, `Pin.quiet`, `hideBasemapLabels`, `style: 'auto'` | L2 review, L3/L4 reports | queued |
| 2.6 | LM-owned code review of the additive edits: `lib/map/maplibre/labels.ts`, `Pin.quiet`, `MapSpec.hideBasemapLabels`, the BottomSheet `peekPx` and `initialFocus` | L3, L4, L2 reports | queued |
| 2.7 | JS budget headroom is 3 KB on /places and /trips: find the next lazy split before wave 3 adds code | verifiers | queued |
| 2.8 | e2e hygiene: tests force the maplibre family so a local `.env.local` with `google-js` cannot change what they build; places-parity robust under concurrent runs; add a click-and-embed check to places-google.spec | L4 report, verifiers | queued |
| 2.9 | Place maps: parking pins stacked under the selected pin at Tre Cime; Braies labels; the initial view must include the trailhead | L4 not fully fixed | queued |
| 2.10 | Cross-browser: install Playwright WebKit and Firefox; run the e2e smoke set and screenshots on WebKit (iPhone and Mac Safari) and Firefox. Today only Chromium is tested | gap audit | queued |
| 2.11 | Accessibility across page types: axe on home, trips, trip page, places, place, trail, globe, about; keyboard path through the globe | gap audit | queued |
| 2.12 | SEO and sharing: sitemap covers every trip and place; canonical URLs; per-trip and per-place Open Graph images (only `og-default.png` exists); `/specimen/` noindex | gap audit | queued |
| 2.13 | Honest actions without accounts: check what "Save to a trip" and "Copy to my trips" do before sign-in exists; each must do something real (download, ICS for a dated copy) or say plainly that it comes with the planner | gap audit | queued |
| 2.14 | Images: Commons thumbnails at the sizes used (no full-size originals), lazy loading, width and height set to avoid layout shift | gap audit | queued |
| 2.15 | Full e2e on a quiet machine, a real Lighthouse (home first paint was 1.47 s against a 1.5 s target), the privacy grep of `web/out` | STATUS | queued |
| 2.17 | Foundation patterns: trip-page URL keys in 1.2 (`?p=`, `pace`, `d=`, `add=`); remove the Track A/B/C segment from 3.4; globe tokens `--globe-ocean`, `--globe-halo`, `--globe-edge`, `--globe-dim`, `--map-wood`, dark `--map-land`, `--map-high`, `--map-water` (after Q6) | planner, Fable | queued |
| 2.18 | Bring main's newer captures into v2 (for example Mount Rainier National Park, added 18 Oct as 7997941) and refresh the data snapshots, so new places reach the new site | owner capture | queued |
| 2.16 | Integration sweep by travel-verifier on the GPU, recorded in `verify-integration.md` | gate | queued |
| 2.19 | **Privacy: household origin in public output.** "Whitby" is in `web/out/trips/index.html` and the Québec, Algonquin and Vermont trip pages. The adapter replaces the household origin with the trip's hub label ("from Toronto") in every public string; the origin list lives in gitignored `data/private/origins.json`; a payload test fails on the origin string or a point within 2 km of it ([short-trips.md](../../features/short-trips.md) 4.4) | planner, 18 Oct | doing (sent to PS) |

## Stage 3a: data foundation (runs alongside stages 2 and 3; data and core only)

| ID | Item | Source | Status |
|---|---|---|---|
| 3a.1 | **Suitability metadata schema** (`research/suitability.md`, done this commit): a shared model for every kind covering min age, height or weight rules, recommended age band, carry-able toddler, stroller access, wheelchair and step-free access, an effort grade with its basis, child-pace time, toilets, shade, water, bail-out and signal, water safety, and access season. Kind detail on recognised scales (SAC, CAI, YDS, Parks Canada, via ferrata A-E, IMBA, Singletrack S0-S5, whitewater I-VI, operator rules for zip line and bungee), mapped onto one family effort scale. Every value has provenance; "not stated by the operator" is a valid value. Scope: 207 places on 8 public trips; 46% have some child data, none at the new Usable bar | owner | done (spec) |
| 3a.2 | **S0**: schema, validator and migration in `core/` (Zod, generated JSON schema), `projectForSchedule()` for L3c, sidecars under `data/suitability/<trip>/`; migration fixes the Kicking Horse 50 lb minimum stored as a maximum, the Kananaskis raft weight conflict, 4 Dolomites ages wrongly marked operator, the Rockies "hard" label (brief: suitability.md section 9) | spec | doing |
| 3a.3 | **Enrichment lanes** after S0 (travel-researcher, Opus, in parallel, no Commons): R1 Dolomites 40, R2a Rockies trails and sights 61, R2b Rockies activities 15, R3 Patagonia 19, R4 Iceland 25, R5 Utah 21, R6 Chamonix, Algonquin, Vermont 26. The six overview trips wait for L3d | spec | queued |
| 3a.5 | **S1** after L3c and L4b merge: the adapter, a "Who it suits" section on place pages (Fable designs it first), filters, the trip tags L3b needs, the new completeness checks | spec | queued |
| 3a.4 | **Short trips** (`features/short-trips.md`, done this commit): day trip, overnight, weekend and long weekend in the schema; origin and return legs, leave-by and home-by, day-use permits and timed slots, a weather go/no-go and Plan B; a compact public page; a "Day trips" filter; quick creation in the planner later. The household's origin stays private | owner | done (spec); build items 3.11-3.14 |

## Stage 3: wave 3 (four lanes in parallel, disjoint files)

| ID | Item | Source | Status |
|---|---|---|---|
| 3.1 | **L3c trip page timeline.** Whole-trip timeline and per-day timelines with times (fixed, anchored, suggested), drive legs, visits, meals and breaks, sun anchors, booking slots. A scheduler in `core/` (pure, tested) with authored overrides. A trip-level party profile replaces per-day A/B/C, with per-day override and "add to this day". Research markers (INFERENCE, CALC, "low confidence") become honesty chips; units follow the preference inside notes; long notes become "Know before you go" bullets | owner | queued (design and model doing) |
| 3.1b | L3c ownership is split from L3b: L3c owns the trip-page files and `components/trips/timeline/`; L3b owns the list page, `TripCover.tsx`, `components/trips/tags/` and `lib/public/tags.ts`, and must not edit `trips.ts`. L3c merges before L3b | L3c brief | queued |
| 3.1c | **L3d**, after L3c merges: import the about 330 legacy time cells for 8 trips (Patagonia, Iceland, Algonquin, Vermont, Niagara, New Hampshire, Quebec, Switzerland), shown as suggested until a person checks each trip; convert the 6 overview trips to days | L3c audit | queued |
| 3.2 | **L3b trip tags and filters** at parity with Places, using the same tag vocabulary, mostly derived (continent, countries, length band, season, kids' age, activities from places, hike effort, getting around, driving per day, one base or road trip); tag chips link to filtered lists | owner | queued |
| 3.3 | **L2b globe experience** from the rewritten spec: rendering (atmosphere, edge, palette, labels in one script), motion (spin, inertia, fly-to), selection cards per feature class, chrome that lets the canvas dominate, pin clustering that means something at world view, loading with no pop-in, a performance budget on the GPU | owner F1, coordinator shot | queued |
| 3.4 | L2b: city areas from OSM admin_level 8, pre-built for cities with our content, with an honest fallback | owner F3 | queued |
| 3.5 | L2b data: Canada ADM2 as the 293 census divisions (Statistics Canada, OGL), so Whitby is in Durham; audit every country's ADM2 for level meaning, truncated names (`*`) and coarse coastlines | owner F4 | queued |
| 3.6 | L2b: an image-first place card with a photo fallback chain (place, trip gallery, Wikidata/Commons, then a glyph and mini map), summary, 3 key facts, "Used in <trip>", Open place, Directions, Share; tooltip hidden while open; completeness badge instead of "Draft" | owner F6 | queued |
| 3.7 | **L4b trail tracks:** real OSM geometry for the 17 trails with route ids (ODbL, credited), elevation profile and GPX from the track, the 6 unconfirmed routes held back | owner | queued |
| 3.8 | L4b: trail pages for every trip's trails (62 Rockies, plus Patagonia, Vermont, Norway, Iceland, Chamonix and others) with the full link checklist; AllTrails and the rest stay link-only | owner | queued |
| 3.9 | Data: seasons for the 6 trips showing "season not set yet" | LD | queued |
| 3.10 | Data: rewrite the 34 dated texts the dateless rule dropped, as relative wording | LD | queued |
| 3.11 | **L3b additions for short trips:** length classes Day trip (0), Overnight (1), Weekend (2), Long weekend (3) ahead of the 4-8, 9-14, 15+ bands; a "From Toronto" drive pill (under 1 h, 1-2, 2-3, 3+) with the hub switchable; the card chip "Day trip · from Toronto 1 h 25"; group by Length. Needs `lengthClass` and `fromHubs` from the adapter ([short-trips.md](../../features/short-trips.md) 3.3) | owner, 18 Oct | queued (into the L3b spec) |
| 3.12 | **Data: hub drive matrix.** `web/scripts/hubs-ors.mjs`: ORS matrix from Toronto, Hamilton, Ottawa and Montréal to each short trip's first and last stop, sequential, from one lane, key in the header; output committed to `data/outings/from-hubs.json` (short-trips 4.1) | owner, 18 Oct | queued (needs stop points) |
| 3.13 | **L3e short trips** (after L3c merges, with or right after L3d's conversion of Niagara, New Hampshire and Québec): the outing frame (`data/outings/`, `trip-outing/1`), leave by and home by solved by the scheduler, `S_HOME_BY`, `S_CAR_SHARE`, `S_TRAFFIC`, the compact phone-first page (bar, go/no-go, book ahead, bring, cost, one timeline), Add to calendar with one date. Brief to write from short-trips 6.2 | owner, 18 Oct | queued |
| 3.14 | Data: an Elora Gorge public trip from the June vault note, refreshed by travel-researcher (2026 season 26 Jun to 7 Sep, prices, points from OSM); waits for owner Q7 | owner, 18 Oct | owner |

## Stage 4: Fable review of the whole built site, then its fixes

| ID | Item | Source | Status |
|---|---|---|---|
| 4.1 | Fable site review (`review.md`) of every page type on desktop and phone, light and dark | gate | queued |
| 4.2 | Known items for it to judge: the dark trips map shows water lighter than land; the mobile trail hero; table "Sources" column clipping at 1440; label overlap on place maps; the 844x390 globe | verifiers, coordinator | queued |
| 4.3 | Fixes from the review | gate | queued |

## Stage 5: sanity checks across models

| ID | Item | Source | Status |
|---|---|---|---|
| 5.1 | travel-verifier full sweep on the GPU: every page at 1440 and 390, light and dark, Chromium and WebKit; globe frame times | owner ask | queued |
| 5.2 | Independent Opus audit over `web/out`: privacy (no household data, no status, no booking state), data honesty (sources, estimates labelled), the dateless rule, licences and credits, and the Google terms (one map family per page, no Google coordinates) | owner ask | queued |

## Stage 6: owner review

| ID | Item | Source | Status |
|---|---|---|---|
| 6.1 | Tunnel preview of the full site; the owner reviews trips (all views), trip pages, places, place and trail pages, and the globe | owner | queued |
| 6.2 | His findings go into this backlog first, then are fixed in stage order | owner rule | queued |

## Stage 7: go-live

| ID | Item | Source | Status |
|---|---|---|---|
| 7.1 | Old trip URLs (`/dolomites-july-2027/`, `/canadian-rockies-sept-2029/` and the rest) still publish beside `/trips/<slug>/` and show calendar dates. Add 301 redirects to the new trip pages, and replace the old hub at `/`, `/globe/` and `/locations/` (the last still carries "planned" and trip dates) | gap audit, PS report | owner (confirm the redirects) |
| 7.2 | Restore the Google key's website restrictions (localhost ports, `nks-travel.pages.dev/*`, `*.nks-travel.pages.dev/*`, `*.trycloudflare.com/*`) | owner | owner |
| 7.3 | Remove the unused `NEXT_PUBLIC_GOOGLE_MAPS_MAPID` from `.env.local`; optionally turn off Google POIs in the Map ID style | L4 report | owner |
| 7.4 | Cloudflare Pages environment variables for the Google key, Map ID and place-map family | STATUS | owner + coordinator |
| 7.5 | Merge v2 into main, `./publish.sh`, served-URL check, sitemap to Search Console | go-live | queued |

## Owner questions open

| ID | Question | Raised |
|---|---|---|
| Q1 | Public trip pages show "by Nitin" in the hero. Keep your first name on public pages, or drop the byline? | 18 Oct |
| Q2 | Keep the date a place was saved and the Instagram post date in public place data, or remove them? (low risk) | 18 Oct |
| Q3 | Hide the old live `/locations/` page now, or let it go at go-live? | 18 Oct |
| Q4 | Confirm that old trip URLs redirect to the new trip pages at go-live (7.1) | 18 Oct |
| Q8 | Short trips with a weekday pattern: may the day header say "Day 1 · Saturday"? It amends the dateless rule. Recommended: yes ([short-trips.md](../../features/short-trips.md) Q1) | 18 Oct |
| Q9 | Public origin: Toronto only, or Toronto plus Hamilton, Ottawa, Montréal and a "use my location" estimate kept in the browser? Recommended: the second (short-trips Q2) | 18 Oct |
| Q10 | Elora tubing ended 7 Sep 2026, so the Sat 24 Oct scenario cannot have a tubing slot. Publish Elora as a summer template and change the scenario's October trip? Recommended: yes (short-trips Q3) | 18 Oct |
| Q11 | New Hampshire and Québec end in Vermont: separate short trips linked to Vermont, or prologue days inside Vermont? Recommended: Québec separate, New Hampshire folded into Vermont (short-trips Q4) | 18 Oct |
| Q12 | Suitability: make limited capacity and wheelchair needs a trip-profile control now, or keep them as chips and a Places filter in v1? Recommended: chips and filter in v1 | 18 Oct |
| Q13 | Suitability: the hardest grade is advice only for ages 13-15 and allowed outright from 16? Recommended: yes | 18 Oct |
| Q14 | Suitability: will you send the operator questions each research lane drafts (researchers cannot email or phone)? | 18 Oct |
| Q15 | Rockies: enrich only the items on the plan's days, or all 43 adventures and 62 trails? Recommended: the plan's days first | 18 Oct |
| Q16 | Capture Norway's known hard limits (Via Ferrata Loen, 40-120 kg) now, before its days exist? Recommended: yes | 18 Oct |
| Q5 | Timeline: default party per trip is the party it was written for (the Rockies: 2 adults and a 6-year-old)? Generated meals and coffee shown by default as "suggested" rows? "Add to this day" covers the trip's places plus the catalogue within 30 km of the base? Imported legacy times show as "suggested" until a person checks each trip? Pace and child rules of thumb (day caps, walk ceilings, 1.6x trail time at age 6-7) accepted to start? Recommended: yes to all | 18 Oct |
| Q7 | Trip page: open on the author's party ("Showing the plan as Nitin wrote it") or make a visitor choose first? Suggested times shown lighter with one "Suggested times" banner, or a "~" before each? The "Plan it for" selector above the season band and open on phone, or under the band and collapsed on phone? Recommended: author's party; banner; above the band, collapsed to one line on phone | 18 Oct |
| Q6 | Globe palette: accept the dark-theme direction in the experience review (land lighter than ocean; new globe tokens) so the foundation docs can change | 18 Oct |

## Later: after go-live (planner and data)

| ID | Item | Source |
|---|---|---|
| L1 | Signed-in planner: bookings, tasks, budget scoped to a trip; trip-scope rules and scenarios S1-S10; templates N1-N6; guest planning decided at schema time | product direction |
| L2 | Year calendar with the school calendar (F03) | owner |
| L3 | Enforce per-kind completeness (validator, badge, skill, MCP) | research |
| L4 | A person to confirm trail data: Braies P1, Monte Piana trailhead, the Fanes, Seceda and Nuvolau routes, Lago d'Antorno about 500 m off | trails lane |
| L5 | R2 bucket for planner offline maps | map stack |
| L6 | Prototype items: bookings wallet on stored bookings (F08), Explore map labels (F15), person-level items | TODO |
| L7 | Older work: P4b PR #7 (verify or close), the parked P3b worktree | STATUS |
