import { probeStorage } from '@travel/core/schema/copies.ts';
import type { ProbeResult } from '@travel/core/schema/copies.ts';

/**
 * The one storage probe for Mine, copies and favourites (nav 3.3): `localStorage` when it works, a per-tab memory store when the
 * browser blocks it or is full. Nothing else in `web/` touches `localStorage` for these lists. Client only; never import from the
 * phone bar (it would pull Zod into the start chunk).
 */
let probed: ProbeResult | undefined;
/** Probed once per page: a blocked browser's per-tab memory store must be the same object for every caller. */
export function mineStorage(): ProbeResult {
  return (probed ??= probeStorage(() => window.localStorage));
}

/** Tests only: forget the probe. */
export function resetMineStorage(): void {
  probed = undefined;
}
