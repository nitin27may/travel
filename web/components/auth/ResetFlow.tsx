'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { ButtonLink } from '@/components/ui/Button';
import { canonicalAddress } from '@travel/core/mail/address.ts';
import { EMAIL_CODE, PASSWORD } from '@travel/core/config/auth-limits.ts';
import { authProblem, COPY, resentMessage, type AuthProblem } from '@/lib/auth/auth-errors';
import { DEFAULT_RETURN, returnPathFromSearch } from '@/lib/auth/return-path';
import { authCall } from './api';
import { CodeStep } from './CodeStep';
import { EmailStep } from './EmailStep';
import { timeLeft, useAnnouncer, useCountdown } from './live';
import { rememberMethod, takeHandedOffEmail } from './memory';
import { CardBanner, fieldError, PasswordField, StepHeading } from './parts';
import { useTurnstile } from './TurnstileLazy';
import './auth.css';

/**
 * `/sign-in/reset/` (email spec 3.1): the address (handed over from "Forgot password?" when there is one), "Email me a code",
 * then the code and the new password in one step. A reset signs out every earlier session, this browser's too (the guard deletes
 * them, EML-0 W2), so the card signs straight in with the new password. If that sign-in fails, it says so plainly: the password is
 * set, sign in with it (and the link keeps `next`, review S8). Upstream Better Auth creates a password for an account that had none
 * (a code-only account), so this page is also how a code user sets a first password (spec A6; to confirm on Neon, EML-E).
 *
 * No other way out is offered here (review M1): the person has no password, and the send buckets are the same. A 429 holds
 * "Email me a code" with the time in its label until the wait is over (review M3).
 */
type Step = 'email' | 'code' | 'done';
interface SendWait {
  address: string;
  until: number;
  kind: 'sent' | 'limited';
}

export function ResetFlow({ siteKey }: { siteKey: string | null }) {
  const [step, setStep] = useState<Step>('email');
  // Client only (no server render): the address handed over from "Forgot password?" is read on the first render.
  const [email, setEmail] = useState(takeHandedOffEmail);
  const [problem, setProblem] = useState<AuthProblem | null>(null);
  const [busy, setBusy] = useState<null | 'send' | 'resend' | 'reset'>(null);
  const [wait, setWait] = useState<SendWait | null>(null);
  const [resentCount, setResentCount] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [challenged, setChallenged] = useState(false);
  const [moved, setMoved] = useState(false);
  const [passwordError, setPasswordError] = useState<string | undefined>(undefined);
  const slotRef = useRef<HTMLDivElement>(null);
  const { region, announce } = useAnnouncer();
  const { prime, token } = useTurnstile(siteKey, slotRef, (active) => {
    setChallenged(active);
    if (active) {
      announce(COPY.challenge);
      slotRef.current?.scrollIntoView({ block: 'nearest' });
    }
  });

  const mine = wait && wait.address === email ? wait : null;
  const waitLeft = useCountdown(mine?.kind === 'limited' ? mine.until : 0, () => {
    setWait(null);
    setProblem(null);
    announce(COPY.canAskNow);
  });

  const report = (p: AuthProblem | null) => {
    setProblem(p);
    if (p && (p.where === 'field' || p.tone !== 'urgent')) announce(p.message);
  };

  const go = (next: Step) => {
    setProblem(null);
    setNotice(null);
    setMoved(true);
    setStep(next);
  };

  const send = async (how: 'send' | 'resend', address = email): Promise<boolean> => {
    setBusy(how);
    setProblem(null);
    const reply = await authCall('email-otp/request-password-reset', { email: address }, await token());
    setBusy(null);
    if (reply.status !== 200) {
      report(authProblem(reply, 'send', { page: 'reset' }));
      if (reply.status === 429) setWait({ address, until: Date.now() + (reply.retryAfterS ?? 60) * 1000, kind: 'limited' });
      return false;
    }
    setWait({ address, until: Date.now() + EMAIL_CODE.resendAfterS * 1000, kind: 'sent' });
    return true;
  };

  const submitEmail = async (raw: string) => {
    const value = canonicalAddress(raw);
    if (!value) {
      report({ where: 'field', field: 'email', tone: 'urgent', message: COPY.badEmail });
      return;
    }
    setEmail(value);
    // The same address again within the minute: its code is still good (review S6).
    if (wait?.address === value && wait.kind === 'sent' && wait.until > Date.now()) return go('code');
    if (await send('send', value)) go('code');
  };

  const resend = async () => {
    setNotice(null);
    if (await send('resend')) {
      const message = resentMessage(email);
      setResentCount((n) => n + 1);
      setNotice(message);
      announce(message);
    }
  };

  const submitReset = async (otp: string, password: string) => {
    if (password.length < PASSWORD.minLength) {
      setPasswordError(COPY.shortPassword);
      announce(COPY.shortPassword);
      return;
    }
    setPasswordError(undefined);
    setBusy('reset');
    setProblem(null);
    setNotice(null);
    const reply = await authCall('email-otp/reset-password', { email, otp, password });
    if (reply.status !== 200) {
      setBusy(null);
      const p = authProblem(reply, 'reset', { page: 'reset' });
      if (p?.field === 'password') {
        setPasswordError(p.message);
        announce(p.message);
      } else report(p);
      return;
    }
    // The reset signed out every earlier session, so sign in with the new password straight away.
    const signIn = await authCall('sign-in/email', { email, password });
    if (signIn.status === 200) {
      rememberMethod('password');
      window.location.assign(returnPathFromSearch(window.location.search));
      return;
    }
    setBusy(null);
    go('done');
  };

  if (step === 'done') {
    const next = returnPathFromSearch(window.location.search);
    return (
      <div className="auth-card auth-done">
        <div className="auth-step" role="status">
          <StepHeading focus={moved}>Your password is set</StepHeading>
          <p className="auth-lead">For your safety you were signed out everywhere. Sign in with your new password.</p>
          <div className="auth-actions">
            <ButtonLink href={next === DEFAULT_RETURN ? '/sign-in/' : `/sign-in/?next=${encodeURIComponent(next)}`} variant="primary">
              Sign in
            </ButtonLink>
          </div>
        </div>
        {region}
      </div>
    );
  }

  return (
    <div className="auth-card">
      {step === 'email' ? (
        <EmailStep
          email={email}
          problem={problem}
          focus={moved}
          pending={busy === 'send'}
          submitLabel={waitLeft > 0 ? `Email me a code (in ${timeLeft(waitLeft)})` : 'Email me a code'}
          submitDisabled={waitLeft > 0}
          onEdit={() => {
            if (wait?.kind === 'limited') setWait(null);
            if (problem) setProblem(null);
          }}
          onSubmit={(v) => void submitEmail(v)}
          onFirstFocus={prime}
          footer={
            <p className="auth-alt">
              Remembered it? <Link href="/sign-in/">Back to sign in</Link>
            </p>
          }
        />
      ) : (
        <CodeStep
          email={email}
          submitLabel="Set password"
          problem={problem}
          pending={busy === 'reset'}
          focus={moved}
          resendAt={mine?.until ?? 0}
          resending={busy === 'resend'}
          resentCount={resentCount}
          notice={notice}
          announce={announce}
          onResend={() => void resend()}
          onChangeEmail={() => go('email')}
          onSubmit={(otp, form) => void submitReset(otp, String(new FormData(form).get('password') ?? ''))}
        >
          <PasswordField create label="New password" error={passwordError ?? fieldError(problem, 'password')} />
        </CodeStep>
      )}
      {challenged ? <CardBanner kind="notice">{COPY.challenge}</CardBanner> : null}
      <div ref={slotRef} className="auth-turnstile" />
      {region}
    </div>
  );
}
