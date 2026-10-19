'use client';

import { fmtHM } from '@travel/core/schedule/browser.ts';
import type { DayTimeline } from '@travel/core/schedule/types.ts';
import { DaySign } from '@/components/ui/DaySign';
import { Icon } from '@/components/ui/Icon';
import { anchorBadge, useTripSuit } from '@/components/suit/TripSuit';
import type { TimelineModel } from './model';

const nameKey = (t: string): string => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const START = 5 * 60;
const END = 23 * 60;
const min = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
const pct = (m: number) => `${Math.max(0, Math.min(100, ((m - START) / (END - START)) * 100)).toFixed(1)}%`;

interface Props {
  model: TimelineModel;
  timelines: DayTimeline[];
  changedDays: Set<number>;
  picked: number | null;
  onPick: (n: number) => void;
}

/**
 * The whole trip, Day 1 to N (spec 3.10): each day's span on one 05:00 to 23:00 scale, its version, drive share and warnings.
 * A tap scrolls to the day. Base names mark where the nights change.
 */
export function TripTimeline({ model, timelines, changedDays, picked, onPick }: Props) {
  const { byPlace } = useTripSuit();
  // a day that holds an anchor stop is marked with its badge (relevance 6.2)
  const anchorDays = new Set(model.days.filter((d) => d.input.variants.some((v) => v.items.some((i) => anchorBadge((i.placeSlug ? byPlace[i.placeSlug] : undefined) ?? byPlace[`n:${nameKey(i.title)}`])))).map((d) => d.n));
  const baseChange = new Set(model.days.filter((d, i) => i === 0 || d.base !== model.days[i - 1]!.base).map((d) => d.n));
  return (
    <section className="tl-trip" aria-labelledby="trip-glance-h" id="trip-at-a-glance">
      <h2 id="trip-glance-h" className="trip-h">The trip at a glance</h2>
      <ol className="tl-trip-list">
        {model.days.map((d) => {
          const t = timelines.find((x) => x.day === d.n);
          if (!t) return null;
          const newBase = baseChange.has(d.n);
          const s = min(t.span.start);
          const e = Math.max(s + 20, min(t.span.end));
          const driveShare = t.span.minutes > 0 ? Math.min(1, t.totals.driveMin / t.span.minutes) : 0;
          const warn = t.warnings.length;
          return (
            <li key={d.n} className="tl-trip-item" data-base-change={newBase || undefined} data-picked={picked === d.n || undefined}>
              {newBase && d.base ? <p className="tl-trip-base num">{d.base}</p> : null}
              <a
                href={`#day-${d.n}`}
                className="tl-trip-row"
                onClick={(ev) => {
                  ev.preventDefault();
                  onPick(d.n);
                }}
              >
                <DaySign n={d.n} size="s" state={picked === d.n ? 'focused' : 'quiet'} />
                <span className="tl-trip-title">{model.days.find((x) => x.n === d.n)?.variants.find((v) => v.key === t.variant.key)?.title ?? d.title}</span>
                <span className="tl-bar" aria-hidden="true" hidden={t.blocks || undefined}>
                  <span className="tl-bar-span" style={{ left: pct(s), width: `calc(${pct(e)} - ${pct(s)})` }}>
                    <span className="tl-bar-drive" style={{ width: `${Math.round(driveShare * 100)}%` }} />
                  </span>
                </span>
                <span className="tl-trip-v num">{model.hasVariants ? t.variant.label : ''}</span>
                <span className="tl-trip-drive num">{t.totals.driveMin > 0 ? `${fmtHM(t.totals.driveMin)} drive` : ''}</span>
                <span className="tl-trip-flags" aria-hidden="true">
                  {anchorDays.has(d.n) ? <span className="tl-flag tl-flag-anchor" title="A stop worth the journey"><Icon name="route" size={13} /> Worth the journey</span> : null}
                  {warn ? <span className="tl-flag tl-flag-warn" title={`${warn} ${warn === 1 ? 'warning' : 'warnings'}`}><Icon name="warn" size={13} /> {warn}</span> : null}
                  {changedDays.has(d.n) ? <span className="tl-flag">changed</span> : null}
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
