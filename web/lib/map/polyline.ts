// A Google encoded polyline, precision 5, decoded for the trip map (routed legs, D-E5). The API's contract module decodes the same string with
// its schema code; this is the small copy the map needs so the lazy chunk does not carry a schema library. `tests/map/polyline.test.ts` pins
// the two to each other. Returns null for anything that is not a well-formed polyline.
import type { LngLat } from './types';

const PRECISION = 1e5;

export function decodePolyline5(s: string): LngLat[] | null {
  const values: number[] = [];
  let shift = 0;
  let acc = 0;
  for (let i = 0; i < s.length; i++) {
    const b = s.charCodeAt(i) - 63;
    if (b < 0 || b > 63) return null;
    acc |= (b & 0x1f) << shift;
    shift += 5;
    if (b < 0x20) {
      values.push(acc & 1 ? ~(acc >> 1) : acc >> 1);
      acc = 0;
      shift = 0;
    } else if (shift > 30) return null;
  }
  if (shift !== 0 || values.length % 2 !== 0) return null;
  const out: LngLat[] = [];
  let lat = 0;
  let lng = 0;
  for (let i = 0; i < values.length; i += 2) {
    lat += values[i]!;
    lng += values[i + 1]!;
    if (Math.abs(lat / PRECISION) > 90 || Math.abs(lng / PRECISION) > 180) return null;
    out.push({ lng: lng / PRECISION, lat: lat / PRECISION });
  }
  return out;
}
