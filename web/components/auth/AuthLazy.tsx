'use client';

import dynamic from 'next/dynamic';

/**
 * Client boundary that code-splits the sign-in card and the reset flow. They load only on the sign-in pages, and only when the
 * account path is on, so no public page carries them at start (budget.test: start JS unchanged). No server render: the card reads
 * the browser (last method, `next`) and has nothing useful to show without JavaScript.
 */
export const SignInCardLazy = dynamic(() => import('./SignInCard').then((m) => m.SignInCard), { ssr: false });

export const ResetFlowLazy = dynamic(() => import('./ResetFlow').then((m) => m.ResetFlow), { ssr: false });
