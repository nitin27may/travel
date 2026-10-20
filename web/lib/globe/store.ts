import { globeCard, globePins } from '@/lib/client/data';
import type { GlobeCard, GlobeData, GlobeTree } from './types';

/** An empty store over the tree. `index.pins` and `cards` fill in place as countries open and pins are selected. */
export function newGlobeData(tree: GlobeTree): GlobeData {
  return { index: { continents: tree.continents, pins: [] }, cards: {} };
}

const loadedCountries = new WeakMap<GlobeData, Set<string>>();

/** Loads one country's pins into the store (once). Resolves when they are in `data.index.pins`; rejects if the file fails. */
export async function ensureCountry(data: GlobeData, cc: string): Promise<void> {
  const have = loadedCountries.get(data) ?? new Set<string>();
  loadedCountries.set(data, have);
  if (have.has(cc)) return;
  // A country the tree does not list has no pins file: it is empty, not a failed load (Birmingham, UK showed "could not be loaded").
  if (!data.index.continents.some((c) => c.countries.some((n) => n.slug === cc))) { have.add(cc); return; }
  const pins = await globePins({ country: cc });
  if (have.has(cc)) return;
  have.add(cc);
  data.index.pins.push(...pins);
}

/** Loads the card behind `kind:slug` and its country's pins. Null when the key is not on the globe. */
export async function ensureCard(data: GlobeData, key: string): Promise<GlobeCard | null> {
  const hit = data.cards[key];
  if (hit) return hit;
  const file = await globeCard(key);
  if (!file) return null;
  await ensureCountry(data, file.pin.path[0] ?? 'xx');
  data.cards[key] = file.card;
  return file.card;
}
