'use client';

import { useEffect, useState } from 'react';
import type { PlanOp } from '@/lib/trip-edit/model';
import type { Profile } from '@travel/core/schedule/types.ts';
import type { PlanDraft } from '@/lib/trip-edit/model';
import { planAge } from '@travel/core/trips/party.ts';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';
import { Segmented } from '@/components/ui/Segmented';
import { SideSheet } from '@/components/ui/SideSheet';
import { Icon } from '@/components/ui/Icon';
import { CalendarPicker } from '@/components/actions/CalendarPicker';
import { Travellers } from '@/components/actions/Travellers';
import { formatDate, iso } from '@/lib/export/dates';
import { TRIP_NAME_MAX } from '@/lib/config/product';
import { partyOps, profileOfDraft } from '@/lib/trip-edit/source';
import type { SaveResult, Where } from '@/lib/trip-edit/open';
import '@/components/actions/actions.css';
import './shell.css';

const PACES = [
  { value: 'relaxed', label: 'Relaxed' },
  { value: 'standard', label: 'Standard' },
  { value: 'full', label: 'Full' },
] as const;
const newOpId = (): string => `o-${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

interface Props {
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
  /** The trip's length, for the calendar's range tint. */
  days?: number;
}

/**
 * The trip's name, start date, who is going and pace: the edits the page already had, now saved to the document (STEP2-T1). A bottom
 * sheet on a phone, a side sheet from 640 px, as the copy sheet. Every control saves at once; there is no Save button (edit-mode-spec 3).
 */
export function TripSettings({ open, onClose, doc, defaults, title, ourTitle, where, save, days = 1 }: Props) {
  const [calendar, setCalendar] = useState(false);
  const [today, setToday] = useState<string | null>(null);
  // the calendar needs the local date, read after hydration
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { const d = new Date(); setToday(iso(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())))); }, [open]);
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const q = window.matchMedia('(max-width: 639px)');
    const on = () => setPhone(q.matches);
    on();
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);
  const [name, setName] = useState(title);
  const [failed, setFailed] = useState(false);
  // the field follows the page's title when it changes elsewhere or the sheet reopens
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setName(title), [title, open]);

  const run = (ops: PlanOp[]) => {
    if (!ops.length) return;
    setFailed(!save(ops).ok);
  };
  const profile = profileOfDraft(doc, defaults);
  const party = doc.travellers ?? { adults: profile.adults, children: profile.youngest === null ? [] : [profile.youngest] };
  const setParty = (next: { adults: number; children: number[] }) => run(partyOps(doc, defaults, next, profile.pace, newOpId));
  const commitName = () => {
    const next = name.trim();
    if (next === title) return;
    // an empty name puts our trip's name back: a device copy keeps its name as the copy's title, an account trip derives it (null)
    const put = next === '' ? (where === 'device' ? ourTitle : null) : next;
    if (next === '' && put === title) return;
    run([{ kind: 'setTitle', id: newOpId(), title: put }]);
  };

  const body = (
    <div className="own-set">
      {failed ? <Banner kind="urgent">Could not save that change. Nothing was changed.</Banner> : null}
      <Field label="Trip name" help={ourTitle ? `Left empty, it reads ${ourTitle}.` : undefined}>
        {(c) => (
          <Input
            {...c}
            value={name}
            maxLength={TRIP_NAME_MAX}
            placeholder={ourTitle ?? 'Your trip'}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitName();
            }}
          />
        )}
      </Field>
      <section className="own-set-when" aria-labelledby="own-when-h">
        <h3 id="own-when-h" className="field-label">Starts</h3>
        <button type="button" className="own-set-date" aria-expanded={calendar} aria-controls="own-set-cal" data-empty={doc.start ? undefined : ''} onClick={() => setCalendar((v) => !v)}>
          <Icon name="calendar" size={16} />
          <span>{doc.start ? formatDate(doc.start) : 'Pick the day 1 date'}</span>
          <Icon name={calendar ? 'chevronUp' : 'chevronDown'} size={16} />
        </button>
        {calendar && today ? (
          <div id="own-set-cal">
            <CalendarPicker
              value={doc.start ?? null}
              onChange={(v) => {
                if (/^\d{4}-\d{2}-\d{2}$/.test(v) && v !== doc.start) run([{ kind: 'setDates', id: newOpId(), start: v }]);
                setCalendar(false);
              }}
              length={Math.max(1, days)}
              today={today}
            />
          </div>
        ) : null}
      </section>
      <section className="own-set-party trav" role="group" aria-labelledby="own-who-h">
        <h3 id="own-who-h" className="field-label">Who is going</h3>
        <Travellers party={party} onChange={(p) => setParty({ adults: p.adults, children: p.children.map(planAge) })} />
      </section>
      <div className="own-set-row">
        <span className="field-label" id="own-pace-l">Pace</span>
        <Segmented label="Pace" segments={[...PACES]} value={profile.pace} onChange={(p) => run(partyOps(doc, defaults, party, p, newOpId))} />
      </div>
      <p className="own-set-note">
        {where === 'device' ? 'Kept in this browser. Sign in to keep it on every device.' : 'Kept in your account and on this device.'}
      </p>
    </div>
  );
  const footer = <Button variant="primary" onClick={onClose}>Done</Button>;
  const change = (o: boolean) => {
    if (!o) onClose();
  };
  return phone ? (
    <BottomSheet open={open} onOpenChange={change} title="Edit trip" snaps={['half', 'full']} initial="full" footer={footer} className="own-sheet">
      {body}
    </BottomSheet>
  ) : (
    <SideSheet open={open} onOpenChange={change} title="Edit trip" kicker={ourTitle ?? undefined} footer={footer} className="own-sheet">
      {body}
    </SideSheet>
  );
}
