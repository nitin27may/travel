'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import type { AuthProblem } from '@/lib/auth/auth-errors';
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
  onSubmit: (password: string) => void;
  onChangeEmail: () => void;
  /** Before following "Forgot password?": hand the address to the reset page. */
  onForgot: () => void;
}

/** The password branch (spec 3.1, step 2b). */
export function PasswordStep({ email, create, problem, pending, focus, onCodeInstead, sendingCode, onSubmit, onChangeEmail, onForgot }: Props) {
  return (
    <form
      className="auth-step"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
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
        <Button type="submit" variant="primary" loading={pending}>
          {create ? 'Create account' : 'Sign in'}
        </Button>
      </div>
      <div className="auth-alt-actions">
        {create ? null : (
          <Link className="auth-link" href="/sign-in/reset/" onClick={onForgot}>
            Forgot password?
          </Link>
        )}
        {onCodeInstead ? (
          <TextButton onClick={onCodeInstead} disabled={sendingCode}>
            {sendingCode ? 'Sending a code' : 'Email me a code instead'}
          </TextButton>
        ) : null}
      </div>
    </form>
  );
}
