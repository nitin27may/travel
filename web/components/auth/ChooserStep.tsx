'use client';

import { useId } from 'react';
import { Button } from '@/components/ui/Button';
import { COPY, type AuthProblem } from '@/lib/auth/auth-errors';
import { EMAIL_CODE } from '@travel/core/config/auth-limits.ts';
import { timeLeft } from './live';
import { AddressLine, KeepPhrase, ProblemBanner, StepHeading } from './parts';

interface Props {
  email: string;
  signUp: boolean;
  /** The way used last on this browser comes first (spec 3.1, `auth.lastMethod`; no address is stored). */
  passwordFirst: boolean;
  problem: AuthProblem | null;
  sending: boolean;
  focus: boolean;
  /** Seconds left of a send wait for this address (review M3); 0 when none. */
  waitLeft: number;
  onCode: () => void;
  onPassword: () => void;
  onChangeEmail: () => void;
}

/**
 * Step 2: how to go on. Phase 1 has no link option (the shared sender cannot send links). While a send wait runs, "Email me a code"
 * is disabled with the time in its label, and on the sign-in page "Use my password" becomes the primary button meanwhile (its guard
 * buckets are separate); on sign-up the password path draws on the same bucket, so nothing is promoted there.
 */
export function ChooserStep({ email, signUp, passwordFirst, problem, sending, focus, waitLeft, onCode, onPassword, onChangeEmail }: Props) {
  const helpId = useId();
  const waiting = waitLeft > 0;
  const passwordPrimary = !signUp && (passwordFirst || waiting);
  const codeFirst = !passwordPrimary;
  const code = (
    <Button key="code" variant={passwordPrimary ? 'secondary' : 'primary'} loading={sending} disabled={waiting} onClick={onCode} aria-describedby={codeFirst ? helpId : undefined}>
      {waiting ? `Email me a code (in ${timeLeft(waitLeft)})` : 'Email me a code'}
    </Button>
  );
  const help = codeFirst ? (
    <p key="help" id={helpId} className="auth-help">
      <KeepPhrase text={COPY.codeHelp} phrase={`${EMAIL_CODE.length}-digit`} />
    </p>
  ) : null;
  const password = (
    <Button key="password" variant={passwordPrimary ? 'primary' : 'secondary'} onClick={onPassword} disabled={sending}>
      {signUp ? 'Create a password' : 'Use my password'}
    </Button>
  );
  return (
    <div className="auth-step">
      <StepHeading focus={focus}>{signUp ? 'How do you want to sign up?' : 'How do you want to sign in?'}</StepHeading>
      <AddressLine email={email} onChange={onChangeEmail} />
      <ProblemBanner problem={problem} />
      <div className="auth-choices">{codeFirst ? [code, help, password] : [password, code]}</div>
    </div>
  );
}
