# MCP tool registry, locks and the admin panel

Status: **spec, planned** (28 Oct 2026, travel-planner, Opus 5.5). Docs only; nothing here is built. Owner direction of
27 Oct 2026, item 3: "The owner controls from an admin panel how much is exposed and can lock down any tool at any time
(per tool, per group, per level, per client, per user, global pause), taking effect on the next call." PLAN R-287; BACKLOG
15.402 to 15.405; tasks GOV-C, GOV-1, ADM-0, GOV-API1, GOV-API2, GOV-UI1, GOV-UI2, GOV-RV1, GOV-RV2 and GOV-S, all in M1
([BUILD-READINESS.md](BUILD-READINESS.md)); owner questions QX14, QX18, QX19, QX20.

> **Owner decision, 27 Oct 2026: no public or anonymous MCP endpoint.** One authenticated endpoint, `/mcp/`; every call is
> made by a signed-in account ([identity-and-roles.md](identity-and-roles.md) 1.1). This page is written to that decision:
> there are no endpoint-level locks, every list is per caller (`ttlMs: 0`), and the panel gains the per-user **MCP access**
> switch and the default for new accounts. Because users connect from M1, every panel screen ships in M1.

Builds on: [identity-and-roles.md](identity-and-roles.md) (who the caller is), [auth-and-sign-in.md](auth-and-sign-in.md)
14.5 and 14.7 (grants, the owner's global rules; this page extends 14.7 and moves `mcp_settings` from MCP-G to GOV-C),
[tool-catalogue.md](tool-catalogue.md) (the tools), research
[mcp-best-practice-2026-10-27.md](../../../research/reports/mcp-best-practice-2026-10-27.md) (sections 7 and 9), design
foundation [principles.md](../design/foundation/principles.md), [components.md](../design/foundation/components.md),
[tokens.md](../design/foundation/tokens.md). Principles: P1 (56 tools must stay findable: groups, counts, filters), P2 (list
first, detail in a side sheet), P3 (a glance answers "what is on, what is locked, is anything wrong"), P4 (statuses in words),
P5 (the sheet opens from its row and returns focus), P6 (status and last call on the row), P7 (the panel's primary action is
locking or unlocking a tool), P9 (one server module, paged server reads).

## 0. The decision in one paragraph

Every tool is **one row of a generated registry** (name, group, level, class, annotations, schemas, a definition hash) that
lives in code, and **one row of runtime policy** (status, who sees it, pinned hash, owner note) that lives in Neon. Locks
are deny-only rules at six scopes (everyone, a class, a group, a level, a client, a user or one user's app),
and **deny always wins**. Three layers enforce them: the database policy, read on every call in the same round trip as the
grant and the quota, so a change applies to the **next call** with no cache in between; environment switches that need a
redeploy but no database; and one Vercel firewall rule that cuts all MCP traffic at the edge in seconds. The owner works
the database layer from `/admin/mcp/` on the site: a tools matrix, locks, clients, users and their apps, activity, quotas
and one "Stop all AI access" button; every change is audited with before and after values and can be undone. No MCP tool
can read or change any of it. **Trade-off:** one database read per call and an admin panel in bundle H (about 39 h, all in M1), against a lock that is either slow (env), fuzzy (a cache), or off the record.

## 1. What the owner controls, at a glance

| Control | Scope | Where | Takes effect | Needs the database |
|---|---|---|---|---|
| Stop all AI access (panic) | every tool, every account | panel, Overview | next call | yes |
| Pause writes only | every write class | panel, Overview | next call | yes |
| Tool status: On, Owner only (dark), Off, Locked | one tool, or a selection | panel, Tools | next call; leaves `tools/list` | yes |
| Who sees an On tool: everyone, invited users, owner | one tool | panel, Tools | next call | yes |
| Lock rules | everyone, class, group, level, client, user, one user's app x all tools, a group, a class or one tool | panel, Locks | next call | yes |
| Highest level for everyone, for non-owners | global | panel, Settings | next call | yes |
| Who may use MCP | owner only, or per user (each account's MCP access switch) | panel, Overview | next call | yes |
| Default for new accounts and the new-account wait | allowed or off; 0 to 168 hours | panel, Overview | next call | yes |
| One account's MCP access | on, off, follow the default | panel, Users | next call | yes |
| Allowed client ids | per client | panel, Clients | next call | yes |
| A user's role, suspension, invitation, apps and tokens | per user | panel, Users | next call | yes |
| Quota overrides (tighter only) | per user or per app | panel, Quotas | next call | yes |
| Accept a changed tool definition | per tool | panel, Tools | next call | yes |
| Deploy switches `MCP_ENABLED`, `MCP_WRITES_ENABLED`, `MCP_STAGE_ENABLED`, `MCP_MAX_LEVEL`, `MCP_TOOL_DENY`, `MCP_PANIC` | global | Vercel env, then redeploy | about 1 to 3 minutes | no |
| Edge block | every `/mcp/` request | Vercel Firewall custom rule | seconds, no deploy | no |

## 2. Rules

| # | Rule |
|---|---|
| G1 | **Deny wins.** A tool runs only if every layer allows it; any matching deny refuses it. There are no allow rules: capabilities come only from levels and grants ([identity](identity-and-roles.md) 4) |
| G2 | **No governance over MCP.** No MCP tool reads or writes the registry, policy, locks, settings, roles, grants, tokens, quotas or the audit. `whoami` describes the caller's own access only. The panel on the site is the only lever |
| G3 | **Next call.** Every policy read happens inside the call's own `mcp_gate()` round trip; nothing on the call path caches policy, role or grant across calls |
| G4 | **The env layer cannot be raised by the database.** `MCP_MAX_LEVEL` and `MCP_TOOL_DENY` bound everything the panel sets; a compromised admin session cannot exceed them |
| G5 | **Locks never delete.** Locking hides and refuses; it never removes data, grants, tokens, previews or pending changes (pending work is held, section 7) |
| G6 | **Every admin change is audited** with actor, time, reason, before and after; undo is a new audited change |
| G7 | **New tools ship dark.** A tool new to a deploy is `dark` (owner only) until the owner turns it on; destructive tools also need MCP-S of their phase before the owner may set them On (the panel refuses, naming the review) |
| G8 | **A changed definition is not served** to non-owners until the owner accepts its new hash (QX18) |
| G9 | **One data boundary.** The panel reads and writes through `web/lib/server/admin-mcp.ts` and `/api/admin/**`; components never query (P9); lists page on the server |
| G10 | **The panel is owner-only and invisible to others.** `/admin/**` answers the site's "Not here" page to anyone without the `admin` role, signed in or not, so the route is no oracle |

## 3. The registry as data

### 3.1 Static registry (code; generated)

One `ToolDef` per tool in `core/src/mcp/registry/**` (MCP-C owns the type; SCH-G the generator). The generator writes
`data/schema/generated/mcp-tools.json` and the human catalogue `docs/v2/mcp/generated/tool-catalogue.generated.md`; check-all
step `mcp-registry --check` fails when either is stale ([tool-catalogue.md](tool-catalogue.md) 4).

| Field | Type | Meaning |
|---|---|---|
| `id` | string, `^[a-z][a-z0-9_]{2,47}$` | the tool name; stable; never reused |
| `title` | string ≤ 60 | display name |
| `group` | enum `find`, `read`, `graph`, `discover`, `check`, `me`, `mine`, `plan`, `profile`, `ask`, `research`, `review`, `export` | panel grouping and group locks |
| `phase` | `M1` to `M5` | when it ships |
| `min_caps` | capability list | the lowest level that lists it, as capabilities |
| `addons` | rule per argument, for example `travellers` needs `people` | add-on checks |
| `class` | `read`, `write_user`, `write_stage`, `decide`, `export` | class locks; the panel's "kind" column |
| `annotations` | `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`, all four always set | sent to clients; never trusted for enforcement |
| `route` | the `/api/v1` or `/api/account` route, or the operation, it projects | R-252 tool-to-route table |
| `input`, `output` | Zod schema references | generated JSON Schema 2020-12 |
| `quota` | bucket ids | which `quota_bucket` keys it takes |
| `schema_version` | integer | bumped by a reviewed change of input or output |
| `definition_hash` | SHA-256 hex | section 3.3 |
| `default_status` | `dark` for every new tool | G7 |
| `review` | `MCP-S`, `MCP-S2`, `MCP-S3`, `MCP-S4`, `M5-S` | the review that must pass before the owner may set a destructive tool On |

### 3.2 Runtime policy (Neon)

Migration slug `mcp_governance` (GOV-C; number at merge, MIG-N). RLS on every table; `travel_app` has no direct DML or
`select`; reads go through `mcp_gate()` and the admin reader functions, writes through admin functions that check
`app_user.role = 'admin'` for `app.user_id` and write `admin_audit` in the same transaction.

| Table | Columns | Notes |
|---|---|---|
| `mcp_tool_policy` | `tool_id` (pk), `status` (`enabled`, `dark`, `disabled`, `locked`), `audience` (`everyone`, `invited`; meaningful when `enabled`), `pinned_hash`, `pinned_at`, `pinned_by`, `note` (owner's words, ≤ 500), `lock_reason`, `locked_until` (nullable), `version` (optimistic concurrency), `updated_at`, `updated_by` | no row = the registry's `default_status`; a row for a tool not in this deploy is shown as "Not in this deploy" and ignored |
| `mcp_policy_rule` | `id`, `who_kind` (`everyone`, `level`, `client`, `user`, `app`), `who_value`, `what_kind` (`all`, `group`, `class`, `tool`), `what_value`, `reason` (required), `created_by`, `created_at`, `expires_at` (nullable), `lifted_at`, `lifted_by` | deny only; active when `lifted_at is null and (expires_at is null or expires_at > now())` |
| `mcp_settings` (one row; moved here from auth 14.5's `mcp_access`) | `paused` (`none`, `writes`, `all`), `mcp_access` (`owner_only`, `per_user`), `new_user_default` (`allowed`, `off`), `new_account_wait_hours` (0 to 168, default 24), `max_level`, `max_level_non_owner`, `hold_pending_on_lock` (default true), `version`, `updated_at`, `updated_by` | the allow list moves to `mcp_known_client.allowed`; the per-user `mcp_allowed` is in `mcp_user_settings` (MCP-G) |
| `mcp_known_client` | `client_id` (pk, the exact URL), `display_name`, `logo_file` (ours), `allowed`, `added_by`, `added_at`, `note` | seeded with Claude and Claude Code; ChatGPT after MCP-PK (QX16) |
| `mcp_quota_override` | `id`, `who_kind` (`user`, `app`), `who_value`, `bucket`, `limit` (must be lower than the code's), `expires_at`, `reason`, `created_by` | tighter only (CONS rule: numbers live in `core/src/config/mcp-limits.ts`) |
| `admin_audit` | `id`, `at`, `actor_user_id` or `cli`, `action`, `target_kind`, `target_id`, `before` jsonb, `after` jsonb, `reason`, `undo_of`, `request_id` | insert-only; one year (QX19); never a secret, token, argument or result |

Statuses in words (the panel's chips, section 10):

| Status | Listed for | Callable by | Meaning | Chip (tokens) |
|---|---|---|---|---|
| `enabled`, audience `everyone` | every caller whose level reaches it | same | On | "On", check icon, `--ok` text |
| `enabled`, audience `invited` | the owner and accounts the owner switched on explicitly (`mcp_allowed = true`, not by default) | same | On for chosen accounts | "Invited only", `--ok` text, person icon |
| `dark` | the owner only | the owner only | shipped, being tried in production | "Owner only", eye-off icon, `--info` dashed outline |
| `disabled` | nobody | nobody | planned off: not opened yet, or retired | "Off", neutral outline, `--muted` |
| `locked` | nobody | nobody | stopped by the owner, with a reason; holds pending work (section 7) | "Locked", lock icon, `--crit` on `--crit-soft` |
| (any) with a changed definition | the owner only | the owner only | deployed hash differs from the pinned hash (G8) | "Changed", triangle icon, `--warn` on `--warn-soft` |

No green anywhere: "On" is the system's `--ok` blue (tokens 3).

### 3.3 Definition hash, pinning and drift

`definition_hash = sha256(canonical_json({id, title, description, inputSchema, outputSchema, annotations, _meta.ui}))`,
canonical JSON with sorted keys and no whitespace (SCH-G). The deploy carries it in the registry; the database carries the
hash the owner last accepted (`pinned_hash`).

| Case | What happens |
|---|---|
| First deploy of a tool | no pin; the tool is `dark`; turning it On pins the current hash |
| A later deploy changes the description or a schema | non-owners do not see or call it; the owner sees "Changed" with a diff of the description and the schema (old and new, from the generated catalogue of the two commits); "Accept" pins the new hash (audited) |
| The hash goes back to the pinned one (a revert) | served again at once |
| A deploy removes a tool | its policy row shows "Not in this deploy" |

Why: the rug-pull class (definitions that change after review) is the one MCP-specific attack an owner cannot see from the
outside (research G2). Trade-off: every wording change needs one click after its deploy (QX18).

## 4. The lock model

### 4.1 Three layers

| Layer | Mechanism | Who changes it | Bound | Works when |
|---|---|---|---|---|
| L0 edge | Vercel Firewall custom rule: deny requests whose path starts with `/mcp/` or `/.well-known/oauth-protected-resource/mcp` (one of Hobby's 3 custom rules, created and kept inactive by O-M7) | owner, Vercel dashboard | seconds, no deploy (research S18) | the database or the code is suspect |
| L1 deploy | env `MCP_PANIC=1` (refuse everything), `MCP_ENABLED` (the endpoint; replaces auth 14.6.6's `MCP_PUBLIC_ENABLED` and `MCP_PRIVATE_ENABLED`), `MCP_WRITES_ENABLED`, `MCP_STAGE_ENABLED`, `MCP_MAX_LEVEL`, `MCP_TOOL_DENY` (comma list of tool ids and `group:<g>`, `class:<c>`) | owner, Vercel env, redeploy | 1 to 3 minutes | the database is down or suspect |
| L2 live | `mcp_settings`, `mcp_tool_policy`, `mcp_policy_rule`, grants, roles, status | owner, `/admin/mcp/` | next call | normal operation |

### 4.2 Scopes

| Lock | Stored as | Example |
|---|---|---|
| Everything | `mcp_settings.paused = all` | panic |
| Every write | `paused = writes` | keep reading while a write bug is found |
| A class of tools | rule `who: everyone, what: class=write_user` | stop every user write, keep reads |
| A group | rule `what: group=research` | stop research tools only |
| One tool | `mcp_tool_policy.status = locked` | `apply_change` misbehaves |
| A level | rule `who: level=plans_write` | stop everything only that level reaches; lower levels keep working |
| A client | rule `who: client=<client id>`, or `mcp_known_client.allowed = false` | ChatGPT shows a bug; keep Claude |
| A user | rule `who: user=<id>` (MCP only), or Suspend (site and MCP) | one account behaves oddly |
| One app of one user | rule `who: app=<user id>:<client key>`, or the user's own per-app tool list (auth 14.2 kill lists) | the owner's research PAT leaked |

A rule's `what` narrows it: "client ChatGPT x class `write_user`" stops ChatGPT's writes only. Rules may expire
(`expires_at`), for example a one-hour lock while investigating.

### 4.3 Precedence

```
refuse if any of:
  L0 edge rule active                                     (the function never runs)
  L1: MCP_PANIC, MCP_ENABLED off, class switch off, tool in MCP_TOOL_DENY, level above MCP_MAX_LEVEL
  L2: settings.paused is all, or writes and the tool is a write
      tool status in {disabled, locked}; dark and caller not admin; audience invited and caller not invited or admin
      deployed hash != pinned hash and caller not admin
      any active rule whose who matches (everyone | level reached | client | user | app)
                         and whose what matches (all | group | class | tool)
      identity, grant and capability checks fail (identity-and-roles 3, 4)
otherwise run
```

Deny wins: the order of the checks changes only which reason is reported, never the outcome. When several match, the
reason reported is the first in the order above (so the owner's panic shows as "paused", not as a tool lock).

## 5. Storage, the per-call check and the caching rule

**The rule:** policy is read **per call**, never cached across calls, in the same database round trip as the grant and the
quota.

| Path | One call to | Reads |
|---|---|---|
| Unauthenticated `/mcp/` (PRM, `server/discover`, the `401`) | `quota_take('mcp:unauth:ip', ...)` only | no policy, no store, no user table ([identity](identity-and-roles.md) 1.1) |
| Authenticated `/mcp/` | `mcp_gate(user_id, client_key, tool, tool_meta, ip_hmac)` inside `withUserTransaction` | identity facts, settings, known client, grant or token, user settings, policy row, matching rules, quota overrides; takes the user, client, token and global buckets |
| `tools/list` | the same function with `tool = '*'` | returns the visible set for this principal |

`tool_meta` (group, class, min caps, deployed hash) is passed from the deployed registry, because the database does not know
the code.

**What is guaranteed**

| Change | Applies to | Bound |
|---|---|---|
| Any L2 change (lock, unlock, status, rule, settings, role, status, grant, quota override) | every call whose gate read starts after the change commits | 0 s after commit; a call already past its gate finishes (at most `maxDuration`, 30 s on the MCP routes) |
| `tools/list` | the next listing (`ttlMs: 0`, `cacheScope: "private"`; every list is per caller) | the client's next list |
| L1 env | every call after the new deploy is live | about 1 to 3 minutes |
| L0 edge | every request after the rule publishes | seconds |

**Why per call, not a short cache.** The quota take already needs Postgres on every call (EML-Q), so reading policy in the
same function costs one indexed lookup and no extra round trip (about 10 to 20 ms, `iad1` to `us-east-2`). A per-instance
cache would make the bound "up to the TTL, per warm instance" (Fluid compute keeps instances for minutes) and save nothing.
Vercel Global Config was rejected: writes propagate in up to 10 s, Hobby includes 100 writes and 100,000 reads a month (a
busy month could spend the reads), and it would be a second source of truth outside RLS and the audit (research 7).

**Reads are from the primary.** The gate never reads from a replica (none exists today; the rule stands if one is added).

**When the database cannot be reached:** every authenticated call fails closed (`403` with "The travel tools are
unavailable for a moment."): with no anonymous endpoint there is nothing that could safely answer without the grant check.
The unauthenticated handshake (PRM, `server/discover`, the `401`) still answers, so clients can sign in once Neon is back.

**Concurrency.** Admin writes use `version` for optimistic concurrency (a second tab gets "Changed elsewhere; reload").
`mcp_gate()` takes no locks on policy rows (plain reads under read committed), so admin writes never wait on traffic.

## 6. `tools/list` filtering and change notices

- Only authenticated callers get a list; an unauthenticated `tools/list` is a `401` (identity 1.1).
- The list is the registry order (deterministic, spec P8) filtered by `allowed(tool, principal)` from the identity page 4
  with arguments ignored (add-on checks that depend on arguments apply at call time). Locked, disabled, changed (for
  non-owners) and out-of-level tools are absent.
- **Parity rule:** for every principal, `tools/list` equals the set of tools a call would admit with neutral arguments.
  A test enforces it for every level, role and lock kind (section 13, GT4). Lists answer `ttlMs: 0`, `cacheScope: "private"`.
- `listChanged: false` in `server/discover`. 2026-07-28 delivers `notifications/tools/list_changed` only over a long-lived
  `subscriptions/listen` stream, which Vercel would cut at `maxDuration`; `ttlMs` does the job instead (auth 14.12).
- A call to a tool that is not in the caller's list gets a **tool execution error** (`isError: true`), code
  `not_available` with `reason` `locked`, `off`, `paused`, `changed` or `not_open`, never the protocol error "unknown
  tool", so the model can tell the person what happened. The protocol error is kept for names not in the deployed registry.
- This replaces, for admin locks, the tools-v1 gotcha "a tool behind a capability flag must answer `not_available`, not
  disappear": that gotcha still holds for **data-layer flags** (a route not yet shipped, towns before META-2), where the tool
  stays listed and answers `not_available`.

## 7. Work in flight when something is locked

| Work | On lock | On unlock |
|---|---|---|
| A call already running | finishes in its own transaction | |
| `preview_id` from `preview_trip_change` | `apply_change` checks its own policy and the stored `origin_tool`; either locked: `not_available`; the handle lives to its normal expiry (30 minutes) | usable again if not expired |
| Pending change waiting at `/account/approve/<id>/` (plans_propose, removals without the add-on) | when `hold_pending_on_lock` is on and the originating tool, client, user or class is locked at the moment of approval, the page shows "On hold: the site owner turned off the tool that made this change. You can discard it." Apply is disabled, Discard works | Apply works again; the owner may also "Release held changes" for one tool on the panel (audited) |
| Staged research batch (M4) | `stage_batch` locked: no new batches; submitted batches stay reviewable on the site with the banner "Submitted through a tool that is now locked"; `stage.ts export` refuses a batch flagged held unless run with `--release <reason>` (audited) | flag cleared |
| Task (M5 tasks extension) | the worker checks policy between steps; the next `tasks/get` answers `failed` with code `locked`; partial results are discarded unless the tool is `validate` (read-only), whose partial report is returned | a new task must be started |
| MCP Apps view (M3) | the view's tool calls go through the host to the same gate and get `not_available`; the view shows the text and disables the action | |
| Quota counters | unchanged | unchanged |

Panic ("Stop all AI access") holds every pending change and every staged batch at once when "Also hold pending work" is
ticked (default on).

## 8. Audit and undo

| What | Detail |
|---|---|
| Every write through the panel or `core/bin/access.ts` | one `admin_audit` row in the same transaction: action (`tool.status`, `tool.accept_hash`, `rule.create`, `rule.lift`, `settings.update`, `panic.stop`, `panic.resume`, `client.allow`, `user.role`, `user.status`, `user.invite`, `user.revoke_all`, `quota.override`, `held.release`), target, before, after, reason (required for locks, panic, role and status), request id |
| Undo | "Undo" on an audit row writes the `before` back as a new change with `undo_of`; refused when the target moved since (version check: "This changed again after; undo the later change first"); panic's undo is the stepwise Resume (section 9) |
| Integrity | `travel_app` can only insert through the functions; no update or delete grant exists for anyone but the migration role; a test asserts it |
| Retention | one year (QX19), then deleted by the existing purge job pattern |
| Never stored | secrets, tokens, token hashes, tool arguments, tool results, IPs (an HMAC at most) |
| Where it shows | panel, Activity and audit (section 10.6); the user's own export lists rows where they are the target (identity 11) |

## 9. Panic: the button and the runbook

**The button.** Overview, top right, danger style (components 2.1): **Stop all AI access**. The confirm dialog (focus
trapped, Esc and Cancel keep things as they are):

> **Stop all AI access?**
>
> Every AI app and the owner's own tools get "unavailable" on their next call. Nothing is deleted.
> Pending changes and staged batches are held until you resume.
>
> Reason (required) [ ________________________ ]
> [x] Also hold pending work
>
> [ Stop all AI access ]   [ Cancel ]

Resume is stepwise, each step its own confirm: **Resume catalogue reading** (sets `max_level` to `catalogue`), **Resume
reading my plans** (`plans_read`), **Resume everything** (restores the `max_level` saved at the stop). Each step is audited.

**Runbook (owner; the coordinator may assist; never a script that runs it unattended)**

| Step | When | Do | Time |
|---|---|---|---|
| 1 | anything looks wrong | panel: Stop all AI access, with a reason | seconds |
| 2 | the panel or the database is unreachable or suspect | Vercel, Firewall: switch on the MCP block rule (O-M7) | under a minute |
| 3 | the code or a deploy is suspect | Vercel env: `MCP_PANIC=1`, redeploy the last good commit | 2 to 5 minutes |
| 4 | after 1 to 3 | panel, Activity: filter the last hours by tool, client, user, result; export nothing (read on screen) | |
| 5 | a client or user is the cause | lock that client or user (rule), revoke the user's apps and tokens, suspend if needed | |
| 6 | a tool is the cause | lock the tool with a reason; leave the panic on | |
| 7 | a token or grant may have leaked | revoke it; for OAuth also delete the consent (auth 14.6.3); Neon cannot revoke issued refresh tokens, so keep the grant revoked | |
| 8 | data may have changed | the activity feed of each affected trip and `op_event`; undo per batch (README principle 5); staged batches: reject | |
| 9 | resume | stepwise resume (catalogue, then plans read, then all); watch Activity for 15 minutes | |
| 10 | afterwards | a dated note in `docs/v2/mcp/auth-and-sign-in.md` 13 (MCP-S entries) and a BACKLOG row for the fix | |

## 10. The admin panel

Route family `/admin/mcp/**` inside the admin shell `/admin/` (ADM-0). Signed in, `admin` role, request time, `noindex`,
`Cache-Control: no-store`, `frame-ancestors 'none'`. Data through `web/lib/server/admin-mcp.ts` and `/api/admin/**`
(section 12). Desktop: a 220 px left section list beside a main column up to 1120 px. Phone: the section list is the first
screen; each section opens as its own screen with a back row (P5). Type, spacing, focus and motion are the foundation's;
no new tokens. No green: status colours are tokens 3 only.

### 10.0 The shell (ADM-0)

```
+ Trip Plans . Site admin ------------------------------------------------- [Owner v] +
| AI ACCESS               |                                                           |
|   Overview              |  (section content)                                        |
|   Tools          56     |                                                           |
|   Locks           2     |                                                           |
|   Clients         3     |                                                           |
|   Users and apps  4     |                                                           |
|   Activity              |                                                           |
|   Quotas                |                                                           |
| SITE                    |                                                           |
|   Audit log             |                                                           |
|   Staging queue   3 (M4)|                                                           |
|   Requests (INT-5, later)                                                             |
+-------------------------+-----------------------------------------------------------+
```

The counts are live numbers (P3). "Requests" appears only when INT-5 ships; until then it is absent, not disabled.

### 10.1 Overview and kill switches (M1)

```
+ AI access . Overview ------------------------------------------- [ Stop all AI access ] +
| [banner, only when paused: urgent] All AI access is stopped since 14:02 by you:        |
|  "looping client". Pending work is held.   [ Resume catalogue ] [ Resume plans ] ...  |
|                                                                                        |
| LIVE SWITCHES (this site)                                                              |
|  AI access               On            calls today 508      [ Pause writes ]           |
|  Who may connect         Each account's switch (default: allowed after 24 h) [ Change ]|
|  Accounts connected      12 of 31 . 2 turned off by you                [ Open Users ] |
|  Highest level           My plans, change (non-owners: My plans, read)  [ Change ]     |
|                                                                                        |
| DEPLOY SWITCHES (read only; change in Vercel, then redeploy)                           |
|  MCP_ENABLED 1 . MCP_WRITES_ENABLED 0 .                                                 |
|  MCP_STAGE_ENABLED 0 . MCP_MAX_LEVEL plans_read . MCP_TOOL_DENY (none) . MCP_PANIC 0    |
|                                                                                        |
| EDGE BLOCK (Vercel Firewall)                                                           |
|  Not visible from here. To cut all MCP traffic in seconds: Vercel > travel > Firewall  |
|  > "MCP block" > On.  [ How to ]                                                       |
|                                                                                        |
| NEEDS YOU                                                                              |
|  ! 2 tools changed since you accepted them         [ Review ]                          |
|  ! 1 lock expires in 20 min (ChatGPT x writes)     [ Open ]                            |
|  3 batches waiting in the staging queue (M4)       [ Open ]                            |
+----------------------------------------------------------------------------------------+
```

States: normal; paused (urgent banner, components 5.4, with the reason and the resume steps); database unreachable (error
block 6.3 "We couldn't read the live switches. Use the edge block or the deploy switches." with both instructions);
loading (skeleton rows 6.2). "Needs you" rows use the needs-you row (3.3); an empty list reads "Nothing needs you."

### 10.2 Tools (M1)

```
+ AI access . Tools -----------------------------------------------------------------------+
| [Search tools /]  Group [All v]  Level [All v]  Status [All v]  Phase [All v]  Clear all |
| 56 tools . 21 On . 0 Invited only . 33 Owner only . 0 Off . 2 Locked . 0 Changed          |
| [ ] select   With 3 selected: [ Turn on ] [ Owner only ] [ Lock... ] [ Turn off ]         |
|------------------------------------------------------------------------------------------|
| FIND (5)                                                                          [v]     |
| [ ] search            Find      Catalogue Read   R . I .  On          312  0   2 min ago  |
| [ ] list_places       Find      Catalogue Read   R . I .  On          201  1   5 min ago  |
| ...                                                                                      |
| PLAN (8)                                                                          [v]     |
| [ ] apply_change      Plan      Change    Your data  . D I .  Locked  0  0  yesterday     |
|                       "Investigating double applies" . since 09:12 . until 11:00          |
| [ ] copy_trip         Plan      Propose   Your data  . . I .  Owner only  3  0  1 h ago   |
| ...                                                                                      |
| Columns: Tool . Group . Lowest level . Kind . Hints (R D I O) . Status . Calls 24 h .    |
|          Errors 24 h . Last call                                     [Columns v]          |
+------------------------------------------------------------------------------------------+
```

- Data table (components 4.2): sticky head, group rows collapsible with counts (P1), 44 px rows, keyboard model as 4.2.
  Hints show as four mono letters, a dot where false, with a tooltip and the words in the side sheet (P4).
- **Row → side sheet** (5.1, 460 px, non-modal for reading; its form footer turns modal when a change is started):

```
+ apply_change . Apply a prepared change ------------------+
| Status   (o) On  ( ) Invited only  ( ) Owner only        |
|          ( ) Off ( ) Locked                              |
| Lock reason [ Investigating double applies    ]          |
| Until       [ 11:00 today v ]  (optional)                |
| Note        [ owner's note, ≤ 500 characters  ]          |
|                                                          |
| What it does (as the model sees it)                      |
|  "Apply a change you prepared with preview_trip_change.  |
|   On 'My plans, propose changes' it asks you to approve  |
|   it on the site."                                       |
| Lowest level  My plans, propose changes                  |
| Kind          Changes your data . destructive            |
| Route         PUT /api/account/plans/{id} (plans.ts)     |
| Quota         mcp:write:user                             |
| Definition    3f9a1c...  Pinned 26 Nov by you            |
| Review        MCP-S3 passed 2 Dec                        |
| Last 24 h     0 calls . 0 errors      [ Open activity ]  |
|                                                          |
| [ Save ]  [ Cancel ]                 Takes effect on the |
|                                      next call.          |
+----------------------------------------------------------+
```

- Choosing Locked asks for the reason in the same sheet (required); Save shows the toast (5.3) "Locked apply_change.
  Takes effect on the next call." with Undo (6 s). Turning a destructive tool On before its review passed is refused in
  the sheet: "apply_change needs MCP-S3 before it can be on for others. You can keep it Owner only."
- A **Changed** row's sheet shows "Definition changed in this deploy" with the old and new description and a schema diff
  (added, removed, changed fields), and two buttons: **Accept new definition** (primary) and **Keep it owner only**.
- Empty filter result: "No tools match. Clear all" (6.1). Phone: rows show name, status chip and last call; the group is a
  heading; the sheet is a full-height screen; bulk actions are absent on the phone (select one at a time).

### 10.3 Locks (M1)

```
+ AI access . Locks ----------------------------------------------- [ New lock ] +
| ACTIVE (2)                                                                       |
| Everyone x apply_change           Locked tool . "Investigating..." . until 11:00 |
|                                    by you 09:12            [ Lift ] [ Edit ]     |
| ChatGPT x Changes your data       rule . "ChatGPT bug #12" . no end              |
|                                    by you yesterday        [ Lift ]              |
| ENDED (last 30 days, 5)                                              [ Show ]    |
+----------------------------------------------------------------------------------+
```

New lock (side sheet, modal form): **Who** (Everyone, a level, a client, a user, one
user's app; each with a picker), **What** (all tools, a group, a kind, one tool), **Reason** (required), **Until**
(optional). A live line under the form says what it will stop, in words and numbers: "Stops 14 tools for ChatGPT (3 users).
Takes effect on the next call." (P4, P6). Lift asks once ("Lift this lock?").

### 10.4 Clients and grants (M1)

Table: client (our display name and the client id host), Allowed (switch), apps connected, calls 24 h, last used, Locks.
"Add a client" (side sheet): client id URL (https with a path; the panel never fetches it, G-rule in section 15), display
name, logo from our files, note "I read this client's document on <date>". Turning Allowed off asks: "Stop ChatGPT for
everyone? 3 connected apps lose access on their next call." Seeded rows: Claude (claude.ai, Desktop, mobile), Claude Code.

### 10.5 Users and connected apps (M1)

Paged list (50, server side): name, email (the owner sees it), role in words, status, verified, invited, apps, tokens, last
AI call, **MCP access** (On, Off, Default). Row → sheet: **MCP access** (switch with three states: On, Off, Follow the
default; Off says "Their apps lose access on the next call"), **Role** (select; the last owner's control is disabled with the reason), **Suspend account** (danger,
reason required; also asks Neon to ban, section 2.2 of identity), **Apps** (each:
level in words, add-ons, last used, Revoke, Lock this app), **Tokens** (label, prefix, level, expires, Revoke), **Stop AI
access for this user** (a rule; the site keeps working), **Revoke everything** (danger). Every action states its effect
("Takes effect on their next call").

### 10.6 Activity and audit (M1)

Two tabs (segmented control 2.9): **Calls** (`mcp_audit`: time, user, app, tool, level, result, duration;
filters by time, tool, user, app, result; 50 per page; never arguments or results; no export, P8) and **Admin changes**
(`admin_audit`: time, who, action in words, target, reason, a "before → after" line, **Undo**). Empty: "No calls in this
range." Loading: 8 skeleton rows.

### 10.7 Quotas (M1)

Table per bucket: what it limits, the limit (from code), use in the current window, the top five keys (users by name, apps by
name; the unauthenticated bucket by IP as `IP ...a3f2`), and overrides. "Tighter limit" (sheet): who, bucket, limit (must be below the code's; the input
says the maximum), until, reason. Raising a limit is a code change and the panel says so: "Limits above the defaults are set
in code (core/src/config/mcp-limits.ts)."

### 10.8 Staging queue entry point (M4)

The Overview "Needs you" row and the shell link open the staging queue built by MCP-P2 (`/account/approve/` list and the
batch page, staging 2.4). This panel adds only the count and the link; reviewing stays on the approval page.

### 10.9 Accessibility and copy rules for the whole panel

- Tables: real `<table>` with headers and `aria-sort`; group rows are row headers; the selection checkbox has a name per
  row ("Select apply_change").
- Status is never colour alone: icon plus word on every chip (tokens 3; `--ok` and `--crit` pairs pass 4.5:1 on their
  wells).
- Every switch has a visible label and a state word for screen readers (components 2.5).
- Danger actions: a dialog with a focus trap, the effect in one sentence, the reason field first when required, Esc
  cancels, focus returns to the opener (P5).
- Saves announce in a polite live region: "<thing> <done>. Takes effect on the next call."
- 44 px targets on the phone; no hover-only controls; reduced motion jumps.
- Words: verbs first, sentence case, level names as the user sees them ("My plans, change"), never stored ids in body text;
  stored ids appear only in the mono "Route" and "Definition" lines of the sheet.

## 11. How this relates to the user's Connected apps (MCP-U) and the admin console (F16, INT-5)

| Surface | Who | Scope | Built by |
|---|---|---|---|
| Account, Connected apps and access (`/account/connected-apps/`) | every allowed user | their own apps, tokens, levels, add-ons, per-app turned-off tools, pause, activity | MCP-U (auth 14.6), unchanged; it gains the "Limited by your account's role" and "On hold" words |
| `/admin/mcp/**` | the owner | every user, client, tool and rule | GOV-UI1, GOV-UI2 |
| `/admin/` shell | the owner | the admin console's frame | ADM-0, first part of F16 |
| F16 tabs (review queue, research jobs, coverage, templates, moderation, operations health) and INT-5 (requests) | the owner | catalogue work | later tasks plug into the same shell and guard |

The user's per-app turned-off tools (auth 14.2) remain the user's own narrowing; the owner's rules sit above them. Both are
deny-only, so they compose by union.

## 12. API routes the panel needs (contracts named, not coded)

All under `/api/admin/**` (never `/api/v1`, which is the public API): signed in, `admin` role through `identity_resolve`,
`sameOrigin()`, `Cache-Control: no-store`, no CORS. Danger actions (panic, lock, suspend, revoke all, role change) also
require a fresh session (`getUser({ fresh: true })`, signed in within 12 hours) and a `reason`. Zod contracts in
`core/src/schema/api/admin-mcp.ts` (GOV-C); routes in `web/app/api/admin/**` (GOV-API1, GOV-API2); server module
`web/lib/server/admin-mcp.ts`.

| Route | Contract (input → output) | Phase |
|---|---|---|
| `GET /api/admin/mcp/overview` | → `AdminMcpOverview` (live switches, env read-out of `MCP_*` names and non-secret values, counts, needs-you) | M1 |
| `GET /api/admin/mcp/tools` | `AdminToolQuery` (`group`, `level`, `status`, `phase`, `q`, `page`) → `AdminToolPage` | M1 |
| `GET /api/admin/mcp/tools/{tool}` | → `AdminToolDetail` (registry fields, policy, 24 h counts, definition diff when changed) | M1 |
| `PATCH /api/admin/mcp/tools/{tool}` | `AdminToolPatch` (`status`, `audience`, `note`, `lock_reason`, `locked_until`, `accept_hash`, `reason`, `version`) → `AdminToolPolicy` | M1 |
| `POST /api/admin/mcp/tools/bulk` | `AdminToolBulk` (`tools[]`, `action`, `reason`) → `AdminBulkResult` | M1 |
| `GET /api/admin/mcp/locks`, `POST /api/admin/mcp/locks`, `DELETE /api/admin/mcp/locks/{id}` | `AdminLockCreate` → `AdminLockRule`; `AdminLockList` | M1 |
| `POST /api/admin/mcp/panic` | `AdminPanic` (`action`: `stop`, `pause_writes`, `resume_catalogue`, `resume_plans`, `resume_all`; `hold_pending`; `reason`) → `AdminMcpOverview` | M1 |
| `GET`, `PATCH /api/admin/mcp/settings` | `AdminMcpSettingsPatch` → `AdminMcpSettings` | M1 |
| `GET /api/admin/audit`, `POST /api/admin/audit/{id}/undo` | `AdminAuditQuery` → `AdminAuditPage`; → `AdminUndoResult` | M1 |
| `GET /api/admin/mcp/clients`, `POST`, `PATCH /api/admin/mcp/clients/{key}` | `AdminClientCreate`, `AdminClientPatch` → `AdminClient` | M1 |
| `GET /api/admin/users`, `GET`, `PATCH /api/admin/users/{id}`, `POST /api/admin/users/{id}/revoke-all` | `AdminUserQuery` → `AdminUserPage`; `AdminUserPatch` (`role`, `status`, `mcp_allowed` (true, false, null), `reason`, `version`) → `AdminUser` | M1 |
| `GET /api/admin/mcp/activity` | `AdminActivityQuery` (`from`, `to`, `tool`, `user`, `client`, `result`, `page`) → `AdminActivityPage` | M1 |
| `GET /api/admin/mcp/quotas`, `PUT`, `DELETE /api/admin/mcp/quotas/overrides/{id}` | `AdminQuotaOverride` → `AdminQuotaPage` | M1 |
| `GET /api/admin/mcp/held`, `POST /api/admin/mcp/held/release` | `AdminHeldRelease` (`tool` or `batch`, `reason`) → `AdminHeldPage` | M3 (pending changes), M4 (batches) |

Errors: `400 invalid_input` (with the path), `403` for a non-admin (the page shows "Not here"), `409 conflict` on a stale
`version`, `422 refused` with a sentence for business refusals (last owner, destructive tool before review, limit above
code). The user-side routes stay `/api/account/mcp/**` (MCP-U).

## 13. Tests

| # | Case | Tier | Task |
|---|---|---|---|
| GT1 | **Next call:** lock a tool between two calls with one token; the second is refused; unlock; the third runs. Same for each scope of 4.2 | T1 (route), T2 (child database) | GOV-1, MCP-2 |
| GT2 | **Deny precedence:** a generated table of every scope x every status x every level x role, asserting refuse when any deny matches and no rule can add a capability | T1 (property test, core) | GOV-C |
| GT3 | **Cross-user isolation:** a rule on user A never affects user B; A's app lock does not touch A's other app; admin readers return only through admin functions | T1, T2 | GOV-C, GOV-API2 |
| GT4 | **List parity:** for each principal, `tools/list` equals the callable set (neutral arguments); `ttlMs` 0 and `cacheScope` private for every list; deterministic order | T1 | GOV-1 |
| GT5 | **Env layer without a database:** with the database URL unset, `MCP_PANIC=1` and `MCP_ENABLED=0` refuse; with them off and no database, every authenticated call fails closed and the unauthenticated handshake still answers | T1 | GOV-1 |
| GT6 | **Admin-only writes:** a `user` session gets `403` on every `/api/admin/**` route; `travel_app` cannot `insert`, `update` or `delete` any governance table directly; `admin_audit` has no update or delete grant | T1, T2 | GOV-C, GOV-API1 |
| GT7 | **Audit and undo:** every write produces one row with before and after; undo restores; undo after a later change is refused | T1 | GOV-API1 |
| GT8 | **In-flight holds:** a pending change made by a tool that is then locked cannot be applied on the site; discard works; release works and is audited | T1 | MCP-P |
| GT9 | **Definition drift:** a test registry with a changed description is invisible to a non-owner and visible as Changed to the owner until accepted | T1 | SCH-G, GOV-1 |
| GT10 | **Panic:** stop refuses every call on the next call; pause writes refuses writes only; resume steps restore in order; `max_level` restored | T1, T3 smoke | GOV-API1 |
| GT11 | **Locked tool answers a tool error, not a protocol error**, with the reason; an unknown name still gets `-32602` | T1 | GOV-1 |
| GT12 | **No governance tool:** the registry contains no tool in a governance group, and no tool's route is under `/api/admin/mcp/**` or reads a governance table (grep plus registry test) | T1, check-all | MCP-C |
| GT13 | **Panel screens:** 1440 and 390, light and dark, every state of 10.1 to 10.7 (normal, paused, database unreachable, empty, loading, changed); design review then verifier | T1 (shots), review | GOV-UI1, GOV-UI2 |
| GT14 | **Performance:** `mcp_gate()` p95 under 30 ms on the child branch from `iad1` with 50 rules and 56 policy rows | T2 | GOV-C |

## 14. Tasks (hours; full briefs' inputs in [BUILD-READINESS.md](BUILD-READINESS.md))

| Id | Task | Model | h | Phase |
|---|---|---|---|---|
| GOV-C | Governance contract: `mcp_governance` migration (tables of 3.2, with the access settings of identity 2.3), the policy half of `mcp_gate()`, the unauthenticated bucket, admin writer and reader functions with audit, Zod contracts `core/src/schema/api/admin-mcp.ts`, precedence as a pure function `core/src/access/policy.ts`, tests GT2, GT3, GT6, GT14 | Opus | 6.5 | M1 |
| GOV-1 | Enforcement in the transport: env layer parser, gate call per request, `tools/list` filtering and TTLs, `not_available` reasons, drift check, tests GT1, GT4, GT5, GT9, GT11 | Sonnet | 4 | M1 |
| ADM-0 | Admin shell `/admin/` with the owner guard ("Not here" for others), section nav, phone section list | Sonnet | 3 | M1 |
| GOV-API1 | Routes of 12 marked M1, server module, fresh-session rule, tests GT6, GT7, GT10 | Sonnet | 4 | M1 |
| GOV-UI1 | Overview, Tools (with the sheet and drift view), Locks, Admin changes; shots | Sonnet | 6 | M1 |
| GOV-RV1 | Design review (Opus 1.5) and verifier (Sonnet 1) of the M1 screens | Opus, Sonnet | 2.5 | M1 |
| GOV-API2 | Routes for clients, users (with `mcp_allowed`), activity, quotas | Sonnet | 3 | M1 |
| GOV-UI2 | Clients, Users and apps (with the MCP access switch), Calls activity, Quotas; shots | Sonnet | 5.5 | M1 |
| GOV-RV2 | Review and verify the second set of screens | Opus 1, Sonnet 1 | 2 | M1 |
| GOV-S | Security review of the governance layer (bypass, role confusion, audit integrity, sign-up abuse, panel CSRF and framing), inside MCP-S's session | Opus | 2.5 | M1 |

Governance in M1: 39 h (plus SCH-G 3 h, IDN-C 4 h and IDN-1 2 h, counted on their own rows in BUILD-READINESS). Nothing
of the panel is left for M2.

## 15. Conflicts resolved here

| Existing | Where | Now |
|---|---|---|
| `mcp_settings` in migration `mcp_access` (MCP-G, M2) | auth 14.5, 14.9 | in `mcp_governance` (GOV-C, M1), because the single endpoint needs pause, tool status and the access settings in M1; `allowed_client_ids` and `tool_deny` columns become `mcp_known_client.allowed` and rules |
| "A tool on either kill list is absent from `tools/list` and refused" and the tools-v1 gotcha "a tool behind a capability flag answers `not_available`, not disappear" | auth 14.2, tools-v1 gotchas | both kept: admin locks and statuses hide; data-layer flags keep the tool listed (section 6) |
| "Destructive tools start on the global deny list in production and are removed one by one" | auth 14.2, Q198 | G7: new tools ship dark; destructive tools need their review before On. Same intent, one mechanism |
| Env `MCP_TOOL_DENY` plus `mcp_settings.tool_deny` (union) | auth 14.7 | env kept; the database list becomes rules (richer scopes) |
| `MCP_MAX_LEVEL` and `mcp_settings.max_level` "the lower wins" | auth 14.7 | unchanged (identity 4 intersection) |
| F16 "Non-admin users cannot reach `/admin`" | F16 acceptance 5 | kept, and the answer is "Not here" (no oracle) |
| "Our server never fetches the open web" (MX5) | product 2 | extended to the panel: adding a client never fetches its document; the owner reads it and pastes the id |

## Gotchas

- **The WAF rule blocks the owner too.** It is a whole-door switch; the panel cannot lift it. Switch it off in Vercel.
- **`MCP_PANIC=1` needs a redeploy to clear.** Prefer the panel's Stop for anything short of a database or code incident.
- **The unauthenticated handshake stays open during a panic** (PRM, `server/discover`, `401`), so clients can still reach the
  sign-in page; only the WAF rule closes it.
- **Not every client re-reads a list soon.** Claude keys its per-tool permission switches by name; a tool that comes back
  keeps the user's earlier choice in Claude (auth 14.12).
- **Hash churn.** Any description edit changes the hash; batch wording changes into one deploy so the owner accepts once.
- **Rules by client id need the exact URL** (`https://claude.ai/oauth/mcp-oauth-client-metadata`), the same string as the
  token's `client_id`. The panel's pickers come from `mcp_known_client`, so typos are not possible there.
- **The audit is not a security log of the database.** Neon console actions by the owner are not in `admin_audit`.

## Change log

- 28 Oct 2026: written (travel-planner, Opus 5.5) on `public/MCP-PLAN` for the owner's direction of 27 Oct 2026.
- 28 Oct 2026: reworked for the owner's decision of 27 Oct 2026 (no anonymous endpoint): no endpoint locks, `MCP_ENABLED`,
  pause writes, the per-user MCP access switch and new-account default, every screen in M1, GOV-S merged.
