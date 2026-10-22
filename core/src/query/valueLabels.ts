// A filter value no row carries still needs a name (smart-search 6.1: a chip and a pill never disagree). The pill labels come from the
// rows, so a value the parser wrote that no row has ("hot_spring", month 12, "lt3") would show as its code. This is the fallback: the
// facets' own label tables, then the plain words of the value. It never replaces a label a row gave.
import { ageLabel } from '../format/age.ts';
import { MONTH_NAMES } from '../format/season.ts';
import { BEST_TIME_LABELS, BOOKING_LABELS, EFFORT_LABELS, PRICE_LABELS, SHAPE_LABELS, TIME_LABELS, WALK_LABELS } from './facets/answers.ts';
import { CLIMB_BANDS, LENGTH_BANDS, TRIP_LENGTH_LABEL } from '../parse/grammar.ts';
import type { FacetParam } from './types.ts';

const words = (v: string) => {
  const s = v.replace(/[_-]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const band = (bands: readonly (readonly [string, string, number, number])[], v: string) => bands.find((b) => b[0] === v)?.[1];

const TIME_KEYS = new Set(['f.time', 'f.duration', 'f.time-on-site']);

/** The name of one filter value, whatever the rows hold. */
export function fallbackLabel(param: FacetParam, value: string): string {
  switch (param) {
    case 'season':
      return /^\d{1,2}$/.test(value) ? (MONTH_NAMES[Number(value) - 1] ?? value) : words(value);
    case 'k': {
      // the last step of the type id is its own name ("water.thermal.hot_spring" is a hot spring)
      const last = value.startsWith('intent:') ? value.slice(7) : value.split('.').pop()!;
      return value === 'intent:do' ? 'Things to do' : words(last);
    }
    case 'kid':
      return value === 'yes' ? 'Easy with kids' : /^\d{1,2}$/.test(value) ? ageLabel('control', Number(value)) : words(value);
    case 'effort':
      return EFFORT_LABELS[value] ?? words(value);
    case 'stroller':
      return value === 'any' ? 'Any stroller' : value === 'all-terrain' ? 'All-terrain stroller' : words(value);
    case 'length':
      return TRIP_LENGTH_LABEL[value] ?? words(value);
    case 'drive': {
      const n = /^toronto-(\d)$/.exec(value)?.[1];
      return n ? `Within ${n} ${n === '1' ? 'hour' : 'hours'} of Toronto` : words(value);
    }
    case 'country':
      if (/^[A-Za-z]{2}$/.test(value)) {
        try {
          return new Intl.DisplayNames(['en'], { type: 'region' }).of(value.toUpperCase()) ?? value;
        } catch {
          return value;
        }
      }
      return words(value);
    case 'f.length':
      return band(LENGTH_BANDS, value) ?? words(value);
    case 'f.climb':
      return band(CLIMB_BANDS, value) ?? words(value);
    case 'f.price-band':
      return PRICE_LABELS[value as keyof typeof PRICE_LABELS] ?? words(value);
    case 'f.booking-needed':
      return BOOKING_LABELS[value as keyof typeof BOOKING_LABELS] ?? words(value);
    case 'f.walk-from-the-car':
      return WALK_LABELS[value] ?? words(value);
    case 'f.shape':
      return SHAPE_LABELS[value] ?? words(value);
    case 'f.best-time-of-day':
      return BEST_TIME_LABELS[value] ?? words(value);
    default:
      if (TIME_KEYS.has(param)) return TIME_LABELS[value as keyof typeof TIME_LABELS] ?? words(value);
      if (value === 'yes') return 'Yes';
      if (value === 'no') return 'No';
      return words(value);
  }
}
