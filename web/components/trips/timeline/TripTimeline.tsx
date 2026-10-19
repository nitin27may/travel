'use client';

import { fmtHM } from '@travel/core/schedule/browser.ts';
import type { DayTimeline } from '@travel/core/schedule/types.ts';
import { DaySign } from '@/components/ui/DaySign';
import { Icon } from '@/components/ui/Icon';
import type { TimelineModel } from './model';

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
  const baseChange = new Set(model.days.filter((d, i) => i === 0 || d.base !== model.days[i - 1]!.base).map((d) => d.n));
  return (
    <section className="tl-trip" aria-labelledby="trip-glance-h" id="trip-at-a-glance">
      <h2 id="trip-glance-h" className="trip-h">The trip at a glance</h2>
      <p className="trip-sec-note num tl-scale" aria-hidden="true">
        <span>05:00</span><span>11:00</span><span>17:00</span><span>23:00</span>
      </p>
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
                aria-label={`Day ${d.n}, ${d.title}, ${t.span.start} to ${t.span.end}, ${t.variant.label}${warn ? `, ${warn} ${warn === 1 ? 'warning' : 'warnings'}` : ''}`}
              >
                <DaySign n={d.n} size="s" state={picked === d.n ? 'focused' : 'quiet'} />
                <span className="tl-trip-title">{d.title}</span>
                <span className="tl-bar" aria-hidden="true">
                  <span className="tl-bar-span" style={{ left: pct(s), width: `calc(${pct(e)} - ${pct(s)})` }}>
                    <span className="tl-bar-drive" style={{ width: `${Math.round(driveShare * 100)}%` }} />
                  </span>
                </span>
                <span className="tl-trip-v num">{model.hasVariants ? t.variant.label : ''}</span>
                <span className="tl-trip-drive num">{t.totals.driveMin > 0 ? `${fmtHM(t.totals.driveMin)} drive` : ''}</span>
                <span className="tl-trip-flags" aria-hidden="true">
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
