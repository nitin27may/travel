# Smart search phase 2 spike (SQ2s)

Status: measured 19 Oct 2026 by lane SQ2s (travel-builder, no spend). Spec: `docs/v2/features/smart-search.md` section 10. Code, labels and raw numbers: `web/scripts/embed-spike/` (`labels.json`, `results.json`, `browser-results.json`). Nothing here ships.

## Verdict

**Not a clean pass, not a fail: a judgement call, and the call is no phase 2 today.**

- Against the spec's literal rule (d beats a by 0.10 on queries that leave words over) it passes: hybrid 0.62 against the parser's list 0.09, +0.53. That comparison is unfair to (a): when words are left over, phase 1 puts them in `q` as a substring filter, and that returns an empty list for 10 of the 11 queries.
- Against the fairer baseline, the parser's own filters with no `q` filter (a2), the gain is +0.077 (95% interval +0.001 to +0.215). That sits between the 0.05 and 0.10 lines.
- Against plain full text (b), the thing vectors would have to justify themselves over, the gain is small: hybrid without filters (e) over BM25 is +0.064 overall (interval +0.010 to +0.120) and +0.039 on queries with words left over (interval -0.015 to +0.112).
- It costs a 34 MB model plus a 14 to 27 MB runtime, a 0.9977 browser-to-Node parity (spec needs 0.999), and about 190 to 245 MB of extra memory (spec 200 MB).

I call the in-between case this way: the quality gain is real but small on a catalogue this size, and most of it is already available from full text, which is free and ships today. Revisit at about 1,000 places with the summaries filled in (only 73 of the 353 places have one; the text being embedded is mostly a name, a type and an area).

**Recommendation: neither, for now.** Ship the phase 1 parser, and add a BM25 or MiniSearch pass over the card text for the words the parser leaves over (about 10 KB of text per 100 places, already public). If phase 2 is wanted later, take the browser path only on desktop and Wi-Fi behind a "Rank by meaning" control, or wait for a backend that exists for other reasons and use the Supabase Edge path; do not create a Supabase project for search alone (see gotchas).

## Method

- **Places:** the 353 public place cards from `listPlaces()` (the same adapter the site builds from). Text per place, `cardText()`: name, type label and area chain, the public one-line summary, tag labels. Nothing outside a card (smart-search 9.2). 73 places have a summary, 64 have tags.
- **Queries and labels:** 30 queries, `labels.json`. 17 come from the spec's 30 (those that target places and that the 353 can answer: spec ids 1 to 11, 20, 21, 24, 25, 27, 29). 13 are mine. 13 spec queries were dropped, each with its reason in the file (trip queries, no Niagara/Norway/Swiss gondola/Ontario beach in the data, facts the cards do not carry such as toilets and dogs). Each place is graded 2 (clearly asked for) or 1 (partly), 215 judgements in all, with a rationale per query. I judged from place identity and the card text before running any ranker, and did not adjust a label afterwards. Where a card does not carry the fact (strollers, wheelchair access), the judgement rests on what the place is, and that is noted in the rationale. Pooled judging from method outputs was not used, so places no method surfaced can only be missed by me, not by the methods.
- **Model:** `Supabase/gte-small`, revision `93b36ff09519291b77d6000d2e86bd8565378086`, file `onnx/model_quantized.onnx` (dtype `q8`), sha256 `18dec105109b6004369799ca4761fb8fb413c64172c02147bcfac186b5c5f6cb`, 34,014,426 bytes. 384 dims, mean pooling, L2 normalised, no query prefix. Library `@huggingface/transformers` 4.3.1 (exact), Node v22.23.2. One download into `.cache/models` (gitignored); the second run used `allowRemoteModels = false`, and the sha256 matched the pin.
- **Rankings:** (a) the merged parser plus the Places list as phase 1 would show it (facets, leftover words as a substring filter, default order); (a2) the same facets without the leftover-word filter; (b) BM25 (k1 1.2, b 0.75, light plural stemming, stop words dropped) over the card text, all 353 places; (c) cosine over int8-free float vectors, all 353; (d) RRF (k 60) of BM25 and vectors inside the pool of rows that pass every parsed filter, empty if none; (d2) the same inside a pool that applies only where and what (country, region, area, type) and keeps the band filters (kids, effort, season, `f.*`) as unchecked, falling back to the whole catalogue if empty; (e) RRF with no filters. Gap rows are never ranked into the main list.
- **Metrics:** graded nDCG@10 (gain = grade), recall@10 (hits over min(relevant, 10)). Differences are paired bootstrap, 5,000 resamples, seeded.

## Results

nDCG@10:

| Group | n | (a) parser list | (a2) parser filters only | (b) full text | (c) vectors | (d) hybrid, hard filters | (d2) hybrid, where/what pool | (e) hybrid, no filters |
|---|---|---|---|---|---|---|---|---|
| all | 30 | 0.154 | 0.320 | 0.524 | 0.624 | 0.338 | 0.528 | 0.587 |
| withWords | 11 | 0.091 | 0.543 | 0.744 | 0.813 | 0.621 | 0.621 | 0.783 |
| parsedFully | 19 | 0.191 | 0.191 | 0.396 | 0.514 | 0.174 | 0.475 | 0.474 |

recall@10:

| Group | n | (a) parser list | (a2) parser filters only | (b) full text | (c) vectors | (d) hybrid, hard filters | (d2) hybrid, where/what pool | (e) hybrid, no filters |
|---|---|---|---|---|---|---|---|---|
| all | 30 | 0.135 | 0.274 | 0.543 | 0.616 | 0.294 | 0.511 | 0.600 |
| withWords | 11 | 0.091 | 0.471 | 0.682 | 0.745 | 0.525 | 0.525 | 0.731 |
| parsedFully | 19 | 0.161 | 0.161 | 0.463 | 0.541 | 0.161 | 0.502 | 0.525 |

"Words left" groups queries by whether the parser left words over (11) or consumed everything (19).

Paired nDCG@10 differences:

| Group | Pair | Mean | 95% interval |
|---|---|---|---|
| all | d-a | +0.184 | [+0.066, +0.312] |
| all | d-af | +0.018 | [-0.022, +0.077] |
| all | dsoft-af | +0.208 | [+0.077, +0.342] |
| all | e-b | +0.064 | [+0.010, +0.120] |
| all | c-b | +0.100 | [+0.013, +0.201] |
| all | e-c | -0.036 | [-0.109, +0.021] |
| all | dsoft-b | +0.005 | [-0.101, +0.102] |
| withWords | d-a | +0.530 | [+0.303, +0.745] |
| withWords | d-af | +0.077 | [+0.001, +0.215] |
| withWords | dsoft-af | +0.077 | [+0.001, +0.215] |
| withWords | e-b | +0.039 | [-0.015, +0.112] |
| withWords | c-b | +0.069 | [-0.071, +0.251] |
| withWords | e-c | -0.030 | [-0.197, +0.081] |
| withWords | dsoft-b | -0.123 | [-0.332, +0.043] |
| parsedFully | d-a | -0.016 | [-0.047, +0.006] |
| parsedFully | d-af | -0.016 | [-0.047, +0.006] |
| parsedFully | dsoft-af | +0.284 | [+0.091, +0.467] |
| parsedFully | e-b | +0.078 | [+0.005, +0.159] |
| parsedFully | c-b | +0.118 | [+0.013, +0.240] |
| parsedFully | e-c | -0.040 | [-0.102, +0.012] |
| parsedFully | dsoft-b | +0.079 | [-0.011, +0.188] |

Per query, nDCG@10 / recall@10:

| # | Query | Rel | Words left | a | af | b | c | d | dsoft | e |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | easy hike with kids near Banff in September | 11 | - | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.39 / 0.50 | 0.00 / 0.00 | 0.41 / 0.40 | 0.34 / 0.30 |
| 2 | waterfall I can reach with a stroller | 20 | - | 0.23 / 0.10 | 0.23 / 0.10 | 0.39 / 0.60 | 0.51 / 0.70 | 0.23 / 0.10 | 0.51 / 0.60 | 0.51 / 0.60 |
| 3 | lakes in Iceland | 1 | - | 1.00 / 1.00 | 1.00 / 1.00 | 1.00 / 1.00 | 1.00 / 1.00 | 1.00 / 1.00 | 1.00 / 1.00 | 1.00 / 1.00 |
| 4 | hot springs in Iceland in winter | 3 | - | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.64 / 0.33 | 0.00 / 0.00 | 0.18 / 0.33 | 0.18 / 0.33 |
| 5 | via ferrata for a 12 year old in the Dolomites | 4 | - | 0.00 / 0.00 | 0.00 / 0.00 | 0.28 / 0.25 | 0.00 / 0.00 | 0.00 / 0.00 | 0.18 / 0.25 | 0.18 / 0.25 |
| 6 | short walk under 3 km with a toddler | 15 | - | 0.32 / 0.20 | 0.32 / 0.20 | 0.24 / 0.10 | 0.05 / 0.10 | 0.16 / 0.20 | 0.00 / 0.00 | 0.00 / 0.00 |
| 7 | trails under 5 km near Jasper | 6 | - | 0.98 / 1.00 | 0.98 / 1.00 | 0.17 / 0.33 | 0.42 / 0.67 | 0.76 / 1.00 | 0.26 / 0.50 | 0.26 / 0.50 |
| 8 | half day hike in Zion | 5 | - | 0.00 / 0.00 | 0.00 / 0.00 | 0.62 / 1.00 | 0.79 / 1.00 | 0.00 / 0.00 | 0.79 / 0.80 | 0.77 / 1.00 |
| 9 | wheelchair accessible sights in Vermont | 4 | - | 0.00 / 0.00 | 0.00 / 0.00 | 0.65 / 1.00 | 0.90 / 1.00 | 0.00 / 0.00 | 0.86 / 1.00 | 0.86 / 1.00 |
| 10 | viewpoint for sunset in the Dolomites | 9 | - | 0.00 / 0.00 | 0.00 / 0.00 | 0.37 / 0.44 | 0.35 / 0.33 | 0.00 / 0.00 | 0.44 / 0.44 | 0.44 / 0.44 |
| 11 | hidden gems in Utah | 9 | - | 0.00 / 0.00 | 0.00 / 0.00 | 0.04 / 0.11 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 |
| 12 | rainy day things to do with kids in Banff | 3 | - | 0.00 / 0.00 | 0.00 / 0.00 | 0.27 / 0.67 | 0.35 / 0.67 | 0.00 / 0.00 | 0.38 / 0.67 | 0.38 / 0.67 |
| 13 | free things to do near Lake Louise | 10 | - | 0.00 / 0.00 | 0.00 / 0.00 | 0.52 / 0.40 | 0.51 / 0.50 | 0.00 / 0.00 | 0.42 / 0.40 | 0.42 / 0.40 |
| 14 | stroll near Lake Louise | 5 | - | 0.00 / 0.00 | 0.00 / 0.00 | 0.55 / 0.40 | 0.57 / 0.40 | 0.00 / 0.00 | 0.57 / 0.40 | 0.57 / 0.40 |
| 15 | kid friendly waterfalls in Ontario | 1 | - | 0.00 / 0.00 | 0.00 / 0.00 | 1.00 / 1.00 | 1.00 / 1.00 | 0.00 / 0.00 | 1.00 / 1.00 | 1.00 / 1.00 |
| 16 | hard hikes in Chamonix in July | 3 | - | 0.00 / 0.00 | 0.00 / 0.00 | 0.09 / 0.33 | 0.87 / 1.00 | 0.00 / 0.00 | 0.87 / 1.00 | 0.66 / 1.00 |
| 17 | waterfalls worth the journey in Patagonia | 1 | - | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 |
| 18 | white water rafting | 8 | - | 0.35 / 0.25 | 0.35 / 0.25 | 0.44 / 0.25 | 0.56 / 0.38 | 0.40 / 0.25 | 0.40 / 0.25 | 0.56 / 0.38 |
| 19 | soak in hot springs | 8 | soak | 0.00 / 0.00 | 0.79 / 0.62 | 0.88 / 0.88 | 0.93 / 0.88 | 0.79 / 0.62 | 0.79 / 0.62 | 0.89 / 0.88 |
| 20 | see a glacier up close | 15 | see up close | 0.00 / 0.00 | 0.15 / 0.10 | 0.67 / 0.50 | 0.72 / 0.60 | 0.24 / 0.10 | 0.24 / 0.10 | 0.69 / 0.50 |
| 21 | horseback riding | 3 | horseback | 1.00 / 1.00 | 1.00 / 1.00 | 1.00 / 1.00 | 1.00 / 1.00 | 1.00 / 1.00 | 1.00 / 1.00 | 1.00 / 1.00 |
| 22 | scenic drive through the mountains | 9 | through mountains | 0.00 / 0.00 | 0.86 / 0.89 | 0.84 / 0.78 | 0.90 / 0.78 | 0.87 / 0.89 | 0.87 / 0.89 | 0.93 / 0.89 |
| 23 | world war one history in the mountains | 4 | world war one history | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.78 / 0.50 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 |
| 24 | dark sky stargazing | 2 | dark sky | 0.00 / 0.00 | 0.00 / 0.00 | 1.00 / 1.00 | 0.79 / 1.00 | 0.00 / 0.00 | 0.00 / 0.00 | 1.00 / 1.00 |
| 25 | black sand beach | 3 | black sand | 0.00 / 0.00 | 1.00 / 1.00 | 1.00 / 1.00 | 0.95 / 1.00 | 1.00 / 1.00 | 1.00 / 1.00 | 0.97 / 1.00 |
| 26 | fall colours hike | 14 | - | 0.75 / 0.50 | 0.75 / 0.50 | 0.90 / 0.90 | 0.87 / 0.70 | 0.75 / 0.50 | 0.74 / 0.50 | 0.88 / 0.70 |
| 27 | walk through a canyon | 14 | through | 0.00 / 0.00 | 0.00 / 0.00 | 0.67 / 0.50 | 0.62 / 0.50 | 0.75 / 0.60 | 0.75 / 0.60 | 0.75 / 0.60 |
| 28 | wildlife watching | 7 | watching | 0.00 / 0.00 | 0.65 / 0.43 | 0.38 / 0.29 | 0.74 / 0.57 | 0.65 / 0.43 | 0.65 / 0.43 | 0.74 / 0.71 |
| 29 | mountain hut or tea house for lunch | 6 | tea house lunch | 0.00 / 0.00 | 0.60 / 0.33 | 0.85 / 0.67 | 0.84 / 0.67 | 0.60 / 0.33 | 0.60 / 0.33 | 0.85 / 0.67 |
| 30 | cable car or gondola up a mountain | 12 | up mountain | 0.00 / 0.00 | 0.93 / 0.80 | 0.90 / 0.90 | 0.66 / 0.70 | 0.93 / 0.80 | 0.93 / 0.80 | 0.79 / 0.80 |

### What the numbers say

- **The parser is strict and the public data is thin.** Hard filters on kids, effort, season and `f.*` empty the pool on 11 of 30 queries (the band data is mostly unanswered), so (d) with hard filters scores 0.338 and (a) 0.154. Keeping gaps visible rather than dropping rows (d2) recovers most of it (0.528). A parser type guess can also be wrong: "world war one history" maps to nothing useful and "dark sky" maps to `nature.wildlife`; under a hard pool one wrong `k` zeroes a query.
- **Vectors alone are the best single ranker here (0.624), and RRF with BM25 dilutes them (0.587).** That is without any tuning of the fusion; I did not tune it, to avoid fitting 30 queries. Vector wins that full text cannot make: "world war one history" (0.78 against 0), "hot springs in Iceland" (0.64 against 0, because the Myvatn card says baths), "hard hikes in Chamonix" (0.87 against 0.09), "see a glacier" and "black sand beach" (both rely on the model knowing Reynisfjara). Full text wins where the card names the thing ("cable car or gondola", "fall colours hike", "dark sky").
- **Small sample.** 30 queries, 11 with words left over. The intervals above are wide and several cross zero.

## Measurements

Node, whole catalogue (offline run): 353 cards in 2.2 s (6.4 ms each, batch 16), 30 single queries at a median of 2.1 ms. Model load in Node 0.46 s warm disk.

Model files: `model_quantized.onnx` 34,014,426 bytes raw (32.4 MiB), 24,318,341 bytes gzip -9. Tokenizer 0.71 MB. The ONNX Runtime wasm needed on top: `ort-wasm-simd-threaded.wasm` 14.3 MB raw (WASM path) or `.asyncify.wasm` 26.9 MB raw (the library default, needed for WebGPU). The first visit transferred 28.0 MB gzipped on the WASM path and 31.0 MB with WebGPU, from a local server that gzips like a CDN. A host that serves the ONNX without compression sends 34.0 MB plus the runtime.

Browser: Chromium 1248, headless, `--use-gl=angle --use-angle=gl --ignore-gpu-blocklist --enable-gpu-rasterization` plus `--enable-unsafe-webgpu --enable-features=Vulkan`. WebGPU adapter `intel gen-12hp` (the Arc A770M). CDP CPU throttle 4x as the mid-range phone proxy; there was no real phone, so the phone numbers are a proxy. Load time excludes the download (local server).

| Config | Load, first visit | Load, cached | First query | Warm p50 / p95 | Extra RSS |
|---|---|---|---|---|---|
| WASM, 1 thread, 1x | 0.75 s | 0.67 s | 56 ms | 12 / 27 ms | 229 MB |
| WASM, 1 thread, 4x | 2.19 s | 1.68 s | 163 ms | 38 / 55 ms | 200 MB |
| WASM, 4 threads, 4x (needs COOP and COEP) | 1.67 s | 1.45 s | 157 ms | 20 / 31 ms | 246 MB |
| WebGPU, 1x | 2.40 s | 1.07 s | 459 ms | 168 / 190 ms | 307 MB |
| WebGPU, 4x | 5.31 s | 3.31 s | 593 ms | 290 / 1,191 ms | 290 MB |

WebGPU is slower than WASM for a 33M-parameter model with 10-token queries, and its p95 spikes. Use WASM. The 1x desktop row ran while other work was on the machine, so its cached row is noisier than it should be.

Parity (spec step 5): 50 card texts embedded in Chromium and in Node, minimum cosine **0.9977** on WASM and 0.9978 on WebGPU, against the 0.999 requirement. Same ONNX file and dtype, different runtime kernels. int8 vector quantisation alone loses little (worst cosine of 50 vectors against their float originals, 0.9989).

Shards (ids only, int8, header plus a 2-byte row index and 384 int8 per place, one per country, `place-<cc>.bin`): 137,475 bytes raw and 83,911 bytes gzip for all 353 places. Largest: Canada 183 places, Italy 61 places 23.7 KB raw / 14.3 KB gzip, US 12.3 KB gzip. About 387 bytes a place raw, 240 gzip (int8 vectors compress to about 60%). At 10,000 places that is about 2.4 MB gzip in total; a country shard of 3,000 places would be 720 KB gzip, so the 150 KB cap needs shards of at most about 600 places (split by country and kind, then by area).

## Budgets, one by one

| Budget (spec) | Measured | Result |
|---|---|---|
| Model at most 35 MB transferred once | 34.0 MB raw, 24.3 MB gzip. But the ONNX Runtime wasm adds 3.7 MB gzip (14.3 raw), 28.0 MB total gzip | Pass for the model alone, narrowly if served raw. The total first-visit payload is 28 to 48 MB |
| Warm p50 at most 250 ms, p95 at most 600 ms on a phone | 38 / 55 ms (WASM, 4x CPU) | Pass, with large margin. WebGPU fails p95 (1,191 ms) |
| Cold start at most 5 s | 2.2 s of compute at 4x CPU, plus the download: 28 MB is about 11 s at 20 Mbps and about 4.5 s at 50 Mbps | Pass on a cached return visit and on fast Wi-Fi; fail on a first visit over mobile data |
| Shards at most 150 KB | 14.3 KB gzip largest today (Italy) | Pass today, needs a split rule from about 600 places a shard |
| Memory at most 200 MB extra on phone | 187 to 246 MB RSS delta (desktop renderer, includes the wasm heap) | Borderline fail. Not measured on a phone |
| Parity at least 0.999 | 0.9977 | Fail |
| Desktop warm at most 60 ms | 12 ms p50 / 27 ms p95 | Pass |

## P8: can vectors be fetched per shard without a bulk catalogue copy?

Partly. The shard format holds no text, only a row index and a vector, so a shard alone says nothing a name search does not. The risks are different:

- All 353 vectors are 84 KB gzip. That is cheap to fetch in bulk, and a vector is a lossy but real fingerprint of the card text (embedding inversion recovers rough content). A scraper who wants the catalogue gets the ids and the neighbours cheaply, which is the "bulk catalogue copy" P8 is about, even if it is not the text.
- Per-shard fetching helps only if shards follow scope: a scoped query ("easy hike near Banff") reads `place-ca` and nothing else. The manifest that the search already loads carries the shard list, so a client reads only the shards the parse's `country` and `area` touch; an unscoped query reads none (it would need all of them, and that is the case to refuse in the browser path).
- With the browser path the model must ship too, so a determined client can embed every card text it already has from the public pages. The vectors add little to what the pages already give away. The real P8 cost is the second bulk surface (`/search/vec/**`), which the edge rate limit and bot block at go-live would have to cover, and which `tests/data/boundary.test.ts` must list.
- P9 point in favour of the server path: vectors stay in pgvector and never ship.

So per-shard is possible without enabling a one-request bulk copy only if the shards are scoped by country and area, an unscoped query is not served from the browser, and the edge limits cover `/search/vec/`.

## Gotchas found

- **Pages' 25 MiB file limit.** The model is 32.4 MiB and the asyncify runtime 25.7 MiB, so neither can sit on Pages. Plain `ort-wasm-simd-threaded.wasm` (13.6 MiB) can. The model needs R2 (L5 plans it) or the Hugging Face CDN (a third-party request with no query text). The transformers.js default fetches the runtime from jsDelivr; the bench pointed `wasmPaths` at local files, and production would have to as well.
- **Supabase free project pauses after 7 idle days.** A search-only project would be a recurring cold start; option B only makes sense with a backend that has other traffic.
- **Build and query models must be identical.** The 0.9977 browser-to-Node cosine shows the same file and dtype are not enough; rankings from vectors built in Node and queried in the browser mix two runtimes. Rebuild vectors with the browser runtime (or the Edge function for B) if this ships.
- **Threads need COOP and COEP.** Without them WASM runs on one thread (38 ms vs 20 ms p50 at 4x). Pages can set the headers in `_headers`, but they break third-party embeds such as map tiles unless those send CORP.
- The library default is the 26.9 MB asyncify runtime even for plain WASM; point `wasmPaths` at the 14.3 MB build.

## Not done

- No real phone and no Supabase Edge measurement (the Edge parity and latency rows of 10.2 step 5 need a project; none was created, no spend).
- Peak memory is the renderer RSS delta, not a phone heap.
- Fusion weights and BM25 parameters were not tuned.

## Change log

- 19 Oct 2026: written by SQ2s.
