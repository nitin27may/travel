'use client';

import { createRealtimeClient } from '@neon/realtime/client';
import { nodePostgresParsers } from '@neon/realtime/client';
// @neon/realtime-react has no "use client" directive in its build: import it only from client modules.
import { RealtimeProvider } from '@neon/realtime-react';
import { type ReactNode, useState } from 'react';

/**
 * Creates the browser Realtime client once, inside the React tree. Creating it does not connect, so
 * it is safe during the server render; it connects on the first subscribe and disconnects after the
 * last subscription ends. `nodePostgresParsers` makes the browser parse live rows the way node-pg
 * parses server rows, so `created_at`/`updated_at` stay `Date`s.
 */
export function RealtimeRoot({ url, children }: { url: string; children: ReactNode }) {
  const [client] = useState(() => createRealtimeClient({ url, parsers: { ...nodePostgresParsers } }));
  return <RealtimeProvider client={client}>{children}</RealtimeProvider>;
}
