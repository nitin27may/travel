'use client';

import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { addDays, cellLabel, DOW_LONG, inWindow, iso, MONTH_LONG, parseIso, shadeOf } from '@/lib/export/dates';
import type { SeasonWindow } from '@/lib/export/dates';

interface Props {
  value: string | null;
  onChange: (date: string) => void;
  window?: SeasonWindow;
  /** Trip length; the days after the start fill with the range tint. */
  length: number;
  /** ISO date of today (the first selectable day). */
  today: string;
  label?: string;
}

const monthStart = (d: string) => `${d.slice(0, 7)}-01`;
const shiftMonth = (d: string, n: number): string => {
  const x = parseIso(monthStart(d));
  x.setUTCMonth(x.getUTCMonth() + n);
  return iso(x);
};

/** The same day of the month `n` months away, clamped to the month's last day (31 Jan + 1 month = 28 Feb). */
function sameDayIn(d: string, n: number): string {
  const m = shiftMonth(d, n);
  const last = new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).getUTCDate();
  return `${m.slice(0, 8)}${String(Math.min(+d.slice(8), last)).padStart(2, '0')}`;
}

/** First date on or after `today` that falls on the window's opening day; where the picker opens. */
function openingDate(today: string, w?: SeasonWindow): string {
  if (!w) return today;
  const md = w.from.length >= 10 ? w.from.slice(5, 10) : w.from.slice(0, 5);
  const thisYear = `${today.slice(0, 4)}-${md}`;
  return thisYear >= today ? thisYear : `${+today.slice(0, 4) + 1}-${md}`;
}

/**
 * Month grid with the F03 shading (components 2.4): weekends, long weekends with the holiday named, school breaks, and
 * the trip's season window underlined. `role="grid"`; arrows move a day, PageUp and PageDown a month, Home and End
 * the week; Enter or Space picks. Nothing is selected until the visitor picks.
 */
export function CalendarPicker({ value, onChange, window: season, length, today, label = 'Start date' }: Props) {
  const start = useMemo(() => value ?? openingDate(today, season), [value, today, season]);
  const [shown, setShown] = useState(monthStart(start));
  const [focus, setFocus] = useState(start);
  const grid = useRef<HTMLDivElement>(null);

  const first = parseIso(shown);
  const lead = first.getUTCDay();
  const daysIn = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysIn }, (_, i) => addDays(shown, i))];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
  const end = value ? addDays(value, Math.max(0, length - 1)) : null;
  const tabTarget = focus.startsWith(shown.slice(0, 7)) && focus >= today ? focus : (cells.find((c) => c && c >= today) ?? null);
  const schoolHere = [...new Set(cells.filter((c): c is string => !!c).map((c) => shadeOf(c).schoolBreak).filter(Boolean))] as string[];

  const move = (to: string) => {
    if (to < today) return;
    setFocus(to);
    if (monthStart(to) !== shown) setShown(monthStart(to));
    requestAnimationFrame(() => grid.current?.querySelector<HTMLButtonElement>(`[data-date="${to}"]`)?.focus());
  };
  const onKey = (e: React.KeyboardEvent) => {
    const k = e.key;
    const dow = parseIso(focus).getUTCDay();
    const map: Record<string, string> = {
      ArrowLeft: addDays(focus, -1),
      ArrowRight: addDays(focus, 1),
      ArrowUp: addDays(focus, -7),
      ArrowDown: addDays(focus, 7),
      Home: addDays(focus, -dow),
      End: addDays(focus, 6 - dow),
      PageUp: sameDayIn(focus, -1),
      PageDown: sameDayIn(focus, 1),
    };
    if (map[k]) {
      e.preventDefault();
      move(map[k]);
    }
  };

  return (
    <div className="cal" role="group" aria-label={label}>
      <div className="cal-month">
        <div className="cal-head">
          <Button size="sm" variant="ghost" icon aria-label="Previous month" disabled={shiftMonth(shown, 0) <= monthStart(today)} onClick={() => setShown(shiftMonth(shown, -1))}>
            <Icon name="chevronLeft" size={16} />
          </Button>
          <div style={{ textAlign: 'center' }}>
            <div className="cal-title" aria-live="polite">
              {MONTH_LONG[first.getUTCMonth()]} {first.getUTCFullYear()}
            </div>
            {schoolHere.length ? <div className="cal-break">{schoolHere.join(' · ')}</div> : null}
          </div>
          <Button size="sm" variant="ghost" icon aria-label="Next month" onClick={() => setShown(shiftMonth(shown, 1))}>
            <Icon name="chevronRight" size={16} />
          </Button>
        </div>
        <div ref={grid} role="grid" aria-label={`${MONTH_LONG[first.getUTCMonth()]} ${first.getUTCFullYear()}`} onKeyDown={onKey}>
          <div role="row" className="cal-grid">
            {DOW_LONG.map((d) => (
              <div key={d} role="columnheader" className="cal-dow" aria-label={d}>
                {d.slice(0, 3)}
              </div>
            ))}
          </div>
          {weeks.map((w, wi) => (
            <div role="row" className="cal-grid" key={wi}>
              {w.map((d, di) => {
                if (!d) return <div key={di} className="cal-pad" role="gridcell" aria-hidden="true" />;
                const s = shadeOf(d);
                const sel = d === value;
                const past = d < today;
                const inSeason = season ? inWindow(season, d) : null;
                return (
                  <button
                    key={d}
                    type="button"
                    role="gridcell"
                    className="cal-cell"
                    data-date={d}
                    data-weekend={s.weekend || undefined}
                    data-long={s.longWeekend || undefined}
                    data-school={s.schoolBreak || undefined}
                    data-season={inSeason || undefined}
                    data-today={d === today || undefined}
                    data-range={value && end && d > value && d <= end ? '' : undefined}
                    aria-selected={sel}
                    aria-label={cellLabel(d, s, inSeason)}
                    title={s.longWeekend ? `Long weekend: ${s.longWeekend}` : s.schoolBreak ? `${s.schoolBreak} (approximate)` : undefined}
                    disabled={past}
                    tabIndex={d === tabTarget ? 0 : -1}
                    onClick={() => {
                      setFocus(d);
                      onChange(d);
                    }}
                  >
                    {+d.slice(8)}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="cal-legend" aria-hidden="true">
        <span><i className="cal-sw" data-k="weekend" /> Weekend</span>
        <span><i className="cal-sw" data-k="long" /> Long weekend</span>
        <span><i className="cal-sw" data-k="school" /> School break</span>
        {season ? <span><i className="cal-sw" data-k="season" /> Trip season</span> : null}
      </div>
    </div>
  );
}
