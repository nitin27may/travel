// The routed pairs the calibration and the golden tests read (driving-time-model.md 2.1 and 5.7). Pure: the caller reads the files and
// passes the parsed documents. Only open-engine values enter (ORS driving-car); Google never does (spec 3.3 rule 2).
//
// Method (spec 2.1): a stored leg's ends are the first and last points of its polyline (the snapped road ends); a research run's
// pairs use its own points. Pairs under DRIVE_CALIBRATION.minStraight km straight are walks and dropped; the two directions of a pair
// (and a pair repeated in two sources) count once, the first one met in input order.
import { DRIVE_CALIBRATION, DRIVE_INPUTS } from "../config/drive.ts";
import { haversineKm, type LatLon } from "../geo/distance.ts";
import { decodePolyline5, tripLegsFile } from "../schema/api/legs.ts";

export interface RawPair {
  id: string;
  source: string;
  a: LatLon;
  b: LatLon;
  straightKm: number;
  km: number;
  minutes: number;
}

const r5 = (x: number): number => Math.round(x * 1e5) / 1e5;
const r3 = (x: number): number => Math.round(x * 1e3) / 1e3;
const pt = (lat: number, lon: number): LatLon => ({ lat: r5(lat), lon: r5(lon) });
const pair = (id: string, source: string, a: LatLon, b: LatLon, km: number, minutes: number): RawPair => ({
  id, source, a, b, straightKm: r3(haversineKm(a, b)), km, minutes,
});

/** The drive legs of one stored legs file (`trip-legs/2`, profile driving-car, with a geometry). Throws on a malformed file. */
export function legsFilePairs(file: string, doc: unknown): RawPair[] {
  const parsed = tripLegsFile.safeParse(doc);
  if (!parsed.success) throw new Error(`${file}: not a trip-legs file (${parsed.error.issues[0]?.message ?? "invalid"})`);
  const out: RawPair[] = [];
  for (const l of parsed.data.legs) {
    if (l.profile !== DRIVE_INPUTS.profile || l.mode !== "drive" || !("geometry" in l) || !l.geometry) continue;
    if (typeof l.km !== "number" || typeof l.minutes !== "number") continue;
    const line = decodePolyline5(l.geometry);
    if (!line || line.length < 2) continue;
    const [lonA, latA] = line[0]!;
    const [lonB, latB] = line[line.length - 1]!;
    out.push(pair(`${parsed.data.trip}:${l.from}>${l.to}`, file, pt(latA, lonA), pt(latB, lonB), l.km, l.minutes));
  }
  return out;
}

interface RunDoc {
  points?: Record<string, [number, number]>;
  base_pairs?: { from: string; to: string; km: number; minutes: number }[];
  matrix?: { names: string[]; points: [number, number][]; durations_min: (number | null)[][]; distances_km: (number | null)[][] };
}

/** The pairs of an ORS research run: its one matrix (every routed cell) and its base pairs (directions). */
export function runFilePairs(file: string, doc: unknown): RawPair[] {
  const d = doc as RunDoc;
  const out: RawPair[] = [];
  const m = d.matrix;
  if (m) {
    for (let i = 0; i < m.names.length; i++) {
      for (let j = 0; j < m.names.length; j++) {
        if (i === j) continue;
        const min = m.durations_min[i]?.[j];
        const km = m.distances_km[i]?.[j];
        if (typeof min !== "number" || typeof km !== "number") continue;
        const [la, oa] = m.points[i]!;
        const [lb, ob] = m.points[j]!;
        out.push(pair(`run:m:${m.names[i]}>${m.names[j]}`, file, pt(la, oa), pt(lb, ob), km, min));
      }
    }
  }
  for (const p of d.base_pairs ?? []) {
    const a = d.points?.[p.from];
    const b = d.points?.[p.to];
    if (!a || !b) continue;
    out.push(pair(`run:b:${p.from}>${p.to}`, file, pt(a[0], a[1]), pt(b[0], b[1]), p.km, p.minutes));
  }
  return out;
}

const endKey = (p: LatLon): string => `${p.lat.toFixed(4)},${p.lon.toFixed(4)}`;

/** Drop walks and count each unordered pair once (input order decides which direction stays). */
export function dedupePairs(pairs: readonly RawPair[], minStraight: number = DRIVE_CALIBRATION.minStraight): RawPair[] {
  const seen = new Set<string>();
  const out: RawPair[] = [];
  for (const p of pairs) {
    if (p.straightKm < minStraight || p.minutes <= 0) continue;
    const k = [endKey(p.a), endKey(p.b)].sort().join("|");
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  return out;
}
