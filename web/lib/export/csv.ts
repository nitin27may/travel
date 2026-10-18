import { toCsv } from '@/lib/entities/csv';
import { approxNote, checkPoint, sourceLine } from './licence';
import { CATEGORY_LABEL } from '@/lib/public/types';
import type { Category } from '@/lib/public/types';
import type { TripExport } from './types';

export const TRIP_CSV_HEADER = ['Day', 'Time', 'Name', 'Kind', 'Category', 'Area', 'Lat', 'Lon', 'Approximate', 'Links'];

/** One row per stop in chronological order (day, time, then page order). Coordinates only where the licence guard passes. */
export function tripCsv(trip: TripExport): string {
  const rows = [...trip.stops]
    .sort((a, b) => a.day - b.day || (a.time ?? '99:99').localeCompare(b.time ?? '99:99') || a.order - b.order)
    .map((s) => {
      const p = s.point && checkPoint(s.point).ok ? s.point : null;
      return [s.day, s.time, s.name, s.kind, s.category ? CATEGORY_LABEL[s.category as Category] : '', s.area, p ? p.lat : '', p ? p.lon : '', p && approxNote(p) ? 'yes' : '', s.links.join(' ')];
    });
  return toCsv(TRIP_CSV_HEADER, [...rows, [sourceLine(trip.url)]]);
}
