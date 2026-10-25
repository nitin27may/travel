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
  const [user, setUser] = useState<HeaderUser | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    import('@/lib/auth/client')
      .then(({ getAuthClient }) => getAuthClient().getSession())
      .then((r) => {
        if (!alive) return;
        setUser(((r as { data?: { user?: HeaderUser } } | null)?.data?.user ?? null) || null);
        setLoaded(true);
      })
      .catch(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  // While loading, and whenever signed out, show the Sign in link (optimistic): no layout shift for
  // the common case, and it is already the server-rendered markup.
  if (!loaded || !user) {
    return <SignInLink />;
  }
  return <AccountMenu user={user} />;
}
