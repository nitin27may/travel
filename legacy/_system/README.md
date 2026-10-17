# `_system/` — shared components and themes for trip plans

Built because five hand-authored trip pages had drifted into **two incompatible
implementations of the same design system** (`.card .split .content` vs `.card .chead .cbody`;
`.blaze.*` vs `.s-*`/`.g-*`), which meant every CSS bug had to be fixed five times.

The output contract has not changed: **one self-contained `index.html` per trip, no build
artifacts, no external JS, works offline at a trailhead with no signal.**

## Layout

| Path | What it is |
|---|---|
| `build.py` | Builder + validation gates. Stdlib only, zero dependencies. |
| `base.css` | All shared components. **Contains no colour** — only `var(--token)`. |
| `base.js` | Countdown, checklist persistence, scrollspy, A/B plan toggle. |
| `layout.html` | Page shell with `{{slot}}` placeholders. |
| `themes/*.css` | The only place colour lives. One file per palette. |
| `components/` | Per-component partials (populated in Phase 3). |
| `gallery.html` | Generated. Every theme rendered side by side with identical markup. |

## Commands

```bash
python3 _system/build.py --check          # validate system + all themes
python3 _system/build.py --list-themes    # themes with tightest contrast margin
python3 _system/build.py --gallery        # regenerate gallery.html
```

## The token contract

Themes must define exactly these, no more and no fewer. `build.py` fails the build otherwise.
Tokens are named for **what they do**, not what colour they are — that is what makes them
swappable. The old `--spruce` / `--swiss` / `--rosa` naming is precisely why the original
palettes could not be exchanged.

```
surfaces   --bg  --surface  --bg-deep  --bg-deep-2
text       --ink  --ink-on-deep  --muted  --line
accent     --accent  --accent-dark  --accent-ink  --accent-soft
headers    --header  --header-ink  --header-sub
hazards    --warn  --warn-soft
added      --highlight  --highlight-ink  --highlight-soft
classifier --class-1 … --class-6
```

## Themes

| Theme | Origin | Suits |
|---|---|---|
| `forest` | Vermont, Niagara | hiking, foliage, gorges, forest parks |
| `maritime` | Québec | historic cities, river and lake towns |
| `alpenglow` | Dolomites | high limestone, via ferrata, rifugi |
| `alpine-snow` | Switzerland | glaciers, rail/cable access, car-free resorts |
| `autumn` | new | harvest, vineyards, orchards, foliage drives |
| `coastal` | new | shorelines, islands, harbours, cliff walks |
| `desert` | new | canyons, arid parks, badlands |
| `urban` | new | capitals, museums, food-led city trips |

## The classifier

Replaces both the old `.blaze.*` and `.s-*`/`.g-*` systems with one component. Each trip
**declares its own vocabulary**; the theme supplies the colour per slot; the legend is
generated from the declaration.

```json
"classifier": {
  "label": "Leg type",
  "values": [
    {"key": "trail", "name": "Trail on foot — real footing", "slot": 1},
    {"key": "road",  "name": "Road leg",                     "slot": 2},
    {"key": "town",  "name": "Town walking — paved",         "slot": 3},
    {"key": "food",  "name": "Food",                         "slot": 4}
  ]
}
```

Markup: `<span class="mark mark--1"></span>`. Dolomites would declare
`book / dawn / high / shut / open / check` instead — same component, same CSS, different
meaning. This keeps the trip-planner skill's rule that structural devices must encode
something true.

## Gates (why this survives a year)

1. **No hex literals outside `themes/`.** Without it, colour leaks into components and themes
   silently stop being swappable.
2. **Every `var(--x)` in `base.css` is in the contract.** Catches typos that would render as
   invisible or unstyled.
3. **WCAG AA contrast per theme.** Every core text pairing is checked. This already caught a
   real pre-existing bug: the original Vermont/Niagara `--muted` (`#68756d` on `#f6f4ee`) was
   4.39 — below the 4.5 threshold for body text, in pages read outdoors in bright sun. All
   themes were nudged 2–4 hex points to clear it.
4. **Output self-containment.** `check_output_is_self_contained()` asserts no local stylesheet
   link and no external `<script src>`.

## Known deltas vs the current live pages

`--muted` is very slightly darker than the hand-written originals (forest: `#68756d` →
`#66736b`). Visually imperceptible, but it **will** appear in a pixel-diff during the Phase 1
migration. That difference is intentional — do not "fix" it back.
