'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';
import { Banner } from '@/components/ui/Banner';
import { getAuthClient } from '@/lib/auth/client';

type Mode = 'sign-in' | 'sign-up';

// Distinguish wrong credentials from an unreachable service (review I1): they need different user
// actions, so never show a credentials error when the service never answered.
type Problem = { kind: 'credentials' | 'service'; message: string } | null;

function classify(error: { status?: number; statusCode?: number; code?: string; message?: string } | null | undefined): Problem {
  if (!error) return null;
  const status = error.status ?? error.statusCode ?? 0;
  const code = error.code ?? '';
  const network = status >= 500 || status === 0 || /NETWORK|FETCH|TIMEOUT|UNAVAILABLE/i.test(code);
  if (network) return { kind: 'service', message: '' };
  return { kind: 'credentials', message: error.message ?? '' };
}

export function AuthForm({ mode }: { mode: Mode }) {
  const signUp = mode === 'sign-up';
  const [problem, setProblem] = useState<Problem>(null);
  const [created, setCreated] = useState(false);
  const [pending, setPending] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);

  // Focus the error banner on failure so it is announced (review: submit on Enter, banner focused).
  useEffect(() => {
    if (problem) bannerRef.current?.focus();
  }, [problem]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    setProblem(null);
    const form = new FormData(e.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');
    const name = String(form.get('name') ?? '').trim();
    setPending(true);
    try {
      if (signUp) {
        const { error } = await getAuthClient().signUp.email({ email, password, name: name || email });
        const p = classify(error);
        if (p) {
          setProblem(p);
        } else {
          // Honest about verification limits (review I3): if a session exists now, the account is
          // ready and we go straight in; otherwise ask the user to sign in, without promising mail.
          const session = await getAuthClient().getSession().catch(() => null);
          const user = (session as { data?: { user?: unknown } } | null)?.data?.user;
          if (user) window.location.assign('/account/');
          else setCreated(true);
        }
      } else {
        const { error } = await getAuthClient().signIn.email({ email, password });
        const p = classify(error);
        if (p) setProblem(p);
        else window.location.assign('/account/');
      }
    } catch {
      setProblem({ kind: 'service', message: '' });
    } finally {
      setPending(false);
    }
  }

  if (created) {
    return (
      <div className="auth-form" role="status">
        <Banner kind="notice">Account created. Sign in to continue.</Banner>
        <p className="field-help">If your deployment requires email verification, check your inbox first, then sign in.</p>
        <div className="auth-actions">
          <Button variant="primary" onClick={() => window.location.assign('/sign-in/')}>
            Go to sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form className="auth-form" onSubmit={onSubmit} noValidate>
      {problem ? (
        <div ref={bannerRef} tabIndex={-1} className="auth-banner">
          {problem.kind === 'credentials' ? (
            <Banner kind="urgent">We couldn&rsquo;t sign you in. Check your email and password.</Banner>
          ) : (
            <Banner kind="notice">Sign-in is unavailable right now. Try again shortly.</Banner>
          )}
        </div>
      ) : null}

      {signUp ? (
        <Field label="Name">
          {(a) => <Input type="text" name="name" autoComplete="name" {...a} />}
        </Field>
      ) : null}

      <Field label="Email" required>
        {(a) => <Input type="email" name="email" autoComplete="email" required {...a} />}
      </Field>

      <Field label="Password" required help={signUp ? 'At least 8 characters.' : undefined}>
        {(a) => (
          <Input
            type="password"
            name="password"
            autoComplete={signUp ? 'new-password' : 'current-password'}
            required
            minLength={signUp ? 8 : undefined}
            {...a}
          />
        )}
      </Field>

      <div className="auth-actions">
        <Button type="submit" variant="primary" loading={pending}>
          {signUp ? 'Create account' : 'Sign in'}
        </Button>
      </div>

      <p className="auth-alt">
        {signUp ? (
          <>
            Already have an account? <Link href="/sign-in/">Sign in</Link>
          </>
        ) : (
          <>
            New here? <Link href="/sign-up/">Create an account</Link>
          </>
        )}
      </p>
    </form>
  );
}
