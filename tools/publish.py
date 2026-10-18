#!/usr/bin/env python3
"""Stage the public site in .site/ and deploy it to Cloudflare Pages.

    python3 tools/publish.py [--dry-run] [--check] [--no-web] [project-name]   (default project: nks-travel)

Merge order (plan 1.3): locations build; the legacy trip list (hub.py --json); the Next.js app build
(web/out); the app copied into an empty .site/; every legacy route copied unless the app wrote that path;
_redirects last; then the served-URL superset check. Only index.html and an explicit assets/ folder are
published from each legacy route; scripts, data and research never are. HUB_TODAY=YYYY-MM-DD pins the
date used for badges (reproducible diffs). PUBLISH_DRY_RUN=1 is the same as --dry-run.
--no-web stages the legacy routes and the Python hub only (no app build, web/out ignored).
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from hub import write_hub, write_trips_json  # noqa: E402

ROOT = HERE.parent
SITE_ROUTES = ("globe", "locations")   # legacy/<name>/ served at /<name>/, not trips
APP_OWNED = ("locations", "globe")     # legacy site pages the app replaces (v2 branch only; main keeps the legacy globe until the owner approves go-live)


PRIVATE_PAGE = """<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="trip-private" content="1">
<title>Private trip</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 16px;color:#222;background:#fff}
@media (prefers-color-scheme:dark){body{color:#eee;background:#111}a{color:#9cf}}</style>
</head><body><h1>This trip page is private now</h1>
<p>It is no longer published. <a href="/">See the other trips</a>.</p></body></html>
"""
PRIVATE_ASSET = "This file is no longer published.\n"


class PublishError(Exception):
    pass


def private_slugs(root: Path) -> set[str]:
    """Manifest folders marked private: staged as a placeholder so the old page and its files are
    overwritten on Cloudflare (earlier deployments keep serving any path a new deploy omits)."""
    manifest = json.loads((root / "legacy" / "MANIFEST.json").read_text(encoding="utf-8"))
    return {f["slug"] for f in manifest["folders"] if f.get("private")}


def routes(root: Path) -> list[tuple[str, Path]]:
    """The route table: (public slug, source folder). Every legacy/<slug>/ with an index.html."""
    legacy = root / "legacy"
    found = {}
    for d in sorted(legacy.iterdir()):
        if d.is_dir() and not d.name.startswith((".", "_")) and (d / "index.html").is_file():
            found[d.name] = d
    for name in SITE_ROUTES:
        if (legacy / name / "index.html").is_file():
            found[name] = legacy / name
    return sorted(found.items())


def check_manifest(root: Path) -> list[str]:
    manifest = json.loads((root / "legacy" / "MANIFEST.json").read_text(encoding="utf-8"))
    return [f"{f['slug']}: marked served but legacy/{f['slug']}/index.html is missing"
            for f in manifest["folders"] if f.get("served") and not (root / "legacy" / f["slug"] / "index.html").is_file()]


def web_published(root: Path, slug: str) -> bool:
    """True when data/trips/<slug>/trip.json says the app serves /<slug>/ (the collision rule, plan 1.3)."""
    f = root / "data" / "trips" / slug / "trip.json"
    if not f.is_file():
        return False
    try:
        return bool(json.loads(f.read_text(encoding="utf-8")).get("trip", {}).get("web_published"))
    except (OSError, ValueError):
        return False


def stage(root: Path, site: Path, web_out: Path | None = None) -> None:
    """Empty .site/, then the app (if any), then each legacy route unless the app already wrote that path."""
    if site.exists():
        shutil.rmtree(site)
    site.mkdir(parents=True)
    if web_out is not None:
        shutil.copytree(web_out, site, dirs_exist_ok=True)
        print(f"  app: copied {web_out.name}/")
    private = private_slugs(root)
    for slug, src in routes(root):
        dest = site / slug
        if slug in private:
            dest.mkdir(parents=True, exist_ok=True)
            (dest / "index.html").write_text(PRIVATE_PAGE, encoding="utf-8")
            if (src / "assets").is_dir():
                for f in (src / "assets").rglob("*"):
                    if f.is_file():
                        out = dest / "assets" / f.relative_to(src / "assets")
                        out.parent.mkdir(parents=True, exist_ok=True)
                        out.write_text(PRIVATE_ASSET, encoding="utf-8")
            print(f"  private: /{slug}/ (placeholder)")
            continue
        if web_out is not None and (dest / "index.html").exists():
            if slug in APP_OWNED:
                print(f"  app owns: /{slug}/ (legacy page not copied)")
                continue
            if web_published(root, slug):
                print(f"  app wins: /{slug}/ (data/trips/{slug}/trip.json has web_published)")
                continue
            raise PublishError(f"/{slug}/ is written by both the app and legacy/{slug}/; "
                               f"set trip.web_published in data/trips/{slug}/trip.json or rename one")
        dest.mkdir(parents=True, exist_ok=True)
        shutil.copy(src / "index.html", dest / "index.html")
        if (src / "assets").is_dir():
            shutil.copytree(src / "assets", dest / "assets", dirs_exist_ok=True)
        print(f"  staged: /{slug}/")


def write_redirects(root: Path, site: Path) -> int:
    """_redirects (Cloudflare Pages format) from web/redirects.json. Written last. Returns the rule count."""
    f = root / "web" / "redirects.json"
    if not f.is_file():
        return 0
    rules = json.loads(f.read_text(encoding="utf-8"))
    lines = [f"{r['from']} {r['to']} {r.get('status', 301)}" for r in rules]
    if lines:
        (site / "_redirects").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return len(lines)


def served_urls(root: Path) -> list[str]:
    f = root / "tools" / "tests" / "fixtures" / "served-urls.txt"
    if not f.is_file():
        return []
    return [l.strip() for l in f.read_text(encoding="utf-8").splitlines() if l.strip() and not l.startswith("#")]


def missing_urls(site: Path, urls: list[str]) -> list[str]:
    """The superset test: every URL served before must still resolve to a file in .site/."""
    missing = []
    for u in urls:
        rel = u.split("?")[0].split("#")[0].lstrip("/")
        # an app-owned route keeps its pages (the app serves them) but not the legacy page's internal assets
        if any(rel.startswith(f"{slug}/assets/") for slug in APP_OWNED):
            continue
        path = site / rel
        if rel == "" or rel.endswith("/"):
            path = path / "index.html"
        if not path.exists():
            missing.append(u)
    return missing


def build_web(root: Path, today: date) -> Path:
    """Legacy trip list for the app, then the static export. Returns web/out."""
    n = write_trips_json(root, root / "web" / ".generated" / "legacy-trips.json", today)
    print(f"  hub json: {n} legacy trips")
    try:
        r = subprocess.run(["pnpm", "--dir", str(root / "web"), "build"], env={**os.environ, "HUB_TODAY": today.isoformat()})
    except FileNotFoundError as e:
        raise PublishError("pnpm not found; install it or pass --no-web") from e
    if r.returncode != 0:
        raise PublishError("web build failed; not publishing")
    out = root / "web" / "out"
    if not (out / "index.html").is_file():
        raise PublishError("web/out/index.html is missing after the build")
    return out


def main(argv: list[str] | None = None, *, root: Path = ROOT, site: Path | None = None, web_out: Path | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("project", nargs="?", default="nks-travel")
    ap.add_argument("--dry-run", action="store_true", help="stage .site/ and stop before wrangler")
    ap.add_argument("--check", action="store_true", help="verify the legacy manifest against the folders and exit")
    ap.add_argument("--no-web", action="store_true", help="stage legacy routes and the Python hub only; skip the app build and ignore web/out")
    args = ap.parse_args(argv)
    root = Path(root)
    site = Path(site) if site else root / ".site"

    if args.check:
        problems = check_manifest(root)
        for p in problems:
            print("ERROR:", p, file=sys.stderr)
        return 1 if problems else 0

    # regenerate the locations list, WISHLIST.md and the globe pins; a failure here must fail the publish
    r = subprocess.run([sys.executable, str(HERE / "locations.py"), "build"])
    if r.returncode != 0:
        print("locations build failed; not publishing", file=sys.stderr)
        return r.returncode

    today = date.fromisoformat(os.environ["HUB_TODAY"]) if os.environ.get("HUB_TODAY") else date.today()
    try:
        if web_out is None and not args.no_web:
            web_out = build_web(root, today)
        stage(root, site, web_out)
        if web_out is None:
            write_hub(site, today)      # before the app exists, the Python hub is the home page
        if web_out is not None:         # the rules point at app routes, so they only make sense with the app
            n = write_redirects(root, site)
            if n:
                print(f"  _redirects: {n} rule(s)")
    except PublishError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 1
    missing = missing_urls(site, served_urls(root))
    if missing:
        print(f"ERROR: {len(missing)} previously served URL(s) are missing from {site}:", file=sys.stderr)
        for u in missing[:25]:
            print("  ", u, file=sys.stderr)
        return 1

    if args.dry_run or os.environ.get("PUBLISH_DRY_RUN") == "1":
        print(f"dry run: staged in {site}, wrangler skipped")
        return 0

    print(f"Deploying {len(routes(root))} route(s) to {args.project}...")
    return subprocess.run(["npx", "wrangler", "pages", "deploy", ".", "--project-name", args.project,
                           "--branch", "main", "--commit-dirty=true"], cwd=site).returncode


if __name__ == "__main__":
    sys.exit(main())
