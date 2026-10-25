# READINESS (phase D): hosting-agnostic checks after R2. Deployment: revisit when the hosting is chosen

> **Changed 20 Oct 2026 (owner):** deployment is out of scope for now. This brief no longer deploys anything. The earlier Cloudflare Pages go-live (custom domain, `publish.sh --product --go-live`, Pages rollback, `_redirects` and `_headers` files) is superseded; those steps come back, rewritten for the chosen host, when hosting is decided (EXECUTION-PLAN 13.2).

- **Agent:** the coordinator; `travel-verifier` (Sonnet) for the checks; an Opus auditor for the privacy item. The owner does the Google console steps.
- **Effort:** about 6 h.
- **Rows:** 2.46, 2.47, 2.48, 7.1 to 7.3, 7.8 to 7.10, 14.6, Q43, Q45, Q46, Q48. Vercel is selected; project setup/deployment wait for merge-ready under R-61. Rows 7.4 to 7.7 and 7.12 require Vercel-specific review; Q44/Q71 custom domain remain open.
- **Plan:** [EXECUTION-PLAN.md](../EXECUTION-PLAN.md) section 13.
- **Principles:** P8, T3, T5.
- **Starts:** only after the owner's Q43 approval of a named commit at R2 exit.

## Goal

The approved commit is ready to run on any host that serves Next.js route handlers: privacy proven on HTML and API output, the redirect and robots policies written as data, the sitemap clean, cache rules defined, the Google key ready to restrict, secrets absent, Lighthouse numbers recorded.

## Read first

EXECUTION-PLAN 13 and 16; `web/redirects.json`, `web/app/robots.ts`, `web/app/sitemap.ts`, `web/lib/server/respond.ts` (cache headers), `tools/publish.py` (read only: the old mixed-mode publisher, kept working, not run).

## Files you own

The readiness commits only: removing `web/app/specimen/**` and its sitemap and robots entries; `web/app/robots.ts` (the AI crawler list); `web/redirects.json` (the legacy mapping and its status policy, as data); `docs/v2/design/foundation/principles.md` (the P8 export wording, Q46); the status docs after the checks (STATUS, MASTER-PLAN, BACKLOG, CLAUDE.md, README).

## Do not touch

Feature code; `tools/publish.py`; any Cloudflare or other hosting setting; `nks-travel.pages.dev` (it still serves the old site and stays as it is until hosting is chosen). A blocking finding becomes a BACKLOG row and goes back through a fix lane and a one-line re-approval.

## Steps

Follow EXECUTION-PLAN 13.1 items 1 to 12 in order. Points easy to get wrong:

1. Privacy runs over **API responses as well as HTML** (the contract kit's privacy cases plus a crawl of every endpoint for one record of each kind).
2. The redirect policy is data: every one of the 461 old URLs maps to a page, with a `status` field (302 for the first seven days after the real deploy, then 301). Nothing is served yet; the mapping test proves every URL resolves.
3. Cache rules: ETag and `Cache-Control` per path as in EXECUTION-PLAN 4.4, tested in process; long cache for hashed images.
4. Google key: the owner sets a daily quota on Maps JavaScript API now and prepares the restriction list (localhost ports and the preview host now; the real host when chosen); the Map ID style has POIs off and is shared by place and trip maps; `NEXT_PUBLIC_GOOGLE_MAPS_MAPID` is removed from `.env.local` (never print the file).
5. Secrets: the first 8 characters of the ORS key are absent from client bundles and every API response (checked locally, never printed).
6. Lighthouse on the preview: numbers recorded; the targets in STAGE4-plan 5.3 are judged again on the real host.

## Acceptance checks

| # | Check |
|---|---|
| 1 | 0 household strings in HTML and API output; Whitby only in towns rows and near chips |
| 2 | All 461 old URLs map to a page in `web/redirects.json` with their status policy |
| 3 | Every sitemap URL returns 200 on the preview; no `/specimen` |
| 4 | Robots allows search engines and disallows the AI crawlers by name |
| 5 | Cache headers per path pass the in-process test |
| 6 | Place and trip maps load with the restricted key from the allowed hosts |
| 7 | No key prefix in bundles or API output |
| 8 | The metadata report and the hard-coding baseline are unchanged from the approved commit |

## Server switch

Readiness keeps `CATALOGUE_STORE=json` and every capability flag off. Nothing here ties the site to a host or to a file layout; the switch-over (EXECUTION-PLAN 14.2) is unaffected.

## Verification

`bash tools/check-all.sh` (env file aside) and the quiet full e2e on the frozen commit; the verifier's sweep at 1440 and 390, light and dark, GPU flags, into `web/test-results/shots/READINESS/`.

## Commit rules

On `main`, one commit per step that changes files: `web: remove /specimen from the public build (7.8)`, `web: robots blocks AI crawlers (7.6)`, `web: legacy redirect map with its status policy (7.1, 7.10)`, `docs(v2): readiness done`. `git -C /home/nitin27may/workspace/travel add <paths>`, never `-A`; Co-Authored-By trailer; push after each verified step.

## Hand-back

The audit file, the redirect mapping test result, the cache test, the key and quota state, the Lighthouse table, and the list of steps still waiting on Vercel deployment or custom-domain decisions.
