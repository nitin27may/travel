# SRV: the schema diff (SRV-D, phase A, read-only) and API-over-Postgres (SRV-0, after E; proposed `PostgresStore` on Neon)

> **Provider superseded by owner:** use Neon Postgres, Managed Better Auth and Realtime, not Supabase. See [NEON-SETUP.md](../NEON-SETUP.md), PLAN R-58 and BACKLOG 15.47. The owner explicitly authorized provisioning and schema migration in the existing Neon project. Revised 24 Oct (R-60): the SRV-0 steps below now target Neon Postgres through the repository's versioned migrations (`core/src/db/migrations/`, `core/bin/db-migrate.ts`) and a proposed `PostgresStore`; the earlier Supabase CLI, local Docker, generated-types and `config.toml` instructions are historical and no longer apply. The source/serving decisions, privacy rules and CatalogueStore parity gate still apply. Status: 86 private-content application tables and the migration ledger have RLS; the sole non-RLS relation is the content-free, coordinator-approved `plan_draft_signal`. The private account integration is independently verified on the uncommitted session branch (PLAN R-58); the catalogue loader, `PostgresStore`, per-method parity and cutover are **not implemented**, and `JsonStore` still serves.

> **Revised 23 Oct (phase E start sheet).** SRV-D is done (`research/reports/schema-diff-2026-10.md`, owner decisions Q73 to Q76). SRV-0 stays after the E features merge and off the R2 critical path; [PHASE-E-START.md](../PHASE-E-START.md) does not schedule it inside the phase E usage window. Changes in this brief: the contract SRV-0 implements now includes the phase E methods and cases from API-3 (`tripLegs`, `listUnchecked`, `searchCards`, `countPlaces` with `parsed`, the `json` export format, the town guard; cases K20 to K28) and the opaque `place/<slug>` refs from REF1; the revision is computed from inputs (D-E4), which a loader reproduces by hashing the files it loads; preconditions added: BACKLOG 15.27 (the engine parity corpus K28, done in lane HYG) and GB-A-11 (validate each detail against its output schema at load, because SRV-0 loads data at runtime) and API1a-R-13 (the core runner's home-point check reads the point from `core/src/privacy/home.ts` through the shared detector, never from a committed copy). Worktree `/Users/nks/workspace/travel-wt/v2-SRV0`, branch `public/SRV0`. (The 23 Oct Supabase house rules are superseded by the 24 Oct Neon rules in the Principles line.)

- **Agent:** SRV-D `travel-planner` (Opus); SRV-0 `travel-builder` (Sonnet).
- **Effort:** SRV-D 3 h; SRV-0 24 h.
- **Rows:** 14.1 (SRV-D), 14.5 (SRV-0); laundry list items 2, 10 to 17.
- **Plan:** [EXECUTION-PLAN.md](../EXECUTION-PLAN.md) 4.8 and 14.2 (the switch-over runbook). Interface: 4.2.
- **Principles:** P9; the database house rules (RLS first, additive versioned migrations in `core/src/db/migrations/` tested on an isolated Neon child branch before the production branch, no drops or destructive resets, secrets only in ignored env files, confirm with the owner before any write to the production branch).
- **Starts:** SRV-D day 1. SRV-0 after the E features merge, beside stage 5 and R2, with every flag off; it must not block R2.

## Goal

Know on day 1 whether the JSON we keep writing loads into `docs/v2/schema.sql` without reshaping, and later prove that a proposed `PostgresStore` answers every `CatalogueStore` contract case exactly as `JsonStore` does, on an isolated Neon child branch.

## Read first

- `docs/v2/schema.sql` (467 lines, 63 tables), `docs/v2/04-stack.md`, `docs/v2/08-self-hosted.md`, `docs/v2/build/SERVER-SIDE-LAUNDRY-LIST.md`.
- `research/method/capture-contract.md`, `data/vocab/types.json` (398 nodes, layers and marks), `core/src/schema/capture/properties.ts` (83 properties), the sidecars (`data/capture/points.json`, `data/suitability/**`, `data/relevance/**`, `data/sources/registry.json`), `data/locations/locations.json` (schema v2/v3 tables).
- For SRV-0: EXECUTION-PLAN 4.2 and 4.6, `core/src/catalogue/**` and the contract kit (API-1).

## Files you own

| Sub-lane | Paths |
|---|---|
| SRV-D | `research/reports/schema-diff-2026-10.md` (new) |
| SRV-0 | new migrations in `core/src/db/migrations/` (only if the catalogue tables need changes), `core/src/catalogue/postgres/**` (new), `core/bin/load-catalogue.ts` (new), `core/test/catalogue/postgres.test.ts` (new) |

## Do not touch

SRV-D: everything except its one file. SRV-0: everything outside its paths, the account/draft tables and the Neon Auth and Realtime configuration. Load and test only on an isolated Neon child branch; nothing is loaded into or switched on the production branch without the owner's confirmation.

## Steps

### SRV-D (read-only)

1. For each capture layer (place, route, offer, event), property group, relation, link (kind, state, date, source), photo (licence, credit), point (role, approx, source), suitability flat and its provenance, relevance, source registry row, town and the locations tables: the target table and column in `schema.sql`, or "missing".
2. For each missing or mismatched item: a proposed change (new column, new table, a JSON column, or a change on the JSON side) with the reason, and whether it affects API-1's Zod contracts.
3. Ids and versions: confirm `ref` and `slug` are stable keys in the schema; list any place where the schema expects a surrogate id only.
4. A risk list ranked by cost for SRV-0, and one paragraph for API-1 ("contracts to adjust before handlers are written").

### SRV-0 (later, Neon child branch)

5. Start from the applied migrations (`node core/bin/db-migrate.ts status`); any catalogue change is a new additive migration from the SRV-D proposals, applied to a child branch first. RLS stays enabled on every private-content and new catalogue table before any loader or store code; public read policies for the catalogue tables only; household tables (people, ages, bookings) keep RLS and no public policy, and nothing is loaded into them. `plan_draft_signal` remains the sole content-free, coordinator-approved non-RLS exception and is not part of catalogue serving.
6. `core/bin/load-catalogue.ts`: loads `data/**` into the child-branch database unchanged (stable `ref` and `slug`, file schema versions, per-value provenance); idempotent; `--check` compares row counts against the JSON.
7. Row types come from the existing Zod contracts in `core/src/schema/api/`; validate each loaded detail against its output schema (GB-A-11).
8. `PostgresStore` implements `CatalogueStore` with the same caps; `near` uses PostGIS (`ST_DWithin`) with the same clamp.
9. Run the contract kit against `PostgresStore` (the test is skipped with a clear message unless `TEST_DATABASE_URL` points at a disposable child branch, and it is run and reported in the hand-back; a skip is not a pass).

## Acceptance checks

| # | Check |
|---|---|
| 1 | SRV-D: every layer, property group, sidecar and locations table is mapped or listed as a gap with a proposal |
| 2 | SRV-0: RLS on every private-content and catalogue table (a query over `pg_tables` and `pg_policies` in the test); preserve the one approved non-RLS signal exception |
| 3 | SRV-0: the loader's `--check` matches the JSON row counts |
| 4 | SRV-0: the contract kit passes on `PostgresStore` with the same results as `JsonStore` (case by case, per method) |
| 5 | No write to the production branch without the owner's confirmation; no key or connection string in any file; public responses pass the privacy scrub |
| 6 | Rollback: every switched method returns to `JsonStore` by its flag alone, and `JsonStore` stays deployable for one release |

## Server switch

SRV-0 is the server version of the catalogue read path. The flip is `CATALOGUE_STORE=postgres` per method (proposed flag value), in the order of the runbook (EXECUTION-PLAN 14.2); the handlers, adapters, components, URLs and tests do not change.

## Verification

SRV-D: a verifier spot-checks 20 mappings against the files. SRV-0: `pnpm --dir core test`, the contract kit against a Neon child branch (`TEST_DATABASE_URL`), `bash tools/check-all.sh` (which must pass with no database configured).

## Commit rules

Worktree `/Users/nks/workspace/travel-wt/v2-SRV0` (branch `public/SRV0`, from `main`: `git -C /Users/nks/workspace/travel worktree add /Users/nks/workspace/travel-wt/v2-SRV0 -b public/SRV0 main`, then `pnpm install --frozen-lockfile` at the worktree root). SRV-D is done. Commits: `docs(v2): schema diff against the capture contract (SRV-D)`, `core(SRV): ...`. Owned paths only with `git -C <worktree> add <paths>`, never `-A`; Co-Authored-By trailer; do not push.

## Hand-back

SRV-D: the diff file and the API-1 paragraph. SRV-0: migrations list, RLS check output, loader counts, contract results per method, the gaps left for the laundry list.
