"""Checks on the generated locations views and what gets published. Run: python3 -m pytest tools/tests -q"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))

import location_views  # noqa: E402
import locations  # noqa: E402

WISHLIST = ROOT / "data" / "locations" / "WISHLIST.md"
LIST_PAGE = ROOT / "legacy" / "locations" / "index.html"
PLACES = ROOT / "legacy" / "globe" / "assets" / "data" / "places.json"
GLOBE_PAGE = ROOT / "legacy" / "globe" / "index.html"


def test_generated_files_are_fresh():
    rendered = location_views.render_all(locations.load())
    for path in (WISHLIST, LIST_PAGE, PLACES):
        assert path in rendered, f"render_all no longer produces {path}"
        assert path.read_bytes() == rendered[path], f"{path.relative_to(ROOT)} is stale; run locations.py build"


def test_published_outputs_leak_nothing_private():
    # WISHLIST.md is private and keeps full notes, so only the two published files are checked.
    # Prose may say "screenshot"; assert on paths and JSON keys instead of the bare word.
    for path in (LIST_PAGE, PLACES):
        text = path.read_text(encoding="utf-8")
        name = path.relative_to(ROOT)
        assert "research/inbox/" not in text, f"{name} exposes an inbox path"
        assert not re.search(r"(^|[^\w])inbox/", text), f"{name} exposes an inbox path"
        assert '"screenshot"' not in text, f"{name} carries a screenshot key"
        assert "javascript:" not in text.lower(), f"{name} contains a javascript: URL"


def test_locations_folder_publishes_only_the_page():
    assert not (ROOT / "legacy" / "locations" / "assets").exists(), "publish.sh would copy locations/assets"


def test_list_page_and_globe_link_to_each_other():
    assert "../globe/" in LIST_PAGE.read_text(encoding="utf-8")
    assert "../locations/" in GLOBE_PAGE.read_text(encoding="utf-8")
