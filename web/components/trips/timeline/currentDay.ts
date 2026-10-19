/** One thing the page can be "at": a day or a category section, with its top edge in viewport pixels. */
export interface Spot<K> {
  key: K;
  top: number;
}

/**
 * The current spot: the last one, in page order, whose top is at or above the reference line. Two edges are decided here and
 * nowhere else: above the first spot nothing has been reached (null), and at the very bottom of the page the last spot is
 * current, because a short last day can never climb to the line.
 */
export function pickCurrent<K>(spots: readonly Spot<K>[], line: number, atBottom: boolean): K | null {
  if (!spots.length) return null;
  if (atBottom) return spots[spots.length - 1]!.key;
  let cur: K | null = null;
  for (const s of spots) if (s.top <= line) cur = s.key;
  return cur;
}

/** Page bottom with a 2 px tolerance for fractional scroll positions. A page that does not scroll is never "at the bottom". */
export function isAtBottom(scrollY: number, viewportH: number, docH: number): boolean {
  return scrollY > 0 && scrollY + viewportH >= docH - 2;
}

/** `#day-8` to 8, anything else to null. */
export function dayOfHash(hash: string): number | null {
  const m = /^#?day-(\d+)$/.exec(hash);
  return m ? Number(m[1]) : null;
}
