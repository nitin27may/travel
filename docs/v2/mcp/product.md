# MCP as a product: vision, principles and the page map

Status: **spec only, planned** (26 Oct 2026, travel-planner, Opus 5.5). Docs only. Owner direction of 26 Oct 2026 (the
second message of that day): treat the MCP as a product and a differentiator, not a layer over the API. Anyone installs it
in any client and plans with it; their AI learns our format from the MCP itself; roles decide the tool set; the MCP also
ships our research method, schema discovery, validation and dry runs, and rendering hints; security and integrity are not
negotiable. TODO row of 26 Oct 2026; BACKLOG 15.313 to 15.326 (after 15.300 to 15.312 of the property matrix); owner
questions QX1 to QX12 (section 6).

Builds on: [README.md](README.md) (principles, rule 1.1 = PLAN R-252), [auth-and-sign-in.md](auth-and-sign-in.md)
(sign-in, levels, add-ons, quotas), [security.md](security.md) (T1 to T15), [tools-v1-from-api.md](tools-v1-from-api.md)
(the API-derived read tools, which become layer 1 below), [../features/property-display-matrix.md](../features/property-display-matrix.md)
(properties, privacy, exposure). Research method: [../../../research/README.md](../../../research/README.md).

## 0. The decision in one paragraph

The MCP is **five layers over one set of operations**: (1) tools derived from API read models, (2) role-scoped write tools
that call the same operations and routes as the web app, (3) our research method, schemas and examples as resources and
prompts, (4) validation, gap reports, diffs and previews before any write, and (5) a response format with a short text, a
typed structured payload and rendering hints, plus MCP Apps views where the client supports them. A visitor's AI can find
and read anything public, copy a trip into their Mine and customise it, or research a destination we lack and save it as
their own plan in our format; an admin's AI does the research legwork and **stages** catalogue changes that a person
approves before anything is published. R-252 stands and is extended, not relaxed: no MCP code touches the database; every
write is an operation with validation, provenance, an inverse and an audit row; our server never fetches third-party pages
(the client's model does, and our tools treat what it sends as data). **Trade-off:** about 160 more agent hours and a new
bundle H2 after H, against an MCP that only mirrors read endpoints and offers nothing a browser does not.

## 1. Vision, in the owner's terms

| # | Owner, 26 Oct 2026 | What it means here | Page |
|---|---|---|---|
| V1 | Install in any client and plan: retrieve any trip, answer anything in our data, show a trip in detail, customise it into their Mine | public read tools; `copy_trip` and customise tools on the user's copy; `whoami`; anything the UI does, MCP does | [product-roles-and-tools.md](product-roles-and-tools.md) |
| V2 | The model learns our format from the MCP | `get_type`, `get_format`, examples, the property catalogue, validators as tools | [product-method-and-discovery.md](product-method-and-discovery.md) |
| V3 | Define new plans in our format; user scope or, for admins, the shared catalogue | `create_plan` with private places (user scope); `stage_batch` into the staging area (admin) | [product-staging-and-admin-writes.md](product-staging-and-admin-writes.md) |
| V4 | Roles decide the tools: anonymous, signed-in user, admin | the six access levels of auth 14.2 mapped to personas; `tools/list` filtered per level | [product-roles-and-tools.md](product-roles-and-tools.md) 2 |
| V5 | Ship the research skills and method; schema discovery; validation and dry runs; later a public research toolkit | resources and prompts generated from `research/`; `validate`, `gap_report`, `diff`, `preview` | [product-method-and-discovery.md](product-method-and-discovery.md) |
| V6 | Generative UI hints: cards, calendar, map, timelines, booking lists, comparisons; small payloads, summaries first | `travel-view/1` in `structuredContent`; MCP Apps views; text fallback | [product-response-format.md](product-response-format.md) |
| V7 | Security and integrity designed in | same operations, server-side role checks, staging and review, provenance, audit, quotas, no household data, injection resistance, OAuth per client, the bundle H plan | [product-security.md](product-security.md) |
| V8 | Reconcile with R-252 and bundle H; what the API needs first; bundles and hours | R-252 extended (section 3); API prerequisites; bundle H grows, bundle H2 is new | [product-packaging-and-phases.md](product-packaging-and-phases.md) |
| V9 | Evals: can a frontier model plan, customise, research into valid records | model-in-the-loop eval suite | [product-testing-and-evals.md](product-testing-and-evals.md) |

## 2. Principles (MX1 to MX10; with README principles 1 to 8 and P1 to P9)

| # | Principle | Consequence |
|---|---|---|
| MX1 | **One set of operations.** Every MCP read is an API read model; every MCP write is an operation or route the web app also uses | a tool with no route or operation cannot be registered (L1 of tools-v1-from-api.md) |
| MX2 | **Roles are server-side.** The level is resolved per call from the token and the grant (MCP-G); no tool takes a role or scope argument | role escalation through arguments is impossible by construction |
| MX3 | **Nothing reaches the shared catalogue without a person.** Admin and researcher writes are staged batches; publish is an approval on our site, then the git seed of record, validators, check-all and a release | the MCP cannot publish; it can only propose, with evidence |
| MX4 | **User scope is private by default.** A user's copies, plans and private places are household data; they reach the catalogue only through a suggestion that enters the admin queue | no user write ever changes a public page |
| MX5 | **Our server never fetches the open web.** The client's model researches; our tools validate, score and stage what it sends; sources must be registry hosts or carry a URL and a short quote | no SSRF, no OSM/Commons rule breach from our host, no third-party quota on our account |
| MX6 | **Teach the format, then check it.** Discovery tools and resources give the model the exact checklist and examples; `validate` and `preview` run the same validators as `check-all` before any write | a model learns by trying; invalid writes never land |
| MX7 | **Summaries first, drill down.** Every result leads with a short text and a typed payload under 16 KB by default; detail, geometry and long lists are separate calls or pages | small payloads, responsive clients (P2, P3) |
| MX8 | **Render-agnostic, render-friendly.** Structured content is the contract; view hints suggest a rendering; MCP Apps views are optional and always backed by text | works in Claude Code's terminal and in a ChatGPT widget alike |
| MX9 | **Honest by default.** Gaps say "not checked yet", facts carry read dates, estimates say so, sources are cited; tool descriptions forbid inventing values | T3, the honesty rule |
| MX10 | **Every write is undoable and audited.** Operations return an inverse; batches have one undo; `op_event` and `mcp_audit` record who, which client, when, never the arguments' private content | rollback per write, per batch, per release |

## 3. R-252 extended (proposed R-270; replaces nothing in R-252)

R-252 says MCP tools sit on the API layer and never on the database. It is kept word for word. The product adds four
kinds of capability, each held to the same rule:

| Layer | What | How R-252 applies |
|---|---|---|
| 1. Read tools | projections of `/api/v1` read models | as tools-v1-from-api.md: endpoint table, guard, projection |
| 2. Write tools | user-scope (copies, customise, plans, favourites, requests) and staging (research batches, decisions) | each tool calls the route or operation the app uses (`withUserTransaction`, RLS, Zod, `op_event`, inverse); admin writes call staging operations only, never catalogue writes |
| 3. Method and discovery | resources and prompts from `research/`, the type checklists, the property matrix, formats and examples | generated at build time from repository files into a versioned bundle served through `/api/v1/method/**` and `/api/v1/types/**` routes; no file system read at request time from MCP code |
| 4. Validation and preview | `validate`, `gap_report`, `diff`, `preview` | stateless routes over the core validators (`core/src/validate/**`, `core/src/capture/engine.ts`), the same code `check-all` runs |
| 5. Response format | `travel-view/1` hints, MCP Apps `ui://` views | the payload is a projection of a read model; views are static bundles built in `web/` with the design system; a view calls only tools the same level may call |

The grep test of R-252 (no database client, no SQL, no `HOME_POINT` in MCP code) extends to the view bundles and the
method generator.

## 4. The page map

| Page | Contents |
|---|---|
| [product-roles-and-tools.md](product-roles-and-tools.md) | personas; roles to access levels; the tool matrix; the tool catalogue with inputs and outputs derived from the API and operation contracts |
| [product-method-and-discovery.md](product-method-and-discovery.md) | resources, prompts and skills mapped from our method files; schema and format discovery; validation and dry-run tools |
| [product-staging-and-admin-writes.md](product-staging-and-admin-writes.md) | user-scope writes; the staging area for catalogue changes; provenance, review, publish and rollback |
| [product-response-format.md](product-response-format.md) | the response contract, `travel-view/1`, worked payloads (trip card, day timeline, map, booking list, date picker), MCP Apps views, what each client renders |
| [product-security.md](product-security.md) | auth, roles and scopes per client; threats T16 to T27; rate limits; errors |
| [product-testing-and-evals.md](product-testing-and-evals.md) | contract, parity, privacy and security tests; model-in-the-loop evals |
| [product-packaging-and-phases.md](product-packaging-and-phases.md) | installation per client; phases M1 to M5; bundles and hours; API prerequisites; the entity-graph dependency; conflicts |
| [tools-v1-from-api.md](tools-v1-from-api.md) | layer 1 in detail: the read tools as API projections, field lists from the property matrix, paging, error mapping |

## 5. Phases in one table (detail and hours: [product-packaging-and-phases.md](product-packaging-and-phases.md))

| Phase | Feature label, bundle | Who | What | Agent hours |
|---|---|---|---|---|
| M1 | v0.19, H | anonymous | read, discovery, method, stateless validation, structured payloads with view hints | 40 |
| M2 | v0.20, H | signed-in, read | the user's copies, plans and favourites read; `whoami`; Connected apps | 41 |
| M3 | v0.20a, **H2** (new) | signed-in, write | copy into Mine, customise, create own plans with private places, favourites, requests; previews and approvals; MCP Apps views | 60 |
| M4 | v0.20b, **H2** | owner (researchers later) | research batches into staging, gap and refresh work lists, review and decide, intake queue | 55 |
| M5 | later | everyone | public research toolkit, directory listings, long-running jobs, export | not scheduled |

API and contract prerequisites before H (property matrix, facts, endpoint table, validate, method routes): 41.5 h in bundles
D, E and G; the user-plan and staging contracts are inside M3 and M4. In all 237.5 h, +159.5 h against the plan before
26 Oct.

## 6. Owner questions (QX1 to QX12)

| Q | Question | Recommended | Trade-off |
|---|---|---|---|
| QX1 | Adopt the five-layer model and extend R-252 as section 3 (proposed R-270), keeping "never on the database" word for word? | **Yes** | more surface to secure, against an MCP that only mirrors the site |
| QX2 | Add bundle **H2** after H (before I, J, K) with two feature labels, v0.20a "Plan with your AI" (user writes) and v0.20b "Research and admin" (staging), each with its own deploy and security review? | **Yes** | the UI audit J and the Postgres cutover K move later by about two bundles of B2 time; mixing writes into H would make H's security review much larger |
| QX3 | Our server never fetches third-party pages; the client's model does the web research and our tools validate and stage what it sends? | **Yes** | a client without web access cannot research through us; no SSRF, no Commons or OSM rate breach from our host |
| QX4 | Catalogue writes through MCP only as staged batches (changesets and new-record batches) that a person approves on our site, then exported to a git branch, validated, merged and released; never a direct catalogue write? | **Yes** | slower publication (a release, not a click), against a poisoned catalogue |
| QX5 | A user's researched destination is a private plan with private places; it reaches the catalogue only as a suggestion in the admin queue? | **Yes** | users cannot publish; the catalogue grows only through review |
| QX6 | MCP Apps views (trip card, day timeline, map, booking list, date picker) in v0.20a, built in `web/` with the design system and reviewed like any UI, while every tool from v0.19 already returns text plus typed payloads with view hints? | **Yes** | about 19 h and a design review; the views follow the "no new HTML" rule because they are web app builds |
| QX7 | Fix the response contract `travel-view/1` (text summary, structured payload, view hint, resource links) at v0.19 so later views need no tool change? | **Yes** | one more contract before v0.19 |
| QX8 | Publish the research method (README, capture contract sections, type checklists, lanes, formats, examples) as public resources and prompts from v0.19, generated from `research/` and privacy-scanned? | **Yes** | our method becomes visible to anyone; it is already in a public repository after the publish decision |
| QX9 | A public, stateless `validate` tool and route (size-capped, rate-limited) from v0.19? | **Yes** | some compute for anonymous users, against a model that cannot check its own drafts |
| QX10 | Model-in-the-loop evals at T3 of H and H2 with owner-supplied API keys, capped at USD 20 a run? | **Yes** | money and an owner key step, against shipping tools no model can use |
| QX11 | Staging is owner-only in v0.20b; invited researchers get `research` later, after a month of owner use and MCP-S4? | **Yes** | slower research throughput |
| QX12 | Defer the public research toolkit and directory listings (Anthropic, OpenAI) until after v1.0? | **Yes** | fewer installs before v1.0 |

QM1 to QM10 of the property matrix page still stand; QM4, QM6, QM8, QM9 and QM10 apply to the read layer unchanged.

## Change log

- 26 Oct 2026: written (travel-planner, Opus 5.5) on `public/PROP-MCP-SPEC` after the owner's MCP-as-product direction.
