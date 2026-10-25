# F17. Accounts, auth and privacy

## Purpose

Know who is planning, keep each household's and trip's data private, let chat clients act for a
user safely, and let anyone take their data out or delete it. Built on Managed Better Auth (Neon)
with Neon Postgres row-level security, plus the operation layer's own checks.

> **Amended 25 Oct 2026 (favourites and suggestions):** two planned private tables join this page's export and delete
> rules: `account_favourite` (owner-predicate RLS, like `planner_draft`) and the submitter's rows of
> `visitor_submission` (read through a security-invoker view). Sign-out deletes the browser's account cache of
> favourites. Spec: [visitor-suggestions-and-favourites.md](visitor-suggestions-and-favourites.md) sections 4.4, 8, 11;
> PLAN R-70 to R-75. Q103 there asks whether sign-up may open for these light features while the planner stays
> invite-only (question 2 below).

> **Amended 25 Oct 2026 (Google and Apple sign-in):** Google sign-in and sign-up are specified in
> [google-and-apple-sign-in.md](google-and-apple-sign-in.md) (PLAN R-81 to R-85). It supersedes the edge case below on
> linking by email: Google links to an existing account only when that account's email is verified; an unverified
> email/password account is never linked implicitly (CVE-2026-53516). Apple is deferred (Neon Managed Auth does not offer
> it; Q117). Magic link and passkeys stay here.

**Status (R-60, Oct 2026).** Built: the account foundation only, namely email/password sign-up,
sign-in and sign-out, server-verified sessions, and private `planner_draft` CRUD under RLS with
cross-user isolation and live invalidation (content-free `planner_draft_signal`, the one
coordinator-approved non-RLS relation, then an authenticated RLS re-fetch). Not built: magic link,
Google, passkeys/MFA, household onboarding and membership policies, global and per-trip roles, the
signed-out draft import, MCP OAuth and consent, personal access tokens, settings, export and delete.
Those stay requirements below. Whether sign-up is open or invite-only is still open (question 2); a
working sign-up path does not settle it.

## User stories

1. As a family member, I want to sign in with a magic link or Google, so that there is no password to remember.
2. As a user, I want to connect Claude to my account and see exactly what it can do, so that I'm in control.
3. As a parent, I want my children's ages and passport dates visible only to our household's adults.
4. As a user, I want to export everything and delete my account, so that I own my data.
5. As the owner, I want roles (user, researcher, moderator, admin) so that research and review are gated.

## Detailed behaviour

### Sign-in

1. Managed Better Auth. Built: email and password. Planned: email magic link (with an email sender still to choose), Google sign-in, optional passkeys/MFA when the managed service supports them. Sessions are server-verified Better Auth sessions; the browser never holds a database credential.
2. First sign-in creates `app_user` and offers household setup (F01). Planned: the `app_user`, `household_member` and `trip_member` tables are migrated but deny-by-default with no membership policies yet; today's private drafts are keyed to the server-verified Better Auth user id.
3. Signed-out use: Explore, entity pages, templates and a local draft trip (stored in the browser); "Sign in to keep this" imports the draft as a trip (planned; guest drafts and import are not built).

### Roles and authorisation

4. Global roles on `app_user.role`: user, researcher (can run research and propose), moderator (can review), admin (everything).
5. Per-trip roles in `trip_member` (owner, editor, viewer) and per-household roles in `household_member` (owner, adult).
6. Two walls: the operation layer checks the actor's rights for each op before running it; Postgres RLS (policies on every private-content application table keyed by the server-verified user id that the server binds per transaction, as `planner_draft` already does) enforces the same rules. The sole content-free `planner_draft_signal` exception has no app-role grants and is scoped by its sealed per-user query. Operations run as the caller, never with a privileged role, except system jobs in the worker (reminders, staleness), which run with a dedicated service identity and only call system operations.

### MCP authorisation

7. Primary: an OAuth 2.1 server for MCP clients (planned; whether Managed Better Auth provides it or another component does is to be verified before M0 closes). Consent screen (ours) names the client and the scopes in plain words.
8. Fallback: **personal access tokens** created in Settings (name, scopes, expiry, last used), sent as a bearer header by clients that support headers (Claude Code). Revocable at any time.
9. Scopes: `catalog:read`, `trips:read`, `trips:write`, `reservations:read` (codes), `people:read` (passport dates, heights, weights; off by default), `research:propose`, `review`, `admin`.
10. Every MCP operation records the client in `op_event`; Settings shows connected clients with last activity and a revoke button.
11. Rate limits per user and per client (requests per minute, writes per hour) enforced in Hono middleware.

### Privacy rules

12. Personal data classes: **people** (birth dates, heights, weights, passport expiry, citizenship), **secrets** (reservation codes), **attachments** (tickets, receipts, photos), **private notes**. Each class has an explicit list of who can read it; none is ever included in guest links, templates, exports to others or MCP responses without the matching scope or explicit choice (10-sharing.md).
13. Location data in photos stripped on upload for anything shareable.
14. Logs never contain secrets or people data (structured logging with a deny-list).
15. **Export**: one-click export of all the user's data (households they own, trips, reservations with codes, tasks, expenses, memories, attachments) as JSON plus files in a zip.
16. **Delete**: deletes the account, households they own (with a warning listing other members), trips they own (other members are offered ownership transfer first), memberships elsewhere, tokens; anonymises their authored changesets (kept for catalog history as "deleted user").
17. Backups (08-self-hosted.md; backup plan on Neon still to be written) are encrypted offsite; a deleted account disappears from backups as they rotate (stated in the privacy note).

### Settings

18. Per user: name, email, units (metric, imperial), language (English first), time zone, quiet hours, notification channels, connected clients and tokens, inbound email address (F08), export, delete.

## Sharing

See [10-sharing.md](../10-sharing.md). This page defines the privacy classes that every share respects; the share audiences and guest links themselves are specified there and in F11.

## Data touched

Better Auth user and session tables (managed by Neon Auth), `app_user`, `household_member`, `trip_member`, `mcp_token`, `notification_pref`, `push_subscription`, `op_event`, `planner_draft` and `planner_draft_signal` (built). Private-content application tables use RLS; the signal table is the single documented non-RLS exception.

### Schema additions

- `mcp_token (id, user_id, name, token_hash, scopes text[], expires_at, last_used_at, created_at, revoked_at)`.
- `user_settings (user_id primary key, units text, language text, tz text, quiet_hours jsonb)`.
- `oauth_client_seen (user_id, client_id, client_name, first_at, last_at)` for the connected-clients list.

## Operations and MCP tools

Operations: `user.update_settings`, `token.create`, `token.revoke`, `client.revoke`, `user.export`, `user.delete`, `user.set_role` (admin).

MCP: no account-management tools; authorisation happens through OAuth or tokens.

## Edge cases

- Magic link (planned) opened on a different device: works and asks to confirm the device.
- A user signs in with Google using the same email as a magic-link account: linked to the same user. **Superseded 25 Oct 2026:** linked only when the existing account's email is verified; otherwise refused, and the user links Google from Account after signing in ([google-and-apple-sign-in.md](google-and-apple-sign-in.md) section 5).
- Token leaked: revocation takes effect on the next request; tokens are hashed at rest.
- OAuth server unavailable for MCP clients: tokens only, as planned.

## Acceptance criteria

1. RLS test suite: for every private-content table, a user who is not a member reads zero rows and writes nothing; viewers cannot read secrets or people data. For `planner_draft_signal`, verify the app role has no direct grants and sealed queries cannot expose another user's signal.
2. An MCP token without `reservations:read` receives reservations without codes; with it, codes are included.
3. Export produces a zip that restores into a fresh account with the same trips (round-trip test).
4. Deleting a user removes their personal data and leaves catalog history attributed to "deleted user".
5. No secret or people field appears in application logs during the full test suite (log scan).

## Milestone

M0 (auth, app_user, roles, RLS baseline, tokens, OAuth spike; only the email/password and private-draft foundation is done), M3 (settings for notifications), M5 (export and delete).

## Open questions

1. Passkeys in year one? Default: only if Managed Better Auth supports them without extra services.
2. Allow sign-up by anyone, or invite-only while family first? Default: invite-only until M5.
