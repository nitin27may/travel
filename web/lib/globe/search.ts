import { globeGazetteer } from '@/lib/client/data';
import type { SearchRecord } from '@/lib/search/types';
import type { CountryFacts } from './types';

/** Gazetteer row: [kind, name, lon, lat, a3, extra, rank, population]. */
export type GazRow = [string, string, number, number, string | null, string | null, number?, number?];
export interface GazEntry { row: GazRow; n: string }

export type SearchAction =
  | { type: 'country'; a3: string }
  | { type: 'admin1'; a3: string; name: string; lng: number; lat: number }
  | { type: 'city'; a3: string | null; state: string | null; name: string; lng: number; lat: number; rank: number }
  | { type: 'feature'; name: string; lng: number; lat: number; rank: number }
  | { type: 'place'; slug: string }
  | { type: 'trip'; slug: string };

export interface SearchHit { id: string; name: string; kindLabel: string; where: string; flag?: string; action: SearchAction }

export const norm = (s: string): string => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const KIND_LABEL: Record<string, string> = { country: 'Country', admin1: 'State or province', city: 'City', physical: 'Landform', marine: 'Sea or ocean' };
const KIND_ORDER: Record<string, number> = { country: 0, admin1: 1, city: 2, marine: 3, physical: 4 };

let gazPromise: Promise<GazEntry[]> | null = null;
export function loadGazetteer(): Promise<GazEntry[]> {
  return (gazPromise ??= globeGazetteer().then((rows) => (rows as GazRow[]).map((row) => ({ row, n: norm(row[1]) }))));
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

const score = (r: GazRow): number => KIND_ORDER[r[0]] * 10 + (r[0] === 'city' || r[0] === 'physical' || r[0] === 'marine' ? Math.min(9, r[6] ?? 9) : 0);

/** Saved places and trips first (they are what this site is about), then the gazetteer by kind and rank. */
export function search(q: string, src: SearchSources, limit = 12): SearchHit[] {
  const nq = norm(q.trim());
  if (!nq) return [];
  const starts: GazEntry[] = [], contains: GazEntry[] = [];
  for (const e of src.gazetteer) {
    if (e.n.startsWith(nq)) starts.push(e);
    else if (nq.length >= 3 && e.n.includes(nq)) contains.push(e);
    if (starts.length > 400) break;
  }
  // a city beats an admin area of the same name: the admin result has no level page of its own to land on (review round 3)
  const sameNameCityFirst = (a: GazEntry, b: GazEntry): number => (a.n === b.n && a.row[0] !== b.row[0] && (a.row[0] === 'city' || b.row[0] === 'city') && (a.row[0] === 'admin1' || b.row[0] === 'admin1') ? (a.row[0] === 'city' ? -1 : 1) : 0);
  const byScore = (a: GazEntry, b: GazEntry) => sameNameCityFirst(a, b) || score(a.row) - score(b.row) || a.row[1].length - b.row[1].length;
  const gaz = [...starts.sort(byScore), ...contains.sort(byScore)].map((e) => toHit(e.row, src.countriesByA3));
  return [...src.own.slice(0, 5), ...gaz].slice(0, limit);
}

function toHit(r: GazRow, byA3: Record<string, CountryFacts>): SearchHit {
  const c = r[4] ? byA3[r[4]] : undefined;
  const id = `${r[0]}:${r[1]}:${r[2]}:${r[3]}`;
  const kindLabel = KIND_LABEL[r[0]] ?? r[0];
  if (r[0] === 'country') return { id, name: r[1], kindLabel, where: r[5] ? `Capital ${r[5]}` : '', flag: c?.flag, action: { type: 'country', a3: r[4]! } };
  if (r[0] === 'admin1') return { id, name: r[1], kindLabel, where: c?.name ?? r[5] ?? '', action: { type: 'admin1', a3: r[4]!, name: r[1], lng: r[2], lat: r[3] } };
  if (r[0] === 'city') return { id, name: r[1], kindLabel, where: [r[5], c?.name].filter(Boolean).join(', '), action: { type: 'city', a3: r[4], state: r[5], name: r[1], lng: r[2], lat: r[3], rank: r[6] ?? 9 } };
  return { id, name: r[1], kindLabel, where: r[5] ? String(r[5]).replace(/_/g, ' ').toLowerCase() : '', action: { type: 'feature', name: r[1], lng: r[2], lat: r[3], rank: r[6] ?? 5 } };
}

/** Zoom that suits a landform or sea of a given rank (0 is an ocean). */
export const zoomForRank = (rank: number): number => (rank <= 1 ? 2.2 : rank <= 3 ? 3.2 : rank <= 5 ? 4.5 : 6);
