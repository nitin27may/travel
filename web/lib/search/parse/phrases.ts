// The hand-written words of the query parser (smart-search 4.3). Build time only: `web/scripts/search-vocab.mjs` reads this file,
// merges it with the words it derives from the type tree and the contract facets, checks every target and value against the real
// facets, and writes `web/public/search/vocab.json`. The browser never loads this file, only the JSON.
//
// Shape: parameter -> value -> phrases. A parameter is a URL filter key (`k`, `season`, `f.toilets` ...) or a grammar class that starts
// with `$`. Phrases are English, lower case, without punctuation; a plural is found by the parser (`kids` finds `kid`), so list the
// singular. A phrase that is also an ordinary word needs a reason to be here (see AMBIGUOUS in the script).

export type PhraseTable = Record<string, Record<string, string[]>>;

export const PHRASES: PhraseTable = {
  // ---- grammar classes ----
  $filler: {
    '': [
      'in', 'for', 'with', 'near', 'the', 'a', 'an', 'to', 'and', 'or', 'of', 'on', 'at', 'by', 'i', 'we', 'can', 'could', 'reach', 'go', 'get', 'good', 'best', 'nice', 'great',
      'place', 'somewhere', 'where', 'some', 'any', 'my', 'me', 'our', 'is', 'are', 'that', 'there', 'around', 'ride', 'visit', 'find', 'show', 'want', 'looking', 'look', 'about', 'from',
    ],
  },
  // words that introduce a place name
  $loc: { '': ['in', 'near', 'around', 'at', 'close to', 'next to', 'outside', 'inside', 'within'] },
  // "under 5 km" keeps what is below the figure, "over 5 km" what is above it
  $mod: { max: ['under', 'less than', 'below', 'up to', 'max', 'at most', 'within', 'no more than'], min: ['over', 'more than', 'at least', 'above'] },
  $num: {
    '1': ['one'], '2': ['two'], '3': ['three'], '4': ['four'], '5': ['five'], '6': ['six'], '7': ['seven'], '8': ['eight'], '9': ['nine'], '10': ['ten'], '11': ['eleven'], '12': ['twelve'],
  },
  // what a figure counts
  $unit: {
    km: ['km', 'kilometre', 'kilometer', 'k'],
    mi: ['mile', 'mi'],
    m: ['m', 'metre', 'meter'],
    h: ['h', 'hr', 'hour'],
    day: ['day'],
    night: ['night'],
    week: ['week'],
    age: ['year', 'yr', 'yo'],
  },
  $month: {
    '1': ['january', 'jan'], '2': ['february', 'feb'], '3': ['march', 'mar'], '4': ['april', 'apr'], '5': ['may'], '6': ['june', 'jun'],
    '7': ['july', 'jul'], '8': ['august', 'aug'], '9': ['september', 'sep', 'sept'], '10': ['october', 'oct'], '11': ['november', 'nov'], '12': ['december', 'dec'],
  },
  // "fall" is autumn here; a waterfall word is "falls" and is a type alias, found first because the parser tries the typed word before its singular (A4)
  $season: {
    spring: ['spring'],
    summer: ['summer'],
    autumn: ['autumn', 'fall', 'fall colour', 'fall color', 'autumn colour', 'autumn color', 'foliage', 'fall foliage'],
    winter: ['winter'],
  },
  // words about a trip rather than a place: they send the parse to Trips (A11)
  $trips: { '': ['trip', 'itinerary', 'vacation'] },
  // relevance words: no filter exists yet (Q35), so the parser says so instead of dropping them
  $relevance: {
    '': [
      'worth the journey', 'worth a detour', 'worth the drive', 'must see', 'bucket list', 'world class', 'hidden gem', 'local favourite', 'local favorite',
      'off the beaten path', 'off the beaten track', 'iconic', 'underrated',
    ],
  },
  // a duration word; the parser writes it to `f.time` for trails or `f.duration` for activities (A7)
  $duration: {
    '<1h': ['quick'],
    'half-day': ['half day', 'half a day'],
    'full-day': ['full day', 'all day', 'whole day'],
    'multi-day': ['multi day', 'several days'],
  },

  // ---- people and access (suitability 1.2, 1.4, 6.2) ----
  kid: {
    yes: ['kid', 'child', 'children', 'family', 'kid friendly', 'child friendly', 'family friendly', 'little one'],
    '2': ['toddler'],
    '0': ['baby', 'infant'],
    '13': ['teen', 'teenager'],
  },
  stroller: {
    any: ['stroller', 'pram', 'pushchair', 'buggy'],
    'all-terrain': ['all terrain stroller', 'jogging stroller', 'all terrain pram'],
  },
  'f.step-free': { yes: ['wheelchair', 'wheelchair accessible', 'step free', 'accessible'] },
  effort: {
    'stroll,easy': ['easy', 'gentle', 'flat'],
    stroll: ['stroll'],
    moderate: ['moderate'],
    hard: ['hard', 'challenging', 'strenuous', 'difficult', 'tough'],
    technical: ['technical', 'scramble', 'exposed'],
  },

  // ---- facet words ----
  'f.climb': { lt150: ['no climbing', 'no climb', 'no hills', 'no hill'] },
  'f.toilets': { yes: ['toilet', 'restroom', 'washroom', 'bathroom'] },
  'f.dogs': { yes: ['dog', 'dog friendly', 'dogs allowed', 'dog welcome'] },
  'f.lifeguard': { yes: ['lifeguard', 'lifeguarded'] },
  'f.indoor-or-rainy-day': { yes: ['indoor', 'rainy day', 'rainy', 'bad weather', 'wet weather'] },
  'f.fenced': { yes: ['fenced'] },
  'f.guided-or-self-guided': { yes: ['guided'] },
  'f.price-band': { free: ['free', 'no cost', 'no charge'] },
  'f.booking-needed': { none: ['no booking', 'no reservation', 'walk up'] },
  'f.walk-from-the-car': { lt200: ['close to the parking', 'close to the car', 'close to the car park', 'near the car park', 'next to the car', 'next to the parking'] },
  'f.best-time-of-day': { sunrise: ['sunrise'], sunset: ['sunset'] },
  'f.shape': { loop: ['loop', 'circuit', 'circular'], 'out-and-back': ['out and back'], 'point-to-point': ['point to point', 'one way'], network: ['network'] },
  k: {
    'intent:do': ['things to do', 'thing to do', 'something to do', 'what to do', 'activity'],
    culture: ['sight', 'sightseeing', 'attraction'],
  },

  // ---- trips ----
  length: {
    day: ['day trip', 'day tripper'],
    overnight: ['overnight', 'overnighter'],
    weekend: ['weekend', 'weekend away', 'weekend getaway'],
    'long-weekend': ['long weekend', 'long weekend away'],
    '4-8': ['week long', 'weeklong'],
  },
  around: {
    'rental-car': ['rental car', 'hire car'],
    'camper-van': ['camper van', 'campervan', 'motorhome', 'motor home'],
    train: ['by train', 'train trip', 'rail trip'],
    tours: ['group tour', 'organised tour', 'organized tour', 'guided tour'],
  },
  shape: { 'road-trip': ['road trip', 'roadtrip', 'driving trip'], 'one-base': ['one base', 'single base', 'base camp'] },
};

/** Trip words that mean a trips-only filter; the others, such as `kid` and `season`, work on both lists. */
export const TRIPS_ONLY: readonly string[] = ['length', 'around', 'shape', 'perday', 'drive'];

/**
 * Types a visitor means exactly, so a word for them does not widen to the category (A3). The spec puts this on the node as
 * `search: "exact"` in types.json; that field needs a change in core's strict type schema, so until core takes it the list lives here
 * and the build also honours the node mark. The vocabulary check fails on an id that is not a type.
 */
export const EXACT_TYPES: readonly string[] = ['water.thermal.hot_spring', 'air.zip.zipline', 'play.playground.splash_pad'];

/** Country codes whose winter is June to August (A8). */
export const SOUTH: readonly string[] = ['AR', 'CL', 'NZ', 'AU', 'ZA', 'BO', 'PY', 'UY', 'PE', 'MG', 'MZ', 'ZW', 'NA', 'BW', 'FJ', 'PG'];

/** A scoped facet that brings its Kind when none was parsed (A7). */
export const IMPLIED_KIND: Record<string, string> = { 'f.length': 'nature.trail', 'f.climb': 'nature.trail', 'f.time': 'nature.trail', 'f.duration': 'intent:do' };

/** Names people type for a country that the standard English name does not cover. */
export const COUNTRY_EXTRA: Record<string, string> = { usa: 'US', america: 'US', uk: 'GB', britain: 'GB', england: 'GB', holland: 'NL', czechia: 'CZ' };

/** Chip words that read better than the facet's own label. */
export const LABELS: Record<string, string> = {
  'k=intent:do': 'Things to do',
  'effort=stroll,easy': 'Easy or a stroll',
  'kid=yes': 'With kids',
  'kid=0': 'Baby (age 0)',
  'kid=2': 'Toddler (age 2)',
  'kid=13': 'Teen (age 13)',
  'stroller=any': 'Any stroller',
  'stroller=all-terrain': 'All-terrain stroller',
  'f.dogs=yes': 'Dogs allowed',
  'f.step-free=yes': 'Step-free',
  'f.indoor-or-rainy-day=yes': 'Indoor or rainy day',
  'f.lifeguard=yes': 'Lifeguard',
  'f.guided-or-self-guided=yes': 'Guided',
  'f.price-band=free': 'Free',
  'f.booking-needed=none': 'No booking needed',
  'f.walk-from-the-car=lt200': 'Walk from the car: under 200 m',
  'f.climb=lt150': 'Climb: under 150 m',
  'length=day': 'Day trip',
  'length=overnight': 'Overnight',
  'length=weekend': 'Weekend (2 nights)',
  'length=long-weekend': 'Long weekend (3 nights)',
  'around=rental-car': 'Rental car',
  'around=camper-van': 'Camper van',
  'around=train': 'Train',
  'around=tours': 'Tours',
  'shape=road-trip': 'Road trip',
  'shape=one-base': 'One base',
};
