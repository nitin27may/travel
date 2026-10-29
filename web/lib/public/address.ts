import type { CaptureRecord } from '@travel/core/schema/capture/records.ts';
import { osmRefOf } from '@travel/core/schema/capture/records.ts';
import { HOME_TOWN_RE, nearHome } from '@travel/core/privacy/home.ts';

// The address of a public place (location-type-requirements 5.1, D2; LT-M). Read from the capture record's Val at page-build time and
// carried on the page model, so the page, the API detail, the print, the CSV and the dated copy's calendar all say it the same way.
// It is a place's address, never the household's: a value that names the home town, or a place whose point is inside the household
// exclusion radius, is dropped whole (a partial address is a wrong one).

export interface PageAddress {
  /** the record whose address this is: the place itself, or the access point the Directions card goes to */
  ref: string;
  name: string;
  /** `nearest_road` comes from a reverse lookup of the point and is shown as "Near ..." */
  kind: 'postal' | 'nearest_road';
  lines: string[];
  locality: string;
  postcode: string | null;
}

/** The address as a visitor reads it: a postal address as written, a nearest-road one as "Near <road>, <locality>". */
export function addressLine(a: Pick<PageAddress, 'kind' | 'lines' | 'locality' | 'postcode'>): string {
  if (a.kind === 'nearest_road') return `Near ${a.lines.join(', ')}, ${a.locality}`;
  return [...a.lines, a.locality, a.postcode].filter((x): x is string => !!x).join(', ');
}

/** The address as text to paste into a map or a message: the same words without "Near" (the road is what a search needs). */
export function addressCopy(a: Pick<PageAddress, 'lines' | 'locality' | 'postcode'>): string {
  return [...a.lines, a.locality, a.postcode].filter((x): x is string => !!x).join(', ');
}

/** The OpenStreetMap element of a record, whichever form `osm_ref` is stored in, or null. */
export const osmRefOfRecord = (cap: Pick<CaptureRecord, 'type'> & { osm_ref?: unknown }): string | null => osmRefOf(cap);

/**
 * A record's stored address, or null: absent, `searched_none` and any other state that is not a value give nothing. Null too when it
 * would reveal the household (the home town in its words, or the record's point near home).
 */
export function readAddress(ref: string, name: string, cap: { address?: unknown }, point: { lat: number; lon: number } | null): PageAddress | null {
  const v = cap.address as { state?: string; v?: unknown } | undefined;
  if (!v || v.state !== 'value' || !v.v || typeof v.v !== 'object') return null;
  const a = v.v as { kind?: unknown; lines?: unknown; locality?: unknown; postcode?: unknown };
  if ((a.kind !== 'postal' && a.kind !== 'nearest_road') || !Array.isArray(a.lines) || a.lines.length === 0 || a.lines.some((l) => typeof l !== 'string' || !l.trim()) || typeof a.locality !== 'string' || !a.locality.trim()) return null;
  const postcode = typeof a.postcode === 'string' && a.postcode.trim() ? a.postcode.trim() : null;
  const out: PageAddress = { ref, name, kind: a.kind, lines: (a.lines as string[]).map((l) => l.trim()), locality: a.locality.trim(), postcode };
  if (HOME_TOWN_RE.test(addressCopy(out))) return null;
  if (point && nearHome(point.lat, point.lon)) return null;
  return out;
}
