import { readLocal, writeLocal } from '@/lib/storage/safe';
import type { StyleKey } from '@/lib/map/maplibre/styles';

export interface GlobePrefs { style: StyleKey | 'auto'; terrain: boolean; exaggeration: number; spin: boolean }
export const DEFAULT_PREFS: GlobePrefs = { style: 'auto', terrain: true, exaggeration: 1, spin: true };
const KEY = 'travel:v1:globe';

const STYLES = ['auto', 'relief', 'light', 'dark'];

export function sanitisePrefs(raw: unknown): GlobePrefs {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof GlobePrefs, unknown>>;
  const ex = Number(o.exaggeration);
  return {
    style: typeof o.style === 'string' && STYLES.includes(o.style) ? (o.style as GlobePrefs['style']) : DEFAULT_PREFS.style,
    terrain: typeof o.terrain === 'boolean' ? o.terrain : DEFAULT_PREFS.terrain,
    exaggeration: Number.isFinite(ex) && ex >= 0.5 && ex <= 2 ? ex : DEFAULT_PREFS.exaggeration,
    spin: typeof o.spin === 'boolean' ? o.spin : DEFAULT_PREFS.spin,
  };
}

export function loadPrefs(): GlobePrefs {
  try { return sanitisePrefs(JSON.parse(readLocal(KEY) ?? '{}')); } catch { return DEFAULT_PREFS; }
}
export function savePrefs(p: GlobePrefs): void {
  writeLocal(KEY, JSON.stringify(p));
}
