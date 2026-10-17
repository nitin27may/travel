"""Static checks on globe/index.html for the saved-places layer (G5, phase C1). Run: python3 -m pytest _system/tests -q"""
import re
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
PAGE = ROOT / "globe" / "index.html"
HTML = PAGE.read_text(encoding="utf-8")


def _script() -> str:
    m = re.search(r'<script type="module">(.*?)</script>', HTML, re.S)
    assert m, "module script missing"
    return m.group(1)


def test_page_loads_places_with_catch():
    assert "assets/data/places.json" in HTML
    assert re.search(r"places\.json'\)[^;]*\.catch\(", _script()), "the places fetch needs a .catch (R4)"


def test_pin_layers_and_controls_present():
    js = _script()
    for needle in ("id: 'pins'", "id: 'pin-sel'", "pinsBtn", "../locations/", "applyPinFocus", "pinHit", "openPlace", "drillToPoint"):
        assert needle in js or needle in HTML, needle
    assert '<a href="../locations/">Locations</a>' in HTML


def test_hash_parses_place_param_and_state_iso():
    js = _script()
    assert "h.get('p')" in js and "h.set('p'" in js
    assert "properties.iso === opts.s" in js


def test_every_admin_handler_has_the_pin_guard():
    js = _script()
    for ev in ("mousemove", "click"):
        for layer in ("country-fill", "adm1-fill", "adm2-fill"):
            m = re.search(r"map\.on\('%s', '%s', e => \{\s*if \(pinHit\(e\.point\)\)" % (ev, layer), js)
            assert m, f"{ev} {layer} lacks the pinHit guard"


def test_pins_added_in_style_load_and_restored():
    js = _script()
    assert js.index("map.addSource('pins'") > js.index("map.on('style.load'")
    restore = js[js.index("function restoreAfterStyle"):]
    assert "applyPinFocus()" in restore.split("function setStyle")[0]


def test_places_pref_and_query_override():
    js = _script()
    assert "params.get('pins') !== '0'" in js and "pinsOn" in js


@pytest.mark.skipif(shutil.which("node") is None, reason="node not installed")
def test_module_script_parses(tmp_path):
    js = _script().replace("'./assets/vendor/maplibre-gl.mjs'", "'/dev/null'")
    f = tmp_path / "globe.mjs"
    f.write_text(js, encoding="utf-8")
    r = subprocess.run(["node", "--check", str(f)], capture_output=True, text=True)
    assert r.returncode == 0, r.stderr
