/**
 * Where a pin- or point-anchored card goes (spec 3.2): beside the point, on whichever of four corners keeps it inside the free area and
 * off the search box, the breadcrumb, the rail and the other floating elements. Pure, so it is tested without a browser.
 */
export interface Rect { left: number; top: number; right: number; bottom: number }
export type CardAnchor = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'left' | 'right';

export interface Placement { anchor: CardAnchor; offset: [number, number]; rect: Rect; overlap: number }

const GAP = 16;

/** The card's rectangle for an anchor: `top-left` means the card hangs right and down from the point. */
export function cardRect(at: { x: number; y: number }, size: { w: number; h: number }, anchor: CardAnchor): Rect {
  const right = anchor.endsWith('left');
  const centred = anchor === 'left' || anchor === 'right';
  const down = anchor.startsWith('top');
  const left = right ? at.x + GAP : at.x - GAP - size.w;
  const top = centred ? at.y - size.h / 2 : down ? at.y + GAP / 2 : at.y - GAP / 2 - size.h;
  return { left, top, right: left + size.w, bottom: top + size.h };
}

const area = (a: Rect, b: Rect): number => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

/** Area of a rectangle that falls outside the free area. */
const outside = (r: Rect, free: Rect): number => (r.right - r.left) * (r.bottom - r.top) - area(r, free);

export function placeCard(at: { x: number; y: number }, size: { w: number; h: number }, free: Rect, occupied: Rect[]): Placement {
  const order: CardAnchor[] = ['top-left', 'bottom-left', 'top-right', 'bottom-right', 'left', 'right'];
  const options = order.map((anchor): Placement => {
    const rect = cardRect(at, size, anchor);
    const overlap = outside(rect, free) * 2 + occupied.reduce((n, o) => n + area(rect, o), 0);
    return { anchor, rect, overlap, offset: [anchor.endsWith('left') ? GAP : -GAP, anchor === 'left' || anchor === 'right' ? 0 : anchor.startsWith('top') ? GAP / 2 : -GAP / 2] };
  });
  // the first that overlaps nothing wins, in reading order; otherwise the least bad
  return options.find((o) => o.overlap === 0) ?? options.reduce((a, b) => (b.overlap < a.overlap ? b : a));
}

/**
 * Where a fitted feature's card (a river, a plain, a range) goes once the camera rests: the corner of the free area that covers the least
 * of the feature's own box and of the floating controls, and among equals the one farthest from the box's centre. Never the feature's label
 * point, which sits on the feature (review phase A, M1). Returns the card's top-left corner in the same coordinates as `free`.
 */
export function farCorner(size: { w: number; h: number }, free: Rect, box: Rect | null, occupied: Rect[], inset = 12, points: { x: number; y: number }[] = []): { x: number; y: number } {
  const w = size.w, h = size.h;
  const xs = [free.left + inset, free.right - inset - w];
  const ys = [free.top + inset, free.bottom - inset - h];
  const centre = box ? { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 } : { x: (free.left + free.right) / 2, y: (free.top + free.bottom) / 2 };
  let best: { x: number; y: number; cost: number } | null = null;
  for (const x of xs) for (const y of ys) {
    const r: Rect = { left: x, top: y, right: x + w, bottom: y + h };
    const cost = occupied.reduce((n, o) => n + area(r, o), 0) * 4 + (box ? area(r, box) : 0) * 0.2 + points.reduce((n, q) => n + (q.x > r.left && q.x < r.right && q.y > r.top && q.y < r.bottom ? 1 : 0), 0) * 400 - Math.hypot(x + w / 2 - centre.x, y + h / 2 - centre.y) * 0.01;
    if (!best || cost < best.cost) best = { x, y, cost };
  }
  return { x: (best as { x: number; y: number }).x, y: (best as { x: number; y: number }).y };
}
