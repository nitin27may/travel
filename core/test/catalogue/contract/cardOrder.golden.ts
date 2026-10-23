// K24.order: the ranking of ten fixed queries, as slugs best first (store.ts A28: score rounded to 6 decimals, then sortKey(name), then ref).
// A store that returns name matches alphabetically, drops the document length, counts places with no card in N or reads tags as ids
// ranks these differently. `exact`: the whole answer is pinned (the stub fixture never changes). On the real data the listed slugs must
// keep their relative order inside the first 50 hits, so a new place that mentions "lake" does not fail the case, but a changed rule does.
// To refresh the real list after a deliberate ranking change, rerun the ten queries on the json target and paste the first ten slugs.
/** The stub fixture's ten queries and their complete answers. */
export const STUB_CARD_ORDER: Record<string, string[]> = {
  "lake": ["glacier-lake", "emerald-pool-kananaskis", "emerald-pool-yoho", "lago-verde"],
  "falls": ["skogar-falls", "spiral-falls"],
  "walk": ["canyon-walk", "glacier-tongue-walk", "ridge-walk"],
  "yoho": ["emerald-pool-yoho", "natural-bridge", "spiral-falls"],
  "bow valley": ["canyon-walk", "hoodoo-viewpoint", "larch-basin-trail", "summit-gondola", "glacier-lake"],
  "emerald pool": ["emerald-pool-kananaskis", "emerald-pool-yoho"],
  "glacier lake": ["glacier-lake", "glacier-tongue-walk", "emerald-pool-kananaskis", "emerald-pool-yoho", "lago-verde"],
  "trail bow valley": ["canyon-walk", "larch-basin-trail", "hoodoo-viewpoint", "summit-gondola", "glacier-lake"],
  "viewpoint cortina": ["three-peaks-view", "hoodoo-viewpoint", "mountain-hut"],
  "waterfall in yoho": ["spiral-falls", "skogar-falls", "emerald-pool-yoho", "natural-bridge"],
};

/** The real catalogue's ten queries and the first ten slugs of each, taken at 23 Oct 2026. */
export const REAL_CARD_ORDER: Record<string, string[]> = {
  "lake": ["cameron-lake", "kinney-lake-mount-robson", "crypt-lake", "grassi-lakes", "beauvais-lake-trail", "berg-lake", "lake-como", "solitaire-lake-trail", "pyramid-lake", "moraine-lake"],
  "waterfall": ["borgarfjordur-waterfalls", "grand-sault-waterfall", "takakkaw-falls", "wapta-falls-yoho", "canyon-sainte-anne", "sunwapta-falls", "canyon-des-portes-de-lenfer", "dettifoss", "godafoss", "svartifoss"],
  "glacier": ["athabasca-glacier-guided-ice-walk", "athabasca-glacier-and-columbia-icefield", "mount-edith-cavell-and-cavell-meadows", "bow-lake", "toe-of-athabasca-glacier", "plain-of-six-glaciers-to-teahouse-and-abbot-pass-viewpoint", "viel-dal-pan", "moraine-lake", "moraine-lake-rockpile"],
  "hot springs": ["banff-upper-hot-springs", "miette-hot-springs", "radium-hot-springs", "whiteswan-lake-and-lussier-hot-springs", "ouray", "fairmont-banff-springs-spa", "manitou-incline", "paint-pots", "cave-and-basin-national-historic-site"],
  "lighthouse": ["la-martre-lighthouse", "cap-gaspe", "cape-cod"],
  "national park": ["yellowstone-national-park", "arches-national-park", "zion-national-park", "bryce-canyon-national-park", "canyonlands-national-park", "grand-teton-national-park", "mount-rainier-national-park", "north-cascades-national-park", "cap-bon-ami", "cap-gaspe"],
  "viewpoint trail": ["elk-lakes-viewpoint-trail", "indefatigable-bench-viewpoint", "cadini-di-misurina-viewpoint", "plain-of-six-glaciers-to-teahouse-and-abbot-pass-viewpoint", "tre-cime-north-face-viewpoint-by-rifugio-locatelli", "pic-champlain", "mont-saint-alban", "kirkjufell", "sansons-peak", "sentinel-pass"],
  "turquoise": ["kinney-lake-mount-robson", "lago-di-sorapis"],
  "canyon": ["maligne-canyon", "marble-canyon", "johnston-canyon", "the-narrows", "johnston-canyon-lower-falls", "johnston-canyon-upper-falls", "fjadrargljufur-canyon", "johnston-canyon-walk", "marble-canyon-walk", "sunset-point"],
  "old town": ["la-val", "reykjavik-old-harbour", "cortina-dampezzo", "milan", "verona", "dobbiaco", "florence", "venice", "rome", "santa-cristina"],
};
