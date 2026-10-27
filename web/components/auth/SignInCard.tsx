'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { canonicalAddress } from '@travel/core/mail/address.ts';
import { EMAIL_CODE, PASSWORD } from '@travel/core/config/auth-limits.ts';
import { authProblem, COPY, resentMessage, type AuthAction, type AuthProblem } from '@/lib/auth/auth-errors';
import { GOOGLE_START_TIMEOUT_MS, googleAuthorizeUrl, googleStartBody, inAppBrowser, pendingFresh, readReturn } from '@/lib/auth/google';
import { GOOGLE_COPY, googleStartNotice, type GoogleNotice } from '@/lib/auth/oauth-errors';
import { readCardStart } from './card-start';
import { linkKeepingNext, returnPathFromSearch } from '@/lib/auth/return-path';
import { authCall, type AuthReply } from './api';
import { ChooserStep } from './ChooserStep';
import { CodeStep } from './CodeStep';
import { EmailStep } from './EmailStep';
import { GoogleStart } from './GoogleButton';
import { useAnnouncer, useCountdown } from './live';
import { clearGooglePending, handOffEmail, lastMethod, markGooglePending, peekGooglePending, rememberMethod, undoGooglePress, type Method } from './memory';
import { CardBanner, UseGoogleContext } from './parts';
import { PasswordStep } from './PasswordStep';
import { useTurnstile } from './TurnstileLazy';
import './auth.css';

/**
 * The passwordless-first sign-in card (email spec 3, Phase 1). One card on `/sign-in/` and `/sign-up/`:
 *
 *   email ─► chooser ─► code  (sign in or create an account by an emailed code; Neon creates the account on first use)
 *                   └─► password ─► (sign up, or an unverified account: a guarded send first) code to confirm the email
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
 *
 * Continue with Google (GSI-1, copy page 2.1 to 2.3): with `googleOn`, step 1 starts with the Google button, its consent line and the
 * divider "or". A press checks the connection, asks the guarded proxy for Google's address (`sign-in/social`), sets the pending mark
 * (a time only) and leaves; the email form is disabled meanwhile. On a return the card reads `error` once, shows its banner, and
 * removes `error` (and any verifier the proxy bounced here) from the address. A recent press with no `error` on a Back or a bounced
 * exchange reads "didn't finish". A page restored from the back-forward cache comes back ready, never with the spinner.
 */
export interface SignInCardProps {
  mode: 'sign-in' | 'sign-up';
  codeOn: boolean;
  /** Continue with Google (`signInGoogle`). */
  googleOn?: boolean;
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

export function SignInCard({ mode, codeOn, googleOn = false, siteKey }: SignInCardProps) {
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
  // "Use Google instead" (GSI-R S1): back on step 1, focus goes to the Google button rather than into the email field.
  const [toGoogle, setToGoogle] = useState(false);
  // The card renders only in the browser (no server render), so storage is readable on the first render. The read is pure (GSI-UXF
  // M1): React may run this first render twice before it commits, so the writes (put back the way in from before a press that came
  // back here, drop the mark) wait for the mount effect below.
  const [start] = useState(() => readCardStart(googleOn));
  const returned = start.returned;
  const [last, setLast] = useState(start.last);
  const preferPassword = last === 'password';
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleNotice, setGoogleNotice] = useState<GoogleNotice | null>(returned);
  const [focusEmail] = useState(() => Boolean(googleNotice?.focusEmail));
  // Hints read once from the browser (copy page 7 to 9). The card renders only in the browser, so these are safe at first render.
  const [cookiesOff] = useState(() => typeof navigator !== 'undefined' && navigator.cookieEnabled === false);
  const [inApp] = useState(() => googleOn && typeof navigator !== 'undefined' && inAppBrowser(navigator.userAgent));
  const flagOff = !googleOn && codeOn && last === 'google';
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

  /** Show a Google banner, and read it out unless it is urgent (`role="alert"` already). */
  const showGoogle = (n: GoogleNotice | null) => {
    setGoogleNotice(n);
    if (n && n.tone !== 'urgent') announce(n.message);
  };

  // After the first render: the return is read once (copy page 2.3), so drop the mark and take `error` (and any bounced verifier) out
  // of the address, then read the first notice out.
  useEffect(() => {
    if (returned) undoGooglePress();
    clearGooglePending();
    const r = readReturn(window.location.search);
    if (r.changed) window.history.replaceState(window.history.state, '', `${window.location.pathname}${r.cleanSearch}${window.location.hash}`);
    const first = googleNotice ? (googleNotice.tone === 'urgent' ? null : googleNotice.message) : cookiesOff ? COPY.cookiesOff : inApp ? GOOGLE_COPY.inApp : flagOff ? GOOGLE_COPY.flagOff : null;
    if (first) announce(first);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on the first render in the browser
  }, []);
  useEffect(() => {
    if (!googleOn) return;
    const onShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      setGoogleBusy(false);
      const fresh = pendingFresh(peekGooglePending(), Date.now());
      if (fresh) {
        undoGooglePress();
        setLast(lastMethod());
        showGoogle({ tone: 'notice', message: GOOGLE_COPY.didNotFinish });
      } else clearGooglePending();
    };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- showGoogle only sets state and announces
  }, [googleOn]);

  /** Continue with Google: offline check, the guarded start, then leave for Google's own address only (strings 10 to 14). */
  const startGoogle = async () => {
    if (googleBusy) return;
    setGoogleNotice(null);
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      showGoogle(googleStartNotice({ status: 0, code: 'OFFLINE', retryAfterS: null }));
      return;
    }
    setGoogleBusy(true);
    announce(GOOGLE_COPY.opening);
    // A start that never answers ends after GOOGLE_START_TIMEOUT_MS with string 13, so the email way opens again (GSI-R S3).
    const reply = await authCall('sign-in/social', googleStartBody(page, new URLSearchParams(window.location.search).get('next')), null, { timeoutMs: GOOGLE_START_TIMEOUT_MS });
    const url = reply.status === 200 ? googleAuthorizeUrl(reply.body) : null;
    if (!url) {
      setGoogleBusy(false);
      showGoogle(googleStartNotice(reply));
      return;
    }
    // The mark keeps the way in from before the press, so it can be put back if this press comes back here (GSI-2).
    markGooglePending(Date.now());
    rememberMethod('google');
    window.location.assign(url);
  };

  /** Show a problem, and read it out unless it is an urgent banner (which is `role="alert"` already). */
  const report = (p: AuthProblem | null) => {
    setProblem(p);
    if (p && (p.where === 'field' || p.tone !== 'urgent')) announce(p.message);
  };

  const go = (next: Step) => {
    setProblem(null);
    setNotice(null);
    setMoved(true);
    setToGoogle(false);
    setStep(next);
  };

  /** "Use Google instead" on a banner of steps 2 and 3 (strings 52 to 55): step 1, focus on the Google button. */
  const backToGoogle = () => {
    go('email');
    setToGoogle(true);
  };

  /** "Forgot password?" on step 1: hand the address typed so far (if any) to the reset page, as the password step does. */
  const forgotFromEmail = (e: MouseEvent<HTMLAnchorElement>) => {
    const field = e.currentTarget.closest('form')?.querySelector<HTMLInputElement>('input[name="email"]');
    const typed = canonicalAddress(field?.value ?? '');
    if (typed) handOffEmail(typed);
  };

  const fail = (reply: AuthReply, action: AuthAction): void => {
    report(authProblem(reply, action, { page, codeOn, googleOn }));
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

  /**
   * Password sign-in to an unverified account: Neon sends nothing on sign-in (its "send verification email on sign-in" setting stays
   * off, review MF2), so the card asks for a confirmation code through the guarded send route (Turnstile and every send bucket). A
   * confirmation code sent to this address in the last minute is still good: go back to it without a call.
   */
  const confirmUnverified = async () => {
    if (mine?.kind === 'sent' && mine.until > Date.now() && purpose === 'verify') return toVerify(COPY.confirmFirst);
    if (await sendCode('email-verification', 'send')) toVerify(COPY.confirmFirst);
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
    if (reply.status === 403 && reply.code === 'EMAIL_NOT_VERIFIED') return confirmUnverified();
    fail(reply, 'password');
  };

  const changeEmail = () => go('email');
  // A wait belongs to the address it was answered for (review M3).
  const editEmail = () => {
    if (wait?.kind === 'limited') setWait(null);
    if (problem) setProblem(null);
  };

  // Links between the sign-in pages keep the checked `next`, so switching page still returns where the person started.
  const search = window.location.search;
  const signUpHref = linkKeepingNext('/sign-up/', search);
  const signInHref = linkKeepingNext('/sign-in/', search);
  const resetHref = linkKeepingNext('/sign-in/reset/', search);

  return (
    <UseGoogleContext.Provider value={googleOn ? backToGoogle : null}>
    <div className="auth-card">
      {cookiesOff ? <CardBanner kind="notice">{COPY.cookiesOff}</CardBanner> : null}
      {step === 'email' && googleNotice ? <CardBanner kind={googleNotice.tone}>{googleNotice.message}</CardBanner> : null}
      {step === 'email' && inApp ? <CardBanner kind="notice">{GOOGLE_COPY.inApp}</CardBanner> : null}
      {step === 'email' && flagOff ? <CardBanner kind="notice">{GOOGLE_COPY.flagOff}</CardBanner> : null}
      {step === 'email' && googleOn ? <GoogleStart busy={googleBusy} onPress={() => void startGoogle()} lastUsed={last === 'google'} focus={toGoogle} /> : null}
      {step === 'email' ? (
        <fieldset className="auth-fieldset" disabled={googleBusy || undefined}>
          <EmailStep
            email={email}
            problem={problem}
            focus={(moved || focusEmail) && !toGoogle}
            onSubmit={submitEmail}
            onEdit={editEmail}
            onFirstFocus={prime}
            hint={codeOn ? COPY.nextSteps : undefined}
            footer={
              <div className="auth-foot">
                {signUp ? null : (
                  <p className="auth-forgot">
                    <Link className="auth-link" href={resetHref} onClick={forgotFromEmail}>
                      Forgot password?
                    </Link>
                  </p>
                )}
                <p className="auth-alt">
                  {signUp ? (
                    <>
                      Already have an account? <Link href={signInHref}>Sign in</Link>
                    </>
                  ) : (
                    <>
                      New here? <Link href={signUpHref}>Create an account</Link>
                    </>
                  )}
                </p>
              </div>
            }
          />
        </fieldset>
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
    </UseGoogleContext.Provider>
  );
}
