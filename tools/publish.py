#!/usr/bin/env python3
"""Stage the public site in .site/ and deploy it to Cloudflare Pages.

    python3 tools/publish.py [--dry-run] [--check] [project-name]     (default project: nks-travel)

Only index.html and an explicit assets/ folder are published from each route; scripts, data and
research never are. HUB_TODAY=YYYY-MM-DD pins the date used for the hub badges (reproducible diffs).
PUBLISH_DRY_RUN=1 is the same as --dry-run.
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

from hub import write_hub  # noqa: E402

ROOT = HERE.parent
SITE_ROUTES = ("globe", "locations")   # legacy/<name>/ served at /<name>/, not trips


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


def stage(root: Path, site: Path) -> None:
    if site.exists():
        shutil.rmtree(site)
    site.mkdir(parents=True)
    for slug, src in routes(root):
        dest = site / slug
        dest.mkdir(parents=True, exist_ok=True)
        shutil.copy(src / "index.html", dest / "index.html")
        if (src / "assets").is_dir():
            shutil.copytree(src / "assets", dest / "assets")
        print(f"  staged: /{slug}/")


def main(argv: list[str] | None = None, *, root: Path = ROOT, site: Path | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("project", nargs="?", default="nks-travel")
    ap.add_argument("--dry-run", action="store_true", help="stage .site/ and stop before wrangler")
    ap.add_argument("--check", action="store_true", help="verify the legacy manifest against the folders and exit")
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

    stage(root, site)
    today = date.fromisoformat(os.environ["HUB_TODAY"]) if os.environ.get("HUB_TODAY") else date.today()
    write_hub(site, today)

    if args.dry_run or os.environ.get("PUBLISH_DRY_RUN") == "1":
        print(f"dry run: staged in {site}, wrangler skipped")
        return 0

    print(f"Deploying {len(routes(root))} route(s) to {args.project}...")
    return subprocess.run(["npx", "wrangler", "pages", "deploy", ".", "--project-name", args.project,
                           "--branch", "main", "--commit-dirty=true"], cwd=site).returncode


if __name__ == "__main__":
    sys.exit(main())
