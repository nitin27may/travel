'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { SuitGlyph } from '@/components/suit/SuitGlyph';
import { convertText } from '@/lib/format/convert';
import { usePrefs } from '@/lib/format/prefs';
import { ageLabel } from '@/lib/format/age';
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
  if (s.kidsBasis === 'rule' && s.kidsFrom > youngest) return { kind: 'rule_fail', text: ageLabel('rule_fail', s.kidsFrom), label: `Operator rule: not for under ${s.kidsFrom}` };
  if (s.kidsBasis === 'advice' && s.kidsFrom > youngest) return { kind: 'advice_fail', text: ageLabel('advice_fail', youngest), label: `Our judgement: ${ageLabel('advice_fail', youngest).toLowerCase()}` };
  return { kind: 'fits', text: ageLabel('fits', youngest), label: ageLabel('fits', youngest) };
}

/**
 * The three chips of an entry, limits chip first; with a family profile slot 1 becomes the fit chip. They sit inline in the entry's
 * title row, so they wrap to a second line on a phone (display 3.3). A rule chip stays first when it fits.
 */
const norm = (t: string): string => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function EntrySuit({ slug, title, kind }: { slug: string | null | undefined; title: string; kind: string }) {
  const { byPlace, youngest } = useTripSuit();
  const [prefs] = usePrefs();
  const s = (slug ? byPlace[slug] : undefined) ?? byPlace[`n:${norm(title)}`];
  if (!s || (s.chips.length === 0 && !s.badge)) {
    // a stop with no record is never silent: it reads "not checked yet", not as fine (M8)
    return kind === 'visit' || kind === 'trail' ? (
      <span className="ch su-entry" data-kind="gap">
        <span className="ci" aria-label="Not checked yet: who it suits">
          <span>Kids: not checked yet</span>
        </span>
      </span>
    ) : null;
  }
  const fit = fitFor(s, youngest);
  const chips = s.chips.map((c, i) => (i === 0 && fit ? null : c));
  return (
    <>
      {fit ? (
        <span className="ch su-entry" data-kind={fit.kind}>
          <span className="ci" aria-label={fit.label}>
            <SuitGlyph name={fit.kind === 'fits' ? 'check' : fit.kind === 'advice_fail' ? 'triangle' : 'none'} />
            <span>{fit.text}</span>
          </span>
        </span>
      ) : null}
      {s.chips.map((c, i) =>
        chips[i] ? (
          <span key={`${c.field ?? c.kind}-${i}`} className="ch su-entry" data-kind={c.kind}>
            <span className="ci" aria-label={c.label}>
              <SuitGlyph name={c.glyph} />
              <span>{convertText(c.textNoTime ?? c.text, prefs)}</span>
              {c.extra > 0 ? <span className="ch-more">+{c.extra}</span> : null}
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

interface DayEntry {
  kind: string;
  title: string;
  at: { placeSlug: string | null } | null;
}

/**
 * The line under a day's head. A day never says "fits" while a stop is not suited: with a family profile it counts the stops that are not suited
 * and the ones nobody has checked (M8). With no counts to add it keeps the scheduler's own reason.
 */
export function dayReason(reason: string, label: string, entries: readonly DayEntry[], ctx: TripSuitValue): string {
  if (ctx.youngest === null) return reason;
  let not = 0;
  let unchecked = 0;
  for (const e of entries) {
    if (e.kind !== 'visit' && e.kind !== 'trail') continue;
    const s = (e.at?.placeSlug ? ctx.byPlace[e.at.placeSlug] : undefined) ?? ctx.byPlace[`n:${norm(e.title)}`];
    const fit = s ? fitFor(s, ctx.youngest) : null;
    if (!fit) unchecked += 1;
    else if (fit.kind !== 'fits') not += 1;
  }
  const tail = unchecked > 0 ? ` · ${unchecked} not checked` : '';
  if (not > 0) return `${label}: Not suited to age ${ctx.youngest} (${not} ${not === 1 ? 'stop' : 'stops'})${tail}`;
  if (/fits age/.test(reason) && unchecked > 0) return `${reason.replace(/fits age (\d+)/, 'fits age $1 where checked')}${tail}`;
  return reason;
}
