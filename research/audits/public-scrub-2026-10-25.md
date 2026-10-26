# Public scrub, 25 Oct 2026 (PUBLIC-SCRUB)

Follows `research/audits/public-repo-audit-2026-10-25.md` (fix list section 5, settings section 7). The owner decided on
25 Oct 2026 that the repository goes public and asked for the data to be scrubbed. This lane did the tip scrub on the branch
`public/PUBLIC-SCRUB` and prepared a filtered history **locally only**: nothing was pushed, no remote ref was deleted, no
visibility or GitHub, Vercel or Neon setting was changed.

Like the audit, this report names no household string and no coordinate. The scrub list lives outside git, in a mode-600
file in the lane's scratch directory; every scan below reports counts only. Terms are numbered: term 1 is the child's real
first name, term 2 the spouse's first name, term 3 the extended family's town, term 4 a misspelling of that town; "the
point" is the household home point at two decimals.

Model: Opus 5.5 (`claude-opus-5-5`), as `travel-builder` with an Opus override (the task touches a shared privacy contract
and history rewriting).

## 1. What changed on the branch

| Commit | What |
|---|---|
| `fix(privacy): read the household home point from the environment` | `core/src/config/home.ts` (new) resolves `HOME_POINT_LAT` and `HOME_POINT_LON` from the environment, else the git-ignored root `.env.local`, then `.env`; no default in code. Unset, the first `nearHome()` throws `E_HOME_POINT_UNSET` (fail closed). `core/src/privacy/home.ts` no longer holds the point; it caches the resolved one. The unit tests (core and web, `core/test/setup/home-point.ts`) use the configured point when there is one and otherwise inject an open-ocean decoy, so a fresh clone still runs every privacy test. The probe resolves the point the same way instead of parsing the source. New tests: half a point, a malformed value and no source all fail with the clear error; the env file fallback works and the environment wins; neither module holds a coordinate pair. HANDOVER, PLAN, EXECUTION-PLAN, the env table and the CONS baseline note updated |
| `docs(privacy): replace the sample child with an invented one ...` | Term 1 replaced by **Kai** in 41 files (specs, screens, design mocks and their `build/*.py`, the specimen, MCP recipes, BACKLOG, the prototype seed, `web/scripts/snapshot-prototype.mjs`, `web/tests/data/{allowlist,public-privacy.test}.ts`). The birth year moves two years later and every age moves with it (the "via ferrata needs 12+" and passport scenarios still read the same); the invented second child moves two years too, so the two do not collide; the passport dates in the examples moved. The prototype seed now opens with an EXAMPLE DATA header and uses invented travellers (Rowan, Sam, Kai), "Example flight" and "Example car hire" titles, an example airline and car-hire desk, `.example` contacts, new booking codes and example voucher and attachment names |
| (same commit) privacy guard | `web/tests/data/public-privacy.test.ts` checks the seed travellers are the invented names and adds a guard that fails when any term of a private list appears in a tracked file, the prototype snapshot or a built site. The list is read from `PRIVATE_TERMS_FILE` or the git-ignored root `.private-terms` (added to `.gitignore`); it is never committed. Without it the guard skips |
| `chore(research): remove the imported vault notes that hold household data` | The family plan, the travel preferences note and the archived past trip removed from `research/vault-notes/` (they stay in the private vault). `research/README.md` section 9, `research/vault-notes/README.md`, `docs/v2/CLEANUP-PLAN.md`, `docs/v2/migration/inventory.md` updated; the audit's mentions of the removed paths baselined in `tools/tree_contract.json` |
| `chore(assets): remove third-party images` | 3 screenshots of saved social posts in `research/inbox/` (text records kept), 4 screenshots of a competitor's app, 3 Google Maps embed captures in `research/reports/map-stack/`. The docs that linked them describe them in words |
| `chore(design): remove committed screenshots that show household names and real trip dates` | 65 images: every prototype (`proto-*`) and redesign (`design-*`) capture in `docs/v2/design/scenario-check/` except the places capture, and the whole redesign shot set. Checked by eye before deleting (a sample from each set): the redesign and prototype captures show the old sample name, real trip dates and the home town. Kept after checking: `docs/v2/design/scenario-check/design-places-t1.png`, the trip-page mock shots and the suitability-display mock shots (no household names). Not regenerated. `scenario-check.md` keeps the shot names as labels, the redesign index drops its thumbnails (`build/index_page.py` too) |
| `docs(repo): add the licence, the third-party notice and a security policy` | `LICENSE` (MIT, code only), `NOTICE` (OpenStreetMap ODbL, GeoNames CC BY 4.0, Natural Earth public domain, Commons per image, the other register entries, OFL fonts, trip prose all rights reserved; every statement taken from `data/reference/licences.json`, `data/tracks/README.md`, the towns manifest and the OFL files), `SECURITY.md` (GitHub private vulnerability reporting), and a public notice in `README.md` (licences, invented sample data, the home point variables, filtered history, Claude Code hooks) |
| `docs(env): document PRIVATE_TERMS_FILE` | The hardcode scan requires every env name read to have a row in the env table |
| merge of `main` (BUDGET-FIX) | `main` moved during the lane; no overlap |

No `.github/` workflow was added (LOCAL-4 owns CI). No CODEOWNERS.

## 2. Environment variables and who sets them

| Name | Read by | Who sets it, where |
|---|---|---|
| `HOME_POINT_LAT`, `HOME_POINT_LON` | `core/src/config/home.ts` `resolveHomePoint()`, called once by `core/src/privacy/home.ts` `nearHome()`. `nearHome()` is used by `core/src/privacy/origin.ts` (`scrubOrigin`, the public adapter's origin scrub in the web build, re-exported as `web/lib/public/origin.ts`), `core/src/privacy/detect.ts` (`privacyHits`, the household-point detector of the API and the server privacy guard `web/lib/server/privacy.ts`), `core/src/privacy/towns.ts` (`safeTown`, the town rule), `core/src/relevance/inputsCheck.ts` (the relevance input check, `relevance.ts check` in check-all) | **Owner**: Vercel project, Production and Preview environments (Development too if `vercel env pull` is used). **Owner**: the root `.env.local` of the main checkout and of any worktree that runs check-all (without it check-all now stops at the relevance step with `E_HOME_POINT_UNSET`). **LOCAL-4**: CI gets a decoy pair as repository secrets, never the real point |
| `PRIVATE_TERMS_FILE` (optional) | `web/tests/data/public-privacy.test.ts` | Owner or coordinator, locally only: path to the private list. Without it, the git-ignored root `.private-terms`; neither, the guard skips. Never in CI logs or Vercel |

Precedence is the same as `web/scripts/with-root-env.mjs`: the inherited environment wins over the root file.

## 3. Scan results

Counts only. "History" is `git log --all -p` (every patch line); "tip" is `git grep -I -i -w` on the branch.

| Scan | Before | After |
|---|---|---|
| Term 1, tip (tracked files) | 67 lines in 41 files (audit) | **0** |
| Term 2, tip | 12 lines in 6 files, of which 1 a real mention (the rest are a test-assertion method name that contains the same letters) | **0** whole-word |
| Term 3, tip | 3 lines in 2 files | **0** outside the GeoNames towns layer; **1** row inside it (see 5.2) |
| Term 4, tip | 3 lines in 1 file | **0** |
| The point, tip (both numbers as a pair; any tracked file) | 1 file (`core/src/privacy/home.ts`) | **0** |
| Term 1, history (whole refs set, all patch lines) | 169 | **0** (also 0 as a substring, 0 in messages, 0 in paths) |
| Term 2, history | 2 | **0** whole-word (12 substring hits are the method name above) |
| Term 3, history | 5 | **1** (the towns-layer row, added once) |
| Term 4, history | 6 | **0** |
| The point, history (pair forms: object literal, `lat,lon`, `lon,lat`) | 20 lines | **0** |
| Removed paths in `git log --all --name-only` | present | **0** |
| gitleaks (`gitleaks git --log-opts=--all --redact`) | 58 findings, all false positives (audit I1) | 58, the same false positives: `class_key` vocabulary in the relevance sidecars and vocab, and test constants (`token=...`, `SECRET = "..."`, `AUTH_QUOTA_SECRET` test value). No credential |

The guard in `web/tests/data/public-privacy.test.ts`, run with the private list, passes on the branch and in the filtered
copy (tracked tree, snapshot and the three built sites).

## 4. The filtered history (local only)

Path: `/private/tmp/claude-501/-Users-nks-workspace-travel/7c94cc19-af86-4a44-b307-85be51e879c1/scratchpad/filter/filtered.git`
(a bare mirror with **no remote configured**, so it cannot push by accident).

How it was made:
1. `git clone --mirror` of the local repository (1320 commits over every ref: `main`, one copilot branch, 96 `public/*`
   branches, 28 `refs/copilot/checkpoints/*`, 10 `archive/*` tags, `legacy-final`, 3 remote-tracking refs).
2. `refs/heads/main` set to the tip of `public/PUBLIC-SCRUB` (a fast-forward of local `main`); every other ref deleted except
   `refs/tags/legacy-final`; the remote removed. 1248 commits remain reachable.
3. `git filter-repo` (installed into a venv in the scratch directory) with `--invert-paths --paths-from-file` for: the three
   household vault notes, the redesign shot folder, `research/inbox` and the old `locations/inbox` PNG and JPG files, the
   competitor screenshots, every `*map-stack/*google*` file (both the current and the older `docs/v2/research` copies),
   every prototype capture and every redesign capture in the scenario check except the places capture; and
   `--replace-text` plus `--replace-message` with the private expressions file (term 1 in every case and possessive,
   with the birth year and the adjacent ages shifted like the tip, the passport example dates, term 2 as a whole word, and
   the point in its three pair forms, replaced by the test decoy). Term 3 is **not** in the expressions: its only
   occurrence outside the removed note is the verbatim GeoNames row (5.2), and rewriting it would break the towns
   manifest hashes in every commit after it.
4. Result: **1250 commits** (none emptied; 1248 before this report's two commits were added and the mirror rebuilt), refs `main`
   and `legacy-final` only, pack **88.2 MiB** on the final build (96.7 MiB before filtering with the same two refs; an earlier build of
   the same content packed to 76.6 MiB, so the figure depends on the repack). 19,071 objects, none unreachable.
5. Proof it still builds: a working clone of the mirror, `pnpm install`, then `bash tools/check-all.sh` with the point and
   the private list in the environment passes every step (python, core and web tests, both typechecks, the web build and
   server, the folder contract, the hardcode scan). The full run stopped once, on the timing budget test
   `web/tests/api/revision-timing.test.ts` (first call under 300 ms, missed under load); it passes when run alone, and the
   steps after it (server answers, OpenAPI, slugs) were then run and end `CHECK-ALL OK`. The same check-all passes on the
   branch itself in one run. Without the point the relevance check stops with `E_HOME_POINT_UNSET`, as designed.

All commit ids change. Commit ids quoted in tracked files point at the private history (section 5.5).

## 5. Remaining risks and owner decisions

1. **Home town named in about 122 tracked files** (audit M2): the scrub pattern, legacy pages, trip research, two day-trip
   vault notes that also give the party's age band, tests and the GeoNames layer. It is already public on
   the live legacy site. Owner decision; not changed here.
2. **The extended family's town is one row of the GeoNames towns layer** (`data/reference/towns/`, a large city of its
   country, selected mechanically by population; the file is the public gazetteer verbatim and its hashes are pinned).
   With the vault note gone it names no one. Removing it means changing the towns filter (`tools/towns.py`, the META-2
   trust root) and is an owner decision.
3. **Owner email** in three docs (audit L2) names the admin account: admin must never be granted from an email match
   before verification (today it is not).
4. **Neon and Vercel identifiers** (audit L1: project, endpoint and branch ids, preview host names) stay. Apply the service
   controls in the audit's section 7 before the flip.
5. **Stale commit ids.** 684 mentions of a commit id that exists in the private history, in 87 tracked files: BACKLOG 226,
   `docs/v2/PLAN.md` 36, `HANDOVER.md` 15, `CHANGELOG.md` 1, other build and feature docs (about 380), about 11 run notes
   in `research/runs/`, 7 audits, one code comment (`core/src/catalogue/store.ts`), 4 test comments, and one in
   `data/capture/gap-budget.json`. None is fixed; the README notice says they refer to the private history. The database's
   `catalogue_meta.seed_commit` stamp on Neon also names a private commit; the next seed run overwrites it (the seed diff
   is by content, not by commit).
6. **Dangling screenshot paths.** Three records of the locations store, two inbox JSON records and two test fixtures
   still name the removed social-post screenshots as provenance. Harmless text; clearing it needs the `location` skill.
7. **Sample party.** Specs and mocks still read "Nitin, Partner, Kai": owner, a partner and one child. The child's name, age
   and birth year are invented now; the other sample names (a partner name and a second child) were treated as invented,
   as the audit did. The trip-page mock named the planned party with a child's age (public page copy; rewritten by HOUSEHOLD-SCRUB).
8. **Images not read by machine.** Image text cannot be grepped. Kept images were checked by sample; the 248 images in
   history outside the removed sets (legacy galleries, globe and live-site captures, the old specimen photos) were not
   each opened.
9. **Unmerged work.** 96 `public/*` branches and the worktrees are on the private history; after a switch to the public
   repository they need `git rebase --onto` or a re-apply.
10. **Scratch copies.** The scratch directory holds the private list, the before and after history dumps and the mirror.
    Delete it (`rm -rf` the `scrub-private` and `filter` folders) once the publish is done.
11. **The private repository** still holds everything (history, archive tags, PR refs). Keep it private or archive it.

## 6. Publish procedure for the owner (not executed)

Recommended route: **a new public repository** pushed from the filtered mirror (avoids the GitHub `refs/pull/*` refs and
cached commit views, audit H4).

1. Review this report and the branch; merge `public/PUBLIC-SCRUB` into `main`. Add `HOME_POINT_LAT` and `HOME_POINT_LON` to
   the root `.env.local` of the main checkout first, or check-all stops at the relevance step.
2. If `main` moved after this lane, rebuild the mirror from the new `main` with the same three steps (section 4: mirror,
   keep `main` and `legacy-final`, `git filter-repo --force --invert-paths --paths-from-file <paths> --replace-text <expr>
   --replace-message <expr>`). The path and expressions files are in the scratch directory.
3. Re-scan the mirror: `gitleaks git --log-opts=--all --redact` (expect the 58 known false positives); grep `git log --all -p`
   for every private term (expect 0, except the one towns-layer row for term 3); `git log --all --name-only` for the removed
   paths (expect 0). Open three kept screenshots by eye.
4. On GitHub, create an **empty private** repository (no README, licence or gitignore), for example `travel-public`. Turn on
   secret scanning, push protection and private vulnerability reporting before the first push.
5. From the mirror: `git remote add public <new repo URL>`, then push **explicit refspecs only**:
   `git push public refs/heads/main:refs/heads/main refs/tags/legacy-final:refs/tags/legacy-final`. Never `--mirror` or `--all`.
6. Apply the audit's section 7: Dependabot alerts and updates, ruleset on `main` (no force-push, no deletion, PRs required),
   Actions read-only token and fork approval, wiki off.
7. Vercel: link the project to the new repository; set `HOME_POINT_LAT` and `HOME_POINT_LON` in Production and Preview;
   turn on Deployment Protection for previews. Redeploy and check `/api/v1/health`.
8. Flip the new repository to public. Leave the old one private (or archive it).
9. Move day-to-day work to a clone of the new repository: re-create worktrees from it, rebase or re-apply the open
   `public/*` branches, and set the private list for the guard (`PRIVATE_TERMS_FILE` or a root `.private-terms`).

Alternative (not recommended): rewrite the existing repository in place. Force-push the filtered `main` and
`legacy-final`, delete the `archive/*` tags and the copilot branch on GitHub, then ask GitHub Support to purge
`refs/pull/1..8/head` and the cached commit views before flipping visibility. Until Support confirms, the old commits stay
fetchable by id.
