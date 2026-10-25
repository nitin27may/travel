'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { canonicalAddress } from '@travel/core/mail/address.ts';
import { EMAIL_CODE, PASSWORD } from '@travel/core/config/auth-limits.ts';
import { authProblem, COPY, type AuthAction, type AuthProblem } from '@/lib/auth/auth-errors';
import { returnPathFromSearch } from '@/lib/auth/return-path';
import { authCall, type AuthReply } from './api';
import { ChooserStep } from './ChooserStep';
import { CodeStep } from './CodeStep';
import { EmailStep } from './EmailStep';
import { handOffEmail, lastMethod, rememberMethod, type Method } from './memory';
import { PasswordStep } from './PasswordStep';
import { useTurnstile } from './TurnstileLazy';
import './auth.css';

/**
 * The passwordless-first sign-in card (email spec 3, Phase 1). One card on `/sign-in/` and `/sign-up/`:
 *
 *   email ─► chooser ─► code  (sign in or create an account by an emailed code; Neon creates the account on first use)
 *                   └─► password ─► (sign up, or an unverified account) code to confirm the email
 *
 * The step changes in place, the address stays visible with "Change", and focus moves to the new step's heading (P3, P5). Every
 * call goes through the guarded proxy; every answer maps to the copy of lib/auth/auth-errors.ts. With the code option off
 * (`NEXT_PUBLIC_SIGN_IN_CODE` unset) the chooser is skipped and the card is password only, plus the code step to confirm an email.
 * After success the browser loads the checked `next` page, or the account page.
 */
export interface SignInCardProps {
  mode: 'sign-in' | 'sign-up';
  codeOn: boolean;
  siteKey: string | null;
}

type Step = 'email' | 'choose' | 'password' | 'code';
type Purpose = 'sign-in' | 'verify';

const later = (seconds: number) => Date.now() + seconds * 1000;

export function SignInCard({ mode, codeOn, siteKey }: SignInCardProps) {
  const signUp = mode === 'sign-up';
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [problem, setProblem] = useState<AuthProblem | null>(null);
  const [busy, setBusy] = useState<null | 'send' | 'resend' | 'code' | 'password'>(null);
  const [purpose, setPurpose] = useState<Purpose>('sign-in');
  const [lead, setLead] = useState<string | undefined>(undefined);
  const [resendAt, setResendAt] = useState(0);
  const [moved, setMoved] = useState(false);
  // The card renders only in the browser (no server render), so storage is readable on the first render.
  const [preferPassword] = useState(() => lastMethod() === 'password');
  const slotRef = useRef<HTMLDivElement>(null);
  const { prime, token } = useTurnstile(siteKey, slotRef);

  const go = (next: Step) => {
    setProblem(null);
    setMoved(true);
    setStep(next);
  };

  const fail = (reply: AuthReply, action: AuthAction): void => {
    setProblem(authProblem(reply, action, codeOn));
    if (reply.status === 429 && reply.retryAfterS) setResendAt(later(reply.retryAfterS));
  };

  const finish = (method: Method) => {
    rememberMethod(method);
    window.location.assign(returnPathFromSearch(window.location.search));
  };

  const submitEmail = (raw: string) => {
    const value = canonicalAddress(raw);
    if (!value) {
      setProblem({ where: 'field', field: 'email', tone: 'urgent', message: COPY.badEmail });
      return;
    }
    setEmail(value);
    go(codeOn ? 'choose' : 'password');
  };

  /** Ask Neon (through the guard) to email a code: `sign-in` signs in or creates the account, `email-verification` confirms one. */
  const sendCode = async (type: 'sign-in' | 'email-verification', how: 'send' | 'resend'): Promise<boolean> => {
    setBusy(how);
    setProblem(null);
    const reply = await authCall('email-otp/send-verification-otp', { email, type }, await token());
    setBusy(null);
    if (reply.status !== 200) {
      fail(reply, 'send');
      return false;
    }
    setResendAt(later(EMAIL_CODE.resendAfterS));
    return true;
  };

  const startCode = async () => {
    if (await sendCode('sign-in', 'send')) {
      setPurpose('sign-in');
      setLead(undefined);
      go('code');
    }
  };

  const resend = () => void sendCode(purpose === 'verify' ? 'email-verification' : 'sign-in', 'resend');

  const toVerify = (leadText?: string) => {
    setPurpose('verify');
    setLead(leadText);
    setResendAt(later(EMAIL_CODE.resendAfterS));
    go('code');
  };

  const submitCode = async (otp: string) => {
    setBusy('code');
    setProblem(null);
    const reply = purpose === 'verify' ? await authCall('email-otp/verify-email', { email, otp }) : await authCall('sign-in/email-otp', { email, otp });
    if (reply.status === 200) return finish(purpose === 'verify' ? 'password' : 'code');
    setBusy(null);
    fail(reply, 'verify');
  };

  const submitPassword = async (password: string) => {
    if (signUp && password.length < PASSWORD.minLength) {
      setProblem({ where: 'field', field: 'password', tone: 'urgent', message: COPY.shortPassword });
      return;
    }
    if (!password) {
      setProblem({ where: 'field', field: 'password', tone: 'urgent', message: 'Enter your password.' });
      return;
    }
    setBusy('password');
    setProblem(null);
    if (signUp) {
      // No name is sent (rule E8): nothing a visitor types may reach an auth email.
      const reply = await authCall('sign-up/email', { email, password, name: '' }, await token());
      setBusy(null);
      if (reply.status !== 200) return fail(reply, 'sign-up');
      if (typeof reply.body?.token === 'string' && reply.body.token) return finish('password');
      return toVerify();
    }
    const reply = await authCall('sign-in/email', { email, password });
    if (reply.status === 200) return finish('password');
    setBusy(null);
    if (reply.status === 403 && reply.code === 'EMAIL_NOT_VERIFIED') return toVerify('Confirm your email first. We sent a code to');
    fail(reply, 'password');
  };

  const changeEmail = () => go('email');

  return (
    <div className="auth-card">
      {step === 'email' ? (
        <EmailStep
          email={email}
          problem={problem}
          focus={moved}
          onSubmit={submitEmail}
          onFirstFocus={prime}
          footer={
            <p className="auth-alt">
              {signUp ? (
                <>
                  Already have an account? <Link href="/sign-in/">Sign in</Link>
                </>
              ) : codeOn ? (
                <>New here? The same steps create your account.</>
              ) : (
                <>
                  New here? <Link href="/sign-up/">Create an account</Link>
                </>
              )}
            </p>
          }
        />
      ) : null}
      {step === 'choose' ? (
        <ChooserStep
          email={email}
          signUp={signUp}
          passwordFirst={!signUp && preferPassword}
          problem={problem}
          sending={busy === 'send'}
          focus={moved}
          onCode={() => void startCode()}
          onPassword={() => go('password')}
          onChangeEmail={changeEmail}
        />
      ) : null}
      {step === 'password' ? (
        <PasswordStep
          email={email}
          create={signUp}
          problem={problem}
          pending={busy === 'password'}
          focus={moved}
          onCodeInstead={codeOn && !signUp ? () => void startCode() : undefined}
          sendingCode={busy === 'send'}
          onSubmit={(p) => void submitPassword(p)}
          onChangeEmail={changeEmail}
          onForgot={() => handOffEmail(email)}
        />
      ) : null}
      {step === 'code' ? (
        <CodeStep
          email={email}
          lead={lead}
          submitLabel={purpose === 'verify' ? 'Confirm email' : 'Sign in'}
          problem={problem}
          pending={busy === 'code'}
          focus={moved}
          resendAt={resendAt}
          resending={busy === 'resend'}
          onSubmit={(c) => void submitCode(c)}
          onResend={resend}
          onChangeEmail={changeEmail}
          onUsePassword={purpose === 'sign-in' && !signUp ? () => go('password') : undefined}
        />
      ) : null}
      <div ref={slotRef} className="auth-turnstile" />
    </div>
  );
}
