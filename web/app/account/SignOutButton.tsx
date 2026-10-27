'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { getAuthClient } from '@/lib/auth/client';
import { clearAccountParty } from '@/lib/account/seed-party';
import { leaveSession } from '@/lib/auth/session-lost';

/**
 * Sign out, then unload all prior-user client state with a full page change (review C2). A plain
 * secondary button, not danger. `leaveSession()` reloads to `/`, which drops the Realtime client and
 * the previous user's rows and re-reads the session.
 */
export function SignOutButton() {
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="secondary"
      loading={pending}
      onClick={async () => {
        setPending(true);
        try {
          await getAuthClient().signOut();
        } catch {
          /* leave anyway: the session change must unload client state regardless */
        }
        // a shared computer shows nothing of the previous person: a party the account put here goes, the browser's own stays (spec 5.4)
        clearAccountParty();
        leaveSession();
      }}
    >
      Sign out
    </Button>
  );
}
