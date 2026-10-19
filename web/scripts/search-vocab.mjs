// Writes web/public/search/vocab.json (search-vocab/1), the words the query parser reads (smart-search 4.3).
// Sources: every node of data/vocab/types.json (label parts and aliases), the bool facets of the contract slice, and the
// hand-written table lib/search/parse/phrases.ts. Labels only (principle P8): no place names, no slugs, no facts.
//   node web/scripts/search-vocab.mjs           write the file
//   node web/scripts/search-vocab.mjs --check   fail on dead vocabulary, unruled double meanings, or a file that is out of date
// A type added to types.json with a label and aliases is found by the next run, with no code change (tests/search/vocab.test.ts proves it).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const out = path.join(root, 'web/public/search/vocab.json');
const read = (rel) => JSON.parse(readFileSync(path.join(root, rel), 'utf8'));

const { PHRASES, SOUTH, IMPLIED_KIND, LABELS, EXACT_TYPES, COUNTRY_EXTRA } = await import('../lib/search/parse/phrases.ts');
const { singularPhrase, MAX_WORDS } = await import('../lib/search/parse/words.ts');
const { normalize } = await import('../lib/search/normalize.ts');
const answers = await import('../lib/entities/facets/answers.ts');
const { FLAG_OF_PROPERTY } = await import('@travel/core/capture/bandKeys.ts');

/** The URL keys the parser may write (FACET_PARAMS in lib/entities/types.ts; a test pins that this list equals it). */
export const BASE_PARAMS = ['country', 'region', 'area', 'kind', 'k', 'style', 'grade', 'kid', 'season', 'tag', 'trip', 'due', 'effort', 'stroller', 'length', 'around', 'perday', 'shape', 'drive'];
/** Values of the base facets that are not in the contract slice (descriptors/place.tsx and trip.tsx; a test pins these against labels.ts). */
export const BASE_VALUES = {
  effort: answers.EFFORT_VALUES,
  stroller: ['any', 'all-terrain'],
  length: ['day', 'overnight', 'weekend', 'long-weekend', '4-8', '9-14', '15+'],
  around: ['rental-car', 'camper-van', 'train', 'tours'],
  perday: ['u1', '1-2', '2-3', '3+'],
  shape: ['one-base', 'road-trip'],
  drive: ['toronto-1', 'toronto-2', 'toronto-3', 'toronto-4'],
};
const GRAMMAR = new Set(['$filler', '$loc', '$mod', '$num', '$unit', '$month', '$season', '$trips', '$relevance', '$duration']);

/** Words that are ordinary English and must not mean a type (A4). `tram` and `slot` are aliases in types.json that would catch ordinary text. */
export const STOP_ALIASES = new Set(['tram', 'slot']);
/** Single words cut from a label ("Surf, kite and wind" must not make `wind` mean surfing). */
export const STOP_PARTS = new Set(['wind', 'kite', 'fun', 'other', 'coast', 'room', 'stay', 'access', 'amenity', 'permit', 'pass', 'drink', 'food', 'play', 'air', 'wheel', 'ride', 'bike', 'drive', 'mountain', 'class', 'show', 'game', 'foliage', 'natural', 'state', 'stop', 'cluster', 'district', 'closure', 'holiday', 'performance', 'jump', 'fuel', 'dock']);
/** Bool facets whose label would make a wrong word ("self guided" is not a yes), or that the hand table words better. */
const AUTO_SKIP = new Set(['guided-or-self-guided', 'weather-dependent', 'step-free', 'indoor-or-rainy-day', 'swimming']);
/**
 * Phrases allowed to mean two things of one key, with the reason. The parser gives both readings as "Did you mean" (A2).
 * A phrase that maps to two values of one key and is not here fails the check.
 */
export const AMBIGUOUS = {};

/** A domain or category label lists several things ("Waterfalls and rapids"); a type label only offers alternatives ("Castle or fort"), because "Park and ride" is one thing. */
const splitLabel = (label, wide = true) => label.split(wide ? /,|\band\b|\bor\b/ : /,|\bor\b/).map((p) => normalize(p)).filter(Boolean);

/** The id a type word resolves to: its category (A3), unless the node is marked `search: "exact"`. */
function target(node) {
  if (node.search === 'exact' || EXACT_TYPES.includes(node.id)) return node.id;
  const parts = node.id.split('.');
  return parts.length >= 3 ? parts.slice(0, 2).join('.') : node.id;
}

const deeper = (a, b) => b.startsWith(`${a}.`);

/** Builds the vocabulary and lists what is wrong with it. `types` and `slice` are the parsed JSON files; tests pass fixtures. */
export function buildVocab({ types, slice, phrases = PHRASES }) {
  const entries = []; // { phrase, param, value, src }
  const add = (phrase, param, value, src, raw = false) => {
    const p = normalize(phrase);
    if (!p) return;
    entries.push({ phrase: raw ? p : singularPhrase(p), param, value, src });
  };

  for (const node of types.nodes) {
    if (!node.label) continue;
    const to = target(node);
    for (const part of splitLabel(node.label, node.level === 'domain' || node.level === 'category')) {
      // a subtype label is a qualifier ("Tour" under canoe, "Kids' course" under zip line), so a single word of it is not a type word
      if (node.level === 'subtype' && !part.includes(' ')) continue;
      if (part.length < 3 || STOP_PARTS.has(singularPhrase(part)) || STOP_PARTS.has(part)) continue;
      add(part, 'k', to, `label of ${node.id}`);
    }
    for (const alias of node.aliases ?? []) {
      if (STOP_ALIASES.has(alias)) continue;
      add(alias, 'k', to, `alias of ${node.id}`, true);
    }
  }
  for (const f of slice.facets) {
    const isBool = f.control === 'bool' || FLAG_OF_PROPERTY[f.property];
    if (!isBool || AUTO_SKIP.has(f.key) || ['stroller', 'effort', 'age_band'].includes(f.property) || f.property === 'effort.source_grade') continue;
    for (const part of splitLabel(f.label)) if (part.length >= 3) add(part, `f.${f.key}`, 'yes', `label of facet ${f.key}`);
  }
  for (const [param, values] of Object.entries(phrases)) {
    for (const [value, list] of Object.entries(values)) for (const phrase of list) add(phrase, param, value, 'phrases.ts', true);
  }

  // ---- group, then rule on double meanings ----
  const byPhrase = new Map();
  for (const e of entries) {
    const list = byPhrase.get(e.phrase) ?? [];
    if (!list.some((x) => x.param === e.param && x.value === e.value)) list.push(e);
    byPhrase.set(e.phrase, list);
  }
  const problems = [];
  const kept = [];
  for (const [phrase, list] of byPhrase) {
    let rest = list;
    // a type word that names a node and its ancestor means the deeper one (hot spring over hot springs and spas)
    const ks = rest.filter((e) => e.param === 'k');
    rest = rest.filter((e) => e.param !== 'k' || !ks.some((o) => o !== e && deeper(e.value, o.value)));
    const params = new Map();
    for (const e of rest) params.set(e.param, [...(params.get(e.param) ?? []), e]);
    for (const [param, es] of params) {
      if (es.length > 1 && !AMBIGUOUS[phrase]) problems.push(`"${phrase}" means ${es.map((e) => `${param}=${e.value} (${e.src})`).join(' and ')}: stop-list it or rule it in AMBIGUOUS`);
    }
    const grammar = rest.filter((e) => GRAMMAR.has(e.param));
    const real = rest.filter((e) => !GRAMMAR.has(e.param));
    for (const g of grammar) for (const r of real) {
      // a filler/number/unit word that is also a real word must be ruled on purpose
      if (!AMBIGUOUS[phrase]) problems.push(`"${phrase}" is both ${g.param} and ${r.param}=${r.value} (${r.src}): stop-list it or rule it in AMBIGUOUS`);
    }
    kept.push(...rest);
  }

  // ---- check every target and value against the real facets (dead vocabulary) ----
  const sliceKeys = new Map(slice.facets.map((f) => [`f.${f.key}`, f]));
  const nodeIds = new Set([...types.nodes.map((n) => n.id), ...slice.facets.flatMap((f) => f.scopes).filter((s) => s.startsWith('intent:'))]);
  for (const e of kept) {
    const where = `"${e.phrase}" -> ${e.param}=${e.value} (${e.src})`;
    if (e.phrase.split(' ').length > MAX_WORDS) problems.push(`${where}: longer than ${MAX_WORDS} words`);
    if (e.param.startsWith('$')) {
      if (!GRAMMAR.has(e.param)) problems.push(`${where}: unknown grammar class`);
      continue;
    }
    const facet = sliceKeys.get(e.param);
    if (!BASE_PARAMS.includes(e.param) && !facet) {
      problems.push(`${where}: ${e.param} is not a URL filter key`);
      continue;
    }
    const values = e.value.split(',');
    if (e.param === 'k') {
      if (!nodeIds.has(e.value)) problems.push(`${where}: no such type`);
    } else if (e.param === 'kid') {
      if (e.value !== 'yes' && !(/^\d{1,2}$/.test(e.value) && Number(e.value) <= 17)) problems.push(`${where}: not an age`);
    } else if (e.param === 'season') {
      if (!values.every((v) => /^\d{1,2}$/.test(v) && v >= 1 && v <= 12)) problems.push(`${where}: not a month`);
    } else if (facet) {
      const allowed = answers.orderOf(facet);
      if (!allowed) problems.push(`${where}: ${e.param} has no fixed values to check against`);
      else if (!values.every((v) => allowed.includes(v))) problems.push(`${where}: not a value of ${e.param} (${allowed.join(', ')})`);
    } else if (BASE_VALUES[e.param]) {
      if (!values.every((v) => BASE_VALUES[e.param].includes(v))) problems.push(`${where}: not a value of ${e.param} (${BASE_VALUES[e.param].join(', ')})`);
    }
  }
  for (const id of EXACT_TYPES) if (!types.nodes.some((n) => n.id === id)) problems.push(`exact type ${id} is not in types.json`);
  for (const [param, k] of Object.entries(IMPLIED_KIND)) {
    if (!sliceKeys.has(param)) problems.push(`implied kind: ${param} is not a facet`);
    if (!nodeIds.has(k)) problems.push(`implied kind: ${k} is not a type`);
  }

  // ---- write the shape ----
  const t = {};
  for (const e of kept) ((t[e.param] ??= {})[e.value] ??= []).push(e.phrase);
  const sorted = {};
  for (const p of Object.keys(t).sort()) {
    sorted[p] = {};
    for (const v of Object.keys(t[p]).sort()) sorted[p][v] = [...new Set(t[p][v])].sort();
  }
  const nodeLabel = new Map(types.nodes.map((n) => [n.id, n.label]));
  const l = {};
  const valueLabels = {
    'f.time': answers.TIME_LABELS, 'f.duration': answers.TIME_LABELS, 'f.time-on-site': answers.TIME_LABELS, 'f.price-band': answers.PRICE_LABELS, 'f.booking-needed': answers.BOOKING_LABELS,
    'f.walk-from-the-car': answers.WALK_LABELS, 'f.shape': answers.SHAPE_LABELS, 'f.best-time-of-day': answers.BEST_TIME_LABELS,
  };
  for (const [param, values] of Object.entries(sorted)) {
    if (param.startsWith('$')) continue;
    for (const value of Object.keys(values)) {
      const key = `${param}=${value}`;
      if (LABELS[key]) l[key] = LABELS[key];
      else if (param === 'k') l[key] = nodeLabel.get(value) ?? value;
      else if (param === 'effort') l[key] = value.split(',').map((x) => answers.EFFORT_LABELS[x]).join(', ');
      else if (LABELS[key]) l[key] = LABELS[key];
      else if (sliceKeys.has(param)) {
        const f = sliceKeys.get(param);
        l[key] = value === 'yes' ? f.label : `${f.label}: ${valueLabels[param]?.[value] ?? value}`;
      }
    }
  }
  for (const [param, f] of sliceKeys) l[param] = f.label;
  // Country names from the platform's own locale data, so a country that has trips and no places still has a name (the globe tree
  // names such a country by its code). Standard names plus the few extras of phrases.ts.
  const display = new Intl.DisplayNames(['en'], { type: 'region' });
  const countries = {};
  for (let a = 65; a <= 90; a += 1) for (let b = 65; b <= 90; b += 1) {
    const code = String.fromCharCode(a, b);
    let name;
    try { name = display.of(code); } catch { continue; }
    if (name && name !== code && !/unknown|european union|united nations|pseudo|outlying/i.test(name)) countries[code] = name;
  }
  const extra = { ...COUNTRY_EXTRA };
  for (const code of Object.values(extra)) if (!countries[code]) problems.push(`country extra: ${code} is not a country`);
  const body = { schema: 'search-vocab/1', t: sorted, l, south: [...SOUTH], implied: IMPLIED_KIND, c: countries, cx: extra };
  const v = createHash('sha1').update(JSON.stringify(body)).digest('hex').slice(0, 8);
  return { vocab: { schema: body.schema, v, ...body }, problems, entries: kept.length };
}

export const vocabText = (vocab) => `${JSON.stringify(vocab)}\n`;

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { vocab, problems, entries } = buildVocab({ types: read('data/vocab/types.json'), slice: read('web/lib/entities/facets/contract-slice.json') });
  const text = vocabText(vocab);
  if (process.argv.includes('--check')) {
    let bad = problems.length > 0;
    for (const p of problems) console.error(`search-vocab: ${p}`);
    let committed = '';
    try { committed = readFileSync(out, 'utf8'); } catch { /* missing */ }
    if (committed !== text) {
      console.error('search-vocab: web/public/search/vocab.json is out of date: run `node web/scripts/search-vocab.mjs`');
      bad = true;
    }
    if (bad) process.exit(1);
    console.log(`search-vocab: ok (${entries} words, ${gzipSync(text).length} bytes gzip)`);
  } else {
    if (problems.length) for (const p of problems) console.error(`search-vocab: ${p}`);
    mkdirSync(path.dirname(out), { recursive: true });
    writeFileSync(out, text);
    console.log(`search-vocab: wrote ${path.relative(root, out)}, ${entries} words, ${text.length} bytes, ${gzipSync(text).length} bytes gzip${problems.length ? `, ${problems.length} PROBLEMS` : ''}`);
  }
}
