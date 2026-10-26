# Public repository audit, 25 Oct 2026 (PUBLIC-AUDIT)

Question: can `github.com/nitin27may/travel` go from private to public, with its whole history, branches and tags?

Scope: every object reachable from `git rev-list --all` in the local clone (1294 commits, which includes every object on
GitHub: `git ls-remote origin` lists `main`, `nitin27may-phase-e-remaining-plan`, `refs/pull/1..8/head`, 11 `archive/*` tags
and `legacy-final`, all present locally, 1224 commits reachable from them). Also the 8 PR bodies and comments (`gh pr list`),
the 248 images ever committed, and the 6082 paths ever committed. Read-only: nothing was changed, pushed or reconfigured.

Tools: gitleaks 8.30.1 (`gitleaks git --log-opts=--all --redact`, 1119 commits, 120.8 MB), a regex sweep over
`git log --all -p` (147 MB) for provider key formats, connection strings, JWTs, private keys and tokenised URLs, path-name
sweeps, PIL EXIF reads of every committed image, and targeted greps for household data. trufflehog and git-secrets are not
installed and were not needed.

This report names no secret, and on purpose does not repeat the household strings it found (it would leak them again
the moment the repo goes public). The exact strings for the scrub list are in the audit hand-back to the coordinator, not
in git.

## Verdict

**NOT SAFE as it stands. SAFE AFTER FIXES, and the fixes need a history rewrite, not tip-only edits.**

There are no credentials anywhere in history, so nothing must be rotated. The blocker is household data about a minor:
the child's real first name, birth year and age appear in about 45 files across history, including roughly 20 committed
screenshots that show the name next to a dated family trip, and two imported private notes carry the family calendar,
other family members' names and past trip dates. The project's own rules (`research/README.md` section 9,
`docs/v2/PLAN.md` privacy rows, `core/src/privacy/home.ts` header) already say the repository must stay private until
this is dealt with.

Because GitHub keeps `refs/pull/1..8/head` (which point at old commits and cannot be deleted by the owner), rewriting
history in place is not enough. Recommended route: keep this repository private, and publish a **new** public repository
pushed from a filtered copy (section 5).

## 1. Counts

| Severity | Count |
|---|---|
| Critical (live secret exposed) | 0 |
| High | 4 |
| Medium | 5 |
| Low | 7 |
| Info (verified clean) | 6 |

## 2. Findings

| ID | Sev | What | Where (path, commit) | Evidence (redacted) |
|---|---|---|---|---|
| H1 | High | Real first name of the owner's child, with birth year and age, used as the sample traveller in specs, prototype data, tests and generated HTML | 41 files at tip, 21 commits add or change it: `docs/v2/features/F01-household-and-profiles.md`, `docs/v2/ux/screens/S17-people-and-household.md` (name with birth year), `S04`, `S07`, `S08`, `S13`, `S15`, `S18`, `docs/v2/02-experience.md`, `docs/v2/design/{interactions,scenario-check,trip-scope-scenarios}.md`, `docs/v2/design/foundation/{patterns,review}.md`, `specimen.html`, `docs/v2/design/redesign/**` (html and `build/*.py`), `docs/v2/mcp/client-recipes.md`, `docs/v2/build/public-site/{BACKLOG,audit-R1-output}.md`, `data/seed/prototype/trip.ts`, `web/scripts/snapshot-prototype.mjs`, `web/tests/data/{allowlist,public-privacy.test}.ts`; history also `prototype/src/**`, `web/app/specimen/Specimen.tsx` | `{ name: "A****", age: 10 }`, "A**** (2015)", a passport-expiry line naming the child |
| H2 | High | The same name rendered into committed screenshots next to the household and real planned dates | `docs/v2/design/scenario-check/proto-*.png` (20 paths in history), `docs/v2/design/redesign/shots/**` (64 paths), likely `docs/v2/design/trip-page/mock/shots/*`, `docs/v2/design/suitability-display/mock/shots/*`. Verified on `proto-s9-share.png`: the owner, "Partner" and the child's name above the trip's real July 2027 date range | Image text cannot be scrubbed by `--replace-text`; the files must be removed from history |
| H3 | High | Imported private vault notes with household data | `research/vault-notes/Plan.md` (added cf2fd162, 17 Oct): family calendar, the child's school calendar, passport checks for all family members, the owner's 40th birthday (gives birth year), yearly budgets. `research/vault-notes/archive/India Trip Oct-Nov 2024.md`: spouse and child first names, a parent, the extended family's town, exact Oct-Nov 2024 dates. `research/vault-notes/Travel Preferences.md`: home town, party of 4, children's age band | The project already records this: `research/README.md` line 255 "vault-notes/Plan.md holds household data, so the repository stays private" |
| H4 | High (process) | GitHub keeps pull-request refs that a force-push cannot remove | `refs/pull/1/head` .. `refs/pull/8/head` on origin (e.g. `ac9d897`, `105b0c2` (private history), `d65c2ca`) | After a filtered force-push, the old commits stay fetchable by SHA and through the PR pages. Only GitHub Support can purge them, or a new repository avoids them |
| M1 | Medium | The household home point is a constant in code, and the module says visibility change is blocked until it moves to a secret | `core/src/privacy/home.ts` (`HOME_POINT`), 15 commits touch the value (`268b4e00`, `86ef0a06`, `711c85f5` and others), plus `web/tests/privacy.test.ts`, `web/tests/globe/privacy.test.ts` history | 2-decimal point, 0.69 km from the GeoNames centroid of the home town: town level, not a street address. No higher-precision home coordinate exists anywhere in history (all 4-5 decimal points near it are the town centroid from Nominatim or GeoNames) |
| M2 | Medium | Home town named throughout | 122 files at tip, 1138 added or removed lines in history (`HOME_TOWN` regex, legacy pages, docs, tests, `data/reference/towns/ca.json`) | Already public: the legacy site serves it (`nks-travel.pages.dev/vermont-fall-2026/` returns 200 with 25 mentions). Scrubbing is impractical; this is an owner decision, not a blocker |
| M3 | Medium | Third-party copyrighted images | `research/inbox/2026-10-17-*.png`, `2026-10-19-*.jpg`, `2026-10-22-*.jpg` (screenshots of saved Instagram and other social posts); `docs/v2/reference/wanderlog-*.{png,webp}` (4 screenshots of a competitor's app); `research/reports/map-stack/*google-legacy-embed*.jpg` and the earlier `docs/v2/research/map-stack/` copies (Google Maps imagery) | Fine in a private working repo; a takedown target in public. The text records paraphrase the posts and carry no post URLs, which is acceptable |
| M4 | Medium | No licence or attribution file for a public repo that redistributes OSM and CC BY-SA material | Repo root has no `LICENSE`/`NOTICE`; `data/tracks/*.json` (ODbL, `© OpenStreetMap contributors`), `web/public/globe/**`, `data/reference/towns/*` (GeoNames, CC BY), Commons photo attributions in `data/capture/**` | ODbL share-alike applies to a published derived database; CC BY and BY-SA need visible attribution. Fonts are fine (OFL files present in `docs/v2/design/redesign/fonts/`) |
| M5 | Medium | Prototype seed data reads as a real booking set | `data/seed/prototype/trip.ts` (and `prototype/src/data/trip.ts` in history): real child name, "Partner", flight AC 892, seats, a booking code `K7****`, car voucher, guest ages | The bookings are invented ("Example hotel"), but combined with H1 they look like the family's real July 2027 reservations. Rename the travellers and it becomes harmless |
| L1 | Low | Cloud account identifiers | Neon project `damp-****`, org `org-fancy-****`, endpoint `ep-quiet-****`, branches `br-damp-****`, `br-soft-****`, a Neon Auth host; Vercel project `prj_h6vE****`, team slug in preview URLs `*-nitin27mays-projects.vercel.app`, beta host `travel-beta-****.vercel.app` (71 lines). Mostly `docs/v2/build/public-site/NEON-VERIFICATION.md`, `HANDOVER.md`, `docs/v2/PLAN.md`, `core/test/db/*` | Identifiers, not credentials. They tell an attacker which endpoint to target. Acceptable if the controls in section 7 are on |
| L2 | Low | Owner email | `docs/v2/mcp/auth-and-sign-in.md:741`, `docs/v2/features/requests-and-custom-places.md:433`, `legacy/vermont-fall-2026/PLAN.md:499`; 35 lines in history | Acceptable (it is the GitHub account's own identity). It names the admin account, so admin must never be granted from an email match before verification; `role` defaults to `user` in `core/src/db/migrations/0002_people.sql:7` and no code grants admin by email today |
| L3 | Low | Local absolute paths | `/Users/nks/workspace/travel` and `travel-wt/v2-*` in 29 tip files (briefs, HANDOVER, PLAN) | Leaks the local username only. Cosmetic |
| L4 | Low | Cloudflare quick-tunnel host names | 3 `*.trycloudflare.com` names in history | Ephemeral, already dead. Informational |
| L5 | Low | Project Claude Code hooks | `.claude/settings.json` runs `tools/hooks/*.sh` on Write/Edit and Bash | No tokens or absolute paths (`$CLAUDE_PROJECT_DIR`). A visitor who opens a clone in Claude Code and trusts it runs them; say so in the README |
| L6 | Low | Third-party email in photo attributions | `pjt56@gmx.net` in Commons author strings, `data/capture/iceland-ring-road-2027/migrated.json`, `research/runs/DATA-D5b/*` | Part of the required CC attribution and public on Commons. Keep |
| L7 | Low | Local-only refs that must never be pushed | 93 local `public/*` branches and 28 `refs/copilot/checkpoints/*` (not on GitHub) | A `git push --all` or `--mirror` after the flip would publish them. Push explicit refs only |
| I1 | Info | Secrets: clean | gitleaks: 58 hits, all false positives (`class_key` vocabulary in `data/relevance/**`, test constants such as `test-secret-0123…`, `quota-secret-0123…`, `token=abcdef…`) | Regex sweep found no Neon `npg_` passwords, no `re_` Resend keys, no Turnstile `0x4AAAA` secrets, no `AIza` Google keys, no `GOCSPX` client secrets, no GitHub tokens, no JWTs, no private keys, no `sk-` keys, no ORS keys. Every `postgres://` URL is a placeholder (`u:p`, `${SENTINEL}`) |
| I2 | Info | Secret files: never committed | 6082 historical paths: no `.env*`, `*.pem`, `*.key`, `client_secret_*.json`, `.vercel/`, `.neon`, cookie or database files | `.gitignore` covers `.env`, `.env.*`, `.vercel`, `.neon`, `client_secret_*.json`, `private-origin.local.json`. The working copy's `.env` and `.env.local` are untracked |
| I3 | Info | Turnstile test keys | `core/src/config/auth-limits.ts:80` | Cloudflare's published dummy secrets; `web/lib/server/turnstile.ts` refuses them in production |
| I4 | Info | No EXIF GPS or camera data | all 248 images ever committed | none |
| I5 | Info | No household contact or identity numbers | phones in history are businesses; no street address, postal code, passport, card or plate number | none |
| I6 | Info | PRs and issues | 8 PR bodies and comments scanned; 0 issues; 0 forks | clean |

## 3. Size

Pack 95 MiB, 9381 blobs, 332 MiB uncompressed. Largest blob 2.7 MiB (`docs/v2/design/suitability-display/mock/shots/*.png`).
JSON is 152 MiB uncompressed across history, mostly `data/schema/generated/schema.json` (about 2 MiB, 15 versions) and
the globe geometry. Media is 77 MiB in 248 files. Nothing near GitHub's limits; no LFS needed. Dropping the H2
screenshots in the rewrite also cuts about 35 MiB of PNG and WebP.

## 4. Does history need rewriting?

Yes. H1, H2 and H3 are in hundreds of commits; deleting them at the tip leaves every one readable in history, in the
archive tags and in the PR refs. Tip-only fixes are enough only for M1, M4, L1 to L3 and L5.

## 5. Ordered fix list

| # | Fix | Size |
|---|---|---|
| 1 | Decide the route. Recommended: keep this repo private and create a **new** public repo (for example `travel-public`) from a filtered clone. This avoids the `refs/pull/*` problem (H4), the cached commit views and the 11 archive tags. Alternative: rewrite in place, force-push every branch and tag, then ask GitHub Support to purge the PR refs and cached views before flipping | S (decision) |
| 2 | At the tip on `main`: replace the child's name in all 41 files with an invented name, change the birth year and ages so they do not match the real child, and remove "Partner" pairings that mirror the household (H1, M5) | M |
| 3 | At the tip: delete `research/vault-notes/Plan.md`, `research/vault-notes/archive/`, `research/vault-notes/Travel Preferences.md` (move them back to the private vault); update `research/README.md` line 255 and `research/vault-notes/README.md` (H3) | S |
| 4 | At the tip: move `HOME_POINT` (and, if the owner wants, the `HOME_TOWN` pattern) into an environment variable read at build time with a fail-closed default, as `core/src/privacy/home.ts` already requires; keep the privacy tests working from a fixture point that is not the home (M1) | M |
| 5 | At the tip: delete the 3 `research/inbox` screenshots, the 4 `docs/v2/reference/wanderlog-*` images and the Google map-stack JPGs; keep the text notes (M3). Regenerate or delete the H2 screenshots after step 2 so new shots show the invented name | M |
| 6 | Add `LICENSE` for the code (owner's choice), and a `DATA-LICENCE.md` / `NOTICE` covering ODbL (OSM tracks and globe data), GeoNames CC BY, Commons photo attributions, and stating that trip prose is all rights reserved if that is the intent (M4) | S |
| 7 | Optional tidy at the tip: replace `/Users/nks/...` paths with repo-relative ones (L3); redact Neon and Vercel ids in docs to `<project-id>` (L1) | S |
| 8 | Rewrite history in a fresh mirror clone with `git filter-repo` (install it locally; it is not installed): `--invert-paths` for `research/vault-notes/Plan.md`, `research/vault-notes/archive/`, `research/vault-notes/Travel Preferences.md`, `research/inbox/*.png`, `research/inbox/*.jpg`, `locations/inbox/` images, `docs/v2/reference/wanderlog-*`, `docs/v2/design/scenario-check/proto-*`, `docs/v2/design/redesign/shots/`, `docs/v2/design/trip-page/mock/shots/`, `docs/v2/design/suitability-display/mock/shots/`, `*/map-stack/*google*`; plus `--replace-text` with a private, untracked expressions file holding the child's name, the spouse's name, the extended-family town and the 2-decimal home point. Keep only `main` (and `legacy-final` if wanted); drop `archive/*` tags and the `public/*` and `copilot` refs | L |
| 9 | Re-scan the filtered repo before the first push: `gitleaks git --log-opts=--all`, and `git log --all -p` grepped for every term in the expressions file; expect zero hits. Open three screenshots that survived and check them by eye | S |
| 10 | Create the new repo, push `main` (and chosen tags) by explicit refspec, apply the settings in section 7, then flip it public. Leave the old repo private (or archive it) | S |

Notes:
- Filtered commits get new SHAs. Commit hashes cited in `docs/v2/**`, `BACKLOG.md` and run records will point at the
  private repo; that is acceptable, but say so in the new README.
- `core/src/privacy/home.ts` with an env-based point means a fresh clone needs the variable for the privacy scrub; give
  CI a decoy point and keep the real one only in the publishing environment.

## 6. Secrets to rotate

**None required.** No credential was ever committed (I1, I2), and the PR bodies are clean (I6). The local `.env` and
`.env.local` are untracked and must stay so. If any of these was ever pasted into a GitHub issue, discussion, wiki or a
GitHub Actions log (none exist today), rotate it: `DATABASE_URL` / Neon role passwords, `NEON_AUTH` / Better Auth secret,
`RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`, `AUTH_QUOTA_SECRET`, ORS key, Google OAuth client secret, Vercel and Cloudflare
tokens.

## 7. Settings to apply at the flip

GitHub repository settings (Settings, Code security, Actions):
- Secret scanning: on. Push protection: on (also the account-level "push protection for yourself").
- Dependabot alerts and Dependabot security updates: on. Dependency graph: on.
- Private vulnerability reporting: on; add a short `SECURITY.md`.
- Actions, General: "Require approval for all outside collaborators" for fork PR workflows; workflow permissions
  "Read repository contents" (read-only `GITHUB_TOKEN` by default), and "Allow GitHub Actions to create and approve pull
  requests" off.
- Never use `pull_request_target` with a checkout of the PR head; fork PRs get no secrets under `pull_request`, keep it
  that way. Put deploy keys and DB URLs in Environments with required reviewers, scoped to `main`.
- Branch protection (ruleset) on `main`: no force-push, no deletion, PRs required.
- Disable the wiki (unused, `has_wiki: true` today); keep issues only if the owner wants public reports.
- Public repos get free standard-runner Actions minutes, so the planned `check-all` CI costs nothing; pin third-party
  actions to a full commit SHA.

Service side, because the identifiers in L1 become public:
- Neon: strong role passwords, `travel_app` stays `NOBYPASSRLS` (it is), consider IP allow-listing on the production
  branch.
- Vercel: Deployment Protection on preview deployments (the preview host names are in history); production env vars only
  in the production environment.
- Cloudflare Pages: nothing new; the legacy site is already public.

## 8. Open questions for the owner

1. Are the other sample names in the design specs (a partner name and a second child name next to H1) real people? They
   were treated as invented; if either is real, add it to the scrub list.
2. Is naming the home town acceptable in public? It already is on the live legacy site (M2). If not, the legacy pages
   must change too, which backlog 7.11 freezes.
3. New public repository or in-place rewrite plus GitHub Support (fix 1)?
4. Which licence for code, and is trip prose meant to be reusable?
