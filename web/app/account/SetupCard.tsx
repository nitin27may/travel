'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { partyText, type Party } from '@travel/core/trips/party.ts';
import { partyOf, type Travellers } from '@travel/core/schema/travellers.ts';
import { Banner } from '@/components/ui/Banner';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';
import { checkName, nameError, NAME_COPY } from '@/lib/account/name';
import { emptyForm, formFromParty, localDay } from '@/lib/account/travellers-form';
import { setAccountParty } from '@/lib/account/seed-party';
import { readParty } from '@/lib/storage/partyKey';
import { leaveSession } from '@/lib/auth/session-lost';
import { finishSetup, saveName, saveTravellers } from './actions';
import { TravellersEditor, type EditorOutcome } from './TravellersEditor';

export type SetupStep = 'name' | 'travellers';
type Step = SetupStep | 'done';

/** The step lives in the URL with `replace`, so a reload keeps it and Back leaves the page rather than walking steps (spec 2.3 rule 5). */
function writeStep(step: Step | null): void {
  try {
    const url = new URL(window.location.href);
    if (step) url.searchParams.set('setup', step);
    else url.searchParams.delete('setup');
    window.history.replaceState(window.history.state, '', url);
  } catch {
    /* no history to write (a test page): the card still works */
  }
}

/**
 * The two-step first-run card (spec 2.3): your name, then who travels with you; both skippable. Shown by the page only when the profile
 * was read and `setup_done_at` is empty. Skip on step 2, Save and Close all end it for good (the server records it); leaving mid-way
 * shows it again next time. Step changes move focus to the step heading and are announced politely.
 */
export function SetupCard({ userId, initialName, revision, initialStep }: { userId: string; initialName: string; revision: number; initialStep: SetupStep }) {
  const router = useRouter();
  const id = useId();
  const [step, setStep] = useState<Step>(initialStep);
  const [name, setName] = useState(initialName);
  const [savedName, setSavedName] = useState(initialName);
  const [nameErr, setNameErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [device, setDevice] = useState<Party | null | undefined>(undefined);
  const [done, setDone] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

  // The device party prefills step 2; read it after hydration (the server cannot see it).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of this browser's party after mount (the server cannot see it)
    setDevice(readParty());
  }, []);

  useEffect(() => {
    if (!moved.current) return;
    heading.current?.focus();
    setAnnounce(step === 'name' ? 'Step 1 of 2: What should we call you?' : step === 'travellers' ? 'Step 2 of 2: Who usually travels with you?' : 'All set');
  }, [step]);

  const go = (next: Step) => {
    moved.current = true;
    setFailed(false);
    setNameErr(null);
    setStep(next);
    writeStep(next);
  };

  const check = checkName(name);

  async function continueName(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    if (!check.ok) {
      setNameErr(nameError(check.reason));
      return;
    }
    if (check.name === savedName) {
      go('travellers');
      return;
    }
    setPending(true);
    setNameErr(null);
    try {
      const r = await saveName(userId, { name: check.name });
      if (r.kind === 'saved') {
        setSavedName(r.name);
        setName(r.name);
        go('travellers');
      } else if (r.reason === 'UNAUTHENTICATED') leaveSession();
      else if (r.reason === 'INVALID_INPUT') setNameErr(nameError(r.field));
      else if (r.reason === 'RATE_LIMITED') setNameErr(NAME_COPY.rate);
      else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  async function saveParty(doc: Travellers): Promise<EditorOutcome> {
    const r = await saveTravellers(userId, { doc, revision, finishSetup: true });
    if (r.kind === 'rejected' && r.reason === 'UNAUTHENTICATED') {
      leaveSession();
      return 'handled';
    }
    if (r.kind === 'conflict') {
      // another device saved travellers while this card was open: the page reloads with them, and the card is gone
      router.refresh();
      return 'handled';
    }
    if (r.kind !== 'saved') return 'failed';
    const party = partyOf(doc, localDay(new Date()));
    setAccountParty(party);
    setDone(`Trips now plan for ${partyText(party, ' and ')} wherever you sign in.`);
    go('done');
    return 'saved';
  }

  async function skipTravellers() {
    if (pending) return;
    setPending(true);
    setFailed(false);
    try {
      const r = await finishSetup(userId);
      if (r.kind === 'done') {
        setDone(null);
        go('done');
      } else if (r.reason === 'UNAUTHENTICATED') leaveSession();
      else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  function close() {
    writeStep(null);
    router.refresh();
  }

  const counter = step === 'done' ? null : step === 'name' ? 'Step 1 of 2' : 'Step 2 of 2';
  const today = localDay(new Date());

  return (
    <section className="acct-section acct-setup" aria-labelledby={`${id}-h`}>
      <div className="acct-card acct-setup-card">
        <div className="acct-setup-top">
          <span className="acct-label">{step === 'done' ? 'All set' : 'Set up your account'}</span>
          {counter ? <span className="acct-label acct-setup-count">{counter}</span> : null}
        </div>
        {step !== 'done' ? <p className="acct-note">Two short steps. You can change both later.</p> : null}
        <h2 id={`${id}-h`} className="acct-setup-h" tabIndex={-1} ref={heading}>
          {step === 'name' ? 'What should we call you?' : step === 'travellers' ? 'Who usually travels with you?' : 'All set'}
        </h2>
        {step === 'name' ? (
          <form className="acct-setup-body" onSubmit={continueName} noValidate>
            <Field label="Your name" help="Shown only to you, here and in the menu." error={nameErr ?? (name.trim() && !check.ok ? nameError(check.reason) : undefined)}>
              {(a) => (
                <Input
                  name="name"
                  autoComplete="name"
                  value={name}
                  maxLength={120}
                  onChange={(e) => {
                    setName(e.target.value);
                    setNameErr(null);
                  }}
                  {...a}
                  error={nameErr !== null || (name.trim() !== '' && !check.ok)}
                />
              )}
            </Field>
            {failed ? <Banner kind="notice">We couldn&apos;t save. Your changes are still here; try again.</Banner> : null}
            <div className="acct-editor-actions acct-sticky">
              <Button type="submit" variant="primary" loading={pending} disabled={!check.ok}>
                Continue
              </Button>
              <Button type="button" variant="ghost" onClick={() => go('travellers')} disabled={pending}>
                Skip
              </Button>
            </div>
          </form>
        ) : null}
        {step === 'travellers' && device !== undefined ? (
          <div className="acct-setup-body">
            <p className="acct-note">Trips, copies and the trip builder start from this. You can still change it on any trip.</p>
            <TravellersEditor
              key="setup-travellers"
              initial={device ? formFromParty(device) : emptyForm()}
              today={today}
              legendHidden
              sticky
              lead={device ? <p className="acct-note">Filled in from this browser: {partyText(device, ', ')}. Check the ages and save.</p> : undefined}
              onSave={saveParty}
              actions={
                <>
                  <Button type="button" variant="ghost" onClick={() => void skipTravellers()} disabled={pending}>
                    Skip for now
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => go('name')} disabled={pending}>
                    Back
                  </Button>
                </>
              }
            />
            {failed ? <Banner kind="notice">We couldn&apos;t save. Your changes are still here; try again.</Banner> : null}
          </div>
        ) : null}
        {step === 'done' ? (
          <div className="acct-setup-body">
            <p className="acct-line">{done ?? 'You can add travellers here at any time.'}</p>
            <div className="acct-editor-actions acct-sticky">
              <ButtonLink href="/trips/" variant="primary">
                Browse trips
              </ButtonLink>
              <Button type="button" variant="ghost" onClick={close}>
                Close
              </Button>
            </div>
          </div>
        ) : null}
        <p className="sr-only" role="status" aria-live="polite">
          {announce}
        </p>
      </div>
    </section>
  );
}
