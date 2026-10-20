"""publish.py --product: the app alone, legacy trip URLs redirected, headers written, the real deploy gated."""
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))

import publish  # noqa: E402

SLUGS_TS = """export const TRIP_SLUGS: Record<string, string> = {
  'alpha-2027': 'alpha-2027-trip',
  'beta-2028': 'beta-2028-trip',
  'gamma-2029': 'gamma-2029-trip',
};
export const PUBLIC_TRIP_FOLDER = {};
"""


def write(p: Path, text: str = "x") -> Path:
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8")
    return p


@pytest.fixture
def repo(tmp_path):
    root = tmp_path / "repo"
    for slug in ("alpha-2027", "beta-2028", "globe", "locations"):
        write(root / "legacy" / slug / "index.html", f"legacy {slug}")
    write(root / "legacy" / "alpha-2027" / "assets" / "a.kml", "kml")
    (root / "legacy" / "MANIFEST.json").write_text(json.dumps({"schema": "legacy-manifest/1", "folders": [
        {"slug": s, "served": True} for s in ("alpha-2027", "beta-2028", "globe", "locations")]}))
    write(root / "web" / "lib" / "public" / "slugs.ts", SLUGS_TS)
    write(root / "web" / "redirects.json", json.dumps([
        {"from": "/places/CA/AB/x/", "to": "/places/x/", "status": 301},
        {"from": "/locations/*", "to": "/places/:splat", "status": 301}]))
    out = tmp_path / "web-out"
    write(out / "index.html", "app home")
    write(out / "trips" / "alpha-2027-trip" / "index.html", "alpha trip")
    write(out / "trips" / "index.html", "trips")
    write(out / "globe" / "index.html", "app globe")
    write(out / "404.html", "404")
    return root, out, tmp_path / "site"


def test_trip_slugs_are_read_from_slugs_ts(repo):
    root, _, _ = repo
    assert publish.trip_slugs(root) == {"alpha-2027": "alpha-2027-trip", "beta-2028": "beta-2028-trip", "gamma-2029": "gamma-2029-trip"}


def test_stage_product_copies_only_the_app(repo):
    root, out, site = repo
    write(site / "stale.html", "from an earlier run")
    publish.stage_product(site, out)
    assert (site / "index.html").read_text() == "app home"
    assert not (site / "stale.html").exists()
    assert not (site / "alpha-2027").exists() and not (site / "beta-2028").exists()
    assert not (site / "locations").exists()


def test_every_legacy_trip_url_redirects_to_its_trip_page_or_the_list(repo):
    root, out, site = repo
    publish.stage_product(site, out)
    rules = publish.legacy_rules(root, site, 302)
    by_from = {r["from"]: r["to"] for r in rules}
    assert by_from["/alpha-2027/"] == "/trips/alpha-2027-trip/"        # the trip page exists
    assert by_from["/alpha-2027/*"] == "/trips/alpha-2027-trip/"
    assert by_from["/beta-2028/"] == "/trips/"                          # mapped, but no page: never a 404
    assert by_from["/gamma-2029/"] == "/trips/"                         # in the slug map but no legacy folder
    assert "/globe/" not in by_from and "/locations/" not in by_from    # the app owns these
    assert all(r["status"] == 302 for r in rules)


def test_redirects_and_headers_are_written(repo):
    root, out, site = repo
    publish.stage_product(site, out)
    n = publish.write_product_files(root, site, 301)
    lines = (site / "_redirects").read_text().splitlines()
    assert n == len(lines) == 2 + 6
    assert lines[0] == "/places/CA/AB/x/ /places/x/ 301"                # the app's rules come first
    assert "/alpha-2027/* /trips/alpha-2027-trip/ 301" in lines
    headers = (site / "_headers").read_text()
    assert "/img/*" in headers and "immutable" in headers
    assert "/*.html" in headers and "must-revalidate" in headers


def test_too_many_dynamic_rules_is_an_error(repo, monkeypatch):
    root, out, site = repo
    publish.stage_product(site, out)
    monkeypatch.setattr(publish, "CF_MAX_DYNAMIC", 3)
    with pytest.raises(publish.PublishError, match="too large"):
        publish.write_product_files(root, site, 302)


def test_unresolved_urls_finds_only_urls_with_neither_file_nor_redirect(repo):
    root, out, site = repo
    publish.stage_product(site, out)
    publish.write_product_files(root, site, 302)
    rules = [{"from": l.split()[0], "to": l.split()[1]} for l in (site / "_redirects").read_text().splitlines()]
    urls = ["/", "/trips/", "/alpha-2027/", "/alpha-2027/assets/a.kml", "/locations/old-place/", "/gone/page.html"]
    assert publish.unresolved_urls(site, urls, rules) == ["/gone/page.html"]


def run(root, out, site, *extra):
    return publish.main(["--product", *extra], root=root, site=site, web_out=out)


def test_product_run_without_go_live_stages_and_stops(repo, monkeypatch):
    root, out, site = repo
    write(root / "tools" / "tests" / "fixtures" / "served-urls.txt", "/\n/alpha-2027/\n")
    monkeypatch.setattr(publish.subprocess, "run", lambda cmd, **kw: type("R", (), {"returncode": 0})() if cmd[1:2] != ["pages"] else pytest.fail("deployed without --go-live"))
    assert run(root, out, site) == 0
    assert (site / "_redirects").is_file() and (site / "_headers").is_file()


def test_product_run_fails_when_an_old_url_is_neither_file_nor_redirect(repo, monkeypatch):
    root, out, site = repo
    write(root / "tools" / "tests" / "fixtures" / "served-urls.txt", "/\n/vanished/\n")
    monkeypatch.setattr(publish.subprocess, "run", lambda cmd, **kw: type("R", (), {"returncode": 0})())
    assert run(root, out, site) == 1


def test_go_live_is_the_only_way_to_deploy(repo, monkeypatch):
    root, out, site = repo
    write(root / "tools" / "tests" / "fixtures" / "served-urls.txt", "/\n")
    calls = []
    monkeypatch.setattr(publish.subprocess, "run", lambda cmd, **kw: calls.append(cmd) or type("R", (), {"returncode": 0})())
    assert run(root, out, site, "--go-live") == 0
    assert any(c[:3] == ["npx", "wrangler", "pages"] for c in calls)
    calls.clear()
    assert run(root, out, site, "--go-live", "--dry-run") == 0
    assert not any(c[:3] == ["npx", "wrangler", "pages"] for c in calls)
