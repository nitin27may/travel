# MCP-0: Neon's OAuth provider as the MCP authorization server, child branch, from localhost

Run id: `MCP-0-spike` · 25 Oct 2026, 22:13 to 23:30 UTC · model: Opus 5.5 (`claude-opus-5-5`) · lane: spike, no product
code · plan: [auth-and-sign-in.md](../../docs/v2/mcp/auth-and-sign-in.md) section 8 (MCP-0) and section 13 (results).

Scope: Neon project `damp-queen-64719841`, child branch `br-damp-breeze-b41mtvn5` only. The production branch
`br-soft-glade-b4mkqyvd` got read-only `get`/`list` calls and one public `GET` of its JWKS. Calls went to the child's
issuer (written `<ISSUER>` below: `https://<host>.neonauth.c-6.us-east-2.aws.neon.tech/neondb/auth`; `<AUTH_ORIGIN>`
is its origin) and to throwaway code on `http://localhost:3000`. Secrets, tokens and the test user's password stayed in
mode-600 files in the session scratchpad. Tokens, emails, codes and session ids are redacted; JWKS key ids are public.
**Zero emails**: one password user on `example.com` (a reserved domain that never delivers), child flags send nothing on
sign-up, and no code, reset or link was requested.

## Summary

- **Neon's OAuth provider works as our MCP authorization server, with conditions.** A real MCP client
  (`@modelcontextprotocol/sdk` 1.32.1) went from a `401` on a local `/mcp/private/` to a verified JWT and a tool call:
  RFC 9728 metadata, Neon's discovery, a client ID metadata document (CIMD), PKCE S256 with `resource`, sign-in and
  consent on our own pages through our `/api/auth` proxy in Chromium, the token exchange, then the MCP
  list-tools and call-tool requests.
- **Claude's own CIMD documents exist and Neon accepts them**: `https://claude.ai/oauth/mcp-oauth-client-metadata`
  ("Claude", callback `https://claude.ai/api/mcp/auth_callback`) and `https://claude.ai/oauth/claude-code-client-metadata`
  ("Claude Code", loopback callbacks). A full flow under Claude Code's client id issued a JWT.
- **Discovery works only by appending** to the issuer (`<ISSUER>/.well-known/openid-configuration` and
  `.../oauth-authorization-server`); both RFC 8414 path-insertion URLs are 404. The SDK falls through to the third URL;
  Claude was not observed.
- **Access tokens**: EdDSA, `typ at+jwt`, `iss` = the issuer exactly, `aud` = `["http://localhost:3000/mcp/private/",
  "<ISSUER>/oauth2/userinfo"]`, `sub` = `neon_auth.user.id`, `client_id` = the CIMD URL, 3600 s. Refresh tokens are
  opaque (32 characters), last 30 days, rotate, with a 30 s reuse window; a late reuse revokes the newest token too.
- **Revocation**: `/oauth2/revoke` works for a public client with `client_id` alone; access JWTs cannot be revoked.
  **Signing out, revoking all sessions and deleting the consent do not revoke refresh tokens.** Our own grant check
  (`mcp_client_grant.revoked_at`) is the only kill switch we control.
- **The trailing slash matters**: entering `/mcp/private` (no slash), the SDK follows Next's 308 and then refuses,
  because the advertised resource `/mcp/private/` does not match the entered URL.
- **The 2026-07-28 protocol needs the v2 SDK.** `@modelcontextprotocol/sdk` 1.32.x speaks up to 2025-11-25.
  `mcp-handler` 2.3.0 needs `@modelcontextprotocol/server` ^2 (2.4.0 today) and serves both protocol eras.
- **Production unchanged** (diff of the start and end `get` output). The child's plugin config was not changed (read
  back equal at the end). The test user was deleted, along with its sessions, consents and tokens.

## Child configuration (read back, not changed)

`neon api /projects/damp-queen-64719841/branches/br-damp-breeze-b41mtvn5/auth/plugins/oauth-provider`, at 22:14 and
again at the end:

```json
{"enabled": true, "login_page": "http://localhost:3000/sign-in/", "consent_page": "http://localhost:3000/oauth/consent/",
 "mcp": {"resource": "http://localhost:3000/mcp/private/", "dynamic_registration": false, "client_id_metadata_documents": true},
 "resources": []}
```

Production at the start and end: `enabled: false`, no `login_page`, `mcp: {dynamic_registration: false,
client_id_metadata_documents: true}` with no resource, and trusted domain `https://travel-beta-tan.vercel.app`. The child
has no trusted domain, and `allow_localhost` is true on both.

## Spike set-up (throwaway, scratchpad only)

| Piece | What it did |
|---|---|
| `spike-app.mjs` on `localhost:3000` (both loopback families) | `/sign-in/` and `/oauth/consent/` (minimal pages), `/.well-known/oauth-protected-resource/mcp/private/` (PRM), `/mcp/private/` (minimal JSON-RPC: `initialize`, list tools, call tool `whoami`), a reverse proxy of `/api/auth/*` to `next dev`, and a 308 for every path without a trailing slash, like Next |
| `next dev --port 3100` in the worktree `web/` | the repo's real `/api/auth/[...path]` route (main, no guard), env file with **child values only** (child `NEON_AUTH_BASE_URL`, a fresh random cookie secret); `NEXT_DIST_DIR=.next-mcp0` |
| `cimd.mjs` on `127.0.0.1:8790` plus a cloudflared quick tunnel | served `/client*.json` CIMD documents (client id = the document's own https URL, `token_endpoint_auth_method: none`, redirects `http://localhost/callback` and `http://127.0.0.1/callback`) |
| `verify.mjs` | offline verifier with `node:crypto` only: alg EdDSA only, `kid` in JWKS, Ed25519 signature, `iss` exact, `aud` contains the resource, `exp`/`nbf` with 60 s skew, `client_id` present |
| `flow.mjs` | the authorization code flow with the script as the browser (direct to the issuer, or through the proxy) |
| `sdk-e2e.mjs` | SDK 1.32.1 client (from `core/node_modules`, nothing installed) with a CIMD `OAuthClientProvider`; Playwright Chromium (from `web/node_modules`) fills our pages |

**Tunnel incident (fixed in 2 minutes).** The first `cloudflared tunnel --url` run read the owner's
`~/.cloudflared/config.yml` and credentials file. It created a quick tunnel, but it merged the owner's ingress rules (one
hostname to `localhost:4200`, everything else 404), so the document was not served, and for about two minutes a connector
ran with the owner's tunnel credentials. It was stopped by PID at 22:21. The tunnel then ran with an empty config
(`cloudflared --config <empty file> tunnel --url ...`) and served the document. Rule for later spikes: always pass an
empty `--config` to a quick tunnel on this Mac. The tunnel and the document server were stopped at 22:34. Two other
cloudflared processes on the machine (another session's quick tunnel and the owner's token tunnel) were not touched.

## X1. The plugin switch

`GET .../auth/plugins/oauth-provider` 200 with the body above; `neon neon-auth plugins list` shows `oauth_provider`
enabled on the child and disabled on production. **PASS.**

## X2. Discovery documents

| Request | Status | Notes |
|---|---|---|
| `GET <ISSUER>/.well-known/oauth-authorization-server` | 200 `application/json`, `cache-control: public, max-age=15` | body below |
| `GET <ISSUER>/.well-known/openid-configuration` | 200 | same body |
| `GET <AUTH_ORIGIN>/.well-known/oauth-authorization-server/neondb/auth` (RFC 8414 path insertion) | 404 `Route ... not found` | |
| `GET <AUTH_ORIGIN>/.well-known/openid-configuration/neondb/auth` | 404 | |
| `GET <ISSUER>/.well-known/jwks.json` | 200, one key `{"alg":"EdDSA","crv":"Ed25519","kty":"OKP","kid":"cb73dace-..."}` | |
| `GET <ISSUER>/jwks` | 404 | |

Metadata fields that matter (verbatim values):

- `issuer`: `<ISSUER>`.
- **`client_id_metadata_document_supported`: true.**
- **`token_endpoint_auth_methods_supported`: `["none","client_secret_basic","client_secret_post","private_key_jwt"]`.**
- `code_challenge_methods_supported`: `["S256"]`.
- `authorization_response_iss_parameter_supported`: true.
- `scopes_supported`: `["openid","profile","email","offline_access"]`.
- `grant_types_supported`: `["authorization_code","client_credentials","refresh_token"]`. The guide says
  `client_credentials` is rejected; public clients get "public clients cannot use the client_credentials grant" upstream.
- `revocation_endpoint`, `introspection_endpoint`, `userinfo_endpoint` and `end_session_endpoint` are present.
  `revocation_endpoint_auth_methods_supported` lists no `none`, yet revocation works for a public client (X7).
- `registration_endpoint` is absent (DCR off). `dpop_signing_alg_values_supported` and back-channel logout are
  advertised. `id_token_signing_alg_values_supported`: `["EdDSA"]`.

**PASS**: both fields Claude needs for CIMD are present. Clients must reach the third discovery URL (OIDC path
appending). SDK 1.32.1 does: its trace was 404, 404, 200.

## X3. Authorization code with PKCE, a CIMD client

Neon requires an `https` client id on port 443 with a hostname (guide, Limitations). Without the tunnel:
`client_id=http://localhost:8790/client.json` gives `invalid_client` "client_id is required" (it is not taken as a
URL). With the tunnel, Neon fetched the document (user agent `Neon-Auth-CIMD/1.0`; 51 fetches over about 20 flows and
probes, so it does not cache across steps for long).

Script as the browser, direct to the issuer (`flow.mjs --mode direct`):

| Step | Result |
|---|---|
| 1 `GET <ISSUER>/oauth2/authorize?response_type=code&client_id=<TUNNEL>/client.json&redirect_uri=http://localhost:8765/callback&scope=openid profile email offline_access&state&code_challenge&S256&resource=http://localhost:3000/mcp/private/` | a browser (`Accept: text/html`, curl) gets 302 to `http://localhost:3000/sign-in/?<query>`; a `fetch` without navigation headers gets 200 `{"redirect":true,"url":...}` with the same URL. The query carries the original parameters plus `exp`, `ba_iat`, `ba_param` (x11) and `sig` |
| 2 `POST <ISSUER>/sign-in/email` `{email, password, oauth_query}` with `Origin: http://localhost:3000` | 200 `{"redirect":true,"url":"http://localhost:3000/oauth/consent/?..."}` and the session cookie |
| 3a `GET <ISSUER>/oauth2/public-client?client_id=...` | 200 `{"client_id":"<TUNNEL>/client.json","client_name":"MCP-0 spike client","client_uri":"<TUNNEL>/","redirect_uris":[]}`: **`redirect_uris` is empty for CIMD clients**, so the consent page must take the redirect host from the query's `redirect_uri` |
| 3b `POST <ISSUER>/oauth2/consent` `{accept:true, oauth_query}` | 200 `{"redirect":true,"url":"http://localhost:8765/callback?code=...&state=...&iss=..."}` |
| 4 callback | `code`, `state` (matches), `iss` (equals `<ISSUER>`, RFC 9207). The document lists `http://localhost/callback`; port 8765 matched (loopback, any port) |
| 5 `POST <ISSUER>/oauth2/token` (form: `authorization_code`, code, redirect_uri, client_id, code_verifier, resource) | 200 `{access_token, expires_in:3600, expires_at, token_type:"Bearer", refresh_token, scope:"openid profile email offline_access", id_token}` |
| 7 the same code again | 400 `{"error":"invalid_grant","error_description":"invalid code"}`, **and the refresh token issued from that code is deleted** (`oauthRefreshToken` 5 inserts, 5 deletes; later refresh "session not found") |

Deny (`accept:false`, client3): callback `error=access_denied`, `error_description=User denied access`, `state`, `iss`.

Real MCP client (`sdk-e2e.mjs`, SDK 1.32.1 plus Playwright Chromium on our pages, proxy mode), 22:29 UTC:

```
1 first connect: UnauthorizedError
2 authorize URL: <ISSUER>/oauth2/authorize, client_id <TUNNEL>/client-sdk.json, resource http://localhost:3000/mcp/private/,
  scope "openid profile email offline_access", S256
3 browser at /sign-in/ -> filled -> 4 consent page shows scope, resource, redirect host localhost:8766, client name -> Allow
5 callback: code, iss (ok)
6 tokens saved: access_token, id_token, token_type, expires_in 3600, scope, refresh_token, issuer
7 list tools: ["whoami"]
8 call tool whoami: sub (36 chars), client_id <TUNNEL>/client-sdk.json, aud [MCP URL, userinfo], scope
SDK request trace:
POST /mcp/private/ -> 401 (WWW-Authenticate: Bearer resource_metadata=".../.well-known/oauth-protected-resource/mcp/private/")
GET /.well-known/oauth-protected-resource/mcp/private/ -> 200
GET <AUTH_ORIGIN>/.well-known/oauth-authorization-server/neondb/auth -> 404
GET <AUTH_ORIGIN>/.well-known/openid-configuration/neondb/auth -> 404
GET <ISSUER>/.well-known/openid-configuration -> 200
(finishAuth) GET /.well-known/oauth-protected-resource/mcp/private -> 308, then .../private/ -> 200; the same discovery
POST <ISSUER>/oauth2/token -> 200
POST /mcp/private/ -> 200 (initialize), 202 (initialized), GET -> 405 (no SSE stream), POST -> 200, POST -> 200
```

Claude's documents (fetched 22:31, 200 `application/json`, no redirects):

| Client id | Name | Redirect URIs | Auth | Grant types | Neon |
|---|---|---|---|---|---|
| `https://claude.ai/oauth/mcp-oauth-client-metadata` | Claude | `https://claude.ai/api/mcp/auth_callback` | none | authorization_code, refresh_token, `urn:ietf:params:oauth:grant-type:jwt-bearer` | authorize: 302 to our login page (accepted; the flow was stopped there) |
| `https://claude.ai/oauth/claude-code-client-metadata` | Claude Code | `http://localhost/callback`, `http://127.0.0.1/callback` | none | authorization_code, refresh_token | a full flow with redirect `http://localhost:53682/callback`: consent showed "Claude Code", `client_uri` `https://claude.ai`; token 200, JWT |

**PASS.**

## X4. Token contents, `sub`, refresh

Access token header `{"typ":"at+jwt","alg":"EdDSA","kid":"cb73dace-65c9-40cd-ba1e-41aa3240eaaa"}`. Claims:
`sub`, `aud` `["http://localhost:3000/mcp/private/","<ISSUER>/oauth2/userinfo"]`, `client_id` and `azp` (the CIMD URL),
`scope` `"openid profile email offline_access"`, `sid` (the Better Auth session id), `iss` `<ISSUER>`, `iat`, `exp`
(iat + 3600), `jti`. There is no `nbf`, `name` or `email`. ID token: EdDSA, `aud` = the client id, claims `auth_time acr
at_hash iss sub aud iat exp`. Userinfo with the JWT: 200 `sub name given_name family_name email email_verified`.

`sub` equals the `id` that sign-up returned and `neon_auth.user.id` (uuid), in all 6 token sets. Our `app_user.id` and
`app.user_id` are text, so the mapping is the uuid's text form.

Refresh (`refresh.mjs`, client1, a token never touched by a code replay):

| # | Request | Result |
|---|---|---|
| A | refresh R1, no `resource` | 200, new refresh R2 (32 characters), new JWT with the same `aud`, 3600 s |
| B | R1 again within 30 s | 200, **identical response** to A (the reuse window) |
| C | R1 again after 35 s | 400 `invalid_grant` "invalid refresh token" |
| D | R2 after C | 400 `invalid_grant` "session not found": the late reuse revoked the whole family |
| E | R2 with `resource=http://localhost:3000/mcp/` | 400 (family revoked) |

DB: `oauthRefreshToken` rows have `expiresAt - createdAt` = 30 days and carry `sessionId`. **PASS.** Caution for client
code: a client that loses the rotated token and retries the old one after 30 s is logged out of every token of that
client.

## X5. Offline verification and refusals

`rs-tests.mjs`, verifier pinned to `iss` = `<ISSUER>`, resource `http://localhost:3000/mcp/private/`:

| Case | Offline | HTTP `POST /mcp/private/` |
|---|---|---|
| good token | ok | 200 `initialize` result |
| no `Authorization` | n/a | 401, `WWW-Authenticate: Bearer resource_metadata="http://localhost:3000/.well-known/oauth-protected-resource/mcp/private/"` |
| garbage | n/a | 401 `Bearer error="invalid_token", resource_metadata=...` |
| opaque token (flow without `resource`) | refused: not a JWT | 401 invalid_token (userinfo also refuses it: 401 "Invalid access token") |
| wrong aud: verifier for `/mcp/` | refused: aud | |
| wrong aud: verifier for `/mcp/private` (no slash) | refused: aud | |
| expired: clock at exp + 61 s | refused: expired | |
| clock at exp + 59 s | ok (60 s skew) | |
| verifier pinned to the production issuer | refused: iss | |
| tampered `sub` | refused: bad signature | 401 |
| `alg: none`, `alg: HS256` | refused: alg | |
| browser session JWT from `GET /api/auth/token/` (our proxy, same user) | refused: iss | 401 |

The session JWT: header `{"alg":"EdDSA","kid":"cb73dace-..."}` (**the same key**), `iss` and `aud` both
`<AUTH_ORIGIN>` (no `/neondb/auth` path), the full user object in the claims (`name email emailVerified role banned
...`), 900 s lifetime. With `iss` relaxed to the origin it still fails on `aud`; with `aud` relaxed too it passes the
signature and is stopped only by the `client_id` check. So signature-only checks would accept it: `iss`, `aud` and
`client_id` are all required.

A token past its real `exp` was not waited for (46 minutes): the expiry check is our verifier's own logic, covered by the
moved clock above.

**Production JWKS**: one Ed25519 key with a **different `kid`** from the child's. Neon's guide says all branches share
signing keys; in this project they differ today (cause unknown; Neon could rotate or unify keys later). Pinning `iss`
stays required either way.
**PASS.**

## X6. Our `/api/auth` proxy

`web/app/api/auth/[...path]/route.ts` on main (no guard) under `next dev`, with no tracked file edited. The pages called
`/api/auth/<path>/`, with the slash because of `trailingSlash`; the slashless form gets a 308.

| Request through the proxy | Result |
|---|---|
| `POST /api/auth/sign-in/email/` with `oauth_query` | 200 `{"redirect":true,"url":<consent page or callback>}`, sets `__Secure-neon-auth.session_token` and `__Secure-neon-auth.local.session_data` on localhost |
| `GET /api/auth/oauth2/public-client/?client_id=...` | 200, as direct |
| `POST /api/auth/oauth2/consent/` accept and deny | 200 `{redirect, url}`; the code or `access_denied` |
| `POST /api/auth/oauth2/continue/` `{selected:true, oauth_query}` with an existing session | 200 `{redirect, url}` to the consent page |
| `GET /api/auth/oauth2/get-consents/` | 200, the user's consents (`clientId userId referenceId resources requestedUserInfoClaims scopes createdAt updatedAt id`) |
| `GET /api/auth/oauth2/get-clients/`, `POST /api/auth/oauth2/create-client/` as a normal user | 401 both (users cannot create clients) |
| `GET /api/auth/token/` | 200, the session JWT (X5) |

Consent was skipped on a second authorization for the same client, scopes and resource, as the guide says. The EML-1
guard (branch `public/EML-1` at 319d412, read, not run): `oauth2/*` is not in its route table, so it passes through
untouched. `sign-in/email` re-serialises the whole body, so `oauth_query` survives, and returns Neon's success response
unchanged, so `{redirect, url}` survives. **PASS on main; by reading on EML-1.**

## X7. Revocation

`revoke.mjs` and `consents.mjs`, each on its own client so the tests do not interfere:

| # | Action | Result |
|---|---|---|
| A1 | `POST /oauth2/revoke` `token=<refresh>&token_type_hint=refresh_token&client_id=<CIMD URL>` | 200, empty |
| A2 | the same without `client_id` | 401 `invalid_client` "missing required credentials" |
| A3 | revoke the access JWT | 400 `unsupported_token_type` "JWT access tokens are self-contained and cannot be revoked server-side" |
| A4 | refresh after A1 | 400 `invalid_grant` "invalid refresh token": **revoked** |
| A5 | the access JWT after A1 | still verifies offline (lives to `exp`) |
| B1-B2 | sign out of the session that granted the token, then refresh | sign-out 200; **refresh 200** |
| C1-C3 | `POST /api/auth/revoke-sessions/` (every session), then refresh two clients | 200 `{"status":true}`, sessions 0; **both refresh 200**; `oauthRefreshToken.sessionId` set to null |
| D | `POST /api/auth/oauth2/delete-consent/` `{id}`, then refresh | 200, consent row gone; **refresh 200** |
| E | code replay (X3 step 7) | refresh tokens from that code deleted |
| F | delete the user (cleanup) | user, sessions, consents and refresh tokens gone (FK cascade on `userId`) |

The Neon API has no endpoint to revoke a user's OAuth tokens, and `GET .../auth/oauth-provider/clients` lists managed
clients only (CIMD clients do not appear, although `neon_auth."oauthClient"` caches them). **PASS** for the holder
revoking its own refresh token. **We cannot revoke from the server side**: our grant check is the kill switch, and
"Revoke" on Connected apps should also call `delete-consent`, so a re-authorization shows our consent page again.

## X8. Trailing slash

`next dev` (main, `trailingSlash: true`): `POST /mcp/private` with a JSON body and a bearer token gets
`308 Permanent Redirect`, `location: /mcp/private/` (relative) and `Refresh: 0;url=/mcp/private/`. The query is kept
(`/mcp/private/?x=1`). The same holds for `/api/auth/ok`.

| Client | URL entered | Result |
|---|---|---|
| SDK 1.32.1 | `http://localhost:3000/mcp/private/` | works (X3) |
| SDK 1.32.1 | `http://localhost:3000/mcp/private` | `fetch` follows the 308 for the POST (method and body kept), gets the 401 and the PRM, then **throws** `Protected resource http://localhost:3000/mcp/private/ does not match expected http://localhost:3000/mcp/private (or origin)` |
| Claude Code, claude.ai | either | not run (OWNER NEEDED at MCP-E). Claude docs C3: `resource` must equal the entered URL exactly, so the slashless form would fail the same way |

The SDK's rule (`checkResourceAllowed`) accepts an entered URL when the advertised resource's path is a prefix of it,
so the slash form must be the one that users enter. **PASS with a rule**: publish, configure and document only
`.../mcp/private/` and `.../mcp/`.

## X9. Neon's limits and errors on the OAuth endpoints (a few requests only)

| # | Request | Result |
|---|---|---|
| E1 | authorize with `client_id=http://localhost:8790/client.json` | `<ISSUER>/error` `invalid_client` "client_id is required" |
| E2 | an https client id with no document | 400 `invalid_client` "Metadata document fetch returned HTTP 404" |
| E3 | `redirect_uri` not in the document | `invalid_redirect` "invalid redirect uri" (Neon's error page, not the client) |
| E4 | `resource=http://localhost:3000/mcp/` | 400 `invalid_target` "requested resource http://localhost:3000/mcp/ is not configured" |
| E5 | no `code_challenge` | to the callback: `invalid_request` "pkce is required for public clients" |
| E6 | `code_challenge_method=plain` | `invalid_request` "code_challenge_method must be one of: S256" |
| E7 | no `resource` | accepted (to login); the token is opaque (X5) |
| E8 | sign-in with an `oauth_query` whose `scope` was changed | 400 `{"error":"invalid_signature"}`, no cookie |
| E9 | consent with `Origin: https://evil.example` and a session | 403 `INVALID_ORIGIN`; with no `Origin` 403 `MISSING_OR_NULL_ORIGIN`; with no session 401 |
| R1 | 8 parallel bad code exchanges | 400 x8 `invalid_grant`, no rate-limit or retry headers |
| R2 | 8 sequential revokes of an unknown token | 400 x8, no limiter headers |

No limiter was met on `/oauth2/token` or `/oauth2/revoke` at 8 requests. EML-0 found one on `/sign-in/email` (429 on
the 5th wrong password, `x-retry-after: 10`), which applies to the OAuth login too. Neon publishes no OAuth limits, and
no load test was run. **PASS** (no blocking limit at normal use; real limits unknown).

## Packages (spec 2.6 X7)

`npm view` and `npm pack` into the scratchpad only (nothing installed in the repo), 25 Oct:

| Package | Version | Protocol | Notes |
|---|---|---|---|
| `@modelcontextprotocol/sdk` | 1.32.1 in `core/`, 1.32.2 latest | `LATEST_PROTOCOL_VERSION = '2025-11-25'`; supported down to 2024-10-07 | no `Mcp-Method` header code; client has CIMD (`clientMetadataUrl`), discovery fallbacks, PKCE, `resource` |
| `@modelcontextprotocol/server` / `client` / `core` | 2.4.0 | 2026-07-28 (stateless envelope, `server/discover`, `Mcp-Method` and `Mcp-Name` handling) plus the 2025 versions | the v2 split packages |
| `mcp-handler` | 2.3.0 | "serves the 2026-07-28 MCP specification natively while transparently falling back to stateless Streamable HTTP for 2025-era clients" (README) | **peer `@modelcontextprotocol/server` ^2.0.0** (not the 1.x SDK); `withMcpAuth`, `protectedResourceHandler`; 1.x options (`basePath`, `redisUrl`, `maxDuration`, SSE) removed |
| `@neon/oauth` | 0.3.0 | | peers `@modelcontextprotocol/sdk` >=1.20 (the 1.x line); deps `jose` 6.2.5, `openid-client` 6.8.8 |
| `@neondatabase/auth` | 0.7.0-beta (in `web/`) | | deps `better-auth` 1.7.6 and `@better-auth/oauth-provider` 1.7.6 |

## Not verified

- Claude Code's own CLI sign-in, the MCP Inspector and the claude.ai connector (interactive; claude.ai cannot reach
  localhost). Neon accepts both Claude client documents, and a full flow under Claude Code's client id passed.
- Claude's discovery order against a path issuer (the SDK's order works).
- Neon's real rate limits on the OAuth endpoints.
- Why production's JWKS `kid` differs from the child's.
- The EML-1 guard in a running server (read only).

## Clean-up

| Item | State at the end |
|---|---|
| Child plugin config | unchanged: read back equal to the start |
| Production | `get`/`list` output equal at start and end |
| Test user | deleted (`neon neon-auth user delete`). `neon_auth.user`, `session`, `account`, `oauthConsent`, `oauthRefreshToken` and `oauthAccessToken` hold 0 rows; a refresh with the Claude Code token set then gets `invalid_grant`. `verification` holds one row with a random identifier (no address), created 22:33:26 during the X9 probes and expiring 22:43:26: OAuth request state, not a code |
| Cached CIMD client rows in `neon_auth."oauthClient"` | left: 12 rows (10 on the dead tunnel host: `client*.json` and the SDK documents; 2 for Claude and Claude Code). They are not listed by the Neon API and hold no user data; the tunnel documents can no longer be fetched |
| Servers | the tunnel, the CIMD server, the spike app and `next dev` were stopped by PID. The worktree's `web/tsconfig.json` (edited by `next dev`) was restored and `web/.next-mcp0/` removed |
| Emails | 0 (no code, reset or verification-code row was written; sign-up wrote no `verification` row) |
