// Words for the trip tags. One place, so a card chip, a filter option and a table cell say the same thing.
import { hoursMinutes } from '@/components/trips/format';
import type { TripListRow } from '@/components/trips/types';

export const LENGTH_LABELS: Record<string, string> = {
  day: 'Day trips',
  overnight: 'Overnights',
  weekend: 'Weekends (2 nights)',
  'long-weekend': 'Long weekends (3 nights)',
  '4-8': '4 to 8 nights',
  '9-14': '9 to 14 nights',
  '15+': '15 nights and more',
};
export const LENGTH_ORDER = Object.keys(LENGTH_LABELS);
/** The chip on a card: short, singular. */
export const LENGTH_CHIP: Record<string, string> = {
  day: 'Day trip',
  overnight: 'Overnight',
  weekend: 'Weekend',
  'long-weekend': 'Long weekend',
  '4-8': '4 to 8 nights',
  '9-14': '9 to 14 nights',
  '15+': '15+ nights',
};
export const PHASE_FOR_LENGTH: Record<string, string> = { day: 'Day trips', overnight: 'Overnights', weekend: 'Weekends', 'long-weekend': 'Long weekends', '4-8': '4 to 8 nights', '9-14': '9 to 14 nights', '15+': '15 nights and more' };

/** The standard ages the Kids filter offers: a plan suits a child of age A when its "Kids from N" is A or less. */
export const KID_AGES = [4, 6, 8, 10, 12] as const;

export const HIKE_ORDER = ['easy', 'moderate', 'strenuous'] as const;
export const AROUND_ORDER = ['rental-car', 'camper-van', 'train', 'tours'] as const;
export const PERDAY_ORDER = ['u1', '1-2', '2-3', '3+'] as const;

/** Hub bands for the "From Toronto" pill: the value is `toronto-<n>`, n = 1 to 4 (short-trips 3.3). */
export const HUB_BANDS = [
  { n: 1, label: 'Under 1 hour', max: 60 },
  { n: 2, label: '1 to 2 hours', max: 120 },
  { n: 3, label: '2 to 3 hours', max: 180 },
  { n: 4, label: '3 hours and more', max: Infinity },
] as const;
export const hubBandOf = (minutes: number) => HUB_BANDS.find((b) => minutes < b.max)!;

/** The card's mono line: "Day trip · from Toronto 1 h 25", "2 nights · a weekend", or the nights and days for 4 and up (short-trips 3.3). */
export function lengthLine(t: TripListRow): string {
  const from = t.fromHubMin === null ? null : `from Toronto ${t.fromHubApprox ? '≈' : ''}${hoursMinutes(t.fromHubMin)}`;
  const place = t.region;
  switch (t.lengthClass) {
    case 'day':
      return ['Day trip', from ?? place].filter(Boolean).join(' · ');
    case 'overnight':
      return ['1 night', 'an overnight', from].filter(Boolean).join(' · ');
    case 'weekend':
      return ['2 nights', 'a weekend', from].filter(Boolean).join(' · ');
    case 'long-weekend':
      return ['3 nights', 'a long weekend', from].filter(Boolean).join(' · ');
    default:
      return [t.nights === null || t.days === null ? '' : `${t.nights} nights · ${t.days} days`, place].filter(Boolean).join(' · ');
  }
}

/** The URL of the Trips list filtered by one tag. */
export const tagHref = (param: string, value: string): string => `/trips/?${param}=${encodeURIComponent(value)}`;
