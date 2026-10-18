import type { MapPalette } from '../palette';
import type { PinStyle } from '../types';

/** Pin glyphs drawn on a canvas in the palette colours, registered with map.addImage at 2x. */
const SIZE = 28;

function draw(fn: (c: CanvasRenderingContext2D) => void): ImageData | null {
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas');
  cv.width = cv.height = SIZE * 2;
  const c = cv.getContext('2d');
  if (!c) return null;
  c.scale(2, 2);
  fn(c);
  return c.getImageData(0, 0, SIZE * 2, SIZE * 2);
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

export function pinImages(p: MapPalette): Partial<Record<PinStyle, ImageData>> {
  const out: Partial<Record<PinStyle, ImageData>> = {};
  const mid = SIZE / 2;
  const put = (k: PinStyle, img: ImageData | null) => { if (img) out[k] = img; };
  // Base: ink rounded square with a house glyph.
  put('base', draw((c) => {
    roundRect(c, 1.5, 1.5, SIZE - 3, SIZE - 3, 6); c.fillStyle = p.ink; c.fill();
    c.lineWidth = 1.5; c.strokeStyle = p.halo; c.stroke();
    c.fillStyle = p.surface; c.beginPath();
    c.moveTo(mid, 6.5); c.lineTo(21, 13.5); c.lineTo(19, 13.5); c.lineTo(19, 21); c.lineTo(9, 21); c.lineTo(9, 13.5); c.lineTo(7, 13.5); c.closePath(); c.fill();
  }));
  // Place: surface disc with an ink ring and centre.
  put('place', draw((c) => {
    c.beginPath(); c.arc(mid, mid, 9, 0, Math.PI * 2); c.fillStyle = p.surface; c.fill();
    c.lineWidth = 2.5; c.strokeStyle = p.ink; c.stroke();
    c.beginPath(); c.arc(mid, mid, 3, 0, Math.PI * 2); c.fillStyle = p.ink; c.fill();
  }));
  // Trailhead: ink triangle.
  put('trailhead', draw((c) => {
    c.beginPath(); c.moveTo(mid, 4); c.lineTo(23, 22.5); c.lineTo(5, 22.5); c.closePath();
    c.fillStyle = p.ink; c.fill(); c.lineWidth = 1.5; c.strokeStyle = p.halo; c.stroke();
  }));
  // Parking: ink square with a P.
  put('parking', draw((c) => {
    roundRect(c, 4, 4, SIZE - 8, SIZE - 8, 3); c.fillStyle = p.ink; c.fill();
    c.lineWidth = 1.5; c.strokeStyle = p.halo; c.stroke();
    c.fillStyle = p.surface; c.font = '700 13px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('P', mid, mid + 0.5);
  }));
  // Trip: ink disc with a halo edge (signed-in trip pins use their identity ring elsewhere).
  put('trip', draw((c) => {
    c.beginPath(); c.arc(mid, mid, 9, 0, Math.PI * 2); c.fillStyle = p.ink; c.fill();
    c.lineWidth = 2; c.strokeStyle = p.halo; c.stroke();
  }));
  return out;
}
