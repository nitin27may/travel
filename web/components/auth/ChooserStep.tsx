'use client';

import { Button } from '@/components/ui/Button';
import type { AuthProblem } from '@/lib/auth/auth-errors';
import { AddressLine, ProblemBanner, StepHeading } from './parts';

interface Props {
  email: string;
  signUp: boolean;
  /** The way used last on this browser comes first (spec 3.1, `auth.lastMethod`; no address is stored). */
  passwordFirst: boolean;
  problem: AuthProblem | null;
  sending: boolean;
  focus: boolean;
  onCode: () => void;
  onPassword: () => void;
  onChangeEmail: () => void;
}

/** Step 2: how to go on. Phase 1 has no link option (the shared sender cannot send links). */
export function ChooserStep({ email, signUp, passwordFirst, problem, sending, focus, onCode, onPassword, onChangeEmail }: Props) {
  const code = (
    <Button key="code" variant={passwordFirst ? 'secondary' : 'primary'} loading={sending} onClick={onCode}>
      Email me a code
    </Button>
  );
  const password = (
    <Button key="password" variant={passwordFirst ? 'primary' : 'secondary'} onClick={onPassword} disabled={sending}>
      {signUp ? 'Create a password' : 'Use my password'}
    </Button>
  );
  return (
    <div className="auth-step">
      <StepHeading focus={focus}>{signUp ? 'How do you want to sign up?' : 'How do you want to sign in?'}</StepHeading>
      <AddressLine email={email} onChange={onChangeEmail} />
      <ProblemBanner problem={problem} />
      <div className="auth-choices">{passwordFirst ? [password, code] : [code, password]}</div>
      <p className="auth-help">We email you a 6-digit code. No password needed.</p>
    </div>
  );
}
