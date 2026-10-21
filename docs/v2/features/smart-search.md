# Smart search with no model bill (backlog 3.15)

Status: spec written 19 Oct 2026 (travel-planner, Opus). Phase 1 is ready for a lane (backlog 3.43, lane SQ1). Phase 2 is a spike, then a decision. Phase 3 stays in L9.

Supersedes:
- the "natural-language search" item in backlog 2.41;
- the all-MiniLM-L6-v2 model named in the 3.15 row. The model is **gte-small** (384 dims), because Supabase Edge ships the same model built in (L9), so one model can serve both the browser and a later server;
- the hand-written `KIND_WORDS` and `KID_WORDS` tables in `web/lib/search/suggest.ts`. The parser replaces them, and its vocabulary comes from data.

## 1. Goal

A visitor types what they want the way they would say it: "easy hike with kids near Banff in September", "waterfall I can reach with a stroller". The site reads the words, turns them into the filters it already has, and shows how it read them. It costs nothing to run: no paid LLM and no tokens. It sends no query text to a third party. It never claims more than the data knows.

The work comes in three phases:

| Phase | What | Runtime cost | Decision |
|---|---|---|---|
| 1 | A deterministic query parser that maps words to existing URL filter keys, shows them as chips, and puts results it could not check on a separate "not checked yet" list | none (a few KB of vocabulary) | build it (lane SQ1) |
| 2 | Semantic ranking with gte-small embeddings, as a hybrid of full-text and vector search fused by reciprocal rank fusion | none in money. The browser path downloads a model of about 34 MB once; the server path uses the Supabase free tier | spike first, then decide (section 10) |
| 3 | Photo CLIP at build, "feels like this" similar places, pipeline helpers | build time only | later, under L9 |

Principles cited: P1 (design for 10,000 places: the vocabulary is data and the vectors are sharded), P3 (a glance, then a few clicks: one query replaces five pill choices), P4 (no manual needed: chips explain the parse), P6 (the right metadata: unknowns are labelled), P8 (no bulk catalogue), P9 (one data boundary).

## 2. What exists today

| Piece | Where | What it does |
|---|---|---|
| Split search index | `web/lib/search/build.ts`, served at `/search/manifest.json` and `/search/<kind>-<cc>/data.json` | 32 parts in total (622 areas, 209 places, 14 trips; about 112 KB raw). A record has a name, a second line, match text and a kind. The manifest carries 3-letter word prefixes per part, so a query loads only the parts that can match |
| Client boundary | `web/lib/client/data.ts`: `search(q, scope, limit)`, `suggest(q, scope)`, `listPlaces(query)`, `listTrips(query)` | The only module that reads catalogue data. `tests/data/boundary.test.ts` enforces this |
| Header search | `components/search/GlobalSearch.tsx` (and `components/home/CoverSearch.tsx`) | Name search grouped as trips, places and areas. When nothing matches, `suggest` links to a filtered Places list built from hard-coded kind and kid words |
| Aliases | `web/lib/search/aliases.ts` | 12 place-name aliases (rockies, dolomiti, usa ...) |
| List URL state | `web/lib/entities/url.ts`, `types.ts` | `q`, the base facets in `FACET_PARAMS` (`country`, `region`, `area`, `kind`, `k`, `season`, `kid`, `effort`, `stroller`, `tag`, `trip`, `length`, `around`, `perday`, `shape`, `drive` ...), the contract facets as `f.<key>`, and `bbox` |
| Facet engine | `web/lib/entities/facets/**`, `filter.ts` | `k=` takes type tokens at any depth (`water`, `nature.trail`, `nature.trail.hike`) and intents (`intent:do`). Scoped facets come from `contract-slice.json`. A facet may declare a `gap` (`isGap`), and `gapNotes` writes the "n not checked yet" line |
| Type vocabulary | `data/vocab/types.json` | 398 nodes (15 domains, 61 categories, 324 types), each with a `label`. Only 32 nodes carry `aliases` today |
| Gazetteer | `web/public/globe/data/gazetteer.json` | 13,741 rows, 803 KB, read by the globe only. The search must not load it (P9: no new bulk loads) |

### 2.1 The filter keys the parser may write

Places (`/places/`):

| Key | Values | Gap behaviour |
|---|---|---|
| `country` | ISO alpha-2, upper case | |
| `region`, `area` | slug or name (matched through `regionAliases`, `area`/`area_name`) | |
| `k` | type tokens and intents | |
| `season` | months `1`-`12`, several allowed | |
| `kid` | an age `0`-`17`, or `yes` | a gap is `kids_from === null`, "not checked yet" |
| `effort` | `stroll`, `easy`, `moderate`, `hard`, `technical` | a gap is "no effort rating" |
| `stroller` | `any`, `all-terrain` | a gap is no stroller flag, "not checked yet" |
| `f.length` | `lt3`, `3-6`, `6-10`, `10+` (trails and treks) | |
| `f.climb` | `lt150`, `150-400`, `400-800`, `800+` | |
| `f.time` (trails), `f.duration` (do) | `<1h`, `1-2h`, `2-4h`, `half-day`, `full-day`, `multi-day` | |
| `f.step-free`, `f.toilets`, `f.dogs`, `f.lifeguard`, `f.fenced`, `f.indoor-or-rainy-day` | `yes`, `no` (from row `flags`; a gap stores neither) | |
| `f.walk-from-the-car` | `lt200`, `200-600`, `600-1500`, `1500+` | |
| `f.best-time-of-day` | `sunrise` ... `sunset`, `night` | |
| `f.shape` | `loop`, `out-and-back`, `point-to-point`, `network` | |
| `f.price-band`, `f.booking-needed` | `free`, `$`...; `none`, `recommended`, `required` | |
| `q` | the words the parser did not use | |

Trips (`/trips/`): `country` (codes or continents), `season`, `length` (`day`, `overnight`, `weekend`, `long-weekend`, `4-8`, `9-14`, `15+`), `kid` (`4`, `6`, `8`, `10`, `12`), `effort` (`easy`, `moderate`, `strenuous`), `stroller` (`friendly`, `some`), `around` (`rental-car`, `camper-van`, `train`, `tours`), `perday`, `shape` (`one-base`, `road-trip`), `drive` (`toronto-1` ... `toronto-4`), `tag`, `q`.

Phase 1 adds **no new URL key**. Relevance words have no key yet (Q35).

## 3. Thirty real queries and their expected parse

These 30 are the parser's test fixture (`web/tests/search/queries.json`) and the phase 2 spike's query set. "Did you mean" is the alternative offered next to the chips (section 6.2). Area slugs are the tree's (`/globe/ca/alberta/banff/` gives `country=CA&region=alberta&area=banff`).

| # | Query | Target | Expected URL | Chips and notes |
|---|---|---|---|---|
| 1 | easy hike with kids near Banff in September | places | `country=CA&region=alberta&area=banff,banff-national-park&k=nature.trail&season=9&effort=stroll,easy` | Trails · Banff area, Alberta · September · Easy or a stroll · the question "With kids: how old is the youngest?" (A5, A9, REVIEW4 4.20). September gives no trail, so the list relaxes it and says so (A14) |
| 2 | waterfall I can reach with a stroller | places | `k=water.falls&stroller=any` | Waterfalls · Any stroller. Waterfalls with no stroller answer go to "not checked yet" |
| 3 | lakes in Iceland | places | `country=IS&k=water.body` | |
| 4 | hot springs in Iceland in winter | places | `country=IS&k=water.thermal.hot_spring&season=12,1,2` | "Hot springs" is an exact type (A3). Winter is Dec-Feb in Iceland (A8) |
| 5 | via ferrata for a 12 year old in the Dolomites | places | `country=IT&region=south-tyrol&area=dolomites&k=mountain.ferrata&kid=12` | "Via ferrata" resolves through the alias table |
| 6 | short walk under 3 km with a toddler | places | `k=nature.trail&f.length=lt3&kid=2` | "toddler" = age 2 (A9). The type alias "short walk" widens to its category (A3) |
| 7 | trails under 5 km near Jasper | places | `country=CA&region=alberta&area=jasper&k=nature.trail&f.length=lt3,3-6` | The chip says "Up to 6 km (nearest band)" (A10) |
| 8 | half day hike in Zion | places | `country=US&region=utah&area=zion&k=nature.trail&f.time=half-day` | |
| 9 | wheelchair accessible sights in Vermont | places | `country=US&region=vermont&k=culture&f.step-free=yes` | Step-free applies to culture and stays. Sights with no answer go to "not checked yet" |
| 10 | viewpoint for sunset in the Dolomites | places | `country=IT&region=south-tyrol&area=dolomites&k=nature.viewpoint&f.best-time-of-day=sunset` | |
| 11 | hidden gems in Utah | places | `country=US&region=utah` | "Hidden gem" is shown as "Not used yet: no filter for hidden gems" (Q35). Never dropped silently |
| 12 | lake with toilets close to the parking | places | `k=water.body&f.toilets=yes&f.walk-from-the-car=lt200` | "close to the parking" is a phrase for the walk band |
| 13 | day trip from Toronto under 2 hours | trips | `length=day&drive=toronto-1,toronto-2` | |
| 14 | weekend trip with kids in October | trips | `length=weekend&season=10` | Chip "With kids: how old is the youngest?" offers 4, 6, 8, 10 and 12 (A9). It sets nothing until an age is picked |
| 15 | road trip in Utah with a 6 year old | trips | `country=US&shape=road-trip&kid=6&q=utah` | Trips have no region facet, so Utah is kept as text (A6) |
| 16 | camper van trip in Iceland | trips | `country=IS&around=camper-van` | |
| 17 | two week trip in summer | trips | `length=9-14&season=6,7,8` | 14 nights is in 9-14 |
| 18 | long weekend in Vermont for the fall colours | trips | `length=long-weekend&country=US&season=9,10,11&q=vermont` | "fall" is autumn; "falls" is a waterfall (A4) |
| 19 | swimming beach with a lifeguard in Ontario | places | `country=CA&region=ontario&k=water.swim&f.lifeguard=yes` | |
| 20 | rainy day things to do with kids in Banff | places | `country=CA&region=alberta&area=banff&k=intent:do&f.indoor-or-rainy-day=yes&kid=yes` | |
| 21 | free things to do near Lake Louise | places | `country=CA&region=alberta&area=<area of the Lake Louise place>&k=intent:do&f.price-band=free` | "Lake Louise" is a place, not an area. "near <place>" uses that place's area (A6) |
| 22 | gondola rides in Switzerland in June | places | `country=CH&k=ride.lift&season=6` | |
| 23 | moderate hike with 500 m climb | places | `k=nature.trail&effort=moderate&f.climb=400-800` | A single figure picks the band that holds it (A10) |
| 24 | stroll near Lake Louise | places | `country=CA&region=alberta&area=<area>&k=nature.trail&effort=stroll` | "stroll" is both the effort Stroll and an alias of `nature.trail.walk`. With no other type word it gives both (A2) |
| 25 | kid friendly waterfalls in Ontario | places | `country=CA&region=ontario&k=water.falls&kid=yes` | |
| 26 | Niagara Falls | search | no chips | An exact record name wins over the parse (A1): the name hits show as they do today |
| 27 | hard hikes in Chamonix in July | places | `country=FR&region=auvergne-rhone-alpes&area=chamonix-valley&k=nature.trail&effort=hard&season=7` | "Chamonix" matches the area "Chamonix Valley" by prefix |
| 28 | dog friendly loop trail | places | `k=nature.trail&f.dogs=yes&f.shape=loop` | Both facets are hidden by the 60% rule today (3.25). The parse still applies them, and the gap rows go to "not checked yet" |
| 29 | waterfalls worth the journey in Patagonia | places | `k=water.falls` | "Patagonia" is not a tree area. Did you mean: the trip "Patagonia ..." or Argentina or Chile. "Worth the journey" is not used yet (Q35) |
| 30 | kayaking in Norway in August | places | `country=NO&k=water.paddle&season=8` | `kayaking` is an alias of `water.paddle.kayak`, which widens to its category (A3) |

## 4. The parser

### 4.1 Pipeline

```
normalize(q)                      lib/search/normalize.ts: lower case, accents folded, punctuation to spaces
  -> numbers                      "two" -> 2, "a week" -> 7 nights, "6yo" / "6-year-old" -> 6, "5k" -> 5 km
  -> phrase match                 longest first, up to 4 words, over one trie built from the vocabulary (4.3)
  -> patterns                     the rules in 4.2, on the tokens the phrase pass did not claim
  -> areas                        the remaining place-like runs against the area records of the search index (A5, A6)
  -> resolve                      target list (places or trips), scope implications (A7), ambiguity rules (section 5)
  -> ParsedQuery                  chips, URL, unused words, did-you-mean
```

The parser is pure: `parse(q, vocab, areas) -> ParsedQuery`. It has no I/O and no clock, so it is easy to test and can later run on a server unchanged.

### 4.2 Grammar

Patterns (EBNF-ish; `N` is a number, `U` a unit):

| Rule | Pattern | Writes |
|---|---|---|
| AGE | `(for\|with) (a\|an\|my)? N (year\|yr)s? old` · `N yo` · `aged? N` · `ages? N (+\|and up\|and over)` | places `kid=N`; trips `kid=` the largest of 4/6/8/10/12 that is at most N (a plan for a 6-year-old suits a 7-year-old) |
| PARTY | `kids`, `children`, `family`, `kid friendly`, `little ones` · `toddler` · `baby`, `infant` · `teen`, `teenager` | `kid=yes` · `kid=2` · `kid=0` · `kid=13` (A9) |
| ACCESS | `stroller`, `pram`, `pushchair`, `buggy` · `jogging stroller`, `all terrain stroller` · `wheelchair`, `step free`, `accessible` | `stroller=any` (trips `friendly`) · `stroller=all-terrain` · `f.step-free=yes` |
| EFFORT | `easy`, `gentle`, `flat` · `moderate` · `hard`, `challenging`, `strenuous`, `difficult`, `tough` · `technical`, `scramble`, `exposed` | places `stroll,easy` · `moderate` · `hard` · `technical`; trips `easy` · `moderate` · `strenuous` · `strenuous` |
| DIST | `(under\|less than\|below\|up to\|max\|at most) N U` · `(over\|more than\|at least) N U` · `N U` | `f.length` bands up to, from, or holding N (A10). Miles are converted at 1.609 |
| CLIMB | `N m (climb\|gain\|ascent\|elevation)` · `no climbing`, `no hills` | `f.climb` band holding N · `f.climb=lt150` |
| DURATION | `quick`, `an hour`, `N hours?` · `half (a)? day` · `full day`, `all day` | `f.time` (trails) or `f.duration` (do) with the matching band (A7) |
| TRIP LENGTH | `day trip` · `overnight` · `weekend` · `long weekend` · `N nights` · `N days` (nights = days - 1) · `a week` · `two weeks` | trips `length=` the class or band |
| MONTH | `january` ... `december`, 3-letter forms, `early`/`mid`/`late` + month, `M to M` | `season=` the month numbers |
| SEASON | `spring`, `summer`, `autumn`, `fall`, `winter`, `fall colours`, `foliage` | `season=` three months, by hemisphere (A8) |
| DRIVE | `from toronto` + `(under\|within) N (h\|hours)` | trips `drive=toronto-1..n` |
| AREA | `(in\|near\|around\|close to\|at)? <area phrase>` | `country`, `region`, `area` (A5, A6) |
| TYPE | a type label, a type alias, a plural of either | `k=` (A3) |
| FACET | a contract facet's label or value phrase: `dogs`, `dog friendly`, `loop`, `sunrise`, `sunset`, `toilets`, `lifeguard`, `rainy day`, `indoor`, `free`, `no booking`, `guided` | `f.<key>=<value>` |
| INTENT | `things to do`, `activities`, `something to do` | `k=intent:do` |
| RELEVANCE | `worth the journey`, `must see`, `bucket list`, `world class` · `worth a detour` · `hidden gem`, `local favourite`, `off the beaten path` | phase 1: an "unused" chip that says no filter exists yet (Q35) |
| FILLER | `in`, `for`, `with`, `near`, `the`, `a`, `an`, `to`, `and`, `i`, `can`, `reach`, `go`, `good`, `best`, `nice`, `place(s)`, `somewhere`, `where`, `trip` ... | nothing; never reported as unused |

Anything else goes to `q` and is listed as "Not used: <word>".

### 4.3 Vocabulary sources (a new type is a data entry)

| Words | Source | Built by |
|---|---|---|
| Type words | `data/vocab/types.json`: every node's `label`, its `aliases`, and simple plurals (`-s`, `-es`, `-ies`) | `web/scripts/search-vocab.mjs` |
| Type widening | `types.json`: a new optional node mark `search: "exact"`. Without it, a type word resolves to its category (A3) | same |
| Contract facet words | `web/lib/entities/facets/contract-slice.json` labels plus the value labels in `facets/answers.ts` (`TIME_LABELS`, `WALK_LABELS`, `SHAPE_LABELS`, `BEST_TIME_LABELS` ...), plus `core/src/capture/bandKeys.ts` | same |
| Suitability and effort words | the effort names in `bandKeys.ts` (`EFFORT_NAMES`), and the age, party and access phrases from [suitability.md](../../../research/method/suitability.md) 1.2, 1.4 and 6.2, kept in one table `web/lib/search/parse/phrases.ts` | hand-written, reviewed once |
| Relevance words | the badge names in [relevance.md](../../../research/method/relevance.md) R7 and the `hidden_gem` definition | `phrases.ts` |
| Months, seasons, numbers, units | `phrases.ts` (English) | hand-written |
| Areas | the `area` records of the search index (names, plus the area chain in `x`) and `aliases.ts`. These are the parts the search already loads; the gazetteer is not used | at query time, through `data.ts` |
| Trip names | the `trip` records of the search index | at query time |

`search-vocab.mjs` writes `web/public/search/vocab.json` (`search-vocab/1`): one array of `[phrase, target, value, flags]`. A build check (`--check`) fails when a target is not in `FACET_PARAMS` or `f.<slice key>`, when a value is not in that facet's `orderOf` list, or when one phrase maps to two targets without an ambiguity rule. So a renamed facet value cannot leave a dead word behind. A new type in `types.json` with a label and aliases is found by the next build, with no code change. The test proves this with a fixture node.

Data follow-up (CS lane or the planner, not SQ1): about 290 type nodes have no aliases yet. Add the common visitor words ("lookout", "pond", "glacier", "canyon", "zipline") as data entries, starting with the types our public places use. Remove or qualify aliases that collide with ordinary English: `tram` (cable car) and `slot` (slot canyon) (A4).

## 5. Ambiguity rules

Each rule is applied in order, and each one has a test in the fixture.

| ID | Rule |
|---|---|
| A1 | **A name beats a parse.** If the whole query, or the whole query minus filler, is the name of a trip, a place or an area (an exact match after normalising), the name hits show as they do today with no chips. "Niagara Falls" is a name, not "waterfalls in Niagara" |
| A2 | **Longest phrase first, then one meaning per word.** "short walk" claims both words before "short" alone. When a word can mean two things with no other word to settle it ("stroll" is an effort and a type), it gives both if they are compatible (type `nature.trail` plus effort `stroll`). When they conflict, the parse takes neither, and both go into "Did you mean" |
| A3 | **Type words widen to their category** (hike, trail, walk give `nature.trail`; kayaking gives `water.paddle`; gondola gives `ride.lift`). Rows are often typed only to category level, so a type id would miss them. Exceptions are marked `search: "exact"` in `types.json`, where a visitor means that thing only (hot spring, via ferrata, zip line, splash pad) |
| A4 | **Collisions are listed, not guessed.** `fall` (autumn) is not `falls` (waterfall). `fall` means autumn when it stands alone or before `colours`/`foliage`, and a waterfall word only as `falls`. Stop-list aliases that are ordinary words (`tram`, `slot`) unless they come with a type word. The build check lists every phrase with two meanings |
| A5 | **Areas resolve to the tree, and ties are offered.** A place-like run matches area records by full name, then by prefix (at least 4 letters). One hit sets `country`, `region` and `area` from its path. Several hits pick the one with the most places and offer the rest in "Did you mean" ("Banff" also gives "Banff National Park"). A physical feature with no tree path (Rocky Mountains, Niagara Falls) sets no area: it stays in `q`, and "Did you mean" offers the regions and trips whose names hold it |
| A6 | **"near X" where X is a place uses the place's area.** On trips, an area below country level sets `country` and keeps the area name in `q` (trips have no region facet). Phase 1 never invents a radius, so there is no `bbox` from a word (Q37) |
| A7 | **A scoped facet brings its scope.** `f.length`, `f.climb` and `f.time` imply `k=nature.trail` when no kind was parsed. `f.duration` implies `k=intent:do`. A duration with no kind and no trail or activity word sets nothing, and "Did you mean" offers "half-day hikes" and "half-day activities" |
| A8 | **Seasons follow the hemisphere** of the parsed country (AR, CL, NZ, AU, ZA and other southern countries flip them). With no country, the north is used, and the chip names the months ("Winter, Dec to Feb") |
| A9 | **A party word without an age.** On places, "with kids" sets `kid=yes` (the kid-fit chip, which still works). On trips it sets nothing and asks for the youngest's age. `toddler` is 2, `baby` is 0, `teen` is 13. The chip says the age it used, so the visitor can change it |
| A10 | **Numbers map to bands honestly.** "under 5 km" takes every band that can hold a value under 5 (`lt3`, `3-6`), and the chip says "Up to 6 km (nearest band)". A single figure picks the band that holds it. An exact `km=` range waits for Q36 |
| A11 | **Target list.** Trip words (`trip`, `weekend`, `nights`, `road trip`, `day trip`, `camper van`, `from toronto`) send the parse to `/trips/`. Otherwise it goes to `/places/`. When both kinds of word appear, places win and "Did you mean" offers trips |
| A12 | **Two values of one single-value key.** "kids 4 and 9" gives the youngest (`kid=4`). Two countries give neither, and both are offered |
| A13 | **Typos.** A word of 5 letters or more that is one edit from a vocabulary phrase is not applied. It is offered: "Did you mean waterfall?" Only an exact or alias match is applied without asking |
| A14 | **A place word resolves to every area that carries it, and a range word to the places of the trips that name it (REVIEW4 4.20, 4.21).** Areas of one country and depth whose names contain each other as whole words join ("Banff" with "Banff National Park"), when the shared name holds a word that names a place ("Lake" and "National Park" never join anything). The chip says what it matched ("Banff area, Alberta"). A range (`RANGES` in `phrases.ts`: Dolomites, Rockies, Alps, Patagonia) reads the area slugs of the trips whose name or region carries it, written to the trip's search record as `ar`, leaving out places more than 800 km from the trip's middle (the gateway city); the chip reads "Dolomites range (18 areas)". `region` and `country` are written only when the areas share them. A reading that gives no rows is relaxed on the list, narrowest chip first (season, age, effort, area; the kind last), and the list says "No match for all 4; showing places that match 3 · put back Kids" |

## 6. The chip UI and "Did you mean"

### 6.1 Chips

In the header search (`GlobalSearch`) and the cover search, under the input, while typing (debounced 150 ms):

```
[ easy hike with kids near Banff in September          ]
Read as:  Trails ×   Banff, Alberta ×   September ×   With kids ×   Easy or a stroll ×
Not used: "quiet"
-> Show 7 places                               (top row, Enter opens it)
   Did you mean Banff National Park?
Places   Trips   Areas                          (the name hits, as today)
```

- Each chip is a button with its own remove control (target at least 24 px; the whole chip is the hit area on phone). Removing a chip drops that constraint and keeps its words out of `q`, so the parse does not come back. The count and the link update.
- A chip opens its alternatives on click (Banff and Banff National Park; age 2 to 12; effort levels) as a non-modal popover, and the choice replaces the chip.
- "Show N places" is the first option in the listbox, and Enter opens it. The name hits stay below, so a visitor who wanted a name still gets it (A1).
- On `/places/` and `/trips/`, a parse from the list's own search box writes the keys into the URL, so the filter bar shows them as its normal active chips. A one-line note "Read 'easy hike near Banff' as 4 filters · Search the words instead" lets the visitor undo it into plain `q`.
- Chip words are the facet labels the filter bar already uses (the same `label` from the descriptor and `answers.ts`), so a chip and a pill never disagree.
- Motion: chips enter with the foundation's short fade-and-rise. Removal collapses the gap smoothly (UI motion rule). No layout jump in the listbox.

### 6.2 "Did you mean"

One line at most, with up to 3 options, each a link that applies the alternative parse:
1. an area tie (A5);
2. a conflicting word (A2) or a scope that is missing (A7);
3. a typo (A13);
4. an unresolved place-like word: trips and countries whose names hold it (A5, "Patagonia");
5. no results: the parse with its most restrictive chip removed, with a count ("Without September: 8 places"). The chip to drop is the one whose removal adds the most rows.

The present `suggest()` fallback (the single word with the most matches) stays as the last resort when the parser finds nothing.

## 7. Honesty rules

| ID | Rule |
|---|---|
| H1 | **A gap is never a yes.** A row with no answer for a parsed constraint does not appear in the main results. It appears in a separate, collapsed group below them: "Not checked yet (5): we have no stroller answer for these". The group is counted per constraint. On the list pages this is the facet's existing `gap` (`isGap`), shown as rows instead of only a count line |
| H2 | **A known no is excluded, a rule hides, and advice fades.** This follows the Kids filter as it is (Q21): a `!stroller` flag excludes the row; a rule age above the parsed age hides it; an advice age fades it |
| H3 | **Every applied constraint is visible as a chip.** Nothing is applied silently. Every word the parser did not use is listed under "Not used", except filler. A leftover word stays as a text search only when some name in the index carries it; a word that matches nothing ("friendly") never filters (REVIEW4 4.21) |
| H4 | **The parser never infers a fact from a word.** "easy" filters on our effort answer; it never makes a place easy. Words that have no filter yet (relevance) are shown as not used, not approximated by a ranking |
| H5 | **Phase 2 results are labelled as similar, never as matches.** Semantic ranking only reorders rows that already pass the parsed filters, plus an optional "Similar in meaning" group. It never moves a row past a filter, a rule or a gap (a vector that is close to "stroller" proves nothing about strollers) |
| H6 | **Bands are named.** When a number is rounded to a band, the chip says so (A10) |
| H7 | **No query leaves the device in phase 1.** In phase 2, the browser path keeps the query local. The server path sends it to our own Supabase function only, and nothing is logged with an identity |

## 8. Performance and size budgets

| Item | Budget | Notes |
|---|---|---|
| `vocab.json` | at most 12 KB gzip | loaded on the first keystroke with the manifest; cached per page view |
| Parser code | at most 8 KB gzip, in the search chunk | not in the first-load JS of any page |
| Extra requests per query, phase 1 | 0 beyond `vocab.json` and the area parts that `search` already loads | |
| Parse time | at most 2 ms p95 on a mid-range phone (4x CPU throttle in Chromium) | measured in a unit benchmark over the 30 queries |
| Keystroke to chips | at most 150 ms after the debounce | |
| Phase 2 model (browser) | at most 35 MB transferred once (gte-small q8 ONNX, about 34 MB expected; the spike measures it), never on the first keystroke | cached with the Cache API; skipped under Save-Data or a 2G/3G `effectiveType` |
| Phase 2 vector shard | 384 int8 values per place plus a 2-byte index: about 400 B a place. At most 150 KB gzip per shard; shards follow the search parts (`kind-country`) | at 10,000 places, a scoped query reads only its shards |
| Phase 2 query embedding | warm p50 at most 250 ms and p95 at most 600 ms on a mid-range phone; cold start (model load) at most 5 s; at most 60 ms warm on desktop | |
| Phase 2 memory | at most 200 MB extra heap on phone | |

**Waiver (SQ1b, 19 Oct 2026, design review).** Phase 1 shipped +1.41 KB gzip on `/` and +1.25 KB on `/places/` and `/trips/` against the 1 KB first-load limit. The owner-side review accepted it as a one-time 0.5 KB waiver (the eager glue in `FilterBar`, `EntityPage` and `EmptyState`; the parser, chips, `SmartRow` and `UncheckedRows` are separate chunks). The 1 KB limit stays for later lanes.

## 9. P8 and P9 design

### 9.1 P9: everything behind `lib/client/data.ts`

New functions, each in the shape of a future API call:

```ts
/** Reads a human query as filters. Today: vocab.json plus the area parts, in the browser. Later: GET /api/parse?q=&target= */
export async function parseQuery(q: string, opts?: { target?: 'places' | 'trips' }): Promise<ParsedQuery>;

/** Phase 2 only. Orders the ids that already passed the filters by meaning. Today: the browser model plus vector shards. Later: a Supabase Edge function. */
export async function rankByMeaning(q: string, ids: string[], scope: SearchScope): Promise<{ id: string; score: number }[]>;

/** The list answer split by honesty (H1): rows that pass, and rows that fail only on a gap of a parsed constraint. */
export function listPlacesChecked(query: ListState, parsed: ParsedKeys): ListResult<PlaceListRow> & { unchecked: { param: FacetParam; rows: PlaceListRow[] }[] };
```

```ts
interface ParsedQuery {
  target: 'places' | 'trips' | 'search';   // 'search' = a name won (A1)
  chips: { param: FacetParam; values: string[]; label: string; words: [number, number]; alternatives?: Chip[] }[];
  q: string;                                // the words not used
  unused: string[];
  didYouMean: { label: string; href: string }[];
  href: string;                             // /places/?<encodeState(...)>
  vocab: string;                            // vocab.json version, for the server step
}
```

Components never read `vocab.json`, the vectors or the model. They call these three functions. `tests/data/boundary.test.ts` gains `/search/vocab.json` and `/search/vec/` in its list of catalogue URLs.

### 9.2 P8: no bulk catalogue

- `vocab.json` carries vocabulary only: type words, facet words and months. These are our taxonomy, which is public on every filter pill. It holds no place names, slugs, facts or values.
- Areas and trip names come from the search parts that already exist; the parser adds no new list of places.
- Vectors (phase 2) are served per shard, with ids only: `/search/vec/<part>/data.bin`, a header (`model`, `revision`, `dims`, `quant`, `count`), then one row index and the int8 vector. They carry no text. The row index points into the matching search part, which is already public.
- **What gets embedded is only what a card already shows:** the name, the type label, the area chain, the tag labels and the public one-line summary. Never notes, `why` lines, suitability values, times or sources. Embedding inversion can recover rough text from a sentence vector, so we embed only text that is public anyway.
- With the server path, vectors stay in pgvector and never ship (L9). The browser files are removed once the server path is live.

## 10. Phase 2: semantic ranking spike

### 10.1 Design under test

- **One model:** `Supabase/gte-small` (384 dims, mean pooling, L2 normalised, max 512 tokens, no query prefix).
- **Build:** `web/scripts/embed.mjs` uses transformers.js in Node, with the version pinned exactly. It embeds the public card text (9.2) per place and trip, then writes the int8 shards and `data/search/model.json` (`model`, `hf revision` commit hash, `transformers.js` version, `dtype`, `pooling`, `normalize`, `dims`, and a checksum of the ONNX file).
- **Query, option A (browser):** transformers.js on WASM, and WebGPU when present, loads the same pinned files lazily. It embeds the query, reads the shards in scope and scores dot products.
- **Query, option B (server, when a backend exists):** the Supabase Edge built-in `gte-small` (`new Supabase.ai.Session('gte-small')`, `mean_pool: true, normalize: true`) plus pgvector (HNSW, cosine) on the free tier. Vectors for this path are **computed by the same Edge function** in a backfill job, never copied from the Node build, so build and query use one runtime by construction.
- **Hybrid ranking:** list A is today's full-text search over the rows that pass the parsed filters (in Postgres, `tsvector` with `websearch_to_tsquery`). List B is the vector neighbours of the query among those rows. They are fused with reciprocal rank fusion, `score(d) = sum over lists of 1 / (60 + rank_d)`. When the parse leaves no words over (`q` is empty), ranking is skipped and the list keeps its order.

### 10.2 Spike steps (a builder lane, about 1 day, Sonnet; results written to `research/reports/smart-search-spike.md`)

1. Pin the model and the library. Embed the 223 public places and trips in Node, and record the time and the shard sizes.
2. Label the 30 queries of section 3: for each one, the owner or the planner marks the relevant places among the top 30 that any method returns (pooled judging).
3. Run four methods per query: (a) the parser alone, in the list's default order; (b) the parser plus full text; (c) the parser plus vector; (d) the parser plus RRF of (b) and (c). Score nDCG@10 and recall@10.
4. In the browser on a real mid-range Android phone (the owner's, or a Pixel 6a class phone) and on desktop, measure: model bytes transferred, cold load time, warm p50 and p95 per query, and peak memory. Do it once on WASM and once on WebGPU where available.
5. Parity: embed 50 card texts in Node and in the browser, and require cosine at least 0.999. If a free Supabase project is available, embed the same 50 with the Edge built-in and record the cosine against Node (expected under 1, which is why option B re-embeds), plus warm and cold latency and CPU time per call.

### 10.3 Pass and fail thresholds

| Measure | Pass | Fail, and what happens |
|---|---|---|
| Quality gain | method (d) beats (a) by at least 0.10 nDCG@10 averaged over the queries that leave words over, and loses at most 0.02 on fully parsed queries | under 0.05: no phase 2; the parser stays alone, and we look again at 1,000 places |
| Model size (A) | at most 35 MB transferred | over 35 MB: try a smaller quantisation. If quality then fails, option A is out |
| Phone latency (A) | cold at most 5 s; warm p50 at most 250 ms, p95 at most 600 ms | over: option A runs only on desktop and Wi-Fi, behind a "Rank by meaning" control. If that is not acceptable to the owner, wait for option B |
| Memory (A) | at most 200 MB extra | over: option A is out on phones |
| Parity (A) | cosine at least 0.999 Node against browser | under: pin harder (the same ONNX file and dtype) or fail |
| Edge (B) | warm p50 at most 400 ms including the network; CPU per call well under the 2 s limit; cold start at most 1.5 s | over: B is out until a paid tier is chosen, which is not a year-one option |

The decision goes into this page as a dated section, with the numbers. If both A and B pass, the recommendation is A now (no server exists yet), and B when the backend arrives for other reasons (Q38).

## 11. Phase 3 (later; see backlog L9)

- **Photo CLIP at build.** Embed every photo once in Node to choose a hero and day thumbnails that match the place, drop near-duplicates (the repeated thumbnails in 2.41), and later search photos by words. Build time only, with nothing shipped but the choices. L9 (c).
- **"Feels like this" similar places.** Nearest neighbours from the phase 2 build vectors, filtered by suitability, written into each place page at build. Zero runtime cost, no model in the browser. L9 (b).
- **Pipeline helpers.** Duplicate-place detection, a suggested type from `types.json` and a suggested relevance class for new captures, all shown as suggestions that a researcher confirms. L9 (d).

## 12. Acceptance checks (phase 1)

1. All 30 fixture queries parse to exactly the URL in section 3 (`web/tests/search/parse.test.ts`), with chips, unused words and did-you-mean as listed.
2. A fixture `types.json` with one new node (`label: "Sea stack"`, `aliases: ["stack"]`) is found by the parser after `search-vocab.mjs` runs, with no code change.
3. `search-vocab.mjs --check` fails on a facet value that does not exist, on an unknown target, and on an unruled double meaning. It runs in `tools/check-all.sh`.
4. Removing a chip changes the URL and the count, and the chip's words do not come back on the next keystroke.
5. For queries 2, 9 and 28, rows with a gap are absent from the main results and present under "Not checked yet" with the right count. No gap row is ever in the main group (a property test over the fixture rows).
6. Query 26 shows the name hits and no chips. Query 11 shows "Not used yet: hidden gem".
7. The network panel shows one new request, `vocab.json`, on the first keystroke, and none for later queries. No request goes to a third party.
8. Budgets in section 8 are met: vocab size in a unit test; parse time in a benchmark test; the first-load JS of `/` and `/places/` unchanged within 1 KB.
9. Keyboard and screen reader: the chips row is a labelled group; each remove control says "Remove Trails"; "Show N places" is the first listbox option; Escape closes the popover; focus is visible.
10. `tsc --noEmit`, unit tests, and the e2e `smart-search.spec.ts` pass. Playwright screenshots at 1440 and 390 in light and dark: the header search with chips (query 1), with did-you-mean (query 29), and the Places list with the not-checked group (query 2). They are read in tiles before hand-back.
11. Design review (Opus, never Fable) against P1-P9, then the verifier.

## 13. Gotchas

- **Supabase free projects pause after 7 days with no activity.** The first request after a pause fails until someone restores the project in the dashboard, which takes minutes. With under 100 users a pause is likely. The browser path or the parser must always be the fallback: `rankByMeaning` falls back to the parser's order on any error or after 800 ms. Do not depend on a keep-alive ping, because it is one more thing to break.
- **Pin the model.** Pin the Hugging Face repo by commit hash (not `main`), transformers.js by exact version, and the dtype (`q8`), pooling and normalisation. A silent upgrade of any one of them changes the vectors, and old shards then rank as nonsense without an error. The shard header carries the model fingerprint, and the query side refuses a shard whose fingerprint differs from its own.
- **Build and query models must be identical.** Node transformers.js and browser transformers.js with the same files agree. The Supabase built-in gte-small is a different runtime with its own tokeniser and quantisation build, and it is not pinnable by us. So option B re-embeds the catalogue with the Edge function itself and never mixes vectors from Node.
- **CPU limits.** Supabase Edge Functions allow about 2 s of CPU per request (and 256 MB of memory) on the free tier. Embedding one short query fits; embedding the catalogue in one call does not, so the backfill runs in batches of 20 or so. On phones, WASM inference blocks the thread, so it must run in a Web Worker.
- **Cloudflare Pages caps a single file at 25 MiB.** The gte-small ONNX file is bigger, so it cannot be served from the site. Options: the Hugging Face CDN (a third-party request that carries no query text) or an R2 bucket (L5 already plans one). This is decided in the spike (Q38).
- **Aliases that are ordinary words.** `tram`, `slot` and `stroll` are both aliases and plain English. The build check lists them, and A2 and A4 decide them. Every new alias is a promise that the word means that type.
- **The 60% rule hides facets the parse may still apply** (dogs and shape on trails today, 3.25). The parse applies them anyway, and the not-checked group makes the thinness visible. That is honest, but expect a lot of "not checked yet" until CS7 batch 2 fills the data.
- **The gazetteer is not a search source.** It is 803 KB and belongs to the globe. Loading it for "near Toronto" would be a new bulk load (P9). Hub towns that are not in our tree wait for Q37.

## 14. Open questions for the owner

| ID | Question | Recommendation |
|---|---|---|
| Q34 | Use gte-small (384 dims, also built into Supabase Edge) as the one embedding model, instead of all-MiniLM-L6-v2? | Yes. It is about 10 MB bigger in the browser, but one model can serve both paths, and it scores better on retrieval benchmarks |
| Q35 | Relevance words ("worth the journey", "hidden gem") have no filter. Add the one relevance badge label to the list row (it is a chip label, inside the P8 allowlist) and a `rel=` key, once RV1 derives badges? | Yes, after RV1. Until then, the parser shows these words as not used yet |
| Q36 | Distances: keep the existing length and climb bands, with chips that name the band ("Up to 6 km"), or add exact `km=` and `gain=` range keys? | Bands in phase 1. Add range keys only if the owner finds the rounding confusing on the built site |
| Q37 | "near Toronto", where the town is not in our area tree: ignore it (as now), or ship a small build-time list of towns within 100 km of our places, with a radius `bbox`? | Ship the small list (under 10 KB gzip) in a phase 1 follow-up, with a 40 km radius named on the chip ("Within 40 km of Toronto") |
| Q38 | Phase 2 query side: the browser model (34 MB once, model hosted on Hugging Face or R2) now, or wait for a server? | Decide after the spike. If the browser passes, ship it, with the model on R2, and switch to Supabase Edge only when a backend exists for other reasons (the 7-day pause makes a search-only project fragile) |
| Q39 | Run the parser in both the header search and the Places and Trips search boxes? | Yes. On the list pages it writes the normal filter keys, with a one-line undo to plain text |
| Q40 | "with kids" with no age: set `kid=yes` on Places (the older kid-fit chip) and ask for an age on Trips? | Changed 20 Oct 2026 (REVIEW4): ask on both lists. The Youngest child pill is an age control, so "Easy with kids" never fills it; the question chip offers the ages in one click and sets nothing until one is picked. `kid=yes` still works in old links, and `DECISIONS.kidsWithoutAge.places = 'yes'` restores it |
