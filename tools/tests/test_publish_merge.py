"""The merge in tools/publish.py: app first, legacy routes second, _redirects last, collisions and the superset check."""
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))

import publish  # noqa: E402


def write(p: Path, text: str = "x") -> Path:
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8")
    return p


@pytest.fixture
def repo(tmp_path):
    """A tiny repo: two legacy trips, the globe, the locations page, a fake app export and its redirects."""
    root = tmp_path / "repo"
    for slug in ("alpha", "beta", "globe", "locations"):
        write(root / "legacy" / slug / "index.html", f"<title>legacy {slug}</title>")
    write(root / "legacy" / "alpha" / "assets" / "alpha.kml", "kml")
    (root / "legacy" / "MANIFEST.json").write_text(json.dumps({"schema": "legacy-manifest/1", "folders": [
        {"slug": s, "served": True} for s in ("alpha", "beta", "globe", "locations")]}))
    web_out = tmp_path / "web-out"
    write(web_out / "index.html", "<title>app home</title>")
    write(web_out / "places" / "index.html", "app places")
    write(web_out / "locations" / "index.html", "app redirect page")
    write(web_out / "data" / "places.json", "{}")
    write(web_out / "404.html", "app 404")
    write(root / "web" / "redirects.json", json.dumps([{"from": "/locations/*", "to": "/places/:splat", "status": 301}]))
    return root, web_out, tmp_path / "site"


def test_app_is_copied_first_then_legacy_routes(repo):
    root, web_out, site = repo
    publish.stage(root, site, web_out)
    assert (site / "index.html").read_text() == "<title>app home</title>"
    assert (site / "places" / "index.html").is_file()
    assert (site / "alpha" / "index.html").read_text() == "<title>legacy alpha</title>"
    assert (site / "alpha" / "assets" / "alpha.kml").read_text() == "kml"
    assert (site / "globe" / "index.html").is_file()


def test_locations_comes_from_the_app_not_the_legacy_page(repo):
    root, web_out, site = repo
    publish.stage(root, site, web_out)
    assert (site / "locations" / "index.html").read_text() == "app redirect page"


def test_redirects_are_written_last_from_the_json(repo):
    root, web_out, site = repo
    publish.stage(root, site, web_out)
    assert not (site / "_redirects").exists()          # stage() never writes it
    assert publish.write_redirects(root, site) == 1
    assert (site / "_redirects").read_text() == "/locations/* /places/:splat 301\n"


def test_collision_is_an_error_unless_the_trip_is_web_published(repo):
    root, web_out, site = repo
    write(web_out / "alpha" / "index.html", "app alpha")
    with pytest.raises(publish.PublishError, match="alpha"):
        publish.stage(root, site, web_out)
    write(root / "data" / "trips" / "alpha" / "trip.json", json.dumps({"trip": {"slug": "alpha", "web_published": False}}))
    with pytest.raises(publish.PublishError):
        publish.stage(root, site, web_out)
    write(root / "data" / "trips" / "alpha" / "trip.json", json.dumps({"trip": {"slug": "alpha", "web_published": True}}))
    publish.stage(root, site, web_out)
    assert (site / "alpha" / "index.html").read_text() == "app alpha"       # the app wins
    assert (site / "beta" / "index.html").read_text() == "<title>legacy beta</title>"


def test_superset_check_fails_when_a_url_disappears(repo, tmp_path):
    root, web_out, site = repo
    write(root / "tools" / "tests" / "fixtures" / "served-urls.txt", "/alpha/index.html\n/alpha/assets/alpha.kml\n/globe/\n/404.html\n/\n")
    publish.stage(root, site, web_out)
    assert publish.missing_urls(site, publish.served_urls(root)) == []
    (site / "alpha" / "assets" / "alpha.kml").unlink()
    assert publish.missing_urls(site, publish.served_urls(root)) == ["/alpha/assets/alpha.kml"]


def test_main_fails_on_a_missing_served_url_and_passes_otherwise(repo, monkeypatch):
    root, web_out, site = repo
    monkeypatch.setattr(publish.subprocess, "run", lambda *a, **k: type("R", (), {"returncode": 0})())
    write(root / "tools" / "tests" / "fixtures" / "served-urls.txt", "/alpha/\n")
    assert publish.main(["--dry-run"], root=root, site=site, web_out=web_out) == 0
    assert (site / "_redirects").is_file()
    write(root / "tools" / "tests" / "fixtures" / "served-urls.txt", "/alpha/\n/gone/\n")
    assert publish.main(["--dry-run"], root=root, site=site, web_out=web_out) == 1


def test_python_hub_is_not_written_when_the_app_has_a_home_page(repo, monkeypatch):
    root, web_out, site = repo
    monkeypatch.setattr(publish.subprocess, "run", lambda *a, **k: type("R", (), {"returncode": 0})())
    wrote = []
    monkeypatch.setattr(publish, "write_hub", lambda *a, **k: wrote.append(1))
    assert publish.main(["--dry-run"], root=root, site=site, web_out=web_out) == 0
    assert wrote == []
    assert (site / "index.html").read_text() == "<title>app home</title>"


def test_no_web_stages_legacy_only_and_writes_the_hub(repo, monkeypatch):
    root, _, site = repo
    monkeypatch.setattr(publish.subprocess, "run", lambda *a, **k: type("R", (), {"returncode": 0})())
    assert publish.main(["--dry-run", "--no-web"], root=root, site=site) == 0
    assert "Trip Plans" in (site / "index.html").read_text()
    assert not (site / "_redirects").exists()
    assert (site / "locations" / "index.html").read_text() == "<title>legacy locations</title>"


def test_hub_json_lists_every_served_legacy_trip(tmp_path):
    from datetime import date

    import hub

    out = tmp_path / "trips.json"
    n = hub.write_trips_json(ROOT, out, date(2026, 10, 17))
    rows = json.loads(out.read_text(encoding="utf-8"))
    manifest = json.loads((ROOT / "legacy" / "MANIFEST.json").read_text(encoding="utf-8"))
    served = {f["slug"] for f in manifest["folders"] if f.get("served") and f.get("kind") != "site-page"}
    assert n == len(rows) == len(served)
    assert {r["slug"] for r in rows} == served
    assert set(rows[0]) == {"slug", "title", "sub", "img", "date", "dates", "dur", "region", "status", "badge"}
    import re
    assert not any(re.search(r"&(#\d+|[a-z]+);", r["dates"] + r["dur"] + r["region"]) for r in rows)   # entities are decoded
    assert all(r["badge"] for r in rows if r["date"] and r["date"] >= "2026-10-17")
