# Stage 4 to 7 plan: design polish, cross-model checks, owner preview, go-live

> **21 Oct 2026:** the current plan is [docs/v2/PLAN.md](../../PLAN.md). Sections 4 (stage 5 timing), 5 (stage 6 preview pass) and 6 (stage 7 go-live on Pages) are superseded by PLAN.md section 3 and EXECUTION-PLAN 7, 8, 11 and 13. Section 4's pass rules still define each check. The branch named below (`claude/serene-goldberg-wtn3di`) was deleted on 21 Oct and archived as the tag `archive/claude-serene-goldberg-wtn3di`.

> **Superseded in part (20 Oct 2026):** stage 5 (section 4) and stage 6 (section 5) now run once per review gate, R1 and R2, and the stage 7 checklist (section 6) is replaced by [EXECUTION-PLAN.md](EXECUTION-PLAN.md) sections 7, 8, 10 and 12. The rest stands as the record of stage 4.

Written 19 Oct 2026 by travel-planner (Opus) for the coordinator. Lanes start the moment **D2** (with CS7c inside it) merges onto `claude/serene-goldberg-wtn3di`. Rows are in [BACKLOG.md](BACKLOG.md); live lane state is in [STATUS.md](STATUS.md). Briefs are in [briefs/](briefs/).

Standing rules for every lane in this plan, so the briefs do not repeat the reasons:
- No green (the one documented exception is `--ok`; see conflict C1). Motion is smooth, and overlays are non-modal.
- P8 and P9: all data goes through `web/lib/client/data.ts`; no new client-side bulk load; list rows stay on the allowlist.
- No household data. A gap is never a yes.
- Opus reviews design. Sonnet builds and verifies. **Never Fable.**
- Browser checks run on the Arc GPU flags (`--use-gl=angle --use-angle=gl --ignore-gpu-blocklist --enable-gpu-rasterization`).
- Kill servers by the PID on the port, never with `pkill`.
- Commons, Overpass and Wikidata calls run sequentially under their `flock` files, with the no-email UA `travel-relevance-signals/1.0 (+https://nks-travel.pages.dev/about/)`.

## 1. The shape

```
 D2 merges
    |
    +-- SHL ----merge 1 (small; GPU e2e flags change everyone's baseline)
    +-- PLC ----merge 2 (place pages, maps adapter, seed rules)
    +-- TRP ----merge 3 (trip page; links need PLC's final page set)
    +-- GLB ----merge 4 (globe; shares no file with the others)
    +-- LST ----merge 5 (lists, filters, search, list shards; rebases onto the final place set)
    +-- CS7d ---data batches A and B, merged between the lanes (A before PLC's final shots)
    +-- SQ2s ---smart search phase 2 spike (measure only; new files), any time
    |
 REVIEW4: whole-site Opus review (4.1, 4.2) -> rows 4.20+ -> FIX4 in the same lane ownership (4.3)
    |
 Stage 5: cross-model checks 5.1-5.6 on one frozen commit
    |
 Stage 6: preview deploy from HEAD, Lighthouse (2.47), hand-over to the owner (6.1-6.3)
    |
 Stage 7: go-live, after the owner's approval only (7.1-7.10)
```

Five UI lanes, one data lane and one spike. That is fewer lanes than the review files suggest: every hot file has exactly one owner:
- `TripPlan.tsx` belongs to TRP.
- `FilterBar.tsx` and `components/entity/**` belong to LST.
- The places model (`lib/public/places.ts`, `seeds.ts`, `components/places/**`) belongs to PLC.
- `lib/client/data.ts` belongs to LST.
- `lib/map/**` belongs to PLC.

`lib/public/types.ts` stays shared, but only by additive blocks with a lane header comment. The later merger keeps both sides.

## 2. Lanes

| Lane | Brief | Agent | Rows | Effort | Port | Opus review before | Opus review after |
|---|---|---|---|---|---|---|---|
| SHL | [briefs/SHL.md](briefs/SHL.md) | travel-builder | 3.34, 2.41 (mobile nav slot), 4.15 (shell part) | 4 h | 3451 | no | no: verifier only |
| PLC | [briefs/PLC.md](briefs/PLC.md) | travel-builder | 4.9, 4.12, 3.31, 3.49 (count part), 3.55 (code part), 3.57 (place part), 3.58 (seed rules), 2.41 (gallery credits), 4.2 (place maps, trail hero, dark map water), 4.6 (dense admin labels) | 16 h | 3452 | no: S1b review already specifies each fix | yes |
| TRP | [briefs/TRP.md](briefs/TRP.md) | travel-builder | 4.4, 4.10, 3.35 (code part), 3.54, 3.57 (trip links), 2.41 (repeated day thumbnails), 2.45 | 14 h | 3453 | yes, short: the sticky map column and phone "Map · Day N" pill, and the whole-trip strip ticks (timeline-design 4 and 7 cover most of it) | yes |
| GLB | [briefs/GLB.md](briefs/GLB.md) | travel-builder | 4.5, 4.7, 4.13, 3.46, 3.3b (remainder) | 14 h | 3454 | no: L2b review and spec cover it | yes |
| LST | [briefs/LST.md](briefs/LST.md) | travel-builder | 4.6, 4.8, 4.11, 4.14, 3.56, 3.59, 3.51 ("short"), 2.41 (Done on pills, 10,000-row table and map views, sitemap), 4.2 (table "Sources" column) | 22 h | 3455 | yes: the collapsed phone filter bar, the non-modal header search, the unified Kids control, and the two-line count line | yes |
| CS7d | [briefs/CS7d.md](briefs/CS7d.md) | travel-researcher (Opus) | 3.55 and 3.58 (data part), 3.47 (remainder), 3.35 (stop points), 3.9, 3.10, 3.53 (remainder), 3.50 (if any is left after CS7c), 4.15 (Kids content for lakes) | 14 h, two batches | none | n/a | no: research verifier (Sonnet), check 5.3 |
| SQ2s | smart-search.md section 10 | travel-builder, measuring only | the 3.15 phase 2 spike (Q38) | 4 h | 3456 | n/a | no: the coordinator reads the numbers |

### 2.1 Files each lane owns (summary; the briefs list them in full)

| Lane | Owns | Must not touch |
|---|---|---|
| SHL | `web/playwright.config.ts`, `web/tests/e2e/global-setup.ts`, `web/components/shell/**`, `web/components/home/**` except `CoverSearch.tsx` and `CoverGlobe.tsx`, `web/components/ui/**`, `web/app/layout.tsx`, `web/app/page.tsx`, `web/app/not-found.tsx`, `web/app/app.css`, `web/app/globals.css`, `tools/theme_tokens.py`, `web/app/themes.css` (generated) | everything else |
| PLC | `web/components/places/**` except `rows.ts`, `PlacesMap.tsx`, `PlaceCardFooter.tsx` and `cluster.ts`; `web/components/suit/**`; `web/app/places/[slug]/**`; `web/lib/public/places.ts`, `sections.ts`, `suitability.ts`, `relevance.ts`, `contract.ts`, `completeness.ts`, `seeds.ts`, `trail-places.ts`, `photos.ts`, `honesty-overrides.ts`, `slugs.ts`, `tracks.ts`; `web/lib/map/**`; `web/components/map/**`; `web/redirects.json`; `web/styles/suitability.css` and the place-page styles; tests under `web/tests/places/**`, `web/tests/data/sections*`, `suitability*`, `relevance*`, `place-*`, `web/tests/e2e/place*.spec.ts`, `places-trail.spec.ts`, `places-google.spec.ts` | `lib/client/data.ts`, `lib/public/index.ts`, `trips.ts`, `globe.ts`, `components/entity/**`, `components/trips/**`, `components/globe/**` |
| TRP | `web/app/trips/[slug]/**`, `web/components/trips/**` except `TripsMap.tsx`, `TripCover.tsx`, `types.ts` and `tags/**`; `web/lib/public/trips.ts`, `timeline.ts`, `prose.ts`, `quantities.ts`, `legs-pairs.ts`; `core/src/schedule/**`, `core/test/schedule/**`; `data/schedules/**`; `web/styles/timeline.css` and the trip-page styles; `web/lib/export/**`; `web/components/actions/**`; tests `web/tests/trips/timeline*`, `web/tests/data/prose*`, `web/tests/e2e/trip-*.spec.ts`, and the trip page `describe` blocks of `trips.spec.ts` | `components/places/**`, `lib/map/**` (additive only, listed), `components/entity/**`, `components/ui/**` |
| GLB | `web/app/globe/**`, `web/app/globe-data/**`, `web/lib/globe/**`, `web/components/globe/**` (`GlobeCover.tsx` included), `web/styles/globe.css`, `web/public/globe/**`, `tools/globe_data.py`, `web/scripts/globe-*.mjs`, `data/reference/globe/**`, `web/lib/public/globe.ts`, `data/trips/base-points.json`, `docs/v2/design/globe/spec.md` 3.2 (the accepted left-dock note), tests `web/tests/globe/**`, `web/tests/e2e/globe*.spec.ts` | `lib/client/data.ts` (request any change), `web/redirects.json` (the `/globe/*` rule is a coordinator edit at merge, see GLB brief) |
| LST | `web/lib/client/data.ts`, `web/lib/public/index.ts`, `pages.ts`, `tags.ts`, `bands.ts`, `world.ts`, `taxonomy.ts`; `web/lib/entities/**`; `web/components/entity/**`; `web/components/search/**`; `web/components/home/CoverSearch.tsx`; `web/lib/search/**`; `web/app/places/page.tsx`, `web/app/trips/page.tsx`, `rows.ts`, `layout.tsx`, `web/app/search/**`, `web/app/sitemap.ts`; `web/components/places/rows.ts`, `PlacesMap.tsx`, `PlaceCardFooter.tsx`, `cluster.ts`; `web/components/trips/TripsMap.tsx`, `TripCover.tsx`, `types.ts`, `tags/**`; `web/styles/trips.css` and the list styles; `data/vocab/tags.json`; `web/scripts/search-vocab.mjs` and `web/public/search/**`; `web/tests/data/boundary.test.ts`, `light-data.test.ts`; list tests and e2e (`places.spec.ts`, `places-parity.spec.ts`, `smart-search.spec.ts`, the list `describe` blocks of `trips.spec.ts`) | `components/places/**` other than the four files named, `lib/public/places.ts`, `seeds.ts`, `trips.ts`, `globe.ts`, `components/globe/**`, `lib/map/**` (additive only, listed) |
| CS7d | `data/capture/**`, `data/suitability/**`, `data/relevance/**`, `data/sources/**`, `data/tracks/**` data files (not `tracks-osm.mjs`), `docs/v2/research/lanes/CS7d-notes.md`, `docs/v2/research/operator-questions-2026-10-18.md`, `research/capture-research-backlog.md` | all of `web/`, `core/`, `data/schedules/**`, `data/vocab/**` (a type change is requested, not made) |
| SQ2s | new files only: `web/scripts/embed-spike/**`, `docs/v2/research/smart-search-spike.md` | everything else |

Shared files and the rule for each:
- **`web/lib/public/types.ts`:** PLC, TRP and LST each add fields in their own block headed `// <lane> (stage 4)`, and never edit another lane's lines.
- **`docs/v2/build/public-site/BACKLOG.md` and `STATUS.md`:** coordinator only. Lanes report row status in their hand-back.
- **`tools/check-all.sh`:** LST may add one line for a shard check, and no one else edits it.

### 2.2 Merge order, and why

| # | Lane | Why here |
|---|---|---|
| 1 | SHL | It is the smallest lane. It changes the e2e launch flags (3.34), so every later lane's motion and map e2e runs on the GPU from its rebase on. It also owns `components/ui/**`, which every lane reads. |
| 2 | PLC | It changes the page set: seed rules (3.58) drop lodging, collapse duplicates (3.55) and redirect the second slug. TRP's trip links and LST's list rows, sort and shards must rebase onto the final set, the same rule L4b followed in stage 3. PLC also owns `lib/map/**`, which TRP's route map and LST's trips map read. |
| 3 | TRP | Its kind-aware lookup (3.54, 3.57) links trip stops to pages, so it needs PLC's final slugs. It shares no file with GLB or LST. |
| 4 | GLB | It shares no file with anyone. Its default slot is here, but it can merge whenever it passes. |
| 5 | LST | It is the largest lane, and it reshapes list data (3.59). It goes last so the shard format is built on the final page set, and so its rebase is the only one that touches `data.ts`. |
| between | CS7d A | Merges before PLC's final shots, because PLC's duplicate collapse needs the `same_place_as` marks. |
| between | CS7d B | Merges before LST's final shots, because the list counts change with the data. |
| any | SQ2s | New files only. |

If PLC slips, TRP may merge first. TRP then re-runs its link test after PLC merges and fixes any dead link in a follow-up commit. LST never merges before PLC.

Each lane runs `tsc`, unit tests, e2e and its Playwright shots at 1440 and 390, light and dark, read in tiles. Then come the Opus design review (where marked) and travel-verifier on the Arc GPU. The gate on the merged branch is `bash tools/check-all.sh`, with `web/.env.local` moved aside to a mode-600 file and put back afterwards.

### 2.3 Stage 3 rows that are not in stage 4 (decided here)

| Row | Decision | Why |
|---|---|---|
| 3.1c L3d (legacy times for 8 trips), 3.13 L3e (short trips), 3.12 (hub drive matrix) | **After go-live.** Status unchanged. | They are not in the owner's 19 Oct finish list. The trips that need them already render honest summary or overview pages. 3.23 hides the From Toronto pill until hub data exists. |
| 3.14 Elora | Owner (Q7), unchanged | It waits for him. |
| 3.15 phase 2 | **Spike now (SQ2s); ship after go-live.** | The owner's finish list names the spike. Shipping a 34 MB model before go-live adds risk to the preview for no gain in the 90% path (P7). Q38 already says to decide after the spike. |
| 3.37 point as a record property | Later, unchanged | It is a capture-contract change, not a polish item. |

## 3. REVIEW4: the whole-site Opus review (4.1, 4.2), once all five lanes have merged

**Who:** travel-design-reviewer (Opus), never Fable, in a throwaway worktree at the merged HEAD. Build with `pnpm build`, with `.env.local` moved aside. Then rebuild once with it in place, for the Google place map family.

**Scope:**

| Area | Screens |
|---|---|
| Home and search | `/`, header search open with a query (smart chips), no-result search |
| Trips list | cards, list, table, map; Kids, Length and When set; six pills when scoped |
| Trip pages | Rockies (full: default, `?p=family-3`, `?split=1#day-5`, add to day), Dolomites (A/B days), Patagonia (summary), Switzerland (overview), Vermont (done, template), Niagara (short); print view; the copy sheet |
| Places list | cards, list, table, map; Kind scoped (six pills); Kids at 6; "Not checked yet" group from a parsed query |
| Place pages | new layout (Moraine Lake, Lake Louise, Ötzi, Larch Valley), older layout (Capri), a lift or offer (Banff Gondola), a duplicate's redirect |
| Trail pages | confirmed track (Tre Cime), unconfirmed (Fanes); GPX and KML export |
| Globe | world (spin, drag), country, state, city card, place card, immersive, a reload of a level deep link |
| Site | `/about/`, `/about/data/`, `/terms/`, 404 |

- **Viewports:** 1440 x 900, 390 x 844 and 844 x 390, light and dark through the site's own theme toggle, 2x, tall pages read in 1600 px tiles.
- **First-use walk (P4), with no prior knowledge.** Three tasks, timed, with every hesitation written down:
  1. "A family-friendly lake walk in Canada, and how to park for it."
  2. "A September trip of about 10 days that suits a 6-year-old."
  3. "Copy the Dolomites trip with my own dates and put it in my calendar."
- **Scale test (P1).** Build the 10,000-place fixture (`web/scripts/build-fixture.mjs`, `TRAVEL_ROOT`), with the detail pages capped as in verify-integration section 6. Judge the following at that size: the list (all four views), the counts and grouping, the filter menus, search, the sitemap size, and the globe clusters. The reviewer judges the design; check 5.1 measures the numbers.
- **Scoring:** P1-P9 and T1-T5 for each page type, as pass, partial or fail with the screen as evidence. Also: contrast pairs that are new since the lane reviews; the motion of every open and close; non-modal overlays; no green other than the `--ok` exception (C1).
- **Where findings go:** one row per finding in BACKLOG.md under Stage 4, from **4.20** up, each marked **must** (blocks stage 5) or **polish** (fixed in FIX4 if it is small, otherwise "later" with a reason). The report is `docs/v2/design/review-site-stage4.md`.

**FIX4 (4.3):** the coordinator groups the must rows by the lane ownership in 2.1 and re-opens only the lanes that have rows, as FIX4-<lane>, in the same worktrees, with the same merge order. Then the reviewer re-checks the changed screens only, and the verifier runs once on the merged result. Stage 5 starts when no must row is open.

## 4. Stage 5: cross-model checks

The rule: every check is run by a model other than the one that built or wrote the thing. Sonnet built the UI and the code, so Opus checks them. Opus wrote the research and the design rulings, so Sonnet checks those. Never Fable. All checks run on one frozen commit (the FIX4 merge). A failed check opens BACKLOG rows (5.x-n), and those rows are fixed before stage 6.

| ID | Check | Model (built by) | Scope | Pass rule | When |
|---|---|---|---|---|---|
| 5.1 | Full sweep and measurements | travel-verifier, Sonnet (the design was signed off by Opus) | every page type at 1440, 390 and 844 x 390, light and dark; Chromium, WebKit (iPhone, desktop) and Firefox; globe frame times; the 10,000 fixture's numbers (first card, filter-to-count, keystroke-to-result, long tasks) | 0 page errors, 0 horizontal overflow, 0 serious axe issues. At 10,000 on CPU x4: first card ≤ 600 ms, filter-to-count ≤ 500 ms, keystroke ≤ 500 ms, no long task over 50 ms after idle. Globe p95 ≤ 20 ms at idle and during a drag | after FIX4 merges |
| 5.2 | Public output audit | Opus (adapter and pages built by Sonnet) | every file in `web/out`: privacy (no household names, ages, party, Whitby or a point within 2 km of it, personal status, stay ideas, booking state), the dateless rule, licences and credits (ODbL lines, Commons credits), Google terms (one map family per page, no Google coordinates), no internal words | 0 privacy or dateless hits; every OSM line and Commons photo credited; 0 link-only platform values shown as facts | after FIX4 merges |
| 5.3 | Research sample | travel-verifier, Sonnet (written by Opus researchers in CS7c and CS7d) | 80 values sampled at random across the CS7c and CS7d diffs, read against their own source pages (sequential, no-email UA) | ≥ 90% match, 0 mismatched hard limits (age, height, weight, closures), 0 forbidden sources, every gap honest | after CS7d batch B merges (it may run during stage 4) |
| 5.4 | Timeline plausibility | Opus (scheduler built by Sonnet) | 12 days across Rockies, Dolomites, Patagonia and Niagara under 4 profiles (`adults`, `family-3`, `family-6`, `family-14`), with and without one added place | 0 times a family would not believe: no lunch outside 11:30-13:30, no dinner after 19:30 for a family, no leg copied from another, no unrounded suggested time, every moved or dropped entry has a note | after FIX4 merges |
| 5.5 | P8, P9 and security code audit | Opus `senior-code-auditor` (code built by Sonnet) | the stage 4 diff (`git diff <stage-4 base>..HEAD -- web core tools`) | no `fetch` or JSON import for data outside `lib/client/data.ts` (the boundary test is green); no new bulk file in `web/out`; the list rows equal the allowlist; the Google and ORS key prefixes found in 0 files (checked locally, never printed); `_redirects` and `_headers` parse | after FIX4 merges |
| 5.6 | Design-ruling closure | travel-verifier, Sonnet (rulings written by Opus) | every must and stage-4 item in the six review files and `review-site-stage4.md` | each one is shown fixed on a screen, or has a BACKLOG row marked later with a reason | last, before stage 6 |

## 5. Stage 6: the preview pass (6.1-6.3, 2.47)

The coordinator runs this, with no owner involvement until the hand-over.

1. **Rebuild from HEAD.**
   - Move `web/.env.local` aside to a mode-600 file only if the build needs it out of the way. The preview build needs the public maps key in, so the Google place map can be judged. Then check that the ORS key is absent from `web/out` (`grep` its first 8 characters locally, never printed).
   - Run `python3 tools/publish.py --dry-run` into `.site/`. Then **remove the legacy trip routes from the preview staging**: they still carry household data (2.48), and they retire at go-live.
   - Add the go-live `_redirects` (7.1) and `_headers` (2.46) to the staging, so the preview tests the go-live configuration. The `_headers` file also gets `X-Robots-Tag: noindex` on the preview only.
2. **Deploy a Pages preview**, not production: `npx wrangler pages deploy .site --project-name nks-travel --branch v2-preview`. This gives a real CDN with compression, which the tunnel cannot give (2.47). Check `npx wrangler whoami` first. If the login has expired, the owner must approve a device login (Q42).
3. **Lighthouse (2.47)** on the preview URL.
   - Pages, each on mobile and desktop: home, `/trips/`, a trip (Rockies), `/places/`, a place (Moraine Lake), a trail (Tre Cime) and `/globe/`.
   - Run on the GPU flags and record the scores in `verify-preview.md`.
   - **Targets:** LCP ≤ 2.5 s on mobile for trips, places, a place and a trail, and ≤ 4.0 s for home and the globe. CLS ≤ 0.1 everywhere. Accessibility 100 (globe ≥ 96). Best Practices ≥ 95. Desktop performance ≥ 90.
   - Ignore the SEO audit's noindex finding on the preview.
   - Also re-profile the globe long flights (4.7) here. A miss on these targets opens a 6.x row and is fixed before the hand-over.
4. **Served checks on the preview:**
   - every sitemap URL returns 200;
   - the `/globe/<level>/` reload rule works (S2 from 4.5);
   - a duplicate place slug redirects (3.55);
   - `/img/*` returns `immutable`;
   - `robots.txt` blocks the AI crawlers;
   - there is no `/specimen` route.
5. **Tunnel fallback:** if the Pages preview cannot be used, serve `web/out` on a free port with a new cloudflared tunnel, and kill the old preview servers on 3440 and 3430 by PID (`/tmp/v2preview-server.pid`, `/tmp/v2preview-tunnel.pid`). Lighthouse then waits for the real deploy at stage 7, and the hand-over says so.
6. **Hand-over (6.3):** one message to the owner. It contains:
   - the preview URL;
   - the Lighthouse table;
   - what changed since he last looked (stage 3 and 4 in five lines);
   - the "look at" list below;
   - the owner decisions Q43-Q49 with a recommendation each;
   - one line saying that his findings go into BACKLOG first (6.2).

**What to tell the owner to look at:**
1. The trip page for the Rockies at his own default, then "Plan it for" a 3-year-old. Do the times and the no-fit wording read as true?
2. A place page on the new layout (Moraine Lake), and the older layout (Capri): is the seam acceptable?
3. The places list on a phone with filters set. The bar collapses to one line; does it still say what is filtered?
4. The globe: spin, drag, open a city, open a place, then reload a deep link.
5. Search with a sentence ("easy hike with kids near Banff in September").
6. **Real Safari on his iPhone and Mac.** This is the manual look 2.29 left open, and only he has the devices.
7. Dark mode on a phone.
8. The green "fits" chip under a profile (C1, Q47).

## 6. Stage 7: go-live checklist (**needs owner approval**)

Nothing here runs before the owner approves the preview. The order is the order below.

| # | Step | Row | Who | Rollback |
|---|---|---|---|---|
| 1 | Owner approves the preview, and his 6.2 rows are closed | 6.1, 6.2 | owner | n/a |
| 2 | Remove `/specimen` from the public build (route, sitemap, robots `noindex` no longer needed) | 2.42, 7.8 | coordinator, one commit | revert the commit |
| 3 | Retire the legacy pages: a 301 (see Q45) from every legacy trip folder to its `/trips/<slug>/` page, including the five with household data (Q25, 2.48); the app replaces the old hub `/`, `/globe/` and `/locations/` (7.1). Generated into `web/redirects.json`, with a served-URL test that every legacy URL resolves to a v2 page | 7.1, 2.48 | coordinator | remove the rules and redeploy; but browsers cache a 301 for good, see Q45 |
| 4 | `_headers` from `publish.py`: `/img/*` `public, max-age=31536000, immutable`; `/globe-data/*` and `/search/*` short cache (`max-age=3600`); HTML `max-age=0, must-revalidate` | 2.46 | coordinator | delete the file and redeploy |
| 5 | `robots.txt`: allow search engines; disallow the AI crawlers by name (GPTBot, ClaudeBot, CCBot, Google-Extended, PerplexityBot, Bytespider, Applebot-Extended and the rest of Cloudflare's list) | 7.6 | coordinator | revert |
| 6 | Edge protection: Bot Fight Mode, Block AI Bots, and one rate-limit rule. **These are zone settings and very likely do not apply to a `*.pages.dev` hostname** (to be confirmed in Cloudflare's docs before relying on it), so they need a custom domain (Q44) | 7.6, 7.7 | owner (dashboard) | toggle off |
| 7 | Cloudflare Pages: the build runs locally in `publish.py` and uploads `.site/`, so Pages needs no environment variables unless the build moves to Pages CI. Confirm, and close 7.4 | 7.4 | coordinator | n/a |
| 8 | Remove the unused `NEXT_PUBLIC_GOOGLE_MAPS_MAPID` from `.env.local` (never print the file); optionally turn off Google POIs in the Map ID style | 7.3 | coordinator; the POI part is the owner's | re-add the line |
| 9 | Merge v2 into main (a merge commit, so it can be reverted as one), run `./publish.sh`, run the served-URL check, submit the sitemap to Search Console | 7.5 | coordinator, after Q43 | Pages dashboard: Deployments, roll back to the previous production deployment (instant); `git revert -m 1 <merge>` on main |
| 10 | Restore the Google key's website restrictions: localhost ports, `nks-travel.pages.dev/*`, `*.nks-travel.pages.dev/*`, the custom domain if Q44, `*.trycloudflare.com/*` | 7.2 | owner (Google Cloud console) | widen the restrictions again |
| 11 | Post-publish check: every page type on the live URL, the place map loads with the restricted key, the redirects resolve, and Lighthouse on production | 7.5 | verifier | as step 9 |
| 12 | Clean-up: remove the merged lane worktrees and the stale tunnels, **only after the owner confirms each deletion** | STATUS "Cleanup due" | coordinator, after Q49 | worktrees are recreatable from their branches |

What cannot be rolled back cleanly:
- **301s already cached by visitors' browsers.**
- **Search engine indexing of the new URLs.**
- **AI crawlers that read the site before the block.** They have read it; the block only stops future reads.

Everything else is a toggle or a redeploy.

## 7. Owner decisions needed before go-live

Only the owner can decide these. None blocks stage 4 or 5. Q42 is needed only if the wrangler login has expired at stage 6; the rest are answered at stage 6, together with the preview.

| ID | Decision | Recommendation | Trade-off |
|---|---|---|---|
| Q42 | Approve a `wrangler login --device` on his phone, if the Cloudflare login has expired, so the preview can be deployed (stage 6 step 2) | Yes, at stage 6 only if needed | Without it, the preview falls back to the tunnel, and Lighthouse on a real CDN (2.47) waits until go-live |
| Q43 | Approve the preview for go-live (stage 7 step 1) | Approve once his 6.2 rows are closed | n/a |
| Q44 | A custom domain on Cloudflare, so Bot Fight Mode, Block AI Bots and the rate-limit rule (7.6) can apply. They are zone settings, and `*.pages.dev` is not his zone | **Yes:** attach a domain he owns or buys (one domain registration a year) as the primary, and keep `nks-travel.pages.dev` working. One free rate-limit rule, about 100 requests per 10 s per IP on `/places/*` and `/trips/*`, with a 10 s block | Staying on `pages.dev` leaves only `robots.txt`, which polite bots obey and scrapers ignore. P8's edge layer would then be missing at launch |
| Q45 | Redirect status for the retired legacy pages: 302 for the first week, then 301; or 301 from day one (as 7.1 says) | **302 for 7 days, then 301** | A 301 is cached by browsers for good, so a rollback in week one would still send visitors to v2 pages. A 302 costs a week of slower SEO transfer, which hardly matters at under 100 users |
| Q46 | P8 says that at go-live, CSV, GPX and KML exports need sign-in. 7.6 says they stay public and per item until the planner adds sign-in. Confirm 7.6, and amend the P8 wording | **Confirm 7.6:** per item, public, with a source line, until sign-in exists | Requiring sign-in now would remove GPX from trail pages, which T2 (works in the field) needs |
| Q47 | The "fits" chip under a profile is `--ok` green (`#1D6B3A`). tokens.md documents it as "the only green in the system", but his rule is "no green" | **Keep it as the single status colour** (text plus a check, never a surface) unless he says otherwise. It is a one-token change either way | Any replacement must stay distinct from amber (`--warn`) and red (`--crit`), and navy reads as a link |
| Q48 | Turn off Google POIs in the Map ID style (7.3) | Yes: our pins are the only points of interest on our place maps (T5) | None |
| Q49 | Remove the merged lane worktrees and the stale preview tunnels (confirm-every-deletion rule) | Yes, after go-live, as one listed batch | Disk only; every worktree can be recreated from its branch |

## 8. Conflicts found

| ID | Conflict | Resolution |
|---|---|---|
| C1 | The `--ok` green fit chip (suitability-display D6, tokens.md "the only green") against the owner's "no green" (STATUS, product direction) | Owner decision Q47. Until then it stays, and REVIEW4 treats it as the documented exception, not a breach |
| C2 | P8 ("at go-live CSV, GPX and KML require sign-in") against 7.6 ("until then they stay per item and public") | Owner decision Q46; recommend 7.6 |
| C3 | Edge protection (7.6) assumes Cloudflare zone features, but the site is served on `*.pages.dev` | Owner decision Q44 |
| C4 | BACKLOG rows out of date: 2.50 says "doing (TS1)" but TS1 and TS1b merged (2febf88, 47fc40d); 3.33 is queued but patterns 1.2 and 3.4 already carry the keys and the Track removal; 3.1b, 3a.5 and 3a.10 are stale | Marked done in this commit |
| C5 | D2 edits the BACKLOG rows 3.25, 3.29, 3.39, 3.45, 3.47 and 3.53 | This commit leaves those six lines alone so the D2 merge stays clean. The coordinator adds "CS7d" to 3.47 and 3.53 at the D2 merge |
| C6 | 4.6 (an LST row) includes "dense admin labels on the dark map", but the fix is in `lib/map/maplibre/labels.ts`, which PLC owns | PLC does that one item; LST does the rest of 4.6 |
| C7 | The globe fix for 404 levels (4.5 S2) wants a `_redirects` rule, but `web/redirects.json` belongs to PLC (3.55 duplicate redirects) | GLB requests the rule in its hand-back. The coordinator appends `/globe/*  /globe/  200` as the **last** rule at the GLB merge, because Cloudflare uses the first match |
| C8 | 3.35 needs both data (three Rockies stop points) and schedule pins (Day 9 canoe, Day 15 flight, Day 6 time zone) | CS7d writes the stop points into `data/capture`; TRP writes the pins into `data/schedules`, from the Rockies research already in `research/trips/canadian-rockies-sept-2029/` |
| C9 | 3.57 and 3.54 are one fix (kind-aware lookup) under two rows, and 3.57 also holds place-page wording | TRP takes the lookup for both rows; PLC takes 3.57's wording and hero note |
| C10 | The stage 2 preview staging would publish the legacy pages that still carry household data (2.48) | The stage 6 preview removes the legacy routes from the staging (stage 6 step 1) |
| C11 | Review items missing from the stage 4 rows: the L3c polish list, L3b items 5-8 and round 2 item 5, S1b S5-S7 and S9-S13, L2b S7 and S9-S11 and N1, N3 and N4, SQ1b S6, and sweep items (mobile nav, home order at 390) | Added as rows 4.10-4.15 and given to lanes. Some may already be fixed by later rounds; each brief says to check first and report it as already done |

## 9. Change log

| Date | Change |
|---|---|
| 2026-10-19 | First version: six lanes and a spike, REVIEW4, stage 5 checks 5.1-5.6, stage 6 preview pass, stage 7 checklist, owner decisions Q42-Q49, conflicts C1-C11. |
