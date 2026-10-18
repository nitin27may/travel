import { toCsv } from '@/lib/entities/csv';
import { checkPoint } from './licence';
import { CATEGORY_LABEL } from '@/lib/public/types';
import type { Category } from '@/lib/public/types';
import type { TripExport } from './types';

export const TRIP_CSV_HEADER = ['Day', 'Time', 'Name', 'Kind', 'Category', 'Area', 'Lat', 'Lon', 'Links'];

/** One row per stop in chronological order (day, time, then page order). Coordinates only where the licence guard passes. */
export function tripCsv(trip: TripExport): string {
  const rows = [...trip.stops]
    .sort((a, b) => a.day - b.day || (a.time ?? '99:99').localeCompare(b.time ?? '99:99') || a.order - b.order)
    .map((s) => {
      const p = s.point && checkPoint(s.point).ok ? s.point : null;
      return [s.day, s.time, s.name, s.kind, s.category ? CATEGORY_LABEL[s.category as Category] : '', s.area, p ? p.lat : '', p ? p.lon : '', s.links.join(' ')];
    });
  return toCsv(TRIP_CSV_HEADER, rows);
}

/** Rows from a list: objects (columns = keys of the first row) or arrays (first row is the header). */
export function listCsv(rows: unknown[]): string {
  if (rows.length === 0) return toCsv([], []);
  const first = rows[0];
  const scalar = (v: unknown): string | number | null => (v === null || v === undefined ? null : typeof v === 'number' || typeof v === 'string' ? v : typeof v === 'boolean' ? String(v) : JSON.stringify(v));
  if (Array.isArray(first)) {
    const [head, ...rest] = rows as unknown[][];
    return toCsv(head.map((h) => String(h ?? '')), rest.map((r) => r.map(scalar)));
  }
  const keys = Object.keys(first as Record<string, unknown>);
  return toCsv(keys, (rows as Record<string, unknown>[]).map((r) => keys.map((k) => scalar(r[k]))));
}
