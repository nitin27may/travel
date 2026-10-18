"""WCAG contrast check for each direction's text pairs, light and dark. Run: python3 contrast.py"""
import re, sys
import atlas, altimeter, trailhead

def lum(h):
    h = h.lstrip('#'); c = [int(h[i:i+2], 16) / 255 for i in (0, 2, 4)]
    c = [x / 12.92 if x <= .03928 else ((x + .055) / 1.055) ** 2.4 for x in c]
    return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]
def ratio(a, b):
    la, lb = sorted([lum(a), lum(b)], reverse=True); return (la + .05) / (lb + .05)
def tokens(css, sel):
    i = css.index(sel); block = css[i:css.index('}', i)]
    return dict(re.findall(r'--([\w-]+):(#[0-9A-Fa-f]{6})', block))
PAIRS = {  # fg, bg, minimum
    "atlas": [("ink", "bg", 4.5), ("muted", "bg", 4.5), ("muted", "paper", 4.5), ("crit", "bg", 4.5), ("crit", "crit-soft", 4.5), ("ok", "ok-soft", 4.5), ("warn", "warn-soft", 4.5), ("act-ink", "act", 4.5)],
    "altimeter": [("ink", "bg", 4.5), ("muted", "bg", 4.5), ("muted", "s1", 4.5), ("ink2", "s2", 4.5), ("sig-text", "bg", 4.5), ("sig-text", "sig-soft", 4.5), ("sig-ink", "sig", 4.5), ("crit", "bg", 4.5), ("ok", "ok-soft", 4.5), ("act-ink", "act", 4.5)],
    "trailhead": [("ink", "bg", 4.5), ("muted", "bg", 4.5), ("muted", "surface", 4.5), ("muted", "surface2", 4.5), ("accent-text", "bg", 4.5), ("accent-text", "accent-soft", 4.5), ("accent-ink", "accent", 4.5),
                  ("crit", "bg", 4.5), ("crit", "crit-soft", 4.5), ("ok", "ok-soft", 4.5), ("teal", "surface", 4.5), ("header-ink", "header", 4.5), ("header-mute", "header", 4.5)],
}
SEL = {"atlas": (":root{", "[data-theme=dark]{"), "altimeter": ("[data-theme=light]{", ":root{"), "trailhead": (":root{", "[data-theme=dark]{")}
fail = 0
for name, mod in (("atlas", atlas), ("altimeter", altimeter), ("trailhead", trailhead)):
    css = mod.CSS[mod.CSS.index(':root{'):]
    light = tokens(css, SEL[name][0]); dark = {**light, **tokens(css, SEL[name][1])}
    if name == "altimeter":
        dark = tokens(css, ":root{"); light = {**dark, **tokens(css, "[data-theme=light]{")}
    for theme, t in (("light", light), ("dark", dark)):
        for fg, bg, need in PAIRS[name]:
            if fg not in t or bg not in t: continue
            r = ratio(t[fg], t[bg]); ok = r >= need; fail += not ok
            print(f"{name:10} {theme:5} {fg:12} on {bg:12} {r:5.2f} {'ok' if ok else 'FAIL (need %s)' % need}")
sys.exit(1 if fail else 0)
