"""The hard-coding ratchet: each class fails on a new literal, the baseline holds, data values and tests are not scanned."""
from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
from pathlib import Path

import pytest

SCAN = Path(__file__).resolve().parents[1] / "cons" / "hardcode_scan.py"
REAL_ROOT = Path(__file__).resolve().parents[2]


def load():
    spec = importlib.util.spec_from_file_location("hardcode_scan_under_test", SCAN)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture()
def repo(tmp_path, monkeypatch):
    mod = load()
    subprocess.run(["git", "init", "-q", str(tmp_path)], check=True)
    (tmp_path / "legacy").mkdir()
    (tmp_path / "legacy/MANIFEST.json").write_text(json.dumps({"folders": [
        {"slug": "dolomites-july-2027"}, {"slug": "globe", "kind": "site-page"}, {"slug": "norway-summer"}]}))
    readme = tmp_path / "docs/v2/build/public-site/README.md"
    readme.parent.mkdir(parents=True)
    readme.write_text("## Environment variables\n\n| Name | Used by |\n|---|---|\n| `KNOWN_NAME` | web |\n\n## Change log\n")
    monkeypatch.setattr(mod, "ROOT", tmp_path)
    monkeypatch.setattr(mod, "BASELINE", tmp_path / "baseline.json")
    monkeypatch.setattr(mod, "README", readme)

    scan_mod = mod

    class R:
        root = tmp_path

        def put(self, rel, text):
            p = tmp_path / rel
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(text)

        def rules(self):
            findings, _ = scan_mod.scan()
            return {r for (r, _f) in findings}

        def check(self, capsys):
            rc = scan_mod.main(["--check"])
            return rc, capsys.readouterr()

        mod = scan_mod

    return R()


CASES = {
    "colour-fn": ("web/components/A.tsx", "const c = 'rgb(0 128 0)';\n"),
    "colour-hex": ("web/components/A.tsx", "const c = '#00aa00';\n"),
    "colour-named": ("web/styles/a.css", ".a { color: red; }\n"),
    "trip-slug": ("web/components/A.tsx", "const t = 'dolomites-july-2027';\n"),
    "site-host": ("web/lib/a.ts", "const h = 'https://nks-travel.pages.dev/x';\n"),
    "user-agent": ("web/scripts/a.mjs", "const UA = 'travel-thing/1.0 (+https://example.org/about/)';\n"),
    "api-host": ("web/scripts/a.mjs", "fetch('https://overpass-api.de/api/interpreter');\n"),
    "earth-radius": ("core/src/a.ts", "const R = 6371;\n"),
    "km-constant": ("core/src/a.ts", "const FAR_KM = 25;\n"),
    "ms-constant": ("web/lib/a.ts", "const FADE_MS = 200;\n"),
    "count-in-copy": ("web/components/A.tsx", "const x = <p>12 places nearby</p>;\n"),
    "kind-label-map": ("web/lib/a.ts", "const L = { trail: 'Trail', lake: 'Lake', sight: 'Sight' };\n"),
}


@pytest.mark.parametrize("rule", sorted(CASES))
def test_each_class_fails_on_a_new_literal(repo, capsys, rule):
    rel, text = CASES[rule]
    assert repo.check(capsys)[0] == 0
    repo.put(rel, text)
    assert rule in repo.rules()
    rc, out = repo.check(capsys)
    assert rc == 1 and f"{rel}:1 {rule}" in out.err


def test_env_name_missing_from_the_table_fails_and_a_listed_one_passes(repo, capsys):
    repo.put("web/lib/a.ts", "const a = process.env.KNOWN_NAME;\n")
    assert repo.check(capsys)[0] == 0
    repo.put("web/lib/b.ts", "const b = process.env.NEW_THING;\nconst { X_ONE } = process.env;\n")
    repo.put("tools/c.py", "import os\nos.environ.get('PY_NAME')\n")
    rc, out = repo.check(capsys)
    assert rc == 1
    for n in ("NEW_THING", "X_ONE", "PY_NAME"):
        assert f"env-undocumented {n}" in out.err


def test_baseline_allows_existing_and_blocks_a_rise(repo, capsys):
    repo.put("web/lib/a.ts", "const A_KM = 1;\n")
    assert repo.mod.main(["--write"]) == 0
    capsys.readouterr()
    assert repo.check(capsys)[0] == 0
    repo.put("web/lib/a.ts", "const A_KM = 1;\nconst B_KM = 2;\n")
    rc, out = repo.check(capsys)
    assert rc == 1 and "web/lib/a.ts:2 km-constant" in out.err and "baseline allows 1, found 2" in out.err


def test_a_fall_passes_and_reports_the_tightening(repo, capsys):
    repo.put("web/lib/a.ts", "const A_KM = 1;\nconst B_KM = 2;\n")
    repo.mod.main(["--write"])
    capsys.readouterr()
    repo.put("web/lib/a.ts", "const A_KM = 1;\n")
    rc, out = repo.check(capsys)
    assert rc == 0 and "baseline can be tightened" in out.out


def test_write_keeps_the_reason_of_an_entry(repo):
    repo.put("web/lib/a.ts", "const A_KM = 1;\n")
    repo.mod.main(["--write"])
    b = json.loads((repo.root / "baseline.json").read_text())
    b["rules"]["km-constant"]["web/lib/a.ts"]["reason"] = "kept"
    (repo.root / "baseline.json").write_text(json.dumps(b))
    repo.mod.main(["--write"])
    assert json.loads((repo.root / "baseline.json").read_text())["rules"]["km-constant"]["web/lib/a.ts"]["reason"] == "kept"


def test_data_values_tests_comments_and_ref_strings_are_not_findings(repo):
    repo.put("data/capture/points.json", json.dumps({"legacy/dolomites-july-2027/adventures/x": "https://nks-travel.pages.dev rgb(1 2 3) 6371"}))
    repo.put("web/tests/a.test.ts", "const t = 'dolomites-july-2027'; const c = 'rgb(0 0 0)'; const X_KM = 1;\n")
    repo.put("web/tests/fixtures/f.ts", "const t = 'dolomites-july-2027';\n")
    repo.put("web/lib/a.ts", "// the host nks-travel.pages.dev and rgb(0 0 0) in a comment\n/* 6371\n   FAR_KM = 5 */\n * dolomites-july-2027\n")
    repo.put("tools/a.py", "# nks-travel.pages.dev\n'''x'''\n")
    repo.put("web/public/img/a.css", ".a{color:red}\n")
    repo.put("web/app/themes.css", ".a{color:rgb(1 2 3)}\n")
    assert repo.rules() == set()


def test_site_pages_are_not_trip_slugs_and_svg_data_urls_are_not_colours(repo):
    repo.put("web/lib/a.ts", "const p = 'globe';\n")
    repo.put("web/styles/a.css", ".a { mask: url(\"data:image/svg+xml,%3Csvg stroke='black'%3E\"); color: var(--ink); }\n")
    assert repo.rules() == set()


def test_untracked_new_files_are_scanned(repo):
    repo.put("core/src/new.ts", "const R = 6371;\n")
    assert "earth-radius" in repo.rules()


def test_the_real_repo_passes_with_its_baseline_and_is_fast():
    import time

    t = time.time()
    r = subprocess.run([sys.executable, str(SCAN), "--check"], cwd=REAL_ROOT, capture_output=True, text=True)
    assert r.returncode == 0, r.stderr
    assert time.time() - t < 20
