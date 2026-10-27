# My map: proposed scratch palette (pending design review)

Spec: [features/world-map-scratch.md](../../features/world-map-scratch.md) section 2.3. Written 27 Oct 2026
(SCRATCHMAP-SPEC, travel-planner Opus). **Proposal, not live tokens.** The design reviewer owns the final values; once
approved they go into [foundation/tokens.md](../foundation/tokens.md) as section 5.4 and into `web/app/themes.css` through
`python3 tools/theme_tokens.py` (CLAUDE.md: colour lives only in `themes.css`). No component holds a hex.

## Rules this palette obeys

| Rule | Source | How |
|---|---|---|
| No green anywhere | owner, Q47; tokens 2 | the ramp is blue (hue about 214); no hue between 75 and 170 |
| No purple | owner brief, 27 Oct | no hue between 255 and 320 |
| One hue, one meaning | tokens 3 | visited uses the `--ok` hue ("done"); amber stays "selected" and is never a fill here |
| Selection reads on every fill | tokens 5.1 | amber edge over the ink casing; on each step one of the two layers is at least 3:1 (table below) |
| Colour is never the only signal | P4, accessibility | Lived stripes, Transit hatch, Want-to-go dots and a dashed edge, the legend and words in the sheet and list |
| Identity colours never on the map | tokens 4 | the swatches below are a separate family, not the Okabe-Ito identity keys |

## Default theme "Blue"

| Token | Light | Dark | Use |
|---|---|---|---|
| `--scratch-sea` | `#DDE3EA` | `#0F1620` | ocean and the map background |
| `--scratch-land` | `#F7F5F0` | `#263241` | unmarked land (the "foil"), with a 4% fine-grain pattern in `--ink` that the scratch wipe removes |
| `--scratch-border` | `#B9C2CC` | `#0B1119` | 0.5 px country borders, non-scaling |
| `--scratch-1` | `#B4CBEB` | `#2E4C78` | Been, step 1 |
| `--scratch-2` | `#7FA3D8` | `#3E68A3` | step 2 |
| `--scratch-3` | `#4A76BA` | `#5F8FD0` | step 3 |
| `--scratch-4` | `#1F4E8C` (= `--ok`) | `#8DB6EE` (= `--ok` dark) | step 4 |
| `--scratch-lived` | `#0F2E5C` + stripes `#FFFFFF` at 22% | `#C4DBF7` + stripes `#0F1620` at 25% | Lived |
| `--scratch-want` | land + dots `--ink` at 35%, 1.5 px dashed `--line-2` edge | land + dots `--ink` at 40% | Want to go |
| `--scratch-transit` | land + 45° hatch `--ink` at 22% | land + hatch `--ink` at 25% | Transit |
| selection | 2 px `--accent` over 1 px `--map-casing` | same | selected unit (tokens 5.1) |
| hover | 1.5 px `--accent` over 0.5 px casing; no fill change on marked units | same | |

### Measured contrast (WCAG relative luminance, 27 Oct 2026)

Light theme:

| Pair | Ratio |
|---|---|
| land on sea | 1.19 (the coast also has the 0.5 px border) |
| land to step 1, 1 to 2, 2 to 3, 3 to 4, 4 to lived | 1.52, 1.56, 1.77, 1.82, 1.61 |
| step 1, 2, 3, 4, lived on sea | 1.28, 2.00, 3.54, 6.43, 10.38 |
| amber edge on land, 1, 2, 3, 4, lived | 2.31, 1.52, 1.03, 1.82, **3.30**, **5.33** |
| ink casing on land, 1, 2, 3, 4, lived | **14.74**, **9.70**, **6.22**, **3.51**, 1.93, 1.20 |
| one edge layer at 3:1 or more | every fill passes (casing on land to step 3, amber on step 4 and lived) |

Dark theme:

| Pair | Ratio |
|---|---|
| land on sea | 1.40 |
| land to step 1, 1 to 2, 2 to 3, 3 to 4, 4 to lived | 1.50, 1.64, 1.70, 1.59, 1.47 |
| amber edge on land, 1, 2, 3, 4, lived | **5.17**, **3.45**, 2.25, 1.32, 1.20, 1.78 |
| dark casing (`#0B1119`) on land, 1, 2, 3, 4, lived | 1.46, 2.18, **3.35**, **5.71**, **9.07**, **13.37** |
| one edge layer at 3:1 or more | every fill passes (amber on land and step 1, casing on steps 2 to lived) |

Adjacent steps differ by 1.5 to 1.8:1. That is enough to read depth on a map but not as a sole signal, which is why the
step number is in the sheet ("step 2 of 4") and the list, and Lived carries stripes.

## Other themes (the visitor chooses one in Map settings)

| Theme | Hue | Step 1 to 4 light (proposed) | Note for the reviewer |
|---|---|---|---|
| Blue | 214 | as above | default |
| Rose | 335 | `#F0C9DA` `#DE93B5` `#C25E8E` `#8E2F62` | not purple; distinct from `--crit` (hue 10) |
| Ochre | 38 | `#F1DDB5` `#DDB570` `#B9862E` `#7A5200` | near the amber accent; the selection relies on the casing on steps 1 to 3; reviewer may reject |
| Slate | 214, low chroma | `#D5DBE2` `#A9B4C1` `#6F7E8F` `#3B4756` | prints well in greyscale |

Dark values for the other themes are derived by the same lightness ladder as Blue and measured in WM-DR.

## Per-country swatches (manual colour)

Six keys, each a single fill used at full strength, with the unit's level pattern on top:

| Key | Light | Dark |
|---|---|---|
| `blue` | `#1F4E8C` | `#8DB6EE` |
| `sky` | `#4FA3D1` | `#7CC0E6` |
| `rose` | `#B5517F` | `#E39BBE` |
| `coral` | `#C8603F` | `#EE9A7E` |
| `sand` | `#B8963E` | `#D9BE78` |
| `slate` | `#5A6772` | `#A3B0BE` |

No green, no purple. `coral` sits near `--crit` in hue; it is allowed because it never carries text or status, only a
country the visitor chose to paint. The reviewer measures the selection edge on each swatch in WM-DR.

## Share image and poster

The image uses the visitor's theme on `--scratch-sea` light unless the page is dark, with text in `--ink` on
`--surface`; the dark image uses the dark values. Both pass the text pairs of tokens 2.2 because the text sits on the
card's surface band, never on the map.
