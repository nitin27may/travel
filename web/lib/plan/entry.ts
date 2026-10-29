// The ways into `/plan/` that other pages link to (step2 README 3 steps 4 and 5): `?m=near&n=<nights>&p=<place slug>` and
// `?m=trip&cc=<CC>&p=<place slug>` from a park or place page, `?p=<slug>` from the add picker. Public keys only: a place slug, a country
// code, a number of nights. The start, the party and the dates never travel in a URL. Pure.
import type { KindId } from './kinds';

export interface Entry {
  kind: KindId | null;
  /** nights from `n` (near mode), or null */
  nights: number | null;
  cc: string | null;
  /** a place to start with, as its public slug */
  place: string | null;
  /** a public trip to start from (X7 "Start from this trip"), as its slug */
  seed: string | null;
  /** a draft on this device to open (Mine's "Continue", RB-021) and the stage to open it on; the id is a UUID v4 made on the device */
  draft: string | null;
  stage: 0 | 1 | 2 | 3 | 4 | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function parseEntry(search: string): Entry {
  const q = new URLSearchParams(search);
  const m = q.get('m');
  const n = Number(q.get('n'));
  const cc = q.get('cc');
  const p = q.get('p');
  const seed = q.get('seed');
  const d = q.get('draft');
  const st = Number(q.get('s'));
  let kind: KindId | null = null;
  if (m === 'near') kind = !q.has('n') || !Number.isInteger(n) || n <= 0 ? 'day' : n <= 2 ? 'weekend' : n <= 4 ? 'long_weekend' : 'week_car';
  else if (m === 'trip') kind = 'week_air';
  return {
    kind,
    nights: m === 'near' && q.has('n') && Number.isInteger(n) && n >= 0 && n <= 9 ? n : null,
    cc: m === 'trip' && cc && /^[A-Za-z]{2}$/.test(cc) ? cc.toUpperCase() : null,
    place: p && p.length <= 120 && SLUG.test(p) ? p : null,
    seed: seed && seed.length <= 120 && SLUG.test(seed) ? seed : null,
    draft: d && UUID.test(d) ? d : null,
    stage: q.has('s') && Number.isInteger(st) && st >= 0 && st <= 4 ? (st as 0 | 1 | 2 | 3 | 4) : null,
  };
}

export const hasEntry = (e: Entry): boolean => e.kind !== null || e.place !== null || e.seed !== null || e.draft !== null;
