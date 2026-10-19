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
