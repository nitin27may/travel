# Migration: from this repo to the v2 platform

Status: **draft** (17 Oct 2026). Planning only; nothing here has been run.

The v2 platform starts fresh (self-hosted Supabase, Next.js, operations as the only writer). This
repo holds two years of research and 13 built trip pages. Migration means: **every fact worth keeping
becomes a catalog entry with its source, every trip becomes a v2 trip (and most become curated
templates), and every published URL keeps working** until its replacement exists.

| Page | Contents |
|---|---|
| [inventory.md](inventory.md) | Everything in the repo that carries trip knowledge, with real counts |
| [import-plan.md](import-plan.md) | For each source: target, importer, field mappings, geocoding, verification, order |
| [legacy-site.md](legacy-site.md) | What happens to nks-travel.pages.dev, each page's future equivalent, redirects, retirement |

## Principles

1. **Import through the operations**, never by SQL into tables: importers call `research.propose`
   (catalog) and the trip operations (trips), so the imported data passes the same validation,
   dedupe and review as anything else, and every import is one changeset that can be rolled back.
2. **Sources come along.** Almost every legacy row carries `source_urls` and a `checked` date; they
   become `evidence` rows with `observed_on`. A legacy `status` (`VERIFIED`, `INFERENCE`, `GAP`) maps
   to `confidence` and `trust` (import-plan.md 2.2), so nothing that was a guess becomes a fact.
3. **Catalog first, trips second.** Trips can only point at published entities (or custom items), so
   the order is: geography → catalog entities and offers → accept → trips → templates.
4. **2026 data used as a pattern stays labelled as such.** Prices, hours and booking windows read in
   2026 for a 2028-2029 trip import with their 2026 read date; freshness rules mark them stale, and
   the backlog schedules a refresh before each trip.
5. **Nothing is deleted from git.** Research Markdown, scripts and legacy pages stay in the repo as
   history and evidence; the database becomes the source of truth for anything imported.
6. **Pilot with one trip.** The Canadian Rockies trip has structured JSON for everything; it is the
   M1/M2 pilot. Hand-written trips follow only when they are next revised.
