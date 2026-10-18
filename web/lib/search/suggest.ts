import { normalize } from './normalize';
import type { SearchRecord } from './types';

/** What to offer when a query matches nothing: a filtered Places list, or the one word that does match. */
export interface Suggestion {
  label: string;
  /** A page to open. */
  href?: string;
  /** Or a replacement query to run in the box. */
  query?: string;
}

const KIND_WORDS: Record<string, [kind: string, noun: string]> = {
  trail: ['trail', 'trails'], trails: ['trail', 'trails'], hike: ['trail', 'trails'], hikes: ['trail', 'trails'], hiking: ['trail', 'trails'], walk: ['trail', 'trails'], walks: ['trail', 'trails'],
  lake: ['lake', 'lakes'], lakes: ['lake', 'lakes'],
  viewpoint: ['viewpoint', 'viewpoints'], viewpoints: ['viewpoint', 'viewpoints'], view: ['viewpoint', 'viewpoints'], views: ['viewpoint', 'viewpoints'],
  waterfall: ['waterfall', 'waterfalls'], waterfalls: ['waterfall', 'waterfalls'], falls: ['waterfall', 'waterfalls'],
  town: ['town', 'towns'], towns: ['town', 'towns'], city: ['town', 'towns'], cities: ['town', 'towns'],
  lift: ['lift', 'lifts'], lifts: ['lift', 'lifts'], gondola: ['lift', 'lifts'],
};
const KID_WORDS = new Set(['family', 'families', 'kid', 'kids', 'child', 'children', 'toddler', 'toddlers']);
const FILLER = new Set(['in', 'for', 'with', 'near', 'the', 'a', 'to', 'and', 'friendly', 'good', 'best', 'easy']);

const code = (r: SearchRecord) => /^\/globe\/([a-z]{2})\/$/.exec(r.h)?.[1]?.toUpperCase();

/**
 * "family trail italy" has no record that holds all three words, but it is a clear question: kids, trails, Italy. This reads
 * the words the Places list can filter on (a country from the area records, a kind, kids) and links to that filtered list.
 * With none of those it falls back to the single word that matches the most records, as a replacement query.
 */
export function suggest(query: string, records: readonly SearchRecord[], count: (q: string) => number): Suggestion | null {
  const toks = normalize(query).split(' ').filter(Boolean);
  if (!toks.length) return null;
  const countries = records.filter((r) => r.k === 'area' && code(r));
  let country: { code: string; name: string } | null = null;
  let kind: [string, string] | null = null;
  let kids = false;
  const left: string[] = [];
  for (const t of toks) {
    const c: SearchRecord | undefined = !country && t.length >= 3 ? countries.find((r) => normalize(r.n) === t || normalize(r.n).startsWith(t)) : undefined;
    if (c) { country = { code: code(c)!, name: c.n }; continue; }
    if (!kind && KIND_WORDS[t]) { kind = KIND_WORDS[t]; continue; }
    if (KID_WORDS.has(t)) { kids = true; continue; }
    if (!FILLER.has(t)) left.push(t);
  }
  if ((country || kind || kids) && left.length === 0) {
    const p = new URLSearchParams();
    if (country) p.set('country', country.code);
    if (kind) p.set('kind', kind[0]);
    if (kids) p.set('kid', 'yes');
    const what = kind ? kind[1] : 'places';
    return { label: `${kids ? 'Kid-friendly ' : ''}${what}${country ? ` in ${country.name}` : ''}: open the filtered Places list`, href: `/places/?${p.toString()}` };
  }
  const best = toks.map((t) => ({ t, n: count(t) })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n)[0];
  return best ? { label: `Search “${best.t}” instead (${best.n} ${best.n === 1 ? 'match' : 'matches'})`, query: best.t } : null;
}
