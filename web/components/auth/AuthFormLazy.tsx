'use client';

import dynamic from 'next/dynamic';

/**
 * Client boundary that code-splits the auth form. The form pulls in the Better Auth browser client
 * (and its input components), which is ~80 KB gzipped and only ever needed when the account path is
 * on. Loading it dynamically keeps it out of the `/sign-in` and `/sign-up` start bundles (budget.test:
 * every page under 200 KB), so the public build — which renders a notice, not the form — stays light.
 */
export const AuthFormLazy = dynamic(() => import('./AuthForm').then((m) => m.AuthForm), { ssr: false });
