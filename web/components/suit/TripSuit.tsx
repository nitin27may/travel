'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { SuitGlyph } from '@/components/suit/SuitGlyph';
import type { ItemSuit } from '@/lib/public/types';

// What a timeline entry draws about the place it visits (suitability-display 3.3 and D6; relevance 6.2). The trip page provides
// the stops' chips by place slug and the party's youngest age; an entry reads its own. The fit chip is worked out here from the
// numbers, so changing the party in the URL changes the chip with no new data.

export interface TripSuitValue {
  byPlace: Record<string, ItemSuit>;
  /** the youngest traveller's age when the profile is a family; null for adults */
  youngest: number | null;
}

const Ctx = createContext<TripSuitValue>({ byPlace: {}, youngest: null });

export function TripSuitProvider({ value, children }: { value: TripSuitValue; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useTripSuit = (): TripSuitValue => useContext(Ctx);

interface Fit {
  kind: 'fits' | 'advice_fail' | 'rule_fail';
  text: string;
  label: string;
}

/** Slot 1 against a party (D6): the rule that fails first, then our advice, else it fits. Null when nothing is known. */
export function fitFor(s: ItemSuit, youngest: number | null): Fit | null {
  if (youngest === null || s.kidsFrom === null) return null;
  if (s.kidsBasis === 'rule' && s.kidsFrom > youngest) return { kind: 'rule_fail', text: `Not for under ${s.kidsFrom} · operator rule`, label: `Operator rule: not for under ${s.kidsFrom}` };
  if (s.kidsBasis === 'advice' && s.kidsFrom > youngest) return { kind: 'advice_fail', text: `Not suited to a ${youngest}-year-old`, label: `Our judgement: not suited to a ${youngest}-year-old` };
  return { kind: 'fits', text: `Fits a ${youngest}-year-old`, label: `Fits a ${youngest}-year-old` };
}

/**
 * The three chips of an entry, limits chip first; with a family profile slot 1 becomes the fit chip. They sit inline in the entry's
 * title row, so they wrap to a second line on a phone (display 3.3). A rule chip stays first when it fits.
 */
export function EntrySuit({ slug }: { slug: string | null | undefined }) {
  const { byPlace, youngest } = useTripSuit();
  const s = slug ? byPlace[slug] : undefined;
  if (!s || (s.chips.length === 0 && !s.badge)) return null;
  const fit = fitFor(s, youngest);
  const chips = s.chips.map((c, i) => (i === 0 && fit ? null : c));
  return (
    <>
      {fit ? (
        <span className="su-chip su-entry" data-kind={fit.kind}>
          <span className="su-chip-in" aria-label={fit.label}>
            <SuitGlyph name={fit.kind === 'fits' ? 'check' : fit.kind === 'advice_fail' ? 'triangle' : 'none'} />
            <span>{fit.text}</span>
          </span>
        </span>
      ) : null}
      {s.chips.map((c, i) =>
        chips[i] ? (
          <span key={`${c.field ?? c.kind}-${i}`} className="su-chip su-entry" data-kind={c.kind}>
            <span className="su-chip-in" aria-label={c.label}>
              <SuitGlyph name={c.glyph} />
              <span>{c.textNoTime ?? c.text}</span>
              {c.extra > 0 ? <span className="su-chip-more">+{c.extra}</span> : null}
            </span>
          </span>
        ) : null,
      )}
      {s.badge ? (
        <span className="rv-chip rv-chip-sm" data-badge>
          {s.badge}
        </span>
      ) : null}
    </>
  );
}

/** Day numbers whose stops include an anchor: the strip marks them (relevance 6.2). */
export function anchorBadge(s: ItemSuit | undefined): boolean {
  return !!s && s.badge === 'Worth the journey';
}
