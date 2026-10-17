"""theme_tokens.py: every legacy token survives, output is deterministic, shell pairs meet AA."""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))

import theme_tokens as tt  # noqa: E402


def lum(hexc: str) -> float:
    h = hexc.lstrip("#")
    ch = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    ch = [c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4 for c in ch]
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]


def contrast(a: str, b: str) -> float:
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def test_every_legacy_token_appears_in_its_block():
    themes = tt.legacy_themes()
    assert len(themes) == 8
    out = tt.render(themes)
    for name, tokens in themes.items():
        m = re.search(r'\[data-theme="%s"\] \{(.*?)\}' % re.escape(name), out, flags=re.S)
        assert m, name
        for token, value in tokens.items():
            assert f"{token}: {value};" in m.group(1), (name, token)


def test_output_is_deterministic_and_checked_in():
    assert tt.render(tt.legacy_themes()) == tt.render(tt.legacy_themes())
    assert tt.main(["--check"]) == 0, "web/app/themes.css is stale; run tools/theme_tokens.py"


def test_shell_has_both_variants():
    out = tt.render(tt.legacy_themes())
    assert '[data-theme="shell"]' in out and '[data-theme="shell-light"]' in out
    assert "#14251d" in out and "#d69329" in out


def test_shell_text_pairs_meet_aa():
    for label, shell in (("dark", tt.SHELL_DARK), ("light", tt.SHELL_LIGHT)):
        for fg in ("--ink", "--ink-2", "--muted", "--muted-2", "--accent-text", "--teal-text", "--warn-text"):
            for bg in ("--bg", "--surface", "--surface-2"):
                assert contrast(shell[fg], shell[bg]) >= 4.5, (label, fg, bg, contrast(shell[fg], shell[bg]))
        assert contrast(shell["--accent-ink"], shell["--accent"]) >= 4.5, label
        assert contrast(shell["--teal-ink"], shell["--teal"]) >= 4.5, label
        assert contrast(shell["--header-ink"], shell["--header"]) >= 4.5, label
        # control borders and focus rings need 3:1 against the surface
        assert contrast(shell["--line-2"], shell["--surface"]) >= 3.0, (label, "line-2")
        assert contrast(shell["--focus"], shell["--bg"]) >= 3.0, (label, "focus")
