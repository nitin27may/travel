import { partyShortText } from '@travel/core/trips/partyWords.ts';
import type { CopyItem } from '@travel/core/schema/copies.ts';

/**
 * "2 adults, 1 child": core's short party words, the one function for the rows, the sticky rail and the done step (SW-020).
 * Lives apart from ./copies so the Mine shell and the row models do not pull the copies schema, and Zod with it, into the
 * /mine start chunk (budget: 200 KB gz).
 */
export function partyText(c: Pick<CopyItem, 'adults' | 'children'>): string {
  return partyShortText({ adults: c.adults, children: c.children });
}
