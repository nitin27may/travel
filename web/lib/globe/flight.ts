/**
 * The fly-in choreography (spec 5.3) as plain values: one flight per step with the target pitch inside it, the subject placed in
 * the upper-middle of the free area. Pure, so the table is testable without a map.
 */
export type FlightStep = 'country' | 'state' | 'district' | 'place' | 'trip' | 'feature';

export interface FlightPlan {
  /** Target pitch in degrees. */
  pitch: number;
  /** Share of the free height the subject sits above the centre of the free area. */
  shift: number;
  maxDuration: number;
  /** MapLibre's distance model: the speed and curve of every flight on this page. */
  speed: number;
  curve: number;
}

export const FLIGHT_SPEED = 1.2;
export const FLIGHT_CURVE = 1.42;
/** Pitch only shows above this zoom (the terrain gate); below it the camera eases back to flat. */
export const PITCH_MIN_ZOOM = 3.5;
/** A shape wider than this (Russia, Canada, the US with Alaska, France with territories) flies to its mainland box instead. */
export const WIDE_SPAN_DEG = 170;
/** Zoom of the world-level camera for a wide country: it stays on the globe. */
export const WIDE_ZOOM = { min: 2.6, max: 3.2 };

/** The zoom a feature flight lands at, by class (spec 5.3 last column). Seas go by rank: 2.2 for an ocean to 6 for a bay. */
export const FEATURE_ZOOM: Record<string, number> = { river: 8, lake: 11, peak: 12, park: 10, city: 11, town: 11 };

export function seaZoom(rank: number): number {
  return rank <= 1 ? 2.2 : rank <= 3 ? 3.2 : rank <= 5 ? 4.5 : 6;
}

export function featureZoom(cls: string, rank = 5): number {
  return cls === 'sea' ? seaZoom(rank) : (FEATURE_ZOOM[cls] ?? 10);
}

/** Pitch a feature flight ends at: peaks and lakes tilt, seas and rivers stay flat. */
const featurePitch = (cls: string): number => (cls === 'peak' || cls === 'lake' ? 45 : 0);

export function flightPlan(step: FlightStep, o: { terrain: boolean; approx?: boolean; featureClass?: string } = { terrain: false }): FlightPlan {
  const base = { speed: FLIGHT_SPEED, curve: FLIGHT_CURVE };
  switch (step) {
    case 'country': return { ...base, pitch: 20, shift: 0.12, maxDuration: 1800 };
    case 'state': return { ...base, pitch: o.terrain ? 45 : 0, shift: 0.18, maxDuration: 1600 };
    case 'district': return { ...base, pitch: o.terrain ? 55 : 0, shift: 0.18, maxDuration: 1600 };
    case 'place': return { ...base, pitch: o.terrain && !o.approx ? 55 : 0, shift: o.approx ? 0.12 : 0.22, maxDuration: 1600 };
    case 'trip': return { ...base, pitch: 40, shift: 0.15, maxDuration: 1600 };
    case 'feature': return { ...base, pitch: featurePitch(o.featureClass ?? ''), shift: 0.1, maxDuration: 900 };
  }
}

/** The pitch a camera at `zoom` may hold: none below the terrain gate. */
export const pitchAt = (pitch: number, zoom: number): number => (zoom >= PITCH_MIN_ZOOM ? pitch : 0);

/** Pixels the target moves up from the centre of the free area so the subject sits in the upper-middle once pitched. */
export const shiftPx = (freeHeight: number, shift: number): number => Math.round(Math.max(0, freeHeight) * shift);

/** Whether a flight to a box this wide stays on the globe at world zoom. */
export const isWide = (spanLon: number): boolean => spanLon > WIDE_SPAN_DEG;

/** Zoom for a wide country's mainland box, kept inside 2.6 to 3.2. */
export const wideZoom = (zoomForBox: number): number => Math.min(WIDE_ZOOM.max, Math.max(WIDE_ZOOM.min, zoomForBox));

/** Terrain exaggeration at a zoom, in five steps from the gate (zoom 3.5) to one level above it: the relief grows in during the fly-in. */
export function terrainRamp(zoom: number, exaggeration: number): number {
  if (zoom < PITCH_MIN_ZOOM) return 0;
  const t = Math.min(1, zoom - PITCH_MIN_ZOOM);
  const steps = Math.max(1, Math.ceil(t * 5));
  return Math.round(exaggeration * (steps / 5) * 100) / 100;
}

const mercY = (latDeg: number): number => Math.log(Math.tan(Math.PI / 4 + (Math.max(-85, Math.min(85, latDeg)) * Math.PI) / 360));

/**
 * The zoom that fits a box inside a free area, from the Mercator world size (512 * 2^z). MapLibre's `cameraForBounds` also adds the
 * map's own padding to the padding it is given, so on a map the world frame has already padded it lands the subject far off
 * centre (measured: Italy 270 px off); this fit does not depend on the map's state. Valid at country scale, where the globe is near flat.
 */
export function fitZoom(box: [[number, number], [number, number]], freeW: number, freeH: number, maxZoom = 8): number {
  const [[w, s], [e, n]] = box;
  const fracX = Math.max(1e-6, (e - w) / 360);
  const fracY = Math.max(1e-6, (mercY(n) - mercY(s)) / (2 * Math.PI));
  const z = Math.min(Math.log2(Math.max(1, freeW) / (512 * fracX)), Math.log2(Math.max(1, freeH) / (512 * fracY)));
  return Math.max(0, Math.min(maxZoom, z));
}

/** The centre to fly to for a box: its middle in longitude and in Mercator y, so the shape sits in the middle of the free area. */
export function boxCentre(box: [[number, number], [number, number]]): [number, number] {
  const [[w, s], [e, n]] = box;
  const y = (mercY(s) + mercY(n)) / 2;
  return [(w + e) / 2, (Math.atan(Math.sinh(y)) * 180) / Math.PI];
}
