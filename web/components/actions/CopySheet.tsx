'use client';

import { useRouter } from 'next/navigation';
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
import type { WriteFailure } from '@/lib/mine/copies';
import { changeDates, moveLegacyOnce, partyText, saveCopy, undoChange, undoSave } from '@/lib/mine/copies';
import { fallBackToMemory, mineStorage } from '@/lib/mine/storage';
import type { CopyInput, CopyItem } from '@travel/core/schema/copies.ts';
import { getTimeline, setParty } from '@/lib/export/timelineState';
import type { Party } from '@travel/core/trips/party.ts';
import { Travellers } from './Travellers';
import type { TripExport } from '@/lib/export/types';
import { CalendarPicker } from './CalendarPicker';
import './actions.css';

/** Final props (lane L0). `window` is the season window as `MM-DD` or `YYYY-MM-DD` pairs; the year is ignored. */
export interface CopySheetProps {
  trip: { slug: string; title: string; nights: number; days: number; window?: { from: string; to: string }; seasonMonths?: number[]; cc?: string | null; photo?: string | null };
  open: boolean;
  onClose: () => void;
  /** Change dates from Mine: the sheet opens with this copy's date (null: none yet) and travellers and saves over it, keeping its id (NAV-2). */
  initial?: { id: string; start: string | null; adults: number; children: number[] };
  /** Called after a copy was added, changed or undone, so Mine re-reads its list. */
  onSaved?: () => void;
  /**
   * Change dates on a trip kept in the account (edit-my-trip, EM-2): the caller applies the change through the sync and shows its own
   * toast; return false when it could not be applied. Without it the change is written to this device's copies, as before.
   */
  commit?: (change: { start: string | null; adults: number; children: number[] }) => boolean;
  /** The trip page's print: the list shows its PDF button only when this is given (on Mine, Print is in the row menu). */
  onPrint?: () => void;
}

/** First and last day of the season as "MM-DD" (no year: public trips are dateless). A run may wrap the new year. */
export function seasonWindow(months: number[] | undefined): { from: string; to: string } | undefined {
  if (!months?.length) return undefined;
  const set = new Set(months);
  const start = months.find((m) => !set.has(m === 1 ? 12 : m - 1)) ?? months[0];
  let end = start;
  while (set.has(end === 12 ? 1 : end + 1) && end !== (start === 1 ? 12 : start - 1)) end = end === 12 ? 1 : end + 1;
  const last = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][end - 1];
  const mm = (m: number) => String(m).padStart(2, '0');
  return { from: `${mm(start)}-01`, to: `${mm(end)}-${last}` };
}

/** Why a write was refused, in the sheet's words (NAV-R2 should 6). `blocked` and `unverified` take the session-only path instead. */
function problemFor(reason: WriteFailure): 'quota' | 'changed' | 'error' {
  return reason === 'quota' ? 'quota' : reason === 'changed' ? 'changed' : 'error';
}
const PROBLEM_TEXT = {
  cap: 'You have 20 trip copies on this device, the most we keep. Remove one to copy another.',
  quota: 'This browser is out of space for this site, so nothing was written. Take the files below.',
  changed: 'Your trips changed in another tab. Try again.',
  error: 'This browser holds trip copies this version of the site cannot change, so nothing was written. Reload the page, or take the files below.',
} as const;

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
 * dates attach here. The date is optional (SW-008): nothing is picked for the visitor, and with none picked the field reads
 * "No date yet" and Copy still works, so a family still deciding when to go can keep the trip and add dates later (Mine's
 * "No date" group, the trip's Settings). A picked date can be cleared with "No date yet". Signing in is a later lane: until
 * then the copy is held in this browser, and the sheet says so and points at the files.
 * The exports are live in both steps: the calendar uses the picked start date, and asks for one when there is none.
 */
export function CopySheet({ trip, open, onClose, initial, onSaved, commit, onPrint }: CopySheetProps) {
  const phone = usePhone();
  const router = useRouter();
  const { toast } = useToast();
  const [start, setStart] = useState<string | null>(null);
  const [party, setPartyState] = useState<Party>({ adults: 2, children: [] });
  const { adults, children } = party;
  const [step, setStep] = useState<'form' | 'done'>('form');
  const [data, setData] = useState<TripExport | null>(null);
  const [held, setHeld] = useState(true);
  // asked before replacing the copy of the same trip, and the two reasons a copy is refused (nav 3.1, 9)
  const [prompt, setPrompt] = useState<CopyItem | null>(null);
  const [undoable, setUndo] = useState<{ item: CopyItem; replaced: CopyItem | null; replacedEdits: Parameters<typeof undoSave>[3]; storage: Parameters<typeof undoSave>[0] } | null>(null);
  const [problem, setProblem] = useState<'cap' | 'quota' | 'changed' | 'error' | null>(null);

  useEffect(() => {
    if (!open) return;
    let live = true;
    loadExport('trip', trip.slug).then((d) => live && setData(d)).catch(() => undefined);
    return () => {
      live = false;
    };
  }, [open, trip.slug]);

  // The travellers start from the party kept on this device when the page plans for it (`travel.party`: both ages, not only the youngest),
  // else from what the page's profile implies (trip-timeline spec 3.9); the visitor can still change them. Mine's Change dates starts from the copy.
  const [prefilled, setPrefilled] = useState(false);
  if (open && !prefilled) {
    setPrefilled(true);
    if (initial) {
      setStart(initial.start);
      setPartyState({ adults: initial.adults, children: initial.children });
    } else {
      const tl = getTimeline(trip.slug);
      void import('@/lib/storage/partyKey').then(async ({ readParty }) => {
        const { partyFromProfile, sameWho, whoOf } = await import('@/components/trips/timeline/partyLogic');
        const kept = readParty();
        if (kept && (!tl || sameWho(whoOf(kept, tl.profile), tl.profile))) setPartyState(kept);
        else if (tl) setPartyState(partyFromProfile(tl.profile));
      });
    }
  }
  // a change in the sheet is the party of the page too, and is kept on this device (not for Mine's Change dates, which edits one copy)
  const changeParty = (next: Party) => {
    setPartyState(next);
    if (initial) return;
    if (!setParty(next)) void import('@/lib/storage/partyKey').then((m) => m.writeParty(next));
  };

  // Only read once the sheet is open, which is always after hydration.
  const today = useMemo(() => (open ? localToday() : null), [open]);
  const length = trip.days;
  const end = start ? addDays(start, Math.max(0, length - 1)) : null;
  // Change dates from Mine has no window of its own: the export model, once loaded, carries the trip's months
  const seasonWin = useMemo(() => trip.window ?? seasonWindow(trip.seasonMonths ?? data?.seasonMonths), [trip.window, trip.seasonMonths, data?.seasonMonths]);
  const check = useMemo(() => (start ? checkWindow(seasonWin, start, length) : null), [start, seasonWin, length]);
  const hasCalendar = data ? data.depth !== 'overview' && data.days.length > 0 : true;

  // the date is optional (SW-008); only each child's age is needed
  const ready = children.every((a) => a !== null);
  const missing = [!children.every((a) => a !== null) && 'each child’s age'].filter(Boolean) as string[];

  // the build flag read directly: importing `lib/capabilities` here would share that module between the page's start chunk and this lazy chunk and split it (start JS)
  const keptNote = process.env.NEXT_PUBLIC_SIGN_IN === '1' ? 'Kept in this browser. Sign in to keep it on every device.' : 'Kept in this browser.';

  const reset = () => {
    setStep('form');
    setPrompt(null);
    setProblem(null);
    setUndo(null);
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
    if (!children.every((a) => a !== null)) return;
    let probe = mineStorage();
    const ages = children as number[];
    setPrompt(null);
    setProblem(null);
    if (initial && commit) {
      if (!commit({ start, adults, children: ages })) return setProblem('error');
      onSaved?.();
      close();
      return;
    }
    if (initial) {
      let r = changeDates(probe.storage, initial.id, { start, adults, children: ages });
      if (!r.ok && r.reason === 'changed') r = changeDates(probe.storage, initial.id, { start, adults, children: ages });
      if (!r.ok) return setProblem(problemFor(r.reason));
      toast({
        message: start ? `${trip.title} now starts ${formatDate(start)}` : `${trip.title} has no date now`,
        actionLabel: 'Undo',
        onAction: () => void (undoChange(probe.storage, r.before), onSaved?.()),
      });
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
      profile: tl ? { party: tl.profile.party, youngest: tl.profile.youngest, pace: tl.profile.pace, adults, walk: tl.profile.walkKm, split: tl.profile.split } : null,
      overrides: tl ? Object.fromEntries(Object.entries(tl.overrides).filter(([k, v]) => /^[1-9]\d?$/.test(k) && /^[ABC]$/.test(v))) as CopyInput['overrides'] : {},
      added: tl ? tl.added.filter((x) => x.day >= 1 && x.day <= 99).slice(0, 30) : [],
    };
    let r = saveCopy(probe.storage, input, { replace });
    // another tab wrote between our read and our write: once more, silently
    if (r.kind === 'failed' && r.reason === 'changed') r = saveCopy(probe.storage, input, { replace });
    // a store that refuses or drops the write: the session-only path (this tab keeps it, and the done step says so)
    if (r.kind === 'failed' && (r.reason === 'blocked' || r.reason === 'unverified')) {
      probe = fallBackToMemory();
      r = saveCopy(probe.storage, input, { replace });
    }
    if (r.kind === 'exists') return setPrompt(r.existing);
    if (r.kind === 'cap') return setProblem('cap');
    if (r.kind === 'failed') return setProblem(problemFor(r.reason));
    setHeld(probe.kind === 'local');
    setUndo({ item: r.item, replaced: r.replaced, replacedEdits: r.replacedEdits, storage: probe.storage });
    onSaved?.();
    // Step 2 (OQ7, patterns 3.7): with `tripEdit` on the copy opens the copy, in edit mode on its days, and the toast carries Undo (the sheet is
    // gone by then, so the toast is out of no focus trap). Storage blocked keeps the done step: the copy lasts only in this tab, and the done
    // step says so and leads with the calendar file. The flag is written out so a build with it off drops this branch.
    if (process.env.NEXT_PUBLIC_TRIP_EDIT === '1' && probe.kind === 'local') {
      const { item, replaced, replacedEdits } = r;
      const storage = probe.storage;
      toast({
        message: `Copied ${trip.title.replace(/,\s*\d+ nights?$/, '')} to My trips`,
        actionLabel: 'Undo',
        onAction: () => {
          undoSave(storage, item, replaced, replacedEdits);
          onSaved?.();
          router.push(`/trips/${trip.slug}/`);
        },
      });
      router.push(`/t/${item.id}/?edit=1&view=day`);
      close();
      return;
    }
    setStep('done');
    // no toast: the sheet is modal, so a toast's Undo is out of the focus trap; the done step's footer holds Undo
  };
  const undo = () => {
    if (!undoable) return;
    undoSave(undoable.storage, undoable.item, undoable.replaced, undoable.replacedEdits);
    onSaved?.();
    setUndo(null);
    setStep('form');
  };

  const body =
    step === 'form' ? (
      <div className="copy-body">
        <section className="copy-step" aria-labelledby="copy-when">
          <h3 id="copy-when">When does it start</h3>
          <div className="copy-date-input" data-empty={start ? undefined : ''} data-testid="copy-date" aria-live="polite">
            <Icon name="calendar" size={16} />
            {start ? formatDate(start) : 'No date yet'}
          </div>
          {today ? <CalendarPicker value={start} onChange={setStart} year={Number(/-(\d{4})$/.exec(trip.slug)?.[1]) || undefined} window={seasonWin} length={length} today={today} /> : null}
          {start && end ? (
            <div className="copy-when-row">
              <p className="copy-summary">
                {trip.days} days, {formatDate(start, false)} to {formatDate(end)}
              </p>
              <Button size="sm" variant="secondary" onClick={() => setStart(null)} aria-label="No date yet: clear the start date">
                <Icon name="close" size={14} /> No date yet
              </Button>
            </div>
          ) : (
            <p className="copy-summary copy-nodate">Optional. Pick Day 1 now, or copy it without a date and add dates later in Mine.</p>
          )}
          {check && !check.ok ? (
            <Banner kind="caution">
              {check.startOutside ? 'Day 1 falls' : 'The last day falls'} outside the season this plan is built for
              {data?.seasonLabel ? ` (${data.seasonLabel.toLowerCase()})` : ''}. Lifts, huts or roads may be closed.
            </Banner>
          ) : null}
        </section>

        <section className="copy-step trav" aria-labelledby="copy-who">
          <h3 id="copy-who">Who is going</h3>
          <Travellers party={party} onChange={changeParty} />
        </section>

        <ExportList start={start} trip={trip} data={data} hasCalendar={hasCalendar} onRun={run} print={onPrint} />
      </div>
    ) : (
      <div className="copy-body copy-done">
        {held ? (
          // tripEdit off (production until GO-2): the done step leads with Open in Mine. With it on the copy opens straight away (above)
          <ButtonLink variant="primary" href="/mine/?show=trips">
            Open in Mine
          </ButtonLink>
        ) : (
          <Banner kind="caution" icon="warn">
            This browser is not keeping data, so this copy lasts until you close this tab. The calendar file keeps your dates.
          </Banner>
        )}
        <p>
          <strong>{trip.title}</strong>
          <br />
          {start ? `${trip.days} days from ${formatDate(start)}` : `${trip.days} days · No date yet`} · {partyText({ adults, children: children as number[] })}
        </p>
        <ExportList start={start} trip={trip} data={data} hasCalendar={hasCalendar} onRun={run} print={onPrint} />
        {held ? <p className="copy-note">{keptNote}</p> : null}
      </div>
    );

  const note = prompt
    ? prompt.start
      ? `You already have a copy from ${formatDate(prompt.start)}. Copy again to replace it.`
      : 'You already have a copy of this trip with no date yet. Copy again to replace it.'
    : problem
      ? PROBLEM_TEXT[problem]
      : ready
        ? keptNote
        : `Still needed: ${missing.join(', ')}.`;
  const footer =
    step === 'form' ? (
      <div className="copy-foot" data-stack={prompt || problem ? '' : undefined}>
        {prompt ? (
          <>
            <Button variant="primary" onClick={() => copy(true)}>
              Replace
            </Button>
            <Button variant="ghost" onClick={() => setPrompt(null)}>
              Cancel
            </Button>
          </>
        ) : problem === 'cap' ? (
          // the cap leaves nothing to press again: the way out is Mine, where a copy can be removed
          <>
            <ButtonLink variant="primary" href="/mine/?show=trips">
              Open Mine
            </ButtonLink>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
          </>
        ) : (
          <Button variant="primary" disabled={!ready} aria-describedby="copy-foot-note" onClick={() => copy()}>
            {initial ? (initial.start ? 'Change dates' : 'Add dates') : 'Copy to my trips'}
          </Button>
        )}
        <p className="copy-note" id="copy-foot-note" aria-live="polite">
          {note}
        </p>
      </div>
    ) : (
      <div className="copy-foot">
        <Button variant={held ? 'secondary' : 'primary'} onClick={close}>
          Done
        </Button>
        {undoable ? (
          <Button variant="ghost" onClick={undo}>
            Undo
          </Button>
        ) : null}
      </div>
    );

  const common = { open, title: initial ? (initial.start ? 'Change dates' : 'Add dates') : 'Copy to my trips', footer, className: 'copy-sheet' } as const;
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
  print,
}: {
  start: string | null;
  trip: CopySheetProps['trip'];
  data: TripExport | null;
  hasCalendar: boolean;
  onRun: (make: () => Generated) => void;
  print?: () => void;
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
        {print ? (
          <Button onClick={print}>
            <Icon name="download" size={15} /> PDF: print {trip.title}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
