import { formatDistance, formatElevation } from './units';
import type { Prefs } from './units';

// Distances and heights inside running text ("2.3 km", "750 m", "2–3 km"): one pattern and one conversion, so a page, a chip and a
// timeline entry all follow the visitor's units (km or mi, m or ft). Pure: no I/O, no DOM.

/** A number or range followed by km or m. The number may carry thousands commas. */
export const UNIT_PATTERN = /(\d[\d,]*(?:\.\d+)?)(?:–(\d[\d,]*(?:\.\d+)?))?\s?(km|cm|m)\b/g;

/** One number in the chosen unit, without the unit word. */
export function convertNumber(value: string, unit: 'km' | 'm' | 'cm', prefs: Prefs): string {
  const n = Number(value.replace(/,/g, ''));
  // a width or a height in centimetres follows the height unit: feet and inches go with inches
  if (unit === 'cm') return prefs.elevation === 'ft' ? String(Math.round(n / 2.54)) : String(n);
  const out = unit === 'km' ? formatDistance(n, prefs.distance) : formatElevation(n, prefs.elevation);
  return out.replace(/ \w+$/, '');
}

/** The unit word a value carries under these prefs. */
export const unitWord = (unit: 'km' | 'm' | 'cm', prefs: Prefs): string => (unit === 'km' ? prefs.distance : unit === 'cm' ? (prefs.elevation === 'ft' ? 'in' : 'cm') : prefs.elevation);

/** Text with every distance and height rewritten to the visitor's units. */
export function convertText(text: string, prefs: Prefs): string {
  return text.replace(UNIT_PATTERN, (_m, a: string, b: string | undefined, u: 'km' | 'm' | 'cm') => `${convertNumber(a, u, prefs)}${b ? `–${convertNumber(b, u, prefs)}` : ''} ${unitWord(u, prefs)}`);
}
