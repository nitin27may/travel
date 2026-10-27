"""theme_tokens.py: generated from tokens.json, deterministic, the allowed text pairs meet AA."""
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


# tokens.md 2.2: every allowed text pair, with the minimum the doc states (4.5 for text)
TEXT_PAIRS = [
    ("ink", "bg"), ("ink", "surface"), ("ink", "surface-2"), ("ink", "well"),
    ("ink-2", "bg"), ("ink-2", "surface"), ("ink-2", "surface-2"),
    ("muted", "bg"), ("muted", "surface"), ("muted", "surface-2"), ("muted", "well"),
    ("header-ink", "header"), ("header-mute", "header"),
    ("accent-ink", "accent"), ("accent-ink", "accent-hover"),
    ("accent-text", "bg"), ("accent-text", "surface"), ("accent-text", "accent-soft"),
    ("crit", "bg"), ("crit", "surface"), ("crit", "crit-soft"), ("on-crit-fill", "crit-fill"),
    ("ok", "bg"), ("ok", "surface"), ("ok", "ok-soft"),
    ("warn", "bg"), ("warn", "surface"), ("warn", "warn-soft"),
    ("info", "bg"), ("info", "surface"), ("info", "info-soft"),
    ("toast-ink", "toast-bg"),
]


def block_of(css: str, selector: str) -> str:
    m = re.search(re.escape(selector) + r" \{(.*?)\n\}", css, flags=re.S)
    assert m, selector
    return m.group(1)


def test_output_is_deterministic_and_checked_in():
    assert tt.render() == tt.render()
    assert tt.main(["--check"]) == 0, "web/app/themes.css is stale; run tools/theme_tokens.py"


def test_every_colour_role_is_emitted_for_both_themes():
    tokens = tt.load()
    out = tt.render(tokens)
    light = block_of(out, ':root,\n[data-theme="light"]')
    dark = block_of(out, '[data-theme="dark"]')
    for name, value in tokens["color"]["light"].items():
        assert f"--{name}: {value};" in light, ("light", name)
    for name, value in tokens["color"]["dark"].items():
        assert f"--{name}: {value};" in dark, ("dark", name)


def test_no_legacy_green_shell():
    out = tt.render()
    assert 'data-theme="shell' not in out
    assert "#14251d" not in out.lower() and "#d69329" not in out.lower()


def test_type_and_phone_variants():
    out = tt.render()
    assert "--t-page: 800 72px/0.85 var(--font-display);" in out
    phone = block_of(out, "@media (max-width: 639px) {\n  :root")
    assert "--t-page: 800 44px/0.85 var(--font-display);" in phone
    assert "--t-cover: 800 56px/0.86 var(--font-display);" in phone
    assert "--t-trip: 800 26px/0.9 var(--font-display);" in phone


def test_allowed_text_pairs_meet_aa():
    colours = tt.load()["color"]
    for theme in ("light", "dark"):
        for fg, bg in TEXT_PAIRS:
            ratio = contrast(colours[theme][fg], colours[theme][bg])
            assert ratio >= 4.5, (theme, fg, bg, round(ratio, 2))
        # control borders and focus rings need 3:1 against the surface and page
        assert contrast(colours[theme]["line-2"], colours[theme]["surface"]) >= 3.0, (theme, "line-2")
        assert contrast(colours[theme]["focus"], colours[theme]["bg"]) >= 3.0, (theme, "focus")


def test_minimum_text_size_is_11_5():
    tokens = tt.load()
    sizes = [t["size"] for k, t in tokens["type"].items() if k != "rules"]
    assert min(sizes) >= 11.5


def test_brand_marks_are_emitted_per_theme_and_readable():
    # tokens.md 2.3: --brand-google-* in light, dark and sunlight (the light set); label AA on its fill, stroke 3:1 on the card
    tokens = tt.load()
    out = tt.render(tokens)
    g = tokens["color"]["brand"]["google"]
    for selector, key in ((':root,\n[data-theme="light"]', "light"), ('[data-theme="dark"]', "dark"), ('[data-theme="sunlight"]', "light")):
        css = block_of(out, selector)
        for part, value in g[key].items():
            assert f"--brand-google-{part}: {value};" in css, (selector, part)
    for key in ("light", "dark"):
        assert contrast(g[key]["ink"], g[key]["fill"]) >= 4.5, key
        for ground in ("surface", "bg"):
            assert contrast(g[key]["stroke"], tokens["color"][key][ground]) >= 3.0, (key, ground)
