import { globeGazetteer } from '@/lib/client/data';
import type { SearchRecord } from '@/lib/search/types';
import type { CountryFacts } from './types';
import { classOfRow, type Box4, type FeatureFit } from './fit';

/** Gazetteer row: [kind, name, lon, lat, a3, extra, rank, population, aliases]; aliases are local and other-language spellings joined by `|`. */
export type GazRow = [string, string, number, number, string | null, string | null, number?, number?, string?, Box4?, string?];
export interface GazEntry { row: GazRow; n: string; /** Folded aliases: "Firenze" for Florence. */ alt?: string[] }

export type SearchAction =
  | { type: 'country'; a3: string }
  | { type: 'admin1'; a3: string; name: string; lng: number; lat: number }
  | { type: 'city'; a3: string | null; state: string | null; name: string; lng: number; lat: number; rank: number }
  | { type: 'feature'; name: string; lng: number; lat: number; rank: number; fit?: FeatureFit }
  | { type: 'place'; slug: string }
  | { type: 'trip'; slug: string };

export interface SearchHit { id: string; name: string; kindLabel: string; where: string; flag?: string; action: SearchAction }

export const norm = (s: string): string => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const KIND_LABEL: Record<string, string> = { country: 'Country', admin1: 'State or province', city: 'City', physical: 'Landform', marine: 'Sea or ocean', river: 'River' };
const KIND_ORDER: Record<string, number> = { country: 0, admin1: 1, city: 2, marine: 3, river: 3, physical: 4 };
/** The "Natural features" switch (`nf=0`): rivers, ranges, plains, deltas, seas and the rest of the landform rows. */
export const isNaturalRow = (kind: string): boolean => kind === 'physical' || kind === 'marine' || kind === 'river';

let gazPromise: Promise<GazEntry[]> | null = null;
export function loadGazetteer(): Promise<GazEntry[]> {
  return (gazPromise ??= globeGazetteer().then((rows) => (rows as unknown as GazRow[]).map((row) => ({ row, n: norm(row[1]), alt: row[8] ? row[8].split('|').map(norm) : [] }))));
}

export interface SearchSources {
  gazetteer: GazEntry[];
  /** Saved places and trips that match, already ranked by the site search (the globe holds no list of them). */
  own: SearchHit[];
  countriesByA3: Record<string, CountryFacts>;
}

/** A site-search record for a place or a trip as a globe hit; null for anything else. */
export function ownHit(r: SearchRecord): SearchHit | null {
  if (r.k === 'area') return null;
  const slug = r.h.split('/').filter(Boolean).pop();
  if (!slug) return null;
  const parts = r.s.split(' · ');
  return r.k === 'trip'
    ? { id: `trip:${slug}`, name: r.n, kindLabel: 'Trip', where: r.s, action: { type: 'trip', slug } }
    : { id: `place:${slug}`, name: r.n, kindLabel: parts[0] || 'Place', where: parts.slice(1).join(' · '), action: { type: 'place', slug } };
}

const score = (r: GazRow): number => KIND_ORDER[r[0]] * 10 + (r[0] === 'city' || isNaturalRow(r[0]) ? Math.min(9, r[6] ?? 9) : 0);

/** Saved places and trips first (they are what this site is about), then the gazetteer by kind and rank. */
export function search(q: string, src: SearchSources, limit = 12, o: { features?: boolean } = {}): SearchHit[] {
  const nq = norm(q.trim());
  if (!nq) return [];
  const starts: GazEntry[] = [], contains: GazEntry[] = [];
  const natural = o.features !== false;
  for (const e of src.gazetteer) {
    if (!natural && isNaturalRow(e.row[0])) continue;
    if (e.n.startsWith(nq) || (e.alt ?? []).some((a) => a.startsWith(nq))) starts.push(e);
    else if (nq.length >= 3 && (e.n.includes(nq) || (e.alt ?? []).some((a) => a.includes(nq)))) contains.push(e);
    if (starts.length > 400) break;
  }
  // A city beats an admin area of the same name ("Birmingham"): the admin result has no level page of its own to land on (review N3).
  // Done as a penalty on the admin row, not a pairwise tie-break, so the order stays a total order.
  const cityNames = new Set([...starts, ...contains].filter((e) => e.row[0] === 'city').map((e) => e.n));
  // A match through an alias only (an Antarctic base listed as "Italy") follows every match on a primary name.
  const aliasOnly = (e: GazEntry): boolean => !(e.n.startsWith(nq) || (nq.length >= 3 && e.n.includes(nq)));
  const rank = (e: GazEntry): number => score(e.row) + (e.row[0] === 'admin1' && cityNames.has(e.n) ? 15 : 0) + (aliasOnly(e) ? 40 : 0);
  const byScore = (a: GazEntry, b: GazEntry) => rank(a) - rank(b) || a.row[1].length - b.row[1].length;
  const gaz = [...starts.sort(byScore), ...contains.sort(byScore)].map((e) => toHit(e.row, src.countriesByA3));
  // Places, regions and cities first; landforms, seas and rivers last, however well their names match (9.8).
  const ordered = [...gaz.filter((h) => h.action.type !== 'feature'), ...gaz.filter((h) => h.action.type === 'feature')];
  return [...src.own.slice(0, 5), ...ordered].slice(0, limit);
}

function toHit(r: GazRow, byA3: Record<string, CountryFacts>): SearchHit {
  const c = r[4] ? byA3[r[4]] : undefined;
  const id = `${r[0]}:${r[1]}:${r[2]}:${r[3]}`;
  const kindLabel = KIND_LABEL[r[0]] ?? r[0];
  if (r[0] === 'country') return { id, name: r[1], kindLabel, where: r[5] ? `Capital ${r[5]}` : '', flag: c?.flag, action: { type: 'country', a3: r[4]! } };
  if (r[0] === 'admin1') return { id, name: r[1], kindLabel, where: c?.name ?? r[5] ?? '', action: { type: 'admin1', a3: r[4]!, name: r[1], lng: r[2], lat: r[3] } };
  if (r[0] === 'city') return { id, name: r[1], kindLabel, where: [r[5], c?.name].filter(Boolean).join(', '), action: { type: 'city', a3: r[4], state: r[5], name: r[1], lng: r[2], lat: r[3], rank: r[6] ?? 9 } };
  const rank = r[6] ?? 5;
  const fit: FeatureFit = { bbox: r[9] ?? null, lineId: r[10] ?? null, cls: classOfRow(r[0], r[5]), rank };
  return { id, name: r[1], kindLabel, where: r[5] ? String(r[5]).replace(/_/g, ' ').toLowerCase() : '', action: { type: 'feature', name: r[1], lng: r[2], lat: r[3], rank, fit } };
}

/** Zoom that suits a landform or sea of a given rank (0 is an ocean). */
export const zoomForRank = (rank: number): number => (rank <= 1 ? 2.2 : rank <= 3 ? 3.2 : rank <= 5 ? 4.5 : 6);

/**
 * The gazetteer row behind a river or sea picked off the basemap, by its name, so Fly here fits it and its own line can be drawn.
 * Exact name or alias only; null when the gazetteer holds no such feature (the pick then flies to its point, as before).
 */
export async function fitByName(name: string, sourceLayer: string): Promise<{ fit: FeatureFit; at: [number, number] } | null> {
  const want = sourceLayer === 'waterway' ? ['river'] : sourceLayer === 'water_name' ? ['marine', 'physical'] : [];
  if (!want.length) return null;
  const nq = norm(name);
  const gaz = await loadGazetteer();
  let best: GazEntry | null = null;
  for (const e of gaz) {
    if (!want.includes(e.row[0]) || !e.row[9]) continue;
    if (e.n !== nq && !(e.alt ?? []).includes(nq)) continue;
    if (!best || (e.row[6] ?? 9) < (best.row[6] ?? 9)) best = e;
  }
  if (!best) return null;
  const r = best.row;
  return { at: [r[2], r[3]], fit: { bbox: r[9] ?? null, lineId: r[10] ?? null, cls: classOfRow(r[0], r[5]), rank: r[6] ?? 5 } };
}
