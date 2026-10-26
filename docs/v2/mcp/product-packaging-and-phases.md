# MCP product: installation per client, phases, bundles, hours, dependencies and conflicts

Part of [product.md](product.md). Status: spec only, planned (26 Oct 2026). Models per CLAUDE.md "Model by task complexity":
shared contracts, privacy and security are Opus; well-specified builds are Sonnet; reviews are never below the writer.

## 1. Endpoints

| Endpoint | URL (until a custom domain, Q148) | Who |
|---|---|---|
| Public | `https://travel-beta-tan.vercel.app/mcp/` | anyone, no sign-in |
| Private | `https://travel-beta-tan.vercel.app/mcp/private/` | signed-in users (OAuth or PAT) |
| Local stdio | `node core/bin/mcp.ts` | the owner, in the repository (unchanged) |

## 2. Installation per client (verified in MCP-PK on the child branch, then MCP-E on production)

| Client | Public | Private | Views | Notes |
|---|---|---|---|---|
| claude.ai, Claude Desktop, Claude mobile | Settings, Connectors, add custom connector, the public URL | the private URL; sign in with our account; consent page; pick the level on Connected apps | yes on web and desktop (MCP Apps) | one client id across surfaces (auth 14.10) |
| ChatGPT | developer mode or the apps directory later; connector with the public URL | the private URL with OAuth, if CIMD works (security page 1; Q-B1) | yes (Apps SDK on MCP Apps); text-only fallback on Android | permission modes (always, before changes, important changes) map onto our annotations; destructive tools carry `destructiveHint` |
| Claude Code | `claude mcp add --transport http travel https://travel-beta-tan.vercel.app/mcp/` | `claude mcp add --transport http travel-me https://travel-beta-tan.vercel.app/mcp/private/` (OAuth in the browser) or with `--header "Authorization: Bearer <PAT>"` from the keychain | no (terminal) | the `travel` plugin (M3) bundles the server entries and the three generated skills; `/mcp` to authenticate |
| VS Code (Copilot), Cursor, Goose | `mcp.json` entry `{ "type": "http", "url": "https://travel-beta-tan.vercel.app/mcp/" }` | the private URL; OAuth where supported, else PAT | where the host supports MCP Apps | |
| Any SDK script | Streamable HTTP, protocol 2026-07-28 with the 2025-11-25 fallback | PAT | no | `server/discover` answers versions and capabilities |

A page `/mcp-help/` on the site (M3, inside MCP-U's scope) shows these steps with copy buttons; never a token on the page.

## 3. Phases

| Phase | Label, bundle | Doors | Prerequisites (outside MCP) |
|---|---|---|---|
| M1 | v0.19, H | public: read, discovery, method, `validate`, structured payloads with view hints | PM-C, PM-G, PM-F (D); API-P, PA-Q (E); API-G, API-T, API-S, API-V, MTH-G, MTH-1 (G); ORG-A (C); EML-Q quotas |
| M2 | v0.20, H | private read at `plans_read`; Connected apps | CUS-C (F) account drafts route; NAV-D, FAV-D (F); FBK (D) submissions list; EML-1 |
| M3 | v0.20a, **H2** | user writes; previews and approvals; MCP Apps views; Claude Code plugin | UPL-C, UPL-1 (H2); REQ-E-C (G) for move, insert day, drop day; TD-1 (E) core trip schema; IMG-1 (A) photo renditions for views |
| M4 | v0.20b, **H2** | staging and review (owner); intake tools | STG-C, STG-1, STG-P (H2); REQ-M; CAT-Q (D) for private Postgres reads of staging |
| M5 | later (after v1.0, QX12) | public research toolkit (Agent Skills bundle), directory listings, the tasks extension for long batch validation, export over MCP (QM10) | none scheduled |

## 4. Tasks, hours, models, bundles

| Id | Task | Model | h | Bundle | Depends on |
|---|---|---|---|---|---|
| PM-C | Registry exposure contract ([property matrix](../features/property-display-matrix.md) 12) | Opus | 4 | D (I) | PA-C |
| PM-G | Matrix generator and checks | Sonnet 4, Opus review 1 | 5 | D (I) | PM-C |
| PM-F | Formatter to core | Sonnet 3, verifier 1 | 4 | D (I) | PM-C, UXB-7 |
| API-P | Facts read model | Opus 2, Sonnet 4 | 6 | E | PM-F, PA-Q, UXB-C |
| API-G | Endpoint table and guard in core | Opus | 4 | G (I) | quiet point |
| API-T | Types routes | Sonnet | 3 | G (I) | PM-G, API-G |
| API-S | Sun route | Sonnet | 1.5 | G (I) | API-G |
| API-V | `POST /api/v1/validate` | Opus 2, Sonnet 3 | 5 | G (I) | API-G |
| MTH-G | Method generator (remote edition, privacy scan) | Opus 2, Sonnet 4 | 6 | G (I) | PM-G |
| MTH-1 | Method routes | Sonnet | 3 | G (I) | MTH-G, API-G |
| **Prerequisites before H** | | | **41.5** | D 13, E 6, G 22.5 | |
| AU-D | Delta audit, MCP field list as `expose.mcp` overrides | Opus | 3 | H | v0.18, PM-G |
| MCP-C | Remote contract: tool-to-route table, schemas from the API, projections from the matrix, `travel-view/1`, error map, annotations, levels, grep test | Opus | 10 | H | API-G, API-P, API-T, API-S, API-V, PM-G, AU-D |
| MCP-1 | Public endpoint, 21 catalogue tools | Sonnet | 8 | H | MCP-C, EML-Q |
| MCP-M | Resources and prompts over MTH-1 and API-T | Sonnet | 3 | H | MCP-1, MTH-1 |
| MCP-GR | Graph tools | Sonnet | 2 | H if the routes exist, else H2 | ENTITY routes, PA-Q |
| ORG-MCP | Origin tools | Sonnet | 1.5 | H | ORG-A |
| MCP-PK | Packaging spike: claude.ai, ChatGPT (CIMD), Claude Code, VS Code; plugin manifest | Sonnet | 3 | H | MCP-1 on the child |
| MCP-EV | Eval harness, E1, E2 | Opus 2, Sonnet 4 | 6 | H | MCP-1 |
| MCP-S1 | Security review, public half | Opus | 2.5 | H | MCP-1 |
| MCP-E1 | Real clients, public | Sonnet | 1 | H | deploy |
| **M1** | | | **40** | H (v0.19) | |
| MCP-G, MCP-T, MCP-2, MCP-O, MCP-U, MCP-S, MCP-E | Private read (as auth 14.9; MCP-2 9 h) | Opus, Sonnet | 6 + 5 + 9 + 4 + 10 + 4 + 3 = 41 | H | as planned |
| **M2** | | | **41** | H (v0.20) | |
| UPL-C | `user-plan/1`, `user-place/1`, `user_place` migration | Opus | 6 | H2 | CUS-C, TD-1 |
| UPL-1 | Plan and place routes, previews | Sonnet | 8 | H2 | UPL-C |
| MCP-W | User write tools (copy, edit, create, places, favourites, requests, preview and apply) | Opus 3, Sonnet 7 | 10 | H2 | UPL-1, CUS-C, REQ-E-C, FAV-D, FBK-1 |
| MCP-P | Pending changes and the approval page (exists as "later") | Opus 3, Sonnet 5 | 8 | H2 | MCP-W |
| MCP-UI | Five MCP Apps views in `web/mcp-views/**`; design review; verifier | Sonnet 14, Opus 3, Sonnet 2 | 19 | H2 | MCP-W, IMG-1 |
| MCP-S3 | Security review, writes and views | Opus | 4 | H2 | MCP-UI |
| MCP-EV2 | Evals E3, E4, E7, E8 | Sonnet | 3 | H2 | MCP-W |
| MCP-E3 | Real clients, writes and views | Sonnet | 2 | H2 | deploy |
| **M3** | | | **60** | H2 (v0.20a) | |
| STG-C | `research-batch/1`, `research_stage` migration | Opus | 6 | H2 | M3 shipped |
| STG-1 | Staging and work-list routes | Sonnet | 8 | H2 | STG-C |
| STG-P | `stage.ts export` with the validator chain | Sonnet 6, Opus review 1 | 7 | H2 | STG-1 |
| MCP-3 | Research tools (`research_brief`, `work_list`, `stage_batch`, batches) (was 8 h, later) | Opus 4, Sonnet 6 | 10 | H2 | STG-1, MTH-1 |
| REQ-M | Intake tools (exists, later) | Opus 2, Sonnet 4 | 6 | H2 | MCP-3 |
| MCP-A | Review tools (`review_queue`, `diff_batch`, `decide_batch`, `coverage`) | Opus 2, Sonnet 4 | 6 | H2 | STG-1 |
| MCP-P2 | Approval page for batches (2.4 of the staging page) | Sonnet | 3 | H2 | MCP-P, STG-1 |
| MCP-S4 | Security review, staging and admin (external style) | Opus | 6 | H2 | MCP-A |
| MCP-EV3 | Evals E5, E6, E7 | Sonnet | 2 | H2 | MCP-3 |
| MCP-E4 | Real clients, owner | Sonnet | 1 | H2 | deploy |
| **M4** | | | **55** | H2 (v0.20b) | |
| **All** | | | **237.5** | | |

**Models:** Opus about 100.5 h, Sonnet about 137 h. **Against the plan before 26 Oct:** the MCP had 56 h in H plus 22 h
"later" (MCP-3, MCP-P, REQ-M), 78 h in all; now 237.5 h including the prerequisites, so **+159.5 h** (of which 36.5 h was
reported this morning with the property matrix).

**Bundle effects:** D +13 (Internal), E +6, G +22.5 (Internal), H 56 to 81 h, **H2 new, 115 h**. The train becomes A to H,
H2, I, J, K: J (the UI and UX audit) now also covers the MCP Apps views and the approval page, so it follows H2; K (the
Postgres cutover) follows J. B2 carries most of H2 (contracts, routes, MCP); B1 carries MCP-UI and the approval page's UI
(about 30 h). The program total moves from 986 h to about 1,168 h.

## 5. What must land in the API before the MCP (contract order)

The one-author order of MASTER-ORDER 4.3 gains, in this order: PA-C (C) → **PM-C** (D) → **PM-G**, **PM-F** (D) → PA-Q,
**API-P** (E) → TD-1 (E) → CUS-C (F) → NAV-D, FAV-D (F) → REQ-E-C (G) → REQ-G-C (G) → **API-G** (G) → **API-T**, **API-S**,
**API-V**, **MTH-G**, **MTH-1** (G) → MCP-C, MCP-G (H) → **UPL-C** (H2) → **STG-C** (H2). Two migrations join the list,
slugs in branches and numbers at merge (MIG-N): `user_place` (UPL-C), `research_stage` (STG-C).

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
| "Task-shaped tools, about 25 in total" | README principle 1 | 21 at `catalogue`, up to 50 at `owner_admin` | levels filter `tools/list`; descriptions verb-first; Q196 already accepted about 38 |
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

## 8. Second list of owner questions (only those the spec cannot settle)

| Q | Question | Recommended | Trade-off |
|---|---|---|---|
| Q-B1 | If ChatGPT cannot complete OAuth with client ID metadata documents and DCR stays off, give ChatGPT the public endpoint only until it can, rather than turning DCR on? | **Yes** | ChatGPT users cannot reach their Mine through MCP for a while |
| Q-B2 | The map view uses the globe's MapLibre tile source; if that source's terms forbid use inside a third-party frame, the map view ships without tiles (points and lines on a plain background) rather than adding a paid provider? | **Yes** | a plainer map in clients |
| Q-B3 | Name the new feature labels v0.20a and v0.20b (no renumbering of v0.21 and v0.22)? | **Yes** | letters in labels, against renumbering two releases |

## Change log

- 26 Oct 2026: written (travel-planner, Opus 5.5).
