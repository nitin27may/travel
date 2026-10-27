'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Field, Input } from '@/components/ui/Input';
import { COPY, maskAddress, splitAtAddress, type AuthProblem } from '@/lib/auth/auth-errors';
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
export function CardBanner({ kind, children, action }: { kind: 'urgent' | 'notice' | 'offline'; children: ReactNode; action?: ReactNode }) {
  return (
    <div className={`ban ban-${kind}`} role={kind === 'urgent' ? 'alert' : undefined}>
      <Icon name={kind === 'urgent' ? 'warn' : kind === 'offline' ? 'wifiOff' : 'info'} size={16} />
      <span className="ban-text">
        {children}
        {action ? <span className="auth-ban-action">{action}</span> : null}
      </span>
    </div>
  );
}

/**
 * "Use Google instead" (GSI-R S1): the sign-in card provides it when Google is on, and a banner whose words offer Google (strings 52
 * to 55) shows it as a text button, so the promise has a way to keep it on steps 2 and 3, where the Google button is not on screen.
 */
export const UseGoogleContext = createContext<(() => void) | null>(null);

/** A banner-level problem (field-level ones go under their field). */
export function ProblemBanner({ problem }: { problem: AuthProblem | null }) {
  const toGoogle = useContext(UseGoogleContext);
  if (!problem || problem.where !== 'banner') return null;
  const action = problem.google && toGoogle ? <TextButton onClick={toGoogle}>{COPY.useGoogle}</TextButton> : null;
  return (
    <CardBanner kind={problem.tone} action={action}>
      {problem.message}
    </CardBanner>
  );
}

/** A message that names the masked address, with the address kept on one line (GSI-UX-R S3). */
export function KeepAddress({ text, email }: { text: string; email: string }) {
  const parts = splitAtAddress(text, email);
  if (!parts) return <>{text}</>;
  return (
    <>
      {parts.before}
      <span className="auth-nowrap">{parts.masked}</span>
      {parts.after}
    </>
  );
}

/** A sentence with one phrase kept on one line ("6-digit" must not break at its hyphen once the line is centred, GSI-UXF). */
export function KeepPhrase({ text, phrase }: { text: string; phrase: string }) {
  const at = phrase ? text.indexOf(phrase) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <span className="auth-nowrap">{phrase}</span>
      {text.slice(at + phrase.length)}
    </>
  );
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
