# Globe ADM2 audit

Status: done 19 Oct 2026 (lane L2b, step 18). Written by `python3 tools/globe_data.py audit`; this page is the human summary of `web/public/globe/admin/adm2-audit.json`. Spec: [design/globe/spec.md](../design/globe/spec.md) section 11; owner feedback F4 in [owner-feedback-2026-10-18.md](../design/globe/owner-feedback-2026-10-18.md).

## Why

Owner feedback F4: the globe's districts for Canada were the 76 economic regions, so "Toronto" covered Whitby and Oshawa, some names were cut off with a `*`, and the Lake Ontario shore was cut by straight lines. The audit asks the same three questions of every country that ships a district file.

## What was checked

| Check | Rule | Fails when |
|---|---|---|
| Level meaning | districts must be finer than the states we ship (Natural Earth admin-1) | fewer than 1.3 districts per state: the file is the state level under another name |
| Truncated names | geoBoundaries cuts long names with `*` | any name contains `*` |
| Shoreline | the 50m Natural Earth coast and border inside the file's box, sampled at up to 1,500 vertices, each measured to the nearest ADM2 edge | more than 25% of the samples are farther than 0.05 degrees (about 5 km) from every ADM2 edge |

A failing country loses its `adm2` entry in `web/public/globe/admin/index.json`: its shapes fall back to ADM1 only, and the panel still lists the districts from our own area tree. The failing files were left on disk, unreferenced, until the owner approved removal (below).

## What changed in the shipped data

- **Canada** is now the 293 census divisions of the 2021 census (Statistics Canada cartographic boundary file, Open Government Licence - Canada), one file per province (`CAN-ADM2-ON.json` and twelve more). Whitby resolves to **Durham** (CDUID 3518), not Toronto. The cartographic file is clipped to the coast, so the Lake Ontario shore follows the water. Source: `geo.statcan.gc.ca` ArcGIS service, layer 4 (the zip on `www12.statcan.gc.ca` answers a Cloudflare challenge to scripts). The service fails on some long-coast divisions at full detail, so the script falls back to coarser copies (0.002, 0.005, 0.01 degrees) and simplifies everything again to 1.5%.
- **USA, India and Brazil** are split into one district file per state (`USA-ADM2-TX.json`), so Texas does not download Alaska. The split follows Natural Earth's ISO 3166-2 code for the state; a district whose points vote for no state (Puerto Rico and the other territories, 91 of 3,233 US districts) is left out of the state files.
- The old whole files `CAN-ADM2.json`, `USA-ADM2.json`, `IND-ADM2.json` and `BRA-ADM2.json` are no longer referenced. They were removed on 19 Oct 2026 with the others (below).

## Result: 180 countries checked, 155 pass, 25 fall back to ADM1 only

### Fall back to ADM1 only

| Country | Districts | States | Coast far | Why |
|---|---|---|---|---|
| AZE | 79 | 78 | 2.6% | level: 79 districts for 78 states |
| BEL | 11 | 11 | 0.0% | level: 11 districts for 11 states |
| BFA | 45 | 45 | 0.0% | level: 45 districts for 45 states |
| BHS | 33 | 30 | 0.4% | level: 33 districts for 30 states |
| BIH | 12 | 18 | 0.0% | level: 12 districts for 18 states |
| COL | 1122 | 34 | 2.1% | 1 truncated names |
| DZA | 48 | 48 | 61.1% | level: 48 districts for 48 states; coast: 61% of sampled coast vertices more than 0.05 degrees from the ADM2 outline |
| ESP | 52 | 52 | 0.4% | level: 52 districts for 52 states |
| FRA | 96 | 101 | 2.4% | level: 96 districts for 101 states |
| GBR | 216 | 232 | 3.6% | level: 216 districts for 232 states |
| GIN | 34 | 34 | 0.8% | level: 34 districts for 34 states |
| GRC | 14 | 14 | 0.6% | 1 truncated names; level: 14 districts for 14 states |
| ITA | 20 | 110 | 2.3% | level: 20 districts for 110 states |
| LKA | 25 | 25 | 0.0% | level: 25 districts for 25 states |
| MAR | 75 | 16 | 45.8% | coast: 46% of sampled coast vertices more than 0.05 degrees from the ADM2 outline |
| MDV | 21 | 21 | 31.8% | level: 21 districts for 21 states; coast: 32% of sampled coast vertices more than 0.05 degrees from the ADM2 outline |
| MKD | 84 | 84 | 3.6% | level: 84 districts for 84 states |
| MNP | 4 | 4 | 0.0% | level: 4 districts for 4 states |
| MWI | 28 | 28 | 26.7% | level: 28 districts for 28 states; coast: 27% of sampled coast vertices more than 0.05 degrees from the ADM2 outline |
| PHL | 87 | 118 | 0.1% | level: 87 districts for 118 states |
| SRB | 145 | 25 | 0.0% | 1 truncated names |
| SVK | 79 | 8 | 0.0% | 2 truncated names |
| SVN | 212 | 193 | 0.0% | level: 212 districts for 193 states |
| SYC | 8 | 26 | 0.0% | level: 8 districts for 26 states |
| URY | 124 | 19 | 41.4% | coast: 41% of sampled coast vertices more than 0.05 degrees from the ADM2 outline |

Italy is the one that matters for us: the shipped ITA file holds the 20 regions, and Natural Earth's admin-1 for Italy is already the 110 provinces, so the district level adds nothing. The globe's districts for Italy are the areas of our own tree (Val di Funes, Braies, and so on), which the panel lists and the pins sit in.

### Pass

| Country | Districts | States | Coast far |
|---|---|---|---|
| AFG | 398 | 34 | 1.0% |
| AGO | 158 | 18 | 3.2% |
| ALB | 37 | 12 | 1.7% |
| ARG | 525 | 24 | 1.7% |
| ARM | 39 | 11 | 4.0% |
| AUS | 547 | 11 | 0.9% |
| AUT | 94 | 9 | 0.0% |
| BDI | 119 | 17 | 10.0% |
| BEN | 77 | 12 | 0.0% |
| BGD | 64 | 7 | 1.3% |
| BGR | 265 | 28 | 1.1% |
| BLR | 118 | 7 | 0.0% |
| BLZ | 31 | 6 | 3.0% |
| BOL | 110 | 9 | 4.5% |
| BRA | 5569 | 27 | 9.0% |
| BRN | 38 | 4 | 0.0% |
| BTN | 205 | 20 | 7.9% |
| BWA | 25 | 15 | 0.0% |
| CAF | 72 | 17 | 5.2% |
| CAN | 293 | 13 | 1.7% |
| CHE | 169 | 26 | 0.0% |
| CHL | 56 | 16 | 1.3% |
| CHN | 2391 | 32 | 15.6% |
| CIV | 33 | 19 | 2.7% |
| CMR | 60 | 10 | 4.2% |
| COD | 189 | 11 | 4.0% |
| COG | 46 | 12 | 9.8% |
| COM | 17 | 3 | 0.0% |
| CPV | 32 | 22 | 0.0% |
| CRI | 83 | 7 | 0.0% |
| CUB | 168 | 16 | 2.0% |
| CYP | 610 | 5 | 0.0% |
| CZE | 77 | 14 | 0.0% |
| DEU | 38 | 16 | 0.7% |
| DJI | 11 | 6 | 0.0% |
| DNK | 98 | 5 | 0.7% |
| DOM | 155 | 32 | 0.9% |
| ECU | 224 | 24 | 0.0% |
| EGY | 365 | 27 | 0.0% |
| ERI | 58 | 6 | 4.6% |
| EST | 214 | 15 | 3.0% |
| ETH | 74 | 11 | 6.5% |
| FIN | 70 | 18 | 0.8% |
| FJI | 15 | 5 | 9.3% |
| FSM | 75 | 4 | 0.0% |
| GAB | 49 | 9 | 9.5% |
| GEO | 68 | 12 | 0.0% |
| GHA | 260 | 10 | 1.4% |
| GMB | 48 | 6 | 0.0% |
| GNB | 39 | 9 | 3.8% |
| GNQ | 28 | 7 | 0.0% |
| GTM | 342 | 22 | 0.0% |
| GUM | 19 | 1 | 0.0% |
| GUY | 27 | 10 | 4.1% |
| HND | 298 | 18 | 0.5% |
| HRV | 560 | 21 | 0.0% |
| HTI | 42 | 10 | 0.0% |
| HUN | 198 | 43 | 0.0% |
| IDN | 519 | 33 | 1.7% |
| IND | 734 | 36 | 8.8% |
| IRL | 166 | 34 | 0.3% |
| IRN | 432 | 31 | 1.3% |
| IRQ | 101 | 18 | 3.3% |
| ISL | 74 | 9 | 2.2% |
| ISR | 15 | 6 | 5.4% |
| JAM | 827 | 14 | 0.0% |
| JOR | 52 | 12 | 0.0% |
| JPN | 1742 | 47 | 0.0% |
| KAZ | 174 | 16 | 17.3% |
| KEN | 290 | 8 | 4.8% |
| KGZ | 41 | 8 | 8.7% |
| KHM | 197 | 24 | 0.4% |
| KIR | 24 | 2 | 17.2% |
| KOR | 228 | 17 | 0.8% |
| KWT | 137 | 6 | 17.4% |
| LAO | 148 | 17 | 1.5% |
| LBN | 26 | 6 | 0.0% |
| LBR | 136 | 15 | 0.0% |
| LCA | 547 | 11 | 0.0% |
| LSO | 78 | 10 | 1.3% |
| LTU | 60 | 10 | 0.0% |
| LUX | 105 | 3 | 0.0% |
| LVA | 589 | 119 | 0.0% |
| MCO | 9 | 1 | 0.0% |
| MDG | 119 | 22 | 3.0% |
| MEX | 2457 | 33 | 6.8% |
| MLI | 50 | 9 | 5.0% |
| MMR | 74 | 14 | 0.8% |
| MNG | 339 | 22 | 2.2% |
| MOZ | 159 | 11 | 2.3% |
| MRT | 57 | 13 | 12.6% |
| MYS | 159 | 16 | 2.9% |
| NAM | 109 | 13 | 1.7% |
| NER | 67 | 8 | 5.0% |
| NGA | 774 | 37 | 3.3% |
| NIC | 153 | 17 | 2.2% |
| NLD | 344 | 15 | 2.1% |
| NOR | 431 | 21 | 0.3% |
| NPL | 75 | 14 | 12.3% |
| NZL | 88 | 24 | 4.8% |
| OMN | 61 | 11 | 3.6% |
| PAK | 126 | 8 | 10.1% |
| PAN | 76 | 12 | 0.4% |
| PER | 196 | 26 | 2.2% |
| PLW | 77 | 16 | 14.3% |
| PNG | 87 | 20 | 0.3% |
| POL | 380 | 16 | 1.2% |
| PRI | 78 | 1 | 0.0% |
| PRK | 179 | 11 | 0.4% |
| PRT | 311 | 20 | 0.8% |
| PRY | 247 | 18 | 0.0% |
| PSE | 16 | 0 | 0.0% |
| QAT | 79 | 7 | 2.9% |
| ROU | 3235 | 42 | 0.4% |
| RUS | 2327 | 86 | 7.7% |
| RWA | 30 | 5 | 0.0% |
| SAU | 147 | 13 | 7.6% |
| SDN | 189 | 17 | 10.2% |
| SEN | 45 | 14 | 1.2% |
| SGP | 55 | 5 | 0.0% |
| SLB | 50 | 10 | 0.3% |
| SLE | 14 | 4 | 1.6% |
| SLV | 272 | 14 | 0.0% |
| SOM | 118 | 13 | 11.6% |
| SSD | 78 | 0 | 15.5% |
| STP | 7 | 2 | 0.0% |
| SUR | 59 | 10 | 13.4% |
| SWE | 290 | 21 | 2.0% |
| SWZ | 53 | 4 | 0.0% |
| SYR | 61 | 15 | 2.9% |
| TCD | 70 | 22 | 6.1% |
| TGO | 37 | 5 | 3.0% |
| THA | 928 | 77 | 0.2% |
| TJK | 58 | 5 | 4.6% |
| TKM | 59 | 5 | 19.0% |
| TLS | 65 | 13 | 2.8% |
| TON | 23 | 5 | 0.0% |
| TUN | 264 | 23 | 2.1% |
| TUR | 973 | 81 | 0.0% |
| TUV | 34 | 1 | 0.0% |
| TWN | 368 | 21 | 0.0% |
| TZA | 170 | 30 | 16.1% |
| UGA | 151 | 112 | 10.9% |
| UKR | 495 | 25 | 23.4% |
| USA | 3142 | 51 | 14.3% |
| UZB | 199 | 14 | 7.5% |
| VEN | 335 | 26 | 12.8% |
| VNM | 708 | 63 | 0.5% |
| VUT | 65 | 6 | 1.1% |
| WSM | 43 | 11 | 0.0% |
| XKX | 38 | 0 | 0.0% |
| YEM | 335 | 21 | 3.5% |
| ZAF | 52 | 9 | 0.2% |
| ZMB | 116 | 10 | 1.3% |
| ZWE | 91 | 10 | 2.3% |

## Gotchas and known issues

- **The 50m coast is itself coarse** (about 1:50,000,000). A pass means the ADM2 outline follows it within 5 km; it does not mean the outline is exact.
- **Samples, not every vertex:** at most 1,500 per country, evenly spaced along the 50m boundary. A short stretch of bad coast can pass.
- **`level` is a count test.** A country can have more districts than states and still be the wrong level; the three we ship districts for on purpose (Canada, USA, Italy via our own tree) were checked by eye.
- **Truncated names:** a single `*` name fails a whole country (Colombia, Greece, Serbia, Slovakia). The alternative is to keep the file and show a clipped name; the spec chose the fallback.
- **Rebuilding:** `python3 tools/globe_data.py check` rebuilds `world`, `canada`, `split` and `audit` into a temp dir from `tools/.cache` and fails on any difference. It needs the cached downloads, which are not in git, and skips with a message when they are missing. It is not wired into `tools/check-all.sh` (not an L2b file); see the hand-back.

## Change log

| Date | Change |
|---|---|
| 19 Oct 2026 | First audit: 180 countries, Canada replaced by census divisions, USA, India and Brazil split by state. |

## Orphaned whole-country files removed (19 Oct 2026)

With the owner's approval (Q33) the 29 unreferenced whole-country files were deleted from `web/public/globe/admin/`, 4,653,807 bytes: `USA`, `BRA`, `IND`, `CAN` and `COL`, plus the 24 countries that fell back to ADM1 only (`AZE BEL BFA BHS BIH DZA ESP FRA GBR GIN GRC ITA LKA MAR MDV MKD MNP MWI PHL SRB SVK SVN SYC URY`). Nothing in `web/`, `core/` or the tests loaded them. `tools/tests/fixtures/served-urls.txt` still names `globe/assets/admin/BEL-ADM2.json`; that is the legacy site's assets directory, a different tree, and is untouched.

They are regenerable. `globe_data.py audit` and `check` no longer read them from the shipped tree: a dropped country's whole file is rebuilt from the download cache (`tools/.cache/adm2/<ISO3>.geojson`, simplified the way `admin2` does, written to `tools/.cache/adm2-whole/`), fetched through the same geoBoundaries code when the cache lacks it (only for countries a previous audit looked at). `check` still skips with a message when the cached sources are missing, and its result is the same with and without the files: 131 files rebuilt identically.
