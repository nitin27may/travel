'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';
import { COPY, deadCodeMessage, type AuthProblem } from '@/lib/auth/auth-errors';
import { EMAIL_CODE } from '@travel/core/config/auth-limits.ts';
import { clock, useCountdown } from './live';
import { AddressLine, CardBanner, fieldError, KeepAddress, ProblemBanner, StepHeading, TextButton } from './parts';

export { clock } from './live';

/** Digits only, at most six: "482 913", "482-913" and "482913" all become "482913". */
export function codeDigits(raw: string): string {
  return raw.replace(/\D+/g, '').slice(0, EMAIL_CODE.length);
}

interface Props {
  email: string;
  /** A sentence before the lead (review S2): "Confirm your email first." */
  intro?: string;
  submitLabel: string;
  problem: AuthProblem | null;
  pending: boolean;
  /** Put focus in the code field (review S1): paste and autofill need it. True when the step was reached by a step change. */
  focus: boolean;
  /** When "Send a new code" becomes available again (ms since epoch). */
  resendAt: number;
  resending: boolean;
  /** Bumped by the card after each successful resend: the field empties and a dead code comes back to life (review M4, M5). */
  resentCount: number;
  /** The resend confirmation, shown above the field (review M5). */
  notice: string | null;
  announce: (message: string) => void;
  /** The six digits, and the form (the reset step reads its password field from it). */
  onSubmit: (code: string, form: HTMLFormElement) => void;
  onResend: () => void;
  onChangeEmail: () => void;
  /** "Use my password instead" (sign-in only). */
  onUsePassword?: () => void;
  /** Extra fields after the code (reset: the new password). When given, six digits do not submit by themselves. */
  children?: ReactNode;
}

/**
 * The code step (spec 3.2, 3.3; review M4, M5, S1, S7): one numeric field, paste-friendly, submits at six digits. After too many
 * tries or an expired code the field and its submit are disabled and "Send a new code" becomes the primary button, with the wait
 * in its label and in the error. A resend empties the field and says so.
 */
export function CodeStep(props: Props) {
  const { email, intro, submitLabel, problem, pending, focus, resendAt, resending, resentCount, notice, announce, onSubmit, onResend, onChangeEmail, onUsePassword, children } = props;
  const [code, setCode] = useState('');
  const [short, setShort] = useState(false);
  const [dead, setDead] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const leadId = useId();
  const addrId = useId();
  const left = useCountdown(resendAt, () => announce(COPY.canResendNow));
  const waiting = left > 0;

  // A new problem: a dead code (too many tries, expired) empties and locks the field; a wrong one is selected so typing replaces it.
  const [seen, setSeen] = useState(problem);
  if (problem !== seen) {
    setSeen(problem);
    if (problem?.clearCode) {
      setCode('');
      setDead(problem.deadCode ?? 'TOO_MANY_ATTEMPTS');
    }
  }
  // A successful resend brings the form back.
  const [seenResend, setSeenResend] = useState(resentCount);
  if (resentCount !== seenResend) {
    setSeenResend(resentCount);
    setCode('');
    setDead(null);
    setShort(false);
  }

  useEffect(() => {
    if (focus) inputRef.current?.focus();
  }, [focus]);
  useEffect(() => {
    if (problem?.where === 'field' && problem.field === 'code' && !problem.clearCode) inputRef.current?.select();
  }, [problem]);
  useEffect(() => {
    if (resentCount > 0) inputRef.current?.focus();
  }, [resentCount]);

  const error = dead
    ? deadCodeMessage(dead, waiting ? clock(left) : null)
    : short
      ? `Enter the ${EMAIL_CODE.length}-digit code from the email.`
      : fieldError(problem, 'code');

  const change = (value: string) => {
    const digits = codeDigits(value);
    setCode(digits);
    setShort(false);
    if (!children && digits.length === EMAIL_CODE.length && !pending) {
      // Submit by itself at six digits (spec 3.2); requestSubmit keeps the form's own validation and handlers.
      window.setTimeout(() => formRef.current?.requestSubmit(), 0);
    }
  };

  const resendLabel = waiting ? `Send a new code (in ${clock(left)})` : resending ? 'Sending a new code' : 'Send a new code';

  return (
    <form
      ref={formRef}
      className="auth-step"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (pending || dead) return;
        if (code.length !== EMAIL_CODE.length) {
          setShort(true);
          announce(`Enter the ${EMAIL_CODE.length}-digit code from the email.`);
          return;
        }
        onSubmit(code, e.currentTarget);
      }}
    >
      <StepHeading focus={false}>Check your email</StepHeading>
      {intro ? <p className="auth-lead">{intro}</p> : null}
      <p className="auth-lead" id={leadId}>
        We sent a <span className="auth-nowrap">{EMAIL_CODE.length}-digit</span> code to
      </p>
      <AddressLine email={email} onChange={onChangeEmail} id={addrId} />
      <p className="auth-note">{COPY.senderNote}</p>
      <ProblemBanner problem={problem} />
      {notice ? (
        <CardBanner kind="notice">
          <KeepAddress text={notice} email={email} />
        </CardBanner>
      ) : null}
      <Field label="Code" required error={error} help={COPY.codeLifetime}>
        {(a) => (
          <Input
            ref={inputRef}
            mono
            className="auth-code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={EMAIL_CODE.length}
            value={code}
            disabled={Boolean(dead)}
            error={Boolean(error)}
            onChange={(e) => change(e.target.value)}
            onPaste={(e) => {
              e.preventDefault();
              change(e.clipboardData.getData('text'));
            }}
            {...a}
            aria-describedby={[leadId, addrId, a['aria-describedby']].filter(Boolean).join(' ')}
          />
        )}
      </Field>
      {children}
      <div className="auth-actions">
        {dead ? (
          <Button variant="primary" loading={resending} disabled={waiting} onClick={onResend}>
            {resendLabel}
          </Button>
        ) : (
          <Button type="submit" variant="primary" loading={pending}>
            {submitLabel}
          </Button>
        )}
      </div>
      <div className="auth-alt-actions">
        {dead ? null : (
          <TextButton onClick={onResend} disabled={waiting || resending}>
            {resendLabel}
          </TextButton>
        )}
        {onUsePassword ? <TextButton onClick={onUsePassword}>Use my password instead</TextButton> : null}
      </div>
    </form>
  );
}
