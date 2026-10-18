export type Snap = 'peek' | 'half' | 'full';
export const SNAP_ORDER: Snap[] = ['peek', 'half', 'full'];
export const PEEK_PX = 120;
/** The peek never goes below the grab bar and title row. */
export const MIN_PEEK_PX = 64;
/** The peek stays at least this far below the half stop, so the three stops keep their order on a short screen. */
export const PEEK_HALF_GAP = 48;

/** Peek height in px, clamped so a tall `peekPx` cannot pass the half stop (which would invert the peek and half stops). */
export function clampPeek(peekPx: number, height: number): number {
  const max = Math.max(MIN_PEEK_PX, Math.floor(height * 0.5) - PEEK_HALF_GAP);
  return Math.min(Math.max(peekPx, MIN_PEEK_PX), max);
}

/** Distance in px from the top of the frame down to the sheet's top edge at a stop. */
export function snapOffset(snap: Snap, height: number, peekPx: number): number {
  if (snap === 'full') return 0;
  if (snap === 'half') return Math.round(height * 0.5);
  return Math.max(0, height - clampPeek(peekPx, height));
}

/** The stop a sheet opens at: the requested one if the sheet has it, else the tallest. */
export function startSnap(stops: Snap[], initial?: Snap): Snap {
  return initial && stops.includes(initial) ? initial : stops[stops.length - 1];
}
