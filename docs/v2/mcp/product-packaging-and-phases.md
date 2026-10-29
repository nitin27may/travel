# MCP product: installation per client, phases, bundles, hours, dependencies and conflicts

Part of [product.md](product.md). Status: spec only, planned (26 Oct 2026). Models per CLAUDE.md "Model by task complexity":
shared contracts, privacy and security are Opus; well-specified builds are Sonnet; reviews are never below the writer.

> **28 Oct 2026:** sections 1 to 4 rewritten for the owner's decision of 27 Oct 2026 (no anonymous endpoint; README
> decision record, PLAN R-291) and the build-ready plan. The task-by-task table with owned files, gates and owner steps is
> [BUILD-READINESS.md](BUILD-READINESS.md) 2; this page keeps the summary and must match it.

## 1. Endpoints

| Endpoint | URL (until a custom domain, Q148) | Who |
|---|---|---|
| Remote MCP | `https://travel-beta-tan.vercel.app/mcp/` | signed-in accounts allowed MCP (OAuth or PAT); unauthenticated callers get only the sign-in handshake ([identity](identity-and-roles.md) 1.1) |
| Local stdio | `node core/bin/mcp.ts` | the owner, in the repository (unchanged) |

## 2. Installation per client (verified in MCP-PK on the child branch, then MCP-E on production)

Every path starts with signing in; there is no anonymous variant.

| Client | How | Views | Notes |
|---|---|---|---|
| claude.ai, Claude Desktop, Claude mobile | Settings, Connectors, add custom connector, `https://travel-beta-tan.vercel.app/mcp/`; sign in with our account; consent page; pick the level on Connected apps | yes on web and desktop (MCP Apps) | one client id across surfaces (auth 14.10) |
| ChatGPT | developer mode (the apps directory in M5) with the same URL and OAuth through CIMD (`https://chatgpt.com/oauth/client.json`) | yes (Apps SDK on MCP Apps); text-only fallback on Android | **only after MCP-PK proves Neon accepts ChatGPT's CIMD and the owner lists it (QX16); if it cannot, ChatGPT has no MCP access** (ChatGPT has no personal-token path for a user's own connector). Permission modes map onto our annotations |
| Claude Code | `claude mcp add --transport http travel https://travel-beta-tan.vercel.app/mcp/` then `/mcp`, Authenticate (OAuth in the browser), or with `--header "Authorization: Bearer <PAT>"` from the keychain | no (terminal) | the `travel` plugin (M3) bundles the server entry and the three generated skills |
| VS Code (Copilot), Cursor, Goose | `mcp.json` entry `{ "type": "http", "url": "https://travel-beta-tan.vercel.app/mcp/" }`; OAuth where it works against Neon (MCP-PK), else a PAT header | where the host supports MCP Apps | |
| Any SDK script | Streamable HTTP, protocol 2026-07-28 with the 2025-11-25 fallback, PAT | no | `server/discover` answers versions and capabilities without a token; everything else needs one |

A page `/mcp-help/` on the site (M1, inside MCP-U) shows these steps, each starting with "Sign in", with copy buttons; never
a token on the page.

## 3. Phases

| Phase | Label, bundle | What opens | Prerequisites (outside MCP) |
|---|---|---|---|
| M1 | v0.19, H, **authenticated catalogue read** | the endpoint `/mcp/` behind OAuth and PATs at the `catalogue` level: 21 catalogue tools and `whoami`, discovery, method, `validate`; consent, Connected apps, the admin panel and locks; owner first, then accounts per QX20 | PM-C, PM-G, PM-F (D); API-P, PA-Q (E); API-G, API-T, API-S, API-V, MTH-G, MTH-1 (G); ORG-A (C); EML-Q quotas and Turnstile; **EML-1** (sign-in card hook, verified email); **GSI-SEC** (Google gate) |
| M2 | v0.20, H, my plans read | five reads of the user's own plans, favourites, requests and map at `plans_read` | EM-1 (built), FAV-D, FBK-2, WM-S |
| M3 | v0.20a, **H2** | user writes; previews and approvals; MCP Apps views; profile tools; Claude Code plugin | UPL-C, UPL-1 (H2); STEP2-C1, STEP2-C2, TB-SY, ACCT-P; FAV-D, FBK-1; IMG-1 |
| M4 | v0.20b, **H2** | staging and review (owner); intake tools | STG-C, STG-1, STG-P (H2); REQ-M; CAT-Q |
| M5 | v1.3, **bundle L** after K (QX13) | tasks extension, `export_trip`, Agent Skills bundle, directory listings, researchers | custom domain (Q148) for listings; M4 a month in use (QX11) |

## 4. Tasks, hours, models, bundles (summary; rows in BUILD-READINESS 2)

| Phase | Tasks | Opus h | Sonnet h | Total h | Bundle |
|---|---|---|---|---|---|
| Prerequisites before H | PM-C 4, PM-G 5, PM-F 4, API-P 6, API-G 4, API-T 3, API-S 1.5, API-V 5, MTH-G 6, MTH-1 3 | 15 | 26.5 | **41.5** | D 13, E 6, G 22.5 |
| M1 | IDN-C 4, AU-D 3, MCP-C 10, GOV-C 6.5, SCH-G 3, MCP-G 6, MCP-T 5, GOV-1 4, MCP-2 6.5, MCP-1 6.5, MCP-M 3, MCP-GR 2, ORG-MCP 1.5, MCP-O 4, MCP-U 10, IDN-1 2, ADM-0 3, GOV-API1 4, GOV-API2 3, GOV-UI1 6, GOV-UI2 5.5, GOV-RV1 2.5, GOV-RV2 2, MCP-PK 3, MCP-EV 6.5, MCP-S 5, GOV-S 2.5, MCP-E 3.5 | 57 | 66.5 | **123.5** | H (v0.19) |
| M2 | MCP-2R 3, WM-M `get_my_map` 2.5, MCP-S2 1.5, MCP-E2 1 | 1.5 | 6.5 | **8** | H (v0.20) |
| M3 | UPL-C 4, UPL-1 5, MCP-W 12.5, MCP-P 9, MCP-UI 19, TK-MCP 2, WM-M `mark_visited` 2.5, MCP-S3 4, MCP-EV2 3, MCP-E3 2 | 17.5 | 45.5 | **63** | H2 (v0.20a) |
| M4 | STG-C 6, STG-1 8.5, STG-P 7, MCP-3 10, REQ-M 6, MCP-A 6, MCP-P2 3.5, MCP-S4 6, MCP-EV3 2, MCP-E4 1 | 21 | 35 | **56** | H2 (v0.20b) |
| M5 | M5-T 7, M5-X 3.5, M5-K 5, M5-D 4, M5-R 4, M5-S 3, M5-EV 2, M5-E 1.5 | 8.5 | 21.5 | **30** | L (v1.3) |
| **All** | | **120.5** | **201.5** | **322** | |

**Against earlier totals:** 237.5 h on 26 Oct; 239.5 h after the 27 Oct builder changes (WM-M +2.5 in H, TK-MCP +2 and UPL
−5 and `mark_visited` +2.5 in H2); now **322 h (+82.5)**: bundle H +48 h (47 h of new governance and identity work, +2 h for per-user access and signed-in
evals, −1 h net from one endpoint and merged reviews; M1 grows by 83.5 h because most of the old M2 moves into it, and M2
shrinks by 35.5 h), H2 +4.5 h, M5 +30 h. Line by line: BUILD-READINESS 0.

**Bundle effects:** H 83.5 → **131.5 h**, H2 114.5 → **119 h**, new **L 30 h** after K. The train becomes A to H, H2, I, J,
K, L. B1 carries about 46 h of lane X in H (MCP-U and the panel screens move into M1). The program total moves from
2,323.5 h to **2,406 h** (MASTER-ORDER 0).

## 5. What must land in the API before the MCP (contract order)

The one-author order of MASTER-ORDER 4.3 gains, in this order: PA-C (C) → **PM-C** (D) → **PM-G**, **PM-F** (D) → PA-Q,
**API-P** (E) → TD-1 (E) → CUS-C (F) → NAV-D, FAV-D (F) → REQ-E-C (G) → REQ-G-C (G) → **API-G** (G) → **API-T**, **API-S**,
**API-V**, **MTH-G**, **MTH-1** (G) → **IDN-C**, MCP-C → **GOV-C**, **SCH-G** → MCP-G → MCP-T (H, all M1) → **UPL-C** (H2) →
**STG-C** (H2) → **M5-T** (L). Migrations, slugs in branches and numbers at merge (MIG-N): `account_status` (IDN-C),
`mcp_governance` (GOV-C), `mcp_access` (MCP-G), the token columns (MCP-T), `user_place` (UPL-C), `research_stage` (STG-C),
`mcp_task` (M5-T).

## 6. Dependency on the entity-graph spec

| Item | Needs from ENTITY-SPEC | If absent |
|---|---|---|
| `get_related` | the generic related route (matrix page 11, E3) | ships dark; `list_places {facets: {park}}` (PA-Q) answers park members |
| `place_needs` | the needs route (E4) or `PlaceLookup.entry` (PA-Q) | dropped in favour of `get_place {include: ["entry"]}` |
| `research_brief` for parks and members | relation names and which side stores each (E1, E2) | briefs list `part_of` and `at` only |
| `research-batch/1` new relations | `covered_by`, `covers_areas`, operator records (E5) | batches carry only today's relations |
| Comparison and map views across a park's members | membership read model (E7) | per-place views only |

## 7. Conflicts with existing decisions

| Existing | Where | Here | Resolution |
|---|---|---|---|
| "Task-shaped tools, about 25 in total" | README principle 1 | 22 at `catalogue`, up to 56 at `owner_admin` (tool-catalogue 1.1) | levels filter `tools/list`; descriptions verb-first; Q196 already accepted about 38 |
| Bundle H is two deploys and the last MCP step before I, J, K | RELEASE-PLAN 0a, MASTER-ORDER 0 | H2 adds two more deploys after H | QX2 |
| "Planner second" | product direction | user plans and private places through MCP before the planner (F01 to F17) | `user-plan/1` is the planner's first contract, built small and forward-compatible with TD-1; no planner UI is added |
| "No new HTML" | PLAN 1, CLAUDE.md | MCP Apps views | built in `web/` with the design system and reviewed as UI (QX6) |
| REQ-M after MCP-3 and MCP-S; the CLI stays the admin tool (Q216, RQ11) | requests spec | REQ-M in v0.20b after MCP-S4 | consistent; the CLI stays for anything not in MCP |
| `research:propose` "proposals only, a person decides" | auth 14.3, security T5 | staging plus approval on the site plus a release | consistent, made concrete |
| `share` with `confirmed_by_user` | tools-plan.md | not in H or H2 | Q198 already |
| MCP-P "later, with the planner's write tools" | auth 14.9 | MCP-P in v0.20a | moved earlier because user writes arrive in H2 |
| Explore tools with party, dates, coordinates | tools-explore.md | still planner-era target | unchanged banner |
| Sessions and `Mcp-Session-Id` | auth-and-sign-in.md sections 1 and 4 (protocol 2025-11-25 era) | 2026-07-28 removed sessions; previews and batches use server-minted handles | MCP-C pins 2026-07-28 with the 2025-11-25 fallback |
| The UI and UX audit J right after H | AUDITS 2.3, RELEASE-PLAN | J after H2 | J covers the views; G-UI gate lists v0.20b |
| PAT expiry 90 days in README 3 | README | 30 days default (Q163) | unchanged |
| Public `/mcp/` with no sign-in (R-124, Q161, Q165) | auth 1, 4.2, 12; README; tools-v1 3 | **one authenticated `/mcp/`** | owner decision, 27 Oct 2026; PLAN R-291 supersedes R-124; Q161 and Q165 marked superseded |
| M1 is anonymous read; MCP-G, MCP-T, MCP-2, MCP-O, MCP-U in M2 | this page 3 and 4 (26 Oct); MASTER-ORDER 3.9 MP1, MP2 | M1 is authenticated catalogue read and carries them | owner decision; BUILD-READINESS 2.1 |
| "Defer the research toolkit and listings until after v1.0" (QX12) against "build all M1 to M5" (owner, 27 Oct) | product 6 | M5 planned in full with 30 h, scheduled after K as bundle L | QX13 |
| H2 only if QX2 is yes | MASTER-ORDER 0 | H2 planned in full (owner: "build all M1 to M5") | QX2 still needs a recorded answer |
| Admin role row "`owner`" | auth 14.2a | stored `admin` (schema 0002) | identity 2.1 |
| `edit_my_trip`, `preview_change`, `user-plan/1` | product-roles 3, 4.3 | `preview_trip_change`, `apply_change`, `plan-draft/1` | tool-catalogue 1.2 |

## 8. Second list of owner questions (only those the spec cannot settle)

| Q | Question | Recommended | Trade-off |
|---|---|---|---|
| Q-B1 | **Superseded by QX16 (28 Oct 2026):** the public-endpoint fallback no longer exists (owner, 27 Oct 2026). | | |
| Q-B2 | The map view uses the globe's MapLibre tile source; if that source's terms forbid use inside a third-party frame, the map view ships without tiles (points and lines on a plain background) rather than adding a paid provider? | **Yes** | a plainer map in clients |
| Q-B3 | Name the new feature labels v0.20a and v0.20b (no renumbering of v0.21 and v0.22)? | **Yes** | letters in labels, against renumbering two releases |

### 8.1 Third list (28 Oct 2026, the build-ready plan; only what the specs cannot settle)

| Q | Question | Recommended | Trade-off |
|---|---|---|---|
| QX2 (restated) | Record the answer to QX2 (bundle H2 with v0.20a and v0.20b). Your "build all phases M1 to M5" (27 Oct) reads as yes; the plan needs it written down | **Yes, record it** | J and K move about two bundles later, as QX2 said |
| QX13 | M5 (tasks, export, Agent Skills bundle, directory listings, researchers; 30 h) as bundle **L, v1.3, after K**, rather than straight after H2? | **After K** | listings want the custom domain (Q148) and the Postgres cutover first; the toolkit reaches strangers later |
| QX14 | v0.19 is now 123.5 h because every call needs sign-in. Ship it as one release opened in two switch-ons (you only, then other accounts after MCP-S), rather than splitting it into two releases? | **One release, two switch-ons** | one T3 and one review for a large bundle, against two smaller T3 runs (about 1 h more of verification) |
| QX15 | The single endpoint path: `/mcp/` (recommended; the child plugin's resource changes once, O-M1b, and MCP-2 repeats the MCP-0 proof on it), or keep `/mcp/private/` (already proven by MCP-0)? | **`/mcp/`** | two minutes of console work and one re-check, against a URL that says "private" with nothing public beside it |
| QX16 | ChatGPT: add its CIMD client id to the allow list after MCP-PK proves Neon accepts it; if it cannot complete OAuth, ChatGPT has **no MCP access** until it can (no public fallback; ChatGPT offers no token or header path for a user's own connector)? Alternatives noted: turning on DCR for ChatGPT (deprecated by the spec, opens registration to anyone, Q164), or a static-header connector (not offered by ChatGPT today) | **Yes, no fallback** | ChatGPT users may wait; Claude, Claude Code, VS Code and scripts with PATs are unaffected |
| QX17 | Account tools over MCP: `get_my_profile` (travellers as labels; ages only with the `people` add-on) and `update_my_travellers` (`plans_write` + `people`)? | **Yes** | an AI app can change who travels; undoable, add-on off by default |
| QX18 | A tool whose definition (description or schema) changed in a deploy is hidden from everyone but you until you accept it in the panel? | **Yes** | one click per wording change, against a silent "rug pull" |
| QX19 | Keep the admin audit (every panel change, before and after) for one year, apart from the 30 days of call logs (Q167)? | **One year** | a small owner-only table holds a year of who changed what |
| QX20 | Default for new accounts: MCP **allowed** once the email is verified and the account is **24 hours** old (you can switch any account off, or flip the default to off, at any time)? | **Yes** | a stranger with a verified inbox can read the catalogue through an AI app a day after sign-up (per-user quotas and a global cap bound it); the alternative is a click by you per family member |

## Change log

- 26 Oct 2026: written (travel-planner, Opus 5.5).
- 28 Oct 2026: sections 1 to 5 rewritten for the owner's decision of 27 Oct 2026 (no anonymous endpoint) and the build-ready plan; conflicts added; Q-B1 superseded by QX16; QX13 to QX20 (travel-planner, Opus 5.5).
