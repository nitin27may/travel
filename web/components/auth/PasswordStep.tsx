'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import type { AuthProblem } from '@/lib/auth/auth-errors';
import { timeLeft } from './live';
import { AddressLine, fieldError, PasswordField, ProblemBanner, StepHeading, TextButton } from './parts';

interface Props {
  email: string;
  /** Sign up: create a password (then the code step confirms the email). */
  create: boolean;
  problem: AuthProblem | null;
  pending: boolean;
  focus: boolean;
  /** "Email me a code instead", only when the code option is on. */
  onCodeInstead?: () => void;
  sendingCode?: boolean;
  /** Seconds left of a send wait for this address (review M3): it disables "Email me a code instead" and, on sign-up, "Create account". */
  waitLeft: number;
  onSubmit: (password: string) => void;
  onChangeEmail: () => void;
  /** Before following "Forgot password?": hand the address to the reset page. */
  onForgot: () => void;
}

/** The password branch (spec 3.1, step 2b). */
export function PasswordStep({ email, create, problem, pending, focus, onCodeInstead, sendingCode, waitLeft, onSubmit, onChangeEmail, onForgot }: Props) {
  const waiting = waitLeft > 0;
  const wait = waiting ? ` (in ${timeLeft(waitLeft)})` : '';
  return (
    <form
      className="auth-step"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (pending || (create && waiting)) return;
        onSubmit(String(new FormData(e.currentTarget).get('password') ?? ''));
      }}
    >
      <StepHeading focus={focus}>{create ? 'Create a password' : 'Enter your password'}</StepHeading>
      <AddressLine email={email} onChange={onChangeEmail} />
      {/* A hidden username field lets password managers save the address with the password. */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      <ProblemBanner problem={problem} />
      <PasswordField create={create} error={fieldError(problem, 'password')} />
      <div className="auth-actions">
        <Button type="submit" variant="primary" loading={pending} disabled={create && waiting}>
          {create ? `Create account${wait}` : 'Sign in'}
        </Button>
      </div>
      <div className="auth-alt-actions">
        {create ? null : (
          <Link className="auth-link" href="/sign-in/reset/" onClick={onForgot}>
            Forgot password?
          </Link>
        )}
        {onCodeInstead ? (
          <TextButton onClick={onCodeInstead} disabled={sendingCode || waiting}>
            {sendingCode ? 'Sending a code' : `Email me a code instead${wait}`}
          </TextButton>
        ) : null}
      </div>
    </form>
  );
}
