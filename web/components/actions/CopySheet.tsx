'use client';

import { useEffect, useMemo, useState } from 'react';
import { Banner } from '@/components/ui/Banner';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { SideSheet } from '@/components/ui/SideSheet';
import { useToast } from '@/components/ui/Toast';
import { downloadGpx, downloadIcs, downloadTripCsv, loadExport } from '@/lib/export/client';
import type { Generated } from '@/lib/export/client';
import { addDays, checkWindow, formatDate, iso } from '@/lib/export/dates';
import { removeDraft, saveDraft } from '@/lib/export/draft';
import type { TripExport } from '@/lib/export/types';
import { CalendarPicker } from './CalendarPicker';
import './actions.css';

/** Final props (lane L0). `window` is the season window as `MM-DD` or `YYYY-MM-DD` pairs; the year is ignored. */
export interface CopySheetProps {
  trip: { slug: string; title: string; nights: number; days: number; window?: { from: string; to: string } };
  open: boolean;
  onClose: () => void;
}

function usePhone(): boolean {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const q = window.matchMedia('(max-width: 639px)');
    const sync = () => setPhone(q.matches);
    sync();
    q.addEventListener('change', sync);
    return () => q.removeEventListener('change', sync);
  }, []);
  return phone;
}

const localToday = (): string => {
  const d = new Date();
  return iso(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())));
};

/**
 * Copy to my trips (patterns 3.7). Asks for a start date and who is going, nothing else; the copy keeps days, and the
 * dates attach here. Nothing is picked for the visitor, so the primary stays off until a date is chosen. Signing in is a
 * later lane: until then the copy is held in this browser, and the sheet says so and points at the files.
 * The exports are live in both steps: the calendar uses the picked start date.
 */
export function CopySheet({ trip, open, onClose }: CopySheetProps) {
  const phone = usePhone();
  const { toast } = useToast();
  const [start, setStart] = useState<string | null>(null);
  const [adults, setAdults] = useState<number | null>(null);
  const [children, setChildren] = useState<(number | null)[]>([]);
  const [step, setStep] = useState<'form' | 'done'>('form');
  const [data, setData] = useState<TripExport | null>(null);
  const [held, setHeld] = useState(true);

  useEffect(() => {
    if (!open) return;
    let live = true;
    loadExport('trip', trip.slug).then((d) => live && setData(d)).catch(() => undefined);
    return () => {
      live = false;
    };
  }, [open, trip.slug]);

  // Only read once the sheet is open, which is always after hydration.
  const today = useMemo(() => (open ? localToday() : null), [open]);
  const length = trip.days;
  const end = start ? addDays(start, Math.max(0, length - 1)) : null;
  const check = useMemo(() => (start ? checkWindow(trip.window, start, length) : null), [start, trip.window, length]);
  const hasCalendar = data ? data.depth !== 'overview' && data.days.length > 0 : true;

  const ready = !!start && adults !== null && children.every((a) => a !== null);
  const missing = [!start && 'a start date', adults === null && 'the number of adults', !children.every((a) => a !== null) && 'each child’s age'].filter(Boolean) as string[];

  const reset = () => {
    setStep('form');
  };
  const close = () => {
    onClose();
    // Let the closing transition finish before the form returns to its first step.
    setTimeout(reset, 250);
  };

  const run = (make: () => Generated) => {
    try {
      const r = make();
      toast({ message: `Downloaded ${r.name} · ${r.summary}` });
    } catch {
      toast({ message: 'Could not build that file. Try again.' });
    }
  };

  const copy = () => {
    if (!start || adults === null || !children.every((a) => a !== null)) return;
    setHeld(saveDraft({ slug: trip.slug, start, adults, children: children as number[] }));
    setStep('done');
    toast({
      message: `Copied ${trip.title} · ${trip.days} days from ${formatDate(start, false)}`,
      actionLabel: 'Undo',
      onAction: () => {
        removeDraft(trip.slug);
        setStep('form');
      },
    });
  };

  const body =
    step === 'form' ? (
      <div className="copy-body">
        <section className="copy-step" aria-labelledby="copy-when">
          <h3 id="copy-when">When does it start</h3>
          <div className="copy-date-input" data-empty={start ? undefined : ''} aria-live="polite">
            <Icon name="calendar" size={16} />
            {start ? formatDate(start) : 'Pick the day 1 date'}
          </div>
          {today ? <CalendarPicker value={start} onChange={setStart} window={trip.window} length={length} today={today} /> : null}
          {start && end ? (
            <p className="copy-summary">
              {trip.days} days, {formatDate(start, false)} to {formatDate(end)}
            </p>
          ) : null}
          {check && !check.ok ? (
            <Banner kind="caution">
              {check.startOutside ? 'Day 1 falls' : 'The last day falls'} outside the season this plan is built for
              {data?.seasonLabel ? ` (${data.seasonLabel.toLowerCase()})` : ''}. Lifts, huts or roads may be closed.
            </Banner>
          ) : null}
        </section>

        <section className="copy-step trav" aria-labelledby="copy-who">
          <h3 id="copy-who">Who is going</h3>
          <div className="trav-row">
            <label className="trav-name" htmlFor="trav-adults">Adults</label>
            <select id="trav-adults" className="trav-select" value={adults ?? ''} onChange={(e) => setAdults(e.target.value ? +e.target.value : null)}>
              <option value="">Choose</option>
              {Array.from({ length: 10 }, (_, i) => (
                <option key={i} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          </div>
          <div className="trav-row">
            <span className="trav-name" id="trav-kids">Children</span>
            <span className="trav-step" role="group" aria-labelledby="trav-kids">
              <Button size="sm" icon aria-label="Fewer children" disabled={children.length === 0} onClick={() => setChildren(children.slice(0, -1))}>
                <Icon name="minus" size={14} />
              </Button>
              <span className="trav-n" aria-live="polite">{children.length}</span>
              <Button size="sm" icon aria-label="More children" disabled={children.length >= 8} onClick={() => setChildren([...children, null])}>
                <Icon name="plus" size={14} />
              </Button>
            </span>
          </div>
          {children.map((age, i) => (
            <div className="trav-child" key={i}>
              <label htmlFor={`child-age-${i}`}>Child {i + 1} age</label>
              <select id={`child-age-${i}`} value={age ?? ''} onChange={(e) => setChildren(children.map((a, j) => (j === i ? (e.target.value === '' ? null : +e.target.value) : a)))}>
                <option value="">Choose age</option>
                {Array.from({ length: 18 }, (_, a) => (
                  <option key={a} value={a}>
                    {a === 0 ? 'Under 1' : a}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </section>

        <ExportList start={start} trip={trip} data={data} hasCalendar={hasCalendar} onRun={run} />
      </div>
    ) : (
      <div className="copy-body copy-done">
        <Banner kind="caution" icon="warn">
          {held
            ? 'This copy is held in this browser only. Clearing site data, or opening the site on another device, loses it. Trips you keep and edit come with the planner, which is not open yet, so take the files below.'
            : 'This browser would not keep the copy, and the planner that keeps trips is not open yet. Take the files below before you leave.'}
        </Banner>
        <p>
          {trip.title}, {trip.days} days from {start ? formatDate(start) : ''}, {adults ?? 0} adult{adults === 1 ? '' : 's'}
          {children.length ? ` and ${children.length} child${children.length === 1 ? '' : 'ren'}` : ''}.
        </p>
        <ExportList start={start} trip={trip} data={data} hasCalendar={hasCalendar} onRun={run} />
      </div>
    );

  const footer =
    step === 'form' ? (
      <>
        <div className="copy-foot">
          <Button variant="primary" disabled={!ready} aria-describedby="copy-foot-note" onClick={copy}>
            Copy to my trips
          </Button>
          <p className="copy-note" id="copy-foot-note">
            {ready ? 'Keeping copies in an account comes with the planner. The calendar and print files work now.' : `Still needed: ${missing.join(', ')}.`}
          </p>
        </div>
      </>
    ) : (
      <>
        <Button variant="primary" onClick={close}>Done</Button>
        <ButtonLink variant="ghost" href="/sign-in/">
          About the planner
        </ButtonLink>
      </>
    );

  const common = { open, title: 'Copy to my trips', footer, className: 'copy-sheet' } as const;
  const change = (o: boolean) => {
    if (!o) close();
  };
  return phone ? (
    <BottomSheet {...common} onOpenChange={change} snaps={['half', 'full']} initial="full">
      {body}
    </BottomSheet>
  ) : (
    <SideSheet {...common} onOpenChange={change} kicker={trip.title}>
      {body}
    </SideSheet>
  );
}

function ExportList({
  start,
  trip,
  data,
  hasCalendar,
  onRun,
}: {
  start: string | null;
  trip: CopySheetProps['trip'];
  data: TripExport | null;
  hasCalendar: boolean;
  onRun: (make: () => Generated) => void;
}) {
  const need = <T,>(f: (d: TripExport) => T) => () => {
    if (!data) throw new Error('not loaded');
    return f(data);
  };
  return (
    <section className="copy-step" aria-labelledby="copy-exports">
      <h3 id="copy-exports">Take it with you</h3>
      <div className="copy-exports">
        {hasCalendar ? (
          <Button disabled={!start || !data} onClick={() => onRun(need((d) => downloadIcs(d, start!)))}>
            <Icon name="calendar" size={15} />
            {start && data ? `Calendar (.ics): ${data.days.length} all-day events from ${formatDate(start, false)}` : 'Calendar (.ics): pick a start date first'}
          </Button>
        ) : null}
        <Button disabled={!data} onClick={() => onRun(need(downloadGpx))}>
          <Icon name="download" size={15} /> GPX: stops, trailheads, parking
        </Button>
        {data && data.depth !== 'overview' ? (
          <Button onClick={() => onRun(need(downloadTripCsv))}>
            <Icon name="download" size={15} /> CSV: {data.stops.length} stops
          </Button>
        ) : null}
        <Button onClick={() => window.print()}>
          <Icon name="download" size={15} /> PDF: print {trip.title}
        </Button>
      </div>
    </section>
  );
}
