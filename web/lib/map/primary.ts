import type { MapSpec, Pin } from './types';

const ORDER: Pin['style'][] = ['trailhead', 'parking', 'place', 'base', 'stop-numbered', 'trip', 'stop'];

/** The point a "Directions" link and the Embed iframe use: the selected pin, else the most useful one. */
export function primaryPin(spec: Pick<MapSpec, 'pins' | 'selectedId'>): Pin | undefined {
  const sel = spec.selectedId ? spec.pins.find((p) => p.id === spec.selectedId) : undefined;
  if (sel) return sel;
  return [...spec.pins].sort((a, b) => ORDER.indexOf(a.style) - ORDER.indexOf(b.style))[0];
}
