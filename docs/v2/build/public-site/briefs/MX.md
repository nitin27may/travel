# MX: the ORS nearby matrix and the hub matrix (phase E)

> **Revised 23 Oct (phase E start sheet).** [PHASE-E-START.md](../PHASE-E-START.md) runs MX in seat B on Sat 31 Oct to Sun 1 Nov, after PLC2b and LST2c. Changes in this brief: the task is EXECUTION-PLAN **E13** (not E14); after TRP2b, `web/scripts/legs-ors.mjs` is the general trip-legs fetcher (any trip with a schedule, `trip-legs/2` with geometry), so reuse its request pacing and key handling, and do not edit it (collision E15); `core/src/nearby/` is PLC2b's module, and you add only the routed-value read; distances and bands come from `core/src/geo/` and `core/src/config/nearby.ts` (read only, E8); `basis` already exists on near and nearby outputs (API-1a), and API-3 adds a nullable `minutes` beside it, so MX needs no contract change; if it does, that is an API-3 follow-up. Acceptance 4's `web/out` no longer exists: check the served build (`.next/static`, `.next/server/app`, through `web/tests/helpers/built.ts`) for the first 8 characters of the ORS key, counted, never printed. ORS is one runner: never at the same time as a TRP2b legs run. Worktree `/Users/nks/workspace/travel-wt/v2-MX`, branch `public/MX`, port 3485. Python tests through the venv; GPU flag on macOS `--use-angle=metal`.

- **Agent:** `travel-builder` (Sonnet).
- **Effort:** about 5 h.
- **Rows:** 8.13 (nearby matrix, phase N3), 3.12 (hub matrix, pulled in from phase F), Q19 (public hubs), Q57 (bands until routed).
- **Plan:** [EXECUTION-PLAN.md](../EXECUTION-PLAN.md) task E13 (corrected 23 Oct; was "E14").
- **Specs:** [nearby-and-regions.md](../../../features/nearby-and-regions.md) 5.1 and N3; [short-trips.md](../../../features/short-trips.md) 4.1 (the hub matrix); `web/scripts/legs-ors.mjs` (the existing pattern).
- **Principles:** P8 (the matrix is a build input, never shipped whole), T5.
- **Starts:** after PLC2b (`core/src/nearby/`) and LST2c merge.
- **Review:** travel-verifier.

## Goal

Where a base or hub and a place within 100 km have a routed drive time, Nearby and near mode show "about 25 min" instead of a band, and trips show "From Toronto" with a routed time.

## Read first

- `web/scripts/legs-ors.mjs` (sequential, at most 28 requests a minute, `--check`, never prints a key).
- `web/lib/public/world.ts` `fromHubsOf` (reads `data/outings/from-hubs.json`, absent today), `core/src/nearby/` (PLC2b), `core/src/config/nearby.ts`.
- `data/relevance/inputs/points.json` `towns` (33 bases) and the hub list in short-trips.md and Q19.

## Files you own

`web/scripts/nearby-ors.mjs` (new), `data/outings/**` (new: `nearby-ors.json`, `from-hubs.json`), the routed-value read in `core/src/nearby/` and `core/src/catalogue/json/nearby.ts` (after PLC2b merges), `web/tests/data/nearby-ors.test.ts` (new), one `--check` line in `tools/check-all.sh`.

## Do not touch

Everything else. `ORS_API_KEY` is read from the environment only, never printed, never written to a file, never in `web/out`.

## Steps

1. Pairs: every trip base and public hub (Toronto, Hamilton, Ottawa, Montréal, Calgary, Salt Lake City or Las Vegas, Burlington VT, Venice, Bolzano, Geneva, Reykjavik, per Q19) against every place with a non-approximate point within `DAY_TRIP_KM`. Report the cell count (estimate about 1,800 nearby plus the hub-to-trip pairs).
2. ORS matrix calls, sequential, inside the free-tier limits; store `{from, to, minutes, km, basis: 'routed', fetched}`; only missing pairs are fetched; `--check` exits 1 on a missing pair.
3. Write `from-hubs.json` in the shape `fromHubsOf` reads.
4. `core/src/nearby/` uses a routed value where the pair exists, else the band; `near()` and `nearbyForPlace()` return `basis: 'routed'` or `'estimate'`.

## Acceptance checks

| # | Check |
|---|---|
| 1 | `node web/scripts/nearby-ors.mjs --check` passes; a deleted pair makes it fail |
| 2 | Moraine Lake's Around here shows "about N min" for pairs from the Lake Louise base |
| 3 | A trip card shows "From Toronto" with a routed time where one exists |
| 4 | The first 8 characters of the ORS key are absent from the served build (`.next/static`, `.next/server/app`) and every API response in the contract kit (checked locally, counted, never printed) |
| 5 | `git diff --name-only` shows only owned paths |

## Server switch

The matrix is a build-time input; values go into pages and rows. On the server, routing goes through `leg_cache` and ORS (laundry list item 34), returning the same `{minutes, km, basis}` shape `nearby.ts` already reads, behind `capabilities.serverRouting`.

## Verification

`pnpm --dir web typecheck && pnpm --dir web test`, the script's `--check`, `bash tools/check-all.sh` with `web/.env.local` moved aside (the check reads committed data only) and restored. Screenshots of Moraine Lake's Around here and one trip card at 1440 and 390, light and dark, into `web/test-results/shots/MX/`.

## Commit rules

Worktree `/Users/nks/workspace/travel-wt/v2-MX`, branch `public/MX` from `main` (`git -C /Users/nks/workspace/travel worktree add /Users/nks/workspace/travel-wt/v2-MX -b public/MX main`, then `pnpm install --frozen-lockfile` at the worktree root), port 3485. Commits: `web(public/MX): ORS nearby and hub matrices (8.13, 3.12)`, `data(MX): matrices`. Owned paths only with `git -C <worktree> add <paths>`, never `-A`; Co-Authored-By trailer; rebase; do not push.

## Hand-back

Commits, the pair and call counts, the share of nearby rows now routed, any pair ORS could not route.
