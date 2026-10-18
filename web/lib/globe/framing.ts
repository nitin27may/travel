import type { Padding } from './engine';

/** What the open panels and sheets cover, in CSS px, measured from each edge of the canvas. */
export interface Footprint { top: number; right: number; bottom: number; left: number }

export const WORLD_LAT = 20;
export const WORLD_LNG = -35;
/** The disc fills 86% of the shorter side of the free area (spec 3.1). */
export const DISC_FRACTION = 0.86;

/**
 * Zoom at which the globe's diameter is `d` CSS px. MapLibre's globe has the Mercator world width (512 * 2^z) as its
 * circumference, so the diameter is 512 * 2^z / pi (measured: zoom 0.495 gives a 230 px disc). Spec 3.1 writes
 * `log2(d / 512)`, which draws the disc a third of the intended size.
 */
export const zoomForDiameter = (d: number): number => Math.log2((Math.max(1, d) * Math.PI) / 512);

export interface WorldFrame { diameter: number; zoom: number; minZoom: number; padding: Padding; freeW: number; freeH: number }

/** World camera from the free canvas (spec 3.1). The disc centre goes to the middle of the free rectangle through map padding. */
export function worldFrame(canvasW: number, canvasH: number, cover: Footprint): WorldFrame {
  const freeW = Math.max(120, canvasW - cover.left - cover.right);
  const freeH = Math.max(120, canvasH - cover.top - cover.bottom);
  const diameter = DISC_FRACTION * Math.min(freeW, freeH);
  const zoom = zoomForDiameter(diameter);
  return { diameter, zoom, minZoom: zoom - 0.2, padding: { ...cover }, freeW, freeH };
}
