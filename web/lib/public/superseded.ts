import { loadSupersedes } from '@travel/core/capture/supersede.ts';
import type { World } from '@travel/core/capture/records.ts';
import type { Fact } from './types';
import { readDate } from './tracks';

interface LegacyShown { name: string; captureRef?: string | null; stats: { distanceKm: number | null; gainM: number | null; hours: string | null }; facts?: Fact[] }

const num = (n: number): string => String(Math.round(n * 10) / 10);

/**
 * Contract 9.7 for the older fact layer: a figure an official re-read superseded (data/capture/supersedes.json) replaces the prototype's
 * own figure in the trail stats and in the Distance and Climb facts, and the older range fact that restates the original is dropped, so the
 * original never sits beside the new value outside the "Sources disagree" disclosure.
 */
export function applyLegacySupersedes(recs: LegacyShown[], world: World, normName: (s: string) => string): void {
  const file = loadSupersedes(world.root);
  if (!file) return;
  for (const e of file.entries) {
    const field = /\.drivers\.(distance_km|gain_m)$/.exec(e.path)?.[1];
    if (!field || typeof e.value.v !== 'number' || typeof e.was !== 'number') continue;
    const name = world.cap.get(e.ref)?.rec.name;
    const publisher = file.sources.find((s) => s.id === e.value.src[0])?.publisher ?? 'official information';
    const prov = `${publisher}${e.value.read ? `, read ${readDate(e.value.read)}` : ''}`;
    for (const r of recs) {
      if (r.captureRef !== e.ref && !(name && normName(r.name) === normName(name))) continue;
      if (field === 'distance_km') r.stats.distanceKm = e.value.v;
      else r.stats.gainM = e.value.v;
      const label = field === 'distance_km' ? 'Distance' : 'Climb';
      const shown = field === 'distance_km' ? `${num(e.value.v)} km` : `${num(e.value.v)} m`;
      for (const f of r.facts ?? []) {
        if (f.label === label) { f.value = shown; f.provenance = prov; f.conflicts = []; }
      }
      // the older "Route 11-12.6 km, 460-630 m" range restates the figure that was replaced
      if (r.facts) r.facts = r.facts.filter((f) => !(f.label === 'Route' && f.value.includes(num(e.was as number))));
    }
  }
}
