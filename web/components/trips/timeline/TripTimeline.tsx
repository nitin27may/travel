'use client';

import { fmtHM } from '@travel/core/schedule/browser.ts';
import type { DayTimeline } from '@travel/core/schedule/types.ts';
import { DaySign } from '@/components/ui/DaySign';
import { Icon } from '@/components/ui/Icon';
import { anchorBadge, useTripSuit } from '@/components/suit/TripSuit';
import type { TimelineModel } from './model';

const nameKey = (t: string): string => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const min = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));

/** The clock the strip is drawn on: 05:00 to 23:00, widened once for the whole trip when a day starts earlier or ends later (map note 3). */
export function stripDomain(timelines: DayTimeline[]): { start: number; end: number; ticks: number[] } {
  const real = timelines.filter((t) => !t.blocks && t.span.minutes > 0);
  const start = Math.max(0, Math.min(5 * 60, ...real.map((t) => Math.floor(min(t.span.start) / 60) * 60)));
  const end = Math.min(24 * 60, Math.max(23 * 60, ...real.map((t) => Math.ceil(min(t.span.end) / 60) * 60)));
  const ticks: number[] = [];
  for (let h = Math.ceil(start / 360) * 360; h < end; h += 360) if (h > start) ticks.push(h);
  return { start, end, ticks };
}

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
  const dom = stripDomain(timelines);
  const pct = (m: number) => `${Math.max(0, Math.min(100, ((m - dom.start) / (dom.end - dom.start)) * 100)).toFixed(1)}%`;
  const at = (m: number) => ((m - dom.start) / (dom.end - dom.start)) * 100;
  // hour ticks as a hairline background under every bar; the day's span paints over them
  const ticks = dom.ticks.map((m) => `linear-gradient(to right, transparent calc(${at(m).toFixed(2)}% - 0.5px), var(--line-2) calc(${at(m).toFixed(2)}% - 0.5px), var(--line-2) calc(${at(m).toFixed(2)}% + 0.5px), transparent calc(${at(m).toFixed(2)}% + 0.5px))`).join(', ');
  // when every day is the same version, the column says nothing
  const versions = new Set(timelines.map((t) => t.variant.label));
  const showVersion = model.hasVariants && versions.size > 1;
  const longTrip = model.days.length > 10;
  const scale = (
    <li className="tl-trip-scale" aria-hidden="true">
      <span className="tl-scale-bar">
        {dom.ticks.map((m) => (
          <span key={m} className="tl-scale-tick num" style={{ left: pct(m) }}>{String(m / 60).padStart(2, '0')}</span>
        ))}
      </span>
    </li>
  );
  // a day that holds an anchor stop is marked with its badge (relevance 6.2)
  const anchorDays = new Set(model.days.filter((d) => d.input.variants.some((v) => v.items.some((i) => anchorBadge((i.placeSlug ? byPlace[i.placeSlug] : undefined) ?? byPlace[`n:${nameKey(i.title)}`])))).map((d) => d.n));
  const baseChange = new Set(model.days.filter((d, i) => i === 0 || d.base !== model.days[i - 1]!.base).map((d) => d.n));
  return (
    <section className="tl-trip" aria-labelledby="trip-glance-h" id="trip-at-a-glance">
      <h2 id="trip-glance-h" className="trip-h">The trip at a glance</h2>
      <ol className="tl-trip-list" data-version={showVersion || undefined} style={{ '--ticks': ticks || 'none' } as React.CSSProperties}>
        {scale}
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
                {showVersion ? <span className="tl-trip-v num">{t.variant.label}</span> : null}
                <span className="tl-trip-drive num" aria-label={t.totals.driveMin > 0 ? `${fmtHM(t.totals.driveMin)} driving` : undefined}>
                  {t.totals.driveMin > 0 ? <><Icon name="car" size={13} /> {fmtHM(t.totals.driveMin)}</> : null}
                </span>
                <span className="tl-trip-flags" aria-hidden="true">
                  {anchorDays.has(d.n) ? <span className="tl-flag tl-flag-anchor" title="A stop worth the journey"><Icon name="route" size={13} /> Worth the journey</span> : null}
                  {warn ? <span className="tl-flag tl-flag-warn" title={`${warn} ${warn === 1 ? 'warning' : 'warnings'}`}><Icon name="warn" size={13} /> {warn}</span> : null}
                  {changedDays.has(d.n) ? <span className="tl-flag">changed</span> : null}
                </span>
              </a>
            </li>
          );
        })}
        {longTrip ? scale : null}
      </ol>
    </section>
  );
}
