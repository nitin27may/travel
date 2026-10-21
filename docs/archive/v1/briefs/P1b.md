# P1b: move the legacy pages, port publish, update the docs

## Goal

Finish the pure restructure of the travel repo: move the 15 trip folders, the legacy page builder, the globe and the list page under `legacy/`, research under `research/trips/`, and port `publish.sh` to `tools/publish.py` plus `tools/hub.py`. Nothing the public sees may change: the staged site must be byte-identical to the baseline, and every test that passes today must pass after.

## Prerequisites (state at start)

P1a is merged on `main` (commits "P1a step 1" and "P1a step 2"). Repo: `/home/nitin27may/workspace/travel` (git, remote `origin` = `github.com/nitin27may/travel`, private).

| Path | State at start |
|---|---|
| `tools/` | `locations.py`, `location_views.py`, `migrate_locations_v2.py`, `globe_data.py`, `hooks/` (`locations_changed.sh`, `prepublish.sh`, ROOT already `/../..`), `tests/` (9 test files, `fixtures/`, `fixtures/served-urls.txt`) |
| `data/` | `locations/{locations.json,WISHLIST.md,README.md}`, `reference/countries.json`, `schema/legacy/locations_schema.sql` |
| `research/` | `places/PRIORITIES.md`, `vault-notes/` |
| still at the root | the 15 trip folders, `globe/`, `locations/index.html`, `locations/inbox/`, `_system/` (build.py, base.css, base.js, layout.html, themes/, components/, migrate.py, migrate_legacy.py, README.md, gallery.py, gallery_find.py, gallery_pick.py, site/{locations.html, site.css, GLOBE-RESEARCH.md, PLAN-locations-g5.md}, untracked gallery.html and site/cache/), `AUDIT-2026-10-16.md`, `publish.sh` (full script), `CLAUDE.md` |
| `tools/location_views.py` `Paths` | `store`, `wishlist` under `data/locations/`; `countries_json` = `data/reference/countries.json`; `list_page` = `locations/index.html`; `globe_places` = `globe/assets/data/places.json`; `template`, `css` under `_system/site/`; `trips_root` = repo root |
| tests | `python3 -m pytest /home/nitin27may/workspace/travel/tools/tests -q` prints `109 passed` |

## Files you own (and nothing else)

- every `git mv` listed in step 1;
- `legacy/_system/build.py` (the `--gallery` default path and docstrings only);
- `tools/location_views.py` (`Paths` only), `tools/globe_data.py` (`ASSETS`, `CACHE`, docstring paths), `tools/locations.py` (docstring and help-text paths only, never the inbox rule);
- `tools/tests/test_globe_data.py`, `test_globe_page.py`, `test_site_outputs.py`, `test_list_page.py`, `test_locations_split.py`, `test_location_views.py`, `test_migrate_v2.py` (path constants and tmp-root layouts only);
- one added `sys.path` line in 7 builders under `legacy/*/build_page.py`;
- new: `tools/publish.py`, `tools/hub.py`, `tools/gallery/` (moved files), `legacy/MANIFEST.json`, `tools/tests/test_publish.py`, stub `README.md`, root `package.json` and `pnpm-workspace.yaml` (skeleton only, step 3);
- `publish.sh` (becomes a wrapper), `tools/hooks/prepublish.sh` (match rule only), `.gitignore`;
- text only: `CLAUDE.md`, `.claude/skills/location/SKILL.md`, `.claude/skills/trip-planner/SKILL.md`, `data/locations/README.md`, `legacy/_system/README.md`, `docs/` (moved files plus one index line).

Must not touch: `location_views.py:199-200` (the "Generated from `locations/locations.json` ... `python3 _system/tools/locations.py add`" strings: changing them changes published bytes; P2b updates them); `locations/inbox/` and every `locations/inbox/` string in code, tests and skills (P2b); `data/**` content; `docs/PLAN-platform.md`, `docs/REVIEW-platform-plan.md`, `docs/briefs/**`; any page content.

## Steps (each ends green; one commit per step)

### Step 0. Branch and baseline (no commit)

```bash
git -C /home/nitin27may/workspace/travel status --short          # expect: empty, or only docs/ files you do not own
git -C /home/nitin27may/workspace/travel switch -c phase/p1b
python3 -m pytest /home/nitin27may/workspace/travel/tools/tests -q   # expect: 109 passed
date +%F > /tmp/p1b-baseline-date
PUBLISH_DRY_RUN=1 /home/nitin27may/workspace/travel/publish.sh       # expect: "dry run: staged in .../.site, wrangler skipped"
rm -rf /tmp/site-before && cp -r /home/nitin27may/workspace/travel/.site /tmp/site-before
find /tmp/site-before -type f | sed 's#^/tmp/site-before/##' | sort > /tmp/p1b-files-before.txt
wc -l < /tmp/p1b-files-before.txt                                    # expect: about 461; note the number
for f in /home/nitin27may/workspace/travel/*/build_page.py; do python3 "$f" >/dev/null || echo "FAIL $f"; done
git -C /home/nitin27may/workspace/travel status --short             # expect: unchanged (the builders reproduce their pages)
```

The `PUBLISH_DRY_RUN` command contains `publish.sh`, so the PreToolUse hook runs the test suite first; that is expected. The baseline date matters: the hub's 12 "In N days" and "Past trip" badges depend on it, and the final diff passes `HUB_TODAY` equal to it.

Builders read `HERE = Path(__file__).resolve().parent`, so running them by absolute path writes into their own folder. If any builder changes its page at step 0, stop and report: the cause is not the move.

### Step 1. Move legacy, research, gallery and docs; fix paths (review step 3)

Moves (in this order; `git mv` renames directories on disk, untracked files inside move with them):

```bash
R=/home/nitin27may/workspace/travel
mkdir -p $R/legacy $R/research/trips $R/tools/gallery $R/legacy/locations
for s in algonquin-muskoka-oct-2026 canadian-rockies-sept-2029 chamonix-mont-blanc-sept-2028 costa-rica-feb-2027 dolomites-july-2027 iceland-ring-road new-hampshire-stopover-2026 niagara-day-aug-2026 norway-summer patagonia-feb-mar-2027 peru quebec-sept-2026 switzerland-2027 usa-southwest-rockies vermont-fall-2026; do
  git -C $R mv $s legacy/$s
  if [ -d $R/legacy/$s/research ]; then git -C $R mv legacy/$s/research research/trips/$s; else mkdir -p $R/research/trips/$s; fi
  if [ -d $R/legacy/$s/archive ]; then git -C $R mv legacy/$s/archive research/trips/$s/archive; fi
done
mkdir -p $R/research/trips/peru/notes $R/research/trips/usa-southwest-rockies/notes $R/research/trips/vermont-fall-2026/notes
git -C $R mv legacy/peru/DAYS.md research/trips/peru/notes/
git -C $R mv legacy/usa-southwest-rockies/BRAINSTORM.md legacy/usa-southwest-rockies/CALL-LIST.md research/trips/usa-southwest-rockies/notes/
git -C $R mv legacy/vermont-fall-2026/MASTER-MAP-AND-SCORES.md legacy/vermont-fall-2026/MASTER-TABLE.md legacy/vermont-fall-2026/PARKING.md legacy/vermont-fall-2026/OPTIONS-viewpoints.md research/trips/vermont-fall-2026/notes/
git -C $R mv _system legacy/_system
git -C $R mv legacy/_system/gallery.py legacy/_system/gallery_find.py legacy/_system/gallery_pick.py tools/gallery/
git -C $R mv legacy/_system/site/GLOBE-RESEARCH.md legacy/_system/site/PLAN-locations-g5.md docs/
git -C $R mv AUDIT-2026-10-16.md docs/
git -C $R mv globe legacy/globe
git -C $R mv locations/index.html legacy/locations/index.html
[ -d $R/legacy/_system/site/cache ] && mv $R/legacy/_system/site/cache $R/tools/.cache     # untracked, plain mv
ls $R/locations                                     # expect: inbox only
ls $R/research/trips | wc -l                        # expect: 15
```

Before the loose-notes `git mv`, confirm the list with `git -C $R ls-files 'legacy/*/*.md' | grep -v '/PLAN.md$'`; it must print exactly the seven notes above (if it prints more, stop and report).

Path fixes in the same commit:

| File | Change |
|---|---|
| `tools/location_views.py` `Paths.__post_init__` | `list_page = r/"legacy"/"locations"/"index.html"`; `globe_places = r/"legacy"/"globe"/"assets"/"data"/"places.json"`; `template = r/"legacy"/"_system"/"site"/"locations.html"`; `css = r/"legacy"/"_system"/"site"/"site.css"`; `trips_root = r/"legacy"`. Leave `store`, `wishlist`, `countries_json` as they are |
| `tools/globe_data.py` | `ASSETS = ROOT / "legacy" / "globe" / "assets"`; `CACHE = ROOT / "tools" / ".cache"`; docstring paths |
| `tools/locations.py` | docstring and `--help` text paths that name `_system/` or `globe/` (not the inbox ones) |
| 7 builders (`canadian-rockies-sept-2029`, `chamonix-mont-blanc-sept-2028`, `costa-rica-feb-2027`, `iceland-ring-road`, `norway-summer`, `patagonia-feb-mar-2027`, `usa-southwest-rockies`) | directly after the existing `sys.path.insert(0, str(HERE.parent / "_system"))` add `sys.path.insert(0, str(HERE.parents[1] / "tools" / "gallery"))`. In the Rockies builder `import gallery as G` is module-level at line 800, so the new line must be near line 15, which it is. `algonquin-muskoka-oct-2026/build_page.py` does not import gallery: leave it unchanged |
| `tools/tests/test_globe_data.py`, `test_globe_page.py`, `test_list_page.py`, `test_site_outputs.py` | data paths: `ROOT/"globe"/...` to `ROOT/"legacy"/"globe"/...`; `ROOT/"locations"/"index.html"` to `ROOT/"legacy"/"locations"/"index.html"`; `ROOT/"_system"/"site"/...` to `ROOT/"legacy"/"_system"/"site"/...`; `test_site_outputs.py`'s "no `locations/assets`" assertion targets `legacy/locations/assets`. Do not change any `ROOT = parents[2]` (it is still the repo root) |
| `tools/tests/test_locations_split.py` real-store test | copy `REPO/"legacy"/"_system"/"site"` to `tmp/"legacy"/"_system"/"site"`; iterate `REPO/"legacy"` children with an `index.html` (not starting with `.` or `_`) and create `tmp/"legacy"/<name>/index.html`; also create `tmp/"data"/"reference"` from the repo copy if the test needs countries. `REPO = HERE.parents[1]` stays |
| `tools/tests/test_migrate_v2.py` `--check` test, `tools/tests/test_locations_split.py` `root` fixture, `test_location_views.py` | every tmp trip folder moves under `tmp/"legacy"/<slug>` (the fixture's trips and `trip-one`) |
| `.gitignore` | `_system/gallery.html` to `legacy/_system/gallery.html`; `_system/site/cache/` to `tools/.cache/` |
| `legacy/_system/build.py` | only the `--gallery` default (`const="_system/gallery.html"`) to `legacy/_system/gallery.html`, and docstring paths; nothing else |

Find every remaining reference before committing:

```bash
grep -rn --include=*.py -E '"_system"|"globe"|_system/|globe/assets|"locations" / "index.html"' /home/nitin27may/workspace/travel/tools /home/nitin27may/workspace/travel/legacy/_system
```

Every hit must be either fixed or one of: the generated strings at `location_views.py:199-200`, the inbox strings, or a URL (`/globe/`, `/locations/` as served paths).

Checks (all must pass before the commit):

```bash
python3 -m pytest /home/nitin27may/workspace/travel/tools/tests -q                     # expect: 109 passed
python3 /home/nitin27may/workspace/travel/tools/locations.py validate                  # expect: exit 0, no ERROR lines
python3 /home/nitin27may/workspace/travel/tools/locations.py build --check             # expect: exit 0
for f in /home/nitin27may/workspace/travel/legacy/*/build_page.py; do python3 "$f" >/dev/null || echo "FAIL $f"; done
git -C /home/nitin27may/workspace/travel diff --name-only -- legacy      # expect: no output (moves are staged; a rebuilt page that differs shows here)
python3 /home/nitin27may/workspace/travel/legacy/_system/build.py --check              # expect: exit 0 (theme gate)
echo '{"tool_input":{"file_path":"/x/data/locations/locations.json"}}' | bash /home/nitin27may/workspace/travel/tools/hooks/locations_changed.sh; echo "rc=$?"   # expect: rc=0
```

Commit: `P1b step 1: move legacy pages, research and gallery; fix paths`.

### Step 2. Port publish to Python (review step 4)

1. `tools/hub.py`: a module with `def write_hub(site: Path, today: date) -> None` containing the heredoc program from `publish.sh` (the `python3 - "$SITE" <<'PYHUB' ... PYHUB` block) **verbatim**: same regexes, CSS, card HTML, header links, footer text (it still says "run ./publish.sh to update. Add a trip by creating &lt;slug&gt;/index.html beside it"; keep it), 404 page, the `print` line. The only change: `today = datetime.date.today()` becomes the `today` argument. Keep `SITE_PAGES = {'globe', 'locations'}`.
2. `tools/publish.py`: `main(argv)` with `--dry-run` and an optional project name (default `nks-travel`). Order: run `python3 tools/locations.py build` (non-zero exit fails the publish); `rm -rf .site`; stage from a route table `ROUTES`: every `legacy/<slug>/` with an `index.html` (sorted) to `.site/<slug>/index.html` plus `assets/` if present; `legacy/globe/` to `.site/globe/` (index.html and assets/); `legacy/locations/index.html` to `.site/locations/index.html` (plus `assets/` if present, there is none today); print `  staged: /<slug>/` per route as the old script did; then `write_hub(site, today)` where `today` is `date.fromisoformat(os.environ["HUB_TODAY"])` if set, else `date.today()`; if `--dry-run` or `PUBLISH_DRY_RUN=1`, print `dry run: staged in <site>, wrangler skipped` and exit 0; else run `npx wrangler pages deploy . --project-name <name> --branch main --commit-dirty=true` with `cwd=.site`. `--check`: fail if a slug in `legacy/MANIFEST.json` marked `served: true` has no `index.html`.
3. `publish.sh` becomes:

   ```bash
   #!/usr/bin/env bash
   # Thin wrapper; the logic is in tools/publish.py.
   exec python3 "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/tools/publish.py" "$@"
   ```

4. `legacy/MANIFEST.json`: `{"schema": "legacy-manifest/1", "folders": [{"slug": "...", "served": true}, ...]}` for the 15 trip folders (`peru` is `served: false`), plus `globe` and `locations` with `"kind": "site-page"`; sorted by slug.
5. `tools/hooks/prepublish.sh`: keep the existing `*publish.sh*` and `*"wrangler pages deploy"*` patterns and add `tools/publish.py` without `--dry-run`: first `*tools/publish.py*--dry-run*) exit 0 ;;`, then `*publish.sh*|*tools/publish.py*|*"wrangler pages deploy"*) ;;`.
6. `tools/tests/test_publish.py` (stdlib and pytest only; builds into a tmp dir by calling `publish.main` with `--dry-run` and a `SITE` override or a `site` parameter):
   - served-URL superset: every line of `tools/tests/fixtures/served-urls.txt` exists in the staged tree;
   - nothing from `research/` or `data/` is staged (grep the staged tree for `research/` paths and assert no file under `.site/research` or `.site/data`);
   - `legacy/` folder set equals the `MANIFEST.json` slugs (no new folder may appear);
   - reserved slugs: no `legacy/` slug is in `places trips trails activities stays eateries offers areas adventures bookings globe locations inbox api mcp data assets geo _next legacy new edit review backlog plan schema about fonts icons` except the two site pages `globe` and `locations`;
   - `HUB_TODAY` is honoured: two runs with the same value give identical hub bytes.

Checks:

```bash
python3 -m pytest /home/nitin27may/workspace/travel/tools/tests -q        # expect: 109 + the new tests, all passed
rm -rf /home/nitin27may/workspace/travel/.site
HUB_TODAY=$(cat /tmp/p1b-baseline-date) python3 /home/nitin27may/workspace/travel/tools/publish.py --dry-run
diff -r /tmp/site-before /home/nitin27may/workspace/travel/.site && echo SITE_IDENTICAL   # expect: SITE_IDENTICAL, no other output
echo '{"tool_input":{"command":"python3 tools/publish.py --dry-run"}}' | bash /home/nitin27may/workspace/travel/tools/hooks/prepublish.sh; echo "rc=$?"   # expect: rc=0 (no test run)
echo '{"tool_input":{"command":"./publish.sh"}}' | bash /home/nitin27may/workspace/travel/tools/hooks/prepublish.sh; echo "rc=$?"   # expect: rc=0 after the suite runs green
```

Run the dry run as `python3 tools/publish.py --dry-run`, not `./publish.sh`: in a session that started before step 1, the registered hook may be a stale copy (hook configuration is read at session start), and the string `publish.sh` triggers it.

Commit: `P1b step 2: port publish to tools/publish.py and tools/hub.py`.

### Step 3. Docs and skills (review step 5)

Text-only updates, paths only (no new content beyond what the move requires):

- `CLAUDE.md`: every `_system/` path to `legacy/_system/`; trip folders `<slug>/` to `legacy/<slug>/` where it means the folder; `research/*.md` to `research/trips/<slug>/`; `archive/` to `research/trips/<slug>/archive/`; `_system/gallery*.py` to `tools/gallery/`; `globe/` to `legacy/globe/`; `locations/index.html` to `legacy/locations/index.html`; `AUDIT-2026-10-16.md` to `docs/AUDIT-2026-10-16.md`; `./publish.sh` stays valid (wrapper) and add `python3 tools/publish.py --dry-run`; the "Folder contract" paragraph describes the new layout in four lines and points at `docs/PLAN-platform.md` 1.1. Leave every trip description as it is.
- `.claude/skills/location/SKILL.md` and `.claude/skills/trip-planner/SKILL.md`: the same path substitutions (leave every `locations/inbox/` reference: P2b).
- `data/locations/README.md`, `legacy/_system/README.md`: paths.
- Workspace skeleton (two small files so that P2a and P3a, which may run in parallel next, never both create them): root `package.json` = `{"name": "travel", "private": true, "packageManager": "pnpm@12.4.1", "engines": {"node": ">=22.23"}, "scripts": {"test": "pnpm -r test"}}` and `pnpm-workspace.yaml` = `packages:` followed by `  - core` and `  - web` (neither folder exists yet; pnpm accepts that). Add `node_modules/` to `.gitignore`. Run no install.
- `README.md` (new, stub, at most 15 lines): what lives in `legacy/`, `data/`, `research/`, `tools/`, `docs/`; three commands (`python3 -m pytest tools/tests -q`, `python3 tools/locations.py build --check`, `python3 tools/publish.py --dry-run`); pointer to `docs/PLAN-platform.md`.

Checks: all of step 2's checks again, plus

```bash
grep -rn -E '(^|[^y])_system/' /home/nitin27may/workspace/travel/CLAUDE.md /home/nitin27may/workspace/travel/.claude/skills | grep -v 'legacy/_system/'   # expect: no output
git -C /home/nitin27may/workspace/travel diff --stat origin/main...HEAD | tail -1
```

Commit: `P1b step 3: update CLAUDE.md, skills and READMEs; workspace skeleton`.

### Step 4. PR

```bash
git -C /home/nitin27may/workspace/travel fetch origin && git -C /home/nitin27may/workspace/travel rebase origin/main
python3 -m pytest /home/nitin27may/workspace/travel/tools/tests -q
HUB_TODAY=$(cat /tmp/p1b-baseline-date) python3 /home/nitin27may/workspace/travel/tools/publish.py --dry-run && diff -r /tmp/site-before /home/nitin27may/workspace/travel/.site && echo SITE_IDENTICAL
git -C /home/nitin27may/workspace/travel push --force-with-lease -u origin phase/p1b
gh pr create --repo nitin27may/travel --base main --head phase/p1b --title "P1b: legacy move, publish port, docs" --body-file /tmp/p1b-pr.md
```

## Acceptance criteria (all mechanical)

1. `python3 -m pytest /home/nitin27may/workspace/travel/tools/tests -q` reports `109 passed` plus the new `test_publish.py` tests, 0 failed.
2. `diff -r /tmp/site-before /home/nitin27may/workspace/travel/.site` prints nothing after `HUB_TODAY=<baseline> python3 tools/publish.py --dry-run`. No exceptions.
3. Every `legacy/*/build_page.py` runs and `git -C /home/nitin27may/workspace/travel diff --name-only -- legacy` prints nothing.
4. `python3 tools/locations.py validate` and `build --check` exit 0; `/locations/` still carries the trip links for the 8 places with a `trip` (part of criterion 2).
5. Both hooks, run by hand as above, exit 0.
6. `ls /home/nitin27may/workspace/travel` shows only: `CLAUDE.md`, `README.md`, `package.json`, `pnpm-workspace.yaml`, `publish.sh`, `data`, `docs`, `legacy`, `locations` (inbox only), `research`, `tools` (plus dot folders).
7. `location_views.py:199-200` and every `locations/inbox/` string are unchanged (`git diff origin/main -- tools/location_views.py` shows only `Paths` lines).

## Tests to add

`tools/tests/test_publish.py` (step 2). Nothing else.

## Pitfalls

1. The eight builders reproduce their pages byte-for-byte today (verified 2026-10-17). A difference after the move comes from the move.
2. `trips_root` must become `legacy/` in the same commit as the trip move, or `validate` fails on 8 places and the list page loses its trip links.
3. Do not change `location_views.py:199-200`. Do not move `locations/inbox/`.
4. The running session's hooks may be stale. Use `python3 tools/publish.py --dry-run` for the acceptance diff and never Write/Edit `data/locations/locations.json` during P1b.
5. `HERE.parents[1]` in `test_migrate_v2.py` and `test_locations_split.py` is already the repo root; do not change it to `parents[2]`.
6. `peru/` has no `index.html`: it moves, it is not served, and it is `served: false` in the manifest.
7. `.site/`, `.wrangler/`, `.pytest_cache/`, `__pycache__/`, `legacy/_system/gallery.html`, `tools/.cache/` are untracked.
8. `git mv` of a directory to a path that already exists moves it inside that path. Do not pre-create `research/trips/<slug>` before moving `research/`.
9. The hub footer text is stale but must stay verbatim.
10. A one-character pathspec typo in `git add` stages nothing while `git commit` still succeeds: always look at `git diff --cached --stat`.
11. Never `cd`; parallel shell calls share the working directory.

## Commit and push rules

- Checkout: `/home/nitin27may/workspace/travel`, branch `phase/p1b`.
- Stage only the paths this brief owns, with `git -C /home/nitin27may/workspace/travel add <paths>` (for moves, `git mv` stages them); never `git add -A`, `git add .` or `commit -a`. Check `git -C /home/nitin27may/workspace/travel diff --cached --stat` before every commit.
- One commit per step, each green. Message: `P1b step <n>: <summary>`, a short body, and the trailer line `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (for example `git -C /home/nitin27may/workspace/travel commit -m "P1b step 1: ..." -m "body" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"`). Avoid the literal string `publish.sh` in commit commands (it triggers the pre-publish hook; harmless but slow).
- Push after each green step: `git -C /home/nitin27may/workspace/travel push -u origin phase/p1b`.
- `gh pr create` has no `--json` flag; end the body with the attribution line your harness specifies. Do not merge; do not delete the branch.

## Report back

Commit hashes per step; the test count before and after; the `wc -l` of the baseline file list; the `diff -r` result; the hook return codes; any builder or test you had to change beyond this brief and why; anything left at the root that the brief did not expect.
