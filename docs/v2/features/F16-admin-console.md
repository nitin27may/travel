# F16. Admin console

> **Amended 25 Oct 2026:** photo update (pin, choose the thumbnail, reorder, hide, "no suitable photo", with an override
> research never replaces and an audit trail) is specified in
> [trip-overview-and-customisation.md](trip-overview-and-customisation.md) section 6. Until the catalogue cutover and the
> F17 roles exist, the owner uses a local pin command (PHO-0); the console screen is PHO-1 (BACKLOG 15.55).

> **Amended 25 Oct 2026 (visitor suggestions):** visitor place suggestions, trip requests and (later) stored reports
> land in one private table, `visitor_submission`, with the states new, duplicate, rejected, spam, researching and
> added ([visitor-suggestions-and-favourites.md](visitor-suggestions-and-favourites.md) sections 5, 9). Until the
> console and F17 roles exist the owner moderates with a local CLI (`core/bin/intake.ts`, INT-3); the console tab is
> INT-5 (BACKLOG 15.75). This is the "user requests" input of the backlog (item 10) and part of moderation (item 13).

> **Amended 25 Oct 2026 (feedback and reports):** reports (on places, trails, trips, days, stops, stay bases, photos,
> offers) and site feedback join the same table natively, with the extra states `unconfirmed`, `fixed` and `no_change`,
> clusters per target, a takedown lane listed first, and confirmed-only items in the default queue
> ([feedback-and-reports.md](feedback-and-reports.md) sections 2.3, 7; PLAN R-90 to R-96). The console tab (INT-5)
> shows all of them. Item 13's "corrections from non-admin users" arrive this way until changesets exist.

## Purpose

The owner's workshop for growing the catalog and publishing curated trips: review what research
proposes, run and track research jobs (from Claude Code, a chat client via MCP, or import scripts),
see coverage and the backlog per destination, publish sample trips and templates, and moderate user
contributions.

## User stories

1. As the owner, I want every changeset from a research run in one queue with diffs and sources, so that I accept good facts quickly and reject bad ones.
2. As the owner, I want to start "research Banff trails and parking" and see it progress and what it cost, so that I control effort and spend.
3. As the owner, I want a coverage map (thin, usable, good per kind and area), so that I know where to research next.
4. As the owner, I want to assemble a sample trip from the catalog and publish it as a curated template.
5. As the owner, I want to moderate user photos and corrections.
6. As the owner, I want bulk import from the existing repo data, reviewed like any other research.

## Detailed behaviour

### Review queue

1. Lists open changesets grouped by job and area, newest first, with counts (creates, updates, conflicts) and the author/client (`mcp:claude`, `claude-code:research-skill`, `import:locations`, a user).
2. Changeset view: each change as a diff (old → new) per field, with its evidence (source URL, publisher, read date, quote, confidence), the trust it would get, and conflicts with existing evidence.
3. Actions per change: accept, edit then accept, reject (with a note), merge with an existing entity (duplicate detection by name similarity, distance under 300 m, same Wikidata/OSM id). Bulk: accept all low-risk changes (new entities with an official source; media with a free licence).
4. Accepting writes the entity fields, evidence rows, relations and media, bumps versions, recomputes `fresh_until`, coverage and search indexes; all as one operation with an inverse (roll back a bad import).
5. Live updates on the queue (admin-only screen). Not built; the transport must be designed on Neon (the only live path today is the content-free account-draft signal, which does not cover this), and the earlier Realtime Postgres Changes design is historical.

### Research jobs

6. Create a job: scope (new area by name or Wikidata id, existing area, entity, or "stale fields in area"), lanes (from the research lane list), runner (my chat client via MCP, Claude Code skill, import script, server agent later), budget (tokens or dollars for server runs), notes.
7. A job opens a changeset; runners call `research_brief`, `propose`, `submit_job` (03 and mcp/ pages). The job page shows status, changes proposed so far, gaps reported ("no parking data found for X"), sources used, and cost.
8. Templates of jobs ("onboard a national park": geography import → candidates import → trails, parking, adventure, stays, timing, media lanes).

### Coverage and backlog

9. Coverage map: areas coloured by score per kind (trails, activities, stays, eateries, places, media, freshness), click → area detail with counts, gaps and stale fields.
10. Backlog: ranked items (priority = trips using × urgency × severity), from staleness, conflicts, user requests ("research this"), corrections, and gaps reported by jobs; "Research this" creates a job.

### Curated trips and templates

11. Owner can create trips as drafts for templates (from scratch, from the catalog, or from an MCP research session: "build a 10-night family Dolomites sample"), mark them curated, set template metadata (F12), preview, publish, version.
12. Template list with forks count, last update, versions, and "pending updates to publish".

### Moderation

13. User media (photos from F14) and corrections from non-admin users land in a moderation tab: approve, hide, reject with reason. Photos checked for faces of minors (manual check in v1) and location data stripped.

### Users and roles

14. User list (from Managed Better Auth users joined to `app_user`): roles (user, researcher, moderator, admin), last sign-in, MCP clients authorised, revoke sessions and tokens. Not built: no admin user, role or session management exists yet (R-60, Oct 2026). Deeper database work uses the Neon console, not an in-app tool.

### Operations health

15. Panels: reminder worker status (last run, failures), email and push delivery failures, routing quota used, backup last success and last restore test, link-checker results, object storage use (provider not selected).

## Data touched

`changeset`, `change`, `evidence`, `source`, `entity`, `offer`, `relation`, `media`, `area`, `coverage`, `backlog`, `research_job`, `trip` (templates), `template_version`, `app_user` roles, `op_event`.

### Schema additions

- `research_job.template text` (job recipe id) and `research_job.gaps jsonb` (what wasn't found).
- `change.duplicate_of text` (proposed merge target).
- `ops_health (key text primary key, value jsonb, updated_at)` written by the worker and backup containers.

## Operations and MCP tools

Operations: `changeset.list`, `changeset.get`, `change.decide` (accept, edit, reject, merge), `changeset.bulk_accept`, `changeset.rollback`, `job.create`, `job.update`, `job.close`, `backlog.add`, `backlog.update`, `coverage.recompute`, `template.publish`, `media.moderate`, `user.set_role`, `user.revoke`.

MCP (scope `review` for review, `research:propose` for jobs): `review_queue`, `decide`, `start_job`, `research_brief`, `propose`, `submit_job`, `list_backlog`. Owner-only `publish_template`.

## Edge cases

- Two jobs proposing changes to the same field: the later one is shown as a conflict against the first's pending value.
- An accepted change that breaks validation of the entity's kind schema: rejected at accept time with the validator's message.
- Rolling back an import after users added those entities to trips: rollback retires entities instead of deleting; trips keep working with a "retired" note.
- Server-run research exceeding budget: stops at the hard limit, submits what it has with gaps.

## Acceptance criteria

1. A changeset of 50 creates with official sources can be bulk-accepted in one action and rolled back in one action.
2. Duplicate detection flags an entity within 300 m with a similar name or the same Wikidata id.
3. Accepting a change updates search results and coverage within 1 minute.
4. A job created for "Banff, lanes: trails, parking" shows proposals from an MCP session in real time.
5. Non-admin users cannot reach `/admin` or call review operations (RLS and op auth tests).

## Milestone

M1 (review queue, changesets, imports, jobs via MCP), M5 (templates publishing UI, moderation), M6 (coverage map, backlog ranking, ops health).

## Open questions

1. Will anyone besides the owner review in year one? Default: no; roles exist for later.
2. Auto-accept rules for the owner's own Claude Code research? Default: no auto-accept for facts; media with free licences only.
