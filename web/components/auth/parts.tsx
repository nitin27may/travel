'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Field, Input } from '@/components/ui/Input';
import { maskAddress, type AuthProblem } from '@/lib/auth/auth-errors';
import { PASSWORD } from '@travel/core/config/auth-limits.ts';

/** The step heading. It takes focus when the step changes in place (spec 3.1, P5), so a screen reader hears where it is. */
export function StepHeading({ children, focus }: { children: ReactNode; focus: boolean }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focus) ref.current?.focus();
  }, [focus]);
  return (
    <h2 ref={ref} tabIndex={-1} className="auth-step-title">
      {children}
    </h2>
  );
}

/**
 * A banner inside the card, with the anatomy of components 5.4 (`.ban`). Only the urgent kind is a live node (`role="alert"`);
 * notices are read through the card's one polite live region instead (review M2), so they are never read twice or skipped.
 */
export function CardBanner({ kind, children }: { kind: 'urgent' | 'notice' | 'offline'; children: ReactNode }) {
  return (
    <div className={`ban ban-${kind}`} role={kind === 'urgent' ? 'alert' : undefined}>
      <Icon name={kind === 'urgent' ? 'warn' : kind === 'offline' ? 'wifiOff' : 'info'} size={16} />
      <span className="ban-text">{children}</span>
    </div>
  );
}

/** A banner-level problem (field-level ones go under their field). */
export function ProblemBanner({ problem }: { problem: AuthProblem | null }) {
  if (!problem || problem.where !== 'banner') return null;
  return <CardBanner kind={problem.tone}>{problem.message}</CardBanner>;
}

/** A text action with a 44 px target: Change, Forgot password?, Send a new code. */
export function TextButton({ children, onClick, disabled, describedBy }: { children: ReactNode; onClick: () => void; disabled?: boolean; describedBy?: string }) {
  return (
    <button type="button" className="auth-link" onClick={onClick} disabled={disabled} aria-describedby={describedBy}>
      {children}
    </button>
  );
}

/** The masked address after step 1, with "Change" back to the email step (the full address stays in that field). */
export function AddressLine({ email, onChange, prefix, id }: { email: string; onChange: () => void; prefix?: string; id?: string }) {
  return (
    <p className="auth-address">
      <span>
        {prefix ? `${prefix} ` : null}
        <span className="auth-masked" id={id}>
          {maskAddress(email)}
        </span>
      </span>
      <TextButton onClick={onChange}>
        Change<span className="sr-only"> email address</span>
      </TextButton>
    </p>
  );
}

export function fieldError(problem: AuthProblem | null, field: 'email' | 'code' | 'password'): string | undefined {
  return problem?.where === 'field' && problem.field === field ? problem.message : undefined;
}

/** Password with a Show toggle (spec 3.1). `create`: a new password, at least 8 characters. */
export function PasswordField({ create, error, label = 'Password', inputRef }: { create?: boolean; error?: string; label?: string; inputRef?: React.RefObject<HTMLInputElement | null> }) {
  const [shown, setShown] = useState(false);
  return (
    <Field label={label} required error={error} help={create ? `At least ${PASSWORD.minLength} characters.` : undefined}>
      {(a) => (
        <div className="auth-password">
          <Input
            ref={inputRef}
            type={shown ? 'text' : 'password'}
            name="password"
            autoComplete={create ? 'new-password' : 'current-password'}
            required
            minLength={create ? PASSWORD.minLength : undefined}
            maxLength={PASSWORD.maxLength}
            error={Boolean(error)}
            {...a}
          />
          <button type="button" className="btn auth-show" aria-pressed={shown} onClick={() => setShown((v) => !v)}>
            {shown ? 'Hide' : 'Show'}
            <span className="sr-only"> password</span>
          </button>
        </div>
      )}
    </Field>
  );
}
