# Relevance: is it worth the journey, and for which kind of trip

Status: spec, 18 Oct 2026. Nothing in it is built. Written by travel-planner (Opus). Build order: **RV0** (schema, validator, derive, signals tool; section 9), the relevance pass inside the enrichment lanes **R1 to R6** (section 8), then **RV1** (adapter, ranking, the badge, "Similar nearby", globe tiers; section 9.2).

Owner direction (18 Oct 2026), summarised:
- Many hikes and trails are local to a small town or city. They suit a day trip or someone who lives there, not someone who comes from thousands of kilometres away.
- A local may rate a trail 9 out of 10. For a visitor from 2,000 km away it may not be worth it, and a place near it may be better.
- Tell these contexts apart: what matters for a day trip, and what matters for a vacation.
- Design the properties and tags behind the scenes, and how the site shows the right places at the right time.
- This covers everything: hikes, trails, adventures, sights.

This page **sits beside** [suitability.md](suitability.md) and does not change it. Suitability answers "can this party do it?". Relevance answers "is it worth coming for, from where, and in what kind of trip?". They share the value wrapper (`Val`), the refs (suitability 5.2), the sources table and the provenance rules (suitability 3). They do not share a record (decision R1).

It **amends** four pages. Each owner applies the change when its lane is briefed:
- [features/short-trips.md](../features/short-trips.md) 4.1: `hubs.json` gains one hub per trip region (section 6.6, owner Q3). The "within N h" filter is the day lens of section 6.1.
- The L3b row in [TODO.md](../TODO.md): "activities rolled up from the trip's places" counts only anchors and highlights (section 6.3), so one filler lake no longer tags a trip "lakes".
- [design/globe/spec.md](../design/globe/spec.md) 6.5: pins appear by draw tier and zoom, and a merged disc takes the label of its highest-draw member (section 6.4).
- [lanes/hidden-gems.md](lanes/hidden-gems.md): a `hidden_gem` is now defined by data. It is `standing: top` with a `local` or `regional` draw, plus the lane's own legality and crowd-risk fields. The tag becomes derived (section 3.4).

## Key decisions

| # | Decision | Why | Trade-off |
|---|---|---|---|
| R1 | **A separate sidecar, `relevance/1`, in `data/relevance/<trip-slug>/<lane>.json`**, keyed by the same refs as suitability | It is a different question with different evidence: designations, fame and our judgement against operator rules. Its freshness differs (3 years against 365 days for limits), and so do its consumers (ranking against gating). S0b changes the suitability schema now, and a combined record would make every relevance change a suitability migration | One more join in the adapter. The lanes write two files per trip in the same pass |
| R2 | **Four draw tiers, judged by us: `local`, `regional`, `national`, `world`.** "How far do people travel for this?" Each tier is defined by visitor behaviour, not by a score (section 1.2) | This is the owner's question in one field. A judgement with a note can be reviewed; a weighted score of fame proxies cannot, and fame proxies are biased (section 2.3) | Judgement varies between researchers. A computed `draw_suggested` and the warning `W_REL_DRAW_GAP` catch large gaps |
| R3 | **Draw and standing are separate axes.** `draw` is how far people come. `standing` is how good it is among its own kind nearby (`top`, `good`, `ordinary`) | The owner's "9 out of 10 to a local" is standing. "Not worth 2,000 km" is draw. Rattlesnake Point is `top` among clifftop lookouts near Toronto and `regional` in draw. Both facts are true and both are needed | Two fields to judge instead of one |
| R4 | **Context fit, role and the badge are derived, never typed.** They come from draw, standing, distinction, access cost, detour and duration (section 3). A person may override with a reason, as with family effort | One rule set for 10,000 places (P1). A reviewer can see why a place is an anchor | The rules need calibration on real data (section 9.1 step 6) |
| R5 | **The visitor chooses the lens. We never guess where they live.** The vacation lens is the default when browsing. The day lens turns on with the short-trips drive pill ("From Toronto: 1-2 h"). No geolocation, no personalisation | Personalisation is "not adopted" in principles.md. The drive pill already exists in short-trips 3.3, so P4's limit of four primary filters holds | A visitor from Ottawa must pick Ottawa in the pill. That is one tap, and it is honest |
| R6 | **No ratings, review counts, "popular" ranks or popular times from AllTrails, Google, Tripadvisor or Komoot, ever.** They may appear only as links in the link checklist. Fame signals come from Wikidata (CC0) and Wikimedia pageviews, designations from the land manager or UNESCO, and visitor counts only from official statistics | Their terms; suitability K10 and E_SUIT_LINK_ONLY_SRC; principle P8 (our catalogue is our own work) | Fewer signals for small places. That is acceptable, because small places are where our judgement matters most |
| R7 | **One relevance chip at most per card or entry** ("Worth the journey", "Worth a detour", "Local favourite"). It is never negative. A local place facing a far-away visitor gets a pointer, not a put-down: "Coming from far? Nearby, Moraine Lake is the one people travel for" | P6: the right metadata at the right moment. A "not worth it" chip insults the locals, who are our day-trip audience | The pointer needs a substitute with a higher draw within 50 km. Where none exists, nothing is shown |
| R8 | **Relevance ranks and suitability gates.** Suitability's filters hide or dim. Relevance orders what is left. An anchor the party cannot do stays visible, dimmed with its reason and with the easy way to see it, if one exists (section 7) | Hiding Moraine Lake from a family because Sentinel Pass is hard would be wrong. The Rockpile view is 0.7 km | The ordering needs a tie rule between "fits" and "worth it" (7.2) |

## 1. Prior art: what others measure

Read on 18 Oct 2026, through search results unless "opened" is written. Five dimensions run through all of them:
- **uniqueness**: is there anything like it?
- **fame**: is it known?
- **quality**: is it good?
- **crowd draw**: do people actually go?
- **substitutability**: are there five like it nearby?

### 1.1 Benchmarks

| System | What it expresses | Dimensions measured | What we take | Source |
|---|---|---|---|---|
| **Michelin Green Guide** (sights) | Three stars: * "intéressant" (interesting), ** "mérite le détour" (worth a detour), *** "vaut le voyage" (worth the journey). One account names nine criteria for a city, including first impression, the quality of the visit, reputation, beauty, heritage and the welcome | quality, fame, uniqueness. **The scale is about travel distance**, which is our question exactly | Our badge wording mirrors the idea, not the stars: "Worth a detour", "Worth the journey". We do not use stars, to avoid any confusion with Michelin | Gaspé tour, "Vaut le voyage", three stars: https://www.communitystories.ca/v2/tour-de-la-gaspesie-90ans-decouverte_90years-discovery/?p=218 ; Oudenaarde, criteria (secondary): https://oudenaarde.be/en/tourism/news/oudenaarde-awarded-3-stars ; Michelin's own current criteria page was not found |
| **Michelin Red Guide** (restaurants) | One star "worth a stop" (high-quality cooking), two "worth a detour", three "vaut le voyage", exceptional cuisine worth a special journey. Inspectors are anonymous | quality, framed as the cost of travel | The three-step ladder from "stop" to "journey" maps onto our roles: filler, highlight, anchor | https://en.wikipedia.org/wiki/Michelin_Guide ; https://www.chowhound.com/1500680/how-restaurants-earn-michelin-stars-what-each-star-means |
| **Lonely Planet** "Top experiences" and the Ultimate Travel List | The guidebooks open with a curated set of top experiences. The 2020 Ultimate Travel List built a longlist from the guidebook archive, a community vote on the top 20, and extra points for sustainable tourism management. The 2015 Best in Travel criteria were "topicality, unique experiences and 'wow' factor" | editorial quality, uniqueness, fame (the vote). No published scoring rubric | An **editorial mention** is a signal we may record as a fact with a link, never with copied text. "Best in region" is our `standing` | https://www.lonelyplanet.com/articles/ultimate-travel-list-release-2020 ; https://www.malaymail.com/news/travel/2014/10/21/lonely-planets-top-destinations-in-2015/767331 ; https://mitpressbookstore.mit.edu/book/9781787015784 |
| **Google: popular times and Local Guides** | Popular times come from aggregated, anonymised Location History, shown relative to the place's busiest hour, and only where there are enough visits. Local Guides earn points: 10 for a review, 1 for a rating, 5 for a photo, levels 1 to 10 | **crowd draw** (by hour, relative to the place itself, so it cannot compare two places), and contributor volume, which is not quality | Nothing stored (R6). The lesson: a crowd measure is about timing, not worth. Ours is "best time" in the timing lane, not relevance | https://support.google.com/business/answer/6263531?hl=en ; https://blog.google/products/maps/maps101-popular-times-and-live-busyness-information/ ; https://support.google.com/maps/answer/6225851?hl=en |
| **AllTrails**: popularity, "Year on the Trails", busiest trails | The yearly best-of categories rest on members' average star ratings over the past year. A separate busiest-trails list and the Community Heatmaps rest on traffic. The "most popular" sort formula is not published. **No AllTrails "Trail of the Year" award was found**; the closest are the yearly category lists | crowd draw (traffic) and community quality (stars), both of them local-biased: a city trail logged daily by residents ranks high | Nothing stored (R6). The lesson that shapes R3: **popularity among residents is not draw**. A town loop with a thousand reviews can be local in draw | https://www.alltrails.com/press/alltrails-unveils-2023-year-on-the-trails-revealing-top-global-hiking-data-from-the-year ; https://www.islands.com/1927353/busiest-trails-america-alltrails-easier-avoid/ |
| **Atlas Obscura** | A community adds "wondrous, awe-inspiring and strange" places. Editors shape the copy and check that each place is real. Nearly 2,000 entries were added in 2024 | **uniqueness** above everything; quality and fame are secondary | `distinction: unique` and `unique_because`. A place that is strange but small can be one of a kind (unique) and still `regional` in draw | https://www.bostonmagazine.com/?p=2149359 ; https://atlasobscura.com/articles/favorite-new-places-2024 |
| **Canadian Signature Experiences** (Destination Canada) | A collection of purchasable "once in a lifetime" experiences found only in Canada. The operator must be export-ready and market internationally. The programme excludes self-guided routes and trails. It grew from 48 to 183 members after 2011 | uniqueness plus **market readiness**, not quality alone | A designation of type `signature_experience`, valid only for operator products (offers), never for a trail. **This is a Destination Canada programme, not Parks Canada**: no Parks Canada "signature experiences" list was found | https://destinationcanada.com/sites/default/files/archive/265-Canadian%20Signature%20Experiences%20Application%20Guide/CSE_Application_Guide_Jan2019_EN.pdf ; https://travelnunavut.ca/wp-content/uploads/2024/06/july2015_update_cse_program_criteria_and_pre-qualifying_quiz_en.pdf ; https://industry.tourismsaskatchewan.com/en/business-recognition-programs/the-canadian-signature-experiences-collection |
| **NPS** | No formal "signature experience" label was found. Its signals are **recreation visits** by park, published yearly in the IRMA statistics (2025: about 323 million in total; Zion about 5 million), and park pages naming headline areas ("one of the most popular areas in Zion" for the Narrows; opened) | crowd draw at **park** level, plus the land manager's own emphasis | `visitor_volume` at park scope, and an "official highlight" designation when the land manager's page names the place as a headline | https://www.nps.gov/subjects/socialscience/highlights.htm ; https://www.nationalparkstraveler.org/2026/03/nps-recorded-more-323-million-recreation-visits-2025-slight-decrease-2024 ; https://www.nps.gov/zion/planyourvisit/thenarrows.htm (opened) |
| **UNESCO World Heritage, national-park status** | Inscription for outstanding universal value: the Canadian Rocky Mountain Parks (1984, criteria vii and viii); the Dolomites (criteria vii and viii, as in the nomination document). Studies of whether inscription raises visits are mixed: positive for foreign visitors in Italian provinces, insignificant in Chinese fixed-effects models | uniqueness and fame **of an area**, not of each place in it | A designation, `scope: own` or `scope: parent`. **Inherited status is weak evidence**: the Fenland Loop is inside a World Heritage site and is still a town walk | https://en.wikipedia.org/wiki/Canadian_Rocky_Mountain_Parks_World_Heritage_Site ; https://parks.canada.ca/culture/spm-whs/sites-canada/sec02h ; https://whc.unesco.org/document/164276 ; https://pmc.ncbi.nlm.nih.gov/articles/PMC7127821/ (whc.unesco.org list pages returned 403 to our fetch) |
| **Komoot Highlights** | Community-made "Highlights" (a point or a segment) with tips and photos. Recommended tours weight popular routes and Highlights, way and surface types, and imagery, from the user's location | community quality and crowd draw, **anchored to the user's location**, which is a day-trip lens by design | Nothing stored (R6). It confirms the day lens: rank by quality near an origin | https://support.komoot.com/hc/articles/10364710659994 ; https://newsroom.komoot.com/193187-komoot-unlocks-tour-search-in-the-uk-bringing-inspiration-and-hundreds-of-thousands-of-routes-to-its-community-s-fingertips/ |
| **Wikidata sitelinks and Wikipedia pageviews** (open signals) | The number of Wikipedia language editions with an article, and the yearly page views. The Freiburg Wikidata notes call sitelinks "a decent popularity indicator". Eurostat ranks UNESCO sites by page views. An OSM list post warns that small, internationally known villages score high | **fame**, cheaply and reproducibly. Not quality and not crowds | `signals.fame` is derived by our tool (CC0 data), with the measured biases in 2.3 | https://ad-wiki.informatik.uni-freiburg.de/research/HowTos/WikidataCheatSheet?action=raw ; https://ec.europa.eu/eurostat/web/experimental-statistics/world-heritage-sites ; https://lists.openstreetmap.org/pipermail/talk/2014-July/070171.html ; Wikimedia REST pageviews: https://wikimedia.org/api/rest_v1/?doc |

### 1.2 What the benchmarks teach

1. **Only Michelin asks our question directly**, "how far should you travel for this?", and it answers with a judgement. It does not use a formula. So `draw` is a judgement (R2).
2. **Popularity among locals is not draw.** AllTrails and Komoot measure use, and use is dominated by residents. That is why a 9-out-of-10 town trail looks like a destination.
3. **Designations describe areas.** A national park or a UNESCO listing lifts the area. It says little about which of its 60 trails a visitor should spend a day on.
4. **No benchmark models substitutes**, apart from the implicit "best in region" of a guidebook's top list. A substitute-aware pointer ("similar, closer, easier, or the one people travel for") is our edge, and our catalogue plus OSM can derive it.
5. **Crowd data is about timing.** It belongs in the timing lane ("be there before 08:00"), not in worth.

## 2. The model

### 2.1 The record

```ts
// core/src/schema/relevance.ts (RV0). Val, Basis and State are imported from ./suitability.ts.
type RelBasis = Basis | 'editorial';     // editorial = a published guide or a tourism board's own editorial list

type DrawTier    = 'local' | 'regional' | 'national' | 'world';
type Standing    = 'top' | 'good' | 'ordinary';
type Distinction = 'unique' | 'rare' | 'common';
type Weather     = 'indoor' | 'any_weather' | 'better_clear' | 'clear_only';
type EasyPayoff  = 'full' | 'most' | 'part' | 'none';
type AccessCost  =
  | 'permit_lottery' | 'timed_entry' | 'day_permit' | 'daily_cap' | 'shuttle_only'
  | 'toll_reservation' | 'lift_only' | 'boat_or_ferry' | 'high_clearance_4wd'
  | 'long_walk_in' | 'seasonal_road';

interface RelevanceRecord {
  ref: string;                                   // suitability 5.2 ref forms
  kind: string; subkind?: string;
  wikidata: Val<string>;                         // the QID, confirmed by a person; never matched by name at derive time
  class_key: string;                             // data/vocab/relevance-classes.json, e.g. 'lake/glacial-turquoise'

  // judged (hand-captured)
  draw: Val<DrawTier>;                           // note must name at least one signal (E_REL_DRAW_NOTE)
  draw_peak?: Val<{ tier: DrawTier; from: 'MM-DD'; to: 'MM-DD'; why: string }>;
  standing: Val<Standing>;
  standing_scope: string;                        // an area id, or "within 1 h of <hub or town>"
  distinction: Val<Distinction>;
  unique_because?: string;                       // our words, up to 120 characters
  easy_payoff: Val<EasyPayoff>;                  // how much of the payoff the easiest way gets
  easy_way?: string;                             // a ref: the shorter walk or the viewpoint that gets it
  weather: Val<Weather>;
  why: string;                                   // our one line, up to 120 characters: why go
  access_cost: Val<{ type: AccessCost; note?: string; book_ahead_days?: number }[]>;
                                                 // only items not already held as bookings or suitability access_season

  // evidence (hand-captured, sourced)
  signals: {
    designations: Val<Designation[]>;
    editorial: Val<Mention[]>;                   // at most 3; facts and links only, never copied text
    volume?: Val<{ count: number; unit: 'visits_per_year' | 'cap_per_day'; scope: 'place' | 'park'; year: number }>;
  };

  override?: { field: 'role' | 'fit'; value: string; reason: string; by: string; on: string };
}

interface Designation {
  type: 'unesco_whs' | 'national_park' | 'provincial_or_state_park' | 'conservation_area'
      | 'natural_monument' | 'heritage_listed' | 'dark_sky' | 'ramsar'
      | 'official_highlight'                     // the land manager names it as a headline on its own page
      | 'signature_experience';                  // Destination Canada CSE; offers only
  name: string; id?: string;                     // e.g. UNESCO 304
  scope: 'own' | 'parent';                       // parent = inherited from the containing area (weak, 3.1)
}

interface Mention { publisher: string; title: string; year: number; list: 'top_list' | 'listed' }
```

### 2.2 Field definitions (the judged fields)

**`draw`: how far people travel for this.** It is judged against these behaviours. Judge the place as a visitor in its best season would. `draw_peak` holds a seasonal lift.

| Tier | Who comes | Test | Evidence that usually goes with it |
|---|---|---|---|
| `local` | people from within about an hour; a resident's outing | nobody would plan a trip to the region for it, and visitors go only if it is next to where they sleep | no own designation; no editorial mention beyond a town page; usually no Wikipedia article |
| `regional` | day-trippers and weekenders from 1 to 4 hours away; the province or state and the next-door cities | it can justify a day trip or a weekend from the nearest big city. A far-away visitor adds it only when staying in the area | a provincial, state or conservation-authority park; the regional tourism board's list; a few Wikipedia languages |
| `national` | visitors from across the country, by plane or a long day's drive. International visitors who are already in the country add it | it can be the reason to choose this region for a holiday | a national park's headline feature; a national guide's top list; 10 or more Wikipedia languages |
| `world` | international visitors plan a trip around it | it is one of the few images that stand for the country, and it appears on global "best of" lists | UNESCO (own), a global top list; 25 or more Wikipedia languages, or very high page views |

**`standing`: how good it is among its own kind in its scope.** `top` means locals would send a visitor here first for this kind of thing. `good` means worth doing, but similar options exist. `ordinary` means pleasant and interchangeable. `standing_scope` says where the comparison is made, for example "Banff and Lake Louise", or "within 1 h of Toronto".

**`distinction`: is there anything like it?** `unique` means nothing comparable within about 500 km, or in the country. `rare` means a few comparable places exist in the country, or one or two within 100 km. `common` means several comparable places lie within 100 km. The derived substitutes (3.2) check this. `W_REL_DISTINCTION` warns when `unique` has a same-class catalogue substitute within 100 km.

**`class_key`: the substitution class**, from a small vocabulary (`data/vocab/relevance-classes.json`, about 40 entries at the start). A class is "what a visitor would accept instead": `lake/glacial-turquoise`, `lake/small-mirror`, `canyon/slot-wade`, `gorge/river-limestone`, `viewpoint/escarpment`, `drive/mountain-pass`, `trail/forest-loop`, `trail/alpine-loop`, `waterfall/roadside`, `town/historic-village`, `lift/panorama`, `water/tubing`. The kind (`lake`) is too broad and the place itself too narrow, so a class sits between them.

**`easy_payoff`: how much of the reason to go you get the easy way.** `full`: the easiest access gets the view or experience in full (the Moraine Lake Rockpile). `most`: a short walk gets most of it. `part`: the easy way gets a taste (the Riverside Walk before the Narrows). `none`: there is no payoff without the full effort (Sentinel Pass). `easy_way` names the ref that gets it. This is the bridge to suitability (section 7).

**`weather`: does it still work in bad weather?** `indoor`: a museum or a cave. `any_weather`: a waterfall, a forest walk, a town. `better_clear`: still worth it in cloud. `clear_only`: the payoff disappears in cloud or wind (a mirror lake at sunset, a summit panorama). It feeds the rainy-day role and Plan B.

**`access_cost`: what it costs to get in, beyond driving.** These are entries such as `permit_lottery` (Angels Landing), `timed_entry`, `day_permit` (the Algonquin day permit, released 5 days ahead at 07:00 ET; Ontario Parks FAQ, via short-trips K8), `daily_cap` (Kanarra Falls), `shuttle_only` (Moraine Lake), and `toll_reservation` (the Tre Cime road at pass.auronzo.info). When a booking rule already exists (`core/src/bookings`) or a suitability `access_season.via` already says it, the derive step reads that and the lane does not repeat it.

### 2.3 Signals and their biases (measured 18 Oct 2026 with the Wikidata API and the Wikimedia pageviews API)

| Place (QID) | Wikipedia languages | English page views, Oct 2025 to Sep 2026 | What it shows |
|---|---|---|---|
| Moraine Lake (Q1072342) | 37 | 46,183 | world, as expected |
| Lake Louise, the lake (Q1367398) | 30 | 49,654 (Lake_Louise_(Alberta)) | world |
| Tre Cime di Lavaredo (Q1257207) | 28 | 66,587; Italian 75,012; German "Drei Zinnen" 107,648 | **language bias**: most views are in German. Take the maximum across English and the local languages |
| Peyto Lake (Q1362681) | 27 | not read | world candidate. It is also a free, roadside substitute for Moraine Lake (3.2) |
| Algonquin Provincial Park (Q1543478) | 25 | 42,382 | a park scores as an area. Its trails have no items of their own |
| Lago di Braies (Q445369) | 18 | not read | national by signals |
| Lago di Landro (Q691103) | 10 | not read | **over-scores**: a roadside lake with a famous view of Monte Cristallo. Our judgement is regional |
| The Narrows (Q3029053) | 7 | 15,582 | **under-scores**: a sub-feature of Zion (50 languages). The NPS calls it one of the park's most popular areas. Our judgement is world |
| Elora Gorge (Q5367207) | 5 | 8,590 | regional, as expected |
| Rattlesnake Point (Q14875399) | 4 | 4,803 (Rattlesnake_Point_(Canada)) | regional |
| Smugglers' Notch State Park (Q7546619) | 1 | 3,062 for the "Smugglers'_Notch" article (not checked whether that title is the pass or a redirect) | **wrong item risk**: the search returns the ski resort (Q7546617) first |
| Lago di Limides (Q55978735) | 1 | not read | local |
| Kanarra Creek Canyon (Q123862055) | 0 | no article | local by signals; regional by judgement |
| Fenland Loop | no item | no article | local |

**Gotchas found while measuring.** A name search for "Moraine Lake" returns a lake in California first (Q124471170). "Lake Louise" returns the hamlet (15 languages) before the lake (30). So **derive never searches by name**. It uses only the `wikidata` QID that a person confirmed (`W_REL_NO_QID` until then). Sub-features under-score and roadside photo stops over-score. That is why signals only suggest the tier and the judgement decides it.

## 3. Derivation rules (`core/src/relevance/derive.ts`, never typed: `E_REL_TYPED_DERIVED`)

### 3.1 `draw_suggested`

1. The **fame tier** comes from the higher of two signals. Languages: 25 or more gives `world`, 10 to 24 `national`, 2 to 9 `regional`, under 2 `local`. Views, the 12-month maximum over the English and local-language editions: 40,000 or more gives `world`, 10,000 or more `national`, 2,000 or more `regional`. **Calibrated 18 Oct 2026 (version 2) on the 209 lane records (9.1 step 6):** the only threshold change is the regional language floor, 3 to 2. For a **settlement** (`class_key` head `town`) the language count is ignored and only views count: a town's Wikipedia languages measure the municipality and its bot-made stubs, not the pull (Santa Cristina, 49 languages, 5,965 views, judged `local`; Bolzano 108 languages). Result: 89% within one tier (186 of 209), 92 exact, none three apart. The remaining two-tier gaps are sub-features of a protected parent (rule 3 forbids lifting them) and a few towns with high views; they get `W_REL_DRAW_GAP` unless the `draw.note` explains. Raising `world` or `national` to fit the towns was rejected: it breaks Moraine (37 languages), Peyto (27), Landro (10, the kept-down over-score) and the Narrows (15,582 views).
2. **Own designations raise the floor.** `unesco_whs` with scope `own` gives at least `national`. `national_park` (own) gives `national`. `official_highlight` gives at least `regional`, or `national` when the parent area is `world`. That rule is what catches the Narrows.
3. **Parent designations never raise the tier.** They are shown as context ("in Banff National Park") and nothing more.
4. A `top_list` editorial mention by a national or global publisher raises the floor to `national`.
5. `W_REL_DRAW_GAP` warns when `draw` and `draw_suggested` differ by 2 or more tiers and the `draw.note` does not explain why.

`effective_draw` is `draw_peak.tier` when the list's season, or the trip's season window, overlaps the peak months. Otherwise it is `draw`.

### 3.2 Substitutes and "similar nearby"

- **`substitutes`** are catalogue places with the same `class_key` within 25 km (`near`) and within 100 km (`area`). Each carries `{ref, km, draw, standing, access_cost, family_effort}`, with distances as straight lines on our points. The list is sorted by draw, then standing, then distance.
- **`similar_osm_25km`** counts the same class in OpenStreetMap within 25 km, for the classes that have a clean tag mapping: waterfalls (`waterway=waterfall`), viewpoints (`tourism=viewpoint`), peaks (`natural=peak`), lakes (`natural=water` with `water=lake`, over 1 ha) and caves (`natural=cave_entrance`). The tool runs Overpass queries sequentially and caches them. The count is ODbL-derived and credited. It is used to check `distinction` and is shown only on the detail level ("one of about 30 mapped lakes within 25 km").
- **`far_pointer`**: for a place with `effective_draw` of `local` or `regional`, this is the nearest place within 50 km with a draw at least two tiers higher. A same-class place is preferred, then any class. It drives "Coming from far? Nearby, X is the one people travel for." It is empty when nothing qualifies.
- **Similar nearby is attribute-aware (owner, 18 Oct).** A same-class substitute is shown only when it is comparable for the visitor: its family effort is within one level, its on-site time is within about half to double, and it shares at least one feature tag where the class has them (glacier view, swim, lift-assisted). Substitutes that fit the party come first. Class alone is too broad: two `trail/alpine-loop` records can be a 6 km stroll and a 20 km day.
- **`pair_with`: "Nearby, worth adding" (owner, 18 Oct).** This is a different question from substitutes. "Similar nearby" answers *instead of*; `pair_with` answers *as well as*. Example: at Lake Louise, add the short Fairview Lookout or the Lake Agnes tea house walk. It is derived from data the lanes already hold, plus distance from the points file:
  - **close:** walkable (about 2 km on our points) or at most about 15 min drive from the place
  - **short:** on-site time at most about 2 h (suitability `on_site_min`, adult or child time, or an estimate from distance and gain, marked as an estimate)
  - **good:** standing `top` or `good` within its own kind
  - **a different class** from the place, so a lake pairs with a trail, a viewpoint with a cafe, a waterfall with a picnic spot
  - **fits the party** when a profile is set (suitability gates first)
  - **sorted** by the extra time it costs, then standing, then distance; at most 3 shown
  - **hand-picked pairs:** a lane may record `pairs_with: [{ref, reason, src?}]` on a record when a classic combination is known ("people walk on to the Lake Agnes tea house"). A hand-picked pair always qualifies, ranks first, and shows its reason
  - **never a filter**, and it adds no primary control (P4)
  - **consumers:** the place page section "Nearby, worth adding" (up to 3), and the trip timeline's "Add to this day" suggestions, where the scheduler checks that each fits before the home-by or sunset time (trip-timeline.md)
- **`plan_b`**: for an anchor with an `access_cost` that can fail (lottery, timed entry, daily cap, shuttle), this is the best same-class substitute with no such cost. For Moraine Lake it is Peyto Lake: roadside, booking "No" in the plan data, 50 km straight line.

### 3.3 Effort to reach

- **`detour_min`**: for an item on a trip, the minutes from that day's base and back, minus the minutes the day drives anyway. It comes from L3c's stored ORS legs when present. Otherwise it is straight line × 1.42 at 70 km/h, marked ≈. For a catalogue place with no trip, it is measured from the nearest catalogue town that has a stay.
- **`from_hubs`**: the one-way minutes from each public hub, from `data/outings/from-hubs.json` (short-trips 4.1), extended to every place in scope rather than only short-trip stops.
- **`access_load`**: `easy` (no booking), `plan` (a booking or day permit that opens 1 to 30 days ahead), or `hard` (a lottery, a cap that sells out a month ahead, high clearance, a ferry with limited sailings). It is the worst of `access_cost`, the booking rules and suitability's `access_season.via`.

### 3.4 Context fit (four contexts)

Each fit is `plan_around`, `worth_it`, `if_nearby` or `skip`, with a reason string. `ED` is `effective_draw`, ordered `local` < `regional` < `national` < `world`.

| Context | `plan_around` | `worth_it` | `if_nearby` | `skip` |
|---|---|---|---|---|
| **vacation**: a visitor is staying in the region for several days | ED `world`; or ED `national` with standing `top` and distinction `unique` or `rare` | ED `national` (including `national`, `top`, `common`, which caps here); or ED `regional` with standing `top` and distinction not `common` | ED `regional`; or ED `local` with standing `top` or `good` and `detour_min` ≤ 20 | ED `local` with standing `ordinary`, or with `detour_min` over 20 |
| **weekend**: 1 to 3 nights from a hub, judged per **area** | the area holds 2 or more places with ED ≥ `regional` and standing `top` within 30 min of one another, and the nearest hub is 1.5 to 4 h away | ED ≥ `regional` and a hub 1.5 to 4 h away | ED `local`, standing `top`, and a hub 1.5 to 4 h away | the rest. Under 1.5 h from a hub is a day trip, not a weekend |
| **day trip from hub H** (one per hub in `from_hubs`) | ED ≥ `regional` with standing `top`, and H ≤ 3 h one way, and on-site time plus twice the drive ≤ 12 h | standing `top` or `good`, and H ≤ 2 h | standing `good` and H ≤ 1 h; or standing `ordinary` and H ≤ 45 min | standing `ordinary` and H over 45 min; or H over 3 h; the rest |
| **passing through**: a stop on a road trip leg | `detour_min` ≤ 30, ED ≥ `national`, on-site ≤ 120 min, `access_load` `easy` | `detour_min` ≤ 20, ED ≥ `regional`, on-site ≤ 90 min, `access_load` `easy` | `detour_min` ≤ 10, on-site ≤ 45 min | any booking needed, or a detour over 30 min |

A fit drops one step when `access_load` is `hard`, except for `plan_around` in the vacation context, because anchors are worth the booking. A fit drops one step when `weather` is `clear_only`, and the place gains the "needs clear weather" chip from the timing lane. **Exception (CF):** in the vacation context, a place with ED `world` and standing `top` does not drop. It stays `plan_around` and gains the `go_clear_day` flag (3.5), so the planner books the day for the weather. The step-down still applies to every other draw, national included, and to the weekend, day-trip and passing contexts.

**Anchor test (CF).** An anchor needs distinction `unique` or `rare`, or a `world` draw. A `national` draw with standing `top` and distinction `common` caps at `worth_it`, so its role is `highlight` (Sunset Point).

### 3.5 Role in a trip (vacation context) and flags

| Role | Rule | Meaning for a planner |
|---|---|---|
| `anchor` | vacation fit `plan_around` | a trip is planned around it; book it first |
| `highlight` | vacation fit `worth_it` | the main thing on a base day |
| `filler` | vacation fit `if_nearby` | a short add-on, or a rest-day option |
| `local_only` | vacation fit `skip` | shown under the day lens. Under the vacation lens it is collapsed into "Local outings" |

**One anchor per place (CF).** A place record and an activity record at that place (a lake and its cruise) are never both anchors. Two records share a place when one names the other in `same_place_as` (a ref, validated like `ref`), or when both carry the same confirmed `wikidata` QID. When a place record in such a group is an anchor, each `activity` record in the group that would be an anchor becomes a `highlight` (vacation fit `worth_it`, with the place named in the reason, no Plan B). The place keeps the anchor. A role `override` on the activity wins. The `activity` and `lift` kinds step down (`ACTIVITY_KINDS` in `derive.ts`), so a gondola or cable car yields the anchor to the summit or viewpoint it serves.

Flags, which are independent of role: `go_clear_day` (role `anchor`, weather `clear_only`, ED `world`, standing `top`: worth the journey on a clear day, so plan the day around the forecast), `rainy_day` (weather `indoor` or `any_weather`, and role `filler` or above), `en_route` (passing-through fit `worth_it` or better), `hidden_gem` (standing `top`, ED `local` or `regional`, and the hidden-gems lane's `access_legal: public`).

### 3.6 The badge (one chip)

| Badge | Shown when | Lens |
|---|---|---|
| **Worth the journey** | role `anchor` | always |
| **Worth a detour** | role `highlight` | vacation lens, trip pages of 4 or more nights, place pages |
| **Local favourite** | standing `top` and ED `local` or `regional` | day lens, short-trip pages, place pages |

Precedence: journey, then detour, then local favourite. Only one is ever shown. Each badge opens its provenance one step away (P6): the judgement note, its designations, its mentions and the fame signals. For example: "Our judgement: one of the most photographed lakes in the Rockies; Wikipedia in 37 languages; inside a UNESCO site (inherited)".

## 4. Storage

```text
data/relevance/
  README.md                          the format, refs, classes, examples (RV0)
  <trip-slug>/<lane>.json            hand-captured, relevance/1, one file per lane (R1-R6)
  signals/wikidata.json              derived: QID, sitelinks, designations from P1435, P757 and P814, read date (CC0)
  signals/pageviews.json             derived: 12-month views per project and title, read date
  signals/osm-similar.json           derived: per place, class counts within 25 km (ODbL, credited)
  derived/<trip-slug>.json           generated by `relevance.ts derive`; committed so a review sees the diff; `--check` fails on drift
data/vocab/relevance-classes.json    the class vocabulary
```

An abridged example (R2a, Rockies):

```jsonc
{
  "schema": "relevance/1", "trip": "canadian-rockies-2029", "lane": "R2a", "researched": "2026-10-20",
  "sources": [
    { "id": "src-0001", "url": "https://parks.canada.ca/pn-np/ab/banff/visit/parkbus/louise", "title": "Lake Louise and Moraine Lake shuttles",
      "publisher": "Parks Canada", "kind": "official", "read": "2026-10-20" },
    { "id": "src-0002", "url": "https://parks.canada.ca/culture/spm-whs/sites-canada/sec02h", "title": "Canadian Rocky Mountain Parks",
      "publisher": "Parks Canada", "kind": "official", "read": "2026-10-20" }
  ],
  "records": [
    {
      "ref": "legacy/canadian-rockies-sept-2029/sights/moraine-lake", "kind": "lake",
      "wikidata": { "v": "Q1072342", "state": "value", "basis": "our_inference", "src": [], "note": "checked: lake in Alberta, not Q124471170 (California)" },
      "class_key": "lake/glacial-turquoise",
      "draw": { "v": "world", "state": "value", "basis": "our_inference", "src": ["src-0002"],
        "note": "37 Wikipedia languages; inside the Canadian Rocky Mountain Parks WHS (inherited); shuttle-only access still sells out" },
      "standing": { "v": "top", "state": "value", "basis": "our_inference", "src": [] }, "standing_scope": "Banff and Lake Louise",
      "distinction": { "v": "rare", "state": "value", "basis": "our_inference", "src": [], "note": "Lake Louise 11 km, Peyto 50 km: same class" },
      "easy_payoff": { "v": "full", "state": "value", "basis": "our_inference", "src": [], "note": "Rockpile loop 0.7 km gives the classic view" },
      "easy_way": "legacy/canadian-rockies-sept-2029/trails/moraine-lakeshore",
      "weather": { "v": "better_clear", "state": "value", "basis": "our_inference", "src": [] },
      "why": "The Valley of the Ten Peaks over a turquoise lake; the Rockpile view is a short walk.",
      "access_cost": { "v": [{ "type": "shuttle_only", "note": "no private vehicles on Moraine Lake Road" }], "state": "value",
        "basis": "official_rule", "src": ["src-0001"] },
      "signals": {
        "designations": { "v": [{ "type": "unesco_whs", "name": "Canadian Rocky Mountain Parks", "id": "304", "scope": "parent" },
                                { "type": "national_park", "name": "Banff National Park", "scope": "parent" }],
          "state": "value", "basis": "official_info", "src": ["src-0002"] },
        "editorial": { "v": null, "state": "gap", "basis": null, "src": [] }
      }
    }
  ]
}
```

## 5. Provenance and honesty rules

These are suitability.md section 3, rules 1 to 9, applied as written. In addition:

1. **Judged fields are `our_inference`, and the UI says "our judgement".** The `draw` note names at least one signal (`E_REL_DRAW_NOTE`).
2. **No copied ratings, counts or ranks.** `E_REL_LINK_ONLY_SRC` covers alltrails, komoot, gaia, outdooractive, wikiloc, trailforks, google, tripadvisor, yelp and booking hosts used as any `src`. `E_REL_COPIED_RATING` rejects a quote or note that matches a rating or review-count pattern ("4.8 stars", "4.8/5", "12,345 reviews", "#3 of 41").
3. **Editorial mentions are facts with a link**: the publisher, the list title, the year and the list type. They carry no copied text beyond the list's title.
4. **A designation states its scope.** A designation sourced from a park-level page on a place record must say `scope: parent` (`E_REL_INHERITED_DESIGNATION`).
5. **Visitor volume is official only**: NPS IRMA, Parks Canada attendance, or an operator's or town's own stated cap. Media figures are kept as conflicts.
6. **Fame signals are ours to compute, never to type.** The tool fetches them from QIDs, sequentially, with a descriptive User-Agent (`travel-relevance-signals/1.0 (+https://nks-travel.pages.dev/about/)`: project name and the public site, never an email), and caches them with the read date.
7. **No household data.** Day-trip fit uses public hubs only. `E_REL_HOUSEHOLD` reuses the privacy payload test: no origin string, no prose about where the household lives, its size or the children's ages, and no point (hub, town, base or place) within 2 km of a private origin (short-trips 4.4). The origin is read from an untracked local file, `data/relevance/inputs/private-origin.local.json`, and skipped when absent; it is never committed. Hubs must also be on the allowlist in `core/src/relevance/hubs.ts` (Toronto City Hall until Q19 is answered). `relevance.ts check` validates `inputs/hub-matrix.json` and `inputs/points.json` as well as the lane files.
8. **Freshness.** Draw, standing and distinction: 3 years. Designations: 3 years. Editorial mentions: 2 years. Access cost: 365 days. Fame signals: refreshed every year by the tool. A stale field raises `W_REL_STALE` at check time, and derive treats it as a `gap` and lists it in the derived item's `stale` flag.

## 6. How the site uses it (P1-P9, T1-T5)

### 6.1 Lenses (one data model, two orders)

| Lens | Turned on by | Ranks by (sort key, in order) | Grouping on the list |
|---|---|---|---|
| **Vacation** (default) | browsing Places, Trips, a country or a region; search | ED, distinction, standing, suitability fit (only when the Kids filter is set, 7.2), `detour_min`, name | "Worth the journey (n)", "Worth a detour (n)", "If you are nearby (n)", "Local outings (n)". The last group is **collapsed with its count**, and never hidden (P2) |
| **Day trip from H** | the short-trips drive pill: `drive=toronto-2` (short-trips 3.3), on Trips and, with RV1, on Places | filtered to H within the band; then standing, ED, minutes from H, name | by drive band: "Under 1 h", "1-2 h", "2-3 h" |

- **P4.** No new primary filter. The lens is the existing drive pill plus the sort menu: "Worth the journey" (the default, omitted from the URL), "Closest to <hub>" (sets the day lens), and "Name". The current state shows as a chip ("From Toronto · 1-2 h · ×"), with the one obvious clear.
- **P9.** The lens is URL state (`drive=`, `sort=`) that a server can answer. List data gains three light fields only: `badge`, `group` and `fromHubMin` for the active hub. It never carries the judgement notes or the signals (P8).
- **Search** uses the vacation order for ties, so "lake" in the Rockies lists Moraine, Louise and Peyto before a town pond.

### 6.2 Cards, trip pages and place pages

| Surface | At rest | One step away |
|---|---|---|
| Place card | at most one relevance chip (3.6), after the name and apart from the three suitability slots (6.7) | none on the card |
| Trip card (L3b) | a "Highlights" line naming the trip's anchors, up to 2 ("Moraine Lake · Icefields Parkway"). No relevance chip on trip cards | the trip page |
| Trip page, whole-trip strip (L3c) | anchors are marked in "The trip at a glance" | the day |
| Trip page, entry (L3c 3.10) | on trips of 4 or more nights: "Worth the journey" on anchors only. On short trips: "Local favourite" on the top stop. The suitability chips keep their own group, and the rule of one relevance chip applies to relevance only | the badge's provenance |
| Place page, hero | the badge, plus the `why` line | the provenance: judgement, designations with scope, mentions, signals with read dates |
| Place page, "Similar nearby" (new section, P2) | up to 3 substitutes with their badge, family effort and access load ("Peyto Lake · roadside · no booking") | the full list, and the OSM count |
| Place page, the pointer | for a `local` or `regional` place with a `far_pointer`: "Coming from far? Nearby, Moraine Lake is the one people travel for." Under the day lens it is replaced by the drive from the hub | |
| Place page, Plan B | for an anchor with a `plan_b`: "No shuttle seat? Peyto Lake is the same kind of view, roadside." | |

"Add to this day" (trip-timeline 3.7) ranks its candidates in the vacation order. On short trips it uses the day order from the trip's hub.

### 6.3 Trip tags (L3b)

- `highlights`: the trip's anchors, ordered by ED and then by day.
- Activity tags (lakes, glaciers, canyons and the rest) are rolled up only from anchors and highlights. They are no longer taken from every place.
- **A trip-level draw is not shown.** It is used only to order trips under the vacation lens: the maximum ED of the trip's anchors, then the count of anchors.

### 6.4 The globe (L2b; spec 6.5 amended)

| Zoom level | Pins drawn as pins | Everything else |
|---|---|---|
| World | trips only; country discs carry counts of all places | the disc's card lists the country's top 3 by the vacation order |
| Country | ED `world` and `national`, capped at 30 per country | aggregated into state discs with counts |
| State | plus `regional` | `local` as quiet dots (`Pin.quiet`), which cluster at 48 px |
| Area | all | |

- When clustering merges discs, the merged disc takes the label of its highest-ED member.
- A collision between labels keeps the higher ED.
- **P1 acceptance check:** with 10,000 synthetic places (1% world, 5% national, 20% regional, 74% local), the country view of Italy draws at most 30 place pins and every world pin is visible. The 400-marker cap is never reached at country level.

### 6.5 The planner, later (F02, F04)

- **Vacation creation.** After the region and the season, it offers the anchors that are in season and fit the party (7.1), then the highlights within 60 min of the chosen bases. Each base day gets fillers, and a `rainy_day` backup per base.
- **Day-trip creation.** From the household's origin (private, `leg_cache`), it lists day-trip fits of `plan_around` and `worth_it` by drive band, then local favourites within 1 h.
- **The year calendar** (F03) can surface a `draw_peak` window: "Algonquin fall colour: late Sep to mid Oct".

### 6.6 Hubs needed (short-trips 4.1 extended; owner Q3)

Day-trip and weekend fit need a public hub per region: Toronto, Hamilton, Ottawa and Montréal (already planned), plus Calgary (Rockies), Las Vegas or Salt Lake City (Utah), Burlington VT (Vermont), Venice and Bolzano (Dolomites), Geneva (Chamonix), and Reykjavik (Iceland). The cost is one ORS matrix run over about 207 places × 12 hubs. That is about 2,500 cells, inside one day's free quota in a few sequential requests.

### 6.7 Fit with suitability-applicability.md (read 18 Oct 2026)

- **One pass, two files.** This matches its section 8.3. The lane prompt takes its "relevance slot" from section 8.2 here, and output files stay disjoint.
- **Chips.** Applicability 5.1 gives suitability three slots at rest: limits or fit, effort or time, and the kind's deciding condition. The relevance badge is **not** one of the three. It sits on its own, after the name, so a card shows at most three suitability chips and one relevance chip. Warning marks stay outside both.
- **`weather` here is not `participation.weather_cancel` there.** Theirs is "the operator cancels in bad weather", a fact about the activity. Ours is "the payoff disappears in cloud", a judgement about worth. A gondola can be `weather_cancel: wind` and `weather: clear_only`. Neither field is copied into the other.
- **The Narrows profile** (their Q1, `river_hike`) does not affect relevance. The record keeps the same ref whichever profile wins.

## 7. Relevance with suitability and the party profile

### 7.1 How the two combine (no new primary filter; P4)

1. **Gate.** Suitability's hard limits and the Kids filter hide or dim (suitability 6.3, 6.4). A hard `min_age` above the youngest hides the place. An age band above it dims the place.
2. **Rescue.** For a dimmed `anchor` or `highlight` whose `easy_payoff` is `full` or `most`, and whose `easy_way` fits the party, the card stays undimmed. Its line names the easy way: "Moraine Lake · the Rockpile view is 0.7 km". `part` keeps the dim and names the easy way as a taste. `none` keeps the dim with the reason in numbers.
3. **Rank.** Relevance orders what remains (6.1).
4. **Substitute.** For a dimmed place, "Similar nearby" lists first the substitutes that fit the party.

### 7.2 Tie rule

Under the vacation lens, with the Kids filter set, the order inside a group (for example "Worth the journey") is: fits, then rescued, then dimmed. **A dimmed anchor never falls below a group boundary.** "Worth the journey" stays above "Worth a detour" whatever the party. The visitor should still know that Moraine Lake exists.

### 7.3 On the trip page (trip-timeline 3.5, 3.7)

- When no variant of a day fits, the "what our data has" offers follow the rescue order. First the `easy_way` of the day's anchor. Then the fitting substitutes within 30 km. Then "Make this a rest day", which uses the base's `rainy_day` and `filler` items.
- Relevance never changes `selectVariant`. It only ranks the offers.

## 8. The research lanes: what R1-R6 add in the same pass

The lanes already open, for every record, the land manager's or operator's page, the park page and the trip's research folder. Relevance needs mostly judgement on what they read, plus two lookups. **Estimated extra cost: 10-15% per lane, about 3 minutes a record.** Fame signals, substitutes, detours and fits are derived by RV0's tool, not by the lanes.

### 8.1 Captured by the lanes

| Field | Effort | Note |
|---|---|---|
| `wikidata` QID, confirmed | low | the highest value per minute: derive depends on it. Use the place's existing QID in `locations.json` when present. Otherwise search Wikidata and confirm the item by its coordinates and description |
| `class_key` | low | pick from the vocabulary. Propose a new class in the lane's markdown, never in the JSON |
| `draw`, `draw_peak`, `standing` with `standing_scope`, `distinction` with `unique_because` | medium | judgement, with a note naming the evidence |
| `easy_payoff`, `easy_way` | low | the lane already reads the short walks for suitability |
| `weather` | low | |
| `access_cost` | low | only what is not already held as a booking or as `access_season` |
| `signals.designations` (own and parent) | low | from the page being read. Wikidata P1435 and P757 are fetched by the tool |
| `official_highlight` | low | when the land manager's page names it as a headline |
| `signals.editorial` (at most 3) | medium | the national or regional tourism board's top list, and a national or global guide's top list, if one surfaces in the overview search |
| `signals.volume` | skip unless stated | only when an official page states it |
| `why` | low | one line, our words |

**Skipped**: crowd timing (it belongs in the timing lane), ratings and review counts (R6), and our own scores out of 10.

### 8.2 Exact extra instructions (append to each R lane brief, suitability 8.1)

> **Relevance pass (relevance.md section 8).** For every in-scope ref you enrich, also write one record to `data/relevance/<trip>/<lane>.json` in `relevance/1` format (relevance.md 2.1 and 4). Use the same ref and the same sources table conventions.
> 1. Confirm the Wikidata QID by coordinates and description. Never accept the first name match: "Moraine Lake" returns a lake in California first. Use `locations.json`'s `wikidata` when present. If there is no item, write `state: searched_none` with what you tried.
> 2. Set `class_key` from `data/vocab/relevance-classes.json`.
> 3. Judge `draw` against the table in relevance.md 2.2. The note must name at least one piece of evidence: a designation with its scope, a top-list mention, the land manager calling it a headline, or a booking that sells out. **Do not count Wikipedia languages or page views; the tool does that.** Set `draw_peak` only for a named season, such as fall colour, larches or wildflowers, with the dates as a pattern year.
> 4. Judge `standing` within a scope you name. Judge `distinction` against the other places of the same class that you know within 100 km, and name them in the note.
> 5. Set `easy_payoff` and `easy_way` from the walks you already read for suitability.
> 6. Set `weather`.
> 7. Add `access_cost` items only when they are not already a booking or an `access_season.via`.
> 8. Record designations from the page you are reading, with `scope: own` or `scope: parent`. Being inside a park is `parent`, and so is every area designation (UNESCO, national or provincial park, conservation area, dark sky, Ramsar) on anything that is not itself a park, region or protected area (`E_REL_INHERITED_DESIGNATION`). For a `parent` national or provincial park, add the park's confirmed Wikidata QID in `wikidata` so the tool can read the parent's fame (the Narrows inside Zion).
> 9. Record at most 3 editorial top-list mentions: the publisher, the title, the year, the list type and its `reach` (`regional`, `national` or `global`; a top list without it raises nothing and warns). **Copy no text, no ratings and no counts.** AllTrails, Google, Tripadvisor and Komoot are never a source.
> 10. Write `why`, one line in your own words.
>
> **Acceptance additions:**
> - `node core/bin/relevance.ts check --root .` passes on your file.
> - Every in-scope ref has exactly one relevance record.
> - At least 90% of records have a confirmed QID or `searched_none`.
> - The lane markdown ends with a table: record, draw, standing, distinction, class, and draw_suggested once RV0's tool has run.
>
> **Time box:** about 3 minutes a record. When in doubt between two tiers, choose the lower and say why.

### 8.3 Order

```
S0 (done) ──► S0b (applicability) ─┐
RV0 schema+validator+derive+signals┤ in parallel; disjoint files except codes.ts and messages.ts (append; RV0 rebases after S0b)
                                   ▼
          R1 R2a R2b R3 R4 R5 R6: suitability and relevance in one pass (no Commons)
                                   │
          RV0 `relevance.ts signals` (Wikidata, pageviews, Overpass; sequential) ──► derive ──► calibration (9.1 step 6)
                                   │
   3.12 hub matrix (extended to all scope places and regional hubs) ──► day-trip fits
                                   ▼
          RV1 adapter + ranking + badge + Similar nearby (after S1, and with or after L3b) ──► L2b globe tiers, L3e short-trip badges
```

## 9. Build and research plan

### 9.1 RV0: schema, validator, derive, signals tool (travel-builder, Sonnet; core and data only)

**Files you own:**
- `core/src/schema/relevance.ts`, registered as a document kind
- `core/src/relevance/{derive,signals,fit,refs}.ts`
- `core/src/validate/relevance.ts`, plus appends to `codes.ts` and `messages.ts`
- `core/bin/relevance.ts` (`check`, `signals --fetch`, `derive`, `derive --check`)
- `core/test/relevance/**`
- `data/relevance/README.md`, `data/relevance/signals/*`, `data/relevance/derived/*`
- `data/vocab/relevance-classes.json`

**Must not touch:** `core/src/schema/suitability.ts` (import only), `core/src/schedule/**`, `web/**` and `legacy/**`.

**Steps:**
1. Write the schema from 2.1.
2. Write the validator codes from section 5 and 2.2, with one failing fixture each.
3. Write the signals tool. It fetches by QID only: Wikidata `wbgetentities` (sitelinks, P1435, P757, P814), Wikimedia per-article monthly pageviews for English and each local-language edition with a sitelink, and Overpass class counts. All calls are sequential, with a User-Agent, cached, and carry read dates.
4. Write derive from 3.1-3.6, with unit tests on the section 10 examples: each example's fits, role and badge are a test case.
5. Add `relevance.ts check` and `derive --check` to `tools/check-all.sh`.
6. **Calibration.** After the lanes run, print a confusion table of `draw` against `draw_suggested` for all 207 records. Tune the 3.1 thresholds so that at least 80% match within one tier and none differ by 3 tiers. Record the thresholds and the table in `data/relevance/README.md`.

**Acceptance:**
- `pnpm --dir core typecheck` and the tests pass, and `bash tools/check-all.sh` passes.
- The section 10 examples give the stated roles and badges.
- No network call happens in `derive` or `check`.

**Verification and commits:** no UI, so no screenshots. Make logical commits. Stage paths with `git -C /home/nitin27may/workspace/travel-wt/v2 add <paths>`. End each message with the Co-Authored-By trailer. Run travel-verifier before reporting.

### 9.2 RV1: the site (travel-builder, after S1 merges; Fable designs the badge, the groups and "Similar nearby" first)

- **Adapter:** `web/lib/public/relevance.ts` joins `data/relevance/derived` onto `PublicPlace` and `CategoryItem`. The list payload gets `badge`, `group` and `fromHubMin` only (P8).
- **Lists:** the sort menu and grouping on Places and Trips (6.1); the day lens via the drive pill.
- **Place page:** the hero badge, "Similar nearby", the pointer and Plan B (6.2).
- **Trip pages:** the entry badge and the anchors in the at-a-glance strip (with L3c's owner).
- **Globe:** the tier rules go into the L2b brief (6.4); they are not built in RV1.
- **Verification:** `tsc`, the tests, and Playwright at 1440 and 390 in light and dark for Places (both lenses), a place page with a pointer, one with Plan B, and a trip page. Then the Fable review and travel-verifier. Add the P1 synthetic check to 5.1.

## 10. Worked examples (real data; hubs are public cities)

Distances are straight lines between our points, read 18 Oct 2026. Routed times come from the hub matrix (3.12). Signal figures are from 2.3.

### 10.1 Moraine Lake against the Fenland Loop (Banff)

| | Moraine Lake | Fenland Loop |
|---|---|---|
| Facts we hold | shuttle or commercial tour only, no private vehicles; Rockpile 0.7 km loop; lakeshore 1.3 km one way (Rockies `sights.json`) | 1.9 km, 20 m, about 45 min, flat; at the Banff townsite lot (`trails.json`) |
| Class | `lake/glacial-turquoise` | `trail/forest-loop` |
| draw / standing / distinction | `world` / `top` / `rare` (Lake Louise 11 km, Peyto 50 km) | `local` / `good` / `common` |
| Signals | 37 languages; WHS and national park as **parent** | no Wikidata item; the same parent designations, which do not raise it (3.1 rule 3) |
| easy_payoff | `full` (the Rockpile) | not applicable: the walk is the payoff |
| Derived | vacation `plan_around`, so `anchor`, **"Worth the journey"**; `plan_b` Peyto Lake (no booking) | vacation `if_nearby` (about 1 km from the town, so `detour_min` ≤ 20), so `filler`; flags `rainy_day` (`any_weather`); `far_pointer`: none within two tiers in its class, and Moraine Lake as the any-class pointer |
| For a family whose youngest is 5 | stays on top, rescued by the Rockpile (7.1 step 2) | a fine rest-day walk; no badge |

The local trail is not hidden. It sits in "If you are nearby" for Banff, which is exactly the owner's point.

### 10.2 The Tre Cime loop against Lago di Limides (Dolomites)

| | Tre Cime di Lavaredo loop | Lago di Limides |
|---|---|---|
| Facts we hold | 9.5-10.5 km, 400-480 m, 3.5-4.5 h; toll road slot at pass.auronzo.info, €40 a car, booked ahead (prototype) | 2 km, 80 m, 20-30 min each way; a sunset mirror of the Tofana di Rozes that needs dead calm (prototype) |
| Class | `trail/alpine-loop` | `lake/small-mirror` |
| draw / standing / distinction | `world` / `top` / `unique` | `local` / `good` / `common` (Lago Federa 6 km, Lago d'Antorno 20 km) |
| Signals | 28 languages; German views 107,648, more than English (2.3) | 1 language |
| easy_payoff / weather | `part`: the view from Rifugio Auronzo is the south faces, and the classic north faces need the walk round to Forcella Lavaredo (our judgement from the loop's layout) / `better_clear` | `full` / `clear_only` |
| access | `toll_reservation`, so `access_load` `plan` | none |
| Derived | `anchor`, **"Worth the journey"** | vacation `if_nearby` (within 20 min of a Falzarego base), dropped to `skip` by `clear_only`. It stays on the trip that already holds it as a sunset option, because a trip's own entries are never filtered. `far_pointer` to Cinque Torri or the Lagazuoi |

**Lago di Landro, passing through.** `regional`/`good`, roadside, 20 min, no booking. Passing-through fit is `worth_it` and the place is flagged `en_route`. Its 10 Wikipedia languages suggest `national` (an over-score, 2.3). The judgement note explains the gap and keeps it `regional`.

### 10.3 An Algonquin day hike against an Escarpment loop near Toronto (hub: Toronto City Hall)

| | Track and Tower Trail, Algonquin (Highway 60 km 25) | Rattlesnake Point, Conservation Halton |
|---|---|---|
| From Toronto | about 220 km straight line, so the 3 h+ band (≈ until routed) | about 47 km, so under 1 h (≈) |
| Class | `trail/lookout` | `viewpoint/escarpment` |
| draw / standing / distinction | `regional`, with `draw_peak` `national` from about 20 Sep to 15 Oct (fall colour; the park's 25 languages are a parent signal) / `top` / `rare` | `regional` / `top` within 1 h of Toronto / `common` (Mount Nemo and Kelso nearby on the same escarpment) |
| access | `day_permit`: released 5 days ahead at 07:00 ET, all sales final (short-trips K8) | reservations recommended, not required (Conservation Halton, via search) |
| Day trip from Toronto | `skip` (over 3 h one way) | `plan_around` |
| Weekend from Toronto | `plan_around` when the Highway 60 corridor holds two or more `top` regional places within 30 min of one another (to confirm in R6); Toronto is 3 h+ away | `skip`: under 1.5 h from the hub, so a day trip |
| Vacation (a visitor from far, in October) | ED `national` with standing `top` in the peak, so `anchor`, **"Worth the journey"**. Outside the peak it is `regional` `top` `rare`, so `highlight`, "Worth a detour" | `if_nearby` (regional, but distinction `common`); no `far_pointer`: Niagara Falls, the one people travel for, is about 81 km away, outside the 50 km reach of 3.2 |
| Badge, day lens | none (outside the band) | **"Local favourite"** |

The same visitor with a different lens gets the right answer from each. A Toronto day-tripper sees Rattlesnake Point first. A visitor from 2,000 km away in October sees Algonquin, and Rattlesnake Point appears only as a nearby option.

### 10.4 Elora Gorge as a day trip

- Elora Gorge (Q5367207, 5 languages, 8,590 views) is about 85 km from Toronto City Hall, in the 1-2 h band once routed.
- Class `gorge/river-limestone`; draw `regional`; standing `top` within 2 h of Toronto; distinction `rare`. Rockwood, about 25 km away, is in the same class and is the substitute.
- The GRCA lists a day-use season of 1 May to 15 Oct with daily capacity limits. Tubing ran from 26 Jun to 7 Sep 2026, online only, up to 3 days ahead, with no walk-ups (short-trips 1).
- `access_cost` is `daily_cap` for the park and `timed_entry` for tubing, giving `access_load` `plan`. The weather is `better_clear` for tubing, and the river-flow go check sits in the outing frame.
- Day trip from Toronto: `plan_around`, so **"Local favourite"** on the short-trip page and under the day lens.
- Vacation: `worth_it` (regional, top, rare), so `highlight` with "Worth a detour" for a visitor based in southern Ontario. It is **not** an anchor, and it never reaches the world or country view of the globe. Compare Rattlesnake Point (10.3), which has the same standing but is `common`, so it stays `if_nearby`. That one distinction field is what separates "worth a detour" from "a local's favourite".

### 10.5 A Utah slot canyon: the Narrows against Kanarra Falls

| | The Narrows from the Temple of Sinawava (Zion) | Kanarra Falls (Kanarraville) |
|---|---|---|
| Facts | no permit needed bottom-up as far as Big Spring; closed above 150 cfs and during flash-flood warnings, and for at least 2 h after (NPS, opened) | a daily permit limit set by the town; most sources say 150 a day and about US$15, and peak days often sell out a month ahead (secondary sources; the official kanarrafalls.com was not read) |
| Class | `canyon/slot-wade` | `canyon/slot-wade` |
| draw / standing / distinction | `world` / `top` / `unique` | `regional` / `good` / `rare` |
| Signals | 7 languages (an under-score); `official_highlight` (NPS: "one of the most popular areas"), so rule 2 gives a `national` floor; the judgement is `world`, with the gap note | no Wikidata item for the falls; Kanarra Creek Canyon has 0 languages; Visit Utah lists it |
| easy_payoff / weather | `part` (the paved Riverside Walk) / flow-dependent: `access_season` and the go check | `most` / `better_clear` (the flash-flood risk applies to both) |
| Derived | `anchor`, **"Worth the journey"** | vacation `if_nearby` (about 33 km straight line from the Temple of Sinawava; by road it is longer, and not routed); `access_load` `hard` (a cap that sells out), so the fit drops to `skip` for a far-away visitor unless based in Cedar City; `far_pointer` to the Narrows |

### 10.6 A Vermont foliage drive: Smugglers' Notch (VT-108)

- **Class** `drive/mountain-pass`. **Draw** `regional`, with `draw_peak` `national` in the foliage window: the region's fall colour draws visitors from across the country. The evidence is the plan's research, which records a tiny lot at the top as the most congested spot in the area during foliage.
- **Standing** `good`. Foliage is everywhere in northern Vermont, and the Notch is one strong drive among several. **Distinction** `rare`: Appalachian Gap and Lincoln Gap are the same class.
- **Access:** `seasonal_road`. VTrans closes the Notch for the winter, in recent years from November to mid-May. Chicanes keep large vehicles out (VTrans via Vermont Public, read through search). `access_load` is `easy` in season.
- **Wikidata:** the search returns the ski resort first (Q7546617). The state park (Q7546619) has 1 language. Fame signals are almost useless here, which is the case for judgement.
- **Derived:** passing-through fit `plan_around` in the peak (the detour is 0 on a VT-108 leg), so `en_route`. The vacation role in the peak is `highlight` (national, good), giving **"Worth a detour"**. Out of season it is `regional` and `good`, so `if_nearby`. Weather is `better_clear`.

### 10.7 What the examples test (RV0 unit cases)

| Case | Rule exercised |
|---|---|
| Fenland in a WHS | parent designations never raise the tier |
| Narrows at 7 languages | the official-highlight floor under a world-fame parent (the parent QID in the designation). With the measured 15,582 views the suggestion is already `national`, one tier below the judged `world`, so no `W_REL_DRAW_GAP` fires |
| Landro at 10 languages | an over-score kept down by judgement |
| Limides | `clear_only` drops a fit |
| Kanarra | `hard` access drops a vacation fit; `far_pointer` |
| Algonquin, Smugglers' Notch | `draw_peak` changes ED by season |
| Moraine | `plan_b` substitute without a booking; the suitability rescue through `easy_payoff` |
| Rattlesnake | the same place gets `plan_around` (day, Toronto) and `if_nearby` (vacation) |

## 11. Gotchas

- **A name search finds the wrong place.** Moraine Lake in California, the Lake Louise hamlet, the Smugglers' Notch ski resort. QIDs are confirmed by a person, and derive never searches.
- **Being inside a park is not draw.** Every Banff trail inherits the WHS. Only `scope: own` counts.
- **Fame is not worth, and use is not draw.** Page views spike with news and disasters, so take the 12-month window. Resident use inflates community counts, which is why we store none.
- **Language bias.** The Dolomites read in German and the Gaspé in French. Take the maximum across the local languages.
- **Seasonal draw is real.** A foliage drive in July is regional. Use `draw_peak` with the season filter. Do not raise the base tier.
- **A cap creates scarcity, not quality.** Kanarra's sell-outs reflect 150 permits, not world draw.
- **Never a negative chip.** Locals are our day-trip audience.

## 12. Open questions for the owner

1. **Badge wording.** "Worth the journey", "Worth a detour" and "Local favourite", one chip at most and never a negative one. The wording echoes Michelin's ladder without its stars. Recommended: yes.
2. **Default order when browsing.** Make the vacation order the default on Places and Trips, with "Local outings (n)" collapsed. The alternative is to keep the name order and offer "Worth the journey" as a sort option. Recommended: the vacation order as default.
3. **Hubs beyond Ontario.** Add Calgary, Las Vegas or Salt Lake City, Burlington VT, Venice, Bolzano, Geneva and Reykjavik, so day-trip and weekend fit work in every trip region. The alternative is Ontario only for now. Recommended: add them; it is one ORS run inside the free quota.

## Change log

| Date | Change |
|---|---|
| 2026-10-18 | First draft: prior art (Michelin, Lonely Planet, Google, AllTrails, Atlas Obscura, Destination Canada CSE, NPS, UNESCO, Komoot, Wikidata and pageviews), the `relevance/1` sidecar, derivation rules, lenses and display rules, globe tiers, the suitability combination, the lane additions, RV0 and RV1, and 6 worked examples with measured signals |
| 2026-10-18 | RV0 verification fixes: `own` area designations only on park, region and protected_area records (all else `parent`); household rule widened to prose, a 2 km private-origin check from an untracked local file, a hub allowlist, and input validation in `check`; far-pointer reach stays 50 km (Niagara removed from 10.3); no draw-gap warning for the Narrows with the measured views; ordinary standing within 45 min is `if_nearby` on the day lens; stale values are gaps with a `stale` flag; capped boats and lifts are `hard`; `Mention.reach` and `Designation.wikidata` added; User-Agent contact is the public site; `coord_src` on every point (never Google) |
| 2026-10-18 | Added `pair_with` ("Nearby, worth adding", derived plus hand-picked `pairs_with`) and made similar-nearby attribute-aware (effort, time, feature tags), at the owner's request |
| 2026-10-18 | CF: world top draws that need clear weather keep their anchor and gain `go_clear_day` (national draws still step down); an anchor needs distinction `unique` or `rare`, or a `world` draw (national top common caps at highlight); a place and its activity are not both anchors, matched by the new `same_place_as` ref or a shared QID (3.4, 3.5) |
| 2026-10-18 | RVC calibration: fame signals fetched for 170 confirmed QIDs; regional language floor 3 to 2; settlements use views only; thresholds version 2; 89% within one tier, none three apart; derived files rewritten |
