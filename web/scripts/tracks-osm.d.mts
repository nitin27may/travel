export type LonLat = [number, number];
export interface TrackInput { place: string; name: string; osm: string[]; trailhead: { lat: number; lon: number } | null; refs?: string[]; researchedKm?: number | null; destination?: { lat: number; lon: number } | null; wrongRoute?: string | null; loop?: boolean; startOverride?: boolean }
export interface TrackFile {
  schema: string; place: string; refs: string[]; osm: string[]; fetched: string; source: string; licence: string; attribution: string;
  stitched: boolean; confirmed: boolean; held_back?: string[]; start_override?: boolean; start_offset_m: number | null; end_offset_m?: number | null; cut?: string | null; legs?: { osm: string; km: number }[]; simplify_m: number; step_m: number;
  totals: { km: number; gain_m: number | null; loss_m: number | null; high_m: number | null; low_m: number | null };
  dem: string | null; geometry: LonLat[]; segments?: LonLat[][]; elevation: [number, number][];
}
export const SCHEMA: string;
export const LICENCE: string;
export const ATTRIBUTION: string;
export const SIMPLIFY_M: number;
export const MAX_POINTS: number;
export const SAMPLE_STEP_M: number;
export const HYSTERESIS_M: number;
export function haversine(a: LonLat, b: LonLat): number;
export function lengthM(line: LonLat[]): number;
export function stitchWays(ways: LonLat[][]): { lines: LonLat[][]; stitched: boolean };
export function simplifyLine(line: LonLat[], tol?: number): LonLat[];
export function simplifyToLimit(line: LonLat[], tol?: number, max?: number): { line: LonLat[]; tolerance: number };
export function resample(line: LonLat[], step?: number): { at: LonLat; d: number }[];
export function decodeTerrarium(r: number, g: number, b: number): number;
export function totalsFromSamples(samples: [number, number][], h?: number): NonNullable<TrackFile['totals']>;
export function waysFromOverpass(json: unknown): { id: number; line: LonLat[] }[];
export function waysFromOsmApi(json: unknown): { id: number; line: LonLat[] }[];
export function osmRefsOf(source: string | undefined, ids: string | undefined): string[];
export function osmRefsFromCapture(rec: unknown): string[];
export function unconfirmedIds(source: string): Set<string>;
export function collectInputs(snapshot: unknown, captureRecords?: unknown[], ctx?: { points?: Record<string, { lat: number; lon: number }>; overrides?: unknown }): TrackInput[];
export function checkTracks(inputs: TrackInput[], files: Map<string, unknown>, unconfirmed?: Set<string>): { place: string; problem: string }[];
export function formatTrack(t: TrackFile): string;
export function lengthConsistent(trackKm: number, researchedKm: number | null | undefined, tol?: number): boolean;
export function offsetToWays(ways: LonLat[][], pt: LonLat): number;
export function routeThrough(pieces: LonLat[][][], opts: { trailhead: { lat: number; lon: number } | null; destination?: { lat: number; lon: number } | null; loop?: boolean }): {
  problem?: string; line: LonLat[]; startOffset: number; endOffset: number | null; legs: { index: number; km: number }[]; cut: string;
};
