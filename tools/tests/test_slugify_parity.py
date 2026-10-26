"""SLUG-FIX: tools/locations.py slugify transliterates the letters NFKD cannot decompose (ae, eth, thorn, o-slash, oe, sharp s,
Polish l, d-stroke) and agrees with kebab in core/src/catalogue/slugs.ts on the shared samples. Run: python3 -m pytest tools/tests -q"""
import json
import re
import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE.parent))
import locations as D  # noqa: E402

SAMPLES = json.loads((ROOT / "core" / "test" / "catalogue" / "fixtures" / "slugify-samples.json").read_text())["samples"]


@pytest.mark.parametrize("s", SAMPLES, ids=[f"{s['lang']}-{s['slug']}" for s in SAMPLES])
def test_slugify_matches_the_shared_samples(s):
    assert D.slugify(s["name"]) == s["slug"]


def test_the_transliteration_table_matches_core():
    src = (ROOT / "core" / "src" / "catalogue" / "slugs.ts").read_text()
    body = re.search(r"export const TRANSLITERATION[^{]*\{(.*?)\};", src, re.S)
    assert body, "TRANSLITERATION not found in core/src/catalogue/slugs.ts"
    assert dict(re.findall(r'"([^"]+)":\s*"([^"]*)"', body.group(1))) == D.TRANSLITERATION


def test_ascii_fold_keeps_case_and_drops_marks():
    assert D.ascii_fold("Þórsmörk") == "Thorsmork"
    assert D.ascii_fold("Ærø") == "Aero"


def test_make_id_spells_icelandic_letters_out():
    assert D.make_id("is", "West", "Snæfellsbær", "Snæfellsjökull") == "IS/west/snaefellsbaer/snaefellsjokull"
    assert D.make_id("is", "Northeast", "Þingeyjarsveit", "Reykjahlíð") == "IS/northeast/thingeyjarsveit/reykjahlid"
