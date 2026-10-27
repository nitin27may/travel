'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { CHILD_MAX_AGE, PARTY_MAX_ADULTS, PARTY_MAX_CHILDREN, PARTY_MIN_ADULTS } from '@travel/core/trips/party.ts';
import { TRAVELLERS } from '@travel/core/config/account.ts';
import { ageOn, type Travellers } from '@travel/core/schema/travellers.ts';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Stepper } from '@/components/ui/Stepper';
import { PERSON_COPY, blankPerson, hasIssues, issuesOf, toTravellers, type PersonForm, type PersonIssue, type TravellersForm } from '@/lib/account/travellers-form';

/** AP-15: what is stored, said once beside the Save that stores it (spec AD3: the explicit Save is the opt-in). */
export const STORED_NOTE = "We save the number of adults, each child's age, adults' ages if you add them, and a date of birth only if you add one. No names. Only you can see it, and you can remove it at any time.";

const AGES = Array.from({ length: CHILD_MAX_AGE + 1 }, (_, i) => i);

/** What the parent's save answered: the editor shows AP-28 for `failed` and does nothing for the others (the parent owns them). */
export type EditorOutcome = 'saved' | 'failed' | 'conflict' | 'handled';

interface PersonProps {
  kind: 'child' | 'adult';
  n: number;
  person: PersonForm;
  issue: PersonIssue | null;
  shown: boolean;
  today: string;
  onChange: (p: PersonForm) => void;
  autoFocusAge?: boolean;
}

/**
 * One person: Age (a select for a child, an optional number for an adult) and an optional date of birth behind "Add date of birth" (spec
 * 2.3 rule 3, 2.6). With a date of birth the age is derived and read-only ("7, from the date of birth"). Errors only once Save was
 * pressed (`shown`). Focus: opening the date moves it to the date field; removing returns it to Age.
 */
function PersonFields({ kind, n, person, issue, shown, today, onChange, autoFocusAge }: PersonProps) {
  const id = useId();
  const dobRef = useRef<HTMLInputElement>(null);
  const set = useRef<HTMLFieldSetElement>(null);
  const move = useRef<'dob' | 'age' | null>(autoFocusAge ? 'age' : null);
  const child = kind === 'child';
  useEffect(() => {
    const to = move.current;
    move.current = null;
    if (to === 'dob') dobRef.current?.focus();
    else if (to === 'age') set.current?.querySelector<HTMLElement>('[data-person]')?.focus();
  }, [person.dobOpen, autoFocusAge]);
  const err = shown && issue ? PERSON_COPY[issue] : undefined;
  const ageErr = person.dob ? undefined : err;
  const dobErr = person.dob ? err : undefined;
  const derived = person.dob ? ageOn(person.dob, today) : null;
  const legend = `${child ? 'Child' : 'Adult'} ${n}`;
  return (
    <fieldset className="acct-person" data-kind={kind} ref={set}>
      <legend className="acct-person-legend">{legend}</legend>
      <div className="acct-person-row">
        {derived !== null && person.dob <= today ? (
          <div className="field">
            <span className="field-label" id={`${id}-al`}>Age</span>
            <p className="acct-derived" id={`${id}-d`} aria-labelledby={`${id}-al ${id}-d`}>
              {derived === 0 ? 'Under 1' : derived}, from the date of birth
            </p>
          </div>
        ) : child ? (
          <Field label="Age" error={ageErr}>
            {(a) => (
              <Select
                {...a}
                data-person={`${kind}-${n - 1}`}
                value={person.age === null ? '' : String(person.age)}
                error={ageErr !== undefined}
                onChange={(e) => onChange({ ...person, age: e.target.value === '' ? null : Number(e.target.value) })}
              >
                <option value="">Age</option>
                {AGES.map((x) => (
                  <option key={x} value={x}>
                    {x === 0 ? 'Under 1' : x}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ) : (
          <Field label="Age (optional)" error={ageErr}>
            {(a) => (
              <Input
                {...a}
                data-person={`${kind}-${n - 1}`}
                type="number"
                inputMode="numeric"
                min={TRAVELLERS.adultMinAge}
                max={TRAVELLERS.maxAge}
                value={person.age === null ? '' : String(person.age)}
                error={ageErr !== undefined}
                onChange={(e) => {
                  const v = e.target.value;
                  onChange({ ...person, age: v === '' || !Number.isInteger(Number(v)) ? null : Number(v) });
                }}
              />
            )}
          </Field>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="acct-dob-toggle"
          aria-expanded={person.dobOpen}
          aria-controls={person.dobOpen ? `${id}-dob` : undefined}
          onClick={() => {
            if (person.dobOpen) {
              move.current = 'age';
              onChange({ ...person, dob: '', dobOpen: false });
            } else {
              move.current = 'dob';
              onChange({ ...person, dobOpen: true });
            }
          }}
        >
          {person.dobOpen ? 'Remove date of birth' : 'Add date of birth'}
        </Button>
      </div>
      {person.dobOpen ? (
        <div id={`${id}-dob`} className="acct-dob">
          <Field label="Date of birth (optional)" error={dobErr}>
            {(a) => (
              <Input
                {...a}
                ref={dobRef}
                type="date"
                max={today}
                value={person.dob}
                error={dobErr !== undefined}
                aria-describedby={[a['aria-describedby'], derived !== null ? `${id}-d` : undefined].filter(Boolean).join(' ') || undefined}
                onChange={(e) => onChange({ ...person, dob: e.target.value })}
              />
            )}
          </Field>
        </div>
      ) : null}
    </fieldset>
  );
}

interface Props {
  initial: TravellersForm;
  /** The person's local day: the date field's `max`, the derived ages, and `age_as_of`. */
  today: string;
  legend?: string;
  /** The heading above already says it: keep the legend for screen readers only. */
  legendHidden?: boolean;
  submitLabel?: string;
  /** Called with a document that passed the form's own checks; the parent saves it. */
  onSave: (doc: Travellers) => Promise<EditorOutcome>;
  /** Cancel, Skip for now, Back: after the Save button. */
  actions?: ReactNode;
  /** The action bar sticks to the bottom of the viewport on a phone (the setup card, S8). */
  sticky?: boolean;
  autoFocus?: boolean;
  /** A line above the fields ("Filled in from this browser: ...", AP-11). */
  lead?: ReactNode;
}

/**
 * The Travellers editor (spec 2.3 step 2 and 2.4): a fieldset of two Steppers and, per person, Age and an optional date of birth. Save
 * travellers is the opt-in, with the stored-data sentence beside it. No red before the person acts: a missing age, a future date or a
 * date that makes a child 18 shows its error only after Save is pressed, and a failed Save moves focus to the first invalid field.
 */
export function TravellersEditor({ initial, today, legend = 'Who usually travels with you?', legendHidden, submitLabel = 'Save travellers', onSave, actions, sticky, autoFocus, lead }: Props) {
  const [form, setForm] = useState<TravellersForm>(initial);
  const [shown, setShown] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [focusNew, setFocusNew] = useState<number | null>(null);
  const [focusBad, setFocusBad] = useState(0);
  const box = useRef<HTMLFormElement>(null);
  const kids = useRef<HTMLDivElement>(null);

  const issues = issuesOf(form, today);

  useEffect(() => {
    if (autoFocus) box.current?.querySelector<HTMLElement>('.stepper-btn')?.focus();
  }, [autoFocus]);
  useEffect(() => {
    if (focusBad) box.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [focusBad]);

  const setAdults = (n: number) =>
    setForm((f) => ({ ...f, adults: n, adultAges: f.adultAges ? Array.from({ length: n }, (_, i) => f.adultAges?.[i] ?? blankPerson()) : null }));
  const setChildren = (n: number) => {
    if (n > form.children.length) setFocusNew(n - 1);
    setForm((f) => {
      const children = f.children.slice(0, n);
      while (children.length < n) children.push(blankPerson());
      return { ...f, children };
    });
    // Removing the last child leaves no age field to focus: the Children stepper keeps focus (it is the button just pressed)
  };
  const setChild = (i: number, p: PersonForm) => setForm((f) => ({ ...f, children: f.children.map((c, j) => (j === i ? p : c)) }));
  const setAdult = (i: number, p: PersonForm) => setForm((f) => ({ ...f, adultAges: f.adultAges?.map((a, j) => (j === i ? p : a)) ?? null }));

  const adultsAllBlank = (form.adultAges ?? []).every((a) => a.age === null && !a.dob && !a.dobOpen);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    setShown(true);
    setFailed(false);
    const doc = toTravellers(form, today);
    if (!doc) {
      if (hasIssues(issues)) setFocusBad((n) => n + 1);
      else setFailed(true);
      return;
    }
    setPending(true);
    let outcome: EditorOutcome;
    try {
      outcome = await onSave(doc);
    } catch {
      outcome = 'failed';
    }
    setPending(false);
    if (outcome === 'failed') setFailed(true);
  }

  return (
    <form className="acct-editor acct-trav" ref={box} onSubmit={submit} noValidate>
      {lead}
      <fieldset className="acct-trav-set">
        <legend className={legendHidden ? 'sr-only' : 'acct-trav-legend'}>{legend}</legend>
        <Stepper label="Adults" value={form.adults} min={PARTY_MIN_ADULTS} max={PARTY_MAX_ADULTS} decLabel="Fewer adults" incLabel="More adults" onChange={setAdults} />
        {form.adultAges === null ? (
          <Button type="button" variant="ghost" size="sm" className="acct-link-btn" onClick={() => setForm((f) => ({ ...f, adultAges: Array.from({ length: f.adults }, blankPerson) }))}>
            Add adults&apos; ages (optional)
          </Button>
        ) : (
          <>
            {form.adultAges.map((p, i) => (
              <PersonFields key={i} kind="adult" n={i + 1} person={p} issue={issues.adults[i] ?? null} shown={shown} today={today} onChange={(x) => setAdult(i, x)} />
            ))}
            {adultsAllBlank ? (
              <Button type="button" variant="ghost" size="sm" className="acct-link-btn" onClick={() => setForm((f) => ({ ...f, adultAges: null }))}>
                Hide adults&apos; ages
              </Button>
            ) : null}
          </>
        )}
        <div ref={kids}>
          <Stepper label="Children" value={form.children.length} min={0} max={PARTY_MAX_CHILDREN} decLabel="Fewer children" incLabel="More children" onChange={setChildren} />
        </div>
        {form.children.map((p, i) => (
          <PersonFields
            key={i}
            kind="child"
            n={i + 1}
            person={p}
            issue={issues.children[i] ?? null}
            shown={shown}
            today={today}
            autoFocusAge={focusNew === i}
            onChange={(x) => setChild(i, x)}
          />
        ))}
      </fieldset>
      <p className="acct-note acct-stored">{STORED_NOTE}</p>
      {failed ? <Banner kind="notice">We couldn&apos;t save. Your changes are still here; try again.</Banner> : null}
      <div className={sticky ? 'acct-editor-actions acct-sticky' : 'acct-editor-actions'}>
        <Button type="submit" variant="primary" loading={pending}>
          {submitLabel}
        </Button>
        {actions}
      </div>
    </form>
  );
}
