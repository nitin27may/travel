# L0: the foundation in code

Wave 1, parallel with LD and LM. Agent: `travel-builder` (Sonnet). Effort: about 7 hours.
Plan: [README.md](README.md). Must merge before any wave-2 lane starts.

## Goal

`web/` looks and behaves like the Trailhead foundation everywhere, before any page is redesigned: the tokens
from `docs/v2/design/foundation/tokens.json` as CSS variables (light default, dark), the three self-hosted OFL
fonts, the base components every lane needs, the public header and phone bottom bar, every public route in the
URL table as a stub, the contract stubs wave 2 fills, and a screenshot harness. The existing Trips and Places
pages keep working, re-skinned, with their tests passing.

## Read first

- `docs/v2/design/foundation/tokens.md` (all), `tokens.json`, `components.md` (shared rules, 1.1, 1.4, 1.5, 2.1 to
  2.10, 3.1, 3.2, 4.2, 4.5, 5.1 to 5.5, 6.1 to 6.3, 8.5), `patterns.md` 1.1, 1.2, 2, 5, 6, `specimen.html` (open it
  at 1440 light and dark; it is the visual reference), `changes-from-preview.md`.
- `web/app/layout.tsx`, `globals.css`, `app.css`, `themes.css`, `tools/theme_tokens.py`, `web/components/**`,
  `web/tests/no-hex.test.ts`, `web/tests/fonts.test.ts`.

## Files you own

`tools/theme_tokens.py`, `web/app/themes.css` (generated), `web/app/globals.css`, `web/app/app.css`,
`web/app/layout.tsx`, `web/app/not-found.tsx`, `web/app/sign-in/page.tsx`, `web/app/specimen/**`, `web/components/ui/**`,
`web/components/shell/**`, `web/components/entity/**` (restyle; keep behaviour), `web/components/actions/**`
(stubs, handed to L5), `web/components/search/GlobalSearch.tsx` (stub, handed to L1), route stubs
`web/app/trips/[slug]/page.tsx`, `web/app/places/[slug]/page.tsx`, `web/app/globe/page.tsx`,
`web/app/globe/[...path]/page.tsx`, `web/app/globe/place/[slug]/page.tsx`, `web/app/globe/trip/[slug]/page.tsx`
(handed to L3, L4, L2), `web/tests/foundation/**`, `web/tests/e2e/shots.ts`, `web/tests/e2e/foundation*.spec.ts`,
updates to `web/tests/no-hex.test.ts` and `web/tests/fonts.test.ts`.

## Do not touch

`web/lib/**` (LD, LM), `web/app/page.tsx` (L1 restyles it; you may only keep it compiling), `web/app/trips/page.tsx`
and `web/app/places/page.tsx` beyond what the restyle of `components/entity` needs, `web/redirects.json`,
`prototype/`, `legacy/`, `data/`, `core/`, `docs/`.

## Steps

1. **Tokens.** Rewrite `tools/theme_tokens.py` to read `docs/v2/design/foundation/tokens.json` and emit
   `web/app/themes.css`: `:root, [data-theme="light"]` and `[data-theme="dark"]` with every colour role (tokens 2,
   3), urgency (3.1), identity (4, with the keyline rule as a comment), map palette (5, as `--map-*` and
   `--globe-pin*`), type tokens (6) as `--t-*` shorthand variables plus `--font-display`, `--font-body`, `--font-mono`,
   space, radius, borders, elevation (7), focus (8), z (9), motion (11) and the reduced-motion overrides.
   Deterministic output; `--check` exits 1 on drift. Drop the green shell and the legacy theme blocks unless a
   `grep -r data-theme web/` shows a use (none expected). Colour stays only in `themes.css`; keep the no-hex test
   and point it at the new file.
2. **Theme.** Light is the default on public pages (tokens 1). `ThemeToggle` stores `theme` = `light` | `dark` in
   localStorage under the existing key; the init script sets `data-theme` before paint. Theme switch cross-fades
   surfaces 200 ms; images do not flash.
3. **Fonts.** The woff2 files are already in `web/public/fonts/` (Big Shoulders Display variable, Source Serif 4
   roman and italic, IBM Plex Mono 400/500/600, with OFL texts). Declare `@font-face` with `font-display: swap`,
   preload Big Shoulders and Source Serif roman, set the fallbacks from tokens 6. Body is serif 16. Update
   `fonts.test.ts` so it asserts these three families and no Google Fonts link.
4. **Base components** in `web/components/ui/`, each with every state in components.md shared rules (default,
   hover, focus-visible, pressed, selected, disabled, loading, error, empty), touch targets 44 px, reduced motion:
   - `Button` (primary, secondary, ghost, danger, icon; md, sm, lg) 2.1
   - `Input`, `SearchInput` with `/` and live count region 2.2, 2.10
   - `Select` 2.3, `Checkbox`, `Switch` 2.5, `Slider` 2.6
   - `FilterPill` with its menu (checkboxes, live counts, search over 8 options, Clear; active look; phone
     "Filters (n)" sheet) 2.7. Wire it into `components/entity/FilterBar` and `FacetMenu` so Trips and Places
     use it unchanged in behaviour
   - `Chip` with every kind in the 2.8 table, including the honesty chips (dashed `--crit`) and notice chips
   - `Segmented` 2.9 (sliding fill, radiogroup, icon-only on phone over three segments)
   - `Card` 3.1 (trip, public trip, place, trail variants; photo 16:10 with focus point; meta one truncating line;
     kind glyph when no photo; footer links as separate focus stops)
   - `ListRow` 3.2, `DataTable` shell 4.2 (restyle `components/entity/TableView`: sticky head and group rows,
     status dot, ring, check; tools row: Saved views, Columns, Density segment, Export CSV)
   - `Gallery` and `Lightbox` 4.5, `Credits` (photo credits footer: title · author · licence, linked)
   - `SideSheet` 5.1, `Popover` / `Menu` 5.2, `Toast` with Undo 5.3 (a `useToast()` provider in the layout),
     `Banner` 5.4, `BottomSheet` 5.5 (Motion drag, three snaps, Expand/Collapse buttons)
   - `EmptyState` 6.1, `Skeleton` 6.2, `ErrorState` 6.3, `Pager` 8.5 (48 cards / 100 rows, `?page=`)
   - `Breadcrumbs` 1.5, `KindGlyph` (the fifteen kinds plus area and scenic drive, ink on `--well`), `Icon`
     (every UI icon in the specimen), `DaySign` (DAY 03 quiet and focused), `SeasonStrip` (12 months, solid as
     written, hatched possible), `ReadinessBar` is planner-only: skip it.
   Add `motion` (pinned exact version, the same as the prototype's `14.0.0`) for sheets and the segment thumb.
5. **Shell.** `SiteHeader` public variant 1.1: brand TRIP PLANS (Big Shoulders 24), tabs Trips · Places · Globe with
   `aria-current`, search icon opening `GlobalSearch` (stub), theme toggle, **Sign in** ghost linking to `/sign-in`.
   60 px navy with the 2 px amber rule; phone 56 px with brand and right cluster. `BottomBar` on phone: Trips ·
   Places · Globe · Sign in (56 px items, 11.5 px labels). Footer: About the data (link to `/about/data/`), credits
   note, unit switch. `/sign-in` is a one-screen notice: "Sign-in comes with the planner. Everything here works
   without an account." with links to Trips, Places, Globe.
6. **Routes.** Stubs that build and render the page title and a Skeleton: `/trips/[slug]`, `/places/[slug]`,
   `/globe`, `/globe/[...path]`, `/globe/place/[slug]`, `/globe/trip/[slug]`. Each stub exports
   `generateStaticParams` returning `[]` for now and `dynamicParams = false`; the owning lane fills it from LD.
   404 (6.3): "Not here", search field, links to Trips, Places, Globe. Router: the Next App Router (file system);
   list state stays in the query string through the existing `useUrlState`; make it write keys in the patterns 1.2
   order (`q`, filters, `view`, `group`, `sort`, `dir`, `page`) and omit defaults, with a unit test.
7. **Contract stubs** (final props, placeholder render, `data-stub` attribute so the verifier can find leftovers):
   - `components/actions/CopySheet.tsx`: `{ trip: { slug, title, nights, days: number, window?: {from,to} }, open, onClose }`
   - `components/actions/ExportMenu.tsx`: `{ target: { type: 'trip' | 'place' | 'list', slug?: string, rows?: unknown[] }, formats: ('pdf'|'ics'|'gpx'|'kml'|'csv')[] }`
   - `components/actions/ShareButton.tsx`: `{ url: string, title: string }`
   - `components/search/GlobalSearch.tsx`: `{ open, onClose }`
8. **Screenshot harness** `web/tests/e2e/shots.ts`: `shoot(page, lane, name, { fullPage })` sets the theme in
   localStorage before load, captures 1440 x 900 and 390 x 844 at deviceScaleFactor 2 in light and dark, writes
   `web/test-results/shots/<lane>/<name>-<width>-<theme>.png`, and a `tiles()` helper that cuts tall pages into
   1600 px tiles. Add `foundation.shots.spec.ts` that shoots a `/specimen` page (`web/app/specimen/page.tsx`; Next treats `_folders` as private, so
   no underscore), `noindex`, left out of the sitemap and of every nav) showing every component in every state.
9. **Map view slot.** `EntityPage` takes the Map view from the descriptor: add `renderMap?: (rows, state) => ReactNode`
   to the entity descriptor type and enable the Map segment when it is set (drop `MAP_DISABLED_NOTE` for those
   entities). L3 and L4 supply it from their own descriptor files, so they never edit `components/entity/`.
10. **Keep the live pages working.** `/trips/` and `/places/` keep every feature in keep-from-live-site.md with the
   new look. Update `places-parity.spec.ts` selectors only if the restyle renamed them; the assertions stay.

## Acceptance checks

| # | Check | Against |
|---|---|---|
| 1 | `themes.css` is generated from tokens.json; `--check` passes; no hex outside it | tokens.md, no-hex test |
| 2 | Light by default; dark by toggle; no flash on load | tokens 1 |
| 3 | Only Big Shoulders at the nine display sizes plus the phone variants; minimum text 11.5 px; inputs 16 px | tokens 6 |
| 4 | Amber only on primary buttons, selected segments, active filters and focus-now; nothing amber at rest elsewhere | changes-from-preview 1, 23 |
| 5 | Every component in `/specimen` matches specimen.html side by side at 1440 light and dark (the verifier compares tiles) | specimen.html |
| 6 | Focus ring 2 px with 2 px offset on every interactive element; never lost to body; sheets trap and return focus | tokens 8, components shared rules |
| 7 | Reduced motion: every move is a 120 ms fade, sheets included | tokens 11 |
| 8 | Header public variant: three tabs, search, theme, Sign in; phone bottom bar with four items | components 1.1, 1.4, patterns 1.1 |
| 9 | Every public URL in patterns 1.2 resolves to a page or a stub; unknown paths render the 404 | patterns 1.2 |
| 10 | `/trips/` and `/places/` keep cards, list, table, map, pills, group, sort, saved views, columns, density, CSV, URL state, honesty markers | keep-from-live-site.md |
| 11 | No horizontal scroll at 390; card grid 4/3/2/1 | tokens 10 |
| 12 | axe: no serious or critical violations on `/`, `/trips/`, `/places/`, `/specimen` | WCAG AA, tokens 2.2 |

## Verification

```
pnpm install
python3 tools/theme_tokens.py --check
pnpm --dir web typecheck && pnpm --dir web lint && pnpm --dir web test
pnpm --dir web build
pnpm --dir web e2e            # includes foundation.shots.spec.ts
```

Screenshots: `/specimen`, `/trips/`, `/places/`, `/404-test`, `/sign-in/` at 1440 and 390, light and dark, from the
harness. Read the specimen tiles against `specimen.html` before hand-back.

## Commit rules

Worktree `../v2-L0`, branch `public/L0`, dev port 3400. Logical commits (tokens and fonts; components; shell and
routes; stubs and harness), each `git -C /home/nitin27may/workspace/travel-wt/v2-L0 add <owned paths>`, never `-A`.
Message `web(public/L0): ...` ending with your Co-Authored-By trailer. Rebase onto the v2 branch, do not push. In the
hand-back, list each stub's props exactly as committed.
