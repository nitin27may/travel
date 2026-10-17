"""Staging checks for tools/publish.py: what goes public, and that nothing new slips in by accident."""
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))

import publish  # noqa: E402

RESERVED = set("places trips trails activities stays eateries offers areas adventures bookings globe locations "
               "inbox api mcp data assets geo _next legacy new edit review backlog plan schema about fonts icons".split())
SITE_PAGES = {"globe", "locations"}


@pytest.fixture(scope="module")
def staged(tmp_path_factory):
    site = tmp_path_factory.mktemp("site") / ".site"
    mp = pytest.MonkeyPatch()
    mp.setenv("HUB_TODAY", "2026-10-17")
    try:
        assert publish.main(["--dry-run", "--no-web"], root=ROOT, site=site) == 0
    finally:
        mp.undo()
    return site


def test_served_urls_are_all_still_staged(staged):
    lines = (ROOT / "tools" / "tests" / "fixtures" / "served-urls.txt").read_text().splitlines()
    urls = [l.strip() for l in lines if l.strip() and not l.startswith("#")]
    assert urls
    missing = []
    for u in urls:
        rel = u.split("?")[0].split("#")[0].lstrip("/")
        path = staged / rel
        if rel == "" or rel.endswith("/"):
            path = path / "index.html"
        if not path.exists():
            missing.append(u)
    assert not missing, missing


def test_research_and_data_are_never_staged(staged):
    assert not (staged / "research").exists() and not (staged / "data").exists()
    assert not [p for p in staged.rglob("*") if "research" in p.relative_to(staged).parts]
    assert not list(staged.rglob("*.md")) and not list(staged.rglob("*.py"))


def _manifest():
    return json.loads((ROOT / "legacy" / "MANIFEST.json").read_text(encoding="utf-8"))


def test_legacy_folders_equal_the_manifest():
    on_disk = {d.name for d in (ROOT / "legacy").iterdir() if d.is_dir() and not d.name.startswith((".", "_"))}
    assert on_disk == {f["slug"] for f in _manifest()["folders"]}, "a legacy folder was added or removed without the manifest"


def test_served_manifest_entries_have_a_page():
    assert publish.main(["--check"], root=ROOT) == 0


def test_no_reserved_slug_among_legacy_trips():
    clash = {f["slug"] for f in _manifest()["folders"]} & RESERVED
    assert clash <= SITE_PAGES, clash


def test_hub_today_is_honoured(tmp_path, monkeypatch):
    monkeypatch.setenv("HUB_TODAY", "2026-10-17")
    a, b = tmp_path / "a", tmp_path / "b"
    assert publish.main(["--dry-run", "--no-web"], root=ROOT, site=a) == 0
    assert publish.main(["--dry-run", "--no-web"], root=ROOT, site=b) == 0
    assert (a / "index.html").read_bytes() == (b / "index.html").read_bytes()
    monkeypatch.setenv("HUB_TODAY", "2026-12-01")
    c = tmp_path / "c"
    publish.main(["--dry-run", "--no-web"], root=ROOT, site=c)
    assert (a / "index.html").read_bytes() != (c / "index.html").read_bytes()


def test_private_pages_are_placeholders(staged):
    private = {f["slug"] for f in _manifest()["folders"] if f.get("private")}
    assert private, "expected at least one private page in the manifest"
    for slug in private:
        doc = (staged / slug / "index.html").read_text(encoding="utf-8")
        assert 'name="trip-private"' in doc and 'name="robots" content="noindex' in doc
        assert "trip-date" not in doc and "<img" not in doc, f"{slug}: trip content leaked into the placeholder"
        for f in (staged / slug).rglob("*"):
            if f.is_file() and f.name != "index.html":
                assert f.read_text(encoding="utf-8") == publish.PRIVATE_ASSET, f"{f}: asset not overwritten"


def test_private_pages_have_no_hub_card(staged):
    hub = (staged / "index.html").read_text(encoding="utf-8")
    for f in _manifest()["folders"]:
        if f.get("private"):
            assert f'href="/{f["slug"]}/' not in hub and f'href="{f["slug"]}/' not in hub, f["slug"]


def test_private_pages_leave_the_app_trip_list(tmp_path):
    sys.path.insert(0, str(ROOT / "tools"))
    import hub
    from datetime import date
    out = tmp_path / "trips.json"
    hub.write_trips_json(ROOT, out, date(2026, 10, 17))
    slugs = {t["slug"] for t in json.loads(out.read_text(encoding="utf-8"))}
    assert not slugs & {f["slug"] for f in _manifest()["folders"] if f.get("private")}
