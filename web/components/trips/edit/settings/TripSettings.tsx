'use client';

import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import type { DayTimeline, Profile } from '@travel/core/schedule/types.ts';
import type { PlanDraft, PlanOp } from '@/lib/trip-edit/model';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { SideSheet } from '@/components/ui/SideSheet';
import type { SaveResult, Where } from '@/lib/trip-edit/open';
import { usePhone } from '../panel/useMatchMedia';
import { DatesSection } from './DatesSection';
import { MakeItYours } from './MakeItYours';
import { CopyPlanSection, type Ask } from '../convert/CopyPlanSection';
import { takeSection } from '../convert/store';
import { PartySection } from './PartySection';
import { TitleSection } from './TitleSection';
import { WindowSection, type WindowChoice } from './WindowSection';
import type { Pace } from './PartySection';
import '@/components/actions/actions.css';
import './settings.css';

export interface SettingsProps {
  open: boolean;
  onClose: () => void;
  doc: PlanDraft;
  defaults: Profile;
  /** The title the page shows now: the person's, else the copy's, else our trip's. */
  title: string;
  /** The published trip's own title, for the empty-name hint and for putting the name back. */
  ourTitle: string | null;
  where: Where;
  save: (ops: readonly PlanOp[]) => SaveResult;
  /**
   * Edit mode's way to change the trip: applies the operations as one undo step and raises the toast with Undo (STEP2-E1's session). Absent
   * in read mode, where a change is saved at once without a toast, as before edit mode existed.
   */
  commit?: (ops: PlanOp[], label: string) => boolean;
  /** The days the trip shows now (after added and dropped days). */
  days?: number;
  /** The timelines on screen, for the stops and bookings of a day the Dates section would drop. */
  timelines?: readonly DayTimeline[];
  /** The rows of the Bookings tab, so dropping a day that holds a booking asks first. */
  bookings?: readonly { name: string; day: number | null }[];
  /** The best-time windows of the trip, when it has any (OVR-1); the Window section is not drawn without them. */
  windows?: readonly WindowChoice[];
}

/**
 * The Settings sheet of your own trip (edit-mode-spec 8, 9; STEP2-E4). One sheet, sections in the spec's order: Title, Dates, Who is
 * going, Pace, When to go (only with windows), Make it yours (copies, while editing). A bottom sheet on a phone, a side sheet from 640 px.
 * Each control changes the trip at once through the edit session (an Undo toast), or through the document's own save in read mode;
 * Dates asks one question before Apply when the length changes. There is no Save button (edit-mode-spec 3).
 */
// a built trip's engine sections (STEP2-B2) are their own chunk: they carry the builder's stages, its state machine and the rebuild
const BuiltSettings = lazy(() => import('./built/BuiltSettings'));

export function TripSettings(p: SettingsProps) {
  const phone = usePhone();
  const [failed, setFailed] = useState(false);
  const { commit, save, onClose } = p;
  const run = useCallback(
    (ops: PlanOp[], label: string): boolean => {
      if (!ops.length) return false;
      const ok = commit ? commit(ops, label) : save(ops).ok;
      setFailed(!ok && !commit);
      return ok;
    },
    [commit, save],
  );
  const copy = !!p.doc.template;
  // a copy's first engine action meets the convert notice (STEP2-B3): `asked` is the section or Rebuild it was for; once the copy is converted `start` opens it
  const [asked, setAsked] = useState<Ask | null>(null);
  const [start, setStart] = useState<Ask | null>(null);
  useEffect(() => {
    // a link on the Make it yours card asked for a section before this sheet opened
    if (!p.open) {
      setAsked(null);
      return;
    }
    if (!copy) return;
    const s = takeSection();
    if (s) setAsked(s);
  }, [p.open, copy]);
  // a built trip's pace is staged until Apply (it needs a rebuild); a change to the document (an Apply, an Undo) clears it
  const [staged, setStaged] = useState<{ at: string; pace: Pace | null }>({ at: p.doc.updatedAt, pace: null });
  const stagedPace = staged.at === p.doc.updatedAt ? staged.pace : null;
  const setPace = useCallback((pace: Pace | null) => setStaged({ at: p.doc.updatedAt, pace }), [p.doc.updatedAt]);
  const body = (
    <div className="own-set">
      {failed ? <Banner kind="urgent">Could not save that change. Nothing was changed.</Banner> : null}
      <TitleSection title={p.title} ourTitle={p.ourTitle} where={p.where} open={p.open} run={run} />
      <DatesSection doc={p.doc} days={p.days ?? 1} timelines={p.timelines} bookings={p.bookings ?? []} open={p.open} copy={copy} canClear run={run} />
      <PartySection doc={p.doc} defaults={p.defaults} run={run} {...(copy ? {} : { pace: { value: stagedPace, set: setPace } })} />
      {copy ? null : (
        <Suspense fallback={<p className="own-set-note">Loading the plan settings…</p>}>
          <BuiltSettings key={p.doc.updatedAt} doc={p.doc} pace={stagedPace} onPace={setPace} run={run} start={start} onStarted={() => setStart(null)} />
        </Suspense>
      )}
      {copy && commit ? (
        <CopyPlanSection doc={p.doc} timelines={p.timelines} title={p.title} ourTitle={p.ourTitle} asked={asked} setAsked={setAsked} run={run} onConverted={(a) => { setAsked(null); setStart(a); }} />
      ) : null}
      {copy && p.windows?.length ? <WindowSection windows={p.windows} current={p.doc.template?.window ?? null} run={run} /> : null}
      {copy && commit ? <MakeItYours onClose={onClose} onStart={() => setAsked('start')} /> : null}
      <p className="own-set-note">{p.where === 'device' ? 'Kept in this browser. Sign in to keep it on every device.' : 'Kept in your account and on this device.'}</p>
    </div>
  );
  // "Close", and not the filled "Done": Done leaves edit mode, and one word must not mean two things on one screen (ER-014)
  const footer = <Button onClick={onClose}>Close</Button>;
  const change = (o: boolean) => {
    if (!o) onClose();
  };
  return phone ? (
    <BottomSheet open={p.open} onOpenChange={change} title="Settings" snaps={['half', 'full']} initial="full" footer={footer} className="own-sheet">
      {body}
    </BottomSheet>
  ) : (
    <SideSheet open={p.open} onOpenChange={change} title="Settings" kicker={p.ourTitle ?? undefined} footer={footer} className="own-sheet">
      {body}
    </SideSheet>
  );
}
