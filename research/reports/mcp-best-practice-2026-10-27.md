# MCP best practice for the travel MCP: identity, governance, tool definitions, hosting, testing

Research report for the owner's MCP direction of 27 Oct 2026, and the owner's decision the same day that there is **no
public or anonymous MCP endpoint** (every call signed in; one endpoint `/mcp/`). The direction: ("same login and roles as the web UI; built on the API layer;
lock down any tool from an admin panel at any time; plan M1 to M5 so building can start"). Read and checked on 28 Oct 2026
by travel-planner (Opus 5.5). Docs only. Every fact below names its source and the date it was read; where a fact could not
be confirmed on a primary page it says so. The decisions it feeds are in
[identity-and-roles.md](../../docs/v2/mcp/identity-and-roles.md),
[tool-registry-and-admin-controls.md](../../docs/v2/mcp/tool-registry-and-admin-controls.md),
[tool-catalogue.md](../../docs/v2/mcp/tool-catalogue.md) and [BUILD-READINESS.md](../../docs/v2/mcp/BUILD-READINESS.md).

Builds on: the MCP-0 spike ([../runs/MCP-0-spike.md](../runs/MCP-0-spike.md), 25 Oct) and the sources list of
[auth-and-sign-in.md](../../docs/v2/mcp/auth-and-sign-in.md) (read 25 Oct). Facts already proven by MCP-0 are cited, not
re-run.

## 1. Findings in ten lines

1. The current protocol is **2026-07-28**: stateless (no `initialize`, no `Mcp-Session-Id`), `server/discover` is
   mandatory, every result carries `resultType`, list results carry `ttlMs` and `cacheScope`, the list-changed notification reaches a
   client only over a `subscriptions/listen` stream, tasks moved into an extension. 2025-11-25 clients still exist; the SDK
   v2 line serves both (S1, S2, S20).
2. the tool list (the list-tools request) **may vary by the authorization presented on the request** and must not vary by connection (S3). Our
   per-level, per-grant filtering is the pattern the spec names.
3. Token rules are unchanged in substance: audience-bound tokens only, never pass a token through, `401` for a bad token,
   `403` for missing permission (S1, S5).
4. Claude, Claude Code and ChatGPT all support **client ID metadata documents (CIMD)**; DCR is deprecated in the spec.
   ChatGPT's CIMD id is `https://chatgpt.com/oauth/client.json` and it uses a stable redirect only when the authorization
   server returns `iss` (S6, S7). Neon returns `iss` (MCP-0 X2). The 26 Oct worry (Q-B1) is mostly answered.
5. **Neon's OAuth provider still has fixed scopes and no custom claims** (S9). Roles cannot ride in the token: the resource
   server must look the role up from `sub` on every call. Neon has no server-side token revocation (S9, MCP-0 X7).
6. Neon's Admin plugin can set a Neon-side role and ban users (S10). It is a second role store; we must pick one authority.
7. OWASP's MCP Top 10 (beta) names token mismanagement, scope creep, tool poisoning, supply chain, command injection,
   prompt injection, weak authz, missing audit, shadow servers and over-sharing (S12). Tool poisoning and rug pulls
   (definitions changing after review) are mitigated by hashing and pinning definitions (S13, S14).
8. On Vercel, a database read per call is the only control that takes effect on the **next** call. Vercel Global Config
   (ex Edge Config) propagates writes in up to 10 seconds, allows 100 writes and 100,000 reads a month on Hobby, and has one
   store (S15, S16). Vercel WAF custom rules publish in seconds with no deploy; Hobby has 3 custom rules (S17, S18). Env vars
   need a redeploy.
9. Vercel function limits that matter: 4.5 MB request and response bodies, 300 s maximum on Hobby with Fluid compute
   (S19). `mcp-handler` 2.3.0 and `@modelcontextprotocol/server` 2.4.0 are current (npm, 28 Oct).
10. Testing practice: deterministic contract and conformance checks on every change, MCP Inspector (now with a CLI mode)
    for protocol checks, model-in-the-loop evals on a schedule (S21, S22). The official conformance runner is still
    labelled unstable and its stable release targets 2025-11-25 (S22).

## 2. The protocol (2026-07-28, with what changed from 2025-11-25)

| # | Fact | Consequence for us | Source |
|---|---|---|---|
| P1 | MCP servers MUST serve OAuth Protected Resource Metadata (RFC 9728); clients MUST use it to find the authorization server | unchanged from the auth spec; we serve PRM for `/mcp/private/` only | S1 |
| P2 | Client registration: CIMD (SHOULD), pre-registration, or DCR (MAY, **deprecated**, kept for compatibility) | DCR stays off (Q164) | S1, S2 |
| P3 | Clients MUST send `resource` (RFC 8707) on authorize and token requests; servers MUST validate the audience; "MCP servers MUST NOT accept or transit any other tokens" | `aud` contains our resource exactly; no upstream call carries the caller's token | S1 |
| P4 | Invalid or expired token: `401`. Insufficient scope: `403` with `error="insufficient_scope"` and the scopes | we cannot step up (Neon has no custom scopes); a missing level is a tool error `forbidden`, a revoked grant is `403` without a scope challenge | S1 |
| P5 | Canonical URI: implementations SHOULD use the form **without** a trailing slash unless it is significant | ours is the slash form because Next answers 308 otherwise; MCP-0 proved the slash form works and the slashless form fails. Keep the slash form and publish only that (known issue) | S1, MCP-0 X8 |
| P6 | RFC 9207 `iss` in the authorization response: servers SHOULD send it, clients MUST check a present `iss` | Neon advertises and sends it (MCP-0 X2); ChatGPT uses its stable redirect only then (S7) | S1 |
| P7 | Stateless: no `initialize`, no sessions; every request carries `protocolVersion`, `clientCapabilities` and SHOULD carry `clientInfo` in `_meta`; `server/discover` MUST be implemented | `clientInfo` is self-reported: log it, never trust it for access | S2 |
| P8 | the tool list (the list-tools request) "MUST NOT vary per-connection" and "MAY vary by the authorization presented on the request"; deterministic order SHOULD | filtered lists per grant are allowed; order fixed by registry order | S3 |
| P9 | the list-changed notification goes only to clients that opened `subscriptions/listen` (a long-lived POST response stream) | on Vercel a stream is bounded by `maxDuration`; we declare `listChanged: false` and rely on `ttlMs` plus per-call enforcement | S2, S3 |
| P10 | `ttlMs` and `cacheScope` ("public" or "private") are required on list results (`CacheableResult`) | every list is per caller (no anonymous endpoint): `ttlMs: 0`, `private` | S2 |
| P11 | Tool definition: `name` (1 to 128 chars, `[A-Za-z0-9_.-]`), `title`, `description`, `icons`, `inputSchema` (JSON Schema 2020-12 by default; for no parameters use `{"type":"object","additionalProperties":false}`), `outputSchema`, `annotations`, `_meta` | our Zod generates both schemas; strict objects | S3 |
| P12 | If `outputSchema` is given, servers MUST return conforming `structuredContent`; a tool returning structured content SHOULD also return the JSON in a text block | `travel-view/1` payload plus a short text; the text-length rule of the response page stands | S3 |
| P13 | Annotations: clients MUST treat them as untrusted unless the server is trusted | never rely on them for enforcement | S3 |
| P14 | Two error kinds: protocol errors (unknown tool, malformed request) and tool execution errors (`isError: true`, actionable) | a locked tool answers a tool execution error (`not_available`, reason `locked`), not "unknown tool", so the model can tell the user | S3 |
| P15 | Servers MUST validate inputs, apply access controls, rate limit, sanitise outputs | the gate, quotas, the privacy detector | S3 |
| P16 | Stateful tools use server-minted handles passed as arguments; "a handle is a name, not a capability"; bind to the user, random, bounded lifetime, say the lifetime in the description | `preview_id`, pending-change ids, batch ids, task ids keyed `<user_id>:<id>` | S3, S5 |
| P17 | `x-mcp-header` mirrors a parameter into an `Mcp-Param-*` HTTP header; never on sensitive parameters | we use none in v1 (a WAF rule could key on a tool name via `Mcp-Name` instead) | S3 |
| P18 | Streamable HTTP POST requests carry `Mcp-Method` and `Mcp-Name` headers | the WAF and the gate can read the tool name before parsing the body; the gate still trusts the body only | S2 |
| P19 | Multi round-trip requests (`resultType: "input_required"`) replace server-initiated elicitation | a missing choice (Day 1) can be asked inline; approvals still happen on our site | S2, S3 |
| P20 | Tasks are the extension `io.modelcontextprotocol/tasks`: `CreateTaskResult` with `taskId`, `ttlMs`, `pollIntervalMs`; `tasks/get`, `tasks/update`, `tasks/cancel`; a server never returns a task to a client that did not declare the extension; the task must be durably created before the response | M5: long `validate` and `stage_batch` runs return tasks stored in Postgres, bound to the user | S4 |
| P21 | MCP Apps (`io.modelcontextprotocol/ui`): a tool names a `ui://` resource in `_meta.ui.resourceUri`; the view runs in a sandboxed iframe; `_meta.ui.csp` lists allowed origins; a view's tool calls go through the host to the server | a view's calls hit the same gate, so a lock applies to them too | S8 |
| P22 | Skills over MCP is an official extension (`io.modelcontextprotocol/skills`); client support is partial (ChatGPT, fast-agent, Inspector partial on 28 Oct) | M5 Agent Skills bundle ships as files and, where supported, through the extension | S8b |
| P23 | Deprecated in 2026-07-28: Roots, Sampling, Logging, HTTP+SSE transport, DCR | none of them are used | S2 |

## 3. How the clients sign in today

| Client | Registration | Redirect | Notes | Source |
|---|---|---|---|---|
| claude.ai, Desktop, mobile, Cowork | CIMD only when the AS advertises `client_id_metadata_document_supported: true` **and** `none` in `token_endpoint_auth_methods_supported`, else DCR | `https://claude.ai/api/mcp/auth_callback` | one client for all hosted surfaces; needs `401` to start sign-in, ignores `WWW-Authenticate` on `200`; first `authorization_servers` entry only; 10 s discovery and token timeouts, 30 s refresh; refreshes on `401` and 5 minutes before expiry; caches discovery about 5 minutes; egress `160.79.104.0/21`; static headers in beta for some organisations | S6 |
| Claude Code | its own CIMD `https://claude.ai/oauth/claude-code-client-metadata` | loopback `http://localhost/callback` and `http://127.0.0.1/callback` on any port | port-agnostic matching needed (Neon does it, MCP-0) | S6, MCP-0 X3 |
| Claude, lazy authentication | public tools before sign-in, `401` on a protected tool call starts sign-in inline | as above | not needed: the owner removed anonymous access (27 Oct 2026), so every tool needs sign-in and the first call already gets the `401` | S6b |
| ChatGPT | CIMD preferred when available (`https://chatgpt.com/oauth/client.json` when the AS returns `iss`, else a per-callback document), DCR, or a predefined client; PKCE S256 required | stable `https://chatgpt.com/connector_platform_oauth_redirect` when `iss` is returned, else `https://chatgpt.com/connector/oauth/{callback_id}` | token auth `none` or `private_key_jwt`; per-tool `securitySchemes` (`noauth`, `oauth2`); a tool-level challenge needs `isError: true` plus `_meta["mcp/www_authenticate"]`; page undated | S7 |
| VS Code (Copilot) | reported to complete OAuth with CIMD (third party, 31 Jul 2026); a manual `oauth.clientId` exists | not confirmed | **not confirmed on a Microsoft page**; MCP-PK checks | S11 |
| Cursor | no source found | | **not confirmed**; PAT fallback | S11 |
| MCP Inspector 2.13.0 | OAuth flow and a CLI mode for CI | localhost | Node 22.19 or newer | S21, npm |

## 4. Neon Managed Better Auth

| # | Fact | Consequence | Source |
|---|---|---|---|
| N1 | Scopes are fixed (`openid profile email offline_access`); "scopes, token lifetimes, and other provider options aren't configurable" | permissions live in our database | S9 |
| N2 | Documented access-token claims: `aud`, `client_id`, `scope`, `exp`, `sub` (MCP-0 also saw `iss`, `azp`, `sid`, `jti`, `typ at+jwt`); **no custom or role claims, no hooks** | role lookup from `sub` per call; never read a role from a token | S9, MCP-0 X4 |
| N3 | Access JWT 1 hour; refresh 30 days, rotating; a 30 s reuse window applies to every client on the branch once `mcp.resource` is set | a level change cannot wait for token expiry: per-call grant check | S9 |
| N4 | Consent is remembered per client, scopes and resource; CIMD and DCR clients cannot skip consent; Neon shows consent again only for new scopes or a new resource | our level is chosen on our page; revoke must also delete Neon's consent (auth 14.6.3) | S9 |
| N5 | No server-side revocation endpoint; deleting or disabling a client or removing a resource does not revoke issued tokens | our grant check is the only switch (MCP-0 X7) | S9 |
| N6 | `aud` may also contain the userinfo URL: check membership, not equality; all branches share signing keys: pin `iss` | as auth 5 | S9 |
| N7 | Login and consent pages are ours; origins must be trusted domains; `oauth_query` passed back unchanged; 100 managed clients, 10 resources per branch; CIMD documents up to 5 KiB; no documented rate limits | as auth 14.8 | S9 |
| N8 | The plugin page no longer calls it a preview ("available to all Managed Better Auth projects"); `@neon/oauth` is still beta (0.3.0 on npm, 22 Oct) | preview risk smaller, our own verifier stays | S9, npm |
| N9 | Neon Auth exposes Better Auth's Admin plugin through its SDK: create and update users, assign roles, ban and unban (ban revokes sessions and stops sign-in), list and revoke sessions, impersonate; the console has "Make admin" | a second role store exists at Neon. Ours (`app_user.role`) stays the only authority for the product; a ban at Neon is a useful extra wall for suspension but does not cut OAuth refresh tokens (MCP-0 X7) | S10 |

## 5. Security guidance

| # | Guidance | Our control | Source |
|---|---|---|---|
| G1 | OWASP MCP Top 10 (2025 edition, Phase 3 beta): MCP01 token mismanagement and secret exposure, MCP02 privilege escalation via scope creep, MCP03 tool poisoning, MCP04 supply chain, MCP05 command injection, MCP06 prompt injection via contextual payloads, MCP07 insufficient authn and authz, MCP08 lack of audit and telemetry, MCP09 shadow MCP servers, MCP10 context injection and over-sharing | mapped one by one in [product-security.md](../../docs/v2/mcp/product-security.md) 4a | S12 |
| G2 | Tool poisoning hides instructions in tool metadata; a **rug pull** changes definitions after review; the recommended mitigation is hashing descriptions and schemas at review time and rejecting a changed hash | definition hash per tool, pinned in the admin panel; a drifted tool is not listed until the owner accepts it (QX18) | S13, S14 |
| G3 | Confused deputy (written for proxy servers): per-client consent stored server-side, consent page names the client, shows the redirect, CSRF protection, `frame-ancestors` | consent page rules of auth 14.6.4; we are not a proxy | S5 |
| G4 | Token passthrough forbidden; validate audience | as P3 | S5 |
| G5 | State handle hijacking: never treat a handle as authentication; bind to `<user_id>:<handle>`; random; expiring | P16 | S5 |
| G6 | Scope minimisation: minimal initial access, step-up on first privileged use, log elevation events | read-only default level, write levels by a separate dialog on our site, every level change in `mcp_grant_event` and `admin_audit` | S5 |
| G7 | CIMD trust policies: allow lists for protected servers; show the client host prominently | allow list of client ids (Q192), host shown on consent | S5 |
| G8 | Localhost redirect impersonation cannot be stopped by CIMD; warn on loopback-only clients | consent banner for Claude Code (auth 14.6.4) | S5 |
| G9 | OWASP "A Practical Guide for Secure MCP Server Development" (16 Feb 2026): secure architecture, strong authn and authz, strict validation, session isolation, hardened deployment | **only the summary page was read; the PDF was not**. MCP-S reads it and records gaps | S12b |
| G10 | Excessive agency (OWASP Top 10 for Agentic Applications, Dec 2025) | **not read**; our answer is levels, previews, approvals on the site, and no governance tools over MCP | S13 (secondary) |

## 6. Mapping app roles to MCP capabilities: the patterns

| Pattern | What it is | Fit for us |
|---|---|---|
| Scopes in the token, server checks scopes | the spec's default; step-up by `insufficient_scope` | **not possible**: Neon has fixed scopes (N1) |
| Role in a custom claim | the IdP stamps the role into the JWT | **not possible** (N2), and stale for an hour even where possible |
| Resource-server lookup per call | the token proves who and which client; the server reads role, grant and policy from its own store inside the request | **chosen**. It is also the only way a role change or a lock applies on the next call |
| Per-client grants with named levels | the user chooses what each connected app may do; deny lists on top | chosen (auth 14), with the owner's global policy over it |
| Tool list per principal | the tool list (the list-tools request) filtered by the effective set | allowed by the spec (P8) and chosen |
| Lazy or mixed auth on one URL | public tools without a token, sign-in on the first protected call (Claude S6b, ChatGPT `securitySchemes` S7) | moot after the owner's decision of 27 Oct 2026: one authenticated endpoint, no anonymous tools |

## 7. Kill switches and flags on serverless: what "next call" can mean

| Mechanism | Takes effect | Needs | Cost on Hobby | Fit |
|---|---|---|---|---|
| Postgres row read per call (in the call's transaction) | the next call whose read starts after the commit | the database up | one indexed read, folded into the grant and quota round trip we already make | **primary** for every lock and pause |
| In-process cache with a TTL | up to the TTL later, per warm instance (Fluid compute keeps instances warm for minutes) | memory | none | rejected: saves nothing, since the quota take already reads Postgres, and makes the bound fuzzy |
| Vercel Global Config | "up to 10 seconds globally"; versioned reads via an injected header, blocking when far behind | a store, a read token, the SDK | 1 store; 100 writes and 100,000 reads a month included | rejected as a policy store: a second source of truth with no RLS and no audit, slow propagation, and a monthly read budget a busy month could burn |
| Vercel Flags SDK over a provider | as the provider | a provider | | not needed at our size |
| Environment variables | after a redeploy (about a minute) | Vercel access, a deploy | free | **second layer**: works when the database is down or suspect |
| Vercel WAF custom rule (deny `/mcp/`) | "instantly", in seconds, no redeploy | Vercel dashboard or API | 3 custom rules on Hobby; 1 rate-limit rule | **panic layer**: cuts traffic before a function runs, when both the database and the code are suspect |

Source: S15 to S19; Fluid compute instance reuse from Vercel's Fluid docs as already cited in auth 2.5.

## 8. Audit and quotas

| Practice | Source | Ours |
|---|---|---|
| Log every tool call with actor, client, tool, result and duration, without secrets (MCP08) | S12; spec tools security considerations (clients SHOULD log tool usage) S3 | `mcp_audit` (no arguments, no results), 30 days then daily counts (Q167) |
| Log elevation events with correlation ids | S5 | `mcp_grant_event`, `admin_audit` (before and after), `request_id` |
| Rate limit per caller and per client, not only per IP | S3, S12 | `quota_bucket` buckets per IP, user, client grant and token; one WAF rule at the edge |
| Make audit tamper-evident for admin changes | general practice; not from a primary MCP source | `admin_audit` is insert-only for the app role; undo is a new row |

## 9. Tool-definition versioning and pinning

| Practice | Source | Ours |
|---|---|---|
| Stable names; new tool name for a breaking change; deprecation window | spec feature lifecycle (12 months for the spec itself) S2; README 6 | name stable; breaking change gets `_v2`; old stays 6 months (README 6) |
| Hash descriptions and schemas; reject a changed hash until reviewed | S13, S14 | `definition_hash` = SHA-256 of canonical JSON of name, title, description, input and output schemas, annotations, `_meta.ui`; pinned per tool in `mcp_tool_policy.pinned_hash` |
| Deterministic list order for client and prompt caching | S3 | registry order |
| The list-changed notification | S3 | not sent (no listen stream); `ttlMs` instead |

## 10. Hosting on Vercel

| Fact | Source |
|---|---|
| Request and response bodies at most 4.5 MB (`413 FUNCTION_PAYLOAD_TOO_LARGE`) | S19 |
| Fluid compute, Hobby: 300 s default and maximum duration; 2 GB, 1 vCPU; concurrency up to 30,000 | S19 |
| Edge runtime must start a response in 25 s and may stream for 300 s | S19 |
| `mcp-handler` 2.3.0 (7 Oct 2026), `@modelcontextprotocol/server` 2.4.0 (23 Oct), `@modelcontextprotocol/sdk` 1.32.2 (stays 2025-11-25), `@modelcontextprotocol/inspector` 2.13.0 (28 Oct), `@modelcontextprotocol/ext-apps` 2.0.4 (27 Oct), `@neon/oauth` 0.3.0 | `npm view`, 28 Oct 2026 |
| WAF custom rules publish without a deploy and apply globally in seconds; Hobby 3 custom rules | S17, S18 |
| Global Config: write propagation up to 10 s; Hobby 1 store, 1 MB, 100 writes and 100,000 reads included | S15, S16 |

## 11. Testing and evals

| Practice | Source | Ours |
|---|---|---|
| MCP Inspector has a CLI mode for CI (list and call tools, JSON out) and negotiates both protocol eras | S21 | contract smoke in T2 against a local build; the UI Inspector for OAuth flows |
| Official conformance suite `modelcontextprotocol/conformance` runs server scenarios against a URL; marked work in progress; 2026-07-28 scenarios only in 0.2 alphas (third-party report) | S22 | run it at T3 per bundle, pinned version, results recorded; never a gate on its own while unstable |
| Layers: deterministic checks every push, behaviour evals with a model on a schedule | S22 (secondary) | T1 and T2 deterministic; evals E1 to E10 at T3 (QX10) |
| Tool-selection evals: does the model pick the right tool per intent | S22 (secondary) | each eval scenario scores the tool sequence; added E9 (a lock mid-task), E10 (export privacy) and E11 (lock honesty) |

## 12. What this changes in our plan

| # | Change | Where |
|---|---|---|
| D0 | One authenticated endpoint `/mcp/`; unauthenticated callers get only the PRM, a minimal `server/discover` and `401` (owner decision; this research supports it: the spec lets lists vary per authorization, and Claude and ChatGPT start sign-in on the `401`) | identity-and-roles 1.1 |
| D1 | Role and suspension are read from `app_user` per call; Neon's admin role is not used for authorization | identity-and-roles 3, 5 |
| D2 | One gate function per call returns identity, role, status, grant, policy and quota in one round trip; no cache on the call path | tool-registry 5 |
| D3 | Three layers of switches: database policy (instant), env (redeploy), WAF rule (seconds, edge) | tool-registry 4, 9 |
| D4 | Locked or disabled tools leave the tool list and answer `not_available` with a reason; `listChanged: false`; private lists `ttlMs: 0` | tool-registry 6 |
| D5 | Definition hash per tool, pinned; drift blocks the tool until accepted (QX18) | tool-registry 3.3, tool-catalogue 4 |
| D6 | ChatGPT joins the allow list after MCP-PK proves Neon accepts its CIMD (QX16); Q-B1's fallback becomes a contingency | identity-and-roles 9, product-packaging 8 |
| D7 | M5 uses the tasks extension for long `validate` and `stage_batch` runs, the skills extension for the Agent Skills bundle, and a per-item `export_trip` | tool-catalogue 7, BUILD-READINESS M5 |
| D8 | No governance tool over MCP: an agent can never read or change locks, grants, roles or the registry | tool-registry 2 |

## 13. Not verified

- VS Code and Cursor OAuth with CIMD against Neon (MCP-PK).
- ChatGPT's CIMD document accepted by Neon (no `private_key_jwt` needed, `none` expected to intersect) (MCP-PK).
- The OWASP practical guide PDF and the OWASP agentic Top 10 text (MCP-S reads both).
- Whether a Vercel WAF custom rule can be kept saved but inactive on Hobby, ready to switch on (O-M7 checks in the
  dashboard).
- Global Config pricing pages disagree (S16 versus the platform limits page); irrelevant since it is not used.
- Neon's real OAuth rate limits (unchanged from MCP-0).

## Sources (all read 28 Oct 2026 unless noted)

- S1 MCP specification 2026-07-28, Authorization: https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization
- S2 MCP specification 2026-07-28, Key changes: https://modelcontextprotocol.io/specification/2026-07-28/changelog
- S3 MCP specification 2026-07-28, Server, Tools: https://modelcontextprotocol.io/specification/2026-07-28/server/tools
- S4 MCP Tasks extension overview: https://modelcontextprotocol.io/extensions/tasks/overview ; repository https://github.com/modelcontextprotocol/ext-tasks
- S5 MCP Security Best Practices (2026-07-28): https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices
- S6 Claude docs, Authentication for connectors (undated page): https://claude.com/docs/connectors/building/authentication
- S6b Claude docs, Lazy authentication for MCP servers: https://claude.com/docs/connectors/building/lazy-authentication
- S7 OpenAI Apps SDK, Authentication (undated page): https://developers.openai.com/apps-sdk/build/auth
- S8 MCP Apps overview: https://modelcontextprotocol.io/extensions/apps/overview ; extensions overview https://modelcontextprotocol.io/docs/extensions/overview
- S8b Extension support matrix: https://modelcontextprotocol.io/extensions/client-matrix
- S9 Neon docs, OAuth Provider plugin (undated): https://neon.com/docs/auth/guides/plugins/oauth-provider
- S10 Neon docs, Admin plugin: https://neon.com/docs/auth/guides/plugins/admin ; Better Auth Admin plugin https://www.better-auth.com/docs/plugins/admin (search summary; the Neon page's SDK method names were not confirmed)
- S11 Third-party: Speakeasy changelog 1.1.0 (31 Jul 2026) https://www.speakeasy.com/changelog/release/1.1.0 ; Zuplo, DCR not supported https://zuplo.com/learn/mcp/errors/dynamic-client-registration-not-supported ; WorkOS on CIMD https://workos.com/blog/client-id-metadata-documents-cimd-oauth-client-registration-mcp
- S12 OWASP MCP Top 10 project page: https://owasp.org/www-project-mcp-top-10/
- S12b OWASP GenAI, A Practical Guide for Secure MCP Server Development (16 Feb 2026; summary page only): https://genai.owasp.org/resource/a-practical-guide-for-secure-mcp-server-development/
- S13 Third-party summaries of tool poisoning and rug pulls (secondary): https://mcp.directory/blog/mcp-security-200000-exposed-servers-owasp-mcp-top-10-cves ; https://www.softwareseni.com/tool-poisoning-rug-pulls-and-the-mcp-attack-classes-conventional-scanners-miss
- S14 Cloud Security Alliance, MCP Security: Tool Poisoning and the Confused Deputy Problem (16 May 2026): https://labs.cloudsecurityalliance.org/research-rb/csa-whitepaper-mcp-security-agentic-attack-surface-20260516/
- S15 Vercel Global Config (last updated 17 Aug 2026): https://vercel.com/docs/global-config ; rename https://vercel.com/changelog/edge-config-is-now-global-config
- S16 Vercel Global Config limits (last updated 29 Jul 2026): https://vercel.com/docs/global-config/global-config-limits
- S17 Vercel WAF: https://vercel.com/docs/vercel-waf ; rate limiting https://vercel.com/docs/security/vercel-waf/rate-limiting
- S18 Vercel changelog, custom firewall rules propagate without a deploy: https://vercel.com/changelog/instantly-redirect-traffic-using-custom-vercel-firewall-rules
- S19 Vercel Functions limits (last updated 24 Aug 2026): https://vercel.com/docs/functions/limitations
- S20 `vercel/mcp-handler`: https://github.com/vercel/mcp-handler ; versions from `npm view`, 28 Oct 2026
- S21 MCP Inspector docs (2026-07-28): https://modelcontextprotocol.info/docs/2026-07-28/tools/inspector/ and https://modelcontextprotocol.io/docs/draft/tools/inspector
- S22 MCP conformance repository: https://github.com/modelcontextprotocol/conformance ; third-party guide https://qaskills.sh/blog/mcp-official-conformance-suite-server-guide-2026 ; evaluation layers https://techsy.io/en/blog/mcp-evaluation-guide
- MCP-0 spike, 25 Oct 2026: [../runs/MCP-0-spike.md](../runs/MCP-0-spike.md)

## Change log

- 28 Oct 2026: written (travel-planner, Opus 5.5) on `public/MCP-PLAN` for the owner's direction of 27 Oct 2026.
