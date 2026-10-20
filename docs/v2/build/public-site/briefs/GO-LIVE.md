# GO-LIVE: phase D, after the owner's approval at R2

- **Agent:** the coordinator, with `travel-verifier` (Sonnet) for the post-publish check. The owner does the dashboard and console steps.
- **Effort:** about 8 h on the day, 1 h on day 7, 2 h of cleanup later.
- **Rows:** 7.1 to 7.12, 2.42, 2.46, 2.48, Q43 to Q46, Q48, Q49, Q71.
- **Plan:** [EXECUTION-PLAN.md](../EXECUTION-PLAN.md) section 12 (the ordered checklist with rollback per step). Replaces [STAGE4-plan.md](../STAGE4-plan.md) section 6.
- **Principles:** P8 (edge layer), T5.
- **Starts:** only after the owner's Q43 approval of a named commit at R2 exit.

## Goal

The new site replaces the old one at a custom domain and at `nks-travel.pages.dev`, with the old URLs redirected, edge protection on, the Google key restricted, and a clean rollback for the first week.

## Read first

- EXECUTION-PLAN section 12 and 16; `tools/publish.py` (`--product`, `--legacy-status`, `--go-live`, `HEADERS`, `write_redirects`); `web/app/robots.ts`; HANDOVER section 4 (secrets and the Cloudflare login).

## Files you own

The go-live commits only: removing `web/app/specimen/**` and its sitemap and robots entries, `web/app/robots.ts` (AI crawler list), `tools/publish.py` (header paths for `/list/*` and `/globe/city/*` if missing), `docs/v2/design/foundation/principles.md` (the P8 export wording, Q46), and the status docs (STATUS, MASTER-PLAN, BACKLOG, CLAUDE.md, README) after the deploy.

## Do not touch

Feature code. Anything found during go-live becomes a BACKLOG row; a blocking one stops the run and goes back through a fix lane and re-approval.

## Steps

Follow EXECUTION-PLAN section 12 steps 1 to 16 in order. Points that are easy to get wrong:

1. Build with `SITE_ORIGIN` set to the custom domain (Q71) so canonicals, the sitemap and OG URLs use it; `nks-travel.pages.dev` stays served.
2. Never print `web/.env.local`; check the ORS key is absent from `.site/` by its first 8 characters.
3. `./publish.sh --product --go-live` only from the frozen, approved commit; the default `./publish.sh` is the old mixed mode.
4. Redirects are 302 for seven days. Step 15 (301) only if no rollback happened.
5. The owner restores the Google key restrictions and sets a daily quota after the deploy, then the verifier checks place and trip maps on both hosts.
6. Cleanup (worktrees, tunnels, `legacy/`) only with the owner's confirmation of each deletion.

## Acceptance checks

| # | Check |
|---|---|
| 1 | Every sitemap URL returns 200 on both hosts |
| 2 | All 461 old URLs resolve by file or redirect |
| 3 | Headers per path as step 6; robots blocks the AI crawlers by name |
| 4 | Place and trip maps load with the restricted key; a request from another host is refused |
| 5 | Near mode, town parts, city outlines and every export work on production |
| 6 | Lighthouse on production meets the STAGE4-plan 5.3 targets |
| 7 | The metadata report and hard-coding baseline are unchanged from the approved commit |

## Server switch

Go-live keeps every seam on its static adapter with all `capabilities` flags off. The switch-over later follows EXECUTION-PLAN section 13; nothing in this run makes it harder (no feature reads a path the static adapter owns).

## Verification

`bash tools/check-all.sh` (env file aside) and the quiet-machine e2e on the frozen commit; `./publish.sh --product --dry-run` before the real run; the verifier's post-publish sweep at 1440 and 390, light and dark, on the GPU flags, into `web/test-results/shots/GO-LIVE/`.

## Commit rules

On `main` (the product branch), one commit per step that changes files: `web: remove /specimen from the public build (7.8)`, `web: robots blocks AI crawlers (7.6)`, `docs(v2): go-live done`. `git -C /home/nitin27may/workspace/travel add <paths>`, never `-A`; Co-Authored-By trailer; push after each verified step.

## Hand-back

The deployment id, the served-URL check, header and robots results, Lighthouse table, the time of step 15, and the cleanup list for the owner to confirm.
