"""Checks on the generated list page (locations/index.html) and its template. Run: python3 -m pytest tools/tests -q"""
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
import location_views as V  # noqa: E402
import locations as L  # noqa: E402

TEMPLATE = ROOT / "_system" / "site" / "locations.html"
PAGE = ROOT / "locations" / "index.html"
HASH_PARAMS = ["q", "country", "region", "area", "kind", "status", "kid", "tag", "view", "ids", "label", "focus"]


def _page() -> str:
    return PAGE.read_text(encoding="utf-8")


def _scripts(html: str):
    return re.findall(r"<script([^>]*)>(.*?)</script>", html, re.S)


def _inline_script(html: str) -> str:
    code = [body for attrs, body in _scripts(html) if "application/json" not in attrs and "src=" not in attrs]
    assert len(code) == 1
    return code[0]


def test_template_declares_contract():
    assert V.VIEW_SCHEMA in TEMPLATE.read_text(encoding="utf-8")


def test_placeholders_gone():
    html = _page()
    for token in ("/*__SITE_CSS__*/", "__BUILT__", "__SITE_DATA__"):
        assert token not in html


def test_embedded_json_equals_view():
    html = _page()
    m = re.search(r'<script id="site-data" type="application/json">(.*?)</script>', html, re.S)
    assert m
    embedded = json.loads(m.group(1).replace("<\\/", "</"))
    assert embedded == V.view(L.load())


def test_no_external_scripts():
    assert "<script src=" not in _page().replace("\n", " ")
    assert not re.search(r"<script[^>]+src=", _page())


def test_inline_script_parses(tmp_path):
    node = shutil.which("node")
    if not node:
        pytest.skip("node is not installed")
    f = tmp_path / "list.js"
    f.write_text(_inline_script(_page()), encoding="utf-8")
    r = subprocess.run([node, "--check", str(f)], capture_output=True, text=True)
    assert r.returncode == 0, r.stderr


def test_hash_params_present_in_script():
    code = _inline_script(_page())
    for name in HASH_PARAMS:
        assert re.search(rf"""['"]{name}['"]""", code), name


def test_globe_links():
    code = _inline_script(_page())
    assert "../globe/#c=" in code
    assert "&p=" in code
    assert "country=" not in code.split("globeUrl")[1].split("\n")[0]


def test_nav_links():
    html = _page()
    nav = re.search(r"<nav>(.*?)</nav>", html, re.S).group(1)
    assert 'href="../"' in nav and 'class="on" href="./"' in nav and 'href="../globe/"' in nav


def test_contract_fields_only():
    code = _inline_script(_page())
    assert "p.notes" not in code and "p.sources" not in code and ".places" not in code.replace("DATA.places", "")


def test_runtime_hooks_and_a11y():
    code = _inline_script(_page())
    html = _page()
    assert "window.__lst" in code and "locations-prefs" in code
    assert "aria-pressed" in code and 'aria-live="polite"' in html
    assert "<details" in html


def test_page_size_under_1mb():
    assert PAGE.stat().st_size < 1_000_000
