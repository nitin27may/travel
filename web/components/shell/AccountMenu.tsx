'use client';

import { Menu } from '@/components/ui/Menu';
import { getAuthClient } from '@/lib/auth/client';
import { leaveSession } from '@/lib/auth/session-lost';
import { initialOf } from '@/lib/account/name';

export type HeaderUser = { id: string; email: string; name?: string | null };

/**
 * The signed-in avatar menu: exactly Account and Sign out — no planner nav, no bell, no trip chip
 * (review I2). Split out of `AccountNav` and loaded dynamically, so the Base UI popover library and
 * the auth client it uses for `signOut` stay out of the public shell's initial bundle (budget.test:
 * no `data-base-ui` in the list/place start chunks). Only mounts once a session is confirmed.
 */
export function AccountMenu({ user }: { user: HeaderUser }) {
  // the name is re-read through displayName and its first grapheme taken, never charAt(0) (review ACCT-PSEC S5)
  const initial = initialOf(user.name, user.email);
  return (
    <Menu
      triggerClassName="avatar-btn"
      triggerLabel="Account menu"
      trigger={<span className="avatar-disc" aria-hidden="true">{initial}</span>}
      align="end"
      entries={[
        { label: 'Account', icon: 'user', href: '/account/' },
        {
          label: 'Sign out',
          separatorBefore: true,
          onSelect: async () => {
            try {
              await getAuthClient().signOut();
            } catch {
              /* unload client state regardless */
            }
            // lazy: this chunk loads on every signed-in public page, and the party code is not needed until sign-out (spec 5.4)
            try {
              (await import('@/lib/account/seed-party')).clearAccountParty();
            } catch {
              /* leave anyway */
            }
            leaveSession();
          },
        },
      ]}
    />
  );
}
