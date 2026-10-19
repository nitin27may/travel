import type { Honesty, HonestyId } from './types';

const TEXT: Record<HonestyId, string> = {
  estimate: 'Estimate',
  not_known: 'Not known yet',
  sources_disagree: 'Sources disagree',
  low_confidence: 'Low confidence',
  location_unconfirmed: 'Location unconfirmed',
  unverified: 'Unverified',
  no_source: 'No source yet',
  dates_open: 'Dates open',
  condensed: 'Condensed from the full plan',
  overview_only: 'Overview only',
  drive_estimated: 'Drive time estimated',
  pattern_2026: '2026 data used as a pattern',
};

export function honesty(id: HonestyId, reason: string): Honesty {
  return { id, label: TEXT[id], reason };
}

/** Stable order, one entry per id (the first reason wins). */
export function uniqueHonesty(list: Honesty[]): Honesty[] {
  const order = Object.keys(TEXT);
  const seen = new Map<string, Honesty>();
  for (const h of list) if (!seen.has(h.id)) seen.set(h.id, h);
  return [...seen.values()].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
}
