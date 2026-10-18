import type { Pin, PinStyle } from './types';

const STYLE_NAME: Record<PinStyle, string> = {
  stop: 'Stop',
  'stop-numbered': 'Stop',
  base: 'Base',
  place: 'Place',
  trailhead: 'Trailhead',
  parking: 'Parking',
  trip: 'Trip',
};

/**
 * The name assistive tech gets for a pin. A quiet pin draws no text on the map, but it keeps this name; a pin with no
 * label falls back to its kind ("Parking") rather than the raw style id.
 */
export function pinName(p: Pin): string {
  const label = p.label?.trim();
  const base = label || STYLE_NAME[p.style] || p.style;
  return p.number != null ? `${p.number}. ${base}` : base;
}
