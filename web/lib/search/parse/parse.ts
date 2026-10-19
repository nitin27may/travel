// The query parser (smart-search section 4). Pure: parse(q, vocab, records) has no I/O and no clock, so a server can run it unchanged.
// Pipeline: normalise -> names after "in/near" -> figures -> vocabulary phrases (longest first) -> names without a preposition -> resolve.
import { normalize } from '@/lib/search/normalize';
import type { SearchRecord } from '@/lib/search/types';
import { indexNames, placeArea, resolveName } from './areas';
import type { Area, NameHit } from './areas';
import {
  DECISIONS, CLIMB_BANDS, CLIMB_WORDS, HUB_MAX, KID_AGES, LENGTH_BANDS, TIME_BANDS, TRIP_EFFORT, TRIP_LENGTH_LABEL, figure, lengthClass, monthRange, monthShort, oneEdit, pickBands, splitFused, tripAge,
} from './grammar';
import type { BandPick, Mod } from './grammar';
import { hrefFor } from './href';
import { MAX_WORDS, singular, singularPhrase } from './words';
import type { Chip, DidYouMean, ParseOptions, ParsedQuery, VocabFile } from './types';

interface Entry { param: string; value: string }
interface Index {
  map: Map<string, Entry[]>;
  /** Single words of five letters or more that a typo can be matched to (A13). */
  words: string[];
  south: Set<string>;
  countries: Map<string, string>;
}

/** One thing the words said, before it becomes a chip. `weak` is a reading that gives way to a stronger one (A2). */
interface Raw { param: string; value: string; from: number; to: number; label?: string; weak?: boolean }
interface Where { area: Area; others: Area[]; from: number; to: number; place?: SearchRecord }
interface Span { text: string; from: number; to: number }

const vocabCache = new WeakMap<VocabFile, Index>();

function indexVocab(v: VocabFile): Index {
  const hit = vocabCache.get(v);
  if (hit) return hit;
  const map = new Map<string, Entry[]>();
  const words = new Set<string>();
  for (const [param, values] of Object.entries(v.t)) {
    for (const [value, phrases] of Object.entries(values)) {
      for (const p of phrases) {
        const l = map.get(p);
        if (l) l.push({ param, value });
        else map.set(p, [{ param, value }]);
        if (!param.startsWith('$') && !p.includes(' ') && p.length >= 5) words.add(p);
      }
    }
  }
  const countries = new Map<string, string>();
  for (const [code, name] of Object.entries(v.c)) countries.set(normalize(name), code);
  for (const [name, code] of Object.entries(v.cx)) countries.set(name, code);
  const ix: Index = { map, words: [...words], south: new Set(v.south), countries };
  vocabCache.set(v, ix);
  return ix;
}

/** A phrase as typed, then with its last word made singular: `lakes` finds `lake`, and `falls` is found before `fall` (A4). */
const lookup = (ix: Index, phrase: string): Entry[] | undefined => ix.map.get(phrase) ?? ix.map.get(singularPhrase(phrase));

const TRIPS_ONLY = ['length', 'around', 'shape', 'perday', 'drive'];
const MULTI = new Set(['k', 'season', 'effort', 'f.length', 'f.climb', 'f.time', 'f.duration']);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const uniq = <T,>(a: T[]) => [...new Set(a)];
const without = (f: Record<string, string[]>, keys: string[]) => Object.fromEntries(Object.entries(f).filter(([k]) => !keys.includes(k)));

function tokenize(q: string): string[] {
  return normalize(q.replace(/(\d)[.,](\d)/g, '$1dot$2')).split(' ').filter(Boolean).flatMap(splitFused);
}

function bandLabel(pick: BandPick, mod: Mod, v: number, unit: string): string {
  const edge = unit === 'h' ? `${pick.edge / 60} hours` : `${pick.edge} ${unit === 'mi' ? 'km' : unit}`;
  const figureText = `${v} ${unit}`;
  if (mod === 'max') return pick.exact ? `Under ${figureText}` : `Up to ${edge} (nearest band)`;
  if (mod === 'min') return pick.exact ? `${figureText} and more` : `From ${edge} (nearest band)`;
  return `${pick.label} (band for ${figureText})`;
}

function seasonMonths(season: string, south: boolean): number[] {
  const north: Record<string, number[]> = { spring: [3, 4, 5], summer: [6, 7, 8], autumn: [9, 10, 11], winter: [12, 1, 2] };
  const flip: Record<string, string> = { spring: 'autumn', autumn: 'spring', summer: 'winter', winter: 'summer' };
  return north[south ? flip[season]! : season] ?? [];
}

/**
 * Reads a human query as filters. `records` are the records of the search index (all kinds): the parser takes area names, place names
 * and trip names from them and loads nothing itself.
 */
export function parse(query: string, vocab: VocabFile, records: readonly SearchRecord[], opts: ParseOptions = {}, typos = true): ParsedQuery {
  const ix = indexVocab(vocab);
  const names = indexNames(records);
  const toks = tokenize(query);
  const n = toks.length;
  const dropped = new Set(opts.dropped ?? []);

  const filler = (w: string) => ix.map.get(w)?.some((e) => e.param === '$filler') ?? false;
  const isLoc = (p: string) => ix.map.get(p)?.some((e) => e.param === '$loc') ?? false;
  const unit = (w: string | undefined) => (w === undefined ? undefined : (ix.map.get(w) ?? ix.map.get(singular(w)))?.find((e) => e.param === '$unit')?.value);
  const monthOf = (w: string | undefined) => (w === undefined ? undefined : ix.map.get(w)?.find((e) => e.param === '$month')?.value);

  // A1: a name beats a parse. The whole query, or the whole query minus filler, is a name of a trip, a place or an area.
  const content = toks.filter((w) => !filler(w)).join(' ');
  if (content && !dropped.size && (names.names.has(content) || names.names.has(toks.join(' ')))) {
    return { target: 'search', chips: [], q: toks.join(' '), unused: [], notYet: [], didYouMean: [], href: '', facets: {}, vocab: vocab.v };
  }

  const used: boolean[] = new Array(n).fill(false);
  const isFree = (i: number, j: number) => j <= n && !used.slice(i, j).some(Boolean);
  const claim = (i: number, j: number) => used.fill(true, i, j);
  const raws: Raw[] = [];
  const wheres: Where[] = [];
  const placeLike: Span[] = [];
  const notYet: string[] = [];
  const conflicts: { phrase: string; entries: Entry[] }[] = [];

  const modAt = (i: number): { mod: Mod; len: number } | null => {
    for (let l = Math.min(3, n - i); l >= 1; l -= 1) {
      const e = ix.map.get(toks.slice(i, i + l).join(' '))?.find((x) => x.param === '$mod');
      if (e) return { mod: e.value as Mod, len: l };
    }
    return null;
  };
  const numAt = (i: number): number | null => {
    const w = toks[i];
    if (!w) return null;
    const f = figure(w);
    if (f !== null) return f;
    const word = ix.map.get(w)?.find((e) => e.param === '$num');
    if (word) return Number(word.value);
    // "a week", "an hour": an article is one only before a unit of time
    return (w === 'a' || w === 'an') && ['h', 'week'].includes(unit(toks[i + 1]) ?? '') ? 1 : null;
  };
  /** A name from the index, or a country the globe tree names by its code (Switzerland has trips and no places). */
  const nameAt = (text: string, prefix: boolean): NameHit | null => {
    const hit = resolveName(names, text, prefix);
    if (hit) return hit;
    const code = ix.countries.get(text);
    if (!code) return null;
    const rec: SearchRecord = { k: 'area', h: `/globe/${code.toLowerCase()}/`, n: vocab.c[code]!, s: 'Country', x: '' };
    return { kind: 'area', area: { rec, path: [code.toLowerCase()], norm: text, places: 0 }, others: [] };
  };
  const addWhere = (hit: NameHit, from: number, to: number, text: string) => {
    if (hit.kind === 'area') wheres.push({ area: hit.area, others: hit.others, from, to });
    else if (hit.kind === 'place') {
      const a = placeArea(names, hit.rec);
      if (a) wheres.push({ area: a, others: [], from, to, place: hit.rec });
      else placeLike.push({ text, from, to });
    } else placeLike.push({ text, from, to });
  };

  // ---- names after a preposition: "near Lake Louise" must win over the word "lake" (A5, A6) ----
  for (let i = 0; i < n; i += 1) {
    if (used[i]) continue;
    for (const pl of [2, 1]) {
      if (i + pl > n || !isLoc(toks.slice(i, i + pl).join(' '))) continue;
      const j = i + pl + (toks[i + pl] === 'the' ? 1 : 0);
      let found = false;
      for (let len = Math.min(4, n - j); len >= 1 && !found; len -= 1) {
        if (!isFree(j, j + len)) continue;
        const text = toks.slice(j, j + len).join(' ');
        // a prefix may not catch an ordinary vocabulary word ("in parking")
        const hit = nameAt(text, len > 1 || !lookup(ix, text));
        if (!hit) continue;
        claim(i, j + len);
        addWhere(hit, i, j + len, text);
        found = true;
      }
      if (found) break;
    }
  }

  // ---- figures: ages, distances, climbs, hours, nights, the drive from Toronto ----
  for (let i = 0; i < n; i += 1) {
    if (used[i]) continue;
    if (toks[i] === 'from' && toks[i + 1] === 'toronto') {
      let j = i + 2;
      const m = modAt(j);
      if (m) j += m.len;
      const v = numAt(j);
      if (v !== null && unit(toks[j + 1]) === 'h') {
        claim(i, j + 2);
        const top = Math.min(HUB_MAX, Math.max(1, Math.ceil(v)));
        const ids = m?.mod === 'min' ? Array.from({ length: HUB_MAX - top + 1 }, (_, k) => top + k) : m?.mod === 'max' ? Array.from({ length: top }, (_, k) => k + 1) : [top];
        raws.push({ param: 'drive', value: ids.map((k) => `toronto-${k}`).join(','), from: i, to: j + 2, label: `From Toronto: ${m?.mod === 'max' ? 'under' : m?.mod === 'min' ? 'over' : 'about'} ${v} hour${v === 1 ? '' : 's'}` });
      } else {
        // a hub with no time: it sends the parse to Trips but sets nothing, so it is shown as not used
        claim(i, i + 2);
        raws.push({ param: 'drive', value: '', from: i, to: i + 2 });
      }
      continue;
    }
    if (['age', 'aged', 'ages'].includes(toks[i]!) && numAt(i + 1) !== null) {
      claim(i, i + 2);
      raws.push({ param: 'kid', value: String(numAt(i + 1)), from: i, to: i + 2 });
      continue;
    }
    const m = modAt(i);
    const j = i + (m?.len ?? 0);
    const mod = m?.mod ?? null;
    const v = numAt(j);
    if (v === null) continue;
    const un = unit(toks[j + 1]);
    const end = j + 2;
    if (un === 'km' || un === 'mi') {
      const pick = pickBands(LENGTH_BANDS, mod, un === 'mi' ? v * 1.609 : v);
      if (!pick) continue;
      claim(i, end);
      raws.push({ param: 'f.length', value: pick.ids.join(','), from: i, to: end, label: bandLabel(pick, mod, v, un) });
    } else if (un === 'm' && CLIMB_WORDS.includes(toks[end] ?? '')) {
      const pick = pickBands(CLIMB_BANDS, mod, v);
      if (!pick) continue;
      claim(i, end + 1);
      raws.push({ param: 'f.climb', value: pick.ids.join(','), from: i, to: end + 1, label: bandLabel(pick, mod, v, 'm') });
    } else if (un === 'h') {
      const pick = pickBands(TIME_BANDS, mod, v * 60);
      if (!pick) continue;
      claim(i, end);
      raws.push({ param: '$duration', value: pick.ids.join(','), from: i, to: end, label: bandLabel(pick, mod, v, 'h') });
    } else if (un === 'age' && !mod) {
      const stop = end + (toks[end] === 'old' ? 1 : 0);
      claim(i, stop);
      raws.push({ param: 'kid', value: String(v), from: i, to: stop });
    } else if ((un === 'night' || un === 'day' || un === 'week') && !mod && !(un === 'day' && toks[end]?.startsWith('trip'))) {
      claim(i, end);
      raws.push({ param: 'length', value: lengthClass(un === 'night' ? v : un === 'day' ? v - 1 : v * 7), from: i, to: end });
    }
  }

  // ---- vocabulary phrases, longest first ----
  for (let i = 0; i < n; i += 1) {
    if (used[i]) continue;
    for (let len = Math.min(MAX_WORDS, n - i); len >= 1; len -= 1) {
      if (!isFree(i, i + len)) continue;
      const phrase = toks.slice(i, i + len).join(' ');
      const es = lookup(ix, phrase);
      const real = es?.filter((e) => !['$mod', '$num', '$unit'].includes(e.param));
      if (!real?.length) continue;
      const canonical = ix.map.has(phrase) ? phrase : singularPhrase(phrase);
      // A2: one phrase with two values of one key cancels itself and is offered instead
      const dup = real.filter((e) => !e.param.startsWith('$') && real.some((o) => o.param === e.param && o.value !== e.value));
      if (dup.length) conflicts.push({ phrase: canonical, entries: dup });
      else {
        const shared = real.some((e) => e.param !== 'k' && !e.param.startsWith('$'));
        let end = i + len;
        for (const e of real) {
          if (e.param === '$filler' || e.param === '$loc') continue;
          if (e.param === '$relevance') notYet.push(canonical);
          else if (e.param === '$month') {
            // "june to august", "june-august": a range
            let k = end;
            if (['to', 'through', 'until', 'till'].includes(toks[k] ?? '')) k += 1;
            const next = monthOf(toks[k]);
            if (next && isFree(k, k + 1)) {
              for (const mo of monthRange(Number(e.value), Number(next))) raws.push({ param: 'season', value: String(mo), from: i, to: k + 1 });
              end = k + 1;
            } else raws.push({ param: 'season', value: e.value, from: i, to: end });
          } else raws.push({ param: e.param, value: e.value, from: i, to: end, weak: e.param === 'k' && shared });
        }
        claim(i, end);
        i = end - 1;
        break;
      }
      claim(i, i + len);
      break;
    }
  }

  // ---- names without a preposition (full name only), then a place we do not know after a preposition ----
  for (let i = 0; i < n; i += 1) {
    if (used[i]) continue;
    for (let len = Math.min(4, n - i); len >= 1; len -= 1) {
      if (!isFree(i, i + len)) continue;
      const text = toks.slice(i, i + len).join(' ');
      const hit = nameAt(text, false);
      if (!hit || hit.kind === 'feature') continue;
      claim(i, i + len);
      addWhere(hit, i, i + len, text);
      break;
    }
  }
  for (let i = 0; i < n; i += 1) {
    if (!used[i] || !isLoc(toks[i]!) || wheres.some((w) => w.from === i) || placeLike.some((p) => p.from === i)) continue;
    const j = i + 1 + (toks[i + 1] === 'the' ? 1 : 0);
    let k = j;
    while (k < n && !used[k]) k += 1;
    if (k > j) placeLike.push({ text: toks.slice(j, k).join(' '), from: i, to: k });
  }
  for (const p of placeLike) claim(p.from, p.to);

  // ---- resolve: which list, then one chip per kind of constraint ----
  const has = (f: (r: Raw) => boolean) => raws.some(f);
  const tripsSignal = has((r) => TRIPS_ONLY.includes(r.param) || r.param === '$trips');
  const placesSignal = has((r) => (r.param === 'k' && !r.weak) || r.param.startsWith('f.') || r.param === '$duration' || (r.param === 'stroller' && r.value === 'all-terrain'));
  const target: 'places' | 'trips' = opts.target ?? (tripsSignal && !placesSignal ? 'trips' : 'places');
  const offerTrips = !opts.target && tripsSignal && placesSignal;
  const otherList = (r: Raw) => (target === 'places' ? TRIPS_ONLY.includes(r.param) : r.param === 'k' || r.param.startsWith('f.') || r.param === '$duration');

  const chips: Chip[] = [];
  const facets: Record<string, string[]> = {};
  const lefts: Span[] = [];
  const q: string[] = [];
  const dym = { area: [] as DidYouMean[], scope: [] as DidYouMean[], typo: [] as DidYouMean[], place: [] as DidYouMean[], list: [] as DidYouMean[] };
  const text = (a: number, b: number) => toks.slice(a, b).join(' ');
  const lab = (param: string, value: string) => vocab.l[`${param}=${value}`] ?? vocab.l[param] ?? value;
  const addChip = (c: Chip) => {
    if (dropped.has(c.id)) return;
    chips.push(c);
    for (const [k, v] of Object.entries(c.set)) facets[k] = v;
  };
  const span = (rs: Raw[]): [number, number] => [Math.min(...rs.map((r) => r.from)), Math.max(...rs.map((r) => r.to))];
  const countryName = (cc: string) => names.byPath.get(cc.toLowerCase())?.rec.n.length === 2 ? (vocab.c[cc.toUpperCase()] ?? cc) : (names.byPath.get(cc.toLowerCase())?.rec.n ?? vocab.c[cc.toUpperCase()] ?? cc);
  const areaLabel = (a: Area): string => {
    if (a.path.length < 2) return a.path.length === 1 ? countryName(a.path[0]!) : a.rec.n;
    const parent = a.path.length === 2 ? countryName(a.path[0]!) : (names.byPath.get(a.path.slice(0, -1).join('/'))?.rec.n ?? '');
    return parent ? `${a.rec.n}, ${parent}` : a.rec.n;
  };
  const setOf = (a: Area): Record<string, string[]> => {
    const set: Record<string, string[]> = { country: [a.path[0]!.toUpperCase()] };
    if (target === 'places') {
      if (a.path[1]) set.region = [a.path[1]];
      if (a.path[2]) set.area = [a.path[2]];
    }
    return set;
  };

  // where
  let country: string | null = null;
  const places = uniq(wheres.map((w) => w.area.path[0]!));
  if (places.length > 1) {
    // A12: two countries cannot both hold: apply neither and offer each
    for (const w of wheres) lefts.push({ text: text(w.from, w.to), from: w.from, to: w.to });
    for (const w of wheres) dym.area.push({ label: areaLabel(w.area), href: hrefFor(target, setOf(w.area), '') });
  } else if (wheres.length) {
    const w = wheres[0]!;
    country = w.area.path[0]!.toUpperCase();
    let label = areaLabel(w.area);
    if (target === 'trips' && w.area.path.length > 1) {
      // trips have no region facet: the country is applied and the name stays as text (A6)
      q.push(normalize(w.area.rec.n));
      label = `${countryName(country)} (“${w.area.rec.n}” as text)`;
    }
    const alternatives = w.others.slice(0, 3).map((o): Chip => ({ id: 'where', label: areaLabel(o), set: setOf(o), words: [w.from, w.to] }));
    addChip({ id: 'where', label: w.place ? `${label} (near ${w.place.n})` : label, set: setOf(w.area), words: [w.from, w.to], alternatives: alternatives.length ? alternatives : undefined });
    for (const a of alternatives.slice(0, 2)) dym.area.push({ label: a.label, href: hrefFor(target, { ...without(facets, ['country', 'region', 'area']), ...a.set }, '') });
  }
  const south = country !== null && ix.south.has(country);

  const live = raws.filter((r) => r.param !== '$trips');
  for (const r of live.filter(otherList)) if (r.value) lefts.push({ text: text(r.from, r.to), from: r.from, to: r.to });
  const by = new Map<string, Raw[]>();
  for (const r of live.filter((x) => !otherList(x) && (x.value !== '' || x.param === 'kid'))) by.set(r.param, [...(by.get(r.param) ?? []), r]);

  // kind
  const kinds = by.get('k') ?? [];
  const strong = kinds.filter((r) => !r.weak);
  const kChosen = strong.length ? strong : kinds;
  if (kChosen.length) {
    const vals = uniq(kChosen.map((r) => r.value));
    addChip({ id: 'k', label: vals.map((v) => lab('k', v)).join(', '), set: { k: vals }, words: span(kChosen) });
  }
  const kindNow = () => facets.k ?? [];

  // scoped facets
  for (const [param, rs] of by) {
    if (!param.startsWith('f.')) continue;
    const vals = uniq(rs.flatMap((r) => r.value.split(',')));
    const label = rs.find((r) => r.label)?.label ?? (vals.length > 1 ? `${vocab.l[param] ?? param}: ${vals.map((v) => lab(param, v).replace(/^[^:]*: /, '')).join(' or ')}` : lab(param, vals[0]!));
    const need = vocab.implied[param];
    if (need && !kindNow().length && !dropped.has('k')) addChip({ id: 'k', label: lab('k', need), set: { k: [need] }, words: span(rs), implied: true });
    addChip({ id: param, label, set: { [param]: MULTI.has(param) ? vals : [vals[0]!] }, words: span(rs) });
  }
  // a duration reads Time on a trail and Duration on an activity (A7); with no kind it waits for a choice
  const dur = by.get('$duration');
  if (dur) {
    const vals = uniq(dur.flatMap((r) => r.value.split(',')));
    const ks = kindNow();
    const param = ks.some((k) => k.startsWith('nature.trail') || k.startsWith('nature.trek')) ? 'f.time' : ks.length ? 'f.duration' : null;
    const label = dur.find((r) => r.label)?.label ?? vals.map((v) => TIME_BANDS.find((b) => b[0] === v)![1]).join(' or ');
    const at = span(dur);
    if (param) addChip({ id: param, label: `${param === 'f.time' ? 'Time' : 'Duration'}: ${label}`, set: { [param]: vals }, words: at });
    else {
      lefts.push({ text: text(at[0], at[1]), from: at[0], to: at[1] });
      dym.scope.push({ label: `${label}, hikes`, href: hrefFor('places', { ...facets, k: ['nature.trail'], 'f.time': vals }, '') });
      dym.scope.push({ label: `${label}, activities`, href: hrefFor('places', { ...facets, k: ['intent:do'], 'f.duration': vals }, '') });
    }
  }

  // people and access
  const kid = by.get('kid');
  const noAge = { ...DECISIONS.kidsWithoutAge, ...opts.decisions?.kidsWithoutAge };
  // A9, Q40: a party word with no age. A question chip sets nothing until an age is picked.
  const askAge = (at: [number, number], ages: readonly number[]) => {
    if (!dropped.has('kid')) chips.push({ id: 'kid', label: 'With kids: how old is the youngest?', set: {}, words: at, ask: true, alternatives: ages.map((a) => ({ id: 'kid', label: target === 'trips' ? `A child of ${a}` : `Youngest child ${a}`, set: { kid: [String(a)] }, words: at })) });
  };
  if (kid) {
    const ages = kid.filter((r) => r.value !== 'yes');
    const at = span(kid);
    if (target === 'places') {
      if (ages.length) {
        const youngest = ages.reduce((a, b) => (Number(b.value) < Number(a.value) ? b : a));
        addChip({ id: 'kid', label: vocab.l[`kid=${youngest.value}`] ?? `Youngest child ${youngest.value}`, set: { kid: [youngest.value] }, words: [youngest.from, youngest.to] });
      } else if (noAge.places === 'yes') addChip({ id: 'kid', label: lab('kid', 'yes'), set: { kid: ['yes'] }, words: at });
      else if (noAge.places === 'ask') askAge(at, [0, 2, 4, 6, 8, 10, 12]);
      else lefts.push({ text: text(at[0], at[1]), from: at[0], to: at[1] });
    } else if (ages.length) {
      const age = tripAge(Math.min(...ages.map((r) => Number(r.value))));
      if (age === null) lefts.push({ text: text(at[0], at[1]), from: at[0], to: at[1] });
      else addChip({ id: 'kid', label: `A child of ${age}`, set: { kid: [String(age)] }, words: at });
    } else if (noAge.trips === 'ask') askAge(at, KID_AGES);
    else lefts.push({ text: text(at[0], at[1]), from: at[0], to: at[1] });
  }
  const stroller = by.get('stroller');
  if (stroller) {
    const v = stroller.some((r) => r.value === 'all-terrain') ? 'all-terrain' : 'any';
    const at = span(stroller);
    if (target === 'places') addChip({ id: 'stroller', label: lab('stroller', v), set: { stroller: [v] }, words: at });
    else if (v === 'any') addChip({ id: 'stroller', label: 'Stroller-friendly', set: { stroller: ['friendly'] }, words: at });
    else lefts.push({ text: text(at[0], at[1]), from: at[0], to: at[1] });
  }
  const effort = by.get('effort');
  if (effort) {
    const vals = uniq(effort.flatMap((r) => r.value.split(',')));
    if (target === 'places') addChip({ id: 'effort', label: vals.length === 2 && vals[0] === 'stroll' && vals[1] === 'easy' ? lab('effort', 'stroll,easy') : vals.map((v) => lab('effort', v)).join(', '), set: { effort: vals }, words: span(effort) });
    else {
      const tv = uniq(vals.map((v) => TRIP_EFFORT[v]!));
      addChip({ id: 'effort', label: tv.map(cap).join(' or '), set: { effort: tv }, words: span(effort) });
    }
  }
  // time of year
  const monthRs = by.get('season') ?? [];
  const seasonRs = by.get('$season') ?? [];
  const months = uniq([...monthRs.map((r) => Number(r.value)), ...seasonRs.flatMap((r) => seasonMonths(r.value, south))]);
  if (months.length) {
    const name = (m: number) => cap([...(vocab.t.$month?.[String(m)] ?? [String(m)])].sort((a, b) => b.length - a.length)[0]!);
    const contiguous = months.every((m, i) => i === 0 || m === (months[i - 1]! % 12) + 1);
    const range = months.length > 2 && contiguous ? `${name(months[0]!)} to ${name(months[months.length - 1]!)}` : months.map(name).join(', ');
    const label = seasonRs.length && !monthRs.length ? `${cap(seasonRs[0]!.value)}, ${monthShort(months[0]!)} to ${monthShort(months[months.length - 1]!)}` : range;
    addChip({ id: 'season', label, set: { season: months.map(String) }, words: span([...monthRs, ...seasonRs]) });
  }
  // trips
  for (const key of ['length', 'around', 'shape', 'drive']) {
    const rs = by.get(key);
    if (!rs || target !== 'trips') continue;
    const vals = uniq(rs.flatMap((r) => r.value.split(',')));
    const label = rs.find((r) => r.label)?.label ?? (key === 'length' ? vals.map((v) => TRIP_LENGTH_LABEL[v] ?? v).join(' or ') : vals.map((v) => lab(key, v)).join(' or '));
    addChip({ id: key, label, set: { [key]: key === 'length' || key === 'shape' ? [vals[0]!] : vals }, words: span(rs) });
  }

  // ---- the words nobody used (H3), typos (A13), and what holds a place we do not know (A5) ----
  for (let i = 0; i < n; ) {
    if (used[i] || filler(toks[i]!)) { i += 1; continue; }
    let k = i;
    while (k < n && !used[k] && !filler(toks[k]!)) k += 1;
    lefts.push({ text: text(i, k), from: i, to: k });
    q.push(text(i, k));
    i = k;
  }
  // a suggestion is parsed without its own suggestions, so one typo cannot lead to another
  for (const l of typos ? lefts : []) {
    if (l.to - l.from !== 1 || l.text.length < 5) continue;
    const fix = ix.words.find((c) => oneEdit(l.text, c));
    if (fix) dym.typo.push({ label: fix, href: parse(toks.map((t, i) => (i === l.from ? fix : t)).join(' '), vocab, records, opts, false).href });
  }
  for (const p of placeLike) {
    lefts.push(p);
    const holds = (r: SearchRecord) => normalize(r.n).split(' ').includes(p.text) || normalize(r.n).includes(p.text);
    for (const t of names.trips.filter(holds).slice(0, 2)) dym.place.push({ label: `${t.n} (trip)`, href: t.h });
    for (const a of names.list.filter((x) => x.path.length <= 2 && holds(x.rec)).slice(0, 2)) dym.place.push({ label: areaLabel(a), href: hrefFor(target, { ...without(facets, ['country', 'region', 'area']), ...setOf(a) }, '') });
  }
  if (offerTrips) dym.list.push({ label: 'Search trips instead', href: parse(query, vocab, records, { ...opts, target: 'trips' }, false).href });
  for (const c of conflicts) for (const e of c.entries.slice(0, 2)) dym.scope.push({ label: `${c.phrase}: ${lab(e.param, e.value)}`, href: hrefFor(target, { ...facets, [e.param]: [e.value] }, q.join(' ')) });

  const qText = q.join(' ');
  chips.sort((a, b) => a.words[0] - b.words[0]);
  const seen = new Set<string>();
  const didYouMean = [...dym.area, ...dym.scope, ...dym.typo, ...dym.place, ...dym.list].filter((d) => !seen.has(d.label + d.href) && seen.add(d.label + d.href)).slice(0, 3);
  return {
    target,
    chips,
    q: qText,
    unused: uniq(lefts.sort((a, b) => a.from - b.from).map((l) => l.text)),
    notYet: uniq(notYet),
    didYouMean,
    href: hrefFor(target, facets, qText),
    facets,
    vocab: vocab.v,
  };
}


