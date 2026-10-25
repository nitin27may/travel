'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { ButtonLink } from '@/components/ui/Button';
import { canonicalAddress } from '@travel/core/mail/address.ts';
import { EMAIL_CODE, PASSWORD } from '@travel/core/config/auth-limits.ts';
import { authProblem, COPY, type AuthProblem } from '@/lib/auth/auth-errors';
import { returnPathFromSearch } from '@/lib/auth/return-path';
import { authCall } from './api';
import { CodeStep } from './CodeStep';
import { EmailStep } from './EmailStep';
import { rememberMethod, takeHandedOffEmail } from './memory';
import { fieldError, PasswordField, StepHeading } from './parts';
import { useTurnstile } from './TurnstileLazy';
import './auth.css';

/**
 * `/sign-in/reset/` (email spec 3.1): the address (handed over from "Forgot password?" when there is one), "Email me a code",
 * then the code and the new password in one step. A reset signs out every earlier session, this browser's too (the guard deletes
 * them, EML-0 W2), so the card signs straight in with the new password. If that sign-in fails, it says so plainly: the password is
 * set, sign in with it. Upstream Better Auth creates a password for an account that had none (a code-only account), so this page is
 * also how a code user sets a first password (spec A6; to confirm on Neon with a real code, EML-E).
 */
type Step = 'email' | 'code' | 'done';

export function ResetFlow({ siteKey }: { siteKey: string | null }) {
  const [step, setStep] = useState<Step>('email');
  // Client only (no server render): the address handed over from "Forgot password?" is read on the first render.
  const [email, setEmail] = useState(takeHandedOffEmail);
  const [problem, setProblem] = useState<AuthProblem | null>(null);
  const [busy, setBusy] = useState<null | 'send' | 'resend' | 'reset'>(null);
  const [resendAt, setResendAt] = useState(0);
  const [moved, setMoved] = useState(false);
  const [passwordError, setPasswordError] = useState<string | undefined>(undefined);
  const slotRef = useRef<HTMLDivElement>(null);
  const { prime, token } = useTurnstile(siteKey, slotRef);

  const go = (next: Step) => {
    setProblem(null);
    setMoved(true);
    setStep(next);
  };

  const send = async (how: 'send' | 'resend', address = email): Promise<boolean> => {
    setBusy(how);
    setProblem(null);
    const reply = await authCall('email-otp/request-password-reset', { email: address }, await token());
    setBusy(null);
    if (reply.status !== 200) {
      setProblem(authProblem(reply, 'send'));
      if (reply.status === 429 && reply.retryAfterS) setResendAt(Date.now() + reply.retryAfterS * 1000);
      return false;
    }
    setResendAt(Date.now() + EMAIL_CODE.resendAfterS * 1000);
    return true;
  };

  const submitEmail = async (raw: string) => {
    const value = canonicalAddress(raw);
    if (!value) {
      setProblem({ where: 'field', field: 'email', tone: 'urgent', message: COPY.badEmail });
      return;
    }
    setEmail(value);
    if (await send('send', value)) go('code');
  };

  const submitReset = async (otp: string, password: string) => {
    if (password.length < PASSWORD.minLength) {
      setPasswordError(COPY.shortPassword);
      return;
    }
    setPasswordError(undefined);
    setBusy('reset');
    setProblem(null);
    const reply = await authCall('email-otp/reset-password', { email, otp, password });
    if (reply.status !== 200) {
      setBusy(null);
      const p = authProblem(reply, 'reset');
      if (p?.field === 'password') setPasswordError(p.message);
      else setProblem(p);
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
    return (
      <div className="auth-card">
        <div className="auth-step" role="status">
          <StepHeading focus={moved}>Your password is set</StepHeading>
          <p className="auth-lead">For your safety you were signed out everywhere. Sign in with your new password.</p>
          <div className="auth-actions">
            <ButtonLink href="/sign-in/" variant="primary">
              Sign in
            </ButtonLink>
          </div>
        </div>
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
          submitLabel="Email me a code"
          onSubmit={(v) => void submitEmail(v)}
          onFirstFocus={prime}
          footer={
            <p className="auth-alt">
              Remembered it? <Link href="/sign-in/">Back to sign in</Link>
            </p>
          }
        />
      ) : (
        <ResetCode
          email={email}
          problem={problem}
          passwordError={passwordError ?? fieldError(problem, 'password')}
          pending={busy === 'reset'}
          resending={busy === 'resend'}
          focus={moved}
          resendAt={resendAt}
          onResend={() => void send('resend')}
          onChangeEmail={() => go('email')}
          onSubmit={(otp, password) => void submitReset(otp, password)}
        />
      )}
      <div ref={slotRef} className="auth-turnstile" />
    </div>
  );
}

/** The code step with the new password inside the same form. */
function ResetCode(props: {
  email: string;
  problem: AuthProblem | null;
  passwordError?: string;
  pending: boolean;
  resending: boolean;
  focus: boolean;
  resendAt: number;
  onResend: () => void;
  onChangeEmail: () => void;
  onSubmit: (otp: string, password: string) => void;
}) {
  return (
    <CodeStep
      email={props.email}
      submitLabel="Set password"
      problem={props.problem}
      pending={props.pending}
      focus={props.focus}
      resendAt={props.resendAt}
      resending={props.resending}
      onResend={props.onResend}
      onChangeEmail={props.onChangeEmail}
      onSubmit={(otp, form) => props.onSubmit(otp, String(new FormData(form).get('password') ?? ''))}
    >
      <PasswordField create label="New password" error={props.passwordError} />
    </CodeStep>
  );
}
