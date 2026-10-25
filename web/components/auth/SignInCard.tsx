'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { canonicalAddress } from '@travel/core/mail/address.ts';
import { EMAIL_CODE, PASSWORD } from '@travel/core/config/auth-limits.ts';
import { authProblem, COPY, resentMessage, type AuthAction, type AuthProblem } from '@/lib/auth/auth-errors';
import { returnPathFromSearch } from '@/lib/auth/return-path';
import { authCall, type AuthReply } from './api';
import { ChooserStep } from './ChooserStep';
import { CodeStep } from './CodeStep';
import { EmailStep } from './EmailStep';
import { useAnnouncer, useCountdown } from './live';
import { handOffEmail, lastMethod, rememberMethod, type Method } from './memory';
import { CardBanner } from './parts';
import { PasswordStep } from './PasswordStep';
import { useTurnstile } from './TurnstileLazy';
import './auth.css';

/**
 * The passwordless-first sign-in card (email spec 3, Phase 1). One card on `/sign-in/` and `/sign-up/`:
 *
 *   email ─► chooser ─► code  (sign in or create an account by an emailed code; Neon creates the account on first use)
 *                   └─► password ─► (sign up, or an unverified account) code to confirm the email
 *
 * The step changes in place, the address stays visible with "Change", and focus moves to the new step's heading, or into the code
 * field on the code step (P3, P5; review S1). Every call goes through the guarded proxy; every answer maps to the copy of
 * lib/auth/auth-errors.ts, and every new message is also written to the card's one polite live region (review M2). With the code
 * option off (`NEXT_PUBLIC_SIGN_IN_CODE` unset) the chooser is skipped and the card is password only, plus the code step to confirm
 * an email. After success the browser loads the checked `next` page, or the account page.
 *
 * Send waits (review M3, S6): a send records a wait for that address. A successful send waits 60 s: asking again for the same address
 * meanwhile goes straight back to the code step, without a call. A 429 waits for its Retry-After: "Email me a code", "Email me a code
 * instead" and "Create account" are disabled with the time in their label, and the wait ends with an announcement. Editing the
 * address drops it, because the guard's per-address bucket is keyed on the address.
 */
export interface SignInCardProps {
  mode: 'sign-in' | 'sign-up';
  codeOn: boolean;
  siteKey: string | null;
}

type Step = 'email' | 'choose' | 'password' | 'code';
type Purpose = 'sign-in' | 'verify';
interface SendWait {
  address: string;
  until: number;
  /** `sent`: a code is on its way (the code step's resend wait); `limited`: the guard said 429. */
  kind: 'sent' | 'limited';
}

const later = (seconds: number) => Date.now() + seconds * 1000;

export function SignInCard({ mode, codeOn, siteKey }: SignInCardProps) {
  const signUp = mode === 'sign-up';
  const page = signUp ? 'sign-up' : 'sign-in';
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [problem, setProblem] = useState<AuthProblem | null>(null);
  const [busy, setBusy] = useState<null | 'send' | 'resend' | 'code' | 'password'>(null);
  const [purpose, setPurpose] = useState<Purpose>('sign-in');
  const [intro, setIntro] = useState<string | undefined>(undefined);
  const [wait, setWait] = useState<SendWait | null>(null);
  const [resentCount, setResentCount] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [challenged, setChallenged] = useState(false);
  const [moved, setMoved] = useState(false);
  // The card renders only in the browser (no server render), so storage is readable on the first render.
  const [preferPassword] = useState(() => lastMethod() === 'password');
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
  const limitedUntil = mine?.kind === 'limited' ? mine.until : 0;
  const waitLeft = useCountdown(limitedUntil, () => {
    setWait(null);
    setProblem(null);
    announce(COPY.canAskNow);
  });

  /** Show a problem, and read it out unless it is an urgent banner (which is `role="alert"` already). */
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

  const fail = (reply: AuthReply, action: AuthAction): void => {
    report(authProblem(reply, action, { page, codeOn }));
    if (reply.status === 429 && (action === 'send' || action === 'sign-up')) setWait({ address: email, until: later(reply.retryAfterS ?? 60), kind: 'limited' });
  };

  const finish = (method: Method) => {
    rememberMethod(method);
    window.location.assign(returnPathFromSearch(window.location.search));
  };

  const submitEmail = (raw: string) => {
    const value = canonicalAddress(raw);
    if (!value) {
      report({ where: 'field', field: 'email', tone: 'urgent', message: COPY.badEmail });
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
    setWait({ address: email, until: later(EMAIL_CODE.resendAfterS), kind: 'sent' });
    return true;
  };

  const startCode = async () => {
    // The same address again within the minute: the code just sent is still good, so go back to it (review S6).
    if (mine?.kind === 'sent' && mine.until > Date.now() && purpose === 'sign-in') {
      setIntro(undefined);
      go('code');
      return;
    }
    if (await sendCode('sign-in', 'send')) {
      setPurpose('sign-in');
      setIntro(undefined);
      go('code');
    }
  };

  const resend = async () => {
    setNotice(null);
    if (await sendCode(purpose === 'verify' ? 'email-verification' : 'sign-in', 'resend')) {
      const message = resentMessage(email);
      setResentCount((n) => n + 1);
      setNotice(message);
      announce(message);
    }
  };

  const toVerify = (introText?: string) => {
    setPurpose('verify');
    setIntro(introText);
    setWait({ address: email, until: later(EMAIL_CODE.resendAfterS), kind: 'sent' });
    go('code');
  };

  const submitCode = async (otp: string) => {
    setBusy('code');
    setProblem(null);
    setNotice(null);
    const reply = purpose === 'verify' ? await authCall('email-otp/verify-email', { email, otp }) : await authCall('sign-in/email-otp', { email, otp });
    if (reply.status === 200) return finish(purpose === 'verify' ? 'password' : 'code');
    setBusy(null);
    fail(reply, 'verify');
  };

  const submitPassword = async (password: string) => {
    if (signUp && password.length < PASSWORD.minLength) {
      report({ where: 'field', field: 'password', tone: 'urgent', message: COPY.shortPassword });
      return;
    }
    if (!password) {
      report({ where: 'field', field: 'password', tone: 'urgent', message: 'Enter your password.' });
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
    if (reply.status === 403 && reply.code === 'EMAIL_NOT_VERIFIED') return toVerify(COPY.confirmFirst);
    fail(reply, 'password');
  };

  const changeEmail = () => go('email');
  // A wait belongs to the address it was answered for (review M3).
  const editEmail = () => {
    if (wait?.kind === 'limited') setWait(null);
    if (problem) setProblem(null);
  };

  return (
    <div className="auth-card">
      {step === 'email' ? (
        <EmailStep
          email={email}
          problem={problem}
          focus={moved}
          onSubmit={submitEmail}
          onEdit={editEmail}
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
          waitLeft={waitLeft}
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
          waitLeft={waitLeft}
          onCodeInstead={codeOn ? () => void startCode() : undefined}
          sendingCode={busy === 'send'}
          onSubmit={(p) => void submitPassword(p)}
          onChangeEmail={changeEmail}
          onForgot={() => handOffEmail(email)}
        />
      ) : null}
      {step === 'code' ? (
        <CodeStep
          email={email}
          intro={intro}
          submitLabel={purpose === 'verify' ? 'Confirm email' : 'Sign in'}
          problem={problem}
          pending={busy === 'code'}
          focus={moved}
          resendAt={mine?.until ?? 0}
          resending={busy === 'resend'}
          resentCount={resentCount}
          notice={notice}
          announce={announce}
          onSubmit={(c) => void submitCode(c)}
          onResend={() => void resend()}
          onChangeEmail={changeEmail}
          onUsePassword={purpose === 'sign-in' && !signUp ? () => go('password') : undefined}
        />
      ) : null}
      {challenged ? <CardBanner kind="notice">{COPY.challenge}</CardBanner> : null}
      <div ref={slotRef} className="auth-turnstile" />
      {region}
    </div>
  );
}
