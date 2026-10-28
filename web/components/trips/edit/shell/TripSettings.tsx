'use client';

import { useEffect, useState } from 'react';
import type { PlanOp } from '@/lib/trip-edit/model';
import type { Profile } from '@travel/core/schedule/types.ts';
import type { PlanDraft } from '@/lib/trip-edit/model';
import { CHILD_MAX_AGE, DEFAULT_CHILD_AGE, PARTY_MAX_ADULTS, PARTY_MAX_CHILDREN, PARTY_MIN_ADULTS } from '@travel/core/trips/party.ts';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';
import { Segmented } from '@/components/ui/Segmented';
import { Select } from '@/components/ui/Select';
import { SideSheet } from '@/components/ui/SideSheet';
import { Stepper } from '@/components/ui/Stepper';
import { partyOps, profileOfDraft } from '@/lib/trip-edit/source';
import type { SaveResult, Where } from '@/lib/trip-edit/open';
import './shell.css';

const PACES = [
  { value: 'relaxed', label: 'Relaxed' },
  { value: 'standard', label: 'Standard' },
  { value: 'full', label: 'Full' },
] as const;
const AGES = Array.from({ length: CHILD_MAX_AGE + 1 }, (_, i) => i);
const ageName = (n: number): string => (n === 0 ? 'Under 1' : String(n));
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
}

/**
 * The trip's name, start date, who is going and pace: the edits the page already had, now saved to the document (STEP2-T1). A bottom
 * sheet on a phone, a side sheet from 640 px, as the copy sheet. Every control saves at once; there is no Save button (edit-mode-spec 3).
 */
export function TripSettings({ open, onClose, doc, defaults, title, ourTitle, where, save }: Props) {
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
  const setChildren = (n: number) => {
    const children = party.children.slice(0, n);
    while (children.length < n) children.push(DEFAULT_CHILD_AGE);
    setParty({ adults: party.adults, children });
  };
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
            maxLength={120}
            placeholder={ourTitle ?? 'Your trip'}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitName();
            }}
          />
        )}
      </Field>
      <Field label="Starts">
        {(c) => (
          <Input
            {...c}
            type="date"
            value={doc.start ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              if (/^\d{4}-\d{2}-\d{2}$/.test(v) && v !== doc.start) run([{ kind: 'setDates', id: newOpId(), start: v }]);
            }}
          />
        )}
      </Field>
      <div className="own-set-row" role="group" aria-label="Who is going">
        <Stepper label="Adults" value={party.adults} min={PARTY_MIN_ADULTS} max={PARTY_MAX_ADULTS} decLabel="Fewer adults" incLabel="More adults" onChange={(n) => setParty({ adults: n, children: party.children })} />
        <Stepper label="Children" value={party.children.length} min={0} max={PARTY_MAX_CHILDREN} decLabel="Fewer children" incLabel="More children" onChange={setChildren} />
        {party.children.length ? (
          <div className="own-set-ages">
            {party.children.map((a, i) => (
              <div className="own-set-age" key={i}>
                <label className="field-label" htmlFor={`own-age-${i}`}>Child {i + 1} age</label>
                <Select id={`own-age-${i}`} value={String(a)} onChange={(e) => setParty({ adults: party.adults, children: party.children.map((x, j) => (j === i ? Number(e.target.value) : x)) })}>
                  {AGES.map((n) => (
                    <option key={n} value={n}>{ageName(n)}</option>
                  ))}
                </Select>
              </div>
            ))}
          </div>
        ) : null}
      </div>
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
    <BottomSheet open={open} onOpenChange={change} title="Trip settings" snaps={['half', 'full']} initial="full" footer={footer}>
      {body}
    </BottomSheet>
  ) : (
    <SideSheet open={open} onOpenChange={change} title="Trip settings" kicker={ourTitle ?? undefined} footer={footer}>
      {body}
    </SideSheet>
  );
}
