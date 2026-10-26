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
import { changeDates, moveLegacyOnce, partyText, saveCopy, undoChange, undoSave } from '@/lib/mine/copies';
import { mineStorage } from '@/lib/mine/storage';
import type { CopyInput, CopyItem } from '@travel/core/schema/copies.ts';
import { getTimeline, setYoungest } from '@/lib/export/timelineState';
import type { TripExport } from '@/lib/export/types';
import { CalendarPicker } from './CalendarPicker';
import './actions.css';

/** Final props (lane L0). `window` is the season window as `MM-DD` or `YYYY-MM-DD` pairs; the year is ignored. */
export interface CopySheetProps {
  trip: { slug: string; title: string; nights: number; days: number; window?: { from: string; to: string }; cc?: string | null; photo?: string | null };
  open: boolean;
  onClose: () => void;
  /** Change dates from Mine: the sheet opens with this copy's date and travellers and saves over it, keeping its id (NAV-2). */
  initial?: { id: string; start: string; adults: number; children: number[] };
  /** Called after a copy was added, changed or undone, so Mine re-reads its list. */
  onSaved?: () => void;
}

// a snapshot photo is a same-origin path (core: SITE_PATH); a remote URL is not kept
const sitePath = (p: string | null | undefined): string | null => (p && /^\/(?![/\\])[^\s"<>\\]{1,299}$/.test(p) ? p : null);


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
export function CopySheet({ trip, open, onClose, initial, onSaved }: CopySheetProps) {
  const phone = usePhone();
  const { toast } = useToast();
  const [start, setStart] = useState<string | null>(null);
  const [adults, setAdults] = useState<number | null>(null);
  const [children, setChildren] = useState<(number | null)[]>([]);
  const [step, setStep] = useState<'form' | 'done'>('form');
  const [data, setData] = useState<TripExport | null>(null);
  const [held, setHeld] = useState(true);
  // asked before replacing the copy of the same trip, and the two reasons a copy is refused (nav 3.1, 9)
  const [prompt, setPrompt] = useState<CopyItem | null>(null);
  const [problem, setProblem] = useState<'cap' | 'error' | null>(null);

  useEffect(() => {
    if (!open) return;
    let live = true;
    loadExport('trip', trip.slug).then((d) => live && setData(d)).catch(() => undefined);
    return () => {
      live = false;
    };
  }, [open, trip.slug]);

  // the travellers start from the profile chosen on the page (trip-timeline spec 3.9); the visitor can still change them
  const [prefilled, setPrefilled] = useState(false);
  if (open && !prefilled) {
    setPrefilled(true);
    const tl = getTimeline(trip.slug);
    if (initial) {
      setStart(initial.start);
      setAdults(initial.adults);
      setChildren(initial.children);
    } else if (tl) {
      setAdults(tl.profile.adults >= 2 ? 2 : 1);
      setChildren(tl.profile.party === 'family' && tl.profile.youngest !== null ? [tl.profile.youngest] : []);
    }
  }
  // the youngest child in the sheet is the youngest in the page's profile
  const follow = (ages: (number | null)[]) => {
    const known = ages.filter((a): a is number => a !== null);
    if (ages.length === 0) setYoungest(null);
    else if (known.length === ages.length) setYoungest(Math.min(...known));
  };

  // Only read once the sheet is open, which is always after hydration.
  const today = useMemo(() => (open ? localToday() : null), [open]);
  const length = trip.days;
  const end = start ? addDays(start, Math.max(0, length - 1)) : null;
  const check = useMemo(() => (start ? checkWindow(trip.window, start, length) : null), [start, trip.window, length]);
  const hasCalendar = data ? data.depth !== 'overview' && data.days.length > 0 : true;

  const ready = !!start && adults !== null && children.every((a) => a !== null);
  const missing = [!start && 'a start date', adults === null && 'the number of adults', !children.every((a) => a !== null) && 'each child’s age'].filter(Boolean) as string[];

  // the build flag read directly: importing `lib/capabilities` here would share that module between the page's start chunk and this lazy chunk and split it (start JS)
  const keptNote = process.env.NEXT_PUBLIC_SIGN_IN === '1' ? 'Kept in this browser. Sign in to keep it on every device.' : 'Kept in this browser.';

  const reset = () => {
    setStep('form');
    setPrompt(null);
    setProblem(null);
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

  const copy = (replace = false) => {
    if (!start || adults === null || !children.every((a) => a !== null)) return;
    const probe = mineStorage();
    const ages = children as number[];
    setPrompt(null);
    setProblem(null);
    if (initial) {
      const r = changeDates(probe.storage, initial.id, { start, adults, children: ages });
      if (!r.ok) return setProblem('error');
      toast({ message: `${trip.title} now starts ${formatDate(start)}`, actionLabel: 'Undo', onAction: () => void (undoChange(probe.storage, r.before), onSaved?.()) });
      onSaved?.();
      close();
      return;
    }
    // the old key's drafts move into the envelope first, once per device, so the cap and the replace prompt see them
    moveLegacyOnce(probe.storage);
    const tl = getTimeline(trip.slug);
    const input: CopyInput = {
      slug: trip.slug,
      title: trip.title.slice(0, 120),
      days: trip.days >= 1 ? trip.days : null,
      cc: trip.cc ?? null,
      photo: sitePath(trip.photo),
      start,
      adults,
      children: ages,
      profile: tl ? { party: tl.profile.party, youngest: tl.profile.youngest, pace: tl.profile.pace, adults: tl.profile.adults, walk: tl.profile.walkKm, split: tl.profile.split } : null,
      overrides: tl ? Object.fromEntries(Object.entries(tl.overrides).filter(([k, v]) => /^[1-9]\d?$/.test(k) && /^[ABC]$/.test(v))) as CopyInput['overrides'] : {},
      added: tl ? tl.added.filter((x) => x.day >= 1 && x.day <= 99).slice(0, 30) : [],
    };
    const r = saveCopy(probe.storage, input, { replace });
    if (r.kind === 'exists') return setPrompt(r.existing);
    if (r.kind === 'cap') return setProblem('cap');
    if (r.kind === 'failed') return setProblem('error');
    setHeld(probe.kind === 'local');
    setStep('done');
    onSaved?.();
    toast({
      message: `Copied ${trip.title} to Mine · ${trip.days} days from ${formatDate(start, false)}`,
      actionLabel: 'Undo',
      onAction: () => {
        undoSave(probe.storage, r.item, r.replaced);
        onSaved?.();
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
              <Button size="sm" icon aria-label="Fewer children" disabled={children.length === 0} onClick={() => { const next = children.slice(0, -1); setChildren(next); follow(next); }}>
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
              <select id={`child-age-${i}`} value={age ?? ''} onChange={(e) => { const next = children.map((a, j) => (j === i ? (e.target.value === '' ? null : +e.target.value) : a)); setChildren(next); follow(next); }}>
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
        {held ? (
          <ButtonLink variant="primary" href="/mine/?show=trips">
            Open in Mine
          </ButtonLink>
        ) : (
          <Banner kind="caution" icon="warn">
            This browser is not keeping data, so this copy lasts until you close this tab. The calendar file keeps your dates.
          </Banner>
        )}
        <p>
          {trip.title}, {trip.days} days from {start ? formatDate(start) : ''}, {partyText({ adults: adults ?? 0, children: children as number[] })}.
        </p>
        <ExportList start={start} trip={trip} data={data} hasCalendar={hasCalendar} onRun={run} />
        {held ? <p className="copy-note">{keptNote}</p> : null}
      </div>
    );

  const footer =
    step === 'form' ? (
      <>
        <div className="copy-foot">
          {prompt ? (
            <>
              <Button variant="primary" onClick={() => copy(true)}>
                Replace
              </Button>
              <Button variant="ghost" onClick={() => setPrompt(null)}>
                Cancel
              </Button>
            </>
          ) : (
            <Button variant="primary" disabled={!ready} aria-describedby="copy-foot-note" onClick={() => copy()}>
              {initial ? 'Change dates' : 'Copy to my trips'}
            </Button>
          )}
          <p className="copy-note" id="copy-foot-note" aria-live="polite">
            {prompt
              ? `You already have a copy from ${formatDate(prompt.start)}. Copy again to replace it.`
              : problem === 'cap'
                ? 'You have 20 trip copies on this device, the most we keep. Remove one to copy another.'
                : problem === 'error'
                  ? 'This browser holds trip copies this version of the site cannot change, so nothing was written. Reload the page, or take the files below.'
                  : ready
                    ? keptNote
                    : `Still needed: ${missing.join(', ')}.`}
            {problem === 'cap' ? (
              <>
                {' '}
                <a href="/mine/?show=trips">Open Mine</a>
              </>
            ) : null}
          </p>
        </div>
      </>
    ) : (
      <Button variant={held ? 'secondary' : 'primary'} onClick={close}>
        Done
      </Button>
    );

  const common = { open, title: initial ? 'Change dates' : 'Copy to my trips', footer, className: 'copy-sheet' } as const;
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
  const [full, setFull] = useState(false);
  const session = getTimeline(trip.slug);
  const need = <T,>(f: (d: TripExport) => T) => () => {
    if (!data) throw new Error('not loaded');
    return f(data);
  };
  return (
    <section className="copy-step" aria-labelledby="copy-exports">
      <h3 id="copy-exports">Take it with you</h3>
      <div className="copy-exports">
        {hasCalendar ? (
          <Button disabled={!start || !data} onClick={() => onRun(need((d) => downloadIcs(d, start!, session ? { timelines: session.timelines, sunPoints: session.sunPoints, full } : undefined)))}>
            <Icon name="calendar" size={15} />
            {start && data ? `Calendar (.ics): ${data.days.length} all-day events from ${formatDate(start, false)}` : 'Calendar (.ics): pick a start date first'}
          </Button>
        ) : null}
        {hasCalendar && session ? (
          <label className="copy-full">
            <input type="checkbox" checked={full} onChange={(e) => setFull(e.target.checked)} /> Full detail: add breaks, rest and sun times to the calendar
          </label>
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
