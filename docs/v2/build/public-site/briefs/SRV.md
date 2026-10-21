# SRV: the schema diff (SRV-D, phase A, read-only) and API-over-Supabase (SRV-0, after E, local only)

- **Agent:** SRV-D `travel-planner` (Opus); SRV-0 `travel-builder` (Sonnet).
- **Effort:** SRV-D 3 h; SRV-0 24 h.
- **Rows:** 14.1 (SRV-D), 14.5 (SRV-0); laundry list items 2, 10 to 17.
- **Plan:** [EXECUTION-PLAN.md](../EXECUTION-PLAN.md) 4.8 and 14.2 (the switch-over runbook). Interface: 4.2.
- **Principles:** P9; the house rules for Supabase (RLS first, migrations through `supabase migration new`, local first, regenerate types after every schema change, confirm before anything remote).
- **Starts:** SRV-D day 1. SRV-0 after the E features merge, beside stage 5 and R2, with every flag off; it must not block R2.

## Goal

Know on day 1 whether the JSON we keep writing loads into `docs/v2/schema.sql` without reshaping, and later prove that a `SupabaseStore` answers every `CatalogueStore` contract case exactly as `JsonStore` does, all on a local Supabase.

## Read first

- `docs/v2/schema.sql` (467 lines, 63 tables), `docs/v2/04-stack.md`, `docs/v2/08-self-hosted.md`, `docs/v2/build/SERVER-SIDE-LAUNDRY-LIST.md`.
- `docs/v2/research/capture-contract.md`, `data/vocab/types.json` (398 nodes, layers and marks), `core/src/schema/capture/properties.ts` (83 properties), the sidecars (`data/capture/points.json`, `data/suitability/**`, `data/relevance/**`, `data/sources/registry.json`), `data/locations/locations.json` (schema v2/v3 tables).
- For SRV-0: EXECUTION-PLAN 4.2 and 4.6, `core/src/catalogue/**` and the contract kit (API-1).

## Files you own

| Sub-lane | Paths |
|---|---|
| SRV-D | `docs/v2/research/schema-diff-2026-10.md` (new) |
| SRV-0 | `supabase/**` (new: `config.toml`, `migrations/**`, `seed` scripts if any), `core/src/catalogue/supabase/**` (new), `core/bin/load-catalogue.ts` (new), `core/test/catalogue/supabase.test.ts` (new), the types file that `supabase gen types typescript` writes (path chosen in step 7, never hand-edited) |

## Do not touch

SRV-D: everything except its one file. SRV-0: everything outside its paths, and any remote project. No `supabase link`, no `db push`, no command against a hosted database: those wait for Q65 and the owner's confirmation.

## Steps

### SRV-D (read-only)

1. For each capture layer (place, route, offer, event), property group, relation, link (kind, state, date, source), photo (licence, credit), point (role, approx, source), suitability flat and its provenance, relevance, source registry row, town and the locations tables: the target table and column in `schema.sql`, or "missing".
2. For each missing or mismatched item: a proposed change (new column, new table, a JSON column, or a change on the JSON side) with the reason, and whether it affects API-1's Zod contracts.
3. Ids and versions: confirm `ref` and `slug` are stable keys in the schema; list any place where the schema expects a surrogate id only.
4. A risk list ranked by cost for SRV-0, and one paragraph for API-1 ("contracts to adjust before handlers are written").

### SRV-0 (later, local)

5. `supabase init`, `supabase start` (Docker). Migrations with `supabase migration new` from the SRV-D proposals; RLS enabled on every table before any loader or store code; public read policies for the catalogue tables only; household tables (people, ages, bookings) created with RLS and no public policy, and nothing loaded into them.
6. `core/bin/load-catalogue.ts`: loads `data/**` into the local database unchanged (stable `ref` and `slug`, file schema versions, per-value provenance); idempotent; `--check` compares row counts against the JSON.
7. `supabase gen types typescript` into the chosen path; fix any type errors in the same change.
8. `SupabaseStore` implements `CatalogueStore` with the same caps; `near` uses PostGIS (`ST_DWithin`) with the same clamp.
9. Run the contract kit against `SupabaseStore` (the test is skipped with a clear message unless a local Supabase is up, and it is run and reported in the hand-back).

## Acceptance checks

| # | Check |
|---|---|
| 1 | SRV-D: every layer, property group, sidecar and locations table is mapped or listed as a gap with a proposal |
| 2 | SRV-0: RLS on every table (a query over `pg_tables` and `pg_policies` in the test) |
| 3 | SRV-0: the loader's `--check` matches the JSON row counts |
| 4 | SRV-0: the contract kit passes on `SupabaseStore` with the same results as `JsonStore` (case by case) |
| 5 | No remote command was run; no key or connection string in any file |

## Server switch

SRV-0 is the server version of the catalogue read path. The flip is `CATALOGUE_STORE=supabase` per method, in the order of the runbook (EXECUTION-PLAN 14.2); the handlers, adapters, components, URLs and tests do not change.

## Verification

SRV-D: a verifier spot-checks 20 mappings against the files. SRV-0: `pnpm --dir core test`, the contract kit against a local Supabase, `bash tools/check-all.sh` (which must pass with no Supabase running).

## Commit rules

Worktree `/home/nitin27may/workspace/travel-wt/v2-SRV` (branches `public/SRVD`, `public/SRV0`, from `main`). Commits: `docs(v2): schema diff against the capture contract (SRV-D)`, `core(SRV): ...`, `supabase(SRV): ...`. Owned paths only with `git -C <worktree> add <paths>`, never `-A`; Co-Authored-By trailer; do not push.

## Hand-back

SRV-D: the diff file and the API-1 paragraph. SRV-0: migrations list, RLS check output, loader counts, contract results per method, the gaps left for the laundry list.
