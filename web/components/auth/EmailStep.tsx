'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';
import type { AuthProblem } from '@/lib/auth/auth-errors';
import { fieldError, ProblemBanner } from './parts';

interface Props {
  email: string;
  problem: AuthProblem | null;
  /** Focus the field: true when coming back with "Change" (never on first load, which would scroll a phone). */
  focus: boolean;
  pending?: boolean;
  submitLabel?: string;
  onSubmit: (email: string) => void;
  /** First focus of the field: start loading Turnstile (spec 3.4). */
  onFirstFocus: () => void;
  footer?: ReactNode;
}

/** Step 1: the email only. Nothing is sent and nothing about the address is revealed here (spec 3.1). */
export function EmailStep({ email, problem, focus, pending, submitLabel = 'Continue', onSubmit, onFirstFocus, footer }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focus) ref.current?.focus();
  }, [focus]);
  return (
    <form
      className="auth-step"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        onSubmit(String(new FormData(e.currentTarget).get('email') ?? ''));
      }}
    >
      <ProblemBanner problem={problem} />
      <Field label="Email" required error={fieldError(problem, 'email')}>
        {(a) => (
          <Input
            ref={ref}
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            defaultValue={email}
            error={Boolean(fieldError(problem, 'email'))}
            onFocus={onFirstFocus}
            {...a}
          />
        )}
      </Field>
      <div className="auth-actions">
        <Button type="submit" variant="primary" loading={pending}>
          {submitLabel}
        </Button>
      </div>
      {footer}
    </form>
  );
}
