// The places of a park for the arrival from a park page (STEP2-E3, README ruling C5; review STEP2-PRV PR-003). Pure: no network, no clock.
//
// Membership is the catalogue's named area, never a radius from the park's point: a 50 km circle round Banff National Park's point takes in
// Kananaskis Country (Barrier Lake, Nakiska, Troll Falls), Canmore and Kootenay, and misses Moraine Lake and Bow Lake, which are in the park.
// A light list row carries its area (`area`, `area_name`), so the rule reads only light data (P8) through the one data module (P9):
//   - the row's area is the park's own area (the park owns it: the area's name is the park's name, "Banff National Park"), or
//   - the row's area is named for the park ("Banff", "Kananaskis Village / Spray Valley" for Kananaskis Country), or
//   - the row's own name starts with the park's name ("Larch Valley to Sentinel Pass" for Larch Valley).
// A park whose area is an administrative one (Val Gardena in Bolzano, Smugglers' Notch in Lamoille County) never takes the whole area.
// Places whose area does not name the park (Peter Lougheed rows for Kananaskis Country) are left out: a missing member is safer than a
// wrong one, and the gap goes to the data plan (the review's report row).
import { ADD_NEARBY_KM } from '@travel/core/config/nearby.ts';
import type { TimelineModel } from '@/components/trips/timeline/model';
import type { Fit } from './fit';
import type { Found } from './place';
import { daysByDistance } from './rows';

/** The words a park's name shares with every park of its kind: what is left is the name a place's area is called by ("banff"). */
const GENERIC = /\b(?:national|provincial|state|regional|wilderness|parks?|country|forest|reserve|conservation|recreation|area|the|of|and)\b/g;

const fold = (s: string): string => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/** "Banff National Park" -> "banff", "Kananaskis Country" -> "kananaskis", "Mount Robson Provincial Park" -> "mount robson"; empty when nothing is left. */
export const parkStem = (name: string): string => fold(name).replace(GENERIC, ' ').replace(/\s+/g, ' ').trim();

/** The words a member read starts from: the park's name without the words every park shares. */
export const memberQuery = (park: Pick<Found, 'name'>): string | null => parkStem(park.name) || null;

const startsWithWords = (text: string, stem: string): boolean => text === stem || text.startsWith(`${stem} `);

/** True when the park's own area is the park (its name, folded, is the park's): only then does the area's slug stand for the park. */
export function ownsArea(park: Pick<Found, 'name' | 'area'>): boolean {
  const stem = parkStem(park.name);
  return !!stem && !!park.area && parkStem(park.area) === stem;
}

/** Whether a light row is a place in the park, by the rule above. The park itself, and other parks and areas, are never members. */
export function isParkMember(row: Pick<Found, 'slug' | 'kind' | 'name' | 'area' | 'areaSlug'>, park: Pick<Found, 'slug' | 'name' | 'area' | 'areaSlug'>): boolean {
  if (row.slug === park.slug || row.kind === 'area') return false;
  const stem = parkStem(park.name);
  if (!stem) return false;
  if (ownsArea(park) && park.areaSlug && row.areaSlug === park.areaSlug) return true;
  if (row.area && startsWithWords(fold(row.area), stem)) return true;
  return startsWithWords(fold(row.name), stem);
}

/** How many days a member is tried on: the nearest ones within the add radius. More would not change the answer and costs a schedule run each. */
export const FIT_DAYS = 3;

/** The days within ADD_NEARBY_KM of a point, nearest first, at most FIT_DAYS. */
export function nearDays(m: TimelineModel, p: { lat: number; lon: number } | null): { n: number; km: number }[] {
  if (!p) return [];
  return daysByDistance(m, p)
    .filter((d): d is { n: number; km: number } => d.km !== null && d.km <= ADD_NEARBY_KM)
    .slice(0, FIT_DAYS);
}

const RANK: Record<Fit['state'], number> = { fits: 0, tight: 1, fix: 2, full: 3 };

/** One member scored: the nearest day, and the day that fits it best (null when every near day is full). */
export interface Scored {
  nearest: { n: number; fit: Fit };
  best: { n: number; fit: Fit } | null;
}

/** The best day of those tried: the best fit state, then the nearest. A full day is never the best (it is the advice "try Day m"). */
export function scoreDays(tried: readonly { n: number; km: number; fit: Fit }[]): Scored | null {
  if (!tried.length) return null;
  const ok = tried.filter((t) => t.fit.state !== 'full');
  const best = [...ok].sort((a, b) => RANK[a.fit.state] - RANK[b.fit.state] || a.km - b.km || a.n - b.n)[0] ?? null;
  return { nearest: { n: tried[0]!.n, fit: tried[0]!.fit }, best: best ? { n: best.n, fit: best.fit } : null };
}

/** The second line and the button of a scored member (PR-003 (b)): the day named is always one the place fits, never a full one. */
export function scoredWords(s: Scored): { line: string; day: number | null; button: string } {
  if (!s.best) return { line: `Day ${s.nearest.n} is full, and so are the other days near it`, day: null, button: 'Pick a day' };
  if (s.best.n !== s.nearest.n && s.nearest.fit.state === 'full') return { line: `Day ${s.nearest.n} full: try Day ${s.best.n}`, day: s.best.n, button: `Add to Day ${s.best.n}` };
  return { line: s.best.fit.words, day: s.best.n, button: `Add to Day ${s.best.n}` };
}

/** Members grouped by the base of the day nearest them, in the trip's order; members near no day, then those on the trip already, last. */
export interface MemberGroup<T> {
  key: string;
  /** "Near Banff"; null for a single group (no heading of its own) */
  label: string;
  rows: T[];
}
export function groupByBase<T extends { day: number | null; on: boolean }>(rows: readonly T[], m: TimelineModel): MemberGroup<T>[] {
  const order: string[] = [];
  const by = new Map<string, { label: string; first: number; rows: T[] }>();
  const put = (key: string, label: string, first: number, r: T) => {
    let g = by.get(key);
    if (!g) {
      g = { label, first, rows: [] };
      by.set(key, g);
      order.push(key);
    }
    g.rows.push(r);
  };
  for (const r of rows) {
    if (r.on) put('on', 'Already on this trip', Infinity, r);
    else if (r.day === null) put('none', 'Not near any day of this trip', 1e9, r);
    else {
      const base = m.days.find((d) => d.n === r.day)?.base ?? null;
      const firstDay = base ? Math.min(...m.days.filter((d) => d.base === base).map((d) => d.n)) : r.day;
      put(base ? `base:${base}` : `day:${r.day}`, base ? `Near ${base}` : `Near Day ${r.day}`, firstDay, r);
    }
  }
  return order.map((k) => ({ key: k, ...by.get(k)! })).sort((a, b) => a.first - b.first).map(({ key, label, rows: rs }) => ({ key, label, rows: rs }));
}
