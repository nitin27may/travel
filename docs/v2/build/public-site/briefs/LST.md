# LST: lists, filters, search and list shards (stage 4)

- **Agent:** `travel-builder` (Sonnet).
- **Effort:** about 22 h, in four parts:
  - list shards, 8 h
  - filters and the phone bar, 6 h
  - search, 5 h
  - trips list and map, tests and shots, 3 h
- **Rows:**
  - 4.6 (L3b Opus review, stage 4, except the admin-labels item, which goes to PLC per C6)
  - 4.8 (SQ1b review, stage 4)
  - 4.11 (L3b review leftovers)
  - 4.14 (SQ1b S6)
  - 3.56 (lead cards with photos)
  - 3.59 (list shards)
  - 3.51 (the meaning of "short")
  - 2.41 (a Done button on filter pills; table and map views and the sitemap at 10,000)
  - 4.2 (the table "Sources" column clipping at 1440)
- **Plan:** [STAGE4-plan.md](../STAGE4-plan.md).
- **Specs:** [review-L3b.md](../../../design/review-L3b.md) ("Fix in stage 4", round 2 "Stage 4"), [smart-search/review-SQ1b.md](../../../design/smart-search/review-SQ1b.md) (M3 stage-4 part, S1-S6), [features/smart-search.md](../../../features/smart-search.md), principles P1, P4, P8 and P9.
- **Starts:** when D2 has merged. **Merges last** (fifth), after PLC's page set is final.
- **Opus review:**
  - **Before:** `travel-design-reviewer` writes one note, `docs/v2/design/lists-stage4-note.md`, ruling on four things:
    - the collapsed phone filter bar (one summary line, "11 places · 3 filters · Edit", that expands on tap);
    - a non-modal header search that replaces the modal Dialog with its scrim (SQ1b S5);
    - the single Kids control for Trips and Places;
    - the two-line count line.

    Start the shards (Part 1) at once. Build Part 2's four items after the note.
  - **After:** the full review.

## Goal

1. **The list stops inlining the whole catalogue (3.59, P8, P9).** Today `/places/index.html` carries every row (393 to 526 KB, about 1 KB a row; 10.9 MB at 10,000). Rows move to per-scope files loaded on demand through `lib/client/data.ts`. The page inlines only its first page and the counts it needs for the first view.
2. **Filters and search behave the same everywhere and explain themselves (4.6, 4.8, 4.11, 4.14).**
3. **The phone filter bar stops eating the screen (4.8, SQ1b M3).**

## Read first

- review-L3b.md and review-SQ1b.md, all of both.
- BACKLOG 4.6, 4.8, 4.11, 4.14, 3.56, 3.59, 3.51 and 2.41, word for word.
- `web/lib/client/data.ts`: `registerList`, `listPlaces`, `listTrips`, `countList`, `listPlacesChecked`, and how search loads parts progressively (`loadSearchRecords`); reuse that pattern.
- `web/app/places/page.tsx`, `web/app/trips/page.tsx`, `rows.ts`; `web/lib/public/index.ts` and `pages.ts`; `web/components/entity/EntityPage.tsx`, `FilterBar.tsx`, `PhoneFilterSheet.tsx`, `MoreFilters.tsx`, `AgeControl.tsx`, `AgePill.tsx`, `TableView.tsx`, `CardsView.tsx`; `web/components/search/*`; `web/lib/entities/*`.
- `web/tests/data/boundary.test.ts`, `light-data.test.ts` (the allowlist).
- `verify-integration.md` section 6 (the 10,000 fixture and how it was capped).

## Files you own

| Area | Paths |
|---|---|
| Data boundary | `web/lib/client/data.ts` (append a section `// list shards (3.59)`, and edit the list functions) |
| Adapter, lists part | `web/lib/public/index.ts`, `pages.ts`, `tags.ts`, `bands.ts`, `world.ts`, `taxonomy.ts`; an additive block `// LST (stage 4)` in `types.ts` |
| Entity machinery | `web/lib/entities/**`, `web/components/entity/**` |
| Search | `web/components/search/**`, `web/components/home/CoverSearch.tsx`, `web/lib/search/**`, `web/app/search/**`, `web/scripts/search-vocab.mjs`, `web/public/search/**` |
| List pages | `web/app/places/page.tsx`, `web/app/trips/page.tsx`, `rows.ts`, `layout.tsx`, `web/app/sitemap.ts` |
| List parts | `web/components/places/rows.ts`, `PlacesMap.tsx`, `PlaceCardFooter.tsx`, `cluster.ts`; `web/components/trips/TripsMap.tsx`, `TripCover.tsx`, `types.ts`, `tags/**`; `web/styles/trips.css` and the list styles; `data/vocab/tags.json` |
| Gate | one line in `tools/check-all.sh`, if the shards need a `--check` |
| Tests | `web/tests/data/boundary.test.ts`, `light-data.test.ts`; `web/tests/entities/**`, `web/tests/search/**`; `places.spec.ts`, `places-parity.spec.ts`, `smart-search.spec.ts`, and the list `describe` blocks of `trips.spec.ts` and `trips.test.ts` |

## Do not touch

- **PLC:** `components/places/**` other than the four files above, `lib/public/places.ts`, `seeds.ts`, `sections.ts`, `suitability.ts`.
- **PLC:** `lib/map/**` is additive only and listed. The admin-labels item of 4.6 is PLC's (C6).
- **TRP:** the trip page and `lib/public/trips.ts`.
- **GLB:** `components/globe/**`, `lib/globe/**`, `lib/public/globe.ts`.
- **SHL:** `components/ui/**`, by request. `SiteHeader.tsx` opens your search: keep the open event or prop it uses stable.

## Steps

### Part 1. List shards (3.59; build first)

1. **Shard files.** Write P8-light row files at build: `/list/places/<cc>.json` (one per country) and `/list/trips/index.json` (trips stay small). Rows hold the allowlist keys exactly; the test pins it. Add a small `/list/places/manifest.json` with the per-country row counts and the per-facet counts the first view needs.
2. **The page inlines** the first page of rows (48 cards) for the default order, plus the manifest. Nothing else.
3. **`listPlaces(query)` becomes async** and loads the shards the query scopes to: one country loads one file; an unscoped filter loads the shards progressively and shows "Counting…" until they are in, then the exact count. That is the shape a server answers (P9). Keep `countList` and `countParsed` honest: they return `null` (as `/` does today) until the needed shards are loaded, never a guess.
4. **URL state, pagination, Back and Forward** behave exactly as before. A deep link to `?page=7&k=lake` renders correctly after its shards load, with a skeleton in the meantime and no layout shift (CLS 0).
5. **The 10,000 fixture (2.41, P1).** Build it, capped as in verify-integration 6. Measure:
   - `/places/` HTML size;
   - first card;
   - filter-to-count;
   - the table view and the map view at 10,000;
   - the sitemap size.

   Add a sitemap index once the sitemap passes 5,000 URLs (`app/sitemap.ts`: split by kind).
6. **Lead cards with photos (3.56).** The default order is a quality tie-break, with photo before no photo inside the same relevance tier. The order rule is written in `lib/entities/sort.ts` with a test. It is not a catalogue trick: no place is hidden or moved out of its tier.

### Part 2. Filters

7. **One Kids control (4.6, L3b round 1 item 1),** per the Opus note: one label ("Youngest child"), one stepper; hide on a rule, fade on advice, on both Trips and Places. Where trips carry no rule or advice split yet, say so in the menu, never guess.
8. **The count line** is line 1, with notes on line 2 at most and a "why" disclosure for the rest. "50 not checked yet" is a link that shows them. The denominator is the scope (125 trails), not the catalogue.
9. **The Effort menu** gets a muted "27 not known yet, hidden when you pick one" row.
10. **More filters (4.11):**
    - the active value next to each header;
    - Multi-day present;
    - every coverage-hidden facet named in the count line.
11. **A Done button on desktop pill menus (2.41)**, as the phone sheet already has; it closes and keeps the choice.
12. **Phone bar (4.8, SQ1b M3 stage-4 part).** Under 640 px the sticky filter bar collapses on scroll to one summary line and expands on tap. Target: at most 20% of a 390 x 844 screen with three filters set (it is 34-37% today).
13. **Table (4.6, 4.2):**
    - a narrow "Fit" column or the stretch chip in the Name cell;
    - cells do not repeat their header ("Length 8.3 mi" becomes "8.3 mi");
    - the "Sources" column is not clipped at 1440.
14. **Cards and trips list (4.6, 4.11, L3b round 2):**
    - at 390 the Kids chip is not clipped and "Clear all" sits with the pills;
    - template trip cards use the icon fallback;
    - card footers separate their parts with " · ";
    - one length label set from `lengthClass` (card, table and subtitle agree);
    - tag chips carry a tag glyph, and "Public page" becomes a text link;
    - a trip "Highlight" is a place, never the region (in `tags.ts`).
15. **Trips map (4.6):** at 390 clusters draw above area rings, so the Switzerland ring no longer hides the "2".

### Part 3. Search (4.8, 4.14, 3.51)

16. **Never offer to drop the kind chip** while another chip can go (S1).
17. **Back restores the undo line:** keep `applied` in `history.state` (S2).
18. **"Did you mean"** in the list box's empty state, for typos (S3).
19. **One label source** for a chip and its pill (S4).
20. **The header search becomes non-modal**, per the Opus note (S5): no scrim, no `aria-modal`, page scroll kept, Esc and outside-click close it, focus returns to the button. The bottom-bar Search button from SHL opens the same component.
21. **The list empty state links the name hit** ("Niagara Falls" is an area; offer the area) (4.14).
22. **"short" (3.51).** Recommended:
    - on Places, "short" maps to the shortest walk band of the scoped kind, with a chip naming the band ("Short: under 5 km");
    - on Trips, it maps to the "Weekend or shorter" length classes;
    - with no kind scope on Places, it stays "short has no filter yet".

    Put the rule in `phrases.ts` with tests. **Phase 2 is out of scope here (SQ2s spike only).**

## Acceptance checks

| # | Check | Against |
|---|---|---|
| 1 | `/places/index.html` carries at most 48 rows and the manifest; no file in `web/out` holds every row (a test sums the row files and checks that no single file has them all) | 3.59, P8 |
| 2 | No component reads a list URL directly; the boundary test is green | P9 |
| 3 | At 10,000 on CPU x4: first card ≤ 600 ms, filter-to-count ≤ 500 ms, `/places/` HTML ≤ 100 KB gzip; the table and map views stay usable (measured) | P1 |
| 4 | A deep link with a filter and `?page=` renders the same rows as before the change (parity test over 20 URLs); CLS 0 | P9, P5 |
| 5 | The first 4 cards of the default places order have photos | 3.56 |
| 6 | The Trips and Places Kids controls read and behave the same (e2e on both) | 4.6, P4 |
| 7 | The count line is at most 2 lines at 390 with Kind and Kids set | 4.6 |
| 8 | The phone sticky bar is ≤ 20% of 390 x 844 with three filters, after scrolling | 4.8, T2 |
| 9 | The header search has no `aria-modal` and no scrim, and the page scrolls behind it | standing rule |
| 10 | "waterfall I can reach with a stroller" never offers "Without Waterfalls"; "Niagara Falls" in the Places box offers the area | 4.8, 4.14 |
| 11 | Every value the vocab can write still has a non-code label (the SQ1b M2 test) | P4 |
| 12 | Size: `/` and the lists stay within 1 KB of today's JS, the search chunk excepted | SQ1b size rule |
| 13 | axe clean on `/trips/` and `/places/` in all four views, light and dark, with a menu open | WCAG AA |
| 14 | `git diff --name-only` shows only owned paths | 2.1 |

## Verification

```
pnpm --dir web typecheck && pnpm --dir web lint && pnpm --dir web test
pnpm --dir web build && pnpm --dir web e2e
node web/scripts/search-vocab.mjs --check
bash tools/check-all.sh   (env file moved aside, then restored)
```

Screenshots at 1440 x 900 and 390 x 844, light and dark, 2x, into `web/test-results/shots/LST/`:
- `/places/` and `/trips/` in all four views;
- Kind scoped (six pills);
- Kids at 6;
- the phone bar collapsed and expanded;
- the header search open;
- the SQ1b queries 1, 2 and 29.

Read them in tiles. Then `travel-design-reviewer` (Opus), then `travel-verifier` on the Arc GPU.

## Commit rules

- **Worktree:** `/home/nitin27may/workspace/travel-wt/v2-LST`, branch `public/LST`, dev port 3455.
- **Commits:**
  1. `web(public/LST): list rows in per-country shards through data.ts (3.59)`
  2. `web(public/LST): photo-first tie-break, sitemap index, 10,000 measures (3.56, 2.41)`
  3. `web(public/LST): one Kids control, count line, More filters, Done, table (4.6, 4.11)`
  4. `web(public/LST): phone bar collapses, non-modal search, search fixes, short (4.8, 4.14, 3.51)`
- Stage owned paths with `git -C <worktree> add <paths>`, never `-A`. Co-Authored-By trailer from your harness.
- Rebase onto the latest v2 branch after PLC, TRP and CS7d batch B have merged, then take the final shots. Do not push.

## Hand-back

- the commits and the test counts;
- the 10,000 numbers (before and after);
- the shard sizes;
- any `lib/map` additions;
- any request sent to SHL or PLC.
