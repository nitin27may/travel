# Master-plan audit, 25 Oct 2026

Written by travel-planner (Opus) against `main` 4230210. PLAN R-122, BACKLOG 15.122, TODO row of 25 Oct. Docs only; no
owner decision was changed. Where a decision looked stale it is raised as a question (Q168) or left with a pointer.

## 1. Facts checked

| Fact | Evidence |
|---|---|
| Hosting: Vercel project `travel` (team `nitin27mays-projects`), root `web`, Node 22; public address `https://travel-beta-tan.vercel.app`, no custom domain; previews behind Vercel Authentication; one preview READY on 25 Oct; no production deployment; production needs the owner's approval of a named commit | HANDOVER item 3; EML-0 U13 (production alias answers `DEPLOYMENT_NOT_FOUND`); owner decisions this session |
| Neon project `damp-queen-64719841`, production `br-soft-glade-b4mkqyvd`, child `br-damp-breeze-b41mtvn5`; Free plan with 60,000 MAU; 10 migrations; RLS on 86 tables plus the ledger | `core/src/db/migrations/0001` to `0010`; NEON-MIGRATIONS.md; email spec N14 |
| Managed Better Auth: email and password; email OTP spiked (M1 passed); Google with the owner's own client on both branches; Apple skipped; Disable Sign Up does not stop code sign-in creating accounts; reset does not revoke old sessions; codes expire in 5 minutes | `neon neon-auth plugins list` (both branches, 25 Oct); email spec sections "EML-0 results" and the live addendum |
| Neon Auth also lists an `oauth_provider` plugin with MCP options, disabled on both branches | `neon neon-auth plugins get oauth_provider` (25 Oct); [mcp/auth-and-sign-in.md](mcp/auth-and-sign-in.md) 2.3 |
| Email: Neon shared sender for account mail (Phase 1); Resend sandbox, owner alerts only, key in Vercel and GitHub secrets | email spec Decision 25 Oct; HANDOVER item 3 |
| R-58 merged into `main`; child-branch DB suite 29/29; real-service E2E blocked by the origin guard | HANDOVER "Done" and "Not done" items 1 and 2 |
| `JsonStore` serves the public catalogue; `PostgresStore`, loader and cutover not built | HANDOVER item 4; `core/src/catalogue/store.ts` |
| Shipped this session without plan rows: phone back-to-top (1317c13), family default youngest child 10 (3a3b8f9); D6a merged (75ee036); EML-0 merged (704f6fd) | `git log` |
| Running now: EML-1, D1b, D3a, D4a, D7-R, D9-R (worktrees at 4230210) | `git worktree list` |
| The only MCP server is `core/bin/mcp.ts` (stdio, 15 read tools, `FileStore`), registered in `.mcp.json` | source, `data/schema/generated/ops.json` |
| No CI workflow file exists (`.github/workflows` absent), though GitHub Actions secrets are set | repo; HANDOVER item 3 |

## 2. Audit by document

| Document | Still true | Stale or wrong (found) | Changed in this commit |
|---|---|---|---|
| [README.md](README.md) | The seven design rules; the file index; Neon row in "What changed" | "Vercel for the app: hosting not selected"; no pointer to the MCP sign-in spec or to PLAN as the order | Hosting row rewritten (Vercel, project, address, no production); last-verified line; index rows for the audit and the MCP spec |
| [01-domain-model.md](01-domain-model.md) | Catalog and plans split; changesets; applied schema is the migrations | "oauth clients" under PEOPLE has no table; OAuth clients now live in Neon | Last-verified note pointing to `mcp_client_grant` and `mcp_token` |
| [02-experience.md](02-experience.md) | Screens and flows as the planner draft | Token names in section 16 (`--ok`) predate the Trailhead palette and the no-green rule | Last-verified note; no design change (that is a design-review task) |
| [03-mcp-and-research.md](03-mcp-and-research.md) | Tool groups, research lanes, trust, licences | Section 3: "OAuth provider and public host still to be chosen"; nothing said what MCP exists today | Head note on the stdio server (15 read tools, 13 phase-2 writes not served); section 3 superseded by the sign-in spec |
| [04-stack.md](04-stack.md) | Reasoning record 1.1 to 1.9; most of section 2 as direction | Banner: "verified on the uncommitted session branch", "Not selected: frontend hosting"; MCP row "auth by Better Auth MCP plugin"; email row silent on the shared sender; section 3 sketch shows Hono, R2, Cron Worker and the Better Auth MCP plugin as if current; rule 2 scopes; rule 4 limits | New "current state" box (hosting, database, auth, realtime, email, catalogue, MCP, not selected); stale banner sentence flagged; MCP, email and hosting rows amended; note under the sketch; rules 2 and 4 amended; cost row notes no domain |
| [05-roadmap.md](05-roadmap.md) | Milestones and exit tests as the planner plan | "App hosting and a public URL are not selected"; child-branch suite "blocked"; MCP "with OAuth" by the plugin; stdio "replaced by remote" | Head box with the order in force and the 25 Oct state; M0 bullets corrected; migration row marked "proposed: stdio stays" |
| [06-questions.md](06-questions.md) | Decision record of 17 Oct | Intro says hosting open; Q17 domain unanswered; Q12 default reads as if unanswered | Last-verified box; Q3 pointer; Q17 owner answer for now (Vercel address); Q12 marked answered |
| [08-self-hosted.md](08-self-hosted.md) | Correctly marked historical; its requirements still apply | "Hosting not selected" | Last-verified line: hosting is Vercel; MCP-over-tunnel replaced |
| [11-quality-and-delivery.md](11-quality-and-delivery.md) | Test layers; release gates; security routine | Child suite "blocked"; production host "not selected"; CI implied running | Last-verified box (29/29, one environment, previews protected, no workflow files, 0.7 is MCP-0); production row |
| [schema.sql](schema.sql) | Marked as a historical proposal at the top | Supabase lines (auth.users, auth.uid(), service_role) read as live further down | Two comment lines: Supabase lines historical; what was built (`withUserTransaction`, `travel_app`, `app.user_id`) |
| [mcp/README.md](mcp/README.md) | Principles, error model, versioning, tool list | Endpoint `app.<domain>/mcp`; OAuth "provider not selected"; scopes assume OAuth carries them | Banner with the 25 Oct design; OAuth row rewritten; index row for auth-and-sign-in.md. The `app.<domain>` example URLs in the tools pages are left as placeholders (no domain decided) |
| [mcp/security.md](mcp/security.md) | Threats T1 to T13 | Hosting and provider "not selected" | Update box pointing to the new section 6 mitigations; scopes read as capabilities |
| [mcp/client-recipes.md](mcp/client-recipes.md) | Recipes 1 to 10 as target acceptance tests | No way to connect today was described | New section 0: stdio today; public, OAuth and token recipes after their tasks; trailing-slash and preview gotchas |
| mcp/tools-*.md, resources-and-prompts.md | Tool contracts as target design | No Supabase wording found; example URLs use `app.<domain>` | Not changed |
| [PLAN.md](PLAN.md) | Rules in section 1; requirement list; gates; open decisions | Platform paragraph ("uncommitted", "deferred until merge-ready, no deployment"); R-8, R-13, R-43, R-51, R-58, R-61, R-83, R-100, R-101, R-111 statuses; section 3 Hosting row; section 5 "Hosting" asked as open; Q66-Q69 row; no rows for two shipped owner requests; no MCP sign-in requirement | Last-verified line; new platform paragraph; those statuses; Hosting and MCP rows; Hosting decision marked answered; Q160 to Q168 and the `planner_draft_signal` ruling in section 5; R-120 to R-129; section 7 rows; change log |
| [build/public-site/MASTER-PLAN.md](build/public-site/MASTER-PLAN.md) | Banner already says superseded as entry point; item list | Section 0 deployment, domain and feedback-repo lines | Last-verified note listing what is stale |
| [build/public-site/EXECUTION-PLAN.md](build/public-site/EXECUTION-PLAN.md) | Task-level detail, API shape, gates, runbook | 13.2 "do not create a project"; custom domain open; one WAF rule not shared with MCP | Last-verified lines at the top and in 13.2 |
| [build/public-site/DATA-ROADMAP.md](build/public-site/DATA-ROADMAP.md) | Batch table, decisions log | D6a "done, not merged" (merged 75ee036); D3a, D4a, D7-R, D9-R say "not started" though their worktrees opened at 4230210 | D6a row only (the running agents own their rows; they update them at hand-back) |
| [build/public-site/NEON-VERIFICATION.md](build/public-site/NEON-VERIFICATION.md) | The 24 Oct verdict | Child suite "blocked" | Dated update box (29/29, merged) |
| BACKLOG.md | Row history | 15.47, 15.50, 15.83 and 15.113 statuses | Those statuses; rows 15.120 to 15.129; questions Q160 to Q168 |
| TODO.md | Open list | The two shipped requests had no Done rows; no row for this work | Open row for the audit and MCP design; two Done rows |
| [features/F17](features/F17-accounts-auth-and-privacy.md) | Requirements | Item 7 "to be verified" | Pointer to the MCP sign-in design |
| F16, the 25 Oct specs, NEON-SETUP | Current | None found beyond the items above | Not changed |

## 3. Top findings

1. **Hosting is no longer an open question anywhere it was still asked.** Five documents said hosting was not selected; it
   is Vercel, the project exists, and the only remaining gate is the owner's approval of a production commit.
2. **R-58 read as unfinished in PLAN and BACKLOG.** It is merged, and the child-branch suite that was "blocked" passed 29
   of 29. The real-service E2E is still blocked, for a different reason (no HTTPS origin).
3. **Neon can act as the MCP OAuth server.** The plan assumed the Better Auth MCP plugin (which we cannot run inside
   Neon's managed service) or a provider "to be verified". Neon's own `oauth_provider` plugin exists, disabled, with
   client ID metadata documents. Fixed scopes force our MCP permissions into the database.
4. **Two owner requests shipped with no plan row** (back-to-top, youngest child 10). Now R-120 and R-121, done.
5. **D6a is merged** while the roadmap, PLAN and BACKLOG 15.113 waited for it. D6a-W can start.
6. **One open security choice was buried in a spec addendum:** a reset by code leaves other sessions signed in. Raised as
   Q168 with a recommendation.
7. **Hobby allows one WAF rate-limit rule.** The `/api/v1` go-live rule (15.22) and the MCP endpoints must share it.

## 4. Not changed, for the coordinator

These files are outside this task's write set or belong to running agents.

| File | What is stale | Suggested fix |
|---|---|---|
| `HANDOVER.md` line 19 | "No Vercel project exists yet" contradicts item 3 (project created, preview deployed) | Delete the sentence |
| `HANDOVER.md` section 1 | "verified on this uncommitted session branch", "child-branch DB integration remains blocked" | Mark as 24 Oct history, as the section header already half says |
| `CLAUDE.md` | "Deployment is out of scope until the hosting is chosen (`docs/v2/PLAN.md` R-8)" | Hosting is chosen; deployment still needs the owner's approval of a named commit |
| `CLAUDE.md` "Platform" | "a static export ... until lane API-0 makes it a server build" | API-0 is done; it is a server build |
| DATA-ROADMAP rows D3a, D4a, D7-R, D9-R | "not started" | The running agents update at hand-back |
| STATUS.md | "Where things are", "Running now", "Services" are history (PLAN 7 already says so) | Leave; PLAN wins |

## 5. Open questions raised

| ID | Question | Recommendation |
|---|---|---|
| Q160 to Q167 | MCP sign-in choices | As in [mcp/auth-and-sign-in.md](mcp/auth-and-sign-in.md) section 12 |
| Q168 | Revoke other sessions after a password reset by code? | Yes, in EML-1 (Neon exposes `/revoke-other-sessions`) |
| carried | `planner_draft_signal` owner ruling (HANDOVER item 5) | Approve as built |

## 6. Verification of this change

`python3 tools/tree_check.py --check`, `python3 tools/relink.py check`, `git diff --check`, and the duplicate-number
greps in the hand-back report. No `web/**`, `core/**`, `HANDOVER.md` or `CLAUDE.md` file was edited.
