'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';
import { COPY, type AuthProblem } from '@/lib/auth/auth-errors';
import { EMAIL_CODE } from '@travel/core/config/auth-limits.ts';
import { AddressLine, fieldError, ProblemBanner, StepHeading, TextButton } from './parts';

/** Digits only, at most six: "482 913", "482-913" and "482913" all become "482913". */
export function codeDigits(raw: string): string {
  return raw.replace(/\D+/g, '').slice(0, EMAIL_CODE.length);
}

/** "0:42" */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

interface Props {
  email: string;
  /** The line under the heading, before the masked address; defaults to "We sent a 6-digit code to". */
  lead?: string;
  submitLabel: string;
  problem: AuthProblem | null;
  pending: boolean;
  focus: boolean;
  /** When "Send a new code" becomes available again (ms since epoch). */
  resendAt: number;
  resending: boolean;
  /** The six digits, and the form (the reset step reads its password field from it). */
  onSubmit: (code: string, form: HTMLFormElement) => void;
  onResend: () => void;
  onChangeEmail: () => void;
  /** "Use my password instead" (sign-in only). */
  onUsePassword?: () => void;
  /** Extra fields after the code (reset: the new password). When given, six digits do not submit by themselves. */
  children?: ReactNode;
}

/** The code step (spec 3.2, 3.3): one numeric field, paste-friendly, submits at six digits, 60 s resend cooldown. */
export function CodeStep({ email, lead, submitLabel, problem, pending, focus, resendAt, resending, onSubmit, onResend, onChangeEmail, onUsePassword, children }: Props) {
  const [code, setCode] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const formRef = useRef<HTMLFormElement>(null);
  const liveId = useId();
  const [short, setShort] = useState(false);
  const error = short ? `Enter the ${EMAIL_CODE.length}-digit code from the email.` : fieldError(problem, 'code');
  const left = Math.max(0, (resendAt - now) / 1000);
  const waiting = left > 0;

  // Tick once a second while the cooldown runs; the live region speaks only when the link becomes available.
  useEffect(() => {
    // A new send restarts the count from the real time at once, then ticks every second while it runs.
    const first = window.setTimeout(() => setNow(Date.now()), 0);
    const t = waiting ? window.setInterval(() => setNow(Date.now()), 1000) : undefined;
    return () => {
      window.clearTimeout(first);
      if (t) window.clearInterval(t);
    };
  }, [waiting, resendAt]);
  // Too many tries or an expired code empties the field (spec 3.3), once per new problem.
  const [seen, setSeen] = useState(problem);
  if (problem !== seen) {
    setSeen(problem);
    if (problem?.clearCode) setCode('');
  }

  const change = (value: string) => {
    const digits = codeDigits(value);
    setCode(digits);
    setShort(false);
    if (!children && digits.length === EMAIL_CODE.length && !pending) {
      // Submit by itself at six digits (spec 3.2); requestSubmit keeps the form's own validation and handlers.
      window.setTimeout(() => formRef.current?.requestSubmit(), 0);
    }
  };

  return (
    <form
      ref={formRef}
      className="auth-step"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        if (code.length !== EMAIL_CODE.length) {
          setShort(true);
          return;
        }
        onSubmit(code, e.currentTarget);
      }}
    >
      <StepHeading focus={focus}>Check your email</StepHeading>
      <p className="auth-lead">{lead ?? `We sent a ${EMAIL_CODE.length}-digit code to`}</p>
      <AddressLine email={email} onChange={onChangeEmail} />
      <p className="auth-note">{COPY.senderNote}</p>
      <ProblemBanner problem={problem} />
      <Field label="Code" required error={error} help={COPY.codeLifetime}>
        {(a) => (
          <Input
            mono
            className="auth-code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={EMAIL_CODE.length}
            value={code}
            error={Boolean(error)}
            onChange={(e) => change(e.target.value)}
            onPaste={(e) => {
              e.preventDefault();
              change(e.clipboardData.getData('text'));
            }}
            {...a}
          />
        )}
      </Field>
      {children}
      <div className="auth-actions">
        <Button type="submit" variant="primary" loading={pending}>
          {submitLabel}
        </Button>
      </div>
      <div className="auth-alt-actions">
        <TextButton onClick={onResend} disabled={waiting || resending}>
          {waiting ? `Send a new code (in ${clock(left)})` : resending ? 'Sending a new code' : 'Send a new code'}
        </TextButton>
        {onUsePassword ? <TextButton onClick={onUsePassword}>Use my password instead</TextButton> : null}
      </div>
      <span id={liveId} className="sr-only" aria-live="polite">
        {waiting ? '' : 'You can send a new code now.'}
      </span>
    </form>
  );
}
