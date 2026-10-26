'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { SignInLink } from './SignInLink';
import type { HeaderUser } from './AccountMenu';

// The avatar menu pulls in Base UI (the popover) and the auth client; load it only after a session
// is confirmed so neither reaches the public shell's initial bundle (budget.test / place-size).
const AccountMenu = dynamic(() => import('./AccountMenu').then((m) => m.AccountMenu), { ssr: false });

/**
 * The session-aware right cluster of the public header (review I2). Server-renders the lightweight
 * Sign in link (no Base UI, no auth client — accessible without JS and in the SSR HTML), then reads
 * the session client-side and swaps in the avatar menu when signed in. The auth client is imported
 * lazily inside the effect so Better Auth stays out of the initial shared bundle on public pages.
 */
export function AccountNav() {
  const [user, setUser] = useState<HeaderUser>();
  useEffect(() => {
    import('@/lib/auth/client')
      .then(({ getAuthClient }) => getAuthClient().getSession())
      .then((r) => {
        const u = (r as { data?: { user?: HeaderUser } } | null)?.data?.user;
        // Below 640 px the header shows the phone account link instead (NAV-F D2): the avatar menu and its chunk never load on a phone
        const q = matchMedia('(min-width: 640px)');
        q.onchange = () => setUser(q.matches ? u : undefined);
        setUser(q.matches ? u : undefined);
        // the phone header swaps its Sign in link for Account from this attribute (NAV-1): no second session read
        if (u) document.documentElement.dataset.signedIn = ''; // sign-out reloads the page
      })
      .catch(() => {});
  }, []);

  // Loading, failed, signed out, or a phone: the Sign in link (optimistic, and already the server-rendered markup, so no layout shift;
  // CSS hides it below 640 px).
  return user ? <AccountMenu user={user} /> : <SignInLink />;
}
