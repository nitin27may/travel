import { toCsv } from './csvText.ts';
import { approxNote, checkPoint, sourceLine } from './licence.ts';
import { CATEGORY_LABEL } from './publicTypes.ts';
import type { Category } from './publicTypes.ts';
import type { TripExport } from './types.ts';

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
